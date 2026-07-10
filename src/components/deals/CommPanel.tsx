import { useState, useEffect } from 'react';
import { useStore, type ComposerKind } from '@/store/useStore';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { TypingDots } from '@/components/ui/primitives';
import { ACTIVITY_META } from '@/data/constants';
import { recentComms, lastInbound, lastComm, lastMessage } from '@/lib/comms';
import type { Activity } from '@/types';

/** Right-corner docked conversation pop-up — opens when a comm bubble is
 *  clicked. Lets you read recent messages and reply without opening the deal. */
export function CommPanel() {
  const dealId = useStore((s) => s.commDealId);
  const deal = useStore((s) => s.deals.find((d) => d.id === dealId));
  const close = useStore((s) => s.openCommPanel);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const reply = useStore((s) => s.replyToActivity);
  const openComposer = useStore((s) => s.openComposer);
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const typing = useStore((s) => (activeReplyId ? s.typing[activeReplyId] : false));

  // Reset per-deal local state when the panel switches deals.
  useEffect(() => { setText(''); setShowAll(false); setActiveReplyId(null); }, [dealId]);
  useEffect(() => {
    if (!dealId) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [dealId, close]);

  if (!dealId || !deal) return null;

  const target = lastInbound(deal) ?? lastComm(deal);
  const comms = recentComms(deal, showAll ? 14 : 5);
  const chan: ComposerKind = target?.type === 'whatsapp' ? 'whatsapp' : target?.type === 'sms' ? 'sms' : 'email';
  const who = target ? lastMessage(target).who : deal.contacts[0]?.n ?? 'Client';
  const allCount = recentComms(deal, 20).length;

  const send = () => {
    if (!target || !text.trim()) return;
    setActiveReplyId(target.id);
    reply(deal.id, target.id, text.trim());
    setText('');
  };
  const draft = () => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({ dealId: deal.id, kind: chan, to: chan === 'email' ? email : '+1 (415) 555-0140', subject: chan === 'email' ? `Re: ${target?.subj ?? deal.name}` : '', body: text.trim(), outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30' });
    close(null);
  };

  return (
    <aside className="dh-comm-panel">
      <div className="dh-comm-panel-head">
        <span className="dh-comm-panel-title"><Icon name="chat" size={14} /> {deal.company}</span>
        <div className="dh-comm-panel-head-r">
          <button className="dh-comm-panel-open" onClick={() => { setNav('deals'); openDeal(deal.id); close(null); }}>Open deal <Icon name="arrowRight" size={12} /></button>
          <button className="dh-comm-panel-x" onClick={() => close(null)} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
      </div>
      <div className="dh-comm-panel-sub">{deal.name}</div>

      <div className="dh-comm-panel-list">
        {comms.length === 0 && <div className="dh-comm-pop-empty">No messages yet.</div>}
        {comms.map((a) => <CommRow key={a.id} act={a} />)}
        {typing && <div className="dh-comm-typing"><TypingDots label={`${String(who).split(' ')[0]} is typing`} /></div>}
        {!showAll && allCount > 5 && (
          <button className="dh-comm-pop-more" onClick={() => setShowAll(true)}>See recent communication ({allCount})</button>
        )}
      </div>

      {target && (
        <div className="dh-comm-pop-reply">
          <div className="dh-comm-pop-replyto"><Icon name={ACTIVITY_ICONS[chan] ?? 'mail'} size={12} /> Reply to {String(who).split(' ')[0]} · {ACTIVITY_META[chan].label}</div>
          <textarea
            className="dh-comm-pop-input"
            placeholder={`Write a ${ACTIVITY_META[chan].label.toLowerCase()}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}
            autoFocus
          />
          <div className="dh-comm-pop-actions">
            <button className="dh-comm-draft" onClick={draft}><Icon name="pencil" size={13} /> Draft</button>
            <button className="dh-comm-send" onClick={send} disabled={!text.trim()}><Icon name="send" size={13} /> Send</button>
          </div>
        </div>
      )}
    </aside>
  );
}

function CommRow({ act }: { act: Activity }) {
  const m = lastMessage(act);
  const meta = ACTIVITY_META[act.type];
  return (
    <div className={`dh-comm-row ${m.dir}`}>
      <span className="dh-comm-row-ic" style={{ color: meta.color }}><Icon name={ACTIVITY_ICONS[act.type] ?? 'mail'} size={13} /></span>
      <div className="dh-comm-row-body">
        <div className="dh-comm-row-meta">
          <b>{m.who}</b>
          <span className={`dh-comm-dir ${m.dir}`}>{m.dir === 'in' ? '↓ in' : '↑ out'}</span>
          <span className="dh-comm-row-time">{m.w}</span>
        </div>
        {act.subj && act.type === 'email' && <div className="dh-comm-row-subj">{act.subj}</div>}
        <div className="dh-comm-row-text">{m.text}</div>
      </div>
    </div>
  );
}
