import { NextFunction, Request, Response } from "express";
import { db } from "../db";

/**
 * Blocks a non-superadmin agent's mutations while a supervisor has taken over the counter
 * they're assigned to (see routes/counters.ts's /takeover). Superadmins are never blocked —
 * they're the ones doing the taking-over, and may also be checking in passengers themselves
 * outside of any counter. 423 Locked, not 403: this is a temporary hand-off, not a permissions
 * problem — the frontend's TakeoverBanner explains it in plain language.
 *
 * Used by checkin.ts's actual check-in mutations, and by counters.ts's /my-flight and /my-focus
 * (the agent's own live-handoff signals — see those routes' comments) so an agent who keeps
 * clicking around after being taken over can't yank the flight/passenger out from under the
 * supervisor mid check-in.
 */
export function blockIfTakenOver(req: Request, res: Response, next: NextFunction) {
  if (req.user!.role === "superadmin") return next();
  const counter = db
    .prepare(
      `SELECT c.id, u.first_name, u.last_name FROM counters c
       LEFT JOIN users u ON u.id = c.takeover_by
       WHERE c.agent_id = ? AND c.takeover_by IS NOT NULL LIMIT 1`
    )
    .get(req.user!.id) as { id: number; first_name: string; last_name: string } | undefined;
  if (counter) {
    return res.status(423).json({
      error: `Check-in at your counter is temporarily being handled by supervisor ${counter.first_name} ${counter.last_name}`,
    });
  }
  next();
}
