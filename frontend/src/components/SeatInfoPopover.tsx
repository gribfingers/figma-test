import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SeatCell } from "../api";
import {
  SEAT_ATTRS,
  formatSeatDisplay,
  occupantAge,
  parseSeatExtra,
  seatState,
  seatSubtype,
} from "../seatExtra";

const STATE_LABEL: Record<string, string> = { free: "Свободно", checked_in: "Зарегистрирован", boarded: "Посадка выполнена" };
const SUBTYPE_LABEL: Record<string, string> = { presit: "Предрассажен", booked: "Забронировано" };

interface Props {
  seatCell: SeatCell;
  x: number;
  y: number;
  onClose: () => void;
  onOpenHistory: () => void;
}

/**
 * Right-click info popup for a seat in contexts where the attribute editor
 * is disabled (check-in, boarding) — the full property readout the editor
 * would otherwise show, plus a link into the seat's change history.
 */
const MARGIN = 8;

export function SeatInfoPopover({ seatCell, x, y, onClose, onOpenHistory }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, visible: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - rect.width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - rect.height - MARGIN)),
      visible: true,
    });
  }, [x, y]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const extra = parseSeatExtra(seatCell);
  const state = seatState(seatCell);
  const subtype = seatSubtype(extra);
  const age = occupantAge(seatCell);
  const activeAttrs = SEAT_ATTRS.filter((a) => extra[a.key]);

  return (
    <div ref={ref} className="seat-info-popover" style={{ left: pos.left, top: pos.top, visibility: pos.visible ? "visible" : "hidden" }}>
      <div className="seat-info-title">Место {formatSeatDisplay(seatCell.seat)}</div>

      <div className="seatmap-legend-row">
        <span className={`seat seatmap-legend-swatch seat-${state.replace("_", "-")}`} />
        {STATE_LABEL[state]}
      </div>
      {subtype !== "none" && (
        <div className="seatmap-legend-row">
          <span className="seatmap-legend-swatch seat-free-swatch">
            <span className={`seat-subtype-bar seat-subtype-${subtype}`} />
          </span>
          {SUBTYPE_LABEL[subtype]}
        </div>
      )}
      {!!seatCell.exit_row && <div className="seat-info-line">Аварийное (exit row)</div>}

      {seatCell.passenger_id && (
        <div className="seat-info-line">
          {seatCell.surname}/{seatCell.given_name} ({seatCell.record_locator})
          {age != null && ` — ${age} лет`}
        </div>
      )}

      {activeAttrs.length > 0 && (
        <div className="seat-info-attrs">
          {activeAttrs.map((a) => (
            <div key={a.key} className="seatmap-legend-row">
              <a.icon size={14} />
              {a.label}
            </div>
          ))}
        </div>
      )}

      {(extra.price != null || extra.rfisc) && (
        <div className="seat-info-line">
          {extra.price != null && `Цена: ${extra.price}`}
          {extra.price != null && extra.rfisc && " · "}
          {extra.rfisc && `RFISC: ${extra.rfisc}`}
        </div>
      )}

      <button type="button" className="seat-info-history-link" onClick={onOpenHistory}>
        История изменений →
      </button>
    </div>
  );
}
