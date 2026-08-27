import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import { cabinFeaturesFor } from "../cabinLayout";
import { SeatMapPanel } from "../components/SeatMapPanel";
import { BaggageFlowIcon, DocumentsFlowIcon, SeatsFlowIcon, ServicesFlowIcon } from "../components/Icon";
import { formatSeatDisplay } from "../seatExtra";
import { parsePassengerExtra } from "../paxExtra";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { FlowStep, presetCheckinStep } from "../checkinFlow";

// Matches Boarding.tsx's fmtCardDate/parseVersion/classFor/StatBar/statusLabel/statusChipClass —
// same light duplication this session's other pages already use rather than a shared module.
function fmtCardDate(std: string): string {
  const d = new Date(std);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} · ${time}`;
}
function parseVersion(version: string | null): { C: number; Y: number } {
  if (!version) return { C: 0, Y: 0 };
  const c = /C(\d+)/.exec(version);
  const y = /Y(\d+)/.exec(version);
  return { C: c ? +c[1] : 0, Y: y ? +y[1] : 0 };
}
function StatBar({ label, count, total }: { label: "C" | "Y"; count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div className="pnr-stat-row">
      <span className={`pnr-stat-cls pnr-stat-cls-${label}`}>{label}</span>
      <div className="pnr-bar">
        <div className={`pnr-bar-fill pnr-bar-fill-${label}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="pnr-stat-frac mono">{count}/{total}</span>
    </div>
  );
}
function classFor(p: Passenger, seatByCode: Map<string, SeatCell>): "C" | "Y" | null {
  const seat = p.seat ? seatByCode.get(p.seat) : undefined;
  if (!seat) return null;
  return seat.cabin_class === "J" ? "C" : "Y";
}
function statusLabel(p: Passenger): string {
  if (p.boarding_status === "BOARDED") return "Boarded";
  if (p.boarding_status === "OFFLOADED") return "Offloaded";
  if (p.checkin_status === "CHECKED_IN") return "Checked-in";
  return "Not checked-in";
}
function statusBadgeClass(p: Passenger): string {
  if (p.boarding_status === "OFFLOADED") return "danger";
  if (p.boarding_status === "BOARDED" || p.checkin_status === "CHECKED_IN") return "ok";
  return "";
}

// Same fixed window (relative to std) FlightCardHeader/Boarding.tsx use for the boarding phase.
const BOARDING_TO_MIN = -15;

// PnrView drops back to the roster view if the flow's own passenger-selection
// (checked, a separate localStorage key it owns) is empty for this PNR — so
// opening straight into a step also needs to preset that, not just the step
// itself, or the fresh tab immediately resets to "no step".
function presetFlowSelection(pid: number) {
  try {
    localStorage.setItem(`dcs_pnr_checked_${pid}`, JSON.stringify([pid]));
  } catch {
    // Storage full or unavailable — the new tab will just open on the roster instead.
  }
}

const STEP_ICONS: { step: FlowStep; icon: (size: number) => JSX.Element; tooltip: string }[] = [
  { step: "docs", icon: (s) => <DocumentsFlowIcon size={s} />, tooltip: "Documents" },
  { step: "seats", icon: (s) => <SeatsFlowIcon size={s} />, tooltip: "Seats" },
  { step: "baggage", icon: (s) => <BaggageFlowIcon size={s} />, tooltip: "Baggage" },
  { step: "services", icon: (s) => <ServicesFlowIcon size={s} />, tooltip: "Extra services" },
];

/**
 * Boarding/gate workstation: the per-passenger boarding screen, reached by
 * clicking a row on the passenger list (Boarding.tsx). Shows that one
 * passenger's boarding status/remarks/comments next to the real seat map,
 * with quick links (opened in a new tab) to jump straight to any step of
 * their check-in flow.
 */
export function BoardingPax() {
  const { flightId, passengerId } = useParams();
  const fid = Number(flightId);
  const pid = Number(passengerId);
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `Boarding ${flight.carrier_code}${flight.flight_number}` : "Boarding");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { showToast } = useToast();

  function refresh() {
    api.getFlight(fid).then(setFlight);
    api.seatmap(fid).then(setSeats);
    api.boardingList(fid).then((r) => setPassengers(r.passengers));
  }
  useEffect(refresh, [fid]);

  const passenger = passengers.find((p) => p.id === pid) ?? null;
  const seatByCode = useMemo(() => new Map(seats.map((s) => [s.seat, s])), [seats]);
  const capacity = flight ? parseVersion(flight.aircraft_version) : { C: 0, Y: 0 };
  const booked = useMemo(() => {
    const b = { C: 0, Y: 0 };
    for (const p of passengers) {
      const cls = classFor(p, seatByCode);
      if (cls) b[cls]++;
    }
    return b;
  }, [passengers, seatByCode]);
  const yetToBoardCount = passengers.filter((p) => p.boarding_status !== "BOARDED").length;

  const remainMin = flight
    ? Math.max(0, Math.round((new Date(flight.std).getTime() + BOARDING_TO_MIN * 60000 - Date.now()) / 60000))
    : 0;
  const remainStr = `${String(Math.floor(remainMin / 60)).padStart(2, "0")}:${String(remainMin % 60).padStart(2, "0")}`;

  function handleSeatUpdated(updated: SeatCell) {
    setSeats((prev) => prev.map((s) => (s.seat === updated.seat ? updated : s)));
  }

  async function boardThis() {
    if (!passenger?.bcbp) return;
    try {
      await api.scanBoardingPass(passenger.bcbp);
      refresh();
      showToast("Boarded");
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }
  async function unboardThis() {
    if (!passenger) return;
    try {
      await api.unboard(fid, passenger.id);
      refresh();
      showToast("Boarding undone");
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const found = passengers.find((p) => String(p.checkin_sequence ?? "") === q);
    if (found) navigate(`/boarding/${fid}/pax/${found.id}`);
    else setMessage({ kind: "error", text: `No passenger with Sq № ${q}` });
  }

  if (!flight || !passenger) return <div className="content">Loading…</div>;

  const extra = parsePassengerExtra(passenger);
  const comment = extra.comments?.boarding[0] ?? extra.comments?.checkin[0] ?? null;
  const ssr = passenger.ssr ?? [];
  const cabinFeatures = cabinFeaturesFor(flight.aircraft_type);

  return (
    <div className="boarding-page">
      <div className="pnr-head">
        <div className="pnr-head-id">
          <div className="pnr-flight-number">{flight.aircraft_reg ?? `${flight.carrier_code}${flight.flight_number}`}</div>
          <div className="pnr-head-id-meta">
            <span className="pnr-route">{flight.origin} → {flight.destination}</span>
            <div className="pnr-date">{fmtCardDate(flight.std)}</div>
            <div className="pnr-date">Gate {flight.gate ?? "—"}</div>
          </div>
        </div>

        <div className="pnr-stats">
          <div className="pnr-stat-col">
            <StatBar label="C" count={booked.C} total={capacity.C} />
            <StatBar label="Y" count={booked.Y} total={capacity.Y} />
          </div>
        </div>

        <div className="pnr-side">
          <div className="boarding-remain-block">
            <span className="boarding-remain-label">Remain time for boarding</span>
            <span className="boarding-remain-value">{remainStr}</span>
          </div>
          <div className="boarding-remain-block">
            <span className="boarding-remain-label">Pax to board</span>
            <span className="boarding-remain-value boarding-remain-value-muted">{yetToBoardCount}</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <form onSubmit={runSearch} className="search-mode-bar" style={{ flex: 1 }}>
          <div className="search-mode-tabs">
            <button type="button" className="search-mode-tab selected">Sq №</button>
          </div>
          <input
            className="search-mode-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
          />
        </form>
      </div>

      {message && <div className={message.kind === "ok" ? "ok-box" : "error-box"}>{message.text}</div>}

      <div className="boarding-pax-body">
        <div className="panel boarding-pax-card">
          <div className="boarding-pax-name">{passenger.surname} {passenger.given_name}</div>
          <div className="boarding-pax-steps">
            {STEP_ICONS.map(({ step, icon, tooltip }) => (
              <Link
                key={step}
                to={`/checkin/${fid}/pnr/${passenger.id}`}
                target="_blank"
                data-tooltip={tooltip}
                onClick={() => {
                  presetFlowSelection(passenger.id);
                  presetCheckinStep(passenger.id, step);
                }}
              >
                {icon(28)}
              </Link>
            ))}
          </div>

          <div className="boarding-pax-seat-row">
            <span className="boarding-pax-seat-box mono">{passenger.seat ? formatSeatDisplay(passenger.seat) : "—"}</span>
            <span className={`boarding-pax-status-badge ${statusBadgeClass(passenger)}`}>{statusLabel(passenger)}</span>
            <div className="boarding-pax-remarks">
              {ssr.map((code) => <span key={code} className="chip small muted mono">{code}</span>)}
              {passenger.infant && <span className="chip small muted mono">INF</span>}
            </div>
          </div>

          {comment && <div className="boarding-pax-comment">{comment}</div>}

          <div className="boarding-pax-actions">
            {passenger.boarding_status === "BOARDED" ? (
              <button type="button" className="secondary boarding-pax-action-btn" onClick={unboardThis}>
                Unboard
              </button>
            ) : (
              <button
                type="button"
                className="boarding-pax-action-btn"
                disabled={passenger.checkin_status !== "CHECKED_IN"}
                onClick={boardThis}
              >
                Board
              </button>
            )}
            <button type="button" className="secondary boarding-pax-action-btn">Reprint BP</button>
          </div>
        </div>

        <div className="panel boarding-pax-map">
          <SeatMapPanel
            flightId={fid}
            seats={seats}
            selected={passenger.seat}
            onSeatUpdated={handleSeatUpdated}
            cabinFeatures={cabinFeatures}
          />
        </div>
      </div>
    </div>
  );
}
