import type { Deal } from '@/types';
import { OWNERS, STAGES, PIPELINES } from '@/data/constants';
import { staleDays } from './format';
import { inboundCount } from './comms';

export type RuleFieldType = 'number' | 'enum' | 'text' | 'tags';
export interface RuleField {
  k: string;
  label: string;
  type: RuleFieldType;
  opts?: { value: string; label: string }[];
}

/** Every deal property — standard + computed — is available when building a
 *  color rule. */
export const RULE_FIELDS: RuleField[] = [
  { k: 'value', label: 'Deal value', type: 'number' },
  { k: 'win', label: 'Win probability', type: 'number' },
  { k: 'health', label: 'Health score', type: 'number' },
  { k: 'idle', label: 'Days since activity', type: 'number' },
  { k: 'contacts', label: 'Contacts (count)', type: 'number' },
  { k: 'acts', label: 'Activities (count)', type: 'number' },
  { k: 'inbound', label: 'New replies (count)', type: 'number' },
  { k: 'stage', label: 'Stage', type: 'enum', opts: STAGES.map((s) => ({ value: s.k, label: s.k })) },
  { k: 'priority', label: 'Priority', type: 'enum', opts: [{ value: 'high', label: 'High' }, { value: 'med', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { k: 'owner', label: 'Owner', type: 'enum', opts: Object.values(OWNERS).map((o) => ({ value: o.key, label: o.name })) },
  { k: 'pipeline', label: 'Pipeline', type: 'enum', opts: PIPELINES.map((p) => ({ value: p.k, label: p.name })) },
  { k: 'industry', label: 'Industry', type: 'text' },
  { k: 'company', label: 'Company', type: 'text' },
  { k: 'name', label: 'Deal name', type: 'text' },
  { k: 'close', label: 'Close date', type: 'text' },
  { k: 'tags', label: 'Tags', type: 'tags' },
];

export const OPS_BY_TYPE: Record<RuleFieldType, { value: string; label: string }[]> = {
  number: [
    { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
    { value: 'eq', label: '=' }, { value: 'neq', label: '≠' },
  ],
  enum: [{ value: 'is', label: 'is' }, { value: 'isnot', label: 'is not' }],
  text: [{ value: 'contains', label: 'contains' }, { value: 'is', label: 'is' }, { value: 'isnot', label: 'is not' }],
  tags: [{ value: 'has', label: 'includes' }, { value: 'hasnot', label: 'excludes' }],
};

export const RULE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export interface ColorRule {
  id: string;
  enabled: boolean;
  label: string;
  field: string;
  op: string;
  value: string;
  color: string;
}

export const fieldMeta = (k: string): RuleField | undefined => RULE_FIELDS.find((f) => f.k === k);

function numberOf(d: Deal, k: string): number {
  switch (k) {
    case 'value': return d.value;
    case 'win': return d.win;
    case 'health': return d.health;
    case 'idle': return staleDays(d.acts?.[0]?.w);
    case 'contacts': return d.contacts.length;
    case 'acts': return d.acts.length;
    case 'inbound': return inboundCount(d);
    default: return 0;
  }
}
function stringOf(d: Deal, k: string): string {
  switch (k) {
    case 'stage': return d.stage;
    case 'priority': return d.priority;
    case 'owner': return d.owner;
    case 'pipeline': return d.pipeline;
    case 'industry': return d.industry;
    case 'company': return d.company;
    case 'name': return d.name;
    case 'close': return d.close;
    default: return '';
  }
}

export function matchRule(d: Deal, r: ColorRule): boolean {
  const meta = fieldMeta(r.field);
  if (!meta) return false;
  if (meta.type === 'number') {
    const x = numberOf(d, r.field);
    const n = parseFloat(r.value.replace(/[^0-9.\-]/g, '')) || 0;
    switch (r.op) {
      case 'gt': return x > n; case 'gte': return x >= n;
      case 'lt': return x < n; case 'lte': return x <= n;
      case 'eq': return x === n; case 'neq': return x !== n;
      default: return false;
    }
  }
  if (meta.type === 'tags') {
    const v = r.value.toLowerCase();
    const has = d.tags.some((t) => t.toLowerCase() === v);
    return r.op === 'has' ? has : !has;
  }
  const x = stringOf(d, r.field).toLowerCase();
  const v = r.value.toLowerCase();
  if (r.op === 'contains') return x.includes(v);
  if (r.op === 'isnot') return x !== v;
  return x === v;
}

/** First enabled, matching rule (or null). */
export function firstMatchingRule(d: Deal, rules: ColorRule[]): ColorRule | null {
  for (const r of rules) {
    if (r.enabled && r.value !== '' && matchRule(d, r)) return r;
  }
  return null;
}

/** First enabled, matching rule wins. Returns its colour or null. */
export function evalDealColor(d: Deal, rules: ColorRule[]): string | null {
  return firstMatchingRule(d, rules)?.color ?? null;
}

export const DEFAULT_COLOR_RULES: ColorRule[] = [
  { id: 'cr1', enabled: true, label: 'At risk', field: 'health', op: 'lt', value: '45', color: '#EF4444' },
  { id: 'cr2', enabled: true, label: 'Going cold', field: 'idle', op: 'gte', value: '14', color: '#F59E0B' },
  { id: 'cr3', enabled: true, label: 'Big deal', field: 'value', op: 'gte', value: '100000', color: '#10B981' },
];
