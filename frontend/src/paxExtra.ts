import { Passenger, SeatCell } from "./api";
import { SEAT_ATTRS, SeatExtra, parseSeatExtra } from "./seatExtra";
import { BagRow, baggageTypeById } from "./baggageTypes";

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

/**
 * A passenger's cabin for the Booked/Checked stat bars (PnrView, Boarding, BoardingPax) — from
 * their actual assigned seat when they have one (authoritative — reflects reseating), otherwise
 * from their real booked class of service (passengers.class), so a passenger who hasn't picked a
 * seat yet still counts as Booked instead of silently falling out of both bars. A lap infant
 * (never seated, travels on a guardian's lap) is excluded entirely — it doesn't occupy a
 * seat-inventory slot, so counting it would inflate Booked past the plane's real C/Y capacity.
 */
export function classFor(p: Passenger, seatByCode: Map<string, SeatCell>): "C" | "Y" | null {
  const seat = p.seat ? seatByCode.get(p.seat) : undefined;
  if (seat) return seat.cabin_class === "J" ? "C" : "Y";
  if (parsePassengerExtra(p).type === "INF") return null;
  return p.class ?? null;
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
  /** Fabricated amount, same mock-data spirit as the rest of this generator — see unpaidAsvcAmount. */
  price: number;
}
export interface AsvcLeg {
  leg: string;
  services: AsvcService[];
}

const ASVC_LEGS = ["MOW-AER", "AER-PEE", "PEE-LED"];
const ASVC_SERVICE_POOL = ["Wi-Fi access", "Bagels", "Coffee", "Coffee +", "Blanket", "Headphones"];

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
      const paid = rand() < 0.7;
      const price = 200 + Math.floor(rand() * 24) * 50; // 200-1350 in steps of 50
      services.push({ name, paid, price });
    }
    return { leg, services };
  });
}

/** Total owed across a passenger's unpaid ancillary purchases (see AsvcService.price) — the amount
 *  shown on Boarding's "Pay" button/QR, since these mock purchases have no separate priced record. */
export function unpaidAsvcAmount(p: Passenger): number {
  return asvcForPassenger(p)
    .flatMap((l) => l.services)
    .filter((s) => !s.paid)
    .reduce((total, s) => total + s.price, 0);
}

export interface SeatServiceItem {
  rfisc: string;
  label: string;
  /** null when the seat has no price set — never fabricated (see seatServiceItemsForSeat). */
  price: number | null;
  paid: boolean;
}

// A/F are windows, C/D are the two aisle-adjacent seats in this app's 3-3 layout (aisle after C —
// see SeatMapGrid.tsx); B/E are plain middle seats, no position line item for those. Codes are the
// IATA PADIS 9825 seat-characteristic letters (window/aisle) confirmed across multiple GDS/NDC
// references.
const SEAT_POSITION: Record<string, { label: string; code: string }> = {
  A: { label: "Window", code: "W" },
  F: { label: "Window", code: "W" },
  C: { label: "Aisle", code: "A" },
  D: { label: "Aisle", code: "A" },
};

// Best-effort per-attribute codes for when the seat has no price at all (so no real purchased
// RFISC applies) — legroom/aisle/window follow the confirmed IATA PADIS 9825 letters; the rest
// (noRecline, fixedArmrest) have no verified public source, so these are plausible placeholders
// only, not certified codes. "SOM" for transit matches the label's own existing (SOM) tag.
const SEAT_ATTR_CODE: { [K in keyof SeatExtra]?: string } = {
  legroom: "L",
  noRecline: "U",
  fixedArmrest: "FA",
  transit: "SOM",
};

/**
 * The roster card's seat-service line items, derived straight from the
 * passenger's actual assigned seat (seats.extra) rather than fabricated —
 * one row per general-layer attribute the seat really has (legroom,
 * no-recline, fixed armrest, transit) plus a window/aisle row from its
 * letter. A priced seat shows the real purchased RFISC ("0B5" — Seat
 * Assignment) on every row; an unpriced amenity shows its own
 * characteristic code instead (see SEAT_ATTR_CODE) — every row always
 * carries a code, but price/RFISC-as-purchase only appear when real.
 */
export function seatServiceItemsForSeat(
  seat: SeatCell | undefined | null,
  t: (text: string) => string = (s) => s
): SeatServiceItem[] {
  if (!seat) return [];
  const extra = parseSeatExtra(seat);
  // "paid" here really means "nothing owed" — a free amenity (no price at all) shows green (no
  // payment required), while an actual priced selection shows red until it's collected.
  const paid = extra.price == null;
  const price = extra.price ?? null;
  const purchasedRfisc = extra.rfisc ?? null;
  const items: SeatServiceItem[] = [];

  const position = SEAT_POSITION[seat.seat.slice(-1)];
  if (position) items.push({ rfisc: purchasedRfisc ?? position.code, label: t(position.label), price, paid });

  for (const attr of SEAT_ATTRS) {
    if (!extra[attr.key]) continue;
    const code = SEAT_ATTR_CODE[attr.key];
    if (!code) continue;
    items.push({ rfisc: purchasedRfisc ?? code, label: t(attr.label), price, paid });
  }

  return items;
}

// Same "stable but not user-togglable" hash as BaggageStep's own Type-field tone — kept in sync
// deliberately (same seed shape) so a row's roster-card color always matches its Type field color.
function bagHashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
function bagRowPaid(seed: string): boolean {
  return bagHashSeed(seed) % 3 !== 0;
}

/**
 * The roster card's checked-baggage line items, derived from the Baggage step's actual bag rows
 * for this passenger (lifted up to PnrView) rather than fabricated — one row per bag that's had a
 * Type actually picked, with the exact code/label from that Type dropdown. Price/paid only appear
 * once Calculate has actually run for this passenger, same "neutral until real" rule the Baggage
 * step itself uses for the Type field's color.
 */
export function baggageServiceItemsForRows(
  passengerId: number,
  rows: BagRow[],
  calculated: boolean,
  t: (text: string) => string = (s) => s
): SeatServiceItem[] {
  return rows
    .filter((r) => r.typeId)
    .map((r) => {
      const opt = baggageTypeById(r.typeId);
      const price = calculated ? 12500 : null;
      const paid = price == null ? true : bagRowPaid(`${passengerId}-${r.id}-${r.weight}-${r.typeId}`);
      return { rfisc: opt?.code ?? "", label: opt ? t(opt.label) : "", price, paid };
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
