export function money(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (Math.abs(n) >= 1_000) return '$' + Math.round(n / 1000) + 'k';
    return '$' + n;
  }
  return '$' + n.toLocaleString('en-US');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function pct(n: number): string {
  return Math.round(n) + '%';
}

/** Parse the seed's relative-time labels ("2h","1d","3w","today") into hours-ago. */
export function ageHours(w: string): number {
  if (!w) return 0;
  if (/today|now/i.test(w)) return 1;
  const m = /(\d+)\s*([hdwm])/i.exec(w);
  if (!m) return 24;
  const n = +m[1];
  const unit = m[2].toLowerCase();
  return unit === 'h' ? n : unit === 'd' ? n * 24 : unit === 'w' ? n * 24 * 7 : n * 24 * 30;
}

export function staleDays(lastW: string | undefined): number {
  if (!lastW) return 99;
  return Math.round(ageHours(lastW) / 24);
}

let idSeq = Date.now();
export function uid(prefix = 'id'): string {
  return prefix + '-' + (++idSeq).toString(36);
}
