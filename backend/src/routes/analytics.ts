import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireSuperadmin } from "../middleware/auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

interface IncomingEvent {
  type: string;
  name: string;
  path?: string;
  detail?: unknown;
  ts?: string;
}

// Generous but bounded — a batch is one flush of the client's queue (see analytics.ts), not a
// per-event request, so this only guards against a malformed/malicious client sending one giant call.
const MAX_BATCH = 200;

const insertEvent = db.prepare(
  `INSERT INTO analytics_events (user_id, session_id, event_type, event_name, path, detail, created_at)
   VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
);
const insertMany = db.transaction((rows: [number, string, string, string, string | null, string | null, string | null][]) => {
  for (const row of rows) insertEvent.run(...row);
});

/**
 * Any logged-in user can report their own usage — this only ever writes rows scoped to the
 * caller's own user_id, never reads anything back, so there's nothing to restrict beyond auth.
 */
analyticsRouter.post("/track", (req, res) => {
  const events = Array.isArray(req.body?.events) ? (req.body.events as IncomingEvent[]) : [];
  if (events.length === 0) return res.status(400).json({ error: "events array is required" });
  const batch = events.slice(0, MAX_BATCH);

  const rows: [number, string, string, string, string | null, string | null, string | null][] = [];
  for (const e of batch) {
    if (!e || typeof e.type !== "string" || typeof e.name !== "string") continue;
    const sessionId = typeof (e as any).sessionId === "string" ? (e as any).sessionId : "unknown";
    rows.push([
      req.user!.id,
      sessionId,
      e.type.slice(0, 40),
      e.name.slice(0, 200),
      typeof e.path === "string" ? e.path.slice(0, 200) : null,
      e.detail !== undefined ? JSON.stringify(e.detail).slice(0, 2000) : null,
      typeof e.ts === "string" ? e.ts : null,
    ]);
  }
  if (rows.length > 0) insertMany(rows);
  res.status(204).end();
});

analyticsRouter.use(requireSuperadmin);

// "24h" | "7d" | "30d" | "all" — clamped server-side rather than trusting an arbitrary date range,
// since this is a dashboard filter, not a general-purpose report query.
function sinceClauseFor(range: string): string | null {
  switch (range) {
    case "24h":
      return "datetime('now', '-1 day')";
    case "7d":
      return "datetime('now', '-7 day')";
    case "30d":
      return "datetime('now', '-30 day')";
    default:
      return null;
  }
}

analyticsRouter.get("/summary", (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  const since = sinceClauseFor(range);
  // Aliased (ae.created_at) everywhere below, including the two single-table queries that don't
  // strictly need it — users has its own created_at column too, so any query here that later grows
  // a JOIN stays safe instead of silently becoming ambiguous like the JOINed ones originally were.
  const where = since ? `WHERE ae.created_at >= ${since}` : "";

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS totalEvents, COUNT(DISTINCT user_id) AS uniqueUsers, COUNT(DISTINCT session_id) AS uniqueSessions
       FROM analytics_events ae ${where}`
    )
    .get() as { totalEvents: number; uniqueUsers: number; uniqueSessions: number };

  const errorCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM analytics_events ae ${where} ${where ? "AND" : "WHERE"} ae.event_type = 'error'`).get() as {
      c: number;
    }
  ).c;

  // Bucketed by day in UTC (created_at is stored as UTC via SQLite's datetime('now')) — the
  // dashboard's own day range selector is expressed the same way, so this lines up with it.
  const eventsByDay = db
    .prepare(
      `SELECT date(ae.created_at) AS day, COUNT(*) AS count
       FROM analytics_events ae ${where}
       GROUP BY day ORDER BY day ASC`
    )
    .all() as { day: string; count: number }[];

  const topPages = db
    .prepare(
      `SELECT path, COUNT(*) AS count FROM analytics_events ae
       ${where ? where + " AND" : "WHERE"} ae.event_type = 'page_view' AND path IS NOT NULL
       GROUP BY path ORDER BY count DESC LIMIT 10`
    )
    .all() as { path: string; count: number }[];

  const topActions = db
    .prepare(
      `SELECT event_name AS name, COUNT(*) AS count FROM analytics_events ae
       ${where ? where + " AND" : "WHERE"} ae.event_type IN ('action', 'shortcut')
       GROUP BY event_name ORDER BY count DESC LIMIT 12`
    )
    .all() as { name: string; count: number }[];

  const recentErrors = db
    .prepare(
      `SELECT ae.event_name AS name, ae.path AS path, ae.detail AS detail, ae.created_at AS created_at,
              u.first_name AS first_name, u.last_name AS last_name
       FROM analytics_events ae LEFT JOIN users u ON u.id = ae.user_id
       ${where ? where + " AND" : "WHERE"} ae.event_type = 'error'
       ORDER BY ae.id DESC LIMIT 20`
    )
    .all();

  const activeUsers = db
    .prepare(
      `SELECT u.id, u.first_name AS first_name, u.last_name AS last_name, COUNT(*) AS count
       FROM analytics_events ae JOIN users u ON u.id = ae.user_id
       ${where}
       GROUP BY u.id ORDER BY count DESC LIMIT 10`
    )
    .all();

  res.json({ range, totals, errorCount, eventsByDay, topPages, topActions, recentErrors, activeUsers });
});

analyticsRouter.get("/events", (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  const since = sinceClauseFor(range);
  const type = typeof req.query.type === "string" && req.query.type !== "all" ? req.query.type : null;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 50;

  const clauses: string[] = [];
  const params: any[] = [];
  if (since) clauses.push(`ae.created_at >= ${since}`);
  if (type) {
    clauses.push("ae.event_type = ?");
    params.push(type);
  }
  if (q) {
    clauses.push("(ae.event_name LIKE ? OR ae.path LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM analytics_events ae ${where}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT ae.id, ae.event_type AS type, ae.event_name AS name, ae.path AS path, ae.detail AS detail,
              ae.created_at AS created_at, u.first_name AS first_name, u.last_name AS last_name
       FROM analytics_events ae LEFT JOIN users u ON u.id = ae.user_id
       ${where} ORDER BY ae.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
    )
    .all(...params);

  res.json({ total, page, pageSize, events: rows });
});
