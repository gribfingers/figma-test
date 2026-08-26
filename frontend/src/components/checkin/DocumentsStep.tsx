import { useState } from "react";
import { api, Passenger } from "../../api";
import {
  AddressDocument,
  DOCUMENT_TYPES,
  PassengerDocument,
  PassengerExtra,
  VisaDocument,
  parsePassengerExtra,
} from "../../paxExtra";
import { FlightSegment } from "../../flightSegments";
import { SegmentToggle } from "../SegmentToggle";
import { Field } from "../Field";
import { Select } from "../Select";
import { DateField } from "../DateField";
import { Modal } from "../Modal";
import { DocScannedIcon } from "../Icon";

const EMPTY_DOC: PassengerDocument = { document_type: "P", document_number: "", nationality: "", doc_expiry: "" };
const EMPTY_VISA: VisaDocument = {
  document_type: "Visa",
  expiration_date: "",
  visa_number: "",
  applicable_country: "",
  issue_country: "",
  issue_city: "",
  issue_date: "",
  birth_place: "",
};
const EMPTY_ADDRESS: AddressDocument = { address_type: "Destination", country: "", state: "", city: "", address: "", zip_code: "" };

const ADDRESS_TYPES = [
  { value: "Destination", label: "Destination" },
  { value: "Origin", label: "Origin" },
  { value: "Residence", label: "Residence" },
  { value: "Transit", label: "Transit" },
];

type DocKind = "docs" | "doco" | "doca";

interface Props {
  flightId: number;
  passenger: Passenger;
  segments: FlightSegment[];
  onUpdated: (p: Passenger) => void;
}

/**
 * The check-in flow's Documents step: DOCS (ID document — the primary one
 * lives in Passenger.document_*, any others in extra.documents), DOCO
 * (entry documents — visas) and DOCA (addresses on file). Each tab lists
 * its cards with an Edit action; a document's identity fields (name/DOB/
 * gender) mirror the passenger record and aren't edited here — only the
 * document-specific fields are.
 */
export function DocumentsStep({ flightId, passenger, segments, onUpdated }: Props) {
  const [tab, setTab] = useState<DocKind>("docs");
  const [segment, setSegment] = useState(0);
  const [editing, setEditing] = useState<{ kind: DocKind; index: number | "new" } | null>(null);
  const [saving, setSaving] = useState(false);

  const extra = parsePassengerExtra(passenger);
  const docs = extra.documents ?? [];
  const visas = extra.visaDocs ?? [];
  const addresses = extra.addressDocs ?? [];

  async function saveExtraPatch(patch: Partial<PassengerExtra>) {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, { extra: JSON.stringify({ ...extra, ...patch }) });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function savePrimaryDoc(doc: PassengerDocument) {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, {
        document_type: doc.document_type,
        document_number: doc.document_number,
        nationality: doc.nationality,
        doc_expiry: doc.doc_expiry,
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  function openAdd(kind: DocKind) {
    setTab(kind);
    setEditing({ kind, index: "new" });
  }

  return (
    <div className="docs-step">
      <div className="docs-step-top">
        <SegmentToggle segments={segments} selected={segment} onSelect={setSegment} />
        <button type="button" className="tertiary docs-verify-link" onClick={() => saveExtraPatch({ docVerified: true })} disabled={saving}>
          Verify docs on all segments
        </button>
      </div>

      <div className="docs-tabs">
        <button type="button" className={`docs-tab ${tab === "docs" ? "selected" : ""}`} onClick={() => setTab("docs")}>
          DOCS
        </button>
        <button type="button" className={`docs-tab ${tab === "doco" ? "selected" : ""}`} onClick={() => setTab("doco")}>
          DOCO {visas.length === 0 && <span className="docs-tab-warn">!</span>}
        </button>
        <button type="button" className={`docs-tab ${tab === "doca" ? "selected" : ""}`} onClick={() => setTab("doca")}>
          DOCA
        </button>
      </div>

      <button type="button" className="tertiary docs-add-link" onClick={() => openAdd(tab)}>
        Add document
      </button>

      {tab === "docs" && (
        <div className="docs-cards">
          <DocsCard
            passenger={passenger}
            doc={{ document_type: passenger.document_type ?? "P", document_number: passenger.document_number ?? "", nationality: passenger.nationality ?? "", doc_expiry: passenger.doc_expiry ?? "" }}
            scanned={extra.docScanned}
            onEdit={() => setEditing({ kind: "docs", index: 0 })}
          />
          {docs.map((doc, i) => (
            <DocsCard key={i} passenger={passenger} doc={doc} onEdit={() => setEditing({ kind: "docs", index: i + 1 })} />
          ))}
        </div>
      )}

      {tab === "doco" && (
        <div className="docs-cards">
          {visas.length === 0 && <div className="docs-empty">No entry documents on file.</div>}
          {visas.map((v, i) => (
            <VisaCard key={i} passenger={passenger} doc={v} onEdit={() => setEditing({ kind: "doco", index: i })} />
          ))}
        </div>
      )}

      {tab === "doca" && (
        <div className="docs-cards">
          {addresses.length === 0 && <div className="docs-empty">No address on file.</div>}
          {addresses.map((a, i) => (
            <AddressCard key={i} doc={a} onEdit={() => setEditing({ kind: "doca", index: i })} />
          ))}
        </div>
      )}

      {editing && editing.kind === "docs" && (
        <DocEditModal
          initial={editing.index === "new" ? { ...EMPTY_DOC } : editing.index === 0 ? { document_type: passenger.document_type ?? "P", document_number: passenger.document_number ?? "", nationality: passenger.nationality ?? "", doc_expiry: passenger.doc_expiry ?? "" } : docs[editing.index - 1]}
          onClose={() => setEditing(null)}
          onSave={async (doc) => {
            if (editing.index === "new") {
              await saveExtraPatch({ documents: [...docs, doc] });
            } else if (editing.index === 0) {
              await savePrimaryDoc(doc);
            } else {
              await saveExtraPatch({ documents: docs.map((d, i) => (i === (editing.index as number) - 1 ? doc : d)) });
            }
            setEditing(null);
          }}
        />
      )}

      {editing && editing.kind === "doco" && (
        <VisaEditModal
          initial={editing.index === "new" ? { ...EMPTY_VISA } : visas[editing.index]}
          onClose={() => setEditing(null)}
          onSave={async (doc) => {
            const next = editing.index === "new" ? [...visas, doc] : visas.map((v, i) => (i === editing.index ? doc : v));
            await saveExtraPatch({ visaDocs: next });
            setEditing(null);
          }}
        />
      )}

      {editing && editing.kind === "doca" && (
        <AddressEditModal
          initial={editing.index === "new" ? { ...EMPTY_ADDRESS } : addresses[editing.index]}
          onClose={() => setEditing(null)}
          onSave={async (doc) => {
            const next = editing.index === "new" ? [...addresses, doc] : addresses.map((a, i) => (i === editing.index ? doc : a));
            await saveExtraPatch({ addressDocs: next });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DocsCard({ passenger, doc, scanned, onEdit }: { passenger: Passenger; doc: PassengerDocument; scanned?: boolean; onEdit: () => void }) {
  const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label.replace(/ \(.+\)$/, "") ?? doc.document_type;
  return (
    <div className="doc-card">
      <div className="doc-card-grid">
        <div className="doc-field"><span className="doc-field-label">Document Type</span><span className="doc-field-value">{typeLabel}</span></div>
        <div className="doc-field"><span className="doc-field-label">Issue Country</span><span className="doc-field-value">{doc.nationality || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Document Number</span><span className="doc-field-value">{doc.document_number || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Nationality</span><span className="doc-field-value">{doc.nationality || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Surname</span><span className="doc-field-value">{passenger.surname}</span></div>
        <div className="doc-field"><span className="doc-field-label">Name</span><span className="doc-field-value">{passenger.given_name}</span></div>
        <div className="doc-field"><span className="doc-field-label">Middle Name</span><span className="doc-field-value">{passenger.middle_name || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Birth Date</span><span className="doc-field-value">{passenger.dob ?? "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Gender</span><span className="doc-field-value">{passenger.gender ?? "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Valid Till</span><span className="doc-field-value">{doc.doc_expiry || "—"}</span></div>
      </div>
      <div className="doc-card-footer">
        {scanned !== undefined ? (
          <div className="doc-scanned-mark" title={scanned ? "Document scanned" : "Not scanned"}>
            <DocScannedIcon size={16} className={scanned ? "pnr-doc-icon-on" : "pnr-doc-icon-off"} />
          </div>
        ) : (
          <span />
        )}
        <div className="doc-card-actions">
          {/* Placeholder — no scanner hardware wired up yet. */}
          <button type="button" className="tertiary" disabled>Scan</button>
          <button type="button" className="tertiary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function VisaCard({ passenger, doc, onEdit }: { passenger: Passenger; doc: VisaDocument; onEdit: () => void }) {
  return (
    <div className="doc-card">
      <div className="doc-card-grid">
        <div className="doc-field"><span className="doc-field-label">Document Type</span><span className="doc-field-value">{doc.document_type || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Expiration Date</span><span className="doc-field-value">{doc.expiration_date || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Visa Number</span><span className="doc-field-value">{doc.visa_number || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Applicable Country</span><span className="doc-field-value">{doc.applicable_country || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Issue Country</span><span className="doc-field-value">{doc.issue_country || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Issue City</span><span className="doc-field-value">{doc.issue_city || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Issue Date</span><span className="doc-field-value">{doc.issue_date || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Passenger Birth Place</span><span className="doc-field-value">{doc.birth_place || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Name</span><span className="doc-field-value">{passenger.given_name}</span></div>
        <div className="doc-field"><span className="doc-field-label">Second Name</span><span className="doc-field-value">{passenger.middle_name || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Surname</span><span className="doc-field-value">{passenger.surname}</span></div>
        <div className="doc-field"><span className="doc-field-label">Nationality</span><span className="doc-field-value">{passenger.nationality || "—"}</span></div>
      </div>
      <div className="doc-card-actions">
        <button type="button" className="tertiary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}

function AddressCard({ doc, onEdit }: { doc: AddressDocument; onEdit: () => void }) {
  return (
    <div className="doc-card">
      <div className="doc-card-grid doc-card-grid-2">
        <div className="doc-field"><span className="doc-field-label">Address Type</span><span className="doc-field-value">{doc.address_type || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Country</span><span className="doc-field-value">{doc.country || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">State/Province</span><span className="doc-field-value">{doc.state || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">City</span><span className="doc-field-value">{doc.city || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Address</span><span className="doc-field-value">{doc.address || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">Zip Code</span><span className="doc-field-value">{doc.zip_code || "—"}</span></div>
      </div>
      <div className="doc-card-actions">
        <button type="button" className="tertiary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}

function DocEditModal({ initial, onClose, onSave }: { initial: PassengerDocument; onClose: () => void; onSave: (d: PassengerDocument) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title="Edit document"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="tertiary" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); }}>Save</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Select label="Document Type" style={{ width: 180 }} value={draft.document_type} onChange={(v) => setDraft({ ...draft, document_type: v })} options={DOCUMENT_TYPES} />
          <Field label="Document Number" style={{ flex: 1 }}>
            <input value={draft.document_number} onChange={(e) => setDraft({ ...draft, document_number: e.target.value })} placeholder=" " />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Nationality / Issue Country" style={{ flex: 1 }}>
            <input value={draft.nationality} maxLength={2} onChange={(e) => setDraft({ ...draft, nationality: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <DateField label="Valid Till" value={draft.doc_expiry} onChange={(v) => setDraft({ ...draft, doc_expiry: v })} style={{ flex: 1 }} />
        </div>
      </div>
    </Modal>
  );
}

function VisaEditModal({ initial, onClose, onSave }: { initial: VisaDocument; onClose: () => void; onSave: (d: VisaDocument) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title="Edit entry document"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="tertiary" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); }}>Save</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Document Type" style={{ flex: 1 }}>
            <input value={draft.document_type} onChange={(e) => setDraft({ ...draft, document_type: e.target.value })} placeholder=" " />
          </Field>
          <Field label="Visa Number" style={{ flex: 1 }}>
            <input value={draft.visa_number} onChange={(e) => setDraft({ ...draft, visa_number: e.target.value })} placeholder=" " />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <DateField label="Expiration Date" value={draft.expiration_date} onChange={(v) => setDraft({ ...draft, expiration_date: v })} style={{ flex: 1 }} />
          <Field label="Applicable Country" style={{ flex: 1 }}>
            <input value={draft.applicable_country} onChange={(e) => setDraft({ ...draft, applicable_country: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Issue Country" style={{ flex: 1 }}>
            <input value={draft.issue_country} onChange={(e) => setDraft({ ...draft, issue_country: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <Field label="Issue City" style={{ flex: 1 }}>
            <input value={draft.issue_city} onChange={(e) => setDraft({ ...draft, issue_city: e.target.value })} placeholder=" " />
          </Field>
          <DateField label="Issue Date" value={draft.issue_date} onChange={(v) => setDraft({ ...draft, issue_date: v })} style={{ flex: 1 }} />
        </div>
        <Field label="Passenger Birth Place">
          <input value={draft.birth_place} onChange={(e) => setDraft({ ...draft, birth_place: e.target.value })} placeholder=" " />
        </Field>
      </div>
    </Modal>
  );
}

function AddressEditModal({ initial, onClose, onSave }: { initial: AddressDocument; onClose: () => void; onSave: (d: AddressDocument) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title="Edit address"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="tertiary" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); }}>Save</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Select label="Address Type" style={{ width: 180 }} value={draft.address_type} onChange={(v) => setDraft({ ...draft, address_type: v })} options={ADDRESS_TYPES} />
          <Field label="Country" style={{ flex: 1 }}>
            <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder=" " />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="State/Province" style={{ flex: 1 }}>
            <input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder=" " />
          </Field>
          <Field label="City" style={{ flex: 1 }}>
            <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder=" " />
          </Field>
        </div>
        <Field label="Address">
          <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Zip Code">
          <input value={draft.zip_code} onChange={(e) => setDraft({ ...draft, zip_code: e.target.value })} placeholder=" " />
        </Field>
      </div>
    </Modal>
  );
}
