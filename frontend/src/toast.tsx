import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CloseIcon } from "./components/Icon";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  onDismiss?: () => void;
  closing?: boolean;
}

interface ToastContextValue {
  /** onDismiss fires exactly once, whether the toast times out or is closed manually. */
  showToast: (message: string, kind?: ToastKind, onDismiss?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;
// How long the .closing fade-out (see styles.css) takes to play before the
// toast is actually removed and onDismiss fires — same "hold it in the DOM
// through its own exit transition" pattern as the slide-out side panels.
const TOAST_EXIT_MS = 300;

/**
 * App-wide toast stack, bottom-center — mounted once at the root (see
 * main.tsx) so a toast fired right before a navigation (e.g. "Flight
 * created" just before redirecting to the new flight's page) survives the
 * route change instead of disappearing with the page that triggered it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  // Guards against a toast already mid-exit (timeout fired, then the user
  // also clicks its close button) scheduling a second removal — onDismiss
  // must fire exactly once per toast, per the contract above.
  const dismiss = useCallback((id: number) => {
    let alreadyClosing = true;
    setToasts((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (!existing || existing.closing) return prev;
      alreadyClosing = false;
      return prev.map((t) => (t.id === id ? { ...t, closing: true } : t));
    });
    if (alreadyClosing) return;
    setTimeout(() => {
      setToasts((prev) => {
        prev.find((t) => t.id === id)?.onDismiss?.();
        return prev.filter((t) => t.id !== id);
      });
    }, TOAST_EXIT_MS);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success", onDismiss?: () => void) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message, onDismiss }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind} ${t.closing ? "closing" : ""}`}>
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
