import { useStore } from '@/store/useStore';
import type { Deal } from '@/types';
import { money, staleDays } from '@/lib/format';
import { healthColor } from '@/data/constants';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction } from '@/lib/nova';

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
  const showNova = has('nova') && (atRisk || deal.win >= 80);
  const showTags = has('tags') && (deal.tags.length > 0 || stale);

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
        {has('health') && (
          <span className="dh-card-health" style={{ color: hc }} title={`Health ${deal.health}`}>
            <span className="dh-card-health-dot" style={{ background: hc }} />
            {deal.health}
          </span>
        )}
      </div>

      <div className="dh-card-company">{deal.company}</div>

      {showTags && (
        <div className="dh-card-tags">
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
