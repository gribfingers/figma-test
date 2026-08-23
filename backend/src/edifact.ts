import { Flight, Passenger } from "./types";
import { toJulianDayOfYear } from "./utils/julian";

/**
 * Simplified Passenger Name List / Additions-Deletions List / Passenger
 * Final Summary messages, styled after the IATA Reservations Interline
 * Message Procedures ("Type B") passenger list messages that DCS/host
 * systems exchange with airline reservations. This is a compact teaching
 * approximation, not a certified PADIS/Type-B implementation — see
 * docs/IATA_NOTES.md for what is and isn't represented.
 */

function header(flight: Flight, msgType: string): string {
  const date = flight.std.slice(0, 10).replace(/-/g, "").slice(2); // YYMMDD
  return [
    `${msgType}`,
    `${flight.carrier_code}${flight.flight_number}/${date}`,
    `${flight.origin}${flight.destination}`,
    "",
  ].join("\n");
}

function ssrLines(p: Passenger): string[] {
  const codes: string[] = JSON.parse(p.ssr || "[]");
  return codes.map((c) => `  SSR ${c}`);
}

export function buildPnl(flight: Flight, passengers: Passenger[]): string {
  const lines: string[] = [header(flight, "PNL")];
  passengers.forEach((p, i) => {
    lines.push(`${i + 1}.${p.surname}/${p.given_name} ${p.record_locator}`);
    lines.push(...ssrLines(p));
  });
  lines.push("", `ENDPNL ${passengers.length}PAX`);
  return lines.join("\n");
}

/**
 * ADL carries only the delta since the last PNL snapshot: passengers
 * checked in (additions to the boarding count) plus any offloads.
 * `sinceSequence` filters to check-in sequence numbers greater than the
 * last transmitted value (a simplification of real ADL delta tracking,
 * which keys off reservation action codes rather than check-in sequence).
 */
export function buildAdl(flight: Flight, passengers: Passenger[], sinceSequence: number): string {
  const lines: string[] = [header(flight, "ADL")];
  const changed = passengers.filter(
    (p) => (p.checkin_sequence ?? 0) > sinceSequence || p.boarding_status === "OFFLOADED"
  );
  changed.forEach((p, i) => {
    const action = p.boarding_status === "OFFLOADED" ? "DEL" : "ADD";
    lines.push(`${i + 1}.${action} ${p.surname}/${p.given_name} ${p.record_locator} SEAT${p.seat ?? "----"}`);
  });
  lines.push("", `ENDADL ${changed.length}CHG`);
  return lines.join("\n");
}

/**
 * PFS (Passenger Final/Flight Summary List) is transmitted at flight
 * close-out: final boarded count, no-shows, and a basic load summary
 * (feeds Weight & Balance, per IATA Airport Handling Manual load-control
 * principles — full W&B here is a simplified pax/bag count only).
 */
export function buildPfs(flight: Flight, passengers: Passenger[]): string {
  const boarded = passengers.filter((p) => p.boarding_status === "BOARDED");
  const noShow = passengers.filter(
    (p) => p.checkin_status === "CHECKED_IN" && p.boarding_status !== "BOARDED"
  );
  const infants = boarded.filter((p) => p.infant).length;
  const adults = boarded.length - infants;
  const totalBagWeight = boarded.reduce((sum, p) => sum + (p.bag_weight_kg || 0), 0);

  const lines: string[] = [header(flight, "PFS")];
  boarded.forEach((p, i) => {
    lines.push(`${i + 1}.${p.surname}/${p.given_name} SEAT${p.seat} ${p.bag_count}PC/${p.bag_weight_kg}KG`);
  });
  lines.push(
    "",
    `PAX ADULT/CHILD ${adults} INFANT ${infants}`,
    `BAGS TTL ${boarded.reduce((s, p) => s + p.bag_count, 0)}PC / ${totalBagWeight.toFixed(1)}KG`,
    `NOSHOW ${noShow.length}`,
    `JULIAN ${toJulianDayOfYear(flight.std)}`,
    `ENDPFS`
  );
  return lines.join("\n");
}
