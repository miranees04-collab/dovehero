import { useState, useEffect, useRef } from 'react';
import { useStore, useFilteredDeals, type ComposerKind, type BoardStageCfg } from '@/store/useStore';
import { OWNERS, hueOf } from '@/data/constants';
import type { Deal, StageKey, Priority } from '@/types';
import { money } from '@/lib/format';
import { DealCard } from './DealCard';
import { BulkBar } from './BulkBar';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Popover } from '@/components/ui/primitives';

const ALL_BOARD_STAGES: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const PRIO_LANES: { k: Priority; label: string }[] = [
  { k: 'high', label: 'High priority' },
  { k: 'med', label: 'Medium priority' },
  { k: 'low', label: 'Low priority' },
];
const labelOf = (cfg: BoardStageCfg) => cfg.label ?? cfg.k;

export function Board() {
  const pipeline = useStore((s) => s.pipeline);
  const swimlane = useStore((s) => s.swimlane);
  const kbCompact = useStore((s) => s.kbCompact);
  const requestStage = useStore((s) => s.requestStage);
  const boardStages = useStore((s) => s.boardStages);
  const boardEditing = useStore((s) => s.boardEditing);
  const openComposer = useStore((s) => s.openComposer);
  const openDeal = useStore((s) => s.openDeal);
  const toggleBulk = useStore((s) => s.toggleBulk);
  const setPeek = useStore((s) => s.setPeek);
  const deals = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const visibleStages = boardStages.filter((s) => !s.hidden);

  // ---- keyboard shortcuts (board only) ----
  const dealsRef = useRef(deals);
  dealsRef.current = deals;
  const stagesRef = useRef(visibleStages);
  stagesRef.current = visibleStages;
  const focusRef = useRef(focusId);
  focusRef.current = focusId;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.view !== 'board' || st.nav !== 'deals' || st.openDealId || st.paletteOpen || st.composers.length || st.boardEditing) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const cols = stagesRef.current.map((cfg) => ({ k: cfg.k, list: dealsRef.current.filter((d) => d.stage === cfg.k) }));
      const flatFind = (): { ci: number; ri: number } | null => {
        for (let ci = 0; ci < cols.length; ci++) { const ri = cols[ci].list.findIndex((d) => d.id === focusRef.current); if (ri >= 0) return { ci, ri }; }
        return null;
      };
      const cur = flatFind();
      const focusAt = (ci: number, ri: number) => {
        const c = cols[Math.max(0, Math.min(ci, cols.length - 1))];
        if (!c || !c.list.length) return;
        const d = c.list[Math.max(0, Math.min(ri, c.list.length - 1))];
        if (d) { setFocusId(d.id); requestAnimationFrame(() => document.querySelector(`[data-deal-card="${d.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })); }
      };
      const focused = cur ? cols[cur.ci].list[cur.ri] : null;

      const nav = (dci: number, dri: number) => {
        e.preventDefault();
        if (!cur) { focusAt(0, 0); return; }
        if (dci !== 0) {
          let ci = cur.ci + dci;
          while (ci >= 0 && ci < cols.length && !cols[ci].list.length) ci += dci;
          focusAt(ci, cur.ri);
        } else { focusAt(cur.ci, cur.ri + dri); }
      };

      switch (e.key) {
        case 'ArrowRight': nav(1, 0); break;
        case 'ArrowLeft': nav(-1, 0); break;
        case 'ArrowDown': nav(0, 1); break;
        case 'ArrowUp': nav(0, -1); break;
        case '?': e.preventDefault(); setShowKeys((v) => !v); break;
        case 'Escape': setShowKeys(false); break;
        default: {
          if (!focused) return;
          const compose = (kind: ComposerKind) => {
            const c = focused.contacts[0];
            const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${focused.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
            openComposer({ dealId: focused.id, kind, to: kind === 'email' ? email : '+1 (415) 555-0140', subject: kind === 'email' ? `${focused.name} — next steps` : '', body: '', outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30', title: kind === 'task' ? String(focused.next ?? 'Follow up') : '' });
          };
          if (e.key === 'e') { e.preventDefault(); compose('email'); }
          else if (e.key === 'n') { e.preventDefault(); compose('note'); }
          else if (e.key === 'c') { e.preventDefault(); compose('call'); }
          else if (e.key === 't') { e.preventDefault(); compose('task'); }
          else if (e.key === 'a') {
            e.preventDefault();
            const order = ALL_BOARD_STAGES.slice(0, 5);
            const i = order.indexOf(focused.stage);
            if (i >= 0 && i < order.length - 1) requestStage(focused.id, order[i + 1]);
          }
          else if (e.key === 'o' || e.key === 'Enter') { e.preventDefault(); openDeal(focused.id); }
          else if (e.key === 'x') { e.preventDefault(); toggleBulk(focused.id); }
          else if (e.key === 'p') { e.preventDefault(); setPeek(focused.id); }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openComposer, requestStage, openDeal, toggleBulk, setPeek]);

  const onDrop = (stage: StageKey) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    requestStage(id, stage);
  };

  const colsFor = (subset: Deal[], laneKey?: string) => (
    <BoardColumns
      stages={visibleStages}
      deals={subset}
      dragId={dragId}
      overStage={overStage}
      laneKey={laneKey}
      focusId={focusId}
      setDragId={setDragId}
      setOverStage={setOverStage}
      onDrop={onDrop}
      compact={!!laneKey}
    />
  );

  let body: React.ReactNode;
  if (swimlane === 'owner') {
    const owners = Array.from(new Set(deals.map((d) => d.owner)));
    body = (
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
  } else if (swimlane === 'priority') {
    body = (
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
  } else {
    body = <div className={`dh-board ${kbCompact ? 'compact-cards' : ''}`}>{colsFor(deals)}</div>;
  }

  return (
    <>
      <BoardViewTabs />
      {boardEditing && <BoardEditBar />}
      {body}
      <BulkBar />
      <button className="dh-keys-hint" onClick={() => setShowKeys(true)} title="Keyboard shortcuts">
        <Icon name="command" size={13} /> Shortcuts <kbd>?</kbd>
      </button>
      {showKeys && <ShortcutsOverlay onClose={() => setShowKeys(false)} />}
    </>
  );
}

function BoardColumns({
  stages, deals, dragId, overStage, laneKey, focusId, setDragId, setOverStage, onDrop, compact,
}: {
  stages: BoardStageCfg[];
  deals: Deal[];
  dragId: string | null;
  overStage: string | null;
  laneKey?: string;
  focusId: string | null;
  setDragId: (id: string | null) => void;
  setOverStage: (s: string | null) => void;
  onDrop: (stage: StageKey) => void;
  compact?: boolean;
}) {
  const collapsedCols = useStore((s) => s.collapsedCols);
  const toggleColCollapse = useStore((s) => s.toggleColCollapse);
  const boardEditing = useStore((s) => s.boardEditing);
  const moveBoardStage = useStore((s) => s.moveBoardStage);
  const toggleBoardStageHidden = useStore((s) => s.toggleBoardStageHidden);
  const setBoardStageWip = useStore((s) => s.setBoardStageWip);
  const setBoardStageLabel = useStore((s) => s.setBoardStageLabel);

  return (
    <div className={`dh-cols ${compact ? 'compact' : ''}`}>
      {stages.map((cfg, si) => {
        const sk = cfg.k;
        const list = deals.filter((d) => d.stage === sk);
        const total = list.reduce((s, d) => s + d.value, 0);
        const hue = hueOf(sk);
        const overId = (laneKey ?? '') + sk;
        const isOver = overStage === overId && dragId;
        const collapsed = !laneKey && !boardEditing && collapsedCols[sk];
        const overWip = cfg.wip != null && list.length > cfg.wip;

        if (collapsed) {
          return (
            <button
              key={sk}
              className="dh-col-collapsed"
              style={{ ['--col-hue' as string]: hue }}
              onClick={() => toggleColCollapse(sk)}
              onDragOver={(e) => { e.preventDefault(); setOverStage(overId); }}
              onDrop={() => onDrop(sk)}
              title={`Expand ${labelOf(cfg)}`}
            >
              <span className="dh-col-dot" style={{ background: hue }} />
              <span className="dh-col-collapsed-name">{labelOf(cfg)}</span>
              <span className="dh-col-count">{list.length}</span>
            </button>
          );
        }

        return (
          <div
            key={sk}
            className={`dh-col ${isOver ? 'over' : ''} ${boardEditing ? 'editing' : ''} ${overWip ? 'over-wip' : ''}`}
            style={{ ['--col-hue' as string]: hue }}
            onDragOver={(e) => { e.preventDefault(); setOverStage(overId); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null); }}
            onDrop={() => onDrop(sk)}
          >
            {boardEditing && (
              <div className="dh-col-edit">
                <span className="dh-col-edit-grip"><Icon name="grip" size={13} /></span>
                <input className="dh-col-rename" value={labelOf(cfg)} onChange={(e) => setBoardStageLabel(sk, e.target.value)} title="Rename column (display only)" />
                <span className="dh-col-edit-ctrls">
                  <button onClick={() => moveBoardStage(sk, -1)} disabled={si === 0} title="Move left"><Icon name="arrowLeft" size={12} /></button>
                  <button onClick={() => moveBoardStage(sk, 1)} disabled={si === stages.length - 1} title="Move right"><Icon name="arrowRight" size={12} /></button>
                  <button onClick={() => toggleBoardStageHidden(sk)} title="Hide column"><Icon name="x" size={13} /></button>
                </span>
                <label className="dh-col-wip">WIP <input type="number" min={0} value={cfg.wip ?? ''} placeholder="∞" onChange={(e) => setBoardStageWip(sk, parseInt(e.target.value, 10) || 0)} /></label>
              </div>
            )}
            <div className="dh-col-head">
              <span className="dh-col-dot" style={{ background: hue }} />
              <span className="dh-col-name">{labelOf(cfg)}</span>
              <span className={`dh-col-count ${overWip ? 'over' : ''}`}>{cfg.wip != null ? `${list.length}/${cfg.wip}` : list.length}</span>
              <span className="dh-col-total mono">{money(total, true)}</span>
              {!laneKey && !boardEditing && (
                <button className="dh-col-collapse" onClick={() => toggleColCollapse(sk)} aria-label={`Collapse ${labelOf(cfg)}`} title="Collapse">
                  <Icon name="chevronLeft" size={14} />
                </button>
              )}
            </div>
            {overWip && <div className="dh-col-wip-warn"><Icon name="alert" size={11} /> Over WIP limit ({cfg.wip})</div>}
            <div className="dh-col-cards">
              {list.map((d) => (
                <DealCard
                  key={d.id}
                  deal={d}
                  focused={focusId === d.id}
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

function BoardEditBar() {
  const boardStages = useStore((s) => s.boardStages);
  const toggleBoardStageHidden = useStore((s) => s.toggleBoardStageHidden);
  const resetBoardStages = useStore((s) => s.resetBoardStages);
  const setBoardEditing = useStore((s) => s.setBoardEditing);
  const hidden = boardStages.filter((s) => s.hidden);
  return (
    <div className="dh-board-editbar">
      <div className="dh-board-editbar-left"><Icon name="grid" size={15} /> <b>Customize board</b> <span>Rename, reorder, hide columns or set WIP limits.</span></div>
      <div className="dh-board-editbar-right">
        {hidden.length > 0 && (
          <Popover align="end" width={210} trigger={({ toggle }) => <button className="dh-btn v-subtle s-sm" onClick={toggle}><Icon name="plus" size={14} /> Add column ({hidden.length})</button>}>
            {(close) => (<><div className="dh-menu-head">Hidden columns</div>{hidden.map((s) => (
              <button key={s.k} className="dh-menu-item" onClick={() => { toggleBoardStageHidden(s.k); close(); }}><span className="dh-menu-icon"><Icon name="plus" size={15} /></span>{labelOf(s)}</button>
            ))}</>)}
          </Popover>
        )}
        <button className="dh-btn v-ghost s-sm" onClick={resetBoardStages}><Icon name="reset" size={14} /> Reset</button>
        <button className="dh-btn v-primary s-sm" onClick={() => setBoardEditing(false)}><Icon name="check" size={14} /> Done</button>
      </div>
    </div>
  );
}

function BoardViewTabs() {
  const boardViews = useStore((s) => s.boardViews);
  const applyBoardView = useStore((s) => s.applyBoardView);
  const deleteBoardView = useStore((s) => s.deleteBoardView);
  if (!boardViews.length) return null;
  return (
    <div className="dh-view-tabs board">
      {boardViews.map((v) => (
        <span key={v.name} className="dh-view-tab">
          <button className="dh-view-apply" onClick={() => applyBoardView(v.name)}>{v.name}</button>
          <button className="dh-view-del" onClick={() => deleteBoardView(v.name)} aria-label={`Delete ${v.name}`}><Icon name="x" size={12} /></button>
        </span>
      ))}
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const KEYS: [string, string][] = [
    ['↑ ↓ ← →', 'Move focus between cards'],
    ['e / n / c / t', 'Email · Note · Call · Task on focused card'],
    ['a', 'Advance focused card to next stage'],
    ['o / Enter', 'Open the focused deal'],
    ['p', 'Quick preview'],
    ['x', 'Select / deselect for bulk'],
    ['⌘K', 'Command palette'],
    ['?', 'Toggle this help'],
  ];
  return (
    <div className="dh-keys-scrim" onMouseDown={onClose}>
      <div className="dh-keys-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh-keys-head"><Icon name="command" size={16} /> <b>Keyboard shortcuts</b><button className="dh-icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <div className="dh-keys-list">
          {KEYS.map(([k, l]) => (
            <div key={k} className="dh-keys-row"><kbd>{k}</kbd><span>{l}</span></div>
          ))}
        </div>
      </div>
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
