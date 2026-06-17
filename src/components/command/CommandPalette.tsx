import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { PIPELINES } from '@/data/constants';
import { money } from '@/lib/format';
import type { Deal } from '@/types';
import './command.css';

interface ActionItem {
  id: string;
  icon: string;
  label: string;
  hint?: string;
  kbd?: string;
  run: () => void;
}

interface DealItem {
  deal: Deal;
  run: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const deals = useStore((s) => s.deals);
  const setPalette = useStore((s) => s.setPalette);
  const setNav = useStore((s) => s.setNav);
  const setView = useStore((s) => s.setView);
  const setPipeline = useStore((s) => s.setPipeline);
  const setNova = useStore((s) => s.setNova);
  const openDeal = useStore((s) => s.openDeal);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const resetDemo = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.toast);

  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setPalette(false);

  // Reset query + selection each time the palette opens.
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
    }
  }, [open]);

  const actions = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [
      {
        id: 'go-board',
        icon: 'grid',
        label: 'Go to Board',
        hint: 'Deals',
        run: () => {
          setNav('deals');
          setView('board');
        },
      },
      {
        id: 'go-table',
        icon: 'list',
        label: 'Go to Table',
        hint: 'Deals',
        run: () => {
          setNav('deals');
          setView('table');
        },
      },
      {
        id: 'go-insights',
        icon: 'activity',
        label: 'Go to Insights',
        hint: 'Deals',
        run: () => {
          setNav('deals');
          setView('insights');
        },
      },
      ...PIPELINES.map<ActionItem>((p) => ({
        id: 'pipe-' + p.k,
        icon: 'target',
        label: `Switch pipeline: ${p.name}`,
        hint: 'Pipeline',
        run: () => {
          setNav('deals');
          setPipeline(p.k);
        },
      })),
      {
        id: 'ask-nova',
        icon: 'sparkles',
        label: 'Ask Nova',
        hint: 'AI',
        run: () => setNova(true),
      },
      {
        id: 'new-deal',
        icon: 'plus',
        label: 'New deal',
        run: () => toast('Use the New deal button to add a deal'),
      },
      {
        id: 'toggle-theme',
        icon: 'sun',
        label: 'Toggle theme',
        run: () => toggleTheme(),
      },
      {
        id: 'reset-demo',
        icon: 'download',
        label: 'Reset demo data',
        run: () => resetDemo(),
      },
    ];
    return list;
  }, [setNav, setView, setPipeline, setNova, toggleTheme, resetDemo, toast]);

  const query = q.trim().toLowerCase();

  const filteredActions = useMemo<ActionItem[]>(() => {
    if (!query) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(query));
  }, [actions, query]);

  const dealItems = useMemo<DealItem[]>(() => {
    if (!query) return [];
    return deals
      .filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.company.toLowerCase().includes(query),
      )
      .slice(0, 6)
      .map((deal) => ({
        deal,
        run: () => {
          setNav('deals');
          openDeal(deal.id);
        },
      }));
  }, [deals, query, setNav, openDeal]);

  // Flat list of all selectable runners, in render order.
  const flat = useMemo<Array<() => void>>(
    () => [...filteredActions.map((a) => a.run), ...dealItems.map((d) => d.run)],
    [filteredActions, dealItems],
  );

  // Keep selection in range as results change.
  useEffect(() => {
    setSel((s) => (flat.length === 0 ? 0 : Math.min(s, flat.length - 1)));
  }, [flat.length]);

  const fire = (idx: number) => {
    const run = flat[idx];
    if (!run) return;
    run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => (flat.length === 0 ? 0 : (s + 1) % flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => (flat.length === 0 ? 0 : (s - 1 + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      fire(sel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  let index = -1;
  const rowProps = (run: () => void): { selected: boolean; onClick: () => void } => {
    index += 1;
    const myIndex = index;
    return {
      selected: myIndex === sel,
      onClick: () => {
        run();
        close();
      },
    };
  };

  const hasResults = flat.length > 0;

  return (
    <div className="dh-cmd-scrim" onMouseDown={close}>
      <div
        className="dh-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dh-cmd-input-row">
          <Icon name="search" size={17} className="dh-cmd-search-icon" />
          <input
            ref={inputRef}
            className="dh-cmd-input"
            value={q}
            autoFocus
            placeholder="Search deals or run a command…"
            aria-label="Command palette search"
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="dh-cmd-esc">ESC</kbd>
        </div>

        <div className="dh-cmd-list" role="listbox">
          {!hasResults && (
            <div className="dh-cmd-empty">
              <Icon name="search" size={20} />
              <span>No results for “{q.trim()}”</span>
            </div>
          )}

          {filteredActions.length > 0 && (
            <>
              <div className="dh-cmd-group">Actions</div>
              {filteredActions.map((a) => {
                const { selected, onClick } = rowProps(a.run);
                return (
                  <Row key={a.id} selected={selected} onClick={onClick}>
                    <span className="dh-cmd-ico">
                      <Icon name={a.icon} size={16} />
                    </span>
                    <span className="dh-cmd-label">{a.label}</span>
                    {a.hint && <span className="dh-cmd-hint">{a.hint}</span>}
                    {a.kbd && <kbd className="dh-cmd-kbd">{a.kbd}</kbd>}
                  </Row>
                );
              })}
            </>
          )}

          {dealItems.length > 0 && (
            <>
              <div className="dh-cmd-group">Deals</div>
              {dealItems.map(({ deal, run }) => {
                const { selected, onClick } = rowProps(run);
                return (
                  <Row key={deal.id} selected={selected} onClick={onClick}>
                    <span className="dh-cmd-ico">
                      <Icon name="building" size={16} />
                    </span>
                    <span className="dh-cmd-deal">
                      <span className="dh-cmd-label">{deal.name}</span>
                      <span className="dh-cmd-sub">
                        {deal.company} · {deal.stage}
                      </span>
                    </span>
                    <span className="dh-cmd-value">{money(deal.value, true)}</span>
                  </Row>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`dh-cmd-row${selected ? ' selected' : ''}`}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
