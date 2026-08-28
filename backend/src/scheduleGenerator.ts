import { db } from "./db";
import { buildSeatMap } from "./utils/seatmap";
import { encodeBcbp, PAX_STATUS } from "./bcbp";
import { toJulianDayOfYear } from "./utils/julian";

// Shared passenger-roster generator used both by the one-time seed script
// (seed.ts, a curated 3-flight demo set) and by the daily auto-scheduler
// below (dailyScheduler.ts) — same name pools, same infant/child/adult and
// checked-in/SSR/priority-list distributions, just parameterized by size
// instead of a fixed 100.

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
const LOCATOR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — same ambiguity rule real PNR locators follow

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickSsr(): string[] {
  const roll = Math.random();
  if (roll < 0.03) return shuffle(SSR_POOL).slice(0, 2); // occasionally more than one remark
  if (roll < 0.18) return [pick(SSR_POOL)];
  return [];
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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
// A future date (relative to today), same "YYYY-MM-DD" shape as randDob —
// used for document expiry, which isn't tied to the flight's own date.
function randFutureDate(minYears: number, maxYears: number): string {
  const years = minYears + Math.floor(Math.random() * (maxYears - minYears + 1));
  const year = new Date().getUTCFullYear() + years;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function randDocumentNumber(): string {
  return `${randInt(10, 99)}${randInt(1000000, 9999999)}`;
}
// Random rather than sequential — this now runs indefinitely (once a day,
// forever), so a process-lifetime counter would collide with locators
// generated in earlier runs/restarts. There's no UNIQUE constraint on
// record_locator or ticket_number, so a collision is cosmetic at worst,
// and 33^6 possibilities makes one vanishingly unlikely anyway.
function nextLocator(): string {
  return Array.from({ length: 6 }, () => LOCATOR_ALPHABET[Math.floor(Math.random() * LOCATOR_ALPHABET.length)]).join("");
}
function nextTicketNumber(): string {
  return `555-${1000000000 + Math.floor(Math.random() * 900000000)}`;
}

interface PaxSpec {
  gender: "M" | "F";
  category: "infant" | "child" | "adult";
  surname: string;
  givenName: string;
  dob: string;
  ssr: string[];
}

/**
 * Same ~4% infant / ~10% child / ~86% adult, 50/50 gender split seed.ts
 * always used for its fixed 100-seat rosters, generalized to any total
 * size so the daily generator's naturally-varying pax counts still land
 * on a realistic mix instead of a fixed head count.
 */
function buildRoster(size: number): PaxSpec[] {
  const infantCount = Math.max(0, Math.round(size * 0.04));
  const childCount = Math.max(0, Math.round(size * 0.1));
  const adultCount = Math.max(0, size - infantCount - childCount);
  const roster: PaxSpec[] = [];
  const plan: { gender: "M" | "F"; category: PaxSpec["category"]; count: number }[] = [
    { gender: "F", category: "infant", count: Math.round(infantCount / 2) },
    { gender: "M", category: "infant", count: infantCount - Math.round(infantCount / 2) },
    { gender: "F", category: "child", count: Math.round(childCount / 2) },
    { gender: "M", category: "child", count: childCount - Math.round(childCount / 2) },
    { gender: "F", category: "adult", count: Math.round(adultCount / 2) },
    { gender: "M", category: "adult", count: adultCount - Math.round(adultCount / 2) },
  ];
  for (const { gender, category, count } of plan) {
    for (let i = 0; i < count; i++) {
      const [maleSurname, femaleSurname] = pick(SURNAMES);
      const dob = category === "infant" ? randDob(0, 1) : category === "child" ? randDob(5, 14) : randDob(18, 70);
      roster.push({
        gender,
        category,
        surname: gender === "M" ? maleSurname : femaleSurname,
        givenName: pick(gender === "M" ? MALE_NAMES : FEMALE_NAMES),
        dob,
        ssr: category === "adult" ? pickSsr() : [],
      });
    }
  }
  return shuffle(roster);
}

const insertSeat = db.prepare(`INSERT INTO seats (flight_id, seat, cabin_class, exit_row) VALUES (?, ?, ?, ?)`);
const insertPax = db.prepare(
  `INSERT INTO passengers (record_locator, flight_id, surname, given_name, ticket_number, document_type, document_number, nationality, doc_expiry, ssr, infant, gender, dob, seat, bag_count, bag_weight_kg, checkin_status, checkin_sequence, bcbp, extra)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

function typeCode(p: PaxSpec): string {
  return p.category === "infant" ? "INF" : p.category === "child" ? "CHD" : "ADT";
}

export interface FlightForRoster {
  id: number;
  carrierCode: string;
  flightNumber: string;
  origin: string;
  destination: string;
  std: string;
  aircraftType: string;
}

/**
 * Builds this flight's seat map and a full roster of `rosterSize`
 * passengers (infants/children paired with an adult guardian on the same
 * PNR, ~60% pre-checked-in with a real seat, the rest still pending) — the
 * exact same generation seed.ts always ran inline, just callable per-flight
 * so the daily scheduler can reuse it without duplicating the logic.
 *
 * Checked-in passengers get a real bcbp (same encodeBcbp call the actual
 * check-in route makes) and a checkin_sequence, mirrored onto
 * flights.last_checkin_sequence — without it the boarding screen's "Board"
 * button (which scans the bcbp) silently no-ops for every generated
 * passenger, since it has nothing to scan.
 */
export function insertFlightWithRoster(flight: FlightForRoster, rosterSize: number): void {
  const seatDefs = buildSeatMap(flight.aircraftType);
  for (const s of seatDefs) insertSeat.run(flight.id, s.seat, s.cabinClass, s.exitRow ? 1 : 0);

  const roster = buildRoster(rosterSize);
  const infants = roster.filter((p) => p.category === "infant");
  const children = roster.filter((p) => p.category === "child");
  const adults = roster.filter((p) => p.category === "adult");
  const nonInfants = roster.filter((p) => p.category !== "infant");

  const infantGuardians = shuffle(adults).slice(0, infants.length);
  const childGuardians = shuffle(adults).slice(0, children.length);
  const locatorByGuardian = new Map<PaxSpec, string>();
  for (const g of new Set([...infantGuardians, ...childGuardians])) locatorByGuardian.set(g, nextLocator());

  const availableSeats = shuffle(seatDefs);
  const checkedInCount = Math.round(nonInfants.length * 0.6);
  const checkedInSet = new Set(shuffle(nonInfants).slice(0, checkedInCount));
  const seatByCode = new Map(seatDefs.map((s) => [s.seat, s]));
  const julianDate = toJulianDayOfYear(flight.std);

  let seatCursor = 0;
  let sequenceCursor = 0;

  function insertOne(p: PaxSpec, locator: string) {
    const isCheckedIn = checkedInSet.has(p);
    const seat = isCheckedIn && p.category !== "infant" ? availableSeats[seatCursor++]?.seat ?? null : null;
    let checkinSequence: number | null = null;
    let bcbp: string | null = null;
    if (seat) {
      checkinSequence = ++sequenceCursor;
      bcbp = encodeBcbp({
        surname: p.surname,
        givenName: p.givenName,
        eTicket: true,
        pnrCode: locator,
        fromAirport: flight.origin,
        toAirport: flight.destination,
        carrierCode: flight.carrierCode,
        flightNumber: flight.flightNumber,
        julianDate,
        compartment: seatByCode.get(seat)?.cabinClass ?? "Y",
        seat,
        checkInSequence: String(checkinSequence),
        paxStatus: PAX_STATUS.CHECKED_IN,
      });
    }
    const info = insertPax.run(
      locator,
      flight.id,
      p.surname,
      p.givenName,
      nextTicketNumber(),
      "P",
      randDocumentNumber(),
      "RU",
      randFutureDate(1, 9),
      JSON.stringify(p.category === "infant" ? [...p.ssr, "INFANT"] : p.ssr),
      p.category === "infant" ? 1 : 0,
      p.gender,
      p.dob,
      seat,
      seat ? (Math.random() < 0.8 ? 1 + Math.floor(Math.random() * 2) : 0) : 0,
      seat ? Math.round(Math.random() * 20 * 10) / 10 : 0,
      seat ? "CHECKED_IN" : "NOT_CHECKED_IN",
      checkinSequence,
      bcbp,
      JSON.stringify({
        type: typeCode(p),
        wl: p.category !== "infant" && Math.random() < 0.06,
        pl: p.category !== "infant" && Math.random() < 0.05,
      })
    );
    if (seat) db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(info.lastInsertRowid, flight.id, seat);
  }

  for (const a of adults) insertOne(a, locatorByGuardian.get(a) ?? nextLocator());
  for (let i = 0; i < children.length; i++) {
    const guardian = childGuardians[i % childGuardians.length];
    insertOne(children[i], locatorByGuardian.get(guardian)!);
  }
  for (let i = 0; i < infants.length; i++) {
    const guardian = infantGuardians[i % infantGuardians.length];
    insertOne(infants[i], locatorByGuardian.get(guardian)!);
  }

  if (sequenceCursor > 0) db.prepare("UPDATE flights SET last_checkin_sequence = ? WHERE id = ?").run(sequenceCursor, flight.id);
}

// ---- Daily auto-generated schedule (see dailyScheduler.ts) ----

interface FlightTemplate {
  flightNumber: string;
  carrierCode: string;
  origin: string;
  destination: string;
  hourUtc: number;
  aircraftType: string;
  aircraftReg: string;
  aircraftVersion: string;
  /**
   * Intermediate stop(s) between origin and destination — when present, this
   * becomes a genuine multi-segment flight: one flights row (whose own
   * origin/destination/std/sta are the FIRST leg only), with the remaining
   * legs stored in extra.segments the same way FlightCard's Main tab saves
   * them (see buildSegmentChain below and Flight.extra.segments in
   * flightSegments.ts). Same aircraft flies the whole routing (a through-flight).
   */
  stops?: string[];
}

// Same 5 flight numbers/times recur every generated day, same as a real
// airline's published schedule would (SU1234 flies SVO-LED daily, etc.) —
// kept as the "headline" flights other parts of the app (and manual
// testing) already know by number.
const HEADLINE_TEMPLATES: FlightTemplate[] = [
  { flightNumber: "1234", carrierCode: "SU", origin: "SVO", destination: "LED", hourUtc: 7, aircraftType: "A320", aircraftReg: "K0876", aircraftVersion: "C18Y162" },
  { flightNumber: "5678", carrierCode: "SU", origin: "SVO", destination: "IST", hourUtc: 10, aircraftType: "B738", aircraftReg: "K0654", aircraftVersion: "C24Y168" },
  { flightNumber: "9012", carrierCode: "SU", origin: "SVX", destination: "DME", hourUtc: 13, aircraftType: "A320", aircraftReg: "K0932", aircraftVersion: "C18Y162", stops: ["LED"] },
  { flightNumber: "7777", carrierCode: "SU", origin: "LED", destination: "SVO", hourUtc: 16, aircraftType: "A320", aircraftReg: "K0741", aircraftVersion: "C18Y162" },
  { flightNumber: "2468", carrierCode: "SU", origin: "SVO", destination: "AER", hourUtc: 19, aircraftType: "B738", aircraftReg: "K0512", aircraftVersion: "C24Y168", stops: ["KZN"] },
];

// Per FLIGHT_PHASES (frontend/src/flightPhase.ts), Check-in is a 135-minute
// window before std but Boarding is only 30 minutes — the tighter one sets
// the bar. With the 5 headline flights alone (3h apart), most of the day has
// no flight boarding or checking in at all. Filling every other half-hour
// slot with a filler flight (cycling through the same 5 route/aircraft
// profiles under a new flight number) makes consecutive boarding windows
// touch exactly (see buildSegmentChain's std math), so at any moment of the
// day — not just these 5 windows — at least one flight is boarding and at
// least one is checking in.
const FILLER_SLOT_MINUTES = 30;
const FILLER_FLIGHT_NUMBER_START = 3001;

function buildDailyFlightTemplates(): FlightTemplate[] {
  const templates = [...HEADLINE_TEMPLATES];
  const occupiedMinutes = new Set(HEADLINE_TEMPLATES.map((t) => Math.round(t.hourUtc * 60)));
  let fillerNumber = FILLER_FLIGHT_NUMBER_START;
  let profileIdx = 0;
  for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += FILLER_SLOT_MINUTES) {
    if (occupiedMinutes.has(minuteOfDay)) continue;
    const { flightNumber: _flightNumber, hourUtc: _hourUtc, ...profile } = HEADLINE_TEMPLATES[profileIdx % HEADLINE_TEMPLATES.length];
    profileIdx++;
    templates.push({ ...profile, flightNumber: String(fillerNumber++), hourUtc: minuteOfDay / 60 });
  }
  return templates;
}

const DAILY_FLIGHT_TEMPLATES: FlightTemplate[] = buildDailyFlightTemplates();

// Rough, distance-agnostic per-leg timing for chaining a multi-stop
// itinerary's departure/arrival times — good enough for demo data, not a
// real flight-planning model.
const LEG_DURATION_MIN = 95;
const GROUND_TIME_MIN = 55;

interface SegmentChain {
  /** First leg's own std/sta — these go on the flights row itself. */
  std: string;
  sta: string;
  /** extra.segments value, same shape FlightCard's Main tab writes — omitted (undefined) for a nonstop template. */
  segmentsExtra?: unknown[];
}

/** Builds a template's leg-by-leg std/sta chain, in the storage shape flightSegments.ts expects. */
function buildSegmentChain(tmpl: FlightTemplate, dayStart: Date): SegmentChain {
  const path = [tmpl.origin, ...(tmpl.stops ?? []), tmpl.destination];
  const legCount = path.length - 1;
  const legStd = (legIndex: number) => isoAtOffset(dayStart, tmpl.hourUtc * 60 + legIndex * (LEG_DURATION_MIN + GROUND_TIME_MIN));
  const legSta = (legIndex: number) => isoAtOffset(dayStart, tmpl.hourUtc * 60 + legIndex * (LEG_DURATION_MIN + GROUND_TIME_MIN) + LEG_DURATION_MIN);
  if (legCount <= 1) return { std: legStd(0), sta: legSta(0) };
  const segmentsExtra: unknown[] = [{ terminalTo: "", checkinDesk: "" }];
  for (let leg = 1; leg < legCount; leg++) {
    segmentsExtra.push({
      origin: path[leg],
      destination: path[leg + 1],
      std: legStd(leg),
      sta: legSta(leg),
      terminalFrom: "",
      terminalTo: "",
      aircraftType: tmpl.aircraftType,
      checkinDesk: "",
      gate: "",
      acReg: tmpl.aircraftReg,
      seatConfig: tmpl.aircraftVersion,
    });
  }
  return { std: legStd(0), sta: legSta(0), segmentsExtra };
}

const ROSTER_SIZE_RANGE: [number, number] = [50, 130];
// Marks a flight as belonging to this generator (as opposed to the curated
// seed.ts demo flights or one an agent created by hand) — stored in `extra`
// since there's no dedicated column, and used by hasScheduleForDay to stay
// idempotent if the scheduler fires twice for the same day.
const AUTO_GENERATED_MARKER = "dailyAutoGenerated";

function dayStartUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function isoAtOffset(dayStart: Date, minutesFromMidnight: number): string {
  return new Date(dayStart.getTime() + minutesFromMidnight * 60000).toISOString();
}

const insertFlight = db.prepare(
  `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, sta, aircraft_type, aircraft_reg, aircraft_version, status, extra)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`
);

/** Whether an auto-generated schedule already exists for the UTC calendar day `date` falls in. */
export function hasScheduleForDay(date: Date): boolean {
  const start = dayStartUtc(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM flights WHERE std >= ? AND std < ? AND extra LIKE ?`)
    .get(start.toISOString(), end.toISOString(), `%"${AUTO_GENERATED_MARKER}":true%`) as { c: number };
  return row.c > 0;
}

/**
 * Generates one day's worth of flights + rosters for the UTC calendar day
 * `date` falls in, unless one's already there (hasScheduleForDay). Returns
 * how much it created — {flights: 0, passengers: 0} means it was a no-op.
 */
export function generateDailySchedule(date: Date): { flights: number; passengers: number } {
  if (hasScheduleForDay(date)) return { flights: 0, passengers: 0 };

  const dayStart = dayStartUtc(date);
  let passengerTotal = 0;

  const tx = db.transaction(() => {
    for (const tmpl of DAILY_FLIGHT_TEMPLATES) {
      const chain = buildSegmentChain(tmpl, dayStart);
      const std = chain.std;
      // The flights row's own origin/destination are leg 0 only (e.g. SVX→LED
      // for a SVX-LED-DME routing) — any further stops live in extra.segments,
      // same convention flightSegments.ts/FlightCard's Main tab use.
      const rowDestination = tmpl.stops?.length ? tmpl.stops[0] : tmpl.destination;
      const extra: Record<string, unknown> = { [AUTO_GENERATED_MARKER]: true };
      if (chain.segmentsExtra) extra.segments = chain.segmentsExtra;
      const info = insertFlight.run(
        tmpl.flightNumber,
        tmpl.carrierCode,
        tmpl.origin,
        rowDestination,
        std,
        chain.sta,
        tmpl.aircraftType,
        tmpl.aircraftReg,
        tmpl.aircraftVersion,
        JSON.stringify(extra)
      );
      const flightId = info.lastInsertRowid as number;
      const rosterSize = randInt(ROSTER_SIZE_RANGE[0], ROSTER_SIZE_RANGE[1]);
      insertFlightWithRoster(
        {
          id: flightId,
          carrierCode: tmpl.carrierCode,
          flightNumber: tmpl.flightNumber,
          origin: tmpl.origin,
          destination: rowDestination,
          std,
          aircraftType: tmpl.aircraftType,
        },
        rosterSize
      );
      passengerTotal += rosterSize;
    }
  });
  tx();

  return { flights: DAILY_FLIGHT_TEMPLATES.length, passengers: passengerTotal };
}

interface BackfillRow {
  pid: number;
  surname: string;
  given_name: string;
  record_locator: string;
  seat: string;
  flight_id: number;
  origin: string;
  destination: string;
  carrier_code: string;
  flight_number: string;
  std: string;
  last_checkin_sequence: number;
  cabin_class: string | null;
}

/**
 * One-time-per-boot cleanup for passengers that ended up checked in (seat +
 * CHECKED_IN) without a bcbp — anything inserted before bcbp/checkin_sequence
 * generation existed here, whether from an old seed run or hand-written
 * data. Without a bcbp, the boarding screen's "Board" button (which scans
 * it) silently no-ops, so this backfills both fields the same way
 * insertFlightWithRoster does for newly-generated passengers, and brings
 * each affected flight's last_checkin_sequence in line.
 */
export function backfillMissingBcbp(): { updated: number } {
  const rows = db
    .prepare(
      `SELECT p.id as pid, p.surname, p.given_name, p.record_locator, p.seat,
              f.id as flight_id, f.origin, f.destination, f.carrier_code, f.flight_number, f.std, f.last_checkin_sequence,
              s.cabin_class
       FROM passengers p
       JOIN flights f ON f.id = p.flight_id
       LEFT JOIN seats s ON s.flight_id = p.flight_id AND s.seat = p.seat
       WHERE p.checkin_status = 'CHECKED_IN' AND p.bcbp IS NULL AND p.seat IS NOT NULL
       ORDER BY f.id, p.id`
    )
    .all() as BackfillRow[];

  if (rows.length === 0) return { updated: 0 };

  const updatePax = db.prepare("UPDATE passengers SET checkin_sequence = ?, bcbp = ? WHERE id = ?");
  const updateFlightSeq = db.prepare("UPDATE flights SET last_checkin_sequence = ? WHERE id = ?");

  const tx = db.transaction(() => {
    let currentFlightId: number | null = null;
    let sequenceCursor = 0;
    for (const row of rows) {
      if (row.flight_id !== currentFlightId) {
        if (currentFlightId !== null) updateFlightSeq.run(sequenceCursor, currentFlightId);
        currentFlightId = row.flight_id;
        sequenceCursor = row.last_checkin_sequence;
      }
      sequenceCursor++;
      const bcbp = encodeBcbp({
        surname: row.surname,
        givenName: row.given_name,
        eTicket: true,
        pnrCode: row.record_locator,
        fromAirport: row.origin,
        toAirport: row.destination,
        carrierCode: row.carrier_code,
        flightNumber: row.flight_number,
        julianDate: toJulianDayOfYear(row.std),
        compartment: row.cabin_class ?? "Y",
        seat: row.seat,
        checkInSequence: String(sequenceCursor),
        paxStatus: PAX_STATUS.CHECKED_IN,
      });
      updatePax.run(sequenceCursor, bcbp, row.pid);
    }
    if (currentFlightId !== null) updateFlightSeq.run(sequenceCursor, currentFlightId);
  });
  tx();

  return { updated: rows.length };
}
