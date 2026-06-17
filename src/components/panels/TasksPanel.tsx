import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import type { Activity } from '@/types';
import './tasks-hub.css';

interface TaskRow {
  act: Activity;
  dealId: string;
  dealName: string;
  company: string;
}

export function TasksPanel() {
  const open = useStore((s) => s.tasksOpen);
  const setTasks = useStore((s) => s.setTasks);
  const deals = useStore((s) => s.deals);
  const toggleTask = useStore((s) => s.toggleTask);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const tasks = useMemo<TaskRow[]>(() => {
    const rows: TaskRow[] = [];
    deals.forEach((d) => {
      d.acts.forEach((a) => {
        if (a.type === 'task') rows.push({ act: a, dealId: d.id, dealName: d.name, company: d.company });
      });
    });
    return rows;
  }, [deals]);

  const visible = filter === 'open' ? tasks.filter((t) => !t.act.done) : tasks;
  const openCount = tasks.filter((t) => !t.act.done).length;

  const goToDeal = (id: string) => {
    setNav('deals');
    openDeal(id);
    setTasks(false);
  };

  return (
    <Drawer open={open} onClose={() => setTasks(false)} width={400} className="dh-panel">
      <div className="dh-panel-head">
        <div className="dh-panel-title">
          <Icon name="tasks" size={18} /> My tasks
          {openCount > 0 && <Badge tone="accent">{openCount} open</Badge>}
        </div>
        <button className="dh-icon-btn" onClick={() => setTasks(false)} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="dh-panel-tabs">
        <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>
          Open
        </button>
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          All
        </button>
      </div>

      <div className="dh-panel-body">
        {visible.length === 0 ? (
          <div className="dh-panel-empty">
            <Icon name="check" size={22} />
            <span>You're all caught up.</span>
          </div>
        ) : (
          visible.map((t) => (
            <div key={t.act.id} className={`dh-task-row ${t.act.done ? 'done' : ''}`}>
              <button
                className="dh-task-check"
                onClick={() => toggleTask(t.dealId, t.act.id)}
                aria-label={t.act.done ? 'Mark not done' : 'Mark done'}
              >
                {t.act.done && <Icon name="check" size={12} />}
              </button>
              <div className="dh-task-main" onClick={() => goToDeal(t.dealId)}>
                <div className="dh-task-title">{t.act.title ?? t.act.text}</div>
                <div className="dh-task-meta">
                  <span className="dh-task-deal">{t.company}</span>
                  {t.act.due && (
                    <Badge tone={/today|overdue/i.test(t.act.due) ? 'amber' : 'neutral'}>
                      <Icon name="clock" size={10} /> {t.act.due}
                    </Badge>
                  )}
                  {t.act.prio === 'high' && <Badge tone="red">High</Badge>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
