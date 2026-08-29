import { useEffect, useState } from "react";
import { api, SeatEvent, SeatEventType } from "../api";
import { formatSeatDisplay } from "../seatExtra";
import { Modal } from "./Modal";

const EVENT_LABELS: Record<SeatEventType, string> = {
  assigned: "Место назначено",
  unassigned: "Место снято",
  swapped: "Обмен местами",
  checked_in: "Регистрация",
  checkin_cancelled: "Регистрация отменена",
  boarded: "Посадка",
  offloaded: "Снят с рейса",
  unboarded: "Посадка отменена",
  attrs_updated: "Изменены свойства места",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Right-click seat popover's "История изменений" link opens this — every recorded state change for the seat, newest first. */
export function SeatHistoryModal({ flightId, seat, onClose }: { flightId: number; seat: string; onClose: () => void }) {
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
    <Modal title={`История изменений — место ${formatSeatDisplay(seat)}`} onClose={onClose} width={480}>
      {error && <div className="error-box">{error}</div>}
      {!error && events == null && <div className="muted">Загрузка…</div>}
      {events != null && events.length === 0 && <div className="muted">Изменений не зафиксировано.</div>}
      {events != null && events.length > 0 && (
        <div className="seat-history-list">
          {events.map((e) => (
            <div key={e.id} className="seat-history-row">
              <div className="seat-history-row-head">
                <span className="seat-history-event">{EVENT_LABELS[e.event] ?? e.event}</span>
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
