import { useStore, useFilteredDeals } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Popover, MenuItem, Avatar } from '@/components/ui/primitives';
import { PIPELINES, OWNERS, OPEN_STAGES } from '@/data/constants';
import { money } from '@/lib/format';
import type { Priority } from '@/types';
import './deals.css';

const ALL_TAGS = ['Enterprise', 'Expansion', 'Strategic', 'Renewal', 'Outbound', 'Inbound', 'At-risk'];

export function PipelineBar() {
  const pipeline = useStore((s) => s.pipeline);
  const setPipeline = useStore((s) => s.setPipeline);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const swimlane = useStore((s) => s.swimlane);
  const setSwimlane = useStore((s) => s.setSwimlane);
  const view = useStore((s) => s.view);

  const all = useFilteredDeals().filter((d) => d.pipeline === pipeline);
  const open = all.filter((d) => OPEN_STAGES.includes(d.stage as never));
  const total = open.reduce((s, d) => s + d.value, 0);
  const weighted = Math.round(open.reduce((s, d) => s + (d.value * d.win) / 100, 0));

  const activeFilters =
    filters.owners.length + filters.priorities.length + filters.tags.length + (filters.minValue ? 1 : 0) + (filters.health !== 'any' ? 1 : 0);

  const toggleArr = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="dh-pipebar">
      <div className="dh-pipe-tabs" role="tablist">
        {PIPELINES.map((p) => {
          const n = useStore.getState().deals.filter((d) => d.pipeline === p.k && OPEN_STAGES.includes(d.stage as never)).length;
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
              <button className="dh-filter-btn" onClick={toggle} title="Group board">
                <Icon name="layers" size={15} />
                <span className="hide-sm">{swimlane === 'owner' ? 'By owner' : 'By stage'}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="dh-menu-head">Group by</div>
                <MenuItem active={swimlane === 'none'} onClick={() => { setSwimlane('none'); close(); }}>Stage only</MenuItem>
                <MenuItem active={swimlane === 'owner'} onClick={() => { setSwimlane('owner'); close(); }}>Swimlanes by owner</MenuItem>
              </>
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
