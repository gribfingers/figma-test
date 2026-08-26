import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { FlightSegment } from "../flightSegments";
import { ChevronDownIcon } from "./Icon";

interface Props {
  segments: FlightSegment[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}

function segmentLabel(seg: FlightSegment): string {
  return `${seg.origin} → ${seg.destination}`;
}

/**
 * Same custom-dropdown pattern as AirportSelect/Select, but a checkbox
 * multi-select (a service can apply to more than one leg at once) — the
 * closed trigger shows the one selected leg's route, or "Multi" once more
 * than one is checked.
 */
export function SegmentsMultiSelect({ segments, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rect = usePopoverPosition(rootRef, open);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange(next);
  }

  const display = selected.size > 1 ? "Multi" : selected.size === 1 ? segmentLabel(segments[[...selected][0]]) : "";

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${selected.size ? "has-value" : ""}`}>
      <button type="button" className="select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {display}
      </button>
      <label>Segments</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu" role="listbox" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 180) }}>
            {segments.map((seg, i) => (
              <li key={i} className="pax-columns-item" role="option" aria-selected={selected.has(i)} onClick={() => toggle(i)}>
                <input type="checkbox" checked={selected.has(i)} readOnly />
                {segmentLabel(seg)}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
