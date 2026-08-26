import { Modal } from "../Modal";

interface Props {
  reference: string;
  onClose: () => void;
}

/** Static payment-confirmation receipt (no billing system behind it) — opened from a carry-on row's "Insert MCO". */
export function McoModal({ reference, onClose }: Props) {
  return (
    <Modal
      title="Insert payment confirmation"
      onClose={onClose}
      width={420}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          OK
        </button>
      }
    >
      <div className="mco-confirm-box">Payment is confirmed. MSO/TKNA #{reference}</div>
    </Modal>
  );
}
