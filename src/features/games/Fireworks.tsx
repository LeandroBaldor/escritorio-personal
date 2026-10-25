import { useEffect, useRef } from 'react';

// Fuegos artificiales para el cartel de "GANASTE!!!": cohetes que suben con su estela de chispas y revientan
// en flores de colores (círculos, anillos y palmeras doradas) que caen y se apagan titilando. Es un canvas que
// cubre el cartel por detrás del texto y no se puede tocar.
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; size: number; glitter: boolean; px: number; py: number }
interface Rocket { x: number; y: number; vx: number; vy: number; top: number; hue: number; kind: number }

export function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0, last = performance.now(), next = 0, opening = 3; // arranca con tres cohetes seguidos
    const rockets: Rocket[] = [], sparks: Spark[] = [];
    const resize = () => {
      const k = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * k); canvas.height = Math.round(h * k); ctx.setTransform(k, 0, 0, k, 0, 0);
    };
    resize();
    const burst = (r: Rocket) => {
      const n = 90 + Math.floor(Math.random() * 60), power = 170 + Math.random() * 150;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
        const sp = r.kind === 1 ? power : power * (0.25 + Math.random() * 0.75); // 1: anillo parejo
        const hue = r.kind === 2 ? 42 : (r.hue + (i % 3 === 0 ? 40 : 0)) % 360; // 2: palmera dorada
        sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.3 + Math.random() * 0.9, hue, size: 2 + Math.random() * 1.8, glitter: r.kind === 2 || Math.random() < 0.25 });
      }
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * (window.devicePixelRatio || 1))) resize();
      if ((next -= dt) <= 0) {
        next = opening-- > 0 ? 0.08 : 0.22 + Math.random() * 0.4;
        const x = w * (0.12 + Math.random() * 0.76), top = h * (0.12 + Math.random() * 0.35);
        rockets.push({ x, y: h + 10, vx: (Math.random() - 0.5) * 40, vy: -Math.sqrt(2 * 260 * (h + 10 - top)), top, hue: Math.floor(Math.random() * 360), kind: Math.floor(Math.random() * 3) });
      }
      // Se borra dejando un rastro (las chispas dejan cola).
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.vy += 260 * dt; r.x += r.vx * dt; r.y += r.vy * dt;
        ctx.fillStyle = `hsla(${r.hue},100%,80%,0.9)`; ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, Math.PI * 2); ctx.fill();
        sparks.push({ x: r.x, y: r.y + 4, px: r.x, py: r.y, vx: (Math.random() - 0.5) * 20, vy: 30 + Math.random() * 30, life: 0, max: 0.4, hue: 40, size: 1.1, glitter: false });
        if (r.vy >= 0 || r.y <= r.top) { burst(r); rockets.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life += dt; p.px = p.x; p.py = p.y;
        p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const k = p.life / p.max;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        const a = (1 - k) * (p.glitter && Math.random() < 0.35 ? 0.2 : 1);
        ctx.strokeStyle = `hsla(${p.hue},100%,${52 + (1 - k) * 16}%,${a})`; ctx.lineWidth = p.size * (1 - k * 0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
