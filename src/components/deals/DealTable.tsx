import { useMemo } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import type { Deal } from '@/types';
import { OWNERS, hueOf, healthColor, healthBand } from '@/data/constants';
import { money, staleDays } from '@/lib/format';
import { Avatar } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { nextBestAction } from '@/lib/nova';
import './table.css';

interface Col {
  k: string;
  label: string;
  align?: 'right';
  width?: number;
}

const COLS: Col[] = [
  { k: 'name', label: 'Deal' },
  { k: 'stage', label: 'Stage', width: 130 },
  { k: 'value', label: 'Value', align: 'right', width: 110 },
  { k: 'win', label: 'Win %', align: 'right', width: 90 },
  { k: 'health', label: 'Health', width: 120 },
  { k: 'owner', label: 'Owner', width: 150 },
  { k: 'close', label: 'Close', width: 90 },
  { k: 'ai_next', label: 'Nova — next step', width: 260 },
];

function sortVal(d: Deal, k: string): number | string {
  switch (k) {
    case 'name':
      return d.name.toLowerCase();
    case 'stage':
      return ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].indexOf(d.stage);
    case 'owner':
      return OWNERS[d.owner]?.name ?? d.owner;
    case 'value':
      return d.value;
    case 'win':
      return d.win;
    case 'health':
      return d.health;
    case 'close':
      return d.close;
    default:
      return 0;
  }
}

export function DealTable() {
  const pipeline = useStore((s) => s.pipeline);
  const sort = useStore((s) => s.sort);
  const toggleSort = useStore((s) => s.toggleSort);
  const openDeal = useStore((s) => s.openDeal);
  const toast = useStore((s) => s.toast);
  const base = useFilteredDeals();

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

  const exportCsv = () => {
    const header = ['ID', 'Deal', 'Company', 'Stage', 'Value', 'Win%', 'Health', 'Owner', 'Close'];
    const lines = rows.map((d) =>
      [d.id, d.name, d.company, d.stage, d.value, d.win, d.health, OWNERS[d.owner]?.name ?? d.owner, d.close]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dovehero-deals.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} deals to CSV`, 'success');
  };

  return (
    <div className="dh-table-wrap">
      <div className="dh-table-toolbar">
        <span className="dh-table-count">{rows.length} deals</span>
        <button className="dh-filter-btn" onClick={exportCsv}>
          <Icon name="download" size={15} />
          <span className="hide-sm">Export CSV</span>
        </button>
      </div>
      <div className="dh-table-scroll">
        <table className="dh-table">
          <thead>
            <tr>
              {COLS.map((c) => {
                const active = sort[0]?.k === c.k;
                const sortable = c.k !== 'ai_next';
                return (
                  <th
                    key={c.k}
                    style={{ width: c.width, textAlign: c.align }}
                    className={`${active ? 'sorted' : ''} ${sortable ? 'sortable' : ''}`}
                    onClick={sortable ? () => toggleSort(c.k) : undefined}
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
            {rows.map((d) => {
              const hc = healthColor(d.health);
              const stale = staleDays(d.acts?.[0]?.w) >= 14 && d.stage !== 'Won';
              return (
                <tr key={d.id} onClick={() => openDeal(d.id)}>
                  <td>
                    <div className="dh-td-deal">
                      <span className={`dh-prio ${d.priority}`} />
                      <div>
                        <div className="dh-td-name">{d.name}</div>
                        <div className="dh-td-company">{d.company}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="dh-stage-pill" style={{ ['--pc' as string]: hueOf(d.stage) }}>
                      <span className="dot" />
                      {d.stage}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {d.value ? money(d.value) : '—'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {d.win}%
                  </td>
                  <td>
                    <div className="dh-td-health">
                      <div className="dh-health-bar">
                        <span style={{ width: `${d.health}%`, background: hc }} />
                      </div>
                      <span className="dh-health-val" style={{ color: hc }} title={healthBand(d.health)}>
                        {d.health}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="dh-td-owner">
                      <Avatar ownerKey={d.owner} size={22} />
                      <span>{OWNERS[d.owner]?.name ?? d.owner}</span>
                    </div>
                  </td>
                  <td className="dh-td-close">
                    {stale && <Icon name="clock" size={12} color="var(--amber)" />}
                    {d.close}
                  </td>
                  <td>
                    <div className="dh-td-next">
                      <Icon name="sparkles" size={12} color="var(--accent-500)" />
                      <span>{nextBestAction(d)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
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
