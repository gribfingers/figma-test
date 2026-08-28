import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../Icon";

export type FlightAction = "checkin" | "boarding" | "pnl" | "pfs" | "close";

interface ActionItem {
  key: FlightAction;
  label: string;
  danger?: boolean;
}

const ACTIONS: ActionItem[] = [
  { key: "checkin", label: "Open check-in" },
  { key: "boarding", label: "Open boarding" },
  { key: "pnl", label: "View PNL" },
  { key: "pfs", label: "View PFS" },
  { key: "close", label: "Close flight", danger: true },
];

interface Props {
  onAction: (action: FlightAction) => void;
  /** Actions to gray out and block, e.g. Open check-in/boarding on a departed flight. */
  disabledActions?: Set<FlightAction>;
}

export function FlightActionsMenu({ onAction, disabledActions }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div ref={rootRef} className={`actions-select ${open ? "open" : ""}`}>
      <button
        type="button"
        className="secondary"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Actions <ChevronDownIcon size={16} className="chevron-flip" />
      </button>
      {open && (
        <ul className="actions-menu" role="listbox">
          {ACTIONS.map((a) => {
            const disabled = disabledActions?.has(a.key) ?? false;
            return (
              <li
                key={a.key}
                className={`${a.danger ? "danger" : ""} ${disabled ? "disabled" : ""}`}
                aria-disabled={disabled}
                title={disabled ? "A departed flight can't reopen check-in or boarding" : undefined}
                onClick={() => {
                  if (disabled) return;
                  setOpen(false);
                  onAction(a.key);
                }}
              >
                {a.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
