import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Flight } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { DateTimePicker } from "../components/DateTimePicker";
import { RefreshIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
import { useRegisterTab } from "../tabs";
import { fullRouteLabel, routeLabel } from "../flightSegments";
import { currentPhaseIndex, phaseStatusLabel } from "../flightPhase";
import { useLanguage } from "../i18n";
import { useCanEdit } from "../auth";
import { clickable } from "../interactive";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
}

type FlightSortKey =
  | "std" | "carrier_code" | "flight_number" | "route" | "ops_status"
  | "etd" | "sta" | "ata" | "terminal" | "gate" | "aircraft_type" | "aircraft_reg" | "aircraft_version";

function toEpoch(iso: string | null): number {
  return iso ? new Date(iso).getTime() : -Infinity;
}

const FLIGHT_SORT_GETTERS: Record<FlightSortKey, (f: Flight) => string | number> = {
  std: (f) => toEpoch(f.std),
  carrier_code: (f) => f.carrier_code,
  flight_number: (f) => f.flight_number,
  route: (f) => `${f.origin}${f.destination}`,
  ops_status: (f) => currentPhaseIndex(f, new Date()),
  etd: (f) => toEpoch(f.etd),
  sta: (f) => toEpoch(f.sta),
  ata: (f) => toEpoch(f.ata),
  terminal: (f) => f.terminal ?? "",
  gate: (f) => f.gate ?? "",
  aircraft_type: (f) => f.aircraft_type,
  aircraft_reg: (f) => f.aircraft_reg ?? "",
  aircraft_version: (f) => f.aircraft_version ?? "",
};

const EMPTY_SEARCH = { airline: "", flight: "", origin: "", destination: "", dateFrom: "", dateTo: "" };
const EMPTY_QUICK = { airline: "", flight: "", origin: "", destination: "", std: "", etd: "", sta: "", ata: "" };

// Board defaults to today's flights (UTC, same wall-clock convention std
// uses everywhere else) rather than every flight ever scheduled — still
// just a starting point for the date-range fields, not a hard limit.
function todaySearch(): typeof EMPTY_SEARCH {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  return { ...EMPTY_SEARCH, dateFrom: `${day}T00:00`, dateTo: `${day}T23:59` };
}

// DateTimePicker's "YYYY-MM-DDTHH:mm" value is already UTC wall-clock
// digits (see its own parseValue/toValue — no timezone conversion), so
// these read/write those digits directly with Date.UTC rather than letting
// `new Date(str)` parse it as the browser's local time.
function wallClockMs(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}
function msToWallClock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function Dashboard() {
  const { t } = useLanguage();
  useRegisterTab(t("Flights"));
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  // Ticks so the Status column's phase-derived label (Check-in/Boarding/…)
  // keeps up with real time even between flight-list refreshes.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Row 1: broader search, applied on "Search" (or Reset).
  const [draftSearch, setDraftSearch] = useState(todaySearch);
  const [appliedSearch, setAppliedSearch] = useState(todaySearch);
  // Row 2: live per-column quick filters, applied as you type.
  const [quick, setQuick] = useState(EMPTY_QUICK);

  function load() {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const airlines = useMemo(() => Array.from(new Set(flights.map((f) => f.carrier_code))).sort(), [flights]);
  const origins = useMemo(() => Array.from(new Set(flights.map((f) => f.origin))).sort(), [flights]);
  const destinations = useMemo(() => Array.from(new Set(flights.map((f) => f.destination))).sort(), [flights]);

  const visibleFlights = useMemo(() => {
    return flights.filter((f) => {
      if (appliedSearch.airline && f.carrier_code !== appliedSearch.airline) return false;
      if (appliedSearch.flight && !f.flight_number.includes(appliedSearch.flight.trim())) return false;
      if (appliedSearch.origin && f.origin !== appliedSearch.origin) return false;
      if (appliedSearch.destination && f.destination !== appliedSearch.destination) return false;
      if (appliedSearch.dateFrom && new Date(f.std) < new Date(appliedSearch.dateFrom)) return false;
      if (appliedSearch.dateTo && new Date(f.std) > new Date(appliedSearch.dateTo)) return false;

      if (quick.airline && !f.carrier_code.toLowerCase().includes(quick.airline.toLowerCase())) return false;
      if (quick.flight && !f.flight_number.toLowerCase().includes(quick.flight.toLowerCase())) return false;
      if (quick.origin && !f.origin.toLowerCase().includes(quick.origin.toLowerCase())) return false;
      if (quick.destination && !f.destination.toLowerCase().includes(quick.destination.toLowerCase())) return false;
      if (quick.std && !formatTime(f.std).includes(quick.std)) return false;
      if (quick.etd && !formatTime(f.etd).includes(quick.etd)) return false;
      if (quick.sta && !formatTime(f.sta).includes(quick.sta)) return false;
      if (quick.ata && !formatTime(f.ata).includes(quick.ata)) return false;
      return true;
    });
  }, [flights, appliedSearch, quick]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(draftSearch);
  }
  const searchIsUnchanged = JSON.stringify(draftSearch) === JSON.stringify(appliedSearch);

  const { sorted: sortedFlights, sortKey, sortDir, onSort } = useSort<Flight, FlightSortKey>(visibleFlights, FLIGHT_SORT_GETTERS, "std");

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <form onSubmit={runSearch}>
          <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select
              label={t("Airline")}
              style={{ minWidth: 120 }}
              value={draftSearch.airline}
              onChange={(v) => setDraftSearch({ ...draftSearch, airline: v })}
              options={[{ value: "", label: t("All") }, ...airlines.map((a) => ({ value: a, label: a }))]}
            />
            <Field label={t("Flight range")} style={{ minWidth: 130 }}>
              <input value={draftSearch.flight} onChange={(e) => setDraftSearch({ ...draftSearch, flight: e.target.value })} placeholder=" " />
            </Field>
            <Select
              label={t("Departure")}
              style={{ minWidth: 120 }}
              value={draftSearch.origin}
              onChange={(v) => setDraftSearch({ ...draftSearch, origin: v })}
              options={[{ value: "", label: t("All") }, ...origins.map((o) => ({ value: o, label: o }))]}
            />
            <Select
              label={t("Destination")}
              style={{ minWidth: 120 }}
              value={draftSearch.destination}
              onChange={(v) => setDraftSearch({ ...draftSearch, destination: v })}
              options={[{ value: "", label: t("All") }, ...destinations.map((d) => ({ value: d, label: d }))]}
            />
            <DateTimePicker
              label={t("Date/time from")}
              style={{ minWidth: 194 }}
              value={draftSearch.dateFrom}
              onChange={(v) => {
                // Shift "to" along by the same gap it already had from "from"
                // (a fresh day's worth, by default) — otherwise picking a
                // later "from" can leave "to" behind it, an impossible range.
                const oldFromMs = wallClockMs(draftSearch.dateFrom);
                const oldToMs = wallClockMs(draftSearch.dateTo);
                const newFromMs = wallClockMs(v);
                if (oldFromMs != null && oldToMs != null && newFromMs != null && oldToMs > oldFromMs) {
                  setDraftSearch({ ...draftSearch, dateFrom: v, dateTo: msToWallClock(newFromMs + (oldToMs - oldFromMs)) });
                } else {
                  setDraftSearch({ ...draftSearch, dateFrom: v });
                }
              }}
            />
            <DateTimePicker
              label={t("Date/time to")}
              style={{ minWidth: 194 }}
              value={draftSearch.dateTo}
              onChange={(v) => setDraftSearch({ ...draftSearch, dateTo: v })}
            />
            <button type="submit" disabled={searchIsUnchanged}>{t("Search")}</button>
            <div className="spacer" />
            {canEdit && (
              <Link to="/flights/new"><button type="button" className="secondary">{t("New flight")}</button></Link>
            )}
            <button type="button" className="icon-button" onClick={load} title={t("Refresh")}>
              <RefreshIcon size={20} />
            </button>
          </div>
        </form>
      </div>

      <div className="panel panel--flush">
        <h3 className="panel-head">{t("Flights")} ({visibleFlights.length})</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th><input placeholder="STD" disabled style={{ width: "100%", opacity: 0.4 }} /></th>
                <th><input placeholder={t("Airline")} value={quick.airline} onChange={(e) => setQuick({ ...quick, airline: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder={t("Flight")} value={quick.flight} onChange={(e) => setQuick({ ...quick, flight: e.target.value })} style={{ width: "100%" }} /></th>
                <th colSpan={2}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder={t("Departure")} value={quick.origin} onChange={(e) => setQuick({ ...quick, origin: e.target.value })} style={{ width: "100%" }} />
                    <input placeholder={t("Destination")} value={quick.destination} onChange={(e) => setQuick({ ...quick, destination: e.target.value })} style={{ width: "100%" }} />
                  </div>
                </th>
                <th><input placeholder="ETD" value={quick.etd} onChange={(e) => setQuick({ ...quick, etd: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder="STA" value={quick.sta} onChange={(e) => setQuick({ ...quick, sta: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder="ATA" value={quick.ata} onChange={(e) => setQuick({ ...quick, ata: e.target.value })} style={{ width: "100%" }} /></th>
                <th colSpan={5}></th>
              </tr>
              <tr>
                <SortTh id="std" label="STD" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="carrier_code" label={t("Airline")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="flight_number" label={t("Flight")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="route" label={t("Route")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="ops_status" label={t("Status")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="etd" label="ETD" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="sta" label="STA" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="ata" label="ATA" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="terminal" label={t("Terminal")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="gate" label={t("Gate")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_type" label={t("Type")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_reg" label={t("A/C reg")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_version" label={t("Version")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sortedFlights.map((f) => {
                const status = phaseStatusLabel(f, now);
                return (
                <tr key={f.id} className="row-hover" onClick={() => navigate(`/flights/${f.id}`)} {...clickable(() => navigate(`/flights/${f.id}`))}>
                  <td className="mono">{formatTime(f.std)}</td>
                  <td>{f.carrier_code}</td>
                  <td className="mono">{f.flight_number}</td>
                  <td className="mono" title={fullRouteLabel(f)}>{routeLabel(f)}</td>
                  <td><span className={`chip middle ${status.badge}`}>{t(status.label)}</span></td>
                  <td className="mono">{formatTime(f.etd)}</td>
                  <td className="mono">{formatTime(f.sta)}</td>
                  <td className="mono">{formatTime(f.ata)}</td>
                  <td className="mono">{f.terminal}</td>
                  <td className="mono">{f.gate}</td>
                  <td>{f.aircraft_type}</td>
                  <td className="mono">{f.aircraft_reg}</td>
                  <td className="mono">{f.aircraft_version}</td>
                </tr>
                );
              })}
              {visibleFlights.length === 0 && (
                <tr><td colSpan={13} style={{ color: "var(--muted)" }}>{t("No flights match the current filters.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
