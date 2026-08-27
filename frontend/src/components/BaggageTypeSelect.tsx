import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { ChevronDownIcon } from "./Icon";
import { BAGGAGE_SPECIAL_TYPES, BAGGAGE_TYPE_GROUPS, baggageTypeDisplay } from "../baggageTypes";

interface Props {
  label: string;
  value: string;
  onChange: (id: string) => void;
  style?: React.CSSProperties;
  /** Paid/unpaid indicator color on the displayed value — independent of the dropdown itself. */
  tone?: "neutral" | "paid" | "unpaid";
  disabled?: boolean;
}

/** Same custom-dropdown pattern as Select/AirportSelect (field2 box, floating label), grouped (Standard/Oversize/Sport, then special handling types with no group of their own). */
export function BaggageTypeSelect({ label, value, onChange, style, tone = "neutral", disabled }: Props) {
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

  return (
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${value ? "has-value" : ""}`} style={style}>
      <button
        type="button"
        className={`select-trigger baggage-type-trigger-${tone}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? baggageTypeDisplay(value) : ""}
      </button>
      <label>{label}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && !disabled && rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu" role="listbox" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 280) }}>
            {BAGGAGE_TYPE_GROUPS.flatMap((g) => [
              <li key={`h-${g.group}`} className="select-group-label">{g.group}</li>,
              ...g.options.map((o) => (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={o.id === value}
                  className={o.id === value ? "selected" : ""}
                  onClick={() => { onChange(o.id); setOpen(false); }}
                >
                  <span className="mono">{o.code}</span> {o.label}
                </li>
              )),
            ])}
            <li key="h-special" className="select-group-label">Special</li>
            {BAGGAGE_SPECIAL_TYPES.map((o) => (
              <li
                key={o.id}
                role="option"
                aria-selected={o.id === value}
                className={o.id === value ? "selected" : ""}
                onClick={() => { onChange(o.id); setOpen(false); }}
              >
                {o.label} <span className="mono">({o.code})</span>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
