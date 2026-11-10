// Cómo se ve Kombat Voley: de costado. Atrás el fondo pintado del estadio (los mismos 16 de Kombat Football),
// adelante la cancha de vóley sobre la plataforma, con sus líneas, la red con sus postes, el árbitro en su silla,
// los dos luchadores y la pelota del estadio con su efecto (fuego, rayos, burbujas, pétalos…).
import { CHARS, type StageId } from './kombat';
import { BALLS, BR, COURT, NET_H, NET_X, P_SCALE, type BallKind, type VMatch } from './kombatVoley';
import { THEMES } from './kombatArt';
import { PITCH } from './kombatSoccerArt';
import { drawFighterLit, drawRefLit } from './kombatFighters';
import { alpha, bloom, darken, lighten } from './gravityMonsters';
import { gradeScenery, paintBackdrop, paintScenery } from './kombatScenery';

const TAU = Math.PI * 2;
export interface VView { w: number; h: number; s: number; ox: number; gy: number }
// La cámara fija: entra toda la cancha con un poco de afuera a cada lado.
export function voleyView(w: number, h: number): VView {
  const span = COURT + 7, s = Math.min(w / span, h / 10.5);
  return { w, h, s, ox: w / 2 - (COURT / 2) * s, gy: h - Math.min(h * 0.16, 1.7 * s) };
}
const X = (v: VView, x: number) => v.ox + x * v.s;
const Y = (v: VView, y: number) => v.gy - y * v.s;

// ---------------------------------------------------------------- El fondo (en su propia capa)
const bgCache = new Map<string, HTMLCanvasElement | null>();
export function drawVoleyBackdrop(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  const v = voleyView(w, h), key = `${stage}:${w}x${h}`;
  let c = bgCache.get(key);
  if (!c && typeof document !== 'undefined') {
    c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
    const g = c.getContext('2d');
    if (g && !paintBackdrop(g, stage, w, h, v.gy - v.s * 0.15)) {
      try { paintScenery(g, stage, w, h, v.gy, v.s); gradeScenery(c, stage); } catch { g.fillStyle = THEMES[stage].sky[1]; g.fillRect(0, 0, w, h); }
      c = null; // (mientras carga la imagen, no se guarda: se vuelve a pintar)
    }
    if (c) { if (bgCache.size > 8) bgCache.clear(); bgCache.set(key, c); }
    else { ctx.clearRect(0, 0, w, h); if (g) ctx.drawImage(g.canvas, 0, 0); return; }
  }
  ctx.clearRect(0, 0, w, h);
  if (c) ctx.drawImage(c, 0, 0);
}

// ---------------------------------------------------------------- La cancha
// Vista de costado pura (sin perspectiva): una franja plana con las líneas del color del estadio.
function drawCourt(ctx: CanvasRenderingContext2D, v: VView, stage: StageId) {
  const P = PITCH[stage], top = v.gy - v.s * 0.22, bot = v.gy + v.s * 0.38, x0 = X(v, -1.4), x1 = X(v, COURT + 1.4);
  // la zona de afuera
  const g0 = ctx.createLinearGradient(0, top, 0, bot); g0.addColorStop(0, darken(P.surround, 0.1)); g0.addColorStop(1, P.surround);
  ctx.fillStyle = g0; ctx.fillRect(x0 - v.s * 2, top, x1 - x0 + v.s * 4, bot - top);
  // la cancha, con franjas
  const cx0 = X(v, 0), cx1 = X(v, COURT), n = 8;
  for (let i = 0; i < n; i++) { const a = cx0 + (cx1 - cx0) * i / n, b = cx0 + (cx1 - cx0) * (i + 1) / n; ctx.fillStyle = i % 2 ? P.a : lighten(P.b, 0.08); ctx.fillRect(a, top, b - a + 0.5, bot - top); }
  const gl = ctx.createLinearGradient(0, top, 0, bot); gl.addColorStop(0, 'rgba(0,0,0,0.25)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.06)'); gl.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = gl; ctx.fillRect(cx0, top, cx1 - cx0, bot - top);
  // las líneas: los fondos, la del medio (debajo de la red) y las de ataque (a 3 m de la red)
  ctx.fillStyle = alpha(P.line, 0.95); const lw = Math.max(2, v.s * 0.09);
  ctx.fillRect(cx0, top, cx1 - cx0, Math.max(1.5, lw * 0.6)); // el borde de atrás
  for (const x of [0, COURT, NET_X, NET_X - 3, NET_X + 3]) { ctx.globalAlpha = x === NET_X - 3 || x === NET_X + 3 ? 0.7 : 1; ctx.fillRect(X(v, x) - lw / 2, top, lw, bot - top); }
  ctx.globalAlpha = 1;
  // el frente de la plataforma y una sombra que la apoya en el piso del estadio
  ctx.fillStyle = darken(P.surround, 0.35); ctx.fillRect(x0 - v.s * 2, bot, x1 - x0 + v.s * 4, v.s * 0.12);
  const gs = ctx.createLinearGradient(0, bot + v.s * 0.12, 0, bot + v.s * 0.5); gs.addColorStop(0, 'rgba(0,0,0,0.45)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs; ctx.fillRect(x0 - v.s * 2, bot + v.s * 0.12, x1 - x0 + v.s * 4, v.s * 0.38);
}
// La red de costado: el poste, la malla (angosta, se ve de canto), la faja blanca y la antena.
function drawNet(ctx: CanvasRenderingContext2D, v: VView, m: VMatch | null, front: boolean) {
  const px = X(v, NET_X), top = Y(v, NET_H), bot = Y(v, NET_H - 1.0), pw = Math.max(3, v.s * 0.14), mw = v.s * 0.32;
  if (!front) { // el poste de atrás asoma un poco más arriba
    ctx.fillStyle = '#4b5563'; ctx.fillRect(px + mw * 0.5 - pw / 2, top - v.s * 0.12, pw * 0.8, v.gy - v.s * 0.2 - top + v.s * 0.12);
    return;
  }
  const wob = m ? Math.sin(m.time * 30) * Math.max(0, 0.35 - (m.time - netHitT)) * v.s * 0.25 : 0;
  // la malla
  ctx.fillStyle = 'rgba(15,15,20,0.35)';
  ctx.beginPath(); ctx.moveTo(px - mw / 2, top); ctx.lineTo(px + mw / 2, top); ctx.lineTo(px + mw / 2 + wob, bot); ctx.lineTo(px - mw / 2 + wob, bot); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240,240,240,0.6)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= 3; i++) { const x = px - mw / 2 + mw * i / 3; ctx.moveTo(x, top); ctx.lineTo(x + wob, bot); }
  for (let j = 0; j <= 8; j++) { const k = j / 8, y = top + (bot - top) * k; ctx.moveTo(px - mw / 2 + wob * k, y); ctx.lineTo(px + mw / 2 + wob * k, y); }
  ctx.stroke();
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(px - mw / 2 - 1, top - Math.max(2, v.s * 0.07), mw + 2, Math.max(3, v.s * 0.12)); // la faja
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(px - mw / 2 + wob, bot - 1, mw, Math.max(1.5, v.s * 0.04));
  // la antena (roja y blanca)
  for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#ef4444' : '#f8fafc'; ctx.fillRect(px - 1.5, top - v.s * 0.15 * (k + 1), 3, v.s * 0.15); }
  // el poste de adelante, hasta el piso
  const g = ctx.createLinearGradient(px - pw, 0, px + pw, 0); g.addColorStop(0, '#6b7280'); g.addColorStop(0.45, '#f3f4f6'); g.addColorStop(1, '#4b5563');
  ctx.fillStyle = g; ctx.fillRect(px - mw / 2 - pw / 2, top - v.s * 0.1, pw, v.gy + v.s * 0.3 - top + v.s * 0.1);
}
let netHitT = -9;
export function noteNetHit(m: VMatch) { netHitT = m.time; }
// La silla del árbitro: alta, detrás de la red, para que mire desde arriba.
function drawRefChair(ctx: CanvasRenderingContext2D, v: VView, m: VMatch, rim: string) {
  const x = X(v, NET_X) + v.s * 0.15, gy = v.gy - v.s * 0.2, seat = Y(v, NET_H - 0.55);
  ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = Math.max(2, v.s * 0.08);
  ctx.beginPath(); ctx.moveTo(x - v.s * 0.45, gy); ctx.lineTo(x - v.s * 0.25, seat); ctx.moveTo(x + v.s * 0.45, gy); ctx.lineTo(x + v.s * 0.25, seat);
  for (let k = 1; k < 5; k++) { const y = gy - (gy - seat) * k / 5; ctx.moveTo(x - v.s * 0.42 + v.s * 0.16 * k / 5, y); ctx.lineTo(x + v.s * 0.42 - v.s * 0.16 * k / 5, y); }
  ctx.stroke();
  ctx.fillStyle = '#52525b'; ctx.fillRect(x - v.s * 0.32, seat - v.s * 0.08, v.s * 0.64, v.s * 0.12);
  drawRefLit(ctx, m.ref, m.time, x, seat, v.s * 0.7, rim);
}

// ---------------------------------------------------------------- La pelota
// Una pelota de vóley (los gajos curvos) del color de su tipo, con el efecto de cada una.
export function drawVolleyball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, roll: number, kind: BallKind, t: number, alphaK = 1) {
  const d = BALLS[kind];
  ctx.save(); ctx.globalAlpha = alphaK;
  if (kind === 'bomba') { // la bomba: negra con mecha encendida
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, '#4b5563'); g.addColorStop(1, '#0b0f14');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(1.5, r * 0.15); ctx.beginPath(); ctx.moveTo(x + r * 0.4, y - r * 0.8); ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.3, x + r * 0.7, y - r * 1.5); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x + r * 0.7, y - r * 1.5, r * (0.6 + Math.sin(t * 40) * 0.2), '#fde047', 0.9);
    ctx.restore(); return;
  }
  if (kind === 'meteorito' || kind === 'piedra') { // roca (encendida si es meteorito)
    ctx.fillStyle = kind === 'meteorito' ? '#5b2a14' : '#8b8680'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = roll + k * TAU / 10, rr = r * (0.88 + ((k * 37) % 5) / 30); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = kind === 'meteorito' ? '#fb923c' : '#57534e'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
    if (kind === 'meteorito') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 4; k++) { const a = roll * 1.3 + k * 1.6; ctx.strokeStyle = 'rgba(253,186,116,0.8)'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a + 0.5) * r * 0.75, y + Math.sin(a + 0.5) * r * 0.75); ctx.stroke(); } }
    ctx.restore(); return;
  }
  const base = d.color, g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(base, 0.5)); g.addColorStop(0.6, base); g.addColorStop(1, darken(base, 0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // los gajos
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = alpha(darken(d.glow, 0.25), 0.85); ctx.lineWidth = Math.max(1, r * 0.11);
  for (let k = 0; k < 3; k++) { const a = roll + k * TAU / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25, r * 1.05, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.16, -0.5, 0, TAU); ctx.fill();
  if (kind === 'oro') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; const k = (t * 3) % 1; ctx.beginPath(); ctx.arc(x + Math.cos(k * TAU) * r * 0.6, y + Math.sin(k * TAU) * r * 0.6, r * 0.18, 0, TAU); ctx.fill(); }
  if (kind === 'burbuja') { ctx.strokeStyle = 'rgba(207,250,254,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawBallFx(ctx: CanvasRenderingContext2D, v: VView, m: VMatch) {
  const b = m.ball, d = BALLS[m.kind], x = X(v, b.x), y = Y(v, b.y), r = b.r * v.s, t = m.time;
  // la estela
  if (m.trail.length > 2) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const fire = m.kind === 'meteorito';
    for (let i = 1; i < m.trail.length; i++) {
      const k = 1 - i / m.trail.length, [ax, ay] = m.trail[i - 1], [bx, by] = m.trail[i];
      for (const [w, c, a] of fire ? [[2.4, '#dc2626', 0.4], [1.4, '#f97316', 0.6], [0.6, '#fde047', 0.85]] as const : [[1.6, d.glow, 0.35], [0.6, '#ffffff', 0.5]] as const) {
        ctx.strokeStyle = alpha(c, a * k); ctx.lineWidth = Math.max(1, r * w * k); ctx.beginPath(); ctx.moveTo(X(v, ax), Y(v, ay)); ctx.lineTo(X(v, bx), Y(v, by)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (m.kind === 'rayo') { ctx.strokeStyle = '#fef08a'; ctx.lineWidth = Math.max(1.5, r * 0.12); for (let k = 0; k < 4; k++) { let a = t * 37 + k * 1.6, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 3; j++) { a += Math.sin(t * 80 + k * 5 + j); px += Math.cos(a) * r * 0.7; py += Math.sin(a) * r * 0.7; ctx.lineTo(px, py); } ctx.stroke(); } }
  if (m.kind === 'meteorito') { const back = Math.atan2(-b.vy * -1, -b.vx); for (let k = 0; k < 8; k++) { const a = back + (k - 3.5) * 0.3, l = r * (2 + Math.sin(t * 30 + k * 2) * 0.6); ctx.fillStyle = k % 2 ? 'rgba(253,224,71,0.75)' : 'rgba(239,68,68,0.7)'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 1.1) * r, y + Math.sin(a - 1.1) * r); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a + 1.1) * r, y + Math.sin(a + 1.1) * r); ctx.fill(); } }
  if (m.kind === 'sakura') for (let k = 0; k < 5; k++) { const a = t * 2 + k * 1.25, px = x - Math.cos(a) * r * 2.2, py = y + Math.sin(a * 1.3) * r * 1.6; ctx.fillStyle = 'rgba(251,207,232,0.8)'; ctx.beginPath(); ctx.ellipse(px, py, r * 0.22, r * 0.12, a, 0, TAU); ctx.fill(); }
  if (m.kind === 'burbuja') for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k / 4) % 1; ctx.strokeStyle = alpha('#cffafe', 0.7 * (1 - ph)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + Math.sin(k * 2 + t) * r * 1.4, y - ph * r * 3, r * 0.2, 0, TAU); ctx.stroke(); }
  if (m.kind !== 'fantasma' && m.kind !== 'piedra') bloom(ctx, x, y, r * 2.6, d.glow, m.kind === 'neon' || m.kind === 'espora' ? 0.55 : 0.35);
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export function drawVoley(ctx: CanvasRenderingContext2D, m: VMatch, w: number, h: number, opts: { backdrop?: boolean } = {}) {
  const v = voleyView(w, h), rim = THEMES[m.stage].light;
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * v.s * 0.5, (Math.random() - 0.5) * m.shake * v.s * 0.5);
  if (opts.backdrop) drawVoleyBackdrop(ctx, m.stage, w, h);
  drawCourt(ctx, v, m.stage);
  drawRefChair(ctx, v, m, rim);
  drawNet(ctx, v, m, false);
  // sombras en el piso
  const b = m.ball, ghost = m.kind === 'fantasma' ? 0.12 + 0.88 * Math.max(0, Math.sin(m.time * 2.6) * 1.6 - 0.3) : 1;
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.4 - b.y * 0.03) * Math.max(0.3, ghost)})`; ctx.beginPath(); ctx.ellipse(X(v, b.x), v.gy, b.r * v.s * 1.1, b.r * v.s * 0.35, 0, 0, TAU); ctx.fill();
  // los jugadores (el de la izquierda mira a la derecha y al revés)
  for (const p of m.players) {
    drawFighterLit(ctx, p, m.time + p.team * 0.4, { power: 0, frozen: p.slow > 0, poison: false, burn: false, zap: false, shield: false, speed: false, aura: null }, X(v, p.x), Y(v, p.y), v.s * P_SCALE, rim);
  }
  drawNet(ctx, v, m, true);
  // la pelota
  if (!b.held || m.phase !== 'end') {
    drawBallFx(ctx, v, m);
    drawVolleyball(ctx, X(v, b.x), Y(v, b.y), b.r * v.s, b.roll, m.kind, m.time, ghost);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const pt of m.particles) { const k = 1 - pt.life / pt.max, sz = Math.max(1.5, pt.size * v.s); ctx.fillStyle = alpha(pt.color, k); ctx.fillRect(X(v, pt.x) - sz / 2, Y(v, pt.y) - sz / 2, sz, sz); }
  ctx.restore();
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.45, w / 2, h * 0.55, Math.max(w, h) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  void CHARS;
}
// Miniatura del estadio (para elegirlo): el fondo, la cancha y la red.
export function drawVoleyThumb(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  const v = voleyView(w, h);
  if (!paintBackdrop(ctx, stage, w, h, v.gy - v.s * 0.15)) { ctx.fillStyle = THEMES[stage].sky[1]; ctx.fillRect(0, 0, w, h); }
  drawCourt(ctx, v, stage); drawNet(ctx, v, null, false); drawNet(ctx, v, null, true);
}
export { BR as VOLEY_BALL_R };
