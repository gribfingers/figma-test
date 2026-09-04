import { api, getToken, setApiErrorTracker } from "./api";

// One id per browser tab (not the login/auth session token) — reused across a reload, but not
// shared with another tab, so "unique sessions" in the dashboard matches "one tab's visit", the
// usual meaning for a UX analytics session, not "one login".
const SESSION_KEY = "dcs_analytics_session";
const FLUSH_INTERVAL_MS = 8000;
// A hard cap on the in-memory queue — if flushing is somehow stuck (offline, backend down), this
// stops a busy session from growing the queue without bound rather than actually limiting volume.
const MAX_QUEUE = 500;

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

interface QueuedEvent {
  type: string;
  name: string;
  path: string;
  detail?: unknown;
  ts: string;
  sessionId: string;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flush(false), FLUSH_INTERVAL_MS);
}

/**
 * Records one UX event: `type` is a coarse category ("page_view" | "action" | "shortcut" |
 * "error"), `name` the specific thing that happened (a route path, a shortcut id, an action key).
 * Queued in memory and flushed in batches — see flush() — rather than sent one request per event,
 * since a busy agent generates far more of these than are worth a network round-trip each.
 */
export function trackEvent(type: string, name: string, detail?: unknown) {
  if (!getToken()) return; // logged out (e.g. still on the login screen) — nothing to attribute this to
  if (queue.length >= MAX_QUEUE) return;
  queue.push({ type, name, path: window.location.pathname, detail, ts: new Date().toISOString(), sessionId: sessionId() });
  ensureTimer();
}

export function trackPageView(path: string) {
  trackEvent("page_view", path);
}

/**
 * `keepalive` uses a direct fetch (with the auth header set manually) instead of the normal
 * api.trackEvents() call — this is what a page-unload/hide flush needs to survive navigation away,
 * and `fetch(..., {keepalive:true})` is the modern replacement for navigator.sendBeacon precisely
 * because sendBeacon can't carry a custom Authorization header, which this token-based auth needs.
 */
async function flush(keepalive: boolean) {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    if (keepalive) {
      const token = getToken();
      if (!token) return;
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } else {
      await api.trackEvents(batch);
    }
  } catch {
    // Best-effort — analytics must never surface an error to the agent or block their work; a
    // dropped batch here is an acceptable loss, there's no business-critical data in this queue.
  }
}

setApiErrorTracker((path, status, message) => {
  trackEvent("error", "api_error", { path, status, message: message.slice(0, 300) });
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => void flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
  window.addEventListener("error", (e) => {
    trackEvent("error", "window.onerror", { message: e.message, filename: e.filename, lineno: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    trackEvent("error", "unhandledrejection", { message: reason?.message ?? String(reason) });
  });
}
