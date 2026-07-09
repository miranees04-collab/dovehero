// ---------------------------------------------------------------------------
// Custom report builder — the HubSpot/Pipedrive-style flow to build a report
// from scratch: pick a data source, a visualization, a measure ("Measure by"),
// a group-by dimension ("View by") and optional series ("Break down by"),
// typed filters with AND-within-group / OR-across-groups logic, sort & limit,
// a goal/target, compare-to-previous, and threshold rules — with a live preview.
// Starts from a template gallery you can clone.
// ---------------------------------------------------------------------------
import { useState, type ReactNode } from 'react';
import {
  BarChart3, BarChartHorizontal, LineChart, AreaChart, PieChart, CircleDashed,
  Gauge, Hash, Table2, Filter, Plus, Trash2, X, Check, ChevronLeft, Sparkles,
  TrendingUp, Users, DollarSign, Trophy, Timer, Target, ArrowRight, Grid2x2, Grid3x3,
} from 'lucide-react';
import { ReportView } from './ReportView';
import {
  OBJECTS, OPERATORS_BY_TYPE, AGG_LABELS, measureUnit, uid,
  type ReportConfig, type EngineCtx, type ObjectKey, type ObjectDef, type Viz, type Aggregation,
  type FilterRule, type FilterGroup, type ThresholdRule, type Operator, type DateGrain,
} from './reportEngine';
import { measureLabel } from './ReportView';

const VIZ_META: Array<{ key: Viz; label: string; icon: ReactNode }> = [
  { key: 'kpi', label: 'Single value', icon: <Hash size={16} /> },
  { key: 'gauge', label: 'Gauge', icon: <Gauge size={16} /> },
  { key: 'pace', label: 'Goal pacing', icon: <Target size={16} /> },
  { key: 'bar', label: 'Vertical bar', icon: <BarChart3 size={16} /> },
  { key: 'hbar', label: 'Horizontal bar', icon: <BarChartHorizontal size={16} /> },
  { key: 'line', label: 'Line', icon: <LineChart size={16} /> },
  { key: 'area', label: 'Area', icon: <AreaChart size={16} /> },
  { key: 'combo', label: 'Combination', icon: <TrendingUp size={16} /> },
  { key: 'pie', label: 'Pie', icon: <PieChart size={16} /> },
  { key: 'donut', label: 'Donut', icon: <CircleDashed size={16} /> },
  { key: 'funnel', label: 'Funnel', icon: <Filter size={16} /> },
  { key: 'table', label: 'Table', icon: <Table2 size={16} /> },
  { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={16} /> },
  { key: 'scatter', label: 'Quadrant', icon: <Grid2x2 size={16} /> },
  { key: 'cohort', label: 'Cohort', icon: <Grid3x3 size={16} /> },
];

const AGG_OPTIONS: Aggregation[] = ['count', 'sum', 'avg', 'median', 'min', 'max', 'countUnique', 'winRate'];

// A tile's grid width chosen to suit the viz.
const DEFAULT_SPAN: Record<Viz, ReportConfig['span']> = {
  kpi: 3, gauge: 4, pace: 3, bar: 6, hbar: 6, line: 8, area: 8, combo: 8, pie: 4, donut: 4, funnel: 4, table: 6, leaderboard: 7, scatter: 6, cohort: 8,
};

export function blankConfig(): ReportConfig {
  return {
    id: uid('rep'),
    title: 'Untitled report',
    object: 'deals',
    viz: 'bar',
    measure: { agg: 'count' },
    dimension: { field: 'stage' },
    breakdown: null,
    filterGroups: [{ id: uid('g'), filters: [] }],
    dateField: 'createdAt',
    sort: 'natural',
    limit: 10,
    goal: null,
    compare: false,
    rules: [],
    span: 6,
  };
}

// Clone-to-start templates (Pipedrive-style report-type gallery).
interface Template { key: string; name: string; desc: string; icon: ReactNode; make: () => ReportConfig; }

const TEMPLATES: Template[] = [
  {
    key: 'rev-month', name: 'Revenue by month', desc: 'Closed-won amount trended by close month', icon: <TrendingUp size={16} />,
    make: () => ({ ...blankConfig(), title: 'Revenue by month', viz: 'area', span: 8, measure: { agg: 'sum', field: 'amount' }, dimension: { field: 'closedAt', grain: 'month' }, dateField: 'closedAt', filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }], sort: 'label-asc' }),
  },
  {
    key: 'deals-stage', name: 'Deals by stage', desc: 'Count of deals in each pipeline stage', icon: <BarChart3 size={16} />,
    make: () => ({ ...blankConfig(), title: 'Deals by stage', viz: 'bar', span: 6, measure: { agg: 'count' }, dimension: { field: 'stage' }, sort: 'natural' }),
  },
  {
    key: 'pipeline-value', name: 'Open pipeline by stage', desc: 'Sum of open deal value per stage', icon: <DollarSign size={16} />,
    make: () => ({ ...blankConfig(), title: 'Open pipeline by stage', viz: 'hbar', span: 6, measure: { agg: 'sum', field: 'amount' }, dimension: { field: 'stage' }, dateField: null, filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['open'] }] }], sort: 'natural' }),
  },
  {
    key: 'winrate-rep', name: 'Win rate by rep', desc: 'Calculated win rate for each owner', icon: <Users size={16} />,
    make: () => ({ ...blankConfig(), title: 'Win rate by rep', viz: 'bar', span: 6, measure: { agg: 'winRate' }, dimension: { field: 'owner' }, dateField: 'closedAt', sort: 'value-desc', rules: [] }),
  },
  {
    key: 'source', name: 'Deals by source', desc: 'Where deals originate, as a donut', icon: <PieChart size={16} />,
    make: () => ({ ...blankConfig(), title: 'Deals by source', viz: 'donut', span: 4, measure: { agg: 'count' }, dimension: { field: 'source' }, sort: 'value-desc', limit: 6 }),
  },
  {
    key: 'funnel', name: 'Deal funnel', desc: 'Stage-to-stage conversion', icon: <Filter size={16} />,
    make: () => ({ ...blankConfig(), title: 'Deal funnel', viz: 'funnel', span: 4, measure: { agg: 'count' }, dimension: { field: 'stage' }, sort: 'natural' }),
  },
  {
    key: 'leaderboard', name: 'Rep leaderboard', desc: 'Reps ranked by closed-won value', icon: <Trophy size={16} />,
    make: () => ({ ...blankConfig(), title: 'Rep leaderboard', viz: 'leaderboard', span: 7, measure: { agg: 'sum', field: 'amount' }, dimension: { field: 'owner' }, dateField: 'closedAt', filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }], sort: 'value-desc' }),
  },
  {
    key: 'velocity', name: 'Sales velocity by rep', desc: 'Average days to close per owner', icon: <Timer size={16} />,
    make: () => ({ ...blankConfig(), title: 'Avg days to close by rep', viz: 'bar', span: 6, measure: { agg: 'avg', field: 'daysToClose' }, dimension: { field: 'owner' }, dateField: 'closedAt', filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }], sort: 'value-asc' }),
  },
  {
    key: 'matrix', name: 'Stage × source matrix', desc: 'Cross-tab of deal count', icon: <Table2 size={16} />,
    make: () => ({ ...blankConfig(), title: 'Deals by stage and source', viz: 'table', span: 8, measure: { agg: 'count' }, dimension: { field: 'stage' }, breakdown: { field: 'source' }, sort: 'natural' }),
  },
  {
    key: 'goal', name: 'Revenue vs goal', desc: 'Closed-won against a target gauge', icon: <Target size={16} />,
    make: () => ({ ...blankConfig(), title: 'Revenue vs goal', viz: 'gauge', span: 4, measure: { agg: 'sum', field: 'amount' }, dimension: null, dateField: 'closedAt', goal: 1_200_000, filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }], rules: [{ id: uid('rl'), op: 'lt', value: 900_000, tone: 'bad', label: 'Behind target' }] }),
  },
  {
    key: 'quadrant', name: 'Rep performance quadrant', desc: 'Deal size vs win rate, split into zones', icon: <Grid2x2 size={16} />,
    make: () => ({ ...blankConfig(), title: 'Deal size vs win rate by rep', viz: 'scatter', span: 6, measure: { agg: 'avg', field: 'amount' }, measureY: { agg: 'winRate' }, dimension: { field: 'owner' }, dateField: 'closedAt' }),
  },
  {
    key: 'cohort', name: 'Win-rate cohorts', desc: 'Cumulative win rate by create-month cohort', icon: <Grid3x3 size={16} />,
    make: () => ({ ...blankConfig(), title: 'Win-rate cohorts', viz: 'cohort', span: 8, measure: { agg: 'count' }, dimension: null, dateField: 'createdAt' }),
  },
  {
    key: 'pace', name: 'Revenue pace to goal', desc: 'Actual vs target with projected landing', icon: <Target size={16} />,
    make: () => ({ ...blankConfig(), title: 'Revenue pace to goal', viz: 'pace', span: 4, measure: { agg: 'sum', field: 'amount' }, dimension: null, dateField: 'closedAt', goal: 1_200_000, filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }] }),
  },
  {
    key: 'combo', name: 'Revenue with trend', desc: 'Monthly columns plus a moving-average line', icon: <TrendingUp size={16} />,
    make: () => ({ ...blankConfig(), title: 'Monthly revenue with trend', viz: 'combo', span: 8, measure: { agg: 'sum', field: 'amount' }, dimension: { field: 'closedAt', grain: 'month' }, dateField: 'closedAt', filterGroups: [{ id: uid('g'), filters: [{ id: uid('f'), field: 'status', op: 'in', value: ['won'] }] }] }),
  },
  {
    key: 'anomaly', name: 'Deal-flow anomalies', desc: 'Weekly deals created with outliers flagged', icon: <AreaChart size={16} />,
    make: () => ({ ...blankConfig(), title: 'Weekly deals created (anomalies)', viz: 'area', span: 8, measure: { agg: 'count' }, dimension: { field: 'createdAt', grain: 'week' }, dateField: 'createdAt', anomalies: true }),
  },
];

// --- Small styled form controls --------------------------------------------

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="cd-frow">
      <span className="cd-flabel">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

function Sel({ value, onChange, children, title }: { value: string; onChange: (v: string) => void; children: ReactNode; title?: string }) {
  return (
    <select className="cd-select" value={value} title={title} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

// --- Builder ----------------------------------------------------------------

export function ReportBuilder({
  ctx, initial, onSave, onClose,
}: {
  ctx: EngineCtx;
  initial?: ReportConfig;
  onSave: (cfg: ReportConfig) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'gallery' | 'build'>(initial ? 'build' : 'gallery');
  const [cfg, setCfg] = useState<ReportConfig>(initial ?? blankConfig());
  const def = OBJECTS[cfg.object];
  const patch = (p: Partial<ReportConfig>) => setCfg((c) => ({ ...c, ...p }));

  const start = (c: ReportConfig) => { setCfg(c); setStage('build'); };

  const setObject = (object: ObjectKey) => {
    const d = OBJECTS[object];
    const firstGroup = d.fields.find((f) => f.groupable);
    patch({
      object,
      measure: { agg: 'count' },
      dimension: firstGroup ? { field: firstGroup.key } : null,
      breakdown: null,
      dateField: d.dateFields[0] ?? null,
      filterGroups: [{ id: uid('g'), filters: [] }],
    });
  };

  const setViz = (viz: Viz) => {
    const wantsDim = viz !== 'kpi' && viz !== 'gauge' && viz !== 'cohort' && viz !== 'pace';
    const firstEnum = def.fields.find((f) => f.groupable && f.type === 'enum');
    const firstDate = def.fields.find((f) => f.type === 'date');
    const firstGroup = def.fields.find((f) => f.groupable);
    const p: Partial<ReportConfig> = {
      viz,
      span: DEFAULT_SPAN[viz],
      dimension:
        viz === 'funnel' ? { field: 'stage' }
        : viz === 'cohort' || viz === 'pace' ? null
        : viz === 'combo' ? { field: (firstDate ?? firstGroup)?.key ?? 'createdAt', grain: 'month' }
        : wantsDim ? (cfg.dimension ?? (firstGroup ? { field: firstGroup.key } : null)) : null,
      breakdown: viz === 'funnel' || viz === 'pie' || viz === 'donut' || viz === 'scatter' || viz === 'combo' ? null : cfg.breakdown,
    };
    if (viz === 'pace') {
      p.measure = { agg: 'sum', field: def.fields.find((f) => f.measurable)?.key };
    }
    if (viz === 'combo') {
      p.measure = cfg.measure.agg === 'winRate' ? { agg: 'count' } : cfg.measure;
      p.anomalies = false;
    }
    if (viz === 'scatter') {
      // Two measures per entity; default to amount vs win-rate/count per owner.
      p.measure = { agg: 'avg', field: def.fields.find((f) => f.measurable)?.key };
      p.measureY = cfg.object === 'deals' ? { agg: 'winRate' } : { agg: 'count' };
      p.dimension = { field: (firstEnum ?? firstGroup)?.key ?? 'owner' };
    }
    if (viz === 'cohort') {
      p.object = 'deals';
      p.measure = { agg: 'count' };
      p.dateField = 'createdAt';
    }
    patch(p);
  };

  const setMeasureAgg = (agg: Aggregation) => {
    const needsField = agg !== 'count' && agg !== 'winRate';
    const field = needsField ? (cfg.measure.field ?? def.fields.find((f) => f.measurable)?.key) : undefined;
    patch({ measure: { agg, field } });
  };
  const setMeasureYAgg = (agg: Aggregation) => {
    const needsField = agg !== 'count' && agg !== 'winRate';
    const field = needsField ? (cfg.measureY?.field ?? def.fields.find((f) => f.measurable)?.key) : undefined;
    patch({ measureY: { agg, field } });
  };

  const measurable = def.fields.filter((f) => f.measurable);
  const groupable = def.fields.filter((f) => f.groupable);
  const dimField = def.fields.find((f) => f.key === cfg.dimension?.field);
  const needsField = cfg.measure.agg !== 'count' && cfg.measure.agg !== 'winRate';
  const isScatter = cfg.viz === 'scatter';
  const isCohort = cfg.viz === 'cohort';
  const showMeasure = !isCohort;
  const showDim = cfg.viz !== 'kpi' && cfg.viz !== 'gauge' && cfg.viz !== 'funnel' && cfg.viz !== 'pace' && !isCohort;
  const showBreakdown = ['bar', 'hbar', 'line', 'area', 'table'].includes(cfg.viz);
  const showSortLimit = showDim && !isScatter && cfg.viz !== 'combo' && dimField?.type !== 'date';
  const showGoal = ['gauge', 'kpi', 'pace', 'combo'].includes(cfg.viz);
  const showCompare = cfg.viz === 'kpi';
  const showRules = cfg.viz === 'kpi' || cfg.viz === 'gauge' || cfg.viz === 'pace';
  const showAnomalies = ['line', 'area'].includes(cfg.viz) && dimField?.type === 'date';
  const needsFieldY = cfg.measureY && cfg.measureY.agg !== 'count' && cfg.measureY.agg !== 'winRate';

  // ----- Gallery -----
  if (stage === 'gallery') {
    return (
      <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="cd-modal builder" role="dialog" aria-label="Create report">
          <div className="cd-modal-head">
            <Sparkles size={17} style={{ color: 'var(--accent)' }} />
            <h2>Create a report</h2>
            <button className="cd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="cd-modal-body">
            <div className="cd-builder-galtop">
              <button className="cd-btn primary" onClick={() => start(blankConfig())}>
                <Plus size={15} /> Start from scratch
              </button>
              <span className="cd-flabel" style={{ margin: 0 }}>or clone a template</span>
            </div>
            <div className="cd-widget-lib">
              {TEMPLATES.map((t) => (
                <button key={t.key} className="cd-lib-item" onClick={() => start(t.make())}>
                  <span className="nm">{t.icon}{t.name}</span>
                  <span className="ds">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----- Builder -----
  const unit = measureUnit(cfg.object, cfg.measure);
  const goalPlaceholder = unit === 'money' ? 'e.g. 1200000' : unit === 'pct' ? 'e.g. 20' : 'e.g. 100';

  return (
    <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal builder wide" role="dialog" aria-label="Build report">
        <div className="cd-modal-head">
          {!initial && (
            <button className="cd-iconbtn" onClick={() => setStage('gallery')} title="Back to templates"><ChevronLeft size={17} /></button>
          )}
          <h2>{initial ? 'Edit report' : 'Build report'}</h2>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="cd-builder-split">
          {/* config column */}
          <div className="cd-builder-config">
            <Row label="Report name">
              <input className="cd-input" value={cfg.title} onChange={(e) => patch({ title: e.target.value })} />
            </Row>

            <Row label="Data source">
              <div className="cd-seg">
                {(Object.keys(OBJECTS) as ObjectKey[]).map((k) => (
                  <button key={k} className={cfg.object === k ? 'on' : ''} onClick={() => setObject(k)}>{OBJECTS[k].label}</button>
                ))}
              </div>
            </Row>

            <Row label="Visualization">
              <div className="cd-vizgrid">
                {VIZ_META.map((v) => (
                  <button key={v.key} className={`cd-vizbtn ${cfg.viz === v.key ? 'on' : ''}`} onClick={() => setViz(v.key)} title={v.label}>
                    {v.icon}<span>{v.label}</span>
                  </button>
                ))}
              </div>
            </Row>

            <div className="cd-fsection">Measure &amp; grouping</div>

            {showMeasure && (
              <Row label={isScatter ? 'X measure' : 'Measure by'} hint="the value">
                <div className="cd-inline">
                  <Sel value={cfg.measure.agg} onChange={(v) => setMeasureAgg(v as Aggregation)}>
                    {AGG_OPTIONS.filter((a) => a !== 'winRate' || cfg.object === 'deals').map((a) => (
                      <option key={a} value={a}>{a === 'count' ? `Count of ${def.label.toLowerCase()}` : AGG_LABELS[a].replace(' of', '')}</option>
                    ))}
                  </Sel>
                  {needsField && (
                    <Sel value={cfg.measure.field ?? ''} onChange={(v) => patch({ measure: { ...cfg.measure, field: v } })}>
                      {measurable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </Sel>
                  )}
                </div>
              </Row>
            )}

            {isScatter && (
              <Row label="Y measure" hint="second axis">
                <div className="cd-inline">
                  <Sel value={cfg.measureY?.agg ?? 'count'} onChange={(v) => setMeasureYAgg(v as Aggregation)}>
                    {AGG_OPTIONS.filter((a) => a !== 'winRate' || cfg.object === 'deals').map((a) => (
                      <option key={a} value={a}>{a === 'count' ? `Count of ${def.label.toLowerCase()}` : AGG_LABELS[a].replace(' of', '')}</option>
                    ))}
                  </Sel>
                  {needsFieldY && (
                    <Sel value={cfg.measureY?.field ?? ''} onChange={(v) => patch({ measureY: { ...cfg.measureY!, field: v } })}>
                      {measurable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </Sel>
                  )}
                </div>
              </Row>
            )}

            {cfg.viz === 'funnel' && <p className="cd-fnote">Funnel always groups by deal stage and shows cumulative reach.</p>}
            {isCohort && <p className="cd-fnote">Cohort groups deals by their create month and tracks cumulative win rate across the following months — no other setup needed.</p>}

            {showDim && (
              <Row label={isScatter ? 'Plot each' : 'View by'} hint={isScatter ? 'one point per' : 'group / X-axis'}>
                <div className="cd-inline">
                  <Sel value={cfg.dimension?.field ?? ''} onChange={(v) => patch({ dimension: { field: v, grain: def.fields.find((f) => f.key === v)?.type === 'date' ? 'month' : undefined } })}>
                    {(isScatter ? groupable.filter((f) => f.type !== 'date') : groupable).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </Sel>
                  {!isScatter && dimField?.type === 'date' && (
                    <Sel value={cfg.dimension?.grain ?? 'month'} onChange={(v) => patch({ dimension: { ...cfg.dimension!, grain: v as DateGrain } })}>
                      {(['day', 'week', 'month', 'quarter'] as DateGrain[]).map((g) => <option key={g} value={g}>by {g}</option>)}
                    </Sel>
                  )}
                </div>
              </Row>
            )}

            {showBreakdown && (
              <Row label="Break down by" hint="series / stack">
                <Sel value={cfg.breakdown?.field ?? ''} onChange={(v) => patch({ breakdown: v ? { field: v } : null })}>
                  <option value="">None</option>
                  {groupable.filter((f) => f.key !== cfg.dimension?.field && f.type !== 'date').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </Sel>
              </Row>
            )}

            {showSortLimit && (
              <div className="cd-inline">
                <Row label="Sort">
                  <Sel value={cfg.sort} onChange={(v) => patch({ sort: v as ReportConfig['sort'] })}>
                    {dimField?.options && <option value="natural">Group order</option>}
                    <option value="value-desc">Value, high → low</option>
                    <option value="value-asc">Value, low → high</option>
                    <option value="label-asc">Label, A → Z</option>
                  </Sel>
                </Row>
                <Row label="Limit (top N)">
                  <input className="cd-input" type="number" min={1} max={50} value={cfg.limit} onChange={(e) => patch({ limit: Math.max(1, Number(e.target.value) || 10) })} />
                </Row>
              </div>
            )}

            {showGoal && (
              <Row label="Target / goal" hint="optional">
                <input className="cd-input" type="number" placeholder={goalPlaceholder} value={cfg.goal ?? ''} onChange={(e) => patch({ goal: e.target.value === '' ? null : Number(e.target.value) })} />
              </Row>
            )}

            {showCompare && (
              <label className="cd-check">
                <input type="checkbox" checked={!!cfg.compare} onChange={(e) => patch({ compare: e.target.checked })} />
                Compare to previous period
              </label>
            )}

            {showAnomalies && (
              <label className="cd-check">
                <input type="checkbox" checked={!!cfg.anomalies} onChange={(e) => patch({ anomalies: e.target.checked })} />
                Highlight anomalies (trailing mean ± 1.8σ)
              </label>
            )}

            <div className="cd-fsection">Date range property</div>
            <Row label="Filter this report's date by">
              <Sel value={cfg.dateField ?? ''} onChange={(v) => patch({ dateField: v || null })}>
                {def.dateFields.map((k) => <option key={k} value={k}>{def.fields.find((f) => f.key === k)?.label}</option>)}
                <option value="">Don't filter by date (snapshot)</option>
              </Sel>
            </Row>

            <FilterEditor def={def} groups={cfg.filterGroups} onChange={(g) => patch({ filterGroups: g })} />

            {showRules && <RuleEditor rules={cfg.rules} unit={unit} onChange={(r) => patch({ rules: r })} />}
          </div>

          {/* preview column */}
          <div className="cd-builder-preview">
            <div className="cd-flabel">Live preview <em>{measureLabel(cfg)}</em></div>
            <div className="cd-preview-card">
              <div className="cd-card-head" style={{ padding: '10px 12px 0' }}>
                <span className="cd-card-title">{cfg.title || 'Untitled report'}</span>
              </div>
              <div className="cd-card-body">
                <ReportView config={cfg} ctx={ctx} />
              </div>
            </div>
            <p className="cd-fnote">Preview reflects the dashboard's current global filters. Reports recompute live as those change.</p>
            <div className="cd-builder-actions">
              <button className="cd-btn ghost" onClick={onClose}>Cancel</button>
              <button className="cd-btn primary" onClick={() => onSave(cfg)}>
                <Check size={15} /> {initial ? 'Save changes' : 'Add to dashboard'} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Filter editor (AND within a group, OR across groups) -------------------

function FilterEditor({ def, groups, onChange }: { def: ObjectDef; groups: FilterGroup[]; onChange: (g: FilterGroup[]) => void }) {
  const addFilter = (gi: number) => {
    const f = def.fields[0];
    const rule: FilterRule = { id: uid('f'), field: f.key, op: OPERATORS_BY_TYPE[f.type][0].op, value: f.type === 'enum' ? [] : '' };
    onChange(groups.map((g, i) => (i === gi ? { ...g, filters: [...g.filters, rule] } : g)));
  };
  const addGroup = () => onChange([...groups, { id: uid('g'), filters: [] }]);
  const setRule = (gi: number, ri: number, r: FilterRule) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, filters: g.filters.map((f, j) => (j === ri ? r : f)) } : g)));
  const delRule = (gi: number, ri: number) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, filters: g.filters.filter((_, j) => j !== ri) } : g)));
  const delGroup = (gi: number) => onChange(groups.filter((_, i) => i !== gi).length ? groups.filter((_, i) => i !== gi) : [{ id: uid('g'), filters: [] }]);

  return (
    <div className="cd-filters-editor">
      <div className="cd-fsection" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Filter size={13} /> Filters
        <span className="cd-fhint">match ALL in a group · ANY group</span>
      </div>
      {groups.map((g, gi) => (
        <div key={g.id}>
          {gi > 0 && <div className="cd-orbar"><span>OR</span></div>}
          <div className="cd-fgroup">
            {g.filters.length === 0 && <div className="cd-fempty">No conditions — add one to narrow this group.</div>}
            {g.filters.map((f, ri) => (
              <div key={f.id}>
                {ri > 0 && <span className="cd-andtag">AND</span>}
                <FilterRuleRow def={def} rule={f} onChange={(r) => setRule(gi, ri, r)} onDelete={() => delRule(gi, ri)} />
              </div>
            ))}
            <div className="cd-frow-actions">
              <button className="cd-linkbtn" onClick={() => addFilter(gi)}><Plus size={13} /> Add condition</button>
              {groups.length > 1 && <button className="cd-linkbtn danger" onClick={() => delGroup(gi)}><Trash2 size={13} /> Remove group</button>}
            </div>
          </div>
        </div>
      ))}
      <button className="cd-linkbtn" style={{ marginTop: 8 }} onClick={addGroup}><Plus size={13} /> Add OR group</button>
    </div>
  );
}

function FilterRuleRow({ def, rule, onChange, onDelete }: {
  def: ObjectDef; rule: FilterRule; onChange: (r: FilterRule) => void; onDelete: () => void;
}) {
  const field = def.fields.find((f) => f.key === rule.field) ?? def.fields[0];
  const ops = OPERATORS_BY_TYPE[field.type];
  const setField = (key: string) => {
    const f = def.fields.find((x) => x.key === key)!;
    onChange({ ...rule, field: key, op: OPERATORS_BY_TYPE[f.type][0].op, value: f.type === 'enum' ? [] : '', value2: undefined });
  };
  const needsVal = rule.op !== 'known' && rule.op !== 'unknown';
  const toggleEnum = (opt: string) => {
    const cur = Array.isArray(rule.value) ? rule.value : [];
    onChange({ ...rule, value: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] });
  };

  return (
    <div className="cd-filterrow">
      <Sel value={rule.field} onChange={setField}>
        {def.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </Sel>
      <Sel value={rule.op} onChange={(v) => onChange({ ...rule, op: v as Operator })}>
        {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </Sel>
      {needsVal && field.type === 'enum' && (
        <div className="cd-chips">
          {(field.options ?? []).map((opt) => (
            <button key={opt} className={`cd-chip ${Array.isArray(rule.value) && rule.value.includes(opt) ? 'on' : ''}`} onClick={() => toggleEnum(opt)}>{opt}</button>
          ))}
        </div>
      )}
      {needsVal && (field.type === 'number' || field.type === 'currency' || field.type === 'duration') && (
        <div className="cd-inline">
          <input className="cd-input" type="number" placeholder="value" value={rule.value as number ?? ''} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} />
          {rule.op === 'between' && <input className="cd-input" type="number" placeholder="and" value={rule.value2 ?? ''} onChange={(e) => onChange({ ...rule, value2: Number(e.target.value) })} />}
        </div>
      )}
      {needsVal && field.type === 'date' && (
        <input className="cd-input" type="number" placeholder="days" value={rule.value as number ?? ''} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} />
      )}
      {needsVal && field.type === 'text' && (
        <input className="cd-input" placeholder="text" value={rule.value as string ?? ''} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
      )}
      <button className="cd-iconbtn" onClick={onDelete} aria-label="Remove condition"><Trash2 size={14} /></button>
    </div>
  );
}

// --- Threshold rule editor (conditional formatting / "logic") ---------------

function RuleEditor({ rules, unit, onChange }: { rules: ThresholdRule[]; unit: string; onChange: (r: ThresholdRule[]) => void }) {
  const add = () => onChange([...rules, { id: uid('rl'), op: 'lt', value: 0, tone: 'bad', label: '' }]);
  const set = (i: number, r: ThresholdRule) => onChange(rules.map((x, j) => (j === i ? r : x)));
  const del = (i: number) => onChange(rules.filter((_, j) => j !== i));
  return (
    <div className="cd-filters-editor">
      <div className="cd-fsection" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Target size={13} /> Threshold rules
        <span className="cd-fhint">colour the value &amp; flag it</span>
      </div>
      {rules.length === 0 && <div className="cd-fempty" style={{ margin: 0 }}>No rules — the value shows without a status flag.</div>}
      {rules.map((r, i) => (
        <div className="cd-filterrow" key={r.id} style={{ marginTop: 6 }}>
          <span className="cd-flabel" style={{ margin: 0 }}>When value is</span>
          <Sel value={r.op} onChange={(v) => set(i, { ...r, op: v as ThresholdRule['op'] })}>
            <option value="lt">below</option>
            <option value="lte">at or below</option>
            <option value="gt">above</option>
            <option value="gte">at or above</option>
            <option value="between">between</option>
          </Sel>
          <input className="cd-input" type="number" value={r.value} onChange={(e) => set(i, { ...r, value: Number(e.target.value) })} title={unit} />
          {r.op === 'between' && <input className="cd-input" type="number" value={r.value2 ?? ''} onChange={(e) => set(i, { ...r, value2: Number(e.target.value) })} />}
          <Sel value={r.tone} onChange={(v) => set(i, { ...r, tone: v as ThresholdRule['tone'] })}>
            <option value="bad">show red</option>
            <option value="good">show green</option>
            <option value="warn">show amber</option>
          </Sel>
          <input className="cd-input" placeholder="label e.g. At risk" value={r.label ?? ''} onChange={(e) => set(i, { ...r, label: e.target.value })} />
          <button className="cd-iconbtn" onClick={() => del(i)} aria-label="Remove rule"><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="cd-linkbtn" style={{ marginTop: 8 }} onClick={add}><Plus size={13} /> Add rule</button>
    </div>
  );
}
