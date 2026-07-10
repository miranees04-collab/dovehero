// ---------------------------------------------------------------------------
// "AI" command-center layer. There is no LLM here — every insight is a
// deterministic rule over the in-memory dataset, written to read like an
// assistant briefing. This is what turns the reporting page into a command
// center: what happened, what needs attention, and what to do next.
// ---------------------------------------------------------------------------

import {
  REPS,
  STAGES,
  MS_DAY,
  kpisFor,
  fmtMoney,
  fmtPct,
  type Deal,
  type Bounds,
} from './data';
import type { CrossFilter } from './reportEngine';

export type Tone = 'good' | 'warn' | 'bad' | 'info';

export interface BriefItem {
  tone: Tone;
  text: string;
  cross?: CrossFilter;
}

export interface Recommendation {
  id: string;
  text: string;
  sub: string;
  action: string; // button label
}

const repName = (id: string) => REPS.find((r) => r.id === id)?.name ?? id;
const daysInStage = (d: Deal, now: number) => Math.floor((now - d.stageEnteredAt) / MS_DAY);

function openDeals(deals: Deal[]) {
  return deals.filter((d) => d.status === 'open');
}
function stuckDeals(deals: Deal[], now: number) {
  return openDeals(deals)
    .filter((d) => daysInStage(d, now) > 21)
    .sort((a, b) => b.amount - a.amount);
}
/** Recent, early-stage, sizeable open deals read as "high buying intent". */
function hotLeads(deals: Deal[], now: number) {
  return openDeals(deals)
    .filter((d) => d.stage <= 1 && d.amount > 45_000 && now - d.createdAt < 14 * MS_DAY)
    .sort((a, b) => b.amount - a.amount);
}

/** The morning brief: headline state of the business, most-urgent first. */
export function morningBrief(deals: Deal[], bounds: Bounds, now: number): BriefItem[] {
  const items: BriefItem[] = [];
  const cur = kpisFor(deals, bounds.start, bounds.end);
  const prev = kpisFor(deals, bounds.prevStart, bounds.prevEnd);

  // Revenue vs previous period.
  if (bounds.hasPrev && prev.revenue > 0) {
    const change = (cur.revenue - prev.revenue) / prev.revenue;
    const dir = change >= 0 ? 'up' : 'down';
    items.push({
      tone: change >= 0 ? 'good' : 'bad',
      text: `Closed-won revenue is ${dir} ${fmtPct(Math.abs(change))} vs the previous period — ${fmtMoney(cur.revenue)} from ${cur.won} deal${cur.won === 1 ? '' : 's'}.`,
    });
  } else {
    items.push({ tone: 'info', text: `${fmtMoney(cur.revenue)} closed-won so far this period across ${cur.won} deal${cur.won === 1 ? '' : 's'}.` });
  }

  // Win rate health.
  if (cur.winRate !== null) {
    items.push({
      tone: cur.winRate < 0.2 ? 'bad' : cur.winRate < 0.35 ? 'warn' : 'good',
      text: `Win rate is ${fmtPct(cur.winRate)}${cur.winRate < 0.2 ? ' — below the 20% healthy line.' : '.'}`,
    });
  }

  // Stuck deals.
  const stuck = stuckDeals(deals, now);
  if (stuck.length) {
    const val = stuck.reduce((s, d) => s + d.amount, 0);
    items.push({
      tone: stuck.length >= 5 ? 'bad' : 'warn',
      text: `${stuck.length} open deal${stuck.length === 1 ? '' : 's'} (${fmtMoney(val)}) ${stuck.length === 1 ? 'has' : 'have'} sat in-stage over 21 days — ${stuck[0].company} is the largest at ${fmtMoney(stuck[0].amount)}.`,
    });
  }

  // Hot leads / buying intent.
  const hot = hotLeads(deals, now);
  if (hot.length) {
    items.push({
      tone: 'good',
      text: `${hot.length} lead${hot.length === 1 ? '' : 's'} show high buying intent — new, sizeable, and early-stage. Prioritise ${hot[0].company}.`,
    });
  }

  // Follow-ups awaiting movement.
  const awaiting = openDeals(deals).filter((d) => daysInStage(d, now) > 10 && daysInStage(d, now) <= 21);
  if (awaiting.length) {
    items.push({ tone: 'warn', text: `${awaiting.length} deal${awaiting.length === 1 ? '' : 's'} ${awaiting.length === 1 ? 'is' : 'are'} awaiting a next step (10–21 days idle).` });
  }

  // Forecast from open pipeline × win rate.
  const openVal = openDeals(deals).reduce((s, d) => s + d.amount, 0);
  const wr = cur.winRate ?? 0.3;
  items.push({
    tone: 'info',
    text: `Open pipeline is ${fmtMoney(openVal)}; at the current ${fmtPct(wr)} win rate that forecasts ${fmtMoney(openVal * wr)} to close.`,
  });

  // Coverage risk.
  const quotaRemain = 1_480_000 - cur.revenue;
  if (quotaRemain > 0) {
    const cov = openVal / quotaRemain;
    if (cov < 3) items.push({ tone: 'bad', text: `Pipeline coverage is ${cov.toFixed(1)}× the remaining quota — below the 3× safety line.` });
  }

  return items;
}

/** Actionable next steps — the "what to work on next" queue. */
export function recommendations(deals: Deal[], now: number): Recommendation[] {
  const recs: Recommendation[] = [];
  const stuck = stuckDeals(deals, now);
  for (const d of stuck.slice(0, 3)) {
    recs.push({
      id: d.id,
      text: `Follow up on ${d.company}`,
      sub: `${fmtMoney(d.amount)} · ${daysInStage(d, now)} days in ${STAGES[d.stage]} · ${repName(d.owner)}`,
      action: 'Log a call',
    });
  }
  // Deals sitting in Demo that need a proposal.
  const demo = openDeals(deals)
    .filter((d) => d.stage === 2 && d.amount > 30_000)
    .sort((a, b) => b.amount - a.amount);
  for (const d of demo.slice(0, 2)) {
    recs.push({
      id: `prop-${d.id}`,
      text: `Send a proposal to ${d.company}`,
      sub: `${fmtMoney(d.amount)} · in Demo · ${repName(d.owner)}`,
      action: 'Draft proposal',
    });
  }
  // Hot lead outreach.
  for (const d of hotLeads(deals, now).slice(0, 2)) {
    recs.push({
      id: `hot-${d.id}`,
      text: `Reach out to ${d.company} while intent is high`,
      sub: `${fmtMoney(d.amount)} · new ${STAGES[d.stage]} lead · ${repName(d.owner)}`,
      action: 'Book meeting',
    });
  }
  return recs.slice(0, 6);
}

/** Tiny natural-language router over the dataset — canned, keyword-based. */
export function answerQuery(q: string, deals: Deal[], bounds: Bounds, now: number): string {
  const s = q.toLowerCase();
  const cur = kpisFor(deals, bounds.start, bounds.end);
  const openVal = openDeals(deals).reduce((sum, d) => sum + d.amount, 0);

  if (/win rate|winrate/.test(s)) return cur.winRate === null ? 'No deals have closed in this period yet.' : `Win rate is ${fmtPct(cur.winRate)} across ${cur.won} won of the deals closed this period.`;
  if (/top rep|best rep|leader|who.*(most|best)/.test(s)) {
    const board = REPS.map((r) => ({ r, val: deals.filter((d) => d.owner === r.id && d.status === 'won' && d.closedAt && d.closedAt >= bounds.start).reduce((sum, d) => sum + d.amount, 0) })).sort((a, b) => b.val - a.val);
    return board[0].val > 0 ? `${board[0].r.name} leads with ${fmtMoney(board[0].val)} closed-won this period.` : 'No closed-won revenue in this period yet.';
  }
  if (/pipeline|open deals/.test(s)) return `Open pipeline is ${fmtMoney(openVal)} across ${openDeals(deals).length} deals.`;
  if (/revenue|closed|won/.test(s)) return `Closed-won revenue is ${fmtMoney(cur.revenue)} from ${cur.won} deals this period.`;
  if (/forecast|project/.test(s)) { const wr = cur.winRate ?? 0.3; return `Forecast is ${fmtMoney(openVal * wr)} — open pipeline ${fmtMoney(openVal)} at a ${fmtPct(wr)} win rate.`; }
  if (/stuck|stall|idle/.test(s)) { const st = stuckDeals(deals, now); return `${st.length} deals are stuck (21+ days in-stage), worth ${fmtMoney(st.reduce((sum, d) => sum + d.amount, 0))}.`; }
  if (/deal size|average/.test(s)) return cur.avgDeal === null ? 'No won deals to average yet.' : `Average deal size is ${fmtMoney(cur.avgDeal)}.`;
  if (/created|new deal/.test(s)) return `${cur.created} deals were created this period.`;
  return "I can answer questions about win rate, pipeline, revenue, forecast, top rep, stuck deals, average deal size, and deals created. Try “what's my win rate?”";
}
