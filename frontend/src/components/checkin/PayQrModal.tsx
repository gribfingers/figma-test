import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";

interface Props {
  /** Who/what this payment is for — a single passenger's name, or a summary like "3 passengers". */
  payerLabel: string;
  /** PNR or another short reference shown under the recipient/purpose line and folded into the QR payload. */
  reference: string;
  amount: number;
  onClose: () => void;
}

// No real payment backend behind this — same "deterministic-looking but made up" approach as
// EmdModal's fake EMD number, just derived from the reference string instead of a passenger id.
function seedFrom(reference: string): number {
  let h = 0;
  for (let i = 0; i < reference.length; i++) h = (h * 31 + reference.charCodeAt(i)) >>> 0;
  return h || 1;
}
function fakeDigits(seed: number, len: number): string {
  const n = (seed * 2654435761) >>> 0;
  return String(n).padStart(len, "0").slice(-len);
}

/** Fake requisites in the same pipe-delimited ST00012 layout Russian banking apps recognize and
 *  render as a payment card (recipient/amount/purpose) — nothing here connects to a real account. */
function fakePayload(payerLabel: string, reference: string, amount: number): string {
  const seed = seedFrom(reference);
  const acc = fakeDigits(seed, 20);
  const corrAcc = fakeDigits(seed + 1, 20);
  const bic = "04452" + fakeDigits(seed + 2, 4);
  const inn = fakeDigits(seed + 3, 10);
  const kopecks = Math.round(amount * 100);
  const fields = [
    "ST00012",
    "Name=OOO Aeroflot-Direkt",
    `PersonalAcc=${acc}`,
    "BankName=AO TEST BANK",
    `BIC=${bic}`,
    `CorrespAcc=${corrAcc}`,
    `PayeeINN=${inn}`,
    `Purpose=Doplata PNR ${reference}, ${payerLabel}`,
    `Sum=${kopecks}`,
  ];
  return fields.join("|");
}

/** QR-code payment card opened from the Cart's "Pay" buttons — encodes made-up requisites (no real
 *  payment system behind it, same spirit as EmdModal's static EMD receipt). */
export function PayQrModal({ payerLabel, reference, amount, onClose }: Props) {
  const { t } = useLanguage();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const payload = fakePayload(payerLabel, reference, amount);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <Modal
      title={t("Pay")}
      onClose={onClose}
      width={360}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          {t("Close")}
        </button>
      }
    >
      <div className="pay-qr">
        <div className="pay-qr-code">
          {dataUrl ? <img src={dataUrl} width={220} height={220} alt="" /> : <div className="pay-qr-code-placeholder" />}
        </div>
        <div className="pay-qr-amount">{amount.toLocaleString("ru-RU")} ₽</div>
        <div className="pay-qr-label">{payerLabel}</div>
        <div className="pay-qr-hint">{t("Scan with a banking app to pay")}</div>
      </div>
    </Modal>
  );
}
