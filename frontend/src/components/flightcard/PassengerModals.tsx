import { useState } from "react";
import { Passenger } from "../../api";
import { Modal } from "../Modal";

interface Props {
  kind: "asvc" | "comments" | "coupon" | "ffp" | "route";
  passenger: Passenger;
  onClose: () => void;
}

export function PassengerModals({ kind, passenger, onClose }: Props) {
  if (kind === "asvc") return <AsvcModal passenger={passenger} onClose={onClose} />;
  if (kind === "comments") return <CommentsModal passenger={passenger} onClose={onClose} />;
  if (kind === "coupon") return <CouponModal passenger={passenger} onClose={onClose} />;
  if (kind === "ffp") return <FfpModal onClose={onClose} />;
  return <RouteModal passenger={passenger} onClose={onClose} />;
}

function paxName(p: Passenger) {
  return `${p.surname} ${p.given_name}`;
}

// The paid-ancillary breakdown per leg, e-ticket coupons, and route/delay
// data below have no backing tables yet — same scope as the flight card's
// Counters/Transfers tabs, shown as illustrative sample content matching
// the reference design until there's a real source for it.
const MOCK_LEGS = ["MOW-AER", "AER-PEE", "PEE-LED"];
const MOCK_SERVICES = [
  { name: "Доступ в интернет", paid: true },
  { name: "Бублики", paid: true },
  { name: "Кофе", paid: true },
  { name: "Кофе +", paid: false },
];

function AsvcModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  return (
    <Modal title={paxName(passenger)} onClose={onClose} width={950} footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}>
      <div className="asvc-columns">
        {MOCK_LEGS.map((leg) => (
          <div key={leg} className="asvc-column">
            <h3>{leg}</h3>
            {MOCK_SERVICES.map((s, i) => (
              <div key={i} className={`asvc-row ${s.paid ? "paid" : "unpaid"}`}>
                <span className="mono asvc-code">0B5</span>
                <span className="asvc-name">{s.name}</span>
                <span className="asvc-status">Оплачено</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

const COMMENT_TABS = ["CHECK-IN", "BOARDING"] as const;
// Not persisted to the backend yet — no comments table exists; kept as
// local state per modal open so the UI can be exercised end to end.
const SEED_COMMENTS: Record<(typeof COMMENT_TABS)[number], string[]> = {
  "CHECK-IN": ["Проверить на посадке ручную кладь. Срочно быстрее нужно это сделать.", "Пассажир подозрительный. Задать вопросы.", "Пассажир с велосипедом."],
  BOARDING: [],
};

function CommentsModal({ onClose }: { passenger: Passenger; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof COMMENT_TABS)[number]>("CHECK-IN");
  const [comments, setComments] = useState(SEED_COMMENTS);
  const [draft, setDraft] = useState("");

  function save() {
    if (draft.trim()) {
      setComments((c) => ({ ...c, [tab]: [...c[tab], draft.trim()] }));
      setDraft("");
    }
  }

  return (
    <Modal
      title="Comments"
      onClose={onClose}
      width={558}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Close</button>
          <button type="button" className="tertiary" onClick={save}>Save</button>
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
        {comments[tab].map((c, i) => (
          <div key={i} className="comment-card">{c}</div>
        ))}
        {comments[tab].length === 0 && <div className="comment-card muted">No comments yet.</div>}
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

function FfpModal({ onClose }: { onClose: () => void }) {
  const [airline, setAirline] = useState("");
  const [card, setCard] = useState("");
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
        <button type="button" className="secondary" disabled={!airline || !card} style={{ marginBottom: 16 }}>
          Check card
        </button>
      </div>
    </Modal>
  );
}

const MOCK_ROUTE = [
  { airline: "XX", flight: "123", date: "12APR25", from: "DME", to: "LED", cls: "Y", etd: "12:10", atd: "13:40", past: true },
  { airline: "XY", flight: "123", date: "321", from: "LED", to: "SVX", cls: "C", etd: "Delayed (15:30)", atd: "", current: true },
  { airline: "XY", flight: "456", date: "12APR25", from: "SVX", to: "PEE", cls: "C", etd: "16:30", atd: "", past: false },
];

function RouteModal({ passenger, onClose }: { passenger: Passenger; onClose: () => void }) {
  return (
    <Modal
      title={`Passenger route: ${paxName(passenger)}`}
      onClose={onClose}
      width={800}
      footer={<button type="button" className="tertiary" onClick={onClose}>Close</button>}
    >
      <table className="modal-table">
        <thead>
          <tr>
            <th>Airline</th><th>Flight</th><th>Date</th><th>From</th><th>To</th><th>Class</th>
            <th>Departure (ETD)</th><th>Arrival (ATD)</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_ROUTE.map((r, i) => (
            <tr key={i} className={r.current ? "route-current" : r.past ? "route-past" : ""}>
              <td className="mono">{r.airline}</td>
              <td className="mono">{r.flight}</td>
              <td className="mono">{r.date}</td>
              <td className="mono">{r.from}</td>
              <td className="mono">{r.to}</td>
              <td>{r.cls}</td>
              <td className={r.etd.startsWith("Delayed") ? "route-delayed" : "mono"}>{r.etd}</td>
              <td className="mono">{r.atd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
