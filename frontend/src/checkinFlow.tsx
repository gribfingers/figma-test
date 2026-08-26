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
  flowStep: FlowStep | null;
  setFlowStep: (step: FlowStep | null) => void;
  flightInfoOpen: boolean;
  setFlightInfoOpen: (open: boolean) => void;
}

// PnrView owns the flow (it has the flight/passenger data), but the flow's
// step icons live in SideDrawer — a sibling rendered once in App.tsx, outside
// PnrView's subtree, so it can't read PnrView's local state directly. This
// context is the shared channel between the two, mirroring the TabsProvider
// pattern used for the same kind of cross-component sharing.
const CheckinFlowContext = createContext<CheckinFlowState | null>(null);

export function CheckinFlowProvider({ children }: { children: ReactNode }) {
  const [flowStep, setFlowStep] = useState<FlowStep | null>(null);
  const [flightInfoOpen, setFlightInfoOpen] = useState(false);

  return (
    <CheckinFlowContext.Provider
      value={{
        flowStep,
        setFlowStep: (step) => {
          setFlowStep(step);
          if (step === null) setFlightInfoOpen(false);
        },
        flightInfoOpen,
        setFlightInfoOpen,
      }}
    >
      {children}
    </CheckinFlowContext.Provider>
  );
}

export function useCheckinFlow(): CheckinFlowState {
  const ctx = useContext(CheckinFlowContext);
  if (!ctx) throw new Error("useCheckinFlow must be used within a CheckinFlowProvider");
  return ctx;
}
