import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { ChevronDownIcon } from "./Icon";
import { AIRPORTS } from "../airports";

interface Props {
  label: string;
  value: string;
  onChange: (code: string) => void;
  style?: React.CSSProperties;
}

function groupByCity() {
  const groups = new Map<string, typeof AIRPORTS>();
  for (const a of AIRPORTS) {
    if (!groups.has(a.city)) groups.set(a.city, []);
    groups.get(a.city)!.push(a);
  }
  return groups;
}

const GROUPS = groupByCity();
// Render order (group headers interleaved) doesn't match a flat index — this is the flat order
// arrow-key navigation walks, skipping the non-selectable group-label rows.
const FLAT_AIRPORTS = [...GROUPS.values()].flat();

/** Same custom-dropdown pattern as Select (including the portal — see its comment), with airports grouped by city. */
export function AirportSelect({ label, value, onChange, style }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = AIRPORTS.find((a) => a.code === value);
  const rect = usePopoverPosition(rootRef, open);

  function openMenu() {
    const idx = FLAT_AIRPORTS.findIndex((a) => a.code === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || highlighted < 0) return;
    menuRef.current?.querySelector(`#airport-opt-${highlighted}`)?.scrollIntoView({ block: "nearest" });
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
        setHighlighted((i) => Math.min(FLAT_AIRPORTS.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, (i < 0 ? FLAT_AIRPORTS.length : i) - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlighted(FLAT_AIRPORTS.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const a = FLAT_AIRPORTS[highlighted];
        if (a) {
          e.preventDefault();
          onChange(a.code);
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, highlighted, onChange]);

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${selected ? "has-value" : ""}`} style={style}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && highlighted >= 0 ? `airport-opt-${highlighted}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {selected?.code ?? value}
      </button>
      <label>{label}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && rect &&
        createPortal(
          <ul
            ref={menuRef}
            className="select-menu airport-menu"
            role="listbox"
            style={{ position: "fixed", top: rect.top, left: rect.left }}
          >
            {[...GROUPS.entries()].flatMap(([city, airports]) => [
              <li key={`h-${city}`} className="select-group-label">
                {city}
              </li>,
              ...airports.map((a) => {
                const flatIdx = FLAT_AIRPORTS.indexOf(a);
                return (
                  <li
                    key={a.code}
                    id={`airport-opt-${flatIdx}`}
                    role="option"
                    aria-selected={a.code === value}
                    className={`${a.code === value ? "selected" : ""} ${flatIdx === highlighted ? "highlighted" : ""}`}
                    onMouseEnter={() => setHighlighted(flatIdx)}
                    onClick={() => {
                      onChange(a.code);
                      setOpen(false);
                    }}
                  >
                    <span className="mono">{a.code}</span> — {a.name}
                  </li>
                );
              }),
            ])}
          </ul>,
          document.body
        )}
    </div>
  );
}
