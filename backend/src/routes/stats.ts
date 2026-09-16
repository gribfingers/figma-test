import { Router } from "express";
import { db } from "../db";
import { requireSuperadmin } from "../middleware/auth";

export const statsRouter = Router();
statsRouter.use(requireSuperadmin);

// How far back to look for the agent throughput leaderboard. Today's flight roster below is
// always today's schedule regardless of range — a "shift" report is inherently daily.
function agentEventsSince(range: string): string {
  switch (range) {
    case "7d":
      return "datetime('now', '-7 day')";
    case "30d":
      return "datetime('now', '-30 day')";
    default:
      return "datetime('now', 'start of day')";
  }
}

interface AgentEventRow {
  user_id: number;
  first_name: string;
  last_name: string;
  checked_in_count: number;
  first_checkin_at: string;
  last_checkin_at: string;
}

/**
 * Per-agent and per-flight check-in throughput for the current shift. There's no dedicated
 * "shift" concept in the schema, so agents are aggregated from seat_events (the row each
 * check-in already writes) and flights from today's scheduled departures.
 */
statsRouter.get("/shift", (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "today";
  const since = agentEventsSince(range);

  const agentRows = db
    .prepare(
      `SELECT u.id AS user_id, u.first_name, u.last_name,
              COUNT(*) AS checked_in_count,
              MIN(e.created_at) AS first_checkin_at,
              MAX(e.created_at) AS last_checkin_at
       FROM seat_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.event = 'checked_in' AND e.created_at >= ${since}
       GROUP BY u.id
       ORDER BY checked_in_count DESC`
    )
    .all() as AgentEventRow[];

  const agents = agentRows.map((a) => {
    const spanSeconds = (new Date(a.last_checkin_at).getTime() - new Date(a.first_checkin_at).getTime()) / 1000;
    return {
      user_id: a.user_id,
      first_name: a.first_name,
      last_name: a.last_name,
      checked_in_count: a.checked_in_count,
      // Average gap between consecutive check-ins this agent performed — undefined for a single
      // check-in (no second point to measure a gap against).
      avg_service_seconds: a.checked_in_count > 1 ? Math.round(spanSeconds / (a.checked_in_count - 1)) : null,
    };
  });

  const flights = db
    .prepare(
      `SELECT f.id AS flight_id, f.flight_number, f.carrier_code, f.std,
              COUNT(p.id) AS total_passengers,
              SUM(CASE WHEN p.checkin_status = 'CHECKED_IN' THEN 1 ELSE 0 END) AS checked_in_count
       FROM flights f
       LEFT JOIN passengers p ON p.flight_id = f.id
       WHERE f.std >= datetime('now', 'start of day') AND f.std < datetime('now', 'start of day', '+1 day')
       GROUP BY f.id
       ORDER BY f.std`
    )
    .all();

  res.json({ range, agents, flights });
});
