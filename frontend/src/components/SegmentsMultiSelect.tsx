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
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rect = usePopoverPosition(rootRef, open);

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange(next);
  }

  useEffect(() => {
    if (!open || highlighted < 0) return;
    menuRef.current?.querySelector(`#segment-opt-${highlighted}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => Math.min(segments.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, (i < 0 ? segments.length : i) - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlighted(segments.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        // A checkbox multi-select stays open on Enter/Space — same as toggling a checkbox — so an
        // agent can check several legs in one keyboard session without reopening the menu.
        if (highlighted >= 0) {
          e.preventDefault();
          toggle(highlighted);
        }
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, highlighted, segments.length]);

  const display = selected.size > 1 ? "Multi" : selected.size === 1 ? segmentLabel(segments[[...selected][0]]) : "";

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${selected.size ? "has-value" : ""}`}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && highlighted >= 0 ? `segment-opt-${highlighted}` : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else {
            setHighlighted(-1);
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setHighlighted(-1);
            setOpen(true);
          }
        }}
      >
        {display}
      </button>
      <label>Segments</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu" role="listbox" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 180) }}>
            {segments.map((seg, i) => (
              <li
                key={i}
                id={`segment-opt-${i}`}
                className={`pax-columns-item ${i === highlighted ? "highlighted" : ""}`}
                role="option"
                aria-selected={selected.has(i)}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => toggle(i)}
              >
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
