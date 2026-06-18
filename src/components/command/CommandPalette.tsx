import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore, type ComposerKind } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { PIPELINES } from '@/data/constants';
import { money } from '@/lib/format';
import type { Deal, StageKey } from '@/types';
import './command.css';

const ADVANCE: StageKey[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

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
  const openDealId = useStore((s) => s.openDealId);
  const requestStage = useStore((s) => s.requestStage);
  const duplicateDeal = useStore((s) => s.duplicateDeal);
  const openComposer = useStore((s) => s.openComposer);
  const setRecordEditing = useStore((s) => s.setRecordEditing);
  const setSwimlane = useStore((s) => s.setSwimlane);
  const setKbCompact = useStore((s) => s.setKbCompact);
  const kbCompact = useStore((s) => s.kbCompact);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const createDeal = useStore((s) => s.createDeal);
  const openD = deals.find((d) => d.id === openDealId);

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
    const list: ActionItem[] = [];

    // Context actions for the open deal — one click each.
    if (openD) {
      const d = openD;
      const advIdx = ADVANCE.indexOf(d.stage);
      const next = advIdx >= 0 && advIdx < ADVANCE.length - 1 ? ADVANCE[advIdx + 1] : null;
      const composeFor = (kind: ComposerKind) => () => {
        const c = d.contacts[0];
        const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${d.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
        openComposer({ dealId: d.id, kind, to: kind === 'email' ? email : '+1 (415) 555-0140', subject: kind === 'email' ? `${d.name} — next steps` : '', body: '', outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30', title: kind === 'task' ? String(d.next ?? 'Follow up') : kind === 'meeting' ? `Next steps — ${d.name}` : '' });
      };
      if (next) list.push({ id: 'ctx-advance', icon: 'arrowRight', label: `Advance ${d.name} to ${next}`, hint: 'This deal', run: () => requestStage(d.id, next) });
      list.push({ id: 'ctx-won', icon: 'check', label: `Mark ${d.name} as Won`, hint: 'This deal', run: () => requestStage(d.id, 'Won') });
      list.push({ id: 'ctx-lost', icon: 'x', label: `Mark ${d.name} as Lost`, hint: 'This deal', run: () => requestStage(d.id, 'Lost') });
      list.push({ id: 'ctx-email', icon: 'mail', label: 'Compose email', hint: 'This deal', run: composeFor('email') });
      list.push({ id: 'ctx-note', icon: 'note', label: 'Add note', hint: 'This deal', run: composeFor('note') });
      list.push({ id: 'ctx-call', icon: 'phone', label: 'Log call', hint: 'This deal', run: composeFor('call') });
      list.push({ id: 'ctx-task', icon: 'check', label: 'Create task', hint: 'This deal', run: composeFor('task') });
      list.push({ id: 'ctx-customize', icon: 'grid', label: 'Customize this screen', hint: 'This deal', run: () => setRecordEditing(true) });
      list.push({ id: 'ctx-dupe', icon: 'layers', label: `Duplicate ${d.name}`, hint: 'This deal', run: () => duplicateDeal(d.id) });
    }

    list.push(
      {
        id: 'new-deal-create',
        icon: 'plus',
        label: 'Create a new deal',
        hint: 'Deals',
        run: () => { const id = createDeal({ company: 'New company', name: 'New deal' }); setNav('deals'); openDeal(id); toast('Deal created — fill in the details', 'success'); },
      },
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
        id: 'go-activity',
        icon: 'activity',
        label: 'Go to 360° Activity',
        hint: 'Deals',
        run: () => { setNav('deals'); setView('activity'); },
      },
      {
        id: 'swim-owner',
        icon: 'users',
        label: 'Swimlanes by owner',
        hint: 'Board',
        run: () => { setNav('deals'); setView('board'); setSwimlane('owner'); },
      },
      {
        id: 'swim-priority',
        icon: 'flag',
        label: 'Swimlanes by priority',
        hint: 'Board',
        run: () => { setNav('deals'); setView('board'); setSwimlane('priority'); },
      },
      {
        id: 'swim-none',
        icon: 'grid',
        label: 'Clear swimlanes',
        hint: 'Board',
        run: () => setSwimlane('none'),
      },
      {
        id: 'toggle-compact',
        icon: 'list',
        label: kbCompact ? 'Comfortable cards' : 'Compact cards',
        hint: 'Board',
        run: () => setKbCompact(!kbCompact),
      },
      {
        id: 'filter-replies',
        icon: 'chat',
        label: 'Show deals with new replies',
        hint: 'Filter',
        run: () => { setNav('deals'); setFilters({ inbox: true }); },
      },
      {
        id: 'filter-risk',
        icon: 'alert',
        label: 'Show at-risk deals',
        hint: 'Filter',
        run: () => { setNav('deals'); setFilters({ health: 'risk' }); },
      },
      {
        id: 'filter-clear',
        icon: 'x',
        label: 'Clear all filters',
        hint: 'Filter',
        run: () => resetFilters(),
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
    );
    return list;
  }, [openD, requestStage, openComposer, setRecordEditing, duplicateDeal, createDeal, openDeal, setNav, setView, setPipeline, setNova, setSwimlane, setKbCompact, kbCompact, setFilters, resetFilters, toggleTheme, resetDemo, toast]);

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
