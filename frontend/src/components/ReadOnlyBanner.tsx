import { useAuth, useCanEdit } from "../auth";
import { usePersistentState } from "../usePersistentState";
import { CloseIcon } from "./Icon";
import { useLanguage } from "../i18n";

/**
 * Sits above the tab bar for the whole session whenever the logged-in user has no edit rights
 * (see useCanEdit) — a plain-language heads-up to go with every action across the app being
 * hidden or disabled for them, since a greyed-out button alone doesn't explain why. Dismissal is
 * remembered per account (see usePersistentState) so closing it once doesn't feel undone by every
 * page navigation, but survives a login as a different user.
 */
export function ReadOnlyBanner() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [dismissed, setDismissed] = usePersistentState(`dcs_readonly_banner_dismissed_${user?.id ?? "anon"}`, false);

  if (canEdit || dismissed) return null;

  return (
    <div className="readonly-banner">
      <span>{t("You're signed in with a test account and don't have edit rights — everything here is read-only.")}</span>
      <button type="button" className="icon-button" aria-label={t("Close")} onClick={() => setDismissed(true)}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
