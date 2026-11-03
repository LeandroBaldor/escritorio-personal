// El dibujo de Vampyrium. El mundo va en unidades (vampyrium.ts) y acá se pasa a píxeles: `s` píxeles por unidad,
// el borde de abajo de la pantalla es y = 0. Los personajes están en vampyriumChars.ts (al estilo de Kombat
// Football); acá el escenario, las trampas, las cajas, los huesos, la sangre y las chispas.
import { bodyFire, drawHunterK, drawSkeletonK, sword } from './vampyriumChars';
import { drawShotK, drawVampK } from './vampyriumMonsters';
import { setVampTexture } from './vampyriumVamps';
import { BODY, goalProgress, type Breakable, type Item, DOOR, GAPS, GROUND_Y, H, LV, PLAYER_H, isBoss, ROLL_R, SAW_R, SURFACES, TRAPS, W, trapState, type Surface, type Trap, BURN_AT, BLOW_AT, type Bone, type Corpse, type Crate, type Game, type Bolt, type Bomb, type Bullet, type Fx, type Vamp, type VampKind, type Storm, SPECIAL_TIME, SPIN_R, WHIRL_R } from './vampyrium';
import { drawBolt, drawGarlicBomb, drawWeaponIcon } from './vampyriumWeapons';

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
export function drawCorpse(ctx: CanvasRenderingContext2D, c: Corpse, v: View, t: number, g?: Game) {
  const B = BODY[c.kind], k = CHAR_K * v.s * B.k, f = Math.min(1, c.t / BURN_AT), burn = Math.max(0, Math.min(1, (c.t - BURN_AT) / (BLOW_AT - BURN_AT)));
  const fly = c.kind === 'flyer', dragon = c.kind === 'dragon';
  const fake: Vamp = { id: c.id, kind: c.kind, x: 0, y: 0, vx: 0, vy: 0, face: 1, state: c.kind === 'dragon' ? 'hover' : 'claw', t: 0.4, onGround: !fly && !dragon, surface: null, walkT: 0, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false };
  if (c.kind === 'dracula') { // se está convirtiendo en dragón: tiembla, se pone rojo, lo rodean murciélagos y crece
    const q = g ? 1 - Math.max(0, g.transformT) / 2.4 : 0;
    ctx.save(); ctx.translate(X(v, c.x) + Math.sin(t * 70) * v.s * 0.06 * q, Y(v, c.y)); ctx.scale(k * c.face * (1 + q * 0.6), k * (1 + q * 0.6));
    drawVampK(ctx, { ...fake, state: 'cast', t: 0.6 }, t);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -1.1, 1.5 + q * 2.5, `rgba(255,30,40,${0.3 + q * 0.5})`);
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(X(v, c.x) + Math.sin(c.t * 90) * (0.4 + burn) * v.s * 0.05, Y(v, c.y) + (fly ? -v.s * 0.6 : 0)); ctx.scale(k * c.face, k);
  if (f < 1 || dragon) {
    ctx.save(); ctx.globalAlpha = dragon ? Math.max(0, 1 - burn) : 1 - f;
    drawVampK(ctx, fake, t);
    ctx.restore();
  }
  if (!dragon) {
    ctx.save(); ctx.globalAlpha = f; ctx.translate(0, fly ? 0.4 : 0);
    drawSkeletonK(ctx, false, t, 1);
    if (burn > 0) { ctx.globalAlpha = 0.55 * burn; ctx.fillStyle = '#1a0a02'; ctx.beginPath(); ctx.ellipse(0.02, -1.0, 0.45, 1.05, 0, 0, TAU); ctx.globalCompositeOperation = 'source-atop'; ctx.fill(); }
    ctx.restore();
  }
  if (burn > 0) {
    if (dragon) { ctx.save(); ctx.translate(0, 1.2); bodyFire(ctx, 2.6, 3.2, burn, t, c.id); ctx.restore(); } else bodyFire(ctx, 2.0, 0.9, burn, t, c.id);
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
    const iw = backdrop.naturalWidth, ih = backdrop.naturalHeight * LV.def.crop, dh = Y(v, GROUND_Y) + v.s * 0.6, k = Math.max(v.w / iw, dh / ih);
    ctx.drawImage(backdrop, 0, 0, iw, ih, (v.w - iw * k) / 2, dh - ih * k, iw * k, ih * k);
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, dh, v.w, v.h - dh);
  } else { ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, '#0d1430'], [1, '#2a2440']]); ctx.fillRect(0, 0, v.w, v.h); }
  ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, 'rgba(6,8,22,0.25)'], [0.6, 'rgba(6,6,16,0.35)'], [1, 'rgba(4,2,8,0.55)']]); ctx.fillRect(0, 0, v.w, v.h);
  // los huecos: el vacío con niebla (o una fosa); los líquidos se dibujan en cada cuadro
  for (const [a, b] of GAPS) {
    const x1 = X(v, a), x2 = X(v, b), pit = LV.def.pit;
    ctx.fillStyle = lin(ctx, 0, Y(v, GROUND_Y), 0, v.h, [[0, 'rgba(10,12,30,0)'], [0.5, 'rgba(10,10,26,0.75)'], [1, 'rgba(2,2,8,0.95)']]); ctx.fillRect(x1, Y(v, GROUND_Y), x2 - x1, v.h);
    if (pit === 'grave') { ctx.fillStyle = lin(ctx, 0, Y(v, GROUND_Y), 0, v.h, [[0, '#2a1d14'], [1, '#0a0705']]); ctx.fillRect(x1, Y(v, GROUND_Y - 0.4), x2 - x1, v.h); for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(${70 + hash(i + a) * 30},${50 + hash(i) * 20},30,0.8)`; ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * hash(i * 3 + a), Y(v, GROUND_Y - 0.6 - hash(i + 7) * 2), v.s * 0.12, 0, TAU); ctx.fill(); } }
    if (pit === 'bones') { // fosa llena de huesos con lanzas de hueso
      const by = Y(v, 0.8);
      ctx.fillStyle = '#2b2018'; ctx.fillRect(x1, by, x2 - x1, v.h - by);
      for (let i = 0; i < 26; i++) { const bx = x1 + (x2 - x1) * hash(i * 1.7 + a), yy = by - v.s * 0.15 * hash(i + 3); ctx.save(); ctx.translate(bx, yy); ctx.rotate(hash(i + 9) * 6); ctx.fillStyle = '#d9cfb4'; ctx.fillRect(-v.s * 0.22, -v.s * 0.04, v.s * 0.44, v.s * 0.08); ctx.beginPath(); ctx.arc(-v.s * 0.22, 0, v.s * 0.06, 0, TAU); ctx.arc(v.s * 0.22, 0, v.s * 0.06, 0, TAU); ctx.fill(); ctx.restore(); }
      for (let i = 0; i < 6; i++) { const sx = x1 + (x2 - x1) * (i + 0.5) / 6; ctx.fillStyle = lin(ctx, sx - v.s * 0.1, 0, sx + v.s * 0.1, 0, [[0, '#9c8f74'], [0.5, '#f1e7cf'], [1, '#8a7d62']]); ctx.beginPath(); ctx.moveTo(sx - v.s * 0.12, by); ctx.lineTo(sx, by - v.s * 1.3); ctx.lineTo(sx + v.s * 0.12, by); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
  }
  // el suelo de piedra (extendido a los costados de la pantalla)
  const gTop = Y(v, GROUND_Y), bw = v.s * 1.1, bh = v.s * 0.55;
  for (const s of SURFACES.filter(q => q.ground)) {
    const x1 = s.x1 <= 0 ? 0 : X(v, s.x1), x2 = s.x2 >= W ? v.w : X(v, s.x2);
    stoneBlocks(ctx, x1, gTop, x2 - x1, v.h - gTop, bw, bh, s.x1 * 13 + LV.def.n * 7, LV.def.stone);
    // borde de arriba: piedras grandes con luz de las antorchas
    ctx.fillStyle = lin(ctx, 0, gTop - v.s * 0.12, 0, gTop + v.s * 0.35, [[0, LV.def.cap], [0.3, '#5a4a48'], [1, '#2a2430']]); ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.4);
    ctx.fillStyle = 'rgba(255,170,90,0.18)'; ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.06);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, gTop - v.s * 0.08, x2 - x1, v.h);
    // arcos de puente debajo
    if (s.x2 - s.x1 > 5) for (let ax = s.x1 + 1.6; ax < s.x2 - 1.2; ax += 3.2) {
      const cx = X(v, ax + 0.8), top = gTop + v.s * 0.9, r = v.s * 0.75;
      ctx.fillStyle = 'rgba(4,4,10,0.75)'; ctx.beginPath(); ctx.moveTo(cx - r, v.h); ctx.lineTo(cx - r, top + r); ctx.arc(cx, top + r, r, Math.PI, 0); ctx.lineTo(cx + r, v.h); ctx.closePath(); ctx.fill();
    }
  }
  for (const q of SURFACES) if (!q.ground && !q.mv) drawPlatform(ctx, v, q); // (las que se mueven, en cada cuadro)
  // la puerta: arco gótico de piedra
  const dx1 = X(v, DOOR.x1 - 0.35), dx2 = Math.max(X(v, DOOR.x2 + 0.35), v.w), dTop = Y(v, DOOR.y + DOOR.h + 0.9);
  stoneBlocks(ctx, dx1, dTop, dx2 - dx1, gTop - dTop, v.s * 0.7, v.s * 0.45, 99, [58, 52, 60]);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(dx1, dTop, dx2 - dx1, gTop - dTop);
}
// Plataforma: losa de piedra colgada con cadenas.
function drawPlatform(ctx: CanvasRenderingContext2D, v: View, s: Surface) {
  const x1 = X(v, s.x1), x2 = X(v, s.x2), y = Y(v, s.y), th = v.s * 0.6;
  for (const cx of [s.x1 + 0.4, s.x2 - 0.4]) { // cadenas hacia arriba (hasta el techo)
    ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = Math.max(1.5, v.s * 0.07);
    for (let cy = y; cy > 0; cy -= v.s * 0.32) { ctx.beginPath(); ctx.ellipse(X(v, cx), cy - v.s * 0.16, v.s * 0.07, v.s * 0.14, 0, 0, TAU); ctx.stroke(); }
  }
  const st = LV.def.stone;
  stoneBlocks(ctx, x1, y, x2 - x1, th, v.s * 0.9, th / 2, (s.bx1 ?? s.x1) * 17 + (s.by ?? s.y), [st[0] + 22, st[1] + 18, st[2] + 14]);
  ctx.fillStyle = lin(ctx, 0, y - v.s * 0.1, 0, y + v.s * 0.18, [[0, LV.def.cap], [0.5, '#6a5650'], [1, '#3a3036']]); ctx.fillRect(x1, y - v.s * 0.08, x2 - x1, v.s * 0.2);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, y - v.s * 0.08, x2 - x1, th + v.s * 0.08);
  ctx.fillStyle = '#26242c';
  for (const bx of [x1 + v.s * 0.3, x2 - v.s * 0.3]) { ctx.beginPath(); ctx.moveTo(bx - v.s * 0.2, y + th); ctx.lineTo(bx + v.s * 0.2, y + th); ctx.lineTo(bx, y + th + v.s * 0.45); ctx.closePath(); ctx.fill(); }
  if (s.mv) { ctx.fillStyle = 'rgba(255,220,140,0.35)'; for (const bx of [x1 + v.s * 0.4, x2 - v.s * 0.4]) { ctx.beginPath(); ctx.arc(bx, y + th * 0.5, v.s * 0.08, 0, TAU); ctx.fill(); } } // engranajes de las que se mueven
}
// Los pozos de líquido (ácido, lava, sangre o fuego), con olas, burbujas y resplandor.
const PIT_COLORS: Record<string, [string, string, string]> = { acid: ['#b8ff5a', '#2fa52f', '#0a3a12'], lava: ['#ffd36b', '#ff6a14', '#5a1205'], blood: ['#ff6b6b', '#b0101c', '#3a0206'], fire: ['#fff1a8', '#ff7a1a', '#4a0a02'] };
function drawPits(ctx: CanvasRenderingContext2D, v: View, t: number) {
  const c = PIT_COLORS[LV.def.pit]; if (!c) return;
  for (const [a, b] of GAPS) {
    const x1 = X(v, a), x2 = X(v, b), top = Y(v, 1.4);
    ctx.beginPath(); ctx.moveTo(x1, v.h); ctx.lineTo(x1, top);
    for (let i = 0; i <= 12; i++) { const x = x1 + (x2 - x1) * i / 12; ctx.lineTo(x, top + Math.sin(t * 3 + i * 1.3 + a) * v.s * 0.07); }
    ctx.lineTo(x2, v.h); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, top, 0, v.h, [[0, c[0]], [0.15, c[1]], [1, c[2]]]); ctx.fill();
    glow(ctx, (x1 + x2) / 2, top, v.s * 2.4, c[1] + '88');
    for (let i = 0; i < 5; i++) { const k = (t * 0.8 + i / 5 + hash(i + a)) % 1, bx = x1 + (x2 - x1) * hash(i * 7 + a); ctx.fillStyle = c[0]; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(bx, top - k * v.s * 0.4, v.s * (0.05 + 0.06 * k), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (LV.def.pit === 'fire') for (let i = 0; i < 6; i++) flame(ctx, x1 + (x2 - x1) * (i + 0.5) / 6, top + v.s * 0.1, v.s * 0.32, t, i + a);
  }
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
  else if (g.goal.type !== 'boss') { // cuánto falta para la meta del nivel
    const left = Math.max(0, g.goal.n - goalProgress(g)), icon = ({ kill: '🧛', collect: g.goal.type === 'collect' && g.goal.item === 'soul' ? '👻' : '⭐', break: g.goal.type === 'break' && g.goal.obj === 'cage' ? '⛓' : '⚰', survive: '⏳', hunt: g.goal.type === 'hunt' && g.goal.kind === 'flyer' ? '🦇' : '🛡', boss: '' } as Record<string, string>)[g.goal.type];
    ctx.fillStyle = '#c9c2b5'; ctx.fillText(`🔒 ${left}${g.goal.type === 'survive' ? 's' : ''} ${icon}`, mid - v.s * 0.2, sy);
  }
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
// Antorchas: una al principio del suelo y una en cada plataforma quieta, salteando.
const torches = (): [number, number][] => [[1.2, GROUND_Y], ...SURFACES.filter(q => !q.ground && !q.mv).filter((_, i) => i % 2 === 0).map(q => [q.x1 + 0.5, q.y] as [number, number])];
function drawTorches(ctx: CanvasRenderingContext2D, v: View, t: number) {
  torches().forEach(([x, y], i) => {
    const px = X(v, x), py = Y(v, y), s = v.s;
    ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(px - s * 0.05, py); ctx.lineTo(px - s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.16, py - s * 1.12); ctx.lineTo(px - s * 0.16, py - s * 1.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    flame(ctx, px, py - s * 1.1, s * 0.22, t, i * 3.1);
  });
}

// ---------------------------------------------------------------- Trampas (cada nivel con las suyas)
const steel = (ctx: CanvasRenderingContext2D, x0: number, x1: number) => lin(ctx, x0, 0, x1, 0, [[0, '#5d5f6b'], [0.5, '#e4e7ef'], [1, '#6b6d78']]);
function chainTo(ctx: CanvasRenderingContext2D, v: View, x: number, y0: number, y1: number) {
  ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(1.5, v.s * 0.06);
  for (let y = y0; y < y1; y += v.s * 0.3) { ctx.beginPath(); ctx.ellipse(x, y + v.s * 0.15, v.s * 0.06, v.s * 0.13, 0, 0, TAU); ctx.stroke(); }
}
function drawSpikes(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View, t: number) {
  const x1 = X(v, tr.x), x2 = X(v, tr.x2), y = Y(v, tr.y), n = Math.max(4, Math.round((tr.x2 - tr.x) / 0.3)), wd = (x2 - x1) / n, jit = st.warn ? Math.sin(t * 60) * v.s * 0.03 : 0, style = tr.style ?? 'iron';
  ctx.fillStyle = style === 'thorn' ? '#1d2a14' : style === 'hands' ? '#2a1d14' : '#121016'; ctx.fillRect(x1, y - v.s * 0.04, x2 - x1, v.s * 0.12);
  if (st.warn) glow(ctx, (x1 + x2) / 2, y, v.s * 1.2, style === 'hands' ? 'rgba(120,255,150,0.3)' : 'rgba(255,60,40,0.35)');
  const hgt = v.s * (style === 'hands' ? 1.15 : 0.95) * st.on;
  if (hgt < 1) return;
  for (let i = 0; i < n; i++) {
    const bx = x1 + wd * i + jit, mid = bx + wd / 2, hh = hgt * (0.8 + 0.2 * hash(i + tr.x));
    if (style === 'hands') { // manos de muertos que salen de la tierra
      if (i % 2) continue;
      ctx.save(); ctx.translate(mid, y); ctx.rotate(Math.sin(t * 6 + i) * 0.15);
      ctx.fillStyle = '#7d8a6a'; ctx.fillRect(-wd * 0.3, -hh, wd * 0.6, hh);
      ctx.fillStyle = '#95a27f'; ctx.beginPath(); ctx.ellipse(0, -hh, wd * 0.5, wd * 0.42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#95a27f'; ctx.lineWidth = Math.max(1.5, wd * 0.16); ctx.lineCap = 'round';
      for (let f = -2; f <= 2; f++) { ctx.beginPath(); ctx.moveTo(f * wd * 0.15, -hh - wd * 0.2); ctx.lineTo(f * wd * 0.22, -hh - wd * 0.75 - Math.abs(f) * -wd * 0.08); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-wd * 0.3, -hh, wd * 0.6, hh);
      ctx.restore(); continue;
    }
    const grad = style === 'bone' ? lin(ctx, bx, 0, bx + wd, 0, [[0, '#9c8f74'], [0.5, '#f4ead2'], [1, '#8a7d62']]) : style === 'thorn' ? lin(ctx, bx, 0, bx + wd, 0, [[0, '#14310f'], [0.5, '#3f7a2a'], [1, '#12280c']]) : steel(ctx, bx, bx + wd);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(bx + wd * 0.1, y); ctx.lineTo(mid, y - hh); ctx.lineTo(bx + wd * 0.9, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    if (style === 'thorn') { ctx.fillStyle = '#c0182a'; ctx.beginPath(); ctx.moveTo(mid - wd * 0.08, y - hh * 0.75); ctx.lineTo(mid, y - hh); ctx.lineTo(mid + wd * 0.08, y - hh * 0.75); ctx.fill(); if (i % 3 === 1) { ctx.fillStyle = '#d61f3a'; ctx.beginPath(); ctx.arc(mid, y - hh * 0.45, wd * 0.32, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a0a16'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mid, y - hh * 0.45, wd * 0.16, 0, 5); ctx.stroke(); } }
    else if (style === 'bone') { ctx.fillStyle = '#f4ead2'; ctx.beginPath(); ctx.arc(mid - wd * 0.2, y - v.s * 0.04, wd * 0.18, 0, TAU); ctx.arc(mid + wd * 0.2, y - v.s * 0.04, wd * 0.18, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(150,20,20,0.7)'; ctx.beginPath(); ctx.moveTo(mid - wd * 0.08, y - hh * 0.7); ctx.lineTo(mid, y - hh); ctx.lineTo(mid + wd * 0.08, y - hh * 0.7); ctx.fill(); }
  }
}
function drawPendulum(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View) {
  const px = X(v, tr.x), py = Y(v, tr.y), tx = X(v, st.tipX), ty = Y(v, st.tipY), style = tr.style ?? 'axe';
  if (style === 'mace' || style === 'cage') { const n = Math.floor(Math.hypot(tx - px, ty - py) / (v.s * 0.3)); ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(1.5, v.s * 0.06); for (let i = 0; i < n; i++) { const k = i / n; ctx.beginPath(); ctx.ellipse(px + (tx - px) * k, py + (ty - py) * k, v.s * 0.06, v.s * 0.12, -st.a, 0, TAU); ctx.stroke(); } }
  else { ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(3, v.s * 0.12); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke(); ctx.strokeStyle = '#4c4a55'; ctx.lineWidth = Math.max(1, v.s * 0.04); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke(); }
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(-st.a); const R = v.s * 0.95;
  if (style === 'mace') { // bola de hierro con pinches
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.fillStyle = steel(ctx, -R, R); ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.2) * R * 0.7, Math.sin(a - 0.2) * R * 0.7); ctx.lineTo(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25); ctx.lineTo(Math.cos(a + 0.2) * R * 0.7, Math.sin(a + 0.2) * R * 0.7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R * 0.8); g.addColorStop(0, '#9a7a6a'); g.addColorStop(1, '#3a2620'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(140,10,16,0.7)'; ctx.beginPath(); ctx.ellipse(R * 0.2, R * 0.3, R * 0.25, R * 0.1, 0.4, 0, TAU); ctx.fill();
  } else if (style === 'cage') { // jaula con un esqueleto adentro
    ctx.fillStyle = 'rgba(10,8,8,0.55)'; ctx.fillRect(-R * 0.7, -R * 0.2, R * 1.4, R * 1.9);
    ctx.fillStyle = '#e8dcc2'; ctx.beginPath(); ctx.arc(0, R * 0.25, R * 0.25, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a0e0a'; ctx.fillRect(-R * 0.13, R * 0.18, R * 0.09, R * 0.09); ctx.fillRect(R * 0.05, R * 0.18, R * 0.09, R * 0.09);
    ctx.strokeStyle = '#e8dcc2'; ctx.lineWidth = Math.max(1.5, R * 0.07); ctx.beginPath(); ctx.moveTo(0, R * 0.5); ctx.lineTo(0, R * 1.2); for (let k = 0; k < 3; k++) { ctx.moveTo(-R * 0.25, R * (0.65 + k * 0.15)); ctx.lineTo(R * 0.25, R * (0.65 + k * 0.15)); } ctx.stroke();
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = Math.max(2, R * 0.08); for (let k = 0; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(-R * 0.7 + k * R * 0.28, -R * 0.2); ctx.lineTo(-R * 0.7 + k * R * 0.28, R * 1.7); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -R * 0.2, R * 0.72, R * 0.25, 0, Math.PI, TAU); ctx.stroke(); ctx.strokeRect(-R * 0.7, R * 1.7, R * 1.4, R * 0.05);
  } else if (style === 'scythe') { // guadaña curva
    ctx.fillStyle = steel(ctx, -R * 1.4, R * 1.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 1.6, -R * 0.2, R * 1.8, R * 1.0); ctx.quadraticCurveTo(R * 1.1, R * 0.15, 0, R * 0.25); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.scale(-1, 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 1.6, -R * 0.2, R * 1.8, R * 1.0); ctx.quadraticCurveTo(R * 1.1, R * 0.15, 0, R * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(140,10,16,0.6)'; ctx.beginPath(); ctx.ellipse(R * 1.4, R * 0.6, R * 0.2, R * 0.08, 0.8, 0, TAU); ctx.fill();
  } else { // hacha en media luna
    ctx.fillStyle = steel(ctx, -R, R);
    ctx.beginPath(); ctx.moveTo(-R, -R * 0.15); ctx.quadraticCurveTo(0, R * 1.15, R, -R * 0.15); ctx.quadraticCurveTo(0, R * 0.35, -R, -R * 0.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.stroke();
    ctx.fillStyle = 'rgba(140,10,16,0.75)'; ctx.beginPath(); ctx.ellipse(R * 0.35, R * 0.42, R * 0.18, R * 0.08, 0.5, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#26242c'; ctx.beginPath(); ctx.arc(0, 0, v.s * 0.16, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#3a2a1e'; ctx.fillRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35);
}
const FIRE_COL: Record<string, [string, string, string, string]> = { brazier: ['rgba(255,80,20,0.9)', 'rgba(255,170,40,0.9)', 'rgba(255,245,180,0.95)', 'rgba(255,120,30,0.5)'], hellfire: ['rgba(255,40,10,0.92)', 'rgba(255,140,30,0.92)', 'rgba(255,240,160,0.95)', 'rgba(255,80,20,0.6)'], lava: ['rgba(200,40,5,0.95)', 'rgba(255,120,20,0.95)', 'rgba(255,220,120,0.95)', 'rgba(255,100,20,0.5)'], acid: ['rgba(40,160,30,0.9)', 'rgba(140,255,80,0.9)', 'rgba(230,255,200,0.9)', 'rgba(120,255,80,0.45)'], blood: ['rgba(110,0,10,0.95)', 'rgba(200,20,30,0.95)', 'rgba(255,120,120,0.9)', 'rgba(220,20,40,0.4)'] };
function drawColumn(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View, t: number) {
  const x = X(v, tr.x), y = Y(v, tr.y), s = v.s, style = tr.style ?? 'brazier', col = FIRE_COL[style] ?? FIRE_COL.brazier, liquid = style === 'acid' || style === 'blood' || style === 'lava';
  const base = style === 'brazier' ? y - s * 0.85 : y;
  if (style === 'brazier') {
    ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(x - s * 0.15, y); ctx.lineTo(x - s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.15, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.32, y - s * 0.85); ctx.lineTo(x - s * 0.32, y - s * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
    flame(ctx, x, y - s * 0.85, s * (st.warn ? 0.32 : 0.22), t, 7);
  }
  if (st.warn) for (let i = 0; i < 5; i++) { const k = (t * 2 + i / 5) % 1; ctx.fillStyle = col[1]; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x + Math.sin(i * 9 + t * 5) * s * 0.35, base - s * (0.2 + k * 1.2), s * (liquid ? 0.09 : 0.05), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  if (st.on <= 0) return;
  const hgt = tr.len * st.on * s;
  ctx.save(); if (!liquid) ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, base - hgt * 0.5, hgt * 0.7, col[3]);
  for (const [k, c] of [[1, col[0]], [0.7, col[1]], [0.4, col[2]]] as const) {
    const wd = s * (liquid ? 0.6 : 0.55) * k;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - wd, base);
    for (let j = 0; j <= 6; j++) { const yy = base - hgt * (liquid ? 1 : k) * j / 6, ww = wd * (liquid ? 0.9 + 0.15 * Math.sin(t * 14 + j) : (1 - j / 7) * (1 + 0.25 * Math.sin(t * 20 + j * 2))); ctx.lineTo(x - ww, yy); }
    for (let j = 6; j >= 0; j--) { const yy = base - hgt * (liquid ? 1 : k) * j / 6, ww = wd * (liquid ? 0.9 + 0.15 * Math.sin(t * 17 + j) : (1 - j / 7) * (1 + 0.25 * Math.sin(t * 17 + j * 3))); ctx.lineTo(x + ww, yy); }
    ctx.closePath(); ctx.fill();
  }
  if (liquid) for (let i = 0; i < 8; i++) { const k = (t * 1.6 + i / 8) % 1, a = i * 0.8; ctx.fillStyle = col[1]; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * (0.4 + k * 1.2), base - hgt - Math.sin(k * Math.PI) * s * 0.8 + k * s * 1.4, s * 0.1 * (1 - k * 0.5), 0, TAU); ctx.fill(); } // salpica arriba
  ctx.restore();
}
function drawSaw(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View) {
  const y = Y(v, tr.y), r = SAW_R * v.s;
  ctx.fillStyle = '#121016'; ctx.fillRect(X(v, tr.x) - r * 0.2, y - v.s * 0.06, X(v, tr.x2) - X(v, tr.x) + r * 0.4, v.s * 0.12); // la ranura
  ctx.save(); ctx.translate(X(v, st.cx), Y(v, st.cy)); ctx.rotate(st.a);
  ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i * TAU / 24, rr = i % 2 ? r : r * 0.82; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#f1f3f8'); g.addColorStop(0.6, '#9aa0ad'); g.addColorStop(1, '#5a5f6b'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(140,10,16,0.65)'; ctx.beginPath(); ctx.arc(r * 0.45, r * 0.2, r * 0.18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#26242c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill(); ctx.fillStyle = '#b9bdc9'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawRoller(ctx: CanvasRenderingContext2D, st: ReturnType<typeof trapState>, v: View) {
  const r = ROLL_R * v.s, x = X(v, st.cx), y = Y(v, st.cy);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, r, r * 1.3, r * 0.2, 0, 0, TAU); ctx.fill();
  ctx.rotate(st.a);
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ctx.fillStyle = steel(ctx, -r, r); ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.18) * r * 0.9, Math.sin(a - 0.18) * r * 0.9); ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); ctx.lineTo(Math.cos(a + 0.18) * r * 0.9, Math.sin(a + 0.18) * r * 0.9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#8a5a3c'); g.addColorStop(1, '#3a2014'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#9aa0ad'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(140,10,16,0.7)'; ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.4, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawCrusher(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View, t: number) {
  const x = X(v, tr.x) + (st.warn ? Math.sin(t * 70) * v.s * 0.05 : 0), b = Y(v, st.bottom), hw = tr.len * v.s, style = tr.style ?? 'spikeblock';
  chainTo(ctx, v, x, 0, b - v.s * (style === 'chandelier' ? 0.9 : 1.1));
  if (st.warn) glow(ctx, X(v, tr.x), Y(v, tr.y), v.s * 1.4, 'rgba(255,60,40,0.3)'); // la sombra donde va a caer
  ctx.save(); ctx.translate(x, b);
  if (style === 'chandelier') { // araña de velas con pinches abajo
    ctx.strokeStyle = '#b08a3a'; ctx.lineWidth = Math.max(2, v.s * 0.08); ctx.beginPath(); ctx.ellipse(0, -v.s * 0.55, hw, v.s * 0.18, 0, 0, TAU); ctx.stroke();
    for (const k of [-1, -0.5, 0, 0.5, 1]) { const cx = k * hw; ctx.fillStyle = '#f3ead2'; ctx.fillRect(cx - v.s * 0.05, -v.s * 0.95, v.s * 0.1, v.s * 0.32); flame(ctx, cx, -v.s * 0.95, v.s * 0.08, t, k * 9); }
    for (const k of [-0.8, -0.4, 0, 0.4, 0.8]) { ctx.fillStyle = steel(ctx, k * hw - v.s * 0.08, k * hw + v.s * 0.08); ctx.beginPath(); ctx.moveTo(k * hw - v.s * 0.09, -v.s * 0.45); ctx.lineTo(k * hw, 0); ctx.lineTo(k * hw + v.s * 0.09, -v.s * 0.45); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    glow(ctx, 0, -v.s * 0.9, v.s * 1.6, 'rgba(255,190,90,0.3)');
  } else if (style === 'cage') {
    ctx.fillStyle = 'rgba(10,8,8,0.5)'; ctx.fillRect(-hw, -v.s * 1.9, hw * 2, v.s * 1.9);
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = Math.max(2, v.s * 0.08); for (let k = 0; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(-hw + k * hw * 0.4, -v.s * 1.9); ctx.lineTo(-hw + k * hw * 0.4, 0); ctx.stroke(); }
    ctx.strokeRect(-hw, -v.s * 1.9, hw * 2, v.s * 1.9); ctx.beginPath(); ctx.ellipse(0, -v.s * 1.9, hw, v.s * 0.3, 0, Math.PI, TAU); ctx.stroke();
    for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.fillStyle = steel(ctx, k * hw - 4, k * hw + 4); ctx.beginPath(); ctx.moveTo(k * hw - v.s * 0.07, -v.s * 0.05); ctx.lineTo(k * hw, v.s * 0.25); ctx.lineTo(k * hw + v.s * 0.07, -v.s * 0.05); ctx.fill(); }
  } else if (style === 'tomb') { // lápida que cae
    ctx.fillStyle = lin(ctx, -hw, 0, hw, 0, [[0, '#6a6862'], [0.5, '#a19d94'], [1, '#5a5852']]); ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(-hw, -v.s * 1.3); ctx.arc(0, -v.s * 1.3, hw, Math.PI, 0); ctx.lineTo(hw, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#3e3c38'; ctx.lineWidth = Math.max(2, v.s * 0.07); ctx.beginPath(); ctx.moveTo(0, -v.s * 1.75); ctx.lineTo(0, -v.s * 0.9); ctx.moveTo(-hw * 0.4, -v.s * 1.5); ctx.lineTo(hw * 0.4, -v.s * 1.5); ctx.stroke();
    ctx.font = `900 ${Math.max(8, v.s * 0.22)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#3e3c38'; ctx.fillText('R.I.P.', 0, -v.s * 0.45);
  } else { // bloque de piedra con pinches abajo
    ctx.fillStyle = lin(ctx, 0, -v.s * 1.3, 0, 0, [[0, '#6a5a58'], [1, '#2e2628']]); ctx.fillRect(-hw, -v.s * 1.3, hw * 2, v.s * 1.0); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-hw, -v.s * 1.3, hw * 2, v.s * 1.0);
    ctx.fillStyle = '#d6c39a'; ctx.beginPath(); ctx.arc(0, -v.s * 0.8, v.s * 0.22, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a0e0a'; ctx.fillRect(-v.s * 0.12, -v.s * 0.86, v.s * 0.08, v.s * 0.08); ctx.fillRect(v.s * 0.04, -v.s * 0.86, v.s * 0.08, v.s * 0.08);
    const n = Math.max(3, Math.round(tr.len * 4)); for (let k = 0; k < n; k++) { const sx = -hw + (k + 0.5) * hw * 2 / n; ctx.fillStyle = steel(ctx, sx - 6, sx + 6); ctx.beginPath(); ctx.moveTo(sx - hw / n, -v.s * 0.3); ctx.lineTo(sx, 0); ctx.lineTo(sx + hw / n, -v.s * 0.3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
  }
  ctx.restore();
}
function drawDrip(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View, t: number) {
  const style = tr.style ?? 'acid', x = X(v, tr.x), top = Y(v, (tr.top ?? 16) - 0.1);
  // de dónde sale: un caño, un nicho con calaveras o una grieta con fuego
  ctx.fillStyle = style === 'acid' ? '#2a3a26' : style === 'skull' ? '#4a3e30' : '#3a1a12'; ctx.fillRect(x - v.s * 0.3, 0, v.s * 0.6, top + v.s * 0.15);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x - v.s * 0.3, -2, v.s * 0.6, top + v.s * 0.15);
  if (st.warn > 0) { const r = v.s * 0.18 * st.warn; ctx.fillStyle = style === 'acid' ? '#9cff5a' : style === 'skull' ? '#e8dcc2' : '#ff9a3c'; ctx.beginPath(); ctx.arc(x, top + v.s * 0.15 + r, r, 0, TAU); ctx.fill(); }
  if (!st.on) return;
  const y = Y(v, st.cy), r = v.s * 0.3;
  if (style === 'acid') { glow(ctx, x, y, r * 2.5, 'rgba(140,255,80,0.4)'); ctx.fillStyle = '#9cff5a'; ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.quadraticCurveTo(x + r, y - r * 0.2, x, y + r); ctx.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.8); ctx.fill(); ctx.strokeStyle = '#1f6a16'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else if (style === 'skull') { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 6); const k = v.s / 40 * 1.2; ctx.scale(k, k); skull(ctx, '#ff3a2a'); ctx.restore(); }
  else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, r * 3, 'rgba(255,120,30,0.6)'); for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,${120 + i * 25},40,${0.5 - i * 0.08})`; ctx.beginPath(); ctx.arc(x, y - i * r * 0.45, r * (1 - i * 0.15), 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill(); ctx.restore(); }
}
function drawJet(ctx: CanvasRenderingContext2D, tr: Trap, st: ReturnType<typeof trapState>, v: View, t: number) {
  const x = X(v, tr.x), y = Y(v, tr.y + 0.9), d = tr.amp >= 0 ? 1 : -1, s = v.s;
  ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
  if (tr.style === 'gargoyle') { // cabeza de gárgola de piedra con la boca abierta
    ctx.fillStyle = lin(ctx, -s * 0.5, -s * 0.5, s * 0.5, s * 0.5, [[0, '#8a847a'], [1, '#3e3a34']]);
    ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.5); ctx.lineTo(-s * 0.3, -s * 0.95); ctx.lineTo(-s * 0.1, -s * 0.55); ctx.lineTo(s * 0.4, -s * 0.4); ctx.lineTo(s * 0.55, -s * 0.05); ctx.lineTo(s * 0.25, 0); ctx.lineTo(s * 0.5, s * 0.25); ctx.lineTo(-s * 0.55, s * 0.4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = st.warn || st.on ? '#ff5a1a' : '#1a0a06'; ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.28, s * 0.07, 0, TAU); ctx.fill();
  } else { // boca de hierro en la pared
    ctx.fillStyle = '#26242c'; ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.35, s * 0.7); ctx.fillStyle = '#3e3c46'; ctx.fillRect(0, -s * 0.22, s * 0.4, s * 0.44); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(0, -s * 0.22, s * 0.4, s * 0.44);
  }
  if (st.warn) for (let i = 0; i < 4; i++) { const k = (t * 3 + i / 4) % 1; ctx.fillStyle = `rgba(255,170,60,${1 - k})`; ctx.beginPath(); ctx.arc(s * (0.45 + k * 0.6), Math.sin(i * 7 + t * 9) * s * 0.15, s * 0.05, 0, TAU); ctx.fill(); }
  if (st.on > 0) {
    const L = st.reach * s;
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, s * 0.4 + L * 0.5, 0, L * 0.6, 'rgba(255,110,30,0.5)');
    for (const [k, c] of [[1, 'rgba(255,70,20,0.9)'], [0.65, 'rgba(255,170,40,0.9)'], [0.35, 'rgba(255,245,180,0.95)']] as const) {
      const hh = s * 0.42 * k; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(s * 0.4, -hh * 0.5);
      for (let j = 0; j <= 6; j++) { const xx = s * 0.4 + L * k * j / 6; ctx.lineTo(xx, -hh * (0.5 + j * 0.12) * (1 + 0.2 * Math.sin(t * 22 + j))); }
      for (let j = 6; j >= 0; j--) { const xx = s * 0.4 + L * k * j / 6; ctx.lineTo(xx, hh * (0.5 + j * 0.12) * (1 + 0.2 * Math.sin(t * 19 + j))); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
function drawTraps(ctx: CanvasRenderingContext2D, g: Game, v: View, t: number) {
  for (const tr of TRAPS) {
    const st = trapState(tr, g.time);
    switch (tr.kind) {
      case 'spikes': drawSpikes(ctx, tr, st, v, t); break;
      case 'pendulum': drawPendulum(ctx, tr, st, v); break;
      case 'fire': drawColumn(ctx, tr, st, v, t); break;
      case 'saw': drawSaw(ctx, tr, st, v); break;
      case 'roller': drawRoller(ctx, st, v); break;
      case 'crusher': drawCrusher(ctx, tr, st, v, t); break;
      case 'drip': drawDrip(ctx, tr, st, v, t); break;
      case 'jet': drawJet(ctx, tr, st, v, t); break;
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
  if (c.landed) glow(ctx, 0, -sz / 2, s * 1.3, c.kind === 'heart' ? 'rgba(255,70,90,0.35)' : c.kind === 'garlic' ? 'rgba(220,255,220,0.35)' : c.kind === 'fire' || c.kind === 'bullets' ? 'rgba(255,120,40,0.4)' : 'rgba(255,210,120,0.35)', 0.6 + 0.4 * Math.sin(t * 5));
  ctx.fillStyle = lin(ctx, -sz / 2, 0, sz / 2, 0, [[0, '#7a4a24'], [0.5, '#a8703c'], [1, '#6b3f1d']]); ctx.fillRect(-sz / 2, -sz, sz, sz);
  ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = Math.max(1, s * 0.04); for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-sz / 2, -sz + sz * i / 3); ctx.lineTo(sz / 2, -sz + sz * i / 3); ctx.stroke(); }
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.beginPath(); ctx.moveTo(-sz / 2, -sz); ctx.lineTo(sz / 2, 0); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeRect(-sz / 2, -sz, sz, sz);
  // el ícono de lo que trae
  ctx.save(); ctx.translate(0, -sz / 2); const k = s / 40;
  ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.32, 0, TAU); ctx.fill();
  if (c.kind !== 'heart') drawWeaponIcon(ctx, c.kind === 'bolts' ? 'crossbow' : c.kind === 'fire' ? 'firesword' : c.kind === 'bullets' ? 'pistol' : 'garlic', sz * 0.62, t);
  else { ctx.scale(k, k); ctx.fillStyle = '#ff3b4f'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.fill(); }
  ctx.restore();
  ctx.restore();
}
// Lo que cae del cielo para juntar: la estrella dorada (gira y brilla) o el alma (llama azul con carita que flota).
function drawItem(ctx: CanvasRenderingContext2D, it: Item, v: View, t: number) {
  const s = v.s, x = X(v, it.x), y = Y(v, it.y + 0.55 + (it.landed ? Math.sin(t * 3 + it.id) * 0.1 : 0));
  const fade = it.landed && it.t > 11 ? (Math.floor(it.t * 8) % 2 ? 0.4 : 1) : 1; // titila antes de desaparecer
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y);
  if (it.kind === 'star') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, s * 1.1, `rgba(255,214,90,${0.55 + 0.2 * Math.sin(t * 5 + it.id)})`); ctx.restore();
    ctx.scale(Math.cos(t * 2.5 + it.id), 1); // gira
    const R = s * 0.42, r = s * 0.18;
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#fff6c0'], [0.45, '#f5c02a'], [1, '#a8660a']]); ctx.fill(); ctx.strokeStyle = '#5a3404'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-R * 0.15, -R * 0.35, R * 0.18, R * 0.1, -0.5, 0, TAU); ctx.fill();
  } else {
    const bob = Math.sin(t * 4 + it.id) * s * 0.06;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, bob, s * 1.2, 'rgba(120,200,255,0.55)'); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.6 + bob); ctx.quadraticCurveTo(s * 0.35 + Math.sin(t * 6) * s * 0.05, -s * 0.1 + bob, s * 0.28, s * 0.2 + bob); ctx.quadraticCurveTo(0, s * 0.45 + bob, -s * 0.28, s * 0.2 + bob); ctx.quadraticCurveTo(-s * 0.35, -s * 0.1 + bob, 0, -s * 0.6 + bob); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -s * 0.6, 0, s * 0.4, [[0, 'rgba(200,240,255,0.95)'], [1, 'rgba(80,150,255,0.85)']]); ctx.fill();
    ctx.fillStyle = '#16324a'; for (const ex of [-0.1, 0.1]) { ctx.beginPath(); ctx.ellipse(ex * s, bob, s * 0.045, s * 0.07, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, s * 0.13 + bob, s * 0.04, s * 0.05, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// Las jaulas con prisioneros (nivel 3) y los ataúdes de huesos de los vampiros antiguos (nivel 6). Con cada golpe se rajan.
function drawBreakable(ctx: CanvasRenderingContext2D, o: Breakable, v: View, t: number) {
  const s = v.s, x = X(v, o.x) + (o.flash > 0 ? Math.sin(t * 90) * s * 0.06 : 0), y = Y(v, o.y), dmg = 1 - o.hp / o.maxHp;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.1, 0, 0, TAU); ctx.fill();
  if (o.kind === 'cage') {
    const w = s * 0.62, h = s * 1.9;
    ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(1.5, s * 0.05); for (let cy = -h - s * 0.2; cy > -h - s * 4; cy -= s * 0.3) { ctx.beginPath(); ctx.ellipse(0, cy, s * 0.06, s * 0.13, 0, 0, TAU); ctx.stroke(); } // cadena
    // el prisionero adentro: silueta agarrada de los barrotes, que mira para afuera
    ctx.fillStyle = '#3a2a24'; ctx.beginPath(); ctx.arc(0, -h * 0.72, s * 0.2, 0, TAU); ctx.fill(); ctx.fillRect(-s * 0.2, -h * 0.62, s * 0.4, h * 0.55);
    ctx.fillStyle = '#d9b48c'; ctx.beginPath(); ctx.arc(s * 0.03, -h * 0.72, s * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0e08'; for (const ex of [-0.03, 0.08]) { ctx.beginPath(); ctx.arc(ex * s, -h * 0.74, s * 0.025, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#d9b48c'; for (const hx of [-w * 0.55, w * 0.55]) { ctx.beginPath(); ctx.arc(hx, -h * 0.55, s * 0.06, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(10,6,6,0.35)'; ctx.fillRect(-w, -h, w * 2, h);
    ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = Math.max(2, s * 0.08);
    for (let k = 0; k <= 5; k++) { const bx = -w + k * w * 0.4, bend = dmg > 0.4 && k === 2 ? s * 0.18 * dmg : 0; ctx.beginPath(); ctx.moveTo(bx, -h); ctx.quadraticCurveTo(bx + bend, -h / 2, bx, 0); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -h, w, s * 0.25, 0, Math.PI, TAU); ctx.stroke(); ctx.strokeRect(-w, -s * 0.06, w * 2, s * 0.06);
    ctx.strokeStyle = 'rgba(200,180,150,0.35)'; ctx.lineWidth = Math.max(1, s * 0.025); for (let k = 0; k <= 5; k++) { const bx = -w + k * w * 0.4 - s * 0.02; ctx.beginPath(); ctx.moveTo(bx, -h + s * 0.1); ctx.lineTo(bx, -s * 0.2); ctx.stroke(); }
    ctx.fillStyle = '#8a7a50'; ctx.fillRect(w * 0.6, -h * 0.5, s * 0.18, s * 0.22); // el candado
  } else {
    const w = s * 0.55, h = s * 2.0;
    const path = () => { ctx.beginPath(); ctx.moveTo(-w * 0.55, 0); ctx.lineTo(-w, -h * 0.68); ctx.lineTo(-w * 0.6, -h); ctx.lineTo(w * 0.6, -h); ctx.lineTo(w, -h * 0.68); ctx.lineTo(w * 0.55, 0); ctx.closePath(); };
    path(); ctx.fillStyle = lin(ctx, -w, 0, w, 0, [[0, '#2a1a10'], [0.45, '#5a3a24'], [1, '#22140c']]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.06); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = Math.max(1, s * 0.02); for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-w * 0.8 + k * w * 0.32, -h * 0.95); ctx.lineTo(-w * 0.6 + k * w * 0.24, -s * 0.05); ctx.stroke(); } // vetas
    ctx.fillStyle = '#e8dcc2'; ctx.fillRect(-s * 0.06, -h * 0.85, s * 0.12, h * 0.55); ctx.fillRect(-s * 0.25, -h * 0.72, s * 0.5, s * 0.11); // cruz de hueso
    ctx.beginPath(); ctx.arc(0, -h * 0.25, s * 0.16, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a0e08'; for (const ex of [-0.06, 0.06]) { ctx.beginPath(); ctx.arc(ex * s, -h * 0.26, s * 0.04, 0, TAU); ctx.fill(); } // calavera
    if (o.t % 5 < 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -h * 0.5, s * 0.9, 'rgba(255,40,40,0.35)'); ctx.restore(); } // algo se mueve adentro
  }
  if (dmg > 0) { ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 1.6); ctx.lineTo(-s * 0.05, -s * 1.2); ctx.lineTo(-s * 0.2, -s * 0.9); if (dmg > 0.5) { ctx.moveTo(s * 0.25, -s * 0.6); ctx.lineTo(s * 0.05, -s * 0.9); ctx.lineTo(s * 0.2, -s * 1.3); } ctx.stroke(); } // rajaduras
  if (o.flash > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -s, s * 1.2, `rgba(255,255,255,${o.flash * 2})`); }
  ctx.restore();
  // la barrita de lo que le falta
  if (o.hp < o.maxHp) { const bw = s * 1.0, bh = Math.max(4, s * 0.12), bx = X(v, o.x) - bw / 2, by = Y(v, o.y + 2.4); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4); ctx.fillStyle = '#e8c77a'; ctx.fillRect(bx, by, bw * o.hp / o.maxHp, bh); }
}
// La flecha de la ballesta (y clavada en el piso, que se desvanece).
function drawBoltW(ctx: CanvasRenderingContext2D, s: Bolt, v: View) {
  ctx.save(); ctx.globalAlpha = s.stuck ? Math.max(0, 1 - s.t / 1.2) : 1; ctx.translate(X(v, s.x), Y(v, s.y)); ctx.rotate(s.stuck ? 0.5 * Math.sign(s.vx) : Math.atan2(-s.vy, s.vx)); if (s.vx < 0 && s.stuck) ctx.scale(-1, 1); ctx.scale(v.s, v.s);
  if (!s.stuck) { ctx.strokeStyle = 'rgba(255,90,70,0.35)'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(-0.6, 0); ctx.stroke(); }
  drawBolt(ctx, 0.2, 0, 0.9);
  ctx.restore();
}
function drawBombW(ctx: CanvasRenderingContext2D, b: Bomb, v: View, t: number) {
  ctx.save(); ctx.translate(X(v, b.x), Y(v, b.y + 0.3)); ctx.rotate(b.landed < 0 ? b.a : 0);
  if (b.landed >= 0 && Math.floor(b.landed * 16) % 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, v.s * 0.9, 'rgba(255,255,200,0.6)'); ctx.restore(); } // titila antes de explotar
  drawGarlicBomb(ctx, v.s * 0.3, t);
  ctx.restore();
}
function drawBulletW(ctx: CanvasRenderingContext2D, b: Bullet, v: View) {
  const x = X(v, b.x), y = Y(v, b.y), d = Math.sign(b.vx);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = lin(ctx, x - d * v.s * 2, y, x, y, [[0, 'rgba(255,80,20,0)'], [1, 'rgba(255,160,60,0.85)']]); ctx.lineWidth = v.s * 0.18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - d * v.s * 2, y); ctx.lineTo(x, y); ctx.stroke();
  glow(ctx, x, y, v.s * 0.8, 'rgba(255,130,30,0.8)');
  ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(x, y, v.s * 0.13, 0, TAU); ctx.fill();
  ctx.restore();
}
// Los efectos de las armas: la onda de ajo, los rayos de la cruz, la ola de fuego y los estallidos.
function drawFxW(ctx: CanvasRenderingContext2D, f: Fx, v: View, g: Game, t: number) {
  if (f.t < 0) return;
  const k = Math.min(1, f.t / f.life), fade = 1 - k;
  ctx.save();
  if (f.kind === 'blast') { // onda expansiva de ajo: nube blanca y verde que crece hasta 3 metros
    const r = v.s * f.r * (0.3 + 0.7 * Math.sqrt(k)), x = X(v, f.x), y = Y(v, f.y);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,240,${0.85 * fade})`); gr.addColorStop(0.55, `rgba(200,255,170,${0.55 * fade})`); gr.addColorStop(1, 'rgba(140,220,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(230,255,210,${fade})`; ctx.lineWidth = Math.max(2, v.s * 0.15 * fade); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * fade})`; ctx.lineWidth = Math.max(1, v.s * 0.06); ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU); ctx.stroke();
    for (let i = 0; i < 10; i++) { const a = i * 0.63 + f.seed * 6, rr = r * (0.5 + 0.5 * k); ctx.fillStyle = `rgba(245,240,230,${fade})`; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, v.s * 0.1, v.s * 0.06, a, 0, TAU); ctx.fill(); } // dientes de ajo volando
  } else if (f.kind === 'bolt') { // rayo de tormenta que baja del cielo
    const x = X(v, f.x), y1 = Y(v, f.y), segs = 9;
    ctx.globalCompositeOperation = 'lighter';
    const pts: [number, number][] = [[x + (hash(f.seed * 7) - 0.5) * v.s * 2, 0]];
    for (let i = 1; i < segs; i++) pts.push([x + (hash(f.seed * 13 + i + Math.floor(t * 30)) - 0.5) * v.s * 1.2 * (1 - i / segs), y1 * i / segs]);
    pts.push([x, y1]);
    for (const [w, c] of [[v.s * 0.5, `rgba(255,220,120,${0.35 * fade})`], [v.s * 0.2, `rgba(255,250,210,${0.8 * fade})`], [v.s * 0.07, `rgba(255,255,255,${fade})`]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke(); }
    glow(ctx, x, y1, v.s * 1.6, `rgba(255,230,140,${0.8 * fade})`);
  } else if (f.kind === 'wave') { // la ola de fuego de la espada: una media luna que sale hacia adelante
    const p = g.player, cx = X(v, p.x), cy = Y(v, f.y + 1.5), r = v.s * (1.2 + (f.r - 1.2) * Math.sqrt(k)), a0 = f.face > 0 ? -1.15 : Math.PI - 1.15, a1 = a0 + 2.3;
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, c] of [[v.s * 1.1, `rgba(255,60,10,${0.45 * fade})`], [v.s * 0.55, `rgba(255,150,40,${0.75 * fade})`], [v.s * 0.2, `rgba(255,240,170,${fade})`]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const a = a0 + (a1 - a0) * (i / 13), fx = cx + Math.cos(a) * r, fy = cy + Math.sin(a) * r, fl = v.s * (0.3 + hash(i + f.seed * 9) * 0.4) * fade; ctx.fillStyle = `rgba(255,${120 + i * 6},40,${0.8 * fade})`; ctx.beginPath(); ctx.moveTo(fx - fl * 0.4, fy); ctx.quadraticCurveTo(fx, fy - fl * 2.2, fx + fl * 0.4, fy); ctx.fill(); }
  } else { // estallido de fuego de la bala
    const x = X(v, f.x), y = Y(v, f.y), r = v.s * f.r * (0.4 + k);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, r * 1.6, `rgba(255,140,40,${0.9 * fade})`);
    ctx.fillStyle = `rgba(255,240,170,${fade})`; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
  }
  ctx.restore();
}


// ---------------------------------------------------------------- La tormenta (nivel 9)
// El rayo: un camino quebrado desde arriba del cielo, con ramas finitas. Mismo dibujo mientras dura (usa st.seed).
function drawLightning(ctx: CanvasRenderingContext2D, st: Storm, v: View, w: number, h: number) {
  const life = 0.55; if (st.t > life) return;
  // titila: dos o tres pulsos de luz, como los rayos de verdad
  const k = st.t < 0.06 ? 1 : st.t < 0.1 ? 0.25 : st.t < 0.17 ? 0.85 : Math.max(0, 1 - (st.t - 0.17) / (life - 0.17)) * 0.6;
  let sd = st.seed * 9973; const rnd = () => { sd = (sd * 16807 + 11) % 2147483647; return (sd % 10000) / 10000; };
  const x0 = X(v, st.x), yEnd = st.near > 0.6 ? Y(v, GROUND_Y) : h * (0.35 + rnd() * 0.2);
  const pts: [number, number][] = [[x0 + (rnd() - 0.5) * w * 0.1, -10]];
  const seg = 16;
  for (let i = 1; i <= seg; i++) { const [px] = pts[i - 1]; pts.push([px + (rnd() - 0.5) * v.s * 2.2, -10 + (yEnd + 10) * i / seg]); }
  const branches: [number, number][][] = [];
  for (let b = 0; b < 4; b++) {
    const from = 3 + Math.floor(rnd() * (seg - 6)), dir = rnd() < 0.5 ? -1 : 1; let [bx, by] = pts[from]; const br: [number, number][] = [[bx, by]];
    for (let i = 0; i < 5; i++) { bx += dir * v.s * (0.4 + rnd() * 0.9); by += v.s * (0.5 + rnd() * 0.8); br.push([bx, by]); }
    branches.push(br);
  }
  // el cielo se ilumina (más cerca = más fuerte) y el rayo con su resplandor
  ctx.save();
  ctx.fillStyle = `rgba(190,205,255,${0.35 * k * (0.4 + st.near * 0.6)})`; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = (path: [number, number][], width: number, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); path.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  ctx.shadowColor = 'rgba(160,180,255,0.9)'; ctx.shadowBlur = v.s * 1.2 * k;
  line(pts, v.s * 0.45 * k, `rgba(120,140,255,${0.35 * k})`);
  for (const br of branches) line(br, v.s * 0.12 * k, `rgba(200,210,255,${0.55 * k})`);
  ctx.shadowBlur = 0;
  line(pts, Math.max(1.5, v.s * 0.1), `rgba(255,255,255,${0.95 * k})`);
  if (st.near > 0.6) glow(ctx, pts[seg][0], pts[seg][1], v.s * 3 * k, `rgba(220,230,255,${0.6 * k})`); // donde pegó
  ctx.restore();
}
// La lluvia: dos capas inclinadas por el viento (la de atrás más fina y lenta), salpicaduras en el piso y las plataformas, y neblina.
function drawRain(ctx: CanvasRenderingContext2D, v: View, w: number, h: number, t: number, lit: number) {
  ctx.save();
  // oscurece un poco y le pone una neblina azulada abajo
  ctx.fillStyle = 'rgba(10,16,30,0.22)'; ctx.fillRect(0, 0, w, h);
  const mist = ctx.createLinearGradient(0, h * 0.55, 0, h); mist.addColorStop(0, 'rgba(120,140,170,0)'); mist.addColorStop(1, 'rgba(120,140,170,0.16)'); ctx.fillStyle = mist; ctx.fillRect(0, h * 0.55, w, h * 0.45);
  const wind = 0.22 + Math.sin(t * 0.3) * 0.06; // ráfagas
  const layer = (n: number, speed: number, len: number, width: number, alpha: number, off: number) => {
    ctx.strokeStyle = `rgba(${180 + lit * 70},${195 + lit * 60},${225 + lit * 30},${alpha + lit * 0.25})`; ctx.lineWidth = width; ctx.beginPath();
    const L = len * v.s, sp = speed * v.s;
    for (let i = 0; i < n; i++) {
      const y = (hash(i + off) * (h + L) + t * sp * (0.85 + hash(i + off + 7) * 0.3)) % (h + L) - L;
      const x = ((hash(i * 3 + off) * (w + h * wind) + y * wind) % (w + h * wind)) - h * wind * 0.5;
      ctx.moveTo(x, y); ctx.lineTo(x - L * wind, y - L);
    }
    ctx.stroke();
  };
  layer(Math.round(w * h / 6500), 18, 0.7, Math.max(1, v.s * 0.03), 0.24, 11); // lejos
  layer(Math.round(w * h / 12000), 30, 1.3, Math.max(1.2, v.s * 0.05), 0.42, 57); // cerca
  // salpicaduras: gotitas que rebotan sobre cada superficie
  ctx.strokeStyle = `rgba(200,215,240,${0.45 + lit * 0.3})`; ctx.lineWidth = Math.max(1, v.s * 0.035); ctx.beginPath();
  SURFACES.forEach((q, si) => {
    const n = Math.max(2, Math.round((q.x2 - q.x1) * 0.9));
    for (let i = 0; i < n; i++) {
      const ph = (t * 2.6 + hash(i * 13 + si * 101)) % 1; if (ph > 0.35) continue;
      const k = ph / 0.35, x = X(v, q.x1 + (q.x2 - q.x1) * hash(i * 7 + si * 31 + Math.floor(t * 2.6 + hash(i * 13 + si * 101)))), y = Y(v, q.y), r = v.s * (0.06 + k * 0.22);
      ctx.moveTo(x - r, y - r * 0.2 * (1 - k)); ctx.quadraticCurveTo(x - r * 0.5, y - r * (1.2 - k), x, y - r * 0.15);
      ctx.moveTo(x + r, y - r * 0.2 * (1 - k)); ctx.quadraticCurveTo(x + r * 0.5, y - r * (1.2 - k), x, y - r * 0.15);
    }
  });
  ctx.stroke();
  ctx.restore();
}

// Los efectos de los ataques especiales de Demian: el círculo del giro, la estela de la estocada y el remolino.
function drawSpecialFx(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const sp = g.player.special, p = g.player; if (!sp) return;
  const k = Math.min(1, sp.t / SPECIAL_TIME[sp.kind]), fade = 1 - k, cx = X(v, p.x), cy = Y(v, p.y + 1.0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  if (sp.kind === 'spin' || sp.kind === 'whirl') {
    const R = (sp.kind === 'spin' ? SPIN_R : WHIRL_R) * v.s * 0.85, a0 = -Math.PI / 2 + k * Math.PI * 2 * (sp.kind === 'spin' ? -sp.dir : 1);
    for (const [w, c] of [[0.5, `rgba(255,255,255,${0.35 * fade})`], [0.2, `rgba(255,70,80,${0.8 * fade})`], [0.08, `rgba(255,230,230,${0.9 * fade})`]] as const) {
      ctx.strokeStyle = c; ctx.lineWidth = v.s * w; ctx.beginPath();
      if (sp.kind === 'spin') ctx.arc(cx, cy, R, a0 - 2.4, a0); else ctx.ellipse(cx, cy + v.s * 0.2, R, R * 0.28, 0, a0 - 2.6, a0);
      ctx.stroke();
    }
  } else if (sp.kind === 'dash') {
    for (let i = 0; i < 6; i++) { const y = Y(v, p.y + 0.4 + i * 0.3), len = v.s * (2.5 + (i % 3)) * fade; ctx.strokeStyle = `rgba(255,${120 + i * 20},${120 + i * 20},${0.55 * fade})`; ctx.lineWidth = v.s * 0.08; ctx.beginPath(); ctx.moveTo(cx - sp.dir * v.s * 0.3, y); ctx.lineTo(cx - sp.dir * (v.s * 0.3 + len), y); ctx.stroke(); }
    glow(ctx, cx + sp.dir * v.s * 1.2, cy, v.s * 1.4, `rgba(255,60,70,${0.5 * fade})`);
  }
  ctx.restore();

}

// ---------------------------------------------------------------- Todo junto
export function drawGame(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, t: number) {
  setVampTexture(false);
  const v = viewFor(w, h);
  const key = `${w}x${h}:${LV.def.n}:${backdropReady}`;
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
  const bolt = (t * 0.13 + 0.37) % 1; if (!g.storm && bolt < 0.012) { ctx.fillStyle = `rgba(200,210,255,${0.25 * (1 - bolt / 0.012)})`; ctx.fillRect(0, 0, w, h); }
  // murciélagos que pasan lejos
  ctx.fillStyle = 'rgba(8,6,14,0.8)';
  for (let i = 0; i < 6; i++) { const bx = ((t * (0.6 + hash(i) * 0.5) * v.s + hash(i + 3) * w * 2) % (w + 200)) - 100, by = h * (0.12 + hash(i + 9) * 0.3) + Math.sin(t * 3 + i) * v.s * 0.4, fl = Math.sin(t * 14 + i * 2) * v.s * 0.12, sz = v.s * (0.18 + hash(i + 1) * 0.12); ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - sz, by - sz - fl, bx - sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx - sz, by, bx, by + sz * 0.3); ctx.quadraticCurveTo(bx + sz, by, bx + sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx + sz, by - sz - fl, bx, by); ctx.fill(); }
  for (const q of SURFACES) if (q.mv) drawPlatform(ctx, v, q);
  drawPits(ctx, v, t);
  // niebla que sube de los huecos
  if (LV.def.pit === 'void' || LV.def.pit === 'grave' || LV.def.pit === 'bones') for (const [a, b] of GAPS) for (let i = 0; i < 4; i++) {
    const k = (t * 0.25 + i / 4) % 1, x = X(v, a + (b - a) * (0.2 + hash(i + a) * 0.6)) + Math.sin(t + i) * v.s * 0.3, y = Y(v, GROUND_Y - 2 + k * 3);
    glow(ctx, x, y, v.s * (1 + k), `rgba(170,180,220,${0.22 * Math.sin(k * Math.PI)})`);
  }
  drawTorches(ctx, v, t);
  drawDoor(ctx, g, v, t);
  drawTraps(ctx, g, v, t);
  for (const c of g.crates) drawCrate(ctx, c, v, t);
  for (const o of g.objects) drawBreakable(ctx, o, v, t);
  for (const it of g.items) drawItem(ctx, it, v, t);
  drawBlood(ctx, g, v);
  for (const b of g.bones) drawBone(ctx, b, v);
  for (const c of g.corpses) drawCorpse(ctx, c, v, t, g);
  // vampiros
  for (const vp of g.vamps) {
    const k = CHAR_K * v.s * BODY[vp.kind].k; // (BODY.k ya incluye que los vampiros son más grandes)
    ctx.save(); ctx.translate(X(v, vp.x), Y(v, vp.y)); ctx.scale(k * vp.face, k);
    drawVampK(ctx, vp, t);
    ctx.restore();
    // la barrita de vida de los fuertes (cuando ya les pegaron)
    const hp = vp.hp ?? 1, max = vp.maxHp ?? 1;
    if (max > 1 && hp < max && !isBoss(vp.kind)) {
      const bw = v.s * 1.1, bh = Math.max(4, v.s * 0.13), bx = X(v, vp.x) - bw / 2, by = Y(v, vp.y + BODY[vp.kind].h + 0.35);
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#3a0408'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = lin(ctx, 0, by, 0, by + bh, [[0, '#ff6070'], [1, '#b0101c']]); ctx.fillRect(bx, by, bw * hp / max, bh);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; for (let i = 1; i < max; i++) ctx.fillRect(bx + bw * i / max - 0.5, by, 1, bh);
    }
  }
  // bolas de fuego, murciélagos y el fuego del dragón
  for (const s of g.shots) { ctx.save(); ctx.translate(X(v, s.x), Y(v, s.y)); ctx.scale(v.s, v.s); drawShotK(ctx, s, t); ctx.restore(); }
  // el ajo: un halo verde blanco que los espanta
  const p = g.player;
  if (g.garlicT > 0) glow(ctx, X(v, p.x), Y(v, p.y + 1), v.s * 4.5, `rgba(210,255,200,${0.25 * Math.min(1, g.garlicT)})`);
  drawSpecialFx(ctx, g, v);
  // el cazador (parpadea mientras es invulnerable)
  if (g.phase !== 'dead' || g.phaseT < 0.2) {
    const blink = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
    ctx.save(); ctx.globalAlpha = blink ? 0.35 : 1; ctx.translate(X(v, p.x), Y(v, p.y)); const k = CHAR_K * v.s; ctx.scale(k * p.face, k);
    if (g.phase === 'cleared') ctx.globalAlpha = Math.max(0, 1 - g.phaseT / 1.6);
    drawHunterK(ctx, p, g, t); ctx.restore();
  }
  if (g.boomer) { const bm = g.boomer; ctx.save(); ctx.translate(X(v, bm.x), Y(v, bm.y)); const k = CHAR_K * v.s; ctx.scale(k, k); ctx.rotate(-bm.t * 22 * Math.sign(bm.vx || 1)); // la espada que gira
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,220,0.45)'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.arc(0, 0, 0.85, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore();
    sword(ctx, [0, 0.6], Math.PI); ctx.restore(); }
  for (const s of g.bolts) drawBoltW(ctx, s, v);
  for (const b of g.bombs) drawBombW(ctx, b, v, t);
  for (const b of g.bullets) drawBulletW(ctx, b, v);
  for (const f of g.fx) drawFxW(ctx, f, v, g, t);
  drawSparks(ctx, g, v);
  // los números de los golpes
  ctx.textAlign = 'center'; ctx.font = `900 ${Math.max(12, v.s * 0.55)}px Nunito, system-ui, sans-serif`; ctx.lineJoin = 'round';
  for (const q of g.pops) {
    ctx.globalAlpha = Math.max(0, 1 - q.t * q.t); ctx.lineWidth = Math.max(3, v.s * 0.12); ctx.strokeStyle = '#120406';
    ctx.strokeText(q.text, X(v, q.x), Y(v, q.y)); ctx.fillStyle = q.bad ? '#ff4a5a' : '#ffe08a'; ctx.fillText(q.text, X(v, q.x), Y(v, q.y));
  }
  ctx.globalAlpha = 1;
  // la luz sagrada de la cruz
  if (g.holyT > 0) {
    const k = g.holyT / 1.4, x = X(v, p.x), y = Y(v, p.y + 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, v.s * (4 + (1 - k) * 22), `rgba(255,236,170,${0.8 * k})`);
    ctx.strokeStyle = `rgba(255,245,210,${0.7 * k})`; ctx.lineWidth = v.s * 0.5 * k;
    ctx.beginPath(); ctx.moveTo(x, y - v.s * 30); ctx.lineTo(x, y + v.s * 30); ctx.moveTo(x - v.s * 18, y - v.s * 2); ctx.lineTo(x + v.s * 18, y - v.s * 2); ctx.stroke();
    ctx.restore();
  }
  if (g.storm) { const st = g.storm, lit = st.t < 0.2 ? 1 - st.t / 0.2 : 0; drawRain(ctx, v, w, h, t, lit); drawLightning(ctx, st, v, w, h); }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${g.flash * 0.6})`; ctx.fillRect(0, 0, w, h); }
  // viñeta
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (g.phase === 'dead') { ctx.fillStyle = `rgba(120,0,10,${Math.min(0.5, g.phaseT * 0.4)})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
// Para el cartel de las armas: el cazador o un vampiro sueltos en un lienzo (pies en x, y; size = píxeles por metro).
export function drawPortrait(ctx: CanvasRenderingContext2D, who: 'hunter' | VampKind, g: Game, x: number, y: number, size: number, t: number) {
  setVampTexture(true);
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  if (who === 'hunter') drawHunterK(ctx, g.player, g, t);
  else { const fake: Vamp = { id: 1, kind: who, x: 0, y: 0, vx: 0, vy: 0, face: 1, state: who === 'flyer' || who === 'dragon' ? 'hover' : 'walk', t: 0, onGround: who !== 'flyer' && who !== 'dragon', surface: null, walkT: t, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false }; drawVampK(ctx, fake, t); }
  ctx.restore();
}
export { drawSword as drawSwordIcon, drawStakeItem as drawStakeIcon };
