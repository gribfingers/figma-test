import { RefObject, useLayoutEffect, useState } from "react";

export interface PopoverRect {
  top: number;
  left: number;
  width: number;
}

/**
 * Tracks an anchor element's position so a dropdown can be portaled to
 * document.body and fixed-positioned just below it. Needed because the app
 * has no page-level scrolling — several ancestors (e.g. .flight-card-body,
 * .flight-card-panel) now have overflow:hidden/auto, which would otherwise
 * clip a plain position:absolute popover nested inside them (e.g. a tall
 * calendar) the moment it grows past that ancestor's own bounds.
 */
export function usePopoverPosition(anchorRef: RefObject<HTMLElement | null>, open: boolean): PopoverRect | null {
  const [rect, setRect] = useState<PopoverRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setRect(null);
      return;
    }
    function update() {
      const r = anchorRef.current!.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return rect;
}
