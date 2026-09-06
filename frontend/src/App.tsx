import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SideDrawer } from "./components/SideDrawer";
import { TopTabs } from "./components/TopTabs";
import { ReadOnlyBanner } from "./components/ReadOnlyBanner";
import { CheckinFlowProvider } from "./checkinFlow";
import { trackPageView } from "./analytics";

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <CheckinFlowProvider>
      <div className="app-layout">
        <SideDrawer />
        <div className="shell">
          <ReadOnlyBanner />
          <header>
            <TopTabs />
          </header>
          {/* tabIndex=-1: opt out of Chrome/Safari's automatic Tab-stop for scrollable regions —
              every page lives inside this one overflow-y:auto container, so without this every
              page would gain a silent, unstyled extra Tab stop wherever it sits in the sequence. */}
          <main className="content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </CheckinFlowProvider>
  );
}
