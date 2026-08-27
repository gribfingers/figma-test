import { Link } from "react-router-dom";
import { PlaneIcon } from "../components/Icon";

/**
 * Landing spot for closing the very last tab (see EMPTY_PATH in tabs.tsx) —
 * deliberately not registered as a tab itself and matched by none of
 * SideDrawer's isXPage() checks, so the tab strip and sidebar both go
 * fully blank instead of silently reopening Flights.
 */
export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-sky">
        <span className="empty-state-cloud c1" />
        <span className="empty-state-cloud c2" />
        <span className="empty-state-cloud c3" />
        <span className="empty-state-plane">
          <PlaneIcon size={28} />
        </span>
        <span className="empty-state-runway" />
      </div>
      <div className="empty-state-title">No tabs open</div>
      <div className="empty-state-subtitle">Pick something from the sidebar to get back to work.</div>
      <Link to="/" className="empty-state-cta">
        <button type="button" className="secondary">Open flight schedule</button>
      </Link>
    </div>
  );
}
