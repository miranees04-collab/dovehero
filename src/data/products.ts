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
  Payment,
  PaymentStatus,
  Subscription,
  SubInterval,
  SubStatus,
  Connector,
  ConnectorCategory,
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

/** Human due label from a days-to-due number (negative = overdue). */
export function dueLabel(days?: number): string {
  if (days == null) return '—';
  if (days === 0) return 'due today';
  return days > 0 ? `in ${days}d` : `${-days}d overdue`;
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '60+';
export function agingBucket(days: number): AgingBucket {
  if (days >= 0) return 'current';
  const od = -days;
  return od <= 30 ? '1-30' : od <= 60 ? '31-60' : '60+';
}
export const AGING_BUCKETS: { k: AgingBucket; label: string; tone: 'green' | 'amber' | 'red' }[] = [
  { k: 'current', label: 'Current', tone: 'green' },
  { k: '1-30', label: '1–30 days', tone: 'amber' },
  { k: '31-60', label: '31–60 days', tone: 'amber' },
  { k: '60+', label: '60+ days', tone: 'red' },
];
/** Outstanding balance grouped into aging buckets. */
export function invoiceAging(invoices: SalesDoc[]): Record<AgingBucket, number> {
  const buckets: Record<AgingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '60+': 0 };
  for (const d of invoices) {
    if (!['Open', 'Overdue'].includes(d.status)) continue;
    buckets[agingBucket(d.dueDays ?? 30)] += docBalance(d);
  }
  return buckets;
}

export const checkoutUrl = (inv: SalesDoc) => `https://pay.dovehero.app/i/${inv.number.toLowerCase()}`;

/** A printable HTML document (used for "Download PDF"). */
export function docHtml(d: SalesDoc): string {
  const meta = DOC_META[d.kind];
  const t = docTotals(d);
  const sym = CURRENCIES[d.currency].symbol;
  const rows = d.lines.map((l) => `<tr><td>${l.name}</td><td class=r>${l.qty}</td><td class=r>${sym}${l.unit.toLocaleString()}</td><td class=r>${sym}${(l.qty * l.unit).toLocaleString()}</td></tr>`).join('');
  const extra = d.kind === 'invoice'
    ? `<tr><td colspan=3 class=r>Paid</td><td class=r>${sym}${(d.paid || 0).toLocaleString()}</td></tr><tr class=due><td colspan=3 class=r><b>Balance due</b></td><td class=r><b>${sym}${docBalance(d).toLocaleString()}</b></td></tr>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${d.number}</title><style>
    body{font-family:Inter,system-ui,sans-serif;color:#1a1d29;max-width:760px;margin:40px auto;padding:0 24px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${meta.hue};padding-bottom:16px}
    h1{margin:0;font-size:26px;color:${meta.hue}} .n{font-family:monospace;color:#6b7185}
    table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}
    th,td{padding:9px 8px;border-bottom:1px solid #e8eaf0;text-align:left} .r{text-align:right}
    .tot td{border:none;padding-top:6px} tr.due td{border-top:2px solid #1a1d29;font-size:16px}
    .meta{margin-top:8px;color:#6b7185;font-size:13px}</style></head><body>
    <div class="head"><div><h1>${meta.label}</h1><div class="n">${d.number}</div></div>
    <div style="text-align:right"><b>Dovehero</b><div class="meta">${meta.partyLabel}: ${d.party || '—'}</div>
    ${d.kind === 'invoice' ? `<div class="meta">Due ${dueLabel(d.dueDays)}</div>` : ''}</div></div>
    <table><thead><tr><th>Item</th><th class=r>Qty</th><th class=r>Unit</th><th class=r>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot class="tot"><tr><td colspan=3 class=r>Subtotal</td><td class=r>${sym}${t.subtotal.toLocaleString()}</td></tr>
    ${d.discount ? `<tr><td colspan=3 class=r>Discount ${d.discount}%</td><td class=r>−${sym}${t.discountAmt.toLocaleString()}</td></tr>` : ''}
    ${d.tax ? `<tr><td colspan=3 class=r>Tax ${d.tax}%</td><td class=r>${sym}${t.taxAmt.toLocaleString()}</td></tr>` : ''}
    <tr class="${d.kind === 'invoice' ? '' : 'due'}"><td colspan=3 class=r><b>Total</b></td><td class=r><b>${sym}${t.total.toLocaleString()}</b></td></tr>
    ${extra}</tfoot></table>
    ${d.notes ? `<p class="meta">${d.notes}</p>` : ''}
    <p class="meta">Generated by Dovehero · pay online at ${checkoutUrl(d)}</p></body></html>`;
}

// ---- Payments ----
export const PAYMENT_METHODS = ['Card', 'ACH', 'Wire', 'Cash'] as const;
export function payStatusTone(s: PaymentStatus): 'green' | 'amber' | 'red' | 'neutral' {
  return s === 'Succeeded' ? 'green' : s === 'Pending' ? 'amber' : s === 'Failed' ? 'red' : 'neutral';
}

// ---- Subscriptions (recurring billing) ----
export const SUB_INTERVALS: { k: SubInterval; label: string; perMonth: number }[] = [
  { k: 'monthly', label: 'Monthly', perMonth: 1 },
  { k: 'quarterly', label: 'Quarterly', perMonth: 1 / 3 },
  { k: 'annual', label: 'Annual', perMonth: 1 / 12 },
];
export const SUB_STATUSES: SubStatus[] = ['Active', 'Paused', 'Cancelled'];
export function subStatusTone(s: SubStatus): 'green' | 'amber' | 'red' | 'neutral' {
  return s === 'Active' ? 'green' : s === 'Paused' ? 'amber' : 'red';
}
export const intervalLabel = (k: SubInterval) => SUB_INTERVALS.find((i) => i.k === k)?.label ?? k;
/** Normalized monthly recurring revenue for a subscription. */
export function mrrOf(s: Subscription): number {
  const total = s.lines.reduce((a, l) => a + l.qty * l.unit, 0);
  const factor = SUB_INTERVALS.find((i) => i.k === s.interval)?.perMonth ?? 1;
  return Math.round(total * factor);
}

export function seedPayments(): Payment[] {
  return [
    { id: 'pay-1', number: 'PAY-5001', invoiceId: 'sd-i2', invoiceNumber: 'INV-4002', party: 'Prestige Worldwide', amount: 114000, currency: 'USD', method: 'Wire', status: 'Succeeded', w: '1w' },
    { id: 'pay-2', number: 'PAY-5002', invoiceId: 'sd-i3', invoiceNumber: 'INV-4003', party: 'Northwind Robotics', amount: 30000, currency: 'USD', method: 'Card', status: 'Succeeded', w: '2w' },
    { id: 'pay-3', number: 'PAY-5003', party: 'Helios Retail Group', amount: 4200, currency: 'USD', method: 'ACH', status: 'Pending', w: '2d' },
  ];
}

// ---- Connectors / integrations ----
export const CONNECTOR_CATEGORIES: ConnectorCategory[] = ['Payments', 'Accounting', 'E-commerce', 'Ops'];

export function seedConnectors(): Connector[] {
  return [
    { k: 'stripe', name: 'Stripe', category: 'Payments', emoji: '💳', hue: '#635BFF', blurb: 'Card & ACH processing that powers checkout and the Payments object.', syncs: 'Payments', connected: true, lastSyncW: '2h', syncedCount: 3 },
    { k: 'paypal', name: 'PayPal', category: 'Payments', emoji: '🅿️', hue: '#003087', blurb: 'Accept PayPal & Venmo on invoices and payment links.', syncs: 'Payments', connected: false },
    { k: 'quickbooks', name: 'QuickBooks', category: 'Accounting', emoji: '📗', hue: '#2CA01C', blurb: 'Push invoices & payments to your ledger; sync paid status back.', syncs: 'Invoices', connected: true, lastSyncW: '1d', syncedCount: 4 },
    { k: 'xero', name: 'Xero', category: 'Accounting', emoji: '🔵', hue: '#13B5EA', blurb: 'Two-way sync of invoices and payments with Xero.', syncs: 'Invoices', connected: false },
    { k: 'shopify', name: 'Shopify', category: 'E-commerce', emoji: '🛍️', hue: '#95BF47', blurb: 'Sync products and import orders from your Shopify storefront.', syncs: 'Products · Orders', connected: false },
    { k: 'woocommerce', name: 'WooCommerce', category: 'E-commerce', emoji: '🟣', hue: '#7F54B3', blurb: 'Import WooCommerce products and orders into the catalog.', syncs: 'Products · Orders', connected: false },
    { k: 'salesforce', name: 'Salesforce', category: 'Ops', emoji: '☁️', hue: '#00A1E0', blurb: 'Keep products and accounts in sync with Salesforce CRM.', syncs: 'Products · Accounts', connected: false },
    { k: 'slack', name: 'Slack', category: 'Ops', emoji: '💬', hue: '#4A154B', blurb: 'Notify a channel when quotes are accepted or invoices go overdue.', syncs: 'Notifications', connected: true, lastSyncW: '5m', syncedCount: 12 },
    { k: 'gmail', name: 'Gmail', category: 'Ops', emoji: '✉️', hue: '#EA4335', blurb: 'Send quotes, invoices and reminders from your inbox.', syncs: 'Email', connected: false },
  ];
}

/** Extra demo products a Shopify/Woo sync would pull in. */
export function connectorDemoProducts(): { name: string; sku: string; price: number; cost: number; category: string }[] {
  return [
    { name: 'Aurora Tee', sku: 'SHOP-TEE', price: 29, cost: 8, category: 'Hardware' },
    { name: 'Aurora Mug', sku: 'SHOP-MUG', price: 15, cost: 4, category: 'Hardware' },
    { name: 'Sticker Sheet', sku: 'SHOP-STK', price: 6, cost: 1, category: 'Hardware' },
    { name: 'Hoodie — Aurora', sku: 'SHOP-HOOD', price: 55, cost: 18, category: 'Hardware' },
  ];
}

export function seedSubscriptions(): Subscription[] {
  return [
    { id: 'sub-1', number: 'SUB-6001', party: 'Prestige Worldwide', currency: 'USD', interval: 'annual', status: 'Active', startedW: '5m', nextW: 'in 7m', cycleRemaining: 0.6, lines: [{ productId: pid(2), name: 'Aurora Platform — Enterprise', qty: 1, unit: 120000 }, { productId: pid(6), name: 'Premium Support — SLA', qty: 1, unit: 12000 }] },
    { id: 'sub-2', number: 'SUB-6002', party: 'Helios Retail Group', currency: 'USD', interval: 'annual', status: 'Active', startedW: '2m', nextW: 'in 10m', cycleRemaining: 0.83, lines: [{ productId: pid(1), name: 'Aurora Platform — Growth', qty: 1, unit: 72000 }] },
    { id: 'sub-3', number: 'SUB-6003', party: 'Vantage Cloud', currency: 'USD', interval: 'monthly', status: 'Active', startedW: '3w', nextW: 'in 1w', cycleRemaining: 0.25, lines: [{ productId: pid(3), name: 'Additional Seats — 10 pack', qty: 3, unit: 300 }] },
    { id: 'sub-4', number: 'SUB-6004', party: 'Orbit Health', currency: 'USD', interval: 'annual', status: 'Paused', startedW: '8m', nextW: 'paused', cycleRemaining: 0, lines: [{ productId: pid(7), name: 'Advanced Analytics', qty: 1, unit: 6000 }] },
  ];
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
      discount: 0, tax: 8.5, dueDays: 12, paid: 0, createdW: '4d', updatedW: '1d',
    },
    {
      id: 'sd-i2', kind: 'invoice', number: 'INV-4002', status: 'Paid', party: 'Prestige Worldwide', currency: 'USD',
      lines: [{ productId: pid(2), name: 'Aurora Platform — Enterprise', qty: 1, unit: 120000 }],
      discount: 5, tax: 0, dueDays: 0, paid: 114000, createdW: '3w', updatedW: '1w',
    },
    {
      id: 'sd-i3', kind: 'invoice', number: 'INV-4003', status: 'Overdue', party: 'Northwind Robotics', currency: 'USD',
      lines: [
        { productId: pid(1), name: 'Aurora Platform — Growth', qty: 1, unit: 72000 },
        { productId: pid(6), name: 'Premium Support — SLA', qty: 1, unit: 12000 },
      ],
      discount: 0, tax: 0, dueDays: -42, paid: 30000, dunning: 1, createdW: '6w', updatedW: '2w',
    },
    {
      id: 'sd-i4', kind: 'invoice', number: 'INV-4004', status: 'Overdue', party: 'Meridian Logistics', currency: 'USD',
      lines: [{ productId: pid(5), name: 'Onboarding & Implementation', qty: 1, unit: 9000 }],
      discount: 0, tax: 0, dueDays: -12, paid: 0, dunning: 0, createdW: '5w', updatedW: '3w',
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
