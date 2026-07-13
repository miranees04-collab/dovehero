import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Board } from './components/deals/Board';
import { DealTable } from './components/deals/DealTable';
import { Insights } from './components/insights/Insights';
import { ActivityCenter } from './components/activity/ActivityCenter';
import { RecordView } from './components/record/RecordView';
import { ObjectView } from './components/objects/ObjectView';
import { ProductWorkspace } from './components/products/ProductWorkspace';
import { ProductRecord } from './components/products/ProductRecord';
import { CommerceWorkspace, type CommerceSection } from './components/commerce/CommerceWorkspace';

const COMMERCE_NAV: Record<string, CommerceSection> = {
  commerce: 'overview', quotes: 'quote', orders: 'order', invoices: 'invoice', payments: 'payment', subscriptions: 'subscription',
};
import { PipelineBar } from './components/deals/PipelineBar';
import { NovaPanel } from './components/nova/NovaPanel';
import { CommandPalette } from './components/command/CommandPalette';
import { NotificationsPanel } from './components/panels/NotificationsPanel';
import { TasksPanel } from './components/panels/TasksPanel';
import { HubPanel } from './components/panels/HubPanel';
import { AutomationsPanel } from './components/panels/AutomationsPanel';
import { Composer } from './components/composer/Composer';
import { CaptureSheet } from './components/deals/CaptureSheet';
import { Confetti } from './components/deals/Confetti';
import { Peek } from './components/deals/Peek';
import { CommPanel } from './components/deals/CommPanel';
import { ColorRulesModal } from './components/deals/ColorRules';
import { DocBuilder } from './components/docs/DocBuilder';
import { Toasts } from './components/ui/Toasts';
import { Icon } from './components/ui/Icon';

export default function App() {
  const nav = useStore((s) => s.nav);
  const view = useStore((s) => s.view);
  const openDealId = useStore((s) => s.openDealId);
  const openObjectId = useStore((s) => s.openObjectId);
  const setPalette = useStore((s) => s.setPalette);
  const setNova = useStore((s) => s.setNova);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const focusMode = useStore((s) => s.focusMode);
  const setFocusMode = useStore((s) => s.setFocusMode);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const typing = /^(input|textarea)$/i.test((e.target as HTMLElement)?.tagName ?? '');
      if (mod && key === 'k') {
        e.preventDefault();
        setPalette(true);
      } else if (mod && key === 'j') {
        e.preventDefault();
        setNova(true);
      } else if (mod && key === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'f' && !typing && !mod && !e.shiftKey && !e.altKey) {
        setFocusMode(!useStore.getState().focusMode);
      } else if (key === 'escape' && useStore.getState().focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, setNova, undo, redo, setFocusMode]);

  let content;
  if (COMMERCE_NAV[nav]) {
    content = <CommerceWorkspace key={nav} section={COMMERCE_NAV[nav]} />;
  } else if (nav === 'product') {
    content = openObjectId ? <ProductRecord id={openObjectId} /> : <ProductWorkspace />;
  } else if (nav !== 'deals') {
    content = <ObjectView />;
  } else if (openDealId) {
    content = <RecordView />;
  } else if (view === 'insights') {
    content = <Insights />;
  } else if (view === 'activity') {
    content = <ActivityCenter />;
  } else {
    content = (
      <>
        <PipelineBar />
        {view === 'board' ? <Board /> : <DealTable />}
      </>
    );
  }

  return (
    <div className={`dh-app ${focusMode ? 'focus-mode' : ''}`}>
      <Sidebar />
      <div className="dh-main">
        <TopBar />
        <div className="dh-content">{content}</div>
      </div>
      {focusMode && (
        <button className="dh-focus-exit" onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">
          <Icon name="x" size={14} /> Exit focus <kbd>Esc</kbd>
        </button>
      )}

      {/* overlays */}
      <NovaPanel />
      <CommandPalette />
      <NotificationsPanel />
      <TasksPanel />
      <HubPanel />
      <AutomationsPanel />
      <Composer />
      <CaptureSheet />
      <Peek />
      <CommPanel />
      <ColorRulesModal />
      <DocBuilder />
      <Confetti />
      <Toasts />
    </div>
  );
}
