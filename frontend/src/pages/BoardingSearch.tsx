import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Flight } from "../api";
import { useRegisterTab } from "../tabs";

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
 * Boarding/gate workstation, landing screen: lists every flight currently
 * open for check-in or boarding (status CHECKIN_OPEN/BOARDING) so a gate
 * agent can just pick theirs and open its boarding screen (/boarding/:flightId).
 * The lookup-by-flight-number search box is dropped for now — see the
 * caller's request — until there's a real need to search past this list.
 */
export function BoardingSearch() {
  useRegisterTab("Boarding Search");
  const navigate = useNavigate();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  const results = useMemo(
    () => flights.filter((f) => f.status === "CHECKIN_OPEN" || f.status === "BOARDING"),
    [flights]
  );

  function openFlight(f: Flight) {
    navigate(`/boarding/${f.id}`);
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

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
                    <span className={`chip middle ${f.status === "BOARDING" ? "warn" : "ok"}`}>{f.status}</span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No flights currently open for check-in or boarding.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
