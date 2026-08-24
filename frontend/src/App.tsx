import { Outlet } from "react-router-dom";
import { TopTabs } from "./components/TopTabs";

export function App() {
  return (
    <div className="shell">
      <header>
        <TopTabs />
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
