// Fondos con calidad de foto para los escenarios 4 a 10 de Gravity Swap: cordilleras con relieve de verdad
// (ruido fractal con luz de costado, estratos de roca, nieve, grietas de lava que brillan, cráteres), bancos de
// nubes de tormenta con volumen, bosques de troncos con corteza y musgo que brilla, paredes de fábrica con
// chapa gastada y óxido, y techos de cristal. Cada capa se pinta una sola vez (píxel por píxel) y se repite
// sin costura de costado; el juego la mueve más lento que el pasillo para dar profundidad.
import { fbm, mixRGB, ramp, rgb, type RGB } from './gravityBackdrops';

const ROWS = 10;
const RES = 36; // píxeles por casillero de las capas
type Stops = [number, string][];
// Ruido que se repite cada "period" casilleros de costado (para que la capa empalme sin costura): la frecuencia
// se redondea para que entre una cantidad entera de veces.
function wfbm(x: number, y: number, f: number, period: number, seed: number, oct: number) {
  const n = Math.max(1, Math.round(period * f)), fx = n / period;
  return fbm(x * fx, y * f, seed, oct, n);
}
// Cada capa se pinta de a pedacitos (unas filas por vez, sin trabar el juego) y aparece suave cuando está lista.
interface Layer { img: HTMLCanvasElement; ready: number }
const cache = new Map<string, Layer | null>();
function layerSprite(key: string, period: number, paint: (x: number, y: number, u: number, v: number) => [number, number, number, number] | null): Layer | null {
  if (cache.has(key)) return cache.get(key)!;
  if (typeof document === 'undefined') return null;
  const W = Math.round(period * RES), H = ROWS * RES, img = document.createElement('canvas');
  img.width = W; img.height = H;
  const g = img.getContext('2d');
  if (!g) { cache.set(key, null); return null; }
  const layer: Layer = { img, ready: 0 };
  cache.set(key, layer);
  const data = g.createImageData(W, H);
  let row = 0;
  const work = () => {
    const until = performance.now() + 10;
    while (row < H && performance.now() < until) {
      for (let px = 0; px < W; px++) {
        const p = paint(px / RES, row / RES, px / W, row / H);
        if (!p) continue;
        const i = (row * W + px) * 4;
        data.data[i] = p[0]; data.data[i + 1] = p[1]; data.data[i + 2] = p[2]; data.data[i + 3] = p[3];
      }
      row++;
    }
    if (row < H) { setTimeout(work, 0); return; }
    g.putImageData(data, 0, 0);
    layer.ready = performance.now();
  };
  work();
  return layer;
}
// Dibuja la capa repetida entre l0 y l1, movida según la cámara ("factor": 0 quieta, 1 como el pasillo).
export function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer | null, period: number, cam: number, l0: number, l1: number, factor: number, alpha = 1) {
  if (!layer || !layer.ready) return;
  const img = layer.img, fade = Math.min(1, (performance.now() - layer.ready) / 600);
  const off = ((-cam * factor) % period + period) % period;
  ctx.globalAlpha = alpha * fade;
  for (let x = l0 - period + ((off - l0) % period + period) % period; x < l1; x += period) ctx.drawImage(img, x, 0, period + 0.02, ROWS);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- Cordilleras
interface Ridge {
  period: number; base: number; amp: number; scale: number; seed: number;
  rock: Stops; light: number; // colores de la roca (de oscuro a claro) y qué tanto marca la luz
  haze: string; hazeK: number; // color y cantidad de niebla (las lejanas, más)
  snow?: number; lava?: boolean; craters?: boolean; ceiling?: boolean; crystals?: string; sharp?: number;
}
export function ridgeLayer(key: string, r: Ridge) {
  const P = r.period, haze = rgb(r.haze);
  const height = (x: number) => {
    const u = x / P * r.scale, ridged = 1 - Math.abs(fbm(u, 0.5, r.seed, 6, r.scale) * 2 - 1);
    return r.base + r.amp * (ridged ** (r.sharp ?? 1.6) * 0.75 + fbm(u * 3, 2.5, r.seed + 5, 4, r.scale * 3) * 0.35);
  };
  return layerSprite(key, P, (x, y) => {
    const h = height(x), surf = r.ceiling ? h : ROWS - h, inside = r.ceiling ? y < surf : y > surf;
    if (!inside) return null;
    const depth = r.ceiling ? surf - y : y - surf; // qué tan adentro de la montaña
    // Relieve: un "terreno" de ruido; su pendiente, contra la luz que viene de arriba a la izquierda, marca
    // crestas iluminadas y quebradas en sombra (como en una foto).
    const R0 = wfbm(x, y, 1.1, P, r.seed + 50, 5), Rx = wfbm(x + 0.05, y, 1.1, P, r.seed + 50, 5), Ry = wfbm(x, y + 0.05, 1.1, P, r.seed + 50, 5);
    const gx = (Rx - R0) / 0.05, gy = (Ry - R0) / 0.05;
    const tex = wfbm(x, y, 3.5, P, r.seed + 9, 3), strata = Math.sin(y * 6 + R0 * 8) * 0.5 + 0.5;
    let c: RGB = ramp(r.rock, R0 * 0.55 + tex * 0.3 + strata * 0.15);
    let lit = 1 + (-gx * 0.7 - gy * (r.ceiling ? -0.7 : 0.7)) * r.light * 0.32 - Math.min(0.3, depth * 0.05);
    if (depth < 0.12) lit += 0.15 * (1 - depth / 0.12); // el borde de la silueta, más claro
    if (r.snow !== undefined) { // nieve: en lo alto y en las partes del relieve que miran para arriba
      const alt = (ROWS - y) - r.snow - (wfbm(x, 0, 2, P, r.seed + 11, 3) - 0.5) * 1.2;
      if (alt > 0 && -gy + R0 * 0.8 > 0.55 - Math.min(0.5, alt * 0.18)) { c = mixRGB(rgb('#dbe7f7'), rgb('#ffffff'), Math.min(1, -gy * 0.5 + 0.5)); lit = 0.85 + (-gx * 0.7 - gy * 0.7) * 0.15; }
    }
    if (r.craters) { // cráteres en la ladera: hueco oscuro abajo y borde claro arriba
      const cell = Math.round(x / 1.2) % Math.round(P / 1.2), cx = Math.round(x / 1.2) * 1.2 + (fbm(cell, 3, r.seed, 1) - 0.5) * 0.6, cy = surf + 0.6 + fbm(cell, 7, r.seed, 1) * 1.6, cr = 0.18 + fbm(cell, 9, r.seed, 1) * 0.3;
      const dx = (x - cx) / cr, dy = (y - cy) / (cr * 0.45), dd = dx * dx + dy * dy;
      if (dd < 1) lit *= dy < 0 ? 0.6 : 1.25; else if (dd < 1.4 && dy < 0) lit *= 1.15;
    }
    let out: RGB = [c[0] * lit, c[1] * lit, c[2] * lit];
    if (r.lava) { // grietas de lava que brillan (más abajo, más)
      const crack = 1 - Math.abs(wfbm(x, y, 1.4, P, r.seed + 21, 5) * 2 - 1);
      const hot = Math.max(0, crack - 0.94) * 14 * Math.min(1, Math.max(0, depth - 0.6) * 0.5) * (y > ROWS * 0.6 ? 1 : 0.4);
      if (hot > 0) out = mixRGB(out, ramp([[0, '#7f1d1d'], [0.5, '#f97316'], [1, '#fde68a']], hot), Math.min(1, hot * 1.4));
    }
    if (r.crystals) { // cristales que brillan, colgando
      const k = wfbm(x, y, 3, P, r.seed + 31, 3);
      if (k > 0.66 && depth < 1.2) out = mixRGB(out, rgb(r.crystals), (k - 0.66) * 3);
    }
    // niebla: más arriba y más lejos, más color del cielo
    const fog = Math.min(1, r.hazeK + Math.max(0, (r.ceiling ? y : ROWS - y) / ROWS) * r.hazeK * 0.6);
    out = mixRGB(out, haze, fog);
    const edge = Math.min(1, depth * RES * 0.9);
    return [Math.min(255, out[0]), Math.min(255, out[1]), Math.min(255, out[2]), 255 * edge];
  });
}

// ---------------------------------------------------------------- Nubes de tormenta
// Un banco de nubes con volumen: densidad fractal, iluminada desde arriba, oscura por abajo.
export function cloudLayer(key: string, period: number, seed: number, top: number, bottom: number, light: string, dark: string, alpha: number) {
  const L = rgb(light), D = rgb(dark);
  return layerSprite(key, period, (x, y) => {
    if (y < top - 1 || y > bottom + 1) return null;
    const k = (y - top) / (bottom - top), shape = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
    const d = wfbm(x, y, 0.55, period, seed, 6) * 1.25 * shape - 0.42;
    if (d <= 0) return null;
    const lit = 1 - Math.max(0, Math.min(1, wfbm(x, y - 0.25, 0.55, period, seed, 6) * 1.25 * shape - 0.42 - d + 0.5));
    const c = mixRGB(D, L, Math.max(0, Math.min(1, (1 - k) * 0.6 + lit * 0.5)));
    return [c[0], c[1], c[2], Math.min(255, d * 600) * alpha];
  });
}

// ---------------------------------------------------------------- Bosque
// Troncos enormes con corteza (vetas y nudos), musgo y hongos que brillan en la base, perdiéndose en la niebla.
export function forestLayer(key: string, period: number, seed: number, near: boolean) {
  const trunks: { x: number; w: number }[] = [];
  for (let i = 0, x = 0.5; x < period - 0.5; i++) { const w = near ? 0.7 + fbm(i, 1, seed, 1) * 0.6 : 0.35 + fbm(i, 1, seed, 1) * 0.4; trunks.push({ x, w }); x += w + (near ? 1.6 : 0.8) + fbm(i, 3, seed, 1) * 1.4; }
  const fog = rgb(near ? '#0a3a33' : '#0e4a40');
  return layerSprite(key, period, (x, y) => {
    const t = trunks.find(t => x > t.x - t.w / 2 - 0.3 * (y / ROWS) ** 6 && x < t.x + t.w / 2 + 0.3 * (y / ROWS) ** 6); // se abren en raíces abajo
    if (!t) return null;
    const u = (x - t.x) / (t.w / 2), round = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u)));
    const bark = wfbm(x, y, 6, period, seed + 7, 5), groove = Math.abs(Math.sin(x * 26 + bark * 5));
    let c = ramp([[0, '#0b1f17'], [0.5, '#1f3b2c'], [1, '#3b5a40']], bark * 0.7 + groove * 0.3);
    const moss = Math.max(0, wfbm(x, y, 3, period, seed + 3, 4) - 0.55) * 3;
    c = mixRGB(c, rgb('#2f855a'), Math.min(0.7, moss));
    const glowMoss = Math.max(0, wfbm(x, y, 9, period, seed + 13, 3) - 0.72) * 4 * (y > ROWS * 0.55 ? 1 : 0.2);
    let out: RGB = [c[0] * (0.45 + round * 0.75), c[1] * (0.45 + round * 0.75), c[2] * (0.45 + round * 0.75)];
    if (u < -0.3) out = mixRGB(out, rgb('#67e8f9'), 0.12 * (-u - 0.3)); // el borde iluminado por los hongos
    out = mixRGB(out, rgb('#5eead4'), Math.min(0.8, glowMoss));
    out = mixRGB(out, fog, near ? 0.15 : 0.5);
    return [out[0], out[1], out[2], 255];
  });
}

// ---------------------------------------------------------------- Fábrica
// Una pared de chapas remachadas, gastadas, con manchas de óxido que chorrean, rayones y sombras de suciedad.
export function factoryWall(key: string) {
  return layerSprite(key, 6, (x, y) => {
    const px = x % 1.5, py = y % 2.5;
    const n = wfbm(x, y, 3, 6, 41, 5), scratch = Math.max(0, wfbm(x, y, 40, 6, 43, 2) - 0.8) * 3;
    let c = ramp([[0, '#121821'], [0.5, '#1e2836'], [1, '#2c3a4d']], n * 0.9 + 0.1 - py * 0.03);
    const rust = Math.max(0, wfbm(x, y - x * 0.2, 1.5, 6, 47, 5) - 0.58) * 2.6 * (0.6 + (py / 2.5) * 0.8);
    c = mixRGB(c, ramp([[0, '#4a1d0a'], [1, '#9a4a1c']], n), Math.min(0.75, rust));
    if (px < 0.04 || py < 0.04) c = mixRGB(c, [5, 8, 12], 0.75); // juntas entre chapas
    else if (px < 0.08 || py < 0.08) c = mixRGB(c, [90, 110, 130], 0.25); // borde levantado
    const rx = (px - 0.14) ** 2 + (py - 0.14) ** 2, rx2 = (px - 1.36) ** 2 + (py - 0.14) ** 2, rx3 = (px - 0.14) ** 2 + (py - 2.36) ** 2, rx4 = (px - 1.36) ** 2 + (py - 2.36) ** 2;
    if (Math.min(rx, rx2, rx3, rx4) < 0.0025) c = mixRGB(c, [150, 165, 180], 0.7); // remaches
    c = mixRGB(c, [160, 175, 190], Math.min(0.3, scratch * 0.3));
    const grime = Math.max(0, py / 2.5 - 0.6) * 0.5; c = mixRGB(c, [5, 6, 8], grime);
    return [c[0], c[1], c[2], 255];
  });
}
