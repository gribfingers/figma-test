import { Router } from "express";
import { db } from "../db";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";
import { encodeBcbp, PAX_STATUS } from "../bcbp";
import { toJulianDayOfYear } from "../utils/julian";
import { requireEdit } from "../middleware/auth";

export const checkinRouter = Router();

/** Lookup by record locator, across open flights — the classic check-in-desk PNR retrieval. */
checkinRouter.get("/pnr/:recordLocator", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
       FROM passengers p JOIN flights f ON f.id = p.flight_id
       WHERE UPPER(p.record_locator) = ?`
    )
    .all(req.params.recordLocator.toUpperCase());
  if (rows.length === 0) return res.status(404).json({ error: "No PNR found for that record locator" });
  res.json(rows.map((r: any) => ({ ...serializePassenger(r), flight_number: r.flight_number, carrier_code: r.carrier_code, origin: r.origin, destination: r.destination, std: r.std, flight_status: r.flight_status })));
});

/**
 * Swap seats between two passengers on the same flight — both must already
 * have a seat assigned. Registered ahead of POST /:passengerId so "swap-seats"
 * isn't swallowed as a passengerId by that route.
 */
checkinRouter.post("/swap-seats", requireEdit, (req, res) => {
  const { passengerId, otherPassengerId } = req.body;
  const a = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passengerId) as Passenger | undefined;
  const b = db.prepare("SELECT * FROM passengers WHERE id = ?").get(otherPassengerId) as Passenger | undefined;
  if (!a || !b) return res.status(404).json({ error: "Passenger not found" });
  if (a.flight_id !== b.flight_id) return res.status(400).json({ error: "Passengers must be on the same flight" });
  if (!a.seat || !b.seat) return res.status(400).json({ error: "Both passengers must already have a seat assigned" });
  if (a.boarding_status === "BOARDED" || b.boarding_status === "BOARDED") {
    return res.status(409).json({ error: "Cannot change seats after boarding" });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(b.id, a.flight_id, a.seat);
    db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(a.id, b.flight_id, b.seat);
    db.prepare("UPDATE passengers SET seat = ? WHERE id = ?").run(b.seat, a.id);
    db.prepare("UPDATE passengers SET seat = ? WHERE id = ?").run(a.seat, b.id);
  });
  tx();

  const updatedA = db.prepare("SELECT * FROM passengers WHERE id = ?").get(a.id) as Passenger;
  const updatedB = db.prepare("SELECT * FROM passengers WHERE id = ?").get(b.id) as Passenger;
  res.json({ a: serializePassenger(updatedA), b: serializePassenger(updatedB) });
});

/**
 * Perform check-in for a passenger: capture travel document (APIS-style
 * data), assign a seat, record baggage, issue the boarding pass (BCBP).
 */
checkinRouter.post("/:passengerId", requireEdit, (req, res) => {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });

  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(passenger.flight_id) as Flight;
  if (flight.status === "CLOSED" || flight.status === "DEPARTED") {
    return res.status(409).json({ error: `Check-in is closed for flight ${flight.carrier_code}${flight.flight_number}` });
  }
  if (passenger.checkin_status === "CHECKED_IN") {
    return res.status(409).json({ error: "Passenger is already checked in" });
  }

  const { document_type, document_number, nationality, dob, doc_expiry, seat, bag_count, bag_weight_kg, ssr } = req.body;

  if (!document_number || !doc_expiry) {
    return res.status(400).json({ error: "document_number and doc_expiry are required to check in" });
  }
  // Basic travel-document validity check (analogous to an APIS/document-expiry gate).
  if (new Date(doc_expiry) < new Date(flight.std)) {
    return res.status(422).json({ error: "Travel document expires before the flight date — refer to a supervisor" });
  }

  if (!seat) return res.status(400).json({ error: "seat is required" });
  const seatRow = db.prepare("SELECT * FROM seats WHERE flight_id = ? AND seat = ?").get(flight.id, seat) as any;
  if (!seatRow) return res.status(400).json({ error: `Seat ${seat} does not exist on this aircraft` });
  if (seatRow.passenger_id) return res.status(409).json({ error: `Seat ${seat} is already occupied` });

  const nextSeq = flight.last_checkin_sequence + 1;

  const bcbp = encodeBcbp({
    surname: passenger.surname,
    givenName: passenger.given_name,
    eTicket: true,
    pnrCode: passenger.record_locator,
    fromAirport: flight.origin,
    toAirport: flight.destination,
    carrierCode: flight.carrier_code,
    flightNumber: flight.flight_number,
    julianDate: toJulianDayOfYear(flight.std),
    compartment: seatRow.cabin_class,
    seat,
    checkInSequence: String(nextSeq),
    paxStatus: PAX_STATUS.CHECKED_IN,
  });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE passengers SET document_type = ?, document_number = ?, nationality = ?, dob = ?, doc_expiry = ?,
       seat = ?, bag_count = ?, bag_weight_kg = ?, ssr = ?, checkin_status = 'CHECKED_IN',
       checkin_sequence = ?, bcbp = ? WHERE id = ?`
    ).run(
      document_type ?? "P",
      document_number,
      nationality ?? null,
      dob ?? null,
      doc_expiry,
      seat,
      bag_count ?? 0,
      bag_weight_kg ?? 0,
      JSON.stringify(ssr ?? JSON.parse(passenger.ssr || "[]")),
      nextSeq,
      bcbp,
      passenger.id
    );
    db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(passenger.id, flight.id, seat);
    db.prepare("UPDATE flights SET last_checkin_sequence = ? WHERE id = ?").run(nextSeq, flight.id);
  });
  tx();

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json({ passenger: serializePassenger(updated), bcbp });
});

/** Change seat assignment for an already checked-in passenger (before boarding). */
checkinRouter.post("/:passengerId/seat", requireEdit, (req, res) => {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });
  if (passenger.boarding_status === "BOARDED") return res.status(409).json({ error: "Passenger already boarded" });

  const { seat } = req.body;
  const seatRow = db.prepare("SELECT * FROM seats WHERE flight_id = ? AND seat = ?").get(passenger.flight_id, seat) as any;
  if (!seatRow) return res.status(400).json({ error: `Seat ${seat} does not exist on this aircraft` });
  if (seatRow.passenger_id && seatRow.passenger_id !== passenger.id) {
    return res.status(409).json({ error: `Seat ${seat} is already occupied` });
  }

  const tx = db.transaction(() => {
    if (passenger.seat) {
      db.prepare("UPDATE seats SET passenger_id = NULL WHERE flight_id = ? AND seat = ?").run(passenger.flight_id, passenger.seat);
    }
    db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(passenger.id, passenger.flight_id, seat);
    db.prepare("UPDATE passengers SET seat = ? WHERE id = ?").run(seat, passenger.id);
  });
  tx();

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json(serializePassenger(updated));
});
