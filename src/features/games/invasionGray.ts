// El gris de Invasión armado con la imagen de referencia del usuario (alien_2.png), cortada en 7 piezas:
// el cuerpo con la cabeza, los brazos y el arma, y de cada pierna el muslo, la pierna y la pata.
// Las piezas giran en la cadera, la rodilla y el tobillo, así el gris camina y corre con las piernas.
// Todo se mide en píxeles de la imagen original (1536 × 1024), mirando a la derecha; el atlas está a la mitad.
import grisUrl from './assets/invasion/gris.webp';

type Pt = [number, number];
interface Piece { x: number; y: number; w: number; h: number; ox: number; oy: number }
const ATLAS_SCALE = 0.5;
const PIECES: Record<'body' | 'thighB' | 'shinB' | 'footB' | 'thighF' | 'shinF' | 'footF', Piece> = {
  body: { x: 0, y: 0, w: 426, h: 302, ox: 420, oy: 17 },
  thighB: { x: 428, y: 0, w: 76, h: 92, ox: 494, oy: 566 },
  shinB: { x: 506, y: 0, w: 139, h: 112, ox: 340, oy: 676 },
  footB: { x: 647, y: 0, w: 122, h: 64, ox: 284, oy: 875 },
  thighF: { x: 771, y: 0, w: 112, h: 76, ox: 643, oy: 579 },
  shinF: { x: 885, y: 0, w: 96, h: 132, ox: 673, oy: 637 },
  footF: { x: 0, y: 304, w: 138, h: 60, ox: 670, oy: 875 },
};
// Articulaciones en reposo (la pierna B es la de atrás, a la izquierda; la F la de adelante).
const LEGS = {
  B: { hip: [582, 612] as Pt, knee: [575, 712] as Pt, ankle: [388, 882] as Pt },
  F: { hip: [705, 628] as Pt, knee: [842, 690] as Pt, ankle: [728, 882] as Pt },
};
const FEET_Y = 985, CENTER_X = 640, TALL = 985 - 70; // del piso a la punta del cráneo
const MUZZLE: Pt = [1262, 418], EYE: Pt = [908, 226], HEAD: Pt = [880, 240], HAND_F: Pt = [1000, 480];

let atlas: HTMLImageElement | null = null, ready = false;
let small: HTMLCanvasElement | null = null, black: HTMLCanvasElement | null = null;
function load() {
  if (atlas || typeof Image === 'undefined') return;
  atlas = new Image();
  atlas.onload = () => {
    ready = true;
    const a = atlas!;
    // Copia a la mitad (para los grises chicos, que se ven más suaves) y una negra (la sombra en la pared).
    small = document.createElement('canvas'); small.width = Math.ceil(a.width / 2); small.height = Math.ceil(a.height / 2);
    const s = small.getContext('2d'); if (s) { s.imageSmoothingQuality = 'high'; s.drawImage(a, 0, 0, small.width, small.height); }
    black = document.createElement('canvas'); black.width = a.width; black.height = a.height;
    const b = black.getContext('2d'); if (b) { b.drawImage(a, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = '#000'; b.fillRect(0, 0, a.width, a.height); }
  };
  atlas.src = grisUrl;
}
export function preloadGray() { load(); }

const ang = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
// La rodilla, para que los dos huesos (con su largo de la imagen) lleguen de la cadera al tobillo.
function knee(hip: Pt, ankle: Pt, l1: number, l2: number, bend: number): Pt {
  const d = Math.min(dist(hip, ankle), (l1 + l2) * 0.999), a0 = ang(hip, ankle);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const a = a0 + bend * Math.acos(c);
  return [hip[0] + Math.cos(a) * l1, hip[1] + Math.sin(a) * l1];
}

// Para qué lado dobla cada rodilla: el que en reposo da la rodilla de la imagen.
const BEND = Object.fromEntries((['B', 'F'] as const).map(side => {
  const L = LEGS[side], l1 = Math.hypot(L.knee[0] - L.hip[0], L.knee[1] - L.hip[1]), l2 = Math.hypot(L.ankle[0] - L.knee[0], L.ankle[1] - L.knee[1]);
  const err = (b: number) => { const k = knee(L.hip, L.ankle, l1, l2, b); return Math.hypot(k[0] - L.knee[0], k[1] - L.knee[1]); };
  return [side, err(1) < err(-1) ? 1 : -1];
})) as Record<'B' | 'F', number>;

export interface GrayOpts { kind: string; firing: boolean; flat: boolean; eyes?: string; lean?: number }
// Dibuja el gris con los pies en (0, 0), mirando a la derecha, de alto H. Devuelve la cabeza, el punto desde
// donde sale el rayo (menos 0,15 H, como espera `drawPerson`) y la mano de adelante; null si la imagen no cargó.
export function drawGraySprite(ctx: CanvasRenderingContext2D, H: number, k: number, t: number, o: GrayOpts) {
  load();
  if (!ready || !atlas) return null;
  const img: CanvasImageSource = o.flat && black ? black : H < 90 && small ? small : atlas;
  const imgScale = img === small ? 0.5 : 1;
  const sc = H / TALL;
  const moving = o.kind === 'walk' || o.kind === 'run', run = o.kind === 'run';
  const low = o.kind === 'squat' || o.kind === 'sit' || o.kind === 'crawl';
  const s = Math.sin(k), c = Math.cos(k);
  const bob = (moving ? -Math.abs(c) * (run ? 16 : 9) : Math.sin(t * 1.7 + k) * 3) + (low ? 70 : 0);
  const tilt = (run ? 0.09 : moving ? 0.03 : 0) + (o.lean ?? 0) * 0.6;
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.scale(sc, sc); ctx.translate(-CENTER_X, -FEET_Y);
  const draw = (p: Piece, pivot: Pt, to: Pt, rot: number) => {
    ctx.save(); ctx.translate(to[0], to[1]); if (rot) ctx.rotate(rot); ctx.translate(-pivot[0], -pivot[1]);
    ctx.drawImage(img, p.x * imgScale, p.y * imgScale, p.w * imgScale, p.h * imgScale, p.ox, p.oy, p.w / ATLAS_SCALE, p.h / ATLAS_SCALE);
    ctx.restore();
  };
  // Piernas: el tobillo va y viene con el paso (las dos piernas al revés) y se levanta al adelantarse.
  for (const side of ['B', 'F'] as const) {
    const L = LEGS[side], sign = side === 'F' ? 1 : -1;
    const stride = moving ? (run ? 105 : 70) : 0, liftMax = run ? 60 : 34;
    const lift = moving ? Math.max(0, sign * c) * liftMax : 0;
    const hip: Pt = [L.hip[0], L.hip[1] + bob];
    const ankle: Pt = [L.ankle[0] + sign * s * stride + (low ? (side === 'F' ? -30 : 30) : 0), L.ankle[1] - lift];
    const l1 = dist(L.hip, L.knee), l2 = dist(L.knee, L.ankle);
    const kn = knee(hip, ankle, l1, l2, BEND[side]);
    const footRot = moving ? -Math.max(0, sign * c) * (run ? 0.35 : 0.2) * (sign * s > 0 ? 1 : -0.6) : 0;
    draw(PIECES[`foot${side}`], L.ankle, ankle, footRot);
    draw(PIECES[`shin${side}`], L.knee, kn, ang(kn, ankle) - ang(L.knee, L.ankle));
    draw(PIECES[`thigh${side}`], L.hip, hip, ang(hip, kn) - ang(L.hip, L.knee));
  }
  // El cuerpo (cabeza, brazos y arma) sube y baja con el paso y se inclina un poco al correr.
  const pivot: Pt = [640, 620];
  ctx.save(); ctx.translate(pivot[0], pivot[1] + bob); ctx.rotate(tilt); ctx.translate(-pivot[0], -pivot[1]);
  draw(PIECES.body, [0, 0], [0, 0], 0);
  const glow = (x: number, y: number, r: number, color: string) => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(120,255,60,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  };
  if (!o.flat) {
    if (o.firing) glow(MUZZLE[0], MUZZLE[1], 90 + Math.sin(t * 40) * 15, 'rgba(220,255,180,0.95)');
    else glow(MUZZLE[0], MUZZLE[1], 34 + Math.sin(t * 6) * 6, 'rgba(160,255,90,0.45)');
    if (o.eyes) { ctx.save(); ctx.shadowColor = o.eyes; ctx.shadowBlur = 40; ctx.fillStyle = o.eyes; ctx.beginPath(); ctx.ellipse(EYE[0], EYE[1], 52, 30, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  ctx.restore();
  ctx.restore();
  // Los puntos que necesita el resto del dibujo, en coordenadas de afuera (pies en 0, 0).
  const out = (p: Pt): Pt => {
    const dx = p[0] - pivot[0], dy = p[1] - pivot[1], ca = Math.cos(tilt), sa = Math.sin(tilt);
    return [((pivot[0] + dx * ca - dy * sa) - CENTER_X) * sc, ((pivot[1] + bob + dx * sa + dy * ca) - FEET_Y) * sc];
  };
  const muzzle = out(MUZZLE);
  return { head: out(HEAD), ray: [muzzle[0] - H * 0.15, muzzle[1]] as Pt, hand: out(HAND_F), r: H * 0.16 };
}
