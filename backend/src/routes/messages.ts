import { Router } from "express";
import { db } from "../db";
import { AuthUser, requireAuth } from "../middleware/auth";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

interface MessageRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string | null;
  image: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Same contact-visibility rule as GET /contacts, applied to the actual read/send routes so it's a
 * real boundary rather than just what the UI happens to list. A read-only test account (role
 * "user" with can_edit off) never appears in anyone's contacts — superadmin included — and can
 * itself only reach superadmins.
 */
function canMessage(me: AuthUser, other: { role: string; can_edit: number }): boolean {
  if (other.role === "user" && !other.can_edit) return false;
  const meCanEdit = me.role === "superadmin" || !!me.can_edit;
  return meCanEdit || other.role === "superadmin";
}

/**
 * Every other user, with their last message (if any) and how many of their messages to me are
 * unread — the conversation list. A read-only test account (role "user" with can_edit off — see
 * requireEdit) is left out of everyone else's list, and sees only superadmins in its own: it's a
 * demo login, not a real teammate, so it shouldn't clutter real agents' contacts or be able to
 * message other test accounts.
 */
messagesRouter.get("/contacts", (req, res) => {
  const me = req.user!.id;
  const meCanEdit = req.user!.role === "superadmin" || !!req.user!.can_edit;
  const query = meCanEdit
    ? `SELECT id, first_name, last_name, login, company, avatar FROM users
       WHERE id != ? AND NOT (role = 'user' AND can_edit = 0) ORDER BY first_name, last_name`
    : `SELECT id, first_name, last_name, login, company, avatar FROM users
       WHERE id != ? AND role = 'superadmin' ORDER BY first_name, last_name`;
  const users = db.prepare(query).all(me) as {
    id: number;
    first_name: string;
    last_name: string;
    login: string;
    company: string | null;
    avatar: string | null;
  }[];

  const lastMessage = db.prepare(
    `SELECT * FROM messages
     WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
     ORDER BY id DESC LIMIT 1`
  );
  const unreadCount = db.prepare(
    `SELECT COUNT(*) AS c FROM messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`
  );

  const contacts = users.map((u) => {
    const last = lastMessage.get(me, u.id, u.id, me) as MessageRow | undefined;
    const unread = (unreadCount.get(u.id, me) as { c: number }).c;
    return { ...u, lastMessage: last ?? null, unreadCount: unread };
  });
  res.json(contacts);
});

/** Total unread across all conversations — cheap enough to poll for the messenger button's badge without opening the panel. */
messagesRouter.get("/unread-count", (req, res) => {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL`)
    .get(req.user!.id) as { c: number };
  res.json({ count: row.c });
});

/** Full thread with one other user, newest last. Marks their messages to me as read as a side effect of opening it. */
messagesRouter.get("/:userId", (req, res) => {
  const me = req.user!.id;
  const other = Number(req.params.userId);
  const otherUser = db.prepare("SELECT role, can_edit FROM users WHERE id = ?").get(other) as
    | { role: string; can_edit: number }
    | undefined;
  if (!otherUser || !canMessage(req.user!, otherUser)) return res.status(404).json({ error: "Recipient not found" });
  const messages = db
    .prepare(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY id ASC LIMIT 500`
    )
    .all(me, other, other, me) as MessageRow[];

  db.prepare(`UPDATE messages SET read_at = datetime('now') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`).run(
    other,
    me
  );

  res.json(messages);
});

messagesRouter.post("/:userId", (req, res) => {
  const me = req.user!.id;
  const other = Number(req.params.userId);
  const { body, image } = req.body ?? {};
  if (!body?.trim() && !image) return res.status(400).json({ error: "Message needs text or an image" });

  const recipient = db.prepare("SELECT id, role, can_edit FROM users WHERE id = ?").get(other) as
    | { id: number; role: string; can_edit: number }
    | undefined;
  if (!recipient || !canMessage(req.user!, recipient)) return res.status(404).json({ error: "Recipient not found" });

  const info = db
    .prepare(`INSERT INTO messages (sender_id, recipient_id, body, image) VALUES (?, ?, ?, ?)`)
    .run(me, other, body?.trim() || null, image || null);
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(message);
});
