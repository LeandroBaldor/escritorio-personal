// Cómo se ve Kombat Penales. Todo se mide en los píxeles del dibujo del arco (arco-red.webp / arco-marco.webp, de
// 1774 × 887, el PNG que pasó el usuario): el arco se ve en diagonal, así que la cancha se dibuja con esa misma
// inclinación (las franjas del pasto y las líneas paralelas a la línea del arco). Atrás, el fondo pintado del
// estadio (los mismos 16 de Kombat Football) y la cancha con los colores de cada uno. El que patea viene corriendo
// desde la izquierda y el arquero espera en la línea, mirándolo. La red se deforma cuando entra la pelota (el marco
// queda quieto encima) y si el arquero ataja, el que pateó explota en pedazos de esqueleto y sangre.
import { type CharId, type StageId } from './kombat';
import { T, arriveAt, colOf, rowOf, type PenMatch, type Zone } from './kombatPenalties';
import { THEMES, drawGib, drawScreenBlood, type View } from './kombatArt';
import { PITCH } from './kombatSoccerArt';
import { BODY_SCALE, LOOKS, drawFighterLit, idleFighter, setLowFx } from './kombatFighters';
import { alpha, bloom, darken, lighten } from './gravityMonsters';
import { paintBackdrop } from './kombatScenery';
import { SIZE } from './kombat';
import netUrl from './assets/penales/arco-red.webp';
import frameUrl from './assets/penales/arco-marco.webp';
import ballUrl from './assets/penales/pelota.webp';

const TAU = Math.PI * 2;
type P2 = [number, number];
export const PX_M = 160; // píxeles por metro (de alto)
// La boca del arco (bordes de adentro de los palos y del travesaño) y la profundidad (del frente al fondo de la red).
const FL: P2 = [290, 560], FR: P2 = [1185, 838], TL: P2 = [290, 102], TR: P2 = [1185, 352];
const DEPTH: P2 = [232, -75];
const DM: P2 = [155, -50]; // un metro hacia el fondo
const GOAL_M = 6; // ancho del arco en metros
export const HORIZON = 330; // donde termina la cancha y empieza el fondo pintado
const BOUNDS = { x0: -780, x1: 1580, y0: -250, y1: 1130 }; // (arriba queda lugar para el marcador)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp2 = (a: P2, b: P2, k: number): P2 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
// Un punto del piso: u a lo largo de la línea del arco (0 = palo izquierdo, 1 = palo derecho), d metros hacia el que patea.
export const G = (u: number, d: number): P2 => [FL[0] + (FR[0] - FL[0]) * u - DM[0] * d, FL[1] + (FR[1] - FL[1]) * u - DM[1] * d];
// Un punto de la boca del arco: v = altura (0 = piso, 1 = travesaño).
export const mouth = (u: number, v: number): P2 => lerp2(G(u, 0), lerp2(TL, TR, u), v);
const ZONE_U = [0.17, 0.5, 0.83], ZONE_V = [0.74, 0.2];
export const zonePoint = (z: Zone): P2 => mouth(ZONE_U[colOf(z)], ZONE_V[rowOf(z)]);
export const SPOT = G(0.5, 6);
const KEEPER = G(0.5, 0.32);
const KICK_AT: P2 = [SPOT[0] - 108, SPOT[1] - 6];
const START: P2 = [SPOT[0] - 430, SPOT[1] + 40];
const BALL_R = 36;
const BACK_K = 0.5; // hasta dónde entra la pelota (más hondo, el palo de adelante la taparía)

// La cámara: entra todo (el que patea, el arco y un poco de fondo).
export interface PView { w: number; h: number; k: number; ox: number; oy: number }
export function penView(w: number, h: number): PView {
  const k = Math.min(w / (BOUNDS.x1 - BOUNDS.x0), h / (BOUNDS.y1 - BOUNDS.y0));
  return { w, h, k, ox: (w - (BOUNDS.x1 - BOUNDS.x0) * k) / 2 - BOUNDS.x0 * k, oy: (h - (BOUNDS.y1 - BOUNDS.y0) * k) / 2 - BOUNDS.y0 * k + h * 0.02 };
}
export const toWorld = (v: PView, x: number, y: number): P2 => [(x - v.ox) / v.k, (y - v.oy) / v.k];
export const toScreen = (v: PView, p: P2): P2 => [v.ox + p[0] * v.k, v.oy + p[1] * v.k];

// ---------------------------------------------------------------- Las imágenes
const imgs: Record<'net' | 'frame' | 'ball', HTMLImageElement | null> = { net: null, frame: null, ball: null };
const listeners = new Set<() => void>();
function img(key: 'net' | 'frame' | 'ball') {
  if (typeof Image === 'undefined') return null;
  if (!imgs[key]) { const i = new Image(); i.decoding = 'async'; i.onload = () => listeners.forEach(f => f()); i.src = key === 'net' ? netUrl : key === 'frame' ? frameUrl : ballUrl; imgs[key] = i; }
  const i = imgs[key]!; return i.complete && i.naturalWidth > 0 ? i : null;
}
export function preloadPenaltyArt() { img('net'); img('frame'); img('ball'); }
export function onPenaltyArtLoad(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

// ---------------------------------------------------------------- La cancha (va en la capa del fondo)
function path(ctx: CanvasRenderingContext2D, pts: P2[], closed = true) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (closed) ctx.closePath(); }
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function drawField(ctx: CanvasRenderingContext2D, stage: StageId, xa: number, xb: number, yb: number) {
  const P = PITCH[stage];
  ctx.save(); ctx.beginPath(); ctx.rect(xa, HORIZON, xb - xa, yb - HORIZON); ctx.clip();
  ctx.fillStyle = P.surround; ctx.fillRect(xa, HORIZON, xb - xa, yb - HORIZON);
  // franjas paralelas a la línea del arco
  const stripeB = lighten(P.b, 0.07);
  for (let i = -14; i < 18; i++) { ctx.fillStyle = i % 2 ? P.a : stripeB; path(ctx, [G(-8, i * 1.2), G(9, i * 1.2), G(9, (i + 1) * 1.2), G(-8, (i + 1) * 1.2)]); ctx.fill(); }
  // textura (pasto, arena, roca, hielo…): puntitos claros y oscuros
  for (let n = 0; n < 900; n++) { const x = xa + hash(n * 1.7) * (xb - xa), y = HORIZON + hash(n * 3.3) * (yb - HORIZON), r = 1.5 + hash(n * 5.1) * 3.5; ctx.fillStyle = n % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y, r * 2, r); }
  // profundidad: más oscuro hacia el fondo
  const g = ctx.createLinearGradient(0, HORIZON, 0, yb); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.35, 'rgba(0,0,0,0.1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(xa, HORIZON, xb - xa, yb - HORIZON);
  // las líneas: la del arco, el área chica, el área grande, el punto del penal y la medialuna
  ctx.strokeStyle = alpha(P.line, 0.88); ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const u = (m: number) => 0.5 + m / GOAL_M; // metros desde el medio del arco → u
  path(ctx, [G(-8, 0), G(9, 0)], false); ctx.stroke();
  path(ctx, [G(u(-5.5), 0), G(u(-5.5), 2.4), G(u(5.5), 2.4), G(u(5.5), 0)], false); ctx.stroke();
  path(ctx, [G(u(-14), 0), G(u(-14), 8.2), G(u(14), 8.2), G(u(14), 0)], false); ctx.stroke();
  const arc: P2[] = []; for (let k = 0; k <= 40; k++) { const a = -0.95 + 1.9 * k / 40, d = 6 + Math.cos(a) * 3.6; if (d >= 8.2) arc.push(G(u(Math.sin(a) * 3.6), d)); }
  if (arc.length > 1) { path(ctx, arc, false); ctx.stroke(); }
  ctx.fillStyle = alpha(P.line, 0.9); ctx.beginPath(); ctx.ellipse(SPOT[0], SPOT[1], 15, 8, 0.3, 0, TAU); ctx.fill();
  // brillo de las líneas (de noche)
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(P.line, 0.1); ctx.lineWidth = 22; path(ctx, [G(-8, 0), G(9, 0)], false); ctx.stroke();
  ctx.restore();
  // los carteles en el fondo, donde termina la cancha
  const bh = 52; ctx.fillStyle = P.board; ctx.fillRect(xa, HORIZON - bh, xb - xa, bh);
  const gb = ctx.createLinearGradient(0, HORIZON - bh, 0, HORIZON); gb.addColorStop(0, 'rgba(255,255,255,0.16)'); gb.addColorStop(0.5, 'rgba(255,255,255,0)'); gb.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = gb; ctx.fillRect(xa, HORIZON - bh, xb - xa, bh);
  ctx.fillStyle = P.glow; ctx.fillRect(xa, HORIZON - bh, xb - xa, 3); ctx.fillRect(xa, HORIZON - 3, xb - xa, 3);
  ctx.font = '900 30px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (let x = xa - ((xa % 520) + 520) % 520, n = 0; x < xb; x += 520, n++) {
    ctx.fillStyle = n % 2 ? alpha(P.line, 0.9) : P.glow; ctx.fillText(n % 2 ? 'KOMBAT PENALES' : '★ KOMBAT ★', x + 30, HORIZON - bh / 2 + 1);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createLinearGradient(0, HORIZON - bh - 30, 0, HORIZON - bh + 10); gl.addColorStop(0, alpha(P.glow, 0)); gl.addColorStop(1, alpha(P.glow, 0.25)); ctx.fillStyle = gl; ctx.fillRect(xa, HORIZON - bh - 30, xb - xa, 40); ctx.restore();
  // la sombra del arco en el piso
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; path(ctx, [G(-0.02, 0), G(1.02, 0), G(1.02, -1.55), G(-0.02, -1.55)]); ctx.fill();
}
const bgCache = new Map<string, HTMLCanvasElement>();
// El fondo del estadio y la cancha, en su propia capa (se pinta una vez por estadio y tamaño).
export function drawPenBackdrop(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  const key = `${stage}:${w}x${h}`;
  let c = bgCache.get(key);
  if (!c && typeof document !== 'undefined') {
    const cc = document.createElement('canvas'); cc.width = Math.max(1, w); cc.height = Math.max(1, h);
    const g = cc.getContext('2d'); if (!g) return;
    const v = penView(w, h), ok = paintBackdrop(g, stage, w, h, toScreen(v, [0, HORIZON - 40])[1]);
    if (!ok) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, THEMES[stage].sky[0]); gr.addColorStop(1, THEMES[stage].sky[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.save(); g.translate(v.ox, v.oy); g.scale(v.k, v.k);
    const [xa] = toWorld(v, 0, 0), [xb, yb] = toWorld(v, w, h);
    drawField(g, stage, xa - 10, xb + 10, yb + 10);
    g.restore();
    if (ok) { if (bgCache.size > 6) bgCache.clear(); bgCache.set(key, cc); }
    c = cc;
  }
  ctx.clearRect(0, 0, w, h);
  if (c) ctx.drawImage(c, 0, 0);
}

// ---------------------------------------------------------------- La red que se mueve
// La red se dibuja en una grilla de triángulos; cada punto se corre según qué tan cerca está de donde pegó la pelota
// (hacia el fondo, con un rebote que se va apagando). El marco va encima, quieto.
const NX = 26, NY = 14, SX0 = 140, SY0 = 0, SW = 1420, SH = 890;
function netDisp(x: number, y: number, hit: P2, t: number): P2 {
  const dx = x - hit[0], dy = y - hit[1], f = Math.exp(-(dx * dx + dy * dy) / (2 * 300 * 300));
  const a = (300 * Math.exp(-2.2 * t) * Math.cos(10 * t) + 70 * Math.exp(-1.1 * t)) * f; // empuje fuerte que rebota + lo que queda colgando
  const ripple = 34 * Math.exp(-2 * t) * Math.sin(Math.hypot(dx, dy) / 45 - t * 16) * Math.exp(-(dx * dx + dy * dy) / (2 * 420 * 420));
  const n = Math.hypot(DEPTH[0], DEPTH[1]), ux = DEPTH[0] / n, uy = DEPTH[1] / n;
  return [ux * (a + ripple) + 0, uy * (a + ripple) + Math.abs(a) * 0.35 + ripple * 0.4];
}
function drawNet(ctx: CanvasRenderingContext2D, im: HTMLImageElement, hit: P2 | null, t: number) {
  if (!hit || t > 3) { ctx.drawImage(im, 0, 0); return; }
  const cw = SW / NX, ch = SH / NY, pts: P2[][] = [];
  for (let j = 0; j <= NY; j++) { const row: P2[] = []; for (let i = 0; i <= NX; i++) { const x = SX0 + i * cw, y = SY0 + j * ch, d = netDisp(x, y, hit, t); row.push([x + d[0], y + d[1]]); } pts.push(row); }
  // afuera de la grilla, la imagen tal cual
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, im.width, im.height); ctx.rect(SX0, SY0, SW, SH); ctx.clip('evenodd'); ctx.drawImage(im, 0, 0); ctx.restore();
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x0 = SX0 + i * cw, y0 = SY0 + j * ch, a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
    const still = Math.max(Math.abs(a[0] - x0), Math.abs(a[1] - y0), Math.abs(c[0] - x0 - cw), Math.abs(c[1] - y0 - ch), Math.abs(b[0] - x0 - cw), Math.abs(d[1] - y0 - ch)) < 0.6;
    if (still) { ctx.drawImage(im, x0, y0, cw, ch, x0, y0, cw + 0.5, ch + 0.5); continue; }
    tri(ctx, im, [x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], a, b, c);
    tri(ctx, im, [x0, y0], [x0 + cw, y0 + ch], [x0, y0 + ch], a, c, d);
  }
}
// Un triángulo de la imagen (s0 s1 s2) llevado a otro lugar (d0 d1 d2).
function tri(ctx: CanvasRenderingContext2D, im: HTMLImageElement, s0: P2, s1: P2, s2: P2, d0: P2, d1: P2, d2: P2) {
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, grow = (p: P2): P2 => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.8, p[1] + dy / l * 0.8]; };
  const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2);
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]); if (Math.abs(den) < 1e-6) return;
  const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
  const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
  const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
  const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
  const e = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  const f = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  ctx.save(); ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c, d, e, f); ctx.drawImage(im, 0, 0); ctx.restore();
}

// ---------------------------------------------------------------- Dónde está cada uno en cada momento
const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 2.2);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
// El que patea: pies, acción y el tiempo de la patada.
function kickerState(m: PenMatch, side: 0 | 1) {
  const k = m.kick;
  if (!k || k.shooter !== side) return null;
  if (k.boom) return { gone: true as const, x: KICK_AT[0], y: KICK_AT[1], action: 'idle' as const, kickT: 0 };
  if (k.t < T.run) { const e = k.t / T.run; return { gone: false as const, x: lerp(START[0], KICK_AT[0], e), y: lerp(START[1], KICK_AT[1], e), action: 'run' as const, kickT: 0 }; }
  if (k.t < T.run + 0.32) return { gone: false as const, x: KICK_AT[0], y: KICK_AT[1], action: 'kick' as const, kickT: Math.max(0, 0.3 - (k.t - T.run)) };
  if (!k.hit) return { gone: false as const, x: KICK_AT[0], y: KICK_AT[1], action: 'idle' as const, kickT: 0 };
  return { gone: false as const, x: KICK_AT[0], y: KICK_AT[1], action: (k.outcome === 'goal' ? 'celebrate' : 'sad') as 'celebrate' | 'sad', kickT: 0 };
}
// Para la lógica: dónde explota el que pateó (los pies y el alto del cuerpo, en px).
export const kickerBody = (char: CharId) => ({ x: KICK_AT[0], y: KICK_AT[1], h: 2.3 * SIZE[char] * PX_M });
// A dónde va el arquero: si ataja, al lugar del tiro (se acomoda en el aire); si no, a donde eligió.
function keeperGoal(m: PenMatch): Zone | null { const k = m.kick; return k ? (k.outcome === 'save' ? k.shot : k.dive) : null; }
interface KeeperPose { x: number; y: number; rot: number; hipY: number; action: 'keeper' | 'dive' | 'save' | 'celebrate' | 'sad' | 'idle' }
function keeperState(m: PenMatch, char: CharId): KeeperPose {
  const S = PX_M * BODY_SCALE * SIZE[char], hip = 0.66 * S, k = m.kick, z = keeperGoal(m);
  const stand: KeeperPose = { x: KEEPER[0], y: KEEPER[1], rot: 0, hipY: hip, action: 'keeper' };
  if (!k || z === null || k.t < T.dive) return stand;
  const col = colOf(z), row = rowOf(z), target = zonePoint(z), p = ease((k.t - T.dive) / T.diveDur);
  const front: P2 = [target[0] - DM[0] * 0.3, target[1] - DM[1] * 0.3];
  if (col === 1) { // al medio: salta derecho para arriba o se agacha
    if (row === 1) return { ...stand, action: 'save', hipY: hip * 0.75 };
    const up = Math.sin(Math.PI * clamp01((k.t - T.dive) / 0.9)) * Math.max(0, KEEPER[1] - hip - S * 0.9 - front[1]);
    const after = k.t > arriveAt() + 0.9;
    return { x: KEEPER[0], y: KEEPER[1] - up, rot: 0, hipY: hip, action: after ? (k.outcome === 'save' ? 'celebrate' : 'sad') : 'dive' };
  }
  // al costado: vuela estirado hacia el lugar, con las manos adelante
  const reach = 1.12 * S, base: P2 = [KEEPER[0], KEEPER[1] - hip];
  const dx = front[0] - base[0], dy = front[1] - base[1], dist = Math.hypot(dx, dy) || 1, rot = Math.atan2(dx, -dy);
  const hipTo: P2 = [front[0] - dx / dist * reach, front[1] - dy / dist * reach];
  const hx = lerp(base[0], hipTo[0], p);
  let hy = lerp(base[1], hipTo[1], p), r = rot * p;
  // cae al piso, acostado de costado
  const fall = ease((k.t - arriveAt() - 0.12) / 0.4); // (después de que llega la pelota)
  const groundHere = lerp(KEEPER[1], G(col === 0 ? 0.12 : 0.88, 0.32)[1], p);
  if (fall > 0) { hy = lerp(hy, groundHere - S * 0.28, fall); r = lerp(r, Math.sign(rot) * Math.PI / 2, fall); }
  // se levanta y festeja (o se lamenta)
  const rise = ease((k.t - arriveAt() - 1.0) / 0.35);
  if (rise > 0) { hy = lerp(hy, groundHere - hip, rise); r = lerp(r, 0, rise); }
  return { x: hx, y: hy + hip, rot: r, hipY: hip, action: rise >= 1 ? (k.outcome === 'save' ? 'celebrate' : 'sad') : 'dive' };
}
// La pelota: en el punto, volando, en la red o rebotando. inside = ya pasó la línea (va detrás del marco).
function ballState(m: PenMatch): { x: number; y: number; r: number; spin: number; inside: boolean; shadow: P2; alpha: number } {
  const k = m.kick, rest = { x: SPOT[0], y: SPOT[1] - BALL_R, r: BALL_R, spin: 0, inside: false, shadow: SPOT, alpha: 1 };
  if (!k || k.t < T.contact) return rest;
  const target = zonePoint(k.shot), col = colOf(k.shot), u = ZONE_U[col];
  const end: P2 = k.outcome === 'goal' ? target : [target[0] - DM[0] * 0.3, target[1] - DM[1] * 0.3];
  const f = (k.t - T.contact) / T.flight;
  if (f < 1) {
    const x = lerp(SPOT[0], end[0], f), y = lerp(SPOT[1] - BALL_R, end[1], f) - Math.sin(Math.PI * f) * (rowOf(k.shot) === 0 ? 70 : 30);
    return { x, y, r: BALL_R * lerp(1, 0.86, f), spin: k.t * 24, inside: false, shadow: lerp2(SPOT, G(u, k.outcome === 'goal' ? 0 : 0.3), f), alpha: 1 };
  }
  const a = k.t - arriveAt();
  if (k.outcome === 'goal') {
    const back: P2 = [target[0] + DEPTH[0] * BACK_K, target[1] + DEPTH[1] * BACK_K];
    if (a < 0.12) { const e = a / 0.12; return { x: lerp(target[0], back[0], e), y: lerp(target[1], back[1], e), r: BALL_R * 0.86, spin: k.t * 24, inside: true, shadow: lerp2(G(u, 0), G(u, -0.75), e), alpha: 1 }; }
    // empuja la red y cae adentro del arco
    const d = netDisp(back[0], back[1], back, a - 0.12), floor = G(u, -0.75)[1] - BALL_R * 0.86, tt = a - 0.12;
    const fallY = Math.min(floor, back[1] + d[1] * 0.4 + 0.5 * 1800 * tt * tt);
    return { x: back[0] + d[0] * 0.3, y: fallY, r: BALL_R * 0.86, spin: k.t * 24 * Math.exp(-tt * 3), inside: true, shadow: G(u, -0.75), alpha: 1 };
  }
  // atajada: sale rebotando para el costado
  const vx = col === 0 ? -620 : col === 2 ? 620 : (rowOf(k.shot) === 0 ? 120 : -260), vy = rowOf(k.shot) === 0 ? -900 : -520;
  const gy = KEEPER[1] + 40 - BALL_R;
  let y = end[1] + vy * a + 0.5 * 2400 * a * a;
  if (y > gy) y = gy - Math.abs(Math.sin(a * 6)) * 40 * Math.exp(-a * 2);
  return { x: end[0] + vx * a, y, r: BALL_R * 0.86, spin: k.t * 24, inside: false, shadow: [end[0] + vx * a, gy + BALL_R], alpha: clamp01(2.2 - a * 1.2) };
}

// ---------------------------------------------------------------- Dibujo
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, a = 1) {
  const im = img('ball');
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(spin);
  if (im) ctx.drawImage(im, -r, -r, r * 2, r * 2);
  else { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, TAU); ctx.fill(); }
  ctx.rotate(-spin); const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
}
const NOFX = { power: 0, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: null };
function drawKeeper(ctx: CanvasRenderingContext2D, m: PenMatch, char: CharId, rim: string) {
  const st = keeperState(m, char), f = idleFighter(char);
  f.facing = -1; f.action = st.action; f.ground = st.rot === 0;
  // sombra en el piso (queda abajo aunque vuele)
  const gy = m.kick ? Math.max(st.y, KEEPER[1]) : KEEPER[1], S = PX_M * BODY_SCALE * SIZE[char];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(st.x, Math.min(gy, st.y + 400), S * 0.5 + Math.abs(Math.sin(st.rot)) * S * 0.7, S * 0.09, 0.3, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(st.x, st.y - st.hipY); ctx.rotate(st.rot);
  drawFighterLit(ctx, f, m.time + 0.4, NOFX, 0, st.hipY, PX_M, rim, true);
  ctx.restore();
}
function drawKicker(ctx: CanvasRenderingContext2D, m: PenMatch, side: 0 | 1, char: CharId, rim: string) {
  const st = kickerState(m, side) ?? { gone: false, x: START[0], y: START[1], action: 'idle' as const, kickT: 0 };
  if (st.gone) return;
  const f = idleFighter(char); f.facing = 1; f.action = st.action; f.kickT = st.kickT; f.kickKind = 'normal';
  drawFighterLit(ctx, f, m.time, NOFX, st.x, st.y, PX_M, rim);
}
function drawGore(ctx: CanvasRenderingContext2D, m: PenMatch) {
  for (const st of m.gore.stains) {
    const a = st.t < 25 ? 0.85 : Math.max(0, 0.85 * (1 - (st.t - 25) / 10)), r = st.r * Math.min(1, st.t * 8 + 0.3);
    ctx.fillStyle = `rgba(110,4,10,${a})`; ctx.beginPath();
    for (let k = 0; k < 9; k++) { const ang = k / 9 * TAU, rr = r * (0.7 + ((Math.sin(st.seed * 7 + k * 3.1) + 1) / 2) * 0.5); ctx.lineTo(st.x + Math.cos(ang) * rr, st.y + Math.sin(ang) * rr * 0.45); }
    ctx.closePath(); ctx.fill();
  }
}
function drawFlying(ctx: CanvasRenderingContext2D, m: PenMatch) {
  const U = PX_M * 1.5;
  for (const g of m.gore.gibs) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 18, 6, 0, 0, TAU); ctx.fill(); }
  for (const g of m.gore.gibs) { ctx.save(); ctx.translate(g.x, g.y - g.z - 8); ctx.scale(U, U); ctx.rotate(g.a); drawGib(ctx, g.kind, g.c); ctx.restore(); }
  ctx.fillStyle = '#b10f1c';
  for (const d of m.gore.drops) { ctx.beginPath(); ctx.ellipse(d.x, d.y - d.z, d.r, d.r * 1.25, Math.atan2(-d.vz, d.vx) + Math.PI / 2, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of m.sparks) { const k = 1 - s.life / s.max; ctx.fillStyle = alpha(s.color, k); ctx.fillRect(s.x - s.size / 2, s.y - s.z - s.size / 2, s.size, s.size); }
  ctx.restore();
}
// Los 6 lugares del arco mientras se elige (el marcado, más grande).
function drawTargets(ctx: CanvasRenderingContext2D, m: PenMatch, cursor: Zone | null, color: string) {
  for (let z = 0 as Zone; z < 6; z = (z + 1) as Zone) {
    const [x, y] = zonePoint(z), on = z === cursor, r = on ? 62 : 46, pulse = on ? 1 + Math.sin(m.time * 8) * 0.06 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse * 0.92);
    ctx.fillStyle = on ? alpha(color, 0.35) : 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = on ? color : 'rgba(255,255,255,0.7)'; ctx.lineWidth = on ? 9 : 5; ctx.setLineDash(on ? [] : [14, 10]); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = on ? 6 : 4; ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(r * 0.45, 0); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45); ctx.stroke();
    ctx.restore();
  }
}
export interface PenDrawOpts { cursor?: Zone | null; cursorColor?: string; showTargets?: boolean; netHit?: { at: P2; t: number } | null }
export function drawPenalties(ctx: CanvasRenderingContext2D, m: PenMatch, w: number, h: number, opts: PenDrawOpts = {}) {
  const v = penView(w, h), rim = THEMES[m.stage].light, k = m.kick;
  const shooter: 0 | 1 = k ? k.shooter : (m.turn % 2 === 0 ? 0 : 1), keeperSide: 0 | 1 = shooter === 0 ? 1 : 0;
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * 14, (Math.random() - 0.5) * m.shake * 14);
  ctx.translate(v.ox, v.oy); ctx.scale(v.k, v.k);
  drawGore(ctx, m);
  const net = img('net'), frame = img('frame'), b = ballState(m);
  // la red (deformada si acaba de entrar la pelota), la pelota si está adentro, y el marco encima
  let hit: P2 | null = null, ht = 0;
  if (k && k.outcome === 'goal' && k.t >= arriveAt() + 0.1) { const tg = zonePoint(k.shot); hit = [tg[0] + DEPTH[0] * BACK_K, tg[1] + DEPTH[1] * BACK_K]; ht = k.t - arriveAt() - 0.1; }
  if (net) drawNet(ctx, net, hit, ht);
  if (b.inside) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.shadow[0], b.shadow[1], b.r * 1.1, b.r * 0.35, 0.3, 0, TAU); ctx.fill(); drawBall(ctx, b.x, b.y, b.r, b.spin); }
  if (frame) ctx.drawImage(frame, 0, 0);
  // el arquero, el que patea y la pelota (si todavía no entró)
  drawKeeper(ctx, m, m.chars[keeperSide], rim);
  drawKicker(ctx, m, shooter, m.chars[shooter], rim);
  if (!b.inside) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 * b.alpha})`; ctx.beginPath(); ctx.ellipse(b.shadow[0], b.shadow[1], b.r * 1.1, b.r * 0.35, 0.3, 0, TAU); ctx.fill();
    drawBall(ctx, b.x, b.y, b.r, b.spin, b.alpha);
  }
  if (opts.showTargets) drawTargets(ctx, m, opts.cursor ?? null, opts.cursorColor ?? '#facc15');
  // el destello de la explosión
  if (k?.boom && k.t < arriveAt() + T.boom + 0.5) {
    const e = (k.t - arriveAt() - T.boom) / 0.5, c = kickerBody(m.chars[k.shooter]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, c.x, c.y - c.h * 0.55, 260 + e * 200, '#fb923c', 0.9 * (1 - e)); bloom(ctx, c.x, c.y - c.h * 0.55, 120, '#fff7d6', 0.9 * (1 - e)); ctx.restore();
  }
  drawFlying(ctx, m);
  ctx.restore();
  // la sangre en la pantalla, el flash y la viñeta
  drawScreenBlood(ctx, m.screenBlood, { w, h } as View);
  if (m.flash > 0) { ctx.fillStyle = `rgba(255,240,220,${m.flash * 0.45})`; ctx.fillRect(0, 0, w, h); }
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.45, w / 2, h * 0.55, Math.max(w, h) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  void opts.netHit; void darken; void LOOKS;
}
// El lugar del arco más cercano a un punto de la pantalla (para elegir tocando el arco).
export function zoneAt(v: PView, sx: number, sy: number): Zone | null {
  const [x, y] = toWorld(v, sx, sy); let best: Zone | null = null, bd = 120 * 120;
  for (let z = 0 as Zone; z < 6; z = (z + 1) as Zone) { const p = zonePoint(z), d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = z; } }
  return best;
}
// Miniatura del estadio: el fondo, la cancha y el arco.
export function drawPenThumb(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  drawPenBackdrop(ctx, stage, w, h);
  const v = penView(w, h), net = img('net'), frame = img('frame');
  ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.k, v.k); if (net) ctx.drawImage(net, 0, 0); if (frame) ctx.drawImage(frame, 0, 0); drawBall(ctx, SPOT[0], SPOT[1] - BALL_R, BALL_R, 0); ctx.restore();
}
export { setLowFx };
