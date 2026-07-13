import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button, Badge } from '@/components/ui/primitives';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useStore } from '@/store/useStore';
import type { SalesLine, Product, CurrencyCode } from '@/types';
import { DOC_META, docTotals, docBalance, docStatusTone, price as fmtPrice, CURRENCIES } from '@/data/products';

/** CPQ editor for a quote / sales order / purchase order. Edits live in the store. */
export function DocBuilder({ id, onClose }: { id: string; onClose: () => void }) {
  const doc = useStore((s) => s.salesDocs.find((d) => d.id === id));
  const catalog = useStore((s) => s.objectRecords.product ?? []) as unknown as Product[];
  const update = useStore((s) => s.updateSalesDoc);
  const remove = useStore((s) => s.removeSalesDoc);
  const convert = useStore((s) => s.convertQuoteToOrder);
  const toInvoice = useStore((s) => s.convertToInvoice);
  const recordPayment = useStore((s) => s.recordPayment);
  const receive = useStore((s) => s.receivePO);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!doc) return null;
  const meta = DOC_META[doc.kind];
  const t = docTotals(doc);
  const sym = CURRENCIES[doc.currency].symbol;

  const setLine = (i: number, patch: Partial<SalesLine>) =>
    update(id, { lines: doc.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const addLine = (pidStr: string) => {
    const src = catalog.find((p) => p.id === pidStr);
    if (!src) return;
    update(id, { lines: [...doc.lines, { productId: src.id, name: src.name, qty: 1, unit: meta.unitFrom === 'cost' ? src.cost : src.price }] });
  };
  const delLine = (i: number) => update(id, { lines: doc.lines.filter((_, j) => j !== i) });

  const options = catalog.filter((p) => p.type !== 'bundle' || meta.unitFrom === 'price');

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onClose} />
      <div className="dh-doc" role="dialog" aria-label={`${meta.label} ${doc.number}`} style={{ ['--dhue' as string]: meta.hue }}>
        <div className="dh-doc-head">
          <div className="dh-doc-head-id">
            <span className="dh-doc-badge" style={{ background: meta.hue + '18', color: meta.hue }}><Icon name={meta.icon} size={14} /> {meta.label}</span>
            <b className="mono">{doc.number}</b>
            <InlineEdit value={doc.status} display={<Badge tone={docStatusTone(doc.kind, doc.status)}>{doc.status}</Badge>}
              options={meta.statuses.map((s) => ({ value: s, label: s }))} onCommit={(v) => update(id, { status: v })} />
          </div>
          <button className="dh-pw-x" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        <div className="dh-doc-body">
          <div className="dh-doc-metarow">
            <div className="dh-doc-field">
              <label>{meta.partyLabel}</label>
              <input className="dh-pw-input" value={doc.party} placeholder={`${meta.partyLabel} name`} onChange={(e) => update(id, { party: e.target.value })} />
            </div>
            {doc.kind === 'invoice' && (
              <div className="dh-doc-field sm">
                <label>Due</label>
                <input className="dh-pw-input" value={doc.dueW ?? ''} placeholder="in 30d" onChange={(e) => update(id, { dueW: e.target.value })} />
              </div>
            )}
            <div className="dh-doc-field sm">
              <label>Currency</label>
              <select className="dh-pw-input" value={doc.currency} onChange={(e) => update(id, { currency: e.target.value as CurrencyCode })}>
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <table className="dh-pw-mini dh-doc-lines">
            <thead><tr><th>Item</th><th className="col-num">Qty</th><th className="col-num">Unit</th><th className="col-num">Amount</th><th></th></tr></thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td className="col-num"><InlineEdit value={l.qty} type="number" onCommit={(v) => setLine(i, { qty: Math.max(1, Number(v) || 1) })} /></td>
                  <td className="col-num">{sym}<InlineEdit value={l.unit} type="number" onCommit={(v) => setLine(i, { unit: Number(v) || 0 })} /></td>
                  <td className="col-num">{fmtPrice(l.qty * l.unit, doc.currency)}</td>
                  <td className="col-menu"><button className="dh-pw-rowx" onClick={() => delLine(i)} aria-label="Remove line"><Icon name="x" size={13} /></button></td>
                </tr>
              ))}
              {!doc.lines.length && <tr><td colSpan={5} className="dh-doc-empty">No line items yet — add a product below.</td></tr>}
            </tbody>
          </table>

          {options.length > 0 && (
            <select className="dh-pw-input dh-bundle-add" value="" onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
              <option value="">＋ Add a product…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name} — {fmtPrice(meta.unitFrom === 'cost' ? o.cost : o.price, o.currency)}</option>)}
            </select>
          )}

          <div className="dh-doc-bottom">
            <textarea className="dh-pw-textarea" rows={3} value={doc.notes ?? ''} placeholder="Notes / terms…" onChange={(e) => update(id, { notes: e.target.value })} />
            <div className="dh-doc-totals">
              <div><span>Subtotal</span><b>{fmtPrice(t.subtotal, doc.currency)}</b></div>
              <div>
                <span>Discount <InlineEdit value={doc.discount} type="number" onCommit={(v) => update(id, { discount: Number(v) || 0 })} />%</span>
                <b>−{fmtPrice(t.discountAmt, doc.currency)}</b>
              </div>
              <div>
                <span>Tax <InlineEdit value={doc.tax} type="number" onCommit={(v) => update(id, { tax: Number(v) || 0 })} />%</span>
                <b>{fmtPrice(t.taxAmt, doc.currency)}</b>
              </div>
              <div className="total"><span>Total</span><b>{fmtPrice(t.total, doc.currency)}</b></div>
              {doc.kind === 'invoice' && (
                <>
                  <div><span>Paid</span><b>{fmtPrice(doc.paid || 0, doc.currency)}</b></div>
                  <div className="balance"><span>Balance due</span><b>{fmtPrice(docBalance(doc), doc.currency)}</b></div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="dh-doc-foot">
          <button className="dh-doc-del" onClick={() => { if (confirm(`Delete ${doc.number}?`)) { remove(id); onClose(); } }}><Icon name="trash" size={14} /> Delete</button>
          <div className="dh-doc-foot-btns">
            {doc.kind === 'quote' && <Button variant="ghost" onClick={() => { convert(id); onClose(); }}><Icon name="boxes" size={15} /> To order</Button>}
            {(doc.kind === 'quote' || doc.kind === 'order') && <Button variant="ghost" onClick={() => { toInvoice(id); onClose(); }}><Icon name="receipt" size={15} /> Invoice</Button>}
            {doc.kind === 'po' && doc.status !== 'Received' && <Button variant="ghost" onClick={() => { receive(id); }}><Icon name="truck" size={15} /> Receive stock</Button>}
            {doc.kind === 'invoice' && docBalance(doc) > 0 && doc.status !== 'Void' && (
              <Button variant="ghost" onClick={() => {
                const bal = docBalance(doc);
                const raw = window.prompt(`Payment amount (balance ${fmtPrice(bal, doc.currency)})`, String(bal));
                if (raw != null) recordPayment(id, Number(raw) || 0);
              }}><Icon name="dollar" size={15} /> Record payment</Button>
            )}
            <Button variant="primary" onClick={onClose}><Icon name="check" size={15} /> Done</Button>
          </div>
        </div>
      </div>
    </>
  );
}
