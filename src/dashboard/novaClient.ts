// ---------------------------------------------------------------------------
// Nova client — the seam between the deterministic rules engine (ai.ts) and a
// real Claude model.
//
// Why a proxy? This dashboard ships as a single self-contained HTML artifact.
// Two hard constraints make a direct browser → api.anthropic.com call
// impossible:
//   1. The artifact CSP blocks all cross-origin network requests.
//   2. An API key must never live in client-side code.
// So the "real AI" path calls a small server the user hosts themselves, which
// holds the key and forwards to Claude (model `claude-opus-4-8`). If no
// endpoint is configured — the default — Nova answers from the local rules
// engine, so the prototype is fully functional offline with zero setup.
//
// A reference proxy (Node/Express, ~30 lines) is documented in the README.
// ---------------------------------------------------------------------------
import { answerQuery } from './ai';
import type { Deal, Bounds } from './data';
import { kpisFor, fmtMoney, fmtPct } from './data';

export type NovaSource = 'claude' | 'local';

export interface NovaReply {
  text: string;
  source: NovaSource;
}

export interface NovaConfig {
  /** Full URL of the user-hosted proxy, e.g. https://my-proxy.example.com/nova */
  endpoint?: string;
}

/** A compact, model-friendly snapshot of the current view for the proxy prompt. */
function snapshot(deals: Deal[], bounds: Bounds): string {
  const cur = kpisFor(deals, bounds.start, bounds.end);
  const open = deals.filter((d) => d.status === 'open');
  const openVal = open.reduce((s, d) => s + d.amount, 0);
  return [
    `Closed-won revenue this period: ${fmtMoney(cur.revenue)} from ${cur.won} deals.`,
    `Win rate: ${cur.winRate === null ? 'n/a' : fmtPct(cur.winRate)}.`,
    `Open pipeline: ${fmtMoney(openVal)} across ${open.length} deals.`,
    `Average won deal: ${cur.avgDeal === null ? 'n/a' : fmtMoney(cur.avgDeal)}.`,
    `Deals created this period: ${cur.created}.`,
  ].join('\n');
}

/**
 * Ask Nova a question. When an endpoint is configured, POST the question plus a
 * dataset snapshot to the user's proxy and return Claude's answer. On any
 * failure — no endpoint, network error, non-200, malformed body — fall back to
 * the local rules engine so the UI never dead-ends.
 */
export async function askNova(
  question: string,
  deals: Deal[],
  bounds: Bounds,
  now: number,
  cfg: NovaConfig = {},
): Promise<NovaReply> {
  const endpoint = cfg.endpoint?.trim();
  if (!endpoint) {
    return { text: answerQuery(question, deals, bounds, now), source: 'local' };
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: snapshot(deals, bounds) }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const data = (await res.json()) as { text?: string; answer?: string };
    const text = (data.text ?? data.answer ?? '').trim();
    if (!text) throw new Error('empty reply');
    return { text, source: 'claude' };
  } catch {
    // Graceful degradation: annotate that we used the offline engine.
    return {
      text: answerQuery(question, deals, bounds, now),
      source: 'local',
    };
  }
}
