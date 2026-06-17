import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Activity, Deal } from '@/types';
import { ACTIVITY_META, TYPE_ORDER, hueOf } from '@/data/constants';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { ageHours } from '@/lib/format';
import './activity.css';

type Row = { a: Activity; d: Deal };

function summary(a: Activity): string {
  if (a.type === 'email') return a.subj ?? a.thread?.[a.thread.length - 1]?.text ?? 'Email';
  if (a.type === 'meeting') return a.subj ?? 'Meeting';
  if (a.type === 'call') return `Call · ${a.outcome ?? 'Connected'}`;
  if (a.type === 'task') return (a.title ?? a.text ?? 'Task') + (a.done ? ' · done' : '');
  if (a.type === 'marketing') return a.subj ?? a.seq?.name ?? 'Sequence';
  if (a.type === 'whatsapp' || a.type === 'sms') return a.thread?.[a.thread.length - 1]?.text ?? a.text ?? 'Message';
  return a.text ?? 'Activity';
}

export function ActivityCenter() {
  const deals = useStore((s) => s.deals);
  const openDeal = useStore((s) => s.openDeal);
  const [filter, setFilter] = useState<string>('all');

  const all: Row[] = [];
  deals.forEach((d) => d.acts.forEach((a) => all.push({ a, d })));
  const counts: Record<string, number> = {};
  all.forEach((x) => { counts[x.a.type] = (counts[x.a.type] ?? 0) + 1; });
  const chrono = all.slice().sort((x, y) => ageHours(x.a.w) - ageHours(y.a.w));
  const dealsWithActivity = deals.filter((d) => d.acts.length).length;
  const shown = filter === 'all' ? chrono : chrono.filter((x) => x.a.type === filter);

  return (
    <div className="dh-actcenter">
      <div className="dh-ac-head">
        <div className="dh-ac-title"><Icon name="target" size={18} color="var(--violet)" /> 360° activity</div>
        <div className="dh-ac-sub">Every note, call, email, meeting, task &amp; message across <b>{dealsWithActivity}</b> deals · <b>{all.length}</b> interactions</div>
      </div>

      <div className="dh-ac-chips">
        <button className={`dh-ac-chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          <Icon name="grid" size={12} /> All <b>{all.length}</b>
        </button>
        {TYPE_ORDER.filter((k) => counts[k]).map((k) => (
          <button key={k} className={`dh-ac-chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)} style={filter === k ? { ['--fc' as string]: ACTIVITY_META[k].color } : undefined}>
            <Icon name={ACTIVITY_ICONS[k] ?? 'note'} size={12} /> {ACTIVITY_META[k].label} <b>{counts[k]}</b>
          </button>
        ))}
      </div>

      <div className="dh-ac-feed">
        {shown.length === 0 ? (
          <div className="dh-ac-empty"><Icon name="activity" size={22} /><span>No activity logged yet.</span></div>
        ) : (
          shown.map((x, i) => {
            const meta = ACTIVITY_META[x.a.type];
            return (
              <div key={x.a.id + i} className="dh-ac-row">
                <div className="dh-ac-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
                  <Icon name={ACTIVITY_ICONS[x.a.type] ?? 'note'} size={14} />
                </div>
                <div className="dh-ac-body">
                  <div className="dh-ac-row-top">
                    <span className="dh-ac-type" style={{ ['--pc' as string]: meta.color }}>{meta.label}</span>
                    <span className="dh-ac-who">{x.a.who}</span>
                    <span className="dh-ac-w">{x.a.w}</span>
                  </div>
                  <div className="dh-ac-sum">{summary(x.a)}</div>
                  <button className="dh-ac-deal" onClick={() => { openDeal(x.d.id); }}>
                    <span className="dh-ac-dot" style={{ background: hueOf(x.d.stage) }} />
                    {x.d.company} · {x.d.name}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
