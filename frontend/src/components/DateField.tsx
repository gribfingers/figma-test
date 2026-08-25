import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { maskDateInput } from "../validation";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./Icon";

interface Props {
  label: string;
  value: string; // "YYYY-MM-DD", "" when unset
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  style?: React.CSSProperties;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToMasked(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function maskedToIso(masked: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(masked);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { year: +m[1], month: +m[2] - 1, day: +m[3] } : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
}

/** Same custom-calendar dropdown as DateTimePicker, minus the hour/minute
 * selects — for fields that only need a date (dd.mm.yyyy), not a full
 * instant. The input itself is also directly typeable, auto-formatting to
 * dd.mm.yyyy as digits are entered (see maskDateInput). */
export function DateField({ label, value, onChange, disabled, error, style }: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => isoToMasked(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const parsed = parseIso(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const rect = usePopoverPosition(rootRef, open);

  // Keep the displayed text in sync with external value changes (calendar
  // pick, form reset) — but never while the user has the input focused and
  // is mid-keystroke on an incomplete date, or their typing gets clobbered.
  useEffect(() => {
    if (!focused) setText(isoToMasked(value));
  }, [value, focused]);

  useEffect(() => {
    if (!open) return;
    setViewYear(parsed?.year ?? today.getFullYear());
    setViewMonth(parsed?.month ?? today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  function handleTextChange(raw: string) {
    const masked = maskDateInput(raw);
    setText(masked);
    onChange(maskedToIso(masked));
  }

  function pickDay(year: number, month: number, day: number) {
    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(iso);
    setText(isoToMasked(iso));
    setViewYear(year);
    setViewMonth(month);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  }

  const leading = startWeekday(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
  const weeks = Math.ceil((leading + totalDays) / 7);

  const cells: { year: number; month: number; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - leading + 1;
    if (dayNum < 1) {
      const day = prevMonthDays + dayNum;
      const month = viewMonth === 0 ? 11 : viewMonth - 1;
      const year = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ year, month, day, inMonth: false });
    } else if (dayNum > totalDays) {
      const day = dayNum - totalDays;
      const month = viewMonth === 11 ? 0 : viewMonth + 1;
      const year = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ year, month, day, inMonth: false });
    } else {
      cells.push({ year: viewYear, month: viewMonth, day: dayNum, inMonth: true });
    }
  }

  return (
    <div ref={rootRef} className={`field2 date-field ${error ? "error" : ""} ${open ? "open" : ""}`} style={style}>
      <input
        value={text}
        disabled={disabled}
        placeholder=" "
        inputMode="numeric"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => handleTextChange(e.target.value)}
      />
      <label>{label}</label>
      <button
        type="button"
        className="date-field-toggle"
        disabled={disabled}
        aria-label="Open calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon size={16} />
      </button>
      {open && !disabled && rect &&
        createPortal(
          <div
            ref={menuRef}
            className="datetime-menu"
            role="dialog"
            style={{ position: "fixed", top: rect.top, left: rect.left }}
          >
            <div className="dt-cal-header">
              <button type="button" className="dt-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeftIcon size={16} />
              </button>
              <span>{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" className="dt-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRightIcon size={16} />
              </button>
            </div>
            <div className="dt-cal-weekdays">
              {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="dt-cal-grid">
              {cells.map((c, i) => {
                const isSelected = !!parsed && parsed.year === c.year && parsed.month === c.month && parsed.day === c.day;
                const isToday = today.getFullYear() === c.year && today.getMonth() === c.month && today.getDate() === c.day;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`dt-day ${c.inMonth ? "" : "outside"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => pickDay(c.year, c.month, c.day)}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
