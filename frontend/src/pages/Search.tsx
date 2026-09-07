import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, PassengerSearchMode, PassengerSearchResult } from "../api";
import { useRegisterTab, useTabs } from "../tabs";
import { clearPersistentState, usePersistentState } from "../usePersistentState";
import { SortTh, useSort } from "../components/SortTh";
import { useLanguage } from "../i18n";
import { useHotkey } from "../useShortcuts";
import { useShortcutTitle } from "../shortcutHints";

type ResultSortKey = "name" | "destination" | "flight" | "std" | "pnr" | "status";
const RESULT_SORT_GETTERS: Record<ResultSortKey, (p: PassengerSearchResult) => string | number> = {
  name: (p) => `${p.surname}/${p.given_name}`,
  destination: (p) => p.destination,
  flight: (p) => `${p.carrier_code}${p.flight_number}`,
  std: (p) => p.std,
  pnr: (p) => p.record_locator,
  status: (p) => p.checkin_status,
};

export const SEARCH_MODES: { key: PassengerSearchMode; label: string; placeholder: string }[] = [
  { key: "surname", label: "Last Name", placeholder: "Search" },
  { key: "pnr", label: "PNR", placeholder: "Search" },
  { key: "eticket", label: "E-ticket", placeholder: "Search" },
  { key: "doc", label: "Doc", placeholder: "Search" },
  { key: "flight", label: "Flight", placeholder: "Flight number, e.g. SU1234" },
];

type PaxQuickFilterKey = "all" | "checked_in" | "not_checked_in" | "boarded" | "unknown";
const PAX_QUICK_FILTERS: { key: PaxQuickFilterKey; label: string; test: (p: PassengerSearchResult) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "checked_in", label: "Checked in", test: (p) => p.checkin_status === "CHECKED_IN" },
  { key: "not_checked_in", label: "Not Checked In", test: (p) => p.checkin_status === "NOT_CHECKED_IN" },
  { key: "boarded", label: "Boarded", test: (p) => p.boarding_status === "BOARDED" },
  { key: "unknown", label: "Unknown", test: (p) => p.boarding_status === "OFFLOADED" || p.boarding_status === "NO_SHOW" },
];

// Matches FlightCardHeader's fmtCardDate style (DDMMMYY HH:mm), same UTC
// wall-clock convention as the rest of the app.
function fmtStd(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} ${time}`;
}

/**
 * Check-in agent workstation, landing screen: a passenger walks up to the
 * desk and the agent looks them up by personal data (last name/PNR/e-ticket/
 * doc — across every flight, since the agent doesn't necessarily know which
 * one yet). Finding a flight's whole passenger list instead still goes
 * through Flight Schedule → the flight card's Pax tab, same as before this
 * screen existed. The search bar stays put; a status quick-filter bar
 * appears above the results once a search comes back.
 */
export function Search() {
  const { t } = useLanguage();
  useRegisterTab(t("Check-in Search"));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { onTabClose } = useTabs();

  const [mode, setMode] = usePersistentState<PassengerSearchMode>("dcs_search_mode", "surname");
  const [query, setQuery] = usePersistentState("dcs_search_query", "");

  const [results, setResults] = usePersistentState<PassengerSearchResult[] | null>("dcs_search_results", null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [paxQuickFilter, setPaxQuickFilter] = usePersistentState<PaxQuickFilterKey>("dcs_search_quick_filter", "all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkey("nav.search-focus", () => searchInputRef.current?.focus());
  const searchFocusTitle = useShortcutTitle("nav.search-focus");

  // Roving tabindex over the mode tabs (Last Name/PNR/…): only the selected one is a Tab stop, so
  // Tab from wherever the agent last was lands on the mode picker as a single stop, then Left/Right
  // switches modes (same as the search field's own placeholder text), then a second Tab reaches the
  // query field — matching a standard ARIA tablist instead of five separate Tab stops to click through.
  const modeTabRefs = useRef(new Map<PassengerSearchMode, HTMLButtonElement>());
  function moveMode(delta: 1 | -1) {
    const idx = SEARCH_MODES.findIndex((m) => m.key === mode);
    const next = SEARCH_MODES[(idx + delta + SEARCH_MODES.length) % SEARCH_MODES.length];
    setMode(next.key);
    modeTabRefs.current.get(next.key)?.focus();
  }

  // Same roving-tabindex pattern for the results' quick-filter bar (All/Checked in/…).
  const quickFilterRefs = useRef(new Map<PaxQuickFilterKey, HTMLButtonElement>());
  function moveFilter(delta: 1 | -1) {
    const idx = PAX_QUICK_FILTERS.findIndex((f) => f.key === paxQuickFilter);
    const next = PAX_QUICK_FILTERS[(idx + delta + PAX_QUICK_FILTERS.length) % PAX_QUICK_FILTERS.length];
    setPaxQuickFilter(next.key);
    quickFilterRefs.current.get(next.key)?.focus();
  }

  // And again for the results table: one row is ever a Tab stop (defaulting to the first once
  // results/filters change), Up/Down moves it, Tab from inside the table is the last stop in this
  // screen's own loop so it wraps back to the mode picker rather than leaving to whatever the
  // browser/app chrome puts next in the DOM.
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);

  // A search's query/results are only useful for as long as this tab stays open — closing it should
  // discard them (results can go stale, e.g. after the demo schedule is regenerated) rather than
  // reappearing next time this tab is opened, unlike a plain tab-switch remount which should keep them.
  useEffect(
    () =>
      onTabClose(pathname, () => {
        clearPersistentState("dcs_search_mode");
        clearPersistentState("dcs_search_query");
        clearPersistentState("dcs_search_results");
        clearPersistentState("dcs_search_quick_filter");
      }),
    [pathname, onTabClose]
  );

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const found = await api.searchPassengers(mode, query.trim());
      setResults(found);
      setPaxQuickFilter("all");
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const test = PAX_QUICK_FILTERS.find((f) => f.key === paxQuickFilter)?.test ?? (() => true);
    return results.filter(test);
  }, [results, paxQuickFilter]);
  const { sorted: sortedResults, sortKey, sortDir, onSort } = useSort(filteredResults, RESULT_SORT_GETTERS);
  const activeRowId = focusedRowId != null && sortedResults.some((p) => p.id === focusedRowId) ? focusedRowId : sortedResults[0]?.id ?? null;
  function moveRow(delta: 1 | -1) {
    const idx = sortedResults.findIndex((p) => p.id === activeRowId);
    if (idx === -1) return;
    const next = sortedResults[Math.max(0, Math.min(sortedResults.length - 1, idx + delta))];
    if (!next) return;
    setFocusedRowId(next.id);
    rowRefs.current.get(next.id)?.focus();
  }

  function openPassenger(p: PassengerSearchResult) {
    navigate(`/checkin/${p.flight_id}/pnr/${p.id}`);
  }

  return (
    <div>
      <div className="panel">
        <form onSubmit={runSearch}>
          <div className="toolbar" style={{ margin: 0 }}>
            <div className="search-mode-bar" style={{ flex: 1 }}>
              <div className="search-mode-tabs" role="tablist" aria-label={t("Search by")}>
                {SEARCH_MODES.map((m) => (
                  <button
                    key={m.key}
                    ref={(el) => {
                      if (el) modeTabRefs.current.set(m.key, el);
                      else modeTabRefs.current.delete(m.key);
                    }}
                    type="button"
                    role="tab"
                    aria-selected={mode === m.key}
                    tabIndex={mode === m.key ? 0 : -1}
                    className={`search-mode-tab ${mode === m.key ? "selected" : ""}`}
                    disabled={searching}
                    onClick={() => setMode(m.key)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") { e.preventDefault(); moveMode(1); }
                      else if (e.key === "ArrowLeft") { e.preventDefault(); moveMode(-1); }
                    }}
                  >
                    {t(m.label)}
                  </button>
                ))}
              </div>
              <input
                ref={searchInputRef}
                className="search-mode-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(SEARCH_MODES.find((m) => m.key === mode)?.placeholder ?? "Search")}
                title={searchFocusTitle}
                disabled={searching}
              />
            </div>
            <button type="submit" disabled={searching || !query.trim()}>{t("Search")}</button>
          </div>
        </form>
      </div>

      {error && <div className="error-box">{error}</div>}

      {results && (
        <div className="panel panel--flush">
          <div className="pax-search-results-head panel-head">
            <div className="pax-quick-filters" role="tablist" aria-label={t("Status filter")}>
              {PAX_QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  ref={(el) => {
                    if (el) quickFilterRefs.current.set(f.key, el);
                    else quickFilterRefs.current.delete(f.key);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={paxQuickFilter === f.key}
                  tabIndex={paxQuickFilter === f.key ? 0 : -1}
                  className={`pax-quick-filter ${paxQuickFilter === f.key ? "selected" : ""}`}
                  onClick={() => setPaxQuickFilter(f.key)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); moveFilter(1); }
                    else if (e.key === "ArrowLeft") { e.preventDefault(); moveFilter(-1); }
                  }}
                >
                  {t(f.label)} ({results.filter(f.test).length})
                </button>
              ))}
            </div>
            <span className="passengers-count">{filteredResults.length} {t("results")}</span>
          </div>
          {/* tabIndex=-1: opt out of Chrome/Safari's automatic Tab-stop for scrollable regions —
              see the same note in PnrView.tsx's roster table. */}
          <div className="table-scroll" tabIndex={-1}>
            {/* table-layout: fixed (via .pax-search-table) + this colgroup pin every column's width
                to the header row alone — without it the browser's default table-layout:auto sizes
                columns from whichever rows are currently visible, so switching a filter (a different
                subset of names/PNRs/statuses, each a different width) visibly resized the columns
                on every click. */}
            <table className="pax-search-table">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr>
                  <SortTh id="name" label={t("Name")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortTh id="destination" label={t("Destination")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortTh id="flight" label={t("Flight")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortTh id="std" label={t("Date&Time")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortTh id="pnr" label="PNR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortTh id="status" label={t("Status")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((p) => (
                  <tr
                    key={p.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(p.id, el);
                      else rowRefs.current.delete(p.id);
                    }}
                    className="row-hover"
                    tabIndex={p.id === activeRowId ? 0 : -1}
                    onFocus={() => setFocusedRowId(p.id)}
                    onClick={() => openPassenger(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPassenger(p);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        moveRow(1);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        moveRow(-1);
                      } else if (e.key === "Tab" && !e.shiftKey) {
                        // Last stop in this screen's own Tab loop — wrap back to the mode picker
                        // instead of leaving to whatever the page puts next in the DOM.
                        e.preventDefault();
                        modeTabRefs.current.get(mode)?.focus();
                      }
                    }}
                  >
                    <td>{p.surname}/{p.given_name}</td>
                    <td className="mono">{p.destination}</td>
                    <td className="mono">{p.carrier_code}{p.flight_number}</td>
                    <td className="mono">{fmtStd(p.std)}</td>
                    <td className="mono">{p.record_locator}</td>
                    <td>
                      <span className={`chip middle ${p.checkin_status === "CHECKED_IN" ? "ok" : "muted"}`}>
                        {p.checkin_status === "CHECKED_IN" ? t("Checked in") : t("Not checked in")}
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedResults.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>{t("No passengers match.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
