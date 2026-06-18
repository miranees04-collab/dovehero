import { useState, type ReactNode } from 'react';

interface InlineEditProps {
  value: string | number;
  /** Rendered display (defaults to the raw value). */
  display?: ReactNode;
  type?: 'text' | 'number';
  /** When provided, edits with a <select> of these options. */
  options?: { value: string; label: string }[];
  onCommit: (value: string) => void;
  className?: string;
}

/** A value that turns into an inline input/select on click, like the
 *  prototype's `editfield` — commits on blur or Enter, cancels on Escape. */
export function InlineEdit({ value, display, type = 'text', options, onCommit, className = '' }: InlineEditProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <span
        className={`dh-inline-edit ${className}`}
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setEditing(true); } }}
      >
        {display ?? value}
      </span>
    );
  }

  const commit = (v: string) => { setEditing(false); if (String(v) !== String(value)) onCommit(v); };

  if (options) {
    return (
      <select
        className="dh-inline-input"
        autoFocus
        defaultValue={String(value)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setEditing(false)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      className="dh-inline-input"
      autoFocus
      type={type === 'number' ? 'number' : 'text'}
      defaultValue={String(value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
