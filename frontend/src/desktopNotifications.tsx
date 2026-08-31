import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useToast } from "./toast";
import { useLanguage } from "./i18n";

const STORAGE_KEY = "dcs_desktop_notifications_enabled";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface DesktopNotificationsContextValue {
  /** On only once both the user's toggle and the browser's own permission are granted — TopTabs
   *  checks this before ever calling the Notification constructor. */
  enabled: boolean;
  /** Whether the browser supports the Notification API at all — UserPanel hides the toggle otherwise. */
  supported: boolean;
  /** Flips the user's toggle; turning it on requests browser permission right there in the same
   *  click (the Notification API refuses a permission prompt outside a user gesture), and silently
   *  reverts to off if the browser denies or the person dismisses the prompt. */
  setEnabled: (enabled: boolean) => void;
}

const DesktopNotificationsContext = createContext<DesktopNotificationsContextValue | null>(null);

/** Desktop (system) notifications for new messenger messages while the tab is hidden or unfocused
 *  — see UserPanel's Settings section for the toggle and TopTabs for where these actually fire. */
export function DesktopNotificationsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(readStored);
  const { showToast } = useToast();
  const { t } = useLanguage();
  const supported = typeof window !== "undefined" && "Notification" in window;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — the setting just won't persist
    }
  }, [enabled]);

  function setEnabled(next: boolean) {
    if (!supported) return;
    if (!next) {
      setEnabledState(false);
      return;
    }
    if (Notification.permission === "granted") {
      setEnabledState(true);
      return;
    }
    if (Notification.permission === "denied") {
      showToast(t("Notifications are blocked for this site in your browser settings."), "error");
      setEnabledState(false);
      return;
    }
    Notification.requestPermission().then((permission) => {
      setEnabledState(permission === "granted");
      if (permission !== "granted") {
        showToast(t("Notifications weren't allowed — you can turn this on again once you allow them."), "error");
      }
    });
  }

  return (
    <DesktopNotificationsContext.Provider value={{ enabled: enabled && supported && Notification.permission === "granted", supported, setEnabled }}>
      {children}
    </DesktopNotificationsContext.Provider>
  );
}

export function useDesktopNotifications() {
  const ctx = useContext(DesktopNotificationsContext);
  if (!ctx) throw new Error("useDesktopNotifications must be used within a DesktopNotificationsProvider");
  return ctx;
}
