import { Outlet } from "react-router-dom";
import { SideDrawer } from "./components/SideDrawer";
import { TopTabs } from "./components/TopTabs";
import { ReadOnlyBanner } from "./components/ReadOnlyBanner";
import { CheckinFlowProvider } from "./checkinFlow";

export function App() {
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
