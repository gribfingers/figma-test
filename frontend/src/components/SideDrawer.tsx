import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useCheckinFlow, FLOW_STEPS, FLOW_STEP_LABEL, FlowStep } from "../checkinFlow";
import {
  BaggageFlowIcon,
  BurgerIcon,
  CartFlowIcon,
  CheckInIcon,
  DeviceIcon,
  DocumentsFlowIcon,
  InfoIcon,
  PlaneIcon,
  RefreshIcon,
  SeatsFlowIcon,
  ServicesFlowIcon,
  SettingsIcon,
} from "./Icon";

const FLOW_STEP_ICON: Record<FlowStep, (size: number) => JSX.Element> = {
  docs: (size) => <DocumentsFlowIcon size={size} />,
  seats: (size) => <SeatsFlowIcon size={size} />,
  baggage: (size) => <BaggageFlowIcon size={size} />,
  services: (size) => <ServicesFlowIcon size={size} />,
};

// The check-in flow's own route (checkin/:flightId/pnr/:passengerId) — the
// only page the flow's step icons make sense on. isCheckinPage above also
// matches the legacy PNR-lookup screen, which never has a flow open.
function isPnrFlowPage(pathname: string): boolean {
  return /^\/checkin\/\d+\/pnr\/\d+$/.test(pathname);
}

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
  const { flowStep, setFlowStep, flightInfoOpen, setFlightInfoOpen } = useCheckinFlow();
  const showFlowIcons = flowStep !== null && isPnrFlowPage(pathname);
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
        {showFlowIcons && (
          <>
            <div className="side-divider" />
            {FLOW_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                className={`side-item ${flowStep === step ? "selected" : ""}`}
                data-tooltip={FLOW_STEP_LABEL[step]}
                onClick={() => setFlowStep(step)}
              >
                {FLOW_STEP_ICON[step](20)}
              </button>
            ))}
            <div className="side-divider" />
            {/* Placeholder — cart functionality isn't built yet. */}
            <button type="button" className="side-item" data-tooltip="Cart">
              <CartFlowIcon size={20} />
            </button>
            <button
              type="button"
              className={`side-item ${flightInfoOpen ? "selected" : ""}`}
              data-tooltip="Flight information"
              onClick={() => setFlightInfoOpen(true)}
            >
              <InfoIcon size={20} />
            </button>
          </>
        )}
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
