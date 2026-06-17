import { useStore } from '@/store/useStore';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Badge, Button } from '@/components/ui/primitives';
import { money, initials, uid } from '@/lib/format';
import type { FieldDef, ObjectRecord } from '@/types';
import './objects.css';

export function ObjectView() {
  const nav = useStore((s) => s.nav);
  const objects = useStore((s) => s.objects);
  const records = useStore((s) => s.objectRecords[nav] ?? []);
  const openObjectId = useStore((s) => s.openObjectId);
  const openObject = useStore((s) => s.openObject);
  const addObjectRecord = useStore((s) => s.addObjectRecord);
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
  def: { k: string; name: string; plural: string; icon: string; fields: FieldDef[] };
  rec: ObjectRecord;
  onBack: () => void;
}) {
  const name = String(rec.name ?? rec.id);
  const owner = rec.owner ? String(rec.owner) : null;
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
          <h4 className="dh-rail-title">Details</h4>
          <div className="dh-obj-fields">
            {def.fields.map((f) => (
              <div key={f.k} className="dh-obj-field">
                <span className="dh-obj-field-label">{f.label}</span>
                <span className="dh-obj-field-value">
                  <CellValue field={f} value={rec[f.k]} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
