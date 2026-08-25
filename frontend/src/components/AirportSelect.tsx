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

/** Same custom-dropdown pattern as Select (including the portal — see its comment), with airports grouped by city. */
export function AirportSelect({ label, value, onChange, style }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = AIRPORTS.find((a) => a.code === value);
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

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${selected ? "has-value" : ""}`} style={style}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
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
              ...airports.map((a) => (
                <li
                  key={a.code}
                  role="option"
                  aria-selected={a.code === value}
                  className={a.code === value ? "selected" : ""}
                  onClick={() => {
                    onChange(a.code);
                    setOpen(false);
                  }}
                >
                  <span className="mono">{a.code}</span> — {a.name}
                </li>
              )),
            ])}
          </ul>,
          document.body
        )}
    </div>
  );
}
