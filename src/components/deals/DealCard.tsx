import { useState, useRef } from 'react';
import { useStore, type ComposerKind } from '@/store/useStore';
import type { Deal, StageKey, Priority, Activity } from '@/types';
import { money, staleDays } from '@/lib/format';
import { healthColor, OWNERS, STAGES, ACTIVITY_META } from '@/data/constants';
import { Avatar, Badge, Popover, Ring } from '@/components/ui/primitives';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { nextBestAction } from '@/lib/nova';
import { inboundCount, lastInbound, lastComm, recentComms, lastMessage } from '@/lib/comms';
import { evalDealColor } from '@/lib/colorRules';

function lastCommDir(deal: Deal): 'in' | 'out' | null {
  const a = deal.acts.find((x) => x.type === 'email' || x.type === 'whatsapp' || x.type === 'sms');
  if (!a) return null;
  if (a.thread && a.thread.length) return a.thread[a.thread.length - 1].dir;
  return a.dir ?? 'out';
}

const STAGE_KEYS: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export function CommBubble({ deal }: { deal: Deal; onOpen?: () => void }) {
  const n = inboundCount(deal);
  const hoverOpened = useRef(false);
  if (!n) return null;
  const who = (lastInbound(deal)?.who ?? 'Client').split(' ')[0];
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        align="start"
        width={320}
        trigger={({ open, toggle }) => (
          <button
            className={`dh-commbubble ${open ? 'on' : ''}`}
            title={`${n} new repl${n > 1 ? 'ies' : 'y'} from ${who}`}
            onClick={(e) => { e.stopPropagation(); if (hoverOpened.current) { hoverOpened.current = false; return; } toggle(); }}
            onMouseEnter={() => { if (!open) { toggle(); hoverOpened.current = true; } }}
          >
            <Icon name="chat" size={11} />
            <span>{n}</span>
          </button>
        )}
      >
        {(close) => <CommPopover deal={deal} close={close} />}
      </Popover>
    </span>
  );
}

function CommPopover({ deal, close }: { deal: Deal; close: () => void }) {
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const reply = useStore((s) => s.replyToActivity);
  const openComposer = useStore((s) => s.openComposer);
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);

  const target = lastInbound(deal) ?? lastComm(deal);
  const comms = recentComms(deal, showAll ? 12 : 3);
  const chan: ComposerKind = target?.type === 'whatsapp' ? 'whatsapp' : target?.type === 'sms' ? 'sms' : 'email';
  const who = target ? lastMessage(target).who : deal.contacts[0]?.n ?? 'Client';

  const send = () => {
    if (!target || !text.trim()) return;
    reply(deal.id, target.id, text.trim());
    setText('');
  };
  const draft = () => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({ dealId: deal.id, kind: chan, to: chan === 'email' ? email : '+1 (415) 555-0140', subject: chan === 'email' ? `Re: ${target?.subj ?? deal.name}` : '', body: text.trim(), outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30' });
    close();
  };

  return (
    <div className="dh-comm-pop">
      <div className="dh-comm-pop-head">
        <span className="dh-comm-pop-title"><Icon name="chat" size={13} /> Conversation · {deal.company}</span>
        <button className="dh-comm-pop-open" onClick={() => { setNav('deals'); openDeal(deal.id); close(); }}>Open deal <Icon name="arrowRight" size={12} /></button>
      </div>

      <div className="dh-comm-pop-list">
        {comms.length === 0 && <div className="dh-comm-pop-empty">No messages yet.</div>}
        {comms.map((a) => <CommRow key={a.id} act={a} />)}
        {!showAll && recentComms(deal, 12).length > 3 && (
          <button className="dh-comm-pop-more" onClick={() => setShowAll(true)}>See recent communication ({recentComms(deal, 12).length})</button>
        )}
      </div>

      {target && (
        <div className="dh-comm-pop-reply">
          <div className="dh-comm-pop-replyto">
            <Icon name={ACTIVITY_ICONS[chan] ?? 'mail'} size={12} /> Reply to {String(who).split(' ')[0]} · {ACTIVITY_META[chan].label}
          </div>
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
    </div>
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

const ADVANCE_ORDER: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

export function DealCard({
  deal,
  dragging,
  focused,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  dragging: boolean;
  focused?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const openDeal = useStore((s) => s.openDeal);
  const cardFields = useStore((s) => s.cardFields);
  const requestStage = useStore((s) => s.requestStage);
  const bulk = useStore((s) => s.bulk);
  const toggleBulk = useStore((s) => s.toggleBulk);
  const colorRulesOn = useStore((s) => s.colorRulesOn);
  const colorRules = useStore((s) => s.colorRules);
  const selected = bulk.includes(deal.id);
  const ruleColor = colorRulesOn ? evalDealColor(deal, colorRules) : null;
  const has = (k: string) => cardFields.includes(k);
  const hc = healthColor(deal.health);
  const stale = staleDays(deal.acts?.[0]?.w) >= 14 && deal.stage !== 'Won';
  const atRisk = deal.health < 45;
  const dir = lastCommDir(deal);
  const showNova = has('nova') && (atRisk || deal.win >= 80);
  const showTags = has('tags') && (deal.tags.length > 0 || stale || !!dir);
  const advIdx = ADVANCE_ORDER.indexOf(deal.stage);
  const nextStage = advIdx >= 0 && advIdx < ADVANCE_ORDER.length - 1 ? ADVANCE_ORDER[advIdx + 1] : null;
  const idle = staleDays(deal.acts?.[0]?.w);
  const closed = deal.stage === 'Won' || deal.stage === 'Lost';
  const ageColor = closed ? 'transparent' : idle >= 14 ? 'var(--red)' : idle >= 7 ? 'var(--amber)' : 'var(--green)';

  return (
    <article
      className={`dh-card ${dragging ? 'dragging' : ''} ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${ruleColor ? 'ruled' : ''}`}
      data-deal-card={deal.id}
      style={ruleColor ? { background: `color-mix(in srgb, ${ruleColor} 7%, var(--surface))`, borderColor: `color-mix(in srgb, ${ruleColor} 35%, var(--border))` } : undefined}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => openDeal(deal.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDeal(deal.id);
        }
      }}
    >
      <span className="dh-card-age" style={{ background: ruleColor ?? ageColor, width: ruleColor ? 5 : undefined }} title={ruleColor ? 'Matches a color rule' : closed ? deal.stage : `${idle}d since last activity`} />
      <button
        className={`dh-card-select ${selected ? 'on' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleBulk(deal.id); }}
        title={selected ? 'Deselect' : 'Select'}
        aria-label="Select deal"
      >
        {selected && <Icon name="check" size={11} color="#fff" />}
      </button>
      <div className="dh-card-top">
        <span className={`dh-prio ${deal.priority}`} title={`${deal.priority} priority`} />
        <h3 className="dh-card-title">{deal.name}</h3>
        <CommBubble deal={deal} onOpen={() => openDeal(deal.id)} />
        {nextStage && (
          <button
            className="dh-card-advance"
            onClick={(e) => { e.stopPropagation(); requestStage(deal.id, nextStage); }}
            title={`Advance to ${nextStage}`}
            aria-label={`Advance to ${nextStage}`}
          >
            <Icon name="arrowRight" size={13} />
          </button>
        )}
        {has('health') && <Ring value={deal.health} size={26} color={hc} label={String(deal.health)} />}
        <CardMenu deal={deal} />
      </div>

      <div className="dh-card-company">{deal.company}</div>

      {(() => {
        // Render body fields in the user-chosen cardFields order.
        // health renders as the corner ring above; value/win/owner group into a
        // single footer anchored at the first of them in the order.
        let footerDone = false;
        return cardFields.map((k) => {
          if (k === 'health') return null;
          if (k === 'tags') {
            return showTags ? (
              <div className="dh-card-tags" key="tags">
                {dir && <Badge tone={dir === 'in' ? 'green' : 'neutral'}>{dir === 'in' ? '↓ Inbound' : '↑ Outbound'}</Badge>}
                {deal.tags.slice(0, 2).map((t) => <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>)}
                {stale && <Badge tone="amber"><Icon name="clock" size={11} /> Stale</Badge>}
              </div>
            ) : null;
          }
          if (k === 'nova') {
            return showNova ? (
              <div className={`dh-card-nova ${atRisk ? 'risk' : 'good'}`} key="nova">
                <Icon name="sparkles" size={12} />
                <span>{nextBestAction(deal)}</span>
              </div>
            ) : null;
          }
          if (k === 'value' || k === 'win' || k === 'owner') {
            if (footerDone) return null;
            footerDone = true;
            return (
              <div className="dh-card-foot" key="footer">
                {has('value') && <span className="dh-card-value mono">{money(deal.value, true)}</span>}
                <div className="dh-card-foot-right">
                  {has('win') && <span className="dh-card-win mono" title="Win probability">{deal.win}%</span>}
                  {has('owner') && <Avatar ownerKey={deal.owner} size={22} />}
                </div>
              </div>
            );
          }
          return null;
        });
      })()}

      <div className="dh-card-close"><Icon name="clock" size={11} /> Close {deal.close}</div>

      {has('win') && (
        <div className="dh-card-winbar">
          <span style={{ width: `${deal.win}%`, background: hc }} />
        </div>
      )}

      <CardActions deal={deal} />
    </article>
  );
}

const QUICK_ACTS: { k: ComposerKind; icon: string; label: string }[] = [
  { k: 'note', icon: 'note', label: 'Note' },
  { k: 'email', icon: 'mail', label: 'Email' },
  { k: 'call', icon: 'phone', label: 'Log call' },
  { k: 'meeting', icon: 'calendar', label: 'Meeting' },
  { k: 'task', icon: 'check', label: 'Task' },
  { k: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp' },
];

export function CardActions({ deal, className = '' }: { deal: Deal; className?: string }) {
  const openComposer = useStore((s) => s.openComposer);
  const open = (kind: ComposerKind) => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({
      dealId: deal.id, kind,
      to: kind === 'email' ? email : '+1 (415) 555-0140',
      subject: kind === 'email' ? `${deal.name} — next steps` : '',
      body: '', outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30',
      title: kind === 'task' ? String(deal.next ?? 'Follow up') : kind === 'meeting' ? `Next steps — ${deal.name}` : '',
    });
  };
  return (
    <div className={`dh-card-acts ${className}`} onClick={(e) => e.stopPropagation()}>
      {QUICK_ACTS.map((q) => (
        <button key={q.k} title={q.label} aria-label={q.label} onClick={() => open(q.k)}>
          <Icon name={q.icon} size={14} />
        </button>
      ))}
    </div>
  );
}

function CardMenu({ deal }: { deal: Deal }) {
  const requestStage = useStore((s) => s.requestStage);
  const setDealPriority = useStore((s) => s.setDealPriority);
  const setDealOwner = useStore((s) => s.setDealOwner);
  const duplicateDeal = useStore((s) => s.duplicateDeal);
  const deleteDeal = useStore((s) => s.deleteDeal);
  const setPeek = useStore((s) => s.setPeek);

  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        align="end"
        width={210}
        trigger={({ toggle }) => (
          <button className="dh-card-more" onClick={toggle} aria-label="Deal actions">
            <Icon name="more" size={15} />
          </button>
        )}
      >
        {(close) => (
          <div className="dh-cardmenu">
            <button className="dh-menu-item" onClick={() => { setPeek(deal.id); close(); }}>
              <span className="dh-menu-icon"><Icon name="eye" size={15} /></span>Quick peek
            </button>
            <div className="dh-menu-sep" />
            <div className="dh-menu-head">Move to</div>
            <div className="dh-cardmenu-chips">
              {STAGE_KEYS.filter((s) => s !== deal.stage).map((s) => (
                <button key={s} className="dh-chip" style={{ ['--pc' as string]: STAGES.find((x) => x.k === s)?.hue }} onClick={() => { requestStage(deal.id, s); close(); }}>{s}</button>
              ))}
            </div>
            <div className="dh-menu-head">Priority</div>
            <div className="dh-cardmenu-chips">
              {(['high', 'med', 'low'] as Priority[]).map((p) => (
                <button key={p} className={`dh-chip ${deal.priority === p ? 'on' : ''}`} onClick={() => { setDealPriority(deal.id, p); close(); }}>{p === 'high' ? 'High' : p === 'med' ? 'Med' : 'Low'}</button>
              ))}
            </div>
            <div className="dh-menu-head">Owner</div>
            <div className="dh-cardmenu-owners">
              {Object.values(OWNERS).map((o) => (
                <button key={o.key} className={`dh-cardmenu-owner ${deal.owner === o.key ? 'on' : ''}`} onClick={() => { setDealOwner(deal.id, o.key); close(); }} title={o.name}>
                  <Avatar ownerKey={o.key} size={24} />
                </button>
              ))}
            </div>
            <div className="dh-menu-sep" />
            <button className="dh-menu-item" onClick={() => { duplicateDeal(deal.id); close(); }}>
              <span className="dh-menu-icon"><Icon name="layers" size={15} /></span>Duplicate
            </button>
            <button className="dh-menu-item danger" onClick={() => { deleteDeal(deal.id); close(); }}>
              <span className="dh-menu-icon"><Icon name="trash" size={15} /></span>Delete
            </button>
          </div>
        )}
      </Popover>
    </span>
  );
}
