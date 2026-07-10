// ---------------------------------------------------------------------------
// Right-hand AI Assistant panel: Morning Brief, recommended next actions, and
// a conversational ask box. All answers are computed from the dataset (see
// ai.ts) — presented as an assistant, labelled as a prototype.
// ---------------------------------------------------------------------------
import { useMemo, useRef, useState } from 'react';
import {
  Sparkles, X, Sun, TrendingUp, TriangleAlert, CircleAlert, Info, ArrowRight, Send, ListChecks,
  Settings2, Cloud, Cpu,
} from 'lucide-react';
import { morningBrief, recommendations, type BriefItem, type Tone } from './ai';
import { askNova, type NovaSource } from './novaClient';
import type { Deal, Bounds } from './data';
import type { CrossFilter } from './reportEngine';

const TONE_ICON: Record<Tone, typeof Info> = { good: TrendingUp, warn: TriangleAlert, bad: CircleAlert, info: Info };

export function AiPanel({
  deals, bounds, now, onCross, onToast, onClose,
}: {
  deals: Deal[];
  bounds: Bounds;
  now: number;
  onCross: (c: CrossFilter) => void;
  onToast: (m: string) => void;
  onClose: () => void;
}) {
  const brief = useMemo(() => morningBrief(deals, bounds, now), [deals, bounds, now]);
  const recs = useMemo(() => recommendations(deals, now), [deals, now]);
  const [chat, setChat] = useState<Array<{ q: string; a: string; source?: NovaSource }>>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setQ('');
    setBusy(true);
    setChat((c) => [...c, { q: t, a: '…' }]);
    scrollDown();
    const reply = await askNova(t, deals, bounds, now, { endpoint });
    setChat((c) => c.map((m, i) => (i === c.length - 1 ? { q: t, a: reply.text, source: reply.source } : m)));
    setBusy(false);
    scrollDown();
  };

  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="cd-scrim right transparent" onMouseDown={(e) => e.target === e.currentTarget && onClose()} />
      <aside className="cd-ai" role="complementary" aria-label="AI assistant">
        <div className="cd-ai-head">
          <span className="cd-ai-mark"><Sparkles size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Nova</b>
            <small>{endpoint.trim() ? 'Claude · connected' : 'AI command center · prototype'}</small>
          </div>
          <button
            className={`cd-iconbtn ${showCfg ? 'active' : ''}`}
            onClick={() => setShowCfg((v) => !v)}
            aria-label="AI connection settings"
            title="Connect a Claude proxy"
          >
            <Settings2 size={16} />
          </button>
          <button className="cd-iconbtn" onClick={onClose} aria-label="Close assistant"><X size={16} /></button>
        </div>

        {showCfg && (
          <div className="cd-ai-cfg">
            <label className="cd-ai-cfg-lab">Claude proxy endpoint</label>
            <input
              className="cd-input"
              placeholder="https://your-proxy.example.com/nova"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
            <p className="cd-ai-cfg-note">
              Optional. Point Nova at a small server you host that holds your API key and forwards to
              Claude (<code>claude-opus-4-8</code>). Left blank, answers come from the on-device rules
              engine. The browser never sees a key. See the README for a ~30-line reference proxy.
            </p>
          </div>
        )}

        <div className="cd-ai-body" ref={scrollRef}>
          <div className="cd-ai-section">
            <div className="cd-ai-title"><Sun size={14} /> {greeting} — your brief</div>
            <div className="cd-ai-brief">
              {brief.map((it: BriefItem, i) => {
                const Icon = TONE_ICON[it.tone];
                return (
                  <button
                    key={i}
                    className={`cd-brief-item ${it.tone} ${it.cross ? 'clickable' : ''}`}
                    onClick={() => it.cross && onCross(it.cross)}
                    disabled={!it.cross}
                  >
                    <Icon size={15} className="ic" />
                    <span>{it.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cd-ai-section">
            <div className="cd-ai-title"><ListChecks size={14} /> Recommended next actions</div>
            <div className="cd-ai-recs">
              {recs.length === 0 && <div className="cd-empty" style={{ padding: 12 }}>Nothing urgent — pipeline looks healthy.</div>}
              {recs.map((r) => (
                <div className="cd-rec" key={r.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cd-rec-text">{r.text}</div>
                    <div className="cd-rec-sub">{r.sub}</div>
                  </div>
                  <button className="cd-rec-btn" onClick={() => onToast(`${r.action} (mock) — ${r.text}`)}>
                    {r.action} <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {chat.length > 0 && (
            <div className="cd-ai-section">
              <div className="cd-ai-title"><Sparkles size={14} /> Conversation</div>
              <div className="cd-ai-chat">
                {chat.map((c, i) => (
                  <div key={i}>
                    <div className="cd-chat-q">{c.q}</div>
                    <div className="cd-chat-a">
                      {c.a}
                      {c.source && (
                        <span className={`cd-chat-src ${c.source}`}>
                          {c.source === 'claude' ? <Cloud size={11} /> : <Cpu size={11} />}
                          {c.source === 'claude' ? 'Claude' : 'on-device'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form className="cd-ai-ask" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input
            className="cd-input"
            placeholder="Ask about pipeline, win rate, forecast…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
          />
          <button className="cd-iconbtn primary" type="submit" aria-label="Ask" disabled={!q.trim() || busy}><Send size={15} /></button>
        </form>
        {chat.length === 0 && (
          <div className="cd-ai-chips">
            {['My win rate?', 'Top rep?', 'Forecast?', 'Any stuck deals?'].map((c) => (
              <button key={c} className="cd-chip" onClick={() => ask(c)}>{c}</button>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
