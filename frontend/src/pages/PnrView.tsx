import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import { formatSeatDisplay } from "../seatExtra";
import { parsePassengerExtra } from "../paxExtra";
import { DocScannedIcon, DocVerifiedIcon, SearchIcon } from "../components/Icon";
import { useRegisterTab } from "../tabs";
import { usePopoverPosition } from "../usePopoverPosition";

// Last-fetched flight/passengers per flight, kept outside component state so
// it survives this component unmounting when the agent switches to another
// tab and back (see the comment in PnrView for why that matters).
const flightCache = new Map<number, Flight>();
const passengersCache = new Map<number, Passenger[]>();
// Passengers pulled in via "Add pax", keyed by the PNR view's own passenger
// id (each opened PNR tab has its own) — otherwise they'd vanish the moment
// the tab remounts, same underlying issue as the flight/passengers caches.
const extraPassengersCache = new Map<number, Passenger[]>();

// Same fixed windows (relative to std) FlightCardHeader uses for its phase chips.
const CHECKIN_FROM_MIN = -180;
const BOARDING_FROM_MIN = -45;
const BOARDING_TO_MIN = -15;

function fmtOffsetTime(std: string, min: number): string {
  const t = new Date(new Date(std).getTime() + min * 60000);
  return t.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
}

function fmtCardDate(std: string): string {
  const d = new Date(std);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} · ${time}`;
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

// "C18Y162" -> { C: 18, Y: 162 }; a config the aircraft doesn't advertise a
// class for (or an unparseable string) reads as 0 rather than throwing.
function parseVersion(version: string | null): { C: number; Y: number } {
  if (!version) return { C: 0, Y: 0 };
  const c = /C(\d+)/.exec(version);
  const y = /Y(\d+)/.exec(version);
  return { C: c ? +c[1] : 0, Y: y ? +y[1] : 0 };
}

interface StatBarProps {
  label: string;
  count: number;
  total: number;
}
function StatBar({ label, count, total }: StatBarProps) {
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

interface AddPaxButtonProps {
  flightId: number;
  excludeIds: Set<number>;
  onAdd: (p: Passenger) => void;
}

/**
 * "Add pax" opens a search popover so the agent can pull in passengers
 * from a different PNR on the same flight — the case where several
 * parties reach the desk together and get checked in as one batch.
 */
function AddPaxButton({ flightId, excludeIds, onAdd }: AddPaxButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Passenger[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const rect = usePopoverPosition(btnRef, open);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api.passengers(flightId, query.trim()).then((found) => {
        if (!cancelled) setResults(found);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query, flightId]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shown = results.filter((p) => !excludeIds.has(p.id));

  return (
    <>
      <button type="button" className="secondary" ref={btnRef} onClick={() => setOpen((o) => !o)}>
        Add pax
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            className="pnr-add-pax-popover"
            style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 300) }}
          >
            <div className="input-box">
              <SearchIcon size={16} />
              <input
                autoFocus
                placeholder="Last name or PNR"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {query.trim() && (
              <ul className="pnr-add-pax-results">
                {shown.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => {
                      onAdd(p);
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <span>{p.surname} {p.given_name}</span>
                    <span className="mono">{p.record_locator}</span>
                  </li>
                ))}
                {shown.length === 0 && <li className="pnr-add-pax-empty">No matches</li>}
              </ul>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Opens in its own tab when an agent clicks a passenger from a search
 * match — everyone sharing that passenger's PNR, so the whole party can be
 * checked in together. Action buttons (Add passengers/Check-in/Actions) are
 * placeholders for now; only the roster itself is wired up.
 */
export function PnrView() {
  const { flightId, passengerId } = useParams();
  const fid = Number(flightId);
  const pid = Number(passengerId);

  // Re-visiting a tab that's already open remounts this component from
  // scratch (React Router only keeps the matched route mounted), which
  // would otherwise reset the tab label to "PNR" and back on every switch —
  // a visible width jump in the tab strip. Seeding state from what was
  // last fetched for this flight keeps the label (and the page) stable
  // while a fresh copy loads quietly in the background.
  const [flight, setFlight] = useState<Flight | null>(() => flightCache.get(fid) ?? null);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>(() => passengersCache.get(fid) ?? []);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const [extraPassengers, setExtraPassengers] = useState<Passenger[]>(() => extraPassengersCache.get(pid) ?? []);

  useEffect(() => {
    api.getFlight(fid).then((f) => {
      flightCache.set(fid, f);
      setFlight(f);
    });
    api.seatmap(fid).then(setSeats);
    api.passengers(fid).then((ps) => {
      passengersCache.set(fid, ps);
      setPassengers(ps);
    });
  }, [fid]);

  const clicked = passengers.find((p) => p.id === pid);
  useRegisterTab(
    flight && clicked ? `${flight.carrier_code}${flight.flight_number}/${clicked.id} ${clicked.surname.toUpperCase()}` : "PNR"
  );

  if (!flight || !clicked) return <div className="content">Loading…</div>;

  const seatByCode = new Map(seats.map((s) => [s.seat, s]));
  const pnrPassengers = passengers.filter((p) => p.record_locator === clicked.record_locator);
  const pnrIds = new Set(pnrPassengers.map((p) => p.id));
  const rosterPassengers = [...pnrPassengers, ...extraPassengers.filter((p) => !pnrIds.has(p.id))];
  const rosterIds = new Set(rosterPassengers.map((p) => p.id));

  const capacity = parseVersion(flight.aircraft_version);
  const totalCapacity = capacity.C + capacity.Y;
  const booked = { C: 0, Y: 0 };
  const checkedIn = { C: 0, Y: 0 };
  for (const p of passengers) {
    const cls = classFor(p, seatByCode);
    if (!cls) continue;
    booked[cls]++;
    if (p.checkin_status === "CHECKED_IN") checkedIn[cls]++;
  }
  const reseatCount = passengers.filter((p) => parsePassengerExtra(p).wl).length;
  const priorityCount = passengers.filter((p) => parsePassengerExtra(p).pl).length;

  function toggleChecked(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked = rosterPassengers.length > 0 && rosterPassengers.every((p) => checked.has(p.id));
  const someChecked = rosterPassengers.some((p) => checked.has(p.id));
  function toggleAllChecked() {
    setChecked(allChecked ? new Set() : new Set(rosterPassengers.map((p) => p.id)));
  }

  return (
    <div className="pnr-view">
      <div className="pnr-head">
        <div className="pnr-head-id">
          <div className="pnr-flight-number">{flight.carrier_code}{flight.flight_number}</div>
          <div className="pnr-route">{flight.origin} → {flight.destination}</div>
          <div className="pnr-date">{fmtCardDate(flight.std)}</div>
        </div>

        <div className="pnr-stats">
          <div className="pnr-stat-col">
            <div className="pnr-stat-col-title">Version</div>
            <StatBar label="C" count={capacity.C} total={totalCapacity} />
            <StatBar label="Y" count={capacity.Y} total={totalCapacity} />
          </div>
          <div className="pnr-stat-col">
            <div className="pnr-stat-col-title">Booked</div>
            <StatBar label="C" count={booked.C} total={capacity.C} />
            <StatBar label="Y" count={booked.Y} total={capacity.Y} />
          </div>
          <div className="pnr-stat-col">
            <div className="pnr-stat-col-title">Checked</div>
            <StatBar label="C" count={checkedIn.C} total={booked.C} />
            <StatBar label="Y" count={checkedIn.Y} total={booked.Y} />
          </div>
        </div>

        <div className="pnr-side">
          <div className="pnr-chips">
            <button type="button" className="tertiary">RESEAT: {reseatCount}</button>
            <button type="button" className="tertiary">PRIORITY: {priorityCount}</button>
          </div>
          <div className="pnr-gate">
            <span className="pnr-gate-num">{flight.gate ?? "—"}</span>
            <span className="pnr-gate-label">Gate</span>
          </div>
          <div className="pnr-times">
            <div>CH-IN {fmtOffsetTime(flight.std, CHECKIN_FROM_MIN)}</div>
            <div>BOARD {fmtOffsetTime(flight.std, BOARDING_FROM_MIN)}–{fmtOffsetTime(flight.std, BOARDING_TO_MIN)}</div>
          </div>
        </div>
      </div>

      <div className="pnr-actions">
        <AddPaxButton
          flightId={fid}
          excludeIds={rosterIds}
          onAdd={(p) => {
            setExtraPassengers((prev) => {
              if (prev.some((x) => x.id === p.id)) return prev;
              const next = [...prev, p];
              extraPassengersCache.set(pid, next);
              return next;
            });
          }}
        />
        <div className="spacer" />
        <button type="button" className="secondary" disabled={checked.size === 0}>Check-in</button>
        <button type="button" className="secondary" disabled={checked.size === 0}>Actions</button>
      </div>

      <div className="panel panel--flush">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={toggleAllChecked}
                  />
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
              {rosterPassengers.map((p) => {
                const ssr = p.ssr ?? [];
                const extra = parsePassengerExtra(p);
                const cls = classFor(p, seatByCode);
                return (
                  <tr key={p.id} className={`clickable ${checked.has(p.id) ? "pax-row-active" : ""}`} onClick={() => toggleChecked(p.id)}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked.has(p.id)}
                        onChange={() => toggleChecked(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="link-text">{p.surname} {p.given_name}</td>
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
                    <td>{p.seat && <span className="mono chip middle muted seat-chip">{formatSeatDisplay(p.seat)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
