import { Flight } from "../../api";
import { MAX_SEGMENTS, segmentsForFlight } from "../../flightSegments";

// One leg of the flight's routing, as edited on the Main tab — one
// segment-card per entry. Segment 1 round-trips through the real Flight
// columns (origin/destination/std/sta/terminal) on save; any further
// segments live only in Flight.extra.segments until they get dedicated
// columns, same as the rest of the ad-hoc Main-tab fields below.
export interface SegmentDraft {
  depAirport: string;
  arrAirport: string;
  depDate: string;
  depTime: string;
  arrDate: string;
  arrTime: string;
  terminalFrom: string;
  terminalTo: string;
}

// The Main tab's editable fields, lifted out of the tab so the Save button
// in the header (a sibling) can tell whether anything changed and trigger
// the save. Fields with a real column (terminal, gate, aircraft_reg,
// aircraft_version, origin/destination, std/sta) round-trip through the
// Flight record; the rest live in Flight.extra as JSON until they get
// dedicated columns.
export interface MainDraft {
  aircraftType: string;
  checkinDesk: string;
  gate: string;
  acReg: string;
  seatConfig: string;
  segments: SegmentDraft[];
  comment: string;
  partnerFlight: string;
  agreement: string;
  apis: boolean;
  maxWeight: string;
  checks: Record<string, boolean>;
}

// All flight times are stored and displayed as UTC wall-clock (see the
// timeZone: "UTC" formatting used everywhere else in the flight card) —
// these read/write the same convention, never the browser's local zone.
export function fmtTimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fmtDateValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export const EMPTY_SEGMENT: SegmentDraft = {
  depAirport: "",
  arrAirport: "",
  depDate: "",
  depTime: "",
  arrDate: "",
  arrTime: "",
  terminalFrom: "",
  terminalTo: "",
};

export function draftFromFlight(flight: Flight): MainDraft {
  let extra: Record<string, unknown> = {};
  try {
    extra = flight.extra ? JSON.parse(flight.extra) : {};
  } catch {
    extra = {};
  }
  return {
    aircraftType: flight.aircraft_type,
    checkinDesk: typeof extra.checkinDesk === "string" ? extra.checkinDesk : "",
    gate: flight.gate ?? "",
    acReg: flight.aircraft_reg ?? "",
    seatConfig: flight.aircraft_version ?? "",
    segments: segmentsForFlight(flight).map((s) => ({
      depAirport: s.origin,
      arrAirport: s.destination,
      depDate: fmtDateValue(s.std),
      depTime: fmtTimeValue(s.std),
      arrDate: fmtDateValue(s.sta ?? s.std),
      arrTime: fmtTimeValue(s.sta),
      terminalFrom: s.terminalFrom,
      terminalTo: s.terminalTo,
    })),
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

// Combines an edited date (YYYY-MM-DD) and time-of-day (HH:mm) into a full
// UTC instant, falling back to the matching part of `originalIso` for
// whichever one wasn't touched. Both are parsed as literal UTC digits (no
// browser-local conversion), same convention as fmtTimeValue/fmtDateValue.
export function combineDateAndTime(originalIso: string, dateStr: string, timeStr: string): string {
  const base = new Date(originalIso);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const [year, month, day] = dateMatch
    ? [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])]
    : [base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate()];
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr);
  const [hour, minute] = timeMatch ? [Number(timeMatch[1]), Number(timeMatch[2])] : [base.getUTCHours(), base.getUTCMinutes()];
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return originalIso;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0)).toISOString();
}
