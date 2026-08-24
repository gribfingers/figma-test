import { useState } from "react";
import { Flight } from "../../api";
import { FlightStatusSelect } from "./FlightStatusSelect";
import { FlightAction, FlightActionsMenu } from "./FlightActionsMenu";

interface Props {
  flight: Flight;
  activeTab: string;
  dirty: boolean;
  onSave: () => void;
  onAction: (action: FlightAction) => void;
}

const PHASES = [
  { key: "checkin", label: "Check-in", fromMin: -180, toMin: -45 },
  { key: "boarding", label: "Boarding", fromMin: -45, toMin: -15 },
  { key: "closing", label: "Closing", fromMin: -15, toMin: -5 },
  { key: "flying", label: "Flying away", fromMin: -5, toMin: 0 },
];

function fmtWindow(std: string, fromMin: number, toMin: number): string {
  const base = new Date(std).getTime();
  const f = (m: number) =>
    new Date(base + m * 60000).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${f(fromMin)} - ${f(toMin)}`;
}

// No single backend field tracks flight phase yet, so the highlighted
// window count is inferred from ops_status until one exists.
function activePhaseCount(status: Flight["ops_status"]): number {
  if (status === "BOARDING") return 2;
  if (status === "DEPARTED" || status === "ARRIVED") return 4;
  if (status === "CANCELLED") return 0;
  return 1;
}

function fmtCardDate(std: string): string {
  const d = new Date(std);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} · ${time}`;
}

// No matching backend field yet (see FlightStatusSelect) — this only picks
// a reasonable starting point in the new glossary from the existing
// lifecycle field, it isn't a real mapping.
function defaultStatusKey(status: Flight["ops_status"]): string {
  if (status === "BOARDING") return "open";
  if (status === "DEPARTED" || status === "ARRIVED") return "take_off";
  if (status === "CANCELLED") return "canceled_no_host";
  return "active_not_open";
}

export function FlightCardHeader({ flight, activeTab, dirty, onSave, onAction }: Props) {
  const activeCount = activePhaseCount(flight.ops_status);
  const [statusKey, setStatusKey] = useState(() => defaultStatusKey(flight.ops_status));

  return (
    <div className="flight-card-head">
      <div className="flight-card-id">
        <div className="flight-card-number">
          {flight.carrier_code}
          {flight.flight_number}
        </div>
        <div className="flight-card-route">
          {flight.origin} → {flight.destination}
        </div>
        <div className="flight-card-date">{fmtCardDate(flight.std)}</div>
      </div>

      <FlightStatusSelect value={statusKey} onChange={setStatusKey} />

      <div className="flight-status-group">
        {PHASES.map((p, i) => (
          <div key={p.key} className={`flight-status-chip ${i < activeCount ? "active" : ""}`}>
            <div className="flight-status-label">{p.label}</div>
            <div className="flight-status-range">{fmtWindow(flight.std, p.fromMin, p.toMin)}</div>
          </div>
        ))}
      </div>

      <div className="flight-card-actions">
        <button type="button" className="secondary">
          Popular action
        </button>
        <FlightActionsMenu onAction={onAction} />
        {activeTab === "main" && (
          <button type="button" disabled={!dirty} onClick={onSave}>
            Save
          </button>
        )}
      </div>
    </div>
  );
}
