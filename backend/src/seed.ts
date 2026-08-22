import { db } from "./db";
import { buildSeatMap } from "./utils/seatmap";

const existing = db.prepare("SELECT COUNT(*) as c FROM flights").get() as { c: number };
if (existing.c > 0) {
  console.log("Database already has flights — skipping seed. Delete data.sqlite3 to reseed.");
  process.exit(0);
}

function isoInDays(days: number, hour: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const flights = [
  { flight_number: "1234", carrier_code: "SU", origin: "SVO", destination: "LED", std: isoInDays(0, 14), aircraft_type: "A320" },
  { flight_number: "5678", carrier_code: "SU", origin: "SVO", destination: "IST", std: isoInDays(0, 18), aircraft_type: "B738" },
];

const insertFlight = db.prepare(
  `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, aircraft_type, status)
   VALUES (?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN')`
);
const insertSeat = db.prepare(`INSERT INTO seats (flight_id, seat, cabin_class, exit_row) VALUES (?, ?, ?, ?)`);
const insertPax = db.prepare(
  `INSERT INTO passengers (record_locator, flight_id, surname, given_name, ticket_number, ssr, infant)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const samplePax = [
  { surname: "IVANOV", given_name: "PETR", ssr: [] as string[], infant: 0 },
  { surname: "SIDOROVA", given_name: "ANNA", ssr: ["VGML"], infant: 0 },
  { surname: "PETROV", given_name: "SERGEI", ssr: [], infant: 0 },
  { surname: "KUZNETSOVA", given_name: "OLGA", ssr: ["WCHR"], infant: 0 },
  { surname: "SMIRNOV", given_name: "DMITRY", ssr: [], infant: 0 },
  { surname: "VASILIEVA", given_name: "MARIA", ssr: ["INFANT"], infant: 1 },
  { surname: "FEDOROV", given_name: "ALEXEY", ssr: [], infant: 0 },
  { surname: "MOROZOVA", given_name: "EKATERINA", ssr: [], infant: 0 },
];

let locatorSeed = 100000;
const tx = db.transaction(() => {
  for (const f of flights) {
    const info = insertFlight.run(f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.aircraft_type);
    const flightId = info.lastInsertRowid as number;
    for (const s of buildSeatMap(f.aircraft_type)) {
      insertSeat.run(flightId, s.seat, s.cabinClass, s.exitRow ? 1 : 0);
    }
    for (const p of samplePax) {
      locatorSeed += 7;
      const locator = locatorSeed.toString(36).toUpperCase().padStart(6, "A");
      insertPax.run(locator, flightId, p.surname, p.given_name, `555-${1000000000 + locatorSeed}`, JSON.stringify(p.ssr), p.infant);
    }
  }
});
tx();

console.log(`Seeded ${flights.length} flights with ${samplePax.length} passengers each.`);
