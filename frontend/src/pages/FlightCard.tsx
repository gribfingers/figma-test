import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Flight } from "../api";
import { useRegisterTab } from "../tabs";
import { FlightCardHeader } from "../components/flightcard/FlightCardHeader";
import { FlightAction } from "../components/flightcard/FlightActionsMenu";
import { MainTab } from "../components/flightcard/MainTab";
import { CountersTab } from "../components/flightcard/CountersTab";
import { PassengersTab } from "../components/flightcard/PassengersTab";
import { TransfersTab } from "../components/flightcard/TransfersTab";
import { SettingsTab } from "../components/flightcard/SettingsTab";
import { combineDateAndTime, draftFromFlight, draftsEqual, MainDraft } from "../components/flightcard/mainDraft";

const TABS = [
  { key: "main", label: "Main" },
  { key: "counters", label: "Counters" },
  { key: "passengers", label: "Passengers" },
  { key: "transfers", label: "Transfers" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FlightCard() {
  const { flightId } = useParams();
  const fid = Number(flightId);
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `${flight.carrier_code}${flight.flight_number}` : "Flight");
  const [tab, setTab] = useState<TabKey>("main");
  const [draft, setDraft] = useState<MainDraft | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getFlight(fid).then((f) => {
      setFlight(f);
      setDraft(draftFromFlight(f));
    });
  }, [fid]);

  if (!flight || !draft) return <div className="content">Loading…</div>;

  const dirty = !draftsEqual(draft, draftFromFlight(flight));

  async function handleSave() {
    if (!flight || !draft) return;
    setError("");
    const extra = JSON.stringify({
      terminalTo: draft.terminalTo,
      checkinDesk: draft.checkinDesk,
      comment: draft.comment,
      partnerFlight: draft.partnerFlight,
      agreement: draft.agreement,
      apis: draft.apis,
      maxWeight: draft.maxWeight,
      checks: draft.checks,
    });
    try {
      const updated = await api.updateFlight(flight.id, {
        aircraft_type: draft.aircraftType,
        terminal: draft.terminalFrom || null,
        gate: draft.gate || null,
        aircraft_reg: draft.acReg || null,
        aircraft_version: draft.seatConfig || null,
        origin: draft.depAirport,
        destination: draft.arrAirport,
        std: combineDateAndTime(flight.std, draft.depDate, draft.depTime),
        sta: combineDateAndTime(flight.sta ?? flight.std, draft.arrDate, draft.arrTime),
        extra,
      });
      setFlight(updated);
      setDraft(draftFromFlight(updated));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAction(action: FlightAction) {
    if (!flight) return;
    setError("");
    try {
      if (action === "checkin") return navigate(`/checkin/${flight.id}`);
      if (action === "boarding") return navigate(`/boarding/${flight.id}`);
      if (action === "pnl") {
        const text = await api.pnl(flight.id);
        setManifest({ label: "PNL (passenger name list)", text });
        return;
      }
      if (action === "pfs") {
        const text = await api.pfs(flight.id);
        setManifest({ label: "PFS (current preliminary summary)", text });
        return;
      }
      if (action === "close") {
        if (!confirm("Close the flight? Passengers checked in but not boarded will be marked NO SHOW.")) return;
        const { flight: updated, pfs } = await api.closeFlight(flight.id);
        setFlight(updated);
        setDraft(draftFromFlight(updated));
        setManifest({ label: "PFS (final list after flight close-out)", text: pfs });
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div className="flight-card-panel">
        <FlightCardHeader flight={flight} activeTab={tab} dirty={dirty} onSave={handleSave} onAction={handleAction} />
        <div className="flight-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`flight-tab ${tab === t.key ? "selected" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flight-card-body">
          {tab === "main" && (
            <MainTab flight={flight} draft={draft} onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))} />
          )}
          {tab === "counters" && <CountersTab />}
          {tab === "passengers" && <PassengersTab flight={flight} />}
          {tab === "transfers" && <TransfersTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>

      {manifest && (
        <div className="panel">
          <h3>{manifest.label}</h3>
          <pre className="manifest">{manifest.text}</pre>
        </div>
      )}
    </div>
  );
}
