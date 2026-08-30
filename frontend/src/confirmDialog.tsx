import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useLanguage } from "./i18n";

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red) — for actions like delete/close-flight. */
  danger?: boolean;
}

interface PendingDialog {
  message: string;
  confirmLabel: string;
  /** null => alert mode: a single OK-style button, no Cancel. */
  cancelLabel: string | null;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConfirmContextValue {
  /** Replaces window.confirm(message) — resolves true/false instead of blocking synchronously. */
  confirmDialog: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  /** Replaces window.alert(message) — resolves once the user dismisses it. */
  alertDialog: (message: string, confirmLabel?: string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * App-wide replacement for window.confirm/alert — same "one pending item,
 * mounted once at the root" shape as ToastProvider, but each call resolves
 * a Promise instead of firing a callback, so call sites keep their existing
 * `if (!(await confirmDialog(...))) return;` shape almost unchanged from
 * the native `if (!confirm(...)) return;` they replace.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingDialog | null>(null);

  const confirmDialog = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setPending({
          message,
          confirmLabel: options.confirmLabel ?? t("OK"),
          cancelLabel: options.cancelLabel ?? t("Cancel"),
          danger: options.danger,
          onConfirm: () => {
            resolve(true);
            setPending(null);
          },
          onCancel: () => {
            resolve(false);
            setPending(null);
          },
        });
      }),
    [t]
  );

  const alertDialog = useCallback(
    (message: string, confirmLabel?: string) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          resolve();
          setPending(null);
        };
        setPending({
          message,
          confirmLabel: confirmLabel ?? t("OK"),
          cancelLabel: null,
          onConfirm: finish,
          onCancel: finish,
        });
      }),
    [t]
  );

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") pending!.onCancel();
      else if (e.key === "Enter") pending!.onConfirm();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  return (
    <ConfirmContext.Provider value={{ confirmDialog, alertDialog }}>
      {children}
      {pending && (
        <div className="confirm-dialog-overlay" onClick={pending.onCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-dialog-message">{pending.message}</p>
            <div className="confirm-dialog-footer">
              {pending.cancelLabel != null && (
                <button type="button" className="tertiary" onClick={pending.onCancel}>
                  {pending.cancelLabel}
                </button>
              )}
              <button type="button" className={pending.danger ? "danger" : ""} autoFocus onClick={pending.onConfirm}>
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirmDialog must be used within a ConfirmProvider");
  return ctx;
}
