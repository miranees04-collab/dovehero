import { useStore } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { OWNERS, ME } from '@/data/constants';
import './tasks-hub.css';

export function HubPanel() {
  const open = useStore((s) => s.hubOpen);
  const setHub = useStore((s) => s.setHub);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const resetDemo = useStore((s) => s.resetDemo);
  const deals = useStore((s) => s.deals);
  const objects = useStore((s) => s.objects);

  return (
    <Drawer open={open} onClose={() => setHub(false)} width={400} className="dh-panel">
      <div className="dh-panel-head">
        <div className="dh-panel-title">
          <Icon name="sliders" size={18} /> Customize
        </div>
        <button className="dh-icon-btn" onClick={() => setHub(false)} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="dh-panel-body dh-hub-body">
        <div className="dh-hub-user">
          <Avatar ownerKey={ME} size={42} />
          <div>
            <b>{OWNERS[ME].name}</b>
            <small>{role === 'admin' ? 'Admin' : 'Sales rep'} · Acme Sales</small>
          </div>
        </div>

        <div className="dh-hub-section">
          <div className="dh-hub-label">Appearance</div>
          <div className="dh-hub-theme">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} className={`dh-hub-theme-opt ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)}>
                <span className={`dh-hub-swatch ${t}`}>
                  <Icon name={t === 'light' ? 'sun' : 'moon'} size={16} />
                </span>
                {t === 'light' ? 'Light' : 'Dark'}
                {theme === t && <Icon name="check" size={14} className="dh-hub-check" />}
              </button>
            ))}
          </div>
        </div>

        <div className="dh-hub-section">
          <div className="dh-hub-label">Role</div>
          <div className="dh-hub-theme">
            {(['admin', 'rep'] as const).map((r) => (
              <button key={r} className={`dh-hub-theme-opt ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>
                <span className="dh-hub-swatch" style={{ background: 'var(--accent-soft)', color: 'var(--accent-600)' }}>
                  <Icon name={r === 'admin' ? 'sliders' : 'users'} size={15} />
                </span>
                {r === 'admin' ? 'Admin' : 'Sales rep'}
                {role === r && <Icon name="check" size={14} className="dh-hub-check" />}
              </button>
            ))}
          </div>
          <p className="dh-hub-note" style={{ marginTop: 0 }}>Reps can't create custom objects/fields or edit automations.</p>
        </div>

        <div className="dh-hub-section">
          <div className="dh-hub-label">Workspace</div>
          <div className="dh-hub-stats">
            <div className="dh-hub-stat">
              <span className="v mono">{deals.length}</span>
              <span className="l">Deals</span>
            </div>
            <div className="dh-hub-stat">
              <span className="v mono">{objects.length}</span>
              <span className="l">Objects</span>
            </div>
            <div className="dh-hub-stat">
              <span className="v mono">{Object.keys(OWNERS).length}</span>
              <span className="l">Teammates</span>
            </div>
          </div>
        </div>

        <div className="dh-hub-section">
          <div className="dh-hub-label">Data</div>
          <button
            className="dh-hub-action"
            onClick={() => {
              resetDemo();
              setHub(false);
            }}
          >
            <Icon name="reset" size={16} />
            <div>
              <b>Reset demo data</b>
              <small>Restore the seeded pipeline and records</small>
            </div>
          </button>
          <p className="dh-hub-note">
            <Icon name="zap" size={12} /> Your changes persist in this browser. Outbound messages and documents are
            simulated.
          </p>
        </div>
      </div>
    </Drawer>
  );
}
