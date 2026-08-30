import { useState } from "react";
import { Flight } from "../../api";
import { Field } from "../Field";
import { Select } from "../Select";
import { PlusIcon } from "../Icon";
import { draftFromFlight, EMPTY_SEGMENT, MainDraft, SegmentDraft } from "./mainDraft";
import { SegmentCard } from "./SegmentCard";
import { MAX_SEGMENTS } from "../../flightSegments";
import { alphanumericUpper, digitsOnly } from "../../validation";
import { useLanguage } from "../../i18n";

interface Props {
  flight: Flight;
  draft: MainDraft;
  onChange: (patch: Partial<MainDraft>) => void;
  /** A departed flight's own record can't be changed anymore (see FlightCard.tsx's isFlightDeparted). */
  readOnly?: boolean;
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

export function MainTab({ flight, draft, onChange, readOnly }: Props) {
  const { t } = useLanguage();
  // Route (airport/time) fields are shown as plain text until "Change
  // route" is used — that's the manual-entry path for small airports
  // without a preloaded schedule. "Back to initial route" discards edits.
  const [editingRoute, setEditingRoute] = useState(false);

  function toggleRoute() {
    if (readOnly) return;
    if (editingRoute) {
      onChange({ segments: draftFromFlight(flight).segments });
    }
    setEditingRoute((v) => !v);
  }

  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    if (readOnly) return;
    onChange({ segments: draft.segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }

  function addSegment() {
    if (readOnly) return;
    const last = draft.segments[draft.segments.length - 1];
    onChange({
      segments: [
        ...draft.segments,
        {
          ...EMPTY_SEGMENT,
          depAirport: last?.arrAirport ?? "",
          aircraftType: last?.aircraftType ?? EMPTY_SEGMENT.aircraftType,
          acReg: last?.acReg ?? "",
          seatConfig: last?.seatConfig ?? "",
        },
      ],
    });
  }

  function removeSegment(i: number) {
    if (readOnly) return;
    onChange({ segments: draft.segments.filter((_, idx) => idx !== i) });
  }

  return (
    <div className={`grid-2 flight-main-grid ${readOnly ? "flight-main-grid-readonly" : ""}`}>
      <div className="segment-cards">
        {draft.segments.map((segment, i) => (
          <SegmentCard
            key={i}
            segment={segment}
            editing={editingRoute}
            removable={draft.segments.length > 1}
            onChange={(patch) => updateSegment(i, patch)}
            onRemove={() => removeSegment(i)}
          />
        ))}
        {editingRoute && draft.segments.length < MAX_SEGMENTS && (
          <button type="button" className="secondary segment-add" onClick={addSegment}>
            <PlusIcon size={14} /> {t("Add segment")}
          </button>
        )}
      </div>

      <div className="main-tab-side">
        <div className="field2 tall">
          <textarea
            value={draft.comment}
            onChange={(e) => onChange({ comment: e.target.value })}
            placeholder=" "
            rows={3}
            maxLength={500}
          />
          <label>{t("Flight comment")}</label>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <Field label={t("Partner flight")}>
            <input
              value={draft.partnerFlight}
              onChange={(e) => onChange({ partnerFlight: alphanumericUpper(e.target.value, 8) })}
              placeholder=" "
            />
          </Field>
          <Select
            label={t("Agreement type")}
            value={draft.agreement}
            onChange={(v) => onChange({ agreement: v })}
            options={AGREEMENT_TYPES.map((o) => ({ ...o, label: t(o.label) }))}
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
          <Field label={t("Max KZ, kg")}>
            <input
              value={draft.maxWeight}
              onChange={(e) => onChange({ maxWeight: digitsOnly(e.target.value, 6) })}
              placeholder=" "
            />
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
              {t(c)}
            </label>
          ))}
        </div>

        {!readOnly && (
          <div className="route-toggle-row">
            <button type="button" className="tertiary" onClick={toggleRoute}>
              {editingRoute ? t("Back to initial route") : t("Change route")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
