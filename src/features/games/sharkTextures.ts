// Texturas de "Ciudad Tiburón" (hormigón, ladrillo, piedra, revoque, chapa y azulejos), hechas una sola vez en
// gris y aplicadas encima del color de cada pared con el modo "overlay": así el mismo ladrillo sirve rojo,
// naranja o marrón. Se repiten cada TILE_WORLD unidades y se mueven con la ciudad.
import { X, Y, type View } from './sharkView';

export type TextureName = 'concrete' | 'brick' | 'stone' | 'stucco' | 'siding' | 'tiles' | 'panel';
const SIZE = 256, TILE_WORLD = 4, PX = SIZE / TILE_WORLD; // 64 píxeles por unidad

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function canvas(size = SIZE) { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; }
// Ruido suave (varias capas de ruido agrandado), centrado en gris medio.
function noise(ctx: CanvasRenderingContext2D, amount: number, octaves: number[]) {
  for (const cells of octaves) {
    const small = canvas(cells), sc = small.getContext('2d')!;
    const img = sc.createImageData(cells, cells);
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    sc.putImageData(img, 0, 0);
    ctx.save(); ctx.globalAlpha = amount / octaves.length; ctx.globalCompositeOperation = 'overlay'; ctx.imageSmoothingEnabled = cells < 64;
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) ctx.drawImage(small, dx, dy, SIZE, SIZE); // que empalme al repetirse
    ctx.restore();
  }
}
const gray = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

function build(name: TextureName) {
  seed = name.length * 7919 + 17;
  const c = canvas(), ctx = c.getContext('2d')!;
  ctx.fillStyle = gray(128); ctx.fillRect(0, 0, SIZE, SIZE);
  switch (name) {
    case 'concrete': {
      noise(ctx, 0.9, [8, 32, 128]);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = gray(rnd() < 0.5 ? 95 : 150, 0.18); ctx.beginPath(); ctx.ellipse(rnd() * SIZE, rnd() * SIZE, 10 + rnd() * 40, 6 + rnd() * 25, rnd() * 3, 0, Math.PI * 2); ctx.fill(); } // manchas
      ctx.fillStyle = gray(80, 0.55); ctx.fillRect(0, 0, SIZE, 2); ctx.fillRect(0, 0, 2, SIZE); // juntas de las placas
      for (let i = 0; i < 60; i++) { ctx.fillStyle = gray(70, 0.5); ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1.5, 1.5); } // poros
      break;
    }
    case 'brick': {
      const bh = 0.28 * PX, bw = 0.62 * PX;
      ctx.fillStyle = gray(178); ctx.fillRect(0, 0, SIZE, SIZE); // la junta
      for (let row = 0, y = 0; y < SIZE; row++, y += bh) {
        for (let x = (row % 2) * -bw / 2; x < SIZE; x += bw) {
          const v = 100 + rnd() * 60;
          ctx.fillStyle = gray(v); ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
          ctx.fillStyle = gray(v + 25, 0.5); ctx.fillRect(x + 1.5, y + 1.5, bw - 3, 2); // borde de arriba con luz
          ctx.fillStyle = gray(60, 0.35); ctx.fillRect(x + 1.5, y + bh - 3.5, bw - 3, 2);
        }
      }
      noise(ctx, 0.6, [64, 256]);
      break;
    }
    case 'stone': {
      const bh = 0.62 * PX, bw = 1.3 * PX;
      ctx.fillStyle = gray(165); ctx.fillRect(0, 0, SIZE, SIZE);
      for (let row = 0, y = 0; y < SIZE; row++, y += bh) {
        for (let x = (row % 2) * -bw / 2; x < SIZE; x += bw) {
          const v = 118 + rnd() * 30;
          ctx.fillStyle = gray(v); ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
          ctx.fillStyle = gray(165, 0.5); ctx.fillRect(x + 2, y + 2, bw - 4, 3);
          ctx.fillStyle = gray(70, 0.4); ctx.fillRect(x + 2, y + bh - 5, bw - 4, 3);
        }
      }
      noise(ctx, 0.8, [16, 64, 256]);
      break;
    }
    case 'stucco': {
      noise(ctx, 0.7, [16, 64, 256]);
      ctx.strokeStyle = gray(70, 0.45); ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { let x = rnd() * SIZE, y = rnd() * SIZE; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 20; y += rnd() * 14; ctx.lineTo(x, y); } ctx.stroke(); } // grietas
      break;
    }
    case 'siding': {
      for (let x = 0; x < SIZE; x += 0.25 * PX) {
        const g = ctx.createLinearGradient(x, 0, x + 0.25 * PX, 0);
        g.addColorStop(0, gray(165)); g.addColorStop(0.5, gray(128)); g.addColorStop(1, gray(85));
        ctx.fillStyle = g; ctx.fillRect(x, 0, 0.25 * PX, SIZE);
      }
      noise(ctx, 0.35, [32, 256]);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(120,70,40,${0.12 + rnd() * 0.15})`; ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 3 + rnd() * 6, 10 + rnd() * 40); } // óxido
      break;
    }
    case 'tiles': {
      const t = 0.32 * PX;
      ctx.fillStyle = gray(190); ctx.fillRect(0, 0, SIZE, SIZE);
      for (let y = 0; y < SIZE; y += t) for (let x = 0; x < SIZE; x += t) {
        ctx.fillStyle = gray(130 + rnd() * 18); ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
        ctx.fillStyle = gray(200, 0.35); ctx.fillRect(x + 2, y + 2, t * 0.4, 2);
      }
      noise(ctx, 0.25, [64]);
      break;
    }
    case 'panel': {
      noise(ctx, 0.5, [32, 128]);
      ctx.fillStyle = gray(70, 0.6);
      for (let y = 0; y < SIZE; y += 0.8 * PX) ctx.fillRect(0, y, SIZE, 1.5);
      for (let x = 0; x < SIZE; x += 1.2 * PX) ctx.fillRect(x, 0, 1.5, SIZE);
      break;
    }
  }
  return c;
}

const cache = new Map<TextureName, HTMLCanvasElement>();
const patterns = new WeakMap<CanvasRenderingContext2D, Map<TextureName, CanvasPattern>>();
function pattern(ctx: CanvasRenderingContext2D, name: TextureName) {
  if (typeof document === 'undefined') return null;
  let byCtx = patterns.get(ctx);
  if (!byCtx) { byCtx = new Map(); patterns.set(ctx, byCtx); }
  let p = byCtx.get(name);
  if (!p) {
    let c = cache.get(name);
    if (!c) { c = build(name); cache.set(name, c); }
    p = ctx.createPattern(c, 'repeat') ?? undefined;
    if (!p) return null;
    byCtx.set(name, p);
  }
  return p;
}

// Pone la textura encima de lo ya pintado en el rectángulo (x1..x2, y1..y2) del mundo.
export function texture(ctx: CanvasRenderingContext2D, v: View, name: TextureName, x1: number, y1: number, x2: number, y2: number, alpha = 0.85) {
  const p = pattern(ctx, name);
  if (!p) return;
  p.setTransform(new DOMMatrix().translateSelf(X(v, 0), Y(v, 0)).scaleSelf(v.s / PX, v.s / PX));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha; ctx.fillStyle = p;
  ctx.fillRect(X(v, x1), Y(v, y2), (x2 - x1) * v.s, (y2 - y1) * v.s);
  ctx.restore();
}

// El desgaste de una pared: más oscura abajo (verdín y barro hasta donde llegó el agua), chorreaduras de
// lluvia desde arriba y los bordes en sombra para que tenga volumen.
export function weather(ctx: CanvasRenderingContext2D, v: View, x1: number, x2: number, top: number, seed: number) {
  const s = v.s, w = x2 - x1;
  const grime = ctx.createLinearGradient(0, Y(v, -0.2), 0, Y(v, 1.6));
  grime.addColorStop(0, 'rgba(38,48,30,0.55)'); grime.addColorStop(0.6, 'rgba(60,62,40,0.25)'); grime.addColorStop(1, 'rgba(60,62,40,0)');
  ctx.fillStyle = grime; ctx.fillRect(X(v, x1), Y(v, 1.6), w * s, Y(v, -0.2) - Y(v, 1.6));
  for (let i = 0; i < Math.round(w * 1.4); i++) {
    const h = Math.sin((seed + i) * 91.3) * 43758.5, f = h - Math.floor(h);
    const sx = X(v, x1 + f * w), len = (1 + ((f * 7) % 1) * 5) * s;
    const g = ctx.createLinearGradient(0, Y(v, top), 0, Y(v, top) + len);
    g.addColorStop(0, 'rgba(15,20,30,0.35)'); g.addColorStop(1, 'rgba(15,20,30,0)');
    ctx.fillStyle = g; ctx.fillRect(sx, Y(v, top), Math.max(1, s * (0.04 + ((f * 13) % 1) * 0.08)), len);
  }
  const edge = ctx.createLinearGradient(X(v, x1), 0, X(v, x2), 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.35)'); edge.addColorStop(0.08, 'rgba(0,0,0,0)'); edge.addColorStop(0.92, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = edge; ctx.fillRect(X(v, x1), Y(v, top), w * s, Y(v, -3) - Y(v, top));
  const sky = ctx.createLinearGradient(0, Y(v, top), 0, Y(v, top - 3));
  sky.addColorStop(0, 'rgba(200,215,255,0.12)'); sky.addColorStop(1, 'rgba(200,215,255,0)');
  ctx.fillStyle = sky; ctx.fillRect(X(v, x1), Y(v, top), w * s, 3 * s);
}
