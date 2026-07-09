/**
 * CRM reporting dashboard prototype (HubSpot-style foundation).
 *
 * Structural primitives:
 *  - a dashboard is a named, editable collection of report tiles on a 12-col grid
 *  - global filters (date range · owner · pipeline) recompute every tile
 *  - a small fixed palette of report types covers all tiles
 *  - three role-based saved dashboards, switchable from the top bar
 *
 * Front-end only: everything derives from one seeded in-memory dataset.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  Contact,
  Download,
  Gauge as GaugeIcon,
  GripVertical,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Mail,
  Minus,
  MoreHorizontal,
  Phone,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Share2,
  Table2,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  REPS,
  STAGES,
  SOURCES,
  PIPELINES,
  SOURCE_CAC,
  RANGE_LABELS,
  TEAM_QUARTER_QUOTA,
  MS_DAY,
  generateData,
  periodBounds,
  sliceDeals,
  kpisFor,
  funnelFor,
  weeklySeries,
  mrrSeries,
  wobble,
  mulberry32,
  fmtMoney,
  fmtMoneyFull,
  fmtPct,
  relTime,
  startOfDay,
  type ActivityEvent,
  type Bounds,
  type Deal,
  type Filters,
  type RangeKey,
  type Rep,
} from './data';
import './dashboard.css';

// ---------------------------------------------------------------------------
// Shared context every widget renders from
// ---------------------------------------------------------------------------

interface Ctx {
  deals: Deal[]; // owner+pipeline slice; date range applied per metric
  activities: ActivityEvent[];
  bounds: Bounds;
  filters: Filters;
  now: number;
  rep: Rep; // focused rep for the individual dashboard
  jit: number; // per-tile jitter counter ("refresh" wobble)
  seed: number;
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function Delta({
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

function Tile({
  label,
  value,
  small,
  children,
}: {
  label: string;
  value: string;
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

function LegendChips({
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
function ChartTip(props: {
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

function Empty({ msg = 'No data matches the current filters' }: { msg?: string }) {
  return <div className="cd-empty">{msg}</div>;
}

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 } as const;
const AXIS_LINE = { stroke: 'var(--axis)' } as const;

/** Semicircle gauge with target + projected-landing marker. */
function Gauge({
  value,
  target,
  projected,
  fmt = fmtMoney,
  caption,
}: {
  value: number;
  target: number;
  projected: number | null;
  fmt?: (n: number) => string;
  caption: string;
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
    // Max sweep is 180°, so the large-arc flag is always 0.
    return `M ${x0} ${y0} A ${rad} ${rad} 0 0 1 ${x1} ${y1}`;
  };
  const frac = target > 0 ? Math.min(1, value / target) : 0;
  const projFrac = projected !== null && target > 0 ? Math.min(1, projected / target) : null;
  const onPace = projected !== null && projected >= target;
  const attained = target > 0 ? value / target : 0;
  const [mx0, my0] = projFrac !== null ? pt(projFrac, r - 13) : [0, 0];
  const [mx1, my1] = projFrac !== null ? pt(projFrac, r + 13) : [0, 0];
  return (
    <div className="cd-gauge" style={{ height: '100%', justifyContent: 'center' }}>
      <svg viewBox="0 0 220 118" width="100%" style={{ maxWidth: 250 }} role="img" aria-label={`${fmt(value)} of ${fmt(target)} target`}>
        <path d={arc(0, 1)} fill="none" stroke="var(--track)" strokeWidth={14} strokeLinecap="round" />
        {frac > 0.01 && (
          <path d={arc(0, frac)} fill="none" stroke="var(--accent)" strokeWidth={14} strokeLinecap="round" />
        )}
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
          {fmtPct(attained)} of quota attained
        </span>
      )}
      <span className="of" style={{ marginTop: 4 }}>{caption}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets — Sales Pipeline
// ---------------------------------------------------------------------------

function SalesKpis({ ctx }: { ctx: Ctx }) {
  const { deals, bounds, jit } = ctx;
  const cur = kpisFor(deals, bounds.start, bounds.end);
  const prev = kpisFor(deals, bounds.prevStart, bounds.prevEnd);
  const rev = wobble(cur.revenue, 'rev', jit);
  const winRate = cur.winRate;
  return (
    <div className="cd-kpi-row">
      <Tile label="Closed-won revenue" value={fmtMoney(rev)}>
        <Delta cur={cur.revenue} prev={prev.revenue} hasPrev={bounds.hasPrev} />
      </Tile>
      <Tile label="Deals created" value={String(cur.created)}>
        <Delta cur={cur.created} prev={prev.created} hasPrev={bounds.hasPrev} />
      </Tile>
      <Tile label="Deals won" value={String(cur.won)}>
        <Delta cur={cur.won} prev={prev.won} hasPrev={bounds.hasPrev} />
      </Tile>
      <Tile label="Win rate" value={winRate === null ? '—' : fmtPct(winRate)}>
        {winRate !== null && (
          <span className={`cd-pill ${winRate < 0.2 ? 'bad' : 'good'}`}>
            {winRate < 0.2 ? 'At risk · below 20%' : 'On track'}
          </span>
        )}
      </Tile>
      <Tile label="Avg deal size" value={cur.avgDeal === null ? '—' : fmtMoney(wobble(cur.avgDeal, 'ads', jit))}>
        <Delta cur={cur.avgDeal ?? 0} prev={prev.avgDeal ?? 0} hasPrev={bounds.hasPrev && prev.avgDeal !== null} />
      </Tile>
      <Tile label="Avg time to close" value={cur.avgCycleDays === null ? '—' : `${Math.round(cur.avgCycleDays)}d`}>
        <Delta
          cur={cur.avgCycleDays ?? 0}
          prev={prev.avgCycleDays ?? 0}
          hasPrev={bounds.hasPrev && prev.avgCycleDays !== null}
          upIsGood={false}
        />
      </Tile>
    </div>
  );
}

/** Quota prorated to the filtered period + owner slice. */
function quotaForPeriod(ctx: Ctx): number {
  const { filters, bounds } = ctx;
  const base = filters.owner === 'all' ? TEAM_QUARTER_QUOTA : REPS.find((r) => r.id === filters.owner)?.quota ?? 0;
  return (base / 91) * Math.min(bounds.days, 366);
}

function RevenueGauge({ ctx }: { ctx: Ctx }) {
  const { deals, bounds, jit } = ctx;
  const cur = kpisFor(deals, bounds.start, bounds.end);
  const value = wobble(cur.revenue, 'gauge', jit);
  const target = quotaForPeriod(ctx);
  // Projected landing only makes sense for a period with a fixed endpoint
  // (quarter/year to date); rolling windows show quota attainment instead.
  const calendarRange = ctx.filters.range === 'qtd' || ctx.filters.range === 'ytd';
  const fullPeriodDays = ctx.filters.range === 'qtd' ? 91 : 365;
  const elapsed = Math.max(0.08, bounds.days / fullPeriodDays);
  const projected = calendarRange ? Math.round(value / elapsed) : null;
  if (deals.length === 0) return <Empty />;
  return (
    <Gauge
      value={value}
      target={Math.round(calendarRange ? (target / bounds.days) * fullPeriodDays : target)}
      projected={projected}
      caption={`Closed-won vs quota, ${RANGE_LABELS[ctx.filters.range].toLowerCase()}`}
    />
  );
}

const FUNNEL_COLORS = ['var(--f1)', 'var(--f2)', 'var(--f3)', 'var(--f4)', 'var(--f5)', 'var(--f6)'];

function DealFunnel({ ctx }: { ctx: Ctx }) {
  const counts = funnelFor(ctx.deals, ctx.bounds.start, ctx.bounds.end);
  const max = counts[0];
  if (!max) return <Empty msg="No deals created in this period" />;
  return (
    <div className="cd-funnel">
      {STAGES.map((stage, i) => {
        const conv = i > 0 && counts[i - 1] > 0 ? counts[i] / counts[i - 1] : null;
        return (
          <div key={stage}>
            {i > 0 && (
              <div className="cd-funnel-conv">
                <span title={`${STAGES[i - 1]} → ${stage} conversion`}>
                  ↓ {conv === null ? '—' : fmtPct(conv)}
                </span>
              </div>
            )}
            <div className="cd-funnel-row" title={`${stage}: ${counts[i]} deals reached this stage`}>
              <span className="cd-funnel-stage">{stage}</span>
              <span className="cd-funnel-barwrap">
                <span
                  className="cd-funnel-bar"
                  style={{ width: `${Math.max(4, (counts[i] / max) * 100)}%`, background: FUNNEL_COLORS[i] }}
                />
              </span>
              <span className="cd-funnel-count">{counts[i]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageValue({ ctx }: { ctx: Ctx }) {
  const { deals, jit } = ctx;
  const data = STAGES.slice(0, 5).map((stage, i) => ({
    stage,
    value: Math.round(
      wobble(
        deals.filter((d) => d.status === 'open' && d.stage === i).reduce((s, d) => s + d.amount, 0),
        `sv${i}`,
        jit,
      ),
    ),
  }));
  if (data.every((d) => d.value === 0)) return <Empty msg="No open deals in this slice" />;
  return (
    <ResponsiveContainer width="100%" height={218}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 54, top: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmtMoney(v)} />
        <YAxis type="category" dataKey="stage" width={82} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={fmtMoneyFull} />} />
        <Bar dataKey="value" name="Open pipeline" fill="var(--s1)" maxBarSize={18} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="value" position="right" formatter={(v) => fmtMoney(Number(v))} style={{ fill: 'var(--ink-2)', fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CreatedVsClosed({ ctx }: { ctx: Ctx }) {
  const pts = weeklySeries(ctx.deals, ctx.bounds.start, ctx.bounds.end);
  if (!pts.some((p) => p.created || p.closedWon)) return <Empty />;
  return (
    <div>
      <LegendChips
        items={[
          { label: 'Deals created', color: 'var(--s1)', kind: 'line' },
          { label: 'Deals won', color: 'var(--s2)', kind: 'line' },
        ]}
      />
      <ResponsiveContainer width="100%" height={212}>
        <AreaChart data={pts} margin={{ left: -22, right: 10, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={22} />
          <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ stroke: 'var(--axis)' }} content={<ChartTip />} />
          <Area type="monotone" dataKey="created" name="Deals created" stroke="var(--s1)" strokeWidth={2} fill="var(--s1)" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
          <Area type="monotone" dataKey="closedWon" name="Deals won" stroke="var(--s2)" strokeWidth={2} fill="var(--s2)" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const SOURCE_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

function SourceDonut({ ctx }: { ctx: Ctx }) {
  const { deals, bounds } = ctx;
  const inRange = deals.filter((d) => d.createdAt >= bounds.start && d.createdAt < bounds.end);
  const data = SOURCES.map((s) => ({ name: s, value: inRange.filter((d) => d.source === s).length }));
  const total = inRange.length;
  if (!total) return <Empty msg="No deals created in this period" />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 158, height: 158, flex: 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76} paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={SOURCE_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip fmt={(v) => `${v} deals`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 23, fontWeight: 650, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>deals</div>
          </div>
        </div>
      </div>
      <table className="cd-table" style={{ flex: 1, minWidth: 150 }}>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.name}>
              <td style={{ padding: '5px 6px' }}>
                <span className="cd-legend" style={{ padding: 0 }}>
                  <span className="key">
                    <span className="swatch" style={{ background: SOURCE_COLORS[i] }} />
                    {d.name}
                  </span>
                </span>
              </td>
              <td className="num" style={{ padding: '5px 6px', fontWeight: 600 }}>{d.value}</td>
              <td className="num" style={{ padding: '5px 6px', color: 'var(--muted)' }}>{fmtPct(d.value / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Leaderboard({ ctx }: { ctx: Ctx }) {
  const { deals, bounds, jit } = ctx;
  const rows = REPS.map((rep) => {
    const mine = deals.filter((d) => d.owner === rep.id);
    const closed = mine.filter((d) => d.closedAt !== null && d.closedAt >= bounds.start && d.closedAt < bounds.end);
    const won = closed.filter((d) => d.status === 'won');
    return {
      rep,
      won: won.length,
      value: Math.round(wobble(won.reduce((s, d) => s + d.amount, 0), `lb${rep.id}`, jit)),
      winRate: closed.length ? won.length / closed.length : null,
    };
  })
    .filter((r) => ctx.filters.owner === 'all' || r.rep.id === ctx.filters.owner)
    .sort((a, b) => b.value - a.value);
  if (!rows.some((r) => r.won)) return <Empty msg="No closed-won deals in this period" />;
  return (
    <div className="cd-tablewrap">
      <table className="cd-table">
        <thead>
          <tr>
            <th>Rep</th>
            <th className="num">Deals won</th>
            <th className="num">Closed-won value</th>
            <th className="num">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.rep.id} className={i === 0 ? 'top' : ''}>
              <td>
                <span className="cd-repcell">
                  <span className="cd-avatar">{r.rep.initials}</span>
                  {r.rep.name}
                  {i === 0 && <Trophy size={14} style={{ marginLeft: 7, color: 'var(--s3)' }} />}
                </span>
              </td>
              <td className="num">{r.won}</td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtMoneyFull(r.value)}</td>
              <td className="num">
                {r.winRate === null ? (
                  '—'
                ) : (
                  <span className={`cd-pill ${r.winRate < 0.2 ? 'bad' : 'good'}`}>{fmtPct(r.winRate)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FEED_ICONS: Record<string, ReactNode> = {
  call: <Phone size={13} />,
  email: <Mail size={13} />,
  meeting: <CalendarDays size={13} />,
  lead: <UserPlus size={13} />,
};

function ActivityFeed({ ctx }: { ctx: Ctx }) {
  const { deals, activities, filters, now } = ctx;
  const repName = (id: string) => REPS.find((r) => r.id === id)?.name.split(' ')[0] ?? id;
  type Item = { at: number; icon: ReactNode; deal?: boolean; main: ReactNode; meta: string };
  const dealItems: Item[] = deals
    .filter((d) => now - d.createdAt < 10 * MS_DAY)
    .map((d) => ({
      at: d.createdAt,
      deal: true,
      icon: <Briefcase size={13} />,
      main: (
        <>
          <b>{d.contact}</b> · {d.company} — {fmtMoney(d.amount)}
          <span className="cd-stagechip">{STAGES[d.stage]}</span>
        </>
      ),
      meta: `New deal · ${repName(d.owner)} · ${d.source}`,
    }));
  const actItems: Item[] = activities
    .filter((a) => filters.owner === 'all' || a.rep === filters.owner)
    .slice(0, 30)
    .map((a) => ({
      at: a.at,
      icon: FEED_ICONS[a.type],
      main: (
        <>
          {a.type === 'call' && <>Call with <b>{a.person}</b></>}
          {a.type === 'email' && <>Email to <b>{a.person}</b></>}
          {a.type === 'meeting' && <>Meeting booked with <b>{a.person}</b></>}
          {a.type === 'lead' && <><b>{a.person}</b> became a lead</>}
        </>
      ),
      meta: `${a.company} · ${repName(a.rep)}`,
    }));
  const items = [...dealItems, ...actItems].sort((a, b) => b.at - a.at).slice(0, 16);
  if (!items.length) return <Empty />;
  return (
    <div className="cd-feed">
      {items.map((it, i) => (
        <div className="cd-feed-item" key={i}>
          <span className={`cd-feed-ic ${it.deal ? 'deal' : ''}`}>{it.icon}</span>
          <span className="cd-feed-main">
            {it.main}
            <div className="cd-feed-meta">{it.meta}</div>
          </span>
          <span className="cd-feed-time">{relTime(it.at, now)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets — Executive Overview
// ---------------------------------------------------------------------------

function CoverageRatio({ ctx }: { ctx: Ctx }) {
  const { deals, filters, now, jit } = ctx;
  const q = periodBounds('qtd', now);
  const quota = filters.owner === 'all' ? TEAM_QUARTER_QUOTA : REPS.find((r) => r.id === filters.owner)?.quota ?? 0;
  const wonQtd = kpisFor(deals, q.start, q.end).revenue;
  const open = wobble(deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.amount, 0), 'cov', jit);
  const remaining = Math.max(0, quota - wonQtd);
  if (remaining === 0) {
    return (
      <div className="cd-gauge">
        <div className="big" style={{ fontSize: 34 }}>Quota met</div>
        <span className="cd-pill good">This quarter's quota is fully closed</span>
      </div>
    );
  }
  const cov = open / remaining;
  const healthy = cov >= 3;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 40, fontWeight: 650, lineHeight: 1.05, letterSpacing: '-0.01em' }}>
          {cov.toFixed(1)}×
        </div>
        <span className={`cd-pill ${healthy ? 'good' : 'bad'}`} style={{ marginTop: 6 }}>
          {healthy ? <Check size={13} /> : <X size={13} />}
          {healthy ? 'Healthy — ≥ 3× coverage' : 'At risk — below 3× coverage'}
        </span>
      </div>
      <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--wash)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, (cov / 4) * 100)}%`,
            height: '100%',
            borderRadius: 5,
            background: healthy ? 'var(--good)' : 'var(--bad)',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
        Open pipeline <b>{fmtMoney(open)}</b> ÷ remaining quarter quota <b>{fmtMoney(remaining)}</b>
      </div>
    </div>
  );
}

function MrrGrowth({ ctx }: { ctx: Ctx }) {
  const pts = mrrSeries(ctx.deals, ctx.now, ctx.seed).map((p) => ({
    ...p,
    mrr: Math.round(wobble(p.mrr, `mrr${p.label}`, ctx.jit)),
  }));
  const last = pts[pts.length - 1];
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, padding: '0 2px 6px', fontSize: 12.5, color: 'var(--ink-2)' }}>
        <span>MRR <b style={{ fontSize: 15 }}>{fmtMoney(last.mrr)}</b></span>
        <span>ARR <b style={{ fontSize: 15 }}>{fmtMoney(last.arr)}</b></span>
      </div>
      <ResponsiveContainer width="100%" height={196}>
        <AreaChart data={pts} margin={{ left: -14, right: 12, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmtMoney(v)} width={58} />
          <Tooltip cursor={{ stroke: 'var(--axis)' }} content={<ChartTip fmt={fmtMoneyFull} />} />
          <Area type="monotone" dataKey="mrr" name="MRR" stroke="var(--s1)" strokeWidth={2} fill="var(--s1)" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function LtvCac({ ctx }: { ctx: Ctx }) {
  const { deals, bounds, jit } = ctx;
  const data = SOURCES.map((s) => {
    const won = deals.filter((d) => d.source === s && d.status === 'won' && d.closedAt !== null && d.closedAt >= bounds.start && d.closedAt < bounds.end);
    const avg = won.length ? won.reduce((x, d) => x + d.amount, 0) / won.length : 0;
    const ltv = wobble(avg * 2.6, `ltv${s}`, jit);
    return { name: s, ratio: avg ? Math.round((ltv / SOURCE_CAC[s]) * 10) / 10 : 0 };
  }).filter((d) => d.ratio > 0);
  if (!data.length) return <Empty msg="No closed-won deals in this period" />;
  return (
    <div>
      <LegendChips
        items={[
          { label: '≥ 3× (efficient)', color: 'var(--good)' },
          { label: '< 3× (at risk)', color: 'var(--bad)' },
        ]}
      />
      <ResponsiveContainer width="100%" height={196}>
        <BarChart data={data} margin={{ left: -24, right: 8, top: 14, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={(v) => `${v}× LTV:CAC`} />} />
          <ReferenceLine y={3} stroke="var(--axis)" strokeDasharray="4 3" />
          <Bar dataKey="ratio" name="LTV:CAC" maxBarSize={24} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.ratio >= 3 ? 'var(--good)' : 'var(--bad)'} />
            ))}
            <LabelList dataKey="ratio" position="top" formatter={(v) => `${String(v)}×`} style={{ fill: 'var(--ink-2)', fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RetentionKpis({ ctx }: { ctx: Ctx }) {
  const rnd = mulberry32(ctx.seed + ctx.jit * 31 + 7);
  const grr = 0.885 + rnd() * 0.045;
  const nrr = 1.04 + rnd() * 0.08;
  const churn = 0.011 + rnd() * 0.009;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Tile label="Gross revenue retention" value={fmtPct(grr, 1)} small>
        <span className={`cd-pill ${grr >= 0.88 ? 'good' : 'bad'}`}>{grr >= 0.88 ? 'Healthy' : 'At risk'}</span>
      </Tile>
      <Tile label="Net revenue retention" value={fmtPct(nrr, 1)} small>
        <span className={`cd-pill ${nrr >= 1 ? 'good' : 'bad'}`}>{nrr >= 1 ? 'Expanding' : 'Contracting'}</span>
      </Tile>
      <Tile label="Monthly logo churn" value={fmtPct(churn, 1)} small>
        <span className={`cd-pill ${churn <= 0.02 ? 'good' : 'bad'}`}>{churn <= 0.02 ? 'On track' : 'At risk'}</span>
      </Tile>
    </div>
  );
}

function CustMovement({ ctx }: { ctx: Ctx }) {
  const pts = mrrSeries(ctx.deals, ctx.now, ctx.seed);
  return (
    <div>
      <LegendChips
        items={[
          { label: 'New customers', color: 'var(--s1)' },
          { label: 'Churned customers', color: 'var(--s6)' },
        ]}
      />
      <ResponsiveContainer width="100%" height={186}>
        <BarChart data={pts} margin={{ left: -26, right: 8, top: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={(v) => `${v} customers`} />} />
          <Bar dataKey="newCustomers" name="New" fill="var(--s1)" maxBarSize={14} radius={[4, 4, 0, 0]} />
          <Bar dataKey="churned" name="Churned" fill="var(--s6)" maxBarSize={14} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets — Sales Rep (individual)
// ---------------------------------------------------------------------------

function RepQuota({ ctx }: { ctx: Ctx }) {
  const { rep, now, jit } = ctx;
  // Trailing quarter so the gauge is meaningful even days into a new quarter.
  const mine = ctx.deals.filter((d) => d.owner === rep.id);
  const won = wobble(kpisFor(mine, now - 91 * MS_DAY, now).revenue, 'rq', jit);
  return (
    <Gauge
      value={Math.round(won)}
      target={rep.quota}
      projected={null}
      caption={`${rep.name} · closed-won last 91 days vs quarterly quota`}
    />
  );
}

function TodayStats({ ctx }: { ctx: Ctx }) {
  const { activities, rep, now } = ctx;
  const day0 = startOfDay(now);
  const today = activities.filter((a) => a.rep === rep.id && a.at >= day0);
  const yest = activities.filter((a) => a.rep === rep.id && a.at >= day0 - MS_DAY && a.at < day0);
  const count = (list: ActivityEvent[], t: string) => list.filter((a) => a.type === t).length;
  const types: Array<[string, string]> = [
    ['call', 'Calls made'],
    ['email', 'Emails sent'],
    ['meeting', 'Meetings booked'],
  ];
  return (
    <div className="cd-kpi-row">
      {types.map(([t, label]) => (
        <Tile key={t} label={label} value={String(count(today, t))}>
          <Delta cur={count(today, t)} prev={count(yest, t)} hasPrev suffix="vs yesterday" />
        </Tile>
      ))}
      <Tile label="Tasks total today" value={String(today.length)}>
        <span className={`cd-pill ${today.length >= 8 ? 'good' : 'bad'}`}>
          {today.length >= 8 ? 'Daily goal met' : `${8 - today.length} to daily goal`}
        </span>
      </Tile>
    </div>
  );
}

function MyOpenDeals({ ctx }: { ctx: Ctx }) {
  const { rep, now } = ctx;
  const open = ctx.deals
    .filter((d) => d.owner === rep.id && d.status === 'open')
    .sort((a, b) => b.amount - a.amount);
  if (!open.length) return <Empty msg={`No open deals for ${rep.name}`} />;
  const shown = open.slice(0, 8);
  return (
    <div className="cd-tablewrap">
      <table className="cd-table">
        <thead>
          <tr>
            <th>Deal</th>
            <th>Stage</th>
            <th className="num">Amount</th>
            <th className="num">Days in stage</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((d) => {
            const days = Math.floor((now - d.stageEnteredAt) / MS_DAY);
            const stuck = days > 21;
            return (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.company}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d.contact} · {d.source}</div>
                </td>
                <td><span className="cd-stagechip" style={{ marginLeft: 0 }}>{STAGES[d.stage]}</span></td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtMoneyFull(d.amount)}</td>
                <td className="num">
                  <span className={`cd-pill ${stuck ? 'bad' : 'good'}`}>{days}d{stuck ? ' · stuck' : ''}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open.length > shown.length && (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 10px 0' }}>
          + {open.length - shown.length} more open deals
        </div>
      )}
    </div>
  );
}

function MyActivity({ ctx }: { ctx: Ctx }) {
  const { activities, rep, now } = ctx;
  const days: Array<{ label: string; tasks: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d0 = startOfDay(now - i * MS_DAY);
    days.push({
      label: new Date(d0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tasks: activities.filter((a) => a.rep === rep.id && a.at >= d0 && a.at < d0 + MS_DAY).length,
    });
  }
  return (
    <div>
      <LegendChips
        items={[
          { label: 'Goal met (≥ 8 tasks)', color: 'var(--good)' },
          { label: 'Below goal', color: 'var(--s1)' },
        ]}
      />
      <ResponsiveContainer width="100%" height={196}>
        <BarChart data={days} margin={{ left: -28, right: 8, top: 12, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={1} />
          <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={(v) => `${v} tasks`} />} />
          <ReferenceLine y={8} stroke="var(--axis)" strokeDasharray="4 3" />
          <Bar dataKey="tasks" name="Tasks" maxBarSize={16} radius={[4, 4, 0, 0]}>
            {days.map((d, i) => (
              <Cell key={i} fill={d.tasks >= 8 ? 'var(--good)' : 'var(--s1)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RepVsTeam({ ctx }: { ctx: Ctx }) {
  const { deals, rep, bounds } = ctx;
  const mine = kpisFor(deals.filter((d) => d.owner === rep.id), bounds.start, bounds.end);
  const team = kpisFor(deals, bounds.start, bounds.end);
  const metrics = [
    {
      label: 'Win rate',
      me: mine.winRate,
      avg: team.winRate,
      fmt: (v: number) => fmtPct(v),
      max: Math.max(mine.winRate ?? 0, team.winRate ?? 0, 0.01),
    },
    {
      label: 'Avg deal size',
      me: mine.avgDeal,
      avg: team.avgDeal,
      fmt: fmtMoney,
      max: Math.max(mine.avgDeal ?? 0, team.avgDeal ?? 0, 1),
    },
  ];
  return (
    <div className="cd-duel">
      {metrics.map((m) => (
        <div className="cd-duel-metric" key={m.label}>
          <div className="m-lbl">{m.label}</div>
          {[
            { who: 'Me', v: m.me, color: 'var(--accent)' },
            { who: 'Team', v: m.avg, color: 'var(--axis)' },
          ].map((row) => (
            <div className="cd-duel-bar" key={row.who}>
              <span className="who">{row.who}</span>
              <span className="trk">
                <span
                  className="fill"
                  style={{ width: `${((row.v ?? 0) / m.max) * 100}%`, background: row.color, display: 'block' }}
                />
              </span>
              <span className="v">{row.v === null ? '—' : m.fmt(row.v)}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        {rep.name} vs team average, {RANGE_LABELS[ctx.filters.range].toLowerCase()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget registry + saved dashboards
// ---------------------------------------------------------------------------

interface WidgetDef {
  title: string;
  desc: string;
  span: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  icon: ReactNode;
  sub?: (ctx: Ctx) => string | null;
  render: (ctx: Ctx) => ReactNode;
}

const WIDGETS: Record<string, WidgetDef> = {
  kpis: {
    title: 'Sales KPIs',
    desc: 'Revenue, deals, win rate, deal size & cycle time with period deltas',
    span: 12,
    icon: <GaugeIcon size={15} />,
    render: (ctx) => <SalesKpis ctx={ctx} />,
  },
  revenueGauge: {
    title: 'Revenue vs goal',
    desc: 'Closed-won against quota with projected landing',
    span: 4,
    icon: <Target size={15} />,
    render: (ctx) => <RevenueGauge ctx={ctx} />,
  },
  funnel: {
    title: 'Deal funnel',
    desc: 'Stage-to-stage counts and conversion for deals created in period',
    span: 4,
    icon: <BarChart3 size={15} />,
    render: (ctx) => <DealFunnel ctx={ctx} />,
  },
  stageValue: {
    title: 'Pipeline value by stage',
    desc: 'Open deal value sitting in each stage',
    span: 4,
    icon: <BarChart3 size={15} />,
    render: (ctx) => <StageValue ctx={ctx} />,
  },
  createdClosed: {
    title: 'Deals created vs won',
    desc: 'Weekly created and closed-won deal counts',
    span: 8,
    icon: <LineChartIcon size={15} />,
    render: (ctx) => <CreatedVsClosed ctx={ctx} />,
  },
  sourceDonut: {
    title: 'Deal source breakdown',
    desc: 'Where deals created this period came from',
    span: 4,
    icon: <PieChartIcon size={15} />,
    render: (ctx) => <SourceDonut ctx={ctx} />,
  },
  leaderboard: {
    title: 'Rep leaderboard',
    desc: 'Reps ranked by closed-won value',
    span: 7,
    icon: <Trophy size={15} />,
    render: (ctx) => <Leaderboard ctx={ctx} />,
  },
  activityFeed: {
    title: 'Live activity',
    desc: 'Recent deals and touchpoints entering the pipeline',
    span: 5,
    icon: <Activity size={15} />,
    render: (ctx) => <ActivityFeed ctx={ctx} />,
  },
  coverage: {
    title: 'Pipeline coverage',
    desc: 'Open pipeline ÷ remaining quota — red below 3×',
    span: 4,
    icon: <Target size={15} />,
    render: (ctx) => <CoverageRatio ctx={ctx} />,
  },
  retention: {
    title: 'Retention & churn',
    desc: 'GRR, NRR and monthly logo churn',
    span: 4,
    icon: <Users size={15} />,
    render: (ctx) => <RetentionKpis ctx={ctx} />,
  },
  mrr: {
    title: 'MRR / ARR growth',
    desc: 'Monthly recurring revenue over the last 12 months',
    span: 6,
    icon: <TrendingUp size={15} />,
    render: (ctx) => <MrrGrowth ctx={ctx} />,
  },
  ltvCac: {
    title: 'LTV : CAC by source',
    desc: 'Payback efficiency per acquisition channel',
    span: 6,
    icon: <BarChart3 size={15} />,
    render: (ctx) => <LtvCac ctx={ctx} />,
  },
  custMove: {
    title: 'New vs churned customers',
    desc: 'Monthly customer adds against churn',
    span: 12,
    icon: <Users size={15} />,
    render: (ctx) => <CustMovement ctx={ctx} />,
  },
  repQuota: {
    title: 'My quota progress',
    desc: 'Personal quota gauge, quarter to date',
    span: 4,
    icon: <Target size={15} />,
    sub: (ctx) => ctx.rep.name,
    render: (ctx) => <RepQuota ctx={ctx} />,
  },
  todayStats: {
    title: "Today's activity",
    desc: 'Calls, emails and meetings logged today',
    span: 8,
    icon: <Zap size={15} />,
    sub: (ctx) => ctx.rep.name,
    render: (ctx) => <TodayStats ctx={ctx} />,
  },
  myActivity: {
    title: 'My activity — last 14 days',
    desc: 'Daily tasks with the 8-per-day goal line',
    span: 7,
    icon: <Activity size={15} />,
    sub: (ctx) => ctx.rep.name,
    render: (ctx) => <MyActivity ctx={ctx} />,
  },
  repVsTeam: {
    title: 'Me vs team',
    desc: 'Win rate and average deal size against team average',
    span: 5,
    icon: <Users size={15} />,
    sub: (ctx) => ctx.rep.name,
    render: (ctx) => <RepVsTeam ctx={ctx} />,
  },
  myDeals: {
    title: 'My open deals',
    desc: 'Open pipeline with days-in-stage stuck flags',
    span: 12,
    icon: <Table2 size={15} />,
    sub: (ctx) => ctx.rep.name,
    render: (ctx) => <MyOpenDeals ctx={ctx} />,
  },
};

interface DashboardConfig {
  id: string;
  name: string;
  role: string;
  widgets: string[];
}

const INITIAL_DASHBOARDS: DashboardConfig[] = [
  {
    id: 'pipeline',
    name: 'Sales Pipeline',
    role: 'Team view',
    widgets: ['kpis', 'revenueGauge', 'funnel', 'stageValue', 'createdClosed', 'sourceDonut', 'leaderboard', 'activityFeed'],
  },
  {
    id: 'exec',
    name: 'Executive Overview',
    role: 'Leadership view',
    widgets: ['revenueGauge', 'coverage', 'retention', 'mrr', 'ltvCac', 'custMove'],
  },
  {
    id: 'rep',
    name: 'My Sales Desk',
    role: 'Individual rep view',
    widgets: ['repQuota', 'todayStats', 'myActivity', 'repVsTeam', 'myDeals'],
  },
];

// ---------------------------------------------------------------------------
// Chrome: popovers, card, modal
// ---------------------------------------------------------------------------

function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return { open, setOpen, ref };
}

function SelectPop({
  label,
  value,
  options,
  onChange,
  title,
}: {
  label: ReactNode;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (key: string) => void;
  title?: string;
}) {
  const { open, setOpen, ref } = usePop();
  return (
    <div className="cd-popwrap" ref={ref}>
      <button className="cd-btn" onClick={() => setOpen(!open)}>
        {label}
        <ChevronDown size={14} className="chev" />
      </button>
      {open && (
        <div className="cd-pop">
          {title && <div className="cd-pop-title">{title}</div>}
          {options.map((o) => (
            <button
              key={o.key}
              className="cd-pop-row"
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
            >
              <span className="check">{o.key === value && <Check size={16} strokeWidth={3} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  widgetKey,
  def,
  ctx,
  onRemove,
  onRefresh,
  onExport,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  widgetKey: string;
  def: WidgetDef;
  ctx: Ctx;
  onRemove: () => void;
  onRefresh: () => void;
  onExport: () => void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const { open, setOpen, ref } = usePop();
  const [flash, setFlash] = useState(0);
  const sub = def.sub?.(ctx);
  return (
    <section
      className={`cd-card w-${def.span} ${dragging ? 'dragging' : ''} ${dropTarget ? 'dropTarget' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
    >
      <div className="cd-card-head">
        <span
          className="cd-drag"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </span>
        <span className="cd-card-title">{def.title}</span>
        <div className="cd-popwrap" ref={ref}>
          <button className="cd-iconbtn" onClick={() => setOpen(!open)} aria-label={`${def.title} menu`}>
            <MoreHorizontal size={16} />
          </button>
          {open && (
            <div className="cd-pop right">
              <button
                className="cd-pop-row"
                onClick={() => {
                  setOpen(false);
                  setFlash((f) => f + 1);
                  onRefresh();
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                className="cd-pop-row"
                onClick={() => {
                  setOpen(false);
                  onExport();
                }}
              >
                <Download size={14} /> Export CSV
              </button>
              <div className="cd-pop-sep" />
              <button
                className="cd-pop-row danger"
                onClick={() => {
                  setOpen(false);
                  onRemove();
                }}
              >
                <X size={14} /> Remove from dashboard
              </button>
            </div>
          )}
        </div>
      </div>
      {sub && <div className="cd-card-sub">{sub}</div>}
      <div className="cd-card-body cd-refreshing" key={`${widgetKey}-${flash}-${ctx.jit}`}>
        {def.render(ctx)}
      </div>
    </section>
  );
}

function AddWidgetModal({
  current,
  onAdd,
  onClose,
}: {
  current: string[];
  onAdd: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal" role="dialog" aria-label="Add widget">
        <div className="cd-modal-head">
          <h2>Add a report to this dashboard</h2>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="cd-modal-body">
          <div className="cd-widget-lib">
            {Object.entries(WIDGETS).map(([key, def]) => {
              const added = current.includes(key);
              return (
                <button key={key} className="cd-lib-item" disabled={added} onClick={() => onAdd(key)}>
                  <span className="nm">
                    {def.icon}
                    {def.title}
                  </span>
                  <span className="ds">{added ? 'Already on this dashboard' : def.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { key: 'dashboards', label: 'Dashboards', icon: <LayoutDashboard size={17} /> },
  { key: 'reports', label: 'Reports', icon: <BarChart3 size={17} /> },
  { key: 'contacts', label: 'Contacts', icon: <Contact size={17} /> },
  { key: 'deals', label: 'Deals', icon: <Briefcase size={17} /> },
];

export default function CrmDashboard() {
  const now = useMemo(() => Date.now(), []);
  const [seed] = useState(1_337_042);
  const data = useMemo(() => generateData(seed, now), [seed, now]);

  const [dashboards, setDashboards] = useState(INITIAL_DASHBOARDS);
  const [activeId, setActiveId] = useState('pipeline');
  const [nav, setNav] = useState('dashboards');
  const [filters, setFiltersRaw] = useState<Filters>({ range: '90d', owner: 'all', pipeline: 'all' });
  const [jitters, setJitters] = useState<Record<string, number>>({});
  const [globalJit, setGlobalJit] = useState(0);
  const [pending, setPending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const toastId = useRef(0);

  const dash = dashboards.find((d) => d.id === activeId) ?? dashboards[0];
  const bounds = useMemo(() => periodBounds(filters.range, now), [filters.range, now]);
  const deals = useMemo(() => sliceDeals(data.deals, filters), [data, filters]);
  const rep = REPS.find((r) => r.id === filters.owner) ?? REPS[0];

  // Refetch keeps the frame: dim the previous render briefly, no skeleton.
  const holdFrame = () => {
    setPending(true);
    window.setTimeout(() => setPending(false), 260);
  };

  const setFilters = (patch: Partial<Filters>) => {
    holdFrame();
    setFiltersRaw((f) => ({ ...f, ...patch }));
  };

  const toast = (msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  const refreshAll = () => {
    holdFrame();
    setGlobalJit((g) => g + 1);
  };

  const mutateDash = (fn: (widgets: string[]) => string[]) => {
    setDashboards((ds) => ds.map((d) => (d.id === dash.id ? { ...d, widgets: fn(d.widgets) } : d)));
  };

  const reorder = (from: string, to: string) => {
    mutateDash((w) => {
      const a = w.indexOf(from);
      const b = w.indexOf(to);
      if (a < 0 || b < 0 || a === b) return w;
      const next = [...w];
      next.splice(a, 1);
      next.splice(b, 0, from);
      return next;
    });
  };

  const ownerOptions = [{ key: 'all', label: 'All owners' }, ...REPS.map((r) => ({ key: r.id, label: r.name }))];
  const pipelineOptions = [{ key: 'all', label: 'All pipelines' }, ...PIPELINES.map((p) => ({ key: p, label: p }))];
  const rangeOptions = (Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => ({ key: k, label: RANGE_LABELS[k] }));

  const sliceLabel = [
    RANGE_LABELS[filters.range],
    filters.owner === 'all' ? 'all owners' : rep.name,
    filters.pipeline === 'all' ? 'all pipelines' : filters.pipeline,
  ].join(' · ');

  return (
    <div className="cd-app">
      <aside className="cd-side">
        <div className="cd-brand">
          <span className="cd-brand-mark">
            <Zap size={16} strokeWidth={2.4} />
          </span>
          <div>
            <b>Dovehero</b>
            <small style={{ display: 'block' }}>Reporting</small>
          </div>
        </div>
        {NAV_ITEMS.map((it) => (
          <button key={it.key} className={`cd-nav-item ${nav === it.key ? 'on' : ''}`} onClick={() => setNav(it.key)}>
            {it.icon}
            {it.label}
          </button>
        ))}
        <div className="cd-side-foot">Prototype · mock data only</div>
      </aside>

      <div className="cd-main">
        <header className="cd-topbar">
          <SelectPop
            title="Saved dashboards"
            label={
              <>
                <LayoutDashboard size={15} style={{ color: 'var(--accent)' }} />
                <b>{dash.name}</b>
              </>
            }
            value={dash.id}
            options={dashboards.map((d) => ({ key: d.id, label: `${d.name} — ${d.role}` }))}
            onChange={(id) => {
              holdFrame();
              setActiveId(id);
              setNav('dashboards');
            }}
          />

          <div className="cd-topbar-spacer" />

          <div className="cd-filters">
            <span className="cd-filter-label">Filters</span>
            <SelectPop
              title="Date range"
              label={<><CalendarDays size={14} /> {RANGE_LABELS[filters.range]}</>}
              value={filters.range}
              options={rangeOptions}
              onChange={(range) => setFilters({ range: range as RangeKey })}
            />
            <SelectPop
              title="Deal owner"
              label={<><Users size={14} /> {filters.owner === 'all' ? 'All owners' : rep.name}</>}
              value={filters.owner}
              options={ownerOptions}
              onChange={(owner) => setFilters({ owner })}
            />
            <SelectPop
              title="Pipeline"
              label={<><Briefcase size={14} /> {filters.pipeline === 'all' ? 'All pipelines' : filters.pipeline}</>}
              value={filters.pipeline}
              options={pipelineOptions}
              onChange={(pipeline) => setFilters({ pipeline })}
            />
          </div>

          <div className="cd-topbar-spacer" />

          <button className="cd-btn primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add widget
          </button>
          <button className="cd-btn ghost" onClick={refreshAll} title="Refresh all widgets">
            <RefreshCw size={15} />
          </button>
          <button className="cd-btn ghost" onClick={() => toast('Share link copied to clipboard (mock)')} title="Share dashboard">
            <Share2 size={15} />
          </button>
        </header>

        <main className="cd-canvas">
          {nav !== 'dashboards' ? (
            <div className="cd-placeholder">
              <span style={{ color: 'var(--axis)' }}>{NAV_ITEMS.find((n) => n.key === nav)?.icon}</span>
              <h2>{NAV_ITEMS.find((n) => n.key === nav)?.label}</h2>
              <p>This prototype focuses on the reporting dashboards — the {nav} workspace isn't wired up.</p>
              <button className="cd-btn primary" onClick={() => setNav('dashboards')}>
                <LayoutDashboard size={15} /> Back to dashboards
              </button>
            </div>
          ) : (
            <>
              <div className="cd-canvas-head">
                <h1>{dash.name}</h1>
                <span className="sub">{sliceLabel}</span>
              </div>
              {dash.widgets.length === 0 ? (
                <div className="cd-placeholder">
                  <LayoutDashboard size={28} style={{ color: 'var(--axis)' }} />
                  <h2>This dashboard is empty</h2>
                  <p>Add your first report to start tracking the numbers that matter.</p>
                  <button className="cd-btn primary" onClick={() => setAddOpen(true)}>
                    <Plus size={15} /> Add widget
                  </button>
                </div>
              ) : (
                <div className={`cd-grid ${pending ? 'pending' : ''}`}>
                  {dash.widgets.map((key) => {
                    const def = WIDGETS[key];
                    if (!def) return null;
                    const ctx: Ctx = {
                      deals,
                      activities: data.activities,
                      bounds,
                      filters,
                      now,
                      rep,
                      jit: (jitters[key] ?? 0) + globalJit,
                      seed,
                    };
                    return (
                      <WidgetCard
                        key={key}
                        widgetKey={key}
                        def={def}
                        ctx={ctx}
                        onRemove={() => mutateDash((w) => w.filter((k) => k !== key))}
                        onRefresh={() => setJitters((j) => ({ ...j, [key]: (j[key] ?? 0) + 1 }))}
                        onExport={() => toast(`Export queued (mock) — ${def.title}.csv`)}
                        dragging={dragKey === key}
                        dropTarget={dropKey === key && dragKey !== key}
                        onDragStart={() => setDragKey(key)}
                        onDragEnter={() => {
                          if (dragKey && dragKey !== key) {
                            setDropKey(key);
                            reorder(dragKey, key);
                          }
                        }}
                        onDragEnd={() => {
                          setDragKey(null);
                          setDropKey(null);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {addOpen && (
        <AddWidgetModal
          current={dash.widgets}
          onClose={() => setAddOpen(false)}
          onAdd={(key) => {
            mutateDash((w) => [...w, key]);
            setAddOpen(false);
            toast(`${WIDGETS[key].title} added to ${dash.name}`);
          }}
        />
      )}

      <div className="cd-toasts">
        {toasts.map((t) => (
          <div className="cd-toast" key={t.id}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
