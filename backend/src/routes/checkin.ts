import { Router } from "express";
import { db } from "../db";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";
import { encodeBcbp, PAX_STATUS } from "../bcbp";
import { toJulianDayOfYear } from "../utils/julian";
import { requireEdit } from "../middleware/auth";

export const checkinRouter = Router();

const SEARCH_COLUMN: Record<string, string> = {
  surname: "p.surname",
  pnr: "p.record_locator",
  eticket: "p.ticket_number",
  doc: "p.document_number",
};

/**
 * Passenger lookup across ALL flights, by last name / PNR / e-ticket / doc
 * number — the check-in agent workstation's search screen, for when the
 * agent doesn't already know which flight a passenger is on. Surname and
 * doc number match as a substring (a desk agent rarely has the exact full
 * value); PNR and e-ticket match exactly, same as a real PNR retrieval.
 *
 * `by=flight` is the other direction — the agent already knows the flight
 * (e.g. "SU1234") and wants its whole roster loaded, same as Flight
 * Schedule's Pax tab but reachable straight from the search screen.
 */
checkinRouter.get("/search", (req, res) => {
  const by = String(req.query.by ?? "surname");
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);

  if (by === "flight") {
    const rows = db
      .prepare(
        `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
         FROM passengers p JOIN flights f ON f.id = p.flight_id
         WHERE UPPER(f.carrier_code || f.flight_number) LIKE UPPER(?)
         ORDER BY f.std DESC, p.surname, p.given_name
         LIMIT 300`
      )
      .all(`%${q.replace(/\s+/g, "")}%`);
    return res.json(
      rows.map((r: any) => ({ ...serializePassenger(r), flight_number: r.flight_number, carrier_code: r.carrier_code, origin: r.origin, destination: r.destination, std: r.std, flight_status: r.flight_status }))
    );
  }

  const column = SEARCH_COLUMN[by];
  if (!column) return res.status(400).json({ error: `Unknown search field: ${by}` });

  const exact = by === "pnr" || by === "eticket";
  const rows = db
    .prepare(
      `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
       FROM passengers p JOIN flights f ON f.id = p.flight_id
       WHERE UPPER(${column}) ${exact ? "= UPPER(?)" : "LIKE UPPER(?)"}
       ORDER BY f.std DESC
       LIMIT 50`
    )
    .all(exact ? q : `%${q}%`);
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

/**
 * Reverses check-in — the counterpart to POST /:passengerId above. Frees
 * the seat (or keeps the number but marks it merely "reserved" — see
 * seats.extra/seatExtra.ts — when the agent picked "Make seats reserved"),
 * clears the boarding pass/sequence, and returns the passenger to
 * NOT_CHECKED_IN. Blocked once boarded, since checkin_status regressing
 * past boarding_status would leave the record inconsistent — unboard
 * first (boarding.ts's /unboard).
 */
checkinRouter.post("/:passengerId/cancel", requireEdit, (req, res) => {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });
  if (passenger.checkin_status !== "CHECKED_IN") {
    return res.status(409).json({ error: "Passenger is not checked in" });
  }
  if (passenger.boarding_status === "BOARDED") {
    return res.status(409).json({ error: "Passenger has already boarded — unboard first" });
  }

  const option = typeof req.body?.option === "string" ? req.body.option : "offload";
  const keepSeatReserved = option === "make_seats_reserved";
  const clearBags = option === "offload_cancel_bags";

  const tx = db.transaction(() => {
    if (passenger.seat) {
      if (keepSeatReserved) {
        const seatRow = db
          .prepare("SELECT extra FROM seats WHERE flight_id = ? AND seat = ?")
          .get(passenger.flight_id, passenger.seat) as { extra: string | null } | undefined;
        let seatExtra: Record<string, unknown> = {};
        try {
          seatExtra = seatRow?.extra ? JSON.parse(seatRow.extra) : {};
        } catch {
          seatExtra = {};
        }
        seatExtra.reserved = true;
        db.prepare("UPDATE seats SET passenger_id = NULL, extra = ? WHERE flight_id = ? AND seat = ?").run(
          JSON.stringify(seatExtra),
          passenger.flight_id,
          passenger.seat
        );
      } else {
        db.prepare("UPDATE seats SET passenger_id = NULL WHERE flight_id = ? AND seat = ?").run(passenger.flight_id, passenger.seat);
      }
    }

    let paxExtra: Record<string, unknown> = {};
    try {
      paxExtra = passenger.extra ? JSON.parse(passenger.extra) : {};
    } catch {
      paxExtra = {};
    }
    if (option === "priority_list") paxExtra.pl = true;

    db.prepare(
      `UPDATE passengers SET checkin_status = 'NOT_CHECKED_IN', checkin_sequence = NULL, bcbp = NULL,
       seat = ?, bag_count = ?, bag_weight_kg = ?, extra = ? WHERE id = ?`
    ).run(
      keepSeatReserved ? passenger.seat : null,
      clearBags ? 0 : passenger.bag_count,
      clearBags ? 0 : passenger.bag_weight_kg,
      JSON.stringify(paxExtra),
      passenger.id
    );
  });
  tx();

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json(serializePassenger(updated));
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
