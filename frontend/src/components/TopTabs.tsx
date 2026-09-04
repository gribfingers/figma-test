import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { EMPTY_PATH, useTabs } from "../tabs";
import { useAuth } from "../auth";
import { useCheckinFlow, pnrFlowPidFromPath } from "../checkinFlow";
import { useToast } from "../toast";
import { useConfirmDialog } from "../confirmDialog";
import { usePanelTransition } from "../usePanelMounted";
import { userAvatarColor, userInitials } from "../userDisplay";
import { tabKindForPath, TabKind } from "../tabKind";
import { useTabIcons } from "../tabIcons";
import { useDesktopNotifications } from "../desktopNotifications";
import { useLanguage } from "../i18n";
import { useHotkey } from "../useShortcuts";
import { formatCombo } from "../shortcuts";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, RestoreTabIcon, TabBoardingIcon, TabCheckinIcon, TabFlightsIcon } from "./Icon";
import { UserPanel } from "./UserPanel";
import { Messenger } from "./Messenger";
import { Modal } from "./Modal";

const TAB_KIND_ICON: Record<Exclude<TabKind, null>, (size: number) => JSX.Element> = {
  flights: (size) => <TabFlightsIcon size={size} />,
  checkin: (size) => <TabCheckinIcon size={size} />,
  boarding: (size) => <TabBoardingIcon size={size} />,
};

// How far one click of a scroll arrow moves the tab strip.
const TAB_SCROLL_STEP = 240;

// Reopen-closed-tab isn't a rebindable shortcut (it mirrors Safari's own Cmd/Ctrl+Shift+T
// unconditionally — see the keydown handler below), but its displayed label should still follow
// the same per-platform formatting as every shortcut in shortcuts.ts (⌘⇧T on Mac, Ctrl+Shift+T elsewhere).
const reopenTabLabel = formatCombo("mod|shift|t");

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
  const { t } = useLanguage();
  return (
    <div className="moscow-clock" title={t("Moscow time (MSK)")}>
      {time} MSK
    </div>
  );
}

export function TopTabs() {
  const { tabs, activePath, closeTab, closeAllTabs, hasClosedTabs, reopenLastClosedTab } = useTabs();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flowStepFor, setFlowStep } = useCheckinFlow();
  const { showToast } = useToast();
  const { confirmDialog } = useConfirmDialog();
  const { enabled: tabIconsEnabled } = useTabIcons();
  const { enabled: desktopNotificationsEnabled } = useDesktopNotifications();
  const { t } = useLanguage();
  const [panelOpen, setPanelOpen] = useState(false);
  const [messengerOpen, setMessengerOpen] = useState(false);
  // Read inside the polling effect below without needing messengerOpen itself in that effect's
  // deps (which would otherwise tear down and restart the 15s interval on every panel open/close).
  const messengerOpenRef = useRef(messengerOpen);
  useEffect(() => {
    messengerOpenRef.current = messengerOpen;
  }, [messengerOpen]);
  // Set once a poll has actually reported a count, so the very first poll of the session (which
  // may already show pre-existing unread messages) never itself reads as "new" and fires a notification.
  const previousUnreadRef = useRef<number | null>(null);
  const panelTransition = usePanelTransition(panelOpen);
  const messengerTransition = usePanelTransition(messengerOpen);
  const [unreadCount, setUnreadCount] = useState(0);
  // Path of a tab pending confirmation before it's closed (mid check-in flow).
  const [closeConfirmPath, setCloseConfirmPath] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
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

  async function handleCloseAll() {
    if (!(await confirmDialog(t("Close all {n} tabs?").replace("{n}", String(tabs.length))))) return;
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
      showToast(t("Too many tabs open — scroll the strip or close a few."), "info");
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

  // Whichever tab is active — including one that just opened past the edge
  // of the visible strip — should always be scrolled into view, not left
  // hidden behind the scroll arrows. Depends on `tabs` too, not just
  // activePath: a brand-new tab's own useRegisterTab effect (in the page
  // component) adds it to the array a render *after* activePath already
  // points at it, so activePath alone would fire this one render too early
  // and find no matching ref yet.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activePath, tabs]);

  useEffect(() => {
    if (!user) return;
    previousUnreadRef.current = null;
    function poll() {
      api
        .unreadMessageCount()
        .then((r) => {
          const previous = previousUnreadRef.current;
          setUnreadCount(r.count);
          // "Not looking at it" covers both this tab being backgrounded/minimized (document.hidden)
          // and the browser window itself just not being the focused one (document.hasFocus() —
          // hidden alone misses e.g. alt-tabbing to another app while this window stays visible
          // behind it). Skip while the messenger panel is already open — that IS looking at it.
          if (
            previous !== null &&
            r.count > previous &&
            desktopNotificationsEnabled &&
            !messengerOpenRef.current &&
            (document.hidden || !document.hasFocus())
          ) {
            const notification = new Notification(t("Airport DCS"), { body: t("You have a new message"), tag: "dcs-new-message" });
            notification.onclick = () => {
              window.focus();
              setMessengerOpen(true);
              notification.close();
            };
          }
          previousUnreadRef.current = r.count;
        })
        .catch(() => {});
    }
    poll();
    // Messenger.tsx polls its own open thread/contacts much faster while it's open;
    // this slower interval just keeps the badge fresh while the panel is closed.
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [user, desktopNotificationsEnabled, t]);

  // Safari's own "reopen last closed tab" shortcut, scoped to this app's tab strip — accidentally
  // closing a tab you still needed shouldn't mean digging for it again through search/navigation.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        reopenLastClosedTab();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reopenLastClosedTab]);

  // Close/switch tabs — see shortcuts.ts (nav.tab-close/prev/next) and UserPanel's Keyboard
  // shortcuts section for how these can be rebound.
  useHotkey("nav.tab-close", () => {
    if (activePath !== EMPTY_PATH) requestCloseTab(activePath);
  });
  useHotkey("nav.tab-prev", () => {
    const idx = tabs.findIndex((t) => t.path === activePath);
    if (idx > 0) navigate(tabs[idx - 1].path);
  });
  useHotkey("nav.tab-next", () => {
    const idx = tabs.findIndex((t) => t.path === activePath);
    if (idx !== -1 && idx < tabs.length - 1) navigate(tabs[idx + 1].path);
  });

  return (
    <div className="tabs-bar">
      {overflowing && (
        <div className="tabs-scroll-group">
          <button
            type="button"
            className="tabs-icon-btn tabs-scroll-btn"
            title={t("Scroll tabs left")}
            disabled={!canScrollLeft}
            onClick={() => scrollTabs(-1)}
          >
            <ChevronLeftIcon size={18} />
          </button>
        </div>
      )}
      <div className="tabs-list" ref={listRef} onScroll={updateScrollState}>
        {tabs.map((tab) => {
          const selected = tab.path === activePath;
          const kind = tabKindForPath(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              ref={selected ? activeTabRef : undefined}
              className={`top-tab ${selected ? "selected" : ""}`}
            >
              {tabIconsEnabled && kind && <span className="top-tab-icon">{TAB_KIND_ICON[kind](12)}</span>}
              <span className="top-tab-label">{tab.label}</span>
              {tab.closable && (
                <button
                  type="button"
                  className="top-tab-close"
                  aria-label={`${t("Close")} ${tab.label}`}
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
        <div className="tabs-scroll-group">
          <button
            type="button"
            className="tabs-icon-btn tabs-scroll-btn"
            title={t("Scroll tabs right")}
            disabled={!canScrollRight}
            onClick={() => scrollTabs(1)}
          >
            <ChevronRightIcon size={18} />
          </button>
          <button type="button" className="tabs-icon-btn tabs-scroll-btn" title={t("Close all tabs")} onClick={handleCloseAll}>
            <CloseIcon size={16} />
          </button>
        </div>
      )}
      <div className="tabs-fill" />
      <div className="tabs-actions">
        {hasClosedTabs && (
          <button
            type="button"
            className="tabs-icon-btn"
            title={`${t("Reopen closed tab")} (${reopenTabLabel})`}
            onClick={() => reopenLastClosedTab()}
          >
            <RestoreTabIcon size={18} />
          </button>
        )}
        <MoscowClock />
        {user && (
          <button
            type="button"
            className="tabs-icon-btn"
            title={t("Messages")}
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
            title={t("Account")}
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
          title={t("Exit check-in")}
          onClose={() => setCloseConfirmPath(null)}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setCloseConfirmPath(null)}>{t("Cancel")}</button>
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
                {t("OK")}
              </button>
            </>
          }
        >
          {t("You are about to exit the check-in process. Unsaved progress on the current step will be lost.")}
        </Modal>
      )}
    </div>
  );
}
