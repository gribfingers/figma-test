import { SortTh, useSort } from "../SortTh";

interface TransferRow {
  flight: string;
  route: string;
  time: string;
  pax: number;
  bag: number;
  delay?: string;
}

type TransferSortKey = "flight" | "route" | "time" | "pax" | "bag" | "delay";
const TRANSFER_SORT_GETTERS: Record<TransferSortKey, (r: TransferRow) => string | number> = {
  flight: (r) => r.flight,
  route: (r) => r.route,
  time: (r) => r.time,
  pax: (r) => r.pax,
  bag: (r) => r.bag,
  delay: (r) => r.delay ?? "",
};

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
  const { sorted, sortKey, sortDir, onSort } = useSort(rows, TRANSFER_SORT_GETTERS);
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <SortTh id="flight" label="Flight" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="route" label="Route" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="time" label="Time" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="pax" label="Passengers" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="bag" label="Baggage" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="delay" label="Delay" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
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
