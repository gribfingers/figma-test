import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, Flight } from "../../api";
import { PhaseOverrides, phaseOverridesFromFlight } from "../../flightPhase";
import { parseFlightExtra } from "./mainDraft";
import { Field } from "../Field";
import { digitsOnly } from "../../validation";
import { useToast } from "../../toast";
import { useConfirmDialog } from "../../confirmDialog";
import { useTabs } from "../../tabs";
import { useLanguage } from "../../i18n";

interface Props {
  flight: Flight;
  onFlightUpdated: (flight: Flight) => void;
}

// Same light duplication as Boarding.tsx/BoardingPax.tsx/PnrView.tsx's own parseVersion —
// "C18Y162" -> { C: 18, Y: 162 }.
function parseVersion(version: string | null): { C: number; Y: number } {
  if (!version) return { C: 0, Y: 0 };
  const c = /C(\d+)/.exec(version);
  const y = /Y(\d+)/.exec(version);
  return { C: c ? +c[1] : 0, Y: y ? +y[1] : 0 };
}

interface OverbookingSettings {
  overbookC: number;
  overbookY: number;
}

function overbookingFromFlight(flight: Flight): OverbookingSettings {
  const o = (parseFlightExtra(flight).overbooking ?? {}) as Partial<OverbookingSettings>;
  return {
    overbookC: typeof o.overbookC === "number" ? o.overbookC : 0,
    overbookY: typeof o.overbookY === "number" ? o.overbookY : 0,
  };
}

/**
 * Per-flight operational settings — the check-in/boarding/closing window
 * (defaults everyone else in flightPhase.ts falls back to) and an
 * overbooking allowance, both stored in Flight.extra alongside the Main
 * tab's own fields (see parseFlightExtra). The danger zone at the bottom
 * is the one thing with no Main-tab equivalent: permanently deleting the
 * flight record itself (cancelling it is already a status, not a delete —
 * see ops_status "canceled_no_host" on FlightStatusSelect).
 */
export function SettingsTab({ flight, onFlightUpdated }: Props) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { confirmDialog } = useConfirmDialog();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { closeTab } = useTabs();

  const [checkinMin, setCheckinMin] = useState("");
  const [boardingMin, setBoardingMin] = useState("");
  const [closingMin, setClosingMin] = useState("");
  const [flyingMin, setFlyingMin] = useState("");
  const [overbookC, setOverbookC] = useState("");
  const [overbookY, setOverbookY] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const o = phaseOverridesFromFlight(flight);
    setCheckinMin(String(-o.checkinMin));
    setBoardingMin(String(-o.boardingMin));
    setClosingMin(String(-o.closingMin));
    setFlyingMin(String(-o.flyingMin));
    const ob = overbookingFromFlight(flight);
    setOverbookC(String(ob.overbookC));
    setOverbookY(String(ob.overbookY));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id]);

  const capacity = parseVersion(flight.aircraft_version);
  const extraC = Number(overbookC) || 0;
  const extraY = Number(overbookY) || 0;

  async function save() {
    setError("");
    const nums = [checkinMin, boardingMin, closingMin, flyingMin].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) {
      setError(t("Check-in/boarding window values must be numbers."));
      return;
    }
    const [ci, bo, cl, fl] = nums;
    if (!(ci > bo && bo > cl && cl > fl && fl >= 0)) {
      setError(t("Each window must open before the next — Check-in opens > Boarding starts > Gate closing starts > Final call."));
      return;
    }
    setSaving(true);
    try {
      const phaseOverrides: PhaseOverrides = { checkinMin: -ci, boardingMin: -bo, closingMin: -cl, flyingMin: -fl };
      const overbooking: OverbookingSettings = { overbookC: extraC, overbookY: extraY };
      const extra = JSON.stringify({ ...parseFlightExtra(flight), phaseOverrides, overbooking });
      const updated = await api.updateFlight(flight.id, { extra });
      onFlightUpdated(updated);
      showToast(t("Settings saved"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFlight() {
    if (!(await confirmDialog(t("Permanently delete this flight and every passenger on it? This cannot be undone."), { danger: true }))) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteFlight(flight.id);
      closeTab(pathname);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
      setDeleting(false);
    }
  }

  return (
    <div className="settings-tab">
      {error && <div className="error-box">{error}</div>}

      <div className="settings-section">
        <h3>{t("Check-in / boarding windows")}</h3>
        <p className="subtitle">{t("Minutes before departure (STD) that each phase begins.")}</p>
        <div className="grid-2">
          <Field label={t("Check-in opens")}>
            <input value={checkinMin} onChange={(e) => setCheckinMin(digitsOnly(e.target.value, 4))} placeholder=" " />
          </Field>
          <Field label={t("Boarding starts")}>
            <input value={boardingMin} onChange={(e) => setBoardingMin(digitsOnly(e.target.value, 4))} placeholder=" " />
          </Field>
          <Field label={t("Gate closing starts")}>
            <input value={closingMin} onChange={(e) => setClosingMin(digitsOnly(e.target.value, 4))} placeholder=" " />
          </Field>
          <Field label={t("Final call")}>
            <input value={flyingMin} onChange={(e) => setFlyingMin(digitsOnly(e.target.value, 4))} placeholder=" " />
          </Field>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("Overbooking")}</h3>
        <p className="subtitle">
          {t("Extra seats sellable beyond configured capacity: C {c} · Y {y}").replace("{c}", String(capacity.C)).replace("{y}", String(capacity.Y))}
        </p>
        <div className="grid-2">
          <Field label={t("Overbooking limit — Business (C)")}>
            <input value={overbookC} onChange={(e) => setOverbookC(digitsOnly(e.target.value, 3))} placeholder=" " />
          </Field>
          <Field label={t("Overbooking limit — Economy (Y)")}>
            <input value={overbookY} onChange={(e) => setOverbookY(digitsOnly(e.target.value, 3))} placeholder=" " />
          </Field>
        </div>
        <p className="settings-hint">
          {t("Max sellable with overbooking: C {c} · Y {y}").replace("{c}", String(capacity.C + extraC)).replace("{y}", String(capacity.Y + extraY))}
        </p>
      </div>

      <button type="button" className="settings-save" disabled={saving} onClick={save}>
        {t("Save")}
      </button>

      <div className="danger-zone">
        <h3>{t("Danger zone")}</h3>
        <p className="subtitle">{t("Permanently deletes the flight, its passengers, and its seat map. This cannot be undone.")}</p>
        <button type="button" className="danger" disabled={deleting} onClick={deleteFlight}>
          {t("Delete flight")}
        </button>
      </div>
    </div>
  );
}
