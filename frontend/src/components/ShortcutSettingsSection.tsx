import { useEffect, useState } from "react";
import { SHORTCUTS, formatCombo, comboFromEvent } from "../shortcuts";
import { useShortcutSettings } from "../useShortcuts";
import { useLanguage } from "../i18n";
import { RefreshIcon } from "./Icon";

function groupShortcuts() {
  const order: string[] = [];
  const byGroup = new Map<string, typeof SHORTCUTS>();
  for (const s of SHORTCUTS) {
    if (!byGroup.has(s.group)) {
      byGroup.set(s.group, []);
      order.push(s.group);
    }
    byGroup.get(s.group)!.push(s);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}
const GROUPED = groupShortcuts();

/**
 * UserPanel's "Keyboard shortcuts" accordion body — lists every shortcut from the registry
 * (shortcuts.ts), grouped, each with its current combo and a "record a new one" control. Every
 * page's own useHotkey call reads back whatever's saved here, so this is the only place bindings
 * are edited.
 */
export function ShortcutSettingsSection() {
  const { t } = useLanguage();
  const { overrides, effectiveCombo, setOverride, resetOverride, resetAll, ownerOf } = useShortcutSettings();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    const id = recordingId;
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecordingId(null);
        setConflict(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // lone modifier press — keep waiting for the real key
      const owner = ownerOf(combo, id);
      if (owner) {
        const ownerLabel = SHORTCUTS.find((s) => s.id === owner)?.label ?? owner;
        setConflict(t('Already used by "{name}"').replace("{name}", t(ownerLabel)));
        return;
      }
      setOverride(id, combo);
      setRecordingId(null);
      setConflict(null);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recordingId, ownerOf, setOverride, t]);

  return (
    <div className="shortcut-settings">
      {GROUPED.map(({ group, items }) => (
        <div key={group} className="shortcut-group">
          <div className="shortcut-group-label">{t(group)}</div>
          {items.map((s) => {
            const combo = effectiveCombo(s.id);
            const isRecording = recordingId === s.id;
            const isCustom = s.id in overrides;
            return (
              <div key={s.id} className="shortcut-row">
                <span className="shortcut-row-label">{t(s.label)}</span>
                <div className="shortcut-row-controls">
                  <button
                    type="button"
                    className={`shortcut-key ${isRecording ? "recording" : ""}`}
                    onClick={() => {
                      setRecordingId(s.id);
                      setConflict(null);
                    }}
                  >
                    {isRecording ? t("Press a key…") : formatCombo(combo)}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      className="icon-button"
                      title={t("Reset to default")}
                      onClick={() => resetOverride(s.id)}
                    >
                      <RefreshIcon size={14} />
                    </button>
                  )}
                </div>
                {isRecording && conflict && <div className="shortcut-conflict">{conflict}</div>}
              </div>
            );
          })}
        </div>
      ))}
      <button type="button" className="tertiary shortcut-reset-all" onClick={resetAll}>
        {t("Reset all shortcuts to default")}
      </button>
    </div>
  );
}
