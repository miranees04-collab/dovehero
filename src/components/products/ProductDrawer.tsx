import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge, Avatar } from '@/components/ui/primitives';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { TagEditor } from '@/components/ui/TagEditor';
import { useStore } from '@/store/useStore';
import { OWNERS, hueOf } from '@/data/constants';
import type {
  Product,
  ProductStatus,
  ProductVariant,
  BundleItem,
  PriceTier,
  PriceBookEntry,
  BillingPeriod,
  CurrencyCode,
} from '@/types';
import {
  PRODUCT_STATUSES,
  PRODUCT_CATEGORIES,
  BILLING_LABEL,
  CURRENCIES,
  price as fmtPrice,
  margin as calcMargin,
  marginTone,
  stockState,
  STOCK_META,
} from '@/data/products';
import { TypeBadge } from './ProductWorkspace';
import type { ProductLink } from './assoc';

interface Props {
  product: Product;
  link?: ProductLink;
  onClose: () => void;
  onChange: (patch: Partial<Product>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

type Tab = 'overview' | 'pricing' | 'variants' | 'bundle' | 'inventory' | 'deals' | 'history';

export function ProductDrawer({ product: p, link, onClose, onChange, onDelete, onDuplicate }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: { k: Tab; label: string; icon: string; show: boolean }[] = [
    { k: 'overview', label: 'Overview', icon: 'list', show: true },
    { k: 'pricing', label: 'Pricing', icon: 'dollar', show: true },
    { k: 'variants', label: 'Variants', icon: 'layers', show: p.type === 'physical' || (p.variants?.length ?? 0) > 0 },
    { k: 'bundle', label: 'Bundle', icon: 'boxes', show: p.type === 'bundle' || (p.bundleItems?.length ?? 0) > 0 },
    { k: 'inventory', label: 'Inventory', icon: 'warehouse', show: p.tracked },
    { k: 'deals', label: 'Deals', icon: 'briefcase', show: true },
    { k: 'history', label: 'History', icon: 'clock', show: true },
  ];
  const shown = tabs.filter((t) => t.show);
  const activeTab = shown.some((t) => t.k === tab) ? tab : 'overview';

  return (
    <>
      <div className="dh-pw-scrim" onClick={onClose} />
      <aside className="dh-pw-drawer" role="dialog" aria-label={p.name}>
        {/* Header */}
        <div className="dh-pw-dhead">
          <div className="dh-pw-dhead-top">
            <div className="dh-pw-dhead-id">
              <TypeBadge type={p.type} />
              <span className="mono dh-pw-sku">{p.sku}</span>
            </div>
            <div className="dh-pw-dhead-actions">
              <button className="dh-pw-iconbtn" title="Duplicate" onClick={onDuplicate}><Icon name="copy" size={15} /></button>
              <button className="dh-pw-iconbtn" title="Delete" onClick={() => { if (confirm(`Delete “${p.name}”?`)) onDelete(); }}><Icon name="trash" size={15} /></button>
              <button className="dh-pw-x" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
            </div>
          </div>
          <div className="dh-pw-dhead-title">
            <span className="dh-pw-dthumb" style={{ background: p.image.hue + '1a', color: p.image.hue }}>{p.image.emoji}</span>
            <div className="dh-pw-dhead-name">
              <h2><InlineEdit value={p.name} onCommit={(v) => onChange({ name: v.trim() || p.name })} /></h2>
              <div className="dh-pw-dhead-meta">
                <StatusPicker status={p.status} onChange={(status) => onChange({ status })} />
                <span className="dh-pw-dot">·</span>
                <InlineEdit value={p.category} display={<span className="dh-pw-cat">{p.category}</span>}
                  options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))} onCommit={(v) => onChange({ category: v })} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="dh-pw-dtabs">
          {shown.map((t) => (
            <button key={t.k} className={`dh-pw-dtab ${activeTab === t.k ? 'on' : ''}`} onClick={() => setTab(t.k)}>
              <Icon name={t.icon} size={14} /> {t.label}
              {t.k === 'deals' && link?.deals.length ? <span className="dh-pw-dtab-badge">{link.deals.length}</span> : null}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="dh-pw-dbody">
          {activeTab === 'overview' && <Overview p={p} link={link} onChange={onChange} />}
          {activeTab === 'pricing' && <Pricing p={p} onChange={onChange} />}
          {activeTab === 'variants' && <Variants p={p} onChange={onChange} />}
          {activeTab === 'bundle' && <Bundle p={p} />}
          {activeTab === 'inventory' && <Inventory p={p} onChange={onChange} />}
          {activeTab === 'deals' && <Deals p={p} link={link} />}
          {activeTab === 'history' && <History p={p} />}
        </div>
      </aside>
    </>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ p, link, onChange }: { p: Product; link?: ProductLink; onChange: (patch: Partial<Product>) => void }) {
  const m = calcMargin(p);
  const insight = novaInsight(p, m, link);
  return (
    <div className="dh-pw-sect">
      <div className="dh-pw-statgrid">
        <Stat label="List price" value={fmtPrice(p.price, p.currency)} sub={BILLING_LABEL[p.billing]} />
        <Stat label="Unit cost" value={fmtPrice(p.cost, p.currency)} />
        <Stat label="Margin" value={`${m}%`} tone={marginTone(m)} />
        <Stat label="Won revenue" value={fmtPrice(link?.won ?? 0)} sub={`${link?.deals.length ?? 0} deals`} />
      </div>

      <div className="dh-pw-nova">
        <span className="dh-pw-nova-ico"><Icon name="sparkles" size={14} /></span>
        <div><b>Nova insight</b><p>{insight}</p></div>
      </div>

      <Field label="Description">
        <textarea className="dh-pw-textarea" value={p.description ?? ''} rows={3}
          placeholder="Describe this product…" onChange={(e) => onChange({ description: e.target.value })} />
      </Field>

      <Field label="Tags">
        <TagEditor tags={p.tags ?? []} onChange={(tags) => onChange({ tags })} />
      </Field>

      <div className="dh-pw-detailrows">
        <Row label="SKU"><span className="mono">{p.sku}</span></Row>
        <Row label="Type"><TypeBadge type={p.type} /></Row>
        <Row label="Vendor">
          <InlineEdit value={p.vendor ?? ''} display={<span>{p.vendor || '—'}</span>} onCommit={(v) => onChange({ vendor: v })} />
        </Row>
        <Row label="Owner">
          {p.owner && OWNERS[p.owner]
            ? <span className="dh-pw-owner"><Avatar ownerKey={p.owner} size={20} /> {OWNERS[p.owner].name}</span>
            : <span className="dh-pw-dim">Unassigned</span>}
        </Row>
        <Row label="Created"><span className="dh-pw-dim">{p.createdW} ago</span></Row>
        <Row label="Updated"><span className="dh-pw-dim">{p.updatedW} ago</span></Row>
      </div>
    </div>
  );
}

/* ---------------- Pricing ---------------- */
function Pricing({ p, onChange }: { p: Product; onChange: (patch: Partial<Product>) => void }) {
  const m = calcMargin(p);
  const books = p.priceBooks ?? [];
  const tiers = p.tiers ?? [];

  const setBook = (i: number, patch: Partial<PriceBookEntry>) =>
    onChange({ priceBooks: books.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const addBook = () => onChange({ priceBooks: [...books, { book: 'New market', currency: 'USD', price: p.price }] });
  const delBook = (i: number) => onChange({ priceBooks: books.filter((_, j) => j !== i) });

  const setTier = (i: number, patch: Partial<PriceTier>) =>
    onChange({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const addTier = () => onChange({ tiers: [...tiers, { upTo: null, unit: p.price }] });
  const delTier = (i: number) => onChange({ tiers: tiers.filter((_, j) => j !== i) });

  return (
    <div className="dh-pw-sect">
      <div className="dh-pw-priceband">
        <div className="dh-pw-priceband-main">
          <span className="dh-pw-priceband-price">
            {CURRENCIES[p.currency].symbol}
            <InlineEdit value={p.price} type="number" onCommit={(v) => onChange({ price: Number(v) || 0 })} />
          </span>
          <span className="dh-pw-priceband-billing">{BILLING_LABEL[p.billing]}</span>
        </div>
        <div className="dh-pw-marginbar">
          <div className="dh-pw-marginbar-track">
            <div className={`dh-pw-marginbar-fill tone-${marginTone(m)}`} style={{ width: `${Math.max(2, Math.min(100, m))}%` }} />
          </div>
          <span className="dh-pw-marginbar-label"><b>{m}%</b> margin · {fmtPrice(p.price - p.cost, p.currency)} / unit</span>
        </div>
      </div>

      <div className="dh-pw-detailrows">
        <Row label="Unit cost">
          {CURRENCIES[p.currency].symbol}<InlineEdit value={p.cost} type="number" onCommit={(v) => onChange({ cost: Number(v) || 0 })} />
        </Row>
        <Row label="Base currency">
          <InlineEdit value={p.currency} display={<span>{p.currency}</span>}
            options={(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => ({ value: c, label: c }))}
            onCommit={(v) => onChange({ currency: v as CurrencyCode })} />
        </Row>
        <Row label="Billing period">
          <InlineEdit value={p.billing} display={<span>{billingLabel(p.billing)}</span>}
            options={(['one_time', 'monthly', 'quarterly', 'annual'] as BillingPeriod[]).map((b) => ({ value: b, label: billingLabel(b) }))}
            onCommit={(v) => onChange({ billing: v as BillingPeriod })} />
        </Row>
        <Row label="Tax rate">
          <InlineEdit value={p.taxRate} type="number" onCommit={(v) => onChange({ taxRate: Number(v) || 0 })} />%
        </Row>
      </div>

      {/* Price books */}
      <SubHead icon="globe" title="Price books" hint="Same product, per-market pricing">
        <button className="dh-pw-addlink" onClick={addBook}><Icon name="plus" size={13} /> Add</button>
      </SubHead>
      {books.length ? (
        <table className="dh-pw-mini">
          <thead><tr><th>Market</th><th>Currency</th><th className="col-num">Price</th><th></th></tr></thead>
          <tbody>
            {books.map((b, i) => (
              <tr key={i}>
                <td><InlineEdit value={b.book} onCommit={(v) => setBook(i, { book: v })} /></td>
                <td><InlineEdit value={b.currency} display={<span>{b.currency}</span>} options={(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => ({ value: c, label: c }))} onCommit={(v) => setBook(i, { currency: v as CurrencyCode })} /></td>
                <td className="col-num">{CURRENCIES[b.currency].symbol}<InlineEdit value={b.price} type="number" onCommit={(v) => setBook(i, { price: Number(v) || 0 })} /></td>
                <td className="col-menu"><button className="dh-pw-rowx" onClick={() => delBook(i)}><Icon name="x" size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty text="No price books — the base currency price applies everywhere." />}

      {/* Usage tiers */}
      {(p.type === 'usage' || tiers.length > 0) && (
        <>
          <SubHead icon="gauge" title="Volume tiers" hint="Per-unit price by quantity">
            <button className="dh-pw-addlink" onClick={addTier}><Icon name="plus" size={13} /> Add</button>
          </SubHead>
          {tiers.length ? (
            <table className="dh-pw-mini">
              <thead><tr><th>Up to</th><th className="col-num">Unit price</th><th></th></tr></thead>
              <tbody>
                {tiers.map((t, i) => (
                  <tr key={i}>
                    <td>{t.upTo == null ? <span className="dh-pw-dim">∞ (and above)</span> : <><InlineEdit value={t.upTo} type="number" onCommit={(v) => setTier(i, { upTo: Number(v) || 0 })} /> units</>}</td>
                    <td className="col-num">{CURRENCIES[p.currency].symbol}<InlineEdit value={t.unit} type="number" onCommit={(v) => setTier(i, { unit: Number(v) || 0 })} /></td>
                    <td className="col-menu"><button className="dh-pw-rowx" onClick={() => delTier(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty text="Flat per-unit pricing." />}
        </>
      )}
    </div>
  );
}

/* ---------------- Variants ---------------- */
function Variants({ p, onChange }: { p: Product; onChange: (patch: Partial<Product>) => void }) {
  const variants = p.variants ?? [];
  const set = (i: number, patch: Partial<ProductVariant>) =>
    onChange({ variants: variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const add = () => onChange({
    variants: [...variants, { id: 'v' + (variants.length + 1) + Math.floor(Math.random() * 99), name: 'New variant', sku: `${p.sku}-${variants.length + 1}`, price: p.price, stock: 0 }],
  });
  const del = (i: number) => onChange({ variants: variants.filter((_, j) => j !== i) });

  return (
    <div className="dh-pw-sect">
      <SubHead icon="layers" title="Variants" hint="Option combinations sold under this product">
        <button className="dh-pw-addlink" onClick={add}><Icon name="plus" size={13} /> Add variant</button>
      </SubHead>
      {variants.length ? (
        <table className="dh-pw-mini variants">
          <thead><tr><th>Variant</th><th>SKU</th><th className="col-num">Price</th><th className="col-num">Stock</th><th></th></tr></thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.id}>
                <td><InlineEdit value={v.name} onCommit={(x) => set(i, { name: x })} /></td>
                <td><span className="mono"><InlineEdit value={v.sku} onCommit={(x) => set(i, { sku: x })} /></span></td>
                <td className="col-num">{CURRENCIES[p.currency].symbol}<InlineEdit value={v.price} type="number" onCommit={(x) => set(i, { price: Number(x) || 0 })} /></td>
                <td className="col-num">
                  {p.tracked ? <InlineEdit value={v.stock ?? 0} type="number" onCommit={(x) => set(i, { stock: Number(x) || 0 })} /> : <span className="dh-pw-dim">—</span>}
                </td>
                <td className="col-menu"><button className="dh-pw-rowx" onClick={() => del(i)}><Icon name="x" size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty text="No variants yet. Add sizes, terms or configurations sold under one product." />}
    </div>
  );
}

/* ---------------- Bundle ---------------- */
function Bundle({ p }: { p: Product }) {
  const items: BundleItem[] = p.bundleItems ?? [];
  const componentSum = items.reduce((s, it) => s + it.qty * it.unit, 0);
  const savings = componentSum - p.price;
  return (
    <div className="dh-pw-sect">
      <SubHead icon="boxes" title="Bundle components" hint="Products included in this kit" />
      {items.length ? (
        <>
          <table className="dh-pw-mini">
            <thead><tr><th>Component</th><th className="col-num">Qty</th><th className="col-num">Unit</th><th className="col-num">Line</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name} <span className="mono dh-pw-dim">{it.productId}</span></td>
                  <td className="col-num">{it.qty}</td>
                  <td className="col-num">{fmtPrice(it.unit, p.currency)}</td>
                  <td className="col-num">{fmtPrice(it.qty * it.unit, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dh-pw-bundle-sum">
            <div><span>Components à la carte</span><b>{fmtPrice(componentSum, p.currency)}</b></div>
            <div><span>Bundle price</span><b>{fmtPrice(p.price, p.currency)}</b></div>
            <div className={savings > 0 ? 'save' : ''}>
              <span>{savings > 0 ? 'Customer saves' : 'Premium'}</span>
              <b>{fmtPrice(Math.abs(savings), p.currency)}{componentSum ? ` · ${Math.round((Math.abs(savings) / componentSum) * 100)}%` : ''}</b>
            </div>
          </div>
        </>
      ) : <Empty text="No components. Add products to compose this bundle." />}
    </div>
  );
}

/* ---------------- Inventory ---------------- */
function Inventory({ p, onChange }: { p: Product; onChange: (patch: Partial<Product>) => void }) {
  const available = p.onHand - p.committed;
  const ss = stockState(p);
  const pctToReorder = p.reorderPoint > 0 ? Math.min(100, (available / (p.reorderPoint * 2)) * 100) : 100;
  return (
    <div className="dh-pw-sect">
      <div className="dh-pw-invhero">
        <div className="dh-pw-invhero-num">
          <span className="big">{available}</span>
          <span className="dh-pw-invhero-sub">available</span>
        </div>
        <Badge tone={STOCK_META[ss].tone} dot={STOCK_META[ss].tone === 'green' ? 'var(--green)' : STOCK_META[ss].tone === 'amber' ? 'var(--amber)' : 'var(--red)'}>{STOCK_META[ss].label}</Badge>
      </div>
      <div className="dh-pw-marginbar">
        <div className="dh-pw-marginbar-track">
          <div className={`dh-pw-marginbar-fill tone-${ss === 'in' ? 'green' : ss === 'low' ? 'amber' : 'red'}`} style={{ width: `${Math.max(2, pctToReorder)}%` }} />
        </div>
        <span className="dh-pw-marginbar-label">Reorder point at {p.reorderPoint}</span>
      </div>

      <div className="dh-pw-detailrows">
        <Row label="On hand"><InlineEdit value={p.onHand} type="number" onCommit={(v) => onChange({ onHand: Number(v) || 0 })} /></Row>
        <Row label="Committed"><InlineEdit value={p.committed} type="number" onCommit={(v) => onChange({ committed: Number(v) || 0 })} /></Row>
        <Row label="Available"><b>{available}</b></Row>
        <Row label="Reorder point"><InlineEdit value={p.reorderPoint} type="number" onCommit={(v) => onChange({ reorderPoint: Number(v) || 0 })} /></Row>
        <Row label="Warehouse"><InlineEdit value={p.warehouse ?? ''} display={<span>{p.warehouse || '—'}</span>} onCommit={(v) => onChange({ warehouse: v })} /></Row>
      </div>

      <SubHead icon="truck" title="Recent movements" hint="Simulated" />
      <ul className="dh-pw-moves">
        <li><Icon name="arrowDown" size={13} className="in" /> <b>+40</b> received · PO-3391 <span className="dh-pw-dim">2d ago</span></li>
        <li><Icon name="arrowUpRight" size={13} className="out" /> <b>−12</b> committed · SO-8820 <span className="dh-pw-dim">1d ago</span></li>
        <li><Icon name="arrowUpRight" size={13} className="out" /> <b>−4</b> shipped · SO-8791 <span className="dh-pw-dim">6h ago</span></li>
      </ul>
    </div>
  );
}

/* ---------------- Deals (associations) ---------------- */
function Deals({ p, link }: { p: Product; link?: ProductLink }) {
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const deals = link?.deals ?? [];
  const go = (id: string) => { setNav('deals'); openDeal(id); };
  return (
    <div className="dh-pw-sect">
      <div className="dh-pw-statgrid two">
        <Stat label="Open pipeline" value={fmtPrice(link?.pipeline ?? 0)} />
        <Stat label="Closed won" value={fmtPrice(link?.won ?? 0)} tone="green" />
      </div>
      <SubHead icon="briefcase" title="Deals with this product" hint={`${deals.length} linked`} />
      {deals.length ? (
        <div className="dh-pw-deallist">
          {deals.map((d) => (
            <button key={d.id} className="dh-pw-dealrow" onClick={() => go(d.id)}>
              <span className="dh-pw-dealrow-dot" style={{ background: hueOf(d.stage) }} />
              <div className="dh-pw-dealrow-main">
                <b>{d.name}</b>
                <small>{d.company} · {d.stage}</small>
              </div>
              <span className="dh-pw-dealrow-val mono">{fmtPrice(d.value)}</span>
              <Icon name="chevronRight" size={15} />
            </button>
          ))}
        </div>
      ) : <Empty text={`No deals reference ${p.name} yet.`} />}
    </div>
  );
}

/* ---------------- History ---------------- */
function History({ p }: { p: Product }) {
  const events = [
    { icon: 'pencil', txt: 'Description updated', w: p.updatedW },
    { icon: 'dollar', txt: `List price set to ${fmtPrice(p.price, p.currency)}`, w: '1w' },
    { icon: 'check', txt: `Status: ${PRODUCT_STATUSES[p.status].label}`, w: '2w' },
    { icon: 'plus', txt: 'Product created', w: p.createdW },
  ];
  return (
    <div className="dh-pw-sect">
      <ul className="dh-pw-timeline">
        {events.map((e, i) => (
          <li key={i}>
            <span className="dh-pw-timeline-ico"><Icon name={e.icon} size={13} /></span>
            <div><b>{e.txt}</b><small>{e.w} ago</small></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- small building blocks ---------------- */
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'amber' | 'red' }) {
  return (
    <div className="dh-pw-stat">
      <span className={`dh-pw-stat-value ${tone ? 'tone-' + tone : ''}`}>{value}</span>
      <span className="dh-pw-stat-label">{label}{sub ? ` · ${sub}` : ''}</span>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="dh-pw-field"><label>{label}</label>{children}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="dh-pw-row"><span className="dh-pw-row-label">{label}</span><span className="dh-pw-row-value">{children}</span></div>;
}
function SubHead({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="dh-pw-subhead">
      <Icon name={icon} size={14} />
      <b>{title}</b>
      {hint && <span className="dh-pw-subhead-hint">{hint}</span>}
      {children && <span className="dh-pw-subhead-actions">{children}</span>}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="dh-pw-mini-empty">{text}</p>;
}
function StatusPicker({ status, onChange }: { status: ProductStatus; onChange: (s: ProductStatus) => void }) {
  return (
    <InlineEdit
      value={status}
      display={<Badge tone={PRODUCT_STATUSES[status].tone}>{PRODUCT_STATUSES[status].label}</Badge>}
      options={(Object.keys(PRODUCT_STATUSES) as ProductStatus[]).map((s) => ({ value: s, label: PRODUCT_STATUSES[s].label }))}
      onCommit={(v) => onChange(v as ProductStatus)}
    />
  );
}

function billingLabel(b: BillingPeriod): string {
  return b === 'one_time' ? 'One-time' : b === 'monthly' ? 'Monthly' : b === 'quarterly' ? 'Quarterly' : 'Annual';
}

/** Deterministic, rule-based "AI" summary for the Overview tab. */
function novaInsight(p: Product, m: number, link?: ProductLink): string {
  const ss = stockState(p);
  if (ss === 'out') return `Out of stock — ${p.committed} units committed against ${p.onHand} on hand. Raise a purchase order before quoting new deals.`;
  if (ss === 'low') return `Stock is below the reorder point (${p.onHand - p.committed} available vs ${p.reorderPoint}). Consider replenishing ${p.warehouse ?? 'the warehouse'}.`;
  if (p.status === 'draft') return `Still a draft — set pricing and activate to make ${p.name} sellable in deals and quotes.`;
  if (m < 40) return `Margin is thin at ${m}%. Review the ${fmtPrice(p.cost, p.currency)} unit cost or list price before discounting further.`;
  if ((link?.pipeline ?? 0) > 0) return `Healthy ${m}% margin, and it's attached to ${fmtPrice(link!.pipeline)} of open pipeline across ${link!.deals.length} deals. A reliable performer.`;
  if (p.type === 'bundle') return `Bundling drives larger deals — this kit is priced ${m}% above cost. Feature it in new proposals.`;
  return `Looking healthy — ${m}% margin and active in the catalog. No action needed right now.`;
}
