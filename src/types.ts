// ---- Domain types for Dovehero CRM ----

export type StageKey =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type Priority = 'high' | 'med' | 'low';

export type PipelineKey = 'sales' | 'renewals' | 'onboarding';

export type ActivityType =
  | 'note'
  | 'email'
  | 'call'
  | 'meeting'
  | 'whatsapp'
  | 'sms'
  | 'marketing'
  | 'task'
  | 'file';

export interface ThreadMsg {
  dir: 'in' | 'out';
  who: string;
  w: string;
  text: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  who: string;
  w: string; // relative time label e.g. "2h", "1d"
  text?: string;
  subj?: string;
  chan?: string;
  dir?: 'in' | 'out';
  status?: string;
  read?: boolean; // outbound message has been read by the client (receipts)
  thread?: ThreadMsg[];
  /** task-specific */
  title?: string;
  due?: string;
  prio?: Priority;
  done?: boolean;
  ttype?: string;
  /** email */
  opens?: number;
  attach?: string[];
  /** meeting */
  when?: string;
  dur?: string;
  provider?: 'meet' | 'zoom' | 'phone' | 'teams';
  link?: string;
  attendees?: string[];
  agenda?: string;
  /** call */
  outcome?: 'Connected' | 'Voicemail' | 'No answer' | 'Busy';
  /** marketing sequence */
  seq?: { k: string; name: string; steps: string[] };
  step?: number;
  /** note */
  pin?: boolean;
  reminder?: { title: string; due: string; done: boolean };
}

export interface Contact {
  n: string; // name
  r: string; // role (Champion, Economic buyer, ...)
  t: string; // title
  s: 'Strong' | 'Medium' | 'Weak' | 'Dormant'; // signal strength
}

export interface LineItem {
  n: string;
  v: number;
}

export interface DealDoc {
  n: string;
  k: 'pdf' | 'doc' | 'xls';
}

export interface DocItem {
  name: string;
  qty: number;
  unit: number;
}

export interface DealDocument {
  id: string;
  kind: 'quote' | 'invoice';
  total: number;
  status: string;
  items: DocItem[];
  discount: number;
  tax: number;
  created: string;
}

export interface Deal {
  id: string;
  name: string;
  company: string;
  industry: string;
  stage: StageKey;
  pipeline: PipelineKey;
  owner: string; // owner key e.g. 'AR'
  value: number;
  win: number; // win probability 0-100
  health: number; // 0-100
  priority: Priority;
  tags: string[];
  close: string;
  created: string;
  next: string | null;
  summary: string;
  contacts: Contact[];
  products: LineItem[];
  docs: DealDoc[];
  acts: Activity[];
  quotes?: DealDocument[];
  invoices?: DealDocument[];
}

export interface Owner {
  key: string;
  name: string;
  g: string; // gradient for avatar
}

export interface Stage {
  k: StageKey;
  hue: string;
}

export interface Pipeline {
  k: PipelineKey | string;
  name: string;
  hue: string;
}

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'relation';

export interface FieldDef {
  k: string;
  label: string;
  type: FieldType;
  opts?: string[];
}

export interface ObjectDef {
  k: string;
  name: string;
  plural: string;
  icon: string;
  system: boolean;
  fields: FieldDef[];
}

export type ObjectRecord = Record<string, unknown> & { id: string };

// ---- Product Object (first-class catalog model) ----

/** The built-in kinds of thing being sold — each drives specific capabilities.
 *  `Product.type` is a string so teams can also define their own custom types. */
export type ProductType =
  | 'subscription' // recurring SaaS / licences
  | 'usage'        // metered, tiered/volume pricing
  | 'service'      // one-time professional services
  | 'physical'     // inventory-tracked goods
  | 'digital'      // downloads / vouchers / licences (no stock)
  | 'bundle';      // a kit composed of other products

/** A user-defined product type (label + icon + colour). */
export interface CustomProductType {
  k: string;
  label: string;
  icon: string;
  hue: string;
  blurb?: string;
}

export type ProductStatus = 'active' | 'draft' | 'archived';

/** Product lifecycle / launch-pipeline stage. */
export type ProductStage = 'Backlog' | 'Development' | 'Review' | 'Live' | 'Retired';

export type BillingPeriod = 'one_time' | 'monthly' | 'quarterly' | 'annual';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

/** A volume/usage price break — charges `unit` for quantities up to `upTo` (null = ∞). */
export interface PriceTier {
  upTo: number | null;
  unit: number;
}

/** A concrete variant (option combination) of a configurable product. */
export interface ProductVariant {
  id: string;
  name: string; // e.g. "1TB / Rack-mount"
  sku: string;
  price: number;
  stock?: number;
}

/** A component line inside a bundle/kit. */
export interface BundleItem {
  productId: string;
  name: string;
  qty: number;
  unit: number;
}

/** A price-book row — the same product priced per market/currency. */
export interface PriceBookEntry {
  book: string;
  currency: CurrencyCode;
  price: number;
}

// ---- Sales documents (CPQ): quotes, orders, purchase orders ----

export type SalesDocKind = 'quote' | 'order' | 'invoice' | 'po';

export interface SalesLine {
  productId: string;
  name: string;
  qty: number;
  unit: number; // unit price (quote/order/invoice) or unit cost (po)
}

export type PaymentMethod = 'Card' | 'ACH' | 'Wire' | 'Cash';
export type PaymentStatus = 'Succeeded' | 'Pending' | 'Failed' | 'Refunded';

export interface Payment {
  id: string;
  number: string; // PAY-5001
  invoiceId?: string;
  invoiceNumber?: string;
  party: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  status: PaymentStatus;
  w: string; // relative time label
}

export type SubInterval = 'monthly' | 'quarterly' | 'annual';
export type SubStatus = 'Active' | 'Paused' | 'Cancelled';

export interface Subscription {
  id: string;
  number: string; // SUB-6001
  party: string;
  currency: CurrencyCode;
  lines: SalesLine[];
  interval: SubInterval;
  status: SubStatus;
  startedW: string;
  nextW: string; // next billing
}

export interface SalesDoc {
  id: string;
  kind: SalesDocKind;
  number: string; // e.g. Q-1001, SO-2001, INV-4001, PO-3001
  status: string; // per-kind status
  party: string; // customer (quote/order/invoice) or vendor (po)
  currency: CurrencyCode;
  lines: SalesLine[];
  discount: number; // %
  tax: number; // %
  notes?: string;
  dueW?: string; // invoices — relative due label
  paid?: number; // invoices — amount collected so far
  createdW: string;
  updatedW: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: string; // built-in ProductType or a custom type key
  category: string;
  status: ProductStatus;
  description?: string;

  // pricing
  price: number; // list price in the product's base currency
  cost: number; // unit cost — drives margin
  currency: CurrencyCode;
  billing: BillingPeriod;
  taxRate: number; // %
  priceBooks?: PriceBookEntry[];
  tiers?: PriceTier[]; // usage-based

  // inventory
  tracked: boolean;
  onHand: number;
  committed: number; // reserved by open orders
  reorderPoint: number;
  warehouse?: string;

  // structure
  variants?: ProductVariant[];
  bundleItems?: BundleItem[];

  // lifecycle
  stage: ProductStage;

  // meta
  vendor?: string;
  owner?: string; // owner key
  tags: string[];
  image: { emoji: string; hue: string };
  createdW: string; // relative-time label
  updatedW: string;

  // record surfaces
  acts?: Activity[]; // activity timeline
  docs?: { n: string; k: 'pdf' | 'img' | 'doc' | 'sheet' }[]; // attachments
  media?: { name: string; emoji: string; hue: string }[]; // product images / gallery
}

export type ThemeMode = 'light' | 'dark';

export type DealView = 'board' | 'table' | 'insights' | 'activity';

export type Density = 'comfortable' | 'compact';
export type GroupBy = 'none' | 'stage' | 'owner' | 'priority' | 'rule';
export type Swimlane = 'none' | 'owner' | 'priority' | 'rule';

/** A saved table configuration the user can re-apply as a tab. */
export interface SavedView {
  name: string;
  cols: string[];
  density: Density;
  group: GroupBy;
  sort: SortRule[];
  filters: FilterState;
}

export interface SortRule {
  k: string;
  dir: 1 | -1;
}

export interface AdvRule {
  id: string;
  field: 'value' | 'win' | 'health' | 'stage' | 'industry' | 'company';
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'is' | 'isnot' | 'contains';
  value: string;
}

export interface FilterState {
  owners: string[];
  stages: StageKey[];
  priorities: Priority[];
  tags: string[];
  minValue: number | null;
  health: 'any' | 'healthy' | 'risk';
  inbox: boolean;
  inboxChannel: string | null;
  adv: AdvRule[];
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  on: { t: 'stage' | 'created' | 'stale' | 'health'; v: string };
  cond: { f: 'none' | 'priority' | 'value' | 'owner'; v: string };
  act: { t: 'task' | 'priority' | 'tag'; v: string };
}

export interface NovaMessage {
  id: string;
  role: 'user' | 'nova';
  text: string;
  chips?: { label: string; action?: string }[];
  ts: number;
}

export interface Toast {
  id: string;
  text: string;
  tone?: 'default' | 'success' | 'warn';
  undoable?: boolean;
}
