import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BurgerIcon, DeviceIcon, FolderIcon, PlaneIcon, RefreshIcon, SettingsIcon } from "./Icon";

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function SideDrawer() {
  const { pathname } = useLocation();
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav className="side-drawer">
      {/* Opens links to other apps — not wired up yet. */}
      <button type="button" className="side-item" data-tooltip="Other apps">
        <BurgerIcon size={20} />
      </button>

      <div className="side-list">
        <Link to="/" className={`side-item ${pathname === "/" ? "selected" : ""}`} data-tooltip="Flight schedule">
          <PlaneIcon size={20} />
        </Link>
        <Link
          to="/passengers-admin"
          className={`side-item ${pathname === "/passengers-admin" ? "selected" : ""}`}
          data-tooltip="Passenger directory"
        >
          <FolderIcon size={20} />
        </Link>
        {/* Placeholder section — no page behind this yet. */}
        <button type="button" className="side-item" data-tooltip="Settings">
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="side-bottom">
        <button
          type="button"
          className="side-item side-update"
          data-tooltip="Refresh"
          onClick={() => setLastUpdated(new Date())}
        >
          <RefreshIcon size={18} />
          <span className="side-time">{formatClock(lastUpdated)}</span>
        </button>
        <button type="button" className="side-item" data-tooltip="Connected devices: OK">
          <DeviceIcon size={18} className="side-device-ok" />
        </button>
      </div>
    </nav>
  );
}
