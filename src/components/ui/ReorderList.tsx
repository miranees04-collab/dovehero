import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import './reorder.css';

/**
 * A small native drag-to-reorder list over an ordered array of string keys.
 * Calls onReorder with the new key order on drop.
 */
export function ReorderList({
  items,
  onReorder,
  renderItem,
}: {
  items: string[];
  onReorder: (next: string[]) => void;
  renderItem: (key: string) => ReactNode;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const move = (from: string, to: string) => {
    if (from === to) return;
    const next = items.slice();
    const fi = next.indexOf(from);
    const ti = next.indexOf(to);
    if (fi < 0 || ti < 0) return;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    onReorder(next);
  };

  return (
    <div className="dh-reorder">
      {items.map((key) => (
        <div
          key={key}
          className={`dh-reorder-row ${dragKey === key ? 'dragging' : ''} ${overKey === key && dragKey ? 'over' : ''}`}
          draggable
          onDragStart={() => setDragKey(key)}
          onDragEnd={() => { setDragKey(null); setOverKey(null); }}
          onDragOver={(e) => { e.preventDefault(); setOverKey(key); }}
          onDrop={() => { if (dragKey) move(dragKey, key); setDragKey(null); setOverKey(null); }}
        >
          <span className="dh-reorder-grip"><Icon name="grip" size={14} /></span>
          {renderItem(key)}
        </div>
      ))}
    </div>
  );
}
