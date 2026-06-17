import { useState } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import { OWNERS, hueOf } from '@/data/constants';
import type { Deal, StageKey } from '@/types';
import { money } from '@/lib/format';
import { DealCard } from './DealCard';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';

const BOARD_STAGES: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

export function Board() {
  const pipeline = useStore((s) => s.pipeline);
  const swimlane = useStore((s) => s.swimlane);
  const moveDeal = useStore((s) => s.moveDeal);
  const toast = useStore((s) => s.toast);
  const deals = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const onDrop = (stage: StageKey, lane?: string) => {
    if (!dragId) return;
    const d = useStore.getState().deals.find((x) => x.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (!d) return;
    if (d.stage !== stage) {
      moveDeal(dragId, stage);
      toast(`${d.company} moved to ${stage}`, stage === 'Won' ? 'success' : 'default');
    }
    void lane;
  };

  if (swimlane === 'owner') {
    const owners = Array.from(new Set(deals.map((d) => d.owner)));
    return (
      <div className="dh-board-scroll">
        {owners.map((ok) => (
          <div className="dh-swimlane" key={ok}>
            <div className="dh-swimlane-head">
              <Avatar ownerKey={ok} size={22} />
              <b>{OWNERS[ok]?.name ?? ok}</b>
              <span className="dh-swimlane-count">{deals.filter((d) => d.owner === ok).length}</span>
            </div>
            <BoardColumns
              stages={BOARD_STAGES}
              deals={deals.filter((d) => d.owner === ok)}
              dragId={dragId}
              overStage={overStage === ok ? overStage : null}
              setDragId={setDragId}
              setOverStage={(s) => setOverStage(s ? ok : null)}
              onDrop={(st) => onDrop(st, ok)}
              compact
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="dh-board">
      <BoardColumns
        stages={BOARD_STAGES}
        deals={deals}
        dragId={dragId}
        overStage={overStage}
        setDragId={setDragId}
        setOverStage={setOverStage}
        onDrop={onDrop}
      />
    </div>
  );
}

function BoardColumns({
  stages,
  deals,
  dragId,
  overStage,
  setDragId,
  setOverStage,
  onDrop,
  compact,
}: {
  stages: StageKey[];
  deals: Deal[];
  dragId: string | null;
  overStage: string | null;
  setDragId: (id: string | null) => void;
  setOverStage: (s: string | null) => void;
  onDrop: (stage: StageKey) => void;
  compact?: boolean;
}) {
  return (
    <div className={`dh-cols ${compact ? 'compact' : ''}`}>
      {stages.map((sk) => {
        const list = deals.filter((d) => d.stage === sk);
        const total = list.reduce((s, d) => s + d.value, 0);
        const hue = hueOf(sk);
        const isOver = overStage === sk && dragId;
        return (
          <div
            key={sk}
            className={`dh-col ${isOver ? 'over' : ''}`}
            style={{ ['--col-hue' as string]: hue }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(sk);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
            }}
            onDrop={() => onDrop(sk)}
          >
            <div className="dh-col-head">
              <span className="dh-col-dot" style={{ background: hue }} />
              <span className="dh-col-name">{sk}</span>
              <span className="dh-col-count">{list.length}</span>
              <span className="dh-col-total mono">{money(total, true)}</span>
            </div>
            <div className="dh-col-cards">
              {list.map((d) => (
                <DealCard
                  key={d.id}
                  deal={d}
                  dragging={dragId === d.id}
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                />
              ))}
              {!list.length && (
                <div className="dh-col-empty">
                  <Icon name="layers" size={18} />
                  <span>No deals</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
