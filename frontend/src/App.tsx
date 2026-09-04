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
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </CheckinFlowProvider>
  );
}
