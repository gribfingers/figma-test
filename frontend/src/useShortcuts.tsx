import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SHORTCUTS, comboFromEvent } from "./shortcuts";
import { trackEvent } from "./analytics";

const STORAGE_KEY = "dcs_shortcut_overrides";

function readStored(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface ShortcutsContextValue {
  overrides: Record<string, string>;
  effectiveCombo: (id: string) => string;
  setOverride: (id: string, combo: string) => void;
  resetOverride: (id: string) => void;
  resetAll: () => void;
  /** id of whichever shortcut is already bound to `combo` (excluding `exceptId`), or null — lets the
   *  settings panel block two shortcuts from silently sharing one key. */
  ownerOf: (combo: string, exceptId?: string) => string | null;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

/** Holds the user's own key-combo overrides (see UserPanel's Keyboard shortcuts section) — same
 *  Context+localStorage shape as TabIconsProvider/FontSizeProvider for a global, reactive setting. */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // Storage full or unavailable — custom bindings just won't survive a reload.
    }
  }, [overrides]);

  const effectiveCombo = useCallback(
    (id: string) => overrides[id] ?? SHORTCUTS.find((s) => s.id === id)?.defaultCombo ?? "",
    [overrides]
  );
  const setOverride = useCallback((id: string, combo: string) => {
    setOverrides((prev) => ({ ...prev, [id]: combo }));
  }, []);
  const resetOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);
  const resetAll = useCallback(() => setOverrides({}), []);
  const ownerOf = useCallback(
    (combo: string, exceptId?: string) => {
      const found = SHORTCUTS.find((s) => s.id !== exceptId && (overrides[s.id] ?? s.defaultCombo) === combo);
      return found?.id ?? null;
    },
    [overrides]
  );

  return (
    <ShortcutsContext.Provider value={{ overrides, effectiveCombo, setOverride, resetOverride, resetAll, ownerOf }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcutSettings() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcutSettings must be used within a ShortcutsProvider");
  return ctx;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target.isContentEditable) return true;
  return !!target.closest('[role="listbox"],[role="combobox"],[role="menu"]');
}

/**
 * Binds `handler` to whichever combo shortcut `id` is currently configured for (its default, or
 * the user's own override) — never while typing in a text field, and never while `enabled` is
 * false, so a shortcut for a currently-disabled action (e.g. Check-in before docs/seats are done)
 * doesn't fire either. Each page wires its own real handlers up this way rather than the registry
 * dispatching anything itself, so a shortcut only ever does something while its owning screen is
 * actually mounted.
 */
export function useHotkey(id: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const { effectiveCombo } = useShortcutSettings();
  const combo = effectiveCombo(id);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !combo) return;
    // Alt-combos ("alt|x", "alt|n", …) never collide with normal typing — nobody holds Alt while
    // entering text — so they fire even while a field has focus; several pages autoFocus their
    // search input, which would otherwise swallow every Alt shortcut the moment that page loads.
    // Ctrl/Cmd combos ("mod|a", "mod|enter") keep respecting the typing-target guard instead, since
    // those double as real text-editing shortcuts (select-all-in-field, submit) the field should win.
    const tokens = combo.split("|");
    const bypassTypingGuard = tokens.includes("alt") && !tokens.includes("mod");
    function onKeyDown(e: KeyboardEvent) {
      if (!bypassTypingGuard && isTypingTarget(e.target)) return;
      if (comboFromEvent(e) !== combo) return;
      e.preventDefault();
      trackEvent("shortcut", id);
      handlerRef.current(e);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, enabled]);
}
