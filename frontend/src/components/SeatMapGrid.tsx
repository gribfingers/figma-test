import { Fragment } from "react";
import { SeatCell } from "../api";
import { parseSeatExtra, primaryAttr, seatState } from "../seatExtra";

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

export function SeatMapGrid({ seats, selected, onSelect, editMode, onEditSeat, visibleLayers }: Props) {
  const rows = new Map<number, SeatCell[]>();
  for (const s of seats) {
    const row = Number(s.seat.slice(0, 3));
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(s);
  }
  const rowNumbers = [...rows.keys()].sort((a, b) => a - b);

  return (
    <div className="seatmap">
      {rowNumbers.map((row) => {
        const rowSeats = rows.get(row)!.sort((a, b) => LETTER_ORDER.indexOf(a.seat.slice(3)) - LETTER_ORDER.indexOf(b.seat.slice(3)));
        return (
          <div className="seatrow" key={row}>
            <span style={{ width: 26, color: "var(--muted)" }}>{row}</span>
            {rowSeats.map((s) => {
              const letter = s.seat.slice(3);
              const extra = parseSeatExtra(s);
              const state = seatState(s);
              const attr = primaryAttr(extra, visibleLayers);
              const blocked = extra.hardBlock;
              const classes = [
                "seat",
                state !== "free" ? "occupied" : "",
                state === "boarded" ? "boarded" : "",
                s.seat === selected ? "selected" : "",
                s.exit_row ? "exit" : "",
                s.cabin_class === "J" ? "business" : "",
                blocked ? "blocked" : "",
                attr ? "has-attr" : "",
                extra.preseated ? "preseated" : "",
                extra.reserved ? "reserved" : "",
              ].filter(Boolean).join(" ");
              const showAisle = letter === "C"; // 3-3 narrow-body layout aisle after column C
              const Icon = attr?.icon;
              const holdLabel = extra.preseated ? "Pre-seated" : extra.reserved ? "Reserved" : "";
              const titleBits = [attr?.label, holdLabel].filter(Boolean).join(", ");
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
                    {Icon ? <Icon size={13} /> : letter}
                    {(extra.price != null || extra.rfisc) && (
                      <span className="seat-price">{[extra.rfisc, extra.price].filter((v) => v != null && v !== "").join(" ")}</span>
                    )}
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
