import { BURN_AT } from './vampyrium';
import { bodyFire } from './vampyriumChars';
import { tinted } from './vampyriumArt';
import { ACID_GREEN_T, DEATH_AT, HEAD_GROWTH, acidCollapse, freezeProgress, type PenDeath } from './kombatPenalties';

function flameRibbons(ctx: CanvasRenderingContext2D, t: number, intensity: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 17; i++) {
    const phase = (t * 1.7 + i * 0.618) % 1, x = Math.sin(i * 9.2) * 0.48, base = -0.1 - (i % 4) * 0.35, height = (0.65 + phase * 1.7) * intensity, width = (0.045 + (i % 3) * 0.028) * (1 - phase * 0.45), sway = Math.sin(t * 9 + i * 3.7) * 0.25;
    const g = ctx.createLinearGradient(x, base, x + sway, base - height); g.addColorStop(0, 'rgba(255,225,148,0.65)'); g.addColorStop(0.35, 'rgba(255,137,36,0.52)'); g.addColorStop(0.75, 'rgba(215,49,12,0.3)'); g.addColorStop(1, 'rgba(100,15,5,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - width, base); ctx.bezierCurveTo(x + sway - width * 2, base - height * 0.4, x - sway, base - height * 0.65, x + sway, base - height); ctx.bezierCurveTo(x + sway * 0.5, base - height * 0.55, x + width + sway, base - height * 0.35, x + width, base); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// El mismo fuego, esqueleto, teñido y curva de ácido de Vampyrium, sobre el luchador de Penales.
export function drawPenDeath(ctx: CanvasRenderingContext2D, d: PenDeath, x: number, y: number, h: number, body: (c: CanvasRenderingContext2D, headScale?: number) => void, skeleton?: (c: CanvasRenderingContext2D) => void) {
  if (d.finished && d.type !== 'acid') return;
  const q = Math.min(1, d.t / DEATH_AT[d.type]), w = h * 1.8;
  const draw = (sy = 1, sx = 1) => (c: CanvasRenderingContext2D) => {
    c.save(); c.translate(x, y); c.scale(sx, sy); c.translate(-x, -y); body(c); c.restore();
  };
  const tint = (color: string, a: number, sy = 1, sx = 1) => tinted(ctx, x - w / 2, y - h * 1.4, w, h * 1.6, color, Math.min(1, a), draw(sy, sx));
  switch (d.type) {
    case 'explosion': return;
    case 'fire': {
      const f = Math.min(1, d.t / (BURN_AT * 1.8)), burn = Math.max(0, (d.t - BURN_AT) / (DEATH_AT.fire - BURN_AT));
      ctx.save(); ctx.globalAlpha = 1 - f; body(ctx); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.scale(h / 2.3, h / 2.3); ctx.globalAlpha = f;
      if (burn > 0) {
        ctx.save(); ctx.globalAlpha = f * 0.2; bodyFire(ctx, 2.9, 1.25, Math.min(1, burn * 1.7), d.clock + d.t, d.side); ctx.restore();
        flameRibbons(ctx, d.clock + d.t, Math.min(1.4, burn * 2.2));
      }
      // Brasas finas que recorren el cuerpo y ascienden: el esqueleto permanece legible entre las llamas.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 24; i++) { const p = (d.t * 1.4 + i * 0.618) % 1; ctx.fillStyle = `rgba(255,${120 + i % 4 * 30},40,${(1 - p) * burn})`; ctx.beginPath(); ctx.ellipse(Math.sin(i * 13 + d.t * 4) * (0.25 + p * 0.5), -p * 3.5, 0.012 + (i % 3) * 0.009, 0.045, 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (skeleton) { ctx.save(); ctx.globalAlpha = f; skeleton(ctx); ctx.restore(); }
      break;
    }
    case 'violet': {
      const s = 1 - q * 0.88;
      tint('rgb(200,110,255)', 0.4 + q * 0.6, s, s);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y - h * 0.5 * s, 0, x, y - h * 0.5 * s, h * (0.2 + s * 0.5)); glow.addColorStop(0, `rgba(206,132,255,${0.2 + q * 0.5})`); glow.addColorStop(1, 'rgba(120,40,220,0)'); ctx.fillStyle = glow; ctx.fillRect(x - h, y - h * 1.4, h * 2, h * 1.8);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + d.t * 2, r = h * (0.18 + s * 0.6); ctx.strokeStyle = `rgba(219,177,255,${0.3 + q * 0.5})`; ctx.lineWidth = 1 + q * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y - h * 0.5 * s + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a + 0.17) * r * 0.5, y - h * 0.5 * s + Math.sin(a + 0.17) * r * 0.5); ctx.lineTo(x, y - h * 0.5 * s); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'acid': {
      const melt = acidCollapse(d.t), gone = Math.min(1, Math.max(0, (d.t - (DEATH_AT.acid + 1.1)) / 0.7)), green = Math.min(1, d.t / ACID_GREEN_T);
      if (melt.q < 1) tint('rgb(109,225,28)', green * 0.93, melt.height, melt.width);
      const pw = h * (0.06 + 1.03 * melt.q), ph = h * (0.015 + 0.13 * melt.q);
      ctx.save(); ctx.globalAlpha = 1 - gone;
      const g = ctx.createRadialGradient(x - pw * 0.2, y - ph * 0.4, 0, x, y, pw); g.addColorStop(0, '#d0ff57'); g.addColorStop(0.35, '#83db18'); g.addColorStop(0.72, '#41930d'); g.addColorStop(1, '#1c5306'); ctx.fillStyle = g;
      ctx.beginPath(); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = 1 + Math.sin(i * 2.3) * 0.08; ctx.lineTo(x + Math.cos(a) * pw * r, y + Math.sin(a) * (ph + 1) * r); } ctx.closePath(); ctx.fill();
      // Chorros sujetos a la gravedad: caen desde el cuerpo hacia el charco, sin estirarse a los lados.
      if (melt.q < 1) for (let i = 0; i < 18; i++) {
        const p = (d.t * (0.8 + i % 3 * 0.1) + i * 0.618) % 1, xx = x + Math.sin(i * 8.7) * h * 0.2 * melt.width, top = y - h * melt.height * (0.25 + (i % 5) * 0.13), yy = top + (y - top) * p * p;
        ctx.strokeStyle = i % 3 ? 'rgba(99,143,31,0.8)' : 'rgba(196,206,103,0.65)'; ctx.lineWidth = h * (0.004 + i % 3 * 0.002); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(xx, Math.max(top, yy - h * 0.12 * p)); ctx.lineTo(xx, yy); ctx.stroke();
      }
      for (let i = 0; i < 32; i++) {
        const bt = (d.t * (0.65 + i % 4 * 0.09) + i * 0.618) % 1, bx = x + Math.sin(i * 7) * pw * 0.86, by = y + Math.cos(i * 9.2) * ph * 0.65, radius = h * (0.015 + i % 5 * 0.014) * Math.sin(bt * Math.PI);
        const bubble = ctx.createRadialGradient(bx - radius * 0.3, by - radius * 0.5, 0, bx, by, Math.max(0.1, radius)); bubble.addColorStop(0, 'rgba(232,255,162,0.9)'); bubble.addColorStop(0.4, 'rgba(137,213,46,0.35)'); bubble.addColorStop(1, 'rgba(27,81,5,0.7)'); ctx.fillStyle = bubble;
        ctx.beginPath(); ctx.ellipse(bx, by - radius * 0.3, Math.max(0.1, radius), Math.max(0.1, radius * 0.65), 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(219,255,139,${(1 - bt) * 0.7})`; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(bx, by, h * 0.055 * bt, h * 0.018 * bt, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore(); break;
    }
    case 'ice': {
      body(ctx);
      const frozen = freezeProgress(d.t);
      ctx.save(); ctx.beginPath(); ctx.rect(x - w, y - h * 1.18 * frozen, w * 2, h * 1.18 * frozen + h * 0.2); ctx.clip();
      tint('rgb(150,215,255)', 0.7);
      ctx.fillStyle = 'rgba(170,225,255,0.28)'; ctx.strokeStyle = 'rgba(230,248,255,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - h * 0.3, y); ctx.lineTo(x - h * 0.35, y - h * 0.6); ctx.lineTo(x - h * 0.2, y - h); ctx.lineTo(x + h * 0.2, y - h * 1.05); ctx.lineTo(x + h * 0.35, y - h * 0.55); ctx.lineTo(x + h * 0.3, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (q > 0.3) for (let i = 0; i < 7; i++) { const yy = y - h * (0.1 + i * 0.13), xx = x + Math.sin(i * 5.2) * h * 0.19; ctx.lineWidth = q > 0.75 ? 2.7 : 1.2; ctx.beginPath(); ctx.moveTo(xx - h * 0.1, yy - h * 0.1); ctx.lineTo(xx, yy); ctx.lineTo(xx - h * 0.04, yy + h * 0.06); ctx.lineTo(xx + h * 0.12, yy + h * 0.14); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'head': ctx.save(); ctx.translate(Math.sin(d.t * 90) * h * 0.01 * q * q, 0); body(ctx, 1 + (HEAD_GROWTH - 1) * q * q); ctx.restore(); break;
    case 'ash': {
      // La silueta desaparece de arriba hacia abajo; las cenizas se dibujan en coordenadas de cámara.
      ctx.save(); ctx.beginPath(); ctx.moveTo(x - w, y + h * 0.2); for (let i = 0; i <= 35; i++) ctx.lineTo(x - w + i / 35 * w * 2, y - h * (1 - q) + Math.sin(i * 6.7) * h * 0.03); ctx.lineTo(x + w, y + h * 0.2); ctx.closePath(); ctx.clip();
      tint('rgb(100,96,90)', 0.9); ctx.restore(); break;
    }
  }
}

// Humo volumétrico y ondas que siguen visibles después del estallido. Se dibujan en coordenadas de cámara.
export function drawPenDeathAtmosphere(ctx: CanvasRenderingContext2D, d: PenDeath) {
  const after = d.t - DEATH_AT[d.type], h = d.h, t = d.t;
  const smoke = d.type === 'fire' || d.type === 'ash' || d.type === 'acid' || (d.finished && d.type !== 'head');
  if (smoke) {
    const fade = d.finished ? Math.max(0, 1 - after / 1.65) : Math.min(1, t * 2);
    for (let i = 0; i < 12; i++) {
      const p = (t * 0.55 + i * 0.618) % 1, acid = d.type === 'acid', ice = d.type === 'ice';
      const x = d.x + (d.type === 'ash' ? p * h * 1.7 : Math.sin(i * 4.7 + p * 2) * h * 0.25), y = d.y - (acid ? 0.05 : 0.45) * h - p * h * (acid ? 0.8 : 1.7), r = h * (0.07 + p * (acid ? 0.17 : 0.38));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, acid ? 'rgba(140,170,75,0.16)' : ice ? 'rgba(210,235,250,0.25)' : 'rgba(63,57,54,0.23)'); g.addColorStop(1, 'rgba(50,45,40,0)');
      ctx.save(); ctx.globalAlpha = fade * (1 - p); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
  }
  if (d.finished && after < 0.75 && d.type !== 'acid' && d.type !== 'ash') {
    const q = Math.max(0, after / 0.75), color = d.type === 'violet' ? '189,103,255' : d.type === 'ice' ? '177,227,255' : '245,182,118';
    ctx.save(); ctx.globalAlpha = (1 - q) * 0.65; ctx.strokeStyle = `rgb(${color})`; ctx.lineWidth = (1 - q) * 9 + 1;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, h * (0.2 + q * 2.6), h * (0.07 + q * 0.65), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
