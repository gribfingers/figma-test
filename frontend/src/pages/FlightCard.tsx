import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Flight } from "../api";
import { useRegisterTab } from "../tabs";
import { FlightCardHeader } from "../components/flightcard/FlightCardHeader";
import { MainTab } from "../components/flightcard/MainTab";
import { CountersTab } from "../components/flightcard/CountersTab";
import { PassengersTab } from "../components/flightcard/PassengersTab";
import { TransfersTab } from "../components/flightcard/TransfersTab";
import { SettingsTab } from "../components/flightcard/SettingsTab";

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
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `${flight.carrier_code}${flight.flight_number}` : "Flight");
  const [tab, setTab] = useState<TabKey>("main");

  useEffect(() => {
    api.getFlight(fid).then(setFlight);
  }, [fid]);

  if (!flight) return <div className="content">Loading…</div>;

  return (
    <div className="flight-card-panel">
      <FlightCardHeader flight={flight} activeTab={tab} />
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
        {tab === "main" && <MainTab flight={flight} />}
        {tab === "counters" && <CountersTab />}
        {tab === "passengers" && <PassengersTab flight={flight} />}
        {tab === "transfers" && <TransfersTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
