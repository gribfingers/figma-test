import { db } from "./db";
import { ensureSuperadmin } from "./bootstrapAdmin";
import { insertFlightWithRoster } from "./scheduleGenerator";

// Also done unconditionally on every server start (index.ts) — repeated
// here so running this script directly against a fresh database still
// gets you a login even before the server has ever started.
ensureSuperadmin();

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

// aircraft_version is the cabin configuration code (seats per class); counts match
// the Business(C)/Economy(Y) rows this app's seat map actually generates — there's
// no Premium/W cabin in the seat map model, so it's omitted rather than faked.
// The third flight is a real multi-stop routing (SVX-DME-LED, two segments)
// so the check-in flow's segment toggle and the flights board's collapsed
// "SVO → ... → VVO" route label have something to show without anyone
// having to hand-build one through the Main tab first.
const MULTI_SEGMENT_EXTRA = JSON.stringify({
  segments: [
    { terminalTo: "" },
    { origin: "DME", destination: "LED", std: isoInDays(0, 12), sta: isoInDays(0, 13), terminalFrom: "", terminalTo: "" },
  ],
});

const flights = [
  { flight_number: "1234", carrier_code: "SU", origin: "SVO", destination: "LED", std: isoInDays(0, 14), aircraft_type: "A320", aircraft_reg: "K0876", aircraft_version: "C18Y162" },
  { flight_number: "5678", carrier_code: "SU", origin: "SVO", destination: "IST", std: isoInDays(0, 18), aircraft_type: "B738", aircraft_reg: "K0654", aircraft_version: "C24Y168" },
  { flight_number: "9012", carrier_code: "SU", origin: "SVX", destination: "DME", std: isoInDays(0, 10), aircraft_type: "A320", aircraft_reg: "K0932", aircraft_version: "C18Y162", extra: MULTI_SEGMENT_EXTRA },
];

const insertFlight = db.prepare(
  `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, aircraft_type, aircraft_reg, aircraft_version, status, extra)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN', ?)`
);

const tx = db.transaction(() => {
  for (const f of flights) {
    const info = insertFlight.run(f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.aircraft_type, f.aircraft_reg, f.aircraft_version, (f as { extra?: string }).extra ?? null);
    const flightId = info.lastInsertRowid as number;
    insertFlightWithRoster(flightId, f.aircraft_type, 100);
  }
});
tx();

console.log(`Seeded ${flights.length} flights with 100 passengers each (50/50 gender, 4 infants, 10 children).`);
