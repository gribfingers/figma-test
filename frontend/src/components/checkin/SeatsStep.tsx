import { useMemo, useState } from "react";
import { api, Passenger, SeatCell } from "../../api";
import { cabinFeaturesFor } from "../../cabinLayout";
import { isInfant, parsePassengerExtra } from "../../paxExtra";
import { formatSeatDisplay, parseSeatExtra } from "../../seatExtra";
import { useToast } from "../../toast";
import { SeatMapPanel } from "../SeatMapPanel";
import { useLanguage } from "../../i18n";

interface Props {
  flightId: number;
  aircraftType: string;
  passenger: Passenger;
  seats: SeatCell[];
  onSeatsReloaded: (seats: SeatCell[]) => void;
  onPassengerUpdated: (p: Passenger) => void;
  /** Swap mode is started from the roster card's "Swap seat…" button (PnrView), not from here —
   *  this step just reacts to it (dims the assign/unassign interactions, wires the map click). */
  swapping: boolean;
  onSwappingChange: (swapping: boolean) => void;
}

/**
 * The check-in flow's Seats step: the same seat map used on the flight
 * card's Pax tab, scoped to the currently active flow passenger — clicking
 * a free seat assigns it to them directly (no "select a passenger first"
 * step needed, since the flow already has one). "Swap seat" mirrors the
 * flight card's Pax tab swap flow: pick another occupied seat on the map
 * (any passenger on the flight, not just this PNR) to trade places with.
 */
export function SeatsStep({
  flightId,
  aircraftType,
  passenger,
  seats,
  onSeatsReloaded,
  onPassengerUpdated,
  swapping,
  onSwappingChange,
}: Props) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const cabinFeatures = useMemo(() => cabinFeaturesFor(aircraftType), [aircraftType]);

  // Someone else's seat or a hard-blocked one can't be picked; an infant/child can't take an exit row
  // (real IATA restriction). Soft-blocked seats are legal but discouraged — see undesirableSeats.
  const restricted = !!passenger.infant || isInfant(passenger.dob) || parsePassengerExtra(passenger).type === "CHD";
  // While swapping, an occupied seat is exactly what's clickable (the swap target) rather than
  // something to dim out — the assign-time occupancy check only applies outside that mode.
  const ineligibleSeats = useMemo(() => {
    const ineligible = seats
      .filter(
        (s) =>
          (!swapping && s.passenger_id != null && s.passenger_id !== passenger.id) ||
          parseSeatExtra(s).hardBlock ||
          (restricted && s.exit_row)
      )
      .map((s) => s.seat);
    return new Set(ineligible);
  }, [seats, passenger.id, restricted, swapping]);
  const undesirableSeats = useMemo(() => {
    const undesirable = seats
      .filter((s) => (s.passenger_id == null || s.passenger_id === passenger.id) && parseSeatExtra(s).softBlock)
      .map((s) => s.seat);
    return new Set(undesirable);
  }, [seats, passenger.id]);

  async function refreshSeating() {
    const freshSeats = await api.seatmap(flightId);
    onSeatsReloaded(freshSeats);
  }

  async function assignSeat(seatCode: string) {
    setError("");
    try {
      const updated = await api.changeSeat(passenger.id, seatCode);
      onPassengerUpdated(updated);
      await refreshSeating();
    } catch (e: any) {
      setError(e.message);
    }
  }

  /** Clicking the passenger's own (blue) seat again removes it. */
  async function unassignSeat() {
    setError("");
    try {
      const updated = await api.changeSeat(passenger.id, null);
      onPassengerUpdated(updated);
      await refreshSeating();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleOccupiedSeatClick(s: SeatCell) {
    if (!swapping || s.passenger_id == null) return;
    if (s.passenger_id === passenger.id) {
      onSwappingChange(false);
      return;
    }
    setError("");
    try {
      const { a, b } = await api.swapSeats(passenger.id, s.passenger_id);
      onPassengerUpdated(a);
      onPassengerUpdated(b);
      onSwappingChange(false);
      await refreshSeating();
      showToast(t("Seats swapped"));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="seats-step">
      {error && <div className="error-box">{error}</div>}
      <div className="seats-step-map">
        <SeatMapPanel
          flightId={flightId}
          seats={seats}
          selected={passenger.seat}
          onSelect={swapping ? undefined : assignSeat}
          onUnassign={swapping ? undefined : unassignSeat}
          onSelectOccupied={handleOccupiedSeatClick}
          onSeatUpdated={(updated) => onSeatsReloaded(seats.map((s) => (s.seat === updated.seat ? updated : s)))}
          cabinFeatures={cabinFeatures}
          ineligibleSeats={ineligibleSeats}
          undesirableSeats={undesirableSeats}
          allowSeatEdit={false}
          banner={
            swapping ? (
              <>
                <span>
                  {t("Select a pax's seat to swap with ")}<b>{passenger.surname} {passenger.given_name}</b> ({formatSeatDisplay(passenger.seat!)})
                </span>
                <button type="button" className="tertiary" onClick={() => onSwappingChange(false)}>
                  {t("Cancel")}
                </button>
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
