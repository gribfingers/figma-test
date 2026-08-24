import { useState } from "react";
import { Flight } from "../../api";
import { Field } from "../Field";
import { Select } from "../Select";
import { PlaneIcon } from "../Icon";
import { MainDraft } from "./mainDraft";

interface Props {
  flight: Flight;
  draft: MainDraft;
  onChange: (patch: Partial<MainDraft>) => void;
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

// Boarding-control checks the ops desk can require for this flight — saved
// in Flight.extra.checks until they get dedicated columns.
const CHECKS = [
  "Mandatory boarding control",
  "Block boarding pending baggage/service payment check",
  "E-ticket check",
  "Document verification check at boarding",
  "Paid seating",
  "Free seating",
  "iAPP",
];

export function MainTab({ flight, draft, onChange }: Props) {
  // Route (airport/time) fields are shown as plain text until "Change
  // route" is used — that's the manual-entry path for small airports
  // without a preloaded schedule. "Back to initial route" discards edits.
  const [editingRoute, setEditingRoute] = useState(false);

  function toggleRoute() {
    if (editingRoute) {
      onChange({
        depAirport: flight.origin,
        arrAirport: flight.destination,
      });
    }
    setEditingRoute((v) => !v);
  }

  return (
    <div className="grid-2">
      <div className="segment-card">
        <div className="segment-endpoints">
          {editingRoute ? (
            <div className="segment-point-edit">
              <Field label="Airport" style={{ width: 84 }}>
                <input
                  value={draft.depAirport}
                  maxLength={3}
                  onChange={(e) => onChange({ depAirport: e.target.value.toUpperCase() })}
                  placeholder=" "
                />
              </Field>
              <Field label="Time" style={{ width: 84 }}>
                <input value={draft.depTime} onChange={(e) => onChange({ depTime: e.target.value })} placeholder=" " />
              </Field>
              <Field label="Terminal" style={{ width: 84 }}>
                <input
                  value={draft.terminalFrom}
                  onChange={(e) => onChange({ terminalFrom: e.target.value })}
                  placeholder=" "
                />
              </Field>
            </div>
          ) : (
            <div className="segment-point">
              <div className="segment-time">{draft.depTime || "—"}</div>
              <Field label="Terminal" style={{ width: 84 }}>
                <input
                  value={draft.terminalFrom}
                  onChange={(e) => onChange({ terminalFrom: e.target.value })}
                  placeholder=" "
                />
              </Field>
            </div>
          )}

          <div className="segment-duration">{fmtDuration(flight.std, flight.sta)}</div>

          {editingRoute ? (
            <div className="segment-point-edit">
              <Field label="Airport" style={{ width: 84 }}>
                <input
                  value={draft.arrAirport}
                  maxLength={3}
                  onChange={(e) => onChange({ arrAirport: e.target.value.toUpperCase() })}
                  placeholder=" "
                />
              </Field>
              <Field label="Time" style={{ width: 84 }}>
                <input value={draft.arrTime} onChange={(e) => onChange({ arrTime: e.target.value })} placeholder=" " />
              </Field>
              <Field label="Terminal" style={{ width: 84 }}>
                <input
                  value={draft.terminalTo}
                  onChange={(e) => onChange({ terminalTo: e.target.value })}
                  placeholder=" "
                />
              </Field>
            </div>
          ) : (
            <div className="segment-point right">
              <Field label="Terminal" style={{ width: 84 }}>
                <input
                  value={draft.terminalTo}
                  onChange={(e) => onChange({ terminalTo: e.target.value })}
                  placeholder=" "
                />
              </Field>
              <div className="segment-time">{draft.arrTime || "—"}</div>
            </div>
          )}
        </div>

        {!editingRoute && (
          <div className="segment-airports">
            <div className="segment-airport-code">{draft.depAirport}</div>
            <div className="segment-airport-code">{draft.arrAirport}</div>
          </div>
        )}

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
            <input value={draft.checkinDesk} onChange={(e) => onChange({ checkinDesk: e.target.value })} placeholder=" " />
          </Field>
          <Field label="A/C reg">
            <input value={draft.acReg} onChange={(e) => onChange({ acReg: e.target.value })} placeholder=" " />
          </Field>
        </div>
        <div className="grid-3" style={{ marginTop: 12 }}>
          <div className="segment-flighttype">
            Flight type: <b>Scheduled</b>
          </div>
          <Field label="Gate">
            <input value={draft.gate} onChange={(e) => onChange({ gate: e.target.value })} placeholder=" " />
          </Field>
          <Field label="Seat config">
            <input value={draft.seatConfig} onChange={(e) => onChange({ seatConfig: e.target.value })} placeholder=" " />
          </Field>
        </div>
      </div>

      <div className="main-tab-side">
        <div className="field2 tall">
          <textarea value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder=" " rows={3} />
          <label>Flight comment</label>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <Field label="Partner flight">
            <input value={draft.partnerFlight} onChange={(e) => onChange({ partnerFlight: e.target.value })} placeholder=" " />
          </Field>
          <Select
            label="Agreement type"
            value={draft.agreement}
            onChange={(v) => onChange({ agreement: v })}
            options={AGREEMENT_TYPES}
          />
        </div>

        <div className="grid-2" style={{ marginTop: 16, alignItems: "center" }}>
          <button
            type="button"
            className={`secondary apis-toggle ${draft.apis ? "on" : "off"}`}
            onClick={() => onChange({ apis: !draft.apis })}
          >
            APIS
          </button>
          <Field label="Max KZ, kg">
            <input value={draft.maxWeight} onChange={(e) => onChange({ maxWeight: e.target.value })} placeholder=" " />
          </Field>
        </div>

        <div className="checkbox-list">
          {CHECKS.map((c) => (
            <label key={c} className="checkbox-row">
              <input
                type="checkbox"
                checked={!!draft.checks[c]}
                onChange={() => onChange({ checks: { ...draft.checks, [c]: !draft.checks[c] } })}
              />
              {c}
            </label>
          ))}
        </div>

        <div className="route-toggle-row">
          <button type="button" className="tertiary" onClick={toggleRoute}>
            {editingRoute ? "Back to initial route" : "Change route"}
          </button>
        </div>
      </div>
    </div>
  );
}
