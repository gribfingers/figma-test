import { Passenger } from "../api";

/**
 * Renders the checked-in passenger's boarding pass. The bar pattern below
 * the BCBP string is a stylised visual only (not a scannable PDF417/QR
 * render) — the raw BCBP string is what the gate workstation actually
 * decodes.
 */
export function BoardingPassCard({ passenger, flightLabel, route }: { passenger: Passenger; flightLabel: string; route: string }) {
  if (!passenger.bcbp) return null;
  const bars = Array.from(passenger.bcbp).map((c) => (c.charCodeAt(0) % 4) + 1);

  return (
    <div className="panel" style={{ background: "#0d1420", color: "#fff" }}>
      <h3 style={{ color: "#9db8e8" }}>Boarding pass</h3>
      <div className="grid-2">
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{passenger.surname}/{passenger.given_name}</div>
          <div className="mono" style={{ marginTop: 4, color: "#b9c4d6" }}>{flightLabel} · {route}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Seat <b>{passenger.seat}</b></div>
          <div>Seq. # {String(passenger.checkin_sequence).padStart(4, "0")}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 30, margin: "12px 0 6px" }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 2, height: `${h * 7}px`, background: "#fff" }} />
        ))}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "#7f8ea6", wordBreak: "break-all" }}>{passenger.bcbp}</div>
    </div>
  );
}
