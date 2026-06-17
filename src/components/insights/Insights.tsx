import { useMemo } from 'react';
import { useStore, useFilteredDeals } from '@/store/useStore';
import type { Deal, StageKey } from '@/types';
import {
  STAGES,
  OPEN_STAGES,
  OWNERS,
  healthColor,
} from '@/data/constants';
import { money, pct } from '@/lib/format';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import './insights.css';

/* ---------------- helpers ---------------- */

const hueOfStage = (k: StageKey): string =>
  STAGES.find((s) => s.k === k)?.hue ?? '#94a3b8';

const isOpen = (d: Deal): boolean => OPEN_STAGES.includes(d.stage);

const weighted = (d: Deal): number => (d.value * d.win) / 100;

const monthOf = (close: string): string => (close.trim().split(/\s+/)[0] || '—');

/** Deterministic fabricated delta (−9..+14) seeded from a string. */
function pseudoDelta(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 24) - 9;
}

const MONTH_ORDER = ['Jun', 'Jul', 'Aug'];

interface OwnerRow {
  key: string;
  name: string;
  count: number;
  pipeline: number;
  weighted: number;
  winRate: number | null;
}

/* ---------------- section header ---------------- */

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="dh-ins-head">
      <span className="dh-ins-eyebrow">{eyebrow}</span>
      <h3 className="dh-ins-title">{title}</h3>
    </header>
  );
}

/* ---------------- component ---------------- */

export function Insights() {
  const deals = useFilteredDeals();
  const pipeline = useStore((s) => s.pipeline);

  const data = useMemo(() => {
    const scoped = deals.filter((d) => d.pipeline === pipeline);
    const open = scoped.filter(isOpen);
    const won = scoped.filter((d) => d.stage === 'Won');
    const lost = scoped.filter((d) => d.stage === 'Lost');

    const openValue = open.reduce((s, d) => s + d.value, 0);
    const weightedValue = open.reduce((s, d) => s + weighted(d), 0);
    const closedCount = won.length + lost.length;
    const winRate = closedCount > 0 ? (won.length / closedCount) * 100 : 0;
    const avgDeal = open.length > 0 ? openValue / open.length : 0;

    // by stage
    const byStage = OPEN_STAGES.map((k) => {
      const ds = open.filter((d) => d.stage === k);
      return {
        stage: k,
        hue: hueOfStage(k),
        count: ds.length,
        value: ds.reduce((s, d) => s + d.value, 0),
      };
    });
    const maxStageVal = Math.max(1, ...byStage.map((s) => s.value));

    // by close month (weighted)
    const monthMap = new Map<string, number>();
    open.forEach((d) => {
      const m = monthOf(d.close);
      monthMap.set(m, (monthMap.get(m) ?? 0) + weighted(d));
    });
    const months = [...monthMap.keys()].sort((a, b) => {
      const ia = MONTH_ORDER.indexOf(a);
      const ib = MONTH_ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    });
    const monthData = months.map((m) => ({ month: m, value: monthMap.get(m) ?? 0 }));
    const maxMonthVal = Math.max(1, ...monthData.map((m) => m.value));

    // leaderboard
    const owners: OwnerRow[] = Object.values(OWNERS).map((o) => {
      const mine = scoped.filter((d) => d.owner === o.key);
      const myOpen = mine.filter(isOpen);
      const myWon = mine.filter((d) => d.stage === 'Won').length;
      const myLost = mine.filter((d) => d.stage === 'Lost').length;
      const closed = myWon + myLost;
      return {
        key: o.key,
        name: o.name,
        count: myOpen.length,
        pipeline: myOpen.reduce((s, d) => s + d.value, 0),
        weighted: myOpen.reduce((s, d) => s + weighted(d), 0),
        winRate: closed > 0 ? (myWon / closed) * 100 : null,
      };
    });
    owners.sort((a, b) => b.weighted - a.weighted);
    const maxOwnerPipe = Math.max(1, ...owners.map((o) => o.pipeline));

    // health distribution (open deals)
    const healthy = open.filter((d) => d.health >= 70);
    const watch = open.filter((d) => d.health >= 45 && d.health < 70);
    const risk = open.filter((d) => d.health < 45);
    const riskValue = risk.reduce((s, d) => s + d.value, 0);

    return {
      openCount: open.length,
      openValue,
      weightedValue,
      winRate,
      avgDeal,
      wonCount: won.length,
      lostCount: lost.length,
      byStage,
      maxStageVal,
      monthData,
      maxMonthVal,
      owners,
      maxOwnerPipe,
      health: {
        healthy: healthy.length,
        watch: watch.length,
        risk: risk.length,
        total: open.length,
        riskValue,
      },
    };
  }, [deals, pipeline]);

  const kpis = [
    {
      label: 'Open pipeline',
      value: money(data.openValue, true),
      sub: `${data.openCount} open deals`,
      icon: 'dollar',
      tone: 'accent' as const,
      delta: pseudoDelta('open' + pipeline),
    },
    {
      label: 'Weighted forecast',
      value: money(data.weightedValue, true),
      sub: 'probability-adjusted',
      icon: 'target',
      tone: 'blue' as const,
      delta: pseudoDelta('fcst' + pipeline),
    },
    {
      label: 'Win rate',
      value: pct(data.winRate),
      sub: `${data.wonCount}W · ${data.lostCount}L`,
      icon: 'trendingUp',
      tone: 'green' as const,
      delta: pseudoDelta('win' + pipeline),
    },
    {
      label: 'Avg deal size',
      value: money(data.avgDeal, true),
      sub: 'across open deals',
      icon: 'zap',
      tone: 'violet' as const,
      delta: pseudoDelta('avg' + pipeline),
    },
  ];

  const h = data.health;
  const novaLine =
    h.risk > 0
      ? `${money(data.weightedValue, true)} weighted forecast in play — but ${h.risk} ${
          h.risk === 1 ? 'deal' : 'deals'
        } worth ${money(h.riskValue, true)} ${
          h.risk === 1 ? 'is' : 'are'
        } at risk. Re-engage now to protect the quarter.`
      : `${money(data.weightedValue, true)} weighted forecast across ${data.openCount} open ${
          data.openCount === 1 ? 'deal' : 'deals'
        } — no deals are currently at risk. Press your advantage on the top-weighted accounts.`;

  return (
    <div className="dh-insights">
      {/* KPI row */}
      <section className="dh-ins-kpis">
        {kpis.map((k) => (
          <div className="dh-ins-card dh-kpi" key={k.label}>
            <div className="dh-kpi-top">
              <span className="dh-kpi-eyebrow">{k.label}</span>
              <span className={`dh-kpi-chip tone-${k.tone}`}>
                <Icon name={k.icon} size={15} />
              </span>
            </div>
            <div className="dh-kpi-value mono">{k.value}</div>
            <div className="dh-kpi-sub">
              <span
                className={`dh-delta ${k.delta >= 0 ? 'up' : 'down'}`}
                title="vs. last period"
              >
                <Icon name={k.delta >= 0 ? 'trendingUp' : 'trendingDown'} size={12} />
                {Math.abs(k.delta)}%
              </span>
              <span className="dh-kpi-subtext">{k.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Nova insight */}
      <section className="dh-ins-card dh-nova-callout">
        <span className="dh-nova-icon">
          <Icon name="sparkles" size={16} />
        </span>
        <div className="dh-ins-nova-body">
          <span className="dh-nova-label">Nova insight</span>
          <p className="dh-ins-nova-text">{novaLine}</p>
        </div>
      </section>

      {/* Two-column: funnel + forecast */}
      <section className="dh-ins-grid-2">
        <div className="dh-ins-card">
          <SectionHead eyebrow="Distribution" title="Pipeline by stage" />
          <div className="dh-funnel">
            {data.byStage.map((s) => (
              <div className="dh-funnel-row" key={s.stage}>
                <div className="dh-funnel-meta">
                  <span className="dh-funnel-dot" style={{ background: s.hue }} />
                  <span className="dh-funnel-stage">{s.stage}</span>
                  <span className="dh-funnel-count mono">{s.count}</span>
                </div>
                <div className="dh-funnel-track">
                  <div
                    className="dh-funnel-bar"
                    style={{
                      width: `${(s.value / data.maxStageVal) * 100}%`,
                      background: s.hue,
                    }}
                  />
                  <span className="dh-funnel-val mono">{money(s.value, true)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dh-ins-card">
          <SectionHead eyebrow="Forecast" title="Weighted by close month" />
          {data.monthData.length === 0 ? (
            <div className="dh-empty">No open deals to forecast.</div>
          ) : (
            <div className="dh-fc-cols">
              {data.monthData.map((m) => (
                <div className="dh-col-item" key={m.month}>
                  <span className="dh-col-val mono">{money(m.value, true)}</span>
                  <div className="dh-col-track">
                    <div
                      className="dh-col-bar"
                      style={{ height: `${(m.value / data.maxMonthVal) * 100}%` }}
                    />
                  </div>
                  <span className="dh-col-label">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Two-column: leaderboard + health */}
      <section className="dh-ins-grid-2">
        <div className="dh-ins-card dh-lead-card">
          <SectionHead eyebrow="Team" title="Leaderboard by owner" />
          <div className="dh-lead">
            {data.owners.map((o, i) => (
              <div className="dh-lead-row" key={o.key}>
                <span className="dh-lead-rank mono">{i + 1}</span>
                <Avatar ownerKey={o.key} size={28} />
                <div className="dh-lead-main">
                  <div className="dh-lead-name-row">
                    <span className="dh-lead-name">{o.name}</span>
                    <span className="dh-lead-weighted mono">{money(o.weighted, true)}</span>
                  </div>
                  <div className="dh-lead-track">
                    <div
                      className="dh-lead-bar"
                      style={{ width: `${(o.pipeline / data.maxOwnerPipe) * 100}%` }}
                    />
                  </div>
                  <div className="dh-lead-stats">
                    <span>{o.count} open</span>
                    <span className="dh-dot-sep">·</span>
                    <span className="mono">{money(o.pipeline, true)}</span>
                    <span className="dh-dot-sep">·</span>
                    <span>{o.winRate == null ? '—' : pct(o.winRate)} win</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dh-ins-card">
          <SectionHead eyebrow="Risk" title="Deal health distribution" />
          <div className="dh-health-stack">
            {data.health.total === 0 ? (
              <div className="dh-empty">No open deals.</div>
            ) : (
              <>
                <div className="dh-ins-health-bar">
                  {h.healthy > 0 && (
                    <div
                      className="dh-health-seg"
                      style={{ flex: h.healthy, background: 'var(--green)' }}
                      title={`Healthy: ${h.healthy}`}
                    />
                  )}
                  {h.watch > 0 && (
                    <div
                      className="dh-health-seg"
                      style={{ flex: h.watch, background: 'var(--amber)' }}
                      title={`Watch: ${h.watch}`}
                    />
                  )}
                  {h.risk > 0 && (
                    <div
                      className="dh-health-seg"
                      style={{ flex: h.risk, background: 'var(--red)' }}
                      title={`At risk: ${h.risk}`}
                    />
                  )}
                </div>
                <div className="dh-health-legend">
                  <div className="dh-health-item">
                    <Badge tone="green">Healthy</Badge>
                    <span className="dh-health-n mono">{h.healthy}</span>
                    <span className="dh-health-hint">≥ 70</span>
                  </div>
                  <div className="dh-health-item">
                    <Badge tone="amber">Watch</Badge>
                    <span className="dh-health-n mono">{h.watch}</span>
                    <span className="dh-health-hint">45–69</span>
                  </div>
                  <div className="dh-health-item">
                    <Badge tone="red">At risk</Badge>
                    <span className="dh-health-n mono">{h.risk}</span>
                    <span className="dh-health-hint">&lt; 45</span>
                  </div>
                </div>
                {h.risk > 0 && (
                  <div className="dh-health-note">
                    <Icon name="alert" size={14} color={healthColor(30)} />
                    <span>
                      {money(h.riskValue, true)} of pipeline sits below the safe health line.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
