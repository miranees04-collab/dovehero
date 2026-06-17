import type { Deal } from '@/types';
import { OWNERS, OPEN_STAGES, healthBand } from '@/data/constants';
import { money, staleDays } from './format';

/** The single best next action Nova recommends for a deal. */
export function nextBestAction(d: Deal): string {
  if (d.stage === 'Won') return 'Kick off onboarding and hand to delivery.';
  if (d.stage === 'Lost') return 'Log the loss reason and schedule a 90-day nurture.';
  if (d.health < 45) return 'Re-engage the champion — this deal is going quiet.';
  const last = d.acts?.[0]?.w;
  if (staleDays(last) >= 14) return `No touch in ${staleDays(last)} days — send a check-in today.`;
  if (d.stage === 'Negotiation') return d.next || 'Send the order form for signature.';
  if (d.stage === 'Proposal') return d.next || 'Confirm the economic buyer and budget.';
  if (d.stage === 'Qualified') return d.next || 'Book a scoping call and map the buying group.';
  return d.next || 'Qualify budget, authority, need, and timeline.';
}

export function riskFactors(d: Deal): string[] {
  const out: string[] = [];
  if (d.health < 45) out.push('Health below threshold');
  if (staleDays(d.acts?.[0]?.w) >= 14) out.push(`${staleDays(d.acts?.[0]?.w)} days since last touch`);
  if (d.tags.includes('At-risk')) out.push('Flagged at-risk');
  const hasChampion = d.contacts.some((c) => c.r === 'Champion' && (c.s === 'Strong' || c.s === 'Medium'));
  if (!hasChampion) out.push('No active champion');
  const hasEB = d.contacts.some((c) => c.r === 'Economic buyer');
  if (!hasEB && (d.stage === 'Proposal' || d.stage === 'Negotiation')) out.push('Economic buyer not confirmed');
  return out;
}

export function dealSignals(d: Deal): { label: string; ok: boolean }[] {
  return [
    { label: 'Champion engaged', ok: d.contacts.some((c) => c.r === 'Champion' && c.s !== 'Dormant' && c.s !== 'Weak') },
    { label: 'Economic buyer identified', ok: d.contacts.some((c) => c.r === 'Economic buyer') },
    { label: 'Recent activity', ok: staleDays(d.acts?.[0]?.w) < 14 },
    { label: 'Healthy score', ok: d.health >= 70 },
    { label: 'Value scoped', ok: d.value > 0 },
  ];
}

export interface NovaReply {
  text: string;
  chips?: { label: string; action?: string }[];
}

/** Lightweight natural-language understanding over the pipeline. */
export function askNova(q: string, deals: Deal[]): NovaReply {
  const query = q.trim().toLowerCase();
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage as never));

  if (!query) {
    return { text: 'Ask me about your pipeline — risks, forecast, what to do next, or a specific account.' };
  }

  // Risk / at-risk
  if (/risk|at.?risk|slipping|stalled|quiet|cold/.test(query)) {
    const risky = open
      .filter((d) => d.health < 50 || staleDays(d.acts?.[0]?.w) >= 14)
      .sort((a, b) => a.health - b.health)
      .slice(0, 4);
    if (!risky.length) return { text: 'Nothing looks at-risk right now — every open deal has recent activity and healthy signals.' };
    const lines = risky.map((d) => `• ${d.name} (${d.company}) — health ${d.health}, ${money(d.value, true)}`);
    return {
      text: `${risky.length} deal${risky.length > 1 ? 's' : ''} need attention:\n${lines.join('\n')}\n\nWant me to draft re-engagement emails for these?`,
      chips: risky.slice(0, 3).map((d) => ({ label: `Open ${d.company}`, action: 'open:' + d.id })),
    };
  }

  // Forecast / total
  if (/forecast|how much|total|pipeline value|close|quota/.test(query)) {
    const total = open.reduce((s, d) => s + d.value, 0);
    const weighted = Math.round(open.reduce((s, d) => s + (d.value * d.win) / 100, 0));
    const commit = open.filter((d) => d.win >= 70).reduce((s, d) => s + d.value, 0);
    return {
      text: `Open pipeline is ${money(total)} across ${open.length} deals.\nWeighted forecast: ${money(weighted)}.\nCommit (≥70% win): ${money(commit)}.`,
      chips: [{ label: 'Open Insights', action: 'view:insights' }],
    };
  }

  // Best / top deals
  if (/best|top|biggest|hottest|most likely|highest/.test(query)) {
    const top = open.slice().sort((a, b) => b.win - a.win).slice(0, 3);
    const lines = top.map((d) => `• ${d.name} — ${d.win}% win, ${money(d.value, true)}`);
    return { text: `Your strongest open deals:\n${lines.join('\n')}` };
  }

  // What should I do / next
  if (/what.*(do|next|focus|priorit)|next best|today|prioritize/.test(query)) {
    const focus = open
      .slice()
      .sort((a, b) => b.value * b.win - a.value * a.win)
      .slice(0, 3);
    const lines = focus.map((d) => `• ${d.company}: ${nextBestAction(d)}`);
    return { text: `Here's where I'd spend today:\n${lines.join('\n')}` };
  }

  // Per-owner
  for (const key of Object.keys(OWNERS)) {
    const o = OWNERS[key];
    if (query.includes(o.name.toLowerCase()) || query.includes(o.name.split(' ')[0].toLowerCase())) {
      const theirs = open.filter((d) => d.owner === key);
      const total = theirs.reduce((s, d) => s + d.value, 0);
      return { text: `${o.name} owns ${theirs.length} open deals worth ${money(total)}.` };
    }
  }

  // Specific company / deal lookup
  const hit = deals.find((d) => query.includes(d.company.toLowerCase()) || query.includes(d.name.toLowerCase()));
  if (hit) {
    return {
      text: `${hit.name} — ${hit.company}\nStage: ${hit.stage} · ${money(hit.value)} · ${hit.win}% win\nHealth: ${hit.health} (${healthBand(hit.health)})\nNext: ${nextBestAction(hit)}`,
      chips: [{ label: `Open ${hit.company}`, action: 'open:' + hit.id }],
    };
  }

  return {
    text: "I can summarize your forecast, surface at-risk deals, tell you what to focus on today, or pull up any account. Try \"what's at risk?\" or \"forecast for this quarter\".",
    chips: [
      { label: "What's at risk?", action: 'ask:what is at risk' },
      { label: 'Forecast', action: 'ask:forecast' },
      { label: 'What should I do today?', action: 'ask:what should I focus on today' },
    ],
  };
}
