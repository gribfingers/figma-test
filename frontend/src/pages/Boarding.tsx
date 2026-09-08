import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import {
  ArrowNestedIcon,
  ChildIcon,
  CloseIcon,
  DocVerifiedIcon,
  HandIcon,
  InfantIcon,
} from "../components/Icon";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { useConfirmDialog } from "../confirmDialog";
import { useLanguage } from "../i18n";
import { FlagKind, FlagModal } from "../components/flightcard/PassengerModals";
import { PassengerDocPanel } from "../components/PassengerDocPanel";
import { useRetainedPanelTransition } from "../usePanelMounted";
import { EntityNotFound } from "../components/EntityNotFound";
import {
  FlagStatus,
  asvcStatus,
  classFor,
  commentsStatus,
  etStatus,
  ffpStatus,
  parsePassengerExtra,
  trStatus,
} from "../paxExtra";
import { useCanEdit } from "../auth";
import { isFlightDeparted } from "../flightPhase";
import { useHotkey } from "../useShortcuts";
import { useShortcutTitle, ShortcutBadge } from "../shortcutHints";
import { trackEvent } from "../analytics";
import { clickable } from "../interactive";

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

function statusLabel(p: Passenger): string {
  if (p.boarding_status === "BOARDED") return "Boarded";
  if (p.boarding_status === "OFFLOADED") return "Offloaded";
  if (p.checkin_status === "CHECKED_IN") {
    if (asvcStatus(p) === "conflict") return "Not paid";
    return "Checked-in";
  }
  return "Not checked-in";
}
function statusChipClass(p: Passenger): string {
  if (p.boarding_status === "OFFLOADED") return "danger";
  if (p.boarding_status === "BOARDED") return "ok";
  if (p.checkin_status === "CHECKED_IN") return asvcStatus(p) === "conflict" ? "danger" : "ok";
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

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "yet", label: "Yet to board" },
  { key: "boarded", label: "Boarded" },
];

const SEARCH_MODES: { key: SearchMode; label: string }[] = [
  { key: "seq", label: "Sq №" },
  { key: "seat", label: "Seat" },
  { key: "lastname", label: "Last Name" },
];

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
  const { t } = useLanguage();
  const { flightId } = useParams();
  const fid = Number(flightId);
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `Boarding ${flight.carrier_code}${flight.flight_number}` : "Boarding");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [facet, setFacet] = useState<FacetKey>("all");
  const [searchMode, setSearchMode] = useState<SearchMode>("seq");
  const [searchQuery, setSearchQuery] = useState("");
  const [flagsModal, setFlagsModal] = useState<{ flag: FlagKind; passenger: Passenger } | null>(null);
  const [docPanelPassenger, setDocPanelPassenger] = useState<Passenger | null>(null);
  const docPanelTransition = useRetainedPanelTransition(docPanelPassenger);
  const { showToast } = useToast();
  const { confirmDialog } = useConfirmDialog();
  const canEdit = useCanEdit();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkey("nav.search-focus", () => searchInputRef.current?.focus());
  const searchFocusTitle = useShortcutTitle("nav.search-focus");

  // Hand icon / Start boarding / PNL / PFS are plain <button>s reached today only via their own
  // hotkey (see the useHotkey calls below) — Tab actually landing on any of them depends on a
  // browser/OS setting (Safari's Full Keyboard Access) outside this app's control. These refs let
  // the toolbar chain arrow-key focus through them too, same reasoning as BaggageStep's row chain,
  // so a keyboard-only agent who doesn't know the Alt-combos can still reach every control by arrowing
  // down from the top of the page (or up from the search field) instead of only by mouse. Gated on
  // Alt (Alt+ArrowUp/Down, not bare) because bare ArrowUp/Down are already boarding.row-up/row-down —
  // a *global* hotkey that moves the row cursor "independent of where Tab happens to be" (see those
  // useHotkey calls below) and would otherwise fire on the very same keypress and move two things
  // at once.
  const handIconRef = useRef<HTMLButtonElement>(null);
  const startCloseRef = useRef<HTMLButtonElement>(null);
  const pnlRef = useRef<HTMLButtonElement>(null);
  const pfsRef = useRef<HTMLButtonElement>(null);
  function focusQuickFilter() {
    quickFilterRefs.current.get(quickFilter)?.focus();
  }

  // Roving tabindex over the quick-status pills / facet pills / search-mode tabs — same one-Tab-
  // stop-plus-arrow-keys pattern as Search.tsx's own PAX_QUICK_FILTERS and SEARCH_MODES bars.
  const quickFilterRefs = useRef(new Map<QuickFilterKey, HTMLButtonElement>());
  function moveQuickFilter(delta: 1 | -1) {
    const idx = QUICK_FILTERS.findIndex((f) => f.key === quickFilter);
    const next = QUICK_FILTERS[(idx + delta + QUICK_FILTERS.length) % QUICK_FILTERS.length];
    setQuickFilter(next.key);
    quickFilterRefs.current.get(next.key)?.focus();
  }
  const facetRefs = useRef(new Map<FacetKey, HTMLButtonElement>());
  function moveFacet(delta: 1 | -1) {
    const idx = FACETS.findIndex((f) => f.key === facet);
    const next = FACETS[(idx + delta + FACETS.length) % FACETS.length];
    setFacet(next.key);
    facetRefs.current.get(next.key)?.focus();
  }
  const searchModeRefs = useRef(new Map<SearchMode, HTMLButtonElement>());
  function moveSearchMode(delta: 1 | -1) {
    const idx = SEARCH_MODES.findIndex((m) => m.key === searchMode);
    const next = SEARCH_MODES[(idx + delta + SEARCH_MODES.length) % SEARCH_MODES.length];
    setSearchMode(next.key);
    searchModeRefs.current.get(next.key)?.focus();
  }

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

  // A keyboard-focused row (see boarding.row-* shortcuts) only means something for the currently
  // visible rows — drop it whenever the filter/search narrows or reorders the list.
  useEffect(() => setFocusedIndex(-1), [facet, quickFilter, searchQuery, searchMode]);

  async function boardDirectly(p: Passenger) {
    if (!canEdit || !p.bcbp) return;
    try {
      await api.scanBoardingPass(p.bcbp);
      trackEvent("action", "boarding.board");
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }
  async function offload(p: Passenger) {
    if (!canEdit) return;
    try {
      await api.offload(fid, p.id);
      trackEvent("action", "boarding.offload");
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
    if (!canEdit || !scanValue.trim()) return;
    try {
      const { passenger } = await api.scanBoardingPass(scanValue.trim());
      setMessage({ kind: "ok", text: t("Cleared to board: {surname}/{name}, seat {seat}").replace("{surname}", passenger.surname).replace("{name}", passenger.given_name).replace("{seat}", String(passenger.seat)) });
      setScanValue("");
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  async function startBoarding() {
    if (!canEdit) return;
    const updated = await api.startBoarding(fid);
    setFlight(updated);
    showToast(t("Boarding started"));
  }
  async function closeFlight() {
    if (!canEdit) return;
    if (!(await confirmDialog(t("Close the flight? Pax checked in but not boarded will be marked NO SHOW."), { danger: true }))) return;
    const { flight: updated, pfs } = await api.closeFlight(fid);
    setFlight(updated);
    setManifest({ label: t("PFS (final list after flight close-out)"), text: pfs });
    refresh();
    showToast(t("Flight closed"));
  }
  async function showPnl() {
    setManifest({ label: t("PNL (passenger name list)"), text: await api.pnl(fid) });
  }
  async function showPfs() {
    setManifest({ label: t("PFS (current preliminary summary)"), text: await api.pfs(fid) });
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

  // isFlightDeparted catches a flight that's actually past its std but whose status an agent never
  // manually advanced to CLOSED/DEPARTED — see its own doc comment (flightPhase.ts) for why that's
  // possible. Without it Board/Offload/Start-close stayed enabled on such a flight, and the backend's
  // rejection only surfaced after the fact instead of the button being disabled up front.
  const closed = flight?.status === "CLOSED" || flight?.status === "DEPARTED" || (!!flight && isFlightDeparted(flight, new Date()));
  // Boarding can only actually happen once the gate agent has opened it (Start boarding) — matches
  // the backend's own /scan check, which now rejects a scan on any flight_status other than BOARDING.
  const boardingNotOpen = flight?.status !== "BOARDING";

  // Row navigation — see UserPanel's Keyboard shortcuts section for rebinding these.
  useHotkey("boarding.row-up", () => setFocusedIndex((i) => (i <= 0 ? 0 : i - 1)), rows.length > 0);
  useHotkey("boarding.row-down", () => setFocusedIndex((i) => (i < 0 ? 0 : Math.min(rows.length - 1, i + 1))), rows.length > 0);
  useHotkey(
    "boarding.row-open",
    () => {
      const row = rows[focusedIndex];
      if (row) navigate(`/boarding/${fid}/pax/${row.passenger.id}`);
    },
    focusedIndex >= 0 && focusedIndex < rows.length
  );
  useHotkey(
    "boarding.row-toggle",
    () => {
      const row = rows[focusedIndex];
      if (row) toggleSelected(row.passenger.id);
    },
    canEdit && focusedIndex >= 0 && focusedIndex < rows.length
  );
  useHotkey("boarding.select-all", toggleAllSelected, canEdit && rows.length > 0);
  useHotkey("boarding.scan", () => setScanOpen((v) => !v), canEdit);
  useHotkey("boarding.board", boardSelected, canEdit && selected.size > 0 && !closed && !boardingNotOpen);
  useHotkey("boarding.offload", offloadSelected, canEdit && selected.size > 0 && !closed);
  // Also focuses the pill, not just sets the filter — otherwise the hotkey fires the action but
  // leaves keyboard focus wherever it already was, same gap the toolbar chain below fixes for
  // Tab/Arrow-only navigation without a memorized combo.
  useHotkey("boarding.filter-all", () => { setQuickFilter("all"); quickFilterRefs.current.get("all")?.focus(); });
  useHotkey("boarding.filter-yet", () => { setQuickFilter("yet"); quickFilterRefs.current.get("yet")?.focus(); });
  useHotkey("boarding.filter-boarded", () => { setQuickFilter("boarded"); quickFilterRefs.current.get("boarded")?.focus(); });
  useHotkey("boarding.start", () => (flight?.status === "BOARDING" ? closeFlight() : startBoarding()), canEdit && !closed);
  useHotkey("boarding.pnl", showPnl);
  useHotkey("boarding.pfs", showPfs);
  const selectAllTitle = useShortcutTitle("boarding.select-all");
  const scanTitle = useShortcutTitle("boarding.scan", t("Scan a boarding pass"));
  const boardTitle = useShortcutTitle("boarding.board", t("Board"));
  const offloadTitle = useShortcutTitle("boarding.offload", t("Offload"));
  const filterAllTitle = useShortcutTitle("boarding.filter-all", t("All"));
  const filterYetTitle = useShortcutTitle("boarding.filter-yet", t("Yet to board"));
  const filterBoardedTitle = useShortcutTitle("boarding.filter-boarded", t("Boarded"));
  const startCloseTitle = useShortcutTitle("boarding.start", flight?.status === "BOARDING" ? t("Close flight") : t("Start boarding"));
  const pnlTitle = useShortcutTitle("boarding.pnl", "PNL");
  const pfsTitle = useShortcutTitle("boarding.pfs", "PFS");

  if (notFound) return <EntityNotFound label={t("This flight")} />;
  if (!flight) return <div className="content">{t("Loading…")}</div>;

  return (
    <div className="boarding-page">
      <div className="pnr-head">
        <div className="pnr-head-id">
          <div className="pnr-flight-number">{flight.aircraft_reg ?? `${flight.carrier_code}${flight.flight_number}`}</div>
          <div className="pnr-head-id-meta">
            <span className="pnr-route">{flight.origin} → {flight.destination}</span>
            <div className="pnr-date">{fmtCardDate(flight.std)}</div>
            <div className="pnr-date">{t("Gate {gate}").replace("{gate}", flight.gate ?? "—")}</div>
          </div>
        </div>

        <div className="pnr-stats">
          <div className="pnr-stat-col">
            <StatBar label="C" count={booked.C} total={capacity.C} />
            <StatBar label="Y" count={booked.Y} total={capacity.Y} />
          </div>
        </div>

        <div className="pnr-side">
          {canEdit && (
            <button
              ref={handIconRef}
              type="button"
              className="icon-button"
              title={scanTitle}
              onClick={() => setScanOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); startCloseRef.current?.focus(); }
                else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); focusQuickFilter(); }
              }}
            >
              <HandIcon size={20} />
            </button>
          )}
          {canEdit && (
            flight.status === "BOARDING" ? (
              <button
                ref={startCloseRef}
                type="button"
                className="danger boarding-start-btn shortcut-hint-host"
                title={closed ? undefined : startCloseTitle}
                onClick={closeFlight}
                disabled={closed}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") { e.preventDefault(); handIconRef.current?.focus(); }
                  else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); focusQuickFilter(); }
                }}
              >
                {!closed && <ShortcutBadge id="boarding.start" />}
                {t("Close flight")}
              </button>
            ) : (
              <button
                ref={startCloseRef}
                type="button"
                className="secondary boarding-start-btn shortcut-hint-host"
                disabled={closed}
                title={closed ? undefined : startCloseTitle}
                onClick={startBoarding}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") { e.preventDefault(); handIconRef.current?.focus(); }
                  else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); focusQuickFilter(); }
                }}
              >
                {!closed && <ShortcutBadge id="boarding.start" />}
                {t("Start boarding")}
              </button>
            )
          )}
        </div>
      </div>

      {scanOpen && canEdit && (
        <div className="panel">
          <form onSubmit={handleScan} className="toolbar" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>{t("Scan boarding pass (BCBP)")}</label>
              <div className="input-box">
                <input
                  className="mono"
                  placeholder={t("Paste the boarding pass BCBP string…")}
                  value={scanValue}
                  disabled={closed}
                  onChange={(e) => setScanValue(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" disabled={closed}>{t("Scan")}</button>
          </form>
        </div>
      )}

      {message && <div className={message.kind === "ok" ? "ok-box" : "error-box"}>{message.text}</div>}

      <div className="panel panel--flush boarding-table-panel">
        <div className="toolbar panel-head">
          <div className="quick-status-pills" role="tablist" aria-label={t("Status filter")}>
            {QUICK_FILTERS.map((f) => {
              const count = f.key === "all" ? passengers.length : f.key === "yet" ? yetToBoardCount : boardedCount;
              const title = f.key === "all" ? filterAllTitle : f.key === "yet" ? filterYetTitle : filterBoardedTitle;
              return (
                <button
                  key={f.key}
                  ref={(el) => {
                    if (el) quickFilterRefs.current.set(f.key, el);
                    else quickFilterRefs.current.delete(f.key);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={quickFilter === f.key}
                  tabIndex={quickFilter === f.key ? 0 : -1}
                  className={`quick-status-pill ${quickFilter === f.key ? "selected" : ""}`}
                  title={title}
                  onClick={() => setQuickFilter(f.key)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); moveQuickFilter(1); }
                    else if (e.key === "ArrowLeft") { e.preventDefault(); moveQuickFilter(-1); }
                    else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); (startCloseRef.current ?? handIconRef.current)?.focus(); }
                    else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); pnlRef.current?.focus(); }
                  }}
                >
                  {t(f.label)} ({count})
                </button>
              );
            })}
          </div>
          <div className="spacer" />
          {canEdit && selected.size > 0 && (
            <>
              <button type="button" className="secondary small" disabled={closed || boardingNotOpen} title={closed || boardingNotOpen ? undefined : boardTitle} onClick={boardSelected}>{t("Board")} ({selected.size})</button>
              <button type="button" className="danger small" disabled={closed} title={closed ? undefined : offloadTitle} onClick={offloadSelected}>{t("Offload")} ({selected.size})</button>
            </>
          )}
          <button
            ref={pnlRef}
            type="button"
            className="tertiary shortcut-hint-host"
            title={pnlTitle}
            onClick={showPnl}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); pfsRef.current?.focus(); }
              else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); focusQuickFilter(); }
              else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); searchModeRefs.current.get(searchMode)?.focus(); }
            }}
          >
            <ShortcutBadge id="boarding.pnl" />
            PNL
          </button>
          <button
            ref={pfsRef}
            type="button"
            className="tertiary shortcut-hint-host"
            title={pfsTitle}
            onClick={showPfs}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") { e.preventDefault(); pnlRef.current?.focus(); }
              else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); focusQuickFilter(); }
              else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); searchModeRefs.current.get(searchMode)?.focus(); }
            }}
          >
            <ShortcutBadge id="boarding.pfs" />
            PFS
          </button>
        </div>

        <div className="toolbar panel-head">
          <div className="search-mode-bar" style={{ flex: 1 }}>
            <div className="search-mode-tabs" role="tablist" aria-label={t("Search by")}>
              {SEARCH_MODES.map((m) => (
                <button
                  key={m.key}
                  ref={(el) => {
                    if (el) searchModeRefs.current.set(m.key, el);
                    else searchModeRefs.current.delete(m.key);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={searchMode === m.key}
                  tabIndex={searchMode === m.key ? 0 : -1}
                  className={`search-mode-tab ${searchMode === m.key ? "selected" : ""}`}
                  onClick={() => setSearchMode(m.key)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); moveSearchMode(1); }
                    else if (e.key === "ArrowLeft") { e.preventDefault(); moveSearchMode(-1); }
                    else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); pnlRef.current?.focus(); }
                    else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); searchInputRef.current?.focus(); }
                  }}
                >
                  {t(m.label)}
                </button>
              ))}
            </div>
            <input
              ref={searchInputRef}
              className="search-mode-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search")}
              title={searchFocusTitle}
              onKeyDown={(e) => {
                // Alt+ArrowUp/Down, not bare — bare Left/Right already move the text cursor within
                // this input, and bare Up/Down are boarding.row-up/row-down (a global hotkey that
                // moves the row cursor regardless of focus, see the note above searchInputRef's
                // declaration). Reaches the rest of the toolbar's <button>-based zones the same way
                // BaggageStep's Weight field reaches its row's Select triggers.
                if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); searchModeRefs.current.get(searchMode)?.focus(); }
                else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); facetRefs.current.get(facet)?.focus(); }
              }}
            />
          </div>
          <div className="pax-quick-filters" role="tablist" aria-label={t("Facet filter")}>
            {FACETS.map((f) => (
              <button
                key={f.key}
                ref={(el) => {
                  if (el) facetRefs.current.set(f.key, el);
                  else facetRefs.current.delete(f.key);
                }}
                type="button"
                role="tab"
                aria-selected={facet === f.key}
                tabIndex={facet === f.key ? 0 : -1}
                className={`pax-quick-filter ${facet === f.key ? "selected" : ""}`}
                onClick={() => setFacet(f.key)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") { e.preventDefault(); moveFacet(1); }
                  else if (e.key === "ArrowLeft") { e.preventDefault(); moveFacet(-1); }
                  else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); searchInputRef.current?.focus(); }
                }}
              >
                {t(f.label)} ({passengers.filter(f.test).length})
              </button>
            ))}
          </div>
        </div>

        {/* tabIndex=-1: opt out of Chrome/Safari's automatic Tab-stop for scrollable regions — see
            the same note in PnrView.tsx's roster table. */}
        <div className="table-scroll" tabIndex={-1}>
          <table>
            <thead>
              <tr>
                <th>
                  {canEdit && <input type="checkbox" checked={allSelected} title={selectAllTitle} onChange={toggleAllSelected} />}
                </th>
                <th>{t("Name")}</th>
                <th>{t("Remarks")}</th>
                <th>{t("Route")}</th>
                <th>{t("Class")}</th>
                <th>PNR</th>
                <th>{t("Gender")}</th>
                <th>{t("Status")}</th>
                <th>{t("Docs")}</th>
                <th>{t("Baggage")}</th>
                <th>{t("Seat")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ passenger: p, nested }, idx) => {
                const ssr = p.ssr ?? [];
                const extra = parsePassengerExtra(p);
                const cls = classFor(p, seatByCode);
                return (
                  // Not made a real Tab-stop (no clickable() here) — this row already has its own
                  // complete keyboard scheme (boarding.row-up/row-down/row-open/row-toggle, a
                  // focusedIndex cursor independent of DOM focus, see the useHotkey calls above).
                  // Layering real per-row Tab/Enter on top would double-fire Enter (both handlers
                  // would navigate) without adding any reach Tab doesn't already have via the
                  // now-keyboard-operable name/flag cells below.
                  <tr
                    key={p.id}
                    className={`clickable ${selected.has(p.id) ? "pax-row-active" : ""} ${idx === focusedIndex ? "pax-row-focused" : ""}`}
                    onClick={() => navigate(`/boarding/${fid}/pax/${p.id}`)}
                  >
                    <td>
                      {canEdit && (
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </td>
                    <td>
                      <div className="pax-name-cell">
                        {nested && <ArrowNestedIcon size={14} className="pax-nest-arrow" />}
                        {nested && <InfantIcon size={14} className="pax-infant-icon" />}
                        {!nested && extra.type === "CHD" && <ChildIcon size={14} className="pax-child-icon" />}
                        <span
                          className="link-text"
                          onClick={(e) => { e.stopPropagation(); setDocPanelPassenger(p); }}
                          {...clickable(() => setDocPanelPassenger(p))}
                        >
                          {p.surname} {p.given_name}
                        </span>
                      </div>
                      <div className="board-flags" onClick={(e) => e.stopPropagation()}>
                        {FLAG_CODES.map((code) => {
                          const openFlag = () => setFlagsModal({ flag: FLAG_MODAL[code], passenger: p });
                          return (
                            <span
                              key={code}
                              className={`board-flag-chip ${STATUS_CLASS[FLAG_STATUS[code](p)]}`}
                              onClick={openFlag}
                              {...clickable(openFlag)}
                            >
                              {code}
                            </span>
                          );
                        })}
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
                    <td><span className={`chip middle ${statusChipClass(p)}`}>{t(statusLabel(p))}</span></td>
                    <td>
                      <span className="pnr-doc-icons">
                        <span title={t("Documents verified against the booking")}>
                          <DocVerifiedIcon size={16} className={extra.docVerified ? "pnr-doc-icon-on" : "pnr-doc-icon-off"} />
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
                <tr><td colSpan={11} style={{ color: "var(--muted)" }}>{t("No pax match.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manifest && (
        <div className="panel">
          <div className="manifest-head">
            <h3>{manifest.label}</h3>
            <button type="button" className="icon-button" aria-label={t("Close")} onClick={() => setManifest(null)}>
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
          readOnly={!canEdit}
        />
      )}

      {docPanelTransition.mounted && docPanelTransition.retained && (
        <PassengerDocPanel
          flightId={fid}
          passenger={docPanelTransition.retained}
          open={docPanelTransition.entered}
          onClose={() => setDocPanelPassenger(null)}
          onUpdated={(updated) => setPassengers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}
