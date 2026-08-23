import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

const AIRCRAFT_TYPES = ["A320", "B738"];

export function NewFlight() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    flight_number: "",
    carrier_code: "SU",
    origin: "",
    destination: "",
    std: "",
    aircraft_type: "A320",
  });

  async function createFlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createFlight({ ...form, std: new Date(form.std).toISOString() });
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <Link to="/">← Flight board</Link>
      <h1>New flight</h1>
      <p className="subtitle">Create a scheduled flight and its cabin seat map.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel" style={{ maxWidth: 560 }}>
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
  );
}
