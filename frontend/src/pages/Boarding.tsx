import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Flight, Passenger } from "../api";

const STATUS_BADGE: Record<string, string> = {
  BOARDED: "ok",
  NOT_BOARDED: "muted",
  OFFLOADED: "danger",
  NO_SHOW: "warn",
};

export function Boarding() {
  const { flightId } = useParams();
  const fid = Number(flightId);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [scanValue, setScanValue] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [manifest, setManifest] = useState<{ label: string; text: string } | null>(null);

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
      setMessage({ kind: "ok", text: `Допущен на посадку: ${passenger.surname}/${passenger.given_name}, место ${passenger.seat}` });
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
    if (!confirm("Закрыть рейс? Незарегистрированные на посадку пассажиры будут отмечены как NO SHOW.")) return;
    const { flight: updated, pfs } = await api.closeFlight(fid);
    setFlight(updated);
    setManifest({ label: "PFS (итоговый список после закрытия рейса)", text: pfs });
    refresh();
  }

  async function showPnl() {
    const text = await api.pnl(fid);
    setManifest({ label: "PNL (список пассажиров)", text });
  }
  async function showPfs() {
    const text = await api.pfs(fid);
    setManifest({ label: "PFS (текущий предварительный итог)", text });
  }

  if (!flight) return <div className="content">Загрузка…</div>;
  const closed = flight.status === "CLOSED" || flight.status === "DEPARTED";

  return (
    <div>
      <Link to="/">← Табло рейсов</Link>
      <h1>Рабочее место агента посадки (гейт)</h1>
      <p className="subtitle">
        Рейс <span className="mono">{flight.carrier_code}{flight.flight_number}</span>{" "}
        {flight.origin} → {flight.destination} ·{" "}
        {new Date(flight.std).toLocaleString("ru-RU", { timeZone: "UTC" })} UTC ·{" "}
        <span className={`badge ${closed ? "danger" : "ok"}`}>{flight.status}</span>
      </p>

      <div className="counters">
        <div className="counter"><div className="num">{counts.total ?? 0}</div><div className="lbl">Всего в PNL</div></div>
        <div className="counter"><div className="num">{counts.checked_in ?? 0}</div><div className="lbl">Зарегистрировано</div></div>
        <div className="counter"><div className="num">{counts.boarded ?? 0}</div><div className="lbl">На борту</div></div>
        <div className="counter"><div className="num">{counts.not_boarded ?? 0}</div><div className="lbl">Ожидают посадки</div></div>
        <div className="counter"><div className="num">{counts.offloaded ?? 0}</div><div className="lbl">Сняты с рейса</div></div>
      </div>

      {message && <div className={message.kind === "ok" ? "ok-box" : "error-box"}>{message.text}</div>}

      <div className="panel">
        <h3>Сканирование посадочного талона (BCBP)</h3>
        <form onSubmit={handleScan} className="toolbar">
          <input
            className="mono"
            placeholder="Вставьте строку BCBP посадочного талона…"
            value={scanValue}
            disabled={closed}
            onChange={(e) => setScanValue(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={closed}>Сканировать</button>
        </form>
      </div>

      <div className="panel">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Пассажиры рейса</h3>
          <div className="spacer" />
          <button className="secondary" onClick={showPnl}>PNL</button>
          <button className="secondary" onClick={showPfs}>PFS (предв.)</button>
          <button className="danger" onClick={closeFlight} disabled={closed}>Закрыть рейс</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>№ рег.</th><th>PNR</th><th>Пассажир</th><th>Место</th><th>SSR</th>
              <th>Регистрация</th><th>Посадка</th><th></th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.checkin_sequence ?? "—"}</td>
                <td className="mono">{p.record_locator}</td>
                <td>{p.surname}/{p.given_name}{p.infant ? " 👶" : ""}</td>
                <td className="mono">{p.seat ?? "—"}</td>
                <td className="mono">{(p.ssr ?? []).join(", ")}</td>
                <td><span className={`badge ${p.checkin_status === "CHECKED_IN" ? "ok" : "muted"}`}>{p.checkin_status === "CHECKED_IN" ? "OK" : "—"}</span></td>
                <td><span className={`badge ${STATUS_BADGE[p.boarding_status]}`}>{p.boarding_status}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  {p.checkin_status === "CHECKED_IN" && p.boarding_status === "NOT_BOARDED" && !closed && (
                    <>
                      <button className="secondary" onClick={() => boardDirectly(p)}>Посадка</button>
                      <button className="danger" onClick={() => offload(p)}>Снять</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
