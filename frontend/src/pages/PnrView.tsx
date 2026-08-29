import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useParams } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import { formatSeatDisplay } from "../seatExtra";
import { parsePassengerExtra, SeatServiceItem } from "../paxExtra";
import { ChevronDownIcon, DocScannedIcon, DocVerifiedIcon, RefreshIcon, SearchIcon } from "../components/Icon";
import { EntityNotFound } from "../components/EntityNotFound";
import { useRegisterTab, useTabs } from "../tabs";
import { useToast } from "../toast";
import { usePopoverPosition } from "../usePopoverPosition";
import { usePanelTransition, useRetainedPanelTransition } from "../usePanelMounted";
import { segmentsForFlight } from "../flightSegments";
import { DocumentsStep } from "../components/checkin/DocumentsStep";
import { SeatsStep } from "../components/checkin/SeatsStep";
import { BaggageStep } from "../components/checkin/BaggageStep";
import { ExtraServicesStep } from "../components/checkin/ExtraServicesStep";
import { FlowRosterRow } from "../components/checkin/FlowRosterRow";
import { FaresInfoModal } from "../components/checkin/FaresInfoModal";
import { RouteSegmentsModal } from "../components/checkin/RouteSegmentsModal";
import { FlightInfoPanel } from "../components/checkin/FlightInfoPanel";
import { CartPanel } from "../components/checkin/CartPanel";
import { FlagKind, FlagModal } from "../components/flightcard/PassengerModals";
import { PassengerDocPanel } from "../components/PassengerDocPanel";
import { ActionsPanel, ActionsPanelKind } from "../components/checkin/ActionsPanel";
import { Modal } from "../components/Modal";
import { FLOW_STEPS, FLOW_STEP_LABEL, FlowStep, useCheckinFlow } from "../checkinFlow";
import { usePersistentState } from "../usePersistentState";

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

const ACTIONS_MENU_ITEMS: { label: string; kind: ActionsPanelKind }[] = [
  { label: "Quick check-in", kind: "quick" },
  { label: "Cancel check-in", kind: "cancel" },
  { label: "Move to another flight", kind: "move" },
  { label: "Priority List", kind: "priority" },
  { label: "Add/remove remark", kind: "remarks" },
  { label: "Transfer", kind: "transfer" },
  { label: "Print boarding pass", kind: "print" },
];

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

interface FlowRow {
  passenger: Passenger;
  nested: boolean;
  index: number | null;
}

// Nests an infant's card under the first checked adult sharing its PNR
// (mirrors PassengersTab's buildRows) — infants don't get their own numbered
// slot in the flow roster, just a small connector under their guardian.
function buildFlowRows(passengers: Passenger[]): FlowRow[] {
  const infantsByLocator = new Map<string, Passenger[]>();
  for (const p of passengers) {
    if (!p.infant) continue;
    if (!infantsByLocator.has(p.record_locator)) infantsByLocator.set(p.record_locator, []);
    infantsByLocator.get(p.record_locator)!.push(p);
  }
  const nestedIds = new Set<number>();
  const rows: FlowRow[] = [];
  let n = 0;
  for (const p of passengers) {
    if (p.infant) continue;
    n++;
    rows.push({ passenger: p, nested: false, index: n });
    const infants = (infantsByLocator.get(p.record_locator) ?? []).filter((inf) => !nestedIds.has(inf.id));
    for (const inf of infants) {
      rows.push({ passenger: inf, nested: true, index: null });
      nestedIds.add(inf.id);
    }
  }
  for (const p of passengers) {
    if (p.infant && !nestedIds.has(p.id)) {
      n++;
      rows.push({ passenger: p, nested: false, index: n });
    }
  }
  return rows;
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
  const { pathname } = useLocation();
  const { closeTab } = useTabs();
  const { showToast } = useToast();

  // Re-visiting a tab that's already open remounts this component from
  // scratch (React Router only keeps the matched route mounted), which
  // would otherwise reset the tab label to "PNR" and back on every switch —
  // a visible width jump in the tab strip. Seeding state from what was
  // last fetched for this flight keeps the label (and the page) stable
  // while a fresh copy loads quietly in the background.
  const [flight, setFlight] = useState<Flight | null>(() => flightCache.get(fid) ?? null);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>(() => passengersCache.get(fid) ?? []);
  // Persisted (not just cached) — surviving a tab switch alone isn't enough
  // once the flow's step does too (see below): a full reload must resume on
  // the same roster/step rather than silently dropping back to "nothing
  // checked", which is what a plain in-memory cache would do.
  const [checkedArr, setCheckedArr] = usePersistentState<number[]>(`dcs_pnr_checked_${pid}`, []);
  const checked = new Set(checkedArr);
  function setChecked(next: Set<number> | ((prev: Set<number>) => Set<number>)) {
    setCheckedArr((prevArr) => {
      const prevSet = new Set(prevArr);
      const nextSet = typeof next === "function" ? next(prevSet) : next;
      return [...nextSet];
    });
  }
  const [extraPassengers, setExtraPassengers] = useState<Passenger[]>(() => extraPassengersCache.get(pid) ?? []);
  const {
    flowStepFor,
    setFlowStep: setFlowStepFor,
    flightInfoOpenFor,
    setFlightInfoOpen: setFlightInfoOpenFor,
    cartOpenFor,
    setCartOpen: setCartOpenFor,
  } = useCheckinFlow();
  const flowStep = flowStepFor(pid);
  const flightInfoOpen = flightInfoOpenFor(pid);
  const cartOpen = cartOpenFor(pid);
  const setFlowStep = (step: FlowStep | null) => setFlowStepFor(pid, step);
  const setFlightInfoOpen = (open: boolean) => setFlightInfoOpenFor(pid, open);
  const setCartOpen = (open: boolean) => setCartOpenFor(pid, open);
  const [flowActiveId, setFlowActiveId] = usePersistentState<number | null>(`dcs_pnr_flow_active_${pid}`, null);
  // Seats step's swap mode lives here (not inside SeatsStep) since the button that starts it sits
  // on the roster card, a sibling component — reset whenever the active passenger or step changes
  // so a stale "swapping" state can't survive a switch.
  const [swapSeatMode, setSwapSeatMode] = useState(false);
  useEffect(() => setSwapSeatMode(false), [flowActiveId, flowStep]);
  const [flagsModal, setFlagsModal] = useState<{ flag: FlagKind; passenger: Passenger } | null>(null);
  const [docPanelPassenger, setDocPanelPassenger] = useState<Passenger | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsPanelKind, setActionsPanelKind] = useState<ActionsPanelKind | null>(null);
  const flightInfoTransition = usePanelTransition(flightInfoOpen);
  const cartTransition = usePanelTransition(cartOpen);
  const docPanelTransition = useRetainedPanelTransition(docPanelPassenger);
  const actionsPanelTransition = useRetainedPanelTransition(actionsPanelKind);
  const actionsBtnRef = useRef<HTMLButtonElement>(null);
  const actionsMenuRef = useRef<HTMLUListElement>(null);
  const actionsMenuRect = usePopoverPosition(actionsBtnRef, actionsMenuOpen);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (actionsBtnRef.current?.contains(target)) return;
      if (actionsMenuRef.current?.contains(target)) return;
      setActionsMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActionsMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsMenuOpen]);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  // Baggage prices only show on the roster card once the agent has actually
  // run Calculate for that passenger — not just from opening the Baggage step.
  const [baggageCalculated, setBaggageCalculated] = useState<Set<number>>(() => new Set());
  // Unlike baggageCalculated, this mirrors the actual confirmed items live — the roster
  // card's service chips update (and disappear) as the agent checks/unchecks/confirms rows.
  const [confirmedServices, setConfirmedServices] = useState<Record<number, SeatServiceItem[]>>({});

  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    api
      .getFlight(fid)
      .then((f) => {
        flightCache.set(fid, f);
        setFlight(f);
      })
      .catch(() => setNotFound(true));
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

  // A flow step can persist (on purpose — see above) past the point its
  // roster still makes sense: the tab was closed mid-flow, or the checked
  // set otherwise ended up empty. Resuming into a step with no one to show
  // would render a blank panel, so treat that combination as stale and drop
  // back to the normal roster view instead of getting stuck on it forever.
  useEffect(() => {
    if (!clicked || !flowStep) return;
    const pnrPassengersNow = passengers.filter((p) => p.record_locator === clicked.record_locator);
    const pnrIdsNow = new Set(pnrPassengersNow.map((p) => p.id));
    const rosterNow = [...pnrPassengersNow, ...extraPassengers.filter((p) => !pnrIdsNow.has(p.id))];
    const checkedSet = new Set(checkedArr);
    const hasAnyChecked = rosterNow.some((p) => checkedSet.has(p.id));
    if (!hasAnyChecked) setFlowStep(null);
  }, [clicked, flowStep, passengers, extraPassengers, checkedArr]);

  if (notFound) return <EntityNotFound label="This flight" />;
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

  // "Pass booked" (Flight Information panel) also counts lap infants, attributed
  // to whichever cabin a seated passenger sharing their PNR was assigned to.
  const seatedClassByLocator = new Map<string, "C" | "Y">();
  for (const p of passengers) {
    const cls = classFor(p, seatByCode);
    if (cls && !seatedClassByLocator.has(p.record_locator)) seatedClassByLocator.set(p.record_locator, cls);
  }
  const passBooked = { ...booked };
  for (const p of passengers) {
    if (p.infant && !p.seat) {
      const cls = seatedClassByLocator.get(p.record_locator);
      if (cls) passBooked[cls]++;
    }
  }
  const checkedInTotal = passengers.filter((p) => p.checkin_status === "CHECKED_IN").length;
  const webCheckedInTotal = passengers.filter((p) => p.checkin_status === "CHECKED_IN" && parsePassengerExtra(p).iapp).length;
  const boardedTotal = passengers.filter((p) => p.boarding_status === "BOARDED").length;

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

  function handlePassengerUpdated(updated: Passenger) {
    setPassengers((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      passengersCache.set(fid, next);
      return next;
    });
    setExtraPassengers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setFlagsModal((prev) => (prev && prev.passenger.id === updated.id ? { ...prev, passenger: updated } : prev));
  }

  function handleSeatUpdated(updated: SeatCell) {
    setSeats((prev) => prev.map((s) => (s.seat === updated.seat ? updated : s)));
  }

  const flowPassengers = rosterPassengers.filter((p) => checked.has(p.id));
  const flowActive = flowPassengers.find((p) => p.id === flowActiveId) ?? flowPassengers[0];
  // Not until seats and documents are behind us — Baggage/Extra services is where it opens up.
  const checkInDisabled = flowStep === "docs" || flowStep === "seats";

  function startCheckinFlow() {
    if (flowPassengers.length === 0) return;
    setFlowStep("docs");
    setFlowActiveId(flowPassengers[0]?.id ?? null);
  }
  function finishFlow() {
    setFlowStep(null);
    setFlowActiveId(null);
  }
  function nextFlowStep() {
    const idx = FLOW_STEPS.indexOf(flowStep!);
    if (idx < FLOW_STEPS.length - 1) setFlowStep(FLOW_STEPS[idx + 1]);
  }
  // Only reachable once seats and documents are behind us (see checkInDisabled below) — no
  // check-in API exists yet, so this just tells the agent it's done and closes the tab, the
  // same way Finish does once its confirm is accepted.
  function completeCheckin() {
    const names = flowPassengers.map((p) => `${p.surname} ${p.given_name}`).join(", ");
    showToast(`${names} checked in`, "success", () => closeTab(pathname));
  }

  if (flowStep) {
    return (
      <div className="pnr-view pnr-view-flow">
        <div className="pnr-head pnr-head-flow">
          <div className="pnr-head-id">
            <div className="pnr-flight-number">{flight.carrier_code}{flight.flight_number}</div>
            <div className="pnr-head-id-meta">
              <button type="button" className="pnr-route" onClick={() => setRouteModalOpen(true)}>{flight.origin} → {flight.destination}</button>
              <div className="pnr-date">{fmtCardDate(flight.std)}</div>
            </div>
          </div>
          <div className="spacer" />
          <div className="pnr-flow-actions">
            {/* No action wired up yet — present for layout. */}
            <button type="button" className="icon-button" aria-label="Refresh">
              <RefreshIcon size={18} />
            </button>
            <button type="button" className="tertiary" onClick={() => setFinishConfirmOpen(true)}>Finish</button>
            <span className="pnr-flow-checkin-wrap">
              <button
                type="button"
                className="secondary"
                disabled={checkInDisabled}
                onClick={completeCheckin}
              >
                Check-in
              </button>
              {checkInDisabled && (
                <span className="pnr-flow-checkin-tooltip">Seat and verify documents for all passengers first</span>
              )}
            </span>
            <button type="button" className="tertiary" disabled={flowStep === "services"} onClick={nextFlowStep}>Next</button>
          </div>
        </div>

        <div className="pnr-flow-body">
          <div className="panel panel--flush pnr-flow-roster">
            {buildFlowRows(flowPassengers).map((row) => (
              <FlowRosterRow
                key={row.passenger.id}
                flight={flight}
                passenger={row.passenger}
                nested={row.nested}
                index={row.index}
                active={row.passenger.id === flowActive?.id}
                classLetter={classFor(row.passenger, seatByCode)}
                showSeat={flowStep === "seats"}
                showBaggage={flowStep === "baggage"}
                baggageCalculated={baggageCalculated.has(row.passenger.id)}
                showServices={flowStep === "services"}
                confirmedServices={confirmedServices[row.passenger.id] ?? []}
                segments={segmentsForFlight(flight)}
                onSelect={() => setFlowActiveId(row.passenger.id)}
                onOpenFlag={(flag) => setFlagsModal({ flag, passenger: row.passenger })}
                onOpenInfo={() => setInfoModalOpen(true)}
                onSwapSeat={flowStep === "seats" ? () => setSwapSeatMode(true) : undefined}
              />
            ))}
          </div>

          <div className="panel panel--flush pnr-flow-panel">
            {flowStep === "docs" && flowActive && (
              <DocumentsStep
                flightId={fid}
                passenger={flowActive}
                segments={segmentsForFlight(flight)}
                onUpdated={handlePassengerUpdated}
              />
            )}
            {flowStep === "seats" && flowActive && (
              <SeatsStep
                flightId={fid}
                aircraftType={flight.aircraft_type}
                passenger={flowActive}
                seats={seats}
                onSeatsReloaded={setSeats}
                onPassengerUpdated={handlePassengerUpdated}
                swapping={swapSeatMode}
                onSwappingChange={setSwapSeatMode}
              />
            )}
            {flowStep === "baggage" && flowActive && (
              <BaggageStep
                flight={flight}
                passenger={flowActive}
                passengers={flowPassengers}
                segments={segmentsForFlight(flight)}
                onCalculate={() => setBaggageCalculated((prev) => new Set(prev).add(flowActive.id))}
              />
            )}
            {flowStep === "services" && flowActive && (
              <ExtraServicesStep
                key={flowActive.id}
                flight={flight}
                passenger={flowActive}
                segments={segmentsForFlight(flight)}
                onConfirmedChange={(items) =>
                  setConfirmedServices((prev) => ({ ...prev, [flowActive.id]: items }))
                }
              />
            )}
            {flowStep !== "docs" && flowStep !== "seats" && flowStep !== "baggage" && flowStep !== "services" && (
              <div className="pnr-flow-placeholder">{FLOW_STEP_LABEL[flowStep]} step is coming soon.</div>
            )}
          </div>
        </div>

        {flagsModal && (
          <FlagModal
            kind={flagsModal.flag}
            flightId={fid}
            passenger={flagsModal.passenger}
            onClose={() => setFlagsModal(null)}
            onUpdated={handlePassengerUpdated}
          />
        )}
        {infoModalOpen && <FaresInfoModal carrierCode={flight.carrier_code} onClose={() => setInfoModalOpen(false)} />}
        {routeModalOpen && <RouteSegmentsModal flight={flight} onClose={() => setRouteModalOpen(false)} />}
        {flightInfoTransition.mounted && (
          <FlightInfoPanel
            flight={flight}
            checkinTill={fmtOffsetTime(flight.std, BOARDING_FROM_MIN)}
            capacity={capacity}
            booked={booked}
            passBooked={passBooked}
            checkedInTotal={checkedInTotal}
            webCheckedInTotal={webCheckedInTotal}
            boardedTotal={boardedTotal}
            passengerTotal={passengers.length}
            open={flightInfoTransition.entered}
            onClose={() => setFlightInfoOpen(false)}
          />
        )}
        {cartTransition.mounted && (
          <CartPanel
            passengers={flowPassengers}
            segments={segmentsForFlight(flight)}
            confirmedServices={confirmedServices}
            open={cartTransition.entered}
            onClose={() => setCartOpen(false)}
          />
        )}
        {finishConfirmOpen && (
          <Modal
            title="Exit check-in"
            onClose={() => setFinishConfirmOpen(false)}
            footer={
              <>
                <button type="button" className="tertiary" onClick={() => setFinishConfirmOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="tertiary"
                  onClick={() => {
                    setFinishConfirmOpen(false);
                    finishFlow();
                  }}
                >
                  OK
                </button>
              </>
            }
          >
            You are about to exit the check-in process. Unsaved progress on the current step will be lost.
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="pnr-view">
      <div className="pnr-head">
        <div className="pnr-head-id">
          <div className="pnr-flight-number">{flight.carrier_code}{flight.flight_number}</div>
          <div className="pnr-head-id-meta">
            <button type="button" className="pnr-route" onClick={() => setRouteModalOpen(true)}>{flight.origin} → {flight.destination}</button>
            <div className="pnr-date">{fmtCardDate(flight.std)}</div>
          </div>
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
        <button type="button" className="secondary" disabled={flowPassengers.length === 0} onClick={startCheckinFlow}>Check-in</button>
        <button
          ref={actionsBtnRef}
          type="button"
          className="secondary actions-menu-btn"
          disabled={flowPassengers.length === 0}
          aria-haspopup="menu"
          aria-expanded={actionsMenuOpen}
          onClick={() => setActionsMenuOpen((o) => !o)}
        >
          Actions
          <ChevronDownIcon size={16} className={actionsMenuOpen ? "chevron-rotated" : ""} />
        </button>
        {actionsMenuOpen &&
          actionsMenuRect &&
          createPortal(
            <ul
              ref={actionsMenuRef}
              className="select-menu actions-menu"
              role="menu"
              style={{ position: "fixed", top: actionsMenuRect.top, right: window.innerWidth - (actionsMenuRect.left + actionsMenuRect.width) }}
            >
              {ACTIONS_MENU_ITEMS.map(({ label, kind }) => (
                <li
                  key={label}
                  role="menuitem"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setActionsPanelKind(kind);
                  }}
                >
                  {label}
                </li>
              ))}
            </ul>,
            document.body
          )}
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
                    <td className="link-text" onClick={(e) => { e.stopPropagation(); setDocPanelPassenger(p); }}>{p.surname} {p.given_name}</td>
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
      {routeModalOpen && <RouteSegmentsModal flight={flight} onClose={() => setRouteModalOpen(false)} />}
      {docPanelTransition.mounted && docPanelTransition.retained && (
        <PassengerDocPanel
          flightId={fid}
          passenger={docPanelTransition.retained}
          open={docPanelTransition.entered}
          onClose={() => setDocPanelPassenger(null)}
          onUpdated={handlePassengerUpdated}
        />
      )}
      {actionsPanelTransition.mounted && actionsPanelTransition.retained && (
        <ActionsPanel
          kind={actionsPanelTransition.retained}
          flight={flight}
          passengers={flowPassengers}
          segments={segmentsForFlight(flight)}
          open={actionsPanelTransition.entered}
          onClose={() => setActionsPanelKind(null)}
          onPassengerUpdated={handlePassengerUpdated}
          onSeatsChanged={() => api.seatmap(fid).then(setSeats)}
        />
      )}
    </div>
  );
}
