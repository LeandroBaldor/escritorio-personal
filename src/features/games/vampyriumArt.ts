// El dibujo de Vampyrium. El mundo va en unidades (vampyrium.ts) y acá se pasa a píxeles: `s` píxeles por unidad,
// el borde de abajo de la pantalla es y = 0. Los personajes están en vampyriumChars.ts (al estilo de Kombat
// Football); acá el escenario, las trampas, las cajas, los huesos, la sangre y las chispas.
import { bodyFire, drawFlyerK, drawHunterK, drawSkeletonK, drawWalkerK } from './vampyriumChars';
import { DOOR, GAPS, GROUND_Y, H, PLAYER_H, SURFACES, TRAPS, W, trapState, BURN_AT, BLOW_AT, type Bone, type Corpse, type Crate, type Game, type Stake, type Vamp } from './vampyrium';

const TAU = Math.PI * 2;
const INK = '#07060a';
export interface View { s: number; ox: number; oy: number; w: number; h: number }
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;
export function viewFor(w: number, h: number): View {
  const s = Math.min(w / W, h / H);
  return { s, ox: (w - W * s) / 2, oy: h, w, h };
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- Ayudas de dibujo
function blob(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 3, path: () => void) {
  ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill();
  if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
const lin = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [a, c] of stops) g.addColorStop(a, c); return g; };

// ---------------------------------------------------------------- El cazador
function drawSword(ctx: CanvasRenderingContext2D) {
  // empuñadura hacia abajo en (0,0), la hoja va para "arriba" (y negativo)
  blob(ctx, '#3a2414', 2, () => ctx.roundRect(-2.6, -2, 5.2, 11, 2));
  blob(ctx, '#d6a032', 2, () => ctx.arc(0, 10, 3.2, 0, TAU));
  blob(ctx, lin(ctx, -10, 0, 10, 0, [[0, '#7a5414'], [0.5, '#f2c45a'], [1, '#7a5414']]), 2, () => ctx.roundRect(-10, -5, 20, 4.2, 2));
  blob(ctx, lin(ctx, -3, 0, 3, 0, [[0, '#9aa3b4'], [0.45, '#f4f7ff'], [0.55, '#c9d1e0'], [1, '#6d7586']]), 2, () => { ctx.moveTo(-3.4, -5); ctx.lineTo(-3.4, -40); ctx.lineTo(0, -47); ctx.lineTo(3.4, -40); ctx.lineTo(3.4, -5); ctx.closePath(); });
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -42); ctx.stroke();
}
function drawStakeItem(ctx: CanvasRenderingContext2D, len = 24) {
  blob(ctx, lin(ctx, -3, 0, 3, 0, [[0, '#6b4220'], [0.5, '#b07a45'], [1, '#5a3618']]), 2, () => { ctx.moveTo(-2.8, 6); ctx.lineTo(-2.8, -len + 7); ctx.lineTo(0, -len); ctx.lineTo(2.8, -len + 7); ctx.lineTo(2.8, 6); ctx.closePath(); });
  ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-2.4, 2 - i * 6); ctx.lineTo(2.4, 0 - i * 6); ctx.stroke(); }
}
// ---------------------------------------------------------------- Esqueleto, huesos y chispas
function bone(ctx: CanvasRenderingContext2D, len: number, w: number) {
  blob(ctx, '#f1ead8', 2, () => { ctx.roundRect(-len / 2, -w / 2, len, w, w / 2); });
  for (const sx of [-len / 2, len / 2]) blob(ctx, '#f1ead8', 2, () => { ctx.arc(sx, -w * 0.45, w * 0.55, 0, TAU); ctx.moveTo(sx + w * 0.55, w * 0.45); ctx.arc(sx, w * 0.45, w * 0.55, 0, TAU); });
}
function skull(ctx: CanvasRenderingContext2D, eyes: string) {
  blob(ctx, lin(ctx, -14, -14, 14, 14, [[0, '#fffaf0'], [1, '#cfc4ad']]), 2.5, () => { ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-16, -18, 0, -18); ctx.quadraticCurveTo(16, -18, 14, 2); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.closePath(); });
  ctx.fillStyle = eyes; for (const ex of [-5.5, 5.5]) { ctx.beginPath(); ctx.ellipse(ex, -3, 4, 4.6, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2a1e1a'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-1.8, 5); ctx.lineTo(1.8, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { ctx.fillRect(i * 3 - 1.2, 8, 2.4, 3.5); }
  // colmillos de vampiro
  ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-4.8, 14); ctx.lineTo(-3.6, 8); ctx.moveTo(3.6, 8); ctx.lineTo(4.8, 14); ctx.lineTo(6, 8); ctx.fill();
}
function ribs(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const [col, lw] of [[INK, 5.5], ['#f1ead8', 3]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke();
    for (let i = 0; i < 4; i++) { const y = -9 + i * 5.5, r = 11 - i * 1.2; ctx.beginPath(); ctx.ellipse(0, y + 2, r, 4, 0, Math.PI, TAU); ctx.stroke(); }
  }
}
function pelvis(ctx: CanvasRenderingContext2D) { blob(ctx, '#f1ead8', 2.2, () => { ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, -9, 11, -4); ctx.lineTo(7, 6); ctx.lineTo(2, 3); ctx.lineTo(-2, 3); ctx.lineTo(-7, 6); ctx.closePath(); }); }
function spine(ctx: CanvasRenderingContext2D) { for (let i = 0; i < 5; i++) blob(ctx, '#f1ead8', 1.6, () => ctx.roundRect(-3.5, -12 + i * 5, 7, 4, 1.5)); }
function jaw(ctx: CanvasRenderingContext2D) { blob(ctx, '#ece3cf', 2, () => { ctx.moveTo(-9, -2); ctx.lineTo(9, -2); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); }); ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 3 - 1, -4, 2, 2.5); }
export function drawBone(ctx: CanvasRenderingContext2D, b: Bone, v: View) {
  const k = PLAYER_H * 1.3 * v.s / 100, fade = Math.min(1, (3.4 - b.t) / 0.6);
  ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(X(v, b.x), Y(v, b.y)); ctx.scale(k, k); ctx.rotate(b.a);
  if (b.kind === 'skull') skull(ctx, b.t < 1.2 ? '#ff3a2a' : '#2a1e1a');
  else if (b.kind === 'jaw') jaw(ctx);
  else if (b.kind === 'ribs') ribs(ctx);
  else if (b.kind === 'spine') spine(ctx);
  else if (b.kind === 'pelvis') pelvis(ctx);
  else bone(ctx, b.kind === 'leg' ? 24 : 18, 4.2);
  ctx.restore();
  if (b.t < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; flame(ctx, X(v, b.x), Y(v, b.y), v.s * 0.16 * (1 - b.t), b.t * 9 + b.x, b.y); ctx.restore(); } // los huesos salen prendidos fuego
}
// El vampiro se vuelve esqueleto: la carne se desvanece, el esqueleto brilla y arde entero como una antorcha
// (como la gente que se prende fuego en "El piso es de lava"), grita y al segundo revienta.
export const CHAR_K = 1.05; // metros del personaje → unidades del mundo
export function drawCorpse(ctx: CanvasRenderingContext2D, c: Corpse, v: View, t: number) {
  const k = CHAR_K * v.s, f = Math.min(1, c.t / BURN_AT), burn = Math.max(0, Math.min(1, (c.t - BURN_AT) / (BLOW_AT - BURN_AT)));
  const fly = c.kind === 'flyer';
  ctx.save(); ctx.translate(X(v, c.x) + Math.sin(c.t * 90) * (0.4 + burn) * v.s * 0.05, Y(v, c.y) + (fly ? -v.s * 0.6 : 0)); ctx.scale(k * c.face, k);
  if (f < 1) {
    ctx.save(); ctx.globalAlpha = 1 - f;
    const fake: Vamp = { id: c.id, kind: c.kind, x: 0, y: 0, vx: 0, vy: 0, face: 1, state: 'claw', t: 0.4, onGround: !fly, surface: null, walkT: 0, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false };
    if (fly) drawFlyerK(ctx, fake, t); else drawWalkerK(ctx, fake, t);
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = f; ctx.translate(0, fly ? 0.4 : 0);
  if (burn > 0) { ctx.filter = 'none'; }
  drawSkeletonK(ctx, false, t, 1);
  if (burn > 0) { ctx.globalAlpha = 0.55 * burn; ctx.fillStyle = '#1a0a02'; ctx.beginPath(); ctx.ellipse(0.02, -1.0, 0.45, 1.05, 0, 0, TAU); ctx.globalCompositeOperation = 'source-atop'; ctx.fill(); }
  ctx.restore();
  if (burn > 0) {
    bodyFire(ctx, 2.0, 0.9, burn, t, c.id);
    if (Math.floor(c.t * 8) % 2) { // grita mientras arde
      ctx.save(); ctx.scale(c.face, 1); ctx.font = '900 0.34px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 0.06; ctx.strokeStyle = '#1a0606'; ctx.fillStyle = '#fef08a';
      ctx.strokeText('¡AAARGH!', 0, -2.55); ctx.fillText('¡AAARGH!', 0, -2.55); ctx.restore();
    }
  }
  ctx.restore();
}
export function drawBlood(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  for (const d of g.drops) {
    const x = X(v, d.x), y = Y(v, d.y), r = Math.max(1.2, d.r * v.s);
    if (d.stuck) { ctx.fillStyle = `rgba(120,0,10,${Math.min(0.85, (7 - d.t) / 2)})`; ctx.beginPath(); ctx.ellipse(x, y - 1, r * 1.6, r * 0.45, 0, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#b0101c'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.3, Math.atan2(-d.vy, d.vx) + Math.PI / 2, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,120,120,0.6)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill(); }
  }
}
export function drawSparks(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of g.sparks) {
    const a = 1 - s.t / s.life, x = X(v, s.x), y = Y(v, s.y), r = Math.max(1, v.s * 0.06 * (0.5 + a));
    ctx.strokeStyle = `hsla(${s.hue},100%,${60 + a * 30}%,${a})`; ctx.lineWidth = r; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * v.s * 0.02, y + s.vy * v.s * 0.02); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- El escenario (fondo, pisos, puerta)
let backdrop: HTMLImageElement | null = null;
let backdropReady = false;
export function setBackdrop(url: string, onLoad?: () => void) {
  if (typeof Image === 'undefined') return;
  if (backdrop && backdrop.src.endsWith(url)) return;
  backdrop = new Image(); backdropReady = false;
  backdrop.onload = () => { backdropReady = true; staticCache = null; onLoad?.(); };
  backdrop.src = url;
}
let staticCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function stoneBlocks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bw: number, bh: number, seed: number, base = [44, 40, 48]) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let r = 0; r * bh < h; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let c = -1; c * bw < w; c++) {
      const bx = x + c * bw + off, by = y + r * bh, n = hash(seed + r * 31 + c * 7), d = (n - 0.5) * 16;
      ctx.fillStyle = `rgb(${base[0] + d},${base[1] + d},${base[2] + d})`; ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx + 1, by + 1, bw - 2, Math.max(1, bh * 0.15));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + 1, by + bh - 1 - Math.max(1, bh * 0.15), bw - 2, Math.max(1, bh * 0.15));
      if (n > 0.86) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + bw * 0.3, by + 2); ctx.lineTo(bx + bw * 0.45, by + bh * 0.6); ctx.lineTo(bx + bw * 0.35, by + bh - 2); ctx.stroke(); }
    }
  }
  ctx.restore();
}
function paintStatic(ctx: CanvasRenderingContext2D, v: View) {
  // el fondo pintado (más oscuro para que se lean los pisos y los personajes)
  if (backdrop && backdropReady) {
    // sin la franja de abajo de la imagen (sus puentes pintados se confundían con los pisos de verdad)
    const iw = backdrop.naturalWidth, ih = backdrop.naturalHeight * 0.74, dh = Y(v, GROUND_Y) + v.s * 0.6, k = Math.max(v.w / iw, dh / ih);
    ctx.drawImage(backdrop, 0, 0, iw, ih, (v.w - iw * k) / 2, dh - ih * k, iw * k, ih * k);
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, dh, v.w, v.h - dh);
  } else { ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, '#0d1430'], [1, '#2a2440']]); ctx.fillRect(0, 0, v.w, v.h); }
  ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, 'rgba(6,8,22,0.25)'], [0.6, 'rgba(6,6,16,0.35)'], [1, 'rgba(4,2,8,0.55)']]); ctx.fillRect(0, 0, v.w, v.h);
  // el vacío de los huecos: niebla que sube desde abajo
  for (const [a, b] of GAPS) {
    const x1 = X(v, a), x2 = X(v, b);
    ctx.fillStyle = lin(ctx, 0, Y(v, GROUND_Y), 0, v.h, [[0, 'rgba(10,12,30,0)'], [0.5, 'rgba(10,10,26,0.75)'], [1, 'rgba(2,2,8,0.95)']]); ctx.fillRect(x1, Y(v, GROUND_Y), x2 - x1, v.h);
  }
  // el suelo de piedra (extendido a los costados de la pantalla)
  const gTop = Y(v, GROUND_Y), bw = v.s * 1.1, bh = v.s * 0.55;
  for (const s of SURFACES.filter(q => q.ground)) {
    const x1 = s.x1 <= 0 ? 0 : X(v, s.x1), x2 = s.x2 >= W ? v.w : X(v, s.x2);
    stoneBlocks(ctx, x1, gTop, x2 - x1, v.h - gTop, bw, bh, s.x1 * 13);
    // borde de arriba: piedras grandes con luz de las antorchas
    ctx.fillStyle = lin(ctx, 0, gTop - v.s * 0.12, 0, gTop + v.s * 0.35, [[0, '#8a6a52'], [0.3, '#5a4a48'], [1, '#2a2430']]); ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.4);
    ctx.fillStyle = 'rgba(255,170,90,0.18)'; ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.06);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, gTop - v.s * 0.08, x2 - x1, v.h);
    // arcos de puente debajo
    if (s.x2 - s.x1 > 5) for (let ax = s.x1 + 1.6; ax < s.x2 - 1.2; ax += 3.2) {
      const cx = X(v, ax + 0.8), top = gTop + v.s * 0.9, r = v.s * 0.75;
      ctx.fillStyle = 'rgba(4,4,10,0.75)'; ctx.beginPath(); ctx.moveTo(cx - r, v.h); ctx.lineTo(cx - r, top + r); ctx.arc(cx, top + r, r, Math.PI, 0); ctx.lineTo(cx + r, v.h); ctx.closePath(); ctx.fill();
    }
  }
  // plataformas: losas de piedra colgadas con cadenas
  for (const s of SURFACES.filter(q => !q.ground)) {
    const x1 = X(v, s.x1), x2 = X(v, s.x2), y = Y(v, s.y), th = v.s * 0.6;
    for (const cx of [s.x1 + 0.4, s.x2 - 0.4]) { // cadenas hacia arriba
      ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = Math.max(1.5, v.s * 0.07);
      for (let cy = y; cy > Math.max(0, y - v.s * 2.6); cy -= v.s * 0.32) { ctx.beginPath(); ctx.ellipse(X(v, cx), cy - v.s * 0.16, v.s * 0.07, v.s * 0.14, 0, 0, TAU); ctx.stroke(); }
    }
    stoneBlocks(ctx, x1, y, x2 - x1, th, v.s * 0.9, th / 2, s.x1 * 17 + s.y, [70, 58, 60]);
    ctx.fillStyle = lin(ctx, 0, y - v.s * 0.1, 0, y + v.s * 0.18, [[0, '#d0a070'], [0.4, '#8a6a52'], [1, '#4a3e42']]); ctx.fillRect(x1, y - v.s * 0.08, x2 - x1, v.s * 0.2);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, y - v.s * 0.08, x2 - x1, th + v.s * 0.08);
    // ménsulas de hierro
    ctx.fillStyle = '#26242c';
    for (const bx of [x1 + v.s * 0.3, x2 - v.s * 0.3]) { ctx.beginPath(); ctx.moveTo(bx - v.s * 0.2, y + th); ctx.lineTo(bx + v.s * 0.2, y + th); ctx.lineTo(bx, y + th + v.s * 0.45); ctx.closePath(); ctx.fill(); }
  }
  // la puerta: arco gótico de piedra
  const dx1 = X(v, DOOR.x1 - 0.35), dx2 = Math.max(X(v, DOOR.x2 + 0.35), v.w), dTop = Y(v, DOOR.y + DOOR.h + 0.9);
  stoneBlocks(ctx, dx1, dTop, dx2 - dx1, gTop - dTop, v.s * 0.7, v.s * 0.45, 99, [58, 52, 60]);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(dx1, dTop, dx2 - dx1, gTop - dTop);
}
// El hueco de la puerta (oscuro o con luz si está abierta) y la reja que sube.
function drawDoor(ctx: CanvasRenderingContext2D, g: Game, v: View, t: number) {
  const x1 = X(v, DOOR.x1), x2 = X(v, DOOR.x2), y0 = Y(v, DOOR.y), top = Y(v, DOOR.y + DOOR.h), mid = (x1 + x2) / 2, r = (x2 - x1) / 2;
  const path = () => { ctx.moveTo(x1, y0); ctx.lineTo(x1, top + r); ctx.quadraticCurveTo(x1, top - r * 0.4, mid, top - r); ctx.quadraticCurveTo(x2, top - r * 0.4, x2, top + r); ctx.lineTo(x2, y0); ctx.closePath(); };
  const open = g.door.open ? Math.min(1, g.door.t / 1.2) : 0;
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.fillStyle = open > 0 ? lin(ctx, 0, top, 0, y0, [[0, '#ffe2a0'], [1, '#ff9a3c']]) : '#0a080e'; ctx.fillRect(x1, top - r, x2 - x1, y0 - top + r);
  if (open > 0) glow(ctx, mid, (top + y0) / 2, v.s * 3, `rgba(255,220,140,${0.5 + 0.2 * Math.sin(t * 4)})`);
  // reja de hierro: sube cuando se abre
  const lift = open * (y0 - top + r);
  ctx.strokeStyle = '#1b1a20'; ctx.lineWidth = Math.max(2, v.s * 0.09);
  for (let i = 1; i < 6; i++) { const x = x1 + (x2 - x1) * i / 6; ctx.beginPath(); ctx.moveTo(x, top - r - lift); ctx.lineTo(x, y0 - lift); ctx.stroke(); }
  for (let j = 1; j < 5; j++) { const y = top + (y0 - top) * j / 5 - lift; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
  ctx.fillStyle = '#9aa0ad'; for (let i = 1; i < 6; i++) { const x = x1 + (x2 - x1) * i / 6; ctx.beginPath(); ctx.moveTo(x - v.s * 0.07, y0 - lift); ctx.lineTo(x, y0 - lift + v.s * 0.18); ctx.lineTo(x + v.s * 0.07, y0 - lift); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); path(); ctx.lineWidth = Math.max(3, v.s * 0.1); ctx.strokeStyle = INK; ctx.stroke();
  // cartel arriba: calavera (cerrada) o flecha "SALIDA" (abierta)
  const sy = top - r - v.s * 0.55;
  ctx.font = `900 ${Math.max(10, v.s * 0.42)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (open > 0) { ctx.fillStyle = `rgba(255,230,150,${0.7 + 0.3 * Math.sin(t * 6)})`; ctx.fillText('SALIDA ▶', mid - v.s * 0.3, sy); }
  else { ctx.fillStyle = '#c9c2b5'; ctx.fillText(`🔒 ${Math.max(0, 50 - g.total)}`, mid - v.s * 0.2, sy); }
}
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number) {
  const f = 0.85 + 0.15 * Math.sin(t * 13 + seed) + 0.1 * Math.sin(t * 29 + seed * 2);
  glow(ctx, x, y - size * 0.6, size * 3.2, 'rgba(255,140,40,0.35)');
  for (const [k, col] of [[1, '#ff5a14'], [0.72, '#ffa424'], [0.42, '#fff1a8']] as const) {
    const hgt = size * 1.9 * f * k, wd = size * 0.62 * k;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - wd, y);
    ctx.quadraticCurveTo(x - wd * 1.1, y - hgt * 0.5, x + Math.sin(t * 9 + seed) * wd * 0.4, y - hgt);
    ctx.quadraticCurveTo(x + wd * 1.1, y - hgt * 0.5, x + wd, y); ctx.closePath(); ctx.fill();
  }
}
// Antorchas en las plataformas y el suelo (decoración, con fuego animado).
const TORCHES: [number, number][] = [[1.2, GROUND_Y], [12.2, 6.6], [16, 6.6], [7.4, 9.9], [21, 9.9], [14, 13], [25.4, 6.6], [6.5, GROUND_Y]];
function drawTorches(ctx: CanvasRenderingContext2D, v: View, t: number) {
  TORCHES.forEach(([x, y], i) => {
    const px = X(v, x), py = Y(v, y), s = v.s;
    ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(px - s * 0.05, py); ctx.lineTo(px - s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.16, py - s * 1.12); ctx.lineTo(px - s * 0.16, py - s * 1.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    flame(ctx, px, py - s * 1.1, s * 0.22, t, i * 3.1);
  });
}

// ---------------------------------------------------------------- Trampas
function drawTraps(ctx: CanvasRenderingContext2D, g: Game, v: View, t: number) {
  for (const tr of TRAPS) {
    const st = trapState(tr, g.time);
    if (tr.kind === 'spikes') {
      const x1 = X(v, tr.x), x2 = X(v, tr.x2), y = Y(v, tr.y), n = 6, wd = (x2 - x1) / n, jit = st.warn ? Math.sin(t * 60) * v.s * 0.03 : 0;
      ctx.fillStyle = '#121016'; ctx.fillRect(x1, y - v.s * 0.04, x2 - x1, v.s * 0.12); // la ranura en el piso
      if (st.warn) glow(ctx, (x1 + x2) / 2, y, v.s * 1.2, 'rgba(255,60,40,0.35)');
      const hgt = v.s * 0.95 * st.on;
      if (hgt > 1) for (let i = 0; i < n; i++) {
        const bx = x1 + wd * i + jit;
        ctx.fillStyle = lin(ctx, bx, 0, bx + wd, 0, [[0, '#5d5f6b'], [0.5, '#e4e7ef'], [1, '#6b6d78']]);
        ctx.beginPath(); ctx.moveTo(bx + wd * 0.1, y); ctx.lineTo(bx + wd / 2, y - hgt); ctx.lineTo(bx + wd * 0.9, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(150,20,20,0.7)'; ctx.beginPath(); ctx.moveTo(bx + wd * 0.42, y - hgt * 0.7); ctx.lineTo(bx + wd / 2, y - hgt); ctx.lineTo(bx + wd * 0.58, y - hgt * 0.7); ctx.fill();
      }
    } else if (tr.kind === 'pendulum') {
      const px = X(v, tr.x), py = Y(v, tr.y), tx = X(v, st.tipX), ty = Y(v, st.tipY);
      ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(3, v.s * 0.12); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#4c4a55'; ctx.lineWidth = Math.max(1, v.s * 0.04); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      // hoja de hacha en media luna
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(-st.a); const R = v.s * 0.95;
      ctx.fillStyle = lin(ctx, -R, 0, R, 0, [[0, '#6b6e7a'], [0.5, '#eef1f8'], [1, '#6b6e7a']]);
      ctx.beginPath(); ctx.moveTo(-R, -R * 0.15); ctx.quadraticCurveTo(0, R * 1.15, R, -R * 0.15); ctx.quadraticCurveTo(0, R * 0.35, -R, -R * 0.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.stroke();
      ctx.fillStyle = 'rgba(140,10,16,0.75)'; ctx.beginPath(); ctx.ellipse(R * 0.35, R * 0.42, R * 0.18, R * 0.08, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#26242c'; ctx.beginPath(); ctx.arc(0, 0, v.s * 0.16, 0, TAU); ctx.fill();
      ctx.restore();
      // la viga de donde cuelga
      ctx.fillStyle = '#3a2a1e'; ctx.fillRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35);
    } else {
      const x = X(v, tr.x), y = Y(v, tr.y), s = v.s;
      // brasero de hierro
      ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x - s * 0.15, y); ctx.lineTo(x - s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.15, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.32, y - s * 0.85); ctx.lineTo(x - s * 0.32, y - s * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.12, y - s * 0.85); ctx.lineTo(x + i * s * 0.14, y - s * 1.0); ctx.stroke(); }
      flame(ctx, x, y - s * 0.85, s * (st.warn ? 0.32 : 0.22), t, 7);
      if (st.warn) for (let i = 0; i < 4; i++) { const k = (t * 2 + i / 4) % 1; ctx.fillStyle = `rgba(255,180,60,${1 - k})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 9 + t * 5) * s * 0.3, y - s * (0.9 + k * 1.4), s * 0.05, 0, TAU); ctx.fill(); }
      if (st.on > 0) { // la llamarada
        const hgt = tr.len * st.on * s;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y - hgt * 0.5, hgt * 0.8, 'rgba(255,120,30,0.5)');
        for (const [k, col] of [[1, 'rgba(255,80,20,0.9)'], [0.7, 'rgba(255,170,40,0.9)'], [0.4, 'rgba(255,245,180,0.95)']] as const) {
          const wd = s * 0.55 * k;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - wd, y - s * 0.85);
          for (let j = 0; j <= 6; j++) { const yy = y - s * 0.85 - hgt * k * j / 6, ww = wd * (1 - j / 7) * (1 + 0.25 * Math.sin(t * 20 + j * 2)); ctx.lineTo(x - ww, yy); }
          for (let j = 6; j >= 0; j--) { const yy = y - s * 0.85 - hgt * k * j / 6, ww = wd * (1 - j / 7) * (1 + 0.25 * Math.sin(t * 17 + j * 3)); ctx.lineTo(x + ww, yy); }
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------- Cajas y estacas
function drawCrate(ctx: CanvasRenderingContext2D, c: Crate, v: View, t: number) {
  const s = v.s, x = X(v, c.x), y = Y(v, c.y), sz = s * 0.95, sway = c.landed ? 0 : Math.sin(c.t * 2.2) * 0.12;
  const blink = c.landed && c.t > 13 ? (Math.sin(c.t * 18) > 0 ? 0.35 : 1) : 1;
  ctx.save(); ctx.globalAlpha = blink; ctx.translate(x, y); ctx.rotate(sway);
  if (!c.landed) { // el paracaídas
    const cy = -sz - s * 1.6;
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 1; for (const k of [-1, -0.4, 0.4, 1]) { ctx.beginPath(); ctx.moveTo(k * sz * 0.48, -sz); ctx.lineTo(k * s * 0.95, cy); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#e9e2d0' : '#b3121b'; ctx.beginPath(); ctx.moveTo(0, cy - s * 0.75); ctx.arc(0, cy, s * 1.0, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, cy, s * 1.0, Math.PI, TAU); ctx.closePath(); ctx.stroke();
  }
  if (c.landed) glow(ctx, 0, -sz / 2, s * 1.3, c.kind === 'heart' ? 'rgba(255,70,90,0.35)' : c.kind === 'garlic' ? 'rgba(220,255,220,0.35)' : 'rgba(255,210,120,0.35)', 0.6 + 0.4 * Math.sin(t * 5));
  ctx.fillStyle = lin(ctx, -sz / 2, 0, sz / 2, 0, [[0, '#7a4a24'], [0.5, '#a8703c'], [1, '#6b3f1d']]); ctx.fillRect(-sz / 2, -sz, sz, sz);
  ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = Math.max(1, s * 0.04); for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-sz / 2, -sz + sz * i / 3); ctx.lineTo(sz / 2, -sz + sz * i / 3); ctx.stroke(); }
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.beginPath(); ctx.moveTo(-sz / 2, -sz); ctx.lineTo(sz / 2, 0); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeRect(-sz / 2, -sz, sz, sz);
  // el ícono de lo que trae
  ctx.save(); ctx.translate(0, -sz / 2); const k = s / 40;
  ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.32, 0, TAU); ctx.fill();
  if (c.kind === 'stakes') { ctx.scale(k * 0.8, k * 0.8); ctx.rotate(0.6); drawStakeItem(ctx, 26); ctx.rotate(-1.2); drawStakeItem(ctx, 26); }
  else if (c.kind === 'heart') { ctx.scale(k, k); ctx.fillStyle = '#ff3b4f'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.fill(); }
  else { ctx.scale(k, k); ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(12, 0, 6, 8); ctx.lineTo(-6, 8); ctx.quadraticCurveTo(-12, 0, 0, -12); ctx.fill(); ctx.strokeStyle = '#c8c0a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 8); ctx.moveTo(-4, -4); ctx.quadraticCurveTo(-5, 4, -3, 8); ctx.moveTo(4, -4); ctx.quadraticCurveTo(5, 4, 3, 8); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
function drawStake(ctx: CanvasRenderingContext2D, s: Stake, v: View) {
  const k = v.s / 40, a = Math.atan2(-s.vy, s.vx) + Math.PI / 2;
  ctx.save(); ctx.globalAlpha = s.stuck ? Math.max(0, 1 - s.t / 1.5) : 1; ctx.translate(X(v, s.x), Y(v, s.y)); ctx.rotate(s.stuck ? Math.PI / 2 * Math.sign(s.vx) + 0.4 * Math.sign(s.vx) : a); ctx.scale(k, k);
  if (!s.stuck) { ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 30); ctx.stroke(); }
  drawStakeItem(ctx, 26);
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export function drawGame(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, t: number) {
  const v = viewFor(w, h);
  const key = `${w}x${h}`;
  if (!staticCache || staticCache.key !== key) {
    const c = staticCache?.canvas ?? document.createElement('canvas');
    c.width = w; c.height = h; const sc = c.getContext('2d');
    if (sc) paintStatic(sc, v);
    staticCache = { key, canvas: c };
  }
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * v.s * 0.4, (Math.random() - 0.5) * g.shake * v.s * 0.4);
  ctx.drawImage(staticCache.canvas, 0, 0);
  // luna de sangre: todo se tiñe de rojo
  if (g.bloodMoon) { ctx.fillStyle = `rgba(150,0,20,${0.16 + 0.04 * Math.sin(t)})`; ctx.fillRect(0, 0, w, h); }
  // relámpago cada tanto
  const bolt = (t * 0.13 + 0.37) % 1; if (bolt < 0.012) { ctx.fillStyle = `rgba(200,210,255,${0.25 * (1 - bolt / 0.012)})`; ctx.fillRect(0, 0, w, h); }
  // murciélagos que pasan lejos
  ctx.fillStyle = 'rgba(8,6,14,0.8)';
  for (let i = 0; i < 6; i++) { const bx = ((t * (0.6 + hash(i) * 0.5) * v.s + hash(i + 3) * w * 2) % (w + 200)) - 100, by = h * (0.12 + hash(i + 9) * 0.3) + Math.sin(t * 3 + i) * v.s * 0.4, fl = Math.sin(t * 14 + i * 2) * v.s * 0.12, sz = v.s * (0.18 + hash(i + 1) * 0.12); ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - sz, by - sz - fl, bx - sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx - sz, by, bx, by + sz * 0.3); ctx.quadraticCurveTo(bx + sz, by, bx + sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx + sz, by - sz - fl, bx, by); ctx.fill(); }
  // niebla que sube de los huecos
  for (const [a, b] of GAPS) for (let i = 0; i < 4; i++) {
    const k = (t * 0.25 + i / 4) % 1, x = X(v, a + (b - a) * (0.2 + hash(i + a) * 0.6)) + Math.sin(t + i) * v.s * 0.3, y = Y(v, GROUND_Y - 2 + k * 3);
    glow(ctx, x, y, v.s * (1 + k), `rgba(170,180,220,${0.22 * Math.sin(k * Math.PI)})`);
  }
  drawTorches(ctx, v, t);
  drawDoor(ctx, g, v, t);
  drawTraps(ctx, g, v, t);
  for (const c of g.crates) drawCrate(ctx, c, v, t);
  drawBlood(ctx, g, v);
  for (const b of g.bones) drawBone(ctx, b, v);
  for (const c of g.corpses) drawCorpse(ctx, c, v, t);
  // vampiros
  for (const vp of g.vamps) {
    const k = CHAR_K * v.s;
    ctx.save(); ctx.translate(X(v, vp.x), Y(v, vp.y)); ctx.scale(k * vp.face, k);
    if (vp.kind === 'walker') drawWalkerK(ctx, vp, t); else drawFlyerK(ctx, vp, t);
    ctx.restore();
  }
  // el ajo: un halo verde blanco que los espanta
  const p = g.player;
  if (g.garlicT > 0) glow(ctx, X(v, p.x), Y(v, p.y + 1), v.s * 4.5, `rgba(210,255,200,${0.25 * Math.min(1, g.garlicT)})`);
  // el cazador (parpadea mientras es invulnerable)
  if (g.phase !== 'dead' || g.phaseT < 0.2) {
    const blink = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
    ctx.save(); ctx.globalAlpha = blink ? 0.35 : 1; ctx.translate(X(v, p.x), Y(v, p.y)); const k = CHAR_K * v.s; ctx.scale(k * p.face, k);
    if (g.phase === 'cleared') ctx.globalAlpha = Math.max(0, 1 - g.phaseT / 1.6);
    drawHunterK(ctx, p, g, t); ctx.restore();
  }
  for (const s of g.stakes) drawStake(ctx, s, v);
  drawSparks(ctx, g, v);
  // la luz sagrada de la cruz
  if (g.holyT > 0) {
    const k = g.holyT / 1.4, x = X(v, p.x), y = Y(v, p.y + 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, v.s * (4 + (1 - k) * 22), `rgba(255,236,170,${0.8 * k})`);
    ctx.strokeStyle = `rgba(255,245,210,${0.7 * k})`; ctx.lineWidth = v.s * 0.5 * k;
    ctx.beginPath(); ctx.moveTo(x, y - v.s * 30); ctx.lineTo(x, y + v.s * 30); ctx.moveTo(x - v.s * 18, y - v.s * 2); ctx.lineTo(x + v.s * 18, y - v.s * 2); ctx.stroke();
    ctx.restore();
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${g.flash * 0.6})`; ctx.fillRect(0, 0, w, h); }
  // viñeta
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (g.phase === 'dead') { ctx.fillStyle = `rgba(120,0,10,${Math.min(0.5, g.phaseT * 0.4)})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
// Para el cartel de las armas: el cazador o un vampiro sueltos en un lienzo (pies en x, y; size = píxeles por metro).
export function drawPortrait(ctx: CanvasRenderingContext2D, who: 'hunter' | 'walker' | 'flyer', g: Game, x: number, y: number, size: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  if (who === 'hunter') drawHunterK(ctx, g.player, g, t);
  else { const fake: Vamp = { id: 1, kind: who, x: 0, y: 0, vx: 0, vy: 0, face: 1, state: who === 'flyer' ? 'hover' : 'walk', t: 0, onGround: true, surface: null, walkT: t, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false }; if (who === 'walker') drawWalkerK(ctx, fake, t); else drawFlyerK(ctx, fake, t); }
  ctx.restore();
}
export { drawSword as drawSwordIcon, drawStakeItem as drawStakeIcon };
