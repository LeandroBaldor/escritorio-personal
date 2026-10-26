// Cómo se ven las trampas de Gravity Swap, en versión realista: metal con volumen, reflejos, desgaste y
// tornillos; vidrio, hielo y roca con textura; fuego, lava y láseres que emiten luz de verdad (se suman a lo
// que hay atrás) con chispas y humo. Acá solo está el dibujo: dónde está cada cosa lo calcula gravityArt.
import { P, alpha, bloom, darken, grain, hash, lighten, lin, segment, shade, spec } from './gravityMonsters';

const TAU = Math.PI * 2;

// Tornillo de cabeza redonda (o hexagonal) con su brillo.
export function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r = 1.6 * P) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, '#f1f5f9'); g.addColorStop(0.5, '#8b95a5'); g.addColorStop(1, '#2a303a');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,30,0.7)'; ctx.lineWidth = 0.5 * P; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x + r * 0.6, y); ctx.stroke();
}
// Una chapa de metal con bisel (borde iluminado arriba a la izquierda, sombra abajo a la derecha), textura de
// metal cepillado, manchas de óxido y tornillos en las esquinas.
export function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, o: { rust?: number; bolts?: boolean; r?: number } = {}) {
  const path = () => ctx.roundRect(x, y, w, h, o.r ?? 0.03);
  ctx.beginPath(); path(); ctx.fillStyle = lin(ctx, x, y, x + w * 0.3, y + h, [[0, lighten(base, 0.25)], [0.5, base], [1, darken(base, 0.45)]]); ctx.fill();
  grain(ctx, path, 0.45);
  if (o.rust) { ctx.save(); ctx.beginPath(); path(); ctx.clip(); for (let k = 0; k < 4; k++) { const rx = x + hash(x * 7 + k) * w, ry = y + hash(y * 5 + k) * h, rr = Math.min(w, h) * (0.15 + hash(k + x) * 0.25); const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr); g.addColorStop(0, `rgba(120,55,20,${0.45 * o.rust})`); g.addColorStop(1, 'rgba(120,55,20,0)'); ctx.fillStyle = g; ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2); } ctx.restore(); }
  const e = Math.max(P, Math.min(w, h) * 0.06);
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, w, e); ctx.fillRect(x, y, e, h);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(x, y + h - e, w, e); ctx.fillRect(x + w - e, y, e, h);
  ctx.restore();
  ctx.beginPath(); path(); ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.lineWidth = 0.8 * P; ctx.stroke();
  if (o.bolts !== false && w > 0.25 && h > 0.2) { const m = Math.min(0.08, Math.min(w, h) * 0.22); for (const [bx, by] of [[x + m, y + m], [x + w - m, y + m], [x + m, y + h - m], [x + w - m, y + h - m]]) bolt(ctx, bx, by, Math.min(1.6 * P, m * 0.5)); }
}
// Franjas de peligro amarillas y negras, gastadas (con rayones y suciedad).
export function hazardStripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 0.32) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, '#fde047'], [1, '#ca8a04']]); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#16130c';
  for (let k = -h - step; k < w + step; k += step) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + step / 2, y + h); ctx.lineTo(x + k + step / 2 + h, y); ctx.lineTo(x + k + h, y); ctx.fill(); }
  grain(ctx, () => ctx.rect(x, y, w, h), 0.6, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, w, Math.max(P * 0.8, h * 0.12));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - Math.max(P * 0.8, h * 0.12), w, Math.max(P * 0.8, h * 0.12));
  ctx.restore();
}

// ---------------------------------------------------------------- Púas
// Púas de acero forjado: cónicas, con la cara de la luz brillante y la otra en sombra, el filo que brilla y
// las puntas manchadas; atornilladas a una base de metal con bisel.
export function steelSpikes(ctx: CanvasRenderingContext2D, x0: number, w: number, base: number, tip: number, up: boolean, tint: string) {
  const n = Math.max(1, Math.round(w * 2.4)), sw = w / n, dir = up ? -1 : 1;
  const plateY = up ? base - 0.12 : base;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * sw, cx = x + sw / 2, len = Math.abs(tip - base) * (0.86 + hash(i * 3.7 + x0) * 0.14), ty = base + dir * len;
    ctx.beginPath(); ctx.moveTo(x + 0.01, base); ctx.lineTo(cx, ty); ctx.lineTo(x + sw - 0.01, base); ctx.closePath();
    ctx.fillStyle = lin(ctx, x, 0, x + sw, 0, [[0, lighten(tint, 0.35)], [0.42, lighten(tint, 0.1)], [0.5, tint], [0.55, darken(tint, 0.45)], [1, darken(tint, 0.75)]]); ctx.fill();
    ctx.fillStyle = lin(ctx, 0, base, 0, ty, [[0, 'rgba(0,0,0,0.35)'], [0.35, 'rgba(0,0,0,0)'], [0.85, 'rgba(0,0,0,0)'], [1, 'rgba(90,10,10,0.55)']]); ctx.fill(); // sombra en la base y punta sucia
    ctx.strokeStyle = 'rgba(10,12,16,0.85)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.moveTo(cx - sw * 0.06, base + dir * len * 0.15); ctx.lineTo(cx - P * 0.2, ty - dir * len * 0.08); ctx.stroke(); // filo
  }
  plate(ctx, x0 - 0.03, plateY, w + 0.06, 0.12, '#4b5563', { bolts: false });
  for (let bx = x0 + 0.15; bx < x0 + w; bx += 0.55) bolt(ctx, bx, plateY + 0.06, 1.3 * P);
}

// ---------------------------------------------------------------- Láser
// Emisor: carcasa blindada con aletas de refrigeración, una lente con anillos que se pone al rojo cuando dispara
// y luces de estado.
export function laserEmitter(ctx: CanvasRenderingContext2D, x: number, y: number, floorEnd: boolean, on: boolean, warn: boolean, color: string, time: number) {
  plate(ctx, x - 0.32, y, 0.64, 0.36, '#3b4452', { rust: 0.3 });
  ctx.fillStyle = '#0b0f17'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.25 + k * 0.13, floorEnd ? y + 0.2 : y + 0.06, 0.07, 0.1); // aletas
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.25 + k * 0.13, floorEnd ? y + 0.2 : y + 0.06, 0.07, P * 0.6);
  const ly = floorEnd ? y : y + 0.36;
  ctx.beginPath(); ctx.ellipse(x, ly, 0.17, 0.075, 0, 0, TAU); ctx.fillStyle = '#11151c'; ctx.fill(); ctx.strokeStyle = '#8b95a5'; ctx.lineWidth = P; ctx.stroke();
  const g = ctx.createRadialGradient(x, ly, 0, x, ly, 0.12);
  g.addColorStop(0, on ? '#ffffff' : warn ? lighten(color, 0.4) : '#2a3442'); g.addColorStop(0.5, on || warn ? color : '#1a2230'); g.addColorStop(1, '#05070a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, ly, 0.12, 0.05, 0, 0, TAU); ctx.fill();
  spec(ctx, x - 0.04, ly - 0.015, 0.04, 0.012, 0, 0.7);
  if (on) bloom(ctx, x, ly, 0.45, color, 0.8); else if (warn) bloom(ctx, x, ly, 0.3, color, 0.4 + 0.3 * Math.sin(time * 40));
  ctx.fillStyle = on ? '#ef4444' : warn ? (Math.sin(time * 30) > 0 ? '#fbbf24' : '#78350f') : '#22c55e';
  ctx.beginPath(); ctx.arc(x + 0.22, floorEnd ? y + 0.1 : y + 0.26, 1.3 * P, 0, TAU); ctx.fill();
}
// El rayo: resplandor ancho, rayo de color, núcleo blanco que vibra, partículas que suben por el rayo y
// chispas donde pega.
export function laserBeam(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string, time: number, ends: number[]) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 70), h = y1 - y0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, x - 0.55, 0, x + 0.55, 0, [[0, 'rgba(0,0,0,0)'], [0.5, alpha(color, 0.55 * flicker)], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x - 0.55, y0, 1.1, h);
  ctx.fillStyle = lin(ctx, x - 0.12, 0, x + 0.12, 0, [[0, 'rgba(0,0,0,0)'], [0.5, alpha(color, 0.9)], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x - 0.12, y0, 0.24, h);
  ctx.fillStyle = `rgba(255,255,255,${0.85 * flicker})`; ctx.fillRect(x - 0.9 * P + Math.sin(time * 90) * 0.3 * P, y0, 1.8 * P, h);
  for (let k = 0; k < 10; k++) { const py = y0 + ((time * 3 + hash(k)) % 1) * h; ctx.fillStyle = alpha(lighten(color, 0.5), 0.8); ctx.fillRect(x + (hash(k + 7) - 0.5) * 0.14, py, 1.2 * P, 1.2 * P); }
  for (const ey of ends) {
    bloom(ctx, x, ey, 0.5, '#ffffff', 0.5);
    for (let k = 0; k < 6; k++) { const a = hash(k + Math.floor(time * 20)) * TAU, r = 0.1 + hash(k * 3 + Math.floor(time * 20)) * 0.25; ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(x, ey); ctx.lineTo(x + Math.cos(a) * r, ey + Math.sin(a) * r * 0.5); ctx.stroke(); }
  }
  ctx.restore();
}
export function laserWarnLine(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string, time: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(color, 0.25 + 0.25 * Math.max(0, Math.sin(time * 50))); ctx.fillRect(x - 0.06, y0, 0.12, y1 - y0);
  ctx.fillStyle = alpha(color, 0.7); ctx.fillRect(x - P * 0.4, y0, P * 0.8, y1 - y0);
  ctx.restore();
}

// ---------------------------------------------------------------- Minas y bolas con pinchos
// Mina naval: esfera de acero oscuro con la costura soldada, remaches, cuernos detonadores con punta cromada y
// una luz que titila (o, sin luz, la bola de pinchos del péndulo). "stripes": franjas de peligro (mina de
// proximidad).
export function seaMine(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, body: string, light: string | null, time: number, stripes = false) {
  for (let k = 0; k < 8; k++) { // cuernos
    const a = spin + k * TAU / 8 + (k % 2) * 0.1, ca = Math.cos(a), sa = Math.sin(a);
    const b0x = x + ca * r * 0.85, b0y = y + sa * r * 0.85, b1x = x + ca * r * 1.38, b1y = y + sa * r * 1.38, w = r * 0.15;
    ctx.beginPath(); ctx.moveTo(b0x - sa * w, b0y + ca * w); ctx.lineTo(b1x - sa * w * 0.7, b1y + ca * w * 0.7); ctx.lineTo(b1x + sa * w * 0.7, b1y - ca * w * 0.7); ctx.lineTo(b0x + sa * w, b0y - ca * w); ctx.closePath();
    ctx.fillStyle = lin(ctx, b0x - sa * w, b0y + ca * w, b0x + sa * w, b0y - ca * w, [[0, '#6b7280'], [0.4, '#d1d5db'], [1, '#1f2937']]); ctx.fill();
    ctx.strokeStyle = 'rgba(5,6,8,0.8)'; ctx.lineWidth = 0.6 * P; ctx.stroke();
    const tg = ctx.createRadialGradient(b1x - r * 0.04, b1y - r * 0.04, 0, b1x, b1y, w * 1.3); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#9ca3af'); tg.addColorStop(1, '#374151');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(b1x, b1y, w * 1.25, 0, TAU); ctx.fill();
  }
  const sphere = () => ctx.arc(x, y, r, 0, TAU);
  shade(ctx, sphere, body, { x: x - r * 0.4, y: y - r * 0.45, r: r * 1.5, hi: 0.45, lo: 0.8, tex: 0.55 });
  ctx.save(); ctx.beginPath(); sphere(); ctx.clip();
  if (stripes) { ctx.globalAlpha = 0.85; ctx.fillStyle = '#facc15'; for (let k = -3; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.5, y + r); ctx.lineTo(x + k * r * 0.5 + r * 0.22, y + r); ctx.lineTo(x + k * r * 0.5 + r * 0.22 + r * 2, y - r); ctx.lineTo(x + k * r * 0.5 + r * 2, y - r); ctx.fill(); } ctx.globalAlpha = 1; }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.1 * P; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.28, spin * 0.2, 0, TAU); ctx.stroke(); // costura
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.ellipse(x, y - P, r, r * 0.28, spin * 0.2, Math.PI, TAU); ctx.stroke();
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + spin; ctx.fillStyle = 'rgba(200,205,215,0.55)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.27, 0.6 * P, 0, TAU); ctx.fill(); }
  ctx.restore();
  spec(ctx, x - r * 0.35, y - r * 0.42, r * 0.32, r * 0.16, -0.6, 0.65);
  if (light) {
    const on = 0.5 + 0.5 * Math.sin(time * 6);
    bloom(ctx, x, y + r * 0.15, r * 1.6, light, 0.35 * on + 0.1);
    const g = ctx.createRadialGradient(x, y + r * 0.15, 0, x, y + r * 0.15, r * 0.22); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, light); g.addColorStop(1, darken(light, 0.6));
    ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.27, 0, TAU); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.2, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- Sierra
// Disco de acero cepillado con dientes ganchudos, estela de velocidad, agujeros de refrigeración, el centro con
// tuercas y chispas que saltan.
export function sawBlade(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, ice: boolean, time: number) {
  const steel = ice ? '#c7dcf2' : '#c3cad4';
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = steel; ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, TAU); ctx.fill(); ctx.restore(); // borroso
  const disc = () => { for (let k = 0; k < 24; k++) { const a = spin + k * TAU / 24; ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); ctx.lineTo(x + Math.cos(a + 0.1) * r, y + Math.sin(a + 0.1) * r); ctx.lineTo(x + Math.cos(a + 0.2) * r * 0.9, y + Math.sin(a + 0.2) * r * 0.9); } ctx.closePath(); };
  ctx.beginPath(); disc();
  const cg = (ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient;
  if (cg) { const g = cg.call(ctx, spin * 0.15, x, y); for (const [at, c] of [[0, '#f8fafc'], [0.12, '#7c8796'], [0.3, '#e2e8f0'], [0.5, '#6b7685'], [0.65, '#f1f5f9'], [0.85, '#8a95a4'], [1, '#f8fafc']] as const) g.addColorStop(at, c); ctx.fillStyle = g; }
  else ctx.fillStyle = steel;
  ctx.fill(); ctx.strokeStyle = 'rgba(15,18,24,0.85)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
  ctx.save(); ctx.beginPath(); disc(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5 * P; for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.arc(x, y, r * k / 8.5, 0, TAU); ctx.stroke(); } // cepillado
  ctx.restore();
  ctx.fillStyle = '#0d1016'; for (let k = 0; k < 6; k++) { const a = spin + k * TAU / 6; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.12, r * 0.05, a + 1.2, 0, TAU); ctx.fill(); }
  const hub = () => ctx.arc(x, y, r * 0.28, 0, TAU);
  shade(ctx, hub, ice ? '#3b82f6' : '#4b5563', { x: x - r * 0.1, y: y - r * 0.1, r: r * 0.35, tex: 0.3 });
  for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5; bolt(ctx, x + Math.cos(a) * r * 0.18, y + Math.sin(a) * r * 0.18, r * 0.045); }
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, r * 0.07, 0, TAU); ctx.fill();
  spec(ctx, x - r * 0.4, y - r * 0.4, r * 0.35, r * 0.08, -0.8, 0.5);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; // chispas
  for (let k = 0; k < 5; k++) { const life = (time * 4 + hash(k)) % 1, a = -Math.PI / 2 - 0.6 + hash(k + 3) * 1.2; ctx.strokeStyle = `rgba(255,${200 - life * 120},80,${1 - life})`; ctx.lineWidth = 0.7 * P; ctx.beginPath(); const sx = x + Math.cos(a) * (r + life * 0.6), sy = y + Math.sin(a) * (r + life * 0.6) + life * life * 0.4; ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * 0.08, sy - Math.sin(a) * 0.08); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Rocas (asteroides y meteoritos)
// Roca irregular con relieve (luz de un lado), cráteres con borde iluminado, textura y, si viene ardiendo
// ("hot" 0..1), grietas al rojo.
export function rock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, seed: number, base: string, hot = 0) {
  const path = () => { for (let k = 0; k < 14; k++) { const a = spin + k * TAU / 14, rr = r * (0.78 + hash(seed * 13 + k) * 0.3); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); };
  shade(ctx, path, base, { x: x - r * 0.45, y: y - r * 0.5, r: r * 1.7, hi: 0.4, lo: 0.85, tex: 0.8, texSize: 1.3 });
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  for (let k = 0; k < 5; k++) {
    const a = spin + k * 1.37 + seed, d = r * (0.2 + hash(k + seed) * 0.5), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, cr = r * (0.1 + hash(k * 3 + seed) * 0.13);
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,220,0.35)'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.arc(cx, cy, cr, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  }
  if (hot > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,140,40,${0.8 * hot})`; ctx.lineWidth = 0.9 * P;
    for (let k = 0; k < 5; k++) { let a = hash(seed + k) * TAU, px = x + Math.cos(a) * r * 0.1, py = y + Math.sin(a) * r * 0.1; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { a += (hash(k * 5 + j + seed) - 0.5) * 1.2; px += Math.cos(a) * r * 0.25; py += Math.sin(a) * r * 0.25; ctx.lineTo(px, py); } ctx.stroke(); }
    ctx.fillStyle = lin(ctx, x - r, y - r, x + r, y + r, [[0, 'rgba(255,120,30,0)'], [1, `rgba(255,120,30,${0.45 * hot})`]]); ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}
// Estela de fuego y humo detrás de algo que cae o vuela ("dx, dy": hacia dónde queda la estela).
export function fireTrail(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dx: number, dy: number, time: number, len = 2.2) {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  for (let k = 0; k < 6; k++) { const d = ((time * 1.5 + k / 6) % 1); ctx.fillStyle = `rgba(80,70,65,${0.35 * (1 - d)})`; ctx.beginPath(); ctx.arc(x + ux * (0.5 + d * len) + Math.sin(k * 3 + time) * 0.1, y + uy * (0.5 + d * len), r * (0.4 + d * 0.9), 0, TAU); ctx.fill(); } // humo
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x + ux * len, y + uy * len); g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.2, 'rgba(255,170,60,0.75)'); g.addColorStop(0.6, 'rgba(230,70,20,0.35)'); g.addColorStop(1, 'rgba(120,20,10,0)');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(x - uy * r, y + ux * r);
  for (let i = 1; i <= 8; i++) { const q = i / 8, w = r * (1 - q) * (1 + Math.sin(time * 30 + i) * 0.2); ctx.lineTo(x + ux * len * q - uy * w, y + uy * len * q + ux * w); }
  for (let i = 8; i >= 1; i--) { const q = i / 8, w = r * (1 - q) * (1 + Math.sin(time * 27 + i * 2) * 0.2); ctx.lineTo(x + ux * len * q + uy * w, y + uy * len * q - ux * w); }
  ctx.lineTo(x + uy * r, y - ux * r); ctx.closePath(); ctx.fill();
  bloom(ctx, x, y, r * 3, '#fb923c', 0.55);
  ctx.restore();
}
// Bola de fuego: núcleo blanco, capas de llamas que se retuercen hacia arriba, chispas.
export function fireball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
  fireTrail(ctx, x, y, r * 0.9, 0, 1, time, 1.6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [k, c, s] of [[0, 'rgba(220,38,38,0.7)', 1.55], [1, 'rgba(249,115,22,0.8)', 1.25], [2, 'rgba(253,224,71,0.85)', 0.95]] as const) {
    ctx.fillStyle = c; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, up = Math.max(0, -Math.sin(a)), rr = r * s * (0.75 + 0.25 * Math.sin(time * 18 + i * 1.9 + k)) * (1 + up * 0.6); ctx.lineTo(x + Math.cos(a) * rr * 0.85, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7); core.addColorStop(0, '#ffffff'); core.addColorStop(0.6, 'rgba(255,250,220,0.9)'); core.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.fill();
  for (let k = 0; k < 6; k++) { const life = (time * 2 + hash(k)) % 1; ctx.fillStyle = `rgba(255,220,120,${1 - life})`; ctx.fillRect(x + (hash(k + 5) - 0.5) * r * 2 + Math.sin(time * 5 + k) * 0.05, y - r - life * 0.8, 1.2 * P, 1.2 * P); }
  bloom(ctx, x, y, r * 4, '#f97316', 0.5);
  ctx.restore();
}

// ---------------------------------------------------------------- Torreta
// Base blindada atornillada, domo que gira, cañón de dos tramos con freno de boca, sensor rojo y fogonazo.
export function turret(ctx: CanvasRenderingContext2D, gx: number, gy: number, aim: number, baseY: number, up: boolean, tracker: boolean, hot: boolean, time: number) {
  plate(ctx, gx - 0.38, up ? baseY - 0.16 : baseY, 0.76, 0.16, '#3a414c', { rust: 0.4 });
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(aim);
  plate(ctx, 0.05, -0.1, 0.44, 0.2, '#4a525e', { bolts: false, r: 0.02 });
  ctx.beginPath(); ctx.rect(0.42, -0.065, 0.26, 0.13); ctx.fillStyle = lin(ctx, 0, -0.065, 0, 0.065, [[0, '#9aa3b0'], [0.35, '#e5e9ef'], [0.6, '#5b6472'], [1, '#1f242c']]); ctx.fill(); ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = 0.6 * P; ctx.stroke();
  plate(ctx, 0.64, -0.1, 0.1, 0.2, '#2a2f37', { bolts: false, r: 0.015 }); // freno de boca
  ctx.fillStyle = '#050607'; ctx.fillRect(0.66, -0.07, 0.02, 0.14);
  if (hot) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.moveTo(0.74, -0.06); ctx.lineTo(1.0 + Math.random() * 0.15, 0); ctx.lineTo(0.74, 0.06); ctx.fill(); ctx.restore(); bloom(ctx, 0.8, 0, 0.45, '#fde047', 0.8); }
  ctx.restore();
  const dome = () => ctx.arc(gx, gy, 0.27, 0, TAU);
  shade(ctx, dome, tracker ? '#7f1d2d' : '#5a3a1a', { x: gx - 0.1, y: gy - 0.12, r: 0.36, hi: 0.4, tex: 0.5 });
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.arc(gx, gy, 0.19, 0, TAU); ctx.stroke();
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; bolt(ctx, gx + Math.cos(a) * 0.23, gy + Math.sin(a) * 0.23, 1 * P); }
  const lit = tracker || hot ? 1 : 0.4 + 0.3 * Math.sin(time * 4);
  ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(gx, gy, 0.085, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.07); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, hot ? '#fde047' : '#ff2a2a'); g.addColorStop(1, '#3a0000');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, 0.065, 0, TAU); ctx.fill();
  bloom(ctx, gx, gy, 0.3, hot ? '#fde047' : '#ff2a2a', 0.45 * lit);
  spec(ctx, gx - 0.1, gy - 0.13, 0.08, 0.03, -0.5, 0.6);
}

// ---------------------------------------------------------------- Prensa
// Cabeza de acero pesada con franjas de peligro gastadas, nervios y tornillos; el pistón cromado con reflejos
// y la marca de aceite.
export function pressArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, head: number, piston: { x: number; y: number; h: number } | null, down: boolean) {
  if (piston && piston.h > 0) {
    ctx.beginPath(); ctx.rect(piston.x, piston.y, 0.4, piston.h);
    ctx.fillStyle = lin(ctx, piston.x, 0, piston.x + 0.4, 0, [[0, '#5b6472'], [0.18, '#cfd6df'], [0.3, '#ffffff'], [0.45, '#aeb7c3'], [0.75, '#6b7482'], [1, '#2a3038']]); ctx.fill();
    ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = 0.7 * P; ctx.stroke();
    ctx.fillStyle = 'rgba(120,90,40,0.35)'; ctx.fillRect(piston.x + 0.05, down ? piston.y + piston.h - 0.15 : piston.y, 0.3, 0.15); // aceite
    plate(ctx, piston.x - 0.08, down ? piston.y + piston.h - 0.08 : piston.y, 0.56, 0.08, '#3a414c', { bolts: false });
  }
  plate(ctx, x, y, w, head, '#4b5361', { rust: 0.35 });
  const band = down ? y + head - 0.2 : y;
  hazardStripes(ctx, x + 0.05, band + 0.03, w - 0.1, 0.14);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0.3; k < w - 0.1; k += 0.45) ctx.fillRect(x + k, down ? y + 0.06 : y + 0.24, 0.05, head - 0.3); // nervios
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0.3; k < w - 0.1; k += 0.45) ctx.fillRect(x + k - P * 0.6, down ? y + 0.06 : y + 0.24, P * 0.6, head - 0.3);
}

// ---------------------------------------------------------------- Carámbano
// Hielo traslúcido: capas de azul con reflejos internos, burbujitas, el filo brillante y una gota que se forma
// en la punta y cae.
export function icicleArt(ctx: CanvasRenderingContext2D, x: number, root: number, tipY: number, w: number, time: number, seed: number) {
  const dir = tipY > root ? 1 : -1, len = Math.abs(tipY - root), cx = x + w / 2;
  const path = () => { ctx.moveTo(x, root); ctx.quadraticCurveTo(x + w * 0.15, root + dir * len * 0.4, cx - w * 0.04, tipY); ctx.lineTo(cx + w * 0.02, tipY); ctx.quadraticCurveTo(x + w * 0.85, root + dir * len * 0.35, x + w, root); ctx.closePath(); };
  ctx.beginPath(); path(); ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [[0, 'rgba(240,250,255,0.92)'], [0.35, 'rgba(186,230,253,0.75)'], [0.7, 'rgba(125,190,240,0.7)'], [1, 'rgba(60,120,200,0.85)']]); ctx.fill();
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, root, 0, tipY, [[0, 'rgba(255,255,255,0.45)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(200,240,255,0.3)']]); ctx.fillRect(x, Math.min(root, tipY), w, len);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7 * P;
  for (let k = 0; k < 3; k++) { const ox = x + w * (0.25 + k * 0.2); ctx.beginPath(); ctx.moveTo(ox, root); ctx.quadraticCurveTo(ox + w * 0.05, root + dir * len * 0.5, cx, root + dir * len * (0.7 + k * 0.08)); ctx.stroke(); } // vetas
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + w * (0.3 + hash(seed + k) * 0.4), root + dir * len * hash(seed * 3 + k) * 0.6, 0.5 * P + hash(k) * 0.6 * P, 0, TAU); ctx.fill(); } // burbujas
  ctx.restore();
  ctx.beginPath(); path(); ctx.strokeStyle = 'rgba(30,70,130,0.6)'; ctx.lineWidth = 0.6 * P; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(x + w * 0.22, root + dir * 0.05); ctx.quadraticCurveTo(x + w * 0.3, root + dir * len * 0.4, cx - w * 0.04, tipY - dir * len * 0.1); ctx.stroke(); // filo
  const k = (time * 0.4 + hash(seed)) % 1; // gota
  ctx.fillStyle = 'rgba(200,235,255,0.85)'; ctx.beginPath(); ctx.ellipse(cx, tipY + dir * (k < 0.7 ? k * 0.04 : 0.03 + (k - 0.7) * 2), 0.9 * P + k * P * 0.6, 1.2 * P + k * P, 0, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- Lava (géiser)
// Columna de lava: capas que se suman (rojo, naranja, amarillo, blanco), bordes que se retuercen, salpicaduras
// y la boca de roca volcánica al rojo.
export function lavaColumn(ctx: CanvasRenderingContext2D, x: number, w: number, top: number, bottom: number, time: number) {
  const cx = x + w / 2, h = bottom - top;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  bloom(ctx, cx, (top + bottom) / 2, Math.max(h * 0.6, 0.8), '#f97316', 0.4);
  for (const [s, c] of [[1, 'rgba(190,30,20,0.85)'], [0.75, 'rgba(249,115,22,0.85)'], [0.45, 'rgba(253,224,71,0.85)'], [0.18, 'rgba(255,255,240,0.9)']] as const) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - w / 2 * s, bottom);
    for (let y = 0; y <= h; y += 0.2) ctx.lineTo(cx - w / 2 * s + Math.sin(time * 15 + y * 3 + s * 5) * 0.07 * s, bottom - y);
    ctx.quadraticCurveTo(cx, top - 0.25 * s, cx + w / 2 * s, top);
    for (let y = h; y >= 0; y -= 0.2) ctx.lineTo(cx + w / 2 * s + Math.sin(time * 13 + y * 3 + s * 3) * 0.07 * s, bottom - y);
    ctx.closePath(); ctx.fill();
  }
  for (let k = 0; k < 7; k++) { const d = (time * 1.6 + k / 7) % 1, a = -Math.PI / 2 + (hash(k) - 0.5) * 1.6, sp = 0.5 + hash(k + 3) * 0.6; ctx.fillStyle = `rgba(255,${180 - d * 120},60,${1 - d})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d * sp, top + Math.sin(a) * d * sp + d * d * 0.8, (1.8 - d) * P, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function ventRock(ctx: CanvasRenderingContext2D, x: number, w: number, floorY: number, glowing: number) {
  const path = () => { ctx.moveTo(x - 0.22, floorY); ctx.quadraticCurveTo(x - 0.1, floorY - 0.32, x + 0.05, floorY - 0.24); ctx.lineTo(x + w - 0.05, floorY - 0.24); ctx.quadraticCurveTo(x + w + 0.1, floorY - 0.32, x + w + 0.22, floorY); ctx.closePath(); };
  shade(ctx, path, '#3a3330', { x: x, y: floorY - 0.3, r: w + 0.4, tex: 0.8, texSize: 1.3 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, 0, floorY - 0.24, 0, floorY - 0.1, [[0, `rgba(255,140,40,${0.4 + 0.5 * glowing})`], [1, 'rgba(255,80,20,0)']]); ctx.fillRect(x + 0.05, floorY - 0.24, w - 0.1, 0.14);
  ctx.strokeStyle = `rgba(255,120,30,${0.35 + 0.4 * glowing})`; ctx.lineWidth = 0.8 * P; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + w / 2 + s * w * 0.3, floorY - 0.22); ctx.lineTo(x + w / 2 + s * w * 0.55, floorY - 0.1); ctx.lineTo(x + w / 2 + s * w * 0.7, floorY - 0.04); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Ovni
// Platillo de metal pulido con paneles y remaches, cúpula de vidrio con un alien adentro, luces que giran
// alrededor del borde y el rayo tractor.
export function saucer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, time: number, floorY: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, 0, y, 0, floorY, [[0, `rgba(134,239,172,${0.35 + 0.15 * Math.sin(time * 6)})`], [1, 'rgba(74,222,128,0)']]);
  ctx.beginPath(); ctx.moveTo(x - 0.4, y + 0.2); ctx.lineTo(x + 0.4, y + 0.2); ctx.lineTo(x + 1.3, floorY); ctx.lineTo(x - 1.3, floorY); ctx.fill();
  for (let k = 0; k < 5; k++) { const d = (time * 0.8 + k / 5) % 1; ctx.strokeStyle = `rgba(187,247,208,${0.4 * (1 - d)})`; ctx.lineWidth = P; ctx.beginPath(); ctx.ellipse(x, y + 0.2 + d * (floorY - y - 0.2), 0.4 + d * 0.9, 0.06 + d * 0.12, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  const rx = w / 2 + 0.25;
  // cúpula con alien
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 0.12, 0.42, 0.42, 0, Math.PI, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(20,60,70,0.55)'; ctx.fillRect(x - 0.5, y - 0.6, 1, 0.6);
  const head = () => ctx.ellipse(x, y - 0.24, 0.13, 0.16, 0, 0, TAU);
  shade(ctx, head, '#7fae4a', { x: x - 0.05, y: y - 0.32, r: 0.2, lw: 0.6 });
  ctx.fillStyle = '#05070a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 0.055, y - 0.24, 0.045, 0.028, s * 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(x, y - 0.12, 0.42, 0.42, 0, Math.PI, TAU); ctx.fillStyle = lin(ctx, x - 0.4, y - 0.5, x + 0.4, y, [[0, 'rgba(220,252,255,0.45)'], [0.5, 'rgba(120,220,240,0.15)'], [1, 'rgba(40,140,170,0.35)']]); ctx.fill();
  ctx.strokeStyle = 'rgba(200,240,250,0.6)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
  spec(ctx, x - 0.18, y - 0.4, 0.12, 0.04, -0.6, 0.8);
  // disco
  const disc = () => ctx.ellipse(x, y, rx, 0.26, 0, 0, TAU);
  ctx.beginPath(); disc(); ctx.fillStyle = lin(ctx, 0, y - 0.26, 0, y + 0.26, [[0, '#f8fafc'], [0.3, '#c3cad4'], [0.5, '#7b8592'], [0.62, '#d9dee5'], [1, '#353b45']]); ctx.fill();
  grain(ctx, disc, 0.3);
  ctx.beginPath(); disc(); ctx.strokeStyle = '#1f242c'; ctx.lineWidth = 0.8 * P; ctx.stroke();
  ctx.save(); ctx.beginPath(); disc(); ctx.clip(); ctx.strokeStyle = 'rgba(30,35,45,0.45)'; ctx.lineWidth = 0.6 * P;
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rx * 0.55, y - 0.03 + Math.sin(a) * 0.12); ctx.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * 0.26); ctx.stroke(); }
  ctx.restore();
  spec(ctx, x - rx * 0.4, y - 0.12, rx * 0.35, 0.03, 0, 0.7);
  for (let k = 0; k < 8; k++) { const a = time * 3 + k / 8 * TAU, front = Math.sin(a) > 0; if (!front) continue; const lx = x + Math.cos(a) * rx * 0.92, ly = y + 0.06 + Math.sin(a) * 0.12, c = k % 2 ? '#fde047' : '#f43f5e'; bloom(ctx, lx, ly, 0.16, c, 0.7); ctx.fillStyle = lighten(c, 0.5); ctx.beginPath(); ctx.arc(lx, ly, 1.5 * P, 0, TAU); ctx.fill(); }
}

// ---------------------------------------------------------------- Puerta
// Panel de compuerta blindada: chapa con refuerzos en X, franja de peligro en el borde que cierra, luz de aviso.
export function doorPanel(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, edgeAtBottom: boolean, light: boolean) {
  if (y1 - y0 < 0.02) return;
  plate(ctx, x, y0, w, y1 - y0, '#5b6574', { rust: 0.25, bolts: false });
  ctx.save(); ctx.beginPath(); ctx.rect(x, y0, w, y1 - y0); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2 * P;
  for (let yy = edgeAtBottom ? y1 - 0.25 : y0 + 0.25; edgeAtBottom ? yy > y0 : yy < y1; yy += edgeAtBottom ? -0.9 : 0.9) { ctx.beginPath(); ctx.moveTo(x + 0.06, yy); ctx.lineTo(x + w - 0.06, yy + (edgeAtBottom ? -0.7 : 0.7)); ctx.moveTo(x + w - 0.06, yy); ctx.lineTo(x + 0.06, yy + (edgeAtBottom ? -0.7 : 0.7)); ctx.stroke(); }
  ctx.restore();
  const eh = Math.min(0.2, y1 - y0);
  hazardStripes(ctx, x, edgeAtBottom ? y1 - eh : y0, w, eh, 0.22);
  if (y1 - y0 > 0.5) { const ly = edgeAtBottom ? y1 - 0.38 : y0 + 0.3; ctx.fillStyle = light ? '#f87171' : '#5a0f0f'; ctx.beginPath(); ctx.arc(x + w / 2, ly, 0.045, 0, TAU); ctx.fill(); if (light) bloom(ctx, x + w / 2, ly, 0.3, '#ef4444', 0.7); }
}

// ---------------------------------------------------------------- Péndulo
// Cadena de eslabones de acero con brillo, del ancla a la bola.
export function chain(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, angle: number) {
  const len = Math.hypot(x1 - x0, y1 - y0), links = Math.ceil(len / 0.14);
  for (let k = 0; k < links; k++) {
    const f = (k + 0.5) / links, lx = x0 + (x1 - x0) * f, ly = y0 + (y1 - y0) * f;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(angle);
    if (k % 2) { ctx.strokeStyle = '#2a2f37'; ctx.lineWidth = 2 * P; ctx.beginPath(); ctx.ellipse(0, 0, 0.022, 0.085, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#c3cad4'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.ellipse(-0.004, 0, 0.018, 0.08, 0, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); }
    else { ctx.strokeStyle = '#1f242c'; ctx.lineWidth = 2.6 * P; ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.085, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#8b95a5'; ctx.lineWidth = 1.5 * P; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.085, 0, Math.PI * 0.9, Math.PI * 1.4); ctx.stroke(); }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Plataforma que da vuelta la gravedad
// Plataforma de metal con un emisor y la flecha como holograma (con líneas de barrido) que late.
export function flipPad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, up: boolean, color: string, time: number) {
  plate(ctx, x, y, w, h, '#2f3846', { rust: 0.2 });
  const pulse = 0.6 + 0.4 * Math.sin(time * 6), ey = up ? y + P * 1.5 : y + h - P * 2.5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(color, 0.9 * pulse); ctx.fillRect(x + 0.1, ey, w - 0.2, P);
  bloom(ctx, x + w / 2, ey, 0.6, color, 0.5 * pulse);
  const base = up ? y - 0.05 : y + h + 0.05, tip = up ? y - 0.8 : y + h + 0.8, mid = (base + tip) / 2, cx = x + w / 2;
  ctx.fillStyle = lin(ctx, 0, base, 0, tip, [[0, alpha(color, 0.15)], [1, alpha(color, 0.55 * pulse)]]);
  ctx.beginPath(); ctx.moveTo(x + 0.08, base); ctx.lineTo(cx - 0.08, tip + (base - tip) * 0.05); ctx.lineTo(cx + 0.08, tip + (base - tip) * 0.05); ctx.lineTo(x + w - 0.08, base); ctx.closePath(); ctx.fill(); // cono de luz
  const arrow = () => { ctx.moveTo(cx - 0.13, base); ctx.lineTo(cx - 0.13, mid); ctx.lineTo(cx - 0.3, mid); ctx.lineTo(cx, tip); ctx.lineTo(cx + 0.3, mid); ctx.lineTo(cx + 0.13, mid); ctx.lineTo(cx + 0.13, base); ctx.closePath(); };
  ctx.beginPath(); arrow(); ctx.fillStyle = alpha(color, 0.45 * pulse); ctx.fill(); ctx.strokeStyle = alpha(lighten(color, 0.5), 0.9 * pulse); ctx.lineWidth = 0.8 * P; ctx.stroke();
  ctx.save(); ctx.beginPath(); arrow(); ctx.clip(); ctx.fillStyle = alpha('#ffffff', 0.35 * pulse);
  const off = (time * 0.6) % 0.08; for (let yy = Math.min(base, tip) - off; yy < Math.max(base, tip); yy += 0.08) ctx.fillRect(x, yy, w, P * 0.5);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Bichos que caminan (walker)
// ice: centinela robot de hielo; factory: robot industrial; el resto: alien gelatinoso con ojo en un tallo.
// Dibujado con los pies en (0, b), mirando a la derecha.
export function walkerArt(ctx: CanvasRenderingContext2D, kind: 'ice' | 'factory' | 'alien', b: number, time: number, id: number) {
  const step = time * 7 + id;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, b, 0.36, 0.06, 0, 0, TAU); ctx.fill(); // sombra
  if (kind === 'alien') {
    const sq = 1 + Math.sin(step * 1.3) * 0.06;
    ctx.save(); ctx.translate(0, b); ctx.scale(1 / sq, sq);
    const body = () => { ctx.moveTo(-0.4, 0); ctx.bezierCurveTo(-0.45, -0.35, -0.25, -0.62, 0.0, -0.62); ctx.bezierCurveTo(0.27, -0.62, 0.45, -0.35, 0.4, 0); ctx.closePath(); };
    ctx.beginPath(); body(); const g = ctx.createRadialGradient(-0.1, -0.4, 0.02, 0, -0.3, 0.55); g.addColorStop(0, 'rgba(220,255,170,0.95)'); g.addColorStop(0.5, 'rgba(120,200,40,0.85)'); g.addColorStop(1, 'rgba(40,90,10,0.95)'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    for (let k = 0; k < 7; k++) { const by = -((time * 0.3 + hash(k + id)) % 1) * 0.6, bx = (hash(k * 3 + id) - 0.5) * 0.6; ctx.strokeStyle = 'rgba(240,255,220,0.6)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.arc(bx, by, 0.015 + hash(k) * 0.025, 0, TAU); ctx.stroke(); } // burbujas adentro
    ctx.fillStyle = 'rgba(30,60,10,0.6)'; ctx.beginPath(); ctx.ellipse(0.02, -0.25, 0.12, 0.09, 0.3, 0, TAU); ctx.fill(); // órgano
    ctx.restore();
    ctx.beginPath(); body(); ctx.strokeStyle = 'rgba(20,50,5,0.9)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
    spec(ctx, -0.15, -0.48, 0.1, 0.04, -0.5, 0.75);
    ctx.restore();
    // tallo con el ojo que mira para todos lados
    const ex = 0.1 + Math.sin(time * 1.7 + id) * 0.08, ey = b - 0.9 - Math.sin(time * 2.3) * 0.04;
    ctx.strokeStyle = 'rgba(60,120,20,0.95)'; ctx.lineWidth = 2.4 * P; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, b - 0.55); ctx.quadraticCurveTo(ex - 0.1, b - 0.75, ex, ey); ctx.stroke();
    shade(ctx, () => ctx.arc(ex, ey, 0.1, 0, TAU), '#e8e0c8', { x: ex - 0.03, y: ey - 0.04, r: 0.13, lw: 0.6 });
    const g2 = ctx.createRadialGradient(ex + 0.03, ey, 0, ex + 0.03, ey, 0.055); g2.addColorStop(0, '#fff7a0'); g2.addColorStop(0.5, '#e8a10a'); g2.addColorStop(1, '#5a2a00'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(ex + 0.03, ey, 0.055, 0, TAU); ctx.fill();
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(ex + 0.035, ey, 0.012, 0.04, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,30,30,0.5)'; ctx.lineWidth = 0.5 * P; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(ex - 0.09, ey - 0.03 + k * 0.02); ctx.lineTo(ex - 0.04, ey - 0.02 + k * 0.015); ctx.stroke(); } // venitas
    for (let k = 0; k < 3; k++) { const dk = (time * 0.6 + k / 3) % 1; ctx.fillStyle = `rgba(150,220,60,${0.8 * (1 - dk)})`; ctx.beginPath(); ctx.ellipse(-0.3 + k * 0.3, b + dk * 0.05, 0.05 * (1 - dk) + 0.02, 0.015, 0, 0, TAU); ctx.fill(); } // baba en el piso
    return;
  }
  const ice = kind === 'ice', body = ice ? '#c9d6e3' : '#5b6370', accent = ice ? '#38bdf8' : '#facc15', eyeC = '#ff2a2a';
  // piernas articuladas que caminan
  for (const side of [-1, 1]) {
    const ph = step + (side < 0 ? Math.PI : 0), hip: [number, number] = [side * 0.12, b - 0.42];
    const foot: [number, number] = [side * 0.12 + Math.cos(ph) * 0.12, b - Math.max(0, Math.sin(ph)) * 0.06];
    const knee: [number, number] = [(hip[0] + foot[0]) / 2 + 0.06, (hip[1] + foot[1]) / 2];
    ctx.save(); if (side < 0) ctx.globalAlpha = 0.85;
    segment(ctx, hip, knee, 0.11, 0.08, side < 0 ? darken(body, 0.35) : body, 0.6); segment(ctx, knee, foot, 0.08, 0.07, side < 0 ? darken(body, 0.35) : body, 0.6);
    plate(ctx, foot[0] - 0.08, foot[1] - 0.05, 0.2, 0.06, '#2a3038', { bolts: false });
    ctx.restore();
  }
  // torso blindado
  plate(ctx, -0.3, b - 0.95, 0.6, 0.55, body, { rust: ice ? 0 : 0.5 });
  if (ice) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-0.25 + k * 0.12, b - 0.95, 0.07, 0.025, 0, 0, TAU); ctx.fill(); } } // escarcha
  else hazardStripes(ctx, -0.27, b - 0.52, 0.54, 0.08, 0.16);
  // cabeza con visor y ojo que barre
  plate(ctx, -0.2, b - 1.2, 0.4, 0.26, darken(body, 0.15), { bolts: false, r: 0.06 });
  ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.roundRect(-0.16, b - 1.13, 0.32, 0.1, 0.03); ctx.fill();
  const sx = Math.sin(time * 2.5 + id) * 0.1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha(eyeC, 0.4); ctx.fillRect(-0.15, b - 1.09, 0.3, P); ctx.restore();
  ctx.fillStyle = '#ffe0e0'; ctx.beginPath(); ctx.ellipse(sx, b - 1.08, 0.035, 0.025, 0, 0, TAU); ctx.fill();
  bloom(ctx, sx, b - 1.08, 0.22, eyeC, 0.8);
  // antena y luz
  ctx.strokeStyle = '#8b95a5'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(0.12, b - 1.2); ctx.lineTo(0.16, b - 1.36); ctx.stroke();
  if (Math.sin(time * 5 + id) > 0) bloom(ctx, 0.16, b - 1.37, 0.1, accent, 0.9);
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0.16, b - 1.37, 1.2 * P, 0, TAU); ctx.fill();
  // brazos con garra / cañón
  const sw = Math.sin(step) * 0.15;
  segment(ctx, [0.28, b - 0.85], [0.42, b - 0.62 + sw * 0.3], 0.09, 0.07, body, 0.6);
  segment(ctx, [0.42, b - 0.62 + sw * 0.3], [0.55, b - 0.55 + sw * 0.3], 0.07, 0.06, darken(body, 0.25), 0.6);
  bolt(ctx, 0.28, b - 0.85, 2 * P);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-0.24, b - 0.88, 0.48, P);
  // panel de luces del pecho
  for (let k = 0; k < 3; k++) { const on = Math.sin(time * 4 + k * 2 + id) > 0; ctx.fillStyle = on ? accent : darken(accent, 0.7); ctx.fillRect(-0.18 + k * 0.1, b - 0.75, 0.06, 0.04); if (on) bloom(ctx, -0.15 + k * 0.1, b - 0.73, 0.08, accent, 0.5); }
}

// ---------------------------------------------------------------- Bichos que vuelan (flyer)
// bat: murciélago alien de membrana; beetle: escarabajo luminoso; drone: dron de vigilancia de cuatro hélices.
export function flyerArt(ctx: CanvasRenderingContext2D, kind: 'bat' | 'beetle' | 'drone', x: number, y: number, time: number, id: number) {
  const flap = Math.sin(time * 16 + id);
  if (kind === 'bat') {
    for (const s of [-1, 1]) {
      const tipY = y - 0.15 - flap * 0.3, wing = () => { ctx.moveTo(x + s * 0.08, y - 0.05); ctx.quadraticCurveTo(x + s * 0.3, tipY - 0.1, x + s * 0.62, tipY); ctx.quadraticCurveTo(x + s * 0.55, y + 0.02, x + s * 0.48, y + 0.1); ctx.quadraticCurveTo(x + s * 0.4, y - 0.0, x + s * 0.32, y + 0.12); ctx.quadraticCurveTo(x + s * 0.22, y + 0.02, x + s * 0.1, y + 0.1); ctx.closePath(); };
      ctx.beginPath(); wing(); ctx.fillStyle = lin(ctx, x, tipY, x, y + 0.12, [[0, 'rgba(110,40,120,0.92)'], [1, 'rgba(40,10,50,0.95)']]); ctx.fill();
      ctx.strokeStyle = 'rgba(20,5,25,0.9)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
      ctx.strokeStyle = 'rgba(200,120,210,0.5)'; ctx.lineWidth = 0.6 * P; for (const k of [0.32, 0.48, 0.62]) { ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - 0.04); ctx.lineTo(x + s * k, tipY + (y - tipY) * (k - 0.3) * 1.6); ctx.stroke(); } // dedos de la membrana
    }
    shade(ctx, () => ctx.ellipse(x, y, 0.15, 0.19, 0, 0, TAU), '#4a2050', { x: x - 0.05, y: y - 0.08, r: 0.22, tex: 0.7, lw: 0.7 });
    for (const s of [-1, 1]) { ctx.fillStyle = '#2a0f30'; ctx.beginPath(); ctx.moveTo(x + s * 0.05, y - 0.15); ctx.lineTo(x + s * 0.12, y - 0.3); ctx.lineTo(x + s * 0.13, y - 0.12); ctx.fill(); } // orejas
    for (const s of [-1, 1]) { ctx.fillStyle = '#05000a'; ctx.beginPath(); ctx.arc(x + s * 0.055, y - 0.05, 0.03, 0, TAU); ctx.fill(); const g = ctx.createRadialGradient(x + s * 0.055, y - 0.05, 0, x + s * 0.055, y - 0.05, 0.022); g.addColorStop(0, '#fff7c0'); g.addColorStop(1, '#e8a000'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + s * 0.055, y - 0.05, 0.022, 0, TAU); ctx.fill(); bloom(ctx, x + s * 0.055, y - 0.05, 0.1, '#facc15', 0.5); }
    ctx.fillStyle = '#f2e8d0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 0.035, y + 0.06); ctx.lineTo(x + s * 0.02, y + 0.13); ctx.lineTo(x + s * 0.005, y + 0.06); ctx.fill(); } // colmillos
    return;
  }
  if (kind === 'beetle') {
    bloom(ctx, x, y + 0.1, 0.7, '#bef264', 0.35 + 0.15 * Math.sin(time * 3 + id));
    ctx.save(); ctx.globalAlpha = 0.5;
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(x + s * 0.08, y - 0.08); ctx.rotate(s * (0.5 + flap * 0.5)); ctx.scale(s, 1); ctx.beginPath(); ctx.ellipse(0.2, 0, 0.22, 0.07, 0, 0, TAU); ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,140,160,0.7)'; ctx.lineWidth = 0.5 * P; ctx.stroke(); ctx.restore(); }
    ctx.restore();
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) segment(ctx, [x + s * 0.08, y + 0.02 + k * 0.05], [x + s * (0.2 + Math.sin(time * 9 + k) * 0.02), y + 0.1 + k * 0.06], 0.025, 0.012, '#1a2a0a', 0.3);
    const shell = () => ctx.ellipse(x, y, 0.17, 0.22, 0, 0, TAU);
    shade(ctx, shell, '#2f5a12', { x: x - 0.06, y: y - 0.1, r: 0.26, hi: 0.5, tex: 0.4, lw: 0.7 });
    ctx.strokeStyle = 'rgba(5,15,0,0.8)'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(x, y - 0.14); ctx.lineTo(x, y + 0.22); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(190,242,100,${0.6 + 0.3 * Math.sin(time * 4 + id)})`; ctx.beginPath(); ctx.ellipse(x, y + 0.13, 0.1, 0.07, 0, 0, TAU); ctx.fill(); ctx.restore(); // farolito
    spec(ctx, x - 0.07, y - 0.08, 0.05, 0.1, 0.2, 0.6);
    shade(ctx, () => ctx.ellipse(x, y - 0.2, 0.08, 0.05, 0, 0, TAU), '#14240a', { x: x - 0.02, y: y - 0.22, r: 0.1, lw: 0.6 });
    return;
  }
  // dron de cuatro hélices con cámara roja
  for (const s of [-1, 1]) {
    segment(ctx, [x, y - 0.1], [x + s * 0.38, y - 0.24], 0.05, 0.035, '#3a414c', 0.6);
    ctx.save(); ctx.translate(x + s * 0.38, y - 0.3);
    shade(ctx, () => ctx.roundRect(-0.04, 0, 0.08, 0.07, 0.015), '#2a2f37', { x: 0, y: 0, r: 0.08 });
    ctx.fillStyle = 'rgba(210,220,230,0.25)'; ctx.beginPath(); ctx.ellipse(0, -0.01, 0.24, 0.035, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(25,28,34,0.9)'; ctx.lineWidth = 1.2 * P; const a = time * 70 + s; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.24, -0.01); ctx.lineTo(-Math.cos(a) * 0.24, -0.01); ctx.stroke();
    ctx.restore();
  }
  plate(ctx, x - 0.28, y - 0.18, 0.56, 0.3, '#3d4552', { r: 0.08 });
  ctx.fillStyle = '#0b0d11'; ctx.beginPath(); ctx.arc(x + 0.05, y + 0.16, 0.1, 0, Math.PI); ctx.fill();
  const g = ctx.createRadialGradient(x + 0.05, y + 0.17, 0, x + 0.05, y + 0.17, 0.07); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ff2a2a'); g.addColorStop(1, '#300000');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 0.05, y + 0.17, 0.065, 0, TAU); ctx.fill();
  bloom(ctx, x + 0.05, y + 0.17, 0.3, '#ff2a2a', 0.6);
  if (Math.sin(time * 6 + id) > 0) { ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(x - 0.2, y - 0.1, 1 * P, 0, TAU); ctx.fill(); bloom(ctx, x - 0.2, y - 0.1, 0.08, '#22c55e', 0.8); }
}

// ---------------------------------------------------------------- Hongo que rebota
// Hongo bioluminiscente: sombrero con laminillas abajo, manchas que brillan, tallo con anillo y volva.
export function mushroom(ctx: CanvasRenderingContext2D, time: number, id: number) {
  const sq = 1 + Math.sin(time * 5 + id) * 0.05;
  const stem = () => { ctx.moveTo(-0.11, 0); ctx.quadraticCurveTo(-0.08, -0.15, -0.09, -0.32); ctx.lineTo(0.09, -0.32); ctx.quadraticCurveTo(0.08, -0.15, 0.11, 0); ctx.closePath(); };
  shade(ctx, stem, '#e8dcc0', { x: -0.04, y: -0.2, r: 0.25, tex: 0.5, lw: 0.6 });
  ctx.fillStyle = 'rgba(200,180,150,0.9)'; ctx.beginPath(); ctx.ellipse(0, -0.2, 0.1, 0.025, 0, 0, TAU); ctx.fill(); // anillo
  ctx.fillStyle = 'rgba(110,80,60,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, 0.15, 0.04, 0, Math.PI, TAU); ctx.fill(); // volva
  ctx.save(); ctx.translate(0, -0.3); ctx.scale(sq, 1 / sq);
  ctx.fillStyle = '#5a1838'; ctx.beginPath(); ctx.ellipse(0, 0, 0.48, 0.07, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,220,0.45)'; ctx.lineWidth = 0.5 * P; for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 0.045, 0.06 * Math.cos(k / 10 * 1.4)); ctx.stroke(); } // laminillas
  const cap = () => { ctx.ellipse(0, 0, 0.5, 0.32, 0, Math.PI, TAU); ctx.closePath(); };
  shade(ctx, cap, '#c0266a', { x: -0.15, y: -0.25, r: 0.55, hi: 0.4, tex: 0.5, lw: 0.7 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [sx, sy, sr] of [[-0.22, -0.12, 0.05], [0.12, -0.2, 0.06], [0.3, -0.08, 0.035], [-0.05, -0.27, 0.035], [-0.35, -0.04, 0.03]] as const) { ctx.fillStyle = `rgba(255,200,235,${0.6 + 0.3 * Math.sin(time * 3 + sx * 9)})`; ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  spec(ctx, -0.18, -0.22, 0.14, 0.04, -0.3, 0.5);
  ctx.restore();
  bloom(ctx, 0, -0.35, 0.8, '#f472b6', 0.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const d = (time * 0.4 + hash(k + id)) % 1; ctx.fillStyle = `rgba(255,190,230,${0.8 * (1 - d)})`; ctx.beginPath(); ctx.arc((hash(k * 3 + id) - 0.5) * 0.8, -0.4 - d * 0.6, 0.8 * P, 0, TAU); ctx.fill(); } ctx.restore(); // esporitas
}

// ---------------------------------------------------------------- Vaina de esporas
// Bola de esporas venenosa: piel de hongo con poros que brillan, pelitos y nube de esporas alrededor.
export function sporePod(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, id: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) { const a = hash(k + id) * TAU + time * (0.3 + hash(k) * 0.4), d = r * (1.3 + ((time * 0.5 + hash(k * 7)) % 1) * 1.4); ctx.fillStyle = `rgba(190,242,100,${0.55 * (1 - (d / r - 1.3) / 1.4)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.9 * P, 0, TAU); ctx.fill(); }
  bloom(ctx, x, y, r * 2.6, '#a3e635', 0.35 + 0.15 * Math.sin(time * 5 + id));
  ctx.restore();
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU + Math.sin(time * 2 + k) * 0.05; ctx.strokeStyle = 'rgba(60,90,20,0.9)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); ctx.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); ctx.stroke(); }
  const pod = () => ctx.arc(x, y, r, 0, TAU);
  shade(ctx, pod, '#5f8a1c', { x: x - r * 0.35, y: y - r * 0.4, r: r * 1.5, hi: 0.4, tex: 0.8, lw: 0.7 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 8; k++) { const a = hash(k * 5 + id) * TAU, d = r * hash(k * 2 + id) * 0.75; ctx.fillStyle = `rgba(220,255,140,${0.5 + 0.4 * Math.sin(time * 6 + k)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.08, 0, TAU); ctx.fill(); }
  ctx.restore();
  spec(ctx, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.15, -0.6, 0.5);
}

// ---------------------------------------------------------------- Planta carnívora
// Tallo con hojas, y la trampa: dos lóbulos verdes por fuera y rojos por dentro, con cilios como dientes que se
// cierran. Dibujada desde el suelo (0, 0) hacia arriba.
export function flytrap(ctx: CanvasRenderingContext2D, height: number, open: number, time: number, id: number) {
  const sway = Math.sin(time * 2 + id) * 0.08;
  ctx.strokeStyle = '#1f4a14'; ctx.lineWidth = 4.2 * P; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * 0.5 - 0.06, -height / 2, sway, -height); ctx.stroke();
  ctx.strokeStyle = '#4c8a2a'; ctx.lineWidth = 1.6 * P; ctx.beginPath(); ctx.moveTo(-0.01, 0); ctx.quadraticCurveTo(sway * 0.5 - 0.07, -height / 2, sway - 0.01, -height); ctx.stroke();
  for (const s of [-1, 1]) { const leaf = () => { ctx.moveTo(0, -0.02); ctx.quadraticCurveTo(s * 0.18, -0.2, s * 0.38, -0.1); ctx.quadraticCurveTo(s * 0.2, -0.02, 0, -0.02); }; shade(ctx, leaf, '#2f6b1e', { x: s * 0.15, y: -0.15, r: 0.3, tex: 0.5, lw: 0.6 }); ctx.strokeStyle = 'rgba(180,230,120,0.5)'; ctx.lineWidth = 0.5 * P; ctx.beginPath(); ctx.moveTo(0, -0.03); ctx.quadraticCurveTo(s * 0.18, -0.13, s * 0.36, -0.1); ctx.stroke(); }
  ctx.save(); ctx.translate(sway, -height); ctx.rotate(-Math.PI / 2);
  for (const s of [-1, 1]) {
    ctx.save(); ctx.rotate(s * open);
    const lobe = () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(0.05, s * 0.22, 0.35, s * 0.24, 0.42, s * 0.02); ctx.lineTo(0, 0); ctx.closePath(); };
    ctx.beginPath(); lobe(); ctx.fillStyle = lin(ctx, 0, 0, 0, s * 0.22, [[0, '#d42a2a'], [0.5, '#a01818'], [1, '#3f7a1e']]); ctx.fill();
    grain(ctx, lobe, 0.4);
    ctx.save(); ctx.beginPath(); lobe(); ctx.clip(); ctx.fillStyle = 'rgba(80,140,40,0.85)'; ctx.beginPath(); ctx.ellipse(0.2, s * 0.2, 0.25, 0.08, 0, 0, TAU); ctx.fill(); ctx.restore(); // borde verde
    ctx.beginPath(); lobe(); ctx.strokeStyle = 'rgba(30,10,5,0.85)'; ctx.lineWidth = 0.7 * P; ctx.stroke();
    ctx.strokeStyle = '#e8f0c0'; ctx.lineWidth = 0.7 * P; // cilios
    for (let k = 0; k < 9; k++) { const q = (k + 0.5) / 9, px = 0.02 + q * 0.38, py = s * (0.02 + Math.sin(q * Math.PI) * 0.2); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 0.02, py + s * 0.08); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,10,10,0.8)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0.12 + k * 0.08, s * 0.05, 0.8 * P, 0, TAU); ctx.fill(); } // pelos sensores
    ctx.restore();
  }
  ctx.restore();
  for (let k = 0; k < 2; k++) { const dk = (time * 0.5 + k / 2 + id) % 1; ctx.fillStyle = `rgba(200,230,120,${0.7 * (1 - dk)})`; ctx.beginPath(); ctx.ellipse(sway + 0.08 - k * 0.15, -height + 0.15 + dk * 0.4, 0.9 * P, 1.3 * P, 0, 0, TAU); ctx.fill(); } // jugo que gotea
}
