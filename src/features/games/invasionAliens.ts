// Los aliens de Invasión, cuadro a cuadro (stop motion) con las hojas de personaje que pasó el usuario (segunda
// versión, en alta calidad: Gris, Anfibio, Brutox, Esporal, Mantis y Reptiliano). De cada hoja se usa el perfil
// mirando a la derecha (quieto) y los 4 cuadros de caminar (los 2 que miran a la izquierda, espejados). Todos a la
// misma escala (el perfil quieto mide 260 px), alineados por el torso y los pies. Para la izquierda se espeja (lo
// hace quien llama). Cada cuadro: x, y, ancho, alto en el atlas, el centro del torso (x), la mano de adelante (x, y)
// la cabeza (x, y) y el ojo (x, y), en px del cuadro. `walkH`: el alto promedio caminando (ese alto es el que mide H × tall).
import anfibioUrl from './assets/invasion/aliens/anfibio.webp';
import brutoxUrl from './assets/invasion/aliens/brutox.webp';
import esporalUrl from './assets/invasion/aliens/esporal.webp';
import grisUrl from './assets/invasion/aliens/gris.webp';
import mantisUrl from './assets/invasion/aliens/mantis.webp';
import reptilianoUrl from './assets/invasion/aliens/reptiliano.webp';

type Frame = [number, number, number, number, number, number, number, number, number, number, number];
export type AlienSpecies = 'gris' | 'anfibio' | 'brutox' | 'esporal' | 'mantis' | 'reptiliano';
export const ALIEN_SPECIES: AlienSpecies[] = ['gris', 'anfibio', 'brutox', 'esporal', 'mantis', 'reptiliano'];
const SPECIES: Record<AlienSpecies, { url: string; tall: number; walkH: number; glow: string; stand: Frame; walk: Frame[] }> = {
  gris: { url: grisUrl, tall: 1.0, walkH: 250, glow: 'rgba(140,255,170,0.95)', stand: [0,0,104,260,35.7,77,185,64.9,26.0,90.9,41.6], walk: [[106,0,186,245,104.8,175,156,147.6,24.5,173.8,39.2],[294,0,255,256,120.5,221,141,155.1,25.6,181.7,41.0],[551,0,256,258,132.0,207,151,161.2,25.8,187.7,41.3],[809,0,172,242,91.3,160,145,133.6,24.2,159.1,38.7]] },
  anfibio: { url: anfibioUrl, tall: 1.0, walkH: 234, glow: 'rgba(80,230,255,0.95)', stand: [0,0,128,260,62.4,107,165,70.1,26.0,101.4,31.2], walk: [[130,0,204,234,110.9,172,129,130.3,23.4,160.4,28.1],[336,0,210,235,98.2,200,119,117.2,23.5,146.8,28.2],[548,0,195,234,97.1,180,136,123.6,23.4,153.0,28.1],[745,0,193,233,111.0,178,134,129.0,23.3,158.7,28.0]] },
  brutox: { url: brutoxUrl, tall: 1.15, walkH: 214, glow: 'rgba(255,90,50,0.95)', stand: [0,0,188,260,88.1,167,168,98.2,26.0,162.1,61.1], walk: [[190,0,200,214,112.4,174,131,127.5,21.4,179.0,50.3],[392,0,234,214,146.9,233,105,151.9,21.4,200.9,50.3],[628,0,198,214,109.7,175,129,125.5,21.4,177.0,50.3],[828,0,220,214,133.6,219,113,139.6,21.4,188.8,50.3]] },
  esporal: { url: esporalUrl, tall: 1.05, walkH: 203, glow: 'rgba(170,255,60,0.95)', stand: [0,0,123,260,50.3,103,175,69.2,26.0,97.7,31.2], walk: [[125,0,192,202,103.2,182,131,133.9,20.2,164.7,24.2],[319,0,200,204,109.9,188,103,131.6,20.4,161.0,24.5],[521,0,173,202,88.8,168,122,118.7,20.2,146.9,24.2],[696,0,203,204,110.5,189,115,146.3,20.4,175.3,24.5]] },
  mantis: { url: mantisUrl, tall: 1.15, walkH: 225, glow: 'rgba(210,255,90,0.95)', stand: [0,0,125,260,60.8,124,165,75.8,26.0,96.8,31.2], walk: [[127,0,193,225,117.3,183,130,156.8,22.5,175.1,27.0],[322,0,236,224,117.2,216,127,144.4,22.4,164.5,26.9],[560,0,201,226,110.0,199,135,134.9,22.6,155.3,27.1],[763,0,222,225,127.5,217,128,158.2,22.5,177.9,27.0]] },
  reptiliano: { url: reptilianoUrl, tall: 1.0, walkH: 234, glow: 'rgba(255,170,60,0.95)', stand: [0,0,132,260,88.2,131,158,97.6,26.0,114.3,31.2], walk: [[134,0,215,234,122.1,178,155,153.1,23.4,167.9,28.1],[351,0,217,236,114.7,197,101,147.2,23.6,162.0,28.3],[570,0,213,233,116.9,181,122,142.4,23.3,157.6,28.0],[785,0,229,233,139.7,215,103,158.5,23.3,173.6,28.0]] },
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
export function drawAlienSpecies(ctx: CanvasRenderingContext2D, species: AlienSpecies, H: number, k: number, t: number, o: { kind: string; firing: boolean; flat: boolean; eyes?: string }) {
  const S = SPECIES[species], a = atlas(S.url);
  if (!a) return null;
  const moving = o.kind === 'walk' || o.kind === 'run';
  const phase = ((k / (Math.PI * 2)) % 1 + 1) % 1;
  const f: Frame = moving ? S.walk[Math.floor(phase * 4) % 4] : S.stand;
  const [fx, fy, fw, fh, ax, hx, hy, hdx, hdy, ex, ey] = f;
  const sc = H * S.tall / S.walkH;
  const low = o.kind === 'squat' || o.kind === 'sit' || o.kind === 'crawl';
  const squash = low ? 0.8 : 1;
  const bob = moving ? 0 : Math.sin(t * 1.6 + k) * H * 0.006; // quieto, respira un poquito
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.translate(0, bob); ctx.scale(sc, sc * squash);
  ctx.drawImage(o.flat && a.black ? a.black : a.img, fx, fy, fw, fh, -ax, -fh, fw, fh);
  const hand: Pt = [(hx - ax) * sc, (hy - fh) * sc * squash + bob];
  if (o.eyes && !o.flat) { // mirándote fijo: le brillan los ojos
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(ex - ax, ey - fh, 0, ex - ax, ey - fh, fh * 0.07);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, o.eyes); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(ex - ax - fh * 0.07, ey - fh - fh * 0.07, fh * 0.14, fh * 0.14); ctx.restore();
  }
  if (o.firing && !o.flat) { // la energía que tira (del color de cada especie)
    ctx.restore(); ctx.save();
    const r = H * (0.1 + Math.sin(t * 40) * 0.02);
    const gr = ctx.createRadialGradient(hand[0], hand[1], 0, hand[0], hand[1], r);
    gr.addColorStop(0, 'rgba(255,255,240,0.95)'); gr.addColorStop(0.35, S.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(hand[0] - r, hand[1] - r, r * 2, r * 2);
  }
  ctx.restore();
  return { head: [(hdx - ax) * sc, (hdy - fh) * sc * squash + bob] as Pt, ray: [hand[0] - H * 0.15, hand[1]] as Pt, hand, r: H * 0.13 };
}
