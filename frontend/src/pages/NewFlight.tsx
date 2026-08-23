import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Field } from "../components/Field";
import { ArrowBackIcon } from "../components/Icon";

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
      <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <ArrowBackIcon size={16} /> Flight board
      </Link>
      <h1>New flight</h1>
      <p className="subtitle">Create a scheduled flight and its cabin seat map.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel" style={{ maxWidth: 560 }}>
        <form onSubmit={createFlight}>
          <div className="grid-2">
            <Field label="Airline (IATA code)">
              <input value={form.carrier_code} onChange={(e) => setForm({ ...form, carrier_code: e.target.value.toUpperCase() })} maxLength={3} required />
            </Field>
            <Field label="Flight number">
              <input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} required />
            </Field>
            <Field label="Origin (IATA)">
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })} maxLength={3} required />
            </Field>
            <Field label="Destination (IATA)">
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} maxLength={3} required />
            </Field>
            <Field label="Departure date/time">
              <input type="datetime-local" value={form.std} onChange={(e) => setForm({ ...form, std: e.target.value })} required />
            </Field>
            <Field label="Aircraft type">
              <select value={form.aircraft_type} onChange={(e) => setForm({ ...form, aircraft_type: e.target.value })}>
                {AIRCRAFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <button type="submit" style={{ marginTop: 4 }}>Create flight</button>
        </form>
      </div>
    </div>
  );
}
