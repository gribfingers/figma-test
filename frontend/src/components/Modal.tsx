import { ReactNode } from "react";
import { CloseIcon } from "./Icon";

interface Props {
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}

/**
 * Generic modal shell — per Figma "Modal" frame (id 30406:24629): white
 * panel, 4px radius, 1px #dee2e5 border, the same drop-shadow token as the
 * app's dropdown menus. Header (title + circular close button) / Content /
 * Footer (right-aligned actions) are separate sections so specific modals
 * only need to supply what goes in each.
 */
export function Modal({ title, onClose, footer, children, width }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">{title}</div>
          <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon size={12} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
