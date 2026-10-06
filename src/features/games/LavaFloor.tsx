import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawRunner } from './runnerCharacter';
import {
  BURN_T, floorY, LAVA_DELAY, meters, newLava, PLAYER_H, PLAYER_W, personState, personX, sparkActive, sparkWarning, step, takeEvents, towerOf, WALL,
  type Building, type Climb, type Escape, type Fire, type Heli, type Input, type LavaGame, type LoseReason, type Person, type Plat, type Spark,
} from './lava';

const RECORD_KEY = 'escritorio-personal-juegos:lava-record';
export interface LavaRecord { height: number; time: number | null } // metros más altos y mejor tiempo hasta el helicóptero
export const readLavaRecord = (): LavaRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.height === 'number' ? v : { height: 0, time: null }; } catch { return { height: 0, time: null }; }
};
const saveRecord = (value: LavaRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatLavaTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
const TOWER_M = meters(towerOf(newLava()).top);

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
interface View { w: number; h: number; s: number; cx: number; cy: number; t: number }
const X = (v: View, x: number) => (x - v.cx) * v.s;
const Y = (v: View, y: number) => v.h - (y - v.cy) * v.s;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const visible = (v: View, x1: number, x2: number, y1: number, y2: number) => X(v, x2) > -40 && X(v, x1) < v.w + 40 && Y(v, y1) > -40 && Y(v, y2) < v.h + 40;

// ---------- Fondo: cielo de humo, ciudad lejana y cenizas ----------
function drawBackground(ctx: CanvasRenderingContext2D, v: View, g: LavaGame) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.h);
  sky.addColorStop(0, '#1c1020'); sky.addColorStop(0.55, '#4a1d1a'); sky.addColorStop(1, '#b4461c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, v.w, v.h);
  // Ciudad lejana (se mueve más despacio que la cámara).
  for (let layer = 0; layer < 2; layer++) {
    const k = layer ? 0.45 : 0.25, base = Y(v, g.lava) * (1 - k) + v.h * k;
    ctx.fillStyle = layer ? '#2a1414' : '#3a1a18';
    for (let i = 0; i < 60; i++) {
      const bw = 40 + hash(i + layer * 99) * 70, bh = 80 + hash(i * 3 + layer) * 260 * (layer ? 1.3 : 1);
      const bx = ((i * 95 - v.cx * v.s * k) % (60 * 95) + 60 * 95) % (60 * 95) - 95;
      if (bx > v.w || bx + bw < 0) continue;
      ctx.fillRect(bx, base - bh + v.cy * v.s * k * 0.2, bw, v.h);
    }
  }
  // Humo que pasa.
  for (let i = 0; i < 7; i++) {
    const x = ((hash(i) * v.w * 1.6 + v.t * (8 + hash(i + 9) * 12)) % (v.w * 1.6)) - v.w * 0.3, y = v.h * (0.1 + hash(i + 4) * 0.5);
    const r = v.w * (0.12 + hash(i + 7) * 0.1);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,30,30,0.45)'); gr.addColorStop(1, 'rgba(40,30,30,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
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

// ---------- Edificios cortados de costado ----------
const facade = (b: Building) => hsl(b.hue, 28 + b.tone * 22, 30 + b.tone * 20);
const roomPaper = (b: Building, k: number, r: number) => hsl((b.hue + k * 37 + r * 71) % 360, 22 + hash(b.id * 31 + k) * 25, 66 + hash(b.id * 17 + k + r) * 14);

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
}

function drawRoomDecor(ctx: CanvasRenderingContext2D, b: Building, k: number, x1: number, x2: number, v: View, seed: number) {
  const s = v.s, y0 = floorY(b, k), fh = b.fh;
  const n = Math.max(1, Math.floor((x2 - x1) / 3.2));
  for (let i = 0; i < n; i++) {
    const r = hash(seed + i * 13);
    const cx = x1 + (i + 0.5) * (x2 - x1) / n + (hash(seed + i) - 0.5) * 0.8;
    const px = X(v, cx), base = Y(v, y0);
    if (r < 0.3) drawPicture(ctx, px - s * 0.45, Y(v, y0 + fh * 0.78), s * 0.9, s * 0.65, seed + i);
    else if (r < 0.5) { // ventana con el resplandor naranja de afuera
      const wx = px - s * 0.55, wy = Y(v, y0 + fh * 0.82), ww = s * 1.1, wh = s * 1.1;
      const gr = ctx.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#3b1d1d'); gr.addColorStop(1, '#f97316');
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      ctx.fillStyle = gr; ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    } else if (r < 0.62) { // lámpara colgante
      const ly = Y(v, y0 + fh - 0.05);
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, ly); ctx.lineTo(px, ly + s * 0.5); ctx.stroke();
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(px - s * 0.25, ly + s * 0.75); ctx.lineTo(px + s * 0.25, ly + s * 0.75); ctx.lineTo(px + s * 0.12, ly + s * 0.5); ctx.lineTo(px - s * 0.12, ly + s * 0.5); ctx.fill();
    } else if (r < 0.74) { // planta
      ctx.fillStyle = '#9a3412'; ctx.fillRect(px - s * 0.18, base - s * 0.35, s * 0.36, s * 0.35);
      ctx.fillStyle = '#15803d'; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(px + (j - 1.5) * s * 0.12, base - s * 0.55, s * 0.1, s * 0.28, (j - 1.5) * 0.4, 0, Math.PI * 2); ctx.fill(); }
    } else if (r < 0.84) { // reloj
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, Y(v, y0 + fh * 0.75), s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, Y(v, y0 + fh * 0.75)); ctx.lineTo(px + s * 0.12, Y(v, y0 + fh * 0.75) - s * 0.05); ctx.stroke();
    } else { // tele sobre un mueblecito
      ctx.fillStyle = '#78350f'; ctx.fillRect(px - s * 0.45, base - s * 0.4, s * 0.9, s * 0.4);
      ctx.fillStyle = '#111827'; ctx.fillRect(px - s * 0.4, base - s * 1.05, s * 0.8, s * 0.6);
      ctx.fillStyle = hsl((seed * 40) % 360, 70, 55, 0.8); ctx.fillRect(px - s * 0.34, base - s * 0.99, s * 0.68, s * 0.48);
    }
  }
  // alfombra
  if (hash(seed + 99) < 0.5) { ctx.fillStyle = hsl((seed * 53) % 360, 45, 45, 0.7); const rx = X(v, x1 + (x2 - x1) * hash(seed + 5) * 0.6); ctx.fillRect(rx, Y(v, y0) - s * 0.05, s * 2.2, s * 0.05); }
}

function drawCracks(ctx: CanvasRenderingContext2D, b: Building, v: View) {
  ctx.strokeStyle = 'rgba(30,20,20,0.55)'; ctx.lineWidth = Math.max(1, v.s * 0.03);
  const n = Math.floor(b.floors * 0.9);
  for (let i = 0; i < n; i++) {
    const seed = b.id * 101 + i * 7;
    let x = b.x + 0.4 + hash(seed) * (b.w - 0.8), y = (hash(seed + 1) * b.floors + 0.2) * b.fh;
    if (!visible(v, x - 1, x + 1, y - 1, y + 1)) continue;
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y));
    for (let j = 0; j < 5; j++) { x += (hash(seed + j * 3) - 0.5) * 0.6; y -= 0.25 + hash(seed + j * 5) * 0.3; ctx.lineTo(X(v, x), Y(v, y)); }
    ctx.stroke();
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, g: LavaGame, v: View) {
  if (!visible(v, b.x - 2, b.x + b.w + 2, 0, b.top + 3)) return;
  const s = v.s;
  for (let k = 0; k < b.floors; k++) {
    const y0 = floorY(b, k), y1 = floorY(b, k + 1);
    if (!visible(v, b.x, b.x + b.w, y0, y1)) continue;
    // Una o dos habitaciones por piso, cada una con su empapelado.
    const split = b.w > 8.5 && hash(b.id * 7 + k) < 0.55 ? b.x + b.w * (0.4 + hash(b.id + k) * 0.2) : null;
    const rooms: [number, number][] = split ? [[b.x, split], [split, b.x + b.w]] : [[b.x, b.x + b.w]];
    rooms.forEach(([a, c], r) => {
      ctx.fillStyle = roomPaper(b, k, r); ctx.fillRect(X(v, a), Y(v, y1), (c - a) * s + 1, (y1 - y0) * s + 1);
      if (hash(b.id * 3 + k + r) < 0.5) { // rayas del empapelado
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let x = a; x < c; x += 0.5) ctx.fillRect(X(v, x), Y(v, y1), s * 0.18, (y1 - y0) * s);
      }
      // zócalo
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(X(v, a), Y(v, y0) - s * 0.12, (c - a) * s, s * 0.12);
      drawRoomDecor(ctx, b, k, a + 0.6, c - 0.6, v, b.id * 1000 + k * 10 + r);
    });
    if (split) { // marco de la puerta entre las dos habitaciones
      ctx.fillStyle = '#7c5a3c'; ctx.fillRect(X(v, split) - s * 0.08, Y(v, y0 + 2), s * 0.16, 2 * s);
      ctx.fillRect(X(v, split) - s * 0.5, Y(v, y0 + 2), s, s * 0.1);
    }
  }
  drawCracks(ctx, b, v);
  // Partes quemadas alrededor de los incendios.
  for (const f of g.fires) {
    if (f.x2 < b.x || f.x1 > b.x + b.w) continue;
    const cx = X(v, (f.x1 + f.x2) / 2), cy = Y(v, f.y + 1.2), r = s * 1.9;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(20,10,8,0.85)'); gr.addColorStop(1, 'rgba(20,10,8,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Paredes de afuera (con las puertas abiertas: los marcos quedan rotos).
  ctx.fillStyle = facade(b);
  for (const w of g.walls) {
    if (Math.abs(w.x - (b.x + WALL / 2)) > 1e-6 && Math.abs(w.x - (b.x + b.w - WALL / 2)) > 1e-6) continue;
    ctx.fillRect(X(v, w.x - WALL / 2), Y(v, w.y2), WALL * s + 1, (w.y2 - w.y1) * s + 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (const [side, set] of [[-1, b.doors.left], [1, b.doors.right]] as const) {
    for (const k of set) {
      if (k >= b.floors) continue;
      const xw = side < 0 ? b.x : b.x + b.w - WALL, y1 = floorY(b, k + 1);
      // pedazos de pared rota arriba y abajo del hueco
      ctx.fillStyle = facade(b);
      ctx.beginPath(); ctx.moveTo(X(v, xw), Y(v, y1)); ctx.lineTo(X(v, xw + WALL), Y(v, y1)); ctx.lineTo(X(v, xw + WALL * (side < 0 ? 0.2 : 0.8)), Y(v, y1 - 0.5)); ctx.fill();
    }
  }
  // Pisos y terraza (con agujeros rotos).
  for (const p of g.plats) {
    if (p.b !== b.id || (p.kind !== 'floor' && p.kind !== 'roof')) continue;
    if (!visible(v, p.x, p.x + p.w, p.y - 1, p.y + 1)) continue;
    ctx.fillStyle = p.kind === 'roof' ? hsl(b.hue, 10, 40) : '#9ca3af';
    ctx.fillRect(X(v, p.x), Y(v, p.y), p.w * s, s * 0.24);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X(v, p.x), Y(v, p.y) + s * 0.18, p.w * s, s * 0.06);
  }
  for (const h of b.holes) {
    const y = floorY(b, h.floor);
    ctx.fillStyle = '#6b7280';
    for (const [x, d] of [[h.x1, 1], [h.x2, -1]] as const) { // bordes rotos y hierros
      ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y)); ctx.lineTo(X(v, x + d * 0.25), Y(v, y - 0.12)); ctx.lineTo(X(v, x), Y(v, y - 0.24)); ctx.fill();
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y - 0.1)); ctx.lineTo(X(v, x + d * 0.35), Y(v, y - 0.35)); ctx.stroke();
    }
  }
  // Terraza: baranda, tanque de agua o antena.
  const ry = Y(v, b.top);
  ctx.fillStyle = facade(b); ctx.fillRect(X(v, b.x - 0.15), ry - s * 0.35, s * 0.15, s * 0.35); ctx.fillRect(X(v, b.x + b.w), ry - s * 0.35, s * 0.15, s * 0.35);
  if (b.tower) { // helipuerto
    const hx = X(v, b.x + b.w / 2);
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(hx, ry - s * 0.05, s * 2.4, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.font = `900 ${Math.round(s * 0.4)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', hx, ry - s * 0.05);
    for (let i = 0; i < 2; i++) { const bx = X(v, b.x + 0.4 + i * (b.w - 0.8)); ctx.fillStyle = Math.floor(v.t * 2 + i) % 2 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(bx, ry - s * 0.5, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  } else if (hash(b.id + 3) < 0.55) {
    const tx = X(v, b.x + 1 + hash(b.id) * (b.w - 3));
    ctx.fillStyle = '#57534e'; ctx.fillRect(tx, ry - s * 0.5, s * 0.12, s * 0.5); ctx.fillRect(tx + s * 1.2, ry - s * 0.5, s * 0.12, s * 0.5);
    ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.roundRect(tx - s * 0.1, ry - s * 1.6, s * 1.5, s * 1.15, s * 0.2); ctx.fill();
  } else {
    const ax = X(v, b.x + b.w * 0.7);
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ry); ctx.lineTo(ax, ry - s * 1.8); ctx.moveTo(ax - s * 0.4, ry - s * 1.3); ctx.lineTo(ax + s * 0.4, ry - s * 1.3); ctx.stroke();
    ctx.fillStyle = Math.floor(v.t * 1.5) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(ax, ry - s * 1.85, s * 0.08, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Muebles, escalones, puentes, descansos y ascensores ----------
function drawFurniture(ctx: CanvasRenderingContext2D, p: Plat, v: View) {
  const s = v.s, x = X(v, p.x), w = p.w * s, top = Y(v, p.y), h = (p.h ?? 1) * s, base = top + h;
  const c = hsl(p.hue, 45, 45), dark = hsl(p.hue, 45, 30), light = hsl(p.hue, 45, 62);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  switch (p.furniture) {
    case 'sofa':
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(x, top - h * 0.35, w, h * 0.75, s * 0.15); ctx.fill(); // respaldo
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, top, w, h * 0.55, s * 0.12); ctx.fill();
      ctx.fillStyle = light; ctx.fillRect(x + w * 0.05, top + 2, w * 0.43, h * 0.18); ctx.fillRect(x + w * 0.52, top + 2, w * 0.43, h * 0.18);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(x - s * 0.08, top - h * 0.05, s * 0.25, h * 0.6, s * 0.08); ctx.roundRect(x + w - s * 0.17, top - h * 0.05, s * 0.25, h * 0.6, s * 0.08); ctx.fill();
      ctx.fillStyle = '#3f2a1c'; ctx.fillRect(x + s * 0.1, base - h * 0.45, s * 0.1, h * 0.45); ctx.fillRect(x + w - s * 0.2, base - h * 0.45, s * 0.1, h * 0.45);
      break;
    case 'bed':
      ctx.fillStyle = '#7c4a2d'; ctx.fillRect(x - s * 0.05, top - h * 0.6, s * 0.18, h * 1.6); // cabecera
      ctx.fillStyle = '#7c4a2d'; ctx.fillRect(x, top + h * 0.45, w, h * 0.3);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + s * 0.1, top, w - s * 0.1, h * 0.45);
      ctx.fillStyle = c; ctx.fillRect(x + w * 0.3, top - 1, w * 0.7, h * 0.47);
      ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(x + w * 0.16, top + h * 0.05, w * 0.1, h * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b3520'; ctx.fillRect(x, base - h * 0.25, s * 0.12, h * 0.25); ctx.fillRect(x + w - s * 0.12, base - h * 0.25, s * 0.12, h * 0.25);
      break;
    case 'table': case 'desk':
      ctx.fillStyle = p.furniture === 'desk' ? '#a16207' : '#92400e'; ctx.fillRect(x, top, w, s * 0.14);
      ctx.fillRect(x + s * 0.08, top, s * 0.12, h); ctx.fillRect(x + w - s * 0.2, top, s * 0.12, h);
      if (p.furniture === 'desk') { ctx.fillStyle = '#78350f'; ctx.fillRect(x + w * 0.55, top + s * 0.14, w * 0.4, h * 0.55); ctx.fillStyle = '#111827'; ctx.fillRect(x + w * 0.15, top - s * 0.55, s * 0.6, s * 0.42); ctx.fillStyle = '#38bdf8'; ctx.fillRect(x + w * 0.15 + 2, top - s * 0.55 + 2, s * 0.6 - 4, s * 0.42 - 6); }
      else { ctx.fillStyle = '#fef3c7'; ctx.fillRect(x + w * 0.1, top - s * 0.04, w * 0.8, s * 0.05); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + w * 0.5, top - s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'dresser': case 'wardrobe': case 'bookshelf':
      ctx.fillStyle = p.furniture === 'bookshelf' ? '#78350f' : hsl(p.hue, 30, 38); ctx.fillRect(x, top, w, h); ctx.strokeRect(x, top, w, h);
      if (p.furniture === 'bookshelf') {
        for (let r = 0; r < 4; r++) { const ry = top + h * (0.08 + r * 0.24); ctx.fillStyle = '#451a03'; ctx.fillRect(x + 2, ry + h * 0.18, w - 4, 2); for (let i = 0; i < 6; i++) { ctx.fillStyle = hsl((p.hue + i * 50 + r * 30) % 360, 55, 48); ctx.fillRect(x + 4 + i * (w - 8) / 6, ry + 2, (w - 8) / 6 - 2, h * 0.17); } }
      } else {
        const rows = p.furniture === 'wardrobe' ? 1 : 3;
        for (let r = 0; r < rows; r++) { ctx.strokeRect(x + 3, top + 3 + r * (h - 6) / rows, w - 6, (h - 6) / rows - 2); ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x + w / 2 + (rows === 1 ? s * 0.12 : 0), top + (r + 0.5) * h / rows, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
        if (rows === 1) { ctx.beginPath(); ctx.moveTo(x + w / 2, top + 3); ctx.lineTo(x + w / 2, base - 3); ctx.stroke(); }
      }
      break;
    case 'piano':
      ctx.fillStyle = '#111827'; ctx.fillRect(x, top, w, h); ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + w * 0.05, top + h * 0.35, w * 0.9, h * 0.15);
      ctx.fillStyle = '#111827'; for (let i = 0; i < 12; i++) ctx.fillRect(x + w * 0.07 + i * w * 0.075, top + h * 0.35, w * 0.03, h * 0.09);
      break;
    case 'washer': case 'fridge':
      ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.roundRect(x, top, w, h, s * 0.08); ctx.fill(); ctx.stroke();
      if (p.furniture === 'washer') { ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.58, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.58, Math.min(w, h) * 0.2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, top + h * 0.35); ctx.lineTo(x + w, top + h * 0.35); ctx.stroke(); ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + w * 0.8, top + h * 0.1, s * 0.06, h * 0.18); ctx.fillRect(x + w * 0.8, top + h * 0.45, s * 0.06, h * 0.25); }
      break;
  }
}

function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, v: View, t: number) {
  if (p.kind === 'floor' || p.kind === 'roof' || p.kind === 'street') return;
  if (!visible(v, p.x - 1, p.x + p.w + 1, p.y - 2, p.y + 2)) return;
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), w = p.w * s;
  if (p.kind === 'furniture') return drawFurniture(ctx, p, v);
  if (p.kind === 'step') {
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(x, y, w, s * 0.16);
    ctx.fillStyle = '#78716c'; ctx.fillRect(x, y + s * 0.16, w, s * 0.4);
    return;
  }
  if (p.kind === 'landing' || p.kind === 'balcony') {
    ctx.fillStyle = '#374151'; ctx.fillRect(x, y, w, s * 0.12);
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x, y - s * 0.8); ctx.lineTo(x + w, y - s * 0.8);
    for (let i = 0; i <= 4; i++) { ctx.moveTo(x + (w * i) / 4, y); ctx.lineTo(x + (w * i) / 4, y - s * 0.8); }
    ctx.stroke();
    return;
  }
  if (p.kind === 'elevator') {
    // Cabina del ascensor (el pozo se dibuja aparte).
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(x, y - s * 1.7, w, s * 1.75);
    ctx.fillStyle = '#d1d5db'; ctx.fillRect(x + s * 0.1, y - s * 1.6, w - s * 0.2, s * 1.55);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + (w * i) / 4, y - s * 1.6); ctx.lineTo(x + (w * i) / 4, y); ctx.stroke(); }
    ctx.fillStyle = '#4b5563'; ctx.fillRect(x, y, w, s * 0.14);
    ctx.strokeStyle = '#111827'; ctx.beginPath(); ctx.moveTo(x + w / 2, y - s * 1.7); ctx.lineTo(x + w / 2, -10); ctx.stroke();
    return;
  }
  // Puentes y tablones entre edificios (los tablones tiemblan y se caen).
  if (p.gone > 0) return;
  const shake = p.crumble > 0 ? Math.sin(t * 60) * s * 0.04 : 0;
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

function drawElevatorShaft(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  for (const e of g.elevators) {
    if (!visible(v, e.x, e.x + e.w, e.y1, e.y2 + 2)) continue;
    const x = X(v, e.x), w = e.w * v.s;
    ctx.fillStyle = 'rgba(30,30,35,0.55)'; ctx.fillRect(x, Y(v, e.y2 + 1.9), w, (e.y2 + 1.9 - e.y1) * v.s);
    ctx.strokeStyle = '#52525b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 2, Y(v, e.y2 + 1.9)); ctx.lineTo(x + 2, Y(v, e.y1)); ctx.moveTo(x + w - 2, Y(v, e.y2 + 1.9)); ctx.lineTo(x + w - 2, Y(v, e.y1)); ctx.stroke();
    // Sala de máquinas arriba de la terraza: el ascensor no sube más que esto.
    ctx.fillStyle = '#57534e'; ctx.fillRect(x - v.s * 0.2, Y(v, e.y2 + 2.2), w + v.s * 0.4, v.s * 0.4);
    ctx.fillStyle = '#fde047'; ctx.font = `800 ${Math.max(9, Math.round(v.s * 0.22))}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▲ TERRAZA', x + w / 2, Y(v, e.y2 + 2.0));
  }
}

function drawClimb(ctx: CanvasRenderingContext2D, c: Climb, v: View) {
  if (!visible(v, c.x - 1, c.x + 1, c.y1, c.y2)) return;
  const x = X(v, c.x), s = v.s, top = Y(v, c.y2), bottom = Y(v, c.y1);
  if (c.skin === 'rope') {
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(3, s * 0.1);
    ctx.beginPath(); ctx.moveTo(x, top - s * 0.3); for (let y = top; y <= bottom; y += 4) ctx.lineTo(x + Math.sin((y - top) / s * 0.9 + v.t * 1.5) * s * 0.06 * ((y - top) / (bottom - top)), y); ctx.stroke();
    ctx.strokeStyle = '#713f12'; ctx.lineWidth = 1; for (let y = top; y < bottom; y += s * 0.25) { ctx.beginPath(); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x + s * 0.05, y + s * 0.1); ctx.stroke(); }
    ctx.fillStyle = '#374151'; ctx.fillRect(x - s * 0.2, top - s * 0.35, s * 0.4, s * 0.1);
    return;
  }
  const half = c.skin === 'escape' ? s * 0.2 : s * 0.25;
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
  ctx.fillStyle = '#ef4444'; ctx.font = `900 ${Math.max(9, Math.round(s * 0.25))}px Nunito, system-ui`; ctx.textAlign = 'center';
  ctx.fillText('ROTA', x, Y(v, y + 2));
}

// ---------- Peligros ----------
function drawFire(ctx: CanvasRenderingContext2D, f: Fire, v: View) {
  if (!visible(v, f.x1, f.x2, f.y, f.y + f.h + 1)) return;
  const s = v.s, base = Y(v, f.y), n = Math.max(3, Math.round((f.x2 - f.x1) / 0.22));
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
    ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + s * 0.25, (top + end) / 2, cx, end); ctx.stroke();
    ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(cx, end, s * 0.07, 0, Math.PI * 2); ctx.fill();
    if (on) bolts(ctx, cx, end, s * 1.2, v.t, '#fde047');
    else if (warn && Math.floor(v.t * 16) % 2) { ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(cx, end, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const x = X(v, sp.x1), w = (sp.x2 - sp.x1) * s, y = Y(v, sp.y1);
    ctx.fillStyle = on ? 'rgba(125,211,252,0.85)' : 'rgba(96,165,250,0.55)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y - s * 0.03, w / 2, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    // enchufe roto en la pared, de donde sale el cortocircuito
    ctx.fillStyle = '#f5f5f4'; ctx.fillRect(x - s * 0.25, y - s * 0.5, s * 0.2, s * 0.28);
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
function drawPerson(ctx: CanvasRenderingContext2D, person: Person, v: View) {
  const { x, dir } = personX(person, v.t);
  if (!visible(v, x - 1, x + 1, person.y, person.y + 1.2)) return;
  const state = personState(person, v.t), s = v.s;
  const px = X(v, x), base = Y(v, person.y), h = s * (person.look < 0.2 ? 0.6 : 0.82), w = h * 0.4;
  const charred = state === 'charred', burning = state === 'burning';
  const skin = charred ? '#1c1917' : ['#fcd9b6', '#e0ac69', '#8d5524', '#f1c27d'][Math.floor(person.look * 4)];
  const shirt = charred ? '#0c0a09' : hsl(person.hue, 65, 50), pants = charred ? '#0c0a09' : hsl((person.hue + 200) % 360, 35, 30);
  const swing = state === 'charred' ? 0 : Math.sin(v.t * (burning ? 22 : 9) + person.id) * 0.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = pants; ctx.lineWidth = w * 0.35;
  ctx.beginPath(); ctx.moveTo(px, base - h * 0.45); ctx.lineTo(px - w * 0.4 * swing, base); ctx.moveTo(px, base - h * 0.45); ctx.lineTo(px + w * 0.4 * swing, base); ctx.stroke();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(px - w / 2, base - h * 0.8, w, h * 0.4, w * 0.2); ctx.fill();
  ctx.strokeStyle = skin; ctx.lineWidth = w * 0.22;
  const armUp = burning ? -h * 0.25 : 0; // al quemarse levanta los brazos
  ctx.beginPath(); ctx.moveTo(px, base - h * 0.75); ctx.lineTo(px + dir * w * 0.6, base - h * 0.5 + armUp); ctx.moveTo(px, base - h * 0.75); ctx.lineTo(px - dir * w * 0.5, base - h * 0.52 + armUp); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(px, base - h * 0.9, w * 0.38, 0, Math.PI * 2); ctx.fill();
  if (!charred) { ctx.fillStyle = person.look > 0.5 ? '#3b2412' : '#facc15'; ctx.beginPath(); ctx.arc(px - dir * w * 0.08, base - h * 0.97, w * 0.36, Math.PI, Math.PI * 2); ctx.fill(); }
  if (burning) { // se prende fuego
    for (let i = 0; i < 5; i++) {
      const fx = px + (i - 2) * w * 0.25, fl = h * (0.4 + 0.3 * Math.abs(Math.sin(v.t * 11 + i)));
      ctx.fillStyle = i % 2 ? '#f97316' : '#fde047';
      ctx.beginPath(); ctx.moveTo(fx - w * 0.2, base - h * 0.3); ctx.quadraticCurveTo(fx, base - h * 0.3 - fl * 1.5, fx + w * 0.2, base - h * 0.3); ctx.fill();
    }
  }
  if (charred) { // humo
    const age = v.t - (person.burnAt ?? 0) - BURN_T;
    for (let i = 0; i < 3; i++) { const k = (age * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(90,90,90,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(px + Math.sin(age + i) * w, base - h - k * s * 1.2, w * (0.3 + k), 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- Helicópteros ----------
function drawHeli(ctx: CanvasRenderingContext2D, h: Heli, v: View) {
  const bob = h.hover ? Math.sin(v.t * 2) * 0.15 : 0;
  if (!visible(v, h.x - 2, h.x + h.w + 2, h.y - 8, h.y + h.h + 2)) return;
  const s = v.s, x = X(v, h.x), y = Y(v, h.y + h.h + bob), w = h.w * s, hh = h.h * s;
  if (h.ladder) { // escalera de soga colgando
    const lx = X(v, h.ladder.x), top = Y(v, h.y + bob), bottom = Y(v, h.ladder.y1);
    ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx - s * 0.2, top); ctx.lineTo(lx - s * 0.2 + Math.sin(v.t) * 4, bottom); ctx.moveTo(lx + s * 0.2, top); ctx.lineTo(lx + s * 0.2 + Math.sin(v.t) * 4, bottom);
    for (let yy = top + s * 0.35; yy < bottom; yy += s * 0.35) { const k = (yy - top) / (bottom - top); ctx.moveTo(lx - s * 0.2 + Math.sin(v.t) * 4 * k, yy); ctx.lineTo(lx + s * 0.2 + Math.sin(v.t) * 4 * k, yy); }
    ctx.stroke();
  }
  // cola
  ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(x + w * 0.65, y + hh * 0.35); ctx.lineTo(x + w * 1.35, y + hh * 0.3); ctx.lineTo(x + w * 1.35, y + hh * 0.48); ctx.lineTo(x + w * 0.65, y + hh * 0.62); ctx.fill();
  ctx.save(); ctx.translate(x + w * 1.35, y + hh * 0.35); ctx.rotate(v.t * 30); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.1); ctx.restore();
  // cuerpo
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.ellipse(x + w * 0.4, y + hh * 0.5, w * 0.42, hh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.ellipse(x + w * 0.2, y + hh * 0.4, w * 0.18, hh * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(hh * 0.3)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RESCATE', x + w * 0.5, y + hh * 0.62);
  // patines
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + hh); ctx.lineTo(x + w * 0.75, y + hh); ctx.moveTo(x + w * 0.25, y + hh * 0.85); ctx.lineTo(x + w * 0.25, y + hh); ctx.moveTo(x + w * 0.6, y + hh * 0.85); ctx.lineTo(x + w * 0.6, y + hh); ctx.stroke();
  // rotor
  ctx.fillStyle = '#1f2937'; ctx.fillRect(x + w * 0.38, y - hh * 0.12, s * 0.12, hh * 0.15);
  const spin = Math.cos(v.t * 25);
  ctx.fillStyle = 'rgba(31,41,55,0.8)'; ctx.fillRect(x + w * 0.44 - w * 0.75 * Math.abs(spin), y - hh * 0.15, w * 1.5 * Math.abs(spin), s * 0.08);
  ctx.fillStyle = 'rgba(31,41,55,0.25)'; ctx.fillRect(x + w * 0.44 - w * 0.75, y - hh * 0.15, w * 1.5, s * 0.08);
  // flecha que avisa
  const pulse = 0.5 + 0.5 * Math.sin(v.t * 5);
  ctx.fillStyle = `rgba(253,224,71,${0.5 + pulse * 0.5})`; ctx.font = `900 ${Math.round(s * 0.5)}px Nunito, system-ui`;
  ctx.fillText('🚁 ¡ACÁ!', x + w * 0.45, y - hh * 0.6 - pulse * s * 0.2);
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
  drawRunner(ctx, { x: px, y: py, w: pw, h: ph, facing: p.facing, time: v.t, running: p.vx !== 0 && !!p.ground, airborne: !p.ground && !p.climb, climbing: !!p.climb, falling: !!g.dying, burnt });
  if (g.dying?.reason === 'zap' && Math.floor(v.t * 20) % 2) bolts(ctx, px + pw / 2, py + ph / 2, pw * 1.2, v.t, '#fde047');
  if (g.dying) for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,113,108,${0.5 - i * 0.12})`; ctx.beginPath(); ctx.arc(px + pw / 2 + Math.sin(v.t * 6 + i) * pw * 0.4, py - i * pw * 0.6, pw * (0.25 + i * 0.1), 0, Math.PI * 2); ctx.fill(); }
}

function draw(ctx: CanvasRenderingContext2D, g: LavaGame, v: View) {
  drawBackground(ctx, v, g);
  for (const b of g.buildings) drawBuilding(ctx, b, g, v);
  drawElevatorShaft(ctx, g, v);
  for (const e of g.escapes) drawEscape(ctx, e, g, v);
  for (const c of g.climbs) drawClimb(ctx, c, v);
  for (const p of g.plats) drawPlat(ctx, p, v, g.time);
  for (const f of g.fires) drawFire(ctx, f, v);
  for (const sp of g.sparks) drawSpark(ctx, sp, v);
  for (const person of g.people) if (person.burnAt === null) drawPerson(ctx, person, v);
  for (const h of g.helis) drawHeli(ctx, h, v);
  drawPlayer(ctx, g, v);
  drawLava(ctx, g, v);
  // La gente que alcanzó la lava se ve arder y quedar carbonizada (hasta que la lava la tapa del todo).
  for (const person of g.people) {
    if (person.burnAt === null || g.lava > person.y + 2.4) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, (person.y + 2.4 - g.lava) / 1.2));
    drawPerson(ctx, person, v);
  }
  ctx.globalAlpha = 1;
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

// Se ven unas 14 unidades de alto (un poco más de 4 pisos) y, en pantallas angostas, unas 12 de ancho.
function scaleFor(w: number, h: number) { return Math.min(h / 14, w / 12); }

export function LavaFloor() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<LavaGame>(newLava());
  const cam = useRef({ x: 0, y: 0 });
  const input = useRef<Input>({ left: false, right: false, jump: false, down: false });
  const recordRef = useRef<LavaRecord>(readLavaRecord());
  const brokeRef = useRef(false);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, m: 0, lava: 0, lavaM: 0 });
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
    return { w, h, s: scaleFor(w, h), cx: cam.current.x, cy: cam.current.y, t: g.time + (g.dying?.t ?? 0) };
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current, v = view();
    if (!canvas || !v) return;
    const dpr = window.devicePixelRatio || 1;
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
    gameRef.current = newLava();
    follow(-1);
    input.current = { left: false, right: false, jump: false, down: false };
    recordRef.current = readLavaRecord();
    brokeRef.current = false; startedRef.current = false;
    setHud({ tenths: 0, m: 0, lava: 0, lavaM: 0 });
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
        if (e.type === 'heli') setToast({ text: '¡Ahí están los helicópteros! 🚁', id: now });
        if (e.type === 'lose') setToast({ text: LOSE_TEXT[e.reason], id: now });
      }
      follow(dt);
      paint();
      const m = meters(g.bestGround);
      const prev = recordRef.current.height;
      if (!brokeRef.current && prev > 0 && m > prev && !g.dying) { brokeRef.current = true; setToast({ text: '¡Rompiste el récord!', id: now, big: true }); }
      const shown = { tenths: Math.floor(g.time * 10), m, lava: Math.max(0, meters(g.player.y - g.lava)), lavaM: meters(Math.max(0, g.lava)) };
      setHud(p => p.tenths === shown.tenths && p.m === shown.m && p.lava === shown.lava && p.lavaM === shown.lavaM ? p : shown);
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
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) {
        setStatus(s => s === 'playing' ? 'paused' : 'playing');
        return;
      }
      const key = keys[event.key];
      if (!key || statusRef.current !== 'playing') return;
      event.preventDefault();
      input.current[key] = true;
    };
    const up = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) input.current[key] = false; };
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
              <p>La lava sube y no para: subí lo más rápido que puedas para sobrevivir. Trepá por escaleras, muebles, sogas y ascensores, pasá de edificio en edificio por puertas y tablones y esquivá el fuego y los cortocircuitos. Tomá buenas decisiones: ¡los helicópteros te esperan arriba de la torre más alta!</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar (en escaleras y sogas, mantené para trepar) · <kbd>↓</kbd> bajar · <kbd>P</kbd> pausa</p>
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
              <p>Llegaste al helicóptero en <strong>{formatLavaTime(result.time)}</strong>, justo antes que la lava.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side lava-side" aria-label="Tiempo, altura y lava">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="lava-time">{formatLavaTime(hud.tenths / 10)}</strong></div>
        <div className="trepa-stat"><span>Altura</span><strong data-testid="lava-meters">{hud.m} m</strong></div>
        <div className="trepa-stat lava-stat"><span>La lava está a</span><strong data-testid="lava-distance">{hud.lava} m</strong></div>
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
      <button type="button" aria-label="Bajar" {...hold('down')}>▼</button>
      <button type="button" className="runner-jump" aria-label="Saltar" {...hold('jump')}>Saltar</button>
    </div>
  </section>;
}
