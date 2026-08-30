import { Field } from "../Field";
import { Select } from "../Select";
import { AirportSelect } from "../AirportSelect";
import { DateField } from "../DateField";
import { PlaneIcon } from "../Icon";
import { SegmentDraft } from "./mainDraft";
import { AIRCRAFT_TYPES } from "../../aircraftTypes";
import { alphanumericUpper, digitsOnly, maskTimeInput } from "../../validation";
import { useLanguage } from "../../i18n";

export function fmtSegmentDuration(depDate: string, depTime: string, arrDate: string, arrTime: string): string {
  if (!depDate || !depTime || !arrDate || !arrTime) return "";
  const dep = new Date(`${depDate}T${depTime}:00Z`).getTime();
  const arr = new Date(`${arrDate}T${arrTime}:00Z`).getTime();
  const mins = Math.round((arr - dep) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

interface SegmentCardProps {
  segment: SegmentDraft;
  editing: boolean;
  removable: boolean;
  onChange: (patch: Partial<SegmentDraft>) => void;
  onRemove: () => void;
}

/** One leg of a flight's routing — same endpoints/time/terminal layout regardless of which segment it is. Shared by the flight card's Main tab and the New flight form. */
export function SegmentCard({ segment, editing, removable, onChange, onRemove }: SegmentCardProps) {
  const { t } = useLanguage();
  return (
    <div className="segment-card">
      <div className="segment-endpoints">
        {editing ? (
          <div className="segment-point-edit">
            <AirportSelect label={t("Airport")} value={segment.depAirport} onChange={(v) => onChange({ depAirport: v })} style={{ width: 108 }} />
            <DateField label={t("Date")} value={segment.depDate} onChange={(v) => onChange({ depDate: v })} style={{ width: 132 }} />
            <Field label={t("Time")} style={{ width: 66 }}>
              <input value={segment.depTime} onChange={(e) => onChange({ depTime: maskTimeInput(e.target.value) })} placeholder=" " inputMode="numeric" />
            </Field>
            <Field label={t("Terminal")} style={{ width: 96 }}>
              <input value={segment.terminalFrom} onChange={(e) => onChange({ terminalFrom: alphanumericUpper(e.target.value, 2) })} placeholder=" " />
            </Field>
          </div>
        ) : (
          <div className="segment-point">
            <div className="segment-time">{segment.depTime || "—"}</div>
            <Field label={t("Terminal")} style={{ width: 96 }}>
              <input value={segment.terminalFrom} onChange={(e) => onChange({ terminalFrom: alphanumericUpper(e.target.value, 2) })} placeholder=" " />
            </Field>
          </div>
        )}

        <div className="segment-duration">{fmtSegmentDuration(segment.depDate, segment.depTime, segment.arrDate, segment.arrTime)}</div>

        {editing ? (
          <div className="segment-point-edit">
            <AirportSelect label={t("Airport")} value={segment.arrAirport} onChange={(v) => onChange({ arrAirport: v })} style={{ width: 108 }} />
            <DateField label={t("Date")} value={segment.arrDate} onChange={(v) => onChange({ arrDate: v })} style={{ width: 132 }} />
            <Field label={t("Time")} style={{ width: 66 }}>
              <input value={segment.arrTime} onChange={(e) => onChange({ arrTime: maskTimeInput(e.target.value) })} placeholder=" " inputMode="numeric" />
            </Field>
            <Field label={t("Terminal")} style={{ width: 96 }}>
              <input value={segment.terminalTo} onChange={(e) => onChange({ terminalTo: alphanumericUpper(e.target.value, 2) })} placeholder=" " />
            </Field>
          </div>
        ) : (
          <div className="segment-point right">
            <Field label={t("Terminal")} style={{ width: 96 }}>
              <input value={segment.terminalTo} onChange={(e) => onChange({ terminalTo: alphanumericUpper(e.target.value, 2) })} placeholder=" " />
            </Field>
            <div className="segment-time">{segment.arrTime || "—"}</div>
          </div>
        )}
      </div>

      {!editing && (
        <div className="segment-airports">
          <div className="segment-airport-code">{segment.depAirport}</div>
          <div className="segment-airport-code">{segment.arrAirport}</div>
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
        <Select
          label={t("AC type")}
          value={segment.aircraftType}
          onChange={(v) => onChange({ aircraftType: v })}
          options={AIRCRAFT_TYPES.map((type) => ({ value: type, label: type }))}
        />
        <Field label={t("Check-in desk")}>
          <input value={segment.checkinDesk} onChange={(e) => onChange({ checkinDesk: digitsOnly(e.target.value, 4) })} placeholder=" " />
        </Field>
        <Field label={t("A/C reg")}>
          <input value={segment.acReg} onChange={(e) => onChange({ acReg: alphanumericUpper(e.target.value, 10) })} placeholder=" " />
        </Field>
      </div>
      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="segment-flighttype">
          {t("Flight type:")} <b>{t("Scheduled service")}</b>
        </div>
        <Field label={t("Gate")}>
          <input value={segment.gate} onChange={(e) => onChange({ gate: digitsOnly(e.target.value, 3) })} placeholder=" " />
        </Field>
        <Field label={t("Seat config")}>
          <input value={segment.seatConfig} onChange={(e) => onChange({ seatConfig: alphanumericUpper(e.target.value, 12) })} placeholder=" " />
        </Field>
      </div>

      {editing && removable && (
        <button type="button" className="tertiary segment-remove" onClick={onRemove}>
          {t("Remove segment")}
        </button>
      )}
    </div>
  );
}
