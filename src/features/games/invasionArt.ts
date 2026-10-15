// Cómo se dibuja la ciudad de "Invasión": edificios en corte (se ve cada departamento por dentro, con sus
// paredes, ventanas, muebles y cosas colgadas), locales y bares en planta baja con sus carteles y toldos,
// una obra en construcción con andamios y grúa, pasajes entre edificios, la vereda con faroles, árboles,
// paradas de colectivo y la calle con autos; el cielo que se va poniendo rojo, los ovnis, el fuego, el humo
// y los edificios destruidos.
//
// Lo que no se mueve de cada habitación se dibuja una sola vez en una imagen aparte (para cada zoom) y
// después se copia: así se puede dibujar con mucho detalle sin que se trabe.
import {
  GAME_SECONDS, ROAD_Y, ruinAt, SHOP_NAMES, UFO_FROM, type Building, type Furniture, type Invasion, type Item, type Room,
} from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import { drawPerson, drawProp, font, hash, hsl, mixColor } from './invasionPeople';

export interface View { w: number; h: number; s: number; cx: number; cy: number; t: number; dpr: number }
export const X = (v: View, x: number) => v.w / 2 + (x - v.cx) * v.s;
export const Y = (v: View, y: number) => v.h / 2 - (y - v.cy) * v.s;
const visible = (v: View, x1: number, x2: number, y1: number, y2: number) => X(v, x2) > -30 && X(v, x1) < v.w + 30 && Y(v, y1) > -30 && Y(v, y2) < v.h + 30;
export const ZOOMS = [12, 18, 26, 38, 55, 80, 115];
export const SKY_TOP = 52;

// ---------- Cielo y fondo ----------
function skyColors(t: number) {
  const k = ruinAt(t), dusk = Math.min(1, t / GAME_SECONDS);
  const top = mixColor(mixColor('#3b82f6', '#4c1d95', dusk * 0.7), '#1c0a0a', k);
  const mid = mixColor(mixColor('#93c5fd', '#f97316', dusk * 0.8), '#7f1d1d', k * 0.8);
  const low = mixColor(mixColor('#e0f2fe', '#fcd34d', dusk * 0.8), '#ea580c', k * 0.8);
  return { top, mid, low };
}
function drawSky(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  const c = skyColors(g.time);
  const sky = ctx.createLinearGradient(0, Y(v, SKY_TOP), 0, Y(v, -3));
  sky.addColorStop(0, c.top); sky.addColorStop(0.55, c.mid); sky.addColorStop(1, c.low);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, v.w, v.h);
  // El sol que baja (más rojo con el humo).
  const sun = { x: v.w * 0.5 + (g.width * 0.6 - v.cx) * v.s * 0.08, y: Y(v, 40 - g.time / GAME_SECONDS * 26) };
  const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, v.s * 9);
  glow.addColorStop(0, 'rgba(255,240,200,0.95)'); glow.addColorStop(0.15, 'rgba(255,210,140,0.6)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow; ctx.fillRect(sun.x - v.s * 9, sun.y - v.s * 9, v.s * 18, v.s * 18);
  // Nubes que pasan (cada vez más oscuras por el humo).
  const ruin = ruinAt(g.time);
  for (let i = 0; i < 9; i++) {
    const cx = ((hash(i) * g.width * 1.4 + g.time * (0.6 + hash(i + 2) * 0.5)) % (g.width * 1.4)) - g.width * 0.2;
    const x = v.w / 2 + (cx - v.cx) * v.s * 0.5, y = Y(v, 30 + hash(i + 5) * 18) + (v.cy - 20) * v.s * 0.5;
    const w = v.s * (6 + hash(i + 7) * 8);
    ctx.fillStyle = ruin > 0.2 ? `rgba(60,40,40,${0.5 + ruin * 0.3})` : 'rgba(255,255,255,0.75)';
    for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 2) * w * 0.18, y + Math.sin(j * 2) * w * 0.05, w * 0.22, w * 0.11, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // La nave nodriza aparece de a poco en el fondo.
  if (g.time > UFO_FROM + 60) {
    const k = Math.min(1, (g.time - UFO_FROM - 60) / 120), mx = v.w / 2 + (g.width * 0.5 - v.cx) * v.s * 0.15, my = Y(v, 34 + v.cy * 0.45);
    ctx.globalAlpha = 0.85 * k;
    const ship = ctx.createLinearGradient(0, my - v.s * 3, 0, my + v.s * 3);
    ship.addColorStop(0, '#1f2937'); ship.addColorStop(1, '#030712');
    ctx.fillStyle = ship; ctx.beginPath(); ctx.ellipse(mx, my, v.s * 60, v.s * 5, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 40; i++) { const lx = mx + (i / 39 - 0.5) * v.s * 110, on = Math.floor(g.time * 2 + i) % 3; ctx.fillStyle = on ? '#22d3ee' : '#0e7490'; ctx.beginPath(); ctx.arc(lx, my + v.s * 2.6 * Math.sqrt(Math.max(0, 1 - ((lx - mx) / (v.s * 60)) ** 2)), v.s * 0.25, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // Ciudad lejana (se mueve más despacio que la cuadra, para dar profundidad).
  for (const layer of [0.25, 0.45]) {
    const tone = layer < 0.3 ? mixColor('#94a3b8', c.mid, 0.35) : mixColor('#64748b', c.mid, 0.25);
    for (let i = 0; i < 60; i++) {
      const bx = i * 9 + hash(i * 3 + layer * 10) * 5 - 20, bw = 5 + hash(i + 1 + layer) * 6, bh = (layer < 0.3 ? 10 : 6) + hash(i * 7 + layer) * (layer < 0.3 ? 28 : 20);
      const x = v.w / 2 + (bx - v.cx * layer) * v.s * layer * 1.6, w = bw * v.s * layer * 1.6;
      if (x + w < 0 || x > v.w) continue;
      const base = Y(v, 0) + (v.cy) * v.s * (1 - layer) * 0.4, top = base - bh * v.s * layer * 1.6;
      ctx.fillStyle = tone; ctx.fillRect(x, top, w, base - top);
      if (layer > 0.3) for (let wy = top + v.s * 0.5; wy < base - v.s * 0.5; wy += v.s * 0.9) for (let wx = x + v.s * 0.3; wx < x + w - v.s * 0.4; wx += v.s * 0.8) if (hash(wx * 3 + wy) < 0.35) { ctx.fillStyle = `rgba(254,240,138,${0.35 + ruin * 0.2})`; ctx.fillRect(wx, wy, v.s * 0.3, v.s * 0.35); }
    }
  }
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
    if (theme === 'gym') { rect('rgba(186,230,253,0.35)', x1 + 0.3, y0 + 0.4, x2 - x1 - 0.6, 1.6); ctx.font = font(900, s * 0.5); ctx.fillStyle = 'rgba(30,41,59,0.5)'; ctx.textAlign = 'center'; ctx.fillText('NO PAIN NO GAIN', x((x1 + x2) / 2), y(y0 + 2.4)); }
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
    // Zócalo y moldura.
    rect('rgba(60,40,30,0.45)', x1, y0, x2 - x1, 0.1);
    rect('rgba(255,255,255,0.35)', x1, y1 - 0.08, x2 - x1, 0.05);
    // Cosas colgadas en la pared, donde hay lugar.
    const free = (cx: number, w: number) => !room.furniture.some(f => f.x < cx + w && f.x + f.w > cx - w && ['bookshelf', 'wardrobe', 'fridge', 'cabinet', 'shelves', 'bunk', 'whiteboard', 'elevator'].includes(f.item)) && !windowsOf(room, b).some(([a, c]) => a < cx + w && c > cx - w);
    for (let i = 0; i < 3; i++) {
      const cx = x1 + 0.6 + hash(seed + i * 17) * (x2 - x1 - 1.2), kind = Math.floor(hash(seed + i * 31) * 5);
      if (!free(cx, 0.45) || theme === 'bath') continue;
      const cy = y0 + 1.55 + hash(seed + i) * 0.35;
      if (kind === 0 || kind === 1) { // cuadro
        rect('#78350f', cx - 0.35, cy - 0.25, 0.7, 0.5);
        const art = ctx.createLinearGradient(x(cx - 0.3), 0, x(cx + 0.3), 0); art.addColorStop(0, hsl((seed * 7 + i * 50) % 360, 60, 55)); art.addColorStop(1, hsl((seed * 13 + i * 90) % 360, 55, 40));
        rect(art, cx - 0.3, cy - 0.2, 0.6, 0.4);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x(cx + 0.1), y(cy + 0.08), s * 0.06, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 2) { rect('#f8fafc', cx - 0.25, cy - 0.32, 0.5, 0.64); rect(hsl(hue, 60, 50), cx - 0.25, cy + 0.18, 0.5, 0.14); for (let j = 0; j < 4; j++) rect('#cbd5e1', cx - 0.2, cy - 0.25 + j * 0.1, 0.4, 0.03); } // calendario
      else if (kind === 3) { rect('#57534e', cx - 0.45, cy - 0.05, 0.9, 0.05); for (let j = 0; j < 6; j++) rect(['#b91c1c', '#1d4ed8', '#15803d', '#a16207'][j % 4], cx - 0.4 + j * 0.13, cy, 0.1, 0.24 + hash(seed + j) * 0.08); } // estante con libros
      else { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x(cx), y(cy), s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x(cx), y(cy)); ctx.lineTo(x(cx), y(cy + 0.15)); ctx.moveTo(x(cx), y(cy)); ctx.lineTo(x(cx + 0.1), y(cy)); ctx.stroke(); } // reloj
    }
  }
  // Piso.
  const floorTone = theme === 'kitchen' || theme === 'bath' || theme === 'laundry' ? '#d6d3d1' : theme === 'site' ? '#78716c' : theme === 'office' ? '#64748b' : theme === 'gym' ? '#1f2937' : theme === 'lobby' ? '#d6d3d1' : `hsl(${25 + (seed % 15)},45%,38%)`;
  rect(floorTone, x1, y0, x2 - x1, 0.09);
  if (!['kitchen', 'bath', 'laundry', 'site', 'office', 'gym', 'lobby'].includes(theme)) for (let xx = x1; xx < x2; xx += 0.5) rect('rgba(0,0,0,0.18)', xx, y0, 0.01, 0.09);
  // Muebles.
  for (const f of room.furniture) drawItem(ctx, f, room, P, hue);
  // Luz ambiente: un poco de sombra en las puntas.
  const vg = ctx.createLinearGradient(x(x1), 0, x(x2), 0); vg.addColorStop(0, 'rgba(0,0,0,0.22)'); vg.addColorStop(0.15, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(x(x1), y(y1), (x2 - x1) * s, room.h * s);
  const top = ctx.createLinearGradient(0, y(y1), 0, y(y1 - 0.7)); top.addColorStop(0, 'rgba(0,0,0,0.25)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top; ctx.fillRect(x(x1), y(y1), (x2 - x1) * s, 0.7 * s);
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
    case 'sofa': grad(fabric, mixColor(fabric, '#000000', 0.35), x0, y0 + 0.12, w, 0.42, 0.08); grad(mixColor(fabric, '#ffffff', 0.1), fabric, x0 + 0.05, y0 + 0.5, w - 0.1, 0.4, 0.1); rect(mixColor(fabric, '#000000', 0.2), x0, y0 + 0.12, 0.2, 0.6, 0.08); rect(mixColor(fabric, '#000000', 0.2), x0 + w - 0.2, y0 + 0.12, 0.2, 0.6, 0.08); rect(hsl((hue + 40) % 360, 60, 60), x0 + 0.3, y0 + 0.5, 0.35, 0.3, 0.08); legs(x0, w, 0.12); break;
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
    case 'rug': rect(hsl((hue + 200) % 360, 45, 45), x0 - 1.2, y0 + 0.01, 2.6, 0.05); break;
    case 'stove': grad('#e5e7eb', '#9ca3af', x0, y0, w, 0.9); rect('#111827', x0 + 0.1, y0 + 0.15, w - 0.2, 0.5, 0.03); rect('#374151', x0, y0 + 0.88, w, 0.04); for (const k of [0.25, 0.6]) circ('#1f2937', x0 + w * k, y0 + 0.93, 0.08); grad('#d1d5db', '#9ca3af', x0 - 0.05, y0 + 1.75, w + 0.1, 0.35); break;
    case 'fridge': grad('#f8fafc', '#cbd5e1', x0, y0, w, 1.8, 0.06); rect('rgba(0,0,0,0.15)', x0, y0 + 1.15, w, 0.02); rect('#94a3b8', x0 + w - 0.12, y0 + 1.25, 0.04, 0.3); rect('#94a3b8', x0 + w - 0.12, y0 + 0.65, 0.04, 0.35); for (let i = 0; i < 3; i++) rect(hsl((seed * 3 + i * 90) % 360, 70, 60), x0 + 0.15 + i * 0.2, y0 + 1.3 + (i % 2) * 0.15, 0.12, 0.12, 0.03); break;
    case 'kitchenTable': case 'diningTable': case 'cafeTable': {
      const tw = f.item === 'cafeTable' ? 0.6 : w * 0.7, tx = x0 + (w - tw) / 2;
      rect(f.item === 'cafeTable' ? '#d6d3d1' : wood, tx, y0 + 0.7, tw, 0.06); legs(tx, tw, 0.7, f.item === 'cafeTable' ? '#57534e' : mixColor(wood, '#000000', 0.3));
      for (const cx of [x0 + 0.05, x0 + w - 0.35]) { rect(mixColor(wood, '#000000', 0.2), cx, y0 + 0.42, 0.3, 0.05); rect(mixColor(wood, '#000000', 0.2), cx + (cx < tx ? 0 : 0.25), y0, 0.04, 0.95); rect(mixColor(wood, '#000000', 0.2), cx + 0.13, y0, 0.04, 0.42); }
      rect('#f8fafc', tx + tw * 0.3, y0 + 0.76, 0.18, 0.03); rect('rgba(186,230,253,0.8)', tx + tw * 0.65, y0 + 0.76, 0.06, 0.15); break;
    }
    case 'sink': grad(hsl(hue, 20, 60), hsl(hue, 20, 40), x0, y0, w, 0.88); rect('#e5e7eb', x0 - 0.03, y0 + 0.86, w + 0.06, 0.06); rect('#9ca3af', x0 + w / 2 - 0.02, y0 + 0.92, 0.04, 0.22); rect('#9ca3af', x0 + w / 2 - 0.02, y0 + 1.12, 0.15, 0.03); grad(hsl(hue, 20, 70), hsl(hue, 20, 55), x0, y0 + 1.6, w, 0.6); for (let i = 1; i < 3; i++) rect('rgba(0,0,0,0.2)', x0 + i * w / 3, y0 + 0.05, 0.01, 0.8); break;
    case 'bed': case 'bunk': {
      const levels = f.item === 'bunk' ? [0, 0.95] : [0];
      for (const ly of levels) { rect(wood, x0, y0 + ly, w, 0.35); rect('#f8fafc', x0 + 0.05, y0 + ly + 0.35, w - 0.1, 0.15, 0.05); grad(hsl((hue + 100 + seed % 90) % 360, 50, 55), hsl((hue + 100 + seed % 90) % 360, 50, 40), x0 + 0.5, y0 + ly + 0.32, w - 0.55, 0.22, 0.06); rect('#f8fafc', x0 + 0.08, y0 + ly + 0.48, 0.42, 0.14, 0.06); }
      rect(mixColor(wood, '#000000', 0.2), x0 - 0.02, y0, 0.1, f.item === 'bunk' ? 1.8 : 1.05, 0.03); if (f.item === 'bunk') rect(mixColor(wood, '#000000', 0.2), x0 + w - 0.08, y0, 0.08, 1.8); break;
    }
    case 'wardrobe': case 'cabinet': grad(wood, mixColor(wood, '#000000', 0.25), x0, y0, w, f.item === 'cabinet' ? 1.6 : 2); rect('rgba(0,0,0,0.25)', x0 + w / 2 - 0.005, y0 + 0.05, 0.01, f.item === 'cabinet' ? 1.5 : 1.9); for (const k of [-1, 1]) circ('#d6d3d1', x0 + w / 2 + k * 0.07, y0 + 1, 0.025); if (f.item === 'cabinet') rect('rgba(186,230,253,0.4)', x0 + 0.08, y0 + 0.9, w - 0.16, 0.6); break;
    case 'desk': case 'computerDesk': {
      rect(f.item === 'computerDesk' ? '#e5e7eb' : wood, x0, y0 + 0.72, w, 0.05); legs(x0, w, 0.72);
      if (f.item === 'computerDesk') { rect('#111827', x0 + w / 2 - 0.28, y0 + 0.85, 0.56, 0.36, 0.02); rect('#1e3a8a', x0 + w / 2 - 0.25, y0 + 0.88, 0.5, 0.3); rect('#374151', x0 + w / 2 - 0.03, y0 + 0.77, 0.06, 0.1); rect('#d1d5db', x0 + w / 2 - 0.2, y0 + 0.77, 0.4, 0.02); }
      else { rect('#facc15', x0 + 0.15, y0 + 0.77, 0.08, 0.3); rect('#fef9c3', x0 + 0.05, y0 + 1.05, 0.28, 0.1); rect('#e5e7eb', x0 + w * 0.5, y0 + 0.77, 0.3, 0.04); }
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
    case 'counter': grad(room.shop === 'bar' ? '#7c2d12' : hsl(hue, 30, 45), room.shop === 'bar' ? '#451a03' : hsl(hue, 30, 30), x0, y0, w, 1.02, 0.02); rect(room.shop === 'bar' ? '#a16207' : '#e7e5e4', x0 - 0.05, y0 + 1, w + 0.1, 0.07); if (room.shop === 'kiosco' || room.shop === 'farmacia') rect('#111827', x0 + w - 0.5, y0 + 1.07, 0.35, 0.25, 0.03); break;
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
    case 'catBed': case 'dogBed': rect(hsl((hue + 300) % 360, 40, 50), x0, y0, w, 0.18, 0.08); { const c = f.item === 'catBed' ? '#f97316' : '#a16207'; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x(x0 + w / 2), y(y0 + 0.25), w * 0.35 * s, 0.13 * s, 0, 0, Math.PI * 2); ctx.fill(); circ(c, x0 + w * 0.8, y0 + 0.3, 0.1); } break;
  }
}

const roomCache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 260;
function roomImage(room: Room, b: Building, level: number, dpr: number) {
  const key = `${room.id}:${level}:${dpr}`;
  const hit = roomCache.get(key);
  if (hit) { roomCache.delete(key); roomCache.set(key, hit); return hit; }
  if (typeof document === 'undefined') return null;
  const S = ZOOMS[level], pad = 0.05;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((room.x2 - room.x1 + pad * 2) * S * dpr); canvas.height = Math.ceil((room.h + pad * 2) * S * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawRoomStatic(ctx, room, b, { x: u => (u - room.x1 + pad) * S, y: u => (room.y + room.h + pad - u) * S, s: S });
  roomCache.set(key, canvas);
  if (roomCache.size > CACHE_MAX) roomCache.delete(roomCache.keys().next().value!);
  return canvas;
}
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
    const ay = Y(v, b.ground - 0.55), ah = 0.45 * s;
    for (let i = 0, xx = b.x + 0.3; xx < b.x + b.w - 0.3; xx += 0.4, i++) { ctx.fillStyle = i % 2 ? '#f8fafc' : hsl(b.hue, 70, 42); ctx.beginPath(); ctx.moveTo(X(v, xx), ay - ah); ctx.lineTo(X(v, xx + 0.4), ay - ah); ctx.lineTo(X(v, xx + 0.46), ay); ctx.lineTo(X(v, xx + 0.06), ay); ctx.fill(); }
  } else if (b.style === 'office' || b.style === 'hotel') {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(X(v, b.x + b.w / 2 - 2), Y(v, b.ground + 0.02), 4 * s, 0.45 * s);
    ctx.fillStyle = '#e5e7eb'; ctx.font = font(900, s * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.style === 'hotel' ? 'HOTEL' : `TORRE ${b.id + 1}`, X(v, b.x + b.w / 2), Y(v, b.ground + 0.25));
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
    ctx.fillStyle = '#78350f'; ctx.fillRect(px - 0.1 * s, Y(v, 2.2), 0.2 * s, 2.2 * s);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = mixColor(i % 2 ? '#15803d' : '#22c55e', '#44403c', ruin * 0.8); ctx.beginPath(); ctx.arc(px + Math.cos(i) * 0.7 * s + Math.sin(g.time + i) * 0.03 * s, Y(v, 3.1 + Math.sin(i * 2) * 0.5), 0.75 * s, 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- Ovnis ----------
function drawUfo(ctx: CanvasRenderingContext2D, u: Invasion['ufos'][number], v: View, t: number) {
  const s = v.s, x = X(v, u.x), y = Y(v, u.y);
  if (u.beam) {
    const tx = X(v, u.beam.x), ty = Y(v, u.beam.y), k = Math.min(1, (t - u.beam.t0) * 3);
    const beam = ctx.createLinearGradient(x, y, tx, ty); beam.addColorStop(0, 'rgba(165,243,252,0.9)'); beam.addColorStop(1, 'rgba(74,222,128,0.7)');
    ctx.fillStyle = beam; ctx.globalAlpha = 0.55 + Math.sin(t * 50) * 0.2;
    ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y + 0.4 * s); ctx.lineTo(x + 0.6 * s, y + 0.4 * s); ctx.lineTo(x + (tx - x) * k + 0.25 * s, y + (ty - y) * k); ctx.lineTo(x + (tx - x) * k - 0.25 * s, y + (ty - y) * k); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ecfeff'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.beginPath(); ctx.moveTo(x, y + 0.4 * s); ctx.lineTo(x + (tx - x) * k, y + (ty - y) * k); ctx.stroke();
    const hit = ctx.createRadialGradient(tx, ty, 0, tx, ty, s * 1.5); hit.addColorStop(0, 'rgba(236,254,255,0.95)'); hit.addColorStop(1, 'rgba(74,222,128,0)');
    if (k >= 1) { ctx.fillStyle = hit; ctx.fillRect(tx - s * 1.5, ty - s * 1.5, s * 3, s * 3); }
  }
  if (x < -s * 5 || x > v.w + s * 5 || y < -s * 3 || y > v.h + s * 3) return;
  const under = ctx.createRadialGradient(x, y + 0.5 * s, 0, x, y + 0.5 * s, 3 * s); under.addColorStop(0, 'rgba(103,232,249,0.55)'); under.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = under; ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 5 * s);
  const dome = ctx.createRadialGradient(x - 0.4 * s, y - 1 * s, 0, x, y - 0.6 * s, 1.4 * s); dome.addColorStop(0, 'rgba(236,254,255,0.95)'); dome.addColorStop(1, 'rgba(14,116,144,0.7)');
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(x, y - 0.35 * s, 1.25 * s, 0.95 * s, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.ellipse(x - 0.1 * s, y - 0.75 * s, 0.32 * s, 0.42 * s, 0, 0, Math.PI * 2); ctx.fill(); // el piloto
  ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.ellipse(x + 0.05 * s, y - 0.78 * s, 0.1 * s, 0.16 * s, 0.4, 0, Math.PI * 2); ctx.fill();
  const hull = ctx.createLinearGradient(0, y - 0.5 * s, 0, y + 0.5 * s); hull.addColorStop(0, '#e5e7eb'); hull.addColorStop(0.45, '#9ca3af'); hull.addColorStop(1, '#374151');
  ctx.fillStyle = hull; ctx.beginPath(); ctx.ellipse(x, y, 3.4 * s, 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 0.1 * s, 3.1 * s, 0.4 * s, 0, Math.PI, 0); ctx.stroke();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + t * 2, lx = x + Math.cos(a) * 2.9 * s, ly = y + Math.sin(a) * 0.3 * s + 0.15 * s; if (Math.sin(a) < 0) continue; ctx.fillStyle = i % 2 ? '#fde047' : '#ef4444'; ctx.beginPath(); ctx.arc(lx, ly, 0.13 * s, 0, Math.PI * 2); ctx.fill(); }
}

// ---------- Todo junto ----------
export function paintCity(ctx: CanvasRenderingContext2D, g: Invasion, v: View) {
  drawSky(ctx, g, v);
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
        const img = roomImage(room, b, level, v.dpr);
        if (img) ctx.drawImage(img, X(v, room.x1 - 0.05), Y(v, room.y + room.h + 0.05), (room.x2 - room.x1 + 0.1) * v.s, (room.h + 0.1) * v.s);
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
    if (d.goo) { // mancha verde del alien que explotó
      ctx.fillStyle = 'rgba(74,222,128,0.75)';
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + d.x, r = v.s * (0.12 + hash(i + d.x * 3) * 0.2); ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * v.s * 0.4 * hash(i * 2 + d.t), py - Math.abs(Math.sin(a)) * v.s * 0.5 * hash(i + d.t), r, r * 0.7, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(22,101,52,0.8)'; ctx.beginPath(); ctx.ellipse(px, py, v.s * 0.45, v.s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (d.glass) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = i * 0.9 + d.x; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * v.s * (0.25 + hash(i + d.y) * 0.35), py + Math.sin(a) * v.s * (0.25 + hash(i * 3 + d.x) * 0.35)); ctx.stroke(); } }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, v.s * 0.035), 0, Math.PI * 2); ctx.fill();
  }
  // La gente de los departamentos y las cajas.
  for (const p of g.people) {
    if (p.gone || p.room < 0) continue;
    if (!visible(v, p.x - 2, p.x + 2, p.y - 1.2, p.y + 2.6)) continue;
    drawPerson(ctx, g, p, X(v, p.x), Y(v, p.y), v.s, g.time);
  }
  for (const box of g.boxes) {
    if (box.exploded || !visible(v, box.x - 1, box.x + 1, box.y, box.y + 1)) continue;
    const px = X(v, box.x), py = Y(v, box.y);
    drawProp(ctx, 'box', px, py, v.s * 0.42 * 2.4, g.time);
    if (box.kind === 1 && !box.explosive) { ctx.fillStyle = '#ef4444'; ctx.fillRect(px - v.s * 0.06, py - v.s * 0.3, v.s * 0.12, v.s * 0.08); } // una caja de pizza con su logo
    if (box.explosive && !box.defused && Math.floor(g.time * 3) % 2 === 0) { ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = v.s * 0.15; ctx.beginPath(); ctx.arc(px + v.s * 0.12, py - v.s * 0.17, Math.max(1, v.s * 0.025), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
    if (box.defused) { ctx.fillStyle = 'rgba(34,197,94,0.9)'; ctx.font = font(900, v.s * 0.22); ctx.textAlign = 'center'; ctx.fillText('✓', px, py - v.s * 0.45); }
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
  // Explosiones y partículas.
  for (const bl of g.blasts) {
    const k = bl.t / 1.2, r = (0.6 + k * 1.8) * bl.size * v.s, px = X(v, bl.x), py = Y(v, bl.y);
    const gl = ctx.createRadialGradient(px, py, 0, px, py, r);
    if (bl.green) { // el alien explota en verde: bola de luz, anillo y destello
      gl.addColorStop(0, `rgba(240,255,220,${1 - k})`); gl.addColorStop(0.35, `rgba(132,204,22,${0.9 * (1 - k)})`); gl.addColorStop(0.7, `rgba(22,163,74,${0.6 * (1 - k)})`); gl.addColorStop(1, 'rgba(20,83,45,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(190,242,100,${0.9 * (1 - k)})`; ctx.lineWidth = Math.max(2, v.s * 0.08 * (1 - k)); ctx.beginPath(); ctx.arc(px, py, r * 1.25, 0, Math.PI * 2); ctx.stroke();
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
    else if (pt.kind === 'blood' || pt.kind === 'goo') { ctx.beginPath(); ctx.arc(X(v, pt.x), Y(v, pt.y), Math.max(0.8, r), 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(X(v, pt.x) - r / 2, Y(v, pt.y) - r / 2, Math.max(1, r), Math.max(1, r));
  }
  ctx.globalAlpha = 1;
  // Humo general que oscurece la ciudad al final.
  const ruin = ruinAt(g.time);
  if (ruin > 0) { ctx.fillStyle = `rgba(40,10,5,${ruin * 0.3})`; ctx.fillRect(0, 0, v.w, v.h); }
}
// La anomalía de ambiente que hace cada persona (para las luces que titilan).
const ANOMALY_FX = (id: number) => { const fx = ANOMALIES[id].fx; return fx.t === 'env' ? fx.mode : null; };

// Plano chiquito de toda la cuadra (arriba de la pantalla): edificios, fuego, ovnis y dónde estás mirando.
export function drawMinimap(ctx: CanvasRenderingContext2D, g: Invasion, w: number, h: number, view: { x1: number; x2: number; y1: number; y2: number }) {
  const maxY = 45, sx = w / g.width, sy = h / (maxY + 4), Y0 = (y: number) => h - (y + 4) * sy;
  ctx.fillStyle = 'rgba(2,6,23,0.75)'; ctx.fillRect(0, 0, w, h);
  for (const b of g.buildings) {
    ctx.fillStyle = '#475569'; ctx.fillRect(b.x * sx, Y0(b.top), b.w * sx, b.top * sy);
    for (const id of b.rooms) { const r = g.rooms[id]; if (r.destroyed) { ctx.fillStyle = '#7f1d1d'; ctx.fillRect(r.x1 * sx, Y0(r.y + r.h), (r.x2 - r.x1) * sx, r.h * sy); } else if (r.fire > 0.05) { ctx.fillStyle = '#f97316'; ctx.fillRect(r.x1 * sx, Y0(r.y + r.h), (r.x2 - r.x1) * sx, r.h * sy); } }
  }
  for (const u of g.ufos) { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.ellipse(u.x * sx, Y0(Math.min(maxY, u.y)), 4, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.strokeRect(view.x1 * sx, Y0(view.y2), (view.x2 - view.x1) * sx, (view.y2 - view.y1) * sy);
}
