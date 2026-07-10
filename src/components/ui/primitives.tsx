import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { OWNERS } from '@/data/constants';
import { initials } from '@/lib/format';
import './ui.css';

/* ---------------- Typing indicator ---------------- */
export function TypingDots({ label }: { label?: string }) {
  return (
    <span className="dh-typing" aria-label="typing">
      {label && <span className="dh-typing-label">{label}</span>}
      <span className="dh-typing-dots"><i /><i /><i /></span>
    </span>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ ownerKey, size = 26, name }: { ownerKey?: string; size?: number; name?: string }) {
  const o = ownerKey ? OWNERS[ownerKey] : undefined;
  const display = name ?? o?.name ?? '?';
  const bg = o?.g ?? 'linear-gradient(135deg,#94a3b8,#64748b)';
  return (
    <span
      className="dh-av"
      title={display}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.42) }}
    >
      {initials(display)}
    </span>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  tone = 'neutral',
  dot,
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'blue' | 'violet';
  dot?: string;
  className?: string;
}) {
  return (
    <span className={`dh-badge t-${tone} ${className}`}>
      {dot && <span className="dh-badge-dot" style={{ background: dot }} />}
      {children}
    </span>
  );
}

/* ---------------- Button ---------------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'ai' | 'subtle' | 'danger';
  size?: 'sm' | 'md';
  iconOnly?: boolean;
}
export function Button({
  variant = 'default',
  size = 'md',
  iconOnly = false,
  className = '',
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      className={`dh-btn v-${variant} s-${size} ${iconOnly ? 'icon-only' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Progress Ring ---------------- */
export function Ring({ value, size = 30, color, label }: { value: number; size?: number; color: string; label?: string }) {
  const stroke = Math.max(2.5, size * 0.11);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="dh-ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .5s var(--ease)' }}
      />
      {label && (
        <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" className="dh-ring-label" fill={color}>
          {label}
        </text>
      )}
    </svg>
  );
}

/* ---------------- Popover ---------------- */
export function Popover({
  trigger,
  children,
  align = 'start',
  width,
  up = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);
  return (
    <div className="dh-pop-wrap" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className={`dh-pop a-${align} ${up ? 'up' : ''}`} style={width ? { width } : undefined} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Tooltip (CSS title fallback used widely; this is for rich) ---------------- */
export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button className={`dh-menu-item ${danger ? 'danger' : ''} ${active ? 'active' : ''}`} onClick={onClick} role="menuitem">
      {icon && <span className="dh-menu-icon">{icon}</span>}
      <span className="dh-menu-label">{children}</span>
    </button>
  );
}
