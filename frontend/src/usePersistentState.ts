import { useEffect, useState } from "react";

// Backs usePersistentState below. A page that's the currently-open tab stays
// mounted, but switching to a different tab and back remounts it (React
// Router only keeps the matched route's component alive) — this in-memory
// cache survives that. localStorage survives the harder case, a full
// browser reload, which wipes every in-memory value including this cache;
// it's seeded from storage lazily so a cold load still recovers state.
const memoryCache = new Map<string, unknown>();

function readInitial<T>(key: string, fallback: T): T {
  if (memoryCache.has(key)) return memoryCache.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as T;
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // Storage unavailable (private browsing) or corrupt — fall back to default.
  }
  return fallback;
}

/**
 * Like useState, but the value survives both a tab switch (remount) and a
 * full page reload. `key` must be unique to what's being stored — include
 * any id the value is scoped to (e.g. a flight or passenger id) since a
 * fixed key would leak one instance's value into another's.
 */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [state, setState] = useState<T>(() =>
    readInitial(key, typeof initial === "function" ? (initial as () => T)() : initial)
  );

  useEffect(() => {
    memoryCache.set(key, state);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — state just won't survive a reload.
    }
  }, [key, state]);

  return [state, setState] as const;
}
