// Los vampiros nuevos de Vampyium2, dibujados como los otros (estilo Kombat Football: el mismo esqueleto, sombreado
// con volumen y contorno negro). En metros, con los pies en (0, 0), mirando a la derecha y "arriba" negativo.
//  · Vampiro gigante: pelado, piel lila grisácea, ojos rojos, la boca abierta con colmillos, armadura negra con
//    hombreras con pinches, puños enormes con muñequeras negras y capa roja rota.
//  · Vampiro mago: capucha negra con forro rojo, túnica larga, báculo con una bola roja que arde.
//  · Vampiro martillo: pelo negro en punta, barba, armadura negra y un martillo de guerra enorme con pinches.
//  · Vampiro guerrero: igual de armado, con una espada de hoja roja y un escudo negro con la cruz roja.
//  · Hombre lobo: pelaje negro y lila con brillos rojos, hocico abierto, garras, cola y un taparrabos rojo roto.
//  · Drácula: armadura carmesí con gemas, capa negra, pelo con un mechón blanco, orejas en punta y barba.
//  · Drácula dragón: dragón rojo con alas enormes, cuernos, panza clara y garras.
import { alpha, bloom, darken, lighten, segment, shade, spec } from './gravityMonsters';
import {
  TAU, add, armDraw, cape, dirv, grad, handOf, legDraw, pauldron, setLimb, shoulderAt,
  vampEye, vampHead, walkerPose, type Look, type Pose, type Pt,
} from './vampyium2Chars';
import type { Shot, Vamp } from './vampyium2';
import { drawVampHD } from './vampyium2Vamps';

const INK = '#0b0709';
const GIANT: Look = { armor: '#1d1a21', dark: '#17141b', trim: '#c41a26', strap: '#6a3b22', boot: '#141217', cape: '#c0121c', capeD: '#3a0408', skin: '#a08eae', sleeve: '#a08eae' };
const MAGE: Look = { armor: '#1b1620', dark: '#120e15', trim: '#d0182a', strap: '#6a3b22', boot: '#18141c', cape: '#c0121c', capeD: '#3a0408', skin: '#b9a6d2', sleeve: '#1d1822' };
const KNIGHT: Look = { armor: '#221e27', dark: '#17141b', trim: '#c4c8d2', strap: '#6a3b22', boot: '#17141b', cape: '#c8121e', capeD: '#4a050b', skin: '#c8b4e0', sleeve: '#26222c' };
const DRAC: Look = { armor: '#a3121c', dark: '#5c0910', trim: '#4a4452', strap: '#3a0a10', boot: '#8e0f18', cape: '#1a141e', capeD: '#050306', skin: '#d6b9ec', sleeve: '#8e0f18' };

const neckOf = (hip: Pt, pose: Pose, len = 0.52): Pt => [hip[0] + Math.sin(pose.lean) * len, hip[1] - Math.cos(pose.lean) * len];
const shadow = (ctx: CanvasRenderingContext2D, v: Vamp, r: number) => { if (v.onGround) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02, r, 0.09, 0, 0, TAU); ctx.fill(); } };
// El destello blanco cuando lo golpean: dibuja el vampiro en un lienzo aparte, lo pinta de blanco y lo pega encima con poca opacidad.
// (Antes usaba ctx.filter, que con tantos detalles trababa el juego varios segundos cada vez que se le pegaba a uno fuerte.)
let flashCanvas: HTMLCanvasElement | null = null;
function hitFlash(ctx: CanvasRenderingContext2D, v: Vamp, draw: (c: CanvasRenderingContext2D) => void) {
  draw(ctx);
  const f = v.flash ?? 0, main = ctx.canvas;
  if (f <= 0 || typeof document === 'undefined' || !(main instanceof HTMLCanvasElement)) return;
  // la zona de la pantalla que ocupa (una caja holgada alrededor del cuerpo)
  const m = ctx.getTransform(); let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [lx, ly] of [[-6, -8], [6, -8], [-6, 2], [6, 2]]) { const px = m.a * lx + m.c * ly + m.e, py = m.b * lx + m.d * ly + m.f; x1 = Math.min(x1, px); x2 = Math.max(x2, px); y1 = Math.min(y1, py); y2 = Math.max(y2, py); }
  x1 = Math.max(0, Math.floor(x1)); y1 = Math.max(0, Math.floor(y1)); x2 = Math.min(main.width, Math.ceil(x2)); y2 = Math.min(main.height, Math.ceil(y2));
  const w = x2 - x1, h = y2 - y1; if (w <= 0 || h <= 0) return;
  flashCanvas ??= document.createElement('canvas');
  if (flashCanvas.width < w) flashCanvas.width = w;
  if (flashCanvas.height < h) flashCanvas.height = h;
  const fc = flashCanvas.getContext('2d'); if (!fc) return;
  fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalAlpha = 1; fc.globalCompositeOperation = 'source-over'; fc.clearRect(0, 0, w, h);
  fc.save(); fc.setTransform(m.a, m.b, m.c, m.d, m.e - x1, m.f - y1); draw(fc); fc.restore();
  fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalAlpha = 1; fc.globalCompositeOperation = 'source-in'; fc.fillStyle = '#fff'; fc.fillRect(0, 0, w, h);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(0.75, f * 5); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(flashCanvas, 0, 0, w, h, x1, y1, w, h); ctx.restore();
}
// Una gema roja tallada con brillo.
function gem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frame = '#c4c8d2', t = 0) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = frame; ctx.beginPath(); ctx.moveTo(0, -r * 1.35); ctx.lineTo(r * 1.35, 0); ctx.lineTo(0, r * 1.35); ctx.lineTo(-r * 1.35, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = r * 0.25; ctx.stroke();
  ctx.fillStyle = grad(ctx, -r, -r, r, r, [[0, '#ff8a8a'], [0.45, '#e3142a'], [1, '#6a0010']]); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.35, -r * 0.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, r * 3, '#ff2a40', 0.3 + 0.15 * Math.sin(t * 3 + x * 9)); ctx.restore();
  ctx.restore();
}
// Hombrera con pinches de plata.
function spikedPauldron(ctx: CanvasRenderingContext2D, sp: Pt, big: number, back: boolean, base = '#24202a', rim = '#a9aeba') {
  const c = back ? darken(base, 0.4) : base, rx = 0.3 * big, ry = 0.24 * big;
  for (const [ox, h] of [[-0.12, 0.34], [0.1, 0.42], [0.27, 0.3]] as const) { // los conos
    const bx = sp[0] + ox * big, by = sp[1] - ry * 0.7;
    ctx.beginPath(); ctx.moveTo(bx - 0.07 * big, by + 0.04); ctx.lineTo(bx + 0.02 * big, by - h * big); ctx.lineTo(bx + 0.08 * big, by + 0.04); ctx.closePath();
    ctx.fillStyle = grad(ctx, bx - 0.07 * big, 0, bx + 0.08 * big, 0, [[0, back ? '#4a4c55' : '#6c6f7b'], [0.45, back ? '#8e919b' : '#eef0f6'], [1, back ? '#3a3c44' : '#5b5e69']]); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.025; ctx.stroke();
  }
  shade(ctx, () => ctx.ellipse(sp[0], sp[1], rx, ry, -0.2, 0, TAU), c, { x: sp[0] - 0.08, y: sp[1] - 0.1, r: rx * 1.3, hi: 0.5, lw: 0.8 });
  ctx.strokeStyle = back ? darken(rim, 0.4) : rim; ctx.lineWidth = 0.04 * big; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], rx - 0.03, ry - 0.03, -0.2, Math.PI + 0.15, TAU - 0.15); ctx.stroke(); // borde de plata arriba
  if (!back) spec(ctx, sp[0] - 0.08 * big, sp[1] - 0.1 * big, 0.1 * big, 0.05 * big, -0.4, 0.7);
}
// Muñequera negra con pinchitos (va sobre el antebrazo).
const bracer = (ctx: CanvasRenderingContext2D, hand: Pt, ang: number, w: number, back: boolean) => {
  const d = dirv(ang), a = add(hand, d, -0.34), b = add(hand, d, -0.08);
  segment(ctx, a, b, w, w * 1.05, back ? '#0e0c11' : '#211d26', 0.6);
  for (const k of [0.3, 0.7]) { const m: Pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; segment(ctx, add(m, d, -0.015), add(m, d, 0.015), w * 1.08, w * 1.08, back ? '#55585f' : '#b9bdc9', 0.6); }
};

// ---------------------------------------------------------------- Vampiro gigante
function giantHead(ctx: CanvasRenderingContext2D, t: number, roar: boolean) {
  const skin = GIANT.skin;
  shade(ctx, () => ctx.ellipse(-0.27, 0.02, 0.08, 0.11, 0, 0, TAU), skin, { x: -0.29, y: 0, r: 0.1, lw: 0.8 }); // oreja
  const face = () => { ctx.moveTo(-0.3, -0.05); ctx.quadraticCurveTo(-0.36, -0.5, 0.04, -0.52); ctx.quadraticCurveTo(0.4, -0.5, 0.4, -0.12); ctx.quadraticCurveTo(0.44, 0.22, 0.24, 0.36); ctx.quadraticCurveTo(0.0, 0.44, -0.18, 0.3); ctx.quadraticCurveTo(-0.3, 0.18, -0.3, -0.05); ctx.closePath(); };
  shade(ctx, face, skin, { x: 0.05, y: -0.3, r: 0.6, hi: 0.3, lo: 0.55, tex: 0.08, lw: 1 });
  spec(ctx, -0.02, -0.38, 0.14, 0.06, -0.3, 0.45); // brillo de la pelada
  ctx.strokeStyle = darken(skin, 0.35); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.15, -0.44); ctx.lineTo(-0.08, -0.36); ctx.lineTo(-0.1, -0.28); ctx.moveTo(0.22, -0.4); ctx.lineTo(0.17, -0.33); ctx.stroke(); // grietas
  ctx.fillStyle = 'rgba(80,40,110,0.25)'; ctx.beginPath(); ctx.ellipse(0.18, -0.08, 0.2, 0.06, 0, 0, TAU); ctx.fill();
  vampEye(ctx, 0.08, -0.1, 0.065, 0.05, t); vampEye(ctx, 0.3, -0.09, 0.058, 0.046, t);
  ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 0.065; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.04, -0.25); ctx.lineTo(0.15, -0.16); ctx.moveTo(0.23, -0.16); ctx.lineTo(0.4, -0.25); ctx.stroke(); // cejas enojadas
  ctx.strokeStyle = darken(skin, 0.3); ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(0.36, -0.02); ctx.lineTo(0.41, 0.06); ctx.lineTo(0.34, 0.07); ctx.stroke(); // nariz
  // la boca abierta que ruge, con colmillos y dientes
  const open = roar ? 0.2 : 0.13;
  shade(ctx, () => { ctx.moveTo(0.04, 0.12); ctx.quadraticCurveTo(0.2, 0.08, 0.37, 0.12); ctx.quadraticCurveTo(0.34, 0.12 + open * 1.4, 0.2, 0.14 + open * 1.5); ctx.quadraticCurveTo(0.06, 0.12 + open * 1.4, 0.04, 0.12); ctx.closePath(); }, '#5a0710', { x: 0.2, y: 0.2, r: 0.2, lw: 0.9 });
  ctx.fillStyle = '#e05868'; ctx.beginPath(); ctx.ellipse(0.2, 0.12 + open * 1.25, 0.08, 0.035, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fbf6ee';
  for (const fx of [0.08, 0.32]) { ctx.beginPath(); ctx.moveTo(fx - 0.03, 0.115); ctx.lineTo(fx, 0.115 + open * 0.75); ctx.lineTo(fx + 0.03, 0.115); ctx.closePath(); ctx.fill(); } // colmillos de arriba
  for (const fx of [0.11, 0.29]) { ctx.beginPath(); ctx.moveTo(fx - 0.025, 0.13 + open * 1.45); ctx.lineTo(fx, 0.13 + open * 0.95); ctx.lineTo(fx + 0.025, 0.13 + open * 1.45); ctx.closePath(); ctx.fill(); } // de abajo
  ctx.fillRect(0.13, 0.115, 0.14, 0.03);
  ctx.fillStyle = 'rgba(170,10,20,0.85)'; ctx.beginPath(); ctx.ellipse(-0.12, 0.08, 0.05, 0.03, 0.5, 0, TAU); ctx.ellipse(-0.08, 0.15, 0.025, 0.015, 0, 0, TAU); ctx.fill(); // sangre en la cara
}
function giantTorso(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save(); ctx.scale(1.45, 1.18);
  const torso = () => { ctx.moveTo(-0.3, 0.06); ctx.lineTo(-0.42, -0.4); ctx.quadraticCurveTo(0, -0.66, 0.42, -0.4); ctx.lineTo(0.3, 0.06); ctx.closePath(); };
  shade(ctx, torso, GIANT.armor, { x: 0.08, y: -0.45, r: 0.6, hi: 0.4, tex: 0.4 });
  // el cuello rojo levantado por detrás de la cabeza y la pechera
  ctx.strokeStyle = '#a8101a'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.3, -0.48); ctx.lineTo(-0.02, -0.18); ctx.lineTo(0.3, -0.48); ctx.stroke();
  ctx.strokeStyle = '#3a343f'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.02, -0.18); ctx.lineTo(-0.02, -0.06); ctx.moveTo(-0.3, -0.24); ctx.quadraticCurveTo(-0.02, -0.12, 0.28, -0.24); ctx.stroke(); // pectorales
  gem(ctx, -0.2, -0.33, 0.035, '#c4c8d2', t); gem(ctx, 0.18, -0.33, 0.035, '#c4c8d2', t);
  // broche de murciélago
  ctx.fillStyle = '#b9bdc9'; ctx.beginPath(); ctx.moveTo(-0.02, -0.25); ctx.lineTo(-0.14, -0.3); ctx.lineTo(-0.1, -0.22); ctx.lineTo(-0.02, -0.12); ctx.lineTo(0.06, -0.22); ctx.lineTo(0.1, -0.3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.012; ctx.stroke();
  gem(ctx, -0.02, -0.21, 0.025, '#b9bdc9', t);
  shade(ctx, () => ctx.roundRect(-0.31, -0.08, 0.6, 0.12, 0.03), GIANT.strap, { x: 0, y: -0.07, r: 0.3, lw: 0.6 }); // cinturón
  shade(ctx, () => ctx.roundRect(-0.07, -0.1, 0.14, 0.16, 0.02), '#c4c8d2', { x: -0.03, y: -0.08, r: 0.1, hi: 0.7, lw: 0.6 }); ctx.fillStyle = GIANT.strap; ctx.fillRect(-0.03, -0.05, 0.06, 0.07);
  for (const [px, pw] of [[-0.29, 0.27], [0.03, 0.27]] as const) { shade(ctx, () => { ctx.moveTo(px, 0.04); ctx.lineTo(px + pw, 0.04); ctx.lineTo(px + pw * 0.9, 0.26); ctx.lineTo(px + pw * 0.1, 0.26); ctx.closePath(); }, '#1a1620', { x: px, y: 0.05, r: 0.25, lw: 0.6 }); ctx.strokeStyle = '#b9bdc9'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.23); ctx.lineTo(px + pw * 0.9, 0.23); ctx.stroke(); }
  // faldón del medio con punta roja
  shade(ctx, () => { ctx.moveTo(-0.08, 0.04); ctx.lineTo(0.08, 0.04); ctx.lineTo(0.06, 0.3); ctx.lineTo(0, 0.36); ctx.lineTo(-0.06, 0.3); ctx.closePath(); }, '#24202a', { r: 0.2, lw: 0.6 });
  ctx.strokeStyle = '#c41a26'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.055, 0.28); ctx.lineTo(0, 0.33); ctx.lineTo(0.055, 0.28); ctx.stroke();
  ctx.restore();
}
function giantPose(v: Vamp, t: number): Pose {
  const wp = walkerPose(v, t), base: Pose = { ...wp, lean: 0.1, crouch: 0.12, head: 0.05, legs: v.onGround && Math.abs(v.vx) < 0.3 ? [[-0.55, 0.55], [0.5, 0.6]] : wp.legs };
  const br = Math.sin(t * 2.4 + v.id);
  let back: [number, number] = [0.55 + br * 0.04, 1.0], front: [number, number] = [0.85 - br * 0.04, 1.05];
  if (v.state === 'claw') { // echa el puño para atrás y da una piña enorme
    const at = v.t;
    if (at < 0.45) { const k = at / 0.45; front = [0.85 - k * 1.7, 1.05 + k * 0.7]; back = [0.55 + k * 0.4, 1.0]; }
    else if (at < 0.6) { const k = (at - 0.45) / 0.15; front = [-0.85 + k * 2.55, 1.75 - k * 1.7]; back = [0.95 - k * 0.6, 1.0]; }
    else { const k = Math.min(1, (at - 0.6) / 0.4); front = [1.7 - k * 0.85, 0.05 + k * 1.0]; back = [0.35 + k * 0.2, 1.0]; }
    return { ...base, lean: 0.1 + (at > 0.45 && at < 0.8 ? 0.25 : 0), arms: [back, front] };
  }
  if (!v.onGround) return { ...base, arms: [[2.3, 0.4], [2.6, 0.3]] };
  return { ...base, arms: [back, front] };
}
export function drawGiantK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const pose = giantPose(v, t);
  shadow(ctx, v, 0.7);
  setLimb(1.75);
  const hip: Pt = [0, -0.76 + pose.bob + pose.crouch * 0.4], neck = neckOf(hip, pose, 0.64);
  cape(ctx, [neck[0] - 0.05, neck[1]], GIANT, t + v.id, Math.abs(v.vx) * 1.2, v.onGround ? 0 : 1, false);
  legDraw(ctx, hip, pose, 0, GIANT);
  const bigArm = (i: number) => { // brazos que salen de hombros más anchos
    ctx.save(); ctx.translate(i === 0 ? -0.12 : 0.12, -0.04);
    armDraw(ctx, hip, pose, i, GIANT, 'fist', (hand, ang) => bracer(ctx, hand, ang, 0.36, i === 0));
    ctx.restore();
  };
  bigArm(0);
  spikedPauldron(ctx, add(shoulderAt(hip, pose, 0), [-1, 0.3], 0.14), 1.1, true);
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); giantTorso(ctx, t); ctx.restore();
  legDraw(ctx, hip, pose, 1, GIANT);
  bigArm(1);
  spikedPauldron(ctx, add(shoulderAt(hip, pose, 1), [-0.5, -1], 0.08), 0.95, false);
  ctx.save(); ctx.translate(neck[0] + 0.08, neck[1] - 0.3); ctx.rotate(pose.head * 0.5); ctx.scale(1.08, 1.08); giantHead(ctx, t + v.id, v.state === 'claw' || !v.onGround); ctx.restore();
  setLimb(1.2);
}

// ---------------------------------------------------------------- Vampiro mago
function staff(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, t: number, power: number) {
  const d = dirv(ang), top = add(hand, d, 1.05), bot = add(hand, d, -0.95), n: Pt = [d[1], -d[0]];
  segment(ctx, bot, top, 0.07, 0.075, '#1c1418', 0.6);
  ctx.strokeStyle = 'rgba(200,30,40,0.6)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(...add(bot, n, 0.012)); ctx.lineTo(...add(top, n, 0.012)); ctx.stroke();
  for (const k of [-0.55, 0.05, 0.85]) { const m = add(hand, d, k); segment(ctx, add(m, d, -0.035), add(m, d, 0.035), 0.1, 0.1, '#b9a89a', 0.7); }
  // la punta de abajo
  ctx.fillStyle = '#c9c2ba'; ctx.beginPath(); ctx.moveTo(...add(bot, n, 0.05)); ctx.lineTo(...add(bot, d, -0.18)); ctx.lineTo(...add(bot, n, -0.05)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke();
  // la cabeza: alas de murciélago de metal que sostienen la bola roja
  const c = add(top, d, 0.2);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-ang + Math.PI);
  ctx.fillStyle = grad(ctx, -0.3, 0, 0.3, 0, [[0, '#6b5a50'], [0.5, '#e6d8cc'], [1, '#6b5a50']]);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0.2); ctx.lineTo(s * 0.12, 0.12); ctx.lineTo(s * 0.28, 0.0); ctx.lineTo(s * 0.33, -0.22); ctx.lineTo(s * 0.22, -0.08); ctx.lineTo(s * 0.12, -0.02); ctx.lineTo(s * 0.06, 0.08); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-0.04, 0.2); ctx.lineTo(0, 0.08); ctx.lineTo(0.04, 0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
  const orb = add(c, d, 0.08);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  bloom(ctx, orb[0], orb[1], 0.45 + power * 0.4, '#ff2a1a', 0.5 + power * 0.4);
  for (let i = 0; i < 7; i++) { // llamas que salen de la bola
    const k = (t * 1.6 + i / 7) % 1, fx = orb[0] + Math.sin(i * 2.3 + t * 3) * 0.1, fy = orb[1] - 0.05 - k * (0.35 + power * 0.3), r = 0.09 * (1 - k) + 0.02;
    ctx.fillStyle = `rgba(255,${60 + 120 * (1 - k)},30,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(orb[0] - 0.04, orb[1] - 0.04, 0.01, orb[0], orb[1], 0.15); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.35, '#ff5a2a'); g.addColorStop(1, '#8a0a0a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(orb[0], orb[1], 0.15, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(orb[0] - 0.05, orb[1] - 0.06, 0.04, 0.025, -0.5, 0, TAU); ctx.fill();
}
function hood(ctx: CanvasRenderingContext2D, t: number, part: 'back' | 'front') {
  if (part === 'back') { // la capucha por detrás, con la punta que cae
    shade(ctx, () => { ctx.moveTo(-0.46, 0.42); ctx.quadraticCurveTo(-0.62, -0.3, -0.1, -0.66); ctx.quadraticCurveTo(0.28, -0.74, 0.5, -0.5); ctx.lineTo(0.62, -0.6); ctx.lineTo(0.52, -0.3); ctx.quadraticCurveTo(0.6, 0.1, 0.46, 0.42); ctx.closePath(); }, '#16121a', { x: 0.0, y: -0.5, r: 0.8, hi: 0.4, tex: 0.3, lw: 1 });
    return;
  }
  // el costado de la capucha tapa el costado de la cabeza y enmarca la cara
  shade(ctx, () => { ctx.moveTo(-0.46, 0.42); ctx.quadraticCurveTo(-0.6, -0.3, -0.1, -0.62); ctx.quadraticCurveTo(0.3, -0.7, 0.5, -0.46); ctx.lineTo(0.48, -0.12); ctx.quadraticCurveTo(0.4, -0.36, 0.08, -0.38); ctx.quadraticCurveTo(-0.16, -0.36, -0.16, -0.1); ctx.quadraticCurveTo(-0.18, 0.2, -0.08, 0.42); ctx.closePath(); }, '#1a151e', { x: -0.1, y: -0.5, r: 0.7, hi: 0.35, tex: 0.3, lw: 1 });
  ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.1, 0.42); ctx.quadraticCurveTo(-0.2, 0.2, -0.17, -0.1); ctx.quadraticCurveTo(-0.16, -0.38, 0.08, -0.4); ctx.quadraticCurveTo(0.42, -0.38, 0.49, -0.12); ctx.stroke();
  void t;
}
function mageHead(ctx: CanvasRenderingContext2D, t: number, open: boolean) {
  hood(ctx, t, 'back');
  const skin = MAGE.skin;
  const face = () => { ctx.moveTo(-0.24, -0.22); ctx.quadraticCurveTo(-0.3, 0.2, -0.04, 0.34); ctx.quadraticCurveTo(0.2, 0.4, 0.36, 0.16); ctx.quadraticCurveTo(0.42, -0.1, 0.34, -0.3); ctx.quadraticCurveTo(0.04, -0.4, -0.24, -0.22); ctx.closePath(); };
  shade(ctx, face, skin, { x: 0.18, y: -0.06, r: 0.55, hi: 0.1, lo: 0.6, tex: 0.04, lw: 1 });
  ctx.fillStyle = 'rgba(30,10,40,0.45)'; ctx.beginPath(); ctx.ellipse(0.06, -0.3, 0.35, 0.12, 0, 0, TAU); ctx.fill(); // la sombra de la capucha
  ctx.strokeStyle = darken(skin, 0.35); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.06, 0.08); ctx.quadraticCurveTo(-0.02, 0.18, 0.06, 0.2); ctx.stroke(); // arruga
  vampEye(ctx, 0.08, -0.04, 0.062, 0.05, t); vampEye(ctx, 0.28, -0.035, 0.055, 0.045, t);
  ctx.strokeStyle = '#120e16'; ctx.lineWidth = 0.055; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.02, -0.17); ctx.lineTo(0.16, -0.1); ctx.moveTo(0.22, -0.1); ctx.lineTo(0.37, -0.18); ctx.stroke();
  if (open) { shade(ctx, () => { ctx.moveTo(0.1, 0.17); ctx.quadraticCurveTo(0.2, 0.13, 0.31, 0.17); ctx.quadraticCurveTo(0.21, 0.32, 0.1, 0.17); ctx.closePath(); }, '#5a0710', { x: 0.2, y: 0.2, r: 0.12, lw: 0.8 }); }
  else { ctx.strokeStyle = '#1a0a12'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0.1, 0.21); ctx.quadraticCurveTo(0.2, 0.17, 0.3, 0.22); ctx.stroke(); }
  ctx.fillStyle = '#fff'; for (const fx of [0.14, 0.27]) { ctx.beginPath(); ctx.moveTo(fx - 0.02, 0.19); ctx.lineTo(fx, 0.26); ctx.lineTo(fx + 0.02, 0.19); ctx.closePath(); ctx.fill(); }
  hood(ctx, t, 'front');
}
function robe(ctx: CanvasRenderingContext2D, hip: Pt, t: number, sway: number) {
  const top = hip[1] - 0.05, y = -0.08;
  const path = () => { ctx.moveTo(-0.3, top); ctx.lineTo(0.3, top); ctx.quadraticCurveTo(0.44 + sway * 0.1, (top + y) / 2, 0.48 + sway * 0.15, y); for (let i = 0; i <= 4; i++) ctx.lineTo(0.48 - i * 0.24 + sway * 0.1, y + (i % 2 ? 0.05 : 0)); ctx.quadraticCurveTo(-0.44, (top + y) / 2, -0.3, top); ctx.closePath(); };
  shade(ctx, path, '#1d1822', { x: 0.1, y: top + 0.1, r: 0.8, hi: 0.3, tex: 0.3, lw: 1 });
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0.02, top + 0.02); ctx.lineTo(0.02 + sway * 0.05, y); ctx.moveTo(0.18, top + 0.02); ctx.lineTo(0.3 + sway * 0.08, y); ctx.moveTo(-0.14, top + 0.02); ctx.lineTo(-0.24 + sway * 0.05, y); ctx.stroke();
  // el paño del medio con el rombo rojo
  shade(ctx, () => { ctx.moveTo(-0.06, top); ctx.lineTo(0.12, top); ctx.lineTo(0.1 + sway * 0.05, y - 0.12); ctx.lineTo(0.03 + sway * 0.05, y - 0.04); ctx.lineTo(-0.04 + sway * 0.05, y - 0.12); ctx.closePath(); }, '#2a2430', { r: 0.3, lw: 0.6 });
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.02; ctx.stroke();
  gem(ctx, 0.03 + sway * 0.03, (top + y) / 2 + 0.05, 0.04, '#c4121e', t);
}
export function drawMageK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const wp = walkerPose(v, t), casting = v.state === 'cast' ? Math.min(1, v.t / 0.45) * (v.t < 0.8 ? 1 : Math.max(0, 1 - (v.t - 0.8) / 0.15)) : 0;
  const bonk = v.state === 'claw' ? (v.t < 0.36 ? v.t / 0.36 : Math.max(0, 1 - (v.t - 0.36) * 4)) : 0;
  const pose: Pose = { ...wp, lean: 0.12 + casting * 0.15, crouch: 0.06, head: 0.05 - casting * 0.15, legs: wp.legs.map(([a, b]) => [a * 0.6, b * 0.6]) as [number, number][],
    arms: [[0.3 + Math.sin(t * 2 + v.id) * 0.05, 0.8], [0.75 + casting * 1.4 + bonk * 1.4, 0.95 - casting * 0.6 - bonk * 0.5]], blade: 0 };
  shadow(ctx, v, 0.5);
  const hip: Pt = [0, -0.72 + pose.bob + pose.crouch * 0.4], neck = neckOf(hip, pose);
  cape(ctx, neck, MAGE, t + v.id, Math.abs(v.vx) * 1.5, v.onGround ? 0 : 1, false);
  legDraw(ctx, hip, pose, 0, MAGE); legDraw(ctx, hip, pose, 1, MAGE);
  robe(ctx, hip, t, Math.max(-1, Math.min(1, -v.vx * 0.3)));
  armDraw(ctx, hip, pose, 0, MAGE, 'glove');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean);
  shade(ctx, () => { ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.36, -0.42); ctx.quadraticCurveTo(0, -0.6, 0.36, -0.42); ctx.lineTo(0.27, 0.06); ctx.closePath(); }, MAGE.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.35, tex: 0.35 });
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.3, -0.4); ctx.lineTo(-0.2, 0.04); ctx.moveTo(0.3, -0.4); ctx.lineTo(0.2, 0.04); ctx.stroke();
  shade(ctx, () => ctx.roundRect(-0.28, -0.08, 0.55, 0.11, 0.03), MAGE.strap, { x: 0, y: -0.07, r: 0.3, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.06, -0.095, 0.13, 0.14, 0.02), '#c4c8d2', { x: -0.03, y: -0.08, r: 0.1, hi: 0.7, lw: 0.6 });
  // estrella de plata con la gema en el pecho
  ctx.fillStyle = '#c4c8d2'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 0.05 : 0.12; ctx.lineTo(0.02 + Math.sin(a) * r, -0.36 - Math.cos(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.012; ctx.stroke();
  gem(ctx, 0.02, -0.36, 0.035, '#9aa0ad', t);
  ctx.restore();
  pauldron(ctx, shoulderAt(hip, pose, 1), pose.arms[1][0], false, 1.05);
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.025; { const sp = shoulderAt(hip, pose, 1); ctx.beginPath(); ctx.ellipse(sp[0], sp[1] - 0.01, 0.19, 0.15, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.15, 1.15); mageHead(ctx, t + v.id, casting > 0.3 || bonk > 0); ctx.restore();
  armDraw(ctx, hip, pose, 1, MAGE, 'glove', hand => staff(ctx, hand, Math.PI - 0.08 - casting * 0.55 - bonk * 0.9, t, casting));
}

// ---------------------------------------------------------------- Vampiro martillo y vampiro guerrero
function knightTorso(ctx: CanvasRenderingContext2D, t: number) {
  const torso = () => { ctx.moveTo(-0.3, 0.06); ctx.lineTo(-0.4, -0.42); ctx.quadraticCurveTo(0, -0.62, 0.4, -0.42); ctx.lineTo(0.29, 0.06); ctx.closePath(); };
  shade(ctx, torso, KNIGHT.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.45, tex: 0.45 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  shade(ctx, () => { ctx.moveTo(-0.26, -0.4); ctx.lineTo(0.28, -0.4); ctx.lineTo(0.22, -0.12); ctx.lineTo(0.0, -0.06); ctx.lineTo(-0.2, -0.12); ctx.closePath(); }, '#2e2934', { x: 0.02, y: -0.35, r: 0.35, hi: 0.5, lw: 0.6 }); // pechera
  segment(ctx, [-0.38, -0.5], [0.3, 0.0], 0.085, 0.085, '#5a2a1a', 0.6); // correa cruzada
  ctx.restore();
  ctx.strokeStyle = '#c4c8d2'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.26, -0.4); ctx.lineTo(-0.2, -0.12); ctx.lineTo(0.0, -0.06); ctx.lineTo(0.22, -0.12); ctx.lineTo(0.28, -0.4); ctx.stroke();
  gem(ctx, 0.0, -0.3, 0.045, '#c4c8d2', t);
  ctx.strokeStyle = '#c8121e'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.08, -0.52); ctx.lineTo(0.0, -0.4); ctx.lineTo(0.1, -0.52); ctx.stroke(); // el cuello rojo
  shade(ctx, () => ctx.roundRect(-0.31, -0.08, 0.6, 0.13, 0.03), KNIGHT.strap, { x: 0, y: -0.07, r: 0.3, hi: 0.4, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.07, -0.1, 0.15, 0.17, 0.025), '#cfd2db', { x: -0.03, y: -0.08, r: 0.12, hi: 0.7, lw: 0.6 });
  ctx.fillStyle = '#4a2a16'; ctx.fillRect(-0.025, -0.045, 0.06, 0.07);
  for (const [px, pw] of [[-0.29, 0.27], [0.03, 0.27]] as const) {
    shade(ctx, () => { ctx.moveTo(px, 0.05); ctx.lineTo(px + pw, 0.05); ctx.lineTo(px + pw * 0.92, 0.26); ctx.lineTo(px + pw * 0.08, 0.26); ctx.closePath(); }, '#1f1b24', { x: px + 0.05, y: 0.06, r: 0.25, lw: 0.6 });
    ctx.strokeStyle = '#c4c8d2'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.23); ctx.lineTo(px + pw * 0.9, 0.23); ctx.stroke();
  }
  shade(ctx, () => { ctx.moveTo(-0.07, 0.05); ctx.lineTo(0.09, 0.05); ctx.lineTo(0.06, 0.32); ctx.lineTo(0.01, 0.38); ctx.lineTo(-0.04, 0.32); ctx.closePath(); }, '#8e0f18', { r: 0.2, lw: 0.6 }); // paño rojo
}
function warHammer(ctx: CanvasRenderingContext2D, grip: Pt, ang: number, t: number) {
  const d = dirv(ang), n: Pt = [d[1], -d[0]], end = add(grip, d, -0.45), neck = add(grip, d, 0.95);
  segment(ctx, end, neck, 0.11, 0.11, '#8e1a1e', 0.6);
  ctx.strokeStyle = '#4a0a0e'; ctx.lineWidth = 0.018; for (let k = -0.4; k < 0.9; k += 0.1) { const a = add(add(grip, d, k), n, 0.055), b = add(add(grip, d, k + 0.07), n, -0.055); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); } // el cuero enrollado
  for (const k of [-0.42, 0.88]) { const m = add(grip, d, k); segment(ctx, add(m, d, -0.05), add(m, d, 0.05), 0.15, 0.15, '#9aa0ad', 0.7); }
  { const tip = add(end, d, -0.2); ctx.fillStyle = '#c4c8d2'; ctx.beginPath(); ctx.moveTo(...add(end, n, 0.06)); ctx.lineTo(...tip); ctx.lineTo(...add(end, n, -0.06)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); }
  // la cabeza: un bloque de piedra con vetas rojas, bandas de metal, pinches y la gema
  const c = add(neck, d, 0.28);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-ang);
  const hw = 0.42, hh = 0.3;
  for (const [sx, sy] of [[-1, -0.6], [-1, 0], [-1, 0.6], [1, -0.6], [1, 0], [1, 0.6], [-0.5, 1], [0.5, 1], [0, 1], [-0.5, -1], [0.5, -1]] as const) { // pinches
    const bx = sx * hw * (Math.abs(sy) === 1 ? 0.6 : 1), by = sy * hh, ox = Math.abs(sy) === 1 ? 0 : sx, oy = Math.abs(sy) === 1 ? sy : 0;
    ctx.beginPath(); ctx.moveTo(bx - oy * 0.05 - ox * 0.0, by - ox * 0.05); ctx.lineTo(bx + ox * 0.18, by + oy * 0.18); ctx.lineTo(bx + oy * 0.05, by + ox * 0.05); ctx.closePath();
    ctx.fillStyle = '#d8dbe3'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke();
  }
  shade(ctx, () => ctx.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06), '#3a3036', { x: -0.1, y: -0.1, r: 0.6, hi: 0.4, tex: 0.5, lw: 1 });
  ctx.strokeStyle = 'rgba(255,40,30,0.75)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(-0.3, -0.2); ctx.lineTo(-0.15, -0.05); ctx.lineTo(-0.25, 0.15); ctx.moveTo(0.2, -0.22); ctx.lineTo(0.3, 0.0); ctx.lineTo(0.18, 0.2); ctx.stroke(); // vetas de lava
  for (const sx of [-0.28, 0.28]) shade(ctx, () => ctx.rect(sx - 0.05, -hh - 0.02, 0.1, hh * 2 + 0.04), '#a3a8b4', { x: sx, y: -hh, r: 0.3, hi: 0.6, lw: 0.6 });
  ctx.fillStyle = '#e6e8ee'; for (const sx of [-0.28, 0.28]) for (const sy of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.arc(sx, sy, 0.017, 0, TAU); ctx.fill(); }
  ctx.rotate(ang); gem(ctx, 0, 0, 0.07, '#c4c8d2', t);
  ctx.restore();
}
function vampSword(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, t: number) {
  const d = dirv(ang), n: Pt = [d[1], -d[0]], b0 = add(hand, d, 0.14), b1 = add(hand, d, 1.25);
  segment(ctx, add(hand, d, -0.14), add(hand, d, 0.06), 0.08, 0.08, '#5a3420', 0.4);
  { const pm = add(hand, d, -0.2); ctx.save(); ctx.translate(pm[0], pm[1]); gem(ctx, 0, 0, 0.04, '#c4c8d2', t); ctx.restore(); }
  // guarda con cuernos
  ctx.fillStyle = grad(ctx, ...add(b0, n, 0.3), ...add(b0, n, -0.3), [[0, '#6c6f7b'], [0.5, '#eef0f6'], [1, '#6c6f7b']]);
  ctx.beginPath(); ctx.moveTo(...add(add(b0, n, 0.3), d, 0.12)); ctx.lineTo(...add(b0, n, 0.2)); ctx.lineTo(...add(add(b0, n, 0.05), d, -0.05)); ctx.lineTo(...add(add(b0, n, -0.05), d, -0.05)); ctx.lineTo(...add(b0, n, -0.2)); ctx.lineTo(...add(add(b0, n, -0.3), d, 0.12)); ctx.lineTo(...add(add(b0, n, -0.1), d, 0.05)); ctx.lineTo(...add(add(b0, n, 0.1), d, 0.05)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.018; ctx.stroke();
  // la hoja de plata con el centro rojo que brilla
  const w = 0.11, sh = (k: number, s: number): Pt => add(add(b0, d, k), n, s);
  ctx.beginPath(); ctx.moveTo(...sh(0.05, w)); ctx.lineTo(...sh(0.9, w * 0.85)); ctx.lineTo(...b1); ctx.lineTo(...sh(0.9, -w * 0.85)); ctx.lineTo(...sh(0.05, -w)); ctx.closePath();
  ctx.fillStyle = grad(ctx, ...sh(0, w), ...sh(0, -w), [[0, '#f4f6fb'], [0.5, '#a9afbd'], [1, '#5d6474']]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...sh(0.12, w * 0.45)); ctx.lineTo(...sh(0.88, w * 0.35)); ctx.lineTo(...add(b0, d, 1.0)); ctx.lineTo(...sh(0.88, -w * 0.35)); ctx.lineTo(...sh(0.12, -w * 0.45)); ctx.closePath();
  ctx.fillStyle = grad(ctx, ...sh(0, 0.05), ...sh(0, -0.05), [[0, '#ff6a5a'], [0.5, '#e3142a'], [1, '#7a0010']]); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const m = add(b0, d, 0.5); bloom(ctx, m[0], m[1], 0.5, '#ff2030', 0.35 + 0.1 * Math.sin(t * 4)); ctx.restore();
}
function shield(ctx: CanvasRenderingContext2D, c: Pt, t: number, tilt: number) {
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(tilt);
  const path = () => { ctx.moveTo(-0.36, -0.46); ctx.quadraticCurveTo(0, -0.56, 0.36, -0.46); ctx.lineTo(0.34, 0.06); ctx.quadraticCurveTo(0.26, 0.42, 0, 0.6); ctx.quadraticCurveTo(-0.26, 0.42, -0.34, 0.06); ctx.closePath(); };
  shade(ctx, path, '#b9bdc9', { x: -0.1, y: -0.3, r: 0.8, hi: 0.5, lw: 1.2 });
  ctx.save(); ctx.scale(0.86, 0.86); ctx.translate(0, 0.02); shade(ctx, path, '#17141b', { x: -0.1, y: -0.25, r: 0.7, hi: 0.3, tex: 0.5, lw: 0.6 }); ctx.restore();
  ctx.strokeStyle = 'rgba(160,160,170,0.35)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.2, -0.2); ctx.lineTo(-0.1, -0.05); ctx.moveTo(0.18, 0.15); ctx.lineTo(0.26, 0.28); ctx.stroke(); // rayones
  // la cruz roja con puntas
  ctx.fillStyle = grad(ctx, -0.2, -0.3, 0.2, 0.3, [[0, '#ff5a50'], [0.5, '#e3142a'], [1, '#8a0010']]);
  ctx.beginPath(); ctx.moveTo(-0.04, -0.36); ctx.lineTo(0, -0.42); ctx.lineTo(0.04, -0.36); ctx.lineTo(0.035, -0.12); ctx.lineTo(0.22, -0.13); ctx.lineTo(0.28, -0.08); ctx.lineTo(0.22, -0.03); ctx.lineTo(0.035, -0.04); ctx.lineTo(0.035, 0.32); ctx.lineTo(0, 0.4); ctx.lineTo(-0.035, 0.32); ctx.lineTo(-0.035, -0.04); ctx.lineTo(-0.22, -0.03); ctx.lineTo(-0.28, -0.08); ctx.lineTo(-0.22, -0.13); ctx.lineTo(-0.035, -0.12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3a0006'; ctx.lineWidth = 0.015; ctx.stroke();
  for (const [x, y] of [[-0.26, -0.38], [0.26, -0.38], [0, 0.46]] as const) gem(ctx, x, y, 0.028, '#c4c8d2', t);
  spec(ctx, -0.15, -0.32, 0.12, 0.05, -0.2, 0.6);
  ctx.restore();
}
function hammerAngle(v: Vamp) {
  if (v.state !== 'claw') return { ha: 2.35, arm: [1.15, 0.75] as [number, number] };
  const at = v.t;
  if (at < 0.6) { const k = at / 0.6, e = k * k * (3 - 2 * k); return { ha: 2.35 + e * 1.35, arm: [1.15 + e * 1.85, 0.75 - e * 0.6] as [number, number] }; } // lo levanta por arriba de la cabeza
  if (at < 0.75) { const k = (at - 0.6) / 0.15; return { ha: 3.7 - k * 2.3, arm: [3.0 - k * 1.6, 0.15 - k * 0.05] as [number, number] }; } // ¡PUM! contra el piso
  const k = Math.min(1, (at - 0.75) / 0.45); return { ha: 1.4 + k * 0.95, arm: [1.4 - k * 0.25, 0.1 + k * 0.65] as [number, number] };
}
export function drawHammerK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const wp = walkerPose(v, t), { ha, arm } = hammerAngle(v), slam = v.state === 'claw' && v.t > 0.6;
  const pose: Pose = { ...wp, lean: slam ? 0.4 : 0.18, crouch: 0.2, head: 0.1, legs: v.onGround && Math.abs(v.vx) < 0.3 ? [[-0.65, 0.5], [0.7, 0.75]] : wp.legs, arms: [[arm[0] - 0.25, arm[1] + 0.35], arm], blade: 0 };
  shadow(ctx, v, 0.55);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck = neckOf(hip, pose);
  cape(ctx, neck, KNIGHT, t + v.id, Math.abs(v.vx) * 1.5, v.onGround ? 0 : 1, true);
  legDraw(ctx, hip, pose, 0, KNIGHT);
  armDraw(ctx, hip, pose, 0, KNIGHT, 'glove');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); knightTorso(ctx, t); ctx.restore();
  pauldron(ctx, shoulderAt(hip, pose, 0), pose.arms[0][0], true);
  legDraw(ctx, hip, pose, 1, KNIGHT);
  const head = () => { ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, true, true, { beard: true }); ctx.restore(); };
  const up = ha > 2.9; // con el martillo arriba, el brazo pasa por delante de la cabeza
  if (up) head();
  armDraw(ctx, hip, pose, 1, KNIGHT, 'glove', hand => warHammer(ctx, hand, ha, t));
  pauldron(ctx, shoulderAt(hip, pose, 1), pose.arms[1][0], false, 1.1);
  if (!up) head();
}
export function drawWarriorK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const wp = walkerPose(v, t), at = v.state === 'claw' ? v.t : -1;
  // la espada en alto; al atacar baja de un tajo
  let sa: [number, number] = [2.5 + Math.sin(t * 2.6 + v.id) * 0.05, 0.5], blade = 0.35;
  if (at >= 0) { if (at < 0.3) { const k = at / 0.3; sa = [2.5 + k * 0.5, 0.5 - k * 0.3]; blade = 0.35 + k * 0.4; } else if (at < 0.42) { const k = (at - 0.3) / 0.12; sa = [3.0 - k * 1.6, 0.2 - k * 0.1]; blade = 0.75 - k * 0.6; } else { const k = Math.min(1, (at - 0.42) / 0.33); sa = [1.4 + k * 1.1, 0.1 + k * 0.4]; blade = 0.15 + k * 0.2; } }
  const pose: Pose = { ...wp, lean: at >= 0.3 && at < 0.6 ? 0.35 : 0.15, crouch: 0.18, head: 0.08, legs: v.onGround && Math.abs(v.vx) < 0.3 ? [[-0.6, 0.55], [0.6, 0.7]] : wp.legs, arms: [sa, [1.1, 1.2]], blade };
  shadow(ctx, v, 0.55);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck = neckOf(hip, pose);
  cape(ctx, neck, KNIGHT, t + v.id, Math.abs(v.vx) * 1.5, v.onGround ? 0 : 1, true);
  legDraw(ctx, hip, pose, 0, KNIGHT);
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); knightTorso(ctx, t); ctx.restore();
  pauldron(ctx, shoulderAt(hip, pose, 0), pose.arms[0][0], true);
  legDraw(ctx, hip, pose, 1, KNIGHT);
  armDraw(ctx, hip, pose, 0, KNIGHT, 'glove', (hand, ang) => vampSword(ctx, hand, ang + blade + 0.2, t)); // la espada (brazo de atrás, levantada)
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, true, true, { beard: true }); ctx.restore();
  armDraw(ctx, hip, pose, 1, KNIGHT, 'glove');
  pauldron(ctx, shoulderAt(hip, pose, 1), pose.arms[1][0], false, 1.1);
  const h = handOf(hip, pose, 1); shield(ctx, [h[0] + 0.14, h[1] - 0.05], t, pose.lean * 0.3 + Math.sin(t * 2 + v.id) * 0.03); // el escudo adelante del cuerpo
}

// ---------------------------------------------------------------- Hombre lobo
const FUR = '#2a2030', FUR_L = '#9c8eaa', FUR_RIM = '#ff2a3a';
function furBlob(ctx: CanvasRenderingContext2D, path: () => void, base: string, light: [number, number], r: number) {
  shade(ctx, path, base, { x: light[0], y: light[1], r, hi: 0.35, tex: 0.6, lw: 1 });
}
function wolfClaw(ctx: CanvasRenderingContext2D, p: Pt, ang: number, back: boolean, size = 1) {
  const c = back ? darken(FUR_L, 0.35) : FUR_L;
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-ang); ctx.scale(size, size);
  shade(ctx, () => ctx.ellipse(0, 0.02, 0.13, 0.11, 0, 0, TAU), c, { x: -0.03, y: -0.02, r: 0.14, lw: 0.7 });
  for (let k = 0; k < 4; k++) { const fa = -0.6 + k * 0.4, bx = Math.sin(fa) * 0.1, by = Math.cos(fa) * 0.1 + 0.02; ctx.fillStyle = back ? '#8a8270' : '#f1e8d2'; ctx.beginPath(); ctx.moveTo(bx - 0.022, by); ctx.quadraticCurveTo(bx + Math.sin(fa) * 0.12, by + 0.08, bx + Math.sin(fa) * 0.05, by + 0.17); ctx.lineTo(bx + 0.022, by); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.01; ctx.stroke(); }
  ctx.restore();
}
export function drawWolfK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const s = Math.sin, moving = v.onGround && Math.abs(v.vx) > 0.5, w = v.walkT * 3.4, leap = v.state === 'leap' || !v.onGround;
  const swipe = v.state === 'claw' ? (v.t < 0.22 ? v.t / 0.22 : Math.max(0, 1 - (v.t - 0.22) * 3.5)) : 0;
  const bob = moving ? Math.abs(s(w)) * 0.08 : s(t * 3 + v.id) * 0.02, crouch = leap ? -0.05 : 0.08;
  shadow(ctx, v, 0.75);
  ctx.save(); ctx.translate(0, -bob - crouch);
  // cola peluda
  const tw = s(t * 5 + v.id) * 0.15 + (moving ? s(w) * 0.1 : 0);
  furBlob(ctx, () => { ctx.moveTo(-0.45, -0.85); ctx.quadraticCurveTo(-0.95, -0.95 + tw, -1.2, -0.55 + tw); ctx.quadraticCurveTo(-1.1, -0.85 + tw, -0.92, -0.62 + tw); ctx.quadraticCurveTo(-0.85, -0.45, -0.45, -0.62); ctx.closePath(); }, FUR, [-0.9, -0.85], 0.6);
  ctx.strokeStyle = alpha(FUR_RIM, 0.6); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.5, -0.86); ctx.quadraticCurveTo(-0.95, -0.95 + tw, -1.18, -0.6 + tw); ctx.stroke();
  // piernas: digitígradas, la de atrás más oscura
  const leg = (i: number) => {
    const back = i === 0, ph = back ? 0 : Math.PI, sw = moving ? s(w + ph) : 0, lift = moving ? Math.max(0, Math.cos(w + ph)) * 0.25 : 0;
    const hip: Pt = [back ? -0.32 : -0.12, -0.68], knee: Pt = [hip[0] + 0.28 + sw * 0.25, -0.42 - lift * 0.5 + (leap ? -0.15 : 0)], ankle: Pt = [knee[0] - 0.22 + sw * 0.1, -0.16 - lift], foot: Pt = [ankle[0] + 0.12 + sw * 0.15, -0.02 - lift * 0.6];
    const c = back ? darken(FUR, 0.3) : FUR;
    segment(ctx, hip, knee, 0.46, 0.3, c, 0.4);
    segment(ctx, knee, ankle, 0.26, 0.2, back ? darken(FUR_L, 0.4) : FUR_L, 0.4);
    segment(ctx, ankle, foot, 0.2, 0.18, back ? darken(FUR_L, 0.4) : FUR_L, 0.4);
    wolfClaw(ctx, [foot[0] + 0.05, foot[1] - 0.02], Math.PI / 2 + 0.2, back, 0.9);
  };
  leg(0);
  // brazo de atrás (apoya los nudillos en el piso cuando corre)
  const arm = (i: number) => {
    const back = i === 0, sh: Pt = [0.22, -1.08 + (leap ? -0.05 : 0)], ph = back ? Math.PI : 0;
    let elbow: Pt, hand: Pt;
    if (!back && swipe > 0) { elbow = [sh[0] + 0.3 + swipe * 0.15, sh[1] - 0.15 - swipe * 0.15]; hand = [elbow[0] + 0.35, elbow[1] + 0.05 + swipe * 0.45]; }
    else if (leap) { elbow = [sh[0] + 0.32, sh[1] - (back ? 0.05 : 0.2)]; hand = [elbow[0] + 0.32, elbow[1] - 0.05]; }
    else { const sw = moving ? s(w + ph) * 0.3 : 0; elbow = [sh[0] + 0.22 + sw, sh[1] + 0.35]; hand = [elbow[0] + 0.15 + sw * 0.6, back || moving ? -0.08 : elbow[1] + 0.3]; }
    const c = back ? darken(FUR_L, 0.4) : FUR_L;
    segment(ctx, sh, elbow, 0.36, 0.28, c, 0.25);
    segment(ctx, elbow, hand, 0.28, 0.2, c, 0.25);
    wolfClaw(ctx, hand, Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]), back, 1.15);
  };
  arm(0);
  // el cuerpo: lomo peludo y encorvado, pecho y panza claros
  furBlob(ctx, () => { ctx.moveTo(-0.5, -0.62); ctx.quadraticCurveTo(-0.62, -1.12, -0.2, -1.4); ctx.quadraticCurveTo(0.25, -1.55, 0.5, -1.25); ctx.quadraticCurveTo(0.45, -0.95, 0.25, -0.7); ctx.quadraticCurveTo(-0.1, -0.55, -0.5, -0.62); ctx.closePath(); }, FUR, [-0.1, -1.35], 0.9);
  furBlob(ctx, () => { ctx.moveTo(0.05, -1.12); ctx.quadraticCurveTo(0.45, -1.15, 0.42, -0.88); ctx.quadraticCurveTo(0.3, -0.62, -0.05, -0.66); ctx.quadraticCurveTo(-0.15, -0.9, 0.05, -1.12); ctx.closePath(); }, FUR_L, [0.25, -0.95], 0.5);
  ctx.strokeStyle = darken(FUR_L, 0.35); ctx.lineWidth = 0.015; ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(0.08 + k * 0.04, -0.84 + k * 0.05); ctx.lineTo(0.3 - k * 0.02, -0.84 + k * 0.05); } ctx.stroke(); // abdominales
  ctx.strokeStyle = '#b3101e'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0.15, -1.05); ctx.lineTo(0.28, -0.95); ctx.stroke(); // cicatriz
  // pelos en punta a lo largo del lomo, con brillo rojo
  const qb = (a: Pt, b: Pt, c: Pt, u: number): [Pt, Pt] => [[(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]], [2 * (1 - u) * (b[0] - a[0]) + 2 * u * (c[0] - b[0]), 2 * (1 - u) * (b[1] - a[1]) + 2 * u * (c[1] - b[1])]];
  for (let k = 0; k < 11; k++) {
    const u = k / 10, [pt, d] = k < 6 ? qb([-0.5, -0.62], [-0.62, -1.12], [-0.2, -1.4], 0.25 + u * 1.3) : qb([-0.2, -1.4], [0.25, -1.55], [0.5, -1.25], (u - 0.5) * 1.4);
    const L = Math.hypot(d[0], d[1]) || 1, nx = d[1] / L, ny = -d[0] / L, tx = d[0] / L, ty = d[1] / L, h = 0.16 + (k % 2) * 0.07;
    const tip: Pt = [pt[0] + nx * h - tx * 0.12, pt[1] + ny * h - ty * 0.12];
    ctx.fillStyle = '#3a2c44'; ctx.beginPath(); ctx.moveTo(pt[0] - tx * 0.08, pt[1] - ty * 0.08); ctx.lineTo(...tip); ctx.lineTo(pt[0] + tx * 0.08, pt[1] + ty * 0.08); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = alpha(FUR_RIM, 0.75); ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(pt[0] + tx * 0.08, pt[1] + ty * 0.08); ctx.lineTo(...tip); ctx.stroke();
  }
  // pantalón negro roto, cinturón y taparrabos rojo
  shade(ctx, () => { ctx.moveTo(-0.5, -0.72); ctx.lineTo(0.18, -0.72); ctx.lineTo(0.22, -0.42); ctx.lineTo(0.05, -0.36); ctx.lineTo(-0.1, -0.44); ctx.lineTo(-0.3, -0.36); ctx.lineTo(-0.52, -0.44); ctx.closePath(); }, '#141118', { x: -0.1, y: -0.7, r: 0.5, tex: 0.5, lw: 0.8 });
  shade(ctx, () => ctx.roundRect(-0.52, -0.8, 0.74, 0.1, 0.03), '#6a3b22', { x: -0.1, y: -0.79, r: 0.4, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.06, -0.82, 0.12, 0.14, 0.02), '#c4c8d2', { x: -0.03, y: -0.8, r: 0.1, hi: 0.7, lw: 0.6 });
  shade(ctx, () => { ctx.moveTo(-0.02, -0.7); ctx.lineTo(0.2, -0.7); ctx.lineTo(0.22, -0.4); ctx.lineTo(0.16, -0.45); ctx.lineTo(0.12, -0.32); ctx.lineTo(0.06, -0.42); ctx.lineTo(0.0, -0.36); closeIt(ctx); }, '#b3101e', { x: 0.1, y: -0.65, r: 0.3, lw: 0.6 });
  leg(1);
  // la cabeza: hacia adelante y abajo, con el hocico abierto
  ctx.save(); ctx.translate(0.48, -1.28 + (swipe > 0 ? -0.05 : 0)); ctx.rotate(leap ? -0.15 : 0.08 + s(t * 3 + v.id) * 0.03);
  const open = 0.1 + swipe * 0.1 + (leap ? 0.08 : 0) + (v.state === 'walk' ? 0.03 * s(t * 6) : 0);
  furBlob(ctx, () => { ctx.moveTo(-0.25, -0.18); ctx.lineTo(-0.2, -0.48); ctx.lineTo(-0.02, -0.25); closeIt(ctx); }, FUR, [-0.15, -0.3], 0.3); // oreja
  ctx.fillStyle = '#8a2a3a'; ctx.beginPath(); ctx.moveTo(-0.19, -0.22); ctx.lineTo(-0.18, -0.4); ctx.lineTo(-0.07, -0.25); ctx.closePath(); ctx.fill();
  furBlob(ctx, () => { ctx.moveTo(-0.3, 0.1); ctx.quadraticCurveTo(-0.34, -0.28, 0.0, -0.3); ctx.quadraticCurveTo(0.22, -0.3, 0.3, -0.15); ctx.lineTo(0.58, -0.06); ctx.quadraticCurveTo(0.64, 0.0, 0.58, 0.04); ctx.lineTo(0.2, 0.06); ctx.quadraticCurveTo(0.0, 0.25, -0.3, 0.1); ctx.closePath(); }, FUR_L, [0.1, -0.2], 0.5);
  // mandíbula de abajo
  furBlob(ctx, () => { ctx.moveTo(-0.1, 0.12); ctx.lineTo(0.2, 0.06 + open * 0.3); ctx.lineTo(0.5, 0.08 + open); ctx.quadraticCurveTo(0.4, 0.2 + open, 0.1, 0.22 + open * 0.5); ctx.closePath(); }, darken(FUR_L, 0.1), [0.2, 0.1], 0.3);
  ctx.fillStyle = '#5a0710'; ctx.beginPath(); ctx.moveTo(0.18, 0.05); ctx.lineTo(0.56, 0.04); ctx.lineTo(0.48, 0.08 + open); ctx.lineTo(0.18, 0.09 + open * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d0475a'; ctx.beginPath(); ctx.ellipse(0.32, 0.08 + open * 0.6, 0.1, 0.03, 0.2, 0, TAU); ctx.fill(); // lengua
  ctx.fillStyle = '#fbf6ee'; for (const fx of [0.24, 0.36, 0.48]) { ctx.beginPath(); ctx.moveTo(fx - 0.025, 0.045); ctx.lineTo(fx, 0.045 + (fx === 0.48 ? 0.09 : 0.05)); ctx.lineTo(fx + 0.025, 0.045); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(fx - 0.02, 0.09 + open * (0.4 + fx)); ctx.lineTo(fx - 0.01, 0.04 + open * (0.4 + fx)); ctx.lineTo(fx + 0.01, 0.09 + open * (0.4 + fx)); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#100c12'; ctx.beginPath(); ctx.ellipse(0.6, -0.04, 0.05, 0.04, 0, 0, TAU); ctx.fill(); // nariz
  vampEye(ctx, 0.1, -0.13, 0.055, 0.04, t);
  ctx.strokeStyle = '#100c12'; ctx.lineWidth = 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.0, -0.22); ctx.lineTo(0.2, -0.15); ctx.stroke(); // ceja
  // melena
  for (let k = 0; k < 6; k++) { const bx = -0.3 + k * 0.02, by = -0.2 + k * 0.08; ctx.fillStyle = FUR; ctx.beginPath(); ctx.moveTo(bx + 0.05, by - 0.06); ctx.lineTo(bx - 0.22, by + 0.02); ctx.lineTo(bx + 0.05, by + 0.08); ctx.closePath(); ctx.fill(); ctx.strokeStyle = alpha(FUR_RIM, 0.6); ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(bx + 0.05, by - 0.06); ctx.lineTo(bx - 0.22, by + 0.02); ctx.stroke(); }
  ctx.restore();
  arm(1);
  ctx.restore();
}
const closeIt = (ctx: CanvasRenderingContext2D) => ctx.closePath();

// ---------------------------------------------------------------- Drácula
function draculaTorso(ctx: CanvasRenderingContext2D, t: number) {
  const torso = () => { ctx.moveTo(-0.3, 0.06); ctx.lineTo(-0.42, -0.42); ctx.quadraticCurveTo(0, -0.64, 0.42, -0.42); ctx.lineTo(0.3, 0.06); ctx.closePath(); };
  shade(ctx, torso, DRAC.armor, { x: 0.08, y: -0.45, r: 0.6, hi: 0.5, tex: 0.3 });
  // placas con borde de plata
  ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.moveTo(-0.3, -0.42); ctx.lineTo(-0.16, -0.16); ctx.lineTo(0.0, -0.1); ctx.lineTo(0.16, -0.16); ctx.lineTo(0.3, -0.42); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.24, -0.06); ctx.quadraticCurveTo(0, 0.0, 0.24, -0.06); ctx.stroke();
  spec(ctx, 0.12, -0.36, 0.1, 0.05, -0.3, 0.5);
  gem(ctx, 0.0, -0.3, 0.06, '#d8dce6', t);
  // cinturón con el murciélago de plata y la gema
  shade(ctx, () => ctx.roundRect(-0.3, -0.06, 0.58, 0.1, 0.03), '#5c0910', { x: 0, y: -0.05, r: 0.3, lw: 0.6 });
  ctx.fillStyle = '#c4c8d2'; ctx.beginPath(); ctx.moveTo(0, -0.03); ctx.lineTo(-0.16, -0.08); ctx.lineTo(-0.12, 0.0); ctx.lineTo(-0.16, 0.06); ctx.lineTo(0, 0.04); ctx.lineTo(0.16, 0.06); ctx.lineTo(0.12, 0.0); ctx.lineTo(0.16, -0.08); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.012; ctx.stroke();
  gem(ctx, 0, 0.005, 0.03, '#c4c8d2', t);
  // faldón carmesí en punta
  shade(ctx, () => { ctx.moveTo(-0.28, 0.05); ctx.lineTo(0.28, 0.05); ctx.lineTo(0.22, 0.3); ctx.lineTo(0.08, 0.26); ctx.lineTo(0.0, 0.42); ctx.lineTo(-0.08, 0.26); ctx.lineTo(-0.22, 0.3); ctx.closePath(); }, '#8e0f18', { x: 0, y: 0.08, r: 0.4, hi: 0.4, lw: 0.6 });
  ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(-0.08, 0.26); ctx.lineTo(0.0, 0.42); ctx.lineTo(0.08, 0.26); ctx.stroke();
}
function draculaPose(v: Vamp, t: number): Pose {
  const wp = walkerPose(v, t), br = Math.sin(t * 2.2 + v.id);
  if (v.state === 'cast') { const k = Math.min(1, v.t / 0.5); return { ...wp, lean: 0.05, crouch: 0.05, head: -0.15 * k, arms: [[1.8 + k * 0.6, 0.2], [2.0 + k * 0.7, 0.15]], blade: 0 }; }
  if (v.state === 'claw') { const up = v.t < 0.32 ? Math.min(1, v.t / 0.25) : Math.max(0, 1 - (v.t - 0.32) * 5); return { ...wp, lean: 0.3 - up * 0.25, arms: [[1.0 + up * 1.4, 0.6], [1.3 + up * 1.8, 0.4]], blade: 0 }; }
  return { ...wp, lean: 0.2, crouch: 0.12, arms: [[1.0 + br * 0.08, 0.9], [1.3 - br * 0.08, 0.8]], blade: 0 };
}
export function drawDraculaK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (v.state === 'mist') { // se deshace en murciélagos y vuelve a armarse en otro lado
    const k = v.t < 0.75 ? v.t / 0.75 : Math.max(0, 1 - (v.t - 0.75) / 0.4);
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * 1.3); drawDraculaBody(ctx, { ...v, state: 'walk' }, t); ctx.restore();
    for (let i = 0; i < 14; i++) { const a = i * 2.4 + t * 3, r = 0.3 + k * 1.4 * (0.5 + (i % 3) * 0.25); drawBat(ctx, Math.cos(a) * r, -1.1 + Math.sin(a * 1.3) * r * 0.7, 0.32, t * 2 + i, k); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -1.1, 1.6, '#a01020', 0.4 * k); ctx.restore();
    return;
  }
  drawDraculaBody(ctx, v, t);
}
function drawDraculaBody(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const pose = draculaPose(v, t);
  shadow(ctx, v, 0.55);
  setLimb(1.25);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck = neckOf(hip, pose);
  cape(ctx, neck, DRAC, t + v.id, Math.abs(v.vx) * 1.5 + 0.6, v.onGround ? 0 : 1, true);
  ctx.strokeStyle = '#c41a26'; ctx.lineWidth = 0.03; { ctx.save(); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(neck[0] - 0.35, neck[1] + 0.1); ctx.quadraticCurveTo(neck[0] - 0.9, neck[1] + 0.6, -0.95, -0.05); ctx.stroke(); ctx.restore(); } // forro rojo de la capa
  legDraw(ctx, hip, pose, 0, DRAC);
  armDraw(ctx, hip, pose, 0, DRAC, 'claw');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); draculaTorso(ctx, t); ctx.restore();
  spikedPauldron(ctx, shoulderAt(hip, pose, 0), 0.6, true, '#a3121c', '#d8dce6');
  legDraw(ctx, hip, pose, 1, DRAC);
  const head = () => { ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, true, false, { skin: DRAC.skin, collar: '#a3121c', beard: true, streak: true }); ctx.restore(); };
  const up = handOf(hip, pose, 1)[1] < neck[1] + 0.05;
  if (up) head();
  armDraw(ctx, hip, pose, 1, DRAC, 'claw');
  spikedPauldron(ctx, add(shoulderAt(hip, pose, 1), [-0.5, -1], 0.06), 0.6, false, '#a3121c', '#d8dce6');
  if (!up) head();
  if (v.state === 'cast') { const h = handOf(hip, pose, 1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, h[0], h[1], 0.6, '#ff1030', 0.6); ctx.restore(); }
  setLimb(1.2);
}

// Un murciélago chico (los que tira Drácula).
export function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ph: number, a = 1) {
  const f = Math.sin(ph * 14);
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.globalAlpha *= a;
  ctx.fillStyle = '#1a0a10'; ctx.strokeStyle = '#ff2a3a'; ctx.lineWidth = 0.04;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.4, -0.3 - f * 0.35, s * 0.9, -0.1 - f * 0.4); ctx.lineTo(s * 0.7, 0.05); ctx.lineTo(s * 0.55, -0.02); ctx.lineTo(s * 0.4, 0.12); ctx.lineTo(s * 0.25, 0.04); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, 0.02, 0.16, 0.2, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-0.1, -0.12); ctx.lineTo(-0.08, -0.3); ctx.lineTo(0, -0.15); ctx.lineTo(0.08, -0.3); ctx.lineTo(0.1, -0.12); ctx.fill();
  ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(-0.05, -0.04, 0.03, 0, TAU); ctx.arc(0.05, -0.04, 0.03, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Drácula dragón
// Centro del cuerpo en (0, 0); las patas tocan el piso en y = +1.25.
function dragonWing(ctx: CanvasRenderingContext2D, flap: number, back: boolean) {
  const up = flap, wrist: Pt = [0.3, -1.3 - up * 0.7];
  const tips: Pt[] = [[1.5, -2.3 - up * 0.8], [2.3, -1.4 - up * 0.6], [2.4, -0.3 - up * 0.2], [1.6, 0.5], [0.5, 0.4]];
  const m0 = back ? '#6a0a12' : '#d41a26', m1 = back ? '#22040a' : '#5a0810';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wrist[0], wrist[1]); ctx.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) { const [ax, ay] = tips[i - 1], [bx, by] = tips[i]; ctx.quadraticCurveTo((ax + bx) / 2 - 0.25, (ay + by) / 2 + 0.1, bx, by); }
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, -1.5, 2.2, 0.5, [[0, m0], [0.6, darken(m0, 0.35)], [1, m1]]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.stroke();
  ctx.fillStyle = back ? 'rgba(0,0,0,0.3)' : 'rgba(20,0,4,0.35)'; for (const [hx, hy, r] of [[1.4, -1.1, 0.08], [1.8, -0.2, 0.06], [1.1, 0.1, 0.05]] as const) { ctx.beginPath(); ctx.arc(hx, hy - up * 0.3, r, 0, TAU); ctx.fill(); } // agujeros en la membrana
  const bone = back ? '#4a0a10' : '#a8141e';
  segment(ctx, [0, 0], wrist, 0.2, 0.14, bone, 0.4);
  for (const tp of tips.slice(0, 4)) segment(ctx, wrist, tp, 0.09, 0.04, bone, 0.3);
  ctx.fillStyle = back ? '#8a7d70' : '#efe2cf'; ctx.beginPath(); ctx.moveTo(wrist[0] - 0.08, wrist[1]); ctx.quadraticCurveTo(wrist[0] - 0.05, wrist[1] - 0.4, wrist[0] + 0.15, wrist[1] - 0.45); ctx.quadraticCurveTo(wrist[0] + 0.02, wrist[1] - 0.2, wrist[0] + 0.1, wrist[1]); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke(); // garra del ala
}
function dragonFoot(ctx: CanvasRenderingContext2D, p: Pt, back: boolean, size = 1) {
  const c = back ? '#6a0a12' : '#c8141e';
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(size, size);
  shade(ctx, () => ctx.ellipse(0.05, -0.05, 0.22, 0.12, 0, 0, TAU), c, { x: 0, y: -0.1, r: 0.25, lw: 0.8 });
  for (const k of [-0.12, 0.06, 0.22]) { ctx.fillStyle = back ? '#8a7d70' : '#f4ead6'; ctx.beginPath(); ctx.moveTo(k - 0.04, -0.02); ctx.quadraticCurveTo(k + 0.12, -0.02, k + 0.14, 0.08); ctx.lineTo(k + 0.03, 0.03); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); }
  ctx.restore();
}
export function drawDragonK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const s = Math.sin, flying = v.state !== 'land', flap = flying ? s(v.walkT * 6 + v.id) : 0.3 + s(t * 2) * 0.05;
  const breath = v.state === 'breath' ? Math.min(1, v.t / 0.35) * (v.t > 1.9 ? Math.max(0, 1 - (v.t - 1.9) / 0.3) : 1) : 0;
  const stomp = v.state === 'land' ? Math.max(0, 1 - Math.min(Math.abs(v.t - 1.2), Math.abs(v.t - 2.2)) * 4) : 0;
  const dive = v.state === 'dive' ? 1 : 0;
  const RED = '#d0161f', REDD = '#7a0a12', BELLY = '#ecd6c4';
  ctx.save(); ctx.translate(0, flying ? s(v.walkT * 6 + v.id + 1) * 0.08 : 0); ctx.rotate(dive * 0.35);
  // ala de atrás (más oscura), sale del lomo hacia arriba y atrás
  ctx.save(); ctx.translate(0.05, -0.6); ctx.scale(-0.85, 0.85); ctx.rotate(-0.35); dragonWing(ctx, flap, true); ctx.restore();
  // la cola con pinches, que se curva para atrás
  const tw = s(t * 2.5 + v.id) * 0.2;
  const tail: Pt[] = [[-0.55, 0.35], [-1.2, 0.75 + tw * 0.4], [-1.9, 0.7 + tw], [-2.4, 0.3 + tw * 1.4], [-2.55, -0.1 + tw * 1.6]];
  for (let i = 0; i < tail.length - 1; i++) segment(ctx, tail[i], tail[i + 1], 0.55 - i * 0.12, 0.43 - i * 0.12, i % 2 ? RED : darken(RED, 0.06), 0.5);
  for (let i = 1; i < tail.length; i++) { const [x, y] = tail[i], h = 0.22 - i * 0.03; ctx.fillStyle = '#efe2cf'; ctx.beginPath(); ctx.moveTo(x - 0.1, y - 0.15); ctx.lineTo(x - 0.02, y - 0.2 - h); ctx.lineTo(x + 0.1, y - 0.15); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); }
  // patas: muslos gruesos, rodilla para adelante, pie con garras
  const legs = (back: boolean) => {
    const ox = back ? -0.45 : -0.1, sw = flying ? s(t * 3 + (back ? 1 : 0)) * 0.1 : 0, hip: Pt = [ox, 0.3];
    const knee: Pt = flying ? [ox + 0.25 + sw, 0.7] : [ox + 0.45, 0.68 - (back ? 0 : stomp * 0.3)], foot: Pt = flying ? [ox - 0.1 + sw, 1.05] : [ox + 0.1, 1.17 - (back ? 0 : stomp * 0.4)];
    segment(ctx, hip, knee, 0.62, 0.36, back ? REDD : RED, 0.5); segment(ctx, knee, foot, 0.3, 0.22, back ? REDD : RED, 0.5);
    dragonFoot(ctx, [foot[0] + 0.1, foot[1] + 0.05], back, 1.15);
  };
  legs(true);
  // el cuerpo, inclinado con el pecho para arriba
  ctx.save(); ctx.rotate(-0.4);
  shade(ctx, () => ctx.ellipse(0, 0, 0.95, 0.62, 0, 0, TAU), RED, { x: -0.1, y: -0.4, r: 1.1, hi: 0.35, tex: 0.5, lw: 1.4 });
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 0.95, 0.62, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, 0.62, [[0, lighten(BELLY, 0.15)], [1, darken(BELLY, 0.35)]]); ctx.beginPath(); ctx.ellipse(0.25, 0.42, 0.85, 0.38, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = darken(BELLY, 0.45); ctx.lineWidth = 0.025; for (let i = -3; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0.2 + i * 0.17, 0.05); ctx.quadraticCurveTo(0.22 + i * 0.17, 0.3, 0.18 + i * 0.17, 0.62); ctx.stroke(); } // placas
  ctx.fillStyle = 'rgba(80,0,10,0.3)'; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(-0.8 + (i * 0.37) % 1.5, -0.45 + ((i * 0.53) % 0.45), 0.03, 0, TAU); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 5; i++) { const x = -0.75 + i * 0.32, y = -0.56 + Math.abs(x) * 0.12; ctx.fillStyle = '#efe2cf'; ctx.beginPath(); ctx.moveTo(x - 0.1, y + 0.06); ctx.lineTo(x - 0.05, y - 0.24); ctx.lineTo(x + 0.08, y + 0.06); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); } // pinches del lomo
  ctx.restore();
  legs(false);
  // ala de adelante
  ctx.save(); ctx.translate(-0.15, -0.55); ctx.scale(-1, 1); ctx.rotate(-0.15); dragonWing(ctx, flap * 0.95, false); ctx.restore();
  // brazo de adelante con garras (en la picada y al pisotear, estirado)
  { const reach = Math.max(dive, stomp, breath * 0.3), sh: Pt = [0.55, -0.35], el: Pt = [0.85 + reach * 0.25, 0.05 - reach * 0.1], hd: Pt = [1.0 + reach * 0.5, 0.35 - reach * 0.05];
    segment(ctx, sh, el, 0.34, 0.24, RED, 0.5); segment(ctx, el, hd, 0.24, 0.18, RED, 0.5);
    ctx.save(); ctx.translate(hd[0], hd[1]); for (const a of [-0.5, 0.0, 0.5]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.moveTo(-0.03, 0); ctx.quadraticCurveTo(0.22, 0.0, 0.24, 0.2); ctx.lineTo(0.05, 0.05); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); ctx.restore(); }
    shade(ctx, () => ctx.ellipse(0, 0, 0.15, 0.12, 0, 0, TAU), RED, { x: -0.03, y: -0.03, r: 0.15, lw: 0.8 }); ctx.restore(); }
  // el cuello que sube y la cabeza grande
  const nk: Pt = [0.55, -0.6], mid: Pt = [0.95 + breath * 0.1, -1.25 + dive * 0.3], hd: Pt = [1.45 + breath * 0.25, -1.6 + breath * 0.25 + dive * 0.55];
  segment(ctx, nk, mid, 0.62, 0.48, RED, 0.5); segment(ctx, mid, hd, 0.48, 0.42, RED, 0.5);
  ctx.strokeStyle = BELLY; ctx.lineWidth = 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(nk[0] + 0.25, nk[1] + 0.15); ctx.quadraticCurveTo(mid[0] + 0.2, mid[1] + 0.1, hd[0] + 0.12, hd[1] + 0.22); ctx.stroke();
  ctx.strokeStyle = darken(BELLY, 0.4); ctx.lineWidth = 0.015; for (let k = 0.15; k < 1; k += 0.17) { const x = nk[0] + 0.25 + (hd[0] - nk[0] - 0.13) * k, y = nk[1] + 0.15 + (hd[1] - nk[1] + 0.07) * k; ctx.beginPath(); ctx.moveTo(x - 0.08, y - 0.02); ctx.lineTo(x + 0.08, y + 0.02); ctx.stroke(); }
  for (let i = 0; i < 4; i++) { const k = i / 4, x = nk[0] + (hd[0] - nk[0]) * k - 0.22, y = nk[1] + (hd[1] - nk[1]) * k - 0.1; ctx.fillStyle = '#efe2cf'; ctx.beginPath(); ctx.moveTo(x + 0.05, y + 0.06); ctx.lineTo(x - 0.22, y - 0.06); ctx.lineTo(x + 0.08, y - 0.08); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); }
  ctx.save(); ctx.translate(hd[0], hd[1]); ctx.rotate(0.05 + breath * 0.25 + dive * 0.3); ctx.scale(1.35, 1.35);
  const jaw = 0.1 + breath * 0.28 + dive * 0.2 + stomp * 0.15 + (v.state === 'hover' ? 0.04 * s(t * 3) : 0);
  for (const [hx, back] of [[-0.28, true], [-0.12, false]] as const) { ctx.beginPath(); ctx.moveTo(hx - 0.06, -0.15); ctx.quadraticCurveTo(hx - 0.3, -0.5, hx - 0.15 + (back ? -0.08 : 0), -0.72); ctx.quadraticCurveTo(hx - 0.1, -0.45, hx + 0.1, -0.18); ctx.closePath(); ctx.fillStyle = grad(ctx, hx - 0.2, -0.7, hx + 0.1, -0.2, [[0, back ? '#8a7d70' : '#f4ead6'], [1, back ? '#4a4038' : '#a99a86']]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke(); } // cuernos
  shade(ctx, () => { ctx.moveTo(-0.2, 0.05); ctx.lineTo(0.55, 0.08 + jaw * 0.9); ctx.quadraticCurveTo(0.45, 0.2 + jaw, 0.0, 0.2); ctx.closePath(); }, darken(RED, 0.1), { x: 0.1, y: 0.1, r: 0.4, lw: 1 }); // mandíbula
  ctx.fillStyle = '#3a0408'; ctx.beginPath(); ctx.moveTo(-0.1, 0.02); ctx.lineTo(0.6, 0.02); ctx.lineTo(0.55, 0.08 + jaw * 0.9); ctx.lineTo(-0.1, 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d0475a'; ctx.beginPath(); ctx.ellipse(0.25, 0.06 + jaw * 0.5, 0.15, 0.035, 0.2, 0, TAU); ctx.fill();
  shade(ctx, () => { ctx.moveTo(-0.35, 0.05); ctx.quadraticCurveTo(-0.38, -0.32, -0.05, -0.32); ctx.quadraticCurveTo(0.2, -0.3, 0.35, -0.15); ctx.lineTo(0.68, -0.06); ctx.quadraticCurveTo(0.75, 0.02, 0.65, 0.05); ctx.lineTo(-0.1, 0.06); ctx.closePath(); }, RED, { x: 0.05, y: -0.25, r: 0.6, hi: 0.4, tex: 0.4, lw: 1.2 });
  ctx.fillStyle = '#fbf6ee'; for (let i = 0; i < 5; i++) { const fx = 0.05 + i * 0.12, lo = jaw * 0.9 * (fx / 0.6); ctx.beginPath(); ctx.moveTo(fx - 0.03, 0.04); ctx.lineTo(fx, 0.04 + (i % 2 ? 0.07 : 0.11)); ctx.lineTo(fx + 0.03, 0.04); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(fx - 0.025, 0.1 + lo); ctx.lineTo(fx, 0.02 + lo); ctx.lineTo(fx + 0.025, 0.1 + lo); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#2a0408'; ctx.beginPath(); ctx.ellipse(0.62, -0.06, 0.035, 0.02, 0, 0, TAU); ctx.fill(); // narina
  for (let i = 0; i < 4; i++) { ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(-0.32, -0.12 + i * 0.07); ctx.lineTo(-0.62 - i * 0.03, -0.22 + i * 0.12); ctx.lineTo(-0.3, -0.02 + i * 0.07); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke(); } // espinas de la nuca
  vampEye(ctx, 0.12, -0.14, 0.075, 0.045, t);
  ctx.strokeStyle = '#3a0408'; ctx.lineWidth = 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.02, -0.25); ctx.lineTo(0.24, -0.16); ctx.stroke(); // ceja enojada
  if (breath > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.6, 0.08, 0.6, '#ff7a1a', 0.8 * breath); ctx.restore(); }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Todos
// Los vampiros con el diseño nuevo (vampyriumVamps): más grandes, de tres cuartos, negro con dorado y rojo.
export function drawVampK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  hitFlash(ctx, v, c => drawVampHD(c, v, t));
}
// Lo que tiran (en unidades del mundo, ya trasladado al lugar del tiro): bola de fuego, murciélago o llama.
export function drawShotK(ctx: CanvasRenderingContext2D, s: Shot, t: number) {
  if (s.kind === 'bat') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, 0.7, '#ff1030', 0.35); ctx.restore(); ctx.save(); ctx.scale(Math.sign(s.vx) || 1, 1); drawBat(ctx, 0, 0, 0.8, t + s.t * 3 + s.x); ctx.restore(); return; } // los murciélagos de Drácula (más grandes, con un halo rojo)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (s.kind === 'orb') {
    const a = Math.atan2(s.vy, s.vx);
    for (let i = 0; i < 6; i++) { const k = i / 6; ctx.fillStyle = `rgba(255,${80 + i * 20},40,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(-Math.cos(a) * k * 0.9, Math.sin(a) * k * 0.9, 0.32 * (1 - k * 0.7), 0, TAU); ctx.fill(); }
    bloom(ctx, 0, 0, 0.9, '#ff3a1a', 0.7);
    ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(0, 0, 0.14, 0, TAU); ctx.fill();
  } else { // una lengua de fuego: blanca y amarilla al salir, naranja y roja después y al final humo
    const k = Math.min(1, s.t / s.life), r = 0.28 + k * 0.5, a = Math.atan2(-s.vy, s.vx), fl = 1 + 0.18 * Math.sin(s.t * 47 + s.x * 9);
    bloom(ctx, 0, 0, r * 2.2, '#ff5a10', 0.55 * (1 - k));
    ctx.rotate(a);
    for (const [w, c] of [[1, k < 0.5 ? `rgba(255,70,10,${0.75 - k * 0.6})` : `rgba(200,30,10,${0.7 - k * 0.65})`], [0.65, `rgba(255,${170 - k * 90},30,${0.85 - k * 0.8})`], [0.32, `rgba(255,250,210,${Math.max(0, 0.95 - k * 1.5)})`]] as const) {
      const rr = r * w * fl; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(rr, 0); ctx.quadraticCurveTo(rr * 0.6, -rr * 0.95, -rr * 0.3, -rr * 0.7); ctx.quadraticCurveTo(-rr * 2.4, -rr * 0.3 * Math.sin(s.t * 31), -rr * 2.6, 0); ctx.quadraticCurveTo(-rr * 2.4, rr * 0.3, -rr * 0.3, rr * 0.7); ctx.quadraticCurveTo(rr * 0.6, rr * 0.95, rr, 0); ctx.fill();
    }
    if (k > 0.55) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(40,20,20,${(k - 0.55) * 0.7})`; ctx.beginPath(); ctx.arc(-r * 0.6, -r * 0.3, r * 0.8, 0, TAU); ctx.fill(); } // humo
  }
  ctx.restore();
}
