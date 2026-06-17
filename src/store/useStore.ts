import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  Density,
  GroupBy,
  Swimlane,
  SavedView,
  FieldDef,
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

export const DEFAULT_TABLE_COLS = ['name', 'stage', 'value', 'win', 'health', 'owner', 'close', 'ai_next'];
export const DEFAULT_CARD_FIELDS = ['health', 'tags', 'nova', 'value', 'win', 'owner'];

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
  swimlane: Swimlane;

  // customization
  tableCols: string[];
  density: Density;
  group: GroupBy;
  cardFields: string[];
  collapsedCols: Record<string, boolean>;
  savedViews: SavedView[];
  activeView: string | null;

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
  tasksOpen: boolean;
  hubOpen: boolean;

  // deal interactions
  cardMenuId: string | null;
  peekId: string | null;
  capture: { id: string; to: StageKey } | null;
  confettiAt: number;
  bulk: string[];

  // undo / redo history of the deals collection
  past: Deal[][];
  future: Deal[][];

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
  setSwimlane: (s: Swimlane) => void;

  setDensity: (d: Density) => void;
  setGroup: (g: GroupBy) => void;
  toggleTableCol: (k: string) => void;
  moveTableCol: (k: string, dir: -1 | 1) => void;
  toggleCardField: (k: string) => void;
  toggleColCollapse: (k: string) => void;
  saveView: (name: string) => void;
  applyView: (name: string) => void;
  deleteView: (name: string) => void;
  addField: (objKey: string, field: FieldDef) => void;
  removeField: (objKey: string, fieldKey: string) => void;
  addCustomObject: () => void;

  moveDeal: (id: string, stage: StageKey) => void;
  updateDeal: (id: string, patch: Partial<Deal>) => void;
  createDeal: (partial: Partial<Deal>) => string;
  addActivity: (dealId: string, act: Omit<Activity, 'id'>) => void;
  logActivity: (dealId: string, type: ActivityType, text: string, extra?: Partial<Activity>) => void;
  toggleTask: (dealId: string, actId: string) => void;
  toggleReminder: (dealId: string, actId: string) => void;
  duplicateDeal: (id: string) => void;
  deleteDeal: (id: string) => void;
  setDealPriority: (id: string, p: Priority) => void;
  setDealOwner: (id: string, owner: string) => void;
  requestStage: (id: string, to: StageKey) => void;
  applyCapture: (reason: string, note: string, amount?: number) => void;
  cancelCapture: () => void;
  setCardMenu: (id: string | null) => void;
  setPeek: (id: string | null) => void;
  toggleBulk: (id: string) => void;
  clearBulk: () => void;
  bulkStage: (to: StageKey) => void;
  bulkOwner: (owner: string) => void;
  bulkDelete: () => void;

  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setPalette: (open: boolean) => void;
  setNova: (open: boolean) => void;
  sendNova: (text: string) => void;
  setNotif: (open: boolean) => void;
  setMobileNav: (open: boolean) => void;
  setTasks: (open: boolean) => void;
  setHub: (open: boolean) => void;
  undo: () => void;
  redo: () => void;

  openComposer: (c: ComposerState) => void;
  closeComposer: () => void;
  sendComposer: () => void;

  addObjectRecord: (objKey: string, rec: ObjectRecord) => void;
  updateObjectRecord: (objKey: string, id: string, patch: Partial<ObjectRecord>) => void;

  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;

  resetDemo: () => void;
}

export type ComposerKind = 'note' | 'call' | 'task' | 'meeting' | 'email' | 'whatsapp' | 'sms';

export interface ComposerState {
  dealId: string;
  kind: ComposerKind;
  to?: string;
  subject?: string;
  body?: string;
  // call
  outcome?: 'Connected' | 'Voicemail' | 'No answer' | 'Busy';
  followup?: boolean;
  // task
  title?: string;
  due?: string;
  prio?: Priority;
  // meeting
  when?: string;
  dur?: string;
  loc?: string;
  // note
  pin?: boolean;
  reminder?: boolean;
  reminderTitle?: string;
}

const STAGE_GATES: Partial<Record<StageKey, string[]>> = {
  Proposal: ['amount'],
  Negotiation: ['amount', 'close'],
  Won: ['amount'],
};

const seeded = seedDeals();
const HISTORY_LIMIT = 40;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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

  tableCols: [...DEFAULT_TABLE_COLS],
  density: 'comfortable',
  group: 'none',
  cardFields: [...DEFAULT_CARD_FIELDS],
  collapsedCols: {},
  savedViews: [],
  activeView: null,

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
  tasksOpen: false,
  hubOpen: false,
  cardMenuId: null,
  peekId: null,
  capture: null,
  confettiAt: 0,
  bulk: [],
  past: [],
  future: [],

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

  setDensity: (density) => set({ density, activeView: null }),
  setGroup: (group) => set({ group, activeView: null }),
  toggleTableCol: (k) =>
    set((s) => {
      if (k === 'name') return {}; // name column is always present
      const has = s.tableCols.includes(k);
      const next = has ? s.tableCols.filter((c) => c !== k) : [...s.tableCols, k];
      return { tableCols: next, activeView: null };
    }),
  moveTableCol: (k, dir) =>
    set((s) => {
      const cols = [...s.tableCols];
      const i = cols.indexOf(k);
      const j = i + dir;
      if (i < 0 || j < 1 || j >= cols.length) return {}; // keep 'name' first
      [cols[i], cols[j]] = [cols[j], cols[i]];
      return { tableCols: cols, activeView: null };
    }),
  toggleCardField: (k) =>
    set((s) => ({
      cardFields: s.cardFields.includes(k) ? s.cardFields.filter((c) => c !== k) : [...s.cardFields, k],
    })),
  toggleColCollapse: (k) =>
    set((s) => ({ collapsedCols: { ...s.collapsedCols, [k]: !s.collapsedCols[k] } })),

  saveView: (name) =>
    set((s) => {
      const view: SavedView = {
        name,
        cols: [...s.tableCols],
        density: s.density,
        group: s.group,
        sort: JSON.parse(JSON.stringify(s.sort)),
        filters: JSON.parse(JSON.stringify(s.filters)),
      };
      const others = s.savedViews.filter((v) => v.name !== name);
      get().toast(`View “${name}” saved`, 'success');
      return { savedViews: [...others, view], activeView: name };
    }),
  applyView: (name) =>
    set((s) => {
      const v = s.savedViews.find((x) => x.name === name);
      if (!v) return {};
      return {
        tableCols: [...v.cols],
        density: v.density,
        group: v.group,
        sort: JSON.parse(JSON.stringify(v.sort)),
        filters: JSON.parse(JSON.stringify(v.filters)),
        activeView: name,
      };
    }),
  deleteView: (name) =>
    set((s) => ({
      savedViews: s.savedViews.filter((v) => v.name !== name),
      activeView: s.activeView === name ? null : s.activeView,
    })),

  addField: (objKey, field) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.k === objKey && !o.fields.some((f) => f.k === field.k) ? { ...o, fields: [...o.fields, field] } : o,
      ),
    })),
  removeField: (objKey, fieldKey) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.k === objKey ? { ...o, fields: o.fields.filter((f) => f.k === 'name' || f.k !== fieldKey) } : o,
      ),
    })),
  addCustomObject: () => {
    const n = get().objects.filter((o) => !o.system).length + 1;
    const key = 'custom' + (Date.now() % 100000);
    const def: ObjectDef = {
      k: key,
      name: 'Custom ' + n,
      plural: 'Custom ' + n,
      icon: 'box',
      system: false,
      fields: [
        { k: 'name', label: 'Name', type: 'text' },
        { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Archived'] },
        { k: 'notes', label: 'Notes', type: 'longtext' },
      ],
    };
    set((s) => ({ objects: [...s.objects, def], objectRecords: { ...s.objectRecords, [key]: [] }, nav: key, openObjectId: null }));
    get().toast('Custom object created', 'success');
  },

  moveDeal: (id, stage) =>
    set((s) => ({
      deals: s.deals.map((d) => {
        if (d.id !== id) return d;
        const win = stage === 'Won' ? 100 : stage === 'Lost' ? 0 : d.win;
        return { ...d, stage, win };
      }),
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    })),

  updateDeal: (id, patch) =>
    set((s) => ({
      deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    })),

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
    set((s) => ({ deals: [deal, ...s.deals], past: [...s.past, s.deals].slice(-HISTORY_LIMIT), future: [] }));
    return id;
  },

  addActivity: (dealId, act) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId ? { ...d, acts: [{ id: uid('a'), ...act }, ...d.acts] } : d,
      ),
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
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
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    })),

  toggleReminder: (dealId, actId) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              acts: d.acts.map((a) =>
                a.id === actId && a.reminder ? { ...a, reminder: { ...a.reminder, done: !a.reminder.done } } : a,
              ),
            }
          : d,
      ),
    })),

  duplicateDeal: (id) => {
    const o = get().deals.find((d) => d.id === id);
    if (!o) return;
    const copy: Deal = JSON.parse(JSON.stringify(o));
    copy.id = uid('NX');
    copy.name = o.name + ' (copy)';
    set((s) => {
      const i = s.deals.findIndex((d) => d.id === id);
      const next = s.deals.slice();
      next.splice(i + 1, 0, copy);
      return { deals: next, cardMenuId: null, past: [...s.past, s.deals].slice(-HISTORY_LIMIT), future: [] };
    });
    get().toast('Deal duplicated', 'success');
  },
  deleteDeal: (id) => {
    set((s) => ({
      deals: s.deals.filter((d) => d.id !== id),
      openDealId: s.openDealId === id ? null : s.openDealId,
      cardMenuId: null,
      peekId: null,
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    }));
    get().toast('Deal deleted', 'warn');
  },
  setDealPriority: (id, p) => {
    get().updateDeal(id, { priority: p });
    set({ cardMenuId: null });
  },
  setDealOwner: (id, owner) => {
    get().updateDeal(id, { owner });
    set({ cardMenuId: null });
  },

  requestStage: (id, to) => {
    const d = get().deals.find((x) => x.id === id);
    if (!d || d.stage === to) {
      set({ cardMenuId: null });
      return;
    }
    // stage gates
    const need = STAGE_GATES[to] || [];
    const missing: string[] = [];
    if (need.includes('amount') && !(d.value > 0)) missing.push('an amount');
    if (need.includes('close') && (!d.close || !String(d.close).trim())) missing.push('a close date');
    if (missing.length) {
      get().toast(`Add ${missing.join(' and ')} before moving to ${to}`, 'warn');
      set({ cardMenuId: null });
      return;
    }
    if (to === 'Won' || to === 'Lost') {
      set({ capture: { id, to }, cardMenuId: null });
      return;
    }
    get().moveDeal(id, to);
    set({ cardMenuId: null });
    get().toast(`Moved to ${to}`);
  },
  applyCapture: (reason, note, amount) => {
    const cap = get().capture;
    if (!cap) return;
    const patch: Partial<Deal> = { stage: cap.to, win: cap.to === 'Won' ? 100 : 0 };
    if (cap.to === 'Won' && amount && amount > 0) patch.value = amount;
    get().updateDeal(cap.id, patch);
    get().addActivity(cap.id, {
      type: 'note',
      who: 'You',
      w: 'now',
      text: `Stage moved to ${cap.to}${reason ? ' · ' + reason : ''}.${note ? ' ' + note : ''}`,
    });
    set({ capture: null });
    if (cap.to === 'Won') set({ confettiAt: Date.now() });
    get().toast(cap.to === 'Won' ? 'Deal won 🎉' : 'Marked lost', cap.to === 'Won' ? 'success' : 'warn');
  },
  cancelCapture: () => set({ capture: null }),
  setCardMenu: (cardMenuId) => set({ cardMenuId }),
  setPeek: (peekId) => set({ peekId }),

  toggleBulk: (id) =>
    set((s) => ({ bulk: s.bulk.includes(id) ? s.bulk.filter((x) => x !== id) : [...s.bulk, id] })),
  clearBulk: () => set({ bulk: [] }),
  bulkStage: (to) => {
    const ids = get().bulk;
    if (!ids.length) return;
    set((s) => ({
      deals: s.deals.map((d) =>
        ids.includes(d.id) ? { ...d, stage: to, win: to === 'Won' ? 100 : to === 'Lost' ? 0 : d.win } : d,
      ),
      bulk: [],
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    }));
    get().toast(`Moved ${ids.length} deals to ${to}`, 'success');
  },
  bulkOwner: (owner) => {
    const ids = get().bulk;
    if (!ids.length) return;
    set((s) => ({
      deals: s.deals.map((d) => (ids.includes(d.id) ? { ...d, owner } : d)),
      bulk: [],
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    }));
    get().toast(`Reassigned ${ids.length} deals`, 'success');
  },
  bulkDelete: () => {
    const ids = get().bulk;
    if (!ids.length) return;
    set((s) => ({
      deals: s.deals.filter((d) => !ids.includes(d.id)),
      bulk: [],
      past: [...s.past, s.deals].slice(-HISTORY_LIMIT),
      future: [],
    }));
    get().toast(`Deleted ${ids.length} deals`, 'warn');
  },

  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      const prev = s.past[s.past.length - 1];
      return { deals: prev, past: s.past.slice(0, -1), future: [s.deals, ...s.future].slice(0, HISTORY_LIMIT) };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const next = s.future[0];
      return { deals: next, future: s.future.slice(1), past: [...s.past, s.deals].slice(-HISTORY_LIMIT) };
    }),

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
  setTasks: (tasksOpen) => set({ tasksOpen }),
  setHub: (hubOpen) => set({ hubOpen }),

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
    const dealId = c.dealId;
    const me = OWNERS[ME].name;
    switch (c.kind) {
      case 'note': {
        if (!c.body?.trim()) return get().toast('Write a note first', 'warn');
        get().addActivity(dealId, {
          type: 'note', who: 'You', w: 'now', text: c.body.trim(), pin: c.pin,
          ...(c.reminder && c.reminderTitle?.trim()
            ? { reminder: { title: c.reminderTitle.trim(), due: c.due || 'Tomorrow', done: false } }
            : {}),
        });
        get().toast(c.pin ? 'Note saved · pinned' : 'Note saved', 'success');
        break;
      }
      case 'call':
        get().addActivity(dealId, {
          type: 'call', who: 'You', w: 'now', outcome: c.outcome || 'Connected',
          text: c.body?.trim() || 'Logged a call.', dur: c.dur,
        });
        if (c.followup) {
          get().addActivity(dealId, { type: 'task', who: me, w: 'now', title: 'Follow up after call', ttype: 'todo', due: 'Tomorrow', prio: 'med', done: false });
        }
        get().toast(c.followup ? 'Call logged · follow-up set' : 'Call logged', 'success');
        break;
      case 'task':
        if (!c.title?.trim()) return get().toast('Name the task first', 'warn');
        get().addActivity(dealId, { type: 'task', who: me, w: 'now', title: c.title.trim(), ttype: 'todo', due: c.due || 'Tomorrow', prio: c.prio || 'med', done: false });
        get().toast('Task created', 'success');
        break;
      case 'meeting':
        if (!c.title?.trim()) return get().toast('Add a meeting title', 'warn');
        get().addActivity(dealId, {
          type: 'meeting', who: 'You', w: 'now', subj: c.title.trim(),
          when: c.when?.trim() || 'TBD', dur: c.dur || '30', provider: 'meet',
          link: 'meet.google.com/' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6),
          agenda: c.loc?.trim(),
        });
        get().toast('Meeting scheduled', 'success');
        break;
      case 'email': {
        if (!c.body?.trim()) return get().toast('Write the email first', 'warn');
        get().addActivity(dealId, {
          type: 'email', who: 'You', w: 'now', subj: c.subject?.trim() || '(no subject)', dir: 'out',
          status: 'sent', opens: 0, chan: c.to,
          thread: [{ dir: 'out', who: 'You', w: 'now', text: c.body.trim() }],
        });
        get().toast('Email sent · tracking on', 'success');
        break;
      }
      case 'whatsapp':
      case 'sms':
        if (!c.body?.trim()) return get().toast('Write a message first', 'warn');
        get().addActivity(dealId, {
          type: c.kind, who: 'You', w: 'now', chan: c.to,
          thread: [{ dir: 'out', who: 'You', w: 'now', text: c.body.trim() }],
        });
        get().toast(`${c.kind === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent`, 'success');
        break;
    }
    set({ composer: null });
  },

  addObjectRecord: (objKey, rec) =>
    set((s) => ({
      objectRecords: { ...s.objectRecords, [objKey]: [rec, ...(s.objectRecords[objKey] || [])] },
    })),
  updateObjectRecord: (objKey, id, patch) =>
    set((s) => ({
      objectRecords: {
        ...s.objectRecords,
        [objKey]: (s.objectRecords[objKey] || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
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
      objects: OBJECT_DEFS,
      objectRecords: seedObjectRecords(fresh),
      openDealId: null,
      openObjectId: null,
      nav: 'deals',
      view: 'board',
      filters: { ...emptyFilters },
      q: '',
      past: [],
      future: [],
    });
    get().toast('Demo data reset');
  },
    }),
    {
      name: 'dh-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Persist data + a couple of preferences; skip transient UI state.
      partialize: (s) => ({
        deals: s.deals,
        objects: s.objects,
        objectRecords: s.objectRecords,
        role: s.role,
        tableCols: s.tableCols,
        density: s.density,
        cardFields: s.cardFields,
        savedViews: s.savedViews,
      }),
    },
  ),
);

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
