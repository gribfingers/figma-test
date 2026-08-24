import { useEffect, useRef, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./Icon";
import { Select } from "./Select";

interface Props {
  label: string;
  value: string; // "YYYY-MM-DDTHH:mm", same shape as <input type="datetime-local">, "" when unset
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
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h).padStart(2, "0"), label: String(h).padStart(2, "0") }));
const MINUTES = [
  { value: "00", label: "00" },
  { value: "30", label: "30" },
];

interface Parsed {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
}

function parseValue(value: string): Parsed | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return { year: +m[1], month: +m[2] - 1, day: +m[3], hour: +m[4], minute: +m[5] };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toValue(p: Parsed): string {
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function formatDisplay(p: Parsed | null): string {
  if (!p) return "";
  return `${pad(p.day)}.${pad(p.month + 1)}.${p.year}, ${pad(p.hour)}:${pad(p.minute)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
}

export function DateTimePicker({ label, value, onChange, disabled, error, style }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  useEffect(() => {
    if (!open) return;
    setViewYear(parsed?.year ?? today.getFullYear());
    setViewMonth(parsed?.month ?? today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  function pickDay(year: number, month: number, day: number) {
    onChange(toValue({ year, month, day, hour: parsed?.hour ?? 0, minute: parsed?.minute ?? 0 }));
    setViewYear(year);
    setViewMonth(month);
  }

  function setHour(h: string) {
    const base = parsed ?? { year: viewYear, month: viewMonth, day: today.getDate(), hour: 0, minute: 0 };
    onChange(toValue({ ...base, hour: +h }));
  }
  function setMinute(m: string) {
    const base = parsed ?? { year: viewYear, month: viewMonth, day: today.getDate(), hour: 0, minute: 0 };
    onChange(toValue({ ...base, minute: +m }));
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
    <div
      ref={rootRef}
      className={`field2 datetime-field ${error ? "error" : ""} ${open ? "open" : ""} ${parsed ? "has-value" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="datetime-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {formatDisplay(parsed)}
      </button>
      <label>{label}</label>
      <CalendarIcon size={16} className="select-chevron" />
      {open && !disabled && (
        <div className="datetime-menu" role="dialog">
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
          <div className="dt-cal-time">
            <Select label="Hour" value={parsed ? pad(parsed.hour) : "00"} onChange={setHour} options={HOURS} />
            <Select label="Min" value={parsed ? pad(Math.floor(parsed.minute / 30) * 30) : "00"} onChange={setMinute} options={MINUTES} />
          </div>
        </div>
      )}
    </div>
  );
}
