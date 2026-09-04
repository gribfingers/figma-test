import { useState } from "react";
import { Passenger } from "../../api";
import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";
import { clickable } from "../../interactive";

interface Props {
  passengers: Passenger[];
  onConfirm: (target: Passenger) => void;
  onClose: () => void;
}

/** Opened by the Baggage row's "Transfer to another passenger" link — picks another checked-in passenger on this PNR. */
export function TransferBagModal({ passengers, onConfirm, onClose }: Props) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = passengers.find((p) => p.id === selectedId) ?? null;
  return (
    <Modal
      title={t("Transfer bag to")}
      onClose={onClose}
      width={420}
      footer={
        <button type="button" className="tertiary" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
          {t("OK")}
        </button>
      }
    >
      <div className="transfer-passenger-list">
        {passengers.map((p) => (
          <div
            key={p.id}
            className={`transfer-passenger-item ${p.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(p.id)}
            {...clickable(() => setSelectedId(p.id), "option")}
          >
            {p.surname} {p.given_name}
          </div>
        ))}
      </div>
    </Modal>
  );
}
