import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useTabs } from "../tabs";
import { useAuth } from "../auth";
import { useCheckinFlow, pnrFlowPidFromPath } from "../checkinFlow";
import { useToast } from "../toast";
import { usePanelTransition } from "../usePanelMounted";
import { userAvatarColor, userInitials } from "../userDisplay";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./Icon";
import { UserPanel } from "./UserPanel";
import { Messenger } from "./Messenger";
import { Modal } from "./Modal";

// How far one click of a scroll arrow moves the tab strip.
const TAB_SCROLL_STEP = 240;

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
  const { tabs, activePath, closeTab, closeAllTabs } = useTabs();
  const { user } = useAuth();
  const { flowStepFor, setFlowStep } = useCheckinFlow();
  const { showToast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [messengerOpen, setMessengerOpen] = useState(false);
  const panelTransition = usePanelTransition(panelOpen);
  const messengerTransition = usePanelTransition(messengerOpen);
  const [unreadCount, setUnreadCount] = useState(0);
  // Path of a tab pending confirmation before it's closed (mid check-in flow).
  const [closeConfirmPath, setCloseConfirmPath] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const wasOverflowingRef = useRef(false);

  function requestCloseTab(path: string) {
    const pid = pnrFlowPidFromPath(path);
    if (pid !== null && flowStepFor(pid) !== null) {
      setCloseConfirmPath(path);
    } else {
      closeTab(path);
    }
  }

  function handleCloseAll() {
    if (!window.confirm(`Close all ${tabs.length} tabs?`)) return;
    closeAllTabs();
  }

  function scrollTabs(dir: -1 | 1) {
    listRef.current?.scrollBy({ left: dir * TAB_SCROLL_STEP, behavior: "smooth" });
  }

  function updateScrollState() {
    const el = listRef.current;
    if (!el) return;
    const isOverflowing = el.scrollWidth > el.clientWidth + 1;
    setOverflowing(isOverflowing);
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    if (isOverflowing && !wasOverflowingRef.current) {
      showToast("Too many tabs open — scroll the strip or close a few.", "info");
    }
    wasOverflowingRef.current = isOverflowing;
  }

  // Re-measure whenever the tab count changes and whenever the strip itself
  // is resized (sidebar toggle, window resize) — not just on mount.
  useEffect(() => {
    updateScrollState();
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length]);

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
      {overflowing && (
        <button
          type="button"
          className="tabs-icon-btn tabs-scroll-btn"
          title="Scroll tabs left"
          disabled={!canScrollLeft}
          onClick={() => scrollTabs(-1)}
        >
          <ChevronLeftIcon size={18} />
        </button>
      )}
      <div className="tabs-list" ref={listRef} onScroll={updateScrollState}>
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
      {overflowing && (
        <button
          type="button"
          className="tabs-icon-btn tabs-scroll-btn"
          title="Scroll tabs right"
          disabled={!canScrollRight}
          onClick={() => scrollTabs(1)}
        >
          <ChevronRightIcon size={18} />
        </button>
      )}
      {overflowing && (
        <button type="button" className="tabs-icon-btn tabs-scroll-btn" title="Close all tabs" onClick={handleCloseAll}>
          <CloseIcon size={16} />
        </button>
      )}
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
      {panelTransition.mounted && <UserPanel open={panelTransition.entered} onClose={() => setPanelOpen(false)} />}
      {messengerTransition.mounted && (
        <Messenger open={messengerTransition.entered} onClose={() => setMessengerOpen(false)} />
      )}
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
