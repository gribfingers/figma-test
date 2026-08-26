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

/** DOCO — an entry document (visa/entry permit) beyond the passenger's ID document. */
export interface VisaDocument {
  document_type: string;
  expiration_date: string;
  visa_number: string;
  applicable_country: string;
  issue_country: string;
  issue_city: string;
  issue_date: string;
  birth_place: string;
}

/** DOCA — a destination/origin address on file, some countries require one for entry. */
export interface AddressDocument {
  address_type: string;
  country: string;
  state: string;
  city: string;
  address: string;
  zip_code: string;
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
  visaDocs?: VisaDocument[];
  addressDocs?: AddressDocument[];
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

export interface SeatServiceItem {
  rfisc: string;
  label: string;
  price: number;
  paid: boolean;
}

const SEAT_SERVICE_LABELS = ["Хорошее место", "У окна", "У прохода", "Больше места для ног"];

/**
 * Paid seat-selection extras, per segment — no backing table yet, generated
 * deterministically from the passenger id (same approach as ASVC above) so
 * a given passenger/segment always shows the same chips. The green/red bar
 * on each row is just this — paid or not.
 */
export function seatServicesForPassenger(p: Passenger, segmentCount: number): SeatServiceItem[][] {
  const rand = seededRandom(p.id * 65599 + 101);
  return Array.from({ length: Math.max(segmentCount, 1) }, () => {
    const count = 1 + Math.floor(rand() * 2); // 1-2 per segment
    const pool = [...SEAT_SERVICE_LABELS];
    const items: SeatServiceItem[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rand() * pool.length);
      const label = pool.splice(idx, 1)[0];
      items.push({ rfisc: "0B5", label, price: 12500, paid: rand() < 0.7 });
    }
    return items;
  });
}

const EXTRA_SERVICE_LABELS = ["Бублики", "Доступ в интернет", "Чай", "Кофе", "Питание экипажа"];

/**
 * Same shape/approach as seatServicesForPassenger/baggageServicesForPassenger
 * above, but flat (not per-segment) and drawn with replacement — the Extra
 * services step's roster-card chips, which can repeat the same service.
 */
export function extraServicesForPassenger(p: Passenger): SeatServiceItem[] {
  const rand = seededRandom(p.id * 8191 + 37);
  const count = 4 + Math.floor(rand() * 4); // 4-7 items
  const items: SeatServiceItem[] = [];
  for (let i = 0; i < count; i++) {
    const label = EXTRA_SERVICE_LABELS[Math.floor(rand() * EXTRA_SERVICE_LABELS.length)];
    items.push({ rfisc: "0B5", label, price: 12500, paid: rand() < 0.7 });
  }
  return items;
}

const BAGGAGE_SERVICE_LABELS = ["23 kg", "32 kg", "Excess 5 kg"];

/** Same shape/approach as seatServicesForPassenger above, but for the Baggage step's roster-card chips. */
export function baggageServicesForPassenger(p: Passenger, segmentCount: number): SeatServiceItem[][] {
  const rand = seededRandom(p.id * 48611 + 71);
  return Array.from({ length: Math.max(segmentCount, 1) }, () => {
    const count = 1 + Math.floor(rand() * 2); // 1-2 per segment
    const pool = [...BAGGAGE_SERVICE_LABELS];
    const items: SeatServiceItem[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rand() * pool.length);
      const label = pool.splice(idx, 1)[0];
      items.push({ rfisc: "0B5", label, price: 12500, paid: rand() < 0.7 });
    }
    return items;
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
