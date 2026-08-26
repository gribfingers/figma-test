import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, PassengerSearchMode, PassengerSearchResult } from "../api";
import { useRegisterTab } from "../tabs";

const MODES: { key: PassengerSearchMode; label: string }[] = [
  { key: "surname", label: "Last Name" },
  { key: "pnr", label: "PNR" },
  { key: "eticket", label: "E-ticket" },
  { key: "doc", label: "Doc" },
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
  useRegisterTab("Search", false);
  const navigate = useNavigate();

  const [mode, setMode] = useState<PassengerSearchMode>("surname");
  const [query, setQuery] = useState("");

  const [results, setResults] = useState<PassengerSearchResult[] | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [paxQuickFilter, setPaxQuickFilter] = useState<PaxQuickFilterKey>("all");

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
    } finally {
      setSearching(false);
    }
  }

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const test = PAX_QUICK_FILTERS.find((f) => f.key === paxQuickFilter)?.test ?? (() => true);
    return results.filter(test);
  }, [results, paxQuickFilter]);

  function openPassenger(flightId: number, presetQuery?: string) {
    navigate(`/checkin/${flightId}`, { state: presetQuery ? { presetQuery } : undefined });
  }

  return (
    <div>
      <h1>Check-in agent workstation</h1>

      <div className="panel">
        <form onSubmit={runSearch}>
          <div className="toolbar" style={{ margin: 0 }}>
            <div className="search-mode-bar" style={{ flex: 1 }}>
              <div className="search-mode-tabs">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`search-mode-tab ${mode === m.key ? "selected" : ""}`}
                    disabled={searching}
                    onClick={() => setMode(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <input
                className="search-mode-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                disabled={searching}
                autoFocus
              />
            </div>
            <button type="submit" disabled={searching}>Search</button>
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
                  {f.label} ({results.filter(f.test).length})
                </button>
              ))}
            </div>
            <span className="passengers-count">{filteredResults.length} results</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Destination</th>
                  <th>Flight</th>
                  <th>Date&amp;Time</th>
                  <th>PNR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((p) => (
                  <tr key={p.id} className="row-hover" onClick={() => openPassenger(p.flight_id, p.record_locator)}>
                    <td>{p.surname}/{p.given_name}</td>
                    <td className="mono">{p.destination}</td>
                    <td className="mono">{p.carrier_code}{p.flight_number}</td>
                    <td className="mono">{fmtStd(p.std)}</td>
                    <td className="mono">{p.record_locator}</td>
                    <td>
                      <span className={`chip middle ${p.checkin_status === "CHECKED_IN" ? "ok" : "muted"}`}>
                        {p.checkin_status === "CHECKED_IN" ? "Checked in" : "Not checked in"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No passengers match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
