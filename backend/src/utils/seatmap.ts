/**
 * Simplified aircraft seat map templates. Letter sets follow common IATA
 * carrier convention of skipping "I" (confusable with 1) — some aircraft
 * also skip other letters; this is a demo subset, not a certified
 * type-config database (that would come from the airline's AHM/aircraft
 * config tables).
 */
export interface SeatDef {
  seat: string; // e.g. "012A"
  row: number;
  letter: string;
  cabinClass: "J" | "Y";
  exitRow: boolean;
}

export interface AircraftTemplate {
  type: string;
  name: string;
  businessRows: number[];
  economyRows: number[];
  letters: string[];
}

export const AIRCRAFT_TEMPLATES: Record<string, AircraftTemplate> = {
  A320: {
    type: "A320",
    name: "Airbus A320",
    businessRows: [1, 2, 3],
    economyRows: Array.from({ length: 27 }, (_, i) => i + 4), // rows 4-30
    letters: ["A", "B", "C", "D", "E", "F"],
  },
  B738: {
    type: "B738",
    name: "Boeing 737-800",
    businessRows: [1, 2, 3, 4],
    economyRows: Array.from({ length: 28 }, (_, i) => i + 5), // rows 5-32
    letters: ["A", "B", "C", "D", "E", "F"],
  },
  A321: {
    type: "A321",
    name: "Airbus A321",
    businessRows: [1, 2, 3, 4],
    economyRows: Array.from({ length: 29 }, (_, i) => i + 5), // rows 5-33
    letters: ["A", "B", "C", "D", "E", "F"],
  },
  // A330 is a widebody (2-4-2 economy, twin aisle) — this app's seat map model
  // is single-aisle 6-abreast only, so it's represented with the same
  // simplified A-F layout as the narrow-bodies above rather than a real
  // twin-aisle grid. See the file-level note.
  A330: {
    type: "A330",
    name: "Airbus A330",
    businessRows: [1, 2, 3, 4, 5, 6],
    economyRows: Array.from({ length: 33 }, (_, i) => i + 7), // rows 7-39
    letters: ["A", "B", "C", "D", "E", "F"],
  },
};

export function buildSeatMap(aircraftType: string): SeatDef[] {
  const tpl = AIRCRAFT_TEMPLATES[aircraftType];
  if (!tpl) throw new Error(`Unknown aircraft type: ${aircraftType}`);
  const seats: SeatDef[] = [];
  const addRow = (row: number, cabinClass: "J" | "Y") => {
    for (const letter of tpl.letters) {
      seats.push({
        seat: `${String(row).padStart(3, "0")}${letter}`,
        row,
        letter,
        cabinClass,
        // Exit doors are drawn on the frontend as seatless structural rows
        // (frontend/src/cabinLayout.ts) rather than derived from real seats,
        // so no seat is auto-flagged exit here — exit_row stays a manual,
        // per-seat, agent-editable attribute (see the seat editor).
        exitRow: false,
      });
    }
  };
  for (const r of tpl.businessRows) addRow(r, "J");
  for (const r of tpl.economyRows) addRow(r, "Y");
  return seats;
}
