import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Flight } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { SortTh, useSort } from "../components/SortTh";
import { useRegisterTab } from "../tabs";
import { useLanguage } from "../i18n";
import { useHotkey } from "../useShortcuts";
import { clickable } from "../interactive";

// Matches Search.tsx's fmtStd — same UTC wall-clock convention as the rest of the app.
function fmtStd(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }).toUpperCase();
  const year = d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${day}${month}${year} ${time}`;
}

type BoardingSortKey = "flight" | "route" | "std" | "gate" | "status";

const SORT_GETTERS: Record<BoardingSortKey, (f: Flight) => string | number> = {
  flight: (f) => `${f.carrier_code}${f.flight_number}`,
  route: (f) => `${f.origin}${f.destination}`,
  std: (f) => new Date(f.std).getTime(),
  gate: (f) => f.gate ?? "",
  status: (f) => f.status,
};

const OPEN_STATUSES = ["CHECKIN_OPEN", "BOARDING"] as const;

/**
 * Boarding/gate workstation, landing screen: lists every flight currently
 * open for check-in or boarding (status CHECKIN_OPEN/BOARDING) so a gate
 * agent can find theirs and open its boarding screen (/boarding/:flightId).
 * Flight-number search plus status/departure/arrival filters narrow that
 * base list further; the table itself is fully sortable.
 */
export function BoardingSearch() {
  const { t } = useLanguage();
  useRegisterTab(t("Boarding Search"));
  const navigate = useNavigate();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const queryInputRef = useRef<HTMLInputElement>(null);
  useHotkey("nav.search-focus", () => queryInputRef.current?.focus());

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  const openFlights = useMemo(
    () => flights.filter((f) => (OPEN_STATUSES as readonly string[]).includes(f.status)),
    [flights]
  );

  const origins = useMemo(() => Array.from(new Set(openFlights.map((f) => f.origin))).sort(), [openFlights]);
  const destinations = useMemo(() => Array.from(new Set(openFlights.map((f) => f.destination))).sort(), [openFlights]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openFlights.filter((f) => {
      if (q && !`${f.carrier_code}${f.flight_number}`.toLowerCase().includes(q)) return false;
      if (status && f.status !== status) return false;
      if (origin && f.origin !== origin) return false;
      if (destination && f.destination !== destination) return false;
      return true;
    });
  }, [openFlights, query, status, origin, destination]);

  const { sorted: sortedResults, sortKey, sortDir, onSort } = useSort<Flight, BoardingSortKey>(results, SORT_GETTERS, "std");

  function openFlight(f: Flight) {
    navigate(`/boarding/${f.id}`);
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label={t("Flight")} style={{ minWidth: 160 }}>
            <input ref={queryInputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. SU5678" autoFocus />
          </Field>
          <Select
            label={t("Status")}
            style={{ minWidth: 180 }}
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: t("All") }, ...OPEN_STATUSES.map((s) => ({ value: s, label: t(s) }))]}
          />
          <Select
            label={t("Departure")}
            style={{ minWidth: 120 }}
            value={origin}
            onChange={setOrigin}
            options={[{ value: "", label: t("All") }, ...origins.map((o) => ({ value: o, label: o }))]}
          />
          <Select
            label={t("Arrival")}
            style={{ minWidth: 120 }}
            value={destination}
            onChange={setDestination}
            options={[{ value: "", label: t("All") }, ...destinations.map((d) => ({ value: d, label: d }))]}
          />
        </div>
      </div>

      <div className="panel panel--flush">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortTh id="flight" label={t("Flight")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="route" label={t("Route")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="std" label={t("Date&Time")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="gate" label={t("Gate")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="status" label={t("Status")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((f) => (
                <tr key={f.id} className="row-hover" onClick={() => openFlight(f)} {...clickable(() => openFlight(f))}>
                  <td className="mono">{f.carrier_code}{f.flight_number}</td>
                  <td className="mono">{f.origin} → {f.destination}</td>
                  <td className="mono">{fmtStd(f.std)}</td>
                  <td className="mono">{f.gate ?? "—"}</td>
                  <td>
                    <span className={`chip middle ${f.status === "BOARDING" ? "warn" : "ok"}`}>{t(f.status)}</span>
                  </td>
                </tr>
              ))}
              {sortedResults.length === 0 && (
                <tr><td colSpan={5} style={{ color: "var(--muted)" }}>{t("No flights match.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
