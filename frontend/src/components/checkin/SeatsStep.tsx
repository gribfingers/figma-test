import { useMemo, useState } from "react";
import { api, Passenger, SeatCell } from "../../api";
import { cabinFeaturesFor } from "../../cabinLayout";
import { isInfant, parsePassengerExtra } from "../../paxExtra";
import { SeatMapPanel } from "../SeatMapPanel";

interface Props {
  flightId: number;
  aircraftType: string;
  passenger: Passenger;
  seats: SeatCell[];
  onSeatsReloaded: (seats: SeatCell[]) => void;
  onPassengerUpdated: (p: Passenger) => void;
}

/**
 * The check-in flow's Seats step: the same seat map used on the flight
 * card's Pax tab, scoped to the currently active flow passenger — clicking
 * a free seat assigns it to them directly (no "select a passenger first"
 * step needed, since the flow already has one).
 */
export function SeatsStep({ flightId, aircraftType, passenger, seats, onSeatsReloaded, onPassengerUpdated }: Props) {
  const [error, setError] = useState("");
  const cabinFeatures = useMemo(() => cabinFeaturesFor(aircraftType), [aircraftType]);

  // Someone else's seat can't be picked; an infant/child can't take an exit row (real IATA restriction).
  const restricted = !!passenger.infant || isInfant(passenger.dob) || parsePassengerExtra(passenger).type === "CHD";
  const disabledSeats = useMemo(() => {
    const disabled = seats
      .filter((s) => (s.passenger_id != null && s.passenger_id !== passenger.id) || (restricted && s.exit_row))
      .map((s) => s.seat);
    return new Set(disabled);
  }, [seats, passenger.id, restricted]);

  async function assignSeat(seatCode: string) {
    setError("");
    try {
      const updated = await api.changeSeat(passenger.id, seatCode);
      onPassengerUpdated(updated);
      const freshSeats = await api.seatmap(flightId);
      onSeatsReloaded(freshSeats);
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
          onSelect={assignSeat}
          onSeatUpdated={(updated) => onSeatsReloaded(seats.map((s) => (s.seat === updated.seat ? updated : s)))}
          onHide={() => {}}
          cabinFeatures={cabinFeatures}
          disabledSeats={disabledSeats}
        />
      </div>
    </div>
  );
}
