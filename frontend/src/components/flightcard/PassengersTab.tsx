import { useEffect, useState } from "react";
import { api, Flight, Passenger, SeatCell } from "../../api";
import { SeatMapGrid } from "../SeatMapGrid";
import { SearchIcon } from "../Icon";

interface Props {
  flight: Flight;
}

// Full column set (services, ASVC, waitlist, iAPP, inbound/outbound, bag,
// age, gender…) is being scoped separately — this is a first pass with the
// columns backed by the current Passenger model.
function statusChip(p: Passenger) {
  if (p.boarding_status === "BOARDED") return <span className="chip middle ok">Boarded</span>;
  if (p.boarding_status === "OFFLOADED") return <span className="chip middle danger">Offloaded</span>;
  if (p.checkin_status === "CHECKED_IN") return <span className="chip middle warn">Checked-in</span>;
  return <span className="chip middle muted">Not checked</span>;
}

export function PassengersTab({ flight }: Props) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    api.passengers(flight.id, query).then(setPassengers);
  }, [flight.id, query]);
  useEffect(() => {
    api.seatmap(flight.id).then(setSeats);
  }, [flight.id]);

  const activeSeat = passengers.find((p) => p.id === activeId)?.seat ?? null;

  return (
    <div className="passengers-tab">
      <div className="passengers-list">
        <div className="toolbar">
          <div className="input-box" style={{ flex: 1, maxWidth: 280 }}>
            <SearchIcon size={16} />
            <input placeholder="Search passengers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="spacer" />
          <span className="passengers-count">{passengers.length} passengers</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Seat</th>
                <th>Status</th>
                <th>Services</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setActiveId(p.id)}>
                  <td>
                    <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td>
                    {p.surname} {p.given_name}
                  </td>
                  <td className="mono">{p.seat ?? "—"}</td>
                  <td>{statusChip(p)}</td>
                  <td className="mono">{(p.ssr ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
              {passengers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    No passengers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="passengers-seatmap">
        <SeatMapGrid seats={seats} selected={activeSeat} />
      </div>
    </div>
  );
}
