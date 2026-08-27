import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Flight } from "../api";
import { useRegisterTab } from "../tabs";
import { usePersistentState } from "../usePersistentState";

// Matches Search.tsx's fmtStd — same UTC wall-clock convention as the rest of the app.
function fmtStd(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} ${time}`;
}

/**
 * Boarding/gate workstation, landing screen: unlike Search (which looks up a
 * specific passenger since check-in agents don't necessarily know their
 * flight yet), a gate agent already knows which flight they're working — so
 * this just finds that flight by airline/number, then opens its boarding
 * screen (/boarding/:flightId).
 */
export function BoardingSearch() {
  useRegisterTab("Boarding Search");
  const navigate = useNavigate();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = usePersistentState("dcs_boarding_search_query", "");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flights.filter((f) => `${f.carrier_code}${f.flight_number}`.toLowerCase().includes(q));
  }, [flights, query]);

  function openFlight(f: Flight) {
    navigate(`/boarding/${f.id}`);
  }

  return (
    <div>
      <div className="panel">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="toolbar" style={{ margin: 0 }}>
            <div className="search-mode-bar" style={{ flex: 1 }}>
              <input
                className="search-mode-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Flight number, e.g. SU5678"
                autoFocus
              />
            </div>
          </div>
        </form>
      </div>

      {error && <div className="error-box">{error}</div>}

      {query.trim() && (
        <div className="panel panel--flush">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Flight</th>
                  <th>Route</th>
                  <th>Date&amp;Time</th>
                  <th>Gate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((f) => (
                  <tr key={f.id} className="row-hover" onClick={() => openFlight(f)}>
                    <td className="mono">{f.carrier_code}{f.flight_number}</td>
                    <td className="mono">{f.origin} → {f.destination}</td>
                    <td className="mono">{fmtStd(f.std)}</td>
                    <td className="mono">{f.gate ?? "—"}</td>
                    <td>
                      <span className={`chip middle ${f.status === "CLOSED" || f.status === "DEPARTED" ? "muted" : "ok"}`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
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
