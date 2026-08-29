import { Router } from "express";
import { db } from "../db";
import { buildSeatMap } from "../utils/seatmap";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";
import { requireEdit } from "../middleware/auth";
import { getSeatHistory, logSeatEvent } from "../seatHistory";

export const flightsRouter = Router();

flightsRouter.get("/", (_req, res) => {
  const flights = db.prepare("SELECT * FROM flights ORDER BY std").all();
  res.json(flights);
});

flightsRouter.post("/", requireEdit, (req, res) => {
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
    extra,
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
       terminal, gate, aircraft_reg, aircraft_version, etd, sta, ata, ops_status, extra)
     VALUES (?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    ops_status ?? "SCHEDULED",
    extra ?? null
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
flightsRouter.patch("/:id", requireEdit, (req, res) => {
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
      `SELECT s.seat, s.cabin_class, s.exit_row, s.passenger_id, s.extra,
              p.surname, p.given_name, p.record_locator, p.boarding_status, p.dob
       FROM seats s LEFT JOIN passengers p ON p.id = s.passenger_id
       WHERE s.flight_id = ? ORDER BY s.seat`
    )
    .all(req.params.id);
  res.json(seats);
});

/** Seat-map editor: assign exit-row/blocking/service/pricing attributes to one seat (seatExtra.ts on the frontend defines the shape). */
flightsRouter.patch("/:flightId/seats/:seat", requireEdit, (req, res) => {
  const row = db
    .prepare("SELECT * FROM seats WHERE flight_id = ? AND seat = ?")
    .get(req.params.flightId, req.params.seat) as { exit_row: number; extra: string | null } | undefined;
  if (!row) return res.status(404).json({ error: "Seat not found" });

  const { exit_row, extra } = req.body;
  db.prepare(
    `UPDATE seats SET
       exit_row = COALESCE(?, exit_row),
       extra = COALESCE(?, extra)
     WHERE flight_id = ? AND seat = ?`
  ).run(
    exit_row !== undefined ? (exit_row ? 1 : 0) : null,
    extra !== undefined ? extra : null,
    req.params.flightId,
    req.params.seat
  );

  const changes: string[] = [];
  if (exit_row !== undefined && !!exit_row !== !!row.exit_row) changes.push(exit_row ? "+exit row" : "-exit row");
  if (extra !== undefined) {
    let before: Record<string, unknown> = {};
    let after: Record<string, unknown> = {};
    try {
      before = row.extra ? JSON.parse(row.extra) : {};
    } catch {
      before = {};
    }
    try {
      after = JSON.parse(extra);
    } catch {
      after = {};
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const b = before[key];
      const a = after[key];
      if (b === a || (b == null && a == null)) continue;
      if (a == null || a === false) changes.push(`-${key}`);
      else if (b == null || b === false) changes.push(`+${key}`);
      else changes.push(`${key}: ${b} → ${a}`);
    }
  }
  if (changes.length) {
    logSeatEvent(Number(req.params.flightId), req.params.seat, "attrs_updated", changes.join(", "), req.user?.id ?? null);
  }

  const updated = db
    .prepare(
      `SELECT s.seat, s.cabin_class, s.exit_row, s.passenger_id, s.extra,
              p.surname, p.given_name, p.record_locator, p.boarding_status
       FROM seats s LEFT JOIN passengers p ON p.id = s.passenger_id
       WHERE s.flight_id = ? AND s.seat = ?`
    )
    .get(req.params.flightId, req.params.seat);
  res.json(updated);
});

/** History popup on the seat map's right-click menu — every recorded state change for one seat. */
flightsRouter.get("/:flightId/seats/:seat/history", (req, res) => {
  res.json(getSeatHistory(Number(req.params.flightId), req.params.seat));
});

// Search field for the "Add pax" bar's mode tabs (Last Name/PNR/E-ticket/Doc) — same columns as
// checkin.ts's cross-flight SEARCH_COLUMN, but scoped to this one flight via the query below.
const PASSENGER_SEARCH_COLUMN: Record<string, string> = {
  surname: "surname",
  pnr: "record_locator",
  eticket: "ticket_number",
  doc: "document_number",
};

flightsRouter.get("/:id/passengers", (req, res) => {
  const q = String(req.query.q ?? "").trim().toUpperCase();
  const by = String(req.query.by ?? "");
  let rows: Passenger[];
  if (q && by) {
    const column = PASSENGER_SEARCH_COLUMN[by];
    if (!column) return res.status(400).json({ error: `Unknown search field: ${by}` });
    const exact = by === "pnr" || by === "eticket";
    rows = db
      .prepare(
        `SELECT * FROM passengers WHERE flight_id = ?
         AND UPPER(${column}) ${exact ? "= ?" : "LIKE ?"}
         ORDER BY checkin_sequence IS NULL, checkin_sequence, surname`
      )
      .all(req.params.id, exact ? q : `%${q}%`) as Passenger[];
  } else if (q) {
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

flightsRouter.post("/:id/passengers", requireEdit, (req, res) => {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.id) as Flight | undefined;
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const {
    surname, given_name, middle_name, ticket_number, ssr, infant, gender, dob, record_locator,
    bag_count, bag_weight_kg, extra, document_type, document_number, nationality, doc_expiry,
  } = req.body;
  if (!surname || !given_name || !ticket_number) {
    return res.status(400).json({ error: "surname, given_name, ticket_number are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO passengers (record_locator, flight_id, surname, given_name, middle_name, ticket_number, ssr, infant, gender, dob, bag_count, bag_weight_kg, extra, document_type, document_number, nationality, doc_expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      (record_locator || randomLocator()).toUpperCase(),
      flight.id,
      surname.toUpperCase(),
      given_name.toUpperCase(),
      middle_name || null,
      ticket_number,
      JSON.stringify(ssr ?? []),
      infant ? 1 : 0,
      gender === "M" || gender === "F" ? gender : null,
      dob || null,
      bag_count ?? 0,
      bag_weight_kg ?? 0,
      extra !== undefined ? extra : null,
      document_type || null,
      document_number || null,
      nationality || null,
      doc_expiry || null
    );

  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(info.lastInsertRowid) as Passenger;
  res.status(201).json(serializePassenger(passenger));
});

/**
 * General passenger-record edit — surname/given/middle name, gender, dob,
 * infant, ssr, record locator, baggage, extra, ticket number, and now the
 * primary travel document too (the check-in flow's own seat/document POST
 * in routes/checkin.ts still owns setting these the first time a passenger
 * actually checks in; this lets the passenger-details modal edit them
 * afterwards without re-running check-in).
 */
flightsRouter.patch("/:flightId/passengers/:passengerId", requireEdit, (req, res) => {
  const passenger = db
    .prepare("SELECT * FROM passengers WHERE id = ? AND flight_id = ?")
    .get(req.params.passengerId, req.params.flightId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });

  const {
    surname, given_name, middle_name, record_locator, gender, dob, infant, ssr, bag_count, bag_weight_kg,
    extra, ticket_number, document_type, document_number, nationality, doc_expiry,
  } = req.body;
  db.prepare(
    `UPDATE passengers SET
       surname = COALESCE(?, surname),
       given_name = COALESCE(?, given_name),
       middle_name = COALESCE(?, middle_name),
       record_locator = COALESCE(?, record_locator),
       gender = COALESCE(?, gender),
       dob = COALESCE(?, dob),
       infant = COALESCE(?, infant),
       ssr = COALESCE(?, ssr),
       bag_count = COALESCE(?, bag_count),
       bag_weight_kg = COALESCE(?, bag_weight_kg),
       extra = COALESCE(?, extra),
       ticket_number = COALESCE(?, ticket_number),
       document_type = COALESCE(?, document_type),
       document_number = COALESCE(?, document_number),
       nationality = COALESCE(?, nationality),
       doc_expiry = COALESCE(?, doc_expiry)
     WHERE id = ?`
  ).run(
    surname ? surname.toUpperCase() : null,
    given_name ? given_name.toUpperCase() : null,
    middle_name ?? null,
    record_locator ? record_locator.toUpperCase() : null,
    gender === "M" || gender === "F" ? gender : null,
    dob ?? null,
    infant !== undefined ? (infant ? 1 : 0) : null,
    ssr !== undefined ? JSON.stringify(ssr) : null,
    bag_count !== undefined ? bag_count : null,
    bag_weight_kg !== undefined ? bag_weight_kg : null,
    extra !== undefined ? extra : null,
    ticket_number || null,
    document_type ?? null,
    document_number ?? null,
    nationality ?? null,
    doc_expiry ?? null,
    req.params.passengerId
  );

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger;
  res.json(serializePassenger(updated));
});

flightsRouter.delete("/:flightId/passengers/:passengerId", requireEdit, (req, res) => {
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
