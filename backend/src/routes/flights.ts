import { Router } from "express";
import { db } from "../db";
import { buildSeatMap } from "../utils/seatmap";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";

export const flightsRouter = Router();

flightsRouter.get("/", (_req, res) => {
  const flights = db.prepare("SELECT * FROM flights ORDER BY std").all();
  res.json(flights);
});

flightsRouter.post("/", (req, res) => {
  const {
    flight_number,
    carrier_code,
    origin,
    destination,
    std,
    aircraft_type,
    terminal,
    gate,
    aircraft_reg,
    aircraft_version,
    etd,
    sta,
    ata,
    ops_status,
  } = req.body;
  if (!flight_number || !carrier_code || !origin || !destination || !std || !aircraft_type) {
    return res.status(400).json({ error: "flight_number, carrier_code, origin, destination, std, aircraft_type are required" });
  }
  let seatDefs;
  try {
    seatDefs = buildSeatMap(aircraft_type);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const insertFlight = db.prepare(
    `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, aircraft_type, status,
       terminal, gate, aircraft_reg, aircraft_version, etd, sta, ata, ops_status)
     VALUES (?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const info = insertFlight.run(
    flight_number,
    carrier_code.toUpperCase(),
    origin.toUpperCase(),
    destination.toUpperCase(),
    std,
    aircraft_type,
    terminal ?? null,
    gate ?? null,
    aircraft_reg ?? null,
    aircraft_version ?? null,
    etd ?? std,
    sta ?? null,
    ata ?? null,
    ops_status ?? "SCHEDULED"
  );
  const flightId = info.lastInsertRowid as number;

  const insertSeat = db.prepare(
    `INSERT INTO seats (flight_id, seat, cabin_class, exit_row) VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const s of seatDefs) insertSeat.run(flightId, s.seat, s.cabinClass, s.exitRow ? 1 : 0);
  });
  tx();

  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(flightId);
  res.status(201).json(flight);
});

flightsRouter.get("/:id", (req, res) => {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.id) as Flight | undefined;
  if (!flight) return res.status(404).json({ error: "Flight not found" });
  res.json(flight);
});

/** Update FIDS-board fields (route, terminal, gate, ops status, ETD/STA/ATA, aircraft reg/version/type, extra). */
flightsRouter.patch("/:id", (req, res) => {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.id) as Flight | undefined;
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const { origin, destination, std, terminal, gate, aircraft_reg, aircraft_version, etd, sta, ata, ops_status, aircraft_type, extra } = req.body;

  // Changing aircraft_type regenerates the seat map, which would orphan any
  // passenger already holding an assigned seat — refuse rather than corrupt it.
  if (aircraft_type && aircraft_type !== flight.aircraft_type) {
    let seatDefs;
    try {
      seatDefs = buildSeatMap(aircraft_type);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
    const { c: occupied } = db
      .prepare("SELECT COUNT(*) as c FROM passengers WHERE flight_id = ? AND seat IS NOT NULL")
      .get(req.params.id) as { c: number };
    if (occupied > 0) {
      return res.status(409).json({
        error: `Cannot change aircraft type: ${occupied} passenger(s) already have an assigned seat on this flight.`,
      });
    }
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM seats WHERE flight_id = ?").run(req.params.id);
      const insertSeat = db.prepare(`INSERT INTO seats (flight_id, seat, cabin_class, exit_row) VALUES (?, ?, ?, ?)`);
      for (const s of seatDefs) insertSeat.run(req.params.id, s.seat, s.cabinClass, s.exitRow ? 1 : 0);
      db.prepare("UPDATE flights SET aircraft_type = ? WHERE id = ?").run(aircraft_type, req.params.id);
    });
    tx();
  }

  db.prepare(
    `UPDATE flights SET
       origin = COALESCE(?, origin),
       destination = COALESCE(?, destination),
       std = COALESCE(?, std),
       terminal = COALESCE(?, terminal),
       gate = COALESCE(?, gate),
       aircraft_reg = COALESCE(?, aircraft_reg),
       aircraft_version = COALESCE(?, aircraft_version),
       etd = COALESCE(?, etd),
       sta = COALESCE(?, sta),
       ata = COALESCE(?, ata),
       ops_status = COALESCE(?, ops_status),
       extra = COALESCE(?, extra)
     WHERE id = ?`
  ).run(
    origin ? String(origin).toUpperCase() : null,
    destination ? String(destination).toUpperCase() : null,
    std ?? null,
    terminal ?? null,
    gate ?? null,
    aircraft_reg ?? null,
    aircraft_version ?? null,
    etd ?? null,
    sta ?? null,
    ata ?? null,
    ops_status ?? null,
    // Sent pre-serialized by the client (it already models `extra` as the
    // stored JSON string) — stored verbatim, not re-stringified.
    extra !== undefined ? extra : null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.id);
  res.json(updated);
});

flightsRouter.get("/:id/seatmap", (req, res) => {
  const seats = db
    .prepare(
      `SELECT s.seat, s.cabin_class, s.exit_row, s.passenger_id,
              p.surname, p.given_name, p.record_locator
       FROM seats s LEFT JOIN passengers p ON p.id = s.passenger_id
       WHERE s.flight_id = ? ORDER BY s.seat`
    )
    .all(req.params.id);
  res.json(seats);
});

flightsRouter.get("/:id/passengers", (req, res) => {
  const q = String(req.query.q ?? "").trim().toUpperCase();
  let rows: Passenger[];
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM passengers WHERE flight_id = ?
         AND (UPPER(surname) LIKE ? OR UPPER(record_locator) = ?)
         ORDER BY checkin_sequence IS NULL, checkin_sequence, surname`
      )
      .all(req.params.id, `%${q}%`, q) as Passenger[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM passengers WHERE flight_id = ? ORDER BY checkin_sequence IS NULL, checkin_sequence, surname`
      )
      .all(req.params.id) as Passenger[];
  }
  res.json(rows.map(serializePassenger));
});

function randomLocator(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

flightsRouter.post("/:id/passengers", (req, res) => {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.id) as Flight | undefined;
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const { surname, given_name, ticket_number, ssr, infant, gender, dob, record_locator } = req.body;
  if (!surname || !given_name || !ticket_number) {
    return res.status(400).json({ error: "surname, given_name, ticket_number are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO passengers (record_locator, flight_id, surname, given_name, ticket_number, ssr, infant, gender, dob)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      (record_locator || randomLocator()).toUpperCase(),
      flight.id,
      surname.toUpperCase(),
      given_name.toUpperCase(),
      ticket_number,
      JSON.stringify(ssr ?? []),
      infant ? 1 : 0,
      gender === "M" || gender === "F" ? gender : null,
      dob || null
    );

  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(info.lastInsertRowid) as Passenger;
  res.status(201).json(serializePassenger(passenger));
});

/** General passenger-record edit (surname/given_name/gender/dob/infant/ssr/record_locator) — for the passenger admin page, distinct from the seat/document fields the check-in flow (routes/checkin.ts) owns. */
flightsRouter.patch("/:flightId/passengers/:passengerId", (req, res) => {
  const passenger = db
    .prepare("SELECT * FROM passengers WHERE id = ? AND flight_id = ?")
    .get(req.params.passengerId, req.params.flightId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });

  const { surname, given_name, record_locator, gender, dob, infant, ssr } = req.body;
  db.prepare(
    `UPDATE passengers SET
       surname = COALESCE(?, surname),
       given_name = COALESCE(?, given_name),
       record_locator = COALESCE(?, record_locator),
       gender = COALESCE(?, gender),
       dob = COALESCE(?, dob),
       infant = COALESCE(?, infant),
       ssr = COALESCE(?, ssr)
     WHERE id = ?`
  ).run(
    surname ? surname.toUpperCase() : null,
    given_name ? given_name.toUpperCase() : null,
    record_locator ? record_locator.toUpperCase() : null,
    gender === "M" || gender === "F" ? gender : null,
    dob ?? null,
    infant !== undefined ? (infant ? 1 : 0) : null,
    ssr !== undefined ? JSON.stringify(ssr) : null,
    req.params.passengerId
  );

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger;
  res.json(serializePassenger(updated));
});

flightsRouter.delete("/:flightId/passengers/:passengerId", (req, res) => {
  const passenger = db
    .prepare("SELECT * FROM passengers WHERE id = ? AND flight_id = ?")
    .get(req.params.passengerId, req.params.flightId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });

  const tx = db.transaction(() => {
    db.prepare("UPDATE seats SET passenger_id = NULL WHERE passenger_id = ?").run(passenger.id);
    db.prepare("DELETE FROM passengers WHERE id = ?").run(passenger.id);
  });
  tx();
  res.status(204).end();
});
