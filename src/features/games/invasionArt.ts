// Cómo se dibuja la ciudad de "Invasión": edificios en corte (se ve cada departamento por dentro, con sus
// paredes, ventanas, muebles y cosas colgadas), locales y bares en planta baja con sus carteles y toldos,
// una obra en construcción con andamios y grúa, pasajes entre edificios, la vereda con faroles, árboles,
// paradas de colectivo y la calle con autos; el cielo que se va poniendo rojo, los ovnis, el fuego, el humo
// y los edificios destruidos.
//
// Lo que no se mueve de cada habitación se dibuja una sola vez en una imagen aparte (para cada zoom) y
// después se copia: así se puede dibujar con mucho detalle sin que se trabe.
import { drawUfoCraftAt } from './kombatPenUfo';
import {
  alienKind, CITY_TOP, SIDE_W, GAME_SECONDS, hitbox, rainAt, ROCKET_TIME, type Rocket, ROAD_Y, ruinAt, SHOP_NAMES, UFO_FROM, type Building, type Furniture, type Invasion, type Item, type Room,
} from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import bazookaFxUrl from './assets/invasion/efectos/bazooka.webp';
import missileUrl from './assets/invasion/efectos/misil.webp';
import ufoFxUrl from './assets/invasion/efectos/explosion-ovni.webp';
import wallpaperUrl from './assets/invasion/fondo.webp';
import { drawPerson, drawProp, font, hash, hsl, mixColor } from './invasionPeople';

export interface View { w: number; h: number; s: number; cx: number; cy: number; t: number; dpr: number }
export const X = (v: View, x: number) => v.w / 2 + (x - v.cx) * v.s;
export const Y = (v: View, y: number) => v.h / 2 - (y - v.cy) * v.s;
const visible = (v: View, x1: number, x2: number, y1: number, y2: number) => X(v, x2) > -30 && X(v, x1) < v.w + 30 && Y(v, y1) > -30 && Y(v, y2) < v.h + 30;
export const ZOOMS = [12, 18, 26, 38, 55, 80, 115, 170, 250];
export const SKY_TOP = CITY_TOP + 6;

// ---------- Cielo y fondo ----------
function skyColors(t: number) {
  const k = ruinAt(t), dusk = Math.min(1, t / GAME_SECONDS), rain = rainAt(t);
  // Con la tormenta el cielo se pone gris oscuro (y con los ovnis, rojo de fuego).
  const top = mixColor(mixColor(mixColor('#3b82f6', '#4c1d95', dusk * 0.7), '#111827', rain * 0.85), '#1c0a0a', k);
  const mid = mixColor(mixColor(mixColor('#93c5fd', '#f97316', dusk * 0.8), '#374151', rain * 0.85), '#7f1d1d', k * 0.8);
  const low = mixColor(mixColor(mixColor('#e0f2fe', '#fcd34d', dusk * 0.8), '#4b5563', rain * 0.8), '#ea580c', k * 0.8);
  return { top, mid, low };
}
// ---------- Los edificios de los costados ----------
// Más allá de la cuadra (antes de x = 0 y después del ancho) el escenario sigue con edificios cerrados (no se ve
// adentro): torres, oficinas, locales con su cartel, una fábrica y obras en construcción con grúa. Son decorado:
// no se rompen. Hay gente en las ventanas (siluetas que se mueven) y la vereda de adelante es parte de la calle,
// así que caminan personas y aliens. Se arman siempre iguales (`sideBlocks`), hasta el final del escenario.
type SideKind = 'tower' | 'office' | 'shops' | 'factory' | 'works';
interface SideBlock { x: number; w: number; h: number; kind: SideKind; hue: number; seed: number }
const SIDE_KINDS: SideKind[] = ['tower', 'shops', 'works', 'office', 'factory', 'tower', 'shops', 'office', 'works', 'tower', 'factory', 'shops'];
const SIDE_SIGNS = ['KIOSCO', 'FARMACIA', 'PANADERÍA', 'FERRETERÍA', 'BAR', 'PIZZERÍA', 'LAVADERO', 'CERRAJERÍA', 'ÓPTICA', 'ALMACÉN'];
let sideCache: { width: number; blocks: SideBlock[] } | null = null;
function sideBlocks(width: number) {
  if (sideCache?.width === width) return sideCache.blocks;
  const blocks: SideBlock[] = [];
  for (const dir of [-1, 1]) {
    let edge = dir < 0 ? -1.4 : width + 1.4;
    for (let i = 0; Math.abs(edge - (dir < 0 ? 0 : width)) < SIDE_W + 25; i++) {
      const seed = (dir < 0 ? 100 : 200) + i, kind = SIDE_KINDS[(i + (dir < 0 ? 0 : 5)) % SIDE_KINDS.length], q = hash(seed * 7.1);
      const w = kind === 'factory' ? 18 + q * 7 : kind === 'shops' ? 10 + q * 5 : 10 + q * 5;
      const h = kind === 'tower' ? 30 + q * 18 : kind === 'office' ? 24 + q * 14 : kind === 'works' ? 20 + q * 16 : kind === 'factory' ? 9 + q * 3 : 8.6 + q * 3;
      const x = dir < 0 ? edge - w : edge;
      blocks.push({ x, w, h, kind, hue: Math.floor(hash(seed * 3.3) * 360), seed });
      edge = dir < 0 ? x - (1.2 + hash(seed) * 1.6) : x + w + 1.2 + hash(seed) * 1.6;
    }
  }
  sideCache = { width, blocks };
  return blocks;
}
function drawSideBlocks(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  const s = v.s;
  for (const b of sideBlocks(g.width)) {
    if (!visible(v, b.x - 6, b.x + b.w + 6, 0, b.h + 12)) continue;
    const x = X(v, b.x), w = b.w * s, base = Y(v, 0), top = Y(v, b.h);
    if (b.kind === 'works') { drawSideWorks(ctx, b, v); continue; }
    // Fachada.
    const wall = b.kind === 'factory' ? `hsl(${8 + (b.hue % 18)},38%,34%)` : b.kind === 'office' ? `hsl(${200 + (b.hue % 30)},16%,40%)` : `hsl(${b.hue},${12 + (b.seed % 10)}%,${46 + (b.seed % 12)}%)`;
    const shade = ctx.createLinearGradient(x, 0, x + w, 0); shade.addColorStop(0, 'rgba(0,0,0,0.18)'); shade.addColorStop(0.15, 'rgba(0,0,0,0)'); shade.addColorStop(0.85, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = wall; ctx.fillRect(x, top, w, base - top); ctx.fillStyle = shade; ctx.fillRect(x, top, w, base - top);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - s * 0.1, top - s * 0.25, w + s * 0.2, s * 0.3); // cornisa
    if (b.kind === 'factory') { drawSideFactory(ctx, b, v); continue; }
    // Ventanas (de lejos, solo franjas).
    const shopH = 3.1, fh = b.kind === 'office' ? 2.6 : 2.8, cols = Math.max(2, Math.round(b.w / (b.kind === 'office' ? 1.4 : 1.8)));
    const cw = b.w / cols, small = cw * s < 5;
    for (let fy = shopH + 0.5; fy + fh * 0.6 < b.h - 0.4; fy += fh) {
      if (small) { ctx.fillStyle = 'rgba(15,23,42,0.45)'; ctx.fillRect(x + s * 0.4, Y(v, fy + fh * 0.65), w - s * 0.8, fh * 0.45 * s); continue; }
      for (let c = 0; c < cols; c++) {
        const lit = hash(b.seed * 13 + c * 7 + fy * 3) < 0.28;
        ctx.fillStyle = b.kind === 'office' ? (lit ? '#fde68a' : '#1e3a5f') : lit ? '#fcd34d' : '#1f2a37';
        const wx = b.x + c * cw + cw * (b.kind === 'office' ? 0.08 : 0.22), ww = cw * (b.kind === 'office' ? 0.84 : 0.56);
        ctx.fillRect(X(v, wx), Y(v, fy + fh * 0.72), ww * s, fh * 0.52 * s);
        const who = hash(b.seed * 5 + c * 11 + fy * 7);
        if (lit && who < 0.55 && ww * s > 6) { // alguien en la ventana: silueta que va y viene
          const px = wx + ww * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(g.time * (0.3 + who) + who * 20))), ph = fh * 0.4, hr = ph * 0.2;
          ctx.fillStyle = 'rgba(30,20,10,0.78)';
          ctx.beginPath(); ctx.arc(X(v, px), Y(v, fy + fh * 0.2 + ph - hr), hr * s, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(X(v, px), Y(v, fy + fh * 0.2), hr * 1.9 * s, ph * 0.6 * s, 0, Math.PI, 0); ctx.fill();
        }
        if (b.kind !== 'office') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(X(v, wx), Y(v, fy + fh * 0.72), ww * s * 0.35, fh * 0.52 * s); }
      }
    }
    // Planta baja: locales con vidriera, toldo y cartel (las torres y las oficinas tienen hall de entrada).
    if (b.kind === 'shops' || b.kind === 'tower') {
      const n = b.kind === 'shops' ? Math.max(1, Math.round(b.w / 5)) : 1, lw = b.w / n;
      for (let i = 0; i < n; i++) {
        const lx = b.x + i * lw, color = `hsl(${(b.hue + i * 97) % 360},62%,44%)`;
        ctx.fillStyle = '#0f172a'; ctx.fillRect(X(v, lx + 0.3), Y(v, 2.3), (lw - 0.6) * s, 2.3 * s); // vidriera
        ctx.fillStyle = 'rgba(253,224,71,0.18)'; ctx.fillRect(X(v, lx + 0.3), Y(v, 2.3), (lw - 0.6) * s, 2.3 * s);
        ctx.fillStyle = '#334155'; ctx.fillRect(X(v, lx + lw * 0.5 - 0.45), Y(v, 2.1), 0.9 * s, 2.1 * s); // puerta
        for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#f8fafc' : color; ctx.fillRect(X(v, lx + 0.2 + k * (lw - 0.4) / 6), Y(v, 2.85), (lw - 0.4) / 6 * s + 0.5, 0.5 * s); } // toldo
        if (s * lw > 40) { // cartel
          ctx.fillStyle = color; ctx.fillRect(X(v, lx + 0.4), Y(v, 3.6), (lw - 0.8) * s, 0.65 * s);
          ctx.fillStyle = '#fff'; ctx.font = font(800, Math.max(7, s * 0.42)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(SIDE_SIGNS[(b.seed + i) % SIDE_SIGNS.length], X(v, lx + lw / 2), Y(v, 3.28), (lw - 1) * s);
        }
      }
    } else { ctx.fillStyle = '#0f172a'; ctx.fillRect(X(v, b.x + b.w * 0.3), Y(v, 2.8), b.w * 0.4 * s, 2.8 * s); ctx.fillStyle = 'rgba(147,197,253,0.25)'; ctx.fillRect(X(v, b.x + b.w * 0.3), Y(v, 2.8), b.w * 0.4 * s, 2.8 * s); }
    // Techo: tanque de agua o antena.
    if (b.seed % 3 === 0) { ctx.fillStyle = '#57534e'; ctx.fillRect(X(v, b.x + b.w * 0.65), Y(v, b.h + 2.2), 1.8 * s, 1.6 * s); ctx.fillRect(X(v, b.x + b.w * 0.67), Y(v, b.h + 0.6), 0.15 * s, 0.6 * s); ctx.fillRect(X(v, b.x + b.w * 0.65 + 1.5), Y(v, b.h + 0.6), 0.15 * s, 0.6 * s); }
    else if (b.seed % 3 === 1) { ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.beginPath(); ctx.moveTo(X(v, b.x + b.w * 0.3), Y(v, b.h)); ctx.lineTo(X(v, b.x + b.w * 0.3), Y(v, b.h + 5)); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(X(v, b.x + b.w * 0.3), Y(v, b.h + 5), Math.max(1.5, s * 0.15), 0, Math.PI * 2); ctx.fill(); }
  }
}
function drawSideFactory(ctx: CanvasRenderingContext2D, b: SideBlock, v: View) {
  const s = v.s, teeth = Math.max(3, Math.round(b.w / 4)), tw = b.w / teeth;
  ctx.fillStyle = '#44403c';
  for (let i = 0; i < teeth; i++) { const x0 = b.x + i * tw; ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, b.h)); ctx.lineTo(X(v, x0), Y(v, b.h + 2.2)); ctx.lineTo(X(v, x0 + tw), Y(v, b.h)); ctx.fill(); ctx.fillStyle = 'rgba(147,197,253,0.35)'; ctx.fillRect(X(v, x0) + 1, Y(v, b.h + 2), Math.max(1, s * 0.3), 1.8 * s); ctx.fillStyle = '#44403c'; } // techo en serrucho
  for (const cx of [0.18, 0.32]) { // chimeneas
    ctx.fillStyle = '#7c2d12'; ctx.fillRect(X(v, b.x + b.w * cx), Y(v, b.h + 9), 1.1 * s, 9 * s);
    ctx.fillStyle = '#e7e5e4'; ctx.fillRect(X(v, b.x + b.w * cx), Y(v, b.h + 7.6), 1.1 * s, 0.5 * s); ctx.fillRect(X(v, b.x + b.w * cx), Y(v, b.h + 5.6), 1.1 * s, 0.5 * s);
  }
  ctx.fillStyle = 'rgba(15,23,42,0.75)';
  for (let x0 = b.x + 1; x0 < b.x + b.w - 1.5; x0 += 2.2) ctx.fillRect(X(v, x0), Y(v, b.h - 1.2), 1.4 * s, 1.6 * s); // ventanas altas
  ctx.fillStyle = '#6b7280'; ctx.fillRect(X(v, b.x + b.w * 0.55), Y(v, 4.2), 4.5 * s, 4.2 * s); // portón
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let yy = 0.4; yy < 4.2; yy += 0.4) { ctx.beginPath(); ctx.moveTo(X(v, b.x + b.w * 0.55), Y(v, yy)); ctx.lineTo(X(v, b.x + b.w * 0.55 + 4.5), Y(v, yy)); ctx.stroke(); }
  if (s * 8 > 40) { ctx.fillStyle = '#fef3c7'; ctx.font = font(900, Math.max(7, s * 0.7)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('FÁBRICA', X(v, b.x + 1), Y(v, b.h - 2.6)); }
}
// Obra en construcción: losas de hormigón con columnas, los pisos de arriba solo esqueleto, andamio con media
// sombra naranja y una grúa torre.
function drawSideWorks(ctx: CanvasRenderingContext2D, b: SideBlock, v: View) {
  const s = v.s, fh = 2.9, built = Math.floor(b.h / fh * (0.45 + hash(b.seed) * 0.25));
  const floors = Math.floor(b.h / fh), cols = Math.max(3, Math.round(b.w / 3.4));
  for (let k = 0; k < floors; k++) {
    const y = k * fh;
    if (k < built) { ctx.fillStyle = 'rgba(120,113,108,0.55)'; ctx.fillRect(X(v, b.x), Y(v, y + fh), b.w * s, fh * s); } // paredes a medio hacer
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(X(v, b.x - 0.3), Y(v, y + fh), (b.w + 0.6) * s, 0.35 * s); // losa
    ctx.fillStyle = '#78716c';
    for (let c = 0; c <= cols; c++) ctx.fillRect(X(v, b.x + c * b.w / cols - 0.2), Y(v, y + fh), 0.4 * s, fh * s); // columnas
  }
  // Andamio con media sombra.
  ctx.strokeStyle = 'rgba(234,88,12,0.9)'; ctx.lineWidth = Math.max(1, s * 0.06);
  const ax = b.x + b.w + 0.4;
  for (let k = 0; k < built + 1; k++) { ctx.beginPath(); ctx.moveTo(X(v, ax), Y(v, k * fh)); ctx.lineTo(X(v, ax + 1.2), Y(v, (k + 1) * fh)); ctx.moveTo(X(v, ax), Y(v, (k + 1) * fh)); ctx.lineTo(X(v, ax + 1.2), Y(v, (k + 1) * fh)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(249,115,22,0.35)'; ctx.fillRect(X(v, b.x), Y(v, built * fh), b.w * s * 0.5, built * fh * 0.6 * s);
  // Grúa torre.
  const mx = b.x + b.w * 0.7, mh = b.h + 10, jib = b.w * 1.5;
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath(); ctx.moveTo(X(v, mx), Y(v, 0)); ctx.lineTo(X(v, mx), Y(v, mh)); ctx.moveTo(X(v, mx + 0.9), Y(v, 0)); ctx.lineTo(X(v, mx + 0.9), Y(v, mh)); ctx.stroke();
  ctx.lineWidth = Math.max(0.6, s * 0.04);
  for (let yy = 0; yy < mh; yy += 1.2) { ctx.beginPath(); ctx.moveTo(X(v, mx), Y(v, yy)); ctx.lineTo(X(v, mx + 0.9), Y(v, yy + 1.2)); ctx.stroke(); }
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath(); ctx.moveTo(X(v, mx - jib * 0.3), Y(v, mh)); ctx.lineTo(X(v, mx + jib), Y(v, mh)); ctx.moveTo(X(v, mx - jib * 0.3), Y(v, mh + 0.8)); ctx.lineTo(X(v, mx + jib), Y(v, mh + 0.8)); ctx.stroke();
  ctx.fillStyle = '#57534e'; ctx.fillRect(X(v, mx - jib * 0.3), Y(v, mh + 0.2), 2 * s, 1.6 * s); // contrapeso
  const hook = mx + jib * (0.5 + hash(b.seed + 1) * 0.4), drop = mh - 6 - hash(b.seed + 2) * 8;
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(0.6, s * 0.03); ctx.beginPath(); ctx.moveTo(X(v, hook), Y(v, mh)); ctx.lineTo(X(v, hook), Y(v, drop)); ctx.stroke();
  ctx.fillStyle = '#92400e'; ctx.fillRect(X(v, hook - 1), Y(v, drop), 2 * s, 0.5 * s); // vigas colgando
  if (s * 6 > 40) { ctx.fillStyle = '#fde047'; ctx.fillRect(X(v, b.x + 0.5), Y(v, 3.4), 5 * s, 1 * s); ctx.fillStyle = '#111'; ctx.font = font(900, Math.max(6, s * 0.45)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OBRA EN CONSTRUCCIÓN', X(v, b.x + 3), Y(v, 2.9), 4.8 * s); }
}

// El fondo de todo (la última capa, detrás de los edificios): la imagen del usuario (Invasion_Cielo_Portales). Queda
// fija: cubre la pantalla entera y no se mueve con la vista. Se pinta aparte, en cada cuadro (`drawWallpaper`), así
// la cuadra de fondo que se rearma cada tanto no la corre. Mientras carga, el cielo de antes.
const wallpaper = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: wallpaperUrl }) : null;
export function drawWallpaper(ctx: CanvasRenderingContext2D, w: number, h: number, g: Invasion) {
  if (wallpaper?.complete && wallpaper.naturalWidth) {
    const k = Math.max(w / wallpaper.naturalWidth, h / wallpaper.naturalHeight), W = wallpaper.naturalWidth * k, H = wallpaper.naturalHeight * k;
    ctx.drawImage(wallpaper, (w - W) / 2, (h - H) / 2, W, H);
    return;
  }
  const c = skyColors(g.time), sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, c.top); sky.addColorStop(0.55, c.mid); sky.addColorStop(1, c.low);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
}
// `wall`: si pinta también el fondo (con la mira sí; la cuadra de fondo no, porque el fondo va aparte).
function drawSky(ctx: CanvasRenderingContext2D, g: Invasion, v: View, wall: boolean) {
  if (wall) drawWallpaper(ctx, v.w, v.h, g);
  // La nave nodriza aparece de a poco en el fondo.
  if (g.time > UFO_FROM + 60) {
    const k = Math.min(1, (g.time - UFO_FROM - 60) / 120), mx = v.w / 2 + (g.width * 0.5 - v.cx) * v.s * 0.15, my = Y(v, CITY_TOP * 0.62 + v.cy * 0.45);
    ctx.globalAlpha = 0.85 * k;
    const ship = ctx.createLinearGradient(0, my - v.s * 3, 0, my + v.s * 3);
    ship.addColorStop(0, '#1f2937'); ship.addColorStop(1, '#030712');
    ctx.fillStyle = ship; ctx.beginPath(); ctx.ellipse(mx, my, v.s * 60, v.s * 5, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 40; i++) { const lx = mx + (i / 39 - 0.5) * v.s * 110, on = Math.floor(g.time * 2 + i) % 3; ctx.fillStyle = on ? '#22d3ee' : '#0e7490'; ctx.beginPath(); ctx.arc(lx, my + v.s * 2.6 * Math.sqrt(Math.max(0, 1 - ((lx - mx) / (v.s * 60)) ** 2)), v.s * 0.25, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  drawSideBlocks(ctx, g, v); // los edificios de los costados (más allá de la cuadra)
}

// ---------- Habitaciones (lo que no se mueve, en una imagen) ----------
type P = { x: (u: number) => number; y: (u: number) => number; s: number };
const WALLS: Record<string, (h: number) => string> = {
  living: h => hsl(h, 32, 72), kitchen: h => hsl(h, 22, 86), bedroom: h => hsl(h, 38, 78), bath: () => '#e0f2fe', office: () => '#e5e7eb', gym: () => '#a8a29e',
  kids: h => hsl(h, 70, 82), dining: h => hsl(h, 28, 70), studio: () => '#f5f5f4', laundry: () => '#dbeafe', shop: h => hsl(h, 40, 80), site: () => '#a8a29e', lobby: () => '#e7e5e4',
};
// Ventanas de la pared de atrás de cada habitación (dónde no hay muebles altos).
export function windowsOf(room: Room, b: Building): [number, number][] {
  if (room.theme === 'site' || room.theme === 'shop' || room.theme === 'lobby' || room.theme === 'bath') return [];
  if (b.style === 'glass') return [[room.x1 + 0.15, room.x2 - 0.15]];
  if (b.style === 'office') return [[room.x1 + 0.3, room.x2 - 0.3]];
  const tall = new Set<Item>(['fridge', 'wardrobe', 'bookshelf', 'bunk', 'cabinet', 'shelves', 'whiteboard', 'elevator', 'easel']);
  const blocks = room.furniture.filter(f => tall.has(f.item)).map(f => [f.x - 0.1, f.x + f.w + 0.1]).sort((a, c) => a[0] - c[0]);
  let best: [number, number] = [0, 0], from = room.x1 + 0.3;
  for (const [a, c] of [...blocks, [room.x2 - 0.3, room.x2]]) { if (a - from > best[1] - best[0]) best = [from, a]; from = Math.max(from, c); }
  const w = Math.min(b.style === 'old' ? 1.3 : 1.8, best[1] - best[0] - 0.2);
  if (w < 0.8) return [];
  const mid = (best[0] + best[1]) / 2;
  return [[mid - w / 2, mid + w / 2]];
}
const winTop = (room: Room) => room.y + room.h - 0.45, winBottom = (room: Room, b: Building) => room.y + (b.style === 'glass' ? 0.15 : 0.95);

function drawRoomStatic(ctx: CanvasRenderingContext2D, room: Room, b: Building, P: P) {
  const { x, y, s } = P, x1 = room.x1, x2 = room.x2, y0 = room.y, y1 = room.y + room.h, seed = room.seed;
  const rect = (c: string | CanvasGradient, a: number, bY: number, w: number, h: number) => { ctx.fillStyle = c; ctx.fillRect(x(a), y(bY + h), w * s, h * s); };
  const hue = (b.hue + room.floor * 23 + (seed % 90)) % 360;
  const theme = room.theme;
  // Pared del fondo.
  if (theme === 'site') {
    const open = room.floor > b.floors * 0.55;
    if (!open) { rect('#9ca3af', x1, y0, x2 - x1, room.h); for (let yy = y0 + 0.2; yy < y1; yy += 0.25) for (let xx = x1 + ((yy * 4) % 2) * 0.25; xx < x2; xx += 0.5) { ctx.fillStyle = hash(xx * 7 + yy * 3) < 0.5 ? '#b45309' : '#c2410c'; ctx.fillRect(x(xx) + 1, y(yy + 0.22), 0.48 * s - 1, 0.21 * s); } }
    for (let i = 0; i < 3; i++) { const cx = x1 + (i + 0.5) * (x2 - x1) / 3; rect('#a8a29e', cx - 0.15, y0, 0.3, room.h); }
  } else if (theme === 'shop' && room.shop === 'bar') {
    rect('#3f2a1d', x1, y0, x2 - x1, room.h);
    for (let xx = x1; xx < x2; xx += 0.35) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x(xx), y(y1), 1, room.h * s); }
    // Estantes con botellas detrás de la barra.
    for (const sy of [1.5, 2.2]) { rect('#78350f', x1 + 0.4, y0 + sy, Math.min(3.4, x2 - x1 - 0.8), 0.06); for (let bx = x1 + 0.5; bx < x1 + Math.min(3.7, x2 - x1 - 0.5); bx += 0.22) { const c = ['#065f46', '#7c2d12', '#facc15', '#1e3a8a', '#b91c1c'][Math.floor(hash(bx * 9) * 5)]; rect(c, bx, y0 + sy + 0.06, 0.12, 0.38); rect(c, bx + 0.035, y0 + sy + 0.44, 0.05, 0.12); } }
    ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = s * 0.3; ctx.font = font(900, s * 0.4); ctx.textAlign = 'center'; ctx.fillText('BAR', x((x1 + x2) / 2 + 1.5), y(y0 + 2.5)); ctx.shadowBlur = 0;
  } else {
    rect(WALLS[theme](hue), x1, y0, x2 - x1, room.h);
    { const wl = ctx.createLinearGradient(0, y(y1), 0, y(y0)); wl.addColorStop(0, 'rgba(0,0,0,0.14)'); wl.addColorStop(0.45, 'rgba(255,255,255,0.07)'); wl.addColorStop(1, 'rgba(0,0,0,0.06)'); rect(wl, x1, y0, x2 - x1, room.h); }
    const pattern = seed % 4;
    if (theme === 'living' || theme === 'bedroom' || theme === 'dining') {
      if (pattern === 0) for (let xx = x1; xx < x2; xx += 0.3) rect(hsl(hue, 30, 66, 0.6), xx, y0, 0.12, room.h); // rayas
      else if (pattern === 1) for (let xx = x1 + 0.15; xx < x2; xx += 0.4) for (let yy = y0 + 0.2; yy < y1; yy += 0.4) { ctx.fillStyle = hsl(hue, 35, 60, 0.55); ctx.beginPath(); ctx.arc(x(xx + ((yy * 10) % 2) * 0.2), y(yy), s * 0.04, 0, Math.PI * 2); ctx.fill(); }
      else if (pattern === 2) { rect(hsl((hue + 20) % 360, 25, 45), x1, y0, x2 - x1, 0.95); rect('rgba(255,255,255,0.4)', x1, y0 + 0.95, x2 - x1, 0.05); } // boiserie
    }
    if (theme === 'kitchen' || theme === 'bath' || theme === 'laundry') {
      const th = theme === 'bath' ? room.h : 1.5;
      for (let xx = x1; xx < x2; xx += 0.25) for (let yy = y0; yy < y0 + th; yy += 0.25) { ctx.fillStyle = (Math.round(xx * 4) + Math.round(yy * 4)) % 2 ? hsl(theme === 'bath' ? 195 : hue, 35, 88) : hsl(theme === 'bath' ? 195 : hue, 30, 80); ctx.fillRect(x(xx) + 0.5, y(yy + 0.25) + 0.5, 0.25 * s - 1, 0.25 * s - 1); }
    }
    if (theme === 'kids') for (let i = 0; i < 12; i++) { ctx.fillStyle = hsl((hash(seed + i) * 360) | 0, 80, 70); ctx.font = font(900, s * 0.25); ctx.fillText('★', x(x1 + hash(seed + i * 3) * (x2 - x1)), y(y0 + 1.2 + hash(seed + i * 5) * 1.2)); }
    if (theme === 'studio') for (let yy = y0; yy < y1; yy += 0.22) for (let xx = x1 + ((yy * 9) % 2) * 0.22; xx < x2; xx += 0.44) { ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.strokeRect(x(xx), y(yy + 0.22), 0.44 * s, 0.22 * s); }
    if (theme === 'lobby') for (let xx = x1; xx < x2; xx += 1) rect('rgba(120,113,108,0.15)', xx, y0, 0.02, room.h);
    if (theme === 'gym' || room.shop === 'gimnasio') {
      const mirrorW = x2 - x1 - 0.6;
      const mirror = ctx.createLinearGradient(x(x1), y(y0 + 1.9), x(x2), y(y0 + 0.6));
      mirror.addColorStop(0, '#566773');
      mirror.addColorStop(0.46, '#b8c7cc');
      mirror.addColorStop(0.51, '#d7e0e1');
      mirror.addColorStop(1, '#718591');
      rect('#414950', x1 + 0.3, y0 + 0.56, mirrorW, 1.42);
      rect(mirror, x1 + 0.34, y0 + 0.6, mirrorW - 0.08, 1.34);
      for (let dx = 1.25; dx < mirrorW - 0.08; dx += 1.25) {
        rect('#839398', x1 + 0.3 + dx, y0 + 0.6, 0.022, 1.34);
      }
    }
    // Ventanas: afuera, el cielo y otros edificios.
    for (const [a, c] of windowsOf(room, b)) {
      const wb = winBottom(room, b), wt = winTop(room);
      const out = ctx.createLinearGradient(0, y(wt), 0, y(wb)); out.addColorStop(0, '#7dd3fc'); out.addColorStop(1, '#e0f2fe');
      rect(out, a, wb, c - a, wt - wb);
      for (let i = 0; i < 4; i++) { const bx = a + hash(seed + i) * (c - a), bw = 0.4 + hash(seed + i + 9) * 0.6; rect(hsl(215, 15, 55 + i * 6, 0.85), bx, wb, Math.min(bw, c - bx), (wt - wb) * (0.3 + hash(seed + i * 4) * 0.5)); }
      rect('rgba(255,255,255,0.25)', a, wb, (c - a) * 0.25, wt - wb);
      const frame = b.style === 'old' ? '#e7e5e4' : b.style === 'glass' ? '#334155' : '#f8fafc';
      ctx.strokeStyle = frame; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.strokeRect(x(a), y(wt), (c - a) * s, (wt - wb) * s);
      for (let mx = a + 1.1; mx < c - 0.3; mx += 1.1) { ctx.beginPath(); ctx.moveTo(x(mx), y(wt)); ctx.lineTo(x(mx), y(wb)); ctx.stroke(); }
      if (b.style !== 'glass' && b.style !== 'office') { // cortinas
        const cc = hsl((hue + 180) % 360, 45, 55);
        for (const [cx, d] of [[a - 0.05, 1], [c + 0.05, -1]] as const) { ctx.fillStyle = cc; ctx.beginPath(); ctx.moveTo(x(cx), y(wt + 0.15)); ctx.lineTo(x(cx + d * 0.35), y(wt + 0.15)); ctx.quadraticCurveTo(x(cx + d * 0.15), y((wt + wb) / 2), x(cx + d * 0.3), y(wb - 0.2)); ctx.lineTo(x(cx), y(wb - 0.2)); ctx.fill(); }
        rect('#78716c', a - 0.25, wt + 0.12, c - a + 0.5, 0.04);
        rect('rgba(255,255,255,0.8)', a - 0.05, wb - 0.06, c - a + 0.1, 0.07); // alféizar
      }
    }
    // Zócalo, moldura del techo, enchufes, la puerta y otras cosas de la pared.
    rect('#f5f5f4', x1, y0 + FLOOR_D, x2 - x1, 0.09); rect('rgba(0,0,0,0.2)', x1, y0 + FLOOR_D + 0.09, x2 - x1, 0.015);
    rect('rgba(255,255,255,0.55)', x1, y1 - 0.13, x2 - x1, 0.07); rect('rgba(0,0,0,0.12)', x1, y1 - 0.15, x2 - x1, 0.02);
    const wall = drawWallDetails(ctx, room, b, P, hue);
    // Cosas colgadas en la pared, donde hay lugar.
    const free = (cx: number, w: number) => !room.furniture.some(f => f.x < cx + w && f.x + f.w > cx - w && ['bookshelf', 'wardrobe', 'fridge', 'cabinet', 'shelves', 'bunk', 'whiteboard', 'elevator'].includes(f.item)) && !windowsOf(room, b).some(([a, c]) => a < cx + w && c > cx - w);
    for (let i = 0; i < 4; i++) {
      const cx = x1 + 0.6 + hash(seed + i * 17) * (x2 - x1 - 1.2), kind = Math.floor(hash(seed + i * 31) * 8);
      if (!free(cx, 0.45) || theme === 'bath' || (wall.door > 0 && Math.abs(cx - wall.door) < 0.95) || (wall.ac && cx > x2 - 1.5)) continue;
      const cy = y0 + 1.55 + hash(seed + i) * 0.35;
      if (kind === 0 || kind === 1) { // cuadro
        rect('#78350f', cx - 0.35, cy - 0.25, 0.7, 0.5);
        const art = ctx.createLinearGradient(x(cx - 0.3), 0, x(cx + 0.3), 0); art.addColorStop(0, hsl((seed * 7 + i * 50) % 360, 60, 55)); art.addColorStop(1, hsl((seed * 13 + i * 90) % 360, 55, 40));
        rect(art, cx - 0.3, cy - 0.2, 0.6, 0.4);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x(cx + 0.1), y(cy + 0.08), s * 0.06, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 2) { rect('#f8fafc', cx - 0.25, cy - 0.32, 0.5, 0.64); rect(hsl(hue, 60, 50), cx - 0.25, cy + 0.18, 0.5, 0.14); for (let j = 0; j < 4; j++) rect('#cbd5e1', cx - 0.2, cy - 0.25 + j * 0.1, 0.4, 0.03); } // calendario
      else if (kind === 3) { rect('#57534e', cx - 0.45, cy - 0.05, 0.9, 0.05); for (let j = 0; j < 6; j++) rect(['#b91c1c', '#1d4ed8', '#15803d', '#a16207'][j % 4], cx - 0.4 + j * 0.13, cy, 0.1, 0.24 + hash(seed + j) * 0.08); } // estante con libros
      else if (kind === 4) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x(cx), y(cy), s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x(cx), y(cy)); ctx.lineTo(x(cx), y(cy + 0.15)); ctx.moveTo(x(cx), y(cy)); ctx.lineTo(x(cx + 0.1), y(cy)); ctx.stroke(); } // reloj
      else if (kind === 5) { // fotos familiares
        for (let j = 0; j < 4; j++) { const fx = cx - 0.38 + (j % 2) * 0.42, fy = cy - 0.25 + Math.floor(j / 2) * 0.32; rect('#1c1917', fx, fy, 0.34, 0.26); rect(hsl((seed + j * 70) % 360, 30, 70), fx + 0.03, fy + 0.03, 0.28, 0.2); ctx.fillStyle = hsl(25, 50, 55); ctx.beginPath(); ctx.arc(x(fx + 0.17), y(fy + 0.15), s * 0.045, 0, Math.PI * 2); ctx.fill(); rect(hsl((seed * 3 + j * 50) % 360, 50, 45), fx + 0.1, fy + 0.03, 0.14, 0.07); }
      } else if (kind === 6) { // estante con plantitas y adornos
        rect('#78350f', cx - 0.45, cy - 0.12, 0.9, 0.05);
        rect('#9a3412', cx - 0.38, cy - 0.07, 0.14, 0.12); for (let j = 0; j < 4; j++) { ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(x(cx - 0.31 + (j - 1.5) * 0.04), y(cy + 0.1), s * 0.03, s * 0.08, (j - 1.5) * 0.5, 0, Math.PI * 2); ctx.fill(); }
        rect('#0ea5e9', cx - 0.08, cy - 0.07, 0.12, 0.2); rect('#f8fafc', cx + 0.15, cy - 0.07, 0.22, 0.15); rect('#334155', cx + 0.18, cy - 0.04, 0.16, 0.1);
      } else { // póster
        rect('#f8fafc', cx - 0.3, cy - 0.42, 0.6, 0.84); const pg = ctx.createLinearGradient(0, y(cy + 0.38), 0, y(cy - 0.2)); pg.addColorStop(0, hsl((seed * 11) % 360, 70, 55)); pg.addColorStop(1, hsl((seed * 11 + 60) % 360, 70, 35)); rect(pg, cx - 0.26, cy - 0.2, 0.52, 0.58);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x(cx), y(cy + 0.1), s * 0.12, 0, Math.PI * 2); ctx.fill(); for (let j = 0; j < 2; j++) rect('#1f2937', cx - 0.2, cy - 0.3 - j * 0.07, 0.4 - j * 0.12, 0.035);
      }
    }
  }
  // Piso: se ve un poco de profundidad (tablas de madera, baldosas o alfombra de oficina).
  const floorTone = theme === 'kitchen' || theme === 'bath' || theme === 'laundry' ? '#d6d3d1' : theme === 'site' ? '#78716c' : theme === 'office' ? '#64748b' : theme === 'gym' ? '#1f2937' : theme === 'lobby' ? '#d6d3d1' : `hsl(${25 + (seed % 15)},45%,38%)`;
  const fd = theme === 'site' ? 0.09 : FLOOR_D;
  { const fg = ctx.createLinearGradient(0, y(y0 + fd), 0, y(y0)); fg.addColorStop(0, mixColor(floorTone, '#000000', 0.3)); fg.addColorStop(1, floorTone); rect(fg, x1, y0, x2 - x1, fd); }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  const wood = !['kitchen', 'bath', 'laundry', 'site', 'office', 'gym', 'lobby'].includes(theme);
  if (wood) { // tablas en perspectiva
    for (let xx = x1; xx < x2 + 0.3; xx += 0.42) { ctx.beginPath(); ctx.moveTo(x(Math.min(x2, xx)), y(y0 + fd)); ctx.lineTo(x(Math.max(x1, Math.min(x2, xx - 0.14))), y(y0)); ctx.stroke(); }
    for (const k of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(x(x1), y(y0 + fd * k)); ctx.lineTo(x(x2), y(y0 + fd * k)); ctx.stroke(); }
  } else if (theme !== 'site' && theme !== 'office' && theme !== 'gym') { // baldosas
    for (const k of [0.4, 0.75]) { ctx.beginPath(); ctx.moveTo(x(x1), y(y0 + fd * k)); ctx.lineTo(x(x2), y(y0 + fd * k)); ctx.stroke(); }
    for (let xx = x1; xx < x2 + 0.3; xx += 0.35) { ctx.beginPath(); ctx.moveTo(x(Math.min(x2, xx)), y(y0 + fd)); ctx.lineTo(x(Math.max(x1, Math.min(x2, xx - 0.12))), y(y0)); ctx.stroke(); }
  }
  rect('rgba(255,255,255,0.12)', x1, y0, x2 - x1, 0.02);
  if (theme !== 'site') drawRoomFinishes(ctx, room, P, hue);
  // Muebles.
  for (const f of room.furniture) drawItem(ctx, f, room, P, hue);
  // Luz ambiente: un poco de sombra en las puntas.
  const vg = ctx.createLinearGradient(x(x1), 0, x(x2), 0); vg.addColorStop(0, 'rgba(0,0,0,0.22)'); vg.addColorStop(0.15, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(x(x1), y(y1), (x2 - x1) * s, room.h * s);
  const top = ctx.createLinearGradient(0, y(y1), 0, y(y1 - 0.7)); top.addColorStop(0, 'rgba(0,0,0,0.25)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top; ctx.fillRect(x(x1), y(y1), (x2 - x1) * s, 0.7 * s);
}

// Cosas de la pared: enchufes, la llave de luz, una puerta, radiador o aire acondicionado, persianas.
const FLOOR_D = 0.3; // lo que se ve de profundidad del piso
function drawRoomFinishes(ctx: CanvasRenderingContext2D, room: Room, P: P, hue: number) {
  const { x, y, s } = P, { x1, x2, seed, theme, shop } = room;
  const ceiling = room.y + room.h, width = x2 - x1;
  const gym = theme === 'gym' || shop === 'gimnasio';
  const office = theme === 'office' || theme === 'lobby';
  const cafe = shop === 'cafe' || shop === 'bar' || shop === 'pizzeria';
  const rect = (color: string | CanvasGradient, left: number, bottom: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x(left), y(bottom + h), w * s, h * s);
  };
  const count = Math.ceil(width / (office ? 3.5 : 4.5));
  for (let i = 0; i < count; i++) {
    const cx = x1 + (i + 0.5) * width / count;
    const drop = cafe ? 0.42 : 0.19;
    const radius = Math.min(1.25, width / count / 2);
    const light = ctx.createRadialGradient(x(cx), y(ceiling - drop), 0, x(cx), y(ceiling - drop), radius * s);
    light.addColorStop(0, office || gym ? 'rgba(233,244,255,0.34)' : 'rgba(255,222,162,0.36)');
    light.addColorStop(1, 'rgba(255,240,211,0)');
    rect(light, cx - radius, ceiling - drop - radius, radius * 2, drop + radius);
    rect('#41464a', cx - 0.018, ceiling - drop, 0.036, drop - 0.12);
    const fixture = office || gym ? 0.92 : cafe ? 0.4 : 0.25;
    rect('#505154', cx - fixture / 2, ceiling - drop, fixture, 0.09);
    rect(office || gym ? '#eef6fa' : '#ffe2af', cx - fixture / 2 + 0.025, ceiling - drop - 0.028, fixture - 0.05, 0.032);
  }

  if (gym) {
    // Juntas de caucho y marcas de las estaciones.
    rect('#292e32', x1, room.y, width, 0.24);
    for (let offset = 0.32; offset < width - 0.18; offset += 0.64) {
      rect('#43494c', x1 + offset, room.y, 0.018, 0.24);
    }
    rect('#8e733c', x1 + 0.12, room.y + 0.14, width - 0.24, 0.025);
  }
  if (theme === 'living' || theme === 'bedroom' || theme === 'kids' || theme === 'dining') {
    const rugW = Math.min(2.55, width - 0.6);
    const left = x1 + (width - rugW) * (0.25 + hash(seed) * 0.5);
    rect(hsl((hue + 140) % 360, 24, 34), left, room.y + 0.025, rugW, 0.22);
    rect(hsl((hue + 145) % 360, 22, 61), left + 0.08, room.y + 0.052, rugW - 0.16, 0.165);
    rect(hsl((hue + 140) % 360, 28, 43), left + 0.13, room.y + 0.073, rugW - 0.26, 0.115);
    for (let offset = 0.22; offset < rugW - 0.15; offset += 0.19) {
      rect('rgba(245,230,198,0.4)', left + offset, room.y + 0.105, 0.06, 0.047);
    }
  }
}
function drawWallDetails(ctx: CanvasRenderingContext2D, room: Room, b: Building, P: P, hue: number): { door: number; ac: boolean } {
  const { x, y, s } = P, x1 = room.x1, x2 = room.x2, y0 = room.y + FLOOR_D, y1 = room.y + room.h, seed = room.seed, theme = room.theme;
  const rect = (c: string | CanvasGradient, a: number, bY: number, w: number, h: number, r = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x(a), y(bY + h), w * s, h * s, r * s); ctx.fill(); };
  const wins = windowsOf(room, b);
  const blocked = (a: number, c: number, tallOnly = false) => room.furniture.some(f => f.x < c && f.x + f.w > a && (!tallOnly || f.item !== 'rug')) || wins.some(([wa, wc]) => wa < c + 0.1 && wc > a - 0.1);
  // Puerta (al pasillo o a otra habitación), donde no haya muebles.
  let door = -1;
  if (theme !== 'bath' && theme !== 'gym') for (const cx of [x1 + 0.75, x2 - 0.75, (x1 + x2) / 2]) if (!blocked(cx - 0.5, cx + 0.5)) { door = cx; break; }
  if (door > 0 && room.h > 2.4) {
    const dw = 0.84, dh = Math.min(2.05, room.h - FLOOR_D - 0.25), wood = hsl(28 + (seed % 10), 35 + (seed % 20), 32 + (seed % 12));
    rect('#e7e5e4', door - dw / 2 - 0.07, y0, dw + 0.14, dh + 0.07); // marco
    const dg = ctx.createLinearGradient(x(door - dw / 2), 0, x(door + dw / 2), 0); dg.addColorStop(0, mixColor(wood, '#000000', 0.15)); dg.addColorStop(1, wood);
    rect(dg, door - dw / 2, y0, dw, dh);
    for (const [py, ph] of [[0.15, 0.75], [1.05, 0.8]]) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, s * 0.015); ctx.strokeRect(x(door - dw / 2 + 0.1), y(y0 + py + ph), (dw - 0.2) * s, ph * s); }
    rect('#d4af37', door + dw / 2 - 0.16, y0 + 0.95, 0.1, 0.035, 0.02);
    rect('#f8fafc', door + dw / 2 + 0.14, y0 + 1.0, 0.09, 0.13, 0.015); // llave de luz
    rect('rgba(0,0,0,0.25)', door + dw / 2 + 0.17, y0 + 1.04, 0.03, 0.05);
  }
  // Enchufes.
  for (let i = 0; i < 2; i++) {
    const ox = x1 + 0.35 + hash(seed + i * 13) * (x2 - x1 - 0.7);
    if (wins.some(([a, c]) => a < ox + 0.1 && c > ox - 0.1) || (door > 0 && Math.abs(ox - door) < 0.6)) continue;
    rect('#f8fafc', ox - 0.06, y0 + 0.2, 0.12, 0.12, 0.02); rect('#57534e', ox - 0.03, y0 + 0.25, 0.015, 0.03); rect('#57534e', ox + 0.015, y0 + 0.25, 0.015, 0.03);
  }
  // Debajo de las ventanas, un radiador; en los edificios modernos, aire acondicionado y persianas.
  for (const [a, c] of wins) {
    const wb = winBottom(room, b);
    if (b.style !== 'glass' && b.style !== 'office' && wb - y0 > 0.5) {
      const rw = Math.min(1.2, c - a - 0.2), rx = (a + c) / 2 - rw / 2;
      rect('#e5e7eb', rx, y0 + 0.08, rw, wb - y0 - 0.22, 0.03);
      for (let fx = rx + 0.06; fx < rx + rw - 0.04; fx += 0.08) rect('rgba(0,0,0,0.13)', fx, y0 + 0.1, 0.02, wb - y0 - 0.26);
    }
    if (b.style === 'glass' || b.style === 'office' || hash(seed + 3) < 0.3) { // persiana a medio bajar
      const wt = winTop(room), down = (wt - wb) * (0.2 + hash(seed + 9) * 0.35);
      rect('rgba(226,232,240,0.92)', a + 0.03, wt - down, c - a - 0.06, down);
      for (let yy = wt - 0.06; yy > wt - down; yy -= 0.07) rect('rgba(100,116,139,0.35)', a + 0.03, yy, c - a - 0.06, 0.012);
    } else if (hash(seed + 4) < 0.45) { // macetita en el alféizar
      const px = a + 0.25 + hash(seed + 6) * (c - a - 0.5);
      rect('#c2410c', px - 0.08, wb, 0.16, 0.13, 0.02); ctx.fillStyle = '#16a34a'; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(x(px + (j - 1) * 0.05), y(wb + 0.2), s * 0.035, s * 0.08, (j - 1) * 0.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  let ac = false;
  if ((b.style === 'glass' || b.style === 'office' || b.style === 'hotel' || hash(seed + 8) < 0.3) && theme !== 'bath' && theme !== 'lobby') {
    const ax = x2 - 0.95;
    if (!wins.some(([a, c]) => a < ax + 0.8 && c > ax - 0.1) && !room.furniture.some(f => f.x < ax + 0.8 && f.x + f.w > ax && ['wardrobe', 'bookshelf', 'shelves', 'fridge', 'cabinet', 'bunk', 'whiteboard', 'elevator'].includes(f.item))) {
      ac = true;
      rect('#f8fafc', ax, y1 - 0.55, 0.75, 0.24, 0.05); rect('rgba(0,0,0,0.15)', ax + 0.05, y1 - 0.53, 0.65, 0.03); rect('#22c55e', ax + 0.62, y1 - 0.43, 0.04, 0.03);
    }
  }
  if (theme === 'bath') { // toallero con toalla y estante
    const tx = x2 - 0.6;
    rect('#9ca3af', tx - 0.25, y0 + 1.15, 0.5, 0.03); rect(hsl((seed * 7) % 360, 55, 60), tx - 0.2, y0 + 0.75, 0.4, 0.42, 0.03); rect('rgba(255,255,255,0.4)', tx - 0.2, y0 + 0.8, 0.4, 0.04);
    rect('#f8fafc', x1 + 0.3, y0 + 1.45, 0.6, 0.04); for (let j = 0; j < 3; j++) rect(['#f472b6', '#38bdf8', '#facc15'][j], x1 + 0.35 + j * 0.18, y0 + 1.49, 0.1, 0.14 + j * 0.03, 0.03);
  }
  if (theme === 'kitchen') for (const f of room.furniture) if (f.item === 'sink' || f.item === 'stove') { // alacenas
    if (f.item === 'stove') continue;
    rect(hsl(hue, 20, 72), f.x - 0.05, room.y + 1.65, f.w + 0.6, 0.6, 0.02); rect('rgba(0,0,0,0.2)', f.x + (f.w + 0.5) / 2, room.y + 1.68, 0.01, 0.54);
    for (const k of [0.4, 0.6]) rect('#78716c', f.x - 0.05 + (f.w + 0.6) * k, room.y + 1.72, 0.02, 0.12);
  }
  return { door, ac };
}

// Un mueble (o cosa) apoyado en el piso de la habitación.
function drawItem(ctx: CanvasRenderingContext2D, f: Furniture, room: Room, P: P, hue: number) {
  const { x, y, s } = P, x0 = f.x, w = f.w, y0 = room.y, seed = room.seed + Math.round(f.x * 10);
  const rect = (c: string | CanvasGradient, a: number, b: number, ww: number, h: number, r = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x(a), y(b + h), ww * s, h * s, r * s); ctx.fill(); };
  const grad = (c1: string, c2: string, a: number, b: number, ww: number, h: number, r = 0) => { const gr = ctx.createLinearGradient(0, y(b + h), 0, y(b)); gr.addColorStop(0, c1); gr.addColorStop(1, c2); rect(gr, a, b, ww, h, r); };
  const circ = (c: string, cx: number, cy: number, r: number) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x(cx), y(cy), Math.max(0.5, r * s), 0, Math.PI * 2); ctx.fill(); };
  const wood = `hsl(${25 + (seed % 12)},${40 + (seed % 20)}%,${30 + (seed % 15)}%)`, fabric = hsl((hue + 150 + (seed % 120)) % 360, 40, 45);
  const legs = (a: number, ww: number, h: number, c = '#44403c') => { rect(c, a + 0.05, y0, 0.06, h); rect(c, a + ww - 0.11, y0, 0.06, h); };
  switch (f.item) {
    case 'sofa': grad(fabric, mixColor(fabric, '#000000', 0.35), x0, y0 + 0.12, w, 0.42, 0.08); grad(mixColor(fabric, '#ffffff', 0.1), fabric, x0 + 0.05, y0 + 0.5, w - 0.1, 0.4, 0.1); rect(mixColor(fabric, '#000000', 0.2), x0, y0 + 0.12, 0.2, 0.6, 0.08); rect(mixColor(fabric, '#000000', 0.2), x0 + w - 0.2, y0 + 0.12, 0.2, 0.6, 0.08); rect(hsl((hue + 40) % 360, 60, 60), x0 + 0.3, y0 + 0.5, 0.35, 0.3, 0.08); rect(hsl((hue + 200) % 360, 50, 55), x0 + w - 0.7, y0 + 0.5, 0.33, 0.28, 0.08); rect('rgba(0,0,0,0.18)', x0 + w / 2, y0 + 0.14, 0.012, 0.38); legs(x0, w, 0.12); break;
    case 'armchair': grad(fabric, mixColor(fabric, '#000000', 0.35), x0, y0 + 0.12, w, 0.4, 0.08); rect(mixColor(fabric, '#000000', 0.15), x0 + 0.05, y0 + 0.5, w * 0.35, 0.5, 0.1); legs(x0, w, 0.12); break;
    case 'tv': rect('#57534e', x0, y0, w, 0.45, 0.03); rect('#3f3f46', x0 + 0.08, y0 + 0.05, w - 0.16, 0.18); rect('#111827', x0 + 0.05, y0 + 0.5, w - 0.1, 0.62, 0.03); rect('#0f172a', x0 + 0.1, y0 + 0.55, w - 0.2, 0.52); break;
    case 'bookshelf': case 'shelves': {
      rect(wood, x0, y0, w, 1.9); const n = 4;
      for (let i = 0; i < n; i++) { const sy = y0 + 0.15 + i * 0.45; rect(mixColor(wood, '#000000', 0.35), x0 + 0.06, sy, w - 0.12, 0.38);
        for (let bx = x0 + 0.1; bx < x0 + w - 0.15; bx += 0.1) { const hh = 0.22 + hash(bx * 13 + i) * 0.13; const c = room.theme === 'shop' ? hsl((hash(bx + i * 7) * 360) | 0, 65, 55) : ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#6d28d9', '#e5e7eb'][Math.floor(hash(bx * 7 + i) * 6)]; rect(c, bx, sy + 0.02, 0.08, room.theme === 'shop' ? 0.2 : hh); } }
      break;
    }
    case 'plant': rect('#9a3412', x0 + w * 0.25, y0, w * 0.5, 0.35, 0.05); for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#15803d' : '#22c55e'; ctx.beginPath(); ctx.ellipse(x(x0 + w / 2 + (i - 3) * 0.08), y(y0 + 0.55 + Math.abs(i - 3) * -0.04 + 0.2), s * 0.09, s * 0.3, (i - 3) * 0.35, 0, Math.PI * 2); ctx.fill(); } break;
    case 'lamp': rect('#44403c', x0 + w / 2 - 0.15, y0, 0.3, 0.05); rect('#57534e', x0 + w / 2 - 0.02, y0, 0.04, 1.4); ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(x(x0 + w / 2 - 0.22), y(y0 + 1.35)); ctx.lineTo(x(x0 + w / 2 + 0.22), y(y0 + 1.35)); ctx.lineTo(x(x0 + w / 2 + 0.12), y(y0 + 1.65)); ctx.lineTo(x(x0 + w / 2 - 0.12), y(y0 + 1.65)); ctx.fill(); break;
    case 'rug': { const c = hsl((hue + 200) % 360, 45, 45); rect(mixColor(c, '#000000', 0.25), x0 - 1.25, y0 + 0.01, 2.7, 0.2, 0.02); rect(c, x0 - 1.15, y0 + 0.04, 2.5, 0.14); for (let i = 0; i < 6; i++) rect(hsl((hue + 30) % 360, 55, 65), x0 - 1 + i * 0.42, y0 + 0.08, 0.2, 0.05); break; }
    case 'stove': grad('#e5e7eb', '#9ca3af', x0, y0, w, 0.9); rect('#111827', x0 + 0.1, y0 + 0.15, w - 0.2, 0.5, 0.03); rect('#374151', x0, y0 + 0.88, w, 0.04); for (const k of [0.25, 0.6]) circ('#1f2937', x0 + w * k, y0 + 0.93, 0.08); rect('#57534e', x0 + w * 0.6 - 0.16, y0 + 0.95, 0.32, 0.2, 0.03); rect('#78716c', x0 + w * 0.6 - 0.18, y0 + 1.14, 0.36, 0.03); for (let i = 0; i < 4; i++) rect('#111827', x0 + 0.12 + i * 0.2, y0 + 0.75, 0.08, 0.05, 0.02); grad('#d1d5db', '#9ca3af', x0 - 0.05, y0 + 1.75, w + 0.1, 0.35); break;
    case 'fridge': grad('#f8fafc', '#cbd5e1', x0, y0, w, 1.8, 0.06); rect('rgba(0,0,0,0.15)', x0, y0 + 1.15, w, 0.02); rect('#94a3b8', x0 + w - 0.12, y0 + 1.25, 0.04, 0.3); rect('#94a3b8', x0 + w - 0.12, y0 + 0.65, 0.04, 0.35); for (let i = 0; i < 3; i++) rect(hsl((seed * 3 + i * 90) % 360, 70, 60), x0 + 0.15 + i * 0.2, y0 + 1.3 + (i % 2) * 0.15, 0.12, 0.12, 0.03); break;
    case 'kitchenTable': case 'diningTable': case 'cafeTable': {
      const tw = f.item === 'cafeTable' ? 0.6 : w * 0.7, tx = x0 + (w - tw) / 2;
      rect(f.item === 'cafeTable' ? '#d6d3d1' : wood, tx, y0 + 0.7, tw, 0.06); legs(tx, tw, 0.7, f.item === 'cafeTable' ? '#57534e' : mixColor(wood, '#000000', 0.3));
      for (const cx of [x0 + 0.05, x0 + w - 0.35]) { rect(mixColor(wood, '#000000', 0.2), cx, y0 + 0.42, 0.3, 0.05); rect(mixColor(wood, '#000000', 0.2), cx + (cx < tx ? 0 : 0.25), y0, 0.04, 0.95); rect(mixColor(wood, '#000000', 0.2), cx + 0.13, y0, 0.04, 0.42); }
      rect('#f8fafc', tx + tw * 0.3, y0 + 0.76, 0.18, 0.03); rect('rgba(186,230,253,0.8)', tx + tw * 0.65, y0 + 0.76, 0.06, 0.15); break;
    }
    case 'sink': grad(hsl(hue, 20, 60), hsl(hue, 20, 40), x0, y0, w, 0.88); rect('#e5e7eb', x0 - 0.03, y0 + 0.86, w + 0.06, 0.06); rect('#9ca3af', x0 + w / 2 - 0.02, y0 + 0.92, 0.04, 0.22); rect('#9ca3af', x0 + w / 2 - 0.02, y0 + 1.12, 0.15, 0.03); for (let i = 0; i < 4; i++) rect('#f8fafc', x0 + 0.08 + i * 0.07, y0 + 0.93, 0.03, 0.22, 0.015); rect('#ef4444', x0 + w - 0.3, y0 + 0.93, 0.18, 0.16, 0.06); grad(hsl(hue, 20, 70), hsl(hue, 20, 55), x0, y0 + 1.6, w, 0.6); for (let i = 1; i < 3; i++) rect('rgba(0,0,0,0.2)', x0 + i * w / 3, y0 + 0.05, 0.01, 0.8); break;
    case 'bed': case 'bunk': {
      const levels = f.item === 'bunk' ? [0, 0.95] : [0];
      for (const ly of levels) { rect(wood, x0, y0 + ly, w, 0.35); rect('#f8fafc', x0 + 0.05, y0 + ly + 0.35, w - 0.1, 0.15, 0.05); grad(hsl((hue + 100 + seed % 90) % 360, 50, 55), hsl((hue + 100 + seed % 90) % 360, 50, 40), x0 + 0.5, y0 + ly + 0.32, w - 0.55, 0.22, 0.06); rect('#f8fafc', x0 + 0.08, y0 + ly + 0.48, 0.42, 0.14, 0.06); }
      if (f.item === 'bed') { grad(mixColor(wood, '#ffffff', 0.1), mixColor(wood, '#000000', 0.2), x0 - 0.04, y0, 0.14, 1.25, 0.06); rect('rgba(255,255,255,0.75)', x0 + 0.55, y0 + 0.48, 0.5, 0.06, 0.03); }
      rect(mixColor(wood, '#000000', 0.2), x0 - 0.02, y0, 0.1, f.item === 'bunk' ? 1.8 : 1.05, 0.03); if (f.item === 'bunk') rect(mixColor(wood, '#000000', 0.2), x0 + w - 0.08, y0, 0.08, 1.8); break;
    }
    case 'wardrobe': case 'cabinet': grad(wood, mixColor(wood, '#000000', 0.25), x0, y0, w, f.item === 'cabinet' ? 1.6 : 2); rect('rgba(0,0,0,0.25)', x0 + w / 2 - 0.005, y0 + 0.05, 0.01, f.item === 'cabinet' ? 1.5 : 1.9); for (const k of [-1, 1]) circ('#d6d3d1', x0 + w / 2 + k * 0.07, y0 + 1, 0.025); if (f.item === 'cabinet') rect('rgba(186,230,253,0.4)', x0 + 0.08, y0 + 0.9, w - 0.16, 0.6); break;
    case 'desk': case 'computerDesk': {
      rect(f.item === 'computerDesk' ? '#e5e7eb' : wood, x0, y0 + 0.72, w, 0.05); legs(x0, w, 0.72);
      if (f.item === 'computerDesk') { rect('#111827', x0 + w / 2 - 0.28, y0 + 0.85, 0.56, 0.36, 0.02); rect('#1e3a8a', x0 + w / 2 - 0.25, y0 + 0.88, 0.5, 0.3); rect('#374151', x0 + w / 2 - 0.03, y0 + 0.77, 0.06, 0.1); rect('#d1d5db', x0 + w / 2 - 0.2, y0 + 0.77, 0.4, 0.02); }
      else { rect('#facc15', x0 + 0.15, y0 + 0.77, 0.08, 0.3); rect('#fef9c3', x0 + 0.05, y0 + 1.05, 0.28, 0.1); rect('#e5e7eb', x0 + w * 0.5, y0 + 0.77, 0.3, 0.04); }
      if (room.theme === 'office') {
        rect('#d9d6cb', x0 + w - 0.29, y0 + 0.77, 0.22, 0.045);
        rect('#ede9df', x0 + w - 0.27, y0 + 0.815, 0.18, 0.027);
        rect('#63817e', x0 + 0.07, y0 + 0.77, 0.11, 0.12, 0.022);
        rect('#2d373b', x0 + 0.09, y0 + 0.88, 0.072, 0.022);
      }
      rect('#1f2937', x0 + w * 0.15, y0 + 0.42, 0.4, 0.06); rect('#1f2937', x0 + w * 0.32, y0, 0.05, 0.42); break;
    }
    case 'mirror': rect('#a16207', x0 + w / 2 - 0.3, y0 + 1, 0.6, 1.1, 0.25); { const m = ctx.createLinearGradient(x(x0), y(y0 + 2), x(x0 + w), y(y0 + 1)); m.addColorStop(0, '#e0f2fe'); m.addColorStop(0.5, '#94a3b8'); m.addColorStop(1, '#e0f2fe'); rect(m, x0 + w / 2 - 0.25, y0 + 1.05, 0.5, 1, 0.22); } break;
    case 'tub': grad('#f8fafc', '#cbd5e1', x0, y0 + 0.08, w, 0.55, 0.2); rect('#bae6fd', x0 + 0.08, y0 + 0.55, w - 0.16, 0.05); rect('#9ca3af', x0 + 0.1, y0, 0.08, 0.1); rect('#9ca3af', x0 + w - 0.18, y0, 0.08, 0.1); rect('#9ca3af', x0 + w - 0.2, y0 + 0.6, 0.04, 1.3); circ('#9ca3af', x0 + w - 0.28, y0 + 1.85, 0.12); rect('rgba(186,230,253,0.25)', x0, y0 + 0.62, 0.05, 1.5); break;
    case 'washbasin': rect('#f8fafc', x0 + 0.1, y0 + 0.82, w - 0.2, 0.15, 0.05); rect('#e5e7eb', x0 + w / 2 - 0.06, y0, 0.12, 0.82); rect('#9ca3af', x0 + w / 2 - 0.02, y0 + 0.97, 0.04, 0.12); break;
    case 'whiteboard': rect('#94a3b8', x0, y0 + 0.9, w, 1.1, 0.02); rect('#f8fafc', x0 + 0.04, y0 + 0.94, w - 0.08, 1.02); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(x(x0 + 0.15), y(y0 + 1.2)); ctx.lineTo(x(x0 + 0.5), y(y0 + 1.6)); ctx.lineTo(x(x0 + 0.8), y(y0 + 1.4)); ctx.lineTo(x(x0 + 1.1), y(y0 + 1.8)); ctx.stroke(); legs(x0, w, 0.9); break;
    case 'cooler': rect('#e5e7eb', x0, y0, w, 0.95, 0.05); rect('#93c5fd', x0 + 0.05, y0 + 0.95, w - 0.1, 0.45, 0.15); break;
    case 'treadmill': rect('#111827', x0, y0 + 0.05, w, 0.18, 0.05); rect('#374151', x0 + w - 0.15, y0, 0.08, 1.2); rect('#1f2937', x0 + w - 0.4, y0 + 1.1, 0.4, 0.15, 0.03); rect('#22d3ee', x0 + w - 0.35, y0 + 1.15, 0.2, 0.06); break;
    case 'weights': rect('#374151', x0, y0, 0.06, 0.95); rect('#374151', x0 + w - 0.06, y0, 0.06, 0.95); for (let i = 0; i < 3; i++) { rect('#111827', x0 + 0.08, y0 + 0.2 + i * 0.27, w - 0.16, 0.04); circ('#1f2937', x0 + 0.2, y0 + 0.22 + i * 0.27, 0.09); circ('#1f2937', x0 + w - 0.2, y0 + 0.22 + i * 0.27, 0.09); } break;
    case 'mat': rect(hsl((seed * 7) % 360, 60, 55), x0, y0, w, 0.03); break;
    case 'toys': rect('#ef4444', x0, y0, 0.25, 0.25); rect('#3b82f6', x0 + 0.27, y0, 0.25, 0.25); rect('#facc15', x0 + 0.12, y0 + 0.25, 0.25, 0.25); circ('#a16207', x0 + w - 0.3, y0 + 0.25, 0.22); circ('#a16207', x0 + w - 0.3, y0 + 0.55, 0.15); circ('#a16207', x0 + w - 0.42, y0 + 0.68, 0.06); circ('#a16207', x0 + w - 0.18, y0 + 0.68, 0.06); break;
    case 'easel': ctx.strokeStyle = '#92400e'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.moveTo(x(x0 + 0.15), y(y0)); ctx.lineTo(x(x0 + w / 2), y(y0 + 1.7)); ctx.lineTo(x(x0 + w - 0.15), y(y0)); ctx.stroke(); rect('#f8fafc', x0 + 0.1, y0 + 0.75, w - 0.2, 0.8); { const pa = ctx.createLinearGradient(x(x0), 0, x(x0 + w), 0); pa.addColorStop(0, '#f97316'); pa.addColorStop(0.5, '#38bdf8'); pa.addColorStop(1, '#a855f7'); rect(pa, x0 + 0.15, y0 + 0.8, w - 0.3, 0.7); } break;
    case 'piano': grad('#1c1917', '#0c0a09', x0, y0, w, 1.15, 0.04); rect('#f8fafc', x0 + 0.05, y0 + 0.72, w - 0.1, 0.12); for (let kx = x0 + 0.1; kx < x0 + w - 0.1; kx += 0.12) rect('#111', kx, y0 + 0.78, 0.05, 0.06); break;
    case 'washer': grad('#f8fafc', '#cbd5e1', x0, y0, w, 0.9, 0.05); circ('#334155', x0 + w / 2, y0 + 0.42, 0.28); circ('#60a5fa', x0 + w / 2, y0 + 0.42, 0.21); rect('#cbd5e1', x0 + 0.05, y0 + 0.8, w - 0.1, 0.06); break;
    case 'counter': {
      grad(hsl(hue, 24, 44), hsl(hue, 24, 25), x0, y0, w, 1.02, 0.02);
      for (let dx = 0.1; dx < w - 0.12; dx += 0.15) rect('rgba(0,0,0,0.18)', x0 + dx, y0 + 0.1, 0.016, 0.88);
      rect('#ded7c9', x0 - 0.05, y0 + 1, w + 0.1, 0.07);
      rect('#252c31', x0 + w - 0.45, y0 + 1.07, 0.32, 0.2, 0.03);
      rect('#86a8a5', x0 + w - 0.41, y0 + 1.19, 0.23, 0.045);
      if (room.shop === 'cafe') {
        grad('#dce5e7', '#697579', x0 + 0.17, y0 + 1.07, 0.77, 0.43, 0.04);
        rect('#2e3539', x0 + 0.21, y0 + 1.15, 0.69, 0.18);
        for (const dx of [0.35, 0.66]) {
          rect('#adb7bc', x0 + dx, y0 + 1.27, 0.06, 0.07);
          rect('#f4ece0', x0 + dx - 0.035, y0 + 1.09, 0.14, 0.1, 0.02);
          rect('#f4ece0', x0 + dx - 0.035, y0 + 1.5, 0.14, 0.1, 0.02);
        }
      }
      break;
    }
    case 'stool': rect('#57534e', x0 + w / 2 - 0.03, y0, 0.06, 0.7); rect('#b91c1c', x0, y0 + 0.7, w, 0.07, 0.03); break;
    case 'oven': rect('#b45309', x0, y0, w, 1, 0.05); ctx.fillStyle = '#9a3412'; ctx.beginPath(); ctx.ellipse(x(x0 + w / 2), y(y0 + 1), w * 0.5 * s, 0.6 * s, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.ellipse(x(x0 + w / 2), y(y0 + 0.95), w * 0.25 * s, 0.3 * s, 0, Math.PI, 0); ctx.fill(); { const fire = ctx.createRadialGradient(x(x0 + w / 2), y(y0 + 1), 0, x(x0 + w / 2), y(y0 + 1), w * 0.3 * s); fire.addColorStop(0, '#fde047'); fire.addColorStop(1, 'rgba(234,88,12,0)'); ctx.fillStyle = fire; ctx.fillRect(x(x0), y(y0 + 1.4), w * s, 0.5 * s); } break;
    case 'barberChair': rect('#111827', x0 + w / 2 - 0.15, y0, 0.3, 0.1); rect('#9ca3af', x0 + w / 2 - 0.03, y0 + 0.1, 0.06, 0.35); rect('#b91c1c', x0 + 0.1, y0 + 0.45, w - 0.2, 0.12, 0.04); rect('#b91c1c', x0 + 0.1, y0 + 0.5, 0.15, 0.6, 0.05); break;
    case 'crates': for (let i = 0; i < 3; i++) { rect('#a16207', x0 + i * (w / 3), y0, w / 3 - 0.05, 0.45); for (let j = 0; j < 4; j++) circ(['#ef4444', '#f97316', '#84cc16', '#facc15'][(i + seed) % 4], x0 + i * (w / 3) + 0.1 + j * 0.12, y0 + 0.5, 0.07); } break;
    case 'freezer': rect('#e5e7eb', x0, y0, w, 0.85, 0.05); rect('rgba(186,230,253,0.6)', x0 + 0.05, y0 + 0.6, w - 0.1, 0.2); for (let i = 0; i < 5; i++) circ(['#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd', '#fdba74'][i], x0 + 0.15 + i * (w - 0.3) / 4, y0 + 0.7, 0.06); break;
    case 'bricks': for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - (r % 2); i++) rect('#b45309', x0 + (r % 2) * 0.12 + i * 0.27, y0 + r * 0.13, 0.25, 0.12); break;
    case 'mixer': circ('#f97316', x0 + w / 2, y0 + 0.65, 0.42); rect('#ea580c', x0 + w / 2 - 0.1, y0 + 0.95, 0.35, 0.25, 0.05); rect('#1f2937', x0 + 0.1, y0, w - 0.2, 0.25); circ('#111', x0 + 0.25, y0 + 0.12, 0.12); circ('#111', x0 + w - 0.25, y0 + 0.12, 0.12); break;
    case 'scaffold': ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(1.5, s * 0.05); for (const xx of [x0, x0 + w]) { ctx.beginPath(); ctx.moveTo(x(xx), y(y0)); ctx.lineTo(x(xx), y(y0 + 2.2)); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x(x0), y(y0)); ctx.lineTo(x(x0 + w), y(y0 + 1.1)); ctx.moveTo(x(x0), y(y0 + 1.1)); ctx.lineTo(x(x0 + w), y(y0 + 2.2)); ctx.stroke(); rect('#a16207', x0 - 0.1, y0 + 1.1, w + 0.2, 0.06); break;
    case 'lobbyDesk': grad('#1f2937', '#0f172a', x0, y0, w, 1.05, 0.04); rect('#d4af37', x0, y0 + 1.03, w, 0.04); rect('#111827', x0 + w - 0.5, y0 + 1.07, 0.35, 0.25, 0.03); break;
    case 'elevator': rect('#94a3b8', x0, y0, w, 2.15); rect('#cbd5e1', x0 + 0.06, y0, w / 2 - 0.08, 2.05); rect('#cbd5e1', x0 + w / 2 + 0.02, y0, w / 2 - 0.08, 2.05); rect('#111827', x0 + w / 2 - 0.25, y0 + 2.2, 0.5, 0.18, 0.02); ctx.fillStyle = '#ef4444'; ctx.font = font(900, s * 0.13); ctx.textAlign = 'center'; ctx.fillText(String((room.seed % 9) + 1), x(x0 + w / 2), y(y0 + 2.24)); break;
    case 'fishbowl': rect(wood, x0 + 0.1, y0, w - 0.2, 0.7); circ('rgba(125,211,252,0.6)', x0 + w / 2, y0 + 0.95, 0.27); circ('#f97316', x0 + w / 2 + 0.05, y0 + 0.92, 0.06); break;
    case 'radio': rect(wood, x0, y0, w, 0.7); rect('#78350f', x0 + 0.05, y0 + 0.7, w - 0.1, 0.32, 0.05); circ('#d6d3d1', x0 + 0.18, y0 + 0.86, 0.07); for (let i = 0; i < 4; i++) rect('#451a03', x0 + 0.3, y0 + 0.78 + i * 0.05, w - 0.4, 0.02); break;
    case 'clock': rect('#78350f', x0 + w / 2 - 0.12, y0, 0.24, 1.9, 0.04); circ('#f8fafc', x0 + w / 2, y0 + 1.6, 0.13); break;
    case 'toilet': rect('#f8fafc', x0 + 0.05, y0, w - 0.15, 0.42, 0.06); rect('#e5e7eb', x0, y0 + 0.4, w - 0.05, 0.06, 0.03); rect('#f8fafc', x0 + w - 0.22, y0 + 0.4, 0.2, 0.5, 0.04); rect('#cbd5e1', x0 + w - 0.2, y0 + 0.82, 0.12, 0.03); break;
    case 'nightstand': grad(wood, mixColor(wood, '#000000', 0.3), x0, y0, w, 0.55, 0.03); rect('rgba(0,0,0,0.25)', x0 + 0.04, y0 + 0.27, w - 0.08, 0.01); circ('#d6d3d1', x0 + w / 2, y0 + 0.4, 0.025); rect('#57534e', x0 + w / 2 - 0.02, y0 + 0.55, 0.04, 0.22); ctx.fillStyle = hsl((hue + 40) % 360, 60, 80); ctx.beginPath(); ctx.moveTo(x(x0 + w / 2 - 0.15), y(y0 + 0.75)); ctx.lineTo(x(x0 + w / 2 + 0.15), y(y0 + 0.75)); ctx.lineTo(x(x0 + w / 2 + 0.09), y(y0 + 0.95)); ctx.lineTo(x(x0 + w / 2 - 0.09), y(y0 + 0.95)); ctx.fill(); rect('#1f2937', x0 + 0.05, y0 + 0.55, 0.14, 0.05); break;
    case 'sideTable': legs(x0, w, 0.55, mixColor(wood, '#000000', 0.3)); rect(wood, x0 - 0.03, y0 + 0.55, w + 0.06, 0.05); rect('#0ea5e9', x0 + w / 2 - 0.07, y0 + 0.6, 0.14, 0.22, 0.05); circ('#f472b6', x0 + w / 2, y0 + 0.88, 0.07); circ('#22c55e', x0 + w / 2 - 0.06, y0 + 0.84, 0.04); break;
    case 'filing': grad('#9ca3af', '#6b7280', x0, y0, w, 1.3, 0.02); for (let i = 0; i < 4; i++) { rect('rgba(0,0,0,0.25)', x0 + 0.03, y0 + 0.05 + i * 0.32, w - 0.06, 0.01); rect('#e5e7eb', x0 + w / 2 - 0.08, y0 + 0.2 + i * 0.32, 0.16, 0.03); } break;
    case 'printer': legs(x0, w, 0.7); rect('#cbd5e1', x0 - 0.05, y0 + 0.7, w + 0.1, 0.05); rect('#e5e7eb', x0, y0 + 0.75, w, 0.28, 0.04); rect('#f8fafc', x0 + 0.1, y0 + 1.03, w - 0.2, 0.12); rect('#22c55e', x0 + w - 0.12, y0 + 0.88, 0.05, 0.03); break;
    case 'bin': grad('#64748b', '#334155', x0, y0, w, 0.42, 0.04); rect('#1f2937', x0 - 0.02, y0 + 0.4, w + 0.04, 0.04); break;
    case 'coatRack': rect('#44403c', x0 + w / 2 - 0.15, y0, 0.3, 0.04); rect('#57534e', x0 + w / 2 - 0.02, y0, 0.04, 1.75); rect(hsl((seed * 13) % 360, 40, 35), x0 + w / 2 - 0.16, y0 + 0.95, 0.18, 0.75, 0.06); rect(hsl((seed * 29) % 360, 50, 45), x0 + w / 2 + 0.02, y0 + 1.25, 0.14, 0.5, 0.05); circ('#7c2d12', x0 + w / 2, y0 + 1.78, 0.1); break;
    case 'catBed': case 'dogBed': rect(hsl((hue + 300) % 360, 40, 50), x0, y0, w, 0.18, 0.08); { const c = f.item === 'catBed' ? '#f97316' : '#a16207'; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x(x0 + w / 2), y(y0 + 0.25), w * 0.35 * s, 0.13 * s, 0, 0, Math.PI * 2); ctx.fill(); circ(c, x0 + w * 0.8, y0 + 0.3, 0.1); } break;
  }
}

const roomCache = new Map<string, HTMLCanvasElement>();
// Se guardan imágenes hasta un total de píxeles (las de mucho zoom son enormes): se tiran las que hace más que no se usan.
const CACHE_PIXELS = 48e6;
let cachePixels = 0;
// Cuántas imágenes nuevas se arman por cuadro (las demás, en los cuadros siguientes): así arrancar o hacer
// zoom no traba el juego en las compus y celulares lentos.
let budget = 0;
function roomImage(room: Room, b: Building, level: number, dpr: number) {
  const key = `${room.id}:${level}:${dpr}`;
  const hit = roomCache.get(key);
  if (hit) { roomCache.delete(key); roomCache.set(key, hit); return hit; }
  if (typeof document === 'undefined' || budget <= 0) return null;
  budget--;
  const S = ZOOMS[level], pad = 0.05;
  if (S > 120) dpr = 1; // con tanto zoom no hace falta más resolución (y las imágenes serían gigantes)
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((room.x2 - room.x1 + pad * 2) * S * dpr); canvas.height = Math.ceil((room.h + pad * 2) * S * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawRoomStatic(ctx, room, b, { x: u => (u - room.x1 + pad) * S, y: u => (room.y + room.h + pad - u) * S, s: S });
  roomCache.set(key, canvas);
  cachePixels += canvas.width * canvas.height;
  while (cachePixels > CACHE_PIXELS && roomCache.size > 1) { const [old, img] = roomCache.entries().next().value!; roomCache.delete(old); cachePixels -= img.width * img.height; }
  return canvas;
}
// Cualquier imagen ya armada de la habitación (de otro zoom), mientras se arma la del zoom actual.
const cachedAny = (room: Room, dpr: number) => { for (let l = ZOOMS.length - 1; l >= 0; l--) { const hit = roomCache.get(`${room.id}:${l}:${dpr}`); if (hit) return hit; } return null; };
export const levelFor = (s: number) => { const i = ZOOMS.findIndex(z => z >= s * 0.95); return i < 0 ? ZOOMS.length - 1 : i; };

// ---------- Lo que se mueve en cada habitación ----------
function drawRoomLive(ctx: CanvasRenderingContext2D, g: Invasion, room: Room, b: Building, v: View, flicker: boolean) {
  const s = v.s, x1 = X(v, room.x1), x2 = X(v, room.x2), top = Y(v, room.y + room.h), base = Y(v, room.y), t = v.t;
  // Lámpara del techo y luz.
  const lit = room.lights && room.theme !== 'site' && !room.destroyed && (!flicker || Math.sin(t * 40) > 0);
  const lx = (x1 + x2) / 2;
  if (room.theme !== 'site') {
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, top + s * 0.3); ctx.stroke();
    ctx.fillStyle = lit ? '#fde68a' : '#57534e'; ctx.beginPath(); ctx.moveTo(lx - s * 0.2, top + s * 0.45); ctx.lineTo(lx + s * 0.2, top + s * 0.45); ctx.lineTo(lx + s * 0.1, top + s * 0.28); ctx.lineTo(lx - s * 0.1, top + s * 0.28); ctx.fill();
  }
  if (lit) {
    const gl = ctx.createRadialGradient(lx, top + s * 0.5, 0, lx, top + s * 0.5, (room.x2 - room.x1) * s * 0.6);
    gl.addColorStop(0, 'rgba(255,236,170,0.22)'); gl.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gl; ctx.fillRect(x1, top, x2 - x1, base - top);
  } else if (!room.destroyed) { ctx.fillStyle = 'rgba(10,10,30,0.28)'; ctx.fillRect(x1, top, x2 - x1, base - top); }
  // El cielo de afuera se va poniendo rojo en las ventanas.
  const ruin = ruinAt(g.time);
  if (ruin > 0) for (const [a, c] of windowsOf(room, b)) { ctx.fillStyle = `rgba(234,88,12,${ruin * 0.45})`; ctx.fillRect(X(v, a), Y(v, winTop(room)), (c - a) * s, (winTop(room) - winBottom(room, b)) * s); }
  // Pantallas de la tele y de las computadoras.
  for (const f of room.furniture) {
    if (f.item === 'tv') {
      const sx = X(v, f.x + 0.1), sy = Y(v, room.y + 1.07), sw = (f.w - 0.2) * s, sh = 0.52 * s;
      const someone = g.people.find(p => p.room === room.id && !p.dead && p.anomaly && (p.anomaly.id !== undefined) && Math.abs(p.x - f.x) < 4);
      const staticTv = someone && someone.anomaly && someone.alien && (g.time - someone.anomaly.t0) < 8 && Math.floor(t * 30) % 2 === 0 && hash(someone.anomaly.id) < 2;
      if (staticTv && Math.floor(t * 2) % 3 === 0) { for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(t * 30)) * 0.8})`; ctx.fillRect(sx + hash(i * 3 + t) * sw, sy + hash(i * 7 + t) * sh, 2, 2); } continue; }
      const ch = Math.floor(t / 4 + room.seed) % 5;
      const tv = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
      tv.addColorStop(0, hsl((ch * 70 + t * 10) % 360, 60, 55)); tv.addColorStop(1, hsl((ch * 70 + 120) % 360, 60, 30));
      ctx.fillStyle = tv; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(sx + sw * (0.3 + 0.2 * Math.sin(t + ch)), sy + sh * 0.6, sh * 0.18, 0, Math.PI * 2); ctx.fill();
      const glow = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 0, sx + sw / 2, sy + sh / 2, s * 2.2);
      glow.addColorStop(0, 'rgba(147,197,253,0.18)'); glow.addColorStop(1, 'rgba(147,197,253,0)');
      ctx.fillStyle = glow; ctx.fillRect(sx - s * 2, sy - s * 2, sw + s * 4, sh + s * 4);
    }
    if (f.item === 'computerDesk') { ctx.fillStyle = Math.floor(t * 1.5 + f.x) % 4 ? '#1d4ed8' : '#2563eb'; ctx.fillRect(X(v, f.x + f.w / 2 - 0.25), Y(v, room.y + 1.18), 0.5 * s, 0.3 * s); for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X(v, f.x + f.w / 2 - 0.2), Y(v, room.y + 1.12 - i * 0.07), (0.15 + hash(i + Math.floor(t)) * 0.2) * s, 1.2); } }
    if (f.item === 'stove' && g.people.some(p => p.room === room.id && p.act === 'cook' && !p.moving && !p.dead)) for (let i = 0; i < 3; i++) { const l = (t * 0.8 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - l)})`; ctx.beginPath(); ctx.arc(X(v, f.x + f.w * 0.4 + Math.sin(t + i) * 0.1), Y(v, room.y + 1 + l * 0.8), s * (0.08 + l * 0.15), 0, Math.PI * 2); ctx.fill(); }
  }
}

// Fuego, humo, paredes quemadas y habitaciones destruidas.
function drawRoomDamage(ctx: CanvasRenderingContext2D, room: Room, v: View) {
  const s = v.s, x1 = X(v, room.x1), x2 = X(v, room.x2), top = Y(v, room.y + room.h), base = Y(v, room.y), t = v.t;
  if (room.burnt > 0) { ctx.fillStyle = `rgba(18,10,8,${room.burnt * 0.75})`; ctx.fillRect(x1, top, x2 - x1, base - top); }
  if (room.fire > 0.02) {
    const width = (room.x2 - room.x1) * Math.min(1, 0.15 + room.fire * 1.1), cx = X(v, room.fireAt), half = width * s / 2;
    const fx1 = Math.max(x1, cx - half), fx2 = Math.min(x2, cx + half), height = (0.6 + room.fire * (room.h - 0.8)) * s;
    const glow = ctx.createRadialGradient(cx, base - height * 0.4, 0, cx, base - height * 0.4, Math.max(height, half) * 1.4);
    glow.addColorStop(0, `rgba(255,170,60,${0.5 * Math.min(1, room.fire * 2)})`); glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(x1, top, x2 - x1, base - top);
    ctx.save(); ctx.beginPath(); ctx.rect(x1, top, x2 - x1, base - top); ctx.clip();
    const n = Math.max(4, Math.round((fx2 - fx1) / (s * 0.22)));
    for (let i = 0; i < n; i++) {
      const fx = fx1 + ((i + 0.5) / n) * (fx2 - fx1), life = (t * (1.3 + hash(i) * 0.7) + hash(i + room.id)) % 1;
      const fh = height * (0.55 + 0.45 * Math.sin(t * 7 + i * 1.7)) * (1 - life * 0.3), fw = (fx2 - fx1) / n * 1.1;
      const c = ctx.createLinearGradient(0, base, 0, base - fh);
      c.addColorStop(0, 'rgba(254,240,138,0.95)'); c.addColorStop(0.35, 'rgba(251,146,60,0.9)'); c.addColorStop(0.8, 'rgba(220,38,38,0.6)'); c.addColorStop(1, 'rgba(220,38,38,0)');
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(fx - fw, base); ctx.quadraticCurveTo(fx - fw * 0.6, base - fh * 0.6, fx + Math.sin(t * 9 + i) * fw * 0.3, base - fh); ctx.quadraticCurveTo(fx + fw * 0.6, base - fh * 0.6, fx + fw, base); ctx.fill();
    }
    // Humo negro en el techo.
    const smoke = ctx.createLinearGradient(0, top, 0, top + room.h * s * 0.6 * room.fire);
    smoke.addColorStop(0, `rgba(30,25,25,${0.85 * room.fire})`); smoke.addColorStop(1, 'rgba(30,25,25,0)');
    ctx.fillStyle = smoke; ctx.fillRect(x1, top, x2 - x1, room.h * s * 0.6);
    ctx.restore();
  }
  if (room.destroyed) {
    ctx.save(); ctx.beginPath(); ctx.rect(x1 - 1, top - 1, x2 - x1 + 2, base - top + 2); ctx.clip();
    ctx.fillStyle = '#1c1210'; ctx.fillRect(x1, top, x2 - x1, base - top);
    // Agujero dentado por el que se ve el cielo rojo.
    ctx.fillStyle = 'rgba(127,29,29,0.85)'; ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = (0.45 + hash(room.id * 7 + i) * 0.35) * Math.min(x2 - x1, base - top) * 0.5; const px = (x1 + x2) / 2 + Math.cos(a) * rr * 1.4, py = (top + base) / 2 + Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.fill();
    // Escombros y hierros.
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#57534e' : '#44403c'; const bx = x1 + hash(room.id + i) * (x2 - x1), bw = s * (0.2 + hash(i + room.id * 3) * 0.5); ctx.beginPath(); ctx.moveTo(bx - bw, base); ctx.lineTo(bx, base - bw * 0.8); ctx.lineTo(bx + bw, base); ctx.fill(); }
    ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = 0; i < 5; i++) { const bx = x1 + hash(room.id * 5 + i) * (x2 - x1); ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + (hash(i) - 0.5) * s, top + s * (0.4 + hash(i + 2) * 0.6)); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { const l = (t * 0.7 + i / 4) % 1; ctx.fillStyle = `rgba(251,146,60,${0.7 * (1 - l)})`; ctx.beginPath(); ctx.arc(x1 + hash(room.id + i * 9) * (x2 - x1), base - l * s * 1.2, s * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

// ---------- Estructura de cada edificio: paredes de los costados, losas, carteles, terraza ----------
const FACADE: Record<string, (b: Building) => string> = {
  brick: b => hsl(10 + b.tone * 15, 45, 34 + b.tone * 8), stucco: b => hsl(35 + b.tone * 20, 35, 70), glass: () => '#1e3a5f', office: () => '#9ca3af',
  construction: () => '#a8a29e', old: b => hsl(40, 20, 62 + b.tone * 8), hotel: b => hsl(b.hue, 25, 45),
};
function drawStructure(ctx: CanvasRenderingContext2D, g: Invasion, b: Building, v: View) {
  const s = v.s, wall = 0.25, color = FACADE[b.style](b);
  const side = (x: number) => {
    const gx = X(v, x), gw = wall * s, top = Y(v, b.top), base = Y(v, 0);
    if (b.style === 'construction') { ctx.fillStyle = '#9ca3af'; ctx.fillRect(gx, top, gw, base - top); return; }
    const grad = ctx.createLinearGradient(gx, 0, gx + gw, 0); grad.addColorStop(0, mixColor(color, '#000000', 0.3)); grad.addColorStop(0.5, color); grad.addColorStop(1, mixColor(color, '#000000', 0.2));
    ctx.fillStyle = grad; ctx.fillRect(gx, top, gw, base - top);
    if (b.style === 'brick') { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; for (let yy = 0; yy < b.top; yy += 0.18) { ctx.beginPath(); ctx.moveTo(gx, Y(v, yy)); ctx.lineTo(gx + gw, Y(v, yy)); ctx.stroke(); } }
    if (b.style === 'glass') { ctx.fillStyle = 'rgba(147,197,253,0.4)'; ctx.fillRect(gx + gw * 0.3, top, gw * 0.15, base - top); }
  };
  side(b.x); side(b.x + b.w - wall);
  // Losas entre pisos (con cornisa).
  for (let k = 1; k <= b.floors; k++) {
    const y = k === b.floors ? b.top : b.ground + (k - 1) * b.fh;
    const over = b.style === 'old' ? 0.3 : 0.15, th = b.style === 'glass' ? 0.16 : 0.24;
    const sl = ctx.createLinearGradient(0, Y(v, y), 0, Y(v, y - th));
    sl.addColorStop(0, b.style === 'glass' ? '#cbd5e1' : '#d6d3d1'); sl.addColorStop(1, b.style === 'glass' ? '#475569' : '#78716c');
    ctx.fillStyle = sl; ctx.fillRect(X(v, b.x - over), Y(v, y), (b.w + over * 2) * s, th * s);
    if (b.style === 'old') for (let xx = b.x - 0.25; xx < b.x + b.w + 0.25; xx += 0.3) { ctx.fillStyle = '#a8a29e'; ctx.fillRect(X(v, xx), Y(v, y - th), 0.15 * s, 0.1 * s); }
    if (b.style === 'construction' && k > b.floors * 0.55) { ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1; for (let xx = b.x; xx < b.x + b.w; xx += 0.4) { ctx.beginPath(); ctx.moveTo(X(v, xx), Y(v, y)); ctx.lineTo(X(v, xx + 0.05), Y(v, y + 0.4)); ctx.stroke(); } }
  }
  // Locales: cartel arriba de la vidriera y toldo a rayas.
  const shop = g.rooms[b.rooms[0]];
  if (shop?.shop) {
    const y = b.ground - 0.05, name = SHOP_NAMES[shop.shop];
    const sx = X(v, b.x + 0.4), sw = (b.w - 0.8) * s, sy = Y(v, y + 0.02);
    ctx.fillStyle = '#111827'; ctx.fillRect(sx, sy, sw, 0.5 * s);
    const neon = hsl((b.hue + 140) % 360, 85, 62);
    ctx.font = font(900, s * 0.36); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = neon; ctx.shadowBlur = s * 0.25; ctx.fillStyle = neon; ctx.fillText(name, sx + sw / 2, sy + 0.26 * s); ctx.shadowBlur = 0;
    // Toldo.
    const ay = Y(v, b.ground - 0.83), ah = 0.25 * s;
    const awningWidth = b.w - 0.6, panels = Math.ceil(awningWidth / 0.46);
    for (let i = 0; i < panels; i++) {
      const left = X(v, b.x + 0.3 + i * awningWidth / panels), panel = awningWidth / panels * s;
      ctx.fillStyle = i % 2 ? '#e8e0d2' : hsl(b.hue, 42, 37);
      ctx.beginPath(); ctx.moveTo(left, ay - ah); ctx.lineTo(left + panel, ay - ah);
      ctx.lineTo(left + panel + 0.06 * s, ay); ctx.lineTo(left + 0.06 * s, ay); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(X(v, b.x + 0.36), ay - 0.045 * s, awningWidth * s, 0.045 * s);
  } else if (b.style !== 'construction') {
    const usage = b.style === 'hotel' ? 'HOTEL' : b.style === 'office' || b.style === 'glass' ? 'OFICINAS' : 'DEPARTAMENTOS';
    const label = `${usage}  ·  ${120 + b.id * 18}`;
    const plaqueW = Math.min(b.w - 0.8, 4.6), left = X(v, b.x + (b.w - plaqueW) / 2);
    const top = Y(v, b.ground - 0.08);
    ctx.fillStyle = '#343c41'; ctx.fillRect(left, top, plaqueW * s, 0.48 * s);
    ctx.fillStyle = '#8c8170'; ctx.fillRect(left, top, plaqueW * s, 0.04 * s);
    ctx.fillStyle = '#eee7d9'; ctx.font = font(750, s * 0.25); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, X(v, b.x + b.w / 2), top + 0.25 * s, (plaqueW - 0.24) * s);
  }
  // Terraza.
  const ry = Y(v, b.top + 0.24);
  ctx.fillStyle = color; ctx.fillRect(X(v, b.x - 0.1), ry - 0.4 * s, 0.2 * s, 0.4 * s); ctx.fillRect(X(v, b.x + b.w - 0.1), ry - 0.4 * s, 0.2 * s, 0.4 * s);
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(X(v, b.x), ry - 0.75 * s); ctx.lineTo(X(v, b.x + b.w), ry - 0.75 * s); ctx.stroke();
  for (let xx = b.x; xx <= b.x + b.w; xx += 0.6) { ctx.beginPath(); ctx.moveTo(X(v, xx), ry); ctx.lineTo(X(v, xx), ry - 0.75 * s); ctx.stroke(); }
  if (b.roof === 'tank') { const tx = X(v, b.x + b.w * 0.7); ctx.strokeStyle = '#44403c'; ctx.lineWidth = Math.max(1.5, s * 0.05); for (const d of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(tx + d * s, ry); ctx.lineTo(tx + d * s * 0.7, ry - 1.4 * s); ctx.stroke(); } const tk = ctx.createLinearGradient(tx - s, 0, tx + s, 0); tk.addColorStop(0, '#78350f'); tk.addColorStop(0.5, '#b45309'); tk.addColorStop(1, '#78350f'); ctx.fillStyle = tk; ctx.fillRect(tx - 0.8 * s, ry - 2.9 * s, 1.6 * s, 1.5 * s); ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.moveTo(tx - 0.9 * s, ry - 2.9 * s); ctx.lineTo(tx, ry - 3.4 * s); ctx.lineTo(tx + 0.9 * s, ry - 2.9 * s); ctx.fill(); }
  if (b.roof === 'antenna') { const ax = X(v, b.x + b.w * 0.3); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(ax - 0.4 * s, ry); ctx.lineTo(ax, ry - 5 * s); ctx.lineTo(ax + 0.4 * s, ry); ctx.stroke(); for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(ax - 0.4 * s * (1 - i / 6), ry - i * 0.8 * s); ctx.lineTo(ax + 0.4 * s * (1 - i / 6), ry - i * 0.8 * s); ctx.stroke(); } ctx.fillStyle = Math.floor(v.t * 1.5) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(ax, ry - 5 * s, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse(ax + 0.9 * s, ry - 1.2 * s, 0.4 * s, 0.25 * s, -0.5, 0, Math.PI * 2); ctx.fill(); }
  if (b.roof === 'garden') for (let i = 0; i < 5; i++) { const gx = X(v, b.x + 1 + i * (b.w - 2) / 4); ctx.fillStyle = '#78350f'; ctx.fillRect(gx - 0.3 * s, ry - 0.4 * s, 0.6 * s, 0.4 * s); ctx.fillStyle = i % 2 ? '#15803d' : '#22c55e'; ctx.beginPath(); ctx.arc(gx, ry - 0.8 * s, 0.45 * s, 0, Math.PI * 2); ctx.fill(); }
  if (b.roof === 'sign' && b.sign) { const sx = X(v, b.x + 0.8), sw = (b.w - 1.6) * s; ctx.strokeStyle = '#57534e'; ctx.lineWidth = Math.max(1, s * 0.05); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx + (i / 3) * sw, ry); ctx.lineTo(sx + (i / 3) * sw, ry - 2.2 * s); ctx.stroke(); } ctx.fillStyle = '#111827'; ctx.fillRect(sx, ry - 3.2 * s, sw, 1.1 * s); const c = hsl((b.hue + 60) % 360, 90, 60); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = s * 0.4; ctx.font = font(900, s * 0.75); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.sign, sx + sw / 2, ry - 2.65 * s); ctx.shadowBlur = 0; }
  if (b.style === 'construction') drawCrane(ctx, g, b, v);
  if (b.style === 'office' || b.style === 'glass') for (let i = 0; i < 2; i++) { const ux = X(v, b.x + 1.2 + i * 2); ctx.fillStyle = '#9ca3af'; ctx.fillRect(ux, ry - 0.9 * s, 1.4 * s, 0.9 * s); ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(ux + 0.7 * s, ry - 0.45 * s, 0.3 * s, 0, Math.PI * 2); ctx.fill(); }
}
function drawCrane(ctx: CanvasRenderingContext2D, g: Invasion, b: Building, v: View) {
  const s = v.s, mx = X(v, b.x + b.w * 0.75), base = Y(v, b.top + 0.24), top = Y(v, b.top + 9);
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = Math.max(1.5, s * 0.06);
  for (const d of [-0.35, 0.35]) { ctx.beginPath(); ctx.moveTo(mx + d * s, base); ctx.lineTo(mx + d * s, top); ctx.stroke(); }
  for (let y = base; y > top; y -= s * 0.7) { ctx.beginPath(); ctx.moveTo(mx - 0.35 * s, y); ctx.lineTo(mx + 0.35 * s, y - s * 0.7); ctx.stroke(); }
  const jl = X(v, b.x - 4), jr = X(v, b.x + b.w + 2);
  ctx.beginPath(); ctx.moveTo(jl, top); ctx.lineTo(jr, top); ctx.moveTo(jl, top + 0.5 * s); ctx.lineTo(jr, top + 0.5 * s); ctx.stroke();
  for (let x = jl; x < jr; x += s * 0.7) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + s * 0.35, top + 0.5 * s); ctx.lineTo(x + s * 0.7, top); ctx.stroke(); }
  ctx.fillStyle = '#facc15'; ctx.fillRect(mx - 0.6 * s, top + 0.5 * s, 1.2 * s, 0.9 * s); ctx.fillStyle = '#7dd3fc'; ctx.fillRect(mx - 0.4 * s, top + 0.65 * s, 0.8 * s, 0.4 * s);
  const hx = X(v, b.x + Math.sin(g.time * 0.15) * 2), hy = Y(v, b.top + 3 + Math.sin(g.time * 0.3) * 1.5);
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, top + 0.5 * s); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#b45309'; ctx.fillRect(hx - 0.6 * s, hy, 1.2 * s, 0.4 * s);
}

// Pasajes entre edificios: pared de ladrillo del fondo, tacho de basura, ropa colgada y algún gato.
function drawAlley(ctx: CanvasRenderingContext2D, a: Building, b: Building, v: View) {
  const s = v.s, x1 = a.x + a.w, x2 = b.x, h = Math.max(Math.min(a.top, b.top), 6);
  const bg = ctx.createLinearGradient(0, Y(v, h), 0, Y(v, 0)); bg.addColorStop(0, '#44403c'); bg.addColorStop(1, '#1c1917');
  ctx.fillStyle = bg; ctx.fillRect(X(v, x1), Y(v, h), (x2 - x1) * s, h * s);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let yy = 0; yy < h; yy += 0.25) { ctx.beginPath(); ctx.moveTo(X(v, x1), Y(v, yy)); ctx.lineTo(X(v, x2), Y(v, yy)); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { const ly = 4 + k * 4; if (ly > h - 1) break; ctx.strokeStyle = '#d6d3d1'; ctx.beginPath(); ctx.moveTo(X(v, x1), Y(v, ly)); ctx.quadraticCurveTo(X(v, (x1 + x2) / 2), Y(v, ly - 0.4), X(v, x2), Y(v, ly)); ctx.stroke(); for (let i = 0; i < 3; i++) { const cx = x1 + (i + 0.5) * (x2 - x1) / 3; ctx.fillStyle = hsl((a.id * 50 + k * 70 + i * 40) % 360, 60, 55); ctx.fillRect(X(v, cx - 0.15), Y(v, ly - 0.2), 0.3 * s, 0.4 * s); } }
  if (x2 - x1 > 2) { ctx.fillStyle = '#166534'; ctx.fillRect(X(v, x1 + 0.3), Y(v, 0.9), 1.2 * s, 0.9 * s); ctx.fillStyle = '#14532d'; ctx.fillRect(X(v, x1 + 0.25), Y(v, 0.95), 1.3 * s, 0.1 * s); }
}

// ---------- Vereda, calle y autos ----------
function drawStreetBack(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  const s = v.s;
  // Vereda de baldosas.
  const sw = ctx.createLinearGradient(0, Y(v, 0), 0, Y(v, -0.35)); sw.addColorStop(0, '#a8a29e'); sw.addColorStop(1, '#78716c');
  ctx.fillStyle = sw; ctx.fillRect(0, Y(v, 0), v.w, 0.35 * s);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  const start = Math.floor((v.cx - v.w / s) / 0.6) * 0.6;
  for (let xx = start; xx < v.cx + v.w / s; xx += 0.6) { ctx.beginPath(); ctx.moveTo(X(v, xx), Y(v, 0)); ctx.lineTo(X(v, xx - 0.2), Y(v, -0.3)); ctx.stroke(); }
  ctx.fillStyle = '#57534e'; ctx.fillRect(0, Y(v, -0.3), v.w, 0.08 * s);
  // Calle.
  const road = ctx.createLinearGradient(0, Y(v, -0.4), 0, Y(v, -3.6)); road.addColorStop(0, '#374151'); road.addColorStop(1, '#1f2937');
  ctx.fillStyle = road; ctx.fillRect(0, Y(v, -0.38), v.w, 3.4 * s);
  // Vereda de enfrente (de donde mira el francotirador) y lo de abajo.
  ctx.fillStyle = '#57534e'; ctx.fillRect(0, Y(v, -3.72), v.w, 0.1 * s);
  const near = ctx.createLinearGradient(0, Y(v, -3.8), 0, Y(v, -6)); near.addColorStop(0, '#78716c'); near.addColorStop(1, '#292524');
  ctx.fillStyle = near; ctx.fillRect(0, Y(v, -3.8), v.w, Math.max(0, v.h - Y(v, -3.8)));
  ctx.fillStyle = '#fde047'; for (let xx = Math.floor((v.cx - v.w / s) / 3) * 3; xx < v.cx + v.w / s; xx += 3) ctx.fillRect(X(v, xx), Y(v, ROAD_Y - 0.25), 1.6 * s, 0.07 * s);
  for (let i = 0; i < g.buildings.length - 1; i += 3) {
    const b = g.buildings[i], next = g.buildings[i + 1];
    const xx = (b.x + b.w + next.x) / 2;
    if (!visible(v, xx - 1.5, xx + 1.5, -3.8, 3)) continue;
    ctx.fillStyle = '#39414a';
    ctx.fillRect(X(v, xx - 1.25), Y(v, -0.43), 2.5 * s, 3.2 * s);
    for (let stripe = 0; stripe < 5; stripe++) {
      ctx.fillStyle = stripe % 2 ? '#b7b8ad' : '#d1cfc1';
      ctx.fillRect(X(v, xx - 1.08 + stripe * 0.46), Y(v, -0.52), 0.25 * s, 3.04 * s);
    }
    ctx.fillStyle = '#484e4e';
    ctx.fillRect(X(v, xx + 1.45), Y(v, 2.6), 0.075 * s, 2.6 * s);
    ctx.fillStyle = '#355d74';
    ctx.fillRect(X(v, xx + 1.15), Y(v, 2.72), 0.68 * s, 0.42 * s);
    ctx.fillStyle = '#ecede5';
    ctx.font = font(750, 0.16 * s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CRUCE', X(v, xx + 1.49), Y(v, 2.51));
  }
  // Faroles (detrás de la gente).
  for (let xx = 6; xx < g.width; xx += 15) {
    if (!visible(v, xx - 2, xx + 2, -1, 6)) continue;
    const px = X(v, xx);
    ctx.fillStyle = '#1f2937'; ctx.fillRect(px - 0.06 * s, Y(v, 5.2), 0.12 * s, 5.2 * s); ctx.fillRect(px - 0.2 * s, Y(v, 0.3), 0.4 * s, 0.3 * s);
    ctx.fillRect(px, Y(v, 5.2), 0.8 * s, 0.08 * s);
    const on = ruinAt(g.time) < 0.8 || Math.sin(g.time * 13 + xx) > 0;
    ctx.fillStyle = on ? '#fef3c7' : '#57534e'; ctx.beginPath(); ctx.ellipse(px + 0.8 * s, Y(v, 5.05), 0.25 * s, 0.12 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (on && g.time > 200) { const gl = ctx.createRadialGradient(px + 0.8 * s, Y(v, 5), 0, px + 0.8 * s, Y(v, 5), 3 * s); gl.addColorStop(0, 'rgba(254,243,199,0.3)'); gl.addColorStop(1, 'rgba(254,243,199,0)'); ctx.fillStyle = gl; ctx.fillRect(px - 2.5 * s, Y(v, 8), 6 * s, 8 * s); }
  }
  // Parada de colectivo y bancos.
  for (let xx = 40; xx < g.width; xx += 70) {
    if (!visible(v, xx - 3, xx + 3, 0, 3)) continue;
    ctx.fillStyle = 'rgba(186,230,253,0.3)'; ctx.fillRect(X(v, xx - 1.5), Y(v, 2.2), 3 * s, 2.2 * s);
    ctx.fillStyle = '#334155'; ctx.fillRect(X(v, xx - 1.6), Y(v, 2.3), 3.2 * s, 0.15 * s); ctx.fillRect(X(v, xx - 1.5), Y(v, 2.2), 0.08 * s, 2.2 * s); ctx.fillRect(X(v, xx + 1.42), Y(v, 2.2), 0.08 * s, 2.2 * s);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(X(v, xx + 1.6), Y(v, 2.6), 0.5 * s, 0.5 * s); ctx.fillStyle = '#fff'; ctx.font = font(900, s * 0.28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('152', X(v, xx + 1.85), Y(v, 2.35));
    ctx.fillStyle = '#78350f'; ctx.fillRect(X(v, xx - 1), Y(v, 0.45), 2 * s, 0.08 * s);
  }
}
function drawCar(ctx: CanvasRenderingContext2D, c: Invasion['cars'][number], v: View, t: number) {
  const s = v.s, len = c.kind === 'bus' ? 7 : c.kind === 'van' ? 3.6 : 3.2, hgt = c.kind === 'bus' ? 2.3 : c.kind === 'van' ? 1.5 : 1.15;
  const by = c.lane ? -2.5 : -1.1;
  if (!visible(v, c.x - len, c.x + len, by, by + hgt)) return;
  ctx.save(); ctx.translate(X(v, c.x), Y(v, by)); ctx.scale(c.dir, 1);
  const body = c.kind === 'taxi' ? '#facc15' : c.kind === 'police' ? '#f8fafc' : c.kind === 'bus' ? '#0ea5e9' : hsl(c.hue, 55, 45);
  const gr = ctx.createLinearGradient(0, -hgt * s, 0, 0); gr.addColorStop(0, mixColor(body, '#ffffff', 0.25)); gr.addColorStop(1, mixColor(body, '#000000', 0.3));
  ctx.fillStyle = gr;
  ctx.beginPath();
  if (c.kind === 'bus' || c.kind === 'van') ctx.roundRect(-len / 2 * s, -hgt * s, len * s, (hgt - 0.25) * s, 0.25 * s);
  else { ctx.moveTo(-len / 2 * s, -0.25 * s); ctx.lineTo(-len / 2 * s, -0.6 * s); ctx.lineTo(-len * 0.28 * s, -0.68 * s); ctx.lineTo(-len * 0.16 * s, -hgt * s); ctx.lineTo(len * 0.18 * s, -hgt * s); ctx.lineTo(len * 0.32 * s, -0.68 * s); ctx.lineTo(len / 2 * s, -0.6 * s); ctx.lineTo(len / 2 * s, -0.25 * s); ctx.closePath(); }
  ctx.fill();
  ctx.fillStyle = 'rgba(15,23,42,0.75)';
  if (c.kind === 'bus') for (let i = 0; i < 6; i++) ctx.fillRect((-len / 2 + 0.4 + i * 1.05) * s, -hgt * 0.92 * s, 0.85 * s, 0.7 * s);
  else { ctx.beginPath(); ctx.moveTo(-len * 0.24 * s, -0.7 * s); ctx.lineTo(-len * 0.14 * s, -(hgt - 0.08) * s); ctx.lineTo(len * 0.16 * s, -(hgt - 0.08) * s); ctx.lineTo(len * 0.28 * s, -0.7 * s); ctx.fill(); }
  ctx.fillStyle = '#fef9c3'; ctx.fillRect((len / 2 - 0.12) * s, -0.55 * s, 0.12 * s, 0.14 * s);
  ctx.fillStyle = '#ef4444'; ctx.fillRect(-len / 2 * s, -0.55 * s, 0.1 * s, 0.14 * s);
  if (c.kind === 'taxi') { ctx.fillStyle = '#111827'; ctx.fillRect(-0.3 * s, -(hgt + 0.18) * s, 0.6 * s, 0.18 * s); }
  if (c.kind === 'police') { ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ef4444' : '#3b82f6'; ctx.fillRect(-0.3 * s, -(hgt + 0.15) * s, 0.6 * s, 0.15 * s); }
  for (const wx of [-len * 0.32, len * 0.3]) { ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(wx * s, -0.25 * s, 0.32 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(wx * s, -0.25 * s, 0.14 * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawTrees(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  const s = v.s, ruin = ruinAt(g.time);
  for (let xx = 11; xx < g.width; xx += 15) {
    if (!visible(v, xx - 2, xx + 2, 0, 4.5)) continue;
    const px = X(v, xx);
    ctx.fillStyle = '#57534e'; ctx.fillRect(px - 0.5 * s, Y(v, 0.05), 1 * s, 0.25 * s);
    ctx.strokeStyle = '#625043'; ctx.lineWidth = 0.16 * s;
    ctx.beginPath(); ctx.moveTo(px, Y(v, 0)); ctx.quadraticCurveTo(px - 0.13 * s, Y(v, 1.1), px + 0.13 * s, Y(v, 2.95)); ctx.stroke();
    ctx.lineWidth = 0.075 * s;
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(px, Y(v, 1.5)); ctx.quadraticCurveTo(px + d * 0.3 * s, Y(v, 2.2), px + d * 0.77 * s, Y(v, 2.8)); ctx.stroke();
    }
    for (let i = 0; i < 23; i++) {
      const a = i * 2.4, distance = 0.95 * Math.sqrt(i / 23);
      const rx = px + (Math.cos(a) * distance + Math.sin(g.time + i) * 0.025) * s;
      const ry = Y(v, 3.15 + Math.sin(a) * distance * 0.78);
      const radius = (0.25 + hash(xx + i) * 0.23) * s;
      const leaf = hsl(103 + hash(i + xx * 7) * 26, 29 + (1 - ruin) * 17, 29 + Math.sin(a) * 8 - ruin * 12);
      ctx.fillStyle = leaf; ctx.beginPath(); ctx.ellipse(rx, ry, radius, radius * 0.74, a, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- Ovnis ----------
const UFO_SPRITE_W = 14.5; // ancho de la imagen en metros (el platillo visible mide unos 12,6)
const UFO_NOZZLE = (870 - 512) / 1536 * UFO_SPRITE_W; // el emisor de abajo, en metros debajo del centro
function drawUfo(ctx: CanvasRenderingContext2D, u: Invasion['ufos'][number], v: View, t: number) {
  const s = v.s, x = X(v, u.x), y = Y(v, u.y);
  // El ovni es el mismo de Kombat Penales (imagen ovni.png): el rayo celeste sale del emisor de abajo.
  const nozzleY = y + UFO_NOZZLE * s;
  if (u.beam) {
    const tx = X(v, u.beam.x), ty = Y(v, u.beam.y), k = Math.min(1, (t - u.beam.t0) * 3);
    const ex = x + (tx - x) * k, ey = nozzleY + (ty - nozzleY) * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(x, nozzleY, ex, ey); beam.addColorStop(0, 'rgba(135,255,255,0.95)'); beam.addColorStop(0.5, 'rgba(30,221,255,0.5)'); beam.addColorStop(1, 'rgba(37,222,255,0.12)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - 0.25 * s, nozzleY); ctx.lineTo(ex - 0.9 * s, ey); ctx.lineTo(ex + 0.9 * s, ey); ctx.lineTo(x + 0.25 * s, nozzleY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(39,221,255,0.35)'; ctx.lineWidth = Math.max(3, s * 0.55); ctx.beginPath(); ctx.moveTo(x, nozzleY); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#caffff'; ctx.lineWidth = Math.max(1.5, s * (0.1 + Math.sin(t * 65) * 0.03)); ctx.stroke();
    if (k >= 1) { const hit = ctx.createRadialGradient(tx, ty, 0, tx, ty, s * 1.6); hit.addColorStop(0, 'rgba(200,255,255,0.95)'); hit.addColorStop(1, 'rgba(0,220,255,0)'); ctx.fillStyle = hit; ctx.fillRect(tx - s * 1.6, ty - s * 1.6, s * 3.2, s * 3.2); }
    ctx.restore();
  }
  if (x < -s * 9 || x > v.w + s * 9 || y < -s * 5 || y > v.h + s * 5) return;
  if (drawUfoCraftAt(ctx, t + u.id * 1.7, x, y, UFO_SPRITE_W * s) !== null) return;
  // (Mientras carga la imagen: el platillo dibujado de antes.)
  // Un platillo grande: luz que sale de abajo, la parte de abajo con sus ojos de buey, el disco con paneles,
  // un anillo de luces que gira alrededor, la cúpula con el piloto y la antena.
  const R = 6.2 * s, spin = t * 1.6 + u.id;
  const under = ctx.createRadialGradient(x, y + 0.9 * s, 0, x, y + 0.9 * s, 5.5 * s); under.addColorStop(0, 'rgba(103,232,249,0.6)'); under.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = under; ctx.fillRect(x - 5.5 * s, y - 3 * s, 11 * s, 9 * s);
  // Panza de abajo, con un anillo que brilla y ventanitas que se prenden en orden.
  const belly = ctx.createLinearGradient(0, y, 0, y + 1.3 * s); belly.addColorStop(0, '#4b5563'); belly.addColorStop(1, '#111827');
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(x, y + 0.35 * s, R * 0.55, 1 * s, 0, 0, Math.PI); ctx.fill();
  const ring = ctx.createRadialGradient(x, y + 0.9 * s, 0, x, y + 0.9 * s, 1.6 * s); ring.addColorStop(0, `rgba(236,254,255,${0.8 + Math.sin(t * 6) * 0.2})`); ring.addColorStop(0.5, 'rgba(34,211,238,0.7)'); ring.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.ellipse(x, y + 0.95 * s, 1.6 * s, 0.45 * s, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 7; i++) { const px = x + (i - 3) * 0.75 * s, on = Math.floor(t * 5 - i) % 7 === 0; ctx.fillStyle = on ? '#a5f3fc' : '#0e7490'; ctx.beginPath(); ctx.arc(px, y + 0.55 * s + Math.abs(i - 3) * -0.06 * s, 0.17 * s, 0, Math.PI * 2); ctx.fill(); }
  // Cúpula de vidrio con el piloto adentro.
  const dome = ctx.createRadialGradient(x - 0.8 * s, y - 2 * s, 0, x, y - 1.2 * s, 2.6 * s); dome.addColorStop(0, 'rgba(236,254,255,0.95)'); dome.addColorStop(0.6, 'rgba(56,189,248,0.6)'); dome.addColorStop(1, 'rgba(14,116,144,0.8)');
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(x, y - 0.6 * s, 2.3 * s, 1.9 * s, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.ellipse(x - 0.2 * s, y - 1.4 * s, 0.6 * s, 0.8 * s, 0, 0, Math.PI * 2); ctx.fill(); // el piloto
  ctx.fillStyle = '#4ade80'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = s * 0.4;
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x - 0.2 * s + d * 0.24 * s, y - 1.45 * s, 0.15 * s, 0.26 * s, d * 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.ellipse(x - 0.6 * s, y - 1.2 * s, 1.2 * s, 1 * s, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.beginPath(); ctx.moveTo(x, y - 2.5 * s); ctx.lineTo(x, y - 3.5 * s); ctx.stroke();
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ef4444' : '#fecaca'; ctx.beginPath(); ctx.arc(x, y - 3.6 * s, 0.22 * s, 0, Math.PI * 2); ctx.fill();
  // El disco: metal con brillo, paneles y remaches.
  const hull = ctx.createLinearGradient(0, y - 1 * s, 0, y + 1 * s); hull.addColorStop(0, '#f3f4f6'); hull.addColorStop(0.4, '#9ca3af'); hull.addColorStop(0.55, '#d1d5db'); hull.addColorStop(1, '#374151');
  ctx.fillStyle = hull; ctx.beginPath(); ctx.ellipse(x, y, R, 1.05 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(31,41,55,0.5)'; ctx.lineWidth = Math.max(1, s * 0.04);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + spin * 0.5; if (Math.sin(a) < 0) continue; const px = x + Math.cos(a) * R * 0.98; ctx.beginPath(); ctx.moveTo(px, y - Math.sin(a) * 0.25 * s - 0.6 * s); ctx.lineTo(px, y + Math.sin(a) * 0.5 * s + 0.4 * s); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.ellipse(x, y - 0.25 * s, R * 0.93, 0.6 * s, 0, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#374151'; ctx.fillRect(x - R, y - 0.05 * s, R * 2, 0.1 * s);
  // Anillo de luces que gira alrededor del disco (las de atrás más apagadas), con colores que van cambiando.
  const N = 26;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + spin, lx = x + Math.cos(a) * R * 0.9, ly = y + Math.sin(a) * 0.55 * s + 0.2 * s, front = Math.sin(a) > 0;
    const c = ['#ef4444', '#fde047', '#22d3ee', '#4ade80', '#f472b6'][(i + Math.floor(t * 4)) % 5];
    ctx.globalAlpha = front ? 1 : 0.35;
    if (front) { const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.6 * s); gl.addColorStop(0, c); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(lx - 0.6 * s, ly - 0.6 * s, 1.2 * s, 1.2 * s); }
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx, ly, 0.2 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- El cohete de la bazooka ----------
// Sale de donde estás (abajo, de tu lado) y se va achicando mientras vuela hacia el objetivo, con fuego atrás y
// una estela de humo; sobre el objetivo titila una mira roja hasta que llega.
const missile: HTMLImageElement | null = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: missileUrl }) : null; // se carga de entrada
function drawRocket(ctx: CanvasRenderingContext2D, rk: Rocket, v: View, t: number) {
  const k = Math.min(1, (t - rk.t0) / ROCKET_TIME), e = k * k * (3 - 2 * k) * 0.55 + k * 0.45;
  // Sale de la boca de la bazooka (`from`, guardada al disparar) y va hacia el objetivo con una curva de abajo hacia
  // arriba: primero cae un poco y avanza bajo, y después sube hacia el objetivo.
  const tx = X(v, rk.x), ty = Y(v, rk.y), sx = rk.from ? X(v, rk.from.x) : v.w * 0.62, sy = rk.from ? Y(v, rk.from.y) : v.h * 1.25;
  const pos = (q: number): [number, number] => [sx + (tx - sx) * q, sy + (ty - sy) * q * q + Math.sin(q * Math.PI) * v.h * 0.05];
  // Mira roja sobre el objetivo.
  const blink = 0.5 + Math.sin(t * 14) * 0.5, R = v.s * 0.9;
  ctx.strokeStyle = `rgba(239,68,68,${0.45 + blink * 0.5})`; ctx.lineWidth = Math.max(1.5, v.s * 0.05);
  ctx.beginPath(); ctx.arc(tx, ty, R * (1.15 - k * 0.3), 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * R * 0.5, ty + Math.sin(a) * R * 0.5); ctx.lineTo(tx + Math.cos(a) * R * 1.5, ty + Math.sin(a) * R * 1.5); ctx.stroke(); }
  // Estela de humo.
  for (let i = 12; i >= 1; i--) {
    const q = e - i * 0.03; if (q <= 0) continue;
    const [hx, hy] = pos(q), size = (1 - q * 0.75) * v.h * 0.03 * (1 + i * 0.15);
    ctx.fillStyle = `rgba(214,211,209,${0.35 * (1 - i / 13)})`; ctx.beginPath(); ctx.arc(hx + Math.sin(i * 2.3 + rk.t0) * size * 0.3, hy, size, 0, Math.PI * 2); ctx.fill();
  }
  const [x, y] = pos(e), [px, py] = pos(Math.max(0, e - 0.02)), ang = Math.atan2(y - py, x - px), L = Math.max(4, (1 - e * 0.8) * v.h * 0.07);
  // El misil de la foto del usuario: visto de atrás (se aleja), con el fuego del motor, siempre derecho como en la
  // foto y cada vez más chico. El brillo del fuego titila un poco.
  if (missile?.complete && missile.naturalWidth) {
    const H = Math.max(8, (1 - e * 0.86) * v.h * 0.15), W = H * missile.naturalWidth / missile.naturalHeight, fl = 0.85 + Math.sin(t * 47) * 0.15;
    ctx.save(); ctx.translate(x, y); // siempre derecho, como en la foto (sin girar)
    const glow = ctx.createRadialGradient(0, H * 0.3, 0, 0, H * 0.3, H * 0.55 * fl);
    glow.addColorStop(0, 'rgba(255,214,140,0.55)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, H * 0.3, H * 0.55 * fl, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(missile, -W / 2, -H / 2, W, H);
    ctx.restore();
    return;
  }
  // Mientras no carga la foto: cuerpo verde oliva con punta roja y el fuego atrás, cada vez más chico.
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const fl = 0.8 + Math.sin(t * 50) * 0.2;
  const fire = ctx.createRadialGradient(-L * 0.7, 0, 0, -L * 0.7, 0, L * 0.9 * fl); fire.addColorStop(0, 'rgba(255,251,235,1)'); fire.addColorStop(0.4, 'rgba(251,146,60,0.9)'); fire.addColorStop(1, 'rgba(220,38,38,0)');
  ctx.fillStyle = fire; ctx.beginPath(); ctx.arc(-L * 0.7, 0, L * 0.9 * fl, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4d5a32'; ctx.beginPath(); ctx.roundRect(-L * 0.5, -L * 0.13, L, L * 0.26, L * 0.1); ctx.fill();
  ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(L * 0.5, -L * 0.13); ctx.lineTo(L * 0.85, 0); ctx.lineTo(L * 0.5, L * 0.13); ctx.fill();
  ctx.fillStyle = '#2f3720'; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.5, sgn * L * 0.1); ctx.lineTo(-L * 0.62, sgn * L * 0.3); ctx.lineTo(-L * 0.3, sgn * L * 0.1); ctx.fill(); }
  ctx.restore();
}

// ---------- Todo junto ----------
// Arriba de cada alien: su barra de vida y cuántos puntos le quedan (baja con cada tiro). Solo si se ve
// suficientemente grande (de lejos serían puntitos que tapan la ciudad).
function drawLifeBars(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  for (const p of g.people) {
    if (!p.alien || p.dead || p.gone) continue;
    const b = hitbox(g, p), tall = (b.y2 - b.y1) * v.s;
    if (tall < 22 || !visible(v, b.x1, b.x2, b.y1, b.y2 + 1)) continue;
    const max = alienKind(p).hp, hp = Math.max(0, Math.min(max, p.hp ?? max)), k = hp / max;
    const w = Math.max(26, Math.min(90, tall * 0.55)), h = Math.max(3, Math.min(7, tall * 0.045));
    const cx = X(v, (b.x1 + b.x2) / 2), y = Y(v, b.y2) - h - Math.max(5, tall * 0.16), x = cx - w / 2; // (un poco arriba de la cabeza)
    const hurt = p.hurt !== undefined && g.time - p.hurt < 0.25; // titila blanco al recibir el tiro
    ctx.save();
    ctx.fillStyle = 'rgba(5,10,12,0.78)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = hurt ? '#ffffff' : k > 0.6 ? '#4ade80' : k > 0.3 ? '#facc15' : '#ef4444';
    ctx.fillRect(x, y, w * k, h);
    ctx.font = font(800, Math.max(9, Math.min(15, h * 2.1))); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,10,12,0.85)'; ctx.fillStyle = '#f8fafc';
    const label = String(hp); ctx.strokeText(label, x - 4, y + h / 2); ctx.fillText(label, x - 4, y + h / 2);
    ctx.restore();
  }
}

// La explosión de la bazooka: la secuencia que pasó el usuario (10 cuadros de 200 px, del destello al humo, sin
// los números), rápida. Devuelve false si la imagen todavía no cargó (entonces se dibuja la explosión de siempre).
const BAZOOKA_FX_DUR = 0.85;
// Si el misil le pega a un ovni, la secuencia es otra (explosion_ovni del usuario), más grande.
const loadImg = (src: string) => typeof Image !== 'undefined' ? Object.assign(new Image(), { src }) : null; // se cargan de entrada
const bazookaFx = loadImg(bazookaFxUrl), ufoFx = loadImg(ufoFxUrl);
function drawBazookaFx(ctx: CanvasRenderingContext2D, bl: { x: number; y: number; t: number; size: number; ufo?: boolean }, v: View) {
  const im = bl.ufo ? ufoFx : bazookaFx;
  if (!im || !im.complete || !im.naturalWidth) return false;
  const frame = Math.min(9, Math.floor(bl.t / BAZOOKA_FX_DUR * 10)), s = bl.size * v.s * (bl.ufo ? 3.4 : 4.2);
  ctx.drawImage(im, frame * 200, 0, 200, 200, X(v, bl.x) - s / 2, Y(v, bl.y) - s / 2, s, s);
  return true;
}

export function drawRockets(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  for (const rk of g.rockets) drawRocket(ctx, rk, v, g.time);
}

// `rockets` false: los cohetes se dibujan aparte (arriba de todo, cada cuadro).
export function paintCity(ctx: CanvasRenderingContext2D, g: Invasion, v: View, newImages = 6, rockets = true, wall = true) {
  budget = newImages;
  drawSky(ctx, g, v, wall);
  const level = levelFor(v.s);
  for (let i = 0; i + 1 < g.buildings.length; i++) { const a = g.buildings[i], b = g.buildings[i + 1]; if (visible(v, a.x + a.w, b.x, 0, 30)) drawAlley(ctx, a, b, v); }
  // Personas que hacen anomalías "de ambiente" en cada habitación (titilan las luces).
  const flickering = new Set<number>();
  for (const p of g.people) if (p.anomaly && p.room >= 0 && !p.dead) { const fx = ANOMALY_FX(p.anomaly.id); if (fx === 'lights') flickering.add(p.room); }
  for (const b of g.buildings) {
    if (!visible(v, b.x - 1, b.x + b.w + 1, -1, b.top + 12)) continue;
    for (const id of b.rooms) {
      const room = g.rooms[id];
      if (!visible(v, room.x1, room.x2, room.y, room.y + room.h)) continue;
      if (!room.destroyed) {
        const img = roomImage(room, b, level, v.dpr) ?? roomImage(room, b, Math.max(0, level - 1), v.dpr) ?? cachedAny(room, v.dpr);
        if (img) ctx.drawImage(img, X(v, room.x1 - 0.05), Y(v, room.y + room.h + 0.05), (room.x2 - room.x1 + 0.1) * v.s, (room.h + 0.1) * v.s);
        else { ctx.fillStyle = WALLS[room.theme](b.hue); ctx.fillRect(X(v, room.x1), Y(v, room.y + room.h), (room.x2 - room.x1) * v.s, room.h * v.s); } // todavía no está la imagen
        drawRoomLive(ctx, g, room, b, v, flickering.has(room.id));
      }
      drawRoomDamage(ctx, room, v);
    }
    // Agujeros de bala y vidrios rotos.
    drawStructure(ctx, g, b, v);
  }
  for (const d of g.decals) {
    if (!visible(v, d.x - 1, d.x + 1, d.y - 1, d.y + 1)) continue;
    const px = X(v, d.x), py = Y(v, d.y);
    if (d.goo || d.blood) { // salpicadura (verde del alien que explotó, o sangre) que chorrea por la pared
      const k = d.size ?? 1, light = d.goo ? 'rgba(74,222,128,0.8)' : 'rgba(185,28,28,0.85)', dark = d.goo ? 'rgba(22,101,52,0.85)' : 'rgba(69,10,10,0.9)';
      const drip = Math.min(1, (g.time - d.t) / 4);
      ctx.fillStyle = light;
      for (let i = 0; i < 11; i++) { const a = i * 0.7 + d.x, r = v.s * k * (0.06 + hash(i + d.x * 3) * 0.12), dd = v.s * k * 0.45 * hash(i * 2 + d.t); ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * dd, py - Math.sin(a) * dd * 0.8, r, r * 0.7, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(px, py, v.s * k * 0.22, v.s * k * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = light; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const dx = (hash(i * 5 + d.x) - 0.5) * v.s * k * 0.5, len = v.s * k * (0.15 + hash(i + d.y) * 0.4) * drip; ctx.lineWidth = Math.max(1, v.s * k * 0.035); ctx.beginPath(); ctx.moveTo(px + dx, py); ctx.lineTo(px + dx, py + len); ctx.stroke(); ctx.beginPath(); ctx.arc(px + dx, py + len, Math.max(1, v.s * k * 0.03), 0, Math.PI * 2); ctx.fillStyle = light; ctx.fill(); }
      continue;
    }
    if (d.glass) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = i * 0.9 + d.x; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * v.s * (0.25 + hash(i + d.y) * 0.35), py + Math.sin(a) * v.s * (0.25 + hash(i * 3 + d.x) * 0.35)); ctx.stroke(); } }
    if (d.crater) { // ametralladora: un pedazo de pared arrancado (revoque roto, ladrillo a la vista y grietas)
      const r = v.s * 0.16 * d.crater;
      ctx.fillStyle = 'rgba(120,113,108,0.9)'; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r * (0.65 + hash(i + d.x * 13) * 0.6); if (i) ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.85); else ctx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.85); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(146,64,14,0.75)'; ctx.fillRect(px - r * 0.45, py - r * 0.25, r * 0.4, r * 0.2); ctx.fillRect(px + r * 0.05, py + r * 0.05, r * 0.4, r * 0.2); // ladrillos
      ctx.strokeStyle = 'rgba(28,25,23,0.75)'; ctx.lineWidth = Math.max(1, v.s * 0.012);
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + d.y, l = r * (1.2 + hash(i + d.y * 7) * 1.4); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l * 0.5, py + Math.sin(a) * l * 0.5 + r * 0.1); ctx.lineTo(px + Math.cos(a + 0.3) * l, py + Math.sin(a + 0.3) * l); ctx.stroke(); }
      ctx.fillStyle = '#0c0a09'; ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, r * 0.32), 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, v.s * 0.035), 0, Math.PI * 2); ctx.fill();
  }
  // La gente de los departamentos y las cajas.
  for (const p of g.people) {
    if (p.gone || p.room < 0) continue;
    if (!visible(v, p.x - 2.5, p.x + 2.5, p.y - 1.2, p.y + 3.4)) continue;
    drawPerson(ctx, g, p, X(v, p.x), Y(v, p.y), v.s, g.time);
  }
  for (const box of g.boxes) {
    if (box.exploded || !visible(v, box.x - 1, box.x + 1, box.y, box.y + 1)) continue;
    const px = X(v, box.x), py = Y(v, box.y);
    if (box.explosive) drawBomb(ctx, box, px, py, v.s, g.time); // la bomba de los aliens: una caja roja grande
    else {
      drawProp(ctx, 'box', px, py, v.s * 0.42 * 2.4, g.time);
      if (box.kind === 1) { ctx.fillStyle = '#ef4444'; ctx.fillRect(px - v.s * 0.06, py - v.s * 0.3, v.s * 0.12, v.s * 0.08); } // una caja de pizza con su logo
    }
    if (box.defused) { ctx.fillStyle = 'rgba(34,197,94,0.95)'; ctx.font = font(900, v.s * 0.3); ctx.textAlign = 'center'; ctx.fillText('✓', px, py - v.s * 0.6); }
  }
  drawStreetBack(ctx, g, v);
  for (const p of g.people) {
    if (p.gone || p.room >= 0) continue;
    if (!visible(v, p.x - 2, p.x + 2, -1, 2.6)) continue;
    drawPerson(ctx, g, p, X(v, p.x), Y(v, p.y - 0.12), v.s, g.time);
  }
  drawTrees(ctx, g, v);
  for (const c of g.cars) drawCar(ctx, c, v, g.time);
  for (const u of g.ufos) drawUfo(ctx, u, v, g.time);
  drawLifeBars(ctx, g, v);
  for (const p of g.people) {
    const shot = p.sabotage?.shot;
    if (!shot || g.time - shot.time >= 0.16) continue;
    const alpha = 1 - (g.time - shot.time) / 0.16;
    ctx.beginPath();
    ctx.moveTo(X(v, p.x + p.dir * 0.38), Y(v, p.y + 0.61));
    ctx.lineTo(X(v, shot.x), Y(v, shot.y));
    ctx.strokeStyle = `rgba(109,219,212,${alpha * 0.55})`;
    ctx.lineWidth = Math.max(2, v.s * 0.055);
    ctx.stroke();
    ctx.strokeStyle = `rgba(224,255,249,${alpha})`;
    ctx.lineWidth = Math.max(1, v.s * 0.018);
    ctx.stroke();
  }
  if (rockets) drawRockets(ctx, g, v);
  // Explosiones y partículas.
  for (const bl of g.blasts) {
    if (bl.t < 0) continue;
    if (bl.bazooka && bl.t < BAZOOKA_FX_DUR && drawBazookaFx(ctx, bl, v)) continue; // la explosión de la bazooka, con la secuencia
    if (bl.big) { drawBigBlast(ctx, bl, v); continue; }
    const k = bl.t / 1.2, r = (0.6 + k * 1.8) * bl.size * v.s, px = X(v, bl.x), py = Y(v, bl.y);
    const gl = ctx.createRadialGradient(px, py, 0, px, py, r);
    if (bl.green) { // el alien explota en verde: bola de luz, anillo y destello
      gl.addColorStop(0, `rgba(240,255,220,${1 - k})`); gl.addColorStop(0.35, `rgba(132,204,22,${0.9 * (1 - k)})`); gl.addColorStop(0.7, `rgba(22,163,74,${0.6 * (1 - k)})`); gl.addColorStop(1, 'rgba(20,83,45,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(190,242,100,${0.9 * (1 - k)})`; ctx.lineWidth = Math.max(2, v.s * 0.08 * (1 - k)); ctx.beginPath(); ctx.arc(px, py, r * 1.25, 0, Math.PI * 2); ctx.stroke();
      // Chorros de baba que salen para todos lados.
      ctx.fillStyle = `rgba(74,222,128,${0.85 * (1 - k)})`;
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + bl.x, l = r * (1.1 + hash(i + bl.x) * 0.9), wdt = r * 0.12; ctx.beginPath(); ctx.moveTo(px + Math.cos(a + 0.12) * wdt, py + Math.sin(a + 0.12) * wdt); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.lineTo(px + Math.cos(a - 0.12) * wdt, py + Math.sin(a - 0.12) * wdt); ctx.fill(); ctx.beginPath(); ctx.arc(px + Math.cos(a) * l, py + Math.sin(a) * l, wdt * 0.8, 0, Math.PI * 2); ctx.fill(); }
      if (k < 0.15) { ctx.fillStyle = `rgba(190,242,100,${0.25 * (1 - k / 0.15)})`; ctx.fillRect(0, 0, v.w, v.h); }
      continue;
    }
    gl.addColorStop(0, `rgba(255,250,220,${1 - k})`); gl.addColorStop(0.4, `rgba(251,146,60,${0.85 * (1 - k)})`); gl.addColorStop(1, 'rgba(127,29,29,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  for (const pt of g.particles) {
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = pt.kind === 'smoke' ? a * 0.5 : a;
    ctx.fillStyle = pt.color;
    const r = pt.kind === 'smoke' ? pt.size * v.s * (1.6 - a) : pt.size * v.s;
    if (pt.kind === 'smoke') { const px = X(v, pt.x), py = Y(v, pt.y), rr = Math.max(2, r * 1.4), puff = ctx.createRadialGradient(px, py, 0, px, py, rr); puff.addColorStop(0, 'rgba(41,37,36,0.55)'); puff.addColorStop(1, 'rgba(41,37,36,0)'); ctx.fillStyle = puff; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    else if (pt.kind === 'wreck') { // pedazo del ovni incendiado, girando
      const px = X(v, pt.x), py = Y(v, pt.y), R = Math.max(2, pt.size * v.s), ang = (pt.spin ?? 0) * (pt.max - pt.life);
      const fire = ctx.createRadialGradient(px, py, 0, px, py, R * 2.2); fire.addColorStop(0, `rgba(255,214,120,${0.8 * a})`); fire.addColorStop(0.45, `rgba(249,115,22,${0.5 * a})`); fire.addColorStop(1, 'rgba(127,29,29,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = fire; ctx.beginPath(); ctx.arc(px, py, R * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.moveTo(-R, -R * 0.35); ctx.lineTo(R * 0.6, -R * 0.55); ctx.lineTo(R, R * 0.2); ctx.lineTo(-R * 0.2, R * 0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = Math.max(1, R * 0.12); ctx.beginPath(); ctx.moveTo(-R, -R * 0.35); ctx.lineTo(R * 0.6, -R * 0.55); ctx.stroke(); // borde con luz verde del ovni
      ctx.restore();
    }
    else if (pt.kind === 'blood' || pt.kind === 'goo') { ctx.beginPath(); ctx.arc(X(v, pt.x), Y(v, pt.y), Math.max(0.8, r), 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(X(v, pt.x) - r / 2, Y(v, pt.y) - r / 2, Math.max(1, r), Math.max(1, r));
  }
  ctx.globalAlpha = 1;
  drawStorm(ctx, g, v);
  // Humo general que oscurece la ciudad al final.
  const ruin = ruinAt(g.time);
  if (ruin > 0) { ctx.fillStyle = `rgba(40,10,5,${ruin * 0.3})`; ctx.fillRect(0, 0, v.w, v.h); }
}
// Una explosión grande (las bombas y los rayos de los ovnis): el destello, una bola de fuego que crece y se
// vuelve humo negro, la onda expansiva, llamaradas para todos lados y un hongo de humo que sube.
export const BIG_BLAST_TIME = 2.6;
function drawBigBlast(ctx: CanvasRenderingContext2D, bl: Invasion['blasts'][number], v: View) {
  const k = Math.min(1, bl.t / BIG_BLAST_TIME), s = v.s, px = X(v, bl.x), py = Y(v, bl.y), R = bl.size * s;
  // Destello que ilumina todo.
  if (bl.t < 0.25) { ctx.fillStyle = `rgba(255,244,214,${0.55 * (1 - bl.t / 0.25)})`; ctx.fillRect(0, 0, v.w, v.h); }
  // Onda expansiva.
  const ring = R * (0.5 + Math.min(1, bl.t / 0.7) * 2.6);
  if (bl.t < 0.8) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - bl.t / 0.8)})`; ctx.lineWidth = Math.max(3, R * 0.1 * (1 - bl.t / 0.8)); ctx.beginPath(); ctx.arc(px, py, ring, 0, Math.PI * 2); ctx.stroke(); }
  // Humo que sube (hongo).
  const rise = k * R * 1.6;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + bl.x, d = R * (0.4 + hash(i + bl.x) * 0.6) * (0.4 + k), r = R * (0.45 + hash(i * 3 + bl.y) * 0.35) * (0.5 + k);
    const cx = px + Math.cos(a) * d, cy = py - rise + Math.sin(a) * d * 0.6, al = 0.9 * Math.min(1, k * 4) * (1 - k * 0.55);
    const sm = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); sm.addColorStop(0, `rgba(41,37,36,${al})`); sm.addColorStop(1, 'rgba(41,37,36,0)');
    ctx.fillStyle = sm; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Bola de fuego: grande al principio, después se achica y se oscurece.
  const fk = Math.min(1, bl.t / 1.3), fr = R * (0.6 + Math.sqrt(fk) * 1.2) * (1 - Math.max(0, fk - 0.6));
  if (fk < 1) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + bl.t * 0.8, d = fr * 0.45 * hash(i + bl.x * 7), cx = px + Math.cos(a) * d, cy = py - fk * R * 0.6 + Math.sin(a) * d * 0.8, r = fr * (0.55 + hash(i * 5 + bl.x) * 0.4);
      const f = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      f.addColorStop(0, `rgba(255,251,235,${1 - fk})`); f.addColorStop(0.3, `rgba(253,224,71,${0.95 * (1 - fk)})`); f.addColorStop(0.6, `rgba(249,115,22,${0.85 * (1 - fk)})`); f.addColorStop(1, 'rgba(127,29,29,0)');
      ctx.fillStyle = f; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    // Llamaradas que salen disparadas.
    ctx.fillStyle = `rgba(251,146,60,${0.9 * (1 - fk)})`;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + bl.y, l = fr * (1.2 + hash(i + bl.y * 3) * 1.1), w = fr * 0.1; ctx.beginPath(); ctx.moveTo(px + Math.cos(a + 0.2) * w, py + Math.sin(a + 0.2) * w); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.lineTo(px + Math.cos(a - 0.2) * w, py + Math.sin(a - 0.2) * w); ctx.fill(); }
  }
}

// La bomba de los aliens: la caja con cables, una lucecita roja que titila (más rápido cuando falta poco) y,
// mirando de cerca, el reloj con la cuenta regresiva.
function drawBomb(ctx: CanvasRenderingContext2D, box: Invasion['boxes'][number], px: number, py: number, s: number, t: number) {
  const left = Math.max(0, box.explodeAt - t), fast = left < 6, cy = py - s * 0.21;
  if (fast && !box.defused) { const gl = ctx.createRadialGradient(px, cy, 0, px, cy, s * 0.9); gl.addColorStop(0, `rgba(239,68,68,${0.35 + Math.sin(t * 20) * 0.2})`); gl.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = gl; ctx.fillRect(px - s * 0.9, cy - s * 0.9, s * 1.8, s * 1.8); }
  drawProp(ctx, box.defused ? 'bombOff' : 'bomb', px, cy, s, fast ? t * 2.5 : t);
  if (s < 22 || box.defused) return;
  ctx.fillStyle = fast ? '#fca5a5' : '#ef4444'; ctx.font = font(900, s * 0.07); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`0:${String(Math.ceil(left)).padStart(2, '0')}`, px + s * 0.15, cy - s * 0.128);
}

// La lluvia (líneas inclinadas que caen) y los relámpagos (el rayo y el destello que ilumina todo).
function drawStorm(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  const rain = rainAt(g.time);
  if (rain <= 0) return;
  const t = g.time, n = Math.round(Math.min(700, (v.w * v.h) / 1400) * rain), len = Math.max(6, Math.min(46, v.s * 0.55));
  ctx.strokeStyle = 'rgba(186,200,220,0.45)'; ctx.lineWidth = Math.max(1, Math.min(2.5, v.s * 0.012)); ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 0.8 + hash(i + 3) * 0.5, x = ((hash(i) * 1.2 * v.w - t * 90 * sp) % v.w + v.w) % v.w, y = ((hash(i + 7) * v.h + t * v.h * 1.3 * sp) % (v.h + len)) - len;
    ctx.moveTo(x, y); ctx.lineTo(x - len * 0.25, y + len);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(15,23,42,${rain * 0.22})`; ctx.fillRect(0, 0, v.w, v.h); // todo más oscuro y mojado
  const L = g.lightning, k = L ? t - L.t : 9;
  if (L && k < 0.45) {
    // El rayo: una línea en zigzag desde las nubes hasta lo más alto de la cuadra.
    const b = g.buildings.find(o => L.x >= o.x && L.x <= o.x + o.w), top = b ? b.top + 0.3 : 0;
    if (k < 0.25 && visible(v, L.x - 6, L.x + 6, top, CITY_TOP + 12)) {
      ctx.strokeStyle = `rgba(255,255,255,${1 - k * 3})`; ctx.lineWidth = Math.max(2, v.s * 0.08); ctx.shadowColor = '#bfdbfe'; ctx.shadowBlur = v.s * 0.6;
      ctx.beginPath(); let x = L.x, y = CITY_TOP + 12; ctx.moveTo(X(v, x), Y(v, y));
      for (let i = 1; y > top; i++) { y = Math.max(top, y - 1.6 - hash(i + L.t) * 1.4); x += (hash(i * 3 + L.t) - 0.5) * 2.4; ctx.lineTo(X(v, x), Y(v, y)); }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = `rgba(226,232,255,${0.4 * (1 - k / 0.45) * (Math.sin(k * 60) > -0.3 ? 1 : 0.3)})`; ctx.fillRect(0, 0, v.w, v.h);
  }
}

// La anomalía de ambiente que hace cada persona (para las luces que titilan).
const ANOMALY_FX = (id: number) => { const fx = ANOMALIES[id].fx; return fx.t === 'env' ? fx.mode : null; };

// Plano chiquito de toda la cuadra (arriba de la pantalla): edificios, fuego, ovnis y dónde estás mirando.
export function drawMinimap(ctx: CanvasRenderingContext2D, g: Invasion, w: number, h: number, view: { x1: number; x2: number; y1: number; y2: number }) {
  const maxY = CITY_TOP, sx = w / g.width, sy = h / (maxY + 4), Y0 = (y: number) => h - (y + 4) * sy;
  ctx.fillStyle = 'rgba(2,6,23,0.75)'; ctx.fillRect(0, 0, w, h);
  for (const b of g.buildings) {
    ctx.fillStyle = '#475569'; ctx.fillRect(b.x * sx, Y0(b.top), b.w * sx, b.top * sy);
    for (const id of b.rooms) { const r = g.rooms[id]; if (r.destroyed) { ctx.fillStyle = '#7f1d1d'; ctx.fillRect(r.x1 * sx, Y0(r.y + r.h), (r.x2 - r.x1) * sx, r.h * sy); } else if (r.fire > 0.05) { ctx.fillStyle = '#f97316'; ctx.fillRect(r.x1 * sx, Y0(r.y + r.h), (r.x2 - r.x1) * sx, r.h * sy); } }
  }
  if (Math.floor(g.time * 3) % 2 === 0) for (const b of g.boxes) if (b.explosive && !b.defused && !b.exploded) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(b.x * sx, Y0(b.y + 0.5), 2.5, 0, Math.PI * 2); ctx.fill(); }
  for (const u of g.ufos) { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.ellipse(u.x * sx, Y0(Math.min(maxY, u.y)), 4, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.strokeRect(view.x1 * sx, Y0(view.y2), (view.x2 - view.x1) * sx, (view.y2 - view.y1) * sy);
}
