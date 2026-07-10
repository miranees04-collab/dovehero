import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Button, Popover, MenuItem } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { uid } from '@/lib/format';
import type { FieldDef, FieldType, ObjectDef, ObjectRecord } from '@/types';
import './import.css';

/* ------------------------------------------------------------------ *
 * Import wizard — a full-screen, 4-step flow:
 *   Start (what + where) → Data (map & clean) → Configure → Report.
 * Columns map to the workspace's real object properties in the grid
 * headers; on import it actually creates the records in the store.
 * ------------------------------------------------------------------ */

const STEPS = ['Start', 'Data', 'Configure', 'Report'] as const;
const STEP_HINT = ['What & where', 'Map & clean', 'Review & settings', 'Done'] as const;

type RuleAction = 'trim' | 'upper' | 'lower' | 'title' | 'sentence';
const RULE_LABEL: Record<RuleAction, string> = {
  title: 'Capitalize Each Word',
  sentence: 'Sentence case',
  upper: 'UPPERCASE',
  lower: 'lowercase',
  trim: 'Trim extra spaces',
};

type MapTarget = { obj: string; field: string } | { skip: true } | null;
interface Col {
  name: string;
  map: MapTarget;
  userSet?: boolean;
  rule?: RuleAction;
}

/* ---- the "uploaded file" (sample data) ---- */
const SAMPLE_COLS = [
  'Full Name', 'Email Address', 'Mobile', 'Company', 'Job Title',
  'Industry', 'Deal Value', 'Lead Source', 'Region', 'Owner', 'Signup Date',
];
const SAMPLE_ROWS: string[][] = [
  ['Aisha Rahman', 'aisha@dovehero.com', '+971 50 123 4567', 'DoveHero FZ-LLC', 'Head of Sales', 'SaaS', '50000', 'Webinar', 'EMEA', 'Amara Reyes', '2024-03-11'],
  ['Marcus Liang', 'marcus@liangtrade.com', '+971 55 111 2233', 'Liang Trading', 'CTO', 'Logistics', '12000', 'Referral', 'EMEA', 'Amara Reyes', '2024-03-14'],
  ['Priya Kapoor', 'priya@nexa.io', '+971 52 887 6543', 'Nexa Group', 'Procurement Mgr', 'Retail', '75000', 'LinkedIn Ad', 'EMEA', 'Jonah Pike', '2024-03-18'],
  ['Omar Said', 'omar@volt.ae', '+971 56 234 1188', 'Volt Energy', 'Founder', 'Energy', '90000', 'Cold call', 'EMEA', 'Jonah Pike', '2024-03-22'],
  ['Lena Voss', 'lena@axon.de', '+49 151 1234 5678', 'Axon GmbH', 'VP Eng', 'Manufacturing', '34000', 'Event', 'EMEA', 'Amara Reyes', '2024-04-02'],
  ['Raj Patel', 'raj@patelco.in', '+91 98765 43210', 'Patel & Co', 'Director', 'Fintech', '52000', 'Webinar', 'APAC', 'Jonah Pike', '2024-04-05'],
  ['Sara Khan', 'sara@dovehero.com', '+971 52 999 1010', 'DoveHero FZ-LLC', 'SDR', 'SaaS', '8000', 'Referral', 'EMEA', 'Amara Reyes', '2024-04-10'],
  ['John Doe', 'john@acme.com', '+1 415 555 0100', 'Acme Inc', 'CEO', 'Healthcare', '120000', 'LinkedIn Ad', 'North America', 'Jonah Pike', '2024-04-12'],
];

const SOURCES: { id: string; icon: string; title: string; sub: string; tag?: string }[] = [
  { id: 'file', icon: 'fileText', title: 'Upload a file', sub: 'CSV, Excel, TSV — or drag it in', tag: 'Most common' },
  { id: 'sheets', icon: 'sheet', title: 'Google Sheets', sub: 'Connect a live, syncing sheet' },
  { id: 'crm', icon: 'refresh', title: 'Connect a CRM', sub: 'HubSpot, Salesforce, Zoho, Pipedrive', tag: 'Migration' },
  { id: 'zapier', icon: 'zap', title: 'Zapier', sub: 'Route records in from 6,000+ apps' },
  { id: 'paste', icon: 'clipboard', title: 'Copy & paste', sub: 'Paste rows straight from a spreadsheet' },
  { id: 'db', icon: 'database', title: 'Database / API', sub: 'Postgres, MySQL, REST' },
];

const CRM_PROVIDERS = ['HubSpot', 'Salesforce', 'Zoho', 'Pipedrive'];
const ZAP_HOOK = 'https://hooks.dovehero.app/z/8f3k2m1';

/** Parse pasted spreadsheet text (tab / comma / semicolon separated, first line = headers). */
function parsePasted(text: string): { cols: string[]; rows: string[][] } | null {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (l: string) => l.split(delim).map((s) => s.trim());
  const cols = split(lines[0]);
  if (cols.length < 2) return null;
  const rows = lines.slice(1).map((l) => {
    const c = split(l);
    while (c.length < cols.length) c.push('');
    return c.slice(0, cols.length);
  });
  return { cols, rows };
}

/* ---- helpers ---- */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
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
function matchScore(col: string, label: string): number {
  const a = norm(col), b = norm(label);
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const ga = groupOf(a), gb = groupOf(b);
  if (ga && gb && ga === gb) return 1;
  return 0;
}

function transformVal(v: string, action?: RuleAction): string {
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

function coerce(v: string, type: FieldType): unknown {
  const s = (v ?? '').trim();
  if (type === 'number' || type === 'currency') return Number(s.replace(/[^0-9.\-]/g, '')) || 0;
  if (type === 'checkbox') return /^(yes|true|1|paid|active)$/i.test(s);
  return s;
}

const FIELD_TYPES: { k: FieldType; label: string }[] = [
  { k: 'text', label: 'Text' }, { k: 'number', label: 'Number' }, { k: 'email', label: 'Email' },
  { k: 'currency', label: 'Currency' }, { k: 'date', label: 'Date' }, { k: 'select', label: 'Dropdown' },
  { k: 'checkbox', label: 'Checkbox' }, { k: 'url', label: 'URL' }, { k: 'longtext', label: 'Long text' },
];
const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.k === t)?.label ?? 'Text';

/** A Nova (AI assistant) suggestion computed from the real grid — each has a one-click fix. */
interface NovaSug { id: string; tone: 'map' | 'clean' | 'dupe'; title: ReactNode; cta: string; apply: () => void }

/** What one import run actually did — kept so undo/redo can faithfully reverse it. */
interface AppliedUpdate { id: string; patch: Partial<ObjectRecord>; prevPatch: Partial<ObjectRecord> }
interface AppliedObj { created: ObjectRecord[]; updates: AppliedUpdate[]; skipped: number }
type Applied = Record<string, AppliedObj>;

export function ImportWizard() {
  const objects = useStore((s) => s.objects);
  const navObj = useStore((s) => s.nav);
  const setImport = useStore((s) => s.setImport);
  const addField = useStore((s) => s.addField);
  const importRecords = useStore((s) => s.importObjectRecords);
  const removeRecords = useStore((s) => s.removeObjectRecordsBatch);
  const updateObjectRecord = useStore((s) => s.updateObjectRecord);
  const objectRecords = useStore((s) => s.objectRecords);
  const setNav = useStore((s) => s.setNav);
  const toast = useStore((s) => s.toast);

  const defOf = (k: string): ObjectDef | undefined => objects.find((o) => o.k === k);

  // ---- wizard state (initialised once per open) ----
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(() => {
    const isObj = objects.some((o) => o.k === navObj);
    return [isObj ? navObj : 'contact'];
  });
  const [activeObj, setActiveObj] = useState<string>(selected[0]);

  // source selection + per-source connection state
  const [source, setSource] = useState<string | null>(null); // SOURCES id
  const [connected, setConnected] = useState<{ id: string; label: string; rows: number } | null>(null);
  const [srcDraft, setSrcDraft] = useState({
    sheetUrl: '',
    paste: '',
    dbHost: 'postgres://readonly@db.prod.dovehero:5432/crm',
    dbQuery: 'SELECT name, email, company FROM contacts LIMIT 500;',
  });

  const [cols, setCols] = useState<Col[]>(() => SAMPLE_COLS.map((name) => ({ name, map: null })));
  const [rows, setRows] = useState<string[][]>(() => SAMPLE_ROWS.map((r) => [...r]));
  const [, setGridHist] = useState<{ cols: Col[]; rows: string[][] }[]>([]);

  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editCol, setEditCol] = useState<number | null>(null);
  const [recIdx, setRecIdx] = useState(0);

  const [propModal, setPropModal] = useState<null | { colIdx: number }>(null);
  const [tagDraft, setTagDraft] = useState<string | null>(null); // null = not adding a tag
  const [novaDone, setNovaDone] = useState<Set<string>>(new Set()); // dismissed/applied Nova suggestions
  const novaDismiss = (id: string) => setNovaDone((s) => new Set(s).add(id));

  const [settings, setSettings] = useState({
    owner: 'Round-robin (Sales team)',
    team: 'Sales — EMEA',
    lifecycle: 'New lead',
    dedupe: 'update' as 'update' | 'skip' | 'create',
    tags: ['Imported', 'Q2-2024'],
    automations: false,
  });

  const [phase, setPhase] = useState<'wizard' | 'processing' | 'report'>('wizard');
  const [progress, setProgress] = useState(0);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [undone, setUndone] = useState(false);

  /* keep activeObj valid; re-seed automatic (non-user) mappings when the
     selected object set changes so columns land on the right destination. */
  useEffect(() => {
    if (!selected.includes(activeObj)) setActiveObj(selected[0] ?? '');
  }, [selected, activeObj]);

  /** Best destination for a column across the selected objects. A column named
      like an object itself ("Company") wins that object's Name property — it
      identifies the record, not a text field on another object. */
  const bestTarget = (colName: string): MapTarget => {
    let best: MapTarget = null;
    let bestScore = 0;
    for (const objKey of selected) {
      const def = defOf(objKey);
      if (!def) continue;
      for (const f of def.fields) {
        let sc = matchScore(colName, f.label);
        if (f.k === 'name' && (norm(colName) === norm(def.name) || norm(colName) === norm(def.plural))) sc = 4;
        if (sc > bestScore) { bestScore = sc; best = { obj: objKey, field: f.k }; }
      }
    }
    return best;
  };

  /** Nova infers which objects a file holds by scoring its column names against every object. */
  const novaDetectObjects = (names: string[]): string[] =>
    objects
      .map((o) => {
        let strong = 0;
        for (const nm of names) {
          let best = 0;
          for (const f of o.fields) {
            let sc = matchScore(nm, f.label);
            if (f.k === 'name' && (norm(nm) === norm(o.name) || norm(nm) === norm(o.plural))) sc = 4;
            best = Math.max(best, sc);
          }
          if (best >= 2) strong++;
        }
        return { k: o.k, strong };
      })
      .filter((s) => s.strong >= 2)
      .sort((a, b) => b.strong - a.strong)
      .map((s) => s.k);

  useEffect(() => {
    setCols((prev) => prev.map((c) => (c.userSet ? c : { ...c, map: bestTarget(c.name) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // esc to close
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || phase === 'processing') return;
      // Let inner layers (create-property modal, column/row popovers) close first —
      // don't tear down the whole wizard when a sub-layer is open.
      if (propModal) { setPropModal(null); return; }
      if (document.querySelector('.dh-modal-scrim, .dh-pop')) return;
      setImport(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [setImport, phase, propModal]);

  // processing animation
  useEffect(() => {
    if (phase !== 'processing') return;
    setProgress(0);
    const started = performance.now();
    const DURATION = 2400;
    const t = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - started) / DURATION);
      setProgress(p);
      if (p >= 1) {
        window.clearInterval(t);
        runImport();
        setPhase('report');
        setStep(3);
      }
    }, 60);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- derived ----
  const mappedCols = cols.filter((c) => c.map && !('skip' in c.map));
  const unmappedCount = cols.filter((c) => !c.map).length;
  const objsWithData = selected.filter((o) => mappedCols.some((c) => c.map && 'obj' in c.map && c.map.obj === o));
  // One record per row, per object that has ≥1 column mapped into it.
  const plannedCount = rows.length * Math.max(objsWithData.length, 0);

  const mapEncode = (m: MapTarget) => (m ? ('skip' in m ? 'skip' : `${m.obj}:::${m.field}`) : '');

  // ---- mutations ----
  const snap = () => setGridHist((h) => [...h.slice(-30), { cols: cols.map((c) => ({ ...c })), rows: rows.map((r) => [...r]) }]);

  const setMap = (i: number, v: string) => {
    setCols((prev) => prev.map((c, idx) => {
      if (idx !== i) return c;
      if (!v) return { ...c, map: null, userSet: false };
      if (v === 'skip') return { ...c, map: { skip: true }, userSet: true };
      const [obj, field] = v.split(':::');
      return { ...c, map: { obj, field }, userSet: true };
    }));
  };

  const toggleObj = (k: string) => {
    setSelected((prev) => {
      if (prev.includes(k)) {
        if (prev.length === 1) { toast('Keep at least one object', 'warn'); return prev; }
        return prev.filter((x) => x !== k);
      }
      return [...prev, k];
    });
  };

  // ---- source connection ----
  const automapCols = (names: string[]): Col[] => names.map((name) => ({ name, map: bestTarget(name) }));

  /** Every source lands here: load the dataset into the grid and mark the source connected. */
  const loadDataset = (id: string, label: string, colNames: string[], data: string[][]) => {
    setCols(automapCols(colNames));
    setRows(data.map((r) => [...r]));
    setGridHist([]);
    setRecIdx(0);
    setConnected({ id, label, rows: data.length });
  };

  const pickSource = (id: string) => {
    if (id === source) return;
    setSource(id);
    setConnected(null); // a different source must be connected before continuing
  };

  const connectFile = () => {
    loadDataset('file', 'contacts.csv · 12 KB', SAMPLE_COLS, SAMPLE_ROWS);
    toast('contacts.csv loaded · 8 rows', 'success');
  };
  const connectSheets = () => {
    if (!srcDraft.sheetUrl.trim()) return toast('Paste the sheet URL first', 'warn');
    loadDataset('sheets', 'Q2 pipeline · Sheet1', SAMPLE_COLS, SAMPLE_ROWS);
    toast('Sheet connected — stays in sync', 'success');
  };
  const connectCrm = (provider: string) => {
    loadDataset('crm', `${provider} · Contacts`, SAMPLE_COLS, SAMPLE_ROWS);
    toast(`Authorized with ${provider} via OAuth`, 'success');
  };
  const connectZapier = () => {
    loadDataset('zapier', 'Zap sample received', SAMPLE_COLS, SAMPLE_ROWS);
    toast('Sample payload received from your Zap', 'success');
  };
  const connectPaste = () => {
    const parsed = parsePasted(srcDraft.paste);
    if (!parsed) return toast('Need a header line + at least one data row', 'warn');
    loadDataset('paste', `Pasted · ${parsed.rows.length} rows`, parsed.cols, parsed.rows);
    toast(`Parsed ${parsed.rows.length} rows · ${parsed.cols.length} columns`, 'success');
  };
  const connectDb = () => {
    if (!srcDraft.dbQuery.trim()) return toast('Write a query first', 'warn');
    loadDataset('db', 'crm.contacts · query', SAMPLE_COLS, SAMPLE_ROWS);
    toast('Query ran · 8 rows returned', 'success');
  };

  const copyHook = async () => {
    try { await navigator.clipboard.writeText(ZAP_HOOK); toast('Webhook URL copied', 'success'); }
    catch { toast('Copy blocked — select the URL manually', 'warn'); }
  };

  const commitCell = (r: number, c: number, value: string) => {
    setEditCell(null);
    if (value === rows[r]?.[c]) return;
    snap();
    setRows((prev) => prev.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row)));
  };
  const commitColName = (i: number, value: string) => {
    setEditCol(null);
    const v = value.trim();
    if (!v || v === cols[i].name) return;
    snap();
    setCols((prev) => prev.map((c, idx) => (idx === i ? { ...c, name: v } : c)));
  };

  const addRow = () => { snap(); setRows((prev) => [...prev, cols.map(() => '')]); toast('Row added — fill it in'); };
  const addColumn = () => {
    snap();
    setCols((prev) => [...prev, { name: 'New column', map: null }]);
    setRows((prev) => prev.map((r) => [...r, '']));
    toast('Column added');
  };
  const insertRow = (ri: number, below: boolean) => { snap(); setRows((prev) => { const n = prev.map((r) => [...r]); n.splice(ri + (below ? 1 : 0), 0, cols.map(() => '')); return n; }); };
  const duplicateRow = (ri: number) => { snap(); setRows((prev) => { const n = prev.map((r) => [...r]); n.splice(ri + 1, 0, [...prev[ri]]); return n; }); toast('Row duplicated'); };
  const deleteRow = (ri: number) => { if (rows.length <= 1) return toast('Keep at least one row', 'warn'); snap(); setRows((prev) => prev.filter((_, i) => i !== ri)); toast('Row deleted'); };
  const insertColRight = (ci: number) => { snap(); setCols((prev) => { const n = [...prev]; n.splice(ci + 1, 0, { name: 'New column', map: null }); return n; }); setRows((prev) => prev.map((r) => { const n = [...r]; n.splice(ci + 1, 0, ''); return n; })); };
  const deleteCol = (ci: number) => { if (cols.length <= 1) return toast('Keep at least one column', 'warn'); snap(); setCols((prev) => prev.filter((_, i) => i !== ci)); setRows((prev) => prev.map((r) => r.filter((_, i) => i !== ci))); toast('Column removed'); };

  const applyRule = (ci: number, action: RuleAction) => {
    snap();
    setRows((prev) => prev.map((r) => r.map((v, i) => (i === ci ? transformVal(v, action) : v))));
    setCols((prev) => prev.map((c, i) => (i === ci ? { ...c, rule: action } : c)));
    toast(`${cols[ci].name} → ${RULE_LABEL[action]} · runs on import`, 'success');
  };
  const clearRule = (ci: number) => { setCols((prev) => prev.map((c, i) => (i === ci ? { ...c, rule: undefined } : c))); toast('Format rule removed'); };

  /** Nova picks the single best format rule for a column from its content. */
  const novaBestRule = (ci: number): RuleAction | null => {
    const c = cols[ci];
    const vals = rows.map((r) => r[ci]).filter((v) => v && v.trim());
    if (!vals.length) return null;
    const m = c.map;
    const f = m && 'obj' in m ? defOf(m.obj)?.fields.find((x) => x.k === m.field) : undefined;
    if (f?.type === 'email' || /email/.test(norm(c.name))) { if (vals.some((v) => /[A-Z]/.test(v))) return 'lower'; }
    if (rows.some((r) => { const v = r[ci] || ''; return v !== v.trim() || /\s{2,}/.test(v); })) return 'trim';
    if (!f || f.type === 'text' || f.type === 'longtext') {
      const upper = vals.filter((v) => v === v.toUpperCase() && /[a-z]/i.test(v)).length;
      const lower = vals.filter((v) => v === v.toLowerCase() && /[a-z]/.test(v)).length;
      if (upper > vals.length / 2 || lower > vals.length / 2) return 'title';
    }
    return null;
  };
  const novaCleanColumn = (ci: number) => {
    const rule = novaBestRule(ci);
    if (!rule) { toast(`Nova: “${cols[ci].name}” already looks clean`); return; }
    applyRule(ci, rule);
  };

  const gridUndo = () => {
    setGridHist((h) => {
      if (!h.length) { toast('Nothing to undo', 'warn'); return h; }
      const last = h[h.length - 1];
      setCols(last.cols.map((c) => ({ ...c })));
      setRows(last.rows.map((r) => [...r]));
      return h.slice(0, -1);
    });
  };

  /** Nova guesses a property type from a column's actual values + its name. */
  const inferType = (ci: number, name: string): FieldType => {
    const nm = norm(name);
    if (/phone|mobile|tel|fax/.test(nm)) return 'text'; // no phone type in the model
    const vals = rows.map((r) => r[ci]).filter((v) => v && v.trim());
    if (!vals.length) return 'text';
    if (vals.every((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()))) return 'email';
    if (vals.every((v) => /^https?:\/\//.test(v.trim()))) return 'url';
    if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v.trim()))) return 'date';
    if (vals.every((v) => /^[-+]?[\d.,\s]+$/.test(v.trim()))) return /value|price|amount|revenue|deal|cost|salary/.test(nm) ? 'currency' : 'number';
    // low-cardinality short strings → a dropdown
    const uniq = new Set(vals.map((v) => v.trim().toLowerCase()));
    if (uniq.size <= Math.max(2, Math.floor(vals.length / 2)) && [...uniq].every((v) => v.length < 24)) return 'select';
    return 'text';
  };

  const propKey = (name: string) => norm(name).replace(/(^[0-9]+)/, 'f$1') || 'f' + idSeqSuffix();

  /** Nova one-click: create a property (type inferred) on an object and map the column to it. */
  const novaCreateAndMap = (ci: number, objKey: string, type: FieldType) => {
    const name = cols[ci].name;
    const k = propKey(name);
    const field: FieldDef = { k, label: name, type };
    if (type === 'select') field.opts = [...new Set(rows.map((r) => (r[ci] || '').trim()).filter(Boolean))].slice(0, 12);
    addField(objKey, field);
    setCols((prev) => prev.map((c, i) => (i === ci ? { ...c, map: { obj: objKey, field: k }, userSet: true } : c)));
    toast(`Nova created “${name}” (${type}) on ${defOf(objKey)?.name} and mapped it`, 'success');
  };

  const createProperty = (objKey: string, name: string, type: FieldType, opts: string) => {
    const nm = name.trim();
    if (!nm) { toast('Give the property a name', 'warn'); return; }
    const k = norm(nm).replace(/(^[0-9]+)/, 'f$1') || 'f' + (idSeqSuffix());
    const field: FieldDef = { k, label: nm, type };
    if (type === 'select') field.opts = opts.split('\n').map((s) => s.trim()).filter(Boolean);
    addField(objKey, field);
    if (propModal && propModal.colIdx >= 0) {
      setCols((prev) => prev.map((c, i) => (i === propModal.colIdx ? { ...c, map: { obj: objKey, field: k }, userSet: true } : c)));
    }
    setPropModal(null);
    toast(`Created “${nm}” on ${defOf(objKey)?.name ?? objKey}${propModal && propModal.colIdx >= 0 ? ' and mapped it' : ''}`, 'success');
  };

  // ---- run the actual import ----
  const buildRecords = (): Record<string, ObjectRecord[]> => {
    const out: Record<string, ObjectRecord[]> = {};
    for (const objKey of selected) {
      const def = defOf(objKey);
      if (!def) continue;
      const mapped = cols
        .map((c, ci) => ({ c, ci }))
        .filter(({ c }) => c.map && 'obj' in c.map && c.map.obj === objKey);
      if (!mapped.length) continue;
      const prefix = objKey.slice(0, 2).toUpperCase();
      out[objKey] = rows.map((row, ri) => {
        const rec: ObjectRecord = { id: `${prefix}-${uid('imp').slice(-5)}-${ri}` };
        for (const { c, ci } of mapped) {
          const field = def.fields.find((f) => f.k === (c.map as { field: string }).field);
          if (!field) continue;
          rec[field.k] = coerce(transformVal(row[ci] ?? '', c.rule), field.type);
        }
        if (rec.name == null || rec.name === '') rec.name = `Imported ${def.name} ${ri + 1}`;
        return rec;
      });
    }
    return out;
  };

  /** Duplicate identity: contacts match by email (fallback name), everything else by name. */
  const keyOf = (objKey: string, rec: ObjectRecord): string => {
    const email = typeof rec.email === 'string' ? rec.email.trim().toLowerCase() : '';
    if (objKey === 'contact' && email) return 'e:' + email;
    return 'n:' + String(rec.name ?? '').trim().toLowerCase();
  };

  const runImport = () => {
    const payload = buildRecords();
    const out: Applied = {};
    for (const [objKey, recs] of Object.entries(payload)) {
      const index = new Map((objectRecords[objKey] ?? []).map((r) => [keyOf(objKey, r), r]));
      const seen = new Set<string>();
      const o: AppliedObj = { created: [], updates: [], skipped: 0 };
      for (const rec of recs) {
        const k = keyOf(objKey, rec);
        if (seen.has(k)) { // duplicate row inside the file itself
          if (settings.dedupe === 'create') o.created.push(rec); else o.skipped++;
          continue;
        }
        seen.add(k);
        const existing = index.get(k);
        if (!existing || settings.dedupe === 'create') { o.created.push(rec); continue; }
        if (settings.dedupe === 'skip') { o.skipped++; continue; }
        // update: patch the existing record, remembering prior values for undo
        const patch: Partial<ObjectRecord> = {};
        const prevPatch: Partial<ObjectRecord> = {};
        for (const key of Object.keys(rec)) {
          if (key === 'id') continue;
          patch[key] = rec[key];
          prevPatch[key] = existing[key] ?? '';
        }
        o.updates.push({ id: existing.id, patch, prevPatch });
      }
      out[objKey] = o;
    }
    importRecords(Object.fromEntries(Object.entries(out).map(([k, o]) => [k, o.created])));
    for (const [k, o] of Object.entries(out)) o.updates.forEach((u) => updateObjectRecord(k, u.id, u.patch));
    setApplied(out);
    setUndone(false);
  };

  const counts = (() => {
    let created = 0, updated = 0, skipped = 0;
    if (applied) for (const o of Object.values(applied)) { created += o.created.length; updated += o.updates.length; skipped += o.skipped; }
    return { created, updated, skipped, total: created + updated + skipped };
  })();

  const undoImport = () => {
    if (!applied) return;
    removeRecords(Object.fromEntries(Object.entries(applied).map(([k, o]) => [k, o.created.map((r) => r.id)])));
    for (const [k, o] of Object.entries(applied)) o.updates.forEach((u) => updateObjectRecord(k, u.id, u.prevPatch));
    setUndone(true);
    toast('Import undone — created records removed, updates reverted', 'warn');
  };
  const redoImport = () => {
    if (!applied) return;
    importRecords(Object.fromEntries(Object.entries(applied).map(([k, o]) => [k, o.created])));
    for (const [k, o] of Object.entries(applied)) o.updates.forEach((u) => updateObjectRecord(k, u.id, u.patch));
    setUndone(false);
    toast('Import re-applied', 'success');
  };

  const downloadReport = () => {
    if (!applied) return;
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = ['object,record id,name,action'];
    for (const [k, o] of Object.entries(applied)) {
      const plural = defOf(k)?.plural ?? k;
      o.created.forEach((r) => lines.push([esc(plural), esc(r.id), esc(r.name), 'created'].join(',')));
      o.updates.forEach((u) => lines.push([esc(plural), esc(u.id), esc(u.patch.name), 'updated'].join(',')));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_report.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('import_report.csv downloaded', 'success');
  };

  const saveTemplate = () => {
    const tpl = { selected, mappings: cols.map((c) => ({ name: c.name, map: c.map, rule: c.rule })), settings };
    try { localStorage.setItem('dh-import-template', JSON.stringify(tpl)); } catch { /* storage full — template stays session-only */ }
    toast(`Template saved — mappings, rules & settings`, 'success');
  };

  const close = () => setImport(false);
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const goStep = (i: number) => { if (i <= step && phase === 'wizard') setStep(i); };

  const viewRecords = () => {
    const target = objsWithData[0] ?? selected[0];
    setImport(false);
    setNav(target);
  };

  // =================================================================
  return (
    <div className="dh-imp" role="dialog" aria-modal="true" aria-label="Import wizard">
      {/* top bar */}
      <div className="dh-imp-top">
        <div className="dh-imp-brand"><span className="dh-imp-mark"><Icon name="upload" size={15} color="#fff" strokeWidth={2.2} /></span>Import data</div>
        <div className="dh-imp-stepper">
          {STEPS.map((s, i) => (
            <div key={s} className="dh-imp-stp-wrap">
              <button
                className={`dh-imp-stp ${i < step ? 'done' : i === step ? 'on' : ''}`}
                onClick={() => goStep(i)}
                disabled={i > step || phase !== 'wizard'}
                title={STEP_HINT[i]}
              >
                <span className="sn">{i < step ? <Icon name="check" size={13} strokeWidth={2.8} /> : i + 1}</span>
                <span className="sl"><b>{s}</b><em>{STEP_HINT[i]}</em></span>
              </button>
              {i < STEPS.length - 1 && <span className={`dh-imp-bar ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
        <button className="dh-imp-close" onClick={close} title="Close (Esc)" aria-label="Close import">
          <Icon name="x" size={17} />
        </button>
      </div>

      {/* body */}
      <div className={`dh-imp-body ${phase === 'processing' || phase === 'report' ? 'is-center' : ''}`}>
        {phase === 'processing'
          ? renderProcessing()
          : phase === 'report'
            ? renderReport()
            : [renderStart, renderData, renderRecords][step]?.()}
      </div>

      {/* footer */}
      {phase === 'wizard' && (
        <div className="dh-imp-foot">
          {step > 0 && <Button variant="default" onClick={back}><Icon name="arrowLeft" size={15} /> Back</Button>}
          <span className="dh-imp-foot-note">Step {step + 1} of {STEPS.length} · {STEP_HINT[step]}</span>
          <span className="dh-imp-grow" />
          {step === 0 && (
            <Button className="dh-imp-cta" variant="primary" onClick={next} disabled={!selected.length || !connected}>
              {connected ? <>Map &amp; clean {connected.rows} rows</> : 'Connect a source to continue'} <Icon name="arrowRight" size={15} />
            </Button>
          )}
          {step === 1 && <Button className="dh-imp-cta" variant="primary" onClick={next}>Review &amp; configure <Icon name="arrowRight" size={15} /></Button>}
          {step === 2 && (
            <Button className="dh-imp-cta" variant="primary" onClick={() => setPhase('processing')} disabled={plannedCount === 0}>
              Import {plannedCount.toLocaleString()} record{plannedCount === 1 ? '' : 's'} <Icon name="arrowRight" size={15} />
            </Button>
          )}
        </div>
      )}

      {/* create-property modal */}
      {propModal && (
        <PropModal
          objects={selected.map((k) => defOf(k)).filter(Boolean) as ObjectDef[]}
          initialName={propModal.colIdx >= 0 ? cols[propModal.colIdx]?.name ?? '' : ''}
          onCancel={() => setPropModal(null)}
          onCreate={createProperty}
        />
      )}
    </div>
  );

  // ---------------- step renderers ----------------
  function renderSourceConfig(id: string) {
    const isConn = connected?.id === id;
    if (id === 'file') {
      return (
        <div className="dh-imp-srccfg">
          <button className="dh-imp-drop" onClick={connectFile}>
            <Icon name="upload" size={20} />
            <div><b>{isConn ? 'Replace contacts.csv' : 'Drop your file here'}</b><span>or click to browse — CSV, Excel, TSV</span></div>
          </button>
        </div>
      );
    }
    if (id === 'sheets') {
      return (
        <div className="dh-imp-srccfg">
          <label>Sheet URL</label>
          <div className="dh-imp-cfgrow">
            <input className="dh-imp-cfginput" placeholder="https://docs.google.com/spreadsheets/d/…"
              value={srcDraft.sheetUrl} onChange={(e) => setSrcDraft((d) => ({ ...d, sheetUrl: e.target.value }))} />
            <Button variant="primary" size="sm" onClick={connectSheets} disabled={!srcDraft.sheetUrl.trim()}>Connect</Button>
          </div>
          <p className="dh-imp-cfghint">Read-only access · re-syncs on every import run</p>
        </div>
      );
    }
    if (id === 'crm') {
      return (
        <div className="dh-imp-srccfg">
          <label>Choose your CRM — we'll open its OAuth consent</label>
          <div className="dh-imp-providers">
            {CRM_PROVIDERS.map((pr) => (
              <button key={pr} className={`dh-imp-provider ${isConn && connected?.label.startsWith(pr) ? 'on' : ''}`} onClick={() => connectCrm(pr)}>{pr}</button>
            ))}
          </div>
          <p className="dh-imp-cfghint">We only request read scopes on contacts &amp; companies</p>
        </div>
      );
    }
    if (id === 'zapier') {
      return (
        <div className="dh-imp-srccfg">
          <label>Point your Zap's webhook action at</label>
          <div className="dh-imp-cfgrow">
            <code className="dh-imp-hook mono">{ZAP_HOOK}</code>
            <Button variant="default" size="sm" onClick={copyHook}><Icon name="clipboard" size={14} /> Copy</Button>
          </div>
          <div className="dh-imp-cfgrow" style={{ marginTop: 8 }}>
            <Button variant="primary" size="sm" onClick={connectZapier}>I've sent a sample</Button>
            {!isConn && <span className="dh-imp-cfghint" style={{ margin: 0 }}>waiting for a sample payload…</span>}
          </div>
        </div>
      );
    }
    if (id === 'paste') {
      return (
        <div className="dh-imp-srccfg">
          <label>Paste rows — first line is treated as headers (tabs or commas)</label>
          <textarea className="dh-imp-cfginput area mono" rows={4}
            placeholder={'Name\tEmail\tCompany\nJane Doe\tjane@acme.com\tAcme Inc'}
            value={srcDraft.paste} onChange={(e) => setSrcDraft((d) => ({ ...d, paste: e.target.value }))} />
          <div className="dh-imp-cfgrow">
            <Button variant="primary" size="sm" onClick={connectPaste} disabled={!srcDraft.paste.trim()}>Parse &amp; load</Button>
            <span className="dh-imp-cfghint" style={{ margin: 0 }}>your columns replace the sample grid</span>
          </div>
        </div>
      );
    }
    return (
      <div className="dh-imp-srccfg">
        <label>Connection</label>
        <input className="dh-imp-cfginput mono" value={srcDraft.dbHost} onChange={(e) => setSrcDraft((d) => ({ ...d, dbHost: e.target.value }))} />
        <label style={{ marginTop: 8 }}>Query</label>
        <textarea className="dh-imp-cfginput area mono" rows={2}
          value={srcDraft.dbQuery} onChange={(e) => setSrcDraft((d) => ({ ...d, dbQuery: e.target.value }))} />
        <div className="dh-imp-cfgrow">
          <Button variant="primary" size="sm" onClick={connectDb} disabled={!srcDraft.dbQuery.trim()}>Run query</Button>
          <span className="dh-imp-cfghint" style={{ margin: 0 }}>read-only · results become your import rows</span>
        </div>
      </div>
    );
  }

  function renderStart() {
    return (
      <div className="dh-imp-wide dh-imp-start">
        <h1 className="dh-imp-h1">What are you importing, and from where?</h1>
        <p className="dh-imp-lead">Pick your record types, then connect a source. The connected data flows straight into the next step for mapping and cleanup.</p>

        <div className="dh-imp-start-grid">
          <section className="dh-imp-start-col">
            <div className="dh-imp-sub"><span className="dh-imp-numdot">1</span> Record types</div>
            <div className="dh-imp-objgrid compact">
              {objects.map((o) => {
                const on = selected.includes(o.k);
                const recommended = o.k === 'contact';
                return (
                  <button key={o.k} className={`dh-imp-objcard ${on ? 'on' : ''}`} onClick={() => toggleObj(o.k)} aria-pressed={on}>
                    <span className="dh-imp-objcard-corner">
                      {on
                        ? <span className="dh-imp-objcard-check"><Icon name="check" size={12} strokeWidth={3} /></span>
                        : recommended ? <span className="dh-imp-objcard-badge">Rec.</span> : null}
                    </span>
                    <span className="dh-imp-objcard-ic"><Icon name={o.icon} size={19} /></span>
                    <span className="dh-imp-objcard-name">{o.plural}</span>
                    <span className="dh-imp-objcard-meta">{o.fields.length} properties</span>
                  </button>
                );
              })}
            </div>
            {selected.length > 1 && (
              <div className="dh-imp-banner ok slim"><Icon name="check" size={14} /> {selected.map((k) => defOf(k)?.plural ?? k).join(' + ')} import together &amp; link automatically.</div>
            )}
            {(() => {
              if (!connected) return null;
              // Suggest the single strongest object we're not yet importing; it re-suggests the next after you add one.
              const next = novaDetectObjects(cols.map((c) => c.name)).find((k) => !selected.includes(k));
              if (!next) return null;
              return (
                <div className="dh-imp-nova-rec slim">
                  <span className="dh-imp-nova-badge"><Icon name="sparkles" size={12} /></span>
                  <span className="dh-imp-grow"><b>Nova</b> · your columns also look like <b>{defOf(next)?.plural}</b> — import them too?</span>
                  <button className="dh-imp-nova-cta" onClick={() => setSelected((prev) => [...new Set([...prev, next])])}>Add {defOf(next)?.plural}</button>
                </div>
              );
            })()}
          </section>

          <section className="dh-imp-start-col">
            <div className="dh-imp-sub"><span className="dh-imp-numdot">2</span> Connect a source</div>
            <div className="dh-imp-srclist">
              {SOURCES.map((c) => {
                const on = source === c.id;
                const isConn = connected?.id === c.id;
                return (
                  <div key={c.id} className={`dh-imp-srcitem ${on ? 'open' : ''}`}>
                    <button className={`dh-imp-srcrow ${on ? 'on' : ''}`} onClick={() => pickSource(c.id)} aria-pressed={on} aria-expanded={on}>
                      <span className="dh-imp-si"><Icon name={c.icon} size={19} /></span>
                      <div className="dh-imp-grow">
                        <b>{c.title}{c.tag && <span className="dh-imp-tag">{c.tag}</span>}</b>
                        {isConn
                          ? <p className="dh-imp-connline"><Icon name="check" size={12} strokeWidth={3} /> Connected · {connected.label} · {connected.rows} rows</p>
                          : <p>{c.sub}</p>}
                      </div>
                      <span className={`dh-imp-srcradio ${isConn ? 'conn' : on ? 'on' : ''}`}>{(on || isConn) && <Icon name="check" size={12} strokeWidth={3} />}</span>
                    </button>
                    {on && renderSourceConfig(c.id)}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function mapSelect(i: number, m: MapTarget, className: string) {
    return (
      <select className={className} value={mapEncode(m)} onChange={(e) => setMap(i, e.target.value)}>
        <option value="">— Not mapped —</option>
        {selected.map((objKey) => {
          const def = defOf(objKey);
          if (!def) return null;
          return (
            <optgroup key={objKey} label={def.plural}>
              {def.fields.map((f) => <option key={f.k} value={`${objKey}:::${f.k}`}>{f.label}</option>)}
            </optgroup>
          );
        })}
        <option value="skip">Don't import</option>
      </select>
    );
  }

  /** Nova's read of the current grid — real analysis, each finding one-click fixable. */
  function novaScan(): NovaSug[] {
    const out: NovaSug[] = [];
    // 1) unmapped columns — map to a match, or create a property with an inferred type
    cols.forEach((c, ci) => {
      if (c.map) return;
      const id = 'unmap-' + ci + '-' + norm(c.name);
      if (novaDone.has(id)) return;
      const t = bestTarget(c.name);
      if (t && 'obj' in t) {
        const def = defOf(t.obj);
        const f = def?.fields.find((x) => x.k === t.field);
        out.push({ id, tone: 'map', cta: 'Map it',
          title: <>Map <b>{c.name}</b> to {def?.plural} · {f?.label}</>,
          apply: () => { setMap(ci, `${t.obj}:::${t.field}`); novaDismiss(id); } });
      } else {
        const objKey = selected[0];
        const type = inferType(ci, c.name);
        out.push({ id, tone: 'map', cta: `Create ${typeLabel(type)}`,
          title: <>No match for <b>{c.name}</b> — create it as a <b>{typeLabel(type).toLowerCase()}</b> on {defOf(objKey)?.plural}</>,
          apply: () => { novaCreateAndMap(ci, objKey, type); novaDismiss(id); } });
      }
    });
    // 2) stray whitespace on a mapped column
    cols.forEach((c, ci) => {
      if (!c.map || 'skip' in c.map || c.rule) return;
      const id = 'ws-' + ci + '-' + norm(c.name);
      if (novaDone.has(id)) return;
      if (rows.some((r) => { const v = r[ci] || ''; return v !== v.trim() || /\s{2,}/.test(v); }))
        out.push({ id, tone: 'clean', cta: 'Trim',
          title: <><b>{c.name}</b> has stray spaces — trim on import</>,
          apply: () => { applyRule(ci, 'trim'); novaDismiss(id); } });
    });
    // 3) uppercase in an email column
    cols.forEach((c, ci) => {
      if (!c.map || 'skip' in c.map || c.rule) return;
      const def = defOf(c.map.obj);
      const f = def?.fields.find((x) => x.k === (c.map as { field: string }).field);
      if (!(f?.type === 'email' || /email/.test(norm(c.name)))) return;
      const id = 'lc-' + ci;
      if (novaDone.has(id)) return;
      if (rows.some((r) => /[A-Z]/.test(r[ci] || '')))
        out.push({ id, tone: 'clean', cta: 'Lowercase',
          title: <><b>{c.name}</b> has mixed-case emails — lowercase them</>,
          apply: () => { applyRule(ci, 'lower'); novaDismiss(id); } });
    });
    // 4) duplicate rows within the file — check every object that has data
    if (settings.dedupe !== 'skip') {
      for (const dobj of objsWithData) {
        const id = 'dupe-' + dobj;
        if (novaDone.has(id)) continue;
        const def = defOf(dobj);
        const mapped = cols.map((c, ci) => ({ c, ci })).filter(({ c }) => c.map && 'obj' in c.map && c.map.obj === dobj);
        const seen = new Set<string>();
        let dupes = 0;
        rows.forEach((row) => {
          const rec: ObjectRecord = { id: 'x' };
          mapped.forEach(({ c, ci }) => { const f = def?.fields.find((x) => x.k === (c.map as { field: string }).field); if (f) rec[f.k] = coerce(transformVal(row[ci] || '', c.rule), f.type); });
          const k = keyOf(dobj, rec);
          if (seen.has(k)) dupes++; else seen.add(k);
        });
        if (dupes > 0) out.push({ id, tone: 'dupe', cta: 'Skip dupes',
          title: <>Found <b>{dupes} duplicate {def?.name.toLowerCase()} row{dupes > 1 ? 's' : ''}</b> — skip {dupes > 1 ? 'them' : 'it'} on import</>,
          apply: () => { setSettings((s) => ({ ...s, dedupe: 'skip' })); novaDismiss(id); } });
      }
    }
    return out.slice(0, 6);
  }

  /** How many import rows already exist in the store (drives the "use Update" nudge). */
  function existingMatchCount(): number {
    let n = 0;
    const payload = buildRecords();
    for (const [objKey, recs] of Object.entries(payload)) {
      const idx = new Set((objectRecords[objKey] ?? []).map((r) => keyOf(objKey, r)));
      const seen = new Set<string>();
      for (const rec of recs) { const k = keyOf(objKey, rec); if (idx.has(k) || seen.has(k)) n++; seen.add(k); }
    }
    return n;
  }

  /** One subtle Nova nudge for the Configure step, if the data warrants it. */
  function novaConfigRec(): { text: ReactNode; cta: string; apply: () => void } | null {
    const ownerMapped = cols.some((c) => c.map && 'obj' in c.map && (
      defOf(c.map.obj)?.fields.find((f) => f.k === (c.map as { field: string }).field)?.k === 'owner' || /owner|assigned|rep/.test(norm(c.name))
    ));
    if (ownerMapped && settings.owner !== 'From “Owner” column')
      return { text: <>Your file has an <b>Owner</b> column — assign records from it instead of round-robin?</>, cta: 'Use it', apply: () => setSettings((s) => ({ ...s, owner: 'From “Owner” column' })) };
    const m = existingMatchCount();
    if (m > 0 && settings.dedupe !== 'update')
      return { text: <><b>{m}</b> row{m > 1 ? 's' : ''} match an existing record — <b>Update</b> keeps them fresh instead of duplicating.</>, cta: 'Use Update', apply: () => setSettings((s) => ({ ...s, dedupe: 'update' })) };
    return null;
  }

  function renderData() {
    const ruleCount = cols.filter((c) => c.rule).length;
    const sugs = novaScan();
    return (
      <div className="dh-imp-wide">
        <div className="dh-imp-headrow">
          <div>
            <h1 className="dh-imp-h1">Map &amp; clean your data</h1>
            <p className="dh-imp-lead">Nova auto-mapped your columns and reviewed the values. Accept its fixes below, or edit by hand — double-click cells, or use a column's <b>⋯</b> menu for format rules.</p>
          </div>
        </div>

        {sugs.length > 0 ? (
          <div className="dh-imp-nova">
            <div className="dh-imp-nova-head">
              <span className="dh-imp-nova-badge"><Icon name="sparkles" size={13} /></span>
              <b>Nova reviewed {rows.length} rows</b>
              <span className="dh-imp-nova-count">{sugs.length} suggestion{sugs.length > 1 ? 's' : ''}</span>
              <span className="dh-imp-grow" />
              <button className="dh-imp-nova-all" onClick={() => sugs.forEach((s) => s.apply())}>Apply all</button>
              <button className="dh-imp-nova-x" title="Dismiss all" onClick={() => setNovaDone((prev) => { const n = new Set(prev); sugs.forEach((s) => n.add(s.id)); return n; })}><Icon name="x" size={14} /></button>
            </div>
            <div className="dh-imp-nova-list">
              {sugs.map((s) => (
                <div key={s.id} className={`dh-imp-nova-item t-${s.tone}`}>
                  <span className="dh-imp-nova-dot" />
                  <span className="dh-imp-grow">{s.title}</span>
                  <button className="dh-imp-nova-cta" onClick={s.apply}>{s.cta}</button>
                  <button className="dh-imp-nova-x sm" title="Dismiss" onClick={() => novaDismiss(s.id)}><Icon name="x" size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="dh-imp-nova clean">
            <span className="dh-imp-nova-badge"><Icon name="sparkles" size={13} /></span>
            <b>Nova reviewed your data</b><span className="dh-imp-nova-clean-txt">— mapping &amp; formatting look good.</span>
          </div>
        )}

        <div className="dh-imp-xltoolbar">
          <span className={`dh-imp-banner ${unmappedCount ? 'warn' : 'ok'}`} style={{ margin: 0 }}>
            <Icon name={unmappedCount ? 'alert' : 'check'} size={15} />
            {mappedCols.length} of {cols.length} columns mapped{unmappedCount ? ` · ${unmappedCount} to fix` : ''} · {rows.length} rows
            {ruleCount > 0 && <> · <Icon name="wand" size={13} /> {ruleCount} rule{ruleCount > 1 ? 's' : ''}</>}
          </span>
          <span className="dh-imp-grow" />
          <Button variant="default" size="sm" onClick={() => setPropModal({ colIdx: -1 })}><Icon name="plus" size={15} /> Property</Button>
          <Button variant="default" size="sm" onClick={gridUndo}><Icon name="undo" size={15} /> Undo</Button>
          <Button variant="default" size="sm" onClick={addColumn}><Icon name="plus" size={15} /> Column</Button>
          <Button variant="default" size="sm" onClick={addRow}><Icon name="plus" size={15} /> Row</Button>
        </div>
        <div className="dh-imp-xlwrap">
          <table className="dh-imp-xl">
            <thead>
              <tr>
                <th className="corner" />
                {cols.map((c, ci) => {
                  const m = c.map;
                  const target = m && 'obj' in m ? m : null;
                  return (
                    <th key={ci}>
                      <div className="dh-imp-colh">
                        <div className="dh-imp-chtop">
                          {editCol === ci ? (
                            <input
                              className="dh-imp-cn-input" autoFocus defaultValue={c.name}
                              onBlur={(e) => commitColName(ci, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCol(null); }}
                            />
                          ) : (
                            <span className="dh-imp-cn" onDoubleClick={() => setEditCol(ci)} title="Double-click to rename">{c.name}</span>
                          )}
                          {c.rule && <span className="dh-imp-rulechip" title={`On import: ${RULE_LABEL[c.rule]}`}><Icon name="wand" size={12} /></span>}
                          <Popover
                            align="start" width={224}
                            trigger={({ toggle }) => <button className="dh-imp-cbtn" title="Column options" onClick={toggle}><Icon name="more" size={14} /></button>}
                          >
                            {(cls) => (
                              <>
                                <MenuItem icon={<span className="dh-imp-menu-nova"><Icon name="sparkles" size={12} /></span>} onClick={() => { novaCleanColumn(ci); cls(); }}>Clean with Nova</MenuItem>
                                <div className="dh-imp-msep" />
                                <div className="dh-imp-mlabel"><Icon name="wand" size={12} /> Format rule · runs on import</div>
                                {(['trim', 'upper', 'sentence', 'lower', 'title'] as RuleAction[]).map((a) => (
                                  <MenuItem key={a} active={c.rule === a} onClick={() => { applyRule(ci, a); cls(); }}>{RULE_LABEL[a]}</MenuItem>
                                ))}
                                {c.rule && <MenuItem danger onClick={() => { clearRule(ci); cls(); }}>Remove format rule</MenuItem>}
                                <div className="dh-imp-msep" />
                                <MenuItem onClick={() => { insertColRight(ci); cls(); }}>Insert column right</MenuItem>
                                <MenuItem danger onClick={() => { deleteCol(ci); cls(); }}>Delete column</MenuItem>
                              </>
                            )}
                          </Popover>
                        </div>
                        <div className="dh-imp-hmapwrap">
                          {target && <span className="dh-imp-objdot sm">{defOf(target.obj)?.plural}</span>}
                          {mapSelect(ci, m, `dh-imp-hmap ${!m || (m && 'skip' in m) ? 'skip' : ''}`)}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <td className="rownum">
                    <span className="rnum">{ri + 1}</span>
                    <Popover
                      align="start" width={200}
                      trigger={({ toggle }) => <button className="dh-imp-rbtn" title="Row options" onClick={toggle}><Icon name="more" size={13} /></button>}
                    >
                      {(cls) => (
                        <>
                          <MenuItem onClick={() => { insertRow(ri, false); cls(); }}>Insert row above</MenuItem>
                          <MenuItem onClick={() => { insertRow(ri, true); cls(); }}>Insert row below</MenuItem>
                          <MenuItem onClick={() => { duplicateRow(ri); cls(); }}>Duplicate row</MenuItem>
                          <div className="dh-imp-msep" />
                          <MenuItem danger onClick={() => { deleteRow(ri); cls(); }}>Delete row</MenuItem>
                        </>
                      )}
                    </Popover>
                  </td>
                  {r.map((v, ci) => (
                    <td key={ci} className="cell" onDoubleClick={() => setEditCell({ r: ri, c: ci })}>
                      {editCell && editCell.r === ri && editCell.c === ci ? (
                        <input
                          className="dh-imp-cell-input" autoFocus defaultValue={v}
                          onBlur={(e) => commitCell(ri, ci, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCell(null); }}
                        />
                      ) : (v || '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button className="dh-imp-addrow" onClick={addRow}><Icon name="plus" size={15} /> Add a row</button>
        </div>
      </div>
    );
  }

  function renderRecords() {
    const act = activeObj;
    const def = defOf(act);
    const row = rows[recIdx] || rows[0] || [];
    const fieldFor = (fk: string) => {
      const ci = cols.findIndex((c) => c.map && 'obj' in c.map && c.map.obj === act && c.map.field === fk);
      return ci >= 0 ? transformVal(row[ci] ?? '', cols[ci].rule) : '';
    };
    const mappedFields = def
      ? def.fields.filter((f) => cols.some((c) => c.map && 'obj' in c.map && c.map.obj === act && c.map.field === f.k))
      : [];
    const nameVal = fieldFor('name') || `${def?.name ?? 'Record'} ${recIdx + 1}`;
    const inits = String(nameVal).split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const flip = (d: number) => setRecIdx((i) => (i + d + rows.length) % rows.length);

    return (
      <div className="dh-imp-wide">
        <h1 className="dh-imp-h1">Review &amp; configure</h1>
        <p className="dh-imp-lead">A live preview of each record, plus how they're assigned and handled on import.{cols.some((c) => c.rule) && <> <b>{cols.filter((c) => c.rule).length} format rule{cols.filter((c) => c.rule).length > 1 ? 's' : ''}</b> will run.</>}</p>

        {selected.length > 1 && (
          <div className="dh-imp-otabs">
            {selected.map((k) => (
              <button key={k} className={`dh-imp-otab ${k === activeObj ? 'on' : ''}`} onClick={() => setActiveObj(k)}>{defOf(k)?.plural}</button>
            ))}
          </div>
        )}

        <div className="dh-imp-rs">
          <div className="dh-imp-reccard">
            <div className="dh-imp-rechead">
              <div className="dh-imp-recav">{inits || '?'}</div>
              <div>
                <div className="rn">{nameVal}</div>
                <div className="rt">{def?.name}</div>
              </div>
            </div>
            <div className="dh-imp-recfields">
              {mappedFields.length ? mappedFields.map((f) => {
                const val = fieldFor(f.k);
                return (
                  <div key={f.k} className="dh-imp-recf"><span className="k">{f.label}</span><span className={`v mono ${val ? '' : 'empty'}`}>{val || 'empty'}</span></div>
                );
              }) : <div className="dh-imp-recf"><span className="k" style={{ color: 'var(--amber)' }}>No columns mapped into {def?.plural} yet</span></div>}
            </div>
            <div className="dh-imp-recpager">
              <button onClick={() => flip(-1)}><Icon name="chevronLeft" size={16} /></button>
              {def?.name} · record {recIdx + 1} of {rows.length}
              <button onClick={() => flip(1)}><Icon name="chevronRight" size={16} /></button>
            </div>
          </div>

          <div>
            {(() => {
              const rec = novaConfigRec();
              return rec ? (
                <div className="dh-imp-nova-rec">
                  <span className="dh-imp-nova-badge"><Icon name="sparkles" size={12} /></span>
                  <span className="dh-imp-grow"><b>Nova</b> · {rec.text}</span>
                  <button className="dh-imp-nova-cta" onClick={rec.apply}>{rec.cta}</button>
                </div>
              ) : null;
            })()}
            <div className="dh-imp-sub" style={{ marginTop: 0 }}>Assignment rules</div>
            <div className="dh-imp-setcard">
              <SetRow label="Record owner" sub="Who these records get assigned to">
                <select className="dh-imp-field" value={settings.owner} onChange={(e) => setSettings((s) => ({ ...s, owner: e.target.value }))}>
                  <option>Round-robin (Sales team)</option><option>From “Owner” column</option><option>Amara Reyes</option>
                </select>
              </SetRow>
              <SetRow label="Team / territory" sub="Route by region">
                <select className="dh-imp-field" value={settings.team} onChange={(e) => setSettings((s) => ({ ...s, team: e.target.value }))}>
                  <option>Sales — EMEA</option><option>Sales — APAC</option><option>Auto from Region</option>
                </select>
              </SetRow>
              <SetRow label="Lifecycle stage" sub="Set every record to">
                <select className="dh-imp-field" value={settings.lifecycle} onChange={(e) => setSettings((s) => ({ ...s, lifecycle: e.target.value }))}>
                  <option>New lead</option><option>Marketing qualified</option><option>Customer</option>
                </select>
              </SetRow>
            </div>
            <div className="dh-imp-sub">Import behaviour</div>
            <div className="dh-imp-setcard">
              <SetRow label="If a record already exists" sub="Contacts match by email · others by name">
                <div className="dh-imp-seg">
                  {(['update', 'skip', 'create'] as const).map((m) => (
                    <button key={m} className={settings.dedupe === m ? 'on' : ''}
                      title={m === 'update' ? 'Existing record gets the new values' : m === 'skip' ? 'Duplicate rows are not imported' : 'Import everything, even duplicates'}
                      onClick={() => setSettings((s) => ({ ...s, dedupe: m }))}>{m === 'update' ? 'Update' : m === 'skip' ? 'Skip' : 'Create new'}</button>
                  ))}
                </div>
              </SetRow>
              <SetRow label="Tags" sub="Added to every record">
                <div className="dh-imp-tags">
                  {settings.tags.map((t) => (
                    <span key={t} className="dh-imp-tag2">
                      {t}
                      <button className="dh-imp-tagx" aria-label={`Remove tag ${t}`}
                        onClick={() => setSettings((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) }))}>
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                  {tagDraft !== null ? (
                    <input
                      className="dh-imp-taginput" autoFocus value={tagDraft} placeholder="Tag name"
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          const t = tagDraft.trim();
                          if (t && !settings.tags.includes(t)) setSettings((s) => ({ ...s, tags: [...s.tags, t] }));
                          setTagDraft(null);
                        }
                        if (e.key === 'Escape') setTagDraft(null);
                      }}
                      onBlur={() => setTagDraft(null)}
                    />
                  ) : (
                    <button className="dh-imp-tag2 add" onClick={() => setTagDraft('')}>+ Tag</button>
                  )}
                </div>
              </SetRow>
              <SetRow label="Run automations" sub="Fire workflows & emails for imported records">
                <button className={`dh-imp-sw ${settings.automations ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, automations: !s.automations }))} aria-pressed={settings.automations} />
              </SetRow>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderProcessing() {
    const stages = ['Validating records', 'Matching duplicates', 'Assigning owners', 'Creating records', 'Finishing up'];
    const si = Math.min(stages.length - 1, Math.floor(progress * stages.length));
    const r = 56, c = 2 * Math.PI * r;
    return (
      <div className="dh-imp-center">
        <div className="dh-imp-procwrap">
          <div className="dh-imp-ring">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border-2)" strokeWidth="9" />
              <circle cx="65" cy="65" r={r} fill="none" stroke="url(#impg)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 65 65)" />
              <defs><linearGradient id="impg"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
            </svg>
            <div className="pn mono">{Math.round(progress * 100)}%</div>
          </div>
          <h1 className="dh-imp-h1">Importing…</h1>
          <p className="dh-imp-lead">Applying your mappings, edits and rules to {plannedCount.toLocaleString()} records across {objsWithData.map((k) => defOf(k)?.plural).join(', ')}.</p>
          <div className="dh-imp-stages">
            {stages.map((s, i) => (
              <div key={s} className={`dh-imp-stg ${i < si ? 'done' : i === si ? 'active' : ''}`}>
                <span className="sd">{i < si ? <Icon name="check" size={11} strokeWidth={2.8} /> : i + 1}</span>{s}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderReport() {
    const objKeys = applied ? Object.keys(applied).filter((k) => {
      const o = applied[k];
      return o.created.length + o.updates.length + o.skipped > 0;
    }) : [];
    return (
      <div className="dh-imp-wide">
        <div className={`dh-imp-rpttop ${undone ? 'undone' : ''}`}>
          <div className="rm"><Icon name={undone ? 'undo' : 'check'} size={24} strokeWidth={2.4} color="#fff" /></div>
          <div>
            <h2>{undone ? 'Import undone' : 'Import complete'}</h2>
            <p>{undone
              ? `Rolled back — ${counts.created.toLocaleString()} created record${counts.created === 1 ? '' : 's'} removed and ${counts.updated.toLocaleString()} update${counts.updated === 1 ? '' : 's'} reverted.`
              : `${counts.total.toLocaleString()} rows processed: ${counts.created.toLocaleString()} created, ${counts.updated.toLocaleString()} updated, ${counts.skipped.toLocaleString()} duplicate${counts.skipped === 1 ? '' : 's'} skipped — per your "${settings.dedupe === 'update' ? 'Update' : settings.dedupe === 'skip' ? 'Skip' : 'Create new'}" duplicate rule.`}</p>
          </div>
        </div>
        {!undone && counts.created > 0 && (
          <div className="dh-imp-nova-rec">
            <span className="dh-imp-nova-badge"><Icon name="sparkles" size={12} /></span>
            <span className="dh-imp-grow"><b>Nova</b> · {counts.created.toLocaleString()} new record{counts.created === 1 ? ' is' : 's are'} ready — review them, or set up a recurring sync to keep this source fresh.</span>
            <button className="dh-imp-nova-cta" onClick={viewRecords}>Review</button>
          </div>
        )}
        <div className="dh-imp-rptgrid">
          <div className="dh-imp-rc green"><div className="n mono">{undone ? '0' : counts.created.toLocaleString()}</div><div className="l">Created</div></div>
          <div className="dh-imp-rc blue"><div className="n mono">{undone ? '0' : counts.updated.toLocaleString()}</div><div className="l">Updated (matched)</div></div>
          <div className="dh-imp-rc amber"><div className="n mono">{counts.skipped.toLocaleString()}</div><div className="l">Skipped (dupes)</div></div>
          <div className="dh-imp-rc grey"><div className="n mono">0</div><div className="l">Errors</div></div>
        </div>
        {objKeys.length > 1 && (
          <>
            <div className="dh-imp-sub">By object</div>
            <div className="dh-imp-obreaks">
              {objKeys.map((k) => {
                const o = applied![k];
                return (
                  <div key={k} className="dh-imp-obreak">
                    <span className="ob">{defOf(k)?.plural}</span>
                    <span className="on mono">{undone ? '0' : `${o.created.length + o.updates.length}`}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="dh-imp-sub">Options</div>
        <div className="dh-imp-optbar">
          {undone
            ? <Button variant="primary" onClick={redoImport}><Icon name="redo" size={15} /> Redo import</Button>
            : <Button variant="default" onClick={undoImport}><Icon name="undo" size={15} /> Undo import</Button>}
          <Button variant="default" onClick={viewRecords}><Icon name="eye" size={15} /> View records</Button>
          <Button variant="default" onClick={downloadReport}><Icon name="download" size={15} /> Download report</Button>
          <Button variant="default" onClick={saveTemplate}>Save as template</Button>
          <Button variant="ghost" onClick={close}>Done</Button>
        </div>
      </div>
    );
  }
}

function SetRow({ label, sub, children }: { label: string; sub: string; children: ReactNode }) {
  return (
    <div className="dh-imp-setrow">
      <div className="sk"><b>{label}</b><span>{sub}</span></div>
      {children}
    </div>
  );
}

let propSeq = 0;
const idSeqSuffix = () => (++propSeq).toString(36) + Date.now().toString(36).slice(-3);

function PropModal({
  objects, initialName, onCancel, onCreate,
}: {
  objects: ObjectDef[];
  initialName: string;
  onCancel: () => void;
  onCreate: (objKey: string, name: string, type: FieldType, opts: string) => void;
}) {
  const [objKey, setObjKey] = useState(objects[0]?.k ?? '');
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<FieldType>('text');
  const [opts, setOpts] = useState('');
  return (
    <Modal
      open onClose={onCancel} width={460}
      title={<><Icon name="plus" size={17} /> Create a property</>}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onCreate(objKey, name, type, opts)}><Icon name="plus" size={15} /> Create &amp; map</Button>
      </>}
    >
      <div className="dh-imp-modal-body">
        <label>Add to object</label>
        <select className="dh-imp-modal-input dh-imp-modal-select" value={objKey} onChange={(e) => setObjKey(e.target.value)}>
          {objects.map((o) => <option key={o.k} value={o.k}>{o.plural}</option>)}
        </select>
        <label>Property name</label>
        <input className="dh-imp-modal-input" autoFocus placeholder="e.g. Segment" value={name} onChange={(e) => setName(e.target.value)} />
        <label>Type</label>
        <div className="dh-imp-typegrid">
          {FIELD_TYPES.map((t) => (
            <button key={t.k} className={`dh-imp-typ ${type === t.k ? 'on' : ''}`} onClick={() => setType(t.k)}>{t.label}</button>
          ))}
        </div>
        {type === 'select' && (
          <>
            <label>Dropdown options (one per line)</label>
            <textarea className="dh-imp-modal-input" rows={3} placeholder={'Enterprise\nMid-market\nSMB'} value={opts} onChange={(e) => setOpts(e.target.value)} />
          </>
        )}
      </div>
    </Modal>
  );
}
