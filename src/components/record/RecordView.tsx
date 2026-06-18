import { useState } from 'react';
import { useStore, type ComposerKind } from '@/store/useStore';
import { STAGES, OWNERS, healthColor, healthBand, SEQUENCES, CATALOG } from '@/data/constants';
import type { StageKey } from '@/types';
import { money, staleDays } from '@/lib/format';
import { Avatar, Badge, Button, Ring, Popover, MenuItem } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction, riskFactors, dealSignals } from '@/lib/nova';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { Modal } from '@/components/ui/Modal';
import { assocFor, assetStatusColor, type DerivedAsset } from '@/lib/assoc';
import { Timeline } from './Timeline';
import './record.css';

const OWNER_OPTS = Object.values(OWNERS).map((o) => ({ value: o.key, label: o.name }));

const SECTION_META: Record<string, { label: string; icon: string }> = {
  nova: { label: 'Nova — deal intelligence', icon: 'sparkles' },
  pulse: { label: '360° View', icon: 'target' },
  properties: { label: 'Deal properties', icon: 'sliders' },
  coach: { label: 'Deal coach', icon: 'target' },
  signals: { label: 'Buying signals', icon: 'check' },
  account: { label: 'Account', icon: 'building' },
  group: { label: 'Buying group', icon: 'users' },
  lineitems: { label: 'Line items', icon: 'box' },
  quotes: { label: 'Quotes', icon: 'file' },
  contracts: { label: 'Contracts', icon: 'file' },
  invoices: { label: 'Invoices', icon: 'receipt' },
  attachments: { label: 'Attachments', icon: 'fileText' },
  tags: { label: 'Tags', icon: 'flag' },
};
const ALL_SECTIONS = Object.keys(SECTION_META);
const COL_NAMES: Record<string, string[]> = {
  standard: ['Main column', 'Side column'],
  tri: ['Left column', 'Center column', 'Right column'],
};

const STEPPER: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

function healthFactors(deal: { stage: StageKey; value: number; health: number; acts: { w: string }[]; contacts: { r: string; s: string }[] }) {
  const sd = staleDays(deal.acts?.[0]?.w);
  const si = STAGES.findIndex((s) => s.k === deal.stage);
  const champ = deal.contacts.some((c) => c.r === 'Economic buyer' || c.s === 'Strong');
  const eng = deal.acts.length;
  return [
    { label: 'Recency', tone: sd >= 14 ? 'bad' : sd >= 7 ? 'warn' : 'good', note: sd >= 14 ? `${sd}d quiet` : sd >= 7 ? `${sd}d ago` : 'active' },
    { label: 'Stage', tone: deal.stage === 'Lost' ? 'bad' : si >= 3 ? 'good' : 'warn', note: deal.stage },
    { label: 'Deal size', tone: deal.value >= 100000 ? 'good' : deal.value >= 25000 ? 'warn' : 'bad', note: money(deal.value, true) },
    { label: 'Engagement', tone: eng >= 8 ? 'good' : eng >= 4 ? 'warn' : 'bad', note: `${eng} touches` },
    { label: 'Champion', tone: champ ? 'good' : 'warn', note: champ ? 'identified' : 'unconfirmed' },
  ];
}

export function RecordView() {
  const dealId = useStore((s) => s.openDealId);
  const deal = useStore((s) => s.deals.find((d) => d.id === dealId));
  const openDeal = useStore((s) => s.openDeal);
  const view = useStore((s) => s.view);
  const requestStage = useStore((s) => s.requestStage);
  const updateDeal = useStore((s) => s.updateDeal);
  const logActivity = useStore((s) => s.logActivity);
  const openComposer = useStore((s) => s.openComposer);
  const openDocBuilder = useStore((s) => s.openDocBuilder);
  const sendDoc = useStore((s) => s.sendDoc);
  const addDealProduct = useStore((s) => s.addDealProduct);
  const removeDealProduct = useStore((s) => s.removeDealProduct);
  const enrollSequence = useStore((s) => s.enrollSequence);
  const askDealNova = useStore((s) => s.askDealNova);
  const clearDealNova = useStore((s) => s.clearDealNova);
  const novaThread = useStore((s) => (dealId ? s.dealNova[dealId] : undefined));
  const novaStreaming = useStore((s) => s.dealNovaStreaming === dealId);
  const recordLayout = useStore((s) => s.recordLayout);
  const setRecordLayout = useStore((s) => s.setRecordLayout);
  const recordCols = useStore((s) => s.recordCols);
  const recordHidden = useStore((s) => s.recordHidden);
  const recordEditing = useStore((s) => s.recordEditing);
  const setRecordEditing = useStore((s) => s.setRecordEditing);
  const moveRecordSection = useStore((s) => s.moveRecordSection);
  const nudgeRecordSection = useStore((s) => s.nudgeRecordSection);
  const toggleRecordSectionHidden = useStore((s) => s.toggleRecordSectionHidden);
  const resetRecordCols = useStore((s) => s.resetRecordCols);
  const companies = useStore((s) => s.objectRecords.company ?? []);
  const allDeals = useStore((s) => s.deals);
  const toast = useStore((s) => s.toast);
  const invoiceFromAsset = useStore((s) => s.invoiceFromAsset);
  const novaMin = useStore((s) => s.recordNovaMin);
  const setNovaMin = useStore((s) => s.setRecordNovaMin);
  const headMin = useStore((s) => s.recordHeadMin);
  const setHeadMin = useStore((s) => s.setRecordHeadMin);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState('');
  const [preview, setPreview] = useState<DerivedAsset | null>(null);

  if (!deal) return null;
  const companyRec = companies.find((c) => c.name === deal.company);
  const companyDeals = allDeals.filter((d) => d.company === deal.company && d.stage !== 'Won' && d.stage !== 'Lost');
  const companyWon = allDeals.filter((d) => d.company === deal.company && d.stage === 'Won').length;
  const hc = healthColor(deal.health);
  const stageIdx = STEPPER.indexOf(deal.stage);
  const risks = riskFactors(deal);
  const signals = dealSignals(deal);
  const factors = healthFactors(deal);

  const open = (kind: ComposerKind) => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({
      dealId: deal.id,
      kind,
      to: kind === 'email' ? email : '+1 (415) 555-0140',
      subject: kind === 'email' ? `${deal.name} — next steps` : '',
      body: '',
      outcome: 'Connected',
      due: 'Tomorrow',
      prio: 'med',
      dur: '30',
      title: kind === 'task' ? String(deal.next ?? 'Follow up') : kind === 'meeting' ? `Next steps — ${deal.name}` : '',
    });
  };

  const addNote = () => {
    if (!note.trim()) return;
    logActivity(deal.id, 'note', note.trim());
    setNote('');
    toast('Note added', 'success');
  };

  const assoc = assocFor(deal);
  const assetLabel = (a: DerivedAsset) => a.kind.charAt(0).toUpperCase() + a.kind.slice(1);
  // Send now: attach the file and log an outbound email on the timeline.
  const sendAsset = (a: DerivedAsset) => sendDoc(deal.id, a.file);
  // Draft / WhatsApp: open a compose window prefilled so it can be edited first.
  const draftAsset = (a: DerivedAsset, channel: 'email' | 'whatsapp') => {
    const c = deal.contacts[0];
    const first = c?.n.split(' ')[0] ?? 'there';
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({
      dealId: deal.id, kind: channel,
      to: channel === 'email' ? email : '+1 (415) 555-0140',
      subject: `${assetLabel(a)} — ${deal.name}`,
      body: `Hi ${first}, sharing the ${assetLabel(a).toLowerCase()} for ${deal.name}. Happy to walk through anything.`,
      attachments: channel === 'email' ? [a.file] : undefined,
      outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30',
    });
  };

  const AssetActions = ({ a }: { a: DerivedAsset }) => (
    <span className="dh-asset-acts">
      <button onClick={() => setPreview(a)} title="View / preview"><Icon name="eye" size={13} /> View</button>
      <button className="send" onClick={() => sendAsset(a)} title="Send now via email"><Icon name="send" size={13} /> Send</button>
      <button onClick={() => draftAsset(a, 'email')} title="Draft a cover email"><Icon name="mail" size={13} /> Draft</button>
      <button onClick={() => draftAsset(a, 'whatsapp')} title="Send via WhatsApp"><Icon name="whatsapp" size={13} /></button>
    </span>
  );
  const AssetRow = ({ a, color }: { a: DerivedAsset; color: string }) => (
    <div className="dh-asset-row">
      <span className="dh-asset-ic" style={{ color }}><Icon name={a.kind === 'invoice' ? 'receipt' : a.kind === 'contract' ? 'file' : 'fileText'} size={16} /></span>
      <div className="dh-asset-main">
        <div className="dh-asset-id">{a.id}</div>
        <div className="dh-asset-sub">{a.sub}</div>
      </div>
      <span className="dh-asset-badge" style={{ color: assetStatusColor(a.status), background: `color-mix(in srgb, ${assetStatusColor(a.status)} 14%, transparent)` }}>{a.status}</span>
      {a.kind === 'quote' && (
        <button className="dh-asset-mini" title="Create invoice from this quote" onClick={() => invoiceFromAsset(deal.id, a.total, a.id)}><Icon name="receipt" size={14} /></button>
      )}
      <AssetActions a={a} />
    </div>
  );

  const renderSection = (id: string) => {
    switch (id) {
      case 'nova':
        return (
          <section className={`dh-rec-card dh-nova-brief ${novaMin ? 'min' : ''}`} key="nova">
            <div className="dh-nova-brief-head">
              <span className="dh-nova-mark sm"><Icon name="sparkles" size={13} color="#fff" /></span>
              <div className="dh-nova-brief-titles">
                <b>Nova — deal intelligence</b>
                <small>{novaMin ? `${deal.summary.slice(0, 80)}…` : `Grounded in this deal · ${deal.acts.length} activities · ${deal.contacts.length} contacts`}</small>
              </div>
              {!novaMin && novaThread && novaThread.length > 0 && (
                <button className="dh-nova-clear" onClick={() => clearDealNova(deal.id)} title="Clear conversation"><Icon name="x" size={14} /></button>
              )}
              <button className="dh-nova-clear" onClick={() => setNovaMin(!novaMin)} title={novaMin ? 'Expand Nova' : 'Minimize Nova'} aria-label={novaMin ? 'Expand Nova' : 'Minimize Nova'}>
                <Icon name={novaMin ? 'expand' : 'minus'} size={14} />
              </button>
            </div>
            {!novaMin && (<>
              {!novaThread?.length && <p className="dh-nova-summary">{deal.summary}</p>}
              <div className="dh-nova-chips">
                {[
                  ['Summarize', `Summarize ${deal.company}`],
                  ['Risks', `What's at risk on ${deal.company}?`],
                  ['Draft follow-up', `Draft a follow-up for ${deal.company}`],
                  ['Buying group', `Who's in the buying group at ${deal.company}?`],
                  ['Next action', `What's my next best action on ${deal.company}?`],
                ].map(([label, prompt]) => (
                  <button key={label} className="dh-nova-actchip" onClick={() => askDealNova(deal.id, prompt)}>{label}</button>
                ))}
              </div>
              {novaThread && novaThread.length > 0 && (
                <div className="dh-nova-thread">
                  {novaThread.map((mm, i) => {
                    const isLast = i === novaThread.length - 1;
                    return (
                      <div key={i} className={`dh-nova-msg ${mm.role}`}>
                        <span className="dh-nova-who">{mm.role === 'nova' ? <Icon name="sparkles" size={13} /> : 'You'}</span>
                        <div className="dh-nova-bubble">{mm.text}{mm.role === 'nova' && isLast && novaStreaming && <span className="dh-nova-caret" />}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!novaThread?.length && (
                <div className="dh-nba"><Icon name="zap" size={14} /><div><span className="dh-nba-label">Recommended next step</span><span className="dh-nba-text">{nextBestAction(deal)}</span></div></div>
              )}
              {!novaThread?.length && risks.length > 0 && (
                <div className="dh-risks">{risks.map((r) => <Badge key={r} tone="red"><Icon name="alert" size={11} /> {r}</Badge>)}</div>
              )}
              <form className="dh-nova-askbox" onSubmit={(e) => { e.preventDefault(); const v = ask.trim(); if (v) { askDealNova(deal.id, v); setAsk(''); } }}>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={`Ask Nova anything about ${deal.company}…`} />
                <button type="submit" aria-label="Ask Nova" disabled={!ask.trim()}><Icon name="send" size={15} /></button>
              </form>
            </>)}
          </section>
        );
      case 'pulse':
        return (
          <section className="dh-rec-card dh-360" key="pulse">
            <div className="dh-360-head">
              <div className="dh-360-lead"><Icon name="target" size={15} /> 360° View</div>
              <div className="dh-360-sub">Every interaction, activity &amp; engagement signal on this deal</div>
            </div>
            <div className="dh-rec-metrics-row">
              {[
                ['Interactions', String(deal.acts.length)],
                ['Last touch', deal.acts[0]?.w ?? '—'],
                ['Contacts', String(deal.contacts.length)],
                ['Open tasks', String(deal.acts.filter((a) => a.type === 'task' && !a.done).length)],
              ].map(([l, v]) => (
                <div key={l} className="dh-rec-metric-tile"><span className="v mono">{v}</span><span className="l">{l}</span></div>
              ))}
            </div>
            <div className="dh-rec-actions">
              <button onClick={() => open('note')}><Icon name="note" size={16} /> Note</button>
              <button onClick={() => open('email')}><Icon name="mail" size={16} /> Email</button>
              <button onClick={() => open('call')}><Icon name="phone" size={16} /> Log call</button>
              <button onClick={() => open('meeting')}><Icon name="calendar" size={16} /> Meeting</button>
              <button onClick={() => open('whatsapp')}><Icon name="whatsapp" size={16} /> WhatsApp</button>
              <Popover align="start" trigger={({ toggle }) => <button onClick={toggle}><Icon name="megaphone" size={16} /> Marketing</button>}>
                {(close) => (<><div className="dh-menu-head">Enroll in sequence</div>{SEQUENCES.map((s) => <MenuItem key={s.k} icon={<Icon name="megaphone" size={15} />} onClick={() => { enrollSequence(deal.id, s.k); close(); }}>{s.name}</MenuItem>)}</>)}
              </Popover>
              <button onClick={() => open('task')}><Icon name="check" size={16} /> Task</button>
              <Popover align="start" trigger={({ toggle }) => <button onClick={toggle}><Icon name="file" size={16} /> File</button>}>
                {(close) => (<><div className="dh-menu-head">Add a document</div><MenuItem icon={<Icon name="receipt" size={15} />} onClick={() => { openDocBuilder(deal.id, 'quote'); close(); }}>Generate quote</MenuItem><MenuItem icon={<Icon name="receipt" size={15} />} onClick={() => { openDocBuilder(deal.id, 'invoice'); close(); }}>Generate invoice</MenuItem><MenuItem icon={<Icon name="paperclip" size={15} />} onClick={() => { open('email'); close(); }}>Attach &amp; email a file</MenuItem></>)}
              </Popover>
            </div>
            <div className="dh-note-box">
              <textarea className="dh-textarea" placeholder="Add a note, @mention a teammate, or log context…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote(); }} />
              <div className="dh-note-foot">
                <span className="dh-note-hint">⌘↵ to save</span>
                <Button variant="primary" size="sm" onClick={addNote} disabled={!note.trim()}>Add note</Button>
              </div>
            </div>
            <div className="dh-timeline"><Timeline deal={deal} /></div>
          </section>
        );
      case 'properties':
        return (
          <section className="dh-rec-card" key="properties">
            <h4 className="dh-rail-title"><Icon name="sliders" size={14} /> Deal properties</h4>
            <div className="dh-peek-rows" style={{ marginTop: 12 }}>
              <div><span className="pk">Stage</span><span className="pv"><InlineEdit value={deal.stage} display={deal.stage} options={STAGES.map((s) => ({ value: s.k, label: s.k }))} onCommit={(v) => requestStage(deal.id, v as StageKey)} /></span></div>
              <div><span className="pk">Amount</span><span className="pv mono"><InlineEdit value={deal.value} type="number" display={money(deal.value)} onCommit={(v) => updateDeal(deal.id, { value: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })} /></span></div>
              <div><span className="pk">Win</span><span className="pv mono" style={{ color: 'var(--violet)' }}>{deal.win}%</span></div>
              <div><span className="pk">Health</span><span className="pv" style={{ color: hc }}><InlineEdit value={deal.health} type="number" onCommit={(v) => updateDeal(deal.id, { health: Math.min(100, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0) })} /></span></div>
              <div><span className="pk">Close date</span><span className="pv"><InlineEdit value={deal.close} onCommit={(v) => updateDeal(deal.id, { close: v })} /></span></div>
              <div><span className="pk">Priority</span><span className="pv" style={{ textTransform: 'capitalize' }}><InlineEdit value={deal.priority} display={deal.priority} options={[{ value: 'high', label: 'High' }, { value: 'med', label: 'Medium' }, { value: 'low', label: 'Low' }]} onCommit={(v) => updateDeal(deal.id, { priority: v as typeof deal.priority })} /></span></div>
              <div><span className="pk">Owner</span><span className="pv"><Avatar ownerKey={deal.owner} size={18} /> <InlineEdit value={deal.owner} display={OWNERS[deal.owner]?.name} options={OWNER_OPTS} onCommit={(v) => updateDeal(deal.id, { owner: v })} /></span></div>
              <div><span className="pk">Industry</span><span className="pv"><InlineEdit value={deal.industry} onCommit={(v) => v.trim() && updateDeal(deal.id, { industry: v.trim() })} /></span></div>
            </div>
          </section>
        );
      case 'coach':
        return (
          <section className="dh-rec-card" key="coach">
            <h4 className="dh-rail-title">Deal coach</h4>
            <div className="dh-coach">
              {factors.map((f) => (
                <div key={f.label} className="dh-coach-row">
                  <span className={`dh-coach-dot t-${f.tone}`} />
                  <span className="dh-coach-label">{f.label}</span>
                  <span className="dh-coach-note">{f.note}</span>
                </div>
              ))}
            </div>
          </section>
        );
      case 'signals':
        return (
          <section className="dh-rec-card" key="signals">
            <h4 className="dh-rail-title">Buying signals</h4>
            <div className="dh-signals">
              {signals.map((s) => (
                <div key={s.label} className={`dh-signal ${s.ok ? 'ok' : 'no'}`}>
                  <Icon name={s.ok ? 'check' : 'x'} size={13} /> {s.label}
                </div>
              ))}
            </div>
          </section>
        );
      case 'account':
        return (
          <section className="dh-rec-card" key="account">
            <h4 className="dh-rail-title">Account</h4>
            <div className="dh-account">
              <span className="dh-account-av"><Icon name="building" size={18} /></span>
              <div>
                <b>{deal.company}</b>
                <small>{deal.industry}{companyRec?.employees ? ` · ${companyRec.employees} employees` : ''}</small>
              </div>
            </div>
            {companyRec?.domain ? <a className="dh-account-domain" href={`https://${String(companyRec.domain)}`} target="_blank" rel="noreferrer"><Icon name="arrowUpRight" size={12} /> {String(companyRec.domain)}</a> : null}
            <div className="dh-account-tiles">
              <div><span className="v mono">{companyDeals.length}</span><span className="l">Open deals</span></div>
              <div><span className="v mono">{money(companyDeals.reduce((s, d) => s + d.value, 0), true)}</span><span className="l">Pipeline</span></div>
              <div><span className="v mono">{companyWon}</span><span className="l">Won</span></div>
            </div>
          </section>
        );
      case 'group':
        return (
          <section className="dh-rec-card" key="group">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title">Buying group</h4>
              <AddContact dealId={deal.id} />
            </div>
            <div className="dh-contacts">
              {deal.contacts.map((c) => (
                <div key={c.n} className="dh-contact">
                  <Avatar name={c.n} size={30} />
                  <div className="dh-contact-text"><b>{c.n}</b><small>{c.t}</small></div>
                  <div className="dh-contact-meta">
                    <Badge tone={c.r === 'Economic buyer' ? 'violet' : c.r === 'Champion' ? 'green' : 'neutral'}>{c.r}</Badge>
                    <span className={`dh-signal-strength s-${c.s.toLowerCase()}`}>{c.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      case 'lineitems':
        return (
          <section className="dh-rec-card" key="lineitems">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title">Line items</h4>
              <Popover align="end" width={240} trigger={({ toggle }) => <button className="dh-rail-add" onClick={toggle}><Icon name="plus" size={13} /> Add</button>}>
                {(close) => (
                  <>
                    <div className="dh-menu-head">Add product</div>
                    {CATALOG.map((p) => (
                      <MenuItem key={p.n} onClick={() => { addDealProduct(deal.id, p); close(); }}>
                        <span style={{ flex: 1 }}>{p.n}</span><span className="mono" style={{ color: 'var(--faint)' }}>{money(p.v, true)}</span>
                      </MenuItem>
                    ))}
                  </>
                )}
              </Popover>
            </div>
            <div className="dh-lineitems">
              {deal.products.length === 0 && <div className="dh-lineitem" style={{ color: 'var(--faint)' }}>No products linked yet.</div>}
              {deal.products.map((p, i) => (
                <div key={p.n + i} className="dh-lineitem">
                  <span>{p.n}</span>
                  <span className="mono">{money(p.v)}</span>
                  <button className="dh-lineitem-rm" onClick={() => removeDealProduct(deal.id, i)} aria-label="Remove"><Icon name="x" size={12} /></button>
                </div>
              ))}
              {deal.products.length > 0 && (
                <div className="dh-lineitem total"><span>Total</span><span className="mono">{money(deal.products.reduce((s, p) => s + p.v, 0))}</span></div>
              )}
            </div>
          </section>
        );
      case 'quotes':
        return (
          <section className="dh-rec-card" key="quotes">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title"><Icon name="file" size={14} color="var(--violet)" /> Quotes</h4>
              <span className="dh-rail-count">{assoc.quotes.length}</span>
            </div>
            <div className="dh-asset-list">
              {assoc.quotes.map((q) => <AssetRow key={q.id} a={q} color="var(--violet)" />)}
            </div>
            <button className="dh-asset-add" onClick={() => openDocBuilder(deal.id, 'quote')}><Icon name="plus" size={13} /> New quote</button>
          </section>
        );
      case 'contracts':
        return (
          <section className="dh-rec-card" key="contracts">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title"><Icon name="file" size={14} color="var(--amber)" /> Contracts</h4>
              <span className="dh-rail-count">1</span>
            </div>
            <div className="dh-asset-list"><AssetRow a={assoc.contract} color="var(--amber)" /></div>
          </section>
        );
      case 'invoices':
        return (
          <section className="dh-rec-card" key="invoices">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title"><Icon name="receipt" size={14} color="var(--green)" /> Invoices</h4>
              <span className="dh-rail-count">{assoc.invoices.length}</span>
            </div>
            <div className="dh-asset-list">
              {assoc.invoices.length === 0 && <div className="dh-asset-empty">No invoices yet — create one below, or close the deal.</div>}
              {assoc.invoices.map((inv) => <AssetRow key={inv.id} a={inv} color="var(--green)" />)}
            </div>
            <button className="dh-asset-add" onClick={() => openDocBuilder(deal.id, 'invoice')}><Icon name="plus" size={13} /> New invoice</button>
          </section>
        );
      case 'attachments':
        return (
          <section className="dh-rec-card" key="attachments">
            <div className="dh-rail-titlerow">
              <h4 className="dh-rail-title"><Icon name="fileText" size={14} /> Attachments</h4>
              <span className="dh-rail-count">{assoc.files.length}</span>
            </div>
            <div className="dh-asset-list">
              {assoc.files.length === 0 && <div className="dh-asset-empty">No attachments yet.</div>}
              {assoc.files.map((f) => (
                <div key={f.n} className="dh-asset-row">
                  <span className="dh-asset-ic" style={{ color: f.k === 'pdf' ? 'var(--red)' : 'var(--blue)' }}><Icon name="fileText" size={16} /></span>
                  <div className="dh-asset-main"><div className="dh-asset-id">{f.n}</div><div className="dh-asset-sub">{(f.k || 'pdf').toUpperCase()}</div></div>
                  <span className="dh-asset-acts">
                    <button className="send" onClick={() => sendDoc(deal.id, f.n)} title="Send via email"><Icon name="send" size={13} /> Send</button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      case 'tags':
        return deal.tags.length > 0 ? (
          <section className="dh-rec-card" key="tags">
            <h4 className="dh-rail-title">Tags</h4>
            <div className="dh-card-tags" style={{ marginLeft: 0 }}>
              {deal.tags.map((t) => <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>)}
            </div>
          </section>
        ) : null;
      default:
        return null;
    }
  };

  const cols = recordCols[recordLayout];
  const placed = new Set(cols.flat());
  const hiddenList = ALL_SECTIONS.filter((k) => recordHidden.includes(k) || !placed.has(k));

  const editChrome = (key: string, ci: number) => {
    if (!recordEditing) return null;
    const meta = SECTION_META[key];
    return (
      <div className="dh-sec-edit">
        <span className="dh-sec-edit-grip"><Icon name="grip" size={13} /> {meta?.label ?? key}</span>
        <span className="dh-sec-edit-ctrls">
          <button onClick={() => nudgeRecordSection(key, 'up')} title="Move up"><Icon name="arrowUp" size={13} /></button>
          <button onClick={() => nudgeRecordSection(key, 'down')} title="Move down"><Icon name="chevronDown" size={13} /></button>
          <button onClick={() => nudgeRecordSection(key, 'left')} disabled={ci === 0} title="Move to previous column"><Icon name="arrowLeft" size={13} /></button>
          <button onClick={() => nudgeRecordSection(key, 'right')} disabled={ci === cols.length - 1} title="Move to next column"><Icon name="arrowRight" size={13} /></button>
          <button className="hide" onClick={() => { if (!recordHidden.includes(key)) toggleRecordSectionHidden(key); }} title="Hide section"><Icon name="x" size={14} /></button>
        </span>
      </div>
    );
  };

  const renderCol = (col: string[], ci: number) => (
    <div
      className={`dh-rec-col ${recordEditing ? 'editing' : ''}`}
      key={ci}
      onDragOver={recordEditing ? (e) => e.preventDefault() : undefined}
      onDrop={recordEditing ? (e) => { e.preventDefault(); const k = e.dataTransfer.getData('text/plain'); if (k) moveRecordSection(k, ci, col.length); } : undefined}
    >
      {recordEditing && <div className="dh-rec-col-name">{COL_NAMES[recordLayout]?.[ci] ?? `Column ${ci + 1}`}</div>}
      {col.filter((k) => !recordHidden.includes(k)).map((key, ri) => (
        <div
          key={key}
          className={`dh-rec-secwrap ${recordEditing ? 'editing' : ''}`}
          draggable={recordEditing}
          onDragStart={recordEditing ? (e) => { e.dataTransfer.setData('text/plain', key); e.dataTransfer.effectAllowed = 'move'; } : undefined}
          onDragOver={recordEditing ? (e) => e.preventDefault() : undefined}
          onDrop={recordEditing ? (e) => { e.preventDefault(); e.stopPropagation(); const k = e.dataTransfer.getData('text/plain'); if (k && k !== key) moveRecordSection(k, ci, ri); } : undefined}
        >
          {editChrome(key, ci)}
          {renderSection(key)}
        </div>
      ))}
      {recordEditing && col.filter((k) => !recordHidden.includes(k)).length === 0 && (
        <div className="dh-rec-col-empty">Drop a section here</div>
      )}
    </div>
  );

  return (
    <div className="dh-record">
      {/* Header */}
      <div className="dh-rec-head">
        <div className="dh-rec-headrow">
          <button className="dh-btn v-ghost s-sm" onClick={() => openDeal(null)}>
            <Icon name="arrowLeft" size={15} /> Back to {view === 'table' ? 'Table' : 'Board'}
          </button>
          <div className="dh-rec-head-tools">
            <div className="dh-rec-layout-switch">
              <button className={recordLayout === 'standard' ? 'on' : ''} onClick={() => setRecordLayout('standard')}><Icon name="list" size={13} /> Standard</button>
              <button className={recordLayout === 'tri' ? 'on' : ''} onClick={() => setRecordLayout('tri')}><Icon name="grid" size={13} /> 3-column</button>
            </div>
            <button className={`dh-btn ${recordEditing ? 'v-primary' : 'v-subtle'} s-sm`} onClick={() => setRecordEditing(!recordEditing)}>
              <Icon name={recordEditing ? 'check' : 'grid'} size={14} /> {recordEditing ? 'Done customizing' : 'Customize screen'}
            </button>
            <button className="dh-rec-headtog" onClick={() => setHeadMin(!headMin)} title={headMin ? 'Expand details' : 'Minimize details'} aria-label={headMin ? 'Expand details' : 'Minimize details'}>
              <Icon name={headMin ? 'expand' : 'minus'} size={15} />
            </button>
          </div>
        </div>

        {headMin ? (
          <div className="dh-rec-headmin">
            <span className={`dh-prio ${deal.priority}`} />
            <h1 className="dh-rec-headmin-title"><InlineEdit value={deal.name} onCommit={(v) => v.trim() && updateDeal(deal.id, { name: v.trim() })} /></h1>
            <span className="dh-rec-headmin-stats">
              <span className="dh-stage-pill" style={{ ['--pc' as string]: STAGES.find((s) => s.k === deal.stage)?.hue }}><span className="dot" /> {deal.stage}</span>
              <span className="s"><b className="mono">{money(deal.value, true)}</b></span>
              <span className="s"><i>Win</i> {deal.win}%</span>
              <span className="s"><i>Health</i> <b style={{ color: hc }}>{deal.health}</b></span>
              <span className="s"><Avatar ownerKey={deal.owner} size={18} /> {OWNERS[deal.owner]?.name}</span>
            </span>
          </div>
        ) : (
        <>
        <div className="dh-rec-headmain">
          <div className="dh-rec-title">
            <span className={`dh-prio ${deal.priority}`} />
            <div>
              <h1><InlineEdit value={deal.name} onCommit={(v) => v.trim() && updateDeal(deal.id, { name: v.trim() })} /></h1>
              <div className="dh-rec-sub">
                <Icon name="building" size={13} /> <InlineEdit value={deal.company} onCommit={(v) => v.trim() && updateDeal(deal.id, { company: v.trim() })} />
                <span className="dot-sep" />
                <InlineEdit value={deal.industry} onCommit={(v) => v.trim() && updateDeal(deal.id, { industry: v.trim() })} />
                <span className="dot-sep" />
                <span className="mono">{deal.id}</span>
              </div>
            </div>
          </div>

          <div className="dh-rec-metrics">
            <div className="dh-rec-metric">
              <span className="l">Value</span>
              <span className="v mono">
                <InlineEdit value={deal.value} type="number" display={money(deal.value)} onCommit={(v) => updateDeal(deal.id, { value: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })} />
              </span>
            </div>
            <div className="dh-rec-metric">
              <span className="l">Win</span>
              <span className="v mono">{deal.win}%</span>
            </div>
            <div className="dh-rec-metric">
              <span className="l">Health</span>
              <span className="dh-rec-health">
                <Ring value={deal.health} size={32} color={hc} label={String(deal.health)} />
                <b style={{ color: hc }}>{healthBand(deal.health)}</b>
              </span>
            </div>
            <div className="dh-rec-metric">
              <span className="l">Owner</span>
              <span className="dh-rec-owner">
                <Avatar ownerKey={deal.owner} size={24} />
                <InlineEdit value={deal.owner} display={OWNERS[deal.owner]?.name} options={OWNER_OPTS} onCommit={(v) => updateDeal(deal.id, { owner: v })} />
              </span>
            </div>
          </div>
        </div>

        {/* Stage stepper */}
        <div className="dh-stepper">
          {STEPPER.map((sk, i) => {
            const done = i < stageIdx;
            const cur = i === stageIdx;
            const hue = STAGES.find((s) => s.k === sk)?.hue;
            return (
              <button
                key={sk}
                className={`dh-step ${done ? 'done' : ''} ${cur ? 'cur' : ''}`}
                style={cur || done ? { ['--sc' as string]: hue } : undefined}
                onClick={() => requestStage(deal.id, sk)}
              >
                {done ? <Icon name="check" size={13} /> : <span className="dh-step-i">{i + 1}</span>}
                {sk}
              </button>
            );
          })}
          {stageIdx >= 0 && stageIdx < STEPPER.length - 1 && (
            <button className="dh-advance-btn" onClick={() => requestStage(deal.id, STEPPER[stageIdx + 1])}>
              <Icon name="arrowRight" size={14} /> Advance to {STEPPER[stageIdx + 1]}
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* Customize toolbar */}
      {recordEditing && (
        <div className="dh-rec-editbar">
          <div className="dh-rec-editbar-left">
            <Icon name="grid" size={15} />
            <b>Customize screen</b>
            <span>Drag cards between columns, reorder, hide, or switch layout.</span>
          </div>
          <div className="dh-rec-editbar-right">
            <div className="dh-rec-layout-switch">
              <button className={recordLayout === 'standard' ? 'on' : ''} onClick={() => setRecordLayout('standard')}><Icon name="list" size={13} /> 2-column</button>
              <button className={recordLayout === 'tri' ? 'on' : ''} onClick={() => setRecordLayout('tri')}><Icon name="grid" size={13} /> 3-column</button>
            </div>
            {hiddenList.length > 0 && (
              <Popover align="end" width={230} trigger={({ toggle }) => <button className="dh-btn v-subtle s-sm" onClick={toggle}><Icon name="plus" size={14} /> Add card ({hiddenList.length})</button>}>
                {(close) => (
                  <>
                    <div className="dh-menu-head">Hidden cards</div>
                    {hiddenList.map((k) => (
                      <MenuItem key={k} icon={<Icon name={SECTION_META[k]?.icon ?? 'box'} size={15} />} onClick={() => { if (recordHidden.includes(k)) toggleRecordSectionHidden(k); else moveRecordSection(k, cols.length - 1, 99); close(); }}>{SECTION_META[k]?.label ?? k}</MenuItem>
                    ))}
                  </>
                )}
              </Popover>
            )}
            <button className="dh-btn v-ghost s-sm" onClick={resetRecordCols}><Icon name="reset" size={14} /> Reset</button>
            <button className="dh-btn v-primary s-sm" onClick={() => setRecordEditing(false)}><Icon name="check" size={14} /> Done</button>
          </div>
        </div>
      )}

      {/* Body — column-driven customizable dashboard */}
      <div className={`dh-rec-body cols-${cols.length} ${recordEditing ? 'editing' : ''}`}>
        {cols.map((col, ci) => renderCol(col, ci))}
      </div>

      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          width={560}
          title={<><Icon name={preview.kind === 'invoice' ? 'receipt' : 'fileText'} size={16} /> {preview.file}</>}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
              <Button variant="primary" onClick={() => { sendAsset(preview); setPreview(null); }}><Icon name="send" size={14} /> Send via email</Button>
            </>
          }
        >
          <div className="dh-asset-preview">
            <div className="dh-asset-preview-head">
              <div>
                <div className="dh-asset-preview-kind">{assetLabel(preview)}</div>
                <h3>{preview.id}</h3>
                <div className="dh-asset-preview-sub">{deal.name} · {deal.company}</div>
              </div>
              <span className="dh-asset-badge" style={{ color: assetStatusColor(preview.status), background: `color-mix(in srgb, ${assetStatusColor(preview.status)} 14%, transparent)` }}>{preview.status}</span>
            </div>
            <table className="dh-asset-preview-tbl">
              <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {assoc.li.map((it) => (
                  <tr key={it.id}><td>{it.name}</td><td>{it.qty}</td><td className="mono">{money(it.unit, true)}</td><td className="mono" style={{ textAlign: 'right' }}>{money(it.total, true)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="dh-asset-preview-total"><span>Total</span><span className="mono">{money(preview.total)}</span></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddContact({ dealId }: { dealId: string }) {
  const addDealContact = useStore((s) => s.addDealContact);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Champion');
  return (
    <Popover align="end" width={230} trigger={({ toggle }) => <button className="dh-rail-add" onClick={toggle}><Icon name="plus" size={13} /> Add</button>}>
      {(close) => (
        <div style={{ padding: 8 }}>
          <div className="dh-menu-head">Add contact</div>
          <input className="dh-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
          <select className="dh-select" value={role} onChange={(e) => setRole(e.target.value)} style={{ marginBottom: 8 }}>
            {['Champion', 'Economic buyer', 'Influencer', 'User'].map((r) => <option key={r}>{r}</option>)}
          </select>
          <Button variant="primary" size="sm" style={{ width: '100%' }} disabled={!name.trim()} onClick={() => { addDealContact(dealId, { n: name.trim(), r: role, t: role, s: 'Medium' }); setName(''); close(); }}>Add to group</Button>
        </div>
      )}
    </Popover>
  );
}
