// Land of Warriors: los escenarios se generan solos (con una semilla), en cinco estilos y cuatro tamaños.
// El terreno es una grilla: piso (se camina), líquido (agua, lava o ácido: no se camina), obstáculo (rocas, bosque,
// ruinas: no se camina) y puente (se camina por encima del líquido). Siempre hay al menos un camino entre las bases.
export const T = 40; // el lado de cada casillero, en unidades del mundo
export const GROUND = 0, LIQUID = 1, BLOCK = 2, BRIDGE = 3;
export type MapSize = 'small' | 'medium' | 'large' | 'huge';
export const MAP_SIZES: [MapSize, string, number, number][] = [['small', 'Chico', 2200, 1400], ['medium', 'Medio', 2900, 1800], ['large', 'Grande', 3700, 2300], ['huge', 'Muy grande', 4600, 2800]];
export interface Theme {
  name: string; text: string; ground: [string, string, string]; path: string; liquid: [string, string, string]; shore: string; glow: string | null;
  block: 'rock' | 'forest' | 'ruin' | 'mixed'; rock: [string, string]; leaf: [string, string, string]; decor: ('bush' | 'flower' | 'bone' | 'crystal' | 'pebble' | 'mushroom' | 'grass' | 'crack' | 'palm')[];
  lakes: number; river: number; blocks: number;
}
// Los cinco estilos (inspirados en las referencias): colores bien distintos del ejército para que los guerreros resalten.
export const THEMES: Theme[] = [
  { name: 'La Grieta Corrupta', text: 'Roca violeta, charcos de ácido verde y restos de metal.', ground: ['#4a3d4c', '#5b4a57', '#3b3140'], path: '#6e6066', liquid: ['#7dff3a', '#39b51a', '#173f0c'], shore: '#2a1f2b', glow: '#9cff4a', block: 'rock', rock: ['#5d4a5a', '#2e2230'], leaf: ['#6b2d6e', '#9a46a0', '#3a1440'], decor: ['crystal', 'pebble', 'crack', 'mushroom'], lakes: 0.5, river: 1, blocks: 0.6 },
  { name: 'Archipiélago Esmeralda', text: 'Islas de pasto y arena entre lagunas turquesa.', ground: ['#7a9a3e', '#8fae48', '#64822f'], path: '#d9c48c', liquid: ['#5fe0e8', '#1fa6c4', '#0d5a82'], shore: '#e8d8a0', glow: null, block: 'forest', rock: ['#8a8070', '#4d463c'], leaf: ['#2f7a2a', '#4fa83a', '#1c4a1a'], decor: ['palm', 'flower', 'grass', 'bush'], lakes: 1.2, river: 1, blocks: 0.4 },
  { name: 'Tierras de Ceniza', text: 'Piedra gris quebrada, ruinas y ríos de lava.', ground: ['#4b4644', '#5a5452', '#3a3534'], path: '#6b625c', liquid: ['#ffd25a', '#ff6a12', '#8a1a02'], shore: '#1e1817', glow: '#ff7a1a', block: 'ruin', rock: ['#5a5350', '#2a2523'], leaf: ['#3a2e2a', '#4e3e38', '#221a18'], decor: ['bone', 'crack', 'pebble'], lakes: 0.4, river: 1, blocks: 0.6 },
  { name: 'Valle de Yldran', text: 'Pasto verde, árboles en flor, ríos y cascadas.', ground: ['#5e9a3a', '#73b244', '#4a7e2c'], path: '#c7aa72', liquid: ['#7ee8ff', '#2fa8e0', '#145e9a'], shore: '#7a6a4a', glow: null, block: 'forest', rock: ['#9a9a9a', '#585858'], leaf: ['#b34ac0', '#e07ae8', '#6a2478'], decor: ['flower', 'bush', 'grass', 'mushroom'], lakes: 0.5, river: 1, blocks: 0.7 },
  { name: 'Frontera de Acero', text: 'Tierra del cañón, mesetas de roca y un río abajo.', ground: ['#9a7a4e', '#ad8a58', '#836640'], path: '#c4a678', liquid: ['#6fd2ff', '#2b8fd0', '#123f6e'], shore: '#4a3626', glow: null, block: 'mixed', rock: ['#a0704a', '#5a3a22'], leaf: ['#2e5a2a', '#3f7a34', '#1a361a'], decor: ['pebble', 'grass', 'bush', 'crack'], lakes: 0.3, river: 1, blocks: 0.9 },
];
export interface Terrain { cols: number; rows: number; w: number; h: number; cells: Uint8Array; theme: number; seed: number; bases: [number, number][]; spots: [number, number][] }

// Ruido suave (para los lagos, las rocas y los colores del piso).
function noise(seed: number) {
  const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263 + seed * 2654435761) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
export function generateTerrain(theme: number, size: MapSize, seed: number): Terrain {
  const [, , w, h] = MAP_SIZES.find(m => m[0] === size) ?? MAP_SIZES[1];
  const cols = Math.ceil(w / T), rows = Math.ceil(h / T), cells = new Uint8Array(cols * rows), th = THEMES[theme % THEMES.length];
  let s = (seed % 2147483647) || 11; const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const n1 = noise(seed + 1), n2 = noise(seed + 2), n3 = noise(seed + 3);
  const idx = (c: number, r: number) => r * cols + c, inside = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  // lagos y rocas por ruido
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lake = n1(c / 9, r / 9) * 0.7 + n3(c / 4, r / 4) * 0.3, rock = n2(c / 6, r / 6) * 0.75 + n3(c / 2.5 + 40, r / 2.5) * 0.25;
    if (lake < 0.16 + 0.1 * th.lakes) cells[idx(c, r)] = LIQUID;
    else if (rock > 0.8 - 0.09 * th.blocks) cells[idx(c, r)] = BLOCK;
  }
  // un río (o una grieta) que cruza el mapa en diagonal, con puentes
  if (th.river) {
    const bridges = new Set<number>(), nb = size === 'small' ? 2 : size === 'medium' ? 3 : size === 'large' ? 4 : 5;
    for (let i = 0; i < nb; i++) bridges.add(Math.floor(rows * (i + 0.5) / nb + (rand() - 0.5) * 2));
    const ph = rand() * 6;
    for (let r = 0; r < rows; r++) {
      const cx = cols * (0.62 - 0.24 * r / rows) + Math.sin(r / 5 + ph) * 3 + (n1(r / 3, 99) - 0.5) * 4, wd = 1.6 + n2(r / 4, 7) * 1.4;
      for (let c = Math.floor(cx - wd); c <= Math.ceil(cx + wd); c++) if (inside(c, r)) cells[idx(c, r)] = bridges.has(r) ? BRIDGE : LIQUID;
    }
  }
  // las bases (el jugador abajo a la izquierda, la computadora arriba a la derecha) y los lugares de los cristales
  const bases: [number, number][] = [[Math.round(cols * 0.13), Math.round(rows * 0.76)], [Math.round(cols * 0.87), Math.round(rows * 0.24)]];
  const nSpots = size === 'small' ? 2 : size === 'medium' ? 3 : size === 'large' ? 5 : 7, spots: [number, number][] = [];
  for (let i = 0; i < nSpots; i++) { // en espejo respecto del centro (para que sea parejo)
    let c = 0, r = 0;
    for (let tries = 0; tries < 40; tries++) { c = Math.round(cols * (0.2 + rand() * 0.6)); r = Math.round(rows * (0.15 + rand() * 0.7)); if (spots.every(([x, y]) => Math.hypot(x - c, y - r) > 7) && bases.every(([x, y]) => Math.hypot(x - c, y - r) > 12)) break; }
    spots.push([c, r]); if (Math.hypot(cols - 1 - c - c, rows - 1 - r - r) > 4) spots.push([cols - 1 - c, rows - 1 - r]);
  }
  const clear = (c0: number, r0: number, rad: number) => { for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) if (inside(c, r) && Math.hypot(c - c0, r - r0) <= rad) cells[idx(c, r)] = cells[idx(c, r)] === BRIDGE ? BRIDGE : GROUND; };
  for (const [c, r] of bases) clear(c, r, 8);
  for (const [c, r] of spots) clear(c, r, 4);
  // que siempre se pueda llegar: si una base o un lugar de cristales quedó encerrado, se abre un camino (con puente)
  const reach = () => { const seen = new Uint8Array(cols * rows), q = [idx(bases[0][0], bases[0][1])]; seen[q[0]] = 1;
    while (q.length) { const k = q.pop()!, c = k % cols, r = (k - c) / cols; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (inside(nc, nr) && !seen[idx(nc, nr)] && (cells[idx(nc, nr)] === GROUND || cells[idx(nc, nr)] === BRIDGE)) { seen[idx(nc, nr)] = 1; q.push(idx(nc, nr)); } } }
    return seen; };
  for (const target of [bases[1], ...spots]) {
    if (reach()[idx(target[0], target[1])]) continue;
    let [c, r] = bases[0];
    while (c !== target[0] || r !== target[1]) {
      if (Math.abs(target[0] - c) > Math.abs(target[1] - r)) c += Math.sign(target[0] - c); else r += Math.sign(target[1] - r);
      for (const [dc, dr] of [[0, 0], [1, 0], [0, 1]]) { const k = idx(Math.min(cols - 1, c + dc), Math.min(rows - 1, r + dr)); if (cells[k] === LIQUID) cells[k] = BRIDGE; else if (cells[k] === BLOCK) cells[k] = GROUND; }
    }
  }
  return { cols, rows, w: cols * T, h: rows * T, cells, theme: theme % THEMES.length, seed, bases, spots };
}
export const cellAt = (t: Terrain, x: number, y: number) => { const c = Math.floor(x / T), r = Math.floor(y / T); return c < 0 || r < 0 || c >= t.cols || r >= t.rows ? BLOCK : t.cells[r * t.cols + c]; };
export const walkable = (t: Terrain, x: number, y: number) => { const k = cellAt(t, x, y); return k === GROUND || k === BRIDGE; };
// ¿Se puede ir en línea recta de a hasta b sin pisar agua ni rocas?
export function clearLine(t: Terrain, ax: number, ay: number, bx: number, by: number) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / (T * 0.4));
  for (let i = 1; i <= n; i++) if (!walkable(t, ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
}
// El casillero caminable más cercano a un punto.
export function nearestWalkable(t: Terrain, x: number, y: number): [number, number] {
  if (walkable(t, x, y)) return [x, y];
  const c0 = Math.floor(x / T), r0 = Math.floor(y / T);
  for (let rad = 1; rad < 30; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
    const cx = (c0 + dc + 0.5) * T, cy = (r0 + dr + 0.5) * T; if (walkable(t, cx, cy)) return [cx, cy];
  }
  return [x, y];
}
// El camino más corto (A*, en ocho direcciones, sin cortar esquinas), ya simplificado: solo los puntos donde dobla.
export function findPath(t: Terrain, sx: number, sy: number, tx: number, ty: number): [number, number][] {
  [tx, ty] = nearestWalkable(t, tx, ty); [sx, sy] = nearestWalkable(t, sx, sy);
  const { cols, rows, cells } = t, start = Math.floor(sy / T) * cols + Math.floor(sx / T), goal = Math.floor(ty / T) * cols + Math.floor(tx / T);
  if (start === goal) return [[tx, ty]];
  const gC = new Float32Array(cols * rows).fill(Infinity), from = new Int32Array(cols * rows).fill(-1), closed = new Uint8Array(cols * rows);
  const gx = goal % cols, gy = (goal - gx) / cols, hf = (k: number) => { const c = k % cols, r = (k - c) / cols, dx = Math.abs(c - gx), dy = Math.abs(r - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const heap: [number, number][] = []; // (f, casillero)
  const push = (f: number, k: number) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const ok = (k: number) => cells[k] === GROUND || cells[k] === BRIDGE;
  gC[start] = 0; push(hf(start), start); let found = false, steps = 0;
  while (heap.length && steps++ < 20000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) { found = true; break; }
    const c = k % cols, r = (k - c) / cols;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue; const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = nr * cols + nc; if (!ok(nk) || closed[nk]) continue;
      if (dc && dr && (!ok(r * cols + nc) || !ok(nr * cols + c))) continue; // (no corta esquinas)
      const ng = gC[k] + (dc && dr ? 1.414 : 1); if (ng < gC[nk]) { gC[nk] = ng; from[nk] = k; push(ng + hf(nk), nk); }
    }
  }
  if (!found) return [[tx, ty]];
  const pts: [number, number][] = []; for (let k = goal; k !== start && k >= 0; k = from[k]) { const c = k % cols; pts.push([(c + 0.5) * T, ((k - c) / cols + 0.5) * T]); }
  pts.reverse(); pts[pts.length - 1] = [tx, ty];
  const out: [number, number][] = []; let ax = sx, ay = sy; // se saltea los puntos que se ven en línea recta
  for (let i = 0; i < pts.length; i++) { const nx = pts[i + 1]; if (nx && clearLine(t, ax, ay, nx[0], nx[1])) continue; out.push(pts[i]); [ax, ay] = pts[i]; }
  return out.length ? out : [[tx, ty]];
}
