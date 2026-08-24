import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTabs } from "../tabs";
import { BellIcon, CloseIcon, HelpIcon, UserIcon } from "./Icon";

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
                    closeTab(tab.path);
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
        {/* Help, notifications, and the account panel aren't wired up yet — placeholders for now. */}
        <button type="button" className="tabs-icon-btn" title="Help">
          <HelpIcon size={18} />
        </button>
        <MoscowClock />
        <button type="button" className="tabs-icon-btn" title="Notifications">
          <BellIcon size={18} />
        </button>
        <button type="button" className="tabs-avatar-btn" title="Account">
          <UserIcon size={16} />
        </button>
      </div>
    </div>
  );
}
