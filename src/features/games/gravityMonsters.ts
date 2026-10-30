// Los monstruos de cada escenario de Gravity Swap (el pez abisal del 1 y los gusanos del 2 están en
// gravityBackdrops y gravityArt). Estilo ciencia ficción / terror, lo más realista posible: caparazones
// brillantes con textura, sombras y reflejos, ojos y venas que brillan (verde radiactivo, rojo), babas que
// gotean. Todos animados: patas que caminan o reman en el aire (cinemática de dos huesos), alas que baten con
// estela, mandíbulas que se abren, tentáculos que se retuercen, rotores que giran, luces que laten.
// Se dibujan mirando a la derecha, centrados en (0, 0) y midiendo más o menos 1,4 casilleros; quien los llama
// los da vuelta e inclina. "angry": ya te vio y te persigue (abre más la boca, se mueve más rápido, brillan más).

export const P = 1 / 32; // un píxel, en casilleros
export const INK = '#0a0a16';
const TAU = Math.PI * 2;
type Pt = [number, number];
type Path = () => void;

function rgbOf(c: string): [number, number, number] {
  if (c.startsWith('#')) { const v = parseInt(c.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  const m = c.match(/[\d.]+/g) ?? ['0', '0', '0']; return [+m[0], +m[1], +m[2]];
}
const mixCache = new Map<string, string>(); // (se piden los mismos colores miles de veces por segundo)
function mix(a: string, b: string, k: number) {
  const key = `${a}|${b}|${k}`, hit = mixCache.get(key); if (hit) return hit;
  const pa = rgbOf(a), pb = rgbOf(b);
  const out = `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
  if (mixCache.size > 4000) mixCache.clear();
  mixCache.set(key, out); return out;
}
export const lighten = (c: string, k: number) => mix(c, '#ffffff', k);
export const darken = (c: string, k: number) => mix(c, '#000000', k);
export const alpha = (c: string, a: number) => `rgba(${rgbOf(c).join(',')},${a})`;
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- Herramientas de dibujo
export function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}
export function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(color, 0.5)); g.addColorStop(0.45, color); g.addColorStop(1, darken(color, 0.6));
  return g;
}
export function ink(ctx: CanvasRenderingContext2D, path: () => void, fill: string | CanvasGradient, width = 2) {
  ctx.beginPath(); path();
  ctx.lineWidth = width * P; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}
export function limb(ctx: CanvasRenderingContext2D, pts: Pt[], color: string | CanvasGradient, width: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[INK, width + 2.2 * P], [color, width]] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
}
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
// Luz que se suma (como algo que emite luz de verdad).
export function bloom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.6) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, r, color, a); ctx.restore();
}
// Un rayo eléctrico quebrado entre dos puntos (cambia en cada cuadro).
export function zap(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color = '#7dd3fc') {
  const pts: Pt[] = [a];
  for (let i = 1; i < 6; i++) { const k = i / 6; pts.push([a[0] + (b[0] - a[0]) * k + (Math.random() - 0.5) * 0.12, a[1] + (b[1] - a[1]) * k + (Math.random() - 0.5) * 0.12]); }
  pts.push(b);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[color, 2.2 * P], ['#ffffff', 0.8 * P]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
}

// Textura de grano (poros, rayones, manchas) que se pinta encima de cada parte para que no se vea plana.
let grainTile: HTMLCanvasElement | null | undefined;
const grainPatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>();
function grainPattern(ctx: CanvasRenderingContext2D) {
  if (grainTile === undefined) {
    grainTile = null;
    if (typeof document !== 'undefined') {
      const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d');
      if (g) {
        const img = g.createImageData(N, N), G = 8, grid = Array.from({ length: G * G }, () => Math.random());
        const at = (i: number, j: number) => grid[((j % G + G) % G) * G + ((i % G + G) % G)];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const fx = x / N * G, fy = y / N * G, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
          const low = (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
          const n = Math.round(255 * Math.min(1, Math.max(0, 0.15 + low * 0.55 + Math.random() * 0.45)));
          const o = (y * N + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = n; img.data[o + 3] = 255;
        }
        g.putImageData(img, 0, 0); grainTile = c;
      }
    }
  }
  if (!grainTile) return null;
  if (!grainPatterns.has(ctx)) grainPatterns.set(ctx, ctx.createPattern(grainTile, 'repeat'));
  return grainPatterns.get(ctx) ?? null;
}
// Sin textura (celulares: el recorte + la mezcla "overlay" por cada parte del cuerpo es caro).
let noGrain = false;
export function setNoGrain(on: boolean) { noGrain = on; }
export function grain(ctx: CanvasRenderingContext2D, path: Path, amount: number, size = 1) {
  if (noGrain) return;
  const pat = grainPattern(ctx);
  if (!pat || amount <= 0) return;
  if (typeof DOMMatrix !== 'undefined' && pat.setTransform) pat.setTransform(new DOMMatrix([P * 0.55 * size, 0, 0, P * 0.55 * size, 0, 0]));
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amount; ctx.fillStyle = pat; ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}
export interface Shade { x?: number; y?: number; r: number; hi?: number; lo?: number; line?: string; lw?: number; tex?: number; texSize?: number }
// Una parte del cuerpo con volumen: degradé radial (luz de arriba a la izquierda), textura y borde fino oscuro.
export function shade(ctx: CanvasRenderingContext2D, path: Path, base: string, o: Shade) {
  const x = o.x ?? 0, y = o.y ?? 0;
  const g = ctx.createRadialGradient(x, y, 0, x, y, o.r);
  g.addColorStop(0, lighten(base, o.hi ?? 0.35)); g.addColorStop(0.45, base); g.addColorStop(1, darken(base, o.lo ?? 0.7));
  ctx.beginPath(); path(); ctx.fillStyle = g; ctx.fill();
  grain(ctx, path, o.tex ?? 0.5, o.texSize);
  if ((o.lw ?? 1) > 0) { ctx.beginPath(); path(); ctx.lineWidth = (o.lw ?? 1) * P; ctx.strokeStyle = o.line ?? darken(base, 0.8); ctx.lineJoin = 'round'; ctx.stroke(); }
}
// Reflejo brillante (caparazón mojado, metal pulido).
export function spec(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0, a = 0.6) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
}
// Rodilla de dos huesos: dónde queda la articulación para que la punta llegue a "foot" (bend: para qué lado dobla).
function ik(hip: Pt, foot: Pt, l1: number, l2: number, bend: number): Pt {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4) || 1e-4;
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx) + bend * a;
  return [hip[0] + Math.cos(base) * l1, hip[1] + Math.sin(base) * l1];
}
// Un tramo de pata o brazo que se afina (de ancho wa a wb), con brillo a lo largo y borde oscuro.
export function segment(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, wa: number, wb: number, color: string, gloss = 0.5) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-4, nx = -dy / l, ny = dx / l;
  const path = () => {
    ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
    ctx.arc(b[0], b[1], wb / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
    ctx.arc(a[0], a[1], wa / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  };
  const up = ny < 0 ? 1 : -1, w = Math.max(wa, wb) / 2; // el lado que mira para arriba recibe la luz
  ctx.beginPath(); path();
  ctx.fillStyle = lin(ctx, a[0] + nx * w * up, a[1] + ny * w * up, a[0] - nx * w * up, a[1] - ny * w * up, [[0, lighten(color, 0.3)], [0.35, color], [1, darken(color, 0.75)]]);
  ctx.fill();
  grain(ctx, path, 0.25);
  ctx.beginPath(); path(); ctx.lineWidth = 0.8 * P; ctx.strokeStyle = darken(color, 0.8); ctx.stroke();
  if (gloss > 0) { // raya de brillo
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * gloss})`; ctx.lineWidth = Math.max(0.6 * P, Math.min(wa, wb) * 0.18); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0] + nx * wa * 0.22 * up + dx * 0.15, a[1] + ny * wa * 0.22 * up + dy * 0.15); ctx.lineTo(b[0] + nx * wb * 0.22 * up - dx * 0.15, b[1] + ny * wb * 0.22 * up - dy * 0.15); ctx.stroke();
  }
}
// Pata de bicho: tramos que se afinan, con pinchos (spines) y una uña en la punta.
function bugLeg(ctx: CanvasRenderingContext2D, pts: Pt[], widths: number[], color: string, spine: string | null, gloss = 0.6) {
  for (let i = 0; i < pts.length - 1; i++) segment(ctx, pts[i], pts[i + 1], widths[i], widths[i + 1], color, gloss);
  if (spine) for (let i = 1; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const side = ny < 0 ? 1 : -1;
    for (const k of [0.25, 0.5, 0.75]) {
      const x = a[0] + dx * k, y = a[1] + dy * k, w = widths[i] * (1 - k * 0.4), len = w * 1.3;
      ctx.beginPath(); ctx.moveTo(x - dx / l * w * 0.25, y - dy / l * w * 0.25);
      ctx.lineTo(x + nx * side * len + dx / l * len * 0.7, y + ny * side * len + dy / l * len * 0.7); ctx.lineTo(x + dx / l * w * 0.3, y + dy / l * w * 0.3); ctx.closePath();
      ctx.fillStyle = spine; ctx.fill();
    }
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = widths[widths.length - 1];
  ctx.beginPath(); ctx.moveTo(b[0] - dy / l * w * 0.5, b[1] + dx / l * w * 0.5);
  ctx.quadraticCurveTo(b[0] + dx / l * w * 3, b[1] + dy / l * w * 3, b[0] + dx / l * w * 2.2 + dy / l * w * 1.4, b[1] + dy / l * w * 2.2 - dx / l * w * 1.4);
  ctx.lineTo(b[0] + dy / l * w * 0.5, b[1] - dx / l * w * 0.5); ctx.closePath(); ctx.fillStyle = '#1a1410'; ctx.fill(); // uña
}
// Ojo que brilla: núcleo blanco, iris del color y resplandor (sin brillitos de dibujo animado).
export function eyeGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, power: number, slit = false) {
  bloom(ctx, x, y, r * 4, color, 0.35 * power);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, lighten(color, 0.85)); g.addColorStop(0.45, color); g.addColorStop(1, darken(color, 0.55));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (slit) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.beginPath(); ctx.ellipse(x + r * 0.15, y, r * 0.18, r * 0.8, 0, 0, TAU); ctx.fill(); }
}
// Colmillos en fila de (x0, y) a (x1, y), para abajo (dir 1) o para arriba (dir -1): largos distintos, curvos.
export function teeth(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, n: number, len: number, dir: number, seed = 0, color = '#e8dcb5') {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n, l = len * (0.45 + 0.55 * hash(i * 3.1 + seed)), w = Math.abs(x1 - x0) / n * 0.42, bend = (x1 - x0 > 0 ? 1 : -1) * w * 0.6;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.3 + bend, y + dir * l * 0.7, x + bend, y + dir * l); ctx.quadraticCurveTo(x + w * 0.2 + bend * 0.5, y + dir * l * 0.5, x + w, y); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, y, 0, y + dir * l, [[0, darken(color, 0.35)], [0.4, color], [1, lighten(color, 0.4)]]); ctx.fill();
    ctx.lineWidth = 0.5 * P; ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.stroke();
  }
}
// Baba que cuelga, se estira y suelta una gota (la radiactiva brilla).
export function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, t: number, seed: number, glowing = false) {
  const k = (t * 0.55 + hash(seed) ) % 1, l = len * (0.3 + k * 0.7), sway = Math.sin(t * 2.3 + seed) * len * 0.12;
  ctx.strokeStyle = alpha(color, 0.75); ctx.lineCap = 'round'; ctx.lineWidth = 0.9 * P;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway, y + l * 0.55, x + sway * 0.5, y + l); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x + sway * 0.5, y + l, 1.2 * P, 1.7 * P, 0, 0, TAU); ctx.fill();
  if (k > 0.8) { ctx.beginPath(); ctx.ellipse(x + sway * 0.5, y + l + (k - 0.8) * len * 3, 0.9 * P, 1.3 * P, 0, 0, TAU); ctx.fill(); }
  if (glowing) bloom(ctx, x + sway * 0.5, y + l, 0.04, color, 0.3);
}
// Ala de insecto traslúcida con nervaduras (y manchas): sale de (0,0) hacia atrás.
function membrane(ctx: CanvasRenderingContext2D, len: number, wid: number, tint: string, vein: string, spots: string | null, a: number) {
  const path = () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(-len * 0.25, -wid, -len * 0.8, -wid * 1.05, -len, -wid * 0.2); ctx.bezierCurveTo(-len * 0.85, wid * 0.55, -len * 0.3, wid * 0.5, 0, 0); };
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath(); path(); ctx.fillStyle = lin(ctx, 0, 0, -len, 0, [[0, alpha(tint, 0.75)], [1, alpha(tint, 0.45)]]); ctx.fill();
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.strokeStyle = vein; ctx.lineWidth = 0.7 * P;
  for (let k = 0; k < 7; k++) { const e = -wid * 0.95 + k * wid * 0.25; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-len * 0.45, e * 0.9, -len * 1.02, e * 0.75 + wid * 0.1); ctx.stroke(); }
  for (let k = 1; k < 9; k++) { const x = -len * k / 9; ctx.beginPath(); ctx.moveTo(x, -wid); ctx.lineTo(x + len * 0.03, wid * 0.6); ctx.stroke(); }
  if (spots) for (const [sx, sy, sr] of [[-0.62, -0.25, 0.08], [-0.82, -0.05, 0.05], [-0.4, 0.05, 0.04]] as const) { ctx.fillStyle = spots; ctx.beginPath(); ctx.ellipse(len * sx, wid * sy * 2, len * sr, len * sr * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = lin(ctx, 0, -wid, -len, wid, [[0, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.18)']]); ctx.fillRect(-len, -wid * 1.2, len, wid * 2.4);
  ctx.restore();
  ctx.beginPath(); path(); ctx.strokeStyle = darken(vein, 0.4); ctx.lineWidth = 1 * P; ctx.stroke();
  ctx.restore();
}
// Algo que bate muy rápido (alas, aspas): se dibuja la posición actual y unas copias tenues de los cuadros
// anteriores, como la estela que deja el movimiento.
export function blur(ctx: CanvasRenderingContext2D, t: number, steps: number, dt: number, draw: (t: number, a: number) => void) {
  for (let k = steps - 1; k >= 0; k--) draw(t - k * dt, k === 0 ? 1 : 0.28 * (1 - k / steps));
}

// ---------------------------------------------------------------- 3: Robot asesino
// Un androide de combate que flota y "nada" igual que el astronauta (brazos que reman, piernas que patalean),
// pero de metal negro y pistones: cráneo alargado con una ranura de visor y dos ojos rojos, cables al aire en la
// cintura, núcleo rojo que late en el pecho, mochila con propulsores de fuego azul y garras con electricidad.
export function drawRobot(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const sw = t * (angry ? 7 : 4.5), drift = Math.sin(t * 2.2), RED = '#ff2a2a', METAL = '#343944', DARK = '#16181e';
  ctx.save(); ctx.scale(1.25, 1.25); ctx.rotate(drift * 0.06 + (angry ? 0.12 : 0));
  // mochila y propulsores
  const flame = (x: number) => {
    const L = 0.16 + Math.random() * 0.08 + (angry ? 0.08 : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lin(ctx, 0, 0.06, 0, 0.06 + L, [[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(96,165,250,0.85)'], [1, 'rgba(30,64,175,0)']]);
    ctx.beginPath(); ctx.moveTo(x - 0.035, 0.06); ctx.quadraticCurveTo(x, 0.06 + L * 1.3, x + 0.035, 0.06); ctx.fill(); ctx.restore();
    bloom(ctx, x, 0.1, 0.1, '#60a5fa', 0.5);
  };
  flame(-0.36); flame(-0.25);
  const pack = () => ctx.roundRect(-0.43, -0.38, 0.22, 0.42, 0.04);
  shade(ctx, pack, '#22252d', { x: -0.38, y: -0.32, r: 0.45, tex: 0.3 });
  for (const x of [-0.36, -0.25]) shade(ctx, () => ctx.roundRect(x - 0.035, 0.0, 0.07, 0.07, 0.015), '#5b6270', { x, y: 0.02, r: 0.08 });
  ctx.fillStyle = '#0d0f13'; for (let k = 0; k < 4; k++) ctx.fillRect(-0.4, -0.3 + k * 0.06, 0.15, 1.6 * P); // rejilla
  ctx.fillStyle = Math.sin(t * 9) > 0 ? RED : '#5a0a0a'; ctx.fillRect(-0.4, -0.05, 0.03, 0.03);
  // brazo y pierna de atrás (más oscuros)
  const limbs = (side: number) => {
    const ph = sw + (side < 0 ? Math.PI : 0), col = side < 0 ? '#1f2229' : METAL;
    const hip: Pt = [-0.06 + side * 0.03, 0.12], sh: Pt = [0.0 + side * 0.03, -0.27];
    const ta = Math.PI / 2 + 0.25 + 0.4 * Math.sin(ph), knee: Pt = [hip[0] + Math.cos(ta) * 0.25, hip[1] + Math.sin(ta) * 0.25];
    const sa = ta + 0.2 + 0.35 * Math.max(0, Math.cos(ph)), foot: Pt = [knee[0] + Math.cos(sa) * 0.25, knee[1] + Math.sin(sa) * 0.25];
    const ua = 0.5 + 0.7 * Math.sin(ph + Math.PI) - (angry ? 0.4 : 0), elbow: Pt = [sh[0] + Math.cos(ua) * 0.22, sh[1] + Math.sin(ua) * 0.22];
    const fa = ua - 0.7 - 0.3 * Math.sin(ph), hand: Pt = [elbow[0] + Math.cos(fa) * 0.21, elbow[1] + Math.sin(fa) * 0.21];
    // pierna: muslo, rodilla, canilla con pistón, pie
    segment(ctx, hip, knee, 0.12, 0.09, col, 0.5);
    segment(ctx, knee, foot, 0.09, 0.07, col, 0.5);
    ctx.strokeStyle = '#c0c6d0'; ctx.lineWidth = 1.2 * P; ctx.beginPath(); ctx.moveTo(knee[0] + 0.02, knee[1] + 0.03); ctx.lineTo(foot[0] + 0.02, foot[1] - 0.05); ctx.stroke();
    ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(sa - Math.PI / 2);
    shade(ctx, () => { ctx.moveTo(-0.05, -0.02); ctx.lineTo(0.1, -0.01); ctx.lineTo(0.12, 0.04); ctx.lineTo(-0.06, 0.04); ctx.closePath(); }, DARK, { x: 0, y: -0.02, r: 0.14 });
    ctx.restore();
    for (const j of [hip, knee]) { shade(ctx, () => ctx.arc(j[0], j[1], 0.05, 0, TAU), DARK, { x: j[0] - 0.02, y: j[1] - 0.02, r: 0.06 }); ctx.strokeStyle = alpha(RED, 0.8); ctx.lineWidth = P; ctx.beginPath(); ctx.arc(j[0], j[1], 0.028, 0, TAU); ctx.stroke(); }
    // brazo: hombrera, antebrazo y garra de tres dedos que se abre y se cierra
    segment(ctx, sh, elbow, 0.1, 0.08, col, 0.5);
    segment(ctx, elbow, hand, 0.085, 0.07, col, 0.5);
    const grip = angry ? 0.5 + 0.4 * Math.sin(t * 9 + side) : 0.35;
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(fa);
    for (const k of [-1, 0, 1]) { const a = k * grip * 0.6; segment(ctx, [0, 0], [Math.cos(a) * 0.07, Math.sin(a) * 0.07], 0.03, 0.02, DARK, 0.6); segment(ctx, [Math.cos(a) * 0.07, Math.sin(a) * 0.07], [Math.cos(a) * 0.07 + Math.cos(a - k * 0.8) * 0.05, Math.sin(a) * 0.07 + Math.sin(a - k * 0.8) * 0.05], 0.02, 0.012, '#8a919e', 0.6); }
    ctx.restore();
    for (const j of [sh, elbow]) shade(ctx, () => ctx.arc(j[0], j[1], j === sh ? 0.07 : 0.045, 0, TAU), j === sh ? METAL : DARK, { x: j[0] - 0.02, y: j[1] - 0.03, r: 0.08 });
    return hand;
  };
  const handBack = limbs(-1);
  // torso: cintura de cables y anillos, pelvis, pecho blindado con el núcleo rojo
  ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2 * P; ctx.beginPath(); ctx.moveTo(-0.1, -0.08); ctx.bezierCurveTo(-0.16, 0.0, -0.06, 0.04, -0.11, 0.1); ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(0.06, -0.08); ctx.bezierCurveTo(0.12, -0.02, 0.02, 0.05, 0.07, 0.1); ctx.stroke();
  for (let k = 0; k < 4; k++) shade(ctx, () => ctx.roundRect(-0.09 + k * 0.004, -0.08 + k * 0.042, 0.15, 0.03, 0.012), '#5d6472', { x: -0.05, y: -0.08 + k * 0.042, r: 0.15, tex: 0.3 });
  shade(ctx, () => { ctx.moveTo(-0.13, 0.08); ctx.lineTo(0.08, 0.08); ctx.lineTo(0.05, 0.17); ctx.lineTo(-0.1, 0.17); ctx.closePath(); }, DARK, { x: -0.05, y: 0.08, r: 0.2 });
  const chest = () => { ctx.moveTo(-0.18, -0.38); ctx.quadraticCurveTo(0.0, -0.44, 0.15, -0.37); ctx.lineTo(0.12, -0.15); ctx.quadraticCurveTo(0.0, -0.06, -0.14, -0.1); ctx.closePath(); };
  shade(ctx, chest, METAL, { x: 0.02, y: -0.36, r: 0.36, hi: 0.45, tex: 0.3 });
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(-0.03, -0.41); ctx.lineTo(-0.03, -0.1); ctx.moveTo(-0.16, -0.24); ctx.quadraticCurveTo(0, -0.21, 0.13, -0.26); ctx.stroke(); // juntas del blindaje
  spec(ctx, 0.03, -0.35, 0.1, 0.025, -0.1, 0.5);
  const beat = 0.6 + 0.4 * Math.sin(t * (angry ? 10 : 5));
  ctx.fillStyle = '#140405'; ctx.beginPath(); ctx.arc(0.04, -0.25, 0.05, 0, TAU); ctx.fill();
  eyeGlow(ctx, 0.04, -0.25, 0.034, RED, beat * 1.4);
  // cuello de cables y cabeza: cráneo alargado, visor con dos ojos rojos, mandíbula de rejilla, antena
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4 * P; for (const dx of [-0.02, 0.02]) { ctx.beginPath(); ctx.moveTo(dx, -0.4); ctx.lineTo(dx + 0.03, -0.47); ctx.stroke(); }
  ctx.save(); ctx.translate(0.05, -0.56); ctx.rotate(Math.sin(t * 1.7) * 0.06 + (angry ? 0.1 : 0));
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.2 * P; ctx.beginPath(); ctx.moveTo(-0.08, -0.06); ctx.lineTo(-0.14, -0.17); ctx.stroke();
  if (Math.sin(t * 6) > 0) eyeGlow(ctx, -0.14, -0.17, 0.014, RED, 1);
  const skull = () => { ctx.moveTo(-0.13, 0.02); ctx.bezierCurveTo(-0.16, -0.12, -0.04, -0.17, 0.06, -0.12); ctx.bezierCurveTo(0.13, -0.08, 0.15, 0.0, 0.14, 0.05); ctx.lineTo(0.1, 0.1); ctx.lineTo(-0.02, 0.1); ctx.quadraticCurveTo(-0.1, 0.09, -0.13, 0.02); ctx.closePath(); };
  shade(ctx, skull, '#2e333d', { x: -0.02, y: -0.1, r: 0.22, hi: 0.5, tex: 0.3 });
  spec(ctx, -0.03, -0.11, 0.07, 0.02, -0.25, 0.6);
  // visor
  ctx.fillStyle = '#07080b'; ctx.beginPath(); ctx.moveTo(-0.01, -0.04); ctx.lineTo(0.15, -0.06); ctx.lineTo(0.15, -0.0); ctx.lineTo(0.0, 0.01); ctx.closePath(); ctx.fill();
  const eyeP = (angry ? 1.6 : 1) * (0.8 + 0.2 * Math.sin(t * 13));
  eyeGlow(ctx, 0.05, -0.025, 0.018, RED, eyeP); eyeGlow(ctx, 0.12, -0.035, 0.016, RED, eyeP);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha(RED, 0.5); ctx.fillRect(0.02, -0.032, 0.12, 1.2 * P); ctx.restore();
  // mandíbula de rejilla
  ctx.fillStyle = '#111318'; ctx.beginPath(); ctx.roundRect(0.03, 0.03, 0.11, 0.06, 0.015); ctx.fill();
  ctx.strokeStyle = '#5b6270'; ctx.lineWidth = 0.8 * P; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0.045 + k * 0.025, 0.035); ctx.lineTo(0.045 + k * 0.025, 0.085); ctx.stroke(); }
  ctx.restore();
  const handFront = limbs(1);
  // electricidad: chispas entre las garras y sobre el cuerpo
  if (angry || Math.sin(t * 3.1) > 0.6) {
    zap(ctx, handFront, [handFront[0] + 0.12, handFront[1] - 0.05], '#93c5fd');
    if (Math.random() < 0.5) zap(ctx, handBack, handFront, '#93c5fd');
    if (Math.random() < 0.4) zap(ctx, [-0.12, -0.35], [0.1, -0.2], '#bfdbfe');
    bloom(ctx, handFront[0], handFront[1], 0.18, '#60a5fa', 0.5);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 4: Cucaracha voladora
// Una cucaracha gigante de verdad: caparazón marrón rojizo brillante y húmedo, escudo (pronoto) con el borde
// ámbar traslúcido y manchas oscuras, élitros de cuero levantados y alas traslúcidas que baten con estela,
// seis patas espinosas que reman en el aire, antenas larguísimas que latiguean, mandíbulas y palpos.
export function drawRoach(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const BROWN = '#6b2f12', DARKB = '#2a1107', AMBER = '#c9802e', rate = angry ? 26 : 19;
  ctx.save(); ctx.scale(1.05, 1.05); ctx.rotate(-0.08);
  const legs = (far: boolean) => {
    const hips: Pt[] = [[0.24, 0.07], [0.08, 0.09], [-0.08, 0.09]];
    hips.forEach((hip, i) => {
      const ph = t * (angry ? 11 : 7) + i * 2.1 + (far ? Math.PI : 0), dirx = [0.32, 0.05, -0.32][i];
      const foot: Pt = [hip[0] + dirx + 0.1 * Math.cos(ph), hip[1] + 0.34 + 0.06 * Math.sin(ph) - (far ? 0.03 : 0)];
      const knee = ik(hip, foot, 0.2, 0.26, i === 2 ? 1 : -1);
      const tars: Pt = [foot[0] + (dirx > 0 ? 0.08 : -0.08), foot[1] + 0.04];
      ctx.save(); if (far) { ctx.translate(0.03, -0.04); ctx.globalAlpha = 0.85; }
      bugLeg(ctx, [hip, [knee[0], knee[1] - 0.04], foot, tars], [0.08, 0.06, 0.035, 0.018], far ? '#3d1a0a' : '#6a3013', far ? '#24100a' : '#3a1a0a', 0.7);
      ctx.restore();
    });
  };
  legs(true);
  // alas traslúcidas de atrás: baten rápido (con estela)
  blur(ctx, t, 4, 0.008, (tt, a) => {
    const flap = Math.sin(tt * rate);
    ctx.save(); ctx.translate(0.12, -0.1); ctx.rotate(-0.55 - flap * 0.75); ctx.scale(1, 0.55 + 0.45 * Math.abs(flap));
    membrane(ctx, 0.78, 0.2, '#c8b49a', 'rgba(90,50,20,0.6)', null, a * 0.8);
    ctx.restore();
  });
  // abdomen: anillos brillantes
  const abd = () => ctx.ellipse(-0.22, 0.03, 0.46, 0.15, -0.04, 0, TAU);
  shade(ctx, abd, BROWN, { x: -0.25, y: -0.08, r: 0.5, hi: 0.3, tex: 0.55 });
  ctx.save(); ctx.beginPath(); abd(); ctx.clip();
  for (let k = 0; k < 8; k++) { const x = 0.15 - k * 0.09; ctx.strokeStyle = 'rgba(20,6,2,0.6)'; ctx.lineWidth = 1.1 * P; ctx.beginPath(); ctx.moveTo(x, -0.2); ctx.quadraticCurveTo(x - 0.04, 0.03, x, 0.22); ctx.stroke(); ctx.strokeStyle = 'rgba(255,200,150,0.18)'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(x - 0.012, -0.2); ctx.quadraticCurveTo(x - 0.05, 0.03, x - 0.012, 0.22); ctx.stroke(); }
  ctx.restore();
  // cercos de la cola
  for (const dy of [-0.03, 0.03]) segment(ctx, [-0.64, 0.03], [-0.76, 0.0 + dy * 2], 0.025, 0.01, '#4a1f0c', 0.5);
  // élitros (alas de cuero) levantados, se mueven al ritmo del aleteo
  blur(ctx, t, 3, 0.01, (tt, a) => {
    const flap = Math.sin(tt * rate);
    for (const back of [true, false]) {
      ctx.save(); ctx.globalAlpha = a * (back ? 0.85 : 1); ctx.translate(0.16, -0.09); ctx.rotate(-0.28 - flap * 0.32 - (back ? 0.12 : 0));
      const el = () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(-0.12, -0.12, -0.55, -0.12, -0.72, 0.0); ctx.bezierCurveTo(-0.55, 0.07, -0.15, 0.08, 0, 0.02); ctx.closePath(); };
      shade(ctx, el, back ? '#4a1d0a' : '#8a4318', { x: -0.2, y: -0.08, r: 0.6, hi: 0.25, tex: 0.5 });
      ctx.save(); ctx.beginPath(); el(); ctx.clip(); ctx.strokeStyle = 'rgba(40,14,4,0.45)'; ctx.lineWidth = 0.6 * P;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-0.02, -0.01 + k * 0.006); ctx.quadraticCurveTo(-0.35, -0.08 + k * 0.022, -0.72, -0.02 + k * 0.012); ctx.stroke(); }
      ctx.restore(); spec(ctx, -0.3, -0.06, 0.18, 0.02, -0.05, 0.45 * a);
      ctx.restore();
    }
  });
  // cabeza (abajo del escudo): ojos, mandíbulas y palpos
  const chew = Math.sin(t * (angry ? 14 : 6)) * 0.25;
  ctx.save(); ctx.translate(0.48, 0.07); ctx.rotate(0.5);
  shade(ctx, () => ctx.ellipse(0, 0, 0.08, 0.1, 0, 0, TAU), '#5a250d', { x: -0.02, y: -0.04, r: 0.12 });
  ctx.fillStyle = '#0b0503'; ctx.beginPath(); ctx.ellipse(0.0, -0.04, 0.035, 0.05, 0.3, 0, TAU); ctx.fill(); spec(ctx, -0.01, -0.06, 0.012, 0.02, 0, 0.6);
  for (const s of [-1, 1]) { ctx.save(); ctx.translate(0.02 * s, 0.09); ctx.rotate(s * (0.3 + chew)); segment(ctx, [0, 0], [0.0, 0.06], 0.03, 0.012, '#2a1006', 0.4); ctx.restore(); }
  for (const s of [-1, 1]) segment(ctx, [0.03, 0.06], [0.08 + s * 0.02, 0.12 + Math.sin(t * 7 + s) * 0.02], 0.016, 0.01, '#6b2f12', 0.3);
  ctx.restore();
  // escudo
  const shield = () => ctx.ellipse(0.32, -0.01, 0.19, 0.13, 0.12, 0, TAU);
  shade(ctx, shield, AMBER, { x: 0.28, y: -0.08, r: 0.22, hi: 0.35, tex: 0.4 });
  shade(ctx, () => ctx.ellipse(0.3, -0.03, 0.14, 0.085, 0.12, 0, TAU), DARKB, { x: 0.27, y: -0.07, r: 0.16, lw: 0, tex: 0.5 });
  spec(ctx, 0.28, -0.1, 0.09, 0.025, 0.1, 0.65);
  legs(false);
  // antenas largas que latiguean
  for (const s of [0, 1]) {
    const base: Pt = [0.52, 0.0], len = 0.95, wav = t * (angry ? 6 : 3.5) + s * 1.7;
    ctx.strokeStyle = s ? '#3a1708' : '#5a260c'; ctx.lineWidth = 1.3 * P; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(base[0], base[1]);
    let x = base[0], y = base[1];
    for (let k = 1; k <= 14; k++) { const a = -0.55 - s * 0.35 + Math.sin(wav - k * 0.35) * 0.35 * (k / 14); x += Math.cos(a) * len / 14; y += Math.sin(a) * len / 14; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 5: Araña radiactiva
// Ocho patas peludas y espinosas que caminan en el aire (de a cuatro, alternadas), caparazón negro verdoso con
// grietas que brillan, abdomen enorme con el símbolo radiactivo encendido y venas fosforescentes, racimo de
// ojos verdes, quelíceros con colmillos que chorrean veneno verde.
export function drawSpider(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const TOX = '#b6f23a', SHELL = '#2f3a12', LEG = '#4a5418', pulse = 0.65 + 0.35 * Math.sin(t * (angry ? 8 : 3));
  ctx.save(); ctx.scale(1.1, 1.1);
  const legs = (far: boolean) => {
    for (let i = 0; i < 4; i++) {
      const hip: Pt = [0.16 - i * 0.05, 0.02 - (far ? 0.03 : 0)];
      const ph = t * (angry ? 9 : 5.5) + (i % 2 ? Math.PI : 0) + (far ? Math.PI : 0);
      const reach = [0.62, 0.36, -0.16, -0.5][i], foot: Pt = [hip[0] + reach + 0.07 * Math.cos(ph), 0.5 + 0.07 * Math.min(0, Math.sin(ph)) - (far ? 0.06 : 0)];
      const knee: Pt = [hip[0] + reach * 0.6 + 0.04 * Math.cos(ph), -0.3 + Math.abs(reach) * 0.1 + 0.05 * Math.min(0, Math.sin(ph)) - (far ? 0.03 : 0)]; // rodilla bien arriba, como las arañas
      const mid: Pt = [knee[0] + (foot[0] - knee[0]) * 0.55, knee[1] + (foot[1] - knee[1]) * 0.55 - 0.02];
      ctx.save(); if (far) ctx.globalAlpha = 0.8;
      bugLeg(ctx, [hip, knee, mid, foot], [0.075, 0.06, 0.042, 0.022], far ? '#232a0c' : LEG, null, 0.7);
      for (let h = 0; h < 6; h++) { const k = (h + 0.5) / 6, x = knee[0] + (foot[0] - knee[0]) * k, y = knee[1] + (foot[1] - knee[1]) * k; ctx.strokeStyle = far ? '#151a06' : '#26300a'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.035, y - 0.025); ctx.stroke(); } // pelos
      bloom(ctx, knee[0], knee[1], 0.05, TOX, 0.35 * pulse);
      ctx.restore();
    }
  };
  legs(true);
  // abdomen: caparazón con pelos, el símbolo radiactivo y venas que brillan
  const breathe = 1 + Math.sin(t * 3) * 0.02;
  ctx.save(); ctx.translate(-0.3, -0.06); ctx.scale(breathe, breathe);
  const abd = () => ctx.ellipse(0, 0, 0.38, 0.31, -0.15, 0, TAU);
  for (let k = 0; k < 40; k++) { const a = k / 40 * TAU, r = 1 + hash(k) * 0.12; ctx.strokeStyle = '#1a2006'; ctx.lineWidth = 0.8 * P; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.37, Math.sin(a) * 0.3); ctx.lineTo(Math.cos(a + 0.05) * 0.41 * r, Math.sin(a + 0.05) * 0.34 * r); ctx.stroke(); }
  shade(ctx, abd, SHELL, { x: -0.1, y: -0.18, r: 0.45, hi: 0.4, tex: 0.65 });
  ctx.save(); ctx.beginPath(); abd(); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = alpha(TOX, 0.35 * pulse); ctx.lineWidth = 0.9 * P;
  for (let k = 0; k < 10; k++) { // venas que salen del símbolo
    let a = k / 10 * TAU + hash(k) * 0.4, x = Math.cos(a) * 0.17, y = -0.04 + Math.sin(a) * 0.14;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { a += (hash(k * 7 + j) - 0.5) * 0.9; x += Math.cos(a) * 0.05; y += Math.sin(a) * 0.045; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // símbolo radiactivo (amarillo verdoso que se enciende) con borde
  ctx.save(); ctx.translate(0.0, -0.04); ctx.rotate(-0.15); ctx.scale(1, 0.85);
  ctx.fillStyle = lin(ctx, 0, -0.18, 0, 0.18, [[0, lighten(TOX, 0.3)], [1, '#7a9a10']]); ctx.beginPath(); ctx.arc(0, 0, 0.18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#10140a';
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.52) * 0.04, Math.sin(a - 0.52) * 0.04); ctx.arc(0, 0, 0.15, a - 0.52, a + 0.52); ctx.arc(0, 0, 0.045, a + 0.52, a - 0.52, true); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, 0.03, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  bloom(ctx, 0, -0.04, 0.35, TOX, 0.35 * pulse);
  spec(ctx, -0.12, -0.2, 0.14, 0.04, -0.4, 0.5);
  for (let k = 0; k < 2; k++) drip(ctx, -0.3 + k * 0.08, 0.2 - k * 0.04, 0.18, TOX, t, k + 1, true);
  ctx.restore();
  legs(false);
  // cefalotórax y cabeza
  const head = () => ctx.ellipse(0.14, 0.0, 0.2, 0.14, 0.05, 0, TAU);
  shade(ctx, head, '#38441a', { x: 0.1, y: -0.08, r: 0.24, hi: 0.4, tex: 0.6 });
  ctx.save(); ctx.beginPath(); head(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8 * P; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0.1, -0.02); ctx.lineTo(0.1 + Math.cos(k * 0.8 + 2) * 0.2, -0.02 + Math.sin(k * 0.8 + 2) * 0.2); ctx.stroke(); } ctx.restore();
  spec(ctx, 0.1, -0.09, 0.1, 0.025, 0.05, 0.5);
  // quelíceros con colmillos y veneno
  const bite = angry ? 0.3 + 0.25 * Math.abs(Math.sin(t * 7)) : 0.1;
  for (const s of [0, 1]) {
    ctx.save(); ctx.translate(0.3 - s * 0.03, 0.06 + s * 0.01); ctx.rotate(0.3 + (s ? bite : -bite * 0.3));
    shade(ctx, () => ctx.ellipse(0.03, 0.03, 0.05, 0.07, 0.2, 0, TAU), s ? '#2a320f' : '#3f4a18', { x: 0.01, y: 0.0, r: 0.08 });
    ctx.fillStyle = lin(ctx, 0, 0.06, 0.06, 0.16, [[0, '#2a1d10'], [1, '#d8c890']]); ctx.beginPath(); ctx.moveTo(0.0, 0.08); ctx.quadraticCurveTo(0.08, 0.1, 0.07, 0.17); ctx.quadraticCurveTo(0.04, 0.12, 0.03, 0.08); ctx.fill();
    ctx.restore();
  }
  for (let k = 0; k < 2; k++) drip(ctx, 0.36 + k * 0.03, 0.2, 0.14, TOX, t, k + 5, true);
  // racimo de ojos verdes
  const ep = (angry ? 1.4 : 0.9) * pulse;
  for (const [ex, ey, er] of [[0.3, -0.07, 0.028], [0.25, -0.08, 0.026], [0.33, -0.03, 0.018], [0.22, -0.04, 0.017], [0.28, -0.115, 0.014], [0.2, -0.11, 0.013], [0.34, -0.1, 0.012], [0.17, -0.07, 0.012]] as const) eyeGlow(ctx, ex, ey, er, TOX, ep);
  ctx.restore();
}

// ---------------------------------------------------------------- 6: Serpiente alienígena
// Larga, flotando: el cuerpo sigue el camino de la cabeza ("trail", en coordenadas del mundo) y además ondula
// de costado. Placas negras brillantes como de armadura, panza de escamas amarillo verdosas, espinas en el lomo.
// La cabeza es de alien: cráneo alargado y liso con costillas, boca enorme llena de colmillos que brilla por
// dentro, lengua bífida y baba.
export function drawSerpentBody(ctx: CanvasRenderingContext2D, trail: [number, number][], t: number) {
  if (trail.length < 2) return;
  const n = trail.length, width = (i: number) => 0.36 * (1 - (i / n) ** 1.3 * 0.85);
  // ondulación de costado (perpendicular al camino), que viaja de la cabeza a la cola
  const pts: Pt[] = trail.map(([x, y], i) => {
    const [ax, ay] = trail[Math.max(0, i - 1)], [bx, by] = trail[Math.min(n - 1, i + 1)], l = Math.hypot(bx - ax, by - ay) || 1;
    const k = Math.sin(t * 5 - i * 0.35) * 0.08 * Math.min(1, i / 6);
    return [x - (by - ay) / l * k, y + (bx - ax) / l * k];
  });
  for (let i = n - 1; i >= 1; i--) {
    const [x, y] = pts[i], [px, py] = pts[i - 1], w = width(i), a = Math.atan2(py - y, px - x), len = Math.hypot(px - x, py - y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const seg = () => ctx.ellipse(len * 0.4, 0, len * 0.75 + w * 0.32, w * 0.52, 0, 0, TAU);
    ctx.beginPath(); seg();
    ctx.fillStyle = lin(ctx, 0, -w * 0.52, 0, w * 0.52, [[0, '#3c4220'], [0.18, '#20240f'], [0.45, '#0b0d06'], [0.62, '#4a5a10'], [0.8, '#b8d43a'], [1, '#e6f7a0']]);
    ctx.fill();
    grain(ctx, seg, 0.45);
    ctx.beginPath(); seg(); ctx.strokeStyle = 'rgba(5,6,2,0.9)'; ctx.lineWidth = 0.8 * P; ctx.stroke();
    // escamas de la panza y borde de la placa
    ctx.strokeStyle = 'rgba(40,50,10,0.7)'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.moveTo(len * 0.4, w * 0.12); ctx.quadraticCurveTo(len * 0.25, w * 0.35, len * 0.4, w * 0.5); ctx.stroke();
    if (i % 2 === 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(190,242,100,${0.12 + 0.12 * Math.sin(t * 4 - i * 0.4)})`; ctx.beginPath(); ctx.ellipse(len * 0.4, w * 0.32, w * 0.3, w * 0.1, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    spec(ctx, len * 0.4, -w * 0.26, w * 0.4, w * 0.07, 0, 0.45);
    if (i % 3 === 0 && i > 2) { // espinas del lomo, curvas y afiladas
      ctx.beginPath(); ctx.moveTo(-w * 0.15, -w * 0.42); ctx.quadraticCurveTo(-w * 0.45, -w * 1.05, -w * 1.0, -w * 1.25); ctx.quadraticCurveTo(-w * 0.3, -w * 0.85, w * 0.25, -w * 0.45); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, -w * 1.2, 0, -w * 0.45, [[0, '#d9d4b0'], [0.5, '#6b6a3a'], [1, '#14160a']]); ctx.fill(); ctx.strokeStyle = '#0b0c05'; ctx.lineWidth = 0.6 * P; ctx.stroke();
    }
    ctx.restore();
  }
}
// Cuerpo de mentira para cuando todavía no se movió (para que no sea una cabeza sola): sale para atrás.
export function serpentIdleTrail(x: number, y: number, left: boolean, t: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 36; i++) out.push([x + (left ? 1 : -1) * i * 0.08, y + Math.sin(t * 1.6 - i * 0.28) * 0.25 * Math.min(1, i / 8)]);
  return out;
}
export function drawSerpentHead(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const open = angry ? 0.4 + 0.28 * Math.abs(Math.sin(t * 4)) : 0.1 + 0.05 * Math.sin(t * 1.3);
  ctx.save(); ctx.scale(1.15, 1.15);
  // mandíbula de abajo
  ctx.save(); ctx.translate(-0.14, 0.05); ctx.rotate(open);
  const jaw = () => { ctx.moveTo(0, -0.02); ctx.quadraticCurveTo(0.28, 0.12, 0.52, 0.04); ctx.lineTo(0.5, 0.0); ctx.quadraticCurveTo(0.25, 0.03, 0, -0.05); ctx.closePath(); };
  shade(ctx, jaw, '#3a4318', { x: 0.2, y: 0.0, r: 0.4, tex: 0.5 });
  teeth(ctx, 0.08, 0.48, 0.0, 9, 0.07, -1, 2);
  ctx.restore();
  // boca por dentro (brilla verde) y lengua bífida
  ctx.fillStyle = lin(ctx, 0, 0.0, 0, 0.3, [[0, '#2a0a10'], [1, '#5b1426']]); ctx.beginPath(); ctx.moveTo(-0.12, 0.04); ctx.lineTo(0.44, 0.03); ctx.lineTo(0.38, 0.05 + open * 0.38); ctx.closePath(); ctx.fill();
  bloom(ctx, 0.0, 0.08 + open * 0.1, 0.18, '#a3e635', 0.25 + open * 0.4);
  const tw = Math.sin(t * 7) * 0.05, tl = angry ? 0.66 + Math.sin(t * 5) * 0.08 : 0.45;
  ctx.strokeStyle = '#7f1d3a'; ctx.lineWidth = 2.6 * P; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.03, 0.06 + open * 0.1); ctx.quadraticCurveTo(0.3, 0.08 + open * 0.2 + tw, tl, 0.05 + open * 0.25 - tw); ctx.stroke();
  ctx.strokeStyle = '#be185d'; ctx.lineWidth = 1.2 * P; ctx.beginPath(); ctx.moveTo(0.05, 0.055 + open * 0.1); ctx.quadraticCurveTo(0.3, 0.075 + open * 0.2 + tw, tl, 0.045 + open * 0.25 - tw); ctx.stroke();
  ctx.lineWidth = 1.4 * P; ctx.strokeStyle = '#7f1d3a'; ctx.beginPath(); ctx.moveTo(tl, 0.05 + open * 0.25 - tw); ctx.lineTo(tl + 0.08, 0.0 + open * 0.25); ctx.moveTo(tl, 0.05 + open * 0.25 - tw); ctx.lineTo(tl + 0.08, 0.1 + open * 0.25); ctx.stroke();
  // cráneo alargado (como de xenomorfo): liso, brillante, con costillas y cresta
  const skull = () => { ctx.moveTo(-0.3, 0.07); ctx.bezierCurveTo(-0.62, -0.08, -0.5, -0.36, -0.1, -0.32); ctx.bezierCurveTo(0.22, -0.28, 0.48, -0.12, 0.52, 0.0); ctx.lineTo(0.46, 0.04); ctx.quadraticCurveTo(0.2, 0.05, -0.3, 0.07); ctx.closePath(); };
  shade(ctx, skull, '#262b14', { x: -0.05, y: -0.28, r: 0.55, hi: 0.5, tex: 0.45 });
  ctx.save(); ctx.beginPath(); skull(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.9 * P;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-0.32 + k * 0.05, 0.02); ctx.quadraticCurveTo(-0.3 + k * 0.05, -0.15, -0.22 + k * 0.05, -0.3); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(200,220,120,0.18)'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-0.31 + k * 0.05, 0.0); ctx.quadraticCurveTo(-0.29 + k * 0.05, -0.15, -0.21 + k * 0.05, -0.29); ctx.stroke(); }
  ctx.restore();
  spec(ctx, -0.02, -0.24, 0.26, 0.035, 0.12, 0.6);
  spec(ctx, 0.3, -0.1, 0.1, 0.018, 0.35, 0.4);
  teeth(ctx, 0.0, 0.48, 0.035, 11, 0.08, 1, 5);
  // ojos chiquitos hundidos que brillan
  eyeGlow(ctx, 0.22, -0.11, 0.022, '#d9f99d', angry ? 1.4 : 0.7, true);
  for (let k = 0; k < 3; k++) drip(ctx, 0.08 + k * 0.14, 0.07 + open * 0.2, 0.14, '#cdeb7a', t, k + 3, true);
  ctx.restore();
}

// ---------------------------------------------------------------- 7: Dron asesino
// Casco de metal negro con placas, tornillos y cables, un gran ojo rojo (lente con anillos y diafragma que se
// abre y cierra), cuatro alas de cuchilla curvas con tiras de luz roja que aletean, rotores que giran, un caño
// de arma abajo y lucecitas que parpadean.
export function drawDrone(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const RED = '#ff2020', flapRate = angry ? 16 : 10;
  ctx.save(); ctx.scale(1.12, 1.12); ctx.rotate(Math.sin(t * 1.8) * 0.06);
  const blade = (ang: number, len: number, back: boolean, tt: number, a: number) => {
    ctx.save(); ctx.globalAlpha = a; ctx.rotate(ang + Math.sin(tt * flapRate) * 0.22 * (ang < 0 ? -1 : 1));
    const b = () => { ctx.moveTo(0.05, -0.04); ctx.bezierCurveTo(len * 0.4, -0.12, len * 0.8, -0.1, len * 1.12, -0.02); ctx.bezierCurveTo(len * 0.8, 0.0, len * 0.4, 0.06, 0.05, 0.04); ctx.closePath(); };
    shade(ctx, b, back ? '#15171c' : '#23262e', { x: len * 0.4, y: -0.1, r: len, hi: 0.3, tex: 0.3 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(RED, back ? 0.6 : 0.95); ctx.lineWidth = 1.5 * P;
    ctx.beginPath(); ctx.moveTo(len * 0.2, -0.065); ctx.bezierCurveTo(len * 0.5, -0.1, len * 0.8, -0.085, len * 1.05, -0.03); ctx.stroke(); ctx.restore();
    bloom(ctx, len * 0.7, -0.07, 0.12, RED, back ? 0.2 : 0.35);
    spec(ctx, len * 0.5, -0.05, len * 0.3, 0.012, -0.05, 0.5);
    // rotor en la punta
    ctx.save(); ctx.translate(len * 0.95, -0.03);
    ctx.fillStyle = 'rgba(200,210,220,0.22)'; ctx.beginPath(); ctx.ellipse(0, -0.05, 0.15, 0.035, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(220,230,240,0.35)'; ctx.lineWidth = 0.6 * P; ctx.stroke();
    shade(ctx, () => ctx.roundRect(-0.025, -0.06, 0.05, 0.06, 0.01), '#2a2e36', { x: 0, y: -0.05, r: 0.06 });
    ctx.strokeStyle = 'rgba(30,30,35,0.9)'; ctx.lineWidth = 1.3 * P; const r = tt * 60; ctx.beginPath(); ctx.moveTo(Math.cos(r) * 0.15, -0.05); ctx.lineTo(-Math.cos(r) * 0.15, -0.05); ctx.stroke();
    ctx.restore();
    ctx.restore();
  };
  blur(ctx, t, 3, 0.012, (tt, a) => { blade(-2.5, 0.62, true, tt, a); blade(2.6, 0.55, true, tt, a); });
  // cables que cuelgan y caño del arma
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6 * P; ctx.lineCap = 'round';
  for (const [x, l, ph] of [[-0.08, 0.32, 0], [0.02, 0.26, 1.5], [-0.14, 0.22, 3]] as const) { ctx.beginPath(); ctx.moveTo(x, 0.12); ctx.quadraticCurveTo(x + Math.sin(t * 2 + ph) * 0.06, 0.12 + l * 0.6, x + Math.sin(t * 2.5 + ph) * 0.08, 0.12 + l); ctx.stroke(); }
  segment(ctx, [0.02, 0.17], [0.24, 0.25], 0.06, 0.045, '#2a2e36', 0.8);
  ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(0.24, 0.25, 0.018, 0, TAU); ctx.fill();
  if (angry && Math.sin(t * 20) > 0.7) bloom(ctx, 0.27, 0.26, 0.1, '#fbbf24', 0.8);
  // casco
  const hull = () => ctx.arc(0, 0, 0.25, 0, TAU);
  shade(ctx, hull, '#30343d', { x: -0.08, y: -0.1, r: 0.3, hi: 0.6, tex: 0.5 });
  ctx.save(); ctx.beginPath(); hull(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.8 * P;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.23, 0.08, 0, 0, TAU); ctx.moveTo(-0.23, -0.1); ctx.quadraticCurveTo(0, -0.16, 0.23, -0.1); ctx.moveTo(-0.05, -0.23); ctx.lineTo(-0.08, 0.23); ctx.stroke();
  ctx.fillStyle = '#8b93a1'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.2, Math.sin(a) * 0.07, 0.6 * P, 0, TAU); ctx.fill(); }
  ctx.restore();
  spec(ctx, -0.08, -0.13, 0.09, 0.03, -0.5, 0.6);
  blur(ctx, t, 3, 0.012, (tt, a) => { blade(-0.7, 0.66, false, tt, a); blade(0.65, 0.58, false, tt, a); });
  // ojo: lente con anillos y diafragma
  ctx.save(); ctx.translate(0.09, 0.0);
  shade(ctx, () => ctx.arc(0, 0, 0.15, 0, TAU), '#15171c', { x: -0.03, y: -0.04, r: 0.17, hi: 0.4 });
  ctx.strokeStyle = '#4b5260'; ctx.lineWidth = P; ctx.beginPath(); ctx.arc(0, 0, 0.105, 0, TAU); ctx.stroke();
  const iris = (angry ? 0.06 : 0.075) + Math.sin(t * 3) * 0.008;
  const g = ctx.createRadialGradient(0.01, 0, 0, 0, 0, 0.1); g.addColorStop(0, '#fff1f1'); g.addColorStop(0.25, RED); g.addColorStop(0.7, '#7f0000'); g.addColorStop(1, '#200000');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.095, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(10,0,0,0.85)'; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.095, Math.sin(a) * 0.095); ctx.lineTo(Math.cos(a + 1.05) * 0.095, Math.sin(a + 1.05) * 0.095); ctx.lineTo(Math.cos(a + 0.7) * iris, Math.sin(a + 0.7) * iris); ctx.closePath(); ctx.fill(); }
  bloom(ctx, 0, 0, 0.35, RED, angry ? 0.7 : 0.45);
  spec(ctx, -0.04, -0.045, 0.03, 0.015, -0.6, 0.8);
  ctx.restore();
  // luces chiquitas
  for (let k = 0; k < 3; k++) if (Math.sin(t * 8 + k * 2) > 0) eyeGlow(ctx, -0.17 + k * 0.03, 0.1, 0.008, RED, 0.8);
  ctx.restore();
}

// ---------------------------------------------------------------- 8: Monstruo del bosque radiactivo
// Una bestia hecha de troncos podridos, corteza y musgo: lomo jorobado con ramas que se mecen, grietas y ojos
// verdes radiactivos, hocico con dientes de astilla que chorrea baba verde, brazos largos como raíces con
// garras. Avanza a zancadas pesadas (las cuatro patas caminan) y le caen esporas que brillan.
export function drawForest(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const TOX = '#a3ff3a', BARK = '#3e2d1c', MOSS = '#3a5418', walk = t * (angry ? 6 : 3.5), pulse = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.save(); ctx.scale(1.1, 1.1);
  const bob = Math.abs(Math.sin(walk)) * 0.03;
  ctx.translate(0, -bob);
  // brazos largos (adelante) y patas cortas (atrás): ramas retorcidas con garras de raíz
  const limb4 = (hip: Pt, ph: number, front: boolean, far: boolean) => {
    const foot: Pt = [hip[0] + (front ? 0.22 : -0.02) + 0.13 * Math.cos(ph), 0.5 + 0.07 * Math.min(0, Math.sin(ph)) + bob - (far ? 0.05 : 0)];
    const knee = ik(hip, foot, front ? 0.36 : 0.26, front ? 0.36 : 0.26, front ? 1 : -1);
    const col = far ? '#21180e' : '#4a3520';
    segment(ctx, hip, knee, front ? 0.15 : 0.17, 0.1, col, 0.2); segment(ctx, knee, foot, 0.1, 0.075, col, 0.2);
    for (const k of [-1, 0, 1, 2]) { const a = 0.3 + k * 0.35; segment(ctx, foot, [foot[0] + Math.cos(a) * 0.1, foot[1] + Math.sin(a) * 0.06 + 0.02], 0.028, 0.008, '#1f160c', 0.2); }
    if (!far) { ctx.fillStyle = alpha(MOSS, 0.85); ctx.beginPath(); ctx.ellipse(knee[0], knee[1] - 0.02, 0.06, 0.03, 0.3, 0, TAU); ctx.fill(); }
    return foot;
  };
  limb4([0.18, -0.12], walk + Math.PI, true, true); limb4([-0.34, 0.02], walk, false, true);
  // ramas del lomo que se mecen (algunas con hojas muertas)
  for (let k = 0; k < 6; k++) {
    const bx = -0.42 + k * 0.13, sway = Math.sin(t * 1.5 + k) * 0.08, h = 0.2 + hash(k + 4) * 0.22;
    ctx.save(); ctx.translate(bx, -0.3 + Math.max(0, -bx) * 0.35 - Math.max(0, bx) * 0.15); ctx.rotate(-0.5 + k * 0.14 + sway);
    segment(ctx, [0, 0], [0.02, -h], 0.055, 0.018, '#2e2114', 0.15);
    segment(ctx, [0.01, -h * 0.5], [0.09, -h * 0.8], 0.026, 0.01, '#2e2114', 0.15);
    segment(ctx, [0.015, -h * 0.7], [-0.06, -h * 0.95], 0.02, 0.008, '#2e2114', 0.15);
    ctx.restore();
  }
  // cuerpo: jorobado, alto en los hombros y bajo atrás
  const body = () => { ctx.moveTo(-0.55, 0.12); ctx.bezierCurveTo(-0.6, -0.12, -0.35, -0.3, -0.05, -0.38); ctx.bezierCurveTo(0.2, -0.44, 0.42, -0.3, 0.42, -0.08); ctx.bezierCurveTo(0.4, 0.15, 0.0, 0.2, -0.55, 0.12); ctx.closePath(); };
  shade(ctx, body, BARK, { x: 0.05, y: -0.38, r: 0.6, hi: 0.3, tex: 0.75, texSize: 1.4 });
  ctx.save(); ctx.beginPath(); body(); ctx.clip();
  ctx.strokeStyle = 'rgba(15,9,4,0.75)'; ctx.lineWidth = 1.1 * P;
  for (let k = 0; k < 12; k++) { // vetas de la corteza, siguiendo la joroba
    ctx.beginPath(); const x0 = -0.6 + k * 0.09; ctx.moveTo(x0, 0.2);
    for (let y = 0.2; y > -0.45; y -= 0.06) ctx.lineTo(x0 + (0.2 - y) * 0.35 + Math.sin(y * 20 + k) * 0.015, y);
    ctx.stroke();
  }
  for (let k = 0; k < 7; k++) { ctx.fillStyle = alpha(MOSS, 0.8); ctx.beginPath(); ctx.ellipse(-0.45 + hash(k) * 0.85, -0.35 + hash(k + 9) * 0.15 + Math.max(0, -0.3 + hash(k) * 0.85) * 0.2, 0.07 + hash(k + 3) * 0.06, 0.03, 0.2, 0, TAU); ctx.fill(); } // musgo
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(TOX, 0.55 * pulse); ctx.lineWidth = 1.2 * P;
  for (let k = 0; k < 5; k++) { // grietas verticales que brillan
    let x = -0.42 + k * 0.17, y = 0.1; ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (hash(k * 7 + j) - 0.5) * 0.06 + 0.02; y -= 0.06; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  for (let k = 0; k < 3; k++) bloom(ctx, -0.3 + k * 0.2, -0.05, 0.15, TOX, 0.2 * pulse);
  // cabeza baja adelante de los hombros: cráneo de corteza con ojos y un hocico de astillas
  const open = angry ? 0.3 + 0.2 * Math.abs(Math.sin(t * 5)) : 0.1;
  ctx.save(); ctx.translate(0.36, -0.08);
  ctx.save(); ctx.rotate(open);
  shade(ctx, () => { ctx.moveTo(-0.06, 0.02); ctx.lineTo(0.3, 0.08); ctx.lineTo(0.26, 0.15); ctx.lineTo(-0.06, 0.14); ctx.closePath(); }, '#33251a', { x: 0.1, y: 0.05, r: 0.3, tex: 0.6 });
  teeth(ctx, 0.0, 0.28, 0.07, 7, 0.09, -1, 11, '#c8b88a');
  ctx.restore();
  ctx.fillStyle = '#100903'; ctx.beginPath(); ctx.moveTo(-0.05, 0.0); ctx.lineTo(0.3, 0.03); ctx.lineTo(0.27, 0.05 + open * 0.32); ctx.closePath(); ctx.fill();
  bloom(ctx, 0.1, 0.08, 0.14, TOX, 0.25 + open * 0.6);
  const head = () => { ctx.moveTo(-0.14, -0.16); ctx.bezierCurveTo(0.0, -0.26, 0.24, -0.2, 0.33, -0.04); ctx.lineTo(0.34, 0.04); ctx.lineTo(-0.1, 0.05); ctx.closePath(); };
  shade(ctx, head, '#4a3622', { x: 0.05, y: -0.18, r: 0.36, tex: 0.75, texSize: 1.3 });
  ctx.strokeStyle = 'rgba(15,9,4,0.8)'; ctx.lineWidth = 1.4 * P; ctx.beginPath(); ctx.moveTo(0.02, -0.15); ctx.quadraticCurveTo(0.14, -0.16, 0.26, -0.08); ctx.stroke(); // ceño
  teeth(ctx, -0.04, 0.33, 0.03, 9, 0.1, 1, 3, '#d4c49a');
  const ep = (angry ? 1.5 : 1) * pulse;
  for (const [ex, ey, er] of [[0.14, -0.09, 0.024], [0.23, -0.05, 0.018], [0.06, -0.11, 0.015], [0.28, -0.01, 0.012]] as const) { ctx.fillStyle = '#0a0602'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, TAU); ctx.fill(); eyeGlow(ctx, ex, ey, er, TOX, ep); }
  for (let k = 0; k < 3; k++) drip(ctx, 0.04 + k * 0.1, 0.08 + open * 0.15, 0.16, TOX, t, k + 7, true);
  ctx.restore();
  limb4([0.15, -0.1], walk, true, false); limb4([-0.36, 0.05], walk + Math.PI, false, false);
  // esporas que brillan y flotan
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 6; k++) { const life = (t * 0.3 + hash(k)) % 1; ctx.fillStyle = alpha(TOX, 0.7 * (1 - life)); ctx.beginPath(); ctx.arc(-0.4 + hash(k + 2) * 0.8 + Math.sin(t + k) * 0.05, -0.35 - life * 0.4, 1.2 * P, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- 9: Kaiju
// Un monstruo gigante tipo kaiju: piel de roca oscura con placas y escamas, cristales turquesa que brillan en
// el lomo, cabeza enorme con una boca llena de colmillos que se abre, tentáculos rosados que salen de la boca y
// se retuercen, varios ojos verdes y patas gruesas con garras que pisan fuerte.
export function drawKaiju(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const ROCK = '#3b4038', CRYS = '#3ee6d0', TOX = '#9cff57', walk = t * (angry ? 5 : 3), pulse = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.save(); ctx.scale(1.15, 1.15);
  const stomp = Math.abs(Math.sin(walk)) * 0.025; ctx.translate(0, -stomp);
  const leg = (hip: Pt, ph: number, far: boolean, front: boolean) => {
    const foot: Pt = [hip[0] + (front ? 0.08 : -0.06) + 0.1 * Math.cos(ph), 0.55 + 0.05 * Math.min(0, Math.sin(ph)) + stomp - (far ? 0.04 : 0)];
    const knee = ik(hip, foot, 0.28, 0.28, front ? -1 : 1), col = far ? '#22261f' : '#454b40';
    segment(ctx, hip, knee, 0.26, 0.19, col, 0.15); segment(ctx, knee, foot, 0.19, 0.16, col, 0.15);
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(foot[0] + k * 0.04 + 0.04, foot[1] + 0.03); ctx.quadraticCurveTo(foot[0] + k * 0.04 + 0.11, foot[1] + 0.05, foot[0] + k * 0.04 + 0.12, foot[1] + 0.1); ctx.lineTo(foot[0] + k * 0.04 + 0.06, foot[1] + 0.07); ctx.closePath(); ctx.fillStyle = '#d8d2bc'; ctx.fill(); }
  };
  leg([0.22, 0.12], walk + Math.PI, true, true); leg([-0.38, 0.14], walk, true, false);
  // cola
  ctx.beginPath(); ctx.moveTo(-0.55, 0.0); ctx.quadraticCurveTo(-0.85, 0.05 + Math.sin(t * 2) * 0.06, -0.98, 0.25 + Math.sin(t * 2 + 1) * 0.06); ctx.quadraticCurveTo(-0.8, 0.12, -0.5, 0.2); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, -0.05, 0, 0.2, [[0, '#4a5045'], [1, '#161a14']]); ctx.fill(); ctx.strokeStyle = '#0c0e0a'; ctx.lineWidth = 0.8 * P; ctx.stroke();
  // cristales del lomo (atrás)
  const crystal = (x: number, y: number, h: number, a: number, w: number) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.6, -h * 0.85); ctx.lineTo(0, -h); ctx.lineTo(w * 0.7, -h * 0.75); ctx.lineTo(w, 0); ctx.closePath();
    ctx.fillStyle = lin(ctx, -w, 0, w, -h, [[0, '#0b4a45'], [0.45, CRYS], [0.6, '#c8fff6'], [1, '#13706a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(200,255,250,0.6)'; ctx.lineWidth = 0.6 * P; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(-w * 0.1, 0); ctx.stroke();
    ctx.strokeStyle = '#06302c'; ctx.lineWidth = 0.7 * P; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.6, -h * 0.85); ctx.lineTo(0, -h); ctx.lineTo(w * 0.7, -h * 0.75); ctx.lineTo(w, 0); ctx.stroke();
    ctx.restore();
  };
  for (let k = 0; k < 8; k++) { const x = -0.5 + k * 0.12, y = -0.3 - Math.sin((k / 7) * Math.PI) * 0.12; crystal(x, y + 0.05, 0.16 + hash(k) * 0.16, -0.35 + k * 0.06, 0.045 + hash(k + 3) * 0.03); }
  bloom(ctx, -0.1, -0.45, 0.45, CRYS, 0.3 * pulse);
  // cuerpo de roca con placas
  const body = () => { ctx.moveTo(-0.62, 0.12); ctx.bezierCurveTo(-0.68, -0.25, -0.3, -0.45, 0.05, -0.4); ctx.bezierCurveTo(0.35, -0.36, 0.5, -0.2, 0.5, 0.05); ctx.bezierCurveTo(0.35, 0.3, -0.4, 0.32, -0.62, 0.12); ctx.closePath(); };
  shade(ctx, body, ROCK, { x: -0.1, y: -0.35, r: 0.7, hi: 0.35, tex: 0.45, texSize: 1.3 });
  ctx.save(); ctx.beginPath(); body(); ctx.clip();
  for (let k = 0; k < 22; k++) { // placas de roca
    const x = -0.6 + hash(k) * 1.1, y = -0.4 + hash(k + 50) * 0.65, r = 0.05 + hash(k + 9) * 0.06;
    ctx.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + hash(k + j); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); } ctx.closePath();
    ctx.fillStyle = `rgba(${90 + hash(k + 2) * 40},${95 + hash(k + 2) * 40},${85 + hash(k + 2) * 30},0.18)`; ctx.fill(); ctx.strokeStyle = 'rgba(10,12,8,0.3)'; ctx.lineWidth = 0.8 * P; ctx.stroke();
  }
  ctx.fillStyle = lin(ctx, 0, 0.0, 0, 0.3, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]); ctx.fillRect(-0.7, -0.5, 1.3, 0.85);
  ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { ctx.fillStyle = alpha(CRYS, 0.35 * pulse); ctx.beginPath(); ctx.ellipse(-0.45 + k * 0.2, -0.05 + hash(k) * 0.15, 0.03, 0.015, 0, 0, TAU); ctx.fill(); } // cristalitos en la piel
  ctx.restore();
  // cabeza: maxilar, boca abierta con colmillos, tentáculos y ojos
  const open = angry ? 0.35 + 0.25 * Math.abs(Math.sin(t * 3.5)) : 0.15 + 0.05 * Math.sin(t * 1.4);
  ctx.save(); ctx.translate(0.4, -0.02);
  ctx.save(); ctx.rotate(open * 0.8);
  shade(ctx, () => { ctx.moveTo(-0.08, 0.05); ctx.quadraticCurveTo(0.2, 0.18, 0.42, 0.1); ctx.lineTo(0.4, 0.04); ctx.lineTo(-0.08, 0.0); ctx.closePath(); }, '#3a3f36', { x: 0.15, y: 0.05, r: 0.4, tex: 0.8 });
  teeth(ctx, 0.0, 0.4, 0.04, 9, 0.1, -1, 21);
  ctx.restore();
  ctx.fillStyle = lin(ctx, 0, 0, 0, 0.3, [[0, '#2b070c'], [1, '#64121f']]); ctx.beginPath(); ctx.moveTo(-0.06, 0.0); ctx.lineTo(0.42, 0.0); ctx.lineTo(0.36, 0.04 + open * 0.38); ctx.lineTo(-0.06, 0.05); ctx.closePath(); ctx.fill();
  // tentáculos rosados que salen de la boca
  for (let k = 0; k < 4; k++) {
    const base: Pt = [0.08 + k * 0.05, 0.05 + open * 0.12], L = (angry ? 0.55 : 0.32) + k * 0.04;
    let x = base[0], y = base[1], ang = 0.2 + k * 0.25 - open * 0.3;
    const pts: Pt[] = [[x, y]];
    for (let j = 1; j <= 10; j++) { ang += Math.sin(t * (3 + k * 0.4) - j * 0.6 + k * 2) * 0.28; x += Math.cos(ang) * L / 10; y += Math.sin(ang) * L / 10; pts.push([x, y]); }
    for (let j = 0; j < pts.length - 1; j++) segment(ctx, pts[j], pts[j + 1], 0.06 * (1 - j / 11) + 0.01, 0.06 * (1 - (j + 1) / 11) + 0.01, k % 2 ? '#c0506a' : '#d86a82', 0.6);
    ctx.fillStyle = 'rgba(255,220,230,0.7)'; for (let j = 3; j < pts.length - 1; j += 3) { ctx.beginPath(); ctx.arc(pts[j][0], pts[j][1] + 0.012 * (1 - j / 11), 0.5 * P, 0, TAU); ctx.fill(); } // ventosas
  }
  const head = () => { ctx.moveTo(-0.15, -0.24); ctx.bezierCurveTo(0.1, -0.3, 0.4, -0.16, 0.45, 0.0); ctx.lineTo(-0.1, 0.03); ctx.closePath(); };
  shade(ctx, head, '#474d42', { x: 0.1, y: -0.22, r: 0.45, hi: 0.35, tex: 0.45, texSize: 1.3 });
  ctx.strokeStyle = 'rgba(10,12,8,0.6)'; ctx.lineWidth = 0.9 * P; ctx.beginPath(); ctx.moveTo(-0.05, -0.2); ctx.quadraticCurveTo(0.2, -0.22, 0.35, -0.08); ctx.stroke(); // ceño
  teeth(ctx, 0.0, 0.44, 0.0, 10, 0.11, 1, 13);
  const ep = (angry ? 1.5 : 1) * pulse;
  for (const [ex, ey, er] of [[0.22, -0.12, 0.024], [0.3, -0.08, 0.02], [0.14, -0.15, 0.018], [0.36, -0.04, 0.014]] as const) { ctx.fillStyle = '#080a06'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.6, er * 1.2, -0.3, 0, TAU); ctx.fill(); eyeGlow(ctx, ex, ey, er, TOX, ep, true); }
  for (let k = 0; k < 3; k++) drip(ctx, 0.05 + k * 0.12, 0.06 + open * 0.25, 0.2, TOX, t, k + 31, true);
  ctx.restore();
  leg([0.18, 0.15], walk, false, true); leg([-0.42, 0.16], walk + Math.PI, false, false);
  ctx.restore();
}

// ---------------------------------------------------------------- 10: Insecto alienígena
// Mitad avispa, mitad mantis: abdomen largo de anillos negros y verde radiactivo que late y termina en un
// aguijón, cuatro alas traslúcidas ámbar con manchas que baten con estela, patas largas y finas que cuelgan y
// se mueven, brazos de mantis con pinchos que atacan, cabeza con ojos compuestos verdes enormes y mandíbulas.
export function drawInsect(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const TOX = '#b8ff3c', CHIT = '#4a1e14', rate = angry ? 30 : 22, pulse = 0.6 + 0.4 * Math.sin(t * (angry ? 9 : 4));
  ctx.save(); ctx.scale(1.3, 1.3); ctx.rotate(0.05);
  // alas de atrás
  blur(ctx, t, 4, 0.006, (tt, a) => {
    const f = Math.sin(tt * rate);
    ctx.save(); ctx.translate(0.05, -0.14); ctx.rotate(-0.35 - f * 0.8); ctx.scale(1, 0.5 + 0.5 * Math.abs(f)); membrane(ctx, 0.6, 0.15, '#c8a060', 'rgba(70,35,10,0.7)', 'rgba(60,20,5,0.55)', a * 0.75); ctx.restore();
  });
  // patas de caminar (cuatro), finas y largas, colgando y moviéndose
  const walkLegs = (far: boolean) => {
    for (let i = 0; i < 2; i++) {
      const hip: Pt = [0.0 - i * 0.08, 0.04], ph = t * (angry ? 8 : 4) + i * 1.9 + (far ? 2.4 : 0);
      const foot: Pt = [hip[0] + (i ? -0.3 : 0.05) + 0.06 * Math.cos(ph), hip[1] + 0.45 + 0.05 * Math.sin(ph) - (far ? 0.05 : 0)];
      const knee = ik(hip, foot, 0.25, 0.3, i ? 1 : -1);
      ctx.save(); if (far) ctx.globalAlpha = 0.8;
      bugLeg(ctx, [hip, knee, foot, [foot[0] + 0.05, foot[1] + 0.05]], [0.04, 0.03, 0.02, 0.01], far ? '#2a0f09' : '#5a2416', far ? '#3a2a0a' : '#c9a227', 0.7);
      ctx.restore();
    }
  };
  walkLegs(true);
  // abdomen segmentado que late, con aguijón
  ctx.save(); ctx.translate(-0.08, 0.02); ctx.rotate(-0.4 + Math.sin(t * 2.5) * 0.08 - (angry ? 0.25 : 0));
  for (let k = 7; k >= 0; k--) {
    const x = -0.07 - k * 0.075, r = 0.1 * Math.sin((k + 1.5) / 9.5 * Math.PI) + 0.03, seg = () => ctx.ellipse(x, 0, 0.06, r, 0, 0, TAU);
    shade(ctx, seg, k % 2 ? '#1c1408' : CHIT, { x, y: -r * 0.6, r: r * 1.6, hi: 0.4, tex: 0.5 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha(TOX, (k % 2 ? 0.55 : 0.2) * pulse); ctx.beginPath(); ctx.ellipse(x - 0.01, r * 0.2, 0.035, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
    spec(ctx, x, -r * 0.6, 0.03, r * 0.15, 0, 0.4);
  }
  ctx.beginPath(); ctx.moveTo(-0.62, -0.02); ctx.quadraticCurveTo(-0.72, 0.0, -0.8, 0.05); ctx.lineTo(-0.62, 0.03); ctx.closePath(); ctx.fillStyle = lin(ctx, -0.62, 0, -0.8, 0, [[0, '#2a1a0c'], [1, '#e8dfb8']]); ctx.fill();
  drip(ctx, -0.79, 0.05, 0.12, TOX, t, 41, true);
  bloom(ctx, -0.35, 0.03, 0.25, TOX, 0.3 * pulse);
  ctx.restore();
  // tórax
  const thorax = () => ctx.ellipse(0.06, -0.06, 0.15, 0.11, -0.2, 0, TAU);
  shade(ctx, thorax, CHIT, { x: 0.02, y: -0.14, r: 0.2, hi: 0.4, tex: 0.6 });
  spec(ctx, 0.03, -0.13, 0.08, 0.02, -0.2, 0.55);
  // alas de adelante
  blur(ctx, t, 4, 0.006, (tt, a) => {
    const f = Math.sin(tt * rate + 0.6);
    ctx.save(); ctx.translate(0.08, -0.15); ctx.rotate(-0.5 - f * 0.85); ctx.scale(1, 0.5 + 0.5 * Math.abs(f)); membrane(ctx, 0.7, 0.16, '#d8b070', 'rgba(80,40,10,0.75)', 'rgba(60,20,5,0.6)', a * 0.85); ctx.restore();
  });
  // cabeza: ojos compuestos enormes que brillan, antenas, mandíbulas
  const chew = Math.sin(t * (angry ? 16 : 7)) * 0.3;
  ctx.save(); ctx.translate(0.27, -0.1); ctx.rotate(0.25);
  for (const s of [-1, 1]) { ctx.save(); ctx.translate(0.07, 0.05); ctx.rotate(0.5 + s * (0.35 + chew)); segment(ctx, [0, 0], [0.06, 0.03 * s], 0.035, 0.01, '#1a0d06', 0.5); ctx.restore(); }
  for (const s of [0, 1]) { ctx.strokeStyle = '#2a120a'; ctx.lineWidth = 1.1 * P; ctx.beginPath(); ctx.moveTo(0.02, -0.06); ctx.quadraticCurveTo(0.1 + s * 0.05, -0.25 + Math.sin(t * 3 + s) * 0.03, 0.22 + s * 0.06, -0.28 + Math.sin(t * 3 + s) * 0.05); ctx.stroke(); }
  shade(ctx, () => ctx.ellipse(0.02, 0.0, 0.09, 0.08, 0, 0, TAU), '#5a2618', { x: 0.0, y: -0.04, r: 0.12, tex: 0.5 });
  ctx.save(); ctx.beginPath(); ctx.ellipse(0.04, -0.02, 0.06, 0.07, 0.2, 0, TAU);
  const eg = ctx.createRadialGradient(0.05, -0.04, 0, 0.04, -0.02, 0.07); eg.addColorStop(0, lighten(TOX, 0.6)); eg.addColorStop(0.5, TOX); eg.addColorStop(1, '#2e4a06');
  ctx.fillStyle = eg; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) { ctx.beginPath(); ctx.arc(0.04 + i * 0.012 + (j % 2) * 0.006, -0.02 + j * 0.011, 0.4 * P, 0, TAU); ctx.fill(); } // facetas
  ctx.restore();
  bloom(ctx, 0.04, -0.02, 0.2, TOX, (angry ? 0.7 : 0.45) * pulse);
  spec(ctx, 0.02, -0.06, 0.02, 0.012, -0.4, 0.8);
  ctx.restore();
  walkLegs(false);
  // brazos de mantis con pinchos: plegados, y cuando ataca se estiran
  const strike = angry ? Math.max(0, Math.sin(t * 5)) ** 3 : 0;
  for (const far of [true, false]) {
    const sh: Pt = [0.14, -0.02 - (far ? 0.02 : 0)];
    const ea = 0.9 - strike * 1.1 + (far ? 0.1 : 0), elbow: Pt = [sh[0] + Math.cos(ea) * 0.22, sh[1] + Math.sin(ea) * 0.22];
    const fa = ea - 2.4 + strike * 1.6, hand: Pt = [elbow[0] + Math.cos(fa) * 0.24, elbow[1] + Math.sin(fa) * 0.24];
    ctx.save(); if (far) ctx.globalAlpha = 0.8;
    bugLeg(ctx, [sh, elbow, hand], [0.06, 0.05, 0.02], far ? '#2e120a' : '#6a2c18', far ? '#5a4a12' : '#d9b432', 0.8);
    ctx.restore();
  }
  ctx.restore();
}
