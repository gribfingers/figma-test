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
  exitRows: number[];
  letters: string[];
}

export const AIRCRAFT_TEMPLATES: Record<string, AircraftTemplate> = {
  A320: {
    type: "A320",
    name: "Airbus A320",
    businessRows: [1, 2, 3],
    economyRows: Array.from({ length: 27 }, (_, i) => i + 4), // rows 4-30
    exitRows: [12, 13],
    letters: ["A", "B", "C", "D", "E", "F"],
  },
  B738: {
    type: "B738",
    name: "Boeing 737-800",
    businessRows: [1, 2, 3, 4],
    economyRows: Array.from({ length: 28 }, (_, i) => i + 5), // rows 5-32
    exitRows: [14, 15],
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
        exitRow: tpl.exitRows.includes(row),
      });
    }
  };
  for (const r of tpl.businessRows) addRow(r, "J");
  for (const r of tpl.economyRows) addRow(r, "Y");
  return seats;
}
