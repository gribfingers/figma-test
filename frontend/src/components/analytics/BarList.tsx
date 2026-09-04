interface BarListItem {
  key: string;
  label: string;
  count: number;
}

/** Ranked horizontal bar list — Top pages / Top actions. Single hue, direct count labels (a rank
 *  list's whole point is the numbers, so these aren't "selective" — every row gets one). */
export function BarList({ items, emptyLabel }: { items: BarListItem[]; emptyLabel: string }) {
  if (items.length === 0) return <div className="analytics-empty">{emptyLabel}</div>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="analytics-bar-list">
      {items.map((item) => (
        <div key={item.key} className="analytics-bar-list-row">
          <span className="analytics-bar-list-label" title={item.label}>
            {item.label}
          </span>
          <div className="analytics-bar-list-track">
            <div className="analytics-bar-list-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="analytics-bar-list-count">{item.count.toLocaleString("ru-RU")}</span>
        </div>
      ))}
    </div>
  );
}
