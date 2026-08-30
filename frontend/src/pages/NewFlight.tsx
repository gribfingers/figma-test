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
import { MAX_SEGMENTS } from "../flightSegments";
import { alphanumericUpper, digitsOnly } from "../validation";
import { useLanguage } from "../i18n";

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
  const { t } = useLanguage();
  useRegisterTab("New flight");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [error, setError] = useState("");

  const [carrierCode, setCarrierCode] = useState("SU");
  const [flightNumber, setFlightNumber] = useState("");
  const [segments, setSegments] = useState<SegmentDraft[]>([{ ...EMPTY_SEGMENT }]);
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
      return [
        ...prev,
        { ...EMPTY_SEGMENT, depAirport: last?.arrAirport ?? "", aircraftType: last?.aircraftType ?? EMPTY_SEGMENT.aircraftType, acReg: last?.acReg ?? "", seatConfig: last?.seatConfig ?? "" },
      ];
    });
  }
  function removeSegment(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createFlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const first = segments[0];
    if (!first.depAirport || !first.arrAirport) return setError(t("Origin and destination airports are required"));
    if (!DATE_RE.test(first.depDate) || !TIME_RE.test(first.depTime)) return setError(t("Departure date/time is required"));
    const now = new Date().toISOString();
    const std = combineDateAndTime(now, first.depDate, first.depTime);
    const sta = DATE_RE.test(first.arrDate) && TIME_RE.test(first.arrTime) ? combineDateAndTime(now, first.arrDate, first.arrTime) : undefined;
    const extra = JSON.stringify({
      comment,
      partnerFlight,
      agreement,
      apis,
      maxWeight,
      checks,
      segments: [
        { terminalTo: first.terminalTo, checkinDesk: first.checkinDesk },
        ...segments.slice(1).map((s) => ({
          origin: s.depAirport,
          destination: s.arrAirport,
          std: combineDateAndTime(std, s.depDate, s.depTime),
          sta: combineDateAndTime(sta ?? std, s.arrDate, s.arrTime),
          terminalFrom: s.terminalFrom,
          terminalTo: s.terminalTo,
          aircraftType: s.aircraftType,
          checkinDesk: s.checkinDesk,
          gate: s.gate,
          acReg: s.acReg,
          seatConfig: s.seatConfig,
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
        gate: first.gate || null,
        aircraft_reg: first.acReg || null,
        aircraft_version: first.seatConfig || null,
        aircraft_type: first.aircraftType,
        extra,
      });
      navigate(`/flights/${flight.id}`);
      showToast(t("Flight created"));
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
              <Field label={t("Airline (IATA)")} style={{ width: 108 }}>
                <input
                  value={carrierCode}
                  required
                  onChange={(e) => setCarrierCode(alphanumericUpper(e.target.value, 3))}
                  onFocus={(e) => e.target.select()}
                  onMouseUp={(e) => e.preventDefault()}
                  placeholder=" "
                />
              </Field>
              <Field label={t("Flight number")} style={{ width: 124 }}>
                <input
                  value={flightNumber}
                  required
                  onChange={(e) => setFlightNumber(alphanumericUpper(e.target.value, 5))}
                  placeholder=" "
                />
              </Field>
            </div>
            <div className="flight-card-date">{t("Manual entry — for flights without a preloaded schedule")}</div>
          </div>
          <div />
          <div className="flight-card-actions">
            <button type="submit">{t("Create flight")}</button>
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
                  <PlusIcon size={14} /> {t("Add segment")}
                </button>
              )}
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
                <label>{t("Flight comment")}</label>
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <Field label={t("Partner flight")}>
                  <input
                    value={partnerFlight}
                    onChange={(e) => setPartnerFlight(alphanumericUpper(e.target.value, 8))}
                    placeholder=" "
                  />
                </Field>
                <Select label={t("Agreement type")} value={agreement} onChange={setAgreement} options={AGREEMENT_TYPES.map((o) => ({ ...o, label: t(o.label) }))} />
              </div>

              <div className="grid-2" style={{ marginTop: 16, alignItems: "center" }}>
                <button
                  type="button"
                  className={`secondary apis-toggle ${apis ? "on" : "off"}`}
                  onClick={() => setApis((v) => !v)}
                >
                  APIS
                </button>
                <Field label={t("Max KZ, kg")}>
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
                    {t(c)}
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
