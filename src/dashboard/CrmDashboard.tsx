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
  CheckCircle2,
  Circle,
  ListChecks,
  Mail,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Moon,
  Pencil,
  Phone,
  PieChart as PieChartIcon,
  Plus,
  Copy,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Sun,
  Table2,
  Target,
  Trash2,
  Tv,
  Upload,
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
  parseDealsCsv,
  SAMPLE_CSV,
  type ActivityEvent,
  type Bounds,
  type Dataset,
  type Deal,
  type Filters,
  type RangeKey,
  type Rep,
} from './data';
import {
  AXIS_TICK,
  AXIS_LINE,
  ChartTip,
  Delta,
  Empty,
  Gauge,
  LegendChips,
  StatTile as Tile,
} from './chartKit';
import { ReportView, measureLabel, type DrillTarget } from './ReportView';
import { ReportBuilder } from './ReportBuilder';
import { AiPanel } from './AiPanel';
import { CommandPalette, type Command } from './CommandPalette';
import { morningBrief, recommendations } from './ai';
import {
  drillRecords,
  fmtByUnit,
  uid,
  OBJECTS,
  type ReportConfig,
  type EngineCtx,
  type CrossFilter,
  type Row,
} from './reportEngine';
import './dashboard.css';

// ---------------------------------------------------------------------------
// Shared context every preset widget renders from
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
// AI / productivity widgets (the command-center layer, in-grid)
// ---------------------------------------------------------------------------

function AiInsights({ ctx }: { ctx: Ctx }) {
  const items = morningBrief(ctx.deals, ctx.bounds, ctx.now).slice(0, 5);
  if (!items.length) return <Empty msg="No insights for this slice" />;
  const Icon = { good: TrendingUp, warn: Target, bad: X, info: Sparkles } as const;
  return (
    <div className="cd-ai-brief">
      {items.map((it, i) => {
        const I = Icon[it.tone];
        return (
          <div key={i} className={`cd-brief-item ${it.tone}`}>
            <I size={15} className="ic" />
            <span>{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function WorkQueue({ ctx }: { ctx: Ctx }) {
  const recs = useMemo(() => recommendations(ctx.deals, ctx.now), [ctx.deals, ctx.now]);
  const [done, setDone] = useState<Set<string>>(new Set());
  if (!recs.length) return <Empty msg="Nothing urgent — you're clear" />;
  const remaining = recs.filter((r) => !done.has(r.id)).length;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '0 2px 8px' }}>{remaining} of {recs.length} open</div>
      <div className="cd-ai-recs">
        {recs.map((r) => {
          const isDone = done.has(r.id);
          return (
            <div className="cd-rec" key={r.id} style={{ opacity: isDone ? 0.55 : 1 }}>
              <button
                className="cd-check-btn"
                onClick={() => setDone((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                aria-label={isDone ? 'Mark not done' : 'Mark done'}
              >
                {isDone ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} /> : <Circle size={18} style={{ color: 'var(--muted)' }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cd-rec-text" style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{r.text}</div>
                <div className="cd-rec-sub">{r.sub}</div>
              </div>
              <span className="cd-rec-tag">{r.action}</span>
            </div>
          );
        })}
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
  aiInsights: {
    title: 'AI insights',
    desc: 'Nova’s headline read on the current slice',
    span: 5,
    icon: <Sparkles size={15} />,
    render: (ctx) => <AiInsights ctx={ctx} />,
  },
  workQueue: {
    title: 'Work queue',
    desc: 'Prioritised next actions you can check off',
    span: 7,
    icon: <ListChecks size={15} />,
    render: (ctx) => <WorkQueue ctx={ctx} />,
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

// A tile is either a curated preset widget or a fully user-built custom report.
// `span` optionally overrides the default grid width (widget resize).
type Tile =
  | { id: string; kind: 'preset'; preset: string; span?: ReportConfig['span'] }
  | { id: string; kind: 'custom'; report: ReportConfig; span?: ReportConfig['span'] };

interface DashboardConfig {
  id: string;
  name: string;
  role: string;
  tiles: Tile[];
}

let _tid = 0;
const tid = () => `t${(_tid += 1)}`;
const presetTile = (k: string): Tile => ({ id: tid(), kind: 'preset', preset: k });

const tileSpan = (t: Tile): ReportConfig['span'] =>
  t.span ?? (t.kind === 'custom' ? t.report.span : WIDGETS[t.preset]?.span ?? 6);

const INITIAL_DASHBOARDS: DashboardConfig[] = [
  {
    id: 'pipeline',
    name: 'Sales Pipeline',
    role: 'Team view',
    tiles: ['kpis', 'revenueGauge', 'funnel', 'stageValue', 'createdClosed', 'sourceDonut', 'leaderboard', 'activityFeed'].map(presetTile),
  },
  {
    id: 'exec',
    name: 'Executive Overview',
    role: 'Leadership view',
    tiles: ['aiInsights', 'workQueue', 'revenueGauge', 'coverage', 'retention', 'mrr', 'ltvCac', 'custMove'].map(presetTile),
  },
  {
    id: 'rep',
    name: 'My Sales Desk',
    role: 'Individual rep view',
    tiles: ['repQuota', 'todayStats', 'myActivity', 'repVsTeam', 'myDeals'].map(presetTile),
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

/** HubSpot-style dashboard title with an inline switcher dropdown. */
function DashSwitcher({
  dash, dashboards, onPick, onNew,
}: {
  dash: DashboardConfig;
  dashboards: DashboardConfig[];
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const { open, setOpen, ref } = usePop();
  return (
    <div className="cd-dash-title" ref={ref}>
      <div className="cd-breadcrumb">Reporting · Dashboards</div>
      <button className="cd-dash-switcher" onClick={() => setOpen(!open)}>
        <b>{dash.name}</b>
        <ChevronDown size={18} className="chev" />
      </button>
      {open && (
        <div className="cd-pop" style={{ top: '100%', minWidth: 260 }}>
          <div className="cd-pop-title">Switch dashboard</div>
          {dashboards.map((d) => (
            <button key={d.id} className="cd-pop-row" onClick={() => { onPick(d.id); setOpen(false); }}>
              <span className="check">{d.id === dash.id && <Check size={16} strokeWidth={3} />}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{d.name}</span>
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>{d.role}</small>
              </span>
            </button>
          ))}
          <div className="cd-pop-sep" />
          <button className="cd-pop-row" onClick={() => { onNew(); setOpen(false); }}>
            <span className="check"><Plus size={15} /></span> New blank dashboard
          </button>
        </div>
      )}
    </div>
  );
}

/** Split "Add" control: build a custom report, or add a prebuilt one. */
function AddMenu({
  open,
  setOpen,
  onCustom,
  onLibrary,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCustom: () => void;
  onLibrary: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);
  return (
    <div className="cd-popwrap" ref={ref}>
      <button className="cd-btn primary" onClick={() => setOpen(!open)}>
        <Plus size={15} /> Add report <ChevronDown size={14} className="chev" style={{ color: '#fff', opacity: 0.8 }} />
      </button>
      {open && (
        <div className="cd-pop right">
          <button className="cd-pop-row" onClick={onCustom}>
            <Sparkles size={15} style={{ color: 'var(--accent)' }} /> Create custom report
          </button>
          <button className="cd-pop-row" onClick={onLibrary}>
            <BarChart3 size={15} /> Add from library
          </button>
        </div>
      )}
    </div>
  );
}

/** Top-bar "view" popover: theme, density, focus mode, import, share. */
function ViewMenu({
  theme, setTheme, density, setDensity, tv, setTv, imported, onImport, onShare,
}: {
  theme: 'system' | 'light' | 'dark';
  setTheme: (t: 'system' | 'light' | 'dark') => void;
  density: 'cozy' | 'compact';
  setDensity: (d: 'cozy' | 'compact') => void;
  tv: boolean;
  setTv: (v: boolean) => void;
  imported: boolean;
  onImport: () => void;
  onShare: () => void;
}) {
  const { open, setOpen, ref } = usePop();
  const themes: Array<{ k: 'system' | 'light' | 'dark'; label: string; icon: ReactNode }> = [
    { k: 'system', label: 'System', icon: <Monitor size={15} /> },
    { k: 'light', label: 'Light', icon: <Sun size={15} /> },
    { k: 'dark', label: 'Dark', icon: <Moon size={15} /> },
  ];
  return (
    <div className="cd-popwrap" ref={ref}>
      <button className="cd-iconbtn" onClick={() => setOpen(!open)} title="View options" aria-label="View options">
        <Settings2 size={16} />
      </button>
      {open && (
        <div className="cd-pop right" style={{ minWidth: 210 }}>
          <div className="cd-pop-title">Theme</div>
          <div className="cd-seg" style={{ margin: '2px 6px 6px', width: 'calc(100% - 12px)' }}>
            {themes.map((t) => (
              <button key={t.k} className={theme === t.k ? 'on' : ''} onClick={() => setTheme(t.k)} style={{ flex: 1, justifyContent: 'center', display: 'flex', gap: 5, alignItems: 'center' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div className="cd-pop-sep" />
          <button className="cd-pop-row" onClick={() => setDensity(density === 'cozy' ? 'compact' : 'cozy')}>
            <span className="check">{density === 'compact' && <Check size={16} strokeWidth={3} />}</span>
            Compact density
          </button>
          <button className="cd-pop-row" onClick={() => { setTv(!tv); setOpen(false); }}>
            <span className="check">{tv && <Check size={16} strokeWidth={3} />}</span>
            <Tv size={14} /> Focus / TV mode
          </button>
          <div className="cd-pop-sep" />
          <button className="cd-pop-row" onClick={() => { onImport(); setOpen(false); }}>
            <Upload size={14} /> Import CSV{imported ? ' (active)' : ''}
          </button>
          <button className="cd-pop-row" onClick={() => { onShare(); setOpen(false); }}>
            <Share2 size={14} /> Share dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function TileCard({
  tile,
  presetCtx,
  engineCtx,
  span,
  onRemove,
  onRefresh,
  onExport,
  onEdit,
  onCross,
  onViewRecords,
  onDuplicate,
  onResize,
  onMaximize,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  tile: Tile;
  presetCtx: Ctx;
  engineCtx: EngineCtx;
  span: ReportConfig['span'];
  onRemove: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onEdit: () => void;
  onCross: (field: string, value: string, label: string) => void;
  onViewRecords: () => void;
  onDuplicate: () => void;
  onResize: (span: ReportConfig['span']) => void;
  onMaximize: () => void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const { open, setOpen, ref } = usePop();
  const [flash, setFlash] = useState(0);

  const isCustom = tile.kind === 'custom';
  const def = tile.kind === 'preset' ? WIDGETS[tile.preset] : null;
  const title = isCustom ? tile.report.title : def?.title ?? 'Report';
  const sub = isCustom ? measureLabel(tile.report) : def?.sub?.(presetCtx) ?? null;
  const WIDTHS: Array<{ s: ReportConfig['span']; label: string }> = [
    { s: 3, label: 'S' }, { s: 4, label: 'M' }, { s: 6, label: 'L' }, { s: 8, label: 'XL' }, { s: 12, label: 'Full' },
  ];

  return (
    <section
      className={`cd-card w-${span} ${dragging ? 'dragging' : ''} ${dropTarget ? 'dropTarget' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
    >
      <div className="cd-card-head">
        <span className="cd-drag" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Drag to reorder">
          <GripVertical size={14} />
        </span>
        <span className="cd-card-title">{title}</span>
        {isCustom && <span className="cd-customtag">Custom</span>}
        <button className="cd-iconbtn cd-card-max" onClick={onMaximize} title="Maximize" aria-label="Maximize">
          <Maximize2 size={14} />
        </button>
        <div className="cd-popwrap" ref={ref}>
          <button className="cd-iconbtn" onClick={() => setOpen(!open)} aria-label={`${title} menu`}>
            <MoreHorizontal size={16} />
          </button>
          {open && (
            <div className="cd-pop right">
              <div className="cd-pop-title">Width</div>
              <div className="cd-width-row">
                {WIDTHS.map((w) => (
                  <button key={w.s} className={`cd-width-btn ${span === w.s ? 'on' : ''}`} onClick={() => { onResize(w.s); }}>{w.label}</button>
                ))}
              </div>
              <div className="cd-pop-sep" />
              <button className="cd-pop-row" onClick={() => { setOpen(false); onMaximize(); }}>
                <Maximize2 size={14} /> Maximize
              </button>
              <button className="cd-pop-row" onClick={() => { setOpen(false); setFlash((f) => f + 1); onRefresh(); }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button className="cd-pop-row" onClick={() => { setOpen(false); onDuplicate(); }}>
                <Copy size={14} /> Duplicate
              </button>
              {isCustom && (
                <>
                  <button className="cd-pop-row" onClick={() => { setOpen(false); onViewRecords(); }}>
                    <Table2 size={14} /> View records
                  </button>
                  <button className="cd-pop-row" onClick={() => { setOpen(false); onEdit(); }}>
                    <Pencil size={14} /> Edit report
                  </button>
                </>
              )}
              <button className="cd-pop-row" onClick={() => { setOpen(false); onExport(); }}>
                <Download size={14} /> Export CSV
              </button>
              <div className="cd-pop-sep" />
              <button className="cd-pop-row danger" onClick={() => { setOpen(false); onRemove(); }}>
                <X size={14} /> Remove from dashboard
              </button>
            </div>
          )}
        </div>
      </div>
      {sub && <div className="cd-card-sub">{sub}</div>}
      <div className="cd-card-body cd-refreshing" key={`${tile.id}-${flash}-${presetCtx.jit}`}>
        {isCustom ? <ReportView config={tile.report} ctx={engineCtx} onCross={onCross} /> : def?.render(presetCtx)}
      </div>
    </section>
  );
}

function AddWidgetModal({
  present,
  onAdd,
  onClose,
}: {
  present: Set<string>;
  onAdd: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal" role="dialog" aria-label="Add widget">
        <div className="cd-modal-head">
          <h2>Add a prebuilt report</h2>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="cd-modal-body">
          <div className="cd-widget-lib">
            {Object.entries(WIDGETS).map(([key, def]) => {
              const added = present.has(key);
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

/** CSV import: paste or upload deals; every report recomputes from them. */
function ImportModal({
  now, imported, onApply, onReset, onClose,
}: {
  now: number;
  imported: boolean;
  onApply: (deals: Deal[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseDealsCsv> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (t: string) => {
    setText(t);
    setPreview(t.trim() ? parseDealsCsv(t, now) : null);
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => parse(String(reader.result ?? ''));
    reader.readAsText(f);
  };

  const ok = preview && preview.deals.length > 0;
  return (
    <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal" role="dialog" aria-label="Import CSV" style={{ width: 'min(640px, 100%)' }}>
        <div className="cd-modal-head">
          <Upload size={17} style={{ color: 'var(--accent)' }} />
          <h2>Import deals from CSV</h2>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="cd-modal-body">
          <p className="cd-fnote" style={{ marginBottom: 10 }}>
            Columns are matched by header — company, owner, amount, stage, source, status, created &amp; closed dates.
            Everything on every dashboard recomputes from what you load.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button className="cd-btn" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose file</button>
            <button className="cd-btn" onClick={() => parse(SAMPLE_CSV)}><Table2 size={14} /> Load sample CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <textarea
            className="cd-input"
            style={{ minHeight: 150, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }}
            placeholder="Paste CSV here — header row first…"
            value={text}
            onChange={(e) => parse(e.target.value)}
          />
          {preview && (
            <div style={{ marginTop: 10, fontSize: 12.5 }}>
              {ok ? (
                <div className="cd-pill good" style={{ marginBottom: 6 }}><Check size={13} /> {preview.deals.length} deals parsed</div>
              ) : (
                <div className="cd-pill bad" style={{ marginBottom: 6 }}><X size={13} /> Nothing to import</div>
              )}
              {Object.keys(preview.mapped).length > 0 && (
                <div style={{ color: 'var(--muted)' }}>
                  Mapped: {Object.entries(preview.mapped).map(([k, v]) => `${k} ← ${v}`).join(' · ')}
                </div>
              )}
              {preview.warnings.map((w, i) => <div key={i} style={{ color: 'var(--bad)', marginTop: 3 }}>⚠ {w}</div>)}
            </div>
          )}
          <div className="cd-builder-actions" style={{ marginTop: 14 }}>
            {imported && <button className="cd-btn" onClick={onReset}>Revert to sample data</button>}
            <button className="cd-btn ghost" onClick={onClose}>Cancel</button>
            <button className="cd-btn primary" disabled={!ok} onClick={() => ok && onApply(preview!.deals)}>
              <Check size={15} /> Import {ok ? preview!.deals.length : ''} deals
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Drill-through slide-over: the underlying records behind a clicked data point. */
function DrillPanel({ target, ctx, onClose }: { target: DrillTarget; ctx: EngineCtx; onClose: () => void }) {
  const rows = useMemo(() => drillRecords(target.config, ctx, target.bucketKey), [target, ctx]);
  const def = OBJECTS[target.config.object];
  const cols = def.fields.filter((f) => ['stage', 'source', 'owner', 'status', 'type', 'lifecycle', 'amount', 'company', 'name', 'contact', 'daysInStage'].includes(f.key)).slice(0, 5);
  const cell = (r: Row, key: string, type: string) => {
    const v = r[key];
    if (v === null || v === undefined || v === '') return '—';
    if (type === 'currency') return fmtByUnit(Number(v), 'money', false);
    if (type === 'duration') return `${v}d`;
    return String(v);
  };
  return (
    <div className="cd-scrim right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="cd-drawer" role="dialog" aria-label="Underlying records">
        <div className="cd-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{target.bucketLabel}</h2>
            <div className="cd-card-sub" style={{ padding: 0 }}>{rows.length} {def.singular}{rows.length === 1 ? '' : 's'} · drill-through from “{target.config.title}”</div>
          </div>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="cd-modal-body">
          {rows.length === 0 ? (
            <Empty msg="No underlying records." />
          ) : (
            <div className="cd-tablewrap">
              <table className="cd-table">
                <thead>
                  <tr>{cols.map((c) => <th key={c.key} className={c.measurable ? 'num' : ''}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {cols.map((c) => <td key={c.key} className={c.measurable ? 'num' : ''}>{cell(r, c.key, c.type)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
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

/** Apply active cross-filters to a raw deal (mirrors the engine for presets). */
function matchDealCross(d: Deal, cross: CrossFilter[]): boolean {
  for (const c of cross) {
    if (c.field === 'stage' && STAGES[d.stage] !== c.value) return false;
    if (c.field === 'source' && d.source !== c.value) return false;
    if (c.field === 'status' && d.status !== c.value) return false;
    if (c.field === 'pipeline' && d.pipeline !== c.value) return false;
    if (c.field === 'company' && d.company !== c.value) return false;
    if (c.field === 'owner' && (REPS.find((r) => r.id === d.owner)?.name ?? '') !== c.value) return false;
  }
  return true;
}

const crossFieldLabel = (field: string) => OBJECTS.deals.fields.find((f) => f.key === field)?.label ?? field;

const VIZ_LABEL: Record<string, string> = {
  kpi: 'Single value', gauge: 'Gauge', pace: 'Goal pacing', bar: 'Bar', hbar: 'Horizontal bar', line: 'Line', area: 'Area',
  combo: 'Combination', pie: 'Pie', donut: 'Donut', funnel: 'Funnel', table: 'Table', leaderboard: 'Leaderboard', scatter: 'Quadrant', cohort: 'Cohort',
};

/** The reusable report library (the "Reports" workspace). */
function ReportsLibrary({
  reports, dashName, onNew, onAdd, onEdit, onDelete,
}: {
  reports: ReportConfig[];
  dashName: string;
  onNew: () => void;
  onAdd: (r: ReportConfig) => void;
  onEdit: (r: ReportConfig) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="cd-canvas-head" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1>Report library</h1>
          <span className="sub">{reports.length} saved report{reports.length === 1 ? '' : 's'} · reuse on any dashboard</span>
        </div>
        <button className="cd-btn primary" onClick={onNew}><Sparkles size={15} /> Create report</button>
      </div>
      {reports.length === 0 ? (
        <div className="cd-placeholder">
          <BarChart3 size={28} style={{ color: 'var(--axis)' }} />
          <h2>No saved reports yet</h2>
          <p>Every report you build is saved here so you can drop it onto any dashboard later.</p>
          <button className="cd-btn primary" onClick={onNew}><Sparkles size={15} /> Create your first report</button>
        </div>
      ) : (
        <div className="cd-lib-grid">
          {reports.map((r) => (
            <div className="cd-lib-card" key={r.id}>
              <div className="cd-lib-card-top">
                <span className="cd-card-title">{r.title}</span>
                <button className="cd-iconbtn" onClick={() => onDelete(r.id)} aria-label="Delete report"><Trash2 size={15} /></button>
              </div>
              <div className="cd-lib-card-meta">
                {OBJECTS[r.object].label} · {VIZ_LABEL[r.viz]} · {measureLabel(r)}
              </div>
              <div className="cd-lib-card-actions">
                <button className="cd-btn primary" onClick={() => onAdd(r)}><Plus size={14} /> Add to {dashName}</button>
                <button className="cd-btn" onClick={() => onEdit(r)}><Pencil size={14} /> Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CrmDashboard() {
  const now = useMemo(() => Date.now(), []);
  const [seed] = useState(1_337_042);
  const generated = useMemo(() => generateData(seed, now), [seed, now]);
  const [imported, setImported] = useState<Dataset | null>(null);
  const data = imported ?? generated;

  const [dashboards, setDashboards] = useState(INITIAL_DASHBOARDS);
  const [activeId, setActiveId] = useState('pipeline');
  const [nav, setNav] = useState('dashboards');
  const [filters, setFiltersRaw] = useState<Filters>({ range: '90d', owner: 'all', pipeline: 'all' });
  const [jitters, setJitters] = useState<Record<string, number>>({});
  const [globalJit, setGlobalJit] = useState(0);
  const [pending, setPending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [builder, setBuilder] = useState<{ initial?: ReportConfig; tileId?: string; libraryEdit?: boolean } | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [savedReports, setSavedReports] = useState<ReportConfig[]>([]);
  const [cross, setCross] = useState<CrossFilter[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [maximized, setMaximized] = useState<string | null>(null);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [density, setDensity] = useState<'cozy' | 'compact'>('cozy');
  const [tv, setTv] = useState(false);

  // ⌘K / Ctrl+K opens the command palette anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const toastId = useRef(0);

  const dash = dashboards.find((d) => d.id === activeId) ?? dashboards[0];
  const bounds = useMemo(() => periodBounds(filters.range, now), [filters.range, now]);
  // Preset widgets read raw deals; apply the cross-filter here too so a click
  // in one tile narrows the whole dashboard, presets included.
  const deals = useMemo(
    () => sliceDeals(data.deals, filters).filter((d) => matchDealCross(d, cross)),
    [data, filters, cross],
  );
  const rep = REPS.find((r) => r.id === filters.owner) ?? REPS[0];

  // Engine context for custom reports (full dataset; global owner/pipeline/date
  // + cross-filters applied inside the engine) and drill-through.
  const engineCtx: EngineCtx = useMemo(
    () => ({ data, filters, bounds, now, jitter: globalJit, cross }),
    [data, filters, bounds, now, globalJit, cross],
  );

  const toggleCross = (field: string, value: string, label: string) => {
    holdFrame();
    setCross((cs) => {
      const exists = cs.some((c) => c.field === field && c.value === value);
      return exists ? cs.filter((c) => !(c.field === field && c.value === value)) : [...cs, { field, value, label }];
    });
  };

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

  const mutateDash = (fn: (tiles: Tile[]) => Tile[]) => {
    setDashboards((ds) => ds.map((d) => (d.id === dash.id ? { ...d, tiles: fn(d.tiles) } : d)));
  };

  const reorder = (from: string, to: string) => {
    mutateDash((tiles) => {
      const a = tiles.findIndex((t) => t.id === from);
      const b = tiles.findIndex((t) => t.id === to);
      if (a < 0 || b < 0 || a === b) return tiles;
      const next = [...tiles];
      const [moved] = next.splice(a, 1);
      next.splice(b, 0, moved);
      return next;
    });
  };

  const upsertLibrary = (cfg: ReportConfig) =>
    setSavedReports((rs) => (rs.some((r) => r.id === cfg.id) ? rs.map((r) => (r.id === cfg.id ? cfg : r)) : [...rs, cfg]));

  const saveReport = (cfg: ReportConfig) => {
    if (builder?.libraryEdit) {
      upsertLibrary(cfg);
      toast(`Saved “${cfg.title}” to the report library`);
    } else if (builder?.tileId) {
      const id = builder.tileId;
      mutateDash((tiles) => tiles.map((t) => (t.id === id ? { id, kind: 'custom', report: cfg } : t)));
      upsertLibrary(cfg);
      toast(`Saved “${cfg.title}”`);
    } else {
      mutateDash((tiles) => [...tiles, { id: tid(), kind: 'custom', report: cfg }]);
      upsertLibrary(cfg);
      toast(`“${cfg.title}” added to ${dash.name}`);
    }
    setBuilder(null);
  };

  // Clone a saved report onto the current dashboard (independent copy).
  const addLibraryToDash = (cfg: ReportConfig) => {
    mutateDash((tiles) => [...tiles, { id: tid(), kind: 'custom', report: { ...cfg, id: uid('rep') } }]);
    setNav('dashboards');
    toast(`“${cfg.title}” added to ${dash.name}`);
  };

  const createDashboard = () => {
    const n = dashboards.filter((d) => d.role === 'Custom dashboard').length + 1;
    const id = `dash${dashboards.length + 1}-${n}`;
    setDashboards((ds) => [...ds, { id, name: `New dashboard ${n}`, role: 'Custom dashboard', tiles: [] }]);
    setActiveId(id);
    setNav('dashboards');
    toast('Blank dashboard created — add your first report');
  };

  const applyImport = (deals: Deal[]) => {
    setImported({ deals, activities: generated.activities });
    setCross([]);
    holdFrame();
    setImportOpen(false);
    toast(`Imported ${deals.length} deals — every report now reads your data`);
  };
  const resetData = () => {
    setImported(null);
    holdFrame();
    setImportOpen(false);
    toast('Reverted to the sample dataset');
  };

  const brief = useMemo(() => morningBrief(deals, bounds, now), [deals, bounds, now]);

  // Universal command list for ⌘K.
  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [];
    dashboards.forEach((d) =>
      cmds.push({ id: `dash-${d.id}`, group: 'Dashboards', label: d.name, sub: d.role, icon: <LayoutDashboard size={15} />, run: () => { holdFrame(); setActiveId(d.id); setNav('dashboards'); } }),
    );
    savedReports.forEach((r) =>
      cmds.push({ id: `rep-${r.id}`, group: 'Saved reports', label: r.title, sub: `Add to ${dash.name}`, icon: <BarChart3 size={15} />, run: () => addLibraryToDash(r) }),
    );
    Object.entries(WIDGETS).forEach(([key, def]) =>
      cmds.push({ id: `w-${key}`, group: 'Prebuilt widgets', label: def.title, sub: `Add to ${dash.name}`, icon: def.icon, run: () => { mutateDash((ts) => [...ts, presetTile(key)]); setNav('dashboards'); toast(`${def.title} added to ${dash.name}`); } }),
    );
    const companies = [...new Set(data.deals.map((d) => d.company))].slice(0, 24);
    companies.forEach((c) =>
      cmds.push({ id: `co-${c}`, group: 'Companies', label: c, sub: 'Focus dashboard on this company', icon: <Briefcase size={15} />, run: () => { setNav('dashboards'); toggleCross('company', c, c); } }),
    );
    const A = (id: string, label: string, icon: ReactNode, run: () => void, sub?: string): Command => ({ id, group: 'Actions', label, sub, icon, run });
    cmds.push(
      A('act-new', 'Create custom report', <Sparkles size={15} />, () => setBuilder({})),
      A('act-lib', 'Add report from library', <Plus size={15} />, () => setAddOpen(true)),
      A('act-dash', 'New blank dashboard', <LayoutDashboard size={15} />, createDashboard),
      A('act-import', 'Import CSV data', <Upload size={15} />, () => setImportOpen(true)),
      A('act-ai', 'Open Nova AI assistant', <Sparkles size={15} />, () => setAiOpen(true)),
      A('act-refresh', 'Refresh all widgets', <RefreshCw size={15} />, refreshAll),
      A('act-theme', 'Cycle theme (system / light / dark)', <Sun size={15} />, () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))),
      A('act-density', 'Toggle compact density', <Settings2 size={15} />, () => setDensity((d) => (d === 'cozy' ? 'compact' : 'cozy'))),
      A('act-tv', 'Toggle focus / TV mode', <Tv size={15} />, () => setTv((v) => !v)),
    );
    return cmds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboards, savedReports, data, dash.name]);

  const ownerOptions = [{ key: 'all', label: 'All owners' }, ...REPS.map((r) => ({ key: r.id, label: r.name }))];
  const pipelineOptions = [{ key: 'all', label: 'All pipelines' }, ...PIPELINES.map((p) => ({ key: p, label: p }))];
  const rangeOptions = (Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => ({ key: k, label: RANGE_LABELS[k] }));

  return (
    <div className={`cd-app ${theme === 'dark' ? 'force-dark' : theme === 'light' ? 'force-light' : ''} ${density === 'compact' ? 'dense' : ''} ${tv ? 'tv' : ''}`}>
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
        <div className="cd-header">
        <header className="cd-topbar">
          {nav === 'dashboards' ? (
            <DashSwitcher
              dash={dash}
              dashboards={dashboards}
              onPick={(id) => { holdFrame(); setActiveId(id); setNav('dashboards'); }}
              onNew={createDashboard}
            />
          ) : (
            <div className="cd-dash-title">
              <div className="cd-breadcrumb">Reporting</div>
              <b className="cd-section-title">{NAV_ITEMS.find((n) => n.key === nav)?.label}</b>
            </div>
          )}

          <div className="cd-topbar-spacer" />

          <AddMenu
            open={addMenu}
            setOpen={setAddMenu}
            onCustom={() => { setAddMenu(false); setBuilder({}); }}
            onLibrary={() => { setAddMenu(false); setAddOpen(true); }}
          />
          <button className="cd-btn ghost cd-search-btn" onClick={() => setPaletteOpen(true)} title="Search (⌘K)">
            <Search size={15} /> <span className="cd-search-txt">Search</span> <kbd className="cd-kbd">⌘K</kbd>
          </button>
          <button className="cd-btn nova" onClick={() => setAiOpen(true)} title="Ask Nova AI">
            <Sparkles size={15} /> Nova
          </button>
          <button className="cd-btn ghost" onClick={refreshAll} title="Refresh all widgets">
            <RefreshCw size={15} />
          </button>
          <ViewMenu
            theme={theme} setTheme={setTheme}
            density={density} setDensity={setDensity}
            tv={tv} setTv={setTv}
            imported={!!imported}
            onImport={() => setImportOpen(true)}
            onShare={() => toast('Share link copied to clipboard (mock)')}
          />
        </header>

        {nav === 'dashboards' && (
          <div className="cd-filterbar">
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
            <div className="cd-topbar-spacer" />
            <span className="cd-filterbar-meta">{dash.tiles.length} report{dash.tiles.length === 1 ? '' : 's'}{imported ? ' · imported data' : ''}</span>
          </div>
        )}
        </div>

        <main className="cd-canvas">
          {nav === 'reports' ? (
            <ReportsLibrary
              reports={savedReports}
              dashName={dash.name}
              onNew={() => setBuilder({})}
              onAdd={addLibraryToDash}
              onEdit={(r) => setBuilder({ initial: r, libraryEdit: true })}
              onDelete={(id) => setSavedReports((rs) => rs.filter((r) => r.id !== id))}
            />
          ) : nav !== 'dashboards' ? (
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
              {brief.length > 0 && (
                <button className="cd-aistrip" onClick={() => setAiOpen(true)}>
                  <span className="cd-aistrip-mark"><Sparkles size={15} /></span>
                  <span className="cd-aistrip-text">
                    {brief.slice(0, 2).map((b, i) => (
                      <span key={i} className="cd-aistrip-item">
                        <span className={`cd-aistrip-dot ${b.tone}`} />
                        {b.text}
                      </span>
                    ))}
                  </span>
                  <span className="cd-aistrip-cta">Ask Nova <Sparkles size={13} /></span>
                </button>
              )}
              {cross.length > 0 && (
                <div className="cd-crossbar">
                  <span className="cd-cross-label">Cross-filter</span>
                  {cross.map((c) => (
                    <button key={`${c.field}:${c.value}`} className="cd-crosschip" onClick={() => toggleCross(c.field, c.value, c.label)}>
                      {crossFieldLabel(c.field)}: <b>{c.label}</b> <X size={12} />
                    </button>
                  ))}
                  <button className="cd-linkbtn" onClick={() => { holdFrame(); setCross([]); }}>Clear all</button>
                </div>
              )}
              {dash.tiles.length === 0 ? (
                <div className="cd-placeholder">
                  <LayoutDashboard size={28} style={{ color: 'var(--axis)' }} />
                  <h2>This dashboard is empty</h2>
                  <p>Build a report from scratch, or add one from the prebuilt library.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="cd-btn primary" onClick={() => setBuilder({})}>
                      <Sparkles size={15} /> Create report
                    </button>
                    <button className="cd-btn" onClick={() => setAddOpen(true)}>
                      <Plus size={15} /> Add from library
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`cd-grid ${pending ? 'pending' : ''}`}>
                  {dash.tiles.map((tile) => {
                    const presetCtx: Ctx = {
                      deals,
                      activities: data.activities,
                      bounds,
                      filters,
                      now,
                      rep,
                      jit: (jitters[tile.id] ?? 0) + globalJit,
                      seed,
                    };
                    const tileCtx: EngineCtx = { ...engineCtx, jitter: (jitters[tile.id] ?? 0) + globalJit };
                    const label = tile.kind === 'custom' ? tile.report.title : WIDGETS[tile.preset]?.title ?? 'Report';
                    return (
                      <TileCard
                        key={tile.id}
                        tile={tile}
                        presetCtx={presetCtx}
                        engineCtx={tileCtx}
                        span={tileSpan(tile)}
                        onRemove={() => mutateDash((ts) => ts.filter((t) => t.id !== tile.id))}
                        onRefresh={() => setJitters((j) => ({ ...j, [tile.id]: (j[tile.id] ?? 0) + 1 }))}
                        onExport={() => toast(`Export queued (mock) — ${label}.csv`)}
                        onEdit={() => tile.kind === 'custom' && setBuilder({ initial: tile.report, tileId: tile.id })}
                        onCross={toggleCross}
                        onViewRecords={() => tile.kind === 'custom' && setDrill({ config: tile.report, bucketKey: null, bucketLabel: tile.report.title })}
                        onDuplicate={() => mutateDash((ts) => {
                          const idx = ts.findIndex((t) => t.id === tile.id);
                          const clone: Tile = tile.kind === 'custom'
                            ? { id: tid(), kind: 'custom', report: { ...tile.report, id: uid('rep') }, span: tile.span }
                            : { id: tid(), kind: 'preset', preset: tile.preset, span: tile.span };
                          const next = [...ts];
                          next.splice(idx + 1, 0, clone);
                          return next;
                        })}
                        onResize={(s) => mutateDash((ts) => ts.map((t) => (t.id === tile.id ? { ...t, span: s } : t)))}
                        onMaximize={() => setMaximized(tile.id)}
                        dragging={dragKey === tile.id}
                        dropTarget={dropKey === tile.id && dragKey !== tile.id}
                        onDragStart={() => setDragKey(tile.id)}
                        onDragEnter={() => {
                          if (dragKey && dragKey !== tile.id) {
                            setDropKey(tile.id);
                            reorder(dragKey, tile.id);
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
          present={new Set(dash.tiles.filter((t) => t.kind === 'preset').map((t) => (t as { preset: string }).preset))}
          onClose={() => setAddOpen(false)}
          onAdd={(key) => {
            mutateDash((ts) => [...ts, presetTile(key)]);
            setAddOpen(false);
            toast(`${WIDGETS[key].title} added to ${dash.name}`);
          }}
        />
      )}

      {builder && (
        <ReportBuilder
          ctx={engineCtx}
          initial={builder.initial}
          onSave={saveReport}
          onClose={() => setBuilder(null)}
        />
      )}

      {drill && <DrillPanel target={drill} ctx={engineCtx} onClose={() => setDrill(null)} />}

      {aiOpen && (
        <AiPanel
          deals={deals}
          bounds={bounds}
          now={now}
          onCross={(c) => { toggleCross(c.field, c.value, c.label); }}
          onToast={toast}
          onClose={() => setAiOpen(false)}
        />
      )}

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}

      {maximized && (() => {
        const t = dash.tiles.find((x) => x.id === maximized);
        if (!t) return null;
        const label = t.kind === 'custom' ? t.report.title : WIDGETS[t.preset]?.title ?? 'Report';
        const mCtx: Ctx = { deals, activities: data.activities, bounds, filters, now, rep, jit: globalJit, seed };
        return (
          <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && setMaximized(null)}>
            <div className="cd-modal" role="dialog" aria-label={label} style={{ width: 'min(1100px, 100%)', maxHeight: '88vh' }}>
              <div className="cd-modal-head">
                <h2 style={{ flex: 1 }}>{label}</h2>
                <button className="cd-iconbtn" onClick={() => setMaximized(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <div className="cd-modal-body" style={{ minHeight: 360 }}>
                {t.kind === 'custom'
                  ? <ReportView config={t.report} ctx={engineCtx} onCross={toggleCross} />
                  : WIDGETS[t.preset]?.render(mCtx)}
              </div>
            </div>
          </div>
        );
      })()}

      {importOpen && (
        <ImportModal
          now={now}
          imported={!!imported}
          onApply={applyImport}
          onReset={resetData}
          onClose={() => setImportOpen(false)}
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
