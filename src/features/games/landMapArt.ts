// Land of Warriors: el dibujo del escenario generado (se pinta una sola vez en un lienzo grande y después se copia).
import { BLOCK, BRIDGE, LIQUID, T, THEMES, type Terrain, type Theme } from './landMap';
import materialUrl from './assets/land/terrain-materials.webp';
import { drawWorldProp } from './landProps';

const WATER_URL = Object.values(import.meta.glob('./assets/land/liquids.webp', { eager: true, import: 'default' }))[0] as string | undefined;
let WATER: HTMLImageElement | null = null;
const WATER_TILES: HTMLCanvasElement[] = [];
let MATERIALS: HTMLImageElement | null = null;
const MATERIAL_TILES: HTMLCanvasElement[] = [];
export function terrainMaterialsReady() {
  if (!MATERIALS && typeof Image !== 'undefined') { MATERIALS = new Image(); MATERIALS.src = materialUrl; }
  if (!WATER && WATER_URL && typeof Image !== 'undefined') { WATER = new Image(); WATER.src = WATER_URL; }
  return !!MATERIALS && MATERIALS.complete && MATERIALS.naturalWidth > 0 && (!WATER_URL || (!!WATER && WATER.complete && WATER.naturalWidth > 0));
}
function waterTile(theme: number) {
  terrainMaterialsReady(); if (!WATER || !WATER.complete || !WATER.naturalWidth) return null;
  const index = theme === 7 ? 1 : theme === 0 ? 2 : theme === 2 ? 3 : theme === 9 ? 4 : theme === 6 ? 5 : 0;
  if (WATER_TILES[index]) return WATER_TILES[index];
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d')!, w = WATER.naturalWidth / 3, h = WATER.naturalHeight / 2;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    ctx.save(); ctx.translate(col ? 512 : 0, row ? 512 : 0); ctx.scale(col ? -1 : 1, row ? -1 : 1);
    ctx.drawImage(WATER, index % 3 * w, Math.floor(index / 3) * h, w, h, 0, 0, 256, 256); ctx.restore();
  }
  WATER_TILES[index] = c; return c;
}
function materialTile(theme: number) {
  if (!terrainMaterialsReady()) return null;
  if (MATERIAL_TILES[theme]) return MATERIAL_TILES[theme];
  const tile = document.createElement('canvas'); tile.width = tile.height = 512;
  const ctx = tile.getContext('2d')!, image = MATERIALS!, w = image.naturalWidth / 5, h = image.naturalHeight / 2;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    ctx.save(); ctx.translate(c ? 512 : 0, r ? 512 : 0); ctx.scale(c ? -1 : 1, r ? -1 : 1);
    ctx.drawImage(image, theme % 5 * w, Math.floor(theme / 5) * h, w, h, 0, 0, 256, 256); ctx.restore();
  }
  MATERIAL_TILES[theme] = tile; return tile;
}

function rng(seed: number) { let s = (seed % 2147483647) || 3; return () => (s = (s * 48271) % 2147483647) / 2147483647; }
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
const shade = (c: string, k: number) => { const A = hex(c); return `rgb(${A.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`; };

// RS: cuántos píxeles por unidad del mundo (más de 1: se ve nítido con la cámara cerca), sin pasarse de memoria.
export const terrainScale = (t: Terrain) => Math.min(1, Math.sqrt(6e6 / (t.w * t.h)));
export interface TerrainRegion { x: number; y: number; w: number; h: number }
export function renderTerrain(t: Terrain, scale = terrainScale(t), region?: TerrainRegion): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = Math.round((region?.w ?? t.w) * scale); cv.height = Math.round((region?.h ?? t.h) * scale);
  const ctx0 = cv.getContext('2d')!; ctx0.scale(scale, scale); if (region) ctx0.translate(-region.x, -region.y);
  const ctx = ctx0, th = THEMES[t.theme], R = rng(t.seed * 7 + 1), { cols, rows, cells } = t;
  const at = (c: number, r: number) => c < 0 || r < 0 || c >= cols || r >= rows ? -1 : cells[r * cols + c];
  // 1) el piso: manchas de color suaves (un lienzo chico agrandado) y encima la textura
  const small = document.createElement('canvas'); small.width = cols; small.height = rows; const sc = small.getContext('2d')!;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = R(); sc.fillStyle = k < 0.33 ? th.ground[0] : k < 0.66 ? mix(th.ground[0], th.ground[1], 0.6) : mix(th.ground[0], th.ground[2], 0.6); sc.fillRect(c, r, 1, 1); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small, 0, 0, t.w, t.h);
  patches(ctx, t, th, R);
  const tile = materialTile(t.theme);
  if (tile) {
    ctx.save(); ctx.globalAlpha = 0.74; ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
    ctx.fillRect(region?.x ?? 0, region?.y ?? 0, region?.w ?? t.w, region?.h ?? t.h); ctx.restore();
  }
  groundTexture(ctx, t, th, region);
  // 2) los caminos de tierra entre las bases y los cristales
  { // (en un lienzo chico: agrandado queda suave, sin desenfocar el lienzo grande)
    const q = 0.125, pc = document.createElement('canvas'); pc.width = Math.ceil(t.w * q); pc.height = Math.ceil(t.h * q); const p = pc.getContext('2d')!; p.scale(q, q);
    p.lineCap = 'round'; p.lineJoin = 'round';
    const [b0, b1] = t.bases.map(([c, r]) => [(c + 0.5) * T, (r + 0.5) * T]);
    const via = t.spots.slice(0, 3).map(([c, r]) => [(c + 0.5) * T, (r + 0.5) * T]);
    for (const [w, a] of [[T * 2.2, 0.35], [T * 1.4, 0.55]] as const) {
      p.strokeStyle = th.path; p.globalAlpha = a; p.lineWidth = w;
      p.beginPath(); p.moveTo(b0[0], b0[1]); for (const v of via) p.lineTo(v[0], v[1]); p.lineTo(b1[0], b1[1]); p.stroke();
      p.beginPath(); p.moveTo(b0[0], b0[1]); p.bezierCurveTo(t.w * 0.3, t.h * 0.2, t.w * 0.7, t.h * 0.8, b1[0], b1[1]); p.stroke();
    }
    ctx.drawImage(pc, 0, 0, t.w, t.h);
  }
  // 3) los líquidos: orilla, borde y fondo (círculos superpuestos: formas redondeadas)
  const liq: [number, number][] = [], bridges: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = cells[r * cols + c]; if (k === LIQUID || k === BRIDGE) liq.push([c, r]); if (k === BRIDGE) bridges.push([c, r]); }
  // (se pinta en un lienzo a un cuarto del tamaño y se agranda: así las orillas quedan suaves sin desenfocar mil veces)
  const Q = 0.25, lay = document.createElement('canvas'); lay.width = Math.ceil(t.w * Q); lay.height = Math.ceil(t.h * Q); const lc = lay.getContext('2d')!;
  const disc = (c: number, r: number, rad: number) => { if (region && ((c + 0.5) * T < region.x - rad || (c + 0.5) * T > region.x + region.w + rad || (r + 0.5) * T < region.y - rad || (r + 0.5) * T > region.y + region.h + rad)) return; lc.beginPath(); lc.arc((c + 0.5) * T * Q, (r + 0.5) * T * Q, rad * Q, 0, Math.PI * 2); lc.fill(); };
  lc.fillStyle = th.shore; for (const [c, r] of liq) disc(c, r, T * 1.18);
  lc.fillStyle = th.liquid[1]; for (const [c, r] of liq) disc(c, r, T * 0.98);
  lc.fillStyle = th.liquid[2]; for (const [c, r] of liq) { let deep = 0; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = at(c + dc, r + dr); if (k === LIQUID || k === BRIDGE) deep++; } if (deep >= 4) disc(c, r, T * 0.8); }
  ctx.drawImage(lay, 0, 0, t.w, t.h); // (orillas suaves)
  const fluid = waterTile(t.theme);
  if (fluid) {
    ctx.save(); ctx.beginPath();
    for (const [c, r] of liq) {
      const x = (c + .5) * T, y = (r + .5) * T;
      if (region && (x < region.x - T || x > region.x + region.w + T || y < region.y - T || y > region.y + region.h + T)) continue;
      ctx.moveTo(x + T * .9, y); ctx.arc(x, y, T * .9, 0, Math.PI * 2);
    }
    ctx.clip(); ctx.globalAlpha = .92; ctx.fillStyle = ctx.createPattern(fluid, 'repeat')!;
    ctx.fillRect(region?.x ?? 0, region?.y ?? 0, region?.w ?? t.w, region?.h ?? t.h); ctx.restore();
  }
  { // espuma en la orilla y reflejo del cielo
    lc.clearRect(0, 0, lay.width, lay.height); lc.fillStyle = '#fff'; for (const [c, r] of liq) disc(c, r, T * 1.02); lc.globalCompositeOperation = 'destination-out'; for (const [c, r] of liq) disc(c, r, T * 0.9); lc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = th.glow ? 0.25 : 0.4; ctx.drawImage(lay, 0, 0, t.w, t.h); ctx.restore();
    const sky = ctx.createLinearGradient(0, 0, t.w, t.h); sky.addColorStop(0, 'rgba(255,255,255,0.10)'); sky.addColorStop(1, 'rgba(255,255,255,0)');
    lc.clearRect(0, 0, lay.width, lay.height); lc.fillStyle = '#fff'; for (const [c, r] of liq) disc(c, r, T * 0.9);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5; ctx.drawImage(lay, 0, 0, t.w, t.h); ctx.restore();
  }
  if (th.glow) { // el resplandor de la lava o del ácido
    lc.clearRect(0, 0, lay.width, lay.height); lc.fillStyle = th.glow; for (const [c, r] of liq) disc(c, r, T * 1.1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.drawImage(lay, 0, 0, t.w, t.h); ctx.restore();
  }
  ctx.save();
  for (const [c, r] of liq) for (let i = 0; i < 2; i++) { // brillos y ondas
    const x = (c + R()) * T, y = (r + R()) * T, w = T * (0.3 + R() * 0.5);
    if (region && (x < region.x - T || x > region.x + region.w + T || y < region.y - T || y > region.y + region.h + T)) continue;
    ctx.strokeStyle = th.glow ? 'rgba(255,240,180,0.55)' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y - 4, x + w / 2, y); ctx.stroke();
  }
  ctx.restore();
  // 4) los puentes (tablones de madera o losas de piedra, según el estilo)
  for (const [c, r] of bridges) { // tablones (o losas) y las barandas arriba y abajo
    if (region && (c * T < region.x - T || c * T > region.x + region.w + T || r * T < region.y - T || r * T > region.y + region.h + T)) continue;
    const x = c * T, y = r * T, stone = th.block === 'ruin' || th.block === 'rock';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 1, y + 8, T + 2, T);
    ctx.fillStyle = stone ? '#77706a' : '#9a6634'; ctx.fillRect(x - 1, y - 4, T + 2, T + 8);
    ctx.strokeStyle = stone ? '#3c3633' : '#4a2e14'; ctx.lineWidth = 2;
    for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * T / 4, y - 4); ctx.lineTo(x + k * T / 4, y + T + 4); ctx.stroke(); }
    ctx.fillStyle = stone ? 'rgba(255,255,255,0.14)' : 'rgba(255,220,160,0.2)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + k * T / 4 + 2, y - 4, 3, T + 8);
    for (const ry of [y - 6, y + T + 2]) { ctx.fillStyle = stone ? '#4e4743' : '#5a3418'; ctx.fillRect(x - 1, ry, T + 2, 5); ctx.fillRect(x + T / 2 - 3, ry - 6, 6, 11); }
  }
  // 5) los obstáculos y los adornos, de atrás para adelante (los de más abajo tapan a los de más arriba)
  const things: { x: number; y: number; d: () => void }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (cells[r * cols + c] === BLOCK) {
    const x = (c + 0.5) * T + (R() - 0.5) * 10, y = (r + 0.5) * T + (R() - 0.5) * 10, kind = th.block === 'mixed' ? (R() < 0.6 ? 'rock' : 'forest') : th.block === 'cactus' || th.block === 'coral' ? (R() < 0.5 ? th.block : 'rock') : th.block === 'dead' ? (R() < 0.55 ? 'dead' : 'forest') : th.block, s = 0.85 + R() * 0.5, seed = R();
    things.push({ x, y, d: () => kind === 'pine' ? pine(ctx, x, y + 12, s, th, seed) : kind === 'dead' ? deadTree(ctx, x, y + 12, s, th, seed) : kind === 'cactus' ? cactus(ctx, x, y + 12, s, th, seed) : kind === 'coral' ? coral(ctx, x, y + 10, s, th, seed) : kind === 'forest' ? tree(ctx, x, y + 12, s, th, seed) : kind === 'ruin' ? (seed < 0.35 ? pillar(ctx, x, y + 14, s, th) : rock(ctx, x, y + 10, s * 1.1, th, seed)) : rock(ctx, x, y + 10, s * 1.15, th, seed) });
  }
  const nDecor = Math.round(cols * rows * 0.09);
  for (let i = 0; i < nDecor; i++) {
    const c = Math.floor(R() * cols), r = Math.floor(R() * rows); if (cells[r * cols + c] !== 0) continue;
    const x = (c + R()) * T, y = (r + R()) * T, d = th.decor[Math.floor(R() * th.decor.length)], seed = R();
    things.push({ x, y: y - 30, d: () => decor(ctx, d, x, y, th, seed) });
  }
  things.sort((a, b) => a.y - b.y); for (const o of things) if (!region || (o.y > region.y - 120 && o.y < region.y + region.h + 160 && o.x > region.x - 100 && o.x < region.x + region.w + 100)) o.d();
  // 6) luz: un poco más claro arriba a la izquierda y los bordes oscuros
  const lg = ctx.createLinearGradient(0, 0, t.w, t.h); lg.addColorStop(0, 'rgba(255,240,210,0.08)'); lg.addColorStop(1, 'rgba(0,0,20,0.12)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, t.w, t.h);
  const vg = ctx.createRadialGradient(t.w / 2, t.h / 2, Math.min(t.w, t.h) * 0.45, t.w / 2, t.h / 2, Math.max(t.w, t.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, t.w, t.h);
  return cv;
}
// La textura del piso: puntitos, piedritas, briznas o grietas según el estilo.
function groundTexture(ctx: CanvasRenderingContext2D, t: Terrain, th: Theme, region?: TerrainRegion) {
  // Semilla por celda: la vista general y el primer plano comparten exactamente la misma textura.
  const step = 18, x0 = Math.max(0, Math.floor((region?.x ?? 0) / step) - 1), y0 = Math.max(0, Math.floor((region?.y ?? 0) / step) - 1);
  const x1 = Math.min(Math.ceil(t.w / step), Math.ceil(((region?.x ?? 0) + (region?.w ?? t.w)) / step) + 1);
  const y1 = Math.min(Math.ceil(t.h / step), Math.ceil(((region?.y ?? 0) + (region?.h ?? t.h)) / step) + 1);
  for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) {
    const R = rng(Math.abs(Math.imul(cx + 1, 73856093) ^ Math.imul(cy + 1, 19349663) ^ t.seed));
    const x = (cx + R()) * step, y = (cy + R()) * step, k = R();
    if (th.decor.includes('grass') || th.block === 'forest') {
      ctx.strokeStyle = k < 0.5 ? shade(th.ground[1], 1.18) : shade(th.ground[2], 0.85); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 4, y - 3 - R() * 5); ctx.stroke();
    } else {
      ctx.fillStyle = k < 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y, 1 + R() * 3, 1 + R() * 2);
    }
    if (k > 0.9) {
      const size = 1 + R() * 3; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 1, y + 2, size + 1, size);
      ctx.fillStyle = shade(th.ground[1], 1.3); ctx.fillRect(x, y, size, size * 0.6);
    }
  }
}
// Manchas grandes de otro tono (tierra, pasto alto, piedra) con borde irregular: el piso deja de ser parejo.
function patches(ctx: CanvasRenderingContext2D, t: Terrain, th: Theme, R: () => number) {
  const q = 0.08, pc = document.createElement('canvas'); pc.width = Math.ceil(t.w * q); pc.height = Math.ceil(t.h * q); const p = pc.getContext('2d')!; p.scale(q, q);
  const n = Math.round(t.w * t.h / 90000);
  for (let i = 0; i < n; i++) {
    const x = R() * t.w, y = R() * t.h, r = 60 + R() * 160, col = R() < 0.5 ? shade(th.ground[2], 0.9) : shade(th.ground[1], 1.08);
    p.globalAlpha = 0.35 + R() * 0.25; p.fillStyle = col; p.beginPath();
    for (let a = 0; a <= 16; a++) { const ang = a / 16 * Math.PI * 2, rr = r * (0.7 + R() * 0.5); const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.7; if (a) p.lineTo(px, py); else p.moveTo(px, py); }
    p.closePath(); p.fill();
  }
  ctx.drawImage(pc, 0, 0, t.w, t.h);
}
function pine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  if (drawWorldProp(ctx, 1, x, y + 3, 100 * s, 70 * s, seed > .5)) return;
  const R = rng(Math.floor(seed * 1e6)), h = 70 * s, w = 26 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, w * 1.1, w * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 12 * s);
  for (let k = 0; k < 4; k++) { const ty = y - 10 * s - k * h * 0.2, tw = w * (1 - k * 0.2);
    ctx.fillStyle = k % 2 ? th.leaf[0] : th.leaf[2]; ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - h * 0.38); ctx.lineTo(x + tw, ty); ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.moveTo(x - tw * 0.9, ty - 1); ctx.lineTo(x, ty - h * 0.36); ctx.lineTo(x - tw * 0.1, ty - 1); ctx.closePath(); ctx.fill();
    if (th.ground[0] > '#c') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(x - tw * 0.5, ty - h * 0.14); ctx.lineTo(x, ty - h * 0.36); ctx.lineTo(x + tw * 0.4, ty - h * 0.16); ctx.quadraticCurveTo(x, ty - h * 0.2 + R() * 4, x - tw * 0.5, ty - h * 0.14); ctx.fill(); } } // (nieve)
}
function deadTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  if (drawWorldProp(ctx, 3, x, y + 3, 98 * s, 100 * s, seed > .5)) return;
  const R = rng(Math.floor(seed * 1e6));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 2, 20 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  const branch = (bx: number, by: number, a: number, len: number, w: number, d: number) => { const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len; ctx.strokeStyle = shade(th.rock[1], 1.2); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); if (d > 0) { branch(ex, ey, a - 0.5 - R() * 0.3, len * 0.65, w * 0.6, d - 1); branch(ex, ey, a + 0.4 + R() * 0.3, len * 0.6, w * 0.6, d - 1); } };
  branch(x, y, -Math.PI / 2 + (R() - 0.5) * 0.2, 34 * s, 7 * s, 3);
}
function cactus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  const R = rng(Math.floor(seed * 1e6)), h = 50 * s, w = 9 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 2, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  const stem = (sx: number, sy: number, sw: number, sh: number) => { const g = ctx.createLinearGradient(sx - sw, 0, sx + sw, 0); g.addColorStop(0, th.leaf[1]); g.addColorStop(0.6, th.leaf[0]); g.addColorStop(1, th.leaf[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(sx - sw, sy - sh, sw * 2, sh, sw); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke(); };
  stem(x, y, w, h); const ah = h * (0.35 + R() * 0.2);
  stem(x - w * 2, y - h * 0.35, w * 0.7, ah); ctx.fillStyle = th.leaf[0]; ctx.fillRect(x - w * 2, y - h * 0.42, w * 2, w * 0.9);
  stem(x + w * 2, y - h * 0.5, w * 0.7, ah * 0.8); ctx.fillRect(x, y - h * 0.57, w * 2, w * 0.9);
}
function coral(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  if (drawWorldProp(ctx, 7, x, y + 3, 58 * s, 80 * s, seed > .5)) return;
  const R = rng(Math.floor(seed * 1e6));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 2, 22 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.32, len = (22 + R() * 18) * s, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    ctx.strokeStyle = i % 2 ? th.leaf[0] : th.leaf[1]; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.4 + (R() - 0.5) * 10, y + Math.sin(a) * len * 0.6, ex, ey); ctx.stroke();
    ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.arc(ex, ey, 4 * s, 0, Math.PI * 2); ctx.fill(); }
}
function rock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  if (drawWorldProp(ctx, 4, x, y + 3, 47 * s, 82 * s, seed > .5)) return;
  const w = 30 * s, h = 34 * s, R = rng(Math.floor(seed * 1e6));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 2, w * 0.95, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  const pts: [number, number][] = []; for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI, rr = 0.75 + R() * 0.35; pts.push([x + Math.cos(a) * w * rr, y + Math.sin(a) * h * rr]); }
  ctx.beginPath(); ctx.moveTo(x - w, y); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(x + w, y); ctx.closePath();
  const g = ctx.createLinearGradient(x - w, y - h, x + w * 0.6, y); g.addColorStop(0, shade(th.rock[0], 1.35)); g.addColorStop(0.5, th.rock[0]); g.addColorStop(1, th.rock[1]); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 65; i++) { const px = x + (R() - 0.5) * w * 2, py = y - R() * h; ctx.fillStyle = i % 2 ? 'rgba(255,240,218,0.16)' : 'rgba(15,12,12,0.22)'; ctx.fillRect(px, py, 0.5 + R() * 2.5, 0.5 + R() * 1.5); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - h * 0.8); ctx.lineTo(x, y - h * 0.3); ctx.lineTo(x + w * 0.3, y); ctx.stroke(); // grieta
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - h * 0.3); ctx.lineTo(x - w * 0.35, y - h * 0.85); ctx.lineTo(x - w * 0.15, y - h * 0.7); ctx.lineTo(x - w * 0.5, y - h * 0.2); ctx.closePath(); ctx.fill(); // la cara con luz
}
function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  ctx.save(); if (th.leaf[0] === '#c2541e') ctx.filter = 'sepia(.85) saturate(1.3)';
  const detailed = drawWorldProp(ctx, 0, x, y + 3, 90 * s, 95 * s, seed > .5); ctx.restore(); if (detailed) return;
  const R = rng(Math.floor(seed * 1e6)), h = 68 * s, rad = 29 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + 14 * s, y + 4 * s, rad * 1.25, rad * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
  const bark = ctx.createLinearGradient(x - 5 * s, y, x + 5 * s, y); bark.addColorStop(0, '#8b6742'); bark.addColorStop(0.5, '#54391f'); bark.addColorStop(1, '#271d16');
  ctx.strokeStyle = bark; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 2 * s, y - h * 0.45, x + 2 * s, y - h); ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const dx = (R() - 0.5) * rad * 1.5, dy = -h * (0.55 + R() * 0.4);
    ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, y - h * 0.35); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  }
  for (let i = 0; i < 38; i++) {
    const a = R() * Math.PI * 2, radius = Math.sqrt(R()), ox = Math.cos(a) * radius * rad, oy = Math.sin(a) * radius * rad * 0.7;
    const rr = (4 + R() * 8) * s, px = x + ox, py = y - h * 0.79 + oy;
    const leaf = ctx.createRadialGradient(px - rr * 0.4, py - rr * 0.4, 0, px, py, rr);
    leaf.addColorStop(0, shade(th.leaf[1], 0.85 + R() * 0.3)); leaf.addColorStop(0.45, th.leaf[0]); leaf.addColorStop(1, th.leaf[2]);
    ctx.fillStyle = leaf; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230,245,160,0.18)'; for (let j = 0; j < 3; j++) ctx.fillRect(px + (R() - 0.5) * rr, py + (R() - 0.5) * rr, s, s * 1.6);
  }
}
function pillar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme) {
  if (drawWorldProp(ctx, 6, x, y, 72 * s, 72 * s)) return;
  const w = 14 * s, h = 64 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, w * 1.6, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(th.rock[0], 1.4)); g.addColorStop(0.6, th.rock[0]); g.addColorStop(1, th.rock[1]);
  ctx.fillStyle = g; ctx.fillRect(x - w, y - h, w * 2, h); ctx.fillRect(x - w * 1.35, y - h - 8 * s, w * 2.7, 9 * s); ctx.fillRect(x - w * 1.35, y - 8 * s, w * 2.7, 8 * s);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w, y - h, w * 2, h);
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - w + k * w / 2, y - h); ctx.lineTo(x - w + k * w / 2, y - 8 * s); ctx.stroke(); } // estrías
  ctx.fillStyle = th.rock[1]; ctx.beginPath(); ctx.moveTo(x + w, y - h - 8 * s); ctx.lineTo(x + w * 0.2, y - h - 8 * s); ctx.lineTo(x + w, y - h + 10 * s); ctx.closePath(); ctx.fill(); // roto arriba
}
function decor(ctx: CanvasRenderingContext2D, d: Theme['decor'][number], x: number, y: number, th: Theme, seed: number) {
  if (d === 'bush' && drawWorldProp(ctx, 0, x, y, 25, 33)) return;
  if (d === 'pebble' && drawWorldProp(ctx, 4, x, y, 10, 18)) return;
  if (d === 'grass' && drawWorldProp(ctx, 11, x, y, 14, 19)) return;
  if (d === 'palm' && drawWorldProp(ctx, 2, x, y, 75, 80)) return;
  if (d === 'reed' && drawWorldProp(ctx, 11, x, y, 35, 45)) return;
  const R = rng(Math.floor(seed * 1e6) + 5);
  if (d === 'bush') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 4; i++) { ctx.fillStyle = i < 2 ? th.leaf[2] : th.leaf[0]; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 14, y - 5 - R() * 6, 6 + R() * 4, 0, Math.PI * 2); ctx.fill(); } }
  else if (d === 'flower') { for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff7ac8', '#fff27a', '#ffffff', '#c58aff'][Math.floor(R() * 4)]; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 18, y + (R() - 0.5) * 10, 2.2, 0, Math.PI * 2); ctx.fill(); } }
  else if (d === 'grass') { ctx.strokeStyle = shade(th.ground[1], 1.3); ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.stroke(); } }
  else if (d === 'pebble') { for (let i = 0; i < 3; i++) { const px = x + (R() - 0.5) * 16, py = y + (R() - 0.5) * 8, s = 3 + R() * 4; ctx.fillStyle = shade(th.rock[0], 1.2); ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); } }
  else if (d === 'crack') { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); let px = x, py = y; for (let i = 0; i < 4; i++) { px += (R() - 0.3) * 14; py += (R() - 0.5) * 10; ctx.lineTo(px, py); } ctx.stroke(); if (th.glow) { ctx.strokeStyle = th.glow + '66'; ctx.lineWidth = 1; ctx.stroke(); } }
  else if (d === 'mushroom') { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x - 1.5, y - 7, 3, 7); ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.ellipse(x, y - 7, 6, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 9, 1.5, 1.5); }
  else if (d === 'crystal') { for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 6, h = 8 + R() * 10; ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.moveTo(px - 3, y); ctx.lineTo(px, y - h); ctx.lineTo(px + 3, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(px - 1, y - h * 0.8, 1.2, h * 0.5); } }
  else if (d === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 14 + R() * 10, 5 + R() * 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(150,180,210,0.4)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 10, 3, 0, 0, Math.PI); ctx.fill(); }
  else if (d === 'reed') { ctx.strokeStyle = shade(th.leaf[1], 1.1); ctx.lineWidth = 1.8; for (let i = 0; i < 5; i++) { const px = x + (i - 2) * 3; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + (R() - 0.5) * 6, y - 14 - R() * 8); ctx.stroke(); } ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 1, y - 22, 3, 7); }
  else if (d === 'leaves') { for (let i = 0; i < 6; i++) { ctx.fillStyle = th.leaf[Math.floor(R() * 3)]; ctx.save(); ctx.translate(x + (R() - 0.5) * 22, y + (R() - 0.5) * 12); ctx.rotate(R() * 6); ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }
  else if (d === 'shell') { ctx.fillStyle = '#f2d8c0'; ctx.beginPath(); ctx.arc(x, y, 5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a0785a'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * 2.3, y - 4.5); ctx.stroke(); } }
  else if (d === 'palm') { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 20, x + 2, y - 34); ctx.stroke(); ctx.strokeStyle = th.leaf[0]; ctx.lineWidth = 3.5; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + 2, y - 34); ctx.quadraticCurveTo(x + 2 + Math.cos(a) * 12, y - 40 + Math.sin(a) * 6, x + 2 + Math.cos(a) * 20, y - 30 + Math.sin(a) * 8); ctx.stroke(); } }
}

// Reflejos que avanzan sobre el agua, caústicas y deriva orgánica del humedal.
export function drawAmbientTerrain(ctx: CanvasRenderingContext2D, t: Terrain, cam: { x: number; y: number; w: number; h: number; z: number }, time: number) {
  const th = THEMES[t.theme], swamp = t.theme === 7;
  const x0 = Math.max(0, Math.floor(cam.x / T)), x1 = Math.min(t.cols, Math.ceil((cam.x + cam.w / cam.z) / T));
  const y0 = Math.max(0, Math.floor(cam.y / T)), y1 = Math.min(t.rows, Math.ceil((cam.y + cam.h / cam.z) / T));
  ctx.save(); ctx.lineCap = 'round';
  for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) if (t.cells[r * t.cols + c] === LIQUID) {
    const k = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ t.seed) >>> 0, x = (c + .5) * T, y = (r + .5) * T;
    const phase = time * (swamp ? .4 : .9) + k % 100;
    ctx.save(); ctx.beginPath(); ctx.rect(c * T, r * T, T, T); ctx.clip();
    const sheen = ctx.createLinearGradient(x - 22, y - 20, x + 22, y + 20);
    sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(.48 + Math.sin(phase) * .12, swamp ? 'rgba(175,195,130,.10)' : th.glow ? 'rgba(255,215,70,.22)' : 'rgba(160,222,250,.18)'); sheen.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sheen; ctx.fillRect(c * T, r * T, T, T);
    for (let i = 0; i < 3; i++) {
      const yy = y - 16 + i * 12 + Math.sin(phase + i) * 2, xx = x + Math.sin(phase * .4 + i) * 5;
      ctx.strokeStyle = swamp ? 'rgba(194,209,156,.18)' : 'rgba(218,245,255,.25)'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(xx - 12, yy); ctx.bezierCurveTo(xx - 3, yy - 2, xx + 3, yy + 2, xx + 12, yy); ctx.stroke();
    }
    if (swamp && k % 5 === 0) { ctx.fillStyle = 'rgba(65,93,32,.62)'; ctx.beginPath(); ctx.ellipse(x + Math.sin(phase * .2) * 3, y, 5, 2.7, -.4, 0, Math.PI * 1.8); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}
