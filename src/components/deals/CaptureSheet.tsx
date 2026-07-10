import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { money } from '@/lib/format';

const WON_REASONS = ['Competitive win', 'Champion-led', 'Strong ROI', 'Right timing', 'Expansion'];
const LOST_REASONS = ['Lost to competitor', 'No budget', 'No decision', 'Bad timing', 'Went silent', 'Other'];

export function CaptureSheet() {
  const capture = useStore((s) => s.capture);
  const deal = useStore((s) => s.deals.find((d) => d.id === capture?.id));
  const applyCapture = useStore((s) => s.applyCapture);
  const cancelCapture = useStore((s) => s.cancelCapture);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');

  if (!capture || !deal) return null;
  const won = capture.to === 'Won';
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const color = won ? '#10B981' : '#EF4444';

  const submit = () => {
    applyCapture(reason, note, amount ? parseInt(amount.replace(/[^0-9]/g, ''), 10) : undefined);
    setReason(''); setNote(''); setAmount('');
  };

  return (
    <Modal
      open
      onClose={cancelCapture}
      width={460}
      title={
        <>
          <span className="dh-comp-chan-icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
            <Icon name={won ? 'check' : 'x'} size={15} />
          </span>
          Mark {deal.company} as {capture.to}
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={cancelCapture}>Cancel</Button>
          <Button variant="primary" onClick={submit} style={won ? { background: color } : undefined}>
            {won ? '🎉 ' : ''}Confirm {capture.to}
          </Button>
        </>
      }
    >
      <div className="dh-field">
        <label>{won ? 'Why did we win?' : 'Why did we lose?'}</label>
        <div className="dh-chip-row wrap" style={{ padding: 0 }}>
          {reasons.map((r) => (
            <button key={r} className={`dh-chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </div>
      {won && (
        <div className="dh-field">
          <label>Final amount (optional)</label>
          <input className="dh-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={money(deal.value)} inputMode="numeric" />
        </div>
      )}
      <div className="dh-field">
        <label>Notes (optional)</label>
        <textarea className="dh-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context for the team…" />
      </div>
    </Modal>
  );
}
