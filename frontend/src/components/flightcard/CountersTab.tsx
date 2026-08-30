import { useLanguage } from "../../i18n";

interface CounterTableProps {
  title: string;
  columns?: string[];
  rows: { label: string; values: (string | number)[] }[];
}

// Seat/SSR/pax/baggage breakdowns aren't tracked per cabin class in the
// backend yet, so this whole tab renders illustrative sample figures —
// same shape as the Figma reference — until that data model exists.
function CounterTable({ title, columns = ["C", "Y", "W"], rows }: CounterTableProps) {
  const { t } = useLanguage();
  return (
    <div className="counter-table">
      <div className="counter-table-row head" style={{ gridTemplateColumns: `1fr repeat(${columns.length}, 56px)` }}>
        <div className="counter-table-title">{t(title)}</div>
        {columns.map((c) => (
          <div key={c} className="counter-table-col">
            {c}
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          className="counter-table-row"
          style={{ gridTemplateColumns: `1fr repeat(${r.values.length}, 56px)` }}
        >
          <div className="counter-table-label">{t(r.label)}</div>
          {r.values.map((v, i) => (
            <div key={i} className="counter-table-value">
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CountersTab() {
  return (
    <div className="counters-grid">
      <div className="counters-col">
        <CounterTable
          title="Seats"
          rows={[
            { label: "Version", values: [10, 20, 100] },
            { label: "Available", values: [9, 20, 90] },
            { label: "Booked", values: [6, 10, 51] },
          ]}
        />
        <div className="counters-row-2">
          <CounterTable title="S/A" columns={[]} rows={[{ label: "", values: [1, 3] }]} />
          <CounterTable
            title="Seats"
            columns={["JMS", "JMS"]}
            rows={[{ label: "Available", values: [1, 3] }]}
          />
        </div>
      </div>

      <CounterTable
        title="SSR"
        rows={[
          { label: "CHLD", values: [0, 1, 10] },
          { label: "INFT", values: [1, 0, 1] },
          { label: "UMNR", values: [0, 0, 1] },
          { label: "STCR", values: ["", "", 1] },
          { label: "WCHR", values: ["", 1, 2] },
          { label: "PETC", values: ["", "", 1] },
        ]}
      />

      <div className="counters-col">
        <CounterTable
          title="Pax statuses"
          rows={[
            { label: "Not checked", values: [2, 5, 78] },
            { label: "Checked-in", values: [3, 5, 6] },
            { label: "Refused", values: [0, 0, 1] },
            { label: "Boarded", values: [0, 2, 2] },
          ]}
        />
        <CounterTable
          title="Baggage"
          rows={[
            { label: "Weight, kg", values: [75, 234, 440] },
            { label: "Pieces", values: [9, 20, 90] },
            { label: "Cabin", values: [5, 10, 15] },
            { label: "Crew", values: ["", "", ""] },
          ]}
        />
      </div>
    </div>
  );
}
