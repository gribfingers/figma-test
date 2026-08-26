import { Flight } from "./api";

/** One leg of a (possibly multi-stop) flight's routing, including the aircraft/gate/desk fields specific to that leg. std/sta are full ISO instants, same UTC-wall-clock convention as Flight.std/sta. */
export interface FlightSegment {
  origin: string;
  destination: string;
  std: string;
  sta: string | null;
  terminalFrom: string;
  terminalTo: string;
  aircraftType: string;
  checkinDesk: string;
  gate: string;
  acReg: string;
  seatConfig: string;
}

/** Up to 4 legs per flight (e.g. SVX-LED-PEE-VVO is 3 stops). */
export const MAX_SEGMENTS = 4;

/**
 * Segment 1 always mirrors the flight's real origin/destination/std/sta/
 * terminal/aircraft_type/gate/aircraft_reg/aircraft_version columns (so
 * search, the seatmap, PNL/PFS, and the flights board keep working
 * unchanged); segments 2-4, when present, live only in Flight.extra.segments
 * until they get dedicated columns — same pattern as the rest of the ad-hoc
 * Main-tab fields (see mainDraft.ts).
 */
export function segmentsForFlight(flight: Flight): FlightSegment[] {
  const first: FlightSegment = {
    origin: flight.origin,
    destination: flight.destination,
    std: flight.std,
    sta: flight.sta,
    terminalFrom: flight.terminal ?? "",
    terminalTo: "",
    aircraftType: flight.aircraft_type,
    checkinDesk: "",
    gate: flight.gate ?? "",
    acReg: flight.aircraft_reg ?? "",
    seatConfig: flight.aircraft_version ?? "",
  };
  if (!flight.extra) return [first];
  try {
    const parsed = JSON.parse(flight.extra);
    const stored = parsed.segments;
    if (!Array.isArray(stored) || stored.length === 0) return [first];
    first.terminalTo = typeof stored[0]?.terminalTo === "string" ? stored[0].terminalTo : "";
    first.checkinDesk = typeof stored[0]?.checkinDesk === "string" ? stored[0].checkinDesk : "";
    const rest: FlightSegment[] = stored
      .slice(1, MAX_SEGMENTS)
      .filter((s): s is FlightSegment => s && typeof s.origin === "string" && typeof s.destination === "string")
      .map((s) => ({
        origin: s.origin,
        destination: s.destination,
        std: typeof s.std === "string" ? s.std : flight.std,
        sta: typeof s.sta === "string" ? s.sta : null,
        terminalFrom: typeof s.terminalFrom === "string" ? s.terminalFrom : "",
        terminalTo: typeof s.terminalTo === "string" ? s.terminalTo : "",
        aircraftType: typeof s.aircraftType === "string" ? s.aircraftType : first.aircraftType,
        checkinDesk: typeof s.checkinDesk === "string" ? s.checkinDesk : "",
        gate: typeof s.gate === "string" ? s.gate : "",
        acReg: typeof s.acReg === "string" ? s.acReg : "",
        seatConfig: typeof s.seatConfig === "string" ? s.seatConfig : "",
      }));
    return [first, ...rest];
  } catch {
    return [first];
  }
}

/** Compact route label for tables: "SVO → LED" for a single segment, "SVO → ... → VVO" once there are more. */
export function routeLabel(flight: Flight): string {
  const segments = segmentsForFlight(flight);
  if (segments.length <= 1) return `${flight.origin} → ${flight.destination}`;
  return `${segments[0].origin} → ... → ${segments[segments.length - 1].destination}`;
}

/** Full leg-by-leg listing for a tooltip: "SVO-LED-PEE-VVO". */
export function fullRouteLabel(flight: Flight): string {
  const segments = segmentsForFlight(flight);
  return [segments[0].origin, ...segments.map((s) => s.destination)].join("-");
}
