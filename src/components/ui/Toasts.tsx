import { useStore } from '@/store/useStore';
import { Icon } from './Icon';
import './toasts.css';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="dh-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`dh-toast tone-${t.tone ?? 'default'}`} onClick={() => dismiss(t.id)}>
          <Icon
            name={t.tone === 'success' ? 'check' : t.tone === 'warn' ? 'alert' : 'zap'}
            size={15}
          />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
