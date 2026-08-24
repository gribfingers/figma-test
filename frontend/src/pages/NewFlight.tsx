import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { DateTimePicker } from "../components/DateTimePicker";
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
    if (!form.std) return setError("Departure date/time is required");
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
              <input value={form.carrier_code} onChange={(e) => setForm({ ...form, carrier_code: e.target.value.toUpperCase() })} maxLength={3} required placeholder=" " />
            </Field>
            <Field label="Flight number">
              <input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} required placeholder=" " />
            </Field>
            <Field label="Origin (IATA)">
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })} maxLength={3} required placeholder=" " />
            </Field>
            <Field label="Destination (IATA)">
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} maxLength={3} required placeholder=" " />
            </Field>
            <DateTimePicker
              label="Departure date/time"
              value={form.std}
              onChange={(v) => setForm({ ...form, std: v })}
            />
            <Select
              label="Aircraft type"
              value={form.aircraft_type}
              onChange={(v) => setForm({ ...form, aircraft_type: v })}
              options={AIRCRAFT_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <button type="submit" style={{ marginTop: 4 }}>Create flight</button>
        </form>
      </div>
    </div>
  );
}
