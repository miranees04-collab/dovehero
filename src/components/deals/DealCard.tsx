import { useStore, type ComposerKind } from '@/store/useStore';
import type { Deal, StageKey, Priority } from '@/types';
import { money, staleDays } from '@/lib/format';
import { healthColor, OWNERS, STAGES } from '@/data/constants';
import { Avatar, Badge, Popover, Ring } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction } from '@/lib/nova';
import { inboundCount, lastInbound } from '@/lib/comms';

function lastCommDir(deal: Deal): 'in' | 'out' | null {
  const a = deal.acts.find((x) => x.type === 'email' || x.type === 'whatsapp' || x.type === 'sms');
  if (!a) return null;
  if (a.thread && a.thread.length) return a.thread[a.thread.length - 1].dir;
  return a.dir ?? 'out';
}

const STAGE_KEYS: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export function CommBubble({ deal, onOpen }: { deal: Deal; onOpen?: () => void }) {
  const n = inboundCount(deal);
  if (!n) return null;
  const last = lastInbound(deal);
  const who = (last?.who ?? 'Client').split(' ')[0];
  return (
    <button
      className="dh-commbubble"
      title={`${n} new repl${n > 1 ? 'ies' : 'y'} from ${who}`}
      onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
    >
      <Icon name="chat" size={11} />
      <span>{n}</span>
    </button>
  );
}

export function DealCard({
  deal,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const openDeal = useStore((s) => s.openDeal);
  const cardFields = useStore((s) => s.cardFields);
  const has = (k: string) => cardFields.includes(k);
  const hc = healthColor(deal.health);
  const stale = staleDays(deal.acts?.[0]?.w) >= 14 && deal.stage !== 'Won';
  const atRisk = deal.health < 45;
  const dir = lastCommDir(deal);
  const showNova = has('nova') && (atRisk || deal.win >= 80);
  const showTags = has('tags') && (deal.tags.length > 0 || stale || !!dir);

  return (
    <article
      className={`dh-card ${dragging ? 'dragging' : ''}`}
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
      <div className="dh-card-top">
        <span className={`dh-prio ${deal.priority}`} title={`${deal.priority} priority`} />
        <h3 className="dh-card-title">{deal.name}</h3>
        <CommBubble deal={deal} onOpen={() => openDeal(deal.id)} />
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
