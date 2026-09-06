import { Flight } from "./types";

/**
 * Backend port of frontend/src/flightPhase.ts's isFlightDeparted (no shared
 * package between frontend/backend in this repo, so kept in sync by hand).
 *
 * The DCS lifecycle column `flights.status` (SCHEDULED/CHECKIN_OPEN/BOARDING/
 * CLOSED/DEPARTED) is only ever advanced by an agent action (Start boarding,
 * Close flight) — nothing transitions it to DEPARTED automatically once std
 * has passed, so a flight can sit at CHECKIN_OPEN indefinitely after it has
 * actually left, silently accepting new check-ins/boardings. This mirrors
 * the flights board's own real-time-based "Departed" cutoff instead: past
 * every phase window (checkin/boarding/closing/flying), i.e. now >= std —
 * the frontend's last phase's `toMin` is always exactly 0, so unlike the
 * earlier phase boundaries it isn't affected by a flight's own phase-window
 * overrides. An explicit manual ops_status wins over the time guess, same
 * as the frontend: "Take Off" always means departed (even before std, for a
 * flight that left early), any other manual status means the agent is
 * deliberately holding it as not-yet-departed.
 */
export function isFlightDeparted(flight: Pick<Flight, "ops_status" | "std">, now: Date = new Date()): boolean {
  if (flight.ops_status === "take_off") return true;
  if (flight.ops_status && flight.ops_status !== "SCHEDULED") return false;
  return now.getTime() >= new Date(flight.std).getTime();
}
