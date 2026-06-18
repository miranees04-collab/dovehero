import type { Deal } from '@/types';

export interface DerivedLine { id: string; name: string; qty: number; unit: number; total: number }
export interface DerivedAsset {
  id: string;
  kind: 'quote' | 'contract' | 'invoice' | 'file';
  name: string;
  total: number;
  status: string;
  sub: string;
  file: string;
}

const STATUS_COLORS: Record<string, string> = {
  Paid: '#10B981', Signed: '#10B981', Accepted: '#10B981',
  Sent: '#3B82F6', Viewed: '#8B5CF6', 'In review': '#F59E0B',
  Draft: '#7E8AA8', Expired: '#EF4444', Void: '#EF4444', Overdue: '#EF4444',
};
export function assetStatusColor(s: string): string { return STATUS_COLORS[s] ?? '#7E8AA8'; }

/** Derive demo associations (line items, quote, contract, invoices, files)
 *  for a deal — mirrors the prototype's assocFor(). */
export function assocFor(deal: Deal): {
  li: DerivedLine[];
  liTotal: number;
  quotes: DerivedAsset[];
  contract: DerivedAsset;
  invoices: DerivedAsset[];
  files: { n: string; k: string }[];
} {
  const base = deal.products.length ? deal.products : [{ n: `${deal.industry || 'Platform'} subscription — annual`, v: deal.value || 20000 }];
  const qtys = [1, 1, 2, 1, 3, 1];
  const li: DerivedLine[] = base.map((p, i) => {
    const qty = qtys[i % qtys.length];
    const unit = Math.round((p.v || 0) / qty);
    return { id: `${deal.id}-L${i + 1}`, name: p.n, qty, unit, total: p.v || 0 };
  });
  const liTotal = li.reduce((a, x) => a + x.total, 0);
  const num = deal.id.replace(/\D/g, '') || '000';
  const st = deal.stage;

  const qStatus = st === 'Won' ? 'Accepted' : st === 'Lost' ? 'Expired' : st === 'Negotiation' ? 'Viewed' : st === 'Proposal' ? 'Sent' : 'Draft';
  const derivedQuote: DerivedAsset = {
    id: `Q-${num}`, kind: 'quote', name: `Quote Q-${num}`, total: liTotal, status: qStatus,
    sub: `${fmt(liTotal)} · valid to ${deal.close || '—'}`, file: `Quote Q-${num}.pdf`,
  };
  // Include any user-generated quotes too.
  const userQuotes: DerivedAsset[] = (deal.quotes ?? []).map((q) => ({
    id: q.id, kind: 'quote', name: `Quote ${q.id}`, total: q.total, status: q.status,
    sub: `${fmt(q.total)} · ${q.status}`, file: `${q.id}.pdf`,
  }));
  const quotes = [derivedQuote, ...userQuotes];

  const cStatus = st === 'Won' ? 'Signed' : st === 'Negotiation' ? 'In review' : st === 'Lost' ? 'Void' : 'Draft';
  const contract: DerivedAsset = {
    id: `C-${num}`, kind: 'contract', name: `MSA — ${deal.company}`, total: liTotal, status: cStatus,
    sub: `${fmt(liTotal)} · 12 months`, file: `MSA — ${deal.company}.pdf`,
  };

  const invoices: DerivedAsset[] = [];
  if (st === 'Won') {
    const half = Math.round(liTotal * 0.5);
    invoices.push({ id: `INV-${num}-A1`, kind: 'invoice', name: `INV-${num}-A1`, total: half, status: 'Paid', sub: `${fmt(half)} · paid`, file: `Invoice INV-${num}-A1.pdf` });
    invoices.push({ id: `INV-${num}-A2`, kind: 'invoice', name: `INV-${num}-A2`, total: liTotal - half, status: 'Sent', sub: `${fmt(liTotal - half)} · due ${deal.close || '—'}`, file: `Invoice INV-${num}-A2.pdf` });
  } else if (st === 'Negotiation') {
    invoices.push({ id: `INV-${num}-D1`, kind: 'invoice', name: `INV-${num}-D1`, total: liTotal, status: 'Draft', sub: `${fmt(liTotal)} · draft`, file: `Invoice INV-${num}-D1.pdf` });
  }
  (deal.invoices ?? []).forEach((v) => invoices.push({
    id: v.id, kind: 'invoice', name: v.id, total: v.total, status: v.status,
    sub: `${fmt(v.total)} · ${v.status}`, file: `${v.id}.pdf`,
  }));

  const files = deal.docs.map((d) => ({ n: d.n, k: d.k }));
  return { li, liTotal, quotes, contract, invoices, files };
}

function fmt(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + n;
}
