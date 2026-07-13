import { useState, type CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button } from '@/components/ui/primitives';
import type { Connector, ConnectorCategory } from '@/types';
import { CONNECTOR_CATEGORIES } from '@/data/products';
import '@/components/products/products.css';
import './commerce.css';

const CAT_ICON: Record<ConnectorCategory, string> = { Payments: 'dollar', Accounting: 'receipt', 'E-commerce': 'boxes', Ops: 'zap' };

export function ConnectorsWorkspace() {
  const connectors = useStore((s) => s.connectors);
  const toggle = useStore((s) => s.toggleConnector);
  const sync = useStore((s) => s.syncConnector);
  const [cat, setCat] = useState<ConnectorCategory | 'all'>('all');

  const connected = connectors.filter((c) => c.connected);
  const list = cat === 'all' ? connectors : connectors.filter((c) => c.category === cat);
  const countOf = (k: ConnectorCategory | 'all') => (k === 'all' ? connectors.length : connectors.filter((c) => c.category === k).length);

  return (
    <div className="dh-pw dh-cm" style={{ ['--phue']: '#6366F1' } as CSSProperties}>
      <div className="dh-pw-head">
        <div className="dh-pw-head-main">
          <div className="dh-pw-head-title">
            <span className="dh-pw-head-icon"><Icon name="zap" size={19} /></span>
            <div><h1>Connectors</h1><p>Integrations that keep your commerce data in sync with the tools you already use.</p></div>
          </div>
        </div>
        <div className="dh-pw-kpis dh-cm-kpis-sm">
          <Kpi icon="check" label="Connected" value={String(connected.length)} tone="green" />
          <Kpi icon="dollar" label="Payments" value={connectors.some((c) => c.category === 'Payments' && c.connected) ? 'Live' : 'Off'} tone={connectors.some((c) => c.category === 'Payments' && c.connected) ? 'green' : 'neutral'} />
          <Kpi icon="receipt" label="Accounting" value={connectors.some((c) => c.category === 'Accounting' && c.connected) ? 'Live' : 'Off'} tone={connectors.some((c) => c.category === 'Accounting' && c.connected) ? 'green' : 'neutral'} />
          <Kpi icon="boxes" label="E-commerce" value={connectors.some((c) => c.category === 'E-commerce' && c.connected) ? 'Live' : 'Off'} tone={connectors.some((c) => c.category === 'E-commerce' && c.connected) ? 'green' : 'amber'} />
        </div>
      </div>

      <div className="dh-pw-types">
        <button className={`dh-pw-type ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All <span className="dh-pw-type-count">{countOf('all')}</span></button>
        {CONNECTOR_CATEGORIES.map((k) => (
          <button key={k} className={`dh-pw-type ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>
            <Icon name={CAT_ICON[k]} size={14} /> {k} <span className="dh-pw-type-count">{countOf(k)}</span>
          </button>
        ))}
      </div>

      <div className="dh-pw-scroll">
        <div className="dh-conn-grid">
          {list.map((c) => <ConnectorCard key={c.k} c={c} onToggle={() => toggle(c.k)} onSync={() => sync(c.k)} />)}
        </div>
      </div>
    </div>
  );
}

function ConnectorCard({ c, onToggle, onSync }: { c: Connector; onToggle: () => void; onSync: () => void }) {
  return (
    <div className={`dh-conn-card ${c.connected ? 'on' : ''}`} style={{ ['--chue']: c.hue } as CSSProperties}>
      <div className="dh-conn-top">
        <span className="dh-conn-logo" style={{ background: c.hue + '1a' }}>{c.emoji}</span>
        <div className="dh-conn-name">
          <b>{c.name}</b>
          <span className="dh-conn-cat">{c.category}</span>
        </div>
        {c.connected
          ? <Badge tone="green" dot="var(--green)">Connected</Badge>
          : <Badge tone="neutral">Not connected</Badge>}
      </div>
      <p className="dh-conn-blurb">{c.blurb}</p>
      <div className="dh-conn-syncs"><Icon name="repeat" size={12} /> Syncs {c.syncs}</div>
      {c.connected && (c.lastSyncW || c.syncedCount != null) && (
        <div className="dh-conn-last">
          <Icon name="check" size={12} /> Last sync {c.lastSyncW ?? '—'} ago{c.syncedCount != null ? ` · ${c.syncedCount} records` : ''}
        </div>
      )}
      <div className="dh-conn-actions">
        {c.connected ? (
          <>
            <Button variant="primary" size="sm" onClick={onSync}><Icon name="reset" size={14} /> Sync now</Button>
            <button className="dh-conn-disc" onClick={onToggle}>Disconnect</button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onToggle}><Icon name="plus" size={14} /> Connect</Button>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone = 'neutral' }: { icon: string; label: string; value: string; tone?: 'neutral' | 'green' | 'amber' | 'accent' | 'red' }) {
  return (
    <div className={`dh-pw-kpi tone-${tone}`}>
      <span className="dh-pw-kpi-icon"><Icon name={icon} size={15} /></span>
      <div className="dh-pw-kpi-body"><span className="dh-pw-kpi-value">{value}</span><span className="dh-pw-kpi-label">{label}</span></div>
    </div>
  );
}
