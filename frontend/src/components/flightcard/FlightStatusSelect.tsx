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
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = FLIGHT_STATUSES.find((s) => s.key === value) ?? FLIGHT_STATUSES[0];

  function openMenu() {
    const idx = FLIGHT_STATUSES.findIndex((s) => s.key === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => Math.min(FLIGHT_STATUSES.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, (i < 0 ? FLIGHT_STATUSES.length : i) - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlighted(FLIGHT_STATUSES.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const s = FLIGHT_STATUSES[highlighted];
        if (s) {
          e.preventDefault();
          onChange(s.key);
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
    <div ref={rootRef} className={`status-select ${open ? "open" : ""}`}>
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        title={disabled ? t("A departed flight's status can't be changed") : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && highlighted >= 0 ? `flightstatus-opt-${highlighted}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {t(current.labelEn)} <ChevronDownIcon size={16} className="chevron-flip" />
      </button>
      {open && (
        <ul className="status-menu" role="listbox">
          {FLIGHT_STATUSES.map((s, i) => (
            <li
              key={s.key}
              id={`flightstatus-opt-${i}`}
              role="option"
              aria-selected={s.key === value}
              className={`${s.key === value ? "selected" : ""} ${i === highlighted ? "highlighted" : ""}`}
              onMouseEnter={() => setHighlighted(i)}
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
