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

// ---------- Nivel 1: la ciudad ----------

// Las ventanas de un edificio: unas prendidas (amarillas, naranjas, blancas, alguna con la luz azul de una tele,
// alguna con cortina) y otras apagadas con el reflejo del cielo.
function windows(g: CanvasRenderingContext2D, r: () => number, x0: number, y0: number, x1: number, y1: number, stepX: number, stepY: number, ww: number, wh: number, lit: number) {
  const warm = ['#fde68a', '#fcd34d', '#fdba74', '#fef3c7', '#fff7ed'], cool = ['#bfdbfe', '#e0f2fe', '#a5f3fc'];
  for (let y = y0; y + wh <= y1 + 1e-6; y += stepY) {
    const rowLit = lit * (0.5 + r());
    for (let x = x0; x + ww <= x1 + 1e-6; x += stepX) {
      if (r() < rowLit) {
        const tv = r() < 0.08, c = tv ? '#60a5fa' : r() < 0.75 ? warm[Math.floor(r() * warm.length)] : cool[Math.floor(r() * cool.length)];
        g.fillStyle = lin(g, 0, y, 0, y + wh, [[0, shade(c, 0.2)], [1, shade(c, -0.25)]]); g.fillRect(x, y, ww, wh);
        if (r() < 0.3) { g.fillStyle = 'rgba(60,30,20,0.55)'; g.fillRect(x, y, ww * (0.3 + r() * 0.4), wh); } // cortina
        if (r() < 0.06) { g.fillStyle = 'rgba(20,10,10,0.7)'; g.fillRect(x + ww * 0.4, y + wh * 0.35, ww * 0.25, wh * 0.65); } // alguien en la ventana
      } else {
        g.fillStyle = lin(g, 0, y, 0, y + wh, [[0, '#1f2a55'], [1, '#0b1028']]); g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(140,160,255,0.12)'; g.fillRect(x, y, ww * 0.35, wh);
      }
    }
  }
}
function grime(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)'; g.fillRect(x + r() * w, y + r() * h, 0.02 + r() * 0.06, 0.02 + r() * 0.04); }
}
const TYPES = 7;
// Un edificio de la ciudad. type: 0 torre de vidrio, 1 art decó escalonado, 2 departamentos con balcones,
// 3 torre redonda con helipuerto, 4 torre corporativa con tiras de LED, 5 edificio viejo de ladrillo con
// escalera de incendio y cartel, 6 edificio en construcción con grúa.
function buildingSprite(type: number, seed: number, near: boolean) {
  const r0 = rng(seed * 13 + type);
  const w = near ? 2.4 + r0() * 1.3 : 1.5 + r0() * 1.3, h = near ? 3 + r0() * 3.4 : 4.4 + r0() * 4.2, extra = 2.6, H = h + extra;
  return sprite(`bld-${near ? 'n' : 'm'}-${type}-${seed}`, w + 0.4, H, (g, s) => {
    const r = rng(seed * 7 + type * 3 + (near ? 99 : 0));
    const x = 0.2, top = H - h, dim = near ? 0 : -0.15;
    const light = (lx: number, ly: number, color = '#ff2a2a', size = 0.04) => s.lights.push({ x: lx, y: ly, color, phase: r() * 6, size });
    switch (type) {
      case 0: { // torre de vidrio
        g.fillStyle = lin(g, x, top, x + w, H, [[0, shade('#2b4185', dim)], [0.5, shade('#1a2a5e', dim)], [1, shade('#0e1638', dim)]]); g.fillRect(x, top, w, h);
        windows(g, r, x + 0.04, top + 0.06, x + w - 0.04, H - 0.1, 0.2, 0.26, 0.17, 0.22, 0.22);
        g.fillStyle = lin(g, x, top, x + w, top + h * 0.7, [[0, 'rgba(200,170,255,0.22)'], [0.45, 'rgba(120,150,255,0.08)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, top, w, h); // reflejo del cielo
        g.strokeStyle = 'rgba(8,12,30,0.9)'; g.lineWidth = 0.02;
        for (let lx = x; lx <= x + w + 1e-6; lx += 0.2) { g.beginPath(); g.moveTo(lx, top); g.lineTo(lx, H); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + w - 0.03, top, 0.03, h); // canto iluminado
        // Corona en punta, con una tira de luz y una aguja.
        g.fillStyle = shade('#1a2a5e', dim); g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top); g.lineTo(x + w * 0.55, top - 0.9); g.closePath(); g.fill();
        g.strokeStyle = '#7dd3fc'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(x + 0.05, top - 0.02); g.lineTo(x + w * 0.55, top - 0.86); g.stroke();
        g.fillStyle = '#94a3b8'; g.fillRect(x + w * 0.55 - 0.015, top - 2, 0.03, 1.15);
        light(x + w * 0.55, top - 2);
        break;
      }
      case 1: { // art decó escalonado
        const tiers = [[1, 0.55], [0.76, 0.25], [0.5, 0.2]] as const;
        let y = H;
        for (const [frac, hf] of tiers) {
          const tw = w * frac, tx = x + (w - tw) / 2, th = h * hf;
          g.fillStyle = lin(g, tx, 0, tx + tw, 0, [[0, shade('#4a4060', dim)], [0.5, shade('#3a3350', dim)], [1, shade('#221d33', dim)]]); g.fillRect(tx, y - th, tw, th);
          g.fillStyle = lin(g, 0, y - th, 0, y, [[0, 'rgba(255,200,120,0)'], [1, 'rgba(255,190,110,0.18)']]); g.fillRect(tx, y - th, tw, th); // luces desde abajo
          windows(g, r, tx + 0.1, y - th + 0.15, tx + tw - 0.08, y - 0.08, 0.16, 0.3, 0.07, 0.2, 0.3);
          g.fillStyle = 'rgba(0,0,0,0.35)'; for (let px = tx + 0.08; px < tx + tw; px += 0.16) g.fillRect(px + 0.075, y - th, 0.02, th); // pilastras
          g.fillStyle = '#d4a648'; g.fillRect(tx - 0.04, y - th, tw + 0.08, 0.05); // cornisa dorada
          y -= th;
        }
        g.fillStyle = '#d4a648'; g.beginPath(); g.moveTo(x + w * 0.42, y); g.lineTo(x + w * 0.58, y); g.lineTo(x + w * 0.5, y - 1.4); g.closePath(); g.fill();
        for (let k = 0; k < 4; k++) { g.fillStyle = '#fde68a'; g.fillRect(x + w * 0.5 - 0.06 + k * 0.0, y - 0.25 - k * 0.25, 0.12 - k * 0.025, 0.03); }
        light(x + w * 0.5, y - 1.4);
        break;
      }
      case 2: { // departamentos con balcones
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#3a3a52', dim)], [1, shade('#24243a', dim)]]); g.fillRect(x, top, w, h);
        grime(g, r, x, top, w, h, 80);
        for (let y = top + 0.2; y < H - 0.3; y += 0.42) {
          windows(g, r, x + 0.12, y, x + w - 0.1, y + 0.24, 0.32, 1, 0.22, 0.24, 0.45);
          g.fillStyle = shade('#4b4b66', dim); g.fillRect(x + 0.05, y + 0.27, w - 0.1, 0.05); // losa del balcón
          g.strokeStyle = 'rgba(200,200,220,0.45)'; g.lineWidth = 0.012;
          g.beginPath(); g.moveTo(x + 0.05, y + 0.17); g.lineTo(x + w - 0.05, y + 0.17); for (let bx = x + 0.08; bx < x + w - 0.05; bx += 0.06) { g.moveTo(bx, y + 0.17); g.lineTo(bx, y + 0.27); } g.stroke();
          if (r() < 0.5) { const ax = x + 0.15 + r() * (w - 0.4); g.fillStyle = '#6b7280'; g.fillRect(ax, y + 0.3, 0.14, 0.09); g.fillStyle = '#374151'; g.fillRect(ax + 0.02, y + 0.32, 0.1, 0.01); } // aire acondicionado
          if (r() < 0.25) { g.fillStyle = r() < 0.5 ? '#16a34a' : '#ea580c'; g.beginPath(); g.arc(x + 0.2 + r() * (w - 0.4), y + 0.15, 0.04, 0, Math.PI * 2); g.fill(); } // plantas
        }
        // Tanque de agua de madera con patas y antena.
        const tx = x + w * 0.25;
        g.strokeStyle = '#1f2937'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(tx, top); g.lineTo(tx + 0.05, top - 0.25); g.moveTo(tx + 0.4, top); g.lineTo(tx + 0.35, top - 0.25); g.stroke();
        g.fillStyle = lin(g, tx, 0, tx + 0.4, 0, [[0, '#7c4a2a'], [0.5, '#a0643a'], [1, '#4a2a17']]); g.fillRect(tx, top - 0.65, 0.4, 0.42);
        g.fillStyle = '#3b2414'; g.beginPath(); g.moveTo(tx - 0.02, top - 0.65); g.lineTo(tx + 0.2, top - 0.85); g.lineTo(tx + 0.42, top - 0.65); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.4)'; for (const by of [0.1, 0.25, 0.38]) g.fillRect(tx, top - 0.65 + by, 0.4, 0.015);
        g.fillStyle = '#9ca3af'; g.fillRect(x + w * 0.75, top - 1.1, 0.025, 1.1); light(x + w * 0.75, top - 1.1);
        break;
      }
      case 3: { // torre redonda con helipuerto
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#141c44', dim)], [0.35, shade('#3b4f95', dim)], [0.6, shade('#22306a', dim)], [1, shade('#0c1230', dim)]]); g.fillRect(x, top, w, h);
        for (let y = top + 0.15; y < H - 0.1; y += 0.3) {
          for (let k = 0; k < 14; k++) { // banda de ventanas que se curva con el edificio
            const a0 = -Math.PI / 2 + k / 14 * Math.PI, a1 = a0 + Math.PI / 14, sx0 = x + w * (0.5 + Math.sin(a0) * 0.5), sx1 = x + w * (0.5 + Math.sin(a1) * 0.5);
            const on = r() < 0.4, c = on ? (r() < 0.7 ? '#fde68a' : '#bfdbfe') : '#0b1230';
            g.fillStyle = css(mixRGB(rgb(c), [0, 0, 0], on ? Math.abs(Math.sin(a0)) * 0.5 : 0)); g.fillRect(sx0, y, Math.max(0.005, sx1 - sx0 - 0.01), 0.13);
          }
        }
        g.fillStyle = shade('#64748b', dim); g.fillRect(x - 0.08, top - 0.1, w + 0.16, 0.12);
        g.fillStyle = '#1f2937'; g.beginPath(); g.ellipse(x + w / 2, top - 0.12, w * 0.45, 0.08, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e5e7eb'; g.font = 'bold 0.12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', x + w / 2, top - 0.12);
        for (const k of [-0.42, 0.42]) light(x + w / 2 + w * k, top - 0.12, '#22c55e', 0.03);
        break;
      }
      case 4: { // torre corporativa con tiras de LED
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade('#0f1736', dim)], [0.5, shade('#18224a', dim)], [1, shade('#090e24', dim)]]); g.fillRect(x, top, w, h);
        windows(g, r, x + 0.08, top + 0.4, x + w - 0.08, H - 0.1, 0.12, 0.16, 0.08, 0.1, 0.18);
        const c1 = r() < 0.5 ? '#22d3ee' : '#f472b6', c2 = c1 === '#22d3ee' ? '#a78bfa' : '#38bdf8';
        g.fillStyle = lin(g, 0, top, 0, H, [[0, c1], [1, c2]]); g.fillRect(x + w * 0.48, top, 0.05, h); // tira vertical
        glow(g, x + w * 0.5, top + h / 2, 0.5, c1, 0.25);
        g.fillStyle = lin(g, x, 0, x + w, 0, [[0, c2], [0.5, c1], [1, c2]]); g.fillRect(x, top + 0.08, w, 0.08); g.fillRect(x, top + 0.24, w, 0.04); // corona de LED
        glow(g, x + w / 2, top + 0.12, w * 0.7, c1, 0.25);
        g.fillStyle = '#0f1736'; g.fillRect(x + w * 0.3, top - 0.5, w * 0.4, 0.5); g.fillStyle = '#9ca3af'; g.fillRect(x + w * 0.5, top - 1.3, 0.03, 0.8);
        light(x + w * 0.5, top - 1.3);
        break;
      }
      case 5: { // edificio viejo de ladrillo
        g.fillStyle = shade('#5a2e2a', dim - 0.25); g.fillRect(x, top, w, h);
        for (let y = top; y < H; y += 0.06) { const off = Math.round((y - top) / 0.06) % 2 ? 0.06 : 0; for (let bx = x - off; bx < x + w; bx += 0.12) { g.fillStyle = css(mixRGB(rgb('#6b3530'), rgb('#3b1d1a'), r()), 0.9); g.fillRect(Math.max(x, bx), y, Math.min(0.11, x + w - bx), 0.05); } }
        for (let y = top + 0.3; y < H - 0.4; y += 0.55) for (let wx = x + 0.15; wx < x + w - 0.2; wx += 0.38) {
          const on = r() < 0.45, c = on ? (r() < 0.8 ? '#fdba74' : '#fde68a') : '#120a10';
          g.fillStyle = '#d6c7b0'; g.fillRect(wx - 0.02, y - 0.02, 0.24, 0.38); // marco de piedra
          g.fillStyle = on ? lin(g, 0, y, 0, y + 0.34, [[0, shade(c, 0.2)], [1, shade(c, -0.35)]]) : c;
          g.beginPath(); g.moveTo(wx, y + 0.34); g.lineTo(wx, y + 0.1); g.arc(wx + 0.1, y + 0.1, 0.1, Math.PI, 0); g.lineTo(wx + 0.2, y + 0.34); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(wx + 0.095, y, 0.01, 0.34); g.fillRect(wx, y + 0.18, 0.2, 0.01);
        }
        // Escalera de incendio.
        g.strokeStyle = '#0b0b10'; g.lineWidth = 0.02;
        const fx = x + w - 0.55;
        for (let y = top + 0.75; y < H - 0.3; y += 0.55) {
          g.beginPath(); g.moveTo(fx, y); g.lineTo(fx + 0.5, y); g.moveTo(fx, y - 0.12); g.lineTo(fx + 0.5, y - 0.12); for (let k = 0; k <= 5; k++) { g.moveTo(fx + k * 0.1, y - 0.12); g.lineTo(fx + k * 0.1, y); } g.moveTo(fx + 0.05, y); g.lineTo(fx + 0.45, y + 0.55); g.stroke();
        }
        g.fillStyle = '#3f1d1a'; g.fillRect(x - 0.04, top - 0.08, w + 0.08, 0.1);
        // Cartel en la azotea, con neón.
        const bw = Math.min(w - 0.2, 1.5), bx = x + (w - bw) / 2, c = ['#f43f5e', '#22d3ee', '#facc15', '#a3e635'][Math.floor(r() * 4)];
        g.strokeStyle = '#111827'; g.lineWidth = 0.025; g.beginPath(); for (let k = 0; k <= 3; k++) { g.moveTo(bx + k * bw / 3, top); g.lineTo(bx + k * bw / 3, top - 0.35); } g.stroke();
        g.fillStyle = '#0b0b14'; g.fillRect(bx, top - 0.95, bw, 0.6);
        glow(g, bx + bw / 2, top - 0.65, bw * 0.8, c, 0.35);
        g.strokeStyle = c; g.lineWidth = 0.035; g.strokeRect(bx + 0.05, top - 0.9, bw - 0.1, 0.5);
        g.fillStyle = c; for (let k = 0; k < 3; k++) g.fillRect(bx + 0.15 + k * (bw - 0.3) / 3, top - 0.75, (bw - 0.3) / 3 * 0.7, 0.2);
        break;
      }
      case 6: { // en construcción, con grúa
        const built = h * (0.45 + r() * 0.2);
        g.fillStyle = shade('#3f4256', dim); g.fillRect(x, H - built, w, built);
        windows(g, r, x + 0.1, H - built + 0.1, x + w - 0.1, H - 0.1, 0.25, 0.32, 0.18, 0.2, 0.15);
        g.strokeStyle = '#b45309'; g.lineWidth = 0.035; // estructura de acero
        for (let y = H - built; y > top - 1e-6; y -= 0.4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
        for (let bx = x; bx <= x + w + 1e-6; bx += w / 4) { g.beginPath(); g.moveTo(bx, H - built); g.lineTo(bx, top); g.stroke(); }
        g.strokeStyle = 'rgba(180,83,9,0.6)'; g.lineWidth = 0.015;
        for (let y = H - built; y > top + 0.4; y -= 0.4) for (let bx = x; bx < x + w - 0.01; bx += w / 4) { g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + w / 4, y - 0.4); g.stroke(); }
        // La grúa.
        const mx = x + w * 0.7, my = top - 1.6;
        g.strokeStyle = '#facc15'; g.lineWidth = 0.02;
        for (let y = top; y > my; y -= 0.12) { g.beginPath(); g.moveTo(mx - 0.06, y); g.lineTo(mx + 0.06, y - 0.12); g.moveTo(mx + 0.06, y); g.lineTo(mx - 0.06, y - 0.12); g.stroke(); }
        g.fillStyle = '#eab308'; g.fillRect(mx - 0.06, my, 0.02, top - my); g.fillRect(mx + 0.04, my, 0.02, top - my);
        g.fillRect(mx - 1.1, my - 0.05, 1.6, 0.06); g.fillStyle = '#57534e'; g.fillRect(mx + 0.3, my + 0.01, 0.18, 0.12); // pluma y contrapeso
        g.strokeStyle = '#d1d5db'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(mx - 0.8, my); g.lineTo(mx - 0.8, my + 0.9); g.stroke();
        g.fillStyle = '#facc15'; g.fillRect(mx - 0.83, my + 0.9, 0.06, 0.05);
        light(mx, my - 0.05); light(mx - 1.1, my - 0.03, '#ff2a2a', 0.03);
        break;
      }
    }
    // La base: un poco de brillo de la calle.
    g.fillStyle = lin(g, 0, H - 0.6, 0, H, [[0, 'rgba(255,170,90,0)'], [1, 'rgba(255,170,90,0.18)']]); g.fillRect(x, H - 0.6, w, 0.6);
  });
}
// La línea del horizonte, lejos: siluetas variadas (cúpulas, agujas, escalonadas) en la niebla.
function skylineSprite() {
  const W = 40, H = 9.5;
  return sprite('skyline', W, H, (g, s) => {
    const r = rng(77);
    let x = 0;
    while (x < W - 0.6) {
      const w = 0.4 + r() * 1, h = 3 + r() * 5.5, top = H - h, kind = Math.floor(r() * 5);
      const c = css(mixRGB(rgb('#34418a'), rgb('#4a3f8f'), r()), 1);
      g.fillStyle = c; g.fillRect(x, top, w, h);
      if (kind === 1) { g.beginPath(); g.arc(x + w / 2, top, w / 2, Math.PI, 0); g.fill(); }
      if (kind === 2) { g.fillRect(x + w * 0.2, top - 0.5, w * 0.6, 0.5); g.fillRect(x + w * 0.4, top - 1.3, w * 0.2, 0.8); }
      if (kind === 3) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + w / 2, top - 0.8); g.lineTo(x + w, top); g.fill(); }
      if (kind !== 1) { g.fillRect(x + w / 2 - 0.01, top - 1.2, 0.02, 1.2); s.lights.push({ x: x + w / 2, y: top - 1.2, color: '#ff4d4d', phase: r() * 6, size: 0.025 }); }
      for (let y = top + 0.15; y < H; y += 0.16) for (let wx = x + 0.06; wx < x + w - 0.05; wx += 0.1) if (r() < 0.12) { g.fillStyle = r() < 0.7 ? 'rgba(253,230,138,0.7)' : 'rgba(191,219,254,0.7)'; g.fillRect(wx, y, 0.04, 0.05); }
      x += w + r() * 0.15 - 0.05;
    }
    // Niebla de abajo.
    g.fillStyle = lin(g, 0, H * 0.4, 0, H, [[0, 'rgba(232,121,249,0)'], [1, 'rgba(232,121,249,0.4)']]); g.fillRect(0, H * 0.4, W, H * 0.6);
  });
}

function city(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, cols: number, time: number) {
  // La luna, enorme y con cráteres, apenas se mueve.
  const moon = planetSprite({ kind: 'moon' }, 3);
  if (moon) {
    const mx = l0 + cols * 0.72 - (cam * 0.01) % (cols + 6), my = 3.2, size = 1.15;
    glow(ctx, mx, my, size * 2.4, '#c4b5fd', 0.3);
    ctx.drawImage(moon.img, mx - size * moon.w / 2, my - size * moon.h / 2, size * moon.w, size * moon.h);
  }
  // Nubes finas iluminadas por la ciudad.
  each(cam, l0, l1, 0.02, 7, (x, i) => {
    for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(196,181,253,${0.06 + hash(i * 3 + k) * 0.06})`; ctx.beginPath(); ctx.ellipse(x + hash(i + k) * 5, 1.2 + hash(i * 7 + k) * 2.5, 2 + hash(k + i) * 2, 0.12 + hash(i + k * 5) * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  const sky = skylineSprite();
  if (sky) each(cam, l0, l1, 0.05, sky.w, x => { ctx.drawImage(sky.img, x, ROWS - sky.h, sky.w + 0.02, sky.h); blinkLights(ctx, sky, x, ROWS - sky.h, time); });
  // Edificios del medio y los de adelante, todos distintos.
  for (const [near, factor, gap, count] of [[false, 0.13, 2.9, 21], [true, 0.26, 4.1, 14]] as const) {
    if (near) { ctx.fillStyle = lin(ctx, 0, ROWS * 0.5, 0, ROWS, [[0, 'rgba(232,121,249,0)'], [1, 'rgba(192,132,252,0.25)']]); ctx.fillRect(l0, ROWS * 0.5, l1 - l0, ROWS * 0.5); }
    each(cam, l0, l1, factor, gap, (x, i) => {
      const k = ((i % count) + count) % count, type = (k * 3) % TYPES, s = buildingSprite(type, k, near);
      if (!s) return;
      const bx = x + (gap - s.w) * hash(i + (near ? 50 : 0)) * 0.6;
      ctx.drawImage(s.img, bx, ROWS - s.h, s.w, s.h);
      blinkLights(ctx, s, bx, ROWS - s.h, time);
    });
  }
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
  if (kind === 'city') city(ctx, cam, l0, l1, cols, time);
  else if (kind === 'mines') space(ctx, cam, l0, l1);
  else shipWindows(ctx, cam, l0, l1, time);
}
// El cielo con estrellas de arriba del techo (para la ciudad, más tenue).
export function drawSkyStars(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, y0: number) {
  drawStarField(ctx, starField('stars-sky', ['#0b1033', '#312e81', '#a78bfa'], 5), cam, l0, l1, 0.01, y0);
}
