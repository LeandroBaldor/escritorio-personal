import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawRunner } from './runnerCharacter';
import {
  BURN_T, elevatorAt, floorY, heliState, LAVA_DELAY, meters, newLava, nextLanding, PLAYER_H, PLAYER_W, personState, personX, sparkActive, sparkWarning, step, takeEvents, towerOf, WALL,
  type Building, type Climb, type Escape, type Fallen, type Fire, type Heli, type Input, type LavaGame, type LoseReason, type Person, type Plat, type Spark, type Zip,
} from './lava';

const RECORD_KEY = 'escritorio-personal-juegos:lava-record';
export interface LavaRecord { height: number; time: number | null } // metros más altos y mejor tiempo hasta el helicóptero
export const readLavaRecord = (): LavaRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.height === 'number' ? v : { height: 0, time: null }; } catch { return { height: 0, time: null }; }
};
const saveRecord = (value: LavaRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatLavaTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
const TOWER_M = meters(towerOf(newLava(0)).top);

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
interface View { w: number; h: number; s: number; cx: number; cy: number; t: number; dpr: number }
const X = (v: View, x: number) => (x - v.cx) * v.s;
const Y = (v: View, y: number) => v.h - (y - v.cy) * v.s;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const visible = (v: View, x1: number, x2: number, y1: number, y2: number) => X(v, x2) > -40 && X(v, x1) < v.w + 40 && Y(v, y1) > -40 && Y(v, y2) < v.h + 40;
const font = (weight: number, px: number) => `${weight} ${Math.max(8, Math.round(px))}px Nunito, system-ui`;

// ---------- Texturas (empapelados, azulejos, ladrillos, hormigón, parquet) ----------
// Cada textura se pinta una sola vez en un canvas chiquito y se repite pegada al mundo (no a la pantalla).
const PX = 48; // píxeles por unidad en las texturas
type Painter = (c: CanvasRenderingContext2D, w: number, h: number) => void;
const tileCache = new Map<string, HTMLCanvasElement | null>();
const patternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern | null>>();
function texture(ctx: CanvasRenderingContext2D, v: View, key: string, wu: number, hu: number, paint: Painter) {
  let cache = patternCache.get(ctx);
  if (!cache) { cache = new Map(); patternCache.set(ctx, cache); }
  let pat = cache.get(key);
  if (pat === undefined) {
    let tile = tileCache.get(key);
    if (tile === undefined) {
      tile = document.createElement('canvas');
      tile.width = Math.round(wu * PX); tile.height = Math.round(hu * PX);
      const c = tile.getContext('2d');
      if (c) paint(c, tile.width, tile.height); else tile = null;
      tileCache.set(key, tile);
    }
    pat = tile ? ctx.createPattern(tile, 'repeat') : null;
    cache.set(key, pat);
  }
  if (pat && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([v.s / PX, 0, 0, v.s / PX, X(v, 0), Y(v, 0)]));
  return pat;
}
function fillTex(ctx: CanvasRenderingContext2D, v: View, pat: CanvasPattern | null, fallback: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = pat ?? fallback; ctx.fillRect(X(v, x), Y(v, y + h), w * v.s + 1, h * v.s + 1);
}
const speckle = (c: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number, dark: string, light: string) => {
  for (let i = 0; i < n; i++) { c.fillStyle = hash(seed + i) < 0.5 ? dark : light; c.fillRect(hash(seed + i * 3) * w, hash(seed + i * 7) * h, 1 + hash(i) * 2, 1 + hash(i + 5) * 2); }
};
const stripes = (base: string, ink: string): Painter => (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); c.fillStyle = ink; c.fillRect(0, 0, w * 0.14, h); c.fillRect(w * 0.42, 0, w * 0.04, h); c.fillRect(w * 0.56, 0, w * 0.04, h); speckle(c, w, h, 40, 3, 'rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)'); };
const damask = (base: string, ink: string): Painter => (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h); c.fillStyle = ink;
  for (const [cx, cy] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) {
    c.beginPath(); c.moveTo(cx, cy - h * 0.2); c.quadraticCurveTo(cx + w * 0.16, cy, cx, cy + h * 0.2); c.quadraticCurveTo(cx - w * 0.16, cy, cx, cy - h * 0.2); c.fill();
    c.beginPath(); c.arc(cx, cy - h * 0.27, w * 0.035, 0, Math.PI * 2); c.arc(cx, cy + h * 0.27, w * 0.035, 0, Math.PI * 2); c.fill();
  }
  speckle(c, w, h, 40, 9, 'rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)');
};
const dots = (base: string, ink: string): Painter => (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); c.fillStyle = ink; for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) { c.beginPath(); c.arc(x * w, y * h, w * 0.06, 0, Math.PI * 2); c.fill(); } speckle(c, w, h, 30, 4, 'rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'); };
const plaster = (base: string): Painter => (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); speckle(c, w, h, 160, 11, 'rgba(0,0,0,0.07)', 'rgba(255,255,255,0.08)'); };
const tiles = (base: string, grout: string): Painter => (c, w, h) => {
  c.fillStyle = grout; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = (i * w) / 2 + 1, y = (j * h) / 2 + 1, tw = w / 2 - 2, th = h / 2 - 2;
    c.fillStyle = base; c.fillRect(x, y, tw, th);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, tw, 2); c.fillRect(x, y, 2, th);
  }
};
const bricks = (base: number, sat: number, light: number, mortar: string): Painter => (c, w, h) => {
  c.fillStyle = mortar; c.fillRect(0, 0, w, h);
  const bh = h / 2, bw = w / 2;
  for (let r = 0; r < 2; r++) for (let i = -1; i < 3; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0), n = r * 10 + i + 3;
    c.fillStyle = hsl(base + (hash(n) - 0.5) * 10, sat, light + (hash(n + 7) - 0.5) * 10);
    c.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 1, r * bh + bh - 3, bw - 2, 2);
  }
  speckle(c, w, h, 50, 21, 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.08)');
};
const concrete = (light: number): Painter => (c, w, h) => { c.fillStyle = hsl(30, 4, light); c.fillRect(0, 0, w, h); speckle(c, w, h, 220, 31, 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.1)'); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, h - 2, w, 1); c.beginPath(); c.arc(w * 0.3, h * 0.4, 2, 0, Math.PI * 2); c.fill(); };
const parquet = (hue: number): Painter => (c, w, h) => {
  for (let i = 0; i < 4; i++) { c.fillStyle = hsl(hue, 45, 32 + hash(i + hue) * 14); c.fillRect((i * w) / 4, 0, w / 4, h); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect((i * w) / 4, 0, 1, h); }
};

// ---------- Fondo: cielo de humo y una ciudad que se incendia a lo lejos ----------
function drawBackground(ctx: CanvasRenderingContext2D, v: View) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.h);
  sky.addColorStop(0, '#140b17'); sky.addColorStop(0.5, '#3f1714'); sky.addColorStop(1, '#a43d17');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, v.w, v.h);
  // Tres capas de edificios lejanos (más lejos = más chicos y más lentos), algunos prendidos fuego.
  const layers = [{ k: 0.18, D: 9, col: [20, 30, 18] }, { k: 0.3, D: 8, col: [12, 25, 13] }, { k: 0.45, D: 7.5, col: [8, 22, 9] }];
  layers.forEach(({ k, D, col }, li) => {
    const sc = v.s * k, base = v.h + v.cy * sc;
    const i1 = Math.floor((v.cx - 30) / D), i2 = Math.ceil((v.cx + v.w / sc + 10) / D);
    for (let i = i1; i <= i2; i++) {
      const n = i * 7 + li * 1000;
      const bw = D * (0.55 + hash(n) * 0.4), bh = 20 + hash(n + 1) * (70 + li * 25), bx = i * D + hash(n + 2) * D * 0.3;
      const x = (bx - v.cx) * sc, w = bw * sc, top = base - bh * sc;
      if (x > v.w || x + w < 0 || top > v.h) continue;
      ctx.fillStyle = hsl(col[0], col[1], col[2]); ctx.fillRect(x, top, w, v.h - top);
      const onFire = hash(n + 3) < 0.4;
      // Ventanas: algunas prendidas, las de los pisos incendiados titilan de naranja.
      const rows = Math.floor(bh / 3), cols = Math.max(2, Math.floor(bw / 1.6)), fireFrom = Math.floor(rows * (0.3 + hash(n + 4) * 0.5));
      for (let r = 0; r < rows; r++) {
        const wy = base - (r * 3 + 1.2) * sc;
        if (wy < -10 || wy > v.h) continue;
        const burning = onFire && r >= fireFrom && r < fireFrom + 4;
        for (let c = 0; c < cols; c++) {
          const m = n * 31 + r * 13 + c;
          if (!burning && hash(m) > 0.22) continue;
          ctx.fillStyle = burning ? `rgba(255,${110 + Math.floor(70 * Math.abs(Math.sin(v.t * 6 + m)))},30,${0.65 + 0.35 * Math.sin(v.t * 9 + m)})` : 'rgba(250,204,120,0.35)';
          ctx.fillRect(x + ((c + 0.3) * w) / cols, wy - 1.1 * sc, (0.45 * w) / cols, 1.1 * sc);
        }
      }
      if (onFire) {
        // Llamas arriba y una columna de humo.
        const fy = base - (fireFrom * 3 + 6) * sc;
        const glow = ctx.createRadialGradient(x + w / 2, fy, 0, x + w / 2, fy, w * 1.2);
        glow.addColorStop(0, 'rgba(255,140,40,0.35)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = glow; ctx.fillRect(x - w, fy - w * 1.2, w * 3, w * 2.4);
        const fTop = hash(n + 5) < 0.5 ? top : fy;
        for (let j = 0; j < 5; j++) {
          const fx = x + ((j + 0.5) * w) / 5, fl = sc * (2 + 2.5 * Math.abs(Math.sin(v.t * 5 + j + n)));
          ctx.fillStyle = j % 2 ? 'rgba(251,146,60,0.9)' : 'rgba(253,224,71,0.85)';
          ctx.beginPath(); ctx.moveTo(fx - w / 9, fTop); ctx.quadraticCurveTo(fx, fTop - fl * 1.4, fx + w / 9, fTop); ctx.fill();
        }
        for (let j = 0; j < 5; j++) {
          const life = (v.t * 0.05 + hash(n + j * 9)) % 1, r = w * (0.4 + life * 1.4);
          const sx = x + w / 2 + Math.sin(life * 4 + n) * w * 0.6 + life * w * 1.5, sy = fTop - life * sc * 45;
          const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          smoke.addColorStop(0, `rgba(30,24,24,${0.45 * (1 - life)})`); smoke.addColorStop(1, 'rgba(30,24,24,0)');
          ctx.fillStyle = smoke; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        }
      }
    }
  });
  // Humo que pasa.
  for (let i = 0; i < 7; i++) {
    const x = ((hash(i) * v.w * 1.6 + v.t * (8 + hash(i + 9) * 12)) % (v.w * 1.6)) - v.w * 0.3, y = v.h * (0.1 + hash(i + 4) * 0.5);
    const r = v.w * (0.12 + hash(i + 7) * 0.1);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,30,30,0.45)'); gr.addColorStop(1, 'rgba(40,30,30,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// El fondo se dibuja a menos resolución y se agranda: está lejos y lleno de humo, así que no se nota y
// es mucho más liviano.
const BG_SCALE = 0.6;
let bgCanvas: HTMLCanvasElement | null = null;
function drawSoftBackground(ctx: CanvasRenderingContext2D, v: View) {
  const w = Math.max(1, Math.ceil(v.w * BG_SCALE)), h = Math.max(1, Math.ceil(v.h * BG_SCALE));
  bgCanvas ??= document.createElement('canvas');
  if (bgCanvas.width !== w || bgCanvas.height !== h) { bgCanvas.width = w; bgCanvas.height = h; }
  const c = bgCanvas.getContext('2d');
  if (!c) return drawBackground(ctx, v);
  c.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0);
  drawBackground(c, v);
  ctx.drawImage(bgCanvas, 0, 0, v.w, v.h);
}

// Cenizas y chispas que suben desde la lava (delante de todo).
function drawEmbers(ctx: CanvasRenderingContext2D, v: View) {
  for (let i = 0; i < 46; i++) {
    const life = (v.t * (0.18 + hash(i) * 0.2) + hash(i + 50)) % 1;
    const x = (hash(i + 3) * v.w + Math.sin(v.t * 1.3 + i) * 18) % v.w, y = v.h * (1 - life);
    ctx.fillStyle = i % 3 ? `rgba(255,${120 + Math.floor(hash(i) * 100)},40,${0.85 * (1 - life)})` : `rgba(80,70,70,${0.6 * (1 - life)})`;
    ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i + 8) * 2, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Departamentos: paredes con textura, manchas y muebles de fondo ----------
const facade = (b: Building) => hsl(b.hue, 28 + b.tone * 22, 30 + b.tone * 20);
type Theme = 'living' | 'bedroom' | 'kitchen' | 'bath' | 'office';
const THEMES: Theme[] = ['living', 'bedroom', 'kitchen', 'living', 'bedroom', 'bath', 'office'];
const roomTheme = (b: Building, k: number, r: number) => THEMES[Math.floor(hash(b.id * 13 + k * 7 + r * 3) * THEMES.length)];

function wallTexture(ctx: CanvasRenderingContext2D, v: View, theme: Theme, hue: number, seed: number) {
  const sat = 20 + Math.floor(hash(seed) * 30), light = 62 + Math.floor(hash(seed + 1) * 18), h = Math.round(hue / 10) * 10;
  const base = hsl(h, sat, light), ink = hsl(h, sat + 10, light - 9);
  const style = Math.floor(hash(seed + 2) * 3);
  if (theme === 'bath') return texture(ctx, v, `tile-${h}`, 0.5, 0.5, tiles(hsl(h, 35, 82), '#cbd5e1'));
  if (theme === 'office') return texture(ctx, v, `plaster-${h}-${light}`, 1, 1, plaster(hsl(h, 10, light + 6)));
  if (style === 0) return texture(ctx, v, `stripes-${h}-${sat}-${light}`, 1, 1, stripes(base, ink));
  if (style === 1) return texture(ctx, v, `damask-${h}-${sat}-${light}`, 1, 1, damask(base, ink));
  return texture(ctx, v, `dots-${h}-${sat}-${light}`, 1, 1, dots(base, ink));
}

function drawWindowView(ctx: CanvasRenderingContext2D, wx: number, wy: number, ww: number, wh: number, t: number, seed: number) {
  const gr = ctx.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#2a1416'); gr.addColorStop(1, '#f97316');
  ctx.fillStyle = gr; ctx.fillRect(wx, wy, ww, wh);
  // Afuera también se queman edificios.
  ctx.fillStyle = '#1c0d0d';
  for (let i = 0; i < 3; i++) { const bx = wx + (i / 3) * ww, bh = wh * (0.3 + hash(seed + i) * 0.5); ctx.fillRect(bx, wy + wh - bh, ww / 3 - 1, bh); }
  ctx.fillStyle = `rgba(253,186,116,${0.5 + 0.5 * Math.sin(t * 7 + seed)})`;
  ctx.beginPath(); ctx.moveTo(wx + ww * 0.15, wy + wh * 0.6); ctx.quadraticCurveTo(wx + ww * 0.25, wy + wh * 0.25, wx + ww * 0.35, wy + wh * 0.6); ctx.fill();
}

function drawPicture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const kind = Math.floor(hash(seed) * 4);
  if (kind === 0) { // paisaje
    ctx.fillStyle = '#93c5fd'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.7, y + h * 0.8); ctx.lineTo(x + w, y + h * 0.5); ctx.lineTo(x + w, y + h); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.25, h * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 1) { // abstracto
    ctx.fillStyle = '#fef3c7'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(x + w * 0.1, y + h * 0.15, w * 0.35, h * 0.5);
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(x + w * 0.68, y + h * 0.6, h * 0.25, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 2) { // retrato
    ctx.fillStyle = '#a16207'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.4, h * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e293b'; ctx.fillRect(x + w * 0.25, y + h * 0.62, w * 0.5, h * 0.38);
  } else { // flores
    ctx.fillStyle = '#e0f2fe'; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#f472b6', '#facc15', '#a78bfa'][i]; ctx.beginPath(); ctx.arc(x + w * (0.25 + i * 0.25), y + h * 0.4, h * 0.13, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(x + w * (0.25 + i * 0.25), y + h * 0.5); ctx.lineTo(x + w * 0.5, y + h * 0.95); } ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w * 0.3, h);
}

// Un adorno de fondo (no se puede pisar), según el tipo de habitación.
function drawDecorItem(ctx: CanvasRenderingContext2D, kind: string, px: number, base: number, top: number, s: number, t: number, seed: number) {
  const wallY = (u: number) => base - u * s; // a u unidades del piso
  switch (kind) {
    case 'window': {
      const ww = s * 1.2, wh = s * 1.15, wx = px - ww / 2, wy = wallY(2.25);
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      drawWindowView(ctx, wx, wy, ww, wh, t, seed);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww * 0.4, wy); ctx.lineTo(wx + ww * 0.55, wy); ctx.lineTo(wx + ww * 0.15, wy + wh); ctx.fill();
      // cortinas y barral
      const cc = hsl((seed * 47) % 360, 45, 45);
      ctx.fillStyle = '#57534e'; ctx.fillRect(wx - s * 0.35, wy - s * 0.15, ww + s * 0.7, s * 0.05);
      ctx.fillStyle = cc;
      for (const side of [-1, 1]) {
        const cx = side < 0 ? wx - s * 0.32 : wx + ww + s * 0.02;
        ctx.beginPath(); ctx.moveTo(cx, wy - s * 0.1); ctx.lineTo(cx + s * 0.3, wy - s * 0.1); ctx.quadraticCurveTo(cx + s * 0.15 + side * s * 0.1, wy + wh * 0.6, cx + s * 0.3, wy + wh + s * 0.2); ctx.lineTo(cx, wy + wh + s * 0.2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(cx + s * 0.1, wy - s * 0.1, s * 0.04, wh + s * 0.3); ctx.fillStyle = cc;
      }
      // radiador abajo
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(px - s * 0.45, wallY(0.75), s * 0.9, s * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 1; i < 6; i++) ctx.fillRect(px - s * 0.45 + (i * s * 0.9) / 6, wallY(0.75), 1.5, s * 0.45);
      break;
    }
    case 'picture': drawPicture(ctx, px - s * 0.45, wallY(2.35), s * 0.9, s * 0.65, seed); break;
    case 'shelf': {
      ctx.fillStyle = '#78350f'; ctx.fillRect(px - s * 0.6, wallY(1.7), s * 1.2, s * 0.06); ctx.fillRect(px - s * 0.6, wallY(2.25), s * 1.2, s * 0.06);
      for (const sy of [1.7, 2.25]) for (let i = 0; i < 7; i++) { const bh = s * (0.3 + hash(seed + i + sy) * 0.15); ctx.fillStyle = hsl((seed * 30 + i * 50) % 360, 50, 40); ctx.fillRect(px - s * 0.55 + i * s * 0.12 + (i > 4 ? s * 0.15 : 0), wallY(sy) - bh, s * 0.1, bh); }
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(px + s * 0.45, wallY(2.25) - s * 0.12, s * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'clock': {
      const cy = wallY(2.3);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, cy, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px + Math.cos(t * 0.5) * s * 0.15, cy + Math.sin(t * 0.5) * s * 0.15); ctx.moveTo(px, cy); ctx.lineTo(px, cy - s * 0.1); ctx.stroke();
      break;
    }
    case 'tv': {
      ctx.fillStyle = '#111827'; ctx.fillRect(px - s * 0.6, wallY(2.1), s * 1.2, s * 0.7);
      ctx.fillStyle = Math.floor(t * 3 + seed) % 4 ? hsl((seed * 40 + Math.floor(t * 2) * 60) % 360, 60, 50, 0.85) : '#e5e7eb';
      ctx.fillRect(px - s * 0.54, wallY(2.04), s * 1.08, s * 0.58);
      break;
    }
    case 'ac': {
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(px - s * 0.5, wallY(2.6), s, s * 0.3, s * 0.06); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(px - s * 0.42, wallY(2.36), s * 0.84, s * 0.04);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(px + s * 0.35, wallY(2.55), 3, 3);
      break;
    }
    case 'floorlamp': {
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, wallY(1.5)); ctx.stroke();
      ctx.fillStyle = '#1f2937'; ctx.fillRect(px - s * 0.18, base - s * 0.05, s * 0.36, s * 0.05);
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(px - s * 0.25, wallY(1.45)); ctx.lineTo(px + s * 0.25, wallY(1.45)); ctx.lineTo(px + s * 0.15, wallY(1.8)); ctx.lineTo(px - s * 0.15, wallY(1.8)); ctx.fill();
      break;
    }
    case 'plant': {
      ctx.fillStyle = '#9a3412'; ctx.beginPath(); ctx.moveTo(px - s * 0.22, base - s * 0.4); ctx.lineTo(px + s * 0.22, base - s * 0.4); ctx.lineTo(px + s * 0.16, base); ctx.lineTo(px - s * 0.16, base); ctx.fill();
      ctx.fillStyle = '#15803d'; for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.ellipse(px + (j - 2.5) * s * 0.1, base - s * 0.7, s * 0.09, s * 0.35, (j - 2.5) * 0.35, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'mirror': {
      ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.ellipse(px, wallY(1.9), s * 0.36, s * 0.48, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.ellipse(px, wallY(1.9), s * 0.3, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px - s * 0.15, wallY(2.1), s * 0.06, s * 0.3);
      break;
    }
    case 'cabinets': {
      ctx.fillStyle = hsl((seed * 23) % 360, 25, 85); ctx.fillRect(px - s * 0.8, wallY(2.75), s * 1.6, s * 0.75);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.strokeRect(px - s * 0.78 + (i * s * 1.56) / 3, wallY(2.73), (s * 1.56) / 3 - 2, s * 0.71); ctx.fillStyle = '#94a3b8'; ctx.fillRect(px - s * 0.78 + ((i + 0.5) * s * 1.56) / 3 - 4, wallY(2.1), 8, 2); }
      break;
    }
    case 'hood': {
      ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.moveTo(px - s * 0.5, wallY(2.1)); ctx.lineTo(px + s * 0.5, wallY(2.1)); ctx.lineTo(px + s * 0.2, wallY(2.5)); ctx.lineTo(px - s * 0.2, wallY(2.5)); ctx.fill();
      ctx.fillRect(px - s * 0.15, top, s * 0.3, wallY(2.5) - top);
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px - s * 0.3 + i * s * 0.3, wallY(1.95)); ctx.lineTo(px - s * 0.3 + i * s * 0.3, wallY(1.75)); ctx.stroke(); }
      ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(px - s * 0.3, wallY(1.7), s * 0.1, 0, Math.PI * 2); ctx.arc(px + s * 0.3, wallY(1.68), s * 0.12, 0, Math.PI * 2); ctx.fill(); // sartenes colgadas
      break;
    }
    case 'towel': {
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(px - s * 0.35, wallY(1.7), s * 0.7, s * 0.04);
      ctx.fillStyle = hsl((seed * 61) % 360, 55, 60); ctx.fillRect(px - s * 0.3, wallY(1.7), s * 0.28, s * 0.55); ctx.fillStyle = hsl((seed * 61 + 120) % 360, 55, 60); ctx.fillRect(px + s * 0.03, wallY(1.7), s * 0.26, s * 0.48);
      break;
    }
    case 'tub': {
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(px - s * 0.8, base - s * 0.55, s * 1.6, s * 0.55, [s * 0.25, s * 0.25, s * 0.05, s * 0.05]); ctx.fill();
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + s * 0.6, base - s * 0.55); ctx.lineTo(px + s * 0.6, wallY(1.9)); ctx.lineTo(px + s * 0.4, wallY(1.9)); ctx.stroke();
      ctx.fillStyle = 'rgba(147,197,253,0.6)'; ctx.fillRect(px - s * 0.9, wallY(2.4), s * 0.12, s * 1.85); // cortina de baño
      break;
    }
    case 'toilet': {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(px - s * 0.12, wallY(1.05), s * 0.32, s * 0.45);
      ctx.beginPath(); ctx.roundRect(px - s * 0.3, base - s * 0.45, s * 0.55, s * 0.18, s * 0.08); ctx.fill();
      ctx.fillRect(px - s * 0.15, base - s * 0.3, s * 0.25, s * 0.3);
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.strokeRect(px - s * 0.12, wallY(1.05), s * 0.32, s * 0.45);
      break;
    }
    case 'sink': {
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(px - s * 0.3, wallY(0.95), s * 0.6, s * 0.18, s * 0.06); ctx.fill();
      ctx.fillRect(px - s * 0.07, wallY(0.77), s * 0.14, s * 0.77);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(px - s * 0.03, wallY(1.12), s * 0.06, s * 0.17);
      break;
    }
    case 'board': {
      ctx.fillStyle = '#b45309'; ctx.fillRect(px - s * 0.6, wallY(2.4), s * 1.2, s * 0.8);
      ctx.fillStyle = '#d6a76c'; ctx.fillRect(px - s * 0.55, wallY(2.35), s * 1.1, s * 0.7);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#fde047', '#fff', '#93c5fd', '#fda4af', '#bbf7d0'][i]; ctx.fillRect(px - s * 0.5 + hash(seed + i) * s * 0.8, wallY(2.3) + hash(seed + i * 3) * s * 0.4, s * 0.22, s * 0.2); }
      break;
    }
    case 'calendar': {
      ctx.fillStyle = '#fff'; ctx.fillRect(px - s * 0.25, wallY(2.3), s * 0.5, s * 0.6);
      ctx.fillStyle = '#e5534b'; ctx.fillRect(px - s * 0.25, wallY(2.3), s * 0.5, s * 0.14);
      ctx.fillStyle = '#cbd5e1'; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) ctx.fillRect(px - s * 0.2 + c * s * 0.11, wallY(2.1) + r * s * 0.1, s * 0.07, s * 0.06);
      break;
    }
    case 'poster': {
      ctx.fillStyle = hsl((seed * 83) % 360, 60, 45); ctx.fillRect(px - s * 0.35, wallY(2.4), s * 0.7, s * 0.95);
      ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(px, wallY(2.0), s * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - s * 0.25, wallY(1.65), s * 0.5, s * 0.08);
      break;
    }
    case 'coatrack': {
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, wallY(1.8)); ctx.moveTo(px - s * 0.2, base); ctx.lineTo(px, base - s * 0.15); ctx.lineTo(px + s * 0.2, base); ctx.stroke();
      ctx.fillStyle = hsl((seed * 37) % 360, 40, 35); ctx.beginPath(); ctx.moveTo(px + s * 0.02, wallY(1.75)); ctx.lineTo(px + s * 0.25, wallY(1.1)); ctx.lineTo(px - s * 0.05, wallY(1.1)); ctx.fill();
      break;
    }
    case 'sconce': {
      ctx.fillStyle = '#a16207'; ctx.fillRect(px - 2, wallY(2.05), 4, s * 0.2);
      ctx.fillStyle = 'rgba(253,230,138,0.95)'; ctx.beginPath(); ctx.moveTo(px - s * 0.14, wallY(2.0)); ctx.lineTo(px + s * 0.14, wallY(2.0)); ctx.lineTo(px + s * 0.08, wallY(2.25)); ctx.lineTo(px - s * 0.08, wallY(2.25)); ctx.fill();
      break;
    }
  }
}
const DECOR: Record<Theme, string[]> = {
  living: ['window', 'picture', 'shelf', 'tv', 'floorlamp', 'plant', 'clock', 'ac', 'picture', 'window'],
  bedroom: ['window', 'picture', 'mirror', 'poster', 'coatrack', 'sconce', 'plant', 'window', 'ac'],
  kitchen: ['cabinets', 'hood', 'window', 'clock', 'shelf', 'cabinets', 'calendar'],
  bath: ['mirror', 'towel', 'tub', 'toilet', 'sink', 'mirror'],
  office: ['board', 'shelf', 'calendar', 'window', 'clock', 'plant', 'shelf', 'poster'],
};

function drawRoom(ctx: CanvasRenderingContext2D, g: LavaGame, b: Building, k: number, a: number, c: number, r: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), fh = y1 - y0, seed = b.id * 1000 + k * 10 + r;
  const theme = roomTheme(b, k, r), hue = (b.hue + k * 37 + r * 71) % 360;
  // Empapelado / pintura / azulejos.
  fillTex(ctx, v, wallTexture(ctx, v, theme, hue, seed), hsl(hue, 30, 70), a, y0, c - a, fh);
  if (theme === 'kitchen') fillTex(ctx, v, texture(ctx, v, `ktile-${Math.round(hue / 30)}`, 0.5, 0.5, tiles(hsl(Math.round(hue / 30) * 30, 30, 86), '#d6d3d1')), '#e7e5e4', a, y0, c - a, 1.45);
  // Moldura arriba, zócalo abajo y un enchufe.
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(X(v, a), Y(v, y1), (c - a) * s, s * 0.08);
  ctx.fillStyle = 'rgba(60,40,30,0.55)'; ctx.fillRect(X(v, a), Y(v, y0) - s * 0.14, (c - a) * s, s * 0.14);
  ctx.fillStyle = '#f5f5f4'; ctx.fillRect(X(v, a + 0.9), Y(v, y0 + 0.35), s * 0.12, s * 0.16);
  // Manchas: hollín arriba, humedad y pedazos de revoque caídos que dejan ver el ladrillo.
  const soot = ctx.createLinearGradient(0, Y(v, y1), 0, Y(v, y1 - 1.1));
  soot.addColorStop(0, 'rgba(20,12,10,0.45)'); soot.addColorStop(1, 'rgba(20,12,10,0)');
  ctx.fillStyle = soot; ctx.fillRect(X(v, a), Y(v, y1), (c - a) * s, 1.1 * s);
  if (hash(seed + 41) < 0.55) {
    const sx = X(v, a + (c - a) * hash(seed + 42)), sy = Y(v, y0 + fh * (0.5 + hash(seed + 43) * 0.35)), sr = s * (0.35 + hash(seed + 44) * 0.4);
    const st = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr);
    st.addColorStop(0, 'rgba(120,90,40,0.12)'); st.addColorStop(0.85, 'rgba(110,80,30,0.3)'); st.addColorStop(1, 'rgba(110,80,30,0)');
    ctx.fillStyle = st; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  if (theme !== 'bath' && hash(seed + 45) < 0.45) {
    const px = a + 0.6 + (c - a - 1.2) * hash(seed + 46), py = y0 + 0.4 + fh * 0.4 * hash(seed + 47), pw = 0.5 + hash(seed + 48) * 0.6;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const ang = (i / 9) * Math.PI * 2, rr = pw * (0.6 + hash(seed + 50 + i) * 0.4); const xx = X(v, px + Math.cos(ang) * rr), yy = Y(v, py + Math.sin(ang) * rr * 0.6); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
    ctx.closePath(); ctx.clip();
    fillTex(ctx, v, texture(ctx, v, 'brick-inner', 1, 0.5, bricks(12, 45, 42, '#a8a29e')), '#9a3412', px - pw, py - pw, pw * 2, pw * 2);
    ctx.restore();
  }
  // Adornos de fondo según la habitación, más una lámpara en el techo.
  const list = DECOR[theme], n = Math.max(1, Math.floor((c - a - 1) / 1.7));
  const base = Y(v, y0), top = Y(v, y1);
  ctx.globalAlpha = 0.92;
  for (let i = 0; i < n; i++) {
    const cx = a + 0.5 + (i + 0.5) * (c - a - 1) / n + (hash(seed + i) - 0.5) * 0.4;
    drawDecorItem(ctx, list[Math.floor(hash(seed + i * 13) * list.length)], X(v, cx), base, top, s, v.t, seed + i);
  }
  ctx.globalAlpha = 1;
  // Piso: parquet o cerámica.
  const floorPat = theme === 'kitchen' || theme === 'bath' ? texture(ctx, v, 'floor-tile', 0.5, 0.5, tiles('#e7e5e4', '#a8a29e')) : texture(ctx, v, `parquet-${(b.hue % 4) * 8 + 20}`, 1, 0.5, parquet((b.hue % 4) * 8 + 20));
  fillTex(ctx, v, floorPat, '#92400e', a, y0, c - a, 0.07);
  // Pared quemada arriba de los incendios.
  const fire = g.fires.find(f => Math.abs(f.y - y0) < 0.01 && f.x2 > a && f.x1 < c);
  if (fire) {
    const fx = X(v, (fire.x1 + fire.x2) / 2);
    const burnt = ctx.createRadialGradient(fx, Y(v, y0 + 1.5), 0, fx, Y(v, y0 + 1.5), s * 2);
    burnt.addColorStop(0, 'rgba(15,8,6,0.8)'); burnt.addColorStop(1, 'rgba(15,8,6,0)');
    ctx.fillStyle = burnt; ctx.fillRect(Math.max(X(v, a), fx - s * 2), Y(v, y0 + 3.5), Math.min(X(v, c), fx + s * 2) - Math.max(X(v, a), fx - s * 2), s * 4);
  }
}

// Lo que se mueve en cada habitación: la lámpara del techo (algunas titilan) y el resplandor del fuego.
function drawRoomLive(ctx: CanvasRenderingContext2D, g: LavaGame, b: Building, k: number, a: number, c: number, r: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), seed = b.id * 1000 + k * 10 + r, top = Y(v, y1);
  const lx = X(v, (a + c) / 2 + (hash(seed + 7) - 0.5));
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, top + s * 0.4); ctx.stroke();
  const flick = 0.75 + 0.25 * Math.sin(v.t * (hash(seed + 8) < 0.3 ? 23 : 0.7) + seed);
  ctx.fillStyle = `rgba(251,191,36,${flick})`; ctx.beginPath(); ctx.moveTo(lx - s * 0.25, top + s * 0.62); ctx.lineTo(lx + s * 0.25, top + s * 0.62); ctx.lineTo(lx + s * 0.12, top + s * 0.4); ctx.lineTo(lx - s * 0.12, top + s * 0.4); ctx.fill();
  const fire = g.fires.find(f => Math.abs(f.y - y0) < 0.01 && f.x2 > a && f.x1 < c);
  if (fire) {
    const fx = X(v, (fire.x1 + fire.x2) / 2), fy = Y(v, y0 + 0.8), rr = s * 3.2, left = Math.max(X(v, a), fx - rr), right = Math.min(X(v, c), fx + rr);
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr);
    glow.addColorStop(0, `rgba(255,120,30,${0.35 + 0.1 * Math.sin(v.t * 11 + seed)})`); glow.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = glow; ctx.fillRect(left, top, right - left, Y(v, y0) - top);
  }
}

function drawCracks(ctx: CanvasRenderingContext2D, b: Building, k: number, v: View) {
  ctx.strokeStyle = 'rgba(30,20,20,0.55)'; ctx.lineWidth = Math.max(1, v.s * 0.03);
  const n = Math.floor(b.floors * 1.1);
  for (let i = 0; i < n; i++) {
    const seed = b.id * 101 + i * 7;
    let x = b.x + 0.4 + hash(seed) * (b.w - 0.8), y = (hash(seed + 1) * b.floors + 0.2) * b.fh;
    if (y < floorY(b, k) + 1.6 || y > floorY(b, k + 1)) continue; // cada grieta se dibuja en el piso donde está
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y));
    for (let j = 0; j < 5; j++) { x += (hash(seed + j * 3) - 0.5) * 0.6; y -= 0.25 + hash(seed + j * 5) * 0.3; ctx.lineTo(X(v, x), Y(v, y)); }
    ctx.stroke();
  }
}

// Puerta en la pared del costado: marco, dintel arriba y la hoja abierta hacia adentro.
function drawDoor(ctx: CanvasRenderingContext2D, b: Building, k: number, side: -1 | 1, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), dh = Math.min(2.3, b.fh - 0.4);
  const xw = side < 0 ? b.x : b.x + b.w - WALL;
  ctx.fillStyle = texture(ctx, v, `brick-${b.id}`, 1, 0.5, bricks(b.hue, 25 + b.tone * 20, 30 + b.tone * 18, '#57534e')) ?? facade(b);
  ctx.fillRect(X(v, xw), Y(v, y1), WALL * s + 1, (y1 - y0 - dh) * s); // dintel
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(X(v, xw) - 2, Y(v, y0 + dh), WALL * s + 4, s * 0.08);
  ctx.fillRect(X(v, xw) - 2, Y(v, y0 + dh), 3, dh * s); ctx.fillRect(X(v, xw + WALL) - 1, Y(v, y0 + dh), 3, dh * s);
  // hoja abierta (en perspectiva) del lado de adentro
  const hx = side < 0 ? X(v, xw + WALL) : X(v, xw), dir = -side, lw = s * 0.55;
  ctx.fillStyle = hsl((b.hue + 30) % 360, 35, 38);
  ctx.beginPath(); ctx.moveTo(hx, Y(v, y0 + dh)); ctx.lineTo(hx + dir * lw, Y(v, y0 + dh) + s * 0.18); ctx.lineTo(hx + dir * lw, Y(v, y0) - s * 0.02); ctx.lineTo(hx, Y(v, y0)); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(hx + dir * lw * 0.8, Y(v, y0 + 1.05), s * 0.05, 0, Math.PI * 2); ctx.fill();
  // cartel verde de salida
  ctx.fillStyle = '#16a34a'; ctx.fillRect(X(v, xw + WALL / 2) - s * 0.3, Y(v, y0 + dh + 0.42), s * 0.6, s * 0.24);
  ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(side < 0 ? '← SALIDA' : 'SALIDA →', X(v, xw + WALL / 2), Y(v, y0 + dh + 0.3));
}

// Habitaciones de un piso: una o dos, cada una con su empapelado y sus cosas.
const roomsOf = (b: Building, k: number): [number, number][] => {
  const split = b.w > 8.5 && hash(b.id * 7 + k) < 0.65 ? b.x + b.w * (0.4 + hash(b.id + k) * 0.2) : null;
  return split ? [[b.x, split], [split, b.x + b.w]] : [[b.x, b.x + b.w]];
};
const isSlab = (p: Plat) => p.kind === 'floor' || p.kind === 'roof';
const brickOf = (ctx: CanvasRenderingContext2D, v: View, b: Building) => texture(ctx, v, `brick-${b.id}`, 1, 0.5, bricks(b.hue, 25 + b.tone * 20, 30 + b.tone * 18, '#57534e'));

// Todo lo que no se mueve de un piso: paredes, habitaciones, puertas, muebles, escalones y la losa de abajo.
function drawFloorStatic(ctx: CanvasRenderingContext2D, g: LavaGame, b: Building, k: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1);
  const mine = (p: Plat) => p.b === b.id && (p.floor === k || (p.kind === 'roof' && k === b.floors - 1));
  if (b.construction) {
    // Obra: hormigón y ladrillo a la vista, columnas; los pisos de arriba todavía no tienen paredes.
    const conc = texture(ctx, v, 'concrete', 1, 1, concrete(58)), brick = texture(ctx, v, 'brick-obra', 1, 0.5, bricks(14, 50, 40, '#b8b2a7'));
    if (k <= b.floors * 0.62) {
      fillTex(ctx, v, conc, '#a8a29e', b.x, y0, b.w, y1 - y0);
      const bw = b.w * (0.4 + hash(b.id + k) * 0.5);
      fillTex(ctx, v, brick, '#9a3412', b.x + (b.w - bw) * hash(b.id * 3 + k), y0, bw, (y1 - y0) * (k < b.floors * 0.4 ? 1 : 0.5 + hash(k) * 0.4));
    } else {
      ctx.fillStyle = 'rgba(30,20,20,0.35)'; ctx.fillRect(X(v, b.x), Y(v, y1), b.w * s, (y1 - y0) * s);
    }
    for (let cx = b.x; cx <= b.x + b.w - 0.3; cx += (b.w - 0.35) / Math.round(b.w / 3.2)) fillTex(ctx, v, conc, '#a8a29e', cx, y0, 0.35, y1 - y0);
    if (k === 0) { // cinta de peligro y cartel
      ctx.save(); ctx.beginPath(); ctx.rect(X(v, b.x), Y(v, 1.1), b.w * s, s * 0.14); ctx.clip();
      for (let x = X(v, b.x) - s; x < X(v, b.x + b.w); x += s * 0.3) { ctx.fillStyle = Math.round((x - X(v, b.x)) / (s * 0.3)) % 2 ? '#facc15' : '#111827'; ctx.beginPath(); ctx.moveTo(x, Y(v, 1.1) + s * 0.14); ctx.lineTo(x + s * 0.15, Y(v, 1.1)); ctx.lineTo(x + s * 0.3, Y(v, 1.1)); ctx.lineTo(x + s * 0.15, Y(v, 1.1) + s * 0.14); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#facc15'; ctx.fillRect(X(v, b.x + b.w / 2) - s * 1.4, Y(v, 2.5), s * 2.8, s * 0.55);
      ctx.fillStyle = '#111827'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OBRA EN CONSTRUCCIÓN', X(v, b.x + b.w / 2), Y(v, 2.22));
    }
    for (const p of g.plats) if (mine(p) && isSlab(p)) fillTex(ctx, v, texture(ctx, v, 'slab', 1, 1, concrete(48)), '#78716c', p.x, p.y - 0.24, p.w, 0.24);
  } else {
    const rooms = roomsOf(b, k);
    rooms.forEach(([a, c], r) => drawRoom(ctx, g, b, k, a, c, r, v));
    if (rooms.length > 1) { // pared y marco de la puerta entre las dos habitaciones
      const split = rooms[0][1];
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(X(v, split) - s * 0.1, Y(v, y1), s * 0.2, (y1 - y0 - 2.15) * s);
      ctx.fillStyle = '#7c5a3c'; ctx.fillRect(X(v, split) - s * 0.08, Y(v, y0 + 2.15), s * 0.16, 2.15 * s);
      ctx.fillRect(X(v, split) - s * 0.5, Y(v, y0 + 2.15), s, s * 0.1);
    }
    drawCracks(ctx, b, k, v);
    // Paredes de afuera (ladrillo) y puertas a los costados.
    const brick = brickOf(ctx, v, b);
    for (const w of g.walls) {
      if (Math.abs(w.y1 - y0) > 1e-6 || (Math.abs(w.x - (b.x + WALL / 2)) > 1e-6 && Math.abs(w.x - (b.x + b.w - WALL / 2)) > 1e-6)) continue;
      fillTex(ctx, v, brick, facade(b), w.x - WALL / 2, w.y1, WALL, w.y2 - w.y1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X(v, w.x + WALL / 2) - 2, Y(v, w.y2), 2, (w.y2 - w.y1) * s);
    }
    if (k > 0) for (const [side, set] of [[-1, b.doors.left], [1, b.doors.right]] as const) if (set.has(k)) drawDoor(ctx, b, k, side, v); // la planta baja da a la calle
    for (const p of g.plats) {
      if (!mine(p) || !isSlab(p)) continue;
      fillTex(ctx, v, texture(ctx, v, 'slab', 1, 1, concrete(48)), '#9ca3af', p.x, p.y - 0.24, p.w, 0.24);
      ctx.fillStyle = p.kind === 'roof' ? hsl(b.hue, 10, 35, 0.8) : 'rgba(0,0,0,0.12)'; ctx.fillRect(X(v, p.x), Y(v, p.y), p.w * s, s * (p.kind === 'roof' ? 0.08 : 0.04));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X(v, p.x), Y(v, p.y) + s * 0.2, p.w * s, s * 0.04);
    }
  }
  // Pisos rotos: bordes, hierros y los cascotes que cayeron al piso de abajo.
  for (const h of b.holes) {
    if (h.floor === k) {
      ctx.fillStyle = '#6b7280';
      for (const [x, d] of [[h.x1, 1], [h.x2, -1]] as const) {
        ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y0)); ctx.lineTo(X(v, x + d * 0.25), Y(v, y0 - 0.12)); ctx.lineTo(X(v, x), Y(v, y0 - 0.24)); ctx.fill();
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y0 - 0.1)); ctx.lineTo(X(v, x + d * 0.35), Y(v, y0 - 0.35)); ctx.moveTo(X(v, x), Y(v, y0 - 0.18)); ctx.lineTo(X(v, x + d * 0.3), Y(v, y0 - 0.5)); ctx.stroke();
      }
    } else if (h.floor === k + 1) {
      ctx.fillStyle = '#57534e';
      for (let i = 0; i < 4; i++) { const cx = h.x1 + (h.x2 - h.x1) * hash(h.x1 * 10 + i); ctx.fillRect(X(v, cx), Y(v, y0) - s * 0.12, s * 0.18, s * 0.12); }
    }
  }
  // Muebles y escalones de este piso.
  for (const p of g.plats) if (p.b === b.id && p.floor === k && (p.kind === 'furniture' || p.kind === 'step')) drawPlat(ctx, p, g, v);
}

// Cada piso se dibuja una sola vez en una imagen aparte y después se copia (es mucho más rápido). Se
// guardan las últimas imágenes usadas; si cambia el tamaño de la pantalla se vuelven a dibujar.
const FLOOR_PAD = 0.75, FLOOR_CACHE_MAX = 60;
const floorCache = new Map<string, HTMLCanvasElement>();
function floorImage(g: LavaGame, b: Building, k: number, v: View) {
  const dpr = v.dpr, key = `${b.id}:${k}:${v.s.toFixed(3)}:${dpr}`;
  const hit = floorCache.get(key);
  if (hit) { floorCache.delete(key); floorCache.set(key, hit); return hit; }
  const y0 = floorY(b, k), y1 = floorY(b, k + 1), w = (b.w + FLOOR_PAD * 2) * v.s, h = (y1 - y0 + 0.4) * v.s;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFloorStatic(ctx, g, b, k, { w, h, s: v.s, cx: b.x - FLOOR_PAD, cy: y0 - 0.3, t: 0, dpr });
  floorCache.set(key, canvas);
  if (floorCache.size > FLOOR_CACHE_MAX) floorCache.delete(floorCache.keys().next().value!);
  return canvas;
}

// Lo que se mueve o cambia en un edificio en construcción: andamios, red, hierros y la grúa.
function drawConstructionLive(ctx: CanvasRenderingContext2D, b: Building, v: View) {
  const s = v.s;
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(2, s * 0.05);
  for (const x of [b.x + 0.12, b.x + b.w - 0.12]) {
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, 0)); ctx.lineTo(X(v, x), Y(v, b.top + 1)); ctx.stroke();
    for (let k = 0; k < b.floors; k++) { ctx.beginPath(); ctx.moveTo(X(v, x - 0.12), Y(v, floorY(b, k) + 1.5)); ctx.lineTo(X(v, x + 0.12), Y(v, floorY(b, k + 1))); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(34,197,94,0.18)';
  const netFrom = floorY(b, Math.ceil(b.floors * 0.62));
  ctx.fillRect(X(v, b.x - 0.05), Y(v, b.top), s * 0.25, (b.top - netFrom) * s); ctx.fillRect(X(v, b.x + b.w - 0.2), Y(v, b.top), s * 0.25, (b.top - netFrom) * s);
  ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2;
  for (let x = b.x + 0.2; x < b.x + b.w; x += (b.w - 0.35) / Math.round(b.w / 3.2)) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(X(v, x + j * 0.1), Y(v, b.top)); ctx.lineTo(X(v, x + j * 0.1 + (j - 1) * 0.05), Y(v, b.top + 0.8 + j * 0.15)); ctx.stroke(); }
  // Grúa torre con la carga que se balancea.
  const mx = b.x + b.w * 0.7, mt = b.top + 9;
  if (!visible(v, mx - 11, mx + 5, b.top, mt + 1)) return;
  ctx.strokeStyle = '#eab308'; ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(X(v, mx - 0.3), Y(v, b.top)); ctx.lineTo(X(v, mx - 0.3), Y(v, mt)); ctx.moveTo(X(v, mx + 0.3), Y(v, b.top)); ctx.lineTo(X(v, mx + 0.3), Y(v, mt));
  for (let y = b.top; y < mt; y += 0.6) { ctx.moveTo(X(v, mx - 0.3), Y(v, y)); ctx.lineTo(X(v, mx + 0.3), Y(v, y + 0.6)); }
  ctx.moveTo(X(v, mx - 10), Y(v, mt)); ctx.lineTo(X(v, mx + 4), Y(v, mt)); ctx.moveTo(X(v, mx - 10), Y(v, mt + 0.5)); ctx.lineTo(X(v, mx + 4), Y(v, mt + 0.5));
  for (let x = mx - 10; x < mx + 4; x += 0.6) { ctx.moveTo(X(v, x), Y(v, mt)); ctx.lineTo(X(v, x + 0.3), Y(v, mt + 0.5)); }
  ctx.moveTo(X(v, mx), Y(v, mt + 2)); ctx.lineTo(X(v, mx - 9), Y(v, mt + 0.5)); ctx.moveTo(X(v, mx), Y(v, mt + 2)); ctx.lineTo(X(v, mx + 3.5), Y(v, mt + 0.5));
  ctx.stroke();
  ctx.fillStyle = '#57534e'; ctx.fillRect(X(v, mx + 2.6), Y(v, mt), s * 1.2, s * 0.9); // contrapeso
  ctx.fillStyle = '#eab308'; ctx.fillRect(X(v, mx + 0.35), Y(v, mt - 0.2), s * 0.8, s * 0.7); // cabina
  ctx.fillStyle = '#bae6fd'; ctx.fillRect(X(v, mx + 0.45), Y(v, mt - 0.3), s * 0.5, s * 0.35);
  const hookX = mx - 6 + Math.sin(v.t * 0.7 + b.id) * 0.35, hookY = mt - 4.5;
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(v, mx - 6), Y(v, mt)); ctx.lineTo(X(v, hookX), Y(v, hookY)); ctx.stroke();
  ctx.fillStyle = '#9a3412'; ctx.fillRect(X(v, hookX - 0.5), Y(v, hookY), s, s * 0.5);
  ctx.fillStyle = Math.floor(v.t * 1.5) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(X(v, mx - 10), Y(v, mt + 0.6), s * 0.08, 0, Math.PI * 2); ctx.fill();
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, g: LavaGame, v: View) {
  if (!visible(v, b.x - 2, b.x + b.w + 2, 0, b.top + 12)) return;
  const s = v.s;
  for (let k = 0; k < b.floors; k++) {
    const y0 = floorY(b, k), y1 = floorY(b, k + 1);
    if (!visible(v, b.x - FLOOR_PAD, b.x + b.w + FLOOR_PAD, y0 - 0.3, y1 + 0.1)) continue;
    const img = floorImage(g, b, k, v);
    if (img) ctx.drawImage(img, X(v, b.x - FLOOR_PAD), Y(v, y1 + 0.1), (b.w + FLOOR_PAD * 2) * s, (y1 - y0 + 0.4) * s);
    else drawFloorStatic(ctx, g, b, k, v);
    if (!b.construction) roomsOf(b, k).forEach(([a, c], r) => drawRoomLive(ctx, g, b, k, a, c, r, v));
  }
  if (b.construction) return drawConstructionLive(ctx, b, v);
  // Terraza: baranda, tanque de agua o antena; los edificios rotos tienen escombros.
  const ry = Y(v, b.top);
  ctx.fillStyle = facade(b); ctx.fillRect(X(v, b.x - 0.15), ry - s * 0.35, s * 0.15, s * 0.35); ctx.fillRect(X(v, b.x + b.w), ry - s * 0.35, s * 0.15, s * 0.35);
  if (b.broken) {
    for (let i = 0; i < 9; i++) {
      const cx = b.x + 0.4 + hash(b.id * 9 + i) * (b.w * 0.5), cw = 0.3 + hash(b.id + i * 5) * 0.6, ch = 0.2 + hash(b.id + i * 7) * 0.45;
      ctx.fillStyle = i % 3 ? facade(b) : '#78716c';
      ctx.beginPath(); ctx.moveTo(X(v, cx), ry); ctx.lineTo(X(v, cx + cw * 0.2), ry - ch * s); ctx.lineTo(X(v, cx + cw * 0.8), ry - ch * s * 0.7); ctx.lineTo(X(v, cx + cw), ry); ctx.fill();
    }
    ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const cx = X(v, b.x + 0.5 + i * 0.7); ctx.beginPath(); ctx.moveTo(cx, ry); ctx.lineTo(cx + s * 0.15, ry - s * 0.6); ctx.stroke(); }
  } else if (b.tower) {
    for (let i = 0; i < 2; i++) { const bx = X(v, b.x + 0.4 + i * (b.w - 0.8)); ctx.fillStyle = Math.floor(v.t * 2 + i) % 2 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(bx, ry - s * 0.5, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  } else if (b.roofDecor && hash(b.id + 3) < 0.55) {
    const tx = X(v, b.x + 1 + hash(b.id) * (b.w - 3));
    ctx.fillStyle = '#57534e'; ctx.fillRect(tx, ry - s * 0.5, s * 0.12, s * 0.5); ctx.fillRect(tx + s * 1.2, ry - s * 0.5, s * 0.12, s * 0.5);
    ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.roundRect(tx - s * 0.1, ry - s * 1.6, s * 1.5, s * 1.15, s * 0.2); ctx.fill();
  } else if (b.roofDecor) {
    const ax = X(v, b.x + b.w * 0.7);
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ry); ctx.lineTo(ax, ry - s * 1.8); ctx.moveTo(ax - s * 0.4, ry - s * 1.3); ctx.lineTo(ax + s * 0.4, ry - s * 1.3); ctx.stroke();
    ctx.fillStyle = Math.floor(v.t * 1.5) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(ax, ry - s * 1.85, s * 0.08, 0, Math.PI * 2); ctx.fill();
  }
}

// La parte de arriba de un edificio que se cayó y quedó apoyada en el de al lado (se camina por encima).
function drawFallen(ctx: CanvasRenderingContext2D, f: Fallen, g: LavaGame, v: View) {
  if (!visible(v, f.x1 - 3, f.x2 + 1, f.y1 - 4, f.y2 + 1)) return;
  const A = g.buildings[f.a], s = v.s;
  const p1x = X(v, f.x1), p1y = Y(v, f.y1), p2x = X(v, f.x2), p2y = Y(v, f.y2);
  const ang = Math.atan2(p2y - p1y, p2x - p1x), L = Math.hypot(p2x - p1x, p2y - p1y), T = f.thick * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, p2x + 2, Y(v, A.top) + 1); ctx.clip(); // no se dibuja adentro del edificio de abajo
  ctx.translate(p1x, p1y); ctx.rotate(ang);
  // Cuerpo del edificio caído: fachada con ventanas, cortado en pisos a lo largo.
  ctx.fillStyle = facade(A); ctx.fillRect(-s * 0.8, 0, L + s, T);
  ctx.fillStyle = texture(ctx, v, `brick-${A.id}`, 1, 0.5, bricks(A.hue, 25 + A.tone * 20, 30 + A.tone * 18, '#57534e')) ?? facade(A);
  ctx.globalAlpha = 0.35; ctx.fillRect(-s * 0.8, 0, L + s, T); ctx.globalAlpha = 1;
  const step = A.fh * s;
  for (let u = -s * 0.8; u < L; u += step) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(u, 0, s * 0.12, T);
    for (let j = 0; j < 3; j++) {
      const wx = u + step * 0.25, wy = T * (0.12 + j * 0.3), seed = u + j;
      ctx.fillStyle = hash(seed) < 0.3 ? `rgba(255,140,40,${0.6 + 0.4 * Math.sin(v.t * 8 + seed)})` : '#1e1b1b';
      ctx.fillRect(wx, wy, step * 0.5, T * 0.18);
      ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 1.5; ctx.strokeRect(wx, wy, step * 0.5, T * 0.18);
    }
  }
  // La cara de arriba (por donde se camina) y el borde roto.
  ctx.fillStyle = '#78716c'; ctx.fillRect(-s * 0.8, -s * 0.06, L + s, s * 0.2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-s * 0.8, -s * 0.06, L + s, s * 0.05);
  ctx.fillStyle = '#44403c';
  ctx.beginPath(); ctx.moveTo(-s * 0.8, 0);
  for (let j = 0; j <= 8; j++) ctx.lineTo(-s * 0.8 - hash(j + f.id) * s * 0.5, (j / 8) * T);
  ctx.lineTo(-s * 0.4, T); ctx.fill();
  ctx.restore();
  // Polvo y cascotes al pie.
  for (let i = 0; i < 6; i++) { const cx = X(v, f.x1 - 0.8 + hash(f.id + i) * 1.6); ctx.fillStyle = '#57534e'; ctx.fillRect(cx, Y(v, A.top) - s * 0.25, s * (0.2 + hash(i) * 0.3), s * 0.25); }
  // Grieta en la pared del edificio donde pegó.
  ctx.strokeStyle = 'rgba(20,10,10,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(p2x + s * 0.4, p2y - s * 0.6); ctx.lineTo(p2x + s * 0.2, p2y - s * 1.1); ctx.moveTo(p2x, p2y); ctx.lineTo(p2x + s * 0.5, p2y + s * 0.4); ctx.stroke();
}

// ---------- Muebles, escalones, puentes, balcones, camas elásticas ----------
function drawFurniture(ctx: CanvasRenderingContext2D, p: Plat, v: View) {
  const s = v.s, x = X(v, p.x), w = p.w * s, top = Y(v, p.y), h = (p.h ?? 1) * s, base = top + h;
  const c = hsl(p.hue, 45, 45), dark = hsl(p.hue, 45, 30), light = hsl(p.hue, 45, 62);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  switch (p.furniture) {
    case 'sofa': case 'armchair':
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(x, top - h * 0.35, w, h * 0.75, s * 0.15); ctx.fill(); // respaldo
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, top, w, h * 0.55, s * 0.12); ctx.fill();
      ctx.fillStyle = light; if (p.furniture === 'sofa') { ctx.fillRect(x + w * 0.05, top + 2, w * 0.43, h * 0.18); ctx.fillRect(x + w * 0.52, top + 2, w * 0.43, h * 0.18); } else ctx.fillRect(x + w * 0.15, top + 2, w * 0.7, h * 0.18);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(x - s * 0.08, top - h * 0.05, s * 0.25, h * 0.6, s * 0.08); ctx.roundRect(x + w - s * 0.17, top - h * 0.05, s * 0.25, h * 0.6, s * 0.08); ctx.fill();
      ctx.fillStyle = '#3f2a1c'; ctx.fillRect(x + s * 0.1, base - h * 0.45, s * 0.1, h * 0.45); ctx.fillRect(x + w - s * 0.2, base - h * 0.45, s * 0.1, h * 0.45);
      if (p.furniture === 'sofa') { ctx.fillStyle = hsl((p.hue + 180) % 360, 50, 55); ctx.beginPath(); ctx.roundRect(x + w * 0.08, top - h * 0.28, w * 0.2, h * 0.28, s * 0.06); ctx.fill(); } // almohadón
      break;
    case 'bed':
      ctx.fillStyle = '#7c4a2d'; ctx.fillRect(x - s * 0.05, top - h * 0.6, s * 0.18, h * 1.6); // cabecera
      ctx.fillStyle = '#7c4a2d'; ctx.fillRect(x, top + h * 0.45, w, h * 0.3);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + s * 0.1, top, w - s * 0.1, h * 0.45);
      ctx.fillStyle = c; ctx.fillRect(x + w * 0.3, top - 1, w * 0.7, h * 0.47);
      ctx.fillStyle = light; for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.35 + i * 0.16), top - 1, w * 0.04, h * 0.47);
      ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(x + w * 0.16, top + h * 0.05, w * 0.1, h * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b3520'; ctx.fillRect(x, base - h * 0.25, s * 0.12, h * 0.25); ctx.fillRect(x + w - s * 0.12, base - h * 0.25, s * 0.12, h * 0.25);
      break;
    case 'table': case 'desk': case 'coffeetable':
      ctx.fillStyle = p.furniture === 'desk' ? '#a16207' : p.furniture === 'coffeetable' ? '#57534e' : '#92400e'; ctx.fillRect(x, top, w, s * 0.12);
      ctx.fillRect(x + s * 0.08, top, s * 0.1, h); ctx.fillRect(x + w - s * 0.18, top, s * 0.1, h);
      if (p.furniture === 'desk') { ctx.fillStyle = '#78350f'; ctx.fillRect(x + w * 0.55, top + s * 0.14, w * 0.4, h * 0.55); ctx.fillStyle = '#111827'; ctx.fillRect(x + w * 0.15, top - s * 0.55, s * 0.6, s * 0.42); ctx.fillStyle = '#38bdf8'; ctx.fillRect(x + w * 0.15 + 2, top - s * 0.55 + 2, s * 0.6 - 4, s * 0.42 - 6); }
      else if (p.furniture === 'table') { ctx.fillStyle = '#fef3c7'; ctx.fillRect(x + w * 0.1, top - s * 0.04, w * 0.8, s * 0.05); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + w * 0.5, top - s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + w * 0.2, top - s * 0.12, s * 0.1, s * 0.12); }
      else { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x + w * 0.3, top - s * 0.06, s * 0.3, s * 0.06); ctx.fillStyle = '#b45309'; ctx.fillRect(x + w * 0.7, top - s * 0.14, s * 0.1, s * 0.14); }
      break;
    case 'chair':
      ctx.fillStyle = hsl(p.hue, 35, 35); ctx.fillRect(x, top, w, s * 0.1);
      ctx.fillRect(x + w - s * 0.08, top - s * 0.55, s * 0.08, s * 0.55); ctx.fillRect(x, top, s * 0.07, h); ctx.fillRect(x + w - s * 0.08, top, s * 0.07, h);
      break;
    case 'nightstand':
      ctx.fillStyle = '#92400e'; ctx.fillRect(x, top, w, h); ctx.strokeRect(x + 3, top + 3, w - 6, h / 2 - 4); ctx.strokeRect(x + 3, top + h / 2, w - 6, h / 2 - 4);
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(x + w * 0.25, top - s * 0.35); ctx.lineTo(x + w * 0.75, top - s * 0.35); ctx.lineTo(x + w * 0.65, top - s * 0.6); ctx.lineTo(x + w * 0.35, top - s * 0.6); ctx.fill();
      ctx.fillStyle = '#57534e'; ctx.fillRect(x + w * 0.47, top - s * 0.35, w * 0.06, s * 0.35);
      break;
    case 'tvstand':
      ctx.fillStyle = '#44403c'; ctx.fillRect(x, top, w, h); ctx.strokeRect(x + 3, top + 3, w / 2 - 4, h - 6); ctx.strokeRect(x + w / 2 + 1, top + 3, w / 2 - 4, h - 6);
      ctx.fillStyle = '#111827'; ctx.fillRect(x + w * 0.15, top - s * 0.7, w * 0.7, s * 0.65); ctx.fillStyle = hsl((p.hue + Math.floor(v.t) * 40) % 360, 60, 50, 0.85); ctx.fillRect(x + w * 0.18, top - s * 0.66, w * 0.64, s * 0.55);
      break;
    case 'stove':
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(x, top, w, h); ctx.strokeRect(x, top, w, h);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x + w * 0.12, top + h * 0.3, w * 0.76, h * 0.5); ctx.fillStyle = 'rgba(251,146,60,0.5)'; ctx.fillRect(x + w * 0.16, top + h * 0.34, w * 0.68, h * 0.42);
      ctx.fillStyle = '#334155'; ctx.fillRect(x + w * 0.1, top - s * 0.25, w * 0.35, s * 0.25); // olla
      ctx.fillStyle = '#9ca3af'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + w * (0.15 + i * 0.23), top + h * 0.15, s * 0.04, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'counter':
      ctx.fillStyle = hsl(p.hue, 20, 82); ctx.fillRect(x, top + s * 0.08, w, h - s * 0.08);
      ctx.fillStyle = '#57534e'; ctx.fillRect(x - 2, top, w + 4, s * 0.1);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) { ctx.strokeRect(x + 3 + (i * (w - 6)) / 3, top + s * 0.14, (w - 6) / 3 - 3, h - s * 0.2); }
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(x + w * 0.6, top - s * 0.1, w * 0.25, s * 0.1); ctx.fillRect(x + w * 0.7, top - s * 0.35, s * 0.05, s * 0.3); // bacha y canilla
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + w * 0.2, top - s * 0.1, s * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'dresser': case 'wardrobe': case 'bookshelf':
      ctx.fillStyle = p.furniture === 'bookshelf' ? '#78350f' : hsl(p.hue, 30, 38); ctx.fillRect(x, top, w, h); ctx.strokeRect(x, top, w, h);
      if (p.furniture === 'bookshelf') {
        for (let r = 0; r < 4; r++) { const ry = top + h * (0.08 + r * 0.24); ctx.fillStyle = '#451a03'; ctx.fillRect(x + 2, ry + h * 0.18, w - 4, 2); for (let i = 0; i < 6; i++) { ctx.fillStyle = hsl((p.hue + i * 50 + r * 30) % 360, 55, 48); ctx.fillRect(x + 4 + i * (w - 8) / 6, ry + 2, (w - 8) / 6 - 2, h * 0.17); } }
      } else {
        const rows = p.furniture === 'wardrobe' ? 1 : 3;
        for (let r = 0; r < rows; r++) { ctx.strokeRect(x + 3, top + 3 + r * (h - 6) / rows, w - 6, (h - 6) / rows - 2); ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x + w / 2 + (rows === 1 ? s * 0.12 : 0), top + (r + 0.5) * h / rows, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
        if (rows === 1) { ctx.beginPath(); ctx.moveTo(x + w / 2, top + 3); ctx.lineTo(x + w / 2, base - 3); ctx.stroke(); }
        if (p.furniture === 'dresser') { ctx.fillStyle = '#f472b6'; ctx.fillRect(x + w * 0.15, top - s * 0.3, s * 0.15, s * 0.3); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x + w * 0.6, top - s * 0.45, s * 0.35, s * 0.45); }
      }
      break;
    case 'piano':
      ctx.fillStyle = '#111827'; ctx.fillRect(x, top, w, h); ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + w * 0.05, top + h * 0.35, w * 0.9, h * 0.15);
      ctx.fillStyle = '#111827'; for (let i = 0; i < 12; i++) ctx.fillRect(x + w * 0.07 + i * w * 0.075, top + h * 0.35, w * 0.03, h * 0.09);
      ctx.fillStyle = '#fde68a'; ctx.fillRect(x + w * 0.7, top - s * 0.3, s * 0.08, s * 0.3);
      break;
    case 'washer': case 'fridge':
      ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.roundRect(x, top, w, h, s * 0.08); ctx.fill(); ctx.stroke();
      if (p.furniture === 'washer') { ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.58, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.58, Math.min(w, h) * 0.2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, top + h * 0.35); ctx.lineTo(x + w, top + h * 0.35); ctx.stroke(); ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + w * 0.8, top + h * 0.1, s * 0.06, h * 0.18); ctx.fillRect(x + w * 0.8, top + h * 0.45, s * 0.06, h * 0.25); ctx.fillStyle = '#fca5a5'; ctx.fillRect(x + w * 0.2, top + h * 0.5, s * 0.12, s * 0.12); ctx.fillStyle = '#fde047'; ctx.fillRect(x + w * 0.4, top + h * 0.6, s * 0.12, s * 0.12); }
      break;
    case 'bricks':
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { ctx.fillStyle = hsl(12 + hash(r * 4 + i + p.id) * 10, 55, 40); ctx.fillRect(x + (i * w) / 4 + (r % 2 ? w / 8 : 0) - (r % 2 && i === 3 ? w / 8 : 0), top + (r * h) / 4, w / 4 - 2, h / 4 - 2); }
      ctx.fillStyle = '#a16207'; ctx.fillRect(x - 2, base - s * 0.12, w + 4, s * 0.12);
      break;
    case 'cement':
      for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) { ctx.fillStyle = r % 2 ? '#d6d3d1' : '#e7e5e4'; ctx.beginPath(); ctx.roundRect(x + (i * w) / 2 + (r % 2 ? w * 0.05 : 0), top + (r * h) / 3, w / 2 - 3, h / 3 - 2, s * 0.08); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2563eb'; ctx.fillRect(x + (i * w) / 2 + w * 0.12, top + (r * h) / 3 + h * 0.1, w * 0.2, h * 0.08); }
      break;
    case 'pallets':
      for (let r = 0; r < 5; r++) { ctx.fillStyle = r % 2 ? '#a16207' : '#ca8a04'; ctx.fillRect(x, top + (r * h) / 5, w, h / 5 - (r % 2 ? 0 : 3)); }
      ctx.fillStyle = '#713f12'; for (let i = 0; i < 3; i++) ctx.fillRect(x + (i * (w - s * 0.2)) / 2, top, s * 0.2, h);
      break;
    case 'barrels':
      for (let i = 0; i < 2; i++) { const bx = x + (i * w) / 2 + 2, bw = w / 2 - 4; ctx.fillStyle = i ? '#1d4ed8' : '#b91c1c'; ctx.beginPath(); ctx.roundRect(bx, top, bw, h, s * 0.08); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx, top + h * 0.3, bw, 3); ctx.fillRect(bx, top + h * 0.7, bw, 3); }
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(x + w * 0.25, top + h * 0.38); ctx.lineTo(x + w * 0.33, top + h * 0.55); ctx.lineTo(x + w * 0.17, top + h * 0.55); ctx.fill();
      break;
  }
}

function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, g: LavaGame, v: View) {
  if (p.kind === 'floor' || p.kind === 'roof' || p.kind === 'street' || p.kind === 'ramp' || p.kind === 'elevator') return;
  if (!visible(v, p.x - 1, p.x + p.w + 1, p.y - 2, p.y + 2)) return;
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), w = p.w * s;
  if (p.kind === 'furniture') return drawFurniture(ctx, p, v);
  if (p.kind === 'step') {
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(x, y, w, s * 0.16);
    ctx.fillStyle = '#78716c'; ctx.fillRect(x, y + s * 0.16, w, s * 0.4);
    return;
  }
  if (p.kind === 'landing' || p.kind === 'balcony') {
    ctx.fillStyle = p.kind === 'balcony' ? '#78716c' : '#374151'; ctx.fillRect(x, y, w, s * 0.14);
    ctx.strokeStyle = p.kind === 'balcony' ? '#1f2937' : '#4b5563'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x, y - s * 0.8); ctx.lineTo(x + w, y - s * 0.8);
    for (let i = 0; i <= 4; i++) { ctx.moveTo(x + (w * i) / 4, y); ctx.lineTo(x + (w * i) / 4, y - s * 0.8); }
    ctx.stroke();
    if (p.kind === 'balcony') { // una maceta
      ctx.fillStyle = '#9a3412'; ctx.fillRect(x + w * 0.3, y - s * 0.25, s * 0.22, s * 0.25);
      ctx.fillStyle = hash(p.id) < 0.5 ? '#15803d' : '#57534e'; ctx.beginPath(); ctx.arc(x + w * 0.3 + s * 0.11, y - s * 0.32, s * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (p.kind === 'pad') { // plataforma de helicóptero al costado de la torre
    ctx.fillStyle = '#334155'; ctx.fillRect(x, y, w, s * 0.2);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(x, y + s * 1.6); ctx.lineTo(x + w * 0.6, y + s * 0.2); ctx.moveTo(x, y + s * 2.4); ctx.lineTo(x + w * 0.9, y + s * 0.2); ctx.stroke();
    drawHelipad(ctx, x + w * 0.45, y, s);
    return;
  }
  if (p.kind === 'trampoline') {
    const bounce = g.player.ground === null && Math.abs(g.player.x - (p.x + p.w / 2)) < p.w / 2 && g.player.y - p.y < 0.4 && g.player.y >= p.y - 0.1 ? s * 0.18 : 0;
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(x + s * 0.1, y); ctx.lineTo(x + s * 0.2, y + s * 0.45); ctx.moveTo(x + w - s * 0.1, y); ctx.lineTo(x + w - s * 0.2, y + s * 0.45); ctx.stroke();
    ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y + bounce * 2, x + w, y); ctx.lineTo(x + w, y + s * 0.08); ctx.quadraticCurveTo(x + w / 2, y + s * 0.08 + bounce * 2, x, y + s * 0.08); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.fillRect(x - s * 0.06, y - s * 0.04, s * 0.14, s * 0.16); ctx.fillRect(x + w - s * 0.08, y - s * 0.04, s * 0.14, s * 0.16);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const sx = x + (i * w) / 8; ctx.beginPath(); ctx.moveTo(sx, y + s * 0.09); ctx.lineTo(sx + 3, y + s * 0.15); ctx.lineTo(sx - 3, y + s * 0.2); ctx.stroke(); }
    ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⬆ CAMA ELÁSTICA', x + w / 2, y + s * 0.75);
    return;
  }
  // Puentes y tablones entre edificios (los tablones tiemblan y se caen).
  if (p.gone > 0) return;
  const shake = p.crumble > 0 ? Math.sin(g.time * 60) * s * 0.04 : 0;
  if (p.kind === 'plank') {
    ctx.fillStyle = '#a16207'; ctx.fillRect(x + shake, y, w, s * 0.18);
    ctx.strokeStyle = '#713f12'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + shake + (w * i) / 4, y); ctx.lineTo(x + shake + (w * i) / 4, y + s * 0.18); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.5, y + s * 0.18); ctx.stroke(); // rajadura
  } else {
    ctx.fillStyle = '#6b7280'; ctx.fillRect(x, y, w, s * 0.2);
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < w / (s * 0.5); i++) { ctx.moveTo(x + i * s * 0.5, y + s * 0.2); ctx.lineTo(x + (i + 0.5) * s * 0.5, y); } ctx.stroke();
  }
}

function drawHelipad(ctx: CanvasRenderingContext2D, cx: number, y: number, s: number) {
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(cx, y - s * 0.03, s * 1.9, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, y - s * 0.03, s * 1.6, s * 0.17, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', cx, y - s * 0.04);
}

// Ascensor: pozo, cabina con luz, puertas en cada piso (se abren cuando para), botón y número de piso.
function drawElevators(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  const s = v.s;
  for (const e of g.elevators) {
    if (!visible(v, e.x - 1, e.x + e.w + 1, e.y1, e.y2 + 3)) continue;
    const b = g.buildings[e.b], st = elevatorAt(e, g.time);
    const x = X(v, e.x), w = e.w * s;
    ctx.fillStyle = 'rgba(25,25,30,0.8)'; ctx.fillRect(x, Y(v, e.y2 + 2.1), w, (e.y2 + 2.1 - e.y1) * s);
    ctx.strokeStyle = '#52525b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, Y(v, e.y2 + 2.1)); ctx.lineTo(x + 3, Y(v, e.y1)); ctx.moveTo(x + w - 3, Y(v, e.y2 + 2.1)); ctx.lineTo(x + w - 3, Y(v, e.y1)); ctx.stroke();
    // cabina
    const cy = Y(v, st.y), ch = s * 2.05;
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w / 2, cy - ch); ctx.lineTo(x + w / 2, Y(v, e.y2 + 2.1)); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.fillRect(x + 2, cy - ch, w - 4, ch + s * 0.12);
    const light = ctx.createLinearGradient(0, cy - ch, 0, cy); light.addColorStop(0, '#fef9c3'); light.addColorStop(1, '#d6d3d1');
    ctx.fillStyle = light; ctx.fillRect(x + s * 0.1, cy - ch + s * 0.1, w - s * 0.2, ch - s * 0.1);
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(x + s * 0.1, cy - s * 1.0, w - s * 0.2, s * 0.05); // pasamanos
    ctx.fillStyle = '#44403c'; ctx.fillRect(x, cy, w, s * 0.14);
    // puertas de cada piso
    for (const stop of e.stops) {
      if (!visible(v, e.x, e.x + e.w, stop, stop + 2.2)) continue;
      const here = st.open && Math.abs(st.y - stop) < 0.02;
      const dy = Y(v, stop + 2.05), dh = 2.05 * s, frame = s * 0.08;
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x - frame, dy - frame, w + frame * 2, frame); ctx.fillRect(x - frame, dy, frame, dh); ctx.fillRect(x + w, dy, frame, dh);
      const open = here ? 0.42 : 0;
      ctx.globalAlpha = here ? 1 : 0.62;
      const grad = ctx.createLinearGradient(x, 0, x + w, 0); grad.addColorStop(0, '#94a3b8'); grad.addColorStop(0.5, '#e2e8f0'); grad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = grad;
      ctx.fillRect(x, dy, (w / 2) * (1 - open * 2), dh); ctx.fillRect(x + w - (w / 2) * (1 - open * 2), dy, (w / 2) * (1 - open * 2), dh);
      ctx.globalAlpha = 1;
      if (!here) { ctx.fillStyle = '#475569'; ctx.fillRect(x + w / 2 - 1, dy, 2, dh); }
      // indicador arriba: flecha y piso donde está la cabina
      ctx.fillStyle = '#111827'; ctx.fillRect(x + w / 2 - s * 0.35, dy - s * 0.42, s * 0.7, s * 0.28);
      ctx.fillStyle = '#f87171'; ctx.font = font(900, s * 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${st.dir > 0 ? '▲' : st.dir < 0 ? '▼' : '•'}${Math.round(st.y / b.fh)}`, x + w / 2, dy - s * 0.28);
      // botón para llamarlo
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(x + w + s * 0.15, Y(v, stop + 1.2), s * 0.16, s * 0.3);
      ctx.fillStyle = here || Math.floor(g.time * 2) % 2 ? '#fbbf24' : '#78350f'; ctx.beginPath(); ctx.arc(x + w + s * 0.23, Y(v, stop + 1.05), s * 0.05, 0, Math.PI * 2); ctx.fill();
      if (here) { ctx.fillStyle = '#22c55e'; ctx.font = font(900, s * 0.2); ctx.fillText('¡ENTRÁ!', x + w / 2, Y(v, stop + 2.5)); }
    }
    // sala de máquinas en la terraza
    ctx.fillStyle = '#57534e'; ctx.fillRect(x - s * 0.2, Y(v, e.y2 + 2.5), w + s * 0.4, s * 0.45);
    ctx.fillStyle = '#fde047'; ctx.font = font(800, s * 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ASCENSOR', x + w / 2, Y(v, e.y2 + 2.28));
  }
}

function drawClimb(ctx: CanvasRenderingContext2D, c: Climb, v: View) {
  if (!visible(v, c.x - 1, c.x + 1, c.y1, c.y2)) return;
  const x = X(v, c.x), s = v.s, top = Y(v, c.y2), bottom = Y(v, c.y1);
  if (c.skin === 'rope') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - s * 0.3, top + s * 0.28, s * 0.6, s * 0.12); // agujero en el techo
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(3, s * 0.1);
    ctx.beginPath(); ctx.moveTo(x, top - s * 0.3); for (let y = top; y <= bottom; y += 4) ctx.lineTo(x + Math.sin((y - top) / s * 0.9 + v.t * 1.5) * s * 0.06 * ((y - top) / (bottom - top)), y); ctx.stroke();
    ctx.strokeStyle = '#713f12'; ctx.lineWidth = 1; for (let y = top; y < bottom; y += s * 0.25) { ctx.beginPath(); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x + s * 0.05, y + s * 0.1); ctx.stroke(); }
    for (let y = top + s * 0.6; y < bottom - s * 0.2; y += s * 0.7) { ctx.fillStyle = '#854d0e'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.08, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); } // nudos
    ctx.fillStyle = '#374151'; ctx.fillRect(x - s * 0.2, top - s * 0.35, s * 0.4, s * 0.1);
    return;
  }
  const half = c.skin === 'escape' ? s * 0.2 : s * 0.25;
  if (c.skin === 'ladder') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - s * 0.35, top + s * 0.28, s * 0.7, s * 0.12); }
  ctx.strokeStyle = c.skin === 'escape' ? '#4b5563' : '#a16207'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.moveTo(x - half, top); ctx.lineTo(x - half, bottom); ctx.moveTo(x + half, top); ctx.lineTo(x + half, bottom);
  for (let y = bottom - s * 0.3; y > top; y -= s * 0.35) { ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); }
  ctx.stroke();
}

function drawEscape(ctx: CanvasRenderingContext2D, e: Escape, g: LavaGame, v: View) {
  const b = g.buildings[e.b], y = floorY(b, e.broken), s = v.s;
  if (!visible(v, e.x - 1, e.x + 2, y, y + 3)) return;
  // Pedazo roto y doblado arriba del último descanso.
  const x = X(v, e.side > 0 ? e.x + 1 : e.x + 0.3);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.moveTo(x - s * 0.2, Y(v, y)); ctx.lineTo(x - s * 0.1, Y(v, y + 1.2)); ctx.lineTo(x + e.side * s * 0.6, Y(v, y + 1.6));
  ctx.moveTo(x + s * 0.2, Y(v, y)); ctx.lineTo(x + s * 0.3, Y(v, y + 1)); ctx.stroke();
  ctx.fillStyle = '#ef4444'; ctx.font = font(900, s * 0.25); ctx.textAlign = 'center';
  ctx.fillText('ROTA', x, Y(v, y + 2));
}

// Tirolesa: un poste en la terraza y un cable en bajada hasta el otro edificio.
function drawZip(ctx: CanvasRenderingContext2D, z: Zip, g: LavaGame, v: View) {
  if (!visible(v, z.x1 - 2, z.x2 + 1, z.y2 - 2, z.y1 + 2)) return;
  const s = v.s, roof = z.y1 - 1.25;
  ctx.strokeStyle = '#57534e'; ctx.lineWidth = Math.max(3, s * 0.1);
  ctx.beginPath(); ctx.moveTo(X(v, z.x1 - 0.15), Y(v, roof)); ctx.lineTo(X(v, z.x1 - 0.15), Y(v, z.y1 + 0.5)); ctx.moveTo(X(v, z.x1 - 1), Y(v, roof)); ctx.lineTo(X(v, z.x1 - 0.15), Y(v, z.y1 + 0.3)); ctx.stroke();
  ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.beginPath(); ctx.moveTo(X(v, z.x1 - 0.15), Y(v, z.y1 + 0.05)); ctx.lineTo(X(v, z.x2 + 0.3), Y(v, z.y2 - 0.02)); ctx.stroke();
  ctx.fillStyle = '#44403c'; ctx.fillRect(X(v, z.x2 + 0.25), Y(v, z.y2 + 0.15), s * 0.15, s * 0.3);
  if (!g.player.zip) drawTrolley(ctx, X(v, z.x1 + 0.2), Y(v, z.y1 - 0.05 * (z.y1 - z.y2) / (z.x2 - z.x1)), s, false);
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TIROLESA ▲', X(v, z.x1 - 0.6), Y(v, z.y1 + 0.9));
}
function drawTrolley(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, busy: boolean) {
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(x - s * 0.15, y - s * 0.1, s * 0.3, s * 0.16, s * 0.05); ctx.fill();
  if (!busy) { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + s * 0.06); ctx.lineTo(x, y + s * 0.3); ctx.moveTo(x - s * 0.15, y + s * 0.3); ctx.lineTo(x + s * 0.15, y + s * 0.3); ctx.stroke(); }
}

// ---------- Peligros ----------
function drawFire(ctx: CanvasRenderingContext2D, f: Fire, v: View) {
  if (!visible(v, f.x1, f.x2, f.y, f.y + f.h + 1)) return;
  const s = v.s, base = Y(v, f.y), n = Math.max(3, Math.round((f.x2 - f.x1) / 0.22));
  const glow = ctx.createRadialGradient(X(v, (f.x1 + f.x2) / 2), base - f.h * s * 0.4, 0, X(v, (f.x1 + f.x2) / 2), base - f.h * s * 0.4, s * 1.6);
  glow.addColorStop(0, 'rgba(255,170,60,0.45)'); glow.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(X(v, (f.x1 + f.x2) / 2) - s * 1.6, base - f.h * s * 0.4 - s * 1.6, s * 3.2, s * 3.2);
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ['#dc2626', '#f97316', '#fde047'][layer];
    for (let i = 0; i < n; i++) {
      const cx = X(v, f.x1 + ((i + 0.5) / n) * (f.x2 - f.x1));
      const fl = f.h * (1 - layer * 0.28) * (0.7 + 0.3 * Math.sin(v.t * 9 + i * 1.7 + layer)) * s;
      const hw = ((f.x2 - f.x1) / n) * s * 0.75 * (1 - layer * 0.2);
      ctx.beginPath(); ctx.moveTo(cx - hw, base); ctx.quadraticCurveTo(cx - hw * 0.6, base - fl * 0.6, cx + Math.sin(v.t * 7 + i) * hw * 0.4, base - fl); ctx.quadraticCurveTo(cx + hw * 0.6, base - fl * 0.6, cx + hw, base); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(60,60,60,0.35)';
  for (let i = 0; i < 3; i++) { const k = (v.t * 0.6 + i / 3) % 1; ctx.beginPath(); ctx.arc(X(v, (f.x1 + f.x2) / 2) + Math.sin(v.t + i) * s * 0.3, base - (f.h + k * 1.4) * s, s * (0.2 + k * 0.4), 0, Math.PI * 2); ctx.fill(); }
}

function drawSpark(ctx: CanvasRenderingContext2D, sp: Spark, v: View) {
  if (!visible(v, sp.x1, sp.x2, sp.y1, sp.y2)) return;
  const s = v.s, on = sparkActive(sp, v.t), warn = sparkWarning(sp, v.t);
  if (sp.kind === 'cable') {
    const cx = X(v, (sp.x1 + sp.x2) / 2), top = Y(v, sp.y2), end = Y(v, sp.y1);
    ctx.fillStyle = '#e7e5e4'; ctx.fillRect(cx - s * 0.15, top, s * 0.3, s * 0.1); // caja de luz rota
    ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + s * 0.25 + Math.sin(v.t * 2) * s * 0.05, (top + end) / 2, cx, end); ctx.stroke();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.05, top); ctx.quadraticCurveTo(cx - s * 0.2, (top + end) / 2, cx - s * 0.08, end - s * 0.1); ctx.stroke();
    ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(cx, end, s * 0.07, 0, Math.PI * 2); ctx.fill();
    if (on) bolts(ctx, cx, end, s * 1.2, v.t, '#fde047');
    else if (warn && Math.floor(v.t * 16) % 2) { ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(cx, end, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const x = X(v, sp.x1), w = (sp.x2 - sp.x1) * s, y = Y(v, sp.y1);
    ctx.fillStyle = on ? 'rgba(125,211,252,0.85)' : 'rgba(96,165,250,0.55)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y - s * 0.03, w / 2, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    // enchufe roto en la pared, de donde sale el cortocircuito
    ctx.fillStyle = '#f5f5f4'; ctx.fillRect(x - s * 0.25, y - s * 0.5, s * 0.2, s * 0.28);
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * 0.15, y - s * 0.3); ctx.quadraticCurveTo(x, y - s * 0.1, x + w * 0.2, y - s * 0.04); ctx.stroke();
    if (on) for (let i = 0; i < 3; i++) bolts(ctx, x + (w * (i + 0.5)) / 3, y - s * 0.05, s * 0.5, v.t + i, '#e0f2fe');
    else if (warn && Math.floor(v.t * 16) % 2) { ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - s * 0.1); ctx.lineTo(x + w * 0.3, y - s * 0.25); ctx.stroke(); }
  }
}

function bolts(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 10;
  for (let i = 0; i < 4; i++) {
    let px = x, py = y;
    const a = hash(Math.floor(t * 18) + i) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let j = 1; j <= 4; j++) { px = x + Math.cos(a) * r * (j / 4) + (hash(i * 9 + j + Math.floor(t * 18)) - 0.5) * r * 0.4; py = y + Math.sin(a) * r * (j / 4) + (hash(i * 7 + j) - 0.5) * r * 0.4; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ---------- Gente ----------
const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const SKINS = [[252, 217, 182], [224, 172, 105], [141, 85, 36], [241, 194, 125]];
const CHAR = [6, 5, 5]; // carbonizada: negro total
function hslRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
// Cuerpo de una persona en coordenadas locales (los pies en 0,0; hacia arriba es negativo).
function drawBody(ctx: CanvasRenderingContext2D, person: Person, h: number, dir: 1 | -1, swing: number, arms: number, burn: number, t: number) {
  const w = h * 0.4;
  const skin = mix(SKINS[Math.floor(person.look * 4)], CHAR, burn), shirt = mix(hslRgb(person.hue, 65, 50), CHAR, burn), pants = mix(hslRgb((person.hue + 200) % 360, 35, 30), CHAR, burn);
  ctx.lineCap = 'round';
  ctx.strokeStyle = pants; ctx.lineWidth = w * 0.35;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.45); ctx.lineTo(-w * 0.4 * swing, 0); ctx.moveTo(0, -h * 0.45); ctx.lineTo(w * 0.4 * swing, 0); ctx.stroke();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(-w / 2, -h * 0.8, w, h * 0.4, w * 0.2); ctx.fill();
  ctx.strokeStyle = skin; ctx.lineWidth = w * 0.22;
  const wave = arms ? Math.sin(t * 24 + person.id) * h * 0.12 : 0;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.75); ctx.lineTo(dir * w * 0.6, -h * 0.5 - arms * h * 0.42 + wave); ctx.moveTo(0, -h * 0.75); ctx.lineTo(-dir * w * 0.5, -h * 0.52 - arms * h * 0.4 - wave); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -h * 0.9, w * 0.38, 0, Math.PI * 2); ctx.fill();
  if (person.helmet) { ctx.fillStyle = mix([250, 204, 21], CHAR, burn); ctx.beginPath(); ctx.arc(0, -h * 0.95, w * 0.42, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-w * 0.55, -h * 0.96, w * 1.1, w * 0.1); }
  else if (burn < 0.6) { // el pelo se quema primero
    ctx.save(); ctx.globalAlpha *= 1 - burn / 0.6;
    ctx.fillStyle = person.look > 0.5 ? '#3b2412' : '#facc15'; ctx.beginPath(); ctx.arc(-dir * w * 0.08, -h * 0.97, w * 0.36, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
// Cuánto se ve una persona carbonizada antes de hundirse del todo en la lava.
const CHARRED_SHOW = 9;
function drawPerson(ctx: CanvasRenderingContext2D, person: Person, v: View, lava = -Infinity) {
  const { x, dir } = personX(person, v.t);
  const age = person.burnAt === null ? 0 : v.t - person.burnAt;
  // Mientras arde y después, queda parada sobre la lava (que la va tapando de a poco), así se ve bien.
  const sink = Math.max(0, age - BURN_T - 2.6) * 0.14;
  const y = person.burnAt === null ? person.y : Math.max(person.y, lava + 0.02 - sink);
  if (!visible(v, x - 2, x + 2, y, y + 3)) return;
  const state = personState(person, v.t), s = v.s;
  const px = X(v, x), base = Y(v, y), h = s * (person.look < 0.2 ? 0.6 : 0.82), w = h * 0.4;
  if (state === 'calm') {
    ctx.save(); ctx.translate(px, base);
    drawBody(ctx, person, h, dir, Math.sin(v.t * 9 + person.id) * 0.5, 0, 0, v.t);
    ctx.restore();
    return;
  }
  if (state === 'burning') {
    const burn = Math.min(1, age / BURN_T);
    // Resplandor del fuego alrededor.
    const glow = ctx.createRadialGradient(px, base - h * 0.6, 0, px, base - h * 0.6, h * 2.4);
    glow.addColorStop(0, `rgba(255,150,40,${0.55 + 0.15 * Math.sin(v.t * 20 + person.id)})`); glow.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(px - h * 2.4, base - h * 3, h * 4.8, h * 4.8);
    ctx.save(); ctx.translate(px, base);
    drawBody(ctx, person, h, dir, Math.sin(v.t * 22 + person.id) * 0.7, 1, burn, v.t); // corre desesperada con los brazos arriba
    ctx.restore();
    // Llamas que le salen de todo el cuerpo (cada vez más grandes).
    for (let i = 0; i < 26; i++) {
      const life = (v.t * (1.6 + hash(i) * 0.8) + hash(person.id * 7 + i)) % 1;
      const fx = px + (hash(i * 5 + person.id) - 0.5) * w * 1.8 + Math.sin(v.t * 9 + i) * w * 0.2;
      const fy = base - h * (0.05 + 0.9 * hash(i * 3 + person.id)) - life * h * (0.9 + burn * 0.8);
      const r = w * (0.75 * (1 - life) + 0.15) * (1 + burn * 0.9);
      ctx.fillStyle = life < 0.25 ? `rgba(254,240,138,${1 - life})` : life < 0.6 ? `rgba(251,146,60,${0.95 - life})` : `rgba(220,38,38,${0.9 - life})`;
      ctx.beginPath(); ctx.moveTo(fx - r, fy); ctx.quadraticCurveTo(fx - r * 0.3, fy - r * 2.2, fx, fy - r * 2.6); ctx.quadraticCurveTo(fx + r * 0.3, fy - r * 2.2, fx + r, fy); ctx.arc(fx, fy, r, 0, Math.PI); ctx.fill();
    }
    // Chispas y humo negro.
    for (let i = 0; i < 6; i++) { const life = (v.t * 1.3 + hash(i + person.id)) % 1; ctx.fillStyle = `rgba(253,224,71,${1 - life})`; ctx.fillRect(px + Math.sin(i * 2 + v.t * 3) * w * (0.5 + life * 2), base - h * (0.8 + life * 1.4), 2, 2); }
    for (let i = 0; i < 4; i++) { const k = (age * 0.7 + i / 4) % 1; ctx.fillStyle = `rgba(40,36,36,${0.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(px + Math.sin(age * 2 + i) * w * 0.8, base - h * 1.3 - k * s * 1.6, w * (0.4 + k * 1.1), 0, Math.PI * 2); ctx.fill(); }
    if (age < 1.8 && Math.floor(age * 6) % 3) { // grito
      ctx.font = font(900, s * 0.26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#111827'; ctx.fillStyle = '#fef08a';
      ctx.strokeText('¡AAAH!', px, base - h * 1.7); ctx.fillText('¡AAAH!', px, base - h * 1.7);
    }
    return;
  }
  // Carbonizada: una silueta totalmente negra que queda parada con los brazos arriba, se desploma y se hunde
  // despacio en la lava, echando humo.
  const after = age - BURN_T, fall = Math.min(1, Math.max(0, after - 1.6) / 0.5);
  ctx.save();
  if (Number.isFinite(lava)) { const top = Y(v, lava); ctx.beginPath(); ctx.rect(px - h * 2, top - h * 3, h * 4, h * 3); ctx.clip(); } // lo que se hundió no se ve
  ctx.translate(px, base); ctx.rotate(dir * fall * fall * Math.PI * 0.5);
  ctx.shadowColor = 'rgba(255,120,40,0.7)'; ctx.shadowBlur = h * 0.25; // contorno rojizo para que se recorte sobre la lava
  drawBody(ctx, person, h, dir, 0, 0.8 * (1 - fall), 1, 0);
  ctx.restore();
  const smokeA = Math.max(0, 1 - after / CHARRED_SHOW);
  for (let i = 0; i < 3; i++) { const k = (after * 0.4 + i / 3) % 1; ctx.fillStyle = `rgba(110,105,100,${0.45 * (1 - k) * smokeA})`; ctx.beginPath(); ctx.arc(px + dir * h * 0.4 + Math.sin(after + i) * w, base - h * 0.3 - k * s * 1.4, w * (0.3 + k), 0, Math.PI * 2); ctx.fill(); }
}

// ---------- Helicópteros ----------
function drawHeli(ctx: CanvasRenderingContext2D, h: Heli, v: View, t: number) {
  const st = heliState(h, t), s = v.s;
  // Lugar donde aterriza: cartel con la cuenta regresiva.
  if (visible(v, h.x - 1, h.x + h.w + 1, h.y - 1, h.y + 3)) {
    const cx = X(v, h.x + h.w / 2), py = Y(v, h.y);
    if (st.phase !== 'landed') {
      const soon = st.back < 6, blink = Math.floor(t * 4) % 2;
      ctx.fillStyle = soon && blink ? '#22c55e' : 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(cx - s * 1.3, py - s * 1.25, s * 2.6, s * 0.5, s * 0.12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`🚁 vuelve en ${Math.ceil(st.back)} s`, cx, py - s * 1.0);
    }
  }
  if (!visible(v, st.x - 3, st.x + h.w + 3, st.y - 2, st.y + h.h + 3)) return;
  const x = X(v, st.x), y = Y(v, st.y + h.h), w = h.w * s, hh = h.h * s;
  // Polvo que levanta el rotor cerca del piso.
  if (st.y - h.y < 4) {
    const k = 1 - (st.y - h.y) / 4;
    for (let i = 0; i < 6; i++) { const life = (t * 1.5 + i / 6) % 1, side = i % 2 ? 1 : -1; ctx.fillStyle = `rgba(200,190,180,${0.35 * k * (1 - life)})`; ctx.beginPath(); ctx.arc(X(v, st.x + h.w / 2) + side * life * w * 0.9, Y(v, h.y) - s * 0.2, s * (0.2 + life * 0.5), 0, Math.PI * 2); ctx.fill(); }
  }
  // cola
  ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(x + w * 0.65, y + hh * 0.35); ctx.lineTo(x + w * 1.35, y + hh * 0.3); ctx.lineTo(x + w * 1.35, y + hh * 0.48); ctx.lineTo(x + w * 0.65, y + hh * 0.62); ctx.fill();
  ctx.save(); ctx.translate(x + w * 1.35, y + hh * 0.35); ctx.rotate(t * 30); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.1); ctx.restore();
  // cuerpo
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.ellipse(x + w * 0.4, y + hh * 0.5, w * 0.42, hh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.ellipse(x + w * 0.2, y + hh * 0.4, w * 0.18, hh * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = font(900, hh * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RESCATE', x + w * 0.5, y + hh * 0.62);
  if (st.phase === 'landed') { // puerta abierta y un rescatista que hace señas
    ctx.fillStyle = '#1f2937'; ctx.fillRect(x + w * 0.42, y + hh * 0.2, w * 0.2, hh * 0.55);
    ctx.fillStyle = '#f97316'; ctx.fillRect(x + w * 0.47, y + hh * 0.38, w * 0.1, hh * 0.3);
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(x + w * 0.52, y + hh * 0.3, w * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w * 0.55, y + hh * 0.42); ctx.lineTo(x + w * (0.66 + Math.sin(t * 10) * 0.04), y + hh * 0.12); ctx.stroke();
  }
  // patines
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + hh); ctx.lineTo(x + w * 0.75, y + hh); ctx.moveTo(x + w * 0.25, y + hh * 0.85); ctx.lineTo(x + w * 0.25, y + hh); ctx.moveTo(x + w * 0.6, y + hh * 0.85); ctx.lineTo(x + w * 0.6, y + hh); ctx.stroke();
  // rotor
  ctx.fillStyle = '#1f2937'; ctx.fillRect(x + w * 0.38, y - hh * 0.12, s * 0.12, hh * 0.15);
  const spin = Math.cos(t * 25);
  ctx.fillStyle = 'rgba(31,41,55,0.8)'; ctx.fillRect(x + w * 0.44 - w * 0.75 * Math.abs(spin), y - hh * 0.15, w * 1.5 * Math.abs(spin), s * 0.08);
  ctx.fillStyle = 'rgba(31,41,55,0.25)'; ctx.fillRect(x + w * 0.44 - w * 0.75, y - hh * 0.15, w * 1.5, s * 0.08);
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#f87171' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x + w * 0.05, y + hh * 0.55, s * 0.07, 0, Math.PI * 2); ctx.fill();
  if (st.phase === 'landed') {
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.font = font(900, s * 0.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#052e16'; ctx.fillStyle = `rgba(134,239,172,${0.7 + pulse * 0.3})`;
    const label = `¡SUBÍ! ${Math.ceil(st.left)}`;
    ctx.strokeText(label, x + w * 0.45, y - hh * 0.65 - pulse * s * 0.15); ctx.fillText(label, x + w * 0.45, y - hh * 0.65 - pulse * s * 0.15);
  }
}

// ---------- Lava ----------
function drawLava(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  const top = Y(v, g.lava);
  if (top > v.h + 20) return;
  // resplandor arriba de la lava
  const glow = ctx.createLinearGradient(0, top - v.s * 4, 0, top);
  glow.addColorStop(0, 'rgba(251,146,60,0)'); glow.addColorStop(1, 'rgba(251,146,60,0.45)');
  ctx.fillStyle = glow; ctx.fillRect(0, top - v.s * 4, v.w, v.s * 4);
  const body = ctx.createLinearGradient(0, top, 0, top + v.s * 6);
  body.addColorStop(0, '#fde047'); body.addColorStop(0.08, '#f97316'); body.addColorStop(0.4, '#dc2626'); body.addColorStop(1, '#450a0a');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(0, v.h);
  for (let x = 0; x <= v.w + 10; x += 10) ctx.lineTo(x, top + Math.sin(x * 0.03 + v.t * 2.2) * 4 + Math.sin(x * 0.011 - v.t * 1.3) * 5);
  ctx.lineTo(v.w, v.h); ctx.fill();
  // costra oscura y burbujas
  ctx.fillStyle = 'rgba(69,10,10,0.5)';
  for (let i = 0; i < 14; i++) { const x = ((hash(i) * v.w + v.t * 12 * (hash(i + 3) - 0.5)) % v.w + v.w) % v.w; ctx.beginPath(); ctx.ellipse(x, top + v.s * (0.6 + hash(i + 1) * 2.5), v.s * (0.5 + hash(i + 2)), v.s * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 10; i++) {
    const life = (v.t * 0.8 + hash(i + 20)) % 1, x = hash(i + 30) * v.w, r = v.s * 0.25 * Math.sin(life * Math.PI);
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x, top + 3 - life * 6, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  const p = g.player, s = v.s;
  const pw = PLAYER_W * s, ph = PLAYER_H * s;
  const px = X(v, p.x) - pw / 2, py = Y(v, p.y) - ph;
  const burnt = !!g.dying;
  if (p.zip) drawTrolley(ctx, X(v, p.x), Y(v, p.y + 1.1), s, true);
  drawRunner(ctx, { x: px, y: py, w: pw, h: ph, facing: p.facing, time: v.t, running: p.vx !== 0 && !!p.ground, airborne: !p.ground && !p.climb && !p.zip, climbing: !!p.climb || !!p.zip, falling: !!g.dying, burnt });
  if (g.dying?.reason === 'zap' && Math.floor(v.t * 20) % 2) bolts(ctx, px + pw / 2, py + ph / 2, pw * 1.2, v.t, '#fde047');
  if (g.dying) for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,113,108,${0.5 - i * 0.12})`; ctx.beginPath(); ctx.arc(px + pw / 2 + Math.sin(v.t * 6 + i) * pw * 0.4, py - i * pw * 0.6, pw * (0.25 + i * 0.1), 0, Math.PI * 2); ctx.fill(); }
}

function draw(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  drawSoftBackground(ctx, v);
  for (const b of g.buildings) drawBuilding(ctx, b, g, v);
  for (const f of g.fallens) drawFallen(ctx, f, g, v);
  // Helipuertos de la terraza de la torre.
  for (const h of g.helis) if (h.y === towerOf(g).top && visible(v, h.x - 1, h.x + h.w + 1, h.y - 1, h.y + 1)) drawHelipad(ctx, X(v, h.x + h.w * 0.42), Y(v, h.y), v.s);
  drawElevators(ctx, g, v);
  for (const e of g.escapes) drawEscape(ctx, e, g, v);
  for (const c of g.climbs) drawClimb(ctx, c, v);
  for (const z of g.zips) drawZip(ctx, z, g, v);
  for (const p of g.plats) if (p.kind !== 'furniture' && p.kind !== 'step') drawPlat(ctx, p, g, v); // los muebles y escalones van en la imagen de cada piso
  for (const f of g.fires) drawFire(ctx, f, v);
  for (const sp of g.sparks) drawSpark(ctx, sp, v);
  for (const person of g.people) if (person.burnAt === null) drawPerson(ctx, person, v);
  for (const h of g.helis) drawHeli(ctx, h, v, g.time);
  drawPlayer(ctx, g, v);
  drawLava(ctx, g, v);
  // La gente que alcanzó la lava se ve arder y quedar carbonizada (negra), parada sobre la lava hasta que se hunde.
  for (const person of g.people) {
    if (person.burnAt === null || v.t - person.burnAt > BURN_T + CHARRED_SHOW) continue;
    drawPerson(ctx, person, v, g.lava);
  }
  drawEmbers(ctx, v);
  // Si la lava está muy cerca, el borde de la pantalla se pone rojo.
  const near = g.player.y - g.lava;
  if (!g.dying && near < 3) {
    const a = (1 - near / 3) * (0.5 + 0.3 * Math.sin(v.t * 10));
    const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
    vg.addColorStop(0, 'rgba(220,38,38,0)'); vg.addColorStop(1, `rgba(220,38,38,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  }
}

const LOSE_TEXT: Record<LoseReason, string> = { lava: '¡Te alcanzó la lava!', fire: '¡Te quemaste!', zap: '¡Cortocircuito!' };
const NO_INPUT: Input = { left: false, right: false, jump: false, down: false, up: false };

// Se ven unas 14 unidades de alto (un poco más de 4 pisos) y, en pantallas angostas, unas 12 de ancho.
function scaleFor(w: number, h: number) { return Math.min(h / 14, w / 12); }
// Cuánto falta para que aterrice algún helicóptero (0 si hay uno aterrizado) y cuánto le queda al aterrizado.
function heliHud(g: LavaGame) {
  const landed = g.helis.map(h => heliState(h, g.time)).filter(s => s.phase === 'landed');
  if (landed.length) return { landed: true, s: Math.ceil(Math.max(...landed.map(s => s.left))) };
  return { landed: false, s: Math.ceil(Math.min(...g.helis.map(h => nextLanding(h, g.time)))) };
}

export function LavaFloor() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<LavaGame>(newLava());
  const cam = useRef({ x: 0, y: 0 });
  const input = useRef<Input>({ ...NO_INPUT });
  const recordRef = useRef<LavaRecord>(readLavaRecord());
  const brokeRef = useRef(false);
  const startedRef = useRef(false);
  const zipToldRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, m: 0, lava: 0, lavaM: 0, heli: '' });
  const [record, setRecord] = useState(readLavaRecord);
  const [result, setResult] = useState({ m: 0, time: 0, reason: 'lava' as LoseReason, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const view = useCallback((): View | null => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return null;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return null;
    return { w, h, s: scaleFor(w, h), cx: cam.current.x, cy: cam.current.y, t: g.time + (g.dying?.t ?? 0), dpr: Math.min(2, window.devicePixelRatio || 1) }; // más de 2x no se nota y cuesta mucho
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current, v = view();
    if (!canvas || !v) return;
    const dpr = v.dpr;
    if (canvas.width !== Math.round(v.w * dpr) || canvas.height !== Math.round(v.h * dpr)) {
      canvas.width = Math.round(v.w * dpr); canvas.height = Math.round(v.h * dpr);
      canvas.style.width = `${v.w}px`; canvas.style.height = `${v.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, gameRef.current, v);
  }, [view]);

  // La cámara sigue al personaje (un poco adelantada para arriba, que es adonde hay que ir).
  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const s = scaleFor(stage.clientWidth, stage.clientHeight);
    const vw = stage.clientWidth / s, vh = stage.clientHeight / s;
    const tx = Math.max(-1, Math.min(g.width - vw + 1, g.player.x - vw / 2));
    const ty = Math.max(-2.5, g.player.y - vh * 0.36);
    const k = dt < 0 ? 1 : Math.min(1, dt * 5);
    cam.current.x += (tx - cam.current.x) * k;
    cam.current.y += (ty - cam.current.y) * k;
  }, []);

  const start = useCallback(() => {
    gameRef.current = newLava(); // cada partida arranca en otro lugar de la cuadra
    follow(-1);
    input.current = { ...NO_INPUT };
    recordRef.current = readLavaRecord();
    brokeRef.current = false; startedRef.current = false; zipToldRef.current = false;
    setHud({ tenths: 0, m: 0, lava: 0, lavaM: 0, heli: '' });
    setToast({ text: `¡La lava empieza a subir en ${LAVA_DELAY} segundos! 🔥`, id: Date.now() });
    setStatus('playing');
    paint();
  }, [paint, follow]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    follow(-1);
    paint();
    const observer = new ResizeObserver(() => { follow(-1); paint(); });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint, follow]);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(g, input.current, dt);
      if (!startedRef.current && g.time >= LAVA_DELAY) { startedRef.current = true; setToast({ text: '¡La lava empezó a subir! ¡Corré para arriba! 🔥', id: now }); }
      for (const e of takeEvents(g)) {
        if (e.type === 'faster') setToast({ text: e.level >= 4 ? '¡La lava sube a toda velocidad! 🌋' : '¡La lava sube cada vez más rápido! 🔥', id: now });
        if (e.type === 'heli') setToast({ text: '¡Ahí están los helicópteros! Subite cuando aterricen 🚁', id: now });
        if (e.type === 'heliLand') setToast({ text: '¡Aterrizó un helicóptero! Tenés 5 segundos 🚁', id: now, big: true });
        if (e.type === 'zip' && !zipToldRef.current) { zipToldRef.current = true; setToast({ text: '¡Tirolesa! Con ↓ te soltás 🪢', id: now }); }
        if (e.type === 'lose') setToast({ text: LOSE_TEXT[e.reason], id: now });
      }
      follow(dt);
      paint();
      const m = meters(g.bestGround);
      const prev = recordRef.current.height;
      if (!brokeRef.current && prev > 0 && m > prev && !g.dying) { brokeRef.current = true; setToast({ text: '¡Rompiste el récord!', id: now, big: true }); }
      const heli = heliHud(g);
      const shown = { tenths: Math.floor(g.time * 10), m, lava: Math.max(0, meters(g.player.y - g.lava)), lavaM: meters(Math.max(0, g.lava)), heli: heli.landed ? `¡Ya! ${heli.s} s` : `en ${heli.s} s` };
      setHud(p => p.tenths === shown.tenths && p.m === shown.m && p.lava === shown.lava && p.lavaM === shown.lavaM && p.heli === shown.heli ? p : shown);
      if (g.over || g.won) {
        const rec = readLavaRecord();
        const height = g.won ? TOWER_M : m;
        const next: LavaRecord = { height: Math.max(rec.height, height), time: g.won ? Math.min(rec.time ?? Infinity, g.time) : rec.time };
        const isNew = next.height > rec.height || (g.won && (rec.time === null || g.time < rec.time));
        saveRecord(next); setRecord(next);
        setResult({ m: height, time: g.time, reason: g.dying?.reason ?? 'lava', newRecord: isNew && (rec.height > 0 || g.won) });
        setToast(null);
        setStatus(g.won ? 'won' : 'over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden && !gameRef.current.dying) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, follow]);

  useEffect(() => {
    // ↑ (o W) trepa sogas, escaleras y tirolesas y, si no hay ninguna cerca, salta; Espacio solo salta.
    const keys: Record<string, (keyof Input)[]> = {
      ArrowLeft: ['left'], a: ['left'], A: ['left'], ArrowRight: ['right'], d: ['right'], D: ['right'],
      ArrowUp: ['up', 'jump'], w: ['up', 'jump'], W: ['up', 'jump'], ' ': ['jump'], ArrowDown: ['down'], s: ['down'], S: ['down'],
    };
    const down = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) {
        setStatus(s => s === 'playing' ? 'paused' : 'playing');
        return;
      }
      const list = keys[event.key];
      if (!list || statusRef.current !== 'playing') return;
      event.preventDefault();
      for (const k of list) input.current[k] = true;
    };
    const up = (event: KeyboardEvent) => { for (const k of keys[event.key] ?? []) input.current[k] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const hold = (key: keyof Input) => ({
    onPointerDown: (event: React.PointerEvent) => { event.preventDefault(); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; },
    onPointerLeave: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  const pct = (m: number) => `${Math.max(0, Math.min(100, (m / TOWER_M) * 100))}%`;
  const lavaM = hud.lavaM;

  return <section className="runner trepa lava" aria-label="¡El piso es de lava!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡El piso es de lava!</h1>
      <div className="runner-scores"><span>Récord <strong>{record.time !== null ? `🚁 ${formatLavaTime(record.time)}` : `${record.height} m`}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label="Ciudad inundada de lava" />
        {status === 'playing' && toast && <div key={toast.id} className={toast.big ? 'trepa-record' : 'trepa-toast lava-toast'} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="lava-message">
          <div>
            {status === 'ready' && <>
              <h2 id="lava-message" className="lava-title">¡El piso es de lava! 🌋</h2>
              <p>La lava sube y no para: subí lo más rápido que puedas para sobrevivir. Cada partida arrancás en otro lugar de la cuadra. Trepá por escaleras, muebles, sogas y ascensores (entrá cuando abren las puertas), salí por las puertas de los costados y pasá de edificio en edificio por tablones, camas elásticas, tirolesas y edificios caídos. Esquivá el fuego, los cables y los pisos rotos. Arriba de la torre más alta aterrizan tres helicópteros: esperan 5 segundos y se vuelven a ir, ¡subite a tiempo!</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> subir por sogas, escaleras y tirolesas (o saltar) · <kbd>↓</kbd> bajar · <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="lava-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="lava-message" className="trepa-gameover">GAME OVER</h2>
              <p>{LOSE_TEXT[result.reason]} Llegaste a <strong>{result.m} m</strong> en {formatLavaTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <h2 id="lava-message" className="trepa-win">¡Te salvaste! 🚁</h2>
              <p>Te subiste al helicóptero en <strong>{formatLavaTime(result.time)}</strong>, justo antes que la lava.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side lava-side" aria-label="Tiempo, altura, lava y helicópteros">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="lava-time">{formatLavaTime(hud.tenths / 10)}</strong></div>
        <div className="trepa-stat"><span>Altura</span><strong data-testid="lava-meters">{hud.m} m</strong></div>
        <div className="trepa-stat lava-stat"><span>La lava está a</span><strong data-testid="lava-distance">{hud.lava} m</strong></div>
        <div className="trepa-stat lava-heli"><span>Helicóptero</span><strong data-testid="lava-heli">{hud.heli || '—'}</strong></div>
        <div className="trepa-meter" aria-hidden="true">
          <div className="trepa-meter-track lava-meter-track">
            <div className="lava-meter-lava" style={{ height: pct(lavaM) }} />
            <div className="trepa-meter-fill" style={{ height: pct(hud.m) }} />
            {record.height > 0 && <span className="trepa-meter-record" style={{ bottom: pct(record.height) }} title="Récord" />}
          </div>
          <div className="trepa-meter-marks"><span style={{ bottom: '100%' }}>🚁 Helicópteros<small>{TOWER_M} m</small></span><span style={{ bottom: pct(lavaM) }}>🌋 Lava<small>{lavaM} m</small></span></div>
        </div>
      </aside>
    </div>
    <div className="runner-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
      <button type="button" aria-label="Subir" {...hold('up')}>▲</button>
      <button type="button" aria-label="Bajar" {...hold('down')}>▼</button>
      <button type="button" className="runner-jump" aria-label="Saltar" {...hold('jump')}>Saltar</button>
    </div>
  </section>;
}
