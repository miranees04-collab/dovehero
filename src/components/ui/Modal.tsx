import { type ReactNode, useEffect } from 'react';
import { Icon } from './Icon';
import './modal.css';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dh-modal-scrim" onMouseDown={onClose}>
      <div
        className="dh-modal"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="dh-modal-head">
            <div className="dh-modal-title">{title}</div>
            <button className="dh-modal-close" onClick={onClose} aria-label="Close">
              <Icon name="x" size={17} />
            </button>
          </div>
        )}
        <div className="dh-modal-body">{children}</div>
        {footer && <div className="dh-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  children,
  width = 440,
  side = 'right',
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  side?: 'right' | 'left';
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dh-drawer-scrim" onMouseDown={onClose}>
      <div
        className={`dh-drawer side-${side} ${className}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
