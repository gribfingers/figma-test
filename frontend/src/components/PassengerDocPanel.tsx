import { api, Passenger } from "../api";
import { parsePassengerExtra } from "../paxExtra";
import { CloseIcon } from "./Icon";
import { useLanguage } from "../i18n";

const DOC_TYPE_LABELS: Record<string, string> = { P: "Passport", V: "Visa", ID: "ID card" };

/** "1980-12-22" -> "22.12.1980"; blank/invalid input stays blank. */
function fmtDMY(date: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

interface Props {
  flightId: number;
  passenger: Passenger;
  open: boolean;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}

/**
 * Slide-out side panel (same shell as UserPanel) showing a passenger's
 * primary ID document — opened by clicking their name wherever it appears
 * as a link. Confirm marks the document verified, same as the Documents
 * step's own "Verify docs" action.
 */
export function PassengerDocPanel({ flightId, passenger, open, onClose, onUpdated }: Props) {
  const { t } = useLanguage();
  const extra = parsePassengerExtra(passenger);
  const fullName = [passenger.surname, passenger.given_name, passenger.middle_name].filter(Boolean).join(" ");

  async function confirm() {
    const updated = await api.updatePassenger(flightId, passenger.id, {
      extra: JSON.stringify({ ...extra, docVerified: true }),
    });
    onUpdated(updated);
    onClose();
  }

  return (
    <div className={`pax-doc-panel-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div className="pax-doc-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pax-doc-panel-header">
          <div className="pax-doc-panel-name">{fullName}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="pax-doc-fields">
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Document Type")}</span>
            <span className="pax-doc-field-value">{t(DOC_TYPE_LABELS[passenger.document_type ?? ""] ?? passenger.document_type ?? "—")}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Document Number")}</span>
            <span className="pax-doc-field-value mono">{passenger.document_number ?? "—"}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Valid Till")}</span>
            <span className="pax-doc-field-value">{fmtDMY(passenger.doc_expiry)}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Issue Country")}</span>
            <span className="pax-doc-field-value">{passenger.nationality ?? "—"}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Name")}</span>
            <span className="pax-doc-field-value">{fullName}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Birth Date")}</span>
            <span className="pax-doc-field-value">{fmtDMY(passenger.dob)}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Gender")}</span>
            <span className="pax-doc-field-value">{passenger.gender ?? "—"}</span>
          </div>
          <div className="pax-doc-field">
            <span className="pax-doc-field-label">{t("Nationality")}</span>
            <span className="pax-doc-field-value">{passenger.nationality ?? "—"}</span>
          </div>
        </div>

        <button type="button" className="pax-doc-confirm-btn" onClick={confirm}>{t("Confirm")}</button>
      </div>
    </div>
  );
}
