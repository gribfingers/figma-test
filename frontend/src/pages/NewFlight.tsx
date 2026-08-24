import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { AirportSelect } from "../components/AirportSelect";
import { DateTimePicker } from "../components/DateTimePicker";
import { PlaneIcon } from "../components/Icon";
import { useRegisterTab } from "../tabs";
import { AIRCRAFT_TYPES } from "../aircraftTypes";

const AGREEMENT_TYPES = [
  { value: "codeshare", label: "Codeshare" },
  { value: "interline", label: "Interline" },
  { value: "own", label: "Own flight" },
];

// Same checklist as the flight card's Main tab — not backed by a schema
// field yet, kept as local UI state for now.
const CHECKS = [
  "Mandatory boarding control",
  "Block boarding pending baggage/service payment check",
  "E-ticket check",
  "Document verification check at boarding",
  "Paid seating",
  "Free seating",
  "iAPP",
];

// This reuses the flight card's Main tab layout — the manual route editor
// (Airport/Terminal fields, opened there via "Change route") is exactly
// what small airports without a preloaded schedule need to enter a flight
// by hand, so the creation form is that same screen instead of a
// separate one.
export function NewFlight() {
  useRegisterTab("New flight");
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const [carrierCode, setCarrierCode] = useState("SU");
  const [flightNumber, setFlightNumber] = useState("");
  const [aircraftType, setAircraftType] = useState("A320");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [std, setStd] = useState("");
  const [terminalFrom, setTerminalFrom] = useState("");
  const [terminalTo, setTerminalTo] = useState("");
  const [checkinDesk, setCheckinDesk] = useState("");
  const [gate, setGate] = useState("");
  const [acReg, setAcReg] = useState("");
  const [seatConfig, setSeatConfig] = useState("");
  const [comment, setComment] = useState("");
  const [partnerFlight, setPartnerFlight] = useState("");
  const [agreement, setAgreement] = useState("codeshare");
  const [apis, setApis] = useState(false);
  const [maxWeight, setMaxWeight] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  async function createFlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!origin || !destination) return setError("Origin and destination airports are required");
    if (!std) return setError("Departure date/time is required");
    try {
      const flight = await api.createFlight({
        carrier_code: carrierCode,
        flight_number: flightNumber,
        origin,
        destination,
        std: new Date(std).toISOString(),
        aircraft_type: aircraftType,
      });
      navigate(`/flights/${flight.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <form onSubmit={createFlight}>
      <div className="flight-card-panel">
        <div className="flight-card-head">
          <div className="flight-card-id">
            <div className="flight-card-number">New flight</div>
            <div className="flight-card-date">Manual entry — for flights without a preloaded schedule</div>
          </div>
          <div className="flight-card-actions">
            <button type="submit">Create flight</button>
          </div>
        </div>

        <div className="flight-card-body">
          {error && <div className="error-box">{error}</div>}
          <div className="grid-2">
            <div className="segment-card">
              <div className="grid-3">
                <Field label="Airline (IATA)">
                  <input
                    value={carrierCode}
                    maxLength={3}
                    required
                    onChange={(e) => setCarrierCode(e.target.value.toUpperCase())}
                    placeholder=" "
                  />
                </Field>
                <Field label="Flight number">
                  <input value={flightNumber} required onChange={(e) => setFlightNumber(e.target.value)} placeholder=" " />
                </Field>
                <Select
                  label="Aircraft type"
                  value={aircraftType}
                  onChange={setAircraftType}
                  options={AIRCRAFT_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </div>

              <div className="segment-endpoints" style={{ marginTop: 16 }}>
                <div className="segment-point-edit">
                  <AirportSelect label="Airport" value={origin} onChange={setOrigin} style={{ width: 84 }} />
                  <Field label="Terminal" style={{ width: 84 }}>
                    <input value={terminalFrom} onChange={(e) => setTerminalFrom(e.target.value)} placeholder=" " />
                  </Field>
                </div>
                <div className="segment-duration" />
                <div className="segment-point-edit">
                  <AirportSelect label="Airport" value={destination} onChange={setDestination} style={{ width: 84 }} />
                  <Field label="Terminal" style={{ width: 84 }}>
                    <input value={terminalTo} onChange={(e) => setTerminalTo(e.target.value)} placeholder=" " />
                  </Field>
                </div>
              </div>
              <div className="segment-path">
                <span className="segment-dot" />
                <span className="segment-line-fill" />
                <PlaneIcon size={16} className="segment-plane" />
                <span className="segment-line-fill" />
                <span className="segment-dot" />
              </div>

              <div className="grid-3">
                <DateTimePicker label="Departure date/time" value={std} onChange={setStd} />
                <Field label="Check-in desk">
                  <input value={checkinDesk} onChange={(e) => setCheckinDesk(e.target.value)} placeholder=" " />
                </Field>
                <Field label="A/C reg">
                  <input value={acReg} onChange={(e) => setAcReg(e.target.value)} placeholder=" " />
                </Field>
              </div>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <Field label="Gate">
                  <input value={gate} onChange={(e) => setGate(e.target.value)} placeholder=" " />
                </Field>
                <Field label="Seat config">
                  <input value={seatConfig} onChange={(e) => setSeatConfig(e.target.value)} placeholder=" " />
                </Field>
              </div>
            </div>

            <div className="main-tab-side">
              <div className="field2 tall">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder=" " rows={3} />
                <label>Flight comment</label>
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <Field label="Partner flight">
                  <input value={partnerFlight} onChange={(e) => setPartnerFlight(e.target.value)} placeholder=" " />
                </Field>
                <Select label="Agreement type" value={agreement} onChange={setAgreement} options={AGREEMENT_TYPES} />
              </div>

              <div className="grid-2" style={{ marginTop: 16, alignItems: "center" }}>
                <button
                  type="button"
                  className={`secondary apis-toggle ${apis ? "on" : "off"}`}
                  onClick={() => setApis((v) => !v)}
                >
                  APIS
                </button>
                <Field label="Max KZ, kg">
                  <input value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder=" " />
                </Field>
              </div>

              <div className="checkbox-list">
                {CHECKS.map((c) => (
                  <label key={c} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={!!checks[c]}
                      onChange={() => setChecks((prev) => ({ ...prev, [c]: !prev[c] }))}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
