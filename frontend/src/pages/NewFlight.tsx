import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { PlusIcon } from "../components/Icon";
import { EMPTY_SEGMENT, SegmentDraft, combineDateAndTime } from "../components/flightcard/mainDraft";
import { SegmentCard } from "../components/flightcard/SegmentCard";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { AIRCRAFT_TYPES } from "../aircraftTypes";
import { MAX_SEGMENTS } from "../flightSegments";
import { alphanumericUpper, digitsOnly } from "../validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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
// separate one. Segment cards are always in edit mode here (there's
// nothing to "view" yet) and support the same Add/Remove segment flow as
// the flight card, up to MAX_SEGMENTS legs.
export function NewFlight() {
  useRegisterTab("New flight");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [error, setError] = useState("");

  const [carrierCode, setCarrierCode] = useState("SU");
  const [flightNumber, setFlightNumber] = useState("");
  const [aircraftType, setAircraftType] = useState("A320");
  const [segments, setSegments] = useState<SegmentDraft[]>([{ ...EMPTY_SEGMENT }]);
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

  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSegment() {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...EMPTY_SEGMENT, depAirport: last?.arrAirport ?? "" }];
    });
  }
  function removeSegment(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createFlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const first = segments[0];
    if (!first.depAirport || !first.arrAirport) return setError("Origin and destination airports are required");
    if (!DATE_RE.test(first.depDate) || !TIME_RE.test(first.depTime)) return setError("Departure date/time is required");
    const now = new Date().toISOString();
    const std = combineDateAndTime(now, first.depDate, first.depTime);
    const sta = DATE_RE.test(first.arrDate) && TIME_RE.test(first.arrTime) ? combineDateAndTime(now, first.arrDate, first.arrTime) : undefined;
    const extra = JSON.stringify({
      checkinDesk,
      comment,
      partnerFlight,
      agreement,
      apis,
      maxWeight,
      checks,
      segments: [
        { terminalTo: first.terminalTo },
        ...segments.slice(1).map((s) => ({
          origin: s.depAirport,
          destination: s.arrAirport,
          std: combineDateAndTime(std, s.depDate, s.depTime),
          sta: combineDateAndTime(sta ?? std, s.arrDate, s.arrTime),
          terminalFrom: s.terminalFrom,
          terminalTo: s.terminalTo,
        })),
      ],
    });
    try {
      const flight = await api.createFlight({
        carrier_code: carrierCode,
        flight_number: flightNumber,
        origin: first.depAirport,
        destination: first.arrAirport,
        std,
        sta,
        terminal: first.terminalFrom || null,
        gate: gate || null,
        aircraft_reg: acReg || null,
        aircraft_version: seatConfig || null,
        aircraft_type: aircraftType,
        extra,
      });
      navigate(`/flights/${flight.id}`);
      showToast("Flight created");
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
                  onFocus={(e) => e.target.select()}
                  onMouseUp={(e) => e.preventDefault()}
                  placeholder=" "
                />
              </Field>
              <Field label="Flight number" style={{ width: 124 }}>
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
          <div className="grid-2 flight-main-grid">
            <div className="segment-cards">
              {segments.map((segment, i) => (
                <SegmentCard
                  key={i}
                  segment={segment}
                  editing
                  removable={segments.length > 1}
                  onChange={(patch) => updateSegment(i, patch)}
                  onRemove={() => removeSegment(i)}
                />
              ))}
              {segments.length < MAX_SEGMENTS && (
                <button type="button" className="secondary segment-add" onClick={addSegment}>
                  <PlusIcon size={14} /> Add segment
                </button>
              )}

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
