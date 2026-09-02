import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Flight } from "../api";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { FLIGHT_STATUSES, OPS_STATUS_UNSET } from "../flightStatuses";
import { isFlightDeparted, phaseBasedStatusKey } from "../flightPhase";
import { usePersistentState } from "../usePersistentState";
import { FlightCardHeader } from "../components/flightcard/FlightCardHeader";
import { EntityNotFound } from "../components/EntityNotFound";
import { CloseIcon } from "../components/Icon";
import { FlightAction } from "../components/flightcard/FlightActionsMenu";
import { MainTab } from "../components/flightcard/MainTab";
import { CountersTab } from "../components/flightcard/CountersTab";
import { PassengersTab } from "../components/flightcard/PassengersTab";
import { TransfersTab } from "../components/flightcard/TransfersTab";
import { SettingsTab } from "../components/flightcard/SettingsTab";
import { combineDateAndTime, draftFromFlight, draftsEqual, MainDraft, parseFlightExtra } from "../components/flightcard/mainDraft";
import { useLanguage } from "../i18n";
import { useConfirmDialog } from "../confirmDialog";
import { useCanEdit } from "../auth";

const TABS = [
  { key: "main", label: "Main" },
  { key: "counters", label: "Counters" },
  { key: "passengers", label: "Pax" },
  { key: "transfers", label: "Transfers" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FlightCard() {
  const { flightId } = useParams();
  const fid = Number(flightId);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `${flight.carrier_code}${flight.flight_number}` : t("Flight"));
  const [tab, setTab] = usePersistentState<TabKey>(`dcs_flight_tab_${fid}`, "main");
  // Only PassengersTab's seat map can rotate — while it's rotated, hide the header/tab strip above
  // it so the stacked passenger list (already squeezed to 320px) gets a bit more of the page.
  const [paxSeatMapOrientation, setPaxSeatMapOrientation] = useState<"vertical" | "horizontal">("vertical");
  const chromeHidden = tab === "passengers" && paxSeatMapOrientation === "horizontal";
  const [draft, setDraft] = useState<MainDraft | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const { showToast } = useToast();
  const { confirmDialog } = useConfirmDialog();
  const canEdit = useCanEdit();

  useEffect(() => {
    api
      .getFlight(fid)
      .then((f) => {
        setFlight(f);
        setDraft(draftFromFlight(f));
      })
      .catch(() => setNotFound(true));
  }, [fid]);

  if (notFound) return <EntityNotFound label={t("This flight")} />;
  if (!flight || !draft) return <div className="content">{t("Loading…")}</div>;

  const dirty = !draftsEqual(draft, draftFromFlight(flight));
  const departed = isFlightDeparted(flight, new Date());

  async function handleStatusChange(key: string) {
    if (!flight || !canEdit) return;
    const now = new Date();
    const currentKey = flight.ops_status && flight.ops_status !== OPS_STATUS_UNSET ? flight.ops_status : phaseBasedStatusKey(flight, now);
    if (key === currentKey) return;
    setError("");
    try {
      const updated = await api.updateFlight(flight.id, { ops_status: key });
      setFlight(updated);
      setDraft(draftFromFlight(updated));
      const from = t(FLIGHT_STATUSES.find((s) => s.key === currentKey)?.labelEn ?? currentKey);
      const to = t(FLIGHT_STATUSES.find((s) => s.key === key)?.labelEn ?? key);
      showToast(t("Flight status changed from {from} to {to}").replace("{from}", from).replace("{to}", to));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSave() {
    if (!flight || !draft || departed || !canEdit) return;
    setError("");
    const first = draft.segments[0];
    const std = combineDateAndTime(flight.std, first.depDate, first.depTime);
    const sta = combineDateAndTime(flight.sta ?? flight.std, first.arrDate, first.arrTime);
    const extra = JSON.stringify({
      ...parseFlightExtra(flight),
      comment: draft.comment,
      partnerFlight: draft.partnerFlight,
      agreement: draft.agreement,
      apis: draft.apis,
      maxWeight: draft.maxWeight,
      checks: draft.checks,
      segments: [
        { terminalTo: first.terminalTo, checkinDesk: first.checkinDesk },
        ...draft.segments.slice(1).map((s) => ({
          origin: s.depAirport,
          destination: s.arrAirport,
          std: combineDateAndTime(std, s.depDate, s.depTime),
          sta: combineDateAndTime(sta, s.arrDate, s.arrTime),
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
      const updated = await api.updateFlight(flight.id, {
        aircraft_type: first.aircraftType,
        terminal: first.terminalFrom || null,
        gate: first.gate || null,
        aircraft_reg: first.acReg || null,
        aircraft_version: first.seatConfig || null,
        origin: first.depAirport,
        destination: first.arrAirport,
        std,
        sta,
        extra,
      });
      setFlight(updated);
      setDraft(draftFromFlight(updated));
      showToast(t("Changes saved"));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAction(action: FlightAction) {
    if (!flight) return;
    setError("");
    try {
      if (action === "checkin") return navigate("/search");
      if (action === "boarding") return navigate(`/boarding/${flight.id}`);
      if (action === "pnl") {
        const text = await api.pnl(flight.id);
        setManifest({ label: t("PNL (passenger name list)"), text });
        return;
      }
      if (action === "pfs") {
        const text = await api.pfs(flight.id);
        setManifest({ label: t("PFS (current preliminary summary)"), text });
        return;
      }
      if (action === "close") {
        if (!canEdit) return;
        if (!(await confirmDialog(t("Close the flight? Pax checked in but not boarded will be marked NO SHOW."), { danger: true }))) return;
        const { flight: updated, pfs } = await api.closeFlight(flight.id);
        setFlight(updated);
        setDraft(draftFromFlight(updated));
        setManifest({ label: t("PFS (final list after flight close-out)"), text: pfs });
        showToast(t("Flight closed"));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="flight-card-page">
      {error && <div className="error-box">{error}</div>}
      <div className="flight-card-panel">
        {!chromeHidden && (
          <>
            <FlightCardHeader
              flight={flight}
              activeTab={tab}
              dirty={dirty}
              canEdit={canEdit}
              onSave={handleSave}
              onAction={handleAction}
              onStatusChange={handleStatusChange}
            />
            <div className="flight-tabs">
              {TABS.map((tabDef) => (
                <button
                  key={tabDef.key}
                  type="button"
                  className={`flight-tab ${tab === tabDef.key ? "selected" : ""}`}
                  onClick={() => setTab(tabDef.key)}
                >
                  {t(tabDef.label)}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flight-card-body">
          {tab === "main" && (
            <MainTab
              flight={flight}
              draft={draft}
              onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              readOnly={departed || !canEdit}
            />
          )}
          {tab === "counters" && <CountersTab />}
          {tab === "passengers" && (
            <PassengersTab
              flight={flight}
              readOnly={!canEdit}
              orientation={paxSeatMapOrientation}
              onOrientationChange={setPaxSeatMapOrientation}
            />
          )}
          {tab === "transfers" && <TransfersTab />}
          {tab === "settings" && (
            <SettingsTab
              flight={flight}
              readOnly={departed}
              canEdit={canEdit}
              onFlightUpdated={(updated) => {
                setFlight(updated);
                setDraft(draftFromFlight(updated));
              }}
            />
          )}
        </div>
      </div>

      {manifest && (
        <div className="panel">
          <div className="manifest-head">
            <h3>{manifest.label}</h3>
            <button type="button" className="icon-button" aria-label={t("Close")} onClick={() => setManifest(null)}>
              <CloseIcon size={16} />
            </button>
          </div>
          <pre className="manifest">{manifest.text}</pre>
        </div>
      )}
    </div>
  );
}
