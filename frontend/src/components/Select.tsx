import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
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
 * cross-browser. The menu itself is portaled to document.body (see
 * usePopoverPosition) so it isn't clipped by an ancestor's
 * overflow:hidden/auto — the app has no page-level scroll, so several
 * containers (e.g. the flight card body) now scroll/clip internally.
 */
export function Select({ label, value, onChange, options, disabled, error, style }: Props) {
  const [open, setOpen] = useState(false);
  // Arrow-key cursor within the open listbox — independent of `value` until Enter commits it,
  // same as a native <select>'s open-menu behavior.
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);
  const rect = usePopoverPosition(rootRef, open);

  function openMenu() {
    const idx = options.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || highlighted < 0) return;
    menuRef.current?.querySelector(`#select-opt-${highlighted}`)?.scrollIntoView({ block: "nearest" });
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
        setHighlighted((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, (i < 0 ? options.length : i) - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlighted(options.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const opt = options[highlighted];
        if (opt) {
          e.preventDefault();
          onChange(opt.value);
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
  }, [open, options, highlighted, onChange]);

  return (
    <div
      ref={rootRef}
      className={`field2 select-field ${error ? "error" : ""} ${open ? "open" : ""} ${selected ? "has-value" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && highlighted >= 0 ? `select-opt-${highlighted}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {selected?.label ?? ""}
      </button>
      <label>{label}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && !disabled && rect &&
        createPortal(
          <ul
            ref={menuRef}
            className="select-menu"
            role="listbox"
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`select-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`${o.value === value ? "selected" : ""} ${i === highlighted ? "highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
