import { Flight } from "../../api";
import { CloseIcon } from "../Icon";
import { useLanguage } from "../../i18n";

interface ClassCounts {
  C: number;
  Y: number;
}

interface Props {
  flight: Flight;
  checkinTill: string;
  capacity: ClassCounts;
  booked: ClassCounts;
  passBooked: ClassCounts;
  checkedInTotal: number;
  webCheckedInTotal: number;
  boardedTotal: number;
  passengerTotal: number;
  open: boolean;
  onClose: () => void;
}

function BookingRow({ label, c, y }: { label: string; c: number; y: number }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="mono">{c}</td>
      <td className="mono">{y}</td>
      <td className="mono">{c + y}</td>
    </tr>
  );
}

function CheckinCountRow({ label, count, of }: { label: string; count: number; of: number }) {
  const { t } = useLanguage();
  return (
    <div className="flight-info-count-row">
      <span>{label}</span>
      <span className="mono">{count} {t("of")} {of}</span>
    </div>
  );
}

/** Slide-out side panel (same shell as UserPanel/Messenger) opened from the check-in flow's Flight Information nav icon. */
export function FlightInfoPanel({
  flight,
  checkinTill,
  capacity,
  booked,
  passBooked,
  checkedInTotal,
  webCheckedInTotal,
  boardedTotal,
  passengerTotal,
  open,
  onClose,
}: Props) {
  const { t } = useLanguage();
  const available: ClassCounts = { C: capacity.C - booked.C, Y: capacity.Y - booked.Y };

  return (
    <div className={`flight-info-panel-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div className="flight-info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flight-info-panel-header">
          <div>
            <div className="flight-info-panel-flight">{flight.carrier_code}{flight.flight_number}</div>
            <div className="flight-info-panel-route">{flight.origin} → {flight.destination}</div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="flight-info-fields">
          <div className="flight-info-field">
            <span className="flight-info-field-label">{t("Aircraft type")}</span>
            <span className="flight-info-field-value">{flight.aircraft_type}</span>
          </div>
          <div className="flight-info-field">
            <span className="flight-info-field-label">{t("Tail number")}</span>
            <span className="flight-info-field-value mono">{flight.aircraft_reg ?? "—"}</span>
          </div>
          <div className="flight-info-field">
            <span className="flight-info-field-label">{t("Version")}</span>
            <span className="flight-info-field-value mono">{flight.aircraft_version ?? "—"}</span>
          </div>
          <div className="flight-info-field">
            <span className="flight-info-field-label">{t("Check-in till")}</span>
            <span className="flight-info-field-value mono">{checkinTill}</span>
          </div>
          <div className="flight-info-field">
            <span className="flight-info-field-label">{t("Gate")}</span>
            <span className="flight-info-field-value">{flight.gate ?? "—"}</span>
          </div>
        </div>

        <div className="flight-info-section">
          <div className="flight-info-section-title">{t("Booking counts")}</div>
          <table className="flight-info-table">
            <thead>
              <tr>
                <th />
                <th>C</th>
                <th>Y</th>
                <th>{t("Total")}</th>
              </tr>
            </thead>
            <tbody>
              <BookingRow label={t("A/c version")} c={capacity.C} y={capacity.Y} />
              <BookingRow label={t("Seats available")} c={available.C} y={available.Y} />
              <BookingRow label={t("Seats booked")} c={booked.C} y={booked.Y} />
              <BookingRow label={t("Pass booked")} c={passBooked.C} y={passBooked.Y} />
            </tbody>
          </table>
        </div>

        <div className="flight-info-section">
          <div className="flight-info-section-title">{t("Check-in counts")}</div>
          <div className="flight-info-counts">
            <CheckinCountRow label={t("Checked-in")} count={checkedInTotal} of={passengerTotal} />
            <CheckinCountRow label={t("Web checked-in")} count={webCheckedInTotal} of={checkedInTotal} />
            <CheckinCountRow label={t("Boarded")} count={boardedTotal} of={checkedInTotal} />
          </div>
        </div>
      </div>
    </div>
  );
}
