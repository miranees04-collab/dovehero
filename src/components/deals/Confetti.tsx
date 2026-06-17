import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import './confetti.css';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

export function Confetti() {
  const at = useStore((s) => s.confettiAt);
  const [pieces, setPieces] = useState<number[]>([]);

  useEffect(() => {
    if (!at) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setPieces(Array.from({ length: 70 }, (_, i) => i));
    const t = window.setTimeout(() => setPieces([]), 2600);
    return () => window.clearTimeout(t);
  }, [at]);

  if (!pieces.length) return null;
  return (
    <div className="dh-confetti" aria-hidden>
      {pieces.map((i) => (
        <i
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(Math.random() * 0.35).toFixed(2)}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
