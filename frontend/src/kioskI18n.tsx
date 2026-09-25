import { createContext, ReactNode, useContext, useState } from "react";
import { KIOSK_EN } from "./kioskI18n/en";
import { KIOSK_ZH } from "./kioskI18n/zh";

export type KioskLang = "ru" | "en" | "zh";

const STORAGE_KEY = "kiosk_language";

function readStoredLang(): KioskLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "zh" ? v : "ru";
  } catch {
    return "ru";
  }
}

/**
 * Kiosk-only i18n, deliberately separate from the agent app's ./i18n (which
 * only covers en/ru): the kiosk is a Russian-first B2C product, so Russian
 * is the source text written directly in the kiosk JSX and the lookup key
 * here, with EN/ZH dictionaries translating from it — the reverse of
 * ./i18n's English-source convention.
 */
function translate(lang: KioskLang, key: string, vars?: Record<string, string | number>): string {
  const dict = lang === "en" ? KIOSK_EN : lang === "zh" ? KIOSK_ZH : null;
  let text = dict?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

interface KioskLanguageContextValue {
  lang: KioskLang;
  setLang: (lang: KioskLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const KioskLanguageContext = createContext<KioskLanguageContextValue | null>(null);

export function KioskLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<KioskLang>(readStoredLang);

  function setLang(next: KioskLang) {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode, etc.) — choice just won't persist
    }
  }

  return (
    <KioskLanguageContext.Provider value={{ lang, setLang, t: (key, vars) => translate(lang, key, vars) }}>
      {children}
    </KioskLanguageContext.Provider>
  );
}

export function useKioskLanguage() {
  const ctx = useContext(KioskLanguageContext);
  if (!ctx) throw new Error("useKioskLanguage must be used within a KioskLanguageProvider");
  return ctx;
}
