// ---------------------------------------------------------------------------
// ⌘K / Ctrl+K command palette: universal search over dashboards, saved
// reports, deals, and quick actions with keyboard navigation.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface Command {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  run: () => void;
}

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s
      ? commands
      : commands.filter((c) => (c.label + ' ' + (c.sub ?? '') + ' ' + c.group).toLowerCase().includes(s));
    return list.slice(0, 40);
  }, [q, commands]);

  useEffect(() => { setSel(0); }, [q]);

  const run = (c: Command | undefined) => { if (c) { c.run(); onClose(); } };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Group the visible commands, preserving first-seen group order.
  const groups: Array<{ name: string; items: Array<{ c: Command; idx: number }> }> = [];
  filtered.forEach((c, idx) => {
    let g = groups.find((x) => x.name === c.group);
    if (!g) { g = { name: c.group, items: [] }; groups.push(g); }
    g.items.push({ c, idx });
  });

  return (
    <div className="cd-scrim palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-palette" role="dialog" aria-label="Command palette">
        <div className="cd-palette-input">
          <Search size={17} style={{ color: 'var(--muted)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search dashboards, reports, deals, actions…"
            aria-label="Search"
          />
          <kbd className="cd-kbd">esc</kbd>
        </div>
        <div className="cd-palette-list">
          {filtered.length === 0 && <div className="cd-empty" style={{ padding: 20 }}>No matches for “{q}”.</div>}
          {groups.map((g) => (
            <div key={g.name}>
              <div className="cd-palette-group">{g.name}</div>
              {g.items.map(({ c, idx }) => (
                <button
                  key={c.id}
                  className={`cd-palette-row ${idx === sel ? 'on' : ''}`}
                  onMouseMove={() => setSel(idx)}
                  onClick={() => run(c)}
                >
                  <span className="ic">{c.icon}</span>
                  <span className="cd-palette-label">
                    {c.label}
                    {c.sub && <em>{c.sub}</em>}
                  </span>
                  {idx === sel && <CornerDownLeft size={14} className="enter" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
