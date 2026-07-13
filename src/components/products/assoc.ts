import type { Deal, Product, StageKey } from '@/types';

export interface DealLink {
  id: string;
  name: string;
  company: string;
  stage: StageKey;
  value: number; // line-item value on this deal
}

export interface ProductLink {
  deals: DealLink[];
  pipeline: number; // sum of line values on open deals
  won: number; // sum of line values on won deals
}

export interface ProductLinks {
  byId: Record<string, ProductLink>;
  totalPipeline: number;
  dealCount: number;
}

const STOP = new Set([
  'aurora', 'platform', 'the', 'and', 'add', 'ons', 'pack', 'tier', 'annual',
  'monthly', 'plan', 'package', 'license', 'for', 'with', 'edge', 'v1',
]);

/** Significant, matchable tokens from a product/line-item label. */
function tokens(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

const OPEN: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation'];

/**
 * Link catalog products to the deals whose line items reference them, by a
 * keyword match. Powers the "In pipeline" KPI and each product's Deals tab —
 * demonstrating the Product ↔ Deal association a real CRM maintains.
 */
export function productDealLinks(products: Product[], deals: Deal[]): ProductLinks {
  const byId: Record<string, ProductLink> = {};
  for (const p of products) {
    const kws = new Set(tokens(p.name));
    const deals_: DealLink[] = [];
    let pipeline = 0;
    let won = 0;
    for (const d of deals) {
      const li = d.products.find((item) => tokens(item.n).some((t) => kws.has(t)));
      if (!li) continue;
      deals_.push({ id: d.id, name: d.name, company: d.company, stage: d.stage, value: li.v });
      if (OPEN.includes(d.stage)) pipeline += li.v;
      else if (d.stage === 'Won') won += li.v;
    }
    byId[p.id] = { deals: deals_, pipeline, won };
  }
  const totalPipeline = Object.values(byId).reduce((s, l) => s + l.pipeline, 0);
  const dealCount = new Set(
    Object.values(byId).flatMap((l) => l.deals.filter((d) => OPEN.includes(d.stage)).map((d) => d.id)),
  ).size;
  return { byId, totalPipeline, dealCount };
}
