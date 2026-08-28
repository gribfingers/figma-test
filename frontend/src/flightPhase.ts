import { Flight } from "./api";

export interface FlightPhase {
  key: string;
  label: string;
  fromMin: number;
  toMin: number;
}

// Shared by FlightCardHeader's phase-chip strip and the flights board's
// Status column, so the two can't drift apart. Same windows either way:
// no distinct check-in-desk vs. gate timing modeled, just one lifecycle.
export const FLIGHT_PHASES: FlightPhase[] = [
  { key: "checkin", label: "Check-in", fromMin: -180, toMin: -45 },
  { key: "boarding", label: "Boarding", fromMin: -45, toMin: -15 },
  { key: "closing", label: "Closing", fromMin: -15, toMin: -5 },
  { key: "flying", label: "Flying away", fromMin: -5, toMin: 0 },
];

/**
 * Which phase is "current" for this flight, derived from real elapsed time
 * against its own std-relative windows above — not from ops_status, which
 * no UI in this app actually writes yet (FlightStatusSelect's picker is
 * local-only, see FlightCardHeader), so it never leaves its DB default of
 * "SCHEDULED". -1 = before Check-in even opens, FLIGHT_PHASES.length = past
 * every phase (i.e. departed). A cancelled flight isn't progressing through
 * phases at all, so it's always treated as none-reached.
 */
export function currentPhaseIndex(flight: Flight, now: Date): number {
  if (flight.ops_status === "CANCELLED") return -1;
  const base = new Date(flight.std).getTime();
  const nowMs = now.getTime();
  if (nowMs < base + FLIGHT_PHASES[0].fromMin * 60000) return -1;
  for (let i = 0; i < FLIGHT_PHASES.length; i++) {
    if (nowMs < base + FLIGHT_PHASES[i].toMin * 60000) return i;
  }
  return FLIGHT_PHASES.length;
}

/** Same phase index, collapsed to a one-word label + badge tone for the flights board's Status column. */
export function phaseStatusLabel(flight: Flight, now: Date): { label: string; badge: "ok" | "warn" | "muted" | "danger" } {
  if (flight.ops_status === "CANCELLED") return { label: "Cancelled", badge: "danger" };
  const idx = currentPhaseIndex(flight, now);
  if (idx === -1) return { label: "Scheduled", badge: "ok" };
  if (idx === FLIGHT_PHASES.length) return { label: "Departed", badge: "muted" };
  return { label: FLIGHT_PHASES[idx].label, badge: "warn" };
}
