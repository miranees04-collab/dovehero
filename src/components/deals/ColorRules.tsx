import { useStore } from '@/store/useStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { RULE_FIELDS, OPS_BY_TYPE, RULE_COLORS, fieldMeta, type ColorRule } from '@/lib/colorRules';

const ALL_TAGS = ['Enterprise', 'Expansion', 'Strategic', 'Renewal', 'Outbound', 'Inbound', 'At-risk'];

export function ColorRulesModal() {
  const open = useStore((s) => s.colorRulesOpen);
  const setOpen = useStore((s) => s.setColorRulesOpen);
  const rules = useStore((s) => s.colorRules);
  const on = useStore((s) => s.colorRulesOn);
  const toggle = useStore((s) => s.toggleColorRules);
  const add = useStore((s) => s.addColorRule);
  const update = useStore((s) => s.updateColorRule);
  const remove = useStore((s) => s.removeColorRule);
  const move = useStore((s) => s.moveColorRule);
  const reset = useStore((s) => s.resetColorRules);

  if (!open) return null;

  return (
    <Modal
      open
      onClose={() => setOpen(false)}
      width={620}
      title={<><Icon name="sliders" size={16} /> Color rules</>}
      footer={
        <>
          <button className="dh-btn v-ghost s-sm" onClick={reset}><Icon name="reset" size={14} /> Reset to defaults</button>
          <div style={{ flex: 1 }} />
          <Button variant="primary" onClick={() => setOpen(false)}><Icon name="check" size={14} /> Done</Button>
        </>
      }
    >
      <div className="dh-cr-top">
        <div className="dh-cr-toprow">
          <div>
            <b>Conditional color coding</b>
            <p>Color-code deals on the board and list by any property. The first matching rule (top to bottom) wins.</p>
          </div>
          <button className={`dh-cmp-sw ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => toggle()} title="Turn color coding on/off">
            <span className="dh-cmp-knob" />
          </button>
        </div>
      </div>

      <div className="dh-cr-list">
        {rules.map((r, i) => (
          <RuleRow key={r.id} rule={r} first={i === 0} last={i === rules.length - 1} update={update} remove={remove} move={move} />
        ))}
        {!rules.length && <div className="dh-cr-empty">No rules yet — add one below.</div>}
      </div>

      <button className="dh-cr-add" onClick={add}><Icon name="plus" size={14} /> Add color rule</button>
    </Modal>
  );
}

function RuleRow({ rule: r, first, last, update, remove, move }: {
  rule: ColorRule;
  first: boolean;
  last: boolean;
  update: (id: string, patch: Partial<ColorRule>) => void;
  remove: (id: string) => void;
  move: (id: string, dir: -1 | 1) => void;
}) {
  const meta = fieldMeta(r.field);
  const type = meta?.type ?? 'text';
  const ops = OPS_BY_TYPE[type];

  return (
    <div className={`dh-cr-row ${r.enabled ? '' : 'off'}`} style={{ ['--rc' as string]: r.color }}>
      <button className={`dh-cr-toggle ${r.enabled ? 'on' : ''}`} onClick={() => update(r.id, { enabled: !r.enabled })} title={r.enabled ? 'Disable' : 'Enable'}>
        {r.enabled && <Icon name="check" size={11} color="#fff" />}
      </button>

      <div className="dh-cr-swatch-wrap">
        <span className="dh-cr-swatch" style={{ background: r.color }} />
        <div className="dh-cr-swatches">
          {RULE_COLORS.map((c) => (
            <button key={c} className={`dh-cr-sw ${r.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => update(r.id, { color: c })} aria-label={`Color ${c}`} />
          ))}
        </div>
      </div>

      <input className="dh-cr-label" value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} placeholder="Label" />

      <span className="dh-cr-when">if</span>
      <select className="dh-cr-sel" value={r.field} onChange={(e) => { const nf = e.target.value; const nt = fieldMeta(nf)?.type ?? 'text'; update(r.id, { field: nf, op: OPS_BY_TYPE[nt][0].value, value: '' }); }}>
        {RULE_FIELDS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
      </select>
      <select className="dh-cr-sel op" value={r.op} onChange={(e) => update(r.id, { op: e.target.value })}>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ValueInput rule={r} type={type} opts={meta?.opts} update={update} />

      <span className="dh-cr-actions">
        <button onClick={() => move(r.id, -1)} disabled={first} title="Move up"><Icon name="arrowUp" size={12} /></button>
        <button onClick={() => move(r.id, 1)} disabled={last} title="Move down"><Icon name="chevronDown" size={12} /></button>
        <button className="del" onClick={() => remove(r.id)} title="Delete rule"><Icon name="trash" size={13} /></button>
      </span>
    </div>
  );
}

function ValueInput({ rule: r, type, opts, update }: {
  rule: ColorRule;
  type: string;
  opts?: { value: string; label: string }[];
  update: (id: string, patch: Partial<ColorRule>) => void;
}) {
  if (type === 'enum' && opts) {
    return (
      <select className="dh-cr-sel val" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })}>
        <option value="">choose…</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (type === 'tags') {
    return (
      <select className="dh-cr-sel val" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })}>
        <option value="">choose…</option>
        {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }
  return (
    <input
      className="dh-cr-val"
      type={type === 'number' ? 'number' : 'text'}
      value={r.value}
      onChange={(e) => update(r.id, { value: e.target.value })}
      placeholder={type === 'number' ? '0' : 'value'}
    />
  );
}
