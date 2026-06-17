import { useState } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Popover, MenuItem, Avatar, Button } from '@/components/ui/primitives';
import { OWNERS, OPEN_STAGES } from '@/data/constants';
import { money } from '@/lib/format';
import type { Priority, AdvRule } from '@/types';
import { uid } from '@/lib/format';
import './deals.css';

const ALL_TAGS = ['Enterprise', 'Expansion', 'Strategic', 'Renewal', 'Outbound', 'Inbound', 'At-risk'];
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
  const setPipeline = useStore((s) => s.setPipeline);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const swimlane = useStore((s) => s.swimlane);
  const setSwimlane = useStore((s) => s.setSwimlane);
  const cardFields = useStore((s) => s.cardFields);
  const toggleCardField = useStore((s) => s.toggleCardField);
  const view = useStore((s) => s.view);
  const pipelines = useStore((s) => s.pipelines);
  const deals = useStore((s) => s.deals);
  const setAdvFilter = useStore((s) => s.setAdvFilter);

  const all = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const open = all.filter((d) => OPEN_STAGES.includes(d.stage as never));
  const total = open.reduce((s, d) => s + d.value, 0);
  const weighted = Math.round(open.reduce((s, d) => s + (d.value * d.win) / 100, 0));

  const activeFilters =
    filters.owners.length + filters.priorities.length + filters.tags.length + (filters.minValue ? 1 : 0) + (filters.health !== 'any' ? 1 : 0) + filters.adv.length;

  const toggleArr = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="dh-pipebar">
      <div className="dh-pipe-tabs" role="tablist">
        {pipelines.map((p) => {
          const n = deals.filter((d) => d.pipeline === p.k && OPEN_STAGES.includes(d.stage as never)).length;
          return (
            <button
              key={p.k}
              role="tab"
              aria-selected={pipeline === p.k}
              className={`dh-pipe-tab ${pipeline === p.k ? 'on' : ''}`}
              onClick={() => setPipeline(p.k)}
            >
              <span className="dh-pipe-dot" style={{ background: p.hue }} />
              {p.name}
              <span className="dh-pipe-count">{n}</span>
            </button>
          );
        })}
        <PipelineManage />
      </div>

      <div className="dh-pipe-stats">
        <div className="dh-pipe-stat">
          <span className="v mono">{open.length}</span>
          <span className="l">open</span>
        </div>
        <div className="dh-pipe-stat">
          <span className="v mono">{money(total, true)}</span>
          <span className="l">pipeline</span>
        </div>
        <div className="dh-pipe-stat">
          <span className="v mono">{money(weighted, true)}</span>
          <span className="l">weighted</span>
        </div>
      </div>

      <div className="dh-pipe-actions">
        {view === 'board' && (
          <Popover
            align="end"
            trigger={({ toggle }) => (
              <button className={`dh-filter-btn ${swimlane !== 'none' ? 'active' : ''}`} onClick={toggle} title="Group board">
                <Icon name="layers" size={15} />
                <span className="hide-sm">{swimlane === 'owner' ? 'By owner' : swimlane === 'priority' ? 'By priority' : 'By stage'}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="dh-menu-head">Swimlanes</div>
                <MenuItem active={swimlane === 'none'} onClick={() => { setSwimlane('none'); close(); }}>Stage only</MenuItem>
                <MenuItem active={swimlane === 'owner'} onClick={() => { setSwimlane('owner'); close(); }}>By owner</MenuItem>
                <MenuItem active={swimlane === 'priority'} onClick={() => { setSwimlane('priority'); close(); }}>By priority</MenuItem>
              </>
            )}
          </Popover>
        )}

        {view === 'board' && (
          <Popover
            align="end"
            width={220}
            trigger={({ toggle }) => (
              <button className="dh-filter-btn" onClick={toggle} title="Customize cards">
                <Icon name="sliders" size={15} />
                <span className="hide-sm">Cards</span>
              </button>
            )}
          >
            {() => (
              <div className="dh-card-fields">
                <div className="dh-menu-head">Show on cards</div>
                {CARD_FIELD_OPTS.map((f) => (
                  <label key={f.k} className="dh-cardfield-row">
                    <input type="checkbox" checked={cardFields.includes(f.k)} onChange={() => toggleCardField(f.k)} />
                    {f.label}
                  </label>
                ))}
              </div>
            )}
          </Popover>
        )}

        <Popover
          align="end"
          width={260}
          trigger={({ toggle }) => (
            <button className={`dh-filter-btn ${activeFilters ? 'active' : ''}`} onClick={toggle}>
              <Icon name="filter" size={15} />
              <span className="hide-sm">Filter</span>
              {activeFilters > 0 && <span className="dh-filter-badge">{activeFilters}</span>}
            </button>
          )}
        >
          {() => (
            <div className="dh-filter-panel">
              <div className="dh-menu-head">Owner</div>
              <div className="dh-filter-owners">
                {Object.values(OWNERS).map((o) => (
                  <button
                    key={o.key}
                    className={`dh-filter-owner ${filters.owners.includes(o.key) ? 'on' : ''}`}
                    onClick={() => setFilters({ owners: toggleArr(filters.owners, o.key) })}
                    title={o.name}
                  >
                    <Avatar ownerKey={o.key} size={24} />
                  </button>
                ))}
              </div>

              <div className="dh-menu-head">Priority</div>
              <div className="dh-chip-row">
                {(['high', 'med', 'low'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    className={`dh-chip ${filters.priorities.includes(p) ? 'on' : ''}`}
                    onClick={() => setFilters({ priorities: toggleArr(filters.priorities, p) })}
                  >
                    {p === 'high' ? 'High' : p === 'med' ? 'Medium' : 'Low'}
                  </button>
                ))}
              </div>

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
                  <button key={t} className={`dh-chip ${filters.tags.includes(t) ? 'on' : ''}`} onClick={() => setFilters({ tags: toggleArr(filters.tags, t) })}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="dh-menu-head">Advanced conditions</div>
              <div className="dh-adv-rules">
                {filters.adv.map((r) => (
                  <AdvRuleRow key={r.id} rule={r} onChange={(nr) => setAdvFilter(filters.adv.map((x) => (x.id === r.id ? nr : x)))} onRemove={() => setAdvFilter(filters.adv.filter((x) => x.id !== r.id))} />
                ))}
                <button className="dh-adv-add" onClick={() => setAdvFilter([...filters.adv, { id: uid('r'), field: 'value', op: 'gt', value: '' }])}>
                  <Icon name="plus" size={13} /> Add condition
                </button>
              </div>

              {activeFilters > 0 && (
                <button className="dh-filter-clear" onClick={resetFilters}>
                  <Icon name="x" size={13} /> Clear filters
                </button>
              )}
            </div>
          )}
        </Popover>
      </div>
    </div>
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

function PipelineManage() {
  const pipelines = useStore((s) => s.pipelines);
  const deals = useStore((s) => s.deals);
  const addPipeline = useStore((s) => s.addPipeline);
  const renamePipeline = useStore((s) => s.renamePipeline);
  const deletePipeline = useStore((s) => s.deletePipeline);
  const recolorPipeline = useStore((s) => s.recolorPipeline);
  const [name, setName] = useState('');
  return (
    <Popover
      width={300}
      trigger={({ toggle }) => (
        <button className="dh-pipe-tab dh-pipe-add" onClick={toggle} title="Manage pipelines">
          <Icon name="plus" size={14} />
        </button>
      )}
    >
      {() => (
        <div className="dh-pipemanage">
          <div className="dh-menu-head">Manage pipelines</div>
          {pipelines.map((p) => {
            const n = deals.filter((d) => d.pipeline === p.k).length;
            return (
              <div key={p.k} className="dh-pm-row">
                <button className="dh-pm-dot" style={{ background: p.hue }} onClick={() => recolorPipeline(p.k)} title="Recolor" />
                <input className="dh-pm-name" value={p.name} onChange={(e) => renamePipeline(p.k, e.target.value)} />
                <span className="dh-pm-ct">{n}</span>
                <button className="dh-pm-del" disabled={pipelines.length <= 1} onClick={() => deletePipeline(p.k)} aria-label="Delete"><Icon name="trash" size={13} /></button>
              </div>
            );
          })}
          <div className="dh-pm-new">
            <input className="dh-input" placeholder="New pipeline name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { addPipeline(name); setName(''); } }} />
            <Button variant="primary" size="sm" disabled={!name.trim()} onClick={() => { addPipeline(name); setName(''); }}><Icon name="plus" size={13} /></Button>
          </div>
          <p className="dh-pm-note">Deleting a pipeline moves its deals to the first one.</p>
        </div>
      )}
    </Popover>
  );
}
