import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawRunner } from './runnerCharacter';
import {
  meters, newTsunami, PLAYER_H, PLAYER_W, step, takeEvents, WATER_Y, WAVE_DELAY,
  type Box, type Decor, type Dog, type Input, type Npc, type Pickup, type TsunamiGame, type Zone,
} from './tsunami';

const RECORD_KEY = 'escritorio-personal-juegos:tsunami-record';
export interface TsunamiRecord { meters: number; time: number | null } // lo más lejos que llegaste y el mejor tiempo hasta el cerro
export const readTsunamiRecord = (): TsunamiRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.meters === 'number' ? v : { meters: 0, time: null }; } catch { return { meters: 0, time: null }; }
};
const saveRecord = (value: TsunamiRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatTsunamiTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
const GOAL_M = meters(newTsunami().goalX);

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
interface View { w: number; h: number; s: number; cx: number; cy: number; t: number; dpr: number }
const X = (v: View, x: number) => (x - v.cx) * v.s;
const Y = (v: View, y: number) => v.h - (y - v.cy) * v.s;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const visible = (v: View, x1: number, x2: number) => X(v, x2) > -60 && X(v, x1) < v.w + 60;
const font = (weight: number, px: number) => `${weight} ${Math.max(8, Math.round(px))}px Nunito, system-ui`;

// ---------- Fondo: cielo de tormenta, cerros lejanos y lluvia ----------
function drawSky(ctx: CanvasRenderingContext2D, v: View, g: TsunamiGame) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.h);
  sky.addColorStop(0, '#111827'); sky.addColorStop(0.45, '#334155'); sky.addColorStop(1, '#94a3b8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, v.w, v.h);
  // Relámpago de vez en cuando.
  const flash = (v.t % 7.3) < 0.12 || ((v.t + 2.1) % 11.7) < 0.08;
  if (flash) { ctx.fillStyle = 'rgba(226,232,240,0.35)'; ctx.fillRect(0, 0, v.w, v.h); }
  // Nubes oscuras que pasan.
  for (let i = 0; i < 9; i++) {
    const r = v.w * (0.1 + hash(i) * 0.08), x = ((hash(i + 3) * v.w * 1.5 - v.cx * v.s * 0.05 + v.t * (6 + hash(i) * 8)) % (v.w * 1.5) + v.w * 1.5) % (v.w * 1.5) - v.w * 0.25;
    const y = v.h * (0.05 + hash(i + 7) * 0.25);
    const cl = ctx.createRadialGradient(x, y, 0, x, y, r);
    cl.addColorStop(0, 'rgba(15,23,42,0.55)'); cl.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = cl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Cerros y ciudad lejana (se mueven más despacio que la cámara).
  for (const [k, col, amp] of [[0.15, '#475569', 6], [0.3, '#3f4f63', 4]] as const) {
    const base = Y(v, 0) * (1 - k) + v.h * k * 0.6;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, v.h);
    for (let sx = 0; sx <= v.w + 20; sx += 20) {
      const wx = sx / (v.s * k) + v.cx * k;
      ctx.lineTo(sx, base - (Math.sin(wx * 0.05) * amp + Math.sin(wx * 0.013) * amp * 2 + amp * 2) * v.s * k);
    }
    ctx.lineTo(v.w, v.h); ctx.fill();
  }
  // El cerro del final, grande y verde, se ve desde lejos.
  const hx = X(v, g.hillX + 5) * 0.6 + v.w * 0.4 * (1 - Math.min(1, (g.hillX - g.player.x) / 300));
  ctx.fillStyle = '#365314'; ctx.beginPath(); ctx.moveTo(hx - v.w * 0.25, v.h); ctx.quadraticCurveTo(hx, v.h * 0.35, hx + v.w * 0.3, v.h); ctx.fill();
}

function drawRain(ctx: CanvasRenderingContext2D, v: View) {
  ctx.strokeStyle = 'rgba(203,213,225,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = (hash(i) * v.w + v.t * 90) % v.w, y = (hash(i + 40) * v.h + v.t * (500 + hash(i) * 200)) % v.h;
    ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 14);
  }
  ctx.stroke();
}

// ---------- Casas, palmeras, faroles y carteles (de fondo) ----------
function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, v: View) {
  if (!visible(v, d.x - 2, d.x + d.w + 2)) return;
  const s = v.s, x = X(v, d.x), base = Y(v, 0);
  if (d.kind === 'house') {
    const w = d.w * s, h = d.h * s, top = base - h;
    ctx.fillStyle = hsl(d.hue, 35, 62); ctx.fillRect(x, top, w, h);
    ctx.fillStyle = hsl(d.hue, 30, 35); ctx.beginPath(); ctx.moveTo(x - s * 0.3, top); ctx.lineTo(x + w / 2, top - s * 1.4); ctx.lineTo(x + w + s * 0.3, top); ctx.fill();
    const cols = Math.max(1, Math.floor(d.w / 1.6)), rows = Math.max(1, Math.floor((d.h - 1.6) / 1.8));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = x + ((c + 0.5) * w) / cols - s * 0.35, wy = top + s * 0.6 + r * s * 1.8;
      ctx.fillStyle = hash(d.id * 9 + r * 3 + c) < 0.3 ? '#fde68a' : '#1e3a5f'; ctx.fillRect(wx, wy, s * 0.7, s * 0.9);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(wx, wy + s * 0.42, s * 0.7, s * 0.06);
    }
    ctx.fillStyle = hsl(d.hue, 30, 30); ctx.fillRect(x + w / 2 - s * 0.4, base - s * 1.5, s * 0.8, s * 1.5); // puerta
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + w - s * 0.3, top, s * 0.3, h);
  } else if (d.kind === 'palm') {
    const sway = Math.sin(v.t * 2 + d.id) * s * 0.3, top = base - d.h * s;
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = s * 0.28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + s * 0.5, base - d.h * s * 0.5, x + sway, top); ctx.stroke();
    ctx.fillStyle = '#15803d';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(v.t * 3 + i) * 0.1;
      ctx.beginPath(); ctx.ellipse(x + sway + Math.cos(a) * s * 1.1, top + Math.sin(a) * s * 0.6 + s * 0.5, s * 1.2, s * 0.28, a, 0, Math.PI * 2); ctx.fill();
    }
  } else if (d.kind === 'lamp') {
    ctx.strokeStyle = '#334155'; ctx.lineWidth = s * 0.12;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - d.h * s); ctx.lineTo(x + s * 0.7, base - d.h * s); ctx.stroke();
    ctx.fillStyle = Math.floor(v.t * 3 + d.id) % 5 ? '#fde68a' : '#78716c'; ctx.beginPath(); ctx.arc(x + s * 0.7, base - d.h * s + s * 0.2, s * 0.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#334155'; ctx.fillRect(x + s * 0.3, base - d.h * s, s * 0.15, d.h * s);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(x - s * 0.6, base - d.h * s - s * 0.2, s * 3.2, s * 1.1);
    ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.32); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ZONA SEGURA →', x + s, base - d.h * s + s * 0.15); ctx.font = font(700, s * 0.26); ctx.fillText('subí al cerro', x + s, base - d.h * s + s * 0.55);
  }
}

// ---------- Piso: playa, vereda y calle; canales con agua y puentes ----------
function drawGround(ctx: CanvasRenderingContext2D, g: TsunamiGame, v: View) {
  const s = v.s, base = Y(v, 0);
  // Mar a la izquierda del todo.
  ctx.fillStyle = '#1e3a8a'; ctx.fillRect(X(v, -200), base + s * 0.1, (200 + 0) * s, v.h);
  for (const gr of g.grounds) {
    if (!visible(v, gr.x1, gr.x2)) continue;
    const x1 = X(v, gr.x1), x2 = X(v, Math.min(gr.x2, g.width));
    // arena hasta el fin de la playa, después vereda y calle
    const beachEnd = Math.min(x2, X(v, g.beachEnd));
    if (beachEnd > x1) { ctx.fillStyle = '#e7c98a'; ctx.fillRect(x1, base, beachEnd - x1, v.h - base); ctx.fillStyle = '#d6b36f'; for (let i = 0; i < 40; i++) { const px = x1 + hash(i + gr.x1) * (beachEnd - x1); ctx.fillRect(px, base + s * (0.2 + hash(i) * 1.5), 2, 2); } }
    const from = Math.max(x1, beachEnd);
    if (x2 > from) {
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(from, base, x2 - from, s * 0.25); // vereda
      ctx.fillStyle = '#6b7280'; for (let px = from - ((from + v.cx * s) % (s * 1.2)); px < x2; px += s * 1.2) ctx.fillRect(Math.max(from, px), base, 1.5, s * 0.25);
      ctx.fillStyle = '#374151'; ctx.fillRect(from, base + s * 0.25, x2 - from, v.h); // calle
      ctx.fillStyle = '#fde047'; for (let px = from - ((from + v.cx * s) % (s * 3)); px < x2; px += s * 3) if (px > from) ctx.fillRect(px, base + s * 0.9, s * 1.4, s * 0.12);
    }
  }
  // Canales: agua que se mueve y paredes de piedra.
  for (let i = 0; i + 1 < g.grounds.length; i++) {
    const a = g.grounds[i].x2, b = g.grounds[i + 1].x1;
    if (!visible(v, a, b)) continue;
    const x1 = X(v, a), x2 = X(v, b), wy = Y(v, WATER_Y);
    ctx.fillStyle = '#1f2937'; ctx.fillRect(x1, base, x2 - x1, wy - base);
    const water = ctx.createLinearGradient(0, wy, 0, wy + s * 3); water.addColorStop(0, '#38bdf8'); water.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = water; ctx.beginPath(); ctx.moveTo(x1, v.h);
    for (let px = x1; px <= x2; px += 4) ctx.lineTo(px, wy + Math.sin(px * 0.08 + v.t * 4) * s * 0.05);
    ctx.lineTo(x2, v.h); ctx.fill();
    ctx.fillStyle = '#78716c'; ctx.fillRect(x1 - s * 0.15, base, s * 0.15, v.h - base); ctx.fillRect(x2, base, s * 0.15, v.h - base);
  }
  for (const b of g.bridges) {
    if (!visible(v, b.x1, b.x2)) continue;
    const x1 = X(v, b.x1), x2 = X(v, b.x2);
    ctx.fillStyle = '#92400e'; ctx.fillRect(x1, base - s * 0.05, x2 - x1, s * 0.25);
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.beginPath();
    for (let px = x1; px < x2; px += s * 0.35) { ctx.moveTo(px, base - s * 0.05); ctx.lineTo(px, base + s * 0.2); }
    ctx.moveTo(x1, base - s * 0.8); ctx.lineTo(x2, base - s * 0.8); ctx.moveTo(x1, base - s * 0.8); ctx.lineTo(x1, base); ctx.moveTo(x2, base - s * 0.8); ctx.lineTo(x2, base); ctx.stroke();
  }
}

// ---------- Sombrillas y charcos ----------
function drawZone(ctx: CanvasRenderingContext2D, z: Zone, v: View) {
  if (!visible(v, z.x1, z.x2)) return;
  const s = v.s, base = Y(v, 0), cx = X(v, (z.x1 + z.x2) / 2), w = (z.x2 - z.x1) * s;
  if (z.kind === 'puddle') {
    ctx.fillStyle = 'rgba(56,189,248,0.6)'; ctx.beginPath(); ctx.ellipse(cx, base + s * 0.05, w / 2, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - w * 0.2, base, w * 0.15, 2);
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(cx + w / 2, base - s * 0.9); ctx.lineTo(cx + w / 2 + s * 0.35, base); ctx.lineTo(cx + w / 2 - s * 0.35, base); ctx.fill(); // cartel de piso mojado
    ctx.fillStyle = '#111827'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', cx + w / 2, base - s * 0.35);
    return;
  }
  // Sombrilla con toalla
  ctx.fillStyle = hsl(z.hue, 70, 55, 0.8); ctx.fillRect(cx - w * 0.5, base - s * 0.05, w * 0.7, s * 0.08);
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx + s * 0.15, base - s * 1.9); ctx.stroke();
  const tilt = Math.sin(v.t * 3 + z.id) * 0.08;
  ctx.save(); ctx.translate(cx + s * 0.15, base - s * 1.9); ctx.rotate(tilt);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : hsl(z.hue, 75, 50); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, s * 0.15, s * 1.15, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6); ctx.fill(); }
  ctx.restore();
}

// ---------- Obstáculos ----------
function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
}
function drawBox(ctx: CanvasRenderingContext2D, b: Box, v: View) {
  if (!visible(v, b.x, b.x + b.w)) return;
  const s = v.s, x = X(v, b.x), w = b.w * s, top = Y(v, b.y + b.h), h = b.h * s, bottom = top + h;
  const c = hsl(b.hue, 65, 48), dark = hsl(b.hue, 60, 32), glass = '#bae6fd';
  switch (b.kind) {
    case 'car':
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, top + h * 0.38, w, h * 0.45, s * 0.15); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w * 0.2, top + h * 0.4); ctx.lineTo(x + w * 0.32, top); ctx.lineTo(x + w * 0.72, top); ctx.lineTo(x + w * 0.85, top + h * 0.4); ctx.fill();
      ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(x + w * 0.27, top + h * 0.38); ctx.lineTo(x + w * 0.35, top + h * 0.08); ctx.lineTo(x + w * 0.5, top + h * 0.08); ctx.lineTo(x + w * 0.5, top + h * 0.38); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w * 0.54, top + h * 0.38); ctx.lineTo(x + w * 0.54, top + h * 0.08); ctx.lineTo(x + w * 0.69, top + h * 0.08); ctx.lineTo(x + w * 0.79, top + h * 0.38); ctx.fill();
      ctx.fillStyle = '#fde047'; ctx.fillRect(x + w - s * 0.15, top + h * 0.48, s * 0.12, s * 0.1);
      wheel(ctx, x + w * 0.22, bottom - s * 0.22, s * 0.24); wheel(ctx, x + w * 0.78, bottom - s * 0.22, s * 0.24);
      break;
    case 'van': case 'bus':
      ctx.fillStyle = b.kind === 'bus' ? '#f59e0b' : c; ctx.beginPath(); ctx.roundRect(x, top, w, h * 0.85, s * 0.2); ctx.fill();
      ctx.fillStyle = glass;
      for (let wx = x + s * 0.3; wx < x + w - s * 0.9; wx += s * 1.1) ctx.fillRect(wx, top + h * 0.12, s * 0.85, h * 0.32);
      ctx.fillRect(x + w - s * 0.75, top + h * 0.12, s * 0.55, h * 0.4);
      if (b.kind === 'bus') { ctx.fillStyle = '#1f2937'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ESCOLAR', x + w / 2, top + h * 0.62); }
      wheel(ctx, x + s * 0.8, bottom - s * 0.25, s * 0.27); wheel(ctx, x + w - s * 0.8, bottom - s * 0.25, s * 0.27);
      break;
    case 'kiosk':
      ctx.fillStyle = '#15803d'; ctx.fillRect(x, top + h * 0.2, w, h * 0.8);
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(x + w * 0.1, top + h * 0.35, w * 0.8, h * 0.3);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = hsl(i * 60, 60, 55); ctx.fillRect(x + w * (0.12 + i * 0.13), top + h * 0.4, w * 0.1, h * 0.2); }
      ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, top + h * 0.22); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w + s * 0.2, top + h * 0.22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DIARIOS', x + w / 2, top + h * 0.8);
      break;
    case 'wall':
      ctx.fillStyle = '#b45309'; ctx.fillRect(x, top, w, h);
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1; for (let yy = top + s * 0.2; yy < bottom; yy += s * 0.2) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      break;
    case 'bench':
      ctx.fillStyle = '#92400e'; ctx.fillRect(x, top, w, s * 0.12); ctx.fillRect(x, top - s * 0.4, w, s * 0.1);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x + s * 0.1, top, s * 0.08, h); ctx.fillRect(x + w - s * 0.18, top, s * 0.08, h);
      break;
    case 'bins':
      ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.roundRect(x, top + s * 0.1, w, h - s * 0.1, s * 0.08); ctx.fill();
      ctx.fillStyle = '#14532d'; ctx.fillRect(x - s * 0.05, top, w + s * 0.1, s * 0.14);
      ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♻', x + w / 2, top + h * 0.55);
      break;
    case 'crate':
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(x, top, w, h); ctx.strokeStyle = '#854d0e'; ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.strokeRect(x + 1, top + 1, w - 2, h - 2); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, bottom); ctx.moveTo(x + w, top); ctx.lineTo(x, bottom); ctx.stroke();
      break;
    case 'castle':
      ctx.fillStyle = '#d6b36f'; ctx.fillRect(x, top + h * 0.3, w, h * 0.7);
      for (let i = 0; i < 3; i++) ctx.fillRect(x + (i * w) / 3 + w * 0.05, top, w * 0.22, h * 0.4);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(x + w / 2, top - s * 0.4); ctx.lineTo(x + w / 2 + s * 0.25, top - s * 0.3); ctx.lineTo(x + w / 2, top - s * 0.2); ctx.fill();
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w / 2, top); ctx.lineTo(x + w / 2, top - s * 0.4); ctx.stroke();
      break;
    case 'boat':
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(x, top + h * 0.3); ctx.lineTo(x + w, top + h * 0.3); ctx.lineTo(x + w * 0.85, bottom); ctx.lineTo(x + w * 0.15, bottom); ctx.fill();
      ctx.fillStyle = '#2563eb'; ctx.fillRect(x + w * 0.08, top + h * 0.45, w * 0.84, h * 0.12);
      ctx.fillStyle = dark; ctx.fillRect(x + w * 0.45, top - s * 1.2, s * 0.08, s * 1.5);
      ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.moveTo(x + w * 0.45 + s * 0.08, top - s * 1.2); ctx.lineTo(x + w * 0.85, top + h * 0.2); ctx.lineTo(x + w * 0.45 + s * 0.08, top + h * 0.2); ctx.fill();
      break;
    case 'step':
      ctx.fillStyle = '#4d7c0f'; ctx.fillRect(x, top, w, Y(v, 0) - top);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(x, top, s * 0.9, s * 0.14);
      ctx.fillStyle = '#65a30d'; ctx.fillRect(x, top + s * 0.14, s * 0.9, s * 0.08);
      break;
  }
}

// ---------- Ayudas, perros y gente ----------
function drawPickup(ctx: CanvasRenderingContext2D, k: Pickup, v: View) {
  if (k.taken || !visible(v, k.x - 1, k.x + 1)) return;
  const s = v.s, bob = Math.sin(v.t * 4 + k.id) * s * 0.1, cx = X(v, k.x), base = Y(v, k.y) - s * 0.2 + bob;
  const glow = ctx.createRadialGradient(cx, base - s * 0.5, 0, cx, base - s * 0.5, s * 1.4);
  glow.addColorStop(0, 'rgba(253,224,71,0.55)'); glow.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - s * 1.4, base - s * 1.9, s * 2.8, s * 2.8);
  if (k.kind === 'moto') drawMoto(ctx, cx, base, s, 1);
  else drawBoard(ctx, cx, base - s * 0.5, s, true);
  ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = '#111827';
  const label = k.kind === 'moto' ? '¡MOTO!' : '¡TABLA!';
  ctx.strokeText(label, cx, base - s * 1.5); ctx.fillText(label, cx, base - s * 1.5);
}
function drawMoto(ctx: CanvasRenderingContext2D, cx: number, base: number, s: number, dir: 1 | -1) {
  wheel(ctx, cx - dir * s * 0.55, base - s * 0.25, s * 0.25); wheel(ctx, cx + dir * s * 0.55, base - s * 0.25, s * 0.25);
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(cx - dir * s * 0.6, base - s * 0.45); ctx.lineTo(cx + dir * s * 0.35, base - s * 0.45); ctx.lineTo(cx + dir * s * 0.55, base - s * 0.75); ctx.lineTo(cx - dir * s * 0.2, base - s * 0.62); ctx.fill();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.beginPath(); ctx.moveTo(cx + dir * s * 0.55, base - s * 0.25); ctx.lineTo(cx + dir * s * 0.45, base - s * 0.95); ctx.lineTo(cx + dir * s * 0.25, base - s * 0.95); ctx.stroke();
}
function drawBoard(ctx: CanvasRenderingContext2D, cx: number, y: number, s: number, upright: boolean) {
  ctx.save(); ctx.translate(cx, y); if (upright) ctx.rotate(-1.2);
  ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.7, -s * 0.025, s * 1.4, s * 0.05);
  ctx.restore();
}
function drawDog(ctx: CanvasRenderingContext2D, d: Dog, v: View) {
  if (!visible(v, d.x - 1, d.x + 1)) return;
  const s = v.s, cx = X(v, d.x), base = Y(v, 0), f = d.dir, legs = Math.sin(v.t * 18 + d.id) * s * 0.12;
  const fur = hsl(25 + d.hue, 45, 35);
  ctx.strokeStyle = fur; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - s * 0.3, base - s * 0.35); ctx.lineTo(cx - s * 0.3 + legs, base); ctx.moveTo(cx + s * 0.25, base - s * 0.35); ctx.lineTo(cx + s * 0.25 - legs, base); ctx.stroke();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(cx, base - s * 0.45, s * 0.42, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + f * s * 0.45, base - s * 0.62, s * 0.18, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - f * s * 0.4, base - s * 0.5); ctx.lineTo(cx - f * s * 0.62, base - s * 0.75 + Math.sin(v.t * 20) * s * 0.06); ctx.stroke(); // cola
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(cx + f * s * 0.62, base - s * 0.62, s * 0.04, 0, Math.PI * 2); ctx.fill();
  if (v.t - d.bark < 1 && Math.floor(v.t * 5) % 2) { ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#111827'; ctx.strokeText('¡GUAU!', cx, base - s * 1.1); ctx.fillText('¡GUAU!', cx, base - s * 1.1); }
}
function drawNpc(ctx: CanvasRenderingContext2D, n: Npc, v: View, t: number) {
  if (!visible(v, n.x - 1, n.x + 1)) return;
  const s = v.s, h = s * 0.8, w = h * 0.4, px = X(v, n.x);
  const swept = n.sweptAt !== null, age = swept ? t - n.sweptAt! : 0;
  const base = swept ? Y(v, 1 + age * 1.6 + Math.sin(age * 3) * 0.5) : Y(v, 0);
  ctx.save(); ctx.translate(px, base); if (swept) ctx.rotate(age * 4);
  const swing = Math.sin(t * 16 + n.id) * 0.6;
  ctx.lineCap = 'round'; ctx.strokeStyle = hsl((n.hue + 200) % 360, 35, 30); ctx.lineWidth = w * 0.35;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.45); ctx.lineTo(-w * 0.45 * swing, 0); ctx.moveTo(0, -h * 0.45); ctx.lineTo(w * 0.45 * swing, 0); ctx.stroke();
  ctx.fillStyle = hsl(n.hue, 65, 50); ctx.beginPath(); ctx.roundRect(-w / 2, -h * 0.8, w, h * 0.4, w * 0.2); ctx.fill();
  const skin = ['#fcd9b6', '#e0ac69', '#8d5524', '#f1c27d'][Math.floor(n.look * 4)];
  ctx.strokeStyle = skin; ctx.lineWidth = w * 0.22; // brazos arriba, desesperada
  ctx.beginPath(); ctx.moveTo(0, -h * 0.75); ctx.lineTo(w * 0.5, -h * 1.15 + swing * h * 0.08); ctx.moveTo(0, -h * 0.75); ctx.lineTo(-w * 0.5, -h * 1.15 - swing * h * 0.08); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -h * 0.9, w * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- La ola gigante ----------
const WAVE_H = 8.5;
function drawWave(ctx: CanvasRenderingContext2D, g: TsunamiGame, v: View) {
  const s = v.s, t = v.t;
  if (X(v, g.wave) < -s * 4) return;
  // Puntos de la ola en unidades, relativos al frente (dx) y al piso (dy).
  const P = (dx: number, dy: number): [number, number] => [X(v, g.wave + dx), Y(v, dy)];
  const line = (pts: [number, number][]) => pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  const curve = (c: [number, number], e: [number, number]) => ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  // Cuerpo: el lomo de la ola atrás, la cresta que se adelanta y se enrosca, y la cara cóncava hasta el piso.
  const body = ctx.createLinearGradient(X(v, g.wave - 14), 0, X(v, g.wave + 1.5), 0);
  body.addColorStop(0, '#0b2545'); body.addColorStop(0.65, '#13507a'); body.addColorStop(1, '#2aa3b5');
  ctx.fillStyle = body;
  ctx.beginPath();
  line([[-20, v.h], [-20, Y(v, WAVE_H - 1.2)]]);
  for (let dx = -40; dx < -4; dx += 1) { const [x, y] = P(dx, WAVE_H - 1.2 + Math.sin(dx * 0.6 + t * 2) * 0.25); if (x > -20) ctx.lineTo(x, y); }
  curve(P(-2, WAVE_H + 0.4), P(1.8, WAVE_H - 0.4)); // la cresta
  curve(P(2.6, WAVE_H - 1.4), P(1.6, WAVE_H - 2.1)); // el rulo que cae
  curve(P(0.9, WAVE_H - 1.9), P(0.6, WAVE_H - 1.3)); // adentro del rulo
  curve(P(-0.6, WAVE_H - 3.5), P(0.2, 2.2)); // la cara de la ola
  curve(P(0.6, 0.6), P(1.6, -0.2));
  ctx.lineTo(X(v, g.wave + 1.6), v.h); ctx.closePath(); ctx.fill();
  // Brillo de la cara y el tubo oscuro debajo del rulo.
  const face = ctx.createLinearGradient(X(v, g.wave - 1.5), 0, X(v, g.wave + 0.8), 0);
  face.addColorStop(0, 'rgba(94,234,212,0)'); face.addColorStop(1, 'rgba(94,234,212,0.35)');
  ctx.fillStyle = face; ctx.beginPath(); ctx.moveTo(...P(0.6, WAVE_H - 1.3)); curve(P(-0.6, WAVE_H - 3.5), P(0.2, 2.2)); curve(P(0.6, 0.6), P(1.6, -0.2)); ctx.lineTo(...P(-1.5, -0.2)); ctx.lineTo(...P(-1.5, WAVE_H - 1.3)); ctx.fill();
  ctx.fillStyle = 'rgba(3,15,35,0.6)'; ctx.beginPath(); ctx.ellipse(...P(0.9, WAVE_H - 2), s * 0.55, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // Espuma: a lo largo de la cresta, en el rulo y en la base, y gotas que salen volando.
  ctx.fillStyle = '#f0f9ff';
  for (let i = 0; i < 24; i++) {
    const k = i / 23, dx = -7 + k * 9, dy = k < 0.75 ? WAVE_H - 1.2 + (k / 0.75) * 1.4 : WAVE_H + 0.2 - (k - 0.75) * 4;
    ctx.beginPath(); ctx.arc(...P(dx, dy + Math.sin(t * 6 + i) * 0.12), s * (0.18 + hash(i) * 0.22), 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(...P(2.1 - i * 0.15, WAVE_H - 0.8 - i * 0.25), s * 0.22, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(...P(-1 + i * 0.22 + Math.sin(t * 5 + i) * 0.15, 0.15 + Math.abs(Math.sin(t * 7 + i)) * 0.25), s * (0.2 + hash(i + 9) * 0.25), 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 26; i++) {
    const life = (t * (0.8 + hash(i) * 0.6) + hash(i + 50)) % 1;
    ctx.fillStyle = `rgba(240,249,255,${0.85 * (1 - life)})`;
    ctx.beginPath(); ctx.arc(...P(1.8 + life * 2.5 * hash(i + 3), WAVE_H - 0.5 + life * 1.2 - life * life * 3), s * 0.06 + hash(i) * 2, 0, Math.PI * 2); ctx.fill();
  }
  // Cosas que arrastra: un auto, una palmera y una sombrilla dando vueltas adentro de la ola.
  for (const [dx, dy, k] of [[-3.5, 5.2, 0], [-7, 3.6, 1], [-1.8, 3, 2]] as const) {
    const [jx, jy] = P(dx, dy + Math.sin(t * 1.5 + k) * 0.5);
    if (jx < -s * 2) continue;
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(t * (1 + k * 0.4) + k); ctx.globalAlpha = 0.85;
    if (k === 0) { ctx.fillStyle = '#dc2626'; ctx.fillRect(-s * 1.2, -s * 0.35, s * 2.4, s * 0.7); wheel(ctx, -s * 0.7, s * 0.4, s * 0.22); wheel(ctx, s * 0.7, s * 0.4, s * 0.22); }
    else if (k === 1) { ctx.strokeStyle = '#78350f'; ctx.lineWidth = s * 0.22; ctx.beginPath(); ctx.moveTo(-s * 1.8, 0); ctx.lineTo(s * 1.8, 0); ctx.stroke(); ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.ellipse(s * 1.9, 0, s * 0.9, s * 0.3, 0.4, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(0, 0, s * 0.8, Math.PI, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.2); ctx.stroke(); }
    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: TsunamiGame, v: View) {
  const p = g.player, s = v.s;
  const pw = PLAYER_W * s, ph = PLAYER_H * s;
  let px = X(v, p.x) - pw / 2, py = Y(v, p.y) - ph;
  if (p.ride === 'moto') { drawMoto(ctx, X(v, p.x), Y(v, p.y), s, p.facing); py -= s * 0.45; }
  if (p.ride === 'tabla') drawBoard(ctx, X(v, p.x), Y(v, p.y) + s * 0.05, s, false);
  if (g.dying) { ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(g.dying.t * 6); px = -pw / 2; py = -ph / 2; }
  drawRunner(ctx, { x: px, y: py, w: pw, h: ph, facing: p.facing, time: v.t, running: Math.abs(p.vx) > 0.5 && (p.ground || p.swimming) && !p.ride, airborne: !p.ground && !p.swimming, climbing: p.swimming, falling: !!g.dying });
  if (g.dying) ctx.restore();
  if (p.swimming && p.ride !== 'tabla') { // el agua tapa del pecho para abajo
    const wy = Y(v, WATER_Y);
    ctx.fillStyle = 'rgba(56,189,248,0.75)'; ctx.fillRect(X(v, p.x) - pw, wy, pw * 2, Y(v, p.y) - wy + 2);
    ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(X(v, p.x), wy, pw * 0.9, s * 0.08, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.hit && Math.floor(v.t * 12) % 2) { ctx.fillStyle = '#fde047'; ctx.font = font(900, s * 0.35); ctx.textAlign = 'center'; ctx.fillText('¡AY!', X(v, p.x), py - s * 0.3); }
}

function draw(ctx: CanvasRenderingContext2D, g: TsunamiGame, v: View) {
  drawSky(ctx, v, g);
  for (const d of g.decor) if (d.kind === 'house') drawDecor(ctx, d, v);
  for (const d of g.decor) if (d.kind !== 'house') drawDecor(ctx, d, v);
  drawGround(ctx, g, v);
  for (const z of g.zones) drawZone(ctx, z, v);
  for (const b of g.boxes) drawBox(ctx, b, v);
  // Arriba del cerro: bandera y gente esperando.
  const gx = X(v, g.goalX), gy = Y(v, g.hillTop);
  if (gx < v.w + 80) {
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx + v.s, gy); ctx.lineTo(gx + v.s, gy - v.s * 3); ctx.stroke();
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.moveTo(gx + v.s, gy - v.s * 3); ctx.lineTo(gx + v.s * 2.6 + Math.sin(v.t * 5) * v.s * 0.1, gy - v.s * 2.6); ctx.lineTo(gx + v.s, gy - v.s * 2.2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font(900, v.s * 0.38); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#14532d';
    ctx.strokeText('ZONA SEGURA', gx + v.s * 3, gy - v.s * 3.6); ctx.fillText('ZONA SEGURA', gx + v.s * 3, gy - v.s * 3.6);
    for (let i = 0; i < 4; i++) drawNpc(ctx, { id: 900 + i, x: g.goalX + 2.5 + i * 0.9, speed: 0, hue: i * 80, look: i / 4, sweptAt: null }, { ...v, cy: v.cy - g.hillTop }, v.t * 0.3);
  }
  for (const k of g.pickups) drawPickup(ctx, k, v);
  for (const d of g.dogs) drawDog(ctx, d, v);
  for (const n of g.npcs) if (n.sweptAt === null) drawNpc(ctx, n, v, v.t);
  drawPlayer(ctx, g, v);
  drawWave(ctx, g, v);
  for (const n of g.npcs) if (n.sweptAt !== null && g.time - n.sweptAt < 4) drawNpc(ctx, n, v, v.t);
  drawRain(ctx, v);
  // Si la ola está muy cerca, el borde de la pantalla se pone azul oscuro.
  const near = g.player.x - g.wave;
  if (!g.dying && near < 12) {
    const a = (1 - near / 12) * (0.45 + 0.25 * Math.sin(v.t * 9));
    const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
    vg.addColorStop(0, 'rgba(8,47,73,0)'); vg.addColorStop(1, `rgba(8,47,73,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  }
}

// Se ven unas 11 unidades de alto y, en pantallas angostas, unas 15 de ancho (para ver qué viene adelante).
// En pantallas paradas (celular o tablet vertical) se acerca un poco la cámara para que el personaje no quede chiquito.
function scaleFor(w: number, h: number) { return Math.min(h / 11, w / (h > w ? 10 : 15)); }
const NO_INPUT: Input = { left: false, right: false, jump: false };

export function Tsunami() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TsunamiGame>(newTsunami());
  const cam = useRef({ x: 0, y: 0 });
  const input = useRef<Input>({ ...NO_INPUT });
  const recordRef = useRef<TsunamiRecord>(readTsunamiRecord());
  const brokeRef = useRef(false);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, m: 0, goal: GOAL_M, wave: 0, ride: '' });
  const [record, setRecord] = useState(readTsunamiRecord);
  const [result, setResult] = useState({ m: 0, time: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const view = useCallback((): View | null => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return null;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return null;
    return { w, h, s: scaleFor(w, h), cx: cam.current.x, cy: cam.current.y, t: g.time + (g.dying?.t ?? 0), dpr: Math.min(2, window.devicePixelRatio || 1) };
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current, v = view();
    if (!canvas || !v) return;
    if (canvas.width !== Math.round(v.w * v.dpr) || canvas.height !== Math.round(v.h * v.dpr)) {
      canvas.width = Math.round(v.w * v.dpr); canvas.height = Math.round(v.h * v.dpr);
      canvas.style.width = `${v.w}px`; canvas.style.height = `${v.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    draw(ctx, gameRef.current, v);
  }, [view]);

  // La cámara sigue al personaje, dejando más lugar adelante (a la derecha), que es adonde hay que ir.
  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const s = scaleFor(stage.clientWidth, stage.clientHeight);
    const vw = stage.clientWidth / s, vh = stage.clientHeight / s;
    const tx = Math.max(-6, Math.min(g.width - vw, g.player.x - vw * 0.38));
    const ty = -vh * 0.12 + Math.max(0, g.player.y - vh * 0.35);
    const k = dt < 0 ? 1 : Math.min(1, dt * 6);
    cam.current.x += (tx - cam.current.x) * k;
    cam.current.y += (ty - cam.current.y) * k;
  }, []);

  const start = useCallback(() => {
    gameRef.current = newTsunami();
    follow(-1);
    input.current = { ...NO_INPUT };
    recordRef.current = readTsunamiRecord();
    brokeRef.current = false; startedRef.current = false;
    setHud({ tenths: 0, m: 0, goal: GOAL_M, wave: 0, ride: '' });
    setToast({ text: `¡Se viene el tsunami! Corré en ${WAVE_DELAY} segundos 🌊`, id: Date.now() });
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
      if (!startedRef.current && g.time >= WAVE_DELAY) { startedRef.current = true; setToast({ text: '¡Ahí viene la ola! ¡Corré hacia el cerro! 🌊', id: now }); }
      for (const e of takeEvents(g)) {
        if (e.type === 'faster') setToast({ text: '¡La ola viene cada vez más rápido! 🌊', id: now });
        if (e.type === 'ride') setToast({ text: e.kind === 'moto' ? '¡Moto! Vas volando unos segundos 🏍️' : '¡Tabla de surf! Más rápido y los canales no te frenan 🏄', id: now });
        if (e.type === 'dog') setToast({ text: '¡Te alcanzó un perro! Saltalos 🐕', id: now });
        if (e.type === 'splash') setToast({ text: '¡Al agua! Nadá hasta el borde y saltá 🏊', id: now });
        if (e.type === 'hill') setToast({ text: '¡Ya se ve el cerro! ¡Subí! ⛰️', id: now });
        if (e.type === 'lose') setToast({ text: '¡Te alcanzó la ola!', id: now });
      }
      follow(dt);
      paint();
      const m = meters(g.best), prev = recordRef.current.meters;
      if (!brokeRef.current && prev > 0 && m > prev && !g.dying) { brokeRef.current = true; setToast({ text: '¡Rompiste el récord!', id: now, big: true }); }
      const p = g.player;
      const shown = { tenths: Math.floor(g.time * 10), m, goal: Math.max(0, meters(g.goalX - p.x)), wave: Math.max(0, meters(p.x - g.wave)), ride: p.ride ? `${p.ride === 'moto' ? '🏍️' : '🏄'} ${Math.ceil(p.rideLeft)} s` : '' };
      setHud(h => h.tenths === shown.tenths && h.m === shown.m && h.goal === shown.goal && h.wave === shown.wave && h.ride === shown.ride ? h : shown);
      if (g.over || g.won) {
        const rec = readTsunamiRecord();
        const reached = g.won ? GOAL_M : m;
        const next: TsunamiRecord = { meters: Math.max(rec.meters, reached), time: g.won ? Math.min(rec.time ?? Infinity, g.time) : rec.time };
        const isNew = next.meters > rec.meters || (g.won && (rec.time === null || g.time < rec.time));
        saveRecord(next); setRecord(next);
        setResult({ m: reached, time: g.time, newRecord: isNew && (rec.meters > 0 || g.won) });
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
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump' };
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
  const pct = (m: number) => `${Math.max(0, Math.min(100, (m / GOAL_M) * 100))}%`;
  const waveM = Math.max(0, hud.m - hud.wave);

  return <section className="runner trepa tsu" aria-label="¡Se viene el tsunami!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡Se viene el tsunami!</h1>
      <div className="runner-scores"><span>Récord <strong>{record.time !== null ? `⛰️ ${formatTsunamiTime(record.time)}` : `${record.meters} m`}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label="Costa con una ola gigante acercándose" />
        {status === 'playing' && toast && <div key={toast.id} className={toast.big ? 'trepa-record' : 'trepa-toast tsu-toast'} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="tsu-message">
          <div>
            {status === 'ready' && <>
              <h2 id="tsu-message" className="tsu-title">¡Se viene el tsunami! 🌊</h2>
              <p>Una ola gigante avanza desde el mar y cada vez viene más rápido. Corré por la costa hasta el cerro del final: saltá autos, quioscos y bancos (o subite arriba), cruzá los canales por los puentes o saltando, cuidado con los charcos que resbalan y saltá los perros que te persiguen. Si encontrás una moto o una tabla de surf, ¡aprovechala!</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> correr · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="tsu-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="tsu-message" className="trepa-gameover">GAME OVER</h2>
              <p>¡Te alcanzó la ola! Llegaste a <strong>{result.m} m</strong> en {formatTsunamiTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <h2 id="tsu-message" className="trepa-win">¡Te salvaste! ⛰️</h2>
              <p>Llegaste al cerro en <strong>{formatTsunamiTime(result.time)}</strong>, justo antes que la ola.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side tsu-side" aria-label="Tiempo, distancia y ola">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="tsu-time">{formatTsunamiTime(hud.tenths / 10)}</strong></div>
        <div className="trepa-stat"><span>Cerro a</span><strong data-testid="tsu-goal">{hud.goal} m</strong></div>
        <div className="trepa-stat tsu-wave"><span>La ola está a</span><strong data-testid="tsu-wave">{hud.wave} m</strong></div>
        {hud.ride && <div className="trepa-stat tsu-ride"><span>Ayuda</span><strong>{hud.ride}</strong></div>}
        <div className="trepa-meter" aria-hidden="true">
          <div className="trepa-meter-track tsu-meter-track">
            <div className="tsu-meter-wave" style={{ height: pct(waveM) }} />
            <div className="trepa-meter-fill" style={{ height: pct(hud.m) }} />
            {record.meters > 0 && <span className="trepa-meter-record" style={{ bottom: pct(record.meters) }} title="Récord" />}
          </div>
          <div className="trepa-meter-marks"><span style={{ bottom: '100%' }}>⛰️ Cerro<small>{GOAL_M} m</small></span><span style={{ bottom: pct(waveM) }}>🌊 Ola<small>{waveM} m</small></span></div>
        </div>
      </aside>
    </div>
    <div className="runner-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
      <button type="button" className="runner-jump" aria-label="Saltar" {...hold('jump')}>Saltar</button>
    </div>
  </section>;
}
