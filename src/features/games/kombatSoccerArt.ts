// Cómo se ve Kombat Football 5 contra 5: la cámara arriba en diagonal (como los FIFA viejos de Sega y Nintendo),
// que sigue la pelota a lo largo de la cancha y gira un poquito cuando se acerca a un arco. Atrás, el fondo pintado
// de cada escenario (el mismo de siempre); adelante, la cancha con las franjas del pasto y las líneas, del color
// del escenario, los carteles que la rodean, los arcos con red, los luchadores, el árbitro, la pelota y los poderes.
import { CHARS, POWER_MAX, SIZE, type Element, type StageId } from './kombat';
import { BR, D, GD, GH, GW, L, ZC, AREA_W, AREA_X, CHARGE_TIME, PLAYER_SCALE, hOf, type AtkShape, type Player, type Proj, type SFx, type SoccerMatch } from './kombatSoccer';
import { THEMES, drawBallSprite, drawGib, drawScreenBlood, type View } from './kombatArt';
import { drawFighterLit, drawRefLit, LOOKS } from './kombatFighters';
import { alpha, bloom, darken, lighten } from './gravityMonsters';
import { backdropFloor, backdropImage, backdropReady, gradeScenery, paintScenery } from './kombatScenery';

const TAU = Math.PI * 2;
// El pasto de cada escenario, con sus franjas y sus líneas del color del fondo, y los carteles alrededor.
interface Pitch { a: string; b: string; line: string; surround: string; board: string; glow: string }
export const PITCH: Record<StageId, Pitch> = {
  industrial: { a: '#173f57', b: '#1c4a66', line: '#7dd3fc', surround: '#0b1a2a', board: '#0b1530', glow: '#38bdf8' },
  mines: { a: '#3a2560', b: '#432b6e', line: '#f0abfc', surround: '#170d2a', board: '#1a0f30', glow: '#e879f9' },
  base: { a: '#1b3550', b: '#203d5c', line: '#bae6fd', surround: '#0a1524', board: '#0b1626', glow: '#60a5fa' },
  ice: { a: '#5d97c9', b: '#6aa4d4', line: '#f8fafc', surround: '#2b5379', board: '#173763', glow: '#e0f2fe' },
  volcano: { a: '#4d1c10', b: '#5a2314', line: '#fdba74', surround: '#1f0805', board: '#2a0b06', glow: '#f97316' },
  forest: { a: '#143f4a', b: '#174957', line: '#a3e635', surround: '#071a20', board: '#0a1f2a', glow: '#67e8f9' },
  factory: { a: '#3d2f1c', b: '#483721', line: '#fbbf24', surround: '#181108', board: '#1d150b', glow: '#f59e0b' },
  storm: { a: '#253150', b: '#2c395c', line: '#c7d2fe', surround: '#0c111f', board: '#111830', glow: '#a5b4fc' },
  temple: { a: '#2f5a28', b: '#38672f', line: '#fde68a', surround: '#13240f', board: '#1c2a14', glow: '#a3e635' },
  moon: { a: '#4a4f5e', b: '#545a6b', line: '#f1f5f9', surround: '#1e2129', board: '#15171f', glow: '#cbd5e1' },
  subway: { a: '#33293f', b: '#3c3049', line: '#fbcfe8', surround: '#140f1a', board: '#1a1220', glow: '#f472b6' },
  pit: { a: '#2b2445', b: '#332b51', line: '#c4b5fd', surround: '#0f0c1c', board: '#140f26', glow: '#a78bfa' },
  desert: { a: '#b17a37', b: '#bd8741', line: '#fff7ed', surround: '#5a3614', board: '#3a2108', glow: '#fbbf24' },
  ocean: { a: '#0e5568', b: '#11637a', line: '#a5f3fc', surround: '#04222c', board: '#062a36', glow: '#22d3ee' },
  sky: { a: '#c9b28d', b: '#d4bf9c', line: '#ffffff', surround: '#7d6a4c', board: '#1e3a8a', glow: '#fde68a' },
  coliseum: { a: '#b8904f', b: '#c49b5a', line: '#ffffff', surround: '#5e4120', board: '#4a1010', glow: '#fbbf24' },
};
const TEAM_C: [string, string] = ['#38bdf8', '#f43f5e'];

// ---------------------------------------------------------------- La cámara
export interface SView { w: number; h: number; F: number; cx: number; cy: number; dist: number; ct: number; st: number; cyw: number; syw: number; tx: number; tz: number }
const PITCH_A = 0.6; // inclinación de la cámara (unos 35°: se ve la cancha en diagonal)
export function soccerView(w: number, h: number, camX: number, camZ: number): SView {
  const F = Math.min(h * 1.5, w * 0.95), dist = 24;
  const half = (w / 2) / (F / dist);
  const tx = half * 2 + 6 >= L ? L / 2 : Math.max(half - 4.5, Math.min(L - half + 4.5, camX));
  const yaw = Math.max(-1, Math.min(1, (tx - L / 2) / (L / 2))) * 0.17;
  const tz = Math.max(D * 0.36, Math.min(D * 0.66, camZ * 0.85 + ZC * 0.15)); // (también sigue la pelota a lo ancho)
  return { w, h, F, cx: w / 2, cy: h * 0.6, dist, ct: Math.cos(PITCH_A), st: Math.sin(PITCH_A), cyw: Math.cos(yaw), syw: Math.sin(yaw), tx, tz };
}
// Un punto del mundo (metros) a la pantalla: [x, y, píxeles por metro ahí].
export function project(v: SView, x: number, y: number, z: number): [number, number, number] {
  const rx = x - v.tx, rz = z - v.tz;
  const x1 = rx * v.cyw + rz * v.syw, z1 = -rx * v.syw + rz * v.cyw;
  const qy = y - v.dist * v.st, qz = z1 - v.dist * v.ct;
  const depth = Math.max(0.5, -(qy * v.st + qz * v.ct)), up = qy * v.ct - qz * v.st, s = v.F / depth;
  return [v.cx + x1 * s, v.cy - up * s, s];
}
const P = (v: SView, x: number, y: number, z: number) => { const p = project(v, x, y, z); return [p[0], p[1]] as const; };
function poly(ctx: CanvasRenderingContext2D, v: SView, pts: [number, number, number][]) {
  ctx.beginPath(); pts.forEach(([x, y, z], i) => { const [a, b] = P(v, x, y, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.closePath();
}

// ---------------------------------------------------------------- El fondo (se pinta una vez por tamaño)
const bgCache = new Map<string, HTMLCanvasElement | null>();
const PARALLAX = 0.14;
function backdrop(stage: StageId, w: number, h: number, ground: number): HTMLCanvasElement | null {
  const W = Math.round(w * (1 + PARALLAX)), key = `${stage}:${W}x${Math.round(h)}:${Math.round(ground)}:${backdropReady(stage) ? 'img' : 'drawn'}`;
  if (bgCache.has(key)) return bgCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = Math.max(1, W); c.height = Math.max(1, Math.round(ground + 4));
  const g = c.getContext('2d'); if (!g) { bgCache.set(key, null); return null; }
  if (bgCache.size > 10) bgCache.clear();
  if (!paintFitted(g, stage, W, ground)) { // mientras carga la imagen: el dibujado (y si falla, el cielo del escenario)
    try { paintScenery(g, stage, W, Math.max(ground + 4, h), ground, Math.max(8, ground / 9)); gradeScenery(c, stage); }
    catch { const sky = THEMES[stage].sky, gr = g.createLinearGradient(0, 0, 0, ground); gr.addColorStop(0, sky[0]); gr.addColorStop(0.6, sky[1]); gr.addColorStop(1, sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, ground + 4); }
  }
  bgCache.set(key, c);
  return c;
}
// El fondo pintado: cubre el ancho y la línea del piso de la imagen queda justo detrás de los carteles del fondo.
function paintFitted(g: CanvasRenderingContext2D, stage: StageId, w: number, ground: number) {
  const img = backdropImage(stage); if (!img) return false;
  const fy = backdropFloor(stage) - 40, k = Math.max(w / 1672, ground / fy);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, (w - 1672 * k) / 2, ground - fy * k, 1672 * k, 941 * k);
  return true;
}

// ---------------------------------------------------------------- La cancha
function drawPitch(ctx: CanvasRenderingContext2D, v: SView, stage: StageId) {
  const T = PITCH[stage];
  // alrededor de la cancha (debajo de los carteles)
  ctx.fillStyle = T.surround; poly(ctx, v, [[-9, 0, -1], [L + 9, 0, -1], [L + 9, 0, D + 14], [-9, 0, D + 14]]); ctx.fill();
  // las franjas del pasto
  const n = 14;
  const stripeB = lighten(T.b, 0.07);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? T.a : stripeB; poly(ctx, v, [[L * i / n, 0, 0], [L * (i + 1) / n, 0, 0], [L * (i + 1) / n, 0, D], [L * i / n, 0, D]]); ctx.fill(); }
  // luz: más clara en el medio, más oscura lejos (profundidad)
  const [, yFar] = P(v, L / 2, 0, 0), [, yNear] = P(v, L / 2, 0, D);
  const g = ctx.createLinearGradient(0, yFar, 0, yNear); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.45, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g; poly(ctx, v, [[0, 0, 0], [L, 0, 0], [L, 0, D], [0, 0, D]]); ctx.fill();
  // las líneas
  ctx.save(); ctx.strokeStyle = alpha(T.line, 0.85); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = (pts: [number, number][], closed = false) => {
    const mid = pts[Math.floor(pts.length / 2)], s = project(v, mid[0], 0, mid[1])[2];
    ctx.lineWidth = Math.max(1, 0.13 * s); ctx.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = P(v, x, 0, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
    if (closed) ctx.closePath(); ctx.stroke();
  };
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number) => { const pts: [number, number][] = []; for (let k = 0; k <= 40; k++) { const a = a0 + (a1 - a0) * k / 40; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return pts; };
  line([[0, 0], [L, 0]]); line([[0, D], [L, D]]); line([[0, 0], [0, D]]); line([[L, 0], [L, D]]);
  line([[L / 2, 0], [L / 2, D]]); line(arc(L / 2, ZC, 3.6, 0, TAU), true);
  for (const left of [true, false]) {
    const gx = left ? 0 : L, s = left ? 1 : -1;
    line([[gx, ZC - AREA_W / 2], [gx + s * AREA_X, ZC - AREA_W / 2], [gx + s * AREA_X, ZC + AREA_W / 2], [gx, ZC + AREA_W / 2]]);
    line([[gx, ZC - GW / 2 - 1.2], [gx + s * 2.2, ZC - GW / 2 - 1.2], [gx + s * 2.2, ZC + GW / 2 + 1.2], [gx, ZC + GW / 2 + 1.2]]);
    line(arc(gx + s * 4.6, ZC, 3.2, left ? -0.93 : Math.PI - 0.93, left ? 0.93 : Math.PI + 0.93).filter(([x]) => left ? x > AREA_X : x < L - AREA_X));
    const [px, py, ps] = project(v, gx + s * 4.6, 0, ZC); ctx.fillStyle = alpha(T.line, 0.85); ctx.beginPath(); ctx.ellipse(px, py, 0.18 * ps, 0.1 * ps, 0, 0, TAU); ctx.fill();
  }
  const [cx, cy, cs] = project(v, L / 2, 0, ZC); ctx.fillStyle = alpha(T.line, 0.85); ctx.beginPath(); ctx.ellipse(cx, cy, 0.2 * cs, 0.11 * cs, 0, 0, TAU); ctx.fill();
  // brillo de las líneas (los escenarios de noche)
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(T.line, 0.12); ctx.lineWidth = Math.max(2, 0.4 * cs); ctx.beginPath();
  for (const [a, b] of [[[0, 0], [L, 0]], [[L / 2, 0], [L / 2, D]]] as [number, number][][]) { const [x0, y0] = P(v, a[0], 0, a[1]), [x1, y1] = P(v, b[0], 0, b[1]); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke(); ctx.restore();
}
// Los carteles que cierran la cancha (atrás y en las puntas), con letras que se iluminan.
function drawBoards(ctx: CanvasRenderingContext2D, v: SView, stage: StageId, t: number) {
  const T = PITCH[stage], H = 1.05, zb = -0.7;
  const panel = (a: [number, number], b: [number, number], k: number, label: string) => {
    const q: [number, number, number][] = [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]]];
    poly(ctx, v, q); ctx.fillStyle = T.board; ctx.fill();
    const [x0, y0] = P(v, a[0], H, a[1]), [x1, y1] = P(v, b[0], H, b[1]), [x3, y3] = P(v, a[0], 0, a[1]);
    const lit = 0.55 + 0.45 * Math.sin(t * 1.6 + k * 1.3);
    const gr = ctx.createLinearGradient(x0, y0, x3, y3); gr.addColorStop(0, alpha(lighten(T.glow, 0.2), 0.5 * lit)); gr.addColorStop(0.5, alpha(T.glow, 0.18)); gr.addColorStop(1, alpha(darken(T.board, 0.4), 0.9));
    poly(ctx, v, q); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = alpha(T.glow, 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    // el texto, con la perspectiva del cartel (transformación afín de las tres esquinas)
    const w = Math.hypot(x1 - x0, y1 - y0); if (w < 40) return;
    ctx.save(); ctx.transform((x1 - x0) / 100, (y1 - y0) / 100, (x3 - x0) / 10, (y3 - y0) / 10, x0, y0);
    ctx.font = '900 6.4px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = alpha('#ffffff', 0.55 + 0.4 * lit); ctx.fillText(label, 50, 5.4);
    ctx.restore();
  };
  const labels = ['KOMBAT FOOTBALL', 'FATAL GOAL', '⚡ PODER ⚡', 'KOMBAT FOOTBALL', '5 VS 5', 'GOL DE ORO'];
  for (let x = -6, k = 0; x < L + 6; x += 6, k++) panel([x, zb], [x + 6, zb], k, labels[k % labels.length]);
  for (const left of [true, false]) { const x = left ? -GD - 1.4 : L + GD + 1.4; for (let z = zb, k = 0; z < D + 3; z += 6, k++) panel(left ? [x, z + 6] : [x, z], left ? [x, z] : [x, z + 6], k + 3, k % 2 ? 'KOMBAT' : 'FOOTBALL'); }
}

// ---------------------------------------------------------------- Arcos
function goalPts(left: boolean, bulge: number) {
  const gx = left ? 0 : L, out = left ? -1 : 1, bx = gx + out * (GD + bulge), hb = GH * 0.8, z0 = ZC - GW / 2, z1 = ZC + GW / 2;
  return { gx, bx, hb, z0, z1 };
}
function drawNet(ctx: CanvasRenderingContext2D, v: SView, m: SoccerMatch | null, left: boolean) {
  const hit = m?.netHit && m.netHit.left === left ? m.netHit : null, bulge = hit ? Math.exp(-hit.t * 2.4) * (0.5 + 0.3 * Math.sin(hit.t * 24)) : 0;
  const { gx, bx, hb, z0, z1 } = goalPts(left, bulge);
  const faces: [number, number, number][][] = [
    [[bx, 0, z0], [bx, 0, z1], [bx, hb, z1], [bx, hb, z0]], // fondo
    [[gx, 0, z0], [bx, 0, z0], [bx, hb, z0], [gx, GH, z0]], // costado de atrás
    [[gx, GH, z0], [gx, GH, z1], [bx, hb, z1], [bx, hb, z0]], // techo
    [[gx, 0, z1], [bx, 0, z1], [bx, hb, z1], [gx, GH, z1]], // costado de adelante
  ];
  for (const f of faces) { poly(ctx, v, f); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(240,245,255,0.42)'; ctx.lineWidth = 1;
  const mesh = (f: [number, number, number][], nu: number, nv: number) => {
    const lerp = (a: number[], b: number[], k: number) => a.map((x, i) => x + (b[i] - x) * k) as [number, number, number];
    ctx.beginPath();
    for (let i = 0; i <= nu; i++) { const a = lerp(f[0], f[1], i / nu), b = lerp(f[3], f[2], i / nu), [x0, y0] = P(v, ...a), [x1, y1] = P(v, ...b); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    for (let j = 0; j <= nv; j++) { const a = lerp(f[0], f[3], j / nv), b = lerp(f[1], f[2], j / nv), [x0, y0] = P(v, ...a), [x1, y1] = P(v, ...b); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke();
  };
  mesh(faces[0], 14, 6); mesh(faces[1], 4, 6); mesh(faces[2], 14, 4); mesh(faces[3], 4, 6);
}
function post(ctx: CanvasRenderingContext2D, v: SView, a: [number, number, number], b: [number, number, number], glow: string | null) {
  const [x0, y0, s0] = project(v, ...a), [x1, y1, s1] = project(v, ...b), w = Math.max(2, 0.15 * (s0 + s1) / 2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#11141a'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = '#e5e9f0'; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, w * 0.3); ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.lineTo(x1 - w * 0.2, y1); ctx.stroke();
  if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(glow, 0.35); ctx.lineWidth = w * 2.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); }
}

// ---------------------------------------------------------------- Pelota, poderes y efectos
function drawBall(ctx: CanvasRenderingContext2D, m: SoccerMatch, v: SView) {
  const b = m.ball;
  const glow = b.fatal ? CHARS[m.players[m.fatal?.shooter ?? 0]?.char ?? 'inferno'].glow : b.fx === 'fire' ? '#fb923c' : b.fx === 'ice' ? '#bae6fd' : b.fx === 'volt' ? '#fde047' : b.fx === 'toxic' ? '#4ade80' : b.fx === 'dark' ? '#c084fc' : b.fx === 'rock' ? '#fbbf24' : '#e0f2fe';
  if (m.trail.length > 2) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < m.trail.length; i++) { const k = 1 - i / m.trail.length, [x0, y0, s0] = project(v, ...m.trail[i - 1]), [x1, y1] = project(v, ...m.trail[i]); ctx.strokeStyle = alpha(glow, (b.fx !== 'none' || b.fatal ? 0.6 : 0.3) * k); ctx.lineWidth = BR * 2 * s0 * k * (b.fatal ? 1.8 : 1); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.restore();
  }
  const [x, y, s] = project(v, b.x, b.y, b.z);
  if (b.comet && !b.fatal) cometTail(ctx, v, m, x, y, s);
  if (b.fatal) { bloom(ctx, x, y, BR * s * 5, glow, 0.8); fatalAura(ctx, x, y, BR * s * 1.25, b.fx === 'none' ? 'fire' : b.fx, m.time, b.vx < 0 ? -1 : 1); }
  const kind = b.fx === 'fire' ? 'fire' : b.fx === 'ice' ? 'ice' : b.fx === 'toxic' ? 'toxic' : b.fx === 'dark' ? 'void' : 'normal';
  drawBallSprite(ctx, x, y, BR * s * (b.fatal ? 1.25 : 1), b.roll, kind, b.fx === 'volt' ? 'volt' : b.fx === 'fire' ? 'fire' : 'none', m.time);
}
// El tiro bien cargado: la pelota sale como un cometa, con una cola de fuego larga atrás.
function cometTail(ctx: CanvasRenderingContext2D, v: SView, m: SoccerMatch, x: number, y: number, s: number) {
  const b = m.ball, r = BR * s, pts: [number, number][] = [[x, y], ...m.trail.map(p => { const q = project(v, ...p); return [q[0], q[1]] as [number, number]; })];
  if (pts.length < 2) { const [bx, by] = P(v, b.x - b.vx * 0.12, b.y, b.z - b.vz * 0.12); pts.push([bx, by]); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = pts.length;
  for (const [w, col, a] of [[2.6, '#dc2626', 0.35], [1.8, '#f97316', 0.55], [1.0, '#fde047', 0.8], [0.45, '#fffbeb', 0.9]] as const) {
    for (let i = 1; i < n; i++) {
      const k = 1 - (i - 1) / n, j = Math.sin(m.time * 40 + i * 1.7) * r * 0.25 * (1 - k);
      ctx.strokeStyle = alpha(col, a * k); ctx.lineWidth = Math.max(1, r * w * k);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0] + j, pts[i][1] - Math.abs(j) * 0.6); ctx.stroke();
    }
  }
  // lenguas de fuego alrededor de la pelota, hacia atrás
  const [tx, ty] = pts[1], back = Math.atan2(ty - y, tx - x);
  for (let k = 0; k < 9; k++) { const a = back + (k - 4) * 0.28, l = r * (2 + Math.sin(m.time * 33 + k * 2.3) * 0.6);
    ctx.fillStyle = k % 2 ? 'rgba(253,224,71,0.75)' : 'rgba(249,115,22,0.7)';
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 1.2) * r, y + Math.sin(a - 1.2) * r); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a + 1.2) * r, y + Math.sin(a + 1.2) * r); ctx.fill(); }
  bloom(ctx, x, y, r * 4, '#fb923c', 0.75);
  ctx.restore();
}
// La pelota del FATAL: fuego, electricidad, hielo, energía oscura, ácido o lava según el luchador.
function fatalAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, el: Element, t: number, dir: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (el === 'fire' || el === 'rock') { // llamas que salen para atrás
    for (let k = 0; k < 10; k++) { const a = Math.PI * (dir > 0 ? 1 : 0) + (k - 4.5) * 0.22, l = r * (2.2 + Math.sin(t * 30 + k * 2) * 0.7);
      ctx.fillStyle = k % 2 ? (el === 'rock' ? 'rgba(251,146,60,0.65)' : 'rgba(253,224,71,0.7)') : 'rgba(239,68,68,0.6)';
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.5) * r, y + Math.sin(a - 0.5) * r); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.7 - r * 0.3); ctx.lineTo(x + Math.cos(a + 0.5) * r, y + Math.sin(a + 0.5) * r); ctx.fill(); }
  } else if (el === 'volt') { // rayos que saltan alrededor
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (let k = 0; k < 6; k++) { let a = t * 40 + k * 1.7, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { a += Math.sin(t * 90 + k * 7 + j) * 0.9; px += Math.cos(a) * r * 0.7; py += Math.sin(a) * r * 0.7; ctx.lineTo(px, py); } ctx.stroke(); }
  } else { // energía: anillos que laten (hielo celeste, oscuridad violeta, ácido verde)
    const c = el === 'ice' ? '#bae6fd' : el === 'dark' ? '#e879f9' : '#86efac';
    for (let k = 0; k < 3; k++) { const ph = (t * 3 + k / 3) % 1; ctx.strokeStyle = alpha(c, 0.8 * (1 - ph)); ctx.lineWidth = Math.max(1.5, r * 0.15); ctx.beginPath(); ctx.arc(x, y, r * (1 + ph * 1.8), 0, TAU); ctx.stroke(); }
    bloom(ctx, x, y, r * 3, c, 0.6);
  }
  ctx.restore();
}
function drawShadow(ctx: CanvasRenderingContext2D, v: SView, x: number, z: number, r: number, a: number) {
  const [px, py, s] = project(v, x, 0, z); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(px, py, r * s, r * s * 0.5, 0, 0, TAU); ctx.fill();
}
// Un proyectil de ataque, según su forma (fuego, hielo, plasma, estrella ninja, bomba, pluma, burbuja, roca,
// calavera, tajo láser, rayo, láser, pico, misil, meteorito, granizo).
function shapeAt(ctx: CanvasRenderingContext2D, shape: AtkShape, r: number, c: { color: string; glow: string }, t: number, ang: number) {
  const dot = (rr: number, g0: string, g1: string, g2: string) => { const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, 0, 0, 0, rr); g.addColorStop(0, g0); g.addColorStop(0.45, g1); g.addColorStop(1, g2); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill(); };
  switch (shape) {
    case 'fire': case 'meteor': {
      ctx.rotate(ang);
      for (let k = 0; k < 7; k++) { const l = r * (2.2 + Math.sin(t * 30 + k * 2.1) * 0.6), a = Math.PI + (k - 3) * 0.3; ctx.fillStyle = k % 2 ? 'rgba(253,224,71,0.85)' : 'rgba(239,68,68,0.8)'; ctx.beginPath(); ctx.moveTo(Math.cos(a - 1.1) * r, Math.sin(a - 1.1) * r); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.lineTo(Math.cos(a + 1.1) * r, Math.sin(a + 1.1) * r); ctx.fill(); }
      if (shape === 'meteor') { ctx.fillStyle = '#44261a'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = r * (0.8 + ((k * 37) % 5) / 12); ctx.lineTo(Math.cos(k * TAU / 8) * rr, Math.sin(k * TAU / 8) * rr); } ctx.fill(); ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2; ctx.stroke(); }
      else dot(r, '#fffbeb', '#fde047', '#f97316');
      break;
    }
    case 'ice': case 'hail': {
      ctx.rotate(ang + (shape === 'hail' ? t * 4 : 0)); ctx.fillStyle = '#e0f2fe'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(0, -r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(0, -r * 0.35); ctx.lineTo(-r * 0.4, 0); ctx.fill();
      break;
    }
    case 'plasma': dot(r, '#ffffff', c.glow, c.color); ctx.strokeStyle = alpha(c.glow, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * (1.3 + Math.sin(t * 25) * 0.15), 0, TAU); ctx.stroke(); break;
    case 'shuriken': case 'bomb': {
      ctx.rotate(t * 22); ctx.fillStyle = shape === 'bomb' ? '#ef4444' : '#d4d4d8'; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.38 : r * 1.25; ctx.lineTo(Math.cos(k * TAU / 8) * rr, Math.sin(k * TAU / 8) * rr); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = shape === 'bomb' ? '#fde047' : '#52525b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
      break;
    }
    case 'feather': ctx.rotate(ang); ctx.fillStyle = c.color; ctx.strokeStyle = c.glow; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.quadraticCurveTo(0, -r * 0.8, -r * 1.6, 0); ctx.quadraticCurveTo(0, r * 0.8, r * 1.8, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(-r * 2.1, 0); ctx.stroke(); break;
    case 'bubble': ctx.fillStyle = 'rgba(74,222,128,0.45)'; ctx.strokeStyle = '#bbf7d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.4, r * 0.25, 0, TAU); ctx.fill(); break;
    case 'rock': case 'spike': ctx.rotate(t * 7); ctx.fillStyle = shape === 'spike' ? '#7c2d12' : '#78716c'; ctx.beginPath(); for (let k = 0; k < 7; k++) { const rr = r * (0.9 + ((k * 37) % 5) / 10); ctx.lineTo(Math.cos(k * TAU / 7) * rr, Math.sin(k * TAU / 7) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = shape === 'spike' ? '#f97316' : '#44403c'; ctx.lineWidth = 2; ctx.stroke(); break;
    case 'skull': {
      dot(r * 1.3, alpha('#ffffff', 0.5), alpha(c.glow, 0.5), alpha(c.color, 0)); ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.8, 0, TAU); ctx.fill(); ctx.fillRect(-r * 0.45, r * 0.3, r * 0.9, r * 0.45);
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, r * 0.2, 0, TAU); ctx.arc(r * 0.3, -r * 0.1, r * 0.2, 0, TAU); ctx.fill();
      break;
    }
    case 'blade': ctx.rotate(ang); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.arc(-r * 0.6, 0, r * 1.6, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = alpha(c.glow, 0.8); ctx.lineWidth = r * 0.8; ctx.stroke(); break;
    case 'missile': ctx.rotate(ang); ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 0.6, -r * 0.45); ctx.lineTo(-r * 1.2, -r * 0.45); ctx.lineTo(-r * 1.2, r * 0.45); ctx.lineTo(r * 0.6, r * 0.45); ctx.closePath(); ctx.fill(); ctx.fillStyle = c.color; ctx.fillRect(-r * 1.2, -r * 0.7, r * 0.5, r * 1.4); ctx.fillStyle = 'rgba(253,186,116,0.9)'; ctx.beginPath(); ctx.moveTo(-r * 1.2, -r * 0.3); ctx.lineTo(-r * (2 + Math.sin(t * 40) * 0.4), 0); ctx.lineTo(-r * 1.2, r * 0.3); ctx.fill(); break;
    case 'bolt': case 'laser': dot(r, '#ffffff', c.glow, c.color); break;
  }
}
function drawProj(ctx: CanvasRenderingContext2D, v: SView, m: SoccerMatch, p: Proj) {
  const c = CHARS[m.players[p.from].char], t = m.time, big = p.big ? 1.6 : 1;
  if (p.kind === 'sky') { // la marca en el piso y lo que cae
    const [gx, gy, gs] = project(v, p.x, 0, p.z), k = p.t / p.life, rr = p.w * gs;
    ctx.save(); ctx.strokeStyle = alpha(c.glow, 0.5 + 0.4 * Math.sin(t * 20)); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(gx, gy, rr * (1.2 - k * 0.4), rr * 0.5 * (1.2 - k * 0.4), 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = alpha(c.color, 0.15 + k * 0.25); ctx.fill(); ctx.restore();
    const [x, y, s] = project(v, p.x, p.y, p.z), r = 0.45 * s * (p.shape === 'meteor' ? 1.5 : 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (p.shape === 'bolt' || p.shape === 'laser') { // rayo/láser que baja del cielo
      if (k > 0.75) { const [tx, ty] = P(v, p.x, 14, p.z); ctx.strokeStyle = alpha(c.glow, 0.9); ctx.lineWidth = s * 0.25; ctx.beginPath(); ctx.moveTo(tx, ty); for (let i = 1; i <= 8; i++) ctx.lineTo(tx + (gx - tx) * i / 8 + (p.shape === 'bolt' ? Math.sin(i * 9 + t * 70) * 14 : 0), ty + (gy - ty) * i / 8); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.08; ctx.stroke(); }
      ctx.restore(); return;
    }
    const [tx, ty] = P(v, p.x, p.y + 2.5, p.z); ctx.strokeStyle = alpha(c.glow, 0.5); ctx.lineWidth = r * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    bloom(ctx, x, y, r * 3, c.color, 0.7); ctx.restore();
    ctx.save(); ctx.translate(x, y); shapeAt(ctx, p.shape, r, c, t, Math.PI / 2); ctx.restore();
    return;
  }
  if (p.kind === 'wave') { // la onda que avanza por el piso
    const [x, y, s] = project(v, p.x, 0, p.z), w = p.w * s;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    bloom(ctx, x, y, w * 1.6, c.color, 0.7);
    for (let k = 0; k < 7; k++) { const ox = (Math.sin(k * 2.7 + t * 9) * 0.5) * w * 1.3, h = (0.6 + ((k * 37) % 5) / 6) * s * (p.shape === 'spike' || p.shape === 'rock' ? 1.3 : 0.9) * (1 + Math.sin(t * 25 + k) * 0.2);
      ctx.fillStyle = k % 2 ? alpha(c.glow, 0.85) : alpha(c.color, 0.75);
      ctx.beginPath(); ctx.moveTo(x + ox - s * 0.25, y); ctx.lineTo(x + ox, y - h); ctx.lineTo(x + ox + s * 0.25, y); ctx.fill(); }
    ctx.strokeStyle = alpha(c.glow, 0.8); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.45, 0, 0, TAU); ctx.stroke();
    ctx.restore(); return;
  }
  const [x, y, s] = project(v, p.x, p.y, p.z), r = 0.3 * s * big;
  drawShadow(ctx, v, p.x, p.z, 0.3 * big, 0.3);
  const [bx, by] = P(v, p.x - p.vx * 0.07, p.y, p.z - p.vz * 0.07), ang = Math.atan2(y - by, x - bx);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = alpha(c.glow, 0.5); ctx.lineWidth = r * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
  bloom(ctx, x, y, r * 3.2, c.color, 0.7);
  ctx.restore();
  ctx.save(); ctx.translate(x, y); shapeAt(ctx, p.shape, r, c, t, ang); ctx.restore();
}
function drawFx(ctx: CanvasRenderingContext2D, v: SView, e: SFx) {
  const k = e.t / e.life;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (e.kind === 'bolt') {
    const [x0, y0] = P(v, e.x, e.y, e.z), [x1, y1] = P(v, e.x2, e.y2, e.z2), n = 9;
    for (const [w, a, col] of [[7, 0.35, e.color], [2.5, 0.95, '#ffffff']] as const) {
      ctx.strokeStyle = alpha(col, a * (1 - k)); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0);
      for (let i = 1; i < n; i++) { const u = i / n, j = (Math.sin(i * 12.9 + e.t * 80) * 0.5) * 18; ctx.lineTo(x0 + (x1 - x0) * u + j, y0 + (y1 - y0) * u + j * 0.6); }
      ctx.lineTo(x1, y1); ctx.stroke();
    }
    bloom(ctx, x1, y1, 40, e.color, 0.7 * (1 - k));
  } else if (e.kind === 'beam') { // rayo recto que atraviesa la cancha
    const [x0, y0, s0] = project(v, e.x, e.y, e.z), [x1, y1] = P(v, e.x2, e.y2, e.z2), w = s0 * (e.life > 0.6 ? 1.1 : 0.6) * (1 - k * 0.6);
    for (const [ww, a, col] of [[2.2, 0.35, e.color], [1, 0.8, e.color], [0.35, 1, '#ffffff']] as const) { ctx.strokeStyle = alpha(col, a * (1 - k)); ctx.lineWidth = w * ww; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    bloom(ctx, x0, y0, w * 3, e.color, 0.8 * (1 - k));
  } else if (e.kind === 'nova') { // explosión alrededor (anillos en el piso)
    for (let i = 0; i < 3; i++) { const kk = Math.min(1, k * 1.4 - i * 0.15); if (kk <= 0) continue; const [x, y, s] = project(v, e.x, 0, e.z), r = e.x2 * s * kk; ctx.strokeStyle = alpha(i ? e.color : '#ffffff', 0.85 * (1 - kk)); ctx.lineWidth = Math.max(2, s * 0.35 * (1 - kk)); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.stroke(); if (!i) { ctx.fillStyle = alpha(e.color, 0.25 * (1 - kk)); ctx.fill(); } }
    const [x, y, s] = project(v, e.x, 1, e.z); bloom(ctx, x, y, s * e.x2 * 0.6, e.color, 0.8 * (1 - k));
  } else {
    const [x, y, s] = project(v, e.x, e.y, e.z), r = s * (e.kind === 'boom' ? 0.6 + k * 1.8 : 0.3 + k);
    bloom(ctx, x, y, r * 2, e.color, 0.8 * (1 - k));
    ctx.strokeStyle = alpha(e.color, 0.9 * (1 - k)); ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export interface DrawOpts { activeIds?: number[]; noBackdrop?: boolean } // noBackdrop: el fondo va en otra capa (siempre en alta calidad)
export function drawSoccer(ctx: CanvasRenderingContext2D, m: SoccerMatch, w: number, h: number, opts: DrawOpts = {}) {
  const v = soccerView(w, h, m.cam.x, m.cam.z), stage = m.stage, rim = THEMES[stage].light;
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * 10, (Math.random() - 0.5) * m.shake * 10);
  if (!opts.noBackdrop) drawBackdrop(ctx, v, stage);
  drawScene(ctx, v, stage, m.time, m);
  drawStains(ctx, v, m);
  // en el piso: el aro de cada equipo debajo de cada uno (amarillo: el que manejás) y la sombra de la pelota
  const act = new Set(opts.activeIds ?? []);
  for (const p of m.players) {
    if (p.gone) continue;
    const [px, py, s] = project(v, p.x, 0, p.z), r = 0.62 * Math.sqrt(SIZE[p.char]) * s * PLAYER_SCALE, on = act.has(p.id);
    ctx.lineWidth = Math.max(1.5, s * (on ? 0.11 : 0.06));
    ctx.strokeStyle = on ? (p.team === 0 ? '#facc15' : '#fb923c') : alpha(TEAM_C[p.team], 0.85);
    ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.5, 0, 0, TAU); ctx.stroke();
    if (on) { ctx.fillStyle = alpha(p.team === 0 ? '#facc15' : '#fb923c', 0.18); ctx.fill(); }
  }
  const b = m.ball; drawShadow(ctx, v, b.x, b.z, BR * 1.05, Math.max(0.12, 0.45 - b.y * 0.05));
  // lo que tiene altura, de atrás para adelante
  type Item = { z: number; draw: () => void };
  const items: Item[] = [];
  for (const p of m.players) if (!p.gone && !(p.inv > 0 && Math.sin(m.time * 40) < 0)) items.push({ z: p.z, draw: () => drawPlayer(ctx, v, m, p, rim, act.has(p.id)) });
  for (const g of m.gore.gibs) items.push({ z: g.z, draw: () => { const [x, y, s] = project(v, g.x, g.y, g.z), a = Math.min(1, (9 - g.life) / 1.5); ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s * 1.7, s * 1.7); ctx.rotate(g.a); drawGib(ctx, g.kind, g.c); ctx.restore(); } });
  const r = m.ref; items.push({ z: r.z, draw: () => { const [x, y, s] = project(v, r.x, 0, r.z); drawRefLit(ctx, r, m.time + 0.7, x, y, s * PLAYER_SCALE, rim); } });
  items.push({ z: b.z + 0.01, draw: () => drawBall(ctx, m, v) });
  for (const left of [true, false]) { const gx = left ? 0 : L; items.push({ z: ZC + GW / 2, draw: () => post(ctx, v, [gx, 0, ZC + GW / 2], [gx, GH, ZC + GW / 2], null) }); }
  items.sort((a, c) => a.z - c.z);
  for (const it of items) it.draw();
  ctx.fillStyle = '#b10f1c'; for (const d of m.gore.drops) { const [x, y, s] = project(v, d.x, d.y, d.z); ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, d.r * s), 0, TAU); ctx.fill(); }
  for (const s of m.projs) drawProj(ctx, v, m, s);
  for (const e of m.fx) drawFx(ctx, v, e);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of m.particles) { const [x, y, s] = project(v, p.x, p.y, p.z), k = 1 - p.life / p.max; ctx.fillStyle = alpha(p.color, k); const sz = Math.max(1.5, p.size * s); ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz); }
  ctx.restore();
  // FATAL GOAL: todo se oscurece y el que tira brilla
  if (m.phase === 'fatal' && m.fatal) {
    const k = Math.min(1, m.phaseT * 3), p = m.players[m.fatal.shooter], L2 = LOOKS[p.char], [x, y, s] = project(v, p.x, 0, p.z);
    ctx.fillStyle = `rgba(0,0,0,${0.6 * k})`; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y - s, s * 4, L2.glow, 0.8 * k);
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + m.time * 2; ctx.strokeStyle = alpha(L2.glow, 0.5 * k); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s, y - s + Math.sin(a) * s); ctx.lineTo(x + Math.cos(a) * s * (3.5 + Math.sin(m.time * 9 + i)), y - s + Math.sin(a) * s * (3.5 + Math.sin(m.time * 9 + i))); ctx.stroke(); }
    ctx.restore();
    drawFighterLit(ctx, p, m.time, { power: 1, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: L2.glow }, x, y - p.y * s, s * PLAYER_SCALE, L2.glow);
    drawBall(ctx, m, v);
  }
  if (m.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${m.flash * 0.4})`; ctx.fillRect(0, 0, w, h); }
  const vg = ctx.createRadialGradient(w / 2, h * 0.6, Math.min(w, h) * 0.4, w / 2, h * 0.6, Math.max(w, h) * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (m.screenBlood.length) drawScreenBlood(ctx, m.screenBlood, { w, h } as View);
  ctx.restore();
}
// El fondo, los carteles, la cancha y lo de atrás de los arcos (también para las miniaturas).
function drawBackdrop(ctx: CanvasRenderingContext2D, v: SView, stage: StageId) {
  const [, yb0] = P(v, -6, 1.05, -0.7), [, yb1] = P(v, L + 6, 1.05, -0.7), ground = Math.max(yb0, yb1) + 6;
  const bg = backdrop(stage, v.w, v.h, ground);
  if (bg) { const off = -((v.tx - L / 2) / L) * v.w * PARALLAX - v.w * PARALLAX / 2; ctx.drawImage(bg, off, 0); }
  else { ctx.fillStyle = THEMES[stage].sky[1]; ctx.fillRect(0, 0, v.w, ground); }
}
// La capa del fondo sola (en otro lienzo, con toda la resolución de la pantalla, así nunca pierde calidad).
export function drawSoccerBackdrop(ctx: CanvasRenderingContext2D, m: SoccerMatch, w: number, h: number) {
  ctx.clearRect(0, 0, w, h); drawBackdrop(ctx, soccerView(w, h, m.cam.x, m.cam.z), m.stage);
}
// Las manchas de sangre en el pasto.
function drawStains(ctx: CanvasRenderingContext2D, v: SView, m: SoccerMatch) {
  for (const st of m.gore.stains) {
    const [x, y, s] = project(v, st.x, 0, st.z), a = st.t < 30 ? 0.85 : Math.max(0, 0.85 * (1 - (st.t - 30) / 10)), r = st.r * s * Math.min(1, st.t * 8 + 0.3);
    ctx.fillStyle = `rgba(110,4,10,${a})`; ctx.beginPath();
    for (let k = 0; k < 9; k++) { const ang = k / 9 * TAU, rr = r * (0.7 + ((Math.sin(st.seed * 7 + k * 3.1) + 1) / 2) * 0.5); ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.5); }
    ctx.closePath(); ctx.fill();
  }
}
function drawScene(ctx: CanvasRenderingContext2D, v: SView, stage: StageId, t: number, m: SoccerMatch | null) {
  drawPitch(ctx, v, stage);
  drawBoards(ctx, v, stage, t);
  for (const left of [true, false]) {
    drawNet(ctx, v, m, left);
    const gx = left ? 0 : L, glow = m ? LOOKS[m.teams[defendsLeftTeam(m, left)].captain].glow : null;
    post(ctx, v, [gx, 0, ZC - GW / 2], [gx, GH, ZC - GW / 2], null); // palo de atrás
    post(ctx, v, [gx, GH, ZC - GW / 2], [gx, GH, ZC + GW / 2], glow); // travesaño
  }
}
const defendsLeftTeam = (m: SoccerMatch, left: boolean): 0 | 1 => ((m.half === 1) === left ? 0 : 1);
function drawPlayer(ctx: CanvasRenderingContext2D, v: SView, m: SoccerMatch, p: Player, rim: string, active: boolean) {
  const [x, y, s] = project(v, p.x, p.y, p.z), T = m.teams[p.team];
  drawFighterLit(ctx, p, m.time + p.id * 0.37, {
    power: T.power / POWER_MAX, frozen: p.stun > 0 && p.stunKind === 'freeze', poison: p.slow > 0 || (p.stun > 0 && p.stunKind === 'poison'), burn: p.stun > 0 && p.stunKind === 'burn',
    zap: p.stun > 0 && p.stunKind === 'zap', shield: false, speed: false, aura: T.power >= POWER_MAX && m.ball.owner === p.id ? LOOKS[p.char].glow : null,
  }, x, y, s * PLAYER_SCALE, rim);
  if (p.dash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y - hOf(p) * s * 0.5, hOf(p) * s, CHARS[p.char].glow, 0.7); ctx.restore(); } // sale disparado
  const top = y - hOf(p) * s - 0.3 * s;
  if (active) { // la flechita arriba del que manejás
    const c = p.team === 0 ? '#facc15' : '#fb923c', a = s * 0.22, bob = Math.sin(m.time * 6) * s * 0.06;
    ctx.fillStyle = c; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - a, top - a * 1.3 + bob); ctx.lineTo(x + a, top - a * 1.3 + bob); ctx.lineTo(x, top + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (p.chargeOn) { // la barra del tiro cargado
    const k = Math.min(1, p.charge / CHARGE_TIME), bw = s * 1.3, bh = Math.max(4, s * 0.14), bx = x - bw / 2, by = top - s * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = k > 0.9 ? '#ef4444' : k > 0.6 ? '#facc15' : '#22c55e'; ctx.fillRect(bx, by, bw * k, bh);
  }
  if (active && p.role !== 'gk' && m.teams[p.team].atkCd[0] <= 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, top + s * 0.4, s * 0.35, CHARS[p.char].glow, 0.35 + 0.2 * Math.sin(m.time * 8)); ctx.restore(); }
}
// Miniatura del escenario (para elegirlo).
export function drawSoccerThumb(ctx: CanvasRenderingContext2D, stage: StageId, w: number, h: number) {
  const v = { ...soccerView(w, h, L / 2, ZC), F: h * 1.25, dist: 44, cy: h * 0.74, tx: L / 2, tz: ZC, cyw: 1, syw: 0 }; // (de lejos: se ve más fondo)
  drawBackdrop(ctx, v, stage); drawScene(ctx, v, stage, 0, null);
}
