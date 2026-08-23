import { Fragment } from "react";
import { SeatCell } from "../api";

interface Props {
  seats: SeatCell[];
  selected?: string | null;
  onSelect?: (seat: string) => void;
}

const LETTER_ORDER = ["A", "B", "C", "D", "E", "F"];

export function SeatMapGrid({ seats, selected, onSelect }: Props) {
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
            {rowSeats.map((s, i) => {
              const letter = s.seat.slice(3);
              const classes = [
                "seat",
                s.passenger_id ? "occupied" : "",
                s.seat === selected ? "selected" : "",
                s.exit_row ? "exit" : "",
                s.cabin_class === "J" ? "business" : "",
              ].filter(Boolean).join(" ");
              const showAisle = letter === "C"; // 3-3 narrow-body layout aisle after column C
              return (
                <Fragment key={s.seat}>
                  <span
                    className={classes}
                    title={s.passenger_id ? `${s.surname}/${s.given_name} (${s.record_locator})` : s.seat}
                    onClick={() => !s.passenger_id && onSelect?.(s.seat)}
                  >
                    {letter}
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
