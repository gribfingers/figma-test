import { useEffect, useState } from "react";
import { api, Flight, Passenger, SeatCell } from "../../api";
import { SeatMapGrid } from "../SeatMapGrid";
import { ArrowNestedIcon, ChildIcon, InfantIcon } from "../Icon";
import { SortTh, useSort } from "../SortTh";
import { FlagStatus, asvcForPassenger, asvcStatus, commentsStatus, etStatus, ffpStatus, parsePassengerExtra, trStatus } from "../../paxExtra";
import { PassengerModals } from "./PassengerModals";
import { PASSENGER_COLUMNS, PassengersToolbar, QuickFilter } from "./PassengersToolbar";

interface Props {
  flight: Flight;
}

type ModalKind = "asvc" | "comments" | "coupon" | "ffp" | "route";

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

// Each flag chip's color reflects real per-passenger state (paxExtra.ts)
// and opens the modal that best matches what it stands for.
const FLAG_STATUS: Record<string, (p: Passenger) => FlagStatus> = {
  TR: trStatus,
  AUX: asvcStatus,
  COM: commentsStatus,
  FFP: ffpStatus,
  ET: etStatus,
};
const FLAG_MODAL: Record<string, ModalKind> = {
  TR: "route",
  AUX: "asvc",
  COM: "comments",
  FFP: "ffp",
  ET: "coupon",
};
const FLAG_CODES = ["TR", "AUX", "COM", "FFP", "ET"];
const STATUS_CLASS: Record<FlagStatus, string> = {
  none: "muted",
  ok: "ok",
  conflict: "danger",
};

export function PassengersTab({ flight }: Props) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ kind: ModalKind; passenger: Passenger } | null>(null);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [asvcFilter, setAsvcFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(PASSENGER_COLUMNS.map((c) => c.key)));

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleUpdated(updated: Passenger) {
    setPassengers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setModal((m) => (m && m.passenger.id === updated.id ? { ...m, passenger: updated } : m));
  }

  useEffect(() => {
    api.passengers(flight.id, query).then(setPassengers);
  }, [flight.id, query]);
  useEffect(() => {
    api.seatmap(flight.id).then(setSeats);
  }, [flight.id]);

  const activeSeat = passengers.find((p) => p.id === activeId)?.seat ?? null;
  const seatByCode = new Map(seats.map((s) => [s.seat, s]));

  const reseatCount = passengers.filter((p) => parsePassengerExtra(p).wl).length;
  const priorityCount = passengers.filter((p) => parsePassengerExtra(p).pl).length;

  const asvcQuery = asvcFilter.trim().toLowerCase();
  const filteredPassengers = passengers.filter((p) => {
    const extra = parsePassengerExtra(p);
    if (quickFilter === "reseat" && !extra.wl) return false;
    if (quickFilter === "priority" && !extra.pl) return false;
    if (serviceFilter.length > 0 && !(p.ssr ?? []).some((code) => serviceFilter.includes(code))) return false;
    if (asvcQuery && !asvcForPassenger(p).some((leg) => leg.services.some((s) => s.name.toLowerCase().includes(asvcQuery)))) return false;
    return true;
  });

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
  const { sorted: sortedPassengers, sortKey, sortDir, onSort } = useSort(filteredPassengers, paxSortGetters);
  const rows = buildRows(sortedPassengers);
  const visibleColCount = 2 + visibleColumns.size;

  return (
    <div className="passengers-tab">
      <div className="passengers-list">
        <PassengersToolbar
          seats={seats}
          reseatCount={reseatCount}
          priorityCount={priorityCount}
          quickFilter={quickFilter}
          onQuickFilter={setQuickFilter}
          query={query}
          onQuery={setQuery}
          serviceFilter={serviceFilter}
          onServiceFilter={setServiceFilter}
          asvcFilter={asvcFilter}
          onAsvcFilter={setAsvcFilter}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          totalCount={filteredPassengers.length}
        />
        <div className="table-scroll">
          <table className="passengers-table">
            <thead>
              <tr>
                <th></th>
                <SortTh id="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                {visibleColumns.has("flags") && <th>Flags</th>}
                {visibleColumns.has("seat") && <SortTh id="seat" label="Seat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
                {visibleColumns.has("class") && <SortTh id="class" label="Class" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
                {visibleColumns.has("status") && <SortTh id="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
                {visibleColumns.has("services") && <th>Services</th>}
                {visibleColumns.has("asvc") && <th>ASVC</th>}
                {visibleColumns.has("wl") && <th>WL</th>}
                {visibleColumns.has("pl") && <th>PL</th>}
                {visibleColumns.has("type") && <th>Type</th>}
                {visibleColumns.has("iapp") && <th>iAPP</th>}
                {visibleColumns.has("inbound") && <th>Inbound</th>}
                {visibleColumns.has("outbound") && <th>Outbound</th>}
                {visibleColumns.has("bag") && <SortTh id="bag" label="Bag" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
                {visibleColumns.has("age") && <SortTh id="age" label="Age" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
                {visibleColumns.has("gender") && <SortTh id="gender" label="Gender" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ passenger: p, nested, hasInfant }) => {
                const seat = p.seat ? seatByCode.get(p.seat) : undefined;
                const cls = seat ? (seat.cabin_class === "J" ? "C" : "Y") : "—";
                const ssr = p.ssr ?? [];
                const extra = parsePassengerExtra(p);
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
                        {!nested && extra.type === "CHD" && (
                          <span title="Child (travelling with a guardian on this PNR)">
                            <ChildIcon size={14} className="pax-child-icon" />
                          </span>
                        )}
                        {hasInfant && <span className="pax-infant-dot" title="Travelling with an infant" />}
                        <span>
                          {p.surname} {p.given_name}
                        </span>
                      </div>
                    </td>
                    {visibleColumns.has("flags") && (
                      <td className="pax-flags-cell">
                        <span className="pax-flags">
                          {FLAG_CODES.map((code) => (
                            <span
                              key={code}
                              className={`chip middle ${STATUS_CLASS[FLAG_STATUS[code](p)]} pax-flag`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModal({ kind: FLAG_MODAL[code], passenger: p });
                              }}
                            >
                              {code}
                            </span>
                          ))}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has("seat") && <td className="mono">{p.seat ?? "—"}</td>}
                    {visibleColumns.has("class") && <td>{cls}</td>}
                    {visibleColumns.has("status") && <td>{statusChip(p)}</td>}
                    {visibleColumns.has("services") && (
                      <td>
                        {ssr.length === 0 ? (
                          "—"
                        ) : (
                          <span className="pax-service-chips">
                            <span className="chip small muted mono">{ssr[0]}</span>
                            {ssr.length > 1 && (
                              <span className="chip small muted" title={ssr.join(", ")}>
                                +{ssr.length - 1}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.has("asvc") && <td className="mono" style={{ color: "var(--muted)" }}>ASVC</td>}
                    {visibleColumns.has("wl") && <td>{extra.wl ? "✓" : "—"}</td>}
                    {visibleColumns.has("pl") && <td>{extra.pl ? "✓" : "—"}</td>}
                    {visibleColumns.has("type") && <td className="mono">{extra.type || "—"}</td>}
                    {visibleColumns.has("iapp") && <td>{extra.iapp ? "✓" : "—"}</td>}
                    {visibleColumns.has("inbound") && (
                      <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "route", passenger: p }); }}>{extra.inbound || "—"}</td>
                    )}
                    {visibleColumns.has("outbound") && (
                      <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "route", passenger: p }); }}>{extra.outbound || "—"}</td>
                    )}
                    {visibleColumns.has("bag") && <td className="mono">{p.bag_count > 0 ? `${p.bag_count}/${p.bag_weight_kg}` : "—"}</td>}
                    {visibleColumns.has("age") && <td>{ageFromDob(p.dob)}</td>}
                    {visibleColumns.has("gender") && <td>{p.gender ?? "—"}</td>}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={visibleColCount} style={{ color: "var(--muted)" }}>
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

      {modal && (
        <PassengerModals
          kind={modal.kind}
          flightId={flight.id}
          passenger={modal.passenger}
          onClose={() => setModal(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
