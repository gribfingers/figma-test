import { KeyboardEvent as ReactKeyboardEvent, RefObject, useEffect, useRef, useState } from "react";
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
import { BirthDateField } from "../BirthDateField";
import { DocScannedIcon } from "../Icon";
import { useLanguage } from "../../i18n";
import { useHotkey } from "../../useShortcuts";

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
const GENDER_OPTIONS = [{ value: "", label: "—" }, { value: "M", label: "M" }, { value: "F", label: "F" }];

/** Identity fields a passport/ID document form can correct — they live on the passenger record, not the document. */
interface Identity {
  surname: string;
  given_name: string;
  middle_name: string;
  dob: string;
  gender: "" | "M" | "F";
}

function identityFrom(p: Passenger): Identity {
  return { surname: p.surname, given_name: p.given_name, middle_name: p.middle_name ?? "", dob: p.dob ?? "", gender: p.gender ?? "" };
}

type DocKind = "docs" | "doco" | "doca";
interface EditTarget {
  kind: DocKind;
  index: number | "new";
}

const DOC_KIND_TABS: { key: DocKind; label: string }[] = [
  { key: "docs", label: "DOCS" },
  { key: "doco", label: "DOCO" },
  { key: "doca", label: "DOCA" },
];

interface Props {
  flightId: number;
  passenger: Passenger;
  segments: FlightSegment[];
  onUpdated: (p: Passenger) => void;
}

/**
 * The check-in flow's Documents step: DOCS (ID document — the primary one
 * lives in Passenger.document_*, any others in extra.documents), DOCO
 * (entry documents — visas) and DOCA (addresses on file). Each card edits
 * in place (Save/Undo changes/Delete/Exit) rather than in a modal.
 */
export function DocumentsStep({ flightId, passenger, segments, onUpdated }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<DocKind>("docs");
  const [segment, setSegment] = useState(0);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const extra = parsePassengerExtra(passenger);
  const docs = extra.documents ?? [];
  const visas = extra.visaDocs ?? [];
  const addresses = extra.addressDocs ?? [];
  const primaryDoc: PassengerDocument = {
    document_type: passenger.document_type ?? "P",
    document_number: passenger.document_number ?? "",
    nationality: passenger.nationality ?? "",
    doc_expiry: passenger.doc_expiry ?? "",
  };

  function isEditing(kind: DocKind, index: number | "new") {
    return editing?.kind === kind && editing.index === index;
  }

  // Roving tabindex over the DOCS/DOCO/DOCA tabs — same pattern as SegmentToggle/any other tablist
  // in the app: one Tab stop, Left/Right switches (and activates) the next tab.
  const docTabRefs = useRef(new Map<DocKind, HTMLButtonElement>());
  function moveDocTab(delta: 1 | -1) {
    const idx = DOC_KIND_TABS.findIndex((k) => k.key === tab);
    const next = DOC_KIND_TABS[(idx + delta + DOC_KIND_TABS.length) % DOC_KIND_TABS.length];
    setTab(next.key);
    docTabRefs.current.get(next.key)?.focus();
  }

  // And again over the (non-editing) document cards of the active tab — one card is a Tab stop,
  // Up/Down moves it, Enter/Space opens it for editing. Switching tabs naturally resets which card
  // is active (a stale key from another tab's list just falls through to index 0 below).
  const cardCount = tab === "docs" ? 1 + docs.length : tab === "doco" ? visas.length : addresses.length;
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [focusedCardKey, setFocusedCardKey] = useState<string | null>(null);
  function cardKey(index: number) {
    return `${tab}:${index}`;
  }
  const focusedMatch = /^([a-z]+):(\d+)$/.exec(focusedCardKey ?? "");
  const activeCardIndex =
    focusedMatch && focusedMatch[1] === tab && Number(focusedMatch[2]) < cardCount ? Number(focusedMatch[2]) : 0;
  function moveCard(delta: 1 | -1) {
    if (cardCount === 0) return;
    const next = Math.max(0, Math.min(cardCount - 1, activeCardIndex + delta));
    setFocusedCardKey(cardKey(next));
    cardRefs.current.get(cardKey(next))?.focus();
  }

  // A card being edited replaces its own view-mode div with the edit form (same key, different
  // markup) — the only element in that subtree, so a single shared ref/focus works for whichever of
  // the three card kinds happens to be the one currently in edit mode (EditTarget is ever non-null
  // for at most one card at a time).
  const editFormRef = useRef<HTMLDivElement>(null);
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (editing) {
      const id = requestAnimationFrame(() => editFormRef.current?.focus());
      wasEditingRef.current = true;
      return () => cancelAnimationFrame(id);
    }
    if (wasEditingRef.current) {
      // Just exited edit mode (Save/Undo/Delete/Exit) — hand focus back to the roving card list
      // instead of leaving it to fall through to <body>.
      const id = requestAnimationFrame(() => cardRefs.current.get(cardKey(activeCardIndex))?.focus());
      wasEditingRef.current = false;
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function saveExtraPatch(patch: Partial<PassengerExtra>, identity?: Identity) {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, {
        ...(identity
          ? {
              surname: identity.surname,
              given_name: identity.given_name,
              middle_name: identity.middle_name,
              dob: identity.dob || null,
              gender: identity.gender || null,
            }
          : {}),
        extra: JSON.stringify({ ...extra, ...patch }),
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function savePrimaryDoc(doc: PassengerDocument, identity: Identity) {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, {
        document_type: doc.document_type,
        document_number: doc.document_number,
        nationality: doc.nationality,
        doc_expiry: doc.doc_expiry,
        surname: identity.surname,
        given_name: identity.given_name,
        middle_name: identity.middle_name,
        dob: identity.dob || null,
        gender: identity.gender || null,
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDoc(kind: "docs" | "doco" | "doca", index: number) {
    if (kind === "docs") await saveExtraPatch({ documents: docs.filter((_, i) => i !== index) });
    if (kind === "doco") await saveExtraPatch({ visaDocs: visas.filter((_, i) => i !== index) });
    if (kind === "doca") await saveExtraPatch({ addressDocs: addresses.filter((_, i) => i !== index) });
    setEditing(null);
  }

  useHotkey("flow.verify-docs", () => saveExtraPatch({ docVerified: true }), !extra.docVerified && !saving);
  // A standalone one-off action, same reasoning as checkin.start/Add pax elsewhere — not part of any
  // roving-tabindex group, so it needs its own combo rather than depending on Tab reaching it.
  useHotkey("flow.add-document", () => setEditing({ kind: tab, index: "new" }), !editing);

  return (
    <div className="docs-step">
      <div className="docs-step-top">
        <SegmentToggle segments={segments} selected={segment} onSelect={setSegment} />
        {extra.docVerified ? (
          <span className="docs-verify-link docs-verify-done">{t("Docs on all segments are verified")}</span>
        ) : (
          <button type="button" className="tertiary docs-verify-link" onClick={() => saveExtraPatch({ docVerified: true })} disabled={saving}>
            {t("Verify docs on all segments")}
          </button>
        )}
      </div>

      <div className="docs-tabs" role="tablist">
        {DOC_KIND_TABS.map((k) => (
          <button
            key={k.key}
            ref={(el) => {
              if (el) docTabRefs.current.set(k.key, el);
              else docTabRefs.current.delete(k.key);
            }}
            type="button"
            role="tab"
            aria-selected={tab === k.key}
            tabIndex={tab === k.key ? 0 : -1}
            className={`docs-tab ${tab === k.key ? "selected" : ""}`}
            onClick={() => setTab(k.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); moveDocTab(1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); moveDocTab(-1); }
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <button type="button" className="tertiary docs-add-link" onClick={() => setEditing({ kind: tab, index: "new" })}>
        {t("Add document")}
      </button>

      {tab === "docs" && (
        <div className="docs-cards">
          <DocsCard
            passenger={passenger}
            doc={primaryDoc}
            scanned={extra.docScanned}
            editing={isEditing("docs", 0)}
            deletable={false}
            saving={saving}
            focused={activeCardIndex === 0}
            cardRef={(el) => { if (el) cardRefs.current.set(cardKey(0), el); else cardRefs.current.delete(cardKey(0)); }}
            onFocusCard={() => setFocusedCardKey(cardKey(0))}
            onMove={moveCard}
            editFormRef={editFormRef}
            onEdit={() => setEditing({ kind: "docs", index: 0 })}
            onCancel={() => setEditing(null)}
            onSave={async (doc, identity) => {
              await savePrimaryDoc(doc, identity);
              setEditing(null);
            }}
          />
          {docs.map((doc, i) => (
            <DocsCard
              key={i}
              passenger={passenger}
              doc={doc}
              editing={isEditing("docs", i + 1)}
              deletable
              saving={saving}
              focused={activeCardIndex === i + 1}
              cardRef={(el) => { if (el) cardRefs.current.set(cardKey(i + 1), el); else cardRefs.current.delete(cardKey(i + 1)); }}
              onFocusCard={() => setFocusedCardKey(cardKey(i + 1))}
              onMove={moveCard}
              editFormRef={editFormRef}
              onEdit={() => setEditing({ kind: "docs", index: i + 1 })}
              onCancel={() => setEditing(null)}
              onDelete={() => deleteDoc("docs", i)}
              onSave={async (doc, identity) => {
                await saveExtraPatch({ documents: docs.map((d, idx) => (idx === i ? doc : d)) }, identity);
                setEditing(null);
              }}
            />
          ))}
          {isEditing("docs", "new") && (
            <DocsCard
              passenger={passenger}
              doc={{ ...EMPTY_DOC }}
              editing
              deletable={false}
              saving={saving}
              editFormRef={editFormRef}
              onCancel={() => setEditing(null)}
              onSave={async (doc, identity) => {
                await saveExtraPatch({ documents: [...docs, doc] }, identity);
                setEditing(null);
              }}
            />
          )}
        </div>
      )}

      {tab === "doco" && (
        <div className="docs-cards">
          {visas.length === 0 && !isEditing("doco", "new") && <div className="docs-empty">{t("No entry documents on file.")}</div>}
          {visas.map((v, i) => (
            <VisaCard
              key={i}
              passenger={passenger}
              doc={v}
              editing={isEditing("doco", i)}
              saving={saving}
              focused={activeCardIndex === i}
              cardRef={(el) => { if (el) cardRefs.current.set(cardKey(i), el); else cardRefs.current.delete(cardKey(i)); }}
              onFocusCard={() => setFocusedCardKey(cardKey(i))}
              onMove={moveCard}
              editFormRef={editFormRef}
              onEdit={() => setEditing({ kind: "doco", index: i })}
              onCancel={() => setEditing(null)}
              onDelete={() => deleteDoc("doco", i)}
              onSave={async (doc) => {
                await saveExtraPatch({ visaDocs: visas.map((v2, idx) => (idx === i ? doc : v2)) });
                setEditing(null);
              }}
            />
          ))}
          {isEditing("doco", "new") && (
            <VisaCard
              passenger={passenger}
              doc={{ ...EMPTY_VISA }}
              editing
              saving={saving}
              editFormRef={editFormRef}
              onCancel={() => setEditing(null)}
              onSave={async (doc) => {
                await saveExtraPatch({ visaDocs: [...visas, doc] });
                setEditing(null);
              }}
            />
          )}
        </div>
      )}

      {tab === "doca" && (
        <div className="docs-cards">
          {addresses.length === 0 && !isEditing("doca", "new") && <div className="docs-empty">{t("No address on file.")}</div>}
          {addresses.map((a, i) => (
            <AddressCard
              key={i}
              doc={a}
              editing={isEditing("doca", i)}
              saving={saving}
              focused={activeCardIndex === i}
              cardRef={(el) => { if (el) cardRefs.current.set(cardKey(i), el); else cardRefs.current.delete(cardKey(i)); }}
              onFocusCard={() => setFocusedCardKey(cardKey(i))}
              onMove={moveCard}
              editFormRef={editFormRef}
              onEdit={() => setEditing({ kind: "doca", index: i })}
              onCancel={() => setEditing(null)}
              onDelete={() => deleteDoc("doca", i)}
              onSave={async (doc) => {
                await saveExtraPatch({ addressDocs: addresses.map((a2, idx) => (idx === i ? doc : a2)) });
                setEditing(null);
              }}
            />
          ))}
          {isEditing("doca", "new") && (
            <AddressCard
              doc={{ ...EMPTY_ADDRESS }}
              editing
              saving={saving}
              editFormRef={editFormRef}
              onCancel={() => setEditing(null)}
              onSave={async (doc) => {
                await saveExtraPatch({ addressDocs: [...addresses, doc] });
                setEditing(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Save/Undo changes/Delete/Exit footer shared by every editable card. */
function EditFooter({ deletable, saving, onSave, onUndo, onDelete, onExit }: { deletable: boolean; saving: boolean; onSave: () => void; onUndo: () => void; onDelete?: () => void; onExit: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="doc-card-edit-footer">
      <button type="button" disabled={saving} onClick={onSave}>{t("Save")}</button>
      <button type="button" className="tertiary" onClick={onUndo}>{t("Undo changes")}</button>
      {deletable && onDelete && (
        <button type="button" className="tertiary" style={{ color: "var(--danger)" }} onClick={onDelete}>{t("Delete")}</button>
      )}
      <button type="button" className="tertiary" onClick={onExit}>{t("Exit")}</button>
    </div>
  );
}

/** Roving-tabindex wiring for the (non-editing) card list, shared by DocsCard/VisaCard/AddressCard
 *  — omitted for a brand-new "add document" card, which isn't part of any list yet. `editFormRef` is
 *  the one exception that DOES apply while editing: the parent focuses it the moment this card
 *  switches into edit mode, so focus doesn't fall through to <body> when the view-mode div (which
 *  had it) unmounts. */
interface CardFocusProps {
  focused?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  onFocusCard?: () => void;
  onMove?: (delta: 1 | -1) => void;
  editFormRef?: RefObject<HTMLDivElement>;
}

/** Enter/Space on the (focused) view-mode card opens it for editing, same as clicking Edit; Up/Down
 *  moves the roving-tabindex focus to the neighboring card. */
function cardListKeyDown(e: ReactKeyboardEvent, onEdit: (() => void) | undefined, onMove: ((delta: 1 | -1) => void) | undefined) {
  if (e.key === "Enter" || e.key === " ") { if (onEdit) { e.preventDefault(); onEdit(); } }
  else if (e.key === "ArrowDown") { e.preventDefault(); onMove?.(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); onMove?.(-1); }
}

/** Ctrl/Cmd+Enter saves, Escape exits — attached to the whole edit-form wrapper so it fires no
 *  matter which nested field currently has focus (mirrors flow.checkin's mod|enter for the wider
 *  flow, free here since that shortcut is disabled while on the Docs step). */
function editFormKeyDown(e: ReactKeyboardEvent, onSave: () => void, onExit: () => void) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(); }
  else if (e.key === "Escape") { e.preventDefault(); onExit(); }
}

interface DocsCardProps extends CardFocusProps {
  passenger: Passenger;
  doc: PassengerDocument;
  scanned?: boolean;
  editing: boolean;
  deletable: boolean;
  saving: boolean;
  onEdit?: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (doc: PassengerDocument, identity: Identity) => void;
}

function DocsCard({
  passenger,
  doc,
  scanned,
  editing,
  deletable,
  saving,
  focused,
  cardRef,
  onFocusCard,
  onMove,
  editFormRef,
  onEdit,
  onCancel,
  onDelete,
  onSave,
}: DocsCardProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(doc);
  const [identity, setIdentity] = useState(() => identityFrom(passenger));
  useEffect(() => {
    if (editing) {
      setDraft(doc);
      setIdentity(identityFrom(passenger));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) {
    const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label.replace(/ \(.+\)$/, "") ?? doc.document_type;
    return (
      <div
        className="doc-card"
        ref={cardRef}
        tabIndex={focused ? 0 : -1}
        onFocus={onFocusCard}
        onKeyDown={(e) => cardListKeyDown(e, onEdit, onMove)}
      >
        <div className="doc-card-grid">
          <div className="doc-field"><span className="doc-field-label">{t("Document Type")}</span><span className="doc-field-value">{typeLabel}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Issue Country")}</span><span className="doc-field-value">{doc.nationality || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Document Number")}</span><span className="doc-field-value">{doc.document_number || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Nationality")}</span><span className="doc-field-value">{doc.nationality || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Surname")}</span><span className="doc-field-value">{passenger.surname}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Name")}</span><span className="doc-field-value">{passenger.given_name}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Middle Name")}</span><span className="doc-field-value">{passenger.middle_name || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Birth Date")}</span><span className="doc-field-value">{passenger.dob ?? "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Gender")}</span><span className="doc-field-value">{passenger.gender ?? "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Valid Till")}</span><span className="doc-field-value">{doc.doc_expiry || "—"}</span></div>
        </div>
        <div className="doc-card-footer">
          {scanned !== undefined ? (
            <div className="doc-scanned-mark" title={scanned ? t("Document scanned") : t("Not scanned")}>
              <DocScannedIcon size={16} className={scanned ? "pnr-doc-icon-on" : "pnr-doc-icon-off"} />
            </div>
          ) : (
            <span />
          )}
          <div className="doc-card-actions">
            {/* Placeholder — no scanner hardware wired up yet. */}
            <button type="button" className="tertiary" tabIndex={-1} disabled>{t("Scan")}</button>
            {/* tabIndex=-1: mouse-only — the card itself is the one Tab stop for this list (see cardRef above). */}
            <button type="button" className="tertiary" tabIndex={-1} onClick={onEdit}>{t("Edit")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="doc-card doc-card-editing"
      ref={editFormRef}
      tabIndex={-1}
      onKeyDown={(e) => editFormKeyDown(e, () => onSave(draft, identity), onCancel)}
    >
      <div className="doc-card-grid">
        <Select label={t("Document Type")} value={draft.document_type} onChange={(v) => setDraft({ ...draft, document_type: v })} options={DOCUMENT_TYPES} />
        <Field label={t("Issue Country")}><input value={draft.nationality} maxLength={2} onChange={(e) => setDraft({ ...draft, nationality: e.target.value.toUpperCase() })} placeholder=" " /></Field>
        <Field label={t("Document Number")}><input value={draft.document_number} onChange={(e) => setDraft({ ...draft, document_number: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Nationality")}><input value={draft.nationality} maxLength={2} onChange={(e) => setDraft({ ...draft, nationality: e.target.value.toUpperCase() })} placeholder=" " /></Field>
        <Field label={t("Surname")}><input value={identity.surname} onChange={(e) => setIdentity({ ...identity, surname: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Name")}><input value={identity.given_name} onChange={(e) => setIdentity({ ...identity, given_name: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Middle Name")}><input value={identity.middle_name} onChange={(e) => setIdentity({ ...identity, middle_name: e.target.value })} placeholder=" " /></Field>
        <BirthDateField label={t("Birth Date")} value={identity.dob} onChange={(v) => setIdentity({ ...identity, dob: v })} />
        <Select label={t("Gender")} value={identity.gender} onChange={(v) => setIdentity({ ...identity, gender: v as Identity["gender"] })} options={GENDER_OPTIONS} />
        <DateField label={t("Valid Till")} value={draft.doc_expiry} onChange={(v) => setDraft({ ...draft, doc_expiry: v })} />
      </div>
      <EditFooter
        deletable={deletable}
        saving={saving}
        onSave={() => onSave(draft, identity)}
        onUndo={() => { setDraft(doc); setIdentity(identityFrom(passenger)); }}
        onDelete={onDelete}
        onExit={onCancel}
      />
    </div>
  );
}

interface VisaCardProps extends CardFocusProps {
  passenger: Passenger;
  doc: VisaDocument;
  editing: boolean;
  saving: boolean;
  onEdit?: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (doc: VisaDocument) => void;
}

function VisaCard({ passenger, doc, editing, saving, focused, cardRef, onFocusCard, onMove, editFormRef, onEdit, onCancel, onDelete, onSave }: VisaCardProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(doc);
  useEffect(() => {
    if (editing) setDraft(doc);
  }, [editing, doc]);

  if (!editing) {
    return (
      <div
        className="doc-card"
        ref={cardRef}
        tabIndex={focused ? 0 : -1}
        onFocus={onFocusCard}
        onKeyDown={(e) => cardListKeyDown(e, onEdit, onMove)}
      >
        <div className="doc-card-grid">
          <div className="doc-field"><span className="doc-field-label">{t("Document Type")}</span><span className="doc-field-value">{doc.document_type || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Expiration Date")}</span><span className="doc-field-value">{doc.expiration_date || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Visa Number")}</span><span className="doc-field-value">{doc.visa_number || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Applicable Country")}</span><span className="doc-field-value">{doc.applicable_country || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Issue Country")}</span><span className="doc-field-value">{doc.issue_country || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Issue City")}</span><span className="doc-field-value">{doc.issue_city || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Issue Date")}</span><span className="doc-field-value">{doc.issue_date || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Passenger Birth Place")}</span><span className="doc-field-value">{doc.birth_place || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Name")}</span><span className="doc-field-value">{passenger.given_name}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Second Name")}</span><span className="doc-field-value">{passenger.middle_name || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Surname")}</span><span className="doc-field-value">{passenger.surname}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Nationality")}</span><span className="doc-field-value">{passenger.nationality || "—"}</span></div>
        </div>
        <div className="doc-card-actions">
          {/* tabIndex=-1: mouse-only — the card itself is the one Tab stop for this list (see cardRef above). */}
          <button type="button" className="tertiary" tabIndex={-1} onClick={onEdit}>{t("Edit")}</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="doc-card doc-card-editing"
      ref={editFormRef}
      tabIndex={-1}
      onKeyDown={(e) => editFormKeyDown(e, () => onSave(draft), onCancel)}
    >
      <div className="doc-card-grid">
        <Field label={t("Document Type")}><input value={draft.document_type} onChange={(e) => setDraft({ ...draft, document_type: e.target.value })} placeholder=" " /></Field>
        <DateField label={t("Expiration Date")} value={draft.expiration_date} onChange={(v) => setDraft({ ...draft, expiration_date: v })} />
        <Field label={t("Visa Number")}><input value={draft.visa_number} onChange={(e) => setDraft({ ...draft, visa_number: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Applicable Country")}><input value={draft.applicable_country} onChange={(e) => setDraft({ ...draft, applicable_country: e.target.value.toUpperCase() })} placeholder=" " /></Field>
        <Field label={t("Issue Country")}><input value={draft.issue_country} onChange={(e) => setDraft({ ...draft, issue_country: e.target.value.toUpperCase() })} placeholder=" " /></Field>
        <Field label={t("Issue City")}><input value={draft.issue_city} onChange={(e) => setDraft({ ...draft, issue_city: e.target.value })} placeholder=" " /></Field>
        <DateField label={t("Issue Date")} value={draft.issue_date} onChange={(v) => setDraft({ ...draft, issue_date: v })} />
        <Field label={t("Passenger Birth Place")}><input value={draft.birth_place} onChange={(e) => setDraft({ ...draft, birth_place: e.target.value })} placeholder=" " /></Field>
        <div className="doc-field"><span className="doc-field-label">{t("Name")}</span><span className="doc-field-value">{passenger.given_name}</span></div>
        <div className="doc-field"><span className="doc-field-label">{t("Second Name")}</span><span className="doc-field-value">{passenger.middle_name || "—"}</span></div>
        <div className="doc-field"><span className="doc-field-label">{t("Surname")}</span><span className="doc-field-value">{passenger.surname}</span></div>
        <div className="doc-field"><span className="doc-field-label">{t("Nationality")}</span><span className="doc-field-value">{passenger.nationality || "—"}</span></div>
      </div>
      <EditFooter deletable saving={saving} onSave={() => onSave(draft)} onUndo={() => setDraft(doc)} onDelete={onDelete} onExit={onCancel} />
    </div>
  );
}

interface AddressCardProps extends CardFocusProps {
  doc: AddressDocument;
  editing: boolean;
  saving: boolean;
  onEdit?: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (doc: AddressDocument) => void;
}

function AddressCard({ doc, editing, saving, focused, cardRef, onFocusCard, onMove, editFormRef, onEdit, onCancel, onDelete, onSave }: AddressCardProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(doc);
  useEffect(() => {
    if (editing) setDraft(doc);
  }, [editing, doc]);

  if (!editing) {
    return (
      <div
        className="doc-card"
        ref={cardRef}
        tabIndex={focused ? 0 : -1}
        onFocus={onFocusCard}
        onKeyDown={(e) => cardListKeyDown(e, onEdit, onMove)}
      >
        <div className="doc-card-grid doc-card-grid-2">
          <div className="doc-field"><span className="doc-field-label">{t("Address Type")}</span><span className="doc-field-value">{doc.address_type || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Country")}</span><span className="doc-field-value">{doc.country || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("State/Province")}</span><span className="doc-field-value">{doc.state || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("City")}</span><span className="doc-field-value">{doc.city || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Address")}</span><span className="doc-field-value">{doc.address || "—"}</span></div>
          <div className="doc-field"><span className="doc-field-label">{t("Zip Code")}</span><span className="doc-field-value">{doc.zip_code || "—"}</span></div>
        </div>
        <div className="doc-card-actions">
          {/* tabIndex=-1: mouse-only — the card itself is the one Tab stop for this list (see cardRef above). */}
          <button type="button" className="tertiary" tabIndex={-1} onClick={onEdit}>{t("Edit")}</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="doc-card doc-card-editing"
      ref={editFormRef}
      tabIndex={-1}
      onKeyDown={(e) => editFormKeyDown(e, () => onSave(draft), onCancel)}
    >
      <div className="doc-card-grid doc-card-grid-2">
        <Select label={t("Address Type")} value={draft.address_type} onChange={(v) => setDraft({ ...draft, address_type: v })} options={ADDRESS_TYPES.map((o) => ({ ...o, label: t(o.label) }))} />
        <Field label={t("Country")}><input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder=" " /></Field>
        <Field label={t("State/Province")}><input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder=" " /></Field>
        <Field label={t("City")}><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Address")}><input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder=" " /></Field>
        <Field label={t("Zip Code")}><input value={draft.zip_code} onChange={(e) => setDraft({ ...draft, zip_code: e.target.value })} placeholder=" " /></Field>
      </div>
      <EditFooter deletable saving={saving} onSave={() => onSave(draft)} onUndo={() => setDraft(doc)} onDelete={onDelete} onExit={onCancel} />
    </div>
  );
}
