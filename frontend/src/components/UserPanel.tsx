import { ChangeEvent, CSSProperties, FormEvent, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useFontSize } from "../fontSize";
import { useTabIcons } from "../tabIcons";
import { useLanguage } from "../i18n";
import { resizeImageToDataUrl, userAvatarColor, userInitials } from "../userDisplay";
import { Field } from "./Field";
import { Select } from "./Select";
import { ChevronDownIcon, CloseIcon, MinusIcon, PlusIcon } from "./Icon";

const COMMON_TIMEZONES = [
  "Europe/Moscow", "Europe/Kaliningrad", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk",
  "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Yakutsk", "Asia/Vladivostok",
  "Europe/London", "Europe/Paris", "Europe/Istanbul", "Asia/Dubai", "Asia/Shanghai", "UTC",
];

// Intl.supportedValuesOf is widely available in modern browsers; the small
// list above is only a fallback for environments where it isn't.
function timezoneOptions(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone");
  } catch {
    // fall through to the fallback list
  }
  return COMMON_TIMEZONES;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserPanel({ open, onClose }: Props) {
  const { user, logout, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { fontSize, increase, decrease } = useFontSize();
  const { enabled: tabIconsEnabled, setEnabled: setTabIconsEnabled } = useTabIcons();
  const { language, setLanguage, t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [timezone, setTimezone] = useState(user?.timezone ?? "Europe/Moscow");
  const fileRef = useRef<HTMLInputElement>(null);
  const timezones = useState(timezoneOptions)[0];

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  if (!user) return null;

  async function handleAvatarPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 256);
    const updated = await api.updateMe({ avatar: dataUrl });
    updateUser(updated);
  }

  async function changeTimezone(tz: string) {
    setTimezone(tz);
    const updated = await api.updateMe({ timezone: tz });
    updateUser(updated);
  }

  async function submitPasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    setPwBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPwSuccess(true);
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className={`user-panel-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div className="user-panel" onClick={(e) => e.stopPropagation()}>
        <div className="user-panel-header">
          <div>
            <div className="user-panel-name">
              {user.first_name} {user.last_name}
            </div>
            {user.company && <div className="user-panel-company">{user.company}</div>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="user-panel-avatar-wrap">
          <button
            type="button"
            className="user-panel-avatar"
            style={user.avatar ? undefined : ({ "--avatar-color": userAvatarColor(user) } as CSSProperties)}
            onClick={() => fileRef.current?.click()}
            title={t("Change photo")}
          >
            {user.avatar ? <img src={user.avatar} alt="" /> : <span>{userInitials(user)}</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
        </div>

        <div className="user-panel-section">
          <button type="button" className="user-panel-section-head" onClick={() => setSettingsOpen((o) => !o)}>
            {t("Settings")}
            <ChevronDownIcon size={16} className={settingsOpen ? "chevron-rotated" : ""} />
          </button>
          {settingsOpen && (
            <div className="user-panel-section-body">
              <div className="user-panel-theme-row">
                <span>{t("Language")}</span>
                <div className="user-panel-theme-toggle">
                  <button type="button" className={language === "ru" ? "selected" : ""} onClick={() => setLanguage("ru")}>RUS</button>
                  <button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>ENG</button>
                </div>
              </div>
              <div className="user-panel-theme-row">
                <span>{t("Theme")}</span>
                <div className="user-panel-theme-toggle">
                  <button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>{t("Light")}</button>
                  <button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>{t("Dark")}</button>
                </div>
              </div>
              <div className="user-panel-theme-row">
                <span>{t("Font size")}</span>
                <div className="seatmap-zoom">
                  <button type="button" className="seatmap-zoom-btn" onClick={decrease} aria-label={t("Decrease font size")}>
                    <MinusIcon size={14} />
                  </button>
                  <span className="seatmap-zoom-value">{fontSize}%</span>
                  <button type="button" className="seatmap-zoom-btn" onClick={increase} aria-label={t("Increase font size")}>
                    <PlusIcon size={14} />
                  </button>
                </div>
              </div>
              <div className="user-panel-theme-row">
                <span>{t("Tab section icons")}</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={tabIconsEnabled}
                    onChange={(e) => setTabIconsEnabled(e.target.checked)}
                  />
                </label>
              </div>
              <Select
                label={t("Timezone")}
                value={timezone}
                onChange={changeTimezone}
                options={timezones.map((tz) => ({ value: tz, label: tz }))}
              />
            </div>
          )}
        </div>

        <div className="user-panel-section">
          <button type="button" className="user-panel-section-head" onClick={() => setSecurityOpen((o) => !o)}>
            {t("Security")}
            <ChevronDownIcon size={16} className={securityOpen ? "chevron-rotated" : ""} />
          </button>
          {securityOpen && (
            <form className="user-panel-section-body" onSubmit={submitPasswordChange}>
              {pwError && <div className="error-box">{pwError}</div>}
              {pwSuccess && <div className="ok-box">{t("Password changed.")}</div>}
              <Field label={t("Current password")}>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder=" "
                />
              </Field>
              <Field label={t("New password")}>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder=" " />
              </Field>
              <button type="submit" className="secondary" disabled={pwBusy || !currentPassword || !newPassword}>
                {t("Change password")}
              </button>
            </form>
          )}
        </div>

        <div className="user-panel-footer">
          <button
            type="button"
            className="tertiary"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            {t("Logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
