import { Flight } from "../../api";
import { segmentsForFlight } from "../../flightSegments";
import { fmtTimeValue } from "../flightcard/mainDraft";
import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";

interface Props {
  flight: Flight;
  onClose: () => void;
}

/** Leg-by-leg routing breakdown — opened by clicking the header's route text. */
export function RouteSegmentsModal({ flight, onClose }: Props) {
  const { t } = useLanguage();
  const segments = segmentsForFlight(flight);
  return (
    <Modal
      title={`${flight.origin} - ${flight.destination}`}
      onClose={onClose}
      width={720}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          {t("Close")}
        </button>
      }
    >
      <table className="route-segments-table">
        <thead>
          <tr>
            <th>{t("From")}</th>
            <th>{t("To")}</th>
            <th>{t("Departure")}</th>
            <th>{t("Arrival")}</th>
            <th>{t("Aircraft")}</th>
            <th>{t("Aircraft number")}</th>
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
