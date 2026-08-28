import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "dcs_tab_icons_enabled";

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

interface TabIconsContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const TabIconsContext = createContext<TabIconsContextValue | null>(null);

/** Whether TopTabs shows a colored section badge (flights/check-in/boarding) before each tab's label — see UserPanel's Settings section. */
export function TabIconsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode, etc.) — the setting just won't persist
    }
  }, [enabled]);

  return <TabIconsContext.Provider value={{ enabled, setEnabled }}>{children}</TabIconsContext.Provider>;
}

export function useTabIcons() {
  const ctx = useContext(TabIconsContext);
  if (!ctx) throw new Error("useTabIcons must be used within a TabIconsProvider");
  return ctx;
}
