import { Flight } from "../../api";
import { segmentsForFlight } from "../../flightSegments";
import { fmtTimeValue } from "../flightcard/mainDraft";
import { Modal } from "../Modal";

interface Props {
  flight: Flight;
  onClose: () => void;
}

/** Leg-by-leg routing breakdown — opened by clicking the header's route text. */
export function RouteSegmentsModal({ flight, onClose }: Props) {
  const segments = segmentsForFlight(flight);
  return (
    <Modal
      title={`${flight.origin} - ${flight.destination}`}
      onClose={onClose}
      width={720}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          Close
        </button>
      }
    >
      <table className="route-segments-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Aircraft</th>
            <th>Aircraft number</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg, i) => (
            <tr key={i}>
              <td>{seg.origin}</td>
              <td>{seg.destination}</td>
              <td>{fmtTimeValue(seg.std)}</td>
              <td>{fmtTimeValue(seg.sta)}</td>
              <td>{seg.aircraftType}</td>
              <td className="mono">{seg.acReg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
