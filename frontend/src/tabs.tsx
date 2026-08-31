import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  closeAllTabs: () => void;
  /** Whether there's a recently-closed tab reopenLastClosedTab can bring back. */
  hasClosedTabs: boolean;
  /** Reopens the most recently closed tab (Safari's Cmd+Shift+T) — walks back through history
   *  one tab per call if pressed repeatedly, same as browsers do it. No-op if the stack is empty. */
  reopenLastClosedTab: () => void;
  /** Registers a callback to run when the tab at `path` is closed (not on a plain tab-switch remount,
   *  which happens far more often and should leave persisted state alone) — e.g. to clear stale
   *  usePersistentState data. Returns an unregister function; call it on unmount. */
  onTabClose: (path: string, cleanup: () => void) => () => void;
}

// Flights is a normal, closable tab like any other now — this is just the
// bootstrap entry for a brand-new session (or one where every tab has been
// closed), not a permanent fixture.
const HOME_TAB: TabInfo = { path: "/", label: "Flights", closable: true };
const STORAGE_KEY = "dcs_tabs";
const CLOSED_STORAGE_KEY = "dcs_closed_tabs";
// How many recently-closed tabs to remember — well past what anyone would realistically want to
// walk back through one Cmd+Shift+T at a time, just a sane cap on the persisted history.
const MAX_CLOSED_HISTORY = 20;
// Closing the very last tab lands here instead of silently reopening
// Flights — no sidebar item matches this path, so nothing shows active.
export const EMPTY_PATH = "/empty";

function loadStoredList(key: string): TabInfo[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((t): t is TabInfo => t && typeof t.path === "string" && typeof t.label === "string")
      : [];
  } catch {
    return [];
  }
}

function loadStoredTabs(): TabInfo[] {
  const restored = loadStoredList(STORAGE_KEY);
  return restored.length > 0 ? restored : [HOME_TAB];
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
  // Most-recently-closed last — reopenLastClosedTab pops off the end. Seeded from storage so the
  // history survives a reload the same way the open tab list does.
  const [closedTabs, setClosedTabs] = useState<TabInfo[]>(() => loadStoredList(CLOSED_STORAGE_KEY));
  const location = useLocation();
  const navigate = useNavigate();
  const closeCleanups = useRef(new Map<string, Set<() => void>>());

  const onTabClose = useCallback((path: string, cleanup: () => void) => {
    let set = closeCleanups.current.get(path);
    if (!set) {
      set = new Set();
      closeCleanups.current.set(path, set);
    }
    set.add(cleanup);
    return () => set!.delete(cleanup);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // Storage full or unavailable (private browsing) — tabs just won't survive a reload.
    }
  }, [tabs]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOSED_STORAGE_KEY, JSON.stringify(closedTabs));
    } catch {
      // Storage full or unavailable — reopen history just won't survive a reload.
    }
  }, [closedTabs]);

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

  // closeTab/closeAllTabs/reopenLastClosedTab all read `tabs`/`closedTabs` from the captured state
  // variable rather than a setState updater's own `prev` argument, and never call one state setter
  // from inside another's updater — React 18 StrictMode double-invokes updater functions in dev to
  // catch exactly that impurity, and an earlier version of this nested setClosedTabs inside setTabs's
  // updater, which duplicated every closed-tab history entry under StrictMode.
  const closeTab = useCallback(
    (path: string) => {
      closeCleanups.current.get(path)?.forEach((fn) => fn());
      closeCleanups.current.delete(path);
      const idx = tabs.findIndex((t) => t.path === path);
      if (idx === -1) return;
      const closed = tabs[idx];
      if (closed.closable) {
        setClosedTabs((prev) => [...prev, closed].slice(-MAX_CLOSED_HISTORY));
      }
      setTabs((prev) => prev.filter((t) => t.path !== path));
      if (location.pathname === path) {
        const next = tabs.filter((t) => t.path !== path);
        const fallback = next[idx - 1] ?? next[0] ?? null;
        navigate(fallback ? fallback.path : EMPTY_PATH);
      }
    },
    [tabs, location.pathname, navigate]
  );

  // Only closable tabs go away — same rule closeTab's own per-tab button follows.
  const closeAllTabs = useCallback(() => {
    for (const t of tabs) {
      if (t.closable) closeCleanups.current.get(t.path)?.forEach((fn) => fn());
    }
    closeCleanups.current.clear();
    const closable = tabs.filter((t) => t.closable);
    if (closable.length > 0) {
      setClosedTabs((prev) => [...prev, ...closable].slice(-MAX_CLOSED_HISTORY));
    }
    const kept = tabs.filter((t) => !t.closable);
    setTabs(kept);
    navigate(kept[0]?.path ?? EMPTY_PATH);
  }, [tabs, navigate]);

  // Safari's Cmd+Shift+T, scoped to this app's own tab strip rather than the browser's — see
  // TopTabs.tsx for the keyboard shortcut and toolbar button that call this.
  const reopenLastClosedTab = useCallback(() => {
    if (closedTabs.length === 0) return;
    const last = closedTabs[closedTabs.length - 1];
    setClosedTabs((prev) => prev.slice(0, -1));
    setTabs((prev) => (prev.some((t) => t.path === last.path) ? prev : [...prev, last]));
    navigate(last.path);
  }, [closedTabs, navigate]);

  return (
    <TabsContext.Provider
      value={{
        tabs,
        activePath: location.pathname,
        openTab,
        closeTab,
        closeAllTabs,
        hasClosedTabs: closedTabs.length > 0,
        reopenLastClosedTab,
        onTabClose,
      }}
    >
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
