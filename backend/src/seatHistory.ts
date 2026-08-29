import { db } from "./db";

export type SeatEventType =
  | "assigned"
  | "unassigned"
  | "swapped"
  | "checked_in"
  | "checkin_cancelled"
  | "boarded"
  | "offloaded"
  | "unboarded"
  | "attrs_updated";

const insertSeatEvent = db.prepare(
  `INSERT INTO seat_events (flight_id, seat, event, detail, user_id) VALUES (?, ?, ?, ?, ?)`
);

/** Records one row in a seat's state-change history — see seat_events in db.ts. */
export function logSeatEvent(
  flightId: number,
  seat: string,
  event: SeatEventType,
  detail: string | null,
  userId: number | null
) {
  insertSeatEvent.run(flightId, seat, event, detail, userId);
}

export interface SeatEventRow {
  id: number;
  event: SeatEventType;
  detail: string | null;
  created_at: string;
  actor: string | null;
}

const selectSeatEvents = db.prepare(
  `SELECT e.id, e.event, e.detail, e.created_at,
          CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS actor
   FROM seat_events e LEFT JOIN users u ON u.id = e.user_id
   WHERE e.flight_id = ? AND e.seat = ?
   ORDER BY e.id DESC`
);

export function getSeatHistory(flightId: number, seat: string): SeatEventRow[] {
  return selectSeatEvents.all(flightId, seat) as SeatEventRow[];
}
