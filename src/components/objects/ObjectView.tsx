import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Badge, Button } from '@/components/ui/primitives';
import { money, initials, uid } from '@/lib/format';
import type { FieldDef, FieldType, ObjectDef, ObjectRecord } from '@/types';
import './objects.css';

export function ObjectView() {
  const nav = useStore((s) => s.nav);
  const objects = useStore((s) => s.objects);
  const records = useStore((s) => s.objectRecords[nav] ?? []);
  const openObjectId = useStore((s) => s.openObjectId);
  const openObject = useStore((s) => s.openObject);
  const addObjectRecord = useStore((s) => s.addObjectRecord);
  const addCustomObject = useStore((s) => s.addCustomObject);
  const role = useStore((s) => s.role);
  const toast = useStore((s) => s.toast);

  const def = objects.find((o) => o.k === nav);
  if (!def) return <div className="dh-obj-empty">Unknown object.</div>;

  if (openObjectId) {
    const rec = records.find((r) => r.id === openObjectId);
    if (rec) return <ObjectRecordView def={def} rec={rec} onBack={() => openObject(null)} />;
  }

  const cols = def.fields.slice(0, 5);
  const addNew = () => {
    const id = def.k.slice(0, 2).toUpperCase() + '-' + uid('n').slice(-4);
    const rec: ObjectRecord = { id, name: `New ${def.name}` };
    addObjectRecord(def.k, rec);
    openObject(id);
    toast(`${def.name} created`, 'success');
  };

  return (
    <div className="dh-obj">
      <div className="dh-obj-toolbar">
        <span className="dh-obj-count">
          {records.length} {records.length === 1 ? def.name.toLowerCase() : def.plural.toLowerCase()}
        </span>
        {role === 'admin' && (
          <Button variant="ghost" size="sm" onClick={addCustomObject} title="Create a custom object">
            <Icon name="box" size={15} /> New object
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={addNew}>
          <Icon name="plus" size={15} /> New {def.name.toLowerCase()}
        </Button>
      </div>
      <div className="dh-obj-scroll">
        <table className="dh-table dh-obj-table">
          <thead>
            <tr>
              {cols.map((f) => (
                <th key={f.k}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} onClick={() => openObject(r.id)}>
                {cols.map((f, i) => (
                  <td key={f.k}>{i === 0 ? <RecordName def={def} rec={r} /> : <CellValue field={f} value={r[f.k]} />}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <div className="dh-table-empty">
            <Icon name={def.icon} size={22} />
            <span>No {def.plural.toLowerCase()} yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordName({ def, rec }: { def: { icon: string }; rec: ObjectRecord }) {
  const name = String(rec.name ?? rec.id);
  return (
    <div className="dh-obj-name">
      <span className="dh-obj-avatar">{initials(name) || <Icon name={def.icon} size={14} />}</span>
      <b>{name}</b>
    </div>
  );
}

function CellValue({ field, value }: { field: FieldDef; value: unknown }) {
  if (value == null || value === '') return <span className="dh-obj-dim">—</span>;
  if (field.type === 'currency') return <span className="mono">{money(Number(value))}</span>;
  if (field.type === 'number') return <span className="mono">{Number(value).toLocaleString()}</span>;
  if (field.type === 'checkbox') return value ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>;
  if (field.type === 'select') {
    const v = String(value);
    const tone = /urgent|high|open|new/i.test(v) ? 'amber' : /solved|qualified|active|paid/i.test(v) ? 'green' : 'neutral';
    return <Badge tone={tone as 'amber'}>{v}</Badge>;
  }
  if (field.type === 'email' || field.type === 'url') return <span className="dh-obj-link">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function ObjectRecordView({
  def,
  rec,
  onBack,
}: {
  def: ObjectDef;
  rec: ObjectRecord;
  onBack: () => void;
}) {
  const updateObjectRecord = useStore((s) => s.updateObjectRecord);
  const removeField = useStore((s) => s.removeField);
  const role = useStore((s) => s.role);
  const name = String(rec.name ?? rec.id);
  const owner = rec.owner ? String(rec.owner) : null;
  const set = (k: string, v: unknown) => updateObjectRecord(def.k, rec.id, { [k]: v });

  return (
    <div className="dh-obj-record">
      <div className="dh-obj-rec-head">
        <button className="dh-btn v-ghost s-sm" onClick={onBack}>
          <Icon name="arrowLeft" size={15} /> Back to {def.plural}
        </button>
        <div className="dh-obj-rec-title">
          <span className="dh-obj-rec-avatar">
            {owner ? <Avatar name={owner} size={44} /> : <Icon name={def.icon} size={22} />}
          </span>
          <div>
            <h1>{name}</h1>
            <span className="dh-obj-rec-id mono">{rec.id}</span>
          </div>
        </div>
      </div>
      <div className="dh-obj-rec-body">
        <section className="dh-rec-card">
          <div className="dh-obj-fields-head">
            <h4 className="dh-rail-title" style={{ margin: 0 }}>Details</h4>
            <span className="dh-obj-edit-hint">Click a value to edit</span>
          </div>
          <div className="dh-obj-fields">
            {def.fields.map((f) => (
              <div key={f.k} className="dh-obj-field">
                <span className="dh-obj-field-label">
                  {f.label}
                  {role === 'admin' && f.k !== 'name' && (
                    <button className="dh-field-del" onClick={() => removeField(def.k, f.k)} aria-label={`Remove ${f.label}`} title="Remove field">
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </span>
                <span className="dh-obj-field-value">
                  <FieldEditor field={f} value={rec[f.k]} onChange={(v) => set(f.k, v)} />
                </span>
              </div>
            ))}
          </div>
          {role === 'admin' && <PropertyBuilder objKey={def.k} />}
        </section>
      </div>
    </div>
  );
}

function FieldEditor({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'checkbox') {
    return (
      <label className="dh-obj-check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {value ? 'Yes' : 'No'}
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <select className="dh-obj-inline-input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.opts ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'longtext') {
    return (
      <textarea
        className="dh-obj-inline-input"
        rows={2}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Empty"
      />
    );
  }
  const inputType = field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'text' : 'text';
  return (
    <input
      className="dh-obj-inline-input"
      type={inputType}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(field.type === 'number' || field.type === 'currency' ? Number(e.target.value) || 0 : e.target.value)}
      placeholder="Empty"
    />
  );
}

const FIELD_TYPES: { k: FieldType; label: string }[] = [
  { k: 'text', label: 'Text' },
  { k: 'longtext', label: 'Long text' },
  { k: 'number', label: 'Number' },
  { k: 'currency', label: 'Currency' },
  { k: 'date', label: 'Date' },
  { k: 'select', label: 'Dropdown' },
  { k: 'checkbox', label: 'Checkbox' },
  { k: 'url', label: 'URL' },
  { k: 'email', label: 'Email' },
];

function PropertyBuilder({ objKey }: { objKey: string }) {
  const addField = useStore((s) => s.addField);
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [opts, setOpts] = useState('Option A, Option B');

  const add = () => {
    const name = label.trim();
    if (!name) { toast('Name the field first', 'warn'); return; }
    const k = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'f' + (Date.now() % 100000);
    const field: FieldDef = { k, label: name, type };
    if (type === 'select') field.opts = opts.split(',').map((s) => s.trim()).filter(Boolean);
    addField(objKey, field);
    setLabel('');
    setType('text');
    setOpen(false);
    toast('Field added', 'success');
  };

  if (!open) {
    return (
      <button className="dh-prop-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Add field
      </button>
    );
  }
  return (
    <div className="dh-prop-builder">
      <div className="dh-prop-row">
        <input className="dh-input" placeholder="Field name" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        <select className="dh-select" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => (
            <option key={t.k} value={t.k}>{t.label}</option>
          ))}
        </select>
      </div>
      {type === 'select' && (
        <input className="dh-input" placeholder="Comma-separated options" value={opts} onChange={(e) => setOpts(e.target.value)} />
      )}
      <div className="dh-prop-actions">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={add}>Add field</Button>
      </div>
    </div>
  );
}
