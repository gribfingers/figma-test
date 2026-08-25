import { SeatCell } from "./api";
import {
  AnimalIcon, BrokenIcon, CgBlockIcon, ChildIcon, CloseIcon, CrewIcon, FixedArmrestIcon,
  InfantIcon, LegroomIcon, NoReclineIcon, StretcherIcon, TransitIcon, WheelchairIcon,
} from "./components/Icon";

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
  infant?: boolean;
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
  { key: "hardBlock", label: "Жёсткий блок", icon: CloseIcon },
  { key: "softBlock", label: "Мягкий блок", icon: CloseIcon },
  { key: "broken", label: "Сломанное", icon: BrokenIcon },
  { key: "cgBlock", label: "Блок центровки", icon: CgBlockIcon },
  { key: "crew", label: "Экипаж", icon: CrewIcon },
  { key: "stretcher", label: "Носилки", icon: StretcherIcon },
  { key: "wheelchair", label: "Кресло", icon: WheelchairIcon },
  { key: "animal", label: "Животное", icon: AnimalIcon },
  { key: "infant", label: "Младенец", icon: InfantIcon },
  { key: "child", label: "Ребёнок", icon: ChildIcon },
  { key: "transit", label: "Транзит (SOM)", icon: TransitIcon },
  { key: "noRecline", label: "Не откидывается спинка", icon: NoReclineIcon },
  { key: "fixedArmrest", label: "Не поднимающийся подлокотник", icon: FixedArmrestIcon },
  { key: "legroom", label: "Место для ног", icon: LegroomIcon },
];

/** The one attribute icon to show on a seat cell, by SEAT_ATTRS priority — restricted to `visible` when the layers menu has hidden some. */
export function primaryAttr(extra: SeatExtra, visible?: Set<string>): SeatAttrDef | null {
  return SEAT_ATTRS.find((a) => extra[a.key] && (!visible || visible.has(a.key))) ?? null;
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
