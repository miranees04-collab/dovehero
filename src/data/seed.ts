import type { Activity, Deal, PipelineKey, StageKey, Priority } from '@/types';
import { OWNERS } from './constants';

let actSeq = 0;
function A(
  type: Activity['type'],
  who: string,
  w: string,
  text: string,
  extra: Partial<Activity> = {},
): Activity {
  return { id: 'a' + ++actSeq, type, who, w, text, ...extra };
}

// Six hand-authored "hero" deals carry the narrative depth.
const HEROES: Deal[] = [
  {
    id: 'NX-401',
    name: 'Aurora Platform rollout',
    company: 'Northwind Robotics',
    industry: 'Manufacturing',
    stage: 'Negotiation',
    pipeline: 'sales',
    owner: 'AR',
    value: 142000,
    win: 74,
    health: 93,
    priority: 'high',
    tags: ['Enterprise', 'Expansion'],
    close: 'Aug 13',
    created: 'Apr 12',
    next: 'Counter-sign the order form with procurement',
    summary:
      'Late-stage and healthy — the buying group is complete, security cleared, and procurement is engaged. Nova tracks just ahead of the rep and matches prior closed-won patterns.',
    contacts: [
      { n: 'Renata Cole', r: 'Economic buyer', t: 'VP Engineering', s: 'Strong' },
      { n: 'Devin Hart', r: 'Champion', t: 'Platform Lead', s: 'Strong' },
      { n: 'Aria Solis', r: 'Influencer', t: 'Security Lead', s: 'Medium' },
    ],
    products: [
      { n: 'Aurora Platform — annual', v: 108000 },
      { n: 'Onboarding & migration', v: 34000 },
    ],
    docs: [
      { n: 'Order form v3.pdf', k: 'pdf' },
      { n: 'MSA redline.docx', k: 'doc' },
      { n: 'Security pack.pdf', k: 'pdf' },
    ],
    acts: [
      A('email', 'Devin Hart', '2h', 'Routing the order form to procurement now — should land today.', {
        subj: 'Re: Order form',
        chan: 'devin@northwind.io',
        dir: 'in',
        status: 'opened',
      }),
      A('whatsapp', 'Renata Cole', '5h', 'Looks good on our side, pushing internally 🚀', {
        chan: '+1 (415) 555-0148',
        dir: 'in',
      }),
      A('marketing', 'Nova', '1d', 'Opened "Aurora ROI" sequence — 3 of 4 emails opened, pricing page visited twice.', {
        chan: 'Aurora ROI · nurture',
      }),
      A('meeting', 'You', '2d', 'Final scoping call — agreed rollout plan and go-live date.', {
        chan: '45 min · Zoom',
      }),
      A('call', 'You', '4d', 'Procurement intro — confirmed paper process and signers.', { chan: '18 min' }),
      A('note', 'You', '5d', 'Renata wants a phased rollout across 3 regions; flagged to delivery.'),
      A('file', 'Devin Hart', '1w', 'Uploaded current architecture diagram.', { chan: 'architecture.pdf' }),
    ],
  },
  {
    id: 'NX-388',
    name: 'Fleet analytics pilot',
    company: 'Meridian Logistics',
    industry: 'Logistics',
    stage: 'Proposal',
    pipeline: 'sales',
    owner: 'AR',
    value: 84500,
    win: 58,
    health: 83,
    priority: 'low',
    tags: ['Strategic'],
    close: 'Aug 2',
    created: 'Apr 28',
    next: 'Confirm the economic buyer and budget',
    summary:
      'Strategic pilot with strong expansion upside. The champion is engaged and the ROI case landed; the open gap is a confirmed economic buyer before the full rollout.',
    contacts: [
      { n: 'Priya Anand', r: 'Champion', t: 'Fleet Manager', s: 'Strong' },
      { n: 'Dan Ortiz', r: 'Influencer', t: 'Ops Director', s: 'Medium' },
    ],
    products: [{ n: 'Fleet analytics — pilot', v: 84500 }],
    docs: [
      { n: 'Proposal v2.pdf', k: 'pdf' },
      { n: 'ROI model.xlsx', k: 'xls' },
    ],
    acts: [
      A('email', 'Priya Anand', '1d', 'ROI model looks right — sending to Dan for budget sign-off.', {
        subj: 'Re: ROI model',
        chan: 'priya@meridian.co',
        dir: 'in',
      }),
      A('meeting', 'You', '3d', 'Proposal walkthrough — positive, asked about onboarding time.', { chan: '30 min · Meet' }),
      A('marketing', 'Nova', '4d', 'Re-engaged via "Logistics benchmarks" — clicked the case study.', { chan: 'Benchmarks · drip' }),
      A('note', 'You', '5d', 'Need to identify who owns the budget line — Priya is champion only.'),
      A('task', 'You', '5d', 'Send security questionnaire response', { title: 'Send security questionnaire response', done: false, prio: 'med' }),
    ],
  },
  {
    id: 'NX-372',
    name: 'Renewal + 40 seats',
    company: 'Helios Retail Group',
    industry: 'Retail',
    stage: 'Proposal',
    pipeline: 'renewals',
    owner: 'AR',
    value: 59000,
    win: 66,
    health: 88,
    priority: 'low',
    tags: ['Renewal'],
    close: 'Jun 19',
    created: 'Apr 18',
    next: 'Confirm VP approval, then counter-sign',
    summary:
      'Healthy renewal with 40 added seats. A 20% discount tripped VP approval, now in flight. Procurement engaged and momentum is strong heading into close.',
    contacts: [
      { n: 'Owen Pierce', r: 'Economic buyer', t: 'VP Retail Ops', s: 'Strong' },
      { n: 'Rina Das', r: 'Champion', t: 'Ops Manager', s: 'Strong' },
    ],
    products: [
      { n: 'Platform renewal — annual', v: 47000 },
      { n: 'Additional seats (40)', v: 12000 },
    ],
    docs: [{ n: 'Renewal order form.pdf', k: 'pdf' }],
    acts: [
      A('whatsapp', 'Rina Das', '4h', 'Owen approved internally — go ahead and send paper 👍', { chan: '+44 7700 900812', dir: 'in' }),
      A('email', 'Nova', '1d', 'Drafted the renewal summary email for Owen — ready to review.', { subj: 'Renewal summary (draft)' }),
      A('meeting', 'You', '2d', 'Renewal review — agreed seat count, sent order form.', { chan: '25 min' }),
      A('note', 'Nova', '2d', 'Discount crossed 20% — VP approval requested automatically.'),
      A('marketing', 'Nova', '1w', 'Enrolled in "Expansion playbook" — opened seat-expansion guide.', { chan: 'Expansion · playbook' }),
    ],
  },
  {
    id: 'NX-355',
    name: 'Growth pilot + integration',
    company: 'Prestige Worldwide',
    industry: 'SaaS',
    stage: 'Negotiation',
    pipeline: 'sales',
    owner: 'AR',
    value: 49500,
    win: 81,
    health: 98,
    priority: 'med',
    tags: ['Outbound'],
    close: 'Jun 23',
    created: 'Apr 9',
    next: 'Send the order form for signature',
    summary:
      'A textbook deal — every buying signal confirmed, health at 98, verbal commit in hand. All that remains is paper. The highest-confidence open deal in the pipeline.',
    contacts: [
      { n: 'Helen Park', r: 'Economic buyer', t: 'VP Marketing', s: 'Strong' },
      { n: 'Tom Vance', r: 'Champion', t: 'Growth Lead', s: 'Strong' },
    ],
    products: [
      { n: 'Growth pilot — annual', v: 38000 },
      { n: 'Integration build', v: 11500 },
    ],
    docs: [
      { n: 'Order form.pdf', k: 'pdf' },
      { n: 'SOW.docx', k: 'doc' },
    ],
    acts: [
      A('whatsapp', 'Tom Vance', '3h', 'Helen is in — ready when you are 🎯', { chan: '+1 (212) 555-0190', dir: 'in' }),
      A('email', 'You', '1d', 'Sent order form + SOW for signature.', { subj: 'Order form for signature', dir: 'out' }),
      A('meeting', 'You', '1d', 'Negotiation call — terms agreed, awaiting paper.', { chan: '40 min' }),
      A('note', 'Nova', '1d', 'Health 98 — every MEDDIC signal confirmed.'),
      A('call', 'You', '3d', 'Pricing alignment — agreed on annual commit.', { chan: '22 min' }),
    ],
  },
  {
    id: 'NX-318',
    name: 'Platform license',
    company: 'Tyrell Energy',
    industry: 'Energy',
    stage: 'Negotiation',
    pipeline: 'sales',
    owner: 'LM',
    value: 57500,
    win: 33,
    health: 38,
    priority: 'low',
    tags: ['At-risk'],
    close: 'Jun 17',
    created: 'Mar 22',
    next: 'Re-engage the champion before this slips',
    summary:
      'Stalled and at risk — 21 days silent, a 20% discount pending VP approval, and an active competitor. The champion has gone dormant. Re-engagement is urgent before this slips.',
    contacts: [
      { n: 'Eldon Tyrell', r: 'Economic buyer', t: 'CEO', s: 'Weak' },
      { n: 'Rachael Stone', r: 'Champion', t: 'VP Product', s: 'Dormant' },
    ],
    products: [{ n: 'Platform license — annual', v: 57500 }],
    docs: [{ n: 'Draft contract.docx', k: 'doc' }],
    acts: [
      A('note', 'Nova', 'today', 'No activity in 21 days — deal is going quiet. Recommend executive escalation.'),
      A('email', 'You', '3w', 'Followed up on contract — no reply.', { subj: 'Checking in', chan: 'rachael@tyrell.com', dir: 'out' }),
      A('whatsapp', 'You', '3w', 'Hey Rachael, any update on the review? (delivered, unread)', { chan: '+1 (650) 555-0177', dir: 'out' }),
      A('note', 'Lena Moller', '3w', 'Champion mentioned a competing evaluation.'),
      A('meeting', 'You', '5w', 'Contract review — open items on data residency.', { chan: '35 min' }),
    ],
  },
  {
    id: 'NX-290',
    name: 'Seat expansion',
    company: 'Stark Industries',
    industry: 'Manufacturing',
    stage: 'Qualified',
    pipeline: 'sales',
    owner: 'AR',
    value: 61500,
    win: 44,
    health: 55,
    priority: 'med',
    tags: ['Outbound'],
    close: 'Jul 3',
    created: 'May 6',
    next: 'Scope the seat count with ops',
    summary:
      'A qualified expansion of an existing account. The champion is engaged and the economic buyer identified; next is scoping seat count and locking a timeline.',
    contacts: [
      { n: 'Pepper Potts', r: 'Economic buyer', t: 'COO', s: 'Strong' },
      { n: 'Happy Hogan', r: 'Champion', t: 'Ops Manager', s: 'Medium' },
    ],
    products: [{ n: 'Seat expansion — annual', v: 61500 }],
    docs: [{ n: 'Usage report.xlsx', k: 'xls' }],
    acts: [
      A('call', 'You', '4d', 'Qualification call — strong fit, mapping expansion scope.', { chan: '28 min' }),
      A('email', 'Happy Hogan', '6d', 'Shared current usage — ready to scope seats.', { subj: 'Usage numbers', chan: 'happy@stark.com', dir: 'in' }),
      A('marketing', 'Nova', '1w', 'Visited pricing 4× this week — high intent signal.', { chan: 'Web · intent' }),
      A('task', 'You', '1w', 'Build the seat-expansion proposal', { title: 'Build the seat-expansion proposal', done: false, prio: 'med' }),
    ],
  },
];

// ---- Seeded breadth generator (deterministic) ----
function mulberry(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(): Deal[] {
  const r = mulberry(424242);
  const pk = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const cos = [
    'Vantage Cloud', 'Orbit Health', 'Cobalt Bank', 'Lumen Media', 'Aster Foods',
    'Nimbus Freight', 'Pulse Telecom', 'Verge Energy', 'Kestrel Retail', 'Atlas Mfg',
    'Solaris Power', 'Drift Mobility', 'Onyx Security', 'Pine & Co', 'Halo Studios', 'Quartz Labs',
  ];
  const nm = ['Platform deal', 'Annual renewal', 'Seat expansion', 'Pilot program', 'Migration', 'Add-on bundle', 'Upsell', 'Multi-region rollout'];
  const out: Deal[] = [];
  let n = 200;
  for (let i = 0; i < 22; i++) {
    const st = pk<StageKey>(['Lead', 'Lead', 'Qualified', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']);
    const owner = pk(['AR', 'AR', 'LM', 'JP', 'RS', 'DV']);
    const co = pk(cos);
    const val = st === 'Lead' && r() > 0.5 ? 0 : Math.round(12 + r() * 120) * 1000;
    const health = Math.max(18, Math.min(99, Math.round(46 + r() * 52 - (st === 'Lost' ? 28 : 0))));
    const win = st === 'Won' ? 100 : st === 'Lost' ? 0 : Math.max(10, Math.min(94, Math.round(20 + r() * 68)));
    const prio = pk<Priority>(['high', 'med', 'med', 'low', 'low']);
    const tags = [pk(['Inbound', 'Outbound', 'Strategic', 'Enterprise', 'Expansion', 'Renewal'])];
    if (st !== 'Won' && health < 44 && r() > 0.5) tags.push('At-risk');
    const pipeline = pk<PipelineKey>(['sales', 'sales', 'sales', 'renewals', 'onboarding']);
    out.push({
      id: 'NX-' + n--,
      name: co.split(' ')[0] + ' — ' + pk(nm),
      company: co,
      industry: pk(['SaaS', 'Fintech', 'Retail', 'Energy', 'Media', 'Logistics']),
      stage: st,
      pipeline,
      owner,
      value: val,
      win,
      health,
      priority: prio,
      tags,
      close: pk(['Jun', 'Jul', 'Aug']) + ' ' + (1 + Math.floor(r() * 27)),
      created: pk(['Mar', 'Apr', 'May']) + ' ' + (1 + Math.floor(r() * 27)),
      next: r() > 0.3 ? pk(['Schedule next call', 'Send proposal', 'Confirm budget', 'Loop in champion', 'Follow up on pricing']) : null,
      summary: co + ' is in ' + st + '. ' + prio + ' priority, owned by ' + OWNERS[owner].name + '.',
      contacts: [{ n: pk(['Sam Okafor', 'Mia Tan', 'Leo Park', 'Nina Veil', 'Cole Ray']), r: pk(['Champion', 'Economic buyer', 'Influencer']), t: pk(['VP', 'Director', 'Manager']), s: pk(['Strong', 'Medium', 'Weak']) }],
      products: [{ n: 'Subscription — annual', v: val }],
      docs: val > 0 ? [{ n: 'Proposal.pdf', k: 'pdf' }] : [],
      acts: [A(pk(['email', 'call', 'note', 'meeting']), 'You', 1 + Math.floor(r() * 18) + 'd', 'Logged activity on this deal.')],
    });
  }
  return out;
}

export function seedDeals(): Deal[] {
  actSeq = 0;
  return [...HEROES, ...generate()];
}
