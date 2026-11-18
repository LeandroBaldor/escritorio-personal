// Cómo se ve Kombat Penales. Todo se mide en los píxeles del dibujo del arco (arco-red.webp / arco-marco.webp, de
// 1774 × 887, el PNG que pasó el usuario): el arco se ve en diagonal, así que la cancha se dibuja con esa misma
// inclinación (las franjas del pasto y las líneas paralelas a la línea del arco). Atrás, el fondo pintado del
// estadio (los mismos 16 de Kombat Football) y la cancha con los colores de cada uno. El que patea viene corriendo
// desde la izquierda y el arquero espera en la línea, mirándolo. La red se deforma cuando entra la pelota (el marco
// queda quieto encima) y si el arquero ataja, el que pateó explota en pedazos de esqueleto y sangre.
import { type CharId, type StageId } from './kombat';
import { T, arriveAt, colOf, fxOfTurn, keeperBlewIt, rowOf, type BallFx, type PenKick, type PenMatch, type Zone } from './kombatPenalties';
import { THEMES } from './kombatArt';
import { PITCH } from './kombatSoccerArt';
import { BODY_SCALE, LOOKS, drawFighterLit, drawFighterShape, idleFighter, setLowFx } from './kombatFighters';
import { alpha, bloom, darken, lighten } from './gravityMonsters';
import { backdropFloor, backdropImage } from './kombatScenery';
import { SIZE } from './kombat';
import { drawPenDeath, drawPenDeathAtmosphere } from './kombatPenDeathsArt';
import { drawPenBlood, drawPenGib, drawPenProfileSkeleton, drawPenScreenBlood } from './kombatPenGoreArt';
import { drawPenUfo, preloadPenUfo } from './kombatPenUfo';
import { drawPenStomp, preloadPenStomp } from './kombatPenStomp';
import netUrl from './assets/penales/arco-red.webp';
import frameUrl from './assets/penales/arco-marco.webp';
import ballUrl from './assets/penales/pelota.webp';
import ref1Url from './assets/penales/arbitro-nuevo-1.png';
import ref2Url from './assets/penales/arbitro-nuevo-2.png';

const TAU = Math.PI * 2;
type P2 = [number, number];
export const PX_M = 160; // píxeles por metro (de alto)
const FPX = PX_M * 0.78; // los luchadores, un poco más chicos que la escala del arco
// La boca del arco (bordes de adentro de los palos y del travesaño) y la profundidad (del frente al fondo de la red).
const FL: P2 = [290, 560], FR: P2 = [1185, 838], TL: P2 = [290, 102], TR: P2 = [1185, 352];
const DEPTH: P2 = [232, -75];
const DM: P2 = [155, -50]; // un metro hacia el fondo
const GOAL_M = 6; // ancho del arco en metros
export const HORIZON = 360; // donde empieza la cancha (se funde con el fondo pintado hasta FADE)
const FADE = 540;
const BOUNDS = { x0: -880, x1: 1580, y0: -250, y1: 1130 }; // (arriba queda lugar para el marcador)
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
const KICK_AT: P2 = [SPOT[0] - 86, SPOT[1] - 6];
const START: P2 = [SPOT[0] - 590, SPOT[1] + 75]; // espera bien lejos de la pelota
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
type ImgKey = 'net' | 'frame' | 'ball' | 'ref1' | 'ref2';
const URLS: Record<ImgKey, string> = { net: netUrl, frame: frameUrl, ball: ballUrl, ref1: ref1Url, ref2: ref2Url };
const imgs: Record<ImgKey, HTMLImageElement | null> = { net: null, frame: null, ball: null, ref1: null, ref2: null };
const listeners = new Set<() => void>();
function img(key: ImgKey) {
  if (typeof Image === 'undefined') return null;
  if (!imgs[key]) { const i = new Image(); i.decoding = 'async'; i.onload = () => listeners.forEach(f => f()); i.src = URLS[key]; imgs[key] = i; }
  const i = imgs[key]!; return i.complete && i.naturalWidth > 0 ? i : null;
}
export function preloadPenaltyArt() { preloadPenUfo(); preloadPenStomp(); (Object.keys(URLS) as ImgKey[]).forEach(img); }
export function onPenaltyArtLoad(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

// ---------------------------------------------------------------- La cancha (va en la capa del fondo)
function path(ctx: CanvasRenderingContext2D, pts: P2[], closed = true) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (closed) ctx.closePath(); }
function drawField(ctx: CanvasRenderingContext2D, stage: StageId, xa: number, xb: number, yb: number) {
  const P = PITCH[stage], im = backdropImage(stage), fy = backdropFloor(stage);
  ctx.save(); ctx.beginPath(); ctx.rect(xa, HORIZON, xb - xa, yb - HORIZON); ctx.clip();
  ctx.fillStyle = P.surround; ctx.fillRect(xa, HORIZON, xb - xa, yb - HORIZON);
  // el piso del mismo fondo pintado (su textura: piedra, metal, arena, hielo…), estirado sobre la cancha
  if (im) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, fy + 8, im.naturalWidth, im.naturalHeight - fy - 8, xa, HORIZON, xb - xa, yb - HORIZON); }
  // franjas paralelas a la línea del arco, transparentes (se ve el piso del fondo debajo)
  ctx.globalAlpha = 0.38;
  const stripeB = lighten(P.b, 0.1);
  for (let i = -14; i < 18; i++) { ctx.fillStyle = i % 2 ? P.a : stripeB; path(ctx, [G(-8, i * 1.2), G(9, i * 1.2), G(9, (i + 1) * 1.2), G(-8, (i + 1) * 1.2)]); ctx.fill(); }
  ctx.globalAlpha = 1;
  // profundidad: más oscuro hacia el fondo
  const g = ctx.createLinearGradient(0, HORIZON, 0, yb); g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(0.35, 'rgba(0,0,0,0.06)'); g.addColorStop(0.7, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; ctx.fillRect(xa, HORIZON, xb - xa, yb - HORIZON);
  // las líneas: la del arco, el área chica, el área grande, el punto del penal y la medialuna
  ctx.strokeStyle = alpha(P.line, 0.9); ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const u = (m: number) => 0.5 + m / GOAL_M; // metros desde el medio del arco → u
  path(ctx, [G(-8, 0), G(9, 0)], false); ctx.stroke();
  path(ctx, [G(u(-5.5), 0), G(u(-5.5), 2.4), G(u(5.5), 2.4), G(u(5.5), 0)], false); ctx.stroke();
  path(ctx, [G(u(-14), 0), G(u(-14), 8.2), G(u(14), 8.2), G(u(14), 0)], false); ctx.stroke();
  const arc: P2[] = []; for (let k = 0; k <= 40; k++) { const a = -0.95 + 1.9 * k / 40, d = 6 + Math.cos(a) * 3.6; if (d >= 8.2) arc.push(G(u(Math.sin(a) * 3.6), d)); }
  if (arc.length > 1) { path(ctx, arc, false); ctx.stroke(); }
  ctx.fillStyle = alpha(P.line, 0.9); ctx.beginPath(); ctx.ellipse(SPOT[0], SPOT[1], 15, 8, 0.3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(P.glow, 0.12); ctx.lineWidth = 22; path(ctx, [G(-8, 0), G(9, 0)], false); ctx.stroke();
  ctx.restore();
  // la sombra del arco en el piso
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; path(ctx, [G(-0.02, 0), G(1.02, 0), G(1.02, -1.55), G(-0.02, -1.55)]); ctx.fill();
}
const bgCache = new Map<string, HTMLCanvasElement>();
// El fondo del estadio y la cancha, en su propia capa (se pinta una vez por estadio y tamaño).
export function drawPenBackdrop(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  const key = `${stage}:${w}x${h}`;
  let c = bgCache.get(key);
  if (!c && typeof document !== 'undefined') {
    const cc = document.createElement('canvas'); cc.width = Math.max(1, w); cc.height = Math.max(1, h);
    const g = cc.getContext('2d'); if (!g) return;
    const im = backdropImage(stage), v = penView(w, h);
    // el fondo pintado completo, sin agrandarlo de más (cubre la pantalla y queda nítido)
    if (im) { const kk = Math.max(w / im.naturalWidth, h / im.naturalHeight); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, (w - im.naturalWidth * kk) / 2, (h - im.naturalHeight * kk) / 2, im.naturalWidth * kk, im.naturalHeight * kk); }
    else { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, THEMES[stage].sky[0]); gr.addColorStop(1, THEMES[stage].sky[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    // la cancha va en otra capa y se funde con el fondo arriba (sin carteles que lo tapen)
    const fc = document.createElement('canvas'); fc.width = cc.width; fc.height = cc.height;
    const f = fc.getContext('2d');
    if (f) {
      f.save(); f.translate(v.ox, v.oy); f.scale(v.k, v.k);
      const [xa] = toWorld(v, 0, 0), [xb, yb] = toWorld(v, w, h);
      drawField(f, stage, xa - 10, xb + 10, yb + 10);
      f.restore();
      const y0 = toScreen(v, [0, HORIZON])[1], y1 = toScreen(v, [0, FADE])[1];
      const m = f.createLinearGradient(0, y0, 0, y1); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      f.globalCompositeOperation = 'destination-in'; f.fillStyle = m; f.fillRect(0, 0, w, h);
      g.globalAlpha = 0.94; g.drawImage(fc, 0, 0); g.globalAlpha = 1;
    }
    if (im) { if (bgCache.size > 6) bgCache.clear(); bgCache.set(key, cc); }
    c = cc;
  }
  ctx.clearRect(0, 0, w, h);
  if (c) ctx.drawImage(c, 0, 0);
}

// ---------------------------------------------------------------- La red que se mueve
// La red se dibuja en una grilla de triángulos; cada punto se corre según qué tan cerca está de donde pegó la pelota
// (hacia el fondo, con un rebote que se va apagando). El marco va encima, quieto.
const NX = 40, NY = 22, SX0 = 140, SY0 = 0, SW = 1420, SH = 890;
// Donde la red está atada al arco: ahí no se mueve (y se suelta de a poco al alejarse). Los palos y el travesaño
// de adelante sostienen fuerte; los caños del piso y los de atrás, un poco menos (así igual se hunde en el medio).
const ANCHORS: [P2, P2, number][] = [
  [[258, 30], [258, 590], 170], [[262, 70], [1218, 330], 170], [[1218, 320], [1218, 860], 170], // palos y travesaño
  [[258, 575], [490, 500], 80], [[490, 500], [1510, 755], 80], [[1218, 850], [1510, 755], 80], // caños del piso
  [[455, 150], [490, 500], 85], [[1355, 280], [1510, 755], 85], [[440, 20], [1355, 280], 95], [[262, 50], [440, 20], 95], [[1218, 320], [1355, 280], 95], // caños de atrás y de arriba
];
function anchorK(x: number, y: number) {
  let k = 1;
  for (const [a, b, r] of ANCHORS) {
    const vx = b[0] - a[0], vy = b[1] - a[1], q = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)));
    const d = Math.hypot(x - a[0] - vx * q, y - a[1] - vy * q), e = Math.min(1, d / r);
    k = Math.min(k, e * e * (3 - 2 * e));
  }
  return k;
}
function netDisp(x: number, y: number, hit: P2, t: number): P2 {
  const dx = x - hit[0], dy = y - hit[1], f = Math.exp(-(dx * dx + dy * dy) / (2 * 300 * 300));
  const a = (300 * Math.exp(-2.2 * t) * Math.cos(10 * t) + 70 * Math.exp(-1.1 * t)) * f; // empuje fuerte que rebota + lo que queda colgando
  const ripple = 34 * Math.exp(-2 * t) * Math.sin(Math.hypot(dx, dy) / 45 - t * 16) * Math.exp(-(dx * dx + dy * dy) / (2 * 420 * 420));
  const n = Math.hypot(DEPTH[0], DEPTH[1]), ux = DEPTH[0] / n, uy = DEPTH[1] / n;
  const k = anchorK(x, y);
  return [k * ux * (a + ripple), k * (uy * (a + ripple) + Math.abs(a) * 0.35 + ripple * 0.4)];
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
export const kickerBody = (char: CharId) => ({ x: KICK_AT[0], y: KICK_AT[1], h: 2.3 * SIZE[char] * FPX });
// A dónde va el arquero: si ataja, al lugar del tiro (se acomoda en el aire); si no, a donde eligió.
function keeperGoal(m: PenMatch): Zone | null { const k = m.kick; return k ? (k.outcome === 'save' ? k.shot : k.dive) : null; }
interface KeeperPose { x: number; y: number; rot: number; hipY: number; action: 'keeper' | 'gather' | 'dive' | 'save' | 'celebrate' | 'sad' | 'idle'; prog: number }
const ANTIC = 0.26; // cuánto antes se agacha para saltar
const easeInOut = (k: number) => { const x = clamp01(k); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
function keeperState(m: PenMatch, char: CharId): KeeperPose {
  const S = FPX * BODY_SCALE * SIZE[char], hip = 0.66 * S, k = m.kick, z = keeperGoal(m);
  const stand: KeeperPose = { x: KEEPER[0], y: KEEPER[1], rot: 0, hipY: hip, action: 'keeper', prog: 0 };
  if (!k || z === null || k.t < T.dive - ANTIC) return stand;
  const col = colOf(z), row = rowOf(z), side = col === 0 ? -1 : col === 2 ? 1 : 0, target = zonePoint(z);
  // 1) se agacha y carga el peso para el lado al que se va a tirar
  if (k.t < T.dive) { const e = Math.sin(((k.t - T.dive + ANTIC) / ANTIC) * Math.PI / 2); return { x: KEEPER[0] + side * S * 0.1 * e, y: KEEPER[1], rot: side * 0.1 * e, hipY: hip, action: 'gather', prog: e }; }
  const d = (k.t - T.dive) / T.diveDur, p = ease(d), result = k.outcome === 'save' ? 'celebrate' as const : 'sad' as const;
  const front: P2 = [target[0] - DM[0] * 0.3, target[1] - DM[1] * 0.3];
  if (col === 1) { // al medio: salta derecho para arriba (o se tira abajo)
    if (row === 1) return { ...stand, action: k.t > arriveAt() + 0.9 ? result : 'save', hipY: hip * 0.75, prog: 1 };
    const jt = clamp01((k.t - T.dive) / 0.9), up = Math.sin(Math.PI * jt) * Math.max(0, KEEPER[1] - hip - S * 0.9 - front[1]);
    const landed = jt >= 1, sq = landed ? Math.max(0, 1 - (k.t - T.dive - 0.9) * 5) : 0; // al caer amortigua un poquito
    return { x: KEEPER[0], y: KEEPER[1] - up, rot: Math.sin(jt * Math.PI) * 0.05, hipY: hip, action: landed && sq <= 0 ? (k.t > arriveAt() + 0.9 ? result : 'keeper') : landed ? 'gather' : 'dive', prog: landed ? sq : clamp01(jt * 2) };
  }
  // 2) vuela hacia el lugar: despega, sube en arco y el cuerpo va girando de a poco hasta quedar estirado
  const reach = 1.12 * S, base: P2 = [KEEPER[0], KEEPER[1] - hip];
  const dx = front[0] - base[0], dy = front[1] - base[1], dist = Math.hypot(dx, dy) || 1, rot = Math.atan2(dx, -dy);
  const hipTo: P2 = [front[0] - dx / dist * reach, front[1] - dy / dist * reach];
  let hx = lerp(base[0], hipTo[0], p), hy = lerp(base[1], hipTo[1], p) - Math.sin(Math.PI * clamp01(d)) * S * (row === 0 ? 0.22 : 0.38), r = rot * easeInOut(d * 1.1);
  // un estirón extra cuando llega la pelota
  const stretch = Math.max(0, 1 - Math.abs(k.t - arriveAt()) * 6); hx += Math.sin(rot) * S * 0.06 * stretch; hy -= Math.cos(rot) * S * 0.06 * stretch;
  // 3) cae al piso con la gravedad, rebota un poquito y se desliza
  const groundHere = lerp(KEEPER[1], G(col === 0 ? 0.12 : 0.88, 0.32)[1], p), landT = arriveAt() + 0.08, fallDur = 0.38;
  const f = clamp01((k.t - landT) / fallDur);
  if (f > 0) {
    const g = f * f, lieY = groundHere - S * 0.28;
    hy = lerp(hy, lieY, g); r = lerp(r, side * (Math.PI / 2), easeInOut(f)) + side * 0.14 * Math.sin(f * Math.PI);
    hx += side * S * 0.3 * ease(f);
    if (f >= 1) { const tau = k.t - landT - fallDur; hy = lieY - Math.abs(Math.sin(tau * 13)) * S * 0.08 * Math.exp(-tau * 7); hx += side * S * 0.12 * (1 - Math.exp(-tau * 5)); }
  }
  // 4) se levanta y festeja (o se lamenta)
  const rise = ease((k.t - arriveAt() - 1.05) / 0.4);
  if (rise > 0) { hy = lerp(hy, groundHere - hip, rise); r = lerp(r, 0, rise); }
  return { x: hx, y: hy + hip, rot: r, hipY: hip, action: rise >= 1 ? result : rise > 0 ? 'gather' : 'dive', prog: rise > 0 ? 1 - rise : clamp01(d * 1.5) };
}
// Para la lógica: dónde explota el arquero (el piso debajo de la cadera y el alto del cuerpo).
export function keeperBody(m: PenMatch, char: CharId) {
  const st = keeperState(m, char), hx = st.x + Math.sin(st.rot) * 0, hy = st.y - st.hipY, ground = Math.max(hy + st.hipY * 0.5, Math.min(st.y, KEEPER[1] + 60));
  return { x: hx, y: ground, h: Math.max(st.hipY * 1.4, (ground - hy) * 2) };
}
// La pelota: en el punto, volando, en la red o rebotando. inside = ya pasó la línea (va detrás del marco).
type BallPos = { x: number; y: number; r: number; spin: number; inside: boolean; shadow: P2; alpha: number };
const ballState = (m: PenMatch): BallPos => ballAt(m.kick, m.kick?.t ?? 0);
function ballAt(k: PenKick | null, kt: number): BallPos {
  const rest = { x: SPOT[0], y: SPOT[1] - BALL_R, r: BALL_R, spin: 0, inside: false, shadow: SPOT, alpha: 1 };
  if (!k || kt < T.contact) return rest;
  const target = zonePoint(k.shot), col = colOf(k.shot), u = ZONE_U[col];
  const end: P2 = k.outcome === 'goal' ? target : [target[0] - DM[0] * 0.3, target[1] - DM[1] * 0.3];
  const f = (kt - T.contact) / T.flight;
  if (f < 1) {
    const x = lerp(SPOT[0], end[0], f), y = lerp(SPOT[1] - BALL_R, end[1], f) - Math.sin(Math.PI * f) * (rowOf(k.shot) === 0 ? 70 : 30);
    return { x, y, r: BALL_R * lerp(1, 0.86, f), spin: kt * 24, inside: false, shadow: lerp2(SPOT, G(u, k.outcome === 'goal' ? 0 : 0.3), f), alpha: 1 };
  }
  const a = kt - arriveAt();
  if (k.outcome === 'goal') {
    const back: P2 = [target[0] + DEPTH[0] * BACK_K, target[1] + DEPTH[1] * BACK_K];
    if (a < 0.12) { const e = a / 0.12; return { x: lerp(target[0], back[0], e), y: lerp(target[1], back[1], e), r: BALL_R * 0.86, spin: kt * 24, inside: true, shadow: lerp2(G(u, 0), G(u, -0.75), e), alpha: 1 }; }
    // empuja la red y cae adentro del arco
    const d = netDisp(back[0], back[1], back, a - 0.12), floor = G(u, -0.75)[1] - BALL_R * 0.86, tt = a - 0.12;
    const fallY = Math.min(floor, back[1] + d[1] * 0.4 + 0.5 * 1800 * tt * tt);
    return { x: back[0] + d[0] * 0.3, y: fallY, r: BALL_R * 0.86, spin: kt * 24 * Math.exp(-tt * 3), inside: true, shadow: G(u, -0.75), alpha: 1 };
  }
  // atajada: rebota hacia adelante (hacia el que pateó), pica unas veces en la cancha y queda ahí
  const g0 = G(u, 0.3), h0 = Math.max(0, g0[1] - end[1]);
  const dir: P2 = [-1, 0.22], dl = Math.hypot(dir[0], dir[1]); // hacia la izquierda de la cancha (para el lado del que pateó)
  const dist = 1100 * (1 - Math.exp(-1.5 * a)) / 1.5; // se va frenando (unos 4 m a la izquierda de donde atajó)
  const gx = g0[0] + dir[0] / dl * dist, gy = g0[1] + dir[1] / dl * dist;
  let z = h0, vz = rowOf(k.shot) === 0 ? 120 : 380;
  for (let tt = 0; tt < a; tt += 1 / 120) { vz -= 2400 / 120; z += vz / 120; if (z <= 0) { z = 0; vz = Math.abs(vz) * 0.5; if (vz < 60) vz = 0; } }
  return { x: gx, y: gy - z - BALL_R * 0.86, r: BALL_R * 0.86, spin: kt * 24 * Math.exp(-a * 1.2), inside: false, shadow: [gx, gy], alpha: 1 };
}
// El efecto de la pelota (va detrás): una estela de puntos tomados de dónde estuvo la pelota hace un ratito.
const jit = (n: number, t: number) => Math.sin(n * 12.9898 + Math.floor(t * 30) * 78.233) * 0.5 + Math.sin(n * 3.1 + t * 47) * 0.5;
function drawBallFx(ctx: CanvasRenderingContext2D, m: PenMatch, b: BallPos) {
  const k = m.kick, fx: BallFx = k?.fx ?? fxOfTurn(m.turn), t = m.time, r = b.r;
  const flying = !!k && k.t >= T.contact && k.t < arriveAt() + 0.6;
  const pts: P2[] = [[b.x, b.y]];
  if (flying && k) for (let j = 1; j <= 16; j++) { const q = ballAt(k, Math.max(T.contact, k.t - j * 0.016)); pts.push([q.x, q.y]); }
  const n = pts.length, fade = flying ? 1 : 0.55;
  ctx.save(); ctx.globalAlpha = b.alpha; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (w: number, c: string, off?: (i: number) => P2) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => { const o = off ? off(i) : [0, 0]; if (i) ctx.lineTo(p[0] + o[0], p[1] + o[1]); else ctx.moveTo(p[0] + o[0], p[1] + o[1]); }); ctx.stroke(); };
  switch (fx) {
    case 'fuego': {
      for (let i = n - 1; i >= 0; i--) { const q = 1 - i / n, [x, y] = pts[i], rr = r * (0.5 + q * 1.3) * (1 + jit(i, t) * 0.12); const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.4); g.addColorStop(0, `rgba(255,250,210,${0.75 * q})`); g.addColorStop(0.35, `rgba(253,186,60,${0.55 * q})`); g.addColorStop(0.7, `rgba(239,68,30,${0.35 * q})`); g.addColorStop(1, 'rgba(120,20,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr * 1.4, 0, TAU); ctx.fill(); }
      for (let e = 0; e < 7; e++) { const ph = (t * 1.7 + e / 7) % 1, a = e * 2.4 + t, x = b.x + Math.cos(a) * r * (0.8 + ph), y = b.y - ph * r * 3 * fade - Math.sin(a) * r * 0.5; ctx.fillStyle = `rgba(253,224,71,${(1 - ph) * 0.85})`; ctx.fillRect(x - 3, y - 3, 6, 6); }
      bloom(ctx, b.x, b.y, r * 3, '#f97316', 0.45 * fade); break;
    }
    case 'electricidad': {
      if (n > 1) for (let s2 = 0; s2 < 3; s2++) { const off = (i: number): P2 => i === 0 ? [0, 0] : [jit(i + s2 * 7, t) * r * 0.9, jit(i * 2 + s2 * 3, t + 1) * r * 0.9]; line(r * 0.5, 'rgba(56,189,248,0.35)', off); line(r * 0.16, s2 ? 'rgba(254,240,138,0.95)' : 'rgba(255,255,255,0.95)', off); }
      for (let a2 = 0; a2 < 4; a2++) { let ang = t * 23 + a2 * 1.57, x = b.x + Math.cos(ang) * r, y = b.y + Math.sin(ang) * r; ctx.strokeStyle = 'rgba(224,242,254,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 3; j++) { ang += jit(a2 * 5 + j, t) * 1.4; x += Math.cos(ang) * r * 0.55; y += Math.sin(ang) * r * 0.55; ctx.lineTo(x, y); } ctx.stroke(); }
      bloom(ctx, b.x, b.y, r * 3.2, '#38bdf8', 0.5 * fade); bloom(ctx, b.x, b.y, r * 1.6, '#fef08a', 0.35 * fade); break;
    }
    case 'viento': {
      ctx.globalCompositeOperation = 'source-over';
      if (n > 1) { line(r * 1.8, 'rgba(203,213,225,0.16)'); for (let h = 0; h < 4; h++) { line(7 - h, 'rgba(71,85,105,0.35)', i => { const a = i * 0.8 + t * 14 + h * 1.57, rr = r * (0.5 + i / n * 1.6); return [Math.cos(a) * rr * 0.45 + 2, Math.sin(a) * rr + 2]; }); line(6 - h, `rgba(248,250,252,${0.9 - h * 0.15})`, i => { const a = i * 0.8 + t * 14 + h * 1.57, rr = r * (0.5 + i / n * 1.6); return [Math.cos(a) * rr * 0.45, Math.sin(a) * rr]; }); } }
      for (let w2 = 0; w2 < 4; w2++) { const a = t * 11 + w2 * 1.6; ctx.strokeStyle = `rgba(241,245,249,${0.85 * fade})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, r * (1.3 + w2 * 0.3), a, a + 1.8); ctx.stroke(); }
      break;
    }
    case 'radiacion': {
      if (n > 1) { line(r * 2.2, 'rgba(74,222,128,0.18)'); line(r * 1.1, 'rgba(132,204,22,0.35)'); line(r * 0.35, 'rgba(236,252,203,0.7)'); }
      for (let p2 = 0; p2 < 12; p2++) { const i = p2 % n, [x, y] = pts[i], a = p2 * 2.39 + t * 3, d = r * (0.9 + (p2 % 3) * 0.5); ctx.fillStyle = `rgba(190,242,100,${0.8 * (1 - i / (n + 1))})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 0, TAU); ctx.fill(); }
      const pulse = 0.5 + 0.5 * Math.sin(t * 9); ctx.strokeStyle = `rgba(163,230,53,${0.5 + pulse * 0.4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r * (1.3 + pulse * 0.25), 0, TAU); ctx.stroke();
      // el trébol de la radiación girando alrededor
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 2); ctx.fillStyle = 'rgba(217,249,157,0.35)';
      for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 1.9, q * TAU / 3, q * TAU / 3 + 1.05); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      bloom(ctx, b.x, b.y, r * 3.4, '#4ade80', 0.55 * fade); break;
    }
    case 'laser': {
      const tail = pts[n - 1];
      for (const [w, c] of [[r * 2.4, 'rgba(220,38,38,0.22)'], [r * 1.2, 'rgba(239,68,68,0.55)'], [r * 0.5, 'rgba(254,202,202,0.9)'], [r * 0.18, 'rgba(255,255,255,1)']] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tail[0], tail[1]); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.strokeStyle = `rgba(248,113,113,${0.6 + 0.3 * Math.sin(t * 30)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.2, 0, TAU); ctx.stroke();
      bloom(ctx, b.x, b.y, r * 3, '#ef4444', 0.6 * fade); break;
    }
  }
  ctx.restore();
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
  const death = m.death?.keeper ? m.death : null;
  if ((death?.finished && death.type !== 'acid') || (m.kick?.kboom && !death)) return;
  const poseMatch = death && m.kick ? { ...m, kick: { ...m.kick, t: death.at } } : m;
  const st = keeperState(poseMatch, char), f = idleFighter(char);
  f.facing = -1; f.action = st.action; f.actionT = st.prog; f.ground = st.rot === 0;
  // sombra en el piso (queda abajo aunque vuele)
  const gy = m.kick ? Math.max(st.y, KEEPER[1]) : KEEPER[1], S = FPX * BODY_SCALE * SIZE[char];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(st.x, Math.min(gy, st.y + 400), S * 0.5 + Math.abs(Math.sin(st.rot)) * S * 0.7, S * 0.09, 0.3, 0, TAU); ctx.fill();
  if (death?.type === 'acid' || death?.type === 'stomp') {
    const rise = easeInOut(death.t / 0.38);
    if (rise > 0.5) { f.action = 'sad'; f.ground = true; }
    const body = (c: CanvasRenderingContext2D) => { c.save(); c.translate(lerp(st.x, death.x, rise), lerp(st.y, death.y, rise) - st.hipY); c.rotate(st.rot * (1 - rise)); drawFighterLit(c, f, death.clock + 0.4, NOFX, 0, st.hipY, FPX, rim, true); c.restore(); };
    drawPenDeath(ctx, death, death.x, death.y, 2.3 * SIZE[char] * FPX, body);
    return;
  }
  ctx.save(); ctx.translate(st.x, st.y - st.hipY); ctx.rotate(st.rot);
  const body = (c: CanvasRenderingContext2D, headScale = 1, silhouette = false) => { const fx = { ...NOFX, headScale }, t = (death?.clock ?? m.time) + 0.4; if (silhouette) drawFighterShape(c, f, t, fx, 0, st.hipY, FPX); else drawFighterLit(c, f, t, fx, 0, st.hipY, FPX, rim, true); };
  if (death) drawPenDeath(ctx, death, 0, st.hipY, 2.3 * SIZE[char] * FPX, body, c => drawPenProfileSkeleton(c, f, death.clock + 0.4, 0, st.hipY, FPX), st.rot); else body(ctx);
  ctx.restore();
}
function drawKicker(ctx: CanvasRenderingContext2D, m: PenMatch, side: 0 | 1, char: CharId, rim: string) {
  const death = m.death && !m.death.keeper ? m.death : null;
  if (death?.finished && death.type !== 'acid') return;
  const poseMatch = death && m.kick ? { ...m, kick: { ...m.kick, t: death.at, boom: false } } : m;
  const st = kickerState(poseMatch, side) ?? { gone: false, x: START[0], y: START[1], action: 'idle' as const, kickT: 0 };
  if (st.gone) return;
  const f = idleFighter(char); f.facing = 1; f.action = st.action; f.kickT = st.kickT; f.kickKind = 'normal';
  const body = (c: CanvasRenderingContext2D, headScale = 1, silhouette = false) => { const fx = { ...NOFX, headScale }, t = death?.clock ?? m.time; if (silhouette) drawFighterShape(c, f, t, fx, st.x, st.y, FPX); else drawFighterLit(c, f, t, fx, st.x, st.y, FPX, rim, !!death); };
  if (death) drawPenDeath(ctx, death, st.x, st.y, 2.3 * SIZE[char] * FPX, body, c => drawPenProfileSkeleton(c, f, death.clock, st.x, st.y, FPX)); else body(ctx);
}
function drawShootoutFinale(ctx: CanvasRenderingContext2D, m: PenMatch, rim: string) {
  const finale = m.finale; if (!finale || m.winner === null) return;
  const winner = idleFighter(m.chars[m.winner]); winner.facing = -1; winner.action = 'celebrate';
  drawFighterLit(ctx, winner, m.time, NOFX, KEEPER[0], KEEPER[1], FPX, rim);
  const char = m.chars[finale.loser], f = idleFighter(char), p = kickerBody(char); f.facing = 1; f.action = 'sad';
  const d = m.death, t = d?.clock ?? m.time;
  const body = (c: CanvasRenderingContext2D, headScale = 1, silhouette = false) => { const fx = { ...NOFX, headScale }; if (silhouette) drawFighterShape(c, f, t, fx, p.x, p.y, FPX); else drawFighterLit(c, f, t, fx, p.x, p.y, FPX, rim, true); };
  if (d) drawPenDeath(ctx, d, p.x, p.y, p.h, body, c => drawPenProfileSkeleton(c, f, t, p.x, p.y, FPX)); else body(ctx);
}
function drawGore(ctx: CanvasRenderingContext2D, m: PenMatch) {
  for (const st of m.gore.stains) {
    const a = st.t < 25 ? 0.85 : Math.max(0, 0.85 * (1 - (st.t - 25) / 10)), r = st.r * Math.min(1, st.t * 8 + 0.3);
    const g = ctx.createRadialGradient(st.x - r * 0.15, st.y - r * 0.1, 0, st.x, st.y, r * 1.2); g.addColorStop(0, `rgba(112,12,25,${a})`); g.addColorStop(0.55, `rgba(66,3,12,${a})`); g.addColorStop(1, `rgba(30,1,7,${a * 0.85})`);
    ctx.fillStyle = g; ctx.beginPath();
    for (let k = 0; k < 25; k++) { const ang = k / 25 * TAU, rr = r * (0.8 + Math.sin(st.seed * 7 + k * 3.1) * 0.17); ctx.lineTo(st.x + Math.cos(ang) * rr, st.y + Math.sin(ang) * rr * 0.4); }
    ctx.closePath(); ctx.fill();
    if (r > 12) { ctx.strokeStyle = `rgba(185,71,81,${a * 0.22})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(st.x - r * 0.13, st.y - r * 0.12, r * 0.45, r * 0.06, -0.1, Math.PI, TAU); ctx.stroke(); }
  }
}
function drawFlying(ctx: CanvasRenderingContext2D, m: PenMatch) {
  const U = FPX * 1.6;
  if (m.death?.type === 'stomp') drawPenStomp(ctx, m.death);
  if (m.death) drawPenDeathAtmosphere(ctx, m.death);
  for (const d of m.gore.drops) drawPenBlood(ctx, d.x, d.y - d.z, d.r, Math.atan2(d.vy - d.vz, d.vx), Math.hypot(d.vx, d.vy - d.vz));
  for (const g of m.gore.gibs) { ctx.fillStyle = `rgba(0,0,0,${0.25 / (1 + g.z / 300)})`; ctx.beginPath(); ctx.ellipse(g.x, g.y, 22 * (g.scale ?? 1), 7 * (g.scale ?? 1), 0, 0, TAU); ctx.fill(); }
  for (const skulls of [false, true]) for (const g of m.gore.gibs) { if ((g.kind === 'skull') !== skulls) continue; ctx.save(); ctx.translate(g.x, g.y - g.z - 8); ctx.scale(U * (g.scale ?? 1), U * (g.scale ?? 1)); ctx.rotate(g.a); drawPenGib(ctx, g.kind, g.c, g.va, g.profile); ctx.restore(); }
  for (const f of m.fragments) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (f.life - f.t) / 0.35); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    if (f.kind === 'ice') {
      const r = f.size, g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, 'rgba(240,252,255,0.95)'); g.addColorStop(0.5, 'rgba(140,210,250,0.85)'); g.addColorStop(1, 'rgba(50,120,200,0.9)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.55); ctx.lineTo(r * 0.45, -r * 0.5); ctx.lineTo(r * 0.6, r * 0.5); ctx.lineTo(-r * 0.55, r * 0.65); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(226,247,255,0.9)'; ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.55); ctx.lineTo(-r * 0.3, -r * 0.9); ctx.lineTo(r * 0.8, -r * 0.8); ctx.lineTo(r * 0.45, -r * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(43,109,166,0.8)'; ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.5); ctx.lineTo(r * 0.8, -r * 0.8); ctx.lineTo(r * 0.95, r * 0.2); ctx.lineTo(r * 0.6, r * 0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, r * 0.045); ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.35, -r * 0.45); ctx.lineTo(r * 0.5, r * 0.4); ctx.moveTo(-r * 0.3, -r * 0.4); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.2, r * 0.45); ctx.stroke();
      if (f.size > 12) { ctx.strokeStyle = 'rgba(130,8,29,0.68)'; ctx.lineWidth = Math.max(1, r * 0.055); ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.25); ctx.lineTo(r * 0.1, r * 0.05); ctx.lineTo(0, r * 0.3); ctx.stroke(); }
    } else { ctx.fillStyle = f.size > 6 ? '#514a43' : '#b8b0a2'; ctx.beginPath(); ctx.moveTo(-f.size * 0.5, 0); ctx.lineTo(-f.size * 0.15, -f.size * 0.4); ctx.lineTo(f.size * 0.5, f.size * 0.1); ctx.lineTo(0, f.size * 0.3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of m.sparks) { const k = 1 - s.life / s.max; ctx.strokeStyle = alpha(s.color, k); ctx.lineWidth = Math.max(0.7, s.size * k * 0.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y - s.z); ctx.lineTo(s.x - s.vx * 0.018, s.y - s.z - (s.vy - s.vz) * 0.018); ctx.stroke(); }
  ctx.restore();
}
// ---------------------------------------------------------------- El árbitro (dibujos del usuario)
// Está parado afuera del área chica, a la izquierda del arco (donde lo marcó el usuario). Si el arquero no ataja un gol
// tirándose para el otro lado, le dispara al arquero (dibujo 1); si el arquero ataja, le dispara al que pateó (dibujo 2).
// Para apuntar bien se inclina desde la cintura (gira el torso, los brazos y el arma) hasta que el arma mira a la víctima;
// si la víctima queda del otro lado al que mira el dibujo, el dibujo se da vuelta. Dispara una esfera de plasma verde.
const REF: P2 = [-390, 425]; // los pies
const REF_IW = 1199, REF_IH = 1312; // tamaño de los dibujos
const REF_H = 2.25 * FPX * 1.5, REF_S = REF_H / REF_IH, REF_W = REF_IW * REF_S;
// En px del dibujo, como si mirara a la derecha (el dibujo 2 se toma espejado): el centro del cuerpo entre los pies,
// la punta del arma, el ángulo del arma, la cintura (corte entre el torso y las piernas; gira desde hip) y desde qué x el arma baja más.
type RefKey = 'ref1' | 'ref2';
const REF_ART: Record<RefKey, { body: number; muzzle: P2; gun: number; waist: number; hip: number; front: number }> = {
  ref1: { body: 475, muzzle: [1090, 700], gun: Math.atan2(380, 660), waist: 730, hip: 450, front: 700 },
  ref2: { body: 425, muzzle: [1090, 700], gun: Math.atan2(370, 660), waist: 730, hip: 400, front: 700 },
};
const REF_MAX = 0.6; // lo más que se inclina (rad)
const SHOT = 0.3; // lo que tarda el disparo en llegar
const AIM = 0.3; // cuánto antes del disparo empieza a apuntar
interface RefPose { who: RefKey; flip: boolean; rot: number; pivot: P2 } // pivot en px del dibujo (mirando a la derecha)
// De px del dibujo (mirando a la derecha) al mundo, con el torso girado rot alrededor de pivot.
function refToWorld(p: RefPose, q: P2, turned: boolean): P2 {
  let [x, y] = q;
  if (turned) { const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.pivot[0], dy = y - p.pivot[1]; x = p.pivot[0] + dx * c - dy * s; y = p.pivot[1] + dx * s + dy * c; }
  const lx = (x - REF_ART[p.who].body) * REF_S;
  return [REF[0] + (p.flip ? -lx : lx), REF[1] - REF_H + y * REF_S];
}
const refMuzzle = (p: RefPose): P2 => refToWorld(p, REF_ART[p.who].muzzle, true);
// A quién le dispara en este penal (si le dispara), desde cuándo y adónde apunta.
export function penaltyRefTarget(m: PenMatch): { who: RefKey; t0: number; to: P2 } | null {
  if (m.finale) return null;
  const k = m.kick; if (!k || !k.hit) return null;
  if (k.outcome === 'save') { const c = kickerBody(m.chars[k.shooter]); return { who: 'ref2', t0: T.boom - SHOT, to: [c.x, c.y - c.h * 0.55] }; }
  if (!keeperBlewIt(k.shot, k.dive)) return null;
  const ks: 0 | 1 = k.shooter === 0 ? 1 : 0, c = m.death?.keeper ? m.death : keeperBody(m, m.chars[ks]);
  return { who: 'ref1', t0: T.boom + 0.1 - SHOT, to: [c.x, c.y - c.h * 0.5] };
}
function refPose(m: PenMatch): { pose: RefPose; shot: { from: P2; to: P2; k: number } | null } {
  const tg = penaltyRefTarget(m), a = m.finale ? (m.phase === 'end' ? 99 : m.phaseT) : m.kick ? m.kick.t - arriveAt() : 0;
  if (!tg) return { pose: { who: 'ref1', flip: false, rot: 0, pivot: [REF_ART.ref1.hip, REF_ART.ref1.waist] }, shot: null };
  const art = REF_ART[tg.who], flip = tg.to[0] < REF[0];
  // el giro que hace que la línea del arma pase por la víctima (se ajusta unas veces porque la punta también se mueve)
  let rot = 0; const pivot: P2 = [art.hip, art.waist];
  for (let i = 0; i < 4; i++) {
    const mz = refMuzzle({ who: tg.who, flip, rot, pivot }), dx = (tg.to[0] - mz[0]) * (flip ? -1 : 1), dy = tg.to[1] - mz[1];
    rot = Math.max(-REF_MAX, Math.min(REF_MAX, Math.atan2(dy, dx) - art.gun));
  }
  const e = easeInOut((a - (tg.t0 - AIM)) / AIM);
  const pose: RefPose = { who: tg.who, flip, rot: rot * e, pivot };
  const k = (a - tg.t0) / SHOT, show = a >= tg.t0 && a <= tg.t0 + SHOT + 0.12;
  return { pose, shot: show ? { from: refMuzzle(pose), to: tg.to, k } : null };
}
const refShot = (m: PenMatch) => refPose(m).shot;
function drawReferee(ctx: CanvasRenderingContext2D, m: PenMatch) {
  const { pose, shot } = refPose(m), im = img(pose.who); if (!im) return;
  const art = REF_ART[pose.who];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(REF[0], REF[1] - 4, REF_W * 0.42, REF_W * 0.09, 0.3, 0, TAU); ctx.fill();
  ctx.save();
  // se dibuja en px del dibujo mirando a la derecha (el dibujo 2 viene mirando a la izquierda: se espeja); flip da vuelta todo
  const mirror = pose.who === 'ref2';
  ctx.translate(REF[0], REF[1] - REF_H); ctx.scale(pose.flip ? -REF_S : REF_S, REF_S); ctx.translate(-art.body, 0);
  const drawArt = () => { if (mirror) { ctx.save(); ctx.translate(REF_IW, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, REF_IW, REF_IH); ctx.restore(); } else ctx.drawImage(im, 0, 0, REF_IW, REF_IH); };
  const W = REF_IW, H = REF_IH, y = art.waist, gy = art.muzzle[1] + 135, gx = art.front + 35, px = pose.pivot[0], fill = y - 200;
  // las piernas, quietas; y un poco de la cintura del lado que se levanta al inclinarse, para que no quede un hueco
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(gx, y); ctx.lineTo(gx, gy); ctx.lineTo(W, gy); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  if (pose.rot > 0) ctx.rect(0, fill, px, y - fill); else if (pose.rot < 0) ctx.rect(px, fill, gx - px, y - fill);
  ctx.clip(); drawArt(); ctx.restore();
  // torso, brazos y arma, girados desde la cintura, encima
  ctx.save(); ctx.translate(px, pose.pivot[1]); ctx.rotate(pose.rot); ctx.translate(-px, -pose.pivot[1]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, gy); ctx.lineTo(gx, gy); ctx.lineTo(gx, y + 14); ctx.lineTo(0, y + 14); ctx.closePath(); ctx.clip();
  drawArt(); ctx.restore();
  ctx.restore();
  if (shot && shot.k < 0.5) { const [x, yy] = shot.from, f = 1 - Math.max(0, shot.k) / 0.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, yy, 220, '#63ff12', 0.9 * f); bloom(ctx, x, yy, 110, '#b5ff37', 0.95 * f); bloom(ctx, x, yy, 50, '#f5ffce', f); ctx.restore(); }
}
function drawShot(ctx: CanvasRenderingContext2D, m: PenMatch) {
  const sh = refShot(m); if (!sh || sh.k > 1) return;
  // Esfera de plasma verde fluorescente, con núcleo brillante y una estela ancha.
  const dx = sh.to[0] - sh.from[0], dy = sh.to[1] - sh.from[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const k = Math.max(0, sh.k), hx = sh.from[0] + dx * k, hy = sh.from[1] + dy * k, L = Math.min(350, len * k + 40), t = m.time;
  const N = 14, pts: P2[] = [];
  for (let i = 0; i <= N; i++) { const f = i / N, w = Math.sin(f * 9 - t * 40) * 7 * f * (1 - f * 0.4); pts.push([hx - ux * L * f + nx * w, hy - uy * L * f + ny * w]); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const layers: [number, string, string][] = [[112, 'rgba(63,255,12,0.32)', 'rgba(40,255,0,0)'], [70, 'rgba(112,255,18,0.85)', 'rgba(70,255,0,0)'], [34, 'rgba(190,255,90,1)', 'rgba(90,255,10,0)'], [14, 'rgba(248,255,213,1)', 'rgba(180,255,90,0)']];
  for (const [w, c0, c1] of layers) {
    const g = ctx.createLinearGradient(hx, hy, hx - ux * L, hy - uy * L); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  // chispas de fuego que se desprenden de la cola y suben un poco
  for (let i = 0; i < 18; i++) {
    const f = ((i * 0.618 + t * 3) % 1), r = (Math.sin(i * 12.9898) * 43758.5453) % 1, side = (r - 0.5) * 40 * f;
    const x = hx - ux * L * 1.1 * f + nx * side, y = hy - uy * L * 1.1 * f + ny * side - f * 30, sz = (1 - f) * 7 + 2;
    ctx.fillStyle = i % 3 === 0 ? `rgba(235,255,180,${1 - f})` : `rgba(${90 + (i % 4) * 35},255,20,${1 - f})`;
    ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
  }
  // La esfera conserva un borde verde definido además del resplandor exterior.
  const pulse = 1 + Math.sin(t * 60) * 0.12;
  bloom(ctx, hx, hy, 240 * pulse, '#55ff0a', 0.85); bloom(ctx, hx, hy, 115 * pulse, '#adff27', 0.95);
  const orb = ctx.createRadialGradient(hx - 18, hy - 20, 3, hx, hy, 64 * pulse);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.22, '#f1ffc1'); orb.addColorStop(0.6, '#b3ff24'); orb.addColorStop(0.88, '#42e600'); orb.addColorStop(1, 'rgba(38,189,0,0.1)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(hx, hy, 64 * pulse, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(196,255,77,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(hx, hy, 78 * pulse, 27 * pulse, Math.atan2(dy, dx) + t * 9, 0, TAU); ctx.stroke();
  ctx.restore();
}
export interface PenDrawOpts { cursor?: Zone | null; cursorColor?: string; showTargets?: boolean; netHit?: { at: P2; t: number } | null }
export function drawPenalties(ctx: CanvasRenderingContext2D, m: PenMatch, w: number, h: number, opts: PenDrawOpts = {}) {
  const v = penView(w, h), rim = THEMES[m.stage].light, k = m.kick;
  const shooter: 0 | 1 = k ? k.shooter : ((m.turn + m.first) % 2 === 0 ? 0 : 1), keeperSide: 0 | 1 = shooter === 0 ? 1 : 0;
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * 14, (Math.random() - 0.5) * m.shake * 14);
  ctx.translate(v.ox, v.oy); ctx.scale(v.k, v.k);
  drawGore(ctx, m);
  const net = img('net'), frame = img('frame'), b = ballState(m);
  if (m.finale) { b.inside = false; b.alpha = 0; }
  // la red (deformada si acaba de entrar la pelota), la pelota si está adentro, y el marco encima
  let hit: P2 | null = null, ht = 0;
  if (k && k.outcome === 'goal' && k.t >= arriveAt() + 0.1) { const tg = zonePoint(k.shot); hit = [tg[0] + DEPTH[0] * BACK_K, tg[1] + DEPTH[1] * BACK_K]; ht = k.t - arriveAt() - 0.1; }
  if (net) drawNet(ctx, net, hit, ht);
  if (b.inside) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.shadow[0], b.shadow[1], b.r * 1.1, b.r * 0.35, 0.3, 0, TAU); ctx.fill(); drawBallFx(ctx, m, b); drawBall(ctx, b.x, b.y, b.r, b.spin); }
  if (frame) ctx.drawImage(frame, 0, 0);
  // el arquero, el que patea y la pelota (si todavía no entró)
  drawReferee(ctx, m);
  if (m.finale) drawShootoutFinale(ctx, m, rim);
  else { drawKeeper(ctx, m, m.chars[keeperSide], rim); drawKicker(ctx, m, shooter, m.chars[shooter], rim); }
  if (!b.inside) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 * b.alpha})`; ctx.beginPath(); ctx.ellipse(b.shadow[0], b.shadow[1], b.r * 1.1, b.r * 0.35, 0.3, 0, TAU); ctx.fill();
    drawBallFx(ctx, m, b); drawBall(ctx, b.x, b.y, b.r, b.spin, b.alpha);
  }
  // el destello de la explosión
  if (!m.finale && m.death?.type === 'explosion' && k?.boom && k.t < arriveAt() + T.boom + 0.5) {
    const e = (k.t - arriveAt() - T.boom) / 0.5, c = kickerBody(m.chars[k.shooter]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, c.x, c.y - c.h * 0.55, 260 + e * 200, '#fb923c', 0.9 * (1 - e)); bloom(ctx, c.x, c.y - c.h * 0.55, 120, '#fff7d6', 0.9 * (1 - e)); ctx.restore();
  }
  drawFlying(ctx, m);
  drawShot(ctx, m);
  if (m.finale && m.phase === 'execution') drawPenUfo(ctx, m.phaseT, kickerBody(m.chars[m.finale.loser]));
  ctx.restore();
  // la sangre en la pantalla, el flash y la viñeta
  drawPenScreenBlood(ctx, m.screenBlood, w, h);
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
