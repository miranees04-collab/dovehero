import { useState } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Popover, MenuItem, Avatar, Button } from '@/components/ui/primitives';
import { ReorderList } from '@/components/ui/ReorderList';
import { OWNERS, OPEN_STAGES, STAGES } from '@/data/constants';
import type { ReactNode } from 'react';
import { money, uid } from '@/lib/format';
import { inboundCount } from '@/lib/comms';
import type { Priority, AdvRule } from '@/types';
import './deals.css';

const ALL_TAGS = ['Enterprise', 'Expansion', 'Strategic', 'Renewal', 'Outbound', 'Inbound', 'At-risk'];
const BOARD_STAGE_KEYS = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

function Facet({ label, count, width, children }: { label: string; count: number; width?: number; children: (close: () => void) => ReactNode }) {
  return (
    <Popover
      width={width ?? 230}
      trigger={({ open: o, toggle }) => (
        <button className={`dh-facet-btn ${count ? 'active' : ''} ${o ? 'open' : ''}`} onClick={toggle}>
          {label}{count > 0 && <span className="dh-facet-ct">{count}</span>}
          <Icon name="chevronDown" size={12} />
        </button>
      )}
    >
      {children}
    </Popover>
  );
}

const CARD_FIELD_OPTS = [
  { k: 'health', label: 'Health score' },
  { k: 'tags', label: 'Tags' },
  { k: 'nova', label: 'Nova next step' },
  { k: 'value', label: 'Deal value' },
  { k: 'win', label: 'Win probability' },
  { k: 'owner', label: 'Owner' },
];

export function PipelineBar() {
  const pipeline = useStore((s) => s.pipeline);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const swimlane = useStore((s) => s.swimlane);
  const setSwimlane = useStore((s) => s.setSwimlane);
  const cardFields = useStore((s) => s.cardFields);
  const toggleCardField = useStore((s) => s.toggleCardField);
  const reorderCardFields = useStore((s) => s.reorderCardFields);
  const view = useStore((s) => s.view);
  const pipelines = useStore((s) => s.pipelines);
  const deals = useStore((s) => s.deals);
  const setAdvFilter = useStore((s) => s.setAdvFilter);
  const kbCompact = useStore((s) => s.kbCompact);
  const setKbCompact = useStore((s) => s.setKbCompact);
  const setAllCollapsed = useStore((s) => s.setAllCollapsed);
  const collapsedCols = useStore((s) => s.collapsedCols);
  const boardEditing = useStore((s) => s.boardEditing);
  const setBoardEditing = useStore((s) => s.setBoardEditing);
  const saveBoardView = useStore((s) => s.saveBoardView);
  const [boardViewName, setBoardViewName] = useState('');
  const allCollapsed = BOARD_STAGE_KEYS.every((k) => collapsedCols[k]);

  const all = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const open = all.filter((d) => OPEN_STAGES.includes(d.stage as never));
  const total = open.reduce((s, d) => s + d.value, 0);
  const weighted = Math.round(open.reduce((s, d) => s + (d.value * d.win) / 100, 0));
  const inboundTotal = deals.filter((d) => d.pipeline === pipeline).reduce((s, d) => s + inboundCount(d), 0);

  const activeFilters =
    filters.owners.length + filters.stages.length + filters.priorities.length + filters.tags.length + (filters.minValue ? 1 : 0) + (filters.health !== 'any' ? 1 : 0) + filters.adv.length + (filters.inbox ? 1 : 0);

  const toggleArr = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const curPipe = pipelines.find((p) => p.k === pipeline) ?? pipelines[0];

  return (
    <>
    <div className="dh-pipebar">
      <div className="dh-pipe-left">
        <span className="dh-pipe-label"><Icon name="layers" size={14} color="var(--violet)" /> Pipeline</span>
        <Popover
          width={300}
          trigger={({ open: o, toggle }) => (
            <button className={`dh-pipe-drop ${o ? 'open' : ''}`} onClick={toggle}>
              <span className="dh-pipe-dot" style={{ background: curPipe.hue }} />
              <b>{curPipe.name}</b>
              <span className="dh-pipe-count">{open.length}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        >
          {(close) => <PipelineMenu close={close} />}
        </Popover>
      </div>

      <div className="dh-pipe-kpis">
        <div className="dh-pipe-kpi">
          <span className="l">Open deals</span>
          <span className="v mono">{open.length}</span>
        </div>
        <div className="dh-pipe-kpi">
          <span className="l">Pipeline value</span>
          <span className="v mono">{money(total)}</span>
        </div>
        <div className="dh-pipe-kpi">
          <span className="l">Weighted</span>
          <span className="v mono" style={{ color: 'var(--violet)' }}>{money(weighted)}</span>
        </div>
      </div>
    </div>

    <div className="dh-controlbar">
      <span className="dh-pipe-label"><Icon name="filter" size={13} /> Filter</span>
      <div className="dh-facets">
        {inboundTotal > 0 && (
          <button
            className={`dh-inbox-btn ${filters.inbox ? 'on' : ''}`}
            onClick={() => setFilters({ inbox: !filters.inbox })}
            title="Show only deals with new client replies"
          >
            <Icon name="chat" size={15} />
            <span className="hide-sm">New replies</span>
            <span className="dh-inbox-count">{inboundTotal}</span>
          </button>
        )}

        <Facet label="Owner" count={filters.owners.length}>
          {() => (
            <div className="dh-facet-owners">
              {Object.values(OWNERS).map((o) => (
                <button key={o.key} className={`dh-facet-owner ${filters.owners.includes(o.key) ? 'on' : ''}`} onClick={() => setFilters({ owners: toggleArr(filters.owners, o.key) })}>
                  <Avatar ownerKey={o.key} size={22} /> <span>{o.name}</span>
                  {filters.owners.includes(o.key) && <Icon name="check" size={14} color="var(--accent-600)" />}
                </button>
              ))}
            </div>
          )}
        </Facet>

        <Facet label="Stage" count={filters.stages.length}>
          {() => (
            <div className="dh-facet-list">
              {STAGES.map((s) => (
                <button key={s.k} className={`dh-facet-item ${filters.stages.includes(s.k) ? 'on' : ''}`} onClick={() => setFilters({ stages: toggleArr(filters.stages, s.k) })}>
                  <span className="dh-pm-dot static" style={{ background: s.hue }} /> {s.k}
                  {filters.stages.includes(s.k) && <Icon name="check" size={14} color="var(--accent-600)" />}
                </button>
              ))}
            </div>
          )}
        </Facet>

        <Facet label="Priority" count={filters.priorities.length}>
          {() => (
            <div className="dh-facet-list">
              {(['high', 'med', 'low'] as Priority[]).map((p) => (
                <button key={p} className={`dh-facet-item ${filters.priorities.includes(p) ? 'on' : ''}`} onClick={() => setFilters({ priorities: toggleArr(filters.priorities, p) })}>
                  <span className={`dh-prio ${p}`} style={{ marginTop: 0 }} /> {p === 'high' ? 'High' : p === 'med' ? 'Medium' : 'Low'}
                  {filters.priorities.includes(p) && <Icon name="check" size={14} color="var(--accent-600)" />}
                </button>
              ))}
            </div>
          )}
        </Facet>

        <Facet label="Advanced" count={filters.adv.length + (filters.health !== 'any' ? 1 : 0) + filters.tags.length} width={280}>
          {() => (
            <div className="dh-facet-adv">
              <div className="dh-menu-head">Health</div>
              <div className="dh-chip-row">
                {(['any', 'healthy', 'risk'] as const).map((h) => (
                  <button key={h} className={`dh-chip ${filters.health === h ? 'on' : ''}`} onClick={() => setFilters({ health: h })}>
                    {h === 'any' ? 'Any' : h === 'healthy' ? 'Healthy' : 'At risk'}
                  </button>
                ))}
              </div>
              <div className="dh-menu-head">Tags</div>
              <div className="dh-chip-row wrap">
                {ALL_TAGS.map((t) => (
                  <button key={t} className={`dh-chip ${filters.tags.includes(t) ? 'on' : ''}`} onClick={() => setFilters({ tags: toggleArr(filters.tags, t) })}>{t}</button>
                ))}
              </div>
              <div className="dh-menu-head">Conditions</div>
              <div className="dh-adv-rules">
                {filters.adv.map((r) => (
                  <AdvRuleRow key={r.id} rule={r} onChange={(nr) => setAdvFilter(filters.adv.map((x) => (x.id === r.id ? nr : x)))} onRemove={() => setAdvFilter(filters.adv.filter((x) => x.id !== r.id))} />
                ))}
                <button className="dh-adv-add" onClick={() => setAdvFilter([...filters.adv, { id: uid('r'), field: 'value', op: 'gt', value: '' }])}>
                  <Icon name="plus" size={13} /> Add condition
                </button>
              </div>
            </div>
          )}
        </Facet>

        {activeFilters > 0 && (
          <button className="dh-filter-clear inline" onClick={resetFilters}><Icon name="x" size={13} /> Clear</button>
        )}
      </div>

      {view === 'board' && (
        <div className="dh-board-controls">
          <Popover
            align="end"
            trigger={({ toggle }) => (
              <button className={`dh-ctl-btn ${swimlane !== 'none' ? 'active' : ''}`} onClick={toggle}>
                Swimlanes: <b>{swimlane === 'owner' ? 'Owner' : swimlane === 'priority' ? 'Priority' : 'None'}</b> <Icon name="chevronDown" size={12} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem active={swimlane === 'none'} onClick={() => { setSwimlane('none'); close(); }}>None</MenuItem>
                <MenuItem active={swimlane === 'owner'} onClick={() => { setSwimlane('owner'); close(); }}>By owner</MenuItem>
                <MenuItem active={swimlane === 'priority'} onClick={() => { setSwimlane('priority'); close(); }}>By priority</MenuItem>
              </>
            )}
          </Popover>
          <button className={`dh-ctl-btn ${kbCompact ? 'active' : ''}`} onClick={() => setKbCompact(!kbCompact)}>Compact</button>
          <button className="dh-ctl-btn" onClick={() => setAllCollapsed(BOARD_STAGE_KEYS, !allCollapsed)}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button>
          <button className={`dh-ctl-btn ${boardEditing ? 'active' : ''}`} onClick={() => setBoardEditing(!boardEditing)}><Icon name="grid" size={14} /> {boardEditing ? 'Done' : 'Customize'}</button>
          <Popover
            align="end"
            width={240}
            trigger={({ toggle }) => <button className="dh-ctl-btn" onClick={toggle} title="Save board view"><Icon name="star" size={14} /> Save view</button>}
          >
            {(close) => (
              <div className="dh-saveview">
                <div className="dh-menu-head">Save this board view</div>
                <input className="dh-input" placeholder="Name this view…" value={boardViewName} onChange={(e) => setBoardViewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && boardViewName.trim()) { saveBoardView(boardViewName.trim()); setBoardViewName(''); close(); } }} autoFocus />
                <button className="dh-btn v-primary s-sm" style={{ width: '100%', marginTop: 8 }} disabled={!boardViewName.trim()} onClick={() => { saveBoardView(boardViewName.trim()); setBoardViewName(''); close(); }}><Icon name="check" size={14} /> Save view</button>
                <p className="dh-saveview-note">Captures pipeline, swimlanes, compact and filters.</p>
              </div>
            )}
          </Popover>
          <Popover
            align="end"
            width={240}
            trigger={({ toggle }) => (
              <button className="dh-ctl-btn" onClick={toggle}><Icon name="sliders" size={14} /> Card layout</button>
            )}
          >
            {() => {
              const enabled = cardFields.filter((k) => CARD_FIELD_OPTS.some((o) => o.k === k));
              const disabled = CARD_FIELD_OPTS.filter((o) => !cardFields.includes(o.k));
              const labelOf = (k: string) => CARD_FIELD_OPTS.find((o) => o.k === k)?.label ?? k;
              return (
                <div className="dh-card-fields">
                  <div className="dh-menu-head">Drag to reorder · click to hide</div>
                  <ReorderList
                    items={enabled}
                    onReorder={reorderCardFields}
                    renderItem={(k) => (
                      <>
                        <span style={{ flex: 1, fontSize: 13 }}>{labelOf(k)}</span>
                        <button className="dh-cf-eye" onClick={() => toggleCardField(k)} title="Hide"><Icon name="eye" size={14} /></button>
                      </>
                    )}
                  />
                  {disabled.length > 0 && <div className="dh-menu-head">Hidden</div>}
                  {disabled.map((f) => (
                    <button key={f.k} className="dh-cf-add" onClick={() => toggleCardField(f.k)}>
                      <Icon name="plus" size={13} /> {f.label}
                    </button>
                  ))}
                </div>
              );
            }}
          </Popover>
        </div>
      )}
    </div>

    <div className="dh-statsrow">
      <span><b>{all.length}</b> deals</span>
      <span className="dot-sep" />
      <span><b className="mono">{money(total, true)}</b> open value</span>
      <span className="dot-sep" />
      <span><b className="mono">{money(all.length ? Math.round(all.reduce((s, d) => s + d.value, 0) / all.length) : 0, true)}</b> avg deal</span>
    </div>
    </>
  );
}

const FIELD_OPTS: { k: AdvRule['field']; label: string; numeric: boolean }[] = [
  { k: 'value', label: 'Value', numeric: true },
  { k: 'win', label: 'Win %', numeric: true },
  { k: 'health', label: 'Health', numeric: true },
  { k: 'stage', label: 'Stage', numeric: false },
  { k: 'industry', label: 'Industry', numeric: false },
  { k: 'company', label: 'Company', numeric: false },
];

function AdvRuleRow({ rule, onChange, onRemove }: { rule: AdvRule; onChange: (r: AdvRule) => void; onRemove: () => void }) {
  const meta = FIELD_OPTS.find((f) => f.k === rule.field)!;
  const ops = meta.numeric
    ? [['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤']]
    : [['is', 'is'], ['isnot', 'is not'], ['contains', 'contains']];
  return (
    <div className="dh-adv-row">
      <select className="dh-adv-sel" value={rule.field} onChange={(e) => { const f = e.target.value as AdvRule['field']; const num = FIELD_OPTS.find((x) => x.k === f)!.numeric; onChange({ ...rule, field: f, op: num ? 'gt' : 'is' }); }}>
        {FIELD_OPTS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
      </select>
      <select className="dh-adv-sel" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as AdvRule['op'] })}>
        {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className="dh-adv-in" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} placeholder={meta.numeric ? '0' : 'value'} />
      <button className="dh-adv-del" onClick={onRemove} aria-label="Remove condition"><Icon name="x" size={12} /></button>
    </div>
  );
}

function PipelineMenu({ close }: { close: () => void }) {
  const pipelines = useStore((s) => s.pipelines);
  const deals = useStore((s) => s.deals);
  const current = useStore((s) => s.pipeline);
  const setPipeline = useStore((s) => s.setPipeline);
  const addPipeline = useStore((s) => s.addPipeline);
  const renamePipeline = useStore((s) => s.renamePipeline);
  const deletePipeline = useStore((s) => s.deletePipeline);
  const recolorPipeline = useStore((s) => s.recolorPipeline);
  const [manage, setManage] = useState(false);
  const [name, setName] = useState('');
  return (
    <div className="dh-pipemanage">
      <div className="dh-menu-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {manage ? 'Manage pipelines' : 'Pipelines'}
        <button className="dh-pm-toggle" onClick={() => setManage((m) => !m)}>{manage ? 'Done' : 'Manage'}</button>
      </div>
      {pipelines.map((p) => {
        const n = deals.filter((d) => d.pipeline === p.k).length;
        if (manage) {
          return (
            <div key={p.k} className="dh-pm-row">
              <button className="dh-pm-dot" style={{ background: p.hue }} onClick={() => recolorPipeline(p.k)} title="Recolor" />
              <input className="dh-pm-name" value={p.name} onChange={(e) => renamePipeline(p.k, e.target.value)} />
              <span className="dh-pm-ct">{n}</span>
              <button className="dh-pm-del" disabled={pipelines.length <= 1} onClick={() => deletePipeline(p.k)} aria-label="Delete"><Icon name="trash" size={13} /></button>
            </div>
          );
        }
        return (
          <button key={p.k} className={`dh-pm-sel ${current === p.k ? 'on' : ''}`} onClick={() => { setPipeline(p.k); close(); }}>
            <span className="dh-pm-ck">{current === p.k && <Icon name="check" size={14} color="var(--accent-600)" />}</span>
            <span className="dh-pm-dot static" style={{ background: p.hue }} />
            <span className="dh-pm-sel-n">{p.name}</span>
            <span className="dh-pm-ct">{n}</span>
          </button>
        );
      })}
      {manage && (
        <div className="dh-pm-new">
          <input className="dh-input" placeholder="New pipeline name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { addPipeline(name); setName(''); } }} />
          <Button variant="primary" size="sm" disabled={!name.trim()} onClick={() => { addPipeline(name); setName(''); }}><Icon name="plus" size={13} /></Button>
        </div>
      )}
      {manage && <p className="dh-pm-note">Deleting a pipeline moves its deals to the first one.</p>}
    </div>
  );
}
