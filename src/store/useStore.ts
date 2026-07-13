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
  Product,
  ProductStage,
  CustomProductType,
  SalesDoc,
  SalesDocKind,
  SalesLine,
  Payment,
  PaymentMethod,
  Subscription,
  Connector,
  Priority,
  Density,
  GroupBy,
  Swimlane,
  SavedView,
  FieldDef,
  Pipeline,
  Automation,
  DocItem,
} from '@/types';
import { seedDeals } from '@/data/seed';
import { seedProducts, seedSalesDocs, seedPayments, seedSubscriptions, seedConnectors, connectorDemoProducts, DOC_META, SUB_INTERVALS, PRODUCT_CATEGORIES } from '@/data/products';
import { OBJECT_DEFS, OWNERS, ME, PIPELINES, SEQUENCES } from '@/data/constants';
import { askNova, answerForDeal } from '@/lib/nova';
import { DEFAULT_COLOR_RULES, RULE_COLORS, type ColorRule } from '@/lib/colorRules';
import { uid } from '@/lib/format';
import { inboundCount, inboundByChannel } from '@/lib/comms';

const emptyFilters: FilterState = {
  owners: [],
  stages: [],
  priorities: [],
  tags: [],
  minValue: null,
  health: 'any',
  inbox: false,
  inboxChannel: null,
  adv: [],
};

const PIPE_HUES = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#EF4444'];

const DEFAULT_AUTOMATIONS: Automation[] = [
  { id: 'au1', name: 'Re-engage stale deals', enabled: true, on: { t: 'stale', v: '14' }, cond: { f: 'none', v: '' }, act: { t: 'task', v: 'Re-engage — deal has gone quiet' } },
  { id: 'au2', name: 'Flag big new deals', enabled: true, on: { t: 'created', v: '' }, cond: { f: 'value', v: '50000' }, act: { t: 'priority', v: 'high' } },
  { id: 'au3', name: 'Tag deals in negotiation', enabled: false, on: { t: 'stage', v: 'Negotiation' }, cond: { f: 'none', v: '' }, act: { t: 'tag', v: 'Closing' } },
];

function staleDaysOf(w: string | undefined): number {
  if (!w) return 99;
  if (/today|now/i.test(w)) return 0;
  const m = /(\d+)\s*([hdwm])/i.exec(w);
  if (!m) return 1;
  const n = +m[1], u = m[2].toLowerCase();
  return u === 'h' ? 0 : u === 'd' ? n : u === 'w' ? n * 7 : n * 30;
}

export const DEFAULT_TABLE_COLS = ['name', 'stage', 'value', 'win', 'health', 'owner', 'close', 'ai_next'];
export const DEFAULT_CARD_FIELDS = ['health', 'tags', 'nova', 'value', 'win', 'owner'];
export const DEFAULT_RECORD_SECTIONS = ['coach', 'signals', 'account', 'group', 'lineitems', 'quotes', 'contracts', 'invoices', 'attachments', 'tags'];

export type RecordCols = { standard: string[][]; tri: string[][] };
export const DEFAULT_RECORD_COLS: RecordCols = {
  standard: [
    ['nova', 'pulse'],
    ['coach', 'signals', 'account', 'group', 'lineitems', 'quotes', 'contracts', 'invoices', 'attachments', 'tags'],
  ],
  tri: [
    ['properties', 'account', 'group', 'lineitems'],
    ['nova', 'pulse'],
    ['coach', 'signals', 'quotes', 'contracts', 'invoices', 'attachments', 'tags'],
  ],
};
const cloneCols = (c: RecordCols): RecordCols => ({ standard: c.standard.map((x) => [...x]), tri: c.tri.map((x) => [...x]) });

export interface BoardStageCfg { k: StageKey; label?: string; wip?: number | null; hidden?: boolean }
export const DEFAULT_BOARD_STAGES: BoardStageCfg[] = [
  { k: 'Lead' }, { k: 'Qualified' }, { k: 'Proposal' }, { k: 'Negotiation' }, { k: 'Won' },
];
export interface BoardView { name: string; pipeline: string; swimlane: Swimlane; kbCompact: boolean; filters: FilterState }

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
  recs.product = seedProducts() as unknown as ObjectRecord[];
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
  productTypes: CustomProductType[];
  productCategories: string[];
  salesDocs: SalesDoc[];
  payments: Payment[];
  subscriptions: Subscription[];
  connectors: Connector[];
  pipelines: Pipeline[];
  automations: Automation[];

  // navigation
  nav: 'deals' | string; // 'deals' or an object key
  view: DealView;
  pipeline: PipelineKey | string;
  openDealId: string | null;
  openObjectId: string | null;
  recentDeals: string[];

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
  kbCompact: boolean;
  savedViews: SavedView[];
  activeView: string | null;
  recordLayout: 'standard' | 'tri';
  recordSections: string[];
  recordCols: RecordCols;
  recordHidden: string[];
  recordEditing: boolean;
  boardStages: BoardStageCfg[];
  boardEditing: boolean;
  boardViews: BoardView[];
  colorRules: ColorRule[];
  colorRulesOn: boolean;
  colorRulesOpen: boolean;
  ruleFilter: string | null;
  swimCollapsed: Record<string, boolean>;
  focusMode: boolean;
  recordHeadMin: boolean;
  recordNovaMin: boolean;
  colW: Record<string, number>;
  colSearch: Record<string, string>;
  colSearchOpen: boolean;

  // ui
  theme: ThemeMode;
  role: 'admin' | 'rep';
  paletteOpen: boolean;
  novaOpen: boolean;
  novaMessages: NovaMessage[];
  novaThinking: boolean;
  dealNova: Record<string, { role: 'user' | 'nova'; text: string }[]>;
  dealNovaStreaming: string | null;
  typing: Record<string, boolean>; // keyed by activity id — client is "typing"
  notifOpen: boolean;
  composers: ComposerState[];
  toasts: Toast[];
  mobileNavOpen: boolean;
  tasksOpen: boolean;
  hubOpen: boolean;

  // deal interactions
  cardMenuId: string | null;
  peekId: string | null;
  commDealId: string | null;
  capture: { id: string; to: StageKey } | null;
  confettiAt: number;
  bulk: string[];
  autoOpen: boolean;
  autoEdit: Automation | null;
  docBuilder: { dealId: string; kind: 'quote' | 'invoice'; items: DocItem[]; discount: number; tax: number } | null;

  // undo / redo history of the deals collection
  past: Deal[][];
  future: Deal[][];

  // derived helpers stored as actions
  addPipeline: (name: string) => void;
  renamePipeline: (k: string, name: string) => void;
  deletePipeline: (k: string) => void;
  recolorPipeline: (k: string) => void;
  setAdvFilter: (rules: FilterState['adv']) => void;
  setRecordLayout: (l: 'standard' | 'tri') => void;
  setRecordHeadMin: (v: boolean) => void;
  setRecordNovaMin: (v: boolean) => void;
  setRecordEditing: (v: boolean) => void;
  moveRecordSection: (key: string, toCol: number, toIndex: number) => void;
  nudgeRecordSection: (key: string, dir: 'up' | 'down' | 'left' | 'right') => void;
  toggleRecordSectionHidden: (key: string) => void;
  resetRecordCols: () => void;
  setBoardEditing: (v: boolean) => void;
  moveBoardStage: (k: StageKey, dir: -1 | 1) => void;
  toggleBoardStageHidden: (k: StageKey) => void;
  setBoardStageWip: (k: StageKey, wip: number | null) => void;
  setBoardStageLabel: (k: StageKey, label: string) => void;
  resetBoardStages: () => void;
  saveBoardView: (name: string) => void;
  applyBoardView: (name: string) => void;
  deleteBoardView: (name: string) => void;
  setColorRulesOpen: (v: boolean) => void;
  toggleColorRules: (v?: boolean) => void;
  addColorRule: () => void;
  updateColorRule: (id: string, patch: Partial<ColorRule>) => void;
  removeColorRule: (id: string) => void;
  moveColorRule: (id: string, dir: -1 | 1) => void;
  resetColorRules: () => void;
  setRuleFilter: (id: string | null) => void;
  toggleSwimCollapse: (key: string) => void;
  setFocusMode: (v: boolean) => void;
  setAuto: (open: boolean) => void;
  setAutoEdit: (a: Automation | null) => void;
  saveAutomation: (a: Automation) => void;
  toggleAutomation: (id: string) => void;
  deleteAutomation: (id: string) => void;
  runAutomations: () => void;
  openDocBuilder: (dealId: string, kind: 'quote' | 'invoice') => void;
  setDocBuilder: (patch: Partial<NonNullable<AppState['docBuilder']>>) => void;
  closeDocBuilder: () => void;
  saveDoc: () => void;

  setNav: (nav: string) => void;
  setView: (v: DealView) => void;
  setPipeline: (p: string) => void;
  openDeal: (id: string | null) => void;
  openObject: (id: string | null) => void;
  setQuery: (q: string) => void;
  setFilters: (f: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleSort: (k: string) => void;
  addSort: (k: string) => void;
  setColW: (k: string, w: number) => void;
  setColSearch: (k: string, q: string) => void;
  toggleColSearch: () => void;
  setRole: (r: 'admin' | 'rep') => void;
  setSwimlane: (s: Swimlane) => void;

  setDensity: (d: Density) => void;
  setGroup: (g: GroupBy) => void;
  toggleTableCol: (k: string) => void;
  moveTableCol: (k: string, dir: -1 | 1) => void;
  toggleCardField: (k: string) => void;
  reorderCardFields: (next: string[]) => void;
  reorderRecordSections: (next: string[]) => void;
  resetRecordSections: () => void;
  toggleColCollapse: (k: string) => void;
  setAllCollapsed: (keys: string[], v: boolean) => void;
  setKbCompact: (v: boolean) => void;
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
  pushActivity: (dealId: string, act: Activity) => void;
  updateActivity: (dealId: string, actId: string, patch: Partial<Activity>) => void;
  logActivity: (dealId: string, type: ActivityType, text: string, extra?: Partial<Activity>) => void;
  toggleTask: (dealId: string, actId: string) => void;
  toggleReminder: (dealId: string, actId: string) => void;
  enrollSequence: (dealId: string, seqKey: string) => void;
  bulkEnroll: (seqKey: string) => void;
  togglePinNote: (dealId: string, actId: string) => void;
  replyToActivity: (dealId: string, actId: string, text: string) => void;
  convertQuoteToInvoice: (dealId: string, quoteId: string) => void;
  invoiceFromAsset: (dealId: string, total: number, fromLabel: string) => void;
  sendDoc: (dealId: string, docName: string) => void;
  addDealProduct: (dealId: string, item: { n: string; v: number }) => void;
  removeDealProduct: (dealId: string, index: number) => void;
  addDealContact: (dealId: string, contact: { n: string; r: string; t: string; s: 'Strong' | 'Medium' | 'Weak' | 'Dormant' }) => void;
  updateDealContact: (dealId: string, index: number, patch: Partial<{ n: string; r: string; t: string; s: 'Strong' | 'Medium' | 'Weak' | 'Dormant' }>) => void;
  removeDealContact: (dealId: string, index: number) => void;
  updateDealProduct: (dealId: string, index: number, patch: Partial<{ n: string; v: number }>) => void;
  duplicateDeal: (id: string) => void;
  deleteDeal: (id: string) => void;
  setDealPriority: (id: string, p: Priority) => void;
  setDealOwner: (id: string, owner: string) => void;
  requestStage: (id: string, to: StageKey) => void;
  applyCapture: (reason: string, note: string, amount?: number) => void;
  cancelCapture: () => void;
  setCardMenu: (id: string | null) => void;
  setPeek: (id: string | null) => void;
  openCommPanel: (id: string | null) => void;
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
  askDealNova: (dealId: string, text: string) => void;
  clearDealNova: (dealId: string) => void;
  setNotif: (open: boolean) => void;
  setMobileNav: (open: boolean) => void;
  setTasks: (open: boolean) => void;
  setHub: (open: boolean) => void;
  undo: () => void;
  redo: () => void;

  openComposer: (c: Omit<ComposerState, 'wid'> & { wid?: string }) => void;
  updateComposer: (wid: string, patch: Partial<ComposerState>) => void;
  closeComposer: (wid: string) => void;
  sendComposer: (wid: string) => void;

  addObjectRecord: (objKey: string, rec: ObjectRecord) => void;
  updateObjectRecord: (objKey: string, id: string, patch: Partial<ObjectRecord>) => void;
  removeObjectRecord: (objKey: string, id: string) => void;
  duplicateObjectRecord: (objKey: string, id: string) => void;
  moveProductStage: (id: string, stage: ProductStage) => void;
  addProductActivity: (id: string, act: Activity) => void;
  addProductType: (t: CustomProductType) => void;
  removeProductType: (k: string) => void;
  addProductCategory: (c: string) => string;
  createSalesDoc: (kind: SalesDocKind, partial?: Partial<SalesDoc>) => string;
  updateSalesDoc: (id: string, patch: Partial<SalesDoc>) => void;
  removeSalesDoc: (id: string) => void;
  convertQuoteToOrder: (id: string) => string | null;
  convertToInvoice: (id: string) => string | null;
  recordPayment: (id: string, amount: number, method?: PaymentMethod) => void;
  refundPayment: (paymentId: string) => void;
  sendDunning: (invoiceId: string) => void;
  addSubscriptionItem: (subId: string, line: SalesLine, prorate: boolean) => string | null;
  createSubscription: (partial?: Partial<Subscription>) => string;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  generateInvoiceFromSub: (id: string) => string | null;
  toggleConnector: (k: string) => void;
  syncConnector: (k: string) => void;
  receivePO: (id: string) => void;

  toast: (text: string, tone?: Toast['tone'], undoable?: boolean) => void;
  dismissToast: (id: string) => void;

  resetDemo: () => void;
}

export type ComposerKind = 'note' | 'call' | 'task' | 'meeting' | 'email' | 'whatsapp' | 'sms';

export interface ComposerState {
  wid: string;
  dealId: string;
  kind: ComposerKind;
  minimized?: boolean;
  maximized?: boolean;
  to?: string;
  cc?: string;
  bcc?: string;
  showCc?: boolean;
  attachments?: string[];
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
  productTypes: [],
  productCategories: [...PRODUCT_CATEGORIES],
  salesDocs: seedSalesDocs(),
  payments: seedPayments(),
  subscriptions: seedSubscriptions(),
  connectors: seedConnectors(),
  pipelines: PIPELINES.map((p) => ({ ...p })),
  automations: DEFAULT_AUTOMATIONS.map((a) => ({ ...a })),

  nav: 'deals',
  view: 'board',
  pipeline: 'sales',
  openDealId: null,
  openObjectId: null,
  recentDeals: [],

  q: '',
  filters: { ...emptyFilters },
  sort: [{ k: 'value', dir: -1 }],
  swimlane: 'none',

  tableCols: [...DEFAULT_TABLE_COLS],
  density: 'comfortable',
  group: 'none',
  cardFields: [...DEFAULT_CARD_FIELDS],
  collapsedCols: {},
  kbCompact: false,
  savedViews: [],
  activeView: null,
  recordLayout: 'standard',
  recordSections: [...DEFAULT_RECORD_SECTIONS],
  recordCols: cloneCols(DEFAULT_RECORD_COLS),
  recordHidden: [],
  recordEditing: false,
  boardStages: DEFAULT_BOARD_STAGES.map((s) => ({ ...s })),
  boardEditing: false,
  boardViews: [],
  colorRules: DEFAULT_COLOR_RULES.map((r) => ({ ...r })),
  colorRulesOn: false,
  colorRulesOpen: false,
  ruleFilter: null,
  swimCollapsed: {},
  focusMode: false,
  recordHeadMin: false,
  recordNovaMin: false,
  colW: {},
  colSearch: {},
  colSearchOpen: false,

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
  dealNova: {},
  dealNovaStreaming: null,
  typing: {},
  notifOpen: false,
  composers: [],
  toasts: [],
  mobileNavOpen: false,
  tasksOpen: false,
  hubOpen: false,
  cardMenuId: null,
  peekId: null,
  commDealId: null,
  capture: null,
  confettiAt: 0,
  bulk: [],
  autoOpen: false,
  autoEdit: null,
  docBuilder: null,
  past: [],
  future: [],

  addPipeline: (name) => {
    const nm = name.trim();
    if (!nm) return get().toast('Name the pipeline first', 'warn');
    let key = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pipe' + Date.now();
    if (get().pipelines.some((p) => p.k === key)) key += '-' + Math.floor(Math.random() * 999);
    const hue = PIPE_HUES[get().pipelines.length % PIPE_HUES.length];
    set((s) => ({ pipelines: [...s.pipelines, { k: key, name: nm, hue }], pipeline: key }));
    get().toast(`Pipeline “${nm}” created`, 'success');
  },
  renamePipeline: (k, name) =>
    set((s) => ({ pipelines: s.pipelines.map((p) => (p.k === k ? { ...p, name } : p)) })),
  deletePipeline: (k) =>
    set((s) => {
      if (s.pipelines.length <= 1) return {};
      const fallback = s.pipelines.find((p) => p.k !== k)!.k;
      return {
        pipelines: s.pipelines.filter((p) => p.k !== k),
        deals: s.deals.map((d) => (d.pipeline === k ? { ...d, pipeline: fallback as PipelineKey } : d)),
        pipeline: s.pipeline === k ? fallback : s.pipeline,
      };
    }),
  recolorPipeline: (k) =>
    set((s) => {
      const cur = s.pipelines.find((p) => p.k === k);
      const idx = PIPE_HUES.indexOf(cur?.hue ?? '');
      const next = PIPE_HUES[(idx + 1) % PIPE_HUES.length];
      return { pipelines: s.pipelines.map((p) => (p.k === k ? { ...p, hue: next } : p)) };
    }),
  setAdvFilter: (adv) => set((s) => ({ filters: { ...s.filters, adv } })),
  setRecordLayout: (recordLayout) => set({ recordLayout }),
  setRecordHeadMin: (recordHeadMin) => set({ recordHeadMin }),
  setRecordNovaMin: (recordNovaMin) => set({ recordNovaMin }),
  setRecordEditing: (recordEditing) => set({ recordEditing }),
  moveRecordSection: (key, toCol, toIndex) =>
    set((s) => {
      const mode = s.recordLayout;
      const cols = s.recordCols[mode].map((c) => c.filter((k) => k !== key));
      if (toCol < 0) toCol = 0;
      if (toCol > cols.length - 1) toCol = cols.length - 1;
      const idx = Math.max(0, Math.min(toIndex, cols[toCol].length));
      cols[toCol].splice(idx, 0, key);
      return { recordCols: { ...s.recordCols, [mode]: cols } };
    }),
  nudgeRecordSection: (key, dir) =>
    set((s) => {
      const mode = s.recordLayout;
      const cols = s.recordCols[mode].map((c) => [...c]);
      let ci = -1, ri = -1;
      cols.forEach((c, i) => { const j = c.indexOf(key); if (j >= 0) { ci = i; ri = j; } });
      if (ci < 0) return {};
      if (dir === 'up' && ri > 0) { [cols[ci][ri - 1], cols[ci][ri]] = [cols[ci][ri], cols[ci][ri - 1]]; }
      else if (dir === 'down' && ri < cols[ci].length - 1) { [cols[ci][ri + 1], cols[ci][ri]] = [cols[ci][ri], cols[ci][ri + 1]]; }
      else if (dir === 'left' && ci > 0) { cols[ci].splice(ri, 1); cols[ci - 1].push(key); }
      else if (dir === 'right' && ci < cols.length - 1) { cols[ci].splice(ri, 1); cols[ci + 1].push(key); }
      return { recordCols: { ...s.recordCols, [mode]: cols } };
    }),
  toggleRecordSectionHidden: (key) =>
    set((s) => ({ recordHidden: s.recordHidden.includes(key) ? s.recordHidden.filter((k) => k !== key) : [...s.recordHidden, key] })),
  resetRecordCols: () => set({ recordCols: cloneCols(DEFAULT_RECORD_COLS), recordHidden: [] }),

  setBoardEditing: (boardEditing) => set({ boardEditing }),
  moveBoardStage: (k, dir) =>
    set((s) => {
      const arr = [...s.boardStages];
      const i = arr.findIndex((x) => x.k === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { boardStages: arr };
    }),
  toggleBoardStageHidden: (k) =>
    set((s) => ({ boardStages: s.boardStages.map((x) => (x.k === k ? { ...x, hidden: !x.hidden } : x)) })),
  setBoardStageWip: (k, wip) =>
    set((s) => ({ boardStages: s.boardStages.map((x) => (x.k === k ? { ...x, wip: wip && wip > 0 ? wip : null } : x)) })),
  setBoardStageLabel: (k, label) =>
    set((s) => ({ boardStages: s.boardStages.map((x) => (x.k === k ? { ...x, label: label.trim() || undefined } : x)) })),
  resetBoardStages: () => set({ boardStages: DEFAULT_BOARD_STAGES.map((x) => ({ ...x })) }),
  saveBoardView: (name) =>
    set((s) => {
      const v: BoardView = { name, pipeline: s.pipeline, swimlane: s.swimlane, kbCompact: s.kbCompact, filters: JSON.parse(JSON.stringify(s.filters)) };
      get().toast(`Board view “${name}” saved`, 'success');
      return { boardViews: [...s.boardViews.filter((x) => x.name !== name), v] };
    }),
  applyBoardView: (name) =>
    set((s) => {
      const v = s.boardViews.find((x) => x.name === name);
      if (!v) return {};
      return { pipeline: v.pipeline, swimlane: v.swimlane, kbCompact: v.kbCompact, filters: JSON.parse(JSON.stringify(v.filters)) };
    }),
  deleteBoardView: (name) => set((s) => ({ boardViews: s.boardViews.filter((x) => x.name !== name) })),

  setColorRulesOpen: (colorRulesOpen) => set({ colorRulesOpen }),
  toggleColorRules: (v) => set((s) => ({ colorRulesOn: v ?? !s.colorRulesOn })),
  addColorRule: () =>
    set((s) => ({
      colorRules: [...s.colorRules, { id: uid('cr'), enabled: true, label: 'New rule', field: 'health', op: 'lt', value: '', color: RULE_COLORS[s.colorRules.length % RULE_COLORS.length] }],
      colorRulesOn: true,
    })),
  updateColorRule: (id, patch) =>
    set((s) => ({ colorRules: s.colorRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeColorRule: (id) => set((s) => ({ colorRules: s.colorRules.filter((r) => r.id !== id) })),
  moveColorRule: (id, dir) =>
    set((s) => {
      const arr = [...s.colorRules];
      const i = arr.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { colorRules: arr };
    }),
  resetColorRules: () => set({ colorRules: DEFAULT_COLOR_RULES.map((r) => ({ ...r })) }),
  setRuleFilter: (ruleFilter) => set((s) => ({ ruleFilter, colorRulesOn: ruleFilter ? true : s.colorRulesOn })),
  toggleSwimCollapse: (key) => set((s) => ({ swimCollapsed: { ...s.swimCollapsed, [key]: !s.swimCollapsed[key] } })),
  setFocusMode: (focusMode) => set({ focusMode }),

  setAuto: (autoOpen) => set({ autoOpen, autoEdit: autoOpen ? get().autoEdit : null }),
  setAutoEdit: (autoEdit) => set({ autoEdit }),
  saveAutomation: (a) =>
    set((s) => {
      const exists = s.automations.some((x) => x.id === a.id);
      return {
        automations: exists ? s.automations.map((x) => (x.id === a.id ? a : x)) : [...s.automations, a],
        autoEdit: null,
      };
    }),
  toggleAutomation: (id) =>
    set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)) })),
  deleteAutomation: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),
  runAutomations: () => {
    const rules = get().automations.filter((r) => r.enabled && r.on.t !== 'created');
    let n = 0;
    const me = OWNERS[ME].name;
    set((s) => {
      const deals = s.deals.map((d) => {
        let nd = d;
        for (const r of rules) {
          let match = false;
          if (r.on.t === 'stage') match = !r.on.v || r.on.v === 'any' || d.stage === r.on.v;
          else if (r.on.t === 'stale') match = staleDaysOf(d.acts?.[0]?.w) >= (+r.on.v || 14);
          else if (r.on.t === 'health') match = d.health < (+r.on.v || 50);
          if (!match) continue;
          if (r.cond.f === 'priority' && d.priority !== r.cond.v) continue;
          if (r.cond.f === 'value' && d.value < (+r.cond.v || 0)) continue;
          if (r.cond.f === 'owner' && d.owner !== ME) continue;
          if (r.act.t === 'priority') { if (nd.priority !== r.act.v) { nd = { ...nd, priority: r.act.v as Priority }; n++; } }
          else if (r.act.t === 'tag') { if (!nd.tags.includes(r.act.v)) { nd = { ...nd, tags: [...nd.tags, r.act.v] }; n++; } }
          else if (r.act.t === 'task') {
            const has = nd.acts.some((a) => a.type === 'task' && a.title === r.act.v && !a.done);
            if (!has) { nd = { ...nd, acts: [{ id: uid('a'), type: 'task' as const, who: me, w: 'now', title: r.act.v, ttype: 'todo', due: 'Tomorrow', prio: 'med' as Priority, done: false }, ...nd.acts] }; n++; }
          }
        }
        return nd;
      });
      return { deals, past: [...s.past, s.deals].slice(-HISTORY_LIMIT), future: [] };
    });
    get().toast(n ? `Automations applied to ${n} deal${n !== 1 ? 's' : ''}` : 'No deals matched the active rules', n ? 'success' : 'default');
  },

  openDocBuilder: (dealId, kind) => {
    const d = get().deals.find((x) => x.id === dealId);
    const items: DocItem[] = (d?.products ?? []).map((p) => ({ name: p.n, qty: 1, unit: p.v }));
    if (!items.length) items.push({ name: 'Platform — annual', qty: 1, unit: 48000 });
    set({ docBuilder: { dealId, kind, items, discount: 0, tax: 0 } });
  },
  setDocBuilder: (patch) => set((s) => (s.docBuilder ? { docBuilder: { ...s.docBuilder, ...patch } } : {})),
  closeDocBuilder: () => set({ docBuilder: null }),
  saveDoc: () => {
    const b = get().docBuilder;
    if (!b) return;
    const d = get().deals.find((x) => x.id === b.dealId);
    if (!d) return;
    const sub = b.items.reduce((a, it) => a + it.qty * it.unit, 0);
    const disc = Math.round((sub * b.discount) / 100);
    const tax = Math.round(((sub - disc) * b.tax) / 100);
    const total = sub - disc + tax;
    const num = d.id.replace(/\D/g, '') || '000';
    const isInv = b.kind === 'invoice';
    const seq = ((isInv ? d.invoices?.length : d.quotes?.length) ?? 0) + 1;
    const id = (isInv ? 'INV-' : 'Q-') + num + '-' + (seq < 10 ? '0' + seq : seq);
    const doc = { id, kind: b.kind, total, status: isInv ? 'Sent' : 'Draft', items: b.items, discount: b.discount, tax: b.tax, created: 'now' };
    set((s) => ({
      deals: s.deals.map((x) =>
        x.id === b.dealId
          ? { ...x, [isInv ? 'invoices' : 'quotes']: [...(isInv ? x.invoices ?? [] : x.quotes ?? []), doc], docs: [{ n: `${id}.pdf`, k: 'pdf' as const }, ...x.docs] }
          : x,
      ),
      docBuilder: null,
    }));
    get().addActivity(b.dealId, { type: 'file', who: 'You', w: 'now', text: `Generated ${b.kind} ${id}`, chan: `${id}.pdf` });
    get().toast(`${isInv ? 'Invoice' : 'Quote'} ${id} created`, 'success');
  },

  setNav: (nav) => set({ nav, openDealId: null, openObjectId: null, mobileNavOpen: false }),
  setView: (view) => set({ view, openDealId: null }),
  setPipeline: (pipeline) => set({ pipeline }),
  openDeal: (openDealId) =>
    set((s) => (openDealId
      ? { openDealId, recentDeals: [openDealId, ...s.recentDeals.filter((id) => id !== openDealId)].slice(0, 8) }
      : { openDealId })),
  openObject: (openObjectId) => set({ openObjectId }),
  setQuery: (q) => set({ q }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: { ...emptyFilters } }),
  toggleSort: (k) =>
    set((s) => {
      const cur = s.sort[0];
      if (cur && cur.k === k && s.sort.length === 1) return { sort: [{ k, dir: cur.dir === 1 ? -1 : 1 }] };
      return { sort: [{ k, dir: -1 }] };
    }),
  addSort: (k) =>
    set((s) => {
      const i = s.sort.findIndex((r) => r.k === k);
      if (i < 0) return { sort: [...s.sort, { k, dir: -1 }] };
      const next = s.sort.slice();
      if (next[i].dir === -1) next[i] = { k, dir: 1 };
      else next.splice(i, 1); // third shift-click removes from sort
      return { sort: next.length ? next : [{ k: 'value', dir: -1 }] };
    }),
  setColW: (k, w) => set((s) => ({ colW: { ...s.colW, [k]: Math.max(70, Math.round(w)) } })),
  setColSearch: (k, q) => set((s) => ({ colSearch: { ...s.colSearch, [k]: q } })),
  toggleColSearch: () => set((s) => ({ colSearchOpen: !s.colSearchOpen })),
  setRole: (role) => set({ role }),
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
  reorderCardFields: (next) => set({ cardFields: next }),
  reorderRecordSections: (next) => set({ recordSections: next }),
  resetRecordSections: () => set({ recordSections: [...DEFAULT_RECORD_SECTIONS] }),
  toggleColCollapse: (k) =>
    set((s) => ({ collapsedCols: { ...s.collapsedCols, [k]: !s.collapsedCols[k] } })),
  setAllCollapsed: (keys, v) =>
    set((s) => {
      const next = { ...s.collapsedCols };
      keys.forEach((k) => { next[k] = v; });
      return { collapsedCols: next };
    }),
  setKbCompact: (kbCompact) => set({ kbCompact }),

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

  pushActivity: (dealId, act) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, acts: [act, ...d.acts] } : d)) })),
  updateActivity: (dealId, actId, patch) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId ? { ...d, acts: d.acts.map((a) => (a.id === actId ? { ...a, ...patch } : a)) } : d,
      ),
    })),

  logActivity: (dealId, type, text, extra = {}) => {
    get().addActivity(dealId, { type, who: 'You', w: 'now', text, dir: 'out', ...extra });
  },

  enrollSequence: (dealId, seqKey) => {
    const seq = SEQUENCES.find((s) => s.k === seqKey);
    if (!seq) return;
    get().addActivity(dealId, { type: 'marketing', who: 'Nova', w: 'now', subj: seq.name, seq, step: 1, text: `Enrolled in “${seq.name}”.`, chan: `${seq.name} · sequence` });
    get().toast(`Enrolled in ${seq.name}`, 'success');
  },
  bulkEnroll: (seqKey) => {
    const ids = get().bulk;
    const seq = SEQUENCES.find((s) => s.k === seqKey);
    if (!ids.length || !seq) return;
    ids.forEach((id) => get().addActivity(id, { type: 'marketing', who: 'Nova', w: 'now', subj: seq.name, seq, step: 1, text: `Enrolled in “${seq.name}”.`, chan: `${seq.name} · sequence` }));
    set({ bulk: [] });
    get().toast(`Enrolled ${ids.length} deals in ${seq.name}`, 'success');
  },
  togglePinNote: (dealId, actId) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId ? { ...d, acts: d.acts.map((a) => (a.id === actId ? { ...a, pin: !a.pin } : a)) } : d,
      ),
    })),
  replyToActivity: (dealId, actId, text) => {
    const t = text.trim();
    if (!t) return get().toast('Write a reply first', 'warn');
    const deal = get().deals.find((d) => d.id === dealId);
    const act = deal?.acts.find((a) => a.id === actId);
    if (!act) return;
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              acts: d.acts.map((a) =>
                a.id === actId
                  ? {
                      ...a,
                      status: a.type === 'email' ? 'sent' : a.status,
                      thread: [
                        ...(a.thread ?? [{ dir: a.dir ?? 'out', who: a.who, w: a.w, text: a.text ?? a.subj ?? '' }]),
                        { dir: 'out' as const, who: 'You', w: 'now', text: t },
                      ],
                    }
                  : a,
              ),
            }
          : d,
      ),
    }));
    get().toast('Reply sent', 'success');
    const contact = act.who && act.who !== 'You' ? act.who : deal?.contacts[0]?.n ?? 'Client';
    const setTyping = (v: boolean) => set((s) => ({ typing: { ...s.typing, [actId]: v } }));
    // delivered → read receipt → typing → inbound reply
    if (act.type === 'email') {
      window.setTimeout(() => get().updateActivity(dealId, actId, { status: 'delivered' }), 700);
      window.setTimeout(() => get().updateActivity(dealId, actId, { status: 'opened', read: true, opens: (act.opens ?? 1) + 1 }), 1500);
    } else {
      window.setTimeout(() => get().updateActivity(dealId, actId, { read: true }), 1500);
    }
    window.setTimeout(() => setTyping(true), 1900);
    window.setTimeout(() => {
      setTyping(false);
      const d2 = get().deals.find((d) => d.id === dealId);
      const a2 = d2?.acts.find((a) => a.id === actId);
      if (!a2) return;
      get().updateActivity(dealId, actId, {
        thread: [...(a2.thread ?? []), { dir: 'in', who: contact, w: 'now', text: 'Thanks — got it, will take a look and revert.' }],
      });
      get().toast(`${String(contact).split(' ')[0]} replied`, 'default');
    }, 3600);
  },
  convertQuoteToInvoice: (dealId, quoteId) => {
    const d = get().deals.find((x) => x.id === dealId);
    const q = d?.quotes?.find((x) => x.id === quoteId);
    if (!d || !q) return;
    const num = d.id.replace(/\D/g, '') || '000';
    const seq = (d.invoices?.length ?? 0) + 1;
    const id = 'INV-' + num + '-' + (seq < 10 ? '0' + seq : seq);
    const inv = { ...q, id, kind: 'invoice' as const, status: 'Sent', created: 'now' };
    set((s) => ({
      deals: s.deals.map((x) =>
        x.id === dealId ? { ...x, invoices: [...(x.invoices ?? []), inv], docs: [{ n: `${id}.pdf`, k: 'pdf' as const }, ...x.docs] } : x,
      ),
    }));
    get().toast(`Invoice ${id} created from ${quoteId}`, 'success');
  },
  invoiceFromAsset: (dealId, total, fromLabel) => {
    const d = get().deals.find((x) => x.id === dealId);
    if (!d) return;
    const num = d.id.replace(/\D/g, '') || '000';
    const seq = (d.invoices?.length ?? 0) + 1;
    const id = 'INV-' + num + '-' + (seq < 10 ? '0' + seq : seq);
    const inv = { id, kind: 'invoice' as const, total, status: 'Sent', items: [], discount: 0, tax: 0, created: 'now' };
    set((s) => ({
      deals: s.deals.map((x) =>
        x.id === dealId ? { ...x, invoices: [...(x.invoices ?? []), inv], docs: [{ n: `${id}.pdf`, k: 'pdf' as const }, ...x.docs] } : x,
      ),
    }));
    get().toast(`Invoice ${id} created from ${fromLabel}`, 'success');
  },
  sendDoc: (dealId, docName) => {
    get().addActivity(dealId, { type: 'email', who: 'You', w: 'now', subj: `Sent ${docName}`, dir: 'out', status: 'sent', attach: [docName], thread: [{ dir: 'out', who: 'You', w: 'now', text: `Please find ${docName} attached.` }] });
    get().toast(`${docName} sent`, 'success');
  },
  addDealProduct: (dealId, item) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, products: [...d.products, item] } : d)) })),
  removeDealProduct: (dealId, index) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, products: d.products.filter((_, i) => i !== index) } : d)) })),
  addDealContact: (dealId, contact) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, contacts: [...d.contacts, contact] } : d)) })),
  updateDealContact: (dealId, index, patch) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, contacts: d.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)) } : d)) })),
  removeDealContact: (dealId, index) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, contacts: d.contacts.filter((_, i) => i !== index) } : d)) })),
  updateDealProduct: (dealId, index, patch) =>
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, products: d.products.map((p, i) => (i === index ? { ...p, ...patch } : p)) } : d)) })),

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
    get().toast('Deal deleted', 'warn', true);
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
  openCommPanel: (commDealId) => set({ commDealId }),

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
    get().toast(`Deleted ${ids.length} deals`, 'warn', true);
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

  askDealNova: (dealId, text) => {
    const q = text.trim();
    if (!q) return;
    const d = get().deals.find((x) => x.id === dealId);
    if (!d) return;
    const full = answerForDeal(d, q);
    // Push the question + an empty Nova bubble, then stream the answer in.
    set((s) => ({
      dealNova: {
        ...s.dealNova,
        [dealId]: [...(s.dealNova[dealId] ?? []), { role: 'user', text: q }, { role: 'nova', text: '' }],
      },
      dealNovaStreaming: dealId,
    }));
    const step = Math.max(2, Math.round(full.length / 70));
    let i = 0;
    const tick = () => {
      i += step;
      const slice = full.slice(0, i);
      const done = i >= full.length;
      set((s) => {
        const arr = (s.dealNova[dealId] ?? []).slice();
        for (let j = arr.length - 1; j >= 0; j--) {
          if (arr[j].role === 'nova') { arr[j] = { role: 'nova', text: done ? full : slice }; break; }
        }
        return { dealNova: { ...s.dealNova, [dealId]: arr }, dealNovaStreaming: done ? null : dealId };
      });
      if (!done) window.setTimeout(tick, 18);
    };
    window.setTimeout(tick, 80);
  },
  clearDealNova: (dealId) =>
    set((s) => {
      const next = { ...s.dealNova };
      delete next[dealId];
      return { dealNova: next };
    }),

  openComposer: (c) => {
    set((s) => {
      // Focus an existing window for the same deal+kind instead of duplicating.
      const existing = s.composers.find((x) => x.dealId === c.dealId && x.kind === c.kind);
      if (existing) {
        return { composers: s.composers.map((x) => (x.wid === existing.wid ? { ...x, minimized: false } : x)) };
      }
      const wid = c.wid ?? uid('cw');
      const next = [...s.composers, { ...c, wid, minimized: false } as ComposerState];
      // Cap at 3 docked windows; drop the oldest.
      return { composers: next.slice(-3) };
    });
  },
  updateComposer: (wid, patch) =>
    set((s) => ({ composers: s.composers.map((c) => (c.wid === wid ? { ...c, ...patch } : c)) })),
  closeComposer: (wid) => set((s) => ({ composers: s.composers.filter((c) => c.wid !== wid) })),
  sendComposer: (wid) => {
    const c = get().composers.find((x) => x.wid === wid);
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
        const aid = uid('a');
        const deal = get().deals.find((d) => d.id === dealId);
        const contact = deal?.contacts[0]?.n ?? 'there';
        get().pushActivity(dealId, {
          id: aid, type: 'email', who: 'You', w: 'now', subj: c.subject?.trim() || '(no subject)', dir: 'out',
          status: 'sent', opens: 0, chan: c.to, attach: c.attachments?.length ? c.attachments : undefined,
          thread: [{ dir: 'out', who: 'You', w: 'now', text: c.body.trim() }],
        });
        get().toast('Email sent · tracking on', 'success');
        // Simulate delivery → read → typing → client reply
        window.setTimeout(() => get().updateActivity(dealId, aid, { status: 'delivered' }), 1100);
        window.setTimeout(() => get().updateActivity(dealId, aid, { status: 'opened', read: true, opens: 1 }), 2600);
        window.setTimeout(() => set((s) => ({ typing: { ...s.typing, [aid]: true } })), 3200);
        window.setTimeout(() => {
          set((s) => ({ typing: { ...s.typing, [aid]: false } }));
          const d2 = get().deals.find((d) => d.id === dealId);
          const a = d2?.acts.find((x) => x.id === aid);
          if (!a) return;
          get().updateActivity(dealId, aid, {
            opens: 2,
            thread: [...(a.thread ?? []), { dir: 'in', who: contact, w: 'now', text: `Thanks ${OWNERS[ME].name.split(' ')[0]} — reviewing now, will revert shortly.` }],
          });
          get().toast(`${contact.split(' ')[0]} replied`, 'default');
        }, 4800);
        break;
      }
      case 'whatsapp':
      case 'sms': {
        if (!c.body?.trim()) return get().toast('Write a message first', 'warn');
        const aid = uid('a');
        const deal = get().deals.find((d) => d.id === dealId);
        const contact = deal?.contacts[0]?.n ?? 'Client';
        get().pushActivity(dealId, {
          id: aid, type: c.kind, who: 'You', w: 'now', chan: c.to,
          thread: [{ dir: 'out', who: 'You', w: 'now', text: c.body.trim() }],
        });
        get().toast(`${c.kind === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent`, 'success');
        window.setTimeout(() => get().updateActivity(dealId, aid, { read: true }), 1500);
        window.setTimeout(() => set((s) => ({ typing: { ...s.typing, [aid]: true } })), 1900);
        window.setTimeout(() => {
          set((s) => ({ typing: { ...s.typing, [aid]: false } }));
          const d2 = get().deals.find((d) => d.id === dealId);
          const a = d2?.acts.find((x) => x.id === aid);
          if (!a) return;
          get().updateActivity(dealId, aid, { thread: [...(a.thread ?? []), { dir: 'in', who: contact, w: 'now', text: 'Got it 👍' }] });
          get().toast(`${String(contact).split(' ')[0]} replied`, 'default');
        }, 3600);
        break;
      }
    }
    set((s) => ({ composers: s.composers.filter((x) => x.wid !== wid) }));
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
  removeObjectRecord: (objKey, id) =>
    set((s) => ({
      objectRecords: {
        ...s.objectRecords,
        [objKey]: (s.objectRecords[objKey] || []).filter((r) => r.id !== id),
      },
      openObjectId: s.openObjectId === id ? null : s.openObjectId,
    })),
  duplicateObjectRecord: (objKey, id) =>
    set((s) => {
      const list = s.objectRecords[objKey] || [];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) return {};
      const src = list[i];
      const copy: ObjectRecord = {
        ...JSON.parse(JSON.stringify(src)),
        id: (objKey.slice(0, 2).toUpperCase()) + '-' + uid('n').slice(-4),
        name: `${String(src.name ?? 'Record')} (copy)`,
        status: 'draft',
      };
      const next = list.slice();
      next.splice(i + 1, 0, copy);
      return { objectRecords: { ...s.objectRecords, [objKey]: next } };
    }),
  moveProductStage: (id, stage) =>
    set((s) => {
      const list = (s.objectRecords.product || []) as unknown as Product[];
      const cur = list.find((r) => r.id === id);
      if (!cur || cur.stage === stage) return {};
      const status = stage === 'Live' ? 'active' : stage === 'Retired' ? 'archived' : cur.status === 'active' ? 'active' : cur.status;
      const act: Activity = { id: uid('pa'), type: 'note', who: 'You', w: 'now', text: `Moved from ${cur.stage} to ${stage}.` };
      const next = list.map((r) => (r.id === id ? { ...r, stage, status, updatedW: 'now', acts: [act, ...(r.acts ?? [])] } : r));
      return { objectRecords: { ...s.objectRecords, product: next as unknown as ObjectRecord[] } };
    }),
  addProductActivity: (id, act) =>
    set((s) => {
      const list = (s.objectRecords.product || []) as unknown as Product[];
      const next = list.map((r) => (r.id === id ? { ...r, updatedW: 'now', acts: [act, ...(r.acts ?? [])] } : r));
      return { objectRecords: { ...s.objectRecords, product: next as unknown as ObjectRecord[] } };
    }),
  addProductType: (t) =>
    set((s) => (s.productTypes.some((x) => x.k === t.k) ? {} : { productTypes: [...s.productTypes, t] })),
  removeProductType: (k) => set((s) => ({ productTypes: s.productTypes.filter((t) => t.k !== k) })),
  createSalesDoc: (kind, partial = {}) => {
    const meta = DOC_META[kind];
    const id = 'sd-' + uid('n').slice(-5);
    const count = get().salesDocs.filter((d) => d.kind === kind).length;
    const doc: SalesDoc = {
      id, kind,
      number: meta.prefix + (meta.base + count + 1),
      status: partial.status ?? meta.statuses[0],
      party: partial.party ?? '',
      currency: partial.currency ?? 'USD',
      lines: partial.lines ?? [],
      discount: partial.discount ?? 0,
      tax: partial.tax ?? 0,
      notes: partial.notes,
      ...(kind === 'invoice' ? { dueDays: partial.dueDays ?? 30, paid: partial.paid ?? 0, dunning: 0 } : {}),
      createdW: 'now', updatedW: 'now',
    };
    set((s) => ({ salesDocs: [doc, ...s.salesDocs] }));
    return id;
  },
  updateSalesDoc: (id, patch) =>
    set((s) => ({ salesDocs: s.salesDocs.map((d) => (d.id === id ? { ...d, ...patch, updatedW: 'now' } : d)) })),
  removeSalesDoc: (id) => set((s) => ({ salesDocs: s.salesDocs.filter((d) => d.id !== id) })),
  convertQuoteToOrder: (id) => {
    const q = get().salesDocs.find((d) => d.id === id);
    if (!q || q.kind !== 'quote') return null;
    const orderId = get().createSalesDoc('order', {
      party: q.party, currency: q.currency, lines: q.lines.map((l) => ({ ...l })), discount: q.discount, tax: q.tax,
      notes: `Converted from ${q.number}`,
    });
    get().updateSalesDoc(id, { status: 'Accepted' });
    const order = get().salesDocs.find((d) => d.id === orderId);
    get().toast(`Order ${order?.number ?? ''} created from ${q.number}`, 'success');
    return orderId;
  },
  convertToInvoice: (id) => {
    const src = get().salesDocs.find((d) => d.id === id);
    if (!src || (src.kind !== 'quote' && src.kind !== 'order')) return null;
    const invId = get().createSalesDoc('invoice', {
      party: src.party, currency: src.currency, lines: src.lines.map((l) => ({ ...l })), discount: src.discount, tax: src.tax,
      status: 'Open', dueW: 'in 30d', notes: `Invoiced from ${src.number}`,
    });
    get().updateSalesDoc(id, src.kind === 'quote' ? { status: 'Accepted' } : { status: 'Invoiced' });
    const inv = get().salesDocs.find((d) => d.id === invId);
    get().toast(`Invoice ${inv?.number ?? ''} created from ${src.number}`, 'success');
    return invId;
  },
  recordPayment: (id, amount, method = 'Card') => {
    const inv = get().salesDocs.find((d) => d.id === id);
    if (!inv || inv.kind !== 'invoice') return;
    const amt = Math.max(0, amount);
    if (!amt) return;
    const total = inv.lines.reduce((s, l) => s + l.qty * l.unit, 0);
    const disc = Math.round((total * (inv.discount || 0)) / 100);
    const tax = Math.round(((total - disc) * (inv.tax || 0)) / 100);
    const grand = total - disc + tax;
    const paid = Math.min(grand, (inv.paid || 0) + amt);
    const status = paid >= grand ? 'Paid' : 'Open';
    get().updateSalesDoc(id, { paid, status, dueW: status === 'Paid' ? 'paid' : inv.dueW });
    const count = get().payments.length;
    const payment: Payment = {
      id: 'pay-' + uid('n').slice(-5), number: 'PAY-' + (5000 + count + 1),
      invoiceId: inv.id, invoiceNumber: inv.number, party: inv.party,
      amount: Math.min(amt, grand - (inv.paid || 0)), currency: inv.currency, method, status: 'Succeeded', w: 'now',
    };
    set((s) => ({ payments: [payment, ...s.payments] }));
    get().toast(status === 'Paid' ? `${inv.number} paid in full` : `Payment recorded on ${inv.number}`, 'success');
  },
  refundPayment: (paymentId) => {
    const pay = get().payments.find((p) => p.id === paymentId);
    if (!pay || pay.status !== 'Succeeded') return;
    set((s) => ({ payments: s.payments.map((p) => (p.id === paymentId ? { ...p, status: 'Refunded' } : p)) }));
    if (pay.invoiceId) {
      const inv = get().salesDocs.find((d) => d.id === pay.invoiceId);
      if (inv) get().updateSalesDoc(inv.id, { paid: Math.max(0, (inv.paid || 0) - pay.amount), status: 'Open' });
    }
    get().toast(`${pay.number} refunded`, 'warn');
  },
  sendDunning: (invoiceId) => {
    const inv = get().salesDocs.find((d) => d.id === invoiceId);
    if (!inv || inv.kind !== 'invoice') return;
    const n = (inv.dunning || 0) + 1;
    get().updateSalesDoc(invoiceId, { dunning: n });
    get().toast(`Payment reminder sent to ${inv.party || 'customer'} (attempt ${n})`, 'success');
  },
  addSubscriptionItem: (subId, line, prorate) => {
    const sub = get().subscriptions.find((x) => x.id === subId);
    if (!sub) return null;
    get().updateSubscription(subId, { lines: [...sub.lines, line] });
    if (!prorate) return null;
    const frac = sub.cycleRemaining ?? 0.5;
    const amount = Math.round(line.qty * line.unit * frac);
    if (amount <= 0) return null;
    const invId = get().createSalesDoc('invoice', {
      party: sub.party, currency: sub.currency, status: 'Open', dueDays: 14,
      lines: [{ productId: line.productId, name: `Proration — ${line.name} (${Math.round(frac * 100)}% of period)`, qty: 1, unit: amount }],
      notes: `Prorated add-on for ${sub.number}`,
    });
    const inv = get().salesDocs.find((d) => d.id === invId);
    get().toast(`Added to ${sub.number} · prorated invoice ${inv?.number ?? ''} for ${amount.toLocaleString()}`, 'success');
    return invId;
  },
  createSubscription: (partial = {}) => {
    const id = 'sub-' + uid('n').slice(-5);
    const count = get().subscriptions.length;
    const sub: Subscription = {
      id, number: 'SUB-' + (6000 + count + 1),
      party: partial.party ?? '', currency: partial.currency ?? 'USD',
      lines: partial.lines ?? [], interval: partial.interval ?? 'monthly',
      status: partial.status ?? 'Active', startedW: 'now', nextW: partial.nextW ?? 'in 1m',
    };
    set((s) => ({ subscriptions: [sub, ...s.subscriptions] }));
    return id;
  },
  updateSubscription: (id, patch) =>
    set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  removeSubscription: (id) => set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) })),
  generateInvoiceFromSub: (id) => {
    const sub = get().subscriptions.find((x) => x.id === id);
    if (!sub) return null;
    const invId = get().createSalesDoc('invoice', {
      party: sub.party, currency: sub.currency, lines: sub.lines.map((l) => ({ ...l })),
      status: 'Open', dueW: 'in 30d', notes: `Recurring invoice for ${sub.number} (${SUB_INTERVALS.find((i) => i.k === sub.interval)?.label})`,
    });
    const inv = get().salesDocs.find((d) => d.id === invId);
    get().toast(`Invoice ${inv?.number ?? ''} generated for ${sub.number}`, 'success');
    return invId;
  },
  toggleConnector: (k) =>
    set((s) => ({
      connectors: s.connectors.map((c) => (c.k === k ? { ...c, connected: !c.connected, lastSyncW: !c.connected ? c.lastSyncW : c.lastSyncW } : c)),
    })),
  syncConnector: (k) => {
    const c = get().connectors.find((x) => x.k === k);
    if (!c || !c.connected) return;
    let count = 0;
    let msg = `${c.name} synced`;
    if (k === 'shopify' || k === 'woocommerce') {
      const existing = (get().objectRecords.product || []) as unknown as Product[];
      let added = 0;
      connectorDemoProducts().forEach((d) => {
        if (existing.some((p) => p.sku === d.sku)) return;
        const p: Product = {
          id: 'PR-' + uid('n').slice(-4).toUpperCase(), name: d.name, sku: d.sku, type: 'physical', category: d.category,
          status: 'active', description: `Imported from ${c.name}.`, price: d.price, cost: d.cost, currency: 'USD', billing: 'one_time', taxRate: 0,
          tracked: true, onHand: 50, committed: 0, reorderPoint: 10, warehouse: 'Shopify · Ohio',
          stage: 'Live', tags: [k], image: { emoji: '🛍️', hue: c.hue }, createdW: 'now', updatedW: 'now',
          acts: [{ id: uid('pa'), type: 'note', who: c.name, w: 'now', text: `Synced from ${c.name}.` }],
        };
        get().addObjectRecord('product', p as unknown as ObjectRecord);
        added++;
      });
      // pull a couple of storefront orders
      const store = get().objectRecords.product as unknown as Product[];
      const src = store.find((p) => p.sku === 'SHOP-HOOD') || store[0];
      if (added > 0 && src) {
        get().createSalesDoc('order', { party: `${c.name} storefront`, status: 'Fulfilled', lines: [{ productId: src.id, name: src.name, qty: 3, unit: src.price }] });
      }
      count = added;
      msg = added ? `Imported ${added} products & 1 order from ${c.name}` : `${c.name} already up to date`;
    } else if (c.category === 'Payments') {
      count = get().payments.length;
      msg = `Synced ${count} payments from ${c.name}`;
    } else if (c.category === 'Accounting') {
      count = get().salesDocs.filter((d) => d.kind === 'invoice').length;
      msg = `Pushed ${count} invoices to ${c.name}`;
    } else if (k === 'salesforce') {
      count = (get().objectRecords.product || []).length;
      msg = `Synced ${count} products & accounts with ${c.name}`;
    } else {
      count = (c.syncedCount || 0) + 1;
      msg = `Test message sent via ${c.name}`;
    }
    set((s) => ({ connectors: s.connectors.map((x) => (x.k === k ? { ...x, lastSyncW: 'now', syncedCount: count } : x)) }));
    get().toast(msg, 'success');
  },
  receivePO: (id) => {
    const po = get().salesDocs.find((d) => d.id === id);
    if (!po || po.kind !== 'po') return;
    const products = (get().objectRecords.product || []) as unknown as Product[];
    const next = products.map((p) => {
      const recv = po.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
      return recv && p.tracked ? { ...p, onHand: p.onHand + recv, updatedW: 'now' } : p;
    });
    set((s) => ({
      objectRecords: { ...s.objectRecords, product: next as unknown as ObjectRecord[] },
      salesDocs: s.salesDocs.map((d) => (d.id === id ? { ...d, status: 'Received', updatedW: 'now' } : d)),
    }));
    po.lines.forEach((l) => get().addProductActivity(l.productId, { id: uid('pa'), type: 'file', who: 'You', w: 'now', text: `Received ${l.qty} × ${l.name} on ${po.number}`, chan: po.number }));
    get().toast(`${po.number} received — stock updated`, 'success');
  },
  addProductCategory: (c) => {
    const name = c.trim();
    if (!name) return name;
    set((s) => (s.productCategories.some((x) => x.toLowerCase() === name.toLowerCase()) ? {} : { productCategories: [...s.productCategories, name] }));
    return name;
  },

  toast: (text, tone = 'default', undoable = false) => {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts, { id, text, tone, undoable }] }));
    window.setTimeout(() => get().dismissToast(id), undoable ? 5000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetDemo: () => {
    const fresh = seedDeals();
    set({
      deals: fresh,
      objects: OBJECT_DEFS,
      objectRecords: seedObjectRecords(fresh),
      productTypes: [],
      productCategories: [...PRODUCT_CATEGORIES],
      salesDocs: seedSalesDocs(),
      payments: seedPayments(),
      subscriptions: seedSubscriptions(),
      connectors: seedConnectors(),
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
      version: 10,
      storage: createJSONStorage(() => localStorage),
      // v2 split docs into quotes/contracts/invoices/attachments; v3 introduced
      // the column-based customizable record dashboard. Reset stored layouts so
      // the new model takes effect.
      migrate: (persisted, version) => {
        const s = persisted as Partial<AppState> | undefined;
        if (s && version < 2) {
          s.recordSections = [...DEFAULT_RECORD_SECTIONS];
        }
        if (s && version < 3) {
          s.recordCols = cloneCols(DEFAULT_RECORD_COLS);
          s.recordHidden = [];
        }
        if (s && version < 4) {
          s.boardStages = DEFAULT_BOARD_STAGES.map((x) => ({ ...x }));
          s.boardViews = [];
        }
        if (s && version < 5) {
          s.colorRules = DEFAULT_COLOR_RULES.map((x) => ({ ...x }));
          s.colorRulesOn = false;
        }
        if (s && version < 6) {
          // The Product Object was upgraded from a flat 5-field record to a
          // first-class catalog model — reseed so the new workspace has data.
          s.objectRecords = {
            ...(s.objectRecords ?? {}),
            product: seedProducts() as unknown as ObjectRecord[],
          };
        }
        if (s && version < 7) {
          // Custom product types + editable category list.
          s.productTypes = s.productTypes ?? [];
          s.productCategories = s.productCategories ?? [...PRODUCT_CATEGORIES];
          // Older seed products predate lifecycle/record surfaces — reseed once more.
          s.objectRecords = { ...(s.objectRecords ?? {}), product: seedProducts() as unknown as ObjectRecord[] };
        }
        if (s && version < 8) {
          s.salesDocs = s.salesDocs ?? seedSalesDocs();
        }
        if (s && version < 9) {
          s.payments = s.payments ?? seedPayments();
          s.subscriptions = s.subscriptions ?? seedSubscriptions();
        }
        if (s && version < 10) {
          s.connectors = s.connectors ?? seedConnectors();
        }
        return s as AppState;
      },
      // Persist data + a couple of preferences; skip transient UI state.
      partialize: (s) => ({
        deals: s.deals,
        objects: s.objects,
        objectRecords: s.objectRecords,
        productTypes: s.productTypes,
        productCategories: s.productCategories,
        salesDocs: s.salesDocs,
        payments: s.payments,
        subscriptions: s.subscriptions,
        connectors: s.connectors,
        role: s.role,
        tableCols: s.tableCols,
        density: s.density,
        cardFields: s.cardFields,
        savedViews: s.savedViews,
        recordLayout: s.recordLayout,
        recordSections: s.recordSections,
        recordCols: s.recordCols,
        recordHidden: s.recordHidden,
        recordHeadMin: s.recordHeadMin,
        recordNovaMin: s.recordNovaMin,
        boardStages: s.boardStages,
        boardViews: s.boardViews,
        colorRules: s.colorRules,
        colorRulesOn: s.colorRulesOn,
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
    if (f.stages.length && !f.stages.includes(d.stage)) return false;
    if (f.priorities.length && !f.priorities.includes(d.priority)) return false;
    if (f.tags.length && !f.tags.some((t) => d.tags.includes(t))) return false;
    if (f.minValue != null && d.value < f.minValue) return false;
    if (f.health === 'healthy' && d.health < 70) return false;
    if (f.health === 'risk' && d.health >= 45) return false;
    if (f.inboxChannel) {
      if (!inboundByChannel(d).some((c) => c.type === f.inboxChannel)) return false;
    } else if (f.inbox && inboundCount(d) === 0) return false;
    for (const r of f.adv) {
      if (!r.value) continue;
      const num = parseFloat(r.value.replace(/[^0-9.\-]/g, '')) || 0;
      const numFields: Record<string, number> = { value: d.value, win: d.win, health: d.health };
      const strFields: Record<string, string> = { stage: d.stage, industry: d.industry, company: d.company };
      if (r.field in numFields) {
        const x = numFields[r.field];
        const ok = r.op === 'lt' ? x < num : r.op === 'lte' ? x <= num : r.op === 'gte' ? x >= num : x > num;
        if (!ok) return false;
      } else {
        const x = (strFields[r.field] ?? '').toLowerCase();
        const v = r.value.toLowerCase();
        const ok = r.op === 'isnot' ? x !== v : r.op === 'contains' ? x.includes(v) : x === v;
        if (!ok) return false;
      }
    }
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
