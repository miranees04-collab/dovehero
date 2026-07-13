import { useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Popover, MenuItem } from '@/components/ui/primitives';
import { money } from '@/lib/format';
import type { SalesDoc, SalesDocKind } from '@/types';
import {
  DOC_META,
  DOC_KIND_ORDER,
  docTotals,
  docBalance,
  docStatusTone,
  dueLabel,
  invoiceAging,
  AGING_BUCKETS,
  mrrOf,
  price as fmtPrice,
} from '@/data/products';
import { DocBuilder } from '@/components/products/DocBuilder';
import { PaymentsView, PaymentModal } from './Payments';
import { SubscriptionsView, SubBuilder } from './Subscriptions';
import '@/components/products/products.css';
import './commerce.css';

export type CommerceSection = 'overview' | SalesDocKind | 'payment' | 'subscription';

const SECTION_META: Record<CommerceSection, { title: string; sub: string; icon: string; hue: string }> = {
  overview: { title: 'Commerce', sub: 'Quotes, orders, invoices, payments & subscriptions — synced to your products.', icon: 'activity', hue: '#6366F1' },
  quote: { title: 'Quotes', sub: 'Proposals sent to customers — manage the quote pipeline.', icon: 'fileText', hue: '#6366F1' },
  order: { title: 'Orders', sub: 'Confirmed sales orders and fulfilment.', icon: 'boxes', hue: '#10B981' },
  invoice: { title: 'Invoices', sub: 'Billing & collections — paid, open and overdue.', icon: 'receipt', hue: '#EC4899' },
  po: { title: 'Purchase orders', sub: 'Restock from vendors — receive to update inventory.', icon: 'truck', hue: '#F59E0B' },
  payment: { title: 'Payments', sub: 'Money collected against invoices.', icon: 'dollar', hue: '#10B981' },
  subscription: { title: 'Subscriptions', sub: 'Recurring plans and revenue (MRR / ARR).', icon: 'repeat', hue: '#8B5CF6' },
};

export function CommerceWorkspace({ section }: { section: CommerceSection }) {
  const docs = useStore((s) => s.salesDocs);
  const payments = useStore((s) => s.payments);
  const subs = useStore((s) => s.subscriptions);
  const createSalesDoc = useStore((s) => s.createSalesDoc);
  const createSubscription = useStore((s) => s.createSubscription);

  const [view, setView] = useState<'list' | 'board'>('list');
  const [q, setQ] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const meta = SECTION_META[section];
  const by = (k: SalesDocKind) => docs.filter((d) => d.kind === k);
  const sum = (list: SalesDoc[]) => list.reduce((s, d) => s + docTotals(d).total, 0);
  const invoices = by('invoice');
  const mrr = subs.filter((x) => x.status === 'Active').reduce((s, x) => s + mrrOf(x), 0);

  const kpi = {
    quotesOpen: sum(by('quote').filter((d) => ['Draft', 'Sent'].includes(d.status))),
    orders: sum(by('order').filter((d) => ['Open', 'Fulfilled'].includes(d.status))),
    invoiced: sum(invoices.filter((d) => d.status !== 'Void')),
    collected: invoices.reduce((s, d) => s + (d.paid || 0), 0),
    outstanding: invoices.filter((d) => ['Open', 'Overdue'].includes(d.status)).reduce((s, d) => s + docBalance(d), 0),
    overdue: invoices.filter((d) => d.status === 'Overdue').reduce((s, d) => s + docBalance(d), 0),
    received: payments.filter((p) => p.status === 'Succeeded').reduce((s, p) => s + p.amount, 0),
    pending: payments.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0),
    mrr, arr: mrr * 12, activeSubs: subs.filter((x) => x.status === 'Active').length,
  };

  const newDoc = (k: SalesDocKind) => setDocId(createSalesDoc(k));
  const newSub = () => setSubId(createSubscription());

  const primaryNew = () => {
    if (section === 'payment') setPayOpen(true);
    else if (section === 'subscription') newSub();
    else if (section === 'overview' || section === 'invoice') { /* handled by menu */ }
    else newDoc(section);
  };

  return (
    <div className="dh-pw dh-cm" style={{ ['--phue']: meta.hue } as CSSProperties}>
      <div className="dh-pw-head">
        <div className="dh-pw-head-main">
          <div className="dh-pw-head-title">
            <span className="dh-pw-head-icon" style={{ background: `linear-gradient(135deg, ${meta.hue}, ${meta.hue}bb)` }}><Icon name={meta.icon} size={19} /></span>
            <div><h1>{meta.title}</h1><p>{meta.sub}</p></div>
          </div>
          <div className="dh-pw-head-actions">
            {section === 'overview' ? (
              <NewMenu onDoc={newDoc} onPayment={() => setPayOpen(true)} onSub={newSub} />
            ) : section === 'payment' ? (
              <Button variant="primary" size="sm" onClick={() => setPayOpen(true)}><Icon name="plus" size={15} /> Record payment</Button>
            ) : section === 'subscription' ? (
              <Button variant="primary" size="sm" onClick={newSub}><Icon name="plus" size={15} /> New subscription</Button>
            ) : (
              <Button variant="primary" size="sm" onClick={primaryNew}><Icon name="plus" size={15} /> New {DOC_META[section].label.toLowerCase()}</Button>
            )}
          </div>
        </div>

        <div className={`dh-pw-kpis ${section === 'overview' ? 'dh-cm-kpis' : 'dh-cm-kpis-sm'}`}>
          {section === 'overview' && <>
            <Kpi icon="fileText" label="Open quotes" value={money(kpi.quotesOpen, true)} tone="accent" />
            <Kpi icon="boxes" label="Orders" value={money(kpi.orders, true)} tone="green" />
            <Kpi icon="receipt" label="Invoiced" value={money(kpi.invoiced, true)} />
            <Kpi icon="dollar" label="Collected" value={money(kpi.collected, true)} tone="green" />
            <Kpi icon="clock" label="Outstanding" value={money(kpi.outstanding, true)} tone="amber" />
            <Kpi icon="repeat" label="MRR" value={money(kpi.mrr, true)} tone="accent" />
          </>}
          {section === 'quote' && <>
            <Kpi icon="fileText" label="Quotes" value={String(by('quote').length)} />
            <Kpi icon="dollar" label="Open value" value={money(kpi.quotesOpen, true)} tone="accent" />
          </>}
          {section === 'order' && <>
            <Kpi icon="boxes" label="Orders" value={String(by('order').length)} />
            <Kpi icon="dollar" label="Open value" value={money(kpi.orders, true)} tone="green" />
          </>}
          {section === 'invoice' && <>
            <Kpi icon="receipt" label="Invoiced" value={money(kpi.invoiced, true)} />
            <Kpi icon="dollar" label="Collected" value={money(kpi.collected, true)} tone="green" />
            <Kpi icon="clock" label="Outstanding" value={money(kpi.outstanding, true)} tone="amber" />
            <Kpi icon="alert" label="Overdue" value={money(kpi.overdue, true)} tone={kpi.overdue ? 'red' : 'neutral'} />
          </>}
          {section === 'po' && <Kpi icon="truck" label="Purchase orders" value={String(by('po').length)} />}
          {section === 'payment' && <>
            <Kpi icon="dollar" label="Collected" value={money(kpi.received, true)} tone="green" />
            <Kpi icon="clock" label="Pending" value={money(kpi.pending, true)} tone="amber" />
            <Kpi icon="reset" label="Payments" value={String(payments.length)} />
          </>}
          {section === 'subscription' && <>
            <Kpi icon="repeat" label="MRR" value={money(kpi.mrr, true)} tone="accent" />
            <Kpi icon="trendingUp" label="ARR" value={money(kpi.arr, true)} tone="green" />
            <Kpi icon="check" label="Active" value={String(kpi.activeSubs)} />
          </>}
        </div>
      </div>

      {/* Body */}
      {section === 'overview' && <Overview docs={docs} kpi={kpi} onOpen={setDocId} />}

      {(section === 'quote' || section === 'order' || section === 'invoice' || section === 'po') && (
        <>
          {section === 'invoice' && view === 'list' && <AgingPanel invoices={invoices} />}
          <Toolbar q={q} setQ={setQ} view={view} setView={setView} label={DOC_META[section].plural} count={by(section).length} />
          {view === 'board' ? <StatusBoard kind={section} docs={filterDocs(by(section), q)} onOpen={setDocId} />
            : <DocTable kind={section} docs={filterDocs(by(section), q)} onOpen={setDocId} />}
        </>
      )}

      {section === 'payment' && (
        <>
          <Toolbar q={q} setQ={setQ} view={view} setView={setView} label="payments" count={payments.length} />
          <PaymentsView view={view} q={q} onOpenInvoice={setDocId} />
        </>
      )}

      {section === 'subscription' && (
        <>
          <Toolbar q={q} setQ={setQ} view={view} setView={setView} label="subscriptions" count={subs.length} />
          <SubscriptionsView view={view} q={q} onOpen={setSubId} />
        </>
      )}

      {docId && <DocBuilder id={docId} onClose={() => setDocId(null)} />}
      {subId && <SubBuilder id={subId} onClose={() => setSubId(null)} />}
      {payOpen && <PaymentModal onClose={() => setPayOpen(false)} />}
    </div>
  );
}

function filterDocs(list: SalesDoc[], q: string): SalesDoc[] {
  const query = q.trim().toLowerCase();
  return query ? list.filter((d) => (d.number + ' ' + d.party).toLowerCase().includes(query)) : list;
}

function NewMenu({ onDoc, onPayment, onSub }: { onDoc: (k: SalesDocKind) => void; onPayment: () => void; onSub: () => void }) {
  return (
    <Popover align="end" trigger={({ toggle }) => <button className="dh-btn v-primary s-sm" onClick={toggle}><Icon name="plus" size={15} /> New <Icon name="chevronDown" size={13} /></button>}>
      {(close) => (
        <div className="dh-pw-sortmenu">
          {DOC_KIND_ORDER.map((k) => <MenuItem key={k} icon={<Icon name={DOC_META[k].icon} size={14} />} onClick={() => { onDoc(k); close(); }}>{DOC_META[k].label}</MenuItem>)}
          <MenuItem icon={<Icon name="dollar" size={14} />} onClick={() => { onPayment(); close(); }}>Payment</MenuItem>
          <MenuItem icon={<Icon name="repeat" size={14} />} onClick={() => { onSub(); close(); }}>Subscription</MenuItem>
        </div>
      )}
    </Popover>
  );
}

function Toolbar({ q, setQ, view, setView, label, count }: {
  q: string; setQ: (v: string) => void; view: 'list' | 'board'; setView: (v: 'list' | 'board') => void;
  label: string; count: number;
}) {
  return (
    <div className="dh-pw-toolbar">
      <div className="dh-pw-search">
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} />
        {q && <button className="dh-pw-clear" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
      </div>
      <div className="dh-pw-viewtoggle">
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><Icon name="list" size={15} /> List</button>
        <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><Icon name="grid" size={15} /> Board</button>
      </div>
      <span className="dh-pw-resultcount">{count} {label.toLowerCase()}</span>
    </div>
  );
}

/* ---------------- Overview dashboard ---------------- */
function Overview({ docs, kpi, onOpen }: { docs: SalesDoc[]; kpi: { invoiced: number; collected: number; outstanding: number; mrr: number; arr: number; activeSubs: number }; onOpen: (id: string) => void }) {
  const invoices = docs.filter((d) => d.kind === 'invoice' && d.status !== 'Void');
  const bill = {
    Paid: invoices.filter((d) => d.status === 'Paid').reduce((s, d) => s + docTotals(d).total, 0),
    Open: invoices.filter((d) => d.status === 'Open').reduce((s, d) => s + docBalance(d), 0),
    Overdue: invoices.filter((d) => d.status === 'Overdue').reduce((s, d) => s + docBalance(d), 0),
  };
  const billMax = Math.max(1, bill.Paid + bill.Open + bill.Overdue);
  const recent = [...docs].slice(0, 7);
  const collectRate = kpi.invoiced ? Math.round((kpi.collected / kpi.invoiced) * 100) : 0;

  return (
    <div className="dh-pw-scroll dh-cm-overview">
      <div className="dh-cm-panels">
        <section className="dh-cm-panel">
          <div className="dh-cm-panel-head"><b>Billing</b><span>{collectRate}% collected</span></div>
          <div className="dh-cm-billbars">
            {([['Paid', 'green'], ['Open', 'amber'], ['Overdue', 'red']] as const).map(([k, tone]) => (
              <div key={k} className="dh-cm-billbar">
                <span className="dh-cm-billbar-label"><i className={`dot ${tone}`} /> {k}</span>
                <div className="dh-cm-billbar-track"><div className={`dh-cm-billbar-fill ${tone}`} style={{ width: `${(bill[k] / billMax) * 100}%` }} /></div>
                <span className="dh-cm-billbar-val mono">{fmtPrice(bill[k])}</span>
              </div>
            ))}
          </div>
          <div className="dh-cm-billfoot">
            <div><span>Invoiced</span><b>{fmtPrice(kpi.invoiced)}</b></div>
            <div><span>Collected</span><b className="g">{fmtPrice(kpi.collected)}</b></div>
            <div><span>Recurring</span><b>{fmtPrice(kpi.arr)}/yr</b></div>
          </div>
        </section>

        <section className="dh-cm-panel">
          <div className="dh-cm-panel-head"><b>Recent documents</b></div>
          <div className="dh-cm-recent">
            {recent.map((d) => {
              const m = DOC_META[d.kind];
              return (
                <button key={d.id} className="dh-pr-docrow" onClick={() => onOpen(d.id)}>
                  <span className="dh-pr-docrow-ico" style={{ background: m.hue + '18', color: m.hue }}><Icon name={m.icon} size={14} /></span>
                  <div className="dh-pr-docrow-main"><b>{d.number} <span className="dh-pw-dim">· {d.party || '—'}</span></b><small>{m.label} · {d.updatedW} ago</small></div>
                  <Badge tone={docStatusTone(d.kind, d.status)}>{d.status}</Badge>
                  <span className="dh-pr-docrow-total mono">{fmtPrice(docTotals(d).total, d.currency)}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function AgingPanel({ invoices }: { invoices: SalesDoc[] }) {
  const aging = invoiceAging(invoices);
  const total = AGING_BUCKETS.reduce((s, b) => s + aging[b.k], 0);
  if (total <= 0) return null;
  return (
    <div className="dh-aging">
      <div className="dh-aging-title"><Icon name="clock" size={14} /> Accounts receivable aging <span className="dh-pw-dim">· {fmtPrice(total)} outstanding</span></div>
      <div className="dh-aging-buckets">
        {AGING_BUCKETS.map((b) => (
          <div key={b.k} className={`dh-aging-bucket tone-${b.tone}`}>
            <span className="dh-aging-amt">{fmtPrice(aging[b.k])}</span>
            <span className="dh-aging-lab">{b.label}</span>
            <div className="dh-aging-bar"><div className={`dh-aging-fill ${b.tone}`} style={{ width: `${total ? (aging[b.k] / total) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocTable({ kind, docs, onOpen }: { kind: SalesDocKind; docs: SalesDoc[]; onOpen: (id: string) => void }) {
  const meta = DOC_META[kind];
  return (
    <div className="dh-pw-scroll">
      <table className="dh-pw-table">
        <thead><tr><th>Number</th><th>{meta.partyLabel}</th><th>Status</th><th className="col-num">Items</th><th className="col-num">Total</th>{kind === 'invoice' && <><th className="col-num">Balance</th><th>Due</th></>}<th>Updated</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} tabIndex={0} role="button" aria-label={`Open ${d.number}`} onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(d.id); } }}>
              <td><b className="mono">{d.number}</b>{d.dunning ? <span className="dh-doc-dun-dot" title={`${d.dunning} reminder(s) sent`}><Icon name="clock" size={11} /> {d.dunning}</span> : null}</td>
              <td>{d.party || <span className="dh-pw-dim">—</span>}</td>
              <td><Badge tone={docStatusTone(d.kind, d.status)}>{d.status}</Badge></td>
              <td className="col-num">{d.lines.length}</td>
              <td className="col-num"><b>{fmtPrice(docTotals(d).total, d.currency)}</b></td>
              {kind === 'invoice' && <><td className="col-num">{d.status === 'Paid' ? <span className="dh-pw-dim">—</span> : fmtPrice(docBalance(d), d.currency)}</td><td><span className={(d.dueDays ?? 30) < 0 && d.status !== 'Paid' ? 'dh-doc-overdue' : 'dh-pw-dim'}>{d.status === 'Paid' ? '—' : dueLabel(d.dueDays)}</span></td></>}
              <td><span className="dh-pw-dim">{d.updatedW} ago</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!docs.length && <div className="dh-pw-empty"><span className="dh-pw-empty-icon"><Icon name={meta.icon} size={26} /></span><b>No {meta.plural.toLowerCase()} yet</b><span>Create one from here or from any product.</span></div>}
    </div>
  );
}

const STATUS_HUE: Record<string, string> = {
  Draft: '#94A3B8', Sent: '#F59E0B', Accepted: '#10B981', Expired: '#EF4444',
  Open: '#F59E0B', Fulfilled: '#10B981', Invoiced: '#6366F1', Cancelled: '#EF4444',
  Paid: '#10B981', Overdue: '#EF4444', Void: '#94A3B8', Ordered: '#F59E0B', Received: '#10B981',
};

function StatusBoard({ kind, docs, onOpen }: { kind: SalesDocKind; docs: SalesDoc[]; onOpen: (id: string) => void }) {
  const meta = DOC_META[kind];
  const updateSalesDoc = useStore((s) => s.updateSalesDoc);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="dh-pw-scroll">
      <div className="dh-pp">
        {meta.statuses.map((st) => {
          const items = docs.filter((d) => d.status === st);
          const hue = STATUS_HUE[st] ?? '#94A3B8';
          const val = items.reduce((s, d) => s + docTotals(d).total, 0);
          return (
            <div key={st} style={{ ['--sh']: hue } as CSSProperties} className={`dh-pp-col ${over === st ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (over !== st) setOver(st); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === st ? null : o)); }}
              onDrop={() => { if (drag) updateSalesDoc(drag, { status: st }); setDrag(null); setOver(null); }}>
              <div className="dh-pp-colhead"><span className="dh-pp-coldot" style={{ background: hue }} /><b>{st}</b><span className="dh-pp-colcount">{items.length}</span><span className="dh-pp-colval">{val ? money(val, true) : ''}</span></div>
              <div className="dh-pp-colbody">
                {items.map((d) => (
                  <div key={d.id} className={`dh-pp-card dh-cm-card ${drag === d.id ? 'dragging' : ''}`} draggable role="button" tabIndex={0} aria-label={`Open ${d.number}`}
                    onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(d.id); } }}>
                    <div className="dh-cm-card-top"><b className="mono">{d.number}</b><span className="dh-cm-card-total">{fmtPrice(docTotals(d).total, d.currency)}</span></div>
                    <div className="dh-cm-card-party">{d.party || '—'}</div>
                    {kind === 'invoice' && d.status !== 'Paid' && <div className="dh-cm-card-bal">Balance {fmtPrice(docBalance(d), d.currency)}</div>}
                  </div>
                ))}
                {!items.length && <div className="dh-pp-empty">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone = 'neutral' }: { icon: string; label: string; value: string; tone?: 'neutral' | 'accent' | 'green' | 'amber' | 'red' }) {
  return (
    <div className={`dh-pw-kpi tone-${tone}`}>
      <span className="dh-pw-kpi-icon"><Icon name={icon} size={15} /></span>
      <div className="dh-pw-kpi-body"><span className="dh-pw-kpi-value">{value}</span><span className="dh-pw-kpi-label">{label}</span></div>
    </div>
  );
}
