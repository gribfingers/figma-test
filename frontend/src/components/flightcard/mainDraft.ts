import { Flight } from "../../api";

// The Main tab's editable fields, lifted out of the tab so the Save button
// in the header (a sibling) can tell whether anything changed and trigger
// the save. Fields with a real column (terminal, gate, aircraft_reg,
// aircraft_version, origin/destination, std/sta time-of-day) round-trip
// through the Flight record; the rest live in Flight.extra as JSON until
// they get dedicated columns.
export interface MainDraft {
  terminalFrom: string;
  terminalTo: string;
  checkinDesk: string;
  gate: string;
  acReg: string;
  seatConfig: string;
  depAirport: string;
  arrAirport: string;
  depTime: string;
  arrTime: string;
  comment: string;
  partnerFlight: string;
  agreement: string;
  apis: boolean;
  maxWeight: string;
  checks: Record<string, boolean>;
}

export function fmtTimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function draftFromFlight(flight: Flight): MainDraft {
  let extra: Record<string, unknown> = {};
  try {
    extra = flight.extra ? JSON.parse(flight.extra) : {};
  } catch {
    extra = {};
  }
  return {
    terminalFrom: flight.terminal ?? "",
    terminalTo: typeof extra.terminalTo === "string" ? extra.terminalTo : "",
    checkinDesk: typeof extra.checkinDesk === "string" ? extra.checkinDesk : "",
    gate: flight.gate ?? "",
    acReg: flight.aircraft_reg ?? "",
    seatConfig: flight.aircraft_version ?? "",
    depAirport: flight.origin,
    arrAirport: flight.destination,
    depTime: fmtTimeValue(flight.std),
    arrTime: fmtTimeValue(flight.sta),
    comment: typeof extra.comment === "string" ? extra.comment : "",
    partnerFlight: typeof extra.partnerFlight === "string" ? extra.partnerFlight : "",
    agreement: typeof extra.agreement === "string" ? extra.agreement : "codeshare",
    apis: extra.apis === true,
    maxWeight: typeof extra.maxWeight === "string" ? extra.maxWeight : "",
    checks:
      extra.checks && typeof extra.checks === "object" ? (extra.checks as Record<string, boolean>) : {},
  };
}

export function draftsEqual(a: MainDraft, b: MainDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Applies a draft's edited time-of-day (HH:mm) onto an existing ISO
// timestamp's date, so editing "Time" doesn't require also collecting a date.
export function combineDateAndTime(originalIso: string, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return originalIso;
  const d = new Date(originalIso);
  d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
}
