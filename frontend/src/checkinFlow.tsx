import { createContext, ReactNode, useContext, useState } from "react";

export const FLOW_STEPS = ["docs", "seats", "baggage", "services"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];
export const FLOW_STEP_LABEL: Record<FlowStep, string> = {
  docs: "Documents",
  seats: "Seats",
  baggage: "Baggage",
  services: "Extra services",
};

interface CheckinFlowState {
  flowStepFor: (pid: number) => FlowStep | null;
  setFlowStep: (pid: number, step: FlowStep | null) => void;
  flightInfoOpenFor: (pid: number) => boolean;
  setFlightInfoOpen: (pid: number, open: boolean) => void;
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
  const [stepByPid, setStepByPid] = useState<Record<number, FlowStep>>({});
  const [infoOpenByPid, setInfoOpenByPid] = useState<Record<number, boolean>>({});

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
      if (step === null) setInfoOpenByPid((prev) => ({ ...prev, [pid]: false }));
    },
    flightInfoOpenFor: (pid) => infoOpenByPid[pid] ?? false,
    setFlightInfoOpen: (pid, open) => setInfoOpenByPid((prev) => ({ ...prev, [pid]: open })),
  };

  return <CheckinFlowContext.Provider value={value}>{children}</CheckinFlowContext.Provider>;
}

export function useCheckinFlow(): CheckinFlowState {
  const ctx = useContext(CheckinFlowContext);
  if (!ctx) throw new Error("useCheckinFlow must be used within a CheckinFlowProvider");
  return ctx;
}
