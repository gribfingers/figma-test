import { ChangeEvent, CSSProperties, FormEvent, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { resizeImageToDataUrl, userAvatarColor, userInitials } from "../userDisplay";
import { Field } from "./Field";
import { Select } from "./Select";
import { ChevronDownIcon, CloseIcon } from "./Icon";

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
  onClose: () => void;
}

export function UserPanel({ onClose }: Props) {
  const { user, logout, updateUser } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [timezone, setTimezone] = useState(user?.timezone ?? "Europe/Moscow");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
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

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const updated = await api.updateMe({ timezone, bio });
      updateUser(updated);
      setSettingsSaved(true);
    } finally {
      setSavingSettings(false);
    }
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
    <div className="user-panel-overlay" onClick={onClose}>
      <div className="user-panel" onClick={(e) => e.stopPropagation()}>
        <div className="user-panel-header">
          <div>
            <div className="user-panel-name">
              {user.first_name} {user.last_name}
            </div>
            {user.company && <div className="user-panel-company">{user.company}</div>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="user-panel-avatar-wrap">
          <button
            type="button"
            className="user-panel-avatar"
            style={user.avatar ? undefined : ({ "--avatar-color": userAvatarColor(user) } as CSSProperties)}
            onClick={() => fileRef.current?.click()}
            title="Change photo"
          >
            {user.avatar ? <img src={user.avatar} alt="" /> : <span>{userInitials(user)}</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
        </div>

        <div className="user-panel-section">
          <button type="button" className="user-panel-section-head" onClick={() => setSettingsOpen((o) => !o)}>
            Settings
            <ChevronDownIcon size={16} className={settingsOpen ? "chevron-rotated" : ""} />
          </button>
          {settingsOpen && (
            <div className="user-panel-section-body">
              <div className="user-panel-theme-row" title="Coming soon">
                <span>Theme</span>
                <div className="user-panel-theme-toggle">
                  <button type="button" className="selected" disabled>Light</button>
                  <button type="button" disabled>Dark</button>
                </div>
              </div>
              <Select
                label="Timezone"
                value={timezone}
                onChange={setTimezone}
                options={timezones.map((tz) => ({ value: tz, label: tz }))}
              />
              <div className="field2 tall">
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder=" " rows={3} />
                <label>About</label>
              </div>
              {settingsSaved && <div className="ok-box">Saved.</div>}
              <button type="button" className="secondary" disabled={savingSettings} onClick={saveSettings}>
                Save
              </button>
            </div>
          )}
        </div>

        <div className="user-panel-section">
          <button type="button" className="user-panel-section-head" onClick={() => setSecurityOpen((o) => !o)}>
            Security
            <ChevronDownIcon size={16} className={securityOpen ? "chevron-rotated" : ""} />
          </button>
          {securityOpen && (
            <form className="user-panel-section-body" onSubmit={submitPasswordChange}>
              {pwError && <div className="error-box">{pwError}</div>}
              {pwSuccess && <div className="ok-box">Password changed.</div>}
              <Field label="Current password">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder=" "
                />
              </Field>
              <Field label="New password">
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder=" " />
              </Field>
              <button type="submit" className="secondary" disabled={pwBusy || !currentPassword || !newPassword}>
                Change password
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
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
