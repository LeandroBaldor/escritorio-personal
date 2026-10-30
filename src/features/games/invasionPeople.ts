// Cómo se dibuja la gente de "Invasión": el mismo estilo que la gente de ¡El piso es de lava! (de perfil,
// cabeza redonda con nariz, ojo y oreja, remera de colores, pantalón y zapatillas), pero con muchas más
// posturas (sentados, acostados, agachados, estirando el brazo, con los brazos arriba, gateando), con lo que
// tienen en la mano según lo que hacen, los aliens grises y todas las anomalías.
import { anomalyOf, poseOf, revealed, roomOf, type Invasion, type Person, type Pose } from './invasion';
import type { AnomalyFx, PropKind } from './invasionAnomalies';

export type HandProp = PropKind | 'bomb' | 'bombOff' | 'communicator' | 'glass' | 'brush' | 'toothbrush' | 'hammer' | 'brick' | 'scissors' | 'cloth' | 'ball' | 'dumbbell' | 'lighter' | 'raygun' | 'box' | 'tray' | 'pen';

export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const font = (weight: number, px: number) => `${weight} ${Math.max(7, Math.round(px))}px Nunito, system-ui`;
const SKINS = ['#fcd9b6', '#e0ac69', '#8d5524', '#f1c27d', '#c68642', '#ffdbac'];
const HAIRS = ['#1c1917', '#3b2412', '#78350f', '#a16207', '#facc15', '#d6d3d1', '#7c2d12', '#111827'];
const PANTS = ['#2563eb', '#1e3a8a', '#111827', '#78716c', '#b4966b', '#7f1d1d', '#15803d', '#334155', '#f8fafc'];
const SHOES = ['#f8fafc', '#111827', '#dc2626', '#eab308', '#78350f', '#1d4ed8'];
type Hat = 'cap' | 'helmet' | 'beanie' | 'short' | 'long' | 'bun' | 'bald' | 'curly';
const HATS: Hat[] = ['short', 'long', 'cap', 'short', 'bun', 'beanie', 'long', 'bald', 'curly', 'short', 'curly'];

type Pt = [number, number];
// Las articulaciones (en píxeles, con los pies en 0,0, adelante es +x y arriba es -y).
interface Skel { hip: Pt; neck: Pt; head: Pt; r: number; kneeF: Pt; kneeB: Pt; footF: Pt; footB: Pt; elbowF: Pt; elbowB: Pt; handF: Pt; handB: Pt }

// El esqueleto de cada postura. `k` es la fase del paso (o del movimiento) y `H` la altura en píxeles.
function skeleton(kind: Pose['kind'], H: number, k: number, opts: { armsOut?: boolean; longArms?: boolean; handF?: Pt; handB?: Pt; lean?: number }): Skel {
  const r = H * 0.2;
  let hip: Pt = [0, -H * 0.31], neck: Pt = [0, -H * 0.6], head: Pt = [0, -H * 0.79];
  let kneeF: Pt = [H * 0.02, -H * 0.16], kneeB: Pt = [-H * 0.02, -H * 0.16], footF: Pt = [H * 0.05, 0], footB: Pt = [-H * 0.04, 0];
  let handF: Pt = [H * 0.09, -H * 0.33], handB: Pt = [-H * 0.06, -H * 0.34];
  const s = Math.sin(k), c = Math.cos(k);
  switch (kind) {
    case 'walk':
      footF = [H * 0.16 * s, -Math.max(0, c) * H * 0.04]; footB = [-H * 0.16 * s, -Math.max(0, -c) * H * 0.04];
      kneeF = [footF[0] * 0.5 + H * 0.04, -H * 0.16]; kneeB = [footB[0] * 0.5 + H * 0.04, -H * 0.16];
      handF = [-H * 0.12 * s + H * 0.02, -H * 0.34]; handB = [H * 0.12 * s - H * 0.02, -H * 0.35];
      head = [0, -H * 0.79 - Math.abs(s) * H * 0.01];
      break;
    case 'run':
      footF = [H * 0.24 * s, -Math.max(0, c) * H * 0.12]; footB = [-H * 0.24 * s, -Math.max(0, -c) * H * 0.12];
      kneeF = [footF[0] * 0.4 + H * 0.12, -H * 0.18]; kneeB = [footB[0] * 0.4 + H * 0.12, -H * 0.18];
      neck = [H * 0.08, -H * 0.58]; head = [H * 0.12, -H * 0.77];
      handF = [H * 0.2 - H * 0.18 * s, -H * 0.46]; handB = [H * 0.02 + H * 0.18 * s, -H * 0.44];
      break;
    case 'sit':
      hip = [-H * 0.06, -H * 0.4]; neck = [-H * 0.04, -H * 0.69]; head = [-H * 0.03, -H * 0.88];
      kneeF = [H * 0.16, -H * 0.42]; kneeB = [H * 0.14, -H * 0.41]; footF = [H * 0.2, 0]; footB = [H * 0.16, 0];
      handF = [H * 0.16, -H * 0.43]; handB = [H * 0.12, -H * 0.42];
      break;
    case 'squat':
      hip = [-H * 0.1, -H * 0.2]; neck = [H * 0.06, -H * 0.47]; head = [H * 0.1, -H * 0.65];
      kneeF = [H * 0.14, -H * 0.28]; kneeB = [H * 0.1, -H * 0.26]; footF = [H * 0.04, 0]; footB = [-H * 0.06, 0];
      handF = [H * 0.3, -H * 0.12]; handB = [H * 0.22, -H * 0.16];
      break;
    case 'reach':
      handF = [H * 0.36, -H * 0.5 + Math.sin(k) * H * 0.03]; handB = [H * 0.26, -H * 0.47];
      break;
    case 'armsUp':
      handF = [H * 0.1, -H * 1.04]; handB = [-H * 0.08, -H * 1.02];
      break;
    case 'crawl':
      hip = [-H * 0.28, -H * 0.34]; neck = [H * 0.14, -H * 0.36]; head = [H * 0.32, -H * 0.42];
      kneeF = [-H * 0.26, 0]; kneeB = [-H * 0.32, 0]; footF = [-H * 0.56, -H * 0.06]; footB = [-H * 0.6, -H * 0.04];
      handF = [H * 0.16 + Math.sin(k) * H * 0.06, 0]; handB = [H * 0.1 - Math.sin(k) * H * 0.06, 0];
      break;
    default: {
      const b = Math.sin(k * 0.3) * H * 0.006; // respira
      neck = [0, -H * 0.6 + b]; head = [0, -H * 0.79 + b];
    }
  }
  if (opts.lean) { neck = [neck[0] + opts.lean * H, neck[1]]; head = [head[0] + opts.lean * H * 1.3, head[1]]; }
  if (opts.armsOut) { handF = [H * 0.38, -H * 0.58]; handB = [-H * 0.38, -H * 0.58]; }
  if (opts.longArms) { handF = [H * 0.12, -H * 0.02]; handB = [-H * 0.08, -H * 0.02]; }
  if (opts.handF) handF = opts.handF;
  if (opts.handB) handB = opts.handB;
  const shoulder: Pt = [neck[0], neck[1] + H * 0.04];
  const elbow = (hand: Pt, side: number): Pt => [(shoulder[0] + hand[0]) / 2 - side * H * 0.03, (shoulder[1] + hand[1]) / 2 + H * 0.03];
  return { hip, neck, head, r, kneeF, kneeB, footF, footB, handF, handB, elbowF: elbow(handF, 1), elbowB: elbow(handB, -1) };
}

type Top = 'tee' | 'shirt' | 'hoodie' | 'jacket' | 'sweater';
export interface Outfit {
  skin: string; hair: string; hat: Hat; hatColor: string; shirt: [string, string, string]; pants: string; shoes: string; vest: boolean; alien: boolean;
  // Los detalles de cada uno: qué tiene puesto arriba, anteojos, barba o bigote, mochila o cartera, reloj, aros, corbata.
  top: Top; glasses: boolean; beard: 0 | 1 | 2; bag: 0 | 1 | 2; watch: boolean; earring: boolean; tie: boolean; inner: string; belt: string;
  alienHead?: boolean; // el disfraz se le cae: la ropa es la de siempre pero la cara es la de un alien gris
}
const TOPS: Top[] = ['tee', 'shirt', 'hoodie', 'jacket', 'sweater', 'tee', 'shirt'];
export function outfitOf(p: Person, skinOverride?: string): Outfit {
  const L = p.look, worker = p.job === 'worker';
  const a = hsl(L.shirt, 62, 46), b = hsl(L.shirt2, 55, 70);
  // Los detalles salen de la misma "semilla" de cada persona, así siempre se ve igual.
  const ex = (n: number) => hash(L.skin * 1000 + L.hair * 100 + L.pants * 10 + L.shoes + n * 7.3);
  const hat = worker ? 'helmet' : HATS[Math.floor(L.hat * HATS.length)];
  const top = worker ? 'tee' : TOPS[Math.floor(ex(0) * TOPS.length)];
  return {
    skin: skinOverride ?? SKINS[Math.floor(L.skin * SKINS.length)], hair: HAIRS[Math.floor(L.hair * HAIRS.length)],
    hat, hatColor: worker ? '#facc15' : hsl((L.shirt + 180) % 360, 55, 42),
    shirt: worker ? ['#f97316', '#facc15', '#f97316'] : L.pattern === 0 ? [a, a, a] : L.pattern === 1 ? [a, b, a] : [b, a, a],
    pants: PANTS[Math.floor(L.pants * PANTS.length)], shoes: SHOES[Math.floor(L.shoes * SHOES.length)], vest: worker, alien: false,
    top, glasses: ex(1) < 0.22, beard: L.kid || hat === 'long' || hat === 'bun' ? 0 : ex(2) < 0.16 ? 2 : ex(2) < 0.26 ? 1 : 0,
    bag: p.room < 0 && !worker ? (ex(3) < 0.25 ? 1 : ex(3) < 0.4 ? 2 : 0) : 0, watch: ex(4) < 0.45, earring: (hat === 'long' || hat === 'bun') && ex(5) < 0.6,
    tie: top === 'shirt' && ex(6) < 0.4 && !L.kid, inner: hsl(L.shirt2, 30, 88), belt: ex(7) < 0.5 ? '#1c1917' : '#78350f',
  };
}
const ALIEN: Outfit = {
  skin: '#a8adb5', hair: '#a8adb5', hat: 'bald', hatColor: '#a8adb5', shirt: ['#9ca3af', '#9ca3af', '#9ca3af'], pants: '#8b9099', shoes: '#6b7280', vest: false, alien: true,
  top: 'tee', glasses: false, beard: 0, bag: 0, watch: false, earring: false, tie: false, inner: '#9ca3af', belt: '#8b9099',
};

const line = (ctx: CanvasRenderingContext2D, color: string, width: number, ...pts: Pt[]) => {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
};
const dot = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2); ctx.fill(); };

export interface HeadOpts { gaze?: [number, number]; face?: 'front' | 'back'; spin?: number; big?: number; upside?: boolean; eyes?: string; closed?: boolean; grin?: boolean; tongue?: boolean; scales?: boolean; hairUp?: boolean; neck?: number; antenna?: boolean; shades?: boolean }

// La cabeza: de perfil (como en los otros juegos) o de frente (cuando te mira), o la de un alien gris.
function drawHead(ctx: CanvasRenderingContext2D, o: Outfit, x: number, y: number, r: number, f: number, h: HeadOpts, t: number) {
  ctx.save(); ctx.translate(x, y);
  if (h.upside) ctx.rotate(Math.PI);
  const R = r * (h.big ?? 1);
  if (o.alien || o.alienHead) { // cabeza de alien gris: un huevo grande, ojos negros almendrados
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.5, R * 0.2, 0, -R * 0.2, R * 1.5);
    g.addColorStop(0, '#d1d5db'); g.addColorStop(1, '#6b7280');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f * R * 0.1, -R * 0.35, R * 1.05, R * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = h.eyes ?? '#05070a'; // mirándote fijo, los ojos le brillan verdes
    if (h.eyes) { ctx.shadowColor = h.eyes; ctx.shadowBlur = R * 0.8; }
    if (h.face === 'front') for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 0.42, -R * 0.25, R * 0.3, R * 0.5, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(f * R * 0.6, -R * 0.25, R * 0.28, R * 0.52, f * 0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; dot(ctx, 'rgba(255,255,255,0.7)', f * R * 0.55, -R * 0.45, R * 0.08);
    ctx.restore();
    return;
  }
  const spin = h.spin ?? 0, side = Math.cos(spin); // girando: la cara va y viene
  const front = h.face === 'front' || Math.abs(side) < 0.35, ff = h.face === 'back' ? -f : side >= 0 ? f : -f;
  if (h.neck) { line(ctx, o.skin, R * 0.6, [0, R * 0.8], [0, R * 0.8 + h.neck]); }
  // Pelo largo atrás.
  if (o.hat === 'long' && !front) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.roundRect(-ff * R * 1.05 - R * 0.55, -R * 0.2, R * 1.1, R * 2.1, R * 0.5); ctx.fill(); }
  const shade = ctx.createRadialGradient(ff * R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.15);
  shade.addColorStop(0, o.skin); shade.addColorStop(1, mixColor(o.skin, '#000000', 0.18));
  if (!front) dot(ctx, o.skin, ff * R * 0.95, R * 0.15, R * 0.26); // nariz
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  if (h.scales) for (let i = 0; i < 9; i++) dot(ctx, 'rgba(74,222,128,0.75)', (hash(i) - 0.5) * R * 1.4, (hash(i + 4) - 0.3) * R, R * 0.09);
  const eye = h.eyes ?? '#111';
  const brow = mixColor(o.hair, '#000000', 0.2), detail = R > 5;
  if (front) {
    for (const s of [-1, 1]) {
      if (h.closed) line(ctx, '#111', Math.max(1, R * 0.08), [s * R * 0.42 - R * 0.14, -R * 0.08], [s * R * 0.42 + R * 0.14, -R * 0.08]);
      else { const [gx, gy] = h.gaze ?? [0, 0]; dot(ctx, '#fff', s * R * 0.4, -R * 0.08, R * 0.2); dot(ctx, eye, s * R * 0.4 + gx * R * 0.06, -R * 0.06 + gy * R * 0.06, R * (h.gaze ? 0.15 : 0.11)); if (detail) dot(ctx, '#fff', s * R * 0.4 + R * 0.04 + gx * R * 0.08, -R * 0.1 + gy * R * 0.08, R * 0.03); }
      if (detail) { line(ctx, brow, Math.max(0.8, R * 0.08), [s * R * 0.25, -R * 0.36], [s * R * 0.58, -R * 0.33]); dot(ctx, 'rgba(244,114,182,0.22)', s * R * 0.55, R * 0.2, R * 0.16); }
    }
    if (detail) line(ctx, mixColor(o.skin, '#000000', 0.25), Math.max(0.7, R * 0.05), [0, -R * 0.05], [R * 0.06, R * 0.18], [-R * 0.04, R * 0.2]); // nariz
    if (o.glasses) { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(0.8, R * 0.07); for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * R * 0.4, -R * 0.07, R * 0.25, 0, Math.PI * 2); ctx.stroke(); } line(ctx, '#1f2937', Math.max(0.8, R * 0.06), [-R * 0.15, -R * 0.1], [R * 0.15, -R * 0.1]); }
    if (o.beard === 2) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, R * 0.15, R * 0.9, Math.PI * 0.08, Math.PI * 0.92); ctx.lineTo(-R * 0.5, R * 0.35); ctx.quadraticCurveTo(0, R * 0.62, R * 0.5, R * 0.35); ctx.fill(); }
    if (o.beard >= 1) line(ctx, o.hair, Math.max(1, R * 0.12), [-R * 0.28, R * 0.36], [R * 0.28, R * 0.36]);
    if (h.grin) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, R * 0.45, R * 0.55, R * 0.24, 0, 0, Math.PI); ctx.fill(); ctx.strokeStyle = '#78716c'; ctx.lineWidth = 0.8; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * R * 0.15, R * 0.45); ctx.lineTo(i * R * 0.15, R * 0.62); ctx.stroke(); } }
    else line(ctx, '#7f1d1d', Math.max(1, R * 0.08), [-R * 0.2, R * 0.48], [R * 0.2, R * 0.48]);
    if (h.tongue) line(ctx, '#f472b6', R * 0.22, [0, R * 0.5], [Math.sin(t * 6) * R * 0.3, R * 1.6]);
  } else {
    dot(ctx, mixColor(o.skin, '#000000', 0.12), -ff * R * 0.12, R * 0.12, R * 0.26); // oreja
    if (detail) dot(ctx, mixColor(o.skin, '#000000', 0.25), -ff * R * 0.12, R * 0.12, R * 0.1);
    if (o.earring) dot(ctx, '#facc15', -ff * R * 0.12, R * 0.42, Math.max(0.7, R * 0.08));
    if (h.closed) line(ctx, '#111', Math.max(1, R * 0.08), [ff * R * 0.38, -R * 0.05], [ff * R * 0.62, -R * 0.05]);
    else { dot(ctx, '#fff', ff * R * 0.52, -R * 0.06, R * 0.17); dot(ctx, eye, ff * R * 0.58, -R * 0.05, R * 0.1); if (detail) dot(ctx, '#fff', ff * R * 0.61, -R * 0.09, R * 0.03); }
    if (detail) { line(ctx, brow, Math.max(0.8, R * 0.08), [ff * R * 0.36, -R * 0.33], [ff * R * 0.72, -R * 0.3]); dot(ctx, 'rgba(244,114,182,0.22)', ff * R * 0.45, R * 0.25, R * 0.17); }
    line(ctx, mixColor(o.skin, '#7f1d1d', 0.5), Math.max(0.8, R * 0.07), [ff * R * 0.55, R * 0.48], [ff * R * 0.8, R * 0.42]); // boca
    if (o.beard === 2) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.moveTo(-ff * R * 0.1, R * 0.2); ctx.quadraticCurveTo(-ff * R * 0.05, R * 0.95, ff * R * 0.55, R * 0.92); ctx.quadraticCurveTo(ff * R * 0.9, R * 0.75, ff * R * 0.85, R * 0.52); ctx.lineTo(ff * R * 0.5, R * 0.55); ctx.quadraticCurveTo(ff * R * 0.2, R * 0.5, -ff * R * 0.1, R * 0.2); ctx.fill(); }
    if (o.beard >= 1) line(ctx, o.hair, Math.max(1, R * 0.12), [ff * R * 0.5, R * 0.36], [ff * R * 0.85, R * 0.32]);
    if (o.glasses) { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(0.8, R * 0.07); ctx.beginPath(); ctx.arc(ff * R * 0.62, -R * 0.06, R * 0.23, 0, Math.PI * 2); ctx.stroke(); line(ctx, '#1f2937', Math.max(0.8, R * 0.06), [ff * R * 0.39, -R * 0.1], [-ff * R * 0.1, -R * 0.02]); }
    if (h.grin) { ctx.fillStyle = '#fff'; ctx.fillRect(ff > 0 ? R * 0.35 : -R * 0.95, R * 0.36, R * 0.6, R * 0.2); }
    if (h.tongue) line(ctx, '#f472b6', R * 0.2, [ff * R * 0.8, R * 0.45], [ff * R * (1.8 + Math.sin(t * 7) * 0.3), R * 0.9]);
  }
  if (h.eyes) { // ojos que brillan
    const glow = ctx.createRadialGradient(front ? 0 : ff * R * 0.58, -R * 0.05, 0, front ? 0 : ff * R * 0.58, -R * 0.05, R * 1.1);
    glow.addColorStop(0, h.eyes); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55; ctx.fillStyle = glow; ctx.fillRect(-R * 1.6, -R * 1.2, R * 3.2, R * 2.4); ctx.globalAlpha = 1;
  }
  if (h.shades) { ctx.fillStyle = '#0f172a'; if (front) { ctx.fillRect(-R * 0.75, -R * 0.22, R * 0.6, R * 0.3); ctx.fillRect(R * 0.15, -R * 0.22, R * 0.6, R * 0.3); } else ctx.fillRect(ff > 0 ? R * 0.25 : -R * 0.95, -R * 0.22, R * 0.7, R * 0.3); }
  // Pelo o gorro.
  const top = (color: string, k = 1.03) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -R * 0.12, R * k, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); };
  if (h.hairUp && o.hat !== 'helmet') { for (let i = -4; i <= 4; i++) line(ctx, o.hair, Math.max(1, R * 0.12), [i * R * 0.2, -R * 0.75], [i * R * 0.3, -R * 1.6]); }
  switch (o.hat) {
    case 'cap': top(o.hatColor, 1.04); ctx.fillStyle = mixColor(o.hatColor, '#000000', 0.25); ctx.beginPath(); ctx.roundRect(ff > 0 ? R * 0.3 : -R * 1.55, -R * 0.32, R * 1.25, R * 0.22, R * 0.1); ctx.fill(); break;
    case 'helmet': top(o.hatColor, 1.1); ctx.fillStyle = o.hatColor; ctx.beginPath(); ctx.roundRect(-R * 1.35, -R * 0.26, R * 2.7, R * 0.2, R * 0.1); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-R * 0.1, -R * 1.15, R * 0.2, R * 0.9); break;
    case 'beanie': top(o.hatColor, 1.07); ctx.fillStyle = mixColor(o.hatColor, '#000000', 0.2); ctx.fillRect(-R * 1.06, -R * 0.34, R * 2.12, R * 0.3); dot(ctx, '#f8fafc', 0, -R * 1.25, R * 0.3); break;
    case 'curly': for (let i = 0; i < 7; i++) dot(ctx, o.hair, Math.cos(Math.PI + (i / 6) * Math.PI) * R * 0.9, -R * 0.2 + Math.sin(Math.PI + (i / 6) * Math.PI) * R * 0.85, R * 0.38); break;
    case 'bald': ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(ff * R * 0.2, -R * 0.55, R * 0.3, 0, Math.PI * 2); ctx.fill(); break;
    default:
      top(o.hair);
      if (!front) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(-ff * R * 0.55, R * 0.05, R * 0.48, R * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      if (o.hat === 'bun') dot(ctx, o.hair, -ff * R * 0.55, -R * 1.05, R * 0.42);
      if (R > 5) { // mechones y flequillo
        const strand = mixColor(o.hair, '#ffffff', 0.18);
        for (let i = 0; i < 4; i++) line(ctx, strand, Math.max(0.6, R * 0.05), [(-0.6 + i * 0.35) * R, -R * 0.95], [(-0.45 + i * 0.35) * R, -R * 0.55]);
        if (!front) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.moveTo(ff * R * 0.2, -R * 0.85); ctx.quadraticCurveTo(ff * R * 0.85, -R * 0.75, ff * R * 0.8, -R * 0.4); ctx.quadraticCurveTo(ff * R * 0.5, -R * 0.55, ff * R * 0.2, -R * 0.5); ctx.fill(); }
      }
  }
  if (h.antenna) for (const s of [-1, 1]) { line(ctx, '#4ade80', Math.max(1, R * 0.08), [s * R * 0.35, -R * 0.9], [s * R * 0.65, -R * 1.9]); dot(ctx, '#86efac', s * R * 0.65, -R * 1.9, R * 0.18); }
  ctx.restore();
}

const mixMemo = new Map<string, string>(); // (los mismos colores se mezclan miles de veces por segundo)
export function mixColor(a: string, b: string, k: number) {
  const key = `${a}|${b}|${k}`, hit = mixMemo.get(key); if (hit) return hit;
  if (mixMemo.size > 5000) mixMemo.clear();
  const out = mixColorRaw(a, b, k); mixMemo.set(key, out); return out;
}
function mixColorRaw(a: string, b: string, k: number) {
  const parse = (c: string) => {
    if (c.startsWith('#')) { const n = parseInt(c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const rgb = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
    const m = c.match(/hsla?\(([\d.]+),([\d.]+)%,([\d.]+)%/);
    if (!m) return [128, 128, 128];
    const h = +m[1], s = +m[2] / 100, l = +m[3] / 100, f = (n: number) => { const kk = (n + h / 30) % 12, aa = s * Math.min(l, 1 - l); return 255 * (l - aa * Math.max(-1, Math.min(kk - 3, 9 - kk, 1))); };
    return [f(0), f(8), f(4)];
  };
  const x = parse(a), y = parse(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}

export interface BodyOpts { head?: HeadOpts; prop?: HandProp; propAt?: 'front' | 'back' | 'mouth' | 'ear' | 'head' | 'up'; propUpside?: boolean; armsOut?: boolean; longArms?: boolean; handF?: Pt; handB?: Pt; lean?: number; sx?: number; vest?: boolean }

// Una persona entera con los pies en 0,0 (en píxeles), mirando hacia `f`.
export function drawBody(ctx: CanvasRenderingContext2D, o: Outfit, kind: Pose['kind'], H: number, f: 1 | -1, k: number, t: number, opts: BodyOpts = {}) {
  ctx.save();
  ctx.scale(f * (opts.sx ?? 1), 1); // todo se dibuja mirando a la derecha y se da vuelta
  const lie = kind === 'lie' || kind === 'dead';
  if (lie) { ctx.translate(-H * 0.45, 0); ctx.rotate(-Math.PI / 2); ctx.translate(0, H * 0.12); }
  const sk = skeleton(lie ? 'stand' : kind, H, k, opts);
  if (kind === 'dead') { sk.handF = [H * 0.3, -H * 0.62]; sk.handB = [-H * 0.25, -H * 0.5]; sk.footF = [H * 0.18, 0]; sk.footB = [-H * 0.12, -H * 0.02]; sk.kneeF = [H * 0.1, -H * 0.16]; }
  const limb = Math.max(1.5, H * (o.alien ? 0.06 : 0.09));
  const sleeve = o.alien ? o.skin : o.top === 'jacket' ? mixColor(o.shirt[0], '#000000', 0.15) : o.shirt[0];
  const detail = H > 40 && !o.alien;
  // Un brazo: manga (corta o larga, con puño), la piel, la mano con el pulgar y, a veces, el reloj.
  const arm = (shoulder: Pt, elbow: Pt, hand: Pt, dark: number, back: boolean) => {
    const sl = mixColor(sleeve, '#000000', dark), skin = mixColor(o.skin, '#000000', dark * 0.6);
    const along = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const long = o.alien || o.top !== 'tee';
    line(ctx, skin, limb * 0.9, elbow, hand);
    if (long) { const cuff = along(elbow, hand, 0.82); line(ctx, sl, limb * 1.05, shoulder, elbow, cuff); if (detail) line(ctx, mixColor(sl, '#000000', 0.2), limb * 1.1, along(elbow, hand, 0.74), cuff); }
    else { line(ctx, skin, limb * 0.9, along(shoulder, elbow, 0.5), elbow); line(ctx, sl, limb * 1.15, shoulder, along(shoulder, elbow, 0.55)); }
    if (o.watch && back && detail) line(ctx, '#1f2937', limb * 1.0, along(elbow, hand, 0.84), along(elbow, hand, 0.9));
    dot(ctx, skin, hand[0], hand[1], limb * 0.62);
    if (detail) dot(ctx, mixColor(skin, '#000000', 0.08), hand[0] + limb * 0.35, hand[1] - limb * 0.35, limb * 0.28);
  };
  const shoulderPt: Pt = [sk.neck[0], sk.neck[1] + H * 0.04];
  // Cartera colgada (atrás) y mochila.
  if (o.bag === 2 && kind !== 'lie' && kind !== 'dead') { line(ctx, '#57534e', Math.max(1, H * 0.015), shoulderPt, [sk.hip[0] - H * 0.1, sk.hip[1] - H * 0.02]); ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.roundRect(sk.hip[0] - H * 0.2, sk.hip[1] - H * 0.06, H * 0.16, H * 0.12, H * 0.02); ctx.fill(); }
  if (o.bag === 1 && kind !== 'lie' && kind !== 'dead') { const bx = (sk.hip[0] + sk.neck[0]) / 2 - H * 0.2, by = (sk.hip[1] + sk.neck[1]) / 2; ctx.fillStyle = mixColor(o.hatColor, '#000000', 0.2); ctx.beginPath(); ctx.roundRect(bx - H * 0.07, by - H * 0.12, H * 0.14, H * 0.26, H * 0.04); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(bx - H * 0.06, by + H * 0.02, H * 0.12, H * 0.02); }
  // Brazo de atrás.
  arm(shoulderPt, sk.elbowB, sk.handB, 0.25, true);
  if (opts.prop && opts.propAt === 'back') drawProp(ctx, opts.prop, sk.handB[0], sk.handB[1], H, t, opts.propUpside);
  // Piernas.
  const legW = Math.max(2, H * (o.alien ? 0.07 : 0.11));
  line(ctx, mixColor(o.pants, '#000000', 0.3), legW, sk.hip, sk.kneeB, sk.footB);
  line(ctx, o.pants, legW, sk.hip, sk.kneeF, sk.footF);
  if (detail) for (const [hip, knee] of [[sk.hip, sk.kneeF]] as [Pt, Pt][]) line(ctx, 'rgba(0,0,0,0.12)', Math.max(1, legW * 0.15), [hip[0] + legW * 0.25, hip[1]], [knee[0] + legW * 0.25, knee[1]]); // costura
  for (const [fx, fy] of [sk.footB, sk.footF]) {
    ctx.fillStyle = o.shoes; ctx.beginPath(); ctx.ellipse(fx + H * 0.03, fy - H * 0.017, H * 0.075, H * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    if (detail) { ctx.fillStyle = mixColor(o.shoes, o.shoes === '#f8fafc' ? '#000000' : '#ffffff', 0.35); ctx.fillRect(fx - H * 0.04, fy - H * 0.008, H * 0.145, H * 0.012); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(fx, fy - H * 0.04, H * 0.04, H * 0.008); } // suela y cordones
  }
  // Torso: remera de tres franjas (o el cuerpo gris de un alien), un poco inclinado si corre o se agacha.
  const tw = H * (o.alien ? 0.2 : 0.28), ang = Math.atan2(sk.neck[0] - sk.hip[0], sk.hip[1] - sk.neck[1]);
  const len = Math.hypot(sk.neck[0] - sk.hip[0], sk.neck[1] - sk.hip[1]) + H * 0.05;
  ctx.save(); ctx.translate(sk.hip[0], sk.hip[1] + H * 0.03); ctx.rotate(ang);
  ctx.beginPath(); ctx.roundRect(-tw / 2, -len, tw, len, tw * 0.35); ctx.save(); ctx.clip();
  ctx.fillStyle = o.shirt[2]; ctx.fillRect(-tw, -len, tw * 2, len);
  ctx.fillStyle = o.shirt[1]; ctx.fillRect(-tw, -len * 0.66, tw * 2, len * 0.34);
  ctx.fillStyle = o.shirt[0]; ctx.fillRect(-tw, -len, tw * 2, len * 0.34);
  if (opts.vest) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-tw, -len * 0.42, tw * 2, len * 0.07); }
  if (detail) {
    const thin = Math.max(0.8, H * 0.008);
    if (o.top === 'shirt') { // camisa: tapa de botones, botones y bolsillo
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(tw * 0.28, -len, thin, len);
      for (let i = 1; i < 5; i++) dot(ctx, '#f8fafc', tw * 0.36, -len + i * len * 0.2, H * 0.009);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = thin; ctx.strokeRect(-tw * 0.05, -len * 0.78, tw * 0.28, len * 0.16);
      if (o.tie) { ctx.fillStyle = mixColor(o.hatColor, '#000000', 0.2); ctx.beginPath(); ctx.moveTo(tw * 0.33, -len + H * 0.02); ctx.lineTo(tw * 0.43, -len * 0.4); ctx.lineTo(tw * 0.33, -len * 0.3); ctx.lineTo(tw * 0.23, -len * 0.4); ctx.fill(); }
    }
    if (o.top === 'jacket') { // campera abierta: se ve la remera de abajo y la solapa
      ctx.fillStyle = o.inner; ctx.fillRect(tw * 0.22, -len, tw * 0.3, len);
      ctx.fillStyle = mixColor(o.shirt[0], '#000000', 0.25); ctx.beginPath(); ctx.moveTo(tw * 0.2, -len); ctx.lineTo(tw * 0.38, -len * 0.62); ctx.lineTo(tw * 0.18, -len * 0.55); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-tw * 0.3, -len * 0.38, tw * 0.35, thin);
    }
    if (o.top === 'hoodie') { // buzo con capucha y cordones
      line(ctx, '#f8fafc', thin * 1.3, [tw * 0.3, -len * 0.95], [tw * 0.33, -len * 0.7]); line(ctx, '#f8fafc', thin * 1.3, [tw * 0.15, -len * 0.95], [tw * 0.17, -len * 0.72]);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-tw * 0.2, -len * 0.4, tw * 0.55, len * 0.22);
    }
    if (o.top === 'sweater') for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-tw, -len * 0.1 + i * len * 0.025, tw * 2, thin); } // puño elástico abajo
    if (o.top === 'tee') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-tw, -len * 0.04, tw * 2, thin); }
  }
  const sh = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0); sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = sh; ctx.fillRect(-tw, -len, tw * 2, len);
  ctx.restore();
  if (detail) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(0.8, H * 0.007); ctx.beginPath(); ctx.roundRect(-tw / 2, -len, tw, len, tw * 0.35); ctx.stroke(); } // contorno
  ctx.fillStyle = o.pants; ctx.fillRect(-tw / 2, -H * 0.06, tw, H * 0.07); // cintura
  if (detail && (o.top === 'shirt' || o.top === 'tee')) { ctx.fillStyle = o.belt; ctx.fillRect(-tw / 2, -H * 0.06, tw, H * 0.03); ctx.fillStyle = '#d4d4d8'; ctx.fillRect(tw * 0.3, -H * 0.063, H * 0.03, H * 0.036); } // cinturón
  if (detail && o.top === 'hoodie') { ctx.fillStyle = o.shirt[0]; ctx.beginPath(); ctx.ellipse(-tw * 0.45, -len + H * 0.03, tw * 0.3, H * 0.05, -0.3, 0, Math.PI * 2); ctx.fill(); } // capucha
  if (detail && o.top === 'shirt') { ctx.fillStyle = mixColor(o.shirt[0], '#ffffff', 0.25); ctx.beginPath(); ctx.moveTo(-tw * 0.1, -len + H * 0.01); ctx.lineTo(tw * 0.4, -len + H * 0.01); ctx.lineTo(tw * 0.25, -len + H * 0.06); ctx.fill(); } // cuello
  ctx.restore();
  if (!o.alien) { const nk: Pt = [sk.neck[0], sk.neck[1]]; line(ctx, mixColor(o.skin, '#000000', 0.1), Math.max(1.5, H * 0.075), [nk[0], nk[1] + H * 0.01], [sk.head[0] * 0.6 + nk[0] * 0.4, sk.head[1] + sk.r * 0.7]); } // cuello
  // Cabeza.
  const h = opts.head ?? {};
  const head: Pt = [sk.head[0], sk.head[1] - (h.neck ?? 0)];
  drawHead(ctx, o, head[0], head[1], sk.r, 1, h.face === 'front' && f < 0 ? h : h, t);
  // Brazo de adelante.
  arm(shoulderPt, sk.elbowF, sk.handF, 0, false);
  if (o.alien) for (let i = -1; i <= 1; i++) line(ctx, o.skin, Math.max(0.8, limb * 0.3), sk.handF, [sk.handF[0] + H * 0.06, sk.handF[1] + i * H * 0.03]); // dedos largos
  if (opts.prop) {
    const at = opts.propAt ?? 'front';
    if (at === 'front' || at === 'up') drawProp(ctx, opts.prop, sk.handF[0], sk.handF[1], H, t, opts.propUpside);
    if (at === 'mouth') drawProp(ctx, opts.prop, head[0] + sk.r * 1.1, head[1] + sk.r * 0.5, H, t, opts.propUpside);
    if (at === 'ear') drawProp(ctx, opts.prop, head[0] + sk.r * 0.1, head[1] + sk.r * 0.2, H, t, opts.propUpside);
    if (at === 'head') drawProp(ctx, opts.prop, head[0], head[1] - sk.r * 1.1, H, t, opts.propUpside);
  }
  ctx.restore();
  return { head: [head[0] * f * (opts.sx ?? 1), head[1]] as Pt, handF: [sk.handF[0] * f, sk.handF[1]] as Pt, r: sk.r };
}

// Lo que tienen en la mano (dibujado chiquito, centrado en la mano).
export function drawProp(ctx: CanvasRenderingContext2D, kind: HandProp, x: number, y: number, H: number, t: number, upside = false) {
  const u = H * 0.1;
  ctx.save(); ctx.translate(x, y); if (upside) ctx.rotate(Math.PI);
  const rect = (c: string | CanvasGradient, x1: number, y1: number, w: number, h: number, rr = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x1 * u, y1 * u, w * u, h * u, rr * u); ctx.fill(); };
  const circ = (c: string, cx: number, cy: number, r: number) => dot(ctx, c, cx * u, cy * u, r * u);
  switch (kind) {
    case 'plant': case 'cactus': rect('#9a3412', -0.5, -0.2, 1, 0.8, 0.1); for (let i = 0; i < 4; i++) { ctx.fillStyle = kind === 'cactus' ? '#16a34a' : '#22c55e'; ctx.beginPath(); ctx.ellipse((i - 1.5) * 0.3 * u, -0.8 * u, 0.25 * u, 0.7 * u, (i - 1.5) * 0.3, 0, Math.PI * 2); ctx.fill(); } break;
    case 'flower': line(ctx, '#16a34a', u * 0.15, [0, 0], [0, -1.4 * u]); for (let i = 0; i < 5; i++) circ('#f472b6', Math.cos(i * 1.26) * 0.35, -1.4 + Math.sin(i * 1.26) * 0.35, 0.25); circ('#facc15', 0, -1.4, 0.18); break;
    case 'soap': rect('#fbcfe8', -0.5, -0.35, 1, 0.6, 0.2); break;
    case 'bulb': circ('#fef9c3', 0, -0.5, 0.5); rect('#9ca3af', -0.22, -0.1, 0.44, 0.4); break;
    case 'battery': rect('#111827', -0.2, -0.8, 0.4, 1.1, 0.05); rect('#f59e0b', -0.2, -0.8, 0.4, 0.35); break;
    case 'sock': case 'cloth': rect(kind === 'sock' ? '#f8fafc' : '#60a5fa', -0.25, -1, 0.5, 1, 0.1); rect(kind === 'sock' ? '#ef4444' : '#93c5fd', -0.25, -0.1, 0.8, 0.4, 0.2); break;
    case 'fish': ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(0, 0, 1.1 * u, 0.4 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(1 * u, 0); ctx.lineTo(1.6 * u, -0.4 * u); ctx.lineTo(1.6 * u, 0.4 * u); ctx.fill(); circ('#111', -0.7, -0.1, 0.08); break;
    case 'newspaper': case 'book': rect(kind === 'book' ? '#7c2d12' : '#e7e5e4', -0.7, -0.9, 1.4, 1.1, 0.05); if (kind === 'newspaper') for (let i = 0; i < 4; i++) rect('#78716c', -0.55, -0.75 + i * 0.25, 1.1, 0.08); else { rect('#fef3c7', -0.6, -0.8, 1.2, 0.15); ctx.fillStyle = '#fef3c7'; ctx.font = font(900, u * 0.5); ctx.textAlign = 'center'; ctx.fillText('A', 0, -0.2 * u); } break;
    case 'crayon': rect('#ef4444', -0.15, -1, 0.3, 1.1, 0.05); break;
    case 'candle': rect('#fef3c7', -0.2, -1.1, 0.4, 1.1); circ(Math.floor(t * 10) % 2 ? '#fde047' : '#fb923c', 0, -1.35, 0.2); break;
    case 'sponge': rect('#facc15', -0.5, -0.4, 1, 0.6, 0.1); rect('#16a34a', -0.5, -0.4, 1, 0.18); break;
    case 'remote': rect('#1f2937', -0.2, -0.9, 0.4, 1.2, 0.1); circ('#ef4444', 0, -0.7, 0.08); break;
    case 'ice': rect('rgba(186,230,253,0.9)', -0.35, -0.6, 0.7, 0.7, 0.1); break;
    case 'phone': rect('#111827', -0.22, -0.8, 0.44, 0.9, 0.08); rect('#38bdf8', -0.17, -0.72, 0.34, 0.6, 0.05); break;
    case 'umbrella': line(ctx, '#57534e', u * 0.12, [0, 0], [0, -3 * u]); ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(0, -3 * u, 1.7 * u, Math.PI, 0); ctx.fill(); break;
    case 'pan': rect('#1f2937', -0.9, -0.2, 1.4, 0.35, 0.15); rect('#57534e', 0.4, -0.12, 1.1, 0.16); break;
    case 'fork': line(ctx, '#d1d5db', u * 0.14, [0, 0.3 * u], [0, -1 * u]); for (let i = -1; i <= 1; i++) line(ctx, '#d1d5db', u * 0.08, [i * 0.15 * u, -1 * u], [i * 0.15 * u, -1.4 * u]); break;
    case 'iron': ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(-0.8 * u, 0.2 * u); ctx.lineTo(0.8 * u, 0.2 * u); ctx.lineTo(0.5 * u, -0.4 * u); ctx.lineTo(-0.6 * u, -0.4 * u); ctx.fill(); rect('#3b82f6', -0.4, -0.75, 0.8, 0.35, 0.15); break;
    case 'banana': ctx.strokeStyle = '#facc15'; ctx.lineWidth = u * 0.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0.5 * u, -0.6 * u, 0.8 * u, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); break;
    case 'toaster': rect('#cbd5e1', -0.8, -0.9, 1.6, 1, 0.25); rect('#334155', -0.5, -0.9, 0.3, 0.12); rect('#334155', 0.2, -0.9, 0.3, 0.12); break;
    case 'sunglasses': rect('#0f172a', -0.6, -0.15, 0.5, 0.3, 0.1); rect('#0f172a', 0.1, -0.15, 0.5, 0.3, 0.1); break;
    case 'guitar': ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.ellipse(-0.6 * u, 0, 0.8 * u, 0.6 * u, 0, 0, Math.PI * 2); ctx.fill(); rect('#78350f', 0, -0.12, 2.2, 0.24); circ('#1c1917', -0.6, 0, 0.2); break;
    case 'vase': rect('#0ea5e9', -0.4, -1, 0.8, 1.1, 0.35); line(ctx, '#16a34a', u * 0.1, [0, -1 * u], [0.2 * u, -1.8 * u]); circ('#f472b6', 0.2, -1.9, 0.22); break;
    case 'fishbowl': circ('rgba(125,211,252,0.7)', 0, -0.6, 0.75); circ('#f97316', 0.15, -0.55, 0.18); break;
    case 'paint': rect('#e5e7eb', -0.5, -0.9, 1, 1, 0.08); rect('#2563eb', -0.5, -0.9, 1, 0.3); break;
    case 'watering': rect('#16a34a', -0.6, -0.8, 1, 0.8, 0.15); line(ctx, '#16a34a', u * 0.15, [0.3 * u, -0.6 * u], [1.2 * u, -1.1 * u]); break;
    case 'shoe': rect('#78350f', -0.7, -0.4, 1.3, 0.45, 0.2); rect('#78350f', -0.7, -0.9, 0.5, 0.6, 0.1); break;
    case 'bucket': rect('#3b82f6', -0.55, -0.9, 1.1, 1, 0.1); line(ctx, '#64748b', u * 0.08, [-0.5 * u, -0.9 * u], [0, -1.4 * u], [0.5 * u, -0.9 * u]); break;
    case 'lamp': line(ctx, '#57534e', u * 0.12, [0, 0], [0, -1.6 * u]); ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(-0.6 * u, -1.4 * u); ctx.lineTo(0.6 * u, -1.4 * u); ctx.lineTo(0.35 * u, -2.1 * u); ctx.lineTo(-0.35 * u, -2.1 * u); ctx.fill(); { const g = ctx.createRadialGradient(0, -1.4 * u, 0, 0, -1.4 * u, 2.5 * u); g.addColorStop(0, 'rgba(254,243,199,0.6)'); g.addColorStop(1, 'rgba(254,243,199,0)'); ctx.fillStyle = g; ctx.fillRect(-2.5 * u, -3.9 * u, 5 * u, 5 * u); } break;
    case 'spoons': for (let i = 0; i < 5; i++) { line(ctx, '#d1d5db', u * 0.1, [(i - 2) * 0.12 * u, 0], [(i - 2) * 0.2 * u, -1.1 * u]); ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse((i - 2) * 0.2 * u, -1.2 * u, 0.12 * u, 0.2 * u, 0, 0, Math.PI * 2); ctx.fill(); } break;
    case 'flashlight': rect('#1f2937', -0.2, -0.2, 1.1, 0.4, 0.1); if (Math.floor(t * 4) % 2) { ctx.fillStyle = 'rgba(254,249,195,0.55)'; ctx.beginPath(); ctx.moveTo(0.9 * u, 0); ctx.lineTo(5 * u, -2 * u); ctx.lineTo(5 * u, 2 * u); ctx.fill(); } break;
    case 'clock': circ('#f8fafc', 0, -0.5, 0.55); line(ctx, '#111', u * 0.08, [0, -0.5 * u], [Math.cos(t * 9) * 0.4 * u, (-0.5 + Math.sin(t * 9) * 0.4) * u]); break;
    case 'kettle': rect('#ef4444', -0.6, -0.9, 1.2, 0.9, 0.35); line(ctx, '#ef4444', u * 0.15, [0.5 * u, -0.6 * u], [1 * u, -1 * u]); for (let i = 0; i < 3; i++) circ('rgba(255,255,255,0.5)', 1 + i * 0.2, -1.3 - i * 0.4 - (t % 1) * 0.3, 0.2 + i * 0.08); break;
    case 'egg': ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.ellipse(0, -0.4 * u, 0.35 * u, 0.48 * u, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'cable': ctx.strokeStyle = '#111827'; ctx.lineWidth = u * 0.15; ctx.beginPath(); ctx.moveTo(-1 * u, 0.5 * u); ctx.bezierCurveTo(-0.5 * u, -1 * u, 0.5 * u, 1 * u, 1 * u, -0.5 * u); ctx.stroke(); break;
    case 'magnet': ctx.strokeStyle = '#dc2626'; ctx.lineWidth = u * 0.35; ctx.beginPath(); ctx.arc(0, -0.5 * u, 0.5 * u, 0, Math.PI); ctx.stroke(); rect('#d1d5db', 0.32, -0.6, 0.36, 0.3); rect('#d1d5db', -0.68, -0.6, 0.36, 0.3); break;
    case 'coin': circ('#facc15', 0, -0.2, 0.3); break;
    case 'cup': case 'glass': rect(kind === 'cup' ? '#f8fafc' : 'rgba(186,230,253,0.8)', -0.3, -0.7, 0.6, 0.75, 0.08); if (kind === 'glass') rect('#f59e0b', -0.25, -0.4, 0.5, 0.4); break;
    case 'brush': line(ctx, '#78350f', u * 0.12, [0, 0], [0, -1.2 * u]); rect('#dc2626', -0.12, -1.5, 0.24, 0.35, 0.1); break;
    case 'toothbrush': line(ctx, '#38bdf8', u * 0.12, [0, 0], [0.9 * u, -0.3 * u]); rect('#f8fafc', 0.8, -0.5, 0.35, 0.18); break;
    case 'hammer': { const a = Math.sin(t * 9) * 0.8; ctx.rotate(a); line(ctx, '#92400e', u * 0.18, [0, 0], [0, -1.3 * u]); rect('#4b5563', -0.45, -1.6, 0.9, 0.35, 0.05); break; }
    case 'brick': rect('#b45309', -0.6, -0.5, 1.2, 0.5, 0.05); break;
    case 'scissors': line(ctx, '#d1d5db', u * 0.1, [-0.4 * u, 0], [0.6 * u, -0.6 * u]); line(ctx, '#d1d5db', u * 0.1, [-0.4 * u, -0.6 * u], [0.6 * u, 0]); break;
    case 'ball': circ('#ef4444', 0, -0.4, 0.45); break;
    case 'dumbbell': rect('#374151', -1.1, -0.15, 2.2, 0.3); rect('#111827', -1.3, -0.45, 0.4, 0.9, 0.1); rect('#111827', 0.9, -0.45, 0.4, 0.9, 0.1); break;
    case 'lighter': rect('#ef4444', -0.2, -0.5, 0.4, 0.7, 0.08); { const fl = 0.8 + Math.sin(t * 30) * 0.2; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(0, -0.85 * u, 0.15 * u, 0.35 * u * fl, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(0, -0.8 * u, 0.08 * u, 0.2 * u * fl, 0, 0, Math.PI * 2); ctx.fill(); } break;
    case 'raygun': rect('#64748b', -0.3, -0.3, 1.4, 0.45, 0.15); rect('#4ade80', 0.9, -0.22, 0.4, 0.3, 0.1); rect('#475569', -0.2, -0.05, 0.3, 0.6, 0.1); break;
    case 'box': rect('#c08a4b', -0.7, -1, 1.4, 1, 0.05); rect('#e7c48b', -0.7, -0.6, 1.4, 0.1); break;
    case 'bomb': case 'bombOff': { // la bomba de los aliens: una caja roja grande, con cinta de peligro, cables y una luz
      const on = kind === 'bomb', gr = ctx.createLinearGradient(0, -2.1 * u, 0, 2.1 * u);
      gr.addColorStop(0, on ? '#ef4444' : '#a8a29e'); gr.addColorStop(1, on ? '#7f1d1d' : '#57534e');
      rect(gr, -2.8, -2.1, 5.6, 4.2, 0.25);
      ctx.save(); ctx.beginPath(); ctx.rect(-2.8 * u, -0.45 * u, 5.6 * u, 0.9 * u); ctx.clip();
      ctx.fillStyle = '#facc15'; ctx.fillRect(-2.8 * u, -0.45 * u, 5.6 * u, 0.9 * u);
      ctx.fillStyle = '#111827'; for (let i = -4; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 0.8 * u, 0.45 * u); ctx.lineTo((i * 0.8 + 0.4) * u, 0.45 * u); ctx.lineTo((i * 0.8 + 0.9) * u, -0.45 * u); ctx.lineTo((i * 0.8 + 0.5) * u, -0.45 * u); ctx.fill(); }
      ctx.restore();
      rect('#111827', 0.5, -1.75, 2, 0.95, 0.1); // pantallita del reloj
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, u * 0.12); ctx.strokeRect(-2.8 * u, -2.1 * u, 5.6 * u, 4.2 * u);
      line(ctx, '#2563eb', u * 0.18, [-1.8 * u, -2.1 * u], [-1.2 * u, -3 * u], [-0.4 * u, -2.1 * u]);
      line(ctx, '#16a34a', u * 0.18, [-1.4 * u, -2.1 * u], [-0.3 * u, -3.2 * u], [0.6 * u, -2.1 * u]);
      const blink = on && Math.floor(t * 4) % 2 === 0;
      if (blink) { const g = ctx.createRadialGradient(-2 * u, -1.4 * u, 0, -2 * u, -1.4 * u, 2.2 * u); g.addColorStop(0, 'rgba(254,202,202,0.9)'); g.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = g; ctx.fillRect(-4.2 * u, -3.6 * u, 4.4 * u, 4.4 * u); }
      circ(blink ? '#fef2f2' : on ? '#7f1d1d' : '#44403c', -2, -1.4, 0.4);
      break;
    }
    case 'communicator': { // el intercomunicador extraterrestre: grande, violeta, con pantalla verde, botones y antena
      const gr = ctx.createLinearGradient(-1.6 * u, 0, 1.6 * u, 0); gr.addColorStop(0, '#6d28d9'); gr.addColorStop(0.5, '#4c1d95'); gr.addColorStop(1, '#1e1b4b');
      rect(gr, -1.6, -2.8, 3.2, 4.6, 0.6);
      line(ctx, '#a5b4fc', u * 0.2, [-1 * u, -2.7 * u], [-1.6 * u, -5.2 * u]);
      const pulse = 0.5 + Math.sin(t * 9) * 0.5;
      circ(`rgba(74,222,128,${0.4 + pulse * 0.6})`, -1.6, -5.3, 0.45);
      rect('#052e16', -1.15, -2.3, 2.3, 1.7, 0.2);
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = Math.max(1, u * 0.15); ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const x = -1 + i * (2 / 12), y = -1.45 + Math.sin(i * 1.3 + t * 14) * 0.45 * pulse; if (i) ctx.lineTo(x * u, y * u); else ctx.moveTo(x * u, y * u); }
      ctx.stroke();
      for (let i = 0; i < 6; i++) circ(['#f472b6', '#22d3ee', '#facc15', '#4ade80', '#f97316', '#a78bfa'][i], -0.8 + (i % 3) * 0.8, -0.1 + Math.floor(i / 3) * 0.75, 0.25);
      for (let i = 0; i < 4; i++) rect('rgba(255,255,255,0.15)', -1.3, 1.1 + i * 0.16, 2.6, 0.06);
      break;
    }
    case 'tray': rect('#94a3b8', -0.9, -0.08, 1.8, 0.16); rect('rgba(186,230,253,0.8)', -0.5, -0.65, 0.35, 0.57); rect('rgba(186,230,253,0.8)', 0.15, -0.65, 0.35, 0.57); break;
    case 'pen': line(ctx, '#1d4ed8', u * 0.1, [0, 0], [0.5 * u, -0.9 * u]); break;
  }
  ctx.restore();
}

// Qué tiene en la mano según lo que está haciendo (cuando no hay una anomalía).
const ACTIVITY_PROP: Partial<Record<Person['act'], [HandProp, BodyOpts['propAt']]>> = {
  cook: ['pan', 'front'], eat: ['fork', 'front'], drink: ['glass', 'front'], read: ['book', 'front'], phone: ['phone', 'ear'],
  paint: ['brush', 'front'], groom: ['toothbrush', 'front'], clean: ['sponge', 'front'], carry: ['brick', 'front'], hammer: ['hammer', 'front'],
  serve: ['tray', 'front'], cut: ['scissors', 'front'], fold: ['cloth', 'front'], play: ['ball', 'front'], lift: ['dumbbell', 'front'], tv: ['remote', 'front'], work: ['pen', 'front'],
};

// ¿Qué hace la anomalía con el cuerpo, la cabeza y lo que tiene en la mano?
function anomalyOpts(fx: AnomalyFx, t: number, k: number): { body: BodyOpts; skin?: string; front?: boolean } {
  const body: BodyOpts = { head: {} }, head = body.head!;
  switch (fx.t) {
    case 'body':
      if (fx.mode === 'headspin') head.spin = k * 5;
      if (fx.mode === 'headback') head.face = 'back';
      if (fx.mode === 'longarms') body.longArms = true;
      if (fx.mode === 'bigHead') head.big = 1 + Math.min(1, k) * 0.7;
      if (fx.mode === 'neck') head.neck = Math.min(1, k) * 0.35;
      if (fx.mode === 'upsideHead') head.upside = true;
      break;
    case 'look':
      if (fx.mode === 'eyes') head.eyes = fx.color;
      if (fx.mode === 'antenna') head.antenna = true;
      if (fx.mode === 'hairup') head.hairUp = true;
      if (fx.mode === 'tongue') head.tongue = true;
      if (fx.mode === 'scales') head.scales = true;
      if (fx.mode === 'skin') return { body, skin: Math.sin(t * 7) > -0.2 ? fx.color : undefined };
      break;
    case 'prop': {
      body.prop = fx.prop;
      body.propAt = fx.action === 'eat' || fx.action === 'drink' ? 'mouth' : fx.action === 'wear' ? (fx.prop === 'sunglasses' ? undefined : 'head') : fx.prop === 'phone' || fx.prop === 'banana' || fx.prop === 'clock' || fx.prop === 'cup' || fx.prop === 'fish' ? 'ear' : fx.action === 'wave' ? 'up' : 'front';
      if (fx.action === 'upside') body.propUpside = true;
      if (fx.action === 'wear' && fx.prop === 'sunglasses') { head.shades = true; body.prop = undefined; }
      if (fx.action === 'wave' || fx.prop === 'umbrella') body.handF = [0.12, -1.05 + Math.sin(t * 8) * 0.05];
      if (body.propAt === 'mouth' || body.propAt === 'ear') body.handF = [0.24, -0.72];
      if (fx.prop === 'fork' && fx.action === 'use') { body.propAt = 'head'; body.handF = [0.05, -1.0]; }
      break;
    }
    case 'face':
      head.face = 'front';
      if (fx.mode === 'smile') head.grin = true;
      if (fx.mode === 'wave') body.handF = [0.18, -1.0 + Math.sin(t * 10) * 0.06];
      if (fx.mode === 'point') body.handF = [0.42, -0.62];
      if (fx.mode === 'salute') body.handF = [0.12, -0.86];
      if (fx.mode === 'thumbs') body.handF = [0.3, -0.6];
      if (fx.mode === 'shush') body.handF = [0.12, -0.7];
      return { body, front: true };
    case 'pose':
      if (fx.mode === 'sleepStand') head.closed = true;
      if (fx.mode === 'armsOut' || fx.mode === 'tpose') body.armsOut = true;
      if (fx.mode === 'measure') { body.handF = [0.3 + Math.sin(t * 2) * 0.12, -0.55]; body.handB = [-0.3 - Math.sin(t * 2) * 0.12, -0.55]; }
      if (fx.mode === 'sniff') body.lean = 0.12;
      if (fx.mode === 'phoneSky') { body.prop = 'phone'; body.propAt = 'up'; }
      if (fx.mode === 'signal') { body.handF = [0.3 * Math.sin(t * 6), -1.05]; body.handB = [-0.3 * Math.sin(t * 6), -1.05]; }
      if (fx.mode === 'hugWall' || fx.mode === 'window') { body.handF = [0.28, -0.75]; body.handB = [0.25, -0.65]; }
      if (fx.mode === 'headWall') body.lean = 0.1;
      break;
  }
  return { body };
}

// Dibuja a una persona del juego (o su cuerpo, si está muerta) en la pantalla, donde corresponde.
export function drawPerson(ctx: CanvasRenderingContext2D, g: Invasion, p: Person, px: number, py: number, s: number, t: number) {
  const pose = poseOf(g, p), H = pose.h * s, a = anomalyOf(p), room = roomOf(g, p);
  // Donde está según la postura (en la cama, en la pared o en el techo).
  const sx = px + (pose.x - p.x) * s, sy = py - (pose.y - p.y) * s;
  const reveal = revealed(p, t) && !p.dead, deadAlien = !!p.dead?.alien && t - p.dead.t > 0.25, isAlien = reveal || deadAlien;
  if (H < 16) { drawTiny(ctx, p, pose, sx, sy, H, isAlien, t); return; }
  const k = p.moving ? t * (pose.kind === 'run' ? 16 : 9) + p.id : t * 2 + p.id;
  const ak = a ? t - p.anomaly!.t0 : 0;
  const fx = a?.fx;
  const opts = fx ? anomalyOpts(fx, t, ak) : { body: {} as BodyOpts, skin: undefined, front: false };
  const { skin } = opts;
  let front = opts.front;
  let body = opts.body;
  if (!fx && !p.dead && !p.moving) {
    const prop = ACTIVITY_PROP[p.act];
    if (prop) body = { ...body, prop: prop[0], propAt: prop[1] };
  }
  if (p.sabotage && !p.dead) {
    // La bomba la lleva con las dos manos (una caja roja grande); el encendedor y el arma, cuando se frena.
    if (p.sabotage.kind === 'box') { if (!p.sabotage.done) body = { ...body, prop: 'bomb', propAt: 'front', handF: [0.3, -0.5], handB: [0.24, -0.47] }; }
    else if (!p.moving) body = { ...body, prop: p.sabotage.kind === 'lighter' ? 'lighter' : 'raygun' };
  }
  // El intercomunicador extraterrestre, a la altura de la cara.
  if (p.comm && !p.dead) body = { ...body, prop: 'communicator', propAt: 'front', handF: [0.27, -0.78], handB: [0.18, -0.6] };
  // Mirando fijo a la mira: de frente, con los ojos clavados en vos.
  const staring = p.alien && !p.dead && t < p.stareUntil;
  if (staring) {
    const dx = g.aim.x - pose.x, dy = g.aim.y - (pose.y + pose.h * 0.85), L = Math.hypot(dx, dy) || 1;
    body = { ...body, head: { ...(body.head ?? {}), face: 'front', gaze: [(dx / L) * pose.dir, -dy / L], eyes: '#4ade80' } };
    front = true;
  }
  if (p.dog && !p.dead) drawDog(ctx, sx + p.dir * H * 0.55, sy, H * 0.45, p.dir, p.moving ? t * 12 : 0, false);
  if (body.handF) body.handF = [body.handF[0] * H, body.handF[1] * H];
  if (body.handB) body.handB = [body.handB[0] * H, body.handB[1] * H];
  const outfit = deadAlien ? ALIEN : reveal ? { ...outfitOf(p, skin), skin: ALIEN.skin, alienHead: true } : outfitOf(p, skin);
  body.vest = !deadAlien && p.job === 'worker';
  body.sx = pose.sx;
  if (isAlien && body.head) body.head = { ...body.head, face: front ? 'front' : undefined };
  const by = sy - pose.lift * s;

  // Sombra en el piso (y en la pared de atrás, para los que están adentro). Hay aliens sin sombra, o con sombra de alien.
  const noShadow = fx?.t === 'look' && fx.mode === 'noshadow';
  if (!noShadow && !pose.upside && !pose.wall && pose.kind !== 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(sx, sy, H * (pose.kind === 'lie' ? 0.5 : 0.24), H * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    if (room && room.lights && pose.kind !== 'lie') {
      ctx.save(); ctx.globalAlpha = 0.08; ctx.translate(sx + H * 0.2, sy - H * 0.02); ctx.scale(1.08, 1.04);
      drawBody(ctx, { ...outfit, skin: '#000', hair: '#000', hatColor: '#000', shirt: ['#000', '#000', '#000'], pants: '#000', shoes: '#000' }, pose.kind, H, pose.dir, k, t, { ...body, prop: undefined, head: { ...(body.head ?? {}), big: fx?.t === 'look' && fx.mode === 'alienshadow' ? 1.9 : body.head?.big, eyes: undefined } });
      ctx.restore();
    }
  }
  if (p.dead) {
    const age = t - p.dead.t;
    ctx.fillStyle = p.dead.alien ? `rgba(74,222,128,${Math.min(0.7, age)})` : `rgba(127,29,29,${Math.min(0.7, age)})`;
    ctx.beginPath(); ctx.ellipse(sx, sy - 1, H * Math.min(0.55, 0.2 + age * 0.15), H * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Aura de colores.
  if (fx?.t === 'look' && fx.mode === 'aura') {
    const gl = ctx.createRadialGradient(sx, by - H * 0.5, H * 0.1, sx, by - H * 0.5, H * 1.1);
    gl.addColorStop(0, `${fx.color}aa`); gl.addColorStop(1, `${fx.color}00`);
    ctx.fillStyle = gl; ctx.fillRect(sx - H * 1.2, by - H * 1.7, H * 2.4, H * 2.4);
  }
  // Copias transparentes que lo siguen.
  if (fx?.t === 'body' && fx.mode === 'ghosts') for (const [dx, al] of [[-0.5, 0.15], [-0.25, 0.3]]) { ctx.save(); ctx.globalAlpha = al; ctx.translate(sx + dx * H * pose.dir, by); drawBody(ctx, outfit, pose.kind, H, pose.dir, k - 0.6, t, body); ctx.restore(); }
  if (fx?.t === 'body' && fx.mode === 'flicker' && Math.sin(t * 37) > 0.3) return;
  const glitch = fx?.t === 'look' && fx.mode === 'glitch';
  if (revealed(p, t) && !p.dead) { // al transformarse, un destello
    const ph = ((t + p.revealPhase) % 30);
    const gl = ctx.createRadialGradient(sx, by - H * 0.5, 0, sx, by - H * 0.5, H * 1.2);
    gl.addColorStop(0, `rgba(190,242,100,${0.45 * (1 - ph)})`); gl.addColorStop(1, 'rgba(190,242,100,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - H * 1.2, by - H * 1.7, H * 2.4, H * 2.4);
  }
  ctx.save();
  ctx.translate(sx, by);
  if (pose.wall) ctx.rotate(pose.wall); // caminando por la pared o el techo (gira sobre los pies)
  if (pose.upside) ctx.scale(1, -1);
  if (pose.rot) { ctx.translate(0, -H * 0.5); ctx.rotate(pose.rot); ctx.translate(0, H * 0.5); }
  if (fx?.t === 'move' && fx.mode === 'jitter' && Math.sin(t * 23) > 0.7) ctx.translate(H * 0.08, 0);
  if (glitch) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(-H * 0.06, 0); drawBody(ctx, { ...outfit, shirt: ['#ef4444', '#ef4444', '#ef4444'], pants: '#ef4444' }, pose.kind, H, pose.dir, k, t, body); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(H * 0.06, 0); drawBody(ctx, { ...outfit, shirt: ['#22d3ee', '#22d3ee', '#22d3ee'], pants: '#22d3ee' }, pose.kind, H, pose.dir, k, t, body); ctx.restore();
  }
  const freeze = fx?.t === 'move' && fx.mode === 'freeze' || fx?.t === 'pose' && (fx.mode === 'statue' || fx.mode === 'tpose');
  const parts = drawBody(ctx, outfit, pose.kind, H, pose.dir, freeze ? 1 : fx?.t === 'move' && fx.mode === 'slide' ? 0 : k, t, body);
  ctx.restore();
  const lying = pose.kind === 'lie' || pose.kind === 'dead';
  const head: Pt = lying ? [sx + pose.dir * H * 0.38, by - H * 0.22] : [sx + parts.head[0], by + parts.head[1] * (pose.upside ? -1 : 1)];
  const hand: Pt = [sx + parts.handF[0], by + parts.handF[1]];
  if (p.dead) return;

  // Lo que hacen los sabotajes: el rayo verde del arma alienígena.
  if (p.sabotage?.kind === 'ray' && !p.moving && t - p.sabotage.t0 > 0.6 && !p.sabotage.done) {
    const tx = hand[0] + p.dir * s * 1.4;
    ctx.strokeStyle = `rgba(74,222,128,${0.6 + Math.sin(t * 40) * 0.3})`; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.shadowColor = '#4ade80'; ctx.shadowBlur = s * 0.3;
    ctx.beginPath(); ctx.moveTo(hand[0] + p.dir * H * 0.15, hand[1]); ctx.lineTo(tx, hand[1] + Math.sin(t * 13) * s * 0.1); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // Hablando por el intercomunicador: ondas verdes que salen de la antena y palabras en su idioma.
  if (p.comm) {
    const ax = hand[0] - p.dir * H * 0.16, ay = hand[1] - H * 0.53;
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = Math.max(1, H * 0.015);
    for (let i = 0; i < 3; i++) { const l = (t * 1.3 + i / 3) % 1; ctx.globalAlpha = 1 - l; ctx.beginPath(); ctx.arc(ax, ay, H * (0.06 + l * 0.35), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (Math.floor((t - p.comm.t0) / 1.4) % 2 === 0) bubble(ctx, head[0], head[1] - parts.r * 1.8, ['⍙⟟⏃ ⋏⏚ ⟒', '⌇⍜⍀ ⏁⟟⏃', '⋔⏃⍀ ⍙⟟⏁'][Math.floor((t - p.comm.t0) / 2.8) % 3], s, '#4ade80');
  }
  if (!fx) { if (p.talk > 0 && p.act === 'flee' && Math.floor(t * 3 + p.id) % 4 === 0) bubble(ctx, head[0], head[1] - parts.r * 1.6, '¡AAAH!', s, '#fef08a'); return; }
  // Lo que pasa alrededor (anomalías del ambiente) y lo que dicen.
  const r = parts.r;
  switch (fx.t) {
    case 'say': bubble(ctx, head[0], head[1] - r * 1.8, fx.lines[Math.floor(ak / 1.6) % fx.lines.length], s, fx.color); break;
    case 'look':
      if (fx.mode === 'steam') for (let i = 0; i < 3; i++) { const l = (t * 1.5 + i / 3) % 1; dot(ctx, `rgba(255,255,255,${0.6 * (1 - l)})`, head[0] - p.dir * r * 0.3, head[1] - l * s * 0.6, r * (0.25 + l * 0.6)); }
      if (fx.mode === 'drool' || fx.mode === 'sweat' || fx.mode === 'nosebleed') for (let i = 0; i < (fx.mode === 'sweat' ? 3 : 2); i++) { const l = (t * 1.2 + i / 2) % 1; dot(ctx, fx.color ?? '#4ade80', head[0] + p.dir * r * (fx.mode === 'sweat' ? (i - 1) * 0.6 : 0.7), head[1] + r * (fx.mode === 'sweat' ? -0.3 : 0.5) + l * s * 0.5, r * 0.12); }
      break;
    case 'face': if (fx.mode === 'shush') bubble(ctx, head[0], head[1] - r * 1.8, 'shhh…', s); if (fx.mode === 'thumbs') { ctx.fillStyle = outfit.skin; ctx.fillRect(hand[0] - r * 0.1, hand[1] - r * 0.6, r * 0.2, r * 0.5); } break;
    case 'pose': if (fx.mode === 'sleepStand') bubble(ctx, head[0] + r, head[1] - r * 1.6, 'Zzz', s); if (fx.mode === 'sniff') bubble(ctx, head[0] + p.dir * r * 2, head[1] - r, 'snif snif', s); break;
    case 'env': drawEnv(ctx, fx.mode, sx, sy, H, s, t, p.dir, hand, head); break;
  }
}

// Visto de muy lejos (el fondo de la mira): solo la silueta con los colores de la ropa.
function drawTiny(ctx: CanvasRenderingContext2D, p: Person, pose: Pose, sx: number, sy: number, H: number, alien: boolean, t: number) {
  const o = alien ? { ...outfitOf(p), skin: ALIEN.skin } : outfitOf(p), lie = pose.kind === 'lie' || pose.kind === 'dead';
  const y = sy - pose.lift * H;
  if (lie) { ctx.fillStyle = o.shirt[1]; ctx.fillRect(sx - H * 0.4, y - H * 0.18, H * 0.8, H * 0.16); dot(ctx, o.skin, sx + pose.dir * H * 0.45, y - H * 0.12, H * 0.12); return; }
  const h = pose.kind === 'sit' || pose.kind === 'squat' ? H * 0.75 : H, w = Math.max(1.5, H * 0.26);
  const swing = p.moving ? Math.sin(t * 9 + p.id) * H * 0.08 : 0;
  ctx.fillStyle = o.pants; ctx.fillRect(sx - w / 2 + swing * 0.3, y - h * 0.35, w * 0.45, h * 0.35); ctx.fillRect(sx - swing * 0.3, y - h * 0.35, w * 0.45, h * 0.35);
  ctx.fillStyle = o.shirt[1]; ctx.fillRect(sx - w / 2, y - h * 0.72, w, h * 0.4);
  dot(ctx, o.skin, sx, y - h * 0.83, H * (alien ? 0.17 : 0.12));
  if (!alien && o.hat !== 'bald') { ctx.fillStyle = o.hat === 'helmet' ? o.hatColor : o.hair; ctx.fillRect(sx - H * 0.12, y - h * 0.97, H * 0.24, H * 0.07); }
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, s: number, color?: string) {
  ctx.font = font(900, s * 0.24);
  const w = ctx.measureText(text).width + s * 0.24, h = s * 0.36;
  ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, h * 0.4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - h * 0.2, y - 1); ctx.lineTo(x, y + h * 0.35); ctx.lineTo(x + h * 0.1, y - 1); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, h * 0.4); ctx.stroke();
  ctx.fillStyle = color ? mixColor(color, '#000000', 0.45) : '#111827'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - h / 2);
}

export function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, f: number, k: number, bark: boolean, color = '#a16207') {
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  const leg = Math.sin(k) * h * 0.12;
  line(ctx, color, h * 0.12, [-h * 0.35, -h * 0.4], [-h * 0.35 + leg, 0]); line(ctx, color, h * 0.12, [h * 0.3, -h * 0.4], [h * 0.3 - leg, 0]);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, h * 0.48, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(h * 0.5, -h * 0.72, h * 0.2, h * 0.17, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(h * 0.68, -h * 0.66, h * 0.12, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = mixColor(color, '#000000', 0.4); ctx.beginPath(); ctx.ellipse(h * 0.42, -h * 0.82, h * 0.07, h * 0.14, -0.4, 0, Math.PI * 2); ctx.fill();
  line(ctx, color, h * 0.08, [-h * 0.45, -h * 0.55], [-h * 0.65, -h * 0.8 + Math.sin(k * 2) * h * 0.08]);
  dot(ctx, '#111', h * 0.55, -h * 0.76, h * 0.03);
  ctx.restore();
  if (bark) { ctx.font = font(900, h * 0.45); ctx.fillStyle = '#fef08a'; ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.textAlign = 'center'; ctx.strokeText('¡GUAU!', x + f * h * 0.6, y - h * 1.2); ctx.fillText('¡GUAU!', x + f * h * 0.6, y - h * 1.2); }
}

function drawEnv(ctx: CanvasRenderingContext2D, mode: string, sx: number, sy: number, H: number, s: number, t: number, dir: number, hand: Pt, head: Pt) {
  switch (mode) {
    case 'dogbark': drawDog(ctx, sx + dir * H * 0.9, sy, H * 0.45, -dir, t * 6, Math.floor(t * 3) % 2 === 0, '#57534e'); break;
    case 'cathiss': {
      const cx = sx + dir * H * 0.8;
      ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.ellipse(cx, sy - H * 0.18, H * 0.2, H * 0.12, 0, Math.PI, 0); ctx.fill();
      dot(ctx, '#1c1917', cx - dir * H * 0.2, sy - H * 0.2, H * 0.08);
      for (const e of [-1, 1]) line(ctx, '#1c1917', H * 0.03, [cx + e * H * 0.15, sy - H * 0.1], [cx + e * H * 0.15, sy]);
      bubble(ctx, cx, sy - H * 0.4, '¡FFFF!', s);
      break;
    }
    case 'birds': for (let i = 0; i < 5; i++) { const l = (t * 0.6 + i * 0.2) % 1, bx = sx + (i - 2) * H * 0.4 + l * H * 2 * (i % 2 ? 1 : -1), by = sy - H * 1.2 - l * H * 2; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1, H * 0.03); ctx.beginPath(); ctx.moveTo(bx - H * 0.08, by); ctx.lineTo(bx, by + Math.sin(t * 20 + i) * H * 0.05); ctx.lineTo(bx + H * 0.08, by); ctx.stroke(); } break;
    case 'plantwilt': { const px = sx + dir * H * 0.7; ctx.fillStyle = '#7c2d12'; ctx.fillRect(px - H * 0.1, sy - H * 0.2, H * 0.2, H * 0.2); for (let i = 0; i < 4; i++) line(ctx, '#78716c', H * 0.04, [px, sy - H * 0.2], [px + (i - 1.5) * H * 0.12, sy - H * 0.1]); break; }
    case 'clocks': drawProp(ctx, 'clock', sx + dir * H * 0.6, sy - H * 1.1, H * 1.4, t * 8); break;
    case 'radio': { const rx = sx + dir * H * 0.7; ctx.fillStyle = '#57534e'; ctx.fillRect(rx - H * 0.15, sy - H * 0.2, H * 0.3, H * 0.2); bubble(ctx, rx, sy - H * 0.3, 'kshhh', s); break; }
    case 'frost': { ctx.strokeStyle = 'rgba(224,242,254,0.85)'; ctx.lineWidth = 1; for (let i = 0; i < 10; i++) { const fx = sx + dir * H * 0.6 + (hash(i) - 0.5) * H, fy = sy - H * (0.8 + hash(i + 3) * 0.8); for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(fx - H * 0.06, fy + (j - 1) * H * 0.04); ctx.lineTo(fx + H * 0.06, fy - (j - 1) * H * 0.04); ctx.stroke(); } } break; }
    case 'levitate': for (let i = 0; i < 3; i++) drawProp(ctx, (['cup', 'book', 'spoons'] as const)[i], sx + (i - 1) * H * 0.5, sy - H * (1.1 + Math.sin(t * 2 + i) * 0.1), H * 0.8, t); break;
    case 'symbols': { ctx.font = font(900, H * 0.3); ctx.fillStyle = `rgba(74,222,128,${0.6 + Math.sin(t * 5) * 0.3})`; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = H * 0.2; ctx.textAlign = 'center'; ctx.fillText('⍙⟟⏃ ⋏⏚', sx + dir * H * 0.9, sy - H * 1.1); ctx.shadowBlur = 0; break; }
    case 'cropcircle': ctx.strokeStyle = 'rgba(74,222,128,0.6)'; ctx.lineWidth = Math.max(1, H * 0.03); for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(sx, sy, H * 0.3 * i, H * 0.05 * i, 0, 0, Math.PI * 2); ctx.stroke(); } break;
    case 'sparks': for (let i = 0; i < 6; i++) { const a = t * 20 + i; dot(ctx, '#a5f3fc', hand[0] + Math.cos(a) * H * 0.12 * hash(i + Math.floor(t * 10)), hand[1] + Math.sin(a) * H * 0.12, Math.max(1, H * 0.02)); } break;
    case 'flies': for (let i = 0; i < 6; i++) dot(ctx, '#111', head[0] + Math.cos(t * (3 + i) + i) * H * 0.35, head[1] + Math.sin(t * (4 + i) + i * 2) * H * 0.25, Math.max(0.8, H * 0.015)); break;
  }
}
