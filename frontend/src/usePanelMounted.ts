import { useEffect, useState } from "react";

// Every slide-out panel's CSS transition (see the .*-panel-overlay.open rules) runs this long.
export const PANEL_TRANSITION_MS = 300;

interface PanelTransition {
  /** Whether the panel should be in the DOM at all. */
  mounted: boolean;
  /**
   * Whether it should be showing its "open" (slid-in) visual state. Kept
   * one tick behind `mounted` on the way in — so the panel first paints
   * off-screen, then gets the .open class on the next frame — otherwise a
   * freshly-mounted element that starts already in its open state has
   * nothing to transition from and just snaps into place with no animation.
   */
  entered: boolean;
}

/**
 * Drives a slide-out panel's mount/unmount around its CSS transition:
 * mounts immediately when `open` goes true (entering one frame later, so
 * the enter transition has a "before" state to animate from), and stays
 * mounted for `duration` ms after `open` goes false so the exit transition
 * can actually play instead of the panel just vanishing.
 */
export function usePanelTransition(open: boolean, duration = PANEL_TRANSITION_MS): PanelTransition {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);

  // Mount right away when opening; on closing, drop .open immediately and
  // unmount duration ms later once the exit transition has had time to play.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(t);
  }, [open, duration]);

  // Runs (and thus paints the closed state) only once the mount above has
  // actually committed — a separate effect so this rAF can't race ahead of
  // it and land in the same frame, which would skip the "before" paint a
  // CSS transition needs to animate from.
  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, mounted]);

  return { mounted, entered };
}

/**
 * Same as usePanelTransition, but for panels whose content is keyed by
 * nullable data (e.g. "which passenger's doc panel is open") — retains the
 * last non-null value so there's still something to render while it slides
 * out, instead of the content vanishing a beat before the panel itself.
 */
export function useRetainedPanelTransition<T>(value: T | null, duration = PANEL_TRANSITION_MS): PanelTransition & { retained: T | null } {
  const { mounted, entered } = usePanelTransition(value !== null, duration);
  const [retained, setRetained] = useState<T | null>(value);
  useEffect(() => {
    if (value !== null) setRetained(value);
  }, [value]);
  return { mounted, entered, retained };
}
