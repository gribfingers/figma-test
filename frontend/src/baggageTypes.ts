export interface BaggageTypeOption {
  /** Unique across the whole list — some codes (e.g. "010") repeat for genuinely different tariffs. */
  id: string;
  code: string;
  label: string;
}
export interface BaggageTypeGroup {
  group: string;
  options: BaggageTypeOption[];
}

/** Checked-baggage tariff codes shown in the Baggage step's type picker. */
export const BAGGAGE_TYPE_GROUPS: BaggageTypeGroup[] = [
  {
    group: "Standard",
    options: [
      { id: "std-010", code: "010", label: "1-10 kg" },
      { id: "std-020", code: "020", label: "1-20 kg" },
      { id: "std-030", code: "030", label: "1-32 kg" },
    ],
  },
  {
    group: "Oversize",
    options: [
      { id: "ofb", code: "OFB", label: "Up to 203 cm <20 kg" },
      { id: "ofk", code: "OFK", label: "Up to 203 cm <32kg (OFK)" },
    ],
  },
  {
    group: "Sport",
    options: [
      { id: "bike", code: "053", label: "Bike" },
      { id: "ski", code: "054", label: "Ski" },
      { id: "fish", code: "0L1", label: "Fish" },
    ],
  },
];

/** Standalone special-handling types, shown after the groups above (no sub-options of their own). */
export const BAGGAGE_SPECIAL_TYPES: BaggageTypeOption[] = [
  { id: "weap", code: "RUH", label: "WEAP" },
  { id: "wheelchair", code: "010", label: "Weelchair" },
  { id: "stroller", code: "010", label: "Stroller" },
];

export const CARRY_ON_TYPES: BaggageTypeOption[] = [{ id: "carry-010", code: "010", label: "1-10 kg" }];

export type BagPrintStatus = "idle" | "error" | "printed";

/** One checked-bag row from the Baggage step — lifted up to PnrView (see BaggageStep) so the
 *  roster card can mirror the same rows, same as the Seats step mirrors the real assigned seat. */
export interface BagRow {
  id: number;
  destination: string;
  weight: string;
  typeId: string;
  tagNumber: string;
  daa: boolean;
  dmg: boolean;
  printStatus: BagPrintStatus;
}

const ALL_BAGGAGE_TYPES = [...BAGGAGE_TYPE_GROUPS.flatMap((g) => g.options), ...BAGGAGE_SPECIAL_TYPES];

export function baggageTypeById(id: string): BaggageTypeOption | undefined {
  return ALL_BAGGAGE_TYPES.find((o) => o.id === id);
}

/** "010 1-10 kg" for a Standard-group option, "WEAP (RUH)" for a special one — matches how each reads in the reference design. */
export function baggageTypeDisplay(id: string): string {
  const opt = ALL_BAGGAGE_TYPES.find((o) => o.id === id);
  if (!opt) return "";
  return BAGGAGE_SPECIAL_TYPES.includes(opt) ? `${opt.label} (${opt.code})` : `${opt.code} ${opt.label}`;
}
