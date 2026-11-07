import { useEffect, useRef } from 'react';
import { drawSprite } from './landArt';
import type { CivId } from './landCivs';
export function Sprite({ civ, idx, w, h, portrait = false }: { civ: CivId; idx: number; w: number; h: number; portrait?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const c = ref.current; if (!c) return;
      const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k;
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h);
      if (!drawSprite(ctx, civ, idx, w / 2, portrait ? h * 2.45 : h - 2, portrait ? h * 2.45 : h - 4, false, portrait ? w * 2 : w - 4)) frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [civ, idx, w, h, portrait]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}
