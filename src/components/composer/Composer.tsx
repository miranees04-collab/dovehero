import { useStore, type ComposerKind } from '@/store/useStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import type { Priority } from '@/types';
import './composer.css';

const TABS: { k: ComposerKind; label: string; icon: string }[] = [
  { k: 'note', label: 'Note', icon: 'note' },
  { k: 'call', label: 'Call', icon: 'phone' },
  { k: 'task', label: 'Task', icon: 'check' },
  { k: 'meeting', label: 'Meeting', icon: 'calendar' },
  { k: 'email', label: 'Email', icon: 'mail' },
];

const META: Record<ComposerKind, { title: string; icon: string; color: string; cta: string }> = {
  note: { title: 'Add note', icon: 'note', color: '#F59E0B', cta: 'Save note' },
  call: { title: 'Log a call', icon: 'phone', color: '#10B981', cta: 'Log call' },
  task: { title: 'Create task', icon: 'check', color: '#F59E0B', cta: 'Create task' },
  meeting: { title: 'Schedule meeting', icon: 'calendar', color: '#8B5CF6', cta: 'Schedule' },
  email: { title: 'Send email', icon: 'mail', color: '#3B82F6', cta: 'Send email' },
  whatsapp: { title: 'New WhatsApp', icon: 'whatsapp', color: '#25D366', cta: 'Send WhatsApp' },
  sms: { title: 'New SMS', icon: 'sms', color: '#0EA5E9', cta: 'Send SMS' },
};

const NOVA_DRAFTS = [
  "Hi {name},\n\nThanks for the time this week. I've attached the order form covering everything we aligned on — scope, pricing, and timeline. Happy to walk procurement through any questions.\n\nWhat's the best path to get this signed by {close}?\n\nBest,\nAmara",
  "Hi {name},\n\nQuick check-in on next steps for {deal}. I want to keep momentum toward your timeline — is there anything you need from me to move forward this week?\n\nThanks,\nAmara",
];

export function Composer() {
  const composer = useStore((s) => s.composer);
  const close = useStore((s) => s.closeComposer);
  const send = useStore((s) => s.sendComposer);
  const openComposer = useStore((s) => s.openComposer);
  const deal = useStore((s) => s.deals.find((d) => d.id === composer?.dealId));

  if (!composer) return null;
  const c = composer;
  const m = META[c.kind];
  const isChat = c.kind === 'whatsapp' || c.kind === 'sms';
  const update = (patch: Partial<typeof composer>) => openComposer({ ...composer, ...patch });

  const draftWithNova = () => {
    const name = deal?.contacts[0]?.n?.split(' ')[0] ?? 'there';
    const text = NOVA_DRAFTS[Math.floor(Math.random() * NOVA_DRAFTS.length)]
      .replace(/{name}/g, name).replace(/{deal}/g, deal?.name ?? 'your deal').replace(/{close}/g, deal?.close ?? 'end of month');
    update({ body: text });
  };

  return (
    <Modal
      open
      onClose={close}
      width={560}
      title={
        <>
          <span className="dh-comp-chan-icon" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}>
            <Icon name={m.icon} size={15} />
          </span>
          {m.title}
        </>
      }
      footer={
        <>
          {(c.kind === 'email' || isChat) && (
            <Button variant="ai" onClick={draftWithNova}>
              <Icon name="sparkles" size={15} /> Draft with Nova
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={send}>
            <Icon name="check" size={15} /> {m.cta}
          </Button>
        </>
      }
    >
      {!isChat && (
        <div className="dh-comp-tabs">
          {TABS.map((t) => (
            <button key={t.k} className={`dh-comp-tab ${c.kind === t.k ? 'on' : ''}`} onClick={() => update({ kind: t.k })}>
              <Icon name={t.icon} size={15} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {c.kind === 'note' && (
        <>
          <textarea className="dh-textarea" style={{ minHeight: 110 }} placeholder={`Write a note about ${deal?.name ?? 'this deal'}…`} value={c.body ?? ''} onChange={(e) => update({ body: e.target.value })} autoFocus />
          <label className="dh-comp-toggle">
            <span>Pin to top of timeline</span>
            <input type="checkbox" checked={!!c.pin} onChange={(e) => update({ pin: e.target.checked })} />
          </label>
          <label className="dh-comp-toggle">
            <span>Add a reminder / follow-up</span>
            <input type="checkbox" checked={!!c.reminder} onChange={(e) => update({ reminder: e.target.checked })} />
          </label>
          {c.reminder && (
            <input className="dh-input" style={{ marginTop: 8 }} placeholder="Follow-up — e.g. Send recap Friday" value={c.reminderTitle ?? ''} onChange={(e) => update({ reminderTitle: e.target.value })} />
          )}
        </>
      )}

      {c.kind === 'call' && (
        <>
          <div className="dh-field"><label>Outcome</label>
            <div className="dh-comp-seg">
              {(['Connected', 'Voicemail', 'No answer', 'Busy'] as const).map((o) => (
                <button key={o} className={c.outcome === o ? 'on' : ''} onClick={() => update({ outcome: o })}>{o}</button>
              ))}
            </div>
          </div>
          <textarea className="dh-textarea" placeholder="What was discussed, next steps…" value={c.body ?? ''} onChange={(e) => update({ body: e.target.value })} />
          <label className="dh-comp-toggle"><span>Add a follow-up task</span>
            <input type="checkbox" checked={!!c.followup} onChange={(e) => update({ followup: e.target.checked })} />
          </label>
        </>
      )}

      {c.kind === 'task' && (
        <>
          <div className="dh-field"><label>Task</label>
            <input className="dh-input" value={c.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="What needs doing?" autoFocus />
          </div>
          <div className="dh-field-row">
            <div className="dh-field"><label>Due</label>
              <input className="dh-input" value={c.due ?? 'Tomorrow'} onChange={(e) => update({ due: e.target.value })} />
            </div>
            <div className="dh-field"><label>Priority</label>
              <div className="dh-comp-seg">
                {(['low', 'med', 'high'] as Priority[]).map((p) => (
                  <button key={p} className={(c.prio ?? 'med') === p ? 'on' : ''} onClick={() => update({ prio: p })}>{p === 'low' ? 'Low' : p === 'med' ? 'Med' : 'High'}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {c.kind === 'meeting' && (
        <>
          <div className="dh-field"><label>Title</label>
            <input className="dh-input" value={c.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="Meeting title" autoFocus />
          </div>
          <div className="dh-field-row">
            <div className="dh-field"><label>When</label>
              <input className="dh-input" value={c.when ?? ''} onChange={(e) => update({ when: e.target.value })} placeholder="e.g. Thu · 11:00" />
            </div>
            <div className="dh-field"><label>Duration</label>
              <div className="dh-comp-seg">
                {['15', '30', '45', '60'].map((o) => (
                  <button key={o} className={(c.dur ?? '30') === o ? 'on' : ''} onClick={() => update({ dur: o })}>{o}m</button>
                ))}
              </div>
            </div>
          </div>
          <div className="dh-field"><label>Agenda / location</label>
            <input className="dh-input" value={c.loc ?? ''} onChange={(e) => update({ loc: e.target.value })} placeholder="Agenda or video link" />
          </div>
        </>
      )}

      {c.kind === 'email' && (
        <>
          <div className="dh-field"><label>To</label>
            <input className="dh-input" value={c.to ?? ''} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <div className="dh-field"><label>Subject</label>
            <input className="dh-input" value={c.subject ?? ''} onChange={(e) => update({ subject: e.target.value })} />
          </div>
          <div className="dh-field"><label>Message</label>
            <textarea className="dh-textarea" style={{ minHeight: 140 }} placeholder="Write your email…  or let Nova draft it." value={c.body ?? ''} onChange={(e) => update({ body: e.target.value })} />
          </div>
        </>
      )}

      {isChat && (
        <>
          <div className="dh-field"><label>To</label>
            <input className="dh-input" value={c.to ?? ''} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <div className="dh-field"><label>Message</label>
            <textarea className="dh-textarea" style={{ minHeight: 120 }} placeholder={`Write your ${c.kind === 'whatsapp' ? 'WhatsApp' : 'SMS'}…`} value={c.body ?? ''} onChange={(e) => update({ body: e.target.value })} autoFocus />
          </div>
        </>
      )}

      <p className="dh-comp-note">
        <Icon name="zap" size={12} /> Demo mode — everything is logged to the deal timeline; nothing is actually sent.
      </p>
    </Modal>
  );
}
