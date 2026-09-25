// Small dedicated icon set for the prohibited-items screen — simple enough
// (single glyph, one color: currentColor) that it's not worth adding to the
// shared components/Icon.tsx, which the rest of the app draws from.
import type { ReactNode } from "react";

function Base({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function WeaponIcon() {
  return (
    <Base>
      <circle cx="12" cy="12" r="9" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
    </Base>
  );
}

export function FlameIcon() {
  return (
    <Base>
      <path d="M12 2c1.5 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1 .3-1.8.8-2.6.3.9 1 1.6 1.2 1a5 5 0 0 1 2-6.4Z" />
    </Base>
  );
}

export function ToxicIcon() {
  return (
    <Base>
      <circle cx="12" cy="9" r="6" />
      <circle cx="9.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <path d="M9 12c1 1 5 1 6 0" />
      <path d="M9 15l-2 6M15 15l2 6M12 15v6" />
    </Base>
  );
}

export function GasCylinderIcon() {
  return (
    <Base>
      <rect x="7" y="6" width="10" height="15" rx="3" />
      <path d="M10 6V4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2" />
    </Base>
  );
}

export function LiquidIcon() {
  return (
    <Base>
      <path d="M12 2s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12Z" />
    </Base>
  );
}
