import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition } from "../usePopoverPosition";
import { ChevronDownIcon } from "./Icon";
import { BAGGAGE_SPECIAL_TYPES, BAGGAGE_TYPE_GROUPS, baggageTypeDisplay } from "../baggageTypes";
import { useLanguage } from "../i18n";

interface Props {
  label: string;
  value: string;
  onChange: (id: string) => void;
  style?: React.CSSProperties;
  /** Paid/unpaid indicator color on the displayed value — independent of the dropdown itself. */
  tone?: "neutral" | "paid" | "unpaid";
  disabled?: boolean;
}

// Flat walk order for arrow-key navigation, matching the interleaved-group render order below.
const FLAT_BAGGAGE_TYPES = [...BAGGAGE_TYPE_GROUPS.flatMap((g) => g.options), ...BAGGAGE_SPECIAL_TYPES];

/** Same custom-dropdown pattern as Select/AirportSelect (field2 box, floating label), grouped (Standard/Oversize/Sport, then special handling types with no group of their own). */
export function BaggageTypeSelect({ label, value, onChange, style, tone = "neutral", disabled }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rect = usePopoverPosition(rootRef, open);

  function openMenu() {
    const idx = FLAT_BAGGAGE_TYPES.findIndex((o) => o.id === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || highlighted < 0) return;
    menuRef.current?.querySelector(`#bagtype-opt-${highlighted}`)?.scrollIntoView({ block: "nearest" });
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
        setHighlighted((i) => Math.min(FLAT_BAGGAGE_TYPES.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, (i < 0 ? FLAT_BAGGAGE_TYPES.length : i) - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlighted(FLAT_BAGGAGE_TYPES.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const o = FLAT_BAGGAGE_TYPES[highlighted];
        if (o) {
          e.preventDefault();
          onChange(o.id);
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
    <div ref={rootRef} className={`field2 select-field ${open ? "open" : ""} ${value ? "has-value" : ""}`} style={style}>
      <button
        type="button"
        className={`select-trigger baggage-type-trigger-${tone}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && highlighted >= 0 ? `bagtype-opt-${highlighted}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {value ? baggageTypeDisplay(value, t) : ""}
      </button>
      <label>{label}</label>
      <ChevronDownIcon size={16} className="select-chevron" />
      {open && !disabled && rect &&
        createPortal(
          <ul ref={menuRef} className="select-menu" role="listbox" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 280) }}>
            {BAGGAGE_TYPE_GROUPS.flatMap((g) => [
              <li key={`h-${g.group}`} className="select-group-label">{t(g.group)}</li>,
              ...g.options.map((o) => {
                const flatIdx = FLAT_BAGGAGE_TYPES.indexOf(o);
                return (
                  <li
                    key={o.id}
                    id={`bagtype-opt-${flatIdx}`}
                    role="option"
                    aria-selected={o.id === value}
                    className={`${o.id === value ? "selected" : ""} ${flatIdx === highlighted ? "highlighted" : ""}`}
                    onMouseEnter={() => setHighlighted(flatIdx)}
                    onClick={() => { onChange(o.id); setOpen(false); }}
                  >
                    <span className="mono">{o.code}</span> {t(o.label)}
                  </li>
                );
              }),
            ])}
            <li key="h-special" className="select-group-label">{t("Special")}</li>
            {BAGGAGE_SPECIAL_TYPES.map((o) => {
              const flatIdx = FLAT_BAGGAGE_TYPES.indexOf(o);
              return (
                <li
                  key={o.id}
                  id={`bagtype-opt-${flatIdx}`}
                  role="option"
                  aria-selected={o.id === value}
                  className={`${o.id === value ? "selected" : ""} ${flatIdx === highlighted ? "highlighted" : ""}`}
                  onMouseEnter={() => setHighlighted(flatIdx)}
                  onClick={() => { onChange(o.id); setOpen(false); }}
                >
                  {t(o.label)} <span className="mono">({o.code})</span>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
