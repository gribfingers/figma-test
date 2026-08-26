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

// Flights is a normal, closable tab like any other now — this is just the
// bootstrap entry for a brand-new session (or one where every tab has been
// closed), not a permanent fixture.
const HOME_TAB: TabInfo = { path: "/", label: "Flights", closable: true };
const STORAGE_KEY = "dcs_tabs";

function loadStoredTabs(): TabInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const restored: TabInfo[] = Array.isArray(parsed)
      ? parsed.filter((t): t is TabInfo => t && typeof t.path === "string" && typeof t.label === "string")
      : [];
    return restored.length > 0 ? restored : [HOME_TAB];
  } catch {
    return [HOME_TAB];
  }
}

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Browser-style tabs: each visited page (flight board, check-in, boarding, …)
 * registers itself as an open tab via useRegisterTab. "Selected" is derived
 * from the router's current location, not tracked separately, so following
 * a plain <Link> (e.g. a page's own "Flight board" back-link) still updates
 * the tab strip correctly. The open tab list is mirrored to localStorage so
 * a page reload (which resets all in-memory React state) doesn't wipe out
 * every tab but the one just reloaded.
 */
export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<TabInfo[]>(loadStoredTabs);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // Storage full or unavailable (private browsing) — tabs just won't survive a reload.
    }
  }, [tabs]);

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
