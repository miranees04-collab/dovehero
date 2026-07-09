import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Button, Popover, MenuItem } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { uid } from '@/lib/format';
import type { FieldDef, FieldType, ObjectDef, ObjectRecord } from '@/types';
import './import.css';

/* ------------------------------------------------------------------ *
 * Import wizard — a full-screen, 6-step flow that maps an uploaded
 * file onto the workspace's real objects & properties, lets you clean
 * the data, then actually creates the records in the store.
 * ------------------------------------------------------------------ */

const STEPS = ['Object', 'Source', 'Mapping', 'Data', 'Records & settings', 'Report'] as const;

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

const TARGET_COUNT = 5842; // headline "file size" for flavour

export function ImportWizard() {
  const objects = useStore((s) => s.objects);
  const navObj = useStore((s) => s.nav);
  const setImport = useStore((s) => s.setImport);
  const addField = useStore((s) => s.addField);
  const importRecords = useStore((s) => s.importObjectRecords);
  const removeRecords = useStore((s) => s.removeObjectRecordsBatch);
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
  const [objMenuOpen, setObjMenuOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  const [cols, setCols] = useState<Col[]>(() => SAMPLE_COLS.map((name) => ({ name, map: null })));
  const [rows, setRows] = useState<string[][]>(() => SAMPLE_ROWS.map((r) => [...r]));
  const [, setGridHist] = useState<{ cols: Col[]; rows: string[][] }[]>([]);

  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editCol, setEditCol] = useState<number | null>(null);
  const [recIdx, setRecIdx] = useState(0);

  const [propModal, setPropModal] = useState<null | { colIdx: number }>(null);

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
  const [imported, setImported] = useState<Record<string, string[]> | null>(null);
  const [builtPayload, setBuiltPayload] = useState<Record<string, ObjectRecord[]> | null>(null);
  const [undone, setUndone] = useState(false);

  /* keep activeObj valid; re-seed automatic (non-user) mappings when the
     selected object set changes so columns land on the right destination. */
  useEffect(() => {
    if (!selected.includes(activeObj)) setActiveObj(selected[0] ?? '');
  }, [selected, activeObj]);

  useEffect(() => {
    setCols((prev) =>
      prev.map((c) => {
        if (c.userSet) return c;
        let best: MapTarget = null;
        let bestScore = 0;
        for (const objKey of selected) {
          const def = defOf(objKey);
          if (!def) continue;
          for (const f of def.fields) {
            const sc = matchScore(c.name, f.label);
            if (sc > bestScore) { bestScore = sc; best = { obj: objKey, field: f.k }; }
          }
        }
        return { ...c, map: best };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // esc to close
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'processing') setImport(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [setImport, phase]);

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
        setStep(5);
      }
    }, 60);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- derived ----
  const mappedCols = cols.filter((c) => c.map && !('skip' in c.map));
  const objsWithData = selected.filter((o) => mappedCols.some((c) => c.map && 'obj' in c.map && c.map.obj === o));

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

  const gridUndo = () => {
    setGridHist((h) => {
      if (!h.length) { toast('Nothing to undo', 'warn'); return h; }
      const last = h[h.length - 1];
      setCols(last.cols.map((c) => ({ ...c })));
      setRows(last.rows.map((r) => [...r]));
      return h.slice(0, -1);
    });
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

  const runImport = () => {
    const payload = buildRecords();
    importRecords(payload);
    setBuiltPayload(payload);
    const ids: Record<string, string[]> = {};
    for (const [k, recs] of Object.entries(payload)) ids[k] = recs.map((r) => r.id);
    setImported(ids);
    setUndone(false);
  };

  const totalCreated = imported ? Object.values(imported).reduce((n, a) => n + a.length, 0) : 0;

  const undoImport = () => {
    if (!imported) return;
    removeRecords(imported);
    setUndone(true);
    toast('Import undone — records rolled back', 'warn');
  };
  const redoImport = () => {
    if (!builtPayload) return;
    importRecords(builtPayload);
    setUndone(false);
    toast('Import re-applied', 'success');
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
        <div className="dh-imp-brand"><span className="dh-imp-mark"><Icon name="upload" size={15} color="#fff" strokeWidth={2.2} /></span>Import</div>
        <div className="dh-imp-stepper">
          {STEPS.map((s, i) => (
            <div key={s} className="dh-imp-stp-wrap">
              <button
                className={`dh-imp-stp ${i < step ? 'done' : i === step ? 'on' : ''}`}
                onClick={() => goStep(i)}
                disabled={i > step || phase !== 'wizard'}
              >
                <span className="sn">{i < step ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}</span>
                <span className="sl">{s}</span>
              </button>
              {i < STEPS.length - 1 && <span className={`dh-imp-bar ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
        <button className="dh-imp-close" onClick={close} title="Close" aria-label="Close import">
          <Icon name="x" size={17} />
        </button>
      </div>

      {/* body */}
      <div className="dh-imp-body">
        {phase === 'processing'
          ? renderProcessing()
          : phase === 'report'
            ? renderReport()
            : [renderObject, renderSource, renderMapping, renderData, renderRecords][step]?.()}
      </div>

      {/* footer */}
      {phase === 'wizard' && (
        <div className="dh-imp-foot">
          {step > 0 && <Button variant="default" onClick={back}><Icon name="arrowLeft" size={15} /> Back</Button>}
          <span className="dh-imp-foot-note">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
          <span className="dh-imp-grow" />
          {step === 0 && <Button variant="primary" onClick={next} disabled={!selected.length}>Choose a source <Icon name="arrowRight" size={15} /></Button>}
          {step === 2 && <Button variant="primary" onClick={next}>Review data <Icon name="arrowRight" size={15} /></Button>}
          {step === 3 && <Button variant="primary" onClick={next}>Records &amp; settings <Icon name="arrowRight" size={15} /></Button>}
          {step === 4 && <Button variant="primary" onClick={() => setPhase('processing')}>Import {TARGET_COUNT.toLocaleString()} records <Icon name="arrowRight" size={15} /></Button>}
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
  function renderObject() {
    return (
      <div className="dh-imp-center">
        <h1 className="dh-imp-h1">What are you importing?</h1>
        <p className="dh-imp-lead">Pick one or more objects. If your file holds several record types, import them together — mapping, data and rules adapt per object, and we link them automatically.</p>

        <div className="dh-imp-sub">Objects to import</div>
        <div className="dh-imp-msel">
          <button className="dh-imp-multibtn" onClick={() => setObjMenuOpen((v) => !v)}>
            {selected.length ? (
              <div className="dh-imp-chips">
                {selected.map((k) => (
                  <span key={k} className="dh-imp-chip">
                    {defOf(k)?.plural ?? k}
                    <span className="x" onClick={(e) => { e.stopPropagation(); toggleObj(k); }}><Icon name="x" size={13} /></span>
                  </span>
                ))}
              </div>
            ) : <span className="dh-imp-ph">Select objects…</span>}
            <span className="dh-imp-grow" />
            <Icon name="chevronDown" size={16} className={objMenuOpen ? 'dh-imp-cv up' : 'dh-imp-cv'} />
          </button>
          {objMenuOpen && (
            <>
              <div className="dh-imp-mselscrim" onClick={() => setObjMenuOpen(false)} />
              <div className="dh-imp-mseldrop">
                {objects.map((o) => (
                  <button key={o.k} className="dh-imp-mselitem" onClick={() => toggleObj(o.k)}>
                    <span className={`dh-imp-cbx ${selected.includes(o.k) ? 'on' : ''}`}>{selected.includes(o.k) && <Icon name="check" size={13} strokeWidth={2.6} />}</span>
                    <span className="dh-imp-mselic"><Icon name={o.icon} size={16} /></span>
                    <div className="dh-imp-grow">
                      <b>{o.plural}</b>
                      <span>{o.fields.length} properties</span>
                    </div>
                    {o.k === 'contact' && <span className="dh-imp-tag">recommended</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {selected.length > 1 ? (
          <div className="dh-imp-banner ok"><Icon name="check" size={15} /> {selected.map((k) => defOf(k)?.plural ?? k).join(' + ')} will be imported together and associated automatically.</div>
        ) : selected.length === 1 ? (
          <p className="dh-imp-lead sm">Importing <b>{defOf(selected[0])?.plural}</b>. Add more objects any time from the dropdown.</p>
        ) : null}
      </div>
    );
  }

  function renderSource() {
    const label = selected.map((k) => defOf(k)?.plural ?? k).join(' + ');
    const pick = (id: string, title: string) => {
      setSource(title);
      setStep(2);
      toast(id === 'file' ? 'contacts.csv uploaded · 5,842 rows' : `${title} connected · 5,842 records`, 'success');
    };
    return (
      <div className="dh-imp-center">
        <h1 className="dh-imp-h1">Import into {label}</h1>
        <p className="dh-imp-lead">Where's your data coming from? Everything after this is one connected flow — map, edit, review, and import without leaving.</p>
        <div className="dh-imp-srcgrid">
          {SOURCES.map((c) => (
            <button key={c.id} className="dh-imp-src" onClick={() => pick(c.id, c.title)}>
              <span className="dh-imp-si"><Icon name={c.icon} size={20} /></span>
              <div>
                <b>{c.title}</b>
                <p>{c.sub}</p>
                {c.tag && <span className="dh-imp-tag">{c.tag}</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="dh-imp-recent">
          <div className="dh-imp-sub">Recent imports</div>
          {[['Contacts', 'Yesterday · 8,200 records'], ['Leads', 'Last week · 3,310 records']].map((r) => (
            <div key={r[0]} className="dh-imp-ri">
              <span className="dh-imp-ric"><Icon name="fileText" size={16} /></span>
              <b className="dh-imp-grow">{r[0]}</b>
              <span>{r[1]}</span>
            </div>
          ))}
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

  function renderMapping() {
    return (
      <div className="dh-imp-wide">
        <h1 className="dh-imp-h1">Match columns to properties</h1>
        <p className="dh-imp-lead">
          {selected.length > 1
            ? `Each column can go to any of your selected objects — pick the destination from the grouped list (${selected.map((k) => defOf(k)?.plural).join(', ')}).`
            : 'Line up each column with a property. Missing one? Create it right here.'}
        </p>
        <div className="dh-imp-banner ok"><Icon name="check" size={15} /> {mappedCols.length} of {cols.length} columns mapped{selected.length > 1 ? ` across ${selected.length} objects` : ''}</div>
        <div className="dh-imp-assocbar">
          <span className="dh-imp-grow" />
          <Button variant="default" size="sm" onClick={() => setPropModal({ colIdx: -1 })}><Icon name="plus" size={15} /> Create property</Button>
        </div>
        <div className="dh-imp-assoc">
          <div className="dh-imp-arow head">
            <div>Column in your file</div>
            <div>Maps to (object · property)</div>
            <div />
            <div>Result</div>
          </div>
          {cols.map((c, i) => {
            const m = c.map;
            const target = m && 'obj' in m ? m : null;
            const def = target ? defOf(target.obj) : undefined;
            const field = def?.fields.find((f) => f.k === target?.field);
            const samp = rows.slice(0, 2).map((r) => r[i] || '—').join(', ');
            return (
              <div key={i} className="dh-imp-arow">
                <div className="dh-imp-acol"><b>{c.name}</b><div className="dh-imp-samp mono">{samp}</div></div>
                <div className="dh-imp-acol">
                  <div className="dh-imp-maptarget">
                    {mapSelect(i, m, `dh-imp-sel ${!m ? 'unmapped' : ''}`)}
                    <button className="dh-imp-newbtn" title="Create new property" onClick={() => setPropModal({ colIdx: i })}><Icon name="plus" size={16} /></button>
                  </div>
                </div>
                <div className="dh-imp-aarrow"><Icon name="arrowRight" size={16} /></div>
                <div className="dh-imp-acol">
                  {target && field ? (
                    <div className="dh-imp-result"><span className="dh-imp-objdot">{def?.plural}</span><span className="dh-imp-resfield">{field.label}</span></div>
                  ) : m && 'skip' in m ? <span className="dh-imp-dim">Skipped</span>
                    : <span className="dh-imp-warn">Choose where this goes →</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderData() {
    return (
      <div className="dh-imp-wide">
        <h1 className="dh-imp-h1">Review &amp; edit your data</h1>
        <p className="dh-imp-lead">Your file, live. Double-click a cell to edit or a header to rename. Open a column's <b>⋯</b> menu to apply a one-click format rule — it cleans that column now <b>and</b> on every row at import.</p>
        <div className="dh-imp-xltoolbar">
          <span className="dh-imp-banner ok" style={{ margin: 0 }}>
            <Icon name="check" size={15} /> {rows.length} of {TARGET_COUNT.toLocaleString()} rows · {cols.length} columns
            {cols.some((c) => c.rule) && <> · <Icon name="wand" size={13} /> {cols.filter((c) => c.rule).length} format rule{cols.filter((c) => c.rule).length > 1 ? 's' : ''}</>}
          </span>
          <span className="dh-imp-grow" />
          <Button variant="default" size="sm" onClick={gridUndo}><Icon name="undo" size={15} /> Undo</Button>
          <Button variant="default" size="sm" onClick={addColumn}><Icon name="plus" size={15} /> Add column</Button>
          <Button variant="default" size="sm" onClick={addRow}><Icon name="plus" size={15} /> Add row</Button>
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
        <h1 className="dh-imp-h1">How records will look &amp; import</h1>
        <p className="dh-imp-lead">A real preview per object, plus the rules applied to every record.{cols.some((c) => c.rule) && <> <b>{cols.filter((c) => c.rule).length} formatting rule{cols.filter((c) => c.rule).length > 1 ? 's' : ''}</b> will run on import.</>}</p>

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
              <SetRow label="If a record already exists" sub="Matched by email">
                <div className="dh-imp-seg">
                  {(['update', 'skip', 'create'] as const).map((m) => (
                    <button key={m} className={settings.dedupe === m ? 'on' : ''} onClick={() => setSettings((s) => ({ ...s, dedupe: m }))}>{m === 'update' ? 'Update' : m === 'skip' ? 'Skip' : 'Create new'}</button>
                  ))}
                </div>
              </SetRow>
              <SetRow label="Tags" sub="Added to every record">
                <div className="dh-imp-tags">
                  {settings.tags.map((t) => <span key={t} className="dh-imp-tag2">{t}</span>)}
                  <button className="dh-imp-tag2 add" onClick={() => toast('Add a tag')}>+ Tag</button>
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
          <p className="dh-imp-lead">Applying your mappings, edits and rules to {rows.length} records across {selected.map((k) => defOf(k)?.plural).join(', ')}.</p>
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
    const dup = Math.round(totalCreated * 0.04);
    const created = settings.dedupe === 'create' ? totalCreated : totalCreated - dup;
    const updated = settings.dedupe === 'update' ? dup : 0;
    const skipped = settings.dedupe === 'skip' ? dup : 0;
    return (
      <div className="dh-imp-wide">
        <div className={`dh-imp-rpttop ${undone ? 'undone' : ''}`}>
          <div className="rm"><Icon name={undone ? 'undo' : 'check'} size={24} strokeWidth={2.4} color="#fff" /></div>
          <div>
            <h2>{undone ? 'Import undone' : 'Import complete'}</h2>
            <p>{undone
              ? `All ${totalCreated.toLocaleString()} records were rolled back — created records removed.`
              : `${totalCreated.toLocaleString()} record${totalCreated === 1 ? '' : 's'} imported across ${objsWithData.map((k) => defOf(k)?.plural).join(', ') || 'your objects'}.`}</p>
          </div>
        </div>
        <div className="dh-imp-rptgrid">
          <div className="dh-imp-rc green"><div className="n mono">{undone ? '0' : created.toLocaleString()}</div><div className="l">Created</div></div>
          <div className="dh-imp-rc blue"><div className="n mono">{undone ? '0' : updated.toLocaleString()}</div><div className="l">Updated</div></div>
          <div className="dh-imp-rc amber"><div className="n mono">{skipped.toLocaleString()}</div><div className="l">Skipped (dupes)</div></div>
          <div className="dh-imp-rc grey"><div className="n mono">0</div><div className="l">Errors</div></div>
        </div>
        {objsWithData.length > 1 && (
          <>
            <div className="dh-imp-sub">By object</div>
            <div className="dh-imp-obreaks">
              {objsWithData.map((k) => (
                <div key={k} className="dh-imp-obreak"><span className="ob">{defOf(k)?.plural}</span><span className="on mono">{undone ? '0' : (imported?.[k]?.length ?? 0).toLocaleString()}</span></div>
              ))}
            </div>
          </>
        )}
        <div className="dh-imp-sub">Options</div>
        <div className="dh-imp-optbar">
          {undone
            ? <Button variant="primary" onClick={redoImport}><Icon name="redo" size={15} /> Redo import</Button>
            : <Button variant="default" onClick={undoImport}><Icon name="undo" size={15} /> Undo import</Button>}
          <Button variant="default" onClick={viewRecords}><Icon name="eye" size={15} /> View records</Button>
          <Button variant="default" onClick={() => toast('import_report.csv downloaded', 'success')}><Icon name="download" size={15} /> Download report</Button>
          <Button variant="default" onClick={() => toast(`Saved as template “${source ?? 'Import'}”`, 'success')}>Save as template</Button>
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
        <select className="dh-imp-modal-input" value={objKey} onChange={(e) => setObjKey(e.target.value)}>
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
