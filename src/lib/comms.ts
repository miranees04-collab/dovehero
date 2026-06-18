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

/** The most recent inbound message, for previews. */
export function lastInbound(deal: Deal): Activity | undefined {
  return deal.acts.find(isInbound);
}
