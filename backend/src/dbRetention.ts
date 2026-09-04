import fs from "node:fs";
import { db, dbPath } from "./db";

// How big the sqlite file is allowed to get before old flights start
// getting pruned to make room — the daily scheduler generates a bounded
// amount of data every day forever, so without this the file would just
// grow without bound. Overridable via env for a deploy with more/less disk.
const MAX_DB_SIZE_MB = Number(process.env.DB_MAX_SIZE_MB ?? 200);

function dbSizeMb(): number {
  // WAL mode keeps recent writes in a separate -wal file until checkpointed,
  // so the main file alone can understate real disk usage — checkpoint (and
  // truncate the WAL back to empty) first so this reads the true total.
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Non-fatal — worst case this reading is briefly stale.
  }
  try {
    return fs.statSync(dbPath).size / (1024 * 1024);
  } catch {
    return 0;
  }
}

const countFlights = db.prepare("SELECT COUNT(*) as c FROM flights");
const deleteOldestFlights = db.prepare(
  `DELETE FROM flights WHERE id IN (SELECT id FROM flights ORDER BY std ASC LIMIT ?)`
);

/**
 * If the database file is over MAX_DB_SIZE_MB, deletes the oldest flights
 * (by std) — their seats and passengers cascade away with them (see the
 * ON DELETE CASCADE foreign keys in db.ts) — and VACUUMs to actually shrink
 * the file back down, rather than just freeing pages SQLite quietly reuses
 * internally. Deletes the oldest half of what's there per call; if one pass
 * isn't enough to get back under the cap, the next daily check (see
 * dailyScheduler.ts) will prune further.
 */
export function pruneIfOverSize(): { deletedFlights: number; sizeMbBefore: number; sizeMbAfter: number } {
  const sizeMbBefore = dbSizeMb();
  if (sizeMbBefore <= MAX_DB_SIZE_MB) return { deletedFlights: 0, sizeMbBefore, sizeMbAfter: sizeMbBefore };

  const total = (countFlights.get() as { c: number }).c;
  if (total === 0) return { deletedFlights: 0, sizeMbBefore, sizeMbAfter: sizeMbBefore };

  const toDelete = Math.max(1, Math.ceil(total / 2));
  const info = deleteOldestFlights.run(toDelete);
  db.exec("VACUUM");

  return { deletedFlights: info.changes, sizeMbBefore, sizeMbAfter: dbSizeMb() };
}

// UX analytics events are useful for trend/volume analysis, not as a permanent audit log — unlike
// flights (pruned by total DB size above), these are pruned by age so the dashboard's own "last
// 30 days" view is never looking at a table that's silently missing recent-ish data.
const ANALYTICS_RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 90);
const deleteOldAnalyticsEvents = db.prepare(
  `DELETE FROM analytics_events WHERE created_at < datetime('now', ?)`
);

export function pruneOldAnalyticsEvents(): { deleted: number } {
  const info = deleteOldAnalyticsEvents.run(`-${ANALYTICS_RETENTION_DAYS} day`);
  return { deleted: info.changes };
}
