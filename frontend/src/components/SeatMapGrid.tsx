import { Fragment } from "react";
import { SeatCell } from "../api";
import { CabinFeature, CabinFeatureType } from "../cabinLayout";
import { GalleyIcon, SeatChildIcon } from "./Icon";
import { occupantAge, parseSeatExtra, primaryAttr, seatState, seatSubtype } from "../seatExtra";

interface Props {
  seats: SeatCell[];
  selected?: string | null;
  onSelect?: (seat: string) => void;
  /** Edit mode: every seat (occupied or not) is clickable, to open the attribute editor. */
  editMode?: boolean;
  onEditSeat?: (seat: SeatCell) => void;
  /** Which attribute keys the "layers" menu currently shows on the map — everything, if omitted. */
  visibleLayers?: Set<string>;
  /** WC/galley blocks to render as extra rows in the cabin, keyed by the seat row they follow. */
  cabinFeatures?: CabinFeature[];
}

const LETTER_ORDER = ["A", "B", "C", "D", "E", "F"];

/**
 * Cell rendering follows the Figma "Seat H" component (30291:29546) —
 * fixed 30×30, fill/stroke/icon/text colors keyed by Type (Free/Checked-
 * in/Boarded), a 6px left color bar for the Presit/Booked hold markers,
 * and no letter/number glyph in the cell at all (that only lives in the
 * column headers below) — an empty seat with nothing else set renders as
 * a plain colored box. "Special" (Cradle/Text) variants are skipped: they
 * mark non-seat filler cells this app's seat map model doesn't generate.
 */
export function SeatMapGrid({ seats, selected, onSelect, editMode, onEditSeat, visibleLayers, cabinFeatures }: Props) {
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

  return (
    <div className="seatmap">
      <div className="seatrow seat-col-headers">
        <span className="seat-exit-slot" />
        <span style={{ width: 26 }} />
        {columns.map((letter) => (
          <Fragment key={letter}>
            <span className="seat-col-label">{letter}</span>
            {letter === "C" && <span className="aisle" />}
          </Fragment>
        ))}
        <span className="seat-exit-slot" />
      </div>
      {rowNumbers.map((row) => {
        const rowSeats = rows.get(row)!.sort((a, b) => LETTER_ORDER.indexOf(a.seat.slice(3)) - LETTER_ORDER.indexOf(b.seat.slice(3)));
        const isExitRow = rowSeats.some((s) => s.exit_row);
        return (
          <Fragment key={row}>
            <div className="seatrow">
              <span className={`seat-exit-slot left ${isExitRow ? "active" : ""}`}>
                {isExitRow && <span className="seat-exit-label">EXIT</span>}
              </span>
              <span style={{ width: 26, color: "var(--muted)" }}>{row}</span>
              {rowSeats.map((s) => {
                const letter = s.seat.slice(3);
                const extra = parseSeatExtra(s);
                const state = seatState(s); // free | checked_in | boarded
                const subtype = seatSubtype(extra); // none | presit | booked
                const age = occupantAge(s);
                const isChild = age != null && age < 18;
                const attr = isChild ? null : primaryAttr(extra, visibleLayers);
                const blocked = extra.hardBlock;
                const classes = [
                  "seat",
                  `seat-${state.replace("_", "-")}`,
                  s.seat === selected ? "selected" : "",
                  s.exit_row ? "exit" : "",
                  blocked ? "blocked" : "",
                ].filter(Boolean).join(" ");
                const showAisle = letter === "C"; // 3-3 narrow-body layout aisle after column C
                const Icon = isChild ? SeatChildIcon : attr?.icon;
                const holdLabel = subtype === "presit" ? "Pre-seated" : subtype === "booked" ? "Reserved" : "";
                const priceLabel = extra.price != null ? `${extra.price}` : "";
                const titleBits = [isChild ? "Child" : attr?.label, holdLabel, extra.rfisc, priceLabel].filter(Boolean).join(", ");
                return (
                  <Fragment key={s.seat}>
                    <span
                      className={classes}
                      title={
                        s.passenger_id
                          ? `${s.surname}/${s.given_name} (${s.record_locator})${titleBits ? ` — ${titleBits}` : ""}`
                          : titleBits
                          ? `${s.seat} — ${titleBits}`
                          : s.seat
                      }
                      onClick={() => {
                        if (editMode) onEditSeat?.(s);
                        else if (!s.passenger_id && !blocked) onSelect?.(s.seat);
                      }}
                    >
                      {subtype !== "none" && <span className={`seat-subtype-bar seat-subtype-${subtype}`} />}
                      <span className="seat-content">
                        {Icon && (
                          <Icon
                            size={isChild ? 8 : extra.price != null || extra.rfisc ? 11 : 13}
                            className={attr?.key === "hardBlock" || attr?.key === "softBlock" ? "seat-icon-danger" : undefined}
                          />
                        )}
                        {isChild && age != null && <span className="seat-child-age">{age}</span>}
                        {!isChild && (extra.price != null || extra.rfisc) && (
                          <span className="seat-price-row">
                            {extra.rfisc && <span className="seat-rfisc-badge">{extra.rfisc}</span>}
                            {extra.price != null && <span className="seat-price">{extra.price}</span>}
                          </span>
                        )}
                      </span>
                    </span>
                    {showAisle && <span className="aisle aisle-row-num">{row}</span>}
                  </Fragment>
                );
              })}
              <span className={`seat-exit-slot right ${isExitRow ? "active" : ""}`}>
                {isExitRow && <span className="seat-exit-label">EXIT</span>}
              </span>
            </div>
            {(featuresByRow.get(row) ?? []).map((type, i) => (
              <div className="seatrow cabin-feature-row" key={`${row}-${type}-${i}`}>
                <span className="seat-exit-slot" />
                <span style={{ width: 26 }} />
                <span className="cabin-feature-bar">
                  {type === "wc" ? "WC" : <GalleyIcon size={14} />}
                </span>
                <span className="seat-exit-slot" />
              </div>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
