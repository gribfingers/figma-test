import { Passenger } from "../../api";
import { ageFromDob, SeatServiceItem, seatServicesForPassenger } from "../../paxExtra";
import { formatSeatDisplay } from "../../seatExtra";
import { FlightSegment } from "../../flightSegments";
import { InfantIcon, InfoIcon } from "../Icon";

/** "1980-12-22" -> "22.12.1980"; blank input stays blank. */
function fmtDobShort(dob: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? "");
  if (!m) return "—";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function fmtPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function SeatBadge({ seat }: { seat: string }) {
  return <span className="pnr-flow-seat-box mono">{formatSeatDisplay(seat)}</span>;
}

/** One paid seat-selection extra, full detail — the active card's per-segment breakdown. */
function SeatServiceRow({ item }: { item: SeatServiceItem }) {
  return (
    <div className={`seat-service-row ${item.paid ? "paid" : "unpaid"}`}>
      <span className="seat-service-code mono">{item.rfisc}</span>
      <span className="seat-service-label">{item.label}</span>
      <span className="seat-service-price">{fmtPrice(item.price)}</span>
    </div>
  );
}

/** Same extra, condensed to a small pill — the inactive card's one-line summary. */
function SeatServiceChip({ item }: { item: SeatServiceItem }) {
  return (
    <span className={`seat-service-chip ${item.paid ? "paid" : "unpaid"}`}>
      <span className="mono">{item.rfisc}</span>
      {fmtPrice(item.price)}
    </span>
  );
}

interface Props {
  passenger: Passenger;
  active: boolean;
  /** Nested under its guardian's card (an infant sharing the guardian's PNR) — no index number, no seat detail of its own. */
  nested: boolean;
  /** 1-based position among the top-level (non-nested) cards; unused when nested. */
  index: number | null;
  classLetter: "C" | "Y" | null;
  /** Seat + paid-extras detail is only relevant (and only shown) on the Seats step — irrelevant clutter on the other steps. */
  showSeat: boolean;
  segments: FlightSegment[];
  onSelect: () => void;
  onOpenFlags: () => void;
  onOpenInfo: () => void;
}

/**
 * One passenger card in the check-in flow's roster panel. Every card shows
 * identity + remarks + the COM/FFP flag buttons (same modal as the flight
 * card's passengers table); only the currently active one additionally
 * shows the fares-info icon, class, and Reprint BP. On the Seats step, the
 * active card also breaks its paid seat extras out per segment (segment
 * headers only when there's more than one); inactive cards get a condensed
 * one-line summary instead.
 */
export function FlowRosterRow({
  passenger: p,
  active,
  nested,
  index,
  classLetter,
  showSeat,
  segments,
  onSelect,
  onOpenFlags,
  onOpenInfo,
}: Props) {
  const ssr = p.ssr ?? [];
  const age = ageFromDob(p.dob);
  const hasRemarks = ssr.length > 0;
  const flagButtons = (
    <div className="pnr-flow-roster-flags">
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlags(); }}>COM</button>
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlags(); }}>FFP</button>
    </div>
  );

  const servicesBySegment = showSeat && !nested ? seatServicesForPassenger(p, segments.length) : [];

  return (
    <div className={`pnr-flow-roster-row ${active ? "selected" : ""} ${nested ? "nested" : ""}`} onClick={onSelect}>
      <div className="pnr-flow-roster-top">
        <div className="pnr-flow-roster-name">
          {nested ? <InfantIcon size={14} className="pnr-flow-roster-nested-icon" /> : <span className="pnr-flow-roster-index">{index}</span>}
          {p.surname} {p.given_name}
        </div>
        {hasRemarks && (
          <div className="pnr-flow-roster-remarks">
            {ssr.map((code) => (
              <span key={code} className="pnr-flow-remark-chip">{code}</span>
            ))}
          </div>
        )}
        {/* No remarks to show here, so the flags ride up onto this row instead of leaving it empty. */}
        {!hasRemarks && flagButtons}
      </div>
      <div className="pnr-flow-roster-mid">
        <div className="pnr-flow-roster-meta">
          {fmtDobShort(p.dob)}{age && ` (${age})`}{p.gender ? `, ${p.gender}` : ""}
        </div>
        {hasRemarks && flagButtons}
      </div>

      {showSeat && !nested && p.seat && (
        active ? (
          <div className="pnr-flow-seat-detail" onClick={(e) => e.stopPropagation()}>
            {segments.length > 1 ? (
              segments.map((seg, i) => (
                <div key={i} className="pnr-flow-seat-segment">
                  <div className="pnr-flow-seat-segment-head">
                    <span>{seg.origin} - {seg.destination}</span>
                    {i === 0 && <SeatBadge seat={p.seat!} />}
                  </div>
                  {(servicesBySegment[i] ?? []).map((item, j) => <SeatServiceRow key={j} item={item} />)}
                </div>
              ))
            ) : (
              <div className="pnr-flow-seat-segment">
                <div className="pnr-flow-seat-segment-head pnr-flow-seat-segment-head-plain">
                  <SeatBadge seat={p.seat} />
                </div>
                {(servicesBySegment[0] ?? []).map((item, j) => <SeatServiceRow key={j} item={item} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="pnr-flow-seat-compact" onClick={(e) => e.stopPropagation()}>
            {(servicesBySegment[0] ?? []).map((item, i) => <SeatServiceChip key={i} item={item} />)}
            <SeatBadge seat={p.seat} />
          </div>
        )
      )}

      {active && !nested && (
        <div className="pnr-flow-roster-bottom">
          <button type="button" className="pnr-flow-info-btn" onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}>
            <InfoIcon size={16} /> {classLetter}
          </button>
          {/* No boarding-pass printer wired up — present for layout, no action yet. */}
          <button type="button" className="tertiary" onClick={(e) => e.stopPropagation()}>Reprint BP</button>
        </div>
      )}
    </div>
  );
}
