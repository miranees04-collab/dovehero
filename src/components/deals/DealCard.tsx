import { useStore } from '@/store/useStore';
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

      {showTags && (
        <div className="dh-card-tags">
          {dir && <Badge tone={dir === 'in' ? 'green' : 'neutral'}>{dir === 'in' ? '↓ Inbound' : '↑ Outbound'}</Badge>}
          {deal.tags.slice(0, 2).map((t) => (
            <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>
              {t}
            </Badge>
          ))}
          {stale && (
            <Badge tone="amber">
              <Icon name="clock" size={11} /> Stale
            </Badge>
          )}
        </div>
      )}

      {showNova && (
        <div className={`dh-card-nova ${atRisk ? 'risk' : 'good'}`}>
          <Icon name="sparkles" size={12} />
          <span>{nextBestAction(deal)}</span>
        </div>
      )}

      <div className="dh-card-close"><Icon name="clock" size={11} /> Close {deal.close}</div>

      {(has('value') || has('win') || has('owner')) && (
        <div className="dh-card-foot">
          {has('value') && <span className="dh-card-value mono">{money(deal.value, true)}</span>}
          <div className="dh-card-foot-right">
            {has('win') && (
              <span className="dh-card-win mono" title="Win probability">
                {deal.win}%
              </span>
            )}
            {has('owner') && <Avatar ownerKey={deal.owner} size={22} />}
          </div>
        </div>
      )}

      {has('win') && (
        <div className="dh-card-winbar">
          <span style={{ width: `${deal.win}%`, background: hc }} />
        </div>
      )}
    </article>
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
