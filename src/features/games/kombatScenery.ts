// Los fondos de los escenarios de Kombat Football: siempre se ve el lugar donde se juega (nunca una pared),
// con varias capas de profundidad, niebla de distancia, luz que viene de un lado y texturas hechas píxel por
// píxel (montañas, rocas, volcanes, planetas, humo y nubes) para que se vean realistas. Se pinta una sola vez
// por escenario y tamaño de pantalla (kombatArt lo guarda).
import { fbm, mixRGB, pixels, ramp, rgb, type RGB } from './gravityBackdrops';
import { alpha, darken, hash, lighten, lin } from './gravityMonsters';
import type { StageId } from './kombat';

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;
interface Area { w: number; h: number; ground: number; s: number; res: number }

// ---------------------------------------------------------------- Herramientas
const glowDisc = (g: Ctx, x: number, y: number, r: number, color: string, a: number) => { const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, alpha(color, a)); gg.addColorStop(1, alpha(color, 0)); g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2); };
function stars(g: Ctx, A: Area, n: number, top: number, seed: number) {
  for (let k = 0; k < n; k++) {
    const x = hash(k * 3.1 + seed) * A.w, y = hash(k * 7.7 + seed) * top, b = hash(k * 1.3 + seed);
    g.fillStyle = `rgba(${b < 0.2 ? '255,220,200' : b > 0.85 ? '200,220,255' : '255,255,255'},${0.25 + b * 0.75})`;
    const sz = b > 0.96 ? 2.2 : b > 0.8 ? 1.5 : 1; g.fillRect(x, y, sz, sz);
    if (b > 0.985) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 3, y + 0.5, 7, 1); g.fillRect(x + 0.5, y - 3, 1, 7); }
  }
}
// Una capa pintada píxel por píxel en baja resolución y estirada suave (para no tardar).
function layer(g: Ctx, A: Area, y0: number, y1: number, f: (x: number, y: number) => [number, number, number, number] | null, res = A.res) {
  const hh = Math.max(1, y1 - y0);
  const c = pixels(A.w / res, hh / res, (x, y) => f(x * res, y0 + y * res));
  g.imageSmoothingEnabled = true; g.drawImage(c, 0, y0, A.w, hh);
}
// Perfil de montañas: 0 abajo, 1 arriba (crestas filosas si "ridged").
const profile = (x: number, seed: number, scale: number, ridged = 0.45) => { const n = fbm(x / scale, 0.37, seed, 4); const r = 1 - Math.abs(n * 2 - 1); return n * (1 - ridged) + r * ridged; };
interface MountainOpts { base: number; height: number; seed: number; scale: number; colors: [number, string][]; snow?: number; snowColor?: string; haze?: string; hazeK?: number; light?: number; glow?: (x: number, y: number, depth: number) => [RGB, number] | null }
// Montañas con textura de roca, luz del costado (según la pendiente), nieve en las crestas y niebla.
function mountains(g: Ctx, A: Area, o: MountainOpts) {
  const top = o.base - o.height - 4, sc = o.scale * A.s, tex = A.s * 0.9;
  const smooth = (x: number) => fbm(x / sc, 0.37, o.seed, 3); // perfil suave (para la luz de las laderas)
  layer(g, A, Math.max(0, top), o.base + 2, (x, y) => {
    const p = profile(x, o.seed, sc), ty = o.base - o.height * p;
    if (y < ty) return null;
    const slope = (smooth(x + sc * 0.04) - smooth(x - sc * 0.04)) * 9 * (o.light ?? 1);
    const d = Math.min(1, (y - ty) / Math.max(1, o.base - ty));
    const n = fbm(x / tex, y / (tex * 0.7), o.seed + 9, 5), rock = fbm(x / (tex * 0.25), y / (tex * 0.25), o.seed + 4, 3);
    let c = ramp(o.colors, d * 0.85 + (n - 0.5) * 0.3);
    const crest = Math.max(0, 1 - (y - ty) / (A.s * 0.35)) * 0.25; // borde de arriba iluminado
    const lightK = Math.max(0.4, Math.min(1.55, 0.95 + slope + (n - 0.5) * 0.55 + (rock - 0.5) * 0.25 + crest));
    c = [c[0] * lightK, c[1] * lightK, c[2] * lightK];
    if (o.snow) { const sd = (y - ty) / A.s; const cover = o.snow * (0.35 + n * 0.9) * (slope > -0.15 ? 1 : 0.45); if (sd < cover) c = mixRGB(c, rgb(o.snowColor ?? '#eef6ff'), Math.min(1, 1.1 - sd / cover) * (0.8 + Math.max(-0.3, slope) * 0.4)); }
    if (o.glow) { const gl = o.glow(x, y, d); if (gl) c = mixRGB(c, gl[0], gl[1]); }
    if (o.haze) c = mixRGB(c, rgb(o.haze), (o.hazeK ?? 0.3) * (1 - d * 0.3));
    return [Math.min(255, c[0]), Math.min(255, c[1]), Math.min(255, c[2]), y - ty < 1.5 ? 200 : 255];
  }, Math.min(2, A.res));
}
// Nubes, humo o nebulosa con ruido fractal (densidad que se arremolina, borde iluminado de un lado).
function clouds(g: Ctx, A: Area, y0: number, y1: number, color: string, light: string, density: number, seed: number, scale = 1, fadeBottom = true) {
  const c = rgb(color), l = rgb(light), sc = A.s * 6 * scale;
  layer(g, A, y0, y1, (x, y) => {
    const u = x / sc, v = y / sc;
    const n = fbm(u + fbm(u * 0.5, v * 0.5, seed + 3, 3) * 1.6, v * 1.7, seed, 5);
    let d = Math.max(0, Math.min(1, (n - (1 - density)) * 3.2));
    const k = (y - y0) / (y1 - y0); d *= fadeBottom ? Math.min(1, (1 - k) * 2.2) * Math.min(1, k * 6) : Math.min(1, k * 6, (1 - k) * 6);
    if (d <= 0.01) return null;
    const lit = Math.max(0, Math.min(1, (fbm(u - 0.12, v - 0.18, seed, 4) - n) * 7 + 0.45));
    const col = mixRGB(c, l, lit * 0.8);
    return [col[0], col[1], col[2], 255 * d];
  }, A.res + 1);
}
// Columna de humo que sube y se abre.
function plume(g: Ctx, A: Area, x: number, base: number, height: number, width: number, color: string, light: string, seed: number) {
  const c = rgb(color), l = rgb(light), top = base - height;
  layer(g, A, Math.max(0, top), base, (px, py) => {
    const k = (base - py) / height, half = width * (0.25 + k * 1.2), drift = Math.sin(k * 3 + seed) * width * 0.6 * k;
    const dx = (px - x - drift) / half; if (Math.abs(dx) > 1.3) return null;
    const n = fbm(px / (A.s * 2.5), py / (A.s * 2.5) + seed, seed, 5);
    const d = Math.max(0, (1 - dx * dx) * (0.55 + n * 0.9) - 0.35) * Math.min(1, (1 - k) * 2.5) * 1.4;
    if (d <= 0.01) return null;
    const col = mixRGB(c, l, Math.max(0, Math.min(1, (n - 0.4) * 2 - dx * 0.4)));
    return [col[0], col[1], col[2], Math.min(255, 255 * d)];
  }, A.res + 1);
}
// Planeta o luna con luz de un costado, en alta resolución (aunque sea enorme).
function planet(g: Ctx, A: Area, cx: number, cy: number, R: number, kind: 'earth' | 'moon' | 'gas' | 'ice', seed: number, atmo?: string, light: [number, number, number] = [-0.6, -0.45, 0.66]) {
  const ln = Math.hypot(...light), L = light.map(v => v / ln), at = atmo ? rgb(atmo) : null;
  const y0 = Math.max(0, cy - R * 1.08), y1 = Math.min(A.h, cy + R * 1.08);
  if (atmo) glowDisc(g, cx, cy, R * 1.35, atmo, 0.35);
  const res = Math.max(1, Math.min(2, Math.round(R / 200)));
  layer(g, A, y0, y1, (x, y) => {
    const nx = (x - cx) / R, ny = (y - cy) / R, d2 = nx * nx + ny * ny;
    if (d2 > 1) { if (!at || d2 > 1.06) return null; const k = (1.06 - d2) / 0.06; return [at[0], at[1], at[2], 200 * k * k]; }
    const nz = Math.sqrt(1 - d2), lon = Math.atan2(nx, nz), lat = Math.asin(ny);
    const lit = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    let c: RGB;
    if (kind === 'earth') {
      const hgt = fbm(lon * 1.6 + 3, lat * 1.6, seed, 6), cl = fbm(lon * 3 + 10, lat * 4.5, seed + 9, 5);
      c = hgt < 0.5 ? ramp([[0, '#06204f'], [0.8, '#0b4aa2'], [1, '#2a86c8']], hgt / 0.5) : ramp([[0, '#d8c48a'], [0.08, '#4d7a2a'], [0.4, '#2f5d1c'], [0.7, '#7a5a3a'], [1, '#e8e2d6']], (hgt - 0.5) / 0.3);
      if (Math.abs(lat) > 1.15 - fbm(lon * 3, lat, seed + 2, 3) * 0.25) c = rgb('#f1f5f9');
      c = mixRGB(c, [255, 255, 255], Math.min(0.92, Math.max(0, cl - 0.5) * 2.6));
    } else if (kind === 'moon') {
      const m = fbm(lon * 1.2, lat * 1.2, seed, 5), fine = fbm(nx * 18, ny * 18, seed + 4, 3);
      c = ramp([[0, '#4b4b50'], [0.45, '#8d8d92'], [1, '#d4d4d8']], m * 0.9 + fine * 0.25 - 0.1);
      for (let k = 0; k < 18; k++) { const kx = hash(k + seed) * 2 - 1, ky = hash(k * 3 + seed) * 2 - 1, kr = 0.04 + hash(k * 7 + seed) ** 3 * 0.2, dd = Math.hypot(nx - kx, ny - ky) / kr; if (dd < 1) c = mixRGB(c, dd > 0.8 ? [210, 210, 214] : [70, 70, 76], dd > 0.8 ? 0.3 : 0.35 * (1 - dd)); }
    } else if (kind === 'ice') {
      c = ramp([[0, '#5b7fae'], [0.5, '#a9cdee'], [1, '#f0f8ff']], fbm(lon * 2, lat * 5, seed, 5));
    } else {
      const turb = fbm(lon * 2.2, lat * 9, seed, 5), bands = Math.sin(lat * 15 + turb * 4.5) * 0.5 + 0.5;
      c = ramp([[0, '#3b1d5c'], [0.35, '#7c3aed'], [0.6, '#e9d5ff'], [0.85, '#c084fc'], [1, '#f5f3ff']], bands * 0.8 + fbm(lon * 6, lat * 20, seed + 3, 3) * 0.3);
    }
    let out = mixRGB([4, 6, 14], c, Math.min(1, lit * 1.25 + 0.03));
    if (at) out = mixRGB(out, at, Math.min(0.85, Math.pow(1 - nz, 2.5) * Math.min(1, lit * 1.8 + 0.15)));
    return [out[0], out[1], out[2], 255];
  }, res);
}
// Edificios de una ciudad (con ventanas, antenas, tanques de agua y carteles de neón).
function skyline(g: Ctx, A: Area, base: number, color: string, scale: number, lit: number, seed: number, neon: boolean) {
  const s = A.s; let x = -s;
  const r = (n: number) => hash(n * 1.37 + seed * 11.1);
  while (x < A.w + s) {
    const bw = s * (1 + r(x) * 2.2) * scale, bh = s * (3 + r(x * 1.3) * 8) * scale;
    g.fillStyle = color; g.fillRect(x, base - bh, bw, bh + s);
    g.fillStyle = lighten(color, 0.06); g.fillRect(x, base - bh, Math.max(1, bw * 0.08), bh); // borde con luz
    if (r(x * 2.7) < 0.35) { g.fillStyle = color; g.fillRect(x + bw * 0.2, base - bh - s * 0.8 * scale, bw * 0.5, s * 0.8 * scale); }
    if (r(x * 3.3) < 0.2) { g.fillStyle = color; const tx = x + bw * 0.6; g.fillRect(tx, base - bh - s * 0.9 * scale, s * 0.5 * scale, s * 0.5 * scale); g.fillRect(tx + s * 0.05 * scale, base - bh - s * 0.4 * scale, Math.max(1, s * 0.05), s * 0.4 * scale); g.fillRect(tx + s * 0.4 * scale, base - bh - s * 0.4 * scale, Math.max(1, s * 0.05), s * 0.4 * scale); } // tanque de agua
    if (r(x * 2.1) < 0.35) { g.fillStyle = color; g.fillRect(x + bw * 0.45, base - bh - s * 2.2 * scale, Math.max(1, s * 0.06), s * 2.2 * scale); g.fillStyle = '#ff3b3b'; g.fillRect(x + bw * 0.45 - 1, base - bh - s * 2.2 * scale, 3, 3); glowDisc(g, x + bw * 0.45, base - bh - s * 2.2 * scale, s * 0.5, '#ff3b3b', 0.4); }
    if (lit > 0) for (let yy = base - bh + s * 0.35 * scale; yy < base - s * 0.2; yy += s * 0.32 * scale) for (let xx = x + s * 0.14 * scale; xx < x + bw - s * 0.14 * scale; xx += s * 0.26 * scale) if (r(xx * 3.3 + yy * 1.7) < lit) { const warm = r(xx) < 0.65; g.fillStyle = `rgba(${warm ? '255,205,130' : '150,210,255'},${0.35 + r(xx + yy) * 0.6})`; g.fillRect(xx, yy, s * 0.12 * scale, s * 0.15 * scale); }
    if (neon && r(x * 4.1) < 0.4) { const nc = ['#f472b6', '#22d3ee', '#a78bfa', '#f87171', '#facc15'][Math.floor(r(x) * 5)], ny = base - bh * (0.35 + r(x + 2) * 0.45), vert = r(x + 5) < 0.5; const nw = vert ? s * 0.45 * scale : bw * 0.6, nh = vert ? s * 2.2 * scale : s * 0.8 * scale; glowDisc(g, x + bw / 2, ny + nh / 2, Math.max(nw, nh) * 1.4, nc, 0.35); g.fillStyle = nc; g.fillRect(x + (bw - nw) / 2, ny, nw, nh); g.fillStyle = 'rgba(0,0,0,0.45)'; for (let k = 0; k < 4; k++) { if (vert) g.fillRect(x + (bw - nw) / 2 + nw * 0.2, ny + nh * (0.1 + k * 0.22), nw * 0.6, nh * 0.1); else g.fillRect(x + (bw - nw) / 2 + nw * (0.08 + k * 0.23), ny + nh * 0.25, nw * 0.15, nh * 0.5); } }
    x += bw + s * 0.12 * r(x);
  }
}
const fog = (g: Ctx, A: Area, y0: number, y1: number, color: string, a: number) => { g.fillStyle = lin(g, 0, y0, 0, y1, [[0, alpha(color, 0)], [1, alpha(color, a)]]); g.fillRect(0, y0, A.w, y1 - y0); };
const truss = (g: Ctx, x: number, top: number, bottom: number, wd: number, color: string, lw: number) => {
  g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(x, top, wd, bottom - top);
  for (let y = top; y < bottom; y += wd) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + wd, y + wd); g.moveTo(x + wd, y); g.lineTo(x, y + wd); g.stroke(); }
};
const light = (g: Ctx, x: number, y: number, r: number, color: string) => { glowDisc(g, x, y, r * 6, color, 0.45); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

// ---------------------------------------------------------------- Escenarios
export function paintScenery(g: Ctx, stage: StageId, w: number, h: number, ground: number, s: number) {
  const A: Area = { w, h, ground, s, res: w > 1600 ? 4 : w > 700 ? 3 : 2 };
  const r = (n: number) => hash(n * 1.37 + stage.length * 11.1);
  switch (stage) {
    case 'industrial': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#040814'], [0.5, '#101b42'], [0.85, '#3a2a6a'], [1, '#7a3b6e']]); g.fillRect(0, 0, w, h);
      stars(g, A, 260, ground * 0.55, 1);
      planet(g, A, w * 0.66, ground * 0.2, s * 2.3, 'moon', 7, '#cbd5f5');
      clouds(g, A, 0, ground * 0.62, '#1a2550', '#5b6aa8', 0.5, 3);
      for (const bx of [0.18, 0.78]) { const sx = w * bx; g.save(); g.globalCompositeOperation = 'lighter'; const beam = g.createLinearGradient(sx, ground, sx, 0); beam.addColorStop(0, 'rgba(180,200,255,0.18)'); beam.addColorStop(1, 'rgba(180,200,255,0)'); g.fillStyle = beam; g.beginPath(); g.moveTo(sx - s * 0.2, ground - s * 3); g.lineTo(sx + (bx < 0.5 ? s * 6 : -s * 6) - s * 1.2, 0); g.lineTo(sx + (bx < 0.5 ? s * 6 : -s * 6) + s * 1.2, 0); g.lineTo(sx + s * 0.2, ground - s * 3); g.fill(); g.restore(); } // reflectores
      skyline(g, A, ground - s * 3.4, '#1b2550', 0.75, 0.3, 1, false); fog(g, A, ground * 0.35, ground - s * 3, '#3a3d7a', 0.55);
      skyline(g, A, ground - s * 2.4, '#141c3e', 1.05, 0.2, 2, true); fog(g, A, ground * 0.5, ground - s * 2, '#2a2a5a', 0.35);
      for (const [x, y] of [[0.14, 0.18], [0.56, 0.3], [0.86, 0.12]] as const) { const sx = w * x, sy = ground * y; glowDisc(g, sx, sy + s * 0.4, s * 1.8, '#f43f5e', 0.25); g.fillStyle = lin(g, 0, sy - s * 0.3, 0, sy + s * 0.25, [[0, '#4a5375'], [1, '#1c2238']]); g.beginPath(); g.ellipse(sx, sy, s * 1.1, s * 0.25, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(125,211,252,0.85)'; g.beginPath(); g.ellipse(sx, sy - s * 0.18, s * 0.42, s * 0.25, 0, Math.PI, TAU); g.fill(); for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#fbbf24' : '#f87171'; g.fillRect(sx + k * s * 0.3 - 1, sy - 1, 3, 3); } } // naves
      // puente del tren elevado con el tren
      const by = ground - s * 4.6;
      g.fillStyle = '#0d1430'; g.fillRect(0, by, w, s * 0.35); for (let x = s; x < w; x += s * 4) { g.fillRect(x, by, s * 0.35, ground - by); g.beginPath(); g.moveTo(x - s * 1.5, by + s * 0.35); g.quadraticCurveTo(x + s * 0.17, by + s * 1.6, x + s * 1.85, by + s * 0.35); g.lineWidth = s * 0.12; g.strokeStyle = '#0d1430'; g.stroke(); }
      const tx = w * 0.3; g.fillStyle = '#1e2a52'; g.fillRect(tx, by - s * 0.75, s * 9, s * 0.75); for (let k = 0; k < 22; k++) { g.fillStyle = r(k + 40) < 0.8 ? 'rgba(255,230,170,0.9)' : 'rgba(255,230,170,0.3)'; g.fillRect(tx + s * 0.25 + k * s * 0.39, by - s * 0.6, s * 0.26, s * 0.25); } glowDisc(g, tx + s * 9, by - s * 0.4, s * 1.2, '#fde68a', 0.5);
      skyline(g, A, ground, '#0a1028', 1.5, 0.1, 3, true);
      for (const x of [0.07, 0.4, 0.66, 0.94]) truss(g, w * x, ground - s * (6 + r(x * 9) * 2.5), ground, s * 0.8, '#070b1c', Math.max(1, s * 0.06));
      for (const x of [0.07, 0.4, 0.66, 0.94]) light(g, w * x + s * 0.4, ground - s * (6 + r(x * 9) * 2.5), Math.max(1.5, s * 0.06), '#ef4444');
      fog(g, A, ground - s * 3, ground, '#5b4a9a', 0.35);
      break;
    }
    case 'mines': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#04020a'], [0.6, '#120822'], [1, '#2a1240']]); g.fillRect(0, 0, w, h);
      stars(g, A, 420, ground, 2);
      clouds(g, A, 0, ground * 0.85, '#3b1a6b', '#f472b6', 0.55, 5, 1.4, false); // nebulosa
      planet(g, A, w * 0.72, ground * 0.28, s * 3.4, 'gas', 4, '#e9d5ff');
      // asteroides que flotan
      for (let k = 0; k < 9; k++) { const cx = w * r(k + 30), cy = ground * (0.08 + r(k + 31) * 0.55), R = s * (0.25 + r(k + 32) ** 2 * 1.4); asteroid(g, A, cx, cy, R, k * 13); }
      // el asteroide grande donde está la mina (el horizonte de roca)
      mountains(g, A, { base: ground + s, height: s * 5.5, seed: 21, scale: 9, colors: [[0, '#6b5a86'], [0.5, '#3a2c52'], [1, '#170f24']], haze: '#2a1240', hazeK: 0.15, light: 1.4 });
      for (let k = 0; k < 4; k++) { // torres de perforación con luces
        const tx = w * (0.1 + k * 0.27 + r(k) * 0.05), tb = ground - s * (2.2 + r(k + 5) * 1.6), th = s * (3 + r(k + 6) * 2);
        g.strokeStyle = '#120a1c'; g.lineWidth = Math.max(1, s * 0.07); g.beginPath(); g.moveTo(tx - s * 0.8, tb); g.lineTo(tx, tb - th); g.lineTo(tx + s * 0.8, tb); for (let j = 1; j < 6; j++) { const yy = tb - th * j / 6, ww = s * 0.8 * (1 - j / 6); g.moveTo(tx - ww, yy); g.lineTo(tx + ww, yy - th / 6); } g.stroke();
        g.fillStyle = '#120a1c'; g.fillRect(tx - s * 1.2, tb - s * 0.6, s * 2.4, s * 0.6);
        light(g, tx, tb - th, Math.max(1.5, s * 0.07), '#f97316'); light(g, tx - s * 1, tb - s * 0.3, 1.5, '#38bdf8'); light(g, tx + s * 1, tb - s * 0.3, 1.5, '#38bdf8');
      }
      g.strokeStyle = '#140c20'; g.lineWidth = s * 0.18; g.beginPath(); g.moveTo(0, ground - s * 1.6); for (let x = 0; x <= w; x += s) g.lineTo(x, ground - s * (1.6 + Math.sin(x / s * 0.3) * 0.4)); g.stroke(); // tubería
      for (let k = 0; k < 14; k++) { const cx = w * r(k + 70), cy = ground - s * (0.3 + r(k + 71) * 2.5); const c = ['#c084fc', '#f472b6', '#38bdf8'][k % 3]; glowDisc(g, cx, cy, s * 0.9, c, 0.45); g.fillStyle = lighten(c, 0.3); g.beginPath(); g.moveTo(cx, cy - s * 0.4); g.lineTo(cx + s * 0.13, cy); g.lineTo(cx, cy + s * 0.15); g.lineTo(cx - s * 0.13, cy); g.fill(); } // cristales
      for (let k = 0; k < 5; k++) { const dx = w * r(k + 90), dy = ground * (0.2 + r(k + 91) * 0.4); g.fillStyle = '#2a2140'; g.fillRect(dx - s * 0.3, dy - s * 0.12, s * 0.6, s * 0.24); light(g, dx, dy + s * 0.15, 1.5, '#fde047'); } // drones
      fog(g, A, ground - s * 2.5, ground, '#3b1a6b', 0.4);
      break;
    }
    case 'base': {
      g.fillStyle = '#01020a'; g.fillRect(0, 0, w, h);
      stars(g, A, 520, ground, 3);
      clouds(g, A, 0, ground * 0.5, '#0b1340', '#3b4a9a', 0.35, 8, 1.6, false);
      // el sol con su destello
      const sx = w * 0.12, sy = ground * 0.14; glowDisc(g, sx, sy, s * 9, '#fff3c4', 0.35); glowDisc(g, sx, sy, s * 2.2, '#ffffff', 0.9); g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6 + 0.2; g.beginPath(); g.moveTo(sx - Math.cos(a) * s * 6, sy - Math.sin(a) * s * 6); g.lineTo(sx + Math.cos(a) * s * 6, sy + Math.sin(a) * s * 6); g.stroke(); } for (let k = 1; k < 5; k++) glowDisc(g, sx + (w * 0.5 - sx) * k * 0.3, sy + (ground - sy) * k * 0.3, s * (0.3 + k * 0.15), ['#a5f3fc', '#f0abfc', '#fde68a', '#93c5fd'][k - 1], 0.25); g.restore();
      // la Tierra, enorme, con el horizonte curvo
      planet(g, A, w * 0.55, ground + w * 0.55, w * 0.78, 'earth', 3, '#7dd3fc', [-0.5, -0.7, 0.5]);
      // la estación: viga principal, módulos y paneles solares
      const beamY = ground * 0.3;
      g.fillStyle = '#9aa4b5'; g.fillRect(0, beamY - s * 0.15, w, s * 0.3); truss(g, 0, beamY - s * 0.45, beamY + s * 0.45, s * 0.9, '#6b7486', Math.max(1, s * 0.04));
      const panel = (px: number, py: number, pw: number, ph: number) => { g.fillStyle = '#1e3a8a'; g.fillRect(px, py, pw, ph); g.strokeStyle = '#d4a017'; g.lineWidth = Math.max(1, s * 0.03); g.strokeRect(px, py, pw, ph); g.strokeStyle = 'rgba(147,197,253,0.4)'; g.lineWidth = 1; for (let x = px; x < px + pw; x += s * 0.35) { g.beginPath(); g.moveTo(x, py); g.lineTo(x, py + ph); g.stroke(); } for (let y = py; y < py + ph; y += s * 0.35) { g.beginPath(); g.moveTo(px, y); g.lineTo(px + pw, y); g.stroke(); } g.fillStyle = lin(g, px, py, px + pw, py + ph, [[0, 'rgba(255,255,255,0.18)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.08)']]); g.fillRect(px, py, pw, ph); };
      for (const px of [0.02, 0.2, 0.68, 0.86]) { panel(w * px, beamY - s * 3.4, s * 3.2, s * 2.8); panel(w * px, beamY + s * 0.6, s * 3.2, s * 2.8); g.fillStyle = '#6b7486'; g.fillRect(w * px + s * 1.5, beamY - s * 0.6, s * 0.2, s * 1.2); }
      const module = (mx: number, my: number, mw: number, mh: number) => { g.fillStyle = lin(g, 0, my, 0, my + mh, [[0, '#f1f5f9'], [0.4, '#cbd5e1'], [1, '#64748b']]); g.beginPath(); g.roundRect(mx, my, mw, mh, mh * 0.45); g.fill(); g.strokeStyle = 'rgba(30,41,59,0.6)'; g.lineWidth = 1; for (let x = mx + mh * 0.6; x < mx + mw - mh * 0.4; x += mh * 0.8) { g.beginPath(); g.moveTo(x, my); g.lineTo(x, my + mh); g.stroke(); } for (let k = 0; k < 3; k++) { g.fillStyle = '#0ea5e9'; g.fillRect(mx + mw * (0.25 + k * 0.22), my + mh * 0.35, mh * 0.18, mh * 0.18); } };
      module(w * 0.38, beamY - s * 0.9, s * 6, s * 1.8); module(w * 0.47, beamY - s * 3.6, s * 1.8, s * 2.6); module(w * 0.3, beamY + s * 0.5, s * 3, s * 1.4);
      for (let k = 0; k < 12; k++) light(g, w * (0.04 + k * 0.083), beamY + (k % 2 ? -1 : 1) * s * 0.45, 1.6, k % 3 ? '#ef4444' : '#22c55e');
      // una nave atracada
      const nx = w * 0.62, ny = beamY - s * 2.2; g.fillStyle = lin(g, 0, ny - s * 0.5, 0, ny + s * 0.5, [[0, '#e2e8f0'], [1, '#475569']]); g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + s * 3.2, ny - s * 0.4); g.lineTo(nx + s * 3.2, ny + s * 0.4); g.closePath(); g.fill(); glowDisc(g, nx + s * 3.3, ny, s * 0.7, '#38bdf8', 0.7);
      // baranda de la plataforma
      g.strokeStyle = '#334155'; g.lineWidth = Math.max(1, s * 0.07); g.beginPath(); g.moveTo(0, ground - s * 1.1); g.lineTo(w, ground - s * 1.1); g.stroke(); for (let x = 0; x < w; x += s * 1.2) { g.beginPath(); g.moveTo(x, ground - s * 1.1); g.lineTo(x, ground); g.stroke(); }
      break;
    }
    case 'ice': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#020617'], [0.5, '#0b1f4a'], [1, '#3d6aa5']]); g.fillRect(0, 0, w, h);
      stars(g, A, 260, ground * 0.6, 4);
      // aurora
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) for (let x = 0; x < w; x += 2) { const base = ground * (0.22 + b * 0.07) + Math.sin(x / (s * (5 + b * 2)) + b) * s * 1.6 + fbm(x / (s * 4), b, 30 + b, 3) * s * 2; const hgt = s * (3 + fbm(x / (s * 3), b + 2, 40, 3) * 4); const c = b === 1 ? '168,85,247' : '52,211,153'; const gr = g.createLinearGradient(0, base - hgt, 0, base); gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.75, `rgba(${c},${0.08 + 0.06 * Math.sin(x * 0.05)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x, base - hgt, 2, hgt); }
      g.restore();
      planet(g, A, w * 0.7, ground * 0.24, s * 2.4, 'ice', 6, '#e0f2fe');
      mountains(g, A, { base: ground - s * 1.6, height: s * 9, seed: 11, scale: 12, colors: [[0, '#9fb8d8'], [1, '#2f4a74']], snow: 4, haze: '#6f93c6', hazeK: 0.45 });
      mountains(g, A, { base: ground - s * 0.9, height: s * 6.5, seed: 12, scale: 8, colors: [[0, '#7f9cc4'], [1, '#1f3560']], snow: 3, haze: '#4f78b0', hazeK: 0.25 });
      // lago congelado que refleja
      g.fillStyle = lin(g, 0, ground - s * 0.9, 0, ground, [[0, '#9cc3ec'], [1, '#335c92']]); g.fillRect(0, ground - s * 0.9, w, s * 0.9); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 30; k++) g.fillRect(w * r(k + 50), ground - s * (0.1 + r(k + 51) * 0.7), s * (0.5 + r(k) * 2), 1);
      mountains(g, A, { base: ground, height: s * 3.6, seed: 13, scale: 4, colors: [[0, '#5c7fb3'], [1, '#14284b']], snow: 2, light: 1.5 });
      for (let k = 0; k < 9; k++) { const ix = w * r(k + 30), ih = s * (1.5 + r(k + 32) * 3.2), iw = s * (0.4 + r(k) * 0.5); g.fillStyle = lin(g, ix - iw, 0, ix + iw, 0, [[0, '#f0f9ff'], [0.45, '#a5d0f5'], [1, '#2a5486']]); g.beginPath(); g.moveTo(ix - iw, ground); g.lineTo(ix - iw * 0.1, ground - ih); g.lineTo(ix + iw, ground); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ix - iw * 0.6, ground); g.lineTo(ix - iw * 0.1, ground - ih); g.stroke(); } // cristales de hielo
      fog(g, A, ground - s * 3, ground, '#c7dcf5', 0.3);
      break;
    }
    case 'volcano': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#0a0202'], [0.45, '#3a0b05'], [0.8, '#8a240a'], [1, '#d4520f']]); g.fillRect(0, 0, w, h);
      clouds(g, A, 0, ground * 0.7, '#1c0806', '#ff6a1a', 0.6, 9, 1.2); // ceniza iluminada desde abajo
      const vx = w * 0.5, vh = s * 9.5, crater = ground - vh;
      plume(g, A, vx, crater + s * 0.5, ground * 0.75, s * 2.6, '#1b0c09', '#ff7a2a', 3);
      glowDisc(g, vx, crater, s * 5, '#ff7a1a', 0.55);
      mountains(g, A, { base: ground - s * 0.6, height: s * 5, seed: 41, scale: 10, colors: [[0, '#4a1a10'], [1, '#1a0604']], haze: '#6a1a08', hazeK: 0.4 });
      // el volcano: cono con textura de roca y ríos de lava
      layer(g, A, Math.max(0, crater - s), ground, (x, y) => {
        const dx = (x - vx) / (s * 9), edge = crater + vh * Math.pow(Math.max(0, Math.abs(dx) - 0.1), 0.75) - s * 0.6 * (fbm(x / (s * 1.2), 3, 7, 4) - 0.5);
        if (y < edge || Math.abs(dx) > 1.3) return null;
        const n = fbm(x / (s * 0.6), y / (s * 0.6), 5, 5), lit = dx < 0 ? 1.1 : 0.7;
        let c = ramp([[0, '#5a2414'], [0.5, '#2a0d07'], [1, '#120403']], (y - crater) / vh * 0.8 + (n - 0.5) * 0.4);
        c = [c[0] * lit, c[1] * lit, c[2] * lit];
        for (const off of [-0.18, 0.05, 0.3]) { const lx = off + Math.sin((y - crater) / (s * 1.7) + off * 9) * 0.07 + (y - crater) / vh * off * 0.9; const d = Math.abs(dx - lx) * 9 * (1.5 - (y - crater) / vh * 0.6); if (d < 1) c = mixRGB(c, ramp([[0, '#fff3b0'], [0.4, '#ff8a1a'], [1, '#b0200a']], d), 1 - d * d); } // ríos de lava
        const hot = Math.max(0, 1 - (y - crater) / (s * 1.4)); c = mixRGB(c, [255, 140, 40], hot * 0.8);
        return [c[0], c[1], c[2], 255];
      });
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,${140 + r(k) * 100},40,${0.6 + r(k + 1) * 0.4})`; g.beginPath(); g.arc(vx + (r(k + 1) - 0.5) * s * 5, crater - r(k + 2) * s * 5, s * (0.04 + r(k + 3) * 0.08), 0, TAU); g.fill(); } // erupción
      // pilares de roca adelante con cascadas de lava
      for (const sx of [0.1, 0.88]) { mountainsAt(g, A, w * sx, ground, s * 2.8, s * 7, 50 + sx * 10); const lx = w * sx + s * 0.2; g.fillStyle = lin(g, 0, ground - s * 5.5, 0, ground, [[0, '#fff3b0'], [0.25, '#ff8a1a'], [1, '#c2260c']]); g.fillRect(lx - s * 0.18, ground - s * 5.5, s * 0.36, s * 5.5); glowDisc(g, lx, ground - s * 2.5, s * 2.5, '#ff6a1a', 0.45); }
      g.fillStyle = lin(g, 0, ground - s * 0.6, 0, ground, [[0, 'rgba(255,120,30,0)'], [1, 'rgba(255,120,30,0.55)']]); g.fillRect(0, ground - s * 0.6, w, s * 0.6); // lago de lava en el horizonte
      fog(g, A, ground - s * 4, ground, '#ff5a1a', 0.25);
      break;
    }
    case 'forest': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#010409'], [0.5, '#06182c'], [1, '#0d3350']]); g.fillRect(0, 0, w, h);
      stars(g, A, 160, ground * 0.45, 5); glowDisc(g, w * 0.8, ground * 0.12, s * 6, '#a5f3fc', 0.2); planet(g, A, w * 0.8, ground * 0.12, s * 1.2, 'moon', 9, '#cffafe');
      g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const x0 = w * (0.55 + k * 0.08); g.fillStyle = lin(g, x0, 0, x0 - s * 6, ground, [[0, 'rgba(165,243,252,0.07)'], [1, 'rgba(165,243,252,0)']]); g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + s * 0.8, 0); g.lineTo(x0 - s * 5, ground); g.lineTo(x0 - s * 7, ground); g.fill(); } g.restore(); // rayos de luna
      const treeLine = (base: number, hgt: number, color: string, seed: number) => { g.fillStyle = color; g.beginPath(); g.moveTo(0, base + s); for (let x = 0; x <= w + s; x += s * 0.3) g.lineTo(x, base - hgt * (0.5 + fbm(x / (s * 2.5), seed, seed, 5) * 0.8)); g.lineTo(w, base + s); g.fill(); };
      treeLine(ground - s * 2, s * 8, '#0a2238', 1); fog(g, A, ground * 0.3, ground, '#155e75', 0.3);
      treeLine(ground - s, s * 5, '#071a2c', 2);
      // cascada a lo lejos
      const fx = w * 0.62; g.fillStyle = lin(g, fx, 0, fx + s * 1.2, 0, [[0, 'rgba(125,211,252,0.35)'], [0.5, 'rgba(224,242,254,0.75)'], [1, 'rgba(125,211,252,0.35)']]); g.fillRect(fx, ground * 0.25, s * 1.2, ground * 0.75); glowDisc(g, fx + s * 0.6, ground - s * 0.5, s * 3, '#bae6fd', 0.4);
      for (let k = 0; k < 12; k++) { const tx = w * r(k + 5), tw = s * (0.5 + r(k + 6) * 1.1); g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, '#0e2a40'], [0.3, '#123650'], [1, '#04101c']]); g.beginPath(); g.moveTo(tx - tw * 0.5, ground); g.quadraticCurveTo(tx, ground - s * 1.5, tx + tw * 0.1, 0); g.lineTo(tx + tw * 0.9, 0); g.quadraticCurveTo(tx + tw, ground - s * 1.5, tx + tw * 1.5, ground); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(tx + tw * (0.2 + j * 0.2), 0); g.lineTo(tx + tw * (0.15 + j * 0.2), ground); g.stroke(); } } // troncos con corteza
      const shroom = (x: number, base: number, hgt: number, capW: number, color: string) => {
        g.fillStyle = lin(g, x - capW * 0.1, 0, x + capW * 0.1, 0, [[0, '#d7f0ff'], [0.5, '#9fd2f2'], [1, '#4a8fc4']]); g.beginPath(); g.moveTo(x - capW * 0.09, base); g.quadraticCurveTo(x - capW * 0.13, base - hgt * 0.5, x - capW * 0.06, base - hgt); g.lineTo(x + capW * 0.06, base - hgt); g.quadraticCurveTo(x + capW * 0.13, base - hgt * 0.5, x + capW * 0.09, base); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(x, base - hgt * 0.7, capW * 0.07, capW * 0.03, 0, 0, TAU); g.fill(); // anillo
        glowDisc(g, x, base - hgt, capW * 0.95, color, 0.4);
        g.fillStyle = lin(g, 0, base - hgt - capW * 0.35, 0, base - hgt, [[0, lighten(color, 0.5)], [0.6, color], [1, darken(color, 0.35)]]); g.beginPath(); g.ellipse(x, base - hgt, capW / 2, capW * 0.32, 0, Math.PI, TAU); g.fill();
        g.fillStyle = darken(color, 0.55); g.beginPath(); g.ellipse(x, base - hgt, capW / 2, capW * 0.06, 0, 0, TAU); g.fill();
        g.strokeStyle = alpha(lighten(color, 0.4), 0.6); g.lineWidth = 1; for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(x + k * capW * 0.075, base - hgt); g.lineTo(x + k * capW * 0.02, base - hgt + capW * 0.05); g.stroke(); } // laminillas
        for (let k = 0; k < 9; k++) { const sx2 = x + (hash(k + x) - 0.5) * capW * 0.75, sy2 = base - hgt - hash(k + x + 1) * capW * 0.26; glowDisc(g, sx2, sy2, s * 0.25, '#ffffff', 0.5); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(sx2, sy2, s * 0.06, 0, TAU); g.fill(); }
      };
      shroom(w * 0.1, ground, s * 4.6, s * 4.2, '#38bdf8'); shroom(w * 0.36, ground, s * 6.6, s * 6.2, '#818cf8'); shroom(w * 0.88, ground, s * 5.2, s * 4.8, '#a78bfa'); shroom(w * 0.7, ground, s * 3, s * 2.6, '#22d3ee'); shroom(w * 0.24, ground, s * 2.2, s * 1.8, '#f0abfc');
      for (let k = 0; k < 26; k++) { g.strokeStyle = alpha(['#22d3ee', '#a3e635', '#f0abfc'][k % 3], 0.55); g.lineWidth = Math.max(1, s * 0.04); const vx = w * r(k + 200); g.beginPath(); g.moveTo(vx, 0); g.quadraticCurveTo(vx + s * 0.5, s * (1 + r(k) * 2), vx, s * (1.5 + r(k + 1) * 4)); g.stroke(); } // lianas que brillan
      for (let k = 0; k < 30; k++) { const px = w * r(k + 90), ph = s * (0.4 + r(k + 91) * 1.1), c = ['#f472b6', '#c084fc', '#22d3ee', '#a3e635'][k % 4]; glowDisc(g, px, ground - ph * 0.6, ph, c, 0.25); g.fillStyle = c; g.beginPath(); g.moveTo(px, ground); g.quadraticCurveTo(px - s * 0.35, ground - ph, px - s * 0.05, ground - ph * 1.1); g.quadraticCurveTo(px + s * 0.12, ground - ph * 0.5, px + s * 0.1, ground); g.fill(); }
      for (let k = 0; k < 50; k++) { const x = w * r(k + 120), y = ground * (0.2 + r(k + 121) * 0.75); glowDisc(g, x, y, 4, '#d9f99d', 0.6); }
      fog(g, A, ground - s * 2.5, ground, '#67e8f9', 0.2);
      break;
    }
    case 'factory': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#1a1024'], [0.45, '#5a2a2a'], [0.8, '#c2581c'], [1, '#f59e0b']]); g.fillRect(0, 0, w, h);
      glowDisc(g, w * 0.3, ground - s * 2.5, s * 10, '#fdba74', 0.5); glowDisc(g, w * 0.3, ground - s * 2.5, s * 1.8, '#fff7ed', 0.95); // sol entre el smog
      clouds(g, A, 0, ground * 0.6, '#3a2228', '#f59e0b', 0.5, 12, 1.3);
      // refinería lejana
      const far = '#4a2a2a';
      for (let k = 0; k < 16; k++) { const x = w * r(k + 10), bh = s * (1.5 + r(k + 11) * 3.5), bw = s * (1 + r(k + 12) * 2.5); g.fillStyle = far; g.fillRect(x, ground - s * 2 - bh, bw, bh + s * 2); if (r(k + 13) < 0.5) { g.beginPath(); g.ellipse(x + bw / 2, ground - s * 2 - bh, bw / 2, s * 0.4, 0, Math.PI, TAU); g.fill(); } }
      fog(g, A, ground * 0.4, ground - s * 1.5, '#d97706', 0.3);
      // torres de enfriamiento y chimeneas con humo
      for (const [cx, sc2] of [[0.62, 1], [0.78, 0.8]] as const) { const tx = w * cx, th = s * 7 * sc2, tw = s * 2.6 * sc2, tb = ground - s * 1.2; plume(g, A, tx, tb - th, ground * 0.55, tw * 0.7, '#d6c8bd', '#ffffff', cx * 10); g.fillStyle = lin(g, tx - tw, 0, tx + tw, 0, [[0, '#6b5a50'], [0.4, '#9a8a7e'], [1, '#3a2e28']]); g.beginPath(); g.moveTo(tx - tw, tb); g.quadraticCurveTo(tx - tw * 0.35, tb - th * 0.55, tx - tw * 0.55, tb - th); g.lineTo(tx + tw * 0.55, tb - th); g.quadraticCurveTo(tx + tw * 0.35, tb - th * 0.55, tx + tw, tb); g.fill(); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let j = 1; j < 5; j++) g.fillRect(tx - tw, tb - th * j / 5, tw * 2, 2); }
      for (const cx of [0.08, 0.2, 0.42, 0.93]) { const tx = w * cx, th = s * (6 + r(cx * 9) * 3), tb = ground - s; plume(g, A, tx, tb - th, ground * 0.5, s * 1.2, '#2a1e1e', '#f59e0b', cx * 20); g.fillStyle = lin(g, tx - s * 0.4, 0, tx + s * 0.4, 0, [[0, '#2a1e1a'], [0.4, '#5a4038'], [1, '#1a1210']]); g.fillRect(tx - s * 0.4, tb - th, s * 0.8, th); g.fillStyle = '#b91c1c'; g.fillRect(tx - s * 0.4, tb - th + s * 0.5, s * 0.8, s * 0.3); g.fillRect(tx - s * 0.4, tb - th + s * 1.3, s * 0.8, s * 0.3); light(g, tx, tb - th - s * 0.1, 1.6, '#ef4444'); }
      // naves de la fábrica con ventanas encendidas
      for (let k = 0; k < 5; k++) { const x = w * (k * 0.21 + r(k + 60) * 0.05), bw = s * (4 + r(k + 61) * 2), bh = s * (2.4 + r(k + 62) * 1.5), y = ground - bh; g.fillStyle = '#20140f'; g.fillRect(x, y, bw, bh); for (let j = 0; j < Math.floor(bw / (s * 1.2)); j++) { g.fillStyle = '#20140f'; g.beginPath(); g.moveTo(x + j * s * 1.2, y); g.lineTo(x + j * s * 1.2 + s * 1.2, y - s * 0.6); g.lineTo(x + j * s * 1.2 + s * 1.2, y); g.fill(); g.fillStyle = 'rgba(253,186,116,0.75)'; g.fillRect(x + j * s * 1.2 + s * 0.85, y - s * 0.45, s * 0.25, s * 0.4); } for (let i = 0; i < 6; i++) if (r(k * 9 + i) < 0.7) { g.fillStyle = 'rgba(253,200,120,0.85)'; g.fillRect(x + bw * (0.08 + i * 0.15), y + bh * 0.3, bw * 0.08, bh * 0.25); } }
      // grúa pórtico
      const gx = w * 0.5; g.strokeStyle = '#3a2410'; g.lineWidth = Math.max(1, s * 0.08); truss(g, gx - s * 6, ground - s * 6.5, ground, s * 0.6, '#3a2410', Math.max(1, s * 0.05)); truss(g, gx + s * 5.4, ground - s * 6.5, ground, s * 0.6, '#3a2410', Math.max(1, s * 0.05)); g.fillStyle = '#e0a812'; g.fillRect(gx - s * 6.4, ground - s * 7, s * 13, s * 0.55); hazardBand(g, gx - s * 6.4, ground - s * 7, s * 13, s * 0.55, s); g.strokeStyle = '#2a1a0a'; g.beginPath(); g.moveTo(gx + s * 1, ground - s * 6.45); g.lineTo(gx + s * 1, ground - s * 4); g.stroke(); g.fillStyle = '#4a3a2a'; g.fillRect(gx + s * 0.4, ground - s * 4, s * 1.2, s * 0.9);
      const robotArm = (bx: number, flip: number, sc2: number) => { g.save(); g.translate(bx, ground); g.scale(flip * sc2, sc2); g.lineCap = 'round'; for (const [c, wd] of [['#3b2a0a', s * 0.6], ['#e0a812', s * 0.46], ['rgba(255,240,180,0.6)', s * 0.1]] as const) { g.strokeStyle = c; g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.4, -s * 2.6); g.lineTo(s * 2.2, -s * 3.6); g.lineTo(s * 2.8, -s * 2.6); g.stroke(); } g.fillStyle = '#1a1a1a'; for (const [jx, jy] of [[s * 0.4, -s * 2.6], [s * 2.2, -s * 3.6]]) { g.beginPath(); g.arc(jx, jy, s * 0.3, 0, TAU); g.fill(); g.fillStyle = '#e0a812'; g.beginPath(); g.arc(jx, jy, s * 0.12, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; } g.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.45); g.restore(); glowDisc(g, bx + flip * s * 2.8 * sc2, ground - s * 2.6 * sc2, s * 0.8, '#fde68a', 0.6); }; // brazos robot soldando
      robotArm(w * 0.15, 1, 0.9); robotArm(w * 0.35, -1, 0.75); robotArm(w * 0.73, 1, 0.85);
      g.fillStyle = '#2a1e18'; g.fillRect(0, ground - s * 0.9, w, s * 0.25); for (let x = 0; x < w; x += s * 0.6) { g.fillStyle = '#3a2a20'; g.fillRect(x, ground - s * 0.9, s * 0.3, s * 0.25); } // cinta
      fog(g, A, ground - s * 3, ground, '#f59e0b', 0.2);
      break;
    }
    case 'storm': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#03050c'], [0.5, '#121a33'], [1, '#2a3557']]); g.fillRect(0, 0, w, h);
      clouds(g, A, 0, ground * 0.75, '#0f1428', '#8b9ad8', 0.75, 14, 1.2);
      const boltBg = (x: number, seed: number) => { g.save(); g.globalCompositeOperation = 'lighter'; glowDisc(g, x, ground * 0.25, s * 6, '#a5b4fc', 0.25); for (const [c, lw] of [['rgba(167,139,250,0.4)', s * 0.3], ['rgba(224,231,255,0.9)', Math.max(1.5, s * 0.06)]] as const) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); let px = x, py = 0; g.moveTo(px, py); while (py < ground * 0.7) { px += (hash(px + py + seed) - 0.5) * s * 1.4; py += s * 0.7; g.lineTo(px, py); if (hash(py + seed) < 0.15) { g.moveTo(px, py); g.lineTo(px + s * 1.2, py + s * 1.4); g.moveTo(px, py); } } g.stroke(); } g.restore(); };
      boltBg(w * 0.12, 1); boltBg(w * 0.6, 2); boltBg(w * 0.86, 3);
      // el mar con olas a lo lejos
      g.fillStyle = lin(g, 0, ground - s * 2.2, 0, ground, [[0, '#1c2744'], [1, '#0a1022']]); g.fillRect(0, ground - s * 2.2, w, s * 2.2); g.strokeStyle = 'rgba(165,180,252,0.25)'; g.lineWidth = 1; for (let k = 0; k < 40; k++) { const x = w * r(k + 80), y = ground - s * (0.2 + r(k + 81) * 1.9); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.4, y - 2, x + s * 0.8, y); g.stroke(); }
      // acantilados con un castillo gótico
      mountains(g, A, { base: ground - s * 1.2, height: s * 4.5, seed: 61, scale: 6, colors: [[0, '#2a3048'], [1, '#0b0e1a']], light: 1.3 });
      for (let k = 0; k < 7; k++) { const tx = w * (0.04 + k * 0.155), tw = s * (1.2 + r(k) * 0.9), th = s * (5 + r(k + 3) * 5), tb = ground - s * 2.5; g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, '#161c32'], [0.3, '#0e1224'], [1, '#05070f']]); g.fillRect(tx, tb - th, tw, th + s * 2.5); g.beginPath(); g.moveTo(tx - s * 0.25, tb - th); g.lineTo(tx + tw / 2, tb - th - s * 2.2); g.lineTo(tx + tw + s * 0.25, tb - th); g.fill(); for (let j = 0; j < 5; j++) { g.fillStyle = '#0e1224'; g.fillRect(tx - s * 0.15 + j * tw * 0.3, tb - th - s * 0.1, tw * 0.15, s * 0.3); } for (let j = 0; j < 5; j++) if (r(k * 5 + j) < 0.55) { glowDisc(g, tx + tw * 0.5, tb - th + s * (1 + j * 1.2), s * 0.6, '#fbbf24', 0.35); g.fillStyle = '#fcd34d'; g.beginPath(); g.roundRect(tx + tw * 0.4, tb - th + s * (0.8 + j * 1.2), tw * 0.2, s * 0.45, [s * 0.1, s * 0.1, 0, 0]); g.fill(); } }
      fog(g, A, ground - s * 4, ground, '#3b4a7a', 0.35);
      break;
    }
    case 'temple': {
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#0b2a2e'], [0.5, '#3f7a5a'], [0.85, '#d8b45a'], [1, '#f2d38a']]); g.fillRect(0, 0, w, h);
      glowDisc(g, w * 0.5, ground * 0.62, s * 9, '#fff1c1', 0.5);
      clouds(g, A, 0, ground * 0.55, '#5a8a6a', '#fff1c1', 0.45, 17, 1.4);
      mountains(g, A, { base: ground - s * 2, height: s * 8, seed: 71, scale: 9, colors: [[0, '#5f8f78'], [1, '#2e5848']], haze: '#bcd8b0', hazeK: 0.55 });
      // la pirámide escalonada con su templo arriba
      const px = w * 0.5, pb = ground - s * 1.5, levels = 7, pw = s * 16, ph = s * 8.5;
      for (let i = 0; i < levels; i++) { const lw2 = pw * (1 - i / levels * 0.78), y = pb - ph * (i + 1) / levels, lh = ph / levels; g.fillStyle = lin(g, px - lw2 / 2, 0, px + lw2 / 2, 0, [[0, '#8a8466'], [0.45, '#6a6650'], [1, '#3e3c2e']]); g.fillRect(px - lw2 / 2, y, lw2, lh); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - lw2 / 2, y + lh - 2, lw2, 2); g.fillStyle = 'rgba(255,240,200,0.15)'; g.fillRect(px - lw2 / 2, y, lw2, 2); for (let x = px - lw2 / 2; x < px + lw2 / 2; x += s * 0.6) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 1, lh); } for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,120,50,0.7)'; g.beginPath(); g.ellipse(px - lw2 / 2 + hash(i * 7 + k) * lw2, y + 2, s * (0.3 + hash(k + i) * 0.5), s * 0.15, 0, 0, TAU); g.fill(); } } // escalones con musgo
      g.fillStyle = lin(g, px - s * 1.2, 0, px + s * 1.2, 0, [[0, '#7a7458'], [1, '#4a4636']]); g.beginPath(); g.moveTo(px - s * 1.6, pb); g.lineTo(px - s * 0.9, pb - ph); g.lineTo(px + s * 0.9, pb - ph); g.lineTo(px + s * 1.6, pb); g.fill(); for (let y = pb; y > pb - ph; y -= s * 0.25) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(px - s * 1.6, y, s * 3.2, 1); } // escalera
      const sh = pb - ph; g.fillStyle = '#4a4636'; g.fillRect(px - s * 1.8, sh - s * 2, s * 3.6, s * 2); g.fillStyle = '#1a1810'; g.fillRect(px - s * 0.6, sh - s * 1.5, s * 1.2, s * 1.5); g.fillStyle = '#5a5642'; g.beginPath(); g.moveTo(px - s * 2.1, sh - s * 2); g.lineTo(px, sh - s * 2.9); g.lineTo(px + s * 2.1, sh - s * 2); g.fill(); // santuario
      for (const fxp of [-1.4, 1.4]) { glowDisc(g, px + fxp * s, sh - s * 2.4, s * 1.4, '#fb923c', 0.55); g.fillStyle = '#fde68a'; g.beginPath(); g.moveTo(px + fxp * s - s * 0.15, sh - s * 2); g.quadraticCurveTo(px + fxp * s, sh - s * 2.9, px + fxp * s + s * 0.15, sh - s * 2); g.fill(); }
      fog(g, A, ground * 0.45, ground - s, '#e8dca0', 0.3);
      // cascadas desde los acantilados, a los costados
      for (const sx of [0.2, 0.8]) { mountainsAt(g, A, w * sx, ground, s * 4.5, s * 8, sx * 40, ['#4a6a48', '#1e3420']); const fx = w * sx - s * 0.4; g.fillStyle = lin(g, fx, 0, fx + s * 0.9, 0, [[0, 'rgba(186,230,253,0.55)'], [0.5, 'rgba(240,249,255,0.9)'], [1, 'rgba(125,211,252,0.55)']]); g.fillRect(fx, ground - s * 6.5, s * 0.9, s * 6.5); glowDisc(g, fx + s * 0.45, ground - s * 0.3, s * 1.8, '#e0f2fe', 0.5); }
      // copas de los árboles adelante
      for (let layer2 = 0; layer2 < 2; layer2++) for (let k = 0; k < 20; k++) { // copas con muchas hojas, luz arriba a la izquierda
        const cx = w * r(k + layer2 * 40), cy = s * (0.3 + r(k + 3) * 2) + layer2 * s * 0.9, rr = s * (1.4 + r(k + 7) * 1.8);
        g.fillStyle = layer2 ? '#0d2c18' : '#163f24'; g.beginPath(); g.arc(cx, cy, rr * 0.9, 0, TAU); g.fill();
        for (let j = 0; j < 46; j++) { const a2 = hash(j * 3.3 + k) * TAU, d2 = Math.sqrt(hash(j * 5.1 + k)) * rr, lx = cx + Math.cos(a2) * d2, ly = cy + Math.sin(a2) * d2 * 0.85, lit = Math.max(0, -(Math.cos(a2) + Math.sin(a2)) * 0.5) * (d2 / rr);
          g.fillStyle = `rgb(${Math.round((layer2 ? 22 : 34) + lit * 70)},${Math.round((layer2 ? 70 : 96) + lit * 110)},${Math.round((layer2 ? 36 : 44) + lit * 40)})`; g.beginPath(); g.ellipse(lx, ly, s * (0.22 + hash(j + k) * 0.2), s * 0.12, a2, 0, TAU); g.fill(); }
      }
      for (let k = 0; k < 30; k++) { g.strokeStyle = '#1f5130'; g.lineWidth = Math.max(1, s * 0.06); const vx = w * r(k + 200); g.beginPath(); g.moveTo(vx, 0); g.quadraticCurveTo(vx + s * 0.4, s * (1.5 + r(k) * 2), vx, s * (2.5 + r(k + 1) * 4)); g.stroke(); g.fillStyle = '#2f7a3a'; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(vx + s * 0.1, s * (1 + j * 0.9 + r(k) * 2), s * 0.15, s * 0.07, 0.6, 0, TAU); g.fill(); } }
      const head = (cx: number, base: number, sz: number) => { const hd = '#6b6a50'; g.fillStyle = lin(g, cx - sz * 0.5, 0, cx + sz * 0.5, 0, [[0, lighten(hd, 0.15)], [1, darken(hd, 0.4)]]); g.beginPath(); g.roundRect(cx - sz * 0.5, base - sz * 1.2, sz, sz * 1.2, sz * 0.15); g.fill(); g.fillStyle = darken(hd, 0.35); g.fillRect(cx - sz * 0.55, base - sz * 1.25, sz * 1.1, sz * 0.2); g.fillRect(cx - sz * 0.35, base - sz * 0.85, sz * 0.25, sz * 0.12); g.fillRect(cx + sz * 0.1, base - sz * 0.85, sz * 0.25, sz * 0.12); g.fillRect(cx - sz * 0.08, base - sz * 0.75, sz * 0.16, sz * 0.25); g.fillRect(cx - sz * 0.25, base - sz * 0.38, sz * 0.5, sz * 0.1); g.fillStyle = 'rgba(70,120,50,0.6)'; g.beginPath(); g.ellipse(cx + sz * 0.2, base - sz * 1.15, sz * 0.25, sz * 0.08, 0, 0, TAU); g.fill(); glowDisc(g, cx - sz * 0.22, base - sz * 0.79, sz * 0.15, '#7dd3fc', 0.6); glowDisc(g, cx + sz * 0.22, base - sz * 0.79, sz * 0.15, '#7dd3fc', 0.6); }; // cabezas de piedra
      head(w * 0.07, ground, s * 2.4); head(w * 0.93, ground, s * 2.2);
      fog(g, A, ground - s * 2, ground, '#cfe6b8', 0.25);
      break;
    }
    case 'moon': {
      g.fillStyle = '#010205'; g.fillRect(0, 0, w, h);
      stars(g, A, 650, ground, 7);
      clouds(g, A, 0, ground * 0.6, '#0b1030', '#3b4a8a', 0.3, 21, 1.6, false); // vía láctea
      planet(g, A, w * 0.66, ground * 0.3, s * 3.8, 'earth', 5, '#7dd3fc', [-0.8, -0.2, 0.55]);
      glowDisc(g, w * 0.15, ground * 0.1, s * 6, '#fff7e0', 0.35); glowDisc(g, w * 0.15, ground * 0.1, s * 1, '#ffffff', 1);
      mountains(g, A, { base: ground - s * 1.4, height: s * 5, seed: 81, scale: 7, colors: [[0, '#a8aab2'], [1, '#3a3c44']], light: 1.8 });
      layer(g, A, ground - s * 2.2, ground, (x, y) => { // la llanura con cráteres
        const n = fbm(x / (s * 1.5), y / (s * 0.5), 31, 5); let c = ramp([[0, '#8e9099'], [1, '#4a4c55']], (y - (ground - s * 2.2)) / (s * 2.2) * 0.7 + (n - 0.5) * 0.4);
        for (let k = 0; k < 14; k++) { const cx = hash(k + 5) * w, cy = ground - s * (0.3 + hash(k + 6) * 1.7), rx = s * (0.4 + hash(k + 7) * 1.4), ry = rx * 0.22, dd = Math.hypot((x - cx) / rx, (y - cy) / ry); if (dd < 1) c = mixRGB(c, dd > 0.75 ? [190, 192, 200] : (y < cy ? [40, 42, 50] : [130, 132, 140]), 0.55); }
        return [c[0], c[1], c[2], 255];
      });
      const dome = (cx: number, rr: number) => { const b = ground - s * 0.4; g.fillStyle = '#4b5563'; g.fillRect(cx - rr, b - s * 0.4, rr * 2, s * 0.45); const dg = g.createRadialGradient(cx - rr * 0.3, b - s * 0.4 - rr * 0.6, 0, cx, b - s * 0.4, rr); dg.addColorStop(0, 'rgba(224,242,254,0.95)'); dg.addColorStop(0.6, 'rgba(56,189,248,0.6)'); dg.addColorStop(1, 'rgba(30,64,175,0.8)'); g.fillStyle = dg; g.beginPath(); g.arc(cx, b - s * 0.4, rr, Math.PI, TAU); g.fill(); g.strokeStyle = 'rgba(203,213,225,0.7)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(cx, b - s * 0.4, rr * k / 4, Math.PI, TAU); g.stroke(); } glowDisc(g, cx, b - s * 0.6, rr, '#38bdf8', 0.2); };
      dome(w * 0.12, s * 1.4); dome(w * 0.86, s * 1.8); dome(w * 0.93, s * 0.9);
      for (const x of [0.3, 0.56]) { const tx = w * x, b = ground - s * 0.5; g.fillStyle = lin(g, tx - s * 0.6, 0, tx + s * 0.6, 0, [[0, '#cbd5e1'], [1, '#475569']]); g.fillRect(tx - s * 0.6, b - s * 3.4, s * 1.2, s * 3.4); g.fillStyle = '#38bdf8'; g.fillRect(tx - s * 0.35, b - s * 2.8, s * 0.7, s * 0.9); g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(tx, b - s * 3.4, s * 0.6, Math.PI, TAU); g.fill(); light(g, tx, b - s * 4.1, 1.6, '#ef4444'); g.strokeStyle = '#94a3b8'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, b - s * 4); g.lineTo(tx, b - s * 4.1); g.stroke(); }
      const dx = w * 0.43, db = ground - s * 0.6; g.strokeStyle = '#94a3b8'; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); g.moveTo(dx, db); g.lineTo(dx, db - s * 1.4); g.stroke(); g.fillStyle = lin(g, dx - s, 0, dx + s, 0, [[0, '#e2e8f0'], [1, '#64748b']]); g.beginPath(); g.ellipse(dx, db - s * 1.8, s * 1, s * 0.5, -0.5, 0, Math.PI); g.fill(); // antena
      g.fillStyle = '#9ca3af'; g.fillRect(w * 0.72, ground - s * 0.9, s * 1.6, s * 0.5); g.fillStyle = '#374151'; for (const k of [0, 1, 2]) { g.beginPath(); g.arc(w * 0.72 + s * (0.2 + k * 0.6), ground - s * 0.35, s * 0.18, 0, TAU); g.fill(); } // vehículo lunar
      break;
    }
  }
}
// Una roca grande que flota (asteroide), con cráteres y luz de un costado.
function asteroid(g: Ctx, A: Area, cx: number, cy: number, R: number, seed: number) {
  layer(g, A, Math.max(0, cy - R * 1.3), Math.min(A.h, cy + R * 1.3), (x, y) => {
    const dx = (x - cx) / R, dy = (y - cy) / R, a = Math.atan2(dy, dx), edge = 0.85 + fbm(Math.cos(a) * 1.5 + 3, Math.sin(a) * 1.5, seed, 4) * 0.35, d = Math.hypot(dx, dy) / edge;
    if (d > 1) return null;
    const nz = Math.sqrt(1 - Math.min(1, d * d)), lit = Math.max(0.08, -dx * 0.55 - dy * 0.45 + nz * 0.7), n = fbm(dx * 4 + seed, dy * 4, seed + 1, 4);
    const c = ramp([[0, '#2a1f3a'], [0.5, '#6b5a86'], [1, '#b8a9d0']], lit * 0.8 + (n - 0.5) * 0.4);
    return [c[0], c[1], c[2], d > 0.96 ? 160 : 255];
  }, Math.max(1, Math.min(A.res, Math.round(R / 30))));
}
// Una peña o acantilado alto (con cima irregular) parado en el piso.
function mountainsAt(g: Ctx, A: Area, cx: number, base: number, halfW: number, hgt: number, seed: number, colors: [string, string] = ['#3a1408', '#120402']) {
  layer(g, A, Math.max(0, base - hgt * 1.1), base, (x, y) => {
    const dx = (x - cx) / halfW; if (Math.abs(dx) > 1) return null;
    const top = base - hgt * (1 - dx * dx * 0.5) * (0.8 + fbm(x / (A.s * 0.8), 1, seed, 4) * 0.4);
    if (y < top) return null;
    const n = fbm(x / (A.s * 0.4), y / (A.s * 0.4), seed + 2, 4), lit = dx < -0.2 ? 1.2 : dx > 0.4 ? 0.65 : 0.9;
    const c = ramp([[0, colors[0]], [1, colors[1]]], (y - top) / hgt * 0.6 + (n - 0.5) * 0.5);
    return [c[0] * lit, c[1] * lit, c[2] * lit, 255];
  }, Math.min(2, A.res));
}
function hazardBand(g: Ctx, x: number, y: number, w: number, h: number, s: number) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#111';
  for (let k = -h; k < w; k += s * 0.6) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + s * 0.3, y + h); g.lineTo(x + k + s * 0.3 + h, y); g.lineTo(x + k + h, y); g.fill(); }
  g.restore();
}
