import { useStore } from '@/store/useStore';
import { Icon } from './Icon';
import './toasts.css';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const undo = useStore((s) => s.undo);
  return (
    <div className="dh-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`dh-toast tone-${t.tone ?? 'default'}`}>
          <Icon
            name={t.tone === 'success' ? 'check' : t.tone === 'warn' ? 'alert' : 'zap'}
            size={15}
          />
          <span>{t.text}</span>
          {t.undoable ? (
            <button className="dh-toast-undo" onClick={() => { undo(); dismiss(t.id); }}>
              <Icon name="undo" size={13} /> Undo
            </button>
          ) : (
            <button className="dh-toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss"><Icon name="x" size={13} /></button>
          )}
        </div>
      ))}
    </div>
  );
}
