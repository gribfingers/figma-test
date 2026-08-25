import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Flight, Passenger } from "../api";
import { ArrowBackIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";

const STATUS_BADGE: Record<string, string> = {
  BOARDED: "ok",
  NOT_BOARDED: "muted",
  OFFLOADED: "danger",
  NO_SHOW: "warn",
};

type BoardingSortKey = "seq" | "pnr" | "passenger" | "seat" | "ssr" | "checkin" | "boarding";
const BOARDING_SORT_GETTERS: Record<BoardingSortKey, (p: Passenger) => string | number> = {
  seq: (p) => p.checkin_sequence ?? Number.MAX_SAFE_INTEGER,
  pnr: (p) => p.record_locator,
  passenger: (p) => `${p.surname}/${p.given_name}`,
  seat: (p) => p.seat ?? "",
  ssr: (p) => (p.ssr ?? []).join(", "),
  checkin: (p) => p.checkin_status,
  boarding: (p) => p.boarding_status,
};

export function Boarding() {
  const { flightId } = useParams();
  const fid = Number(flightId);
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `Boarding ${flight.carrier_code}${flight.flight_number}` : "Boarding");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [scanValue, setScanValue] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);
  const { showToast } = useToast();

  function refresh() {
    api.getFlight(fid).then(setFlight);
    api.boardingList(fid).then((r) => {
      setPassengers(r.passengers);
      setCounts(r.counts);
    });
  }
  useEffect(refresh, [fid]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    try {
      const { passenger } = await api.scanBoardingPass(scanValue.trim());
      setMessage({ kind: "ok", text: `Cleared to board: ${passenger.surname}/${passenger.given_name}, seat ${passenger.seat}` });
      setScanValue("");
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  async function boardDirectly(p: Passenger) {
    if (!p.bcbp) return;
    try {
      await api.scanBoardingPass(p.bcbp);
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  async function offload(p: Passenger) {
    try {
      await api.offload(fid, p.id);
      refresh();
    } catch (e: any) {
      setMessage({ kind: "error", text: e.message });
    }
  }

  async function closeFlight() {
    if (!confirm("Close the flight? Pax checked in but not boarded will be marked NO SHOW.")) return;
    const { flight: updated, pfs } = await api.closeFlight(fid);
    setFlight(updated);
    setManifest({ label: "PFS (final list after flight close-out)", text: pfs });
    refresh();
    showToast("Flight closed");
  }

  async function showPnl() {
    const text = await api.pnl(fid);
    setManifest({ label: "PNL (passenger name list)", text });
  }
  async function showPfs() {
    const text = await api.pfs(fid);
    setManifest({ label: "PFS (current preliminary summary)", text });
  }

  const { sorted: sortedPassengers, sortKey, sortDir, onSort } = useSort(passengers, BOARDING_SORT_GETTERS);

  if (!flight) return <div className="content">Loading…</div>;
  const closed = flight.status === "CLOSED" || flight.status === "DEPARTED";

  return (
    <div>
      <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <ArrowBackIcon size={16} /> Flight board
      </Link>
      <h1>Boarding agent workstation (gate)</h1>
      <p className="subtitle">
        Flight <span className="mono">{flight.carrier_code}{flight.flight_number}</span>{" "}
        {flight.origin} → {flight.destination} ·{" "}
        {new Date(flight.std).toLocaleString("en-GB", { timeZone: "UTC" })} UTC ·{" "}
        <span className={`chip middle ${closed ? "danger" : "ok"}`}>{flight.status}</span>
      </p>

      <div className="counters">
        <div className="counter"><div className="num">{counts.total ?? 0}</div><div className="lbl">Total in PNL</div></div>
        <div className="counter"><div className="num">{counts.checked_in ?? 0}</div><div className="lbl">Checked in</div></div>
        <div className="counter"><div className="num">{counts.boarded ?? 0}</div><div className="lbl">Boarded</div></div>
        <div className="counter"><div className="num">{counts.not_boarded ?? 0}</div><div className="lbl">Awaiting boarding</div></div>
        <div className="counter"><div className="num">{counts.offloaded ?? 0}</div><div className="lbl">Offloaded</div></div>
      </div>

      {message && <div className={message.kind === "ok" ? "ok-box" : "error-box"}>{message.text}</div>}

      <div className="panel">
        <h3>Scan boarding pass (BCBP)</h3>
        <form onSubmit={handleScan} className="toolbar">
          <div style={{ flex: 1 }}>
            <label>BCBP string</label>
            <div className="input-box">
              <input
                className="mono"
                placeholder="Paste the boarding pass BCBP string…"
                value={scanValue}
                disabled={closed}
                onChange={(e) => setScanValue(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" disabled={closed}>Scan</button>
        </form>
      </div>

      <div className="panel panel--flush">
        <div className="toolbar panel-head">
          <h3 style={{ margin: 0 }}>Flight pax</h3>
          <div className="spacer" />
          <button className="secondary" onClick={showPnl}>PNL</button>
          <button className="secondary" onClick={showPfs}>PFS (prelim.)</button>
          <button className="danger" onClick={closeFlight} disabled={closed}>Close flight</button>
        </div>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <SortTh id="seq" label="Seq. #" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="pnr" label="PNR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="passenger" label="Pax" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="seat" label="Seat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="ssr" label="SSR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="checkin" label="Check-in" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh id="boarding" label="Boarding" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedPassengers.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.checkin_sequence}</td>
                <td className="mono">{p.record_locator}</td>
                <td>{p.surname}/{p.given_name}{p.infant ? " 👶" : ""}</td>
                <td className="mono">{p.seat}</td>
                <td className="mono">{(p.ssr ?? []).join(", ")}</td>
                <td>{p.checkin_status === "CHECKED_IN" && <span className="chip middle ok">OK</span>}</td>
                <td><span className={`chip middle ${STATUS_BADGE[p.boarding_status]}`}>{p.boarding_status}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  {p.checkin_status === "CHECKED_IN" && p.boarding_status === "NOT_BOARDED" && !closed && (
                    <>
                      <button className="secondary small" onClick={() => boardDirectly(p)}>Board</button>
                      <button className="danger small" onClick={() => offload(p)}>Offload</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {manifest && (
        <div className="panel">
          <h3>{manifest.label}</h3>
          <pre className="manifest">{manifest.text}</pre>
        </div>
      )}
    </div>
  );
}
