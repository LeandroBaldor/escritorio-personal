// Cómo se ve Kombat Football: la cámara de costado fija con los dos arcos siempre a la vista; el fondo de cada
// escenario (ciudad industrial de noche, minas espaciales, base en el espacio, planeta helado y volcánico,
// bosque bioluminiscente, fábrica robótica, torres en la tormenta, templo antiguo y la Luna), el piso visto en
// corte, los desniveles y plataformas, el tubo del medio, los arcos con red, las trampas (pinches, sierras,
// láseres, fuego, placas eléctricas, minas, bolas con púas, lava), los luchadores, el árbitro, la pelota, las
// habilidades, los potenciadores y los efectos. El mundo se mide en metros (kombat.ts); acá se pasa a píxeles.
import {
  BALLS, BALL_R, BAR, CHARS, GOAL_DEPTH, H, POWERS, POWER_MAX, TUBE_Y, W, fatalPath, goalHeight, minePos, sawPos, teamAt, wreckPos,
  type Ball, type Fx, type Hazard, type Match, type Particle, type PowerKind, type Shot, type Solid, type StageId,
} from './kombat';
import { drawFighterBody, drawRef, LOOKS } from './kombatFighters';
import { alpha, bloom, darken, grain, hash, lighten, lin, shade, spec, zap } from './gravityMonsters';
import { bolt, hazardStripes, laserBeam, laserEmitter, laserWarnLine, plate, rock, sawBlade, seaMine, steelSpikes } from './gravityHazardArt';
import { fbm } from './gravityBackdrops';

const TAU = Math.PI * 2;
export interface View { w: number; h: number; s: number; ox: number; oy: number }
// La cancha ocupa todo el ancho de la pantalla (un arco en cada borde); abajo se ve el piso en corte.
export function viewFor(w: number, h: number): View {
  const s = Math.min(w / W, h / 12.5);
  return { w, h, s, ox: (w - W * s) / 2, oy: h - Math.min(1.6 * s, h * 0.14) };
}
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;

type Floor = 'metal' | 'rock' | 'panel' | 'ice' | 'lava' | 'moss' | 'grate' | 'stone' | 'jungle' | 'moon';
type Support = 'truss' | 'chains' | 'vines' | 'none';
interface Theme { sky: [string, string, string]; fog: string; floor: Floor; support: Support; light: string; edge: string; cloud: [number, number, number, number]; laser: string }
export const THEMES: Record<StageId, Theme> = {
  industrial: { sky: ['#050a1c', '#0f1d45', '#283f78'], fog: 'rgba(60,90,170,0.10)', floor: 'metal', support: 'truss', light: '#fbbf24', edge: '#38bdf8', cloud: [60, 80, 140, 0.55], laser: '#ff2850' },
  mines: { sky: ['#06030f', '#160b2e', '#2a1550'], fog: 'rgba(140,90,220,0.08)', floor: 'rock', support: 'truss', light: '#f97316', edge: '#c084fc', cloud: [130, 70, 200, 0.6], laser: '#ff3b3b' },
  base: { sky: ['#050b14', '#0b1a2b', '#13283d'], fog: 'rgba(80,150,220,0.06)', floor: 'panel', support: 'none', light: '#93c5fd', edge: '#38bdf8', cloud: [40, 80, 120, 0], laser: '#ff2850' },
  ice: { sky: ['#071430', '#1a3d74', '#3f6fb0'], fog: 'rgba(200,230,255,0.12)', floor: 'ice', support: 'chains', light: '#e0f2fe', edge: '#bae6fd', cloud: [170, 200, 240, 0.45], laser: '#38bdf8' },
  volcano: { sky: ['#1a0402', '#5a1206', '#b2340b'], fog: 'rgba(255,90,30,0.12)', floor: 'lava', support: 'chains', light: '#fb923c', edge: '#fdba74', cloud: [120, 35, 15, 0.7], laser: '#fde047' },
  forest: { sky: ['#030a14', '#08203a', '#0f3557'], fog: 'rgba(80,200,255,0.08)', floor: 'moss', support: 'vines', light: '#67e8f9', edge: '#a3e635', cloud: [40, 90, 140, 0.4], laser: '#e879f9' },
  factory: { sky: ['#0b0a0a', '#1d1813', '#30261b'], fog: 'rgba(255,170,80,0.06)', floor: 'grate', support: 'truss', light: '#fbbf24', edge: '#f59e0b', cloud: [90, 70, 50, 0], laser: '#ff2850' },
  storm: { sky: ['#05070f', '#141c33', '#2a3557'], fog: 'rgba(150,160,200,0.12)', floor: 'stone', support: 'chains', light: '#c7d2fe', edge: '#a5b4fc', cloud: [80, 90, 130, 0.85], laser: '#ff2850' },
  temple: { sky: ['#06120b', '#123322', '#21543a'], fog: 'rgba(140,220,170,0.08)', floor: 'jungle', support: 'vines', light: '#fdba74', edge: '#a3e635', cloud: [70, 120, 90, 0.35], laser: '#ff2850' },
  moon: { sky: ['#010208', '#060a1a', '#0e1530'], fog: 'rgba(160,180,220,0.05)', floor: 'moon', support: 'none', light: '#e2e8f0', edge: '#cbd5e1', cloud: [60, 70, 110, 0], laser: '#ff2850' },
};

// ---------------------------------------------------------------- Fondo + piso + plataformas + tubo (se pintan una vez)
const bgCache = new Map<string, HTMLCanvasElement | null>();
function background(m: Match, v: View): HTMLCanvasElement | null {
  const key = `${m.stage}:${Math.round(v.w)}x${Math.round(v.h)}`;
  if (bgCache.has(key)) return bgCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.w)); c.height = Math.max(1, Math.round(v.h));
  const g = c.getContext('2d');
  if (!g) { bgCache.set(key, null); return null; }
  if (bgCache.size > 8) bgCache.clear();
  paintScenery(g, m.stage, v);
  paintFloor(g, m.stage, v);
  for (const s of m.solids) paintSolid(g, m.stage, s, v);
  paintTube(g, v);
  bgCache.set(key, c);
  return c;
}
// Miniatura de un escenario (para elegirlo), sin luchadores.
export function drawStageThumb(ctx: CanvasRenderingContext2D, m: Match, w: number, h: number) {
  const s = w / W, v: View = { w, h: Math.max(h, (H * 0.75) * s), s, ox: 0, oy: h - 1.2 * s };
  paintScenery(ctx, m.stage, v); paintFloor(ctx, m.stage, v);
  for (const sd of m.solids) paintSolid(ctx, m.stage, sd, v);
  for (const hz of m.hazards) { if (hz.kind === 'spikes' || hz.kind === 'laser' || hz.kind === 'saw' || hz.kind === 'flame' || hz.kind === 'shock') { const st = hz.state; hz.state = 2; drawTrap(ctx, hz, m, v); hz.state = st; } else if (hz.kind !== 'meteor' && hz.kind !== 'icicle' && hz.kind !== 'lightning') drawHazard(ctx, hz, m, v); }
  drawGoal(ctx, m, v, true, false); drawGoal(ctx, m, v, false, false); drawGoal(ctx, m, v, true, true); drawGoal(ctx, m, v, false, true);
}

// Nubes, humo o nebulosa con ruido fractal en baja resolución (después se estira suave).
function cloudLayer(stage: StageId, w: number, h: number): HTMLCanvasElement | null {
  const T = THEMES[stage]; if (!T.cloud[3]) return null;
  const cw = Math.max(1, Math.round(w / 4)), ch = Math.max(1, Math.round(h / 4));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); if (!g) return null;
  const img = g.createImageData(cw, ch), seed = stage.length * 7 + stage.charCodeAt(0);
  const [cr, cg, cb, ca] = T.cloud;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const u = x / cw * 6, vv = y / ch * 3;
    const n = fbm(u + fbm(u * 0.5, vv * 0.5, seed + 3, 3) * 1.5, vv * 1.6, seed, 5);
    const d = Math.max(0, Math.min(1, (n - 0.45) * 3.2)) * (1 - y / ch * 0.55);
    const light = Math.max(0, Math.min(1, (fbm(u + 0.15, vv - 0.2, seed, 4) - n) * 6 + 0.5));
    const i = (y * cw + x) * 4;
    img.data[i] = Math.min(255, cr * (0.6 + light * 0.7)); img.data[i + 1] = Math.min(255, cg * (0.6 + light * 0.7)); img.data[i + 2] = Math.min(255, cb * (0.6 + light * 0.7)); img.data[i + 3] = 255 * d * ca;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function paintScenery(g: CanvasRenderingContext2D, stage: StageId, v: View) {
  const T = THEMES[stage], s = v.s, w = v.w, h = v.h, ground = Y(v, 0);
  const r = (n: number) => hash(n * 1.37 + stage.length * 11.1);
  g.fillStyle = lin(g, 0, 0, 0, ground, [[0, T.sky[0]], [0.55, T.sky[1]], [1, T.sky[2]]]); g.fillRect(0, 0, w, h);
  const stars = (n: number, top: number) => { for (let k = 0; k < n; k++) { g.fillStyle = `rgba(255,255,255,${0.25 + r(k) * 0.7})`; const sz = r(k + 3) < 0.07 ? 2 : 1; g.fillRect(r(k + 1) * w, r(k + 2) * top, sz, sz); } };
  const glowDisc = (x: number, y: number, rr: number, color: string, a: number) => { const gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, alpha(color, a)); gg.addColorStop(1, alpha(color, 0)); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); };
  const moon = (x: number, y: number, rr: number, tint = '#c9d4f0') => {
    glowDisc(x, y, rr * 3, tint, 0.25);
    const md = g.createRadialGradient(x - rr * 0.35, y - rr * 0.35, 0, x, y, rr); md.addColorStop(0, lighten(tint, 0.5)); md.addColorStop(1, darken(tint, 0.35)); g.fillStyle = md; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.fillStyle = alpha(darken(tint, 0.45), 0.45); for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(x + (r(k + 9) - 0.5) * rr * 1.3, y + (r(k + 10) - 0.5) * rr * 1.3, rr * 0.13 * (0.4 + r(k)), 0, TAU); g.fill(); }
  };
  const planet = (x: number, y: number, rr: number, land = true) => {
    glowDisc(x, y, rr * 1.4, '#60a5fa', 0.35);
    const pg = g.createRadialGradient(x - rr * 0.4, y - rr * 0.4, rr * 0.1, x, y, rr); pg.addColorStop(0, '#bfe4ff'); pg.addColorStop(0.45, '#2f6bb8'); pg.addColorStop(1, '#061026'); g.fillStyle = pg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    if (land) { g.save(); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.clip(); g.fillStyle = 'rgba(80,150,80,0.55)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(x + (r(k + 20) - 0.5) * rr * 1.5, y + (r(k + 21) - 0.5) * rr * 1.4, rr * 0.3, rr * 0.16, r(k) * 3, 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.4)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + (r(k + 40) - 0.5) * rr * 1.6, y + (r(k + 41) - 0.5) * rr * 1.6, rr * 0.35, rr * 0.06, r(k) * 2, 0, TAU); g.fill(); } g.restore(); }
  };
  const clouds = cloudLayer(stage, w, ground);
  // capas de edificios / siluetas
  const skyline = (base: number, color: string, scale: number, lit: number, seed: number, neon = false) => {
    let x = -s;
    while (x < w + s) {
      const bw = s * (1 + r(seed + x) * 2) * scale, bh = s * (3 + r(seed + x * 1.3) * 7) * scale;
      g.fillStyle = color; g.fillRect(x, base - bh, bw, bh + s);
      if (r(seed + x * 2.7) < 0.35) g.fillRect(x + bw * 0.2, base - bh - s * 0.8 * scale, bw * 0.5, s * 0.8 * scale);
      if (r(seed + x * 2.1) < 0.35) { g.fillRect(x + bw * 0.45, base - bh - s * 2 * scale, Math.max(1, s * 0.06), s * 2 * scale); g.fillStyle = '#ff3b3b'; g.fillRect(x + bw * 0.45 - 1, base - bh - s * 2 * scale, 3, 3); }
      if (lit > 0) for (let yy = base - bh + s * 0.35 * scale; yy < base - s * 0.2; yy += s * 0.36 * scale) for (let xx = x + s * 0.15 * scale; xx < x + bw - s * 0.15 * scale; xx += s * 0.3 * scale) if (r(xx * 3.3 + yy * 1.7) < lit) { g.fillStyle = `rgba(${r(xx) < 0.6 ? '255,200,120' : '140,200,255'},${0.3 + r(xx + yy) * 0.6})`; g.fillRect(xx, yy, s * 0.12 * scale, s * 0.16 * scale); }
      if (neon && r(seed + x * 4.1) < 0.45) { const nc = ['#f472b6', '#22d3ee', '#a78bfa', '#f87171'][Math.floor(r(seed + x) * 4)], ny = base - bh * (0.4 + r(x) * 0.4); g.fillStyle = nc; g.fillRect(x + bw * 0.25, ny, bw * 0.5, s * 0.9 * scale); g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 3; k++) g.fillRect(x + bw * 0.32, ny + s * (0.15 + k * 0.25) * scale, bw * 0.36, s * 0.08 * scale); glowDisc(x + bw / 2, ny + s * 0.45 * scale, s * 1.4 * scale, nc, 0.35); }
      x += bw + s * 0.15 * r(seed + x);
    }
  };
  const haze = (a: number, color = T.sky[2]) => { g.fillStyle = lin(g, 0, ground * 0.3, 0, ground, [[0, alpha(color, 0)], [1, alpha(color, a)]]); g.fillRect(0, 0, w, ground); };
  const truss = (x: number, top: number, wd: number, color: string) => { // torre de vigas cruzadas
    g.fillStyle = color; g.fillRect(x, top, s * 0.12, ground - top); g.fillRect(x + wd, top, s * 0.12, ground - top);
    g.strokeStyle = color; g.lineWidth = Math.max(1, s * 0.06);
    for (let y = top; y < ground; y += wd) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + wd, y + wd); g.moveTo(x + wd, y); g.lineTo(x, y + wd); g.moveTo(x, y); g.lineTo(x + wd, y); g.stroke(); }
  };
  switch (stage) {
    case 'industrial': {
      stars(220, ground * 0.6); moon(w * 0.62, ground * 0.18, s * 2.2, '#9fb4e0');
      if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.7);
      skyline(ground - s * 2.2, '#16224a', 1.1, 0.12, 1, true); haze(0.35);
      for (const [x, y] of [[0.17, 0.2], [0.58, 0.3]] as const) { const sx = w * x, sy = ground * y; g.fillStyle = '#2a3150'; g.beginPath(); g.ellipse(sx, sy, s * 1.1, s * 0.25, 0, 0, TAU); g.fill(); g.fillStyle = '#7dd3fc'; g.beginPath(); g.ellipse(sx, sy - s * 0.2, s * 0.45, s * 0.25, 0, Math.PI, TAU); g.fill(); for (let k = -2; k <= 2; k++) { g.fillStyle = '#f87171'; g.fillRect(sx + k * s * 0.4 - 1, sy - 1, 3, 3); } glowDisc(sx, sy + s * 0.3, s * 1.5, '#f43f5e', 0.25); } // platos voladores
      skyline(ground - s * 0.9, '#0c1330', 1.4, 0.08, 2, true);
      for (const x of [0.08, 0.36, 0.7, 0.93]) truss(w * x, ground - s * (6 + r(x * 9) * 2), s * 0.9, '#0a1024');
      for (const x of [0.25, 0.8]) { const tx = w * x, ty = ground - s * 7; g.fillStyle = '#0b1229'; g.fillRect(tx - s * 0.6, ty, s * 1.2, ground - ty); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(tx, ty - s * 0.3, s * 0.25, 0, TAU); g.fill(); glowDisc(tx, ty - s * 0.3, s * 1.4, '#ef4444', 0.45); }
      break;
    }
    case 'mines': {
      stars(300, ground); if (clouds) g.drawImage(clouds, 0, 0, w, ground);
      planet(w * 0.55, ground + s * 1.5, s * 6.5);
      const rockMass = (cx: number, cy: number, rr: number, seed: number, c: string) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k * TAU / 14, d = rr * (0.7 + hash(seed + k) * 0.45); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } g.closePath(); g.fill(); g.fillStyle = 'rgba(192,132,252,0.18)'; g.beginPath(); g.arc(cx - rr * 0.2, cy - rr * 0.25, rr * 0.5, 0, TAU); g.fill(); };
      for (let k = 0; k < 7; k++) rockMass(w * r(k + 30), ground * (0.15 + r(k + 31) * 0.5), s * (0.4 + r(k + 32) * 0.9), k * 13, '#2b1a3e'); // asteroides
      for (let k = 0; k < 9; k++) { rockMass(w * (k / 8), -s * 0.5, s * (2 + r(k + 50) * 1.6), k * 7, '#1b0f2b'); } // techo de la cueva
      for (const sx of [0, w]) for (let k = 0; k < 5; k++) rockMass(sx, ground * (0.2 + k * 0.2), s * (2.2 + r(k + 60) * 1.2), k * 5 + sx, '#160c24'); // paredes
      for (let k = 0; k < 10; k++) { const cx = w * r(k + 70), cy = ground * (0.1 + r(k + 71) * 0.7); g.fillStyle = ['#c084fc', '#f472b6', '#38bdf8'][k % 3]; g.beginPath(); g.moveTo(cx, cy - s * 0.3); g.lineTo(cx + s * 0.12, cy); g.lineTo(cx, cy + s * 0.2); g.lineTo(cx - s * 0.12, cy); g.fill(); glowDisc(cx, cy, s * 0.8, g.fillStyle as string, 0.35); } // cristales
      break;
    }
    case 'base': {
      // pared de paneles con una ventana grande que muestra la Tierra
      g.fillStyle = '#0c1724'; g.fillRect(0, 0, w, ground);
      const win = { x: w * 0.3, y: ground * 0.18, w: w * 0.4, h: ground * 0.48 };
      g.save(); g.beginPath(); g.roundRect(win.x, win.y, win.w, win.h, s * 0.8); g.clip();
      g.fillStyle = '#01030a'; g.fillRect(win.x, win.y, win.w, win.h); stars(160, ground);
      planet(win.x + win.w * 0.5, win.y + win.h * 0.95, win.w * 0.55);
      g.restore();
      for (let y = 0; y < ground; y += s * 1.6) for (let x = 0; x < w; x += s * 2.4) { if (x + s * 2.4 > win.x && x < win.x + win.w && y + s * 1.6 > win.y && y < win.y + win.h) continue; g.fillStyle = r(x * 3 + y) < 0.5 ? '#13243a' : '#101e31'; g.fillRect(x + 2, y + 2, s * 2.4 - 4, s * 1.6 - 4); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 2, y + 2, s * 2.4 - 4, 2); if (r(x + y * 7) < 0.12) { g.fillStyle = r(x) < 0.5 ? '#f59e0b' : '#38bdf8'; g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.35, s * 0.15); glowDisc(x + s * 0.47, y + s * 0.37, s * 0.6, g.fillStyle as string, 0.3); } }
      g.strokeStyle = '#2b3d55'; g.lineWidth = s * 0.25; g.beginPath(); g.roundRect(win.x, win.y, win.w, win.h, s * 0.8); g.stroke();
      g.strokeStyle = '#f59e0b'; g.lineWidth = Math.max(1, s * 0.05); g.beginPath(); g.roundRect(win.x - s * 0.2, win.y - s * 0.2, win.w + s * 0.4, win.h + s * 0.4, s * 0.9); g.stroke();
      for (let k = 0; k < 6; k++) { const lx = w * (0.08 + k * 0.17), ly = s * 0.4; g.fillStyle = '#e0f2fe'; g.fillRect(lx - s * 0.4, ly, s * 0.8, s * 0.12); const cone = g.createLinearGradient(0, ly, 0, ground); cone.addColorStop(0, 'rgba(186,230,253,0.18)'); cone.addColorStop(1, 'rgba(186,230,253,0)'); g.fillStyle = cone; g.beginPath(); g.moveTo(lx - s * 0.4, ly); g.lineTo(lx + s * 0.4, ly); g.lineTo(lx + s * 2.5, ground); g.lineTo(lx - s * 2.5, ground); g.fill(); }
      g.fillStyle = '#0a1320'; g.fillRect(0, 0, w, s * 0.4);
      for (const py of [0.72, 0.78]) { g.fillStyle = '#1c2c42'; g.fillRect(0, ground * py, w, s * 0.22); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, ground * py, w, 2); } // caños
      break;
    }
    case 'ice': {
      stars(150, ground * 0.5); moon(w * 0.66, ground * 0.25, s * 2.6, '#cfe0ff');
      if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.6);
      for (let layer = 0; layer < 3; layer++) { // montañas nevadas
        const base = ground - s * (0.5 + layer * 0.2), hgt = s * (9 - layer * 2.5);
        g.fillStyle = lin(g, 0, base - hgt, 0, base, [[0, ['#eaf4ff', '#cfe3fb', '#a9c8ee'][layer]], [0.35, ['#9cbbe2', '#7aa3d6', '#5b86c0'][layer]], [1, ['#3b5f93', '#2c4f84', '#1f3f73'][layer]]]);
        g.beginPath(); g.moveTo(0, base + s);
        for (let x = 0; x <= w + s; x += s * 0.8) { const n = fbm(x / s * 0.12 + layer * 7, layer, 3 + layer, 4); g.lineTo(x, base - hgt * (0.35 + n * 0.75) * (0.75 + 0.25 * Math.sin(x / w * 7 + layer))); }
        g.lineTo(w, base + s); g.fill();
      }
      for (let k = 0; k < 8; k++) { const ix = w * r(k + 30), ih = s * (2 + r(k + 32) * 3); g.fillStyle = lin(g, ix, ground - ih, ix + s, ground, [[0, '#f0f9ff'], [0.5, '#7fb2df'], [1, '#2a5486']]); g.beginPath(); g.moveTo(ix - s * 0.6, ground); g.lineTo(ix, ground - ih); g.lineTo(ix + s * 0.6, ground); g.fill(); }
      g.fillStyle = 'rgba(225,240,255,0.9)'; for (let x = 0; x < w; x += s * 0.6) { const l = s * (0.3 + r(x) * 1.1); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s * 0.12, l); g.lineTo(x + s * 0.24, 0); g.fill(); } // carámbanos arriba
      break;
    }
    case 'volcano': {
      if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.8);
      const vx = w * 0.5, vy = ground - s * 8.5, vw = s * 9;
      glowDisc(vx, vy, s * 6, '#ff7a1a', 0.5);
      const slope = (x: number) => { const d = Math.abs(x - vx) / vw; return d < 0.12 ? vy + s * 0.3 * Math.sin(x / s * 3) : vy + (ground - vy) * Math.pow((d - 0.12) / 0.88, 0.7) - s * 0.5 * (fbm(x / s * 0.5, 2, 5, 3) - 0.5) * 2; };
      g.fillStyle = lin(g, vx, vy, vx, ground, [[0, '#3a0f06'], [0.4, '#220803'], [1, '#110302']]); g.beginPath(); g.moveTo(vx - vw, ground + s); for (let x = vx - vw; x <= vx + vw; x += s * 0.25) g.lineTo(x, Math.min(ground, slope(x))); g.lineTo(vx + vw, ground + s); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, s * 0.05); for (let k = 0; k < 14; k++) { const x0 = vx + (r(k + 80) - 0.5) * vw * 1.6, y0 = slope(x0); if (y0 >= ground) continue; g.beginPath(); g.moveTo(x0, y0 + s * 0.3); g.lineTo(x0 + (x0 > vx ? 1 : -1) * s * 1.2, y0 + s * 2.2); g.stroke(); }
      g.strokeStyle = 'rgba(255,120,30,0.85)'; g.lineWidth = Math.max(1.5, s * 0.12); for (const d of [-1, 1, 0.3]) { g.beginPath(); g.moveTo(vx + d * s * 0.3, vy); g.quadraticCurveTo(vx + d * vw * 0.18, vy + s * 3, vx + d * vw * 0.42, ground - s); g.stroke(); }
      for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(255,${120 + r(k) * 100},40,0.9)`; g.beginPath(); g.arc(vx + (r(k + 1) - 0.5) * s * 4, vy - r(k + 2) * s * 4, s * 0.1, 0, TAU); g.fill(); } // erupción
      for (const sx of [0.12, 0.85]) { const rx = w * sx, rh = s * 7; g.fillStyle = '#170503'; g.beginPath(); g.moveTo(rx - s * 3, ground); g.lineTo(rx - s * 1.2, ground - rh); g.lineTo(rx + s * 0.5, ground - rh * 0.8); g.lineTo(rx + s * 2.6, ground); g.fill(); g.fillStyle = lin(g, rx, ground - rh * 0.8, rx, ground, [[0, '#fff3b0'], [0.3, '#ff8a1a'], [1, '#c2260c']]); g.fillRect(rx - s * 0.2, ground - rh * 0.8, s * 0.4, rh * 0.8); glowDisc(rx, ground - rh * 0.4, s * 2.5, '#ff6a1a', 0.35); } // cascadas de lava
      haze(0.35, '#ff5a1a');
      break;
    }
    case 'forest': {
      stars(120, ground * 0.4); if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.6);
      for (let k = 0; k < 14; k++) { const tx = w * r(k + 5), tw = s * (0.6 + r(k + 6) * 1.2); g.fillStyle = k % 2 ? '#05121f' : '#081a2c'; g.fillRect(tx, 0, tw, ground); g.fillStyle = 'rgba(103,232,249,0.06)'; g.fillRect(tx, 0, tw * 0.2, ground); } // troncos
      const shroom = (x: number, base: number, hgt: number, capW: number, color: string) => {
        g.fillStyle = lin(g, x - s * 0.4, 0, x + s * 0.4, 0, [[0, '#b9e6ff'], [1, '#5aa4d6']]); g.beginPath(); g.moveTo(x - capW * 0.08, base); g.quadraticCurveTo(x - capW * 0.12, base - hgt * 0.5, x - capW * 0.06, base - hgt); g.lineTo(x + capW * 0.06, base - hgt); g.quadraticCurveTo(x + capW * 0.12, base - hgt * 0.5, x + capW * 0.08, base); g.fill();
        glowDisc(x, base - hgt, capW * 0.9, color, 0.35);
        g.fillStyle = lin(g, 0, base - hgt - capW * 0.35, 0, base - hgt, [[0, lighten(color, 0.4)], [1, darken(color, 0.3)]]); g.beginPath(); g.ellipse(x, base - hgt, capW / 2, capW * 0.32, 0, Math.PI, TAU); g.fill();
        g.strokeStyle = alpha(darken(color, 0.5), 0.8); g.lineWidth = 1; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * capW * 0.1, base - hgt); g.lineTo(x + k * capW * 0.03, base - hgt + capW * 0.06); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (r(k + x) - 0.5) * capW * 0.7, base - hgt - r(k + x + 1) * capW * 0.25, s * 0.07, 0, TAU); g.fill(); }
      };
      shroom(w * 0.12, ground, s * 4.5, s * 4, '#38bdf8'); shroom(w * 0.38, ground, s * 6.5, s * 6, '#818cf8'); shroom(w * 0.86, ground, s * 5, s * 4.5, '#a78bfa'); shroom(w * 0.68, ground, s * 3, s * 2.6, '#22d3ee');
      for (let k = 0; k < 24; k++) { const px = w * r(k + 90), ph = s * (0.4 + r(k + 91) * 0.9); g.fillStyle = ['#f472b6', '#c084fc', '#22d3ee'][k % 3]; g.beginPath(); g.moveTo(px, ground); g.quadraticCurveTo(px - s * 0.3, ground - ph, px - s * 0.05, ground - ph * 1.1); g.quadraticCurveTo(px + s * 0.1, ground - ph * 0.5, px + s * 0.1, ground); g.fill(); } // plantas que brillan
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(190,255,200,${0.4 + r(k) * 0.5})`; g.beginPath(); g.arc(w * r(k + 120), ground * (0.2 + r(k + 121) * 0.7), 1.5, 0, TAU); g.fill(); } // luciérnagas
      haze(0.3, '#0e7490');
      break;
    }
    case 'factory': {
      g.fillStyle = '#100e0c'; g.fillRect(0, 0, w, ground);
      for (let y = 0; y < ground; y += s * 1.4) for (let x = (y / s) % 2 ? -s : 0; x < w; x += s * 2.2) { g.fillStyle = r(x + y * 3) < 0.5 ? '#1d1a17' : '#191613'; g.fillRect(x + 2, y + 2, s * 2.2 - 4, s * 1.4 - 4); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(x + 2, y + 2, s * 2.2 - 4, 2); }
      for (const x of [0.2, 0.52, 0.82]) { const wx = w * x, wy = ground * 0.2; g.fillStyle = '#2a1608'; g.fillRect(wx - s * 1.2, wy, s * 2.4, s * 1.6); g.fillStyle = lin(g, 0, wy, 0, wy + s * 1.6, [[0, '#f59e0b'], [1, '#b45309']]); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRect(wx - s * 1.1 + i * s * 0.78, wy + s * 0.1 + j * s * 0.75, s * 0.68, s * 0.65); glowDisc(wx, wy + s * 0.8, s * 3, '#f59e0b', 0.25); } // ventanas
      const robotArm = (bx: number, flip: number) => { const by = ground; g.save(); g.translate(bx, by); g.scale(flip, 1); g.lineCap = 'round'; for (const [c, wd] of [['#3b2a0a', s * 0.55], ['#e0a812', s * 0.42]] as const) { g.strokeStyle = c; g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.4, -s * 2.6); g.lineTo(s * 2.2, -s * 3.6); g.lineTo(s * 2.8, -s * 2.6); g.stroke(); } g.fillStyle = '#222'; for (const [jx, jy] of [[s * 0.4, -s * 2.6], [s * 2.2, -s * 3.6]]) { g.beginPath(); g.arc(jx, jy, s * 0.28, 0, TAU); g.fill(); } g.fillStyle = '#1a1a1a'; g.fillRect(-s * 0.6, -s * 0.4, s * 1.2, s * 0.4); g.restore(); };
      robotArm(w * 0.14, 1); robotArm(w * 0.5, -1); robotArm(w * 0.74, 1);
      const gear = (cx: number, cy: number, rr: number) => { g.fillStyle = '#2b2620'; g.beginPath(); for (let k = 0; k < 24; k++) { const a = k * TAU / 24, d = k % 2 ? rr : rr * 1.15; g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } g.fill(); g.fillStyle = '#100e0c'; g.beginPath(); g.arc(cx, cy, rr * 0.35, 0, TAU); g.fill(); };
      gear(w * 0.36, ground * 0.45, s * 1.6); gear(w * 0.95, ground * 0.3, s * 2.2); gear(w * 0.03, ground * 0.6, s * 1.4);
      for (const py of [0.08, 0.6]) { g.fillStyle = '#2a241d'; g.fillRect(0, ground * py, w, s * 0.3); for (let x = 0; x < w; x += s * 3) { g.fillStyle = '#3a3128'; g.fillRect(x, ground * py - s * 0.05, s * 0.2, s * 0.4); } } // caños
      break;
    }
    case 'storm': {
      if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.8);
      const boltBg = (x: number) => { g.strokeStyle = 'rgba(165,180,252,0.6)'; g.lineWidth = Math.max(1.5, s * 0.08); g.beginPath(); let px = x, py = 0; g.moveTo(px, py); while (py < ground * 0.8) { px += (r(px + py) - 0.5) * s * 1.5; py += s * 0.8; g.lineTo(px, py); } g.stroke(); glowDisc(x, ground * 0.3, s * 4, '#a5b4fc', 0.15); };
      boltBg(w * 0.12); boltBg(w * 0.62); boltBg(w * 0.86);
      for (let k = 0; k < 7; k++) { const tx = w * (0.04 + k * 0.155), tw = s * (1.4 + r(k) * 1), th = s * (6 + r(k + 3) * 5); g.fillStyle = '#0b0f1e'; g.fillRect(tx, ground - th, tw, th); g.beginPath(); g.moveTo(tx - s * 0.2, ground - th); g.lineTo(tx + tw / 2, ground - th - s * 1.8); g.lineTo(tx + tw + s * 0.2, ground - th); g.fill(); for (let j = 0; j < 4; j++) if (r(k * 4 + j) < 0.5) { g.fillStyle = '#fbbf24'; g.fillRect(tx + tw * 0.4, ground - th + s * (1 + j * 1.3), s * 0.25, s * 0.4); } } // torres
      haze(0.35, '#3b4a7a');
      break;
    }
    case 'temple': {
      if (clouds) g.drawImage(clouds, 0, 0, w, ground * 0.5);
      for (let layer = 0; layer < 3; layer++) { // follaje
        g.fillStyle = ['#0f3b25', '#0b2e1d', '#082316'][layer];
        for (let k = 0; k < 26; k++) { const cx = w * r(k + layer * 40), cy = ground * (0.05 + layer * 0.15) + r(k + 3) * s * 2; g.beginPath(); g.arc(cx, cy, s * (1.5 + r(k + 7) * 2), 0, TAU); g.fill(); }
      }
      for (const x of [0.36, 0.68]) { const fx = w * x; g.fillStyle = lin(g, fx, 0, fx + s * 1.5, 0, [[0, 'rgba(186,230,253,0.5)'], [0.5, 'rgba(240,249,255,0.85)'], [1, 'rgba(125,211,252,0.5)']]); g.fillRect(fx, ground * 0.15, s * 1.5, ground * 0.85); glowDisc(fx + s * 0.75, ground, s * 2.5, '#bae6fd', 0.35); } // cascadas
      for (let k = 0; k < 5; k++) { const bx = w * (0.05 + k * 0.23); g.fillStyle = '#1d2b20'; g.fillRect(bx, ground - s * 5, s * 2.6, s * 5); for (let j = 0; j < 7; j++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx, ground - s * (5 - j * 0.72), s * 2.6, 2); } } // muros
      const head = (cx: number, base: number, sz: number) => { shade(g, () => g.roundRect(cx - sz * 0.5, base - sz * 1.2, sz, sz * 1.2, sz * 0.15), '#6b6a50', { x: cx - sz * 0.2, y: base - sz, r: sz * 1.2, tex: 0.6, lw: 0 }); g.fillStyle = '#2a2a1e'; g.fillRect(cx - sz * 0.35, base - sz * 0.85, sz * 0.25, sz * 0.12); g.fillRect(cx + sz * 0.1, base - sz * 0.85, sz * 0.25, sz * 0.12); g.fillRect(cx - sz * 0.25, base - sz * 0.4, sz * 0.5, sz * 0.1); g.fillStyle = '#7dd3fc'; g.fillRect(cx - sz * 0.27, base - sz * 0.82, sz * 0.08, sz * 0.06); g.fillRect(cx + sz * 0.18, base - sz * 0.82, sz * 0.08, sz * 0.06); }; // cabezas de piedra
      head(w * 0.08, ground, s * 2.6); head(w * 0.55, ground - s * 0.5, s * 3); head(w * 0.92, ground, s * 2.4);
      for (let k = 0; k < 30; k++) { g.strokeStyle = '#1f5130'; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); const vx = w * r(k + 200); g.moveTo(vx, 0); g.quadraticCurveTo(vx + s * 0.4, s * (1 + r(k) * 2), vx, s * (2 + r(k + 1) * 4)); g.stroke(); } // lianas
      haze(0.25, '#3f8f5f');
      break;
    }
    case 'moon': {
      stars(400, ground); planet(w * 0.66, ground * 0.32, s * 3.6); moon(w * 0.2, ground * 0.2, s * 1.3, '#d4d4d8');
      for (let layer = 0; layer < 2; layer++) { const base = ground - s * (0.6 - layer * 0.3); g.fillStyle = ['#3f4250', '#2c2f3a'][layer]; g.beginPath(); g.moveTo(0, ground + s); for (let x = 0; x <= w + s; x += s * 0.6) g.lineTo(x, base - s * (1.2 + layer) * (0.4 + fbm(x / s * 0.15, layer, 9, 3))); g.lineTo(w, ground + s); g.fill(); }
      for (let k = 0; k < 10; k++) { const cx = w * r(k + 7), cy = ground - s * (0.6 + r(k + 8) * 1.2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy, s * (0.4 + r(k) * 0.6), s * 0.15, 0, 0, TAU); g.fill(); }
      const dome = (cx: number, rr: number) => { g.fillStyle = '#4b5563'; g.fillRect(cx - rr, ground - s * 1.4, rr * 2, s * 0.5); const dg = g.createRadialGradient(cx - rr * 0.3, ground - s * 1.4 - rr * 0.6, 0, cx, ground - s * 1.4, rr); dg.addColorStop(0, 'rgba(186,230,253,0.9)'); dg.addColorStop(1, 'rgba(37,99,235,0.6)'); g.fillStyle = dg; g.beginPath(); g.arc(cx, ground - s * 1.4, rr, Math.PI, TAU); g.fill(); g.strokeStyle = '#94a3b8'; g.lineWidth = 1; g.stroke(); };
      dome(w * 0.12, s * 1.2); dome(w * 0.86, s * 1.6);
      for (const x of [0.32, 0.55]) { const tx = w * x; g.fillStyle = '#6b7280'; g.fillRect(tx - s * 0.6, ground - s * 4, s * 1.2, s * 3); g.fillStyle = '#38bdf8'; g.fillRect(tx - s * 0.3, ground - s * 3.4, s * 0.6, s * 0.8); g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(tx, ground - s * 4, s * 0.6, Math.PI, TAU); g.fill(); }
      break;
    }
  }
}

// El piso, visto en corte: baldosas, ladrillos, roca, hielo… y su borde de arriba.
function paintFloor(g: CanvasRenderingContext2D, stage: StageId, v: View) {
  const T = THEMES[stage], s = v.s, gy = Y(v, 0), w = v.w, hh = v.h - gy;
  const r = (n: number) => hash(n * 2.13 + stage.length * 3.7);
  const bricks = (bw: number, bh: number, c1: string, c2: string, mortar: string) => {
    g.fillStyle = mortar; g.fillRect(0, gy, w, hh);
    for (let y = gy, row = 0; y < v.h; y += bh, row++) for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) { g.fillStyle = r(x * 1.7 + y) < 0.5 ? c1 : c2; g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 1.5, y + 1.5, bw - 3, 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 1.5, y + bh - 3.5, bw - 3, 2); }
  };
  switch (T.floor) {
    case 'metal': bricks(s * 1.6, s * 0.7, '#1b2236', '#202940', '#0a0d16'); g.save(); hazardStripes(g, 0, gy, w, s * 0.22, s * 0.5); g.restore(); for (let x = s; x < w; x += s * 3) { g.fillStyle = '#f59e0b'; g.fillRect(x, gy + s * 0.6, s * 0.3, s * 0.15); } break;
    case 'rock': bricks(s * 1.3, s * 0.6, '#2a1f3a', '#241a33', '#120b1c'); for (let k = 0; k < 20; k++) { g.fillStyle = ['#c084fc', '#f472b6'][k % 2]; g.fillRect(w * r(k), gy + hh * r(k + 1), 2, 2); } break;
    case 'panel': bricks(s * 2.2, s * 0.8, '#18273c', '#1c2d45', '#091321'); for (let x = s; x < w; x += s * 2.2) { g.fillStyle = '#38bdf8'; g.fillRect(x, gy + s * 0.12, s * 0.4, s * 0.06); } break;
    case 'ice': bricks(s * 1.4, s * 0.7, '#2f5f9a', '#3a6eac', '#173763'); g.fillStyle = '#f0f9ff'; for (let x = 0; x < w; x += s * 0.5) { g.beginPath(); g.ellipse(x, gy, s * 0.4, s * (0.08 + r(x) * 0.07), 0, 0, TAU); g.fill(); } g.fillStyle = 'rgba(224,242,254,0.9)'; for (let x = 0; x < w; x += s * 0.35) { const l = s * (0.1 + r(x + 1) * 0.3); g.beginPath(); g.moveTo(x, gy); g.lineTo(x + s * 0.07, gy + l); g.lineTo(x + s * 0.14, gy); g.fill(); } break;
    case 'lava': bricks(s * 1.5, s * 0.7, '#2a0d07', '#331109', '#120402'); g.strokeStyle = 'rgba(255,120,30,0.7)'; g.lineWidth = Math.max(1, s * 0.05); for (let k = 0; k < 16; k++) { const x = w * r(k); g.beginPath(); g.moveTo(x, gy); g.lineTo(x + s * 0.3, gy + s * 0.4); g.lineTo(x + s * 0.1, gy + s * 0.9); g.stroke(); } break;
    case 'moss': bricks(s * 1.5, s * 0.7, '#14262c', '#182e35', '#071116'); g.fillStyle = '#3f8f2e'; g.fillRect(0, gy - s * 0.05, w, s * 0.14); for (let x = 0; x < w; x += s * 0.12) { const l = s * (0.08 + r(x) * 0.18); g.fillStyle = r(x + 2) < 0.08 ? '#f0abfc' : '#65a30d'; g.fillRect(x, gy - l, Math.max(1, s * 0.03), l); } break;
    case 'grate': bricks(s * 1.8, s * 0.8, '#1f1d1b', '#24211e', '#0b0a09'); hazardStripes(g, 0, gy, w, s * 0.18, s * 0.5); break;
    case 'stone': bricks(s * 1.4, s * 0.65, '#1a1f2e', '#1e2435', '#0a0c14'); g.fillStyle = 'rgba(165,180,252,0.25)'; g.fillRect(0, gy, w, 2); break;
    case 'jungle': bricks(s * 1.5, s * 0.7, '#3d3a2a', '#45412f', '#1b1a12'); g.fillStyle = '#2f6b25'; g.fillRect(0, gy - s * 0.04, w, s * 0.12); for (let x = 0; x < w; x += s * 0.15) { const l = s * (0.1 + r(x) * 0.2); g.fillStyle = '#4d8a2a'; g.fillRect(x, gy - l, Math.max(1, s * 0.03), l); } break;
    case 'moon': g.fillStyle = lin(g, 0, gy, 0, v.h, [[0, '#8b8f9c'], [1, '#3b3e48']]); g.fillRect(0, gy, w, hh); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(w * r(k), gy + hh * r(k + 1), s * (0.1 + r(k + 2) * 0.4), s * 0.06, 0, 0, TAU); g.fill(); } break;
  }
  g.save(); grain(g, () => g.rect(0, gy, w, hh), 0.35, s / 20); g.restore();
  g.fillStyle = alpha(T.edge, 0.5); g.fillRect(0, gy, w, Math.max(1, s * 0.03));
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, gy, w, Math.max(1, s * 0.12) * 0.4);
}

// Bloques (desniveles) y plataformas flotantes, cada escenario con su material y sus soportes.
function paintSolid(g: CanvasRenderingContext2D, stage: StageId, sd: Solid, v: View) {
  const T = THEMES[stage], s = v.s, x = X(v, sd.x), y = Y(v, sd.y + sd.h), w = sd.w * s, hh = sd.h * s, gy = Y(v, 0);
  if (sd.kind === 'bouncy') { // hongo que rebota
    g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#9fd8ff'], [1, '#4a8fc4']]); g.fillRect(x + w * 0.35, y + hh * 0.3, w * 0.3, gy - y - hh * 0.3);
    const cg = g.createRadialGradient(x + w / 2, y + hh * 0.2, 0, x + w / 2, y + hh * 0.4, w * 0.7); cg.addColorStop(0, '#f5d0fe'); cg.addColorStop(0.5, '#c026d3'); cg.addColorStop(1, '#4a044e');
    g.fillStyle = cg; g.beginPath(); g.ellipse(x + w / 2, y + hh * 0.55, w * 0.62, hh * 0.75, 0, Math.PI, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + w * (0.2 + k * 0.15), y + hh * (0.2 + (k % 2) * 0.15), s * 0.07, 0, TAU); g.fill(); }
    const gl = g.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, w); gl.addColorStop(0, 'rgba(232,121,249,0.35)'); gl.addColorStop(1, 'rgba(232,121,249,0)'); g.fillStyle = gl; g.fillRect(x - w / 2, y - w, w * 2, w * 2);
    return;
  }
  // soportes de las plataformas flotantes
  if (sd.kind === 'float') {
    if (T.support === 'truss') { for (const px of [x + w * 0.2, x + w * 0.8 - s * 0.5]) { g.strokeStyle = '#1b2232'; g.lineWidth = Math.max(1, s * 0.07); g.strokeRect(px, y + hh, s * 0.5, gy - y - hh); for (let yy = y + hh; yy < gy; yy += s * 0.5) { g.beginPath(); g.moveTo(px, yy); g.lineTo(px + s * 0.5, yy + s * 0.5); g.moveTo(px + s * 0.5, yy); g.lineTo(px, yy + s * 0.5); g.stroke(); } } }
    if (T.support === 'chains') for (const px of [x + w * 0.15, x + w * 0.85]) { g.strokeStyle = '#2b2f3a'; g.lineWidth = Math.max(1, s * 0.05); for (let yy = 0; yy < y; yy += s * 0.22) { g.beginPath(); g.ellipse(px, yy, s * 0.06, s * 0.12, 0, 0, TAU); g.stroke(); } }
    if (T.support === 'vines') for (let k = 0; k < 4; k++) { const px = x + w * (0.15 + k * 0.23); g.strokeStyle = '#2f6b25'; g.lineWidth = Math.max(1, s * 0.05); g.beginPath(); g.moveTo(px, y + hh); g.quadraticCurveTo(px + s * 0.2, y + hh + s * 0.5, px, y + hh + s * (0.6 + hash(k + sd.id) * 0.8)); g.stroke(); }
  }
  g.save(); g.translate(v.ox, v.oy); g.scale(s, s); // a metros (y para abajo)
  const mx = sd.x, my = -(sd.y + sd.h), mw = sd.w, mh = sd.h;
  switch (T.floor) {
    case 'metal': case 'grate': case 'panel': case 'rock':
      plate(g, mx, my, mw, mh, T.floor === 'panel' ? '#2a3b55' : T.floor === 'rock' ? '#3a2d52' : '#2b3446', { rust: T.floor === 'grate' ? 0.6 : 0.2 });
      if (T.floor !== 'panel') hazardStripes(g, mx, my, mw, Math.min(0.16, mh * 0.4), 0.3);
      else { g.fillStyle = '#38bdf8'; g.fillRect(mx + 0.1, my + mh - 0.1, mw - 0.2, 0.03); }
      break;
    case 'ice': {
      g.fillStyle = lin(g, mx, my, mx + mw, my + mh, [[0, '#e0f2fe'], [0.4, '#7fb6e6'], [1, '#2f5f9a']]); g.fillRect(mx, my, mw, mh);
      g.strokeStyle = 'rgba(15,60,110,0.7)'; g.lineWidth = 0.02; for (let yy = my + 0.3; yy < my + mh; yy += 0.3) { g.beginPath(); g.moveTo(mx, yy); g.lineTo(mx + mw, yy); g.stroke(); }
      g.fillStyle = '#f8fbff'; g.beginPath(); g.ellipse(mx + mw / 2, my, mw * 0.55, 0.1, 0, Math.PI, TAU); g.fill();
      g.fillStyle = 'rgba(224,242,254,0.95)'; for (let k = 0; k < mw * 4; k++) { const ix = mx + (k + 0.5) / 4, il = 0.1 + hash(k + sd.id) * 0.25; g.beginPath(); g.moveTo(ix - 0.05, my + mh); g.lineTo(ix, my + mh + il); g.lineTo(ix + 0.05, my + mh); g.fill(); }
      break;
    }
    case 'lava': plate(g, mx, my, mw, mh, '#3a1a12', { rust: 0.8 }); g.strokeStyle = 'rgba(255,120,30,0.8)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(mx + 0.2, my + 0.05); g.lineTo(mx + 0.5, my + mh * 0.6); g.lineTo(mx + 0.4, my + mh); g.stroke(); hazardStripes(g, mx, my, mw, 0.12, 0.3); break;
    case 'moss': case 'jungle': case 'stone': {
      const c1 = T.floor === 'stone' ? '#2a3044' : T.floor === 'moss' ? '#203740' : '#5a5540';
      g.fillStyle = darken(c1, 0.5); g.fillRect(mx, my, mw, mh);
      for (let yy = my, row = 0; yy < my + mh - 0.01; yy += 0.32, row++) for (let xx = mx + (row % 2 ? -0.25 : 0); xx < mx + mw; xx += 0.5) { const x0 = Math.max(mx, xx), x1 = Math.min(mx + mw, xx + 0.5); if (x1 <= x0) continue; g.fillStyle = hash(xx * 3 + yy) < 0.5 ? c1 : lighten(c1, 0.08); g.fillRect(x0 + 0.02, yy + 0.02, x1 - x0 - 0.04, Math.min(0.28, my + mh - yy - 0.04)); }
      if (T.floor !== 'stone') { g.fillStyle = T.floor === 'moss' ? '#4d9a2f' : '#3f7d2a'; g.fillRect(mx - 0.03, my - 0.04, mw + 0.06, 0.09); for (let k = 0; k < mw * 6; k++) { g.fillRect(mx + k / 6, my + 0.04, 0.03, 0.05 + hash(k + sd.id) * 0.18); } }
      else { g.fillStyle = 'rgba(165,180,252,0.35)'; g.fillRect(mx, my, mw, 0.025); for (let k = 0; k < mw * 3; k++) { g.fillStyle = '#1a1f2e'; g.beginPath(); g.moveTo(mx + k / 3, my + mh); g.lineTo(mx + k / 3 + 0.08, my + mh + 0.15 + hash(k + sd.id) * 0.3); g.lineTo(mx + k / 3 + 0.16, my + mh); g.fill(); } }
      break;
    }
    case 'moon': g.fillStyle = lin(g, mx, my, mx, my + mh, [[0, '#b8bcc6'], [1, '#6b7080']]); g.fillRect(mx, my, mw, mh); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.02; g.strokeRect(mx, my, mw, mh); for (let k = 0; k < mw * 2; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(mx + 0.25 + k * 0.5, my + mh * (0.3 + hash(k) * 0.4), 0.05, 0, TAU); g.fill(); } break;
  }
  g.restore();
}

// El tubo del medio por donde bajan las pelotas.
function paintTube(g: CanvasRenderingContext2D, v: View) {
  const s = v.s, cx = X(v, W / 2), mouth = Y(v, TUBE_Y), r = s * 0.55;
  g.fillStyle = lin(g, cx - r, 0, cx + r, 0, [[0, '#2b3240'], [0.3, '#9aa6b8'], [0.55, '#5b6578'], [1, '#1b2130']]); g.fillRect(cx - r, 0, r * 2, mouth);
  for (let y = s * 0.8; y < mouth - s * 0.3; y += s * 1.4) { g.fillStyle = lin(g, cx - r * 1.2, 0, cx + r * 1.2, 0, [[0, '#1f2633'], [0.35, '#c3ccda'], [1, '#141a26']]); g.fillRect(cx - r * 1.2, y, r * 2.4, s * 0.25); }
  g.fillStyle = lin(g, cx - r * 1.35, 0, cx + r * 1.35, 0, [[0, '#1f2633'], [0.35, '#d5dce8'], [1, '#141a26']]); g.fillRect(cx - r * 1.35, mouth - s * 0.35, r * 2.7, s * 0.35);
  g.fillStyle = '#05070b'; g.beginPath(); g.ellipse(cx, mouth, r * 1.1, s * 0.14, 0, 0, TAU); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(cx, mouth, 0, cx, mouth, s * 1.4); gl.addColorStop(0, 'rgba(56,189,248,0.45)'); gl.addColorStop(1, 'rgba(56,189,248,0)'); g.fillStyle = gl; g.fillRect(cx - s * 1.4, mouth - s * 1.4, s * 2.8, s * 2.8); g.restore();
  g.fillStyle = '#38bdf8'; for (const k of [-1, 1]) g.fillRect(cx + k * r * 0.9 - 1.5, mouth - s * 0.3, 3, s * 0.2);
}

// ---------------------------------------------------------------- Arcos
function drawGoal(ctx: CanvasRenderingContext2D, m: Match, v: View, left: boolean, front: boolean) {
  const side = teamAt(m, left), s = v.s, gh = goalHeight(m, side), x0 = left ? 0 : W - GOAL_DEPTH, x1 = left ? GOAL_DEPTH : W;
  const fx = left ? x1 : x0, bx = left ? x0 : x1;
  const L = LOOKS[m.fighters[side].char];
  if (!front) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X(v, Math.min(x0, x1)), Y(v, gh), GOAL_DEPTH * s, gh * s);
    ctx.save(); ctx.beginPath(); ctx.rect(X(v, Math.min(x0, x1)), Y(v, gh), GOAL_DEPTH * s, gh * s); ctx.clip();
    ctx.strokeStyle = 'rgba(230,240,255,0.45)'; ctx.lineWidth = Math.max(1, s * 0.025);
    const sway = Math.sin(m.time * 2 + side) * 0.03;
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 0.01; x += 0.25) { ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, gh)); ctx.quadraticCurveTo(X(v, x + sway * 4), Y(v, gh / 2), X(v, x), Y(v, 0)); ctx.stroke(); }
    for (let y = 0; y <= gh; y += 0.25) { ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, y)); ctx.quadraticCurveTo(X(v, (x0 + x1) / 2), Y(v, y - 0.06), X(v, x1), Y(v, y)); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#9aa3b0'; ctx.fillRect(X(v, bx) - s * 0.05, Y(v, gh), s * 0.1, gh * s);
    return;
  }
  const post = (x: number, y0: number, y1: number, wd: number, horiz: boolean) => {
    ctx.beginPath(); if (horiz) ctx.rect(X(v, Math.min(x0, x1)), Y(v, y1), GOAL_DEPTH * s, (y1 - y0) * s); else ctx.rect(X(v, x) - wd * s / 2, Y(v, y1), wd * s, (y1 - y0) * s);
    ctx.fillStyle = horiz ? lin(ctx, 0, Y(v, y1), 0, Y(v, y0), [[0, '#ffffff'], [0.4, '#c7ced8'], [1, '#5b6472']]) : lin(ctx, X(v, x) - wd * s / 2, 0, X(v, x) + wd * s / 2, 0, [[0, '#5b6472'], [0.35, '#ffffff'], [0.6, '#c7ced8'], [1, '#3b4250']]);
    ctx.fill(); ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1; ctx.stroke();
  };
  post(fx, 0, gh + BAR, 0.16, false);
  post(0, gh, gh + BAR, 0, true);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(L.glow, 0.35 + 0.15 * Math.sin(m.time * 3)); ctx.fillRect(X(v, fx) - s * 0.03, Y(v, gh), s * 0.06, gh * s);
  bloom(ctx, X(v, fx), Y(v, gh), s * 0.8, L.glow, 0.35);
  ctx.restore();
  if ((m.fighters[side === 0 ? 1 : 0].powers.giant ?? 0) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(249,115,22,${0.5 + 0.4 * Math.sin(m.time * 10)})`; ctx.lineWidth = s * 0.06; ctx.strokeRect(X(v, Math.min(x0, x1)), Y(v, gh), GOAL_DEPTH * s, gh * s); ctx.restore(); }
}

// ---------------------------------------------------------------- Pelota
export function drawBallSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, kind: Ball['kind'], fx: Ball['fx'], t: number) {
  const color = kind === 'normal' ? null : BALLS[kind].color;
  const glowC = fx === 'fire' ? '#fb923c' : fx === 'ice' ? '#bae6fd' : fx === 'toxic' ? '#4ade80' : fx === 'volt' ? '#fde047' : color;
  if (glowC) bloom(ctx, x, y, r * 3.2, glowC, 0.55);
  if (kind === 'spike') for (let k = 0; k < 10; k++) { const a = spin + k * TAU / 10, ca = Math.cos(a), sa = Math.sin(a); ctx.beginPath(); ctx.moveTo(x + ca * r * 0.8 - sa * r * 0.2, y + sa * r * 0.8 + ca * r * 0.2); ctx.lineTo(x + ca * r * 1.5, y + sa * r * 1.5); ctx.lineTo(x + ca * r * 0.8 + sa * r * 0.2, y + sa * r * 0.8 - ca * r * 0.2); ctx.closePath(); ctx.fillStyle = lin(ctx, x, y - r, x, y + r, [[0, '#f1f5f9'], [1, '#475569']]); ctx.fill(); }
  const base = kind === 'normal' ? '#f8fafc' : kind === 'spike' ? '#3f444d' : lighten(color!, 0.25);
  const patch = kind === 'normal' ? '#111' : kind === 'spike' ? '#15171b' : darken(color!, 0.55);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = base; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = patch;
  const pent = (cx: number, cy: number, pr: number, rot: number) => { ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = rot + k * TAU / 5; ctx.lineTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr); } ctx.closePath(); ctx.fill(); };
  pent(x + Math.cos(spin) * r * 0.1, y + Math.sin(spin) * r * 0.1, r * 0.33, spin);
  for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5 + Math.PI / 5; pent(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.3, spin + Math.PI / 5); }
  ctx.strokeStyle = alpha(patch, 0.6); ctx.lineWidth = Math.max(0.5, r * 0.04);
  for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.33, y + Math.sin(a) * r * 0.33); ctx.lineTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); ctx.stroke(); }
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05); g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (kind === 'ice' || fx === 'ice') { ctx.fillStyle = 'rgba(200,235,255,0.45)'; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  if (kind === 'void') { ctx.fillStyle = `rgba(30,0,60,${0.25 + 0.15 * Math.sin(t * 5)})`; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
  spec(ctx, x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.16, -0.6, 0.85);
  if (fx === 'fire' || kind === 'fire') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.35, l = r * (1.3 + 0.4 * Math.sin(t * 25 + k)); ctx.fillStyle = k % 2 ? 'rgba(253,224,71,0.6)' : 'rgba(249,115,22,0.6)'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.25) * r * 0.8, y + Math.sin(a - 0.25) * r * 0.8); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a + 0.25) * r * 0.8, y + Math.sin(a + 0.25) * r * 0.8); ctx.fill(); } ctx.restore(); }
  if (fx === 'volt' || kind === 'void') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = fx === 'volt' ? '#fef08a' : '#d8b4fe'; ctx.lineWidth = Math.max(1, r * 0.06); for (let k = 0; k < 3; k++) { let a = Math.random() * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 3; j++) { a += (Math.random() - 0.5); px += Math.cos(a) * r * 0.5; py += Math.sin(a) * r * 0.5; ctx.lineTo(px, py); } ctx.stroke(); } ctx.restore(); }
}
function drawBall(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const b = m.ball, s = v.s, fat = m.fatal && !m.fatal.done ? m.fatal : null;
  if (!b.alive) return;
  const tc = fat ? CHARS[fat.char].glow : b.fx === 'fire' || b.kind === 'fire' ? '#fb923c' : b.fx === 'ice' || b.kind === 'ice' ? '#7dd3fc' : b.fx === 'toxic' || b.kind === 'toxic' ? '#4ade80' : b.fx === 'volt' ? '#fde047' : b.kind === 'void' ? '#a855f7' : '#60a5fa';
  const speed = Math.hypot(b.vx, b.vy);
  if (m.trail.length > 2 && (speed > 9 || fat)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < m.trail.length; i++) { const k = 1 - i / m.trail.length; ctx.strokeStyle = alpha(tc, 0.55 * k); ctx.lineWidth = BALL_R * 2 * s * k * (fat ? 1.8 : 1); ctx.beginPath(); ctx.moveTo(X(v, m.trail[i - 1][0]), Y(v, m.trail[i - 1][1])); ctx.lineTo(X(v, m.trail[i][0]), Y(v, m.trail[i][1])); ctx.stroke(); }
    ctx.restore();
  }
  const x = X(v, b.x), y = Y(v, b.y);
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.4 - b.y * 0.04)})`; ctx.beginPath(); ctx.ellipse(x, Y(v, 0), BALL_R * s * (1 - Math.min(0.6, b.y * 0.05)), BALL_R * s * 0.25, 0, 0, TAU); ctx.fill();
  if (fat) { drawFatalBall(ctx, m, v, x, y); return; }
  drawBallSprite(ctx, x, y, BALL_R * s, b.spin, b.kind, b.fx, m.time);
  if (b.frozen > 0) { ctx.save(); ctx.globalAlpha = 0.75; const r = BALL_R * s * 1.5; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = 'rgba(186,230,253,0.55)'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
}
// La pelota del FATAL GOAL: meteorito, bola de hielo o roca gigante, rayo, agujero negro o calavera de ácido.
function drawFatalBall(ctx: CanvasRenderingContext2D, m: Match, v: View, x: number, y: number) {
  const fat = m.fatal!, p = fatalPath(fat, fat.t), r = BALL_R * v.s * p.size, t = m.time;
  ctx.save();
  switch (fat.style) {
    case 'meteor': {
      const b = m.ball, ang = Math.atan2(-b.vy, b.vx);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { ctx.fillStyle = ['rgba(255,80,20,0.5)', 'rgba(255,160,40,0.6)', 'rgba(255,240,180,0.8)'][k]; ctx.beginPath(); ctx.ellipse(x - Math.cos(ang) * r * (1.5 - k * 0.4), y - Math.sin(ang) * r * (1.5 - k * 0.4), r * (2.6 - k * 0.6), r * (1.1 - k * 0.25), ang, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      rock(ctx, x, y, r, t * 3, 7, '#5a3020', 1);
      bloom(ctx, x, y, r * 4, '#fb923c', 0.8);
      break;
    }
    case 'avalanche': case 'boulder': {
      const ice = fat.style === 'avalanche';
      bloom(ctx, x, y, r * 2.5, ice ? '#bae6fd' : '#fbbf24', 0.5);
      if (ice) { shade(ctx, () => ctx.arc(x, y, r, 0, TAU), '#9ccff5', { x: x - r * 0.3, y: y - r * 0.35, r: r * 1.4, hi: 0.6, tex: 0.4 }); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, r * 0.04); for (let k = 0; k < 6; k++) { const a = t * -4 + k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } spec(ctx, x - r * 0.4, y - r * 0.45, r * 0.3, r * 0.15, -0.6, 0.9); }
      else rock(ctx, x, y, r, t * -4, 3, '#6b6f78', 0);
      break;
    }
    case 'bolt': {
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 5, '#fde047', 0.9);
      ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = Math.max(1.5, r * 0.12);
      for (let k = 0; k < 6; k++) { let a = Math.random() * TAU, px = x, py = y; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { a += (Math.random() - 0.5) * 1.2; px += Math.cos(a) * r * 0.8; py += Math.sin(a) * r * 0.8; ctx.lineTo(px, py); } ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over'; drawBallSprite(ctx, x, y, r * 0.8, m.ball.spin, 'normal', 'volt', t);
      break;
    }
    case 'void': {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(192,132,252,${0.6 - k * 0.15})`; ctx.lineWidth = Math.max(1, r * 0.15); ctx.beginPath(); ctx.arc(x, y, r * (1.3 + k * 0.5), t * 6 + k, t * 6 + k + 4); ctx.stroke(); }
      bloom(ctx, x, y, r * 4, '#a855f7', 0.7);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#0b0218'); g.addColorStop(1, '#a855f7'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      break;
    }
    default: {
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 3.5, '#4ade80', 0.8); ctx.globalCompositeOperation = 'source-over';
      shade(ctx, () => { ctx.arc(x, y - r * 0.1, r * 0.85, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x + r * 0.5, y + r * 0.75); ctx.lineTo(x - r * 0.5, y + r * 0.75); ctx.closePath(); }, '#b5f5c4', { x: x - r * 0.3, y: y - r * 0.4, r: r * 1.4, tex: 0.4 });
      ctx.fillStyle = '#052e16'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s2 * r * 0.33, y - r * 0.05, r * 0.22, r * 0.25, 0, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter'; for (const s2 of [-1, 1]) bloom(ctx, x + s2 * r * 0.33, y - r * 0.05, r * 0.4, '#4ade80', 0.9); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#052e16'; for (let k = -2; k <= 2; k++) ctx.fillRect(x + k * r * 0.17 - r * 0.05, y + r * 0.45, r * 0.1, r * 0.25);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Habilidades (proyectiles y efectos)
function drawShot(ctx: CanvasRenderingContext2D, sh: Shot, m: Match, v: View) {
  const s = v.s, x = X(v, sh.x), y = Y(v, sh.y), r = sh.r * s, t = m.time, ang = Math.atan2(-sh.vy, sh.vx), owner = CHARS[m.fighters[sh.side].char];
  ctx.save();
  switch (sh.kind) {
    case 'fireball': {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(255,${120 + k * 25},40,${0.5 - k * 0.08})`; ctx.beginPath(); ctx.arc(x - Math.cos(ang) * k * r * 0.7, y - Math.sin(ang) * k * r * 0.7, r * (1.2 - k * 0.15), 0, TAU); ctx.fill(); }
      bloom(ctx, x, y, r * 4, '#fb923c', 0.8); ctx.globalCompositeOperation = 'source-over';
      drawBallSprite(ctx, x, y, r * 0.75, t * 10, 'fire', 'fire', t);
      break;
    }
    case 'shuriken': case 'bomb': {
      const c = sh.kind === 'bomb' ? '#ef4444' : owner.color;
      ctx.translate(x, y); ctx.rotate(t * 25);
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, r * 3, c, 0.6); ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8, d = k % 2 ? r * 0.45 : r * 1.4; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); } ctx.closePath();
      ctx.fillStyle = lin(ctx, -r, -r, r, r, [[0, '#f1f5f9'], [0.5, lighten(c, 0.3)], [1, darken(c, 0.4)]]); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
      break;
    }
    case 'bullet': { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(owner.glow, 0.8); ctx.lineCap = 'round'; ctx.lineWidth = r * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * r * 6, y + Math.sin(ang) * r * 6 * -1); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill(); bloom(ctx, x, y, r * 4, owner.glow, 0.7); break; }
    case 'feather': { ctx.translate(x, y); ctx.rotate(-ang); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, r * 3, owner.glow, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = lin(ctx, -r * 3, 0, r * 2, 0, [[0, alpha(owner.color, 0)], [0.5, owner.color], [1, '#fdf4ff']]); ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.quadraticCurveTo(0, -r * 0.9, -r * 3, 0); ctx.quadraticCurveTo(0, r * 0.9, r * 2, 0); ctx.fill(); ctx.strokeStyle = '#2e1065'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.lineTo(-r * 3, 0); ctx.stroke(); break; }
    case 'bubble': { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, 'rgba(220,255,220,0.9)'); g.addColorStop(0.6, 'rgba(74,222,128,0.6)'); g.addColorStop(1, 'rgba(21,128,61,0.8)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 2.5, '#4ade80', 0.5); break; }
  }
  ctx.restore();
}
function drawFx(ctx: CanvasRenderingContext2D, e: Fx, m: Match, v: View) {
  const s = v.s, k = e.t / e.life, owner = CHARS[m.fighters[e.side].char], t = m.time;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  switch (e.kind) {
    case 'bolt': { const a = 1 - k; for (const [c, wd] of [[alpha('#a78bfa', 0.6 * a), s * 0.35], [alpha('#fef08a', 0.9 * a), s * 0.14], [`rgba(255,255,255,${a})`, s * 0.05]] as const) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(X(v, e.x), Y(v, e.y)); const n = 9; for (let j = 1; j < n; j++) ctx.lineTo(X(v, e.x + (e.x2 - e.x) * j / n) + (hash(j + Math.floor(t * 30)) - 0.5) * s * 0.6, Y(v, e.y + (e.y2 - e.y) * j / n) + (hash(j * 3 + Math.floor(t * 30)) - 0.5) * s * 0.6); ctx.lineTo(X(v, e.x2), Y(v, e.y2)); ctx.stroke(); } bloom(ctx, X(v, e.x), Y(v, e.y), s, '#fde047', 0.7 * a); break; }
    case 'beam': { const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, x0 = X(v, e.x), y0 = Y(v, e.y), x1 = X(v, e.x2), y1 = Y(v, e.y2); ctx.lineCap = 'round'; for (const [c, wd] of [[alpha(owner.glow, 0.35 * a), s * 0.9], [alpha(owner.color, 0.8 * a), s * 0.4], [`rgba(255,255,255,${a})`, s * 0.15]] as const) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } bloom(ctx, x0, y0, s * 1.5, owner.glow, a); break; }
    case 'slash': { const cx = X(v, e.x), cy = Y(v, e.y), R = s * 2.4, a = 1 - k, st = e.dir > 0 ? -1.4 : Math.PI + 1.4, sw = (e.dir > 0 ? 1 : -1) * 2.6 * Math.min(1, k * 3); ctx.lineCap = 'round'; for (const [c, wd] of [[alpha(owner.glow, 0.4 * a), s * 0.5], [alpha(owner.color, 0.9 * a), s * 0.2], [`rgba(255,240,250,${a})`, s * 0.07]] as const) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, Math.min(st, st + sw), Math.max(st, st + sw)); ctx.stroke(); } break; }
    case 'nova': { const cx = X(v, e.x), cy = Y(v, e.y), R = s * 5.5 * Math.min(1, k * 2.5), a = 1 - k; const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R); g.addColorStop(0, 'rgba(186,230,253,0)'); g.addColorStop(0.85, `rgba(186,230,253,${0.45 * a})`); g.addColorStop(1, 'rgba(186,230,253,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; for (let j = 0; j < 9; j++) { const px = cx + (j - 4) * s * 0.6, hh = s * (0.6 + hash(j + e.x) * 0.8) * Math.min(1, k * 4) * a; ctx.fillStyle = lin(ctx, 0, Y(v, 0) - hh, 0, Y(v, 0), [[0, `rgba(240,249,255,${a})`], [1, `rgba(56,189,248,${0.8 * a})`]]); ctx.beginPath(); ctx.moveTo(px - s * 0.2, Y(v, 0)); ctx.lineTo(px, Y(v, 0) - hh); ctx.lineTo(px + s * 0.2, Y(v, 0)); ctx.fill(); } break; }
    case 'quake': { const a = 1 - k, R = s * 4.6 * Math.min(1, k * 2.2), gy = Y(v, e.y); ctx.strokeStyle = `rgba(251,191,36,${0.7 * a})`; ctx.lineWidth = s * 0.15; ctx.beginPath(); ctx.ellipse(X(v, e.x), gy, R, s * 0.35, 0, Math.PI, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; for (let j = -6; j <= 6; j++) { if (!j) continue; const px = X(v, e.x) + j * R / 6; rock(ctx, px, gy - s * 0.25 * Math.sin(k * Math.PI) * (1 + hash(j) * 1.5), s * 0.16, j, j + 3, '#6b6f78', 0); } break; }
    case 'boom': { const cx = X(v, e.x), cy = Y(v, e.y), R = s * 2.2 * Math.min(1, k * 3), a = 1 - k; const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(0.4, `rgba(251,146,60,${0.8 * a})`); g.addColorStop(1, 'rgba(220,38,38,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); break; }
    case 'cloud': { const a = Math.min(1, e.t * 4, (e.life - e.t) * 2); for (let j = 0; j < 12; j++) { const px = X(v, e.x + Math.cos(j * 2.1 + t * 0.6) * 1.4 * hash(j)), py = Y(v, e.y + Math.sin(j * 1.7 + t * 0.5) * 1.1 * hash(j + 3)), pr = s * (0.9 + hash(j + 5) * 0.7); const g = ctx.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, `rgba(134,239,172,${0.38 * a})`); g.addColorStop(1, 'rgba(34,197,94,0)'); ctx.fillStyle = g; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2); } break; }
    case 'magma': { const xh = e.x + e.dir * e.t * 14; ctx.globalCompositeOperation = 'source-over'; for (let j = 0; j < 7; j++) { const px = xh - e.dir * j * 0.55, life = 1 - j / 7, hh = s * (0.5 + hash(j + e.x) * 0.9) * life * Math.min(1, (1 - k) * 3); if ((px - e.x) * e.dir < 0) continue; ctx.fillStyle = lin(ctx, 0, Y(v, 0) - hh, 0, Y(v, 0), [[0, '#fff3b0'], [0.3, '#fb923c'], [1, '#7c2d12']]); ctx.beginPath(); ctx.moveTo(X(v, px) - s * 0.25, Y(v, 0)); ctx.lineTo(X(v, px) - s * 0.05, Y(v, 0) - hh); ctx.lineTo(X(v, px) + s * 0.25, Y(v, 0)); ctx.fill(); } ctx.globalCompositeOperation = 'lighter'; bloom(ctx, X(v, xh), Y(v, 0.4), s * 1.2, '#f97316', 0.6); break; }
    default: break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Trampas
function drawTrap(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const t = m.time, on = h.state === 2, warn = h.state === 1, cx = h.x + h.w / 2, base = -h.y; // en metros, y para abajo
  ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  const lamps = (x0: number, x1: number) => { for (const lx of [x0, x1]) { const c = on ? '#ef4444' : warn ? (Math.sin(t * 30) > 0 ? '#fbbf24' : '#78350f') : '#16a34a'; ctx.fillStyle = '#0b0d12'; ctx.beginPath(); ctx.arc(lx, base - 0.05, 0.07, Math.PI, TAU); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx, base - 0.05, 0.045, Math.PI, TAU); ctx.fill(); if (on || warn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, lx, base - 0.07, 0.3, c, 0.6); ctx.restore(); } } };
  switch (h.kind) {
    case 'spikes': {
      const tint = m.stage === 'ice' ? '#d6ecff' : m.stage === 'temple' ? '#c9c3b0' : m.stage === 'volcano' ? '#d1d5db' : '#c4c9d2';
      const up = on ? 0.75 : warn ? 0.14 + Math.abs(Math.sin(t * 18)) * 0.05 : 0.06;
      ctx.save(); ctx.beginPath(); ctx.rect(h.x - 0.2, base - 2, h.w + 0.4, 2.02); ctx.clip();
      ctx.globalAlpha = 0.85; steelSpikes(ctx, h.x + 0.1, h.w - 0.2, base + 0.1, base + 0.1 - up * 0.85 - 0.1, true, darken(tint, 0.35)); ctx.globalAlpha = 1;
      steelSpikes(ctx, h.x, h.w, base + 0.1, base + 0.1 - up - 0.1, true, tint);
      ctx.restore();
      lamps(h.x - 0.18, h.x + h.w + 0.18);
      break;
    }
    case 'flame': {
      plate(ctx, h.x - 0.12, base - 0.08, h.w + 0.24, 0.16, '#33302d', { rust: 0.6, bolts: true });
      ctx.fillStyle = '#060504'; for (let k = 0; k < 5; k++) ctx.fillRect(h.x + k * h.w / 5 + 0.03, base - 0.06, h.w / 5 - 0.06, 0.06);
      if (warn || on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${on ? 180 : 110},40,${on ? 0.9 : 0.4 + 0.3 * Math.sin(t * 25)})`; for (let k = 0; k < 5; k++) ctx.fillRect(h.x + k * h.w / 5 + 0.03, base - 0.06, h.w / 5 - 0.06, 0.06); ctx.restore(); }
      if (m.stage === 'temple' && !on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const fh = 0.25 + 0.1 * Math.sin(t * 12 + k * 2); ctx.fillStyle = 'rgba(255,170,60,0.75)'; ctx.beginPath(); ctx.moveTo(cx - 0.12 + k * 0.12, base - 0.06); ctx.quadraticCurveTo(cx - 0.12 + k * 0.12, base - 0.06 - fh * 2, cx - 0.06 + k * 0.12, base - 0.06 - fh * 2.2); ctx.quadraticCurveTo(cx + k * 0.12, base - 0.06 - fh, cx + k * 0.12, base - 0.06); ctx.fill(); } bloom(ctx, cx, base - 0.4, 0.8, '#fb923c', 0.5); ctx.restore(); } // antorcha encendida
      if (warn) { for (let k = 0; k < 6; k++) { const d = (t * 1.3 + hash(k + h.id)) % 1; ctx.fillStyle = `rgba(60,55,50,${0.45 * (1 - d)})`; ctx.beginPath(); ctx.arc(cx + (hash(k) - 0.5) * h.w, base - 0.1 - d * 1.2, 0.12 + d * 0.25, 0, TAU); ctx.fill(); } }
      break;
    }
    case 'shock': {
      plate(ctx, h.x - 0.05, base - 0.05, h.w + 0.1, 0.1, '#7c4a24', { bolts: true });
      for (const px of [h.x - 0.12, h.x + h.w + 0.12]) {
        plate(ctx, px - 0.1, base - 0.12, 0.2, 0.14, '#2b3038', { bolts: false });
        for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#b45309' : '#f59e0b'; ctx.beginPath(); ctx.roundRect(px - 0.07, base - 0.2 - k * 0.07, 0.14, 0.06, 0.02); ctx.fill(); }
        shade(ctx, () => ctx.arc(px, base - 0.66, 0.09, 0, TAU), '#9ca3af', { x: px - 0.03, y: base - 0.69, r: 0.1, hi: 0.6 });
        if (on || warn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, px, base - 0.66, on ? 0.6 : 0.3, '#93c5fd', on ? 0.8 : 0.3 + 0.3 * Math.sin(t * 40)); ctx.restore(); }
      }
      if (on) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = lin(ctx, 0, base - 0.8, 0, base, [[0, 'rgba(147,197,253,0)'], [1, `rgba(147,197,253,${0.35 + 0.15 * Math.sin(t * 60)})`]]); ctx.fillRect(h.x - 0.1, base - 0.8, h.w + 0.2, 0.8);
        for (let k = 0; k < 4; k++) zap(ctx, [h.x - 0.12, base - 0.66], [h.x + h.w + 0.12, base - 0.66 + (Math.random() - 0.5) * 0.2], k % 2 ? '#e0f2fe' : '#60a5fa');
        for (let k = 0; k < 5; k++) { const x = h.x + Math.random() * h.w; zap(ctx, [x, base - 0.02], [x + (Math.random() - 0.5) * 0.3, base - 0.3 - Math.random() * 0.4], '#bfdbfe'); }
        bloom(ctx, cx, base - 0.35, h.w * 0.9, '#60a5fa', 0.5);
        ctx.restore();
      }
      break;
    }
    case 'laser': {
      const color = THEMES[m.stage].laser, top = -h.h, x = cx;
      // emisor de arriba: colgado de una cadena (o pegado debajo de una plataforma)
      const under = m.solids.some(sd => sd.kind !== 'block' && Math.abs(sd.y - h.h) < 0.05 && x > sd.x && x < sd.x + sd.w);
      if (!under) { ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 0.05; for (let yy = -H; yy < top - 0.36; yy += 0.22) { ctx.beginPath(); ctx.ellipse(x, yy, 0.06, 0.12, 0, 0, TAU); ctx.stroke(); } }
      laserEmitter(ctx, x, top - 0.36, false, on, warn, color, t);
      laserEmitter(ctx, x, base - 0.3, true, on, warn, color, t);
      if (on) laserBeam(ctx, x, top, base - 0.3, color, t, [base - 0.3]); else if (warn) laserWarnLine(ctx, x, top, base - 0.3, color, t);
      break;
    }
    case 'saw': {
      ctx.fillStyle = '#07080b'; ctx.fillRect(h.x - 0.7, base - 0.03, h.w + 1.4, 0.08); // la ranura por donde corre
      hazardStripes(ctx, h.x - 0.95, base - 0.03, 0.25, 0.08, 0.12); hazardStripes(ctx, h.x + h.w + 0.7, base - 0.03, 0.25, 0.08, 0.12);
      if (h.state > 0) {
        const p = sawPos(h);
        ctx.save(); ctx.beginPath(); ctx.rect(p.x - p.r - 0.2, -H, p.r * 2 + 0.4, H + base); ctx.clip();
        sawBlade(ctx, p.x, -p.y, p.r, t * (on ? 25 : 6), m.stage === 'ice', t);
        ctx.restore();
        if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.fillRect(p.x + (Math.random() - 0.5) * 0.4, base - Math.random() * 0.4, 0.04, 0.04); } ctx.restore(); }
      }
      lamps(h.x - 0.95, h.x + h.w + 0.95);
      break;
    }
  }
  ctx.restore();
}
function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const s = v.s, t = m.time, gy = Y(v, 0);
  switch (h.kind) {
    case 'spikes': case 'flame': case 'shock': case 'laser': case 'saw': drawTrap(ctx, h, m, v); break;
    case 'lava': {
      const x0 = X(v, h.x), w = h.w * s, d = Math.min(v.h - gy, s * 1.2);
      ctx.fillStyle = lin(ctx, 0, gy - s * 0.05, 0, gy + d, [[0, '#fff3b0'], [0.2, '#ff8a1a'], [0.7, '#d9300d'], [1, '#7a1205']]); ctx.fillRect(x0, gy - s * 0.06, w, d);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) { const px = x0 + w * hash(k + h.id), py = gy + d * hash(k + 3), pr = s * (0.12 + 0.05 * Math.sin(t * 3 + k)); ctx.fillStyle = 'rgba(255,240,170,0.5)'; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.8, pr * 0.6, 0, 0, TAU); ctx.fill(); }
      bloom(ctx, x0 + w / 2, gy, w * 1.1, '#ff6a1a', 0.55);
      for (let k = 0; k < 5; k++) { const dd = (t * 1.1 + k / 5 + h.id) % 1; ctx.fillStyle = `rgba(255,200,80,${1 - dd})`; ctx.beginPath(); ctx.arc(x0 + w * hash(k + h.id), gy - dd * s * 1.1, s * 0.05, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = '#2a0d06'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.strokeRect(x0, gy - s * 0.06, w, d);
      break;
    }
    case 'conveyor': {
      const x0 = X(v, h.x), w = h.w * s;
      ctx.fillStyle = '#1b1d22'; ctx.fillRect(x0, gy - s * 0.12, w, s * 0.24);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, gy - s * 0.12, w, s * 0.24); ctx.clip();
      const off = ((t * 2.4 * h.dir) % 0.6) * s;
      ctx.fillStyle = '#facc15'; for (let x = x0 - s + off; x < x0 + w + s; x += s * 0.6) { ctx.beginPath(); ctx.moveTo(x, gy + s * 0.12); ctx.lineTo(x + s * 0.15, gy + s * 0.12); ctx.lineTo(x + s * 0.15 + h.dir * s * 0.15, gy - s * 0.12); ctx.lineTo(x + h.dir * s * 0.15, gy - s * 0.12); ctx.fill(); }
      ctx.restore();
      for (const ex of [x0, x0 + w]) shade(ctx, () => ctx.arc(ex, gy, s * 0.16, 0, TAU), '#6b7280', { x: ex - s * 0.05, y: gy - s * 0.05, r: s * 0.2 });
      break;
    }
    case 'wreck': {
      const p = wreckPos(h, t), px = X(v, h.x), py = Y(v, h.y), bx = X(v, p.x), by = Y(v, p.y), R = p.r * s;
      ctx.strokeStyle = '#2a2f37'; ctx.lineWidth = Math.max(2, s * 0.1); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = '#8b95a5'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.setLineDash([s * 0.12, s * 0.08]); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(s, s); seaMine(ctx, p.x, -p.y, p.r * 0.85, p.a * 2, '#2a2f38', null, t, false); ctx.restore();
      void R;
      break;
    }
    case 'mine': {
      if (h.state !== 0) break;
      const p = minePos(h, t);
      ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(s, s); seaMine(ctx, p.x, -p.y, h.w, t * 0.5, '#3b1d2a', '#ef4444', t, true); ctx.restore();
      break;
    }
    case 'waterfall': {
      const x0 = X(v, h.x), w = h.w * s, top = Y(v, H);
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.fillStyle = lin(ctx, x0, 0, x0 + w, 0, [[0, 'rgba(56,189,248,0.4)'], [0.5, 'rgba(224,242,254,0.75)'], [1, 'rgba(56,189,248,0.4)']]); ctx.fillRect(x0, top, w, gy - top);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, s * 0.04); for (let k = 0; k < 6; k++) { const xx = x0 + w * (k + 0.5) / 6, off = ((t * 3 + hash(k)) % 1) * s * 2; for (let y = top - s * 2 + off; y < gy; y += s * 2) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + s * 0.8); ctx.stroke(); } }
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x0 + w / 2, gy, s * 1.6, '#7dd3fc', 0.5); ctx.restore();
      for (let k = 0; k < 6; k++) { const d = (t * 1.5 + k / 6) % 1; ctx.fillStyle = `rgba(240,249,255,${0.6 * (1 - d)})`; ctx.beginPath(); ctx.arc(x0 + w / 2 + (hash(k) - 0.5) * s * 1.6, gy - d * s * 0.6, s * (0.1 + d * 0.15), 0, TAU); ctx.fill(); }
      break;
    }
    case 'meteor': case 'icicle': case 'lightning': drawStrike(ctx, h, m, v); break;
  }
}
// Los peligros que caen: primero el aviso (marca en el piso), después el golpe.
function drawStrike(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const s = v.s, gy = Y(v, 0), x = X(v, h.x), t = m.time;
  if (h.t < 0) {
    const k = 1 + h.t / 1.3, blink = Math.sin(t * 25) > 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const c = h.kind === 'meteor' ? '255,120,40' : h.kind === 'icicle' ? '186,230,253' : '253,224,71';
    ctx.fillStyle = `rgba(${c},${blink ? 0.5 : 0.25})`; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${c},0.8)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.5 * (1.4 - k * 0.4), s * 0.16, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    if (h.kind === 'meteor') { const my = Y(v, H + 1 - k * (H + 1)), mx = x + (1 - k) * s * 4; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(mx, my, mx - s * 2, my - s * 3); g.addColorStop(0, 'rgba(255,200,80,0.9)'); g.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(mx - s * 0.4, my); ctx.lineTo(mx - s * 2.5, my - s * 3.5); ctx.lineTo(mx + s * 0.4, my); ctx.fill(); bloom(ctx, mx, my, s * 1.5, '#fb923c', 0.8); ctx.restore(); rock(ctx, mx, my, s * 0.5, t, h.id, '#6b3a22', 1); }
    if (h.kind === 'icicle') { const iy = Y(v, H - 0.2); ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, iy); ctx.lineTo(x, iy + s * 0.9); ctx.lineTo(x + s * 0.2, iy); ctx.fill(); }
    if (h.kind === 'lightning') { ctx.fillStyle = 'rgba(200,210,255,0.06)'; ctx.fillRect(0, 0, v.w, v.h); }
    return;
  }
  const k = h.t / 1.3;
  ctx.save();
  if (h.kind === 'lightning') {
    ctx.globalCompositeOperation = 'lighter';
    if (h.t < 0.35) {
      for (const [c, wd] of [['rgba(167,139,250,0.6)', s * 0.35], ['rgba(224,231,255,0.9)', s * 0.14], ['#ffffff', s * 0.05]] as const) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, 0); const n = 9; for (let j = 1; j < n; j++) ctx.lineTo(x + (hash(j + Math.floor(t * 20) + h.id) - 0.5) * s * 1.2, gy * j / n); ctx.lineTo(x, gy); ctx.stroke(); }
      bloom(ctx, x, gy, s * 2.5, '#e0e7ff', 0.8);
    }
  } else if (h.kind === 'meteor') {
    if (h.t < 0.6) { ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, gy, s * 3 * (1 - k), '#ff7a1a', 0.9); }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(30,15,10,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.6, s * 0.15, 0, 0, TAU); ctx.fill();
  } else {
    const fall = Math.min(1, h.t / 0.12), iy = Y(v, H - 0.2 - fall * (H - 1));
    if (fall < 1) { ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, iy - s * 0.9); ctx.lineTo(x, iy); ctx.lineTo(x + s * 0.2, iy - s * 0.9); ctx.fill(); }
    else { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e0f2fe'; for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.moveTo(x + (j - 3) * s * 0.15, gy); ctx.lineTo(x + (j - 2.5) * s * 0.15, gy - s * 0.3 * hash(j + h.id)); ctx.lineTo(x + (j - 2) * s * 0.15, gy); ctx.fill(); } }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Potenciadores
export function drawPowerIcon(ctx: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (kind) {
    case 'shield': ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.4); ctx.quadraticCurveTo(r * 0.45, r * 0.3, 0, r * 0.65); ctx.quadraticCurveTo(-r * 0.45, r * 0.3, -r * 0.5, -r * 0.4); ctx.closePath(); ctx.fill(); break;
    case 'speed': for (const dx of [-0.25, 0.15]) { ctx.beginPath(); ctx.moveTo(r * dx - r * 0.15, -r * 0.45); ctx.lineTo(r * dx + r * 0.25, 0); ctx.lineTo(r * dx - r * 0.15, r * 0.45); ctx.stroke(); } break;
    case 'magnet': ctx.lineWidth = r * 0.25; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.35, Math.PI, 0, true); ctx.moveTo(-r * 0.35, -r * 0.05); ctx.lineTo(-r * 0.35, -r * 0.45); ctx.moveTo(r * 0.35, -r * 0.05); ctx.lineTo(r * 0.35, -r * 0.45); ctx.stroke(); break;
    case 'power': ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.45); ctx.lineTo(r * 0.35, -r * 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.5); ctx.lineTo(r * 0.12, -r * 0.42); ctx.lineTo(r * 0.38, -r * 0.18); ctx.closePath(); ctx.fill(); break;
    case 'giant': ctx.strokeRect(-r * 0.45, -r * 0.35, r * 0.9, r * 0.7); ctx.lineWidth = r * 0.06; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.22, -r * 0.35); ctx.lineTo(k * r * 0.22, r * 0.35); ctx.stroke(); } break;
    case 'energy': ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(-r * 0.3, r * 0.1); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.1, r * 0.6); ctx.lineTo(r * 0.3, -r * 0.1); ctx.lineTo(0, -r * 0.1); ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}
function drawPowerup(ctx: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, r: number, t: number, fade: number) {
  const c = POWERS[kind].color;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 3, c, 0.6 + 0.2 * Math.sin(t * 5));
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + t; ctx.strokeStyle = alpha(c, 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15); ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); ctx.stroke(); }
  ctx.restore();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, lighten(c, 0.5)); g.addColorStop(0.6, c); g.addColorStop(1, darken(c, 0.5));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = lighten(c, 0.6); ctx.lineWidth = 2; ctx.stroke();
  drawPowerIcon(ctx, kind, x, y, r);
  spec(ctx, x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.15, -0.5, 0.8);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, v: View) {
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), k = Math.max(0, p.life / p.max), r = Math.max(0.5, p.size * s);
  switch (p.kind) {
    case 'smoke': ctx.fillStyle = alpha(p.color, 0.35 * k); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); break;
    case 'ring': ctx.strokeStyle = alpha(p.color, Math.min(1, k * 1.6)); ctx.lineWidth = Math.max(1, s * 0.08 * k); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); break;
    case 'shard': ctx.fillStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.5, y); ctx.fill(); break;
    case 'bubble': ctx.strokeStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); break;
    default: ctx.fillStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }
}

// ---------------------------------------------------------------- Clima y luces que se mueven
function drawWeather(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const t = m.time, s = v.s;
  ctx.save();
  if (m.stage === 'ice') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 90; k++) { const x = ((hash(k) * v.w + t * s * (0.6 + hash(k + 1)) * 0.8 + Math.sin(t + k) * s * 0.3) % v.w + v.w) % v.w, y = ((hash(k + 2) * v.h + t * s * (1 + hash(k + 3))) % v.h); ctx.beginPath(); ctx.arc(x, y, 1 + hash(k + 4) * 2, 0, TAU); ctx.fill(); } }
  if (m.stage === 'storm') { ctx.strokeStyle = 'rgba(190,205,230,0.35)'; ctx.lineWidth = 1; for (let k = 0; k < 120; k++) { const x = ((hash(k) * v.w - t * s * 4) % v.w + v.w) % v.w, y = (hash(k + 2) * v.h + t * s * 22) % v.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.15, y + s * 0.6); ctx.stroke(); } if (Math.sin(t * 0.9) > 0.985) { ctx.fillStyle = 'rgba(220,225,255,0.18)'; ctx.fillRect(0, 0, v.w, v.h); } }
  if (m.stage === 'volcano') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 50; k++) { const y = v.h - ((hash(k + 2) * v.h + t * s * (0.8 + hash(k + 3))) % v.h), x = hash(k) * v.w + Math.sin(t * 2 + k) * s * 0.4; ctx.fillStyle = `rgba(255,${120 + hash(k) * 100},40,${0.5 + 0.4 * Math.sin(t * 5 + k)})`; ctx.fillRect(x, y, 2, 2); } }
  if (m.stage === 'forest' || m.stage === 'mines') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 30; k++) { const x = hash(k) * v.w + Math.sin(t * 0.7 + k) * s, y = Y(v, 1 + hash(k + 1) * 9) + Math.cos(t * 0.5 + k) * s * 0.5; ctx.fillStyle = alpha(THEMES[m.stage].edge, 0.3 + 0.25 * Math.sin(t * 3 + k)); ctx.fillRect(x, y, 2, 2); } }
  if (m.stage === 'industrial' || m.stage === 'factory') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 18; k++) { const x = hash(k) * v.w + Math.sin(t * 0.7 + k) * s, y = Y(v, 1 + hash(k + 1) * 9) - ((t * s * 0.4) % (s * 9)); ctx.fillStyle = 'rgba(255,190,90,0.35)'; ctx.fillRect(x, y, 2, 2); } }
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export function drawMatch(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * v.s * 0.5, (Math.random() - 0.5) * m.shake * v.s * 0.5);
  const bg = background(m, v);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = THEMES[m.stage].sky[1]; ctx.fillRect(0, 0, v.w, v.h); }
  for (const h of m.hazards) if (h.kind === 'waterfall') drawHazard(ctx, h, m, v);
  for (const h of m.hazards) if (h.kind === 'lava' || h.kind === 'conveyor' || h.kind === 'spikes' || h.kind === 'shock' || h.kind === 'saw' || (h.kind === 'flame' && h.state < 2)) drawHazard(ctx, h, m, v);
  drawGoal(ctx, m, v, true, false); drawGoal(ctx, m, v, false, false);
  for (const h of m.hazards) if (h.kind === 'laser' || h.kind === 'mine') drawHazard(ctx, h, m, v);
  // árbitro
  const r = m.ref;
  if (r.action !== 'gone') { ctx.save(); ctx.translate(X(v, r.x), Y(v, r.y)); ctx.scale(v.s, v.s); if (r.facing < 0) ctx.scale(-1, 1); drawRef(ctx, r, m.time + 0.7); ctx.restore(); }
  // luchadores
  for (const f of m.fighters) {
    const L = LOOKS[f.char], x = X(v, f.x), y = Y(v, f.y);
    ctx.save(); ctx.translate(x, y); ctx.scale(v.s, v.s); if (f.facing < 0) ctx.scale(-1, 1);
    const fatalNow = m.phase === 'fatal' && m.fatal?.side === f.side;
    drawFighterBody(ctx, f, m.time + f.side * 0.37, {
      power: f.power / POWER_MAX, frozen: f.stun > 0 && f.stunKind === 'freeze', poison: f.poison > 0 || (f.stun > 0 && f.stunKind === 'poison'), burn: (f.stun > 0 && f.stunKind === 'burn') || (f.char === 'brutoRed' && f.abilityT > 0),
      zap: f.stun > 0 && f.stunKind === 'zap', shield: (f.powers.shield ?? 0) > 0, speed: (f.powers.speed ?? 0) > 0,
      aura: fatalNow || f.power >= POWER_MAX ? L.glow : null,
    });
    ctx.restore();
  }
  for (const sh of m.shots) drawShot(ctx, sh, m, v);
  for (const e of m.fx) drawFx(ctx, e, m, v);
  drawBall(ctx, m, v);
  drawGoal(ctx, m, v, true, true); drawGoal(ctx, m, v, false, true);
  for (const h of m.hazards) if ((h.kind === 'flame' && h.state === 2) || h.kind === 'wreck' || h.kind === 'meteor' || h.kind === 'icicle' || h.kind === 'lightning') { if (h.kind === 'flame') drawFlameColumn(ctx, h, m, v); else drawHazard(ctx, h, m, v); }
  for (const p of m.powerups) drawPowerup(ctx, p.kind, X(v, p.x), Y(v, p.y + Math.sin(m.time * 3 + p.id) * 0.12), v.s * 0.38, m.time, Math.min(1, p.t * 3, (11 - p.t) * 2) * (p.t > 9 && Math.sin(p.t * 20) < 0 ? 0.4 : 1));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const p of m.particles) if (p.kind !== 'smoke') drawParticle(ctx, p, v); ctx.restore();
  for (const p of m.particles) if (p.kind === 'smoke') drawParticle(ctx, p, v);
  drawWeather(ctx, m, v);
  // FATAL: la pantalla se oscurece y el que tira brilla
  if (m.phase === 'fatal' && m.fatal) {
    const k = Math.min(1, m.phaseT * 3), f = m.fighters[m.fatal.side], L = LOOKS[f.char];
    ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`; ctx.fillRect(0, 0, v.w, v.h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, X(v, f.x), Y(v, f.y + 1), v.s * 4, L.glow, 0.8 * k);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + m.time; ctx.strokeStyle = alpha(L.glow, 0.5 * k); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(v, f.x) + Math.cos(a) * v.s * 0.8, Y(v, f.y + 1) + Math.sin(a) * v.s * 0.8); ctx.lineTo(X(v, f.x) + Math.cos(a) * v.s * (3 + Math.sin(m.time * 9 + i)), Y(v, f.y + 1) + Math.sin(a) * v.s * (3 + Math.sin(m.time * 9 + i))); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(X(v, f.x), Y(v, f.y)); ctx.scale(v.s, v.s); if (f.facing < 0) ctx.scale(-1, 1);
    drawFighterBody(ctx, f, m.time, { power: 1, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: L.glow });
    ctx.restore();
  }
  if (m.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${m.flash * 0.45})`; ctx.fillRect(0, 0, v.w, v.h); }
  const vg = ctx.createRadialGradient(v.w / 2, v.h * 0.55, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h * 0.55, Math.max(v.w, v.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  ctx.restore();
}
// Columna de fuego que sale de la rejilla: lenguas de llama, humo arriba.
function drawFlameColumn(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const t = m.time, cx = h.x + h.w / 2, w = h.w, height = 3.3, base = -h.y;
  ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  for (let k = 0; k < 6; k++) { const d = (t * 0.9 + hash(k + h.id)) % 1; ctx.fillStyle = `rgba(40,30,25,${0.35 * (1 - d)})`; ctx.beginPath(); ctx.arc(cx + (hash(k + 2) - 0.5) * w + Math.sin(t + k) * 0.2, base - height - d * 1.2, 0.3 + d * 0.5, 0, TAU); ctx.fill(); }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, cx - w, 0, cx + w, 0, [[0, 'rgba(220,38,38,0)'], [0.5, 'rgba(249,115,22,0.35)'], [1, 'rgba(220,38,38,0)']]); ctx.fillRect(cx - w, base - height, w * 2, height);
  for (let k = 0; k < 40; k++) {
    const life = (t * (1.6 + hash(k + h.id) * 0.9) + hash(k + 7)) % 1, fx = cx + (hash(k + 3) - 0.5) * w * (1 - life * 0.5) + Math.sin(t * 9 + k) * w * 0.12;
    const fy = base - life * height * (0.75 + hash(k + 13) * 0.3), fr = w * (0.22 + hash(k + 5) * 0.18) * (1 - life * 0.7);
    ctx.fillStyle = life < 0.18 ? 'rgba(255,230,150,0.55)' : life < 0.55 ? 'rgba(249,115,22,0.5)' : 'rgba(185,28,28,0.42)';
    ctx.beginPath(); ctx.moveTo(fx - fr, fy); ctx.quadraticCurveTo(fx - fr * 0.4, fy - fr * 2.4, fx + Math.sin(t * 14 + k) * fr * 0.3, fy - fr * 3.2); ctx.quadraticCurveTo(fx + fr * 0.4, fy - fr * 2.4, fx + fr, fy); ctx.arc(fx, fy, fr, 0, Math.PI); ctx.fill();
  }
  bloom(ctx, cx, base - height * 0.45, height * 0.7, '#ea580c', 0.3);
  bloom(ctx, cx, base - 0.05, w * 1.3, '#fb923c', 0.35);
  ctx.restore();
}
export { bolt };
