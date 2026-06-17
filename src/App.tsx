import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Board } from './components/deals/Board';
import { DealTable } from './components/deals/DealTable';
import { Insights } from './components/insights/Insights';
import { RecordView } from './components/record/RecordView';
import { ObjectView } from './components/objects/ObjectView';
import { PipelineBar } from './components/deals/PipelineBar';
import { NovaPanel } from './components/nova/NovaPanel';
import { CommandPalette } from './components/command/CommandPalette';
import { NotificationsPanel } from './components/panels/NotificationsPanel';
import { Composer } from './components/composer/Composer';
import { Toasts } from './components/ui/Toasts';

export default function App() {
  const nav = useStore((s) => s.nav);
  const view = useStore((s) => s.view);
  const openDealId = useStore((s) => s.openDealId);
  const setPalette = useStore((s) => s.setPalette);
  const setNova = useStore((s) => s.setNova);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setNova(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, setNova]);

  let content;
  if (nav !== 'deals') {
    content = <ObjectView />;
  } else if (openDealId) {
    content = <RecordView />;
  } else if (view === 'insights') {
    content = <Insights />;
  } else {
    content = (
      <>
        <PipelineBar />
        {view === 'board' ? <Board /> : <DealTable />}
      </>
    );
  }

  return (
    <div className="dh-app">
      <Sidebar />
      <div className="dh-main">
        <TopBar />
        <div className="dh-content">{content}</div>
      </div>

      {/* overlays */}
      <NovaPanel />
      <CommandPalette />
      <NotificationsPanel />
      <Composer />
      <Toasts />
    </div>
  );
}
