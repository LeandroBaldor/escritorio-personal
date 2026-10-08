// Las imágenes de los tiburones de "Ciudad Tiburón": un tiburón blanco, un tiburón ballena y un martillo,
// recortados sobre fondo transparente y mirando a la derecha con la boca abierta. Los otros tipos salen
// del tiburón blanco con otro color: se repinta solo el lomo (lo oscuro), así la panza, los dientes y la
// boca quedan como están.
import ballenaUrl from './assets/tiburon-ballena.webp';
import blancoUrl from './assets/tiburon-blanco.webp';
import martilloUrl from './assets/tiburon-martillo.webp';
import type { SharkType } from './shark';

type Base = 'blanco' | 'ballena' | 'martillo';
const URLS: Record<Base, string> = { blanco: blancoUrl, ballena: ballenaUrl, martillo: martilloUrl };
// De qué imagen sale cada tipo, de qué color se pinta el lomo y si lleva las rayas del tigre.
const LOOK: Record<SharkType, { base: Base; back?: [number, number, number]; stripes?: boolean }> = {
  blanco: { base: 'blanco' }, ballena: { base: 'ballena' }, martillo: { base: 'martillo' },
  gris: { base: 'blanco', back: [118, 132, 138] }, mako: { base: 'blanco', back: [38, 92, 214] },
  bebe: { base: 'blanco', back: [96, 168, 184] }, tigre: { base: 'blanco', back: [168, 104, 52], stripes: true },
};
// La mandíbula de abajo (en fracciones de la imagen): se vuelve a dibujar encima del bombero para que quede
// entre los dientes.
const JAW: Record<Base, [number, number][]> = {
  blanco: [[0.8, 0.56], [0.98, 0.83], [0.99, 0.97], [0.82, 0.97], [0.78, 0.68]],
  martillo: [[0.73, 0.62], [0.9, 0.86], [0.91, 0.99], [0.74, 0.99], [0.71, 0.75]],
  ballena: [[0.77, 0.66], [1, 0.72], [1, 0.97], [0.77, 0.97]],
};

const sprites = new Map<SharkType, HTMLCanvasElement>();
let started = false;

function repaint(img: HTMLImageElement, back: [number, number, number], stripes: boolean) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return c;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height), p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2], lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    if (r > b + 20) continue; // lo rojo (encías y boca) no se toca
    const w = Math.max(0, Math.min(1, (0.62 - lum) / 0.3)); // cuánto es lomo: lo claro (panza, dientes) queda igual
    if (!w) continue;
    let k = Math.min(1.6, lum / 0.27);
    if (stripes) { const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width); if (Math.sin((px / c.width) * Math.PI * 22 + (py / c.height) * 4) > 0.45) k *= 0.5; }
    p[i] = r + (Math.min(255, back[0] * k) - r) * w; p[i + 1] = g + (Math.min(255, back[1] * k) - g) * w; p[i + 2] = b + (Math.min(255, back[2] * k) - b) * w;
  }
  x.putImageData(data, 0, 0);
  return c;
}

// Empieza a cargar las imágenes (una sola vez) y arma las variantes cuando llegan.
export function loadSharkSprites() {
  if (started || typeof Image === 'undefined' || typeof document === 'undefined') return;
  started = true;
  for (const base of Object.keys(URLS) as Base[]) {
    const img = new Image();
    img.onload = () => {
      for (const [type, look] of Object.entries(LOOK) as [SharkType, typeof LOOK[SharkType]][]) {
        if (look.base !== base) continue;
        if (look.back) sprites.set(type, repaint(img, look.back, !!look.stripes));
        else { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d')?.drawImage(img, 0, 0); sprites.set(type, c); }
      }
    };
    img.src = URLS[base];
  }
}

// Dibuja el tiburón con el centro en (cx, cy), `len` píxeles de largo, inclinado `angle` y mirando a `dir`.
// Con `jawOnly` dibuja solo la mandíbula de abajo. Devuelve false si la imagen todavía no cargó.
export function drawSharkSprite(ctx: CanvasRenderingContext2D, type: SharkType, cx: number, cy: number, len: number, angle: number, dir: 1 | -1, jawOnly = false) {
  const sp = sprites.get(type);
  if (!sp) return false;
  const w = len, h = (len * sp.height) / sp.width;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(dir, type === 'mako' ? 0.85 : 1);
  if (jawOnly) {
    ctx.beginPath();
    for (const [fx, fy] of JAW[LOOK[type].base]) ctx.lineTo((fx - 0.5) * w, (fy - 0.5) * h);
    ctx.closePath(); ctx.clip();
  }
  ctx.drawImage(sp, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
