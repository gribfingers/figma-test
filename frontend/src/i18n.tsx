import { createContext, ReactNode, useContext, useState } from "react";
import { RU } from "./i18n/ru";

export type Language = "en" | "ru";

const STORAGE_KEY = "dcs_language";

function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}

/**
 * Gettext-style translation: English is both the source text written
 * throughout the app and the RU dictionary's lookup key (see i18n/ru.ts),
 * rather than a separate id per string. That keeps every t("...") call
 * self-documenting at the call site, and a string with no RU entry yet
 * (or a stray one that no longer matches after a copy edit) just falls
 * back to English instead of rendering blank or throwing.
 */
function translate(text: string, language: Language): string {
  if (language === "en") return text;
  return RU[text] ?? text;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Translates a literal UI string to the current language (English passes through untouched). */
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode, etc.) — choice just won't persist
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: (text: string) => translate(text, language) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
