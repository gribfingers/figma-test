import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  error?: boolean;
  style?: React.CSSProperties;
}

/**
 * Custom-rendered dropdown (not a native <select>) so the popup menu can
 * match the Figma "MenuItem" spec exactly (same width as the field, 4px
 * radius, drop-shadow) — native <select> popups can't be restyled
 * cross-browser.
 */
export function Select({ label, value, onChange, options, disabled, error, style }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
    <div
      ref={rootRef}
      className={`field2 select-field ${error ? "error" : ""} ${open ? "open" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {selected?.label ?? ""}
      </button>
      <label>{label}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && !disabled && (
        <ul className="select-menu" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={o.value === value ? "selected" : ""}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
