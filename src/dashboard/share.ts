// ---------------------------------------------------------------------------
// Share & export helpers.
//
// Front-end only: exports build real files from the report engine's output
// (CSV opens in Excel/Sheets; an .xls HTML workbook opens natively in Excel;
// PDF is produced through the browser's print dialog). "Live links" are mock
// URLs — there is no backend — but they are generated realistically so the
// sharing flow reads true.
// ---------------------------------------------------------------------------
import { runReport, OBJECTS, type ReportConfig, type EngineCtx } from './reportEngine';
import { measureLabel } from './ReportView';

export interface ExportTable {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  note?: string; // set instead of headers/rows when a tile can't be tabulated
}

const round = (n: number, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

/** Turn a report config's computed result into a flat table for export. */
export function reportTable(cfg: ReportConfig, ctx: EngineCtx): ExportTable {
  const res = runReport(cfg, ctx);
  const title = cfg.title || 'Report';
  const dimLabel = cfg.dimension
    ? OBJECTS[cfg.object].fields.find((f) => f.key === cfg.dimension!.field)?.label ?? 'Group'
    : 'Group';
  const mLabel = measureLabel(cfg);
  const numFmt = (v: number) => (res.unit === 'pct' ? round(v, 1) : round(v));

  // Cohort retention grid.
  if (res.cohort && res.cohortCols) {
    return {
      title,
      headers: ['Cohort', 'Deals', ...res.cohortCols.map((c) => `${c}mo`)],
      rows: res.cohort.map((r) => [r.label, r.base, ...r.cells.map((v) => (v === null ? '' : round(v)))]),
    };
  }

  // Scatter / quadrant.
  if (res.scatter) {
    const yLabel = cfg.measureY ? measureLabel(cfg, cfg.measureY) : 'Y';
    return {
      title,
      headers: [dimLabel, mLabel, yLabel, 'Records'],
      rows: res.scatter.map((p) => [p.label, round(p.x), round(p.y), p.n]),
    };
  }

  // Single value (KPI / gauge / pace / no dimension).
  if (!cfg.dimension || cfg.viz === 'kpi' || cfg.viz === 'gauge' || cfg.viz === 'pace') {
    const rows: Array<Array<string | number>> = [[mLabel, numFmt(res.value)]];
    if (res.prevValue !== null) rows.push([`${mLabel} — comparison`, numFmt(res.prevValue)]);
    if (cfg.goal != null) rows.push(['Target', numFmt(cfg.goal)]);
    return { title, headers: ['Metric', 'Value'], rows };
  }

  // Matrix cross-tab (dimension × breakdown).
  if (cfg.breakdown && res.seriesKeys[0] !== 'value') {
    return {
      title,
      headers: [dimLabel, ...res.seriesKeys],
      rows: res.points.map((p) => [p.label, ...res.seriesKeys.map((k) => numFmt(p.series[k] ?? 0))]),
    };
  }

  // Grouped single-series (bar/hbar/line/area/pie/donut/funnel/table/leaderboard).
  return {
    title,
    headers: [dimLabel, mLabel],
    rows: res.points.map((p) => [p.label, numFmt(p.value)]),
  };
}

const csvEsc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tableToCsv(t: ExportTable): string {
  if (t.note) return `# ${t.title}\r\n${t.note}`;
  return [t.headers.map(csvEsc).join(','), ...t.rows.map((r) => r.map(csvEsc).join(','))].join('\r\n');
}

/** One CSV document for a whole dashboard, one section per tile. */
export function dashboardCsv(tables: ExportTable[]): string {
  return tables.map((t) => `# ${t.title}\r\n${t.note ? t.note : tableToCsv(t)}`).join('\r\n\r\n');
}

const htmlEsc = (v: string | number) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An .xls workbook (HTML-table flavour) that Excel opens natively. */
export function tablesToXls(tables: ExportTable[]): string {
  const body = tables
    .map((t) => {
      const span = Math.max(1, t.headers.length);
      const head = `<tr><td colspan="${span}" style="background:#2a78d6;color:#fff;font-weight:bold">${htmlEsc(t.title)}</td></tr>`;
      if (t.note) return `${head}<tr><td colspan="${span}">${htmlEsc(t.note)}</td></tr><tr><td></td></tr>`;
      const cols = `<tr>${t.headers.map((h) => `<th style="background:#e5edf5">${htmlEsc(h)}</th>`).join('')}</tr>`;
      const rows = t.rows.map((r) => `<tr>${r.map((c) => `<td>${htmlEsc(c)}</td>`).join('')}</tr>`).join('');
      return `${head}${cols}${rows}<tr><td></td></tr>`;
    })
    .join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #cbd6e2;padding:4px 8px;font-family:Arial;font-size:12px;mso-number-format:'\\@'}</style></head><body><table>${body}</table></body></html>`;
}

const fileSafe = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'export';

/** Trigger a real file download from in-memory text. */
export function downloadText(name: string, text: string, mime: string, ext: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileSafe(name)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

export const downloadCsv = (name: string, tables: ExportTable[]) =>
  downloadText(name, tables.length === 1 ? tableToCsv(tables[0]) : dashboardCsv(tables), 'text/csv;charset=utf-8', 'csv');

export const downloadXls = (name: string, tables: ExportTable[]) =>
  downloadText(name, tablesToXls(tables), 'application/vnd.ms-excel', 'xls');

/** Deterministic short token (no Math.random — unavailable in some contexts). */
export function linkToken(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

/** A realistic (mock) share URL. */
export function shareLink(kind: 'dashboard' | 'report', name: string, token: string): string {
  return `https://app.dovehero.io/share/${kind === 'dashboard' ? 'd' : 'r'}/${fileSafe(name).slice(0, 40)}-${token}`;
}

/** Best-effort clipboard copy with a legacy fallback; resolves to success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
