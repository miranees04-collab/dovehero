import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/primitives';
import { OBJECT_DEFS } from '@/data/constants';
import { NewDealButton } from '@/components/deals/NewDeal';

export function TopBar() {
  const nav = useStore((s) => s.nav);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const q = useStore((s) => s.q);
  const setQuery = useStore((s) => s.setQuery);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setPalette = useStore((s) => s.setPalette);
  const setNova = useStore((s) => s.setNova);
  const setNotif = useStore((s) => s.setNotif);
  const setMobileNav = useStore((s) => s.setMobileNav);
  const openDealId = useStore((s) => s.openDealId);

  const obj = OBJECT_DEFS.find((o) => o.k === nav);
  const title = nav === 'deals' ? 'Deals' : obj?.plural ?? 'Records';

  return (
    <header className="dh-topbar">
      <button className="dh-icon-btn mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
        <Icon name="panelLeft" size={18} />
      </button>

      <div className="dh-topbar-title">
        <Icon name={nav === 'deals' ? 'layers' : obj?.icon ?? 'box'} size={18} />
        <h1>{title}</h1>
      </div>

      {nav === 'deals' && !openDealId && (
        <div className="dh-seg" role="tablist" aria-label="Deal views">
          {(['board', 'table', 'insights'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? 'on' : ''}
              onClick={() => setView(v)}
            >
              <Icon name={v === 'board' ? 'grid' : v === 'table' ? 'list' : 'activity'} size={15} />
              <span>{v === 'board' ? 'Board' : v === 'table' ? 'Table' : 'Insights'}</span>
            </button>
          ))}
        </div>
      )}

      <button className="dh-search" onClick={() => setPalette(true)}>
        <Icon name="search" size={15} color="var(--faint)" />
        <input
          placeholder="Search or jump to…"
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setPalette(true)}
          aria-label="Search"
        />
        <kbd>⌘K</kbd>
      </button>

      <Button variant="ai" onClick={() => setNova(true)}>
        <Icon name="sparkles" size={15} />
        <span className="hide-sm">Ask Nova</span>
      </Button>

      <button
        className="dh-icon-btn"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        title="Toggle theme"
      >
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
      </button>

      <button className="dh-icon-btn" onClick={() => setNotif(true)} aria-label="Notifications">
        <Icon name="bell" size={17} />
        <span className="dh-notif-dot" />
      </button>

      <NewDealButton />
    </header>
  );
}
