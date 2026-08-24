import { Outlet } from "react-router-dom";
import { SideDrawer } from "./components/SideDrawer";
import { TopTabs } from "./components/TopTabs";

export function App() {
  return (
    <div className="app-layout">
      <SideDrawer />
      <div className="shell">
        <header>
          <TopTabs />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
