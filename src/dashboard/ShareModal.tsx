// ---------------------------------------------------------------------------
// Share & export modal — used for a whole dashboard or a single report.
// Three tabs: Live link · Email · Export (CSV / Excel / PDF).
// Links and email sends are mocked (no backend); CSV/Excel/PDF are real.
// ---------------------------------------------------------------------------
import { useMemo, useState } from 'react';
import {
  Link2, Mail, Download, FileSpreadsheet, FileText, Printer, Copy, Check, X,
  Clock, Globe, Send, Paperclip,
} from 'lucide-react';
import {
  shareLink, linkToken, copyText, downloadCsv, downloadXls, isEmail, type ExportTable,
} from './share';

type Scope = { kind: 'dashboard' | 'report'; name: string };

export function ShareModal({
  scope, tables, onPrint, onToast, onClose,
}: {
  scope: Scope;
  tables: ExportTable[];
  onPrint?: () => void;
  onToast: (m: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'link' | 'email' | 'export'>('link');
  const noun = scope.kind === 'dashboard' ? 'dashboard' : 'report';

  // ---- Live link ----
  const [access, setAccess] = useState('view');
  const [expiry, setExpiry] = useState('never');
  const [copied, setCopied] = useState(false);
  const token = useMemo(() => linkToken(`${scope.kind}:${scope.name}:${access}:${expiry}`), [scope, access, expiry]);
  const link = shareLink(scope.kind, scope.name, token);
  const doCopy = async () => {
    const ok = await copyText(link);
    setCopied(ok);
    onToast(ok ? 'Live link copied to clipboard' : 'Copy failed — select the link manually');
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  // ---- Email ----
  const [recips, setRecips] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState(`“${scope.name}” ${noun} report`);
  const [message, setMessage] = useState(`Hi,\n\nHere's the latest “${scope.name}” ${noun}. The live view stays up to date.\n\nThanks`);
  const [freq, setFreq] = useState('once');
  const [attach, setAttach] = useState(true);
  const addRecip = () => {
    const parts = draft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid = parts.filter(isEmail);
    if (valid.length) setRecips((r) => [...new Set([...r, ...valid])]);
    setDraft('');
  };
  const send = () => {
    if (!recips.length) return;
    const who = `${recips.length} recipient${recips.length === 1 ? '' : 's'}`;
    const how = freq === 'once' ? 'Emailed' : `Scheduled (${FREQ_LABEL[freq]})`;
    onToast(`${how} to ${who}${attach ? ' with CSV attached' : ''} — mock send`);
    onClose();
  };

  // ---- Export ----
  const totalRows = tables.reduce((n, t) => n + (t.rows?.length ?? 0), 0);
  const previewTable = tables.find((t) => !t.note && t.rows.length > 0);
  const exportableCount = tables.filter((t) => !t.note).length;

  return (
    <div className="cd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal share" role="dialog" aria-label={`Share ${noun}`}>
        <div className="cd-modal-head">
          <Send size={16} style={{ color: 'var(--accent)' }} />
          <h2>Share “{scope.name}”</h2>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="cd-share-tabs">
          <button className={`cd-btab ${tab === 'link' ? 'on' : ''}`} onClick={() => setTab('link')}><Link2 size={14} /> Live link</button>
          <button className={`cd-btab ${tab === 'email' ? 'on' : ''}`} onClick={() => setTab('email')}><Mail size={14} /> Email</button>
          <button className={`cd-btab ${tab === 'export' ? 'on' : ''}`} onClick={() => setTab('export')}><Download size={14} /> Export</button>
        </div>

        <div className="cd-share-body">
          {tab === 'link' && (
            <>
              <p className="cd-fnote" style={{ marginTop: 0 }}>
                Anyone with this link opens a live, always-current view of the {noun}. Recipients don't need an account.
              </p>
              <div className="cd-share-linkrow">
                <input className="cd-input" readOnly value={link} onFocus={(e) => e.target.select()} />
                <button className="cd-btn primary" onClick={doCopy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div className="cd-inline" style={{ marginTop: 12 }}>
                <label className="cd-frow">
                  <span className="cd-flabel"><Globe size={13} /> Who can access</span>
                  <select className="cd-select" value={access} onChange={(e) => setAccess(e.target.value)}>
                    <option value="view">Anyone with the link · view only</option>
                    <option value="workspace">People in your workspace</option>
                    <option value="invited">Only invited people</option>
                  </select>
                </label>
                <label className="cd-frow">
                  <span className="cd-flabel"><Clock size={13} /> Link expires</span>
                  <select className="cd-select" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                    <option value="never">Never</option>
                    <option value="7">In 7 days</option>
                    <option value="30">In 30 days</option>
                    <option value="90">In 90 days</option>
                  </select>
                </label>
              </div>
              <p className="cd-fnote">Prototype — links are generated but not backed by a live server.</p>
            </>
          )}

          {tab === 'email' && (
            <>
              <label className="cd-frow">
                <span className="cd-flabel">Recipients</span>
                <div className="cd-recip-box">
                  {recips.map((r) => (
                    <span key={r} className="cd-tiletag">{r}<button className="cd-tag-x" onClick={() => setRecips((rs) => rs.filter((x) => x !== r))} aria-label={`Remove ${r}`}>×</button></span>
                  ))}
                  <input
                    className="cd-input cd-tag-input"
                    value={draft}
                    placeholder={recips.length ? 'Add another…' : 'name@company.com'}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addRecip(); } }}
                    onBlur={addRecip}
                  />
                </div>
              </label>
              {draft && !isEmail(draft) && <p className="cd-fnote" style={{ color: 'var(--warn)' }}>Enter a valid email, then press Enter.</p>}
              <label className="cd-frow">
                <span className="cd-flabel">Subject</span>
                <input className="cd-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="cd-frow">
                <span className="cd-flabel">Message</span>
                <textarea className="cd-input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} style={{ resize: 'vertical' }} />
              </label>
              <div className="cd-inline">
                <label className="cd-frow">
                  <span className="cd-flabel"><Clock size={13} /> Delivery</span>
                  <select className="cd-select" value={freq} onChange={(e) => setFreq(e.target.value)}>
                    <option value="once">Send once now</option>
                    <option value="daily">Every morning</option>
                    <option value="weekly">Weekly · Monday 8am</option>
                    <option value="monthly">Monthly · 1st</option>
                  </select>
                </label>
                <label className="cd-check" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
                  <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                  <Paperclip size={13} /> Attach data (CSV)
                </label>
              </div>
              <div className="cd-builder-actions" style={{ marginTop: 4 }}>
                <button className="cd-btn ghost" onClick={onClose}>Cancel</button>
                <button className="cd-btn primary" onClick={send} disabled={!recips.length}>
                  <Send size={15} /> {freq === 'once' ? 'Send now' : 'Schedule report'}
                </button>
              </div>
            </>
          )}

          {tab === 'export' && (
            <>
              <p className="cd-fnote" style={{ marginTop: 0 }}>
                {scope.kind === 'dashboard'
                  ? `${exportableCount} of ${tables.length} tiles export data · ${totalRows} rows total`
                  : `${totalRows} rows of data`}
              </p>
              <div className="cd-export-grid">
                <button className="cd-export-card" onClick={() => { downloadCsv(scope.name, tables); onToast('CSV downloaded'); }}>
                  <FileText size={22} />
                  <b>CSV</b>
                  <small>Raw data · opens in Excel or Sheets</small>
                </button>
                <button className="cd-export-card" onClick={() => { downloadXls(scope.name, tables); onToast('Excel workbook downloaded'); }}>
                  <FileSpreadsheet size={22} />
                  <b>Excel (.xls)</b>
                  <small>Formatted workbook</small>
                </button>
                {onPrint && (
                  <button className="cd-export-card" onClick={() => { onClose(); onPrint(); }}>
                    <Printer size={22} />
                    <b>PDF</b>
                    <small>Print-ready · Save as PDF</small>
                  </button>
                )}
              </div>
              {previewTable && (
                <div className="cd-export-preview">
                  <div className="cd-flabel" style={{ marginBottom: 6 }}>Preview — {previewTable.title}</div>
                  <div className="cd-tablewrap">
                    <table className="cd-table">
                      <thead><tr>{previewTable.headers.map((h) => <th key={h} className="num">{h}</th>)}</tr></thead>
                      <tbody>
                        {previewTable.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>{r.map((c, j) => <td key={j} className="num">{String(c)}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewTable.rows.length > 5 && <p className="cd-fnote">+ {previewTable.rows.length - 5} more rows</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FREQ_LABEL: Record<string, string> = {
  once: 'once', daily: 'daily', weekly: 'weekly', monthly: 'monthly',
};
