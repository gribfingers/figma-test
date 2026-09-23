import { Router } from "express";
import { db } from "../db";
import { Flight, Passenger } from "../types";
import { serializePassenger } from "../serialize";
import { encodeBcbp, PAX_STATUS } from "../bcbp";
import { toJulianDayOfYear } from "../utils/julian";
import { isFlightDeparted } from "../flightPhase";

/**
 * Self-service kiosk endpoints — no requireAuth/requireEdit, mirroring how
 * /api/transcribe-demo is mounted (see index.ts): these are meant to be hit
 * by an unauthenticated passenger-facing screen, not the agent workstation.
 * Two stations, matching a real self-service check-in + self-bag-drop pair:
 *   1) lookup + checkin  — the "elongated screen" kiosk: find booking, scan
 *      document, print boarding pass + bag tag(s).
 *   2) bag-drop lookup + confirm — the separate belt station: find the
 *      already-tagged booking and confirm the bag(s) physically dropped.
 *
 * A booking's whole travel party (same PNR, same flight) is looked up and
 * processed together — same as a real kiosk/counter, where a family or
 * group traveling on one reservation checks in together in one visit
 * rather than one person at a time re-entering the same reference.
 *
 * Deliberately reuses the exact same BCBP/seat-assignment/status-guard logic
 * as the agent check-in endpoint (routes/checkin.ts) — a kiosk check-in is
 * the same underlying operation, just self-served instead of agent-driven.
 */
export const kioskRouter = Router();

interface KioskExtra {
  kiosk?: boolean;
  docScanned?: boolean;
  bagTags?: string[];
  bagDroppedAt?: string | null;
  bagDropDesk?: string | null;
}

function readExtra(passenger: Passenger): KioskExtra {
  try {
    return passenger.extra ? JSON.parse(passenger.extra) : {};
  } catch {
    return {};
  }
}

function flightLabel(f: Pick<Flight, "carrier_code" | "flight_number" | "origin" | "destination" | "std">) {
  return { flightNumber: `${f.carrier_code}${f.flight_number}`, origin: f.origin, destination: f.destination, std: f.std };
}

/** 8-digit numeric tag, same shape as the agent Baggage step's auto-assigned tags (see BaggageStep.tsx's autoTagNumber) — just server-generated here since the kiosk has no per-row UI to derive a seed from. */
function generateTag(passengerId: number, bagIndex: number): string {
  const seed = `kiosk-tag-${passengerId}-${bagIndex}-${Date.now()}-${Math.random()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(10000000 + (h % 90000000));
}

function loadPassengerAndFlight(passengerId: number) {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passengerId) as Passenger | undefined;
  if (!passenger) return null;
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(passenger.flight_id) as Flight;
  return { passenger, flight };
}

function memberJson(row: Passenger) {
  const extra = readExtra(row);
  return { passenger: serializePassenger(row), bagTags: extra.bagTags ?? [], bagDroppedAt: extra.bagDroppedAt ?? null };
}

/** Everyone traveling on the same booking reference, on the same flight as the anchor passenger — the "travel party" a kiosk processes together. Ordered so anyone still needing check-in comes first (nicer default selection order), then by name. */
function loadParty(recordLocator: string, flightId: number) {
  const rows = db
    .prepare(
      `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
       FROM passengers p JOIN flights f ON f.id = p.flight_id
       WHERE p.record_locator = ? AND p.flight_id = ?
       ORDER BY (p.checkin_status = 'CHECKED_IN'), p.surname, p.given_name`
    )
    .all(recordLocator, flightId) as any[];
  return rows;
}

/**
 * Self-lookup by booking reference + surname (the standard two-factor
 * self-service pattern — PNR alone is too easy to guess), or by e-ticket
 * number alone. Verifies the surname (or ticket) against one member of the
 * party, then returns the WHOLE party on that PNR + flight — a group
 * travels and checks in together, not one lookup per person.
 */
kioskRouter.get("/lookup", (req, res) => {
  const pnr = String(req.query.pnr ?? "").trim();
  const surname = String(req.query.surname ?? "").trim();
  const eticket = String(req.query.eticket ?? "").trim();

  let anchor: any;
  if (eticket) {
    anchor = db
      .prepare(
        `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
         FROM passengers p JOIN flights f ON f.id = p.flight_id
         WHERE UPPER(p.ticket_number) = UPPER(?)`
      )
      .get(eticket);
  } else if (pnr && surname) {
    anchor = db
      .prepare(
        `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
         FROM passengers p JOIN flights f ON f.id = p.flight_id
         WHERE UPPER(p.record_locator) = UPPER(?) AND UPPER(p.surname) = UPPER(?)`
      )
      .get(pnr, surname);
  } else {
    return res.status(400).json({ error: "Provide pnr+surname, or eticket" });
  }

  if (!anchor) return res.status(404).json({ error: "Booking not found — check your reference and last name" });

  const party = loadParty(anchor.record_locator, anchor.flight_id);
  res.json({ members: party.map(memberJson), flight: flightLabel(anchor) });
});

/**
 * Self-service check-in: capture a travel document (normally a passport
 * scan; here the kiosk UI simulates the scan and posts the resulting
 * fields), auto-assign the next free seat in the passenger's booked cabin
 * (a kiosk doesn't offer the agent's full seat map — matches most real
 * self-service kiosks, which pick automatically unless the passenger
 * already reserved a specific seat), and issue the boarding pass + bag
 * tag(s). Same status guards as the agent endpoint (routes/checkin.ts).
 *
 * One passenger per call — the kiosk UI calls this once per selected party
 * member in sequence (see KioskCheckIn.tsx's queue), so a seat-availability
 * or document error on one person doesn't block the rest of the party.
 */
kioskRouter.post("/:passengerId/checkin", (req, res) => {
  const passenger = db.prepare("SELECT * FROM passengers WHERE id = ?").get(req.params.passengerId) as Passenger | undefined;
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });

  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(passenger.flight_id) as Flight;
  if (flight.status === "CLOSED" || flight.status === "DEPARTED" || isFlightDeparted(flight)) {
    return res.status(409).json({ error: `Check-in is closed for flight ${flight.carrier_code}${flight.flight_number}` });
  }
  if (passenger.checkin_status === "CHECKED_IN") {
    return res.status(409).json({ error: "Already checked in" });
  }

  const { document_number, nationality, dob, doc_expiry, bag_count } = req.body;
  if (!document_number || !doc_expiry) {
    return res.status(400).json({ error: "document_number and doc_expiry are required" });
  }
  if (new Date(doc_expiry) < new Date(flight.std)) {
    return res.status(422).json({ error: "Your travel document expires before the flight date — please see a check-in agent" });
  }

  const bagCount = Math.max(0, Math.min(9, Number(bag_count) || 0));

  // seats.cabin_class uses "J"/"Y" (matches the physical cabin), while passenger.class uses "C"/"Y"
  // (the booked fare) — same mapping as frontend/src/paxExtra.ts's classFor, just inverted.
  const cabinClass = passenger.class === "C" ? "J" : "Y";
  const seatRow = db
    .prepare(
      `SELECT seat, cabin_class FROM seats WHERE flight_id = ? AND cabin_class = ? AND passenger_id IS NULL AND exit_row = 0 ORDER BY seat LIMIT 1`
    )
    .get(flight.id, cabinClass) as { seat: string; cabin_class: string } | undefined;
  const fallbackSeatRow = seatRow
    ? undefined
    : (db
        .prepare(`SELECT seat, cabin_class FROM seats WHERE flight_id = ? AND cabin_class = ? AND passenger_id IS NULL ORDER BY seat LIMIT 1`)
        .get(flight.id, cabinClass) as { seat: string; cabin_class: string } | undefined);
  const chosen = seatRow ?? fallbackSeatRow;
  if (!chosen) return res.status(409).json({ error: "No seats available — please see a check-in agent" });
  const seat = chosen.seat;

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
    compartment: chosen.cabin_class,
    seat,
    checkInSequence: String(nextSeq),
    paxStatus: PAX_STATUS.CHECKED_IN,
  });

  const bagTags = Array.from({ length: bagCount }, (_, i) => generateTag(passenger.id, i));
  const extra: KioskExtra = { ...readExtra(passenger), kiosk: true, docScanned: true, bagTags, bagDroppedAt: null, bagDropDesk: null };

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE passengers SET document_type = 'P', document_number = ?, nationality = ?, dob = ?, doc_expiry = ?,
       seat = ?, bag_count = ?, checkin_status = 'CHECKED_IN', checkin_sequence = ?, bcbp = ?, extra = ? WHERE id = ?`
    ).run(document_number, nationality ?? null, dob ?? null, doc_expiry, seat, bagCount, nextSeq, bcbp, JSON.stringify(extra), passenger.id);
    db.prepare("UPDATE seats SET passenger_id = ? WHERE flight_id = ? AND seat = ?").run(passenger.id, flight.id, seat);
    db.prepare("UPDATE flights SET last_checkin_sequence = ? WHERE id = ?").run(nextSeq, flight.id);
  });
  tx();

  const updated = db.prepare("SELECT * FROM passengers WHERE id = ?").get(passenger.id) as Passenger;
  res.json({ passenger: serializePassenger(updated), flight: flightLabel(flight), bcbp, bagTags });
});

/** Bag-drop station's own lookup — by a printed tag number, or the same pnr+surname pair as check-in (in case the passenger goes straight there without the physical tag in hand, e.g. re-print scenarios). Returns the whole checked-in party sharing that booking + flight, same grouping as check-in, so one visit can drop bags for everyone traveling together. */
kioskRouter.get("/bag-drop/lookup", (req, res) => {
  const tag = String(req.query.tag ?? "").trim();
  const pnr = String(req.query.pnr ?? "").trim();
  const surname = String(req.query.surname ?? "").trim();

  let anchor: any;
  if (tag) {
    const candidates = db
      .prepare(
        `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
         FROM passengers p JOIN flights f ON f.id = p.flight_id WHERE p.checkin_status = 'CHECKED_IN'`
      )
      .all() as any[];
    anchor = candidates.find((r) => (readExtra(r as Passenger).bagTags ?? []).includes(tag));
  } else if (pnr && surname) {
    anchor = db
      .prepare(
        `SELECT p.*, f.flight_number, f.carrier_code, f.origin, f.destination, f.std, f.status as flight_status
         FROM passengers p JOIN flights f ON f.id = p.flight_id
         WHERE UPPER(p.record_locator) = UPPER(?) AND UPPER(p.surname) = UPPER(?)`
      )
      .get(pnr, surname);
  } else {
    return res.status(400).json({ error: "Provide tag, or pnr+surname" });
  }

  if (!anchor) return res.status(404).json({ error: "No matching checked-in booking with bags found" });

  const party = loadParty(anchor.record_locator, anchor.flight_id).filter((p) => p.checkin_status === "CHECKED_IN" && p.bag_count > 0);
  if (party.length === 0) return res.status(404).json({ error: "No matching checked-in booking with bags found" });

  res.json({ members: party.map(memberJson), flight: flightLabel(anchor) });
});

/** Confirms one passenger's bag(s) were physically placed on the belt. Idempotent — re-confirming an already-dropped bag just returns the existing state rather than erroring, since a kiosk retry shouldn't dead-end the passenger. Called once per party member with bags — see KioskBagDrop.tsx. */
kioskRouter.post("/:passengerId/bag-drop", (req, res) => {
  const found = loadPassengerAndFlight(Number(req.params.passengerId));
  if (!found) return res.status(404).json({ error: "Passenger not found" });
  const { passenger } = found;

  if (passenger.checkin_status !== "CHECKED_IN") {
    return res.status(409).json({ error: "This booking hasn't been checked in yet" });
  }
  if (passenger.bag_count < 1) {
    return res.status(409).json({ error: "No bags on this booking to drop" });
  }

  const extra = readExtra(passenger);
  if (!extra.bagDroppedAt) {
    // Deterministic-looking desk assignment (matches the video's "Пройдите на 11 стойку") —
    // derived from the booking (PNR + flight), not the individual passenger, so every member of
    // a party dropping bags in the same visit is sent to the same desk.
    let h = 0;
    const seed = `${passenger.record_locator}-${passenger.flight_id}`;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const desk = String(1 + (h % 20));
    extra.bagDroppedAt = new Date().toISOString();
    extra.bagDropDesk = desk;
    db.prepare("UPDATE passengers SET extra = ? WHERE id = ?").run(JSON.stringify(extra), passenger.id);
  }

  res.json({ bagDroppedAt: extra.bagDroppedAt, bagDropDesk: extra.bagDropDesk });
});
