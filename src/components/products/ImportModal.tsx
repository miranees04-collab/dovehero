import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/primitives';
import { useStore } from '@/store/useStore';
import { uid } from '@/lib/format';
import type { Product, BillingPeriod } from '@/types';
import { PRODUCT_TYPE_ORDER, resolveType } from '@/data/products';

const SAMPLE = `Name,SKU,Type,Category,Price,Cost
Aurora Mobile — Pro,AUR-MOB,subscription,Add-on,9600,1200
Onsite Workshop,SVC-WSHOP,service,Service,7500,3200
Aurora Sticker Pack,MERCH-STK,physical,Hardware,15,4`;

interface Row { name: string; sku: string; type: string; category: string; price: number; cost: number; }

/** Very small CSV parser — handles quoted fields and commas. */
function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const cell = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out.map((s) => s.trim());
  };
  const header = cell(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const hasHeader = ['name', 'price'].some((h) => header.includes(h));
  const rows = (hasHeader ? lines.slice(1) : lines).map((line) => {
    const c = cell(line);
    const get = (n: string, pos: number) => (hasHeader && idx(n) >= 0 ? c[idx(n)] : c[pos]) ?? '';
    return {
      name: get('name', 0) || 'Imported product',
      sku: get('sku', 1),
      type: (get('type', 2) || 'subscription').toLowerCase(),
      category: get('category', 3) || 'Add-on',
      price: Number(String(get('price', 4)).replace(/[^0-9.\-]/g, '')) || 0,
      cost: Number(String(get('cost', 5)).replace(/[^0-9.\-]/g, '')) || 0,
    };
  });
  return rows.filter((r) => r.name);
}

const EMOJI: Record<string, string> = { subscription: '🚀', usage: '⚡', service: '🧭', physical: '📦', digital: '☁️', bundle: '🎁' };
const billingFor = (t: string): BillingPeriod => (t === 'subscription' ? 'annual' : t === 'usage' ? 'monthly' : 'one_time');

export function ImportModal({ onClose }: { onClose: () => void }) {
  const addObjectRecord = useStore((s) => s.addObjectRecord);
  const customTypes = useStore((s) => s.productTypes);
  const toast = useStore((s) => s.toast);
  const [text, setText] = useState('');

  const rows = useMemo(() => parseCsv(text), [text]);

  const onFile = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setText(String(r.result || ''));
    r.readAsText(f);
  };

  const doImport = () => {
    if (!rows.length) { toast('Nothing to import — paste or upload CSV', 'warn'); return; }
    rows.forEach((row) => {
      const type = (PRODUCT_TYPE_ORDER as string[]).includes(row.type) ? row.type : 'subscription';
      const tracked = type === 'physical';
      const p: Product = {
        id: 'PR-' + uid('n').slice(-4).toUpperCase(),
        name: row.name,
        sku: (row.sku || row.name.slice(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100)).toUpperCase(),
        type, category: row.category, status: 'draft', description: '',
        price: row.price, cost: row.cost, currency: 'USD', billing: billingFor(type), taxRate: 0,
        tracked, onHand: 0, committed: 0, reorderPoint: tracked ? 5 : 0, warehouse: tracked ? 'Reno DC-1' : undefined,
        stage: 'Backlog', tags: ['imported'],
        image: { emoji: EMOJI[type] ?? '🧩', hue: resolveType(type, customTypes).hue },
        createdW: 'now', updatedW: 'now',
        acts: [{ id: uid('pa'), type: 'note', who: 'You', w: 'now', text: `Imported from CSV.` }],
      };
      addObjectRecord('product', p as unknown as Record<string, unknown> & { id: string });
    });
    toast(`Imported ${rows.length} product${rows.length !== 1 ? 's' : ''}`, 'success');
    onClose();
  };

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onClose} />
      <div className="dh-cp" style={{ width: 620 }} role="dialog" aria-label="Import products">
        <div className="dh-doc-head">
          <div className="dh-doc-head-id"><span className="dh-doc-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-700)' }}><Icon name="arrowUp" size={14} /> Import products</span></div>
          <button className="dh-pw-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="dh-cp-body">
          <div className="dh-import-actions">
            <label className="dh-import-file"><Icon name="paperclip" size={14} /> Upload CSV<input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} hidden /></label>
            <button className="dh-import-sample" onClick={() => setText(SAMPLE)}>Load sample</button>
            <span className="dh-pw-dim">Columns: Name, SKU, Type, Category, Price, Cost</span>
          </div>
          <textarea className="dh-pw-textarea" rows={7} value={text} placeholder={SAMPLE} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          {rows.length > 0 && (
            <>
              <div className="dh-import-preview-head">Preview · <b>{rows.length}</b> product{rows.length !== 1 ? 's' : ''}</div>
              <table className="dh-pw-mini">
                <thead><tr><th>Name</th><th>Type</th><th>Category</th><th className="col-num">Price</th></tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}><td>{r.name}</td><td>{resolveType(r.type, customTypes).label}</td><td>{r.category}</td><td className="col-num">${r.price.toLocaleString()}</td></tr>
                  ))}
                  {rows.length > 5 && <tr><td colSpan={4} className="dh-pw-dim" style={{ textAlign: 'center' }}>+ {rows.length - 5} more…</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="dh-cp-foot"><span /><div className="dh-cp-foot-btns">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={doImport} disabled={!rows.length}><Icon name="arrowUp" size={15} /> Import {rows.length || ''}</Button>
        </div></div>
      </div>
    </>
  );
}
