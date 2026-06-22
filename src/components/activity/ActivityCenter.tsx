import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Activity, Deal } from '@/types';
import { ACTIVITY_META, TYPE_ORDER, hueOf } from '@/data/constants';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { ageHours, inRange, DATE_RANGES, type DateRange } from '@/lib/format';
import { isInbound } from '@/lib/comms';
import './activity.css';

type Row = { a: Activity; d: Deal };
const COMM_TYPES = ['email', 'whatsapp', 'sms', 'call'];

function summary(a: Activity): string {
  if (a.type === 'email') return a.subj ?? a.thread?.[a.thread.length - 1]?.text ?? 'Email';
  if (a.type === 'meeting') return a.subj ?? 'Meeting';
  if (a.type === 'call') return `Call · ${a.outcome ?? 'Connected'}`;
  if (a.type === 'task') return (a.title ?? a.text ?? 'Task') + (a.done ? ' · done' : '');
  if (a.type === 'marketing') return a.subj ?? a.seq?.name ?? 'Sequence';
  if (a.type === 'whatsapp' || a.type === 'sms') return a.thread?.[a.thread.length - 1]?.text ?? a.text ?? 'Message';
  return a.text ?? 'Activity';
}

function actText(a: Activity, company: string, name: string): string {
  const parts = [a.text, a.subj, a.chan, a.title, a.who, a.outcome, a.agenda, company, name];
  if (a.thread) a.thread.forEach((m) => { parts.push(m.text); parts.push(m.who); });
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function ActivityCenter() {
  const deals = useStore((s) => s.deals);
  const openDeal = useStore((s) => s.openDeal);
  const openCommPanel = useStore((s) => s.openCommPanel);
  const [filter, setFilter] = useState<string>('all');
  const [range, setRange] = useState<DateRange>('all');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const all: Row[] = [];
  deals.forEach((d) => d.acts.forEach((a) => all.push({ a, d })));
  const q = search.trim().toLowerCase();
  // Counts reflect the active date range so the chips/tiles stay truthful.
  const inScope = all.filter((x) => inRange(x.a.w, range));
  const counts: Record<string, number> = {};
  inScope.forEach((x) => { counts[x.a.type] = (counts[x.a.type] ?? 0) + 1; });
  const chrono = inScope.slice().sort((x, y) => ageHours(x.a.w) - ageHours(y.a.w));
  const dealsWithActivity = new Set(inScope.map((x) => x.d.id)).size;
  const openTasks = inScope.filter((x) => x.a.type === 'task' && !x.a.done).length;
  const unreadTotal = inScope.filter((x) => isInbound(x.a)).length;
  const shown = chrono
    .filter((x) => filter === 'all' || x.a.type === filter)
    .filter((x) => !unreadOnly || isInbound(x.a))
    .filter((x) => !q || actText(x.a, x.d.company, x.d.name).includes(q));

  const TILES: [string, number, string][] = [
    ['Interactions', inScope.length, 'all'],
    ['Comments', counts.note ?? 0, 'note'],
    ['Emails', counts.email ?? 0, 'email'],
    ['Meetings', counts.meeting ?? 0, 'meeting'],
    ['Open tasks', openTasks, 'task'],
  ];

  return (
    <div className="dh-actcenter">
      <div className="dh-ac-head">
        <div className="dh-ac-title"><Icon name="target" size={18} color="var(--violet)" /> 360° activity</div>
        <div className="dh-ac-sub">Every note, call, email, meeting, task &amp; message across <b>{dealsWithActivity}</b> deals · <b>{inScope.length}</b> interactions</div>
      </div>

      <div className="dh-ac-tiles">
        {TILES.map(([l, v, f]) => (
          <button key={l} className={`dh-ac-tile ${filter === f ? 'on' : ''}`} onClick={() => { setFilter(f); }} title={`Show ${l.toLowerCase()}`}>
            <span className="v mono">{v}</span><span className="l">{l}</span>
          </button>
        ))}
      </div>

      <div className="dh-ac-controls">
        <div className="dh-feed-search">
          <Icon name="search" size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all activity, messages, deals…" aria-label="Search activity" />
          {search && <button className="dh-feed-search-x" onClick={() => setSearch('')} aria-label="Clear"><Icon name="x" size={13} /></button>}
        </div>
        <button className={`dh-ac-unread ${unreadOnly ? 'on' : ''}`} onClick={() => setUnreadOnly((v) => !v)} title="Show only inbound client replies">
          <Icon name="chat" size={14} /> Unread <b>{unreadTotal}</b>
        </button>
        <div className="dh-ac-range">
          {DATE_RANGES.map((r) => (
            <button key={r.k} className={range === r.k ? 'on' : ''} onClick={() => setRange(r.k)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="dh-ac-chips">
        <button className={`dh-ac-chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          <Icon name="grid" size={12} /> All <b>{inScope.length}</b>
        </button>
        {TYPE_ORDER.filter((k) => counts[k]).map((k) => (
          <button key={k} className={`dh-ac-chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)} style={filter === k ? { ['--fc' as string]: ACTIVITY_META[k].color } : undefined}>
            <Icon name={ACTIVITY_ICONS[k] ?? 'note'} size={12} /> {ACTIVITY_META[k].label} <b>{counts[k]}</b>
          </button>
        ))}
      </div>

      <div className="dh-ac-feed">
        {shown.length === 0 ? (
          <div className="dh-ac-empty"><Icon name="activity" size={22} /><span>{q || range !== 'all' || filter !== 'all' ? 'No activity matches these filters.' : 'No activity logged yet.'}</span></div>
        ) : (
          shown.map((x, i) => {
            const meta = ACTIVITY_META[x.a.type];
            const inbound = isInbound(x.a);
            const isComm = COMM_TYPES.includes(x.a.type);
            return (
              <div key={x.a.id + i} className={`dh-ac-row ${inbound ? 'unread' : ''}`}>
                <div className="dh-ac-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
                  <Icon name={ACTIVITY_ICONS[x.a.type] ?? 'note'} size={14} />
                </div>
                <div className="dh-ac-body">
                  <div className="dh-ac-row-top">
                    <span className="dh-ac-type" style={{ ['--pc' as string]: meta.color }}>{meta.label}</span>
                    {inbound && <span className="dh-ac-unread-dot" title="New inbound reply" />}
                    <span className="dh-ac-who">{x.a.who}</span>
                    <span className="dh-ac-w">{x.a.w}</span>
                  </div>
                  <div className="dh-ac-sum">{summary(x.a)}</div>
                  <div className="dh-ac-row-foot">
                    <button className="dh-ac-deal" onClick={() => { openDeal(x.d.id); }}>
                      <span className="dh-ac-dot" style={{ background: hueOf(x.d.stage) }} />
                      {x.d.company} · {x.d.name}
                    </button>
                    {isComm && (
                      <button className="dh-ac-reply" onClick={() => openCommPanel(x.d.id)} title="Reply without leaving this view">
                        <Icon name="mail" size={12} /> Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
