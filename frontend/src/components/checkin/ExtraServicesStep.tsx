import { useState } from "react";
import { Flight, Passenger } from "../../api";
import { FlightSegment } from "../../flightSegments";
import { SeatServiceItem } from "../../paxExtra";
import { SegmentsMultiSelect } from "../SegmentsMultiSelect";
import { EXTRA_SERVICE_GROUPS } from "../../extraServiceTypes";
import { MinusIcon, PlusIcon } from "../Icon";
import { EmdModal } from "./EmdModal";
import { useLanguage } from "../../i18n";

interface RowState {
  segments: Set<number>;
  qty: number;
  confirmed: { price: number; paid: boolean } | null;
}

interface Props {
  flight: Flight;
  passenger: Passenger;
  segments: FlightSegment[];
  /** Fires with the full list of confirmed services whenever it changes — the roster card's chips mirror this live. */
  onConfirmedChange: (items: SeatServiceItem[]) => void;
}

function defaultRow(segments: FlightSegment[]): RowState {
  return { segments: new Set(segments.length ? [0] : []), qty: 1, confirmed: null };
}

const ALL_OPTIONS = EXTRA_SERVICE_GROUPS.flatMap((g) => g.options);

function confirmedItems(rows: Record<string, RowState>, t: (text: string) => string): SeatServiceItem[] {
  return ALL_OPTIONS.filter((o) => rows[o.id]?.confirmed).map((o) => ({
    rfisc: o.code,
    label: t(o.label),
    price: rows[o.id].confirmed!.price,
    paid: rows[o.id].confirmed!.paid,
  }));
}

/**
 * The check-in flow's Extra services step: the full service list (grouped
 * by Seats/Baggage/Other) with a checkbox on each row — checking one reveals
 * its segment picker (multi-segment flights only), a quantity stepper, and
 * Confirm; confirming swaps that button for the price (click to see the
 * EMD). Unchecking clears the row back to its default state.
 */
export function ExtraServicesStep({ flight, passenger, segments, onConfirmedChange }: Props) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [emdItem, setEmdItem] = useState<SeatServiceItem | null>(null);

  function toggle(id: string, checked: boolean) {
    if (checked) {
      setRows((prev) => ({ ...prev, [id]: defaultRow(segments) }));
      return;
    }
    setRows((prev) => {
      const next = { ...prev };
      delete next[id];
      onConfirmedChange(confirmedItems(next, t));
      return next;
    });
  }
  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }
  function confirmRow(id: string) {
    const row = rows[id];
    if (!row) return;
    const price = 12500 * row.qty;
    // Confirmed right now, in this check-in session — never something carried over already paid
    // at booking, so it's always unpaid until settled through the Cart's Pay flow.
    const paid = false;
    setRows((prev) => {
      const next = { ...prev, [id]: { ...prev[id], confirmed: { price, paid } } };
      onConfirmedChange(confirmedItems(next, t));
      return next;
    });
  }

  return (
    <div className="extra-services-step">
      <div className="extra-services-groups">
        {EXTRA_SERVICE_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="extra-service-group-label">{t(g.group)}</div>
            {g.options.map((o) => {
              const row = rows[o.id];
              const checked = !!row;
              return (
                <div key={o.id} className="extra-service-row">
                  <label className="extra-service-checkbox">
                    <input type="checkbox" checked={checked} onChange={(e) => toggle(o.id, e.target.checked)} />
                    <span className="mono">{o.code}</span> {t(o.label)}
                  </label>
                  {row && (
                    <div className="extra-service-row-controls">
                      {segments.length > 1 && (
                        <SegmentsMultiSelect
                          segments={segments}
                          selected={row.segments}
                          onChange={(sel) => updateRow(o.id, { segments: sel })}
                        />
                      )}
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          disabled={row.qty <= 1}
                          onClick={() => updateRow(o.id, { qty: Math.max(1, row.qty - 1) })}
                          aria-label={t("Decrease")}
                        >
                          <MinusIcon size={14} />
                        </button>
                        <span className="qty-stepper-value">{row.qty}</span>
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          onClick={() => updateRow(o.id, { qty: row.qty + 1 })}
                          aria-label={t("Increase")}
                        >
                          <PlusIcon size={14} />
                        </button>
                      </div>
                      {row.confirmed ? (
                        <button
                          type="button"
                          className={`extra-service-item-price ${row.confirmed.paid ? "paid" : "unpaid"}`}
                          onClick={() => setEmdItem({ rfisc: o.code, label: t(o.label), price: row.confirmed!.price, paid: row.confirmed!.paid })}
                        >
                          {row.confirmed.price.toLocaleString("ru-RU")} ₽
                        </button>
                      ) : (
                        <button type="button" className="tertiary" onClick={() => confirmRow(o.id)}>{t("Confirm")}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {emdItem && <EmdModal flight={flight} passenger={passenger} item={emdItem} onClose={() => setEmdItem(null)} />}
    </div>
  );
}
