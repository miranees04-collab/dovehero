import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button, Badge } from '@/components/ui/primitives';
import { useEsc } from '@/components/ui/useEsc';
import { useStore } from '@/store/useStore';
import { uid } from '@/lib/format';
import type { Product, BillingPeriod, CurrencyCode } from '@/types';
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_ORDER,
  resolveType,
  margin as calcMargin,
  price as fmtPrice,
  BILLING_LABEL,
  CURRENCIES,
  TYPE_ICON_CHOICES,
  TYPE_HUE_CHOICES,
} from '@/data/products';

const EMOJI_BY_TYPE: Record<string, string> = {
  subscription: '🚀', usage: '⚡', service: '🧭', physical: '📦', digital: '☁️', bundle: '🎁',
};

const defaultBilling = (type: string): BillingPeriod =>
  type === 'subscription' ? 'annual' : type === 'usage' ? 'monthly' : 'one_time';

/** A guided, two-step create flow — choose a type (or define your own), then fill details. */
export function CreateProduct({ onCancel, onCreate }: { onCancel: () => void; onCreate: (p: Product) => void }) {
  const customTypes = useStore((s) => s.productTypes);
  const addProductType = useStore((s) => s.addProductType);
  const removeProductType = useStore((s) => s.removeProductType);
  const addProductCategory = useStore((s) => s.addProductCategory);
  const catalog = useStore((s) => s.objectRecords.product ?? []) as unknown as Product[];
  const toast = useStore((s) => s.toast);

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<string>('subscription');

  // details
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Platform');
  const [priceV, setPriceV] = useState('');
  const [cost, setCost] = useState('');
  const [billing, setBilling] = useState<BillingPeriod>('annual');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [tracked, setTracked] = useState(false);
  const [description, setDescription] = useState('');

  const meta = resolveType(type, customTypes);
  const m = calcMargin({ price: Number(priceV) || 0, cost: Number(cost) || 0 });
  useEsc(onCancel);

  const chooseType = (k: string) => {
    setType(k);
    setBilling(defaultBilling(k));
    setTracked(k === 'physical');
  };

  const goDetails = () => {
    if (!sku) setSku(''); // let submit auto-generate
    setStep(2);
  };

  const submit = () => {
    const nm = name.trim() || `Untitled ${meta.label.toLowerCase()}`;
    const cat = addProductCategory(category) || category;
    const finalSku = (sku.trim() || nm.slice(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100)).toUpperCase();
    const p: Product = {
      id: 'PR-' + uid('n').slice(-4).toUpperCase(),
      name: nm,
      sku: finalSku,
      type,
      category: cat,
      status: 'draft',
      description: description.trim(),
      price: Number(priceV) || 0,
      cost: Number(cost) || 0,
      currency,
      billing,
      taxRate: 0,
      tracked,
      onHand: 0,
      committed: 0,
      reorderPoint: tracked ? 5 : 0,
      warehouse: tracked ? 'Reno DC-1' : undefined,
      stage: 'Backlog',
      tags: [],
      image: { emoji: EMOJI_BY_TYPE[type] ?? '🧩', hue: meta.hue },
      createdW: 'now', updatedW: 'now',
      acts: [{ id: uid('pa'), type: 'note', who: 'You', w: 'now', text: `${nm} created as a draft.` }],
    };
    onCreate(p);
  };

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onCancel} />
      <div className="dh-cp" role="dialog" aria-label="Create product">
        <div className="dh-cp-head">
          <div className="dh-cp-steps">
            <button className={`dh-cp-step ${step === 1 ? 'on' : 'done'}`} onClick={() => setStep(1)}>
              <span className="dh-cp-step-n">{step > 1 ? <Icon name="check" size={12} /> : '1'}</span> Type
            </button>
            <span className="dh-cp-step-line" />
            <button className={`dh-cp-step ${step === 2 ? 'on' : ''}`} disabled={step === 1}>
              <span className="dh-cp-step-n">2</span> Details
            </button>
          </div>
          <button className="dh-pw-x" onClick={onCancel} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        {step === 1 ? (
          <StepType type={type} customTypes={customTypes} onChoose={chooseType}
            onAddType={(t) => { addProductType(t); chooseType(t.k); toast(`“${t.label}” type added`, 'success'); }}
            onRemoveType={(k) => {
              if (catalog.some((pr) => pr.type === k)) { toast('That type is in use by a product', 'warn'); return; }
              removeProductType(k);
              if (type === k) chooseType('subscription');
              toast('Custom type removed', 'default');
            }} />
        ) : (
          <StepDetails
            meta={meta} type={type}
            name={name} setName={setName}
            sku={sku} setSku={setSku}
            category={category} setCategory={setCategory}
            priceV={priceV} setPriceV={setPriceV}
            cost={cost} setCost={setCost}
            billing={billing} setBilling={setBilling}
            currency={currency} setCurrency={setCurrency}
            tracked={tracked} setTracked={setTracked}
            description={description} setDescription={setDescription}
            margin={m}
          />
        )}

        <div className="dh-cp-foot">
          {step === 1 ? (
            <>
              <span className="dh-cp-foot-hint"><Icon name={meta.icon} size={14} color={meta.hue} /> {meta.label} selected</span>
              <div className="dh-cp-foot-btns">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button variant="primary" onClick={goDetails}>Continue <Icon name="arrowRight" size={15} /></Button>
              </div>
            </>
          ) : (
            <>
              <button className="dh-cp-back" onClick={() => setStep(1)}><Icon name="arrowLeft" size={14} /> Back</button>
              <div className="dh-cp-foot-btns">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button variant="primary" onClick={submit}><Icon name="plus" size={15} /> Create product</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Step 1: type ---------------- */
function StepType({ type, customTypes, onChoose, onAddType, onRemoveType }: {
  type: string;
  customTypes: { k: string; label: string; icon: string; hue: string; blurb?: string }[];
  onChoose: (k: string) => void;
  onAddType: (t: { k: string; label: string; icon: string; hue: string; blurb?: string }) => void;
  onRemoveType: (k: string) => void;
}) {
  const isCustom = (k: string) => customTypes.some((c) => c.k === k);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(TYPE_ICON_CHOICES[0]);
  const [hue, setHue] = useState(TYPE_HUE_CHOICES[0]);

  const rows = [
    ...PRODUCT_TYPE_ORDER.map((k) => ({ k, ...PRODUCT_TYPES[k] })),
    ...customTypes.map((c) => ({ k: c.k, label: c.label, icon: c.icon, hue: c.hue, blurb: c.blurb ?? 'Custom product type' })),
  ];

  const create = () => {
    const nm = label.trim();
    if (!nm) return;
    const k = 'ct_' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    onAddType({ k, label: nm, icon, hue, blurb: 'Custom product type' });
    setCreating(false); setLabel('');
  };

  return (
    <div className="dh-cp-body">
      <div className="dh-cp-title">
        <h2>What are you selling?</h2>
        <p>Pick a type — it tailors the pricing, inventory and structure fields. You can define your own too.</p>
      </div>
      <div className="dh-cp-typelist">
        {rows.map((r) => (
          <div key={r.k} className={`dh-cp-typerow ${type === r.k ? 'on' : ''}`} role="button" tabIndex={0}
            onClick={() => onChoose(r.k)} onKeyDown={(e) => { if (e.key === 'Enter') onChoose(r.k); }}
            style={type === r.k ? { borderColor: r.hue } : undefined}>
            <span className="dh-cp-typeico" style={{ background: r.hue + '18', color: r.hue }}><Icon name={r.icon} size={18} /></span>
            <span className="dh-cp-typetxt"><b>{r.label}</b><small>{r.blurb}</small></span>
            {isCustom(r.k) && (
              <button className="dh-cp-typedel" title="Delete custom type" onClick={(e) => { e.stopPropagation(); onRemoveType(r.k); }}><Icon name="trash" size={13} /></button>
            )}
            <span className={`dh-cp-radio ${type === r.k ? 'on' : ''}`} style={type === r.k ? { borderColor: r.hue, background: r.hue } : undefined}>
              {type === r.k && <Icon name="check" size={12} color="#fff" />}
            </span>
          </div>
        ))}

        {creating ? (
          <div className="dh-cp-newtype">
            <div className="dh-cp-newtype-row">
              <span className="dh-cp-typeico" style={{ background: hue + '18', color: hue }}><Icon name={icon} size={18} /></span>
              <input className="dh-pw-input" placeholder="Type name — e.g. Warranty, Licence, Rental" value={label} autoFocus
                onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
            </div>
            <div className="dh-cp-picker">
              <span className="dh-cp-picker-label">Icon</span>
              <div className="dh-cp-icons">
                {TYPE_ICON_CHOICES.map((ic) => (
                  <button key={ic} className={`dh-cp-iconbtn ${icon === ic ? 'on' : ''}`} onClick={() => setIcon(ic)}><Icon name={ic} size={15} /></button>
                ))}
              </div>
            </div>
            <div className="dh-cp-picker">
              <span className="dh-cp-picker-label">Colour</span>
              <div className="dh-cp-hues">
                {TYPE_HUE_CHOICES.map((h) => (
                  <button key={h} className={`dh-cp-huebtn ${hue === h ? 'on' : ''}`} style={{ background: h }} onClick={() => setHue(h)} aria-label={h} />
                ))}
              </div>
            </div>
            <div className="dh-cp-newtype-foot">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={create}><Icon name="plus" size={14} /> Add type</Button>
            </div>
          </div>
        ) : (
          <button className="dh-cp-addtype" onClick={() => setCreating(true)}>
            <span className="dh-cp-typeico ghost"><Icon name="plus" size={18} /></span>
            <span className="dh-cp-typetxt"><b>Create a custom type</b><small>Define your own product type with an icon &amp; colour</small></span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 2: details ---------------- */
function StepDetails(props: {
  meta: { label: string; icon: string; hue: string };
  type: string;
  name: string; setName: (v: string) => void;
  sku: string; setSku: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  priceV: string; setPriceV: (v: string) => void;
  cost: string; setCost: (v: string) => void;
  billing: BillingPeriod; setBilling: (v: BillingPeriod) => void;
  currency: CurrencyCode; setCurrency: (v: CurrencyCode) => void;
  tracked: boolean; setTracked: (v: boolean) => void;
  description: string; setDescription: (v: string) => void;
  margin: number;
}) {
  const {
    meta, name, setName, sku, setSku, category, setCategory, priceV, setPriceV, cost, setCost,
    billing, setBilling, currency, setCurrency, tracked, setTracked, description, setDescription, margin,
  } = props;

  return (
    <div className="dh-cp-body">
      <div className="dh-cp-title">
        <h2>Product details</h2>
        <p>Fill in the essentials — you can refine everything later on the product page.</p>
      </div>

      <label className="dh-pw-flabel">Product name</label>
      <input className="dh-pw-input lg" value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${meta.label} — Growth`} autoFocus />

      <div className="dh-cp-grid">
        <div>
          <label className="dh-pw-flabel">SKU</label>
          <input className="dh-pw-input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto-generated" />
        </div>
        <div>
          <label className="dh-pw-flabel">Category</label>
          <CategoryCombo value={category} onChange={setCategory} />
        </div>
      </div>

      <div className="dh-cp-pricecard">
        <div className="dh-cp-grid three">
          <div>
            <label className="dh-pw-flabel">List price</label>
            <div className="dh-cp-money">
              <span>{CURRENCIES[currency].symbol}</span>
              <input type="number" value={priceV} onChange={(e) => setPriceV(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="dh-pw-flabel">Unit cost</label>
            <div className="dh-cp-money">
              <span>{CURRENCIES[currency].symbol}</span>
              <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="dh-pw-flabel">Billing</label>
            <select className="dh-pw-input" value={billing} onChange={(e) => setBilling(e.target.value as BillingPeriod)}>
              {(['one_time', 'monthly', 'quarterly', 'annual'] as BillingPeriod[]).map((b) => (
                <option key={b} value={b}>{b === 'one_time' ? 'One-time' : b === 'monthly' ? 'Monthly' : b === 'quarterly' ? 'Quarterly' : 'Annual'}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="dh-cp-pricemeta">
          <div className="dh-cp-currency">
            <span>Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {Number(priceV) > 0 && (
            <span className="dh-cp-margin">Margin <b className={margin >= 70 ? 'g' : margin >= 40 ? 'a' : 'r'}>{margin}%</b></span>
          )}
        </div>
      </div>

      <label className="dh-cp-check">
        <input type="checkbox" checked={tracked} onChange={(e) => setTracked(e.target.checked)} />
        <span><b>Track inventory</b> — manage stock, committed units and reorder points</span>
      </label>

      <label className="dh-pw-flabel">Description <span className="dh-cp-opt">optional</span></label>
      <textarea className="dh-pw-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it and who is it for?" />

      <div className="dh-cp-preview">
        <span className="dh-pw-dthumb sm" style={{ background: meta.hue + '1a', color: meta.hue }}><Icon name={meta.icon} size={18} /></span>
        <div>
          <b>{name.trim() || 'Untitled product'}</b>
          <div className="dh-cp-preview-meta">
            <span className="dh-pw-typebadge" style={{ background: meta.hue + '18', color: meta.hue }}><Icon name={meta.icon} size={11} /> {meta.label}</span>
            <Badge>{category}</Badge>
            {Number(priceV) > 0 && <span className="mono">{fmtPrice(Number(priceV), currency)}{BILLING_LABEL[billing]}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- creatable category combobox ---------------- */
function CategoryCombo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const categories = useStore((s) => s.productCategories);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const shown = useMemo(
    () => categories.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase())),
    [categories, q],
  );
  const exact = categories.some((c) => c.toLowerCase() === q.trim().toLowerCase());
  const canCreate = q.trim().length > 0 && !exact;

  const pick = (c: string) => { onChange(c); setQ(''); setOpen(false); };

  return (
    <div className="dh-cp-combo">
      <input
        className="dh-pw-input"
        value={open ? q : value}
        placeholder="Search or create…"
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); pick(q.trim()); } }}
      />
      <Icon name="chevronDown" size={14} className="dh-cp-combo-caret" />
      {open && (
        <div className="dh-cp-combo-menu">
          {shown.map((c) => (
            <button key={c} className={`dh-cp-combo-item ${c === value ? 'on' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
              {c}{c === value && <Icon name="check" size={13} />}
            </button>
          ))}
          {canCreate && (
            <button className="dh-cp-combo-create" onMouseDown={(e) => { e.preventDefault(); pick(q.trim()); }}>
              <Icon name="plus" size={13} /> Create “{q.trim()}”
            </button>
          )}
          {!shown.length && !canCreate && <div className="dh-cp-combo-empty">No categories</div>}
        </div>
      )}
    </div>
  );
}
