/**
 * Boarding Pass Bar Code (BCBP) per IATA Resolution 792 ("Bar Coded Boarding
 * Pass" implementation guide, Passenger Services Conference Resolutions
 * Manual). This implements the mandatory "unique" field set for a single
 * flight leg (the fixed-length 60-character header) plus the passenger
 * status conditional item. Repeated-leg blocks and the extended optional
 * conditional item set (frequent flyer data, bag tag numbers, fast-track
 * indicator, etc.) are out of scope for this prototype and are called out
 * in docs/IATA_NOTES.md.
 */

export type PaxStatus = "0" | "1" | "2" | "3" | "4";

export const PAX_STATUS = {
  NOT_CHECKED_IN: "0" as PaxStatus,
  CHECKED_IN: "1" as PaxStatus,
  BOARDED: "2" as PaxStatus,
  STANDBY: "4" as PaxStatus,
};

export interface BcbpFields {
  surname: string;
  givenName: string;
  eTicket: boolean;
  pnrCode: string; // operating carrier record locator, up to 7 chars
  fromAirport: string; // 3-letter IATA code
  toAirport: string; // 3-letter IATA code
  carrierCode: string; // 2-3 letter IATA carrier designator
  flightNumber: string; // digits, no leading carrier code
  julianDate: string; // 3-digit day of year
  compartment: string; // class of service letter, e.g. Y, J, F
  seat: string; // e.g. 014A
  checkInSequence: string; // e.g. 0025
  paxStatus: PaxStatus;
}

function padRight(s: string, len: number): string {
  return (s ?? "").toUpperCase().slice(0, len).padEnd(len, " ");
}
function padLeft(s: string, len: number, ch = " "): string {
  return (s ?? "").toUpperCase().slice(0, len).padStart(len, ch);
}

export function encodeBcbp(f: BcbpFields): string {
  const name = padRight(`${f.surname}/${f.givenName}`, 20);
  const legNumber = "1"; // number of legs encoded in this pass

  let out = "";
  out += "M"; // format code: boarding pass
  out += legNumber;
  out += name;
  out += f.eTicket ? "E" : " ";
  out += padRight(f.pnrCode, 7);
  out += padRight(f.fromAirport, 3);
  out += padRight(f.toAirport, 3);
  out += padRight(f.carrierCode, 3);
  out += padLeft(f.flightNumber.replace(/\D/g, ""), 4, "0") + " "; // 5 chars: 4-digit number + suffix space
  out += padLeft(f.julianDate, 3, "0");
  out += padRight(f.compartment, 1);
  out += padLeft(f.seat, 4, "0");
  out += padLeft(f.checkInSequence, 5, "0");
  out += f.paxStatus;
  out += "00"; // field size of variable-size (conditional) field: none included

  return out; // 60 characters
}

export interface DecodedBcbp extends BcbpFields {
  raw: string;
  valid: boolean;
  errors: string[];
}

export function decodeBcbp(raw: string): DecodedBcbp {
  const errors: string[] = [];
  const s = raw.trim();
  if (s.length < 60) errors.push(`Expected at least 60 characters, got ${s.length}`);
  const get = (start: number, len: number) => s.slice(start, start + len).trim();

  const formatCode = s[0];
  if (formatCode !== "M") errors.push(`Unexpected format code '${formatCode}', expected 'M'`);

  const surnameGiven = get(2, 20);
  const [surname, givenName] = surnameGiven.split("/");
  const eTicket = s[22] === "E";
  const pnrCode = get(23, 7);
  const fromAirport = get(30, 3);
  const toAirport = get(33, 3);
  const carrierCode = get(36, 3);
  const flightNumber = get(39, 5).replace(/\s+$/, "");
  const julianDate = get(44, 3);
  const compartment = get(47, 1);
  const seat = get(48, 4);
  const checkInSequence = get(52, 5);
  const paxStatus = (s[57] ?? "0") as PaxStatus;

  return {
    raw: s,
    valid: errors.length === 0,
    errors,
    surname: surname ?? "",
    givenName: givenName ?? "",
    eTicket,
    pnrCode,
    fromAirport,
    toAirport,
    carrierCode,
    flightNumber,
    julianDate,
    compartment,
    seat,
    checkInSequence,
    paxStatus,
  };
}
