import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import {
  ArrowNestedIcon,
  ChildIcon,
  CloseIcon,
  DocScannedIcon,
  DocVerifiedIcon,
  HandIcon,
  InfantIcon,
} from "../components/Icon";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { FlagKind, FlagModal } from "../components/flightcard/PassengerModals";
import { PassengerDocPanel } from "../components/PassengerDocPanel";
import { useRetainedPanelTransition } from "../usePanelMounted";
import { EntityNotFound } from "../components/EntityNotFound";
import {
  FlagStatus,
  asvcStatus,
  commentsStatus,
  etStatus,
  ffpStatus,
  parsePassengerExtra,
  trStatus,
} from "../paxExtra";

// Matches PnrView's fmtCardDate — same UTC wall-clock convention as the rest of the app.
function fmtCardDate(std: string): string {
  const d = new Date(std);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} · ${time}`;
}

// "C18Y162" -> { C: 18, Y: 162 }; matches PnrView's parseVersion.
function parseVersion(version: string | null): { C: number; Y: number } {
  if (!version) return { C: 0, Y: 0 };
  const c = /C(\d+)/.exec(version);
  const y = /Y(\d+)/.exec(version);
  return { C: c ? +c[1] : 0, Y: y ? +y[1] : 0 };
}

function StatBar({ label, count, total }: { label: "C" | "Y"; count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div className="pnr-stat-row">
      <span className={`pnr-stat-cls pnr-stat-cls-${label}`}>{label}</span>
      <div className="pnr-bar">
        <div className={`pnr-bar-fill pnr-bar-fill-${label}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="pnr-stat-frac mono">{count}/{total}</span>
    </div>
  );
}

function classFor(p: Passenger, seatByCode: Map<string, SeatCell>): "C" | "Y" | null {
  const seat = p.seat ? seatByCode.get(p.seat) : undefined;
  if (!seat) return null;
  return seat.cabin_class === "J" ? "C" : "Y";
}

function statusLabel(p: Passenger): string {
  if (p.boarding_status === "BOARDED") return "Boarded";
  if (p.boarding_status === "OFFLOADED") return "Offloaded";
  if (p.checkin_status === "CHECKED_IN") return "Checked-in";
  return "Not checked-in";
}
function statusChipClass(p: Passenger): string {
  if (p.boarding_status === "OFFLOADED") return "danger";
  if (p.boarding_status === "BOARDED" || p.checkin_status === "CHECKED_IN") return "ok";
  return "muted";
}

// Each flag chip's color reflects real per-passenger state (paxExtra.ts) and opens its own small modal.
const FLAG_STATUS: Record<string, (p: Passenger) => FlagStatus> = {
  TR: trStatus,
  AUX: asvcStatus,
  COM: commentsStatus,
  FFP: ffpStatus,
  ET: etStatus,
};
const FLAG_MODAL: Record<string, FlagKind> = { TR: "tr", AUX: "aux", COM: "com", FFP: "ffp", ET: "et" };
const FLAG_CODES = ["TR", "AUX", "COM", "FFP", "ET"];
const STATUS_CLASS: Record<FlagStatus, string> = { none: "muted", ok: "ok", conflict: "danger" };

interface PaxRow {
  passenger: Passenger;
  nested: boolean;
}

// Same infant-under-guardian nesting as PassengersTab.tsx's buildRows — infants have no
// guardian_id of their own yet, approximated by pairing with the adult sharing their PNR.
function buildRows(passengers: Passenger[]): PaxRow[] {
  const infantsByLocator = new Map<string, Passenger[]>();
  for (const p of passengers) {
    if (!p.infant) continue;
    if (!infantsByLocator.has(p.record_locator)) infantsByLocator.set(p.record_locator, []);
    infantsByLocator.get(p.record_locator)!.push(p);
  }
  const nested = new Set<number>();
  const rows: PaxRow[] = [];
  for (const p of passengers) {
    if (p.infant) continue;
    const infants = (infantsByLocator.get(p.record_locator) ?? []).filter((inf) => !nested.has(inf.id));
    rows.push({ passenger: p, nested: false });
    for (const inf of infants) {
      rows.push({ passenger: inf, nested: true });
      nested.add(inf.id);
    }
  }
  for (const p of passengers) {
    if (p.infant && !nested.has(p.id)) rows.push({ passenger: p, nested: false });
  }
  return rows;
}

type QuickFilterKey = "all" | "yet" | "boarded";
type SearchMode = "seq" | "seat" | "lastname";
type FacetKey = "all" | "docs" | "services" | "inbound" | "umnr" | "inf" | "wchr" | "strc";

const FACETS: { key: FacetKey; label: string; test: (p: Passenger) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "docs", label: "Docs to verify", test: (p) => !parsePassengerExtra(p).docVerified },
  { key: "services", label: "Services to pay", test: (p) => asvcStatus(p) === "conflict" },
  { key: "inbound", label: "Inbound", test: (p) => !!parsePassengerExtra(p).inbound },
  { key: "umnr", label: "UMNR", test: (p) => (p.ssr ?? []).includes("UMNR") },
  { key: "inf", label: "INF", test: (p) => p.infant },
  { key: "wchr", label: "WCHR", test: (p) => (p.ssr ?? []).some((s) => s.startsWith("WCH")) },
  { key: "strc", label: "STRC", test: (p) => (p.ssr ?? []).includes("STRC") },
];

/**
 * Boarding/gate workstation: the passenger-selection screen for one flight
 * (reached from the sidebar's Boarding icon via /boarding-search, or a
 * flight card's Actions menu). Picking a specific passenger to actually
 * board them — the seatmap + per-passenger detail view — is a separate
 * screen not built yet; for now this list is where the agent scans a
 * boarding pass, or boards/offloads directly.
 */
export function Boarding() {
  const { flightId } = useParams();
  const fid = Number(flightId);
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `Boarding ${flight.carrier_code}${flight.flight_number}` : "Boarding");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [boardingStarted, setBoardingStarted] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [facet, setFacet] = useState<FacetKey>("all");
  const [searchMode, setSearchMode] = useState<SearchMode>("seq");
  const [searchQuery, setSearchQuery] = useState("");
  const [flagsModal, setFlagsModal] = useState<{ flag: FlagKind; passenger: Passenger } | null>(null);
  const [docPanelPassenger, setDocPanelPassenger] = useState<Passenger | null>(null);
  const docPanelTransition = useRetainedPanelTransition(docPanelPassenger);
  const { showToast } = useToast();

  const [notFound, setNotFound] = useState(false);
  function refresh() {
    api.getFlight(fid).then(setFlight).catch(() => setNotFound(true));
    api.seatmap(fid).then(setSeats);
    api.boardingList(fid).then((r) => setPassengers(r.passengers));
  }
  useEffect(refresh, [fid]);

  const seatByCode = useMemo(() => new Map(seats.map((s) => [s.seat, s])), [seats]);
  const capacity = flight ? parseVersion(flight.aircraft_version) : { C: 0, Y: 0 };
  const totalCapacity = capacity.C + capacity.Y;
  const booked = useMemo(() => {
    const b = { C: 0, Y: 0 };
    for (const p of passengers) {
      const cls = classFor(p, seatByCode);
      if (cls) b[cls]++;
    }
    return b;
  }, [passengers, seatByCode]);

  const yetToBoardCount = passengers.filter((p) => p.boarding_status !== "BOARDED").length;
  const boardedCount = passengers.filter((p) => p.boarding_status === "BOARDED").length;

  const facetFiltered = useMemo(() => {
    const test = FACETS.find((f) => f.key === facet)?.test ?? (() => true);
    return passengers.filter(test);
  }, [passengers, facet]);

  const filteredPassengers = useMemo(() => {
    return facetFiltered.filter((p) => {
      if (quickFilter === "yet" && p.boarding_status === "BOARDED") return false;
      if (quickFilter === "boarded" && p.boarding_status !== "BOARDED") return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      if (searchMode === "seq") return String(p.checkin_sequence ?? "").includes(q);
      if (searchMode === "seat") return (p.seat ?? "").toLowerCase().includes(q);
      return `${p.surname} ${p.given_name}`.toLowerCase().includes(q);
    });
  }, [facetFiltered, quickFilter, searchQuery, searchMode]);

  const rows = useMemo(() => buildRows(filteredPassengers), [filteredPassengers]);

  async function boardDirectly(p: Passenger) {
    if (!p.bcbp) return;
    try {
      await api.scanBoardingPass(p.bcbp);
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }
  async function offload(p: Passenger) {
    try {
      await api.offload(fid, p.id);
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }
  async function boardSelected() {
    for (const p of passengers) {
      if (selected.has(p.id) && p.checkin_status === "CHECKED_IN" && p.boarding_status === "NOT_BOARDED") {
        await boardDirectly(p);
      }
    }
    setSelected(new Set());
  }
  async function offloadSelected() {
    for (const p of passengers) {
      if (selected.has(p.id) && p.checkin_status === "CHECKED_IN" && p.boarding_status === "NOT_BOARDED") {
        await offload(p);
      }
    }
    setSelected(new Set());
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    try {
      const { passenger } = await api.scanBoardingPass(scanValue.trim());
      setMessage({ kind: "ok", text: `Cleared to board: ${passenger.surname}/${passenger.given_name}, seat ${passenger.seat}` });
      setScanValue("");
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  async function closeFlight() {
    if (!confirm("Close the flight? Pax checked in but not boarded will be marked NO SHOW.")) return;
    const { flight: updated, pfs } = await api.closeFlight(fid);
    setFlight(updated);
    setManifest({ label: "PFS (final list after flight close-out)", text: pfs });
    refresh();
    showToast("Flight closed");
  }
  async function showPnl() {
    setManifest({ label: "PNL (passenger name list)", text: await api.pnl(fid) });
  }
  async function showPfs() {
    setManifest({ label: "PFS (current preliminary summary)", text: await api.pfs(fid) });
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.passenger.id));
  function toggleAllSelected() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.passenger.id)));
  }

  if (notFound) return <EntityNotFound label="This flight" />;
  if (!flight) return <div className="content">Loading…</div>;
  const closed = flight.status === "CLOSED" || flight.status === "DEPARTED";

  return (
    <div className="boarding-page">
      <div className="pnr-head">
        <div className="pnr-head-id">
          <div className="pnr-flight-number">{flight.aircraft_reg ?? `${flight.carrier_code}${flight.flight_number}`}</div>
          <div className="pnr-head-id-meta">
            <span className="pnr-route">{flight.origin} → {flight.destination}</span>
            <div className="pnr-date">{fmtCardDate(flight.std)}</div>
            <div className="pnr-date">Gate {flight.gate ?? "—"}</div>
          </div>
        </div>

        <div className="pnr-stats">
          <div className="pnr-stat-col">
            <StatBar label="C" count={booked.C} total={capacity.C} />
            <StatBar label="Y" count={booked.Y} total={capacity.Y} />
          </div>
        </div>

        <div className="pnr-side">
          <button type="button" className="icon-button" data-tooltip="Scan a boarding pass" onClick={() => setScanOpen((v) => !v)}>
            <HandIcon size={20} />
          </button>
          {boardingStarted ? (
            <button type="button" className="danger boarding-start-btn" onClick={closeFlight} disabled={closed}>Close flight</button>
          ) : (
            <button type="button" className="secondary boarding-start-btn" disabled={closed} onClick={() => setBoardingStarted(true)}>Start boarding</button>
          )}
        </div>
      </div>

      {scanOpen && (
        <div className="panel">
          <form onSubmit={handleScan} className="toolbar" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>Scan boarding pass (BCBP)</label>
              <div className="input-box">
                <input
                  className="mono"
                  placeholder="Paste the boarding pass BCBP string…"
                  value={scanValue}
                  disabled={closed}
                  onChange={(e) => setScanValue(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" disabled={closed}>Scan</button>
          </form>
        </div>
      )}

      {message && <div className={message.kind === "ok" ? "ok-box" : "error-box"}>{message.text}</div>}

      <div className="panel panel--flush boarding-table-panel">
        <div className="toolbar panel-head">
          <button type="button" className={`quick-status-pill ${quickFilter === "all" ? "selected" : ""}`} onClick={() => setQuickFilter("all")}>
            All ({passengers.length})
          </button>
          <button type="button" className={`quick-status-pill ${quickFilter === "yet" ? "selected" : ""}`} onClick={() => setQuickFilter("yet")}>
            Yet to board ({yetToBoardCount})
          </button>
          <button type="button" className={`quick-status-pill ${quickFilter === "boarded" ? "selected" : ""}`} onClick={() => setQuickFilter("boarded")}>
            Boarded ({boardedCount})
          </button>
          <div className="spacer" />
          {selected.size > 0 && (
            <>
              <button type="button" className="secondary small" disabled={closed} onClick={boardSelected}>Board ({selected.size})</button>
              <button type="button" className="danger small" disabled={closed} onClick={offloadSelected}>Offload ({selected.size})</button>
            </>
          )}
          <button type="button" className="tertiary" onClick={showPnl}>PNL</button>
          <button type="button" className="tertiary" onClick={showPfs}>PFS</button>
        </div>

        <div className="toolbar panel-head">
          <div className="search-mode-bar" style={{ flex: 1 }}>
            <div className="search-mode-tabs">
              <button type="button" className={`search-mode-tab ${searchMode === "seq" ? "selected" : ""}`} onClick={() => setSearchMode("seq")}>Sq №</button>
              <button type="button" className={`search-mode-tab ${searchMode === "seat" ? "selected" : ""}`} onClick={() => setSearchMode("seat")}>Seat</button>
              <button type="button" className={`search-mode-tab ${searchMode === "lastname" ? "selected" : ""}`} onClick={() => setSearchMode("lastname")}>Last Name</button>
            </div>
            <input
              className="search-mode-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
            />
          </div>
          <div className="pax-quick-filters">
            {FACETS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`pax-quick-filter ${facet === f.key ? "selected" : ""}`}
                onClick={() => setFacet(f.key)}
              >
                {f.label} ({passengers.filter(f.test).length})
              </button>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAllSelected} />
                </th>
                <th>Name</th>
                <th>Remarks</th>
                <th>Route</th>
                <th>Class</th>
                <th>PNR</th>
                <th>Gender</th>
                <th>Status</th>
                <th>Docs</th>
                <th>Baggage</th>
                <th>Seat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ passenger: p, nested }) => {
                const ssr = p.ssr ?? [];
                const extra = parsePassengerExtra(p);
                const cls = classFor(p, seatByCode);
                return (
                  <tr key={p.id} className={`clickable ${selected.has(p.id) ? "pax-row-active" : ""}`} onClick={() => navigate(`/boarding/${fid}/pax/${p.id}`)}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      <div className="pax-name-cell">
                        {nested && <ArrowNestedIcon size={14} className="pax-nest-arrow" />}
                        {nested && <InfantIcon size={14} className="pax-infant-icon" />}
                        {!nested && extra.type === "CHD" && <ChildIcon size={14} className="pax-child-icon" />}
                        <span className="link-text" onClick={(e) => { e.stopPropagation(); setDocPanelPassenger(p); }}>{p.surname} {p.given_name}</span>
                      </div>
                      <div className="board-flags" onClick={(e) => e.stopPropagation()}>
                        {FLAG_CODES.map((code) => (
                          <span
                            key={code}
                            className={`board-flag-chip ${STATUS_CLASS[FLAG_STATUS[code](p)]}`}
                            onClick={() => setFlagsModal({ flag: FLAG_MODAL[code], passenger: p })}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {ssr.length > 0 && (
                        <span className="pax-service-chips">
                          {ssr.slice(0, 2).map((code) => (
                            <span key={code} className="chip small muted mono">{code}</span>
                          ))}
                          {ssr.length > 2 && (
                            <span className="chip small muted" title={ssr.join(", ")}>+{ssr.length - 2}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="mono">{flight.origin}-{flight.destination}</td>
                    <td>{cls ?? "—"}</td>
                    <td className="mono">{p.record_locator}</td>
                    <td>{p.gender ?? "—"}</td>
                    <td><span className={`chip middle ${statusChipClass(p)}`}>{statusLabel(p)}</span></td>
                    <td>
                      <span className="pnr-doc-icons">
                        <span title="Documents verified against the booking">
                          <DocVerifiedIcon size={16} className={extra.docVerified ? "pnr-doc-icon-on" : "pnr-doc-icon-off"} />
                        </span>
                        <span title="Documents scanned">
                          <DocScannedIcon size={16} className={extra.docScanned ? "pnr-doc-icon-on" : "pnr-doc-icon-off"} />
                        </span>
                      </span>
                    </td>
                    <td className="mono">
                      {p.bag_count > 0 && <span>{p.bag_count}/{p.bag_weight_kg}</span>}
                      {extra.cabinBagCount ? <span className="pnr-cabin-bag"> {extra.cabinBagCount}/{extra.cabinBagWeight ?? 0}</span> : null}
                    </td>
                    <td>{p.seat && <span className="mono chip middle muted seat-chip">{p.seat}</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={11} style={{ color: "var(--muted)" }}>No pax match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manifest && (
        <div className="panel">
          <div className="manifest-head">
            <h3>{manifest.label}</h3>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setManifest(null)}>
              <CloseIcon size={16} />
            </button>
          </div>
          <pre className="manifest">{manifest.text}</pre>
        </div>
      )}

      {flagsModal && (
        <FlagModal
          kind={flagsModal.flag}
          flightId={fid}
          passenger={flagsModal.passenger}
          onClose={() => setFlagsModal(null)}
          onUpdated={(updated) => {
            setPassengers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setFlagsModal((prev) => (prev && prev.passenger.id === updated.id ? { ...prev, passenger: updated } : prev));
          }}
        />
      )}

      {docPanelTransition.mounted && docPanelTransition.retained && (
        <PassengerDocPanel
          flightId={fid}
          passenger={docPanelTransition.retained}
          open={docPanelTransition.entered}
          onClose={() => setDocPanelPassenger(null)}
          onUpdated={(updated) => setPassengers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
        />
      )}
    </div>
  );
}
