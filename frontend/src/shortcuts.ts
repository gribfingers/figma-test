import { FLOW_STEP_LABEL } from "./checkinFlow";

export interface ShortcutDef {
  id: string;
  group: string;
  label: string;
  defaultCombo: string;
}

const IS_MAC = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
export const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl";
// Physically the same key as Alt on a PC keyboard (both sides of the spacebar, next to Cmd) — Mac
// just prints "Option"/⌥ on the keycap. The browser still reports it as altKey either way, so every
// "alt|…" combo already works unchanged on macOS; this only affects how it's displayed.
export const ALT_KEY_LABEL = IS_MAC ? "⌥" : "Alt";

/**
 * Every shortcut the app knows about — the single source of truth for both the settings panel
 * (UserPanel's "Keyboard shortcuts" accordion, via ShortcutSettingsSection) and every page's own
 * useHotkey calls, which look their combo up by id here rather than hardcoding a key. Combos are
 * "|"-joined tokens ("alt|n", "mod|enter", "arrowup", "+") — see comboFromEvent/formatCombo.
 */
export const SHORTCUTS: ShortcutDef[] = [
  // ---- Global (always available) ----
  { id: "nav.flights", group: "Global", label: "Flight schedule", defaultCombo: "alt|1" },
  { id: "nav.checkin-search", group: "Global", label: "Check-in", defaultCombo: "alt|2" },
  { id: "nav.boarding-search", group: "Global", label: "Boarding", defaultCombo: "alt|3" },
  { id: "nav.search-focus", group: "Global", label: "Focus search field", defaultCombo: "/" },
  { id: "nav.tab-close", group: "Global", label: "Close current tab", defaultCombo: "alt|x" },
  { id: "nav.tab-prev", group: "Global", label: "Previous tab", defaultCombo: "alt|arrowleft" },
  { id: "nav.tab-next", group: "Global", label: "Next tab", defaultCombo: "alt|arrowright" },

  // ---- Check-in flow (PnrView, once a PNR is opened into a step) ----
  { id: "flow.step-docs", group: "Check-in flow", label: FLOW_STEP_LABEL.docs, defaultCombo: "1" },
  { id: "flow.step-seats", group: "Check-in flow", label: FLOW_STEP_LABEL.seats, defaultCombo: "2" },
  { id: "flow.step-baggage", group: "Check-in flow", label: FLOW_STEP_LABEL.baggage, defaultCombo: "3" },
  { id: "flow.step-services", group: "Check-in flow", label: FLOW_STEP_LABEL.services, defaultCombo: "4" },
  { id: "flow.checkin", group: "Check-in flow", label: "Check-in", defaultCombo: "mod|enter" },
  { id: "flow.next", group: "Check-in flow", label: "Next", defaultCombo: "alt|n" },
  { id: "flow.finish", group: "Check-in flow", label: "Finish", defaultCombo: "alt|f" },
  { id: "flow.cart", group: "Check-in flow", label: "Cart", defaultCombo: "alt|c" },
  { id: "flow.flight-info", group: "Check-in flow", label: "Flight information", defaultCombo: "alt|i" },

  // ---- Seat map (any panel showing SeatMapPanel) ----
  { id: "seatmap.zoom-in", group: "Seat map", label: "Zoom in", defaultCombo: "+" },
  { id: "seatmap.zoom-out", group: "Seat map", label: "Zoom out", defaultCombo: "-" },
  { id: "seatmap.zoom-reset", group: "Seat map", label: "Reset zoom to 100%", defaultCombo: "0" },

  // ---- Boarding (gate workstation passenger list) ----
  { id: "boarding.scan", group: "Boarding", label: "Scan a boarding pass", defaultCombo: "alt|s" },
  { id: "boarding.board", group: "Boarding", label: "Board", defaultCombo: "alt|b" },
  { id: "boarding.offload", group: "Boarding", label: "Offload", defaultCombo: "alt|o" },
  { id: "boarding.row-up", group: "Boarding", label: "Row up", defaultCombo: "arrowup" },
  { id: "boarding.row-down", group: "Boarding", label: "Row down", defaultCombo: "arrowdown" },
  { id: "boarding.row-open", group: "Boarding", label: "Open selected row", defaultCombo: "enter" },
  { id: "boarding.row-toggle", group: "Boarding", label: "Toggle row checkbox", defaultCombo: "space" },
  { id: "boarding.select-all", group: "Boarding", label: "Select/deselect all rows", defaultCombo: "mod|a" },
];

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

// `.code` is layout- and Option-remap-independent (Alt+N on a Mac keyboard reports `.key` as an
// accented character via Option, but `.code` still reports "KeyN") — only needed for Alt combos,
// since Ctrl/plain keys don't get remapped the same way.
function keyIdentity(e: KeyboardEvent): string {
  if (e.altKey) {
    if (e.code.startsWith("Key")) return e.code.slice(3).toLowerCase();
    if (e.code.startsWith("Digit")) return e.code.slice(5);
  }
  if (e.key === " ") return "space";
  return e.key.toLowerCase();
}

/** Normalizes a keydown event into the same "|"-joined combo format shortcut defaults use — null
 *  for a lone modifier press (Ctrl/Alt/Shift/Meta alone), which isn't a bindable combo yet. Treats
 *  Cmd the same as Ctrl ("mod"), matching TopTabs' own reopen-tab shortcut convention. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(keyIdentity(e));
  return parts.join("|");
}

const TOKEN_LABEL: Record<string, string> = {
  mod: MOD_KEY_LABEL,
  alt: ALT_KEY_LABEL,
  shift: "Shift",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "Enter",
  space: "Space",
  escape: "Esc",
};

/** Renders a combo string ("alt|n", "mod|enter", "arrowup") as the label shown in the UI ("Alt+N", "Ctrl+Enter", "↑"). */
export function formatCombo(combo: string): string {
  return combo
    .split("|")
    .map((part) => TOKEN_LABEL[part] ?? (part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("+");
}
