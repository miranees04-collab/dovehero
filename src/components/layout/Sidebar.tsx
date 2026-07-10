import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { OWNERS, ME } from '@/data/constants';
import './layout.css';

const PRIMARY = [
  { key: 'deals', label: 'Deals', icon: 'layers' },
];

export function Sidebar() {
  const nav = useStore((s) => s.nav);
  const objects = useStore((s) => s.objects);
  const setNav = useStore((s) => s.setNav);
  const setView = useStore((s) => s.setView);
  const mobileNavOpen = useStore((s) => s.mobileNavOpen);
  const setMobileNav = useStore((s) => s.setMobileNav);

  const go = (key: string) => {
    setNav(key);
    if (key === 'deals') setView('board');
  };

  return (
    <>
      {mobileNavOpen && <div className="dh-scrim mobile-only" onClick={() => setMobileNav(false)} />}
      <aside className={`dh-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="dh-brand">
          <span className="dh-brand-mark">
            <Icon name="zap" size={17} color="#fff" strokeWidth={2.2} />
          </span>
          <div className="dh-brand-text">
            <b>Dovehero</b>
            <small>Revenue Command Deck</small>
          </div>
        </div>

        <nav className="dh-nav">
          <div className="dh-nav-group">
            {PRIMARY.map((it) => (
              <button
                key={it.key}
                className={`dh-nav-item ${nav === it.key ? 'on' : ''}`}
                onClick={() => go(it.key)}
              >
                <Icon name={it.icon} size={17} />
                <span>{it.label}</span>
              </button>
            ))}
          </div>

          <div className="dh-nav-label">Records</div>
          <div className="dh-nav-group">
            {objects.map((o) => (
              <button
                key={o.k}
                className={`dh-nav-item ${nav === o.k ? 'on' : ''}`}
                onClick={() => go(o.k)}
              >
                <Icon name={o.icon} size={17} />
                <span>{o.plural}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="dh-sidebar-foot">
          <button className="dh-user">
            <Avatar ownerKey={ME} size={30} />
            <div className="dh-user-text">
              <b>{OWNERS[ME].name}</b>
              <small>Admin · Acme Sales</small>
            </div>
            <Icon name="chevronDown" size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
