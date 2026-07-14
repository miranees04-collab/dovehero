import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * A destructive action button that requires a second click to confirm — no browser
 * dialog. `window.confirm` is blocked inside sandboxed artifact iframes, so a
 * native confirm() silently no-ops there; this keeps delete flows working everywhere.
 */
export function ConfirmButton({
  onConfirm,
  className = '',
  children,
  confirmLabel = 'Click to confirm',
  icon = 'trash',
  title,
}: {
  onConfirm: () => void;
  className?: string;
  children: ReactNode;
  confirmLabel?: string;
  icon?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const click = () => {
    if (armed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), 3500);
    }
  };

  return (
    <button
      type="button"
      className={`${className}${armed ? ' armed' : ''}`}
      onClick={click}
      title={title}
      aria-label={armed ? confirmLabel : undefined}
    >
      <Icon name={armed ? 'alert' : icon} size={14} /> {armed ? confirmLabel : children}
    </button>
  );
}
