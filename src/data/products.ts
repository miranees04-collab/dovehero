import type {
  Product,
  ProductType,
  ProductStatus,
  ProductStage,
  CustomProductType,
  BillingPeriod,
  CurrencyCode,
  Activity,
  SalesDoc,
  SalesDocKind,
} from '@/types';

export type TypeMeta = { label: string; icon: string; hue: string; blurb: string };

/** Per-type presentation + capability metadata (icon, colour, label, blurb). */
export const PRODUCT_TYPES: Record<
  ProductType,
  { label: string; icon: string; hue: string; blurb: string }
> = {
  subscription: { label: 'Subscription', icon: 'repeat', hue: '#6366F1', blurb: 'Recurring licence billed per period' },
  usage: { label: 'Usage-based', icon: 'gauge', hue: '#06B6D4', blurb: 'Metered — priced in volume tiers' },
  service: { label: 'Service', icon: 'wrench', hue: '#F59E0B', blurb: 'One-time professional service' },
  physical: { label: 'Physical', icon: 'box', hue: '#10B981', blurb: 'Inventory-tracked goods' },
  digital: { label: 'Digital', icon: 'cloud', hue: '#8B5CF6', blurb: 'Downloads, vouchers & licences' },
  bundle: { label: 'Bundle', icon: 'boxes', hue: '#EC4899', blurb: 'A kit composed of other products' },
};

export const PRODUCT_TYPE_ORDER: ProductType[] = [
  'subscription', 'usage', 'service', 'physical', 'digital', 'bundle',
];

/** Resolve presentation metadata for any product type key — built-in or custom. */
export function resolveType(k: string, custom: CustomProductType[] = []): TypeMeta {
  if ((PRODUCT_TYPES as Record<string, TypeMeta>)[k]) return (PRODUCT_TYPES as Record<string, TypeMeta>)[k];
  const c = custom.find((t) => t.k === k);
  if (c) return { label: c.label, icon: c.icon, hue: c.hue, blurb: c.blurb ?? 'Custom product type' };
  return { label: k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Product', icon: 'box', hue: '#64748B', blurb: 'Custom product type' };
}

/** Icon + colour palettes offered when defining a custom product type. */
export const TYPE_ICON_CHOICES = ['box', 'cloud', 'wrench', 'gauge', 'repeat', 'boxes', 'zap', 'star', 'tag', 'briefcase', 'dollar', 'layers'];
export const TYPE_HUE_CHOICES = ['#6366F1', '#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#EF4444', '#3B82F6', '#14B8A6', '#F97316'];

export const PRODUCT_STATUSES: Record<ProductStatus, { label: string; tone: 'green' | 'amber' | 'neutral' }> = {
  active: { label: 'Active', tone: 'green' },
  draft: { label: 'Draft', tone: 'amber' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/** Product lifecycle pipeline — board columns, in order. */
export const PRODUCT_STAGES: { k: ProductStage; label: string; hue: string; blurb: string }[] = [
  { k: 'Backlog', label: 'Backlog', hue: '#94A3B8', blurb: 'Proposed — not started' },
  { k: 'Development', label: 'Development', hue: '#8B5CF6', blurb: 'Being built' },
  { k: 'Review', label: 'In Review', hue: '#F59E0B', blurb: 'Pricing & GTM sign-off' },
  { k: 'Live', label: 'Live', hue: '#10B981', blurb: 'Sellable in deals' },
  { k: 'Retired', label: 'Retired', hue: '#EF4444', blurb: 'Sunset — existing only' },
];
export const STAGE_ORDER: ProductStage[] = PRODUCT_STAGES.map((s) => s.k);
export const stageHue = (k: ProductStage): string => PRODUCT_STAGES.find((s) => s.k === k)?.hue ?? '#94A3B8';
export const stageMeta = (k: ProductStage) => PRODUCT_STAGES.find((s) => s.k === k) ?? PRODUCT_STAGES[0];

export const BILLING_LABEL: Record<BillingPeriod, string> = {
  one_time: 'One-time',
  monthly: '/mo',
  quarterly: '/qtr',
  annual: '/yr',
};

export const CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.79 },
};

export const PRODUCT_CATEGORIES = [
  'Platform', 'Add-on', 'Service', 'Support', 'Hardware', 'Bundle', 'Training',
];

/** Format an amount in a product currency (no FX conversion — value is already in that currency). */
export function price(amount: number, currency: CurrencyCode = 'USD'): string {
  const { symbol } = CURRENCIES[currency];
  return symbol + Math.round(amount).toLocaleString('en-US');
}

/** Gross margin % from list price and unit cost. */
export function margin(p: Pick<Product, 'price' | 'cost'>): number {
  if (!p.price) return 0;
  return Math.round(((p.price - p.cost) / p.price) * 100);
}

export function marginTone(m: number): 'green' | 'amber' | 'red' {
  return m >= 70 ? 'green' : m >= 40 ? 'amber' : 'red';
}

export type StockState = 'in' | 'low' | 'out' | 'untracked';

export function stockState(p: Pick<Product, 'tracked' | 'onHand' | 'committed' | 'reorderPoint'>): StockState {
  if (!p.tracked) return 'untracked';
  const available = p.onHand - p.committed;
  if (available <= 0) return 'out';
  if (available <= p.reorderPoint) return 'low';
  return 'in';
}

export const STOCK_META: Record<StockState, { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
  in: { label: 'In stock', tone: 'green' },
  low: { label: 'Low stock', tone: 'amber' },
  out: { label: 'Out of stock', tone: 'red' },
  untracked: { label: 'Not tracked', tone: 'neutral' },
};

// ---- Sales documents (CPQ) ----

export const DOC_META: Record<SalesDocKind, {
  label: string; plural: string; icon: string; hue: string; prefix: string; base: number;
  partyLabel: string; statuses: string[]; unitFrom: 'price' | 'cost';
}> = {
  quote: { label: 'Quote', plural: 'Quotes', icon: 'fileText', hue: '#6366F1', prefix: 'Q-', base: 1000, partyLabel: 'Customer', statuses: ['Draft', 'Sent', 'Accepted', 'Expired'], unitFrom: 'price' },
  order: { label: 'Sales order', plural: 'Orders', icon: 'boxes', hue: '#10B981', prefix: 'SO-', base: 2000, partyLabel: 'Customer', statuses: ['Open', 'Fulfilled', 'Invoiced', 'Cancelled'], unitFrom: 'price' },
  invoice: { label: 'Invoice', plural: 'Invoices', icon: 'receipt', hue: '#EC4899', prefix: 'INV-', base: 4000, partyLabel: 'Bill to', statuses: ['Draft', 'Open', 'Paid', 'Overdue', 'Void'], unitFrom: 'price' },
  po: { label: 'Purchase order', plural: 'Purchase orders', icon: 'truck', hue: '#F59E0B', prefix: 'PO-', base: 3000, partyLabel: 'Vendor', statuses: ['Draft', 'Ordered', 'Received', 'Cancelled'], unitFrom: 'cost' },
};

export const DOC_KIND_ORDER: SalesDocKind[] = ['quote', 'order', 'invoice', 'po'];

export function docStatusTone(_kind: SalesDocKind, status: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (['Accepted', 'Fulfilled', 'Invoiced', 'Received', 'Paid'].includes(status)) return 'green';
  if (['Sent', 'Open', 'Ordered'].includes(status)) return 'amber';
  if (['Expired', 'Cancelled', 'Overdue'].includes(status)) return 'red';
  return 'neutral';
}

export function docTotals(d: Pick<SalesDoc, 'lines' | 'discount' | 'tax'>) {
  const subtotal = d.lines.reduce((s, l) => s + l.qty * l.unit, 0);
  const discountAmt = Math.round((subtotal * (d.discount || 0)) / 100);
  const taxAmt = Math.round(((subtotal - discountAmt) * (d.tax || 0)) / 100);
  const total = subtotal - discountAmt + taxAmt;
  return { subtotal, discountAmt, taxAmt, total };
}

/** Outstanding balance on an invoice (total − collected). */
export function docBalance(d: SalesDoc): number {
  return Math.max(0, docTotals(d).total - (d.paid || 0));
}

/** Deterministic id helper for seeded products. */
const pid = (n: number) => 'PR-' + (100 + n);

/** A few demo sales documents so the flow isn't empty on first load. */
export function seedSalesDocs(): SalesDoc[] {
  return [
    {
      id: 'sd-q1', kind: 'quote', number: 'Q-1001', status: 'Sent', party: 'Northwind Robotics', currency: 'USD',
      lines: [
        { productId: pid(1), name: 'Aurora Platform — Growth', qty: 1, unit: 72000 },
        { productId: pid(5), name: 'Onboarding & Implementation', qty: 1, unit: 9000 },
      ],
      discount: 10, tax: 0, notes: 'Annual commitment, net-30.', createdW: '3d', updatedW: '3d',
    },
    {
      id: 'sd-q2', kind: 'quote', number: 'Q-1002', status: 'Accepted', party: 'Prestige Worldwide', currency: 'USD',
      lines: [{ productId: pid(2), name: 'Aurora Platform — Enterprise', qty: 1, unit: 120000 }],
      discount: 5, tax: 0, createdW: '1w', updatedW: '2d',
    },
    {
      id: 'sd-o1', kind: 'order', number: 'SO-2001', status: 'Open', party: 'Helios Retail Group', currency: 'USD',
      lines: [{ productId: pid(8), name: 'Aurora Edge Gateway', qty: 6, unit: 2400 }],
      discount: 0, tax: 8.5, createdW: '2d', updatedW: '1d',
    },
    {
      id: 'sd-p1', kind: 'po', number: 'PO-3001', status: 'Ordered', party: 'Meridian Hardware', currency: 'USD',
      lines: [{ productId: pid(8), name: 'Aurora Edge Gateway', qty: 40, unit: 1150 }],
      discount: 0, tax: 0, notes: 'Restock — desktop & rack-mount.', createdW: '5d', updatedW: '2d',
    },
    {
      id: 'sd-i1', kind: 'invoice', number: 'INV-4001', status: 'Open', party: 'Helios Retail Group', currency: 'USD',
      lines: [{ productId: pid(8), name: 'Aurora Edge Gateway', qty: 6, unit: 2400 }],
      discount: 0, tax: 8.5, dueW: 'in 12d', paid: 0, createdW: '4d', updatedW: '1d',
    },
    {
      id: 'sd-i2', kind: 'invoice', number: 'INV-4002', status: 'Paid', party: 'Prestige Worldwide', currency: 'USD',
      lines: [{ productId: pid(2), name: 'Aurora Platform — Enterprise', qty: 1, unit: 120000 }],
      discount: 5, tax: 0, dueW: 'paid', paid: 114000, createdW: '3w', updatedW: '1w',
    },
    {
      id: 'sd-i3', kind: 'invoice', number: 'INV-4003', status: 'Overdue', party: 'Northwind Robotics', currency: 'USD',
      lines: [
        { productId: pid(1), name: 'Aurora Platform — Growth', qty: 1, unit: 72000 },
        { productId: pid(6), name: 'Premium Support — SLA', qty: 1, unit: 12000 },
      ],
      discount: 0, tax: 0, dueW: '9d overdue', paid: 30000, createdW: '6w', updatedW: '2w',
    },
  ];
}

const STAGE_BY_ID: Record<string, ProductStage> = {
  'PR-104': 'Review', 'PR-107': 'Development', 'PR-110': 'Review',
  'PR-111': 'Backlog', 'PR-113': 'Retired',
};

/** A seed row before lifecycle/record surfaces are attached by `decorate`. */
type SeedRow = Omit<Product, 'stage' | 'acts' | 'docs' | 'media'>;

let actSeq = 5000;
const aid = () => 'pa-' + (++actSeq).toString(36);

/** A small, believable activity history for a seeded product. */
function seedActs(p: SeedRow): Activity[] {
  const owner = 'You';
  const acts: Activity[] = [
    { id: aid(), type: 'note', who: owner, w: p.updatedW, text: `Updated ${p.name} — refreshed positioning and pricing.` },
    { id: aid(), type: 'file', who: 'Nova', w: '1w', text: `Generated brochure for ${p.name}.`, chan: `${p.sku}-brochure.pdf` },
    { id: aid(), type: 'note', who: owner, w: '2w', text: `List price set to ${price(p.price, p.currency)}.` },
    { id: aid(), type: 'note', who: owner, w: p.createdW, text: `${p.name} created as a ${resolveType(p.type).label.toLowerCase()} product.` },
  ];
  return acts;
}

/** Attach lifecycle stage + record surfaces (activity, docs, media) to a seed row. */
function decorate(p: SeedRow): Product {
  const stage: ProductStage = STAGE_BY_ID[p.id] ?? (p.status === 'archived' ? 'Retired' : p.status === 'draft' ? 'Development' : 'Live');
  return {
    ...p,
    stage,
    acts: seedActs(p),
    docs: [
      { n: `${p.sku}-datasheet.pdf`, k: 'pdf' },
      { n: `${p.sku}-brochure.pdf`, k: 'pdf' },
      ...(p.type === 'physical' ? [{ n: `${p.sku}-spec.sheet`, k: 'sheet' as const }] : []),
    ],
    media: [
      { name: 'Hero', emoji: p.image.emoji, hue: p.image.hue },
      { name: 'Detail', emoji: '🖼️', hue: p.image.hue },
    ],
  };
}

/** A broad, realistic catalog that exercises every product type & capability. */
export function seedProducts(): Product[] {
  const list: SeedRow[] = [
    {
      id: pid(1),
      name: 'Aurora Platform — Growth',
      sku: 'AUR-GRW',
      type: 'subscription',
      category: 'Platform',
      status: 'active',
      description: 'The core Aurora workspace for scaling revenue teams — pipelines, automations and Nova AI. Billed annually per org.',
      price: 72000, cost: 15800, currency: 'USD', billing: 'annual', taxRate: 0,
      priceBooks: [
        { book: 'North America', currency: 'USD', price: 72000 },
        { book: 'EMEA', currency: 'EUR', price: 68000 },
        { book: 'UK', currency: 'GBP', price: 58000 },
      ],
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'AR',
      tags: ['flagship', 'annual'],
      image: { emoji: '🚀', hue: '#6366F1' },
      createdW: '8m', updatedW: '2d',
    },
    {
      id: pid(2),
      name: 'Aurora Platform — Enterprise',
      sku: 'AUR-ENT',
      type: 'subscription',
      category: 'Platform',
      status: 'active',
      description: 'Enterprise tier with SSO, audit logs, unlimited pipelines, dedicated CSM and a 99.9% uptime SLA.',
      price: 120000, cost: 24000, currency: 'USD', billing: 'annual', taxRate: 0,
      priceBooks: [
        { book: 'North America', currency: 'USD', price: 120000 },
        { book: 'EMEA', currency: 'EUR', price: 112000 },
      ],
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'AR',
      tags: ['flagship', 'enterprise', 'annual'],
      image: { emoji: '🏢', hue: '#4F46E5' },
      createdW: '8m', updatedW: '5d',
    },
    {
      id: pid(3),
      name: 'Additional Seats — 10 pack',
      sku: 'AUR-SEAT10',
      type: 'subscription',
      category: 'Add-on',
      status: 'active',
      description: 'Expansion seats for existing subscriptions. Co-terms with the parent contract.',
      price: 3600, cost: 400, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'LM',
      tags: ['expansion'],
      image: { emoji: '👥', hue: '#8B5CF6' },
      createdW: '7m', updatedW: '1w',
    },
    {
      id: pid(4),
      name: 'API & Events — Metered',
      sku: 'AUR-API',
      type: 'usage',
      category: 'Add-on',
      status: 'active',
      description: 'Usage-based billing for API calls & event ingestion beyond the plan allowance. Priced in volume tiers per 1k calls.',
      price: 0.9, cost: 0.12, currency: 'USD', billing: 'monthly', taxRate: 0,
      tiers: [
        { upTo: 100000, unit: 0.9 },
        { upTo: 1000000, unit: 0.6 },
        { upTo: null, unit: 0.35 },
      ],
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'JP',
      tags: ['metered', 'developer'],
      image: { emoji: '⚡', hue: '#06B6D4' },
      createdW: '6m', updatedW: '3d',
    },
    {
      id: pid(5),
      name: 'Onboarding & Implementation',
      sku: 'SVC-ONB',
      type: 'service',
      category: 'Service',
      status: 'active',
      description: 'Guided onboarding: data migration, workspace configuration, and admin enablement. Delivered over 6 weeks.',
      price: 9000, cost: 4200, currency: 'USD', billing: 'one_time', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora Services', owner: 'RS',
      tags: ['services', 'onboarding'],
      image: { emoji: '🧭', hue: '#F59E0B' },
      createdW: '8m', updatedW: '2w',
    },
    {
      id: pid(6),
      name: 'Premium Support — SLA',
      sku: 'SUP-PREM',
      type: 'subscription',
      category: 'Support',
      status: 'active',
      description: '24/7 priority support, 1-hour first response, and a named support engineer.',
      price: 12000, cost: 3600, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'RS',
      tags: ['support', 'sla'],
      image: { emoji: '🛟', hue: '#EF4444' },
      createdW: '7m', updatedW: '4d',
    },
    {
      id: pid(7),
      name: 'Advanced Analytics',
      sku: 'AUR-ANLY',
      type: 'subscription',
      category: 'Add-on',
      status: 'active',
      description: 'Warehouse-grade reporting, custom dashboards and forecast modelling.',
      price: 6000, cost: 900, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'JP',
      tags: ['analytics', 'add-on'],
      image: { emoji: '📊', hue: '#3B82F6' },
      createdW: '5m', updatedW: '6d',
    },
    {
      id: pid(8),
      name: 'Aurora Edge Gateway',
      sku: 'HW-EDGE',
      type: 'physical',
      category: 'Hardware',
      status: 'active',
      description: 'On-prem sync appliance for regulated deployments. Ships worldwide; configurable storage & form factor.',
      price: 2400, cost: 1150, currency: 'USD', billing: 'one_time', taxRate: 8.5,
      tracked: true, onHand: 64, committed: 12, reorderPoint: 20, warehouse: 'Reno DC-1',
      variants: [
        { id: 'v1', name: '1TB / Desktop', sku: 'HW-EDGE-1TD', price: 2400, stock: 28 },
        { id: 'v2', name: '1TB / Rack-mount', sku: 'HW-EDGE-1TR', price: 2650, stock: 22 },
        { id: 'v3', name: '4TB / Rack-mount', sku: 'HW-EDGE-4TR', price: 3200, stock: 14 },
      ],
      vendor: 'Meridian Hardware', owner: 'DV',
      tags: ['hardware', 'on-prem'],
      image: { emoji: '📦', hue: '#10B981' },
      createdW: '4m', updatedW: '1d',
    },
    {
      id: pid(9),
      name: 'Data Migration Package',
      sku: 'SVC-MIG',
      type: 'service',
      category: 'Service',
      status: 'active',
      description: 'Legacy CRM extraction, mapping and validated import with a rollback plan.',
      price: 5500, cost: 2700, currency: 'USD', billing: 'one_time', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora Services', owner: 'RS',
      tags: ['services', 'migration'],
      image: { emoji: '🔀', hue: '#F97316' },
      createdW: '3m', updatedW: '1w',
    },
    {
      id: pid(10),
      name: 'Admin Training Voucher',
      sku: 'DIG-TRN',
      type: 'digital',
      category: 'Training',
      status: 'active',
      description: 'Redeemable seat in the live Aurora Admin certification course. Delivered instantly by email.',
      price: 750, cost: 120, currency: 'USD', billing: 'one_time', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora Academy', owner: 'LM',
      tags: ['training', 'digital'],
      image: { emoji: '🎓', hue: '#8B5CF6' },
      createdW: '2m', updatedW: '5d',
    },
    {
      id: pid(11),
      name: 'Mobile SDK — License',
      sku: 'DIG-SDK',
      type: 'digital',
      category: 'Add-on',
      status: 'draft',
      description: 'Per-app licence for the Aurora Mobile SDK. Currently in private beta — pricing under review.',
      price: 4800, cost: 300, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'JP',
      tags: ['developer', 'beta'],
      image: { emoji: '📱', hue: '#A855F7' },
      createdW: '3w', updatedW: '2d',
    },
    {
      id: pid(12),
      name: 'Launch Bundle — Growth + Onboarding',
      sku: 'BND-LAUNCH',
      type: 'bundle',
      category: 'Bundle',
      status: 'active',
      description: 'Everything a new customer needs to go live: the Growth platform, guided onboarding and a year of premium support — priced with a bundle discount.',
      price: 84000, cost: 23600, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      bundleItems: [
        { productId: pid(1), name: 'Aurora Platform — Growth', qty: 1, unit: 72000 },
        { productId: pid(5), name: 'Onboarding & Implementation', qty: 1, unit: 9000 },
        { productId: pid(6), name: 'Premium Support — SLA', qty: 1, unit: 12000 },
      ],
      vendor: 'Aurora, Inc.', owner: 'AR',
      tags: ['bundle', 'popular'],
      image: { emoji: '🎁', hue: '#EC4899' },
      createdW: '2m', updatedW: '6h',
    },
    {
      id: pid(13),
      name: 'Legacy Connector — v1',
      sku: 'AUR-LGC1',
      type: 'digital',
      category: 'Add-on',
      status: 'archived',
      description: 'Deprecated in favour of the native integrations marketplace. Retained for existing contracts only.',
      price: 3000, cost: 500, currency: 'USD', billing: 'annual', taxRate: 0,
      tracked: false, onHand: 0, committed: 0, reorderPoint: 0,
      vendor: 'Aurora, Inc.', owner: 'DV',
      tags: ['legacy'],
      image: { emoji: '🔌', hue: '#94A3B8' },
      createdW: '2y', updatedW: '5m',
    },
  ];
  return list.map(decorate);
}
