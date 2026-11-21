// Los aliens nuevos de Invasión (hojas de personaje que pasó el usuario: Anfibio, Brutox, Esporal, Mantis y
// Reptiliano). De cada hoja se recortaron los 8 cuadros de "caminando a la derecha" (y el ataque del Anfibio):
// caminan cuadro a cuadro (stop motion), alineados por el torso y los pies. Quietos usan el primer cuadro; para
// la izquierda se espeja (lo hace quien llama). Cada cuadro: x, y, ancho, alto en el atlas, el centro del torso
// (x) y la mano de adelante (x, y), en px del cuadro.
import anfibioUrl from './assets/invasion/aliens/anfibio.webp';
import brutoxUrl from './assets/invasion/aliens/brutox.webp';
import esporalUrl from './assets/invasion/aliens/esporal.webp';
import mantisUrl from './assets/invasion/aliens/mantis.webp';
import reptilianoUrl from './assets/invasion/aliens/reptiliano.webp';

type Frame = [number, number, number, number, number, number, number];
export type AlienSpecies = 'gris' | 'anfibio' | 'brutox' | 'esporal' | 'mantis' | 'reptiliano';
export const ALIEN_SPECIES: AlienSpecies[] = ['gris', 'anfibio', 'brutox', 'esporal', 'mantis', 'reptiliano'];
const SPECIES: Record<Exclude<AlienSpecies, 'gris'>, { url: string; tall: number; maxH: number; glow: string; frames: Frame[]; attack: Frame | null }> = {
  anfibio: { url: anfibioUrl, tall: 1.0, maxH: 124, glow: 'rgba(80,230,255,0.95)', frames: [[0, 29, 104, 124, 53.5, 88, 78], [106, 29, 102, 124, 52.8, 91, 77], [210, 30, 106, 123, 60.2, 89, 76], [318, 30, 101, 123, 57.6, 87, 76], [421, 30, 105, 123, 58.8, 90, 74], [528, 29, 106, 124, 58.3, 91, 77], [636, 29, 106, 124, 57.8, 88, 77], [744, 31, 108, 122, 61.8, 94, 76]], attack: [854, 0, 149, 153, 67.7, 145, 54] },
  brutox: { url: brutoxUrl, tall: 1.15, maxH: 168, glow: 'rgba(255,90,50,0.95)', frames: [[0, 4, 129, 164, 68.9, 127, 97], [131, 5, 109, 163, 50.8, 103, 96], [242, 6, 116, 162, 59.6, 100, 91], [360, 8, 123, 160, 58.8, 109, 98], [485, 2, 115, 166, 61.5, 113, 102], [602, 2, 117, 166, 57.2, 100, 103], [721, 2, 133, 166, 73.5, 132, 100], [856, 0, 124, 168, 68.0, 123, 101]], attack: null },
  esporal: { url: esporalUrl, tall: 1.05, maxH: 111, glow: 'rgba(170,255,60,0.95)', frames: [[0, 1, 84, 110, 48.7, 80, 69], [86, 0, 82, 111, 45.7, 77, 70], [170, 1, 85, 110, 52.8, 84, 65], [257, 2, 90, 109, 53.7, 87, 69], [349, 1, 83, 110, 47.3, 66, 70], [434, 1, 89, 110, 52.9, 80, 70], [525, 1, 94, 110, 50.6, 88, 70], [621, 1, 82, 110, 44.9, 78, 70]], attack: null },
  mantis: { url: mantisUrl, tall: 1.15, maxH: 197, glow: 'rgba(210,255,90,0.95)', frames: [[0, 6, 102, 191, 46.6, 96, 109], [104, 1, 108, 196, 52.9, 107, 101], [214, 0, 98, 197, 47.1, 97, 101], [314, 1, 117, 196, 59.6, 116, 104], [433, 1, 105, 196, 49.7, 104, 103], [540, 1, 85, 196, 42.6, 84, 102], [627, 7, 98, 190, 54.0, 97, 111], [727, 0, 85, 197, 43.0, 77, 107]], attack: null },
  reptiliano: { url: reptilianoUrl, tall: 1.0, maxH: 106, glow: 'rgba(255,170,60,0.95)', frames: [[0, 1, 107, 105, 67.6, 93, 58], [109, 1, 95, 105, 67.9, 94, 58], [206, 1, 107, 105, 73.0, 106, 56], [315, 0, 115, 106, 72.6, 102, 58], [432, 1, 115, 105, 73.0, 99, 58], [549, 1, 116, 105, 71.0, 100, 57], [667, 1, 113, 105, 72.1, 103, 57], [782, 1, 116, 105, 76.7, 103, 59]], attack: null },
};

const loaded = new Map<string, { img: HTMLImageElement; black: HTMLCanvasElement | null; ok: boolean }>();
function atlas(url: string) {
  let a = loaded.get(url);
  if (!a && typeof Image !== 'undefined') {
    const img = new Image(); a = { img, black: null, ok: false }; loaded.set(url, a);
    const entry = a;
    img.onload = () => {
      entry.ok = true;
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; // copia negra (la sombra en la pared)
      const x = c.getContext('2d'); if (x) { x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); entry.black = c; }
    };
    img.src = url;
  }
  return a && a.ok ? a : null;
}
export function preloadAliens() { for (const s of Object.values(SPECIES)) atlas(s.url); }

type Pt = [number, number];
// Dibuja al alien con los pies en (0, 0), mirando a la derecha, de alto H. Devuelve la cabeza, de dónde sale el
// rayo (menos 0,15 H, como espera `drawPerson`) y la mano; null si la imagen todavía no cargó.
export function drawAlienSpecies(ctx: CanvasRenderingContext2D, species: Exclude<AlienSpecies, 'gris'>, H: number, k: number, t: number, o: { kind: string; firing: boolean; flat: boolean }) {
  const S = SPECIES[species], a = atlas(S.url);
  if (!a) return null;
  const moving = o.kind === 'walk' || o.kind === 'run';
  const phase = ((k / (Math.PI * 2)) % 1 + 1) % 1;
  const f: Frame = o.firing && S.attack ? S.attack : moving ? S.frames[Math.floor(phase * 8) % 8] : S.frames[0];
  const [fx, fy, fw, fh, ax, hx, hy] = f;
  const sc = H * S.tall / S.maxH;
  const low = o.kind === 'squat' || o.kind === 'sit' || o.kind === 'crawl';
  const squash = low ? 0.8 : 1;
  const bob = moving ? 0 : Math.sin(t * 1.6 + k) * H * 0.006; // quieto, respira un poquito
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.translate(0, bob); ctx.scale(sc, sc * squash);
  ctx.drawImage(o.flat && a.black ? a.black : a.img, fx, fy, fw, fh, -ax, -fh, fw, fh);
  const hand: Pt = [(hx - ax) * sc, (hy - fh) * sc * squash + bob];
  if (o.firing && !o.flat) { // la energía que tira (del color de cada especie)
    ctx.restore(); ctx.save();
    const r = H * (0.1 + Math.sin(t * 40) * 0.02);
    const gr = ctx.createRadialGradient(hand[0], hand[1], 0, hand[0], hand[1], r);
    gr.addColorStop(0, 'rgba(255,255,240,0.95)'); gr.addColorStop(0.35, S.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(hand[0] - r, hand[1] - r, r * 2, r * 2);
  }
  ctx.restore();
  return { head: [(fw * 0.62 - ax) * sc, -fh * 0.86 * sc * squash + bob] as Pt, ray: [hand[0] - H * 0.15, hand[1]] as Pt, hand, r: H * 0.13 };
}
