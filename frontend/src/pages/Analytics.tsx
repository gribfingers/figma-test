import { useEffect, useState } from "react";
import { api, AnalyticsEventRow, AnalyticsRange, AnalyticsSummary } from "../api";
import { useAuth } from "../auth";
import { useRegisterTab } from "../tabs";
import { useLanguage } from "../i18n";
import { Select } from "../components/Select";
import { RefreshIcon } from "../components/Icon";
import { EventsBarChart } from "../components/analytics/EventsBarChart";
import { BarList } from "../components/analytics/BarList";

const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "page_view", label: "Page views" },
  { value: "action", label: "Actions" },
  { value: "shortcut", label: "Shortcuts" },
  { value: "error", label: "Errors" },
];

function fmtTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return d.toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function shortDetail(detail: string | null): string {
  if (!detail) return "";
  try {
    const obj = JSON.parse(detail);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v.slice(0, 60) : JSON.stringify(v)}`)
      .join(", ");
  } catch {
    return detail;
  }
}

/**
 * UX analytics dashboard, superadmin only — reads what analytics.ts's client-side tracker (page
 * views, actions, keyboard shortcuts, JS/API errors, all queued and batched — see analytics.ts)
 * has recorded, via the /api/analytics endpoints (routes/analytics.ts).
 */
export function Analytics() {
  const { t } = useLanguage();
  const { user } = useAuth();
  useRegisterTab("UX Analytics", true);

  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [eventType, setEventType] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [eventsResult, setEventsResult] = useState<{ total: number; pageSize: number; events: AnalyticsEventRow[] } | null>(null);

  function loadSummary() {
    setLoading(true);
    setError("");
    api
      .analyticsSummary(range)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(loadSummary, [range]);

  useEffect(() => {
    api
      .analyticsEvents(range, eventType, query, page)
      .then(setEventsResult)
      .catch(() => {});
  }, [range, eventType, query, page]);

  useEffect(() => setPage(1), [range, eventType, query]);

  if (user?.role !== "superadmin") {
    return (
      <div>
        <h1>{t("UX Analytics")}</h1>
        <p className="subtitle">{t("Superadmin only.")}</p>
      </div>
    );
  }

  const totalPages = eventsResult ? Math.max(1, Math.ceil(eventsResult.total / eventsResult.pageSize)) : 1;

  return (
    <div className="analytics-page">
      <div className="toolbar" style={{ margin: 0 }}>
        <h1 style={{ margin: 0, flex: 1 }}>{t("UX Analytics")}</h1>
        <div className="analytics-range-pills">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`quick-status-pill ${range === r.key ? "selected" : ""}`}
              onClick={() => setRange(r.key)}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" title={t("Refresh")} onClick={loadSummary}>
          <RefreshIcon size={18} />
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {summary && (
        <>
          <div className="analytics-stats">
            <div className="analytics-stat-card">
              <div className="analytics-stat-value">{summary.totals.totalEvents.toLocaleString("ru-RU")}</div>
              <div className="analytics-stat-label">{t("Total events")}</div>
            </div>
            <div className="analytics-stat-card">
              <div className="analytics-stat-value">{summary.totals.uniqueUsers.toLocaleString("ru-RU")}</div>
              <div className="analytics-stat-label">{t("Unique users")}</div>
            </div>
            <div className="analytics-stat-card">
              <div className="analytics-stat-value">{summary.totals.uniqueSessions.toLocaleString("ru-RU")}</div>
              <div className="analytics-stat-label">{t("Sessions")}</div>
            </div>
            <div className={`analytics-stat-card ${summary.errorCount > 0 ? "analytics-stat-card-danger" : ""}`}>
              <div className="analytics-stat-value">{summary.errorCount.toLocaleString("ru-RU")}</div>
              <div className="analytics-stat-label">{t("Errors")}</div>
            </div>
          </div>

          <div className="panel">
            <div className="analytics-panel-title">{t("Events over time")}</div>
            <EventsBarChart data={summary.eventsByDay} />
          </div>

          <div className="analytics-columns">
            <div className="panel">
              <div className="analytics-panel-title">{t("Top pages")}</div>
              <BarList
                items={summary.topPages.map((p) => ({ key: p.path, label: p.path, count: p.count }))}
                emptyLabel={t("No page views recorded yet.")}
              />
            </div>
            <div className="panel">
              <div className="analytics-panel-title">{t("Top actions & shortcuts")}</div>
              <BarList
                items={summary.topActions.map((a) => ({ key: a.name, label: a.name, count: a.count }))}
                emptyLabel={t("No actions recorded yet.")}
              />
            </div>
          </div>

          <div className="analytics-columns">
            <div className="panel">
              <div className="analytics-panel-title">{t("Most active users")}</div>
              <BarList
                items={summary.activeUsers.map((u) => ({ key: String(u.id), label: `${u.first_name} ${u.last_name}`, count: u.count }))}
                emptyLabel={t("No activity recorded yet.")}
              />
            </div>
            <div className="panel">
              <div className="analytics-panel-title">{t("Recent errors")}</div>
              {summary.recentErrors.length === 0 ? (
                <div className="analytics-empty">{t("No errors recorded — nice.")}</div>
              ) : (
                <div className="analytics-error-list">
                  {summary.recentErrors.map((e, i) => (
                    <div key={i} className="analytics-error-row">
                      <div className="analytics-error-row-head">
                        <span className="chip small danger">{e.name}</span>
                        <span className="analytics-error-time">{fmtTime(e.created_at)}</span>
                      </div>
                      <div className="analytics-error-detail">{shortDetail(e.detail)}</div>
                      {(e.first_name || e.path) && (
                        <div className="analytics-error-meta">
                          {e.first_name && `${e.first_name} ${e.last_name}`}
                          {e.first_name && e.path && " · "}
                          {e.path}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {loading && !summary && <div className="content">{t("Loading…")}</div>}

      <div className="panel panel--flush">
        <div className="toolbar panel-head">
          <div className="analytics-panel-title" style={{ flex: 1 }}>
            {t("Event log")}
          </div>
          <Select
            label={t("Type")}
            value={eventType}
            onChange={setEventType}
            options={EVENT_TYPE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
            style={{ minWidth: 160 }}
          />
          <input className="search-mode-input" style={{ maxWidth: 240 }} placeholder={t("Search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("Type")}</th>
                <th>{t("Name")}</th>
                <th>{t("Path")}</th>
                <th>{t("User")}</th>
                <th>{t("Detail")}</th>
              </tr>
            </thead>
            <tbody>
              {(eventsResult?.events ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{fmtTime(e.created_at)}</td>
                  <td>
                    <span className={`chip small ${e.type === "error" ? "danger" : "muted"}`}>{e.type}</span>
                  </td>
                  <td>{e.name}</td>
                  <td className="mono">{e.path ?? "—"}</td>
                  <td>{e.first_name ? `${e.first_name} ${e.last_name}` : "—"}</td>
                  <td className="analytics-event-detail-cell">{shortDetail(e.detail)}</td>
                </tr>
              ))}
              {eventsResult && eventsResult.events.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--muted)" }}>
                    {t("No events match.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {eventsResult && eventsResult.total > eventsResult.pageSize && (
          <div className="analytics-pagination">
            <button type="button" className="tertiary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("Previous")}
            </button>
            <span className="analytics-pagination-label">
              {t("Page {n} of {total}").replace("{n}", String(page)).replace("{total}", String(totalPages))}
            </span>
            <button type="button" className="tertiary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t("Next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
