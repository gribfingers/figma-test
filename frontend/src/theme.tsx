import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const CONTRAST_STORAGE_KEY = "contrast";

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readStoredContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function applyTheme(theme: Theme, contrast: boolean) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-contrast", contrast ? "true" : "false");
}

// Applied as soon as this module loads (before the app renders), so there's
// no flash of the wrong theme on load.
applyTheme(readStoredTheme(), readStoredContrast());

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** High-contrast variant for low-vision users — combines with theme (light/dark), not a third theme value, so it's a plain toggle on top. */
  contrast: boolean;
  setContrast: (contrast: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [contrast, setContrastState] = useState<boolean>(readStoredContrast);

  useEffect(() => {
    applyTheme(theme, contrast);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(CONTRAST_STORAGE_KEY, String(contrast));
    } catch {
      // localStorage unavailable (private mode, etc.) — theme just won't persist
    }
  }, [theme, contrast]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, contrast, setContrast: setContrastState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
