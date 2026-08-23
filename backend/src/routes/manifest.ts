import { Router } from "express";
import { db } from "../db";
import { Flight, Passenger } from "../types";
import { buildPnl, buildAdl, buildPfs } from "../edifact";

export const manifestRouter = Router();

function loadFlightAndPax(flightId: string) {
  const flight = db.prepare("SELECT * FROM flights WHERE id = ?").get(flightId) as Flight | undefined;
  const passengers = flight
    ? (db.prepare("SELECT * FROM passengers WHERE flight_id = ? ORDER BY surname").all(flightId) as Passenger[])
    : [];
  return { flight, passengers };
}

manifestRouter.get("/:flightId/pnl", (req, res) => {
  const { flight, passengers } = loadFlightAndPax(req.params.flightId);
  if (!flight) return res.status(404).json({ error: "Flight not found" });
  res.type("text/plain").send(buildPnl(flight, passengers));
});

manifestRouter.get("/:flightId/adl", (req, res) => {
  const { flight, passengers } = loadFlightAndPax(req.params.flightId);
  if (!flight) return res.status(404).json({ error: "Flight not found" });
  const since = Number(req.query.since ?? 0);
  res.type("text/plain").send(buildAdl(flight, passengers, since));
});

manifestRouter.get("/:flightId/pfs", (req, res) => {
  const { flight, passengers } = loadFlightAndPax(req.params.flightId);
  if (!flight) return res.status(404).json({ error: "Flight not found" });
  res.type("text/plain").send(buildPfs(flight, passengers));
});
