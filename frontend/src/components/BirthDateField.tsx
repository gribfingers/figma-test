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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const YEARS_PER_PAGE = 12;

type Level = "year" | "month" | "day";

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

/**
 * Date-of-birth picker: same typeable dd.mm.yyyy input + calendar-icon
 * trigger as DateField, but the dropdown opens on a year grid rather than
 * a month grid — clicking through ~600 "previous month" arrows to reach
 * 1985 isn't a real option. Year → month → day, each level's header text
 * drills back up to the level above.
 */
export function BirthDateField({ label, value, onChange, disabled, error, style }: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => isoToMasked(value));
  const [level, setLevel] = useState<Level>("year");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const parsed = parseIso(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [yearPageStart, setYearPageStart] = useState(() => (parsed?.year ?? today.getFullYear() - 30) - 6);
  const rect = usePopoverPosition(rootRef, open);

  useEffect(() => {
    if (!focused) setText(isoToMasked(value));
  }, [value, focused]);

  useEffect(() => {
    if (!open) return;
    const anchorYear = parsed?.year ?? today.getFullYear() - 30;
    setViewYear(parsed?.year ?? today.getFullYear());
    setViewMonth(parsed?.month ?? today.getMonth());
    setYearPageStart(anchorYear - 6);
    setLevel("year");
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

  function pickYear(year: number) {
    setViewYear(year);
    setLevel("month");
  }

  function pickMonth(month: number) {
    setViewMonth(month);
    setLevel("day");
  }

  function pickDay(day: number) {
    const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(iso);
    setText(isoToMasked(iso));
    setOpen(false);
  }

  const leading = startWeekday(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
  const weeks = Math.ceil((leading + totalDays) / 7);
  const dayCells: { year: number; month: number; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - leading + 1;
    if (dayNum < 1) {
      const day = prevMonthDays + dayNum;
      const month = viewMonth === 0 ? 11 : viewMonth - 1;
      const year = viewMonth === 0 ? viewYear - 1 : viewYear;
      dayCells.push({ year, month, day, inMonth: false });
    } else if (dayNum > totalDays) {
      const day = dayNum - totalDays;
      const month = viewMonth === 11 ? 0 : viewMonth + 1;
      const year = viewMonth === 11 ? viewYear + 1 : viewYear;
      dayCells.push({ year, month, day, inMonth: false });
    } else {
      dayCells.push({ year: viewYear, month: viewMonth, day: dayNum, inMonth: true });
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
            {level === "year" && (
              <>
                <div className="dt-cal-header">
                  <button type="button" className="dt-nav" onClick={() => setYearPageStart((y) => y - YEARS_PER_PAGE)} aria-label="Earlier years">
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span>{yearPageStart}–{yearPageStart + YEARS_PER_PAGE - 1}</span>
                  <button type="button" className="dt-nav" onClick={() => setYearPageStart((y) => y + YEARS_PER_PAGE)} aria-label="Later years">
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                <div className="dt-cal-grid dt-cal-grid-4col">
                  {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((y) => (
                    <button
                      key={y}
                      type="button"
                      className={`dt-day dt-cell-wide ${parsed?.year === y ? "selected" : ""} ${today.getFullYear() === y ? "today" : ""}`}
                      onClick={() => pickYear(y)}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </>
            )}
            {level === "month" && (
              <>
                <div className="dt-cal-header">
                  <button type="button" className="dt-nav" onClick={() => setViewYear((y) => y - 1)} aria-label="Previous year">
                    <ChevronLeftIcon size={16} />
                  </button>
                  <button type="button" className="dt-cal-drill-up" onClick={() => setLevel("year")}>{viewYear}</button>
                  <button type="button" className="dt-nav" onClick={() => setViewYear((y) => y + 1)} aria-label="Next year">
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                <div className="dt-cal-grid dt-cal-grid-4col">
                  {MONTHS_SHORT.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      className={`dt-day dt-cell-wide ${parsed?.year === viewYear && parsed?.month === i ? "selected" : ""} ${today.getFullYear() === viewYear && today.getMonth() === i ? "today" : ""}`}
                      onClick={() => pickMonth(i)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
            {level === "day" && (
              <>
                <div className="dt-cal-header">
                  <button
                    type="button"
                    className="dt-nav"
                    onClick={() => setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; })}
                    aria-label="Previous month"
                  >
                    <ChevronLeftIcon size={16} />
                  </button>
                  <button type="button" className="dt-cal-drill-up" onClick={() => setLevel("month")}>
                    {MONTHS[viewMonth]} {viewYear}
                  </button>
                  <button
                    type="button"
                    className="dt-nav"
                    onClick={() => setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; })}
                    aria-label="Next month"
                  >
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                <div className="dt-cal-weekdays">
                  {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
                </div>
                <div className="dt-cal-grid">
                  {dayCells.map((c, i) => {
                    const isSelected = !!parsed && parsed.year === c.year && parsed.month === c.month && parsed.day === c.day;
                    const isToday = today.getFullYear() === c.year && today.getMonth() === c.month && today.getDate() === c.day;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`dt-day ${c.inMonth ? "" : "outside"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                        onClick={() => (c.inMonth ? pickDay(c.day) : (setViewYear(c.year), setViewMonth(c.month), pickDay(c.day)))}
                      >
                        {c.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
