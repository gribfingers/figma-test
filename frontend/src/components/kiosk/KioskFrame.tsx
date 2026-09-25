import { ReactNode, useEffect, useState } from "react";
import { useKioskLanguage } from "../../kioskI18n";

interface Props {
  flightLabel?: string;
  stepBadge?: string;
  children: ReactNode;
}

const CLOCK_LOCALE: Record<string, string> = { ru: "ru-RU", en: "en-US", zh: "zh-CN" };

function useClock(locale: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Shared shell for the self-service kiosk pages — a 420px-wide column that
 * IS the kiosk's own screen (no outer device bezel), sitting on a dark-gray
 * page backdrop with its own cloud-gradient background. Header nav shows
 * the flight, live current time, and terminal, per the design spec; an
 * optional step badge sits above each screen's title. When no flight is
 * known yet, the time/terminal group centers instead of hugging the right
 * edge (there's nothing on the left to balance against).
 */
export function KioskFrame({ flightLabel, stepBadge, children }: Props) {
  const { t, lang } = useKioskLanguage();
  const time = useClock(CLOCK_LOCALE[lang]);
  return (
    <div className="kiosk-page">
      <div className="kiosk-frame">
        <div className="kiosk-clouds" />
        <div className={`kiosk-navbar${flightLabel ? "" : " kiosk-navbar-centered"}`}>
          {flightLabel && <span className="kiosk-navbar-flight">{t("Рейс {flight}", { flight: flightLabel })}</span>}
          <span className="kiosk-navbar-right">
            <span className="kiosk-navbar-time">{time}</span>
            <span className="kiosk-navbar-divider" />
            <span className="kiosk-navbar-terminal">{t("Терминал C")}</span>
          </span>
        </div>
        <div className="kiosk-frame-body">
          {stepBadge && <div className="kiosk-step-badge">{stepBadge}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
