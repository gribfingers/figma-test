import { Link } from "react-router-dom";

/**
 * Landing spot for closing the very last tab (see EMPTY_PATH in tabs.tsx) —
 * deliberately not registered as a tab itself and matched by none of
 * SideDrawer's isXPage() checks, so the tab strip and sidebar both go
 * fully blank instead of silently reopening Flights.
 */
export function EmptyState() {
  return (
    <div className="empty-state">
      <img src="/airport-journey.svg" alt="" className="empty-state-animation" />
      <div className="empty-state-title">No tabs open</div>
      <div className="empty-state-subtitle">Pick something from the sidebar to get back to work.</div>
      <Link to="/" className="empty-state-cta">
        <button type="button" className="secondary">Open flight schedule</button>
      </Link>
    </div>
  );
}
