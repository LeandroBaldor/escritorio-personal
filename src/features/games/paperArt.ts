// Los dibujos de "¡Al cesto!": la oficina es una ilustración (fondo, el escritorio de adelante y el cesto de
// alambre) y encima se dibujan las cosas que se mueven: el oficinista de traje, el jefe, el reloj con la hora
// de verdad, el ventilador girando, lo que pasa afuera de la ventana y los bollos.
import binUrl from './assets/oficina-cesto.webp';
import deskUrl from './assets/oficina-escritorio.webp';
import bgUrl from './assets/oficina-fondo.webp';
import { BALL_R, BIN_H, BOSS_H, BOTTOM, TOP, W, type Bin, type Boss, type Fan } from './paperBall';

// La oficina entra entera en la pantalla, centrada. La ilustración mide 1360 × 762 píxeles: 85 por unidad.
export interface View { w: number; h: number; s: number; ox: number; oy: number; t: number }
export const VIEW_H = TOP - BOTTOM;
export const X = (v: View, x: number) => v.ox + x * v.s;
export const Y = (v: View, y: number) => v.oy + (TOP - y) * v.s;
const PX = 85, ix = (px: number) => px / PX, iy = (py: number) => (650 - py) / PX; // de píxeles del dibujo a unidades
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const INK = '#141414', SKIN = '#f1c6a0', SKIN_D = '#d39c76', SUIT = '#25334f', SUIT_D = '#18213a', SUIT_L = '#3a4d78';

// ---------- Las imágenes ----------
const images: { bg?: HTMLImageElement; desk?: HTMLImageElement; bin?: HTMLImageElement } = {};
let started = false;
export function loadOffice(onLoad: () => void) {
  if (started || typeof Image === 'undefined') return;
  started = true;
  for (const [key, url] of [['bg', bgUrl], ['desk', deskUrl], ['bin', binUrl]] as const) {
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

// El ventilador de la ilustración: las aspas giran (más rápido cuanto más sopla), las cintitas atadas a la reja
// muestran para dónde sopla y se ve el aire cruzando la oficina.
export const FAN_AT = { x: ix(1053), y: iy(412) };
export function drawFan(ctx: CanvasRenderingContext2D, v: View, f: Fan) {
  const s = v.s, t = v.t, cx = X(v, FAN_AT.x), cy = Y(v, FAN_AT.y), r = s * 0.74;
  if (f.power) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(196,188,172,0.92)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); // tapa las aspas quietas
    const spin = t * (10 + f.power * 9);
    for (let trail = 3; trail >= 0; trail--) {
      ctx.fillStyle = `rgba(30,34,44,${trail ? 0.2 : 0.62})`;
      for (let i = 0; i < 3; i++) {
        const a = spin - trail * 0.12 + (i / 3) * Math.PI * 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(r * 0.25, -r * 0.35, r * 0.85, -r * 0.3, r * 0.88, 0); ctx.bezierCurveTo(r * 0.8, r * 0.22, r * 0.3, r * 0.2, 0, 0); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    // La reja.
    ctx.strokeStyle = 'rgba(20,22,28,0.85)'; ctx.lineWidth = Math.max(1, s * 0.015);
    for (const k of [0.3, 0.55, 0.8, 1]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
    ctx.fillStyle = '#1f2937'; ctx.strokeStyle = INK; ctx.lineWidth = lw(v); ctx.beginPath(); ctx.arc(cx, cy, r * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx - r * 0.05, cy - r * 0.05, r * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  // Cintitas.
  const side = f.power ? f.dir : 1;
  for (let i = 0; i < 3; i++) {
    const a = (-0.35 + i * 0.35), x0 = cx + side * Math.cos(a) * r, y0 = cy + Math.sin(a) * r, len = s * (0.35 + f.power * 0.25);
    const flap = Math.sin(t * (14 + f.power * 6) + i * 2) * s * 0.06 * Math.min(1, f.power);
    ctx.strokeStyle = ['#ef4444', '#facc15', '#22c55e'][i]; ctx.lineWidth = Math.max(2, s * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0);
    if (f.power) ctx.quadraticCurveTo(x0 + side * len * 0.5, y0 + flap, x0 + side * len, y0 - flap * 0.6 + s * 0.05);
    else ctx.quadraticCurveTo(x0 + s * 0.04, y0 + len * 0.5, x0 + s * 0.02, y0 + len * 0.8);
    ctx.stroke();
  }
  if (!f.power) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.16 + f.power * 0.08})`; ctx.lineWidth = Math.max(1, s * 0.022);
  for (let i = 0; i < 6 + f.power * 4; i++) {
    const k = (t * (0.3 + f.power * 0.25) + hash(i)) % 1, x = f.dir > 0 ? 4.6 + k * 11 : 15.4 - k * 11, y = 0.6 + hash(i + 5) * 6, len = 0.6 + f.power * 0.3;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y)); ctx.quadraticCurveTo(X(v, x - f.dir * len / 2), Y(v, y + 0.06), X(v, x - f.dir * len), Y(v, y)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- El oficinista ----------
export const WORKER_X = 2.85;
export type Mood = 'normal' | 'happy' | 'sad';

// Las piernas abajo del escritorio (se dibujan antes que el escritorio).
export function drawLegs(ctx: CanvasRenderingContext2D, v: View) {
  const p = pen(ctx, v);
  for (const side of [-1, 1]) {
    const kx = 3.2 + side * 0.33, ax = kx + side * 0.08;
    const g = ctx.createLinearGradient(X(v, kx - 0.2), 0, X(v, kx + 0.2), 0);
    g.addColorStop(0, SUIT_D); g.addColorStop(0.45, SUIT_L); g.addColorStop(1, SUIT_D);
    // La pierna (con la raya del pantalón) y la rodilla, que asoma sobre la silla.
    ctx.beginPath(); p.m(kx - 0.19, 0.8); p.q(kx - 0.17, 0.3, ax - 0.13, -0.24); p.l(ax + 0.13, -0.24); p.q(kx + 0.18, 0.3, kx + 0.19, 0.8); ctx.closePath();
    ink(ctx, v, g);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = lw(v, 0.8); ctx.beginPath(); p.m(kx + side * 0.02, 0.72); p.l(ax + side * 0.01, -0.2); ctx.stroke();
    ctx.beginPath(); p.e(kx, 0.82, 0.22, 0.13); ink(ctx, v, g);
    // Media y zapato lustrado.
    ctx.fillStyle = '#111827'; ctx.fillRect(X(v, ax - 0.11), Y(v, -0.23), 0.22 * v.s, 0.07 * v.s);
    ctx.beginPath(); p.m(ax - 0.15, -0.26); p.q(ax - 0.17, -0.42, ax + side * 0.05, -0.43); p.q(ax + side * 0.27, -0.42, ax + side * 0.24, -0.33); p.q(ax + side * 0.1, -0.26, ax + 0.15 * side, -0.24); ctx.closePath();
    ink(ctx, v, '#1c1917');
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); p.e(ax + side * 0.08, -0.33, 0.06, 0.022); ctx.fill();
  }
  // La sombra del escritorio.
  const shadow = ctx.createLinearGradient(0, Y(v, 0.95), 0, Y(v, 0.2));
  shadow.addColorStop(0, 'rgba(10,5,0,0.45)'); shadow.addColorStop(1, 'rgba(10,5,0,0)');
  ctx.fillStyle = shadow; ctx.fillRect(X(v, 2.5), Y(v, 0.95), 1.4 * v.s, 0.75 * v.s);
}

// El cuerpo y la cabeza: de traje azul, camisa blanca, corbata roja, anteojos y bien peinado (antes que el
// escritorio, así queda detrás). `look` es para dónde mira (x, y relativos).
export function drawWorker(ctx: CanvasRenderingContext2D, v: View, mood: Mood, look: { x: number; y: number }) {
  const p = pen(ctx, v), cx = WORKER_X;
  // Saco.
  ctx.beginPath();
  p.m(cx - 0.74, 1.8); p.l(cx - 0.76, 2.6); p.q(cx - 0.74, 2.96, cx - 0.42, 3.02); p.l(cx - 0.16, 3.1); p.l(cx + 0.16, 3.1); p.l(cx + 0.42, 3.02); p.q(cx + 0.74, 2.96, cx + 0.76, 2.6); p.l(cx + 0.74, 1.8); ctx.closePath();
  const jacket = ctx.createLinearGradient(X(v, cx - 0.76), Y(v, 3.1), X(v, cx + 0.76), Y(v, 1.8));
  jacket.addColorStop(0, SUIT_L); jacket.addColorStop(0.5, SUIT); jacket.addColorStop(1, SUIT_D);
  ink(ctx, v, jacket);
  // Camisa y corbata.
  ctx.beginPath(); p.m(cx - 0.19, 3.08); p.l(cx + 0.19, 3.08); p.l(cx, 2.3); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.7);
  ctx.beginPath(); p.m(cx - 0.06, 3.02); p.l(cx + 0.06, 3.02); p.l(cx + 0.045, 2.93); p.l(cx - 0.045, 2.93); ctx.closePath(); ink(ctx, v, '#991b1b', 0.7);
  ctx.beginPath(); p.m(cx - 0.045, 2.93); p.l(cx + 0.045, 2.93); p.l(cx + 0.075, 2.42); p.l(cx, 2.32); p.l(cx - 0.075, 2.42); ctx.closePath(); ink(ctx, v, '#b91c1c', 0.7);
  ctx.strokeStyle = 'rgba(254,202,202,0.55)'; ctx.lineWidth = lw(v, 0.6);
  for (let i = 0; i < 4; i++) { const y = 2.85 - i * 0.13; ctx.beginPath(); p.m(cx - 0.05, y); p.l(cx + 0.06, y - 0.06); ctx.stroke(); }
  // Solapas.
  for (const side of [-1, 1]) {
    ctx.beginPath(); p.m(cx + side * 0.19, 3.08); p.l(cx + side * 0.3, 2.98); p.l(cx + side * 0.25, 2.86); p.l(cx + side * 0.33, 2.82); p.l(cx + side * 0.06, 2.25); p.l(cx + side * 0.02, 2.3); ctx.closePath();
    ink(ctx, v, SUIT_D, 0.8);
  }
  ctx.beginPath(); p.m(cx + 0.38, 2.62); p.l(cx + 0.47, 2.62); p.l(cx + 0.44, 2.71); p.l(cx + 0.41, 2.66); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.6); // pañuelo
  ctx.fillStyle = '#0b1222'; ctx.beginPath(); p.e(cx + 0.05, 2.12, 0.03, 0.03); ctx.fill(); // botón
  // Cuello y orejas.
  ctx.beginPath(); p.m(cx - 0.12, 3.06); p.l(cx - 0.12, 3.32); p.l(cx + 0.12, 3.32); p.l(cx + 0.12, 3.06); ctx.closePath(); ink(ctx, v, SKIN_D);
  ctx.beginPath(); p.m(cx - 0.17, 3.12); p.l(cx, 3.02); p.l(cx + 0.17, 3.12); p.l(cx + 0.12, 3.17); p.l(cx, 3.1); p.l(cx - 0.12, 3.17); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.6); // cuello de la camisa
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
  p.m(cx - 0.33, 3.64); p.c(cx - 0.4, 3.98, cx - 0.24, 4.13, cx - 0.04, 4.12); p.c(cx + 0.2, 4.16, cx + 0.4, 4.04, cx + 0.34, 3.66);
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

// Los brazos: el de la izquierda apoyado en el escritorio, el de la derecha tirando (la mano en `hand`).
export function drawArms(ctx: CanvasRenderingContext2D, v: View, hand: { x: number; y: number }) {
  const cx = WORKER_X, p = pen(ctx, v);
  // Apoyado, con la mano sobre las hojas.
  limb(ctx, v, [[cx - 0.6, 2.82], [cx - 0.82, 2.18], [cx - 0.3, 1.98]], 0.27, SUIT);
  limb(ctx, v, [[cx - 0.33, 1.99], [cx - 0.25, 1.97]], 0.2, '#f8fafc');
  ctx.beginPath(); p.e(cx - 0.12, 1.97, 0.13, 0.075); ink(ctx, v, SKIN);
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = lw(v, 0.7);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); p.m(cx - 0.06 + i * 0.03, 2.02); p.l(cx - 0.02 + i * 0.03, 1.93); ctx.stroke(); }
  // El que tira: hombro, codo (sale para afuera) y mano.
  const sx = cx + 0.6, sy = 2.82, L1 = 0.64, L2 = 0.6;
  let dx = hand.x - sx, dy = hand.y - sy, d = Math.hypot(dx, dy);
  if (d > L1 + L2 - 0.01) { const k = (L1 + L2 - 0.01) / d; dx *= k; dy *= k; d = L1 + L2 - 0.01; }
  const hx = sx + dx, hy = sy + dy;
  const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const e1 = { x: sx + Math.cos(a - b) * L1, y: sy + Math.sin(a - b) * L1 }, e2 = { x: sx + Math.cos(a + b) * L1, y: sy + Math.sin(a + b) * L1 };
  const el = e1.x > e2.x ? e1 : e2;
  const fx = hx - (hx - el.x) * 0.16, fy = hy - (hy - el.y) * 0.16;
  limb(ctx, v, [[sx, sy], [el.x, el.y], [fx, fy]], 0.27, SUIT);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = v.s * 0.08; ctx.beginPath(); ctx.moveTo(X(v, sx), Y(v, sy + 0.05)); ctx.lineTo(X(v, el.x - 0.04), Y(v, el.y + 0.05)); ctx.stroke();
  limb(ctx, v, [[fx, fy], [hx - (hx - el.x) * 0.08, hy - (hy - el.y) * 0.08]], 0.21, '#f8fafc');
  ctx.beginPath(); p.e(hx, hy, 0.12, 0.12); ink(ctx, v, SKIN);
  return { x: hx, y: hy };
}
// Los dedos encima del bollo (para que se vea agarrado).
export function drawFingers(ctx: CanvasRenderingContext2D, v: View, hand: { x: number; y: number }) {
  const p = pen(ctx, v);
  ctx.beginPath(); p.e(hand.x - 0.08, hand.y + 0.06, 0.06, 0.05); ink(ctx, v, SKIN, 0.8);
  ctx.beginPath(); p.e(hand.x + 0.09, hand.y + 0.03, 0.05, 0.065); ink(ctx, v, SKIN, 0.8);
}

// ---------- El cesto, los bollos y el jefe ----------
export function drawBin(ctx: CanvasRenderingContext2D, v: View, b: Bin) {
  const img = images.bin, s = v.s;
  // La sombra en el piso.
  ctx.fillStyle = 'rgba(30,15,5,0.3)'; ctx.beginPath(); ctx.ellipse(X(v, b.x + 0.06), Y(v, b.y + 0.02), s * 0.6, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  if (b.vx) { // rueditas
    ctx.fillStyle = '#111827'; for (const dx of [-0.4, 0.4]) { ctx.beginPath(); ctx.arc(X(v, b.x + dx), Y(v, b.y - 0.02), s * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
  if (!img) { ctx.fillStyle = '#374151'; ctx.fillRect(X(v, b.x - b.w / 2), Y(v, b.y + BIN_H), b.w * s, BIN_H * s); return; }
  const w = img.naturalWidth / PX, h = img.naturalHeight / PX, top = b.y + b.h + 7 / PX;
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

// El jefe, de traje gris y con su café, cruzando la oficina (se pone rojo si le pegás).
export function drawBoss(ctx: CanvasRenderingContext2D, v: View, p: Boss, time: number) {
  const s = v.s, t = v.t, x = p.x, mad = p.hit > time, d = p.dir, walk = Math.sin(t * 7), pn = pen(ctx, v), y0 = -0.3, H = BOSS_H;
  const bob = Math.abs(Math.cos(t * 7)) * 0.04;
  ctx.fillStyle = 'rgba(30,15,5,0.3)'; ctx.beginPath(); ctx.ellipse(X(v, x), Y(v, y0 - 0.02), s * 0.65, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  // Piernas caminando.
  for (const k of [-1, 1]) {
    const sw = walk * k * 0.25;
    limb(ctx, v, [[x + k * 0.17, y0 + 2.05 + bob], [x + k * 0.17 + sw * 0.5, y0 + 1.0], [x + k * 0.17 + sw, y0 + 0.12]], 0.3, '#52525b');
    ctx.beginPath(); pn.e(x + k * 0.17 + sw + d * 0.1, y0 + 0.07, 0.2, 0.08); ink(ctx, v, '#1c1917');
  }
  // Brazo de atrás balanceándose.
  limb(ctx, v, [[x - d * 0.45, y0 + 3.45 + bob], [x - d * 0.55 - walk * 0.15, y0 + 2.75], [x - d * 0.5 - walk * 0.3, y0 + 2.15]], 0.24, '#3f3f46');
  ctx.beginPath(); pn.e(x - d * 0.5 - walk * 0.3, y0 + 2.08, 0.1, 0.1); ink(ctx, v, SKIN);
  // Saco con panza.
  ctx.beginPath();
  pn.m(x - 0.55, y0 + 3.5 + bob); pn.q(x - 0.68, y0 + 2.6, x - 0.55, y0 + 1.95); pn.l(x + 0.55, y0 + 1.95); pn.q(x + 0.72, y0 + 2.6, x + 0.55, y0 + 3.5 + bob); pn.q(x, y0 + 3.62 + bob, x - 0.55, y0 + 3.5 + bob); ctx.closePath();
  const jacket = ctx.createLinearGradient(X(v, x - 0.6), 0, X(v, x + 0.6), 0);
  jacket.addColorStop(0, '#71717a'); jacket.addColorStop(0.5, '#52525b'); jacket.addColorStop(1, '#3f3f46');
  ink(ctx, v, jacket);
  ctx.beginPath(); pn.m(x - 0.16, y0 + 3.55 + bob); pn.l(x + 0.16, y0 + 3.55 + bob); pn.l(x, y0 + 2.6); ctx.closePath(); ink(ctx, v, '#f8fafc', 0.7);
  ctx.beginPath(); pn.m(x - 0.04, y0 + 3.48 + bob); pn.l(x + 0.04, y0 + 3.48 + bob); pn.l(x + 0.07, y0 + 2.75); pn.l(x, y0 + 2.62); pn.l(x - 0.07, y0 + 2.75); ctx.closePath(); ink(ctx, v, '#1e3a8a', 0.7);
  ctx.fillStyle = '#18181b'; for (const by of [2.45, 2.15]) { ctx.beginPath(); pn.e(x + 0.04, y0 + by, 0.035, 0.035); ctx.fill(); }
  // Cabeza: pelado, con canas a los costados, bigote y cejas.
  const hx = x + d * 0.04, hy = y0 + H - 0.4 + bob;
  for (const k of [-1, 1]) { ctx.beginPath(); pn.e(hx + k * 0.32, hy, 0.07, 0.1); ink(ctx, v, mad ? '#f87171' : SKIN); }
  ctx.beginPath(); pn.e(hx, hy, 0.32, 0.4); ink(ctx, v, mad ? '#f87171' : SKIN);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); pn.e(hx - 0.1, hy + 0.25, 0.1, 0.05, -0.3); ctx.fill(); // el brillo de la pelada
  for (const k of [-1, 1]) { ctx.beginPath(); pn.m(hx + k * 0.31, hy + 0.12); pn.q(hx + k * 0.36, hy - 0.05, hx + k * 0.28, hy - 0.15); pn.l(hx + k * 0.25, hy + 0.08); ctx.closePath(); ink(ctx, v, '#d4d4d8', 0.7); }
  ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = lw(v, 2.4);
  for (const k of [-1, 1]) { ctx.beginPath(); pn.m(hx + d * 0.05 + k * 0.2, hy + 0.12 + (mad ? k * d * 0.04 : 0)); pn.l(hx + d * 0.05 + k * 0.06, hy + 0.1 - (mad ? 0.03 : 0)); ctx.stroke(); }
  ctx.fillStyle = INK; for (const k of [-1, 1]) { ctx.beginPath(); pn.e(hx + d * 0.06 + k * 0.13, hy + 0.02, 0.03, 0.035); ctx.fill(); }
  ctx.beginPath(); pn.m(hx + d * 0.04 - 0.17, hy - 0.2); pn.q(hx + d * 0.04, hy - 0.08, hx + d * 0.04 + 0.17, hy - 0.2); pn.q(hx + d * 0.04, hy - 0.15, hx + d * 0.04 - 0.17, hy - 0.2); ink(ctx, v, '#71717a', 0.8); // bigote
  ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = lw(v, 1.2); ctx.beginPath(); pn.m(hx + d * 0.04 - 0.07, hy - 0.27); pn.q(hx + d * 0.04, hy - (mad ? 0.23 : 0.3), hx + d * 0.04 + 0.07, hy - 0.27); ctx.stroke();
  // Brazo de adelante con la taza de café.
  const mx = x + d * 0.75, my = y0 + 2.7 + bob;
  limb(ctx, v, [[x + d * 0.45, y0 + 3.45 + bob], [x + d * 0.62, y0 + 2.65], [mx - d * 0.05, my]], 0.24, '#52525b');
  ctx.beginPath(); ctx.rect(X(v, mx - 0.1), Y(v, my + 0.3), 0.22 * s, 0.3 * s); ink(ctx, v, '#f8fafc', 0.8);
  ctx.beginPath(); pn.e(mx, my + 0.05, 0.1, 0.1); ink(ctx, v, SKIN);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, s * 0.02);
  for (let i = 0; i < 2; i++) { const k = (t * 0.7 + i * 0.5) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); pn.m(mx + i * 0.06 - 0.02, my + 0.35 + k * 0.3); pn.q(mx + 0.06, my + 0.45 + k * 0.3, mx + i * 0.06 - 0.02, my + 0.55 + k * 0.3); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (mad) {
    ctx.font = `900 ${Math.round(s * 0.5)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.strokeText('¡EY!', X(v, x), Y(v, y0 + H + 0.35)); ctx.fillStyle = '#ef4444'; ctx.fillText('¡EY!', X(v, x), Y(v, y0 + H + 0.35));
  }
}

// Un poco de sombra en los bordes, como una foto.
export function drawVignette(ctx: CanvasRenderingContext2D, v: View) {
  const cx = X(v, W / 2), cy = Y(v, (TOP + BOTTOM) / 2), r = Math.hypot(W, VIEW_H) * v.s * 0.55;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  g.addColorStop(0, 'rgba(20,10,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(X(v, 0), Y(v, TOP), W * v.s, VIEW_H * v.s);
}

