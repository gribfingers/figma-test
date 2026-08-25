import { useState } from "react";
import { api, Passenger } from "../../api";
import { PassengerExtra, asvcForPassenger, parsePassengerExtra, trStatus } from "../../paxExtra";
import { CloseIcon } from "../Icon";
import { Modal } from "../Modal";
import { PassengerFormFields, paxDraftFrom, paxDraftToPayload } from "./PassengerForm";

interface Props {
  kind: "asvc" | "comments" | "coupon" | "ffp" | "route" | "edit";
  flightId: number;
  passenger: Passenger;
  onClose: () => void;
  onUpdated: (p: Passenger) => void;
}

export function PassengerModals({ kind, flightId, passenger, onClose, onUpdated }: Props) {
  if (kind === "asvc") return <AsvcModal passenger={passenger} onClose={onClose} />;
  if (kind === "comments") return <CommentsModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
  if (kind === "coupon") return <CouponModal passenger={passenger} onClose={onClose} />;
  if (kind === "ffp") return <FfpModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
  if (kind === "edit") return <EditModal flightId={flightId} passenger={passenger} onClose={onClose} onUpdated={onUpdated} />;
  return <RouteModal passenger={passenger} onClose={onClose} />;
}

function EditModal({
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
  const [draft, setDraft] = useState(() => paxDraftFrom(passenger));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updatePassenger(flightId, passenger.id, paxDraftToPayload(draft, passenger));
      onUpdated(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Edit pax: ${paxName(passenger)}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Close</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>Save</button>
        </>
      }
    >
      <PassengerFormFields draft={draft} onChange={setDraft} />
    </Modal>
  );
}

/** Persists a partial patch into the passenger's extra JSON blob, preserving whatever other fields already live there. */
async function saveExtra(flightId: number, passenger: Passenger, patch: Partial<PassengerExtra>): Promise<Passenger> {
  const extra: PassengerExtra = { ...parsePassengerExtra(passenger), ...patch };
  return api.updatePassenger(flightId, passenger.id, { extra: JSON.stringify(extra) });
}

function paxName(p: Passenger) {
  return `${p.surname} ${p.given_name}`;
}

// E-ticket coupons and route/delay data below have no backing tables yet —
// same scope as the flight card's Counters/Transfers tabs, shown as
// illustrative sample content matching the reference design until there's
// a real source for it. Ancillary purchases (ASVC) are generated per
// passenger by asvcForPassenger, so the AUX chip color always matches what
// this modal shows.
function AsvcModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  const legs = asvcForPassenger(passenger);
  return (
    <Modal title={paxName(passenger)} onClose={onClose} width={950} footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}>
      <div className="asvc-columns">
        {legs.map(({ leg, services }) => (
          <div key={leg} className="asvc-column">
            <h3>{leg}</h3>
            {services.map((s, i) => (
              <div key={i} className="asvc-row">
                <span className="mono asvc-code">0B5</span>
                <span className="asvc-name">{s.name}</span>
                <span className={`asvc-status ${s.paid ? "paid" : "unpaid"}`}>{s.paid ? "Оплачено" : "Не оплачено"}</span>
              </div>
            ))}
            {services.length === 0 && <div className="asvc-row muted">No ancillary services purchased.</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

const COMMENT_TABS = ["CHECK-IN", "BOARDING"] as const;
type CommentTab = (typeof COMMENT_TABS)[number];
const TAB_KEY: Record<CommentTab, "checkin" | "boarding"> = { "CHECK-IN": "checkin", BOARDING: "boarding" };

function CommentsModal({
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

  function save() {
    const key = TAB_KEY[tab];
    const next = draft.trim() ? { ...comments, [key]: [...comments[key], draft.trim()] } : comments;
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
    <Modal
      title="Comments"
      onClose={onClose}
      width={558}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Close</button>
          <button type="button" className="tertiary" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="modal-tabs">
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
      <div className="field2 tall" style={{ marginTop: 12, marginBottom: 16 }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder=" " rows={2} />
        <label>New comment</label>
      </div>
    </Modal>
  );
}

const MOCK_COUPONS = [
  { coupon: 1, airline: "", flight: "123", date: "12APR25", locTime: "12:10", from: "DME", to: "LED", cls: "Y", fareBasis: "LTOW", allowance: "2/23", segStatus: "HK", couponStatus: "O" },
  { coupon: 2, airline: "XY", flight: "321", date: "12APR25", locTime: "14:30", from: "LED", to: "SVX", cls: "C", fareBasis: "STRO", allowance: "23 kg", segStatus: "HN", couponStatus: "O" },
];

function CouponModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  return (
    <Modal
      title={<>{paxName(passenger)} <span className="mono modal-title-sub">{passenger.ticket_number}</span></>}
      onClose={onClose}
      width={1000}
      footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}
    >
      <table className="modal-table">
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
  const existing = parsePassengerExtra(passenger).ffp;
  const [airline, setAirline] = useState(existing?.airline ?? "");
  const [card, setCard] = useState(existing?.card ?? "");
  const [busy, setBusy] = useState(false);

  async function checkCard() {
    setBusy(true);
    try {
      const updated = await saveExtra(flightId, passenger, { ffp: { airline, card } });
      onUpdated(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="FFP" onClose={onClose} width={558} footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}>
      <div className="ffp-fields">
        <div className="field2" style={{ width: 100 }}>
          <input value={airline} onChange={(e) => setAirline(e.target.value.toUpperCase())} maxLength={2} placeholder=" " />
          <label>Airline</label>
        </div>
        <div className="field2" style={{ width: 140 }}>
          <input value={card} onChange={(e) => setCard(e.target.value)} placeholder=" " />
          <label>Card Number</label>
        </div>
        <button type="button" className="secondary" disabled={!airline || !card || busy} onClick={checkCard}>
          Check card
        </button>
      </div>
    </Modal>
  );
}

function formatLegTime(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    .replace(",", "")
    .toUpperCase();
}

/**
 * Inbound/outbound connections have a real backing field (Passenger.extra,
 * set via the Edit passenger form's Inbound/Outbound fields) — unlike the
 * illustrative mock data elsewhere in this file (ASVC/coupons), this modal
 * must reflect exactly what's on file, not generate anything, so it agrees
 * with the Inbound/Outbound table columns and the TR flag's status.
 */
function RouteModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  const extra = parsePassengerExtra(passenger);
  const status = trStatus(passenger);
  const legs: { label: string; flight: string; time?: string }[] = [];
  if (extra.inbound) legs.push({ label: "Inbound (arrival)", flight: extra.inbound, time: extra.inboundTime });
  if (extra.outbound) legs.push({ label: "Outbound (departure)", flight: extra.outbound, time: extra.outboundTime });

  return (
    <Modal
      title={`Pax route: ${paxName(passenger)}`}
      onClose={onClose}
      width={600}
      footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}
    >
      {legs.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No connecting flights on file — add one from Edit.</div>
      ) : (
        <table className="modal-table">
          <thead>
            <tr>
              <th>Leg</th><th>Flight</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg) => (
              <tr key={leg.label}>
                <td>{leg.label}</td>
                <td className="mono">{leg.flight}</td>
                <td className={status === "conflict" ? "route-delayed" : "mono"}>{formatLegTime(leg.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {status === "conflict" && (
        <div className="error-box" style={{ marginTop: 12 }}>
          The outbound connection departs before (or at) the inbound arrival — too tight to make.
        </div>
      )}
    </Modal>
  );
}
