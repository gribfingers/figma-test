import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";

interface Props {
  reference: string;
  onClose: () => void;
}

/** Static payment-confirmation receipt (no billing system behind it) — opened from a carry-on row's "Insert MCO". */
export function McoModal({ reference, onClose }: Props) {
  const { t } = useLanguage();
  return (
    <Modal
      title={t("Insert payment confirmation")}
      onClose={onClose}
      width={420}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          {t("OK")}
        </button>
      }
    >
      <div className="mco-confirm-box">{t("Payment is confirmed. MSO/TKNA #{reference}").replace("{reference}", reference)}</div>
    </Modal>
  );
}
