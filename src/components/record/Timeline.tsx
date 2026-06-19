import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Activity, Deal, ActivityType } from '@/types';
import { ACTIVITY_META, TYPE_ORDER } from '@/data/constants';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { initials } from '@/lib/format';
import './timeline.css';

const PROVIDERS: Record<string, { label: string; color: string }> = {
  meet: { label: 'Google Meet', color: '#10B981' },
  zoom: { label: 'Zoom', color: '#3B82F6' },
  teams: { label: 'Teams', color: '#6366F1' },
  phone: { label: 'Phone', color: '#8B5CF6' },
};

export function Timeline({ deal }: { deal: Deal }) {
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const acts = filter === 'all' ? deal.acts : deal.acts.filter((a) => a.type === filter);
  const counts: Partial<Record<ActivityType, number>> = {};
  deal.acts.forEach((a) => { counts[a.type] = (counts[a.type] ?? 0) + 1; });

  const pinned = acts.filter((a) => a.type === 'note' && a.pin);
  const upcoming = acts.filter((a) => a.type === 'task' && !a.done);
  const history = acts.filter((a) => !(a.type === 'note' && a.pin) && !(a.type === 'task' && !a.done));

  return (
    <>
      <div className="dh-feedtabs">
        <button className={`dh-feedtab ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          <Icon name="activity" size={12} /> All <b>{deal.acts.length}</b>
        </button>
        {TYPE_ORDER.filter((k) => counts[k]).map((k) => (
          <button key={k} className={`dh-feedtab ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)} style={filter === k ? { ['--fc' as string]: ACTIVITY_META[k].color } : undefined}>
            <Icon name={ACTIVITY_ICONS[k] ?? 'note'} size={12} /> {ACTIVITY_META[k].label} <b>{counts[k]}</b>
          </button>
        ))}
      </div>
      <div className="dh-timeline-list">
        {pinned.length > 0 && (
          <Group icon="star" color="var(--violet)" label={`Pinned · ${pinned.length}`}>
            {pinned.map((a) => <Card key={a.id} act={a} deal={deal} />)}
          </Group>
        )}
        {upcoming.length > 0 && (
          <Group icon="clock" color="var(--amber)" label={`Upcoming · ${upcoming.length}`}>
            {upcoming.map((a) => <Card key={a.id} act={a} deal={deal} />)}
          </Group>
        )}
        {history.length > 0 && (
          <Group icon="activity" color="var(--faint)" label="History">
            {history.map((a) => <Card key={a.id} act={a} deal={deal} />)}
          </Group>
        )}
        {!acts.length && <div className="dh-feed-empty">No {filter === 'all' ? 'activity' : ACTIVITY_META[filter].label.toLowerCase()} yet.</div>}
      </div>
    </>
  );
}

function Group({ icon, color, label, children }: { icon: string; color: string; label: string; children: React.ReactNode }) {
  return (
    <div className="dh-tl-group">
      <div className="dh-tl-group-h" style={{ color }}>
        <Icon name={icon} size={12} /> {label}
      </div>
      {children}
    </div>
  );
}

function Card({ act, deal }: { act: Activity; deal: Deal }) {
  const meta = ACTIVITY_META[act.type];
  const iconName = ACTIVITY_ICONS[act.type] ?? 'note';
  return (
    <div className="dh-tl-item">
      <div className="dh-tl-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
        <Icon name={iconName} size={14} />
      </div>
      <div className="dh-tl-content">
        <Body act={act} deal={deal} />
      </div>
    </div>
  );
}

function Body({ act, deal }: { act: Activity; deal: Deal }) {
  switch (act.type) {
    case 'email': return <EmailCard act={act} deal={deal} />;
    case 'meeting': return <MeetingCard act={act} />;
    case 'call': return <CallCard act={act} />;
    case 'whatsapp':
    case 'sms': return <ChatCard act={act} deal={deal} />;
    case 'marketing': return <SequenceCard act={act} />;
    case 'task': return <TaskCard act={act} deal={deal} />;
    case 'note': return <NoteCard act={act} deal={deal} />;
    case 'file': return <FileCard act={act} />;
    default: return <BasicCard act={act} />;
  }
}

function Meta({ who, w, label }: { who: string; w: string; label?: string }) {
  return (
    <div className="dh-tl-meta">
      <b>{who}</b>
      {label && <span className="dh-tl-label">{label}</span>}
      <span className="dh-tl-time">{w}</span>
    </div>
  );
}

function EmailCard({ act, deal }: { act: Activity; deal: Deal }) {
  const thread = act.thread?.length ? act.thread : [{ dir: act.dir ?? 'out', who: act.who, w: act.w, text: act.text ?? '' }];
  const stages = ['sent', 'delivered', 'opened'];
  const si = stages.indexOf(act.status ?? 'sent');
  return (
    <>
      <Meta who={act.who} w={act.w} label={thread.length > 1 ? 'Email thread' : 'Email'} />
      <div className="dh-em-card">
        <div className="dh-em-subj">{act.subj ?? '(no subject)'}</div>
        <div className="dh-em-stat">
          {stages.map((s, i) => (
            <span key={s} className={i <= si ? 'on' : ''}>
              {i === 2 && act.opens ? `Opened ${act.opens}×` : s[0].toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
        {act.attach && act.attach.length > 0 && (
          <div className="dh-em-att">
            {act.attach.map((n) => (
              <span key={n} className="dh-docchip"><Icon name="fileText" size={12} color="var(--red)" />{n}</span>
            ))}
          </div>
        )}
        <div className="dh-em-thread">
          {thread.map((m, i) => (
            <div key={i} className={`dh-em-msg ${m.dir}`}>
              <span className="dh-em-av">{initials(m.who)}</span>
              <div className="dh-em-b">
                <div className="dh-em-h"><b>{m.who}</b><span>{m.w}</span></div>
                <div className="dh-em-t">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <InlineReply act={act} deal={deal} kind="email" />
      </div>
    </>
  );
}

function InlineReply({ act, deal, kind }: { act: Activity; deal: Deal; kind: 'email' | 'whatsapp' | 'sms' }) {
  const reply = useStore((s) => s.replyToActivity);
  const openComposer = useStore((s) => s.openComposer);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const label = kind === 'email' ? 'email' : kind === 'whatsapp' ? 'WhatsApp' : 'SMS';

  const send = () => { if (!text.trim()) return; reply(deal.id, act.id, text.trim()); setText(''); setOpen(false); };
  const draft = () => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({ dealId: deal.id, kind, to: kind === 'email' ? email : '+1 (415) 555-0140', subject: kind === 'email' ? `Re: ${act.subj ?? deal.name}` : '', body: text.trim(), outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30' });
  };

  if (!open) {
    return (
      <div className="dh-tl-reply-bar">
        <button className="dh-tl-replybtn" onClick={() => setOpen(true)}><Icon name="mail" size={12} /> Reply</button>
        <button className="dh-tl-replybtn" onClick={draft}><Icon name="pencil" size={12} /> Draft</button>
      </div>
    );
  }
  return (
    <div className="dh-tl-reply">
      <textarea
        className="dh-tl-reply-input"
        placeholder={`Write a ${label} reply…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); if (e.key === 'Escape') setOpen(false); }}
        autoFocus
      />
      <div className="dh-tl-reply-actions">
        <span className="dh-tl-reply-hint">⌘↵ to send</span>
        <button className="dh-tl-replybtn" onClick={draft}><Icon name="pencil" size={12} /> Draft</button>
        <button className="dh-tl-replybtn primary" onClick={send} disabled={!text.trim()}><Icon name="send" size={12} /> Send</button>
      </div>
    </div>
  );
}

function MeetingCard({ act }: { act: Activity }) {
  const p = PROVIDERS[act.provider ?? 'meet'];
  return (
    <>
      <Meta who={act.who} w={act.w} label="Meeting" />
      <div className="dh-mtg-card">
        <div className="dh-mtg-top">
          <div className="dh-mtg-when">
            <b>{(act.when ?? 'Soon').split('·')[0]}</b>
            <span>{(act.when ?? '').split('·')[1] ?? ''} · {act.dur ?? '30'}m</span>
          </div>
          <div className="dh-mtg-main">
            <div className="dh-mtg-title">{act.subj ?? 'Meeting'}</div>
            <div className="dh-mtg-prov" style={{ color: p.color }}>
              <Icon name="calendar" size={12} /> {p.label}
            </div>
            {act.attendees && act.attendees.length > 0 && (
              <div className="dh-mtg-att">
                {act.attendees.map((n) => <span key={n} className="dh-em-av" title={n}>{initials(n)}</span>)}
              </div>
            )}
          </div>
        </div>
        {act.agenda && <div className="dh-mtg-agenda"><b>Agenda</b> {act.agenda}</div>}
        <div className="dh-mtg-actions">
          <span className="dh-joinbtn" style={{ ['--pc' as string]: p.color }}><Icon name="zap" size={13} /> Join {p.label}</span>
          <span className="dh-mtg-link">{act.link}</span>
        </div>
      </div>
    </>
  );
}

function CallCard({ act }: { act: Activity }) {
  const oc = act.outcome ?? 'Connected';
  const tone = oc === 'Connected' ? 'green' : oc === 'No answer' ? 'red' : 'amber';
  return (
    <>
      <Meta who={act.who} w={act.w} label="Call" />
      <div className="dh-call-line">
        <Badge tone={tone as 'green'}>{oc}</Badge>
        {act.dur && <span className="mono dh-call-dur">{act.dur} min</span>}
      </div>
      {act.text && <p className="dh-tl-text">{act.text}</p>}
    </>
  );
}

function ChatCard({ act, deal }: { act: Activity; deal: Deal }) {
  const thread = act.thread?.length ? act.thread : [{ dir: act.dir ?? 'out', who: act.who, w: act.w, text: act.text ?? '' }];
  const isWa = act.type === 'whatsapp';
  return (
    <>
      <Meta who={act.who} w={act.w} label={isWa ? 'WhatsApp' : 'SMS'} />
      <div className={`dh-chat-card ${isWa ? 'wa' : 'sms'}`}>
        <div className="dh-chat-to"><Icon name={isWa ? 'whatsapp' : 'sms'} size={12} color={isWa ? '#25D366' : '#0EA5E9'} /> {act.chan}</div>
        <div className="dh-chat-thread">
          {thread.map((m, i) => (
            <div key={i} className={`dh-chat-msg ${m.dir}`}>
              <div className="dh-chat-b">{m.text}<span className="dh-chat-tm">{m.w}{m.dir === 'out' ? (isWa ? ' ✓✓' : ' ✓') : ''}</span></div>
            </div>
          ))}
        </div>
        <InlineReply act={act} deal={deal} kind={isWa ? 'whatsapp' : 'sms'} />
      </div>
    </>
  );
}

function SequenceCard({ act }: { act: Activity }) {
  const seq = act.seq;
  const step = act.step ?? 1;
  return (
    <>
      <Meta who={act.who} w={act.w} label="Marketing" />
      <div className="dh-seq-card">
        <div className="dh-seq-h">
          <b>{act.subj ?? seq?.name ?? 'Sequence'}</b>
          {seq && <span className="dh-seq-prog">Step {step} of {seq.steps.length}</span>}
        </div>
        {seq && (
          <div className="dh-seq-track">
            {seq.steps.map((s, i) => (
              <div key={s} className={`dh-seq-step ${i < step ? 'done' : i === step - 1 ? 'now' : ''}`}>
                <span className="dh-seq-n">{i < step ? <Icon name="check" size={10} color="#fff" /> : i + 1}</span>{s}
              </div>
            ))}
          </div>
        )}
        {act.text && <p className="dh-tl-text">{act.text}</p>}
      </div>
    </>
  );
}

function TaskCard({ act, deal }: { act: Activity; deal: Deal }) {
  const toggleTask = useStore((s) => s.toggleTask);
  return (
    <>
      <Meta who={act.who} w={act.w} label="Task" />
      <div className={`dh-task-card ${act.done ? 'done' : ''}`}>
        <button className={`dh-tcheck ${act.done ? 'on' : ''}`} onClick={() => toggleTask(deal.id, act.id)} aria-label="Toggle task">
          {act.done && <Icon name="check" size={11} color="#fff" />}
        </button>
        <div className="dh-task-info">
          <div className="dh-task-t">{act.title ?? act.text}</div>
          <div className="dh-task-sub">
            <span className={`dh-prio ${act.prio ?? 'med'}`} style={{ marginTop: 0 }} />
            {act.ttype ?? 'todo'} · due {act.due ?? '—'}
          </div>
        </div>
      </div>
    </>
  );
}

function NoteCard({ act, deal }: { act: Activity; deal: Deal }) {
  const toggleReminder = useStore((s) => s.toggleReminder);
  const togglePinNote = useStore((s) => s.togglePinNote);
  const r = act.reminder;
  return (
    <>
      <div className="dh-tl-noterow">
        <Meta who={act.who} w={act.w} label={act.pin ? 'Pinned note' : 'Note'} />
        <button className={`dh-pin-btn ${act.pin ? 'on' : ''}`} onClick={() => togglePinNote(deal.id, act.id)} title={act.pin ? 'Unpin' : 'Pin to top'}>
          <Icon name="star" size={13} />
        </button>
      </div>
      <p className="dh-tl-text">{act.text}</p>
      {r && (
        <div className={`dh-rem-chip ${r.done ? 'done' : ''}`}>
          <button className={`dh-tcheck sm ${r.done ? 'on' : ''}`} onClick={() => toggleReminder(deal.id, act.id)} aria-label="Toggle reminder">
            {r.done && <Icon name="check" size={9} color="#fff" />}
          </button>
          <Icon name="clock" size={12} color="var(--amber)" /> <b>Reminder</b> · {r.title} <span className="dh-rem-due">due {r.due}</span>
        </div>
      )}
    </>
  );
}

function FileCard({ act }: { act: Activity }) {
  return (
    <>
      <Meta who={act.who} w={act.w} label="File" />
      {act.text && <p className="dh-tl-text">{act.text}</p>}
      {act.chan && <span className="dh-docchip"><Icon name="fileText" size={12} color="var(--cyan)" />{act.chan}</span>}
    </>
  );
}

function BasicCard({ act }: { act: Activity }) {
  return (
    <>
      <Meta who={act.who} w={act.w} label={ACTIVITY_META[act.type].label} />
      {act.text && <p className="dh-tl-text">{act.text}</p>}
      {act.chan && <span className="dh-tl-chan">{act.chan}</span>}
    </>
  );
}
