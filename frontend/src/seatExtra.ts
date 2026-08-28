import { SeatCell } from "./api";
import { ChildIcon } from "./components/Icon";
import {
  SeatAnimalIcon, SeatBrokenIcon, SeatCgBlockIcon, SeatCrewIcon,
  SeatEmergencyIcon, SeatFixedArmrestIcon, SeatHardBlockIcon, SeatInftIcon, SeatInstIcon, SeatLegroomIcon,
  SeatNoReclineIcon, SeatSoftBlockIcon, SeatStretcherIcon, SeatTransitIcon, SeatWheelchairIcon,
} from "./components/SeatIcons";

/**
 * "General layer" seat attributes from the seat-map legend, stored as JSON
 * in seats.extra (same pattern as Flight.extra / Passenger.extra). Exit-row
 * already has its own seats.exit_row column and its own dashed-border
 * treatment (SeatMapGrid), so it isn't duplicated here. Pricing/RFISC are
 * the two other legend sections ("ПЛАТНОСТЬ", "RFISC").
 */
export interface SeatExtra {
  noRecline?: boolean;
  hardBlock?: boolean; // seat can never be assigned
  softBlock?: boolean; // blocked, but can be overridden manually
  cgBlock?: boolean; // center-of-gravity / trim block
  broken?: boolean;
  crew?: boolean;
  stretcher?: boolean;
  wheelchair?: boolean;
  animal?: boolean;
  child?: boolean;
  infant?: boolean; // INFT — lap infant, no seat of their own
  inst?: boolean; // INST — infant travelling with their own seat
  transit?: boolean; // SOM transit point
  fixedArmrest?: boolean;
  legroom?: boolean;
  price?: number;
  priceIcon?: boolean; // show a star alongside the price
  rfisc?: string;
  // Hold markers — independent of passenger assignment (a free seat can be
  // pre-seated or reserved before anyone actually checks in), so they're
  // overlay flags on top of the free/checked-in/boarded state rather than
  // states of their own. No seat-hold subsystem exists yet to set these
  // automatically; for now they're only set by hand via the seat editor.
  preseated?: boolean;
  reserved?: boolean;
}

/** Row + letter, dropping the row's zero-padding (e.g. "012A" -> "12A") — the stored/keyed code stays 3-digit, this is display-only. */
export function formatSeatDisplay(seat: string): string {
  const match = /^(\d+)([A-Za-z])$/.exec(seat);
  if (!match) return seat;
  return `${Number(match[1])}${match[2]}`;
}

export function parseSeatExtra(s: SeatCell): SeatExtra {
  if (!s.extra) return {};
  try {
    return JSON.parse(s.extra);
  } catch {
    return {};
  }
}

export interface SeatAttrDef {
  key: keyof SeatExtra;
  label: string;
  icon: (props: { size?: number; className?: string }) => JSX.Element;
}

// Priority order for which single icon a seat cell shows when several
// attributes are set — matches how the reference map shows one glyph per
// seat; the editor still lets every flag be set independently.
export const SEAT_ATTRS: SeatAttrDef[] = [
  { key: "hardBlock", label: "Жёсткий блок", icon: SeatHardBlockIcon },
  { key: "softBlock", label: "Мягкий блок", icon: SeatSoftBlockIcon },
  { key: "broken", label: "Сломанное", icon: SeatBrokenIcon },
  { key: "cgBlock", label: "Блок центровки", icon: SeatCgBlockIcon },
  { key: "crew", label: "Экипаж", icon: SeatCrewIcon },
  { key: "stretcher", label: "Носилки", icon: SeatStretcherIcon },
  { key: "wheelchair", label: "Кресло", icon: SeatWheelchairIcon },
  { key: "animal", label: "Животное", icon: SeatAnimalIcon },
  { key: "infant", label: "Младенец (INFT)", icon: SeatInftIcon },
  { key: "inst", label: "Младенец с местом (INST)", icon: SeatInstIcon },
  { key: "child", label: "Ребёнок", icon: ChildIcon },
  { key: "transit", label: "Транзит (SOM)", icon: SeatTransitIcon },
  { key: "noRecline", label: "Не откидывается спинка", icon: SeatNoReclineIcon },
  { key: "fixedArmrest", label: "Не поднимающийся подлокотник", icon: SeatFixedArmrestIcon },
  { key: "legroom", label: "Место для ног", icon: SeatLegroomIcon },
];

/** Exit-row is its own seats.exit_row column rather than a SeatExtra flag, but shows an icon on the seat
 *  cell the same way — lowest priority, so any real attribute icon still wins if the seat has one too. */
export const EXIT_ROW_ATTR: SeatAttrDef = { key: "exitRow" as keyof SeatExtra, label: "Аварийное (exit row)", icon: SeatEmergencyIcon };

/** The one attribute icon to show on a seat cell, by SEAT_ATTRS priority. */
export function primaryAttr(extra: SeatExtra): SeatAttrDef | null {
  return SEAT_ATTRS.find((a) => extra[a.key]) ?? null;
}

export type SeatState = "free" | "checked_in" | "boarded";

export function seatState(s: SeatCell): SeatState {
  if (!s.passenger_id) return "free";
  if (s.boarding_status === "BOARDED") return "boarded";
  return "checked_in";
}

// "Subtype" in the Figma "Seat H" component (30291:29546) — the 6×30 color
// bar on the seat's left edge for the two hold markers.
export type SeatSubtype = "none" | "presit" | "booked";

export function seatSubtype(extra: SeatExtra): SeatSubtype {
  if (extra.preseated) return "presit";
  if (extra.reserved) return "booked";
  return "none";
}

function ageFromSeatDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * The Figma component's "State=Child" — a distinct visual (narrow child
 * icon + age badge) shown when the seat's real occupant is a minor, derived
 * from the passenger's dob. Independent of the manually-set "child"/
 * "infant" SEAT_ATTRS flags above, which mark a seat's general suitability
 * rather than describe who's actually sitting in it.
 */
export function occupantAge(s: SeatCell): number | null {
  if (!s.passenger_id) return null;
  return ageFromSeatDob(s.dob);
}
