import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useCheckinFlow, FLOW_STEPS, FLOW_STEP_LABEL, FlowStep, pnrFlowPidFromPath } from "../checkinFlow";
import { tabKindForPath } from "../tabKind";
import { useLanguage } from "../i18n";
import {
  BaggageFlowIcon,
  BoardingIcon,
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


function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function SideDrawer() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { flowStepFor, setFlowStep, flightInfoOpenFor, setFlightInfoOpen, cartOpenFor, setCartOpen } = useCheckinFlow();
  const kind = tabKindForPath(pathname);
  const pnrPid = pnrFlowPidFromPath(pathname);
  const flowStep = pnrPid !== null ? flowStepFor(pnrPid) : null;
  const flightInfoOpen = pnrPid !== null && flightInfoOpenFor(pnrPid);
  const cartOpen = pnrPid !== null && cartOpenFor(pnrPid);
  const showFlowIcons = pnrPid !== null && flowStep !== null;
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav className="side-drawer">
      {/* Opens links to other apps — not wired up yet. */}
      <button type="button" className="side-item" data-tooltip={t("Other apps")}>
        <BurgerIcon size={20} />
      </button>

      <div className="side-list">
        <Link
          to="/"
          className={`side-item ${kind === "flights" ? "selected" : ""}`}
          data-tooltip={t("Flight schedule")}
        >
          <PlaneIcon size={20} />
        </Link>
        <Link
          to="/search"
          className={`side-item ${kind === "checkin" && !showFlowIcons ? "selected" : ""}`}
          data-tooltip={t("Check-in")}
        >
          <CheckInIcon size={20} />
        </Link>
        <Link to="/boarding-search" className={`side-item ${kind === "boarding" ? "selected" : ""}`} data-tooltip={t("Boarding")}>
          <BoardingIcon size={20} />
        </Link>
        {showFlowIcons && (
          <>
            <div className="side-divider" />
            {FLOW_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                className={`side-item ${flowStep === step ? "selected" : ""}`}
                data-tooltip={t(FLOW_STEP_LABEL[step])}
                onClick={() => setFlowStep(pnrPid!, step)}
              >
                {FLOW_STEP_ICON[step](20)}
              </button>
            ))}
            <div className="side-divider" />
            <button
              type="button"
              className={`side-item ${cartOpen ? "selected" : ""}`}
              data-tooltip={t("Cart")}
              onClick={() => setCartOpen(pnrPid!, true)}
            >
              <CartFlowIcon size={20} />
            </button>
            <button
              type="button"
              className={`side-item ${flightInfoOpen ? "selected" : ""}`}
              data-tooltip={t("Flight information")}
              onClick={() => setFlightInfoOpen(pnrPid!, true)}
            >
              <InfoIcon size={20} />
            </button>
          </>
        )}
        {user?.role === "superadmin" && (
          <Link
            to="/users-admin"
            className={`side-item ${pathname === "/users-admin" ? "selected" : ""}`}
            data-tooltip={t("User administration")}
          >
            <SettingsIcon size={20} />
          </Link>
        )}
      </div>

      <div className="side-bottom">
        <button
          type="button"
          className="side-item side-update"
          title={t("Refresh")}
          onClick={() => setLastUpdated(new Date())}
        >
          <RefreshIcon size={18} />
          <span className="side-time">{formatClock(lastUpdated)}</span>
        </button>
        <button type="button" className="side-item side-static" data-tooltip={t("Connected devices: OK")}>
          <DeviceIcon size={18} className="side-device-ok" />
        </button>
      </div>
    </nav>
  );
}
