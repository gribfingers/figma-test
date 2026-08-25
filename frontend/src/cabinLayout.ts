export type CabinFeatureType = "wc" | "galley" | "exit";

export interface CabinFeature {
  /**
   * This feature renders as an extra row directly after this seat row
   * number. 0 means "before row 1" — i.e. in front of the whole cabin.
   */
  afterRow: number;
  type: CabinFeatureType;
}

/**
 * Cabin structure per aircraft type: lavatories, galley, and exit doors.
 * These are fixed structural positions on a real single-aisle Airbus/Boeing
 * (front galley+lavatory sit between the flight deck and row 1; the aft
 * galley+lavatories sit behind the last row, both regardless of the
 * airline's seat layout) — reflected here as inserts before/after specific
 * seat rows rather than derived from seat data, since exit doors in
 * particular don't correspond to a bookable seat row at all.
 *
 * The overwing exit position for A320 (between rows 11 and 12) matches
 * Aeroflot's published A320neo configuration; the equivalent rows for the
 * other types are estimated from the same relative cabin position, not
 * from a verified source (this app has no certified AHM/type-config data
 * — see the file-level note in backend/src/utils/seatmap.ts).
 */
export const CABIN_FEATURES: Record<string, CabinFeature[]> = {
  A320: [
    { afterRow: 0, type: "wc" },
    { afterRow: 11, type: "exit" },
    { afterRow: 30, type: "wc" },
    { afterRow: 30, type: "galley" },
  ],
  B738: [
    { afterRow: 0, type: "wc" },
    { afterRow: 13, type: "exit" },
    { afterRow: 32, type: "wc" },
    { afterRow: 32, type: "galley" },
  ],
  A321: [
    { afterRow: 0, type: "wc" },
    { afterRow: 14, type: "exit" },
    { afterRow: 33, type: "wc" },
    { afterRow: 33, type: "galley" },
  ],
  A330: [
    { afterRow: 0, type: "wc" },
    { afterRow: 19, type: "exit" },
    { afterRow: 39, type: "wc" },
    { afterRow: 39, type: "galley" },
  ],
};

export function cabinFeaturesFor(aircraftType: string): CabinFeature[] {
  return CABIN_FEATURES[aircraftType] ?? [];
}
