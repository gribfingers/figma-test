import { Passenger } from "./api";

/** Same list the check-in flow offers (routes/checkin.ts has no dedicated enum on the wire, just free-form SSR codes). */
export const SSR_OPTIONS = ["WCHR", "WCHS", "UMNR", "BLND", "DEAF", "VGML", "PETC", "EXST"];

/** Same options the check-in flow offers for a travel document's type. */
export const DOCUMENT_TYPES = [
  { value: "P", label: "Passport (P)" },
  { value: "V", label: "Visa (V)" },
  { value: "ID", label: "ID card (ID)" },
];

/** A secondary travel document — the primary one lives in the real document_* columns (see PassengerDraft). */
export interface PassengerDocument {
  document_type: string;
  document_number: string;
  nationality: string;
  doc_expiry: string;
}

/**
 * Fields with no dedicated column yet — waitlisted/priority-list flags,
 * passenger type, iAPP (checked in via mobile app), the connecting
 * inbound/outbound flight number, and any travel documents beyond the
 * primary one (which lives in the real document_* columns) — stored as
 * JSON in Passenger.extra, same pattern as Flight.extra.
 */
export interface PassengerExtra {
  wl?: boolean;
  pl?: boolean;
  type?: string;
  iapp?: boolean;
  inbound?: string;
  inboundTime?: string; // "YYYY-MM-DDTHH:mm", when the inbound connection lands
  outbound?: string;
  outboundTime?: string; // "YYYY-MM-DDTHH:mm", when the outbound connection leaves
  comments?: { checkin: string[]; boarding: string[] };
  ffp?: { airline: string; card: string };
  documents?: PassengerDocument[];
  cabinBagCount?: number;
  cabinBagWeight?: number;
  /** Set by the agent once they've checked the physical document against the booking. */
  docVerified?: boolean;
  /** Set once the document has been scanned (passport reader / camera). */
  docScanned?: boolean;
}

export function parsePassengerExtra(p: Passenger): PassengerExtra {
  if (!p.extra) return {};
  try {
    return JSON.parse(p.extra);
  } catch {
    return {};
  }
}

/** Age in whole years as of today (UTC calendar), or -1 if dob is missing/invalid. */
export function ageYears(dob: string | null): number {
  if (!dob) return -1;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function ageFromDob(dob: string | null): string {
  const age = ageYears(dob);
  return age < 0 ? "" : String(age);
}

/** IATA infant definition: under 2 years old — derived from DOB rather than a manually-set flag. */
export function isInfant(dob: string | null): boolean {
  const age = ageYears(dob);
  return age >= 0 && age < 2;
}

export type TrStatus = "none" | "ok" | "conflict";

/**
 * TR chip color: gray with no connecting flights, green with a valid
 * connection, red when the outbound leg would depart before (or as) the
 * inbound one lands — too tight or impossible to make.
 */
export function trStatus(p: Passenger): TrStatus {
  const extra = parsePassengerExtra(p);
  if (!extra.inbound && !extra.outbound) return "none";
  if (extra.inboundTime && extra.outboundTime) {
    const inTime = new Date(extra.inboundTime).getTime();
    const outTime = new Date(extra.outboundTime).getTime();
    if (!Number.isNaN(inTime) && !Number.isNaN(outTime) && outTime <= inTime) return "conflict";
  }
  return "ok";
}

// Deterministic per-id PRNG (Lehmer/Park-Miller) — same passenger always
// gets the same generated services, rather than reshuffling on every
// render.
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface AsvcService {
  name: string;
  paid: boolean;
}
export interface AsvcLeg {
  leg: string;
  services: AsvcService[];
}

const ASVC_LEGS = ["MOW-AER", "AER-PEE", "PEE-LED"];
const ASVC_SERVICE_POOL = ["Доступ в интернет", "Бублики", "Кофе", "Кофе +", "Плед", "Наушники"];

/**
 * Ancillary purchases per leg have no backing table yet — generated
 * deterministically from the passenger id (same scope as the rest of the
 * mock ASVC/route data), so a given passenger always shows the same
 * services and the AUX chip color always matches what the modal shows.
 */
export function asvcForPassenger(p: Passenger): AsvcLeg[] {
  const rand = seededRandom(p.id * 7919 + 13);
  return ASVC_LEGS.map((leg) => {
    const count = Math.floor(rand() * 3); // 0-2 purchased services on this leg
    const pool = [...ASVC_SERVICE_POOL];
    const services: AsvcService[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rand() * pool.length);
      const name = pool.splice(idx, 1)[0];
      services.push({ name, paid: rand() < 0.7 });
    }
    return { leg, services };
  });
}

export type AsvcStatus = "none" | "ok" | "conflict";

/** AUX chip color: gray with no ancillary purchases, green if all paid, red if any are unpaid. */
export function asvcStatus(p: Passenger): AsvcStatus {
  const all = asvcForPassenger(p).flatMap((l) => l.services);
  if (all.length === 0) return "none";
  return all.every((s) => s.paid) ? "ok" : "conflict";
}

export type FlagStatus = "none" | "ok" | "conflict";

/** COM chip color: green if there's at least one check-in or boarding comment, gray otherwise. */
export function commentsStatus(p: Passenger): FlagStatus {
  const c = parsePassengerExtra(p).comments;
  return c && (c.checkin.length > 0 || c.boarding.length > 0) ? "ok" : "none";
}

/** FFP chip color: green once a frequent-flyer card is on file, gray otherwise. */
export function ffpStatus(p: Passenger): FlagStatus {
  return parsePassengerExtra(p).ffp?.card ? "ok" : "none";
}

/** ET chip color: green when the passenger has an e-ticket number, gray otherwise. */
export function etStatus(p: Passenger): FlagStatus {
  return p.ticket_number?.trim() ? "ok" : "none";
}
