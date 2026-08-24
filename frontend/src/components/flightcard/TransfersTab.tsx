interface TransferRow {
  flight: string;
  route: string;
  time: string;
  pax: number;
  bag: number;
  delay?: string;
}

// Connecting-flight data isn't modelled in the backend yet — sample rows,
// same shape as the Figma reference, stand in until that exists.
const INBOUND: TransferRow[] = [
  { flight: "SU2112", route: "MOW-CDG", time: "11:30", pax: 4, bag: 8 },
  { flight: "TG444", route: "BKK-CDG", time: "12:00", pax: 2, bag: 4, delay: "25 MIN" },
  { flight: "LH1234", route: "MOW-CDG", time: "12:30", pax: 1, bag: 2 },
];
const OUTBOUND: TransferRow[] = [
  { flight: "AF1234", route: "CDG-TLS", time: "17:20", pax: 4, bag: 8 },
  { flight: "DL212", route: "CDG-ATL", time: "18:00", pax: 2, bag: 4, delay: "25 MIN" },
];

function TransferTable({ title, rows }: { title: string; rows: TransferRow[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Flight</th>
            <th>Route</th>
            <th>Time</th>
            <th>Passengers</th>
            <th>Baggage</th>
            <th>Delay</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.flight}>
              <td className="mono link-text">{r.flight}</td>
              <td className="mono">{r.route}</td>
              <td className="mono">{r.time}</td>
              <td>{r.pax}</td>
              <td>{r.bag}</td>
              <td>{r.delay && <span className="chip middle danger">{r.delay}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TransfersTab() {
  return (
    <div className="grid-2">
      <TransferTable title="Inbound" rows={INBOUND} />
      <TransferTable title="Outbound" rows={OUTBOUND} />
    </div>
  );
}
