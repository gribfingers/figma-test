import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "fontSize";
const MIN = 80;
const MAX = 130;
const STEP = 10;
const DEFAULT = 100;

function clamp(pct: number): number {
  return Math.min(MAX, Math.max(MIN, pct));
}

function readStoredFontSize(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return raw ? clamp(raw) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function applyFontSize(pct: number) {
  document.documentElement.style.zoom = String(pct / 100);
}

// Applied as soon as this module loads (before the app renders), so there's
// no flash of the wrong size on load — matches theme.tsx's pattern.
applyFontSize(readStoredFontSize());

interface FontSizeContextValue {
  fontSize: number;
  increase: () => void;
  decrease: () => void;
  min: number;
  max: number;
}

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<number>(readStoredFontSize);

  useEffect(() => {
    applyFontSize(fontSize);
    try {
      localStorage.setItem(STORAGE_KEY, String(fontSize));
    } catch {
      // localStorage unavailable (private mode, etc.) — size just won't persist
    }
  }, [fontSize]);

  return (
    <FontSizeContext.Provider
      value={{
        fontSize,
        increase: () => setFontSize((v) => clamp(v + STEP)),
        decrease: () => setFontSize((v) => clamp(v - STEP)),
        min: MIN,
        max: MAX,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const ctx = useContext(FontSizeContext);
  if (!ctx) throw new Error("useFontSize must be used within a FontSizeProvider");
  return ctx;
}
