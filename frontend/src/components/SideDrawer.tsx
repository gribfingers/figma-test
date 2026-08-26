import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { BurgerIcon, CheckInIcon, DeviceIcon, PlaneIcon, RefreshIcon, SettingsIcon } from "./Icon";

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Flight board itself, creating/editing a flight, and the gate/boarding
// screen (reached from a flight card's Actions menu) — all about a
// flight's own record and operations, not a specific passenger's check-in.
function isFlightPage(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/flights/") || pathname.startsWith("/boarding/");
}

// Passenger search, the PNR view it opens into, and the legacy PNR-lookup
// check-in screen — the check-in agent's own workflow.
function isCheckinPage(pathname: string): boolean {
  return pathname.startsWith("/search") || pathname.startsWith("/checkin/");
}

export function SideDrawer() {
  const { pathname } = useLocation();
  const { user } = useAuth();
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
        <Link
          to="/"
          className={`side-item ${isFlightPage(pathname) ? "selected" : ""}`}
          data-tooltip="Flight schedule"
        >
          <PlaneIcon size={20} />
        </Link>
        <Link
          to="/search"
          className={`side-item ${isCheckinPage(pathname) ? "selected" : ""}`}
          data-tooltip="Check-in"
        >
          <CheckInIcon size={20} />
        </Link>
        {user?.role === "superadmin" && (
          <Link
            to="/users-admin"
            className={`side-item ${pathname === "/users-admin" ? "selected" : ""}`}
            data-tooltip="User administration"
          >
            <SettingsIcon size={20} />
          </Link>
        )}
      </div>

      <div className="side-bottom">
        <button
          type="button"
          className="side-item side-update"
          title="Refresh"
          onClick={() => setLastUpdated(new Date())}
        >
          <RefreshIcon size={18} />
          <span className="side-time">{formatClock(lastUpdated)}</span>
        </button>
        <button type="button" className="side-item side-static" data-tooltip="Connected devices: OK">
          <DeviceIcon size={18} className="side-device-ok" />
        </button>
      </div>
    </nav>
  );
}
