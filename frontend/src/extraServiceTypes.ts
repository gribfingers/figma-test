export interface ExtraServiceOption {
  /** Unique across the whole list — codes repeat (e.g. "PZR", "PN8" each appear twice for genuinely different services). */
  id: string;
  code: string;
  label: string;
}
export interface ExtraServiceGroup {
  group: string;
  options: ExtraServiceOption[];
}

/**
 * Ancillary services offered on the check-in flow's Extra services step. Seats/Baggage groups
 * used to duplicate what those steps now show for real (see seatServiceItemsForSeat and
 * baggageServiceItemsForRows in paxExtra.ts) — only the genuinely "other" ancillaries remain here.
 */
export const EXTRA_SERVICE_GROUPS: ExtraServiceGroup[] = [
  {
    group: "Other",
    options: [
      { id: "pec", code: "PEC", label: "Pet in cabin" },
      { id: "ofk", code: "OFK", label: "Kids kit" },
      { id: "pzr-other", code: "PZR", label: "Wedding congratulations" },
      { id: "pn8-other", code: "PN8", label: "Coffee with cream" },
    ],
  },
];

