import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface TabInfo {
  path: string;
  label: string;
  closable: boolean;
}

interface TabsContextValue {
  tabs: TabInfo[];
  activePath: string;
  openTab: (tab: TabInfo) => void;
  closeTab: (path: string) => void;
}

const HOME_TAB: TabInfo = { path: "/", label: "Flights", closable: false };

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Browser-style tabs: each visited page (flight board, check-in, boarding, …)
 * registers itself as an open tab via useRegisterTab. "Selected" is derived
 * from the router's current location, not tracked separately, so following
 * a plain <Link> (e.g. a page's own "Flight board" back-link) still updates
 * the tab strip correctly.
 */
export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<TabInfo[]>([HOME_TAB]);
  const location = useLocation();
  const navigate = useNavigate();

  const openTab = useCallback((tab: TabInfo) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === tab.path);
      if (idx === -1) return [...prev, tab];
      if (prev[idx].label === tab.label && prev[idx].closable === tab.closable) return prev;
      const next = [...prev];
      next[idx] = tab;
      return next;
    });
  }, []);

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        if (idx === -1) return prev;
        const next = prev.filter((t) => t.path !== path);
        if (location.pathname === path) {
          const fallback = next[idx - 1] ?? next[0] ?? HOME_TAB;
          navigate(fallback.path);
        }
        return next;
      });
    },
    [location.pathname, navigate]
  );

  return (
    <TabsContext.Provider value={{ tabs, activePath: location.pathname, openTab, closeTab }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within a TabsProvider");
  return ctx;
}

/** Call from a page component to declare it as an open tab (idempotent; updates the label as it changes, e.g. once flight data loads). */
export function useRegisterTab(label: string, closable = true) {
  const { openTab } = useTabs();
  const { pathname } = useLocation();
  useEffect(() => {
    openTab({ path: pathname, label, closable });
  }, [pathname, label, closable, openTab]);
}
