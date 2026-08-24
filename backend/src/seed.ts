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

// aircraft_version is the cabin configuration code (seats per class); counts match
// the Business(C)/Economy(Y) rows this app's seat map actually generates — there's
// no Premium/W cabin in the seat map model, so it's omitted rather than faked.
const flights = [
  { flight_number: "1234", carrier_code: "SU", origin: "SVO", destination: "LED", std: isoInDays(0, 14), aircraft_type: "A320", aircraft_reg: "K0876", aircraft_version: "C18Y162" },
  { flight_number: "5678", carrier_code: "SU", origin: "SVO", destination: "IST", std: isoInDays(0, 18), aircraft_type: "B738", aircraft_reg: "K0654", aircraft_version: "C24Y168" },
];

const insertFlight = db.prepare(
  `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, aircraft_type, aircraft_reg, aircraft_version, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN')`
);
const insertSeat = db.prepare(`INSERT INTO seats (flight_id, seat, cabin_class, exit_row) VALUES (?, ?, ?, ?)`);
const insertPax = db.prepare(
  `INSERT INTO passengers (record_locator, flight_id, surname, given_name, ticket_number, ssr, infant, gender, dob, seat, bag_count, bag_weight_kg, checkin_status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const MALE_NAMES = ["PETR", "SERGEI", "ALEXEY", "DMITRY", "IVAN", "ANDREI", "NIKOLAI", "VLADIMIR", "MIKHAIL", "ALEXANDER", "OLEG", "PAVEL", "ROMAN", "IGOR", "YURI", "VIKTOR", "ANTON", "DENIS", "KIRILL", "ARTEM"];
const FEMALE_NAMES = ["ANNA", "OLGA", "EKATERINA", "MARIA", "ELENA", "NATALIA", "TATIANA", "IRINA", "SVETLANA", "YULIA", "GALINA", "LARISA", "VERA", "NADEZHDA", "LYUDMILA", "OKSANA", "POLINA", "DARIA", "KSENIA", "ALINA"];
const SURNAMES: [string, string][] = [
  ["IVANOV", "IVANOVA"], ["PETROV", "PETROVA"], ["SIDOROV", "SIDOROVA"], ["KUZNETSOV", "KUZNETSOVA"],
  ["SMIRNOV", "SMIRNOVA"], ["FEDOROV", "FEDOROVA"], ["MOROZOV", "MOROZOVA"], ["VASILIEV", "VASILIEVA"],
  ["SOKOLOV", "SOKOLOVA"], ["POPOV", "POPOVA"], ["VOLKOV", "VOLKOVA"], ["ALEXEEV", "ALEXEEVA"],
  ["LEBEDEV", "LEBEDEVA"], ["KOZLOV", "KOZLOVA"], ["NOVIKOV", "NOVIKOVA"], ["SOLOVIEV", "SOLOVIEVA"],
  ["ZAITSEV", "ZAITSEVA"], ["PAVLOV", "PAVLOVA"], ["SEMENOV", "SEMENOVA"], ["GOLUBEV", "GOLUBEVA"],
];
const SSR_POOL = ["WCHR", "VGML", "PETC", "EXST"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function randDob(minAge: number, maxAge: number): string {
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
  const year = new Date().getUTCFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface PaxSpec {
  gender: "M" | "F";
  category: "infant" | "child" | "adult";
  surname: string;
  givenName: string;
  dob: string;
  ssr: string[];
}

// Half women / half men; 4 infants and 10 children counted within that
// split (2F+2M infants, 5F+5M children, 43F+43M adults = 50/50 overall).
function buildRoster(): PaxSpec[] {
  const roster: PaxSpec[] = [];
  const plan: { gender: "M" | "F"; category: PaxSpec["category"]; count: number }[] = [
    { gender: "F", category: "infant", count: 2 },
    { gender: "M", category: "infant", count: 2 },
    { gender: "F", category: "child", count: 5 },
    { gender: "M", category: "child", count: 5 },
    { gender: "F", category: "adult", count: 43 },
    { gender: "M", category: "adult", count: 43 },
  ];
  for (const { gender, category, count } of plan) {
    for (let i = 0; i < count; i++) {
      const [maleSurname, femaleSurname] = pick(SURNAMES);
      const dob = category === "infant" ? randDob(0, 1) : category === "child" ? randDob(2, 11) : randDob(18, 70);
      roster.push({
        gender,
        category,
        surname: gender === "M" ? maleSurname : femaleSurname,
        givenName: pick(gender === "M" ? MALE_NAMES : FEMALE_NAMES),
        dob,
        ssr: category === "adult" && Math.random() < 0.15 ? [pick(SSR_POOL)] : [],
      });
    }
  }
  return shuffle(roster);
}

let locatorSeed = 100000;
function nextLocator(): string {
  locatorSeed += 7;
  return locatorSeed.toString(36).toUpperCase().padStart(6, "A");
}

const tx = db.transaction(() => {
  for (const f of flights) {
    const info = insertFlight.run(f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.aircraft_type, f.aircraft_reg, f.aircraft_version);
    const flightId = info.lastInsertRowid as number;
    const seatDefs = buildSeatMap(f.aircraft_type);
    for (const s of seatDefs) insertSeat.run(flightId, s.seat, s.cabinClass, s.exitRow ? 1 : 0);

    const roster = buildRoster();
    const infants = roster.filter((p) => p.category === "infant");
    const nonInfants = roster.filter((p) => p.category !== "infant");
    // Pair each infant with an adult travelling on the same PNR (see
    // PassengersTab.tsx's nested-row grouping, which keys off this).
    const guardians = shuffle(nonInfants.filter((p) => p.category === "adult")).slice(0, infants.length);

    // ~60% of seated (non-infant) passengers are checked in with a real
    // seat; the rest are still awaiting check-in, per the request that
    // some passengers have seats and some don't.
    const availableSeats = shuffle(seatDefs);
    const checkedInCount = Math.round(nonInfants.length * 0.6);
    const checkedInSet = new Set(shuffle(nonInfants).slice(0, checkedInCount));

    let seatCursor = 0;
    const locatorByGuardian = new Map(guardians.map((g) => [g, nextLocator()]));

    function insertOne(p: PaxSpec, locator: string) {
      const isCheckedIn = checkedInSet.has(p);
      const seat = isCheckedIn && p.category !== "infant" ? availableSeats[seatCursor++]?.seat ?? null : null;
      const info2 = insertPax.run(
        locator,
        flightId,
        p.surname,
        p.givenName,
        `555-${1000000000 + locatorSeed}`,
        JSON.stringify(p.category === "infant" ? [...p.ssr, "INFANT"] : p.ssr),
        p.category === "infant" ? 1 : 0,
        p.gender,
        p.dob,
        seat,
        seat ? (Math.random() < 0.8 ? 1 + Math.floor(Math.random() * 2) : 0) : 0,
        seat ? Math.round(Math.random() * 20 * 10) / 10 : 0,
        seat ? "CHECKED_IN" : "NOT_CHECKED_IN"
      );
      if (seat) db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(info2.lastInsertRowid, flightId, seat);
    }

    for (const g of guardians) insertOne(g, locatorByGuardian.get(g)!);
    for (const p of nonInfants) if (!guardians.includes(p)) insertOne(p, nextLocator());
    for (let i = 0; i < infants.length; i++) {
      const guardian = guardians[i % guardians.length];
      insertOne(infants[i], locatorByGuardian.get(guardian)!);
    }
  }
});
tx();

console.log(`Seeded ${flights.length} flights with 100 passengers each (50/50 gender, 4 infants, 10 children).`);
