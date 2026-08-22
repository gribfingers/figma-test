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
  const { flight_number, carrier_code, origin, destination, std, aircraft_type } = req.body;
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
    `INSERT INTO flights (flight_number, carrier_code, origin, destination, std, aircraft_type, status)
     VALUES (?, ?, ?, ?, ?, ?, 'CHECKIN_OPEN')`
  );
  const info = insertFlight.run(
    flight_number,
    carrier_code.toUpperCase(),
    origin.toUpperCase(),
    destination.toUpperCase(),
    std,
    aircraft_type
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

  const { surname, given_name, ticket_number, ssr, infant, record_locator } = req.body;
  if (!surname || !given_name || !ticket_number) {
    return res.status(400).json({ error: "surname, given_name, ticket_number are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO passengers (record_locator, flight_id, surname, given_name, ticket_number, ssr, infant)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      (record_locator || randomLocator()).toUpperCase(),
      flight.id,
      surname.toUpperCase(),
      given_name.toUpperCase(),
      ticket_number,
      JSON.stringify(ssr ?? []),
      infant ? 1 : 0
    );

  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(info.lastInsertRowid) as Passenger;
  res.status(201).json(serializePassenger(passenger));
});
