import { useState } from "react";
import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";

interface Props {
  initial: string;
  onConfirm: (tag: string) => void;
  onClose: () => void;
}

/** Opened by the Baggage row's "Tag manually" link — types over whatever tag number would otherwise get auto-assigned at print. */
export function TagManualModal({ initial, onConfirm, onClose }: Props) {
  const { t } = useLanguage();
  const [value, setValue] = useState(initial);
  return (
    <Modal
      title={t("Insert tag number manually")}
      onClose={onClose}
      width={420}
      footer={
        <button type="button" className="tertiary" onClick={() => onConfirm(value)}>
          {t("OK")}
        </button>
      }
    >
      <div className="field2">
        <input
          autoFocus
          value={value}
          placeholder=" "
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <label>{t("Tag number")}</label>
      </div>
    </Modal>
  );
}
