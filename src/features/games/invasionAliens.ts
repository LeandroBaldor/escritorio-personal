// Los aliens de Invasión, con las imágenes que pasó el usuario (Gris, Anfibio, Brutox, Esporal, Mantis y Reptiliano).
// Quieto: el perfil mirando a la derecha de las hojas de personaje. Caminando: los 2 pasos de las imágenes
// "<especie>_derecha" (las de "_izquierda" son las mismas espejadas, así que para la izquierda se espeja, lo hace
// quien llama). Un paso con cada pie: se alternan dos veces por ciclo, con un fundido cortito entre uno y otro y el
// cuerpo que sube entre apoyo y apoyo. Cada cuadro: x, y, ancho, alto en el atlas, el centro del torso (x), la mano
// de adelante (x, y), la cabeza (x, y) y el ojo (x, y), en px del cuadro. `walkH`: el alto promedio caminando (ese
// alto es el que mide H × tall). El perfil quieto mide 340 px; los pasos, a la misma escala que antes.
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
  gris: { url: grisUrl, tall: 1.0, walkH: 327, glow: 'rgba(140,255,170,0.95)', stand: [0,0,137,340,47.2,102,242,85.6,34.0,120.4,54.4], walk: [[139,0,304,328,161.9,303,168,213.0,32.8,251.9,52.5],[445,0,283,326,150.5,258,179,197.8,32.6,236.8,52.2]] },
  anfibio: { url: anfibioUrl, tall: 1.0, walkH: 306, glow: 'rgba(80,230,255,0.95)', stand: [0,0,168,340,82.0,141,218,92.2,34.0,133.3,40.8], walk: [[170,0,261,306,134.7,217,175,155.4,30.6,198.1,36.7],[433,0,284,306,129.4,270,160,148.8,30.6,190.2,36.7]] },
  brutox: { url: brutoxUrl, tall: 1.15, walkH: 280, glow: 'rgba(255,90,50,0.95)', stand: [0,0,246,340,115.3,219,220,128.5,34.0,212.4,79.9], walk: [[248,0,280,280,167.6,279,141,174.5,28.0,235.3,65.8],[530,0,309,280,157.7,308,136,185.6,28.0,248.5,65.8]] },
  esporal: { url: esporalUrl, tall: 1.05, walkH: 266, glow: 'rgba(170,255,60,0.95)', stand: [0,0,161,340,66.0,135,230,90.6,34.0,128.2,40.8], walk: [[163,0,249,265,141.3,239,136,178.0,26.5,215.9,31.8],[414,0,267,266,130.8,260,116,173.4,26.6,210.6,31.9]] },
  mantis: { url: mantisUrl, tall: 1.15, walkH: 294, glow: 'rgba(210,255,90,0.95)', stand: [0,0,163,340,79.4,162,216,99.2,34.0,127.1,40.8], walk: [[165,0,287,292,146.7,240,177,192.8,29.2,229.8,35.0],[454,0,268,296,155.1,267,178,178.7,29.6,209.7,35.5]] },
  reptiliano: { url: reptilianoUrl, tall: 1.0, walkH: 306, glow: 'rgba(255,170,60,0.95)', stand: [0,0,173,340,115.8,172,207,128.2,34.0,150.6,40.8], walk: [[175,0,312,306,176.7,311,124,214.6,30.6,237.9,36.7],[489,0,256,306,139.2,221,175,171.6,30.6,193.3,36.7]] },
};

// Además de la imagen entera guarda copias a la mitad y a un cuarto (y sus copias negras, para la sombra en la
// pared): los aliens lejanos, que se ven chicos, se dibujan desde la copia chica, que es mucho más liviano.
interface Level { img: CanvasImageSource; black: HTMLCanvasElement | null; k: number }
const loaded = new Map<string, { levels: Level[]; ok: boolean }>();
function blackCopy(src: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); if (!x) return null;
  x.drawImage(src, 0, 0, w, h); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  return c;
}
function atlas(url: string) {
  let a = loaded.get(url);
  if (!a && typeof Image !== 'undefined') {
    const img = new Image(); a = { levels: [], ok: false }; loaded.set(url, a);
    const entry = a;
    img.onload = () => {
      const levels: Level[] = [{ img, black: blackCopy(img, img.width, img.height), k: 1 }];
      let prev: CanvasImageSource = img;
      for (const k of [0.5, 0.25]) {
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); if (!x) break;
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(prev, 0, 0, w, h);
        levels.push({ img: c, black: blackCopy(c, w, h), k }); prev = c;
      }
      entry.levels = levels; entry.ok = true;
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
  // Caminando: medio ciclo con cada paso. Al final de cada medio ciclo se funde con el paso siguiente, y el cuerpo
  // sube en el medio (cuando la pierna de atrás pasa) y baja al apoyar.
  const half = phase * 2, step = Math.floor(half) % 2, q = half - Math.floor(half);
  const f: Frame = moving ? S.walk[step] : S.stand;
  const next: Frame | null = moving && q > 0.82 ? S.walk[(step + 1) % 2] : null;
  const [fx, fy, fw, fh, ax, hx, hy, hdx, hdy, ex, ey] = f;
  const sc = H * S.tall / S.walkH;
  const low = o.kind === 'squat' || o.kind === 'sit' || o.kind === 'crawl';
  const squash = low ? 0.8 : 1;
  const bob = moving ? -Math.sin(q * Math.PI) * H * (o.kind === 'run' ? 0.035 : 0.022) : Math.sin(t * 1.6 + k) * H * 0.006; // quieto, respira un poquito
  const lean = moving ? Math.sin(q * Math.PI) * 0.025 : 0; // y se inclina apenas hacia adelante al impulsarse
  ctx.save();
  const L = a.levels.find(l => sc >= l.k * 0.7) ?? a.levels[a.levels.length - 1]; // la copia justa para el tamaño
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = L.k < 1 || sc > 0.5 ? 'medium' : 'high';
  const src = o.flat && L.black ? L.black : L.img;
  ctx.translate(0, bob); ctx.rotate(lean); ctx.scale(sc, sc * squash);
  ctx.drawImage(src, fx * L.k, fy * L.k, fw * L.k, fh * L.k, -ax, -fh, fw, fh);
  if (next) { // fundido con el paso que viene
    const [nx, ny, nw, nh, nax] = next;
    ctx.globalAlpha = (q - 0.82) / 0.18;
    ctx.drawImage(src, nx * L.k, ny * L.k, nw * L.k, nh * L.k, -nax, -nh, nw, nh);
    ctx.globalAlpha = 1;
  }
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
