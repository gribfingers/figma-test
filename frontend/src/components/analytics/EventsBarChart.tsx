import { useState } from "react";
import { useLanguage } from "../../i18n";

interface Point {
  day: string;
  count: number;
}

/**
 * Events-per-day bar chart — single series (one hue, var(--accent)), thin bars with rounded data
 * ends, per-bar hover tooltip. No axis clutter beyond the first/last date; a day-granularity trend
 * like this doesn't need gridlines to be readable.
 */
export function EventsBarChart({ data }: { data: Point[] }) {
  const { t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <div className="analytics-empty">{t("No data for this range.")}</div>;

  const max = Math.max(1, ...data.map((d) => d.count));
  const unit = 10;
  const barWidth = 8;
  // preserveAspectRatio="none" stretches the viewBox to fill whatever width the SVG element is
  // given — capping that width (instead of always 100%) keeps bars a sane, bounded size when
  // there's only a handful of days, rather than one day's bar ballooning to fill the whole panel.
  const pxWidth = Math.min(760, Math.max(160, data.length * 36));

  return (
    <div className="analytics-bar-chart">
      <div className="analytics-bar-chart-inner" style={{ width: pxWidth, maxWidth: "100%" }}>
        <svg
          viewBox={`0 0 ${data.length * unit} 100`}
          preserveAspectRatio="none"
          className="analytics-bar-chart-svg"
          onMouseLeave={() => setHover(null)}
        >
          {data.map((d, i) => {
            const h = Math.max(1, (d.count / max) * 92);
            const x = i * unit + (unit - barWidth) / 2;
            return (
              <rect
                key={d.day}
                x={x}
                y={100 - h}
                width={barWidth}
                height={h}
                rx={1.4}
                className={`analytics-bar ${hover === i ? "hover" : ""}`}
                onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
        <div className="analytics-bar-chart-axis">
          <span>{data[0].day}</span>
          <span>{data[data.length - 1].day}</span>
        </div>
        {hover !== null && (
          <div className="analytics-bar-tooltip" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
            <div className="analytics-bar-tooltip-day">{data[hover].day}</div>
            <div className="analytics-bar-tooltip-count">{data[hover].count.toLocaleString("ru-RU")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
