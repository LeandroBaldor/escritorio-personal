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
// Edificios de una ciudad: con volumen (frente con luz, costado en sombra), pisos y columnas marcados, ventanas
// con marco (encendidas, con cortina o reflejando el cielo), equipos en la terraza, antenas, tanques de agua y
// carteles de neón.
function skyline(g: Ctx, A: Area, base: number, color: string, scale: number, lit: number, seed: number, neon: boolean) {
  const s = A.s; let x = -s;
  const r = (n: number) => hash(n * 1.37 + seed * 11.1);
  const sky = lighten(color, 0.22), deep = darken(color, 0.45);
  while (x < A.w + s) {
    const bw = s * (1 + r(x) * 2.2) * scale, bh = s * (3 + r(x * 1.3) * 8) * scale, top = base - bh, side = bw * 0.16;
    // costado en sombra (da volumen)
    g.fillStyle = deep; g.beginPath(); g.moveTo(x + bw, top); g.lineTo(x + bw + side, top + side * 0.5); g.lineTo(x + bw + side, base + s); g.lineTo(x + bw, base + s); g.fill();
    // frente: más claro arriba (reflejo del cielo) y con luz de un costado
    g.fillStyle = lin(g, 0, top, 0, base, [[0, sky], [0.35, color], [1, darken(color, 0.25)]]); g.fillRect(x, top, bw, bh + s);
    g.fillStyle = lin(g, x, 0, x + bw, 0, [[0, 'rgba(255,255,255,0.07)'], [0.3, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.18)']]); g.fillRect(x, top, bw, bh + s);
    g.fillStyle = lighten(color, 0.3); g.fillRect(x, top, bw, Math.max(1, s * 0.05 * scale)); // borde de la terraza
    const style = r(x * 5.3);
    if (style < 0.3) { g.fillStyle = 'rgba(255,255,255,0.05)'; for (let yy = top + s * 0.5 * scale; yy < base; yy += s * 0.64 * scale) g.fillRect(x, yy, bw, Math.max(1, s * 0.04)); } // franjas de los pisos
    else if (style < 0.55) { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let xx = x + bw * 0.25; xx < x + bw; xx += bw * 0.25) g.fillRect(xx, top, Math.max(1, s * 0.05), bh); } // columnas
    if (r(x * 2.7) < 0.35) { g.fillStyle = color; g.fillRect(x + bw * 0.2, top - s * 0.8 * scale, bw * 0.5, s * 0.8 * scale); g.fillStyle = lighten(color, 0.15); g.fillRect(x + bw * 0.2, top - s * 0.8 * scale, bw * 0.5, Math.max(1, s * 0.04)); }
    for (let k = 0; k < 3; k++) if (r(x * 6.1 + k) < 0.4) { g.fillStyle = darken(color, 0.2); g.fillRect(x + bw * (0.1 + k * 0.3), top - s * 0.25 * scale, s * 0.35 * scale, s * 0.25 * scale); } // equipos en la terraza
    if (r(x * 3.3) < 0.2) { g.fillStyle = color; const tx = x + bw * 0.6; g.fillRect(tx, top - s * 0.9 * scale, s * 0.5 * scale, s * 0.5 * scale); g.fillRect(tx + s * 0.05 * scale, top - s * 0.4 * scale, Math.max(1, s * 0.05), s * 0.4 * scale); g.fillRect(tx + s * 0.4 * scale, top - s * 0.4 * scale, Math.max(1, s * 0.05), s * 0.4 * scale); } // tanque de agua
    if (r(x * 2.1) < 0.35) { g.fillStyle = color; g.fillRect(x + bw * 0.45, top - s * 2.2 * scale, Math.max(1, s * 0.06), s * 2.2 * scale); g.fillStyle = '#ff3b3b'; g.fillRect(x + bw * 0.45 - 1, top - s * 2.2 * scale, 3, 3); glowDisc(g, x + bw * 0.45, top - s * 2.2 * scale, s * 0.5, '#ff3b3b', 0.4); }
    if (lit > 0) {
      const ww = s * 0.12 * scale, wh = s * 0.15 * scale;
      for (let yy = top + s * 0.35 * scale; yy < base - s * 0.2; yy += s * 0.32 * scale) for (let xx = x + s * 0.14 * scale; xx < x + bw - s * 0.14 * scale; xx += s * 0.26 * scale) {
        const q = r(xx * 3.3 + yy * 1.7);
        if (q < lit) { const warm = r(xx) < 0.65, a = 0.45 + r(xx + yy) * 0.55; g.fillStyle = `rgba(${warm ? '255,205,130' : '160,215,255'},${a})`; g.fillRect(xx, yy, ww, wh); if (q < lit * 0.35) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(xx, yy, ww, wh * 0.45); } if (ww > 3) { g.fillStyle = `rgba(${warm ? '255,240,210' : '230,245,255'},${a})`; g.fillRect(xx, yy + wh * 0.6, ww, Math.max(1, wh * 0.12)); } }
        else if (ww > 2.5) { g.fillStyle = q < lit + 0.25 ? 'rgba(120,150,220,0.16)' : 'rgba(0,0,0,0.22)'; g.fillRect(xx, yy, ww, wh); }
      }
    }
    if (neon && r(x * 4.1) < 0.4) { const nc = ['#f472b6', '#22d3ee', '#a78bfa', '#f87171', '#facc15'][Math.floor(r(x) * 5)], ny = top + bh * (0.2 + r(x + 2) * 0.45), vert = r(x + 5) < 0.5; const nw = vert ? s * 0.45 * scale : bw * 0.6, nh = vert ? s * 2.2 * scale : s * 0.8 * scale; glowDisc(g, x + bw / 2, ny + nh / 2, Math.max(nw, nh) * 1.4, nc, 0.35); g.fillStyle = darken(nc, 0.6); g.fillRect(x + (bw - nw) / 2 - 2, ny - 2, nw + 4, nh + 4); g.fillStyle = nc; g.fillRect(x + (bw - nw) / 2, ny, nw, nh); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + (bw - nw) / 2, ny, nw, Math.max(1, nh * 0.12)); g.fillStyle = 'rgba(0,0,0,0.45)'; for (let k = 0; k < 4; k++) { if (vert) g.fillRect(x + (bw - nw) / 2 + nw * 0.2, ny + nh * (0.1 + k * 0.22), nw * 0.6, nh * 0.1); else g.fillRect(x + (bw - nw) / 2 + nw * (0.08 + k * 0.23), ny + nh * 0.25, nw * 0.15, nh * 0.5); } }
    x += bw + side + s * 0.12 * r(x);
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
      skyline(g, A, ground - s * 3.4, '#243066', 0.75, 0.35, 1, false); fog(g, A, ground * 0.35, ground - s * 3, '#3a3d7a', 0.55);
      skyline(g, A, ground - s * 2.4, '#1a2450', 1.05, 0.28, 2, true); fog(g, A, ground * 0.5, ground - s * 2, '#2a2a5a', 0.35);
      for (const [x, y] of [[0.14, 0.18], [0.56, 0.3], [0.86, 0.12]] as const) { const sx = w * x, sy = ground * y; glowDisc(g, sx, sy + s * 0.4, s * 1.8, '#f43f5e', 0.25); g.fillStyle = lin(g, 0, sy - s * 0.3, 0, sy + s * 0.25, [[0, '#4a5375'], [1, '#1c2238']]); g.beginPath(); g.ellipse(sx, sy, s * 1.1, s * 0.25, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(125,211,252,0.85)'; g.beginPath(); g.ellipse(sx, sy - s * 0.18, s * 0.42, s * 0.25, 0, Math.PI, TAU); g.fill(); for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#fbbf24' : '#f87171'; g.fillRect(sx + k * s * 0.3 - 1, sy - 1, 3, 3); } } // naves
      // puente del tren elevado con el tren
      const by = ground - s * 4.6;
      g.fillStyle = '#0d1430'; g.fillRect(0, by, w, s * 0.35); for (let x = s; x < w; x += s * 4) { g.fillRect(x, by, s * 0.35, ground - by); g.beginPath(); g.moveTo(x - s * 1.5, by + s * 0.35); g.quadraticCurveTo(x + s * 0.17, by + s * 1.6, x + s * 1.85, by + s * 0.35); g.lineWidth = s * 0.12; g.strokeStyle = '#0d1430'; g.stroke(); }
      const tx = w * 0.3; g.fillStyle = '#1e2a52'; g.fillRect(tx, by - s * 0.75, s * 9, s * 0.75); for (let k = 0; k < 22; k++) { g.fillStyle = r(k + 40) < 0.8 ? 'rgba(255,230,170,0.9)' : 'rgba(255,230,170,0.3)'; g.fillRect(tx + s * 0.25 + k * s * 0.39, by - s * 0.6, s * 0.26, s * 0.25); } glowDisc(g, tx + s * 9, by - s * 0.4, s * 1.2, '#fde68a', 0.5);
      skyline(g, A, ground, '#0c1332', 1.5, 0.14, 3, true);
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
      const panel = (px: number, py: number, pw: number, ph: number) => { // panel solar: celdas con brillo, marco dorado y el reflejo del sol
        g.fillStyle = '#0b1640'; g.fillRect(px - s * 0.06, py - s * 0.06, pw + s * 0.12, ph + s * 0.12);
        const cs = s * 0.35; for (let x = px; x < px + pw - 1; x += cs) for (let y = py; y < py + ph - 1; y += cs) { const q = hash(x * 0.37 + y * 0.71); g.fillStyle = lin(g, x, y, x + cs, y + cs, [[0, q < 0.5 ? '#2d4fb8' : '#2547a8'], [0.6, '#16307e'], [1, '#0e2160']]); g.fillRect(x + 0.5, y + 0.5, Math.min(cs, px + pw - x) - 1, Math.min(cs, py + ph - y) - 1); g.fillStyle = 'rgba(180,210,255,0.22)'; g.fillRect(x + 1, y + 1, Math.min(cs, px + pw - x) * 0.45, 1); }
        g.strokeStyle = '#d4a017'; g.lineWidth = Math.max(1, s * 0.04); g.strokeRect(px, py, pw, ph);
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = lin(g, px, py, px + pw, py + ph, [[0, 'rgba(255,240,200,0.28)'], [0.35, 'rgba(255,255,255,0)'], [0.8, 'rgba(140,190,255,0.05)'], [1, 'rgba(255,255,255,0.12)']]); g.fillRect(px, py, pw, ph); g.restore(); };
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
      for (let k = 0; k < 5; k++) { const x = w * (k * 0.21 + r(k + 60) * 0.05), bw = s * (4 + r(k + 61) * 2), bh = s * (2.4 + r(k + 62) * 1.5), y = ground - bh; g.fillStyle = lin(g, 0, y, 0, ground, [[0, '#4a2c1c'], [0.4, '#2c1a12'], [1, '#150c08']]); g.fillRect(x, y, bw, bh); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let xx = x; xx < x + bw; xx += s * 0.3) g.fillRect(xx, y, 1, bh); g.fillStyle = 'rgba(255,170,80,0.35)'; g.fillRect(x, y, bw, Math.max(1, s * 0.05)); for (let j = 0; j < Math.floor(bw / (s * 1.2)); j++) { g.fillStyle = '#20140f'; g.beginPath(); g.moveTo(x + j * s * 1.2, y); g.lineTo(x + j * s * 1.2 + s * 1.2, y - s * 0.6); g.lineTo(x + j * s * 1.2 + s * 1.2, y); g.fill(); g.fillStyle = 'rgba(253,186,116,0.75)'; g.fillRect(x + j * s * 1.2 + s * 0.85, y - s * 0.45, s * 0.25, s * 0.4); } for (let i = 0; i < 6; i++) if (r(k * 9 + i) < 0.7) { g.fillStyle = 'rgba(253,200,120,0.85)'; g.fillRect(x + bw * (0.08 + i * 0.15), y + bh * 0.3, bw * 0.08, bh * 0.25); } }
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
      for (let k = 0; k < 7; k++) { const tx = w * (0.04 + k * 0.155), tw = s * (1.2 + r(k) * 0.9), th = s * (5 + r(k + 3) * 5), tb = ground - s * 2.5; g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, '#2a3252'], [0.25, '#1a2038'], [1, '#070910']]); g.fillRect(tx, tb - th, tw, th + s * 2.5);
        for (let yy = tb - th, row = 0; yy < ground; yy += s * 0.28, row++) for (let xx = tx + (row % 2) * s * 0.25; xx < tx + tw; xx += s * 0.5) { g.fillStyle = `rgba(${hash(xx + yy) < 0.5 ? '0,0,0,0.22' : '150,165,220,0.06'})`; g.fillRect(xx, yy, Math.min(s * 0.48, tx + tw - xx), Math.max(1, s * 0.03)); g.fillRect(xx, yy, Math.max(1, s * 0.02), s * 0.28); } // piedras
        g.fillStyle = 'rgba(165,180,252,0.18)'; g.fillRect(tx, tb - th, Math.max(1, s * 0.06), th); // borde con la luz de los rayos
        g.fillStyle = lin(g, tx - s * 0.25, 0, tx + tw + s * 0.25, 0, [[0, '#2a3456'], [0.5, '#151a30'], [1, '#05070f']]); g.beginPath(); g.moveTo(tx - s * 0.25, tb - th); g.lineTo(tx + tw / 2, tb - th - s * 2.2); g.lineTo(tx + tw + s * 0.25, tb - th); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (let j = 1; j < 6; j++) { const yy = tb - th - s * 2.2 * (1 - j / 6), hw = (tw / 2 + s * 0.25) * j / 6; g.beginPath(); g.moveTo(tx + tw / 2 - hw, yy); g.lineTo(tx + tw / 2 + hw, yy); g.stroke(); } // tejas
        g.fillStyle = '#0e1224'; g.fillRect(tx + tw / 2 - 1, tb - th - s * 2.9, 2, s * 0.7); for (let j = 0; j < 5; j++) { g.fillStyle = '#0e1224'; g.fillRect(tx - s * 0.15 + j * tw * 0.3, tb - th - s * 0.1, tw * 0.15, s * 0.3); } for (let j = 0; j < 5; j++) if (r(k * 5 + j) < 0.55) { glowDisc(g, tx + tw * 0.5, tb - th + s * (1 + j * 1.2), s * 0.6, '#fbbf24', 0.35); g.fillStyle = '#fcd34d'; g.beginPath(); g.roundRect(tx + tw * 0.4, tb - th + s * (0.8 + j * 1.2), tw * 0.2, s * 0.45, [s * 0.1, s * 0.1, 0, 0]); g.fill(); } }
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
      for (let i = 0; i < levels; i++) { const lw2 = pw * (1 - i / levels * 0.78), y = pb - ph * (i + 1) / levels, lh = ph / levels; g.fillStyle = lin(g, px - lw2 / 2, 0, px + lw2 / 2, 0, [[0, '#8a8466'], [0.45, '#6a6650'], [1, '#3e3c2e']]); g.fillRect(px - lw2 / 2, y, lw2, lh); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - lw2 / 2, y + lh - 2, lw2, 2); g.fillStyle = 'rgba(255,240,200,0.15)'; g.fillRect(px - lw2 / 2, y, lw2, 2); for (let row = 0; row < 2; row++) for (let x = px - lw2 / 2 + (row ? s * 0.3 : 0); x < px + lw2 / 2; x += s * 0.6) { const q = hash(x * 0.13 + y + row), yy = y + row * lh / 2, bw2 = Math.min(s * 0.58, px + lw2 / 2 - x); g.fillStyle = q < 0.4 ? 'rgba(0,0,0,0.14)' : q > 0.8 ? 'rgba(255,240,200,0.1)' : 'rgba(0,0,0,0.04)'; g.fillRect(x, yy, bw2, lh / 2 - 1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, yy, 1, lh / 2); g.fillStyle = 'rgba(255,245,210,0.18)'; g.fillRect(x + 1, yy, bw2 - 1, 1); if (q > 0.9) { g.fillStyle = 'rgba(60,110,45,0.55)'; g.fillRect(x + bw2 * 0.3, yy, bw2 * 0.15, lh * 0.45); } } /* piedras talladas con luz y musgo que chorrea */ for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,120,50,0.7)'; g.beginPath(); g.ellipse(px - lw2 / 2 + hash(i * 7 + k) * lw2, y + 2, s * (0.3 + hash(k + i) * 0.5), s * 0.15, 0, 0, TAU); g.fill(); } } // escalones con musgo
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
    case 'subway': { // estación de subte: arcos del túnel que se pierden a lo lejos, un tren parado, columnas y carteles
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#07080c'], [0.5, '#141823'], [1, '#262c3a']]); g.fillRect(0, 0, w, h);
      // bóveda del techo con los arcos de ladrillo y tubos de luz
      for (let k = 0; k < 7; k++) { const cx = w * (k / 6), rr = w * 0.12; g.strokeStyle = '#2a2f3c'; g.lineWidth = s * 0.5; g.beginPath(); g.ellipse(cx, ground * 0.42, rr, ground * 0.32, 0, Math.PI, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, ground * 0.42, rr - s * 0.25, ground * 0.32 - s * 0.25, 0, Math.PI, TAU); g.stroke(); }
      // el túnel: anillos de luz que se achican hacia el fondo (profundidad)
      const tx = w * 0.5, ty = ground - s * 3.6;
      for (let k = 9; k >= 0; k--) { const f = Math.pow(0.78, k), rw = w * 0.22 * f, rh = s * 3.2 * f; g.fillStyle = `rgb(${10 + (9 - k) * 3},${11 + (9 - k) * 3},${16 + (9 - k) * 4})`; g.beginPath(); g.ellipse(tx, ty + s * 1.6 * (1 - f), rw, rh, 0, Math.PI, TAU); g.lineTo(tx + rw, ty + s * 1.6 * (1 - f) + rh * 0.6); g.lineTo(tx - rw, ty + s * 1.6 * (1 - f) + rh * 0.6); g.fill(); glowDisc(g, tx, ty - rh * 0.85 + s * 1.6 * (1 - f), s * 0.5 * f + 2, '#fde68a', 0.5); }
      glowDisc(g, tx, ty, s * 1.2, '#fef3c7', 0.5); // la luz del tren que viene
      // tren parado en el andén de enfrente
      const by = ground - s * 1.3, ty2 = by - s * 2.6;
      for (let c = 0; c < 4; c++) { const x0 = w * (0.02 + c * 0.25), cw = w * 0.235; if (Math.abs(x0 + cw / 2 - tx) < w * 0.13) continue;
        g.fillStyle = lin(g, 0, ty2, 0, by, [[0, '#cbd5e1'], [0.15, '#94a3b8'], [0.7, '#64748b'], [1, '#334155']]); g.beginPath(); g.roundRect(x0, ty2, cw, by - ty2, s * 0.25); g.fill();
        g.fillStyle = '#dc2626'; g.fillRect(x0, ty2 + (by - ty2) * 0.62, cw, s * 0.18);
        for (let k = 0; k < 5; k++) { const wx = x0 + cw * (0.06 + k * 0.19), wy = ty2 + s * 0.45; g.fillStyle = lin(g, 0, wy, 0, wy + s * 0.9, [[0, '#fef3c7'], [1, '#f59e0b']]); g.fillRect(wx, wy, cw * 0.13, s * 0.9); g.fillStyle = 'rgba(30,30,40,0.55)'; g.fillRect(wx + cw * 0.03, wy + s * 0.3, cw * 0.05, s * 0.6); } // ventanas con gente
        g.fillStyle = '#1f2937'; for (let k = 0; k < 2; k++) g.fillRect(x0 + cw * (0.3 + k * 0.35), ty2 + s * 0.3, cw * 0.06, by - ty2 - s * 0.3); }
      g.fillStyle = '#0b0d12'; g.fillRect(0, by, w, ground - by); g.fillStyle = '#facc15'; g.fillRect(0, by, w, s * 0.1); // andén de enfrente
      // columnas con carteles y bancos
      for (let k = 0; k < 6; k++) { const cx = w * (0.08 + k * 0.17); g.fillStyle = lin(g, cx - s * 0.4, 0, cx + s * 0.4, 0, [[0, '#6b7280'], [0.4, '#d1d5db'], [1, '#374151']]); g.fillRect(cx - s * 0.35, 0, s * 0.7, ground); g.fillStyle = '#1e3a8a'; g.fillRect(cx - s * 0.9, ground * 0.32, s * 1.8, s * 0.6); g.fillStyle = '#f8fafc'; g.font = `700 ${Math.max(6, s * 0.3)}px system-ui`; g.textAlign = 'center'; g.fillText(['ESTACIÓN', 'KOMBAT', 'LÍNEA K', 'ANDÉN 2'][k % 4], cx, ground * 0.32 + s * 0.42); g.textAlign = 'left'; light(g, cx, ground * 0.18, Math.max(1.5, s * 0.08), '#fef9c3'); }
      for (let k = 0; k < 3; k++) { const px = w * (0.2 + k * 0.3), py = ground * 0.52; g.fillStyle = '#111827'; g.fillRect(px - s * 1.1, py - s * 0.7, s * 2.2, s * 1.5); g.fillStyle = ['#be123c', '#0e7490', '#7c3aed'][k]; g.fillRect(px - s, py - s * 0.6, s * 2, s * 1.3); g.fillStyle = '#fde047'; g.font = `900 ${Math.max(6, s * 0.35)}px Impact, sans-serif`; g.textAlign = 'center'; g.fillText(['FIGHT!', 'GOL', 'K.O.'][k], px, py + s * 0.15); g.textAlign = 'left'; } // afiches
      fog(g, A, ground - s * 2, ground, '#fde68a', 0.08);
      break;
    }
    case 'pit': { // el puente sobre el foso: noche con luna, nubes, torres de piedra y el abismo con pinches abajo
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#03040a'], [0.5, '#151a33'], [1, '#2e2747']]); g.fillRect(0, 0, w, h);
      stars(g, A, 300, ground * 0.6, 11);
      planet(g, A, w * 0.28, ground * 0.2, s * 2.6, 'moon', 13, '#e0e7ff');
      clouds(g, A, 0, ground * 0.65, '#1c1a33', '#8b80c9', 0.55, 31, 1.3);
      mountains(g, A, { base: ground - s * 2.6, height: s * 7, seed: 91, scale: 7, colors: [[0, '#3b3656'], [1, '#14112a']], haze: '#2e2747', hazeK: 0.45, light: 1.4 });
      // torres de piedra a lo lejos con ventanas encendidas
      for (let k = 0; k < 5; k++) { const tx = w * (0.08 + k * 0.21), tw = s * (1 + r(k) * 0.6), th = s * (5 + r(k + 2) * 4), tb = ground - s * 3; g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, '#2a2742'], [1, '#0e0c1a']]); g.fillRect(tx, tb - th, tw, th); for (let j = 0; j < 4; j++) { g.fillStyle = '#0e0c1a'; g.fillRect(tx - s * 0.1 + j * tw * 0.33, tb - th - s * 0.3, tw * 0.2, s * 0.3); } if (r(k + 5) < 0.7) { glowDisc(g, tx + tw / 2, tb - th * 0.6, s * 0.5, '#fbbf24', 0.4); g.fillStyle = '#fcd34d'; g.fillRect(tx + tw * 0.4, tb - th * 0.65, tw * 0.2, s * 0.35); } }
      // el abismo: paredes de roca que bajan y la oscuridad, con pinches que brillan muy abajo
      mountainsAt(g, A, w * 0.04, ground, s * 3.2, s * 6, 7, ['#3a3456', '#0a0814']); mountainsAt(g, A, w * 0.96, ground, s * 3.2, s * 6, 8, ['#3a3456', '#0a0814']);
      g.fillStyle = lin(g, 0, ground - s * 3, 0, ground, [[0, 'rgba(5,4,12,0)'], [1, 'rgba(5,4,12,0.95)']]); g.fillRect(0, ground - s * 3, w, s * 3);
      for (let k = 0; k < 40; k++) { const x = w * r(k + 100), hgt = s * (0.4 + r(k + 101) * 0.9), y = ground - s * 0.15; g.fillStyle = lin(g, x, y - hgt, x, y, [[0, '#cbd5e1'], [1, '#1e1b2e']]); g.beginPath(); g.moveTo(x - s * 0.1, y); g.lineTo(x, y - hgt); g.lineTo(x + s * 0.1, y); g.fill(); }
      fog(g, A, ground - s * 4, ground - s, '#6d5fb0', 0.3);
      // cadenas y sogas del puente que suben a los costados
      g.strokeStyle = '#3f3a2a'; g.lineWidth = Math.max(1, s * 0.08); for (const sx of [0.02, 0.98]) { g.beginPath(); g.moveTo(w * sx, ground - s * 6); g.quadraticCurveTo(w * 0.5, ground - s * 1.5, w * (1 - sx), ground - s * 6); g.stroke(); }
      break;
    }
    case 'desert': { // desierto al atardecer: sol enorme, dunas con luz, mesetas, pirámides y cactus
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#1e1b4b'], [0.35, '#7c2d12'], [0.7, '#ea580c'], [1, '#fcd34d']]); g.fillRect(0, 0, w, h);
      stars(g, A, 80, ground * 0.25, 17);
      const sx = w * 0.62, sy = ground - s * 4.5; glowDisc(g, sx, sy, s * 12, '#fdba74', 0.55); glowDisc(g, sx, sy, s * 3.2, '#fff7ed', 0.95); g.fillStyle = 'rgba(255,240,200,0.85)'; g.beginPath(); g.arc(sx, sy, s * 2.2, 0, TAU); g.fill();
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(124,45,18,${0.25 + k * 0.05})`; g.fillRect(sx - s * 2.6, sy - s * 0.6 + k * s * 0.45, s * 5.2, s * 0.12); } // franjas del sol
      clouds(g, A, 0, ground * 0.45, '#7c2d12', '#fdba74', 0.4, 41, 1.6);
      // mesetas lejanas
      mountains(g, A, { base: ground - s * 2.4, height: s * 4.5, seed: 43, scale: 5, colors: [[0, '#9a3412'], [1, '#431407']], haze: '#f97316', hazeK: 0.45, light: 1.2 });
      // pirámides
      for (const [px, ps] of [[0.18, 1], [0.3, 0.6], [0.84, 0.8]] as const) { const bx = w * px, hh = s * 6 * ps, bw = hh * 1.5, by = ground - s * 2; g.fillStyle = '#c2410c'; g.beginPath(); g.moveTo(bx - bw / 2, by); g.lineTo(bx, by - hh); g.lineTo(bx + bw / 2, by); g.fill(); g.fillStyle = '#7c2d12'; g.beginPath(); g.moveTo(bx, by - hh); g.lineTo(bx + bw / 2, by); g.lineTo(bx + bw * 0.1, by); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; for (let j = 1; j < 10; j++) { const yy = by - hh * j / 10; g.beginPath(); g.moveTo(bx - bw / 2 * (1 - j / 10), yy); g.lineTo(bx + bw / 2 * (1 - j / 10), yy); g.stroke(); } }
      // dunas con luz del sol (de lejos a cerca)
      for (const [base, amp, c1, c2, seed] of [[ground - s * 1.4, s * 1.6, '#f59e0b', '#9a3412', 51], [ground - s * 0.5, s * 1.3, '#fbbf24', '#b45309', 52], [ground + s * 0.2, s * 1.1, '#fcd34d', '#c2410c', 53]] as const) {
        layer(g, A, base - amp * 1.6, ground, (x, y) => { const top = base - amp * (0.4 + fbm(x / (s * 6), 0.2, seed, 3) * 1.2); if (y < top) return null; const sl = fbm((x + s * 0.3) / (s * 6), 0.2, seed, 3) - fbm((x - s * 0.3) / (s * 6), 0.2, seed, 3); const ripple = Math.sin(x / (s * 0.35) + y / (s * 0.2) + fbm(x / s, y / s, seed + 1, 2) * 3) * 0.06; const c = ramp([[0, c1], [1, c2]], Math.min(1, (y - top) / (amp * 1.5)) * 0.7 + 0.5 - sl * 6 + ripple); return [c[0], c[1], c[2], 255]; }, Math.min(2, A.res));
      }
      for (let k = 0; k < 6; k++) { const cx = w * (0.05 + r(k + 20) * 0.9), ch = s * (1.2 + r(k + 21) * 1.6), cb = ground - s * (0.2 + r(k + 22) * 0.4); g.fillStyle = '#14532d'; g.beginPath(); g.roundRect(cx - s * 0.16, cb - ch, s * 0.32, ch, s * 0.16); g.fill(); g.beginPath(); g.roundRect(cx - s * 0.6, cb - ch * 0.75, s * 0.24, ch * 0.4, s * 0.12); g.fill(); g.fillRect(cx - s * 0.6, cb - ch * 0.42, s * 0.5, s * 0.18); g.beginPath(); g.roundRect(cx + s * 0.36, cb - ch * 0.85, s * 0.24, ch * 0.35, s * 0.12); g.fill(); g.fillRect(cx + s * 0.1, cb - ch * 0.55, s * 0.5, s * 0.18); g.fillStyle = 'rgba(250,204,21,0.35)'; g.fillRect(cx - s * 0.16, cb - ch, s * 0.07, ch); } // cactus
      fog(g, A, ground - s * 3, ground, '#fdba74', 0.25);
      break;
    }
    case 'ocean': { // fondo del mar: rayos de sol desde arriba, arrecife de coral, algas, un barco hundido y rocas
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#0e7490'], [0.35, '#075985'], [0.8, '#0c2d4a'], [1, '#08203a']]); g.fillRect(0, 0, w, h);
      // la superficie con ondas y los rayos de luz
      layer(g, A, 0, ground * 0.12, (x, y) => { const n = fbm(x / (s * 2), y / (s * 0.6), 61, 4); const v = Math.max(0, n - 0.45) * 2.4; return [120 + v * 135, 220 + v * 35, 240, 90 + v * 120]; }, Math.min(2, A.res));
      g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const x0 = w * (0.05 + k * 0.12 + r(k) * 0.05), sk = s * (2 + r(k + 1) * 3); g.fillStyle = lin(g, 0, 0, 0, ground, [[0, 'rgba(165,243,252,0.14)'], [1, 'rgba(165,243,252,0)']]); g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + s * (0.6 + r(k + 2)), 0); g.lineTo(x0 + sk + s * 2, ground); g.lineTo(x0 + sk, ground); g.fill(); } g.restore();
      // rocas y arcos de piedra lejanos
      mountains(g, A, { base: ground - s * 1.5, height: s * 6, seed: 63, scale: 6, colors: [[0, '#1e5a74'], [1, '#0a2238']], haze: '#0c4a6e', hazeK: 0.55, light: 1.2 });
      const ax = w * 0.3, ay = ground - s * 2; g.strokeStyle = '#16384f'; g.lineWidth = s * 0.9; g.beginPath(); g.arc(ax, ay, s * 2.4, Math.PI, TAU); g.stroke();
      // barco hundido inclinado
      g.save(); g.translate(w * 0.7, ground - s * 1.8); g.rotate(-0.12); g.fillStyle = lin(g, 0, -s * 2, 0, s, [[0, '#4a3524'], [1, '#1f160e']]); g.beginPath(); g.moveTo(-s * 5, -s * 1.4); g.lineTo(s * 4.5, -s * 1.8); g.lineTo(s * 3.2, s * 0.6); g.lineTo(-s * 4, s * 0.6); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-s * 5 + k * s * 0.3, -s * 1.4 + k * s * 0.4); g.lineTo(s * 4.5 - k * s * 0.3, -s * 1.8 + k * s * 0.5); g.stroke(); } g.fillStyle = '#2a1d12'; g.fillRect(-s * 0.2, -s * 6, s * 0.3, s * 4.4); g.fillRect(-s * 1.8, -s * 5, s * 3.4, s * 0.2); g.fillStyle = 'rgba(200,200,180,0.35)'; g.beginPath(); g.moveTo(s * 0.1, -s * 5.8); g.lineTo(s * 2.2, -s * 4.2); g.lineTo(s * 0.1, -s * 2.6); g.fill(); for (let k = 0; k < 3; k++) { g.fillStyle = '#0b1622'; g.beginPath(); g.arc(-s * 2.6 + k * s * 1.6, -s * 0.6, s * 0.25, 0, TAU); g.fill(); } g.restore();
      fog(g, A, ground * 0.35, ground - s, '#0e7490', 0.35);
      // bosque de algas
      for (let k = 0; k < 22; k++) { const x = w * r(k + 30), hh = s * (3 + r(k + 31) * 6); g.strokeStyle = k % 3 ? '#166534' : '#3f6212'; g.lineWidth = Math.max(1.5, s * (0.12 + r(k) * 0.1)); g.beginPath(); g.moveTo(x, ground); for (let j = 1; j <= 8; j++) g.lineTo(x + Math.sin(j * 0.9 + k) * s * 0.35, ground - hh * j / 8); g.stroke(); g.fillStyle = g.strokeStyle; for (let j = 2; j <= 8; j += 2) { g.beginPath(); g.ellipse(x + Math.sin(j * 0.9 + k) * s * 0.35 + s * 0.2, ground - hh * j / 8, s * 0.25, s * 0.08, 0.5, 0, TAU); g.fill(); } }
      // arrecife de coral adelante
      for (let k = 0; k < 16; k++) { const cx = w * r(k + 70), cb = ground, c = ['#f472b6', '#fb923c', '#a78bfa', '#facc15', '#f87171'][k % 5], hh = s * (0.7 + r(k + 71) * 1.4);
        if (k % 3 === 0) { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cb - hh * 0.4, hh * 0.6, hh * 0.45, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(cx - hh * 0.5, cb - hh * 0.4 + j * hh * 0.12); g.quadraticCurveTo(cx, cb - hh * 0.6 + j * hh * 0.12, cx + hh * 0.5, cb - hh * 0.4 + j * hh * 0.12); g.stroke(); } } // coral cerebro
        else { g.strokeStyle = c; g.lineWidth = Math.max(1.5, s * 0.12); g.lineCap = 'round'; const br = (x: number, y: number, a: number, l: number, d: number) => { const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); if (d > 0) { br(x2, y2, a - 0.5, l * 0.7, d - 1); br(x2, y2, a + 0.45, l * 0.7, d - 1); } }; br(cx, cb, (r(k) - 0.5) * 0.4, hh * 0.45, 3); } } // coral ramificado
      fog(g, A, ground - s * 2, ground, '#22d3ee', 0.12);
      break;
    }
    case 'sky': { // ciudad en las nubes al atardecer: mar de nubes, islas flotantes con cascadas y torres doradas
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#1e3a8a'], [0.4, '#a855f7'], [0.7, '#f472b6'], [1, '#fde68a']]); g.fillRect(0, 0, w, h);
      stars(g, A, 90, ground * 0.3, 19);
      glowDisc(g, w * 0.5, ground * 0.75, s * 12, '#fde68a', 0.5); glowDisc(g, w * 0.5, ground * 0.75, s * 2.5, '#fffbeb', 0.9);
      clouds(g, A, ground * 0.05, ground * 0.5, '#c084fc', '#fff1f2', 0.45, 71, 1.4);
      const island = (cx: number, cy: number, iw: number, seed: number) => {
        layer(g, A, cy - iw * 0.1, cy + iw * 0.7, (x, y) => { const dx = (x - cx) / iw; if (Math.abs(dx) > 0.5) return null; const bot = cy + iw * 0.6 * (1 - Math.pow(Math.abs(dx) * 2, 1.6)) * (0.7 + fbm(x / (s * 0.8), 1, seed, 3) * 0.6); if (y < cy || y > bot) return null; const n = fbm(x / (s * 0.5), y / (s * 0.5), seed + 3, 4); const c = ramp([[0, '#a16207'], [0.4, '#78350f'], [1, '#3b1d0a']], (y - cy) / (bot - cy) * 0.8 + (n - 0.5) * 0.4); const lit = dx < 0 ? 1.15 : 0.8; return [c[0] * lit, c[1] * lit, c[2] * lit, 255]; }, Math.min(2, A.res));
        g.fillStyle = '#4d7c0f'; g.beginPath(); g.ellipse(cx, cy, iw * 0.5, iw * 0.06, 0, Math.PI, TAU); g.fill(); g.fillRect(cx - iw * 0.5, cy - 1, iw, iw * 0.04);
        // templo dorado
        const tw = iw * 0.3, th = iw * 0.45; g.fillStyle = lin(g, cx - tw / 2, 0, cx + tw / 2, 0, [[0, '#fde68a'], [0.5, '#f59e0b'], [1, '#92400e']]); for (let j = 0; j < 4; j++) g.fillRect(cx - tw / 2 + j * tw / 3.5, cy - th * 0.7, tw * 0.08, th * 0.7); g.fillRect(cx - tw * 0.6, cy - th * 0.78, tw * 1.2, th * 0.1); g.beginPath(); g.moveTo(cx - tw * 0.65, cy - th * 0.78); g.lineTo(cx, cy - th); g.lineTo(cx + tw * 0.65, cy - th * 0.78); g.fill(); g.beginPath(); g.ellipse(cx, cy - th * 1.05, tw * 0.25, tw * 0.25, 0, Math.PI, TAU); g.fill();
        g.fillStyle = lin(g, 0, cy, 0, cy + iw, [[0, 'rgba(224,242,254,0.85)'], [1, 'rgba(224,242,254,0)']]); g.fillRect(cx + iw * 0.28, cy, iw * 0.05, iw); // cascada que cae de la isla
      };
      island(w * 0.15, ground * 0.42, s * 6, 3); island(w * 0.8, ground * 0.32, s * 7.5, 5); island(w * 0.48, ground * 0.2, s * 3.5, 7);
      // torres de la ciudad sobre las nubes
      for (let k = 0; k < 9; k++) { const tx = w * (0.04 + k * 0.115), th = s * (3 + r(k) * 5), tw = s * (0.8 + r(k + 1) * 0.8), tb = ground - s * 1.5; g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, '#fef3c7'], [0.5, '#e7d3a8'], [1, '#a78b5a']]); g.fillRect(tx, tb - th, tw, th); g.fillStyle = '#d97706'; g.beginPath(); g.moveTo(tx - s * 0.15, tb - th); g.lineTo(tx + tw / 2, tb - th - s * 1.2); g.lineTo(tx + tw + s * 0.15, tb - th); g.fill(); for (let j = 0; j < 3; j++) { g.fillStyle = '#7c2d12'; g.beginPath(); g.roundRect(tx + tw * 0.35, tb - th + s * (0.6 + j * 1.1), tw * 0.3, s * 0.5, [s * 0.15, s * 0.15, 0, 0]); g.fill(); } }
      // el mar de nubes que tapa la base
      clouds(g, A, ground - s * 3.5, ground + s, '#f9a8d4', '#ffffff', 0.75, 73, 1.1, false);
      fog(g, A, ground - s * 2, ground, '#fff1f2', 0.4);
      break;
    }
    case 'coliseum': { // el coliseo: tribunas llenas en gradas, arcos, toldo con sogas, banderas y antorchas, cielo de día
      g.fillStyle = lin(g, 0, 0, 0, ground, [[0, '#1e40af'], [0.45, '#60a5fa'], [1, '#e0f2fe']]); g.fillRect(0, 0, w, h);
      clouds(g, A, 0, ground * 0.35, '#e0f2fe', '#ffffff', 0.45, 81, 1.5);
      // el anillo del coliseo: tres pisos de arcos
      // colinas y la ciudad antigua que se ven por encima del coliseo
      mountains(g, A, { base: ground * 0.5, height: s * 4, seed: 83, scale: 8, colors: [[0, '#7fa36b'], [1, '#3f6b3a']], haze: '#bfdbfe', hazeK: 0.55 });
      const top = ground * 0.42, wallB = ground - s * 2.6;
      g.fillStyle = lin(g, 0, top, 0, wallB, [[0, '#e7c9a0'], [1, '#a47b4f']]); g.fillRect(0, top, w, wallB - top);
      const floors = 2, fh = (wallB - top) / floors;
      for (let f2 = 0; f2 < floors; f2++) { const y0 = top + f2 * fh; g.fillStyle = 'rgba(80,50,25,0.35)'; g.fillRect(0, y0 + fh - s * 0.18, w, s * 0.18); g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(0, y0, w, s * 0.08);
        for (let x = s * 0.4; x < w; x += s * 2) { g.fillStyle = f2 === 0 ? lin(g, 0, y0, 0, y0 + fh, [[0, '#93c5fd'], [1, '#dbeafe']]) : '#3b2412'; g.beginPath(); g.moveTo(x, y0 + fh - s * 0.18); g.lineTo(x, y0 + fh * 0.35); g.arc(x + s * 0.7, y0 + fh * 0.35, s * 0.7, Math.PI, TAU); g.lineTo(x + s * 1.4, y0 + fh - s * 0.18); g.fill(); g.fillStyle = lin(g, x + s * 1.45, 0, x + s * 1.95, 0, [[0, '#f5deb3'], [1, '#b8895a']]); g.fillRect(x + s * 1.45, y0 + s * 0.1, s * 0.5, fh - s * 0.3); } }
      // el toldo (velarium) con sogas
      g.strokeStyle = 'rgba(80,50,25,0.6)'; g.lineWidth = 1; for (let x = 0; x < w; x += s * 1.4) { g.beginPath(); g.moveTo(x, top); g.lineTo(w / 2 + (x - w / 2) * 0.4, 0); g.stroke(); }
      for (let x = 0, k = 0; x < w; x += s * 2.8, k++) { g.fillStyle = k % 2 ? 'rgba(220,38,38,0.85)' : 'rgba(254,243,199,0.9)'; g.beginPath(); g.moveTo(x, top); g.lineTo(x + s * 2.8, top); g.lineTo(x + s * 2.5, top - s * 1.1); g.lineTo(x + s * 0.3, top - s * 1.1); g.fill(); }
      // tribunas llenas de gente (puntitos de colores con cabeza)
      const standT = wallB - s * 0.1, standB = ground - s * 0.15;
      g.fillStyle = lin(g, 0, standT, 0, standB, [[0, '#7c5a3a'], [1, '#3b2412']]); g.fillRect(0, standT, w, standB - standT);
      for (let row = 0; row < 8; row++) for (let x = r(row) * s * 0.3; x < w; x += s * 0.32) { const y = standT + s * (0.2 + row * 0.3); g.fillStyle = ['#dc2626', '#2563eb', '#f8fafc', '#16a34a', '#facc15', '#7c3aed', '#f97316'][Math.floor(hash(x * 0.37 + row) * 7)]; g.fillRect(x, y, s * 0.2, s * 0.18); g.fillStyle = ['#f1c27d', '#8d5524', '#e0ac69', '#c68642'][Math.floor(hash(x * 0.71 + row) * 4)]; g.beginPath(); g.arc(x + s * 0.1, y - s * 0.06, s * 0.07, 0, TAU); g.fill(); }
      g.fillStyle = '#c9a77a'; g.fillRect(0, standB, w, s * 0.15); // el muro de la arena
      // banderas y antorchas
      for (let k = 0; k < 6; k++) { const bx = w * (0.08 + k * 0.17); g.fillStyle = '#3b2412'; g.fillRect(bx, top - s * 2.6, s * 0.08, s * 2.6); g.fillStyle = k % 2 ? '#b91c1c' : '#1d4ed8'; g.beginPath(); g.moveTo(bx + s * 0.08, top - s * 2.6); g.lineTo(bx + s * 1.1, top - s * 2.3); g.lineTo(bx + s * 0.08, top - s * 2); g.fill(); glowDisc(g, bx, standT - s * 0.2, s * 0.9, '#fb923c', 0.5); g.fillStyle = '#fde68a'; g.beginPath(); g.moveTo(bx - s * 0.1, standT - s * 0.05); g.quadraticCurveTo(bx, standT - s * 0.6, bx + s * 0.1, standT - s * 0.05); g.fill(); }
      fog(g, A, ground - s * 2, ground, '#fde68a', 0.15);
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

// ---------------------------------------------------------------- Retoque final (como una cámara de cine)
// Color más vivo y con contraste, el brillo de las luces que se expande (bloom), luz del color del escenario
// de un lado y sombra fría del otro, y un grano fino de película. Se hace una sola vez (con el fondo guardado).
interface Grade { sat: number; con: number; bright: number; bloom: number; key: string; keyX: number; shadow: string }
const GRADES: Record<StageId, Grade> = {
  industrial: { sat: 1.3, con: 1.1, bright: 1.05, bloom: 0.6, key: '#8b5cf6', keyX: 0.66, shadow: '#020617' },
  mines: { sat: 1.3, con: 1.08, bright: 1.05, bloom: 0.55, key: '#f472b6', keyX: 0.72, shadow: '#05010d' },
  base: { sat: 1.25, con: 1.1, bright: 1.05, bloom: 0.6, key: '#fff3c4', keyX: 0.12, shadow: '#01030c' },
  ice: { sat: 1.2, con: 1.08, bright: 1.05, bloom: 0.45, key: '#a7f3d0', keyX: 0.7, shadow: '#020a1f' },
  volcano: { sat: 1.3, con: 1.12, bright: 1.04, bloom: 0.65, key: '#ff7a1a', keyX: 0.5, shadow: '#0a0101' },
  forest: { sat: 1.35, con: 1.08, bright: 1.08, bloom: 0.6, key: '#67e8f9', keyX: 0.8, shadow: '#01040a' },
  factory: { sat: 1.25, con: 1.1, bright: 1.04, bloom: 0.55, key: '#fbbf24', keyX: 0.3, shadow: '#0d0606' },
  storm: { sat: 1.2, con: 1.12, bright: 1.06, bloom: 0.55, key: '#a5b4fc', keyX: 0.6, shadow: '#02030a' },
  temple: { sat: 1.3, con: 1.08, bright: 1.04, bloom: 0.5, key: '#fff1c1', keyX: 0.5, shadow: '#03140c' },
  moon: { sat: 1.15, con: 1.12, bright: 1.05, bloom: 0.5, key: '#fff7e0', keyX: 0.15, shadow: '#000105' },
  subway: { sat: 1.2, con: 1.1, bright: 1.06, bloom: 0.6, key: '#fde68a', keyX: 0.5, shadow: '#03040a' },
  pit: { sat: 1.2, con: 1.12, bright: 1.05, bloom: 0.5, key: '#c7d2fe', keyX: 0.28, shadow: '#020108' },
  desert: { sat: 1.3, con: 1.08, bright: 1.03, bloom: 0.6, key: '#fdba74', keyX: 0.62, shadow: '#1c0a04' },
  ocean: { sat: 1.3, con: 1.08, bright: 1.05, bloom: 0.5, key: '#a5f3fc', keyX: 0.5, shadow: '#010812' },
  sky: { sat: 1.25, con: 1.05, bright: 1.04, bloom: 0.55, key: '#fde68a', keyX: 0.5, shadow: '#1e1b4b' },
  coliseum: { sat: 1.25, con: 1.08, bright: 1.03, bloom: 0.4, key: '#fff7e0', keyX: 0.3, shadow: '#1c1006' },
};
let grainTile: HTMLCanvasElement | null = null;
export function gradeScenery(c: HTMLCanvasElement, stage: StageId) {
  const G = GRADES[stage], g = c.getContext('2d'), w = c.width, h = c.height;
  if (!g || typeof document === 'undefined') return;
  const filters = typeof g.filter === 'string';
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const t = tmp.getContext('2d')!;
  // color y contraste
  if (filters) { t.filter = `saturate(${G.sat}) contrast(${G.con}) brightness(${G.bright})`; t.drawImage(c, 0, 0); t.filter = 'none'; g.clearRect(0, 0, w, h); g.drawImage(tmp, 0, 0); }
  // luz del escenario de un lado (suave) y sombra fría abajo y del otro lado
  g.save();
  g.globalCompositeOperation = 'soft-light';
  const kx = w * G.keyX, kg = g.createRadialGradient(kx, h * 0.15, 0, kx, h * 0.15, Math.max(w, h) * 0.9);
  kg.addColorStop(0, alpha(G.key, 0.55)); kg.addColorStop(0.6, alpha(G.key, 0.12)); kg.addColorStop(1, alpha(G.shadow, 0.5));
  g.fillStyle = kg; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  const sg = g.createLinearGradient(0, 0, 0, h); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.75, 'rgba(255,255,255,1)'); sg.addColorStop(1, alpha(lighten(G.shadow, 0.35), 1));
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.restore();
  // bloom: lo brillante se expande
  if (filters) {
    const q = 4, sw = Math.max(1, Math.round(w / q)), sh = Math.max(1, Math.round(h / q));
    const sm = document.createElement('canvas'); sm.width = sw; sm.height = sh; const s2 = sm.getContext('2d')!;
    s2.filter = 'brightness(0.75) contrast(2.4) saturate(1.4)'; s2.drawImage(c, 0, 0, sw, sh); s2.filter = 'none';
    const bl = document.createElement('canvas'); bl.width = sw; bl.height = sh; const b2 = bl.getContext('2d')!;
    b2.filter = `blur(${Math.max(2, Math.round(sw / 160))}px)`; b2.drawImage(sm, 0, 0); b2.filter = `blur(${Math.max(4, Math.round(sw / 60))}px)`; b2.globalAlpha = 0.8; b2.drawImage(sm, 0, 0);
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = G.bloom; g.imageSmoothingEnabled = true; g.drawImage(bl, 0, 0, w, h); g.restore();
  }
  // grano fino
  if (!grainTile) {
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 128;
    const gt = grainTile.getContext('2d')!, id = gt.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (hash(i * 0.731) - 0.5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gt.putImageData(id, 0, 0);
  }
  const pat = g.createPattern(grainTile, 'repeat');
  if (pat) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07; g.fillStyle = pat; g.fillRect(0, 0, w, h); g.restore(); }
}

// ---------------------------------------------------------------- Lo que se mueve en el fondo (cada cuadro)
// Naves, pájaros, drones, estrellas fugaces, reflectores que barren, humo que sube, bombas de lava, rayos,
// la aurora que ondula, niebla que pasa y el agua de las cascadas. Es liviano: formas simples.
const wrap = (v: number, w: number) => ((v % w) + w) % w;
function ship(g: Ctx, x: number, y: number, sz: number, t: number, dir: number, glow: string) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  const eg = g.createRadialGradient(-sz * 1.3, 0, 0, -sz * 1.3, 0, sz * 1.6); eg.addColorStop(0, alpha(glow, 0.8)); eg.addColorStop(1, alpha(glow, 0)); g.fillStyle = eg; g.fillRect(-sz * 3, -sz, sz * 3, sz * 2);
  g.fillStyle = lin(g, 0, -sz * 0.4, 0, sz * 0.4, [[0, '#cbd5e1'], [1, '#334155']]); g.beginPath(); g.moveTo(sz * 1.3, 0); g.quadraticCurveTo(sz * 0.4, -sz * 0.45, -sz, -sz * 0.3); g.lineTo(-sz * 1.1, sz * 0.3); g.quadraticCurveTo(sz * 0.4, sz * 0.4, sz * 1.3, 0); g.fill();
  g.fillStyle = 'rgba(125,211,252,0.9)'; g.beginPath(); g.ellipse(sz * 0.5, -sz * 0.12, sz * 0.35, sz * 0.12, 0, 0, TAU); g.fill();
  if (Math.sin(t * 6) > 0) { g.fillStyle = '#f87171'; g.fillRect(-sz * 0.6, -sz * 0.4, 2, 2); }
  g.restore();
}
function bird(g: Ctx, x: number, y: number, sz: number, t: number, color: string) {
  const f = Math.sin(t * 9) * sz * 0.5; g.strokeStyle = color; g.lineWidth = Math.max(1, sz * 0.18); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - sz, y - f); g.quadraticCurveTo(x - sz * 0.4, y - f * 0.3 - sz * 0.2, x, y); g.quadraticCurveTo(x + sz * 0.4, y - f * 0.3 - sz * 0.2, x + sz, y - f); g.stroke();
}
function shootingStar(g: Ctx, w: number, top: number, t: number, seed: number) {
  const per = 6 + hash(seed) * 5, u = wrap(t + hash(seed + 1) * per, per) / 0.9; if (u > 1) return;
  const x0 = w * (0.2 + hash(Math.floor((t + hash(seed + 1) * per) / per) + seed) * 0.6), y0 = top * 0.2, len = w * 0.12, x = x0 + u * len, y = y0 + u * len * 0.35;
  g.strokeStyle = lin(g, x - len * 0.3, y - len * 0.1, x, y, [[0, 'rgba(255,255,255,0)'], [1, `rgba(255,255,255,${0.9 * (1 - u)})`]]); g.lineWidth = 2; g.beginPath(); g.moveTo(x - len * 0.3, y - len * 0.1); g.lineTo(x, y); g.stroke();
}
function puff(g: Ctx, x: number, y: number, r: number, color: string, a: number) { const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, alpha(color, a)); gg.addColorStop(1, alpha(color, 0)); g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2); }
export function drawAmbient(g: Ctx, stage: StageId, w: number, h: number, ground: number, s: number, t: number) {
  const r = (n: number) => hash(n * 1.37 + stage.length * 11.1);
  g.save(); g.beginPath(); g.rect(0, 0, w, ground); g.clip(); void h;
  switch (stage) {
    case 'industrial': {
      g.globalCompositeOperation = 'lighter';
      for (const [bx, ph] of [[0.3, 0], [0.62, 2]] as const) { const sx = w * bx, a = Math.sin(t * 0.5 + ph) * 0.45, ex = sx + Math.sin(a) * ground * 1.2, beam = g.createLinearGradient(sx, ground, ex, 0); beam.addColorStop(0, 'rgba(190,210,255,0.16)'); beam.addColorStop(1, 'rgba(190,210,255,0)'); g.fillStyle = beam; g.beginPath(); g.moveTo(sx - s * 0.15, ground - s * 2); g.lineTo(ex - s * 1.4, 0); g.lineTo(ex + s * 1.4, 0); g.lineTo(sx + s * 0.15, ground - s * 2); g.fill(); } // reflectores que barren
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 3; k++) { const dir = k % 2 ? -1 : 1, sp = s * (1.2 + k * 0.5), x = wrap(r(k) * w + dir * t * sp, w + s * 6) - s * 3; ship(g, x, ground * (0.1 + k * 0.08), s * (0.35 + k * 0.08), t + k, dir, k === 1 ? '#f472b6' : '#38bdf8'); }
      break;
    }
    case 'mines': case 'moon': case 'base': {
      shootingStar(g, w, ground, t, 1); shootingStar(g, w, ground, t + 3, 2);
      for (let k = 0; k < (stage === 'base' ? 2 : 3); k++) { const dir = k % 2 ? -1 : 1, x = wrap(r(k + 9) * w + dir * t * s * (0.8 + k * 0.4), w + s * 6) - s * 3; ship(g, x, ground * (0.15 + k * 0.12), s * (0.3 + k * 0.1), t + k, dir, stage === 'mines' ? '#f472b6' : '#7dd3fc'); }
      if (stage === 'mines') for (let k = 0; k < 6; k++) { const x = wrap(r(k + 30) * w + t * s * (0.3 + r(k) * 0.4), w + s * 2) - s, y = ground * (0.15 + r(k + 31) * 0.5) + Math.sin(t * 0.6 + k) * s * 0.3, R = s * (0.12 + r(k + 32) * 0.25); g.fillStyle = lin(g, x - R, y - R, x + R, y + R, [[0, '#b8a9d0'], [1, '#2a1f3a']]); g.beginPath(); for (let j = 0; j < 7; j++) { const a = j / 7 * TAU + t * 0.5 * (k % 2 ? 1 : -1); g.lineTo(x + Math.cos(a) * R * (0.8 + hash(j + k) * 0.3), y + Math.sin(a) * R * (0.8 + hash(j + k) * 0.3)); } g.fill(); } // rocas que pasan girando
      if (stage === 'base') { g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 12; k++) if (Math.sin(t * 3 + k * 1.7) > 0.3) puff(g, w * (0.04 + k * 0.083), ground * 0.3 + (k % 2 ? -1 : 1) * s * 0.45, s * 0.35, k % 3 ? '#ef4444' : '#22c55e', 0.7); } // luces de la estación
      if (stage === 'moon') { const x = wrap(t * s * 0.6, w + s * 4) - s * 2, y = ground * 0.08; g.fillStyle = '#cbd5e1'; g.fillRect(x - s * 0.15, y - s * 0.1, s * 0.3, s * 0.2); g.fillStyle = '#1e3a8a'; g.fillRect(x - s * 0.7, y - s * 0.06, s * 0.45, s * 0.12); g.fillRect(x + s * 0.25, y - s * 0.06, s * 0.45, s * 0.12); } // satélite
      break;
    }
    case 'ice': {
      g.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 2; b++) { g.fillStyle = b ? 'rgba(168,85,247,0.05)' : 'rgba(52,211,153,0.06)'; g.beginPath(); g.moveTo(0, ground * 0.1); for (let x = 0; x <= w; x += s * 0.5) g.lineTo(x, ground * (0.22 + b * 0.08) + Math.sin(x / (s * 4) + t * 0.7 + b * 2) * s * 1.2 + Math.sin(x / (s * 1.7) - t * 1.1) * s * 0.4); for (let x = w; x >= 0; x -= s * 0.5) g.lineTo(x, ground * (0.05 + b * 0.06) + Math.sin(x / (s * 5) + t * 0.5 + b) * s * 1.5); g.fill(); } // la aurora ondula
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 4; k++) puff(g, wrap(r(k) * w + t * s * 0.5 * (1 + k * 0.3), w + s * 8) - s * 4, ground - s * (1 + k * 0.8), s * 3, '#e0f2fe', 0.12); // nieve que vuela
      break;
    }
    case 'volcano': {
      const vx = w * 0.5, crater = ground - s * 9.5;
      g.globalCompositeOperation = 'lighter'; puff(g, vx, crater, s * (4 + Math.sin(t * 2) * 0.8), '#ff7a1a', 0.25);
      for (let k = 0; k < 7; k++) { const per = 2.4 + r(k) * 1.5, u = wrap(t + r(k + 1) * per, per) / per, vx0 = (r(k + 2) - 0.5) * s * 7, vy0 = s * (7 + r(k + 3) * 4), x = vx + vx0 * u * per * 0.4, y = crater - vy0 * u * per * 0.4 + s * 9 * (u * per * 0.4) ** 2; if (y > ground) continue; puff(g, x, y, s * 0.5, '#ff8a1a', 0.7); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(x, y, s * 0.09, 0, TAU); g.fill(); } // bombas de lava
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 5; k++) { const u = wrap(t * 0.08 + k / 5, 1); puff(g, vx + Math.sin(k * 2 + t * 0.3) * s * 2 + u * s * 6, crater - u * ground * 0.6, s * (1.5 + u * 3), '#1b0c09', 0.35 * (1 - u)); } // humo que sube
      break;
    }
    case 'forest': {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 14; k++) { const x = wrap(r(k + 5) * w + Math.sin(t * 0.4 + k) * s * 2 + t * s * 0.2, w), y = ground * (0.3 + r(k + 6) * 0.6) + Math.sin(t * 0.9 + k * 2) * s * 0.8; puff(g, x, y, s * 0.35, k % 2 ? '#d9f99d' : '#67e8f9', 0.5 + 0.3 * Math.sin(t * 4 + k)); } // luciérnagas grandes
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 3; k++) { const x = wrap(w * r(k + 40) + t * s * 1.5 * (k % 2 ? -1 : 1), w + s * 4) - s * 2; bird(g, x, ground * (0.15 + k * 0.07) + Math.sin(t + k) * s * 0.3, s * 0.3, t + k, '#06121e'); } // murciélagos
      const fx = w * 0.62; g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 8; k++) { const yy = ground * 0.25 + wrap(t * s * 6 + k * ground * 0.1, ground * 0.75); g.fillStyle = 'rgba(224,242,254,0.25)'; g.fillRect(fx + s * 0.1 + hash(k) * s, yy, Math.max(1, s * 0.05), s * 0.8); } // el agua de la cascada cae
      break;
    }
    case 'factory': {
      for (const cx of [0.08, 0.2, 0.42, 0.93]) { const tx = w * cx, top = ground - s - s * (6 + r(cx * 9) * 3); for (let k = 0; k < 6; k++) { const u = wrap(t * 0.18 + k / 6 + cx, 1); puff(g, tx + u * s * 5 + Math.sin(t + k) * s * 0.3, top - u * s * 6, s * (0.5 + u * 2.2), '#2a1e1e', 0.45 * (1 - u)); } } // humo de las chimeneas
      for (const [cx, sc2] of [[0.62, 1], [0.78, 0.8]] as const) { const tx = w * cx, top = ground - s * 1.2 - s * 7 * sc2; for (let k = 0; k < 5; k++) { const u = wrap(t * 0.12 + k / 5, 1); puff(g, tx + u * s * 3, top - u * s * 5, s * (1 + u * 2.5) * sc2, '#e8ddd2', 0.35 * (1 - u)); } } // vapor de las torres
      const gx = w * 0.5, hx = gx + Math.sin(t * 0.4) * s * 4.5; g.strokeStyle = '#2a1a0a'; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); g.moveTo(hx, ground - s * 6.45); g.lineTo(hx, ground - s * 4.2 + Math.sin(t * 0.8) * s * 0.4); g.stroke(); g.fillStyle = '#6b4a2a'; g.fillRect(hx - s * 0.7, ground - s * 4.2 + Math.sin(t * 0.8) * s * 0.4, s * 1.4, s * 0.9); hazardBand(g, hx - s * 0.7, ground - s * 4.2 + Math.sin(t * 0.8) * s * 0.4, s * 1.4, s * 0.2, s); // la grúa mueve la carga
      g.globalCompositeOperation = 'lighter'; for (const bx of [0.15, 0.35, 0.73]) if (Math.sin(t * 13 + bx * 40) > 0.2) { const px = w * bx + (bx === 0.35 ? -1 : 1) * s * 2.6, py = ground - s * 2.3; puff(g, px, py, s * 0.7, '#fde68a', 0.8); for (let k = 0; k < 4; k++) { g.fillStyle = '#fff7d6'; g.fillRect(px + (hash(k + Math.floor(t * 20)) - 0.5) * s * 1.2, py + hash(k + 3 + Math.floor(t * 20)) * s * 0.8, 2, 2); } } // chispas de soldadura
      break;
    }
    case 'storm': {
      const per = 4.2, u = wrap(t, per), k = Math.floor(t / per);
      if (u < 0.35) { const x = w * (0.15 + hash(k) * 0.7); g.globalCompositeOperation = 'lighter'; puff(g, x, ground * 0.3, s * 8, '#c7d2fe', 0.3 * (1 - u / 0.35)); g.strokeStyle = `rgba(230,235,255,${1 - u / 0.35})`; g.lineWidth = Math.max(1.5, s * 0.07); g.beginPath(); let px = x, py = 0; g.moveTo(px, py); while (py < ground * 0.75) { px += (hash(px * 0.1 + py + k) - 0.5) * s * 1.5; py += s * 0.6; g.lineTo(px, py); } g.stroke(); } // rayo que cae
      g.globalCompositeOperation = 'source-over';
      for (let j = 0; j < 4; j++) puff(g, wrap(r(j) * w + t * s * (1.5 + j * 0.6), w + s * 10) - s * 5, ground * (0.15 + j * 0.12), s * 4, '#0f1428', 0.5); // nubes que pasan
      g.strokeStyle = 'rgba(165,180,252,0.3)'; g.lineWidth = 1; for (let j = 0; j < 14; j++) { const x = wrap(r(j + 80) * w + t * s * 1.2, w), y = ground - s * (0.3 + r(j + 81) * 1.7); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.4, y - 2, x + s * 0.8, y); g.stroke(); } // olas que corren
      break;
    }
    case 'temple': {
      for (let k = 0; k < 5; k++) { const x = wrap(w * r(k + 60) + t * s * (1.4 + k * 0.2), w + s * 6) - s * 3; bird(g, x, ground * (0.2 + (k % 3) * 0.05) + Math.sin(t * 0.8 + k) * s * 0.4, s * 0.25, t * 1.1 + k, '#2c3a2a'); } // bandada
      for (const sx of [0.2, 0.8]) { const fx = w * sx - s * 0.4; g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 6; k++) { const yy = ground - s * 6.5 + wrap(t * s * 7 + k * s * 1.1, s * 6.5); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(fx + hash(k + sx) * s * 0.8, yy, Math.max(1, s * 0.06), s * 0.6); } puff(g, fx + s * 0.45, ground - s * 0.2, s * (1.3 + Math.sin(t * 3 + sx) * 0.2), '#ffffff', 0.25); } // cascadas
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 4; k++) puff(g, wrap(r(k + 3) * w + t * s * 0.6, w + s * 10) - s * 5, ground - s * (1.5 + k * 1.2), s * 4, '#e8f0d0', 0.12); // niebla que pasa
      break;
    }
    case 'subway': {
      const per = 9, u = wrap(t, per) / per, dir = Math.floor(t / per) % 2 ? -1 : 1; // un tren que pasa a toda velocidad por el túnel de atrás
      if (u < 0.5) { const k = u / 0.5, x = dir > 0 ? -w * 0.6 + k * w * 2.2 : w * 1.6 - k * w * 2.2, y = ground - s * 4.3; g.fillStyle = lin(g, 0, y, 0, y + s * 2, [[0, '#e5e7eb'], [1, '#475569']]); g.fillRect(x, y, w * 0.6, s * 2); for (let j = 0; j < 14; j++) { g.fillStyle = 'rgba(254,243,199,0.9)'; g.fillRect(x + j * w * 0.043 + s * 0.2, y + s * 0.4, w * 0.03, s * 0.6); } g.globalCompositeOperation = 'lighter'; puff(g, dir > 0 ? x + w * 0.6 : x, y + s, s * 2, '#fef3c7', 0.7); g.globalCompositeOperation = 'source-over'; }
      if (Math.sin(t * 23) > 0.92 || Math.sin(t * 3.1) > 0.995) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, ground); } // un tubo de luz que titila
      break;
    }
    case 'pit': {
      for (let k = 0; k < 6; k++) { const x = wrap(r(k + 40) * w + t * s * (1.2 + k * 0.2) * (k % 2 ? -1 : 1), w + s * 4) - s * 2; bird(g, x, ground * (0.2 + (k % 3) * 0.1) + Math.sin(t * 2 + k) * s * 0.5, s * 0.28, t * 1.4 + k, '#0b0a14'); } // murciélagos
      for (let k = 0; k < 4; k++) puff(g, wrap(r(k + 9) * w + t * s * 0.8, w + s * 10) - s * 5, ground - s * (1 + k * 0.7), s * 4.5, '#8b80c9', 0.13); // niebla que sube del foso
      g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 20; k++) { const y = ground - wrap(t * s * (0.5 + r(k)) + r(k + 1) * s * 6, s * 6); puff(g, w * r(k + 2) + Math.sin(t + k) * s * 0.3, y, s * 0.12, '#c4b5fd', 0.6); }
      break;
    }
    case 'desert': {
      for (let k = 0; k < 3; k++) { const a = t * 0.4 + k * 2.1, cx = w * (0.3 + k * 0.2) + Math.cos(a) * s * 3, cy = ground * (0.18 + k * 0.05) + Math.sin(a) * s * 0.8; bird(g, cx, cy, s * 0.35, t * 0.8 + k, '#1c0a04'); } // buitres que vuelan en círculos
      for (let k = 0; k < 5; k++) puff(g, wrap(r(k) * w + t * s * 3.5, w + s * 12) - s * 6, ground - s * (0.5 + k * 0.6), s * (2.5 + k * 0.5), '#fdba74', 0.16); // ráfagas de arena
      g.fillStyle = 'rgba(253,186,116,0.6)'; for (let k = 0; k < 40; k++) g.fillRect(wrap(r(k + 50) * w + t * s * (5 + r(k) * 4), w), ground - s * (0.2 + r(k + 51) * 2.5) + Math.sin(t * 3 + k) * s * 0.1, 2, 1);
      break;
    }
    case 'ocean': {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) { const x0 = w * (0.05 + k * 0.12), a = 0.05 + 0.04 * Math.sin(t * 0.8 + k); g.fillStyle = `rgba(165,243,252,${a})`; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + s * 0.8, 0); g.lineTo(x0 + s * (3 + Math.sin(t * 0.5 + k)), ground); g.lineTo(x0 + s * (2 + Math.sin(t * 0.5 + k)), ground); g.fill(); } // los rayos de luz se mueven
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 30; k++) { const x = w * r(k + 5) + Math.sin(t * 2 + k) * s * 0.2, y = ground - wrap(t * s * (1.2 + r(k)) + r(k + 1) * ground, ground), rr = s * (0.04 + r(k + 2) * 0.08); g.strokeStyle = 'rgba(224,242,254,0.7)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - rr * 0.4, y - rr * 0.5, 1.5, 1.5); } // burbujas
      for (let sch = 0; sch < 2; sch++) { const dir = sch ? -1 : 1, cx = wrap(r(sch + 70) * w + dir * t * s * 1.5, w + s * 8) - s * 4, cy = ground * (0.3 + sch * 0.2) + Math.sin(t * 0.7 + sch) * s; for (let k = 0; k < 12; k++) { const fx = cx + (r(k + sch * 20) - 0.5) * s * 4, fy = cy + (r(k + sch * 20 + 1) - 0.5) * s * 1.6 + Math.sin(t * 3 + k) * s * 0.1; g.fillStyle = sch ? '#fbbf24' : '#93c5fd'; g.beginPath(); g.ellipse(fx, fy, s * 0.16, s * 0.07, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(fx - dir * s * 0.14, fy); g.lineTo(fx - dir * s * 0.26, fy - s * 0.07); g.lineTo(fx - dir * s * 0.26, fy + s * 0.07); g.fill(); } } // cardúmenes
      for (let k = 0; k < 3; k++) { const x = w * (0.2 + k * 0.3) + Math.sin(t * 0.3 + k) * s * 2, y = ground * (0.25 + k * 0.1) + Math.sin(t * 0.9 + k) * s * 0.8, p2 = 0.85 + 0.15 * Math.sin(t * 3 + k); g.globalCompositeOperation = 'lighter'; puff(g, x, y, s * 0.9, '#f0abfc', 0.35); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(240,171,252,0.55)'; g.beginPath(); g.ellipse(x, y, s * 0.45 * p2, s * 0.32, 0, Math.PI, TAU); g.fill(); g.strokeStyle = 'rgba(240,171,252,0.5)'; for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(x + j * s * 0.15, y); g.quadraticCurveTo(x + j * s * 0.15 + Math.sin(t * 2 + j) * s * 0.2, y + s * 0.5, x + j * s * 0.12, y + s * 1); g.stroke(); } } // medusas
      break;
    }
    case 'sky': {
      for (let k = 0; k < 5; k++) puff(g, wrap(r(k + 2) * w + t * s * (0.5 + k * 0.15), w + s * 14) - s * 7, ground * (0.2 + k * 0.12), s * (3 + k), '#ffffff', 0.18); // nubes que pasan
      for (let k = 0; k < 6; k++) { const x = wrap(w * r(k + 60) + t * s * (1.6 + k * 0.2), w + s * 6) - s * 3; bird(g, x, ground * (0.3 + (k % 3) * 0.06) + Math.sin(t + k) * s * 0.3, s * 0.22, t * 1.2 + k, '#4c1d95'); }
      const ax = wrap(t * s * 0.9, w + s * 10) - s * 5, ay = ground * 0.15 + Math.sin(t * 0.5) * s * 0.4; g.fillStyle = lin(g, 0, ay - s * 0.6, 0, ay + s * 0.6, [[0, '#fef3c7'], [1, '#b45309']]); g.beginPath(); g.ellipse(ax, ay, s * 2, s * 0.6, 0, 0, TAU); g.fill(); g.fillStyle = '#7c2d12'; g.fillRect(ax - s * 0.8, ay + s * 0.7, s * 1.6, s * 0.4); g.strokeStyle = '#7c2d12'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax - s * 0.7, ay + s * 0.5); g.lineTo(ax - s * 0.6, ay + s * 0.7); g.moveTo(ax + s * 0.7, ay + s * 0.5); g.lineTo(ax + s * 0.6, ay + s * 0.7); g.stroke(); // dirigible
      break;
    }
    case 'coliseum': {
      const top = ground * 0.42, wallB = ground - s * 2.6, standT = wallB - s * 0.1;
      for (let row = 0; row < 8; row++) for (let k = 0; k < 24; k++) { const x = w * r(k * 8 + row), y = standT + s * (0.2 + row * 0.3), up = Math.max(0, Math.sin(t * 6 + k * 1.7 + row)) * s * 0.12; g.fillStyle = ['#f1c27d', '#8d5524', '#e0ac69'][k % 3]; g.fillRect(x - 1, y - s * 0.14 - up, Math.max(1.5, s * 0.05), s * 0.12); } // la gente levanta los brazos
      for (let x = 0, k = 0; x < w; x += s * 2.8, k++) { g.fillStyle = k % 2 ? 'rgba(220,38,38,0.4)' : 'rgba(254,243,199,0.4)'; const wv = Math.sin(t * 2 + k) * s * 0.15; g.beginPath(); g.moveTo(x, top); g.lineTo(x + s * 2.8, top); g.lineTo(x + s * 2.5, top - s * 1.1 + wv); g.lineTo(x + s * 0.3, top - s * 1.1 - wv); g.fill(); } // el toldo flamea
      for (let k = 0; k < 6; k++) { const bx = w * (0.08 + k * 0.17), wv = Math.sin(t * 4 + k) * s * 0.2; g.fillStyle = k % 2 ? '#ef4444' : '#3b82f6'; g.beginPath(); g.moveTo(bx + s * 0.08, top - s * 2.6); g.quadraticCurveTo(bx + s * 0.6, top - s * 2.5 + wv, bx + s * 1.1, top - s * 2.3 + wv); g.lineTo(bx + s * 0.08, top - s * 2); g.fill(); g.globalCompositeOperation = 'lighter'; puff(g, bx, standT - s * 0.3, s * (0.6 + Math.sin(t * 12 + k) * 0.1), '#fb923c', 0.5); g.globalCompositeOperation = 'source-over'; } // banderas y antorchas
      for (let k = 0; k < 3; k++) { const x = wrap(w * r(k + 50) + t * s * 1.3, w + s * 4) - s * 2; bird(g, x, ground * 0.1 + k * s * 0.6, s * 0.2, t + k, '#1e293b'); }
      break;
    }
  }
  g.restore();
}
