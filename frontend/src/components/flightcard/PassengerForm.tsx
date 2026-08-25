import { Passenger } from "../../api";
import { Field } from "../Field";
import { Select } from "../Select";
import { PassengerExtra, SSR_OPTIONS, parsePassengerExtra } from "../../paxExtra";

export type PaxDraft = {
  surname: string;
  given_name: string;
  ticket_number: string;
  record_locator: string;
  gender: "" | "M" | "F";
  dob: string;
  infant: boolean;
  bag_count: number;
  bag_weight_kg: number;
  ssr: string[];
  wl: boolean;
  pl: boolean;
  type: string;
  iapp: boolean;
  inbound: string;
  inboundTime: string;
  outbound: string;
  outboundTime: string;
};

export const EMPTY_PAX_DRAFT: PaxDraft = {
  surname: "",
  given_name: "",
  ticket_number: "",
  record_locator: "",
  gender: "",
  dob: "",
  infant: false,
  bag_count: 0,
  bag_weight_kg: 0,
  ssr: [],
  wl: false,
  pl: false,
  type: "",
  iapp: false,
  inbound: "",
  inboundTime: "",
  outbound: "",
  outboundTime: "",
};

export function paxDraftFrom(p: Passenger): PaxDraft {
  const extra = parsePassengerExtra(p);
  return {
    surname: p.surname,
    given_name: p.given_name,
    ticket_number: p.ticket_number,
    record_locator: p.record_locator,
    gender: p.gender ?? "",
    dob: p.dob ?? "",
    infant: !!p.infant,
    bag_count: p.bag_count ?? 0,
    bag_weight_kg: p.bag_weight_kg ?? 0,
    ssr: p.ssr ?? [],
    wl: extra.wl ?? false,
    pl: extra.pl ?? false,
    type: extra.type ?? "",
    iapp: extra.iapp ?? false,
    inbound: extra.inbound ?? "",
    inboundTime: extra.inboundTime ?? "",
    outbound: extra.outbound ?? "",
    outboundTime: extra.outboundTime ?? "",
  };
}

// Merges into the original passenger's extra blob (when editing) rather
// than replacing it outright, so fields this form doesn't cover — comments,
// FFP card — set from elsewhere (e.g. the flight card's TR/AUX/COM/FFP
// chips) survive an edit.
export function paxDraftToPayload(d: PaxDraft, original?: Passenger): Partial<Passenger> & { extra: string } {
  const prevExtra = original ? parsePassengerExtra(original) : {};
  const extra: PassengerExtra = {
    ...prevExtra,
    wl: d.wl,
    pl: d.pl,
    type: d.type,
    iapp: d.iapp,
    inbound: d.inbound,
    inboundTime: d.inboundTime,
    outbound: d.outbound,
    outboundTime: d.outboundTime,
  };
  return {
    surname: d.surname,
    given_name: d.given_name,
    ticket_number: d.ticket_number,
    record_locator: d.record_locator || undefined,
    gender: d.gender || null,
    dob: d.dob || null,
    infant: d.infant,
    bag_count: d.bag_count,
    bag_weight_kg: d.bag_weight_kg,
    ssr: d.ssr,
    extra: JSON.stringify(extra),
  } as Partial<Passenger> & { extra: string };
}

function toggleSsr(draft: PaxDraft, code: string): PaxDraft {
  return { ...draft, ssr: draft.ssr.includes(code) ? draft.ssr.filter((c) => c !== code) : [...draft.ssr, code] };
}

interface PassengerFormProps {
  draft: PaxDraft;
  onChange: (draft: PaxDraft) => void;
}

/** Shared field set for the Add and Edit passenger modals. */
export function PassengerFormFields({ draft, onChange }: PassengerFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Surname" style={{ flex: 1 }}>
          <input value={draft.surname} onChange={(e) => onChange({ ...draft, surname: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Given name" style={{ flex: 1 }}>
          <input value={draft.given_name} onChange={(e) => onChange({ ...draft, given_name: e.target.value })} placeholder=" " />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Ticket number" style={{ flex: 1 }}>
          <input value={draft.ticket_number} onChange={(e) => onChange({ ...draft, ticket_number: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Record locator (PNR)" style={{ flex: 1 }}>
          <input value={draft.record_locator} onChange={(e) => onChange({ ...draft, record_locator: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Select
          label="Gender"
          style={{ width: 120 }}
          value={draft.gender}
          onChange={(v) => onChange({ ...draft, gender: v as PaxDraft["gender"] })}
          options={[{ value: "", label: "—" }, { value: "M", label: "M" }, { value: "F", label: "F" }]}
        />
        <Field label="Date of birth" style={{ flex: 1 }}>
          <input type="date" value={draft.dob} onChange={(e) => onChange({ ...draft, dob: e.target.value })} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.infant} onChange={(e) => onChange({ ...draft, infant: e.target.checked })} />
          Infant
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Bag count" style={{ width: 100 }}>
          <input type="number" min={0} value={draft.bag_count} onChange={(e) => onChange({ ...draft, bag_count: Number(e.target.value) })} />
        </Field>
        <Field label="Bag weight (kg)" style={{ width: 120 }}>
          <input type="number" min={0} step={0.5} value={draft.bag_weight_kg} onChange={(e) => onChange({ ...draft, bag_weight_kg: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="field" style={{ marginTop: 0 }}>
        <label>SSR (remarks)</label>
        <div className="ssr-tags">
          {SSR_OPTIONS.map((code) => (
            <label key={code} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 0 }}>
              <input type="checkbox" checked={draft.ssr.includes(code)} onChange={() => onChange(toggleSsr(draft, code))} style={{ width: "auto" }} />
              <span className="mono">{code}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.wl} onChange={(e) => onChange({ ...draft, wl: e.target.checked })} />
          WL
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.pl} onChange={(e) => onChange({ ...draft, pl: e.target.checked })} />
          PL
        </label>
        <Field label="Type" style={{ width: 100 }}>
          <input value={draft.type} onChange={(e) => onChange({ ...draft, type: e.target.value.toUpperCase() })} placeholder=" " maxLength={3} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.iapp} onChange={(e) => onChange({ ...draft, iapp: e.target.checked })} />
          iAPP
        </label>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Inbound flight" style={{ flex: 1 }}>
          <input value={draft.inbound} onChange={(e) => onChange({ ...draft, inbound: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
        <Field label="Inbound arrival" style={{ flex: 1 }}>
          <input type="datetime-local" value={draft.inboundTime} onChange={(e) => onChange({ ...draft, inboundTime: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Outbound flight" style={{ flex: 1 }}>
          <input value={draft.outbound} onChange={(e) => onChange({ ...draft, outbound: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
        <Field label="Outbound departure" style={{ flex: 1 }}>
          <input type="datetime-local" value={draft.outboundTime} onChange={(e) => onChange({ ...draft, outboundTime: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
