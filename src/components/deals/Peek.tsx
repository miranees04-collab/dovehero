import { useStore, type ComposerKind } from '@/store/useStore';
import { Drawer } from '@/components/ui/Modal';
import { Icon, ACTIVITY_ICONS } from '@/components/ui/Icon';
import { Avatar, Badge, Button } from '@/components/ui/primitives';
import { OWNERS, healthColor, healthBand, hueOf, ACTIVITY_META } from '@/data/constants';
import { money, initials } from '@/lib/format';
import { nextBestAction } from '@/lib/nova';

const QUICK: { k: ComposerKind; label: string; icon: string }[] = [
  { k: 'note', label: 'Note', icon: 'note' },
  { k: 'email', label: 'Email', icon: 'mail' },
  { k: 'call', label: 'Call', icon: 'phone' },
  { k: 'meeting', label: 'Meeting', icon: 'calendar' },
  { k: 'task', label: 'Task', icon: 'check' },
  { k: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
];

export function Peek() {
  const peekId = useStore((s) => s.peekId);
  const deal = useStore((s) => s.deals.find((d) => d.id === peekId));
  const setPeek = useStore((s) => s.setPeek);
  const openDeal = useStore((s) => s.openDeal);
  const setNav = useStore((s) => s.setNav);
  const openComposer = useStore((s) => s.openComposer);
  const deleteDeal = useStore((s) => s.deleteDeal);

  if (!peekId || !deal) return null;
  const hc = healthColor(deal.health);
  const recent = deal.acts.slice(0, 6);
  const productTotal = deal.products.reduce((a, p) => a + p.v, 0);

  const open = (kind: ComposerKind) => {
    const c = deal.contacts[0];
    const email = `${(c?.n ?? 'contact').toLowerCase().replace(/\s+/g, '.')}@${deal.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    openComposer({
      dealId: deal.id, kind,
      to: kind === 'email' ? email : '+1 (415) 555-0140',
      subject: kind === 'email' ? `${deal.name} — next steps` : '',
      body: '', outcome: 'Connected', due: 'Tomorrow', prio: 'med', dur: '30',
      title: kind === 'task' ? String(deal.next ?? 'Follow up') : kind === 'meeting' ? `Next steps — ${deal.name}` : '',
    });
  };

  return (
    <Drawer open onClose={() => setPeek(null)} width={400} className="dh-panel">
      <div className="dh-panel-head">
        <div className="dh-panel-title" style={{ fontSize: 14, gap: 8 }}>
          <span className="dh-peek-stage" style={{ ['--pc' as string]: hueOf(deal.stage) }}>
            <span className="d" /> {deal.stage}
          </span>
        </div>
        <button className="dh-icon-btn" onClick={() => setPeek(null)} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>

      <div className="dh-panel-body" style={{ padding: 0 }}>
        <div className="dh-peek-titlewrap">
          <h2>{deal.name}</h2>
          <div className="dh-peek-co">{deal.company} · {deal.industry} · <span className="mono">{deal.id}</span></div>
        </div>

        {/* Quick activity shortcuts — create activities right from the preview */}
        <div className="dh-peek-quick">
          {QUICK.map((q) => (
            <button key={q.k} onClick={() => open(q.k)} title={`Log ${q.label.toLowerCase()}`}>
              <Icon name={q.icon} size={15} /> {q.label}
            </button>
          ))}
        </div>

        {/* Deal properties */}
        <section className="dh-peek-sec">
          <div className="dh-peek-sec-t"><Icon name="sliders" size={12} /> Deal properties</div>
          <div className="dh-peek-stats">
            <div><span className="l">Amount</span><span className="v mono">{deal.value ? money(deal.value) : '—'}</span></div>
            <div><span className="l">Win</span><span className="v mono" style={{ color: 'var(--violet)' }}>{deal.win}%</span></div>
            <div><span className="l">Health</span><span className="v" style={{ color: hc }}>{deal.health}</span></div>
            <div><span className="l">Priority</span><span className="v" style={{ textTransform: 'capitalize' }}>{deal.priority}</span></div>
          </div>
          <div className="dh-peek-rows">
            <div><span className="pk">Owner</span><span className="pv"><Avatar ownerKey={deal.owner} size={18} /> {OWNERS[deal.owner]?.name}</span></div>
            <div><span className="pk">Close date</span><span className="pv">{deal.close}</span></div>
            <div><span className="pk">Created</span><span className="pv">{deal.created}</span></div>
            <div><span className="pk">Health</span><span className="pv" style={{ color: hc }}>{healthBand(deal.health)}</span></div>
          </div>
          {deal.tags.length > 0 && (
            <div className="dh-peek-tags">{deal.tags.map((t) => <Badge key={t} tone={t === 'At-risk' ? 'red' : 'neutral'}>{t}</Badge>)}</div>
          )}
        </section>

        {/* Recent activity & comments */}
        <section className="dh-peek-sec">
          <div className="dh-peek-sec-t"><Icon name="activity" size={12} /> Recent activity &amp; comments</div>
          <div className="dh-peek-nova">
            <Icon name="sparkles" size={13} color="var(--violet)" /><span>{nextBestAction(deal)}</span>
          </div>
          {recent.length === 0 && <div className="dh-peek-muted">No activity yet</div>}
          {recent.map((a) => {
            const meta = ACTIVITY_META[a.type];
            const text = a.text ?? a.subj ?? (a.thread?.[a.thread.length - 1]?.text) ?? meta.label;
            return (
              <div key={a.id} className="dh-peek-act">
                <span className="dh-peek-act-ic" style={{ color: meta.color }}><Icon name={ACTIVITY_ICONS[a.type] ?? 'note'} size={14} /></span>
                <div className="dh-peek-act-main">
                  <div className="dh-peek-act-h"><b>{a.who}</b><span className="mono">· {a.w}</span></div>
                  <div className="dh-peek-act-t">{text}</div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Associations */}
        <section className="dh-peek-sec">
          <div className="dh-peek-sec-t"><Icon name="layers" size={12} /> Associations</div>

          <div className="dh-peek-sub"><Icon name="box" size={11} /> Products <span className="dh-peek-sum mono">{money(productTotal, true)}</span></div>
          {deal.products.length === 0 && <div className="dh-peek-muted">No line items</div>}
          {deal.products.map((p, i) => (
            <div key={p.n + i} className="dh-peek-line"><span>{p.n}</span><b className="mono">{money(p.v, true)}</b></div>
          ))}

          <div className="dh-peek-sub" style={{ marginTop: 10 }}><Icon name="users" size={11} /> Contacts <span className="dh-peek-sum">{deal.contacts.length}</span></div>
          {deal.contacts.length === 0 && <div className="dh-peek-muted">No contacts yet</div>}
          {deal.contacts.map((c) => (
            <div key={c.n} className="dh-peek-contact">
              <span className="dh-peek-cav">{initials(c.n)}</span>
              <div className="dh-peek-cmain"><b>{c.n}</b><small>{c.r} · {c.t}</small></div>
            </div>
          ))}

          {((deal.quotes?.length ?? 0) + (deal.invoices?.length ?? 0)) > 0 && (
            <>
              <div className="dh-peek-sub" style={{ marginTop: 10 }}><Icon name="receipt" size={11} /> Documents</div>
              {(deal.quotes ?? []).map((q) => (
                <div key={q.id} className="dh-peek-line"><span>{q.id} · Quote</span><b className="mono">{money(q.total, true)}</b></div>
              ))}
              {(deal.invoices ?? []).map((inv) => (
                <div key={inv.id} className="dh-peek-line"><span>{inv.id} · Invoice</span><b className="mono">{money(inv.total, true)}</b></div>
              ))}
            </>
          )}
        </section>
      </div>

      <div className="dh-peek-foot">
        <button className="dh-btn v-ghost s-sm dh-peek-del" onClick={() => { deleteDeal(deal.id); setPeek(null); }}>
          <Icon name="trash" size={14} /> Delete
        </button>
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={() => { setNav('deals'); openDeal(deal.id); setPeek(null); }}>
          <Icon name="expand" size={15} /> Open full 360°
        </Button>
      </div>
    </Drawer>
  );
}
