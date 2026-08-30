import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";

/**
 * Landing spot for closing the very last tab (see EMPTY_PATH in tabs.tsx) —
 * deliberately not registered as a tab itself and matched by none of
 * SideDrawer's isXPage() checks, so the tab strip and sidebar both go
 * fully blank instead of silently reopening Flights.
 */
export function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="empty-state">
      <div className="empty-state-title">{t("No tabs open")}</div>
      <div className="empty-state-subtitle">{t("Pick something from the sidebar to get back to work.")}</div>
      <Link to="/" className="empty-state-cta">
        <button type="button" className="secondary">{t("Open flight schedule")}</button>
      </Link>
    </div>
  );
}
