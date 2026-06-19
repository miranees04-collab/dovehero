import type { Activity, Deal } from '@/types';

/** Is this activity an inbound message from the client? */
export function isInbound(a: Activity): boolean {
  if (a.type !== 'email' && a.type !== 'whatsapp' && a.type !== 'sms' && a.type !== 'call') return false;
  if (a.thread && a.thread.length) return a.thread[a.thread.length - 1].dir === 'in';
  return a.dir === 'in';
}

/** Inbound (client→us) messages on a deal. */
export function inboundComms(deal: Deal): Activity[] {
  return deal.acts.filter(isInbound);
}

export function inboundCount(deal: Deal): number {
  return inboundComms(deal).length;
}

/** Inbound counts split by channel, for the bubble breakdown. */
export function inboundByChannel(deal: Deal): { type: string; n: number }[] {
  const counts: Record<string, number> = {};
  inboundComms(deal).forEach((a) => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
  return ['email', 'whatsapp', 'sms', 'call']
    .filter((t) => counts[t])
    .map((t) => ({ type: t, n: counts[t] }));
}

/** The most recent inbound message, for previews. */
export function lastInbound(deal: Deal): Activity | undefined {
  return deal.acts.find(isInbound);
}

const COMM_TYPES = ['email', 'whatsapp', 'sms', 'call'];

/** Recent communication activities (newest first) on a deal. */
export function recentComms(deal: Deal, n = 6): Activity[] {
  return deal.acts.filter((a) => COMM_TYPES.includes(a.type)).slice(0, n);
}

/** The most recent communication of any direction (for the bubble preview). */
export function lastComm(deal: Deal): Activity | undefined {
  return deal.acts.find((a) => COMM_TYPES.includes(a.type));
}

/** Last message text + direction on an activity. */
export function lastMessage(a: Activity): { text: string; dir: 'in' | 'out'; who: string; w: string } {
  if (a.thread && a.thread.length) {
    const m = a.thread[a.thread.length - 1];
    return { text: m.text, dir: m.dir, who: m.who, w: m.w };
  }
  return { text: a.text ?? a.subj ?? '', dir: a.dir ?? 'out', who: a.who, w: a.w };
}
