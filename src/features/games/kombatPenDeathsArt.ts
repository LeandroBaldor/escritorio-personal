import { BLOW_AT, BURN_AT, MELT_T, PUDDLE_T } from './vampyrium';
import { bodyFire, drawSkeletonK } from './vampyriumChars';
import { tinted } from './vampyriumArt';
import { DEATH_AT, HEAD_GROWTH, type PenDeath } from './kombatPenalties';

// El mismo fuego, esqueleto, teñido y curva de ácido de Vampyrium, sobre el luchador de Penales.
export function drawPenDeath(ctx: CanvasRenderingContext2D, d: PenDeath, x: number, y: number, h: number, body: (c: CanvasRenderingContext2D, headScale?: number) => void) {
  if (d.finished) return;
  const q = Math.min(1, d.t / DEATH_AT[d.type]), w = h * 1.8;
  const draw = (sy = 1, sx = 1) => (c: CanvasRenderingContext2D) => {
    c.save(); c.translate(x, y); c.scale(sx, sy); c.translate(-x, -y); body(c); c.restore();
  };
  const tint = (color: string, a: number, sy = 1, sx = 1) => tinted(ctx, x - w / 2, y - h * 1.4, w, h * 1.6, color, Math.min(1, a), draw(sy, sx));
  switch (d.type) {
    case 'explosion': return;
    case 'fire': {
      const f = Math.min(1, d.t / BURN_AT), burn = Math.max(0, (d.t - BURN_AT) / (BLOW_AT - BURN_AT));
      ctx.save(); ctx.globalAlpha = 1 - f; body(ctx); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.scale(h / 2.3, h / 2.3); ctx.globalAlpha = f;
      drawSkeletonK(ctx, false, d.t, 1);
      if (burn > 0) bodyFire(ctx, 2, 0.9, burn, d.clock + d.t, d.side);
      ctx.restore(); break;
    }
    case 'violet': {
      const s = 1 - q * 0.88;
      tint('rgb(200,110,255)', 0.4 + q * 0.6, s, s);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,100,255,${0.3 + q * 0.7})`; ctx.lineWidth = 5 + q * 10;
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.5 * s, h * 0.4 * s, h * 0.65 * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); break;
    }
    case 'acid': {
      const melt = Math.min(1, d.t / MELT_T), e = melt * melt, gone = Math.max(0, (d.t - MELT_T) / (PUDDLE_T - MELT_T));
      if (melt < 1) tint('rgb(120,240,60)', Math.min(0.85, 0.3 + d.t * 2), 1 - e * 0.92, 1 + e * 0.9);
      const pw = h * (0.15 + 0.5 * melt), ph = h * 0.06 * melt;
      ctx.save(); ctx.globalAlpha = 1 - gone;
      const g = ctx.createLinearGradient(x, y - ph, x, y + ph + 1); g.addColorStop(0, '#c8ff70'); g.addColorStop(0.5, '#5ad21e'); g.addColorStop(1, '#1f6a0a'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, pw, ph + 1, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) { const bt = ((d.clock + d.t) * 1.3 + i * 0.27) % 1; ctx.fillStyle = `rgba(220,255,160,${(1 - bt) * 0.9})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 7) * pw * 0.7, y - bt * h * 0.14, h * 0.02 * (0.5 + bt), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'ice': {
      tint('rgb(150,215,255)', 0.7);
      ctx.fillStyle = 'rgba(170,225,255,0.28)'; ctx.strokeStyle = 'rgba(230,248,255,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - h * 0.3, y); ctx.lineTo(x - h * 0.35, y - h * 0.6); ctx.lineTo(x - h * 0.2, y - h); ctx.lineTo(x + h * 0.2, y - h * 1.05); ctx.lineTo(x + h * 0.35, y - h * 0.55); ctx.lineTo(x + h * 0.3, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (q > 0.5) { ctx.beginPath(); ctx.moveTo(x - h * 0.1, y - h); ctx.lineTo(x, y - h * 0.6); ctx.lineTo(x - h * 0.15, y - h * 0.35); ctx.lineTo(x + h * 0.05, y); ctx.stroke(); } break;
    }
    case 'head': body(ctx, 1 + (HEAD_GROWTH - 1) * q * q); break;
    case 'ash': {
      // La silueta desaparece de arriba hacia abajo; las cenizas se dibujan en coordenadas de cámara.
      ctx.save(); ctx.beginPath(); ctx.rect(x - w, y - h * (1 - q), w * 2, h * (1 - q) + h * 0.2); ctx.clip();
      tint('rgb(100,96,90)', 0.9); ctx.restore(); break;
    }
  }
}
