import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Popover, MenuItem } from '@/components/ui/primitives';
import type {
  Product,
  ProductStatus,
} from '@/types';
import {
  PRODUCT_TYPE_ORDER,
  PRODUCT_STATUSES,
  PRODUCT_STAGES,
  resolveType,
  BILLING_LABEL,
  price as fmtPrice,
  margin as calcMargin,
  marginTone,
  stockState,
  STOCK_META,
} from '@/data/products';
import { TypeBadge } from './ProductSections';
import { ProductPipeline } from './ProductPipeline';
import { CreateProduct } from './CreateProduct';
import { productDealLinks } from './assoc';
import './products.css';

type SortKey = 'name' | 'price' | 'margin' | 'stock' | 'updated';

/** Read products out of the generic record store as a typed list. */
export function useProducts(): Product[] {
  return useStore((s) => s.objectRecords.product ?? []) as unknown as Product[];
}

export function ProductWorkspace() {
  const products = useProducts();
  const deals = useStore((s) => s.deals);
  const addObjectRecord = useStore((s) => s.addObjectRecord);
  const updateObjectRecord = useStore((s) => s.updateObjectRecord);
  const removeObjectRecord = useStore((s) => s.removeObjectRecord);
  const duplicateObjectRecord = useStore((s) => s.duplicateObjectRecord);
  const openObject = useStore((s) => s.openObject);
  const moveProductStage = useStore((s) => s.moveProductStage);
  const customTypes = useStore((s) => s.productTypes);
  const categories = useStore((s) => s.productCategories);
  const toast = useStore((s) => s.toast);

  const [q, setQ] = useState('');
  const [pview, setPview] = useState<'table' | 'pipeline'>('table');
  const [typeF, setTypeF] = useState<string>('all');
  const [statusF, setStatusF] = useState<ProductStatus | 'all'>('all');
  const [catF, setCatF] = useState<string>('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'updated', dir: 1 });
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const links = useMemo(() => productDealLinks(products, deals), [products, deals]);

  const set = (id: string, patch: Partial<Product>) =>
    updateObjectRecord('product', id, patch as Record<string, unknown>);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (typeF !== 'all' && p.type !== typeF) return false;
      if (statusF !== 'all' && p.status !== statusF) return false;
      if (catF !== 'all' && p.category !== catF) return false;
      if (query && !(p.name + ' ' + p.sku + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(query)) return false;
      return true;
    });
    const dir = sort.dir;
    list = [...list].sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sort.k) {
        case 'price': av = a.price; bv = b.price; break;
        case 'margin': av = calcMargin(a); bv = calcMargin(b); break;
        case 'stock': av = a.tracked ? a.onHand - a.committed : Infinity; bv = b.tracked ? b.onHand - b.committed : Infinity; break;
        case 'updated': av = 0; bv = 0; break; // seed order ≈ recency
        default: av = a.name.toLowerCase(); bv = b.name.toLowerCase();
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return list;
  }, [products, q, typeF, statusF, catF, sort]);

  // KPIs
  const active = products.filter((p) => p.status === 'active');
  const catalogValue = active.reduce((s, p) => s + p.price, 0);
  const avgMargin = active.length ? Math.round(active.reduce((s, p) => s + calcMargin(p), 0) / active.length) : 0;
  const lowStock = products.filter((p) => ['low', 'out'].includes(stockState(p))).length;

  const typeKeys = useMemo(
    () => [...PRODUCT_TYPE_ORDER as string[], ...customTypes.map((t) => t.k)],
    [customTypes],
  );
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = { all: products.length };
    typeKeys.forEach((t) => { m[t] = products.filter((p) => p.type === t).length; });
    return m;
  }, [products, typeKeys]);

  const allShownSelected = filtered.length > 0 && filtered.every((p) => sel.includes(p.id));
  const toggleAll = () => setSel(allShownSelected ? [] : filtered.map((p) => p.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulkSet = (patch: Partial<Product>, label: string) => {
    sel.forEach((id) => set(id, patch));
    toast(`${sel.length} product${sel.length !== 1 ? 's' : ''} ${label}`, 'success');
    setSel([]);
  };
  const bulkDelete = () => {
    const n = sel.length;
    sel.forEach((id) => removeObjectRecord('product', id));
    setSel([]);
    toast(`Deleted ${n} product${n !== 1 ? 's' : ''}`, 'warn');
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'SKU', 'Type', 'Category', 'Status', 'Price', 'Currency', 'Cost', 'Margin %', 'On hand', 'Available'],
      ...filtered.map((p) => [
        p.name, p.sku, resolveType(p.type, customTypes).label, p.category, p.status,
        p.price, p.currency, p.cost, calcMargin(p),
        p.tracked ? p.onHand : '', p.tracked ? p.onHand - p.committed : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${filtered.length} products`, 'success');
  };

  const createProduct = (p: Product) => {
    addObjectRecord('product', p as unknown as Record<string, unknown> & { id: string });
    setCreating(false);
    openObject(p.id);
    toast('Product created', 'success');
  };

  return (
    <div className="dh-pw">
      {/* Header */}
      <div className="dh-pw-head">
        <div className="dh-pw-head-main">
          <div className="dh-pw-head-title">
            <span className="dh-pw-head-icon"><Icon name="box" size={19} /></span>
            <div>
              <h1>Products</h1>
              <p>Your product catalog — pricing, variants, bundles &amp; inventory in one place.</p>
            </div>
          </div>
          <div className="dh-pw-head-actions">
            <div className="dh-pw-viewtoggle">
              <button className={pview === 'table' ? 'on' : ''} onClick={() => setPview('table')} title="Table"><Icon name="list" size={15} /> Table</button>
              <button className={pview === 'pipeline' ? 'on' : ''} onClick={() => setPview('pipeline')} title="Pipeline"><Icon name="grid" size={15} /> Pipeline</button>
            </div>
            <Button variant="ghost" size="sm" onClick={exportCsv}><Icon name="download" size={15} /> Export</Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> New product</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="dh-pw-kpis">
          <Kpi icon="box" label="Products" value={String(products.length)} hint={`${active.length} active`} />
          <Kpi icon="dollar" label="Catalog value" value={fmtPrice(catalogValue)} hint="Active list prices" tone="accent" />
          <Kpi icon="percent" label="Avg. margin" value={`${avgMargin}%`} hint="Across active" tone={marginTone(avgMargin)} />
          <Kpi icon="briefcase" label="In pipeline" value={fmtPrice(links.totalPipeline)} hint={`${links.dealCount} open deals`} />
          <Kpi icon="alert" label="Stock alerts" value={String(lowStock)} hint="Low or out" tone={lowStock ? 'red' : 'neutral'} />
        </div>
      </div>

      {/* Type tabs */}
      <div className="dh-pw-types">
        <TypeTab k="all" label="All" count={typeCounts.all} active={typeF === 'all'} onClick={() => setTypeF('all')} />
        {typeKeys.map((t) => {
          const meta = resolveType(t, customTypes);
          return (
            <TypeTab
              key={t}
              k={t}
              label={meta.label}
              count={typeCounts[t] ?? 0}
              hue={meta.hue}
              icon={meta.icon}
              active={typeF === t}
              onClick={() => setTypeF(typeF === t ? 'all' : t)}
            />
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="dh-pw-toolbar">
        <div className="dh-pw-search">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, SKUs, tags…" />
          {q && <button className="dh-pw-clear" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
        </div>
        <select className="dh-pw-select" value={statusF} onChange={(e) => setStatusF(e.target.value as ProductStatus | 'all')}>
          <option value="all">All statuses</option>
          {(Object.keys(PRODUCT_STATUSES) as ProductStatus[]).map((s) => <option key={s} value={s}>{PRODUCT_STATUSES[s].label}</option>)}
        </select>
        <select className="dh-pw-select" value={catF} onChange={(e) => setCatF(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Popover
          align="end"
          trigger={({ toggle }) => (
            <button className="dh-pw-select as-btn" onClick={toggle}>
              <Icon name="sliders" size={14} /> Sort
            </button>
          )}
        >
          {(close) => (
            <div className="dh-pw-sortmenu">
              {([
                ['updated', 'Recently updated'], ['name', 'Name'], ['price', 'Price'],
                ['margin', 'Margin'], ['stock', 'Available stock'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <MenuItem key={k} active={sort.k === k} icon={<Icon name={sort.k === k ? (sort.dir === 1 ? 'arrowDown' : 'arrowUp') : 'minus'} size={14} />}
                  onClick={() => { setSort((s) => (s.k === k ? { k, dir: s.dir === 1 ? -1 : 1 } : { k, dir: 1 })); close(); }}>
                  {label}
                </MenuItem>
              ))}
            </div>
          )}
        </Popover>
        <span className="dh-pw-resultcount">{filtered.length} of {products.length}</span>
      </div>

      {/* Bulk bar */}
      {pview === 'table' && sel.length > 0 && (
        <div className="dh-pw-bulk">
          <span className="dh-pw-bulk-count">{sel.length} selected</span>
          <Button variant="ghost" size="sm" onClick={() => bulkSet({ status: 'active' }, 'activated')}><Icon name="check" size={14} /> Activate</Button>
          <Button variant="ghost" size="sm" onClick={() => bulkSet({ status: 'archived' }, 'archived')}><Icon name="archive" size={14} /> Archive</Button>
          <Popover
            trigger={({ toggle }) => <button className="dh-btn v-ghost s-sm" onClick={toggle}><Icon name="tag" size={14} /> Category</button>}
          >
            {(close) => (
              <div className="dh-pw-sortmenu">
                {categories.map((c) => (
                  <MenuItem key={c} onClick={() => { bulkSet({ category: c }, `moved to ${c}`); close(); }}>{c}</MenuItem>
                ))}
              </div>
            )}
          </Popover>
          <Popover
            trigger={({ toggle }) => <button className="dh-btn v-ghost s-sm" onClick={toggle}><Icon name="repeat" size={14} /> Stage</button>}
          >
            {(close) => (
              <div className="dh-pw-sortmenu">
                {PRODUCT_STAGES.map((st) => (
                  <MenuItem key={st.k} icon={<span className="dh-pp-coldot" style={{ background: st.hue }} />}
                    onClick={() => { const ids = [...sel]; ids.forEach((id) => moveProductStage(id, st.k)); setSel([]); toast(`${ids.length} moved to ${st.label}`, 'success'); close(); }}>
                    {st.label}
                  </MenuItem>
                ))}
              </div>
            )}
          </Popover>
          <Button variant="ghost" size="sm" onClick={bulkDelete} className="danger-text"><Icon name="trash" size={14} /> Delete</Button>
          <button className="dh-pw-bulk-clear" onClick={() => setSel([])}>Clear</button>
        </div>
      )}

      {/* Catalog — table or lifecycle pipeline */}
      {pview === 'pipeline' ? (
        <div className="dh-pw-scroll"><ProductPipeline items={filtered} /></div>
      ) : (
      <div className="dh-pw-scroll">
        <table className="dh-pw-table">
          <thead>
            <tr>
              <th className="col-check"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all" /></th>
              <th>Product</th>
              <th>Type</th>
              <th className="col-num">Price</th>
              <th className="col-num">Margin</th>
              <th>Inventory</th>
              <th>Status</th>
              <th className="col-num">Deals</th>
              <th className="col-menu"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const m = calcMargin(p);
              const ss = stockState(p);
              const link = links.byId[p.id];
              return (
                <tr key={p.id} className={sel.includes(p.id) ? 'is-sel' : ''} tabIndex={0} role="button" aria-label={`Open ${p.name}`}
                  onClick={() => openObject(p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); openObject(p.id); } }}>
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                  </td>
                  <td>
                    <div className="dh-pw-prod">
                      <span className="dh-pw-thumb" style={{ background: p.image.hue + '1a', color: p.image.hue }}>{p.image.emoji}</span>
                      <div className="dh-pw-prod-txt">
                        <b>{p.name}</b>
                        <span className="mono dh-pw-sku">{p.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td><TypeBadge type={p.type} /></td>
                  <td className="col-num">
                    <span className="dh-pw-price">{fmtPrice(p.price, p.currency)}</span>
                    <span className="dh-pw-billing">{BILLING_LABEL[p.billing]}</span>
                  </td>
                  <td className="col-num"><Badge tone={marginTone(m)}>{m}%</Badge></td>
                  <td>
                    {ss === 'untracked'
                      ? <span className="dh-pw-dim">—</span>
                      : <span className="dh-pw-stock"><Badge tone={STOCK_META[ss].tone} dot={STOCK_META[ss].tone === 'green' ? 'var(--green)' : STOCK_META[ss].tone === 'amber' ? 'var(--amber)' : 'var(--red)'}>{p.onHand - p.committed}</Badge></span>}
                  </td>
                  <td><Badge tone={PRODUCT_STATUSES[p.status].tone}>{PRODUCT_STATUSES[p.status].label}</Badge></td>
                  <td className="col-num">{link?.deals.length ? <span className="dh-pw-deals">{link.deals.length}</span> : <span className="dh-pw-dim">0</span>}</td>
                  <td className="col-menu" onClick={(e) => e.stopPropagation()}>
                    <Popover align="end"
                      trigger={({ toggle }) => <button className="dh-pw-rowmenu" onClick={toggle} aria-label="Row actions"><Icon name="more" size={16} /></button>}>
                      {(close) => (
                        <div className="dh-pw-sortmenu">
                          <MenuItem icon={<Icon name="eye" size={14} />} onClick={() => { openObject(p.id); close(); }}>Open</MenuItem>
                          <MenuItem icon={<Icon name="copy" size={14} />} onClick={() => { duplicateObjectRecord('product', p.id); close(); toast('Product duplicated', 'success'); }}>Duplicate</MenuItem>
                          {p.status !== 'active'
                            ? <MenuItem icon={<Icon name="check" size={14} />} onClick={() => { set(p.id, { status: 'active' }); close(); }}>Activate</MenuItem>
                            : <MenuItem icon={<Icon name="archive" size={14} />} onClick={() => { set(p.id, { status: 'archived' }); close(); }}>Archive</MenuItem>}
                          <MenuItem danger icon={<Icon name="trash" size={14} />} onClick={() => { removeObjectRecord('product', p.id); close(); toast('Product deleted', 'warn'); }}>Delete</MenuItem>
                        </div>
                      )}
                    </Popover>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="dh-pw-empty">
            <span className="dh-pw-empty-icon"><Icon name="box" size={26} /></span>
            <b>No products match</b>
            <span>{products.length ? 'Try clearing filters or search.' : 'Create your first product to get started.'}</span>
            {products.length
              ? <Button variant="ghost" size="sm" onClick={() => { setQ(''); setTypeF('all'); setStatusF('all'); setCatF('all'); }}>Clear filters</Button>
              : <Button variant="primary" size="sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> New product</Button>}
          </div>
        )}
      </div>
      )}

      {creating && <CreateProduct onCancel={() => setCreating(false)} onCreate={createProduct} />}
    </div>
  );
}

/* ---------------- KPI tile ---------------- */
function Kpi({ icon, label, value, hint, tone = 'neutral' }: { icon: string; label: string; value: string; hint?: string; tone?: 'neutral' | 'accent' | 'green' | 'amber' | 'red' }) {
  return (
    <div className={`dh-pw-kpi tone-${tone}`}>
      <span className="dh-pw-kpi-icon"><Icon name={icon} size={15} /></span>
      <div className="dh-pw-kpi-body">
        <span className="dh-pw-kpi-value">{value}</span>
        <span className="dh-pw-kpi-label">{label}</span>
        {hint && <span className="dh-pw-kpi-hint">{hint}</span>}
      </div>
    </div>
  );
}

function TypeTab({ k, label, count, active, onClick, hue, icon }: { k: string; label: string; count: number; active: boolean; onClick: () => void; hue?: string; icon?: string }) {
  return (
    <button className={`dh-pw-type ${active ? 'on' : ''}`} onClick={onClick} style={active && hue ? { borderColor: hue, color: hue } : undefined} data-k={k}>
      {icon && <Icon name={icon} size={14} />}
      {label}
      <span className="dh-pw-type-count">{count}</span>
    </button>
  );
}

