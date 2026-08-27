import { generateDailySchedule } from "./scheduleGenerator";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0); // "hour 24" rolls over to tomorrow's 00:00 UTC — same trick as isoInDays elsewhere
  return next.getTime() - now.getTime();
}

function runDailyGeneration() {
  try {
    const { flights, passengers } = generateDailySchedule(new Date());
    if (flights > 0) {
      console.log(`[dailyScheduler] Generated ${flights} flights / ${passengers} passengers for today.`);
    } else {
      console.log("[dailyScheduler] Today's schedule already exists — nothing to generate.");
    }
  } catch (err) {
    // A missed/failed run shouldn't crash the server or cancel tomorrow's —
    // the next midnight tick (or the next server restart, via the startup
    // catch-up call below) will just try again.
    console.error("[dailyScheduler] Daily schedule generation failed:", err);
  }
}

/**
 * Runs generateDailySchedule once a day at UTC midnight for as long as the
 * server process stays up — no OS-level cron needed. Also runs once
 * immediately at startup (catch-up) so a schedule still gets created for
 * today even if the server was down when midnight actually passed;
 * generateDailySchedule's own idempotency check (hasScheduleForDay) makes
 * this safe to call redundantly on every deploy/restart.
 */
export function startDailyScheduler() {
  runDailyGeneration();

  const delay = msUntilNextUtcMidnight();
  console.log(`[dailyScheduler] Next run in ${Math.round(delay / 60000)} min (at UTC midnight).`);
  setTimeout(() => {
    runDailyGeneration();
    setInterval(runDailyGeneration, ONE_DAY_MS);
  }, delay);
}
