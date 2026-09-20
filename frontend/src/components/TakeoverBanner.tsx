import { useEffect, useState } from "react";
import { api, CounterLockStatus } from "../api";
import { useAuth, useCanEdit } from "../auth";

const POLL_MS = 8000;

/**
 * Sits above the tab bar for the whole session whenever a supervisor has taken over check-in at
 * the counter this user is assigned to (see backend's counters.ts /takeover and checkin.ts's
 * blockIfTakenOver, which is what actually rejects this agent's own check-in attempts while this
 * is up). Unlike ReadOnlyBanner this is never dismissible — it reflects a live, temporary lock,
 * not a standing account property, and should disappear on its own the moment the supervisor
 * releases the counter (next poll tick).
 */
export function TakeoverBanner() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [status, setStatus] = useState<CounterLockStatus>({ locked: false });

  useEffect(() => {
    // Superadmins do the taking-over — they're never the ones locked out, and a read-only
    // user has no check-in mutations to be blocked from in the first place.
    if (!user || user.role === "superadmin" || !canEdit) return;

    let cancelled = false;
    function poll() {
      api
        .myCounterStatus()
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch(() => {
          // Transient network hiccup — keep showing whatever we last knew rather than flicker.
        });
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, canEdit]);

  if (!status.locked) return null;

  const supervisorName = [status.supervisorFirstName, status.supervisorLastName].filter(Boolean).join(" ") || "a supervisor";

  return (
    <div className="takeover-banner">
      <span>
        Check-in at counter <strong>{status.counterLabel}</strong> is temporarily being handled by supervisor{" "}
        <strong>{supervisorName}</strong> — please wait.
      </span>
    </div>
  );
}
