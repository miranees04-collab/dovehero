// ---------------------------------------------------------------------------
// Mock data layer for the CRM reporting dashboard prototype.
// One seeded in-memory dataset; every widget derives its numbers from it so
// global filters and refresh genuinely change what's on screen.
// ---------------------------------------------------------------------------

export const STAGES = ['Prospect', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Closed Won'] as const;
export const SOURCES = ['Organic', 'Paid', 'Referral', 'Outbound', 'Partner'] as const;
export const PIPELINES = ['New Business', 'Renewals'] as const;

export type Source = (typeof SOURCES)[number];
export type Pipeline = (typeof PIPELINES)[number];
export type DealStatus = 'open' | 'won' | 'lost';

export interface Rep {
  id: string;
  name: string;
  initials: string;
  /** Quarterly quota in USD. */
  quota: number;
  /** Hidden skill factor, so the leaderboard has real spread. */
  winBoost: number;
}

export interface Deal {
  id: string;
  name: string;
  company: string;
  contact: string;
  owner: string; // Rep id
  source: Source;
  pipeline: Pipeline;
  amount: number; // USD (annual contract value)
  createdAt: number; // ms epoch
  closedAt: number | null;
  status: DealStatus;
  /** Current stage index for open deals; stage reached when closed. */
  stage: number;
  stageEnteredAt: number;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'lead';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  rep: string; // Rep id
  at: number; // ms epoch
  person: string;
  company: string;
}

export interface Dataset {
  deals: Deal[];
  activities: ActivityEvent[];
}

// --- Seeded PRNG -----------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic ±2.5% wobble used by per-tile "Refresh" so the prototype
 * feels live without regenerating the dataset. jit=0 → no wobble.
 */
export function wobble(value: number, salt: string, jit: number): number {
  if (!jit) return value;
  const r = mulberry32(hashStr(salt) + jit * 7919)();
  return value * (1 + (r - 0.5) * 0.05);
}

// --- Static entities -------------------------------------------------------

export const REPS: Rep[] = [
  { id: 'aisha', name: 'Aisha Patel', initials: 'AP', quota: 260_000, winBoost: 0.16 },
  { id: 'marcus', name: 'Marcus Webb', initials: 'MW', quota: 230_000, winBoost: 0.05 },
  { id: 'sofia', name: 'Sofia Reyes', initials: 'SR', quota: 220_000, winBoost: 0.1 },
  { id: 'daniel', name: 'Daniel Kowalski', initials: 'DK', quota: 200_000, winBoost: -0.06 },
  { id: 'priya', name: 'Priya Nair', initials: 'PN', quota: 190_000, winBoost: 0.02 },
  { id: 'tomas', name: 'Tomas Eriksen', initials: 'TE', quota: 180_000, winBoost: -0.11 },
];

export const TEAM_QUARTER_QUOTA = REPS.reduce((s, r) => s + r.quota, 0);

const COMPANIES = [
  'Northwind Analytics', 'Cloudpeak', 'Datalore Systems', 'Brightloop', 'Vectorly',
  'Quanta Metrics', 'Helios Software', 'Fernwood Labs', 'Optikon', 'Streamside',
  'Bluegrain', 'Parallax One', 'Kitefly', 'Modula Works', 'Signalhouse',
  'Arcline Digital', 'Coreplane', 'Tidewater Tech', 'Lumastack', 'Pinwheel HQ',
  'Gridform', 'Solvexa', 'Nimbus Ledger', 'Redshift Retail', 'Everport',
  'Talonic', 'Marblesoft', 'Osprey Cloud', 'Fieldnote', 'Zephyr Ops',
  'Cobalt Verse', 'Harborlight', 'Truename', 'Plexiform', 'Sablewood',
  'Ironvale', 'Mistral Apps', 'Kindling AI', 'Roverbase', 'Glassbridge',
];

const FIRST = ['Maya', 'Liam', 'Ava', 'Noah', 'Zoe', 'Ethan', 'Ines', 'Owen', 'Ruth', 'Felix', 'Nina', 'Jonas', 'Cara', 'Hugo', 'Elsa', 'Ravi', 'Wren', 'Kofi', 'Lena', 'Aldo'];
const LAST = ['Alvarez', 'Chen', 'Okafor', 'Novak', 'Bergman', 'Silva', 'Haddad', 'Kim', 'Moreau', 'Fischer', 'Rossi', 'Tanaka', 'Iversen', 'Mbeki', 'Duarte', 'Kaur', 'Olsen', 'Vargas', 'Petrov', 'Lindqvist'];

const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise'];

const DAY = 24 * 3600 * 1000;
export const MS_DAY = DAY;

// --- Generators -------------------------------------------------------------

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function weightedSource(rnd: () => number): Source {
  const r = rnd();
  if (r < 0.26) return 'Organic';
  if (r < 0.5) return 'Outbound';
  if (r < 0.68) return 'Paid';
  if (r < 0.86) return 'Referral';
  return 'Partner';
}

export function generateData(seed: number, now: number): Dataset {
  const rnd = mulberry32(seed);
  const deals: Deal[] = [];
  const N = 170;

  for (let i = 0; i < N; i++) {
    const rep = REPS[Math.floor(rnd() * REPS.length)];
    const pipeline: Pipeline = rnd() < 0.74 ? 'New Business' : 'Renewals';
    const source = weightedSource(rnd);
    // Recency-biased creation date over the past ~330 days.
    const ageDays = Math.pow(rnd(), 1.3) * 330;
    const createdAt = now - ageDays * DAY - rnd() * DAY * 0.9;
    // Log-normal-ish B2B SaaS ACV, roughly $9K–$140K.
    let amount = Math.exp(9.55 + rnd() * 1.55);
    if (pipeline === 'Renewals') amount *= 0.75 + rnd() * 0.5;
    if (source === 'Partner') amount *= 1.2;
    amount = Math.round(amount / 100) * 100;

    const cycleDays = 28 + rnd() * 80;
    const company = pick(rnd, COMPANIES);
    const contact = `${pick(rnd, FIRST)} ${pick(rnd, LAST)}`;
    const plan = pipeline === 'Renewals' ? 'Renewal' : pick(rnd, PLANS);
    const base: Omit<Deal, 'status' | 'stage' | 'closedAt' | 'stageEnteredAt'> = {
      id: `d${i}`,
      name: `${company} — ${plan}`,
      company,
      contact,
      owner: rep.id,
      source,
      pipeline,
      amount,
      createdAt,
    };

    if (ageDays > cycleDays) {
      // Deal has had time to resolve.
      const winP = (pipeline === 'Renewals' ? 0.72 : 0.4) + rep.winBoost;
      const won = rnd() < winP;
      const closedAt = createdAt + cycleDays * DAY;
      deals.push({
        ...base,
        status: won ? 'won' : 'lost',
        stage: won ? STAGES.length - 1 : 1 + Math.floor(rnd() * 4),
        closedAt,
        stageEnteredAt: closedAt,
      });
    } else {
      // Still open; stage advances with age relative to its cycle.
      const progress = ageDays / cycleDays;
      const stage = Math.min(4, Math.floor(progress * 5.4));
      const inStageDays = rnd() < 0.18 ? 21 + rnd() * 25 : rnd() * 18; // some deals are stuck
      deals.push({
        ...base,
        status: 'open',
        stage,
        closedAt: null,
        stageEnteredAt: now - Math.min(ageDays, inStageDays) * DAY,
      });
    }
  }

  // Activity stream for the last 14 days.
  const activities: ActivityEvent[] = [];
  let aid = 0;
  for (let d = 0; d < 14; d++) {
    const dayStart = startOfDay(now - d * DAY);
    const weekday = new Date(dayStart).getDay();
    const damp = weekday === 0 || weekday === 6 ? 0.25 : 1;
    for (const rep of REPS) {
      const counts: Array<[ActivityType, number]> = [
        ['call', Math.round((2 + rnd() * 7) * damp)],
        ['email', Math.round((4 + rnd() * 10) * damp)],
        ['meeting', Math.round(rnd() * 4 * damp)],
        ['lead', rnd() < 0.5 ? 1 : 0],
      ];
      // Working hours, but never in the future relative to "now".
      const daySpan = Math.max(3600 * 1000, Math.min(now, dayStart + 18 * 3600 * 1000) - dayStart);
      for (const [type, n] of counts) {
        for (let k = 0; k < n; k++) {
          activities.push({
            id: `a${aid++}`,
            type,
            rep: rep.id,
            at: dayStart + rnd() * daySpan,
            person: `${pick(rnd, FIRST)} ${pick(rnd, LAST)}`,
            company: pick(rnd, COMPANIES),
          });
        }
      }
    }
  }
  activities.sort((a, b) => b.at - a.at);

  return { deals, activities };
}

// --- Time & filtering -------------------------------------------------------

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type RangeKey = '30d' | '90d' | 'qtd' | 'ytd' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  qtd: 'This quarter',
  ytd: 'This year',
  all: 'All time',
};

export interface Bounds {
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
  days: number;
  /** False for 'all' — no comparable previous period. */
  hasPrev: boolean;
}

export function periodBounds(range: RangeKey, now: number): Bounds {
  const end = now;
  let start: number;
  if (range === '30d') start = now - 30 * DAY;
  else if (range === '90d') start = now - 90 * DAY;
  else if (range === 'qtd') {
    const d = new Date(now);
    start = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
  } else if (range === 'ytd') {
    start = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  } else {
    start = now - 400 * DAY;
  }
  const days = Math.max(1, (end - start) / DAY);
  return {
    start,
    end,
    prevStart: start - (end - start),
    prevEnd: start,
    days,
    hasPrev: range !== 'all',
  };
}

export interface Filters {
  range: RangeKey;
  owner: string; // 'all' or rep id
  pipeline: string; // 'all' or pipeline name
}

/** Owner + pipeline slice; the date range is applied per-metric via Bounds. */
export function sliceDeals(deals: Deal[], f: Filters): Deal[] {
  return deals.filter(
    (d) => (f.owner === 'all' || d.owner === f.owner) && (f.pipeline === 'all' || d.pipeline === f.pipeline),
  );
}

// --- Metric helpers ---------------------------------------------------------

export interface KpiSet {
  revenue: number;
  created: number;
  won: number;
  winRate: number | null; // null when nothing closed
  avgDeal: number | null;
  avgCycleDays: number | null;
}

export function kpisFor(deals: Deal[], a: number, b: number): KpiSet {
  const createdIn = deals.filter((d) => d.createdAt >= a && d.createdAt < b);
  const closedIn = deals.filter((d) => d.closedAt !== null && d.closedAt >= a && d.closedAt < b);
  const wonIn = closedIn.filter((d) => d.status === 'won');
  const revenue = wonIn.reduce((s, d) => s + d.amount, 0);
  const winRate = closedIn.length ? wonIn.length / closedIn.length : null;
  const avgDeal = wonIn.length ? revenue / wonIn.length : null;
  const avgCycleDays = wonIn.length
    ? wonIn.reduce((s, d) => s + ((d.closedAt as number) - d.createdAt) / DAY, 0) / wonIn.length
    : null;
  return { revenue, created: createdIn.length, won: wonIn.length, winRate, avgDeal, avgCycleDays };
}

/** Deals-that-reached-each-stage counts, for deals created in [a,b). */
export function funnelFor(deals: Deal[], a: number, b: number): number[] {
  const counts = STAGES.map(() => 0);
  for (const d of deals) {
    if (d.createdAt < a || d.createdAt >= b) continue;
    for (let s = 0; s <= d.stage; s++) counts[s]++;
  }
  return counts;
}

export interface WeekPoint {
  label: string;
  created: number;
  closedWon: number;
}

export function weeklySeries(deals: Deal[], a: number, b: number): WeekPoint[] {
  const weeks = Math.min(16, Math.max(4, Math.round((b - a) / (7 * DAY))));
  const step = (b - a) / weeks;
  const pts: WeekPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const w0 = a + i * step;
    const w1 = w0 + step;
    const label = new Date(w0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    pts.push({
      label,
      created: deals.filter((d) => d.createdAt >= w0 && d.createdAt < w1).length,
      closedWon: deals.filter((d) => d.status === 'won' && d.closedAt !== null && d.closedAt >= w0 && d.closedAt < w1).length,
    });
  }
  return pts;
}

export interface MonthPoint {
  label: string;
  mrr: number;
  arr: number;
  newCustomers: number;
  churned: number;
}

/** 12-month MRR walk seeded by real wins, plus new-vs-churned customer counts. */
export function mrrSeries(deals: Deal[], now: number, seed: number): MonthPoint[] {
  const rnd = mulberry32(seed + 101);
  const pts: MonthPoint[] = [];
  let mrr = 168_000;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    const m0 = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
    const m1 = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    const wins = deals.filter((x) => x.status === 'won' && x.closedAt !== null && x.closedAt >= m0 && x.closedAt < m1);
    const added = wins.reduce((s, x) => s + x.amount, 0) / 12;
    const churnRate = 0.011 + rnd() * 0.009;
    mrr = Math.max(40_000, mrr + added - mrr * churnRate);
    pts.push({
      label: new Date(m0).toLocaleDateString('en-US', { month: 'short' }),
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      newCustomers: wins.length,
      churned: Math.round(1 + rnd() * 4),
    });
  }
  return pts;
}

export const SOURCE_CAC: Record<Source, number> = {
  Organic: 4_200,
  Paid: 15_500,
  Referral: 5_600,
  Outbound: 11_800,
  Partner: 8_900,
};

// --- Formatting -------------------------------------------------------------

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function fmtMoneyFull(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function fmtPct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function relTime(t: number, now: number): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function daysIn(ms: number): number {
  return Math.floor(ms / DAY);
}
