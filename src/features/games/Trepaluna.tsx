import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawRunner } from './runnerCharacter';
import {
  ballPos, birdPos, blinkOn, fireActive, fireWarning, laserActive, laserHalf, laserWarning, meters, moonOf, newTrepa, PLAYER_H, PLAYER_W, step, takeEvents, WORLD_W, ZONES,
  type Ball, type Bird, type Climb, type Facade, type Fan, type Fire, type Gear, type Laser, type Magnet, type Portal, type Input, type LoseReason, type Plat, type Trepa, type Zone,
} from './trepaluna';

// ---------- Récord ----------
const RECORD_KEY = 'escritorio-personal-juegos:trepaluna-record-v2';
export interface TrepaRecord { height: number; time: number | null }
export const readTrepaRecord = (): TrepaRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.height === 'number' ? v : { height: 0, time: null }; } catch { return { height: 0, time: null }; }
};
const saveRecord = (value: TrepaRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento: el récord dura esta partida */ } };
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
const MOON_M = meters(moonOf(newTrepa()).y); // el recorrido es siempre el mismo
const fmtM = (m: number) => m.toLocaleString('es-AR');

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
interface View { w: number; h: number; s: number; ox: number; cam: number; t: number }
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.h - (y - v.cam) * v.s;

// ---------- Texturas (se dibujan una sola vez y se usan como patrón) ----------
type Tex = 'brick' | 'concrete' | 'wood' | 'metal' | 'checker' | 'wicker' | 'asphalt' | 'stone';
const textures: Partial<Record<Tex, HTMLCanvasElement>> = {};
function texture(kind: Tex) {
  if (textures[kind]) return textures[kind]!;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d')!;
  let seed = kind.length * 97;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = (base: string, spots: string, n: number, size = 2) => { x.fillStyle = base; x.fillRect(0, 0, 32, 32); x.fillStyle = spots; for (let i = 0; i < n; i++) x.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), size, size); };
  if (kind === 'brick') {
    x.fillStyle = '#d6cfc4'; x.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 2; col++) {
      x.fillStyle = ['#b4532a', '#a8481f', '#c2602f', '#9c4220'][(row + col + 4) % 4];
      x.fillRect(col * 16 + (row % 2 ? 8 : 0) + 1, row * 8 + 1, 14, 6);
    }
  } else if (kind === 'concrete') noise('#9aa0a6', '#868c92', 60);
  else if (kind === 'stone') { noise('#8b8f99', '#757a85', 40, 3); x.strokeStyle = '#6b7080'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 15, 15); x.strokeRect(16.5, 16.5, 15, 15); }
  else if (kind === 'asphalt') noise('#3f4249', '#4b4f57', 90, 1);
  else if (kind === 'wood') {
    for (let i = 0; i < 4; i++) { x.fillStyle = ['#a8693a', '#b97a45', '#9c5f33', '#b2733f'][i]; x.fillRect(0, i * 8, 32, 8); x.fillStyle = '#7a4524'; x.fillRect(0, i * 8 + 7, 32, 1); x.fillRect((i * 13) % 32, i * 8, 1, 7); }
  } else if (kind === 'metal') {
    x.fillStyle = '#8d96a3'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = '#b5bec9';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.save(); x.translate(i * 8 + 4, j * 8 + 4); x.rotate(((i + j) % 2 ? 1 : -1) * 0.7); x.fillRect(-3, -1, 6, 2); x.restore(); }
  } else if (kind === 'checker') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#f8fafc' : '#1e293b'; x.fillRect(i * 8, j * 8, 8, 8); } }
  else if (kind === 'wicker') { x.fillStyle = '#b8863b'; x.fillRect(0, 0, 32, 32); x.strokeStyle = '#8a5d22'; x.lineWidth = 2; for (let i = -32; i < 32; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 32); x.stroke(); x.beginPath(); x.moveTo(i + 32, 0); x.lineTo(i, 32); x.stroke(); } }
  textures[kind] = c;
  return c;
}
function fillTex(ctx: CanvasRenderingContext2D, kind: Tex, x: number, y: number, w: number, h: number, v: View, tint?: string) {
  const pattern = ctx.createPattern(texture(kind), 'repeat');
  if (!pattern) return;
  const k = Math.max(0.5, v.s / 40);
  pattern.setTransform(new DOMMatrix().translate(v.ox, Y(v, 0) % (32 * k)).scale(k));
  ctx.fillStyle = pattern; ctx.fillRect(x, y, w, h);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); }
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- Fondo ----------
const SKY: [number, [number, number, number]][] = [[0, [168, 216, 255]], [90, [110, 190, 250]], [250, [80, 160, 240]], [305, [40, 36, 110]], [400, [22, 16, 62]], [470, [8, 8, 30]], [800, [3, 4, 14]]];
function skyAt(y: number) {
  let i = 0;
  while (i < SKY.length - 2 && y > SKY[i + 1][0]) i++;
  const [y0, a] = SKY[i], [y1, b] = SKY[i + 1];
  const k = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
  return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * k)).join(',')})`;
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, w * 0.17, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.2, y - w * 0.08, w * 0.2, w * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.1, y - w * 0.15, w * 0.25, w * 0.21, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.32, y - w * 0.05, w * 0.15, w * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground(ctx: CanvasRenderingContext2D, v: View) {
  const top = v.cam + v.h / v.s, mid = v.cam + v.h / v.s / 2;
  const bg = ctx.createLinearGradient(0, 0, 0, v.h);
  bg.addColorStop(0, skyAt(top)); bg.addColorStop(1, skyAt(v.cam));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, v.w, v.h);

  // Estrellas y planetas en el espacio.
  const stars = Math.max(0, Math.min(1, (mid - ZONES.tech + 5) / 40));
  if (stars > 0) {
    for (let i = 0; i < 160; i++) {
      const sx = hash(i) * v.w, sy = ((hash(i + 500) * v.h * 2 + v.cam * v.s * 0.1) % (v.h * 2)) - v.h * 0.5;
      if (sy < 0 || sy > v.h) continue;
      ctx.globalAlpha = stars * (0.45 + 0.55 * Math.abs(Math.sin(v.t * 1.5 + i)));
      ctx.fillStyle = i % 9 ? '#fff' : '#fde68a';
      const size = 1 + hash(i + 900) * 1.8; ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, (mid - ZONES.space + 5) / 25)); // los planetas, recién en el espacio
    const py = v.h * 0.3 + (v.cam - ZONES.space - 40) * v.s * 0.08;
    // Planeta con anillos y un planeta rojo chiquito.
    const pr = Math.min(v.w, v.h) * 0.09, px = v.w * 0.8;
    ctx.fillStyle = '#e9b872'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c98b45'; ctx.fillRect(px - pr, py - pr * 0.25, pr * 2, pr * 0.18);
    ctx.strokeStyle = '#f5deb3cc'; ctx.lineWidth = Math.max(2, pr * 0.12); ctx.beginPath(); ctx.ellipse(px, py, pr * 1.8, pr * 0.45, -0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(v.w * 0.16, py + v.h * 0.35, pr * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Zona tecnológica: torres de fondo con anillos de neón y una grilla que brilla.
  const tech = Math.max(0, Math.min(1, (mid - ZONES.tech + 10) / 15)) * Math.max(0, Math.min(1, (ZONES.space + 15 - mid) / 15));
  if (tech > 0) {
    ctx.globalAlpha = tech * 0.9;
    const base = v.h + 20; // las torres acompañan durante toda la zona (se mueven la grilla y las luces)
    for (let i = 0; i < 9; i++) {
      const tx = hash(i + 50) * v.w, tw = 30 + hash(i + 60) * 50, th = v.h * (0.5 + hash(i + 70) * 0.9);
      const ty = base - th;
      ctx.fillStyle = '#1b1747'; ctx.fillRect(tx, ty, tw, th + v.h);
      ctx.fillStyle = '#2a2470'; ctx.fillRect(tx + tw * 0.15, ty, tw * 0.2, th + v.h);
      const hue = [190, 290, 320][i % 3];
      for (let k = 0; k < 3; k++) {
        const ry = ty + th * (0.15 + k * 0.3);
        ctx.strokeStyle = hsl(hue, 100, 60, 0.85); ctx.lineWidth = 3; ctx.shadowColor = hsl(hue, 100, 60); ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.ellipse(tx + tw / 2, ry, tw * 0.9, tw * 0.22, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.fillStyle = hsl(hue, 100, 70, 0.8);
      for (let wy = ty + 10, r = 0; wy < Math.min(v.h, ty + th + v.h); wy += 16, r++) if (hash(i * 31 + r * 7) > 0.6) ctx.fillRect(tx + tw * 0.55, wy, tw * 0.25, 4);
    }
    ctx.strokeStyle = '#7c3aed33'; ctx.lineWidth = 1;
    const step = Math.max(24, v.s * 1.6), off = (v.cam * v.s * 0.5) % step;
    for (let gy = v.h - off; gy > v.h * 0.55; gy -= step) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(v.w, gy); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // El sol, a partir de que se terminan los edificios.
  const sun = Math.max(0, Math.min(1, (mid - 85) / 20)) * Math.max(0, Math.min(1, (ZONES.tech - mid) / 20));
  if (sun > 0) {
    const sx = v.w * 0.82, sy = v.h * 0.2, r = Math.min(v.w, v.h) * 0.08;
    ctx.globalAlpha = sun;
    const glow = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 3);
    glow.addColorStop(0, '#fff7c2'); glow.addColorStop(1, '#fff7c200');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = Math.max(2, r * 0.12); ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + v.t * 0.3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 1.3, sy + Math.sin(a) * r * 1.3); ctx.lineTo(sx + Math.cos(a) * r * 1.75, sy + Math.sin(a) * r * 1.75); ctx.stroke(); }
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(sx + r * 0.2, sy + r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Ciudad lejana (se mueve más lento) mientras se está en la parte baja.
  const base = v.h + v.cam * v.s * 0.35;
  if (base - v.s * 40 < v.h) {
    for (let i = 0, x = -20; x < v.w; i++) {
      const bw = 40 + hash(i + 40) * 70, bh = (8 + hash(i + 80) * 30) * v.s * 0.45;
      ctx.fillStyle = i % 2 ? '#8fb3d6' : '#9fc0e0'; ctx.fillRect(x, base - bh, bw, bh);
      x += bw + 6;
    }
  }

  // Nubes de fondo en el cielo.
  for (let i = 0; i < 40; i++) {
    const wy = 95 + hash(i + 200) * (ZONES.tech - 95);
    const sy = Y(v, wy) * 0.8 + v.h * 0.1;
    if (sy < -80 || sy > v.h + 80) continue;
    const sx = ((hash(i + 300) * (v.w + 240) + v.t * (5 + hash(i) * 10)) % (v.w + 240)) - 120;
    ctx.globalAlpha = 0.7;
    puff(ctx, sx, sy, (60 + hash(i + 400) * 80) * Math.min(1.3, v.s / 40), '#ffffff');
  }
  ctx.globalAlpha = 1;
}

// Edificios a los costados de la ciudad (hasta los 1.000 m): fachadas con ventanas y techos con antenas.
function drawSideBuildings(ctx: CanvasRenderingContext2D, v: View) {
  if (v.cam > ZONES.sky + 5) return;
  const blocks: [number, number, number, number][] = [ // x desde, x hasta, techo, color
    [-9, -2.2, 99, 210], [-3.4, 0.25, 66, 25], [-3.4, 0.25, 34, 190], [-3.4, 0.25, 12, 5],
    [15.75, 19.4, 82, 150], [15.75, 19.4, 47, 340], [15.75, 19.4, 18, 45], [18.2, 25, 97, 260],
  ];
  for (const [x1, x2, roof, hue] of blocks) {
    const floor = blocks.filter(b => b[0] === x1 && b[2] < roof).reduce((a, b) => Math.max(a, b[2]), 0);
    const sx = X(v, x1), sw = (x2 - x1) * v.s, sy = Y(v, roof), sh = (roof - floor) * v.s;
    if (sy > v.h || sy + sh < 0 || sx > v.w || sx + sw < 0) continue;
    ctx.fillStyle = hsl(hue, 25, 42); ctx.fillRect(sx, sy, sw, sh);
    fillTex(ctx, x1 < 0 && x2 > 0 ? 'brick' : 'concrete', sx, sy, sw, sh, v, hsl(hue, 45, 35, 0.35));
    // Ventanas fijas en el edificio (cada una siempre igual): algunas con luz, otras apagadas y otras
    // con la persiana cerrada.
    const ww = v.s * 0.55, wh = v.s * 0.75, cols = Math.max(1, Math.floor(((x2 - x1) - 0.4) / 1.1));
    const firstRow = Math.max(0, Math.floor((roof - (v.cam + v.h / v.s) - 0.5) / 1.4));
    for (let r = firstRow; ; r++) {
      const wyWorld = roof - 0.5 - r * 1.4; // borde de arriba de la ventana, en unidades
      if (wyWorld - 0.75 < floor + 0.4) break;
      const wy = Y(v, wyWorld);
      if (wy > v.h) break;
      for (let c = 0; c < cols; c++) {
        const wx = sx + v.s * (0.4 + c * 1.1), k = hash(x1 * 131 + roof * 17 + r * 7.3 + c * 3.1);
        if (x1 >= WORLD_W) { // los de la derecha: torres de vidrio azul con reflejos
          ctx.fillStyle = k > 0.8 ? '#fde68a' : k > 0.4 ? '#60a5fa' : '#1d4ed8'; ctx.fillRect(wx - 2, wy, ww + 4, wh);
          ctx.fillStyle = '#ffffff44'; ctx.beginPath(); ctx.moveTo(wx - 2, wy); ctx.lineTo(wx + ww * 0.5, wy); ctx.lineTo(wx - 2, wy + wh * 0.7); ctx.fill();
          continue;
        }
        ctx.fillStyle = k > 0.78 ? '#fde68a' : '#1e3a5f'; ctx.fillRect(wx, wy, ww, wh);
        if (k < 0.3) { // persiana cerrada
          ctx.fillStyle = hsl(hue, 15, 62); ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = hsl(hue, 15, 45); for (let l = 1; l < 5; l++) ctx.fillRect(wx, wy + wh * l / 5, ww, Math.max(1, wh * 0.06));
        }
        ctx.fillStyle = '#ffffff33'; ctx.fillRect(wx, wy, ww, wh * 0.2);
      }
    }
    // techo con borde, antena y tanque
    ctx.fillStyle = hsl(hue, 20, 25); ctx.fillRect(sx - 3, sy - v.s * 0.25, sw + 6, v.s * 0.3);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + sw * 0.7, sy); ctx.lineTo(sx + sw * 0.7, sy - v.s * 2.2); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(sx + sw * 0.7, sy - v.s * 2.2, Math.max(2, v.s * 0.12), 0, Math.PI * 2); ctx.fill();
  }
}

// Edificios enfrentados donde se trepa de balcón en balcón.
function drawFacade(ctx: CanvasRenderingContext2D, f: Facade, v: View) {
  // Los dos edificios enfrentados son distintos: a la izquierda uno antiguo de ladrillo con ventanas en
  // arco y persianas; a la derecha uno moderno de vidrio y hormigón. Cada ventana es siempre igual
  // (depende de su piso), y solo algunas tienen la luz prendida.
  const x1 = f.side < 0 ? -3 : WORLD_W - f.w, x2 = f.side < 0 ? f.w : WORLD_W + 3;
  const s = v.s, sx = X(v, x1), sw = (x2 - x1) * s, sy = Y(v, f.y2), sh = (f.y2 - f.y1) * s;
  if (sy > v.h || sy + sh < 0) return;
  const inner = f.side < 0 ? X(v, f.w) : X(v, WORLD_W - f.w);
  const state = (floor: number, col: number) => hash(f.id * 7.13 + floor * 3.71 + col * 1.37 + 0.5); // < .14 luz, < .45 persiana o cortina
  if (f.side < 0) {
    ctx.fillStyle = '#9a4a2c'; ctx.fillRect(sx, sy, sw, sh);
    fillTex(ctx, 'brick', sx, sy, sw, sh, v, '#7c2d1255');
    for (let floor = 0, y = f.y1 + 1; y < f.y2 - 1.5; y += 2, floor++) {
      for (let col = 0; col < 2; col++) {
        const wx = X(v, -2.2 + col * 2.6), wy = Y(v, y + 1.7), ww = s * 1.2, wh = s * 1.5, k = state(floor, col);
        if (wx + ww < sx || wx > inner) continue;
        ctx.fillStyle = '#e7d3b5'; ctx.beginPath(); ctx.roundRect(wx - 4, wy - 4, ww + 8, wh + 6, [ww / 2 + 4, ww / 2 + 4, 2, 2]); ctx.fill();
        ctx.fillStyle = k < 0.14 ? '#fde68a' : '#2b3a55';
        ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, [ww / 2, ww / 2, 0, 0]); ctx.fill();
        if (k >= 0.14 && k < 0.45) { // persiana verde cerrada
          ctx.fillStyle = '#3f6212'; ctx.fillRect(wx, wy + ww * 0.35, ww, wh - ww * 0.35);
          ctx.fillStyle = '#365314'; for (let l = 1; l < 6; l++) ctx.fillRect(wx, wy + ww * 0.35 + (wh - ww * 0.35) * l / 6, ww, 1.5);
        } else { ctx.strokeStyle = '#e7d3b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke(); }
        ctx.fillStyle = '#b45309'; ctx.fillRect(wx - 3, wy + wh, ww + 6, s * 0.16); // macetero
        ctx.fillStyle = '#16a34a'; ctx.fillRect(wx, wy + wh - s * 0.12, ww, s * 0.12);
      }
      ctx.fillStyle = '#7c2d12'; ctx.fillRect(sx, Y(v, y - 0.05), sw, s * 0.12); // cornisa de cada piso
    }
    ctx.fillStyle = '#5b1e0b'; ctx.fillRect(sx, sy - s * 0.35, sw, s * 0.4);
  } else {
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(sx, sy, sw, sh);
    fillTex(ctx, 'concrete', sx, sy, sw, sh, v, '#47556933');
    for (let floor = 0, y = f.y1 + 1; y < f.y2 - 1.5; y += 2, floor++) {
      const by = Y(v, y + 1.75), bh = s * 1.45;
      ctx.fillStyle = '#334155'; ctx.fillRect(inner + s * 0.3, by, sw, bh); // franja de vidrio de todo el piso
      for (let col = 0; col < 4; col++) {
        const px = inner + s * (0.4 + col * 1.15), k = state(floor, col);
        const glass = ctx.createLinearGradient(px, by, px + s, by + bh);
        glass.addColorStop(0, k < 0.14 ? '#fef3c7' : '#7dd3fc'); glass.addColorStop(1, k < 0.14 ? '#fbbf24' : '#1e40af');
        ctx.fillStyle = glass; ctx.fillRect(px, by + 3, s * 1.05, bh - 6);
        if (k >= 0.14 && k < 0.45) { ctx.fillStyle = '#e2e8f0cc'; ctx.fillRect(px, by + 3, s * 1.05, (bh - 6) * 0.6); } // cortina
        ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(px, by + 3); ctx.lineTo(px + s * 0.35, by + 3); ctx.lineTo(px, by + bh * 0.6); ctx.fill(); // reflejo
      }
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(inner, Y(v, y - 0.05), sw, s * 0.14);
    }
    ctx.fillStyle = '#475569'; ctx.fillRect(sx, sy - s * 0.3, sw, s * 0.35);
  }
  ctx.fillStyle = '#00000040'; ctx.fillRect(f.side < 0 ? inner - s * 0.25 : inner, sy, s * 0.25, sh);
}

// Cartel de la calle al empezar: "SUBIR" con una flecha para arriba.
function drawUpSign(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s, x = X(v, 3), y = Y(v, 0);
  if (y < -s * 4 || y > v.h + s) return;
  ctx.fillStyle = '#6b7280'; ctx.fillRect(x - s * 0.06, y - s * 2.4, s * 0.12, s * 2.4);
  ctx.fillStyle = '#1d4ed8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.roundRect(x - s * 0.75, y - s * 3.5, s * 1.5, s * 1.25, s * 0.15); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); // flecha para arriba
  ctx.moveTo(x, y - s * 3.38); ctx.lineTo(x + s * 0.32, y - s * 3.0); ctx.lineTo(x + s * 0.12, y - s * 3.0); ctx.lineTo(x + s * 0.12, y - s * 2.78);
  ctx.lineTo(x - s * 0.12, y - s * 2.78); ctx.lineTo(x - s * 0.12, y - s * 3.0); ctx.lineTo(x - s * 0.32, y - s * 3.0); ctx.closePath(); ctx.fill();
  ctx.font = `900 ${Math.round(s * 0.34)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SUBIR', x, y - s * 2.5);
}

// ---------- Escaleras y sogas ----------
function drawClimb(ctx: CanvasRenderingContext2D, c: Climb, v: View) {
  const x = X(v, c.x), y1 = Y(v, c.y1), y2 = Y(v, c.y2);
  if (y1 < 0 || y2 > v.h) return;
  const s = v.s;
  if (c.skin === 'rope') {
    ctx.fillStyle = '#475569'; ctx.fillRect(x - s * 0.35, y2 - s * 0.4, s * 0.7, s * 0.18);
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.beginPath(); ctx.moveTo(x, y2 - s * 0.25); ctx.lineTo(x, y1); ctx.stroke();
    ctx.strokeStyle = '#713f12'; ctx.lineWidth = 1;
    for (let k = y2; k < y1; k += s * 0.3) { ctx.beginPath(); ctx.moveTo(x - s * 0.06, k); ctx.lineTo(x + s * 0.06, k + s * 0.15); ctx.stroke(); }
    return;
  }
  const half = s * 0.38, rail = c.skin === 'truss' ? '#cbd5e1' : '#dc2626';
  ctx.strokeStyle = rail; ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.beginPath(); ctx.moveTo(x - half, y1); ctx.lineTo(x - half, y2 - s * 0.3); ctx.moveTo(x + half, y1); ctx.lineTo(x + half, y2 - s * 0.3); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  for (let k = y1 - s * 0.35, i = 0; k > y2 - s * 0.2; k -= s * 0.45, i++) {
    ctx.strokeStyle = c.skin === 'truss' ? '#94a3b8' : '#fca5a5';
    ctx.beginPath(); ctx.moveTo(x - half, k); ctx.lineTo(x + half, k); ctx.stroke();
    if (c.skin === 'truss') { ctx.beginPath(); ctx.moveTo(x - half, k); ctx.lineTo(x + half, k - s * 0.45); ctx.stroke(); }
  }
}

// ---------- Plataformas ----------
function drawPlat(ctx: CanvasRenderingContext2D, pl: Plat, v: View, g: Trepa) {
  const s = v.s, shake = pl.crumble > 0 ? Math.sin(v.t * 60) * 0.06 * s : 0;
  const x = X(v, pl.x) + shake, y = Y(v, pl.y), w = pl.w * s;
  if (y < -s * 8 || y > v.h + s * 12) return;
  if (pl.gone > 0) { ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, s * 0.4); ctx.setLineDash([]); return; }
  const h = s * 0.4;
  switch (pl.skin) {
    case 'ground': {
      fillTex(ctx, 'asphalt', 0, y, v.w, v.h - y, v);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, y, v.w, s * 0.3);
      ctx.fillStyle = '#fde047'; for (let k = 0; k < v.w; k += s * 2) ctx.fillRect(k, y + s * 1.2, s, s * 0.12);
      return;
    }
    case 'beam': {
      ctx.fillStyle = '#ea580c'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fdba74'; ctx.fillRect(x, y, w, h * 0.22);
      ctx.fillStyle = '#9a3412'; ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
      ctx.fillStyle = '#7c2d12';
      for (let k = x + s * 0.35; k < x + w - s * 0.2; k += s * 0.7) { ctx.beginPath(); ctx.arc(k, y + h * 0.55, h * 0.16, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    case 'scaffold': {
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.beginPath();
      for (let k = x + s * 0.2; k <= x + w; k += Math.max(s * 1.2, (w - s * 0.4) / Math.max(1, Math.round(pl.w / 1.2)))) { ctx.moveTo(k, y); ctx.lineTo(k, y + s * 1.6); }
      ctx.moveTo(x, y + s * 0.9); ctx.lineTo(x + w, y + s * 0.9); ctx.moveTo(x + s * 0.2, y + s * 1.6); ctx.lineTo(x + w - s * 0.2, y + s * 0.4);
      ctx.stroke();
      fillTex(ctx, 'wood', x, y, w, h * 0.75, v);
      ctx.strokeStyle = '#5b3412'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h * 0.75);
      return;
    }
    case 'billboard': {
      const bh = s * 1.15;
      ctx.fillStyle = '#334155'; ctx.fillRect(x + w * 0.2, y + bh, s * 0.15, s * 0.5); ctx.fillRect(x + w * 0.75, y + bh, s * 0.15, s * 0.5);
      ctx.fillStyle = hsl(pl.hue, 75, 50); ctx.fillRect(x, y + h * 0.4, w, bh);
      ctx.fillStyle = hsl(pl.hue, 80, 85); ctx.font = `900 ${Math.round(s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(['¡SALTÁ!', 'TREPALUNA', '¡A LA LUNA!', 'COHETES SA', 'PIZZA 24H'][pl.id % 5], x + w / 2, y + h * 0.4 + bh / 2, w - 8);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x - 2, y, w + 4, h * 0.4);
      ctx.fillStyle = '#fde047'; for (let k = x + s * 0.3; k < x + w; k += s * 0.8) ctx.fillRect(k, y + h * 0.4 - 2, s * 0.15, s * 0.15);
      return;
    }
    case 'terrace': {
      ctx.fillStyle = '#64748b'; ctx.fillRect(x, y + h, w, s * 0.5);
      fillTex(ctx, 'checker', x, y, w, h, v, hsl(pl.hue, 60, 45, 0.45));
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.75); ctx.lineTo(x + s * 1.1, y - s * 0.75); ctx.moveTo(x + w - s * 1.1, y - s * 0.75); ctx.lineTo(x + w, y - s * 0.75);
      for (const k of [x + 2, x + s * 0.55, x + s * 1.1, x + w - s * 1.1, x + w - s * 0.55, x + w - 2]) { ctx.moveTo(k, y); ctx.lineTo(k, y - s * 0.75); }
      ctx.stroke();
      // macetas y una sombrilla
      for (const k of [x + w * 0.3, x + w * 0.62]) { ctx.fillStyle = '#b45309'; ctx.fillRect(k, y - s * 0.4, s * 0.45, s * 0.4); ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(k + s * 0.22, y - s * 0.55, s * 0.32, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#475569'; ctx.fillRect(x + w * 0.47, y - s * 1.5, s * 0.06, s * 1.5);
      ctx.fillStyle = hsl(pl.hue + 180, 80, 55); ctx.beginPath(); ctx.moveTo(x + w * 0.47 - s * 0.9, y - s * 1.3); ctx.quadraticCurveTo(x + w * 0.47, y - s * 2.1, x + w * 0.47 + s * 0.96, y - s * 1.3); ctx.fill();
      return;
    }
    case 'tank': {
      ctx.fillStyle = '#475569'; ctx.fillRect(x + w * 0.15, y + s * 0.9, s * 0.12, s * 0.8); ctx.fillRect(x + w * 0.8, y + s * 0.9, s * 0.12, s * 0.8);
      ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.roundRect(x, y, w, s * 1, s * 0.25); ctx.fill();
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(x, y + s * 0.15, w, s * 0.1); ctx.fillRect(x, y + s * 0.6, w, s * 0.1);
      ctx.fillStyle = '#0369a1'; ctx.fillRect(x - 2, y - 2, w + 4, s * 0.12);
      return;
    }
    case 'balcony': {
      fillTex(ctx, 'wood', x, y, w, h * 0.7, v);
      ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.7); ctx.lineTo(x + w, y + h * 0.7); ctx.lineTo(x + w * 0.85, y + h * 1.6); ctx.lineTo(x + w * 0.15, y + h * 1.6); ctx.fill();
      ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.8); ctx.lineTo(x + w, y - s * 0.8);
      for (let k = x + 2; k <= x + w; k += s * 0.28) { ctx.moveTo(k, y); ctx.lineTo(k, y - s * 0.8); }
      ctx.stroke();
      ctx.fillStyle = hsl(pl.hue, 80, 60); for (const k of [x + w * 0.2, x + w * 0.7]) { ctx.beginPath(); ctx.arc(k, y - s * 0.95, s * 0.16, 0, Math.PI * 2); ctx.arc(k + s * 0.25, y - s * 1, s * 0.14, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    case 'step': {
      fillTex(ctx, 'stone', x, y, w, Math.max(h, (pl.w > 1 ? 0.45 : 0.45) * s + 2), v);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, w, s * 0.08);
      ctx.fillStyle = '#00000033'; ctx.fillRect(x, y + s * 0.4, w, s * 0.06);
      return;
    }
    case 'tile': { // baldosa voladora con helices
      fillTex(ctx, 'checker', x, y, w, h, v, hsl(pl.hue, 85, 50, 0.55));
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
      for (const k of [x + s * 0.4, x + w - s * 0.4]) { ctx.fillStyle = '#334155'; ctx.fillRect(k - 1.5, y + h, 3, s * 0.3); const a = Math.abs(Math.sin(v.t * 25 + pl.id)); ctx.fillStyle = '#cbd5e1'; ctx.fillRect(k - s * 0.45 * a, y + h + s * 0.3, s * 0.9 * a, s * 0.08); }
      return;
    }
    case 'crane': case 'lift': {
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w / 2, y - s * 1.6); ctx.lineTo(x + w * 0.8, y); ctx.moveTo(x + w / 2, y - s * 1.6); ctx.lineTo(x + w / 2, 0); ctx.stroke();
      ctx.fillStyle = '#facc15'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#111827'; for (let k = x; k < x + w; k += s * 0.5) ctx.fillRect(k, y + h * 0.5, s * 0.25, h * 0.5);
      if (pl.skin === 'lift') { ctx.strokeStyle = '#64748b'; ctx.strokeRect(x, y - s * 1.2, w, s * 1.2); }
      return;
    }
    case 'bricks': {
      fillTex(ctx, 'brick', x, y, w, h * 1.2, v);
      ctx.strokeStyle = '#3f1d0b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.38, y + h * 0.6); ctx.lineTo(x + w * 0.32, y + h * 1.2); ctx.moveTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.63, y + h * 0.7); ctx.stroke();
      return;
    }
    case 'conveyor': {
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect(x, y, w, h * 1.2, h * 0.6); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      const off = ((v.t * pl.belt * s) % (s * 0.8) + s * 0.8) % (s * 0.8);
      ctx.save(); ctx.beginPath(); ctx.rect(x + h * 0.3, y, w - h * 0.6, h * 0.5); ctx.clip();
      for (let k = x - s + off; k < x + w + s; k += s * 0.8) { ctx.beginPath(); const d = pl.belt > 0 ? 1 : -1; ctx.moveTo(k, y + 2); ctx.lineTo(k + d * s * 0.25, y + h * 0.25); ctx.lineTo(k, y + h * 0.5 - 2); ctx.lineTo(k + s * 0.12, y + h * 0.25); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#94a3b8'; for (let k = x + h * 0.6; k < x + w; k += s * 0.9) { ctx.beginPath(); ctx.arc(k, y + h * 0.85, h * 0.25, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    case 'spring': case 'rocket': {
      const squash = 1;
      ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(x + w * 0.25, y + h * 0.5 + k * s * 0.2 * squash); ctx.lineTo(x + w * 0.75, y + h * 0.6 + k * s * 0.2 * squash); } ctx.stroke();
      if (pl.skin === 'rocket') {
        ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.fillRect(x + w * 0.4, y, w * 0.2, h);
        const flame = 0.6 + 0.4 * Math.sin(v.t * 30);
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + s * 1.1); ctx.lineTo(x + w / 2, y + s * (1.3 + flame * 0.6)); ctx.lineTo(x + w * 0.7, y + s * 1.1); ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(x, y, w, h * 0.7, h * 0.3); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.fillRect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.18);
        ctx.fillStyle = '#1d4ed8'; ctx.fillRect(x + w * 0.15, y + s * 0.95, w * 0.7, s * 0.15);
      }
      return;
    }
    case 'basket': { // globo aerostático
      const cx = x + w / 2, by = y - s * 2.6, br = Math.max(w * 0.75, s * 1.6);
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(cx - br * 0.55, by + br * 0.6); ctx.moveTo(x + w - 3, y); ctx.lineTo(cx + br * 0.55, by + br * 0.6); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = hsl(pl.hue + i * 40, 85, i % 2 ? 60 : 50);
        ctx.beginPath(); ctx.ellipse(cx, by, br * (1 - i / 6), br * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      }
      fillTex(ctx, 'wicker', x, y, w, s * 0.8, v);
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, s * 0.8);
      return;
    }
    case 'zeppelin': {
      const cy = y + s * 0.9;
      ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.ellipse(x + w / 2, cy, w / 2 + s * 0.4, s * 0.95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hsl(pl.hue, 70, 45); ctx.fillRect(x + w * 0.1, cy - s * 0.15, w * 0.8, s * 0.3);
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, cy); ctx.lineTo(x - s * 0.9, cy - s * 0.8); ctx.lineTo(x - s * 0.9, cy + s * 0.8); ctx.fill();
      ctx.fillStyle = '#475569'; ctx.fillRect(x + w * 0.35, cy + s * 0.85, w * 0.3, s * 0.35);
      ctx.fillStyle = '#fde68a'; for (let k = 0; k < 3; k++) ctx.fillRect(x + w * 0.38 + k * w * 0.08, cy + s * 0.92, w * 0.05, s * 0.15);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, w, s * 0.12);
      return;
    }
    case 'cloudBricks': { // bloques dorados con signo de pregunta
      const n = Math.max(1, Math.round(pl.w / 0.9)), bw = w / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(x + i * bw, y, bw - 1, s * 0.9);
        ctx.fillStyle = '#fcd34d'; ctx.fillRect(x + i * bw, y, bw - 1, s * 0.12);
        ctx.fillStyle = '#92400e'; ctx.font = `900 ${Math.round(s * 0.6)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x + i * bw + bw / 2, y + s * 0.5);
      }
      return;
    }
    case 'asteroid': {
      ctx.fillStyle = '#6b6560'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + s * 0.4, w / 2, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(x + w * 0.08, y - s * 0.02, w * 0.84, s * 0.12);
      ctx.fillStyle = '#4b4642';
      ctx.beginPath(); ctx.arc(x + w * 0.3, y + s * 0.45, s * 0.14, 0, Math.PI * 2); ctx.arc(x + w * 0.68, y + s * 0.62, s * 0.1, 0, Math.PI * 2); ctx.fill();
      return;
    }
    case 'station': {
      fillTex(ctx, 'metal', x, y, w, h, v);
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(x + w * 0.1, y + h, w * 0.35, s * 0.5); ctx.fillRect(x + w * 0.55, y + h, w * 0.35, s * 0.5);
      ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.strokeRect(x + w * 0.1 + k * w * 0.0875, y + h, w * 0.0875, s * 0.5); ctx.strokeRect(x + w * 0.55 + k * w * 0.0875, y + h, w * 0.0875, s * 0.5); }
      ctx.fillStyle = (Math.floor(v.t * 2) + pl.id) % 2 ? '#22c55e' : '#ef4444'; ctx.beginPath(); ctx.arc(x + w - s * 0.2, y + h / 2, s * 0.08, 0, Math.PI * 2); ctx.fill();
      return;
    }
    case 'satellite': {
      ctx.fillStyle = '#facc15'; ctx.fillRect(x + w * 0.35, y, w * 0.3, s * 0.8);
      ctx.fillStyle = '#1e40af'; ctx.fillRect(x, y + s * 0.2, w * 0.33, s * 0.4); ctx.fillRect(x + w * 0.67, y + s * 0.2, w * 0.33, s * 0.4);
      ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1; ctx.strokeRect(x, y + s * 0.2, w * 0.33, s * 0.4); ctx.strokeRect(x + w * 0.67, y + s * 0.2, w * 0.33, s * 0.4);
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x, y, w, s * 0.1);
      return;
    }
    case 'ufo': {
      ctx.fillStyle = '#a5f3fc88'; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w * 0.25, s * 0.55, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + s * 0.2, w / 2, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4b5563'; ctx.fillRect(x + w * 0.1, y + s * 0.25, w * 0.8, s * 0.1);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = (Math.floor(v.t * 6) + i) % 3 ? '#fde047' : '#22d3ee'; ctx.beginPath(); ctx.arc(x + w * (0.15 + i * 0.175), y + s * 0.3, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#4ade801a'; ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + s * 0.5); ctx.lineTo(x + w * 0.65, y + s * 0.5); ctx.lineTo(x + w * 0.8, y + s * 2); ctx.lineTo(x + w * 0.2, y + s * 2); ctx.fill();
      return;
    }
    case 'neon': { // plataforma de metal oscuro con borde de neón
      const hue = [190, 290, 320, 160][pl.id % 4];
      fillTex(ctx, 'metal', x, y, w, h, v, '#0f172acc');
      ctx.shadowColor = hsl(hue, 100, 60); ctx.shadowBlur = 10;
      ctx.fillStyle = hsl(hue, 100, 62); ctx.fillRect(x, y, w, s * 0.08); ctx.fillRect(x, y + h - s * 0.06, w, s * 0.06);
      ctx.shadowBlur = 0;
      ctx.fillStyle = hsl(hue, 100, 70); for (let k = x + s * 0.4; k < x + w - s * 0.2; k += s * 0.9) ctx.fillRect(k, y + h * 0.45, s * 0.25, s * 0.06);
      return;
    }
    case 'hologram': { // plataforma holográfica que desaparece (titila antes de apagarse)
      const on = blinkOn(pl, v.t), k = ((v.t + pl.phase) % pl.speed) / pl.speed;
      const flicker = on && k > 0.45 ? (Math.sin(v.t * 40) > 0 ? 0.35 : 0.9) : 0.85;
      ctx.globalAlpha = on ? flicker : 0.18;
      ctx.fillStyle = '#22d3ee55'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = on ? 12 : 0; ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#a5f3fc88'; ctx.lineWidth = 1; for (let k2 = y + 3; k2 < y + h; k2 += 4) { ctx.beginPath(); ctx.moveTo(x, k2); ctx.lineTo(x + w, k2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      return;
    }
    case 'techTile': { // bloque móvil con flechas
      ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(x, y, w, s * 0.6, s * 0.1); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.fillRect(x, y, w, s * 0.1);
      ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
      ctx.font = `900 ${Math.round(s * 0.42)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pl.dx >= 0 ? '›››' : '‹‹‹', x + w / 2, y + s * 0.36); ctx.shadowBlur = 0;
      return;
    }
    case 'piston': { // pistón que sube y baja con flechas
      ctx.fillStyle = '#64748b'; ctx.fillRect(x + w * 0.4, y + s * 0.5, w * 0.2, v.h);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(x + w * 0.43, y + s * 0.5, w * 0.06, v.h);
      ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(x, y, w, s * 0.55, s * 0.1); ctx.fill();
      ctx.fillStyle = pl.dy >= 0 ? '#22c55e' : '#ef4444'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.font = `900 ${Math.round(s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pl.dy >= 0 ? '▲' : '▼', x + w / 2, y + s * 0.3); ctx.shadowBlur = 0;
      return;
    }
    case 'glass': { // cristal que se rompe
      ctx.fillStyle = '#bae6fd99'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
      ctx.beginPath(); ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.35, y + h); ctx.moveTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.5, y + h * 0.6); ctx.lineTo(x + w * 0.75, y + h); ctx.stroke();
      ctx.fillStyle = '#ffffffaa'; ctx.fillRect(x + 3, y + 2, w * 0.25, 2);
      return;
    }
    case 'moon': {
      const r = s * 5, cx = x + w / 2, cy = y + r - s * 0.05;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.4);
      glow.addColorStop(0, '#fef9c366'); glow.addColorStop(1, '#fef9c300');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e7e5d8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9c6b4';
      for (const [dx, dy, cr] of [[-0.4, 0.3, 0.16], [0.35, 0.15, 0.1], [0.1, 0.55, 0.2], [-0.15, 0.08, 0.06], [0.5, 0.5, 0.08]]) { ctx.beginPath(); ctx.arc(cx + dx * r, cy - r + dy * r * 1.2, cr * r, 0, Math.PI * 2); ctx.fill(); }
      // Banderín de llegada.
      const fx = cx + s * 0.9, wave = Math.sin(v.t * 5) * s * 0.1;
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(fx, y - s * 2.6, s * 0.09, s * 2.6);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(fx + s * 0.09, y - s * 2.6); ctx.lineTo(fx + s * 1.5, y - s * 2.25 + wave); ctx.lineTo(fx + s * 0.09, y - s * 1.9); ctx.fill();
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx + s * 0.55, y - s * 2.25, s * 0.13, 0, Math.PI * 2); ctx.fill();
      return;
    }
  }
  void g;
}

// ---------- Peligros ----------
function drawFire(ctx: CanvasRenderingContext2D, f: Fire, v: View) {
  const s = v.s, px = X(v, f.x), py = Y(v, f.y);
  if (py < -s * 6 || py > v.h + s * 6) return;
  const active = fireActive(f, v.t), warn = !active && fireWarning(f, v.t);
  const flame = (x1: number, y1: number, x2: number, y2: number, horizontal: boolean) => {
    const grad = horizontal ? ctx.createLinearGradient(x1, 0, x2, 0) : ctx.createLinearGradient(0, y1, 0, y2);
    grad.addColorStop(0, '#fff7cc'); grad.addColorStop(0.3, '#fde047'); grad.addColorStop(0.65, '#f97316'); grad.addColorStop(1, '#dc262600');
    ctx.fillStyle = grad;
    ctx.beginPath();
    const n = 7;
    // Lengua de fuego: se angosta hacia la punta y tiembla.
    const wob = (i: number) => Math.sin(v.t * 30 + i * 1.7) * s * 0.1;
    if (!horizontal) {
      const cx = (x1 + x2) / 2, half = (x2 - x1) / 2;
      ctx.moveTo(cx - half, y1);
      for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(cx - half * (1 - k * 0.85) + wob(i), y1 + (y2 - y1) * k); }
      for (let i = n; i >= 1; i--) { const k = i / n; ctx.lineTo(cx + half * (1 - k * 0.85) + wob(i + 9), y1 + (y2 - y1) * k); }
      ctx.lineTo(cx + half, y1);
    } else {
      const cy = (y1 + y2) / 2, half = (y2 - y1) / 2;
      ctx.moveTo(x1, cy - half);
      for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(x1 + (x2 - x1) * k, cy - half * (1 - k * 0.85) + wob(i)); }
      for (let i = n; i >= 1; i--) { const k = i / n; ctx.lineTo(x1 + (x2 - x1) * k, cy + half * (1 - k * 0.85) + wob(i + 9)); }
      ctx.lineTo(x1, cy + half);
    }
    ctx.closePath(); ctx.fill();
  };
  if (f.dir === 'up') {
    if (active) flame(px - s * 0.45, py - s * 0.5, px + s * 0.45, Y(v, f.y + 0.5 + f.len), false);
    if (warn) { ctx.fillStyle = '#9ca3af99'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(px + Math.sin(v.t * 9 + i) * s * 0.2, py - s * (0.7 + i * 0.35), s * (0.15 + i * 0.06), 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = '#4b5563'; ctx.fillRect(px - s * 0.3, py - s * 0.5, s * 0.6, s * 0.5);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(px - s * 0.4, py - s * 0.62, s * 0.8, s * 0.18);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(px - s * 0.3, py - s * 0.3, s * 0.6, s * 0.08);
  } else {
    const d = f.dir === 'right' ? 1 : -1;
    if (active) flame(px + d * s * 0.4, Y(v, f.y + 0.32), px + d * s * (0.4 + f.len), Y(v, f.y - 0.32), true);
    if (warn) { ctx.fillStyle = '#9ca3af99'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(px + d * s * (0.7 + i * 0.35), py + Math.sin(v.t * 9 + i) * s * 0.15, s * (0.12 + i * 0.05), 0, Math.PI * 2); ctx.fill(); } }
    fillTex(ctx, 'brick', px - s * 0.5, py - s * 0.5, s, s, v);
    ctx.fillStyle = '#4b5563'; ctx.fillRect(d > 0 ? px : px - s * 0.45, py - s * 0.22, s * 0.45, s * 0.44);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(d > 0 ? px + s * 0.38 : px - s * 0.5, py - s * 0.3, s * 0.12, s * 0.6);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, v: View) {
  const s = v.s, p = ballPos(b, v.t), px = X(v, b.px), py = Y(v, b.py), bx = X(v, p.x), by = Y(v, p.y);
  if (py > v.h + s * 6 || by < -s * 2) return;
  ctx.fillStyle = '#facc15'; ctx.fillRect(px - s * 2, py - s * 0.35, s * 4, s * 0.35);
  ctx.fillStyle = '#111827'; for (let k = px - s * 2; k < px + s * 2; k += s * 0.5) ctx.fillRect(k, py - s * 0.2, s * 0.25, s * 0.2);
  ctx.strokeStyle = '#374151'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.setLineDash([s * 0.18, s * 0.08]);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  const grad = ctx.createRadialGradient(bx - s * 0.25, by - s * 0.25, s * 0.1, bx, by, s * 0.75);
  grad.addColorStop(0, '#6b7280'); grad.addColorStop(1, '#111827');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(bx, by, s * 0.75, 0, Math.PI * 2); ctx.fill();
}

function drawBird(ctx: CanvasRenderingContext2D, b: Bird, v: View) {
  const s = v.s, p = birdPos(b, v.t), x = X(v, p.x), y = Y(v, p.y);
  if (y < -s * 2 || y > v.h + s * 2) return;
  if (b.skin === 'meteor') {
    const grad = ctx.createLinearGradient(x - p.dir * s * 2.5, y, x, y);
    grad.addColorStop(0, '#f9731600'); grad.addColorStop(1, '#f97316');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(x - p.dir * s * 2.5, y - s * 0.1); ctx.lineTo(x, y - s * 0.45); ctx.lineTo(x, y + s * 0.45); ctx.fill();
    ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (b.skin === 'drone') { // dron con hélices y ojo rojo
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.roundRect(x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.4, s * 0.15); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x + p.dir * s * 0.18, y, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#334155'; ctx.fillRect(x + side * s * 0.45 - 1.5, y - s * 0.4, 3, s * 0.2);
      const a = Math.abs(Math.sin(v.t * 30 + side));
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + side * s * 0.45 - s * 0.35 * a, y - s * 0.42, s * 0.7 * a, s * 0.06);
    }
    return;
  }
  if (b.skin === 'plane') {
    ctx.save(); ctx.translate(x, y); ctx.scale(p.dir, 1);
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-s * 0.2, -s * 0.5, s * 0.25, s * 1); ctx.fillRect(-s * 0.85, -s * 0.4, s * 0.15, s * 0.4);
    ctx.fillStyle = '#7dd3fc'; ctx.fillRect(s * 0.35, -s * 0.12, s * 0.2, s * 0.12);
    ctx.restore();
    return;
  }
  const flap = Math.sin(v.t * 14 + b.id) * s * 0.35;
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - flap); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.1, x, y); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.1, x + s * 0.5, y - flap); ctx.stroke();
  ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(x + p.dir * s * 0.12, y); ctx.lineTo(x + p.dir * s * 0.3, y + s * 0.05); ctx.lineTo(x + p.dir * s * 0.12, y + s * 0.1); ctx.fill();
}

// ---------- Zona tecnológica ----------
function drawLaser(ctx: CanvasRenderingContext2D, l: Laser, v: View) {
  const s = v.s, y = Y(v, l.y), x1 = X(v, l.x1), x2 = X(v, l.x2);
  if (y < -s * 2 || y > v.h + s * 2) return;
  const active = laserActive(l, v.t), warn = !active && laserWarning(l, v.t);
  const color = l.style === 'zap' ? '#60a5fa' : '#f43f5e';
  if (active) {
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    if (l.style === 'laser') {
      ctx.fillStyle = color; ctx.fillRect(x1, y - laserHalf(l) * s, x2 - x1, laserHalf(l) * 2 * s);
      ctx.fillStyle = '#fff1f2'; ctx.fillRect(x1, y - s * 0.04, x2 - x1, s * 0.08);
    } else { // rayo que zigzaguea
      for (const [c, wdt] of [[color, Math.max(3, s * 0.14)], ['#eff6ff', Math.max(1.5, s * 0.05)]] as const) {
        ctx.strokeStyle = c; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x1, y);
        const n = 8;
        for (let i = 1; i < n; i++) ctx.lineTo(x1 + (x2 - x1) * i / n, y + (hash(i + Math.floor(v.t * 20) * 7) - 0.5) * s * 0.55);
        ctx.lineTo(x2, y); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  } else if (warn) {
    ctx.strokeStyle = l.style === 'zap' ? '#60a5fa66' : '#f43f5e66'; ctx.lineWidth = 1; ctx.setLineDash([s * 0.3, s * 0.3]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.setLineDash([]);
  }
  // emisores / postes
  for (const [ex, d] of [[x1, 1], [x2, -1]] as const) {
    if (l.style === 'zap') {
      ctx.fillStyle = '#334155'; ctx.fillRect(ex - s * 0.15, y - s * 0.45, s * 0.3, s * 0.9);
      ctx.fillStyle = '#facc15'; ctx.fillRect(ex - s * 0.2, y - s * 0.5, s * 0.4, s * 0.15); ctx.fillRect(ex - s * 0.2, y + s * 0.35, s * 0.4, s * 0.15);
    } else {
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect(d > 0 ? ex - s * 0.15 : ex - s * 0.35, y - s * 0.3, s * 0.5, s * 0.6, s * 0.1); ctx.fill();
      ctx.fillStyle = active ? '#fda4af' : '#7f1d1d'; ctx.beginPath(); ctx.arc(ex + d * s * 0.1, y, s * 0.13, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawFan(ctx: CanvasRenderingContext2D, f: Fan, v: View) {
  const s = v.s, y1 = Y(v, f.y2), y2 = Y(v, f.y1);
  if (y2 < 0 || y1 > v.h) return;
  const edge = f.side < 0 ? X(v, 0) : X(v, WORLD_W), dir = -f.side;
  // rachas de viento
  ctx.strokeStyle = '#bfdbfe88'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const yy = y1 + hash(i + f.id) * (y2 - y1), len = s * (1 + hash(i + 3) * 1.5);
    const sx = edge + dir * (((v.t * s * 8 + hash(i) * WORLD_W * s) % (WORLD_W * s)));
    ctx.beginPath(); ctx.moveTo(sx, yy); ctx.quadraticCurveTo(sx + dir * len * 0.5, yy - s * 0.15, sx + dir * len, yy); ctx.stroke();
  }
  // ventiladores en el costado
  for (let yy = y1 + s; yy < y2; yy += s * 2.4) {
    const cx = edge + dir * s * 0.1;
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(cx - s * 0.55, yy - s * 0.9, s * 1.1, s * 1.8, s * 0.2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(cx, yy, s * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, yy); ctx.rotate(v.t * 18);
    ctx.fillStyle = '#93c5fd'; for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(s * 0.35, 0, s * 0.33, s * 0.12, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

function drawMagnet(ctx: CanvasRenderingContext2D, m: Magnet, v: View) {
  const s = v.s, x = X(v, m.x), y1 = Y(v, m.y1), y2 = Y(v, m.y2);
  if (y1 < 0 || y2 > v.h + s * 3) return;
  const grad = ctx.createLinearGradient(0, y2, 0, y1);
  grad.addColorStop(0, '#a78bfa66'); grad.addColorStop(1, '#a78bfa10');
  ctx.fillStyle = grad; ctx.fillRect(x - s * 0.7, y2, s * 1.4, y1 - y2);
  ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const k = ((v.t * 0.8 + i / 6) % 1), yy = y1 - (y1 - y2) * k; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(x, yy, s * 0.6, s * 0.12, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // imán en U arriba de todo
  const my = y2 - s * 1.3;
  ctx.lineWidth = s * 0.35; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x, my, s * 0.55, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - s * 0.73, my, s * 0.36, s * 0.45); ctx.fillRect(x + s * 0.37, my, s * 0.36, s * 0.45);
  ctx.lineCap = 'round';
}

function drawGear(ctx: CanvasRenderingContext2D, gr: Gear, v: View) {
  const s = v.s, x = X(v, gr.x), y = Y(v, gr.y), r = gr.r * s;
  if (y < -r * 2 || y > v.h + r * 2) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(v.t * gr.speed);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? r : r * 0.8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, o: Portal, v: View) {
  const s = v.s;
  for (const [px, py, color] of [[o.x1, o.y1, hsl(o.hue, 100, 60)], [o.x2, o.y2, hsl(o.hue + 70, 100, 65)]] as const) {
    const x = X(v, px), y = Y(v, py) - s * 0.75;
    if (y < -s * 2 || y > v.h + s * 2) continue;
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * 0.14);
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    const inner = ctx.createRadialGradient(x, y, 0, x, y, s * 0.7);
    inner.addColorStop(0, '#ffffffcc'); inner.addColorStop(1, hsl(o.hue, 100, 50, 0.15));
    ctx.fillStyle = inner; ctx.beginPath(); ctx.ellipse(x, y, s * 0.45, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.3 * Math.abs(Math.sin(v.t * 3)), s * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

// ---------- Personaje ----------
function drawPlayer(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  // El mismo personaje que en ¡Cuidado, bloques!; al perder, cae girando (y chamuscado si se quemó).
  const p = g.player, s = v.s;
  const pw = PLAYER_W * s, ph = PLAYER_H * s;
  const px = X(v, p.x) - pw / 2, py = Y(v, p.y) - ph;
  const burnt = g.dying?.reason === 'burn';
  ctx.save();
  if (g.dying) { ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(p.spin); ctx.translate(-(px + pw / 2), -(py + ph / 2)); }
  drawRunner(ctx, { x: px, y: py, w: pw, h: ph, facing: p.facing, time: v.t, running: p.vx !== 0 && !!p.ground, airborne: !p.ground && !p.climb, climbing: !!p.climb, falling: !!g.dying, burnt });
  ctx.restore();
  if (burnt) { // humito
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,113,108,${0.5 - i * 0.12})`; ctx.beginPath(); ctx.arc(px + pw / 2 + Math.sin(v.t * 6 + i) * pw * 0.4, py - i * pw * 0.6, pw * (0.25 + i * 0.1), 0, Math.PI * 2); ctx.fill(); }
  }
}

function draw(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  drawBackground(ctx, v);
  drawSideBuildings(ctx, v);
  for (const f of g.facades) drawFacade(ctx, f, v);
  drawUpSign(ctx, v);
  const s = v.s;
  // Regla de metros al costado.
  ctx.font = `800 ${Math.max(10, Math.round(s * 0.3))}px Nunito, system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let m = Math.max(0, Math.ceil(v.cam / 10) * 10); m < v.cam + v.h / s; m += 10) {
    const y = Y(v, m), rx = Math.max(X(v, 0), 2);
    ctx.fillStyle = '#ffffffaa'; ctx.fillRect(rx, y, s * 0.3, 2);
    ctx.fillStyle = '#ffffffcc'; ctx.fillText(`${fmtM(m * 10)} m`, rx + s * 0.38, y);
  }
  for (const c of g.climbs) drawClimb(ctx, c, v);
  const moon = moonOf(g);
  drawPlat(ctx, moon, v, g);
  for (const pl of g.plats) if (pl !== moon) drawPlat(ctx, pl, v, g);
  for (const f of g.fires) drawFire(ctx, f, v);
  for (const b of g.balls) drawBall(ctx, b, v);
  for (const b of g.birds) drawBird(ctx, b, v);
  for (const m of g.magnets) drawMagnet(ctx, m, v);
  for (const gr of g.gears) drawGear(ctx, gr, v);
  for (const o of g.portals) drawPortal(ctx, o, v);
  for (const f of g.fans) drawFan(ctx, f, v);
  for (const l of g.lasers) drawLaser(ctx, l, v);
  drawPlayer(ctx, g, v);
  // Capa de nubes: se pasa a través (no se pueden pisar).
  for (let i = 0; i < 26; i++) {
    const wy = ZONES.clouds + 2 + hash(i + 700) * (ZONES.tech - ZONES.clouds - 2);
    const y = Y(v, wy);
    if (y < -150 || y > v.h + 150) continue;
    const x = X(v, -4 + ((hash(i + 800) * 26 + v.t * (0.25 + hash(i) * 0.4)) % 26));
    ctx.globalAlpha = 0.55;
    puff(ctx, x, y, s * (5 + hash(i + 900) * 4), i % 3 ? '#ffffff' : '#e2e8f0');
  }
  ctx.globalAlpha = 1;
}

const ZONE_MESSAGES: Record<Zone, string> = {
  city: '',
  sky: '¡Pasaste los 1.000 m! Se terminaron los edificios ☀️',
  clouds: 'Entrás en las nubes: no se pueden pisar ☁️',
  tech: '¡Mitad del camino! Zona tecnológica: cuidado con los láseres ⚡',
  space: '¡Espacio exterior! Acá saltás más alto 🚀',
};
const LOSE_TEXT: Record<LoseReason, string> = { burn: '¡Te quemaste!', zap: '¡Te electrocutaste!', fall: '¡Te caíste!' };

// En pantallas angostas se ven unos 11 m de ancho y la cámara sigue al personaje de costado (llegando
// a ver un poco de los edificios); en las anchas se ve todo. Siempre se ven al menos 13 de alto.
function viewFor(w: number, h: number) {
  const viewW = Math.max(11, Math.min(WORLD_W, w / 38));
  const scale = Math.min(w / viewW, h / 13);
  return { scale, viewW: w / scale };
}

export function Trepaluna() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Trepa>(newTrepa());
  const camRef = useRef(0);
  const camXRef = useRef(WORLD_W / 2);
  const input = useRef<Input>({ left: false, right: false, jump: false, down: false });
  const recordRef = useRef<TrepaRecord>(readTrepaRecord());
  const brokeRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, m: 0, best: 0 });
  const [record, setRecord] = useState(readTrepaRecord);
  const [result, setResult] = useState({ m: 0, time: 0, reason: 'fall' as LoseReason, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.big ? 2600 : 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, g = gameRef.current;
    if (!stage || !canvas) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { scale, viewW } = viewFor(w, h);
    const ox = viewW >= WORLD_W ? (w - WORLD_W * scale) / 2 : -camXRef.current * scale;
    draw(ctx, g, { w, h, s: scale, ox, cam: camRef.current, t: g.time + (g.dying?.t ?? 0) });
  }, []);

  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const { scale, viewW } = viewFor(stage.clientWidth, stage.clientHeight);
    const viewH = stage.clientHeight / scale;
    const target = Math.max(-1.2, g.player.y - viewH * (g.dying ? 0.5 : 0.38));
    const targetX = Math.max(-1.2, Math.min(WORLD_W - viewW + 1.2, g.player.x - viewW / 2));
    const k = dt < 0 || g.dying ? 1 : Math.min(1, dt * 4);
    camRef.current += (target - camRef.current) * k;
    camXRef.current += (targetX - camXRef.current) * (dt < 0 ? 1 : Math.min(1, dt * 6));
  }, []);

  const start = useCallback(() => {
    gameRef.current = newTrepa();
    camRef.current = 0;
    follow(-1);
    input.current = { left: false, right: false, jump: false, down: false };
    recordRef.current = readTrepaRecord();
    brokeRef.current = false;
    setHud({ tenths: 0, m: 0, best: 0 });
    setToast(null);
    setStatus('playing');
    paint();
  }, [paint, follow]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    follow(-1);
    paint();
    const observer = new ResizeObserver(paint);
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
      for (const e of takeEvents(g)) {
        if (e.type === 'zone' && ZONE_MESSAGES[e.zone]) setToast({ text: ZONE_MESSAGES[e.zone], id: now });
        if (e.type === 'lose') setToast({ text: LOSE_TEXT[e.reason], id: now });
      }
      follow(dt);
      paint();
      const m = meters(g.player.y), best = meters(g.best);
      // ¡Rompiste el récord! (una vez por partida, cuando superás la altura del récord anterior).
      const prev = recordRef.current.height;
      if (!brokeRef.current && prev > 0 && best > prev && !g.dying) { brokeRef.current = true; setToast({ text: '¡Rompiste el récord!', id: now, big: true }); }
      const shown = { tenths: Math.floor(g.time * 10), m, best };
      setHud(p => p.tenths === shown.tenths && p.m === shown.m ? p : shown);
      if (g.over || g.won) {
        const rec = readTrepaRecord();
        const next: TrepaRecord = { height: Math.max(rec.height, g.won ? MOON_M : best), time: g.won ? Math.min(rec.time ?? Infinity, g.time) : rec.time };
        const isNew = next.height > rec.height || (g.won && (rec.time === null || g.time < rec.time));
        saveRecord(next); setRecord(next);
        setResult({ m: g.won ? MOON_M : best, time: g.time, reason: g.dying?.reason ?? 'fall', newRecord: isNew && (rec.height > 0 || g.won) });
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

  const pct = (m: number) => `${Math.max(0, Math.min(100, (m / MOON_M) * 100))}%`;
  const marks: [number, string][] = [[ZONES.sky * 10, 'Fin de los edificios'], [ZONES.clouds * 10, 'Nubes'], [ZONES.tech * 10, 'Zona tecnológica'], [ZONES.space * 10, 'Espacio'], [MOON_M, 'Luna']];

  return <section className="runner trepa" aria-label="Trepaluna">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Trepaluna</h1>
      <div className="runner-scores"><span>Récord <strong>{record.time !== null ? `🌕 ${formatTime(record.time)}` : `${fmtM(record.height)} m`}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label="Recorrido de la ciudad a la Luna" />
        {status === 'playing' && toast && <div key={toast.id} className={toast.big ? 'trepa-record' : 'trepa-toast'} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="trepa-message">
          <div>
            {status === 'ready' && <>
              <h2 id="trepa-message">Trepaluna</h2>
              <p>Como un juego de plataformas, pero para arriba: trepá terrazas, balcones, vigas, escaleras y sogas, usá trampolines y montacargas, esquivá caños de fuego, bolas de demolición y pájaros. Pasá las nubes, la zona tecnológica (láseres, imanes, portales y engranajes) y el espacio hasta clavar el banderín en la Luna. Si te quemás o te caés muy abajo… ¡GAME OVER!</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar (en escaleras, mantené para trepar) · <kbd>↓</kbd> bajar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="trepa-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="trepa-message" className="trepa-gameover">GAME OVER</h2>
              <p>{LOSE_TEXT[result.reason]} Llegaste a <strong>{fmtM(result.m)} m</strong> en {formatTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <h2 id="trepa-message" className="trepa-win">¡Felicitaciones: misión cumplida!!!</h2>
              <p>Clavaste el banderín en la Luna en <strong>{formatTime(result.time)}</strong>.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side" aria-label="Tiempo y metros">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="trepa-time">{formatTime(hud.tenths / 10)}</strong></div>
        <div className="trepa-stat"><span>Metros</span><strong data-testid="trepa-meters">{fmtM(hud.m)}</strong></div>
        <div className="trepa-meter" aria-hidden="true">
          <div className="trepa-meter-track">
            <div className="trepa-meter-best" style={{ height: pct(hud.best) }} />
            <div className="trepa-meter-fill" style={{ height: pct(hud.m) }} />
            {record.height > 0 && <span className="trepa-meter-record" style={{ bottom: pct(record.height) }} title="Récord" />}
          </div>
          <div className="trepa-meter-marks">{marks.map(([m, label]) => <span key={label} style={{ bottom: pct(m) }}>{label}<small>{fmtM(m)} m</small></span>)}</div>
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
