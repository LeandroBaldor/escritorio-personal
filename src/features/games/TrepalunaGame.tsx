import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { drawBalloonEnvelope, drawBalloonRig, drawClimber, drawPigeon, drawPlane, drawUfo, drawZeppelin } from './trepaArt';
import { playTrepaStep, playCrumble, playGameOver, playJump, playKnock, playLose, playStart, playTeleport, playThunder, playFlame, playTramp, playWinFanfare, preloadTrepaSounds, setAmbient } from './sounds';
import { EndBanner } from './EndBanner';
import { ambientLevels, HEAR_RADIUS } from './trepaSound';
import {
  ballPos, birdPos, blinkOn, fireActive, fireRect, fireWarning, laserActive, laserHalf, laserWarning, LIVES, meters, moonOf, newTrepa, PLAYER_H, PLAYER_W, step, takeEvents, weatherAt, WORLD_W, ZONES,
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
// Se generan a 128 px (4 veces más definidas que el tamaño en pantalla de referencia), así se ven nítidas
// aunque el juego se agrande.
type Tex = 'brick' | 'concrete' | 'wood' | 'metal' | 'checker' | 'wicker' | 'asphalt' | 'stone';
const TEX = 128, TEX_UNIT = 32; // TEX_UNIT: lo que mide la textura en la escala de referencia
const textures: Partial<Record<Tex, HTMLCanvasElement>> = {};
function texture(kind: Tex) {
  if (textures[kind]) return textures[kind]!;
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const x = c.getContext('2d')!;
  let seed = kind.length * 97 + kind.charCodeAt(0);
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Grano: puntitos claros y oscuros de varios tamaños, para que nada se vea liso.
  const grain = (n: number, light: string, dark: string, size = 2) => { for (let i = 0; i < n; i++) { x.fillStyle = r() > 0.5 ? light : dark; const z = 1 + Math.floor(r() * size); x.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), z, z); } };
  const stains = (n: number, color: string, max: number) => { for (let i = 0; i < n; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const cx = r() * TEX, cy = r() * TEX, rr = 6 + r() * max; x.save(); x.translate(cx, cy); x.scale(rr, rr * (0.6 + r() * 0.6)); g.addColorStop(0, color); g.addColorStop(1, '#00000000'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore(); } };
  if (kind === 'brick') {
    x.fillStyle = '#cfc6b8'; x.fillRect(0, 0, TEX, TEX); grain(900, '#e2dbcf', '#a89f92', 1); // junta de cemento
    const bw = 64, bh = 32, gap = 4;
    for (let row = 0; row < TEX / bh; row++) for (let col = -1; col < TEX / bw + 1; col++) {
      const bx = col * bw + (row % 2 ? bw / 2 : 0) + gap / 2, by = row * bh + gap / 2, w = bw - gap, h = bh - gap;
      const hue = 14 + r() * 10, light = 34 + r() * 12;
      x.fillStyle = `hsl(${hue},${52 + r() * 15}%,${light}%)`; x.fillRect(bx, by, w, h);
      x.fillStyle = `hsla(${hue},60%,${light + 12}%,0.8)`; x.fillRect(bx, by, w, 3); // borde de arriba iluminado
      x.fillStyle = '#00000038'; x.fillRect(bx, by + h - 3, w, 3); x.fillRect(bx + w - 2, by, 2, h); // sombra
      x.save(); x.beginPath(); x.rect(bx, by, w, h); x.clip();
      for (let i = 0; i < 70; i++) { x.fillStyle = r() > 0.5 ? '#ffffff1a' : '#0000002a'; x.fillRect(bx + r() * w, by + r() * h, 1 + r() * 2, 1 + r() * 2); }
      if (r() > 0.7) { x.fillStyle = '#00000022'; x.beginPath(); x.arc(bx + r() * w, by + r() * h, 2 + r() * 3, 0, Math.PI * 2); x.fill(); } // picadura
      x.restore();
    }
  } else if (kind === 'concrete') {
    x.fillStyle = '#9aa0a6'; x.fillRect(0, 0, TEX, TEX);
    stains(10, '#7e848b55', 26); stains(6, '#b8bec455', 20);
    grain(2600, '#b0b6bc', '#80868c', 2);
    x.strokeStyle = '#7a808766'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 63.5); x.lineTo(TEX, 63.5); x.moveTo(63.5, 0); x.lineTo(63.5, TEX); x.stroke(); // juntas de los paneles
  } else if (kind === 'stone') {
    x.fillStyle = '#6b7080'; x.fillRect(0, 0, TEX, TEX);
    for (const [bx, by, w, h] of [[2, 2, 60, 60], [66, 2, 60, 28], [66, 34, 60, 28], [2, 66, 28, 60], [34, 66, 28, 60], [66, 66, 60, 60]]) {
      const l = 52 + r() * 10, g = x.createLinearGradient(bx, by, bx + w, by + h);
      g.addColorStop(0, `hsl(225,8%,${l + 8}%)`); g.addColorStop(1, `hsl(225,8%,${l - 8}%)`);
      x.fillStyle = g; x.fillRect(bx, by, w, h);
      x.fillStyle = '#ffffff30'; x.fillRect(bx, by, w, 2); x.fillRect(bx, by, 2, h);
      x.fillStyle = '#00000035'; x.fillRect(bx, by + h - 2, w, 2); x.fillRect(bx + w - 2, by, 2, h);
    }
    grain(1500, '#ffffff22', '#00000030', 2);
  } else if (kind === 'asphalt') {
    x.fillStyle = '#3d4047'; x.fillRect(0, 0, TEX, TEX);
    grain(3500, '#575b63', '#2c2f35', 2); grain(400, '#6b7079', '#22252a', 3);
    x.strokeStyle = '#25282d'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(10, 90); x.lineTo(30, 84); x.lineTo(38, 96); x.lineTo(58, 92); x.stroke(); // grieta
  } else if (kind === 'wood') {
    for (let i = 0; i < 4; i++) {
      const y0 = i * 32, base = ['#a8693a', '#b97a45', '#9c5f33', '#b2733f'][i];
      x.fillStyle = base; x.fillRect(0, y0, TEX, 32);
      for (let k = 0; k < 9; k++) { x.strokeStyle = r() > 0.5 ? '#7a452433' : '#d39a6633'; x.lineWidth = 1 + r(); x.beginPath(); const yy = y0 + 3 + r() * 26; x.moveTo(0, yy); x.bezierCurveTo(40, yy + (r() - 0.5) * 6, 80, yy + (r() - 0.5) * 6, TEX, yy); x.stroke(); } // vetas
      if (r() > 0.4) { x.strokeStyle = '#6b3b1d66'; x.lineWidth = 1; x.beginPath(); x.ellipse(20 + r() * 90, y0 + 16, 5, 3, 0, 0, Math.PI * 2); x.stroke(); } // nudo
      x.fillStyle = '#5c3218'; x.fillRect(0, y0 + 30, TEX, 2); x.fillRect((i * 53) % TEX, y0, 2, 30);
      x.fillStyle = '#2b1a0e'; x.beginPath(); x.arc(((i * 53) % TEX) + 7, y0 + 16, 1.6, 0, Math.PI * 2); x.fill(); // clavos
    }
  } else if (kind === 'metal') {
    const g = x.createLinearGradient(0, 0, TEX, TEX); g.addColorStop(0, '#9aa3ae'); g.addColorStop(0.5, '#b8c0ca'); g.addColorStop(1, '#8a939e');
    x.fillStyle = g; x.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 160; i++) { x.strokeStyle = r() > 0.5 ? '#ffffff22' : '#00000018'; x.lineWidth = 1; x.beginPath(); const yy = r() * TEX; x.moveTo(r() * TEX, yy); x.lineTo(r() * TEX, yy); x.stroke(); } // cepillado
    x.strokeStyle = '#6b737e'; x.lineWidth = 2; x.strokeRect(1, 1, TEX - 2, TEX - 2);
    for (const [rx, ry] of [[8, 8], [TEX - 8, 8], [8, TEX - 8], [TEX - 8, TEX - 8], [64, 8], [64, TEX - 8]]) { x.fillStyle = '#5b636e'; x.beginPath(); x.arc(rx, ry, 3.5, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e2e8f0'; x.beginPath(); x.arc(rx - 1, ry - 1, 1.4, 0, Math.PI * 2); x.fill(); } // remaches
  } else if (kind === 'checker') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const dark = (i + j) % 2 === 0;
      x.fillStyle = dark ? '#1e293b' : '#f1f5f9'; x.fillRect(i * 32, j * 32, 32, 32);
      const g = x.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32); g.addColorStop(0, '#ffffff30'); g.addColorStop(1, '#00000020');
      x.fillStyle = g; x.fillRect(i * 32, j * 32, 32, 32); // brillo de la baldosa
      x.strokeStyle = '#00000040'; x.lineWidth = 1; x.strokeRect(i * 32 + 0.5, j * 32 + 0.5, 31, 31);
    }
  } else if (kind === 'wicker') {
    x.fillStyle = '#9c6d2b'; x.fillRect(0, 0, TEX, TEX);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const horiz = (row + col) % 2 === 0, bx = col * 16, by = row * 16;
      const g = horiz ? x.createLinearGradient(0, by, 0, by + 16) : x.createLinearGradient(bx, 0, bx + 16, 0);
      g.addColorStop(0, '#8a5d22'); g.addColorStop(0.5, '#d9a75a'); g.addColorStop(1, '#8a5d22');
      x.fillStyle = g; x.beginPath(); x.roundRect(bx + 1, by + 1, 14, 14, 4); x.fill();
    }
  }
  textures[kind] = c;
  return c;
}
const patterns = new WeakMap<CanvasRenderingContext2D, Partial<Record<Tex, CanvasPattern>>>();
function fillTex(ctx: CanvasRenderingContext2D, kind: Tex, x: number, y: number, w: number, h: number, v: View, tint?: string) {
  let cache = patterns.get(ctx);
  if (!cache) { cache = {}; patterns.set(ctx, cache); }
  const pattern = cache[kind] ?? (cache[kind] = ctx.createPattern(texture(kind), 'repeat') ?? undefined);
  if (!pattern) return;
  const k = Math.max(0.5, v.s / 40);
  pattern.setTransform(new DOMMatrix().translate(v.ox, Y(v, 0) % (TEX_UNIT * k)).scale(k * TEX_UNIT / TEX));
  ctx.fillStyle = pattern; ctx.fillRect(x, y, w, h);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); }
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- Fondo ----------
const SKY: [number, [number, number, number]][] = [[0, [168, 216, 255]], [90, [110, 190, 250]], [250, [80, 160, 240]], [300, [16, 18, 48]], [320, [8, 9, 30]], [470, [4, 5, 18]], [800, [2, 3, 12]]];
function skyAt(y: number) {
  let i = 0;
  while (i < SKY.length - 2 && y > SKY[i + 1][0]) i++;
  const [y0, a] = SKY[i], [y1, b] = SKY[i + 1];
  const k = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
  // En la tormenta (2.000 a 3.000 m) el cielo se pone casi negro, gris azulado.
  const storm = weatherAt(y).storm * 0.92, STORM = [22, 24, 32];
  return `rgb(${a.map((c, j) => Math.round((c + (b[j] - c) * k) * (1 - storm) + STORM[j] * storm)).join(',')})`;
}

// Nubes de tormenta: oscurísimas, con el borde de arriba apenas más claro y la panza negra. Igual que las otras
// nubes, se arman una vez por tamaño.
const stormSprites = new Map<number, HTMLCanvasElement>();
function stormSprite(w: number) {
  const cached = stormSprites.get(w);
  if (cached) return cached;
  const q = 2, c = document.createElement('canvas'); c.width = Math.ceil(w * 1.1 * q); c.height = Math.ceil(w * 0.9 * q);
  const x = c.getContext('2d')!; x.scale(q, q); x.translate(w * 0.55, w * 0.45);
  x.fillStyle = '#1a1c23';
  x.beginPath(); for (const [dx, dy, r] of CLOUD_BLOBS) { x.moveTo(dx * w + r * w, dy * w); x.arc(dx * w, dy * w, r * w, 0, Math.PI * 2); } x.ellipse(0, w * 0.06, w * 0.42, w * 0.08, 0, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'source-atop';
  for (const [dx, dy, r] of CLOUD_BLOBS) {
    const cx = dx * w - r * w * 0.25, cy = dy * w - r * w * 0.45, g = x.createRadialGradient(cx, cy, 0, cx, cy, r * w);
    g.addColorStop(0, '#4a5163aa'); g.addColorStop(1, '#4a516300');
    x.fillStyle = g; x.fillRect(-w * 0.6, -w * 0.5, w * 1.2, w * 0.95);
  }
  const belly = x.createLinearGradient(0, -w * 0.1, 0, w * 0.32);
  belly.addColorStop(0, '#05060800'); belly.addColorStop(1, '#050608ee');
  x.fillStyle = belly; x.fillRect(-w * 0.6, -w * 0.5, w * 1.2, w * 0.95);
  stormSprites.set(w, c);
  return c;
}
function stormPuff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const size = Math.max(16, Math.round(w / 16) * 16);
  ctx.drawImage(stormSprite(size), x - w * 0.55, y - w * 0.45, w * 1.1, w * 0.9);
}

// Nube con volumen: bultos redondos que se funden en una sola forma, iluminada desde arriba y con la base en
// sombra. Se arma una vez en una imagen aparte (por tamaño y color) y después se pinta entera, así las nubes
// semitransparentes no dejan ver los bultos por separado.
const cloudSprites = new Map<string, HTMLCanvasElement>();
const CLOUD_BLOBS: [number, number, number][] = [[-0.3, 0.02, 0.2], [0.3, 0.03, 0.18], [-0.12, -0.1, 0.24], [0.12, -0.16, 0.27], [0.32, -0.06, 0.16], [-0.38, 0.04, 0.13], [0, 0.04, 0.3]];
function cloudSprite(w: number, color: string) {
  const key = `${w}|${color}`, cached = cloudSprites.get(key);
  if (cached) return cached;
  if (cloudSprites.size > 160) cloudSprites.clear();
  const q = 2, c = document.createElement('canvas'); c.width = Math.ceil(w * 1.1 * q); c.height = Math.ceil(w * 0.9 * q);
  const x = c.getContext('2d')!; x.scale(q, q); x.translate(w * 0.55, w * 0.45);
  x.fillStyle = color; // la forma, con el color base
  x.beginPath(); for (const [dx, dy, r] of CLOUD_BLOBS) { x.moveTo(dx * w + r * w, dy * w); x.arc(dx * w, dy * w, r * w, 0, Math.PI * 2); } x.ellipse(0, w * 0.06, w * 0.42, w * 0.08, 0, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'source-atop';
  for (const [dx, dy, r] of CLOUD_BLOBS) { // brillo arriba de cada bulto, que se funde con los vecinos
    const cx = dx * w - r * w * 0.25, cy = dy * w - r * w * 0.4, g = x.createRadialGradient(cx, cy, 0, cx, cy, r * w * 0.95);
    g.addColorStop(0, '#ffffffee'); g.addColorStop(1, '#ffffff00');
    x.fillStyle = g; x.fillRect(-w * 0.6, -w * 0.5, w * 1.2, w * 0.95);
  }
  const shade = x.createLinearGradient(0, -w * 0.05, 0, w * 0.32); // panza en sombra
  shade.addColorStop(0, '#94a3b800'); shade.addColorStop(1, '#94a3b8aa');
  x.fillStyle = shade; x.fillRect(-w * 0.6, -w * 0.5, w * 1.2, w * 0.95);
  cloudSprites.set(key, c);
  return c;
}
function puff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  const size = Math.max(16, Math.round(w / 8) * 8), sprite = cloudSprite(size, color);
  ctx.drawImage(sprite, x - w * 0.55, y - w * 0.45, w * 1.1, w * 0.9);
}

// Ciudad lejana: cada plano se dibuja una sola vez en una imagen aparte (para el ancho y la escala de la
// pantalla) y después solo se copia, así no cuesta nada aunque tenga miles de ventanitas.
const skylineSprites = new Map<string, { canvas: HTMLCanvasElement; h: number }>();
function drawSkyline(ctx: CanvasRenderingContext2D, v: View, base: number, layer: 0 | 1) {
  if (base - v.s * 45 > v.h) return;
  const key = `${Math.round(v.w)}|${Math.round(v.s)}|${layer}`;
  let sprite = skylineSprites.get(key);
  if (!sprite) {
    if (skylineSprites.size > 8) skylineSprites.clear();
    const h = Math.ceil(v.s * 26), canvas = document.createElement('canvas');
    canvas.width = Math.ceil(v.w); canvas.height = h;
    paintSkyline(canvas.getContext('2d')!, v.w, v.s, h, layer);
    sprite = { canvas, h };
    skylineSprites.set(key, sprite);
  }
  const top = base - sprite.h;
  if (top < v.h) ctx.drawImage(sprite.canvas, 0, top);
}
// Edificios lejanos: luz de un costado, terrazas escalonadas, agujas, tanques de agua y grillas de ventanas.
function paintSkyline(ctx: CanvasRenderingContext2D, width: number, scale: number, base: number, layer: 0 | 1) {
  const far = layer === 0, tone = far ? [205, 38, 84] : [210, 38, 70];
  for (let i = 0, x = far ? -60 : -20; x < width; i++) {
    const id = i + layer * 500, bw = (far ? 30 : 40) + hash(id + 40) * (far ? 55 : 70), bh = ((far ? 14 : 8) + hash(id + 80) * 30) * scale * (far ? 0.4 : 0.45);
    const top = base - bh, l = tone[2] - hash(id + 7) * 6;
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, `hsl(${tone[0]},${tone[1]}%,${l + 5}%)`); g.addColorStop(0.65, `hsl(${tone[0]},${tone[1]}%,${l}%)`); g.addColorStop(1, `hsl(${tone[0]},${tone[1]}%,${l - 7}%)`);
    ctx.fillStyle = g;
    const roof = hash(id + 33);
    ctx.beginPath();
    if (roof > 0.75) { ctx.rect(x, top, bw, bh); ctx.rect(x + bw * 0.2, top - bh * 0.12, bw * 0.6, bh * 0.12); ctx.rect(x + bw * 0.35, top - bh * 0.2, bw * 0.3, bh * 0.08); } // escalonado
    else if (roof > 0.6) { ctx.rect(x, top, bw, bh); ctx.moveTo(x + bw * 0.42, top); ctx.lineTo(x + bw / 2, top - bh * 0.3); ctx.lineTo(x + bw * 0.58, top); } // aguja
    else ctx.rect(x, top, bw, bh);
    ctx.fill();
    const depth = far ? 5 : 6; // la cara del costado, en sombra, le da volumen
    ctx.fillStyle = `hsl(${tone[0]},${tone[1]}%,${l - 14}%)`; ctx.beginPath(); ctx.moveTo(x + bw, top); ctx.lineTo(x + bw + depth, top + depth * 0.6); ctx.lineTo(x + bw + depth, base); ctx.lineTo(x + bw, base); ctx.fill();
    ctx.fillStyle = `hsl(${tone[0]},${tone[1]}%,${l + 10}%)`; ctx.fillRect(x - 1, top - 1.5, bw + 2, 1.5); // borde de la terraza
    ctx.fillStyle = `hsla(${tone[0]},30%,${l - 10}%,0.35)`; for (let fy = top + 14; fy < base; fy += 14) ctx.fillRect(x, fy, bw, 1); // losas de cada piso
    if (roof < 0.25) { // tanque de agua sobre patas
      ctx.fillStyle = `hsl(${tone[0]},25%,${l - 12}%)`; ctx.fillRect(x + bw * 0.62, top - 12, 2, 12); ctx.fillRect(x + bw * 0.78, top - 12, 2, 12);
      ctx.beginPath(); ctx.roundRect(x + bw * 0.58, top - 22, bw * 0.26, 11, [5, 5, 1, 1]); ctx.fill();
    } else if (roof < 0.45) { ctx.fillStyle = `hsl(${tone[0]},25%,${l - 10}%)`; ctx.fillRect(x + bw * 0.3, top - 16, 1.5, 16); ctx.fillStyle = '#ef444499'; ctx.fillRect(x + bw * 0.3 - 1, top - 18, 3.5, 3); }
    // grilla de ventanas: casi todas apagadas, algunas con luz
    const ww = far ? 2 : 3, wh = far ? 3 : 4, gx = far ? 6 : 8, gy = far ? 7 : 9;
    for (let wy = top + 6, row = 0; wy < base - 3; wy += gy, row++) {
      for (let wx = x + 4, col = 0; wx < x + bw - 4; wx += gx, col++) {
        const k = hash(id * 13 + row * 7.1 + col * 3.3);
        ctx.fillStyle = k > 0.82 ? (far ? '#f0f9ffaa' : '#fef9c3cc') : `hsla(${tone[0]},40%,${l - 14}%,0.55)`;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
    x += bw + (far ? 10 : 6);
  }
}

// Nebulosas: son difusas, así que se arman una sola vez en baja resolución y se estiran a toda la pantalla.
let nebula: HTMLCanvasElement | null = null;
function nebulaSprite() {
  if (nebula) return nebula;
  nebula = document.createElement('canvas'); nebula.width = 320; nebula.height = 300;
  const x = nebula.getContext('2d')!, W = 320, H = 300;
  for (const [nx, ny, nr, color] of [[0.25, 0.37, 0.45, '124,58,237'], [0.7, 0.67, 0.4, '219,39,119'], [0.55, 0.27, 0.3, '14,165,233']] as const) {
    const cx = W * nx, cy = H * ny, r = W * nr;
    const neb = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    neb.addColorStop(0, `rgba(${color},0.22)`); neb.addColorStop(0.5, `rgba(${color},0.08)`); neb.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = neb; x.fillRect(0, 0, W, H);
  }
  return nebula;
}

function drawBackground(ctx: CanvasRenderingContext2D, v: View, flash = 0, boltX: number | null = null) {
  const top = v.cam + v.h / v.s, mid = v.cam + v.h / v.s / 2;
  const bg = ctx.createLinearGradient(0, 0, 0, v.h);
  bg.addColorStop(0, skyAt(top)); bg.addColorStop(1, skyAt(v.cam));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, v.w, v.h);

  // Estrellas (desde los 3.000 m se hace de noche y aparecen muchísimas) y planetas en el espacio.
  const sky = weatherAt(mid), stars = weatherAt(top).night;
  if (stars > 0) {
    const colors = ['#ffffff', '#ffffff', '#dbeafe', '#fde68a', '#bfdbfe', '#fecaca'];
    for (let i = 0; i < 600; i++) {
      const sx = hash(i) * v.w, sy = ((hash(i + 500) * v.h * 2 + v.cam * v.s * 0.1) % (v.h * 2)) - v.h * 0.5;
      if (sy < 0 || sy > v.h) continue;
      ctx.globalAlpha = stars * (0.35 + 0.65 * Math.abs(Math.sin(v.t * (0.8 + hash(i + 70)) + i)));
      ctx.fillStyle = colors[i % colors.length];
      const size = 0.8 + hash(i + 900) ** 3 * 2.4; ctx.fillRect(sx, sy, size, size);
    }
    // Una franja de la Vía Láctea, muy suave.
    ctx.globalAlpha = stars * 0.35;
    const band = ctx.createLinearGradient(0, v.h * 0.1, v.w, v.h * 0.9);
    band.addColorStop(0, '#a5b4fc00'); band.addColorStop(0.45, '#c7d2fe33'); band.addColorStop(0.55, '#e0e7ff44'); band.addColorStop(0.65, '#c7d2fe22'); band.addColorStop(1, '#a5b4fc00');
    ctx.fillStyle = band; ctx.fillRect(0, 0, v.w, v.h);
    ctx.globalAlpha = stars;
    for (let i = 0; i < 160; i++) { // polvo de estrellas en la franja
      const k = hash(i + 4000), sx = k * v.w, sy = v.h * (0.1 + k * 0.8) + (hash(i + 4100) - 0.5) * v.h * 0.18;
      ctx.fillStyle = '#ffffffaa'; ctx.fillRect(sx, sy, 1, 1);
    }
    const space = Math.max(0, Math.min(1, (mid - ZONES.space + 5) / 25)); // los planetas, recién en el espacio
    ctx.globalAlpha = space;
    // Nebulosas de colores, muy suaves.
    ctx.drawImage(nebulaSprite(), 0, (v.cam - ZONES.space) * v.s * 0.03 - v.h * 0.25, v.w, v.h * 1.5);
    // Estrellas brillantes con destello en cruz.
    for (let i = 0; i < 9; i++) {
      const sx = hash(i + 3000) * v.w, sy = hash(i + 3100) * v.h, tw = 0.6 + 0.4 * Math.sin(v.t * 2 + i), len = (4 + hash(i + 3200) * 6) * tw;
      ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy); ctx.moveTo(sx, sy - len); ctx.lineTo(sx, sy + len); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    const py = v.h * 0.3 + (v.cam - ZONES.space - 40) * v.s * 0.08;
    // Planeta con anillos (el anillo pasa por detrás y por delante) y un planeta rojo con cráteres.
    const pr = Math.min(v.w, v.h) * 0.09, px = v.w * 0.8;
    const ring = (front: boolean) => { ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3); for (const [k, c] of [[1.85, '#f5deb399'], [1.6, '#e7c79acc'], [1.4, '#c9a46e88']] as const) { ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, pr * 0.1); ctx.beginPath(); ctx.ellipse(0, 0, pr * k, pr * k * 0.25, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke(); } ctx.restore(); };
    ring(false);
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#e9b872'; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    for (let b = 0; b < 7; b++) { ctx.fillStyle = ['#d9a05b', '#f3cf92', '#c98b45', '#e8bd7c', '#b8793d', '#f0c98a', '#d39a55'][b]; ctx.fillRect(px - pr, py - pr + b * pr * 0.3, pr * 2, pr * (0.1 + hash(b + 77) * 0.14)); } // franjas
    const lit = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr * 1.05);
    lit.addColorStop(0, '#ffffff40'); lit.addColorStop(0.5, '#00000000'); lit.addColorStop(1, '#000000b0');
    ctx.fillStyle = lit; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.restore();
    ring(true);
    const rx = v.w * 0.16, ry = py + v.h * 0.35, rr = pr * 0.45;
    const mars = ctx.createRadialGradient(rx - rr * 0.35, ry - rr * 0.35, rr * 0.1, rx, ry, rr);
    mars.addColorStop(0, '#fb923c'); mars.addColorStop(0.6, '#c2410c'); mars.addColorStop(1, '#431407');
    ctx.fillStyle = mars; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c2d1288'; for (const [dx, dy, r] of [[-0.3, 0.1, 0.18], [0.25, -0.2, 0.12], [0.1, 0.4, 0.1]]) { ctx.beginPath(); ctx.arc(rx + dx * rr, ry + dy * rr, r * rr, 0, Math.PI * 2); ctx.fill(); }
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
      const body = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      body.addColorStop(0, '#2c2766'); body.addColorStop(0.3, '#3a3488'); body.addColorStop(0.55, '#1f1b52'); body.addColorStop(1, '#120f33');
      ctx.fillStyle = body; ctx.fillRect(tx, ty, tw, th + v.h); // torre de metal con luz de costado
      ctx.strokeStyle = '#4c46a855'; ctx.lineWidth = 1; ctx.beginPath();
      for (let py = Math.max(ty + 22, ty + 22 * Math.ceil(-ty / 22)); py < Math.min(v.h, ty + th + v.h); py += 22) { ctx.moveTo(tx, py); ctx.lineTo(tx + tw, py); }
      ctx.stroke(); // juntas de los paneles
      ctx.fillStyle = '#ffffff14'; ctx.fillRect(tx + tw * 0.12, ty, tw * 0.08, th + v.h); // reflejo
      ctx.fillStyle = '#3a3488'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + tw * 0.5, ty - tw * 0.35); ctx.lineTo(tx + tw, ty); ctx.fill(); // remate
      ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(tx + tw * 0.5, ty - tw * 0.35); ctx.lineTo(tx + tw * 0.5, ty - tw * 0.35 - 22); ctx.stroke(); // antena
      ctx.fillStyle = Math.sin(v.t * 3 + i) > 0 ? '#f87171' : '#7f1d1d'; ctx.beginPath(); ctx.arc(tx + tw * 0.5, ty - tw * 0.35 - 23, 2.5, 0, Math.PI * 2); ctx.fill();
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
  const sun = Math.max(0, Math.min(1, (mid - 85) / 20)) * Math.max(0, Math.min(1, (ZONES.tech - mid) / 20)) * (1 - sky.storm); // (en la tormenta no se ve)
  if (sun > 0) {
    const sx = v.w * 0.82, sy = v.h * 0.2, r = Math.min(v.w, v.h) * 0.08;
    ctx.globalAlpha = sun;
    // Sol realista: corona grande y suave, rayos difusos que giran despacio y un núcleo casi blanco.
    const glow = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 4);
    glow.addColorStop(0, '#fffbe6dd'); glow.addColorStop(0.25, '#fff3b066'); glow.addColorStop(1, '#fff3b000');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(v.t * 0.05);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8); const len = r * (2.2 + (i % 2) * 0.9), ray = ctx.createLinearGradient(0, 0, len, 0);
      ray.addColorStop(0, '#fff7cc66'); ray.addColorStop(1, '#fff7cc00');
      ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(0, -r * 0.12); ctx.lineTo(len, 0); ctx.lineTo(0, r * 0.12); ctx.fill();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.6, '#fffbeb'); core.addColorStop(0.9, '#fde68a'); core.addColorStop(1, '#fcd34d');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Ciudad lejana (se mueve más lento) mientras se está en la parte baja: dos planos, el de atrás más pálido.
  drawSkyline(ctx, v, v.h + v.cam * v.s * 0.25, 0);
  drawSkyline(ctx, v, v.h + v.cam * v.s * 0.35, 1);

  // Nubes de fondo en el cielo.
  for (let i = 0; i < 40; i++) {
    const wy = 95 + hash(i + 200) * (ZONES.tech - 95);
    const sy = Y(v, wy) * 0.8 + v.h * 0.1;
    if (sy < -80 || sy > v.h + 80) continue;
    const sx = ((hash(i + 300) * (v.w + 240) + v.t * (5 + hash(i) * 10)) % (v.w + 240)) - 120;
    const cw = (60 + hash(i + 400) * 80) * Math.min(1.3, v.s / 40);
    ctx.globalAlpha = 0.8 * (1 - weatherAt(wy).storm); puff(ctx, sx, sy, cw, '#f1f5f9');
  }
  ctx.globalAlpha = 1;
  // La tormenta (2.000 a 3.000 m): capas de nubes negras que tapan todo el cielo, iluminadas por dentro cuando
  // cae un relámpago.
  if (sky.storm > 0) {
    for (let layer = 0; layer < 3; layer++) {
      ctx.globalAlpha = sky.storm * (0.75 + layer * 0.1);
      for (let i = 0; i < 9; i++) {
        const w = (140 + hash(i * 7 + layer) * 160) * Math.min(1.4, v.s / 40) * (1 + layer * 0.25), span = v.w + w * 2;
        const sx = ((hash(i * 3 + layer * 11) * span + v.t * (4 + layer * 5)) % span) - w, sy = v.h * (0.05 + layer * 0.12 + hash(i + layer * 5) * 0.35);
        stormPuff(ctx, sx, sy, w);
      }
    }
    if (flash > 0) { // el relámpago ilumina las nubes desde adentro
      const glowR = Math.max(v.w, v.h) * 0.6, lx = boltX ?? v.w / 2, lg = ctx.createRadialGradient(lx, v.h * 0.15, 0, lx, v.h * 0.15, glowR);
      lg.addColorStop(0, `rgba(220,230,255,${Math.min(0.45, flash * 1.2)})`); lg.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.globalAlpha = sky.storm; ctx.fillStyle = lg; ctx.fillRect(0, 0, v.w, v.h);
    }
    ctx.globalAlpha = 1;
  }

  // Bandadas de pájaros a lo lejos, en el cielo.
  const flocks = Math.max(0, Math.min(1, (mid - 60) / 20)) * Math.max(0, Math.min(1, (ZONES.clouds + 20 - mid) / 20));
  if (flocks > 0) {
    ctx.globalAlpha = flocks * 0.6; ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let f = 0; f < 3; f++) {
      const fx = ((hash(f + 1000) * (v.w + 300) + v.t * (18 + f * 7)) % (v.w + 300)) - 150, fy = v.h * (0.15 + hash(f + 1010) * 0.35);
      for (let k = 0; k < 7; k++) {
        const bx = fx - Math.abs(k - 3) * 14, by = fy + (k - 3) * 9 + Math.abs(k - 3) * 3, flap = Math.sin(v.t * 9 + k) * 3;
        ctx.beginPath(); ctx.moveTo(bx - 5, by - flap); ctx.quadraticCurveTo(bx - 2, by - 2, bx, by); ctx.quadraticCurveTo(bx + 2, by - 2, bx + 5, by - flap); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Estrellas fugaces en el espacio (una cada tanto).
  if (stars > 0.5) {
    const cycle = 4.5, k = (v.t % cycle) / 0.7, n = Math.floor(v.t / cycle);
    if (k < 1) {
      const sx0 = hash(n + 2000) * v.w, sy0 = hash(n + 2100) * v.h * 0.5, len = Math.min(v.w, v.h) * 0.25;
      const hx = sx0 + k * len, hy = sy0 + k * len * 0.45;
      const trail = ctx.createLinearGradient(hx - len * 0.4, hy - len * 0.18, hx, hy); trail.addColorStop(0, '#ffffff00'); trail.addColorStop(1, '#ffffff');
      ctx.globalAlpha = stars * (1 - k * 0.6); ctx.strokeStyle = trail; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - len * 0.4, hy - len * 0.18); ctx.lineTo(hx, hy); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
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
    const light = ctx.createLinearGradient(sx, 0, sx + sw, 0); // luz que viene de la izquierda
    light.addColorStop(0, '#ffffff22'); light.addColorStop(0.5, '#ffffff00'); light.addColorStop(1, '#00000033');
    ctx.fillStyle = light; ctx.fillRect(sx, sy, sw, sh);
    // Ventanas fijas en el edificio (cada una siempre igual): algunas con luz, otras apagadas y otras
    // con la persiana cerrada.
    const ww = v.s * 0.55, wh = v.s * 0.75, cols = Math.max(1, Math.floor(((x2 - x1) - 0.4) / 1.1));
    if (x1 < WORLD_W) { // pilastras entre las columnas de ventanas, con luz de un lado y sombra del otro
      for (let c = 0; c <= cols; c++) {
        const lx = sx + v.s * (0.4 + c * 1.1) - v.s * 0.32;
        if (lx < sx || lx > sx + sw - v.s * 0.12) continue;
        ctx.fillStyle = hsl(hue, 18, 55, 0.35); ctx.fillRect(lx, sy, v.s * 0.12, sh);
        ctx.fillStyle = '#00000026'; ctx.fillRect(lx + v.s * 0.12, sy, v.s * 0.05, sh);
      }
    } else { // torres de vidrio: montantes de aluminio de arriba a abajo
      ctx.fillStyle = '#cbd5e155'; for (let c = 0; c <= cols; c++) ctx.fillRect(sx + v.s * (0.4 + c * 1.1) - v.s * 0.1, sy, Math.max(1, v.s * 0.04), sh);
    }
    const firstRow = Math.max(0, Math.floor((roof - (v.cam + v.h / v.s) - 0.5) / 1.4));
    for (let r = firstRow; ; r++) {
      const wyWorld = roof - 0.5 - r * 1.4; // borde de arriba de la ventana, en unidades
      if (wyWorld - 0.75 < floor + 0.4) break;
      const wy = Y(v, wyWorld);
      if (wy > v.h) break;
      for (let c = 0; c < cols; c++) {
        const wx = sx + v.s * (0.4 + c * 1.1), k = hash(x1 * 131 + roof * 17 + r * 7.3 + c * 3.1);
        if (x1 >= WORLD_W) { // los de la derecha: torres de vidrio azul con reflejos
          const glass = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
          if (k > 0.8) { glass.addColorStop(0, '#fef3c7'); glass.addColorStop(1, '#f59e0b'); }
          else { glass.addColorStop(0, k > 0.4 ? '#93c5fd' : '#3b82f6'); glass.addColorStop(0.55, k > 0.4 ? '#3b82f6' : '#1e40af'); glass.addColorStop(1, '#172554'); }
          ctx.fillStyle = glass; ctx.fillRect(wx - 2, wy, ww + 4, wh);
          ctx.fillStyle = '#ffffff40'; ctx.beginPath(); ctx.moveTo(wx - 2, wy); ctx.lineTo(wx + ww * 0.5, wy); ctx.lineTo(wx - 2, wy + wh * 0.7); ctx.fill();
          ctx.fillStyle = '#0f172a55'; ctx.fillRect(wx - 2, wy + wh, ww + 4, Math.max(1.5, v.s * 0.08)); // losa entre pisos
          continue;
        }
        ctx.fillStyle = '#e7e2d9'; ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4); // marco
        const pane = ctx.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh);
        if (k > 0.78) { pane.addColorStop(0, '#fff3c4'); pane.addColorStop(0.5, '#fbd36b'); pane.addColorStop(1, '#d99a2b'); } // luz cálida de adentro
        else { pane.addColorStop(0, '#6d93bf'); pane.addColorStop(0.45, '#2c4f7a'); pane.addColorStop(1, '#14263f'); } // el vidrio refleja el cielo
        ctx.fillStyle = pane; ctx.fillRect(wx, wy, ww, wh);
        if (k > 0.78) { ctx.fillStyle = '#b4532f55'; ctx.fillRect(wx, wy, ww * 0.18, wh); ctx.fillRect(wx + ww * 0.82, wy, ww * 0.18, wh); } // cortinas a los lados
        ctx.fillStyle = '#00000059'; ctx.fillRect(wx, wy, ww, Math.max(1, wh * 0.1)); ctx.fillRect(wx, wy, Math.max(1, ww * 0.08), wh); // hueco de la ventana: sombra arriba y al costado
        if (k < 0.3) { // persiana cerrada
          ctx.fillStyle = hsl(hue, 15, 62); ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = hsl(hue, 15, 45); for (let l = 1; l < 5; l++) ctx.fillRect(wx, wy + wh * l / 5, ww, Math.max(1, wh * 0.06));
        } else {
          ctx.fillStyle = '#e7e2d9'; ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh); ctx.fillRect(wx, wy + wh * 0.4, ww, 2); // parteluz
          ctx.fillStyle = '#ffffff40'; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + ww * 0.45, wy); ctx.lineTo(wx, wy + wh * 0.55); ctx.fill(); // reflejo
        }
        ctx.fillStyle = '#d6d0c4'; ctx.fillRect(wx - 3, wy + wh + 2, ww + 6, Math.max(2, v.s * 0.08)); // alféizar
        ctx.fillStyle = '#00000030'; ctx.fillRect(wx - 3, wy + wh + 2 + Math.max(2, v.s * 0.08), ww + 6, 2);
        if (k > 0.3 && k < 0.42) { // aire acondicionado
          const ax = wx + ww * 0.1, ay = wy + wh + v.s * 0.15, aw = ww * 0.8, ah = v.s * 0.32;
          ctx.fillStyle = '#e5e7eb'; ctx.fillRect(ax, ay, aw, ah);
          ctx.fillStyle = '#9ca3af'; for (let l = 1; l < 4; l++) ctx.fillRect(ax + 2, ay + ah * l / 4, aw - 4, 1);
          ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.arc(ax + aw * 0.75, ay + ah / 2, ah * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // techo con borde, antena y tanque
    ctx.fillStyle = hsl(hue, 20, 25); ctx.fillRect(sx - 3, sy - v.s * 0.25, sw + 6, v.s * 0.3);
    ctx.fillStyle = hsl(hue, 20, 40); ctx.fillRect(sx - 3, sy - v.s * 0.25, sw + 6, v.s * 0.06); // borde de la cornisa
    ctx.fillStyle = '#00000040'; ctx.fillRect(sx, sy + v.s * 0.05, sw, v.s * 0.12); // sombra debajo de la cornisa
    ctx.fillStyle = hsl(hue, 18, 33); for (let dx = sx + 2; dx < sx + sw - 2; dx += v.s * 0.28) ctx.fillRect(dx, sy + v.s * 0.05, v.s * 0.14, v.s * 0.1); // dentículos
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
        const pane = ctx.createLinearGradient(wx, wy, wx + ww * 0.5, wy + wh);
        if (k < 0.14) { pane.addColorStop(0, '#fff3c4'); pane.addColorStop(1, '#e5a73a'); } else { pane.addColorStop(0, '#5a7ba6'); pane.addColorStop(0.5, '#2b3a55'); pane.addColorStop(1, '#151d2e'); }
        ctx.fillStyle = pane; ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, [ww / 2, ww / 2, 0, 0]); ctx.fill();
        ctx.fillStyle = '#ffffff30'; ctx.beginPath(); ctx.moveTo(wx + ww * 0.12, wy + ww * 0.3); ctx.lineTo(wx + ww * 0.4, wy + ww * 0.1); ctx.lineTo(wx + ww * 0.12, wy + wh * 0.6); ctx.fill(); // reflejo
        ctx.fillStyle = '#d6c09c'; ctx.beginPath(); ctx.moveTo(wx + ww / 2 - s * 0.12, wy - 4); ctx.lineTo(wx + ww / 2 + s * 0.12, wy - 4); ctx.lineTo(wx + ww / 2 + s * 0.08, wy + s * 0.12); ctx.lineTo(wx + ww / 2 - s * 0.08, wy + s * 0.12); ctx.closePath(); ctx.fill(); // clave del arco
        if (k >= 0.14 && k < 0.45) { // persiana verde cerrada
          ctx.fillStyle = '#3f6212'; ctx.fillRect(wx, wy + ww * 0.35, ww, wh - ww * 0.35);
          ctx.fillStyle = '#365314'; for (let l = 1; l < 6; l++) ctx.fillRect(wx, wy + ww * 0.35 + (wh - ww * 0.35) * l / 6, ww, 1.5);
        } else { ctx.strokeStyle = '#e7d3b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke(); }
        ctx.fillStyle = '#b45309'; ctx.fillRect(wx - 3, wy + wh, ww + 6, s * 0.16); // macetero
        for (let l = 0; l < 6; l++) { ctx.fillStyle = l % 2 ? '#22c55e' : '#15803d'; ctx.beginPath(); ctx.ellipse(wx + ww * (l + 0.5) / 6, wy + wh - s * 0.06, s * 0.1, s * 0.07, l, 0, Math.PI * 2); ctx.fill(); } // plantitas del macetero
      }
      ctx.fillStyle = '#7c2d12'; ctx.fillRect(sx, Y(v, y - 0.05), sw, s * 0.12); // cornisa de cada piso
    }
    for (let qy = f.y1, i = 0; qy < f.y2; qy += 0.5, i++) { // piedras de esquina, alternadas
      const qw = s * (i % 2 ? 0.45 : 0.7), top = Y(v, Math.min(f.y2, qy + 0.5));
      ctx.fillStyle = '#d9c7a6'; ctx.fillRect(inner - qw, top + 1, qw, s * 0.5 - 2);
      ctx.fillStyle = '#00000022'; ctx.fillRect(inner - qw, top + s * 0.5 - 3, qw, 2);
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
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(px + s * 1.05, by, Math.max(1.5, s * 0.08), bh); // montante
        ctx.fillStyle = '#ffffff22'; ctx.fillRect(px, by + bh * 0.62, s * 1.05, 1); // travesaño
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

// Follaje: una masa con volumen (luz arriba a la izquierda) cubierta de hojitas de distintos verdes.
const foliageSprites = new Map<string, HTMLCanvasElement>();
function foliage(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) {
  const size = Math.max(6, Math.round(r / 4) * 4), variant = Math.abs(Math.round(seed)) % 6, key = `${size}|${variant}`;
  let sprite = foliageSprites.get(key);
  if (!sprite) {
    if (foliageSprites.size > 120) foliageSprites.clear();
    sprite = document.createElement('canvas'); sprite.width = sprite.height = Math.ceil(size * 2.4 * 2);
    const x = sprite.getContext('2d')!; x.scale(2, 2);
    drawFoliage(x, size * 1.2, size * 1.2, size, variant * 37);
    foliageSprites.set(key, sprite);
  }
  ctx.drawImage(sprite, cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
}
function drawFoliage(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#4ade80'); g.addColorStop(0.55, '#16a34a'); g.addColorStop(1, '#14532d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 28; i++) {
    const a = hash(seed + i) * Math.PI * 2, d = Math.sqrt(hash(seed + i + 50)) * r * 0.85, lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d;
    const up = (cy - ly) / r; // las de arriba, más claras
    ctx.fillStyle = up > 0.2 ? (i % 3 ? '#4ade80' : '#86efac') : up > -0.3 ? (i % 2 ? '#22c55e' : '#16a34a') : '#166534';
    ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.2, r * 0.11, a + hash(seed + i + 9) * 2, 0, Math.PI * 2); ctx.fill();
  }
}
// Flores con pétalos y centro amarillo, sobre unas hojas.
function flowers(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hue: number, seed: number) {
  ctx.fillStyle = '#15803d'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 2) * s * 0.14, y + s * 0.05, s * 0.12, s * 0.06, (i - 2) * 0.5, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * s * 0.2 + (hash(seed + i) - 0.5) * s * 0.06, fy = y - s * (0.1 + hash(seed + i + 4) * 0.12), pr = s * 0.07;
    ctx.fillStyle = hsl(hue + i * 25, 85, 62);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx, fy, pr * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

// Cosas de la vereda: faroles (que se prenden), árboles, un auto estacionado y un hidrante.
function drawStreet(ctx: CanvasRenderingContext2D, v: View, y: number) {
  const s = v.s;
  for (const lx of [1.4, 8.6, 14.6]) { // faroles
    const x = X(v, lx);
    ctx.fillStyle = '#334155'; ctx.fillRect(x - s * 0.05, y - s * 2.6, s * 0.1, s * 2.6);
    ctx.fillRect(x - s * 0.05, y - s * 2.6, s * 0.45, s * 0.08);
    const glow = ctx.createRadialGradient(x + s * 0.38, y - s * 2.45, s * 0.05, x + s * 0.38, y - s * 2.45, s * 0.9);
    glow.addColorStop(0, '#fef3c799'); glow.addColorStop(1, '#fef3c700');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x + s * 0.38, y - s * 2.45, s * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(x + s * 0.38, y - s * 2.45, s * 0.14, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const tx of [5.6, 12.2]) { // árboles con cantero
    const x = X(v, tx);
    ctx.fillStyle = '#78350f'; ctx.fillRect(x - s * 0.09, y - s * 1.5, s * 0.18, s * 1.5);
    const bark = ctx.createLinearGradient(x - s * 0.09, 0, x + s * 0.09, 0); bark.addColorStop(0, '#92400e'); bark.addColorStop(1, '#451a03');
    ctx.fillStyle = bark; ctx.fillRect(x - s * 0.09, y - s * 1.5, s * 0.18, s * 1.5);
    foliage(ctx, x - s * 0.4, y - s * 1.75, s * 0.55, tx * 10); foliage(ctx, x + s * 0.42, y - s * 1.8, s * 0.55, tx * 10 + 3); foliage(ctx, x, y - s * 2.25, s * 0.75, tx * 10 + 7);
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(x - s * 0.4, y - s * 0.12, s * 0.8, s * 0.12);
  }
  { // auto estacionado
    const x = X(v, 10.1), cw = s * 1.9;
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.roundRect(x, y - s * 0.62, cw, s * 0.42, s * 0.12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + cw * 0.22, y - s * 0.6); ctx.lineTo(x + cw * 0.32, y - s * 0.95); ctx.lineTo(x + cw * 0.7, y - s * 0.95); ctx.lineTo(x + cw * 0.82, y - s * 0.6); ctx.fill();
    ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.moveTo(x + cw * 0.3, y - s * 0.62); ctx.lineTo(x + cw * 0.36, y - s * 0.88); ctx.lineTo(x + cw * 0.5, y - s * 0.88); ctx.lineTo(x + cw * 0.5, y - s * 0.62); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + cw * 0.54, y - s * 0.62); ctx.lineTo(x + cw * 0.54, y - s * 0.88); ctx.lineTo(x + cw * 0.67, y - s * 0.88); ctx.lineTo(x + cw * 0.76, y - s * 0.62); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.fillRect(x + cw - s * 0.1, y - s * 0.52, s * 0.08, s * 0.1);
    ctx.fillStyle = '#111827'; for (const wx of [0.22, 0.78]) { ctx.beginPath(); ctx.arc(x + cw * wx, y - s * 0.2, s * 0.18, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#9ca3af'; for (const wx of [0.22, 0.78]) { ctx.beginPath(); ctx.arc(x + cw * wx, y - s * 0.2, s * 0.08, 0, Math.PI * 2); ctx.fill(); }
  }
  { // hidrante
    const x = X(v, 7.2);
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.roundRect(x - s * 0.13, y - s * 0.6, s * 0.26, s * 0.6, [s * 0.13, s * 0.13, 0, 0]); ctx.fill();
    ctx.fillRect(x - s * 0.2, y - s * 0.42, s * 0.4, s * 0.1);
    ctx.fillStyle = '#fca5a5'; ctx.fillRect(x - s * 0.08, y - s * 0.55, s * 0.05, s * 0.45);
  }
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
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, y + s * 0.3, v.w, s * 0.06); // cordón de la vereda
      ctx.fillStyle = '#fde047'; for (let k = 0; k < v.w; k += s * 2) ctx.fillRect(k, y + s * 1.2, s, s * 0.12);
      drawStreet(ctx, v, y);
      return;
    }
    case 'beam': {
      const steel = ctx.createLinearGradient(0, y, 0, y + h); steel.addColorStop(0, '#fb923c'); steel.addColorStop(0.5, '#ea580c'); steel.addColorStop(1, '#9a3412');
      ctx.fillStyle = steel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fdba74'; ctx.fillRect(x, y, w, h * 0.22);
      ctx.fillStyle = '#7c2d1222'; for (let k = 0; k < 6; k++) ctx.fillRect(x + hash(pl.id + k) * w, y + h * 0.3, s * 0.3, h * 0.15); // óxido
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
      const by = y + h * 0.4, panel = ctx.createLinearGradient(0, by, 0, by + bh);
      panel.addColorStop(0, hsl(pl.hue, 80, 58)); panel.addColorStop(1, hsl(pl.hue, 70, 38));
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 3, by - 1, w + 6, bh + 4); // marco
      ctx.fillStyle = panel; ctx.fillRect(x, by + 2, w, bh - 2);
      ctx.fillStyle = '#ffffff26'; ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x + w * 0.45, by + 2); ctx.lineTo(x + w * 0.25, by + bh); ctx.lineTo(x, by + bh); ctx.fill(); // brillo
      ctx.font = `900 ${Math.round(s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const text = ['¡SALTÁ!', 'TREPALUNA', '¡A LA LUNA!', 'COHETES SA', 'PIZZA 24H'][pl.id % 5];
      ctx.fillStyle = '#00000055'; ctx.fillText(text, x + w / 2 + 2, by + bh / 2 + 3, w - 8); // sombra de las letras
      ctx.fillStyle = hsl(pl.hue, 80, 92); ctx.fillText(text, x + w / 2, by + bh / 2 + 1, w - 8);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x - 2, y, w + 4, h * 0.4);
      for (let k = x + s * 0.3; k < x + w; k += s * 0.8) { // focos que iluminan el cartel
        const glow = ctx.createRadialGradient(k + s * 0.07, by + s * 0.1, 0, k + s * 0.07, by + s * 0.1, s * 0.6);
        glow.addColorStop(0, '#fef9c388'); glow.addColorStop(1, '#fef9c300');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(k + s * 0.07, by + s * 0.1, s * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.fillRect(k, by - 2, s * 0.15, s * 0.15);
      }
      return;
    }
    case 'terrace': {
      fillTex(ctx, 'concrete', x, y + h, w, s * 0.5, v, '#33415555');
      ctx.fillStyle = '#00000040'; ctx.fillRect(x, y + h, w, s * 0.08); // sombra bajo el piso
      fillTex(ctx, 'checker', x, y, w, h, v, hsl(pl.hue, 60, 45, 0.45));
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.75); ctx.lineTo(x + s * 1.1, y - s * 0.75); ctx.moveTo(x + w - s * 1.1, y - s * 0.75); ctx.lineTo(x + w, y - s * 0.75);
      for (const k of [x + 2, x + s * 0.55, x + s * 1.1, x + w - s * 1.1, x + w - s * 0.55, x + w - 2]) { ctx.moveTo(k, y); ctx.lineTo(k, y - s * 0.75); }
      ctx.stroke();
      // macetas y una sombrilla
      for (const k of [x + w * 0.3, x + w * 0.62]) {
        foliage(ctx, k + s * 0.22, y - s * 0.62, s * 0.36, pl.id * 7 + k);
        const pot = ctx.createLinearGradient(k, 0, k + s * 0.45, 0); pot.addColorStop(0, '#c2410c'); pot.addColorStop(0.4, '#ea580c'); pot.addColorStop(1, '#7c2d12');
        ctx.fillStyle = pot; ctx.beginPath(); ctx.moveTo(k - s * 0.03, y - s * 0.4); ctx.lineTo(k + s * 0.48, y - s * 0.4); ctx.lineTo(k + s * 0.4, y); ctx.lineTo(k + s * 0.05, y); ctx.fill(); // maceta de terracota
        ctx.fillStyle = '#9a3412'; ctx.fillRect(k - s * 0.05, y - s * 0.44, s * 0.55, s * 0.08);
      }
      // sombrilla con gajos, volados y brillo
      const ux = x + w * 0.47, uy = y - s * 1.3, ur = s * 0.95;
      ctx.fillStyle = '#475569'; ctx.fillRect(ux - s * 0.03, uy - s * 0.25, s * 0.06, s * 1.55);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = hsl(pl.hue + 180, 80, i % 2 ? 62 : 50);
        const a1 = -ur + i * ur / 2, a2 = a1 + ur / 2;
        ctx.beginPath(); ctx.moveTo(ux, uy - s * 0.75); ctx.lineTo(ux + a1, uy); ctx.quadraticCurveTo(ux + (a1 + a2) / 2, uy + s * 0.12, ux + a2, uy); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(ux, uy - s * 0.75); ctx.lineTo(ux - ur * 0.8, uy - s * 0.05); ctx.lineTo(ux - ur * 0.35, uy - s * 0.05); ctx.closePath(); ctx.fill();
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
      for (const k of [x + w * 0.2, x + w * 0.7]) flowers(ctx, k + s * 0.12, y - s * 0.9, s, pl.hue, pl.id * 5 + k);
      return;
    }
    case 'step': {
      fillTex(ctx, 'stone', x, y, w, Math.max(h, (pl.w > 1 ? 0.45 : 0.45) * s + 2), v);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, w, s * 0.08);
      ctx.fillStyle = '#00000033'; ctx.fillRect(x, y + s * 0.4, w, s * 0.06);
      return;
    }
    case 'tile': { // baldosa voladora con helices
      ctx.fillStyle = '#00000022'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + s * 0.75, w * 0.45, s * 0.1, 0, 0, Math.PI * 2); ctx.fill(); // sombra en el aire
      fillTex(ctx, 'checker', x, y, w, h, v, hsl(pl.hue, 85, 50, 0.55));
      ctx.fillStyle = '#ffffff44'; ctx.fillRect(x, y, w, h * 0.25);
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
    case 'basket': { // globo aerostático: tela de gajos, cables, quemador con su llama, piloto y canasta de mimbre
      const cx = x + w / 2, R = Math.max(w * 0.85, s * 1.75), cy = y - s * 1.55 - R * 1.05, throatY = y - s * 1.35, throat = R * 0.32;
      const rising = pl.dy > 0;
      drawBalloonRig(ctx, { cx, x, y, w, s, throatY, throat, rising, t: v.t, id: pl.id }, () => drawBalloonEnvelope(ctx, cx, throatY, R, throatY - (cy - R * 1.17), throat, pl.hue));
      return;
    }
    case 'zeppelin': // dirigible: casco plateado con librea, timones, góndola, motores con hélices y luces
      drawZeppelin(ctx, x, y, w, s, pl.hue, v.t, pl.id);
      return;
    case 'cloudBricks': { // bloques dorados con signo de pregunta
      const n = Math.max(1, Math.round(pl.w / 0.9)), bw = w / n;
      for (let i = 0; i < n; i++) {
        const bx = x + i * bw, bh = s * 0.9, e = Math.max(2, s * 0.08), face = ctx.createLinearGradient(bx, y, bx + bw, y + bh);
        face.addColorStop(0, '#fbbf24'); face.addColorStop(1, '#d97706');
        ctx.fillStyle = face; ctx.fillRect(bx, y, bw - 1, bh);
        ctx.fillStyle = '#fde68a'; ctx.fillRect(bx, y, bw - 1, e); ctx.fillRect(bx, y, e, bh); // bisel iluminado
        ctx.fillStyle = '#92400e'; ctx.fillRect(bx, y + bh - e, bw - 1, e); ctx.fillRect(bx + bw - 1 - e, y, e, bh); // bisel en sombra
        ctx.fillStyle = '#78350f'; for (const [rx, ry] of [[0.2, 0.18], [0.8, 0.18], [0.2, 0.82], [0.8, 0.82]]) { ctx.beginPath(); ctx.arc(bx + bw * rx, y + bh * ry, s * 0.04, 0, Math.PI * 2); ctx.fill(); } // remaches
        ctx.font = `900 ${Math.round(s * 0.6)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00000055'; ctx.fillText('?', bx + bw / 2 + 2, y + s * 0.52 + 2);
        ctx.fillStyle = '#fff7ed'; ctx.fillText('?', bx + bw / 2, y + s * 0.5);
      }
      return;
    }
    case 'asteroid': { // roca irregular con relieve y cráteres (la parte de arriba es plana para pisarla)
      const cx = x + w / 2, cy = y + s * 0.35, rx = w / 2, ry = s * 0.75;
      const rock = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.5, s * 0.1, cx, cy, Math.max(rx, ry) * 1.1);
      rock.addColorStop(0, '#a8a29e'); rock.addColorStop(0.55, '#6b6560'); rock.addColorStop(1, '#292524');
      ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x + w * 0.04, y);
      ctx.lineTo(x + w * 0.96, y);
      for (let i = 1; i <= 10; i++) { const a = i / 10 * Math.PI, k = 0.85 + hash(pl.id * 3 + i) * 0.25; ctx.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(x + w * 0.06, y - s * 0.02, w * 0.88, s * 0.08); // borde de arriba iluminado
      for (const [dx, dy, r] of [[0.3, 0.45, 0.16], [0.68, 0.62, 0.11], [0.52, 0.3, 0.08], [0.18, 0.75, 0.07]]) {
        const crx = x + w * dx, cry = y + s * dy, cr = s * r;
        ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.arc(crx, cry, cr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d6d3d166'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(crx, cry, cr, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); // borde iluminado del cráter
      }
      return;
    }
    case 'station': {
      fillTex(ctx, 'metal', x, y, w, h, v);
      for (const px of [x + w * 0.1, x + w * 0.55]) { const panel = ctx.createLinearGradient(px, y + h, px + w * 0.35, y + h + s * 0.5); panel.addColorStop(0, '#3b82f6'); panel.addColorStop(0.45, '#1e3a8a'); panel.addColorStop(0.55, '#60a5fa'); panel.addColorStop(1, '#1e3a8a'); ctx.fillStyle = panel; ctx.fillRect(px, y + h, w * 0.35, s * 0.5); } // paneles solares con reflejo
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
  // Una lengua de fuego que se angosta hacia la punta, ondula como una llama de verdad (una onda que viaja
  // de la base a la punta) y se dibuja en capas: afuera roja y humeante, adentro amarilla y en el centro
  // casi blanca y azulada. En coordenadas propias: arranca en (0,0) y sale hacia +x con largo len y ancho half.
  const tongue = (len: number, half: number, stops: [number, string][], seed: number, lift = 0) => {
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    for (const [k, c] of stops) grad.addColorStop(k, c);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -half);
    const n = 16;
    const wave = (k: number) => (Math.sin(k * 7 - v.t * 17 + seed) * 0.6 + Math.sin(k * 13 - v.t * 29 + seed * 2) * 0.3) * half * 0.35 * k + lift * k * k * half;
    const edge = (i: number, sgn: number) => { const k = i / n; return sgn * half * (1 - k) ** 0.75 * (1 + 0.18 * Math.sin(v.t * 31 + i * 1.7 + seed + sgn)) + wave(k); };
    for (let i = 1; i <= n; i++) ctx.lineTo(len * i / n, edge(i, -1));
    for (let i = n; i >= 1; i--) ctx.lineTo(len * (i / n) * 0.97, edge(i, 1));
    ctx.lineTo(0, half); ctx.closePath(); ctx.fill();
  };
  const blaze = (len: number, up: boolean) => {
    const flick = 1 + Math.sin(v.t * 33) * 0.05 + Math.sin(v.t * 13.7) * 0.04;
    const rise = up ? 0 : -1.2; // las llamas de costado se curvan hacia arriba
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(len * 0.35, 0, s * 0.1, len * 0.35, 0, len * 0.85);
    glow.addColorStop(0, '#f9731670'); glow.addColorStop(0.5, '#ea580c25'); glow.addColorStop(1, '#f9731600');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(len * 0.35, 0, len * 0.85, 0, Math.PI * 2); ctx.fill(); // resplandor
    ctx.restore();
    // lenguas de afuera, rojas y oscuras, que se separan en la punta
    tongue(len * 1.02 * flick, s * 0.5, [[0, '#fb923c'], [0.3, '#ea580c'], [0.7, '#b91c1ccc'], [1, '#450a0a00']], 0, rise);
    tongue(len * 0.85, s * 0.3, [[0, '#f97316'], [0.5, '#dc2626cc'], [1, '#7f1d1d00']], 2.1, rise - 0.6);
    tongue(len * 0.8, s * 0.28, [[0, '#f97316'], [0.5, '#dc2626bb'], [1, '#7f1d1d00']], 4.2, rise + 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    tongue(len * 0.78 * flick, s * 0.34, [[0, '#fef3c7'], [0.35, '#fde047'], [0.75, '#f97316aa'], [1, '#f9731600']], 3, rise * 0.8);
    tongue(len * 0.42, s * 0.18, [[0, '#bfdbfe'], [0.25, '#ffffff'], [0.7, '#fef9c3cc'], [1, '#fef9c300']], 6, rise * 0.5); // núcleo
    // brasas que saltan, con brillo y una estelita
    for (let i = 0; i < 12; i++) {
      const k = (v.t * (0.9 + hash(i + f.id) * 0.9) + hash(i * 3 + f.id)) % 1;
      const ex = len * (0.35 + k * 0.95), ey = (hash(i + 20 + f.id) - 0.5) * s * 1.1 * (0.3 + k) + Math.sin(v.t * 7 + i) * s * 0.12 + rise * k * k * s * 0.9;
      const r = Math.max(1, s * (0.035 + hash(i + 7) * 0.035)) * (1 - k * 0.5);
      ctx.globalAlpha = (1 - k) * 0.9;
      const ember = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 3); ember.addColorStop(0, i % 3 ? '#fde047' : '#ffffff'); ember.addColorStop(0.35, '#fb923c'); ember.addColorStop(1, '#f9731600');
      ctx.fillStyle = ember; ctx.beginPath(); ctx.arc(ex, ey, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) { // humo que sale de la punta, sube, crece y se disipa
      const k = (v.t * 0.55 + i / 5) % 1, sx = len * (0.95 + k * 0.45), sy = Math.sin(v.t * 1.7 + i * 2) * s * 0.25 + rise * k * s * 1.6, sr = s * (0.22 + k * 0.6);
      const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      smoke.addColorStop(0, `rgba(55,60,70,${0.3 * (1 - k)})`); smoke.addColorStop(0.6, `rgba(75,85,99,${0.14 * (1 - k)})`); smoke.addColorStop(1, 'rgba(75,85,99,0)');
      ctx.fillStyle = smoke; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  const metal = (x: number, y: number, w: number, h: number, horizontal: boolean) => {
    const g = horizontal ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#4b5563'); g.addColorStop(0.35, '#9ca3af'); g.addColorStop(0.6, '#6b7280'); g.addColorStop(1, '#1f2937');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  if (f.dir === 'up') {
    if (active) { ctx.save(); ctx.translate(px, py - s * 0.55); ctx.rotate(-Math.PI / 2); blaze((f.len + 0.1) * s, true); ctx.restore(); }
    if (warn) { for (let i = 0; i < 4; i++) { const k = (v.t * 1.5 + i / 4) % 1; ctx.globalAlpha = 0.6 * (1 - k); ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(px + Math.sin(v.t * 6 + i) * s * 0.2, py - s * (0.7 + k * 1.2), s * (0.12 + k * 0.25), 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
    metal(px - s * 0.3, py - s * 0.5, s * 0.6, s * 0.5, false);
    metal(px - s * 0.4, py - s * 0.64, s * 0.8, s * 0.18, false);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(px - s * 0.3, py - s * 0.3, s * 0.6, s * 0.08);
    ctx.fillStyle = '#111827'; ctx.fillRect(px - s * 0.22, py - s * 0.66, s * 0.44, s * 0.05); // boca del caño
    ctx.fillStyle = '#1f2937'; for (const bx of [-0.3, 0.3]) { ctx.beginPath(); ctx.arc(px + bx * s, py - s * 0.55, s * 0.035, 0, Math.PI * 2); ctx.fill(); } // bulones
    if (active) { const hot = ctx.createLinearGradient(0, py - s * 0.66, 0, py - s * 0.45); hot.addColorStop(0, '#f97316cc'); hot.addColorStop(1, '#f9731600'); ctx.fillStyle = hot; ctx.fillRect(px - s * 0.4, py - s * 0.64, s * 0.8, s * 0.2); } // el metal al rojo
  } else {
    const d = f.dir === 'right' ? 1 : -1;
    if (active) { ctx.save(); ctx.translate(px + d * s * 0.42, py); ctx.scale(d, 1); blaze(f.len * s, false); ctx.restore(); }
    if (warn) { for (let i = 0; i < 4; i++) { const k = (v.t * 1.5 + i / 4) % 1; ctx.globalAlpha = 0.6 * (1 - k); ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(px + d * s * (0.6 + k * 1.1), py - k * s * 0.4 + Math.sin(v.t * 6 + i) * s * 0.1, s * (0.1 + k * 0.22), 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
    fillTex(ctx, 'brick', px - s * 0.5, py - s * 0.5, s, s, v);
    metal(d > 0 ? px : px - s * 0.45, py - s * 0.22, s * 0.45, s * 0.44, true);
    metal(d > 0 ? px + s * 0.38 : px - s * 0.5, py - s * 0.3, s * 0.12, s * 0.6, false);
    if (active) { const hx = d > 0 ? px + s * 0.38 : px - s * 0.5, hot = ctx.createLinearGradient(d > 0 ? hx + s * 0.12 : hx, 0, d > 0 ? hx - s * 0.2 : hx + s * 0.32, 0); hot.addColorStop(0, '#f97316cc'); hot.addColorStop(1, '#f9731600'); ctx.fillStyle = hot; ctx.fillRect(d > 0 ? hx - s * 0.2 : hx, py - s * 0.3, s * 0.32, s * 0.6); }
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
  if (y < -s * 4 || y > v.h + s * 4) return;
  if (b.skin === 'meteor') {
    // Meteorito: estela de fuego, resplandor y roca con cráteres.
    const tail = ctx.createLinearGradient(x - p.dir * s * 3.2, y, x, y);
    tail.addColorStop(0, '#f9731600'); tail.addColorStop(0.6, '#f97316aa'); tail.addColorStop(1, '#fde047');
    ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(x - p.dir * s * 3.2, y - s * 0.05); ctx.lineTo(x, y - s * 0.55); ctx.lineTo(x, y + s * 0.55); ctx.fill();
    const glow = ctx.createRadialGradient(x, y, s * 0.3, x, y, s * 1.1);
    glow.addColorStop(0, '#fb923c88'); glow.addColorStop(1, '#fb923c00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, s * 1.1, 0, Math.PI * 2); ctx.fill();
    const rock = ctx.createRadialGradient(x - s * 0.15, y - s * 0.15, s * 0.05, x, y, s * 0.5);
    rock.addColorStop(0, '#a8a29e'); rock.addColorStop(1, '#44403c');
    ctx.fillStyle = rock; ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#292524'; for (const [dx, dy, r] of [[-0.15, 0.1, 0.1], [0.12, -0.12, 0.07], [0.1, 0.18, 0.06]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fde04788'; ctx.beginPath(); ctx.arc(x + p.dir * s * 0.3, y, s * 0.18, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (b.skin === 'drone') { // dron de cuatro hélices, con cámara y luz roja
    ctx.save(); ctx.translate(x, y); ctx.scale(p.dir, 1);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.28); ctx.lineTo(s * 0.6, -s * 0.28); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#334155'; ctx.fillRect(side * s * 0.6 - s * 0.05, -s * 0.42, s * 0.1, s * 0.16);
      ctx.fillStyle = '#cbd5e155'; ctx.beginPath(); ctx.ellipse(side * s * 0.6, -s * 0.44, s * 0.38, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      const a = Math.sin(v.t * 40 + side); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(side * s * 0.6 - s * 0.36 * Math.abs(a), -s * 0.46, s * 0.72 * Math.abs(a), s * 0.04);
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(side * s * 0.2, s * 0.15); ctx.lineTo(side * s * 0.32, s * 0.38); ctx.stroke(); // patitas
    }
    const body = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.2); body.addColorStop(0, '#64748b'); body.addColorStop(1, '#1e293b');
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.45, s * 0.16); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(s * 0.15, s * 0.2, s * 0.13, 0, Math.PI * 2); ctx.fill(); // cámara
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(s * 0.18, s * 0.18, s * 0.05, 0, Math.PI * 2); ctx.fill();
    const blink = Math.sin(v.t * 8 + b.id) > 0;
    ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = blink ? 12 : 4; ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.1, s * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
    return;
  }
  if (b.skin === 'ufo') { drawUfo(ctx, x, y, s, p.dir, v.t, b.id); return; } // ovni
  if (b.skin === 'plane') { drawPlane(ctx, x, y, s, p.dir, [0, 215, 145, 270][b.id % 4], v.t, b.id); return; } // avión de línea
  drawPigeon(ctx, x, y, s, p.dir, v.t, b.id); // paloma
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
      const halo = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
      halo.addColorStop(0, '#f43f5e00'); halo.addColorStop(0.5, '#f43f5e55'); halo.addColorStop(1, '#f43f5e00');
      ctx.fillStyle = halo; ctx.fillRect(x1, y - s * 0.5, x2 - x1, s); // resplandor suave
      ctx.fillStyle = color; ctx.fillRect(x1, y - laserHalf(l) * s, x2 - x1, laserHalf(l) * 2 * s);
      ctx.fillStyle = '#fff1f2'; ctx.fillRect(x1, y - s * 0.04, x2 - x1, s * 0.08);
      ctx.fillStyle = '#ffffffaa'; for (let i = 0; i < 6; i++) { const k = (v.t * 0.9 + i / 6) % 1; ctx.fillRect(x1 + (x2 - x1) * k, y - s * 0.03, s * 0.25, s * 0.06); } // pulsos de energía
    } else { // rayo que zigzaguea
      for (const [c, wdt] of [['#60a5fa44', Math.max(8, s * 0.4)], [color, Math.max(3, s * 0.14)], ['#eff6ff', Math.max(1.5, s * 0.05)]] as const) {
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
      const bx = d > 0 ? ex - s * 0.15 : ex - s * 0.35, body = ctx.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.3);
      body.addColorStop(0, '#6b7280'); body.addColorStop(0.4, '#374151'); body.addColorStop(1, '#111827');
      ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(bx, y - s * 0.3, s * 0.5, s * 0.6, s * 0.1); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(bx + s * 0.05, y - s * 0.27, s * 0.4, s * 0.04); // filo iluminado
      const lens = ctx.createRadialGradient(ex + d * s * 0.1, y, 0, ex + d * s * 0.1, y, s * 0.14);
      lens.addColorStop(0, active ? '#ffffff' : '#fca5a5'); lens.addColorStop(1, active ? '#f43f5e' : '#7f1d1d');
      if (active) { ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 12; }
      ctx.fillStyle = lens; ctx.beginPath(); ctx.arc(ex + d * s * 0.1, y, s * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
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
    const box = ctx.createLinearGradient(cx - s * 0.55, 0, cx + s * 0.55, 0); box.addColorStop(0, '#64748b'); box.addColorStop(0.4, '#475569'); box.addColorStop(1, '#1e293b');
    ctx.fillStyle = box; ctx.beginPath(); ctx.roundRect(cx - s * 0.55, yy - s * 0.9, s * 1.1, s * 1.8, s * 0.2); ctx.fill();
    ctx.fillStyle = '#94a3b8'; for (const by of [yy - s * 0.78, yy + s * 0.72]) for (const bx of [cx - s * 0.42, cx + s * 0.42]) { ctx.beginPath(); ctx.arc(bx, by, s * 0.04, 0, Math.PI * 2); ctx.fill(); } // tornillos
    ctx.fillStyle = '#0b1120'; ctx.beginPath(); ctx.arc(cx, yy, s * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#93c5fd22'; ctx.beginPath(); ctx.arc(cx, yy, s * 0.68, 0, Math.PI * 2); ctx.fill(); // aspas girando, borrosas
    ctx.save(); ctx.translate(cx, yy); ctx.rotate(v.t * 18);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); const blade = ctx.createLinearGradient(0, -s * 0.1, 0, s * 0.1); blade.addColorStop(0, '#dbeafe'); blade.addColorStop(1, '#3b82f6'); ctx.fillStyle = blade; ctx.beginPath(); ctx.ellipse(s * 0.35, 0, s * 0.33, s * 0.12, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = '#94a3b8aa'; ctx.lineWidth = 1; for (let g = 0.25; g < 0.8; g += 0.18) { ctx.beginPath(); ctx.arc(cx, yy, s * g, 0, Math.PI * 2); ctx.stroke(); } // rejilla
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(cx, yy, s * 0.1, 0, Math.PI * 2); ctx.fill();
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
  const red = ctx.createLinearGradient(x - s * 0.8, 0, x + s * 0.8, 0); red.addColorStop(0, '#f87171'); red.addColorStop(0.45, '#dc2626'); red.addColorStop(1, '#7f1d1d');
  ctx.strokeStyle = red; ctx.beginPath(); ctx.arc(x, my, s * 0.55, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#fecaca88'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(x, my, s * 0.66, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke(); // brillo
  for (const tx of [x - s * 0.73, x + s * 0.37]) { const tip = ctx.createLinearGradient(tx, 0, tx + s * 0.36, 0); tip.addColorStop(0, '#f8fafc'); tip.addColorStop(1, '#9ca3af'); ctx.fillStyle = tip; ctx.fillRect(tx, my, s * 0.36, s * 0.45); }
  ctx.lineCap = 'round';
}

function drawGear(ctx: CanvasRenderingContext2D, gr: Gear, v: View) {
  const s = v.s, x = X(v, gr.x), y = Y(v, gr.y), r = gr.r * s;
  if (y < -r * 2 || y > v.h + r * 2) return;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.arc(r * 0.08, r * 0.1, r, 0, Math.PI * 2); ctx.fill(); // sombra
  ctx.rotate(v.t * gr.speed);
  const teeth = 14, metal = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
  metal.addColorStop(0, '#fca5a5'); metal.addColorStop(0.45, '#dc2626'); metal.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = metal; ctx.beginPath();
  for (let i = 0; i < teeth; i++) { // dientes trapezoidales
    const a = i * Math.PI * 2 / teeth, w = Math.PI / teeth;
    ctx.lineTo(Math.cos(a - w * 0.55) * r * 0.82, Math.sin(a - w * 0.55) * r * 0.82);
    ctx.lineTo(Math.cos(a - w * 0.3) * r, Math.sin(a - w * 0.3) * r);
    ctx.lineTo(Math.cos(a + w * 0.3) * r, Math.sin(a + w * 0.3) * r);
    ctx.lineTo(Math.cos(a + w * 0.55) * r * 0.82, Math.sin(a + w * 0.55) * r * 0.82);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fecaca66'; ctx.lineWidth = 1; ctx.stroke(); // bisel
  ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#450a0a'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.12, 0, Math.PI * 2); ctx.fill(); } // agujeros
  const hub = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.3); hub.addColorStop(0, '#f1f5f9'); hub.addColorStop(1, '#64748b');
  ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#334155'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.19, Math.sin(a) * r * 0.19, r * 0.035, 0, Math.PI * 2); ctx.fill(); } // tornillos
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
  // El trepador en versión caricatura: se dibuja más grande que su caja de choque (apoyado en los pies).
  // Al perder cae girando (y chamuscado si se quemó); si le quedan vidas, mientras la cámara sube hasta
  // donde perdió no se ve, y al volver titila suave mientras nada lo lastima.
  const p = g.player, s = v.s;
  if (g.hurt?.phase === 'rise') return;
  const falling = !!g.dying || !!g.hurt;
  const pw = PLAYER_W * s, ph = PLAYER_H * s, big = 1.55;
  const dw = pw * big, dh = ph * big, fx = X(v, p.x), fy = Y(v, p.y);
  const px = fx - dw / 2, py = fy - dh;
  const burnt = g.dying?.reason === 'burn' || g.hurt?.reason === 'burn';
  ctx.save();
  if (g.invuln > 0 && Math.sin(v.t * 22) > 0.2) ctx.globalAlpha = 0.35;
  if (falling) { ctx.translate(fx, fy - dh / 2); ctx.rotate(p.spin); ctx.translate(-fx, -(fy - dh / 2)); }
  drawClimber(ctx, { x: px, y: py, w: dw, h: dh, facing: p.facing, time: v.t, running: p.vx !== 0 && !!p.ground, airborne: !p.ground && !p.climb, climbing: !!p.climb, falling, burnt });
  ctx.restore();
  if (burnt) { // humito
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,113,108,${0.5 - i * 0.12})`; ctx.beginPath(); ctx.arc(fx + Math.sin(v.t * 6 + i) * pw * 0.4, py - i * pw * 0.6, pw * (0.25 + i * 0.1), 0, Math.PI * 2); ctx.fill(); }
  }
}

function draw(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  drawBackground(ctx, v, g.flash, g.bolt ? X(v, g.bolt.x) : null);
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
    const storm = weatherAt(wy).storm;
    ctx.globalAlpha = 0.55 + storm * 0.05; // (las negras, no tanto: que se vea el personaje)
    if (storm > 0.5) stormPuff(ctx, x, y, s * (5 + hash(i + 900) * 4)); // en la tormenta, nubes negras
    else puff(ctx, x, y, s * (5 + hash(i + 900) * 4), i % 3 ? '#ffffff' : '#e2e8f0');
  }
  ctx.globalAlpha = 1;
  drawStorm(ctx, g, v);
}

// La tormenta, adelante de todo: la lluvia fuerte en diagonal (con el viento), el rayo y el fogonazo blanco.
function drawStorm(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  const storm = weatherAt(v.cam + v.h / v.s / 2).storm;
  if (storm <= 0) return;
  // El rayo: una línea quebrada que baja desde las nubes, con ramas y resplandor.
  if (g.bolt && g.flash > 0.12) {
    const r = (n: number) => hash(g.bolt!.seed + n);
    let x = X(v, g.bolt.x), y = -10;
    const end = v.h * (0.55 + r(1) * 0.35), pts: [number, number][] = [[x, y]];
    for (let k = 0; y < end; k++) { y += 18 + r(k + 10) * 30; x += (r(k + 50) - 0.5) * 50; pts.push([x, y]); }
    ctx.save(); ctx.globalAlpha = storm; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [width, color, blur] of [[10, 'rgba(165,180,252,0.35)', 30], [4, '#e0e7ff', 16], [1.8, '#ffffff', 0]] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = '#c7d2fe'; ctx.shadowBlur = blur;
      ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
      for (let b = 2; b < pts.length - 1; b += 3) { // ramitas
        const [bx, by] = pts[b], len = 3 + Math.floor(r(b + 90) * 3);
        ctx.beginPath(); ctx.moveTo(bx, by); let cx = bx, cy = by;
        for (let k = 0; k < len; k++) { cx += (r(b * 7 + k) - 0.3) * 40 * (b % 2 ? 1 : -1); cy += 12 + r(b + k) * 18; ctx.lineTo(cx, cy); }
        ctx.lineWidth = width * 0.5; ctx.stroke();
      }
    }
    ctx.restore();
  }
  // La lluvia: gotas largas en diagonal, en dos capas (las de adelante más grandes y rápidas).
  ctx.save(); ctx.lineCap = 'round';
  for (const [n, speed, len, alpha, width] of [[160, 1100, 18, 0.35, 1], [90, 1500, 30, 0.5, 1.6]] as const) {
    ctx.strokeStyle = `rgba(200,215,235,${alpha * storm})`; ctx.lineWidth = width; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const fall = (hash(i * 3 + len) * (v.h + 60) + v.t * speed) % (v.h + 60) - 30, x = ((hash(i * 7 + len) * (v.w + 80) - fall * 0.25) % (v.w + 80) + v.w + 80) % (v.w + 80) - 40;
      ctx.moveTo(x, fall); ctx.lineTo(x - len * 0.25, fall + len);
    }
    ctx.stroke();
  }
  ctx.restore();
  // El fogonazo blanco que ilumina toda la pantalla.
  if (g.flash > 0) { ctx.fillStyle = `rgba(230,236,255,${Math.min(0.3, g.flash * 0.8) * storm})`; ctx.fillRect(0, 0, v.w, v.h); }
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
  // La partida se arma una sola vez (no en cada vez que se vuelve a dibujar el componente).
  const [firstGame] = useState(() => newTrepa());
  const gameRef = useRef<Trepa>(firstGame);
  const camRef = useRef(0);
  const camXRef = useRef(WORLD_W / 2);
  const input = useRef<Input>({ left: false, right: false, jump: false, down: false });
  const recordRef = useRef<TrepaRecord>(readTrepaRecord());
  const brokeRef = useRef(false);
  const strideRef = useRef(0); // de qué lado va la zancada (para que suene un paso cada vez que apoya un pie)
  const litRef = useRef(new Set<number>()); // los caños de fuego que están prendidos (para que la llamarada suene una vez)
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, m: 0, best: 0, lives: LIVES });
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
    draw(ctx, g, { w, h, s: scale, ox, cam: camRef.current, t: g.time + (g.dying?.t ?? 0) + (g.hurt?.t ?? 0) });
  }, []);

  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const { scale, viewW } = viewFor(stage.clientWidth, stage.clientHeight);
    const viewH = stage.clientHeight / scale;
    const target = Math.max(-1.2, g.player.y - viewH * (g.dying || g.hurt?.phase === 'fall' ? 0.5 : 0.38));
    const targetX = Math.max(-1.2, Math.min(WORLD_W - viewW + 1.2, g.player.x - viewW / 2));
    const k = dt < 0 || g.dying || g.hurt ? 1 : Math.min(1, dt * 4);
    camRef.current += (target - camRef.current) * k;
    camXRef.current += (targetX - camXRef.current) * (dt < 0 ? 1 : Math.min(1, dt * 6));
  }, []);

  const start = useCallback(() => {
    playStart();
    preloadTrepaSounds();
    gameRef.current = newTrepa();
    camRef.current = 0;
    follow(-1);
    input.current = { left: false, right: false, jump: false, down: false };
    recordRef.current = readTrepaRecord();
    brokeRef.current = false;
    setHud({ tenths: 0, m: 0, best: 0, lives: LIVES });
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
      // Pasos: suenan cada vez que apoya un pie mientras corre (al ritmo de las piernas del dibujo).
      const stride = Math.sin(g.time * 13) >= 0 ? 1 : -1, p = g.player;
      if (stride !== strideRef.current && p.ground && p.vx !== 0 && !g.dying && !g.hurt) playTrepaStep();
      strideRef.current = stride;
      for (const e of takeEvents(g)) {
        if (e.type === 'jump') playJump();
        if (e.type === 'tramp') playTramp();
        if (e.type === 'crumble') playCrumble();
        if (e.type === 'knock') playKnock();
        if (e.type === 'teleport') playTeleport();
        if (e.type === 'thunder') playThunder(0.35 + e.near * 0.65);
        if (e.type === 'lose') playLose(e.reason);
        if (e.type === 'win') playWinFanfare();
        if (e.type === 'gameover') playGameOver(true);
        if (e.type === 'zone' && ZONE_MESSAGES[e.zone]) setToast({ text: ZONE_MESSAGES[e.zone], id: now });
        if (e.type === 'lose') setToast({ text: LOSE_TEXT[e.reason], id: now });
      }
      // Cada caño de fuego cercano que se prende suena con la llamarada grabada.
      const lit = litRef.current, px = g.player.x, py = g.player.y + PLAYER_H / 2;
      for (const f of g.fires) {
        const on = fireActive(f, g.time);
        if (!on) { lit.delete(f.id); continue; }
        if (lit.has(f.id)) continue;
        lit.add(f.id);
        const r = fireRect(f), d = Math.hypot(Math.max(r.x1 - px, 0, px - r.x2), Math.max(r.y1 - py, 0, py - r.y2));
        if (d < HEAR_RADIUS && !g.dying && !g.hurt) playFlame(1 - d / HEAR_RADIUS);
      }
      // Sonidos de los objetos cercanos (fuego, motores, viento…); se apagan al perder.
      setAmbient(g.dying || g.hurt ? null : ambientLevels(g));
      follow(dt);
      paint();
      const m = meters(g.player.y), best = meters(g.best);
      // ¡Rompiste el récord! (una vez por partida, cuando superás la altura del récord anterior).
      const prev = recordRef.current.height;
      if (!brokeRef.current && prev > 0 && best > prev && !g.dying) { brokeRef.current = true; setToast({ text: '¡Rompiste el récord!', id: now, big: true }); }
      const shown = { tenths: Math.floor(g.time * 10), m, best, lives: g.lives };
      setHud(p => p.tenths === shown.tenths && p.m === shown.m && p.lives === shown.lives ? p : shown);
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
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); setAmbient(null); };
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
              <h2 id="trepa-message">Trepaluna 🌙</h2>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar (en escaleras, mantené para trepar) · <kbd>↓</kbd> bajar · <kbd>P</kbd> pausa</p>
              <p className="runner-tip">💡 No te quemes ni te caigas muy abajo: llegá a la Luna y clavá el banderín. Tenés 3 vidas: si perdés una, seguís desde donde estabas.</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="trepa-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={false} id="trepa-message" />
              <p>{LOSE_TEXT[result.reason]} Llegaste a <strong>{fmtM(result.m)} m</strong> en {formatTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <EndBanner win id="trepa-message" />
              <p className="end-reason">¡Felicitaciones: misión cumplida!!!</p>
              <p>Clavaste el banderín en la Luna en <strong>{formatTime(result.time)}</strong>.{result.newRecord && ' ¡Rompiste el récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side" aria-label="Tiempo y metros">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="trepa-time">{formatTime(hud.tenths / 10)}</strong></div>
        <div className="trepa-stat"><span>Metros</span><strong data-testid="trepa-meters">{fmtM(hud.m)}</strong></div>
        <div className="trepa-stat" aria-label={`Vidas: ${hud.lives}`}><span>Vidas</span><strong className="trepa-lives">{Array.from({ length: LIVES }, (_, i) => <b key={i} className={i < hud.lives ? '' : 'trepa-lost'}>♥</b>)}</strong></div>
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
