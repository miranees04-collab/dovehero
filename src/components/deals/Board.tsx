import { useState } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import { OWNERS, hueOf } from '@/data/constants';
import type { Deal, StageKey, Priority } from '@/types';
import { money } from '@/lib/format';
import { DealCard } from './DealCard';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';

const BOARD_STAGES: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
const PRIO_LANES: { k: Priority; label: string }[] = [
  { k: 'high', label: 'High priority' },
  { k: 'med', label: 'Medium priority' },
  { k: 'low', label: 'Low priority' },
];

export function Board() {
  const pipeline = useStore((s) => s.pipeline);
  const swimlane = useStore((s) => s.swimlane);
  const kbCompact = useStore((s) => s.kbCompact);
  const requestStage = useStore((s) => s.requestStage);
  const deals = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const onDrop = (stage: StageKey) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    requestStage(id, stage);
  };

  const colsFor = (subset: Deal[], laneKey?: string) => (
    <BoardColumns
      stages={BOARD_STAGES}
      deals={subset}
      dragId={dragId}
      overStage={overStage}
      laneKey={laneKey}
      setDragId={setDragId}
      setOverStage={setOverStage}
      onDrop={onDrop}
      compact={!!laneKey}
    />
  );

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
            {colsFor(deals.filter((d) => d.owner === ok), 'o-' + ok)}
          </div>
        ))}
      </div>
    );
  }

  if (swimlane === 'priority') {
    return (
      <div className="dh-board-scroll">
        {PRIO_LANES.map((p) => {
          const subset = deals.filter((d) => d.priority === p.k);
          if (!subset.length) return null;
          return (
            <div className="dh-swimlane" key={p.k}>
              <div className="dh-swimlane-head">
                <span className={`dh-prio ${p.k}`} style={{ marginTop: 0 }} />
                <b>{p.label}</b>
                <span className="dh-swimlane-count">{subset.length}</span>
              </div>
              {colsFor(subset, 'p-' + p.k)}
            </div>
          );
        })}
      </div>
    );
  }

  return <div className={`dh-board ${kbCompact ? 'compact-cards' : ''}`}>{colsFor(deals)}</div>;
}

function BoardColumns({
  stages,
  deals,
  dragId,
  overStage,
  laneKey,
  setDragId,
  setOverStage,
  onDrop,
  compact,
}: {
  stages: StageKey[];
  deals: Deal[];
  dragId: string | null;
  overStage: string | null;
  laneKey?: string;
  setDragId: (id: string | null) => void;
  setOverStage: (s: string | null) => void;
  onDrop: (stage: StageKey) => void;
  compact?: boolean;
}) {
  const collapsedCols = useStore((s) => s.collapsedCols);
  const toggleColCollapse = useStore((s) => s.toggleColCollapse);

  return (
    <div className={`dh-cols ${compact ? 'compact' : ''}`}>
      {stages.map((sk) => {
        const list = deals.filter((d) => d.stage === sk);
        const total = list.reduce((s, d) => s + d.value, 0);
        const hue = hueOf(sk);
        const overId = (laneKey ?? '') + sk;
        const isOver = overStage === overId && dragId;
        const collapsed = !laneKey && collapsedCols[sk];

        if (collapsed) {
          return (
            <button
              key={sk}
              className="dh-col-collapsed"
              style={{ ['--col-hue' as string]: hue }}
              onClick={() => toggleColCollapse(sk)}
              onDragOver={(e) => { e.preventDefault(); setOverStage(overId); }}
              onDrop={() => onDrop(sk)}
              title={`Expand ${sk}`}
            >
              <span className="dh-col-dot" style={{ background: hue }} />
              <span className="dh-col-collapsed-name">{sk}</span>
              <span className="dh-col-count">{list.length}</span>
            </button>
          );
        }

        return (
          <div
            key={sk}
            className={`dh-col ${isOver ? 'over' : ''}`}
            style={{ ['--col-hue' as string]: hue }}
            onDragOver={(e) => { e.preventDefault(); setOverStage(overId); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null); }}
            onDrop={() => onDrop(sk)}
          >
            <div className="dh-col-head">
              <span className="dh-col-dot" style={{ background: hue }} />
              <span className="dh-col-name">{sk}</span>
              <span className="dh-col-count">{list.length}</span>
              <span className="dh-col-total mono">{money(total, true)}</span>
              {!laneKey && (
                <button className="dh-col-collapse" onClick={() => toggleColCollapse(sk)} aria-label={`Collapse ${sk}`} title="Collapse">
                  <Icon name="chevronLeft" size={14} />
                </button>
              )}
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
            {!laneKey && sk !== 'Won' && <InlineAdd stage={sk} />}
          </div>
        );
      })}
    </div>
  );
}

function InlineAdd({ stage }: { stage: StageKey }) {
  const createDeal = useStore((s) => s.createDeal);
  const openDeal = useStore((s) => s.openDeal);
  const toast = useStore((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const submit = (open: boolean) => {
    const company = name.trim();
    if (!company) {
      setEditing(false);
      return;
    }
    const id = createDeal({ company, name: `${company} — New deal`, stage });
    setName('');
    setEditing(false);
    toast('Deal added', 'success');
    if (open) openDeal(id);
  };

  if (!editing) {
    return (
      <button className="dh-col-add" onClick={() => setEditing(true)}>
        <Icon name="plus" size={14} /> Add deal
      </button>
    );
  }
  return (
    <div className="dh-col-addbox">
      <input
        autoFocus
        className="dh-input"
        placeholder="Company name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(false);
          if (e.key === 'Escape') { setName(''); setEditing(false); }
        }}
        onBlur={() => submit(false)}
      />
    </div>
  );
}
