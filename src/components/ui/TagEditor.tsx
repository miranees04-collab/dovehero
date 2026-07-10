import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';

const SUGGESTED = ['Enterprise', 'Expansion', 'Strategic', 'Renewal', 'Outbound', 'Inbound', 'At-risk', 'Champion', 'Upsell'];

/** Inline tag chips with add/remove — click × to drop, "+ Tag" to add. */
export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const add = (t: string) => {
    const v = t.trim();
    if (v && !tags.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...tags, v]);
    setText('');
    setAdding(false);
  };
  const remaining = SUGGESTED.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  return (
    <div className="dh-tag-editor">
      {tags.map((t) => (
        <span key={t} className="dh-tag-chip">
          <Badge tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>
          <button className="dh-tag-x" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><Icon name="x" size={11} /></button>
        </span>
      ))}
      {adding ? (
        <input
          className="dh-tag-input"
          autoFocus
          list="dh-tag-suggest"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => add(text)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') add(text); if (e.key === 'Escape') { setText(''); setAdding(false); } }}
          placeholder="Tag…"
        />
      ) : (
        <button className="dh-tag-add" onClick={(e) => { e.stopPropagation(); setAdding(true); }}><Icon name="plus" size={11} /> Tag</button>
      )}
      <datalist id="dh-tag-suggest">{remaining.map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  );
}
