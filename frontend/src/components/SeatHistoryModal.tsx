import { useEffect, useState } from "react";
import { api, SeatEvent, SeatEventType } from "../api";
import { formatSeatDisplay } from "../seatExtra";
import { Modal } from "./Modal";
import { useLanguage } from "../i18n";

const EVENT_LABELS: Record<SeatEventType, string> = {
  assigned: "Seat assigned",
  unassigned: "Seat unassigned",
  swapped: "Seat swapped",
  checked_in: "Passenger checked in",
  checkin_cancelled: "Check-in cancelled",
  boarded: "Boarded",
  offloaded: "Offloaded",
  unboarded: "Boarding undone",
  attrs_updated: "Seat attributes updated",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Right-click seat popover's "История изменений" link opens this — every recorded state change for the seat, newest first. */
export function SeatHistoryModal({ flightId, seat, onClose }: { flightId: number; seat: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<SeatEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .seatHistory(flightId, seat)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((e: any) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [flightId, seat]);

  return (
    <Modal title={t("Seat history — {seat}").replace("{seat}", formatSeatDisplay(seat))} onClose={onClose} width={480}>
      {error && <div className="error-box">{error}</div>}
      {!error && events == null && <div className="muted">{t("Loading…")}</div>}
      {events != null && events.length === 0 && <div className="muted">{t("No changes recorded.")}</div>}
      {events != null && events.length > 0 && (
        <div className="seat-history-list">
          {events.map((e) => (
            <div key={e.id} className="seat-history-row">
              <div className="seat-history-row-head">
                <span className="seat-history-event">{t(EVENT_LABELS[e.event] ?? e.event)}</span>
                <span className="seat-history-time">{formatDateTime(e.created_at)}</span>
              </div>
              {e.detail && <div className="seat-history-detail">{e.detail}</div>}
              {e.actor && <div className="seat-history-actor">{e.actor}</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
