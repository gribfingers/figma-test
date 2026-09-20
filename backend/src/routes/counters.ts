import { Router } from "express";
import { db } from "../db";
import { Counter } from "../types";
import { requireEdit, requireSuperadmin } from "../middleware/auth";
import { blockIfTakenOver } from "../middleware/takeover";

export const countersRouter = Router();

// queue_length has no dedicated table — it's the NOT_CHECKED_IN passengers of whichever flight
// this counter currently serves (0 when no flight is assigned).
const SELECT_COUNTERS = `
  SELECT c.*,
    u.first_name AS agent_first_name, u.last_name AS agent_last_name,
    f.flight_number AS flight_number, f.carrier_code AS flight_carrier_code, f.std AS flight_std,
    s.first_name AS takeover_first_name, s.last_name AS takeover_last_name,
    fp.surname AS focus_surname, fp.given_name AS focus_given_name, fp.record_locator AS focus_record_locator,
    (SELECT COUNT(*) FROM passengers p WHERE p.flight_id = c.flight_id AND p.checkin_status = 'NOT_CHECKED_IN') AS queue_length
  FROM counters c
  LEFT JOIN users u ON u.id = c.agent_id
  LEFT JOIN flights f ON f.id = c.flight_id
  LEFT JOIN users s ON s.id = c.takeover_by
  LEFT JOIN passengers fp ON fp.id = c.focus_passenger_id
`;

/**
 * Whether — and by whom — a supervisor has taken over check-in duties at whichever counter the
 * calling agent is assigned to. Polled by the web check-in workstation (see frontend's
 * TakeoverBanner) so an agent mid-registration finds out their counter was intercepted without
 * having to be told in person. Not restricted to requireEdit: a read-only user should still see it.
 */
countersRouter.get("/my-status", (req, res) => {
  const counter = db
    .prepare(
      `${SELECT_COUNTERS} WHERE c.agent_id = ? AND c.takeover_by IS NOT NULL LIMIT 1`
    )
    .get(req.user!.id) as (Counter & { takeover_first_name: string | null; takeover_last_name: string | null }) | undefined;
  if (!counter) return res.json({ locked: false });
  res.json({
    locked: true,
    counterId: counter.id,
    counterLabel: counter.label,
    supervisorFirstName: counter.takeover_first_name,
    supervisorLastName: counter.takeover_last_name,
    since: counter.takeover_at,
  });
});

/**
 * Live-handoff signal #1: the web check-in workstation calls this whenever the logged-in agent
 * opens a flight to check passengers in, so their assigned counter's flight_id follows them
 * automatically instead of a supervisor having to set it by hand first. No-ops (200) if the
 * caller has no counter assigned yet. Blocked while taken over — see blockIfTakenOver — so an
 * agent browsing elsewhere mid-takeover can't yank the flight out from under the supervisor.
 */
countersRouter.post("/my-flight", blockIfTakenOver, (req, res) => {
  const { flight_id } = req.body ?? {};
  if (!flight_id || !db.prepare("SELECT id FROM flights WHERE id = ?").get(flight_id)) {
    return res.status(400).json({ error: "Unknown flight_id" });
  }
  const counter = db.prepare("SELECT id, flight_id FROM counters WHERE agent_id = ?").get(req.user!.id) as
    | { id: number; flight_id: number | null }
    | undefined;
  if (!counter) return res.json({ ok: true });
  if (counter.flight_id !== flight_id) {
    db.prepare("UPDATE counters SET flight_id = ? WHERE id = ?").run(flight_id, counter.id);
  }
  res.json({ ok: true });
});

/**
 * Live-handoff signal #2: the web check-in workstation calls this whenever the agent selects a
 * passenger in the PNR search results, so a supervisor who takes this counter over lands
 * straight on the passenger the agent was actually working on instead of the whole flight
 * roster (see the mobile app's checkin roster screen). Purely cosmetic — never read by any
 * enforcement logic — so a stale value is harmless. passenger_id: null clears it.
 */
countersRouter.post("/my-focus", blockIfTakenOver, (req, res) => {
  const { passenger_id } = req.body ?? {};
  if (passenger_id != null && !db.prepare("SELECT id FROM passengers WHERE id = ?").get(passenger_id)) {
    return res.status(400).json({ error: "Unknown passenger_id" });
  }
  const counter = db.prepare("SELECT id FROM counters WHERE agent_id = ?").get(req.user!.id) as { id: number } | undefined;
  if (!counter) return res.json({ ok: true });
  db.prepare("UPDATE counters SET focus_passenger_id = ?, focus_at = ? WHERE id = ?").run(
    passenger_id ?? null,
    passenger_id != null ? new Date().toISOString() : null,
    counter.id
  );
  res.json({ ok: true });
});

countersRouter.get("/", (_req, res) => {
  const counters = db.prepare(`${SELECT_COUNTERS} ORDER BY c.label`).all();
  res.json(counters);
});

countersRouter.post("/", requireEdit, (req, res) => {
  const { label } = req.body ?? {};
  if (!label) return res.status(400).json({ error: "label is required" });
  const info = db.prepare(`INSERT INTO counters (label) VALUES (?)`).run(String(label));
  const counter = db.prepare(`${SELECT_COUNTERS} WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(counter);
});

/**
 * Open/close a counter and/or (re)assign the agent working it and the flight it's serving.
 * Splitting one flight's queue across two counters, or moving it off a backed-up one, is just
 * pointing a counter's flight_id at that flight — there's no separate "reassign" endpoint.
 * agent_id/flight_id are applied verbatim (not COALESCE'd) so sending `null` unassigns them.
 */
countersRouter.patch("/:id", requireEdit, (req, res) => {
  const counter = db.prepare("SELECT * FROM counters WHERE id = ?").get(req.params.id) as Counter | undefined;
  if (!counter) return res.status(404).json({ error: "Counter not found" });

  const { label, status, agent_id, flight_id } = req.body ?? {};
  if (status !== undefined && status !== "OPEN" && status !== "CLOSED") {
    return res.status(400).json({ error: "status must be OPEN or CLOSED" });
  }
  if (agent_id != null && !db.prepare("SELECT id FROM users WHERE id = ?").get(agent_id)) {
    return res.status(400).json({ error: "Unknown agent_id" });
  }
  if (flight_id != null && !db.prepare("SELECT id FROM flights WHERE id = ?").get(flight_id)) {
    return res.status(400).json({ error: "Unknown flight_id" });
  }

  const nowIso = new Date().toISOString();
  const openedAt = status === "OPEN" && counter.status !== "OPEN" ? nowIso : null;
  const closedAt = status === "CLOSED" && counter.status !== "CLOSED" ? nowIso : null;

  db.prepare(
    `UPDATE counters SET
       label = COALESCE(?, label),
       status = COALESCE(?, status),
       agent_id = ?,
       flight_id = ?,
       opened_at = COALESCE(?, opened_at),
       closed_at = COALESCE(?, closed_at)
     WHERE id = ?`
  ).run(
    label ?? null,
    status ?? null,
    agent_id !== undefined ? agent_id : counter.agent_id,
    flight_id !== undefined ? flight_id : counter.flight_id,
    openedAt,
    closedAt,
    req.params.id
  );

  const updated = db.prepare(`${SELECT_COUNTERS} WHERE c.id = ?`).get(req.params.id);
  res.json(updated);
});

/**
 * Supervisor takes over check-in duties at this counter from its assigned agent. Any supervisor
 * can claim it (including re-claiming from another supervisor) — this app's whole supervisor
 * cohort is trusted staff, not competing users, so there's no ownership check to arbitrate.
 * The agent's own check-in mutations are rejected while this is set — see checkin.ts's
 * blockIfTakenOver — and the web check-in workstation surfaces it via GET /my-status.
 */
countersRouter.post("/:id/takeover", requireSuperadmin, (req, res) => {
  const counter = db.prepare("SELECT * FROM counters WHERE id = ?").get(req.params.id) as Counter | undefined;
  if (!counter) return res.status(404).json({ error: "Counter not found" });

  db.prepare("UPDATE counters SET takeover_by = ?, takeover_at = ? WHERE id = ?").run(
    req.user!.id,
    new Date().toISOString(),
    req.params.id
  );
  const updated = db.prepare(`${SELECT_COUNTERS} WHERE c.id = ?`).get(req.params.id);
  res.json(updated);
});

/** Hands check-in duties at this counter back to its assigned agent. */
countersRouter.post("/:id/release", requireSuperadmin, (req, res) => {
  const counter = db.prepare("SELECT id FROM counters WHERE id = ?").get(req.params.id);
  if (!counter) return res.status(404).json({ error: "Counter not found" });

  db.prepare("UPDATE counters SET takeover_by = NULL, takeover_at = NULL WHERE id = ?").run(req.params.id);
  const updated = db.prepare(`${SELECT_COUNTERS} WHERE c.id = ?`).get(req.params.id);
  res.json(updated);
});

countersRouter.delete("/:id", requireEdit, (req, res) => {
  const counter = db.prepare("SELECT id FROM counters WHERE id = ?").get(req.params.id);
  if (!counter) return res.status(404).json({ error: "Counter not found" });
  db.prepare("DELETE FROM counters WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
