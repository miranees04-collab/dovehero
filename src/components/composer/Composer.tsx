import { useStore } from '@/store/useStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import './composer.css';

const CHANNEL_META = {
  email: { label: 'Email', icon: 'mail', color: '#3B82F6' },
  whatsapp: { label: 'WhatsApp', icon: 'whatsapp', color: '#25D366' },
  sms: { label: 'SMS', icon: 'sms', color: '#0EA5E9' },
} as const;

const NOVA_DRAFTS: Record<string, string[]> = {
  email: [
    "Hi {name},\n\nThanks for the time this week. I've attached the order form covering everything we aligned on — scope, pricing, and timeline. Happy to walk procurement through any questions.\n\nWhat's the best path to get this signed by {close}?\n\nBest,\nAmara",
    "Hi {name},\n\nQuick check-in on next steps for {deal}. I want to make sure we keep momentum toward your timeline. Is there anything you need from me to move forward this week?\n\nThanks,\nAmara",
  ],
  whatsapp: ['Hi {name} 👋 just following up on {deal} — anything I can help unblock to keep things moving?'],
  sms: ['Hi {name}, Amara from Dovehero — following up on {deal}. Any questions before we proceed?'],
};

export function Composer() {
  const composer = useStore((s) => s.composer);
  const close = useStore((s) => s.closeComposer);
  const send = useStore((s) => s.sendComposer);
  const openComposer = useStore((s) => s.openComposer);
  const deal = useStore((s) => s.deals.find((d) => d.id === composer?.dealId));

  if (!composer) return null;
  const meta = CHANNEL_META[composer.channel];

  const update = (patch: Partial<typeof composer>) => openComposer({ ...composer, ...patch });

  const draftWithNova = () => {
    const drafts = NOVA_DRAFTS[composer.channel] ?? NOVA_DRAFTS.email;
    const name = deal?.contacts[0]?.n?.split(' ')[0] ?? 'there';
    const text = drafts[Math.floor(Math.random() * drafts.length)]
      .replace(/{name}/g, name)
      .replace(/{deal}/g, deal?.name ?? 'your deal')
      .replace(/{close}/g, deal?.close ?? 'end of month');
    update({ body: text });
  };

  return (
    <Modal
      open
      onClose={close}
      width={560}
      title={
        <>
          <span className="dh-comp-chan-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
            <Icon name={meta.icon} size={15} />
          </span>
          New {meta.label}
        </>
      }
      footer={
        <>
          <Button variant="ai" onClick={draftWithNova}>
            <Icon name="sparkles" size={15} /> Draft with Nova
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send}>
            <Icon name="send" size={15} /> Send {meta.label}
          </Button>
        </>
      }
    >
      <div className="dh-field">
        <label>To</label>
        <input className="dh-input" value={composer.to} onChange={(e) => update({ to: e.target.value })} />
      </div>
      {composer.channel === 'email' && (
        <div className="dh-field">
          <label>Subject</label>
          <input className="dh-input" value={composer.subject} onChange={(e) => update({ subject: e.target.value })} />
        </div>
      )}
      <div className="dh-field">
        <label>Message</label>
        <textarea
          className="dh-textarea"
          style={{ minHeight: 150 }}
          placeholder={`Write your ${meta.label.toLowerCase()}…  or let Nova draft it.`}
          value={composer.body}
          onChange={(e) => update({ body: e.target.value })}
        />
      </div>
      <p className="dh-comp-note">
        <Icon name="zap" size={12} /> Demo mode — messages are logged to the deal timeline, not actually sent.
      </p>
    </Modal>
  );
}
