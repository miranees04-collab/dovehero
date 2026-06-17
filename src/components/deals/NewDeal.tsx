import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { OWNERS, STAGES } from '@/data/constants';
import type { PipelineKey, Priority, StageKey } from '@/types';

export function NewDealButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        <span className="hide-sm">New deal</span>
      </Button>
      {open && <NewDealModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewDealModal({ onClose }: { onClose: () => void }) {
  const createDeal = useStore((s) => s.createDeal);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const toast = useStore((s) => s.toast);
  const pipeline = useStore((s) => s.pipeline);
  const pipelines = useStore((s) => s.pipelines);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<StageKey>('Lead');
  const [owner, setOwner] = useState('AR');
  const [priority, setPriority] = useState<Priority>('med');
  const [pipe, setPipe] = useState(pipeline);

  const submit = () => {
    if (!company.trim()) {
      toast('Add a company name', 'warn');
      return;
    }
    const id = createDeal({
      name: name.trim() || `${company.trim()} — New deal`,
      company: company.trim(),
      value: parseInt(value.replace(/[^0-9]/g, ''), 10) || 0,
      stage,
      owner,
      priority,
      pipeline: pipe as PipelineKey,
    });
    setNav('deals');
    openDeal(id);
    toast('Deal created', 'success');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={540}
      title={
        <>
          <Icon name="plus" size={18} /> New deal
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Create deal
          </Button>
        </>
      }
    >
      <div className="dh-field">
        <label>Company</label>
        <input className="dh-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northwind Robotics" autoFocus />
      </div>
      <div className="dh-field">
        <label>Deal name</label>
        <input className="dh-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional — we'll generate one" />
      </div>
      <div className="dh-field-row">
        <div className="dh-field">
          <label>Value (USD)</label>
          <input className="dh-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" inputMode="numeric" />
        </div>
        <div className="dh-field">
          <label>Pipeline</label>
          <select className="dh-select" value={pipe} onChange={(e) => setPipe(e.target.value)}>
            {pipelines.map((p) => (
              <option key={p.k} value={p.k}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="dh-field-row">
        <div className="dh-field">
          <label>Stage</label>
          <select className="dh-select" value={stage} onChange={(e) => setStage(e.target.value as StageKey)}>
            {STAGES.filter((s) => s.k !== 'Won' && s.k !== 'Lost').map((s) => (
              <option key={s.k} value={s.k}>
                {s.k}
              </option>
            ))}
          </select>
        </div>
        <div className="dh-field">
          <label>Owner</label>
          <select className="dh-select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            {Object.values(OWNERS).map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="dh-field">
        <label>Priority</label>
        <div className="dh-pill-select">
          {(['high', 'med', 'low'] as Priority[]).map((p) => (
            <button key={p} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>
              {p === 'high' ? 'High' : p === 'med' ? 'Medium' : 'Low'}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
