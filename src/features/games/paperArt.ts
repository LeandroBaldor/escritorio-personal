// Los dibujos de "SkynetBall": la oficina de Skynet es una ilustración, y encima se dibujan las cosas que se
// mueven: los autos voladores que pasan por la ventana, el reloj con la hora de verdad, el ventilador, el
// tacho de alambre, el T-800 (quieto con el próximo humano en la mano o tirando), los humanos y la sangre.
import human1Url from './assets/humano-1.webp';
import human2Url from './assets/humano-2.webp';
import human3Url from './assets/humano-3.webp';
import human4Url from './assets/humano-4.webp';
import readyUrl from './assets/t800-listo.webp';
import throwUrl from './assets/t800-tira.webp';
import bgUrl from './assets/terminator-oficina.webp';
import { BALL_R, BOTTOM, fanX, FLOOR_PX, PX, TOP, W, type Ball, type Bin, type Fan } from './paperBall';

export interface View { w: number; h: number; s: number; ox: number; oy: number; t: number }
export const VIEW_H = TOP - BOTTOM;
export const X = (v: View, x: number) => v.ox + x * v.s;
export const Y = (v: View, y: number) => v.oy + (TOP - y) * v.s;
const ix = (px: number) => px / PX, iy = (py: number) => (FLOOR_PX - py) / PX; // de píxeles del dibujo a unidades
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = '#07060a', NEON = '#ff2a2a';

// ---------- Las imágenes ----------
const images: { bg?: HTMLImageElement; ready?: HTMLImageElement; throw?: HTMLImageElement } = {};
const humans: HTMLImageElement[] = []; // el pibe de remera verde, el oficinista, la chica de vestido amarillo y la ejecutiva
let started = false;
export function loadOffice(onLoad: () => void) {
  if (started || typeof Image === 'undefined') return;
  started = true;
  for (const [key, url] of [['bg', bgUrl], ['ready', readyUrl], ['throw', throwUrl]] as const) {
    const img = new Image();
    img.onload = () => { images[key] = img; onLoad(); };
    img.src = url;
  }
  [human1Url, human2Url, human3Url, human4Url].forEach((url, i) => {
    const img = new Image();
    img.onload = () => { humans[i] = img; onLoad(); };
    img.src = url;
  });
}

// ---------- La oficina ----------
export function drawBackground(ctx: CanvasRenderingContext2D, v: View) {
  ctx.fillStyle = '#0b0910'; ctx.fillRect(0, 0, v.w, v.h);
  if (images.bg) ctx.drawImage(images.bg, X(v, 0), Y(v, TOP), W * v.s, VIEW_H * v.s);
}

// Por la ventana pasan autos voladores con sus luces y titilan las luces rojas de los edificios.
export function drawWindow(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s, t = v.t, x1 = ix(612), x2 = ix(1240), y1 = iy(545), y2 = iy(142), mid1 = ix(913), mid2 = ix(935);
  ctx.save();
  ctx.beginPath(); ctx.rect(X(v, x1), Y(v, y2), (mid1 - x1) * s, (y2 - y1) * s); ctx.rect(X(v, mid2), Y(v, y2), (x2 - mid2) * s, (y2 - y1) * s); ctx.clip();
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1, speed = 0.5 + hash(i) * 0.9, span = x2 - x1 + 1.2, size = 0.11 + hash(i + 3) * 0.08;
    const k = (t * speed + hash(i + 9) * span) % span, x = dir > 0 ? x1 - 0.6 + k : x2 + 0.6 - k, y = y2 - 0.5 - hash(i + 5) * 2.4 + Math.sin(t * 1.3 + i) * 0.04;
    ctx.fillStyle = '#121019'; ctx.beginPath(); ctx.ellipse(X(v, x), Y(v, y), size * s, size * 0.32 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.ellipse(X(v, x), Y(v, y + size * 0.18), size * 0.5 * s, size * 0.22 * s, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dir > 0 ? '#e0f2fe' : '#ff3b3b'; ctx.beginPath(); ctx.arc(X(v, x + dir * size * 0.9), Y(v, y), Math.max(1, s * 0.018), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dir > 0 ? '#ff3b3b' : '#e0f2fe'; ctx.beginPath(); ctx.arc(X(v, x - dir * size * 0.9), Y(v, y), Math.max(1, s * 0.014), 0, Math.PI * 2); ctx.fill();
    // El brillo de los motores, abajo.
    ctx.fillStyle = `rgba(56,189,248,${0.35 + 0.25 * Math.sin(t * 12 + i)})`; ctx.beginPath(); ctx.ellipse(X(v, x), Y(v, y - size * 0.32), size * 0.45 * s, size * 0.1 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Luces de aviso arriba de los edificios.
  for (let i = 0; i < 9; i++) {
    const x = x1 + 0.2 + hash(i + 20) * (x2 - x1 - 0.4), y = y2 - 0.3 - hash(i + 30) * 1.8, on = Math.sin(t * 2.2 + i * 1.7) > 0.4;
    if (!on) continue;
    ctx.fillStyle = 'rgba(255,40,40,0.9)'; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), Math.max(1, s * 0.02), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), s * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// El reloj de la pared, ahora digital: la hora de verdad en hh:mm:ss con números rojos de neón (detrás, los
// segmentos apagados, como en un display de verdad).
export function drawClock(ctx: CanvasRenderingContext2D, v: View, now: Date) {
  const s = v.s, cx = X(v, ix(1399)), cy = Y(v, iy(179)), r = s * 0.72;
  ctx.save();
  ctx.fillStyle = '#050407'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); // tapa la cara con agujas
  const two = (n: number) => String(n).padStart(2, '0');
  const text = `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
  ctx.font = `700 ${s * 0.3}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fit = Math.min(1, (s * 1.22) / ctx.measureText('88:88:88').width);
  ctx.font = `700 ${s * 0.3 * fit}px "Courier New", monospace`;
  ctx.fillStyle = 'rgba(255,42,42,0.12)'; ctx.fillText('88:88:88', cx, cy);
  ctx.shadowColor = NEON; ctx.shadowBlur = s * 0.12; ctx.fillStyle = '#ff3b3b'; ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,120,120,0.7)'; ctx.font = `700 ${s * 0.09}px "Courier New", monospace`;
  ctx.fillText('SKYNET', cx, cy - s * 0.3); ctx.fillText(now.getSeconds() % 2 ? '● REC' : 'REC', cx, cy + s * 0.3);
  ctx.restore();
}

// El ventilador de pie, negro con detalles rojos, como el de la foto: a la izquierda sopla para la derecha y
// a la derecha sopla para la izquierda, con la cabeza girada para donde sopla. Las aspas giran, las cintitas
// flamean y se ve el aire cruzando la oficina.
export function drawFan(ctx: CanvasRenderingContext2D, v: View, f: Fan) {
  if (!f.dir) return;
  const s = v.s, t = v.t, d = f.dir, fx = fanX(f), base = 0.25, head = 3.15, r = 0.62, turn = 0.62;
  const P = (x: number, y: number) => [X(v, x), Y(v, y)] as const;
  ctx.save();
  // Sombra y reflejo rojo en el piso.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(...P(fx, base - 0.05), s * 0.6, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // La base.
  const g = ctx.createLinearGradient(0, Y(v, base + 0.15), 0, Y(v, base - 0.12));
  g.addColorStop(0, '#2a2a33'); g.addColorStop(1, '#09090c');
  ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath(); ctx.ellipse(...P(fx, base), s * 0.5, s * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,42,42,0.55)'; ctx.beginPath(); ctx.ellipse(...P(fx, base), s * 0.5, s * 0.13, 0, 0.1, Math.PI - 0.1); ctx.stroke();
  // El palo, con los botones.
  ctx.fillStyle = '#121218'; ctx.fillRect(X(v, fx - 0.07), Y(v, head - 0.4), s * 0.14, (head - 0.4 - base) * s);
  ctx.fillStyle = '#1f1f27'; ctx.fillRect(X(v, fx - 0.11), Y(v, 2.3), s * 0.22, s * 0.8);
  ctx.strokeStyle = INK; ctx.strokeRect(X(v, fx - 0.11), Y(v, 2.3), s * 0.22, s * 0.8);
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(...P(fx, 2.15), s * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e5e7eb'; for (const y of [1.98, 1.84]) { ctx.beginPath(); ctx.arc(...P(fx, y), s * 0.022, 0, Math.PI * 2); ctx.fill(); }
  // El motor, atrás de la cabeza.
  ctx.fillStyle = '#14141a'; ctx.beginPath(); ctx.ellipse(...P(fx - d * 0.22, head), s * 0.24, s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // La cabeza (girada: se ve angosta).
  const [cx, cy] = P(fx + d * 0.05, head);
  ctx.translate(cx, cy); ctx.scale(turn, 1);
  ctx.fillStyle = 'rgba(10,10,14,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r * s, 0, Math.PI * 2); ctx.fill();
  const spin = t * (10 + f.power * 5);
  for (let trail = 3; trail >= 0; trail--) {
    ctx.fillStyle = trail ? 'rgba(120,20,24,0.25)' : 'rgba(150,18,22,0.85)';
    for (let i = 0; i < 5; i++) {
      const a = spin - trail * 0.1 + (i / 5) * Math.PI * 2, rr = r * s;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(rr * 0.25, -rr * 0.3, rr * 0.8, -rr * 0.28, rr * 0.86, 0); ctx.bezierCurveTo(rr * 0.75, rr * 0.18, rr * 0.3, rr * 0.16, 0, 0); ctx.fill();
      ctx.restore();
    }
  }
  ctx.strokeStyle = '#0b0b0f'; ctx.lineWidth = Math.max(1, s * 0.018);
  for (const q of [0.35, 0.6, 0.82, 1]) { ctx.beginPath(); ctx.arc(0, 0, r * s * q, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * s * 0.2, Math.sin(a) * r * s * 0.2); ctx.lineTo(Math.cos(a) * r * s, Math.sin(a) * r * s); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,42,42,0.5)'; ctx.lineWidth = Math.max(1, s * 0.015); ctx.beginPath(); ctx.arc(0, 0, r * s * 0.98, -1.2, 0.6); ctx.stroke();
  ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.ellipse(0, 0, r * s * 0.3, r * s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = NEON; ctx.beginPath(); ctx.ellipse(0, 0, r * s * 0.18, r * s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Cintitas atadas adelante de la reja.
  for (let i = 0; i < 3; i++) {
    const x0 = cx + d * s * 0.1, y0 = cy + (i - 1) * r * s * 0.45, len = s * (0.45 + f.power * 0.1);
    const flap = Math.sin(t * (14 + f.power * 4) + i * 2) * s * 0.06;
    ctx.strokeStyle = ['#ff2a2a', '#f8fafc', '#ff2a2a'][i]; ctx.lineWidth = Math.max(2, s * 0.035); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + d * len * 0.5, y0 + flap, x0 + d * len, y0 - flap * 0.6 + s * 0.05); ctx.stroke();
  }
  // El aire cruzando la oficina.
  ctx.strokeStyle = 'rgba(200,220,255,0.28)'; ctx.lineWidth = Math.max(1, s * 0.02);
  for (let i = 0; i < 14; i++) {
    const q = (t * (0.35 + f.power * 0.08) + hash(i)) % 1, x = d > 0 ? fx + 0.7 + q * (W - 0.5 - fx) : fx - 0.7 - q * (fx - 5.2), y = 0.4 + hash(i + 5) * 6.5, len = 0.5 + f.power * 0.15;
    ctx.globalAlpha = Math.sin(q * Math.PI);
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y)); ctx.quadraticCurveTo(X(v, x - d * len / 2), Y(v, y + 0.06), X(v, x - d * len), Y(v, y)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- El T-800 ----------
// Las dos fotos están alineadas: miden lo mismo y se ponen en el mismo lugar (la silla queda quieta).
const ROBOT = { x: -0.1, top: iy(335), w: 5.45, h: 5.6 };
export function drawRobot(ctx: CanvasRenderingContext2D, v: View, throwing: boolean) {
  const img = throwing ? images.throw : images.ready;
  if (!img) return;
  ctx.drawImage(img, X(v, ROBOT.x), Y(v, ROBOT.top), ROBOT.w * v.s, ROBOT.h * v.s);
}
// Los ojos rojos que brillan (más cuando tira).
export function drawEyes(ctx: CanvasRenderingContext2D, v: View, throwing: boolean, pulse: number) {
  const eye = throwing ? { x: 1.94, y: iy(413) } : { x: 1.57, y: iy(396) };
  const r = v.s * (0.16 + 0.05 * pulse);
  const g = ctx.createRadialGradient(X(v, eye.x), Y(v, eye.y), 0, X(v, eye.x), Y(v, eye.y), r);
  g.addColorStop(0, 'rgba(255,60,60,0.55)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(v, eye.x), Y(v, eye.y), r, 0, Math.PI * 2); ctx.fill();
}

// ---------- El tacho de alambre ----------
// Atrás: el borde de atrás y el fondo oscuro (lo de adentro se dibuja entre medio).
export function drawBinBack(ctx: CanvasRenderingContext2D, v: View, b: Bin) {
  const s = v.s, half = b.w / 2, top = b.y + b.h, bh = half * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(X(v, b.x + 0.06), Y(v, b.y), s * (half + 0.15), s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(8,6,12,0.82)';
  ctx.beginPath(); ctx.moveTo(X(v, b.x - half), Y(v, top)); ctx.lineTo(X(v, b.x + half), Y(v, top)); ctx.lineTo(X(v, b.x + bh), Y(v, b.y)); ctx.lineTo(X(v, b.x - bh), Y(v, b.y)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, top), half * s, 0.13 * s, 0, Math.PI, Math.PI * 2); ctx.stroke();
}
// Adelante: la malla de alambre, los aros y el borde de adelante con el reflejo rojo del neón.
export function drawBinFront(ctx: CanvasRenderingContext2D, v: View, b: Bin) {
  const s = v.s, half = b.w / 2, top = b.y + b.h, bh = half * 0.8;
  const at = (k: number, side: number) => b.x + side * (bh + (half - bh) * k); // el costado a la altura k (0 abajo, 1 arriba)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(X(v, at(1, -1)), Y(v, top)); ctx.lineTo(X(v, at(1, 1)), Y(v, top)); ctx.lineTo(X(v, at(0, 1)), Y(v, b.y)); ctx.lineTo(X(v, at(0, -1)), Y(v, b.y)); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = '#17161c'; ctx.lineWidth = Math.max(1, s * 0.022);
  for (let i = -8; i <= 8; i++) {
    for (const dir of [-1, 1]) {
      const x0 = b.x + i * 0.17;
      ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, top)); ctx.lineTo(X(v, x0 + dir * 0.55), Y(v, b.y)); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,60,60,0.22)'; ctx.lineWidth = Math.max(1, s * 0.012);
  for (let i = -8; i <= 8; i++) { const x0 = b.x + i * 0.17 + 0.02; ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, top)); ctx.lineTo(X(v, x0 + 0.55), Y(v, b.y)); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#111016'; ctx.lineWidth = Math.max(1.5, s * 0.045);
  for (const k of [0.33, 0.66]) { const y = b.y + b.h * k, hw = (at(k, 1) - at(k, -1)) / 2; ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, y), hw * s, 0.1 * s, 0, 0, Math.PI); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(X(v, at(1, -1)), Y(v, top)); ctx.lineTo(X(v, at(0, -1)), Y(v, b.y)); ctx.moveTo(X(v, at(1, 1)), Y(v, top)); ctx.lineTo(X(v, at(0, 1)), Y(v, b.y)); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, b.y), bh * s, 0.09 * s, 0, 0, Math.PI); ctx.stroke();
  // El aro de arriba, con el brillo rojo.
  ctx.strokeStyle = '#1d1c24'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, top), half * s, 0.13 * s, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,50,50,0.75)'; ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, top - 0.01), half * s, 0.13 * s, 0, 0.25, Math.PI - 0.25); ctx.stroke();
}

// ---------- Los humanos ----------
// Se van alternando las 4 personas: cada humano usa la de su número.
export const HUMANS = 4;
export const kindOf = (id: number) => ((id % HUMANS) + HUMANS) % HUMANS;
// Un humano en miniatura cayendo. `angle` en radianes; `flat` lo aplasta contra el piso.
export function drawHuman(ctx: CanvasRenderingContext2D, v: View, kind: number, x: number, y: number, angle: number, flip = false, flat = 0) {
  const img = humans[kindOf(kind)], s = v.s, size = 0.9 * s;
  ctx.save(); ctx.translate(X(v, x), Y(v, y)); ctx.rotate(angle);
  ctx.scale((flip ? -1 : 1) * (1 + flat * 0.3), 1 - flat * 0.55);
  if (img) { const k = size / Math.max(img.naturalWidth, img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
  else { ctx.fillStyle = '#1e3a8a'; ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2); }
  ctx.restore();
}

// El próximo humano, agarrado en el puño del T-800 (pataleando un poco).
export function drawHeld(ctx: CanvasRenderingContext2D, v: View, kind: number, t: number) {
  drawHuman(ctx, v, kind, 3.3, 4.9, -0.35 + Math.sin(t * 9) * 0.06, true);
}

// Los humanos que ya entraron, amontonados en el tacho (asoman cabezas y brazos).
export function drawLoad(ctx: CanvasRenderingContext2D, v: View, b: Bin) {
  const n = Math.min(7, b.load);
  for (let i = 0; i < n; i++) {
    const dx = (hash(i + 40) - 0.5) * b.w * 0.5, dy = 0.4 + Math.min(i, 4) * 0.16 + hash(i + 50) * 0.1;
    drawHuman(ctx, v, i + 1, b.x + dx, b.y + dy, (hash(i + 60) - 0.5) * 2.4, hash(i) > 0.5);
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, v: View, k: Ball, now: number) {
  if (k.state === 'out' && k.done) {
    // Hecho puré en el piso.
    ctx.globalAlpha = Math.max(0, Math.min(1, 4 - (now - k.done)));
    drawHuman(ctx, v, k.id, k.x, BALL_R * 0.4, 0.15 * (k.id % 2 ? 1 : -1), k.id % 2 === 0, 0.6);
    ctx.globalAlpha = 1;
    return;
  }
  drawHuman(ctx, v, k.id, k.x, k.y, k.angle, k.vx < 0);
}

// ---------- La sangre ----------
export interface Drop { x: number; y: number; vx: number; vy: number; r: number; life: number }
export interface Stain { x: number; y: number; r: number; at: number; kind: 'pool' | 'wall' | 'dot'; seed: number }

// Las salpicaduras de un golpe: gotas que salen volando para el lado contrario a la superficie.
export function burst(drops: Drop[], x: number, y: number, vx: number, vy: number, surface: 'floor' | 'wall' | 'ceiling', hard: number, rand: () => number) {
  const n = Math.round(30 + hard * 50);
  for (let i = 0; i < n; i++) {
    const sp = (2 + rand() * 7) * (0.5 + hard);
    let a = rand() * Math.PI;
    if (surface === 'wall') a = (vx > 0 ? Math.PI / 2 : -Math.PI / 2) + (rand() - 0.5) * Math.PI;
    if (surface === 'ceiling') a = Math.PI + rand() * Math.PI;
    drops.push({ x, y: y + 0.05, vx: Math.cos(a) * sp + vx * 0.15 * (surface === 'floor' ? 1 : -0.3), vy: Math.sin(a) * sp * (surface === 'floor' ? 0.9 : 1), r: 0.015 + rand() * 0.04, life: 0 });
  }
}
export function stepDrops(drops: Drop[], stains: Stain[], dt: number, now: number) {
  for (const d of drops) {
    d.life += dt; d.vy -= 14 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.y <= 0.02) { stains.push({ x: d.x, y: (Math.random() - 0.5) * 0.5, r: d.r * 2.2, at: now, kind: 'dot', seed: Math.random() }); d.y = -1; }
    else if (d.x <= 0.05 || d.x >= W - 0.05) { stains.push({ x: Math.max(0.05, Math.min(W - 0.05, d.x)), y: d.y, r: d.r * 1.5, at: now, kind: 'dot', seed: Math.random() }); d.y = -1; }
  }
  return drops.filter(d => d.y > 0 && d.life < 3);
}

const BLOOD = '#8a0303', BLOOD_L = '#c1121f';
export function drawStains(ctx: CanvasRenderingContext2D, v: View, stains: Stain[], now: number) {
  const s = v.s;
  for (const st of stains) {
    const age = now - st.at, alpha = Math.max(0, Math.min(1, (25 - age) / 5));
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    if (st.kind === 'pool') {
      const grow = Math.min(1, 0.3 + age * 1.4), r = st.r * grow;
      ctx.fillStyle = BLOOD; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, rr = r * (0.75 + hash(st.seed * 50 + i) * 0.5); ctx.lineTo(X(v, st.x + Math.cos(a) * rr), Y(v, st.y + Math.sin(a) * rr * 0.22)); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,90,0.35)'; ctx.beginPath(); ctx.ellipse(X(v, st.x - r * 0.25), Y(v, st.y + r * 0.04), r * 0.3 * s, r * 0.05 * s, 0, 0, Math.PI * 2); ctx.fill();
    } else if (st.kind === 'wall') {
      ctx.fillStyle = BLOOD_L; ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = st.r * (i % 2 ? 0.45 : 0.8 + hash(st.seed * 70 + i) * 0.6); ctx.lineTo(X(v, st.x + Math.cos(a) * rr * 0.35), Y(v, st.y + Math.sin(a) * rr)); }
      ctx.closePath(); ctx.fill();
      // Chorreando para abajo.
      ctx.strokeStyle = BLOOD; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const dx = (hash(st.seed * 9 + i) - 0.5) * st.r * 0.5, len = Math.min(st.y - 0.05, (0.3 + hash(st.seed * 3 + i) * 1.2) * Math.min(1, age / 3));
        ctx.lineWidth = Math.max(1, s * (0.02 + hash(i + st.seed) * 0.02));
        ctx.beginPath(); ctx.moveTo(X(v, st.x + dx), Y(v, st.y)); ctx.lineTo(X(v, st.x + dx), Y(v, st.y - len)); ctx.stroke();
      }
    } else {
      ctx.fillStyle = BLOOD; ctx.beginPath(); ctx.ellipse(X(v, st.x), Y(v, st.y), st.r * s, st.r * s * (st.y < 0.3 ? 0.35 : 1), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
export function drawDrops(ctx: CanvasRenderingContext2D, v: View, drops: Drop[]) {
  ctx.fillStyle = BLOOD_L;
  for (const d of drops) { ctx.beginPath(); ctx.arc(X(v, d.x), Y(v, d.y), Math.max(1, d.r * v.s), 0, Math.PI * 2); ctx.fill(); }
}

// Un poco de sombra roja en los bordes.
export function drawVignette(ctx: CanvasRenderingContext2D, v: View) {
  const cx = X(v, W / 2), cy = Y(v, (TOP + BOTTOM) / 2), r = Math.hypot(W, VIEW_H) * v.s * 0.55;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  g.addColorStop(0, 'rgba(20,0,0,0)'); g.addColorStop(1, 'rgba(20,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(X(v, 0), Y(v, TOP), W * v.s, VIEW_H * v.s);
}
