import { useMemo, useState } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import type { Deal, GroupBy } from '@/types';
import { OWNERS, hueOf, healthColor, healthBand } from '@/data/constants';
import { money, staleDays } from '@/lib/format';
import { Avatar, Badge, Popover, MenuItem } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction, riskFactors } from '@/lib/nova';
import './table.css';

interface ColMeta {
  k: string;
  label: string;
  align?: 'right';
  width?: number;
  sortable?: boolean;
}

// Full registry of available columns (chooser + render).
export const ALL_COLS: ColMeta[] = [
  { k: 'name', label: 'Deal', sortable: true },
  { k: 'stage', label: 'Stage', width: 130, sortable: true },
  { k: 'value', label: 'Value', align: 'right', width: 110, sortable: true },
  { k: 'win', label: 'Win %', align: 'right', width: 88, sortable: true },
  { k: 'health', label: 'Health', width: 120, sortable: true },
  { k: 'owner', label: 'Owner', width: 150, sortable: true },
  { k: 'priority', label: 'Priority', width: 100, sortable: true },
  { k: 'industry', label: 'Industry', width: 120, sortable: true },
  { k: 'tags', label: 'Tags', width: 160 },
  { k: 'close', label: 'Close', width: 90, sortable: true },
  { k: 'created', label: 'Created', width: 90 },
  { k: 'ai_next', label: 'Nova — next step', width: 260 },
  { k: 'ai_risk', label: 'Nova — risk', width: 200 },
];
const colMeta = (k: string) => ALL_COLS.find((c) => c.k === k) ?? { k, label: k };

function sortVal(d: Deal, k: string): number | string {
  switch (k) {
    case 'name': return d.name.toLowerCase();
    case 'stage': return ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].indexOf(d.stage);
    case 'owner': return OWNERS[d.owner]?.name ?? d.owner;
    case 'priority': return { high: 3, med: 2, low: 1 }[d.priority] ?? 0;
    case 'value': return d.value;
    case 'win': return d.win;
    case 'health': return d.health;
    case 'industry': return d.industry;
    case 'close': return d.close;
    default: return 0;
  }
}

const groupOptions: { k: GroupBy; label: string }[] = [
  { k: 'none', label: 'No grouping' },
  { k: 'stage', label: 'Stage' },
  { k: 'owner', label: 'Owner' },
  { k: 'priority', label: 'Priority' },
];
function groupOf(d: Deal, g: GroupBy): string {
  if (g === 'stage') return d.stage;
  if (g === 'owner') return OWNERS[d.owner]?.name ?? d.owner;
  if (g === 'priority') return d.priority === 'high' ? 'High priority' : d.priority === 'med' ? 'Medium priority' : 'Low priority';
  return '';
}

export function DealTable() {
  const pipeline = useStore((s) => s.pipeline);
  const sort = useStore((s) => s.sort);
  const toggleSort = useStore((s) => s.toggleSort);
  const openDeal = useStore((s) => s.openDeal);
  const toast = useStore((s) => s.toast);
  const tableCols = useStore((s) => s.tableCols);
  const density = useStore((s) => s.density);
  const setDensity = useStore((s) => s.setDensity);
  const group = useStore((s) => s.group);
  const setGroup = useStore((s) => s.setGroup);
  const toggleTableCol = useStore((s) => s.toggleTableCol);
  const moveTableCol = useStore((s) => s.moveTableCol);
  const savedViews = useStore((s) => s.savedViews);
  const activeView = useStore((s) => s.activeView);
  const applyView = useStore((s) => s.applyView);
  const deleteView = useStore((s) => s.deleteView);
  const saveView = useStore((s) => s.saveView);
  const base = useFilteredDeals();
  const [viewName, setViewName] = useState('');

  const rows = useMemo(() => {
    const list = base.filter((d) => d.pipeline === pipeline);
    const s = sort[0];
    if (!s) return list;
    return list.slice().sort((a, b) => {
      const va = sortVal(a, s.k);
      const vb = sortVal(b, s.k);
      if (typeof va === 'string' || typeof vb === 'string') return s.dir * String(va).localeCompare(String(vb));
      return s.dir * ((va as number) - (vb as number));
    });
  }, [base, pipeline, sort]);

  const grouped = useMemo(() => {
    if (group === 'none') return [{ key: '', rows }];
    const map = new Map<string, Deal[]>();
    rows.forEach((d) => {
      const g = groupOf(d, group);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(d);
    });
    return [...map.entries()].map(([key, rs]) => ({ key, rows: rs }));
  }, [rows, group]);

  const cols = tableCols.map(colMeta);

  const exportCsv = () => {
    const header = ['ID', 'Deal', 'Company', 'Stage', 'Value', 'Win%', 'Health', 'Owner', 'Close'];
    const lines = rows.map((d) =>
      [d.id, d.name, d.company, d.stage, d.value, d.win, d.health, OWNERS[d.owner]?.name ?? d.owner, d.close]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dovehero-deals.csv'; a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} deals to CSV`, 'success');
  };

  return (
    <div className="dh-table-wrap">
      {/* Saved view tabs */}
      {savedViews.length > 0 && (
        <div className="dh-view-tabs">
          {savedViews.map((v) => (
            <span key={v.name} className={`dh-view-tab ${activeView === v.name ? 'on' : ''}`}>
              <button className="dh-view-apply" onClick={() => applyView(v.name)}>{v.name}</button>
              <button className="dh-view-del" onClick={() => deleteView(v.name)} aria-label={`Delete ${v.name}`}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="dh-table-toolbar">
        <span className="dh-table-count">{rows.length} deals</span>

        <div className="dh-table-tools">
          {/* Group by */}
          <Popover
            align="end"
            trigger={({ toggle }) => (
              <button className={`dh-filter-btn ${group !== 'none' ? 'active' : ''}`} onClick={toggle}>
                <Icon name="layers" size={15} />
                <span className="hide-sm">{group === 'none' ? 'Group' : `By ${group}`}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="dh-menu-head">Group rows by</div>
                {groupOptions.map((g) => (
                  <MenuItem key={g.k} active={group === g.k} onClick={() => { setGroup(g.k); close(); }}>
                    {g.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>

          {/* Density */}
          <button
            className="dh-filter-btn"
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            title="Toggle row density"
          >
            <Icon name={density === 'comfortable' ? 'list' : 'grid'} size={15} />
            <span className="hide-sm">{density === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
          </button>

          {/* Columns */}
          <Popover
            align="end"
            width={250}
            trigger={({ toggle }) => (
              <button className="dh-filter-btn" onClick={toggle}>
                <Icon name="sliders" size={15} />
                <span className="hide-sm">Columns</span>
              </button>
            )}
          >
            {() => (
              <div className="dh-col-chooser">
                <div className="dh-menu-head">Columns ({tableCols.length})</div>
                {ALL_COLS.map((c) => {
                  const on = tableCols.includes(c.k);
                  const idx = tableCols.indexOf(c.k);
                  return (
                    <div key={c.k} className="dh-col-choice">
                      <label className="dh-col-choice-label">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={c.k === 'name'}
                          onChange={() => toggleTableCol(c.k)}
                        />
                        {c.label}
                      </label>
                      {on && c.k !== 'name' && (
                        <span className="dh-col-move">
                          <button onClick={() => moveTableCol(c.k, -1)} disabled={idx <= 1} aria-label="Move left">
                            <Icon name="chevronLeft" size={13} />
                          </button>
                          <button onClick={() => moveTableCol(c.k, 1)} disabled={idx >= tableCols.length - 1} aria-label="Move right">
                            <Icon name="chevronRight" size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Popover>

          {/* Save view */}
          <Popover
            align="end"
            width={240}
            trigger={({ toggle }) => (
              <button className="dh-filter-btn" onClick={toggle} title="Save current view">
                <Icon name="star" size={15} />
                <span className="hide-sm">Save view</span>
              </button>
            )}
          >
            {(close) => (
              <div className="dh-saveview">
                <div className="dh-menu-head">Save this view</div>
                <input
                  className="dh-input"
                  placeholder="Name this view…"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && viewName.trim()) { saveView(viewName.trim()); setViewName(''); close(); }
                  }}
                  autoFocus
                />
                <button
                  className="dh-btn v-primary s-sm"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={!viewName.trim()}
                  onClick={() => { saveView(viewName.trim()); setViewName(''); close(); }}
                >
                  <Icon name="check" size={14} /> Save view
                </button>
                <p className="dh-saveview-note">Captures columns, density, grouping, sort and filters.</p>
              </div>
            )}
          </Popover>

          <button className="dh-filter-btn" onClick={exportCsv}>
            <Icon name="download" size={15} />
            <span className="hide-sm">Export</span>
          </button>
        </div>
      </div>

      <div className="dh-table-scroll">
        <table className={`dh-table density-${density}`}>
          <thead>
            <tr>
              {cols.map((c) => {
                const active = sort[0]?.k === c.k;
                return (
                  <th
                    key={c.k}
                    style={{ width: c.width, textAlign: c.align }}
                    className={`${active ? 'sorted' : ''} ${c.sortable ? 'sortable' : ''}`}
                    onClick={c.sortable ? () => toggleSort(c.k) : undefined}
                  >
                    <span className="dh-th">
                      {c.label}
                      {active && <Icon name="arrowUp" size={12} className={sort[0].dir === 1 ? 'dh-sort-asc' : 'dh-sort-desc'} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <GroupBlock key={g.key || 'all'} groupKey={g.key} rows={g.rows} cols={cols} group={group} openDeal={openDeal} />
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="dh-table-empty">
            <Icon name="list" size={22} />
            <span>No deals match your filters.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupBlock({
  groupKey, rows, cols, group, openDeal,
}: {
  groupKey: string;
  rows: Deal[];
  cols: ColMeta[];
  group: GroupBy;
  openDeal: (id: string) => void;
}) {
  const total = rows.reduce((s, d) => s + d.value, 0);
  return (
    <>
      {group !== 'none' && (
        <tr className="dh-group-row">
          <td colSpan={cols.length}>
            <div className="dh-group-head">
              <span className="dh-group-name">{groupKey}</span>
              <span className="dh-group-count">{rows.length}</span>
              <span className="dh-group-total mono">{money(total, true)}</span>
            </div>
          </td>
        </tr>
      )}
      {rows.map((d) => (
        <tr key={d.id} onClick={() => openDeal(d.id)}>
          {cols.map((c) => (
            <td key={c.k} style={{ textAlign: c.align }} className={c.k === 'value' ? 'mono' : ''}>
              <Cell deal={d} col={c.k} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Cell({ deal: d, col }: { deal: Deal; col: string }) {
  switch (col) {
    case 'name':
      return (
        <div className="dh-td-deal">
          <span className={`dh-prio ${d.priority}`} />
          <div>
            <div className="dh-td-name">{d.name}</div>
            <div className="dh-td-company">{d.company}</div>
          </div>
        </div>
      );
    case 'stage':
      return (
        <span className="dh-stage-pill" style={{ ['--pc' as string]: hueOf(d.stage) }}>
          <span className="dot" /> {d.stage}
        </span>
      );
    case 'value':
      return <span style={{ fontWeight: 600 }}>{d.value ? money(d.value) : '—'}</span>;
    case 'win':
      return <span className="mono">{d.win}%</span>;
    case 'health': {
      const hc = healthColor(d.health);
      return (
        <div className="dh-td-health">
          <div className="dh-health-bar"><span style={{ width: `${d.health}%`, background: hc }} /></div>
          <span className="dh-health-val" style={{ color: hc }} title={healthBand(d.health)}>{d.health}</span>
        </div>
      );
    }
    case 'owner':
      return (
        <div className="dh-td-owner">
          <Avatar ownerKey={d.owner} size={22} />
          <span>{OWNERS[d.owner]?.name ?? d.owner}</span>
        </div>
      );
    case 'priority':
      return <Badge tone={d.priority === 'high' ? 'red' : d.priority === 'med' ? 'amber' : 'neutral'}>{d.priority === 'high' ? 'High' : d.priority === 'med' ? 'Medium' : 'Low'}</Badge>;
    case 'industry':
      return <span>{d.industry}</span>;
    case 'tags':
      return (
        <div className="dh-td-tags">
          {d.tags.slice(0, 2).map((t) => (
            <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>
          ))}
        </div>
      );
    case 'close': {
      const stale = staleDays(d.acts?.[0]?.w) >= 14 && d.stage !== 'Won';
      return <span className="dh-td-close">{stale && <Icon name="clock" size={12} color="var(--amber)" />}{d.close}</span>;
    }
    case 'created':
      return <span className="dh-td-close">{d.created}</span>;
    case 'ai_next':
      return (
        <div className="dh-td-next">
          <Icon name="sparkles" size={12} color="var(--accent-500)" />
          <span>{nextBestAction(d)}</span>
        </div>
      );
    case 'ai_risk': {
      const r = riskFactors(d);
      return r.length ? (
        <div className="dh-td-next"><Icon name="alert" size={12} color="var(--red)" /><span>{r[0]}</span></div>
      ) : (
        <span className="dh-td-close" style={{ color: 'var(--green)' }}>On track</span>
      );
    }
    default:
      return <span>—</span>;
  }
}
