import { Link } from "react-router-dom";
import { useTabs } from "../tabs";
import { BellIcon, CloseIcon, HelpIcon, UserIcon } from "./Icon";

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
      <div className="tabs-actions">
        {/* Help, notifications, and the account panel aren't wired up yet — placeholders for now. */}
        <button type="button" className="tabs-icon-btn" title="Help">
          <HelpIcon size={18} />
        </button>
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
