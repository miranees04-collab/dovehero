import { useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { Button, Popover, MenuItem, Badge } from '@/components/ui/primitives';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { uid } from '@/lib/format';
import type { Product, ProductStatus, ProductStage, Activity, ActivityType, SalesDocKind } from '@/types';
import {
  PRODUCT_STAGES,
  stageMeta,
  margin as calcMargin,
  DOC_META,
  docTotals,
  docStatusTone,
  price as fmtPrice,
} from '@/data/products';
import { DocBuilder } from './DocBuilder';
import {
  Properties, Pricing, Variants, Bundle, Inventory, DealsSection,
  StatTiles, StatusPicker, TypeBadge, novaInsight,
} from './ProductSections';
import { productDealLinks } from './assoc';
import { Brochure } from './Brochure';
import { useProducts } from './ProductWorkspace';

type LeftTab = 'details' | 'pricing' | 'variants' | 'bundle' | 'inventory';

export function ProductRecord({ id }: { id: string }) {
  const products = useProducts();
  const deals = useStore((s) => s.deals);
  const openObject = useStore((s) => s.openObject);
  const updateObjectRecord = useStore((s) => s.updateObjectRecord);
  const removeObjectRecord = useStore((s) => s.removeObjectRecord);
  const duplicateObjectRecord = useStore((s) => s.duplicateObjectRecord);
  const moveProductStage = useStore((s) => s.moveProductStage);
  const createSalesDoc = useStore((s) => s.createSalesDoc);
  const toast = useStore((s) => s.toast);

  const [left, setLeft] = useState<LeftTab>('details');
  const [brochure, setBrochure] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);

  const p = products.find((x) => x.id === id);
  const links = useMemo(() => productDealLinks(products, deals), [products, deals]);
  if (!p) return <div className="dh-pw-empty"><b>Product not found</b><Button variant="ghost" size="sm" onClick={() => openObject(null)}>Back to catalog</Button></div>;

  const link = links.byId[p.id];
  const set = (patch: Partial<Product>) => updateObjectRecord('product', p.id, { ...patch, updatedW: 'now' } as Record<string, unknown>);
  const m = calcMargin(p);

  const leftTabs: { k: LeftTab; label: string; show: boolean }[] = [
    { k: 'details', label: 'Details', show: true },
    { k: 'pricing', label: 'Pricing', show: true },
    { k: 'variants', label: 'Variants', show: p.type === 'physical' || (p.variants?.length ?? 0) > 0 },
    { k: 'bundle', label: 'Bundle', show: p.type === 'bundle' || (p.bundleItems?.length ?? 0) > 0 },
    { k: 'inventory', label: 'Inventory', show: p.tracked },
  ];
  const shownLeft = leftTabs.filter((t) => t.show);
  const activeLeft = shownLeft.some((t) => t.k === left) ? left : 'details';

  return (
    <div className="dh-pr" style={{ ['--phue']: p.image.hue } as CSSProperties}>
      {/* Header */}
      <div className="dh-pr-head">
        <button className="dh-btn v-ghost s-sm" onClick={() => openObject(null)}>
          <Icon name="arrowLeft" size={15} /> Products
        </button>
        <div className="dh-pr-title">
          <span className="dh-pw-dthumb" style={{ background: p.image.hue + '1a', color: p.image.hue }}>{p.image.emoji}</span>
          <div className="dh-pr-title-txt">
            <h1><InlineEdit value={p.name} onCommit={(v) => set({ name: v.trim() || p.name })} /></h1>
            <div className="dh-pr-sub">
              <span className="mono dh-pw-sku">{p.sku}</span>
              <TypeBadge type={p.type} />
              <StatusPicker status={p.status} onChange={(status: ProductStatus) => set({ status })} />
              <span className="dh-pr-stagepill" style={{ color: stageMeta(p.stage).hue }}>
                <span className="dh-pr-stagedot" style={{ background: stageMeta(p.stage).hue }} />
                <InlineEdit value={p.stage} display={<span>{stageMeta(p.stage).label}</span>}
                  options={PRODUCT_STAGES.map((s) => ({ value: s.k, label: s.label }))}
                  onCommit={(v) => moveProductStage(p.id, v as ProductStage)} />
              </span>
            </div>
          </div>
        </div>
        <div className="dh-pr-actions">
          <Popover align="end"
            trigger={({ toggle }) => <button className="dh-btn v-primary s-sm" onClick={toggle}><Icon name="plus" size={15} /> Create <Icon name="chevronDown" size={13} /></button>}>
            {(close) => (
              <div className="dh-pw-sortmenu">
                {(['quote', 'order', 'po'] as SalesDocKind[]).map((k) => {
                  if (k === 'po' && !p.tracked) return null;
                  const meta = DOC_META[k];
                  return (
                    <MenuItem key={k} icon={<Icon name={meta.icon} size={14} />} onClick={() => {
                      const did = createSalesDoc(k, { lines: [{ productId: p.id, name: p.name, qty: 1, unit: meta.unitFrom === 'cost' ? p.cost : p.price }] });
                      setDocId(did); close();
                    }}>{meta.label}</MenuItem>
                  );
                })}
              </div>
            )}
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => setBrochure(true)}><Icon name="fileText" size={15} /> Brochure</Button>
          <Button variant="ghost" size="sm" onClick={() => { duplicateObjectRecord('product', p.id); toast('Product duplicated', 'success'); }}><Icon name="copy" size={15} /> Duplicate</Button>
          <Button variant="ghost" size="sm" className="danger-text" onClick={() => { if (confirm(`Delete “${p.name}”?`)) { removeObjectRecord('product', p.id); openObject(null); toast('Product deleted', 'warn'); } }}><Icon name="trash" size={15} /></Button>
        </div>
      </div>

      {/* Summary band */}
      <div className="dh-pr-band">
        <StatTiles p={p} link={link} />
        <div className="dh-pw-nova dh-pr-nova">
          <span className="dh-pw-nova-ico"><Icon name="sparkles" size={14} /></span>
          <div><b>Nova insight</b><p>{novaInsight(p, m, link)}</p></div>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="dh-pr-cols">
        {/* LEFT — properties */}
        <section className="dh-pr-col">
          <div className="dh-pr-colhead"><Icon name="sliders" size={14} /> Properties</div>
          <div className="dh-pr-subtabs">
            {shownLeft.map((t) => (
              <button key={t.k} className={`dh-pr-subtab ${activeLeft === t.k ? 'on' : ''}`} onClick={() => setLeft(t.k)}>{t.label}</button>
            ))}
          </div>
          {activeLeft === 'details' && <Properties p={p} onChange={set} />}
          {activeLeft === 'pricing' && <Pricing p={p} onChange={set} />}
          {activeLeft === 'variants' && <Variants p={p} onChange={set} />}
          {activeLeft === 'bundle' && <Bundle p={p} onChange={set} />}
          {activeLeft === 'inventory' && <Inventory p={p} onChange={set} />}
        </section>

        {/* CENTER — activity */}
        <section className="dh-pr-col">
          <div className="dh-pr-colhead"><Icon name="activity" size={14} /> Activity</div>
          <ProductActivity product={p} />
        </section>

        {/* RIGHT — associations */}
        <section className="dh-pr-col">
          <div className="dh-pr-colhead"><Icon name="layers" size={14} /> Associations</div>
          <Associations product={p} onChange={set} onBrochure={() => setBrochure(true)} onOpenDoc={setDocId} />
        </section>
      </div>

      {brochure && <Brochure product={p} onClose={() => setBrochure(false)} />}
      {docId && <DocBuilder id={docId} onClose={() => setDocId(null)} />}
    </div>
  );
}

/* ---------------- Center: activity timeline + composer ---------------- */
const ACT_KINDS: { k: ActivityType; label: string; icon: string }[] = [
  { k: 'note', label: 'Note', icon: 'note' },
  { k: 'call', label: 'Call', icon: 'phone' },
  { k: 'email', label: 'Email', icon: 'mail' },
  { k: 'task', label: 'Task', icon: 'check' },
];

function ProductActivity({ product: p }: { product: Product }) {
  const addProductActivity = useStore((s) => s.addProductActivity);
  const toast = useStore((s) => s.toast);
  const [kind, setKind] = useState<ActivityType>('note');
  const [text, setText] = useState('');

  const log = () => {
    const t = text.trim();
    if (!t) { toast('Write something to log', 'warn'); return; }
    const base = { id: uid('pa'), who: 'You', w: 'now' };
    let act: Activity;
    if (kind === 'task') act = { ...base, type: 'task', title: t, done: false, due: 'Tomorrow', prio: 'med' };
    else if (kind === 'email') act = { ...base, type: 'email', subj: t, dir: 'out', status: 'sent' };
    else if (kind === 'call') act = { ...base, type: 'call', outcome: 'Connected', text: t };
    else act = { ...base, type: 'note', text: t };
    addProductActivity(p.id, act);
    setText('');
    toast(`${cap(kind)} logged`, 'success');
  };

  const acts = p.acts ?? [];
  return (
    <div className="dh-pr-activity">
      <div className="dh-pr-composer">
        <div className="dh-pr-kinds">
          {ACT_KINDS.map((k) => (
            <button key={k.k} className={`dh-pr-kind ${kind === k.k ? 'on' : ''}`} onClick={() => setKind(k.k)}>
              <Icon name={k.icon} size={13} /> {k.label}
            </button>
          ))}
        </div>
        <textarea className="dh-pw-textarea" rows={2} value={text} placeholder={`Log a ${kind}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') log(); }} />
        <div className="dh-pr-composer-foot">
          <span className="dh-pw-dim">⌘↵ to log</span>
          <Button variant="primary" size="sm" onClick={log}><Icon name="send" size={13} /> Log {kind}</Button>
        </div>
      </div>

      {acts.length ? (
        <ul className="dh-pr-timeline">
          {acts.map((a) => (
            <li key={a.id} className={a.type === 'task' && a.done ? 'done' : ''}>
              <span className="dh-pr-tl-ico" data-t={a.type}><Icon name={ACTIVITY_ICONS[a.type] ?? 'note'} size={13} /></span>
              <div className="dh-pr-tl-body">
                <div className="dh-pr-tl-top">
                  <b>{a.who}</b>
                  <span className="dh-pr-tl-verb">{verb(a)}</span>
                  <span className="dh-pr-tl-time">{a.w} ago</span>
                </div>
                {(a.subj || a.title || a.text) && <p>{a.subj || a.title || a.text}</p>}
                {a.thread?.[0]?.text && a.subj && <p className="dh-pr-tl-quote">{a.thread[0].text}</p>}
                {a.attach?.length ? <span className="dh-pr-tl-attach"><Icon name="paperclip" size={11} /> {a.attach.join(', ')}</span> : null}
                {a.chan && a.type === 'email' ? <span className="dh-pr-tl-chan">to {a.chan}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="dh-pw-mini-empty">No activity yet — log the first note above.</p>}
    </div>
  );
}

/* ---------------- Right: associations ---------------- */
const MEDIA_EMOJI = ['🖼️', '📸', '🎨', '📐', '🏷️', '📊', '🎬', '🧩'];

function Associations({ product: p, onChange, onBrochure, onOpenDoc }: { product: Product; onChange: (patch: Partial<Product>) => void; onBrochure: () => void; onOpenDoc: (id: string) => void }) {
  const deals = useStore((s) => s.deals);
  const products = useProducts();
  const companyRecs = useStore((s) => s.objectRecords.company ?? []);
  const salesDocs = useStore((s) => s.salesDocs);
  const setNav = useStore((s) => s.setNav);
  const openObject = useStore((s) => s.openObject);
  const toast = useStore((s) => s.toast);
  const link = useMemo(() => productDealLinks(products, deals).byId[p.id], [products, deals, p.id]);
  const companies = Array.from(new Set((link?.deals ?? []).map((d) => d.company)));
  const docs = salesDocs.filter((d) => d.lines.some((l) => l.productId === p.id));

  const openCompany = (name: string) => {
    const rec = companyRecs.find((r) => String(r.name) === name);
    setNav('company');
    if (rec) openObject(rec.id);
  };
  const addMedia = () => {
    const media = p.media ?? [];
    onChange({ media: [...media, { name: `Image ${media.length + 1}`, emoji: MEDIA_EMOJI[media.length % MEDIA_EMOJI.length], hue: p.image.hue }] });
    toast('Media added', 'success');
  };
  const removeMedia = (i: number) => onChange({ media: (p.media ?? []).filter((_, j) => j !== i) });
  const downloadDoc = (name: string) => toast(`Downloading ${name}`, 'default');

  return (
    <div className="dh-pr-assoc">
      <DealsSection p={p} link={link} />

      <div className="dh-pw-sect">
        <div className="dh-pw-subhead"><Icon name="fileText" size={14} /><b>Quotes &amp; orders</b><span className="dh-pw-subhead-hint">{docs.length}</span></div>
        {docs.length ? (
          <div className="dh-pr-doclist">
            {docs.map((d) => {
              const meta = DOC_META[d.kind];
              return (
                <button key={d.id} className="dh-pr-docrow" onClick={() => onOpenDoc(d.id)}>
                  <span className="dh-pr-docrow-ico" style={{ background: meta.hue + '18', color: meta.hue }}><Icon name={meta.icon} size={14} /></span>
                  <div className="dh-pr-docrow-main">
                    <b>{d.number} <span className="dh-pw-dim">· {meta.label}</span></b>
                    <small>{d.party || '—'}</small>
                  </div>
                  <Badge tone={docStatusTone(d.kind, d.status)}>{d.status}</Badge>
                  <span className="dh-pr-docrow-total mono">{fmtPrice(docTotals(d).total, d.currency)}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="dh-pw-mini-empty">No quotes or orders yet — use “Create” above.</p>}

        <div className="dh-pw-subhead"><Icon name="building" size={14} /><b>Accounts</b><span className="dh-pw-subhead-hint">{companies.length}</span></div>
        {companies.length ? (
          <div className="dh-pr-chiplist">
            {companies.map((c) => (
              <button key={c} className="dh-pr-chip" onClick={() => openCompany(c)} title={`Open ${c}`}><Icon name="building" size={12} /> {c}</button>
            ))}
          </div>
        ) : <p className="dh-pw-mini-empty">No accounts linked yet.</p>}

        <div className="dh-pw-subhead"><Icon name="image" size={14} /><b>Media</b><span className="dh-pw-subhead-hint">{p.media?.length ?? 0}</span></div>
        <div className="dh-pr-media">
          {(p.media ?? []).map((mm, i) => (
            <span key={i} className="dh-pr-mediatile" style={{ background: mm.hue + '1a', color: mm.hue }} title={mm.name}>
              {mm.emoji}
              <button className="dh-pr-mediatile-x" onClick={() => removeMedia(i)} aria-label={`Remove ${mm.name}`}><Icon name="x" size={10} /></button>
            </span>
          ))}
          <button className="dh-pr-mediatile add" title="Add image" onClick={addMedia}><Icon name="plus" size={16} /></button>
        </div>

        <div className="dh-pw-subhead"><Icon name="paperclip" size={14} /><b>Documents</b><span className="dh-pw-subhead-hint">{p.docs?.length ?? 0}</span></div>
        {(p.docs ?? []).length ? (
          <div className="dh-pr-doclist">
            {(p.docs ?? []).map((d, i) => (
              <button key={i} className="dh-pr-doc" onClick={() => downloadDoc(d.n)}>
                <Icon name={d.k === 'pdf' ? 'fileText' : d.k === 'sheet' ? 'receipt' : 'file'} size={14} />
                <span>{d.n}</span>
                <Icon name="download" size={13} className="dh-pr-doc-dl" />
              </button>
            ))}
          </div>
        ) : <p className="dh-pw-mini-empty">No documents.</p>}

        <div className="dh-pr-brochurecard">
          <div><b>Marketing brochure</b><small>Share a one-pager with buyers</small></div>
          <Button variant="primary" size="sm" onClick={onBrochure}><Icon name="fileText" size={14} /> Create</Button>
        </div>
      </div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function verb(a: Activity): string {
  switch (a.type) {
    case 'email': return 'sent an email';
    case 'call': return `logged a call · ${a.outcome ?? 'Connected'}`;
    case 'task': return 'added a task';
    case 'file': return 'attached a file';
    case 'meeting': return 'scheduled a meeting';
    default: return 'added a note';
  }
}
