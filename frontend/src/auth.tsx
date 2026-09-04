import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api, getToken, setToken, User } from "./api";
import { trackEvent } from "./analytics";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Whole-app auth gate: holds the logged-in user (or null), backed by a
 * bearer token in localStorage (see api.ts). api.ts fires a
 * "dcs-unauthorized" window event whenever a request comes back 401 (bad or
 * expired session) — this listens for that so an expired session drops the
 * app back to the login screen without waiting for the next manual action.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener("dcs-unauthorized", onUnauthorized);
    return () => window.removeEventListener("dcs-unauthorized", onUnauthorized);
  }, [refresh]);

  async function login(loginName: string, password: string) {
    const { token, user: loggedInUser } = await api.login(loginName, password);
    setToken(token);
    setUser(loggedInUser);
    trackEvent("action", "auth.login");
  }

  function logout() {
    trackEvent("action", "auth.logout"); // must fire before setToken(null) clears what trackEvent gates on
    api.logout().catch(() => {});
    setToken(null);
    setUser(null);
  }

  function updateUser(patch: Partial<User>) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Whether the logged-in user can perform mutating actions (create/change/delete flights,
 *  passengers, seats, boarding) — mirrors the backend's requireEdit middleware: a superadmin
 *  always can, a regular user only if their can_edit flag is set. Read-only otherwise. */
export function useCanEdit(): boolean {
  const { user } = useAuth();
  return user?.role === "superadmin" || !!user?.can_edit;
}

/** Route guard: renders the nested routes only once logged in, otherwise sends to /login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
