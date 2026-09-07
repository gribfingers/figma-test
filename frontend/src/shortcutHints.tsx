import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useShortcutSettings } from "./useShortcuts";
import { formatCombo } from "./shortcuts";

const STORAGE_KEY = "dcs_shortcut_hints_enabled";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface ShortcutHintsContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const ShortcutHintsContext = createContext<ShortcutHintsContextValue | null>(null);

/** Whether hotkey-bound buttons throughout the app show their combo in a tooltip — see UserPanel's
 *  "Show keyboard shortcuts" checkbox. Same Context+localStorage shape as TabIconsProvider. */
export function ShortcutHintsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — the setting just won't persist
    }
  }, [enabled]);

  return <ShortcutHintsContext.Provider value={{ enabled, setEnabled }}>{children}</ShortcutHintsContext.Provider>;
}

export function useShortcutHints() {
  const ctx = useContext(ShortcutHintsContext);
  if (!ctx) throw new Error("useShortcutHints must be used within a ShortcutHintsProvider");
  return ctx;
}

/** The current combo for `id`, formatted for this OS (e.g. "⌥K" on Mac, "Alt+K" elsewhere) — or ""
 *  when the "Show keyboard shortcuts" setting is off, or the shortcut has no combo bound. */
export function useShortcutHint(id: string): string {
  const { enabled } = useShortcutHints();
  const { effectiveCombo } = useShortcutSettings();
  if (!enabled) return "";
  const combo = effectiveCombo(id);
  return combo ? formatCombo(combo) : "";
}

/**
 * Appends the shortcut's formatted combo to a base title/label, gated by the "Show keyboard
 * shortcuts" setting — e.g. useShortcutTitle("baggage.calculate", "Calculate") is "Calculate" with
 * the setting off, "Calculate (⌥K)" with it on. Returns `base` unchanged (or undefined) when hints
 * are off or the shortcut has no combo, so it's safe to drop straight into an existing title prop.
 */
export function useShortcutTitle(id: string, base?: string): string | undefined {
  const hint = useShortcutHint(id);
  if (!hint) return base;
  return base ? `${base} (${hint})` : hint;
}
