// Fondos detallados de Gravity Swap (Ciudad Futurista, Minas Espaciales y Base en el Espacio). Los dibujos
// grandes (edificios, planetas, naves, el cielo estrellado) se pintan una sola vez en alta resolución, con
// texturas de ruido y luz de verdad (cada píxel de un planeta se ilumina según hacia dónde mira), y después solo
// se pegan en su lugar: así se ven nítidos y con mucho detalle sin que el juego se ponga lento. Encima se
// dibuja lo que se mueve: luces que titilan, naves que pasan por las ventanas, el fuego de los motores.

const RES = 64; // píxeles por casillero de los dibujos guardados
const ROWS = 10;

// ---------- Números al azar fijos y ruido ----------

const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function rng(seed: number) {
  let a = Math.imul(Math.floor(seed) + 1, 0x9e3779b1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lattice(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Ruido suave; si "period" no es 0, se repite cada "period" en x (para fondos que se repiten sin costura).
function noise(x: number, y: number, seed: number, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wx = (n: number) => period ? ((n % period) + period) % period : n;
  const a = lattice(wx(xi), yi, seed), b = lattice(wx(xi + 1), yi, seed), c = lattice(wx(xi), yi + 1, seed), d = lattice(wx(xi + 1), yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, octaves = 5, period = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f, seed + i * 31, period * f); norm += amp; f *= 2; amp *= 0.5; }
  return sum / norm;
}

// ---------- Colores ----------

type RGB = [number, number, number];
const rgb = (c: string): RGB => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const shade = (c: string, k: number) => css(k >= 0 ? mixRGB(rgb(c), [255, 255, 255], k) : mixRGB(rgb(c), [0, 0, 0], -k));
// Escala de colores: k de 0 a 1 entre varios colores.
function ramp(stops: [number, string][], k: number): RGB {
  k = Math.max(0, Math.min(1, k));
  for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) return mixRGB(rgb(stops[i - 1][1]), rgb(stops[i][1]), (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0] || 1));
  return rgb(stops[stops.length - 1][1]);
}
function lin(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  for (const [at, c] of stops) grad.addColorStop(at, c);
  return grad;
}
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha; g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
}

// ---------- Dibujos guardados ----------

interface Light { x: number; y: number; color: string; phase: number; size: number }
interface Sprite { img: HTMLCanvasElement; w: number; h: number; lights: Light[]; engines: { x: number; y: number; r: number; color: string }[] }
const cache = new Map<string, Sprite | null>();
function sprite(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, s: Sprite) => void, res = RES): Sprite | null {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return null;
  const img = document.createElement('canvas');
  img.width = Math.ceil(w * res); img.height = Math.ceil(h * res);
  const g = img.getContext('2d');
  if (!g) { cache.set(key, null); return null; }
  const s: Sprite = { img, w, h, lights: [], engines: [] };
  g.scale(res, res);
  draw(g, s);
  cache.set(key, s);
  return s;
}
// Un dibujo hecho píxel por píxel (para texturas con ruido y luz): f devuelve [r, g, b, a] o null si es transparente.
function pixels(wf: number, hf: number, f: (x: number, y: number) => [number, number, number, number] | null) {
  const w = Math.round(wf), h = Math.round(hf); // (tienen que ser enteros, si no la imagen sale torcida)
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return c;
  const data = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = f(x, y);
    if (!p) continue;
    const i = (y * w + x) * 4;
    data.data[i] = p[0]; data.data[i + 1] = p[1]; data.data[i + 2] = p[2]; data.data[i + 3] = p[3];
  }
  g.putImageData(data, 0, 0);
  return c;
}
// Repite algo cada "gap" casilleros con desplazamiento lento (parallax), entre l0 y l1.
function each(cam: number, l0: number, l1: number, factor: number, gap: number, draw: (x: number, i: number) => void) {
  const off = cam * factor;
  for (let i = Math.floor((l0 + off) / gap) - 1; i * gap - off < l1 + gap; i++) draw(i * gap - off, i);
}
function blinkLights(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, time: number) {
  for (const l of s.lights) {
    const on = Math.sin(time * 2.4 + l.phase) > 0.25;
    if (!on) continue;
    glow(ctx, x + l.x, y + l.y, l.size * 4, l.color, 0.75);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + l.x, y + l.y, l.size * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- El cielo estrellado (con la Vía Láctea y nebulosas) ----------

function starField(key: string, hue: [string, string, string], seed: number) {
  const W = 48, H = 10;
  return sprite(key, W, H, g => {
    // La nebulosa y la banda de la Vía Láctea, en baja resolución y agrandadas (son suaves).
    const lw = W * 8, lh = H * 8;
    const neb = pixels(lw, lh, (x, y) => {
      const u = x / 8, v = y / 8;
      const band = Math.exp(-(((v - 3.5 - Math.sin(u * Math.PI * 2 / W) * 1.6) / 2.2) ** 2));
      const n = fbm(u * 0.5, v * 0.5, seed, 5, W * 0.5), d = fbm(u * 1.4, v * 1.4, seed + 7, 4, W * 1.4);
      const cloud = Math.max(0, n - 0.42) * 2.2, dust = Math.max(0, d - 0.55) * 2.5;
      const k = Math.min(1, band * (0.55 + n * 0.7) * (1 - dust * 0.8) + cloud * 0.6);
      const c = ramp([[0, hue[0]], [0.5, hue[1]], [1, hue[2]]], fbm(u * 0.3, v * 0.3, seed + 3, 3, W * 0.3));
      return [c[0], c[1], c[2], Math.min(255, k * 150)];
    });
    g.imageSmoothingEnabled = true;
    g.drawImage(neb, 0, 0, W, H);
    // Estrellas: miles chiquitas, de colores, y algunas grandes con destellos en cruz.
    const r = rng(seed);
    const colors = ['#ffffff', '#dbeafe', '#bfdbfe', '#fef3c7', '#fed7aa', '#fecaca'];
    for (let i = 0; i < 2600; i++) {
      const x = r() * W, y = r() * H, size = 0.006 + r() ** 6 * 0.035, c = colors[Math.floor(r() * colors.length)];
      g.globalAlpha = 0.35 + r() * 0.65; g.fillStyle = c; g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      const x = 1 + r() * (W - 2), y = r() * H, size = 0.03 + r() * 0.03, c = colors[Math.floor(r() * 4)];
      glow(g, x, y, size * 7, c, 0.5);
      g.strokeStyle = c; g.lineWidth = 0.008; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(x - size * 6, y); g.lineTo(x + size * 6, y); g.moveTo(x, y - size * 6); g.lineTo(x, y + size * 6); g.stroke();
      g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, size * 0.7, 0, Math.PI * 2); g.fill();
    }
  }, 40);
}
function drawStarField(ctx: CanvasRenderingContext2D, s: Sprite | null, cam: number, l0: number, l1: number, factor: number, y0: number) {
  if (!s) return;
  each(cam, l0, l1, factor, s.w, x => ctx.drawImage(s.img, x, y0, s.w + 0.02, s.h));
}

// ---------- Planetas con luz de verdad ----------

type PlanetKind = 'gas' | 'earth' | 'moon' | 'ice' | 'lava' | 'mars' | 'neptune';
interface PlanetLook { kind: PlanetKind; rings?: boolean; atmo?: string }
const LIGHT = (() => { const v = [-0.62, -0.48, 0.62], l = Math.hypot(...v); return v.map(n => n / l); })();

function planetSprite(look: PlanetLook, seed: number) {
  const R = 1, ring = look.rings ? 2.3 : 1.25, W = R * ring * 2, H = look.rings ? R * 2.5 : R * 2.5;
  return sprite(`planet-${look.kind}-${seed}-${look.rings ? 1 : 0}`, W, H, g => {
    const px = 150, size = px * 2;
    // Cráteres (para la luna y Marte).
    const cr = rng(seed + 5), craters = Array.from({ length: look.kind === 'moon' ? 70 : look.kind === 'mars' ? 25 : 0 }, () => ({ x: cr() * 2 - 1, y: cr() * 2 - 1, r: 0.02 + cr() ** 3 * 0.22 }));
    const tex = pixels(size, size, (x, y) => {
      const nx = (x + 0.5 - px) / px, ny = (y + 0.5 - px) / px, d2 = nx * nx + ny * ny;
      if (d2 > 1) return null;
      const nz = Math.sqrt(1 - d2);
      const lon = Math.atan2(nx, nz), lat = Math.asin(ny);
      const light = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      let c: RGB = [128, 128, 128], emit: RGB = [0, 0, 0], spec = 0;
      switch (look.kind) {
        case 'gas': {
          const turb = fbm(lon * 2.2, lat * 9, seed, 5);
          const bands = Math.sin(lat * 15 + turb * 4.5) * 0.5 + 0.5;
          c = ramp([[0, '#7c4a26'], [0.3, '#c08552'], [0.55, '#ead7b5'], [0.8, '#d6a26a'], [1, '#f5ecd9']], bands * 0.8 + fbm(lon * 6, lat * 20, seed + 3, 3) * 0.3);
          const sx = (lon - 0.5) / 0.35, sy = (lat + 0.32) / 0.12, spot = Math.exp(-(sx * sx + sy * sy));
          c = mixRGB(c, rgb('#b6462d'), spot * 0.85);
          break;
        }
        case 'neptune': {
          const turb = fbm(lon * 2, lat * 6, seed, 4);
          c = ramp([[0, '#1e3a8a'], [0.5, '#3b82f6'], [1, '#93c5fd']], Math.sin(lat * 9 + turb * 3) * 0.25 + 0.5 + (turb - 0.5) * 0.4);
          spec = 0.15;
          break;
        }
        case 'earth': {
          const h = fbm(lon * 1.6 + 3, lat * 1.6, seed, 6), cloud = fbm(lon * 3 + 10, lat * 4.5, seed + 9, 5);
          if (h < 0.5) { c = ramp([[0, '#06204f'], [0.8, '#0b4aa2'], [1, '#2a86c8']], h / 0.5); spec = 0.55; }
          else c = ramp([[0, '#d8c48a'], [0.08, '#4d7a2a'], [0.4, '#2f5d1c'], [0.7, '#7a5a3a'], [1, '#e8e2d6']], (h - 0.5) / 0.3);
          if (Math.abs(lat) > 1.15 - fbm(lon * 3, lat, seed + 2, 3) * 0.25) c = rgb('#f1f5f9');
          const cl = Math.max(0, cloud - 0.5) * 2.6;
          c = mixRGB(c, [255, 255, 255], Math.min(0.92, cl));
          break;
        }
        case 'moon': {
          const m = fbm(lon * 1.2, lat * 1.2, seed, 5), fine = fbm(nx * 18, ny * 18, seed + 4, 3);
          c = ramp([[0, '#4b4b50'], [0.45, '#8d8d92'], [1, '#d4d4d8']], m * 0.9 + fine * 0.25 - 0.1);
          for (const k of craters) {
            const dx = (nx - k.x) / k.r, dy = (ny - k.y) / k.r, dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 1) c = mixRGB(c, [40, 40, 44], 0.35 * (1 - dd) + (dx * LIGHT[0] + dy * LIGHT[1] > 0 ? 0.25 * dd : 0));
            else if (dd < 1.25) c = mixRGB(c, [235, 235, 240], 0.3 * (1.25 - dd) * 4);
          }
          break;
        }
        case 'ice': {
          const n = fbm(lon * 2, lat * 2, seed, 5), crack = 1 - Math.abs(fbm(lon * 4, lat * 4, seed + 6, 4) * 2 - 1);
          c = ramp([[0, '#7dd3fc'], [0.5, '#e0f2fe'], [1, '#ffffff']], n);
          c = mixRGB(c, rgb('#0369a1'), Math.max(0, crack - 0.86) * 5);
          spec = 0.4;
          break;
        }
        case 'lava': {
          const n = fbm(lon * 2, lat * 2, seed, 5), crack = 1 - Math.abs(fbm(lon * 3.5, lat * 3.5, seed + 6, 5) * 2 - 1);
          c = ramp([[0, '#1c1917'], [1, '#57534e']], n);
          const hot = Math.max(0, crack - 0.82) * 5.5;
          emit = mixRGB([0, 0, 0], ramp([[0, '#991b1b'], [0.5, '#f97316'], [1, '#fde047']], hot), Math.min(1, hot));
          break;
        }
        case 'mars': {
          const n = fbm(lon * 1.8, lat * 1.8, seed, 6), canyon = 1 - Math.abs(fbm(lon * 2.5, lat * 5, seed + 8, 4) * 2 - 1);
          c = ramp([[0, '#5c2410'], [0.45, '#b4532a'], [0.75, '#d9874f'], [1, '#f0c39a']], n);
          c = mixRGB(c, rgb('#3b1607'), Math.max(0, canyon - 0.88) * 6);
          for (const k of craters) { const dx = (nx - k.x) / k.r, dy = (ny - k.y) / k.r, dd = Math.sqrt(dx * dx + dy * dy); if (dd < 1) c = mixRGB(c, [70, 28, 12], 0.3 * (1 - dd)); }
          if (Math.abs(lat) > 1.3) c = rgb('#f8fafc');
          break;
        }
      }
      // Luz: difusa + un poquito de ambiente + brillo (en el agua o el hielo) + lo que brilla solo (la lava).
      const lit = 0.05 + Math.pow(light, 0.85) * 1.05;
      const half = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], hl = Math.hypot(...half);
      const sp = spec * Math.pow(Math.max(0, (nx * half[0] + ny * half[1] + nz * half[2]) / hl), 40) * 255;
      let out: RGB = [c[0] * lit + sp + emit[0], c[1] * lit + sp + emit[1], c[2] * lit + sp + emit[2]];
      // Atmósfera en el borde.
      if (look.atmo) { const rim = Math.pow(1 - nz, 2.5) * Math.min(1, light * 1.8 + 0.15); out = mixRGB(out, rgb(look.atmo), Math.min(0.85, rim)); }
      const edge = Math.min(1, (1 - Math.sqrt(d2)) * px); // borde suave
      return [Math.min(255, out[0]), Math.min(255, out[1]), Math.min(255, out[2]), 255 * edge];
    });
    const cx = W / 2, cy = H / 2;
    const rings = (front: boolean) => {
      if (!look.rings) return;
      g.save();
      g.beginPath(); if (front) g.rect(0, cy, W, H); else g.rect(0, 0, W, cy); g.clip();
      g.translate(cx, cy); g.scale(1, 0.28); g.rotate(0);
      const rr = rng(seed + 11);
      for (let k = 0; k < 70; k++) {
        const rad = 1.3 + k * 0.0135, a = (0.15 + rr() * 0.55) * (k > 34 && k < 38 ? 0.1 : 1);
        g.strokeStyle = css(ramp([[0, '#a58a63'], [0.5, '#e8d6b0'], [1, '#c9ae86']], rr()), a);
        g.lineWidth = 0.016; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    };
    if (look.atmo) glow(g, cx, cy, R * 1.25, look.atmo, 0.35);
    rings(false);
    g.drawImage(tex, cx - R, cy - R, R * 2, R * 2);
    // La sombra de los anillos sobre el planeta.
    if (look.rings) { g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - R, cy + 0.18, R * 2, 0.08); g.restore(); }
    rings(true);
  });
}

// ---------- Nivel 1: la ciudad del futuro ----------
// Como la ciudad que se ve por la ventana de SkynetBall: rascacielos altísimos y finos de vidrio azul noche,
// con tiras de neón celeste, franjas y luces rojas, agujas, anillos de luz y puentes entre las torres.

// Fachada de vidrio: una grilla de ventanitas (casi todas azules, alguna blanca o cálida) con el reflejo del cielo.
function facade(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, w: number, h: number, dim: number, lit = 0.4) {
  g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#22357a', dim)], [0.45, shade('#16245c', dim)], [1, shade('#0a1236', dim)]]); g.fillRect(x, y, w, h);
  const cw = 0.1, ch = 0.14;
  for (let yy = y + 0.06; yy < y + h - 0.08; yy += ch) {
    const band = r();
    for (let xx = x + 0.04; xx < x + w - 0.06; xx += cw) {
      const v = r();
      if (v < lit * (0.4 + band)) {
        g.fillStyle = v < 0.03 ? '#fde68a' : v < 0.1 ? '#f0f9ff' : v < 0.28 ? '#93c5fd' : '#3b82f6';
        g.globalAlpha = 0.6 + r() * 0.4; g.fillRect(xx, yy, cw * 0.62, ch * 0.5); g.globalAlpha = 1;
      } else { g.fillStyle = 'rgba(40,60,140,0.55)'; g.fillRect(xx, yy, cw * 0.62, ch * 0.5); }
    }
  }
  g.fillStyle = lin(g, x, y, x + w * 0.7, y + h * 0.45, [[0, 'rgba(196,160,255,0.25)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h); // reflejo del cielo
  g.fillStyle = 'rgba(147,197,253,0.55)'; g.fillRect(x, y, 0.02, h); // canto iluminado
}
// Tira de neón vertical con su resplandor.
function neon(g: CanvasRenderingContext2D, x: number, y: number, h: number, c = '#38bdf8', wd = 0.03) {
  g.fillStyle = css(rgb(c), 0.16); g.fillRect(x - 0.07, y, wd + 0.14, h);
  g.fillStyle = css(rgb(c), 0.35); g.fillRect(x - 0.025, y, wd + 0.05, h);
  g.fillStyle = c; g.fillRect(x, y, wd, h);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + wd * 0.35, y, wd * 0.3, h);
}
function redBand(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  g.fillStyle = 'rgba(255,42,42,0.22)'; g.fillRect(x, y - 0.05, w, 0.13);
  g.fillStyle = '#ff2a2a'; g.fillRect(x, y, w, 0.03);
}
const TYPES = 7;
// Un rascacielos del futuro. type: 0 aguja, 1 megatorre escalonada con canal de luz, 2 torres gemelas con
// puente, 3 torre redonda con anillos de luz, 4 torre en cuña, 5 torre con pantalla gigante, 6 torre de módulos.
function buildingSprite(type: number, seed: number, near: boolean) {
  const r0 = rng(seed * 13 + type);
  const w = near ? 2.2 + r0() * 1.2 : 1.3 + r0() * 1.1, h = near ? 4.5 + r0() * 3 : 5.5 + r0() * 3.5, extra = 2.8, H = h + extra;
  return sprite(`fut-${near ? 'n' : 'm'}-${type}-${seed}`, w + 0.4, H, (g, s) => {
    const r = rng(seed * 7 + type * 3 + (near ? 99 : 0));
    const x = 0.2, top = H - h, dim = near ? 0 : -0.12;
    const light = (lx: number, ly: number, color = '#ff2a2a', size = 0.04) => s.lights.push({ x: lx, y: ly, color, phase: r() * 6, size });
    const bands = (bx: number, bw: number, from: number) => { for (let y = from + 0.8 + r() * 0.5; y < H - 0.4; y += 1.2 + r() * 1.2) if (r() < 0.6) redBand(g, bx, y, bw); };
    switch (type) {
      case 0: { // aguja: torre finita que se afina arriba y termina en una antena
        facade(g, r, x, top + 0.7, w, h - 0.7, dim);
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#22357a', dim)], [1, shade('#0a1236', dim)]]);
        g.beginPath(); g.moveTo(x, top + 0.7); g.lineTo(x + w * 0.32, top - 0.3); g.lineTo(x + w * 0.68, top - 0.3); g.lineTo(x + w, top + 0.7); g.closePath(); g.fill();
        neon(g, x + 0.04, top + 0.7, h - 0.7); neon(g, x + w - 0.07, top + 0.7, h - 0.7); neon(g, x + w / 2 - 0.015, top - 0.3, h + 0.3, '#7dd3fc', 0.025);
        g.strokeStyle = '#7dd3fc'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(x + 0.04, top + 0.7); g.lineTo(x + w * 0.32, top - 0.3); g.moveTo(x + w - 0.04, top + 0.7); g.lineTo(x + w * 0.68, top - 0.3); g.stroke();
        g.fillStyle = '#94a3b8'; g.fillRect(x + w / 2 - 0.015, top - 2.4, 0.03, 2.1);
        bands(x, w, top + 0.7);
        light(x + w / 2, top - 2.4); light(x + w * 0.32, top - 0.3, '#ff2a2a', 0.03); light(x + w * 0.68, top - 0.3, '#ff2a2a', 0.03);
        break;
      }
      case 1: { // megatorre: el cuerpo central más alto, alas escalonadas y un canal de luz celeste en el medio
        const side = w * 0.3, lh = h * (0.6 + r() * 0.15), rh = h * (0.7 + r() * 0.15);
        facade(g, r, x, H - lh, side, lh, dim - 0.08); facade(g, r, x + w - side, H - rh, side, rh, dim - 0.08);
        facade(g, r, x + side, top, w - side * 2, h, dim);
        const cx = x + w / 2;
        g.fillStyle = lin(g, cx - 0.08, 0, cx + 0.08, 0, [[0, 'rgba(56,189,248,0)'], [0.5, 'rgba(125,211,252,0.95)'], [1, 'rgba(56,189,248,0)']]); g.fillRect(cx - 0.12, top + 0.2, 0.24, h - 0.2);
        g.fillStyle = 'rgba(56,189,248,0.15)'; g.fillRect(cx - 0.3, top + 0.2, 0.6, h - 0.2);
        bands(x + side, w - side * 2, top); redBand(g, x, H - lh + 0.15, side); redBand(g, x + w - side, H - rh + 0.15, side);
        neon(g, x + side, top, h, '#38bdf8', 0.025); neon(g, x + w - side - 0.025, top, h, '#38bdf8', 0.025);
        for (const [mx, mh] of [[cx - 0.25, 1.1], [cx, 1.9], [cx + 0.22, 0.8]] as const) { g.fillStyle = '#94a3b8'; g.fillRect(mx - 0.012, top - mh, 0.025, mh); light(mx, top - mh, '#ff2a2a', 0.035); }
        g.fillStyle = shade('#0a1236', dim); g.fillRect(x + side - 0.05, top - 0.12, w - side * 2 + 0.1, 0.14);
        break;
      }
      case 2: { // torres gemelas unidas por un puente de luz
        const tw = w * 0.38, h2 = h * (0.8 + r() * 0.12);
        facade(g, r, x, top, tw, h, dim); facade(g, r, x + w - tw, H - h2, tw, h2, dim - 0.06);
        for (const [tx, ty] of [[x, top], [x + w - tw, H - h2]] as const) {
          g.fillStyle = shade('#16245c', dim); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + tw / 2, ty - 0.6); g.lineTo(tx + tw, ty); g.fill();
          neon(g, tx + tw / 2 - 0.012, ty - 0.6, H - ty + 0.6, '#7dd3fc', 0.025); light(tx + tw / 2, ty - 0.6);
          redBand(g, tx, ty + 0.4, tw);
        }
        const by = H - h2 + h2 * 0.35;
        g.fillStyle = lin(g, 0, by, 0, by + 0.28, [[0, '#93c5fd'], [0.5, '#1e3a8a'], [1, '#0b1640']]); g.fillRect(x + tw, by, w - tw * 2, 0.28); // el puente
        for (let k = x + tw + 0.08; k < x + w - tw - 0.05; k += 0.12) { g.fillStyle = r() < 0.7 ? '#bae6fd' : '#3b82f6'; g.fillRect(k, by + 0.1, 0.06, 0.07); }
        g.fillStyle = '#38bdf8'; g.fillRect(x + tw, by + 0.27, w - tw * 2, 0.02); g.fillStyle = 'rgba(56,189,248,0.2)'; g.fillRect(x + tw, by + 0.27, w - tw * 2, 0.12);
        break;
      }
      case 3: { // torre redonda con anillos de luz y cúpula
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#0a1236', dim)], [0.35, shade('#2c4592', dim)], [0.55, shade('#1a2b6a', dim)], [1, shade('#070d2a', dim)]]); g.fillRect(x, top, w, h);
        for (let y = top + 0.12; y < H - 0.05; y += 0.15) for (let k = 0; k < 16; k++) {
          const a0 = -Math.PI / 2 + k / 16 * Math.PI, sx = x + w * (0.5 + Math.sin(a0) * 0.5), sx1 = x + w * (0.5 + Math.sin(a0 + Math.PI / 16) * 0.5);
          if (r() < 0.45) { g.fillStyle = r() < 0.75 ? '#60a5fa' : '#e0f2fe'; g.globalAlpha = 0.4 + Math.cos(a0) * 0.6; g.fillRect(sx, y, Math.max(0.004, sx1 - sx - 0.012), 0.07); g.globalAlpha = 1; }
        }
        for (let y = top + 0.9; y < H - 0.5; y += 1.3) { // anillos
          g.strokeStyle = 'rgba(56,189,248,0.25)'; g.lineWidth = 0.12; g.beginPath(); g.ellipse(x + w / 2, y, w * 0.62, 0.12, 0, 0, Math.PI); g.stroke();
          g.strokeStyle = '#7dd3fc'; g.lineWidth = 0.035; g.beginPath(); g.ellipse(x + w / 2, y, w * 0.62, 0.12, 0, 0, Math.PI); g.stroke();
          g.strokeStyle = 'rgba(125,211,252,0.35)'; g.lineWidth = 0.02; g.beginPath(); g.ellipse(x + w / 2, y, w * 0.62, 0.12, 0, Math.PI, Math.PI * 2); g.stroke();
        }
        g.fillStyle = lin(g, x, top - 0.6, x + w, top, [[0, '#93c5fd'], [1, '#1e3a8a']]); g.beginPath(); g.ellipse(x + w / 2, top, w / 2, 0.55, 0, Math.PI, 0); g.fill(); // cúpula
        g.strokeStyle = 'rgba(224,242,254,0.6)'; g.lineWidth = 0.015; for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(x + w / 2, top, w / 2 * k / 5, 0.55, 0, Math.PI, 0); g.stroke(); }
        g.fillStyle = '#94a3b8'; g.fillRect(x + w / 2 - 0.012, top - 1.5, 0.025, 1); light(x + w / 2, top - 1.5);
        break;
      }
      case 4: { // torre en cuña: el techo en diagonal con tiras de luz que bajan
        const low = top + h * 0.25;
        g.save(); g.beginPath(); g.moveTo(x, low); g.lineTo(x + w, top); g.lineTo(x + w, H); g.lineTo(x, H); g.closePath(); g.clip();
        facade(g, r, x, top, w, h, dim); g.restore();
        const c = r() < 0.5 ? '#f472b6' : '#a78bfa';
        g.strokeStyle = css(rgb(c), 0.25); g.lineWidth = 0.12; g.beginPath(); g.moveTo(x, low); g.lineTo(x + w, top); g.stroke();
        g.strokeStyle = c; g.lineWidth = 0.035; g.beginPath(); g.moveTo(x, low); g.lineTo(x + w, top); g.stroke();
        for (let k = 1; k < 4; k++) { const fx = x + w * k / 4; g.strokeStyle = css(rgb('#38bdf8'), 0.7); g.lineWidth = 0.02; g.beginPath(); g.moveTo(fx, low - (low - top) * k / 4); g.lineTo(fx, H); g.stroke(); }
        bands(x, w, low);
        g.fillStyle = '#94a3b8'; g.fillRect(x + w - 0.1, top - 1.3, 0.025, 1.3); light(x + w - 0.09, top - 1.3);
        break;
      }
      case 5: { // torre con pantalla gigante roja
        facade(g, r, x, top, w, h, dim);
        neon(g, x + 0.04, top, h); neon(g, x + w - 0.07, top, h);
        const sw = w - 0.3, sh = Math.min(1.4, sw * 0.65), sx = x + 0.15, sy = top + 0.6;
        g.fillStyle = 'rgba(255,42,42,0.18)'; g.fillRect(sx - 0.12, sy - 0.12, sw + 0.24, sh + 0.24);
        g.fillStyle = '#12040a'; g.fillRect(sx, sy, sw, sh);
        g.strokeStyle = '#ff3b3b'; g.lineWidth = 0.035; g.strokeRect(sx + 0.04, sy + 0.04, sw - 0.08, sh - 0.08);
        const tcx = sx + sw / 2, tcy = sy + sh * 0.45, tr = sh * 0.28;
        g.fillStyle = '#ff2a2a'; g.beginPath(); g.moveTo(tcx, tcy - tr); g.lineTo(tcx + tr * 1.1, tcy + tr * 0.8); g.lineTo(tcx - tr * 1.1, tcy + tr * 0.8); g.closePath(); g.fill();
        g.fillStyle = '#12040a'; g.beginPath(); g.moveTo(tcx, tcy - tr * 0.1); g.lineTo(tcx + tr * 0.4, tcy + tr * 0.6); g.lineTo(tcx - tr * 0.4, tcy + tr * 0.6); g.closePath(); g.fill();
        g.fillStyle = '#ff6b6b'; for (let k = 0; k < 4; k++) g.fillRect(sx + sw * 0.2 + k * sw * 0.16, sy + sh * 0.82, sw * 0.12, 0.04); // texto
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = sy; y < sy + sh; y += 0.04) g.fillRect(sx, y, sw, 0.012); // líneas de pantalla
        g.fillStyle = shade('#0a1236', dim); g.fillRect(x - 0.05, top - 0.1, w + 0.1, 0.12);
        g.fillStyle = '#94a3b8'; g.fillRect(x + w * 0.25, top - 1, 0.025, 1); light(x + w * 0.25, top - 1);
        break;
      }
      case 6: { // torre de módulos: un núcleo con cápsulas que salen para los costados
        const cw = w * 0.34, cx = x + (w - cw) / 2;
        facade(g, r, cx, top, cw, h, dim);
        neon(g, cx + cw / 2 - 0.015, top, h, '#7dd3fc', 0.03);
        for (let y = top + 0.4; y < H - 0.4; y += 0.55) {
          const left = Math.floor((y - top) / 0.55) % 2 === 0, pw = (w - cw) / 2 + 0.2 + r() * 0.2, px = left ? cx - pw + 0.1 : cx + cw - 0.1;
          g.fillStyle = lin(g, 0, y, 0, y + 0.38, [[0, shade('#2c4592', dim)], [1, shade('#0b1640', dim)]]);
          g.beginPath(); g.roundRect(px, y, pw, 0.38, 0.12); g.fill();
          for (let k = px + 0.1; k < px + pw - 0.1; k += 0.13) { g.fillStyle = r() < 0.6 ? '#93c5fd' : '#fde68a'; g.globalAlpha = 0.85; g.fillRect(k, y + 0.12, 0.08, 0.12); g.globalAlpha = 1; }
          g.fillStyle = '#38bdf8'; g.fillRect(px + 0.1, y + 0.36, pw - 0.2, 0.02);
        }
        g.fillStyle = '#94a3b8'; g.fillRect(cx + cw / 2 - 0.012, top - 1.6, 0.025, 1.6); light(cx + cw / 2, top - 1.6);
        break;
      }
    }
    g.fillStyle = lin(g, 0, H - 0.8, 0, H, [[0, 'rgba(56,189,248,0)'], [1, 'rgba(56,189,248,0.18)']]); g.fillRect(x, H - 0.8, w, 0.8); // luz de la calle
  });
}
// El horizonte, lejos: torres finitas y altísimas en la niebla azul, con agujas y luces rojas.
function skylineSprite() {
  const W = 40, H = 9.8;
  return sprite('skyline-fut', W, H, (g, s) => {
    const r = rng(78);
    let x = 0;
    while (x < W - 0.6) {
      const w = 0.35 + r() * 0.8, h = 4 + r() * 5.3, top = H - h, kind = Math.floor(r() * 4);
      g.fillStyle = css(mixRGB(rgb('#2b3a85'), rgb('#3f4c9c'), r())); g.fillRect(x, top, w, h);
      if (kind === 1) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + w / 2, top - 0.7); g.lineTo(x + w, top); g.fill(); }
      if (kind === 2) { g.fillRect(x + w * 0.25, top - 0.6, w * 0.5, 0.6); }
      g.fillRect(x + w / 2 - 0.012, top - 1.5, 0.025, 1.5); s.lights.push({ x: x + w / 2, y: top - 1.5, color: '#ff4d4d', phase: r() * 6, size: 0.025 });
      if (r() < 0.6) { g.fillStyle = 'rgba(125,211,252,0.55)'; g.fillRect(x + w * (0.2 + r() * 0.6), top, 0.02, h); }
      for (let y = top + 0.12; y < H; y += 0.13) for (let wx = x + 0.05; wx < x + w - 0.04; wx += 0.08) if (r() < 0.14) { g.fillStyle = r() < 0.85 ? 'rgba(147,197,253,0.65)' : 'rgba(254,226,226,0.7)'; g.fillRect(wx, y, 0.035, 0.04); }
      if (r() < 0.25) { g.fillStyle = 'rgba(255,42,42,0.7)'; g.fillRect(x, top + h * 0.3, w, 0.02); }
      x += w + r() * 0.12 - 0.04;
    }
    g.fillStyle = lin(g, 0, H * 0.35, 0, H, [[0, 'rgba(192,132,252,0)'], [1, 'rgba(192,132,252,0.42)']]); g.fillRect(0, H * 0.35, W, H * 0.65);
  });
}

function city(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, time: number) {
  // Neblina violeta del horizonte y nubes finas iluminadas por la ciudad.
  each(cam, l0, l1, 0.02, 7, (x, i) => {
    for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(167,139,250,${0.05 + hash(i * 3 + k) * 0.05})`; ctx.beginPath(); ctx.ellipse(x + hash(i + k) * 5, 1.4 + hash(i * 7 + k) * 2.2, 2 + hash(k + i) * 2, 0.1 + hash(i + k * 5) * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  const sky = skylineSprite();
  if (sky) each(cam, l0, l1, 0.05, sky.w, x => { ctx.drawImage(sky.img, x, ROWS - sky.h, sky.w + 0.02, sky.h); blinkLights(ctx, sky, x, ROWS - sky.h, time); });
  const building = (near: boolean, factor: number, gap: number, count: number) => each(cam, l0, l1, factor, gap, (x, i) => {
    const k = ((i % count) + count) % count, type = (k * 3) % TYPES, s = buildingSprite(type, k, near);
    if (!s) return;
    const bx = x + (gap - s.w) * hash(i + (near ? 50 : 0)) * 0.6;
    ctx.drawImage(s.img, bx, ROWS - s.h, s.w, s.h);
    blinkLights(ctx, s, bx, ROWS - s.h, time);
  });
  building(false, 0.13, 2.6, 21);
  // Autopista elevada que serpentea entre los edificios, con su baranda de luz roja y pilares con luz celeste.
  const off = cam * 0.2, road = (x: number) => ROWS - 2.9 + Math.sin((x + off) * 0.22) * 0.45;
  ctx.fillStyle = 'rgba(10,16,48,0.95)';
  for (let x = Math.floor((l0 + off) / 3.5) * 3.5 - off; x < l1 + 3.5; x += 3.5) { ctx.fillRect(x, road(x) + 0.25, 0.24, ROWS - road(x)); ctx.fillStyle = 'rgba(56,189,248,0.6)'; ctx.fillRect(x + 0.1, road(x) + 0.35, 0.03, ROWS - road(x)); ctx.fillStyle = 'rgba(10,16,48,0.95)'; }
  for (const [dy, th, color] of [[0, 0.28, '#0d1440'], [-0.06, 0.06, '#1e2a63']] as const) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(l0 - 1, road(l0 - 1) + dy);
    for (let x = l0 - 1; x <= l1 + 1; x += 0.25) ctx.lineTo(x, road(x) + dy);
    for (let x = l1 + 1; x >= l0 - 1; x -= 0.25) ctx.lineTo(x, road(x) + dy + th);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,42,42,0.9)'; ctx.lineWidth = 0.03; ctx.beginPath(); for (let x = l0 - 1; x <= l1 + 1; x += 0.25) { if (x === l0 - 1) ctx.moveTo(x, road(x) - 0.07); else ctx.lineTo(x, road(x) - 0.07); } ctx.stroke();
  ctx.strokeStyle = 'rgba(125,211,252,0.85)'; ctx.lineWidth = 0.02; ctx.beginPath(); for (let x = l0 - 1; x <= l1 + 1; x += 0.25) { if (x === l0 - 1) ctx.moveTo(x, road(x) + 0.27); else ctx.lineTo(x, road(x) + 0.27); } ctx.stroke();
  ctx.fillStyle = lin(ctx, 0, ROWS * 0.5, 0, ROWS, [[0, 'rgba(192,132,252,0)'], [1, 'rgba(168,85,247,0.22)']]); ctx.fillRect(l0, ROWS * 0.5, l1 - l0, ROWS * 0.5);
  building(true, 0.26, 3.8, 14);
}

// ---------- Nivel 2: el espacio con planetas ----------

const PLANETS: PlanetLook[] = [
  { kind: 'gas', rings: true, atmo: '#fde68a' }, { kind: 'earth', atmo: '#60a5fa' }, { kind: 'moon' }, { kind: 'lava', atmo: '#f97316' },
  { kind: 'ice', atmo: '#bae6fd' }, { kind: 'mars', atmo: '#fb923c' }, { kind: 'neptune', atmo: '#93c5fd' }, { kind: 'gas', atmo: '#fcd34d' },
];
function space(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number) {
  drawStarField(ctx, starField('stars-mines', ['#3b0764', '#7c3aed', '#f0abfc'], 21), cam, l0, l1, 0.015, 0);
  // Planetas a distintas distancias: los más lejos son más chicos y se mueven menos.
  for (const [factor, gap, base, spread, yMin, yMax, off] of [[0.02, 11, 0.55, 0.5, 1.3, 4.5, 0], [0.045, 15, 1.1, 0.9, 1.5, 5, 3]] as const) {
    each(cam, l0, l1, factor, gap, (x, i) => {
      const n = PLANETS.length, k = (((i + off) * 5) % n + n) % n, look = PLANETS[k], p = planetSprite(look, 10 + k);
      if (!p) return;
      const size = base + hash(i * 3 + off) * spread, px = x + hash(i + off) * (gap - 3), py = yMin + hash(i * 7 + off) * (yMax - yMin);
      ctx.drawImage(p.img, px - size * p.w / 2, py - size * p.h / 2, size * p.w, size * p.h);
      // Una luna chiquita al lado de algunos.
      if (hash(i * 11 + off) > 0.55 && look.kind !== 'moon') { const m = planetSprite({ kind: 'moon' }, 40 + (i & 3)); if (m) { const ms = size * 0.22; ctx.drawImage(m.img, px + size * 1.3 - ms * m.w / 2, py - size * 0.6 - ms * m.h / 2, ms * m.w, ms * m.h); } }
    });
  }
}

// ---------- Nivel 3: naves por las ventanas ----------

interface Palette { hull: string; accent: string; trim: string; glass: string; flame: string }
const PALETTES: Palette[] = [
  { hull: '#e5e7eb', accent: '#ef4444', trim: '#1f2937', glass: '#38bdf8', flame: '#60a5fa' },
  { hull: '#94a3b8', accent: '#f59e0b', trim: '#0f172a', glass: '#a5f3fc', flame: '#f97316' },
  { hull: '#c7d2fe', accent: '#8b5cf6', trim: '#1e1b4b', glass: '#f0abfc', flame: '#c084fc' },
  { hull: '#d1fae5', accent: '#10b981', trim: '#064e3b', glass: '#fde047', flame: '#34d399' },
];
// Chapas del casco: líneas, remaches y detallecitos (antenas, escotillas).
function plating(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, w: number, h: number, trim: string) {
  g.strokeStyle = css(rgb(trim), 0.35); g.lineWidth = 0.008;
  for (let px = x + 0.12; px < x + w; px += 0.1 + r() * 0.15) { g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke(); }
  for (let py = y + 0.08; py < y + h; py += 0.08 + r() * 0.08) { const a = x + r() * w * 0.5; g.beginPath(); g.moveTo(a, py); g.lineTo(a + r() * w * 0.5, py); g.stroke(); }
  for (let i = 0; i < w * h * 30; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'; g.fillRect(x + r() * w, y + r() * h, 0.015 + r() * 0.04, 0.01 + r() * 0.025); }
}
function hullGrad(g: CanvasRenderingContext2D, y0: number, y1: number, c: string) {
  return lin(g, 0, y0, 0, y1, [[0, shade(c, 0.45)], [0.35, c], [0.8, shade(c, -0.35)], [1, shade(c, -0.6)]]);
}
// Una nave (mirando a la derecha). design: 0 transbordador, 1 carguero con contenedores, 2 platillo,
// 3 caza estelar, 4 crucero de batalla, 5 sonda con paneles solares, 6 cohete clásico, 7 nave de pasajeros.
function shipSprite(design: number, pal: number) {
  const P_ = PALETTES[pal % PALETTES.length];
  const W = [2.8, 3.2, 2, 2.2, 3.4, 2.8, 2.4, 3][design], H = [1.3, 1.1, 1, 1, 1.4, 1.8, 1, 1][design];
  return sprite(`ship-${design}-${pal}`, W, H, (g, s) => {
    const r = rng(design * 31 + pal * 7);
    const { hull, accent, trim, glass } = P_;
    const outline = () => { g.strokeStyle = '#05070d'; g.lineWidth = 0.025; g.stroke(); };
    const eng = (x: number, y: number, rr: number) => s.engines.push({ x, y, r: rr, color: P_.flame });
    const cy = H / 2;
    switch (design) {
      case 0: { // transbordador
        g.fillStyle = hullGrad(g, cy - 0.3, cy + 0.6, '#475569'); g.beginPath(); g.moveTo(0.8, cy + 0.15); g.lineTo(1.9, cy + 0.15); g.lineTo(1.2, cy + 0.6); g.lineTo(0.6, cy + 0.6); g.closePath(); g.fill(); outline(); // ala
        g.fillStyle = hullGrad(g, cy - 0.3, cy + 0.25, hull); g.beginPath(); g.moveTo(0.3, cy - 0.25); g.lineTo(2.2, cy - 0.25); g.quadraticCurveTo(2.75, cy - 0.15, 2.75, cy + 0.05); g.quadraticCurveTo(2.6, cy + 0.25, 2.2, cy + 0.25); g.lineTo(0.3, cy + 0.25); g.closePath(); g.fill(); outline();
        plating(g, r, 0.35, cy - 0.22, 1.8, 0.45, trim);
        g.fillStyle = '#111827'; g.beginPath(); g.moveTo(0.3, cy + 0.12); g.lineTo(2.4, cy + 0.12); g.quadraticCurveTo(2.7, cy + 0.12, 2.6, cy + 0.2); g.lineTo(0.3, cy + 0.25); g.fill(); // panza de cerámica
        g.fillStyle = '#111827'; g.beginPath(); g.moveTo(2.55, cy - 0.17); g.quadraticCurveTo(2.78, cy - 0.05, 2.73, cy + 0.08); g.lineTo(2.6, cy + 0.02); g.fill(); // nariz
        g.fillStyle = hullGrad(g, cy - 0.65, cy - 0.25, hull); g.beginPath(); g.moveTo(0.3, cy - 0.25); g.lineTo(0.55, cy - 0.65); g.lineTo(0.75, cy - 0.65); g.lineTo(0.85, cy - 0.25); g.fill(); outline(); // cola
        g.fillStyle = accent; g.fillRect(0.6, cy - 0.55, 0.12, 0.05);
        for (let k = 0; k < 4; k++) { g.fillStyle = '#0f172a'; g.fillRect(2.18 + k * 0.08, cy - 0.17, 0.06, 0.07); g.fillStyle = css(rgb(glass), 0.6); g.fillRect(2.19 + k * 0.08, cy - 0.16, 0.03, 0.02); }
        g.fillStyle = accent; g.fillRect(1.2, cy - 0.08, 0.5, 0.03); g.fillStyle = '#1d4ed8'; g.fillRect(1.2, cy - 0.04, 0.5, 0.03);
        for (const ey of [cy - 0.12, cy + 0.03]) { g.fillStyle = '#334155'; g.fillRect(0.12, ey - 0.07, 0.2, 0.14); outline(); eng(0.12, ey, 0.07); }
        s.lights.push({ x: 2.2, y: cy - 0.25, color: '#ef4444', phase: 1, size: 0.02 });
        break;
      }
      case 1: { // carguero con contenedores de colores
        g.fillStyle = hullGrad(g, cy - 0.06, cy + 0.06, '#4b5563'); g.fillRect(0.3, cy - 0.05, 2.4, 0.1); // la columna
        const colors = ['#dc2626', '#2563eb', '#f59e0b', '#16a34a', '#7c3aed', '#0891b2', accent];
        for (let col = 0; col < 6; col++) for (let row = 0; row < 2; row++) for (const side of [-1, 1]) {
          const bx = 0.5 + col * 0.33, by = side < 0 ? cy - 0.08 - (row + 1) * 0.17 : cy + 0.08 + row * 0.17, c = colors[Math.floor(r() * colors.length)];
          if (r() < 0.12) continue;
          g.fillStyle = hullGrad(g, by, by + 0.16, c); g.fillRect(bx, by, 0.31, 0.16);
          g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.008; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(bx + k * 0.052, by); g.lineTo(bx + k * 0.052, by + 0.16); g.stroke(); }
          g.strokeStyle = '#05070d'; g.lineWidth = 0.015; g.strokeRect(bx, by, 0.31, 0.16);
        }
        g.fillStyle = hullGrad(g, cy - 0.35, cy + 0.3, hull); g.beginPath(); g.moveTo(2.5, cy - 0.3); g.lineTo(2.95, cy - 0.2); g.lineTo(3.15, cy + 0.05); g.lineTo(2.95, cy + 0.3); g.lineTo(2.5, cy + 0.3); g.closePath(); g.fill(); outline(); // puente
        plating(g, r, 2.52, cy - 0.27, 0.45, 0.55, trim);
        g.fillStyle = css(rgb(glass), 0.9); g.fillRect(2.9, cy - 0.12, 0.15, 0.06); glow(g, 2.97, cy - 0.09, 0.15, glass, 0.4);
        g.fillStyle = hullGrad(g, cy - 0.3, cy + 0.3, '#374151'); g.fillRect(0.05, cy - 0.3, 0.3, 0.6); g.strokeStyle = '#05070d'; g.lineWidth = 0.02; g.strokeRect(0.05, cy - 0.3, 0.3, 0.6);
        for (const ey of [cy - 0.18, cy, cy + 0.18]) eng(0.05, ey, 0.07);
        s.lights.push({ x: 3.1, y: cy + 0.05, color: '#22c55e', phase: 0, size: 0.02 }, { x: 0.2, y: cy - 0.32, color: '#ef4444', phase: 2, size: 0.02 });
        break;
      }
      case 2: { // platillo volador
        glow(g, 1, cy + 0.2, 0.7, accent, 0.35);
        g.fillStyle = lin(g, 0.6, cy - 0.45, 1.4, cy - 0.05, [[0, 'rgba(240,250,255,0.95)'], [1, css(rgb(glass), 0.55)]]); g.beginPath(); g.ellipse(1, cy - 0.08, 0.38, 0.34, 0, Math.PI, 0); g.fill(); outline(); // la cúpula
        g.fillStyle = '#4ade80'; g.beginPath(); g.arc(1, cy - 0.16, 0.1, 0, Math.PI * 2); g.fill(); g.fillStyle = '#000'; g.fillRect(0.95, cy - 0.19, 0.03, 0.04); g.fillRect(1.02, cy - 0.19, 0.03, 0.04); // un alien
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(0.88, cy - 0.28, 0.08, 0.04, -0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = lin(g, 0, cy - 0.12, 0, cy + 0.16, [[0, shade(hull, 0.5)], [0.45, hull], [0.55, shade(hull, -0.3)], [1, shade(hull, -0.6)]]); g.beginPath(); g.ellipse(1, cy, 0.92, 0.17, 0, 0, Math.PI * 2); g.fill(); outline();
        g.strokeStyle = css(rgb(trim), 0.5); g.lineWidth = 0.01; g.beginPath(); g.ellipse(1, cy, 0.7, 0.1, 0, 0, Math.PI); g.stroke();
        for (let k = 0; k < 9; k++) { const a = Math.PI * (0.1 + k * 0.1), lx = 1 + Math.cos(a) * 0.8, ly = cy + Math.sin(a) * 0.12; s.lights.push({ x: lx, y: ly, color: k % 2 ? accent : '#fde047', phase: k * 0.8, size: 0.025 }); }
        g.fillStyle = shade(hull, -0.5); g.beginPath(); g.ellipse(1, cy + 0.14, 0.35, 0.07, 0, 0, Math.PI); g.fill();
        break;
      }
      case 3: { // caza estelar
        g.fillStyle = hullGrad(g, cy - 0.45, cy + 0.45, shade(hull, -0.15)); g.beginPath(); g.moveTo(0.5, cy - 0.05); g.lineTo(1.1, cy - 0.45); g.lineTo(1.35, cy - 0.45); g.lineTo(1.2, cy - 0.05); g.closePath(); g.fill(); outline();
        g.beginPath(); g.moveTo(0.5, cy + 0.05); g.lineTo(1.1, cy + 0.45); g.lineTo(1.35, cy + 0.45); g.lineTo(1.2, cy + 0.05); g.closePath(); g.fill(); outline();
        g.fillStyle = accent; g.fillRect(1.05, cy - 0.42, 0.25, 0.04); g.fillRect(1.05, cy + 0.38, 0.25, 0.04);
        g.fillStyle = '#9ca3af'; g.fillRect(1.25, cy - 0.47, 0.5, 0.03); g.fillRect(1.25, cy + 0.44, 0.5, 0.03); // cañones
        g.fillStyle = hullGrad(g, cy - 0.14, cy + 0.14, hull); g.beginPath(); g.moveTo(0.15, cy - 0.12); g.lineTo(1.5, cy - 0.12); g.lineTo(2.15, cy); g.lineTo(1.5, cy + 0.12); g.lineTo(0.15, cy + 0.12); g.closePath(); g.fill(); outline();
        plating(g, r, 0.2, cy - 0.1, 1.3, 0.2, trim);
        g.fillStyle = accent; g.beginPath(); g.moveTo(1.5, cy - 0.12); g.lineTo(2.15, cy); g.lineTo(1.9, cy); g.lineTo(1.4, cy - 0.12); g.fill();
        g.fillStyle = lin(g, 1.2, cy - 0.22, 1.6, cy - 0.08, [[0, '#f0f9ff'], [0.4, glass], [1, shade(glass, -0.6)]]); g.beginPath(); g.ellipse(1.4, cy - 0.11, 0.25, 0.09, 0, Math.PI, 0); g.fill(); outline();
        eng(0.15, cy - 0.05, 0.06); eng(0.15, cy + 0.05, 0.06);
        s.lights.push({ x: 1.3, y: cy - 0.45, color: '#ef4444', phase: 0, size: 0.018 }, { x: 1.3, y: cy + 0.45, color: '#22c55e', phase: 3, size: 0.018 });
        break;
      }
      case 4: { // crucero de batalla
        g.fillStyle = hullGrad(g, cy - 0.35, cy + 0.4, hull); g.beginPath(); g.moveTo(0.2, cy - 0.3); g.lineTo(2.2, cy - 0.3); g.lineTo(3.35, cy + 0.05); g.lineTo(2.2, cy + 0.4); g.lineTo(0.2, cy + 0.4); g.closePath(); g.fill(); outline();
        plating(g, r, 0.25, cy - 0.27, 2.6, 0.62, trim);
        for (let k = 0; k < 40; k++) { const wx = 0.4 + r() * 2.2, wy = cy - 0.2 + r() * 0.5; if (wy > cy - 0.25 + (wx - 2.2) * 0.3 * (wx > 2.2 ? 1 : 0)) { g.fillStyle = r() < 0.7 ? '#fde68a' : glass; g.fillRect(wx, wy, 0.025, 0.012); } }
        g.fillStyle = accent; g.beginPath(); g.moveTo(2.2, cy - 0.3); g.lineTo(3.35, cy + 0.05); g.lineTo(3.1, cy + 0.05); g.lineTo(2.1, cy - 0.25); g.fill();
        g.fillStyle = hullGrad(g, cy - 0.62, cy - 0.3, shade(hull, -0.1)); g.beginPath(); g.moveTo(0.6, cy - 0.3); g.lineTo(0.75, cy - 0.6); g.lineTo(1.2, cy - 0.6); g.lineTo(1.35, cy - 0.3); g.fill(); outline(); // torre de mando
        g.fillStyle = css(rgb(glass), 0.9); g.fillRect(0.82, cy - 0.53, 0.32, 0.04);
        for (const tx of [1.6, 2.1, 2.5]) { g.fillStyle = shade(hull, -0.3); g.beginPath(); g.arc(tx, cy - 0.3, 0.07, Math.PI, 0); g.fill(); outline(); g.fillStyle = '#4b5563'; g.fillRect(tx, cy - 0.36, 0.18, 0.025); } // torretas
        g.fillStyle = '#1f2937'; g.fillRect(0.05, cy - 0.25, 0.18, 0.6);
        for (const ey of [cy - 0.15, cy + 0.05, cy + 0.25]) eng(0.05, ey, 0.09);
        s.lights.push({ x: 0.97, y: cy - 0.62, color: '#ef4444', phase: 0, size: 0.02 }, { x: 3.3, y: cy + 0.05, color: '#ffffff', phase: 1.5, size: 0.02 });
        break;
      }
      case 5: { // sonda con paneles solares y antena
        for (const side of [-1, 1]) {
          g.strokeStyle = '#9ca3af'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(1.4, cy); g.lineTo(1.4, cy + side * 0.25); g.stroke();
          for (let k = 0; k < 2; k++) {
            const py = side < 0 ? cy - 0.25 - (k + 1) * 0.3 : cy + 0.25 + k * 0.3;
            g.fillStyle = lin(g, 0.6, py, 2.2, py + 0.28, [[0, '#1e3a8a'], [0.5, '#2563eb'], [1, '#172554']]); g.fillRect(0.7, py, 1.4, 0.28);
            g.strokeStyle = 'rgba(147,197,253,0.6)'; g.lineWidth = 0.006; for (let gx = 0.7; gx <= 2.1; gx += 0.1) { g.beginPath(); g.moveTo(gx, py); g.lineTo(gx, py + 0.28); g.stroke(); } for (let gy = py; gy <= py + 0.28; gy += 0.07) { g.beginPath(); g.moveTo(0.7, gy); g.lineTo(2.1, gy); g.stroke(); }
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0.7, py); g.lineTo(1.2, py); g.lineTo(0.9, py + 0.28); g.lineTo(0.7, py + 0.28); g.fill();
            g.strokeStyle = '#d1d5db'; g.lineWidth = 0.012; g.strokeRect(0.7, py, 1.4, 0.28);
          }
        }
        g.fillStyle = hullGrad(g, cy - 0.2, cy + 0.2, '#d4a648'); g.fillRect(0.9, cy - 0.18, 1, 0.36); g.strokeStyle = '#05070d'; g.lineWidth = 0.02; g.strokeRect(0.9, cy - 0.18, 1, 0.36); // cuerpo con lámina dorada
        for (let k = 0; k < 30; k++) { g.fillStyle = r() < 0.5 ? 'rgba(120,80,10,0.4)' : 'rgba(255,240,180,0.4)'; g.fillRect(0.9 + r(), cy - 0.18 + r() * 0.36, 0.05, 0.03); }
        g.fillStyle = hullGrad(g, cy - 0.3, cy + 0.3, hull); g.beginPath(); g.ellipse(2.2, cy, 0.12, 0.35, 0, 0, Math.PI * 2); g.fill(); outline(); // antena parabólica
        g.strokeStyle = '#9ca3af'; g.lineWidth = 0.015; g.beginPath(); g.moveTo(1.9, cy); g.lineTo(2.2, cy); g.lineTo(2.45, cy); g.stroke();
        g.fillStyle = accent; g.fillRect(0.95, cy - 0.04, 0.9, 0.03);
        eng(0.9, cy, 0.05);
        s.lights.push({ x: 2.45, y: cy, color: accent, phase: 0, size: 0.02 });
        break;
      }
      case 6: { // cohete clásico
        for (const side of [-1, 1]) { g.fillStyle = accent; g.beginPath(); g.moveTo(0.3, cy + side * 0.15); g.lineTo(0.05, cy + side * 0.45); g.lineTo(0.55, cy + side * 0.2); g.closePath(); g.fill(); outline(); }
        g.fillStyle = hullGrad(g, cy - 0.22, cy + 0.22, hull); g.beginPath(); g.moveTo(0.2, cy - 0.2); g.lineTo(1.6, cy - 0.22); g.quadraticCurveTo(2.35, cy - 0.15, 2.4, cy); g.quadraticCurveTo(2.35, cy + 0.15, 1.6, cy + 0.22); g.lineTo(0.2, cy + 0.2); g.closePath(); g.fill(); outline();
        g.fillStyle = accent; g.beginPath(); g.moveTo(1.9, cy - 0.2); g.quadraticCurveTo(2.35, cy - 0.15, 2.4, cy); g.quadraticCurveTo(2.35, cy + 0.15, 1.9, cy + 0.2); g.fill();
        for (const bx of [0.7, 1.4]) { g.fillStyle = accent; g.fillRect(bx, cy - 0.22, 0.08, 0.44); }
        for (const wx of [1.05, 1.65]) { g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(wx, cy, 0.09, 0, Math.PI * 2); g.fill(); outline(); g.fillStyle = lin(g, wx - 0.06, cy - 0.06, wx + 0.06, cy + 0.06, [[0, '#f0f9ff'], [0.5, glass], [1, shade(glass, -0.6)]]); g.beginPath(); g.arc(wx, cy, 0.065, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#334155'; g.fillRect(0.08, cy - 0.12, 0.14, 0.24);
        eng(0.08, cy, 0.1);
        break;
      }
      case 7: { // nave de pasajeros, larga, con muchas ventanitas
        g.fillStyle = hullGrad(g, cy - 0.28, cy + 0.28, hull); g.beginPath(); g.moveTo(0.25, cy - 0.22); g.lineTo(2.4, cy - 0.25); g.quadraticCurveTo(2.95, cy - 0.2, 2.95, cy + 0.02); g.quadraticCurveTo(2.9, cy + 0.25, 2.4, cy + 0.25); g.lineTo(0.25, cy + 0.22); g.closePath(); g.fill(); outline();
        plating(g, r, 0.3, cy - 0.2, 2.3, 0.42, trim);
        g.fillStyle = accent; g.fillRect(0.25, cy + 0.05, 2.55, 0.05); g.fillStyle = shade(accent, 0.4); g.fillRect(0.25, cy + 0.1, 2.5, 0.02);
        for (let wx = 0.45; wx < 2.45; wx += 0.09) { g.fillStyle = r() < 0.85 ? '#fde68a' : '#1e293b'; g.beginPath(); g.ellipse(wx, cy - 0.06, 0.025, 0.035, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = lin(g, 2.6, cy - 0.18, 2.9, cy, [[0, '#f0f9ff'], [1, glass]]); g.beginPath(); g.moveTo(2.55, cy - 0.17); g.quadraticCurveTo(2.85, cy - 0.15, 2.9, cy - 0.04); g.lineTo(2.6, cy - 0.06); g.fill(); outline();
        g.fillStyle = hullGrad(g, cy - 0.5, cy - 0.2, shade(hull, -0.1)); g.beginPath(); g.moveTo(0.3, cy - 0.22); g.lineTo(0.45, cy - 0.5); g.lineTo(0.7, cy - 0.5); g.lineTo(0.85, cy - 0.22); g.fill(); outline();
        g.fillStyle = accent; g.fillRect(0.48, cy - 0.44, 0.18, 0.04);
        g.fillStyle = '#334155'; g.fillRect(0.08, cy - 0.15, 0.2, 0.3); eng(0.08, cy - 0.07, 0.07); eng(0.08, cy + 0.07, 0.07);
        s.lights.push({ x: 0.58, y: cy - 0.5, color: '#ef4444', phase: 0, size: 0.02 }, { x: 2.9, y: cy + 0.1, color: '#ffffff', phase: 2, size: 0.02 });
        break;
      }
    }
  });
}
// Lo que se ve por cada ventana: el espacio (con una nebulosa de otro color, y a veces un planeta o una galaxia).
function windowView(v: number) {
  const W = 3.4, H = 5;
  const hues: [string, string][] = [['#1e1b4b', '#7c3aed'], ['#042f2e', '#0d9488'], ['#3b0764', '#db2777'], ['#0c1445', '#2563eb'], ['#3f0d12', '#ea580c'], ['#052e16', '#16a34a'], ['#1e1b4b', '#c026d3'], ['#082f49', '#0ea5e9']];
  const [h0, h1] = hues[v % hues.length];
  return sprite(`window-${v}`, W, H, g => {
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#01030a'], [1, shade(h0, -0.4)]]); g.fillRect(0, 0, W, H);
    const neb = pixels(W * 16, H * 16, (x, y) => {
      const u = x / 16, w = y / 16, n = fbm(u * 0.8 + v * 3, w * 0.8, v + 3, 5), k = Math.max(0, n - 0.45) * 2.6;
      const c = ramp([[0, h0], [0.6, h1], [1, '#fdf4ff']], k);
      return [c[0], c[1], c[2], Math.min(255, k * 200)];
    });
    g.drawImage(neb, 0, 0, W, H);
    const r = rng(v * 17 + 5);
    for (let i = 0; i < 260; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.fillStyle = r() < 0.8 ? '#ffffff' : '#bfdbfe'; g.beginPath(); g.arc(r() * W, r() * H, 0.006 + r() ** 5 * 0.03, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    if (v % 3 === 0) { const p = planetSprite(PLANETS[(v / 3 + 1) % PLANETS.length], 60 + v); if (p) { const size = 1.8; g.drawImage(p.img, W * 0.75 - size * p.w / 2, H * 0.92 - size * p.h / 2, size * p.w, size * p.h); } }
    else if (v % 3 === 1) { // una galaxia espiral
      g.save(); g.translate(W * 0.28, H * 0.22); g.rotate(0.5); g.scale(1, 0.45);
      glow(g, 0, 0, 0.55, '#fde68a', 0.7);
      for (let i = 0; i < 400; i++) { const t = r() * 3.2, arm = r() < 0.5 ? 0 : Math.PI, rr = t * 0.16, a = t * 2 + arm + (r() - 0.5) * 0.4; g.fillStyle = r() < 0.6 ? 'rgba(191,219,254,0.6)' : 'rgba(253,230,138,0.6)'; g.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 0.012, 0.012); }
      g.restore();
    }
  });
}

function shipWindows(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, time: number) {
  each(cam, l0, l1, 0.3, 7, (x, i) => {
    const wx = x + 1, wy = 2.2, W = 3.4, H = 5;
    const scene = ((i % 8) + 8) % 8, pal = (((Math.floor(i / 8) + i) % PALETTES.length) + PALETTES.length) % PALETTES.length;
    const view = windowView(scene);
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, W, H); ctx.clip();
    if (view) ctx.drawImage(view.img, wx, wy, W, H); else { ctx.fillStyle = '#020617'; ctx.fillRect(wx, wy, W, H); }
    // Dos naves por ventana (distintas en cada ventana), cruzando despacio a distintas alturas: la grande
    // adelante y otra más chica atrás, que va para el otro lado.
    const design = (scene * 5 + 3) % 8;
    for (const [d, big] of [[(design + 4) % 8, false], [design, true]] as const) {
      const ship = shipSprite(d, pal + (big ? 0 : 1));
      if (!ship) continue;
      const dir = (hash(i * 3) > 0.35 ? 1 : -1) * (big ? 1 : -1), scale = big ? 0.95 + hash(i * 5) * 0.3 : 0.45 + hash(i * 6) * 0.15;
      const sw = ship.w * scale, sh = ship.h * scale, speed = (big ? 0.2 : 0.3) + hash(i * 7 + (big ? 0 : 1)) * 0.2, span = W + sw + 0.4;
      const k = ((time * speed + hash(i + (big ? 0 : 9)) * span) % span) - sw - 0.2;
      const sx = dir > 0 ? wx + k : wx + W - k - sw, sy = wy + (big ? 1.6 + hash(i * 9) * (H - 2.4 - sh) : 0.4 + hash(i * 4) * 0.9) + Math.sin(time * 0.8 + i) * 0.05;
      ctx.save(); ctx.translate(sx + sw / 2, sy + sh / 2); if (dir < 0) ctx.scale(-1, 1); ctx.translate(-sw / 2, -sh / 2); ctx.scale(scale, scale);
      for (const e of ship.engines) { // fuego de los motores
        const len = e.r * (5 + Math.sin(time * 40 + e.y * 9) * 1.2);
        glow(ctx, e.x - len * 0.3, e.y, len, e.color, 0.55);
        ctx.fillStyle = lin(ctx, e.x, 0, e.x - len, 0, [[0, '#ffffff'], [0.3, e.color], [1, 'rgba(0,0,0,0)']]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r * 0.8); ctx.lineTo(e.x - len, e.y); ctx.lineTo(e.x, e.y + e.r * 0.8); ctx.fill();
      }
      ctx.drawImage(ship.img, 0, 0, ship.w, ship.h);
      blinkLights(ctx, ship, 0, 0, time);
      ctx.restore();
    }
    if (hash(i * 13) > 0.5) { // escuadrilla lejana
      const small = shipSprite((design + 3) % 8, pal + 1);
      if (small) for (let k = 0; k < 3; k++) {
        const sc = 0.18, span = W + 1, px = wx + (((time * 0.5 + k * 0.35 + hash(i + k)) % span) + span) % span - 0.6, py = wy + 0.5 + k * 0.18 + hash(i * 2) * 1.2;
        ctx.drawImage(small.img, px, py, small.w * sc, small.h * sc);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 1.2, wy); ctx.lineTo(wx, wy + 2.3); ctx.fill(); // reflejo del vidrio
    ctx.restore();
    // Marco grueso de metal con tornillos y la tira de luz.
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.22; ctx.strokeRect(wx - 0.05, wy - 0.05, W + 0.1, H + 0.1);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.05; ctx.strokeRect(wx - 0.13, wy - 0.13, W + 0.26, H + 0.26);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.02; ctx.strokeRect(wx + 0.02, wy + 0.02, W - 0.04, H - 0.04);
    ctx.fillStyle = '#cbd5e1'; for (const [bx, by] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H]]) { ctx.beginPath(); ctx.arc(wx + bx, wy + by, 0.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f97316'; ctx.fillRect(wx - 0.45, wy, 0.06, H); glow(ctx, wx - 0.42, wy + H / 2, 0.6, '#f97316', 0.2);
  });
}

// ---------- Lo que se usa desde el dibujo del juego ----------

export type Backdrop = 'city' | 'mines' | 'base';
export function drawBackdrop(kind: Backdrop, ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, cols: number, time: number) {
  if (kind === 'city') city(ctx, cam, l0, l1, time);
  else if (kind === 'mines') space(ctx, cam, l0, l1);
  else shipWindows(ctx, cam, l0, l1, time);
}
// El cielo con estrellas de arriba del techo (para la ciudad, más tenue).
export function drawSkyStars(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, y0: number) {
  drawStarField(ctx, starField('stars-sky', ['#0b1033', '#312e81', '#a78bfa'], 5), cam, l0, l1, 0.01, y0);
}

// ---------- El cielo de arriba del techo (lo que se ve a un costado con la pantalla girada) ----------

type ThemeKey = 'city' | 'mines' | 'base' | 'ice' | 'volcano' | 'inverse' | 'factory' | 'forest' | 'storm' | 'moon';
interface UpperSky { stars: [string, string, string]; cloud: [string, string]; moon: PlanetLook; space?: boolean }
const UPPER: Record<ThemeKey, UpperSky> = {
  city: { stars: ['#0b1033', '#312e81', '#a78bfa'], cloud: ['#232a5c', '#a5b4fc'], moon: { kind: 'moon' } },
  mines: { stars: ['#2e1065', '#7c3aed', '#f0abfc'], cloud: ['#2e1065', '#c084fc'], moon: { kind: 'moon' }, space: true },
  base: { stars: ['#0c1a3a', '#1d4ed8', '#7dd3fc'], cloud: ['#0c1a3a', '#7dd3fc'], moon: { kind: 'earth', atmo: '#60a5fa' }, space: true },
  ice: { stars: ['#0c2a5a', '#1d4ed8', '#bae6fd'], cloud: ['#47698f', '#f0f9ff'], moon: { kind: 'ice', atmo: '#bae6fd' } },
  volcano: { stars: ['#2a0808', '#7f1d1d', '#fb923c'], cloud: ['#2b1612', '#f97316'], moon: { kind: 'mars', atmo: '#fb923c' } },
  inverse: { stars: ['#2e0b4f', '#86198f', '#f0abfc'], cloud: ['#3b1660', '#f0abfc'], moon: { kind: 'neptune', atmo: '#93c5fd' } },
  factory: { stars: ['#0b0f17', '#374151', '#9ca3af'], cloud: ['#272c35', '#9ca3af'], moon: { kind: 'moon' } },
  forest: { stars: ['#022c22', '#0f766e', '#99f6e4'], cloud: ['#123b33', '#99f6e4'], moon: { kind: 'moon' } },
  storm: { stars: ['#111025', '#3730a3', '#a5b4fc'], cloud: ['#1a1a2c', '#a5b4fc'], moon: { kind: 'moon' } },
  moon: { stars: ['#030712', '#1e3a8a', '#93c5fd'], cloud: ['#0b1220', '#93c5fd'], moon: { kind: 'earth', atmo: '#60a5fa' }, space: true },
};
// Una nube (o, en el espacio, una nube de gas) hecha con ruido: esponjosa, con el borde de arriba iluminado
// por la luna.
function cloudSprite(theme: ThemeKey, v: number) {
  const [base, light] = UPPER[theme].cloud, W = 6, H = 2.2, res = 24;
  return sprite(`cloud-${theme}-${v}`, W, H, g => {
    const c0 = rgb(base), c1 = rgb(light), space = UPPER[theme].space;
    const img = pixels(W * res, H * res, (x, y) => {
      const u = x / res, w = y / res, dx = (u - W / 2) / (W / 2), dy = (w - H * 0.58) / (H * 0.42);
      const shape = 1 - (dx * dx + dy * dy * (space ? 1 : 1.6)), n = fbm(u * 1.3 + v * 7, w * 1.3, 90 + v, 5);
      const d = shape * 0.9 + (n - 0.5) * 1.4;
      if (d <= 0) return null;
      const lit = Math.max(0, Math.min(1, 1 - w / H * 1.5 + (n - 0.5)));
      const c = mixRGB(c0, c1, lit * (space ? 0.6 : 0.75));
      return [c[0], c[1], c[2], Math.min(255, d * (space ? 260 : 420))];
    });
    g.drawImage(img, 0, 0, W, H);
  });
}
export function drawUpperSky(ctx: CanvasRenderingContext2D, theme: ThemeKey, cam: number, l0: number, l1: number, yTop: number, time: number) {
  const bottom = -1, look = UPPER[theme], room = bottom - yTop;
  if (room <= 0) return;
  // Estrellas (y la Vía Láctea), repetidas para arriba hasta llenar todo.
  const sf = starField(`stars-up-${theme}`, look.stars, theme.length * 13);
  if (sf) each(cam, l0, l1, 0.02, sf.w, x => { for (let y = bottom - sf.h; y + sf.h > yTop - 0.1; y -= sf.h) ctx.drawImage(sf.img, x, y, sf.w + 0.02, sf.h + 0.02); });
  // Algunas estrellas titilan.
  each(cam, l0, l1, 0.02, 1.3, (x, i) => {
    const y = bottom - 0.3 - hash(i * 3) * room, tw = Math.sin(time * (1 + hash(i)) * 2 + i);
    if (tw < 0.6) return;
    glow(ctx, x, y, 0.18, '#ffffff', (tw - 0.6) * 1.5);
  });
  // La luna (o un planeta, según el escenario), grande y con su halo.
  each(cam, l0, l1, 0.01, 20, (x, i) => {
    const m = planetSprite(look.moon, 3 + (i & 1));
    if (!m) return;
    const size = Math.min(2.2 + hash(i * 5) * 0.8, Math.max(0.9, room * 0.45)), mx = x + 3 + hash(i) * 12, my = bottom - Math.max(size * 1.1, Math.min(room - size * 1.1, 2 + hash(i * 7) * (room - 2)));
    glow(ctx, mx, my, size * 2.2, look.moon.atmo ?? '#e0e7ff', 0.28);
    ctx.drawImage(m.img, mx - size * m.w / 2, my - size * m.h / 2, size * m.w, size * m.h);
  });
  // Nubes a distintas alturas (en el espacio, nubes de gas), que se mueven un poco con el viento.
  for (const [factor, gap, alpha] of [[0.03, 5, 0.85], [0.06, 6.5, 1]] as const) {
    each(cam, l0, l1, factor, gap, (x, i) => {
      if (hash(i * 9 + gap) < 0.2) return;
      const c = cloudSprite(theme, ((i % 4) + 4) % 4);
      if (!c) return;
      const sc = 0.7 + hash(i * 2 + gap) * 0.7, cx = x + hash(i + gap) * gap + (time * 0.08) % gap, cy = bottom - 0.4 - hash(i * 5 + gap) * Math.max(0.5, room - 1.5) - c.h * sc;
      ctx.globalAlpha = alpha; ctx.drawImage(c.img, cx, cy, c.w * sc, c.h * sc); ctx.globalAlpha = 1;
    });
  }
}

// ---------- El agujero negro ----------

// El remolino de luz del agujero negro (como en las fotos): un disco en espiral de estelas finas, celeste y
// blanco cerca del centro, violeta en el medio y azul profundo afuera, con polvo brillante. Se pinta una vez
// (píxel por píxel) y después se dibuja girando. "inner": la versión más chica y brillante que gira más rápido.
const HOLE_R = 3;
function holeDisk(inner: boolean) {
  const W = HOLE_R * 2, res = 72;
  return sprite(`hole-${inner ? 'in' : 'out'}`, W, W, g => {
    const seed = inner ? 7 : 3, px = Math.round(W * res);
    const img = pixels(px, px, (x, y) => {
      const dx = (x + 0.5) / res - HOLE_R, dy = (y + 0.5) / res - HOLE_R, r = Math.hypot(dx, dy) / HOLE_R * 3;
      if (r > 3 || r < 0.42) return null;
      const th = Math.atan2(dy, dx), lr = Math.log(r + 0.05);
      // Estelas en espiral: varias frecuencias (enteras, para que la vuelta cierre sin costura) y un poco de ruido
      // a lo largo del radio, así no se ven parejas.
      let streak = 0;
      for (const [n, c, a] of [[2, 3.2, 0.5], [5, 3.6, 0.3], [11, 4, 0.22], [19, 4.4, 0.14]] as const) {
        const ph = n * (th + c * lr) + fbm(r * 2.2, n, seed + n, 3) * 6;
        streak += a * Math.pow(0.5 + 0.5 * Math.sin(ph), 2.2);
      }
      const ring = Math.exp(-(((r - 0.95) / 0.45) ** 2)) * 1.3 + Math.exp(-(((r - 1.8) / 0.75) ** 2)) * 0.75 + Math.exp(-(((r - 2.6) / 0.5) ** 2)) * 0.25;
      const inside = Math.min(1, (r - 0.42) / 0.12); // borde del centro negro
      let k = Math.min(1.4, (0.25 + streak * 1.6) * ring) * inside;
      if (inner) k *= Math.exp(-(((r - 0.9) / 0.7) ** 2)) * 1.4;
      const base = ramp([[0, '#f0fdff'], [0.22, '#67e8f9'], [0.45, '#818cf8'], [0.62, '#c084fc'], [0.8, '#3b5bdb'], [1, '#1e1b6b']], (r - 0.42) / 2.6);
      const c = mixRGB(base, [255, 255, 255], Math.max(0, k - 1.15) * 0.6);
      return [c[0], c[1], c[2], Math.min(255, k * 175)];
    });
    g.drawImage(img, 0, 0, W, W);
    // Polvo brillante desparramado por el disco.
    const r = rng(seed * 5);
    for (let i = 0; i < (inner ? 60 : 160); i++) {
      const a = r() * Math.PI * 2, d = 0.5 + r() ** 0.7 * (inner ? 1.4 : 2.4);
      g.fillStyle = r() < 0.6 ? 'rgba(207,250,254,0.85)' : 'rgba(216,180,254,0.8)';
      g.beginPath(); g.arc(HOLE_R + Math.cos(a) * d, HOLE_R + Math.sin(a) * d, 0.008 + r() * 0.02, 0, Math.PI * 2); g.fill();
    }
  });
}
export function drawBlackhole(ctx: CanvasRenderingContext2D, x: number, y: number, core: number, time: number, seed: number) {
  const size = 1.15; // el remolino mide ~3,5 casilleros de radio
  glow(ctx, x, y, HOLE_R * size * 1.35, '#1d4ed8', 0.35);
  glow(ctx, x, y, HOLE_R * size * 0.8, '#7c3aed', 0.25);
  const outer = holeDisk(false), inner = holeDisk(true);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen';
  for (const [s, speed, scale, alpha] of [[outer, 0.35, 1, 0.9], [inner, 0.9, 0.85, 0.5]] as const) {
    if (!s) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-(time * speed + seed)); ctx.scale(size * scale, size * scale * 0.94);
    ctx.globalAlpha = alpha; ctx.drawImage(s.img, -HOLE_R, -HOLE_R, HOLE_R * 2, HOLE_R * 2);
    ctx.restore();
  }
  // Chispas que caen en espiral hacia el centro.
  for (let i = 0; i < 26; i++) {
    const k = (time * (0.18 + hash(i + seed) * 0.12) + hash(i * 3 + seed)) % 1, d = core + (1 - k) * (2.8 * size), a = -(hash(i * 7) * 6.3 + k * 5 + time * 0.6);
    ctx.globalAlpha = Math.min(1, k * 3) * (1 - k * 0.6);
    ctx.fillStyle = i % 3 ? '#cffafe' : '#e9d5ff';
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.94, 0.02 + (1 - k) * 0.03, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = prev;
  // El centro: negro total, con un borde que se funde y el anillo de luz finito que late.
  const edge = ctx.createRadialGradient(x, y, core * 0.9, x, y, core * 1.6);
  edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(x, y, core * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x, y, core * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(165,243,252,${0.55 + 0.25 * Math.sin(time * 5 + seed)})`; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.arc(x, y, core * 1.12, 0, Math.PI * 2); ctx.stroke();
}
