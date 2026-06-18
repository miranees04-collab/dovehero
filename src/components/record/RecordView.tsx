import { useState } from 'react';
import { useStore, type ComposerKind } from '@/store/useStore';
import { STAGES, OWNERS, healthColor, healthBand } from '@/data/constants';
import type { StageKey } from '@/types';
import { money, staleDays } from '@/lib/format';
import { Avatar, Badge, Button, Ring } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction, riskFactors, dealSignals } from '@/lib/nova';
import { Timeline } from './Timeline';
import './record.css';

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
  const logActivity = useStore((s) => s.logActivity);
  const openComposer = useStore((s) => s.openComposer);
  const openDocBuilder = useStore((s) => s.openDocBuilder);
  const sendNova = useStore((s) => s.sendNova);
  const recordLayout = useStore((s) => s.recordLayout);
  const setRecordLayout = useStore((s) => s.setRecordLayout);
  const toast = useStore((s) => s.toast);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState('');

  if (!deal) return null;
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

  return (
    <div className="dh-record">
      {/* Header */}
      <div className="dh-rec-head">
        <div className="dh-rec-headrow">
          <button className="dh-btn v-ghost s-sm" onClick={() => openDeal(null)}>
            <Icon name="arrowLeft" size={15} /> Back to {view === 'table' ? 'Table' : 'Board'}
          </button>
          <div className="dh-rec-layout-switch">
            <button className={recordLayout === 'standard' ? 'on' : ''} onClick={() => setRecordLayout('standard')}><Icon name="list" size={13} /> Standard</button>
            <button className={recordLayout === 'tri' ? 'on' : ''} onClick={() => setRecordLayout('tri')}><Icon name="grid" size={13} /> 3-column</button>
          </div>
        </div>

        <div className="dh-rec-headmain">
          <div className="dh-rec-title">
            <span className={`dh-prio ${deal.priority}`} />
            <div>
              <h1>{deal.name}</h1>
              <div className="dh-rec-sub">
                <Icon name="building" size={13} /> {deal.company}
                <span className="dot-sep" />
                {deal.industry}
                <span className="dot-sep" />
                <span className="mono">{deal.id}</span>
              </div>
            </div>
          </div>

          <div className="dh-rec-metrics">
            <div className="dh-rec-metric">
              <span className="l">Value</span>
              <span className="v mono">{money(deal.value)}</span>
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
                <Avatar ownerKey={deal.owner} size={24} /> {OWNERS[deal.owner]?.name}
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
        </div>
      </div>

      {/* Body */}
      <div className={`dh-rec-body layout-${recordLayout}`}>
        {/* Left rail (coach + signals) */}
        <aside className="dh-rec-railL">
          <section className="dh-rec-card">
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
          <section className="dh-rec-card">
            <h4 className="dh-rail-title">Buying signals</h4>
            <div className="dh-signals">
              {signals.map((s) => (
                <div key={s.label} className={`dh-signal ${s.ok ? 'ok' : 'no'}`}>
                  <Icon name={s.ok ? 'check' : 'x'} size={13} />
                  {s.label}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Main column */}
        <div className="dh-rec-main">
          {/* Nova deal intelligence */}
          <section className="dh-rec-card dh-nova-brief">
            <div className="dh-nova-brief-head">
              <span className="dh-nova-mark sm">
                <Icon name="sparkles" size={13} color="#fff" />
              </span>
              <div className="dh-nova-brief-titles">
                <b>Nova — deal intelligence</b>
                <small>Grounded in this deal · {deal.acts.length} activities · {deal.contacts.length} contacts</small>
              </div>
            </div>
            <p className="dh-nova-summary">{deal.summary}</p>
            <div className="dh-nova-chips">
              {[
                ['Summarize', `Summarize ${deal.company}`],
                ['Risks', `What's at risk on ${deal.company}?`],
                ['Draft follow-up', `Draft a follow-up for ${deal.company}`],
                ['Buying group', `Who's in the buying group at ${deal.company}?`],
                ['Next action', `What's my next best action on ${deal.company}?`],
              ].map(([label, prompt]) => (
                <button key={label} className="dh-nova-actchip" onClick={() => sendNova(prompt)}>{label}</button>
              ))}
            </div>
            <div className="dh-nba">
              <Icon name="zap" size={14} />
              <div>
                <span className="dh-nba-label">Recommended next step</span>
                <span className="dh-nba-text">{nextBestAction(deal)}</span>
              </div>
            </div>
            {risks.length > 0 && (
              <div className="dh-risks">
                {risks.map((r) => (
                  <Badge key={r} tone="red">
                    <Icon name="alert" size={11} /> {r}
                  </Badge>
                ))}
              </div>
            )}
            <form
              className="dh-nova-askbox"
              onSubmit={(e) => { e.preventDefault(); const v = ask.trim(); if (v) { sendNova(v); setAsk(''); } }}
            >
              <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={`Ask Nova anything about ${deal.company}…`} />
              <button type="submit" aria-label="Ask Nova" disabled={!ask.trim()}><Icon name="send" size={15} /></button>
            </form>
          </section>

          {/* 360 metrics */}
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

          {/* Quick actions */}
          <div className="dh-rec-actions">
            <button onClick={() => open('email')}><Icon name="mail" size={16} /> Email</button>
            <button onClick={() => open('call')}><Icon name="phone" size={16} /> Log call</button>
            <button onClick={() => open('meeting')}><Icon name="calendar" size={16} /> Meeting</button>
            <button onClick={() => open('task')}><Icon name="check" size={16} /> Task</button>
            <button onClick={() => open('whatsapp')}><Icon name="whatsapp" size={16} /> WhatsApp</button>
            <button onClick={() => open('sms')}><Icon name="sms" size={16} /> SMS</button>
          </div>

          {/* Note composer */}
          <div className="dh-note-box">
            <textarea
              className="dh-textarea"
              placeholder="Add a note, @mention a teammate, or log context…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote();
              }}
            />
            <div className="dh-note-foot">
              <span className="dh-note-hint">⌘↵ to save</span>
              <Button variant="primary" size="sm" onClick={addNote} disabled={!note.trim()}>
                Add note
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <section className="dh-timeline">
            <div className="dh-timeline-head">
              <h3>Activity</h3>
              <span className="dh-timeline-count">{deal.acts.length}</span>
            </div>
            <Timeline deal={deal} />
          </section>
        </div>

        {/* Right rail */}
        <aside className="dh-rec-railR">
          <section className="dh-rec-card">
            <h4 className="dh-rail-title">Account</h4>
            <div className="dh-account">
              <span className="dh-account-av"><Icon name="building" size={18} /></span>
              <div>
                <b>{deal.company}</b>
                <small>{deal.industry}</small>
              </div>
            </div>
          </section>

          <section className="dh-rec-card">
            <h4 className="dh-rail-title">Buying group</h4>
            <div className="dh-contacts">
              {deal.contacts.map((c) => (
                <div key={c.n} className="dh-contact">
                  <Avatar name={c.n} size={30} />
                  <div className="dh-contact-text">
                    <b>{c.n}</b>
                    <small>{c.t}</small>
                  </div>
                  <div className="dh-contact-meta">
                    <Badge tone={c.r === 'Economic buyer' ? 'violet' : c.r === 'Champion' ? 'green' : 'neutral'}>{c.r}</Badge>
                    <span className={`dh-signal-strength s-${c.s.toLowerCase()}`}>{c.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {deal.products.length > 0 && (
            <section className="dh-rec-card">
              <h4 className="dh-rail-title">Line items</h4>
              <div className="dh-lineitems">
                {deal.products.map((p) => (
                  <div key={p.n} className="dh-lineitem">
                    <span>{p.n}</span>
                    <span className="mono">{money(p.v)}</span>
                  </div>
                ))}
                <div className="dh-lineitem total">
                  <span>Total</span>
                  <span className="mono">{money(deal.products.reduce((s, p) => s + p.v, 0))}</span>
                </div>
              </div>
            </section>
          )}

          <section className="dh-rec-card">
            <h4 className="dh-rail-title">Documents</h4>
            <div className="dh-docs">
              {deal.docs.map((d) => (
                <button key={d.n} className="dh-doc" onClick={() => toast(`Opening ${d.n}…`)}>
                  <Icon name="fileText" size={15} />
                  <span>{d.n}</span>
                  <Icon name="arrowUpRight" size={13} />
                </button>
              ))}
            </div>
            <div className="dh-doc-actions">
              <button className="dh-doc-gen" onClick={() => openDocBuilder(deal.id, 'quote')}><Icon name="receipt" size={14} /> New quote</button>
              <button className="dh-doc-gen" onClick={() => openDocBuilder(deal.id, 'invoice')}><Icon name="receipt" size={14} /> New invoice</button>
            </div>
          </section>

          {deal.tags.length > 0 && (
            <section className="dh-rec-card">
              <h4 className="dh-rail-title">Tags</h4>
              <div className="dh-card-tags" style={{ marginLeft: 0 }}>
                {deal.tags.map((t) => (
                  <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
