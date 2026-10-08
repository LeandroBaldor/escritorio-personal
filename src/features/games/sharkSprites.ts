// Las imágenes de los tiburones de "Ciudad Tiburón": el tiburón blanco, el tiburón ballena y el martillo, tal
// cual las referencias, recortados sobre fondo transparente y mirando a la derecha con la boca abierta.
import ballenaUrl from './assets/tiburon-ballena.webp';
import blancoUrl from './assets/tiburon-blanco.webp';
import martilloUrl from './assets/tiburon-martillo.webp';
import type { SharkType } from './shark';

const URLS: Record<SharkType, string> = { blanco: blancoUrl, ballena: ballenaUrl, martillo: martilloUrl };
// La mandíbula de abajo (en fracciones de la imagen): se vuelve a dibujar encima del bombero para que quede
// entre los dientes.
const JAW: Record<SharkType, [number, number][]> = {
  blanco: [[0.8, 0.56], [0.98, 0.83], [0.99, 0.97], [0.82, 0.97], [0.78, 0.68]],
  martillo: [[0.73, 0.62], [0.9, 0.86], [0.91, 0.99], [0.74, 0.99], [0.71, 0.75]],
  ballena: [[0.77, 0.66], [1, 0.72], [1, 0.97], [0.77, 0.97]],
};
const STRIPS = 28; // para que ondule al nadar, la imagen se dibuja en tiras

const sprites = new Map<SharkType, HTMLImageElement>();
let scratch: HTMLCanvasElement | null = null;
let started = false;

// Empieza a cargar las imágenes (una sola vez).
export function loadSharkSprites() {
  if (started || typeof Image === 'undefined') return;
  started = true;
  for (const type of Object.keys(URLS) as SharkType[]) {
    const img = new Image();
    img.onload = () => sprites.set(type, img);
    img.src = URLS[type];
  }
}

export interface SpriteOptions {
  jawOnly?: boolean; // solo la mandíbula de abajo
  wave?: number; // la fase de la ondulación al nadar (sin esto queda derecho)
  amp?: number; // cuánto ondula (en fracciones del alto de la imagen)
}

// Dibuja el tiburón con el centro en (cx, cy), `len` píxeles de largo, inclinado `angle` y mirando a `dir`.
// Nadando, el cuerpo hace una onda que va de la cabeza a la cola: la cola se mueve mucho y la cabeza casi nada.
// Devuelve false si la imagen todavía no cargó.
export function drawSharkSprite(ctx: CanvasRenderingContext2D, type: SharkType, cx: number, cy: number, len: number, angle: number, dir: 1 | -1, opts: SpriteOptions = {}) {
  const img = sprites.get(type);
  if (!img) return false;
  const w = len, h = (len * img.naturalHeight) / img.naturalWidth;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(dir, 1);
  if (opts.jawOnly) {
    ctx.beginPath();
    for (const [fx, fy] of JAW[type]) ctx.lineTo((fx - 0.5) * w, (fy - 0.5) * h);
    ctx.closePath(); ctx.clip();
  }
  if (opts.wave === undefined) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    // Las tiras se arman primero en un lienzo aparte (a la resolución de la pantalla), así al dibujarlo
    // transparente debajo del agua no se notan las uniones.
    const m = ctx.getTransform(), k = Math.hypot(m.a, m.b) || 1;
    const amp = (opts.amp ?? 0.03) * h, pad = Math.ceil(amp * 1.3 + 2);
    const cw = Math.ceil(w * k) + 2, ch = Math.ceil((h + pad * 2) * k);
    scratch ??= document.createElement('canvas');
    if (scratch.width < cw) scratch.width = cw;
    if (scratch.height < ch) scratch.height = ch;
    const sc = scratch.getContext('2d');
    if (!sc) { ctx.restore(); return false; }
    sc.clearRect(0, 0, cw, ch);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    for (let i = 0; i < STRIPS; i++) {
      const u = i / STRIPS, tail = Math.pow(1 - u, 2); // u = 0 es la punta de la cola
      const dy = Math.sin(opts.wave - u * 4.2) * amp * (0.15 + tail);
      const sx = Math.floor(u * iw), sw = Math.min(Math.ceil(iw / STRIPS) + 1, iw - sx);
      sc.drawImage(img, sx, 0, sw, ih, u * w * k, (pad + dy) * k, (sw / iw) * w * k + 1, h * k);
    }
    ctx.drawImage(scratch, 0, 0, cw, ch, -w / 2, -h / 2 - pad, cw / k, ch / k);
  }
  ctx.restore();
  return true;
}
