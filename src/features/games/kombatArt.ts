// Cómo se ve Kombat Football: la cámara de costado fija con los dos arcos siempre a la vista, el estadio de cada
// escenario (fondo pintado con hinchada, luces y su paisaje), la cancha, los arcos con red, los luchadores, la
// pelota (y sus versiones especiales), las habilidades, los peligros, los potenciadores y los efectos.
// El mundo se mide en metros (kombat.ts); acá se pasa a píxeles: x a la derecha, y para arriba.
import {
  BALLS, BALL_R, BAR, CHARS, GOAL_DEPTH, H, POWERS, PH, W, fatalPath, goalHeight,
  type Ball, type Hazard, type Match, type Particle, type PowerKind, type Shield, type Shot, type StageId,
} from './kombat';
import { drawFighterBody, LOOKS } from './kombatFighters';
import { alpha, bloom, darken, grain, hash, lighten, lin, shade, spec } from './gravityMonsters';
import { fbm } from './gravityBackdrops';

const TAU = Math.PI * 2;
export interface View { w: number; h: number; s: number; ox: number; oy: number }
// Escala y desplazamiento para que la cancha (con un poco de tribuna arriba) entre siempre entera y centrada.
export function viewFor(w: number, h: number): View {
  const s = Math.min(w / (W + 0.5), h / (H + 1.0));
  return { w, h, s, ox: (w - W * s) / 2, oy: h - 0.85 * s };
}
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;

interface Theme { sky: [string, string, string]; far: string; mid: string; ground: string; groundTop: string; edge: string; light: string; crowd: string[]; fog: string }
export const THEMES: Record<StageId, Theme> = {
  city: { sky: ['#0b1426', '#1d2c4d', '#36507a'], far: '#1c2740', mid: '#121a2c', ground: '#1d2a14', groundTop: '#3ddc5a', edge: '#86efac', light: '#fde68a', crowd: ['#2a3550', '#3b4a6b', '#4b5d82'], fog: 'rgba(80,120,160,0.12)' },
  factory: { sky: ['#141821', '#2a2f3b', '#463f3a'], far: '#22252d', mid: '#16181e', ground: '#2b2622', groundTop: '#8a6a3a', edge: '#f59e0b', light: '#fbbf24', crowd: ['#3a3430', '#4a423b', '#5c5247'], fog: 'rgba(160,120,80,0.12)' },
  volcano: { sky: ['#1a0604', '#4a1208', '#8a2a0a'], far: '#3a0f08', mid: '#220806', ground: '#1f0c08', groundTop: '#ff6a1a', edge: '#fdba74', light: '#fb923c', crowd: ['#3b1410', '#552018', '#6e2c1d'], fog: 'rgba(255,90,30,0.14)' },
  glacier: { sky: ['#0d1b33', '#28466e', '#5a7fab'], far: '#3c5f8a', mid: '#25456d', ground: '#7fa8d6', groundTop: '#e0f2fe', edge: '#bae6fd', light: '#e0f2fe', crowd: ['#2b4568', '#3b5b84', '#5072a0'], fog: 'rgba(220,240,255,0.15)' },
  lab: { sky: ['#06141a', '#0d2a33', '#16404a'], far: '#0f2b33', mid: '#0a1c22', ground: '#1a262b', groundTop: '#5eead4', edge: '#99f6e4', light: '#a5f3fc', crowd: ['#1d3238', '#28444c', '#355860'], fog: 'rgba(80,220,200,0.08)' },
  space: { sky: ['#03040c', '#0b0f26', '#1a1c44'], far: '#1b2038', mid: '#11152a', ground: '#262b3d', groundTop: '#93c5fd', edge: '#bfdbfe', light: '#c7d2fe', crowd: ['#2a3150', '#3a4268', '#4c5582'], fog: 'rgba(120,140,255,0.08)' },
  graveyard: { sky: ['#07060f', '#1a1630', '#33294f'], far: '#1c1830', mid: '#120f20', ground: '#1d1a14', groundTop: '#5b7a3a', edge: '#a3e635', light: '#e9d5ff', crowd: ['#241f36', '#30294a', '#3e365f'], fog: 'rgba(170,160,220,0.16)' },
  storm: { sky: ['#0a0d14', '#1f2633', '#3a4456'], far: '#1e2430', mid: '#131820', ground: '#22262e', groundTop: '#94a3b8', edge: '#e2e8f0', light: '#e0e7ff', crowd: ['#262c38', '#323a4a', '#40495d'], fog: 'rgba(160,170,190,0.14)' },
  desert: { sky: ['#3a1d0e', '#a14a1c', '#f0a050'], far: '#a8642e', mid: '#7a4420', ground: '#9c6a32', groundTop: '#f2c46b', edge: '#fde68a', light: '#fff1c1', crowd: ['#6b3d1e', '#835029', '#9e6534'], fog: 'rgba(255,200,120,0.14)' },
  arena: { sky: ['#06020f', '#1d0b3a', '#3d1670'], far: '#2a1150', mid: '#170932', ground: '#140a24', groundTop: '#a855f7', edge: '#e9d5ff', light: '#d8b4fe', crowd: ['#2a1848', '#38215e', '#4a2d78'], fog: 'rgba(170,90,255,0.12)' },
};

// ---------------------------------------------------------------- El estadio de fondo (se pinta una vez)
const bgCache = new Map<string, HTMLCanvasElement | null>();
function background(stage: StageId, v: View): HTMLCanvasElement | null {
  const key = `${stage}:${Math.round(v.w)}x${Math.round(v.h)}`;
  if (bgCache.has(key)) return bgCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.w)); c.height = Math.max(1, Math.round(v.h));
  const g = c.getContext('2d');
  if (!g) { bgCache.set(key, null); return null; }
  if (bgCache.size > 6) bgCache.clear();
  paintBackground(g, stage, v);
  bgCache.set(key, c);
  return c;
}
// Nubes / humo / nebulosa pintados con ruido fractal en baja resolución (después se estiran suave).
function cloudLayer(stage: StageId, w: number, h: number, ground: number): HTMLCanvasElement | null {
  const cw = Math.max(1, Math.round(w / 4)), ch = Math.max(1, Math.round(ground / 4));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); if (!g) return null;
  const img = g.createImageData(cw, ch), seed = stage.length * 7 + stage.charCodeAt(0);
  const col: Record<StageId, [number, number, number, number]> = {
    city: [70, 90, 130, 0.55], factory: [110, 100, 92, 0.6], volcano: [120, 40, 20, 0.7], glacier: [190, 215, 240, 0.55], lab: [40, 110, 110, 0.35],
    space: [90, 70, 170, 0.45], graveyard: [90, 80, 130, 0.55], storm: [90, 100, 120, 0.85], desert: [255, 190, 130, 0.35], arena: [150, 60, 220, 0.55],
  };
  const [cr, cg, cb, ca] = col[stage];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const u = x / cw * 6, v = y / ch * 3;
    const n = fbm(u + fbm(u * 0.5, v * 0.5, seed + 3, 3) * 1.5, v * 1.6, seed, 5);
    const d = Math.max(0, Math.min(1, (n - 0.45) * 3.2)) * (stage === 'space' || stage === 'arena' ? 1 : 1 - y / ch * 0.5);
    const light = Math.max(0, Math.min(1, (fbm(u + 0.15, v - 0.2, seed, 4) - n) * 6 + 0.5));
    const i = (y * cw + x) * 4;
    img.data[i] = Math.min(255, cr * (0.6 + light * 0.7)); img.data[i + 1] = Math.min(255, cg * (0.6 + light * 0.7)); img.data[i + 2] = Math.min(255, cb * (0.6 + light * 0.7)); img.data[i + 3] = 255 * d * ca;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function paintBackground(g: CanvasRenderingContext2D, stage: StageId, v: View) {
  const T = THEMES[stage], s = v.s, w = v.w, h = v.h, ground = Y(v, 0);
  const r = (n: number) => hash(n * 1.37 + stage.length * 11.1);
  const standsTop = ground - s * 3.2;
  // cielo
  g.fillStyle = lin(g, 0, 0, 0, ground, [[0, T.sky[0]], [0.6, T.sky[1]], [1, T.sky[2]]]); g.fillRect(0, 0, w, h);
  if (stage === 'space' || stage === 'arena' || stage === 'graveyard' || stage === 'city') for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + r(k) * 0.7})`; const sz = r(k + 3) < 0.08 ? 2 : 1; g.fillRect(r(k + 1) * w, r(k + 2) * standsTop * 0.85, sz, sz); }
  // luna / sol / planeta
  if (stage === 'graveyard' || stage === 'city' || stage === 'storm') {
    const mx = w * (stage === 'graveyard' ? 0.78 : 0.2), my = standsTop * 0.22, mr = s * (stage === 'graveyard' ? 1.5 : 0.85);
    const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 5); mg.addColorStop(0, 'rgba(220,225,255,0.4)'); mg.addColorStop(1, 'rgba(220,225,255,0)'); g.fillStyle = mg; g.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    const md = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr); md.addColorStop(0, '#fbfbff'); md.addColorStop(1, '#b9bdd6'); g.fillStyle = md; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,125,160,0.35)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(mx + (r(k + 9) - 0.5) * mr * 1.2, my + (r(k + 10) - 0.5) * mr * 1.2, mr * 0.18 * (0.4 + r(k)), 0, TAU); g.fill(); }
  }
  if (stage === 'desert') { const sx = w * 0.68, sy = standsTop * 0.55, sg = g.createRadialGradient(sx, sy, 0, sx, sy, s * 9); sg.addColorStop(0, 'rgba(255,248,220,1)'); sg.addColorStop(0.07, 'rgba(255,225,160,0.9)'); sg.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, ground); }
  if (stage === 'space') { const px = w * 0.74, py = standsTop * 0.35, pr = s * 2.8, pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); pg.addColorStop(0, '#bfe4ff'); pg.addColorStop(0.45, '#3a73b8'); pg.addColorStop(1, '#081226'); g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip(); g.fillStyle = 'rgba(70,140,80,0.5)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(px + (r(k + 20) - 0.5) * pr * 1.4, py + (r(k + 21) - 0.5) * pr * 1.4, pr * 0.35, pr * 0.2, r(k) * 3, 0, TAU); g.fill(); } g.restore(); g.strokeStyle = 'rgba(200,230,255,0.4)'; g.lineWidth = s * 0.18; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.33, -0.3, 0.2, Math.PI + 0.3); g.stroke(); }
  // nubes / humo / nebulosa
  const clouds = cloudLayer(stage, w, h, standsTop);
  if (clouds) { g.imageSmoothingEnabled = true; g.drawImage(clouds, 0, 0, w, standsTop); }
  const haze = (a: number) => { g.fillStyle = lin(g, 0, 0, 0, standsTop, [[0, alpha(T.sky[1], 0)], [1, alpha(T.sky[2], a)]]); g.fillRect(0, 0, w, standsTop + s); };
  // siluetas de la ciudad (o del paisaje) en capas, cada una más oscura y cerca
  const skyline = (base: number, color: string, scale: number, lit: number, seed: number) => {
    let x = -s;
    while (x < w + s) {
      const bw = s * (1 + r(seed + x) * 2) * scale, bh = s * (2.5 + r(seed + x * 1.3) * 5.5) * scale;
      g.fillStyle = color; g.fillRect(x, base - bh, bw, bh + s);
      if (r(seed + x * 2.7) < 0.3) { g.fillRect(x + bw * 0.2, base - bh - s * 0.6 * scale, bw * 0.5, s * 0.6 * scale); }
      if (r(seed + x * 2.1) < 0.3) { g.fillRect(x + bw * 0.45, base - bh - s * 1.6 * scale, Math.max(1, s * 0.06), s * 1.6 * scale); if (r(seed + x) < 0.5) { g.fillStyle = '#ff3b3b'; g.fillRect(x + bw * 0.45 - 1, base - bh - s * 1.6 * scale, 3, 3); g.fillStyle = color; } }
      if (lit > 0) for (let yy = base - bh + s * 0.35 * scale; yy < base - s * 0.2; yy += s * 0.38 * scale) for (let xx = x + s * 0.15 * scale; xx < x + bw - s * 0.15 * scale; xx += s * 0.32 * scale) if (r(xx * 3.3 + yy * 1.7) < lit) { g.fillStyle = `rgba(${T.light === '#fde68a' || T.light === '#fbbf24' ? '255,214,140' : '200,220,255'},${0.25 + r(xx + yy) * 0.55})`; g.fillRect(xx, yy, s * 0.13 * scale, s * 0.17 * scale); }
      x += bw + s * 0.15 * r(seed + x);
    }
  };
  const tower = (x: number, base: number, hgt: number, color: string) => { // torre de alta tensión
    g.strokeStyle = color; g.lineWidth = Math.max(1, s * 0.07);
    const top = base - hgt, wb = s * 1.1;
    g.beginPath(); g.moveTo(x - wb, base); g.lineTo(x - s * 0.18, top); g.lineTo(x + s * 0.18, top); g.lineTo(x + wb, base); g.stroke();
    for (let k = 1; k < 9; k++) { const yy = base - hgt * k / 9, ww = wb * (1 - k / 9) + s * 0.18; g.beginPath(); g.moveTo(x - ww, yy); g.lineTo(x + ww, yy - hgt / 9); g.moveTo(x + ww, yy); g.lineTo(x - ww, yy - hgt / 9); g.stroke(); }
    for (const yy of [top + s * 0.5, top + s * 1.4]) { g.beginPath(); g.moveTo(x - s * 1.3, yy); g.lineTo(x + s * 1.3, yy); g.stroke(); }
  };
  switch (stage) {
    case 'city': case 'storm': skyline(standsTop + s * 0.2, darken(T.far, -0.0), 1.2, 0.25, 1); haze(0.5); skyline(standsTop + s * 0.6, T.mid, 1.45, 0.18, 2); break;
    case 'factory': skyline(standsTop, T.far, 1.1, 0.04, 3); haze(0.45);
      for (let k = 0; k < 4; k++) { const cx = w * (0.12 + k * 0.25), ch = s * (5.5 + r(k + 5) * 2.5); g.fillStyle = lin(g, cx, 0, cx + s * 0.9, 0, [[0, T.mid], [0.4, lighten(T.mid, 0.12)], [1, darken(T.mid, 0.3)]]); g.fillRect(cx, standsTop - ch, s * 0.9, ch + s); g.fillStyle = '#a14a1a'; g.fillRect(cx, standsTop - ch + s * 0.4, s * 0.9, s * 0.25); for (let j = 0; j < 7; j++) { const sg = g.createRadialGradient(cx + s * 0.45 + j * s * 0.5, standsTop - ch - j * s * 0.7, 0, cx + s * 0.45 + j * s * 0.5, standsTop - ch - j * s * 0.7, s * (0.6 + j * 0.3)); sg.addColorStop(0, 'rgba(120,110,100,0.35)'); sg.addColorStop(1, 'rgba(120,110,100,0)'); g.fillStyle = sg; g.fillRect(cx - s * 3, standsTop - ch - s * 7, s * 8, s * 8); } }
      skyline(standsTop + s * 0.6, T.mid, 1.3, 0.03, 4); break;
    case 'volcano': for (let k = 0; k < 3; k++) { const vx = w * (0.18 + k * 0.33 + r(k + 60) * 0.08), vy = standsTop - s * (2.2 + r(k + 61) * 1.4) * (k === 1 ? 1.35 : 1), vw = s * (3.2 + r(k) * 1.5) * (k === 1 ? 1.3 : 1); g.fillStyle = lin(g, vx, vy, vx, standsTop, [[0, '#1a0604'], [1, '#0c0302']]); g.beginPath(); g.moveTo(vx - vw, standsTop + s); g.quadraticCurveTo(vx - vw * 0.3, vy + s, vx - vw * 0.15, vy); g.lineTo(vx + vw * 0.15, vy); g.quadraticCurveTo(vx + vw * 0.3, vy + s, vx + vw, standsTop + s); g.fill(); const lg = g.createRadialGradient(vx, vy, 0, vx, vy, vw * 0.3); lg.addColorStop(0, 'rgba(255,170,60,0.85)'); lg.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = lg; g.fillRect(vx - vw, vy - vw, vw * 2, vw * 2); const sm = g.createRadialGradient(vx, vy - s * 1.5, 0, vx, vy - s * 1.5, vw * 0.6); sm.addColorStop(0, 'rgba(40,15,10,0.6)'); sm.addColorStop(1, 'rgba(40,15,10,0)'); g.fillStyle = sm; g.fillRect(vx - vw, vy - s * 1.5 - vw, vw * 2, vw * 2); g.strokeStyle = 'rgba(255,110,30,0.75)'; g.lineWidth = Math.max(1, s * 0.07); g.beginPath(); g.moveTo(vx - s * 0.1, vy); g.quadraticCurveTo(vx - vw * 0.12, vy + s * 0.8, vx - vw * 0.22, vy + s * 1.6); g.moveTo(vx + s * 0.1, vy); g.quadraticCurveTo(vx + vw * 0.1, vy + s * 1, vx + vw * 0.18, vy + s * 1.9); g.stroke(); g.strokeStyle = 'rgba(255,120,40,0.25)'; g.lineWidth = Math.max(1, s * 0.03); g.beginPath(); g.moveTo(vx - vw * 0.15, vy); g.quadraticCurveTo(vx - vw * 0.3, vy + s, vx - vw, standsTop + s); g.stroke(); } haze(0.2); skyline(standsTop + s * 0.6, '#140504', 0.55, 0.03, 12); break;
    case 'glacier': for (let k = 0; k < 5; k++) { const mx = w * (k * 0.24 + r(k + 70) * 0.1), mh = s * (4 + r(k + 71) * 2.5), mw = s * (5 + r(k + 72) * 2.5); g.fillStyle = lin(g, mx, standsTop - mh, mx + mw * 0.3, standsTop, [[0, '#f4faff'], [0.3, '#a9cdee'], [1, '#2f5585']]); g.beginPath(); g.moveTo(mx - mw, standsTop + s); g.lineTo(mx - mw * 0.2, standsTop - mh * 0.8); g.lineTo(mx, standsTop - mh); g.lineTo(mx + mw * 0.25, standsTop - mh * 0.75); g.lineTo(mx + mw, standsTop + s); g.fill(); g.fillStyle = 'rgba(40,80,130,0.35)'; g.beginPath(); g.moveTo(mx, standsTop - mh); g.lineTo(mx + mw * 0.25, standsTop - mh * 0.75); g.lineTo(mx + mw, standsTop + s); g.lineTo(mx + mw * 0.1, standsTop + s); g.fill(); } haze(0.4); for (let k = 0; k < 7; k++) { const ix = w * r(k + 30), iw = s * (1.5 + r(k + 31) * 2), ih = s * (1.5 + r(k + 32) * 2.5); g.fillStyle = lin(g, ix, standsTop - ih, ix + iw, standsTop, [[0, '#dff1ff'], [0.5, '#7fb2df'], [1, '#2a5486']]); g.beginPath(); g.moveTo(ix, standsTop + s); g.lineTo(ix + iw * 0.1, standsTop - ih); g.lineTo(ix + iw * 0.6, standsTop - ih * 0.85); g.lineTo(ix + iw, standsTop + s); g.fill(); } break;
    case 'lab': g.fillStyle = '#081a20'; g.fillRect(0, 0, w, standsTop + s); for (let k = 0; k < 8; k++) { const tx = w * (k + 0.5) / 8, th = s * 4.2, tw = s * 1.1; g.fillStyle = '#0f2a31'; g.fillRect(tx - tw / 2 - s * 0.1, standsTop - th - s * 0.3, tw + s * 0.2, th + s * 0.6); g.fillStyle = lin(g, 0, standsTop - th, 0, standsTop, [[0, 'rgba(45,212,191,0.15)'], [1, 'rgba(45,212,191,0.6)']]); g.fillRect(tx - tw / 2, standsTop - th * 0.85, tw, th * 0.85); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(tx - tw / 2 + s * 0.1, standsTop - th * 0.85, s * 0.12, th * 0.85); g.fillStyle = 'rgba(210,255,250,0.55)'; for (let j = 0; j < 7; j++) { g.beginPath(); g.arc(tx + (r(k * 9 + j) - 0.5) * tw * 0.7, standsTop - r(k * 7 + j) * th * 0.75, s * 0.05, 0, TAU); g.fill(); } } g.strokeStyle = '#163a42'; g.lineWidth = s * 0.15; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, standsTop - s * (5.2 + k * 0.4)); g.lineTo(w, standsTop - s * (5.2 + k * 0.4)); g.stroke(); } break;
    case 'space': g.fillStyle = '#121729'; g.fillRect(0, standsTop - s * 0.8, w, s * 2); for (let k = 0; k <= 6; k++) { const fx = w * k / 6; g.fillStyle = lin(g, fx - s * 0.35, 0, fx + s * 0.35, 0, [[0, '#2a3048'], [0.5, '#3b4466'], [1, '#141a2c']]); g.fillRect(fx - s * 0.35, 0, s * 0.7, standsTop); } g.fillStyle = '#1a2036'; g.fillRect(0, 0, w, s * 0.6); break;
    case 'graveyard': { skyline(standsTop + s * 0.3, '#161227', 1.1, 0.02, 8); haze(0.45); for (let k = 0; k < 12; k++) { const tx = w * r(k + 80), ty = standsTop + s * 0.5; g.fillStyle = '#0f0c1a'; g.beginPath(); g.roundRect(tx, ty - s * (0.7 + r(k) * 0.7), s * 0.55, s * 1.5, [s * 0.28, s * 0.28, 0, 0]); g.fill(); if (r(k + 5) < 0.4) { g.fillRect(tx + s * 0.22, ty - s * 1.9, s * 0.1, s * 0.7); g.fillRect(tx + s * 0.07, ty - s * 1.7, s * 0.4, s * 0.1); } } const branch = (x: number, y: number, len: number, ang: number, wd: number, depth: number, seed: number) => { const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; g.strokeStyle = '#0a0812'; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r(seed) - 0.5) * len * 0.3, (y + y2) / 2, x2, y2); g.stroke(); if (depth > 0) for (let j = 0; j < 2 + (r(seed + 1) < 0.4 ? 1 : 0); j++) branch(x2, y2, len * (0.6 + r(seed + j * 3) * 0.2), ang + (r(seed + j * 5 + 2) - 0.5) * 1.3 + (j === 0 ? -0.3 : 0.3), wd * 0.62, depth - 1, seed * 3 + j + 1); };
      for (let k = 0; k < 3; k++) branch(w * (0.12 + k * 0.38), standsTop + s, s * 2, -Math.PI / 2 + (r(k + 50) - 0.5) * 0.4, s * 0.3, 5, k + 3); break; }
    case 'desert': for (let k = 0; k < 3; k++) { g.fillStyle = lin(g, 0, standsTop - s * 2, 0, standsTop + s, [[0, lighten(T.far, 0.1 - k * 0.1)], [1, darken(T.far, 0.2 + k * 0.1)]]); g.beginPath(); g.moveTo(0, standsTop + s); for (let x = 0; x <= w; x += s * 0.5) g.lineTo(x, standsTop - s * (1.5 - k * 0.5) - Math.sin(x / s * 0.35 + k * 2) * s * 0.9 - Math.sin(x / s * 0.9 + k) * s * 0.3); g.lineTo(w, h); g.lineTo(0, h); g.fill(); } for (let k = 0; k < 2; k++) { const px = w * (0.22 + k * 0.5), ph = s * 3.2; g.fillStyle = darken(T.mid, 0.25); for (let j = 0; j < 4; j++) { if (r(k * 4 + j) < 0.25) continue; g.fillRect(px + j * s * 0.9, standsTop - ph * (0.6 + r(j + k) * 0.4), s * 0.6, ph); } g.fillRect(px - s * 0.2, standsTop - ph, s * 3.6, s * 0.45); } break;
    case 'arena': for (let k = 0; k < 9; k++) { const ax = w * (k + 0.5) / 9, ah = s * 5; g.fillStyle = lin(g, ax - s * 0.5, 0, ax + s * 0.5, 0, [[0, '#120624'], [0.5, '#2a1150'], [1, '#0c0418']]); g.fillRect(ax - s * 0.5, standsTop - ah, s, ah + s); g.fillStyle = 'rgba(192,132,252,0.6)'; g.fillRect(ax - s * 0.06, standsTop - ah, s * 0.12, ah); const ag = g.createRadialGradient(ax, standsTop - ah, 0, ax, standsTop - ah, s * 1.2); ag.addColorStop(0, 'rgba(216,180,254,0.8)'); ag.addColorStop(1, 'rgba(168,85,247,0)'); g.fillStyle = ag; g.fillRect(ax - s * 1.2, standsTop - ah - s * 1.2, s * 2.4, s * 2.4); } for (let k = 0; k < 5; k++) { const rx = w * r(k + 90), ry = standsTop * (0.2 + r(k + 91) * 0.4), rr = s * (0.4 + r(k) * 0.6); g.fillStyle = '#1a0d2e'; g.beginPath(); for (let j = 0; j < 7; j++) { const a = j * TAU / 7; g.lineTo(rx + Math.cos(a) * rr * (0.7 + r(k * 7 + j) * 0.4), ry + Math.sin(a) * rr * 0.7); } g.fill(); } break;
  }
  if (stage === 'city' || stage === 'storm' || stage === 'factory') { tower(w * 0.1, standsTop + s * 0.3, s * 6.5, '#0b0f18'); tower(w * 0.9, standsTop + s * 0.3, s * 6.5, '#0b0f18'); g.strokeStyle = 'rgba(5,7,12,0.85)'; g.lineWidth = 1; for (const k of [0, 0.9]) { g.beginPath(); g.moveTo(w * 0.1, standsTop - s * (6 - k)); g.quadraticCurveTo(w * 0.5, standsTop - s * (3.8 - k), w * 0.9, standsTop - s * (6 - k)); g.stroke(); } }
  // reflectores del estadio
  for (const fx of [0.05, 0.95]) {
    const lx = w * fx, ly = standsTop - s * 4.6;
    g.fillStyle = '#07090e'; g.fillRect(lx - s * 0.07, ly, s * 0.14, s * 5);
    g.fillStyle = '#141821'; g.fillRect(lx - s * 0.65, ly - s * 0.55, s * 1.3, s * 0.65);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = '#fffdf0'; g.fillRect(lx - s * 0.56 + i * s * 0.4, ly - s * 0.47 + j * s * 0.28, s * 0.3, s * 0.2); }
    const lg = g.createRadialGradient(lx, ly - s * 0.25, 0, lx, ly - s * 0.25, s * 2); lg.addColorStop(0, alpha(T.light, 0.6)); lg.addColorStop(1, alpha(T.light, 0)); g.fillStyle = lg; g.fillRect(lx - s * 2, ly - s * 2.25, s * 4, s * 4);
    const cone = g.createLinearGradient(lx, ly, lx, ground); cone.addColorStop(0, alpha(T.light, 0.22)); cone.addColorStop(1, alpha(T.light, 0));
    g.fillStyle = cone; g.beginPath(); g.moveTo(lx - s * 0.5, ly); g.lineTo(lx + s * 0.5, ly); g.lineTo(lx + (fx < 0.5 ? 1 : -1) * s * 11, ground); g.lineTo(lx + (fx < 0.5 ? 1 : -1) * s * 3, ground); g.closePath(); g.fill();
  }
  // tribuna con la hinchada: siluetas en penumbra con el borde iluminado por los reflectores
  const rows = 8, rowH = (ground - s * 0.55 - standsTop) / rows;
  g.fillStyle = darken(T.mid, 0.45); g.fillRect(0, standsTop, w, ground - standsTop);
  for (let row = 0; row < rows; row++) {
    const yy = standsTop + row * rowH, depth = row / rows;
    g.fillStyle = darken(T.mid, 0.55 - depth * 0.15); g.fillRect(0, yy + rowH * 0.78, w, rowH * 0.22);
    for (let x = -s * 0.1; x < w; x += s * 0.22) {
      const k = row * 977 + Math.round(x), col = T.crowd[Math.floor(r(k) * T.crowd.length)], hy = yy + rowH * 0.2 + r(k + 1) * rowH * 0.12, px = x + (r(k + 5) - 0.5) * s * 0.06;
      const body = darken(col, 0.35 - depth * 0.2);
      g.fillStyle = body; g.beginPath(); g.roundRect(px, hy + s * 0.1, s * 0.19, rowH * 0.65, s * 0.05); g.fill();
      g.beginPath(); g.arc(px + s * 0.095, hy + s * 0.05, s * 0.07, 0, TAU); g.fill();
      if (r(k + 6) < 0.18) { g.strokeStyle = body; g.lineWidth = s * 0.045; g.beginPath(); g.moveTo(px + s * 0.03, hy + s * 0.15); g.lineTo(px - s * 0.04, hy - s * 0.12); g.moveTo(px + s * 0.16, hy + s * 0.15); g.lineTo(px + s * 0.23, hy - s * 0.12); g.stroke(); } // brazos arriba
      g.fillStyle = alpha(T.light, 0.18 + depth * 0.1); g.fillRect(px + s * 0.05, hy - s * 0.01, s * 0.09, Math.max(1, s * 0.02)); // borde iluminado
      if (r(k + 2) < 0.05) { g.fillStyle = [T.groundTop, '#ef4444', '#facc15', '#f8fafc'][Math.floor(r(k + 3) * 4)]; g.fillRect(px + s * 0.03, hy - s * 0.28, s * 0.22, s * 0.13); g.fillStyle = body; g.fillRect(px + s * 0.02, hy - s * 0.28, Math.max(1, s * 0.02), s * 0.35); }
      if (r(k + 4) < 0.012) { const fg = g.createRadialGradient(px + s * 0.1, hy, 0, px + s * 0.1, hy, s * 0.25); fg.addColorStop(0, 'rgba(255,255,255,0.9)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(px - s * 0.15, hy - s * 0.25, s * 0.5, s * 0.5); }
    }
  }
  const sh = g.createLinearGradient(0, standsTop, 0, ground); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = sh; g.fillRect(0, standsTop, w, ground - standsTop);
  // techito de la tribuna
  g.fillStyle = darken(T.mid, 0.6); g.fillRect(0, standsTop - s * 0.18, w, s * 0.18); g.fillStyle = alpha(T.light, 0.25); g.fillRect(0, standsTop - s * 0.18, w, 1);
  // valla con carteles
  g.fillStyle = '#05060a'; g.fillRect(0, ground - s * 0.55, w, s * 0.55);
  const pad = lin(g, 0, ground - s * 0.55, 0, ground, [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,0,0,0)']]); g.fillStyle = pad; g.fillRect(0, ground - s * 0.55, w, s * 0.55);
  g.fillStyle = alpha(T.edge, 0.9); g.fillRect(0, ground - s * 0.55, w, Math.max(1, s * 0.035));
  g.font = `900 ${Math.round(s * 0.3)}px Nunito, system-ui`; g.textBaseline = 'middle';
  const ads = ['KOMBAT FOOTBALL', 'FATAL GOAL ☠', 'KOMBAT FOOTBALL', '⚡ ENERGY'];
  for (let x = s * 0.6, k = 0; x < w; x += s * 5.2, k++) { g.fillStyle = alpha(T.edge, 0.6); g.fillText(ads[k % ads.length], x, ground - s * 0.27); }
  // aire con niebla
  g.fillStyle = T.fog; g.fillRect(0, 0, w, ground);
}

// ---------------------------------------------------------------- Cancha
function drawGround(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const T = THEMES[m.stage], s = v.s, gy = Y(v, 0), t = m.time;
  ctx.fillStyle = lin(ctx, 0, gy, 0, v.h, [[0, T.ground], [1, darken(T.ground, 0.6)]]); ctx.fillRect(0, gy, v.w, v.h - gy);
  const path = () => ctx.rect(0, gy, v.w, v.h - gy);
  ctx.save(); grain(ctx, path, 0.5, s / 20); ctx.restore();
  // textura según el escenario
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  if (m.stage === 'city' || m.stage === 'graveyard') { ctx.fillStyle = alpha(T.groundTop, 0.25); for (let x = 0; x < v.w; x += s * 0.5) ctx.fillRect(x, gy, s * 0.25, v.h); }
  if (m.stage === 'factory' || m.stage === 'space' || m.stage === 'lab') { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; for (let x = 0; x < v.w; x += s * 1.2) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, v.h); ctx.stroke(); } ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < v.w; x += s * 1.2) ctx.fillRect(x + 1, gy, 1, v.h); }
  if (m.stage === 'volcano') { ctx.strokeStyle = `rgba(255,120,30,${0.5 + 0.2 * Math.sin(t * 2)})`; ctx.lineWidth = Math.max(1, s * 0.05); for (let k = 0; k < 14; k++) { const x = hash(k + 3) * v.w; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + s * 0.4, gy + s * 0.3); ctx.lineTo(x + s * 0.2, gy + s * 0.7); ctx.stroke(); } }
  if (m.stage === 'glacier') { ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 10; k++) ctx.fillRect(hash(k) * v.w, gy + s * 0.05, s * 2, Math.max(1, s * 0.03)); }
  if (m.stage === 'storm') { const rg = lin(ctx, 0, gy, 0, gy + s * 0.8, [[0, 'rgba(200,210,230,0.25)'], [1, 'rgba(200,210,230,0)']]); ctx.fillStyle = rg; ctx.fillRect(0, gy, v.w, s * 0.8); }
  if (m.stage === 'arena') { ctx.strokeStyle = `rgba(192,132,252,${0.35 + 0.2 * Math.sin(t * 1.5)})`; ctx.lineWidth = Math.max(1, s * 0.03); for (let x = s; x < v.w; x += s * 2) { ctx.beginPath(); ctx.arc(x, gy + s * 0.5, s * 0.25, 0, TAU); ctx.stroke(); } }
  ctx.restore();
  // borde de arriba que brilla
  ctx.fillStyle = T.groundTop; ctx.fillRect(0, gy - Math.max(1, s * 0.06), v.w, Math.max(2, s * 0.12));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lin(ctx, 0, gy - s * 0.5, 0, gy + s * 0.3, [[0, alpha(T.edge, 0)], [0.6, alpha(T.edge, 0.35)], [1, alpha(T.edge, 0)]]); ctx.fillRect(0, gy - s * 0.5, v.w, s * 0.8); ctx.restore();
  if (m.stage === 'city' || m.stage === 'graveyard') { ctx.fillStyle = T.groundTop; for (let x = 0; x < v.w; x += s * 0.12) { const hh = s * (0.08 + hash(x) * 0.14); ctx.fillRect(x, gy - hh, Math.max(1, s * 0.03), hh); } } // pasto
  if (m.stage === 'glacier' || m.stage === 'desert') { ctx.fillStyle = m.stage === 'glacier' ? '#f8fbff' : '#f6d38a'; for (let x = 0; x < v.w; x += s * 0.5) { ctx.beginPath(); ctx.ellipse(x, gy, s * 0.4, s * (0.06 + hash(x) * 0.06), 0, Math.PI, TAU); ctx.fill(); } }
  // línea de mitad de cancha
  ctx.fillStyle = alpha(T.edge, 0.4); ctx.fillRect(X(v, W / 2) - 1, gy - s * 0.05, 2, s * 0.1);
}

// ---------------------------------------------------------------- Arcos
function drawGoal(ctx: CanvasRenderingContext2D, m: Match, v: View, side: 0 | 1, front: boolean) {
  const T = THEMES[m.stage], s = v.s, gh = goalHeight(m, side), x0 = side === 0 ? 0 : W - GOAL_DEPTH, x1 = side === 0 ? GOAL_DEPTH : W;
  const fx = side === 0 ? x1 : x0, bx = side === 0 ? x0 : x1;
  const L = side === 0 ? LOOKS[m.fighters[0].char] : LOOKS[m.fighters[1].char];
  if (!front) {
    // red: malla con un poco de caída, y el fondo oscuro
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X(v, Math.min(x0, x1)), Y(v, gh), GOAL_DEPTH * s, gh * s);
    ctx.save(); ctx.beginPath(); ctx.rect(X(v, Math.min(x0, x1)), Y(v, gh), GOAL_DEPTH * s, gh * s); ctx.clip();
    ctx.strokeStyle = 'rgba(230,240,255,0.45)'; ctx.lineWidth = Math.max(1, s * 0.025);
    const sway = Math.sin(m.time * 2 + side) * 0.03;
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 0.01; x += 0.25) { ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, gh)); ctx.quadraticCurveTo(X(v, x + sway * 4), Y(v, gh / 2), X(v, x), Y(v, 0)); ctx.stroke(); }
    for (let y = 0; y <= gh; y += 0.25) { ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, y)); ctx.quadraticCurveTo(X(v, (x0 + x1) / 2), Y(v, y - 0.06), X(v, x1), Y(v, y)); ctx.stroke(); }
    ctx.restore();
    // palo de atrás
    ctx.fillStyle = '#9aa3b0'; ctx.fillRect(X(v, bx) - s * 0.05, Y(v, gh), s * 0.1, gh * s);
    return;
  }
  // palo de adelante y travesaño metálicos con luz del color del dueño del arco
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
  void T;
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
  // gajos (pentágonos) que giran
  ctx.fillStyle = patch;
  const pent = (cx: number, cy: number, pr: number, rot: number) => { ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = rot + k * TAU / 5; ctx.lineTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr); } ctx.closePath(); ctx.fill(); };
  pent(x + Math.cos(spin) * r * 0.1, y + Math.sin(spin) * r * 0.1, r * 0.33, spin);
  for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5 + Math.PI / 5; pent(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.3, spin + Math.PI / 5); }
  ctx.strokeStyle = alpha(patch, 0.6); ctx.lineWidth = Math.max(0.5, r * 0.04);
  for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.33, y + Math.sin(a) * r * 0.33); ctx.lineTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); ctx.stroke(); }
  // volumen
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05); g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (kind === 'ice' || fx === 'ice') { ctx.fillStyle = 'rgba(200,235,255,0.45)'; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(0.5, r * 0.05); ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x, y); ctx.lineTo(x + r * 0.4, y - r * 0.2); ctx.moveTo(x, y); ctx.lineTo(x - r * 0.1, y + r * 0.6); ctx.stroke(); }
  if (kind === 'void') { ctx.fillStyle = `rgba(30,0,60,${0.25 + 0.15 * Math.sin(t * 5)})`; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
  spec(ctx, x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.16, -0.6, 0.85);
  if (fx === 'fire' || kind === 'fire') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.35, l = r * (1.3 + 0.4 * Math.sin(t * 25 + k)); ctx.fillStyle = k % 2 ? 'rgba(253,224,71,0.6)' : 'rgba(249,115,22,0.6)'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.25) * r * 0.8, y + Math.sin(a - 0.25) * r * 0.8); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a + 0.25) * r * 0.8, y + Math.sin(a + 0.25) * r * 0.8); ctx.fill(); } ctx.restore(); }
  if (fx === 'volt' || kind === 'void') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = fx === 'volt' ? '#fef08a' : '#d8b4fe'; ctx.lineWidth = Math.max(1, r * 0.06); for (let k = 0; k < 3; k++) { let a = Math.random() * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 3; j++) { a += (Math.random() - 0.5); px += Math.cos(a) * r * 0.5; py += Math.sin(a) * r * 0.5; ctx.lineTo(px, py); } ctx.stroke(); } ctx.restore(); }
}
function drawBall(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const b = m.ball, s = v.s, fat = m.fatal && !m.fatal.done ? m.fatal : null;
  // estela
  const tc = fat ? CHARS[fat.char].glow : b.fx === 'fire' || b.kind === 'fire' ? '#fb923c' : b.fx === 'ice' || b.kind === 'ice' ? '#7dd3fc' : b.fx === 'toxic' || b.kind === 'toxic' ? '#4ade80' : b.fx === 'volt' ? '#fde047' : b.kind === 'void' ? '#a855f7' : '#60a5fa';
  const speed = Math.hypot(b.vx, b.vy);
  if (m.trail.length > 2 && (speed > 9 || fat)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < m.trail.length; i++) { const k = 1 - i / m.trail.length; ctx.strokeStyle = alpha(tc, 0.55 * k); ctx.lineWidth = BALL_R * 2 * s * k * (fat ? 1.8 : 1); ctx.beginPath(); ctx.moveTo(X(v, m.trail[i - 1][0]), Y(v, m.trail[i - 1][1])); ctx.lineTo(X(v, m.trail[i][0]), Y(v, m.trail[i][1])); ctx.stroke(); }
    ctx.restore();
  }
  const x = X(v, b.x), y = Y(v, b.y);
  // sombra en el piso
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.4 - b.y * 0.04)})`; ctx.beginPath(); ctx.ellipse(x, Y(v, 0), BALL_R * s * (1 - Math.min(0.6, b.y * 0.05)), BALL_R * s * 0.25, 0, 0, TAU); ctx.fill();
  if (fat) { drawFatalBall(ctx, m, v, x, y); return; }
  drawBallSprite(ctx, x, y, BALL_R * s, b.spin, b.kind, b.fx, m.time);
  if (b.frozen > 0) { ctx.save(); ctx.globalAlpha = 0.75; const r = BALL_R * s * 1.4; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = 'rgba(186,230,253,0.55)'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
}
// La pelota del FATAL GOAL: un meteorito, una bola de hielo gigante, una calavera de ácido, un rayo o un agujero negro.
function drawFatalBall(ctx: CanvasRenderingContext2D, m: Match, v: View, x: number, y: number) {
  const fat = m.fatal!, p = fatalPath(m, fat, fat.t), r = BALL_R * v.s * p.size, t = m.time;
  ctx.save();
  switch (fat.char) {
    case 'bull': {
      const b = m.ball, ang = Math.atan2(-b.vy, b.vx);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { ctx.fillStyle = ['rgba(255,80,20,0.5)', 'rgba(255,160,40,0.6)', 'rgba(255,240,180,0.8)'][k]; ctx.beginPath(); ctx.ellipse(x - Math.cos(ang) * r * (1.5 - k * 0.4), y - Math.sin(ang) * r * (1.5 - k * 0.4), r * (2.6 - k * 0.6), r * (1.1 - k * 0.25), ang, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      shade(ctx, () => { for (let k = 0; k < 12; k++) { const a = k * TAU / 12, rr = r * (0.85 + hash(k) * 0.25); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }, '#5a3020', { x: x - r * 0.3, y: y - r * 0.3, r: r * 1.5, tex: 0.6 });
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = Math.max(1, r * 0.08); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(k * 1.7) * r * 0.8, y + Math.sin(k * 1.7) * r * 0.8); ctx.stroke(); }
      bloom(ctx, x, y, r * 4, '#fb923c', 0.8);
      break;
    }
    case 'frost': {
      bloom(ctx, x, y, r * 2.5, '#bae6fd', 0.6);
      shade(ctx, () => ctx.arc(x, y, r, 0, TAU), '#9ccff5', { x: x - r * 0.3, y: y - r * 0.35, r: r * 1.4, hi: 0.6, tex: 0.4 });
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, r * 0.04); for (let k = 0; k < 6; k++) { const a = t * -4 + k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
      for (let k = 0; k < 8; k++) { const a = t * -4 + k * TAU / 8; ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); ctx.lineTo(x + Math.cos(a + 0.12) * r * 1.35, y + Math.sin(a + 0.12) * r * 1.35); ctx.lineTo(x + Math.cos(a + 0.25) * r * 0.9, y + Math.sin(a + 0.25) * r * 0.9); ctx.fill(); }
      spec(ctx, x - r * 0.4, y - r * 0.45, r * 0.3, r * 0.15, -0.6, 0.9);
      break;
    }
    case 'volt': {
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
    default: { // calavera de ácido
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, r * 3.5, '#4ade80', 0.8); ctx.globalCompositeOperation = 'source-over';
      shade(ctx, () => { ctx.arc(x, y - r * 0.1, r * 0.85, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x + r * 0.5, y + r * 0.75); ctx.lineTo(x - r * 0.5, y + r * 0.75); ctx.closePath(); }, '#b5f5c4', { x: x - r * 0.3, y: y - r * 0.4, r: r * 1.4, tex: 0.4 });
      ctx.fillStyle = '#052e16'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s2 * r * 0.33, y - r * 0.05, r * 0.22, r * 0.25, 0, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter'; for (const s2 of [-1, 1]) bloom(ctx, x + s2 * r * 0.33, y - r * 0.05, r * 0.4, '#4ade80', 0.9); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#052e16'; for (let k = -2; k <= 2; k++) ctx.fillRect(x + k * r * 0.17 - r * 0.05, y + r * 0.45, r * 0.1, r * 0.25);
      for (let k = 0; k < 3; k++) { const d = (t * 2 + k / 3) % 1; ctx.fillStyle = `rgba(74,222,128,${1 - d})`; ctx.beginPath(); ctx.ellipse(x + (k - 1) * r * 0.4, y + r * 0.8 + d * r * 1.5, r * 0.08, r * 0.12, 0, 0, TAU); ctx.fill(); }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Habilidades en la cancha
function drawShield(ctx: CanvasRenderingContext2D, sh: Shield, m: Match, v: View) {
  const s = v.s, t = m.time, fade = Math.min(1, sh.t * 4, (sh.life - sh.t) * 3);
  const x0 = X(v, sh.x), y1 = Y(v, sh.y + sh.h), y0 = Y(v, sh.y), w = sh.w * s;
  ctx.save(); ctx.globalAlpha = fade;
  switch (sh.kind) {
    case 'cloud': ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 18; k++) { const px = x0 + hash(k) * w, py = y0 - ((hash(k + 5) * sh.h + t * 0.3 * (1 + hash(k))) % sh.h) * s, pr = s * (0.5 + hash(k + 9) * 0.6); const g = ctx.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, 'rgba(110,231,140,0.35)'); g.addColorStop(1, 'rgba(34,197,94,0)'); ctx.fillStyle = g; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2); } break;
    case 'firewall': {
      ctx.globalCompositeOperation = 'lighter';
      const cx = x0 + w / 2, H2 = sh.h * s;
      ctx.fillStyle = lin(ctx, cx - w * 1.2, 0, cx + w * 1.2, 0, [[0, 'rgba(220,38,38,0)'], [0.5, 'rgba(249,115,22,0.45)'], [1, 'rgba(220,38,38,0)']]); ctx.fillRect(cx - w * 1.2, y1, w * 2.4, H2);
      for (let k = 0; k < 34; k++) { // lenguas de fuego chicas que suben por toda la pared
        const life = (t * (1.4 + hash(k) * 0.8) + hash(k + 7)) % 1, fx = cx + (hash(k + 3) - 0.5) * w * 1.3 + Math.sin(t * 8 + k) * w * 0.15;
        const fy = y0 - (hash(k + 11) * 0.85 + life * 0.25) * H2, fr = s * (0.16 + hash(k + 5) * 0.14) * (1 - life * 0.6);
        ctx.fillStyle = life < 0.3 ? 'rgba(255,245,200,0.75)' : life < 0.65 ? 'rgba(251,146,60,0.6)' : 'rgba(220,38,38,0.45)';
        ctx.beginPath(); ctx.moveTo(fx - fr, fy); ctx.quadraticCurveTo(fx - fr * 0.4, fy - fr * 2.4, fx + Math.sin(t * 12 + k) * fr * 0.3, fy - fr * 3); ctx.quadraticCurveTo(fx + fr * 0.4, fy - fr * 2.4, fx + fr, fy); ctx.arc(fx, fy, fr, 0, Math.PI); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,250,220,0.5)'; ctx.fillRect(cx - s * 0.05, y1 + H2 * 0.15, s * 0.1, H2 * 0.85);
      for (let k = 0; k < 8; k++) { const d = (t * 1.8 + hash(k)) % 1; ctx.fillStyle = `rgba(255,200,90,${1 - d})`; ctx.fillRect(cx + (hash(k + 2) - 0.5) * w * 2, y0 - d * H2 * 1.1, 2, 2); }
      bloom(ctx, cx, (y0 + y1) / 2, H2 * 0.55, '#f97316', 0.35); break;
    }
    case 'icewall': {
      const path = () => { ctx.moveTo(x0, y0); ctx.lineTo(x0 - w * 0.1, y1 + s * 0.4); ctx.lineTo(x0 + w * 0.3, y1); ctx.lineTo(x0 + w * 0.8, y1 + s * 0.25); ctx.lineTo(x0 + w * 1.1, y1 + s * 0.6); ctx.lineTo(x0 + w, y0); ctx.closePath(); };
      ctx.beginPath(); path(); ctx.fillStyle = lin(ctx, x0, y1, x0 + w, y0, [[0, 'rgba(240,250,255,0.9)'], [0.5, 'rgba(147,197,253,0.75)'], [1, 'rgba(37,99,235,0.8)']]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 + w * hash(k), y0 - hash(k + 1) * sh.h * s); ctx.lineTo(x0 + w * hash(k + 2), y0 - hash(k + 3) * sh.h * s); ctx.stroke(); }
      break;
    }
    case 'field': { const cx = X(v, sh.x), cy = Y(v, sh.y), R = sh.w * s; ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R); g.addColorStop(0, 'rgba(253,224,71,0)'); g.addColorStop(0.9, `rgba(253,224,71,${0.3 + 0.15 * Math.sin(t * 20)})`); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { let a = Math.random() * TAU, px = cx + Math.cos(a) * R * 0.95, py = cy + Math.sin(a) * R * 0.95; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 3; j++) { a += 0.3; px = cx + Math.cos(a) * R * (0.85 + Math.random() * 0.2); py = cy + Math.sin(a) * R * (0.85 + Math.random() * 0.2); ctx.lineTo(px, py); } ctx.stroke(); } break; }
    case 'portal': { const cx = X(v, sh.x), cy = Y(v, sh.y + sh.h / 2), rx = sh.w * s * 0.5, ry = sh.h * s * 0.5; drawPortalRing(ctx, cx, cy, rx, ry, t); break; }
  }
  ctx.restore();
}
function drawPortalRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) { ctx.strokeStyle = `rgba(${180 - k * 20},${100 - k * 15},255,${0.7 - k * 0.12})`; ctx.lineWidth = Math.max(1, rx * 0.12); ctx.beginPath(); ctx.ellipse(cx, cy, rx * (1 - k * 0.18), ry * (1 - k * 0.18), 0, t * 3 + k, t * 3 + k + 4.5); ctx.stroke(); }
  bloom(ctx, cx, cy, Math.max(rx, ry) * 1.5, '#a855f7', 0.5);
  ctx.restore();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, 'rgba(5,0,15,0.95)'); g.addColorStop(0.6, 'rgba(40,10,80,0.7)'); g.addColorStop(1, 'rgba(120,60,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.75, ry * 0.75, 0, 0, TAU); ctx.fill();
}
function drawShot(ctx: CanvasRenderingContext2D, sh: Shot, m: Match, v: View) {
  const s = v.s;
  if (sh.kind === 'acid') {
    const x = X(v, sh.x), y = Y(v, sh.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(74,222,128,${0.5 - k * 0.07})`; ctx.beginPath(); ctx.arc(x - Math.sign(sh.vx) * k * s * 0.15, y + Math.sin(m.time * 20 + k) * s * 0.03, s * (0.2 - k * 0.025), 0, TAU); ctx.fill(); }
    bloom(ctx, x, y, s * 0.8, '#4ade80', 0.6); ctx.restore();
    shade(ctx, () => ctx.arc(x, y, s * 0.16, 0, TAU), '#84f0a0', { x: x - s * 0.05, y: y - s * 0.05, r: s * 0.2 });
  } else {
    const owner = m.fighters[sh.side], dir = owner.facing, reach = Math.min(1, sh.t / 0.25) * 3.6;
    const x0 = X(v, sh.x), y0 = Y(v, sh.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x0, y0, x0 + dir * reach * s, y0); g.addColorStop(0, 'rgba(224,242,254,0.8)'); g.addColorStop(1, 'rgba(147,197,253,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0 - s * 0.2); ctx.lineTo(x0 + dir * reach * s, y0 - s * (0.5 + reach * 0.35)); ctx.lineTo(x0 + dir * reach * s, y0 + s * (0.5 + reach * 0.35)); ctx.lineTo(x0, y0 + s * 0.2); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Peligros
function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const s = v.s, t = m.time, gy = Y(v, 0);
  switch (h.kind) {
    case 'puddle': {
      const x0 = X(v, h.x), w = h.w * s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lin(ctx, 0, gy - s * 0.1, 0, gy + s * 0.15, [[0, 'rgba(74,222,128,0.7)'], [1, 'rgba(20,83,45,0.2)']]); ctx.beginPath(); ctx.ellipse(x0 + w / 2, gy, w / 2, s * 0.13, 0, 0, TAU); ctx.fill();
      bloom(ctx, x0 + w / 2, gy - s * 0.2, w * 0.6, '#4ade80', 0.3 + 0.1 * Math.sin(t * 3));
      for (let k = 0; k < 3; k++) { const d = (t * 0.8 + k / 3 + h.id) % 1; ctx.strokeStyle = `rgba(187,247,208,${0.6 * (1 - d)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + w * (0.25 + k * 0.25), gy - s * 0.05 - d * s * 0.4, s * 0.06, 0, TAU); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'lava': {
      const x0 = X(v, h.x), w = h.w * s;
      ctx.fillStyle = lin(ctx, 0, gy - s * 0.05, 0, v.h, [[0, '#fff3b0'], [0.15, '#ff8a1a'], [0.6, '#c2260c'], [1, '#3a0703']]); ctx.fillRect(x0, gy - s * 0.08, w, v.h - gy);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x0 + w / 2, gy, w * 0.9, '#ff6a1a', 0.6);
      for (let k = 0; k < 4; k++) { const d = (t * 1.2 + k / 4 + h.id) % 1; ctx.fillStyle = `rgba(255,200,80,${1 - d})`; ctx.beginPath(); ctx.arc(x0 + w * hash(k + h.id), gy - d * s * 0.8, s * 0.05, 0, TAU); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'block': {
      const x0 = X(v, h.x), y0 = Y(v, h.h), w = h.w * s, hh = h.h * s;
      ctx.beginPath(); ctx.rect(x0, y0, w, hh); ctx.fillStyle = lin(ctx, x0, y0, x0 + w, y0 + hh, [[0, '#f0f9ff'], [0.4, '#a5d8f8'], [1, '#3b82c4']]); ctx.fill();
      ctx.strokeStyle = 'rgba(15,60,110,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0, w * 0.55, s * 0.12, 0, Math.PI, TAU); ctx.fill(); // nieve arriba
      ctx.fillStyle = 'rgba(220,240,255,0.9)'; for (let k = 0; k < 6; k++) { const ix = x0 + w * (k + 0.5) / 6, il = s * (0.15 + hash(k + h.id) * 0.2); ctx.beginPath(); ctx.moveTo(ix - s * 0.05, y0 + s * 0.02); ctx.lineTo(ix, y0 + il); ctx.lineTo(ix + s * 0.05, y0 + s * 0.02); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(x0 + w * 0.2, y0 + hh * 0.3); ctx.lineTo(x0 + w * 0.35, y0 + hh * 0.7); ctx.stroke();
      break;
    }
    case 'wreck': {
      const a = h.state, px = X(v, h.x), py = Y(v, h.y), bx = X(v, h.x + Math.sin(a) * h.h), by = Y(v, h.y - Math.cos(a) * h.h), R = 0.95 * s;
      ctx.strokeStyle = '#2a2f37'; ctx.lineWidth = Math.max(2, s * 0.12); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = '#8b95a5'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.setLineDash([s * 0.12, s * 0.08]); ctx.stroke(); ctx.setLineDash([]);
      for (let k = 0; k < 12; k++) { const aa = k * TAU / 12 + a, ca = Math.cos(aa), sa = Math.sin(aa); ctx.beginPath(); ctx.moveTo(bx + ca * R * 0.85 - sa * R * 0.15, by + sa * R * 0.85 + ca * R * 0.15); ctx.lineTo(bx + ca * R * 1.35, by + sa * R * 1.35); ctx.lineTo(bx + ca * R * 0.85 + sa * R * 0.15, by + sa * R * 0.85 - ca * R * 0.15); ctx.closePath(); ctx.fillStyle = lin(ctx, bx, by - R, bx, by + R, [[0, '#e5e7eb'], [1, '#4b5563']]); ctx.fill(); }
      shade(ctx, () => ctx.arc(bx, by, R, 0, TAU), '#30353e', { x: bx - R * 0.4, y: by - R * 0.4, r: R * 1.5, hi: 0.45, tex: 0.6 });
      ctx.strokeStyle = 'rgba(245,158,11,0.8)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(bx, by, R * 0.97, 0, TAU); ctx.stroke();
      spec(ctx, bx - R * 0.35, by - R * 0.4, R * 0.3, R * 0.15, -0.6, 0.6);
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
    case 'laser': {
      const x = X(v, h.x + h.w / 2), top = Y(v, H - 0.4);
      shade(ctx, () => ctx.roundRect(x - s * 0.3, top - s * 0.4, s * 0.6, s * 0.5, s * 0.08), '#2a3338', { x: x - s * 0.1, y: top - s * 0.3, r: s * 0.6 });
      shade(ctx, () => ctx.roundRect(x - s * 0.3, gy - s * 0.2, s * 0.6, s * 0.25, s * 0.06), '#2a3338', { x: x - s * 0.1, y: gy - s * 0.2, r: s * 0.6 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (h.state === 2) { ctx.fillStyle = lin(ctx, x - s * 0.4, 0, x + s * 0.4, 0, [[0, 'rgba(255,40,80,0)'], [0.5, 'rgba(255,40,80,0.6)'], [1, 'rgba(255,40,80,0)']]); ctx.fillRect(x - s * 0.4, top, s * 0.8, gy - top); ctx.fillStyle = '#fff0f4'; ctx.fillRect(x - 1, top, 2, gy - top); bloom(ctx, x, gy, s, '#ff2850', 0.6); }
      else if (h.state === 1 && Math.sin(t * 40) > 0) { ctx.fillStyle = 'rgba(255,40,80,0.5)'; ctx.fillRect(x - 0.5, top, 1, gy - top); }
      ctx.restore();
      break;
    }
    case 'antigrav': if (h.state === 1) { const x0 = X(v, h.x), w = h.w * s; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lin(ctx, x0, 0, x0 + w, 0, [[0, 'rgba(94,234,212,0)'], [0.5, 'rgba(94,234,212,0.12)'], [1, 'rgba(94,234,212,0)']]); ctx.fillRect(x0, Y(v, H), w, gy - Y(v, H)); for (let k = 0; k < 10; k++) { const d = (t * 0.5 + hash(k)) % 1; ctx.fillStyle = `rgba(153,246,228,${0.6 * (1 - d)})`; ctx.fillRect(x0 + hash(k + 3) * w, gy - d * (gy - Y(v, H)), 2, s * 0.25); } ctx.restore(); } break;
    case 'airlock': {
      const left = h.dir < 0, x = left ? X(v, -0.2) : X(v, W + 0.2), y = Y(v, 7.5), open = h.state === 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (h.state >= 1) { ctx.fillStyle = `rgba(255,${h.state === 1 ? 180 : 60},60,${0.4 + 0.3 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(x, y - s * 2, s * 0.3, 0, TAU); ctx.fill(); }
      if (open) for (let k = 0; k < 14; k++) { const d = (t * 1.5 + hash(k)) % 1, yy = Y(v, hash(k + 3) * 10); ctx.strokeStyle = `rgba(200,220,255,${0.4 * d})`; ctx.lineWidth = 1.5; ctx.beginPath(); const sx = left ? X(v, 6 - d * 6) : X(v, W - 6 + d * 6); ctx.moveTo(sx, yy); ctx.lineTo(sx + (left ? -1 : 1) * s * 1.2, yy); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'arc': case 'lightning': case 'meteor': case 'icicle': case 'hand': drawStrike(ctx, h, m, v); break;
    case 'gust': if (h.t > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 16; k++) { const yy = Y(v, 0.5 + hash(k) * 8), xx = ((hash(k + 4) * W + h.dir * t * 14) % W + W) % W; ctx.strokeStyle = 'rgba(220,230,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(v, xx), yy); ctx.quadraticCurveTo(X(v, xx + h.dir * 0.8), yy - s * 0.15, X(v, xx + h.dir * 1.6), yy); ctx.stroke(); } ctx.restore(); } break;
    case 'tornado': {
      const cx = X(v, h.x);
      for (let k = 0; k < 26; k++) { const yy = k / 26, wid = (0.35 + yy * 1.4) * s, ph = t * 9 + k * 0.6, ex = cx + Math.sin(t * 2 + yy * 3) * s * 0.4 * yy; ctx.strokeStyle = `rgba(${200 - k * 2},${160 - k * 2},${110 - k},${0.55 - yy * 0.25})`; ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.ellipse(ex, gy - yy * h.h * s, wid, wid * 0.25, 0, ph, ph + 4); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,150,90,0.25)'; ctx.beginPath(); ctx.ellipse(cx, gy, s * 1.2, s * 0.25, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'blackhole': { const cx = X(v, h.x), cy = Y(v, h.y), R = s * 0.9; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { ctx.strokeStyle = `rgba(${200 - k * 25},${120 - k * 15},255,${0.5 - k * 0.07})`; ctx.lineWidth = Math.max(1, s * 0.1); ctx.beginPath(); ctx.ellipse(cx, cy, R * (1.4 + k * 0.4), R * (0.45 + k * 0.12), -0.15, t * (2 - k * 0.2) + k, t * (2 - k * 0.2) + k + 5); ctx.stroke(); } bloom(ctx, cx, cy, R * 3, '#a855f7', 0.45); ctx.restore(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); break; }
    case 'portal': drawPortalRing(ctx, X(v, h.x), Y(v, h.y), s * 0.55, s * 0.85, t + h.id); break;
  }
}
// Los peligros que caen: primero el aviso (marca en el piso), después el golpe.
function drawStrike(ctx: CanvasRenderingContext2D, h: Hazard, m: Match, v: View) {
  const s = v.s, gy = Y(v, 0), x = X(v, h.x), t = m.time;
  if (h.t < 0) { // aviso
    const k = 1 + h.t / 1.3, blink = Math.sin(t * 25) > 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const c = h.kind === 'meteor' ? '255,120,40' : h.kind === 'icicle' ? '186,230,253' : h.kind === 'hand' ? '163,230,53' : '253,224,71';
    ctx.fillStyle = `rgba(${c},${blink ? 0.5 : 0.25})`; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${c},0.8)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.5 * (1.4 - k * 0.4), s * 0.16, 0, 0, TAU); ctx.stroke();
    if (h.kind === 'meteor') { const my = Y(v, H + 1 - k * (H + 1)), mx = x + (1 - k) * s * 4; fireDrop(ctx, mx, my, s * 0.5, t); }
    if (h.kind === 'icicle') { const iy = Y(v, H - 0.2); ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, iy); ctx.lineTo(x, iy + s * 0.9); ctx.lineTo(x + s * 0.2, iy); ctx.fill(); }
    if (h.kind === 'lightning' || h.kind === 'arc') { ctx.fillStyle = 'rgba(200,210,255,0.06)'; ctx.fillRect(0, 0, v.w, v.h); }
    if (h.kind === 'hand') for (let j = 0; j < 4; j++) { ctx.fillStyle = 'rgba(80,60,40,0.8)'; ctx.beginPath(); ctx.arc(x + (hash(j + h.id) - 0.5) * h.w * s, gy - Math.abs(Math.sin(t * 20 + j)) * s * 0.15, s * 0.05, 0, TAU); ctx.fill(); }
    ctx.restore();
    return;
  }
  const k = h.t / 1.3;
  ctx.save();
  if (h.kind === 'lightning' || h.kind === 'arc') {
    ctx.globalCompositeOperation = 'lighter';
    if (h.t < 0.35) {
      const top = h.kind === 'arc' ? Y(v, 9.5) : 0, sx = h.kind === 'arc' ? X(v, h.x < W / 2 ? 2.5 : W - 2.5) : x;
      for (const [c, wd] of [['rgba(167,139,250,0.6)', s * 0.35], ['rgba(224,231,255,0.9)', s * 0.14], ['#ffffff', s * 0.05]] as const) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(sx, top); const n = 9; for (let j = 1; j < n; j++) ctx.lineTo(sx + (x - sx) * j / n + (hash(j + Math.floor(t * 20) + h.id) - 0.5) * s * 1.2, top + (gy - top) * j / n); ctx.lineTo(x, gy); ctx.stroke(); }
      bloom(ctx, x, gy, s * 2.5, '#e0e7ff', 0.8);
    }
  } else if (h.kind === 'meteor') {
    if (h.t < 0.6) { ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, gy, s * 3 * (1 - k), '#ff7a1a', 0.9); }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(30,15,10,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.6, s * 0.15, 0, 0, TAU); ctx.fill();
  } else if (h.kind === 'icicle') {
    const fall = Math.min(1, h.t / 0.12), iy = Y(v, H - 0.2 - fall * (H - 1));
    if (fall < 1) { ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, iy - s * 0.9); ctx.lineTo(x, iy); ctx.lineTo(x + s * 0.2, iy - s * 0.9); ctx.fill(); }
    else { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e0f2fe'; for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.moveTo(x + (j - 3) * s * 0.15, gy); ctx.lineTo(x + (j - 2.5) * s * 0.15, gy - s * 0.3 * hash(j + h.id)); ctx.lineTo(x + (j - 2) * s * 0.15, gy); ctx.fill(); } }
  } else { // manos de zombi que salen y agarran
    const up = Math.min(1, h.t / 0.15) * (1 - Math.max(0, (h.t - 1) / 0.3));
    for (let j = 0; j < 3; j++) {
      const hx = x + (j - 1) * h.w * s * 0.35, hh = s * 0.7 * up * (0.8 + hash(j + h.id) * 0.4);
      ctx.fillStyle = '#5c6b3a'; ctx.beginPath(); ctx.roundRect(hx - s * 0.07, gy - hh, s * 0.14, hh, s * 0.04); ctx.fill();
      for (let f = 0; f < 4; f++) { ctx.strokeStyle = '#6f7f48'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - s * 0.06 + f * s * 0.04, gy - hh); ctx.lineTo(hx - s * 0.1 + f * s * 0.07, gy - hh - s * 0.14 * up); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(40,30,20,0.6)'; ctx.beginPath(); ctx.ellipse(x, gy, h.w * s * 0.6, s * 0.1, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function fireDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x - r * 4, y - r * 6); g.addColorStop(0, 'rgba(255,200,80,0.9)'); g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - r * 0.8, y); ctx.lineTo(x - r * 5, y - r * 7); ctx.lineTo(x + r * 0.8, y); ctx.fill();
  bloom(ctx, x, y, r * 3, '#fb923c', 0.8); ctx.restore();
  shade(ctx, () => { for (let k = 0; k < 10; k++) { const a = k * TAU / 10 + t, rr = r * (0.8 + hash(k) * 0.3); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }, '#6b3a22', { x: x - r * 0.3, y: y - r * 0.3, r: r * 1.5, tex: 0.5 });
}

// ---------------------------------------------------------------- Potenciadores
export function drawPowerIcon(ctx: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (kind) {
    case 'shield': ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.4); ctx.quadraticCurveTo(r * 0.45, r * 0.3, 0, r * 0.65); ctx.quadraticCurveTo(-r * 0.45, r * 0.3, -r * 0.5, -r * 0.4); ctx.closePath(); ctx.fill(); break;
    case 'speed': for (const dx of [-0.25, 0.15]) { ctx.beginPath(); ctx.moveTo(r * dx - r * 0.15, -r * 0.45); ctx.lineTo(r * dx + r * 0.25, 0); ctx.lineTo(r * dx - r * 0.15, r * 0.45); ctx.stroke(); } break;
    case 'magnet': ctx.lineWidth = r * 0.25; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.35, Math.PI, 0, true); ctx.moveTo(-r * 0.35, -r * 0.05); ctx.lineTo(-r * 0.35, -r * 0.45); ctx.moveTo(r * 0.35, -r * 0.05); ctx.lineTo(r * 0.35, -r * 0.45); ctx.stroke(); break;
    case 'power': ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.45); ctx.lineTo(r * 0.35, -r * 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.5); ctx.lineTo(r * 0.12, -r * 0.42); ctx.lineTo(r * 0.38, -r * 0.18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.15); ctx.lineTo(-r * 0.15, r * 0.5); ctx.stroke(); break;
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
    case 'ring': ctx.strokeStyle = alpha(p.color, k * 1.6); ctx.lineWidth = Math.max(1, s * 0.08 * k); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); break;
    case 'shard': ctx.fillStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.5, y); ctx.fill(); break;
    case 'bubble': ctx.strokeStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); break;
    default: ctx.fillStyle = alpha(p.color, Math.min(1, k * 1.5)); ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }
}

// ---------------------------------------------------------------- Clima y luces que se mueven
function drawWeather(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  const t = m.time, s = v.s;
  ctx.save();
  if (m.stage === 'glacier') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 90; k++) { const x = ((hash(k) * v.w + t * s * (0.6 + hash(k + 1)) * 0.8 + Math.sin(t + k) * s * 0.3) % v.w + v.w) % v.w, y = ((hash(k + 2) * v.h + t * s * (1 + hash(k + 3))) % v.h); ctx.beginPath(); ctx.arc(x, y, 1 + hash(k + 4) * 2, 0, TAU); ctx.fill(); } }
  if (m.stage === 'storm') { ctx.strokeStyle = 'rgba(190,205,230,0.35)'; ctx.lineWidth = 1; for (let k = 0; k < 110; k++) { const x = ((hash(k) * v.w - t * s * 4) % v.w + v.w) % v.w, y = (hash(k + 2) * v.h + t * s * 22) % v.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.15, y + s * 0.6); ctx.stroke(); } }
  if (m.stage === 'volcano') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 45; k++) { const y = v.h - ((hash(k + 2) * v.h + t * s * (0.8 + hash(k + 3))) % v.h), x = hash(k) * v.w + Math.sin(t * 2 + k) * s * 0.4; ctx.fillStyle = `rgba(255,${120 + hash(k) * 100},40,${0.5 + 0.4 * Math.sin(t * 5 + k)})`; ctx.fillRect(x, y, 2, 2); } }
  if (m.stage === 'desert') { ctx.fillStyle = 'rgba(240,200,140,0.35)'; for (let k = 0; k < 60; k++) { const x = ((hash(k) * v.w + t * s * 5) % v.w), y = Y(v, hash(k + 1) * 4); ctx.fillRect(x, y, 2, 1); } }
  if (m.stage === 'graveyard') { for (let k = 0; k < 6; k++) { const x = ((hash(k) * v.w + t * s * 0.4 * (k % 2 ? 1 : -1)) % (v.w + s * 8)) - s * 4, y = Y(v, 0.4 + hash(k + 3) * 1.2), g = ctx.createRadialGradient(x, y, 0, x, y, s * 4); g.addColorStop(0, 'rgba(200,190,230,0.16)'); g.addColorStop(1, 'rgba(200,190,230,0)'); ctx.fillStyle = g; ctx.fillRect(x - s * 4, y - s * 4, s * 8, s * 8); } }
  if (m.stage === 'city' || m.stage === 'lab' || m.stage === 'arena') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 25; k++) { const x = hash(k) * v.w + Math.sin(t * 0.7 + k) * s, y = Y(v, 1 + hash(k + 1) * 9) + Math.cos(t * 0.5 + k) * s * 0.5; ctx.fillStyle = alpha(THEMES[m.stage].edge, 0.25 + 0.2 * Math.sin(t * 3 + k)); ctx.fillRect(x, y, 2, 2); } }
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export function drawMatch(ctx: CanvasRenderingContext2D, m: Match, v: View) {
  ctx.save();
  if (m.shake > 0) ctx.translate((Math.random() - 0.5) * m.shake * v.s * 0.5, (Math.random() - 0.5) * m.shake * v.s * 0.5);
  const bg = background(m.stage, v);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = THEMES[m.stage].sky[1]; ctx.fillRect(0, 0, v.w, v.h); }
  // tribuna que salta en los goles
  if (m.phase === 'goal' && bg) { const j = Math.abs(Math.sin(m.phaseT * 9)) * v.s * 0.08; ctx.drawImage(bg, 0, Y(v, 4.2), v.w, 4.2 * v.s - v.s * 0.55, 0, Y(v, 4.2) - j, v.w, 4.2 * v.s - v.s * 0.55); }
  for (const h of m.hazards) if (h.kind === 'blackhole' || h.kind === 'antigrav' || h.kind === 'airlock') drawHazard(ctx, h, m, v);
  drawGround(ctx, m, v);
  for (const h of m.hazards) if (h.kind === 'puddle' || h.kind === 'lava' || h.kind === 'conveyor' || h.kind === 'block') drawHazard(ctx, h, m, v);
  drawGoal(ctx, m, v, 0, false); drawGoal(ctx, m, v, 1, false);
  for (const sh of m.shields) if (sh.kind === 'portal' || sh.kind === 'cloud') drawShield(ctx, sh, m, v);
  for (const h of m.hazards) if (h.kind === 'laser' || h.kind === 'portal' || h.kind === 'tornado' || h.kind === 'hand') drawHazard(ctx, h, m, v);
  // luchadores
  for (const f of m.fighters) {
    const L = LOOKS[f.char], x = X(v, f.x), y = Y(v, f.y);
    ctx.save(); ctx.translate(x, y); ctx.scale(v.s, v.s); if (f.facing < 0) ctx.scale(-1, 1);
    const fatalNow = m.phase === 'fatal' && m.fatal?.side === f.side;
    drawFighterBody(ctx, f, m.time + f.side * 0.37, {
      power: f.energy / 100, frozen: f.stun > 0 && f.stunKind === 'freeze', poison: f.poison > 0 || (f.stun > 0 && f.stunKind === 'poison'), burn: f.stun > 0 && f.stunKind === 'burn' || f.dashT > 0,
      zap: f.stun > 0 && f.stunKind === 'zap', shield: (f.powers.shield ?? 0) > 0, speed: f.speedT > 0 || (f.powers.speed ?? 0) > 0,
      aura: fatalNow || f.energy >= 100 ? L.glow : f.dashT > 0 ? '#fb923c' : null,
    });
    ctx.restore();
    if (f.stun > 0 && f.stunKind === 'grab') drawHazard(ctx, { kind: 'hand', x: f.x, y: 0, w: 1, h: 0, t: 0.5, state: 1, dir: 1, id: f.side }, m, v);
  }
  for (const sh of m.shots) drawShot(ctx, sh, m, v);
  drawBall(ctx, m, v);
  for (const sh of m.shields) if (sh.kind !== 'portal' && sh.kind !== 'cloud') drawShield(ctx, sh, m, v);
  drawGoal(ctx, m, v, 0, true); drawGoal(ctx, m, v, 1, true);
  for (const h of m.hazards) if (h.kind === 'wreck' || h.kind === 'arc' || h.kind === 'lightning' || h.kind === 'meteor' || h.kind === 'icicle' || h.kind === 'gust') drawHazard(ctx, h, m, v);
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
  // viñeta
  const vg = ctx.createRadialGradient(v.w / 2, v.h * 0.55, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h * 0.55, Math.max(v.w, v.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  ctx.restore();
  void PH;
}
