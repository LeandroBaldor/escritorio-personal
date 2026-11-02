// Las armas del cazador dibujadas como las referencias (en metros; el mango/la empuñadura en (0, 0) y el arma
// apuntando hacia +x). Sirven para la mano del cazador, los íconos del cartel de armas y las cajas.
//  · Ballesta: culata de madera, riel de plata con gemas rojas en marcos dorados, arcos curvos como guadañas.
//  · Bomba de ajo: una cabeza de ajo con una banda de hierro con remaches y el murciélago rojo, y la mecha prendida.
//  · Cruz: cruz dorada con el centro negro, una estrella roja que brilla y gemas rojas en las puntas.
//  · Espada de fuego: hoja enorme de bordes de plata ondulados y el centro de lava, guarda de alas con calavera.
//  · Pistola de fuego: pistola antigua dorada con la culata roja y el murciélago en el costado.
import { bloom, darken, lighten, shade, spec } from './gravityMonsters';

const TAU = Math.PI * 2, INK = '#0b0709';
const lg = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [k, c] of stops) g.addColorStop(k, c); return g; };
const GOLD: [number, string][] = [[0, '#fff1a8'], [0.45, '#e2a72e'], [1, '#7a4a0c']];
const SILVER: [number, string][] = [[0, '#ffffff'], [0.5, '#b9bdc9'], [1, '#5d6170']];
function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient, lw = 0.02) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
// Gema roja en un marco (dorado o de plata), con brillo.
export function gemW(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frame: 'gold' | 'silver' = 'gold', glow = 0.35) {
  poly(ctx, [[x, y - r * 1.45], [x + r * 1.45, y], [x, y + r * 1.45], [x - r * 1.45, y]], lg(ctx, x - r, y - r, x + r, y + r, frame === 'gold' ? GOLD : SILVER), r * 0.2);
  poly(ctx, [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], lg(ctx, x - r, y - r, x + r, y + r, [[0, '#ffb0a8'], [0.45, '#e3142a'], [1, '#5a0010']]), 0);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.35, y - r * 0.15); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 3.2, '#ff2a30', glow); ctx.restore(); }
}

// ---------------------------------------------------------------- Ballesta (mide 1,1 de largo)
export function drawCrossbow(ctx: CanvasRenderingContext2D, loaded = true, t = 0) {
  // los arcos: dos cuchillas curvas de plata con el filo rojo, que salen de la punta
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0.8, s * 0.05); ctx.quadraticCurveTo(1.05, s * 0.16, 1.02, s * 0.38); ctx.quadraticCurveTo(0.98, s * 0.56, 0.82, s * 0.62);
    ctx.quadraticCurveTo(0.9, s * 0.52, 0.9, s * 0.38); ctx.quadraticCurveTo(0.9, s * 0.18, 0.72, s * 0.08); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0.8, 0, 1.05, 0, SILVER); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.strokeStyle = '#e3142a'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0.95, s * 0.2); ctx.quadraticCurveTo(0.97, s * 0.42, 0.88, s * 0.55); ctx.stroke();
    ctx.fillStyle = '#e3142a'; ctx.beginPath(); ctx.arc(0.84, s * 0.6, 0.022, 0, TAU); ctx.fill();
  }
  // la cuerda (tensa hacia atrás si está cargada)
  const back = loaded ? 0.42 : 0.78;
  ctx.strokeStyle = '#d23b3b'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.84, -0.6); ctx.lineTo(back, 0); ctx.lineTo(0.84, 0.6); ctx.stroke();
  // culata de madera, gatillo y riel
  poly(ctx, [[-0.42, -0.08], [-0.1, -0.1], [0.12, -0.06], [0.12, 0.04], [-0.02, 0.06], [-0.1, 0.26], [-0.22, 0.26], [-0.16, 0.06], [-0.42, 0.06]], lg(ctx, 0, -0.1, 0, 0.26, [[0, '#9a5a32'], [1, '#4a2410']]));
  poly(ctx, [[-0.45, -0.1], [-0.38, -0.1], [-0.38, 0.08], [-0.45, 0.08]], lg(ctx, -0.45, 0, -0.38, 0, SILVER));
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0.0, 0.1, 0.05, 0, Math.PI); ctx.stroke(); // gatillo
  for (const x of [-0.3, -0.2]) { ctx.fillStyle = '#d97a3a'; ctx.beginPath(); ctx.arc(x, -0.02, 0.018, 0, TAU); ctx.fill(); }
  poly(ctx, [[0.0, -0.09], [0.85, -0.07], [0.88, 0.0], [0.85, 0.05], [0.0, 0.05]], lg(ctx, 0, -0.09, 0, 0.05, SILVER));
  ctx.fillStyle = '#e3142a'; ctx.fillRect(0.2, -0.025, 0.55, 0.03); // la ranura roja del riel
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.48, -0.01, 0.3, '#ff2030', 0.25 + 0.1 * Math.sin(t * 4)); ctx.restore();
  gemW(ctx, 0.3, -0.02, 0.06); gemW(ctx, 0.78, 0.0, 0.05, 'silver');
  if (loaded) drawBolt(ctx, 0.95, -0.12, 0.85);
}
// La flecha (con la punta roja que brilla). x = la punta.
export function drawBolt(ctx: CanvasRenderingContext2D, tipX: number, y: number, len = 0.9) {
  const x0 = tipX - len;
  ctx.strokeStyle = '#4a2a1a'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(tipX - 0.12, y); ctx.stroke();
  for (const s of [-1, 1]) poly(ctx, [[x0, y], [x0 + 0.16, y], [x0 + 0.06, y + s * 0.08], [x0 - 0.04, y + s * 0.08]], '#e3242c', 0.01);
  poly(ctx, [[tipX - 0.16, y - 0.06], [tipX, y], [tipX - 0.16, y + 0.06], [tipX - 0.12, y]], lg(ctx, tipX - 0.16, 0, tipX, 0, [[0, '#ff6050'], [1, '#ffd0c0']]), 0.012);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, tipX - 0.06, y, 0.18, '#ff3020', 0.6); ctx.restore();
}

// ---------------------------------------------------------------- Bomba de ajo (radio 1)
export function drawGarlicBomb(ctx: CanvasRenderingContext2D, r: number, t = 0, lit = true) {
  ctx.save(); ctx.scale(r, r);
  // la mecha que sale de la tapa de metal, con chispas
  ctx.strokeStyle = '#c9952e'; ctx.lineWidth = 0.13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.quadraticCurveTo(0.05, -1.35, 0.42, -1.45); ctx.stroke();
  ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 0.025; for (let k = 0.1; k < 1; k += 0.18) { const x = 0.42 * k * k, y = -0.95 - 0.5 * k; ctx.beginPath(); ctx.moveTo(x - 0.05, y - 0.02); ctx.lineTo(x + 0.05, y + 0.03); ctx.stroke(); }
  if (lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.45, -1.47, 0.6, '#ffb030', 0.8);
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 9, l = 0.18 + ((i * 37 + Math.floor(t * 20)) % 7) * 0.04; ctx.strokeStyle = `rgba(255,${180 + i * 8},80,0.9)`; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(0.45, -1.47); ctx.lineTo(0.45 + Math.cos(a) * l, -1.47 + Math.sin(a) * l); ctx.stroke(); }
    ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(0.45, -1.47, 0.07, 0, TAU); ctx.fill(); ctx.restore();
  }
  shade(ctx, () => ctx.roundRect(-0.2, -1.08, 0.4, 0.2, 0.05), '#6a6560', { x: -0.08, y: -1.05, r: 0.3, hi: 0.6, lw: 1 });
  // la cabeza de ajo con los dientes
  const bulb = () => { ctx.moveTo(-0.12, -0.92); ctx.bezierCurveTo(-0.6, -0.8, -1.0, -0.4, -0.95, 0.15); ctx.bezierCurveTo(-0.9, 0.75, -0.3, 0.98, 0, 0.98); ctx.bezierCurveTo(0.3, 0.98, 0.9, 0.75, 0.95, 0.15); ctx.bezierCurveTo(1.0, -0.4, 0.6, -0.8, 0.12, -0.92); ctx.closePath(); };
  shade(ctx, bulb, '#efe0e8', { x: -0.25, y: -0.35, r: 1.3, hi: 0.4, lo: 0.4, tex: 0.2, lw: 1.2 });
  ctx.save(); ctx.beginPath(); bulb(); ctx.clip();
  for (const k of [-0.62, -0.3, 0, 0.3, 0.62]) { ctx.strokeStyle = 'rgba(150,80,130,0.55)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(k * 0.3, -0.92); ctx.quadraticCurveTo(k * 1.6, 0.0, k * 0.5, 0.98); ctx.stroke(); ctx.strokeStyle = 'rgba(190,120,170,0.35)'; ctx.lineWidth = 0.12; ctx.stroke(); }
  ctx.restore();
  spec(ctx, -0.4, -0.45, 0.2, 0.12, -0.6, 0.6);
  // la banda de hierro con remaches y el murciélago rojo
  shade(ctx, () => { ctx.moveTo(-0.98, -0.05); ctx.quadraticCurveTo(0, 0.1, 0.98, -0.05); ctx.lineTo(0.98, 0.25); ctx.quadraticCurveTo(0, 0.42, -0.98, 0.25); ctx.closePath(); }, '#2e2a2a', { x: -0.3, y: 0, r: 1.2, hi: 0.5, lw: 1 });
  ctx.fillStyle = '#d6d2cc'; for (const x of [-0.78, -0.48, 0.48, 0.78]) { ctx.beginPath(); ctx.arc(x, 0.12 + Math.abs(x) * -0.05, 0.05, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(0, 0.17); ctx.scale(0.42, 0.42); batSign(ctx, '#e3142a'); ctx.restore();
  ctx.restore();
}
// El murciélago de los emblemas.
function batSign(ctx: CanvasRenderingContext2D, color: string) {
  ctx.beginPath(); ctx.moveTo(0, -0.18); ctx.lineTo(-0.08, -0.3); ctx.lineTo(-0.12, -0.15); ctx.quadraticCurveTo(-0.5, -0.35, -0.9, -0.12); ctx.quadraticCurveTo(-0.65, -0.05, -0.62, 0.15); ctx.quadraticCurveTo(-0.45, 0.0, -0.3, 0.1); ctx.quadraticCurveTo(-0.12, 0.08, 0, 0.42);
  ctx.quadraticCurveTo(0.12, 0.08, 0.3, 0.1); ctx.quadraticCurveTo(0.45, 0.0, 0.62, 0.15); ctx.quadraticCurveTo(0.65, -0.05, 0.9, -0.12); ctx.quadraticCurveTo(0.5, -0.35, 0.12, -0.15); ctx.lineTo(0.08, -0.3); ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, -0.3, 0, 0.4, [[0, lighten(color, 0.3)], [1, darken(color, 0.3)]]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.stroke();
}

// ---------------------------------------------------------------- Cruz (el palo mide 1; la empuñadura en el extremo de abajo)
export function drawHolyCross(ctx: CanvasRenderingContext2D, t = 0, power = 0.4) {
  // en el marco del arma (+x = para arriba de la cruz)
  ctx.save(); ctx.rotate(Math.PI / 2); // así la punta de la cruz queda hacia +x
  const L = 1.0, arm = 0.62, w = 0.11;
  const shape = (k: number) => { const W = w * k; return [[-W, 0.08], [-W, -L * 0.6], [-arm / 2, -L * 0.6], [-arm / 2, -L * 0.6 - W * 2], [-W, -L * 0.6 - W * 2], [-W, -L], [W, -L], [W, -L * 0.6 - W * 2], [arm / 2, -L * 0.6 - W * 2], [arm / 2, -L * 0.6], [W, -L * 0.6], [W, 0.08]] as [number, number][]; };
  poly(ctx, shape(1.45), lg(ctx, -0.3, -1, 0.3, 0, GOLD), 0.025);
  poly(ctx, shape(0.8), '#141014', 0);
  for (const [x, y] of [[0, -L - 0.04], [-arm / 2 - 0.04, -L * 0.6 - w], [arm / 2 + 0.04, -L * 0.6 - w]] as const) { poly(ctx, [[x, y - 0.1], [x + 0.08, y], [x, y + 0.1], [x - 0.08, y]], lg(ctx, x - 0.08, 0, x + 0.08, 0, GOLD), 0.015); gemW(ctx, x, y, 0.04, 'gold', 0.2); }
  // la estrella roja del centro
  const cx = 0, cy = -L * 0.6 - w;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, cx, cy, 0.35 + power * 0.5, '#ff2a20', 0.5 + power * 0.4 + 0.1 * Math.sin(t * 5));
  ctx.fillStyle = '#ffe6c0'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 0.03 : 0.2 + power * 0.08; ctx.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
  // el pomo dorado con la gema
  poly(ctx, [[-0.1, 0.06], [0.1, 0.06], [0.07, 0.16], [0, 0.26], [-0.07, 0.16]], lg(ctx, -0.1, 0, 0.1, 0, GOLD), 0.015);
  gemW(ctx, 0, 0.14, 0.035, 'gold', 0.15);
  ctx.restore();
}

// ---------------------------------------------------------------- Espada de fuego (hoja de 1,7)
export function drawFireSword(ctx: CanvasRenderingContext2D, t = 0, heat = 0) {
  const L = 1.75;
  // empuñadura roja enrollada y pomo con gema
  ctx.fillStyle = lg(ctx, 0, -0.07, 0, 0.07, [[0, '#e0323a'], [1, '#6a0810']]); ctx.fillRect(-0.3, -0.06, 0.38, 0.12); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.strokeRect(-0.3, -0.06, 0.38, 0.12);
  ctx.strokeStyle = '#4a0408'; ctx.lineWidth = 0.012; for (let x = -0.28; x < 0.06; x += 0.06) { ctx.beginPath(); ctx.moveTo(x, -0.06); ctx.lineTo(x + 0.05, 0.06); ctx.stroke(); }
  poly(ctx, [[-0.3, -0.08], [-0.34, 0], [-0.3, 0.08], [-0.38, 0.12], [-0.52, 0], [-0.38, -0.12]], lg(ctx, -0.5, 0, -0.3, 0, SILVER), 0.015);
  gemW(ctx, -0.41, 0, 0.035, 'silver', 0.2);
  // la hoja: bordes de plata ondulados y el centro de lava con venas
  const b0 = 0.16, edge: [number, number][] = [];
  for (let i = 0; i <= 6; i++) { const x = b0 + (L - 0.35) * i / 6; edge.push([x, -0.17 - (i % 2 ? 0.05 : 0)]); }
  const top: [number, number][] = [[b0, -0.12], ...edge, [L - 0.12, -0.17], [L + 0.15, 0]];
  const blade: [number, number][] = [...top, ...top.slice(0, -1).reverse().map(([x, y]) => [x, -y] as [number, number])];
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, L * 0.55, 0, 0.9 + heat * 0.6, '#ff3018', 0.45 + heat * 0.4 + 0.08 * Math.sin(t * 6)); ctx.restore();
  poly(ctx, blade, lg(ctx, 0, -0.25, 0, 0.25, [[0, '#ffffff'], [0.3, '#c9ccd6'], [0.7, '#9097a6'], [1, '#e8eaf0']]), 0.025);
  poly(ctx, [[b0 + 0.06, -0.08], [L - 0.15, -0.08], [L + 0.02, 0], [L - 0.15, 0.08], [b0 + 0.06, 0.08]], lg(ctx, 0, -0.08, 0, 0.08, [[0, '#ff7a3a'], [0.5, '#c8141c'], [1, '#6a0408']]), 0.012);
  ctx.strokeStyle = `rgba(255,${200 + heat * 40},90,0.95)`; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(b0 + 0.1, 0); ctx.lineTo(L - 0.05, 0); ctx.stroke();
  ctx.lineWidth = 0.01; for (let x = b0 + 0.25; x < L - 0.2; x += 0.2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 0.1, -0.06); ctx.moveTo(x, 0); ctx.lineTo(x + 0.1, 0.06); ctx.stroke(); }
  // la guarda: alas de murciélago con una calavera en el medio
  for (const s of [-1, 1]) poly(ctx, [[0.12, s * 0.06], [0.05, s * 0.3], [0.2, s * 0.42], [0.08, s * 0.5], [-0.1, s * 0.38], [0.02, s * 0.28], [-0.04, s * 0.12]], lg(ctx, -0.1, 0, 0.2, 0, SILVER), 0.015);
  shade(ctx, () => ctx.ellipse(0.12, 0, 0.11, 0.1, 0, 0, TAU), '#e8dcc6', { x: 0.1, y: -0.03, r: 0.12, lw: 0.6 });
  ctx.fillStyle = '#ff3a1a'; for (const y of [-0.035, 0.035]) { ctx.beginPath(); ctx.arc(0.13, y, 0.022, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#1a0806'; ctx.fillRect(0.2, -0.035, 0.025, 0.07);
}

// ---------------------------------------------------------------- Pistola de fuego (caño de 0,55)
export function drawFirePistol(ctx: CanvasRenderingContext2D, t = 0, flash = 0) {
  // culata roja con adornos dorados
  shade(ctx, () => { ctx.moveTo(0.04, -0.05); ctx.lineTo(0.08, 0.06); ctx.quadraticCurveTo(-0.02, 0.2, -0.08, 0.3); ctx.lineTo(-0.2, 0.28); ctx.quadraticCurveTo(-0.16, 0.12, -0.12, -0.04); ctx.closePath(); }, '#b3141c', { x: -0.08, y: 0.05, r: 0.3, hi: 0.4, lw: 0.8 });
  poly(ctx, [[-0.22, 0.27], [-0.06, 0.29], [-0.08, 0.34], [-0.23, 0.33]], lg(ctx, 0, 0.27, 0, 0.34, GOLD), 0.012);
  ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.08, 0.02); ctx.quadraticCurveTo(-0.14, 0.12, -0.12, 0.22); ctx.stroke();
  ctx.strokeStyle = '#d9a030'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0.1, 0.08, 0.06, 0.2, Math.PI); ctx.stroke(); // guardamonte
  // cuerpo dorado, martillo y caño
  poly(ctx, [[-0.12, -0.08], [0.22, -0.1], [0.24, 0.06], [0.06, 0.06], [-0.1, 0.04]], lg(ctx, 0, -0.1, 0, 0.06, GOLD), 0.015);
  ctx.strokeStyle = '#e2a72e'; ctx.lineWidth = 0.03; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.04, -0.08); ctx.quadraticCurveTo(-0.06, -0.2, 0.02, -0.22); ctx.stroke(); // martillo
  ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(0.03, -0.22, 0.03, 0, TAU); ctx.fill();
  poly(ctx, [[0.2, -0.09], [0.6, -0.08], [0.6, 0.04], [0.2, 0.05]], lg(ctx, 0, -0.09, 0, 0.05, [[0, '#5a5a62'], [0.5, '#1c1c22'], [1, '#3a3a42']]), 0.015);
  poly(ctx, [[0.2, -0.1], [0.46, -0.1], [0.44, 0.08], [0.3, 0.1], [0.2, 0.06]], lg(ctx, 0, -0.1, 0, 0.1, GOLD), 0.015);
  ctx.save(); ctx.translate(0.33, -0.01); ctx.scale(0.09, 0.09); batSign(ctx, '#e3142a'); ctx.restore();
  poly(ctx, [[0.58, -0.12], [0.68, -0.12], [0.68, 0.08], [0.58, 0.08]], lg(ctx, 0.58, 0, 0.68, 0, GOLD), 0.015); // boca
  ctx.fillStyle = '#100808'; ctx.beginPath(); ctx.ellipse(0.68, -0.02, 0.02, 0.06, 0, 0, TAU); ctx.fill();
  poly(ctx, [[0.62, -0.12], [0.64, -0.19], [0.66, -0.12]], '#e2a72e', 0.01);
  if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.8, -0.02, 0.4 * flash + 0.2, '#ff8a20', flash); ctx.fillStyle = `rgba(255,230,140,${flash})`; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 0.05 : 0.22 * flash + 0.05; ctx.lineTo(0.78 + Math.cos(a) * r * 1.4, -0.02 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
  void t;
}

// ---------------------------------------------------------------- Íconos (para el cartel de las armas y el panel)
// Dibuja el arma centrada en (0, 0) cabiendo en un cuadrado de lado `size` (píxeles).
export function drawWeaponIcon(ctx: CanvasRenderingContext2D, w: string, size: number, t = 0, drawSword?: (ctx: CanvasRenderingContext2D) => void) {
  ctx.save();
  switch (w) {
    case 'sword': ctx.rotate(0.75); ctx.translate(0, size * 0.3); if (drawSword) { ctx.scale(size / 56, size / 56); drawSword(ctx); } break;
    case 'crossbow': ctx.scale(size / 1.75, size / 1.75); ctx.rotate(-0.55); ctx.translate(-0.32, 0.05); drawCrossbow(ctx, true, t); break;
    case 'garlic': ctx.translate(0, size * 0.1); drawGarlicBomb(ctx, size * 0.3, t); break;
    case 'cross': ctx.scale(size / 1.25, size / 1.25); ctx.translate(0, 0.42); ctx.rotate(-Math.PI / 2); drawHolyCross(ctx, t, 0.5); break;
    case 'firesword': ctx.scale(size / 2.4, size / 2.4); ctx.rotate(-0.78); ctx.translate(-0.62, 0); drawFireSword(ctx, t, 0.3); break;
    case 'pistol': ctx.scale(size / 1.0, size / 1.0); ctx.translate(-0.22, -0.06); drawFirePistol(ctx, t); break;
  }
  ctx.restore();
}
