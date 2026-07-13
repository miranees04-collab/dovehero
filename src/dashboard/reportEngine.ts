// ---------------------------------------------------------------------------
// Report engine: the query + aggregation layer behind the custom report builder.
//
// A report config (data source · measure · grouping · filters · rules) is
// compiled here against the in-memory dataset into chart-ready data. This is
// what makes reports genuinely user-built — the same primitives HubSpot /
// Salesforce / Zoho expose: pick an object, a metric with an aggregation, a
// group-by dimension (+ optional breakdown series), typed filters with
// AND-within-group / OR-across-groups logic, sort & limit, and threshold rules.
// ---------------------------------------------------------------------------

import {
  REPS,
  STAGES,
  SOURCES,
  PIPELINES,
  startOfDay,
  MS_DAY,
  type Dataset,
  type Filters,
  type Bounds,
} from './data';

// --- Field metadata ---------------------------------------------------------

export type FieldType = 'number' | 'currency' | 'enum' | 'date' | 'text' | 'duration';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // enum values
  groupable?: boolean; // usable as a dimension
  measurable?: boolean; // numeric, usable in sum/avg/min/max/median
}

export type ObjectKey = 'deals' | 'contacts' | 'companies' | 'activities';

export interface ObjectDef {
  key: ObjectKey;
  label: string;
  singular: string;
  fields: FieldDef[];
  /** The date fields a dashboard date filter can be pinned to. */
  dateFields: string[];
}

const STAGE_OPTS = [...STAGES];
const SOURCE_OPTS = [...SOURCES];
const PIPE_OPTS = [...PIPELINES];
const OWNER_OPTS = REPS.map((r) => r.name);
const STATUS_OPTS = ['open', 'won', 'lost'];
const ACT_OPTS = ['call', 'email', 'meeting', 'lead'];

export const OBJECTS: Record<ObjectKey, ObjectDef> = {
  deals: {
    key: 'deals',
    label: 'Deals',
    singular: 'deal',
    dateFields: ['createdAt', 'closedAt'],
    fields: [
      { key: 'amount', label: 'Deal amount', type: 'currency', measurable: true, groupable: false },
      { key: 'stage', label: 'Deal stage', type: 'enum', options: STAGE_OPTS, groupable: true },
      { key: 'source', label: 'Original source', type: 'enum', options: SOURCE_OPTS, groupable: true },
      { key: 'owner', label: 'Deal owner', type: 'enum', options: OWNER_OPTS, groupable: true },
      { key: 'pipeline', label: 'Pipeline', type: 'enum', options: PIPE_OPTS, groupable: true },
      { key: 'status', label: 'Status', type: 'enum', options: STATUS_OPTS, groupable: true },
      { key: 'createdAt', label: 'Create date', type: 'date', groupable: true },
      { key: 'closedAt', label: 'Close date', type: 'date', groupable: true },
      { key: 'daysToClose', label: 'Days to close', type: 'duration', measurable: true },
      { key: 'daysInStage', label: 'Days in current stage', type: 'duration', measurable: true },
      { key: 'company', label: 'Company', type: 'text', groupable: true },
      { key: 'contact', label: 'Contact', type: 'text' },
    ],
  },
  contacts: {
    key: 'contacts',
    label: 'Contacts',
    singular: 'contact',
    dateFields: ['createdAt'],
    fields: [
      { key: 'source', label: 'Original source', type: 'enum', options: SOURCE_OPTS, groupable: true },
      { key: 'owner', label: 'Contact owner', type: 'enum', options: OWNER_OPTS, groupable: true },
      { key: 'lifecycle', label: 'Lifecycle stage', type: 'enum', options: ['Lead', 'MQL', 'SQL', 'Opportunity', 'Customer'], groupable: true },
      { key: 'createdAt', label: 'Create date', type: 'date', groupable: true },
      { key: 'company', label: 'Company', type: 'text', groupable: true },
      { key: 'name', label: 'Name', type: 'text' },
    ],
  },
  companies: {
    key: 'companies',
    label: 'Companies',
    singular: 'company',
    dateFields: ['createdAt'],
    fields: [
      { key: 'source', label: 'Original source', type: 'enum', options: SOURCE_OPTS, groupable: true },
      { key: 'owner', label: 'Company owner', type: 'enum', options: OWNER_OPTS, groupable: true },
      { key: 'openValue', label: 'Open deal value', type: 'currency', measurable: true },
      { key: 'dealCount', label: 'Associated deals', type: 'number', measurable: true },
      { key: 'createdAt', label: 'Create date', type: 'date', groupable: true },
      { key: 'name', label: 'Company name', type: 'text', groupable: true },
    ],
  },
  activities: {
    key: 'activities',
    label: 'Activities',
    singular: 'activity',
    dateFields: ['createdAt'],
    fields: [
      { key: 'type', label: 'Activity type', type: 'enum', options: ACT_OPTS, groupable: true },
      { key: 'owner', label: 'Activity owner', type: 'enum', options: OWNER_OPTS, groupable: true },
      { key: 'createdAt', label: 'Activity date', type: 'date', groupable: true },
      { key: 'company', label: 'Company', type: 'text', groupable: true },
    ],
  },
};

// --- Row materialization ----------------------------------------------------

export type Row = Record<string, string | number | null>;

/** Build typed rows for an object from the raw dataset. */
function materialize(object: ObjectKey, data: Dataset, now: number): Row[] {
  const repName = (id: string) => REPS.find((r) => r.id === id)?.name ?? id;

  if (object === 'deals') {
    return data.deals.map((d) => ({
      amount: d.amount,
      stage: STAGES[d.stage],
      source: d.source,
      owner: repName(d.owner),
      pipeline: d.pipeline,
      status: d.status,
      createdAt: d.createdAt,
      closedAt: d.closedAt,
      daysToClose: d.closedAt !== null ? Math.round((d.closedAt - d.createdAt) / MS_DAY) : null,
      daysInStage: Math.round((now - d.stageEnteredAt) / MS_DAY),
      company: d.company,
      contact: d.contact,
      _stageIdx: d.stage,
      _ownerId: d.owner,
    }));
  }

  if (object === 'activities') {
    return data.activities.map((a) => ({
      type: a.type,
      owner: repName(a.rep),
      createdAt: a.at,
      company: a.company,
      _ownerId: a.rep,
    }));
  }

  // Contacts / companies are synthesized from deals so the objects feel real.
  const rnd = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return ((h >>> 0) % 1000) / 1000;
  };

  if (object === 'contacts') {
    const seen = new Map<string, Row>();
    for (const d of data.deals) {
      const k = `${d.contact}@${d.company}`;
      if (seen.has(k)) continue;
      const r = rnd(k);
      const lifecycle = d.status === 'won' ? 'Customer' : r < 0.3 ? 'Lead' : r < 0.55 ? 'MQL' : r < 0.78 ? 'SQL' : 'Opportunity';
      seen.set(k, {
        source: d.source,
        owner: repName(d.owner),
        lifecycle,
        createdAt: d.createdAt - Math.round(r * 30) * MS_DAY,
        company: d.company,
        name: d.contact,
        _ownerId: d.owner,
      });
    }
    return [...seen.values()];
  }

  // companies
  const byCompany = new Map<string, { deals: typeof data.deals; }>();
  for (const d of data.deals) {
    if (!byCompany.has(d.company)) byCompany.set(d.company, { deals: [] as unknown as typeof data.deals });
    (byCompany.get(d.company)!.deals as unknown as Array<unknown>).push(d);
  }
  return [...byCompany.entries()].map(([name, { deals }]) => {
    const first = deals[0];
    return {
      source: first.source,
      owner: repName(first.owner),
      openValue: deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.amount, 0),
      dealCount: deals.length,
      createdAt: Math.min(...deals.map((d) => d.createdAt)),
      name,
      _ownerId: first.owner,
    };
  });
}

// --- Filters ----------------------------------------------------------------

export type Operator =
  | 'in' | 'nin' // enum: is any of / is none of
  | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' // number
  | 'contains' | 'ncontains' // text
  | 'last_n' | 'older_n' | 'before' | 'after' // date
  | 'known' | 'unknown';

export interface FilterRule {
  id: string;
  field: string;
  op: Operator;
  value?: string | number | string[];
  value2?: string | number; // for "between"
}

/** HubSpot model: filters within a group are AND'd; groups are OR'd together. */
export interface FilterGroup {
  id: string;
  filters: FilterRule[];
}

export const OPERATORS_BY_TYPE: Record<FieldType, Array<{ op: Operator; label: string }>> = {
  enum: [
    { op: 'in', label: 'is any of' },
    { op: 'nin', label: 'is none of' },
    { op: 'known', label: 'is known' },
    { op: 'unknown', label: 'is unknown' },
  ],
  text: [
    { op: 'contains', label: 'contains' },
    { op: 'ncontains', label: "doesn't contain" },
    { op: 'eq', label: 'is exactly' },
    { op: 'known', label: 'is known' },
    { op: 'unknown', label: 'is unknown' },
  ],
  number: numOps(),
  currency: numOps(),
  duration: numOps(),
  date: [
    { op: 'last_n', label: 'is in the last (days)' },
    { op: 'older_n', label: 'is more than (days) ago' },
    { op: 'known', label: 'is known' },
    { op: 'unknown', label: 'is unknown' },
  ],
};

function numOps(): Array<{ op: Operator; label: string }> {
  return [
    { op: 'gt', label: 'is greater than' },
    { op: 'lt', label: 'is less than' },
    { op: 'gte', label: 'is at least' },
    { op: 'lte', label: 'is at most' },
    { op: 'eq', label: 'is equal to' },
    { op: 'neq', label: 'is not equal to' },
    { op: 'between', label: 'is between' },
    { op: 'known', label: 'is known' },
    { op: 'unknown', label: 'is unknown' },
  ];
}

function matchRule(row: Row, rule: FilterRule, now: number): boolean {
  const v = row[rule.field];
  // Existence checks never need a value.
  if (rule.op === 'known') return v !== null && v !== undefined && v !== '';
  if (rule.op === 'unknown') return v === null || v === undefined || v === '';
  // Enum membership: an empty selection is treated as "no constraint" (a
  // half-built "is any of []" filter should not silently exclude every row).
  if (rule.op === 'in') {
    if (!Array.isArray(rule.value) || rule.value.length === 0) return true;
    return rule.value.includes(String(v));
  }
  if (rule.op === 'nin') {
    if (!Array.isArray(rule.value) || rule.value.length === 0) return true;
    return !rule.value.includes(String(v));
  }
  // Every remaining operator compares against a scalar. If the user hasn't
  // entered one yet, the condition is incomplete → treat it as a no-op rather
  // than matching nothing (or matching "> 0" from an empty numeric input).
  if (rule.value === '' || rule.value === undefined || rule.value === null) return true;
  switch (rule.op) {
    case 'contains':
      return String(v ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
    case 'ncontains':
      return !String(v ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
    case 'eq':
      return String(v) === String(rule.value);
    case 'neq':
      return String(v) !== String(rule.value);
    case 'gt':
      return v !== null && Number(v) > Number(rule.value);
    case 'lt':
      return v !== null && Number(v) < Number(rule.value);
    case 'gte':
      return v !== null && Number(v) >= Number(rule.value);
    case 'lte':
      return v !== null && Number(v) <= Number(rule.value);
    case 'between': {
      if (v === null) return false;
      const lo = Number(rule.value);
      const hi = rule.value2 === undefined || (rule.value2 as unknown) === '' ? Infinity : Number(rule.value2);
      return Number(v) >= lo && Number(v) <= hi;
    }
    case 'last_n':
      return v !== null && now - Number(v) <= Number(rule.value) * MS_DAY;
    case 'older_n':
      return v !== null && now - Number(v) > Number(rule.value) * MS_DAY;
    case 'before':
      return v !== null && Number(v) < Number(rule.value);
    case 'after':
      return v !== null && Number(v) > Number(rule.value);
    default:
      return true;
  }
}

function passesFilters(row: Row, groups: FilterGroup[], now: number): boolean {
  const active = groups.filter((g) => g.filters.length > 0);
  if (active.length === 0) return true;
  // OR across groups, AND within a group.
  return active.some((g) => g.filters.every((f) => matchRule(row, f, now)));
}

// --- Measures ---------------------------------------------------------------

export type Aggregation = 'count' | 'countUnique' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'winRate';

export interface Measure {
  agg: Aggregation;
  field?: string; // required for sum/avg/min/max/median/countUnique
}

export const AGG_LABELS: Record<Aggregation, string> = {
  count: 'Count of',
  countUnique: 'Unique count of',
  sum: 'Sum of',
  avg: 'Average of',
  min: 'Min of',
  max: 'Max of',
  median: 'Median of',
  winRate: 'Win rate (%)',
};

function aggregate(rows: Row[], m: Measure): number {
  if (m.agg === 'count') return rows.length;
  if (m.agg === 'winRate') {
    const closed = rows.filter((r) => r.status === 'won' || r.status === 'lost');
    const won = closed.filter((r) => r.status === 'won').length;
    return closed.length ? (won / closed.length) * 100 : 0;
  }
  if (m.agg === 'countUnique') {
    return new Set(rows.map((r) => String(r[m.field!]))).size;
  }
  const nums = rows.map((r) => r[m.field!]).filter((x): x is number => typeof x === 'number' && !isNaN(x));
  if (nums.length === 0) return 0;
  if (m.agg === 'sum') return nums.reduce((s, x) => s + x, 0);
  if (m.agg === 'avg') return nums.reduce((s, x) => s + x, 0) / nums.length;
  if (m.agg === 'min') return Math.min(...nums);
  if (m.agg === 'max') return Math.max(...nums);
  if (m.agg === 'median') {
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  return 0;
}

export function measureUnit(object: ObjectKey, m: Measure): 'money' | 'int' | 'days' | 'pct' {
  if (m.agg === 'winRate') return 'pct';
  if (m.agg === 'count' || m.agg === 'countUnique') return 'int';
  const f = OBJECTS[object].fields.find((x) => x.key === m.field);
  if (f?.type === 'currency') return 'money';
  if (f?.type === 'duration') return 'days';
  return 'int';
}

// --- Grouping ---------------------------------------------------------------

export type DateGrain = 'day' | 'week' | 'month' | 'quarter';

export interface Dimension {
  field: string;
  grain?: DateGrain; // for date fields
}

function bucketKey(row: Row, dim: Dimension, def: ObjectDef): string {
  const f = def.fields.find((x) => x.key === dim.field);
  const v = row[dim.field];
  if (v === null || v === undefined || v === '') return '—';
  if (f?.type === 'date') {
    const t = Number(v);
    const d = new Date(t);
    const grain = dim.grain ?? 'month';
    if (grain === 'day') return startOfDay(t).toString();
    if (grain === 'week') {
      const s = startOfDay(t) - new Date(t).getDay() * MS_DAY;
      return s.toString();
    }
    if (grain === 'quarter') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return String(v);
}

function bucketLabel(key: string, dim: Dimension, def: ObjectDef): string {
  const f = def.fields.find((x) => x.key === dim.field);
  if (f?.type === 'date' && key !== '—') {
    const grain = dim.grain ?? 'month';
    if (grain === 'quarter') return key;
    if (grain === 'month') {
      const [y, m] = key.split('-');
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return new Date(Number(key)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return key;
}

// --- Report config + result -------------------------------------------------

export type Viz =
  | 'kpi' | 'gauge' | 'pace' | 'bar' | 'hbar' | 'line' | 'area' | 'combo' | 'pie' | 'donut'
  | 'funnel' | 'table' | 'leaderboard' | 'scatter' | 'cohort';

export type RuleTone = 'good' | 'bad' | 'warn';

/** Comparison baseline for single-value reports (KPI delta). */
export type CompareMode = 'none' | 'prevPeriod' | 'prevYear' | 'custom';

export interface ThresholdRule {
  id: string;
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'between';
  value: number;
  value2?: number;
  tone: RuleTone;
  label?: string;
  notify?: boolean;
}

export interface ReportConfig {
  id: string;
  title: string;
  object: ObjectKey;
  viz: Viz;
  measure: Measure;
  measureY?: Measure | null; // Y axis for scatter/quadrant (X = measure)
  dimension?: Dimension | null;
  breakdown?: Dimension | null;
  filterGroups: FilterGroup[];
  dateField: string | null; // which date field the dashboard range scopes; null = ignore range
  sort: 'natural' | 'value-desc' | 'value-asc' | 'label-asc';
  limit: number;
  goal?: number | null; // gauge / kpi target
  compare?: boolean; // legacy: vs previous period (kpi) — superseded by compareMode
  compareMode?: CompareMode; // KPI comparison baseline
  compareFrom?: string; // custom baseline start (yyyy-mm-dd)
  compareTo?: string; // custom baseline end (yyyy-mm-dd, inclusive)
  anomalies?: boolean; // rolling-band anomaly highlighting (time series)
  showValues?: boolean; // draw data labels on bars (default on)
  tags?: string[]; // free-form labels shown on the tile
  rules: ThresholdRule[];
  span: 3 | 4 | 5 | 6 | 7 | 8 | 12;
}

export interface Point {
  key: string;
  label: string;
  value: number;
  series: Record<string, number>; // seriesKey -> value (for breakdown)
  anomaly?: boolean; // flagged by rolling-band anomaly detection
}

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  n: number;
}

export interface CohortRow {
  label: string;
  base: number;
  cells: Array<number | null>; // cumulative win % per months-since-created
}

export interface ReportResult {
  points: Point[];
  seriesKeys: string[];
  value: number; // total / kpi value
  prevValue: number | null;
  unit: 'money' | 'int' | 'days' | 'pct';
  unitY?: 'money' | 'int' | 'days' | 'pct'; // scatter Y
  total: number;
  rowCount: number;
  scatter?: ScatterPoint[];
  cohort?: CohortRow[];
  cohortCols?: string[];
}

export interface CrossFilter {
  field: string; // materialized field key (stage, source, owner, status, …)
  value: string;
  label: string;
}

export interface EngineCtx {
  data: Dataset;
  filters: Filters;
  bounds: Bounds;
  now: number;
  jitter: number;
  cross?: CrossFilter[];
}

/** Apply dashboard-level owner/pipeline filter + any active cross-filters. */
function applyGlobal(rows: Row[], object: ObjectKey, filters: Filters, cross: CrossFilter[] = []): Row[] {
  const fields = new Set(OBJECTS[object].fields.map((f) => f.key));
  // A cross-filter only scopes objects that actually have that field.
  const applicable = cross.filter((c) => fields.has(c.field));
  return rows.filter((r) => {
    if (filters.owner !== 'all' && r._ownerId !== filters.owner) return false;
    if (filters.pipeline !== 'all' && object === 'deals' && r.pipeline !== filters.pipeline) return false;
    for (const c of applicable) if (String(r[c.field]) !== c.value) return false;
    return true;
  });
}

/** Shift a timestamp by whole calendar years (for previous-year comparison). */
function shiftYear(ts: number, delta: number): number {
  const d = new Date(ts);
  d.setFullYear(d.getFullYear() + delta);
  return d.getTime();
}

function inRange(row: Row, dateField: string | null, a: number, b: number): boolean {
  if (!dateField) return true;
  const v = row[dateField];
  return v !== null && v !== undefined && Number(v) >= a && Number(v) < b;
}

/** Compile a report config into chart-ready data. */
const EMPTY: ReportResult = { points: [], seriesKeys: [], value: 0, prevValue: null, unit: 'int', total: 0, rowCount: 0 };

export function runReport(cfg: ReportConfig, ctx: EngineCtx): ReportResult {
  const def = OBJECTS[cfg.object];
  const all = applyGlobal(materialize(cfg.object, ctx.data, ctx.now), cfg.object, ctx.filters, ctx.cross);
  const { start, end, prevStart, prevEnd } = ctx.bounds;

  const filtered = all.filter(
    (r) => passesFilters(r, cfg.filterGroups, ctx.now) && inRange(r, cfg.dateField, start, end),
  );
  const unit = measureUnit(cfg.object, cfg.measure);

  // Cohort retention: created-month cohorts × months-since, cumulative win %.
  if (cfg.viz === 'cohort') {
    const rows = all.filter((r) => passesFilters(r, cfg.filterGroups, ctx.now) && r.createdAt !== null);
    const N = 6;
    const base = new Date(ctx.now);
    const monthStart = (back: number) => new Date(base.getFullYear(), base.getMonth() - back, 1).getTime();
    const cohortCols = Array.from({ length: N }, (_, k) => `+${k}`);
    const cohort: CohortRow[] = [];
    for (let i = N - 1; i >= 0; i--) {
      const cStart = monthStart(i);
      const cEnd = new Date(base.getFullYear(), base.getMonth() - i + 1, 1).getTime();
      const cohortDeals = rows.filter((r) => Number(r.createdAt) >= cStart && Number(r.createdAt) < cEnd);
      const label = new Date(cStart).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const cells: Array<number | null> = [];
      for (let k = 0; k < N; k++) {
        const windowEnd = new Date(base.getFullYear(), base.getMonth() - i + k + 1, 1).getTime();
        if (windowEnd > ctx.now + MS_DAY) { cells.push(null); continue; } // future — triangular
        if (cohortDeals.length === 0) { cells.push(null); continue; }
        const won = cohortDeals.filter((r) => r.status === 'won' && r.closedAt !== null && Number(r.closedAt) < windowEnd).length;
        cells.push((won / cohortDeals.length) * 100);
      }
      cohort.push({ label, base: cohortDeals.length, cells });
    }
    return { ...EMPTY, cohort, cohortCols, rowCount: rows.length, unit: 'pct' };
  }

  // Scatter / quadrant: two measures per entity, split by medians.
  if (cfg.viz === 'scatter' && cfg.dimension && cfg.measureY) {
    const groups = new Map<string, Row[]>();
    for (const r of filtered) {
      const k = bucketKey(r, cfg.dimension, def);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const scatter: ScatterPoint[] = [...groups.entries()]
      .filter(([, rs]) => rs.length > 0)
      .map(([key, rs]) => ({
        label: bucketLabel(key, cfg.dimension!, def),
        x: aggregate(rs, cfg.measure),
        y: aggregate(rs, cfg.measureY!),
        n: rs.length,
      }));
    return {
      ...EMPTY,
      scatter,
      unit,
      unitY: measureUnit(cfg.object, cfg.measureY),
      rowCount: filtered.length,
    };
  }

  // Funnel is special: cumulative reach across ordered stages.
  if (cfg.viz === 'funnel') {
    const counts = STAGES.map((_, i) => filtered.filter((r) => Number(r._stageIdx) >= i).length);
    const points: Point[] = STAGES.map((s, i) => ({ key: s, label: s, value: counts[i], series: { value: counts[i] } }));
    return { points, seriesKeys: ['value'], value: counts[0] ?? 0, prevValue: null, unit: 'int', total: counts[0] ?? 0, rowCount: filtered.length };
  }

  // No dimension → single KPI/gauge value.
  if (!cfg.dimension) {
    const value = aggregate(filtered, cfg.measure);
    let prevValue: number | null = null;
    // Resolve the comparison baseline window from the selected mode.
    const mode: CompareMode = cfg.compareMode ?? (cfg.compare ? 'prevPeriod' : 'none');
    if (mode !== 'none' && cfg.dateField) {
      let ps: number | null = null;
      let pe: number | null = null;
      if (mode === 'prevPeriod' && ctx.bounds.hasPrev) {
        ps = prevStart; pe = prevEnd;
      } else if (mode === 'prevYear') {
        ps = shiftYear(start, -1); pe = shiftYear(end, -1);
      } else if (mode === 'custom' && cfg.compareFrom && cfg.compareTo) {
        const a = Date.parse(cfg.compareFrom);
        const b = Date.parse(cfg.compareTo);
        if (!isNaN(a) && !isNaN(b)) { ps = a; pe = b + MS_DAY; } // end inclusive
      }
      if (ps !== null && pe !== null) {
        const prevRows = all.filter(
          (r) => passesFilters(r, cfg.filterGroups, ctx.now) && inRange(r, cfg.dateField, ps!, pe!),
        );
        prevValue = aggregate(prevRows, cfg.measure);
      }
    }
    return { points: [], seriesKeys: [], value, prevValue, unit, total: value, rowCount: filtered.length };
  }

  // Group by dimension (+ optional breakdown series).
  const groups = new Map<string, Row[]>();
  for (const r of filtered) {
    const k = bucketKey(r, cfg.dimension, def);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const breakdownKeys = new Set<string>();
  let points: Point[] = [...groups.entries()].map(([key, rows]) => {
    const series: Record<string, number> = {};
    if (cfg.breakdown) {
      const bdef = def;
      const sub = new Map<string, Row[]>();
      for (const r of rows) {
        const bk = bucketLabel(bucketKey(r, cfg.breakdown, bdef), cfg.breakdown, bdef);
        if (!sub.has(bk)) sub.set(bk, []);
        sub.get(bk)!.push(r);
      }
      for (const [bk, brows] of sub) {
        series[bk] = aggregate(brows, cfg.measure);
        breakdownKeys.add(bk);
      }
    }
    const value = aggregate(rows, cfg.measure);
    if (!cfg.breakdown) series.value = value;
    return { key, label: bucketLabel(key, cfg.dimension!, def), value, series };
  });

  // Sort: date dimensions always sort chronologically; enums can follow their
  // natural option order ("group order") so e.g. pipeline stages stay in order.
  const dimFieldDef = def.fields.find((f) => f.key === cfg.dimension!.field);
  const isDate = dimFieldDef?.type === 'date';
  if (isDate) {
    points.sort((a, b) => (a.key === '—' ? 1 : b.key === '—' ? -1 : a.key.localeCompare(b.key)));
  } else if (cfg.sort === 'natural' && dimFieldDef?.options) {
    const order = dimFieldDef.options;
    points.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  } else if (cfg.sort === 'label-asc') {
    points.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    points.sort((a, b) => (cfg.sort === 'value-asc' ? a.value - b.value : b.value - a.value));
  }

  // Anomaly detection: flag points outside a trailing mean ± 1.8σ band.
  if (cfg.anomalies && isDate && !cfg.breakdown && points.length >= 4) {
    const win = 3;
    for (let i = 2; i < points.length; i++) {
      const prior = points.slice(Math.max(0, i - win), i).map((p) => p.value);
      const mean = prior.reduce((s, x) => s + x, 0) / prior.length;
      const sd = Math.sqrt(prior.reduce((s, x) => s + (x - mean) ** 2, 0) / prior.length);
      if (sd > 0 && Math.abs(points[i].value - mean) > 1.8 * sd) points[i].anomaly = true;
    }
  }

  // Limit (top N) — keep the tail as "Other" for part-to-whole vizzes.
  let seriesKeys = cfg.breakdown ? [...breakdownKeys] : ['value'];
  if (cfg.breakdown) {
    // Cap breakdown series at 6 + Other so the palette never cycles.
    const totals = new Map<string, number>();
    for (const p of points) for (const k of seriesKeys) totals.set(k, (totals.get(k) ?? 0) + (p.series[k] ?? 0));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    if (ranked.length > 6) {
      const keep = new Set(ranked.slice(0, 5));
      points = points.map((p) => {
        const series: Record<string, number> = {};
        let other = 0;
        for (const [k, v] of Object.entries(p.series)) {
          if (keep.has(k)) series[k] = v;
          else other += v;
        }
        if (other) series.Other = other;
        return { ...p, series };
      });
      seriesKeys = [...ranked.slice(0, 5), 'Other'];
    }
  }

  if (points.length > cfg.limit) {
    if (cfg.viz === 'pie' || cfg.viz === 'donut') {
      const head = points.slice(0, cfg.limit);
      const tail = points.slice(cfg.limit);
      const otherVal = tail.reduce((s, p) => s + p.value, 0);
      points = [...head, { key: '__other', label: 'Other', value: otherVal, series: { value: otherVal } }];
    } else {
      points = points.slice(0, cfg.limit);
    }
  }

  const total = points.reduce((s, p) => s + p.value, 0);
  return { points, seriesKeys, value: total, prevValue: null, unit, total, rowCount: filtered.length };
}

/** Evaluate a threshold rule against a value; returns the matching rule (if any). */
export function evalRules(value: number, rules: ThresholdRule[]): ThresholdRule | null {
  for (const r of rules) {
    const hit =
      r.op === 'gt' ? value > r.value
      : r.op === 'lt' ? value < r.value
      : r.op === 'gte' ? value >= r.value
      : r.op === 'lte' ? value <= r.value
      : value >= r.value && value <= (r.value2 ?? r.value);
    if (hit) return r;
  }
  return null;
}

// --- Value formatting -------------------------------------------------------

export function fmtByUnit(v: number, unit: ReportResult['unit'], compact = true): string {
  if (unit === 'money') {
    const abs = Math.abs(v);
    if (!compact) return `$${Math.round(v).toLocaleString('en-US')}`;
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    if (abs >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${Math.round(v)}`;
  }
  if (unit === 'pct') return `${v.toFixed(v < 10 ? 1 : 0)}%`;
  if (unit === 'days') return `${Math.round(v)}d`;
  return Math.round(v).toLocaleString('en-US');
}

/** Underlying records behind a drill-down click (a dimension bucket, or all). */
export function drillRecords(cfg: ReportConfig, ctx: EngineCtx, bucketKey: string | null): Row[] {
  const def = OBJECTS[cfg.object];
  const all = applyGlobal(materialize(cfg.object, ctx.data, ctx.now), cfg.object, ctx.filters, ctx.cross);
  const { start, end } = ctx.bounds;
  let rows = all.filter(
    (r) => passesFilters(r, cfg.filterGroups, ctx.now) && inRange(r, cfg.dateField, start, end),
  );
  if (bucketKey !== null && cfg.dimension) {
    if (cfg.viz === 'funnel') {
      const idx = STAGES.indexOf(bucketKey as (typeof STAGES)[number]);
      rows = rows.filter((r) => Number(r._stageIdx) >= idx);
    } else {
      rows = rows.filter((r) => bucketKeyOf(r, cfg.dimension!, def) === bucketKey);
    }
  }
  return rows.slice(0, 60);
}

function bucketKeyOf(row: Row, dim: Dimension, def: ObjectDef): string {
  return bucketKey(row, dim, def);
}

let _idn = 0;
export function uid(prefix = 'r'): string {
  // Deterministic, monotonic — avoids Math.random (unavailable in some contexts).
  _idn += 1;
  return `${prefix}${_idn}`;
}
