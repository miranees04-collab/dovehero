import { useStore } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Badge, Button, Ring } from '@/components/ui/primitives';
import { OWNERS, healthColor, healthBand, hueOf } from '@/data/constants';
import { money } from '@/lib/format';
import { nextBestAction } from '@/lib/nova';

export function Peek() {
  const peekId = useStore((s) => s.peekId);
  const deal = useStore((s) => s.deals.find((d) => d.id === peekId));
  const setPeek = useStore((s) => s.setPeek);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);

  if (!peekId || !deal) return null;
  const hc = healthColor(deal.health);

  return (
    <Drawer open onClose={() => setPeek(null)} width={380} className="dh-panel">
      <div className="dh-panel-head">
        <div className="dh-panel-title" style={{ fontSize: 14 }}>
          <span className="dh-prio" style={{ marginTop: 0, background: hueOf(deal.stage) }} />
          Quick peek
        </div>
        <button className="dh-icon-btn" onClick={() => setPeek(null)} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <div className="dh-panel-body" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{deal.name}</h2>
        <div style={{ color: 'var(--sub)', fontSize: 13, marginBottom: 14 }}>{deal.company} · {deal.industry}</div>

        <div className="dh-peek-metrics">
          <div><span className="l">Value</span><span className="v mono">{money(deal.value)}</span></div>
          <div><span className="l">Win</span><span className="v mono">{deal.win}%</span></div>
          <div><span className="l">Stage</span><span className="v">{deal.stage}</span></div>
          <div className="dh-peek-health">
            <Ring value={deal.health} size={30} color={hc} label={String(deal.health)} />
            <span style={{ color: hc, fontSize: 12, fontWeight: 600 }}>{healthBand(deal.health)}</span>
          </div>
        </div>

        <div className="dh-nba" style={{ marginTop: 14 }}>
          <Icon name="zap" size={14} />
          <div>
            <span className="dh-nba-label">Next step</span>
            <span className="dh-nba-text">{nextBestAction(deal)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0' }}>
          <Avatar ownerKey={deal.owner} size={22} />
          <span style={{ fontSize: 13, color: 'var(--ink-2)', alignSelf: 'center' }}>{OWNERS[deal.owner]?.name}</span>
          {deal.tags.map((t) => <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>)}
        </div>

        <Button variant="primary" style={{ width: '100%' }} onClick={() => { setNav('deals'); openDeal(deal.id); setPeek(null); }}>
          Open full record <Icon name="arrowRight" size={15} />
        </Button>
      </div>
    </Drawer>
  );
}
