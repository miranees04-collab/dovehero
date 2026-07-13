import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button, Badge } from '@/components/ui/primitives';
import { useStore } from '@/store/useStore';
import { uid } from '@/lib/format';
import type { Product } from '@/types';
import { resolveType, BILLING_LABEL, price as fmtPrice, type TypeMeta } from '@/data/products';

/** A customer-facing one-page brochure for a product, with email send + export. */
export function Brochure({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const addProductActivity = useStore((s) => s.addProductActivity);
  const customTypes = useStore((s) => s.productTypes);
  const toast = useStore((s) => s.toast);
  const [mode, setMode] = useState<'preview' | 'email'>('preview');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(`${p.name} — product brochure`);
  const [message, setMessage] = useState(`Hi,\n\nSharing the brochure for ${p.name}. Happy to set up a walkthrough whenever suits.\n\nBest,\nAmara`);

  const fileName = `${p.sku}-brochure.pdf`;
  const meta = resolveType(p.type, customTypes);
  const highlights = (p.tags ?? []).slice(0, 6);

  const send = () => {
    const dest = to.trim();
    if (!dest) { toast('Add a recipient email', 'warn'); return; }
    addProductActivity(p.id, {
      id: uid('pa'), type: 'email', who: 'You', w: 'now', subj: subject.trim() || fileName,
      dir: 'out', status: 'sent', chan: dest, attach: [fileName],
      thread: [{ dir: 'out', who: 'You', w: 'now', text: message.trim() }],
    });
    toast(`Brochure sent to ${dest}`, 'success');
    onClose();
  };

  const download = () => {
    const html = brochureHtml(p, meta);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${p.sku}-brochure.html`; a.click();
    URL.revokeObjectURL(url);
    addProductActivity(p.id, { id: uid('pa'), type: 'file', who: 'You', w: 'now', text: `Downloaded brochure`, chan: fileName });
    toast('Brochure downloaded', 'success');
  };

  const copyLink = async () => {
    const link = `https://share.dovehero.app/p/${p.sku.toLowerCase()}`;
    try { await navigator.clipboard.writeText(link); toast('Share link copied', 'success'); }
    catch { toast(link, 'default'); }
  };

  return (
    <>
      <div className="dh-pw-scrim center" onClick={onClose} />
      <div className="dh-broch-modal" role="dialog" aria-label={`${p.name} brochure`}>
        <div className="dh-broch-head">
          <b><Icon name="fileText" size={15} /> Brochure — {p.name}</b>
          <div className="dh-broch-head-actions">
            <button className={`dh-broch-tab ${mode === 'preview' ? 'on' : ''}`} onClick={() => setMode('preview')}>Preview</button>
            <button className={`dh-broch-tab ${mode === 'email' ? 'on' : ''}`} onClick={() => setMode('email')}><Icon name="mail" size={13} /> Email</button>
            <button className="dh-pw-x" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>
        </div>

        <div className="dh-broch-body">
          {/* The brochure itself */}
          <div className="dh-broch-page">
            <div className="dh-broch-cover" style={{ background: `linear-gradient(135deg, ${p.image.hue}, ${p.image.hue}cc)` }}>
              <span className="dh-broch-emoji">{p.image.emoji}</span>
              <div className="dh-broch-cover-txt">
                <span className="dh-broch-kicker">{meta.label} · {p.category}</span>
                <h1>{p.name}</h1>
                <p>{p.description || meta.blurb}</p>
              </div>
            </div>

            <div className="dh-broch-cols">
              <div className="dh-broch-col">
                <h4>Highlights</h4>
                <ul className="dh-broch-list">
                  {highlights.length
                    ? highlights.map((h) => <li key={h}><Icon name="check" size={13} /> {cap(h)}</li>)
                    : <li><Icon name="check" size={13} /> {meta.blurb}</li>}
                  <li><Icon name="check" size={13} /> {p.tracked ? 'Ships worldwide' : 'Instant provisioning'}</li>
                  {p.priceBooks?.length ? <li><Icon name="check" size={13} /> Available in {p.priceBooks.length} currencies</li> : null}
                </ul>

                {p.variants?.length ? (
                  <>
                    <h4>Configurations</h4>
                    <ul className="dh-broch-list">
                      {p.variants.map((v) => <li key={v.id}><Icon name="chevronRight" size={12} /> {v.name} — {fmtPrice(v.price, p.currency)}</li>)}
                    </ul>
                  </>
                ) : null}
              </div>

              <div className="dh-broch-col">
                <div className="dh-broch-pricecard">
                  <span className="dh-broch-price-label">Starting at</span>
                  <span className="dh-broch-price">{fmtPrice(p.price, p.currency)}<em>{BILLING_LABEL[p.billing]}</em></span>
                  {p.bundleItems?.length ? <Badge tone="green">Bundle — includes {p.bundleItems.length} products</Badge> : null}
                  <div className="dh-broch-facts">
                    <div><span>SKU</span><b className="mono">{p.sku}</b></div>
                    <div><span>Type</span><b>{meta.label}</b></div>
                    <div><span>Billing</span><b>{BILLING_LABEL[p.billing].replace('/', 'per ') || 'One-time'}</b></div>
                  </div>
                  <div className="dh-broch-cta">Contact sales · sales@dovehero.app</div>
                </div>
              </div>
            </div>
            <div className="dh-broch-foot">Dovehero · {p.vendor ?? 'Aurora, Inc.'} · Product brochure</div>
          </div>

          {/* Email side panel */}
          {mode === 'email' && (
            <div className="dh-broch-email">
              <h4>Send by email</h4>
              <label className="dh-pw-flabel">To</label>
              <input className="dh-pw-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="buyer@company.com" autoFocus />
              <label className="dh-pw-flabel">Subject</label>
              <input className="dh-pw-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <label className="dh-pw-flabel">Message</label>
              <textarea className="dh-pw-textarea" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="dh-broch-attach"><Icon name="paperclip" size={13} /> {fileName}</div>
              <Button variant="primary" onClick={send} style={{ width: '100%' }}><Icon name="send" size={14} /> Send brochure</Button>
            </div>
          )}
        </div>

        <div className="dh-broch-actions">
          <Button variant="ghost" size="sm" onClick={copyLink}><Icon name="paperclip" size={14} /> Copy link</Button>
          <Button variant="ghost" size="sm" onClick={download}><Icon name="download" size={14} /> Download</Button>
          {mode === 'preview'
            ? <Button variant="primary" size="sm" onClick={() => setMode('email')}><Icon name="mail" size={14} /> Send by email</Button>
            : <Button variant="ghost" size="sm" onClick={() => setMode('preview')}>Back to preview</Button>}
        </div>
      </div>
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Standalone HTML brochure for download. */
function brochureHtml(p: Product, meta: TypeMeta): string {
  const feats = (p.tags ?? []).map((t) => `<li>${cap(t)}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.name} — Brochure</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:0;color:#1a1d29}
.cover{background:linear-gradient(135deg,${p.image.hue},${p.image.hue}cc);color:#fff;padding:48px}
.cover h1{margin:8px 0;font-size:34px}.kick{opacity:.85;text-transform:uppercase;letter-spacing:.08em;font-size:12px}
.body{padding:32px 48px;max-width:820px}.price{font-size:30px;font-weight:800}
ul{line-height:1.9}.sku{font-family:monospace;color:#6b7185}</style></head>
<body><div class="cover"><div class="kick">${meta.label} · ${p.category}</div><h1>${p.name}</h1><p>${p.description ?? meta.blurb}</p></div>
<div class="body"><p class="price">${fmtPrice(p.price, p.currency)}${BILLING_LABEL[p.billing]}</p>
<h3>Highlights</h3><ul>${feats || `<li>${meta.blurb}</li>`}</ul>
<p class="sku">SKU ${p.sku} · ${p.vendor ?? 'Aurora, Inc.'}</p>
<p>Contact sales · sales@dovehero.app</p></div></body></html>`;
}
