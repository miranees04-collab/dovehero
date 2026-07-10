import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import type { Deal } from '@/types';
import './panels.css';

type NotifType = 'nova' | 'risk' | 'win' | 'reply';

interface NotifItem {
  id: string;
  type: NotifType;
  icon: string;
  title: string;
  sub: string;
  when: string;
  dealId: string | null;
  bucket: 'today' | 'earlier';
}

const META: Record<NotifType, { color: string; soft: string }> = {
  nova: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  risk: { color: 'var(--red)', soft: 'var(--red-soft)' },
  win: { color: 'var(--green)', soft: 'var(--green-soft)' },
  reply: { color: 'var(--blue)', soft: 'var(--blue-soft)' },
};

function isToday(w: string): boolean {
  return /today|now|h$/i.test(w.trim());
}

function buildNotifs(deals: Deal[]): NotifItem[] {
  const items: NotifItem[] = [];

  // Nova digest — always first.
  const attention = deals.filter((d) => d.health < 45 || (d.win >= 80 && d.stage === 'Negotiation'));
  items.push({
    id: 'nova-digest',
    type: 'nova',
    icon: 'sparkles',
    title: 'Nova summarized your day',
    sub: `${attention.length || 2} deals need attention.`,
    when: 'now',
    dealId: attention[0]?.id ?? null,
    bucket: 'today',
  });

  // Risk: quiet deals.
  deals
    .filter((d) => d.health < 45)
    .slice(0, 3)
    .forEach((d) => {
      items.push({
        id: 'risk-' + d.id,
        type: 'risk',
        icon: 'alert',
        title: `${d.company} is going quiet`,
        sub: 'Health dropping — re-engage soon.',
        when: d.acts[0]?.w ?? '1d',
        dealId: d.id,
        bucket: 'earlier',
      });
    });

  // Win: ready to close.
  deals
    .filter((d) => d.win >= 80 && d.stage === 'Negotiation')
    .slice(0, 2)
    .forEach((d) => {
      items.push({
        id: 'win-' + d.id,
        type: 'win',
        icon: 'check',
        title: `${d.company} is ready to close`,
        sub: 'Send paperwork to lock it in.',
        when: d.acts[0]?.w ?? '3h',
        dealId: d.id,
        bucket: 'today',
      });
    });

  // Replies: most recent inbound email / whatsapp activity.
  deals
    .map((d) => {
      const act = d.acts.find(
        (a) => (a.type === 'email' || a.type === 'whatsapp') && a.dir === 'in',
      );
      return act ? { d, act } : null;
    })
    .filter((x): x is { d: Deal; act: Deal['acts'][number] } => x !== null)
    .slice(0, 3)
    .forEach(({ d, act }) => {
      items.push({
        id: 'reply-' + d.id + '-' + act.id,
        type: 'reply',
        icon: act.type === 'whatsapp' ? 'whatsapp' : 'mail',
        title: `${act.who} replied on ${d.company}`,
        sub: act.subj ?? act.text ?? 'New message in the thread.',
        when: act.w,
        dealId: d.id,
        bucket: isToday(act.w) ? 'today' : 'earlier',
      });
    });

  return items.slice(0, 8);
}

export function NotificationsPanel() {
  const open = useStore((s) => s.notifOpen);
  const deals = useStore((s) => s.deals);
  const setNotif = useStore((s) => s.setNotif);
  const setNav = useStore((s) => s.setNav);
  const openDeal = useStore((s) => s.openDeal);
  const toast = useStore((s) => s.toast);

  const items = useMemo(() => (open ? buildNotifs(deals) : []), [open, deals]);

  const today = items.filter((i) => i.bucket === 'today');
  const earlier = items.filter((i) => i.bucket === 'earlier');

  const handleClick = (n: NotifItem) => {
    setNotif(false);
    if (n.dealId) {
      setNav('deals');
      openDeal(n.dealId);
    }
  };

  const renderItem = (n: NotifItem) => {
    const m = META[n.type];
    return (
      <button key={n.id} type="button" className="dh-notif-item" onClick={() => handleClick(n)}>
        <span className="dh-notif-chip" style={{ color: m.color, background: m.soft }}>
          <Icon name={n.icon} size={16} color={m.color} />
        </span>
        <span className="dh-notif-body">
          <span className="dh-notif-title">{n.title}</span>
          <span className="dh-notif-sub">{n.sub}</span>
        </span>
        <span className="dh-notif-when">{n.when}</span>
      </button>
    );
  };

  return (
    <Drawer open={open} onClose={() => setNotif(false)} width={380} className="dh-notif">
      {open && (
        <>
          <div className="dh-notif-head">
            <div className="dh-notif-head-title">
              <Icon name="bell" size={17} />
              <b>Notifications</b>
            </div>
            <div className="dh-notif-head-actions">
              <button
                type="button"
                className="dh-notif-mark"
                onClick={() => toast('All notifications marked read', 'success')}
              >
                Mark all read
              </button>
              <button
                type="button"
                className="dh-notif-close"
                aria-label="Close notifications"
                onClick={() => setNotif(false)}
              >
                <Icon name="x" size={17} />
              </button>
            </div>
          </div>

          <div className="dh-notif-list">
            {items.length === 0 && <div className="dh-notif-empty">You're all caught up.</div>}

            {today.length > 0 && (
              <>
                <div className="dh-notif-group">Today</div>
                {today.map(renderItem)}
              </>
            )}

            {earlier.length > 0 && (
              <>
                <div className="dh-notif-group">Earlier</div>
                {earlier.map(renderItem)}
              </>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
