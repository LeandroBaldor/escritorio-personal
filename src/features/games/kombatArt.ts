// Cómo se ve Kombat Football: la cámara de costado fija con los dos arcos siempre a la vista; el fondo de cada
// escenario (ciudad industrial de noche, minas espaciales, base en el espacio, planeta helado y volcánico,
// bosque bioluminiscente, fábrica robótica, torres en la tormenta, templo antiguo y la Luna), el piso visto en
// corte, los desniveles y plataformas, el tubo del medio, los arcos con red, las trampas (pinches, sierras,
// láseres, fuego, placas eléctricas, minas, bolas con púas, lava), los luchadores, el árbitro, la pelota, las
// habilidades, los potenciadores y los efectos. El mundo se mide en metros (kombat.ts); acá se pasa a píxeles.
import {
  BALLS, BALL_R, BAR, CHARS, GOAL_DEPTH, H, NET_FLAT, POWERS, POWER_MAX, TUBE_Y, W, fatalPath, goalHeight, heightOf, minePos, netTop, sawPos, teamAt, wreckPos,
  type Ball, type Fx, type GibKind, type ScreenBlood, type Strike, type Hazard, type Match, type Particle, type PowerKind, type Shot, type Solid, type StageId,
} from './kombat';
import { fbm, pixels, ramp } from './gravityBackdrops';
import { drawFighterLit, drawRefLit, LOOKS } from './kombatFighters';
import { alpha, bloom, darken, grain, hash, lighten, lin, shade, spec, zap } from './gravityMonsters';
import { bolt, hazardStripes, laserBeam, laserWarnLine, plate, rock, sawBlade, seaMine, steelSpikes } from './gravityHazardArt';
import { backdropReady, drawAmbient, gradeScenery, paintBackdrop, paintScenery } from './kombatScenery';
import { STRUCT, paintBumper, paintEmitter, paintLantern, paintEmitterMount, paintLiftDrive, paintPlatform, paintSlideRail, paintSupport } from './kombatStructures';

const TAU = Math.PI * 2;
export interface View { w: number; h: number; s: number; ox: number; oy: number }
// La cancha ocupa todo el ancho de la pantalla (un arco en cada borde); abajo se ve el piso en corte.
export function viewFor(w: number, h: number): View {
  const s = Math.min(w / W, h / 12.5);
  return { w, h, s, ox: (w - W * s) / 2, oy: h - Math.min(1.6 * s, h * 0.14) };
}
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;

type Floor = 'metal' | 'rock' | 'panel' | 'ice' | 'lava' | 'moss' | 'grate' | 'stone' | 'jungle' | 'moon' | 'tile' | 'planks' | 'sand' | 'seabed' | 'cloud';
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
  subway: { sky: ['#07080c', '#11141c', '#1d2230'], fog: 'rgba(250,220,150,0.06)', floor: 'tile', support: 'chains', light: '#fde68a', edge: '#facc15', cloud: [60, 60, 70, 0], laser: '#ff2850' },
  pit: { sky: ['#03040a', '#0d1226', '#25213d'], fog: 'rgba(150,140,200,0.1)', floor: 'planks', support: 'chains', light: '#c7d2fe', edge: '#a78bfa', cloud: [70, 60, 110, 0.7], laser: '#ff2850' },
  desert: { sky: ['#2a1a4a', '#c2410c', '#fbbf24'], fog: 'rgba(255,190,110,0.12)', floor: 'sand', support: 'none', light: '#fde68a', edge: '#fbbf24', cloud: [200, 120, 80, 0.3], laser: '#ff2850' },
  ocean: { sky: ['#02101f', '#04345a', '#0b6a8f'], fog: 'rgba(80,200,230,0.12)', floor: 'seabed', support: 'chains', light: '#a5f3fc', edge: '#67e8f9', cloud: [40, 120, 160, 0], laser: '#ff2850' },
  sky: { sky: ['#1e3a8a', '#f472b6', '#fde68a'], fog: 'rgba(255,230,240,0.14)', floor: 'cloud', support: 'none', light: '#fff1c1', edge: '#fde68a', cloud: [255, 230, 240, 0.6], laser: '#ff2850' },
  coliseum: { sky: ['#1e40af', '#60a5fa', '#e0f2fe'], fog: 'rgba(255,230,190,0.1)', floor: 'sand', support: 'none', light: '#fde68a', edge: '#f59e0b', cloud: [255, 255, 255, 0.5], laser: '#ff2850' },
};

// ---------------------------------------------------------------- Fondo + piso + plataformas + tubo (se pintan una vez)
const bgCache = new Map<string, HTMLCanvasElement | null>();
function background(m: Match, v: View): HTMLCanvasElement | null {
  const key = `${m.stage}:${Math.round(v.w)}x${Math.round(v.h)}:${backdropReady(m.stage) ? 'img' : 'drawn'}`; // (cuando carga la imagen se vuelve a armar)
  if (bgCache.has(key)) return bgCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.w)); c.height = Math.max(1, Math.round(v.h));
  const g = c.getContext('2d');
  if (!g) { bgCache.set(key, null); return null; }
  if (bgCache.size > 8) bgCache.clear();
  if (!paintBackdrop(g, m.stage, v.w, v.h, Y(v, 0))) { // el fondo pintado; mientras carga, el dibujado
    paintScenery(g, m.stage, v.w, v.h, Y(v, 0), v.s);
    gradeScenery(c, m.stage);
    paintFloor(g, m.stage, v);
  }
  for (const s of m.solids) if (!s.move && s.kind !== 'bumper') paintSolid(g, m.stage, s, v); // (los de súper rebote se dibujan cada vez: se mueven)
  paintTube(g, v);
  bgCache.set(key, c);
  return c;
}
// Miniatura de un escenario (para elegirlo), sin luchadores.
export function drawStageThumb(ctx: CanvasRenderingContext2D, m: Match, w: number, h: number) {
  const s = w / W, v: View = { w, h: Math.max(h, (H * 0.75) * s), s, ox: 0, oy: h - 1.2 * s };
  if (!paintBackdrop(ctx, m.stage, v.w, v.h, Y(v, 0))) { paintScenery(ctx, m.stage, v.w, v.h, Y(v, 0), v.s); paintFloor(ctx, m.stage, v); }
  for (const sd of m.solids) paintSolid(ctx, m.stage, sd, v);
  for (const hz of m.hazards) { if (hz.kind === 'spikes' || hz.kind === 'laser' || hz.kind === 'saw' || hz.kind === 'flame' || hz.kind === 'shock') { const st = hz.state; hz.state = 2; drawTrap(ctx, hz, m, v); hz.state = st; } else if (hz.kind !== 'meteor' && hz.kind !== 'icicle' && hz.kind !== 'lightning') drawHazard(ctx, hz, m, v); }
  drawGoal(ctx, m, v, true, false); drawGoal(ctx, m, v, false, false); drawGoal(ctx, m, v, true, true); drawGoal(ctx, m, v, false, true);
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
    case 'tile': { // andén de subte: baldosas, línea amarilla de seguridad con relieve
      bricks(s * 1.0, s * 0.5, '#3a3f4a', '#424856', '#1a1d24'); g.fillStyle = '#facc15'; g.fillRect(0, gy, w, s * 0.22); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < w; x += s * 0.16) for (let yy = 0; yy < 2; yy++) { g.beginPath(); g.arc(x + (yy ? s * 0.08 : 0), gy + s * (0.06 + yy * 0.1), s * 0.025, 0, TAU); g.fill(); } break;
    }
    case 'planks': { // puente de tablones con clavos sobre el abismo
      g.fillStyle = '#1a120b'; g.fillRect(0, gy, w, hh);
      for (let x = 0, k = 0; x < w; x += s * 0.55, k++) { g.fillStyle = lin(g, 0, gy, 0, gy + s * 0.9, [[0, k % 2 ? '#6b4a2c' : '#5e4026'], [1, '#2e1f12']]); g.fillRect(x + 1, gy, s * 0.55 - 2, s * 0.9); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + s * 0.1, gy + s * 0.2); g.lineTo(x + s * 0.45, gy + s * 0.25); g.stroke(); g.fillStyle = '#94a3b8'; g.fillRect(x + s * 0.08, gy + s * 0.1, 2, 2); g.fillRect(x + s * 0.42, gy + s * 0.1, 2, 2); }
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, gy + s * 0.9, w, hh); for (let x = s * 2; x < w; x += s * 5) { g.fillStyle = '#2a1d12'; g.fillRect(x, gy + s * 0.9, s * 0.4, hh); } break;
    }
    case 'sand': { // arena con ondas y piedritas
      g.fillStyle = lin(g, 0, gy, 0, v.h, [[0, '#e8b96a'], [0.4, '#c98d45'], [1, '#7a4e22']]); g.fillRect(0, gy, w, hh);
      g.strokeStyle = 'rgba(120,70,30,0.35)'; g.lineWidth = Math.max(1, s * 0.03); for (let k = 0; k < 18; k++) { const y = gy + s * 0.15 + r(k) * (hh - s * 0.2), x = w * r(k + 30); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s, y - s * 0.12, x + s * 2, y); g.stroke(); }
      for (let k = 0; k < 40; k++) { g.fillStyle = r(k + 7) < 0.5 ? 'rgba(90,60,30,0.5)' : 'rgba(255,240,200,0.5)'; g.fillRect(w * r(k + 60), gy + hh * r(k + 61), 2, 2); } break;
    }
    case 'seabed': { // fondo del mar: arena con conchas, algas y piedras
      g.fillStyle = lin(g, 0, gy, 0, v.h, [[0, '#c9b78a'], [0.5, '#8a7a55'], [1, '#2f3b3a']]); g.fillRect(0, gy, w, hh);
      for (let k = 0; k < 14; k++) { const x = w * r(k), y = gy + s * (0.2 + r(k + 1) * 0.6); g.fillStyle = ['#f9a8d4', '#fde68a', '#e2e8f0'][k % 3]; g.beginPath(); g.arc(x, y, s * 0.08, Math.PI, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
      for (let k = 0; k < 24; k++) { const x = w * r(k + 40); g.strokeStyle = k % 2 ? '#15803d' : '#4d7c0f'; g.lineWidth = Math.max(1, s * 0.05); g.beginPath(); g.moveTo(x, gy); g.quadraticCurveTo(x + s * 0.2, gy - s * 0.3, x - s * 0.05, gy - s * (0.4 + r(k) * 0.4)); g.stroke(); } break;
    }
    case 'cloud': { // pasarela de mármol blanco y oro sobre las nubes
      bricks(s * 2, s * 0.6, '#f1ede4', '#e7e1d4', '#b8a888'); g.fillStyle = lin(g, 0, gy, 0, gy + s * 0.14, [[0, '#fde68a'], [1, '#b45309']]); g.fillRect(0, gy, w, s * 0.14);
      g.strokeStyle = 'rgba(160,140,110,0.35)'; g.lineWidth = 1; for (let k = 0; k < 16; k++) { const x = w * r(k), y = gy + s * 0.3 + r(k + 1) * (hh - s * 0.4); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.6, y + s * 0.2, x + s * 1.2, y - s * 0.1); g.stroke(); } // vetas
      break;
    }
    case 'moon': g.fillStyle = lin(g, 0, gy, 0, v.h, [[0, '#8b8f9c'], [1, '#3b3e48']]); g.fillRect(0, gy, w, hh); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(w * r(k), gy + hh * r(k + 1), s * (0.1 + r(k + 2) * 0.4), s * 0.06, 0, 0, TAU); g.fill(); } break;
  }
  g.save(); grain(g, () => g.rect(0, gy, w, hh), 0.35, s / 20); g.restore();
  g.fillStyle = alpha(T.edge, 0.5); g.fillRect(0, gy, w, Math.max(1, s * 0.03));
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, gy, w, Math.max(1, s * 0.12) * 0.4);
}

// Bloques (desniveles) y plataformas flotantes, cada escenario con su material y sus soportes.
function paintSolid(g: CanvasRenderingContext2D, stage: StageId, sd: Solid, v: View) {
  const T = THEMES[stage], s = v.s, x = X(v, sd.x), y = Y(v, sd.y + sd.h), w = sd.w * s, hh = sd.h * s, gy = Y(v, 0);
  if (sd.kind === 'bumper') { paintBumper(g, sd.bump ?? 'neon', x, y, w, hh, s, 0, 9); return; }
  if (sd.look === 'lantern') { paintLantern(g, x, y, w, hh); return; }
  if (sd.look) { paintProp(g, sd, x, y, w, hh, s); return; }
  if (sd.kind === 'bouncy') { // hongo que rebota
    g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#9fd8ff'], [1, '#4a8fc4']]); g.fillRect(x + w * 0.35, y + hh * 0.3, w * 0.3, gy - y - hh * 0.3);
    const cg = g.createRadialGradient(x + w / 2, y + hh * 0.2, 0, x + w / 2, y + hh * 0.4, w * 0.7); cg.addColorStop(0, '#f5d0fe'); cg.addColorStop(0.5, '#c026d3'); cg.addColorStop(1, '#4a044e');
    g.fillStyle = cg; g.beginPath(); g.ellipse(x + w / 2, y + hh * 0.55, w * 0.62, hh * 0.75, 0, Math.PI, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + w * (0.2 + k * 0.15), y + hh * (0.2 + (k % 2) * 0.15), s * 0.07, 0, TAU); g.fill(); }
    const gl = g.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, w); gl.addColorStop(0, 'rgba(232,121,249,0.35)'); gl.addColorStop(1, 'rgba(232,121,249,0)'); g.fillStyle = gl; g.fillRect(x - w / 2, y - w, w * 2, w * 2);
    return;
  }
  g.save(); g.translate(v.ox, v.oy); g.scale(s, s); // a metros (y para abajo)
  const mx = sd.x, my = -(sd.y + sd.h), mw = sd.w, mh = sd.h;
  if (sd.kind === 'float') { // plataformas con el estilo de cada planeta (y lo que las sostiene)
    if (!sd.move) paintSupport(g, stage, mx, my, mw, mh, sd.id * 7.3, -H - 1);
    paintPlatform(g, stage, mx, my, mw, mh, sd.id * 7.3);
    g.restore(); return;
  }
  switch (T.floor) {
    case 'metal': case 'grate': case 'panel': case 'rock': case 'tile':
      plate(g, mx, my, mw, mh, T.floor === 'panel' ? '#2a3b55' : T.floor === 'rock' ? '#3a2d52' : T.floor === 'tile' ? '#4a505c' : '#2b3446', { rust: T.floor === 'grate' ? 0.6 : 0.2 });
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
    case 'planks': { g.fillStyle = '#2a1d12'; g.fillRect(mx, my, mw, mh); for (let x = mx, k = 0; x < mx + mw - 0.01; x += 0.4, k++) { g.fillStyle = k % 2 ? '#6b4a2c' : '#5e4026'; g.fillRect(x + 0.02, my, Math.min(0.36, mx + mw - x - 0.02), mh); g.fillStyle = '#94a3b8'; g.fillRect(x + 0.06, my + 0.06, 0.04, 0.04); } break; }
    case 'sand': { g.fillStyle = lin(g, mx, my, mx, my + mh, [[0, '#e6c88f'], [1, '#a77b45']]); g.fillRect(mx, my, mw, mh); g.strokeStyle = 'rgba(110,70,30,0.45)'; g.lineWidth = 0.02; for (let yy = my + 0.2; yy < my + mh; yy += 0.2) { g.beginPath(); g.moveTo(mx, yy); g.lineTo(mx + mw, yy); g.stroke(); } for (let x = mx + 0.25; x < mx + mw; x += 0.5) { g.beginPath(); g.moveTo(x, my); g.lineTo(x, my + 0.2); g.stroke(); } g.fillStyle = 'rgba(255,240,210,0.45)'; g.fillRect(mx, my, mw, 0.04); break; }
    case 'seabed': { g.fillStyle = lin(g, mx, my, mx + mw, my + mh, [[0, '#7c8b8a'], [1, '#2f3b3a']]); g.beginPath(); g.roundRect(mx, my, mw, mh, 0.12); g.fill(); g.fillStyle = '#f472b6'; for (let k = 0; k < mw * 3; k++) { g.beginPath(); g.arc(mx + 0.15 + k * 0.33, my + 0.02, 0.06 + hash(k + sd.id) * 0.05, Math.PI, TAU); g.fill(); } g.fillStyle = '#4d7c0f'; for (let k = 0; k < mw * 2; k++) g.fillRect(mx + 0.2 + k * 0.5, my + mh, 0.04, 0.2 + hash(k) * 0.3); break; }
    case 'cloud': { g.fillStyle = lin(g, mx, my, mx, my + mh, [[0, '#ffffff'], [1, '#d6cfc0']]); g.fillRect(mx, my, mw, mh); g.fillStyle = lin(g, 0, my, 0, my + 0.1, [[0, '#fde68a'], [1, '#b45309']]); g.fillRect(mx, my, mw, 0.08); g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(mx + mw * (0.15 + k * 0.23), my + mh + 0.12, 0.35, 0.18, 0, 0, TAU); g.fill(); } break; }
    case 'moon': g.fillStyle = lin(g, mx, my, mx, my + mh, [[0, '#b8bcc6'], [1, '#6b7080']]); g.fillRect(mx, my, mw, mh); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.02; g.strokeRect(mx, my, mw, mh); for (let k = 0; k < mw * 2; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(mx + 0.25 + k * 0.5, my + mh * (0.3 + hash(k) * 0.4), 0.05, 0, TAU); g.fill(); } break;
  }
  g.restore();
}

// Objetos distintos en cada escenario (se pisan y chocan como cualquier bloque): contenedor, carro minero,
// cristales, cápsula de carga, cubo de hielo, montículo de nieve, roca de obsidiana, columna de basalto, tronco
// caído, tocón, barriles, lápida, altar, columna rota y rocas lunares.
function paintProp(g: CanvasRenderingContext2D, sd: Solid, x: number, y: number, w: number, h: number, s: number) {
  const r = (n: number) => hash(n * 3.7 + sd.id * 1.3), lw = Math.max(1, s * 0.03);
  const shadow = () => { const sg = g.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.7); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x - w * 0.2, y + h - s * 0.2, w * 1.4, s * 0.3); };
  shadow(); g.save();
  switch (sd.look) {
    case 'hydrant': { // hidrante rojo de la calle
      const cx = x + w / 2; g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#fca5a5'], [0.4, '#dc2626'], [1, '#7f1d1d']]); g.beginPath(); g.roundRect(x + w * 0.18, y + h * 0.25, w * 0.64, h * 0.75, w * 0.1); g.fill();
      g.beginPath(); g.ellipse(cx, y + h * 0.25, w * 0.34, h * 0.14, 0, Math.PI, TAU); g.fill(); g.fillRect(cx - w * 0.08, y, w * 0.16, h * 0.14);
      g.fillStyle = '#991b1b'; g.fillRect(x, y + h * 0.42, w, h * 0.16); g.fillRect(x + w * 0.1, y + h * 0.88, w * 0.8, h * 0.12);
      g.fillStyle = '#facc15'; g.beginPath(); g.arc(cx, y + h * 0.5, w * 0.08, 0, TAU); g.fill(); spec(g, x + w * 0.35, y + h * 0.4, w * 0.08, h * 0.2, 0, 0.5); break;
    }
    case 'dish': { // antena parabólica
      g.fillStyle = '#64748b'; g.fillRect(x + w * 0.42, y + h * 0.45, w * 0.16, h * 0.55); g.fillRect(x + w * 0.2, y + h * 0.9, w * 0.6, h * 0.1);
      g.save(); g.translate(x + w / 2, y + h * 0.42); g.rotate(-0.5); g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, [[0, '#f1f5f9'], [1, '#94a3b8']]); g.beginPath(); g.ellipse(0, 0, w * 0.5, h * 0.22, 0, Math.PI, TAU); g.fill(); g.strokeStyle = '#475569'; g.lineWidth = lw; g.beginPath(); g.moveTo(0, -h * 0.02); g.lineTo(0, -h * 0.4); g.stroke(); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(0, -h * 0.42, s * 0.05, 0, TAU); g.fill(); g.restore(); break;
    }
    case 'gears': { // máquina de engranajes
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#57534e'], [1, '#292524']]); g.fillRect(x, y + h * 0.3, w, h * 0.7);
      const gear = (cx: number, cy: number, r: number, c: string) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, rr = k % 2 ? r : r * 0.8; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill(); g.fillStyle = '#1c1917'; g.beginPath(); g.arc(cx, cy, r * 0.3, 0, TAU); g.fill(); };
      gear(x + w * 0.35, y + h * 0.35, w * 0.35, '#b45309'); gear(x + w * 0.75, y + h * 0.6, w * 0.25, '#a16207'); g.fillStyle = '#ef4444'; g.fillRect(x + w * 0.1, y + h * 0.82, w * 0.12, h * 0.08); break;
    }
    case 'gargoyle': { // gárgola de piedra sobre pedestal
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#6b7280'], [1, '#1f2937']]); g.fillRect(x, y + h * 0.6, w, h * 0.4);
      g.fillStyle = '#4b5563'; g.beginPath(); g.moveTo(x + w * 0.15, y + h * 0.6); g.lineTo(x + w * 0.2, y + h * 0.25); g.lineTo(x + w * 0.5, y + h * 0.08); g.lineTo(x + w * 0.85, y + h * 0.25); g.lineTo(x + w * 0.85, y + h * 0.6); g.fill(); // cuerpo agachado
      g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.3); g.lineTo(x - w * 0.25, y + h * 0.05); g.lineTo(x + w * 0.05, y + h * 0.45); g.fill(); g.beginPath(); g.moveTo(x + w * 0.9, y + h * 0.3); g.lineTo(x + w * 1.25, y + h * 0.05); g.lineTo(x + w * 0.95, y + h * 0.45); g.fill(); // alas
      g.fillStyle = '#fbbf24'; for (const ex of [0.4, 0.6]) { g.beginPath(); g.arc(x + w * ex, y + h * 0.2, s * 0.04, 0, TAU); g.fill(); } g.fillStyle = '#374151'; g.beginPath(); g.moveTo(x + w * 0.38, y + h * 0.08); g.lineTo(x + w * 0.3, y - h * 0.08); g.lineTo(x + w * 0.45, y + h * 0.06); g.moveTo(x + w * 0.62, y + h * 0.08); g.lineTo(x + w * 0.7, y - h * 0.08); g.lineTo(x + w * 0.55, y + h * 0.06); g.fill(); break; // ojos y cuernos
    }
    case 'idol': { // ídolo de piedra con cara tallada
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#a8a082'], [0.5, '#7a7458'], [1, '#3e3c2e']]); g.beginPath(); g.roundRect(x + w * 0.1, y, w * 0.8, h, [w * 0.35, w * 0.35, 0, 0]); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + w * 0.25, y + h * 0.3, w * 0.18, h * 0.1); g.fillRect(x + w * 0.57, y + h * 0.3, w * 0.18, h * 0.1); g.fillRect(x + w * 0.44, y + h * 0.42, w * 0.12, h * 0.2); g.fillRect(x + w * 0.3, y + h * 0.7, w * 0.4, h * 0.08);
      g.fillStyle = '#34d399'; for (const ex of [0.34, 0.66]) { g.beginPath(); g.arc(x + w * ex, y + h * 0.35, s * 0.04, 0, TAU); g.fill(); }
      g.fillStyle = '#2f7a3a'; g.beginPath(); g.ellipse(x + w * 0.7, y + h * 0.05, w * 0.2, s * 0.05, 0, 0, TAU); g.fill(); break;
    }
    case 'lander': { // módulo lunar
      g.strokeStyle = '#94a3b8'; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.55); g.lineTo(x, y + h); g.moveTo(x + w * 0.8, y + h * 0.55); g.lineTo(x + w, y + h); g.stroke();
      g.fillStyle = lin(g, 0, y + h * 0.35, 0, y + h * 0.7, [[0, '#fde68a'], [1, '#b45309']]); g.fillRect(x + w * 0.15, y + h * 0.38, w * 0.7, h * 0.3); // lámina dorada
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#f1f5f9'], [1, '#64748b']]); g.beginPath(); g.moveTo(x + w * 0.25, y + h * 0.38); g.lineTo(x + w * 0.3, y + h * 0.05); g.lineTo(x + w * 0.7, y + h * 0.05); g.lineTo(x + w * 0.75, y + h * 0.38); g.fill();
      g.fillStyle = '#0f172a'; g.beginPath(); g.moveTo(x + w * 0.38, y + h * 0.15); g.lineTo(x + w * 0.5, y + h * 0.12); g.lineTo(x + w * 0.5, y + h * 0.28); g.lineTo(x + w * 0.4, y + h * 0.28); g.fill();
      g.fillStyle = '#e2e8f0'; g.fillRect(x + w * 0.62, y - h * 0.15, w * 0.04, h * 0.2); g.fillStyle = '#2563eb'; g.fillRect(x + w * 0.66, y - h * 0.15, w * 0.18, h * 0.1); break; // banderita
    }
    case 'vending': { // máquina expendedora con luz
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#ef4444'], [1, '#7f1d1d']]); g.fillRect(x, y, w, h);
      g.fillStyle = '#0f172a'; g.fillRect(x + w * 0.1, y + h * 0.08, w * 0.58, h * 0.6);
      for (let r2 = 0; r2 < 4; r2++) for (let c2 = 0; c2 < 3; c2++) { g.fillStyle = ['#22c55e', '#facc15', '#38bdf8', '#f472b6'][(r2 + c2) % 4]; g.fillRect(x + w * (0.14 + c2 * 0.18), y + h * (0.12 + r2 * 0.14), w * 0.12, h * 0.09); }
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(186,230,253,0.25)'; g.fillRect(x + w * 0.1, y + h * 0.08, w * 0.58, h * 0.6); g.restore();
      g.fillStyle = '#1f2937'; g.fillRect(x + w * 0.74, y + h * 0.2, w * 0.16, h * 0.3); g.fillRect(x + w * 0.15, y + h * 0.76, w * 0.5, h * 0.1); g.fillStyle = '#fef08a'; g.fillRect(x + w * 0.78, y + h * 0.24, w * 0.08, h * 0.04); break;
    }
    case 'brazier': { // brasero de hierro con fuego
      g.fillStyle = '#1f2937'; g.beginPath(); g.moveTo(x + w * 0.3, y + h); g.lineTo(x + w * 0.45, y + h * 0.5); g.lineTo(x + w * 0.55, y + h * 0.5); g.lineTo(x + w * 0.7, y + h); g.fill();
      g.fillStyle = lin(g, 0, y + h * 0.25, 0, y + h * 0.55, [[0, '#6b7280'], [1, '#111827']]); g.beginPath(); g.moveTo(x, y + h * 0.25); g.lineTo(x + w, y + h * 0.25); g.lineTo(x + w * 0.75, y + h * 0.55); g.lineTo(x + w * 0.25, y + h * 0.55); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x + w / 2, y + h * 0.2, 0, x + w / 2, y + h * 0.2, w * 0.9); gl.addColorStop(0, 'rgba(251,146,60,0.6)'); gl.addColorStop(1, 'rgba(251,146,60,0)'); g.fillStyle = gl; g.fillRect(x - w * 0.5, y - h * 0.8, w * 2, h * 1.5); g.restore();
      for (let k = 0; k < 4; k++) { const fx2 = x + w * (0.2 + k * 0.2); g.fillStyle = k % 2 ? '#fde047' : '#f97316'; g.beginPath(); g.moveTo(fx2 - w * 0.1, y + h * 0.27); g.quadraticCurveTo(fx2, y - h * (0.2 + r(k) * 0.3), fx2 + w * 0.1, y + h * 0.27); g.fill(); } break;
    }
    case 'cage': { // jaula de hierro colgando de una cadena
      g.strokeStyle = '#3f3a2a'; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(x + w / 2, y - h * 0.6); g.lineTo(x + w / 2, y); g.stroke();
      g.strokeStyle = '#57534e'; g.lineWidth = lw * 1.4; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.08, w / 2, h * 0.08, 0, 0, TAU); g.stroke(); g.fillStyle = '#292524'; g.fillRect(x, y + h * 0.92, w, h * 0.08);
      for (let k = 0; k <= 6; k++) { const bx = x + w * k / 6; g.beginPath(); g.moveTo(bx, y + h * 0.08); g.lineTo(bx, y + h * 0.92); g.stroke(); }
      g.fillStyle = 'rgba(196,181,253,0.35)'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.55, s * 0.12, 0, TAU); g.fill(); break; // un fueguito fatuo adentro
    }
    case 'ruin': { // bloque de arenisca con jeroglíficos
      g.fillStyle = lin(g, x, y, x + w, y + h, [[0, '#f3d9a4'], [1, '#a77b45']]); g.fillRect(x, y, w, h); g.fillStyle = '#c99a5b'; g.fillRect(x, y, w, h * 0.12);
      g.strokeStyle = 'rgba(90,55,20,0.75)'; g.lineWidth = lw; for (let k = 0; k < 5; k++) { const gx = x + w * (0.1 + k * 0.18), gy2 = y + h * 0.3; g.beginPath(); if (k % 3 === 0) { g.arc(gx + w * 0.05, gy2 + h * 0.15, w * 0.04, 0, TAU); g.moveTo(gx + w * 0.05, gy2 + h * 0.2); g.lineTo(gx + w * 0.05, gy2 + h * 0.45); } else if (k % 3 === 1) { g.moveTo(gx, gy2 + h * 0.45); g.lineTo(gx + w * 0.05, gy2); g.lineTo(gx + w * 0.1, gy2 + h * 0.45); } else { g.ellipse(gx + w * 0.05, gy2 + h * 0.2, w * 0.06, h * 0.12, 0, 0, TAU); g.moveTo(gx + w * 0.02, gy2 + h * 0.2); g.lineTo(gx + w * 0.08, gy2 + h * 0.2); } g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(x + w * 0.8, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.4); g.fill(); break; // esquina rota
    }
    case 'anchor': { // ancla oxidada clavada en la arena
      g.strokeStyle = '#78350f'; g.lineWidth = lw * 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.12); g.lineTo(x + w / 2, y + h * 0.9); g.moveTo(x + w * 0.2, y + h * 0.3); g.lineTo(x + w * 0.8, y + h * 0.3); g.stroke();
      g.beginPath(); g.arc(x + w / 2, y + h * 0.55, w * 0.42, 0.15, Math.PI - 0.15); g.stroke(); g.lineWidth = lw * 2; g.beginPath(); g.arc(x + w / 2, y + h * 0.06, w * 0.12, 0, TAU); g.stroke();
      g.fillStyle = '#166534'; g.beginPath(); g.ellipse(x + w * 0.6, y + h * 0.6, s * 0.08, s * 0.2, 0.4, 0, TAU); g.fill(); break;
    }
    case 'urn': { // jarrón dorado
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#fef3c7'], [0.35, '#f59e0b'], [1, '#78350f']]); g.beginPath(); g.moveTo(x + w * 0.3, y); g.lineTo(x + w * 0.7, y); g.quadraticCurveTo(x + w * 0.62, y + h * 0.2, x + w, y + h * 0.5); g.quadraticCurveTo(x + w, y + h * 0.9, x + w * 0.65, y + h); g.lineTo(x + w * 0.35, y + h); g.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.5); g.quadraticCurveTo(x + w * 0.38, y + h * 0.2, x + w * 0.3, y); g.fill();
      g.fillStyle = '#7c2d12'; g.fillRect(x + w * 0.08, y + h * 0.48, w * 0.84, h * 0.06); spec(g, x + w * 0.3, y + h * 0.45, w * 0.08, h * 0.2, 0, 0.6); break;
    }
    case 'fountain': { // fuente de mármol con agua
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#ffffff'], [1, '#cbd5e1']]); g.beginPath(); g.ellipse(x + w / 2, y + h * 0.35, w / 2, h * 0.3, 0, 0, Math.PI); g.lineTo(x, y + h * 0.35); g.fill(); g.fillRect(x + w * 0.35, y + h * 0.5, w * 0.3, h * 0.5);
      g.fillStyle = 'rgba(56,189,248,0.75)'; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.35, w * 0.45, h * 0.12, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(224,242,254,0.85)'; g.lineWidth = lw; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + w / 2, y + h * 0.3); g.quadraticCurveTo(x + w / 2 + d * w * 0.2, y - h * 0.8, x + w / 2 + d * w * 0.35, y + h * 0.3); g.stroke(); } break;
    }
    case 'rack': { // estante con armas de gladiador
      g.fillStyle = '#5a3e26'; g.fillRect(x, y + h * 0.1, w * 0.1, h * 0.9); g.fillRect(x + w * 0.9, y + h * 0.1, w * 0.1, h * 0.9); g.fillRect(x, y + h * 0.25, w, h * 0.06); g.fillRect(x, y + h * 0.85, w, h * 0.08);
      for (let k = 0; k < 4; k++) { const wx = x + w * (0.2 + k * 0.2); g.fillStyle = '#cbd5e1'; g.fillRect(wx - 1, y - h * 0.15, 2.5, h); g.fillStyle = '#78350f'; g.fillRect(wx - 2, y + h * 0.55, 4.5, h * 0.3); if (k % 2) { g.fillStyle = '#94a3b8'; g.beginPath(); g.moveTo(wx - s * 0.08, y - h * 0.15); g.lineTo(wx, y - h * 0.32); g.lineTo(wx + s * 0.08, y - h * 0.15); g.fill(); } }
      g.fillStyle = '#b91c1c'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.6, w * 0.22, 0, TAU); g.fill(); g.fillStyle = '#facc15'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.6, w * 0.07, 0, TAU); g.fill(); break; // escudo
    }
    case 'bench': { // banco del andén
      g.fillStyle = '#1f2937'; for (const lx of [0.1, 0.82]) g.fillRect(x + w * lx, y + h * 0.35, w * 0.08, h * 0.65);
      g.fillStyle = lin(g, 0, y, 0, y + h * 0.4, [[0, '#f59e0b'], [1, '#92400e']]); for (let k = 0; k < 3; k++) g.fillRect(x, y + k * h * 0.12, w, h * 0.09);
      g.fillStyle = '#9ca3af'; g.fillRect(x, y + h * 0.38, w, h * 0.06); break;
    }
    case 'crate': { // cajón de madera
      g.fillStyle = lin(g, x, y, x + w, y + h, [[0, '#b7843f'], [1, '#6b4a22']]); g.fillRect(x, y, w, h); g.strokeStyle = '#4a3216'; g.lineWidth = lw * 2; g.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2); g.beginPath(); g.moveTo(x + lw, y + lw); g.lineTo(x + w - lw, y + h - lw); g.moveTo(x + w - lw, y + lw); g.lineTo(x + lw, y + h - lw); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.font = `900 ${Math.max(6, s * 0.2)}px Impact, sans-serif`; g.textAlign = 'center'; g.fillText('FRÁGIL', x + w / 2, y + h * 0.58); g.textAlign = 'left'; break;
    }
    case 'cactus': {
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#4ade80'], [0.4, '#16a34a'], [1, '#14532d']]);
      g.beginPath(); g.roundRect(x + w * 0.32, y, w * 0.36, h, w * 0.18); g.fill(); g.beginPath(); g.roundRect(x, y + h * 0.25, w * 0.24, h * 0.35, w * 0.12); g.fill(); g.fillRect(x + w * 0.1, y + h * 0.5, w * 0.3, h * 0.1); g.beginPath(); g.roundRect(x + w * 0.76, y + h * 0.15, w * 0.24, h * 0.3, w * 0.12); g.fill(); g.fillRect(x + w * 0.6, y + h * 0.38, w * 0.3, h * 0.1);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = lw; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + w * (0.32 + k * 0.12), y + w * 0.1); g.lineTo(x + w * (0.32 + k * 0.12), y + h); g.stroke(); }
      g.fillStyle = '#fef9c3'; for (let k = 0; k < 14; k++) g.fillRect(x + w * (0.3 + r(k) * 0.4), y + h * r(k + 3), 2, 1);
      g.fillStyle = '#f472b6'; g.beginPath(); g.arc(x + w / 2, y + w * 0.05, w * 0.1, 0, TAU); g.fill(); break;
    }
    case 'coral': {
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#fb7185'], [1, '#9f1239']]); g.beginPath(); g.moveTo(x, y + h); for (let k = 0; k <= 8; k++) { const u = k / 8; g.lineTo(x + w * u, y + h * (0.1 + 0.25 * Math.abs(Math.sin(k * 1.7))) ); } g.lineTo(x + w, y + h); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(x + w * r(k), y + h * (0.35 + r(k + 1) * 0.55), s * 0.04, 0, TAU); g.fill(); }
      g.fillStyle = '#facc15'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + w * (0.2 + k * 0.3), y + h * 0.15, s * 0.12, s * 0.2, 0, Math.PI, TAU); g.fill(); } break;
    }
    case 'chest': { // cofre del tesoro
      g.fillStyle = lin(g, 0, y + h * 0.35, 0, y + h, [[0, '#92400e'], [1, '#451a03']]); g.fillRect(x, y + h * 0.35, w, h * 0.65);
      g.fillStyle = lin(g, 0, y, 0, y + h * 0.4, [[0, '#b45309'], [1, '#78350f']]); g.beginPath(); g.moveTo(x, y + h * 0.4); g.quadraticCurveTo(x + w / 2, y - h * 0.15, x + w, y + h * 0.4); g.fill();
      g.fillStyle = '#facc15'; for (const bx of [0.12, 0.84]) g.fillRect(x + w * bx, y + h * 0.05, w * 0.06, h * 0.95); g.fillRect(x, y + h * 0.38, w, h * 0.06); g.fillRect(x + w * 0.44, y + h * 0.4, w * 0.12, h * 0.18);
      g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, w * 0.5); gl.addColorStop(0, 'rgba(253,224,71,0.45)'); gl.addColorStop(1, 'rgba(253,224,71,0)'); g.fillStyle = gl; g.fillRect(x - w * 0.2, y - h * 0.3, w * 1.4, h); g.restore(); break;
    }
    case 'statue': { // estatua de un guerrero sobre pedestal
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#e7e5e4'], [1, '#78716c']]); g.fillRect(x, y + h * 0.7, w, h * 0.3); g.fillRect(x + w * 0.1, y + h * 0.66, w * 0.8, h * 0.06);
      const cx = x + w / 2, sh = h * 0.66; g.fillStyle = lin(g, cx - w * 0.3, 0, cx + w * 0.3, 0, [[0, '#d6d3d1'], [1, '#57534e']]);
      g.beginPath(); g.arc(cx, y + sh * 0.12, w * 0.13, 0, TAU); g.fill(); g.fillRect(cx - w * 0.17, y + sh * 0.24, w * 0.34, sh * 0.42); g.fillRect(cx - w * 0.15, y + sh * 0.64, w * 0.12, sh * 0.36); g.fillRect(cx + w * 0.03, y + sh * 0.64, w * 0.12, sh * 0.36);
      g.save(); g.translate(cx + w * 0.17, y + sh * 0.28); g.rotate(-0.6); g.fillRect(0, 0, w * 0.1, sh * 0.35); g.fillStyle = '#a8a29e'; g.fillRect(w * 0.02, -sh * 0.45, w * 0.05, sh * 0.5); g.restore(); // brazo con la espada
      g.fillStyle = '#a8a29e'; g.beginPath(); g.ellipse(cx - w * 0.22, y + sh * 0.45, w * 0.12, sh * 0.16, 0, 0, TAU); g.fill(); // escudo
      g.fillStyle = 'rgba(60,110,45,0.4)'; g.fillRect(x, y + h * 0.95, w * 0.5, h * 0.05); break;
    }
    case 'container': {
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#c2410c'], [0.5, '#9a3412'], [1, '#5c1d08']]); g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(0,0,0,0.28)'; for (let xx = x + s * 0.12; xx < x + w; xx += s * 0.18) g.fillRect(xx, y + s * 0.05, Math.max(1, s * 0.05), h - s * 0.1); // chapa ondulada
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (let xx = x + s * 0.06; xx < x + w; xx += s * 0.18) g.fillRect(xx, y + s * 0.05, 1, h - s * 0.1);
      g.strokeStyle = '#3b1405'; g.lineWidth = lw * 2; g.strokeRect(x, y, w, h);
      g.fillStyle = '#e5e7eb'; g.font = `900 ${Math.max(6, s * 0.22)}px Impact, sans-serif`; g.fillText('KF-07', x + w * 0.12, y + h * 0.55);
      g.fillStyle = 'rgba(120,60,20,0.5)'; g.fillRect(x + w * 0.6, y + h * 0.6, w * 0.25, h * 0.2); // óxido
      break;
    }
    case 'cart': {
      g.fillStyle = '#2b2233'; g.fillRect(x - s * 0.2, y + h - s * 0.08, w + s * 0.4, s * 0.06); // riel
      g.fillStyle = lin(g, x, y, x, y + h * 0.75, [[0, '#6b7280'], [1, '#374151']]); g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.9, y + h * 0.75); g.lineTo(x + w * 0.1, y + h * 0.75); g.closePath(); g.fill(); g.strokeStyle = '#1f2937'; g.lineWidth = lw; g.stroke();
      for (let k = 0; k < 7; k++) { const cx = x + w * (0.15 + r(k) * 0.7), cy = y - s * 0.05 - r(k + 9) * s * 0.18, rr = s * (0.1 + r(k + 3) * 0.1), c = ['#c084fc', '#f472b6', '#38bdf8', '#57534e'][k % 4]; g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy - rr); g.lineTo(cx + rr, cy); g.lineTo(cx, cy + rr * 0.6); g.lineTo(cx - rr, cy); g.fill(); } // mineral
      for (const wx of [0.25, 0.75]) { g.fillStyle = '#111827'; g.beginPath(); g.arc(x + w * wx, y + h * 0.82, s * 0.16, 0, TAU); g.fill(); g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(x + w * wx, y + h * 0.82, s * 0.06, 0, TAU); g.fill(); }
      break;
    }
    case 'crystal': {
      for (let k = 0; k < 5; k++) { const cx = x + w * (0.15 + k * 0.17), ch = h * (0.6 + r(k) * 0.9), cw = w * 0.16, c = k % 2 ? '#c084fc' : '#22d3ee'; const gl = g.createRadialGradient(cx, y + h - ch * 0.5, 0, cx, y + h - ch * 0.5, ch); gl.addColorStop(0, alpha(c, 0.4)); gl.addColorStop(1, alpha(c, 0)); g.fillStyle = gl; g.fillRect(cx - ch, y + h - ch * 1.5, ch * 2, ch * 2); g.fillStyle = lin(g, cx - cw, 0, cx + cw, 0, [[0, lighten(c, 0.5)], [0.5, c], [1, darken(c, 0.5)]]); g.beginPath(); g.moveTo(cx - cw, y + h); g.lineTo(cx - cw * 0.7, y + h - ch * 0.8); g.lineTo(cx, y + h - ch); g.lineTo(cx + cw * 0.7, y + h - ch * 0.8); g.lineTo(cx + cw, y + h); g.fill(); }
      g.fillStyle = '#3a2c52'; g.beginPath(); g.ellipse(x + w / 2, y + h, w * 0.6, s * 0.12, 0, Math.PI, TAU); g.fill();
      break;
    }
    case 'pod': {
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#f1f5f9'], [0.45, '#cbd5e1'], [1, '#475569']]); g.beginPath(); g.roundRect(x, y, w, h, h * 0.45); g.fill(); g.strokeStyle = '#334155'; g.lineWidth = lw; g.stroke();
      g.fillStyle = '#f97316'; g.fillRect(x + w * 0.1, y + h * 0.42, w * 0.8, h * 0.12); g.fillStyle = '#0ea5e9'; for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.22 + k * 0.22), y + h * 0.18, w * 0.1, h * 0.14);
      g.fillStyle = Math.sin(sd.id) > 0 ? '#22c55e' : '#ef4444'; g.beginPath(); g.arc(x + w * 0.88, y + h * 0.75, s * 0.05, 0, TAU); g.fill();
      break;
    }
    case 'icecube': {
      g.fillStyle = lin(g, x, y, x + w, y + h, [[0, 'rgba(240,249,255,0.95)'], [0.4, 'rgba(147,197,253,0.85)'], [1, 'rgba(30,64,175,0.85)']]); g.beginPath(); g.roundRect(x, y, w, h, s * 0.08); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = lw; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.2); g.lineTo(x + w * 0.45, y + h * 0.6); g.lineTo(x + w * 0.4, y + h * 0.9); g.moveTo(x + w * 0.45, y + h * 0.6); g.lineTo(x + w * 0.75, y + h * 0.5); g.stroke(); // grietas
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + w * 0.08, y + h * 0.08, w * 0.3, Math.max(2, s * 0.06)); g.fillStyle = '#f8fbff'; g.beginPath(); g.ellipse(x + w / 2, y, w * 0.52, s * 0.1, 0, Math.PI, TAU); g.fill(); // nieve arriba
      break;
    }
    case 'snow': {
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#ffffff'], [0.6, '#dbeafe'], [1, '#93c5fd']]); g.beginPath(); g.moveTo(x - s * 0.1, y + h); g.quadraticCurveTo(x + w * 0.1, y - h * 0.1, x + w * 0.5, y - h * 0.05); g.quadraticCurveTo(x + w * 0.9, y - h * 0.1, x + w + s * 0.1, y + h); g.fill();
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + w * r(k), y + h * (0.2 + r(k + 1) * 0.5), s * 0.03, 0, TAU); g.fill(); }
      g.strokeStyle = '#5b3a1e'; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(x + w * 0.7, y + h * 0.1); g.lineTo(x + w * 0.85, y - h * 0.6); g.moveTo(x + w * 0.8, y - h * 0.3); g.lineTo(x + w * 0.92, y - h * 0.4); g.stroke(); // ramita
      break;
    }
    case 'obsidian': case 'boulder': {
      const ob = sd.look === 'obsidian';
      g.beginPath(); g.moveTo(x, y + h); for (let k = 0; k <= 10; k++) { const u = k / 10; g.lineTo(x + w * u, y + h * (0.05 + Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.55) + (r(k) - 0.5) * h * 0.15); } g.lineTo(x + w, y + h); g.closePath();
      g.fillStyle = ob ? lin(g, x, y, x + w, y + h, [[0, '#4b3a5a'], [0.4, '#1a1220'], [1, '#050307']]) : lin(g, x, y, x + w, y + h, [[0, '#d4d6dc'], [0.5, '#8e9099'], [1, '#4a4c55']]); g.fill();
      g.strokeStyle = ob ? 'rgba(255,120,40,0.85)' : 'rgba(0,0,0,0.3)'; g.lineWidth = lw; g.beginPath(); g.moveTo(x + w * 0.3, y + h * 0.3); g.lineTo(x + w * 0.4, y + h * 0.7); g.lineTo(x + w * 0.6, y + h * 0.9); if (ob) { g.moveTo(x + w * 0.7, y + h * 0.25); g.lineTo(x + w * 0.62, y + h * 0.6); } g.stroke();
      if (!ob) for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + w * (0.2 + r(k) * 0.6), y + h * (0.4 + r(k + 2) * 0.4), s * 0.08, s * 0.04, 0, 0, TAU); g.fill(); }
      else { g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.3); g.lineTo(x + w * 0.35, y + h * 0.15); g.lineTo(x + w * 0.3, y + h * 0.4); g.fill(); }
      break;
    }
    case 'basalt': {
      const n = 3; for (let k = 0; k < n; k++) { const cx = x + w * k / n, cw = w / n, ch = h * (0.75 + r(k) * 0.25); g.fillStyle = lin(g, cx, 0, cx + cw, 0, [[0, '#57534e'], [0.5, '#3a3530'], [1, '#1c1917']]); g.fillRect(cx, y + h - ch, cw - 1, ch); g.fillStyle = '#78716c'; g.beginPath(); g.moveTo(cx, y + h - ch); g.lineTo(cx + cw * 0.5, y + h - ch - s * 0.06); g.lineTo(cx + cw - 1, y + h - ch); g.fill(); }
      g.fillStyle = 'rgba(255,110,30,0.6)'; g.fillRect(x, y + h - s * 0.06, w, s * 0.06);
      break;
    }
    case 'log': {
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#7c5a3a'], [0.5, '#5a3e26'], [1, '#2e1f12']]); g.beginPath(); g.roundRect(x, y + h * 0.05, w, h * 0.95, h * 0.45); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = lw; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x + h * 0.4, y + h * (0.2 + k * 0.15)); g.quadraticCurveTo(x + w / 2, y + h * (0.15 + k * 0.15) + (r(k) - 0.5) * s * 0.1, x + w - h * 0.3, y + h * (0.2 + k * 0.15)); g.stroke(); } // corteza
      g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x + w - h * 0.3, y + h * 0.52, h * 0.3, h * 0.45, 0, 0, TAU); g.fill(); g.strokeStyle = '#8a6440'; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x + w - h * 0.3, y + h * 0.52, h * 0.3 * k / 4, h * 0.45 * k / 4, 0, 0, TAU); g.stroke(); } // anillos
      g.fillStyle = '#4d9a2f'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + w * (0.1 + r(k) * 0.6), y + h * 0.1, s * 0.12, s * 0.05, 0, 0, TAU); g.fill(); } // musgo
      g.fillStyle = '#f0abfc'; g.beginPath(); g.arc(x + w * 0.35, y, s * 0.07, Math.PI, TAU); g.fill(); // hongito
      break;
    }
    case 'stump': {
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#7c5a3a'], [0.5, '#5a3e26'], [1, '#2e1f12']]); g.beginPath(); g.moveTo(x - s * 0.1, y + h); g.lineTo(x, y + h * 0.15); g.lineTo(x + w, y + h * 0.15); g.lineTo(x + w + s * 0.1, y + h); g.fill();
      g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.15, w / 2, h * 0.15, 0, 0, TAU); g.fill(); g.strokeStyle = '#8a6440'; g.lineWidth = lw; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x + w / 2, y + h * 0.15, w / 2 * k / 4, h * 0.15 * k / 4, 0, 0, TAU); g.stroke(); }
      break;
    }
    case 'barrels': {
      for (const [bx, by, bw2, bh2] of [[0, 0.35, 0.5, 0.65], [0.5, 0.35, 0.5, 0.65], [0.25, 0, 0.5, 0.36]] as const) { const px = x + w * bx, py = y + h * by, pw = w * bw2, ph = h * bh2; g.fillStyle = lin(g, px, 0, px + pw, 0, [[0, '#7f1d1d'], [0.35, '#dc2626'], [1, '#450a0a']]); g.beginPath(); g.roundRect(px + 1, py, pw - 2, ph, s * 0.05); g.fill(); g.fillStyle = '#1f2937'; g.fillRect(px + 1, py + ph * 0.25, pw - 2, Math.max(1, s * 0.04)); g.fillRect(px + 1, py + ph * 0.72, pw - 2, Math.max(1, s * 0.04)); g.fillStyle = '#facc15'; g.beginPath(); g.moveTo(px + pw / 2, py + ph * 0.36); g.lineTo(px + pw * 0.62, py + ph * 0.62); g.lineTo(px + pw * 0.38, py + ph * 0.62); g.fill(); }
      break;
    }
    case 'tomb': {
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#6b7280'], [0.5, '#4b5563'], [1, '#1f2937']]); g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w * 0.5); g.arc(x + w / 2, y + w * 0.5, w / 2, Math.PI, TAU); g.lineTo(x + w, y + h); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.3); g.lineTo(x + w / 2, y + h * 0.7); g.moveTo(x + w * 0.3, y + h * 0.42); g.lineTo(x + w * 0.7, y + h * 0.42); g.stroke(); // cruz
      g.fillStyle = 'rgba(60,110,45,0.6)'; g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.95, w * 0.35, s * 0.08, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(165,180,252,0.35)'; g.lineWidth = lw; g.beginPath(); g.arc(x + w / 2, y + w * 0.5, w / 2 - lw, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
      break;
    }
    case 'altar': {
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#8a8466'], [0.5, '#6a6650'], [1, '#3e3c2e']]); g.fillRect(x + w * 0.05, y + h * 0.2, w * 0.9, h * 0.8); g.fillStyle = '#9a9474'; g.fillRect(x, y, w, h * 0.22);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = lw; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + w * (0.15 + k * 0.23), y + h * 0.35); g.lineTo(x + w * (0.15 + k * 0.23), y + h * 0.85); g.stroke(); } // tallado
      g.fillStyle = '#2f7a3a'; g.beginPath(); g.ellipse(x + w * 0.2, y + h * 0.22, w * 0.18, s * 0.05, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(125,211,252,0.8)'; g.beginPath(); g.arc(x + w / 2, y + h * 0.6, s * 0.08, 0, TAU); g.fill();
      break;
    }
    case 'column': {
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#a8a082'], [0.45, '#7a7458'], [1, '#3e3c2e']]); g.fillRect(x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.85); g.fillStyle = '#8a8466'; g.fillRect(x, y + h * 0.85, w, h * 0.15);
      g.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < 4; k++) g.fillRect(x + w * (0.22 + k * 0.16), y + h * 0.15, Math.max(1, s * 0.03), h * 0.7); // estrías
      g.fillStyle = '#7a7458'; g.beginPath(); g.moveTo(x + w * 0.15, y + h * 0.15); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.55, y + h * 0.1); g.lineTo(x + w * 0.85, y + h * 0.05); g.lineTo(x + w * 0.85, y + h * 0.15); g.fill(); // rota arriba
      break;
    }
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
// El arco visto de costado: el palo vertical en la boca, el travesaño que sale un tramo para atrás y la red que
// cae en curva hasta el piso en el fondo (con la malla que sigue la curva y se mueve un poco).
function drawGoal(ctx: CanvasRenderingContext2D, m: Match, v: View, left: boolean, front: boolean) {
  const side = teamAt(m, left), s = v.s, gh = goalHeight(m, side);
  const mouth = left ? GOAL_DEPTH : W - GOAL_DEPTH, back = left ? 0 : W, dir = left ? -1 : 1; // dir: hacia el fondo
  const L = LOOKS[m.fighters[side].char];
  const at = (u: number) => mouth + dir * u * GOAL_DEPTH;
  // la red se infla hacia atrás y tiembla cuando entra la pelota
  const hit = m.netHit && m.netHit.left === left ? m.netHit : null;
  const bulge = hit ? Math.exp(-hit.t * 2.2) * (0.35 + 0.25 * Math.sin(hit.t * 22)) : 0;
  const sway = Math.sin(m.time * 2 + side) * 0.04 + bulge * dir;
  const outline = () => { ctx.beginPath(); ctx.moveTo(X(v, mouth), Y(v, 0)); ctx.lineTo(X(v, mouth), Y(v, gh)); for (let k = 0; k <= 24; k++) { const u = k / 24; ctx.lineTo(X(v, at(u) + sway * u), Y(v, netTop(gh, u))); } ctx.lineTo(X(v, back), Y(v, 0)); ctx.closePath(); };
  // los hilos: los de atrás (finitos, detrás de la pelota) y los de adelante (por encima de la pelota y de quien esté adentro)
  const threads = (a: number, off: number) => {
    ctx.save(); outline(); ctx.clip();
    ctx.strokeStyle = `rgba(235,242,255,${a})`; ctx.lineWidth = Math.max(1, s * 0.022);
    for (let k = 1; k <= 7; k++) { const u = (k - off) / 7; ctx.beginPath(); ctx.moveTo(X(v, at(u * NET_FLAT)), Y(v, gh)); ctx.quadraticCurveTo(X(v, at(u * 0.5 + 0.2) + sway * 3), Y(v, netTop(gh, u) * 0.55), X(v, at(u) + sway * u), Y(v, 0)); ctx.stroke(); } // hilos que bajan
    for (let j = 1; j <= 11; j++) { const y = gh * (j - off) / 12; ctx.beginPath(); for (let k = 0; k <= 16; k++) { const u = k / 16, px = X(v, at(u) + sway * u * (y / gh)), py = Y(v, y - Math.sin(u * Math.PI) * 0.06); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); } // hilos que siguen la curva
    ctx.restore();
  };
  if (!front) {
    ctx.save();
    outline(); ctx.fillStyle = lin(ctx, X(v, mouth), 0, X(v, back), 0, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0.55)']]); ctx.fill();
    ctx.restore();
    threads(0.28, 0.5);
    ctx.fillStyle = lin(ctx, 0, Y(v, 0) - s * 0.08, 0, Y(v, 0), [[0, '#c7ced8'], [1, '#3b4250']]); ctx.fillRect(Math.min(X(v, mouth), X(v, back)), Y(v, 0) - s * 0.07, GOAL_DEPTH * s, s * 0.07); // caño del piso
    return;
  }
  threads(0.5, 0);
  ctx.strokeStyle = 'rgba(240,245,255,0.75)'; ctx.lineWidth = Math.max(1.2, s * 0.035); ctx.beginPath(); for (let k = 0; k <= 24; k++) { const u = k / 24; const px = X(v, at(u) + sway * u), py = Y(v, netTop(gh, u)); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); // el borde de la red
  // travesaño: un caño corto que va de la boca hacia atrás, con brillo arriba
  const tb = at(NET_FLAT), bxA = Math.min(X(v, mouth), X(v, tb)), bw = Math.abs(X(v, tb) - X(v, mouth));
  ctx.beginPath(); ctx.roundRect(bxA - s * 0.08, Y(v, gh + BAR), bw + s * 0.16, BAR * s, BAR * s / 2);
  ctx.fillStyle = lin(ctx, 0, Y(v, gh + BAR), 0, Y(v, gh), [[0, '#ffffff'], [0.45, '#d5dbe4'], [1, '#5b6472']]); ctx.fill(); ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1; ctx.stroke();
  // palo vertical en la boca, de punta a punta, con base
  const pw = 0.2 * s, px = X(v, mouth) - pw / 2;
  ctx.beginPath(); ctx.roundRect(px, Y(v, gh + BAR), pw, (gh + BAR) * s, pw / 2);
  ctx.fillStyle = lin(ctx, px, 0, px + pw, 0, [[0, '#4b5260'], [0.3, '#ffffff'], [0.55, '#d5dbe4'], [1, '#2f3542']]); ctx.fill(); ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2a2f3a'; ctx.fillRect(px - pw * 0.4, Y(v, 0) - s * 0.08, pw * 1.8, s * 0.08);
  for (let k = 1; k < 6; k++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, Y(v, gh * k / 6), pw, 1); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(L.glow, 0.35 + 0.15 * Math.sin(m.time * 3)); ctx.fillRect(X(v, mouth) - s * 0.03, Y(v, gh), s * 0.06, gh * s);
  bloom(ctx, X(v, mouth), Y(v, gh), s * 0.8, L.glow, 0.35);
  ctx.restore();
  if ((m.fighters[side === 0 ? 1 : 0].powers.giant ?? 0) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(249,115,22,${0.5 + 0.4 * Math.sin(m.time * 10)})`; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(X(v, mouth), Y(v, 0)); ctx.lineTo(X(v, mouth), Y(v, gh)); for (let k = 0; k <= 16; k++) ctx.lineTo(X(v, at(k / 16)), Y(v, netTop(gh, k / 16))); ctx.stroke(); ctx.restore(); }
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
// El rastro de la pelota según el escenario: electricidad en los tecnológicos, fuego en el volcán y el desierto,
// viento blanco en el hielo, hojas que brillan en el bosque y el templo, burbujas en el mar, nubecitas en el cielo,
// fantasmas en el foso, rayos en la tormenta, polvo de estrellas en la Luna y arena en el coliseo.
type TrailStyle = 'volt' | 'fire' | 'wind' | 'leaf' | 'bubble' | 'cloud' | 'ghost' | 'dust' | 'star';
const TRAIL: Record<StageId, [TrailStyle, string, string]> = {
  industrial: ['volt', '#38bdf8', '#e0f2fe'], mines: ['volt', '#e879f9', '#fae8ff'], base: ['volt', '#22d3ee', '#ecfeff'], factory: ['volt', '#fbbf24', '#fef9c3'], subway: ['volt', '#facc15', '#fefce8'],
  storm: ['volt', '#a5b4fc', '#ffffff'], volcano: ['fire', '#f97316', '#fde047'], desert: ['fire', '#fb923c', '#fef3c7'], ice: ['wind', '#e0f2fe', '#ffffff'],
  forest: ['leaf', '#a3e635', '#67e8f9'], temple: ['leaf', '#4ade80', '#fde68a'], ocean: ['bubble', '#a5f3fc', '#ffffff'], sky: ['cloud', '#ffffff', '#fde68a'],
  pit: ['ghost', '#a78bfa', '#ede9fe'], coliseum: ['dust', '#e8b96a', '#fff7ed'], moon: ['star', '#cbd5e1', '#ffffff'],
};
function drawStageTrail(ctx: CanvasRenderingContext2D, m: Match, v: View, speed: number) {
  const tr = m.trail; if (tr.length < 3 || speed < 1.2) return;
  const [style, c1, c2] = TRAIL[m.stage], s = v.s, t = m.time, k0 = Math.min(1, speed / 10), r = BALL_R * s;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = tr.map(([px, py]) => [X(v, px), Y(v, py)] as const);
  switch (style) {
    case 'volt': { ctx.globalCompositeOperation = 'lighter';
      for (const [w, a, col] of [[r * 1.1, 0.25, c1], [Math.max(1.5, r * 0.28), 0.9, c2]] as const) { ctx.strokeStyle = alpha(col, a * k0); ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([px, py], i) => { const j = i === 0 ? 0 : (hash(i * 7.3 + Math.floor(t * 30)) - 0.5) * r * 1.4; if (i) ctx.lineTo(px + j, py + j * 0.7); else ctx.moveTo(px, py); }); ctx.stroke(); }
      for (let i = 2; i < pts.length; i += 3) if (hash(i + Math.floor(t * 20)) < 0.6) { const [px, py] = pts[i]; ctx.strokeStyle = alpha(c2, 0.8 * k0); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (hash(i * 3 + t) - 0.5) * r * 3, py + (hash(i * 5 + t) - 0.5) * r * 3); ctx.stroke(); } // chispas que saltan
      break; }
    case 'fire': { ctx.globalCompositeOperation = 'lighter';
      pts.forEach(([px, py], i) => { const k = 1 - i / pts.length, rr = r * (0.4 + k * 1.1) * (0.85 + 0.3 * hash(i + Math.floor(t * 25))); const g = ctx.createRadialGradient(px, py - rr * 0.3, 0, px, py, rr); g.addColorStop(0, alpha(c2, 0.85 * k * k0)); g.addColorStop(0.5, alpha(c1, 0.55 * k * k0)); g.addColorStop(1, alpha('#7f1d1d', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py - i * r * 0.06, rr, 0, TAU); ctx.fill(); });
      break; }
    case 'wind': {
      for (let l = -1; l <= 1; l++) { ctx.strokeStyle = alpha(c2, (0.55 - Math.abs(l) * 0.2) * k0); ctx.lineWidth = Math.max(1, r * (0.35 - Math.abs(l) * 0.12)); ctx.beginPath(); pts.forEach(([px, py], i) => { const o = l * r * (0.6 + i * 0.08) + Math.sin(t * 8 + i * 0.7 + l) * r * 0.2; if (i) ctx.lineTo(px, py + o); else ctx.moveTo(px, py + o); }); ctx.stroke(); }
      ctx.fillStyle = alpha('#ffffff', 0.9 * k0); for (let i = 1; i < pts.length; i += 2) { const [px, py] = pts[i]; ctx.beginPath(); ctx.arc(px + (hash(i * 3.1) - 0.5) * r * 2, py + (hash(i * 7.7) - 0.5) * r * 2, Math.max(1, r * 0.12), 0, TAU); ctx.fill(); } // copos
      break; }
    case 'leaf': case 'star': case 'dust': case 'cloud': case 'ghost': case 'bubble': {
      if (style === 'leaf' || style === 'star' || style === 'ghost') ctx.globalCompositeOperation = 'lighter';
      pts.forEach(([px, py], i) => { if (!i) return; const k = 1 - i / pts.length, jx = (hash(i * 4.1 + (style === 'bubble' ? 0 : Math.floor(t * 6))) - 0.5) * r * 1.6, jy = (hash(i * 6.7) - 0.5) * r * 1.6 + (style === 'bubble' ? -i * r * 0.15 : 0), x2 = px + jx, y2 = py + jy, a = k * k0;
        switch (style) {
          case 'leaf': ctx.fillStyle = alpha(i % 2 ? c1 : c2, 0.8 * a); ctx.beginPath(); ctx.ellipse(x2, y2, r * 0.32, r * 0.14, t * 4 + i, 0, TAU); ctx.fill(); break;
          case 'star': ctx.fillStyle = alpha(c2, 0.9 * a); ctx.fillRect(x2 - 1, y2 - r * 0.3, 2, r * 0.6); ctx.fillRect(x2 - r * 0.3, y2 - 1, r * 0.6, 2); break;
          case 'dust': ctx.fillStyle = alpha(c1, 0.45 * a); ctx.beginPath(); ctx.arc(x2, py + jy * 0.4, r * (0.3 + (1 - k) * 0.9), 0, TAU); ctx.fill(); break;
          case 'cloud': ctx.fillStyle = alpha(c1, 0.6 * a); ctx.beginPath(); ctx.arc(x2, y2, r * (0.4 + (1 - k) * 0.7), 0, TAU); ctx.fill(); if (i % 3 === 0) { ctx.fillStyle = alpha(c2, a); ctx.fillRect(x2, y2, 2, 2); } break;
          case 'ghost': { const g = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * (0.5 + (1 - k))); g.addColorStop(0, alpha(c2, 0.5 * a)); g.addColorStop(1, alpha(c1, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x2, y2, r * (0.5 + (1 - k)), 0, TAU); ctx.fill(); break; }
          case 'bubble': ctx.strokeStyle = alpha(c2, 0.8 * a); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x2, y2, r * (0.15 + hash(i) * 0.25), 0, TAU); ctx.stroke(); break;
        } });
      break; }
  }
  ctx.restore();
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
  if (!fat) drawStageTrail(ctx, m, v, speed);
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
  const s = v.s, x = X(v, sh.x), y = Y(v, sh.y), r = sh.r * s * 1.6, t = m.time, ang = Math.atan2(-sh.vy, sh.vx), owner = CHARS[m.fighters[sh.side].char]; // (dibujado bien grande)
  ctx.save();
  { // estela y halo grandes del color del luchador (para que el disparo se vea mucho)
    ctx.globalCompositeOperation = 'lighter'; const L2 = r * 14, ex = x - Math.cos(ang) * L2, ey = y - Math.sin(ang) * L2;
    const sg = ctx.createLinearGradient(x, y, ex, ey); sg.addColorStop(0, alpha(owner.glow, 0.7)); sg.addColorStop(1, alpha(owner.color, 0)); ctx.strokeStyle = sg; ctx.lineCap = 'round'; ctx.lineWidth = r * 1.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = r * 0.6; ctx.strokeStyle = alpha('#ffffff', 0.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * L2 * 0.5, y - Math.sin(ang) * L2 * 0.5); ctx.stroke();
    bloom(ctx, x, y, r * 12, owner.glow, 0.85); bloom(ctx, x, y, r * 4, '#ffffff', 0.5);
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + t * 6; ctx.strokeStyle = alpha(owner.glow, 0.6); ctx.lineWidth = Math.max(1, r * 0.15); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3); ctx.lineTo(x + Math.cos(a) * r * 2.6, y + Math.sin(a) * r * 2.6); ctx.stroke(); } // rayos que giran
    ctx.globalCompositeOperation = 'source-over';
  }
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
    case 'wave': { // onda expansiva: dos anillos, rayos que salen y un destello
      const cx = X(v, e.x), cy = Y(v, e.y), a = 1 - k, R = s * 7 * Math.pow(k, 0.5);
      ctx.strokeStyle = alpha(owner.glow, 0.9 * a); ctx.lineWidth = s * 0.35 * a; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = alpha('#ffffff', 0.8 * a); ctx.lineWidth = s * 0.12 * a; ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, TAU); ctx.stroke();
      for (let j = 0; j < 14; j++) { const an = j * TAU / 14 + e.x; ctx.strokeStyle = alpha(j % 2 ? owner.glow : '#ffffff', 0.8 * a); ctx.lineWidth = Math.max(1, s * 0.08); ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * R * 0.5, cy + Math.sin(an) * R * 0.5); ctx.lineTo(cx + Math.cos(an) * R * 1.3, cy + Math.sin(an) * R * 1.3); ctx.stroke(); }
      bloom(ctx, cx, cy, s * 4 * a + s, '#ffffff', 0.6 * a);
      break;
    }
    default: break;
  }
  if (e.kind !== 'cloud' && e.kind !== 'magma') bloom(ctx, X(v, e.x), Y(v, e.y), s * 6, owner.glow, 0.8 * (1 - k)); // halo extra (grande)
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
      if (!under) paintEmitterMount(ctx, m.stage, x, -H - 1, top - 0.36);
      paintEmitter(ctx, STRUCT[m.stage].emitter, x, top - 0.36, false, on, warn, color, t);
      paintEmitter(ctx, STRUCT[m.stage].emitter, x, base - 0.3, true, on, warn, color, t);
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
// La barrita que se llena mientras se mantiene apretada la barra espaciadora (verde → amarillo → rojo).
function drawChargeMeter(ctx: CanvasRenderingContext2D, charge: number, x: number, y: number, s: number, glow: string, t: number) {
  const k = Math.min(1, charge), w = s * 1.3, h = Math.max(5, s * 0.16);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, h / 2 + 2); ctx.fill();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#22c55e'); g.addColorStop(0.55, '#facc15'); g.addColorStop(1, '#ef4444');
  ctx.save(); ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, h / 2); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w * k, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w / 2, y, w * k, h * 0.4); ctx.restore();
  if (k >= 1) { ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y + h / 2, w * 0.7, glow, 0.35 + 0.25 * Math.sin(t * 20)); }
  ctx.restore();
}
// Ascensores, plataformas que van y vienen y pistones (se dibujan en cada cuadro porque se mueven).
function drawMover(ctx: CanvasRenderingContext2D, m: Match, sd: Solid, v: View) {
  const mv = sd.move!, T = THEMES[m.stage], s = v.s, x = X(v, sd.x), w = sd.w * s, top = Y(v, sd.y + sd.h), gy = Y(v, 0);
  ctx.save();
  if (mv.kind === 'lift') paintLiftDrive(ctx, m.stage, x, w, top, Y(v, mv.y0 + mv.ay + 0.6), gy, s, m.time, T.edge); // rieles, poleas, burbujas o magia según el planeta
  if (mv.kind === 'slide') { // riel de arriba (de acero, soga o cadena; los mágicos flotan solos)
    const ry = Y(v, sd.y + 2.2), xa = X(v, mv.x0 - Math.abs(mv.ax)), xb = X(v, mv.x0 + Math.abs(mv.ax)) + w;
    paintSlideRail(ctx, m.stage, xa, xb, ry, [x + w * 0.2, x + w * 0.8], top, s);
  }
  if (mv.kind === 'piston') { // cilindro que sale del piso (de metal, o columna de piedra o de roca con magma)
    const k = (sd.h - mv.h0) / Math.max(0.01, mv.ah), stone = m.stage === 'temple' || m.stage === 'desert' || m.stage === 'volcano';
    ctx.fillStyle = m.stage === 'volcano' ? lin(ctx, x + w * 0.2, 0, x + w * 0.8, 0, [[0, '#1a0f0c'], [0.4, '#4a3530'], [1, '#120a08']]) : stone ? lin(ctx, x + w * 0.2, 0, x + w * 0.8, 0, [[0, '#6b6046'], [0.4, '#c9b98e'], [1, '#4f4632']]) : lin(ctx, x + w * 0.2, 0, x + w * 0.8, 0, [[0, '#2b3240'], [0.35, '#d5dce6'], [0.6, '#7b8698'], [1, '#1b2130']]); ctx.fillRect(x + w * 0.22, top + s * 0.2, w * 0.56, gy - top - s * 0.2);
    if (m.stage === 'volcano') { ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(x + w * 0.45, top + s * 0.3); ctx.lineTo(x + w * 0.55, top + s * 0.7); ctx.lineTo(x + w * 0.42, gy); ctx.stroke(); }
    else if (stone) { ctx.strokeStyle = 'rgba(60,45,20,0.5)'; ctx.lineWidth = Math.max(1, s * 0.02); for (let yy = top + s * 0.5; yy < gy; yy += s * 0.4) { ctx.beginPath(); ctx.moveTo(x + w * 0.22, yy); ctx.lineTo(x + w * 0.78, yy); ctx.stroke(); } }
    else { ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(s, s); hazardStripes(ctx, sd.x, -(sd.y + sd.h), sd.w, 0.22, 0.3); ctx.restore(); }
    if (k > 0.05 && k < 0.98) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const d = (m.time * 1.8 + i / 6) % 1; ctx.fillStyle = `rgba(230,236,245,${0.25 * (1 - d)})`; ctx.beginPath(); ctx.arc(x + w * (i % 2 ? -0.05 : 1.05), gy - s * (0.1 + d * 0.9), s * (0.12 + d * 0.25), 0, TAU); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(m.time * 10)})`; ctx.beginPath(); ctx.arc(x + w / 2, top + s * 0.11, s * 0.06, 0, TAU); ctx.fill();
  }
  paintSolid(ctx, m.stage, sd, v);
  if (mv.kind !== 'piston' && STRUCT[m.stage].thrusters) { // propulsores debajo (solo en los escenarios con naves)
    ctx.globalCompositeOperation = 'lighter';
    for (const px of [x + w * 0.25, x + w * 0.75]) { const g = ctx.createRadialGradient(px, top + sd.h * s, 0, px, top + sd.h * s, s * 0.45); g.addColorStop(0, alpha(T.edge, 0.7)); g.addColorStop(1, alpha(T.edge, 0)); ctx.fillStyle = g; ctx.fillRect(px - s * 0.45, top + sd.h * s - s * 0.1, s * 0.9, s * 0.6); }
  }
  ctx.restore();
}
// ---------------------------------------------------------------- La sangre y los huesos del árbitro
const BLOOD = '#8a0303', BLOOD_L = '#c1121f', BONE = '#efe6cf';
function drawStains(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const g = m.gore; if (!g.stains.length) return;
  for (const st of g.stains) {
    const age = m.time - st.at, a = Math.max(0, Math.min(1, (40 - age) / 8)); if (a <= 0) continue;
    const x = X(v, st.x), y = Y(v, st.y), r = st.r * v.s * Math.min(1, 0.4 + age * 3);
    ctx.globalAlpha = a; ctx.fillStyle = st.r > 0.15 ? BLOOD : BLOOD_L; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const an = Math.PI + (i / 11) * Math.PI, rr = r * (0.75 + hash(st.seed * 50 + i) * 0.5); ctx.lineTo(x + Math.cos(an) * rr * 1.6, y + Math.sin(an) * rr * 0.35); }
    ctx.closePath(); ctx.fill();
    if (st.seed > 0.7) { ctx.fillRect(x + r * 0.3, y, Math.max(1, r * 0.15), r * (0.6 + st.seed)); } // chorrito que cae del borde
  }
  ctx.globalAlpha = 1;
}
function drawGib(ctx: CanvasRenderingContext2D, kind: GibKind, c = '#9ca3af') {
  const bone = (x0: number, y0: number, x1: number, y1: number, w: number) => { ctx.strokeStyle = BONE; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); for (const [px, py] of [[x0, y0], [x1, y1]]) { ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(px, py - w * 0.4, w * 0.75, 0, TAU); ctx.arc(px, py + w * 0.4, w * 0.75, 0, TAU); ctx.fill(); } };
  switch (kind) {
    case 'plate': { // un pedazo de armadura del color del luchador, abollado y con sangre
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-0.17, -0.08); ctx.lineTo(0.12, -0.12); ctx.lineTo(0.18, 0.04); ctx.lineTo(0.02, 0.12); ctx.lineTo(-0.15, 0.08); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.02; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-0.12, -0.07, 0.2, 0.025);
      ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.ellipse(0.06, 0.05, 0.07, 0.04, 0.3, 0, TAU); ctx.fill(); break;
    }
    case 'skull':
      ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(0, -0.04, 0.2, 0, TAU); ctx.fill(); ctx.fillRect(-0.12, 0.05, 0.24, 0.12);
      ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.ellipse(-0.075, -0.02, 0.055, 0.065, 0, 0, TAU); ctx.ellipse(0.075, -0.02, 0.055, 0.065, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0.05); ctx.lineTo(-0.025, 0.1); ctx.lineTo(0.025, 0.1); ctx.fill();
      for (let k = 0; k < 4; k++) ctx.fillRect(-0.09 + k * 0.055, 0.13, 0.012, 0.05);
      ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.ellipse(0.12, 0.12, 0.08, 0.05, 0.5, 0, TAU); ctx.fill(); break;
    case 'jaw': bone(-0.12, 0, 0.12, 0, 0.05); ctx.fillStyle = BONE; for (let k = 0; k < 4; k++) ctx.fillRect(-0.08 + k * 0.05, -0.07, 0.025, 0.05); break;
    case 'ribs':
      bone(0, -0.22, 0, 0.22, 0.05); ctx.strokeStyle = BONE; ctx.lineWidth = 0.035; for (let k = 0; k < 4; k++) { const y = -0.15 + k * 0.1; ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(0.22, y - 0.02, 0.2, y + 0.1); ctx.moveTo(0, y); ctx.quadraticCurveTo(-0.22, y - 0.02, -0.2, y + 0.1); ctx.stroke(); }
      ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.ellipse(0.05, 0.05, 0.08, 0.12, 0, 0, TAU); ctx.fill(); break;
    case 'pelvis': ctx.fillStyle = BONE; ctx.beginPath(); ctx.ellipse(-0.1, 0, 0.12, 0.09, -0.4, 0, TAU); ctx.ellipse(0.1, 0, 0.12, 0.09, 0.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.arc(-0.1, 0.01, 0.035, 0, TAU); ctx.arc(0.1, 0.01, 0.035, 0, TAU); ctx.fill(); break;
    case 'bone': bone(-0.17, 0, 0.17, 0, 0.055); ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.arc(0.05, 0.01, 0.035, 0, TAU); ctx.fill(); break;
    case 'chunk': ctx.fillStyle = BLOOD_L; ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k * TAU / 7, rr = 0.09 + hash(k * 3.1) * 0.06; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.fillStyle = BLOOD; ctx.beginPath(); ctx.arc(0.02, 0.02, 0.05, 0, TAU); ctx.fill(); break;
    case 'shirt': ctx.fillStyle = '#f4f4f5'; ctx.fillRect(-0.16, -0.1, 0.32, 0.2); ctx.fillStyle = '#111114'; for (let k = 0; k < 3; k++) ctx.fillRect(-0.12 + k * 0.1, -0.1, 0.04, 0.2); ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.ellipse(0.06, 0.04, 0.09, 0.06, 0, 0, TAU); ctx.fill(); break;
  }
}
function drawGore(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const g = m.gore; if (!g.drops.length && !g.gibs.length) return;
  for (const b of g.gibs) { ctx.save(); ctx.translate(X(v, b.x), Y(v, b.y)); ctx.scale(v.s * 1.2, v.s * 1.2); ctx.rotate(b.a); drawGib(ctx, b.kind, b.c); ctx.restore(); }
  ctx.fillStyle = BLOOD_L;
  for (const d of g.drops) { ctx.beginPath(); ctx.arc(X(v, d.x), Y(v, d.y), Math.max(1, d.r * v.s), 0, TAU); ctx.fill(); }
}
export function drawMatch(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * v.s * 0.5, (Math.random() - 0.5) * m.shake * v.s * 0.5);
  const bg = background(m, v);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = THEMES[m.stage].sky[1]; ctx.fillRect(0, 0, v.w, v.h); }
  drawAmbient(ctx, m.stage, v.w, v.h, Y(v, 0), v.s, m.time);
  for (const h of m.hazards) if (h.kind === 'waterfall') drawHazard(ctx, h, m, v);
  for (const sd of m.solids) if (sd.move) drawMover(ctx, m, sd, v);
  for (const sd of m.solids) if (sd.kind === 'bumper') paintBumper(ctx, sd.bump ?? 'neon', X(v, sd.x), Y(v, sd.y + sd.h), sd.w * v.s, sd.h * v.s, v.s, m.time, m.time - (sd.hit ?? -9));
  drawStains(ctx, m, v);
  for (const h of m.hazards) if (h.kind === 'lava' || h.kind === 'conveyor' || h.kind === 'spikes' || h.kind === 'shock' || h.kind === 'saw' || (h.kind === 'flame' && h.state < 2)) drawHazard(ctx, h, m, v);
  drawGoal(ctx, m, v, true, false); drawGoal(ctx, m, v, false, false);
  for (const h of m.hazards) if (h.kind === 'laser' || h.kind === 'mine') drawHazard(ctx, h, m, v);
  // árbitro
  const r = m.ref;
  if (r.action !== 'gone') drawRefLit(ctx, r, m.time + 0.7, X(v, r.x), Y(v, r.y), v.s, THEMES[m.stage].light);
  // luchadores
  for (const f of m.fighters) {
    if (f.gone) continue; // reventado por el rayo
    const L = LOOKS[f.char], x = X(v, f.x), y = Y(v, f.y);
    const fatalNow = m.phase === 'fatal' && m.fatal?.side === f.side;
    drawFighterLit(ctx, f, m.time + f.side * 0.37, {
      power: f.power / POWER_MAX, frozen: f.stun > 0 && f.stunKind === 'freeze', poison: f.poison > 0 || (f.stun > 0 && f.stunKind === 'poison'), burn: (f.stun > 0 && f.stunKind === 'burn') || (f.char === 'brutoRed' && f.abilityT > 0),
      zap: f.stun > 0 && f.stunKind === 'zap', shield: (f.powers.shield ?? 0) > 0, speed: (f.powers.speed ?? 0) > 0,
      aura: fatalNow || f.power >= POWER_MAX ? L.glow : null,
    }, x, y, v.s, THEMES[m.stage].light);
    if (f.charge > 0) drawChargeMeter(ctx, f.charge, x, Y(v, f.y + heightOf(f) + 0.25), v.s, L.glow, m.time);
  }
  drawGore(ctx, m, v);
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
    drawFighterLit(ctx, f, m.time, { power: 1, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: L.glow }, X(v, f.x), Y(v, f.y), v.s, L.glow);
  }
  if (m.strike) drawFighterStrike(ctx, m.strike, m, v);
  if (m.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${m.flash * 0.45})`; ctx.fillRect(0, 0, v.w, v.h); }
  if (m.tint) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha(m.tint.c, Math.min(0.22, m.tint.t * 0.7)); ctx.fillRect(0, 0, v.w, v.h); ctx.restore(); }
  const vg = ctx.createRadialGradient(v.w / 2, v.h * 0.55, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h * 0.55, Math.max(v.w, v.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  if (m.screenBlood.length) drawScreenBlood(ctx, m.screenBlood, v);
  ctx.restore();
}
// ---------------------------------------------------------------- El rayo que revienta a un luchador
// Un rayo de verdad: el camino se arma partiendo cada tramo en dos y corriendo el medio para un costado (así
// queda quebrado a todas las escalas), con ramas que se abren hacia abajo. Antes de caer bajan "líderes"
// finitos que tantean el camino; después la descarga principal pega varias veces seguidas (parpadea) y se apaga.
// Se dibuja en capas: un halo ancho del color, una franja media y el centro casi blanco.
function boltPath(x0: number, y0: number, x1: number, y1: number, rough: number, depth: number, rnd: () => number): [number, number][] {
  let pts: [number, number][] = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      const off = (rnd() - 0.5) * len * rough;
      next.push([(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off], pts[i]);
    }
    pts = next;
  }
  return pts;
}
function strokeBolt(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, color: string, a: number, upTo = 1) {
  const n = Math.max(2, Math.floor(pts.length * upTo));
  const line = () => { ctx.beginPath(); for (let i = 0; i < n; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); } ctx.stroke(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = alpha(color, 0.12 * a); ctx.lineWidth = w * 7; line();
  ctx.strokeStyle = alpha(color, 0.3 * a); ctx.lineWidth = w * 3; line();
  ctx.strokeStyle = alpha(color, 0.85 * a); ctx.lineWidth = w * 1.4; line();
  ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`; ctx.lineWidth = Math.max(1, w * 0.55); line();
}
function drawFighterStrike(ctx: CanvasRenderingContext2D, st: Strike, m: Match, v: View) {
  const tt = st.t - st.at; if (tt < -0.32 || tt > 0.9) return;
  const col = st.color === 'green' ? '#39ff14' : '#ff1744', s = v.s;
  const gx = X(v, st.x), gy = Y(v, st.y), w = Math.max(2, s * 0.09);
  let seed = st.seed + Math.floor((tt + 1) * 30); // el camino cambia de a poco (parpadea)
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 100000) / 100000; };
  let seed0 = st.seed; const rnd0 = () => { seed0 = (seed0 * 16807 + 11) % 2147483647; return (seed0 % 100000) / 100000; }; // el camino principal casi no cambia
  const top = -s * 0.5, x0 = gx + (rnd0() - 0.5) * s * 6;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (tt < 0) { // líderes: bajan tanteando y la pantalla parpadea
    const k = (tt + 0.32) / 0.32;
    ctx.fillStyle = alpha(col, 0.05 * k * (rnd() < 0.5 ? 1 : 0.3)); ctx.fillRect(0, 0, v.w, v.h);
    for (let b = 0; b < 3; b++) strokeBolt(ctx, boltPath(x0 + (b - 1) * s * 0.8, top, gx + (rnd() - 0.5) * s * 3, gy, 0.55, 6, rnd), w * 0.35, col, 0.55 * k, k * (0.6 + b * 0.15));
    ctx.restore(); return;
  }
  // la descarga: pega fuerte, vuelve a pegar dos veces y se apaga
  const pulse = Math.max(Math.exp(-tt * 9), 0.85 * Math.exp(-Math.abs(tt - 0.13) * 30), 0.7 * Math.exp(-Math.abs(tt - 0.27) * 30)) * (tt > 0.5 ? Math.max(0, 1 - (tt - 0.5) / 0.4) : 1);
  const main = boltPath(x0, top, gx, gy, 0.42, 8, rnd0);
  // ramas que salen del camino principal hacia abajo
  for (let b = 0; b < 7; b++) {
    const i = Math.floor((0.1 + rnd0() * 0.7) * main.length), [bx, by] = main[i], len = (gy - by) * (0.25 + rnd0() * 0.4), ang = Math.PI / 2 + (rnd0() - 0.5) * 1.6;
    strokeBolt(ctx, boltPath(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 0.6, 5, rnd), w * 0.4, col, pulse * (0.5 + rnd() * 0.4));
  }
  strokeBolt(ctx, main, w * (1 + pulse * 0.6), col, Math.min(1, 0.25 + pulse));
  // el impacto: bola de luz, anillo en el piso y la pantalla iluminada del color
  bloom(ctx, gx, gy - s * 0.4, s * (2.5 + pulse * 3), col, 0.9 * pulse);
  bloom(ctx, gx, gy - s * 0.4, s * 0.9, '#ffffff', 0.8 * pulse);
  ctx.strokeStyle = alpha(col, 0.6 * pulse); ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.ellipse(gx, gy, s * (0.8 + tt * 6), s * (0.2 + tt * 1.5), 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = alpha(col, 0.12 * pulse); ctx.fillRect(0, 0, v.w, v.h);
  ctx.restore();
  // la marca quemada en el piso
  ctx.fillStyle = `rgba(10,10,10,${0.45 * Math.min(1, tt * 4)})`; ctx.beginPath(); ctx.ellipse(gx, gy, s * 0.9, s * 0.16, 0, 0, TAU); ctx.fill();
}
// La sangre en la cámara: cada mancha aparece de golpe, es irregular y brillante, tiene gotitas alrededor y
// chorrea hacia abajo de a poco; a los segundos se va borrando.
function drawScreenBlood(ctx: CanvasRenderingContext2D, list: ScreenBlood[], v: View) {
  const U = Math.min(v.w, v.h * 1.7);
  ctx.save();
  for (const b of list) {
    if (b.t < 0) continue;
    const a = b.t < 3 ? 1 : Math.max(0, 1 - (b.t - 3) / 2), grow = Math.min(1, b.t / 0.06), cx = b.x * v.w, cy = b.y * v.h, r = b.r * U * grow;
    ctx.globalAlpha = a * 0.9;
    // los chorros que bajan despacio
    for (let k = 0; k < b.drips; k++) {
      const dx = cx + (hash(b.seed + k * 7) - 0.5) * r, len = Math.min(r * (1.2 + hash(b.seed + k) * 3), b.t * r * (0.4 + hash(b.seed + k * 3) * 0.8)), dw = r * (0.09 + hash(b.seed + k * 5) * 0.08);
      ctx.fillStyle = '#7a0000'; ctx.beginPath(); ctx.moveTo(dx - dw, cy); ctx.quadraticCurveTo(dx - dw * 0.5, cy + len * 0.6, dx - dw * 0.7, cy + len); ctx.arc(dx, cy + len, dw * 0.85, Math.PI, 0, true); ctx.quadraticCurveTo(dx + dw * 0.5, cy + len * 0.6, dx + dw, cy); ctx.closePath(); ctx.fill();
    }
    // la mancha: borde redondeado e irregular, oscura en el borde y brillante en el medio
    const gr = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r * 1.1);
    gr.addColorStop(0, '#c8101e'); gr.addColorStop(0.6, '#8a0303'); gr.addColorStop(1, '#4a0000');
    ctx.fillStyle = gr; ctx.beginPath();
    const N = 12, pt = (k: number) => { const ang = (k % N) / N * TAU, rr = r * (0.75 + hash(b.seed + (k % N) * 13) * 0.4); return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]; };
    const mid = (k: number) => { const [ax, ay] = pt(k), [bx, by] = pt(k + 1); return [(ax + bx) / 2, (ay + by) / 2]; };
    const [sx, sy] = mid(0); ctx.moveTo(sx, sy);
    for (let k = 1; k <= N; k++) { const [px, py] = pt(k), [qx, qy] = mid(k); ctx.quadraticCurveTo(px, py, qx, qy); }
    ctx.closePath(); ctx.fill();
    // gotitas salpicadas alrededor
    ctx.fillStyle = '#8a0303';
    for (let k = 0; k < 8; k++) { const ang = hash(b.seed + k * 3.7) * TAU, d = r * (1.15 + hash(b.seed + k * 5.3) * 1.2), rr = r * (0.04 + hash(b.seed + k * 9.1) * 0.09); ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, rr, 0, TAU); ctx.fill(); }
    // el brillo (está sobre el vidrio de la cámara)
    ctx.fillStyle = 'rgba(255,220,220,0.3)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.26, r * 0.1, -0.6, 0, TAU); ctx.fill();
  }
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

// ---------------------------------------------------------------- Pared de la pantalla de selección
// Ladrillos gris oscuro con textura: cada uno con su tono, grano de piedra, bordes gastados con luz arriba y
// sombra abajo, algunas grietas y astillas, y la mezcla oscura entre ladrillos. Se hace una vez (un mosaico).
let brickURL: string | null = null, brickTile: HTMLCanvasElement | null = null;
export function brickWallURL(): string | null {
  if (brickURL || typeof document === 'undefined') return brickURL;
  const W0 = 512, H0 = 384, c = document.createElement('canvas'); c.width = W0; c.height = H0;
  const g = c.getContext('2d'); if (!g) return null;
  g.fillStyle = '#151614'; g.fillRect(0, 0, W0, H0); // la mezcla (casi negra)
  const bh = 48, gap = 6;
  const id = g.getImageData(0, 0, W0, H0), d = id.data;
  for (let row = 0; row < H0 / bh; row++) {
    // ladrillos de largo distinto en cada fila (como la pared de Mortal Kombat 3), que cierran justo en el borde
    const c0 = hash(row * 17.3) * 90, cuts: number[] = []; let acc = c0;
    while (acc < c0 + W0 - 70) { cuts.push(acc); acc += 80 + hash(row * 7.1 + cuts.length * 3.3) * 70; }
    cuts.push(c0 + W0); // el último cierra justo donde empieza el primero (el mosaico no tiene costura)
    for (let k = 0; k < cuts.length - 1; k++) {
      const x0 = cuts[k], x1 = cuts[k + 1], y0 = row * bh, tone = 40 + hash(row * 31 + k * 7 + 3) * 12;
      for (let y = y0 + gap / 2; y < y0 + bh - gap / 2; y++) for (let x = x0 + gap / 2; x < x1 - gap / 2; x++) {
        const px = ((Math.floor(x) % W0) + W0) % W0, py = Math.floor(y); if (py < 0 || py >= H0) continue;
        const top = y - y0 - gap / 2, bot = y0 + bh - gap / 2 - y, lef = x - x0 - gap / 2, rig = x1 - gap / 2 - x;
        const n = hash(px * 0.913 + py * 1.731) * 0.45 + hash(Math.floor(px / 4) * 3.1 + Math.floor(py / 3) * 7.7) * 0.55; // piedra granulada
        let v = tone + (n - 0.5) * 30;
        if (top < 3) v += 22 - top * 4; else if (top < 7) v += 6; // borde de arriba con luz
        if (lef < 3) v += 12 - lef * 3;
        if (bot < 4) v -= 14 - bot * 2; if (rig < 3) v -= 8; // abajo y a la derecha en sombra
        if (Math.min(top, bot, lef, rig) < 1.2 && hash(px * 3.3 + py) < 0.5) v -= 18; // esquinas gastadas
        const k4 = (py * W0 + px) * 4; d[k4] = v; d[k4 + 1] = v + 1.5; d[k4 + 2] = v - 2; d[k4 + 3] = 255;
      }
    }
  }
  g.putImageData(id, 0, 0);
  // grietas y astillas
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
  for (let k = 0; k < 9; k++) { let x = hash(k * 5.3) * W0, y = hash(k * 9.1) * H0; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (hash(k * 3 + j) - 0.5) * 18; y += (hash(k * 7 + j) - 0.3) * 10; g.lineTo(x, y); } g.stroke(); }
  for (let k = 0; k < 22; k++) { const x = hash(k * 2.7 + 1) * W0, y = hash(k * 4.9 + 2) * H0, r = 2 + hash(k) * 4; g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.arc(x - 1, y - 1, r * 0.6, 0, Math.PI * 2); g.fill(); }
  brickURL = c.toDataURL('image/png'); brickTile = c;
  return brickURL;
}
// La pared del menú: los mismos ladrillos pero rotos, con agujeros oscuros de bordes astillados, grietas que salen
// para afuera, pedazos sueltos y escombros abajo de cada agujero.
let brokenURL: string | null = null;
export function brokenWallURL(): string | null {
  if (brokenURL || typeof document === 'undefined') return brokenURL;
  brickWallURL(); if (!brickTile) return null;
  const W0 = 1280, H0 = 800, c = document.createElement('canvas'); c.width = W0; c.height = H0;
  const g = c.getContext('2d'); if (!g) return null;
  const tile = 0.85; // los ladrillos un poco más chicos
  for (let y = 0; y < H0; y += brickTile.height * tile) for (let x = 0; x < W0; x += brickTile.width * tile) g.drawImage(brickTile, x, y, brickTile.width * tile, brickTile.height * tile);
  const holes: [number, number, number][] = [[0.12, 0.22, 120], [0.86, 0.16, 95], [0.07, 0.8, 85], [0.9, 0.74, 140], [0.5, 0.93, 60], [0.33, 0.06, 45]];
  holes.forEach(([hx, hy, R], n) => {
    const cx = W0 * hx, cy = H0 * hy, pts: [number, number][] = [];
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, rr = R * (0.62 + hash(n * 31 + k) * 0.45); const row = 41 * tile; pts.push([cx + Math.cos(a) * rr, Math.round((cy + Math.sin(a) * rr * 0.8) / row) * row]); } // bordes que siguen las filas de ladrillos
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    // grietas que salen del agujero
    g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 1.6;
    for (let k = 0; k < 9; k++) { const a = hash(n * 7 + k) * Math.PI * 2; let x = cx + Math.cos(a) * R * 0.8, y = cy + Math.sin(a) * R * 0.65; g.beginPath(); g.moveTo(x, y); const L = R * (0.5 + hash(n + k * 3) * 0.9); for (let j = 0; j < 6; j++) { x += Math.cos(a + (hash(n + k + j * 5) - 0.5) * 1.2) * L / 6; y += Math.sin(a + (hash(n * 3 + k + j) - 0.5) * 1.2) * L / 6; g.lineTo(x, y); } g.stroke(); }
    // el borde astillado: una franja clara (la cara rota de los ladrillos) y el hueco negro con profundidad
    g.save(); g.translate(5, 6); path(); g.fillStyle = '#6b6a63'; g.fill(); g.restore();
    g.save(); g.translate(-3, -3); path(); g.fillStyle = '#26261f'; g.fill(); g.restore();
    path(); const hg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05); hg.addColorStop(0, '#000000'); hg.addColorStop(0.7, '#050505'); hg.addColorStop(1, '#141412'); g.fillStyle = hg; g.fill();
    g.save(); path(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy + R * 0.1, R * (0.25 + k * 0.15), R * (0.18 + k * 0.1), 0, 0, Math.PI * 2); g.stroke(); } g.restore(); // un poco de fondo adentro
    // pedazos de ladrillo sueltos en el borde y escombros abajo
    for (let k = 0; k < 8; k++) { const a = hash(n * 13 + k) * Math.PI * 2, d = R * (0.8 + hash(n + k) * 0.25), px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.8, sz = 8 + hash(k * 3 + n) * 14; g.fillStyle = `rgb(${52 + hash(k + n) * 20},${53 + hash(k + n) * 20},${50 + hash(k + n) * 18})`; g.beginPath(); g.moveTo(px, py); g.lineTo(px + sz, py + sz * 0.2); g.lineTo(px + sz * 0.8, py + sz * 0.7); g.lineTo(px - sz * 0.1, py + sz * 0.6); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px, py, sz * 0.8, 2); }
    for (let k = 0; k < 14; k++) { const px = cx + (hash(n * 5 + k) - 0.5) * R * 1.6, py = cy + R * 0.85 + hash(n * 9 + k) * R * 0.35, sz = 4 + hash(k + n * 2) * 10; g.fillStyle = `rgb(${46 + hash(k) * 25},${46 + hash(k) * 25},${44 + hash(k) * 22})`; g.beginPath(); g.ellipse(px, py, sz, sz * 0.6, hash(k) * 3, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(px + 2, py + sz * 0.5, sz, sz * 0.25, 0, 0, Math.PI * 2); g.fill(); }
  });
  brokenURL = c.toDataURL('image/jpeg', 0.9);
  return brokenURL;
}

// ---------------------------------------------------------------- Fondo de la escalera del torneo
// Un remolino violeta como un portal (el "elegí tu destino" de los juegos de pelea): bandas de nubes que giran en
// espiral hacia un centro oscuro, con brillos. Se hace una vez.
let vortex: string | null = null;
export function vortexURL(): string | null {
  if (vortex || typeof document === 'undefined') return vortex;
  const W0 = 960, H0 = 600, cx = W0 * 0.5, cy = H0 * 0.42;
  const c = pixels(W0, H0, (x, y) => {
    const dx = (x - cx) / W0, dy = (y - cy) / H0 * 0.75, r = Math.hypot(dx, dy) + 1e-3, a = Math.atan2(dy, dx);
    const sw = a + 3.4 / (r * 5 + 0.45); // espiral
    const n = fbm(Math.cos(sw) * r * 7 + 3, Math.sin(sw) * r * 7, 7, 5), bands = 0.5 + 0.5 * Math.sin(sw * 4 + r * 22 + n * 5);
    const v = Math.min(1, n * 0.8 + bands * 0.45) * Math.min(1, r * 2.6); // el centro es oscuro
    const col = ramp([[0, '#05030f'], [0.35, '#2e1065'], [0.6, '#6d28d9'], [0.8, '#a78bfa'], [1, '#ede9fe']], v);
    return [col[0], col[1], col[2], 255];
  });
  vortex = c.toDataURL('image/jpeg', 0.9);
  return vortex;
}
