import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export const FLOW_STEPS = ["docs", "seats", "baggage", "services"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];
export const FLOW_STEP_LABEL: Record<FlowStep, string> = {
  docs: "Documents",
  seats: "Seats",
  baggage: "Baggage",
  services: "Extra services",
};

// Mirrored to localStorage (like tabs.tsx's open-tab list) so a full page
// reload — which wipes every in-memory value, not just this component's own
// state — resumes on the same step instead of dropping back to the roster.
const STEP_STORAGE_KEY = "dcs_checkin_flow_step";

function loadStoredSteps(): Record<number, FlowStep> {
  try {
    const raw = localStorage.getItem(STEP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface CheckinFlowState {
  flowStepFor: (pid: number) => FlowStep | null;
  setFlowStep: (pid: number, step: FlowStep | null) => void;
  flightInfoOpenFor: (pid: number) => boolean;
  setFlightInfoOpen: (pid: number, open: boolean) => void;
  cartOpenFor: (pid: number) => boolean;
  setCartOpen: (pid: number, open: boolean) => void;
}

// PnrView owns the flow (it has the flight/passenger data), but the flow's
// step icons live in SideDrawer — a sibling rendered once in App.tsx, outside
// PnrView's subtree, so it can't read PnrView's local state directly. This
// context is the shared channel between the two, mirroring the TabsProvider
// pattern used for the same kind of cross-component sharing.
//
// Keyed by the PNR view's own passenger id (same key AddPaxButton's cache
// uses) rather than a single shared value — each open PNR tab has its own
// flow, so switching to a different tab must not leak one tab's step into
// another's.
const CheckinFlowContext = createContext<CheckinFlowState | null>(null);

export function CheckinFlowProvider({ children }: { children: ReactNode }) {
  const [stepByPid, setStepByPid] = useState<Record<number, FlowStep>>(loadStoredSteps);
  const [infoOpenByPid, setInfoOpenByPid] = useState<Record<number, boolean>>({});
  const [cartOpenByPid, setCartOpenByPid] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STEP_STORAGE_KEY, JSON.stringify(stepByPid));
    } catch {
      // Storage full or unavailable — the flow just won't survive a reload.
    }
  }, [stepByPid]);

  const value: CheckinFlowState = {
    flowStepFor: (pid) => stepByPid[pid] ?? null,
    setFlowStep: (pid, step) => {
      setStepByPid((prev) => {
        if (step === null) {
          const { [pid]: _omit, ...rest } = prev;
          return rest;
        }
        return { ...prev, [pid]: step };
      });
      if (step === null) {
        setInfoOpenByPid((prev) => ({ ...prev, [pid]: false }));
        setCartOpenByPid((prev) => ({ ...prev, [pid]: false }));
      }
    },
    flightInfoOpenFor: (pid) => infoOpenByPid[pid] ?? false,
    setFlightInfoOpen: (pid, open) => setInfoOpenByPid((prev) => ({ ...prev, [pid]: open })),
    cartOpenFor: (pid) => cartOpenByPid[pid] ?? false,
    setCartOpen: (pid, open) => setCartOpenByPid((prev) => ({ ...prev, [pid]: open })),
  };

  return <CheckinFlowContext.Provider value={value}>{children}</CheckinFlowContext.Provider>;
}

export function useCheckinFlow(): CheckinFlowState {
  const ctx = useContext(CheckinFlowContext);
  if (!ctx) throw new Error("useCheckinFlow must be used within a CheckinFlowProvider");
  return ctx;
}

// The check-in flow's own route (checkin/:flightId/pnr/:passengerId) — shared
// by SideDrawer (to look up the current page's flow state) and TopTabs (to
// look up a given tab's, which may not be the current page).
export function pnrFlowPidFromPath(pathname: string): number | null {
  const m = /^\/checkin\/\d+\/pnr\/(\d+)$/.exec(pathname);
  return m ? Number(m[1]) : null;
}
