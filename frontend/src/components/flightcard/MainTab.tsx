import { useState } from "react";
import { Flight } from "../../api";
import { Field } from "../Field";
import { Select } from "../Select";
import { PlaneIcon } from "../Icon";

interface Props {
  flight: Flight;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(std: string, sta: string | null): string {
  if (!sta) return "";
  const mins = Math.round((new Date(sta).getTime() - new Date(std).getTime()) / 60000);
  if (mins <= 0) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

const AGREEMENT_TYPES = [
  { value: "codeshare", label: "Codeshare" },
  { value: "interline", label: "Interline" },
  { value: "own", label: "Own flight" },
];

// Boarding-control checks the ops desk can require for this flight — not
// backed by a schema field yet, kept as local UI state for now.
const CHECKS = [
  "Mandatory boarding control",
  "Block boarding pending baggage/service payment check",
  "E-ticket check",
  "Document verification check at boarding",
  "Paid seating",
  "Free seating",
  "iAPP",
];

export function MainTab({ flight }: Props) {
  const [terminalFrom, setTerminalFrom] = useState(flight.terminal ?? "");
  const [terminalTo, setTerminalTo] = useState("");
  const [checkinDesk, setCheckinDesk] = useState("");
  const [gate, setGate] = useState(flight.gate ?? "");
  const [acReg, setAcReg] = useState(flight.aircraft_reg ?? "");
  const [seatConfig, setSeatConfig] = useState(flight.aircraft_version ?? "");
  const [comment, setComment] = useState("");
  const [partnerFlight, setPartnerFlight] = useState("");
  const [agreement, setAgreement] = useState("codeshare");
  const [apis, setApis] = useState(false);
  const [maxWeight, setMaxWeight] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  return (
    <div className="grid-2">
      <div className="segment-card">
        <div className="segment-endpoints">
          <div className="segment-point">
            <div className="segment-time">{fmtTime(flight.std)}</div>
            <Field label="Terminal" style={{ width: 84 }}>
              <input value={terminalFrom} onChange={(e) => setTerminalFrom(e.target.value)} placeholder=" " />
            </Field>
          </div>
          <div className="segment-duration">{fmtDuration(flight.std, flight.sta)}</div>
          <div className="segment-point right">
            <Field label="Terminal" style={{ width: 84 }}>
              <input value={terminalTo} onChange={(e) => setTerminalTo(e.target.value)} placeholder=" " />
            </Field>
            <div className="segment-time">{fmtTime(flight.sta)}</div>
          </div>
        </div>
        <div className="segment-airports">
          <div className="segment-airport-code">{flight.origin}</div>
          <div className="segment-airport-code">{flight.destination}</div>
        </div>
        <div className="segment-path">
          <span className="segment-dot" />
          <span className="segment-line-fill" />
          <PlaneIcon size={16} className="segment-plane" />
          <span className="segment-line-fill" />
          <span className="segment-dot" />
        </div>
        <div className="grid-3">
          <Field label="AC type">
            <input value={flight.aircraft_type} disabled placeholder=" " />
          </Field>
          <Field label="Check-in desk">
            <input value={checkinDesk} onChange={(e) => setCheckinDesk(e.target.value)} placeholder=" " />
          </Field>
          <Field label="A/C reg">
            <input value={acReg} onChange={(e) => setAcReg(e.target.value)} placeholder=" " />
          </Field>
        </div>
        <div className="grid-3" style={{ marginTop: 12 }}>
          <div className="segment-flighttype">
            Flight type: <b>Scheduled</b>
          </div>
          <Field label="Gate">
            <input value={gate} onChange={(e) => setGate(e.target.value)} placeholder=" " />
          </Field>
          <Field label="Seat config">
            <input value={seatConfig} onChange={(e) => setSeatConfig(e.target.value)} placeholder=" " />
          </Field>
        </div>
        <button type="button" className="tertiary" style={{ marginTop: 16 }}>
          Change route
        </button>
      </div>

      <div>
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
            <input
              type="number"
              min={0}
              value={maxWeight}
              onChange={(e) => setMaxWeight(e.target.value)}
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
  );
}
