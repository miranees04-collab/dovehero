import { useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Badge } from '@/components/ui/primitives';
import { OWNERS } from '@/data/constants';
import type { Product, ProductStage } from '@/types';
import {
  PRODUCT_STAGES,
  price as fmtPrice,
  margin as calcMargin,
  marginTone,
  stockState,
  STOCK_META,
} from '@/data/products';
import { TypeBadge } from './ProductSections';
import { useProducts } from './ProductWorkspace';

/** Product lifecycle board — drag cards between launch stages. */
export function ProductPipeline({ items }: { items?: Product[] }) {
  const all = useProducts();
  const products = items ?? all;
  const openObject = useStore((s) => s.openObject);
  const moveProductStage = useStore((s) => s.moveProductStage);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<ProductStage | null>(null);

  const byStage = (k: ProductStage) => products.filter((p) => p.stage === k);

  const drop = (stage: ProductStage) => {
    if (drag) moveProductStage(drag, stage);
    setDrag(null);
    setOver(null);
  };

  return (
    <div className="dh-pp">
      {PRODUCT_STAGES.map((st) => {
        const items = byStage(st.k);
        const value = items.reduce((s, p) => s + (p.status === 'active' ? p.price : 0), 0);
        return (
          <div
            key={st.k}
            style={{ ['--sh']: st.hue } as CSSProperties}
            className={`dh-pp-col ${over === st.k ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (over !== st.k) setOver(st.k); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === st.k ? null : o)); }}
            onDrop={() => drop(st.k)}
          >
            <div className="dh-pp-colhead">
              <span className="dh-pp-coldot" style={{ background: st.hue }} />
              <b>{st.label}</b>
              <span className="dh-pp-colcount">{items.length}</span>
              <span className="dh-pp-colval">{value ? fmtPrice(value, 'USD') : ''}</span>
            </div>
            <div className="dh-pp-colbody">
              {items.map((p) => (
                <PipelineCard key={p.id} p={p} dragging={drag === p.id}
                  onOpen={() => openObject(p.id)}
                  onDragStart={() => setDrag(p.id)}
                  onDragEnd={() => { setDrag(null); setOver(null); }} />
              ))}
              {!items.length && <div className="dh-pp-empty">Drop products here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ p, dragging, onOpen, onDragStart, onDragEnd }: {
  p: Product; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const m = calcMargin(p);
  const ss = stockState(p);
  return (
    <div
      className={`dh-pp-card ${dragging ? 'dragging' : ''}`}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Open ${p.name}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(); } }}
    >
      <div className="dh-pp-card-top">
        <span className="dh-pw-thumb sm" style={{ background: p.image.hue + '1a', color: p.image.hue }}>{p.image.emoji}</span>
        <div className="dh-pp-card-name">
          <b>{p.name}</b>
          <span className="mono dh-pw-sku">{p.sku}</span>
        </div>
      </div>
      <div className="dh-pp-card-mid"><TypeBadge type={p.type} /></div>
      <div className="dh-pp-card-foot">
        <span className="dh-pp-card-price">{fmtPrice(p.price, p.currency)}</span>
        <Badge tone={marginTone(m)}>{m}%</Badge>
        {ss !== 'untracked' && <Badge tone={STOCK_META[ss].tone}>{p.onHand - p.committed}</Badge>}
        <span className="dh-pp-card-owner">{p.owner && OWNERS[p.owner] ? <Avatar ownerKey={p.owner} size={20} /> : <Icon name="users" size={14} />}</span>
      </div>
    </div>
  );
}
