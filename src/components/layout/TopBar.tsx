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
  const setTasks = useStore((s) => s.setTasks);
  const setHub = useStore((s) => s.setHub);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const openTaskCount = useStore((s) =>
    s.deals.reduce((n, d) => n + d.acts.filter((a) => a.type === 'task' && !a.done).length, 0),
  );

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

      {(canUndo || canRedo) && (
        <div className="dh-undo-group hide-sm">
          <button className="dh-icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
            <Icon name="undo" size={16} />
          </button>
          <button className="dh-icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⌘⇧Z)">
            <Icon name="redo" size={16} />
          </button>
        </div>
      )}

      <button className="dh-icon-btn hide-sm" onClick={() => setTasks(true)} aria-label="Tasks" title="My tasks">
        <Icon name="tasks" size={17} />
        {openTaskCount > 0 && <span className="dh-count-badge">{openTaskCount}</span>}
      </button>

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

      <button className="dh-icon-btn hide-sm" onClick={() => setHub(true)} aria-label="Settings" title="Customize">
        <Icon name="sliders" size={17} />
      </button>

      <NewDealButton />
    </header>
  );
}
