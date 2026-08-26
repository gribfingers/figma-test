import { Flight, Passenger } from "../../api";
import { SeatServiceItem } from "../../paxExtra";
import { Modal } from "../Modal";

interface Props {
  flight: Flight;
  passenger: Passenger;
  item: SeatServiceItem;
  onClose: () => void;
}

// Deterministic-looking 13-digit EMD document number derived from the
// passenger/rfisc — same "no backing system, but stable" approach as the
// mock ASVC/seat-service data itself.
function emdNumber(p: Passenger): string {
  const n = 5550000000000 + (p.id * 104729) % 9999999999;
  return String(n).padStart(13, "0");
}

/** Static EMD-receipt boilerplate (no ticketing system behind it) — opened by clicking a paid seat extra's price. */
export function EmdModal({ flight, passenger, item, onClose }: Props) {
  const flightNo = `${flight.carrier_code}${flight.flight_number}`;
  const text = `PNR: ${passenger.record_locator}/${flight.carrier_code}
Sale:
  Date: 26MAY25
  System address: MOW 1H
  Agency: AVKAF PAO AEROFLOT
  Sale point: 92496213
  City: MOW MOSCOW
  Operator: 615
  Terminal:
Passenger:
  Surname: ${passenger.surname}
  Name: ${passenger.given_name}
  Category:
  Age:
EMD type: A
RFIC: C

EMD#${emdNumber(passenger)}:
  Coup.No Date   Time Dep. Arr. A/L Flight Sum   RFISC Number Paid  Name of service          StCoup. Assoc.        StAssoc.
  1       ------ ---- ${flight.origin.padEnd(4)} ${flight.destination.padEnd(4)} ${flight.carrier_code}  ${flightNo.padEnd(6)} ${String(item.price).padEnd(5)} ${item.rfisc}   1      1PC   ${item.label.toUpperCase().padEnd(24)} O       5552469864319/1 702
Payment:
  Fare: ${item.price}RUB
  Charges:
  Total: ${item.price}RUB
  Payment: ${item.price} CA`;

  return (
    <Modal
      title="EMD"
      onClose={onClose}
      width={640}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          Close
        </button>
      }
    >
      <pre className="fares-info-text">{text}</pre>
    </Modal>
  );
}
