import { FlightSegment } from "../flightSegments";

interface Props {
  segments: FlightSegment[];
  selected: number;
  onSelect: (index: number) => void;
}

/** One pill per leg of the flight — "SVO → LED", "LED → PEE", ... — for screens whose content is scoped to a single segment (e.g. document verification). */
export function SegmentToggle({ segments, selected, onSelect }: Props) {
  if (segments.length <= 1) return null;
  return (
    <div className="segment-toggle">
      {segments.map((s, i) => (
        <button
          key={i}
          type="button"
          className={`segment-toggle-pill ${i === selected ? "selected" : ""}`}
          onClick={() => onSelect(i)}
        >
          {s.origin} → {s.destination}
        </button>
      ))}
    </div>
  );
}
