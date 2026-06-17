import { useStore } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/primitives';
import { STAGES } from '@/data/constants';
import { uid } from '@/lib/format';
import type { Automation } from '@/types';
import './automations.css';

const TRIGGERS: [Automation['on']['t'], string][] = [
  ['stage', 'Stage changes to'],
  ['created', 'Deal is created'],
  ['stale', 'Deal goes stale'],
  ['health', 'Health drops below'],
];
const COND_FIELDS: [Automation['cond']['f'], string][] = [
  ['none', 'No condition'],
  ['priority', 'Priority is'],
  ['value', 'Value over'],
  ['owner', 'Owned by me'],
];
const ACTIONS: [Automation['act']['t'], string][] = [
  ['task', 'Add task'],
  ['priority', 'Set priority'],
  ['tag', 'Add tag'],
];

function trigDesc(r: Automation): string {
  if (r.on.t === 'stage') return `When stage → ${r.on.v || 'any'}`;
  if (r.on.t === 'created') return 'When a deal is created';
  if (r.on.t === 'stale') return `When stale ${r.on.v || 14}d`;
  return `When health < ${r.on.v || 50}`;
}
function actDesc(r: Automation): string {
  if (r.act.t === 'task') return `add task “${r.act.v || '…'}”`;
  if (r.act.t === 'priority') return `set priority ${r.act.v}`;
  return `add tag “${r.act.v}”`;
}

export function AutomationsPanel() {
  const open = useStore((s) => s.autoOpen);
  const setAuto = useStore((s) => s.setAuto);
  const rules = useStore((s) => s.automations);
  const edit = useStore((s) => s.autoEdit);
  const setAutoEdit = useStore((s) => s.setAutoEdit);
  const toggleAutomation = useStore((s) => s.toggleAutomation);
  const deleteAutomation = useStore((s) => s.deleteAutomation);
  const runAutomations = useStore((s) => s.runAutomations);

  return (
    <Drawer open={open} onClose={() => setAuto(false)} width={440} className="dh-panel">
      <div className="dh-panel-head">
        <div className="dh-panel-title"><Icon name="zap" size={18} /> Automations</div>
        <button className="dh-icon-btn" onClick={() => setAuto(false)} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <div className="dh-auto-bar">
        <Button variant="subtle" size="sm" onClick={runAutomations}><Icon name="zap" size={14} /> Run now</Button>
        <Button variant="primary" size="sm" onClick={() => setAutoEdit({ id: uid('au'), name: '', enabled: true, on: { t: 'stage', v: 'Negotiation' }, cond: { f: 'none', v: '' }, act: { t: 'task', v: '' } })}>
          <Icon name="plus" size={14} /> New rule
        </Button>
        <span className="dh-auto-hint">Rules run on stage change & creation.</span>
      </div>

      {edit && <RuleBuilder rule={edit} />}

      <div className="dh-panel-body">
        {rules.length === 0 ? (
          <div className="dh-panel-empty"><Icon name="zap" size={22} /><span>No automations yet.</span></div>
        ) : (
          rules.map((r) => (
            <div key={r.id} className={`dh-auto-row ${r.enabled ? '' : 'off'}`}>
              <div className="dh-auto-main">
                <div className="dh-auto-name">{r.name || 'Untitled rule'}</div>
                <div className="dh-auto-desc">{trigDesc(r)} → <b>{actDesc(r)}</b></div>
              </div>
              <button className={`dh-auto-tog ${r.enabled ? 'on' : ''}`} onClick={() => toggleAutomation(r.id)} aria-label="Toggle"><span /></button>
              <button className="dh-auto-ic" onClick={() => setAutoEdit({ ...r })} aria-label="Edit"><Icon name="sliders" size={14} /></button>
              <button className="dh-auto-ic" onClick={() => deleteAutomation(r.id)} aria-label="Delete"><Icon name="trash" size={13} /></button>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}

function RuleBuilder({ rule }: { rule: Automation }) {
  const setAutoEdit = useStore((s) => s.setAutoEdit);
  const saveAutomation = useStore((s) => s.saveAutomation);
  const set = (patch: Partial<Automation>) => setAutoEdit({ ...rule, ...patch });

  return (
    <div className="dh-rule-builder">
      <input className="dh-input" placeholder="Rule name" value={rule.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
      <div className="dh-rule-clause">
        <span className="dh-rule-lbl">When</span>
        <select className="dh-adv-sel" value={rule.on.t} onChange={(e) => set({ on: { t: e.target.value as Automation['on']['t'], v: '' } })}>
          {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {rule.on.t === 'stage' && (
          <select className="dh-adv-sel" value={rule.on.v} onChange={(e) => set({ on: { ...rule.on, v: e.target.value } })}>
            {STAGES.map((s) => <option key={s.k} value={s.k}>{s.k}</option>)}
            <option value="any">any</option>
          </select>
        )}
        {rule.on.t === 'stale' && (
          <select className="dh-adv-sel" value={rule.on.v} onChange={(e) => set({ on: { ...rule.on, v: e.target.value } })}>
            {['7', '14', '30', '60'].map((v) => <option key={v} value={v}>{v} days</option>)}
          </select>
        )}
        {rule.on.t === 'health' && (
          <select className="dh-adv-sel" value={rule.on.v} onChange={(e) => set({ on: { ...rule.on, v: e.target.value } })}>
            {['40', '50', '60', '70'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
      </div>
      <div className="dh-rule-clause">
        <span className="dh-rule-lbl">If</span>
        <select className="dh-adv-sel" value={rule.cond.f} onChange={(e) => set({ cond: { f: e.target.value as Automation['cond']['f'], v: '' } })}>
          {COND_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {rule.cond.f === 'priority' && (
          <select className="dh-adv-sel" value={rule.cond.v} onChange={(e) => set({ cond: { ...rule.cond, v: e.target.value } })}>
            {['high', 'med', 'low'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        {rule.cond.f === 'value' && (
          <select className="dh-adv-sel" value={rule.cond.v} onChange={(e) => set({ cond: { ...rule.cond, v: e.target.value } })}>
            {['25000', '50000', '100000', '250000'].map((v) => <option key={v} value={v}>${(+v / 1000)}k</option>)}
          </select>
        )}
      </div>
      <div className="dh-rule-clause">
        <span className="dh-rule-lbl">Then</span>
        <select className="dh-adv-sel" value={rule.act.t} onChange={(e) => set({ act: { t: e.target.value as Automation['act']['t'], v: e.target.value === 'priority' ? 'high' : '' } })}>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {rule.act.t === 'priority' ? (
          <select className="dh-adv-sel" value={rule.act.v} onChange={(e) => set({ act: { ...rule.act, v: e.target.value } })}>
            {['high', 'med', 'low'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <input className="dh-adv-in" placeholder={rule.act.t === 'task' ? 'Task title' : 'Tag'} value={rule.act.v} onChange={(e) => set({ act: { ...rule.act, v: e.target.value } })} />
        )}
      </div>
      <div className="dh-rule-foot">
        <Button variant="ghost" size="sm" onClick={() => setAutoEdit(null)}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={() => saveAutomation(rule)}><Icon name="check" size={14} /> Save rule</Button>
      </div>
    </div>
  );
}
