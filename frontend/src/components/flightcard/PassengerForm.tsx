import { ReactNode, useState } from "react";
import { Passenger } from "../../api";
import { Field } from "../Field";
import { Select } from "../Select";
import { BirthDateField } from "../BirthDateField";
import { DateField } from "../DateField";
import { DOCUMENT_TYPES, PassengerDocument, PassengerExtra, SSR_OPTIONS, isInfant, parsePassengerExtra } from "../../paxExtra";

export type PaxDraft = {
  surname: string;
  given_name: string;
  middle_name: string;
  ticket_number: string;
  record_locator: string;
  gender: "" | "M" | "F";
  dob: string;
  bag_count: number;
  bag_weight_kg: number;
  cabinBagCount: number;
  cabinBagWeight: number;
  ssr: string[];
  wl: boolean;
  pl: boolean;
  type: string;
  iapp: boolean;
  inbound: string;
  inboundTime: string;
  outbound: string;
  outboundTime: string;
  ffpAirline: string;
  ffpCard: string;
  documents: PassengerDocument[];
  primaryDocument: number;
};

const EMPTY_DOCUMENT: PassengerDocument = { document_type: "P", document_number: "", nationality: "", doc_expiry: "" };

export const EMPTY_PAX_DRAFT: PaxDraft = {
  surname: "",
  given_name: "",
  middle_name: "",
  ticket_number: "",
  record_locator: "",
  gender: "",
  dob: "",
  bag_count: 0,
  bag_weight_kg: 0,
  cabinBagCount: 0,
  cabinBagWeight: 0,
  ssr: [],
  wl: false,
  pl: false,
  type: "",
  iapp: false,
  inbound: "",
  inboundTime: "",
  outbound: "",
  outboundTime: "",
  ffpAirline: "",
  ffpCard: "",
  documents: [{ ...EMPTY_DOCUMENT }],
  primaryDocument: 0,
};

// The primary document lives in the real document_* columns (so the
// check-in flow — routes/checkin.ts — keeps working unchanged); any other
// documents are appended from extra.documents. Always index 0 here — which
// one is "primary" only matters for how paxDraftToPayload splits them back
// apart on save, not for how they're loaded.
export function paxDraftFrom(p: Passenger): PaxDraft {
  const extra = parsePassengerExtra(p);
  return {
    surname: p.surname,
    given_name: p.given_name,
    middle_name: p.middle_name ?? "",
    ticket_number: p.ticket_number,
    record_locator: p.record_locator,
    gender: p.gender ?? "",
    dob: p.dob ?? "",
    bag_count: p.bag_count ?? 0,
    bag_weight_kg: p.bag_weight_kg ?? 0,
    cabinBagCount: extra.cabinBagCount ?? 0,
    cabinBagWeight: extra.cabinBagWeight ?? 0,
    ssr: p.ssr ?? [],
    wl: extra.wl ?? false,
    pl: extra.pl ?? false,
    type: extra.type ?? "",
    iapp: extra.iapp ?? false,
    inbound: extra.inbound ?? "",
    inboundTime: extra.inboundTime ?? "",
    outbound: extra.outbound ?? "",
    outboundTime: extra.outboundTime ?? "",
    ffpAirline: extra.ffp?.airline ?? "",
    ffpCard: extra.ffp?.card ?? "",
    documents: [
      {
        document_type: p.document_type ?? "P",
        document_number: p.document_number ?? "",
        nationality: p.nationality ?? "",
        doc_expiry: p.doc_expiry ?? "",
      },
      ...(extra.documents ?? []),
    ],
    primaryDocument: 0,
  };
}

// Merges into the original passenger's extra blob (when editing) rather
// than replacing it outright, so fields this form doesn't cover survive an
// edit. Infant is derived from dob (IATA: under 2) instead of a manually
// set flag. Whichever document is marked primary goes into the real
// document_* columns the check-in flow reads; the rest go into extra.
export function paxDraftToPayload(d: PaxDraft, original?: Passenger): Partial<Passenger> & { extra: string } {
  const prevExtra = original ? parsePassengerExtra(original) : {};
  const primaryDoc = d.documents[d.primaryDocument] ?? d.documents[0] ?? EMPTY_DOCUMENT;
  const otherDocs = d.documents.filter((_, i) => i !== d.primaryDocument);
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
    ffp: d.ffpAirline || d.ffpCard ? { airline: d.ffpAirline, card: d.ffpCard } : undefined,
    documents: otherDocs.length ? otherDocs : undefined,
    cabinBagCount: d.cabinBagCount || undefined,
    cabinBagWeight: d.cabinBagWeight || undefined,
  };
  return {
    surname: d.surname,
    given_name: d.given_name,
    middle_name: d.middle_name,
    ticket_number: d.ticket_number,
    record_locator: d.record_locator || undefined,
    gender: d.gender || null,
    dob: d.dob || null,
    infant: isInfant(d.dob),
    bag_count: d.bag_count,
    bag_weight_kg: d.bag_weight_kg,
    ssr: d.ssr,
    document_type: primaryDoc.document_type || "P",
    document_number: primaryDoc.document_number,
    nationality: primaryDoc.nationality,
    doc_expiry: primaryDoc.doc_expiry,
    extra: JSON.stringify(extra),
  } as Partial<Passenger> & { extra: string };
}

function toggleSsr(draft: PaxDraft, code: string): PaxDraft {
  return { ...draft, ssr: draft.ssr.includes(code) ? draft.ssr.filter((c) => c !== code) : [...draft.ssr, code] };
}

interface FieldsProps {
  draft: PaxDraft;
  onChange: (draft: PaxDraft) => void;
}

/** Info about the passenger's current seat, only known (and only shown) once they're an existing, already-seated passenger being edited. */
export interface SeatSectionInfo {
  code: string | null;
  preseated: boolean;
  reserved: boolean;
  onChange: (next: { preseated: boolean; reserved: boolean }) => void;
}

export function SummaryFields({ draft, onChange, seat }: FieldsProps & { seat?: SeatSectionInfo }) {
  const infant = isInfant(draft.dob);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Surname" style={{ flex: 1 }}>
          <input value={draft.surname} onChange={(e) => onChange({ ...draft, surname: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Given name" style={{ flex: 1 }}>
          <input value={draft.given_name} onChange={(e) => onChange({ ...draft, given_name: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Middle name" style={{ flex: 1 }}>
          <input value={draft.middle_name} onChange={(e) => onChange({ ...draft, middle_name: e.target.value })} placeholder=" " />
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
        <BirthDateField label="Date of birth" value={draft.dob} onChange={(dob) => onChange({ ...draft, dob })} style={{ flex: 1 }} />
        {infant && (
          <span className="chip middle ok" style={{ marginBottom: 16 }} title="Under 2 years old, derived from date of birth">
            Infant
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label className="checkbox-row" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={draft.wl} onChange={(e) => onChange({ ...draft, wl: e.target.checked })} />
          WL
        </label>
        <label className="checkbox-row" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={draft.pl} onChange={(e) => onChange({ ...draft, pl: e.target.checked })} />
          PL
        </label>
        <Field label="Type" style={{ width: 100 }}>
          <input value={draft.type} onChange={(e) => onChange({ ...draft, type: e.target.value.toUpperCase() })} placeholder=" " maxLength={3} />
        </Field>
        <label className="checkbox-row" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={draft.iapp} onChange={(e) => onChange({ ...draft, iapp: e.target.checked })} />
          iAPP
        </label>
      </div>

      {seat && (
        <div className="field" style={{ marginTop: 0 }}>
          <label>Seat</label>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{seat.code ?? "Not assigned"}</span>
            {seat.code && (
              <>
                <label className="checkbox-row" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={seat.preseated}
                    onChange={(e) => seat.onChange({ preseated: e.target.checked, reserved: seat.reserved })}
                  />
                  Pre-seated
                </label>
                <label className="checkbox-row" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={seat.reserved}
                    onChange={(e) => seat.onChange({ preseated: seat.preseated, reserved: e.target.checked })}
                  />
                  Reserved
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentsFields({ draft, onChange }: FieldsProps) {
  function updateDoc(i: number, patch: Partial<PassengerDocument>) {
    onChange({ ...draft, documents: draft.documents.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  }
  function addDoc() {
    onChange({ ...draft, documents: [...draft.documents, { ...EMPTY_DOCUMENT }] });
  }
  function removeDoc(i: number) {
    const documents = draft.documents.filter((_, idx) => idx !== i);
    const primaryDocument =
      draft.primaryDocument === i ? 0 : draft.primaryDocument > i ? draft.primaryDocument - 1 : draft.primaryDocument;
    onChange({ ...draft, documents, primaryDocument });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
      {draft.documents.map((doc, i) => (
        <div key={i} className="document-card">
          <div className="document-card-head">
            <label className="checkbox-row" style={{ marginBottom: 0 }}>
              <input type="radio" name="primary-document" checked={draft.primaryDocument === i} onChange={() => onChange({ ...draft, primaryDocument: i })} />
              Primary
            </label>
            {draft.documents.length > 1 && (
              <button type="button" className="tertiary" style={{ color: "var(--danger)" }} onClick={() => removeDoc(i)}>
                Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Select label="Type" style={{ width: 150 }} value={doc.document_type} onChange={(v) => updateDoc(i, { document_type: v })} options={DOCUMENT_TYPES} />
            <Field label="Number" style={{ flex: 1 }}>
              <input value={doc.document_number} onChange={(e) => updateDoc(i, { document_number: e.target.value })} placeholder=" " />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <Field label="Nationality (country code)" style={{ width: 180 }}>
              <input value={doc.nationality} maxLength={2} onChange={(e) => updateDoc(i, { nationality: e.target.value.toUpperCase() })} placeholder=" " />
            </Field>
            <DateField label="Expiry" value={doc.doc_expiry} onChange={(v) => updateDoc(i, { doc_expiry: v })} style={{ flex: 1 }} />
          </div>
        </div>
      ))}
      <button type="button" className="secondary" onClick={addDoc} style={{ alignSelf: "flex-start" }}>
        Add document
      </button>
    </div>
  );
}

export function RemarksFields({ draft, onChange }: FieldsProps) {
  return (
    <div style={{ paddingBottom: 16 }}>
      <div className="field" style={{ marginTop: 0 }}>
        <label>SSR (remarks)</label>
        <div className="ssr-tags">
          {SSR_OPTIONS.map((code) => (
            <label key={code} className="checkbox-row" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={draft.ssr.includes(code)} onChange={() => onChange(toggleSsr(draft, code))} />
              <span className="mono">{code}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BaggageFields({ draft, onChange }: FieldsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
      <div>
        <div className="modal-section-label">Checked baggage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Bag count" style={{ width: 120 }}>
            <input type="number" min={0} value={draft.bag_count} onChange={(e) => onChange({ ...draft, bag_count: Number(e.target.value) })} />
          </Field>
          <Field label="Bag weight (kg)" style={{ width: 140 }}>
            <input type="number" min={0} step={0.5} value={draft.bag_weight_kg} onChange={(e) => onChange({ ...draft, bag_weight_kg: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
      <div>
        <div className="modal-section-label">Cabin (hand) baggage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Bag count" style={{ width: 120 }}>
            <input type="number" min={0} value={draft.cabinBagCount} onChange={(e) => onChange({ ...draft, cabinBagCount: Number(e.target.value) })} />
          </Field>
          <Field label="Bag weight (kg)" style={{ width: 140 }}>
            <input type="number" min={0} step={0.5} value={draft.cabinBagWeight} onChange={(e) => onChange({ ...draft, cabinBagWeight: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

export interface PaxTab {
  key: string;
  label: string;
  content: ReactNode;
}

/** Generic tab strip + panel, shared by the Add-pax modal and the full pax-details modal (which adds a Flags tab). */
export function PaxTabbedFields({ tabs, initialTab }: { tabs: PaxTab[]; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0]?.key);
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  return (
    <div>
      <div className="modal-tabs">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`modal-tab ${t.key === tab ? "selected" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {active?.content}
    </div>
  );
}
