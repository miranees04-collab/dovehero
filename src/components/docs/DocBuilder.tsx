import { useStore } from '@/store/useStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { money } from '@/lib/format';
import type { DocItem } from '@/types';
import './docs.css';

export function DocBuilder() {
  const b = useStore((s) => s.docBuilder);
  const deal = useStore((s) => s.deals.find((d) => d.id === b?.dealId));
  const setDocBuilder = useStore((s) => s.setDocBuilder);
  const closeDocBuilder = useStore((s) => s.closeDocBuilder);
  const saveDoc = useStore((s) => s.saveDoc);

  if (!b || !deal) return null;
  const isInv = b.kind === 'invoice';
  const sub = b.items.reduce((a, it) => a + it.qty * it.unit, 0);
  const disc = Math.round((sub * b.discount) / 100);
  const tax = Math.round(((sub - disc) * b.tax) / 100);
  const total = sub - disc + tax;

  const setItem = (i: number, patch: Partial<DocItem>) =>
    setDocBuilder({ items: b.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const addItem = () => setDocBuilder({ items: [...b.items, { name: 'New line item', qty: 1, unit: 0 }] });
  const removeItem = (i: number) => setDocBuilder({ items: b.items.filter((_, idx) => idx !== i) });

  return (
    <Modal
      open
      onClose={closeDocBuilder}
      width={620}
      title={<><Icon name="receipt" size={18} /> New {b.kind} · {deal.company}</>}
      footer={
        <>
          <div className="dh-doc-total-foot">Total <b className="mono">{money(total)}</b></div>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={closeDocBuilder}>Cancel</Button>
          <Button variant="primary" onClick={saveDoc}><Icon name="check" size={15} /> Create {b.kind}</Button>
        </>
      }
    >
      <div className="dh-doc-lihead">
        <span>Item</span><span>Qty</span><span>Unit price</span><span>Amount</span><span />
      </div>
      {b.items.map((it, i) => (
        <div className="dh-doc-li" key={i}>
          <input className="dh-input" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
          <input className="dh-input" type="number" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
          <input className="dh-input" type="number" value={it.unit} onChange={(e) => setItem(i, { unit: Number(e.target.value) || 0 })} />
          <span className="dh-doc-amt mono">{money(it.qty * it.unit)}</span>
          <button className="dh-doc-del" onClick={() => removeItem(i)} aria-label="Remove"><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button className="dh-adv-add" style={{ marginTop: 8 }} onClick={addItem}><Icon name="plus" size={13} /> Add line item</button>

      <div className="dh-doc-totals">
        <div className="dh-doc-trow"><span>Subtotal</span><span className="mono">{money(sub)}</span></div>
        <div className="dh-doc-trow">
          <span>Discount <input className="dh-doc-pct" type="number" value={b.discount} onChange={(e) => setDocBuilder({ discount: Number(e.target.value) || 0 })} />%</span>
          <span className="mono">−{money(disc)}</span>
        </div>
        <div className="dh-doc-trow">
          <span>Tax <input className="dh-doc-pct" type="number" value={b.tax} onChange={(e) => setDocBuilder({ tax: Number(e.target.value) || 0 })} />%</span>
          <span className="mono">{money(tax)}</span>
        </div>
        <div className="dh-doc-trow total"><span>Total {isInv ? '(due)' : ''}</span><span className="mono">{money(total)}</span></div>
      </div>
      <p className="dh-comp-note"><Icon name="zap" size={12} /> Demo mode — generates a PDF entry on the deal timeline; nothing is billed.</p>
    </Modal>
  );
}
