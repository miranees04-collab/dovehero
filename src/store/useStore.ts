import { useMemo } from 'react';
import { create } from 'zustand';
import type {
  Deal,
  StageKey,
  PipelineKey,
  DealView,
  FilterState,
  SortRule,
  Activity,
  ActivityType,
  ThemeMode,
  NovaMessage,
  Toast,
  ObjectDef,
  ObjectRecord,
  Priority,
} from '@/types';
import { seedDeals } from '@/data/seed';
import { OBJECT_DEFS, OWNERS, ME } from '@/data/constants';
import { askNova } from '@/lib/nova';
import { uid } from '@/lib/format';

const emptyFilters: FilterState = {
  owners: [],
  priorities: [],
  tags: [],
  minValue: null,
  health: 'any',
};

function seedObjectRecords(deals: Deal[]): Record<string, ObjectRecord[]> {
  const recs: Record<string, ObjectRecord[]> = {
    company: [],
    contact: [],
    product: [],
    lead: [],
    ticket: [],
    invoice: [],
  };
  const seenCo = new Set<string>();
  deals.forEach((d, i) => {
    if (!seenCo.has(d.company)) {
      seenCo.add(d.company);
      recs.company.push({
        id: 'CO-' + (recs.company.length + 1),
        name: d.company,
        industry: d.industry,
        employees: [80, 150, 420, 980, 2600, 8200][i % 6],
        region: ['North America', 'EMEA', 'APAC'][i % 3],
        domain: d.company.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com',
        owner: OWNERS[d.owner]?.name ?? '',
      });
    }
    d.contacts.forEach((c) => {
      if (recs.contact.length < 30) {
        recs.contact.push({
          id: 'CT-' + (recs.contact.length + 1),
          name: c.n,
          title: c.t,
          email: c.n.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + d.company.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com',
          company: d.company,
          role: c.r,
        });
      }
    });
  });
  const cats = ['Platform', 'Add-on', 'Service', 'Support'];
  ['Aurora Platform', 'Growth tier', 'Enterprise tier', 'Onboarding', 'Premium support', 'API add-on', 'Analytics add-on'].forEach((n, i) => {
    recs.product.push({ id: 'PR-' + (i + 1), name: n, sku: 'SKU-' + (100 + i), price: [48000, 72000, 120000, 9000, 12000, 7500, 6000][i], category: cats[i % cats.length], active: true });
  });
  ['Mara Quinn', 'Theo Blake', 'Ines Roy', 'Caleb Fox', 'Dahlia West'].forEach((n, i) => {
    recs.lead.push({ id: 'LD-' + (i + 1), name: n, company: ['Vantage Cloud', 'Orbit Health', 'Pulse Telecom', 'Halo Studios', 'Quartz Labs'][i], email: n.toLowerCase().replace(/\s+/g, '.') + '@example.com', source: ['Website', 'Referral', 'Event', 'Outbound', 'Ads'][i], status: ['New', 'Working', 'Qualified', 'New', 'Working'][i] });
  });
  ['Login SSO failing', 'Export to CSV slow', 'Webhook retries', 'Seat count mismatch'].forEach((n, i) => {
    recs.ticket.push({ id: 'TK-' + (i + 1), name: n, company: ['Helios Retail Group', 'Meridian Logistics', 'Stark Industries', 'Northwind Robotics'][i], priority: ['High', 'Medium', 'Urgent', 'Low'][i], status: ['Open', 'Pending', 'Open', 'Solved'][i] });
  });
  ['INV-2041', 'INV-2042', 'INV-2043'].forEach((n, i) => {
    recs.invoice.push({ id: 'IN-' + (i + 1), name: n, company: ['Northwind Robotics', 'Helios Retail Group', 'Prestige Worldwide'][i], amount: [108000, 47000, 38000][i], due: ['Jul 1', 'Jun 28', 'Jul 10'][i], paid: i === 2 });
  });
  return recs;
}

function initialTheme(): ThemeMode {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('dh-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'light';
}

export interface AppState {
  // data
  deals: Deal[];
  objects: ObjectDef[];
  objectRecords: Record<string, ObjectRecord[]>;

  // navigation
  nav: 'deals' | string; // 'deals' or an object key
  view: DealView;
  pipeline: PipelineKey | string;
  openDealId: string | null;
  openObjectId: string | null;

  // table / board controls
  q: string;
  filters: FilterState;
  sort: SortRule[];
  swimlane: 'none' | 'owner';

  // ui
  theme: ThemeMode;
  role: 'admin' | 'rep';
  paletteOpen: boolean;
  novaOpen: boolean;
  novaMessages: NovaMessage[];
  novaThinking: boolean;
  notifOpen: boolean;
  composer: ComposerState | null;
  toasts: Toast[];
  mobileNavOpen: boolean;

  // derived helpers stored as actions
  setNav: (nav: string) => void;
  setView: (v: DealView) => void;
  setPipeline: (p: string) => void;
  openDeal: (id: string | null) => void;
  openObject: (id: string | null) => void;
  setQuery: (q: string) => void;
  setFilters: (f: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleSort: (k: string) => void;
  setSwimlane: (s: 'none' | 'owner') => void;

  moveDeal: (id: string, stage: StageKey) => void;
  updateDeal: (id: string, patch: Partial<Deal>) => void;
  createDeal: (partial: Partial<Deal>) => string;
  addActivity: (dealId: string, act: Omit<Activity, 'id'>) => void;
  logActivity: (dealId: string, type: ActivityType, text: string, extra?: Partial<Activity>) => void;
  toggleTask: (dealId: string, actId: string) => void;

  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setPalette: (open: boolean) => void;
  setNova: (open: boolean) => void;
  sendNova: (text: string) => void;
  setNotif: (open: boolean) => void;
  setMobileNav: (open: boolean) => void;

  openComposer: (c: ComposerState) => void;
  closeComposer: () => void;
  sendComposer: () => void;

  addObjectRecord: (objKey: string, rec: ObjectRecord) => void;

  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;

  resetDemo: () => void;
}

export interface ComposerState {
  dealId: string;
  channel: 'email' | 'whatsapp' | 'sms';
  to: string;
  subject: string;
  body: string;
}

const seeded = seedDeals();

export const useStore = create<AppState>((set, get) => ({
  deals: seeded,
  objects: OBJECT_DEFS,
  objectRecords: seedObjectRecords(seeded),

  nav: 'deals',
  view: 'board',
  pipeline: 'sales',
  openDealId: null,
  openObjectId: null,

  q: '',
  filters: { ...emptyFilters },
  sort: [{ k: 'value', dir: -1 }],
  swimlane: 'none',

  theme: initialTheme(),
  role: 'admin',
  paletteOpen: false,
  novaOpen: false,
  novaMessages: [
    {
      id: uid('nova'),
      role: 'nova',
      text: `Morning, ${OWNERS[ME].name.split(' ')[0]}. Your pipeline looks healthy, but two deals are going quiet. Ask me what to focus on today.`,
      ts: Date.now(),
      chips: [
        { label: "What's at risk?", action: 'ask:what is at risk' },
        { label: 'Forecast', action: 'ask:forecast' },
      ],
    },
  ],
  novaThinking: false,
  notifOpen: false,
  composer: null,
  toasts: [],
  mobileNavOpen: false,

  setNav: (nav) => set({ nav, openDealId: null, openObjectId: null, mobileNavOpen: false }),
  setView: (view) => set({ view, openDealId: null }),
  setPipeline: (pipeline) => set({ pipeline }),
  openDeal: (openDealId) => set({ openDealId }),
  openObject: (openObjectId) => set({ openObjectId }),
  setQuery: (q) => set({ q }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: { ...emptyFilters } }),
  toggleSort: (k) =>
    set((s) => {
      const cur = s.sort[0];
      if (cur && cur.k === k) return { sort: [{ k, dir: cur.dir === 1 ? -1 : 1 }] };
      return { sort: [{ k, dir: -1 }] };
    }),
  setSwimlane: (swimlane) => set({ swimlane }),

  moveDeal: (id, stage) =>
    set((s) => ({
      deals: s.deals.map((d) => {
        if (d.id !== id) return d;
        const win = stage === 'Won' ? 100 : stage === 'Lost' ? 0 : d.win;
        return { ...d, stage, win };
      }),
    })),

  updateDeal: (id, patch) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

  createDeal: (partial) => {
    const id = uid('NX');
    const deal: Deal = {
      id,
      name: partial.name || 'New deal',
      company: partial.company || 'New company',
      industry: partial.industry || 'SaaS',
      stage: partial.stage || 'Lead',
      pipeline: (partial.pipeline as PipelineKey) || (get().pipeline as PipelineKey) || 'sales',
      owner: partial.owner || ME,
      value: partial.value ?? 0,
      win: partial.win ?? 20,
      health: partial.health ?? 60,
      priority: (partial.priority as Priority) || 'med',
      tags: partial.tags || [],
      close: partial.close || 'Aug 30',
      created: 'today',
      next: partial.next ?? 'Qualify budget, authority, need, timeline',
      summary: partial.summary || `${partial.company || 'New company'} just entered the pipeline.`,
      contacts: partial.contacts || [],
      products: partial.products || [],
      docs: partial.docs || [],
      acts: [{ id: uid('a'), type: 'note', who: 'You', w: 'today', text: 'Deal created.' }],
    };
    set((s) => ({ deals: [deal, ...s.deals] }));
    return id;
  },

  addActivity: (dealId, act) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId ? { ...d, acts: [{ id: uid('a'), ...act }, ...d.acts] } : d,
      ),
    })),

  logActivity: (dealId, type, text, extra = {}) => {
    get().addActivity(dealId, { type, who: 'You', w: 'now', text, dir: 'out', ...extra });
  },

  toggleTask: (dealId, actId) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId
          ? { ...d, acts: d.acts.map((a) => (a.id === actId ? { ...a, done: !a.done } : a)) }
          : d,
      ),
    })),

  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('dh-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setNova: (novaOpen) => set({ novaOpen }),
  setNotif: (notifOpen) => set({ notifOpen }),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),

  sendNova: (text) => {
    const userMsg: NovaMessage = { id: uid('nova'), role: 'user', text, ts: Date.now() };
    set((s) => ({ novaMessages: [...s.novaMessages, userMsg], novaThinking: true, novaOpen: true }));
    const deals = get().deals;
    window.setTimeout(() => {
      const reply = askNova(text, deals);
      const novaMsg: NovaMessage = {
        id: uid('nova'),
        role: 'nova',
        text: reply.text,
        chips: reply.chips,
        ts: Date.now(),
      };
      set((s) => ({ novaMessages: [...s.novaMessages, novaMsg], novaThinking: false }));
    }, 480);
  },

  openComposer: (composer) => set({ composer }),
  closeComposer: () => set({ composer: null }),
  sendComposer: () => {
    const c = get().composer;
    if (!c) return;
    const labelByChan = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' } as const;
    get().logActivity(c.dealId, c.channel, c.body.slice(0, 140) || `${labelByChan[c.channel]} sent`, {
      subj: c.channel === 'email' ? c.subject : undefined,
      chan: c.to,
      status: 'sent',
    });
    get().toast(`${labelByChan[c.channel]} sent to ${c.to}`, 'success');
    set({ composer: null });
  },

  addObjectRecord: (objKey, rec) =>
    set((s) => ({
      objectRecords: { ...s.objectRecords, [objKey]: [rec, ...(s.objectRecords[objKey] || [])] },
    })),

  toast: (text, tone = 'default') => {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetDemo: () => {
    const fresh = seedDeals();
    set({
      deals: fresh,
      objectRecords: seedObjectRecords(fresh),
      openDealId: null,
      openObjectId: null,
      nav: 'deals',
      view: 'board',
      filters: { ...emptyFilters },
      q: '',
    });
    get().toast('Demo data reset');
  },
}));

// ---- selectors ----
// Pure filter. NOTE: never call this directly inside useStore(selector) — it
// returns a fresh array each call and would trigger an infinite render loop.
// Use the memoized useFilteredDeals() hook instead.
export function filterDeals(deals: Deal[], q: string, f: FilterState): Deal[] {
  const query = q.trim().toLowerCase();
  return deals.filter((d) => {
    if (query && !(d.name + ' ' + d.company + ' ' + d.tags.join(' ')).toLowerCase().includes(query)) return false;
    if (f.owners.length && !f.owners.includes(d.owner)) return false;
    if (f.priorities.length && !f.priorities.includes(d.priority)) return false;
    if (f.tags.length && !f.tags.some((t) => d.tags.includes(t))) return false;
    if (f.minValue != null && d.value < f.minValue) return false;
    if (f.health === 'healthy' && d.health < 70) return false;
    if (f.health === 'risk' && d.health >= 45) return false;
    return true;
  });
}

/** Stable, memoized filtered-deals hook (safe for render). */
export function useFilteredDeals(): Deal[] {
  const deals = useStore((s) => s.deals);
  const q = useStore((s) => s.q);
  const filters = useStore((s) => s.filters);
  return useMemo(() => filterDeals(deals, q, filters), [deals, q, filters]);
}
