// ---------------------------------------------------------------------------
// Generic renderer: takes any ReportConfig, runs it through the engine, and
// draws the configured visualization. One component covers every chart type,
// so a user-built report and a preset tile render through the same path.
// Clicking a data point drills through to the underlying records.
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
  onDrill,
}: {
  config: ReportConfig;
  ctx: EngineCtx;
  onDrill?: (t: DrillTarget) => void;
}) {
  const res = useMemo(() => runReport(config, ctx), [config, ctx]);
  const fmt = (v: number) => fmtByUnit(v, res.unit);
  const fmtFull = (v: number) => fmtByUnit(v, res.unit, false);
  const drill = (key: string | null, label: string) => onDrill?.({ config, bucketKey: key, bucketLabel: label });

  // ---- KPI ----
  if (config.viz === 'kpi') return <KpiView config={config} res={res} fmt={fmt} onDrill={() => drill(null, config.title)} />;

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
                onClick={() => drill(p.key, p.label)}
                style={{ cursor: onDrill ? 'pointer' : 'default' }}
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
                onClick={(_, i) => drill(data[i].key, data[i].name)}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={seriesColor(i)} cursor={onDrill ? 'pointer' : 'default'} />
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
              <tr key={d.key} style={{ cursor: onDrill ? 'pointer' : 'default' }} onClick={() => drill(d.key, d.name)}>
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
                style={{ cursor: onDrill ? 'pointer' : 'default' }}
                onClick={() => drill(p.key, p.label)}
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
  const clickPoint = (idx: number) => drill(res.points[idx]?.key ?? null, res.points[idx]?.label ?? '');

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
              <Bar key={k} dataKey={k} name={multi ? k : measureLabel(config)} stackId={multi ? 's' : undefined} fill={seriesColor(i)} maxBarSize={18} radius={multi ? 0 : [0, 4, 4, 0]} onClick={(_, idx) => clickPoint(idx)} cursor={onDrill ? 'pointer' : 'default'}>
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
              <Bar key={k} dataKey={k} name={multi ? k : measureLabel(config)} stackId={multi ? 's' : undefined} fill={seriesColor(i)} maxBarSize={34} radius={multi ? 0 : [4, 4, 0, 0]} onClick={(_, idx) => clickPoint(idx)} cursor={onDrill ? 'pointer' : 'default'} />
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
  onDrill,
}: {
  config: ReportConfig;
  res: ReportResult;
  fmt: (v: number) => string;
  onDrill: () => void;
}) {
  const rule = evalRules(res.value, config.rules);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }} onClick={onDrill}>
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

export function measureLabel(config: ReportConfig): string {
  const m = config.measure;
  if (m.agg === 'count') return `Count of ${OBJECTS[config.object].label.toLowerCase()}`;
  if (m.agg === 'winRate') return 'Win rate';
  const f = OBJECTS[config.object].fields.find((x) => x.key === m.field);
  const aggWord: Record<string, string> = { sum: 'Total', avg: 'Average', min: 'Min', max: 'Max', median: 'Median', countUnique: 'Unique' };
  return `${aggWord[m.agg] ?? ''} ${f?.label ?? ''}`.trim();
}
