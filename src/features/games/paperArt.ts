// Los dibujos de "¡Al cesto!": la oficina es una ilustración (fondo, el escritorio de adelante, el ventilador y
// el cesto de alambre) y encima se dibujan las cosas que se mueven: el oficinista de traje, el reloj con la
// hora de verdad, el ventilador girando, lo que pasa afuera de la ventana y los bollos.
import binUrl from './assets/oficina-cesto.webp';
import deskUrl from './assets/oficina-escritorio.webp';
import bgUrl from './assets/oficina-fondo.webp';
import fanUrl from './assets/oficina-ventilador.webp';
import { BALL_R, BIN_H, BIN_SCALE, BOTTOM, TOP, W, type Bin, type Fan } from './paperBall';

// La oficina entra entera en la pantalla, centrada. La ilustración mide 1360 × 762 píxeles: 85 por unidad.
export interface View { w: number; h: number; s: number; ox: number; oy: number; t: number }
export const VIEW_H = TOP - BOTTOM;
export const X = (v: View, x: number) => v.ox + x * v.s;
export const Y = (v: View, y: number) => v.oy + (TOP - y) * v.s;
const PX = 85, ix = (px: number) => px / PX, iy = (py: number) => (650 - py) / PX; // de píxeles del dibujo a unidades
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const INK = '#141414', SKIN = '#f1c6a0', SKIN_D = '#d39c76', SUIT = '#30353f', SUIT_D = '#1d2026', SUIT_L = '#4a515e';

// ---------- Las imágenes ----------
const images: { bg?: HTMLImageElement; desk?: HTMLImageElement; bin?: HTMLImageElement; fan?: HTMLImageElement } = {};
let started = false;
export function loadOffice(onLoad: () => void) {
  if (started || typeof Image === 'undefined') return;
  started = true;
  for (const [key, url] of [['bg', bgUrl], ['desk', deskUrl], ['bin', binUrl], ['fan', fanUrl]] as const) {
    const img = new Image();
    img.onload = () => { images[key] = img; onLoad(); };
    img.src = url;
  }
}
// Una imagen puesta donde estaba en la ilustración (px, py: su esquina de arriba a la izquierda).
function placed(ctx: CanvasRenderingContext2D, v: View, img: HTMLImageElement | undefined, px: number, py: number) {
  if (img) ctx.drawImage(img, X(v, ix(px)), Y(v, iy(py)), (img.naturalWidth / PX) * v.s, (img.naturalHeight / PX) * v.s);
}

// Un lápiz en unidades del juego.
function pen(ctx: CanvasRenderingContext2D, v: View) {
  return {
    m: (x: number, y: number) => ctx.moveTo(X(v, x), Y(v, y)),
    l: (x: number, y: number) => ctx.lineTo(X(v, x), Y(v, y)),
    q: (cx: number, cy: number, x: number, y: number) => ctx.quadraticCurveTo(X(v, cx), Y(v, cy), X(v, x), Y(v, y)),
    c: (ax: number, ay: number, bx: number, by: number, x: number, y: number) => ctx.bezierCurveTo(X(v, ax), Y(v, ay), X(v, bx), Y(v, by), X(v, x), Y(v, y)),
    e: (x: number, y: number, rx: number, ry: number, rot = 0) => { ctx.moveTo(X(v, x + rx), Y(v, y)); ctx.ellipse(X(v, x), Y(v, y), rx * v.s, ry * v.s, rot, 0, Math.PI * 2); },
  };
}
const lw = (v: View, k = 1) => Math.max(1, v.s * 0.026 * k);
function ink(ctx: CanvasRenderingContext2D, v: View, fill: string | CanvasGradient, k = 1) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = lw(v, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
// Un tramo de brazo o pierna: un trazo grueso con borde.
function limb(ctx: CanvasRenderingContext2D, v: View, pts: [number, number][], width: number, color: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[width * v.s + lw(v) * 2, INK], [width * v.s, color]] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(v, x), Y(v, y)) : ctx.moveTo(X(v, x), Y(v, y))));
    ctx.stroke();
  }
}

// ---------- La oficina ----------
export function drawBackground(ctx: CanvasRenderingContext2D, v: View) {
  ctx.fillStyle = '#20160f'; ctx.fillRect(0, 0, v.w, v.h);
  if (images.bg) placed(ctx, v, images.bg, 0, 0);
  else { ctx.fillStyle = '#d8c9b0'; ctx.fillRect(X(v, 0), Y(v, TOP), W * v.s, VIEW_H * v.s); }
}

// Afuera: nubes que pasan, pájaros que vuelan, un avión cada tanto, y el reflejo del vidrio. Adentro, la luz
// que entra por la ventana.
export function drawWindow(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s, t = v.t, x1 = ix(518), x2 = ix(1000), y1 = iy(398), y2 = iy(62), mid1 = ix(750), mid2 = ix(768);
  ctx.save();
  ctx.beginPath(); ctx.rect(X(v, x1), Y(v, y2), (mid1 - x1) * s, (y2 - y1) * s); ctx.rect(X(v, mid2), Y(v, y2), (x2 - mid2) * s, (y2 - y1) * s); ctx.clip();
  // Nubes (arriba de los edificios).
  for (let i = 0; i < 4; i++) {
    const span = x2 - x1 + 2.4, cx = x1 - 1.2 + ((t * (0.08 + i * 0.025) + hash(i) * span) % span), cy = y2 - 0.35 - hash(i + 7) * 0.7;
    ctx.fillStyle = `rgba(255,255,255,${0.55 + hash(i + 2) * 0.3})`;
    ctx.beginPath();
    for (const [dx, dy, r] of [[-0.35, 0, 0.22], [0, 0.1, 0.3], [0.35, 0.02, 0.24], [0.12, -0.08, 0.22]]) ctx.ellipse(X(v, cx + dx), Y(v, cy + dy), r * s, r * 0.62 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pájaros aleteando.
  ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const span = x2 - x1 + 2, bx = x1 - 1 + ((t * (0.35 + i * 0.07) + i * 2.1) % span), by = y2 - 1.3 - i * 0.35 + Math.sin(t * 1.5 + i) * 0.12, flap = Math.sin(t * 9 + i * 2) * 0.07, w = 0.1;
    ctx.beginPath(); ctx.moveTo(X(v, bx - w), Y(v, by + flap)); ctx.quadraticCurveTo(X(v, bx - w / 2), Y(v, by + 0.03), X(v, bx), Y(v, by)); ctx.quadraticCurveTo(X(v, bx + w / 2), Y(v, by + 0.03), X(v, bx + w), Y(v, by + flap)); ctx.stroke();
  }
  // Un avión con su estela, cada 24 segundos.
  const k = (t % 24) / 9;
  if (k < 1) {
    const ax = x2 + 0.3 - k * (x2 - x1 + 0.6), ay = y2 - 0.25 - k * 0.15;
    const trail = ctx.createLinearGradient(X(v, ax), 0, X(v, ax + 2), 0);
    trail.addColorStop(0, 'rgba(255,255,255,0.8)'); trail.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = trail; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(X(v, ax + 0.1), Y(v, ay)); ctx.lineTo(X(v, ax + 2), Y(v, ay - 0.15)); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(X(v, ax), Y(v, ay), s * 0.09, s * 0.025, 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(X(v, ax - 0.01), Y(v, ay + 0.05), s * 0.04, s * 0.1);
  }
  // Reflejos en el vidrio.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (const [a, b] of [[0.6, 0.9], [1.1, 1.25], [3.2, 3.6], [3.8, 3.95]]) {
    ctx.beginPath(); ctx.moveTo(X(v, x1 + a), Y(v, y2)); ctx.lineTo(X(v, x1 + b), Y(v, y2)); ctx.lineTo(X(v, x1 + b - 1.6), Y(v, y1)); ctx.lineTo(X(v, x1 + a - 1.6), Y(v, y1)); ctx.fill();
  }
  ctx.restore();
  // La luz de la tarde que entra y cae en el piso.
  const light = ctx.createLinearGradient(0, Y(v, y1), 0, Y(v, BOTTOM));
  light.addColorStop(0, 'rgba(255,236,190,0.13)'); light.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = light; ctx.beginPath();
  ctx.moveTo(X(v, x1), Y(v, y1)); ctx.lineTo(X(v, x2), Y(v, y1)); ctx.lineTo(X(v, x2 - 2.2), Y(v, BOTTOM)); ctx.lineTo(X(v, x1 - 3.2), Y(v, BOTTOM)); ctx.fill();
}

// El reloj de la pared, con la hora de verdad y números grandes.
export function drawClock(ctx: CanvasRenderingContext2D, v: View, now: Date) {
  const s = v.s, cx = X(v, ix(1123)), cy = Y(v, iy(108)), r = s * 0.8;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(cx + s * 0.05, cy + s * 0.07, r, 0, Math.PI * 2); ctx.fill(); // sombra
  ctx.fillStyle = '#1f2328'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, '#4b5563'); rim.addColorStop(1, '#111827');
  ctx.strokeStyle = rim; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx.stroke();
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 0.86);
  face.addColorStop(0, '#ffffff'); face.addColorStop(1, '#e7e5e4');
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0, r1 = r * (big ? 0.74 : 0.79);
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = big ? Math.max(1.5, r * 0.035) : Math.max(0.6, r * 0.012);
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); ctx.lineTo(cx + Math.sin(a) * r * 0.83, cy - Math.cos(a) * r * 0.83); ctx.stroke();
  }
  ctx.fillStyle = '#111827'; ctx.font = `800 ${Math.max(7, Math.round(r * 0.24))}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) { const a = (n / 12) * Math.PI * 2; ctx.fillText(String(n), cx + Math.sin(a) * r * 0.56, cy - Math.cos(a) * r * 0.56 + r * 0.015); }
  const sec = now.getSeconds() + now.getMilliseconds() / 1000, min = now.getMinutes() + sec / 60, hour = (now.getHours() % 12) + min / 60;
  const hand = (turns: number, len: number, width: number, color: string, tail = 0.12) => {
    const a = turns * Math.PI * 2;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.sin(a) * r * tail, cy + Math.cos(a) * r * tail); ctx.lineTo(cx + Math.sin(a) * r * len, cy - Math.cos(a) * r * len); ctx.stroke();
  };
  hand(hour / 12, 0.42, Math.max(2.5, r * 0.08), '#111827');
  hand(min / 60, 0.66, Math.max(2, r * 0.055), '#111827');
  hand(sec / 60, 0.74, Math.max(1, r * 0.02), '#dc2626', 0.2);
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2); ctx.fill();
  // El brillo del vidrio.
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.45, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// El ventilador de pie: está a la izquierda cuando sopla para la derecha y a la derecha cuando sopla para la
// izquierda, con la cabeza girada para donde sopla. Las aspas giran (más rápido cuanto más sopla), las
// cintitas atadas a la reja flamean y se ve el aire cruzando la oficina.
const FAN_IMG = { x: 975, y: 328, cx: 78, cy: 84, neck: 160 }; // el recorte: dónde estaba y el centro de la cabeza
export const fanX = (f: Fan) => (f.dir > 0 ? 8.75 : ix(1053));
export function drawFan(ctx: CanvasRenderingContext2D, v: View, f: Fan) {
  const s = v.s, t = v.t, img = images.fan, d = f.dir;
  const fx = fanX(f), left = X(v, fx) - (FAN_IMG.cx / PX) * s, top = Y(v, iy(FAN_IMG.y)), k = s / PX;
  const cx = X(v, fx), cy = Y(v, iy(FAN_IMG.y + FAN_IMG.cy)), r = s * 0.74, turn = 0.6;
  if (img) {
    // El pie y el palo.
    const sy = FAN_IMG.neck;
    ctx.drawImage(img, 0, sy, img.naturalWidth, img.naturalHeight - sy, left, top + sy * k, img.naturalWidth * k, (img.naturalHeight - sy) * k);
    // El motor, atrás de la cabeza girada.
    const p = pen(ctx, v), mx = fx - d * 0.3, my = iy(FAN_IMG.y + FAN_IMG.cy);
    ctx.beginPath(); p.m(fx, my - 0.05); p.l(fx, my - 0.95); ctx.strokeStyle = INK; ctx.lineWidth = s * 0.16; ctx.stroke(); ctx.strokeStyle = '#2b3240'; ctx.lineWidth = s * 0.11; ctx.stroke();
    ctx.beginPath(); p.e(mx, my, 0.26, 0.3); ink(ctx, v, '#2b3240');
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); p.e(mx - 0.05, my + 0.1, 0.12, 0.08); ctx.fill();
    // La cabeza: el recorte achicado de costado (como si estuviera girada).
    ctx.save(); ctx.translate(cx + d * s * 0.05, cy); ctx.scale(turn, 1);
    ctx.drawImage(img, 0, 0, img.naturalWidth, sy, -FAN_IMG.cx * k, -FAN_IMG.cy * k, img.naturalWidth * k, sy * k);
    ctx.restore();
  }
  if (f.power) {
    ctx.save(); ctx.translate(cx + d * s * 0.05, cy); ctx.scale(turn, 1);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(196,188,172,0.92)'; ctx.fillRect(-r, -r, r * 2, r * 2); // tapa las aspas quietas
    const spin = t * (10 + f.power * 9);
    for (let trail = 3; trail >= 0; trail--) {
      ctx.fillStyle = `rgba(30,34,44,${trail ? 0.2 : 0.62})`;
      for (let i = 0; i < 3; i++) {
        const a = spin - trail * 0.12 + (i / 3) * Math.PI * 2;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(r * 0.25, -r * 0.35, r * 0.85, -r * 0.3, r * 0.88, 0); ctx.bezierCurveTo(r * 0.8, r * 0.22, r * 0.3, r * 0.2, 0, 0); ctx.fill();
        ctx.restore();
      }
    }
    // La reja.
    ctx.strokeStyle = 'rgba(20,22,28,0.85)'; ctx.lineWidth = Math.max(1, s * 0.015);
    for (const q of [0.3, 0.55, 0.8, 0.99]) { ctx.beginPath(); ctx.arc(0, 0, r * q, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
    ctx.fillStyle = '#1f2937'; ctx.strokeStyle = INK; ctx.lineWidth = lw(v); ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = lw(v, 1.4); ctx.beginPath(); ctx.ellipse(cx + d * s * 0.05, cy, r * turn, r, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Cintitas atadas adelante de la reja.
  for (let i = 0; i < 3; i++) {
    const x0 = cx + d * s * 0.12, y0 = cy + (i - 1) * r * 0.45, len = s * (0.35 + f.power * 0.25);
    const flap = Math.sin(t * (14 + f.power * 6) + i * 2) * s * 0.06 * Math.min(1, f.power);
    ctx.strokeStyle = ['#ef4444', '#facc15', '#22c55e'][i]; ctx.lineWidth = Math.max(2, s * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0);
    if (f.power) ctx.quadraticCurveTo(x0 + d * len * 0.5, y0 + flap, x0 + d * len, y0 - flap * 0.6 + s * 0.05);
    else ctx.quadraticCurveTo(x0 + d * s * 0.04, y0 + len * 0.5, x0 + d * s * 0.02, y0 + len * 0.8);
    ctx.stroke();
  }
  if (!f.power) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.16 + f.power * 0.08})`; ctx.lineWidth = Math.max(1, s * 0.022);
  for (let i = 0; i < 6 + f.power * 4; i++) {
    const q = (t * (0.3 + f.power * 0.25) + hash(i)) % 1, x = d > 0 ? fx + 0.6 + q * (15.6 - fx) : fx - 0.6 - q * (fx - 4.4), y = 0.2 + hash(i + 5) * 6, len = 0.6 + f.power * 0.3;
    ctx.globalAlpha = Math.sin(q * Math.PI);
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y)); ctx.quadraticCurveTo(X(v, x - d * len / 2), Y(v, y + 0.06), X(v, x - d * len), Y(v, y)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- El oficinista ----------
export const WORKER_X = 2.85;
export type Mood = 'normal' | 'happy' | 'sad';

// Las piernas abajo del escritorio, con zapatos de cuero marrón (se dibujan antes que el escritorio).
export function drawLegs(ctx: CanvasRenderingContext2D, v: View) {
  const p = pen(ctx, v);
  for (const side of [-1, 1]) {
    const kx = 3.2 + side * 0.36, ax = kx + side * 0.1;
    const g = ctx.createLinearGradient(X(v, kx - 0.22), 0, X(v, kx + 0.22), 0);
    g.addColorStop(0, SUIT_D); g.addColorStop(0.45, SUIT_L); g.addColorStop(1, SUIT_D);
    // La pierna (con la raya del pantalón, que se arruga un poco abajo) y la rodilla.
    ctx.beginPath(); p.m(kx - 0.21, 0.82); p.q(kx - 0.2, 0.3, ax - 0.15, -0.22); p.l(ax + 0.15, -0.22); p.q(kx + 0.2, 0.3, kx + 0.21, 0.82); ctx.closePath();
    ink(ctx, v, g);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = lw(v, 0.8); ctx.beginPath(); p.m(kx + side * 0.02, 0.72); p.l(ax + side * 0.01, -0.14); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); p.m(ax - 0.12, -0.12); p.q(ax, -0.08, ax + 0.12, -0.13); ctx.stroke();
    ctx.beginPath(); p.e(kx, 0.84, 0.24, 0.13); ink(ctx, v, g);
    // Media.
    ctx.fillStyle = '#111827'; ctx.fillRect(X(v, ax - 0.12), Y(v, -0.21), 0.24 * v.s, 0.07 * v.s);
    // Zapato: la puntera mirando un poco para afuera, cordones y el brillo del cuero.
    const tx = ax + side * 0.12;
    ctx.beginPath();
    p.m(ax - 0.17, -0.27); p.q(ax - 0.2, -0.47, tx - 0.05, -0.5); p.q(tx + side * 0.32 - 0.05, -0.52, tx + side * 0.26, -0.38);
    p.q(tx + side * 0.2, -0.27, ax + side * 0.16, -0.25); p.q(ax, -0.2, ax - 0.17, -0.27); ctx.closePath();
    const leather = ctx.createLinearGradient(0, Y(v, -0.22), 0, Y(v, -0.5));
    leather.addColorStop(0, '#8a5530'); leather.addColorStop(1, '#4a2914');
    ink(ctx, v, leather);
    ctx.strokeStyle = '#1c0f06'; ctx.lineWidth = lw(v, 1.6); ctx.beginPath(); p.m(ax - 0.19, -0.47); p.q(tx, -0.53, tx + side * 0.27, -0.42); ctx.stroke(); // la suela
    ctx.strokeStyle = '#e7d3b8'; ctx.lineWidth = lw(v, 0.7);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); p.m(ax - 0.06 + side * i * 0.03, -0.28 - i * 0.03); p.l(ax + 0.06 + side * i * 0.03, -0.3 - i * 0.03); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,230,200,0.4)'; ctx.beginPath(); p.e(tx + side * 0.12, -0.39, 0.07, 0.025, side * 0.2); ctx.fill();
  }
  // La sombra del escritorio.
  const shadow = ctx.createLinearGradient(0, Y(v, 0.95), 0, Y(v, 0.2));
  shadow.addColorStop(0, 'rgba(10,5,0,0.45)'); shadow.addColorStop(1, 'rgba(10,5,0,0)');
  ctx.fillStyle = shadow; ctx.fillRect(X(v, 2.45), Y(v, 0.95), 1.5 * v.s, 0.75 * v.s);
}

// El cuerpo y la cabeza: de traje oscuro, camisa blanca, corbata roja, anteojos y bien peinado (antes que el
// escritorio, así queda detrás). `look` es para dónde mira (x, y relativos).
export function drawWorker(ctx: CanvasRenderingContext2D, v: View, mood: Mood, look: { x: number; y: number }) {
  const p = pen(ctx, v), cx = WORKER_X;
  // Saco: hombros anchos, con la sombra de las mangas.
  ctx.beginPath();
  p.m(cx - 0.74, 1.8); p.l(cx - 0.8, 2.5); p.c(cx - 0.86, 2.98, cx - 0.74, 3.14, cx - 0.46, 3.18); p.l(cx - 0.15, 3.27); p.l(cx + 0.15, 3.27);
  p.l(cx + 0.46, 3.18); p.c(cx + 0.74, 3.14, cx + 0.86, 2.98, cx + 0.8, 2.5); p.l(cx + 0.74, 1.8); ctx.closePath();
  const jacket = ctx.createLinearGradient(X(v, cx - 0.86), Y(v, 3.27), X(v, cx + 0.86), Y(v, 1.8));
  jacket.addColorStop(0, SUIT_L); jacket.addColorStop(0.5, SUIT); jacket.addColorStop(1, SUIT_D);
  ink(ctx, v, jacket);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = lw(v, 0.9);
  for (const side of [-1, 1]) { ctx.beginPath(); p.m(cx + side * 0.5, 3.15); p.q(cx + side * 0.62, 2.8, cx + side * 0.6, 2.35); ctx.stroke(); } // costuras de las mangas
  // Camisa y corbata.
  ctx.beginPath(); p.m(cx - 0.17, 3.25); p.l(cx + 0.17, 3.25); p.l(cx, 2.42); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.7);
  ctx.beginPath(); p.m(cx - 0.055, 3.17); p.l(cx + 0.055, 3.17); p.l(cx + 0.04, 3.08); p.l(cx - 0.04, 3.08); ctx.closePath(); ink(ctx, v, '#991b1b', 0.7);
  ctx.beginPath(); p.m(cx - 0.04, 3.08); p.l(cx + 0.04, 3.08); p.l(cx + 0.07, 2.52); p.l(cx, 2.42); p.l(cx - 0.07, 2.52); ctx.closePath(); ink(ctx, v, '#b91c1c', 0.7);
  ctx.strokeStyle = 'rgba(254,202,202,0.4)'; ctx.lineWidth = lw(v, 0.6);
  for (let i = 0; i < 4; i++) { const y = 3.0 - i * 0.13; ctx.beginPath(); p.m(cx - 0.045, y); p.l(cx + 0.055, y - 0.05); ctx.stroke(); }
  // Solapas.
  for (const side of [-1, 1]) {
    ctx.beginPath(); p.m(cx + side * 0.17, 3.25); p.l(cx + side * 0.31, 3.13); p.l(cx + side * 0.27, 3.0); p.l(cx + side * 0.38, 2.95); p.l(cx + side * 0.07, 2.36); p.l(cx + side * 0.02, 2.42); ctx.closePath();
    ink(ctx, v, SUIT_D, 0.8);
  }
  ctx.beginPath(); p.m(cx + 0.44, 2.74); p.l(cx + 0.56, 2.74); p.l(cx + 0.53, 2.84); p.l(cx + 0.49, 2.78); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.6); // pañuelo
  ctx.fillStyle = '#0b0d10'; ctx.beginPath(); p.e(cx + 0.05, 2.2, 0.03, 0.03); ctx.fill(); // botón
  // Cuello.
  ctx.beginPath(); p.m(cx - 0.1, 3.2); p.l(cx - 0.1, 3.46); p.l(cx + 0.1, 3.46); p.l(cx + 0.1, 3.2); ctx.closePath(); ink(ctx, v, SKIN_D);
  ctx.beginPath(); p.m(cx - 0.15, 3.27); p.l(cx, 3.17); p.l(cx + 0.15, 3.27); p.l(cx + 0.11, 3.33); p.l(cx, 3.25); p.l(cx - 0.11, 3.33); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.6); // cuello de la camisa
  // La cabeza, un poco más chica que antes (para que las proporciones sean de una persona).
  ctx.save();
  const hk = 0.86;
  ctx.translate(X(v, cx), Y(v, 3.73)); ctx.scale(hk, hk); ctx.translate(-X(v, cx), -Y(v, 3.62));
  for (const side of [-1, 1]) { ctx.beginPath(); p.e(cx + side * 0.31, 3.6, 0.065, 0.1); ink(ctx, v, SKIN); }
  // Cara.
  ctx.beginPath(); p.m(cx - 0.31, 3.75); p.c(cx - 0.33, 3.45, cx - 0.2, 3.24, cx, 3.22); p.c(cx + 0.2, 3.24, cx + 0.33, 3.45, cx + 0.31, 3.75); p.c(cx + 0.3, 4.05, cx - 0.3, 4.05, cx - 0.31, 3.75); ctx.closePath();
  const face = ctx.createRadialGradient(X(v, cx - 0.1), Y(v, 3.7), v.s * 0.05, X(v, cx), Y(v, 3.6), v.s * 0.42);
  face.addColorStop(0, '#f8d5b4'); face.addColorStop(1, SKIN_D);
  ink(ctx, v, face);
  ctx.fillStyle = 'rgba(70,45,30,0.12)'; ctx.beginPath(); p.m(cx - 0.27, 3.47); p.c(cx - 0.2, 3.26, cx + 0.2, 3.26, cx + 0.27, 3.47); p.q(cx, 3.36, cx - 0.27, 3.47); ctx.fill(); // la barba afeitada
  ctx.fillStyle = 'rgba(239,120,100,0.18)'; for (const side of [-1, 1]) { ctx.beginPath(); p.e(cx + side * 0.19, 3.52, 0.06, 0.035); ctx.fill(); }
  // Pelo, con raya al costado y jopo.
  ctx.beginPath();
  p.m(cx - 0.33, 3.64); p.c(cx - 0.42, 4.02, cx - 0.24, 4.18, cx - 0.02, 4.17); p.c(cx + 0.24, 4.24, cx + 0.42, 4.08, cx + 0.34, 3.66);
  p.l(cx + 0.3, 3.7); p.c(cx + 0.27, 3.86, cx + 0.08, 3.92, cx - 0.12, 3.87); p.c(cx - 0.21, 3.85, cx - 0.27, 3.8, cx - 0.29, 3.62); ctx.closePath();
  const hair = ctx.createLinearGradient(0, Y(v, 4.15), 0, Y(v, 3.62));
  hair.addColorStop(0, '#4a2f1d'); hair.addColorStop(1, '#1f140c');
  ink(ctx, v, hair);
  ctx.strokeStyle = 'rgba(160,110,70,0.55)'; ctx.lineWidth = lw(v, 0.6);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); p.m(cx - 0.1 + i * 0.03, 4.08 - i * 0.02); p.q(cx + 0.1 + i * 0.04, 4.06 - i * 0.04, cx + 0.26 - i * 0.02, 3.86 + i * 0.02); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); p.m(cx - 0.13, 3.88); p.q(cx - 0.13, 4.0, cx - 0.06, 4.11); ctx.stroke(); // la raya
  // Cejas y ojos (miran para donde vas a tirar).
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = lw(v, 2.2);
  const brow = mood === 'sad' ? 0.03 : mood === 'happy' ? -0.01 : 0;
  for (const side of [-1, 1]) { ctx.beginPath(); p.m(cx + side * 0.22, 3.74 - brow); p.q(cx + side * 0.15, 3.79, cx + side * 0.06, 3.76 + brow); ctx.stroke(); }
  for (const side of [-1, 1]) {
    const ex = cx + side * 0.135, ey = 3.65;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); p.e(ex, ey, 0.055, mood === 'happy' ? 0.022 : 0.034); ctx.fill();
    ctx.fillStyle = '#3b2412'; ctx.beginPath(); p.e(ex + look.x * 0.022, ey + look.y * 0.012, 0.024, 0.024); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); p.e(ex + look.x * 0.022 + 0.008, ey + look.y * 0.012 + 0.008, 0.007, 0.007); ctx.fill();
  }
  // Anteojos.
  ctx.lineWidth = lw(v, 1.3); ctx.strokeStyle = '#111111';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(X(v, cx + side * 0.135 - 0.1), Y(v, 3.715), 0.2 * v.s, 0.14 * v.s, 0.035 * v.s);
    ctx.fillStyle = 'rgba(190,225,255,0.18)'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = lw(v, 0.7);
    ctx.beginPath(); p.m(cx + side * 0.135 - 0.06, 3.69); p.l(cx + side * 0.135 - 0.02, 3.7); ctx.stroke();
    ctx.strokeStyle = '#111111'; ctx.lineWidth = lw(v, 1.3);
    ctx.beginPath(); p.m(cx + side * 0.235, 3.68); p.l(cx + side * 0.31, 3.66); ctx.stroke(); // patillas
  }
  ctx.beginPath(); p.m(cx - 0.035, 3.67); p.q(cx, 3.7, cx + 0.035, 3.67); ctx.stroke();
  // Nariz y boca.
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = lw(v, 1.1);
  ctx.beginPath(); p.m(cx + 0.005, 3.6); p.q(cx + 0.05, 3.52, cx - 0.025, 3.5); ctx.stroke();
  if (mood === 'happy') {
    ctx.beginPath(); p.m(cx - 0.11, 3.43); p.q(cx, 3.3, cx + 0.11, 3.43); ctx.closePath(); ink(ctx, v, '#7f1d1d', 0.8);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); p.m(cx - 0.09, 3.42); p.l(cx + 0.09, 3.42); p.l(cx + 0.075, 3.395); p.l(cx - 0.075, 3.395); ctx.fill();
  } else {
    ctx.strokeStyle = '#7c3b2a'; ctx.lineWidth = lw(v, 1.2); ctx.beginPath();
    if (mood === 'sad') { p.m(cx - 0.08, 3.37); p.q(cx, 3.42, cx + 0.08, 3.37); } else { p.m(cx - 0.08, 3.41); p.q(cx, 3.36, cx + 0.09, 3.42); }
    ctx.stroke();
  }
  ctx.restore();
}

// Las cosas que agregué al escritorio: la lámpara, la placa con el nombre del puesto, el sticker de la
// notebook y el humito del café. Van después del escritorio.
export function drawDeskExtras(ctx: CanvasRenderingContext2D, v: View) {
  const p = pen(ctx, v), s = v.s, t = v.t;
  if (images.desk) placed(ctx, v, images.desk, 30, 400);
  // Lámpara de escritorio con pantalla verde.
  ctx.fillStyle = 'rgba(255,230,160,0.16)'; ctx.beginPath(); p.m(1.25, 3.22); p.l(1.62, 3.12); p.l(2.15, 2.15); p.l(0.95, 2.15); ctx.closePath(); ctx.fill();
  limb(ctx, v, [[0.82, 1.98], [0.66, 2.92], [1.2, 3.34]], 0.06, '#27272a');
  ctx.beginPath(); p.e(0.82, 1.95, 0.24, 0.07); ink(ctx, v, '#27272a');
  ctx.beginPath(); p.m(1.06, 3.42); p.l(1.36, 3.5); p.l(1.72, 3.1); p.l(1.18, 2.96); ctx.closePath();
  const shade = ctx.createLinearGradient(X(v, 1.1), Y(v, 3.45), X(v, 1.6), Y(v, 3.0));
  shade.addColorStop(0, '#22c55e'); shade.addColorStop(1, '#14532d');
  ink(ctx, v, shade);
  ctx.fillStyle = '#fef9c3'; ctx.beginPath(); p.e(1.45, 3.03, 0.12, 0.045, -0.45); ctx.fill();
  // La placa del puesto.
  ctx.beginPath(); ctx.moveTo(X(v, 5.95), Y(v, 1.62)); ctx.lineTo(X(v, 7.35), Y(v, 1.62)); ctx.lineTo(X(v, 7.3), Y(v, 1.7)); ctx.lineTo(X(v, 6), Y(v, 1.7)); ctx.closePath(); ink(ctx, v, '#3f2a1a');
  const brass = ctx.createLinearGradient(0, Y(v, 1.95), 0, Y(v, 1.7));
  brass.addColorStop(0, '#fde68a'); brass.addColorStop(0.5, '#d4a24c'); brass.addColorStop(1, '#a16207');
  ctx.beginPath(); ctx.rect(X(v, 6.05), Y(v, 1.95), 1.2 * s, 0.25 * s); ink(ctx, v, brass);
  ctx.fillStyle = '#3b2412'; ctx.font = `900 ${Math.max(5, Math.round(s * 0.1))}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GERENTE DE BOLLOS', X(v, 6.65), Y(v, 1.825));
  // Sticker de tiburón en la notebook.
  ctx.beginPath(); p.e(4.05, 2.6, 0.13, 0.13); ink(ctx, v, '#0ea5e9', 0.8);
  ctx.beginPath(); p.m(3.94, 2.55); p.q(4.02, 2.62, 4.05, 2.73); p.q(4.08, 2.62, 4.16, 2.55); ctx.closePath(); ctx.fillStyle = '#e2e8f0'; ctx.fill();
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = lw(v, 0.8); ctx.beginPath(); p.m(3.94, 2.54); p.q(4.0, 2.57, 4.05, 2.54); p.q(4.1, 2.51, 4.16, 2.54); ctx.stroke();
  // El humito del café.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1, s * 0.025);
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1, x = ix(468) + (i - 1) * 0.07, y = iy(452) + k * 0.6;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    ctx.beginPath(); p.m(x, y); p.q(x + 0.08 * Math.sin(t * 3 + i), y + 0.1, x, y + 0.2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Una mano de costado: la palma y los cuatro dedos estirados para `angle`, con el pulgar del lado de `thumb`.
function drawFlatHand(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, angle: number, thumb: 1 | -1) {
  const s = v.s;
  ctx.save(); ctx.translate(X(v, x), Y(v, y)); ctx.rotate(-angle); ctx.scale(s * 1.35, s * 1.35);
  const k = lw(v) / (s * 1.35);
  const piece = (draw: () => void, fill: string) => { ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = k; ctx.lineJoin = 'round'; ctx.stroke(); };
  for (let i = 0; i < 4; i++) { // dedos
    const fy = -0.05 + i * 0.033, len = [0.11, 0.13, 0.125, 0.1][i];
    piece(() => ctx.roundRect(0.07, fy - 0.017, len, 0.034, 0.017), i % 2 ? SKIN : '#ecbd95');
  }
  piece(() => ctx.ellipse(0.03, -0.008, 0.075, 0.068, 0, 0, Math.PI * 2), SKIN); // palma
  piece(() => { ctx.save(); ctx.translate(0.05, thumb * 0.06); ctx.rotate(thumb * 0.5); ctx.roundRect(0, -0.018, 0.08, 0.036, 0.018); ctx.restore(); }, SKIN); // pulgar
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = k * 0.6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.075, -0.033 + i * 0.033); ctx.lineTo(0.095, -0.033 + i * 0.033); ctx.stroke(); } // nudillos
  ctx.restore();
}

// Los brazos: el de la izquierda apoyado en el escritorio, el de la derecha tirando (la mano en `hand`).
export function drawArms(ctx: CanvasRenderingContext2D, v: View, hand: { x: number; y: number }) {
  const cx = WORKER_X, p = pen(ctx, v);
  // Apoyado, con la mano sobre las hojas.
  limb(ctx, v, [[cx - 0.66, 2.98], [cx - 0.93, 2.24], [cx - 0.36, 2.0]], 0.28, SUIT);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = lw(v, 0.8); ctx.beginPath(); p.m(cx - 0.98, 2.3); p.q(cx - 0.88, 2.22, cx - 0.8, 2.3); ctx.stroke(); // arruga del codo
  limb(ctx, v, [[cx - 0.4, 2.0], [cx - 0.3, 1.99]], 0.22, '#f8fafc');
  drawFlatHand(ctx, v, cx - 0.24, 1.99, -0.05, 1);
  // El que tira: hombro, codo (sale para afuera) y mano.
  const sx = cx + 0.66, sy = 2.98, L1 = 0.74, L2 = 0.68;
  let dx = hand.x - sx, dy = hand.y - sy, d = Math.hypot(dx, dy);
  if (d > L1 + L2 - 0.01) { const k = (L1 + L2 - 0.01) / d; dx *= k; dy *= k; d = L1 + L2 - 0.01; }
  const hx = sx + dx, hy = sy + dy;
  const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const e1 = { x: sx + Math.cos(a - b) * L1, y: sy + Math.sin(a - b) * L1 }, e2 = { x: sx + Math.cos(a + b) * L1, y: sy + Math.sin(a + b) * L1 };
  const el = e1.x > e2.x ? e1 : e2;
  const fx = hx - (hx - el.x) * 0.2, fy = hy - (hy - el.y) * 0.2;
  limb(ctx, v, [[sx, sy], [el.x, el.y], [fx, fy]], 0.28, SUIT);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = v.s * 0.08; ctx.beginPath(); ctx.moveTo(X(v, sx), Y(v, sy + 0.05)); ctx.lineTo(X(v, el.x - 0.04), Y(v, el.y + 0.05)); ctx.stroke();
  limb(ctx, v, [[fx, fy], [hx - (hx - el.x) * 0.1, hy - (hy - el.y) * 0.1]], 0.22, '#f8fafc');
  // La palma (atrás del bollo).
  ctx.beginPath(); p.e(hx, hy + 0.02, 0.12, 0.12); ink(ctx, v, SKIN);
  return { x: hx, y: hy };
}
// Los dedos que agarran el bollo (van encima) y el pulgar del otro lado.
export function drawFingers(ctx: CanvasRenderingContext2D, v: View, hand: { x: number; y: number }, ball: { x: number; y: number }) {
  const s = v.s;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.75 + i * 0.14), r = BALL_R * 0.85;
    const x = ball.x + Math.cos(a) * r, y = ball.y + Math.sin(a) * r * -1;
    ctx.save(); ctx.translate(X(v, x), Y(v, y)); ctx.rotate(-a + Math.PI / 2);
    ctx.beginPath(); ctx.roundRect(-s * 0.025, -s * 0.06, s * 0.05, s * 0.11, s * 0.025); ink(ctx, v, i % 2 ? SKIN : '#ecbd95', 0.8);
    ctx.restore();
  }
  ctx.save(); ctx.translate(X(v, ball.x + BALL_R * 0.9), Y(v, ball.y - 0.02)); ctx.rotate(-0.4);
  ctx.beginPath(); ctx.roundRect(-s * 0.028, -s * 0.07, s * 0.056, s * 0.12, s * 0.028); ink(ctx, v, SKIN, 0.8);
  ctx.restore();
  void hand;
}

// ---------- El cesto y los bollos ----------
export function drawBin(ctx: CanvasRenderingContext2D, v: View, b: Bin) {
  const img = images.bin, s = v.s;
  // La sombra en el piso.
  ctx.fillStyle = 'rgba(30,15,5,0.35)'; ctx.beginPath(); ctx.ellipse(X(v, b.x + 0.08), Y(v, b.y + 0.02), s * 0.8, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  if (b.vx) { // rueditas
    ctx.fillStyle = '#111827'; for (const dx of [-0.52, 0.52]) { ctx.beginPath(); ctx.arc(X(v, b.x + dx), Y(v, b.y - 0.03), s * 0.09, 0, Math.PI * 2); ctx.fill(); }
  }
  if (!img) { ctx.fillStyle = '#374151'; ctx.fillRect(X(v, b.x - b.w / 2), Y(v, b.y + BIN_H), b.w * s, BIN_H * s); return; }
  const w = (img.naturalWidth / PX) * BIN_SCALE, h = (img.naturalHeight / PX) * BIN_SCALE, top = b.y + b.h + (7 / PX) * BIN_SCALE;
  ctx.drawImage(img, X(v, b.x - w / 2), Y(v, top), w * s, h * s);
}

// Un bollo de papel arrugado (gira mientras vuela).
export function drawPaper(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, angle: number, seed: number) {
  const s = v.s, r = BALL_R * s;
  ctx.save(); ctx.translate(X(v, x), Y(v, y)); ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, rr = r * (0.84 + hash(i + seed * 3) * 0.3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e5e7eb'); g.addColorStop(1, '#a8b0bc');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke();
  ctx.strokeStyle = 'rgba(148,163,184,0.7)'; ctx.lineWidth = Math.max(0.5, s * 0.01);
  ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.2); ctx.lineTo(r * 0.05, r * 0.12); ctx.lineTo(r * 0.45, -r * 0.42); ctx.moveTo(-r * 0.25, r * 0.55); ctx.lineTo(r * 0.2, r * 0.18); ctx.lineTo(r * 0.55, r * 0.3); ctx.moveTo(-r * 0.1, -r * 0.6); ctx.lineTo(-r * 0.05, -r * 0.1); ctx.stroke();
  ctx.fillStyle = 'rgba(37,99,235,0.45)'; ctx.fillRect(-r * 0.45, r * 0.25, r * 0.5, Math.max(1, s * 0.012)); // algo escrito
  ctx.restore();
}

// Un poco de sombra en los bordes, como una foto.
export function drawVignette(ctx: CanvasRenderingContext2D, v: View) {
  const cx = X(v, W / 2), cy = Y(v, (TOP + BOTTOM) / 2), r = Math.hypot(W, VIEW_H) * v.s * 0.55;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  g.addColorStop(0, 'rgba(20,10,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(X(v, 0), Y(v, TOP), W * v.s, VIEW_H * v.s);
}

