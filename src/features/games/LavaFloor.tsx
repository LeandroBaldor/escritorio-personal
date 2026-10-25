import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawRunner, type RunnerHat, type RunnerLook } from './runnerCharacter';
import { drawHero } from './trepaArt';
import {
  BURN_T, elevatorAt, floorY, HELI_H, HELI_W, heliState, heliTarget, LAVA_DELAY, zipY, meters, newLava, PLAYER_H, PLAYER_W, personState, personX, sparkActive, sparkWarning, step, takeEvents, towerOf, WALL,
  type Building, type Climb, type Crane, type Elevator, type Escape, type Fallen, type Fire, type Input, type LavaGame, type LoseReason, type Person, type Plat, type Spark, type Spiral, type Wire, type Zip,
} from './lava';
import { lavaLevels } from './lavaSound';
import { playCrumble, playElevatorDing, playFootstep, playGameOver, playJump, playLavaFall, playLose, playPersonBurn, playStart, playTramp, playWinFanfare, preloadLavaSounds, setLavaAmbient } from './sounds';
import { EndBanner } from './EndBanner';

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
// Mármol pulido con vetas (pisos y columnas de las torres de lujo).
const marble = (base: string, vein: string): Painter => (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 90, 17, 'rgba(0,0,0,0.035)', 'rgba(255,255,255,0.12)');
  c.strokeStyle = vein; c.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = hash(i * 3 + 1) * w, y = 0;
    c.beginPath(); c.moveTo(x, y);
    while (y < h) { x += (hash(x * 0.37 + y + i) - 0.5) * w * 0.22; y += h * 0.1; c.lineTo(x, y); }
    c.stroke();
  }
};
const concrete = (light: number): Painter => (c, w, h) => { c.fillStyle = hsl(30, 4, light); c.fillRect(0, 0, w, h); speckle(c, w, h, 220, 31, 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.1)'); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, h - 2, w, 1); c.beginPath(); c.arc(w * 0.3, h * 0.4, 2, 0, Math.PI * 2); c.fill(); };
const parquet = (hue: number): Painter => (c, w, h) => {
  for (let i = 0; i < 4; i++) { c.fillStyle = hsl(hue, 45, 32 + hash(i + hue) * 14); c.fillRect((i * w) / 4, 0, w / 4, h); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect((i * w) / 4, 0, 1, h); }
};

// ---------- Fondo: cielo de humo y una ciudad que se incendia a lo lejos ----------
// Cada edificio lejano tiene su estilo (torre vidriada, edificio de departamentos con balcones o bloque
// viejo), su remate (escalonado, tanque de agua, antena o aguja) y ventanas: la mayoría apagadas, algunas
// con luz y cortinas, otras rotas. Lo que no se mueve se dibuja una sola vez en una imagen.
interface Far { n: number; x: number; w: number; h: number; style: 0 | 1 | 2; setback: boolean; roof: 0 | 1 | 2 | 3; onFire: boolean; fireFrom: number }
const FAR_LAYERS = [
  { k: 0.11, D: 10, col: [16, 22, 24], windows: false },
  { k: 0.18, D: 9, col: [18, 26, 19], windows: true },
  { k: 0.3, D: 8, col: [12, 24, 14], windows: true },
  { k: 0.45, D: 7.5, col: [10, 22, 10], windows: true },
];
const FLOOR_H = 3; // alto de cada piso de los edificios lejanos
function farSpec(i: number, li: number, D: number): Far {
  const n = i * 7 + li * 1000, h = 20 + hash(n + 1) * (70 + li * 25);
  return {
    n, x: i * D + hash(n + 2) * D * 0.3, w: D * (0.55 + hash(n) * 0.4), h,
    style: Math.floor(hash(n + 6) * 3) as Far['style'], setback: hash(n + 7) < 0.35, roof: Math.floor(hash(n + 8) * 4) as Far['roof'],
    onFire: li > 0 && hash(n + 3) < 0.4, fireFrom: Math.floor(Math.floor(h / FLOOR_H) * (0.3 + hash(n + 4) * 0.5)),
  };
}
// Grilla de ventanas (en unidades, desde la esquina de abajo a la izquierda del edificio).
function farGrid(f: Far) {
  const cell = f.style === 0 ? 1.1 : f.style === 1 ? 1.6 : 1.3;
  const cols = Math.max(2, Math.floor(f.w / cell)), cw = f.w / cols;
  const ww = cw * (f.style === 0 ? 0.78 : f.style === 1 ? 0.5 : 0.42), wh = FLOOR_H * (f.style === 0 ? 0.72 : f.style === 1 ? 0.45 : 0.4);
  const body = f.setback ? f.h * 0.82 : f.h, sx1 = f.w * 0.16, sx2 = f.w * 0.84;
  return { rows: Math.floor(f.h / FLOOR_H), cols, cw, ww, wh, body, sx1, sx2 };
}
const inBody = (f: Far, g: ReturnType<typeof farGrid>, r: number, c: number) => {
  const y = r * FLOOR_H + 1, cx = (c + 0.5) * g.cw;
  return y + g.wh < f.h - 0.4 && (y + g.wh < g.body || (cx > g.sx1 + g.ww && cx < g.sx2 - g.ww));
};
const ROOF_H = 9; // lugar arriba del edificio para el remate
function paintFar(c: CanvasRenderingContext2D, f: Far, sc: number, col: number[], windows: boolean) {
  const H = (f.h + ROOF_H) * sc, U = (u: number) => u * sc, Yb = (u: number) => H - u * sc;
  const g = farGrid(f);
  const base = (l: number) => hsl(col[0], col[1], l);
  // Cuerpo: más claro abajo (lo ilumina la lava) y una cara lateral más oscura que le da volumen.
  const body = c.createLinearGradient(0, Yb(f.h), 0, H);
  body.addColorStop(0, base(col[2] - 3)); body.addColorStop(1, hsl(col[0] + 4, col[1] + 12, col[2] + 7));
  c.fillStyle = body;
  c.fillRect(0, Yb(g.body), U(f.w), U(g.body));
  if (f.setback) c.fillRect(U(g.sx1), Yb(f.h), U(g.sx2 - g.sx1), U(f.h - g.body) + 1);
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, Yb(g.body), U(f.w * 0.1), U(g.body));
  if (f.setback) { c.fillRect(U(g.sx1), Yb(f.h), U(f.w * 0.06), U(f.h - g.body)); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, Yb(g.body), U(f.w), U(0.35)); }
  c.fillStyle = 'rgba(255,140,60,0.16)'; c.fillRect(U(f.w) - Math.max(1, U(0.12)), Yb(g.body), Math.max(1, U(0.12)), U(g.body)); // borde iluminado por el fuego
  // Cornisa arriba.
  c.fillStyle = base(col[2] + 6); c.fillRect(-1, Yb(g.body) - 1, U(f.w) + 2, Math.max(1, U(0.3)));
  if (windows) {
    // Losas entre pisos y, en las torres vidriadas, parantes verticales.
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let r = 1; r < g.rows; r++) c.fillRect(f.setback && r * FLOOR_H > g.body ? U(g.sx1) : 0, Yb(r * FLOOR_H), U(f.setback && r * FLOOR_H > g.body ? g.sx2 - g.sx1 : f.w), Math.max(1, U(0.12)));
    for (let r = 0; r < g.rows; r++) for (let k = 0; k < g.cols; k++) {
      if (!inBody(f, g, r, k)) continue;
      const m = f.n * 31 + r * 13 + k, x = (k + 0.5) * g.cw - g.ww / 2, y = r * FLOOR_H + 1;
      const px = U(x), py = Yb(y + g.wh), pw = Math.max(1, U(g.ww)), ph = Math.max(1, U(g.wh));
      const lit = hash(m) < (f.style === 0 ? 0.2 : 0.26), broken = !lit && hash(m + 0.5) < 0.12;
      if (lit) {
        const warm = hash(m + 0.3);
        c.fillStyle = warm < 0.6 ? 'rgba(253,200,110,0.62)' : warm < 0.85 ? 'rgba(255,225,160,0.55)' : 'rgba(186,220,255,0.45)';
        c.fillRect(px, py, pw, ph);
        if (f.style !== 0 && ph > 3) { c.fillStyle = 'rgba(120,40,30,0.45)'; c.fillRect(px, py, pw * (0.25 + hash(m + 0.7) * 0.3), ph); } // cortina
      } else {
        c.fillStyle = broken ? 'rgba(0,0,0,0.75)' : f.style === 0 ? 'rgba(60,70,90,0.55)' : 'rgba(25,20,24,0.7)';
        c.fillRect(px, py, pw, ph);
        if (!broken && ph > 3) { c.fillStyle = 'rgba(255,150,80,0.12)'; c.fillRect(px, py + ph * 0.55, pw, ph * 0.45); } // reflejo naranja
      }
      if (pw > 4) { c.fillStyle = 'rgba(200,190,180,0.18)'; c.fillRect(px, py + ph - 1, pw, 1); } // marco de abajo
      // Balcones con baranda en los edificios de departamentos.
      if (f.style === 1 && k % 2 === 0 && pw > 3) {
        c.fillStyle = 'rgba(10,6,6,0.55)'; c.fillRect(px - pw * 0.25, Yb(y - 0.05), pw * 1.5, Math.max(1, U(0.12)));
        c.strokeStyle = 'rgba(10,6,6,0.45)'; c.lineWidth = 1; c.strokeRect(px - pw * 0.25, Yb(y + 0.55), pw * 1.5, U(0.6));
      }
      if (f.style === 2 && hash(m + 0.9) < 0.12 && pw > 3) { c.fillStyle = 'rgba(70,70,70,0.8)'; c.fillRect(px + pw * 0.1, py + ph, pw * 0.8, Math.max(2, ph * 0.35)); } // aire acondicionado
    }
    if (f.style === 0) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < g.cols; k++) c.fillRect(U(k * g.cw) - 0.5, Yb(g.body), 1, U(g.body)); }
  }
  // Remate de la terraza.
  const top = Yb(f.h), mid = U(f.w * 0.5);
  c.fillStyle = base(col[2] - 2); c.strokeStyle = base(col[2] - 2); c.lineWidth = Math.max(1, U(0.15));
  if (f.roof === 1) { // tanque de agua sobre patas
    const tx = U(f.w * 0.25), tw = U(Math.min(2.4, f.w * 0.3));
    c.fillRect(tx, top - U(3.2), tw, U(2)); c.beginPath(); c.moveTo(tx - 1, top - U(3.2)); c.lineTo(tx + tw / 2, top - U(4)); c.lineTo(tx + tw + 1, top - U(3.2)); c.fill();
    c.beginPath(); c.moveTo(tx + tw * 0.15, top); c.lineTo(tx + tw * 0.15, top - U(1.2)); c.moveTo(tx + tw * 0.85, top); c.lineTo(tx + tw * 0.85, top - U(1.2)); c.stroke();
    c.fillRect(U(f.w * 0.62), top - U(0.9), U(1.2), U(0.9)); // sala de máquinas
  } else if (f.roof === 2) { // antena con riendas
    c.beginPath(); c.moveTo(mid, top); c.lineTo(mid, top - U(7)); c.moveTo(mid - U(1.2), top); c.lineTo(mid, top - U(4)); c.lineTo(mid + U(1.2), top); c.stroke();
    c.fillRect(mid - U(0.6), top - U(4.5), U(1.2), U(0.25)); c.fillRect(mid - U(0.4), top - U(5.8), U(0.8), U(0.2));
  } else if (f.roof === 3) { // aguja
    c.beginPath(); c.moveTo(mid - U(f.w * 0.18), top); c.lineTo(mid, top - U(8)); c.lineTo(mid + U(f.w * 0.18), top); c.fill();
  } else { // equipos de aire y chimeneas
    for (let j = 0; j < 3; j++) c.fillRect(U(f.w * (0.15 + j * 0.27)), top - U(0.6 + hash(f.n + j) * 0.8), U(1), U(0.6 + hash(f.n + j) * 0.8));
  }
}
const farCache = new Map<string, HTMLCanvasElement | null>();
function farImage(f: Far, li: number, sc: number) {
  const key = `${li}:${f.n}:${sc.toFixed(2)}`;
  if (farCache.has(key)) return farCache.get(key)!;
  const L = FAR_LAYERS[li], w = f.w * sc, h = (f.h + ROOF_H) * sc;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * BG_SCALE)); canvas.height = Math.max(1, Math.ceil(h * BG_SCALE));
  const c = canvas.getContext('2d');
  if (c) {
    c.scale(BG_SCALE, BG_SCALE); paintFar(c, f, sc, L.col, L.windows);
    // Bruma: cuanto más lejos, más tapado por el humo rojizo (va pintado en la imagen, así no cuesta nada).
    const fog = (FAR_LAYERS.length - 1 - li) * 0.13;
    if (fog > 0) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(110,40,28,${fog})`; c.fillRect(0, 0, w, h); }
  }
  if (farCache.size > 160) farCache.delete(farCache.keys().next().value!);
  farCache.set(key, c ? canvas : null);
  return c ? canvas : null;
}

function drawBackground(ctx: CanvasRenderingContext2D, v: View) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.h);
  sky.addColorStop(0, '#140b17'); sky.addColorStop(0.5, '#3f1714'); sky.addColorStop(1, '#a43d17');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, v.w, v.h);
  // Capas de edificios lejanos (más lejos = más chicos, más lentos y más tapados por el humo), algunos prendidos fuego.
  FAR_LAYERS.forEach(({ k, D, windows }, li) => {
    const sc = v.s * k, base = v.h + v.cy * sc;
    const i1 = Math.floor((v.cx - 30) / D), i2 = Math.ceil((v.cx + v.w / sc + 10) / D);
    for (let i = i1; i <= i2; i++) {
      const f = farSpec(i, li, D);
      const x = (f.x - v.cx) * sc, w = f.w * sc, top = base - f.h * sc;
      if (x > v.w || x + w < 0 || top - ROOF_H * sc > v.h) continue;
      const img = farImage(f, li, sc);
      if (img) ctx.drawImage(img, x, top - ROOF_H * sc, w, (f.h + ROOF_H) * sc);
      if (base < v.h) { ctx.fillStyle = hsl(FAR_LAYERS[li].col[0], FAR_LAYERS[li].col[1], FAR_LAYERS[li].col[2]); ctx.fillRect(x, base, w, v.h - base); }
      // Luz roja que titila arriba de las antenas y las agujas (para los aviones).
      if ((f.roof === 2 || f.roof === 3) && Math.floor(v.t * 1.2 + f.n) % 2) {
        ctx.fillStyle = 'rgba(255,60,50,0.95)'; ctx.beginPath(); ctx.arc(x + w / 2, top - (f.roof === 2 ? 7 : 8) * sc, Math.max(1.5, sc * 0.3), 0, Math.PI * 2); ctx.fill();
      }
      if (!windows || !f.onFire) continue;
      // Pisos incendiados: las ventanas titilan de naranja, con llamas arriba y una columna de humo.
      const g = farGrid(f);
      for (let r = f.fireFrom; r < Math.min(g.rows, f.fireFrom + 4); r++) {
        const wy = base - (r * FLOOR_H + 1 + g.wh) * sc;
        if (wy < -10 || wy > v.h) continue;
        for (let c = 0; c < g.cols; c++) {
          if (!inBody(f, g, r, c)) continue;
          const m = f.n * 31 + r * 13 + c;
          ctx.fillStyle = `rgba(255,${110 + Math.floor(70 * Math.abs(Math.sin(v.t * 6 + m)))},30,${0.65 + 0.35 * Math.sin(v.t * 9 + m)})`;
          ctx.fillRect(x + ((c + 0.5) * g.cw - g.ww / 2) * sc, wy, g.ww * sc, g.wh * sc);
        }
      }
      const fy = base - (f.fireFrom * FLOOR_H + 6) * sc;
      const glow = ctx.createRadialGradient(x + w / 2, fy, 0, x + w / 2, fy, w * 1.2);
      glow.addColorStop(0, 'rgba(255,140,40,0.35)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - w, fy - w * 1.2, w * 3, w * 2.4);
      const fTop = hash(f.n + 5) < 0.5 ? top : fy;
      for (let j = 0; j < 5; j++) {
        const fx = x + ((j + 0.5) * w) / 5, fl = sc * (2 + 2.5 * Math.abs(Math.sin(v.t * 5 + j + f.n)));
        ctx.fillStyle = j % 2 ? 'rgba(251,146,60,0.9)' : 'rgba(253,224,71,0.85)';
        ctx.beginPath(); ctx.moveTo(fx - w / 9, fTop); ctx.quadraticCurveTo(fx, fTop - fl * 1.4, fx + w / 9, fTop); ctx.fill();
      }
      for (let j = 0; j < 5; j++) {
        const life = (v.t * 0.05 + hash(f.n + j * 9)) % 1, r = w * (0.4 + life * 1.4);
        const sx = x + w / 2 + Math.sin(life * 4 + f.n) * w * 0.6 + life * w * 1.5, sy = fTop - life * sc * 45;
        const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        smoke.addColorStop(0, `rgba(30,24,24,${0.45 * (1 - life)})`); smoke.addColorStop(1, 'rgba(30,24,24,0)');
        ctx.fillStyle = smoke; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
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

// Departamento de lujo: ventanal de piso a techo (afuera arde la ciudad), parantes de aluminio, cielorraso
// con luces embutidas, piso de mármol y plantas o lámparas de pie delante del vidrio.
function drawLuxRoom(ctx: CanvasRenderingContext2D, g: LavaGame, b: Building, k: number, a: number, c: number, r: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), fh = y1 - y0, seed = b.id * 1000 + k * 10 + r;
  const top = Y(v, y1), base = Y(v, y0), left = X(v, a), w = (c - a) * s;
  const sky = ctx.createLinearGradient(0, top, 0, base);
  sky.addColorStop(0, '#1c0b12'); sky.addColorStop(0.55, '#7c2d12'); sky.addColorStop(1, '#fb923c');
  ctx.fillStyle = sky; ctx.fillRect(left, top, w, base - top);
  // La ciudad de afuera: edificios lejanos con ventanas prendidas (y alguno que se quema).
  for (let x = a; x < c; x += 0.45) {
    const hh = fh * (0.2 + hash(seed + x * 7.3) * 0.65), bx = X(v, x), bw = 0.42 * s;
    ctx.fillStyle = hash(x * 3 + seed) < 0.5 ? '#160b0d' : '#21100f'; ctx.fillRect(bx, base - hh * s, bw, hh * s);
    for (let yy = 0.25; yy < hh - 0.2; yy += 0.32) for (const xx of [0.08, 0.26]) {
      const lit = hash(seed + x * 11 + yy * 5 + xx * 3);
      if (lit < 0.35) { ctx.fillStyle = lit < 0.06 ? '#fb923c' : 'rgba(253,224,171,0.75)'; ctx.fillRect(bx + xx * s, base - (hh - yy) * s, 0.08 * s, 0.11 * s); }
    }
  }
  // Reflejos del vidrio y parantes de aluminio.
  ctx.fillStyle = 'rgba(186,230,253,0.13)';
  for (let x = a + 0.3; x < c; x += 2.6) { ctx.beginPath(); ctx.moveTo(X(v, x), base); ctx.lineTo(X(v, x + 1.1), top); ctx.lineTo(X(v, x + 1.6), top); ctx.lineTo(X(v, x + 0.5), base); ctx.fill(); }
  ctx.fillStyle = 'rgba(56,189,248,0.07)'; ctx.fillRect(left, top, w, base - top);
  const mull = ctx.createLinearGradient(0, 0, s * 0.12, 0); mull.addColorStop(0, '#94a3b8'); mull.addColorStop(1, '#475569');
  for (let x = a + 1.3; x < c - 0.2; x += 1.3) { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(X(v, x) - s * 0.05, top, s * 0.1, base - top); ctx.fillStyle = 'rgba(15,23,42,0.35)'; ctx.fillRect(X(v, x) + s * 0.05, top, s * 0.03, base - top); }
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(left, base - s * 0.95, w, s * 0.05); // travesaño (baranda de vidrio)
  // Cielorraso con luces embutidas.
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(left, top, w, s * 0.22);
  for (let x = a + 0.7; x < c - 0.3; x += 1.4) {
    const lx = X(v, x), cone = ctx.createLinearGradient(0, top + s * 0.22, 0, top + s * 1.6);
    cone.addColorStop(0, 'rgba(255,247,214,0.35)'); cone.addColorStop(1, 'rgba(255,247,214,0)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(lx - s * 0.08, top + s * 0.22); ctx.lineTo(lx + s * 0.08, top + s * 0.22); ctx.lineTo(lx + s * 0.5, top + s * 1.6); ctx.lineTo(lx - s * 0.5, top + s * 1.6); ctx.fill();
    ctx.fillStyle = '#fef9c3'; ctx.fillRect(lx - s * 0.1, top + s * 0.19, s * 0.2, s * 0.04);
  }
  // Adornos delante del vidrio.
  const list = ['plant', 'floorlamp', 'plant', 'plant'], n = Math.max(1, Math.floor((c - a - 1) / 2.6));
  for (let i = 0; i < n; i++) {
    const cx = a + 0.6 + (i + 0.5) * (c - a - 1.2) / n + (hash(seed + i) - 0.5) * 0.5;
    drawDecorItem(ctx, list[Math.floor(hash(seed + i * 13) * list.length)], X(v, cx), base, top, s, v.t, seed + i);
  }
  // Piso de mármol.
  fillTex(ctx, v, texture(ctx, v, 'marble-floor', 1, 0.5, marble('#e7e5e4', 'rgba(120,113,108,0.35)')), '#e7e5e4', a, y0, c - a, 0.08);
  const fire = g.fires.find(f => Math.abs(f.y - y0) < 0.01 && f.x2 > a && f.x1 < c);
  if (fire) { // el vidrio ennegrecido arriba del fuego
    const fx = X(v, (fire.x1 + fire.x2) / 2), burnt = ctx.createRadialGradient(fx, Y(v, y0 + 1.5), 0, fx, Y(v, y0 + 1.5), s * 2);
    burnt.addColorStop(0, 'rgba(15,8,6,0.8)'); burnt.addColorStop(1, 'rgba(15,8,6,0)');
    ctx.fillStyle = burnt; ctx.fillRect(Math.max(left, fx - s * 2), Y(v, y0 + 3.5), Math.min(left + w, fx + s * 2) - Math.max(left, fx - s * 2), s * 4);
  }
}

// Lo que se mueve en cada habitación: la lámpara del techo (algunas titilan) y el resplandor del fuego.
function drawRoomLive(ctx: CanvasRenderingContext2D, g: LavaGame, b: Building, k: number, a: number, c: number, r: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), seed = b.id * 1000 + k * 10 + r, top = Y(v, y1);
  const lx = X(v, (a + c) / 2 + (hash(seed + 7) - 0.5));
  const flick = 0.75 + 0.25 * Math.sin(v.t * (hash(seed + 8) < 0.3 ? 23 : 0.7) + seed);
  if (b.luxury) { // lámpara colgante lineal
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx - s * 0.5, top + s * 0.22); ctx.lineTo(lx - s * 0.5, top + s * 0.75); ctx.moveTo(lx + s * 0.5, top + s * 0.22); ctx.lineTo(lx + s * 0.5, top + s * 0.75); ctx.stroke();
    ctx.fillStyle = '#1f2937'; ctx.fillRect(lx - s * 0.65, top + s * 0.72, s * 1.3, s * 0.08);
    ctx.fillStyle = `rgba(254,243,199,${flick})`; ctx.fillRect(lx - s * 0.6, top + s * 0.8, s * 1.2, s * 0.03);
  } else {
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, top + s * 0.4); ctx.stroke();
    ctx.fillStyle = `rgba(251,191,36,${flick})`; ctx.beginPath(); ctx.moveTo(lx - s * 0.25, top + s * 0.62); ctx.lineTo(lx + s * 0.25, top + s * 0.62); ctx.lineTo(lx + s * 0.12, top + s * 0.4); ctx.lineTo(lx - s * 0.12, top + s * 0.4); ctx.fill();
  }
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

// Habitaciones de un piso: una o dos, cada una con su empapelado y sus cosas. Si hay una pared del medio
// (con la puerta tapiada), las dos habitaciones son las de cada lado.
const partitionOf = (b: Building, k: number) => b.partitions.find(w => w.floor === k);
const roomsOf = (b: Building, k: number): [number, number][] => {
  const wall = partitionOf(b, k);
  if (wall) return [[b.x, wall.x], [wall.x, b.x + b.w]];
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
    const rooms = roomsOf(b, k), wall = partitionOf(b, k);
    rooms.forEach(([a, c], r) => (b.luxury ? drawLuxRoom : drawRoom)(ctx, g, b, k, a, c, r, v));
    if (wall) drawPartition(ctx, b, k, wall.x, v);
    else if (rooms.length > 1 && b.luxury) { // tabique de vidrio esmerilado
      const split = rooms[0][1];
      ctx.fillStyle = 'rgba(226,232,240,0.35)'; ctx.fillRect(X(v, split) - s * 0.06, Y(v, y1), s * 0.12, (y1 - y0) * s);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(X(v, split) - s * 0.08, Y(v, y1), s * 0.03, (y1 - y0) * s); ctx.fillRect(X(v, split) + s * 0.05, Y(v, y1), s * 0.03, (y1 - y0) * s);
    } else if (rooms.length > 1) { // pared y marco de la puerta entre las dos habitaciones
      const split = rooms[0][1];
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(X(v, split) - s * 0.1, Y(v, y1), s * 0.2, (y1 - y0 - 2.15) * s);
      ctx.fillStyle = '#7c5a3c'; ctx.fillRect(X(v, split) - s * 0.08, Y(v, y0 + 2.15), s * 0.16, 2.15 * s);
      ctx.fillRect(X(v, split) - s * 0.5, Y(v, y0 + 2.15), s, s * 0.1);
    }
    if (!b.luxury) drawCracks(ctx, b, k, v);
    // Paredes de afuera (ladrillo; en las torres de lujo, muro cortina de vidrio) y puertas a los costados.
    const brick = brickOf(ctx, v, b);
    for (const w of g.walls) {
      if (Math.abs(w.y1 - y0) > 1e-6 || (Math.abs(w.x - (b.x + WALL / 2)) > 1e-6 && Math.abs(w.x - (b.x + b.w - WALL / 2)) > 1e-6)) continue;
      if (b.luxury) {
        const gx = X(v, w.x - WALL / 2), gw = WALL * s, gy = Y(v, w.y2), gh = (w.y2 - w.y1) * s;
        const glass = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
        glass.addColorStop(0, '#1e3a5f'); glass.addColorStop(0.45, '#60a5fa'); glass.addColorStop(0.55, '#1e40af'); glass.addColorStop(1, '#0f172a');
        ctx.fillStyle = glass; ctx.fillRect(gx, gy, gw, gh);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(gx, gy, gw, s * 0.06); ctx.fillRect(gx, gy + gh * 0.5, gw, s * 0.04); ctx.fillRect(gx + gw / 2 - 1, gy, 2, gh);
      } else {
        fillTex(ctx, v, brick, facade(b), w.x - WALL / 2, w.y1, WALL, w.y2 - w.y1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X(v, w.x + WALL / 2) - 2, Y(v, w.y2), 2, (w.y2 - w.y1) * s);
      }
    }
    // Afuera: cornisa en cada losa, caño de desagüe y algún aire acondicionado colgado de la pared.
    ctx.fillStyle = b.luxury ? '#e2e8f0' : hsl(b.hue, 8, 62); ctx.fillRect(X(v, b.x - 0.14), Y(v, y0 + 0.06), (b.w + 0.28) * s, s * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X(v, b.x - 0.14), Y(v, y0 - 0.04), (b.w + 0.28) * s, s * 0.04);
    for (const [side, set] of b.luxury ? [] : [[-1, b.doors.left], [1, b.doors.right]] as const) {
      if (set.has(k) || (side > 0 && b.tower)) continue;
      const out = side < 0 ? b.x - 0.16 : b.x + b.w + 0.04, seed = b.id * 53 + k * 5 + side;
      if (side < 0 || hash(seed) < 0.5) { // caño
        ctx.fillStyle = '#57534e'; ctx.fillRect(X(v, out + 0.02), Y(v, y1), s * 0.09, (y1 - y0) * s);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(X(v, out + 0.03), Y(v, y1), s * 0.02, (y1 - y0) * s);
        ctx.fillStyle = '#44403c'; ctx.fillRect(X(v, out), Y(v, y0 + 1.5), s * 0.13, s * 0.06);
      }
      if (k > 0 && k % 3 === 1 && hash(seed + 21) < 0.35 && !set.has(k + 1)) { // cartel luminoso vertical
        const sx = side < 0 ? b.x - 0.66 : b.x + b.w + 0.14, words = ['HOTEL', 'CAFÉ', 'BAR', 'CINE', 'PIZZA', '24HS', 'TANGO', 'CLUB'];
        const word = words[Math.floor(hash(seed + 22) * words.length)], neon = hsl(Math.floor(hash(seed + 23) * 360), 90, 60);
        const sy1 = y0 + 0.45, sy2 = Math.min(y1 - 0.05, y0 + 0.45 + word.length * 0.5);
        ctx.fillStyle = '#44403c'; ctx.fillRect(X(v, side < 0 ? sx + 0.5 : sx - 0.14), Y(v, sy2 - 0.3), s * 0.14, s * 0.06); ctx.fillRect(X(v, side < 0 ? sx + 0.5 : sx - 0.14), Y(v, sy1 + 0.3), s * 0.14, s * 0.06);
        ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.roundRect(X(v, sx), Y(v, sy2), s * 0.52, (sy2 - sy1) * s, s * 0.06); ctx.fill();
        ctx.shadowColor = neon; ctx.shadowBlur = s * 0.3; ctx.strokeStyle = neon; ctx.lineWidth = Math.max(1.5, s * 0.035);
        ctx.beginPath(); ctx.roundRect(X(v, sx + 0.05), Y(v, sy2 - 0.05), s * 0.42, (sy2 - sy1 - 0.1) * s, s * 0.05); ctx.stroke();
        ctx.fillStyle = neon; ctx.font = font(900, s * 0.36); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [...word].forEach((ch, i) => ctx.fillText(ch, X(v, sx + 0.26), Y(v, sy2 - 0.36 - i * ((sy2 - sy1 - 0.3) / word.length))));
        ctx.shadowBlur = 0;
      }
      if (k > 0 && hash(seed + 9) < 0.3) { // aire acondicionado con su ventilador y la mancha que deja el goteo
        const ax = side < 0 ? b.x - 0.6 : b.x + b.w + 0.02, ay = y0 + 1.7;
        ctx.fillStyle = 'rgba(60,50,40,0.25)'; ctx.fillRect(X(v, ax + 0.2), Y(v, ay - 0.05), s * 0.08, s * 1.1);
        ctx.fillStyle = '#d6d3d1'; ctx.fillRect(X(v, ax), Y(v, ay + 0.42), s * 0.58, s * 0.42);
        ctx.fillStyle = '#a8a29e'; ctx.fillRect(X(v, ax), Y(v, ay + 0.05), s * 0.58, s * 0.05);
        ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(v, ax + 0.3), Y(v, ay + 0.21), s * 0.14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(v, ax + 0.16), Y(v, ay + 0.21)); ctx.lineTo(X(v, ax + 0.44), Y(v, ay + 0.21)); ctx.moveTo(X(v, ax + 0.3), Y(v, ay + 0.07)); ctx.lineTo(X(v, ax + 0.3), Y(v, ay + 0.35)); ctx.stroke();
      }
    }
    if (k > 0) for (const [side, set] of [[-1, b.doors.left], [1, b.doors.right]] as const) if (set.has(k)) drawDoor(ctx, b, k, side, v); // la planta baja da a la calle
    for (const p of g.plats) {
      if (!mine(p) || !isSlab(p)) continue;
      if (b.luxury) { // losa de piedra oscura con una línea de luz en el borde
        fillTex(ctx, v, texture(ctx, v, 'marble-dark', 1, 1, marble('#334155', 'rgba(203,213,225,0.25)')), '#334155', p.x, p.y - 0.24, p.w, 0.24);
        ctx.fillStyle = 'rgba(186,230,253,0.55)'; ctx.fillRect(X(v, p.x), Y(v, p.y - 0.2), p.w * s, s * 0.025);
        continue;
      }
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
  // Escaleras caracol, muebles y escalones de este piso.
  const spirals = g.spirals.filter(sp => sp.b === b.id && Math.abs(sp.y0 - y0) < 0.01);
  for (const sp of spirals) drawSpiral(ctx, sp, g, v);
  const inSpiral = (p: Plat) => spirals.some(sp => p.y > sp.y0 && p.y < sp.y1 && p.x >= sp.x1 - 0.01 && p.x + p.w <= sp.x2 + 0.01);
  for (const p of g.plats) if (p.b === b.id && p.floor === k && (p.kind === 'furniture' || p.kind === 'step') && !inSpiral(p)) drawPlat(ctx, p, g, v);
}

// Pared del medio, de piso a techo, que no se puede cruzar: ladrillo (en las torres de lujo, vidrio esmerilado
// con perfiles de acero). Donde había una puerta quedó tapiada con ladrillos nuevos, tablones clavados, cinta
// de peligro y un cartel de "SIN PASO".
function drawPartition(ctx: CanvasRenderingContext2D, b: Building, k: number, x: number, v: View) {
  const s = v.s, y0 = floorY(b, k), y1 = floorY(b, k + 1), seed = b.id * 977 + k * 31, ww = WALL * 1.3;
  const left = X(v, x - ww / 2), top = Y(v, y1), w = ww * s, h = (y1 - y0) * s;
  const dh = Math.min(2.2, y1 - y0 - 0.45);
  if (b.luxury) {
    const glass = ctx.createLinearGradient(left, 0, left + w, 0);
    glass.addColorStop(0, '#334155'); glass.addColorStop(0.5, '#cbd5e1'); glass.addColorStop(1, '#1e293b');
    ctx.fillStyle = glass; ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(left - 1, top, 2, h); ctx.fillRect(left + w - 1, top, 2, h); ctx.fillRect(left, Y(v, y0 + dh), w, s * 0.05);
  } else {
    fillTex(ctx, v, brickOf(ctx, v, b), facade(b), x - ww / 2, y0, ww, y1 - y0);
    // Ladrillos nuevos (más claros) donde estaba la puerta.
    fillTex(ctx, v, texture(ctx, v, 'brick-new', 1, 0.5, bricks(16, 55, 52, '#d6d3d1')), '#c2410c', x - ww / 2, y0, ww, dh);
    ctx.fillStyle = 'rgba(120,113,108,0.5)'; ctx.fillRect(left, Y(v, y0 + dh), w, s * 0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(left + w - 2, top, 2, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(left, top, 2, h);
  }
  // Marco de la puerta vieja, a los dos lados de la pared.
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(left - s * 0.08, Y(v, y0 + dh), s * 0.08, dh * s); ctx.fillRect(left + w, Y(v, y0 + dh), s * 0.08, dh * s);
  ctx.fillRect(left - s * 0.12, Y(v, y0 + dh) - s * 0.08, w + s * 0.24, s * 0.1);
  // Tablones cruzados y clavados.
  const plank = (y: number, tilt: number, tone: number) => {
    ctx.save(); ctx.translate(X(v, x), Y(v, y0 + y)); ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-s * 0.5, -s * 0.04, s * 1.0, s * 0.16);
    ctx.fillStyle = `hsl(30, 42%, ${tone}%)`; ctx.fillRect(-s * 0.5, -s * 0.08, s * 1.0, s * 0.15);
    ctx.strokeStyle = 'rgba(80,45,20,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.02); ctx.lineTo(s * 0.45, -s * 0.03); ctx.stroke();
    ctx.fillStyle = '#d1d5db'; for (const px of [-0.4, 0.4]) { ctx.beginPath(); ctx.arc(px * s, 0, s * 0.025, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  plank(dh * 0.82, -0.5 + hash(seed) * 0.12, 50); plank(dh * 0.82, 0.5 - hash(seed + 1) * 0.12, 44);
  plank(dh * 0.45, 0.06 - hash(seed + 2) * 0.12, 48); plank(dh * 0.15, -0.04 + hash(seed + 3) * 0.08, 42);
  // Cinta de peligro cruzada y cartel.
  ctx.save(); ctx.translate(X(v, x), Y(v, y0 + dh * 0.62)); ctx.rotate(0.35);
  ctx.beginPath(); ctx.rect(-s * 0.55, -s * 0.05, s * 1.1, s * 0.1); ctx.clip();
  for (let i = -6; i < 6; i++) { ctx.fillStyle = i % 2 ? '#111827' : '#facc15'; ctx.beginPath(); ctx.moveTo(i * s * 0.1, s * 0.05); ctx.lineTo(i * s * 0.1 + s * 0.05, -s * 0.05); ctx.lineTo(i * s * 0.1 + s * 0.15, -s * 0.05); ctx.lineTo(i * s * 0.1 + s * 0.1, s * 0.05); ctx.fill(); }
  ctx.restore();
  const sy = Y(v, y0 + dh + 0.42);
  ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(v, x) - s * 0.25, top); ctx.lineTo(X(v, x) - s * 0.25, sy - s * 0.14); ctx.moveTo(X(v, x) + s * 0.25, top); ctx.lineTo(X(v, x) + s * 0.25, sy - s * 0.14); ctx.stroke();
  ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.roundRect(X(v, x) - s * 0.46, sy - s * 0.14, s * 0.92, s * 0.28, s * 0.04); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(X(v, x) - s * 0.42, sy - s * 0.11, s * 0.84, s * 0.22, s * 0.03); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SIN PASO', X(v, x), sy + s * 0.01);
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
    drawSpire(ctx, b, v, ry);
    for (let i = 0; i < 2; i++) { const bx = X(v, b.x + 0.4 + i * (b.w - 0.8)); ctx.fillStyle = Math.floor(v.t * 2 + i) % 2 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(bx, ry - s * 0.5, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  } else if (b.luxury) drawLuxRoof(ctx, b, v, ry);
  else if (b.roofDecor) drawRoofStuff(ctx, b, v, ry);
  if (b.luxury) { // corona de luz en el borde de la terraza
    const glow = ctx.createLinearGradient(0, ry - s * 0.3, 0, ry);
    glow.addColorStop(0, 'rgba(125,211,252,0)'); glow.addColorStop(1, `rgba(125,211,252,${0.35 + 0.1 * Math.sin(v.t * 2 + b.id)})`);
    ctx.fillStyle = glow; ctx.fillRect(X(v, b.x - 0.15), ry - s * 0.3, (b.w + 0.3) * s, s * 0.3);
  }
}

// Terraza de una torre de lujo: baranda de vidrio, pileta con reposeras y sombrilla, y plantas en macetones.
function drawLuxRoof(ctx: CanvasRenderingContext2D, b: Building, v: View, ry: number) {
  const s = v.s;
  for (const [x1, x2] of [[b.x - 0.1, b.x + 1.6], [b.x + b.w - 1.6, b.x + b.w + 0.1]]) { // baranda de vidrio en las puntas
    ctx.fillStyle = 'rgba(186,230,253,0.25)'; ctx.fillRect(X(v, x1), ry - s * 0.9, (x2 - x1) * s, s * 0.9);
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(X(v, x1), ry - s * 0.92, (x2 - x1) * s, s * 0.06);
  }
  if (!b.roofDecor) return;
  // Pileta (borde de piedra, agua celeste con reflejos que se mueven).
  const px = b.x + b.w * 0.3, pw = Math.min(4.2, b.w * 0.36), ph = 0.65;
  fillTex(ctx, v, texture(ctx, v, 'marble-floor', 1, 0.5, marble('#e7e5e4', 'rgba(120,113,108,0.35)')), '#e7e5e4', px - 0.15, b.top, pw + 0.3, ph + 0.08);
  const water = ctx.createLinearGradient(0, Y(v, b.top + ph), 0, Y(v, b.top + 0.1));
  water.addColorStop(0, '#67e8f9'); water.addColorStop(1, '#0e7490');
  ctx.fillStyle = water; ctx.fillRect(X(v, px), Y(v, b.top + ph), pw * s, (ph - 0.1) * s);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { const wx = px + ((v.t * 0.25 + i / 4) % 1) * pw; ctx.beginPath(); ctx.moveTo(X(v, wx), Y(v, b.top + ph - 0.05)); ctx.quadraticCurveTo(X(v, wx + 0.2), Y(v, b.top + ph - 0.12), X(v, Math.min(px + pw, wx + 0.4)), Y(v, b.top + ph - 0.05)); ctx.stroke(); }
  // Reposeras con toalla y sombrilla.
  for (let i = 0; i < 2; i++) {
    const lx = X(v, px + pw + 0.5 + i * 1.1), ly = ry;
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + s * 0.1, ly - s * 0.25); ctx.lineTo(lx + s * 0.8, ly - s * 0.25); ctx.lineTo(lx + s * 0.95, ly - s * 0.6); ctx.moveTo(lx + s * 0.8, ly - s * 0.25); ctx.lineTo(lx + s * 0.75, ly); ctx.stroke();
    ctx.strokeStyle = ['#f472b6', '#38bdf8'][i]; ctx.lineWidth = Math.max(2, s * 0.06); ctx.beginPath(); ctx.moveTo(lx + s * 0.15, ly - s * 0.29); ctx.lineTo(lx + s * 0.78, ly - s * 0.29); ctx.stroke();
  }
  const ux = X(v, px + pw + 1.6);
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ux, ry); ctx.lineTo(ux, ry - s * 1.6); ctx.stroke();
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(ux - s * 0.85, ry - s * 1.45); ctx.quadraticCurveTo(ux, ry - s * 2.05, ux + s * 0.85, ry - s * 1.45); ctx.fill();
  ctx.fillStyle = '#fef2f2'; ctx.beginPath(); ctx.moveTo(ux - s * 0.3, ry - s * 1.62); ctx.quadraticCurveTo(ux, ry - s * 1.98, ux + s * 0.3, ry - s * 1.62); ctx.fill();
  // Macetones con plantas.
  for (const fx of [b.x + 1.9, px - 0.9]) {
    ctx.fillStyle = '#334155'; ctx.fillRect(X(v, fx), ry - s * 0.5, s * 0.6, s * 0.5);
    ctx.fillStyle = '#15803d'; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(X(v, fx + 0.3) + (j - 1.5) * s * 0.12, ry - s * (0.75 + (j % 2) * 0.2), s * 0.12, s * 0.35, (j - 1.5) * 0.4, 0, Math.PI * 2); ctx.fill(); }
  }
}

// Antena de la torre más alta: mástil con riendas y balizas rojas que titilan.
function drawSpire(ctx: CanvasRenderingContext2D, b: Building, v: View, ry: number) {
  const s = v.s, cx = X(v, b.x + b.w / 2), h = s * 7;
  ctx.fillStyle = '#334155'; ctx.fillRect(cx - s * 0.6, ry - s * 0.8, s * 1.2, s * 0.8);
  const metal = ctx.createLinearGradient(cx - s * 0.12, 0, cx + s * 0.12, 0); metal.addColorStop(0, '#64748b'); metal.addColorStop(0.5, '#e2e8f0'); metal.addColorStop(1, '#475569');
  ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(cx - s * 0.16, ry - s * 0.8); ctx.lineTo(cx - s * 0.04, ry - h); ctx.lineTo(cx + s * 0.04, ry - h); ctx.lineTo(cx + s * 0.16, ry - s * 0.8); ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - s * 1.8, ry); ctx.lineTo(cx, ry - h * 0.55); ctx.lineTo(cx + s * 1.8, ry); ctx.stroke();
  for (const k of [0.45, 0.75, 1]) { const on = Math.floor(v.t * 1.2 + k * 3) % 2; ctx.fillStyle = on ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(cx, ry - h * k, s * 0.1, 0, Math.PI * 2); ctx.fill(); }
}

// Cosas de la terraza: equipos de aire, caños de ventilación y un tanque de agua o una antena con parabólica.
function drawRoofStuff(ctx: CanvasRenderingContext2D, b: Building, v: View, ry: number) {
  const s = v.s, left = b.x + 0.7, room = b.w - 4; // a la derecha quedan las camas elásticas y las tirolesas
  // Baranda de caño.
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.beginPath(); ctx.moveTo(X(v, b.x - 0.1), ry - s * 0.75); ctx.lineTo(X(v, b.x + 1.6), ry - s * 0.75);
  for (const px of [b.x - 0.08, b.x + 0.75, b.x + 1.58]) { ctx.moveTo(X(v, px), ry); ctx.lineTo(X(v, px), ry - s * 0.75); }
  ctx.stroke();
  // Equipos de aire acondicionado.
  for (let i = 0; i < 2; i++) {
    const ax = X(v, left + room * (0.15 + i * 0.4 + hash(b.id * 3 + i) * 0.1)), aw = s * 0.9, ah = s * 0.6;
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(ax, ry - ah, aw, ah);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(ax + aw * 0.75, ry - ah, aw * 0.25, ah);
    ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.arc(ax + aw * 0.38, ry - ah / 2, ah * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax + aw * 0.38 - ah * 0.3, ry - ah / 2); ctx.lineTo(ax + aw * 0.38 + ah * 0.3, ry - ah / 2); ctx.stroke();
  }
  // Caños de ventilación con sombrerito.
  for (let i = 0; i < 2; i++) {
    const px = X(v, left + room * (0.05 + hash(b.id * 7 + i) * 0.9)), ph = s * (0.5 + hash(b.id + i * 11) * 0.4);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(px, ry - ph, s * 0.14, ph);
    ctx.fillStyle = '#4b5563'; ctx.fillRect(px - s * 0.06, ry - ph - s * 0.06, s * 0.26, s * 0.08);
  }
  if (hash(b.id + 3) < 0.55) {
    // Tanque de agua de madera con zunchos, techito cónico y patas de hierro.
    const tx = X(v, left + room * (0.3 + hash(b.id) * 0.4)), tw = s * 1.4, legs = s * 0.6, th = s * 1.15;
    ctx.strokeStyle = '#44403c'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(tx + tw * 0.1, ry); ctx.lineTo(tx + tw * 0.15, ry - legs); ctx.moveTo(tx + tw * 0.9, ry); ctx.lineTo(tx + tw * 0.85, ry - legs);
    ctx.moveTo(tx + tw * 0.1, ry); ctx.lineTo(tx + tw * 0.85, ry - legs); ctx.moveTo(tx + tw * 0.9, ry); ctx.lineTo(tx + tw * 0.15, ry - legs); ctx.stroke();
    const wood = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    wood.addColorStop(0, '#5b3a1e'); wood.addColorStop(0.4, '#8b5a2b'); wood.addColorStop(1, '#4a2f17');
    ctx.fillStyle = wood; ctx.fillRect(tx, ry - legs - th, tw, th);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(tx + (i * tw) / 6, ry - legs - th); ctx.lineTo(tx + (i * tw) / 6, ry - legs); ctx.stroke(); }
    ctx.fillStyle = '#1f2937'; for (const k of [0.2, 0.55, 0.85]) ctx.fillRect(tx - 1, ry - legs - th * k - 1, tw + 2, 2.5);
    ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.moveTo(tx - s * 0.08, ry - legs - th); ctx.lineTo(tx + tw / 2, ry - legs - th - s * 0.45); ctx.lineTo(tx + tw + s * 0.08, ry - legs - th); ctx.fill();
  } else {
    // Antena con riendas, luz roja y una parabólica.
    const ax = X(v, left + room * 0.75);
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ry); ctx.lineTo(ax, ry - s * 2.2); ctx.moveTo(ax - s * 0.4, ry - s * 1.5); ctx.lineTo(ax + s * 0.4, ry - s * 1.5); ctx.moveTo(ax - s * 0.25, ry - s * 1.9); ctx.lineTo(ax + s * 0.25, ry - s * 1.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(156,163,175,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax - s * 0.9, ry); ctx.lineTo(ax, ry - s * 1.6); ctx.lineTo(ax + s * 0.9, ry); ctx.stroke();
    ctx.fillStyle = Math.floor(v.t * 1.5) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(ax, ry - s * 2.25, s * 0.08, 0, Math.PI * 2); ctx.fill();
    const dx = X(v, left + room * 0.25);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(dx, ry - s * 0.45, s * 0.08, s * 0.45);
    ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse(dx + s * 0.1, ry - s * 0.7, s * 0.18, s * 0.38, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(dx + s * 0.1, ry - s * 0.7); ctx.lineTo(dx + s * 0.4, ry - s * 0.9); ctx.stroke();
  }
}

// Escalera caracol: columna de mármol, escalones de piedra con su ménsula de hierro y la baranda que gira.
function drawSpiral(ctx: CanvasRenderingContext2D, sp: Spiral, g: LavaGame, v: View) {
  const s = v.s, cx = (sp.x1 + sp.x2) / 2;
  const steps = g.plats.filter(p => p.kind === 'step' && p.b === sp.b && p.y > sp.y0 && p.y < sp.y1 && p.x >= sp.x1 - 0.01 && p.x + p.w <= sp.x2 + 0.01).sort((p, q) => p.y - q.y);
  fillTex(ctx, v, texture(ctx, v, 'marble-col', 0.5, 1, marble('#f1f5f9', 'rgba(100,116,139,0.35)')), '#e7e5e4', cx - 0.13, sp.y0, 0.26, sp.y1 - sp.y0 + 0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(X(v, cx + 0.06), Y(v, sp.y1), s * 0.07, (sp.y1 - sp.y0) * s);
  const rail: [number, number][] = [];
  for (const p of steps) {
    const x = X(v, p.x), y = Y(v, p.y), w = p.w * s, outer = p.x + p.w / 2 < cx ? p.x : p.x + p.w;
    ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1.5, s * 0.04); // ménsula hasta la columna
    ctx.beginPath(); ctx.moveTo(X(v, p.x + p.w / 2), y + s * 0.1); ctx.lineTo(X(v, cx), y + s * 0.38); ctx.stroke();
    const tread = ctx.createLinearGradient(0, y - s * 0.06, 0, y + s * 0.14);
    tread.addColorStop(0, '#f5f5f4'); tread.addColorStop(1, '#a8a29e');
    ctx.fillStyle = tread; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - s * 0.06, y + s * 0.14); ctx.lineTo(x + s * 0.06, y + s * 0.14); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + s * 0.06, y + s * 0.14, w - s * 0.12, s * 0.04);
    rail.push([X(v, outer), Y(v, p.y + 0.95)]);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(v, outer), y); ctx.lineTo(X(v, outer), Y(v, p.y + 0.95)); ctx.stroke(); // barrote
  }
  if (rail.length > 1) {
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(rail[0][0], rail[0][1]);
    for (let i = 1; i < rail.length; i++) { const [px, py] = rail[i - 1], [qx, qy] = rail[i]; ctx.quadraticCurveTo((px + qx) / 2, Math.min(py, qy) - s * 0.08, qx, qy); }
    ctx.stroke(); ctx.lineJoin = 'miter';
  }
}

// Grúa torre: mástil reticulado, cabina, pluma con pasarela (se camina por arriba), contrapluma con los
// contrapesos, torre de arriba con los tensores, carro con la cadena del gancho y balizas.
function drawCrane(ctx: CanvasRenderingContext2D, c: Crane, g: LavaGame, v: View) {
  if (!visible(v, c.jx1 - 1, c.jx2 + 1, c.hookY - 2, c.jy + 4)) return;
  const s = v.s, yel = '#eab308', dark = '#a16207', lw = Math.max(1.5, s * 0.045);
  const lattice = (x1: number, y1: number, x2: number, y2: number, w: number, vertical: boolean) => {
    ctx.strokeStyle = yel; ctx.lineWidth = lw * 1.6; ctx.beginPath();
    if (vertical) { ctx.moveTo(X(v, x1 - w), Y(v, y1)); ctx.lineTo(X(v, x1 - w), Y(v, y2)); ctx.moveTo(X(v, x1 + w), Y(v, y1)); ctx.lineTo(X(v, x1 + w), Y(v, y2)); }
    else { ctx.moveTo(X(v, x1), Y(v, y1)); ctx.lineTo(X(v, x2), Y(v, y1)); ctx.moveTo(X(v, x1), Y(v, y1 + w)); ctx.lineTo(X(v, x2), Y(v, y2 + w)); }
    ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = lw; ctx.beginPath();
    if (vertical) for (let y = y1, i = 0; y < y2; y += w * 2, i++) { ctx.moveTo(X(v, x1 + (i % 2 ? w : -w)), Y(v, y)); ctx.lineTo(X(v, x1 + (i % 2 ? -w : w)), Y(v, Math.min(y2, y + w * 2))); }
    else for (let x = x1, i = 0; x < x2; x += 0.6, i++) { const k = (x - x1) / (x2 - x1), k2 = (Math.min(x2, x + 0.6) - x1) / (x2 - x1); ctx.moveTo(X(v, x), Y(v, y1 + (i % 2 ? w : 0) + (y2 - y1) * k)); ctx.lineTo(X(v, Math.min(x2, x + 0.6)), Y(v, y1 + (i % 2 ? 0 : w) + (y2 - y1) * k2)); }
    ctx.stroke();
  };
  lattice(c.mx, c.base, c.mx, c.jy, 0.45, true); // mástil
  // Torre de arriba y tensores hasta las puntas.
  const apex = c.jy + 3.2;
  ctx.strokeStyle = yel; ctx.lineWidth = lw * 1.6; ctx.beginPath();
  ctx.moveTo(X(v, c.mx - 0.45), Y(v, c.jy + 0.7)); ctx.lineTo(X(v, c.mx), Y(v, apex)); ctx.lineTo(X(v, c.mx + 0.45), Y(v, c.jy + 0.7)); ctx.stroke();
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.beginPath();
  ctx.moveTo(X(v, c.mx), Y(v, apex)); ctx.lineTo(X(v, c.jx2 - 0.4), Y(v, c.jy + 0.7)); ctx.moveTo(X(v, c.mx), Y(v, apex)); ctx.lineTo(X(v, c.jx1 + 0.2), Y(v, c.jy + 0.7)); ctx.stroke();
  // Pluma (por arriba se camina) y contrapluma.
  lattice(c.jx1, c.jy + 0.05, c.jx2, c.jy + 0.05, 0.7, false);
  ctx.fillStyle = '#44403c'; ctx.fillRect(X(v, c.jx1), Y(v, c.jy) - s * 0.06, (c.jx2 - c.jx1) * s, s * 0.12); // pasarela de rejilla
  ctx.strokeStyle = 'rgba(250,204,21,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); // baranda baja
  ctx.moveTo(X(v, c.jx1), Y(v, c.jy + 0.75)); ctx.lineTo(X(v, c.jx2), Y(v, c.jy + 0.75)); ctx.stroke();
  for (let i = 0; i < 3; i++) { // contrapesos de hormigón
    const bx = c.jx1 + 0.1 + i * 0.42;
    fillTex(ctx, v, texture(ctx, v, 'concrete', 1, 1, concrete(58)), '#a8a29e', bx, c.jy - 1.2, 0.38, 1.15);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(X(v, bx), Y(v, c.jy - 0.05), 0.38 * s, 1.15 * s);
  }
  // Cabina del grúista colgada debajo de la pluma.
  ctx.fillStyle = yel; ctx.beginPath(); ctx.roundRect(X(v, c.mx + 0.5), Y(v, c.jy - 0.1), s * 1.1, s * 1.05, s * 0.1); ctx.fill();
  ctx.fillStyle = '#7dd3fc'; ctx.fillRect(X(v, c.mx + 0.62), Y(v, c.jy - 0.25), s * 0.86, s * 0.45);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(X(v, c.mx + 0.66), Y(v, c.jy - 0.25), s * 0.15, s * 0.45);
  // Carro del gancho.
  ctx.fillStyle = '#374151'; ctx.fillRect(X(v, c.hookX - 0.3), Y(v, c.jy), s * 0.6, s * 0.18);
  // Cartel en la chapa de la pluma y balizas.
  ctx.fillStyle = '#1f2937'; ctx.fillRect(X(v, c.mx + 1.9), Y(v, c.jy + 0.62), s * 2.1, s * 0.5);
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GRÚA ▶', X(v, c.mx + 2.95), Y(v, c.jy + 0.37));
  const blink = Math.floor(v.t * 1.5 + c.id) % 2;
  for (const [x, y] of [[c.jx2, c.jy + 0.8], [c.mx, apex + 0.15], [c.jx1, c.jy + 0.8]]) {
    ctx.fillStyle = blink ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), s * 0.09, 0, Math.PI * 2); ctx.fill();
    if (blink) { const gl = ctx.createRadialGradient(X(v, x), Y(v, y), 0, X(v, x), Y(v, y), s * 0.6); gl.addColorStop(0, 'rgba(239,68,68,0.5)'); gl.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = gl; ctx.fillRect(X(v, x) - s * 0.6, Y(v, y) - s * 0.6, s * 1.2, s * 1.2); }
  }
  // Cartel abajo del mástil.
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.24); ctx.fillText('▲ TREPÁ', X(v, c.mx), Y(v, c.base + 1.4));
}

// Cable tendido entre dos edificios: chapas en las paredes, aisladores y una comba (con el personaje colgado,
// el cable baja hasta sus manos).
function drawWire(ctx: CanvasRenderingContext2D, w: Wire, g: LavaGame, v: View) {
  if (!visible(v, w.x1 - 1, w.x2 + 1, Math.min(w.y1, w.y2) - 2, Math.max(w.y1, w.y2) + 1)) return;
  const s = v.s, p = g.player, held = p.wire === w;
  const ax = X(v, w.x1), ay = Y(v, w.y1), bx = X(v, w.x2), by = Y(v, w.y2);
  const sag = s * (0.18 + 0.04 * Math.sin(v.t * 1.3 + w.id));
  ctx.lineCap = 'round';
  for (const [color, width] of [['#0f172a', Math.max(2, s * 0.06)], ['rgba(148,163,184,0.7)', Math.max(0.8, s * 0.018)]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(ax, ay);
    if (held) { const hx = X(v, p.x), hy = Y(v, zipY(w, p.x)) + s * 0.08; ctx.lineTo(hx, hy); ctx.lineTo(bx, by); }
    else ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag * 2, bx, by);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const [x, y] of [[ax, ay], [bx, by]]) { // chapa y aislador
    ctx.fillStyle = '#57534e'; ctx.fillRect(x - s * 0.1, y - s * 0.18, s * 0.2, s * 0.36);
    ctx.fillStyle = '#d1fae5'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.07, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (!held) { // cartelito
    const tx = ax + (bx - ax) * 0.5, ty = (ay + by) / 2 + sag * 1.5;
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.roundRect(tx - s * 0.32, ty + s * 0.05, s * 0.64, s * 0.26, s * 0.05); ctx.fill();
    ctx.fillStyle = '#111827'; ctx.font = font(900, s * 0.17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↑ CABLE', tx, ty + s * 0.18);
  }
}

// Góndola de limpiavidrios: pescante en la terraza, dos cables, la canasta con baranda, el motor y un balde.
function drawGondola(ctx: CanvasRenderingContext2D, e: Elevator, g: LavaGame, v: View) {
  const b = g.buildings[e.b], st = elevatorAt(e, g.time), s = v.s;
  if (!visible(v, e.x - 1, e.x + e.w + 1, e.y1 - 1, b.top + 3)) return;
  const out = e.x > b.x ? 1 : -1, cx = e.x + e.w / 2, y = st.y;
  // Pescante en la terraza.
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(2, s * 0.08);
  const root = out > 0 ? b.x + b.w - 0.6 : b.x + 0.6;
  ctx.beginPath(); ctx.moveTo(X(v, root), Y(v, b.top)); ctx.lineTo(X(v, root), Y(v, b.top + 1.4)); ctx.lineTo(X(v, cx + out * 0.2), Y(v, b.top + 1.4)); ctx.stroke();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1, s * 0.025);
  for (const dx of [-0.65, 0.65]) { ctx.beginPath(); ctx.moveTo(X(v, cx + dx * 0.3), Y(v, b.top + 1.35)); ctx.lineTo(X(v, cx + dx), Y(v, y + 1.25)); ctx.stroke(); }
  // Canasta.
  const x = X(v, e.x), w = e.w * s, base = Y(v, y);
  ctx.fillStyle = '#475569'; ctx.fillRect(x, base, w, s * 0.16);
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath();
  ctx.moveTo(x, base - s * 1.15); ctx.lineTo(x + w, base - s * 1.15); ctx.moveTo(x, base - s * 0.6); ctx.lineTo(x + w, base - s * 0.6);
  for (let i = 0; i <= 4; i++) { ctx.moveTo(x + (w * i) / 4, base); ctx.lineTo(x + (w * i) / 4, base - s * 1.15); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(203,213,225,0.18)'; ctx.fillRect(x, base - s * 1.15, w, s * 1.15);
  ctx.fillStyle = '#f97316'; ctx.fillRect(x + w * 0.05, base - s * 1.32, w * 0.9, s * 0.17); // motor de cada lado y franja
  ctx.fillStyle = '#111827'; ctx.font = font(900, s * 0.13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GÓNDOLA', x + w / 2, base - s * 1.23);
  ctx.fillStyle = '#2563eb'; ctx.fillRect(x + w * 0.7, base - s * 0.42, s * 0.28, s * 0.32); // balde
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w * 0.2, base - s * 0.2); ctx.lineTo(x + w * 0.2, base - s * 0.95); ctx.moveTo(x + w * 0.12, base - s * 0.95); ctx.lineTo(x + w * 0.28, base - s * 0.95); ctx.stroke(); // secador
  if (st.open) { ctx.fillStyle = '#22c55e'; ctx.font = font(900, s * 0.2); ctx.fillText('¡SUBÍ!', x + w / 2, base - s * 1.6); }
}

// Montacargas de obra: dos rieles con cremallera y una jaula de malla amarilla (la reja se abre en cada piso).
function drawHoist(ctx: CanvasRenderingContext2D, e: Elevator, g: LavaGame, v: View) {
  if (!visible(v, e.x - 1, e.x + e.w + 1, e.y1, e.y2 + 3)) return;
  const st = elevatorAt(e, g.time), s = v.s, x = X(v, e.x), w = e.w * s, top = Y(v, e.y2 + 2.6), bottom = Y(v, e.y1);
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.moveTo(x + s * 0.1, top); ctx.lineTo(x + s * 0.1, bottom); ctx.moveTo(x + w - s * 0.1, top); ctx.lineTo(x + w - s * 0.1, bottom); ctx.stroke();
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = top; y < bottom; y += s * 0.15) { ctx.moveTo(x + s * 0.04, y); ctx.lineTo(x + s * 0.16, y); } ctx.stroke(); // cremallera
  const base = Y(v, st.y), ch = s * 2.1;
  ctx.fillStyle = 'rgba(250,204,21,0.15)'; ctx.fillRect(x + 2, base - ch, w - 4, ch);
  ctx.strokeStyle = '#eab308'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeRect(x + 2, base - ch, w - 4, ch);
  ctx.strokeStyle = 'rgba(234,179,8,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 1; i < 8; i++) { ctx.moveTo(x + 2 + ((w - 4) * i) / 8, base - ch); ctx.lineTo(x + 2 + ((w - 4) * i) / 8, base - (st.open ? ch * 0.15 : 0)); }
  for (let j = 1; j < 6; j++) { ctx.moveTo(x + 2, base - (ch * j) / 6); ctx.lineTo(x + w - 2, base - (ch * j) / 6); }
  ctx.stroke();
  ctx.fillStyle = '#44403c'; ctx.fillRect(x, base, w, s * 0.15);
  ctx.fillStyle = '#eab308'; ctx.fillRect(x, base - ch - s * 0.25, w, s * 0.25);
  ctx.fillStyle = '#111827'; ctx.font = font(900, s * 0.16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MONTACARGAS', x + w / 2, base - ch - s * 0.12);
  if (st.open) { ctx.fillStyle = '#22c55e'; ctx.font = font(900, s * 0.2); ctx.fillText('¡ENTRÁ!', x + w / 2, base - ch - s * 0.5); }
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
  if (p.kind === 'jib') return; // la pluma la dibuja la grúa
  if (p.kind === 'skybridge') return drawSkybridge(ctx, p, g, v);
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

// Medio puente colgante vidriado entre dos torres: el otro extremo está roto (vigas dobladas, vidrios
// partidos y cables que cuelgan) y hay que saltar el hueco.
function drawSkybridge(ctx: CanvasRenderingContext2D, p: Plat, g: LavaGame, v: View) {
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), w = p.w * s, h = 2.2 * s;
  const attachedLeft = g.buildings.some(b => Math.abs(b.x + b.w - (p.x + 0.15)) < 0.3);
  const brokenX = attachedLeft ? x + w : x, dir = attachedLeft ? 1 : -1;
  // Vidrios (con alguno partido cerca de la rotura) y parantes.
  ctx.fillStyle = 'rgba(186,230,253,0.16)'; ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath();
  for (let u = 0; u <= w; u += s * 0.9) { ctx.moveTo(x + u, y); ctx.lineTo(x + u, y - h); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let u = s * 0.2; u < w; u += s * 1.8) { ctx.beginPath(); ctx.moveTo(x + u, y - h * 0.15); ctx.lineTo(x + u + s * 0.3, y - h * 0.9); ctx.lineTo(x + u + s * 0.45, y - h * 0.9); ctx.lineTo(x + u + s * 0.15, y - h * 0.15); ctx.fill(); }
  ctx.strokeStyle = 'rgba(226,232,240,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
  const cx = brokenX - dir * s * 0.5;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.moveTo(cx, y - h * 0.5); ctx.lineTo(cx + Math.cos(a) * s * 0.5, y - h * 0.5 + Math.sin(a) * s * 0.6); }
  ctx.stroke();
  // Techo de vigas y la losa por donde se camina.
  ctx.fillStyle = '#64748b'; ctx.fillRect(x, y - h - s * 0.14, w, s * 0.14);
  const deck = ctx.createLinearGradient(0, y, 0, y + s * 0.3); deck.addColorStop(0, '#cbd5e1'); deck.addColorStop(0.3, '#64748b'); deck.addColorStop(1, '#1e293b');
  ctx.fillStyle = deck; ctx.fillRect(x, y, w, s * 0.3);
  // Borde roto: hormigón partido, vigas dobladas y cables colgando.
  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.moveTo(brokenX, y - s * 0.02);
  for (let j = 0; j <= 6; j++) ctx.lineTo(brokenX + dir * hash(p.id + j) * s * 0.25, y + (j / 6) * s * 0.3);
  ctx.lineTo(brokenX - dir * s * 0.05, y + s * 0.3); ctx.fill();
  ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath();
  for (let j = 0; j < 3; j++) { ctx.moveTo(brokenX, y + s * (0.06 + j * 0.09)); ctx.lineTo(brokenX + dir * s * (0.3 + j * 0.12), y + s * (0.25 + j * 0.2)); }
  ctx.moveTo(brokenX, y - h); ctx.lineTo(brokenX + dir * s * 0.5, y - h + s * 0.6); ctx.stroke();
  ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(1, s * 0.025);
  for (let j = 0; j < 2; j++) { const sw = Math.sin(v.t * 1.6 + j + p.id) * s * 0.15; ctx.beginPath(); ctx.moveTo(brokenX - dir * s * 0.1, y - h * (0.9 - j * 0.3)); ctx.quadraticCurveTo(brokenX + dir * s * 0.3 + sw, y + s * 0.5, brokenX + dir * s * 0.2 + sw * 1.5, y + s * (1.2 + j * 0.5)); ctx.stroke(); }
  // Franjas de peligro en la punta.
  for (let j = 0; j < 3; j++) { ctx.fillStyle = j % 2 ? '#111827' : '#facc15'; ctx.fillRect(brokenX - dir * s * (0.3 + j * 0.15) - (dir < 0 ? 0 : s * 0.15), y - s * 0.02, s * 0.15, s * 0.08); }
}

// Helipuerto: plataforma de chapa con borde, círculo amarillo y la H; el que espera al helicóptero tiene las
// luces de borde encendidas (titilan en verde cuando está por aterrizar o ya aterrizó).
function drawHelipad(ctx: CanvasRenderingContext2D, cx: number, y: number, s: number, active = false, t = 0, soon = false) {
  const deck = ctx.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.05);
  deck.addColorStop(0, '#4b5563'); deck.addColorStop(1, '#111827');
  ctx.fillStyle = '#374151'; ctx.fillRect(cx - s * 2, y - s * 0.16, s * 4, s * 0.16); // estructura
  ctx.fillStyle = deck; ctx.beginPath(); ctx.ellipse(cx, y - s * 0.16, s * 2.05, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.ellipse(cx, y - s * 0.16, s * 1.95, s * 0.21, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.beginPath(); ctx.ellipse(cx, y - s * 0.16, s * 1.45, s * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', cx, y - s * 0.17);
  for (let i = 0; i < 8; i++) { // luces del borde
    const a = (i / 8) * Math.PI * 2, lx = cx + Math.cos(a) * s * 2, ly = y - s * 0.16 + Math.sin(a) * s * 0.23;
    const on = active && (!soon || Math.floor(t * 4 + i * 0.5) % 2 === 0);
    ctx.fillStyle = on ? (soon ? '#4ade80' : '#fde047') : '#57534e';
    if (on) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = s * 0.35; }
    ctx.beginPath(); ctx.arc(lx, ly, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Manga de viento al costado.
  const mx = cx + s * 2.25;
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx, y - s * 1.3); ctx.stroke();
  const flap = Math.sin(t * 3) * s * 0.06;
  for (let j = 0; j < 3; j++) { ctx.fillStyle = j % 2 ? '#f8fafc' : '#f97316'; ctx.beginPath(); ctx.moveTo(mx + j * s * 0.2, y - s * (1.3 - j * 0.02) + flap * j); ctx.lineTo(mx + (j + 1) * s * 0.2, y - s * (1.28 - (j + 1) * 0.02) + flap * (j + 1)); ctx.lineTo(mx + (j + 1) * s * 0.2, y - s * (1.08 + (j + 1) * 0.02) + flap * (j + 1)); ctx.lineTo(mx + j * s * 0.2, y - s * (1.06 + j * 0.02) + flap * j); ctx.fill(); }
}

// Ascensor: pozo, cabina con luz, puertas en cada piso (se abren cuando para), botón y número de piso.
function drawElevators(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  const s = v.s;
  for (const e of g.elevators) {
    if (e.skin === 'gondola') { drawGondola(ctx, e, g, v); continue; }
    if (e.skin === 'hoist') { drawHoist(ctx, e, g, v); continue; }
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
  if (!visible(v, c.x - 1, c.x + 1, c.y1 - 1, c.y2)) return;
  const x = X(v, c.x), s = v.s, top = Y(v, c.y2), bottom = Y(v, c.y1);
  if (c.skin === 'pipe' || c.skin === 'pole') { // caño de desagüe (con abrazaderas) o caño de bronce
    const r = s * (c.skin === 'pipe' ? 0.08 : 0.055);
    const metal = ctx.createLinearGradient(x - r, 0, x + r, 0);
    if (c.skin === 'pipe') { metal.addColorStop(0, '#44403c'); metal.addColorStop(0.35, '#a8a29e'); metal.addColorStop(1, '#292524'); }
    else { metal.addColorStop(0, '#78350f'); metal.addColorStop(0.35, '#fde68a'); metal.addColorStop(1, '#92400e'); }
    ctx.fillStyle = metal; ctx.fillRect(x - r, top, r * 2, bottom - top);
    ctx.fillStyle = c.skin === 'pipe' ? '#292524' : '#b45309';
    for (let y = bottom - s * 0.4; y > top; y -= s * (c.skin === 'pipe' ? 0.8 : 1.4)) ctx.fillRect(x - r * 1.6, y, r * 3.2, s * 0.06);
    return;
  }
  if (c.skin === 'chain') { // cadena del gancho de la grúa (o colgada en la obra) con el gancho abajo
    ctx.strokeStyle = '#57534e'; ctx.lineWidth = Math.max(1.5, s * 0.035);
    const step = s * 0.16;
    for (let y = top, i = 0; y < bottom; y += step, i++) { ctx.beginPath(); if (i % 2) ctx.ellipse(x, y, s * 0.025, step * 0.6, 0, 0, Math.PI * 2); else ctx.ellipse(x, y, s * 0.06, step * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#292524'; ctx.lineWidth = Math.max(3, s * 0.08);
    ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, bottom + s * 0.25); ctx.arc(x + s * 0.18, bottom + s * 0.25, s * 0.18, Math.PI, Math.PI * 0.15, true); ctx.stroke();
    return;
  }
  if (c.skin === 'mast') { // escalera adentro del mástil de la grúa (el mástil lo dibuja la grúa)
    ctx.strokeStyle = '#78716c'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath();
    ctx.moveTo(x - s * 0.2, top); ctx.lineTo(x - s * 0.2, bottom); ctx.moveTo(x + s * 0.2, top); ctx.lineTo(x + s * 0.2, bottom);
    for (let y = bottom - s * 0.3; y > top; y -= s * 0.35) { ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x + s * 0.2, y); }
    ctx.stroke();
    return;
  }
  if (c.skin === 'scaffold') { // andamio de caños galvanizados con su escalerita
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.beginPath();
    ctx.moveTo(x - s * 0.45, top); ctx.lineTo(x - s * 0.45, bottom); ctx.moveTo(x + s * 0.45, top); ctx.lineTo(x + s * 0.45, bottom);
    for (let y = bottom - s * 1.0; y > top; y -= s * 1.0) { ctx.moveTo(x - s * 0.55, y); ctx.lineTo(x + s * 0.55, y); }
    ctx.moveTo(x - s * 0.45, bottom); ctx.lineTo(x + s * 0.45, top + (bottom - top) * 0.5); ctx.stroke();
    ctx.fillStyle = '#475569'; for (let y = bottom - s * 1.0; y > top; y -= s * 1.0) for (const dx of [-0.45, 0.45]) { ctx.beginPath(); ctx.arc(x + dx * s, y, s * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.beginPath();
    ctx.moveTo(x - s * 0.18, top); ctx.lineTo(x - s * 0.18, bottom); ctx.moveTo(x + s * 0.18, top); ctx.lineTo(x + s * 0.18, bottom);
    for (let y = bottom - s * 0.3; y > top; y -= s * 0.35) { ctx.moveTo(x - s * 0.18, y); ctx.lineTo(x + s * 0.18, y); }
    ctx.stroke();
    return;
  }
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
// Cómo está vestida cada persona: el mismo estilo que el protagonista, pero con su propia piel, pelo, gorro
// (o ninguno), remera (lisa, a rayas o de dos colores), pantalón y zapatillas. En las obras, casco y chaleco.
const HAIRS = ['#1c1917', '#3b2412', '#78350f', '#a16207', '#facc15', '#d6d3d1', '#7c2d12'];
const PANTS = [[37, 99, 235], [30, 58, 138], [17, 24, 39], [120, 113, 108], [180, 150, 100], [127, 29, 29], [21, 128, 61]];
const SHOES = [[248, 250, 252], [17, 24, 39], [220, 38, 38], [234, 179, 8], [120, 53, 15]];
const HATS: RunnerHat[] = ['short', 'long', 'cap', 'short', 'bun', 'beanie', 'long', 'bald', 'cap'];
function personLook(person: Person, burn: number): RunnerLook {
  const h = (n: number) => hash(person.id * 31 + n);
  const c = (rgb: number[]) => mix(rgb, CHAR, burn);
  const skin = SKINS[Math.floor(person.look * 4)];
  const shirtA = hslRgb(person.hue, 65, 48), shirtB = hslRgb((person.hue + 40 + h(1) * 160) % 360, 55, 72);
  const pattern = Math.floor(h(2) * 3); // 0 lisa, 1 a rayas, 2 dos colores
  const shirt: [string, string, string] = person.helmet ? [c([249, 115, 22]), c([250, 204, 21]), c([249, 115, 22])]
    : pattern === 0 ? [c(shirtA), c(shirtA), c(shirtA)] : pattern === 1 ? [c(shirtA), c(shirtB), c(shirtA)] : [c(shirtB), c(shirtA), c(shirtA)];
  const hat: RunnerHat = person.helmet ? 'helmet' : HATS[Math.floor(h(3) * HATS.length)];
  const hatRgb = hslRgb((person.hue + 180) % 360, 60, 45);
  return {
    skin: c(skin), ear: c(skin.map(v => v * 0.92)), hair: burn > 0.5 ? '#1c1917' : HAIRS[Math.floor(h(4) * HAIRS.length)],
    hat, hatColor: person.helmet ? c([250, 204, 21]) : c(hatRgb), brim: c(hatRgb.map(v => v * 0.75)), dot: c([255, 255, 255]),
    shirt, pants: c(PANTS[Math.floor(h(5) * PANTS.length)]), pantsEdge: 'rgba(0,0,0,0.35)', shoes: c(SHOES[Math.floor(h(6) * SHOES.length)]),
  };
}
// Una persona con los pies en 0,0 (hacia arriba es negativo), del mismo tamaño que el protagonista.
function drawBody(ctx: CanvasRenderingContext2D, person: Person, h: number, dir: 1 | -1, moving: boolean, armsUp: boolean, burn: number, t: number, pace = 9) {
  const w = h * (PLAYER_W / PLAYER_H);
  drawRunner(ctx, { x: -w / 2, y: -h, w, h, facing: dir, time: t + person.id, running: moving, airborne: false, falling: armsUp, look: personLook(person, burn), pace });
}
// Cuánto se ve una persona carbonizada antes de hundirse del todo en la lava.
const CHARRED_SHOW = 9;
function drawPerson(ctx: CanvasRenderingContext2D, person: Person, v: View, lava = -Infinity) {
  const { x, dir } = personX(person, v.t);
  // La gente que ya viene prendida fuego arde sin parar (y grita cada tanto) hasta que la alcanza la lava.
  const torch = person.torch && person.burnAt === null;
  const age = torch ? (v.t * 0.8 + person.id * 0.37) % 3 : person.burnAt === null ? 0 : v.t - person.burnAt;
  // Mientras arde y después, queda parada sobre la lava (que la va tapando de a poco), así se ve bien.
  const sink = Math.max(0, age - BURN_T - 2.6) * 0.14;
  const y = person.burnAt === null ? person.y : Math.max(person.y, lava + 0.02 - sink);
  if (!visible(v, x - 2, x + 2, y, y + 3)) return;
  const state = torch ? 'burning' : personState(person, v.t), s = v.s;
  const px = X(v, x), base = Y(v, y), h = s * PLAYER_H * (person.look < 0.2 ? 0.75 : 0.95 + hash(person.id) * 0.1), w = h * 0.4;
  if (state === 'calm') {
    ctx.save(); ctx.translate(px, base);
    drawBody(ctx, person, h, dir, true, false, 0, v.t);
    ctx.restore();
    return;
  }
  if (state === 'burning') {
    const burn = torch ? 0.3 : Math.min(1, age / BURN_T);
    // Resplandor del fuego alrededor.
    const glow = ctx.createRadialGradient(px, base - h * 0.6, 0, px, base - h * 0.6, h * 2.4);
    glow.addColorStop(0, `rgba(255,150,40,${0.55 + 0.15 * Math.sin(v.t * 20 + person.id)})`); glow.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(px - h * 2.4, base - h * 3, h * 4.8, h * 4.8);
    ctx.save(); ctx.translate(px, base);
    drawBody(ctx, person, h, dir, true, true, burn, v.t, 22); // corre desesperada con los brazos arriba
    ctx.restore();
    // Llamas que le salen de todo el cuerpo (cada vez más grandes).
    if (torch) ctx.globalAlpha = 0.8; // a los que corren prendidos fuego se les ve el cuerpo
    for (let i = 0; i < (torch ? 15 : 26); i++) {
      const life = (v.t * (1.6 + hash(i) * 0.8) + hash(person.id * 7 + i)) % 1;
      const fx = px + (hash(i * 5 + person.id) - 0.5) * w * 1.8 + Math.sin(v.t * 9 + i) * w * 0.2;
      const fy = base - h * (0.05 + 0.9 * hash(i * 3 + person.id)) - life * h * (0.9 + burn * 0.8);
      const r = w * (0.75 * (1 - life) + 0.15) * (1 + burn * 0.9);
      ctx.fillStyle = life < 0.25 ? `rgba(254,240,138,${1 - life})` : life < 0.6 ? `rgba(251,146,60,${0.95 - life})` : `rgba(220,38,38,${0.9 - life})`;
      ctx.beginPath(); ctx.moveTo(fx - r, fy); ctx.quadraticCurveTo(fx - r * 0.3, fy - r * 2.2, fx, fy - r * 2.6); ctx.quadraticCurveTo(fx + r * 0.3, fy - r * 2.2, fx + r, fy); ctx.arc(fx, fy, r, 0, Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
  drawBody(ctx, person, h, dir, false, fall < 0.5, 1, 0);
  ctx.restore();
  const smokeA = Math.max(0, 1 - after / CHARRED_SHOW);
  for (let i = 0; i < 3; i++) { const k = (after * 0.4 + i / 3) % 1; ctx.fillStyle = `rgba(110,105,100,${0.45 * (1 - k) * smokeA})`; ctx.beginPath(); ctx.arc(px + dir * h * 0.4 + Math.sin(after + i) * w, base - h * 0.3 - k * s * 1.4, w * (0.3 + k), 0, Math.PI * 2); ctx.fill(); }
}

// ---------- Helicópteros ----------
function drawHeli(ctx: CanvasRenderingContext2D, g: LavaGame, v: View, t: number) {
  const st = heliState(g, t), s = v.s;
  // Helipuertos: el que espera al helicóptero tiene las luces prendidas y un cartel con la cuenta regresiva.
  g.pads.forEach((pad, i) => {
    if (!visible(v, pad.x - 3, pad.x + HELI_W + 3, pad.y - 1, pad.y + 3)) return;
    const active = i === st.pad, soon = active && (st.phase === 'landed' || st.back < 8);
    drawHelipad(ctx, X(v, pad.x + HELI_W * 0.45), Y(v, pad.y), s, active, t, soon);
    if (!active || st.phase === 'landed') return;
    const cx = X(v, pad.x + HELI_W / 2), py = Y(v, pad.y), blink = Math.floor(t * 4) % 2;
    ctx.fillStyle = soon && blink ? '#16a34a' : 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(cx - s * 1.5, py - s * 1.35, s * 3, s * 0.52, s * 0.12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`🚁 aterriza en ${Math.ceil(st.back)} s`, cx, py - s * 1.09);
  });
  const h = { x: st.phase === 'up' ? g.pads[st.from].x : g.pads[st.pad].x, y: st.phase === 'up' ? g.pads[st.from].y : g.pads[st.pad].y, w: HELI_W, h: HELI_H };
  if (!visible(v, st.x - 3, st.x + h.w + 3, st.y - 2, st.y + h.h + 3)) return;
  const x = X(v, st.x), y = Y(v, st.y + h.h), w = h.w * s, hh = h.h * s;
  // Vuela con la trompa para el lado al que va (aterrizado queda mirando a la izquierda).
  const flip = st.dir > 0 && st.phase !== 'landed', mirror = 2 * (x + w * 0.68);
  if (flip) { ctx.save(); ctx.translate(mirror, 0); ctx.scale(-1, 1); }
  // Polvo que levanta el rotor cerca del piso.
  if (st.y - h.y < 4) {
    const k = 1 - (st.y - h.y) / 4;
    for (let i = 0; i < 6; i++) { const life = (t * 1.5 + i / 6) % 1, side = i % 2 ? 1 : -1; ctx.fillStyle = `rgba(200,190,180,${0.35 * k * (1 - life)})`; ctx.beginPath(); ctx.arc(X(v, st.x + h.w / 2) + side * life * w * 0.9, Y(v, h.y) - s * 0.2, s * (0.2 + life * 0.5), 0, Math.PI * 2); ctx.fill(); }
  }
  const flying = st.phase !== 'landed';
  // Sombra en el piso y, en el aire, el reflector que alumbra para abajo.
  if (st.y - h.y < 6) { const k = 1 - (st.y - h.y) / 6; ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(X(v, st.x + h.w * 0.45), Y(v, h.y) - s * 0.03, w * 0.55 * (0.6 + k * 0.4), s * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  if (flying) {
    const lx = x + w * 0.22, ly = y + hh * 0.86, reach = (st.y - h.y + 1.5) * s;
    const beam = ctx.createLinearGradient(0, ly, 0, ly + reach);
    beam.addColorStop(0, 'rgba(255,248,220,0.32)'); beam.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(lx - s * 0.08, ly); ctx.lineTo(lx + s * 0.08, ly); ctx.lineTo(lx + s * 1.2, ly + reach); ctx.lineTo(lx - s * 1.4, ly + reach); ctx.fill();
  }
  const red = ctx.createLinearGradient(0, y, 0, y + hh * 0.85);
  red.addColorStop(0, '#f87171'); red.addColorStop(0.35, '#dc2626'); red.addColorStop(1, '#7f1d1d');
  // Cola: botalón que se angosta, deriva, estabilizador y rotor de cola.
  ctx.fillStyle = red;
  ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + hh * 0.3); ctx.lineTo(x + w * 1.3, y + hh * 0.36); ctx.lineTo(x + w * 1.3, y + hh * 0.46); ctx.lineTo(x + w * 0.62, y + hh * 0.66); ctx.fill();
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(x + w * 0.64, y + hh * 0.46); ctx.lineTo(x + w * 1.3, y + hh * 0.41); ctx.lineTo(x + w * 1.3, y + hh * 0.43); ctx.lineTo(x + w * 0.64, y + hh * 0.52); ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath(); ctx.moveTo(x + w * 1.2, y + hh * 0.38); ctx.lineTo(x + w * 1.29, y + hh * 0.0); ctx.lineTo(x + w * 1.36, y + hh * 0.02); ctx.lineTo(x + w * 1.34, y + hh * 0.46); ctx.fill();
  ctx.fillRect(x + w * 1.08, y + hh * 0.44, w * 0.14, hh * 0.06);
  const trx = x + w * 1.31, try_ = y + hh * 0.2, trr = s * 0.42;
  ctx.fillStyle = 'rgba(30,41,59,0.16)'; ctx.beginPath(); ctx.arc(trx, try_, trr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,41,59,0.75)'; ctx.lineWidth = Math.max(1.5, s * 0.06);
  for (const a of [t * 40, t * 40 + Math.PI / 2]) { ctx.beginPath(); ctx.moveTo(trx - Math.cos(a) * trr, try_ - Math.sin(a) * trr); ctx.lineTo(trx + Math.cos(a) * trr, try_ + Math.sin(a) * trr); ctx.stroke(); }
  // Fuselaje con trompa redondeada, panza y franja blanca de rescate.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.04, y + hh * 0.6);
  ctx.bezierCurveTo(x + w * 0.04, y + hh * 0.25, x + w * 0.14, y + hh * 0.12, x + w * 0.3, y + hh * 0.12);
  ctx.lineTo(x + w * 0.6, y + hh * 0.12);
  ctx.quadraticCurveTo(x + w * 0.72, y + hh * 0.18, x + w * 0.72, y + hh * 0.48);
  ctx.quadraticCurveTo(x + w * 0.7, y + hh * 0.8, x + w * 0.56, y + hh * 0.82);
  ctx.lineTo(x + w * 0.18, y + hh * 0.82);
  ctx.quadraticCurveTo(x + w * 0.05, y + hh * 0.8, x + w * 0.04, y + hh * 0.6);
  ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(x, y + hh * 0.56, w * 0.8, hh * 0.1);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y + hh * 0.14, w * 0.8, hh * 0.06); // brillo de arriba
  ctx.restore();
  if (!flip) { ctx.fillStyle = '#fff'; ctx.font = font(900, hh * 0.13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RESCATE', x + w * 0.22, y + hh * 0.73); }
  // Cabina vidriada (con el piloto) y su marco.
  const glass = ctx.createLinearGradient(x, y + hh * 0.15, x + w * 0.3, y + hh * 0.55);
  glass.addColorStop(0, '#bae6fd'); glass.addColorStop(0.6, '#38bdf8'); glass.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.moveTo(x + w * 0.07, y + hh * 0.54); ctx.bezierCurveTo(x + w * 0.07, y + hh * 0.3, x + w * 0.14, y + hh * 0.17, x + w * 0.24, y + hh * 0.17); ctx.lineTo(x + w * 0.33, y + hh * 0.17); ctx.lineTo(x + w * 0.33, y + hh * 0.54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(15,23,42,0.7)'; ctx.beginPath(); ctx.arc(x + w * 0.24, y + hh * 0.33, hh * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + w * 0.205, y + hh * 0.4, w * 0.07, hh * 0.14);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + hh * 0.5); ctx.lineTo(x + w * 0.17, y + hh * 0.2); ctx.lineTo(x + w * 0.2, y + hh * 0.2); ctx.lineTo(x + w * 0.13, y + hh * 0.5); ctx.fill();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1.2, s * 0.035);
  ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + hh * 0.17); ctx.lineTo(x + w * 0.17, y + hh * 0.54); ctx.moveTo(x + w * 0.33, y + hh * 0.17); ctx.lineTo(x + w * 0.33, y + hh * 0.54); ctx.stroke();
  // Puerta corrediza con ventanita (abierta cuando está aterrizado).
  if (st.phase === 'landed') { // puerta abierta y un rescatista que hace señas
    ctx.fillStyle = '#111827'; ctx.fillRect(x + w * 0.38, y + hh * 0.2, w * 0.22, hh * 0.58);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(x + w * 0.6, y + hh * 0.2, w * 0.08, hh * 0.58);
    ctx.fillStyle = '#f97316'; ctx.fillRect(x + w * 0.45, y + hh * 0.4, w * 0.1, hh * 0.32);
    ctx.fillStyle = '#facc15'; ctx.fillRect(x + w * 0.45, y + hh * 0.5, w * 0.1, hh * 0.04);
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(x + w * 0.5, y + hh * 0.32, w * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x + w * 0.5, y + hh * 0.29, w * 0.047, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w * 0.54, y + hh * 0.44); ctx.lineTo(x + w * (0.64 + Math.sin(t * 10) * 0.04), y + hh * 0.14); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + w * 0.38, y + hh * 0.2, w * 0.22, hh * 0.58);
    ctx.fillStyle = '#7dd3fc'; ctx.fillRect(x + w * 0.42, y + hh * 0.26, w * 0.14, hh * 0.18);
  }
  // Patines con sus soportes y la punta curvada.
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + w * 0.12, y + hh); ctx.lineTo(x + w * 0.74, y + hh); ctx.quadraticCurveTo(x + w * 0.8, y + hh, x + w * 0.82, y + hh * 0.92);
  ctx.moveTo(x + w * 0.24, y + hh * 0.8); ctx.lineTo(x + w * 0.21, y + hh); ctx.moveTo(x + w * 0.58, y + hh * 0.8); ctx.lineTo(x + w * 0.62, y + hh);
  ctx.stroke(); ctx.lineCap = 'butt';
  // Turbina arriba (con la salida de gases), mástil y rotor principal girando.
  const cowl = ctx.createLinearGradient(0, y - hh * 0.04, 0, y + hh * 0.14);
  cowl.addColorStop(0, '#9ca3af'); cowl.addColorStop(1, '#4b5563');
  ctx.fillStyle = cowl; ctx.beginPath(); ctx.roundRect(x + w * 0.28, y - hh * 0.04, w * 0.34, hh * 0.18, hh * 0.08); ctx.fill();
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(x + w * 0.62, y + hh * 0.05, w * 0.025, hh * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w * (0.33 + i * 0.05), y); ctx.lineTo(x + w * (0.33 + i * 0.05), y + hh * 0.1); ctx.stroke(); }
  const hx = x + w * 0.44, hy = y - hh * 0.16, R = w * 0.82;
  ctx.fillStyle = '#374151'; ctx.fillRect(hx - s * 0.05, hy, s * 0.1, hh * 0.13);
  ctx.fillStyle = 'rgba(31,41,55,0.16)'; ctx.beginPath(); ctx.ellipse(hx, hy, R, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(31,41,55,0.85)';
  for (let i = 0; i < 4; i++) { const reach = Math.cos(t * 26 + (i * Math.PI) / 2) * R; ctx.fillRect(Math.min(hx, hx + reach), hy - s * 0.035, Math.abs(reach), s * 0.07); }
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(hx, hy, s * 0.08, 0, Math.PI * 2); ctx.fill();
  // Luces: baliza roja arriba, verde en la cola y un destello blanco.
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#f87171' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x + w * 0.45, y - hh * 0.05, s * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(x + w * 1.34, y + hh * 0.06, s * 0.05, 0, Math.PI * 2); ctx.fill();
  if (Math.floor(t * 6) % 6 === 0) { const sx = x + w * 1.29, sy = y + hh * 0.42, glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, s * 0.4); glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = glow; ctx.fillRect(sx - s * 0.4, sy - s * 0.4, s * 0.8, s * 0.8); }
  if (flip) {
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = font(900, hh * 0.13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RESCATE', mirror - (x + w * 0.22), y + hh * 0.73);
  }
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
  drawHero(ctx, { x: px, y: py, w: pw, h: ph, facing: p.facing, time: v.t, running: p.vx !== 0 && !!p.ground, airborne: !p.ground && !p.climb && !p.zip && !p.wire, climbing: !!p.climb || !!p.zip || !!p.wire, falling: !!g.dying, burnt }); // el mismo trepador que en Trepaluna
  if (g.dying?.reason === 'zap' && Math.floor(v.t * 20) % 2) bolts(ctx, px + pw / 2, py + ph / 2, pw * 1.2, v.t, '#fde047');
  if (g.dying) for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,113,108,${0.5 - i * 0.12})`; ctx.beginPath(); ctx.arc(px + pw / 2 + Math.sin(v.t * 6 + i) * pw * 0.4, py - i * pw * 0.6, pw * (0.25 + i * 0.1), 0, Math.PI * 2); ctx.fill(); }
}

// Flecha arriba de la cabeza que apunta al helipuerto donde va a aterrizar (o ya aterrizó) el helicóptero,
// con los metros que faltan hasta ahí. Cuando el helicóptero está aterrizado se pone verde y late.
function drawHeliArrow(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  if (g.dying || g.won) return;
  const p = g.player, s = v.s, target = heliTarget(g, g.time), landed = heliState(g, g.time).phase === 'landed';
  const dx = target.x - p.x, dy = target.y - (p.y + PLAYER_H / 2), dist = Math.hypot(target.x - p.x, target.y - p.y);
  const hx = X(v, p.x), hy = Y(v, p.y + PLAYER_H) - s * 0.95, pulse = landed ? 1 + 0.12 * Math.sin(v.t * 10) : 1;
  const fill = landed ? '#4ade80' : '#facc15', edge = landed ? '#14532d' : '#713f12';
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(Math.atan2(-dy, dx)); ctx.scale(pulse, pulse);
  const L = s * 0.42, T = s * 0.13, H = s * 0.26;
  ctx.beginPath();
  ctx.moveTo(-L, -T / 2); ctx.lineTo(L - H, -T / 2); ctx.lineTo(L - H, -H * 0.85); ctx.lineTo(L + H * 0.35, 0); ctx.lineTo(L - H, H * 0.85); ctx.lineTo(L - H, T / 2); ctx.lineTo(-L, T / 2); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = s * 0.12;
  ctx.fillStyle = fill; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.strokeStyle = edge; ctx.stroke();
  ctx.restore();
  // Metros hasta el helipuerto, en un cartelito arriba de la flecha.
  const label = `🚁 ${meters(dist)} m`;
  ctx.font = font(900, s * 0.26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + s * 0.3, ty = hy - s * 0.62;
  ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.beginPath(); ctx.roundRect(hx - tw / 2, ty - s * 0.2, tw, s * 0.4, s * 0.12); ctx.fill();
  ctx.fillStyle = fill; ctx.fillText(label, hx, ty + s * 0.01);
}

function draw(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  drawSoftBackground(ctx, v);
  for (const b of g.buildings) drawBuilding(ctx, b, g, v);
  for (const f of g.fallens) drawFallen(ctx, f, g, v);
  drawElevators(ctx, g, v);
  for (const e of g.escapes) drawEscape(ctx, e, g, v);
  for (const c of g.climbs) drawClimb(ctx, c, v);
  for (const z of g.zips) drawZip(ctx, z, g, v);
  for (const c of g.cranes) drawCrane(ctx, c, g, v);
  for (const w of g.wires) drawWire(ctx, w, g, v);
  for (const p of g.plats) if (p.kind !== 'furniture' && p.kind !== 'step') drawPlat(ctx, p, g, v); // los muebles y escalones van en la imagen de cada piso
  for (const f of g.fires) drawFire(ctx, f, v);
  for (const sp of g.sparks) drawSpark(ctx, sp, v);
  for (const person of g.people) if (person.burnAt === null) drawPerson(ctx, person, v);
  drawHeli(ctx, g, v, g.time);
  drawPlayer(ctx, g, v);
  drawLava(ctx, g, v);
  // La gente que alcanzó la lava se ve arder y quedar carbonizada (negra), parada sobre la lava hasta que se hunde.
  for (const person of g.people) {
    if (person.burnAt === null || v.t - person.burnAt > BURN_T + CHARRED_SHOW) continue;
    drawPerson(ctx, person, v, g.lava);
  }
  drawEmbers(ctx, v);
  drawHeliArrow(ctx, g, v);
  // Si la lava está muy cerca, el borde de la pantalla se pone rojo.
  const near = g.player.y - g.lava;
  if (!g.dying && near < 3) {
    const a = (1 - near / 3) * (0.5 + 0.3 * Math.sin(v.t * 10));
    const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
    vg.addColorStop(0, 'rgba(220,38,38,0)'); vg.addColorStop(1, `rgba(220,38,38,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  }
}

const LOSE_TEXT: Record<LoseReason, string> = { lava: '¡Te alcanzó la lava!', fire: '¡Te quemaste!', zap: '¡Cortocircuito!', torch: '¡Te prendió fuego una persona en llamas!' };
const NO_INPUT: Input = { left: false, right: false, jump: false, down: false, up: false };

// Se ven unas 14 unidades de alto (un poco más de 4 pisos) y, en pantallas angostas, unas 12 de ancho.
function scaleFor(w: number, h: number) { return Math.min(h / 14, w / 12); }
// Cuánto falta para que aterrice el helicóptero y, si está aterrizado, cuánto le queda.
function heliHud(g: LavaGame) {
  const st = heliState(g, g.time);
  return st.phase === 'landed' ? { landed: true, s: Math.ceil(st.left) } : { landed: false, s: Math.ceil(st.back) };
}

export function LavaFloor() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // La partida se arma una sola vez (no en cada vez que se vuelve a dibujar el componente).
  const [firstGame] = useState(() => newLava());
  const gameRef = useRef<LavaGame>(firstGame);
  const cam = useRef({ x: 0, y: 0 });
  const input = useRef<Input>({ ...NO_INPUT });
  const recordRef = useRef<LavaRecord>(readLavaRecord());
  const brokeRef = useRef(false);
  const startedRef = useRef(false);
  const zipToldRef = useRef(false);
  const wireToldRef = useRef(false);
  const torchScreamRef = useRef(-10);
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
    playStart();
    preloadLavaSounds();
    gameRef.current = newLava(); // cada partida arranca en otro lugar de la cuadra
    follow(-1);
    input.current = { ...NO_INPUT };
    recordRef.current = readLavaRecord();
    brokeRef.current = false; startedRef.current = false; zipToldRef.current = false; wireToldRef.current = false; torchScreamRef.current = -10;
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
    let frame = 0, last = performance.now(), walked = 0, lastScream = -1;
    let doors = gameRef.current.elevators.map(e => elevatorAt(e, gameRef.current.time).open);
    const tick = (now: number) => {
      const g = gameRef.current;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const x0 = g.player.x;
      step(g, input.current, dt);
      // Sonidos: pasos mientras camina apoyado, el "ding" de los ascensores cercanos y el ambiente.
      const p = g.player;
      if (p.ground && !g.dying) { walked += Math.abs(p.x - x0); if (walked > 1.5) { walked = 0; playFootstep(); } } else walked = 1;
      const open = g.elevators.map(e => elevatorAt(e, g.time).open);
      g.elevators.forEach((e, i) => {
        if (!open[i] || doors[i]) return;
        const d = Math.hypot(p.x - (e.x + e.w / 2), p.y - elevatorAt(e, g.time).y);
        playElevatorDing(Math.max(0, 1 - d / 7));
      });
      doors = open;
      setLavaAmbient(lavaLevels(g));
      // La gente prendida fuego que pasa cerca grita cada tanto.
      if (!g.dying && g.time - torchScreamRef.current > 2.6) {
        const near = g.people.filter(q => q.torch && q.burnAt === null && Math.abs(q.y - g.player.y) < 1.6).map(q => ({ q, d: Math.abs(personX(q, g.time).x - g.player.x) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d < 7) { torchScreamRef.current = g.time; playPersonBurn(0.6 * (1 - near.d / 7), 0.8 + near.q.look * 0.6); }
      }
      if (!startedRef.current && g.time >= LAVA_DELAY) { startedRef.current = true; setToast({ text: '¡La lava empezó a subir! ¡Corré para arriba! 🔥', id: now }); }
      for (const e of takeEvents(g)) {
        if (e.type === 'jump') playJump();
        if (e.type === 'bounce') playTramp();
        if (e.type === 'crumble') playCrumble();
        if (e.type === 'win') playWinFanfare();
        if (e.type === 'lose') { if (e.reason === 'lava') playLavaFall(); else playLose(e.reason === 'zap' ? 'zap' : 'burn'); }
        if (e.type === 'burn' && g.time - lastScream > 0.3) { // la gente que alcanza la lava (solo la que está cerca)
          const person = g.people.find(q => q.id === e.id);
          if (person) {
            const d = Math.hypot(p.x - personX(person, g.time).x, p.y - person.y);
            if (d < 14) { lastScream = g.time; playPersonBurn(1 - d / 14, 0.8 + person.look * 0.6); }
          }
        }
        if (e.type === 'faster') setToast({ text: e.level >= 4 ? '¡La lava sube a toda velocidad! 🌋' : '¡La lava sube cada vez más rápido! 🔥', id: now });
        if (e.type === 'heli') setToast({ text: '¡Llegaste al helipuerto! Subite cuando aterrice 🚁', id: now });
        if (e.type === 'heliLand') {
          const goal = heliTarget(g, g.time), far = meters(Math.hypot(goal.x - p.x, goal.y - p.y));
          setToast({ text: far < 30 ? '¡Aterrizó el helicóptero! Tenés 5 segundos 🚁' : `Aterrizó el helicóptero a ${far} m: seguí la flecha 🚁`, id: now, big: far < 30 });
        }
        if (e.type === 'zip' && !zipToldRef.current) { zipToldRef.current = true; setToast({ text: '¡Tirolesa! Con ↓ te soltás 🪢', id: now }); }
        if (e.type === 'wire' && !wireToldRef.current) { wireToldRef.current = true; setToast({ text: '¡Colgado del cable! Con ← → avanzás a mano y con ↓ te soltás 🧗', id: now }); }
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
        const height = g.won ? Math.max(m, meters(g.player.y)) : m;
        const next: LavaRecord = { height: Math.max(rec.height, height), time: g.won ? Math.min(rec.time ?? Infinity, g.time) : rec.time };
        const isNew = next.height > rec.height || (g.won && (rec.time === null || g.time < rec.time));
        saveRecord(next); setRecord(next);
        setResult({ m: height, time: g.time, reason: g.dying?.reason ?? 'lava', newRecord: isNew && (rec.height > 0 || g.won) });
        setToast(null);
        setLavaAmbient(null);
        if (!g.won) playGameOver();
        setStatus(g.won ? 'won' : 'over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden && !gameRef.current.dying) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); setLavaAmbient(null); };
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
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> subir por sogas, escaleras y tirolesas (o saltar) · <kbd>↓</kbd> bajar · <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
              <p className="runner-tip">💡 Seguí la flecha de arriba de tu cabeza: te lleva al helipuerto más cercano.</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="lava-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={false} id="lava-message" />
              <p>{LOSE_TEXT[result.reason]} Llegaste a <strong>{result.m} m</strong> en {formatLavaTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <EndBanner win id="lava-message" />
              <p className="end-reason">¡Te salvaste! 🚁</p>
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
          <div className="trepa-meter-marks"><span style={{ bottom: '100%' }}>🏙️ Torre<small>{TOWER_M} m</small></span><span style={{ bottom: pct(lavaM) }}>🌋 Lava<small>{lavaM} m</small></span></div>
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
