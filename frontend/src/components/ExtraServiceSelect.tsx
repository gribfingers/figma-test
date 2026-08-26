import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { ChevronDownIcon } from "./Icon";
import { EXTRA_SERVICE_GROUPS, extraServiceDisplay } from "../extraServiceTypes";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/** Same custom-dropdown pattern as AirportSelect (grouped, floating label). */
export function ExtraServiceSelect({ value, onChange }: Props) {
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
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${value ? "has-value" : ""}`}>
      <button type="button" className="select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value ? extraServiceDisplay(value) : ""}
      </button>
      <label>Service</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu" role="listbox" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 320) }}>
            {EXTRA_SERVICE_GROUPS.flatMap((g) => [
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
          </ul>,
          document.body
        )}
    </div>
  );
}
