import { useState } from "react";
import { api, Passenger, SeatCell } from "../../api";
import { PassengerExtra, asvcForPassenger, parsePassengerExtra } from "../../paxExtra";
import { parseSeatExtra } from "../../seatExtra";
import { useToast } from "../../toast";
import { CloseIcon } from "../Icon";
import { Modal } from "../Modal";
import { Field } from "../Field";
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

export type ModalKind = "summary" | "documents" | "remarks" | "baggage" | "flags";

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

function draftTrConflict(d: PaxDraft): boolean {
  if (!d.inboundTime || !d.outboundTime) return false;
  const inTime = new Date(d.inboundTime).getTime();
  const outTime = new Date(d.outboundTime).getTime();
  return !Number.isNaN(inTime) && !Number.isNaN(outTime) && outTime <= inTime;
}

/**
 * One tabbed modal for everything about a passenger: Summary/Documents/
 * Remarks/Baggage are plain fields saved together by the modal's own Save
 * button; Flags groups the five flag-chip sections from the passengers
 * table (TR/FFP are editable the same way, COM persists each comment
 * immediately like it always has, AUX/ET stay illustrative/view-only —
 * see asvcForPassenger and MOCK_COUPONS, neither has a backing table).
 */
export function PassengerDetailModal({ kind, flightId, passenger, seats, onSeatUpdated, onClose, onUpdated }: Props) {
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
      showToast("Changes saved");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const tabs: PaxTab[] = [
    {
      key: "summary",
      label: "Summary",
      content: (
        <SummaryFields
          draft={draft}
          onChange={setDraft}
          seat={{ code: passenger.seat, preseated: seatFlags.preseated, reserved: seatFlags.reserved, onChange: setSeatFlags }}
        />
      ),
    },
    { key: "documents", label: "Documents", content: <DocumentsFields draft={draft} onChange={setDraft} /> },
    { key: "remarks", label: "Remarks", content: <RemarksFields draft={draft} onChange={setDraft} /> },
    { key: "baggage", label: "Baggage", content: <BaggageFields draft={draft} onChange={setDraft} /> },
    {
      key: "flags",
      label: "Flags",
      content: <FlagsTab draft={draft} onChange={setDraft} flightId={flightId} passenger={passenger} onUpdated={onUpdated} />,
    },
  ];

  return (
    <Modal
      title={paxName(passenger)}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Close</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>Save</button>
        </>
      }
    >
      <PaxTabbedFields tabs={tabs} initialTab={kind} />
    </Modal>
  );
}

function FlagsTab({
  draft,
  onChange,
  flightId,
  passenger,
  onUpdated,
}: {
  draft: PaxDraft;
  onChange: (d: PaxDraft) => void;
  flightId: number;
  passenger: Passenger;
  onUpdated: (p: Passenger) => void;
}) {
  const conflict = draftTrConflict(draft);
  const legs = asvcForPassenger(passenger);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}>
      <div className="document-card">
        <div className="modal-section-label">TR — Connections</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Inbound flight" style={{ flex: 1 }}>
            <input value={draft.inbound} onChange={(e) => onChange({ ...draft, inbound: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <Field label="Inbound arrival" style={{ flex: 1 }}>
            <input type="datetime-local" value={draft.inboundTime} onChange={(e) => onChange({ ...draft, inboundTime: e.target.value })} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <Field label="Outbound flight" style={{ flex: 1 }}>
            <input value={draft.outbound} onChange={(e) => onChange({ ...draft, outbound: e.target.value.toUpperCase() })} placeholder=" " />
          </Field>
          <Field label="Outbound departure" style={{ flex: 1 }}>
            <input type="datetime-local" value={draft.outboundTime} onChange={(e) => onChange({ ...draft, outboundTime: e.target.value })} />
          </Field>
        </div>
        {conflict && (
          <div className="error-box" style={{ marginTop: 12 }}>
            The outbound connection departs before (or at) the inbound arrival — too tight to make.
          </div>
        )}
      </div>

      <div className="document-card">
        <div className="modal-section-label">AUX — Ancillary services</div>
        <div className="asvc-columns">
          {legs.map(({ leg, services }) => (
            <div key={leg} className="asvc-column">
              <h3>{leg}</h3>
              {services.map((s, i) => (
                <div key={i} className="asvc-row">
                  <span className="asvc-name">{s.name}</span>
                  <span className={`asvc-status ${s.paid ? "paid" : "unpaid"}`}>{s.paid ? "Оплачено" : "Не оплачено"}</span>
                </div>
              ))}
              {services.length === 0 && <div className="asvc-row muted">No ancillary services purchased.</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="document-card">
        <div className="modal-section-label">COM — Comments</div>
        <CommentsSection flightId={flightId} passenger={passenger} onUpdated={onUpdated} />
      </div>

      <div className="document-card">
        <div className="modal-section-label">FFP — Frequent flyer</div>
        <div className="ffp-fields" style={{ paddingTop: 8, marginBottom: 0 }}>
          <div className="field2" style={{ width: 100 }}>
            <input value={draft.ffpAirline} onChange={(e) => onChange({ ...draft, ffpAirline: e.target.value.toUpperCase() })} maxLength={2} placeholder=" " />
            <label>Airline</label>
          </div>
          <div className="field2" style={{ width: 160 }}>
            <input value={draft.ffpCard} onChange={(e) => onChange({ ...draft, ffpCard: e.target.value })} placeholder=" " />
            <label>Card Number</label>
          </div>
        </div>
      </div>

      <div className="document-card">
        <div className="modal-section-label">ET — E-ticket coupons</div>
        <table className="modal-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Coupon</th><th>Airline</th><th>Flight</th><th>Date</th><th>Loc Time</th>
              <th>From</th><th>To</th><th>Class</th><th>Fare Basis</th><th>Allowance</th>
              <th>Segment Status</th><th>Coupon Status</th>
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
      </div>
    </div>
  );
}

const COMMENT_TABS = ["CHECK-IN", "BOARDING"] as const;
type CommentTab = (typeof COMMENT_TABS)[number];
const TAB_KEY: Record<CommentTab, "checkin" | "boarding"> = { "CHECK-IN": "checkin", BOARDING: "boarding" };

function CommentsSection({
  flightId,
  passenger,
  onUpdated,
}: {
  flightId: number;
  passenger: Passenger;
  onUpdated: (p: Passenger) => void;
}) {
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
        {COMMENT_TABS.map((t) => (
          <button key={t} type="button" className={`modal-tab ${tab === t ? "selected" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="comment-list">
        {comments[key].map((c, i) => (
          <div key={i} className="comment-card">
            <span>{c}</span>
            <button type="button" className="comment-delete" aria-label="Delete comment" onClick={() => remove(i)}>
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
        {comments[key].length === 0 && <div className="comment-card muted">No comments yet.</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
        <div className="field2 tall" style={{ flex: 1, marginBottom: 0 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder=" " rows={2} />
          <label>New comment</label>
        </div>
        <button type="button" className="tertiary" disabled={busy} onClick={add}>Add</button>
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
