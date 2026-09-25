import { useState } from "react";

const LANGS = ["RU", "EN", "中文"] as const;

/** Cosmetic per the design spec — only RU is actually wired to content right now (no i18n plumbing for the kiosk yet); EN/中文 are visually selectable but don't change any text. */
export function KioskLangSwitcher() {
  const [lang, setLang] = useState<(typeof LANGS)[number]>("RU");
  return (
    <div className="kiosk-lang-switcher">
      {LANGS.map((l, i) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span>|</span>}
          <button type="button" className={lang === l ? "active" : ""} onClick={() => setLang(l)}>
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
