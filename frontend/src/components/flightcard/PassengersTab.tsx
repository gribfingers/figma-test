import { useEffect, useMemo, useRef, useState } from "react";
import { api, Flight, Passenger, SeatCell } from "../../api";
import { cabinFeaturesFor } from "../../cabinLayout";
import { SeatMapPanel } from "../SeatMapPanel";
import { ArrowBackIcon, ArrowNestedIcon, ChildIcon, InfantIcon } from "../Icon";
import { SortTh, useSort } from "../SortTh";
import { FlagStatus, ageFromDob, ageYears, asvcForPassenger, asvcStatus, commentsStatus, etStatus, ffpStatus, isInfant, parsePassengerExtra, trStatus } from "../../paxExtra";
import { FlagKind, FlagModal, PassengerDetailModal } from "./PassengerModals";
import { formatSeatDisplay, parseSeatExtra } from "../../seatExtra";
import { useToast } from "../../toast";
import {
  BaggageFields,
  DocumentsFields,
  EMPTY_PAX_DRAFT,
  PaxTabbedFields,
  RemarksFields,
  SummaryFields,
  paxDraftToPayload,
} from "./PassengerForm";
import { Modal } from "../Modal";
import { PASSENGER_COLUMNS, PassengersToolbar, QuickFilter } from "./PassengersToolbar";
import { SegmentToggle } from "../SegmentToggle";
import { segmentsForFlight } from "../../flightSegments";

interface Props {
  flight: Flight;
}

type ModalKind = "summary" | "documents" | "remarks" | "baggage" | FlagKind;

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
    // Only nest an infant under the first adult on its PNR — without this
    // filter, an infant shared by multiple adults on the same locator would
    // be pushed once per adult, producing duplicate rows (and duplicate
    // React keys, since rows are keyed by passenger id).
    const infants = (infantsByLocator.get(p.record_locator) ?? []).filter((inf) => !nested.has(inf.id));
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
  if (label === "—") return "";
  return <span className={`chip middle ${label === "Offloaded" ? "danger" : "ok"}`}>{label}</span>;
}

function classFor(p: Passenger, seatByCode: Map<string, SeatCell>): string {
  const seat = p.seat ? seatByCode.get(p.seat) : undefined;
  return seat ? (seat.cabin_class === "J" ? "C" : "Y") : "—";
}

type PaxSortKey = "name" | "pnr" | "seat" | "class" | "status" | "bag" | "age" | "gender";

// Each flag chip's color reflects real per-passenger state (paxExtra.ts)
// and opens the modal that best matches what it stands for.
const FLAG_STATUS: Record<string, (p: Passenger) => FlagStatus> = {
  TR: trStatus,
  AUX: asvcStatus,
  COM: commentsStatus,
  FFP: ffpStatus,
  ET: etStatus,
};
// Each flag chip opens its own small modal.
const FLAG_MODAL: Record<string, FlagKind> = {
  TR: "tr",
  AUX: "aux",
  COM: "com",
  FFP: "ffp",
  ET: "et",
};
const FLAG_KINDS = new Set<ModalKind>(["tr", "aux", "com", "ffp", "et"]);
function isFlagKind(kind: ModalKind): kind is FlagKind {
  return FLAG_KINDS.has(kind);
}
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; passenger: Passenger } | null>(null);
  const [seatAction, setSeatAction] = useState<{ passenger: Passenger; mode: "assign" | "swap" } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState(EMPTY_PAX_DRAFT);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const contextMenuRef = useRef<HTMLUListElement>(null);
  const { showToast } = useToast();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [asvcFilter, setAsvcFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(PASSENGER_COLUMNS.map((c) => c.key)));
  const [mapHidden, setMapHidden] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(0);
  const segments = useMemo(() => segmentsForFlight(flight), [flight]);
  const cabinFeatures = useMemo(() => cabinFeaturesFor(flight.aircraft_type), [flight.aircraft_type]);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const seatmapRef = useRef<HTMLDivElement>(null);

  function handleSeatUpdated(updated: SeatCell) {
    setSeats((prev) => prev.map((s) => (s.seat === updated.seat ? updated : s)));
  }

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

  function loadPassengers() {
    api.passengers(flight.id, query).then(setPassengers);
  }

  function refreshSeating() {
    loadPassengers();
    api.seatmap(flight.id).then(setSeats);
  }

  function startAssignSeat(p: Passenger) {
    setContextMenu(null);
    setMapHidden(false);
    setSeatAction({ passenger: p, mode: "assign" });
  }

  function startSwapSeat(p: Passenger) {
    setContextMenu(null);
    setMapHidden(false);
    setSeatAction({ passenger: p, mode: "swap" });
  }

  async function handleAssignSeatClick(seatCode: string) {
    if (!seatAction || seatAction.mode !== "assign") return;
    const wasSeated = !!seatAction.passenger.seat;
    try {
      await api.changeSeat(seatAction.passenger.id, seatCode);
      refreshSeating();
      setSeatAction(null);
      showToast(wasSeated ? `Seat changed to ${formatSeatDisplay(seatCode)}` : `Seat ${formatSeatDisplay(seatCode)} assigned`);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleOccupiedSeatClick(s: SeatCell) {
    if (seatAction?.mode === "swap") {
      if (s.passenger_id == null) return;
      if (s.passenger_id === seatAction.passenger.id) {
        setSeatAction(null);
        return;
      }
      try {
        await api.swapSeats(seatAction.passenger.id, s.passenger_id);
        refreshSeating();
        setSeatAction(null);
        showToast("Seats swapped");
      } catch (e: any) {
        alert(e.message);
      }
      return;
    }
    if (s.passenger_id != null) setActiveId(s.passenger_id);
  }

  /** Clicking the currently active passenger's own (blue) seat again removes it — a quick undo for a
   *  just-made assignment, without having to go through Actions > Cancel check-in. */
  async function handleUnassignSeatClick() {
    if (activeId == null) return;
    const passenger = passengers.find((p) => p.id === activeId);
    if (!passenger?.seat) return;
    try {
      await api.changeSeat(activeId, null);
      refreshSeating();
      showToast(`Seat ${formatSeatDisplay(passenger.seat)} unassigned`);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function deletePassenger(p: Passenger) {
    setContextMenu(null);
    if (!window.confirm(`Delete pax ${p.surname} ${p.given_name}?`)) return;
    try {
      await api.deletePassenger(flight.id, p.id);
      loadPassengers();
      showToast("Passenger deleted");
    } catch (e: any) {
      alert(e.message);
    }
  }

  function openAdd() {
    setAddDraft(EMPTY_PAX_DRAFT);
    setError("");
    setAddOpen(true);
  }
  async function submitAdd() {
    if (!addDraft.surname.trim() || !addDraft.given_name.trim() || !addDraft.ticket_number.trim()) {
      setError("Surname, given name and ticket number are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      await api.addPassenger(flight.id, paxDraftToPayload(addDraft));
      setAddOpen(false);
      loadPassengers();
      showToast("Passenger added");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    if (!contextMenu) return;
    function onDocMouseDown(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!seatAction) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSeatAction(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [seatAction]);

  useEffect(() => {
    loadPassengers();
  }, [flight.id, query]);
  useEffect(() => {
    api.seatmap(flight.id).then(setSeats);
  }, [flight.id]);

  const activeSeat = passengers.find((p) => p.id === activeId)?.seat ?? null;
  const seatByCode = new Map(seats.map((s) => [s.seat, s]));

  // While assigning a seat: already-occupied and hard-blocked seats can't be picked at all, and exit-row
  // seats are additionally off-limits for infants/children (real IATA restriction). Soft-blocked seats are
  // legal but discouraged, shown separately (see undesirableSeats).
  const ineligibleSeats = useMemo(() => {
    if (!seatAction || seatAction.mode !== "assign") return undefined;
    const restricted = !!seatAction.passenger.infant || isInfant(seatAction.passenger.dob) || parsePassengerExtra(seatAction.passenger).type === "CHD";
    const ineligible = seats
      .filter((s) => s.passenger_id != null || parseSeatExtra(s).hardBlock || (restricted && s.exit_row))
      .map((s) => s.seat);
    return new Set(ineligible);
  }, [seatAction, seats]);
  const undesirableSeats = useMemo(() => {
    if (!seatAction || seatAction.mode !== "assign") return undefined;
    const undesirable = seats.filter((s) => s.passenger_id == null && parseSeatExtra(s).softBlock).map((s) => s.seat);
    return new Set(undesirable);
  }, [seatAction, seats]);

  // Selecting a passenger (either by clicking their row or clicking their
  // occupied seat on the map) scrolls both the row and the seat into view,
  // whichever side wasn't already visible — scrollIntoView is a no-op when
  // the element is already in view, so this is safe to run from both ends.
  useEffect(() => {
    if (activeId == null) return;
    rowRefs.current.get(activeId)?.scrollIntoView({ block: "nearest" });
    if (activeSeat) {
      seatmapRef.current
        ?.querySelector(`[data-seat="${activeSeat}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId, activeSeat]);

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
    pnr: (p) => p.record_locator,
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
    <div className={`passengers-tab ${mapHidden ? "map-hidden" : ""}`}>
      <div className="passengers-list">
        <SegmentToggle segments={segments} selected={selectedSegment} onSelect={setSelectedSegment} />
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
          onAddPassenger={openAdd}
        />
        <div className="table-scroll">
          <table className="passengers-table">
            <thead>
              <tr>
                <th></th>
                <SortTh id="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                {visibleColumns.has("pnr") && <SortTh id="pnr" label="PNR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
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
                const cls = seat ? (seat.cabin_class === "J" ? "C" : "Y") : "";
                const ssr = p.ssr ?? [];
                const extra = parsePassengerExtra(p);
                return (
                  <tr
                    key={p.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(p.id, el);
                      else rowRefs.current.delete(p.id);
                    }}
                    className={`clickable ${nested ? "pax-row-nested" : ""} ${p.id === activeId ? "pax-row-active" : ""}`}
                    onClick={() => setActiveId(p.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveId(p.id);
                      setContextMenu({ x: e.clientX, y: e.clientY, passenger: p });
                    }}
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
                    {visibleColumns.has("pnr") && <td className="mono">{p.record_locator}</td>}
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
                    {visibleColumns.has("seat") && (
                      <td>{p.seat && <span className="mono chip middle muted seat-chip">{formatSeatDisplay(p.seat)}</span>}</td>
                    )}
                    {visibleColumns.has("class") && <td>{cls}</td>}
                    {visibleColumns.has("status") && <td>{statusChip(p)}</td>}
                    {visibleColumns.has("services") && (
                      <td>
                        {ssr.length === 0 ? (
                          ""
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
                    {visibleColumns.has("wl") && <td>{extra.wl ? "✓" : ""}</td>}
                    {visibleColumns.has("pl") && <td>{extra.pl ? "✓" : ""}</td>}
                    {visibleColumns.has("type") && <td className="mono">{extra.type}</td>}
                    {visibleColumns.has("iapp") && <td>{extra.iapp ? "✓" : ""}</td>}
                    {visibleColumns.has("inbound") && (
                      <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "tr", passenger: p }); }}>{extra.inbound}</td>
                    )}
                    {visibleColumns.has("outbound") && (
                      <td className="pax-route-cell" onClick={(e) => { e.stopPropagation(); setModal({ kind: "tr", passenger: p }); }}>{extra.outbound}</td>
                    )}
                    {visibleColumns.has("bag") && <td className="mono">{p.bag_count > 0 ? `${p.bag_count}/${p.bag_weight_kg}` : ""}</td>}
                    {visibleColumns.has("age") && <td>{ageFromDob(p.dob)}</td>}
                    {visibleColumns.has("gender") && <td>{p.gender}</td>}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={visibleColCount} style={{ color: "var(--muted)" }}>
                    No pax found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel-hint">Right-click a row to assign/change or swap the seat, edit the passenger, or delete them.</div>
      </div>
      {mapHidden ? (
        <button type="button" className="passengers-seatmap-collapsed" onClick={() => setMapHidden(false)} title="Show seat map">
          <ArrowBackIcon size={18} />
        </button>
      ) : (
        <div className={`passengers-seatmap ${seatAction ? "picking" : ""}`} ref={seatmapRef}>
          {seatAction && (
            <div className="seat-pick-banner">
              <span>
                {seatAction.mode === "assign" ? "Select a seat for " : "Select a pax's seat to swap with "}
                <b>
                  {seatAction.passenger.surname} {seatAction.passenger.given_name}
                </b>
              </span>
              <button type="button" className="tertiary" onClick={() => setSeatAction(null)}>
                Cancel
              </button>
            </div>
          )}
          <SeatMapPanel
            flightId={flight.id}
            seats={seats}
            selected={activeSeat}
            onSelect={handleAssignSeatClick}
            onSeatUpdated={handleSeatUpdated}
            onHide={() => setMapHidden(true)}
            cabinFeatures={cabinFeatures}
            onSelectOccupied={handleOccupiedSeatClick}
            onUnassign={seatAction ? undefined : handleUnassignSeatClick}
            ineligibleSeats={ineligibleSeats}
            undesirableSeats={undesirableSeats}
          />
          <div className="panel-hint">Right-click a seat to edit its properties.</div>
        </div>
      )}

      {modal && (
        isFlagKind(modal.kind) ? (
          <FlagModal
            kind={modal.kind}
            flightId={flight.id}
            passenger={modal.passenger}
            onClose={() => setModal(null)}
            onUpdated={handleUpdated}
          />
        ) : (
          <PassengerDetailModal
            kind={modal.kind}
            flightId={flight.id}
            passenger={modal.passenger}
            seats={seats}
            onSeatUpdated={handleSeatUpdated}
            onClose={() => setModal(null)}
            onUpdated={handleUpdated}
          />
        )
      )}

      {contextMenu && (
        <ul
          ref={contextMenuRef}
          className="select-menu pax-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <li className="pax-columns-item" onClick={() => startAssignSeat(contextMenu.passenger)}>
            {contextMenu.passenger.seat ? "Change seat" : "Assign seat"}
          </li>
          {contextMenu.passenger.seat && (
            <li className="pax-columns-item" onClick={() => startSwapSeat(contextMenu.passenger)}>
              Swap seat…
            </li>
          )}
          <li
            className="pax-columns-item"
            onClick={() => {
              setModal({ kind: "summary", passenger: contextMenu.passenger });
              setContextMenu(null);
            }}
          >
            Edit
          </li>
          <li className="pax-columns-item danger" onClick={() => deletePassenger(contextMenu.passenger)}>
            Delete
          </li>
        </ul>
      )}

      {addOpen && (
        <Modal
          title="Add pax"
          onClose={() => setAddOpen(false)}
          width={720}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setAddOpen(false)}>Close</button>
              <button type="button" className="tertiary" disabled={adding} onClick={submitAdd}>Add</button>
            </>
          }
        >
          {error && <div className="error-box">{error}</div>}
          <PaxTabbedFields
            tabs={[
              { key: "summary", label: "Summary", content: <SummaryFields draft={addDraft} onChange={setAddDraft} /> },
              { key: "documents", label: "Documents", content: <DocumentsFields draft={addDraft} onChange={setAddDraft} /> },
              { key: "remarks", label: "Remarks", content: <RemarksFields draft={addDraft} onChange={setAddDraft} /> },
              { key: "baggage", label: "Baggage", content: <BaggageFields draft={addDraft} onChange={setAddDraft} /> },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
