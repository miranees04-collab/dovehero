import type {
  Product,
  ProductType,
  ProductStatus,
  BillingPeriod,
  CurrencyCode,
} from '@/types';

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

export const PRODUCT_STATUSES: Record<ProductStatus, { label: string; tone: 'green' | 'amber' | 'neutral' }> = {
  active: { label: 'Active', tone: 'green' },
  draft: { label: 'Draft', tone: 'amber' },
  archived: { label: 'Archived', tone: 'neutral' },
};

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

/** Deterministic id helper for seeded products. */
const pid = (n: number) => 'PR-' + (100 + n);

/** A broad, realistic catalog that exercises every product type & capability. */
export function seedProducts(): Product[] {
  const list: Product[] = [
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
  return list;
}
