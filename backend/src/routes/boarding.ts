import { Router } from "express";
import { db } from "../db";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";
import { decodeBcbp, PAX_STATUS } from "../bcbp";
import { buildPfs } from "../edifact";

export const boardingRouter = Router();

boardingRouter.get("/:flightId/passengers", (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM passengers WHERE flight_id = ? ORDER BY checkin_sequence IS NULL, checkin_sequence, surname`
    )
    .all(req.params.flightId) as Passenger[];
  const counts = {
    total: rows.length,
    checked_in: rows.filter((p) => p.checkin_status === "CHECKED_IN").length,
    boarded: rows.filter((p) => p.boarding_status === "BOARDED").length,
    offloaded: rows.filter((p) => p.boarding_status === "OFFLOADED").length,
    not_boarded: rows.filter((p) => p.checkin_status === "CHECKED_IN" && p.boarding_status === "NOT_BOARDED").length,
  };
  res.json({ passengers: rows.map(serializePassenger), counts });
});

/**
 * Boarding scan: the gate agent's workstation reads the BCBP string off
 * the boarding pass (in this prototype, entered manually — a real gate
 * reader decodes a printed/mobile 2D barcode) and the DCS cross-checks it
 * against the passenger/seat/flight record before admitting the passenger.
 */
boardingRouter.post("/scan", (req, res) => {
  const { bcbp: raw } = req.body;
  if (!raw) return res.status(400).json({ error: "bcbp is required" });

  const decoded = decodeBcbp(raw);
  if (!decoded.valid) return res.status(422).json({ error: "Could not decode boarding pass", details: decoded.errors });

  const passenger = db
    .prepare(
      `SELECT p.*, f.status as flight_status, f.carrier_code, f.flight_number
       FROM passengers p JOIN flights f ON f.id = p.flight_id
       WHERE UPPER(p.record_locator) = ? AND UPPER(f.carrier_code) = ? AND f.flight_number = ?`
    )
    .get(decoded.pnrCode.toUpperCase(), decoded.carrierCode.toUpperCase(), decoded.flightNumber.replace(/^0+/, "")) as any;

  if (!passenger) return res.status(404).json({ error: "No matching checked-in passenger found for this boarding pass" });
  if (passenger.flight_status === "CLOSED" || passenger.flight_status === "DEPARTED") {
    return res.status(409).json({ error: "Flight is already closed for boarding", passenger: serializePassenger(passenger) });
  }
  if (passenger.checkin_status !== "CHECKED_IN") {
    return res.status(409).json({ error: "Passenger is not checked in", passenger: serializePassenger(passenger) });
  }
  if (passenger.boarding_status === "BOARDED") {
    return res.status(409).json({ error: "Boarding pass already used — passenger already boarded", passenger: serializePassenger(passenger) });
  }
  if (passenger.boarding_status === "OFFLOADED") {
    return res.status(409).json({ error: "Passenger was offloaded and cannot board", passenger: serializePassenger(passenger) });
  }
  db.prepare("UPDATE passengers SET boarding_status = 'BOARDED' WHERE id = ?").run(passenger.id);
  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json({ passenger: serializePassenger(updated), decoded });
});

boardingRouter.post("/:flightId/offload/:passengerId", (req, res) => {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ? AND flight_id = ?").get(req.params.passengerId, req.params.flightId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found on this flight" });
  if (passenger.boarding_status === "BOARDED") return res.status(409).json({ error: "Cannot offload a passenger already boarded — deboard first" });

  db.prepare("UPDATE passengers SET boarding_status = 'OFFLOADED' WHERE id = ?").run(passenger.id);
  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json(serializePassenger(updated));
});

/** Flight close-out: lock boarding, mark remaining checked-in pax as no-show, emit the PFS. */
boardingRouter.post("/:flightId/close", (req, res) => {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(req.params.flightId) as Flight | undefined;
  if (!flight) return res.status(404).json({ error: "Flight not found" });
  if (flight.status === "CLOSED" || flight.status === "DEPARTED") {
    return res.status(409).json({ error: "Flight is already closed" });
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE passengers SET boarding_status = 'NO_SHOW'
       WHERE flight_id = ? AND checkin_status = 'CHECKED_IN' AND boarding_status = 'NOT_BOARDED'`
    ).run(flight.id);
    db.prepare("UPDATE flights SET status = 'CLOSED', closed_at = datetime('now') WHERE id = ?").run(flight.id);
  });
  tx();

  const passengers = db.prepare("SELECT * FROM passengers WHERE flight_id = ?").all(flight.id) as Passenger[];
  const updatedFlight = db.prepare("SELECT * FROM flights WHERE id = ?").get(flight.id) as Flight;
  const pfs = buildPfs(updatedFlight, passengers);
  res.json({ flight: updatedFlight, pfs });
});
