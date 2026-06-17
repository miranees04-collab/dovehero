import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { STAGES, OWNERS, healthColor, healthBand, ACTIVITY_META } from '@/data/constants';
import type { StageKey, Activity } from '@/types';
import { money } from '@/lib/format';
import { Avatar, Badge, Button, Ring } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { ACTIVITY_ICONS } from '@/components/ui/Icon';
import { nextBestAction, riskFactors, dealSignals } from '@/lib/nova';
import './record.css';

const STEPPER: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

export function RecordView() {
  const dealId = useStore((s) => s.openDealId);
  const deal = useStore((s) => s.deals.find((d) => d.id === dealId));
  const openDeal = useStore((s) => s.openDeal);
  const view = useStore((s) => s.view);
  const moveDeal = useStore((s) => s.moveDeal);
  const logActivity = useStore((s) => s.logActivity);
  const toggleTask = useStore((s) => s.toggleTask);
  const openComposer = useStore((s) => s.openComposer);
  const sendNova = useStore((s) => s.sendNova);
  const toast = useStore((s) => s.toast);
  const [note, setNote] = useState('');

  if (!deal) return null;
  const hc = healthColor(deal.health);
  const stageIdx = STEPPER.indexOf(deal.stage);
  const risks = riskFactors(deal);
  const signals = dealSignals(deal);

  const compose = (channel: 'email' | 'whatsapp' | 'sms') => {
    const c = deal.contacts[0];
    openComposer({
      dealId: deal.id,
      channel,
      to: channel === 'email' ? `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com` : '+1 (415) 555-0140',
      subject: channel === 'email' ? `${deal.name} — next steps` : '',
      body: '',
    });
  };

  const quickLog = (type: 'call' | 'meeting' | 'note', text: string) => {
    logActivity(deal.id, type, text);
    toast(`${ACTIVITY_META[type].label} logged`, 'success');
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
        <button className="dh-btn v-ghost s-sm" onClick={() => openDeal(null)}>
          <Icon name="arrowLeft" size={15} /> Back to {view === 'table' ? 'Table' : 'Board'}
        </button>

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
                onClick={() => {
                  moveDeal(deal.id, sk);
                  toast(`Moved to ${sk}`, sk === 'Won' ? 'success' : 'default');
                }}
              >
                {done ? <Icon name="check" size={13} /> : <span className="dh-step-i">{i + 1}</span>}
                {sk}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="dh-rec-body">
        {/* Main column */}
        <div className="dh-rec-main">
          {/* Nova brief */}
          <section className="dh-rec-card dh-nova-brief">
            <div className="dh-nova-brief-head">
              <span className="dh-nova-mark sm">
                <Icon name="sparkles" size={13} color="#fff" />
              </span>
              <b>Nova brief</b>
              <Button variant="ghost" size="sm" onClick={() => sendNova(`Tell me about ${deal.company}`)}>
                Ask about this deal
              </Button>
            </div>
            <p className="dh-nova-summary">{deal.summary}</p>
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
          </section>

          {/* Quick actions */}
          <div className="dh-rec-actions">
            <button onClick={() => compose('email')}>
              <Icon name="mail" size={16} /> Email
            </button>
            <button onClick={() => quickLog('call', 'Logged a call.')}>
              <Icon name="phone" size={16} /> Log call
            </button>
            <button onClick={() => quickLog('meeting', 'Booked a meeting.')}>
              <Icon name="calendar" size={16} /> Meeting
            </button>
            <button onClick={() => compose('whatsapp')}>
              <Icon name="whatsapp" size={16} /> WhatsApp
            </button>
            <button onClick={() => compose('sms')}>
              <Icon name="sms" size={16} /> SMS
            </button>
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
            <div className="dh-timeline-list">
              {deal.acts.map((a) => (
                <TimelineItem key={a.id} act={a} dealId={deal.id} onToggleTask={toggleTask} />
              ))}
            </div>
          </section>
        </div>

        {/* Side rail */}
        <aside className="dh-rec-rail">
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

          {deal.docs.length > 0 && (
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
            </section>
          )}

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

function TimelineItem({
  act,
  dealId,
  onToggleTask,
}: {
  act: Activity;
  dealId: string;
  onToggleTask: (dealId: string, actId: string) => void;
}) {
  const meta = ACTIVITY_META[act.type];
  const iconName = ACTIVITY_ICONS[act.type] ?? 'note';
  return (
    <div className="dh-tl-item">
      <div className="dh-tl-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
        <Icon name={iconName} size={14} />
      </div>
      <div className="dh-tl-content">
        <div className="dh-tl-meta">
          <b>{act.who}</b>
          {act.subj && <span className="dh-tl-subj">{act.subj}</span>}
          {act.dir && <Badge tone={act.dir === 'in' ? 'blue' : 'neutral'}>{act.dir === 'in' ? 'Received' : 'Sent'}</Badge>}
          <span className="dh-tl-time">{act.w}</span>
        </div>
        {act.type === 'task' ? (
          <label className="dh-tl-task">
            <input type="checkbox" checked={!!act.done} onChange={() => onToggleTask(dealId, act.id)} />
            <span className={act.done ? 'done' : ''}>{act.title ?? act.text}</span>
          </label>
        ) : (
          act.text && <p className="dh-tl-text">{act.text}</p>
        )}
        {act.chan && <span className="dh-tl-chan">{act.chan}</span>}
      </div>
    </div>
  );
}
