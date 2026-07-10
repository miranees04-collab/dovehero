import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Modal';
import './nova.css';

const SUGGESTIONS = [
  "What's at risk this week?",
  'Forecast for this quarter',
  'What should I focus on today?',
  'Show my best open deals',
];

export function NovaPanel() {
  const open = useStore((s) => s.novaOpen);
  const setNova = useStore((s) => s.setNova);
  const messages = useStore((s) => s.novaMessages);
  const thinking = useStore((s) => s.novaThinking);
  const sendNova = useStore((s) => s.sendNova);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const setView = useStore((s) => s.setView);

  const [text, setText] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, thinking, open]);

  const submit = (val: string) => {
    const v = val.trim();
    if (!v) return;
    sendNova(v);
    setText('');
  };

  const runAction = (action?: string) => {
    if (!action) return;
    if (action.startsWith('open:')) {
      setNav('deals');
      openDeal(action.slice(5));
      setNova(false);
    } else if (action.startsWith('view:')) {
      setNav('deals');
      setView(action.slice(5) as 'insights');
      setNova(false);
    } else if (action.startsWith('ask:')) {
      submit(action.slice(4));
    }
  };

  return (
    <Drawer open={open} onClose={() => setNova(false)} width={420} className="dh-nova">
      <div className="dh-nova-head">
        <span className="dh-nova-mark">
          <Icon name="sparkles" size={16} color="#fff" />
        </span>
        <div className="dh-nova-head-text">
          <b>Nova</b>
          <small>Your AI revenue assistant</small>
        </div>
        <button className="dh-icon-btn" onClick={() => setNova(false)} aria-label="Close Nova">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="dh-nova-body" ref={bodyRef}>
        {messages.map((m) => (
          <div key={m.id} className={`dh-nova-msg ${m.role}`}>
            {m.role === 'nova' && (
              <span className="dh-nova-avatar">
                <Icon name="sparkles" size={13} color="#fff" />
              </span>
            )}
            <div className="dh-nova-bubble">
              <div className="dh-nova-text">{m.text}</div>
              {m.chips && m.chips.length > 0 && (
                <div className="dh-nova-chips">
                  {m.chips.map((c, i) => (
                    <button key={i} className="dh-nova-chip" onClick={() => runAction(c.action)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="dh-nova-msg nova">
            <span className="dh-nova-avatar">
              <Icon name="sparkles" size={13} color="#fff" />
            </span>
            <div className="dh-nova-bubble">
              <div className="dh-nova-typing">
                <span /> <span /> <span />
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="dh-nova-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => submit(s)}>
              <Icon name="sparkles" size={13} />
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="dh-nova-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about your pipeline…"
          aria-label="Message Nova"
          autoFocus
        />
        <button type="submit" aria-label="Send" disabled={!text.trim()}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </Drawer>
  );
}
