import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Flight, PassengerSearchMode, PassengerSearchResult } from "../api";
import { Field } from "../components/Field";
import { DateTimePicker } from "../components/DateTimePicker";
import { useRegisterTab } from "../tabs";

const MODES: { key: PassengerSearchMode; label: string }[] = [
  { key: "surname", label: "Last Name" },
  { key: "pnr", label: "PNR" },
  { key: "eticket", label: "E-ticket" },
  { key: "doc", label: "Doc" },
];

const EMPTY_FLIGHT_FILTER = { airline: "", flight: "", destination: "", dateFrom: "", dateTo: "", checkinOpen: false };

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
 * desk and the agent looks them up either by personal data (last name/PNR/
 * e-ticket/doc — across every flight, since the agent doesn't necessarily
 * know which one yet) or by the flight itself. Either search opens the
 * matching flight's existing check-in screen (see CheckIn.tsx).
 */
export function Search() {
  useRegisterTab("Search", false);
  const navigate = useNavigate();

  const [mode, setMode] = useState<PassengerSearchMode>("surname");
  const [query, setQuery] = useState("");
  const [paxResults, setPaxResults] = useState<PassengerSearchResult[] | null>(null);
  const [paxError, setPaxError] = useState("");
  const [searchingPax, setSearchingPax] = useState(false);
  const [paxQuickFilter, setPaxQuickFilter] = useState<PaxQuickFilterKey>("all");

  const [filter, setFilter] = useState(EMPTY_FLIGHT_FILTER);
  const [flightResults, setFlightResults] = useState<Flight[] | null>(null);
  const [searchingFlights, setSearchingFlights] = useState(false);

  async function runPaxSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchingPax(true);
    setPaxError("");
    setFlightResults(null);
    setPaxQuickFilter("all");
    try {
      const results = await api.searchPassengers(mode, query.trim());
      setPaxResults(results);
    } catch (err: any) {
      setPaxError(err.message);
    } finally {
      setSearchingPax(false);
    }
  }

  async function runFlightSearch() {
    setSearchingFlights(true);
    setPaxResults(null);
    try {
      const flights = await api.listFlights();
      const filtered = flights.filter((f) => {
        if (filter.airline && !f.carrier_code.toLowerCase().includes(filter.airline.toLowerCase())) return false;
        if (filter.flight && !f.flight_number.toLowerCase().includes(filter.flight.toLowerCase())) return false;
        if (filter.destination && !f.destination.toLowerCase().includes(filter.destination.toLowerCase())) return false;
        if (filter.dateFrom && new Date(f.std) < new Date(filter.dateFrom)) return false;
        if (filter.dateTo && new Date(f.std) > new Date(filter.dateTo)) return false;
        if (filter.checkinOpen && (f.status === "CLOSED" || f.status === "DEPARTED")) return false;
        return true;
      });
      setFlightResults(filtered);
    } finally {
      setSearchingFlights(false);
    }
  }

  const filteredPaxResults = useMemo(() => {
    if (!paxResults) return [];
    const test = PAX_QUICK_FILTERS.find((f) => f.key === paxQuickFilter)?.test ?? (() => true);
    return paxResults.filter(test);
  }, [paxResults, paxQuickFilter]);

  function openFlight(flightId: number, presetQuery?: string) {
    navigate(`/checkin/${flightId}`, { state: presetQuery ? { presetQuery } : undefined });
  }

  return (
    <div>
      <h1>Check-in agent workstation</h1>

      <div className="panel">
        <form onSubmit={runPaxSearch}>
          <div className="search-mode-bar">
            <div className="search-mode-tabs">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`search-mode-tab ${mode === m.key ? "selected" : ""}`}
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
            />
          </div>
        </form>

        <div className="toolbar" style={{ marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Airline" style={{ minWidth: 110 }}>
            <input value={filter.airline} onChange={(e) => setFilter({ ...filter, airline: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <Field label="Flight" style={{ minWidth: 100 }}>
            <input value={filter.flight} onChange={(e) => setFilter({ ...filter, flight: e.target.value })} placeholder=" " />
          </Field>
          <Field label="Destination" style={{ minWidth: 120 }}>
            <input value={filter.destination} onChange={(e) => setFilter({ ...filter, destination: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <DateTimePicker label="Date/Time from" style={{ minWidth: 170 }} value={filter.dateFrom} onChange={(v) => setFilter({ ...filter, dateFrom: v })} />
          <DateTimePicker label="Date/Time to" style={{ minWidth: 170 }} value={filter.dateTo} onChange={(v) => setFilter({ ...filter, dateTo: v })} />
          <label className="checkbox-row" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={filter.checkinOpen}
              onChange={(e) => setFilter({ ...filter, checkinOpen: e.target.checked })}
            />
            Check-in is open
          </label>
          <button type="button" onClick={runFlightSearch} disabled={searchingFlights}>Search</button>
        </div>
      </div>

      {paxError && <div className="error-box">{paxError}</div>}

      {paxResults && (
        <div className="panel panel--flush">
          <div className="panel-head pax-search-results-head">
            <div className="pax-quick-filters">
              {PAX_QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`pax-quick-filter ${paxQuickFilter === f.key ? "selected" : ""}`}
                  onClick={() => setPaxQuickFilter(f.key)}
                >
                  {f.label} ({paxResults.filter(f.test).length})
                </button>
              ))}
            </div>
            <span className="passengers-count">{filteredPaxResults.length} results</span>
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
                {filteredPaxResults.map((p) => (
                  <tr key={p.id} className="row-hover" onClick={() => openFlight(p.flight_id, p.record_locator)}>
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
                {filteredPaxResults.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No passengers match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {flightResults && (
        <div className="panel panel--flush">
          <h3 className="panel-head">Flights ({flightResults.length})</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>STD</th>
                  <th>Airline</th>
                  <th>Flight</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flightResults.map((f) => (
                  <tr key={f.id} className="row-hover" onClick={() => openFlight(f.id)}>
                    <td className="mono">{fmtStd(f.std)}</td>
                    <td>{f.carrier_code}</td>
                    <td className="mono">{f.flight_number}</td>
                    <td className="mono">{f.origin} → {f.destination}</td>
                    <td>
                      <span className={`chip middle ${f.status === "CLOSED" || f.status === "DEPARTED" ? "danger" : "ok"}`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {flightResults.length === 0 && (
                  <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No flights match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
