import { KeyboardEvent } from "react";

/**
 * Spread onto a non-natively-focusable element (div/tr/td/span/li) that already has an onClick —
 * makes it reachable by Tab and activatable with Enter or Space, matching native <button>/<a>
 * behavior, without changing what it looks like or how click already works. Doesn't replace
 * onClick — add both:
 *
 *   <tr onClick={() => open(p)} {...clickable(() => open(p))}>
 *
 * `role` defaults to "button"; pass "option"/"menuitem"/etc. to match a listbox/menu the element
 * already sits in (its aria-selected/etc. stay wherever they already are — this only adds the
 * three keyboard-operability props).
 */
export function clickable(onActivate: () => void, role: string = "button") {
  return {
    tabIndex: 0,
    role,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      // A native button suppresses Space's default (page scroll) too — do the same here, and only
      // for the exact target (not a bubbled key from some focusable thing nested inside).
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      onActivate();
    },
  };
}
