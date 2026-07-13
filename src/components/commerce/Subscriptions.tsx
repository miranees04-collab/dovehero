import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button } from '@/components/ui/primitives';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { money } from '@/lib/format';
import type { SalesLine, Product, SubInterval, SubStatus } from '@/types';
import { SUB_INTERVALS, SUB_STATUSES, subStatusTone, intervalLabel, mrrOf, price as fmtPrice, CURRENCIES } from '@/data/products';

const SUB_HUE: Record<SubStatus, string> = { Active: '#10B981', Paused: '#F59E0B', Cancelled: '#EF4444' };

export function SubscriptionsView({ view, q, onOpen }: { view: 'list' | 'board'; q: string; onOpen: (id: string) => void }) {
  const subs = useStore((s) => s.subscriptions);
  const query = q.trim().toLowerCase();
  const list = query ? subs.filter((x) => (x.number + ' ' + x.party).toLowerCase().includes(query)) : subs;

  if (view === 'board') {
    return (
      <div className="dh-pw-scroll">
        <div className="dh-pp">
          {SUB_STATUSES.map((st) => {
            const items = list.filter((x) => x.status === st);
            const mrr = items.reduce((s, x) => s + mrrOf(x), 0);
            return (
              <div key={st} style={{ ['--sh']: SUB_HUE[st] } as CSSProperties} className="dh-pp-col">
                <div className="dh-pp-colhead">
                  <span className="dh-pp-coldot" style={{ background: SUB_HUE[st] }} /><b>{st}</b>
                  <span className="dh-pp-colcount">{items.length}</span>
                  <span className="dh-pp-colval">{mrr ? money(mrr, true) + '/mo' : ''}</span>
                </div>
                <div className="dh-pp-colbody">
                  {items.map((x) => (
                    <div key={x.id} className="dh-pp-card dh-cm-card" role="button" tabIndex={0} onClick={() => onOpen(x.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(x.id); }}>
                      <div className="dh-cm-card-top"><b className="mono">{x.number}</b><span className="dh-cm-card-total">{fmtPrice(mrrOf(x), x.currency)}/mo</span></div>
                      <div className="dh-cm-card-party">{x.party || '—'} · {intervalLabel(x.interval)}</div>
                      <div className="dh-cm-card-bal">Next {x.nextW}</div>
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
        <thead><tr><th>Subscription</th><th>Customer</th><th>Plan</th><th className="col-num">MRR</th><th>Next billing</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id} tabIndex={0} role="button" aria-label={`Open ${x.number}`} onClick={() => onOpen(x.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(x.id); }}>
              <td><b className="mono">{x.number}</b></td>
              <td>{x.party || <span className="dh-pw-dim">—</span>}</td>
              <td>{intervalLabel(x.interval)} · {x.lines.length} item{x.lines.length !== 1 ? 's' : ''}</td>
              <td className="col-num"><b>{fmtPrice(mrrOf(x), x.currency)}</b></td>
              <td><span className="dh-pw-dim">{x.nextW}</span></td>
              <td><Badge tone={subStatusTone(x.status)}>{x.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="dh-pw-empty"><span className="dh-pw-empty-icon"><Icon name="repeat" size={26} /></span><b>No subscriptions yet</b><span>Create a recurring plan from products.</span></div>
      )}
    </div>
  );
}

/** Editor for a subscription — plan, line items, lifecycle & recurring invoices. */
export function SubBuilder({ id, onClose }: { id: string; onClose: () => void }) {
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id));
  const catalog = useStore((s) => s.objectRecords.product ?? []) as unknown as Product[];
  const update = useStore((s) => s.updateSubscription);
  const remove = useStore((s) => s.removeSubscription);
  const genInvoice = useStore((s) => s.generateInvoiceFromSub);
  const addItem = useStore((s) => s.addSubscriptionItem);
  const [addonId, setAddonId] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!sub) return null;
  const sym = CURRENCIES[sub.currency].symbol;
  const mrr = mrrOf(sub);
  const options = catalog.filter((p) => p.type !== 'bundle');

  const setLine = (i: number, patch: Partial<SalesLine>) => update(id, { lines: sub.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const addLine = (pidStr: string) => { const src = catalog.find((p) => p.id === pidStr); if (src) update(id, { lines: [...sub.lines, { productId: src.id, name: src.name, qty: 1, unit: src.price }] }); };
  const delLine = (i: number) => update(id, { lines: sub.lines.filter((_, j) => j !== i) });

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onClose} />
      <div className="dh-doc" role="dialog" aria-label={sub.number} style={{ ['--dhue']: '#8B5CF6' } as CSSProperties}>
        <div className="dh-doc-head">
          <div className="dh-doc-head-id">
            <span className="dh-doc-badge" style={{ background: '#8B5CF618', color: '#8B5CF6' }}><Icon name="repeat" size={14} /> Subscription</span>
            <b className="mono">{sub.number}</b>
            <InlineEdit value={sub.status} display={<Badge tone={subStatusTone(sub.status)}>{sub.status}</Badge>} options={SUB_STATUSES.map((s) => ({ value: s, label: s }))} onCommit={(v) => update(id, { status: v as SubStatus })} />
          </div>
          <button className="dh-pw-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="dh-doc-body">
          <div className="dh-doc-metarow">
            <div className="dh-doc-field"><label>Customer</label>
              <input className="dh-pw-input" value={sub.party} placeholder="Customer name" onChange={(e) => update(id, { party: e.target.value })} /></div>
            <div className="dh-doc-field sm"><label>Interval</label>
              <select className="dh-pw-input" value={sub.interval} onChange={(e) => update(id, { interval: e.target.value as SubInterval })}>
                {SUB_INTERVALS.map((i) => <option key={i.k} value={i.k}>{i.label}</option>)}
              </select></div>
            <div className="dh-doc-field sm"><label>Next billing</label>
              <input className="dh-pw-input" value={sub.nextW} onChange={(e) => update(id, { nextW: e.target.value })} /></div>
          </div>

          <table className="dh-pw-mini dh-doc-lines">
            <thead><tr><th>Product</th><th className="col-num">Qty</th><th className="col-num">Unit</th><th className="col-num">Amount</th><th></th></tr></thead>
            <tbody>
              {sub.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td className="col-num"><InlineEdit value={l.qty} type="number" onCommit={(v) => setLine(i, { qty: Math.max(1, Number(v) || 1) })} /></td>
                  <td className="col-num">{sym}<InlineEdit value={l.unit} type="number" onCommit={(v) => setLine(i, { unit: Number(v) || 0 })} /></td>
                  <td className="col-num">{fmtPrice(l.qty * l.unit, sub.currency)}</td>
                  <td className="col-menu"><button className="dh-pw-rowx" onClick={() => delLine(i)} aria-label="Remove"><Icon name="x" size={13} /></button></td>
                </tr>
              ))}
              {!sub.lines.length && <tr><td colSpan={5} className="dh-doc-empty">No products — add one below.</td></tr>}
            </tbody>
          </table>
          {options.length > 0 && (
            <select className="dh-pw-input dh-bundle-add" value="" onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
              <option value="">＋ Add a product…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name} — {fmtPrice(o.price, o.currency)}</option>)}
            </select>
          )}

          {sub.status === 'Active' && (
            <div className="dh-sub-addon">
              <div className="dh-sub-addon-head"><Icon name="plus" size={13} /> Mid-cycle add-on <span className="dh-pw-dim">· bills a prorated invoice for the remaining {Math.round((sub.cycleRemaining ?? 0.5) * 100)}% of the period</span></div>
              <div className="dh-sub-addon-row">
                <select className="dh-pw-input" value={addonId} onChange={(e) => setAddonId(e.target.value)}>
                  <option value="">Choose a product…</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name} — {fmtPrice(o.price, o.currency)}</option>)}
                </select>
                <Button variant="ghost" size="sm" disabled={!addonId} onClick={() => {
                  const src = catalog.find((p) => p.id === addonId);
                  if (!src) return;
                  addItem(id, { productId: src.id, name: src.name, qty: 1, unit: src.price }, true);
                  setAddonId('');
                }}><Icon name="dollar" size={14} /> Add &amp; prorate</Button>
              </div>
              {addonId && (() => { const src = catalog.find((p) => p.id === addonId); const est = src ? Math.round(src.price * (sub.cycleRemaining ?? 0.5)) : 0; return <div className="dh-sub-addon-est">Prorated charge now: <b>{fmtPrice(est, sub.currency)}</b> · then {src ? fmtPrice(src.price, sub.currency) : ''}/{intervalLabel(sub.interval).toLowerCase()}</div>; })()}
            </div>
          )}

          <div className="dh-doc-bottom">
            <div className="dh-sub-recur">
              <Icon name="repeat" size={14} />
              <span>Bills <b>{intervalLabel(sub.interval).toLowerCase()}</b> · started {sub.startedW} ago</span>
            </div>
            <div className="dh-doc-totals">
              <div><span>Per {intervalLabel(sub.interval).toLowerCase()}</span><b>{fmtPrice(sub.lines.reduce((a, l) => a + l.qty * l.unit, 0), sub.currency)}</b></div>
              <div><span>MRR</span><b>{fmtPrice(mrr, sub.currency)}</b></div>
              <div className="total"><span>ARR</span><b>{fmtPrice(mrr * 12, sub.currency)}</b></div>
            </div>
          </div>
        </div>

        <div className="dh-doc-foot">
          <button className="dh-doc-del" onClick={() => { if (confirm(`Delete ${sub.number}?`)) { remove(id); onClose(); } }}><Icon name="trash" size={14} /> Delete</button>
          <div className="dh-doc-foot-btns">
            {sub.status === 'Active'
              ? <Button variant="ghost" onClick={() => update(id, { status: 'Paused', nextW: 'paused' })}><Icon name="clock" size={15} /> Pause</Button>
              : sub.status === 'Paused' && <Button variant="ghost" onClick={() => update(id, { status: 'Active', nextW: 'in 1m' })}><Icon name="check" size={15} /> Resume</Button>}
            <Button variant="ghost" onClick={() => { genInvoice(id); onClose(); }}><Icon name="receipt" size={15} /> Generate invoice</Button>
            <Button variant="primary" onClick={onClose}><Icon name="check" size={15} /> Done</Button>
          </div>
        </div>
      </div>
    </>
  );
}
