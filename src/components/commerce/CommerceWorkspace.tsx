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
  price as fmtPrice,
} from '@/data/products';
import { DocBuilder } from '@/components/products/DocBuilder';
import '@/components/products/products.css';
import './commerce.css';

type Tab = 'overview' | SalesDocKind;

export function CommerceWorkspace() {
  const docs = useStore((s) => s.salesDocs);
  const createSalesDoc = useStore((s) => s.createSalesDoc);
  const [tab, setTab] = useState<Tab>('overview');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [q, setQ] = useState('');
  const [docId, setDocId] = useState<string | null>(null);

  const by = (k: SalesDocKind) => docs.filter((d) => d.kind === k);
  const sum = (list: SalesDoc[]) => list.reduce((s, d) => s + docTotals(d).total, 0);
  const invoices = by('invoice');
  const liveInv = invoices.filter((d) => d.status !== 'Void');

  const kpis = {
    quotesOpen: sum(by('quote').filter((d) => d.status === 'Draft' || d.status === 'Sent')),
    orders: sum(by('order').filter((d) => d.status === 'Open' || d.status === 'Fulfilled')),
    invoiced: sum(liveInv),
    collected: invoices.reduce((s, d) => s + (d.paid || 0), 0),
    outstanding: invoices.filter((d) => ['Open', 'Overdue'].includes(d.status)).reduce((s, d) => s + docBalance(d), 0),
    overdue: invoices.filter((d) => d.status === 'Overdue').reduce((s, d) => s + docBalance(d), 0),
  };

  const newDoc = (kind: SalesDocKind) => setDocId(createSalesDoc(kind));

  return (
    <div className="dh-pw dh-cm">
      <div className="dh-pw-head">
        <div className="dh-pw-head-main">
          <div className="dh-pw-head-title">
            <span className="dh-pw-head-icon"><Icon name="receipt" size={19} /></span>
            <div>
              <h1>Commerce</h1>
              <p>Quotes, orders &amp; invoices — line-item linked to your products, with billing &amp; pipelines.</p>
            </div>
          </div>
          <div className="dh-pw-head-actions">
            <Popover align="end"
              trigger={({ toggle }) => <button className="dh-btn v-primary s-sm" onClick={toggle}><Icon name="plus" size={15} /> New document <Icon name="chevronDown" size={13} /></button>}>
              {(close) => (
                <div className="dh-pw-sortmenu">
                  {DOC_KIND_ORDER.map((k) => (
                    <MenuItem key={k} icon={<Icon name={DOC_META[k].icon} size={14} />} onClick={() => { newDoc(k); close(); }}>{DOC_META[k].label}</MenuItem>
                  ))}
                </div>
              )}
            </Popover>
          </div>
        </div>

        <div className="dh-pw-kpis dh-cm-kpis">
          <Kpi icon="fileText" label="Open quotes" value={money(kpis.quotesOpen, true)} tone="accent" />
          <Kpi icon="boxes" label="Orders" value={money(kpis.orders, true)} tone="green" />
          <Kpi icon="receipt" label="Invoiced" value={money(kpis.invoiced, true)} />
          <Kpi icon="dollar" label="Collected" value={money(kpis.collected, true)} tone="green" />
          <Kpi icon="clock" label="Outstanding" value={money(kpis.outstanding, true)} tone="amber" />
          <Kpi icon="alert" label="Overdue" value={money(kpis.overdue, true)} tone={kpis.overdue ? 'red' : 'neutral'} />
        </div>
      </div>

      {/* Tabs */}
      <div className="dh-pw-types dh-cm-tabs">
        <button className={`dh-pw-type ${tab === 'overview' ? 'on' : ''}`} onClick={() => setTab('overview')}><Icon name="activity" size={14} /> Overview</button>
        {DOC_KIND_ORDER.map((k) => (
          <button key={k} className={`dh-pw-type ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)} style={tab === k ? { borderColor: DOC_META[k].hue, color: DOC_META[k].hue } : undefined}>
            <Icon name={DOC_META[k].icon} size={14} /> {DOC_META[k].plural}
            <span className="dh-pw-type-count">{by(k).length}</span>
          </button>
        ))}
      </div>

      {tab === 'overview'
        ? <Overview docs={docs} kpis={kpis} onOpen={setDocId} onTab={setTab} />
        : <KindView kind={tab} docs={by(tab)} q={q} setQ={setQ} view={view} setView={setView} onOpen={setDocId} onNew={() => newDoc(tab)} />}

      {docId && <DocBuilder id={docId} onClose={() => setDocId(null)} />}
    </div>
  );
}

/* ---------------- Overview / billing dashboard ---------------- */
function Overview({ docs, kpis, onOpen, onTab }: {
  docs: SalesDoc[]; kpis: { invoiced: number; collected: number; outstanding: number; overdue: number };
  onOpen: (id: string) => void; onTab: (t: Tab) => void;
}) {
  const invoices = docs.filter((d) => d.kind === 'invoice' && d.status !== 'Void');
  const bill = {
    Paid: invoices.filter((d) => d.status === 'Paid').reduce((s, d) => s + docTotals(d).total, 0),
    Open: invoices.filter((d) => d.status === 'Open').reduce((s, d) => s + docBalance(d), 0),
    Overdue: invoices.filter((d) => d.status === 'Overdue').reduce((s, d) => s + docBalance(d), 0),
  };
  const billMax = Math.max(1, bill.Paid + bill.Open + bill.Overdue);
  const recent = [...docs].slice(0, 7);
  const collectRate = kpis.invoiced ? Math.round((kpis.collected / kpis.invoiced) * 100) : 0;

  return (
    <div className="dh-pw-scroll dh-cm-overview">
      <div className="dh-cm-panels">
        <section className="dh-cm-panel">
          <div className="dh-cm-panel-head"><b>Billing</b><span>{collectRate}% collected</span></div>
          <div className="dh-cm-billbars">
            {([['Paid', 'green'], ['Open', 'amber'], ['Overdue', 'red']] as const).map(([k, tone]) => (
              <div key={k} className="dh-cm-billbar" onClick={() => onTab('invoice')}>
                <span className="dh-cm-billbar-label"><i className={`dot ${tone}`} /> {k}</span>
                <div className="dh-cm-billbar-track"><div className={`dh-cm-billbar-fill ${tone}`} style={{ width: `${(bill[k] / billMax) * 100}%` }} /></div>
                <span className="dh-cm-billbar-val mono">{fmtPrice(bill[k])}</span>
              </div>
            ))}
          </div>
          <div className="dh-cm-billfoot">
            <div><span>Invoiced</span><b>{fmtPrice(kpis.invoiced)}</b></div>
            <div><span>Collected</span><b className="g">{fmtPrice(kpis.collected)}</b></div>
            <div><span>Outstanding</span><b className="a">{fmtPrice(kpis.outstanding)}</b></div>
          </div>
        </section>

        <section className="dh-cm-panel">
          <div className="dh-cm-panel-head"><b>Recent documents</b></div>
          <div className="dh-cm-recent">
            {recent.map((d) => {
              const meta = DOC_META[d.kind];
              return (
                <button key={d.id} className="dh-pr-docrow" onClick={() => onOpen(d.id)}>
                  <span className="dh-pr-docrow-ico" style={{ background: meta.hue + '18', color: meta.hue }}><Icon name={meta.icon} size={14} /></span>
                  <div className="dh-pr-docrow-main">
                    <b>{d.number} <span className="dh-pw-dim">· {d.party || '—'}</span></b>
                    <small>{meta.label} · {d.updatedW} ago</small>
                  </div>
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

/* ---------------- One kind: list or status board ---------------- */
function KindView({ kind, docs, q, setQ, view, setView, onOpen, onNew }: {
  kind: SalesDocKind; docs: SalesDoc[]; q: string; setQ: (v: string) => void;
  view: 'list' | 'board'; setView: (v: 'list' | 'board') => void; onOpen: (id: string) => void; onNew: () => void;
}) {
  const meta = DOC_META[kind];
  const query = q.trim().toLowerCase();
  const list = query ? docs.filter((d) => (d.number + ' ' + d.party).toLowerCase().includes(query)) : docs;

  return (
    <>
      <div className="dh-pw-toolbar">
        <div className="dh-pw-search">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${meta.plural.toLowerCase()}…`} />
          {q && <button className="dh-pw-clear" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
        </div>
        <div className="dh-pw-viewtoggle">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><Icon name="list" size={15} /> List</button>
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><Icon name="grid" size={15} /> Board</button>
        </div>
        <span className="dh-pw-resultcount">{list.length} {meta.plural.toLowerCase()}</span>
        <Button variant="primary" size="sm" onClick={onNew}><Icon name="plus" size={15} /> New {meta.label.toLowerCase()}</Button>
      </div>

      {view === 'board'
        ? <StatusBoard kind={kind} docs={list} onOpen={onOpen} />
        : <DocTable kind={kind} docs={list} onOpen={onOpen} />}
    </>
  );
}

function DocTable({ kind, docs, onOpen }: { kind: SalesDocKind; docs: SalesDoc[]; onOpen: (id: string) => void }) {
  const meta = DOC_META[kind];
  return (
    <div className="dh-pw-scroll">
      <table className="dh-pw-table">
        <thead>
          <tr>
            <th>Number</th><th>{meta.partyLabel}</th><th>Status</th>
            <th className="col-num">Items</th><th className="col-num">Total</th>
            {kind === 'invoice' && <th className="col-num">Balance</th>}
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} tabIndex={0} role="button" aria-label={`Open ${d.number}`}
              onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(d.id); } }}>
              <td><b className="mono">{d.number}</b></td>
              <td>{d.party || <span className="dh-pw-dim">—</span>}</td>
              <td><Badge tone={docStatusTone(d.kind, d.status)}>{d.status}</Badge></td>
              <td className="col-num">{d.lines.length}</td>
              <td className="col-num"><b>{fmtPrice(docTotals(d).total, d.currency)}</b></td>
              {kind === 'invoice' && <td className="col-num">{d.status === 'Paid' ? <span className="dh-pw-dim">—</span> : fmtPrice(docBalance(d), d.currency)}</td>}
              <td><span className="dh-pw-dim">{d.updatedW} ago</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!docs.length && (
        <div className="dh-pw-empty">
          <span className="dh-pw-empty-icon"><Icon name={meta.icon} size={26} /></span>
          <b>No {meta.plural.toLowerCase()} yet</b>
          <span>Create one from here or from any product.</span>
        </div>
      )}
    </div>
  );
}

function StatusBoard({ kind, docs, onOpen }: { kind: SalesDocKind; docs: SalesDoc[]; onOpen: (id: string) => void }) {
  const meta = DOC_META[kind];
  const updateSalesDoc = useStore((s) => s.updateSalesDoc);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const STATUS_HUE: Record<string, string> = {
    Draft: '#94A3B8', Sent: '#F59E0B', Accepted: '#10B981', Expired: '#EF4444',
    Open: '#F59E0B', Fulfilled: '#10B981', Invoiced: '#6366F1', Cancelled: '#EF4444',
    Paid: '#10B981', Overdue: '#EF4444', Void: '#94A3B8', Ordered: '#F59E0B', Received: '#10B981',
  };

  return (
    <div className="dh-pw-scroll">
      <div className="dh-pp">
        {meta.statuses.map((st) => {
          const items = docs.filter((d) => d.status === st);
          const hue = STATUS_HUE[st] ?? '#94A3B8';
          const val = items.reduce((s, d) => s + docTotals(d).total, 0);
          return (
            <div key={st} style={{ ['--sh']: hue } as CSSProperties}
              className={`dh-pp-col ${over === st ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (over !== st) setOver(st); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === st ? null : o)); }}
              onDrop={() => { if (drag) updateSalesDoc(drag, { status: st }); setDrag(null); setOver(null); }}>
              <div className="dh-pp-colhead">
                <span className="dh-pp-coldot" style={{ background: hue }} />
                <b>{st}</b>
                <span className="dh-pp-colcount">{items.length}</span>
                <span className="dh-pp-colval">{val ? money(val, true) : ''}</span>
              </div>
              <div className="dh-pp-colbody">
                {items.map((d) => (
                  <div key={d.id} className={`dh-pp-card dh-cm-card ${drag === d.id ? 'dragging' : ''}`} draggable role="button" tabIndex={0}
                    aria-label={`Open ${d.number}`}
                    onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                    onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(d.id); } }}>
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

/* ---------------- KPI tile (local copy of the product one) ---------------- */
function Kpi({ icon, label, value, tone = 'neutral' }: { icon: string; label: string; value: string; tone?: 'neutral' | 'accent' | 'green' | 'amber' | 'red' }) {
  return (
    <div className={`dh-pw-kpi tone-${tone}`}>
      <span className="dh-pw-kpi-icon"><Icon name={icon} size={15} /></span>
      <div className="dh-pw-kpi-body">
        <span className="dh-pw-kpi-value">{value}</span>
        <span className="dh-pw-kpi-label">{label}</span>
      </div>
    </div>
  );
}
