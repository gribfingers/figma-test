import { useEffect, useRef, useState } from "react";
import { FLIGHT_STATUSES } from "../../flightStatuses";
import { ChevronDownIcon } from "../Icon";
import { useLanguage } from "../../i18n";

interface Props {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

// Persisted to flights.ops_status by the parent (see FlightCardHeader's
// onStatusChange) — this component itself is just the picker UI.
export function FlightStatusSelect({ value, onChange, disabled }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = FLIGHT_STATUSES.find((s) => s.key === value) ?? FLIGHT_STATUSES[0];

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
    <div ref={rootRef} className={`status-select ${open ? "open" : ""}`}>
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        title={disabled ? t("A departed flight's status can't be changed") : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {t(current.labelEn)} <ChevronDownIcon size={16} className="chevron-flip" />
      </button>
      {open && (
        <ul className="status-menu" role="listbox">
          {FLIGHT_STATUSES.map((s) => (
            <li
              key={s.key}
              role="option"
              aria-selected={s.key === value}
              className={s.key === value ? "selected" : ""}
              onClick={() => {
                onChange(s.key);
                setOpen(false);
              }}
            >
              <div className="status-menu-row">
                <span className="status-menu-en">{s.labelEn}</span>
                <span className="status-menu-ru">{s.labelRu}</span>
              </div>
              <div className="status-menu-desc">{s.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
