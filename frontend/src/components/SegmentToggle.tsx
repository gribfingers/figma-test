import { useRef } from "react";
import { FlightSegment } from "../flightSegments";

interface Props {
  segments: FlightSegment[];
  selected: number;
  onSelect: (index: number) => void;
}

/** One pill per leg of the flight — "SVO → LED", "LED → PEE", ... — for screens whose content is
 *  scoped to a single segment (e.g. document verification). Roving tabindex, same pattern as any
 *  other tablist in the app (e.g. PnrView's Add pax mode tabs): the selected pill is the one Tab
 *  stop, Left/Right moves (and activates) the next one. */
export function SegmentToggle({ segments, selected, onSelect }: Props) {
  const pillRefs = useRef(new Map<number, HTMLButtonElement>());
  if (segments.length <= 1) return null;

  function move(delta: 1 | -1) {
    const next = (selected + delta + segments.length) % segments.length;
    onSelect(next);
    pillRefs.current.get(next)?.focus();
  }

  return (
    <div className="segment-toggle" role="tablist">
      {segments.map((s, i) => (
        <button
          key={i}
          ref={(el) => {
            if (el) pillRefs.current.set(i, el);
            else pillRefs.current.delete(i);
          }}
          type="button"
          role="tab"
          aria-selected={i === selected}
          tabIndex={i === selected ? 0 : -1}
          className={`segment-toggle-pill ${i === selected ? "selected" : ""}`}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
          }}
        >
          {s.origin} → {s.destination}
        </button>
      ))}
    </div>
  );
}
