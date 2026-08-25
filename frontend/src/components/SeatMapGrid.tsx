import { Fragment } from "react";
import { SeatCell } from "../api";
import { ChildIcon } from "./Icon";
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
export function SeatMapGrid({ seats, selected, onSelect, editMode, onEditSeat, visibleLayers }: Props) {
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

  return (
    <div className="seatmap">
      <div className="seatrow seat-col-headers">
        <span style={{ width: 26 }} />
        {columns.map((letter) => (
          <Fragment key={letter}>
            <span className="seat-col-label">{letter}</span>
            {letter === "C" && <span className="aisle" />}
          </Fragment>
        ))}
      </div>
      {rowNumbers.map((row) => {
        const rowSeats = rows.get(row)!.sort((a, b) => LETTER_ORDER.indexOf(a.seat.slice(3)) - LETTER_ORDER.indexOf(b.seat.slice(3)));
        return (
          <div className="seatrow" key={row}>
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
              const Icon = isChild ? ChildIcon : attr?.icon;
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
                          size={isChild ? 12 : extra.price != null || extra.rfisc ? 11 : 13}
                          className={attr?.key === "hardBlock" || attr?.key === "softBlock" ? "seat-icon-danger" : undefined}
                        />
                      )}
                      {isChild && age != null && <span className="seat-age-badge">{age}</span>}
                      {!isChild && (extra.price != null || extra.rfisc) && (
                        <span className="seat-price-row">
                          {extra.rfisc && <span className="seat-rfisc-badge">{extra.rfisc}</span>}
                          {extra.price != null && <span className="seat-price">{extra.price}</span>}
                        </span>
                      )}
                    </span>
                  </span>
                  {showAisle && <span className="aisle" />}
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
