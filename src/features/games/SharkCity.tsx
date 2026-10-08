import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CHOMP, FLOAT_Y, galeAt, GOAL, newShark, PLAYER_H, PLAYER_TARGET, PLAYER_W, rescueX, sharkLen, sharkPose, SHARKS, step, takeEvents, timeLeft, TIME_LIMIT, windAt,
  type Block, type Climb, type Decor, type Input, type LoseReason, type Plat, type Rescue, type RescueKind, type Shark, type SharkGame, type SharkType, type Zip,
} from './shark';
import { drawSharkSprite, loadSharkSprites, type SpriteOptions } from './sharkSprites';
import { font, hash, hsl, scene, surfaceClip, visible, waveY, X, Y, type View } from './sharkView';
import { drawBuilding, drawDebrisArt, drawFx, drawHouse, drawInterior, drawLamp, drawShop, drawTreeDecor, drawVehicle } from './sharkArt';

const RECORD_KEY = 'escritorio-personal-juegos:tiburon-record';
export interface SharkRecord { saved: number; time: number | null } // más rescatados y mejor tiempo para rescatar a todos
export const readSharkRecord = (): SharkRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null') as SharkRecord | null; return v && typeof v.saved === 'number' ? v : { saved: 0, time: null }; } catch { return { saved: 0, time: null }; }
};
const saveRecord = (value: SharkRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatSharkTime = (seconds: number) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';

// Relámpagos: en cada tramo de 5 segundos cae uno (a veces dos seguidos) en un lugar del cielo.
function lightning(t: number) {
  let best = { a: 0, x: 0.5, k: 0 };
  for (const k of [Math.floor(t / 5), Math.floor(t / 5) - 1]) {
    for (const extra of [0, 0.35]) {
      if (extra && hash(k + 300) < 0.5) continue;
      const at = k * 5 + 1 + hash(k + 100) * 3 + extra, d = t - at;
      if (d < 0 || d > 0.7) continue;
      const a = Math.exp(-d * 6) * (d < 0.06 || (d > 0.12 && d < 0.2) ? 1 : 0.45);
      if (a > best.a) best = { a, x: 0.1 + hash(k + 200) * 0.8, k };
    }
  }
  return best;
}

// El rayo de cada relámpago: un canal principal en zigzag que baja de las nubes, con ramas que se abren
// (y ramitas de las ramas). Se arma una sola vez por relámpago; se mide en altos de pantalla.
type Bolt = { pts: [number, number][]; w: number }[];
const bolts = new Map<number, Bolt>();
function boltFor(k: number): Bolt {
  const cached = bolts.get(k);
  if (cached) return cached;
  let seed = (Math.abs(k) * 7919 + 104729) % 2147483646 + 1;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const out: Bolt = [];
  const grow = (x: number, y: number, heading: number, len: number, w: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    const n = Math.max(3, Math.round(len / 0.022));
    let drift = heading;
    for (let i = 0; i < n; i++) {
      drift += (r() - 0.5) * 0.35; drift = drift * 0.8 + heading * 0.2;
      const ang = drift + (r() - 0.5) * 1.3, step = (len / n) * (0.6 + r() * 0.8);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push([x, y]);
      if (depth < 2 && i > 1 && r() < (depth ? 0.1 : 0.2)) grow(x, y, drift + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), len * (0.2 + r() * 0.3) * (1 - i / n), w * 0.45, depth + 1);
    }
    out.push({ pts, w });
  };
  grow(0, 0.06 + r() * 0.06, Math.PI / 2 + (r() - 0.5) * 0.4, 0.75 + r() * 0.2, 1, 0);
  if (bolts.size > 16) bolts.clear();
  bolts.set(k, out);
  return out;
}

function drawBolt(ctx: CanvasRenderingContext2D, v: View, flash: ReturnType<typeof lightning>) {
  if (flash.a < 0.12) return;
  const bolt = boltFor(flash.k), x0 = flash.x * v.w, h = v.h, a = flash.a;
  ctx.save();
  // La nube de donde sale se ilumina por dentro.
  const glow = ctx.createRadialGradient(x0, h * 0.1, 0, x0, h * 0.1, h * 0.35);
  glow.addColorStop(0, `rgba(200,210,255,${0.5 * a})`); glow.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(x0 - h * 0.35, 0, h * 0.7, h * 0.45);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Tres pasadas: el resplandor violeta, el halo y el centro blanquísimo.
  for (const [color, width, blur, alpha] of [['170,180,255', 10, 28, 0.25], ['205,215,255', 4, 10, 0.6], ['255,255,255', 1.6, 0, 1]] as const) {
    ctx.shadowColor = 'rgba(165,180,255,0.95)'; ctx.shadowBlur = blur;
    for (const seg of bolt) {
      ctx.strokeStyle = `rgba(${color},${alpha * a * (seg.w < 1 ? 0.75 : 1)})`;
      ctx.lineWidth = Math.max(0.7, width * seg.w * Math.max(0.8, h / 700));
      ctx.beginPath();
      seg.pts.forEach(([x, y], i) => i ? ctx.lineTo(x0 + x * h, y * h) : ctx.moveTo(x0 + x * h, y * h));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- Fondo: cielo de tormenta, nubes, rayos y muchos edificios lejos ----------
function drawSky(ctx: CanvasRenderingContext2D, v: View, flash: ReturnType<typeof lightning>) {
  const g = ctx.createLinearGradient(0, 0, 0, v.h);
  g.addColorStop(0, '#070b16'); g.addColorStop(0.55, '#1b2638'); g.addColorStop(1, '#2c3b50');
  ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
  if (flash.a > 0.05) {
    ctx.fillStyle = `rgba(200,215,255,${flash.a * 0.45})`; ctx.fillRect(0, 0, v.w, v.h);
  }
  // Nubes oscuras que corren con el viento.
  for (let i = 0; i < 12; i++) {
    const span = v.w + 500, speed = 6 + hash(i + 3) * 10;
    const x = ((hash(i) * span + v.t * speed - v.cx * v.s * 0.04) % span + span) % span - 250;
    const y = v.h * (0.02 + hash(i + 9) * 0.22), r = v.h * (0.07 + hash(i + 4) * 0.06);
    ctx.fillStyle = flash.a > 0.1 ? `rgba(70,80,110,${0.55 + flash.a * 0.3})` : 'rgba(12,18,32,0.7)';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 1.5) * r * 0.9, y + Math.sin(j * 2 + i) * r * 0.2, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
  }
}

const SKY_LAYERS = [
  { par: 0.15, unit: 0.45, n: 46, base: '#1a2436', lit: 0.12, span: 220, hmax: 34 },
  { par: 0.35, unit: 0.65, n: 40, base: '#141d2c', lit: 0.2, span: 200, hmax: 26 },
];
function drawSkyline(ctx: CanvasRenderingContext2D, v: View, flash: number) {
  SKY_LAYERS.forEach((L, li) => {
    const s = v.s * L.unit, base = v.h + v.cy * v.s * L.par - v.s * 0.4 * (1 - L.par);
    const off = v.cx * v.s * L.par;
    for (let rep = -1; rep < Math.ceil(v.w / (L.span * s)) + 1; rep++) {
      for (let i = 0; i < L.n; i++) {
        const bx = (hash(i * 7 + li * 100) * L.span), bw = 3 + hash(i * 3 + li) * 6, bh = 6 + hash(i * 11 + li * 50) * L.hmax;
        const sx = ((bx * s - off) % (L.span * s) + L.span * s) % (L.span * s) + rep * L.span * s;
        if (sx > v.w + 20 || sx + bw * s < -20) continue;
        const top = base - bh * s;
        ctx.fillStyle = flash > 0.1 ? `rgba(${60 + flash * 80},${70 + flash * 80},${100 + flash * 80},1)` : L.base;
        ctx.fillRect(sx, top, bw * s, base - top);
        if (hash(i + li * 9) < 0.3) { ctx.fillRect(sx + bw * s * 0.45, top - 3 * s, Math.max(1, s * 0.15), 3 * s); if (Math.floor(v.t * 1.5 + i) % 2) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(sx + bw * s * 0.45, top - 3 * s, Math.max(1.2, s * 0.18), 0, Math.PI * 2); ctx.fill(); } }
        // Ventanas prendidas (algunas parpadean, se cortó la luz en muchas).
        const cols = Math.floor(bw / 1.1), rows = Math.floor(bh / 1.4);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const hsh = hash(i * 131 + r * 17 + c * 5 + li * 999);
          if (hsh > L.lit) continue;
          if (hsh < 0.02 && Math.floor(v.t * 3 + i) % 3 === 0) continue;
          ctx.fillStyle = hsh < L.lit * 0.5 ? 'rgba(253,224,140,0.75)' : 'rgba(186,230,253,0.45)';
          ctx.fillRect(sx + (c * 1.1 + 0.35) * s, top + (r * 1.4 + 0.5) * s, 0.5 * s, 0.6 * s);
        }
      }
    }
    // Agua lejana al pie de los edificios.
    ctx.fillStyle = li ? '#0d2231' : '#11283a';
    ctx.fillRect(0, base, v.w, v.h - base);
  });
}

// ---------- Las manzanas: edificios, casas y locales ----------
function drawBlock(ctx: CanvasRenderingContext2D, g: SharkGame, b: Block, v: View, flash: number) {
  if (!visible(v, b.x1, b.x2, -1, b.top + 3)) return;
  if (b.kind === 'building') {
    drawBuilding(ctx, g, b, v, flash);
    if (g.player.inside === b.id) drawInterior(ctx, g, b, v);
  } else if (b.kind === 'house') drawHouse(ctx, b, v);
  else drawShop(ctx, b, v);
}

// ---------- Lo que sirve para moverse ----------
function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, g: SharkGame, v: View) {
  if (!visible(v, p.x - 1, p.x + p.w + 1, p.y - 2, p.y + 2)) return;
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), w = p.w * s, t = v.t;
  ctx.lineCap = 'round';
  switch (p.kind) {
    case 'roof': ctx.fillStyle = '#475569'; ctx.fillRect(x, y, w, s * 0.14); break;
    case 'landing': {
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x, y, w, s * 0.12);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.75); ctx.lineTo(x + w, y - s * 0.75);
      for (let i = 0; i <= 5; i++) { ctx.moveTo(x + (w * i) / 5, y); ctx.lineTo(x + (w * i) / 5, y - s * 0.75); }
      ctx.stroke(); break;
    }
    case 'balcony': {
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x, y, w, s * 0.16);
      ctx.strokeStyle = hsl(p.hue, 30, 25); ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x + w, y - s * 0.7);
      for (let i = 0; i <= 6; i++) { ctx.moveTo(x + (w * i) / 6, y); ctx.lineTo(x + (w * i) / 6, y - s * 0.7); }
      ctx.stroke();
      // Una planta en maceta que se sacude.
      if (hash(p.id) < 0.4) { ctx.fillStyle = '#9a3412'; ctx.fillRect(x + w * 0.6, y - s * 0.3, s * 0.25, s * 0.3); ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.ellipse(x + w * 0.6 + s * 0.12 + Math.sin(t * 5 + p.id) * s * 0.05, y - s * 0.42, s * 0.2, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'ac': {
      ctx.fillStyle = '#d1d5db'; ctx.fillRect(x, y, w, s * 0.5);
      ctx.strokeStyle = '#6b7280'; ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.arc(x + w * 0.62, y + s * 0.25, s * 0.17, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + s * 0.25); ctx.lineTo(x + w * 0.62 + Math.cos(t * 9) * s * 0.15, y + s * 0.25 + Math.sin(t * 9) * s * 0.15); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + s * (0.1 + i * 0.1)); ctx.lineTo(x + w * 0.38, y + s * (0.1 + i * 0.1)); ctx.stroke(); }
      const drip = (t * 1.5 + hash(p.id)) % 1; ctx.fillStyle = '#93c5fd'; ctx.fillRect(x + w * 0.2, y + s * (0.5 + drip * 0.8), s * 0.05, s * 0.1);
      break;
    }
    case 'stoop': ctx.fillStyle = '#a8a29e'; ctx.fillRect(x, y, w, s * 0.5); ctx.fillStyle = '#78716c'; ctx.fillRect(x, y, w, s * 0.06); ctx.fillRect(x + w * 0.1, y + s * 0.25, w * 0.8, s * 0.04); break;
    case 'sill': {
      ctx.fillStyle = hsl(p.hue, 35, 30); ctx.fillRect(x, y, w, s * 0.14);
      ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.85, y - s * 0.12); ctx.lineTo(x + w * 0.15, y - s * 0.12); ctx.fill();
      break;
    }
    case 'awning': {
      const wall = g.blocks.find(b => Math.abs(b.x1 - (p.x + p.w)) < 0.05 || Math.abs(b.x2 - p.x) < 0.05);
      const atLeft = wall ? Math.abs(wall.x2 - p.x) < 0.05 : true;
      const hx = atLeft ? x : x + w, ox = atLeft ? x + w : x;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = hx + ((ox - hx) * i) / n, b2 = hx + ((ox - hx) * (i + 1)) / n;
        ctx.fillStyle = i % 2 ? '#fef2f2' : hsl(p.hue, 70, 45);
        ctx.beginPath(); ctx.moveTo(a, y - s * 0.4 * (1 - i / n)); ctx.lineTo(b2, y - s * 0.4 * (1 - (i + 1) / n)); ctx.lineTo(b2, y + s * 0.1); ctx.lineTo(a, y + s * 0.1); ctx.fill();
      }
      ctx.fillStyle = hsl(p.hue, 70, 38);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + (w * (i + 0.5)) / 5, y + s * 0.1, w / 10, 0, Math.PI); ctx.fill(); }
      break;
    }
    case 'tank': {
      ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + s * 0.9); ctx.lineTo(x + w * 0.15, y + s * 1.3); ctx.moveTo(x + w * 0.85, y + s * 0.9); ctx.lineTo(x + w * 0.85, y + s * 1.3); ctx.stroke();
      ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.roundRect(x, y, w, s * 0.9, s * 0.2); ctx.fill();
      ctx.fillStyle = '#374151'; ctx.fillRect(x, y + s * 0.3, w, s * 0.06); ctx.fillRect(x, y + s * 0.6, w, s * 0.06);
      break;
    }
    case 'sign': {
      const b = g.blocks.find(k => k.kind === 'shop' && p.x > k.x1 && p.x < k.x2);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath(); ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.2, Y(v, p.y - 1.5)); ctx.moveTo(x + w * 0.8, y); ctx.lineTo(x + w * 0.8, Y(v, p.y - 1.5)); ctx.stroke();
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x, y, w, s * 0.85);
      ctx.fillStyle = hsl(p.hue, 70, 40); ctx.fillRect(x + s * 0.06, y + s * 0.06, w - s * 0.12, s * 0.73);
      const on = Math.floor(t * 2 + p.id) % 7 !== 0; // el cartel luminoso chisporrotea
      ctx.fillStyle = on ? '#fef9c3' : '#a3a3a3'; ctx.font = font(900, s * 0.42); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b?.label ?? '24 HS', x + w / 2, y + s * 0.43, w - s * 0.2);
      break;
    }
    case 'lamp': drawLamp(ctx, p, v); break;
    case 'car': case 'van': case 'bus': drawVehicle(ctx, p, v); break;
    case 'kiosk': {
      ctx.fillStyle = hsl(p.hue, 55, 45); ctx.fillRect(x + s * 0.1, y, w - s * 0.2, s * 1.8);
      ctx.fillStyle = '#e0f2fe'; ctx.fillRect(x + s * 0.25, y + s * 0.35, w - s * 0.5, s * 0.6);
      ctx.fillStyle = '#f97316'; ctx.fillRect(x + s * 0.3, y + s * 0.7, s * 0.25, s * 0.25); ctx.fillStyle = '#22c55e'; ctx.fillRect(x + s * 0.6, y + s * 0.65, s * 0.2, s * 0.3);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x, y - s * 0.05, w, s * 0.18);
      ctx.fillStyle = '#fef3c7'; ctx.font = font(900, s * 0.24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KIOSCO', x + w / 2, y + s * 0.22, w);
      break;
    }
    case 'stop': {
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath(); ctx.moveTo(x + s * 0.15, y); ctx.lineTo(x + s * 0.15, Y(v, -0.5)); ctx.moveTo(x + w - s * 0.15, y); ctx.lineTo(x + w - s * 0.15, Y(v, -0.5)); ctx.stroke();
      ctx.fillStyle = 'rgba(186,230,253,0.35)'; ctx.fillRect(x + s * 0.2, y + s * 0.15, w - s * 0.4, s * 1.4);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x - s * 0.1, y, w + s * 0.2, s * 0.15);
      ctx.fillStyle = '#facc15'; ctx.fillRect(x + w * 0.35, y + s * 0.3, w * 0.3, s * 0.45);
      ctx.fillStyle = '#1e3a8a'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('152', x + w / 2, y + s * 0.53, w * 0.3);
      break;
    }
    case 'tree': {
      const cx = x + w / 2, sway = Math.sin(t * 2.5 + p.id) * s * 0.12 + windAt(t) * s * 0.2;
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(cx - s * 0.17, y + s * 0.3, s * 0.34, Y(v, -1) - y);
      for (const [dx, dy, r, l] of [[-0.55, 0.25, 0.75, 24], [0.55, 0.25, 0.75, 22], [0, 0, 0.85, 28], [0, 0.45, 0.6, 18]]) {
        ctx.fillStyle = hsl(130, 45, l); ctx.beginPath(); ctx.ellipse(cx + dx * s + sway, y + dy * s, r * s, r * s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'debris': drawDebrisArt(ctx, g.debris.find(d => d.plat === p)!, v); break;
    default: break;
  }
}

function drawClimb(ctx: CanvasRenderingContext2D, c: Climb, v: View) {
  if (c.skin === 'stairs' || !visible(v, c.x - 1, c.x + 1, c.y1, c.y2)) return; // la escalera de adentro va con el departamento
  const s = v.s, x = X(v, c.x), y1 = Y(v, c.y1), y2 = Y(v, c.y2);
  ctx.lineCap = 'round';
  if (c.skin === 'ladder') {
    ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath(); ctx.moveTo(x - s * 0.25, y1); ctx.lineTo(x - s * 0.25, y2); ctx.moveTo(x + s * 0.25, y1); ctx.lineTo(x + s * 0.25, y2);
    for (let y = c.y1 + 0.2; y < c.y2; y += 0.35) { ctx.moveTo(x - s * 0.25, Y(v, y)); ctx.lineTo(x + s * 0.25, Y(v, y)); }
    ctx.stroke();
  } else if (c.skin === 'rope') {
    const sway = Math.sin(v.t * 2 + c.id) * s * 0.08 + windAt(v.t) * s * 0.15;
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.beginPath(); ctx.moveTo(x, y2); ctx.quadraticCurveTo(x + sway, (y1 + y2) / 2, x + sway * 0.5, y1); ctx.stroke();
    ctx.strokeStyle = '#713f12'; ctx.lineWidth = 1;
    for (let y = c.y1 + 0.4; y < c.y2; y += 0.6) { const k = (Y(v, y) - y2) / (y1 - y2); ctx.beginPath(); ctx.moveTo(x - s * 0.06 + sway * k, Y(v, y)); ctx.lineTo(x + s * 0.06 + sway * k, Y(v, y) - s * 0.1); ctx.stroke(); }
    ctx.fillStyle = '#334155'; ctx.fillRect(x - s * 0.5, y2 - s * 0.08, s * 0.6, s * 0.12);
  } else if (c.skin === 'pipe') {
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(2, s * 0.16);
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.fillStyle = '#334155'; for (let y = c.y1 + 0.5; y < c.y2; y += 1.3) ctx.fillRect(x - s * 0.15, Y(v, y), s * 0.3, s * 0.08);
  } else {
    // El poste del farol (el farol, arriba, es donde te parás).
    ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = Math.max(2.5, s * 0.18);
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.fillStyle = '#52525b'; for (let y = c.y1 + 0.6; y < c.y2 - 0.3; y += 0.7) ctx.fillRect(x - s * 0.18, Y(v, y), s * 0.36, s * 0.05); // grampas para trepar
  }
}

function drawZip(ctx: CanvasRenderingContext2D, z: Zip, g: SharkGame, v: View) {
  if (!visible(v, Math.min(z.x1, z.x2), Math.max(z.x1, z.x2), z.y2 - 1, z.y1 + 1)) return;
  const s = v.s;
  ctx.strokeStyle = '#d4d4d8'; ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.beginPath(); ctx.moveTo(X(v, z.x1), Y(v, z.y1)); ctx.lineTo(X(v, z.x2), Y(v, z.y2)); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  for (const [x, y] of [[z.x1, z.y1], [z.x2, z.y2]]) { ctx.fillRect(X(v, x) - s * 0.08, Y(v, y), s * 0.16, (y - (y === z.y1 ? z.y1 - 1.3 : z.y2 - 1.3)) * s); }
  if (g.player.zip !== z) {
    const tx = z.x1 + (z.x2 - z.x1) * 0.04, ty = z.y1 + (z.y2 - z.y1) * 0.04;
    ctx.fillStyle = '#facc15'; ctx.fillRect(X(v, tx) - s * 0.15, Y(v, ty), s * 0.3, s * 0.2);
    ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(X(v, tx), Y(v, ty) + s * 0.2); ctx.lineTo(X(v, tx), Y(v, ty) + s * 0.6); ctx.stroke();
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, v: View) {
  if (d.kind === 'tree' || d.kind === 'palm') { drawTreeDecor(ctx, d, v); return; }
  if (!visible(v, d.x - 1, d.x + 1, -1, 4)) return;
  const s = v.s, x = X(v, d.x), t = v.t;
  ctx.lineCap = 'round';
  if (d.kind === 'light') {
    ctx.strokeStyle = '#27272a'; ctx.lineWidth = Math.max(2, s * 0.1); ctx.beginPath(); ctx.moveTo(x, Y(v, -1)); ctx.lineTo(x, Y(v, 2.6)); ctx.stroke();
    ctx.fillStyle = '#18181b'; ctx.fillRect(x - s * 0.2, Y(v, 3.6), s * 0.4, s * 1);
    const on = Math.floor(t * 1.5) % 2 === 0;
    ctx.fillStyle = on ? '#facc15' : '#713f12'; ctx.beginPath(); ctx.arc(x, Y(v, 3.1), s * 0.12, 0, Math.PI * 2); ctx.fill(); // intermitente amarilla
    ctx.fillStyle = '#450a0a'; ctx.beginPath(); ctx.arc(x, Y(v, 3.4), s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#052e16'; ctx.beginPath(); ctx.arc(x, Y(v, 2.8), s * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (d.kind === 'pare') {
    ctx.strokeStyle = '#71717a'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.beginPath(); ctx.moveTo(x, Y(v, -1)); ctx.lineTo(x, Y(v, 1.6)); ctx.stroke();
    ctx.fillStyle = '#dc2626'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; ctx.lineTo(x + Math.cos(a) * s * 0.4, Y(v, 1.95) + Math.sin(a) * s * 0.4); }
    ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PARE', x, Y(v, 1.95));
  } else if (d.kind === 'subte') {
    ctx.strokeStyle = '#71717a'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.beginPath(); ctx.moveTo(x, Y(v, -1)); ctx.lineTo(x, Y(v, 1.2)); ctx.stroke();
    ctx.fillStyle = '#1d4ed8'; ctx.fillRect(x - s * 0.55, Y(v, 1.8), s * 1.1, s * 0.6);
    ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUBTE', x, Y(v, 1.5), s);
  } else {
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.roundRect(x - s * 0.25, Y(v, 0.35), s * 0.5, s * 1, [s * 0.25, s * 0.25, 0, 0]); ctx.fill();
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(x - s * 0.15, Y(v, 0.15), s * 0.3, s * 0.05);
  }
}

// ---------- Los que hay que rescatar ----------
const SKINS = ['#fcd9b6', '#e0ac69', '#8d5524', '#f1c27d'];
function drawCritter(ctx: CanvasRenderingContext2D, kind: RescueKind, look: number, cx: number, base: number, s: number, t: number, wave = 1) {
  ctx.lineCap = 'round';
  if (kind === 'perro') {
    const fur = ['#92400e', '#d6d3d1', '#1c1917', '#ca8a04'][Math.floor(look * 4)];
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.ellipse(cx, base - s * 0.22, s * 0.3, s * 0.17, 0, 0, Math.PI * 2); ctx.fill(); // cuerpo
    ctx.beginPath(); ctx.arc(cx + s * 0.3, base - s * 0.45, s * 0.16, 0, Math.PI * 2); ctx.fill(); // cabeza
    ctx.beginPath(); ctx.ellipse(cx + s * 0.44, base - s * 0.41, s * 0.09, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); // hocico
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + s * 0.52, base - s * 0.42, s * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + s * 0.33, base - s * 0.5, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look > 0.5 ? '#451a03' : '#78350f'; ctx.beginPath(); ctx.ellipse(cx + s * 0.22, base - s * 0.48, s * 0.06, s * 0.13, 0.4 + Math.sin(t * 6) * 0.2, 0, Math.PI * 2); ctx.fill(); // oreja
    ctx.strokeStyle = fur; ctx.lineWidth = Math.max(1.5, s * 0.06);
    const wag = Math.sin(t * 14) * s * 0.12;
    ctx.beginPath(); ctx.moveTo(cx - s * 0.28, base - s * 0.28); ctx.lineTo(cx - s * 0.45, base - s * 0.45 + wag); ctx.stroke(); // cola que se mueve
    ctx.beginPath(); ctx.moveTo(cx - s * 0.15, base - s * 0.1); ctx.lineTo(cx - s * 0.15, base); ctx.moveTo(cx + s * 0.15, base - s * 0.1); ctx.lineTo(cx + s * 0.15, base); ctx.stroke();
  } else if (kind === 'gato') {
    const fur = ['#f97316', '#6b7280', '#e5e7eb', '#1f2937'][Math.floor(look * 4)];
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.ellipse(cx, base - s * 0.2, s * 0.2, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 0.05, base - s * 0.48, s * 0.15, 0, Math.PI * 2); ctx.fill();
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * (0.05 + d * 0.13), base - s * 0.55); ctx.lineTo(cx + s * (0.05 + d * 0.1), base - s * 0.72); ctx.lineTo(cx + s * (0.05 + d * 0.02), base - s * 0.6); ctx.fill(); }
    ctx.fillStyle = '#a3e635'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * (0.05 + d * 0.06), base - s * 0.5, s * 0.03, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = fur; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.18, base - s * 0.15); ctx.quadraticCurveTo(cx - s * 0.45, base - s * 0.2, cx - s * 0.35 + Math.sin(t * 4) * s * 0.06, base - s * 0.55); ctx.stroke(); // cola parada (asustado)
  } else {
    const skin = SKINS[Math.floor(look * 4)], shirt = hsl(Math.floor(look * 997) % 360, 65, 50);
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(cx - s * 0.17, base - s * 0.55, s * 0.34, s * 0.45, s * 0.08); ctx.fill();
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(cx - s * 0.16, base - s * 0.12, s * 0.32, s * 0.12);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx, base - s * 0.7, s * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ['#3b2412', '#111', '#a16207', '#7c2d12'][Math.floor(look * 7) % 4]; ctx.beginPath(); ctx.arc(cx, base - s * 0.75, s * 0.15, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + s * 0.06, base - s * 0.7, s * 0.025, 0, Math.PI * 2); ctx.fill();
    // Mueve los brazos pidiendo ayuda.
    ctx.strokeStyle = skin; ctx.lineWidth = Math.max(1.5, s * 0.07);
    const a = Math.sin(t * 9) * 0.35 * wave;
    ctx.beginPath(); ctx.moveTo(cx - s * 0.15, base - s * 0.5); ctx.lineTo(cx - s * (0.35 + a * 0.3), base - s * 0.95); ctx.moveTo(cx + s * 0.15, base - s * 0.5); ctx.lineTo(cx + s * (0.35 - a * 0.3), base - s * 0.95); ctx.stroke();
  }
}

function drawFloat(ctx: CanvasRenderingContext2D, r: Rescue, cx: number, base: number, s: number) {
  const w = r.plat.w * s, x = cx - w / 2;
  switch (r.float) {
    case 'goma': ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.ellipse(cx, base + s * 0.05, w / 2, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; for (const d of [-0.3, 0.3]) ctx.fillRect(cx + d * w - s * 0.06, base - s * 0.08, s * 0.12, s * 0.26); break;
    case 'cajon': ctx.fillStyle = '#b45309'; ctx.fillRect(x, base, w, s * 0.35); ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1; ctx.strokeRect(x, base, w, s * 0.35); ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w, base + s * 0.35); ctx.stroke(); break;
    case 'puerta': ctx.fillStyle = hsl(r.plat.hue, 35, 50); ctx.fillRect(x, base, w, s * 0.16); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x + w * 0.85, base + s * 0.08, s * 0.04, 0, Math.PI * 2); ctx.fill(); break;
    case 'colchon': ctx.fillStyle = '#fbcfe8'; ctx.beginPath(); ctx.roundRect(x, base, w, s * 0.26, s * 0.1); ctx.fill(); ctx.fillStyle = '#db2777'; for (let i = 1; i < 6; i++) ctx.fillRect(x + (w * i) / 6, base, s * 0.035, s * 0.26); break;
    case 'balsa': ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.roundRect(x, base - s * 0.05, w, s * 0.3, s * 0.14); ctx.fill(); ctx.fillStyle = '#ca8a04'; ctx.fillRect(x + s * 0.1, base + s * 0.08, w - s * 0.2, s * 0.05); break;
  }
}

function drawRescue(ctx: CanvasRenderingContext2D, r: Rescue, g: SharkGame, v: View) {
  const s = v.s, t = v.t;
  if (r.state === 'drift') {
    const cx = X(v, rescueX(r)), base = Y(v, FLOAT_Y) + Math.sin(t * 2.4 + r.id) * s * 0.05;
    if (cx < -60 || cx > v.w + 60) return;
    drawFloat(ctx, r, cx, base, s);
    drawCritter(ctx, r.kind, r.look, cx, base, s * 0.95, t + r.id);
    // Si un tiburón lo está buscando, se asusta (signo de exclamación).
    if (g.sharks.some(k => k.target === r.id && (k.state === 'approach' || k.state === 'warn'))) {
      ctx.fillStyle = '#ef4444'; ctx.font = font(900, s * 0.5); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('!', cx, base - s * 0.9);
    }
    return;
  }
  const age = g.time - r.at;
  if (r.state === 'saved' && age < 1) {
    // Salta a los brazos del bombero y sube un "+1".
    const k = Math.min(1, age / 0.5), px = r.fromX + (g.player.x - r.fromX) * k, py = r.fromY + (g.player.y + 0.6 - r.fromY) * k + Math.sin(k * Math.PI) * 1.2;
    if (age < 0.5) drawCritter(ctx, r.kind, r.look, X(v, px), Y(v, py), s * 0.95 * (1 - k * 0.4), t, 0);
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = '#4ade80'; ctx.font = font(900, s * 0.7); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(r.kind === 'perro' ? '+1 🐶' : r.kind === 'gato' ? '+1 🐱' : '+1 🙋', X(v, g.player.x), Y(v, g.player.y + 1.4 + age * 1.5));
    ctx.globalAlpha = 1;
  } else if (r.state === 'taken' && age < 1.4) {
    // Se lo lleva el tiburón: se hunde con burbujas.
    const cx = X(v, r.fromX), base = Y(v, FLOAT_Y - Math.min(1.2, age * 1.2));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, v.w, Y(v, 0)); ctx.clip();
    drawCritter(ctx, r.kind, r.look, cx, base, s * 0.95, t, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + (hash(i + r.id) - 0.5) * s, Y(v, (age * 2 + hash(i)) % 1 * 0.6), s * 0.06, 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- Tiburones ----------
// Los tiburones son las imágenes de referencia (ver sharkSprites.ts). Dónde está la aleta de arriba, desde el
// centro y en largos del tiburón (para la espuma y la estela donde corta el agua).
const FIN_X: Record<SharkType, number> = { blanco: 0, ballena: -0.1, martillo: -0.06 };
const drawShark = (ctx: CanvasRenderingContext2D, k: Shark, x: number, y: number, s: number, angle: number, dir: 1 | -1, opts?: SpriteOptions) =>
  drawSharkSprite(ctx, k.type, x, y, sharkLen(k) * s, angle, dir, opts);

// Dibuja el tiburón cortado por la superficie: arriba del agua se ve entero y abajo, apagado.
function drawSharkCut(ctx: CanvasRenderingContext2D, k: Shark, v: View, under: number) {
  const { dir, a } = sharkPose(k), angle = -a * dir, x = X(v, k.x), y = Y(v, k.y), surface = Y(v, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, v.w + 100, surface + 50); ctx.clip();
  drawShark(ctx, k, x, y, v.s, angle, dir);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = under; ctx.beginPath(); ctx.rect(-50, surface, v.w + 100, v.h); ctx.clip();
  drawShark(ctx, k, x, y, v.s, angle, dir);
  ctx.restore();
}

// Cómo va nadando: el cuerpo ondula (más rápido cuando persigue), sube y baja despacio y, antes de saltar,
// se hunde con la trompa para arriba.
function swimPose(k: Shark, v: View) {
  const spec = SHARKS[k.type], L = sharkLen(k), t = v.t;
  const warn = k.state === 'warn' ? Math.max(0, Math.min(1, 1 - k.t / spec.warn)) : 0;
  const fast = k.state === 'chase' || k.state === 'approach';
  const slow = k.type === 'ballena' ? 0.55 : 1;
  const y = k.y + Math.sin(t * 1.3 + k.id) * 0.035 * L * (1 - warn) - warn * 0.25 * L;
  const angle = (Math.sin(t * 1.3 + k.id + 1.2) * 0.03 - warn * 0.32) * k.dir;
  return { x: X(v, k.x), y: Y(v, y), angle, warn, fast, opts: { wave: t * (fast ? 10 : 5.5) * slow + k.id, amp: fast ? 0.045 : 0.03 } };
}
const swimming = (k: Shark) => k.state !== 'jump' && k.state !== 'bite';

// Lo que está debajo del agua: el cuerpo, apagado por el agua.
function drawSharkUnder(ctx: CanvasRenderingContext2D, k: Shark, v: View) {
  const L = sharkLen(k);
  if (!swimming(k) || !visible(v, k.x - L, k.x + L, -3, 1)) return;
  const p = swimPose(k, v), half = L * v.s * 0.6;
  ctx.save(); surfaceClip(ctx, v, p.x - half, p.x + half, false);
  ctx.globalAlpha = 0.5; drawShark(ctx, k, p.x, p.y, v.s, p.angle, k.dir, p.opts);
  ctx.restore();
}
// Lo que asoma: la aleta de arriba (la de la imagen), con espuma donde corta el agua y la estela detrás.
function drawFin(ctx: CanvasRenderingContext2D, k: Shark, v: View) {
  const L = sharkLen(k);
  if (!swimming(k) || !visible(v, k.x - L, k.x + L, -1, 3)) return;
  const p = swimPose(k, v), s = v.s, t = v.t, d = k.dir, half = L * s * 0.6;
  const fx = p.x + d * FIN_X[k.type] * L * s, wy = Y(v, waveY(k.x, t)), fw = 0.18 * L * s;
  // Estela en V detrás de la aleta.
  if (!p.warn) {
    const len = s * L * (p.fast ? 0.9 : 0.5);
    ctx.strokeStyle = 'rgba(226,232,240,0.6)'; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.moveTo(fx + d * fw * 0.5, wy); ctx.lineTo(fx - d * len, wy - s * 0.14); ctx.moveTo(fx + d * fw * 0.5, wy + s * 0.03); ctx.lineTo(fx - d * len, wy + s * 0.17); ctx.stroke();
  }
  ctx.save(); surfaceClip(ctx, v, p.x - half, p.x + half, true);
  drawShark(ctx, k, p.x, p.y, s, p.angle, d, p.opts);
  ctx.restore();
  // La espuma alrededor de la aleta (salta más cuando va rápido).
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(fx, wy, fw * (0.7 + Math.sin(t * 9 + k.id) * 0.08), s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  if (p.fast) for (let i = 0; i < 5; i++) { const q = (t * 3 + i / 5) % 1; ctx.beginPath(); ctx.arc(fx + d * fw * (0.5 - q * 0.6), wy - s * 0.25 * Math.sin(q * Math.PI), s * 0.04, 0, Math.PI * 2); ctx.fill(); }
  // El aviso: se frena, se hunde y salen burbujas.
  if (p.warn) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 3, r = s * L * (0.12 + p.warn * 0.2 + ((t * 2 + i * 0.3) % 1) * 0.08);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 - p.warn * 0.3})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(v, k.x) + Math.cos(a) * r, wy - Math.abs(Math.sin(a)) * s * 0.15 - ((t * 3 + i) % 1) * s * 0.3, s * 0.07, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
// Espuma revuelta donde el cuerpo corta la superficie (las salpicaduras grandes son efectos, ver sharkArt.ts).
function churn(ctx: CanvasRenderingContext2D, v: View, x: number, size: number, seed: number) {
  for (let i = 0; i < 14; i++) {
    const q = (v.t * 2.5 + hash(i + seed)) % 1, a = Math.PI + hash(i * 3 + seed) * Math.PI, r = v.s * size * (0.2 + q * 0.6);
    ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - q)})`;
    ctx.beginPath(); ctx.arc(X(v, x) + Math.cos(a) * r, Y(v, 0) + Math.sin(a) * r * 0.5, v.s * (0.05 + hash(i) * 0.08), 0, Math.PI * 2); ctx.fill();
  }
}
function drawSharkJump(ctx: CanvasRenderingContext2D, k: Shark, v: View) {
  const L = sharkLen(k);
  if ((k.state !== 'jump' && k.state !== 'bite') || !visible(v, k.x - L, k.x + L, -3, 6)) return;
  drawSharkCut(ctx, k, v, 0.45);
  if (Math.abs(k.y) < 0.25 * L + 0.3) churn(ctx, v, k.x, L * 0.35, k.id);
}

// ---------- El agua ----------
function drawWater(ctx: CanvasRenderingContext2D, g: SharkGame, v: View, flash: number) {
  const s = v.s, t = v.t;
  const x0 = v.cx - 1, x1 = v.cx + v.w / s + 1;
  ctx.beginPath();
  ctx.moveTo(X(v, x0), v.h);
  for (let x = x0; x <= x1; x += 0.25) ctx.lineTo(X(v, x), Y(v, waveY(x, t)));
  ctx.lineTo(X(v, x1), v.h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, Y(v, 0), 0, Y(v, -6));
  grad.addColorStop(0, `rgba(${30 + flash * 60},${88 + flash * 60},${96 + flash * 60},0.78)`); grad.addColorStop(1, 'rgba(6,24,32,0.96)');
  ctx.fillStyle = grad; ctx.fill();
  // Línea de la superficie y reflejos.
  ctx.strokeStyle = 'rgba(186,230,253,0.55)'; ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath(); for (let x = x0; x <= x1; x += 0.25) { const fn = x === x0 ? 'moveTo' : 'lineTo'; ctx[fn](X(v, x), Y(v, waveY(x, t))); } ctx.stroke();
  // La corriente: rayitas que se mueven.
  ctx.strokeStyle = 'rgba(203,213,225,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const span = x1 - x0 + 4, xx = x0 + ((hash(i) * span + t * (0.8 + hash(i + 7) * 0.6)) % span), yy = -0.15 - hash(i + 3) * 1.2;
    ctx.beginPath(); ctx.moveTo(X(v, xx), Y(v, yy)); ctx.lineTo(X(v, xx + 0.6), Y(v, yy)); ctx.stroke();
  }
  // Gotas de lluvia que pican el agua.
  ctx.strokeStyle = 'rgba(226,232,240,0.45)';
  for (let i = 0; i < 30; i++) {
    const life = (t * 1.6 + hash(i + 40)) % 1, xx = x0 + hash(i * 3 + Math.floor(t * 1.6 + hash(i + 40))) * (x1 - x0);
    ctx.beginPath(); ctx.ellipse(X(v, xx), Y(v, waveY(xx, t)), s * 0.25 * life, s * 0.06 * life, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Espuma alrededor de lo que asoma.
  ctx.fillStyle = 'rgba(241,245,249,0.6)';
  for (const p of g.plats) {
    if (p.y > 2.5 || p.kind === 'roof' || p.kind === 'lamp' || !visible(v, p.x, p.x + p.w, -1, 1)) continue;
    if (!['car', 'van', 'bus', 'kiosk', 'stop', 'stoop', 'debris', 'float'].includes(p.kind)) continue;
    for (const ex of [p.x, p.x + p.w]) { ctx.beginPath(); ctx.ellipse(X(v, ex), Y(v, waveY(ex, t)), s * (0.2 + Math.sin(t * 5 + ex) * 0.05), s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const b of g.blocks) for (const ex of [b.x1, b.x2]) { if (!visible(v, ex - 1, ex + 1, -1, 1)) continue; ctx.beginPath(); ctx.ellipse(X(v, ex), Y(v, waveY(ex, t)), s * 0.3, s * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
}

// ---------- El bombero ----------
function drawFirefighter(ctx: CanvasRenderingContext2D, g: SharkGame, v: View, shrink = 1) {
  const p = g.player, s = v.s, t = v.t;
  ctx.save();
  if (shrink !== 1) { const cx = X(v, p.x), cy = Y(v, p.y + PLAYER_H / 2); ctx.translate(cx, cy); ctx.scale(shrink, shrink); ctx.translate(-cx, -cy); }
  if (Math.abs(p.fling) > 3 && !p.ground && !p.swimming) { const cx = X(v, p.x), cy = Y(v, p.y + PLAYER_H / 2); ctx.translate(cx, cy); ctx.rotate(t * 13 * Math.sign(p.fling)); ctx.translate(-cx, -cy); } // da vueltas por el aire
  const pw = PLAYER_W * s, ph = PLAYER_H * s;
  const px = X(v, p.x) - pw / 2, py = Y(v, p.y) - ph;
  const f = p.facing, climbing = !!p.climb || !!p.zip, airborne = !p.ground && !climbing && !p.swimming, falling = !!g.dying;
  const running = p.vx !== 0 && !!p.ground;
  const swing = running || climbing || p.swimming ? Math.sin(t * (climbing ? 12 : p.swimming ? 8 : 22)) : 0;
  const COAT = '#1f2937', STRIPE = '#d9f99d', SKIN = '#fcd9b6';
  // Colgado de la tirolesa: la roldana corre por el cable, con las correas hasta la barra que agarra.
  const barY = Y(v, p.y + PLAYER_H + 0.12);
  if (p.zip) {
    const z = p.zip, cableY = Y(v, z.y1 + ((z.y2 - z.y1) * (p.x - z.x1)) / (z.x2 - z.x1)), cx = X(v, p.x);
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.08, cableY + s * 0.12); ctx.lineTo(cx - s * 0.2, barY); ctx.moveTo(cx + s * 0.08, cableY + s * 0.12); ctx.lineTo(cx + s * 0.2, barY); ctx.stroke();
    ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.beginPath(); ctx.moveTo(cx - s * 0.28, barY); ctx.lineTo(cx + s * 0.28, barY); ctx.stroke();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.roundRect(cx - s * 0.2, cableY + s * 0.02, s * 0.4, s * 0.14, s * 0.04); ctx.fill();
    ctx.fillStyle = '#374151'; for (const dx of [-0.11, 0.11]) { ctx.beginPath(); ctx.arc(cx + dx * s, cableY, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
    if (p.zipT > 0.3) { ctx.fillStyle = '#fde047'; for (let i = 0; i < 4; i++) { const q = (t * 7 + i * 0.25) % 1; ctx.beginPath(); ctx.arc(cx - f * s * (0.15 + q * 0.5), cableY + s * q * 0.3, s * 0.025, 0, Math.PI * 2); ctx.fill(); } } // chispas
  }
  ctx.lineCap = 'round';
  const arm = (side: 1 | -1, phase: number) => {
    const sx = px + pw / 2 + side * pw * 0.32, sy = py + ph * 0.44;
    let hx = sx + side * pw * 0.2 + phase * pw * 0.18, hy = airborne ? sy - ph * 0.18 : sy + ph * 0.24;
    if (climbing) { hx = px + pw / 2 + side * pw * 0.12; hy = py + ph * (0.0 + 0.08 * phase * side); }
    if (p.zip) { hx = px + pw / 2 + side * pw * 0.28; hy = barY; }
    if (p.swimming) { hx = sx + side * pw * 0.45 + phase * pw * 0.2; hy = sy - ph * 0.05 + phase * ph * 0.08; }
    if (falling) { hx = sx + side * pw * 0.5; hy = sy - ph * 0.35; }
    ctx.strokeStyle = COAT; ctx.lineWidth = Math.max(2.5, pw * 0.2);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = STRIPE; ctx.lineWidth = Math.max(1, pw * 0.06);
    ctx.beginPath(); ctx.moveTo(sx + (hx - sx) * 0.55 - pw * 0.08, sy + (hy - sy) * 0.55); ctx.lineTo(sx + (hx - sx) * 0.55 + pw * 0.08, sy + (hy - sy) * 0.55); ctx.stroke();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.8, pw * 0.11), 0, Math.PI * 2); ctx.fill(); // guante
  };
  arm(-f as 1 | -1, -swing);
  // Piernas con botas negras.
  const dangle = p.zip ? -f * pw * 0.25 * Math.min(1, p.zipT * 2) + Math.sin(t * 5) * pw * 0.06 : 0; // las piernas cuelgan para atrás
  const legSwing = p.zip ? 0 : swing;
  const footL = px + pw * 0.38 + legSwing * pw * 0.22 + dangle, footR = px + pw * 0.62 - legSwing * pw * 0.22 + dangle;
  ctx.strokeStyle = COAT; ctx.lineWidth = Math.max(3, pw * 0.22);
  ctx.beginPath(); ctx.moveTo(px + pw * 0.38, py + ph * 0.7); ctx.lineTo(footL, py + ph * 0.94); ctx.moveTo(px + pw * 0.62, py + ph * 0.7); ctx.lineTo(footR, py + ph * 0.94); ctx.stroke();
  ctx.strokeStyle = STRIPE; ctx.lineWidth = Math.max(1, pw * 0.06);
  ctx.beginPath(); for (const fx of [footL, footR]) { ctx.moveTo(fx - pw * 0.1, py + ph * 0.84); ctx.lineTo(fx + pw * 0.1, py + ph * 0.84); } ctx.stroke();
  ctx.fillStyle = '#0a0a0a';
  for (const fx of [footL, footR]) { ctx.beginPath(); ctx.roundRect(fx - pw * 0.12 + f * pw * 0.03, py + ph * 0.88, pw * 0.26, ph * 0.1, pw * 0.04); ctx.fill(); }
  // Saco de bombero con franjas reflectivas.
  const tx = px + pw * 0.18, ty = py + ph * 0.36, tw = pw * 0.64, th = ph * 0.42;
  ctx.fillStyle = COAT; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, pw * 0.12); ctx.fill();
  ctx.fillStyle = STRIPE; ctx.fillRect(tx, ty + th * 0.55, tw, th * 0.12); ctx.fillRect(tx, ty + th * 0.85, tw, th * 0.1);
  ctx.fillStyle = '#9ca3af'; ctx.fillRect(tx, ty + th * 0.6, tw, th * 0.03);
  // Cara: el ojo, la nariz y el bigote quedan del lado para el que mira (el mismo de la visera del casco).
  const hx = px + pw / 2, hy = py + ph * 0.22, r = pw * 0.3;
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(hx, hy + r * 0.12, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eab38a'; ctx.beginPath(); ctx.arc(hx - f * r * 0.42, hy + r * 0.25, r * 0.2, 0, Math.PI * 2); ctx.fill(); // oreja, atrás
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(hx + f * r * 1.0, hy + r * 0.4, r * 0.28, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); // nariz
  ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.ellipse(hx + f * r * 0.62, hy + r * 0.72, r * 0.4, r * 0.14, f * 0.15, 0, Math.PI * 2); ctx.fill(); // bigote
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + f * r * 0.55, hy + r * 0.15, Math.max(1.3, r * 0.16), 0, Math.PI * 2); ctx.fill(); // ojo
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + f * r * 0.6, hy + r * 0.1, Math.max(0.5, r * 0.05), 0, Math.PI * 2); ctx.fill();
  // Casco rojo: la visera larga sale para adelante (para donde mira) y atrás tiene una cortita.
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(hx, hy - r * 0.18, r * 1.05, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx - f * r * 0.7, hy - r * 0.22); ctx.lineTo(hx + f * r * 0.95, hy - r * 0.22);
  ctx.quadraticCurveTo(hx + f * r * 1.55, hy - r * 0.18, hx + f * r * 1.8, hy + r * 0.02); // la punta de la visera
  ctx.quadraticCurveTo(hx + f * r * 1.25, hy - r * 0.02, hx + f * r * 0.7, hy - r * 0.06);
  ctx.lineTo(hx - f * r * 0.7, hy - r * 0.06); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - f * r * 0.95, hy - r * 0.12, r * 0.4, r * 0.11, -f * 0.15, 0, Math.PI * 2); ctx.fill(); // atrás, cortita
  ctx.fillStyle = '#991b1b'; ctx.fillRect(hx - r * 0.08, hy - r * 1.28, r * 0.16, r * 1.08); // cresta
  ctx.fillRect(hx - r * 1.02, hy - r * 0.3, r * 2.04, r * 0.09); // la banda de abajo
  ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(hx + f * r * 0.35, hy - r * 0.95); ctx.lineTo(hx + f * r * 0.85, hy - r * 0.8); ctx.lineTo(hx + f * r * 0.8, hy - r * 0.35); ctx.lineTo(hx + f * r * 0.3, hy - r * 0.38); ctx.fill(); // escudo, adelante
  arm(f, swing);
  ctx.restore();
}

// Nadando, lo que está debajo del agua se ve apagado (sin ningún recuadro).
function drawPlayer(ctx: CanvasRenderingContext2D, g: SharkGame, v: View, shrink = 1) {
  if (!g.player.swimming) { drawFirefighter(ctx, g, v, shrink); return; }
  const x = X(v, g.player.x), half = v.s * 1.4;
  ctx.save(); surfaceClip(ctx, v, x - half, x + half, true); drawFirefighter(ctx, g, v, shrink); ctx.restore();
  ctx.save(); surfaceClip(ctx, v, x - half, x + half, false); ctx.globalAlpha = 0.35; drawFirefighter(ctx, g, v, shrink); ctx.restore();
}

// El súper viento: antes de que llegue, empiezan a volar hojas y papeles desde un costado; cuando sopla,
// cruzan la pantalla rachas larguísimas y vuela de todo (diarios, hojas, una tapa de tacho, un paraguas, una
// silla de plástico, un cartel).
function drawGale(ctx: CanvasRenderingContext2D, g: SharkGame, v: View) {
  const t = g.time, { warnAt, start, end, dir } = g.gale, s = v.s;
  const warn = t >= warnAt && t < start ? (t - warnAt) / (start - warnAt) : 0, gale = Math.abs(scene.gale);
  if (!warn && !gale) return;
  const power = gale || warn * 0.35;
  ctx.lineCap = 'round';
  for (let i = 0; i < Math.round(60 * power); i++) {
    const k = (t * (2.2 + hash(i) * 2) + hash(i + 9)) % 1, len = v.w * (0.15 + hash(i * 3) * 0.35);
    const x = dir > 0 ? k * (v.w + len * 2) - len : v.w + len - k * (v.w + len * 2), y = hash(i + 40) * v.h;
    ctx.strokeStyle = `rgba(241,245,249,${0.15 + hash(i * 7) * 0.3})`; ctx.lineWidth = 1 + hash(i * 5) * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - dir * len * 0.3, y - 8, x - dir * len * 0.6, y + 8, x - dir * len, y); ctx.stroke();
  }
  const junk = ['paper', 'leaf', 'lid', 'umbrella', 'chair', 'sign', 'paper', 'leaf', 'paper', 'leaf'] as const;
  for (let i = 0; i < Math.round(junk.length * (gale ? 1.6 : warn)); i++) {
    const kind = junk[i % junk.length], k = (t * (0.9 + hash(i * 3) * 0.8) + hash(i)) % 1;
    const x = dir > 0 ? k * (v.w + 200) - 100 : v.w + 100 - k * (v.w + 200), y = v.h * (0.1 + hash(i + 70) * 0.7) + Math.sin(t * 5 + i) * 30;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * (6 + hash(i) * 8) * dir + i);
    switch (kind) {
      case 'paper': ctx.fillStyle = '#f8fafc'; ctx.fillRect(-s * 0.2, -s * 0.15, s * 0.4, s * 0.3); ctx.fillStyle = '#94a3b8'; ctx.fillRect(-s * 0.15, -s * 0.08, s * 0.3, s * 0.03); break;
      case 'leaf': ctx.fillStyle = i % 2 ? '#65a30d' : '#ca8a04'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.18, s * 0.08, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'lid': ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#374151'; ctx.fillRect(-s * 0.08, -s * 0.18, s * 0.16, s * 0.08); break;
      case 'umbrella': ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.6); ctx.arc(s * 0.1, s * 0.6, s * 0.1, Math.PI, 0, true); ctx.stroke(); break;
      case 'chair': ctx.fillStyle = '#f8fafc'; ctx.fillRect(-s * 0.3, 0, s * 0.6, s * 0.08); ctx.fillRect(-s * 0.3, -s * 0.5, s * 0.08, s * 0.5); ctx.fillRect(-s * 0.3, 0, s * 0.06, s * 0.4); ctx.fillRect(s * 0.24, 0, s * 0.06, s * 0.4); break;
      default: ctx.fillStyle = '#facc15'; ctx.fillRect(-s * 0.35, -s * 0.25, s * 0.7, s * 0.5); ctx.fillStyle = '#1f2937'; ctx.font = font(900, s * 0.18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PARE', 0, 0);
    }
    ctx.restore();
  }
  // Una sombra de tormenta que viene del costado.
  const edge = ctx.createLinearGradient(dir > 0 ? 0 : v.w, 0, dir > 0 ? v.w * 0.6 : v.w * 0.4, 0);
  edge.addColorStop(0, `rgba(15,23,42,${0.5 * power})`); edge.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, v.w, v.h);
  void end;
}

function drawRain(ctx: CanvasRenderingContext2D, v: View) {
  const wind = windAt(v.t) + scene.gale * 3, slant = 0.35 + wind * 0.8;
  ctx.strokeStyle = 'rgba(203,213,225,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 140; i++) {
    const sp = 0.9 + hash(i + 3) * 0.5, life = (v.t * sp * 1.4 + hash(i)) % 1;
    const x = ((hash(i + 7) * (v.w + 200) + life * v.h * slant) % (v.w + 200)) - 100, y = life * (v.h + 40) - 20, len = v.s * (0.45 + hash(i + 1) * 0.3);
    ctx.moveTo(x, y); ctx.lineTo(x + len * slant, y + len);
  }
  ctx.stroke();
  // Ráfagas: líneas de viento y hojas o papeles volando.
  if (Math.abs(wind) > 0.15) {
    ctx.strokeStyle = `rgba(241,245,249,${0.4 * Math.abs(wind)})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.round(14 * Math.abs(wind)); i++) {
      const k = (v.t * 1.4 + hash(i + 50)) % 1, x = wind > 0 ? k * (v.w + 200) - 100 : v.w + 100 - k * (v.w + 200), y = hash(i + 60) * v.h * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - wind * 40, y - 6, x - wind * 80, y + 6, x - wind * 120, y); ctx.stroke();
      if (i < 5) { ctx.fillStyle = i % 2 ? '#fef3c7' : '#65a30d'; ctx.save(); ctx.translate(x + wind * 20, y + Math.sin(v.t * 8 + i) * 10); ctx.rotate(v.t * 6 + i); ctx.fillRect(-v.s * 0.15, -v.s * 0.1, v.s * 0.3, v.s * 0.2); ctx.restore(); }
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, g: SharkGame, v: View) {
  const flash = lightning(v.t);
  scene.gale = g.dying ? 0 : galeAt(g);
  ctx.save();
  if (scene.gale) ctx.translate((Math.random() - 0.5) * 9 * Math.abs(scene.gale), (Math.random() - 0.5) * 6 * Math.abs(scene.gale)); // tiembla todo
  drawSky(ctx, v, flash);
  drawSkyline(ctx, v, flash.a);
  drawBolt(ctx, v, flash);
  for (const b of g.blocks) drawBlock(ctx, g, b, v, flash.a);
  for (const d of g.decor) drawDecor(ctx, d, v);
  for (const c of g.climbs) drawClimb(ctx, c, v);
  for (const p of g.plats) if (p.kind !== 'debris' && p.kind !== 'float') drawPlat(ctx, p, g, v);
  for (const z of g.zips) drawZip(ctx, z, g, v);
  drawWater(ctx, g, v, flash.a);
  drawFx(ctx, g, v, 'water');
  for (const k of g.sharks) drawSharkUnder(ctx, k, v);
  for (const d of g.debris) if (visible(v, d.plat.x - 1, d.plat.x + d.plat.w + 1, -2, 2)) drawDebrisArt(ctx, d, v);
  for (const r of g.rescues) drawRescue(ctx, r, g, v);
  for (const k of g.sharks) drawFin(ctx, k, v);
  // Cuando lo alcanza un tiburón, el bombero queda dentro de la boca abierta, se achica y desaparece: se lo
  // tragó entero.
  const eaten = g.dying?.reason === 'shark' ? g.dying : null;
  if (!eaten) drawPlayer(ctx, g, v);
  else if (eaten.t < CHOMP) drawFirefighter(ctx, g, v, 1 - (eaten.t / CHOMP) * 0.4);
  for (const k of g.sharks) drawSharkJump(ctx, k, v);
  drawFx(ctx, g, v, 'air');
  if (eaten && eaten.t < CHOMP) {
    // Vuelve a dibujar al bombero adentro de la boca y la mandíbula de abajo por encima: queda entre los dientes.
    const k = g.sharks.find(s => s.id === eaten.shark);
    if (k) {
      drawFirefighter(ctx, g, v, 1 - (eaten.t / CHOMP) * 0.4);
      const { dir, a } = sharkPose(k);
      drawShark(ctx, k, X(v, k.x), Y(v, k.y), v.s, -a * dir, dir, { jawOnly: true });
    }
  }
  drawRain(ctx, v);
  drawGale(ctx, g, v);
  ctx.restore();
  if (flash.a > 0.05) { ctx.fillStyle = `rgba(220,230,255,${flash.a * 0.25})`; ctx.fillRect(0, 0, v.w, v.h); }
  // Borde rojo si un tiburón te está por saltar o si queda poco tiempo.
  const danger = g.sharks.some(k => k.target === PLAYER_TARGET && (k.state === 'warn' || k.state === 'chase'));
  const hurry = timeLeft(g) < 30;
  if (!g.dying && (danger || hurry)) {
    const a = (danger ? 0.55 : 0.3) * (0.6 + 0.4 * Math.sin(v.t * 10));
    const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
    vg.addColorStop(0, 'rgba(220,38,38,0)'); vg.addColorStop(1, `rgba(220,38,38,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
  }
}

const LOSE_TEXT: Record<LoseReason, string> = { shark: '¡Te comió un tiburón!', time: '¡Se terminó el tiempo!' };
const KIND_TEXT: Record<RescueKind, string> = { perro: 'un perrito 🐶', gato: 'un gato 🐱', persona: 'una persona 🙋' };
const NO_INPUT: Input = { left: false, right: false, jump: false, down: false, up: false };

// Se ven unas 13 unidades de alto (el agua y unos cuantos pisos) y, en pantallas paradas, unas 9,5 de ancho.
function scaleFor(w: number, h: number) { return Math.min(h / 13, w / (h > w ? 9.5 : 18)); }

export function SharkCity() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SharkGame>(newShark());
  useEffect(() => { loadSharkSprites(); }, []);
  const cam = useRef({ x: 0, y: 0 });
  const input = useRef<Input>({ ...NO_INPUT });
  const zipToldRef = useRef(false);
  const enterToldRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ left: TIME_LIMIT, saved: 0, sharks: 5, perro: 0, gato: 0, persona: 0 });
  const [record, setRecord] = useState(readSharkRecord);
  const [result, setResult] = useState({ saved: 0, time: 0, reason: 'shark' as LoseReason, newRecord: false });
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

  // La cámara sigue al bombero, con el agua siempre a la vista abajo.
  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const s = scaleFor(stage.clientWidth, stage.clientHeight);
    const vw = stage.clientWidth / s, vh = stage.clientHeight / s;
    const tx = Math.max(-1, Math.min(g.width - vw + 1, g.player.x - vw / 2));
    const ty = Math.max(-2.6, g.player.y - vh * 0.5); // el bombero a media altura: abajo siempre se ve el agua
    const k = dt < 0 ? 1 : Math.min(1, dt * 5);
    cam.current.x += (tx - cam.current.x) * k;
    cam.current.y += (ty - cam.current.y) * k;
  }, []);

  const start = useCallback(() => {
    gameRef.current = newShark();
    follow(-1);
    input.current = { ...NO_INPUT };
    zipToldRef.current = false;
    enterToldRef.current = false;
    setHud({ left: TIME_LIMIT, saved: 0, sharks: gameRef.current.sharks.length, perro: 0, gato: 0, persona: 0 });
    setToast({ text: `¡Rescatá ${GOAL} antes de que se termine el tiempo! 🚒`, id: Date.now() });
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
      for (const e of takeEvents(g)) {
        if (e.type === 'saved') setToast({ text: e.count === GOAL - 5 ? '¡Te faltan 5!' : `¡Rescataste a ${KIND_TEXT[e.kind]}! (${e.count}/${GOAL})`, id: now, big: e.count === GOAL - 5 });
        if (e.type === 'taken') setToast({ text: `¡Un tiburón se llevó a ${KIND_TEXT[e.kind]}! 😱`, id: now });
        if (e.type === 'newType') setToast({ text: `¡Cuidado: llegó el ${SHARKS[e.shark].name}! 🦈`, id: now });
        if (e.type === 'more') setToast({ text: `¡Ya hay ${e.count} tiburones! 🦈`, id: now });
        if (e.type === 'wind') setToast({ text: e.dir > 0 ? '¡Ráfaga de viento! 💨 →' : '← 💨 ¡Ráfaga de viento!', id: now });
        if (e.type === 'hurry') setToast({ text: e.left === 60 ? '¡Queda 1 minuto!' : '¡Quedan 30 segundos!', id: now, big: true });
        if (e.type === 'galeWarn') setToast({ text: `⚠️ ¡Se viene un SÚPER VIENTO ${e.dir > 0 ? '→' : '←'}! ¡Metete en un edificio!`, id: now, big: true });
        if (e.type === 'gale') setToast({ text: e.dir > 0 ? '🌪️ ¡SÚPER VIENTO! →→→' : '←←← ¡SÚPER VIENTO! 🌪️', id: now, big: true });
        if (e.type === 'enter' && !enterToldRef.current) { enterToldRef.current = true; setToast({ text: '¡Entraste a un departamento! Acá los tiburones no te ven 🏠 (por la escalera llegás a la terraza)', id: now }); }
        if (e.type === 'zip' && !zipToldRef.current) { zipToldRef.current = true; setToast({ text: '¡Tirolesa! Con ↓ te soltás 🪢', id: now }); }
        if (e.type === 'lose') setToast({ text: LOSE_TEXT[e.reason], id: now });
      }
      follow(dt);
      paint();
      const kinds = { perro: 0, gato: 0, persona: 0 };
      for (const k of g.savedKinds) kinds[k]++;
      const shown = { left: Math.ceil(timeLeft(g)), saved: g.saved, sharks: g.sharks.length, ...kinds };
      setHud(p => p.left === shown.left && p.saved === shown.saved && p.sharks === shown.sharks ? p : shown); // los tipos cambian solo cuando cambia saved
      if (g.over || g.won) {
        const rec = readSharkRecord();
        const next: SharkRecord = { saved: Math.max(rec.saved, g.saved), time: g.won ? Math.min(rec.time ?? Infinity, g.time) : rec.time };
        const isNew = g.saved > rec.saved || (g.won && (rec.time === null || g.time < rec.time));
        saveRecord(next); setRecord(next);
        setResult({ saved: g.saved, time: g.time, reason: g.dying?.reason ?? 'shark', newRecord: isNew && (rec.saved > 0 || g.won) });
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
    // ↑ (o W) trepa escaleras, sogas, caños, postes y tirolesas y, si no hay ninguna cerca, salta; Espacio solo salta.
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

  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / GOAL) * 100))}%`;

  return <section className="runner trepa tib" aria-label="Ciudad Tiburón">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Ciudad Tiburón</h1>
      <div className="runner-scores"><span>Récord <strong>{record.time !== null ? `🏆 ${formatSharkTime(record.time)}` : `${record.saved} 🛟`}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label="Ciudad inundada con tiburones" />
        {status === 'playing' && toast && <div key={toast.id} className={toast.big ? 'trepa-record' : 'trepa-toast tib-toast'} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="tib-message">
          <div>
            {status === 'ready' && <>
              <h2 id="tib-message" className="tib-title">Ciudad Tiburón 🦈</h2>
              <p>La ciudad se inundó, hay tormenta y el agua está llena de tiburones. Sos bombero: rescatá a <strong>{GOAL}</strong> perritos, gatos y personas que flotan en el agua en menos de <strong>5 minutos</strong>. Para agarrarlos tenés que bajar cerca del agua: mirá las aletas, porque cuando un tiburón se frena y salen burbujas, ¡salta! Moverte por techos, balcones, escaleras, cables, toldos, autos tapados por el agua y todo lo que arrastra la corriente. El agua pasa por delante de los edificios y los tiburones nadan por toda la ciudad: si caés al agua, salí rápido. Por las puertas de los balcones y de las escaleras de incendio podés entrar a los departamentos: adentro los tiburones no te ven. Lo que flota se lo lleva el viento y al rato se hunde. El viento sopla para un lado y para el otro y te empuja, y de la nada viene un súper viento que te revolea lejísimos: metete en un edificio. Con el tiempo llegan más tiburones.</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> trepar escaleras, sogas, caños, postes y tirolesas (o saltar) · <kbd>↓</kbd> bajar · <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="tib-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="tib-message" className="trepa-gameover">GAME OVER</h2>
              <p>{LOSE_TEXT[result.reason]} Rescataste a <strong>{result.saved}</strong> de {GOAL}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <h2 id="tib-message" className="trepa-win">¡Rescataste a los {GOAL}! 🚒</h2>
              <p>Lo lograste en <strong>{formatSharkTime(result.time)}</strong>, esquivando a todos los tiburones.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side tib-side" aria-label="Tiempo, rescatados y tiburones">
        <div className={`trepa-stat tib-time${hud.left <= 30 ? ' tib-hurry' : ''}`}><span>Tiempo</span><strong data-testid="tib-time">{formatSharkTime(hud.left)}</strong></div>
        <div className="trepa-stat tib-saved"><span>Rescatados</span><strong data-testid="tib-saved">{hud.saved} / {GOAL}</strong><small className="tib-kinds">🐶 {hud.perro} · 🐱 {hud.gato} · 🙋 {hud.persona}</small></div>
        <div className="trepa-stat tib-sharks"><span>Tiburones</span><strong data-testid="tib-sharks">{hud.sharks} 🦈</strong></div>
        <div className="trepa-meter" aria-hidden="true">
          <div className="trepa-meter-track tib-meter-track">
            <div className="trepa-meter-fill tib-meter-fill" style={{ height: pct(hud.saved) }} />
            {record.saved > 0 && record.saved < GOAL && <span className="trepa-meter-record" style={{ bottom: pct(record.saved) }} title="Récord" />}
          </div>
          <div className="trepa-meter-marks">
            <span style={{ bottom: '100%' }}>🏆 {GOAL}<small>rescatados</small></span>
          </div>
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
