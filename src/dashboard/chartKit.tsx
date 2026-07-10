// ---------------------------------------------------------------------------
// Shared chart primitives used by both the preset widgets and the custom
// report renderer: validated palette, tooltip, legend, stat tile, gauge, delta.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from 'lucide-react';
import { fmtMoney, fmtPct } from './data';

/** Animated count-up from the previous value to the new one (eased, ~480ms). */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return; }
    let start: number | undefined;
    const dur = 480;
    const tick = (t: number) => {
      start ??= t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <>{format(display)}</>;
}

// Categorical slots (validated CVD-safe) as CSS vars — colour follows entity.
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
export const FUNNEL = ['var(--f1)', 'var(--f2)', 'var(--f3)', 'var(--f4)', 'var(--f5)', 'var(--f6)'];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];

export const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 } as const;
export const AXIS_LINE = { stroke: 'var(--axis)' } as const;

export function Empty({ msg = 'No data matches the current filters' }: { msg?: string }) {
  return <div className="cd-empty">{msg}</div>;
}

export function LegendChips({
  items,
}: {
  items: Array<{ label: string; color: string; kind?: 'line' | 'rect' }>;
}) {
  return (
    <div className="cd-legend">
      {items.map((it) => (
        <span className="key" key={it.label}>
          {it.kind === 'line' ? (
            <span className="stroke" style={{ borderTopColor: it.color }} />
          ) : (
            <span className="swatch" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Recharts tooltip: value leads, series name follows, line-keys not boxes. */
export function ChartTip(props: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number; color?: string; stroke?: string; fill?: string }>;
  fmt?: (v: number) => string;
}) {
  const { active, payload, label, fmt = (v: number) => String(v) } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="cd-tip">
      {label !== undefined && <div className="t">{label}</div>}
      {payload.map((p, i) => (
        <div className="row" key={i}>
          <span className="k" style={{ borderTopColor: p.stroke || p.fill || p.color }} />
          <b>{fmt(p.value ?? 0)}</b>
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Delta({
  cur,
  prev,
  hasPrev,
  upIsGood = true,
  suffix = 'vs prev period',
}: {
  cur: number;
  prev: number;
  hasPrev: boolean;
  upIsGood?: boolean;
  suffix?: string;
}) {
  if (!hasPrev || prev === 0) {
    return (
      <span className="cd-delta flat">
        <Minus size={12} /> <span className="vs">{hasPrev ? suffix : 'no prior period'}</span>
      </span>
    );
  }
  const change = (cur - prev) / Math.abs(prev);
  if (!isFinite(change) || Math.abs(change) < 0.001) {
    return (
      <span className="cd-delta flat">
        <Minus size={12} /> 0% <span className="vs">{suffix}</span>
      </span>
    );
  }
  const up = change > 0;
  const good = up === upIsGood;
  return (
    <span className={`cd-delta ${good ? 'up' : 'down'}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(change * 100).toFixed(0)}% <span className="vs">{suffix}</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  small,
  children,
}: {
  label: string;
  value: ReactNode;
  small?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="cd-tile">
      <div className="lbl">{label}</div>
      <div className={`val ${small ? 'sm' : ''}`}>{value}</div>
      {children}
    </div>
  );
}

/** Semicircle gauge with target + optional projected-landing marker. */
export function Gauge({
  value,
  target,
  projected,
  fmt = fmtMoney,
  caption,
  tone,
}: {
  value: number;
  target: number;
  projected: number | null;
  fmt?: (n: number) => string;
  caption: string;
  tone?: 'good' | 'bad';
}) {
  const cx = 110;
  const cy = 104;
  const r = 86;
  const pt = (t: number, rad = r) => {
    const a = Math.PI * (1 - Math.min(1, Math.max(0, t)));
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const;
  };
  const arc = (t0: number, t1: number, rad = r) => {
    const [x0, y0] = pt(t0, rad);
    const [x1, y1] = pt(t1, rad);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 0 1 ${x1} ${y1}`;
  };
  const frac = target > 0 ? Math.min(1, value / target) : 0;
  const projFrac = projected !== null && target > 0 ? Math.min(1, projected / target) : null;
  const onPace = projected !== null && projected >= target;
  const attained = target > 0 ? value / target : 0;
  const fill = tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : 'var(--accent)';
  const [mx0, my0] = projFrac !== null ? pt(projFrac, r - 13) : [0, 0];
  const [mx1, my1] = projFrac !== null ? pt(projFrac, r + 13) : [0, 0];
  return (
    <div className="cd-gauge" style={{ height: '100%', justifyContent: 'center' }}>
      <svg viewBox="0 0 220 118" width="100%" style={{ maxWidth: 250 }} role="img" aria-label={`${fmt(value)} of ${fmt(target)} target`}>
        <path d={arc(0, 1)} fill="none" stroke="var(--track)" strokeWidth={14} strokeLinecap="round" />
        {frac > 0.01 && <path d={arc(0, frac)} fill="none" stroke={fill} strokeWidth={14} strokeLinecap="round" />}
        {projFrac !== null && (
          <line x1={mx0} y1={my0} x2={mx1} y2={my1} stroke={onPace ? 'var(--good)' : 'var(--bad)'} strokeWidth={3} strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 26} textAnchor="middle" fontSize={27} fontWeight={650} fill="var(--ink)">
          {fmt(value)}
        </text>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={12} fill="var(--muted)">
          of {fmt(target)} target
        </text>
      </svg>
      {projected !== null ? (
        <span className={`cd-pill ${onPace ? 'good' : 'bad'}`}>
          {onPace ? <TrendingUp size={13} /> : <ArrowDownRight size={13} />}
          Projected landing {fmt(projected)}
        </span>
      ) : (
        <span className={`cd-pill ${attained >= 0.85 ? 'good' : 'bad'}`}>
          {attained >= 0.85 ? <TrendingUp size={13} /> : <ArrowDownRight size={13} />}
          {fmtPct(attained)} of target attained
        </span>
      )}
      <span className="of" style={{ marginTop: 4 }}>{caption}</span>
    </div>
  );
}
