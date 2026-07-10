// ---- Import AI (Nova) — shared logic + a pluggable suggestion provider ----
//
// The UI never calls a heuristic directly; it calls `requestNovaSuggestions(ctx)`,
// which returns a list of serializable findings. Today those come from an
// on-device heuristic engine (`analyzeImportLocally`). To back Nova with a real
// model, set VITE_NOVA_ENDPOINT to a server proxy that accepts the same
// NovaContext JSON and returns `{ findings: NovaFinding[] }` — the wizard needs
// no changes, because findings are plain data and the actions are derived in the
// component from `kind` + params.

import type { FieldType, ObjectRecord } from '@/types';

/* ---------------- shared pure helpers (used across the wizard) ---------------- */
export type RuleAction = 'trim' | 'upper' | 'lower' | 'title' | 'sentence';
export const RULE_LABEL: Record<RuleAction, string> = {
  title: 'Capitalize Each Word',
  sentence: 'Sentence case',
  upper: 'UPPERCASE',
  lower: 'lowercase',
  trim: 'Trim extra spaces',
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const SYN: string[][] = [
  ['name', 'fullname', 'contact', 'contactname'],
  ['email', 'emailaddress', 'mail'],
  ['phone', 'mobile', 'tel', 'telephone', 'cell'],
  ['company', 'organization', 'organisation', 'account', 'employer', 'business'],
  ['title', 'jobtitle', 'position', 'role'],
  ['industry', 'sector', 'vertical'],
  ['value', 'dealvalue', 'amount', 'price', 'revenue', 'deal'],
  ['source', 'leadsource', 'channel'],
  ['region', 'country', 'territory', 'location', 'geo'],
  ['owner', 'assigned', 'rep', 'assignedto'],
  ['date', 'created', 'signup', 'signupdate', 'createddate', 'due'],
  ['status', 'stage'],
  ['sku', 'code'],
  ['domain', 'website', 'url', 'site'],
];
const groupOf = (a: string): string[] | null => SYN.find((g) => g.includes(a)) ?? null;

export function matchScore(col: string, label: string): number {
  const a = norm(col), b = norm(label);
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const ga = groupOf(a), gb = groupOf(b);
  if (ga && gb && ga === gb) return 1;
  return 0;
}

export function transformVal(v: string, action?: RuleAction): string {
  const s = v ?? '';
  switch (action) {
    case 'title': return s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    case 'sentence': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    case 'upper': return s.toUpperCase();
    case 'lower': return s.toLowerCase();
    case 'trim': return s.replace(/\s+/g, ' ').trim();
    default: return s;
  }
}

export function coerce(v: string, type: FieldType): unknown {
  const s = (v ?? '').trim();
  if (type === 'number' || type === 'currency') return Number(s.replace(/[^0-9.\-]/g, '')) || 0;
  if (type === 'checkbox') return /^(yes|true|1|paid|active)$/i.test(s);
  return s;
}

/** Nova guesses a property type from a column's values + its name. */
export function inferFieldType(rawValues: string[], name: string): FieldType {
  const nm = norm(name);
  if (/phone|mobile|tel|fax/.test(nm)) return 'text'; // no phone type in the model
  const vals = rawValues.filter((v) => v && v.trim());
  if (!vals.length) return 'text';
  if (vals.every((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()))) return 'email';
  if (vals.every((v) => /^https?:\/\//.test(v.trim()))) return 'url';
  if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v.trim()))) return 'date';
  if (vals.every((v) => /^[-+]?[\d.,\s]+$/.test(v.trim()))) return /value|price|amount|revenue|deal|cost|salary/.test(nm) ? 'currency' : 'number';
  const uniq = new Set(vals.map((v) => v.trim().toLowerCase()));
  if (uniq.size <= Math.max(2, Math.floor(vals.length / 2)) && [...uniq].every((v) => v.length < 24)) return 'select';
  return 'text';
}

/** Duplicate identity: contacts match by email (fallback name), else by name. */
export function dedupeKey(objKey: string, rec: ObjectRecord): string {
  const email = typeof rec.email === 'string' ? rec.email.trim().toLowerCase() : '';
  if (objKey === 'contact' && email) return 'e:' + email;
  return 'n:' + String(rec.name ?? '').trim().toLowerCase();
}

/* ---------------- context + findings (serializable across the seam) ---------------- */
export interface NovaCtxField { k: string; label: string; type: FieldType }
export interface NovaCtxObject { k: string; name: string; plural: string; fields: NovaCtxField[] }
export interface NovaCtxColumn {
  index: number;
  name: string;
  mapped: { objKey: string; fieldKey: string } | null;
  skip: boolean;
  rule?: RuleAction;
}
export interface NovaContext {
  objects: NovaCtxObject[];
  columns: NovaCtxColumn[];
  rows: string[][]; // sample, aligned to columns by position
  dedupe: 'update' | 'skip' | 'create';
}

export type NovaFindingKind = 'map' | 'create' | 'trim' | 'lower' | 'skip-dupes';
export interface NovaFinding {
  id: string;
  kind: NovaFindingKind;
  tone: 'map' | 'clean' | 'dupe';
  message: string; // plain-language description (what a model would emit / what we log)
  colIndex?: number;
  objKey?: string;
  fieldKey?: string;
  fieldLabel?: string;
  fieldType?: FieldType;
  count?: number;
}

function bestTargetFor(name: string, objects: NovaCtxObject[]): { objKey: string; fieldKey: string } | null {
  let best: { objKey: string; fieldKey: string } | null = null;
  let bestScore = 0;
  for (const o of objects) {
    for (const f of o.fields) {
      let sc = matchScore(name, f.label);
      if (f.k === 'name' && (norm(name) === norm(o.name) || norm(name) === norm(o.plural))) sc = 4;
      if (sc > bestScore) { bestScore = sc; best = { objKey: o.k, fieldKey: f.k }; }
    }
  }
  return best;
}

/** On-device heuristic engine — the default Nova provider. Pure over the context. */
export function analyzeImportLocally(ctx: NovaContext): NovaFinding[] {
  const { objects, columns, rows, dedupe } = ctx;
  const out: NovaFinding[] = [];
  const plural = (k: string) => objects.find((o) => o.k === k)?.plural ?? k;

  // 1) unmapped columns → map to a match, or create with an inferred type
  columns.forEach((c) => {
    if (c.mapped || c.skip) return;
    const bt = bestTargetFor(c.name, objects);
    if (bt) {
      const f = objects.find((o) => o.k === bt.objKey)?.fields.find((x) => x.k === bt.fieldKey);
      out.push({ id: 'unmap-' + c.index + '-' + norm(c.name), kind: 'map', tone: 'map', colIndex: c.index, objKey: bt.objKey, fieldKey: bt.fieldKey, fieldLabel: f?.label, message: `Map "${c.name}" to ${plural(bt.objKey)} · ${f?.label}` });
    } else {
      const objKey = objects[0]?.k;
      if (!objKey) return;
      const type = inferFieldType(rows.map((r) => r[c.index] ?? ''), c.name);
      out.push({ id: 'unmap-' + c.index + '-' + norm(c.name), kind: 'create', tone: 'map', colIndex: c.index, objKey, fieldType: type, message: `No match for "${c.name}" — create it as a ${type} on ${plural(objKey)}` });
    }
  });

  // 2) stray whitespace on a mapped column
  columns.forEach((c) => {
    if (!c.mapped || c.skip || c.rule) return;
    if (rows.some((r) => { const v = r[c.index] || ''; return v !== v.trim() || /\s{2,}/.test(v); }))
      out.push({ id: 'ws-' + c.index, kind: 'trim', tone: 'clean', colIndex: c.index, message: `"${c.name}" has stray spaces — trim on import` });
  });

  // 3) uppercase in an email column
  columns.forEach((c) => {
    if (!c.mapped || c.skip || c.rule) return;
    const f = objects.find((o) => o.k === c.mapped!.objKey)?.fields.find((x) => x.k === c.mapped!.fieldKey);
    if (!(f?.type === 'email' || /email/.test(norm(c.name)))) return;
    if (rows.some((r) => /[A-Z]/.test(r[c.index] || '')))
      out.push({ id: 'lc-' + c.index, kind: 'lower', tone: 'clean', colIndex: c.index, message: `"${c.name}" has mixed-case emails — lowercase them` });
  });

  // 4) duplicate rows within the file, per object
  if (dedupe !== 'skip') {
    const objsWithData = objects.filter((o) => columns.some((c) => c.mapped?.objKey === o.k));
    for (const o of objsWithData) {
      const mapped = columns.filter((c) => c.mapped?.objKey === o.k);
      const seen = new Set<string>();
      let dupes = 0;
      rows.forEach((row) => {
        const rec: ObjectRecord = { id: 'x' };
        mapped.forEach((c) => { const f = o.fields.find((x) => x.k === c.mapped!.fieldKey); if (f) rec[f.k] = coerce(transformVal(row[c.index] || '', c.rule), f.type); });
        const k = dedupeKey(o.k, rec);
        if (seen.has(k)) dupes++; else seen.add(k);
      });
      if (dupes > 0) out.push({ id: 'dupe-' + o.k, kind: 'skip-dupes', tone: 'dupe', objKey: o.k, count: dupes, message: `Found ${dupes} duplicate ${o.name.toLowerCase()} row(s) — skip on import` });
    }
  }

  return out.slice(0, 6);
}

export type NovaEngine = 'nova-local' | 'nova-remote';

/**
 * The single entry point the wizard uses. Routes to a remote model endpoint when
 * VITE_NOVA_ENDPOINT is configured, else runs the on-device heuristic engine.
 */
export async function requestNovaSuggestions(ctx: NovaContext): Promise<{ findings: NovaFinding[]; engine: NovaEngine }> {
  // Direct member access so Vite statically inlines the value at build time.
  const endpoint = import.meta.env.VITE_NOVA_ENDPOINT;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ctx) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.findings)) return { findings: data.findings as NovaFinding[], engine: 'nova-remote' };
      }
    } catch {
      /* network/endpoint error — fall back to the local engine below */
    }
  }
  // Brief pause so the "reviewing" state is perceptible; a real endpoint replaces this.
  await new Promise((r) => setTimeout(r, 380));
  return { findings: analyzeImportLocally(ctx), engine: 'nova-local' };
}
