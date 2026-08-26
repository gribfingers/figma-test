import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useTabs } from "../tabs";
import { useAuth } from "../auth";
import { useCheckinFlow, pnrFlowPidFromPath } from "../checkinFlow";
import { userAvatarColor, userInitials } from "../userDisplay";
import { ChatIcon, CloseIcon } from "./Icon";
import { UserPanel } from "./UserPanel";
import { Messenger } from "./Messenger";
import { Modal } from "./Modal";

// Moscow time, shown as a fixed reference point regardless of the viewer's
// own browser timezone — flight times throughout the app are UTC wall-clock
// (MSK = UTC+3, no DST since 2014), so this is what "now" means here.
function MoscowClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="moscow-clock" title="Moscow time (MSK)">
      {time} MSK
    </div>
  );
}

export function TopTabs() {
  const { tabs, activePath, closeTab } = useTabs();
  const { user } = useAuth();
  const { flowStepFor, setFlowStep } = useCheckinFlow();
  const [panelOpen, setPanelOpen] = useState(false);
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Path of a tab pending confirmation before it's closed (mid check-in flow).
  const [closeConfirmPath, setCloseConfirmPath] = useState<string | null>(null);

  function requestCloseTab(path: string) {
    const pid = pnrFlowPidFromPath(path);
    if (pid !== null && flowStepFor(pid) !== null) {
      setCloseConfirmPath(path);
    } else {
      closeTab(path);
    }
  }

  useEffect(() => {
    if (!user) return;
    function poll() {
      api.unreadMessageCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    }
    poll();
    // Messenger.tsx polls its own open thread/contacts much faster while it's open;
    // this slower interval just keeps the badge fresh while the panel is closed.
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <div className="tabs-bar">
      <div className="tabs-list">
        {tabs.map((tab) => {
          const selected = tab.path === activePath;
          return (
            <Link key={tab.path} to={tab.path} className={`top-tab ${selected ? "selected" : ""}`}>
              <span className="top-tab-label">{tab.label}</span>
              {tab.closable && (
                <button
                  type="button"
                  className="top-tab-close"
                  aria-label={`Close ${tab.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestCloseTab(tab.path);
                  }}
                >
                  <CloseIcon size={11} />
                </button>
              )}
            </Link>
          );
        })}
      </div>
      <div className="tabs-fill" />
      <div className="tabs-actions">
        <MoscowClock />
        {user && (
          <button
            type="button"
            className="tabs-icon-btn"
            title="Messages"
            onClick={() => {
              setMessengerOpen(true);
              setUnreadCount(0);
            }}
          >
            <ChatIcon size={18} />
            {unreadCount > 0 && <span className="tabs-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
        )}
        {user && (
          <button
            type="button"
            className="tabs-avatar-btn"
            title="Account"
            style={user.avatar ? undefined : { background: userAvatarColor(user) }}
            onClick={() => setPanelOpen(true)}
          >
            {user.avatar ? <img src={user.avatar} alt="" /> : userInitials(user)}
          </button>
        )}
      </div>
      {panelOpen && <UserPanel onClose={() => setPanelOpen(false)} />}
      {messengerOpen && <Messenger onClose={() => setMessengerOpen(false)} />}
      {closeConfirmPath && (
        <Modal
          title="Exit check-in"
          onClose={() => setCloseConfirmPath(null)}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setCloseConfirmPath(null)}>Cancel</button>
              <button
                type="button"
                className="tertiary"
                onClick={() => {
                  const pid = pnrFlowPidFromPath(closeConfirmPath);
                  if (pid !== null) setFlowStep(pid, null);
                  closeTab(closeConfirmPath);
                  setCloseConfirmPath(null);
                }}
              >
                OK
              </button>
            </>
          }
        >
          You are about to exit the check-in process. Unsaved progress on the current step will be lost.
        </Modal>
      )}
    </div>
  );
}
