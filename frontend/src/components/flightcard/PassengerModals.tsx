import { useState } from "react";
import { api, Passenger, SeatCell } from "../../api";
import { PassengerExtra, asvcForPassenger, parsePassengerExtra } from "../../paxExtra";
import { parseSeatExtra } from "../../seatExtra";
import { useToast } from "../../toast";
import { CloseIcon } from "../Icon";
import { Modal } from "../Modal";
import { Field } from "../Field";
import { DateTimePicker } from "../DateTimePicker";
import { useLanguage } from "../../i18n";
import {
  BaggageFields,
  DocumentsFields,
  PaxDraft,
  PaxTab,
  PaxTabbedFields,
  RemarksFields,
  SummaryFields,
  paxDraftFrom,
  paxDraftToPayload,
} from "./PassengerForm";

export type ModalKind = "summary" | "documents" | "remarks" | "baggage";
export type FlagKind = "tr" | "aux" | "com" | "ffp" | "et";

interface Props {
  kind: ModalKind;
  flightId: number;
  passenger: Passenger;
  seats: SeatCell[];
  onSeatUpdated: (s: SeatCell) => void;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}

function paxName(p: Passenger) {
  return `${p.surname} ${p.given_name}`;
}

/** Persists a partial patch into the passenger's extra JSON blob, preserving whatever other fields already live there. */
async function saveExtra(flightId: number, passenger: Passenger, patch: Partial<PassengerExtra>): Promise<Passenger> {
  const extra: PassengerExtra = { ...parsePassengerExtra(passenger), ...patch };
  return api.updatePassenger(flightId, passenger.id, { extra: JSON.stringify(extra) });
}

function trConflict(inboundTime: string, outboundTime: string): boolean {
  if (!inboundTime || !outboundTime) return false;
  const inTime = new Date(inboundTime).getTime();
  const outTime = new Date(outboundTime).getTime();
  return !Number.isNaN(inTime) && !Number.isNaN(outTime) && outTime <= inTime;
}

/**
 * One tabbed modal for everything about a passenger: Summary/Documents/
 * Remarks/Baggage, saved together by the modal's own Save button. Each of
 * the five Flags-column chips (TR/AUX/COM/FFP/ET) opens its own small
 * modal instead — see FlagModal below.
 */
export function PassengerDetailModal({ kind, flightId, passenger, seats, onSeatUpdated, onClose, onUpdated }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<PaxDraft>(() => paxDraftFrom(passenger));
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const seatCell = passenger.seat ? seats.find((s) => s.seat === passenger.seat) ?? null : null;
  const [seatFlags, setSeatFlags] = useState(() => {
    const extra = seatCell ? parseSeatExtra(seatCell) : {};
    return { preseated: !!extra.preseated, reserved: !!extra.reserved };
  });

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, paxDraftToPayload(draft, passenger));
      if (passenger.seat) {
        const currentExtra = seatCell ? parseSeatExtra(seatCell) : {};
        if (!!currentExtra.preseated !== seatFlags.preseated || !!currentExtra.reserved !== seatFlags.reserved) {
          const updatedSeat = await api.updateSeat(flightId, passenger.seat, {
            extra: JSON.stringify({ ...currentExtra, preseated: seatFlags.preseated, reserved: seatFlags.reserved }),
          });
          onSeatUpdated(updatedSeat);
        }
      }
      onUpdated(updated);
      showToast(t("Changes saved"));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const tabs: PaxTab[] = [
    {
      key: "summary",
      label: t("Summary"),
      content: (
        <SummaryFields
          draft={draft}
          onChange={setDraft}
          seat={{ code: passenger.seat, preseated: seatFlags.preseated, reserved: seatFlags.reserved, onChange: setSeatFlags }}
        />
      ),
    },
    { key: "documents", label: t("Documents"), content: <DocumentsFields draft={draft} onChange={setDraft} /> },
    { key: "remarks", label: t("Remarks"), content: <RemarksFields draft={draft} onChange={setDraft} /> },
    { key: "baggage", label: t("Baggage"), content: <BaggageFields draft={draft} onChange={setDraft} /> },
  ];

  return (
    <Modal
      title={paxName(passenger)}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>{t("Save")}</button>
        </>
      }
    >
      <PaxTabbedFields tabs={tabs} initialTab={kind} />
    </Modal>
  );
}

interface FlagModalProps {
  kind: FlagKind;
  flightId: number;
  passenger: Passenger;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}

/** Each Flags-column chip (TR/AUX/COM/FFP/ET) opens its own small, single-purpose modal. */
export function FlagModal({ kind, flightId, passenger, onClose, onUpdated }: FlagModalProps) {
  switch (kind) {
    case "tr":
      return <TrModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
    case "aux":
      return <AuxModal passenger={passenger} onClose={onClose} />;
    case "com":
      return <ComModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
    case "ffp":
      return <FfpModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
    case "et":
      return <EtModal passenger={passenger} onClose={onClose} />;
  }
}

function TrModal({
  flightId,
  passenger,
  onClose,
  onUpdated,
}: {
  flightId: number;
  passenger: Passenger;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}) {
  const { t } = useLanguage();
  const extra = parsePassengerExtra(passenger);
  const [inbound, setInbound] = useState(extra.inbound ?? "");
  const [inboundTime, setInboundTime] = useState(extra.inboundTime ?? "");
  const [outbound, setOutbound] = useState(extra.outbound ?? "");
  const [outboundTime, setOutboundTime] = useState(extra.outboundTime ?? "");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const conflict = trConflict(inboundTime, outboundTime);

  async function save() {
    setSaving(true);
    try {
      const updated = await saveExtra(flightId, passenger, { inbound, inboundTime, outbound, outboundTime });
      onUpdated(updated);
      showToast(t("Changes saved"));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${paxName(passenger)} — TR`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>{t("Save")}</button>
        </>
      }
    >
      <div className="modal-section-label">{t("Connections")}</div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label={t("Inbound flight")} style={{ flex: 1 }}>
          <input value={inbound} onChange={(e) => setInbound(e.target.value.toUpperCase())} placeholder=" " />
        </Field>
        <DateTimePicker label={t("Inbound arrival")} value={inboundTime} onChange={setInboundTime} style={{ flex: 1 }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Field label={t("Outbound flight")} style={{ flex: 1 }}>
          <input value={outbound} onChange={(e) => setOutbound(e.target.value.toUpperCase())} placeholder=" " />
        </Field>
        <DateTimePicker label={t("Outbound departure")} value={outboundTime} onChange={setOutboundTime} style={{ flex: 1 }} />
      </div>
      {conflict && (
        <div className="error-box" style={{ marginTop: 12 }}>
          {t("The outbound connection departs before (or at) the inbound arrival — too tight to make.")}
        </div>
      )}
    </Modal>
  );
}

function AuxModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  const { t } = useLanguage();
  const legs = asvcForPassenger(passenger);
  return (
    <Modal
      title={`${paxName(passenger)} — AUX`}
      onClose={onClose}
      width={620}
      footer={<button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>}
    >
      <div className="modal-section-label">{t("Ancillary services")}</div>
      <div className="asvc-columns">
        {legs.map(({ leg, services }) => (
          <div key={leg} className="asvc-column">
            <h3>{leg}</h3>
            {services.map((s, i) => (
              <div key={i} className="asvc-row">
                <span className="asvc-name">{s.name}</span>
                <span className={`asvc-status ${s.paid ? "paid" : "unpaid"}`}>{s.paid ? t("Paid") : t("Not paid")}</span>
              </div>
            ))}
            {services.length === 0 && <div className="asvc-row muted">{t("No ancillary services purchased.")}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ComModal({
  flightId,
  passenger,
  onClose,
  onUpdated,
}: {
  flightId: number;
  passenger: Passenger;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal
      title={`${paxName(passenger)} — COM`}
      onClose={onClose}
      footer={<button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>}
    >
      <div className="modal-section-label">{t("Comments")}</div>
      <CommentsSection flightId={flightId} passenger={passenger} onUpdated={onUpdated} />
    </Modal>
  );
}

function FfpModal({
  flightId,
  passenger,
  onClose,
  onUpdated,
}: {
  flightId: number;
  passenger: Passenger;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}) {
  const { t } = useLanguage();
  const extra = parsePassengerExtra(passenger);
  const [airline, setAirline] = useState(extra.ffp?.airline ?? "");
  const [card, setCard] = useState(extra.ffp?.card ?? "");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function save() {
    setSaving(true);
    try {
      const updated = await saveExtra(flightId, passenger, { ffp: { airline, card } });
      onUpdated(updated);
      showToast(t("Changes saved"));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${paxName(passenger)} — FFP`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>{t("Save")}</button>
        </>
      }
    >
      <div className="modal-section-label">{t("Frequent flyer")}</div>
      <div className="ffp-fields" style={{ paddingTop: 8, marginBottom: 0 }}>
        <div className="field2" style={{ width: 100 }}>
          <input value={airline} onChange={(e) => setAirline(e.target.value.toUpperCase())} maxLength={2} placeholder=" " />
          <label>{t("Airline")}</label>
        </div>
        <div className="field2" style={{ width: 160 }}>
          <input value={card} onChange={(e) => setCard(e.target.value)} placeholder=" " />
          <label>{t("Card Number")}</label>
        </div>
      </div>
    </Modal>
  );
}

function EtModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Modal
      title={`${paxName(passenger)} — ET`}
      onClose={onClose}
      width={860}
      footer={<button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>}
    >
      <div className="modal-section-label">{t("E-ticket coupons")}</div>
      <table className="modal-table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>{t("Coupon")}</th><th>{t("Airline")}</th><th>{t("Flight")}</th><th>{t("Date")}</th><th>{t("Loc Time")}</th>
            <th>{t("From")}</th><th>{t("To")}</th><th>{t("Class")}</th><th>{t("Fare Basis")}</th><th>{t("Allowance")}</th>
            <th>{t("Segment Status")}</th><th>{t("Coupon Status")}</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_COUPONS.map((c) => (
            <tr key={c.coupon}>
              <td className="mono">{c.coupon}</td>
              <td className="mono">{c.airline}</td>
              <td className="mono">{c.flight}</td>
              <td className="mono">{c.date}</td>
              <td className="mono">{c.locTime}</td>
              <td className="mono">{c.from}</td>
              <td className="mono">{c.to}</td>
              <td>{c.cls}</td>
              <td className="mono">{c.fareBasis}</td>
              <td className="mono">{c.allowance}</td>
              <td className="mono">{c.segStatus}</td>
              <td>
                <span className={`coupon-status ${c.couponStatus === "O" ? "open" : ""}`}>{c.couponStatus}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

const COMMENT_TABS = ["CHECK-IN", "BOARDING"] as const;
type CommentTab = (typeof COMMENT_TABS)[number];
const TAB_KEY: Record<CommentTab, "checkin" | "boarding"> = { "CHECK-IN": "checkin", BOARDING: "boarding" };
// Distinct source strings from the flight-status "BOARDING"/"Check-in" (which mean something
// different — "boarding is in progress" — see flightStatuses.ts) so the two never collide in ru.ts.
const COMMENT_TAB_LABEL: Record<CommentTab, string> = { "CHECK-IN": "Check-in comments", BOARDING: "Boarding comments" };

function CommentsSection({
  flightId,
  passenger,
  onUpdated,
}: {
  flightId: number;
  passenger: Passenger;
  onUpdated: (p: Passenger) => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<CommentTab>("CHECK-IN");
  const initial = parsePassengerExtra(passenger).comments ?? { checkin: [], boarding: [] };
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: typeof comments) {
    setBusy(true);
    try {
      const updated = await saveExtra(flightId, passenger, { comments: next });
      onUpdated(updated);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const key = TAB_KEY[tab];
    if (!draft.trim()) return;
    const next = { ...comments, [key]: [...comments[key], draft.trim()] };
    setComments(next);
    setDraft("");
    persist(next);
  }

  function remove(index: number) {
    const key = TAB_KEY[tab];
    const next = { ...comments, [key]: comments[key].filter((_, i) => i !== index) };
    setComments(next);
    persist(next);
  }

  const key = TAB_KEY[tab];
  return (
    <div>
      <div className="modal-tabs" style={{ marginTop: 8, marginBottom: 8 }}>
        {COMMENT_TABS.map((tabName) => (
          <button key={tabName} type="button" className={`modal-tab ${tab === tabName ? "selected" : ""}`} onClick={() => setTab(tabName)}>
            {t(COMMENT_TAB_LABEL[tabName])}
          </button>
        ))}
      </div>
      <div className="comment-list">
        {comments[key].map((c, i) => (
          <div key={i} className="comment-card">
            <span>{c}</span>
            <button type="button" className="comment-delete" aria-label={t("Delete comment")} onClick={() => remove(i)}>
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
        {comments[key].length === 0 && <div className="comment-card muted">{t("No comments yet.")}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
        <div className="field2 tall" style={{ flex: 1, marginBottom: 0 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder=" " rows={2} />
          <label>{t("New comment")}</label>
        </div>
        <button type="button" className="tertiary" disabled={busy} onClick={add}>{t("Add")}</button>
      </div>
    </div>
  );
}

// E-ticket coupon data (fare basis/allowance/segment status) has no backing
// table yet and no natural real-data source elsewhere in the app (unlike
// TR/FFP/COM) — same scope as the flight card's Counters/Transfers tabs,
// shown as illustrative sample content until there's a real source for it.
const MOCK_COUPONS = [
  { coupon: 1, airline: "", flight: "123", date: "12APR25", locTime: "12:10", from: "DME", to: "LED", cls: "Y", fareBasis: "LTOW", allowance: "2/23", segStatus: "HK", couponStatus: "O" },
  { coupon: 2, airline: "XY", flight: "321", date: "12APR25", locTime: "14:30", from: "LED", to: "SVX", cls: "C", fareBasis: "STRO", allowance: "23 kg", segStatus: "HN", couponStatus: "O" },
];
