import { useLocation } from "react-router-dom";
import { useTabs } from "../tabs";
import { useLanguage } from "../i18n";

/**
 * Shown instead of an endless "Loading…" when the flight/passenger a tab's
 * URL points to no longer exists — most commonly because the demo schedule
 * was regenerated (User administration's "Regenerate today's schedule")
 * while the tab was already open, so its id no longer resolves to anything.
 */
export function EntityNotFound({ label }: { label: string }) {
  const { pathname } = useLocation();
  const { closeTab } = useTabs();
  const { t } = useLanguage();
  return (
    <div className="content">
      <p>{label} {t("no longer exists. It may have been deleted, or today's demo schedule was regenerated after this tab was opened.")}</p>
      <button type="button" className="secondary" onClick={() => closeTab(pathname)}>
        {t("Close tab")}
      </button>
    </div>
  );
}
