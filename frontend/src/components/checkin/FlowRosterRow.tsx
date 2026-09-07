import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flight, Passenger, SeatCell } from "../../api";
import { BagRow } from "../../baggageTypes";
import { ageFromDob, baggageServiceItemsForRows, SeatServiceItem, seatServiceItemsForSeat } from "../../paxExtra";
import { formatSeatDisplay } from "../../seatExtra";
import { FlightSegment } from "../../flightSegments";
import { ChevronDownIcon, InfantIcon, InfoIcon } from "../Icon";
import { EmdModal } from "./EmdModal";
import { useLanguage } from "../../i18n";
import { usePopoverPosition } from "../../usePopoverPosition";
import { useHotkey } from "../../useShortcuts";
import { useShortcutTitle, ShortcutBadge } from "../../shortcutHints";
import { clickable } from "../../interactive";

/** "Swap seat…" (Seats step, once seated) and "Reprint BP" tucked under one menu, same
 *  trigger/list pattern as the flight card header's Actions menu (FlightActionsMenu). Portaled to
 *  document.body (see usePopoverPosition) rather than positioned absolute in place — the rotated
 *  seat map's roster row gives each card overflow:auto/hidden so cards can share one height, which
 *  would otherwise clip a plain absolute dropdown the moment it grew past the card's own box. */
function RowActionsMenu({ onSwapSeat }: { onSwapSeat?: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rect = usePopoverPosition(btnRef, open);

  const items = [
    ...(onSwapSeat ? [{ key: "swap", label: t("Swap seat…"), pick: onSwapSeat }] : []),
    // No boarding-pass printer wired up — present for layout, no action yet.
    { key: "reprint", label: t("Reprint BP"), pick: () => {} },
  ];
  // Roving tabindex over the menu items, same pattern as PnrView's own Actions menu: one item is
  // ever a Tab stop, Up/Down moves it — opening the menu moves real focus onto the first item so
  // arrow keys work immediately.
  const [activeIdx, setActiveIdx] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  function moveItem(delta: 1 | -1) {
    const next = (activeIdx + delta + items.length) % items.length;
    setActiveIdx(next);
    itemRefs.current[next]?.focus();
  }
  function pick(item: (typeof items)[number]) {
    setOpen(false);
    item.pick();
  }

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    const id = requestAnimationFrame(() => itemRefs.current[0]?.focus());
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Alt+M — free during the check-in flow (PnrView's own checkin.actions-menu hotkey for the plain
  // roster page's Actions button is explicitly disabled while flowStep is set), so this active
  // card's own Actions menu can reuse the same combo without colliding.
  useHotkey("checkin.actions-menu", () => setOpen((o) => !o), true);
  const actionsMenuTitle = useShortcutTitle("checkin.actions-menu", t("Actions"));

  return (
    <div
      ref={rootRef}
      className={`actions-select ${open ? "open" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button ref={btnRef} type="button" className="tertiary shortcut-hint-host" aria-haspopup="menu" aria-expanded={open} title={actionsMenuTitle} onClick={() => setOpen((o) => !o)}>
        <ShortcutBadge id="checkin.actions-menu" />
        {t("Actions")} <ChevronDownIcon size={16} className="chevron-flip" />
      </button>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={menuRef}
            className="actions-menu"
            role="menu"
            style={{ position: "fixed", top: rect.top, right: window.innerWidth - (rect.left + rect.width) }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => (
              <li
                key={item.key}
                ref={(el) => { itemRefs.current[i] = el; }}
                role="menuitem"
                tabIndex={i === activeIdx ? 0 : -1}
                onFocus={() => setActiveIdx(i)}
                onClick={() => pick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(item); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); moveItem(1); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); moveItem(-1); }
                }}
              >
                {item.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

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

/** One seat property, full detail — the active card's breakdown. Price/RFISC only render when the
 *  real seat actually has one (see seatServiceItemsForSeat) — never a fabricated value. */
function SeatServiceRow({ item, onOpenEmd }: { item: SeatServiceItem; onOpenEmd: (item: SeatServiceItem) => void }) {
  return (
    <div className={`seat-service-row ${item.paid ? "paid" : "unpaid"}`}>
      {item.rfisc && <span className="seat-service-code mono">{item.rfisc}</span>}
      <span className="seat-service-label">{item.label}</span>
      {item.price != null && (
        <button type="button" className="seat-service-price" onClick={(e) => { e.stopPropagation(); onOpenEmd(item); }}>
          {fmtPrice(item.price)}
        </button>
      )}
    </div>
  );
}

/** Same property, condensed to a small pill — the inactive card's one-line summary: just the code
 *  (plus price, when the seat actually has one to collect) — the label stays on the active card only. */
function SeatServiceChip({ item, onOpenEmd }: { item: SeatServiceItem; onOpenEmd: (item: SeatServiceItem) => void }) {
  return (
    <span className={`seat-service-chip ${item.paid ? "paid" : "unpaid"}`}>
      {item.rfisc && <span className="mono">{item.rfisc}</span>}
      {item.price != null && (
        <button type="button" className="seat-service-chip-price" onClick={(e) => { e.stopPropagation(); onOpenEmd(item); }}>
          {fmtPrice(item.price)}
        </button>
      )}
    </span>
  );
}

interface Props {
  flight: Flight;
  passenger: Passenger;
  active: boolean;
  /** Nested under its guardian's card (an infant sharing the guardian's PNR) — no index number, no seat detail of its own. */
  nested: boolean;
  /** 1-based position among the top-level (non-nested) cards; unused when nested. */
  index: number | null;
  classLetter: "C" | "Y" | null;
  /** The passenger's actual assigned seat (for its real properties) — undefined until they have one. */
  seat: SeatCell | undefined;
  /** Seat badge + real seat properties — only shown on the Seats step. */
  showSeat: boolean;
  /** Rotated seat map only: the active card's seat properties collapse to the same one-line,
   *  code-only chips + badge the inactive cards already use, instead of the full per-segment
   *  breakdown — the roster only has so much height to work with stacked above a wide map. */
  compactSeat?: boolean;
  /** The passenger's actual bag rows from the Baggage step — only shown on the Baggage step. */
  showBaggage: boolean;
  bagRows: BagRow[];
  /** Prices only appear on the card once Calculate has actually been run for this passenger. */
  baggageCalculated: boolean;
  /** Extra-service chips — only shown on the Extra services step. */
  showServices: boolean;
  /** The services this passenger has actually confirmed on the Extra services step — mirrored onto the card verbatim. */
  confirmedServices: SeatServiceItem[];
  segments: FlightSegment[];
  onSelect: () => void;
  onOpenFlag: (flag: "com" | "ffp") => void;
  onOpenInfo: () => void;
  /** Seats step only, active card only, and only once the passenger actually has a seat to swap. */
  onSwapSeat?: () => void;
}

/**
 * One passenger card in the check-in flow's roster panel. Every card shows
 * identity + remarks + the COM/FFP flag buttons (same standalone modals as
 * the flight card's passengers table); only the currently active one
 * additionally shows the fares-info icon, class, and Reprint BP. On the
 * Seats step, the active card also breaks the assigned seat's real
 * properties out per segment header (only shown when there's more than
 * one segment — the seat itself doesn't vary by leg); inactive cards get
 * a condensed one-line summary instead.
 */
export function FlowRosterRow({
  flight,
  passenger: p,
  active,
  nested,
  index,
  classLetter,
  seat,
  showSeat,
  compactSeat,
  showBaggage,
  bagRows,
  baggageCalculated,
  showServices,
  confirmedServices,
  segments,
  onSelect,
  onOpenFlag,
  onOpenInfo,
  onSwapSeat,
}: Props) {
  const { t } = useLanguage();
  const ssr = p.ssr ?? [];
  const age = ageFromDob(p.dob);
  const hasRemarks = ssr.length > 0;
  const [emdItem, setEmdItem] = useState<SeatServiceItem | null>(null);
  const flagButtons = (
    <div className="pnr-flow-roster-flags">
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlag("com"); }}>COM</button>
      <button type="button" className="pnr-flow-flag-btn" onClick={(e) => { e.stopPropagation(); onOpenFlag("ffp"); }}>FFP</button>
    </div>
  );

  const seatItems = showSeat && !nested ? seatServiceItemsForSeat(seat, t) : [];
  // Baggage extras aren't broken out per segment (no "SVX-DME" grouping) — just a flat list, full rows on the active card and compact chips otherwise, same as seats.
  const baggageItems = showBaggage && !nested ? baggageServiceItemsForRows(p.id, bagRows, baggageCalculated, t) : [];
  const serviceItems = showServices && !nested ? confirmedServices : [];

  return (
    <div className={`pnr-flow-roster-row ${active ? "selected" : ""} ${nested ? "nested" : ""}`} onClick={onSelect} {...clickable(onSelect)}>
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
        active && !compactSeat ? (
          <div className="pnr-flow-seat-detail" onClick={(e) => e.stopPropagation()}>
            {segments.length > 1 ? (
              segments.map((seg, i) => (
                <div key={i} className="pnr-flow-seat-segment">
                  <div className="pnr-flow-seat-segment-head">
                    <span>{seg.origin} - {seg.destination}</span>
                    {i === 0 && <SeatBadge seat={p.seat!} />}
                  </div>
                  {i === 0 && seatItems.map((item, j) => <SeatServiceRow key={j} item={item} onOpenEmd={setEmdItem} />)}
                </div>
              ))
            ) : (
              <div className="pnr-flow-seat-segment">
                <div className="pnr-flow-seat-segment-head pnr-flow-seat-segment-head-plain">
                  <SeatBadge seat={p.seat} />
                </div>
                {seatItems.map((item, j) => <SeatServiceRow key={j} item={item} onOpenEmd={setEmdItem} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="pnr-flow-seat-compact" onClick={(e) => e.stopPropagation()}>
            {seatItems.map((item, i) => <SeatServiceChip key={i} item={item} onOpenEmd={setEmdItem} />)}
            <SeatBadge seat={p.seat} />
          </div>
        )
      )}

      {showBaggage && !nested && baggageItems.length > 0 && (
        active ? (
          <div className="pnr-flow-seat-detail" onClick={(e) => e.stopPropagation()}>
            {baggageItems.map((item, j) => <SeatServiceRow key={j} item={item} onOpenEmd={setEmdItem} />)}
          </div>
        ) : (
          <div className="pnr-flow-seat-compact" onClick={(e) => e.stopPropagation()}>
            {baggageItems.map((item, i) => <SeatServiceChip key={i} item={item} onOpenEmd={setEmdItem} />)}
          </div>
        )
      )}

      {showServices && !nested && serviceItems.length > 0 && (
        active ? (
          <div className="pnr-flow-seat-detail" onClick={(e) => e.stopPropagation()}>
            {serviceItems.map((item, j) => <SeatServiceRow key={j} item={item} onOpenEmd={setEmdItem} />)}
          </div>
        ) : (
          <div className="pnr-flow-seat-compact" onClick={(e) => e.stopPropagation()}>
            {serviceItems.map((item, i) => <SeatServiceChip key={i} item={item} onOpenEmd={setEmdItem} />)}
          </div>
        )
      )}

      {active && !nested && (
        <div className="pnr-flow-roster-bottom">
          <button type="button" className="pnr-flow-info-btn" onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}>
            <InfoIcon size={16} /> {classLetter}
          </button>
          <RowActionsMenu onSwapSeat={p.seat ? onSwapSeat : undefined} />
        </div>
      )}

      {emdItem && (
        <div onClick={(e) => e.stopPropagation()}>
          <EmdModal flight={flight} passenger={p} item={emdItem} onClose={() => setEmdItem(null)} />
        </div>
      )}
    </div>
  );
}
