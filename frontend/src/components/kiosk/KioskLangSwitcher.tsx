import { KioskLang, useKioskLanguage } from "../../kioskI18n";

const LANGS: { code: KioskLang; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
];

export function KioskLangSwitcher() {
  const { lang, setLang } = useKioskLanguage();
  return (
    <div className="kiosk-lang-switcher">
      {LANGS.map((l, i) => (
        <span key={l.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span>|</span>}
          <button type="button" className={lang === l.code ? "active" : ""} onClick={() => setLang(l.code)}>
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
