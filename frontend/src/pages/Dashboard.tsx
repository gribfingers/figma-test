import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Flight } from "../api";

const AIRCRAFT_TYPES = ["A320", "B738"];

const OPS_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  DELAYED: "Delayed",
  BOARDING: "Boarding",
  DEPARTED: "Departed",
  ARRIVED: "Arrived",
  CANCELLED: "Cancelled",
};
const OPS_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "ok",
  DELAYED: "warn",
  BOARDING: "warn",
  DEPARTED: "muted",
  ARRIVED: "muted",
  CANCELLED: "danger",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
}

export function Dashboard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    flight_number: "",
    carrier_code: "SU",
    origin: "",
    destination: "",
    std: "",
    aircraft_type: "A320",
  });

  function load() {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function createFlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createFlight({ ...form, std: new Date(form.std).toISOString() });
      setForm({ ...form, flight_number: "", origin: "", destination: "", std: "" });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1>Flight board</h1>
      <p className="subtitle">Ops desk: create flights and jump to agent workstations.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h3>Flights (departure board)</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>STD</th>
                <th>Airline</th>
                <th>Flight</th>
                <th>Route</th>
                <th>Status</th>
                <th>ETD</th>
                <th>STA</th>
                <th>ATA</th>
                <th>Terminal</th>
                <th>Gate</th>
                <th>Type</th>
                <th>A/C reg</th>
                <th>Version</th>
                <th>DCS status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{formatTime(f.std)}</td>
                  <td>{f.carrier_code}</td>
                  <td className="mono">{f.carrier_code}{f.flight_number}</td>
                  <td className="mono">{f.origin} → {f.destination}</td>
                  <td><span className={`badge ${OPS_STATUS_BADGE[f.ops_status] ?? "muted"}`}>{OPS_STATUS_LABEL[f.ops_status] ?? f.ops_status}</span></td>
                  <td className="mono">{formatTime(f.etd)}</td>
                  <td className="mono">{formatTime(f.sta)}</td>
                  <td className="mono">{formatTime(f.ata)}</td>
                  <td className="mono">{f.terminal ?? "—"}</td>
                  <td className="mono">{f.gate ?? "—"}</td>
                  <td>{f.aircraft_type}</td>
                  <td className="mono">{f.aircraft_reg ?? "—"}</td>
                  <td>{f.aircraft_version ?? "—"}</td>
                  <td><span className={`badge ${f.status === "CLOSED" ? "danger" : f.status === "BOARDING" ? "warn" : "ok"}`}>{f.status}</span></td>
                  <td style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                    <Link to={`/checkin/${f.id}`}><button className="secondary">Check-in</button></Link>
                    <Link to={`/boarding/${f.id}`}><button className="secondary">Boarding</button></Link>
                  </td>
                </tr>
              ))}
              {flights.length === 0 && (
                <tr><td colSpan={15} style={{ color: "var(--muted)" }}>No flights yet — create the first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>New flight</h3>
          <form onSubmit={createFlight}>
            <div className="grid-2">
              <div className="field">
                <label>Airline (IATA code)</label>
                <input value={form.carrier_code} onChange={(e) => setForm({ ...form, carrier_code: e.target.value.toUpperCase() })} maxLength={3} required />
              </div>
              <div className="field">
                <label>Flight number</label>
                <input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} required />
              </div>
              <div className="field">
                <label>Origin (IATA)</label>
                <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })} maxLength={3} required />
              </div>
              <div className="field">
                <label>Destination (IATA)</label>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} maxLength={3} required />
              </div>
              <div className="field">
                <label>Departure date/time</label>
                <input type="datetime-local" value={form.std} onChange={(e) => setForm({ ...form, std: e.target.value })} required />
              </div>
              <div className="field">
                <label>Aircraft type</label>
                <select value={form.aircraft_type} onChange={(e) => setForm({ ...form, aircraft_type: e.target.value })}>
                  {AIRCRAFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button type="submit">Create flight</button>
          </form>
        </div>
      </div>
    </div>
  );
}
