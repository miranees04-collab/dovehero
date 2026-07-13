import { useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Popover, MenuItem } from '@/components/ui/primitives';
import { useEsc } from '@/components/ui/useEsc';
import { money } from '@/lib/format';
import type { Payment, PaymentMethod, PaymentStatus } from '@/types';
import { PAYMENT_METHODS, payStatusTone, docBalance, price as fmtPrice } from '@/data/products';

const PAY_HUE: Record<PaymentStatus, string> = { Succeeded: '#10B981', Pending: '#F59E0B', Failed: '#EF4444', Refunded: '#94A3B8' };
const PAY_STATUSES: PaymentStatus[] = ['Succeeded', 'Pending', 'Failed', 'Refunded'];

export function PaymentsView({ view, q, onOpenInvoice }: { view: 'list' | 'board'; q: string; onOpenInvoice: (id: string) => void }) {
  const payments = useStore((s) => s.payments);
  const refund = useStore((s) => s.refundPayment);
  const updated = payments; // reactive
  const query = q.trim().toLowerCase();
  const list = query ? updated.filter((p) => (p.number + ' ' + p.party + ' ' + (p.invoiceNumber ?? '')).toLowerCase().includes(query)) : updated;

  const open = (p: Payment) => { if (p.invoiceId) onOpenInvoice(p.invoiceId); };

  if (view === 'board') {
    return (
      <div className="dh-pw-scroll">
        <div className="dh-pp">
          {PAY_STATUSES.map((st) => {
            const items = list.filter((p) => p.status === st);
            const val = items.reduce((s, p) => s + p.amount, 0);
            return (
              <div key={st} style={{ ['--sh']: PAY_HUE[st] } as CSSProperties} className="dh-pp-col">
                <div className="dh-pp-colhead">
                  <span className="dh-pp-coldot" style={{ background: PAY_HUE[st] }} /><b>{st}</b>
                  <span className="dh-pp-colcount">{items.length}</span>
                  <span className="dh-pp-colval">{val ? money(val, true) : ''}</span>
                </div>
                <div className="dh-pp-colbody">
                  {items.map((p) => (
                    <div key={p.id} className="dh-pp-card dh-cm-card" role="button" tabIndex={0} onClick={() => open(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter') open(p); }}>
                      <div className="dh-cm-card-top"><b className="mono">{p.number}</b><span className="dh-cm-card-total">{fmtPrice(p.amount, p.currency)}</span></div>
                      <div className="dh-cm-card-party">{p.party || '—'} · {p.method}</div>
                      {p.invoiceNumber && <div className="dh-cm-card-bal">{p.invoiceNumber}</div>}
                    </div>
                  ))}
                  {!items.length && <div className="dh-pp-empty">None</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="dh-pw-scroll">
      <table className="dh-pw-table">
        <thead><tr><th>Payment</th><th>Invoice</th><th>Customer</th><th>Method</th><th>Status</th><th className="col-num">Amount</th><th>Date</th><th className="col-menu"></th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} tabIndex={0} role="button" aria-label={`Payment ${p.number}`} onClick={() => open(p)}
              onKeyDown={(e) => { if (e.key === 'Enter') open(p); }}>
              <td><b className="mono">{p.number}</b></td>
              <td>{p.invoiceNumber ? <span className="mono dh-pw-link">{p.invoiceNumber}</span> : <span className="dh-pw-dim">—</span>}</td>
              <td>{p.party || <span className="dh-pw-dim">—</span>}</td>
              <td>{p.method}</td>
              <td><Badge tone={payStatusTone(p.status)}>{p.status}</Badge></td>
              <td className="col-num"><b>{fmtPrice(p.amount, p.currency)}</b></td>
              <td><span className="dh-pw-dim">{p.w} ago</span></td>
              <td className="col-menu" onClick={(e) => e.stopPropagation()}>
                <Popover align="end" trigger={({ toggle }) => <button className="dh-pw-rowmenu" onClick={toggle} aria-label="Actions"><Icon name="more" size={16} /></button>}>
                  {(close) => (
                    <div className="dh-pw-sortmenu">
                      {p.invoiceId && <MenuItem icon={<Icon name="receipt" size={14} />} onClick={() => { open(p); close(); }}>Open invoice</MenuItem>}
                      {p.status === 'Succeeded' && <MenuItem danger icon={<Icon name="reset" size={14} />} onClick={() => { refund(p.id); close(); }}>Refund</MenuItem>}
                    </div>
                  )}
                </Popover>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="dh-pw-empty"><span className="dh-pw-empty-icon"><Icon name="dollar" size={26} /></span><b>No payments yet</b><span>Record a payment against an invoice.</span></div>
      )}
    </div>
  );
}

/** Modal to record a payment against an open invoice. */
export function PaymentModal({ onClose }: { onClose: () => void }) {
  const salesDocs = useStore((s) => s.salesDocs);
  const invoices = salesDocs.filter((d) => d.kind === 'invoice' && ['Open', 'Overdue'].includes(d.status));
  const recordPayment = useStore((s) => s.recordPayment);
  const toast = useStore((s) => s.toast);
  const [invId, setInvId] = useState(invoices[0]?.id ?? '');
  const [method, setMethod] = useState<PaymentMethod>('Card');
  const inv = invoices.find((d) => d.id === invId);
  const bal = inv ? docBalance(inv) : 0;
  const [amount, setAmount] = useState(String(bal));
  useEsc(onClose);

  const submit = () => {
    if (!inv) { toast('Pick an invoice', 'warn'); return; }
    recordPayment(inv.id, Number(amount) || 0, method);
    onClose();
  };

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onClose} />
      <div className="dh-cp" style={{ width: 460 }} role="dialog" aria-label="Record payment">
        <div className="dh-doc-head"><div className="dh-doc-head-id"><span className="dh-doc-badge" style={{ background: '#10B98118', color: '#10B981' }}><Icon name="dollar" size={14} /> Record payment</span></div>
          <button className="dh-pw-x" onClick={onClose}><Icon name="x" size={16} /></button></div>
        <div className="dh-cp-body">
          {invoices.length ? (
            <>
              <label className="dh-pw-flabel">Invoice</label>
              <select className="dh-pw-input" value={invId} onChange={(e) => { setInvId(e.target.value); const d = invoices.find((x) => x.id === e.target.value); setAmount(String(d ? docBalance(d) : 0)); }}>
                {invoices.map((d) => <option key={d.id} value={d.id}>{d.number} · {d.party || '—'} · bal {fmtPrice(docBalance(d), d.currency)}</option>)}
              </select>
              <div className="dh-cp-grid">
                <div><label className="dh-pw-flabel">Amount</label>
                  <div className="dh-cp-money"><span>{inv ? { USD: '$', EUR: '€', GBP: '£' }[inv.currency] : '$'}</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                </div>
                <div><label className="dh-pw-flabel">Method</label>
                  <select className="dh-pw-input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <p className="dh-pw-hint-inline">Balance due <b>{fmtPrice(bal, inv?.currency ?? 'USD')}</b> · a payment record is created and the invoice updated.</p>
            </>
          ) : <p className="dh-pw-mini-empty">No open invoices to pay. Every invoice is settled 🎉</p>}
        </div>
        <div className="dh-cp-foot"><span /><div className="dh-cp-foot-btns">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!invoices.length}><Icon name="check" size={15} /> Record</Button>
        </div></div>
      </div>
    </>
  );
}
