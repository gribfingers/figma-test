import { NextFunction, Request, Response } from "express";
import { db } from "../db";

export interface AuthUser {
  id: number;
  login: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: "superadmin" | "user";
  can_edit: number;
  company: string | null;
  avatar: string | null;
  timezone: string;
  bio: string | null;
  created_at: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** The bearer token that authenticated this request — routes that revoke sessions (e.g.
       *  reset-password) use this to spare the caller's own session when it's their own account. */
      token?: string;
    }
  }
}

export const SESSION_TTL_DAYS = 30;

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Every route in this app requires a logged-in session — there's no anonymous/read-only browsing. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | { token: string; user_id: number; expires_at: string }
    | undefined;
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return res.status(401).json({ error: "Session expired" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) as AuthUser | undefined;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  req.user = user;
  req.token = token;
  next();
}

/** Superadmin always passes; a regular user needs the can_edit flag the superadmin grants them. */
export function requireEdit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role === "superadmin" || req.user.can_edit) return next();
  return res.status(403).json({ error: "Read-only access — ask your administrator for edit rights" });
}

export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "superadmin") return res.status(403).json({ error: "Superadmin only" });
  next();
}
