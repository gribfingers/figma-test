import { Modal } from "../Modal";
import { useLanguage } from "../../i18n";

interface Props {
  carrierCode: string;
  onClose: () => void;
}

/** Static baggage-allowance boilerplate (no fare-rules engine behind it) — opened from the roster card's info icon. */
export function FaresInfoModal({ carrierCode, onClose }: Props) {
  const { t } = useLanguage();
  const text = `${carrierCode} airline's checked baggage allowance applies
Free baggage allowance 2PC
1ST checked bag:        UPTO50LB 23KG AND80LI 203LCM (0GP)
                 or SPORTING EQUIPMENT 23KG (053)
                 or SPORT FIREARMS UP TO 50LB 23KG (0HW)
2ND checked bag:        UPTO50LB 23KG AND80LI 203LCM (0GP)
                 or SPORTING EQUIPMENT 23KG (053)
                 or SPORT FIREARMS UP TO 50LB 23KG (0HW)
Free baggage exception:  WHEELCHAIR (0GM)
                 and STROLLER OR PUSHCHAIR (0F4)
                 and ADD FREE BAG TAG (0JX)
${carrierCode} airline's cabin baggage allowance applies
Carry-on bag 1PC
1ST carry bag:        CARRY10KG 22LB 55L X 40W X 25H (08A)
                 ${carrierCode} WILL ACCEPT ONE PIECE OF CARRY ON BAGGAGE UP
                 TO 10 KG/33LB NOT EXCEEDING 55 CM IN LENGTH 40 CM
                 IN WIDTH AND 25 CM IN HEIGHT.
                 PLEASE VISIT WWW.AEROFLOT.RU FOR FULL
                 DETAILS OF ${carrierCode} HAND BAGGAGE POLICY.`;

  return (
    <Modal
      title={t("Passenger Fares Info")}
      onClose={onClose}
      width={560}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          {t("Close")}
        </button>
      }
    >
      <pre className="fares-info-text">{text}</pre>
    </Modal>
  );
}
