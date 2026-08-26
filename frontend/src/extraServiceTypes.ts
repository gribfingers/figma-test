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

/** Ancillary services offered on the check-in flow's Extra services step, grouped the same way the reference design shows them. */
export const EXTRA_SERVICE_GROUPS: ExtraServiceGroup[] = [
  {
    group: "Seats",
    options: [{ id: "spe-seat", code: "SPE", label: "Spe выбор места на регистрации" }],
  },
  {
    group: "Baggage",
    options: [
      { id: "spe-bag", code: "SPE", label: "32kg" },
      { id: "pzr-bag", code: "PZR", label: "23kg" },
      { id: "pn8-bag", code: "PN8", label: "10kg" },
    ],
  },
  {
    group: "Other",
    options: [
      { id: "pec", code: "PEC", label: "Дом животное в салоне рес" },
      { id: "ofk", code: "OFK", label: "Детский набор" },
      { id: "pzr-other", code: "PZR", label: "Поздравление со свадьбой" },
      { id: "pn8-other", code: "PN8", label: "Кофе со сливками" },
    ],
  },
];

const ALL_EXTRA_SERVICES = EXTRA_SERVICE_GROUPS.flatMap((g) => g.options);

export function extraServiceById(id: string): ExtraServiceOption | undefined {
  return ALL_EXTRA_SERVICES.find((o) => o.id === id);
}

export function extraServiceDisplay(id: string): string {
  const opt = ALL_EXTRA_SERVICES.find((o) => o.id === id);
  return opt ? `${opt.code} ${opt.label}` : "";
}
