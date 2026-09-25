import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  flightLabel?: string;
  terminal?: string;
  stepBadge?: string;
  children: ReactNode;
}

function useClock() {
  const now = new Date();
  return now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Shared shell for the self-service kiosk pages — a 420px-wide column that
 * IS the kiosk's own screen (no outer device bezel), sitting directly on a
 * cloud-gradient background. Header nav shows the flight, current time, and
 * terminal, per the design spec; an optional step badge sits above each
 * screen's title.
 */
export function KioskFrame({ flightLabel, terminal = "Терминал C", stepBadge, children }: Props) {
  const time = useClock();
  return (
    <div className="kiosk-page">
      <div className="kiosk-frame">
        <div className="kiosk-clouds" />
        <Link to="/login" className="kiosk-nav-link">
          ← Панель агента
        </Link>
        <div className="kiosk-navbar">
          <span className="kiosk-navbar-flight">{flightLabel ? `Рейс ${flightLabel}` : ""}</span>
          <span className="kiosk-navbar-right">
            <span className="kiosk-navbar-time">{time}</span>
            <span className="kiosk-navbar-divider" />
            <span className="kiosk-navbar-terminal">{terminal}</span>
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
