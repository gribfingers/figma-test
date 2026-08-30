import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, Flight, Passenger } from "../../api";
import { FlightSegment } from "../../flightSegments";
import { formatSeatDisplay } from "../../seatExtra";
import { useToast } from "../../toast";
import { usePopoverPosition } from "../../usePopoverPosition";
import { Field } from "../Field";
import { Select, SelectOption } from "../Select";
import { DateField } from "../DateField";
import { ChevronDownIcon, CloseIcon, MinusIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon } from "../Icon";
import { useLanguage } from "../../i18n";

export type ActionsPanelKind = "cancel" | "move" | "print" | "priority" | "remarks" | "quick" | "transfer";

/** The 7 actions available anywhere a group of passengers can be selected — the PNR roster's Actions
 *  dropdown and the flight card's Pax tab both list these against whichever passengers are checked. */
export const ACTIONS_MENU_ITEMS: { label: string; kind: ActionsPanelKind }[] = [
  { label: "Quick check-in", kind: "quick" },
  { label: "Cancel check-in", kind: "cancel" },
  { label: "Move to another flight", kind: "move" },
  { label: "Priority List", kind: "priority" },
  { label: "Add/remove remark", kind: "remarks" },
  { label: "Transfer", kind: "transfer" },
  { label: "Print boarding pass", kind: "print" },
];

interface Props {
  kind: ActionsPanelKind;
  flight: Flight;
  passengers: Passenger[];
  segments: FlightSegment[];
  open: boolean;
  onClose: () => void;
  /** Fires once per passenger actually changed on the backend (e.g. Cancel check-in) so the roster/seat map reflect it immediately. */
  onPassengerUpdated?: (p: Passenger) => void;
  /** Fires after an action changes seat occupancy, so the caller can re-fetch the seat map. */
  onSeatsChanged?: () => void;
}

// Threads the slide transition's open/closed state down to Shell without
// every one of the 7 sub-panels below needing to accept and forward it.
const OpenContext = createContext(true);

/** "1980-12-22" -> "22.12.1980"; blank/invalid input stays blank. */
function fmtDMY(date: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

function fmtTime(iso: string, offsetMin = 0): string {
  const t = new Date(new Date(iso).getTime() + offsetMin * 60000);
  return t.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
}

function paxName(p: Passenger): string {
  return [p.surname, p.given_name, p.middle_name].filter(Boolean).join(" ");
}

/** Slide-out side panel shell (same shape as PassengerDocPanel/UserPanel) shared by every Actions-menu panel below. */
function Shell({ title, onClose, footer, children }: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  const { t } = useLanguage();
  const open = useContext(OpenContext);
  return (
    <div className={`actions-panel-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div className="actions-panel" onClick={(e) => e.stopPropagation()}>
        <div className="actions-panel-header">
          <div className="actions-panel-title">{title}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}>
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="actions-panel-body">{children}</div>
        {footer && <div className="actions-panel-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** "All" + one pill per leg — hidden for single-segment (direct) flights, same as SegmentToggle. */
function SegmentAllTabs({ segments, selected, onSelect }: { segments: FlightSegment[]; selected: number; onSelect: (i: number) => void }) {
  const { t } = useLanguage();
  if (segments.length <= 1) return null;
  return (
    <div className="actions-tab-row">
      <button type="button" className={`actions-tab ${selected === -1 ? "selected" : ""}`} onClick={() => onSelect(-1)}>{t("All")}</button>
      {segments.map((s, i) => (
        <button key={i} type="button" className={`actions-tab ${selected === i ? "selected" : ""}`} onClick={() => onSelect(i)}>
          {s.origin} → {s.destination}
        </button>
      ))}
    </div>
  );
}

/**
 * Everything opened from the PNR roster's Actions dropdown. No backing
 * endpoints exist yet for most of these (bulk move/priority/transfer
 * workflows) — same "illustrative until there's a real data source" scope
 * as e.g. the ET modal's mock coupon table, so those below are still
 * self-contained, locally-stateful forms; Save/Print just toast and close.
 * "cancel" (Cancel check-in) is the exception — it's wired to a real
 * backend action since undoing a check-in is a genuine data-integrity
 * operation, not an illustrative one.
 */
export function ActionsPanel({ kind, flight, passengers, segments, open, onClose, onPassengerUpdated, onSeatsChanged }: Props) {
  return (
    <OpenContext.Provider value={open}>
      {(() => {
        switch (kind) {
          case "cancel":
            return (
              <CancelCheckinPanel
                segments={segments}
                passengers={passengers}
                onClose={onClose}
                onPassengerUpdated={onPassengerUpdated}
                onSeatsChanged={onSeatsChanged}
              />
            );
          case "move":
            return <MoveFlightPanel onClose={onClose} />;
          case "print":
            return <PrintBoardingPassPanel passengers={passengers} segments={segments} onClose={onClose} />;
          case "priority":
            return <PriorityListPanel segments={segments} onClose={onClose} />;
          case "remarks":
            return <RemarksPanel onClose={onClose} />;
          case "quick":
            return <QuickCheckinPanel flight={flight} passengers={passengers} segments={segments} onClose={onClose} />;
          case "transfer":
            return <GroupTransferPanel passengers={passengers} onClose={onClose} />;
        }
      })()}
    </OpenContext.Provider>
  );
}

const CANCEL_OPTIONS = [
  { key: "offload", label: "Offload" },
  { key: "offload_cancel_bags", label: "Offload and cancel bags" },
  { key: "offload_bags_on_board", label: "Offload, bags on board" },
  { key: "make_seats_reserved", label: "Make seats reserved" },
  { key: "priority_list", label: "Still on Priority list" },
];
const CANCEL_REASONS: SelectOption[] = [
  { value: "lated_gate", label: "Lated gate" },
  { value: "security", label: "Security" },
  { value: "customs", label: "Customs/Immigration" },
  { value: "distraction", label: "Distraction behavior" },
  { value: "refused_payment", label: "Refused payment" },
  { value: "passenger_initiative", label: "Passenger initiative" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];
const OTHER_REASON_PLACEHOLDER =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam";

function CancelCheckinPanel({
  segments,
  passengers,
  onClose,
  onPassengerUpdated,
  onSeatsChanged,
}: {
  segments: FlightSegment[];
  passengers: Passenger[];
  onClose: () => void;
  onPassengerUpdated?: (p: Passenger) => void;
  onSeatsChanged?: () => void;
}) {
  const { t } = useLanguage();
  const [segIndex, setSegIndex] = useState(-1);
  const [option, setOption] = useState("offload");
  const [reason, setReason] = useState("lated_gate");
  const [otherReason, setOtherReason] = useState(OTHER_REASON_PLACEHOLDER);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Only checked-in passengers can actually have their check-in cancelled —
  // the backend rejects anyone else (409), so filter up front rather than
  // firing requests that are guaranteed to fail.
  const eligible = passengers.filter((p) => p.checkin_status === "CHECKED_IN");

  async function save() {
    if (eligible.length === 0) {
      showToast(t("No checked-in passengers selected"), "error");
      onClose();
      return;
    }
    setSaving(true);
    let succeeded = 0;
    for (const p of eligible) {
      try {
        const updated = await api.cancelCheckin(p.id, option);
        onPassengerUpdated?.(updated);
        succeeded++;
      } catch {
        // One passenger's failure (e.g. already boarded by the time this ran) shouldn't stop the rest.
      }
    }
    setSaving(false);
    if (succeeded > 0) onSeatsChanged?.();
    const failed = eligible.length - succeeded;
    if (failed === 0) {
      showToast(succeeded === 1 ? t("Check-in cancelled") : t("Check-in cancelled for {n} passengers").replace("{n}", String(succeeded)));
    } else {
      showToast(
        t("Check-in cancelled for {ok}, failed for {failed}").replace("{ok}", String(succeeded)).replace("{failed}", String(failed)),
        succeeded > 0 ? "info" : "error"
      );
    }
    onClose();
  }

  return (
    <Shell
      title={t("Check-in Cancelling")}
      onClose={onClose}
      footer={<button type="button" className="tertiary" onClick={save} disabled={saving}>{t("Save")}</button>}
    >
      <SegmentAllTabs segments={segments} selected={segIndex} onSelect={setSegIndex} />
      <div className="actions-checkbox-list">
        {CANCEL_OPTIONS.map((o) => (
          <label key={o.key} className="actions-checkbox-row">
            <input type="checkbox" checked={option === o.key} onChange={() => setOption(o.key)} />
            {t(o.label)}
          </label>
        ))}
      </div>
      <div>
        <Select label={t("Reason for offload")} value={reason} onChange={setReason} options={CANCEL_REASONS.map((o) => ({ ...o, label: t(o.label) }))} />
        {reason === "other" && (
          <div className="field2 tall" style={{ marginTop: 12 }}>
            <textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder=" " rows={4} />
          </div>
        )}
      </div>
    </Shell>
  );
}

const MOVE_FLIGHT_OPTIONS: SelectOption[] = [
  { value: "XX-1234", label: "XX-1234" },
  { value: "XX-5678", label: "XX-5678" },
  { value: "XX-9012", label: "XX-9012" },
];
const MOVE_SEATS_LEFT: Record<string, number> = { "XX-1234": 76, "XX-5678": 12, "XX-9012": 143 };

function MoveFlightPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [flightNumber, setFlightNumber] = useState("XX-1234");
  const { showToast } = useToast();

  function save() {
    showToast(t("Moved to flight {flight}").replace("{flight}", flightNumber));
    onClose();
  }

  return (
    <Shell title={t("Move to another flight")} onClose={onClose} footer={<button type="button" className="tertiary" onClick={save}>{t("Save")}</button>}>
      <Select label={t("Flight Number")} value={flightNumber} onChange={setFlightNumber} options={MOVE_FLIGHT_OPTIONS} />
      <div className="actions-hint-text">{t("{n} seats left").replace("{n}", String(MOVE_SEATS_LEFT[flightNumber] ?? 0))}</div>
    </Shell>
  );
}

function PrintBoardingPassPanel({ passengers, segments, onClose }: { passengers: Passenger[]; segments: FlightSegment[]; onClose: () => void }) {
  const { t } = useLanguage();
  const legs = segments.length > 0 ? segments : null;
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => {
    const all = new Set<string>();
    (legs ?? [null]).forEach((_, si) => passengers.forEach((p) => all.add(`${si}-${p.id}`)));
    return all;
  });
  const { showToast } = useToast();

  function toggle(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function print() {
    showToast(t("Boarding passes sent to printer"));
    onClose();
  }

  return (
    <Shell title={t("Print boarding pass")} onClose={onClose} footer={<button type="button" className="tertiary" onClick={print}>{t("Print")}</button>}>
      {(legs ?? [null]).map((seg, si) => (
        <div key={si} className="actions-print-segment">
          <div className="actions-print-segment-head">{seg ? `${seg.origin} → ${seg.destination}` : t(flightRouteFallback(passengers))}</div>
          {passengers.map((p) => {
            const key = `${si}-${p.id}`;
            return (
              <label key={key} className="actions-checkbox-row">
                <input type="checkbox" checked={checkedKeys.has(key)} onChange={() => toggle(key)} />
                {paxName(p)}
              </label>
            );
          })}
          {passengers.length === 0 && <div className="actions-hint-text">{t("No passengers selected.")}</div>}
        </div>
      ))}
    </Shell>
  );
}

function flightRouteFallback(passengers: Passenger[]): string {
  return passengers.length > 0 ? "This flight" : "";
}

const PAX_TYPE_OPTIONS: SelectOption[] = [
  { value: "PS", label: "PS" },
  { value: "STD", label: "STD" },
  { value: "VIP", label: "VIP" },
  { value: "STAFF", label: "STAFF" },
];
const PRIORITY_CODE_OPTIONS: SelectOption[] = [
  { value: "p1", label: "P1 — Elite" },
  { value: "p2", label: "P2 — Gold" },
  { value: "p3", label: "P3 — Silver" },
];
const CABIN_OPTIONS: SelectOption[] = [
  { value: "C", label: "Business" },
  { value: "Y", label: "Economy" },
];

function PriorityListPanel({ segments, onClose }: { segments: FlightSegment[]; onClose: () => void }) {
  const { t } = useLanguage();
  const [segIndex, setSegIndex] = useState(-1);
  const [paxType, setPaxType] = useState("PS");
  const [priorityCode, setPriorityCode] = useState("");
  const [ffp, setFfp] = useState("");
  const [cabin, setCabin] = useState("");
  const [dateOfHire, setDateOfHire] = useState("");
  const [comments, setComments] = useState("");
  const { showToast } = useToast();

  function save() {
    showToast(t("Priority list updated"));
    onClose();
  }

  return (
    <Shell title={t("Priority List")} onClose={onClose} footer={<button type="button" className="tertiary" onClick={save}>{t("Save")}</button>}>
      <SegmentAllTabs segments={segments} selected={segIndex} onSelect={setSegIndex} />
      <Select label={t("Passenger Type")} value={paxType} onChange={setPaxType} options={PAX_TYPE_OPTIONS} />
      <Select label={t("Priority code")} value={priorityCode} onChange={setPriorityCode} options={PRIORITY_CODE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} />
      <Field label="FFP"><input value={ffp} onChange={(e) => setFfp(e.target.value)} placeholder=" " /></Field>
      <Select label={t("Cabin class")} value={cabin} onChange={setCabin} options={CABIN_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} />
      <DateField label={t("Date of hire")} value={dateOfHire} onChange={setDateOfHire} />
      <button type="button" className="tertiary actions-priority-link">{t("Priority List")}</button>
      <div className="field2 tall">
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder=" " rows={3} />
        <label>{t("Comments")}</label>
      </div>
    </Shell>
  );
}

interface RemarkEntry {
  code: string;
  text: string;
}
interface RemarkSectionDef {
  key: string;
  title: string;
  entries: RemarkEntry[];
}
// No structured per-category remarks data source yet (SSR codes are flat, not
// grouped) — illustrative content until one exists, same scope as MOCK_COUPONS.
const REMARK_CATALOG: RemarkEntry[] = [
  { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
];
const REMARK_SECTION_DEFS: RemarkSectionDef[] = [
  { key: "bags", title: "Bags/Carry on", entries: [
    { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
    { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  ] },
  { key: "medical", title: "Medical", entries: [{ code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" }] },
  { key: "government", title: "Government", entries: [{ code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" }] },
  { key: "contacts", title: "Contacts", entries: [{ code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" }] },
  { key: "meals", title: "Special Meals", entries: [] },
  { key: "other", title: "Other remarks", entries: [
    { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
    { code: "ABCD", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed" },
  ] },
];

/** Rich code picker for the remark-add form — each option shows the code plus its full description, unlike the plain generic Select. */
function RemarkCodeField({ value, onSelect }: { value: RemarkEntry | null; onSelect: (e: RemarkEntry) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rect = usePopoverPosition(rootRef, open);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${value ? "has-value" : ""}`}>
      <button type="button" className="select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value?.code ?? ""}
      </button>
      <label>{value ? t("Code") : t("Remark")}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open &&
        rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu actions-remark-code-menu" style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}>
            {REMARK_CATALOG.map((c, i) => (
              <li key={i} onClick={() => { onSelect(c); setOpen(false); }}>
                <div className="actions-remark-code-option-code">{c.code}</div>
                <div className="actions-remark-code-option-text">{c.text}</div>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

function RemarksSection({ title, initialEntries }: { title: string; initialEntries: RemarkEntry[] }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState(initialEntries);
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState<RemarkEntry | null>(null);
  const [description, setDescription] = useState("");

  function pickCode(c: RemarkEntry) {
    setCode(c);
    setDescription(c.text);
  }

  function save() {
    if (!code) return;
    setEntries((prev) => [{ code: code.code, text: description }, ...prev]);
    setFormOpen(false);
    setCode(null);
    setDescription("");
  }

  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="actions-remark-section">
      <div className="actions-remark-section-head">
        <span>{title}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={formOpen ? t("Close {title}").replace("{title}", title) : t("Add {title} remark").replace("{title}", title)}
          onClick={() => {
            setFormOpen((o) => !o);
            setCode(null);
            setDescription("");
          }}
        >
          {formOpen ? <MinusIcon size={16} /> : <PlusIcon size={16} />}
        </button>
      </div>

      {formOpen && (
        <div className="actions-remark-form">
          <RemarkCodeField value={code} onSelect={pickCode} />
          <div className="field2 tall">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder=" " rows={2} />
            <label>{t("Description")}</label>
          </div>
          <button type="button" className="tertiary actions-remark-save" disabled={!code} onClick={save}>{t("Save")}</button>
        </div>
      )}

      {entries.map((e, i) => (
        <div key={i} className="actions-remark-entry">
          <div className="actions-remark-entry-body">
            <div className="actions-remark-code">{e.code}</div>
            <div className="actions-remark-text">{e.text}</div>
          </div>
          <button type="button" className="icon-button actions-remark-delete" aria-label={t("Delete remark")} onClick={() => remove(i)}>
            <TrashIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function RemarksPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  function save() {
    showToast(t("Remarks saved"));
    onClose();
  }

  return (
    <Shell title={t("Remarks")} onClose={onClose} footer={<button type="button" className="tertiary" onClick={save}>{t("Save")}</button>}>
      {REMARK_SECTION_DEFS.map((section) => (
        <RemarksSection key={section.key} title={t(section.title)} initialEntries={section.entries} />
      ))}
    </Shell>
  );
}

function QuickCheckinPanel({ flight, passengers, segments, onClose }: { flight: Flight; passengers: Passenger[]; segments: FlightSegment[]; onClose: () => void }) {
  const { t } = useLanguage();
  const legs = segments.length > 0 ? segments : [];
  const allKeys = legs.flatMap((_, si) => passengers.map((p) => `${si}-${p.id}`));
  const [printFlags, setPrintFlags] = useState<Set<string>>(() => new Set(allKeys));
  const [expanded, setExpanded] = useState(0);
  const [remote, setRemote] = useState(false);
  const { showToast } = useToast();

  const printAllChecked = allKeys.length > 0 && allKeys.every((k) => printFlags.has(k));

  function toggle(key: string) {
    setPrintFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePrintAll(v: boolean) {
    setPrintFlags(v ? new Set(allKeys) : new Set());
  }

  function printPasses() {
    showToast(t("Boarding passes printed"));
    onClose();
  }

  const overallOrigin = legs[0]?.origin ?? flight.origin;
  const overallDestination = legs[legs.length - 1]?.destination ?? flight.destination;

  return (
    <Shell
      title={t("Quick check-in")}
      onClose={onClose}
      footer={
        <div className="actions-quick-footer">
          <label>
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
            {t("Remote")}
          </label>
          <button type="button" className="tertiary" onClick={printPasses}>{t("Print boarding passes")}</button>
        </div>
      }
    >
      <div className="actions-quick-flight-row">
        <span className="actions-quick-checked-in">{t("Checked-in")}</span>
        <label className="actions-quick-print-all">
          <input type="checkbox" checked={printAllChecked} onChange={(e) => togglePrintAll(e.target.checked)} />
          {t("Print all boarding pass")}
        </label>
      </div>
      <div className="actions-quick-flight-row">
        <span>{flight.carrier_code}{flight.flight_number}</span>
        <span className="actions-muted-text">{t("Boarding time {time}").replace("{time}", fmtTime(flight.std, -45))}</span>
      </div>
      <div className="actions-quick-flight-row">
        <span className="actions-muted-text">{overallOrigin} → {overallDestination} {fmtTime(flight.std)}</span>
        <span className="actions-muted-text">{t("Gate {gate}").replace("{gate}", flight.gate ?? "—")}</span>
      </div>

      {legs.map((seg, si) => {
        const isOpen = expanded === si;
        return (
          <div key={si} className="actions-quick-segment">
            <button type="button" className="actions-quick-segment-head" onClick={() => setExpanded(isOpen ? -1 : si)}>
              {seg.origin} → {seg.destination}
              <ChevronDownIcon size={16} className={isOpen ? "chevron-rotated" : ""} />
            </button>
            {isOpen &&
              passengers.map((p) => {
                const key = `${si}-${p.id}`;
                return (
                  <div key={p.id} className="actions-quick-pax-card">
                    <div className="actions-quick-pax-top">
                      <span>{paxName(p)}</span>
                      <span className="actions-quick-pax-seat">{p.seat ? formatSeatDisplay(p.seat) : "—"}</span>
                    </div>
                    <label className="actions-quick-pax-print">
                      <input type="checkbox" checked={printFlags.has(key)} onChange={() => toggle(key)} />
                      {t("Print boarding pass")}
                    </label>
                  </div>
                );
              })}
            {isOpen && passengers.length === 0 && <div className="actions-quick-pax-card actions-muted-text">{t("No passengers selected.")}</div>}
          </div>
        );
      })}
    </Shell>
  );
}

interface TransferEntry {
  id: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  std: string;
  etd: string;
  sta: string;
}
interface CandidateGroup {
  passenger: Passenger;
  candidates: { label: string; dob: string }[];
  selected: number;
}

function shiftYears(dob: string | null, years: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? "");
  if (!m) return null;
  return `${+m[1] + years}-${m[2]}-${m[3]}`;
}

function GroupTransferPanel({ passengers, onClose }: { passengers: Passenger[]; onClose: () => void }) {
  const { t } = useLanguage();
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [activeRow, setActiveRow] = useState<{ flight: string; date: string } | null>({ flight: "", date: "" });
  const [phase, setPhase] = useState<"idle" | "loading" | "results">("idle");
  const [candidateGroups, setCandidateGroups] = useState<CandidateGroup[]>([]);
  const { showToast } = useToast();

  function runSearch() {
    if (!activeRow || !activeRow.flight.trim()) return;
    setPhase("loading");
    setTimeout(() => {
      const groups: CandidateGroup[] = passengers.slice(0, 3).map((p) => ({
        passenger: p,
        candidates: [
          { label: paxName(p), dob: fmtDMY(p.dob) },
          { label: paxName(p), dob: fmtDMY(shiftYears(p.dob, -20)) },
        ],
        selected: 0,
      }));
      setCandidateGroups(groups);
      setPhase("results");
    }, 700);
  }

  function selectCandidate(pid: number, index: number) {
    setCandidateGroups((prev) => prev.map((g) => (g.passenger.id === pid ? { ...g, selected: index } : g)));
  }

  function confirmResults() {
    if (!activeRow) return;
    const entry: TransferEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      flightNumber: `${activeRow.flight}C`,
      date: activeRow.date,
      origin: "DME",
      destination: "FER",
      std: "12:00",
      etd: "13:00",
      sta: "14:00",
    };
    setTransfers((prev) => [...prev, entry]);
    setActiveRow(null);
    setPhase("idle");
    setCandidateGroups([]);
  }

  function removeTransfer(id: string) {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }

  function addTransferRow() {
    setActiveRow({ flight: "", date: "" });
    setPhase("idle");
    setCandidateGroups([]);
  }

  function save() {
    showToast(t("Group transfer saved"));
    onClose();
  }

  return (
    <Shell
      title={t("Group Transfer")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" disabled={!!activeRow} onClick={addTransferRow}>{t("Add Transfer")}</button>
          <button type="button" className="tertiary" disabled={transfers.length === 0} onClick={save}>{t("Save")}</button>
        </>
      }
    >
      {transfers.map((tr) => (
        <div key={tr.id} className="actions-transfer-card">
          <div className="actions-transfer-card-col">
            <div>{tr.flightNumber}</div>
            <div className="actions-muted-text">{fmtDMY(tr.date)}</div>
          </div>
          <div className="actions-transfer-card-col">
            <div>{tr.origin}</div>
            <div className="actions-muted-text">{tr.destination}</div>
          </div>
          <div className="actions-transfer-card-col actions-transfer-card-times">
            <div>{tr.std} <span className="actions-transfer-etd">{t("ETD {time}").replace("{time}", tr.etd)}</span></div>
            <div className="actions-muted-text">{tr.sta}</div>
          </div>
          <button type="button" className="icon-button" aria-label={t("Remove transfer")} onClick={() => removeTransfer(tr.id)}>
            <TrashIcon size={16} />
          </button>
        </div>
      ))}

      {activeRow && (
        <div className="actions-transfer-search">
          <div className="actions-transfer-search-row">
            <Field label={t("Flight")} style={{ flex: 1 }}>
              <input
                value={activeRow.flight}
                onChange={(e) => setActiveRow({ ...activeRow, flight: e.target.value.toUpperCase() })}
                placeholder=" "
              />
            </Field>
            <DateField label={t("Date")} value={activeRow.date} onChange={(v) => setActiveRow({ ...activeRow, date: v })} style={{ flex: 1 }} />
            <button
              type="button"
              className="actions-transfer-search-btn"
              disabled={phase === "loading" || !activeRow.flight.trim()}
              onClick={runSearch}
              aria-label={t("Search")}
            >
              {phase === "loading" ? <RefreshIcon size={18} className="spin" /> : <SearchIcon size={18} />}
            </button>
          </div>

          {phase === "results" && (
            <div className="actions-transfer-results">
              <div className="actions-transfer-card">
                <div className="actions-transfer-card-col">
                  <div>{activeRow.flight}C</div>
                  <div className="actions-muted-text">{fmtDMY(activeRow.date)}</div>
                </div>
                <div className="actions-transfer-card-col">
                  <div>DME</div>
                  <div className="actions-muted-text">FER</div>
                </div>
                <div className="actions-transfer-card-col actions-transfer-card-times">
                  <div>12:00 <span className="actions-transfer-etd">{t("ETD {time}").replace("{time}", "13:00")}</span></div>
                  <div className="actions-muted-text">14:00</div>
                </div>
              </div>
              <div className="actions-transfer-match-hint">{t("Matches found. Please select the correct passengers:")}</div>
              {candidateGroups.map((g) => (
                <div key={g.passenger.id} className="actions-transfer-match-group">
                  {g.candidates.map((c, i) => (
                    <label key={i} className="actions-transfer-match-row">
                      <input
                        type="radio"
                        name={`match-${g.passenger.id}`}
                        checked={g.selected === i}
                        onChange={() => selectCandidate(g.passenger.id, i)}
                      />
                      <span>
                        <div>{c.label}</div>
                        <div className="actions-transfer-dob">{c.dob}</div>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              {candidateGroups.length === 0 && <div className="actions-hint-text">{t("No passengers selected to match.")}</div>}
              <div className="actions-transfer-ok">
                <button type="button" className="tertiary" onClick={confirmResults}>{t("OK")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
