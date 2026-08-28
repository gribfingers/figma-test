import { Router } from "express";
import { db } from "../db";
import { generatePassword, hashPassword } from "../auth";
import { AuthUser, requireAuth, requireSuperadmin } from "../middleware/auth";
import { regenerateTodaySchedule } from "../scheduleGenerator";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireSuperadmin);

function publicUser(u: AuthUser) {
  const { password_hash, ...rest } = u;
  return rest;
}

usersRouter.get("/", (_req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY id").all() as AuthUser[];
  res.json(users.map(publicUser));
});

/** Creates a user with a freshly generated password, returned once — the superadmin relays it to them. */
usersRouter.post("/", (req, res) => {
  const { login, first_name, last_name, role, can_edit, company } = req.body ?? {};
  if (!login || !first_name || !last_name) {
    return res.status(400).json({ error: "login, first_name and last_name are required" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(login);
  if (existing) return res.status(409).json({ error: "That login is already taken" });

  const password = generatePassword();
  const info = db
    .prepare(
      `INSERT INTO users (login, password_hash, first_name, last_name, role, can_edit, company)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      login,
      hashPassword(password),
      first_name,
      last_name,
      role === "superadmin" ? "superadmin" : "user",
      can_edit ? 1 : 0,
      company || null
    );

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as AuthUser;
  res.status(201).json({ user: publicUser(user), password });
});

usersRouter.patch("/:id", (req, res) => {
  const { first_name, last_name, role, can_edit, company } = req.body ?? {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare(
    `UPDATE users SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       role = COALESCE(?, role),
       can_edit = COALESCE(?, can_edit),
       company = COALESCE(?, company)
     WHERE id = ?`
  ).run(
    first_name ?? null,
    last_name ?? null,
    role === "superadmin" || role === "user" ? role : null,
    can_edit !== undefined ? (can_edit ? 1 : 0) : null,
    company !== undefined ? company : null,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as AuthUser;
  res.json(publicUser(updated));
});

/** Regenerates the password and revokes existing sessions, so the old password/token stop working immediately. */
usersRouter.post("/:id/reset-password", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const password = generatePassword();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), req.params.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);
  res.json({ password });
});

/** Rebuilds today's auto-generated demo flights from scratch — see regenerateTodaySchedule. */
usersRouter.post("/regenerate-today-schedule", (_req, res) => {
  const result = regenerateTodaySchedule(new Date());
  res.json(result);
});

usersRouter.delete("/:id", (req, res) => {
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ error: "You can't delete your own account" });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
