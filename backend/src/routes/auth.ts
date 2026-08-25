import { Router } from "express";
import { db } from "../db";
import { generateSessionToken, hashPassword, verifyPassword } from "../auth";
import { AuthUser, requireAuth, SESSION_TTL_DAYS } from "../middleware/auth";

export const authRouter = Router();

function publicUser(u: AuthUser) {
  const { password_hash, ...rest } = u;
  return rest;
}

authRouter.post("/login", (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) return res.status(400).json({ error: "login and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE login = ?").get(login) as AuthUser | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid login or password" });
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, user.id, expiresAt);
  res.json({ token, user: publicUser(user) });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.user!));
});

/** Self-service profile fields only — login/password/role/can_edit are managed by a superadmin via /api/users. */
authRouter.patch("/me", requireAuth, (req, res) => {
  const { avatar, timezone, bio } = req.body ?? {};
  db.prepare(
    `UPDATE users SET
       avatar = COALESCE(?, avatar),
       timezone = COALESCE(?, timezone),
       bio = COALESCE(?, bio)
     WHERE id = ?`
  ).run(
    avatar !== undefined ? avatar : null,
    timezone !== undefined ? timezone : null,
    bio !== undefined ? bio : null,
    req.user!.id
  );
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as AuthUser;
  res.json(publicUser(updated));
});

authRouter.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as AuthUser;
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), req.user!.id);
  res.json({ ok: true });
});
