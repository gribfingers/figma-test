import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SeatCell } from "../api";
import {
  allAttrs,
  formatSeatDisplay,
  occupantAge,
  parseSeatExtra,
  seatState,
  seatSubtype,
} from "../seatExtra";
import { useLanguage } from "../i18n";

const STATE_LABEL: Record<string, string> = { free: "Free", checked_in: "Checked-in", boarded: "Boarding complete" };
const SUBTYPE_LABEL: Record<string, string> = { presit: "Pre-seated", booked: "Reserved" };

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
  const { t } = useLanguage();
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
  const activeAttrs = allAttrs(extra);

  return (
    <div ref={ref} className="seat-info-popover" style={{ left: pos.left, top: pos.top, visibility: pos.visible ? "visible" : "hidden" }}>
      <div className="seat-info-title">{t("Seat {seat}").replace("{seat}", formatSeatDisplay(seatCell.seat))}</div>

      <div className="seatmap-legend-row">
        <span className={`seat seatmap-legend-swatch seat-${state.replace("_", "-")}`} />
        {t(STATE_LABEL[state])}
      </div>
      {subtype !== "none" && (
        <div className="seatmap-legend-row">
          <span className="seatmap-legend-swatch seat-free-swatch">
            <span className={`seat-subtype-bar seat-subtype-${subtype}`} />
          </span>
          {t(SUBTYPE_LABEL[subtype])}
        </div>
      )}
      {!!seatCell.exit_row && <div className="seat-info-line">{t("Exit row")}</div>}

      {seatCell.passenger_id && (
        <div className="seat-info-line">
          {seatCell.surname}/{seatCell.given_name} ({seatCell.record_locator})
          {age != null && ` — ${t("{age} y.o.").replace("{age}", String(age))}`}
        </div>
      )}

      {activeAttrs.length > 0 && (
        <div className="seat-info-attrs">
          {activeAttrs.map((a) => (
            <div key={a.key} className="seatmap-legend-row">
              <a.icon size={14} />
              {t(a.label)}
            </div>
          ))}
        </div>
      )}

      {(extra.price != null || extra.rfisc) && (
        <div className="seat-info-line">
          {extra.price != null && `${t("Price")}: ${extra.price}`}
          {extra.price != null && extra.rfisc && " · "}
          {extra.rfisc && `RFISC: ${extra.rfisc}`}
        </div>
      )}

      <button type="button" className="seat-info-history-link" onClick={onOpenHistory}>
        {t("Change history →")}
      </button>
    </div>
  );
}
