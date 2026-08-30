import { Passenger, SeatCell } from "../../api";
import { BagRow } from "../../baggageTypes";
import { SeatServiceItem, baggageServiceItemsForRows, seatServiceItemsForSeat } from "../../paxExtra";
import { CloseIcon } from "../Icon";
import { useLanguage } from "../../i18n";

interface Props {
  passengers: Passenger[];
  seatByCode: Map<string, SeatCell>;
  /** This passenger's real bag rows from the Baggage step — same data the roster card shows. */
  baggageRows: Record<number, BagRow[]>;
  baggageCalculated: Set<number>;
  /** Extra services actually confirmed on the Extra services step — same data the roster card shows. */
  confirmedServices: Record<number, SeatServiceItem[]>;
  open: boolean;
  onClose: () => void;
}

function sum(items: SeatServiceItem[]): number {
  return items.reduce((total, item) => total + (item.price ?? 0), 0);
}

function CartLine({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`cart-line ${bold ? "cart-line-total" : ""}`}>
      <span className="cart-line-label">{label}</span>
      <span className="cart-line-leader" />
      <span className="cart-line-value">{amount.toLocaleString("ru-RU")} ₽</span>
    </div>
  );
}

/** Slide-out side panel (same shell as FlightInfoPanel, but from the left) opened from the check-in flow's Cart nav icon. */
export function CartPanel({ passengers, seatByCode, baggageRows, baggageCalculated, confirmedServices, open, onClose }: Props) {
  const { t } = useLanguage();
  const rows = passengers.map((p) => {
    const seat = sum(seatServiceItemsForSeat(p.seat ? seatByCode.get(p.seat) : undefined));
    const baggage = sum(baggageServiceItemsForRows(p.id, baggageRows[p.id] ?? [], baggageCalculated.has(p.id)));
    const ancillaries = sum(confirmedServices[p.id] ?? []);
    return { passenger: p, seat, baggage, ancillaries, total: seat + baggage + ancillaries };
  });
  const grandTotal = rows.reduce((total, r) => total + r.total, 0);

  return (
    <div className={`cart-panel-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cart-panel-header">
          <div className="cart-panel-title">{t("Cart")}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="cart-panel-body">
          {rows.map((r) => (
            <div key={r.passenger.id} className="cart-passenger">
              <div className="cart-passenger-name">{r.passenger.surname} {r.passenger.given_name}</div>
              {r.total > 0 ? (
                <>
                  {r.seat > 0 && <CartLine label={t("Seat")} amount={r.seat} />}
                  {r.baggage > 0 && <CartLine label={t("Baggage")} amount={r.baggage} />}
                  {r.ancillaries > 0 && <CartLine label={t("Ancillaries")} amount={r.ancillaries} />}
                  <CartLine label={t("Total")} amount={r.total} bold />
                  <div className="cart-passenger-pay">
                    <button type="button" className="tertiary">{t("Pay")}</button>
                  </div>
                </>
              ) : (
                <CartLine label={t("Total")} amount={0} bold />
              )}
            </div>
          ))}
        </div>

        <div className="cart-panel-footer">
          <CartLine label={t("Total")} amount={grandTotal} bold />
          <button type="button" disabled={grandTotal === 0}>{t("Pay")}</button>
        </div>
      </div>
    </div>
  );
}
