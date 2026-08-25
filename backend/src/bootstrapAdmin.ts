import { db } from "./db";
import { hashPassword } from "./auth";

/**
 * Ensures a superadmin account exists — called from index.ts on every
 * server start, not just from seed.ts. A production deploy's Docker CMD
 * only runs the server (`node dist/index.js`); it never runs `npm run
 * seed`. This is the only place guaranteed to run after the users table
 * migration lands on a fresh or already-deployed database, so it's what
 * actually creates the first login in production.
 */
export function ensureSuperadmin() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'superadmin'").get();
  if (existing) return;
  const login = "admin";
  const password = "admin123";
  db.prepare(
    `INSERT INTO users (login, password_hash, first_name, last_name, role, can_edit, company)
     VALUES (?, ?, ?, ?, 'superadmin', 1, ?)`
  ).run(login, hashPassword(password), "Admin", "Admin", "Aeroflot");
  console.log(`Bootstrapped superadmin account — login: ${login}  password: ${password} (change it after logging in).`);
}
