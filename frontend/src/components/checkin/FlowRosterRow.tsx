import { Passenger } from "../../api";
import { ageFromDob } from "../../paxExtra";
import { formatSeatDisplay } from "../../seatExtra";
import { InfoIcon } from "../Icon";

/** "1980-12-22" -> "22.12.1980"; blank input stays blank. */
function fmtDobShort(dob: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? "");
  if (!m) return "—";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

interface Props {
  passenger: Passenger;
  active: boolean;
  classLetter: "C" | "Y" | null;
  /** Only relevant (and only shown) on the Seats step — irrelevant clutter on the other steps. */
  showSeat: boolean;
  onSelect: () => void;
  onOpenFlags: () => void;
  onOpenInfo: () => void;
}

/**
 * One passenger card in the check-in flow's roster panel. Every card shows
 * identity + remarks + the COM/FFP flag buttons (same modal as the flight
 * card's passengers table); only the currently active one additionally
 * shows the fares-info icon, class, and Reprint BP.
 */
export function FlowRosterRow({ passenger: p, active, classLetter, showSeat, onSelect, onOpenFlags, onOpenInfo }: Props) {
  const ssr = p.ssr ?? [];
  const age = ageFromDob(p.dob);
  const hasRemarks = ssr.length > 0;
  const flagButtons = (
    <div className="pnr-flow-roster-flags">
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlags(); }}>COM</button>
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlags(); }}>FFP</button>
    </div>
  );

  return (
    <div className={`pnr-flow-roster-row ${active ? "selected" : ""}`} onClick={onSelect}>
      <div className="pnr-flow-roster-top">
        <div className="pnr-flow-roster-name">{p.surname} {p.given_name}</div>
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
        <div className="pnr-flow-roster-mid-right">
          {showSeat && p.seat && <span className="pnr-flow-seat-box mono">{formatSeatDisplay(p.seat)}</span>}
          {hasRemarks && flagButtons}
        </div>
      </div>
      {active && (
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
