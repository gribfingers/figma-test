import { useRef, useState } from "react";
import { Flight, Passenger } from "../../api";
import { FlightSegment } from "../../flightSegments";
import { SeatServiceItem } from "../../paxExtra";
import { SegmentsMultiSelect } from "../SegmentsMultiSelect";
import { SelectHandle } from "../Select";
import { EXTRA_SERVICE_GROUPS, ExtraServiceOption } from "../../extraServiceTypes";
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

interface RowProps {
  option: ExtraServiceOption;
  row: RowState | undefined;
  segments: FlightSegment[];
  t: (text: string) => string;
  onToggle: (checked: boolean) => void;
  onUpdate: (patch: Partial<RowState>) => void;
  onConfirm: () => void;
  onShowEmd: () => void;
}

/**
 * One service row. Checking it (a real checkbox — always Tab/keyboard-reachable regardless of
 * Safari's Full Keyboard Access setting) reveals its own controls, none of which are text inputs —
 * so, same as BaggageStep's row, the checkbox and every revealed control chain to each other via
 * ArrowLeft/ArrowRight and an explicit `.focus()` instead of depending on Tab to reach them.
 */
function ExtraServiceRow({ option: o, row, segments, t, onToggle, onUpdate, onConfirm, onShowEmd }: RowProps) {
  const checked = !!row;
  const hasSegPicker = segments.length > 1;
  const checkboxRef = useRef<HTMLInputElement>(null);
  const segRef = useRef<SelectHandle>(null);
  const minusRef = useRef<HTMLButtonElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // The minus button is disabled at qty 1 (the default), and a disabled button can't take focus —
  // so any hop that would land there skips straight to plus instead.
  function focusMinusOrPlus() {
    if (row && row.qty > 1) minusRef.current?.focus();
    else plusRef.current?.focus();
  }
  function focusFirst() {
    if (hasSegPicker) segRef.current?.focus();
    else focusMinusOrPlus();
  }

  return (
    <div className="extra-service-row">
      <label className="extra-service-checkbox">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          onKeyDown={(e) => {
            if (checked && e.key === "ArrowRight") {
              e.preventDefault();
              focusFirst();
            }
          }}
        />
        <span className="mono">{o.code}</span> {t(o.label)}
      </label>
      {row && (
        <div className="extra-service-row-controls">
          {hasSegPicker && (
            <div
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  focusMinusOrPlus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  checkboxRef.current?.focus();
                }
              }}
            >
              <SegmentsMultiSelect ref={segRef} segments={segments} selected={row.segments} onChange={(sel) => onUpdate({ segments: sel })} />
            </div>
          )}
          <div className="qty-stepper">
            <button
              ref={minusRef}
              type="button"
              className="qty-stepper-btn"
              disabled={row.qty <= 1}
              onClick={() => onUpdate({ qty: Math.max(1, row.qty - 1) })}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  plusRef.current?.focus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  if (hasSegPicker) segRef.current?.focus();
                  else checkboxRef.current?.focus();
                }
              }}
              aria-label={t("Decrease")}
            >
              <MinusIcon size={14} />
            </button>
            <span className="qty-stepper-value">{row.qty}</span>
            <button
              ref={plusRef}
              type="button"
              className="qty-stepper-btn"
              onClick={() => onUpdate({ qty: row.qty + 1 })}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  actionRef.current?.focus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  if (row.qty > 1) minusRef.current?.focus();
                  else if (hasSegPicker) segRef.current?.focus();
                  else checkboxRef.current?.focus();
                }
              }}
              aria-label={t("Increase")}
            >
              <PlusIcon size={14} />
            </button>
          </div>
          {row.confirmed ? (
            <button
              ref={actionRef}
              type="button"
              className={`extra-service-item-price ${row.confirmed.paid ? "paid" : "unpaid"}`}
              onClick={onShowEmd}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  plusRef.current?.focus();
                }
              }}
            >
              {row.confirmed.price.toLocaleString("ru-RU")} ₽
            </button>
          ) : (
            <button
              ref={actionRef}
              type="button"
              className="tertiary"
              onClick={onConfirm}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  plusRef.current?.focus();
                }
              }}
            >
              {t("Confirm")}
            </button>
          )}
        </div>
      )}
    </div>
  );
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
            {g.options.map((o) => (
              <ExtraServiceRow
                key={o.id}
                option={o}
                row={rows[o.id]}
                segments={segments}
                t={t}
                onToggle={(checked) => toggle(o.id, checked)}
                onUpdate={(patch) => updateRow(o.id, patch)}
                onConfirm={() => confirmRow(o.id)}
                onShowEmd={() => {
                  const row = rows[o.id];
                  if (row?.confirmed) setEmdItem({ rfisc: o.code, label: t(o.label), price: row.confirmed.price, paid: row.confirmed.paid });
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {emdItem && <EmdModal flight={flight} passenger={passenger} item={emdItem} onClose={() => setEmdItem(null)} />}
    </div>
  );
}
