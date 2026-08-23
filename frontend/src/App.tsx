import { Link, Outlet } from "react-router-dom";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          DCS · Check-in & Boarding
        </Link>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
