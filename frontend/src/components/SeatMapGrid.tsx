import { Fragment, useEffect, useState } from "react";
import { SeatCell } from "../api";
import { CabinFeature, CabinFeatureType } from "../cabinLayout";
import { GalleyIcon, SeatChildIcon } from "./Icon";
import { EXIT_ROW_ATTR, allAttrs, occupantAge, parseSeatExtra, seatState, seatSubtype } from "../seatExtra";
import { useLanguage } from "../i18n";

/** How long each icon shows before the hover carousel advances to the next one. */
const MULTI_FLAG_CAROUSEL_INTERVAL_MS = 900;

interface Props {
  seats: SeatCell[];
  selected?: string | null;
  onSelect?: (seat: string) => void;
  /** Right-clicking any seat opens the attribute editor for it. Takes priority over onSeatContextMenu below. */
  onEditSeat?: (seat: SeatCell) => void;
  /** Right-clicking any seat opens the read-only info popover — used where onEditSeat isn't (check-in, boarding). */
  onSeatContextMenu?: (seat: SeatCell, x: number, y: number) => void;
  /** The three layer toggles from the seat-map toolbar — all default to shown. */
  showIcons?: boolean;
  showPrice?: boolean;
  showRfisc?: boolean;
  /** WC/galley/exit-door blocks to render as extra rows in the cabin, keyed by the seat row they follow. */
  cabinFeatures?: CabinFeature[];
  /** Fires when an occupied seat is left-clicked — lets the caller e.g. highlight/scroll to that passenger's row. */
  onSelectOccupied?: (seat: SeatCell) => void;
  /** Fires instead of onSelectOccupied when the clicked seat is the currently `selected` one — a second
   *  click on the seat you just assigned removes it, rather than just re-selecting the same passenger. */
  onUnassign?: (seat: string) => void;
  /** Seat codes the passenger currently being assigned/swapped can't be put in at all (occupied, hard-blocked,
   *  or an infant/child in an exit row) — dimmed to 20% opacity, rendered as if free regardless of real
   *  occupancy, and unclickable. */
  ineligibleSeats?: Set<string>;
  /** Seat codes that are legal but discouraged for the passenger being assigned (soft-blocked) — dimmed to
   *  70% opacity with a dashed border, but stay clickable. */
  undesirableSeats?: Set<string>;
}

const LETTER_ORDER = ["A", "B", "C", "D", "E", "F"];
const CABIN_CLASS_LABEL: Record<string, string> = { J: "Business", Y: "Economy" };

function FeatureRow({ type }: { type: CabinFeatureType }) {
  if (type === "exit") {
    return (
      <div className="seatrow cabin-feature-row">
        <span className="seat-exit-slot active left">
          <span className="seat-exit-label">EXIT</span>
        </span>
        <span className="cabin-exit-gap" />
        <span className="seat-exit-slot active right">
          <span className="seat-exit-label">EXIT</span>
        </span>
      </div>
    );
  }
  if (type === "galley") {
    return (
      <div className="seatrow cabin-feature-row">
        <span className="seat-exit-slot" />
        <span className="cabin-feature-bar">
          <GalleyIcon size={14} />
        </span>
        <span className="seat-exit-slot" />
      </div>
    );
  }
  // "wc" — shown as a matching pair, one on each side of the aisle.
  return (
    <div className="seatrow cabin-feature-row">
      <span className="seat-exit-slot" />
      <span className="cabin-feature-bar">WC</span>
      <span className="aisle" />
      <span className="cabin-feature-bar">WC</span>
      <span className="seat-exit-slot" />
    </div>
  );
}

/**
 * Cell rendering follows the Figma "Seat H" component (30291:29546) —
 * fixed 30×30, fill/stroke/icon/text colors keyed by Type (Free/Checked-
 * in/Boarded), a 6px left color bar for the Presit/Booked hold markers,
 * and no letter/number glyph in the cell at all (that only lives in the
 * aisle row-number labels) — an empty seat with nothing else set renders
 * as a plain colored box. "Special" (Cradle/Text) variants are skipped:
 * they mark non-seat filler cells this app's seat map model doesn't
 * generate.
 */
export function SeatMapGrid({
  seats,
  selected,
  onSelect,
  onEditSeat,
  onSeatContextMenu,
  showIcons = true,
  showPrice = true,
  showRfisc = true,
  cabinFeatures,
  onSelectOccupied,
  onUnassign,
  ineligibleSeats,
  undesirableSeats,
}: Props) {
  const { t } = useLanguage();
  // A seat with more than one attribute flag gets a small badge (seat-multi-badge) instead of/alongside
  // its single primary icon; hovering it cycles all its icons one at a time in a small floating carousel.
  const [multiHoverSeat, setMultiHoverSeat] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  useEffect(() => {
    if (!multiHoverSeat) return;
    setCarouselIndex(0);
    const id = setInterval(() => setCarouselIndex((i) => i + 1), MULTI_FLAG_CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [multiHoverSeat]);

  const rows = new Map<number, SeatCell[]>();
  for (const s of seats) {
    const row = Number(s.seat.slice(0, 3));
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(s);
  }
  const rowNumbers = [...rows.keys()].sort((a, b) => a - b);
  const columns = [...new Set(seats.map((s) => s.seat.slice(3)))].sort(
    (a, b) => LETTER_ORDER.indexOf(a) - LETTER_ORDER.indexOf(b)
  );

  const featuresByRow = new Map<number, CabinFeatureType[]>();
  for (const f of cabinFeatures ?? []) {
    if (!featuresByRow.has(f.afterRow)) featuresByRow.set(f.afterRow, []);
    featuresByRow.get(f.afterRow)!.push(f.type);
  }

  let prevClass: string | null = null;

  return (
    <div className="seatmap">
      <div className="seatrow seat-col-headers">
        <span className="seat-exit-slot" />
        {columns.map((letter) => (
          <Fragment key={letter}>
            <span className="seat-col-label">{letter}</span>
            {letter === "C" && <span className="aisle" />}
          </Fragment>
        ))}
        <span className="seat-exit-slot" />
      </div>
      {(featuresByRow.get(0) ?? []).map((type, i) => (
        <FeatureRow type={type} key={`pre-${type}-${i}`} />
      ))}
      {rowNumbers.map((row) => {
        const rowSeats = rows.get(row)!.sort((a, b) => LETTER_ORDER.indexOf(a.seat.slice(3)) - LETTER_ORDER.indexOf(b.seat.slice(3)));
        const cls = rowSeats[0]?.cabin_class ?? null;
        const sectionChanged = cls !== prevClass;
        prevClass = cls;
        return (
          <Fragment key={row}>
            {sectionChanged && cls && (
              <div className="seatrow cabin-section-row">
                <span className="seat-exit-slot" />
                <span className="cabin-section-label">{t(CABIN_CLASS_LABEL[cls] ?? cls)}</span>
                <span className="seat-exit-slot" />
              </div>
            )}
            <div className="seatrow">
              <span className="seat-exit-slot" />
              {rowSeats.map((s) => {
                const letter = s.seat.slice(3);
                const extra = parseSeatExtra(s);
                const realState = seatState(s); // free | checked_in | boarded
                const subtype = seatSubtype(extra); // none | presit | booked
                const age = occupantAge(s);
                const isChild = age != null && age >= 2 && age <= 12; // CHILD = 2 to 12 years old
                const realAttrs = isChild ? [] : allAttrs(extra);
                const attrs = realAttrs.length > 0 ? realAttrs : s.exit_row ? [EXIT_ROW_ATTR] : [];
                const attr = attrs[0] ?? null;
                // Up to 3 flags per the seat-map legend — a 4th+ would just never be reachable in practice,
                // but cap it anyway so the carousel can't grow unbounded.
                const carouselAttrs = attrs.slice(0, 3);
                const hasMultiFlags = carouselAttrs.length > 1;
                const ineligible = ineligibleSeats?.has(s.seat) ?? false;
                const undesirable = !ineligible && (undesirableSeats?.has(s.seat) ?? false);
                // Ineligible seats always read as plain free ones, whatever their real occupancy —
                // the agent doesn't need to know why a seat can't be picked, just that it can't be.
                const state = ineligible ? "free" : realState;
                const effectiveSubtype = ineligible ? "none" : subtype;
                const classes = [
                  "seat",
                  `seat-${state.replace("_", "-")}`,
                  s.seat === selected ? "selected" : "",
                  s.exit_row ? "exit" : "",
                  ineligible ? "picker-disabled" : "",
                  undesirable ? "picker-undesirable" : "",
                ].filter(Boolean).join(" ");
                const showAisle = letter === "C"; // 3-3 narrow-body layout aisle after column C
                const Icon = isChild ? SeatChildIcon : attr?.icon;
                const holdLabel = effectiveSubtype === "presit" ? t("Pre-seated") : effectiveSubtype === "booked" ? t("Reserved") : "";
                const priceLabel = extra.price != null ? `${extra.price}` : "";
                const attrLabel = isChild
                  ? t("Child")
                  : hasMultiFlags
                  ? carouselAttrs.map((a) => t(a.label)).join(" / ")
                  : attr && t(attr.label);
                const titleBits = [attrLabel, holdLabel, extra.rfisc, priceLabel].filter(Boolean).join(", ");
                const priceStr = extra.price != null ? String(extra.price) : "";
                const priceTwoLine = priceStr.length > 3;
                return (
                  <Fragment key={s.seat}>
                    <span
                      className={classes}
                      data-seat={s.seat}
                      title={
                        s.passenger_id
                          ? `${s.surname}/${s.given_name} (${s.record_locator})${titleBits ? ` — ${titleBits}` : ""}`
                          : titleBits
                          ? `${s.seat} — ${titleBits}`
                          : s.seat
                      }
                      onClick={() => {
                        if (s.passenger_id) {
                          if (s.seat === selected && onUnassign) onUnassign(s.seat);
                          else onSelectOccupied?.(s);
                        } else if (!ineligible) onSelect?.(s.seat);
                      }}
                      onContextMenu={(e) => {
                        if (onEditSeat) {
                          e.preventDefault();
                          onEditSeat(s);
                        } else if (onSeatContextMenu) {
                          e.preventDefault();
                          onSeatContextMenu(s, e.clientX, e.clientY);
                        }
                      }}
                      onMouseEnter={() => {
                        if (hasMultiFlags) setMultiHoverSeat(s.seat);
                      }}
                      onMouseLeave={() => {
                        if (hasMultiFlags) setMultiHoverSeat((cur) => (cur === s.seat ? null : cur));
                      }}
                    >
                      {effectiveSubtype !== "none" && <span className={`seat-subtype-bar seat-subtype-${effectiveSubtype}`} />}
                      {showIcons && hasMultiFlags && <span className="seat-multi-badge" />}
                      {showIcons && hasMultiFlags && multiHoverSeat === s.seat && (
                        <span className="seat-multi-carousel">
                          {(() => {
                            const CarouselIcon = carouselAttrs[carouselIndex % carouselAttrs.length].icon;
                            return <CarouselIcon size={16} />;
                          })()}
                        </span>
                      )}
                      <span className="seat-content">
                        {showIcons && Icon && (
                          <>
                            <Icon size={isChild ? 8 : extra.price != null || extra.rfisc ? 12 : 16} />
                            {isChild && <span className="seat-child-age">{age}</span>}
                          </>
                        )}
                        {!isChild && ((showPrice && extra.price != null) || (showRfisc && extra.rfisc)) && (
                          <span className="seat-price-row">
                            {showRfisc && extra.rfisc && <span className="seat-rfisc-badge">{extra.rfisc}</span>}
                            {showPrice && extra.price != null && (
                              <span className={`seat-price${priceTwoLine ? " two-line" : ""}`}>
                                {priceTwoLine ? (
                                  <>
                                    <span>{priceStr.slice(0, -3)}</span>
                                    <span>{priceStr.slice(-3)}</span>
                                  </>
                                ) : (
                                  priceStr
                                )}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </span>
                    {showAisle && <span className="aisle aisle-row-num">{row}</span>}
                  </Fragment>
                );
              })}
              <span className="seat-exit-slot" />
            </div>
            {(featuresByRow.get(row) ?? []).map((type, i) => (
              <FeatureRow type={type} key={`${row}-${type}-${i}`} />
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
