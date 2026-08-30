import { Flight } from "./api";
import { FLIGHT_STATUSES, FLIGHT_STATUS_BADGE, OPS_STATUS_UNSET } from "./flightStatuses";

export interface FlightPhase {
  key: string;
  label: string;
  fromMin: number;
  toMin: number;
}

// Shared by FlightCardHeader's phase-chip strip and the flights board's
// Status column, so the two can't drift apart. Same windows either way:
// no distinct check-in-desk vs. gate timing modeled, just one lifecycle.
// Default boundaries — a flight can override them (Settings tab), see
// flightPhases() below; the phase count/order/labels never change, only
// where the boundaries between them fall.
export const FLIGHT_PHASES: FlightPhase[] = [
  { key: "checkin", label: "Check-in", fromMin: -180, toMin: -45 },
  { key: "boarding", label: "Boarding", fromMin: -45, toMin: -15 },
  { key: "closing", label: "Closing", fromMin: -15, toMin: -5 },
  { key: "flying", label: "Flying away", fromMin: -5, toMin: 0 },
];

export interface PhaseOverrides {
  checkinMin: number;
  boardingMin: number;
  closingMin: number;
  flyingMin: number;
}

export const DEFAULT_PHASE_OVERRIDES: PhaseOverrides = {
  checkinMin: FLIGHT_PHASES[0].fromMin,
  boardingMin: FLIGHT_PHASES[1].fromMin,
  closingMin: FLIGHT_PHASES[2].fromMin,
  flyingMin: FLIGHT_PHASES[3].fromMin,
};

/** Reads a flight's own check-in/boarding/closing window overrides (Settings tab) out of Flight.extra, falling back to the defaults above. */
export function phaseOverridesFromFlight(flight: Flight): PhaseOverrides {
  let extra: Record<string, unknown> = {};
  try {
    extra = flight.extra ? JSON.parse(flight.extra) : {};
  } catch {
    extra = {};
  }
  const o = (extra.phaseOverrides ?? {}) as Partial<PhaseOverrides>;
  return {
    checkinMin: typeof o.checkinMin === "number" ? o.checkinMin : DEFAULT_PHASE_OVERRIDES.checkinMin,
    boardingMin: typeof o.boardingMin === "number" ? o.boardingMin : DEFAULT_PHASE_OVERRIDES.boardingMin,
    closingMin: typeof o.closingMin === "number" ? o.closingMin : DEFAULT_PHASE_OVERRIDES.closingMin,
    flyingMin: typeof o.flyingMin === "number" ? o.flyingMin : DEFAULT_PHASE_OVERRIDES.flyingMin,
  };
}

/** This flight's real phase windows — same shape as FLIGHT_PHASES, but with its own overrides (if any) applied. */
export function flightPhases(flight: Flight): FlightPhase[] {
  const o = phaseOverridesFromFlight(flight);
  return [
    { key: "checkin", label: "Check-in", fromMin: o.checkinMin, toMin: o.boardingMin },
    { key: "boarding", label: "Boarding", fromMin: o.boardingMin, toMin: o.closingMin },
    { key: "closing", label: "Closing", fromMin: o.closingMin, toMin: o.flyingMin },
    { key: "flying", label: "Flying away", fromMin: o.flyingMin, toMin: 0 },
  ];
}

/**
 * Which phase is "current" for this flight, derived from real elapsed time
 * against its own std-relative windows above — purely a timeline position,
 * independent of any manually-set ops_status (see phaseStatusLabel below for
 * where a manual status takes over the flights board's actual Status
 * column). -1 = before Check-in even opens, FLIGHT_PHASES.length = past
 * every phase (i.e. departed). A cancelled flight isn't progressing through
 * phases at all, so it's always treated as none-reached.
 */
export function currentPhaseIndex(flight: Flight, now: Date): number {
  if (flight.ops_status === "canceled_no_host") return -1;
  const phases = flightPhases(flight);
  const base = new Date(flight.std).getTime();
  const nowMs = now.getTime();
  if (nowMs < base + phases[0].fromMin * 60000) return -1;
  for (let i = 0; i < phases.length; i++) {
    if (nowMs < base + phases[i].toMin * 60000) return i;
  }
  return phases.length;
}

/**
 * The flights board's Status column: once an agent has set a real status via
 * FlightCardHeader's FlightStatusSelect (ops_status is no longer its DB
 * default, OPS_STATUS_UNSET), that manual status is shown — it's what the
 * agent declared, an automatic time-guess would just be wrong. Otherwise
 * falls back to the same time-based phase computation as before.
 */
export function phaseStatusLabel(flight: Flight, now: Date): { label: string; badge: "ok" | "warn" | "muted" | "danger" } {
  if (flight.ops_status && flight.ops_status !== OPS_STATUS_UNSET) {
    const manual = FLIGHT_STATUSES.find((s) => s.key === flight.ops_status);
    if (manual) return { label: manual.labelEn, badge: FLIGHT_STATUS_BADGE[manual.key] ?? "muted" };
  }
  const idx = currentPhaseIndex(flight, now);
  if (idx === -1) return { label: "Scheduled", badge: "ok" };
  if (idx === FLIGHT_PHASES.length) return { label: "Departed", badge: "muted" };
  return { label: flightPhases(flight)[idx].label, badge: "warn" };
}

/** A reasonable FLIGHT_STATUSES key matching this flight's current time-based phase — used to seed FlightStatusSelect's display before any manual override exists. */
export function phaseBasedStatusKey(flight: Flight, now: Date): string {
  const idx = currentPhaseIndex(flight, now);
  if (idx === -1) return "active_not_open";
  if (idx === FLIGHT_PHASES.length) return "take_off";
  if (idx <= 1) return "open"; // checkin or boarding
  return "gate_closed"; // closing or flying-away
}

/**
 * Whether the Main tab should be locked read-only (see FlightCard.tsx) — a
 * departed flight's own record shouldn't change anymore. An explicit manual
 * status (see FlightCardHeader) always wins over the time guess: "Take Off"
 * means departed even if a delay pushed real time past std, and any other
 * manual status means the agent is deliberately holding it as not-yet-departed.
 */
export function isFlightDeparted(flight: Flight, now: Date): boolean {
  if (flight.ops_status === "take_off") return true;
  if (flight.ops_status && flight.ops_status !== OPS_STATUS_UNSET) return false;
  return currentPhaseIndex(flight, now) === FLIGHT_PHASES.length;
}
