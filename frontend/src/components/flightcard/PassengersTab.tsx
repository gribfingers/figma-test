import { useEffect, useState } from "react";
import { api, Flight, Passenger, SeatCell } from "../../api";
import { SeatMapGrid } from "../SeatMapGrid";
import { ArrowNestedIcon, InfantIcon, SearchIcon } from "../Icon";
import { SortTh, useSort } from "../SortTh";
import { PassengerModals } from "./PassengerModals";

interface Props {
  flight: Flight;
}

interface PaxRow {
  passenger: Passenger;
  nested: boolean;
  hasInfant: boolean;
}

// Infants have no guardian_id field of their own yet — approximated by
// pairing an infant with the non-infant passenger sharing their PNR
// (record_locator), which is how the seed data models it. Falls back to a
// flat, unnested row for an infant with no such match.
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
    const infants = infantsByLocator.get(p.record_locator) ?? [];
    rows.push({ passenger: p, nested: false, hasInfant: infants.length > 0 });
    for (const inf of infants) {
      rows.push({ passenger: inf, nested: true, hasInfant: false });
      nested.add(inf.id);
    }
  }
  for (const p of passengers) {
    if (p.infant && !nested.has(p.id)) rows.push({ passenger: p, nested: false, hasInfant: false });
  }
  return rows;
}

function statusLabel(p: Passenger): string {
  if (p.boarding_status === "BOARDED") return "Boarded";
  if (p.boarding_status === "OFFLOADED") return "Offloaded";
  if (p.checkin_status === "CHECKED_IN") return "Checked-in";
  return "—";
}
function statusChip(p: Passenger) {
  const label = statusLabel(p);
  if (label === "—") return "—";
  return <span className={`chip middle ${label === "Offloaded" ? "danger" : "ok"}`}>{label}</span>;
}

function ageYears(dob: string | null): number {
  if (!dob) return -1;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
function ageFromDob(dob: string | null): string {
  const age = ageYears(dob);
  return age < 0 ? "—" : String(age);
}

function classFor(p: Passenger, seatByCode: Map<string, SeatCell>): string {
  const seat = p.seat ? seatByCode.get(p.seat) : undefined;
  return seat ? (seat.cabin_class === "J" ? "C" : "Y") : "—";
}

type PaxSortKey = "name" | "seat" | "class" | "status" | "bag" | "age" | "gender";

// TR/AUX/COM/FFP/ET are per-passenger flags with no backing fields yet
// (transfer, auxiliary service, has-comments, frequent-flyer, e-ticket) —
// shown as static badges for now; ET and FFP already open their modals,
// the rest are wired up once there's real state behind them.
const STATIC_FLAGS: { code: string; on: boolean }[] = [
  { code: "TR", on: true },
  { code: "AUX", on: true },
  { code: "COM", on: false },
  { code: "FFP", on: false },
  { code: "ET", on: false },
];

export function PassengersTab({ flight }: Props) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ kind: "asvc" | "comments" | "coupon" | "ffp" | "route"; passenger: Passenger } | null>(null);

  useEffect(() => {
    api.passengers(flight.id, query).then(setPassengers);
  }, [flight.id, query]);
  useEffect(() => {
    api.seatmap(flight.id).then(setSeats);
  }, [flight.id]);

  const activeSeat = passengers.find((p) => p.id === activeId)?.seat ?? null;
  const seatByCode = new Map(seats.map((s) => [s.seat, s]));

  // Sorting operates on the flat passenger list, before infants get grouped
  // under their guardian by buildRows — buildRows walks the array in order
  // and always re-attaches an infant right after its guardian regardless of
  // where either ended up, so the nesting survives any sort.
  const paxSortGetters: Record<PaxSortKey, (p: Passenger) => string | number> = {
    name: (p) => `${p.surname} ${p.given_name}`,
    seat: (p) => p.seat ?? "",
    class: (p) => classFor(p, seatByCode),
    status: (p) => statusLabel(p),
    bag: (p) => p.bag_count,
    age: (p) => ageYears(p.dob),
    gender: (p) => p.gender ?? "",
  };
  const { sorted: sortedPassengers, sortKey, sortDir, onSort } = useSort(passengers, paxSortGetters);
  const rows = buildRows(sortedPassengers);

  return (
    <div className="passengers-tab">
      <div className="passengers-list">
        <div className="toolbar">
          <div className="input-box" style={{ flex: 1, maxWidth: 280 }}>
            <SearchIcon size={16} />
            <input placeholder="Search passengers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="spacer" />
          <span className="passengers-count">{passengers.length} passengers</span>
        </div>
        <div className="table-scroll">
          <table className="passengers-table">
            <thead>
              <tr>
                <th></th>
                <SortTh id="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="seat" label="Seat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="class" label="Class" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Services</th>
                <th>ASVC</th>
                <th>WL</th>
                <th>PL</th>
                <th>Type</th>
                <th>iAPP</th>
                <th>Inbound</th>
                <th>Outbound</th>
                <SortTh id="bag" label="Bag" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="age" label="Age" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="gender" label="Gender" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ passenger: p, nested, hasInfant }) => {
                const seat = p.seat ? seatByCode.get(p.seat) : undefined;
                const cls = seat ? (seat.cabin_class === "J" ? "C" : "Y") : "—";
                const ssr = p.ssr ?? [];
                const shown = ssr.slice(0, 2);
                const overflow = ssr.length - shown.length;
                return (
                  <tr
                    key={p.id}
                    className={`clickable ${nested ? "pax-row-nested" : ""}`}
                    onClick={() => setActiveId(p.id)}
                  >
                    <td>
                      <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td>
                      <div className="pax-name-cell">
                        {nested && <ArrowNestedIcon size={14} className="pax-nest-arrow" />}
                        {nested && <InfantIcon size={14} className="pax-infant-icon" />}
                        {hasInfant && <span className="pax-infant-dot" title="Travelling with an infant" />}
                        <span>
                          {p.surname} {p.given_name}
                        </span>
                        <span className="pax-flags">
                          {STATIC_FLAGS.map((f) => (
                            <span
                              key={f.code}
                              className={`chip small ${f.on ? "ok" : "muted"} pax-flag`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (f.code === "ET") setModal({ kind: "coupon", passenger: p });
                                if (f.code === "FFP") setModal({ kind: "ffp", passenger: p });
                                if (f.code === "COM") setModal({ kind: "comments", passenger: p });
                              }}
                            >
                              {f.code}
                            </span>
                          ))}
                        </span>
                      </div>
                    </td>
                    <td className="mono">{p.seat ?? "—"}</td>
                    <td>{cls}</td>
                    <td>{statusChip(p)}</td>
                    <td>
                      {shown.length === 0 ? (
                        "—"
                      ) : (
                        <span className="pax-service-chips">
                          {shown.map((s) => (
                            <span key={s} className="chip small muted mono">
                              {s}
                            </span>
                          ))}
                          {overflow > 0 && <span className="chip small muted">+{overflow}</span>}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="chip small muted pax-asvc-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ kind: "asvc", passenger: p });
                        }}
                      >
                        ASVC
                      </button>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td className="mono">—</td>
                    <td>—</td>
                    <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "route", passenger: p }); }}>—</td>
                    <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "route", passenger: p }); }}>—</td>
                    <td className="mono">{p.bag_count > 0 ? `${p.bag_count}/${p.bag_weight_kg}` : "—"}</td>
                    <td>{ageFromDob(p.dob)}</td>
                    <td>{p.gender ?? "—"}</td>
                  </tr>
                );
              })}
              {passengers.length === 0 && (
                <tr>
                  <td colSpan={16} style={{ color: "var(--muted)" }}>
                    No passengers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="passengers-seatmap">
        <SeatMapGrid seats={seats} selected={activeSeat} />
      </div>

      {modal && <PassengerModals kind={modal.kind} passenger={modal.passenger} onClose={() => setModal(null)} />}
    </div>
  );
}
