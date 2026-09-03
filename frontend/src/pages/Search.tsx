import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, PassengerSearchMode, PassengerSearchResult } from "../api";
import { useRegisterTab, useTabs } from "../tabs";
import { clearPersistentState, usePersistentState } from "../usePersistentState";
import { SortTh, useSort } from "../components/SortTh";
import { useLanguage } from "../i18n";
import { useHotkey } from "../useShortcuts";

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

  function openPassenger(p: PassengerSearchResult) {
    navigate(`/checkin/${p.flight_id}/pnr/${p.id}`);
  }

  return (
    <div>
      <div className="panel">
        <form onSubmit={runSearch}>
          <div className="toolbar" style={{ margin: 0 }}>
            <div className="search-mode-bar" style={{ flex: 1 }}>
              <div className="search-mode-tabs">
                {SEARCH_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`search-mode-tab ${mode === m.key ? "selected" : ""}`}
                    disabled={searching}
                    onClick={() => setMode(m.key)}
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
                disabled={searching}
                autoFocus
              />
            </div>
            <button type="submit" disabled={searching}>{t("Search")}</button>
          </div>
        </form>
      </div>

      {error && <div className="error-box">{error}</div>}

      {results && (
        <div className="panel panel--flush">
          <div className="pax-search-results-head panel-head">
            <div className="pax-quick-filters">
              {PAX_QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`pax-quick-filter ${paxQuickFilter === f.key ? "selected" : ""}`}
                  onClick={() => setPaxQuickFilter(f.key)}
                >
                  {t(f.label)} ({results.filter(f.test).length})
                </button>
              ))}
            </div>
            <span className="passengers-count">{filteredResults.length} {t("results")}</span>
          </div>
          <div className="table-scroll">
            <table>
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
                  <tr key={p.id} className="row-hover" onClick={() => openPassenger(p)}>
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
