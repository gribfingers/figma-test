import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { AirportSelect } from "../components/AirportSelect";
import { PlaneIcon } from "../components/Icon";
import { combineDateAndTime } from "../components/flightcard/mainDraft";
import { useRegisterTab } from "../tabs";
import { AIRCRAFT_TYPES } from "../aircraftTypes";
import { alphanumericUpper, dateInput, digitsOnly, timeInput } from "../validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function fmtDuration(depDate: string, depTime: string, arrDate: string, arrTime: string): string {
  if (!DATE_RE.test(depDate) || !TIME_RE.test(depTime) || !DATE_RE.test(arrDate) || !TIME_RE.test(arrTime)) return "";
  const dep = new Date(`${depDate}T${depTime}:00Z`).getTime();
  const arr = new Date(`${arrDate}T${arrTime}:00Z`).getTime();
  const mins = Math.round((arr - dep) / 60000);
  if (mins <= 0) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

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
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");
  const [arrDate, setArrDate] = useState("");
  const [arrTime, setArrTime] = useState("");
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
    if (!DATE_RE.test(depDate) || !TIME_RE.test(depTime)) return setError("Departure date/time is required");
    const std = combineDateAndTime(new Date().toISOString(), depDate, depTime);
    const sta =
      DATE_RE.test(arrDate) && TIME_RE.test(arrTime) ? combineDateAndTime(new Date().toISOString(), arrDate, arrTime) : undefined;
    try {
      const flight = await api.createFlight({
        carrier_code: carrierCode,
        flight_number: flightNumber,
        origin,
        destination,
        std,
        sta,
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
            <div className="new-flight-number-fields">
              <Field label="Airline (IATA)" style={{ width: 108 }}>
                <input
                  value={carrierCode}
                  required
                  onChange={(e) => setCarrierCode(alphanumericUpper(e.target.value, 3))}
                  placeholder=" "
                />
              </Field>
              <Field label="Flight number" style={{ width: 108 }}>
                <input
                  value={flightNumber}
                  required
                  onChange={(e) => setFlightNumber(alphanumericUpper(e.target.value, 5))}
                  placeholder=" "
                />
              </Field>
            </div>
            <div className="flight-card-date">Manual entry — for flights without a preloaded schedule</div>
          </div>
          <div />
          <div className="flight-card-actions">
            <button type="submit">Create flight</button>
          </div>
        </div>

        <div className="flight-card-body">
          {error && <div className="error-box">{error}</div>}
          <div className="grid-2">
            <div className="segment-card">
              <div className="segment-endpoints">
                <div className="segment-point-edit">
                  <AirportSelect label="Airport" value={origin} onChange={setOrigin} style={{ width: 84 }} />
                  <Field label="Date" style={{ width: 132 }}>
                    <input value={depDate} onChange={(e) => setDepDate(dateInput(e.target.value))} placeholder=" " />
                  </Field>
                  <Field label="Time" style={{ width: 66 }}>
                    <input value={depTime} onChange={(e) => setDepTime(timeInput(e.target.value))} placeholder=" " />
                  </Field>
                  <Field label="Terminal" style={{ width: 84 }}>
                    <input
                      value={terminalFrom}
                      onChange={(e) => setTerminalFrom(alphanumericUpper(e.target.value, 2))}
                      placeholder=" "
                    />
                  </Field>
                </div>
                <div className="segment-duration">{fmtDuration(depDate, depTime, arrDate, arrTime)}</div>
                <div className="segment-point-edit">
                  <AirportSelect label="Airport" value={destination} onChange={setDestination} style={{ width: 84 }} />
                  <Field label="Date" style={{ width: 132 }}>
                    <input value={arrDate} onChange={(e) => setArrDate(dateInput(e.target.value))} placeholder=" " />
                  </Field>
                  <Field label="Time" style={{ width: 66 }}>
                    <input value={arrTime} onChange={(e) => setArrTime(timeInput(e.target.value))} placeholder=" " />
                  </Field>
                  <Field label="Terminal" style={{ width: 84 }}>
                    <input
                      value={terminalTo}
                      onChange={(e) => setTerminalTo(alphanumericUpper(e.target.value, 2))}
                      placeholder=" "
                    />
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
                <Select
                  label="AC type"
                  value={aircraftType}
                  onChange={setAircraftType}
                  options={AIRCRAFT_TYPES.map((t) => ({ value: t, label: t }))}
                />
                <Field label="Check-in desk">
                  <input
                    value={checkinDesk}
                    onChange={(e) => setCheckinDesk(digitsOnly(e.target.value, 4))}
                    placeholder=" "
                  />
                </Field>
                <Field label="A/C reg">
                  <input
                    value={acReg}
                    onChange={(e) => setAcReg(alphanumericUpper(e.target.value, 10))}
                    placeholder=" "
                  />
                </Field>
              </div>
              <div className="grid-3" style={{ marginTop: 12 }}>
                <div className="segment-flighttype">
                  Flight type: <b>Scheduled</b>
                </div>
                <Field label="Gate">
                  <input value={gate} onChange={(e) => setGate(digitsOnly(e.target.value, 3))} placeholder=" " />
                </Field>
                <Field label="Seat config">
                  <input
                    value={seatConfig}
                    onChange={(e) => setSeatConfig(alphanumericUpper(e.target.value, 12))}
                    placeholder=" "
                  />
                </Field>
              </div>
            </div>

            <div className="main-tab-side">
              <div className="field2 tall">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder=" "
                  rows={3}
                  maxLength={500}
                />
                <label>Flight comment</label>
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <Field label="Partner flight">
                  <input
                    value={partnerFlight}
                    onChange={(e) => setPartnerFlight(alphanumericUpper(e.target.value, 8))}
                    placeholder=" "
                  />
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
                  <input
                    value={maxWeight}
                    onChange={(e) => setMaxWeight(digitsOnly(e.target.value, 6))}
                    placeholder=" "
                  />
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
