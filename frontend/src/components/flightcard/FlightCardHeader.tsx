import { useEffect, useState } from "react";
import { Flight } from "../../api";
import { FLIGHT_STATUSES } from "../../flightStatuses";
import { FLIGHT_PHASES, currentPhaseIndex } from "../../flightPhase";
import { useToast } from "../../toast";
import { FlightStatusSelect } from "./FlightStatusSelect";
import { FlightAction, FlightActionsMenu } from "./FlightActionsMenu";

interface Props {
  flight: Flight;
  activeTab: string;
  dirty: boolean;
  onSave: () => void;
  onAction: (action: FlightAction) => void;
}

function fmtWindow(std: string, fromMin: number, toMin: number): string {
  const base = new Date(std).getTime();
  const f = (m: number) =>
    new Date(base + m * 60000).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${f(fromMin)} - ${f(toMin)}`;
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
  // Ticks so the highlighted phase keeps up with real time even if nothing
  // else on the page changes (not just right after editing std/sta).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const currentPhase = currentPhaseIndex(flight, now);
  const [statusKey, setStatusKey] = useState(() => defaultStatusKey(flight.ops_status));
  const { showToast } = useToast();

  function handleStatusChange(key: string) {
    if (key === statusKey) return;
    const from = FLIGHT_STATUSES.find((s) => s.key === statusKey)?.labelEn ?? statusKey;
    const to = FLIGHT_STATUSES.find((s) => s.key === key)?.labelEn ?? key;
    setStatusKey(key);
    showToast(`Flight status changed from ${from} to ${to}`);
  }

  return (
    <div className="flight-card-head">
      <div className="flight-card-head-start">
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

        <FlightStatusSelect value={statusKey} onChange={handleStatusChange} />
      </div>

      <div className="flight-status-group">
        {FLIGHT_PHASES.map((p, i) => {
          const state = i < currentPhase ? "past" : i === currentPhase ? "active" : "";
          return (
            <div key={p.key} className={`flight-status-chip ${state}`}>
              <div className="flight-status-label">{p.label}</div>
              <div className="flight-status-range">{fmtWindow(flight.std, p.fromMin, p.toMin)}</div>
            </div>
          );
        })}
      </div>

      <div className="flight-card-actions">
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
