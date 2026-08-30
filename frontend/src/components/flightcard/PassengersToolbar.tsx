import { useEffect, useRef, useState } from "react";
import { SeatCell } from "../../api";
import { SSR_OPTIONS } from "../../paxExtra";
import { ChevronDownIcon, MoreIcon, SearchIcon } from "../Icon";
import { useLanguage } from "../../i18n";

export type QuickFilter = "all" | "reseat" | "priority";

export interface ColumnDef {
  key: string;
  label: string;
}

export const PASSENGER_COLUMNS: ColumnDef[] = [
  { key: "pnr", label: "PNR" },
  { key: "flags", label: "Flags" },
  { key: "seat", label: "Seat" },
  { key: "class", label: "Class" },
  { key: "status", label: "Status" },
  { key: "services", label: "Services" },
  { key: "asvc", label: "ASVC" },
  { key: "wl", label: "WL" },
  { key: "pl", label: "PL" },
  { key: "type", label: "Type" },
  { key: "iapp", label: "iAPP" },
  { key: "inbound", label: "Inbound" },
  { key: "outbound", label: "Outbound" },
  { key: "bag", label: "Bag" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
];

/** Business/Economy occupied-vs-total counts from the seatmap — the only two cabin classes this app's seat map model generates (see seatmap.ts / seed.ts). */
function classCounts(seats: SeatCell[]): { cabin: string; occupied: number; total: number }[] {
  const byClass = new Map<string, { occupied: number; total: number }>();
  for (const s of seats) {
    const entry = byClass.get(s.cabin_class) ?? { occupied: 0, total: 0 };
    entry.total += 1;
    if (s.passenger_id != null) entry.occupied += 1;
    byClass.set(s.cabin_class, entry);
  }
  const order = ["J", "Y"];
  const label: Record<string, string> = { J: "C", Y: "Y" };
  return order.filter((c) => byClass.has(c)).map((c) => ({ cabin: label[c], ...byClass.get(c)! }));
}

interface Props {
  seats: SeatCell[];
  reseatCount: number;
  priorityCount: number;
  quickFilter: QuickFilter;
  onQuickFilter: (f: QuickFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  serviceFilter: string[];
  onServiceFilter: (codes: string[]) => void;
  asvcFilter: string;
  onAsvcFilter: (v: string) => void;
  visibleColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  totalCount: number;
  onAddPassenger: () => void;
  /** Hides "Add pax" for a read-only user (see useCanEdit) — column visibility and filters stay available. */
  hideAddPassenger?: boolean;
}

export function PassengersToolbar({
  seats,
  reseatCount,
  priorityCount,
  quickFilter,
  onQuickFilter,
  query,
  onQuery,
  serviceFilter,
  onServiceFilter,
  asvcFilter,
  onAsvcFilter,
  visibleColumns,
  onToggleColumn,
  totalCount,
  onAddPassenger,
  hideAddPassenger,
}: Props) {
  const { t } = useLanguage();
  const [servicesOpen, setServicesOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) setServicesOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const counts = classCounts(seats);

  return (
    <div className="pax-toolbar">
      <div className="pax-toolbar-row">
        <div className="pax-quick-filters">
          <button type="button" className={`pax-quick-filter ${quickFilter === "all" ? "selected" : ""}`} onClick={() => onQuickFilter("all")}>
            {t("All")}
          </button>
          <button type="button" className={`pax-quick-filter ${quickFilter === "reseat" ? "selected" : ""}`} onClick={() => onQuickFilter("reseat")}>
            WL ({reseatCount})
          </button>
          <button type="button" className={`pax-quick-filter ${quickFilter === "priority" ? "selected" : ""}`} onClick={() => onQuickFilter("priority")}>
            PL ({priorityCount})
          </button>
        </div>
        <div className="pax-class-counts">
          {counts.map((c) => (
            <span key={c.cabin} className="pax-class-count">
              <span className="pax-class-count-label">{c.cabin}</span>
              {c.occupied}/{c.total}
            </span>
          ))}
        </div>

        <div className="input-box" style={{ width: 190 }}>
          <SearchIcon size={16} />
          <input placeholder={t("Search pax…")} value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>

        <div className="pax-multiselect" ref={servicesRef}>
          <div className={`pax-multiselect-box ${servicesOpen ? "open" : ""}`} onClick={() => setServicesOpen((o) => !o)}>
            {serviceFilter.map((code) => (
              <span key={code} className="pax-multiselect-tag">
                {code}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onServiceFilter(serviceFilter.filter((c) => c !== code));
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {serviceFilter.length === 0 && <span className="pax-multiselect-placeholder">{t("Any services")}</span>}
            <ChevronDownIcon size={14} className="pax-multiselect-chevron" />
          </div>
          {servicesOpen && (
            <ul className="select-menu">
              {SSR_OPTIONS.map((code) => (
                <li
                  key={code}
                  className={serviceFilter.includes(code) ? "selected" : ""}
                  onClick={() =>
                    onServiceFilter(serviceFilter.includes(code) ? serviceFilter.filter((c) => c !== code) : [...serviceFilter, code])
                  }
                >
                  {code}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pax-search-field" style={{ width: 190 }}>
          <div className="input-box">
            <SearchIcon size={16} />
            <input placeholder={t("Search ancillary…")} value={asvcFilter} onChange={(e) => onAsvcFilter(e.target.value)} />
          </div>
        </div>

        <div className="spacer" />

        <span className="passengers-count">{totalCount} {t("pax")}</span>

        {!hideAddPassenger && (
          <button type="button" className="tertiary" onClick={onAddPassenger}>{t("Add pax")}</button>
        )}

        <div className="pax-columns-menu" ref={columnsRef}>
          <button type="button" className="icon-button pax-columns-trigger" title={t("Columns")} onClick={() => setColumnsOpen((o) => !o)}>
            <MoreIcon size={20} />
          </button>
          {columnsOpen && (
            <ul className="select-menu pax-columns-list">
              {PASSENGER_COLUMNS.map((c) => (
                <li key={c.key} className="pax-columns-item" onClick={() => onToggleColumn(c.key)}>
                  <input type="checkbox" checked={visibleColumns.has(c.key)} readOnly />
                  {t(c.label)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
