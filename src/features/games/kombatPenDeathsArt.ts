import { BURN_AT } from './vampyrium';
import { bodyFire } from './vampyriumChars';
import { tinted } from './vampyriumArt';
import { ACID_GREEN_T, DEATH_AT, DEATH_LENGTH, HEAD_GROWTH, acidCollapse, ashFront, freezeProgress, type PenDeath } from './kombatPenalties';

let iceCanvas: HTMLCanvasElement | null = null;
// El material helado conserva exactamente el alfa del luchador, incluidos casco, dedos y alas.
function frozenSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, q: number, body: (c: CanvasRenderingContext2D, headScale?: number, silhouette?: boolean) => void) {
  const tr = ctx.getTransform(), s = Math.max(0.25, Math.min(3, Math.hypot(tr.a, tr.b))), bx = x - h, by = y - h * 1.45, bw = h * 2, bh = h * 1.7, W = Math.ceil(bw * s), H = Math.ceil(bh * s);
  if (W < 1 || H < 1 || W > 4096 || H > 4096) { body(ctx); return; }
  iceCanvas ??= document.createElement('canvas');
  if (iceCanvas.width < W) iceCanvas.width = W; if (iceCanvas.height < H) iceCanvas.height = H;
  const c = iceCanvas.getContext('2d'); if (!c) { body(ctx); return; }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
  c.setTransform(s, 0, 0, s, -bx * s, -by * s); body(c, 1, true);
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(x - h * 0.4, y - h, x + h * 0.4, y); g.addColorStop(0, 'rgba(237,252,255,0.82)'); g.addColorStop(0.4, 'rgba(130,209,244,0.76)'); g.addColorStop(0.7, 'rgba(197,240,255,0.85)'); g.addColorStop(1, 'rgba(46,115,174,0.8)'); c.fillStyle = g; c.fillRect(bx, by, bw, bh);
  for (let i = 0; i < 16; i++) {
    const yy = y - h * (0.04 + i * 0.065), xx = x + Math.sin(i * 5.2) * h * 0.22;
    c.strokeStyle = i % 3 ? 'rgba(247,255,255,0.85)' : 'rgba(41,99,152,0.7)'; c.lineWidth = q > 0.8 ? 2 : 0.8; c.beginPath(); c.moveTo(xx - h * 0.1, yy - h * 0.09); c.lineTo(xx, yy); c.lineTo(xx - h * 0.04, yy + h * 0.06); c.lineTo(xx + h * 0.12, yy + h * 0.13); c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.shadowColor = 'rgba(198,239,255,0.8)'; ctx.shadowBlur = h * 0.015; ctx.drawImage(iceCanvas, 0, 0, W, H, bx, by, bw, bh); ctx.restore();
}

function flameRibbons(ctx: CanvasRenderingContext2D, t: number, intensity: number) {
  ctx.save();
  // Lenguas calientes con bordes rojos, centro amarillo y turbulencia ascendente.
  for (let i = 0; i < 28; i++) {
    const life = (t * (1.05 + i % 4 * 0.13) + i * 0.618) % 1;
    const x = Math.sin(i * 9.2) * 0.46, base = -0.08 - i % 5 * 0.39 - life * 0.4;
    const height = (0.48 + life * 1.2) * intensity;
    const width = (0.065 + i % 3 * 0.025) * (1 - life * 0.55);
    const sway = Math.sin(t * 6.7 + i * 3.7) * 0.1 + Math.sin(t * 11.1 + i) * 0.055;
    const alpha = Math.sin(life * Math.PI) * 0.8;
    const g = ctx.createLinearGradient(x, base, x + sway, base - height);
    g.addColorStop(0, 'rgba(255,250,195,0.92)'); g.addColorStop(0.2, 'rgba(255,207,64,0.9)'); g.addColorStop(0.55, 'rgba(255,111,13,0.78)'); g.addColorStop(0.85, 'rgba(181,35,7,0.4)'); g.addColorStop(1, 'rgba(75,12,5,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - width, base);
    ctx.bezierCurveTo(x - width * 1.6 + sway, base - height * 0.35, x - sway * 0.7, base - height * 0.7, x + sway, base - height);
    ctx.bezierCurveTo(x + sway * 0.25, base - height * 0.62, x + width + sway, base - height * 0.32, x + width, base); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#fff1b5';
    ctx.beginPath(); ctx.ellipse(x, base - height * 0.14, width * 0.42, height * 0.21, sway * 0.15, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// El mismo fuego, esqueleto, teñido y curva de ácido de Vampyrium, sobre el luchador de Penales.
export function drawPenDeath(ctx: CanvasRenderingContext2D, d: PenDeath, x: number, y: number, h: number, body: (c: CanvasRenderingContext2D, headScale?: number, silhouette?: boolean) => void, skeleton?: (c: CanvasRenderingContext2D) => void, bodyRotation = 0) {
  if (d.finished && d.type !== 'acid') return;
  const q = Math.min(1, d.t / DEATH_AT[d.type]), w = h * 1.8;
  const draw = (sy = 1, sx = 1) => (c: CanvasRenderingContext2D) => {
    c.save(); c.translate(x, y); c.scale(sx, sy); c.translate(-x, -y); body(c); c.restore();
  };
  const tint = (color: string, a: number, sy = 1, sx = 1) => tinted(ctx, x - w / 2, y - h * 1.4, w, h * 1.6, color, Math.min(1, a), draw(sy, sx));
  switch (d.type) {
    case 'explosion': return;
    case 'stomp': { const squash = Math.max(0, Math.min(1, (d.t - 2.35) / 0.25)); draw(1 - squash * 0.98, 1 + squash * 0.35)(ctx); break; }
    case 'fire': {
      const f = Math.min(1, d.t / (BURN_AT * 1.8)), burn = Math.max(0, (d.t - BURN_AT) / (DEATH_AT.fire - BURN_AT));
      ctx.save(); ctx.globalAlpha = 1 - f; body(ctx); ctx.restore();
      // Las llamas siguen la vertical de la cancha aunque el arquero quede girado en el aire.
      ctx.save(); ctx.translate(x, y - h * 0.5); ctx.rotate(-bodyRotation); ctx.translate(0, h * 0.5); ctx.scale(h / 2.3, h / 2.3); ctx.globalAlpha = f;
      if (burn > 0) {
        ctx.save(); ctx.globalAlpha = f * 0.12; bodyFire(ctx, 2.9, 1.25, Math.min(1, burn * 1.7), d.clock + d.t, d.side); ctx.restore();
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
      ctx.restore(); break;
    }
    case 'acid': {
      const melt = acidCollapse(d.t), gone = Math.min(1, Math.max(0, (d.t - (DEATH_LENGTH - 0.6)) / 0.6)), green = Math.min(1, d.t / ACID_GREEN_T);
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
      frozenSilhouette(ctx, x, y, h, q, body);
      ctx.restore(); break;
    }
    case 'head': ctx.save(); ctx.translate(Math.sin(d.t * 90) * h * 0.01 * q * q, 0); body(ctx, 1 + (HEAD_GROWTH - 1) * q * q); ctx.restore(); break;
    case 'ash': {
      // Desaparece desde los pies hasta el cráneo; el polvo sigue viajando a la derecha de cámara.
      ctx.save(); ctx.beginPath(); ctx.moveTo(x - w, y - h * 1.4); ctx.lineTo(x + w, y - h * 1.4); for (let i = 35; i >= 0; i--) ctx.lineTo(x - w + i / 35 * w * 2, y - h * 1.18 * ashFront(d.t) + Math.sin(i * 6.7) * h * 0.025); ctx.closePath(); ctx.clip();
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
