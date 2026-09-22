import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  headerTitle: string;
  headerSub?: string;
  step?: number;
  totalSteps?: number;
  children: ReactNode;
}

/**
 * Shared shell for the self-service kiosk pages — a tall narrow "device"
 * panel centered on a dark background, styled after the elongated-screen
 * self-check-in/bag-drop terminals (see the reference video this was built
 * from): one instruction + one primary action per step, big touch targets.
 */
export function KioskFrame({ headerTitle, headerSub, step, totalSteps, children }: Props) {
  return (
    <div className="kiosk-page">
      <Link to="/login" className="kiosk-nav-link">
        ← Панель агента
      </Link>
      <div className="kiosk-device">
        <div className="kiosk-header">
          <div>
            <div className="kiosk-header-title">{headerTitle}</div>
            {headerSub && <div className="kiosk-header-sub">{headerSub}</div>}
          </div>
        </div>
        <div className="kiosk-body">
          {totalSteps && totalSteps > 1 && (
            <div className="kiosk-progress-dots">
              {Array.from({ length: totalSteps }, (_, i) => (
                <span key={i} className={i < (step ?? 0) ? "active" : ""} />
              ))}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
