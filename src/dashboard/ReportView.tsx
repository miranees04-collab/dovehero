// ---------------------------------------------------------------------------
// Generic renderer: takes any ReportConfig, runs it through the engine, and
// draws the configured visualization. One component covers every chart type,
// so a user-built report and a preset tile render through the same path.
// Clicking a categorical data point cross-filters the whole dashboard.
// ---------------------------------------------------------------------------
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import {
  AXIS_TICK,
  AXIS_LINE,
  ChartTip,
  Empty,
  LegendChips,
  StatTile,
  Delta,
  Gauge,
  FUNNEL,
  seriesColor,
} from './chartKit';
import {
  runReport,
  evalRules,
  fmtByUnit,
  OBJECTS,
  type ReportConfig,
  type EngineCtx,
  type ReportResult,
} from './reportEngine';
import { fmtPct } from './data';

export interface DrillTarget {
  config: ReportConfig;
  bucketKey: string | null; // dimension bucket clicked; null = whole report
  bucketLabel: string;
}

export function ReportView({
  config,
  ctx,
  onCross,
}: {
  config: ReportConfig;
  ctx: EngineCtx;
  onCross?: (field: string, value: string, label: string) => void;
}) {
  const res = useMemo(() => runReport(config, ctx), [config, ctx]);
  const fmt = (v: number) => fmtByUnit(v, res.unit);
  const fmtFull = (v: number) => fmtByUnit(v, res.unit, false);

  // Clicking a categorical mark cross-filters the dashboard by that value.
  const dimF = config.dimension && OBJECTS[config.object].fields.find((f) => f.key === config.dimension!.field);
  const canCross = !!onCross && !!dimF && dimF.type !== 'date';
  const cross = (key: string, label: string) => {
    if (canCross && key && !key.startsWith('__') && key !== 'Other' && key !== '—') onCross!(dimF!.key, key, label);
  };
  const cursor = canCross ? 'pointer' : 'default';

  // ---- KPI ----
  if (config.viz === 'kpi') return <KpiView config={config} res={res} fmt={fmt} />;

  // ---- Gauge ----
  if (config.viz === 'gauge') {
    const target = config.goal || res.value || 1;
    const rule = evalRules(res.value, config.rules);
    return (
      <Gauge
        value={res.value}
        target={target}
        projected={null}
        fmt={fmt}
        tone={rule?.tone === 'good' ? 'good' : rule?.tone ? 'bad' : undefined}
        caption={config.goal ? 'Actual vs target' : 'Set a target in the report settings'}
      />
    );
  }

  // ---- Cohort retention heatmap ----
  if (config.viz === 'cohort') {
    if (!res.cohort || res.cohort.every((r) => r.base === 0)) return <Empty msg="No cohorts in range" />;
    return <CohortView res={res} />;
  }

  // ---- Scatter / quadrant ----
  if (config.viz === 'scatter') {
    if (!res.scatter || res.scatter.length === 0) return <Empty />;
    return <ScatterView config={config} res={res} />;
  }

  if (res.points.length === 0) return <Empty />;

  // ---- Funnel ----
  if (config.viz === 'funnel') {
    const max = res.points[0]?.value || 1;
    return (
      <div className="cd-funnel">
        {res.points.map((p, i) => {
          const conv = i > 0 && res.points[i - 1].value > 0 ? p.value / res.points[i - 1].value : null;
          return (
            <div key={p.key}>
              {i > 0 && (
                <div className="cd-funnel-conv">
                  <span>↓ {conv === null ? '—' : fmtPct(conv)}</span>
                </div>
              )}
              <div
                className="cd-funnel-row"
                onClick={() => cross(p.key, p.label)}
                style={{ cursor }}
                title={`${p.label}: ${p.value}`}
              >
                <span className="cd-funnel-stage">{p.label}</span>
                <span className="cd-funnel-barwrap">
                  <span className="cd-funnel-bar" style={{ width: `${Math.max(4, (p.value / max) * 100)}%`, background: FUNNEL[i % FUNNEL.length] }} />
                </span>
                <span className="cd-funnel-count">{p.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- Pie / Donut ----
  if (config.viz === 'pie' || config.viz === 'donut') {
    const data = res.points.map((p) => ({ name: p.label, value: p.value, key: p.key }));
    const total = res.total || 1;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 158, height: 158, flex: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={config.viz === 'donut' ? 50 : 0}
                outerRadius={76}
                paddingAngle={1.5}
                stroke="var(--surface)"
                strokeWidth={2}
                onClick={(_, i) => cross(data[i].key, data[i].name)}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={seriesColor(i)} cursor={cursor} />
                ))}
              </Pie>
              <Tooltip content={<ChartTip fmt={fmtFull} />} />
            </PieChart>
          </ResponsiveContainer>
          {config.viz === 'donut' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 650, lineHeight: 1 }}>{fmt(res.total)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>total</div>
              </div>
            </div>
          )}
        </div>
        <table className="cd-table" style={{ flex: 1, minWidth: 150 }}>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.key} style={{ cursor }} onClick={() => cross(d.key, d.name)}>
                <td style={{ padding: '5px 6px' }}>
                  <span className="cd-legend" style={{ padding: 0 }}>
                    <span className="key">
                      <span className="swatch" style={{ background: seriesColor(i) }} />
                      {d.name}
                    </span>
                  </span>
                </td>
                <td className="num" style={{ padding: '5px 6px', fontWeight: 600 }}>{fmt(d.value)}</td>
                <td className="num" style={{ padding: '5px 6px', color: 'var(--muted)' }}>{fmtPct(d.value / total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ---- Table / Matrix (Zoho-style cross-tab when a breakdown is set) ----
  if (config.viz === 'table' || config.viz === 'leaderboard') {
    const isMatrix = config.breakdown && res.seriesKeys[0] !== 'value';
    const dimLabel = OBJECTS[config.object].fields.find((f) => f.key === config.dimension?.field)?.label ?? 'Group';
    const rank = config.viz === 'leaderboard';
    return (
      <div className="cd-tablewrap">
        <table className="cd-table">
          <thead>
            <tr>
              {rank && <th className="num" style={{ width: 30 }}>#</th>}
              <th>{dimLabel}</th>
              {isMatrix ? (
                res.seriesKeys.map((k) => <th key={k} className="num">{k}</th>)
              ) : (
                <th className="num">{measureLabel(config)}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {res.points.map((p, i) => (
              <tr
                key={p.key}
                className={rank && i === 0 ? 'top' : ''}
                style={{ cursor }}
                onClick={() => cross(p.key, p.label)}
              >
                {rank && <td className="num" style={{ color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</td>}
                <td style={{ fontWeight: rank ? 600 : 400 }}>{p.label}</td>
                {isMatrix ? (
                  res.seriesKeys.map((k) => <td key={k} className="num">{fmt(p.series[k] ?? 0)}</td>)
                ) : (
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(p.value)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ---- Bar / Horizontal bar / Line / Area ----
  const multi = config.breakdown && res.seriesKeys[0] !== 'value';
  const chartData = res.points.map((p) => ({ label: p.label, key: p.key, ...(multi ? p.series : { value: p.value }) }));
  const keys = multi ? res.seriesKeys : ['value'];
  const legendItems = multi
    ? keys.map((k, i) => ({ label: k, color: seriesColor(i), kind: (config.viz === 'line' || config.viz === 'area' ? 'line' : 'rect') as 'line' | 'rect' }))
    : [];
  const clickPoint = (idx: number) => cross(res.points[idx]?.key ?? '', res.points[idx]?.label ?? '');

  return (
    <div>
      {multi && <LegendChips items={legendItems} />}
      <ResponsiveContainer width="100%" height={multi ? 208 : 224}>
        {config.viz === 'hbar' ? (
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 52, top: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="label" width={96} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={fmtFull} />} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} name={multi ? k : measureLabel(config)} stackId={multi ? 's' : undefined} fill={seriesColor(i)} maxBarSize={18} radius={multi ? 0 : [0, 4, 4, 0]} onClick={(_, idx) => clickPoint(idx)} cursor={cursor}>
                {!multi && <LabelList dataKey="value" position="right" formatter={(v) => fmt(Number(v))} style={{ fill: 'var(--ink-2)', fontSize: 11 }} />}
              </Bar>
            ))}
          </BarChart>
        ) : config.viz === 'bar' ? (
          <BarChart data={chartData} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} angle={chartData.length > 6 ? -20 : 0} textAnchor={chartData.length > 6 ? 'end' : 'middle'} height={chartData.length > 6 ? 40 : 30} />
            <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={fmt} width={44} />
            <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTip fmt={fmtFull} />} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} name={multi ? k : measureLabel(config)} stackId={multi ? 's' : undefined} fill={seriesColor(i)} maxBarSize={34} radius={multi ? 0 : [4, 4, 0, 0]} onClick={(_, idx) => clickPoint(idx)} cursor={cursor} />
            ))}
          </BarChart>
        ) : config.viz === 'line' ? (
          <LineChart data={chartData} margin={{ left: -18, right: 12, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={20} />
            <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={fmt} width={44} />
            <Tooltip cursor={{ stroke: 'var(--axis)' }} content={<ChartTip fmt={fmtFull} />} />
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} name={multi ? k : measureLabel(config)} stroke={seriesColor(i)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={chartData} margin={{ left: -18, right: 12, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={20} />
            <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={fmt} width={44} />
            <Tooltip cursor={{ stroke: 'var(--axis)' }} content={<ChartTip fmt={fmtFull} />} />
            {keys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} name={multi ? k : measureLabel(config)} stackId={multi ? 's' : undefined} stroke={seriesColor(i)} strokeWidth={2} fill={seriesColor(i)} fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function KpiView({
  config,
  res,
  fmt,
}: {
  config: ReportConfig;
  res: ReportResult;
  fmt: (v: number) => string;
}) {
  const rule = evalRules(res.value, config.rules);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <StatTile label={measureLabel(config)} value={fmt(res.value)}>
        {config.compare && res.prevValue !== null ? (
          <Delta cur={res.value} prev={res.prevValue} hasPrev suffix="vs prev period" />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{res.rowCount.toLocaleString()} records</span>
        )}
        {rule && (
          <span className={`cd-pill ${rule.tone === 'good' ? 'good' : 'bad'}`} style={{ marginTop: 6 }}>
            {rule.label || (rule.tone === 'good' ? 'On track' : 'Needs attention')}
          </span>
        )}
      </StatTile>
    </div>
  );
}

export function measureLabel(config: ReportConfig, m: typeof config.measure = config.measure): string {
  if (m.agg === 'count') return `Count of ${OBJECTS[config.object].label.toLowerCase()}`;
  if (m.agg === 'winRate') return 'Win rate';
  const f = OBJECTS[config.object].fields.find((x) => x.key === m.field);
  const aggWord: Record<string, string> = { sum: 'Total', avg: 'Average', min: 'Min', max: 'Max', median: 'Median', countUnique: 'Unique' };
  return `${aggWord[m.agg] ?? ''} ${f?.label ?? ''}`.trim();
}

// --- Scatter / quadrant ------------------------------------------------------

function ScatterView({ config, res }: { config: ReportConfig; res: ReportResult }) {
  const pts = res.scatter!;
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const median = (arr: number[]) => arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  const mx = median(xs);
  const my = median(ys);
  const fx = (v: number) => fmtByUnit(v, res.unit, false);
  const fy = (v: number) => fmtByUnit(v, res.unitY ?? 'int', false);
  const xLabel = measureLabel(config);
  const yLabel = config.measureY ? measureLabel(config, config.measureY) : 'Y';
  return (
    <div>
      <div className="cd-fnote" style={{ margin: '0 0 4px' }}>Each point is one {OBJECTS[config.object].singular === 'deal' ? config.dimension?.field : OBJECTS[config.object].singular}. Lines mark the medians → four performance quadrants.</div>
      <ResponsiveContainer width="100%" height={230}>
        <ScatterChart margin={{ left: -4, right: 14, top: 10, bottom: 6 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v) => fmtByUnit(Number(v), res.unit)} />
          <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v) => fmtByUnit(Number(v), res.unitY ?? 'int')} width={46} />
          <ZAxis type="number" dataKey="n" range={[60, 340]} name="records" />
          <ReferenceLine x={mx} stroke="var(--axis)" strokeDasharray="4 3" />
          <ReferenceLine y={my} stroke="var(--axis)" strokeDasharray="4 3" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as typeof pts[number];
              return (
                <div className="cd-tip">
                  <div className="t">{d.label} · {d.n} records</div>
                  <div className="row"><span className="k" style={{ borderTopColor: 'var(--s1)' }} /><b>{fx(d.x)}</b><span>{xLabel}</span></div>
                  <div className="row"><span className="k" style={{ borderTopColor: 'var(--s1)' }} /><b>{fy(d.y)}</b><span>{yLabel}</span></div>
                </div>
              );
            }}
          />
          <Scatter data={pts} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2}>
            <LabelList dataKey="label" position="top" style={{ fill: 'var(--ink-2)', fontSize: 10.5 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Cohort retention heatmap -----------------------------------------------

function CohortView({ res }: { res: ReportResult }) {
  const rows = res.cohort!;
  const cols = res.cohortCols!;
  // Sequential blue ramp (validated ordinal steps), light→dark by magnitude.
  const RAMP = ['#e8f1fd', '#cfe0f9', '#a9c8f1', '#7db0ea', '#4f95e6', '#2a78d6'];
  const cellColor = (pct: number) => RAMP[Math.min(RAMP.length - 1, Math.floor((pct / 100) * RAMP.length))];
  const ink = (pct: number) => (pct >= 55 ? '#fff' : 'var(--ink)');
  return (
    <div className="cd-tablewrap">
      <div className="cd-fnote" style={{ margin: '0 0 6px' }}>Cumulative win rate of each create-month cohort, by months since created.</div>
      <table className="cd-cohort">
        <thead>
          <tr>
            <th>Cohort</th>
            <th className="num">Deals</th>
            {cols.map((c) => <th key={c} className="num">{c}mo</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num" style={{ color: 'var(--muted)' }}>{r.base}</td>
              {r.cells.map((v, i) => (
                <td key={i} className="cd-cohort-cell">
                  {v === null ? (
                    <span className="cd-cohort-empty" />
                  ) : (
                    <span className="cd-cohort-fill" style={{ background: cellColor(v), color: ink(v) }}>{Math.round(v)}%</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
