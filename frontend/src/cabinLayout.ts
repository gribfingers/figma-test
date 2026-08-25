export type CabinFeatureType = "wc" | "galley";

export interface CabinFeature {
  /** This feature renders as an extra row directly after this seat row number. */
  afterRow: number;
  type: CabinFeatureType;
}

/**
 * WC/galley placement per aircraft type, mirroring the business/economy row
 * boundaries baked into the backend's AIRCRAFT_TEMPLATES
 * (backend/src/utils/seatmap.ts): one lavatory between business and economy,
 * a lavatory + galley at the back of the cabin. There's no cabin-structure
 * endpoint — the seat-map API only returns seat rows — so this is kept as a
 * small parallel table here rather than adding a backend round trip for it.
 */
export const CABIN_FEATURES: Record<string, CabinFeature[]> = {
  A320: [
    { afterRow: 3, type: "wc" },
    { afterRow: 30, type: "wc" },
    { afterRow: 30, type: "galley" },
  ],
  B738: [
    { afterRow: 4, type: "wc" },
    { afterRow: 32, type: "wc" },
    { afterRow: 32, type: "galley" },
  ],
  A321: [
    { afterRow: 4, type: "wc" },
    { afterRow: 33, type: "wc" },
    { afterRow: 33, type: "galley" },
  ],
  A330: [
    { afterRow: 6, type: "wc" },
    { afterRow: 39, type: "wc" },
    { afterRow: 39, type: "galley" },
  ],
};

export function cabinFeaturesFor(aircraftType: string): CabinFeature[] {
  return CABIN_FEATURES[aircraftType] ?? [];
}
