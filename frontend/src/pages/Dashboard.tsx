import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Flight } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { DateTimePicker } from "../components/DateTimePicker";
import { RefreshIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
import { useRegisterTab } from "../tabs";

const OPS_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  DELAYED: "Delayed",
  BOARDING: "Boarding",
  DEPARTED: "Departed",
  ARRIVED: "Arrived",
  CANCELLED: "Cancelled",
};
const OPS_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "ok",
  DELAYED: "warn",
  BOARDING: "warn",
  DEPARTED: "muted",
  ARRIVED: "muted",
  CANCELLED: "danger",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
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
  ops_status: (f) => OPS_STATUS_LABEL[f.ops_status] ?? f.ops_status,
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

export function Dashboard() {
  useRegisterTab("Flights", false);
  const navigate = useNavigate();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");

  // Row 1: broader search, applied on "Search" (or Reset).
  const [draftSearch, setDraftSearch] = useState(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState(EMPTY_SEARCH);
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
      <h1>Flight board</h1>
      <p className="subtitle">Ops desk: search the schedule and jump to agent workstations.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <form onSubmit={runSearch}>
          <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select
              label="Airline"
              style={{ minWidth: 120 }}
              value={draftSearch.airline}
              onChange={(v) => setDraftSearch({ ...draftSearch, airline: v })}
              options={[{ value: "", label: "All" }, ...airlines.map((a) => ({ value: a, label: a }))]}
            />
            <Field label="Flight range" style={{ minWidth: 130 }}>
              <input value={draftSearch.flight} onChange={(e) => setDraftSearch({ ...draftSearch, flight: e.target.value })} placeholder=" " />
            </Field>
            <Select
              label="Departure"
              style={{ minWidth: 120 }}
              value={draftSearch.origin}
              onChange={(v) => setDraftSearch({ ...draftSearch, origin: v })}
              options={[{ value: "", label: "All" }, ...origins.map((o) => ({ value: o, label: o }))]}
            />
            <Select
              label="Destination"
              style={{ minWidth: 120 }}
              value={draftSearch.destination}
              onChange={(v) => setDraftSearch({ ...draftSearch, destination: v })}
              options={[{ value: "", label: "All" }, ...destinations.map((d) => ({ value: d, label: d }))]}
            />
            <DateTimePicker
              label="Date/time from"
              style={{ minWidth: 170 }}
              value={draftSearch.dateFrom}
              onChange={(v) => setDraftSearch({ ...draftSearch, dateFrom: v })}
            />
            <DateTimePicker
              label="Date/time to"
              style={{ minWidth: 170 }}
              value={draftSearch.dateTo}
              onChange={(v) => setDraftSearch({ ...draftSearch, dateTo: v })}
            />
            <button type="submit" disabled={searchIsUnchanged}>Search</button>
            <div className="spacer" />
            <Link to="/flights/new"><button type="button" className="secondary">New flight</button></Link>
            <button type="button" className="icon-button" onClick={load} title="Refresh">
              <RefreshIcon size={20} />
            </button>
          </div>
        </form>
      </div>

      <div className="panel panel--flush">
        <h3 className="panel-head">Flights ({visibleFlights.length})</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th><input placeholder="STD" disabled style={{ width: "100%", opacity: 0.4 }} /></th>
                <th><input placeholder="Airline" value={quick.airline} onChange={(e) => setQuick({ ...quick, airline: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder="Flight" value={quick.flight} onChange={(e) => setQuick({ ...quick, flight: e.target.value })} style={{ width: "100%" }} /></th>
                <th colSpan={2}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder="Departure" value={quick.origin} onChange={(e) => setQuick({ ...quick, origin: e.target.value })} style={{ width: "100%" }} />
                    <input placeholder="Destination" value={quick.destination} onChange={(e) => setQuick({ ...quick, destination: e.target.value })} style={{ width: "100%" }} />
                  </div>
                </th>
                <th><input placeholder="ETD" value={quick.etd} onChange={(e) => setQuick({ ...quick, etd: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder="STA" value={quick.sta} onChange={(e) => setQuick({ ...quick, sta: e.target.value })} style={{ width: "100%" }} /></th>
                <th><input placeholder="ATA" value={quick.ata} onChange={(e) => setQuick({ ...quick, ata: e.target.value })} style={{ width: "100%" }} /></th>
                <th colSpan={5}></th>
              </tr>
              <tr>
                <SortTh id="std" label="STD" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="carrier_code" label="Airline" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="flight_number" label="Flight" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="route" label="Route" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="ops_status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="etd" label="ETD" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="sta" label="STA" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="ata" label="ATA" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="terminal" label="Terminal" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="gate" label="Gate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_type" label="Type" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_reg" label="A/C reg" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="aircraft_version" label="Version" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sortedFlights.map((f) => (
                <tr key={f.id} className="row-hover" onClick={() => navigate(`/flights/${f.id}`)}>
                  <td className="mono">{formatTime(f.std)}</td>
                  <td>{f.carrier_code}</td>
                  <td className="mono">{f.flight_number}</td>
                  <td className="mono">{f.origin} → {f.destination}</td>
                  <td><span className={`chip middle ${OPS_STATUS_BADGE[f.ops_status] ?? "muted"}`}>{OPS_STATUS_LABEL[f.ops_status] ?? f.ops_status}</span></td>
                  <td className="mono">{formatTime(f.etd)}</td>
                  <td className="mono">{formatTime(f.sta)}</td>
                  <td className="mono">{formatTime(f.ata)}</td>
                  <td className="mono">{f.terminal ?? "—"}</td>
                  <td className="mono">{f.gate ?? "—"}</td>
                  <td>{f.aircraft_type}</td>
                  <td className="mono">{f.aircraft_reg ?? "—"}</td>
                  <td className="mono">{f.aircraft_version ?? "—"}</td>
                </tr>
              ))}
              {visibleFlights.length === 0 && (
                <tr><td colSpan={13} style={{ color: "var(--muted)" }}>No flights match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
