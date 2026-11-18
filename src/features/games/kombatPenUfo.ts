import ufoUrl from './assets/penales/ovni.png';
import { FINAL_END_AT, FINAL_SHOT_AT } from './kombatPenalties';

export const UFO_WIDTH = 3.8;
const TAU = Math.PI * 2;
export const UFO_COLORS = ['#ff395a', '#ffb62e', '#b9ff40', '#37ffbf', '#29dcff', '#697bff', '#d65cff', '#ff69ce'] as const;
// Cada lámpara conserva su identidad: el ángulo cambia, el orden de colores no.
export function ufoLights(t: number) {
  return Array.from({ length: 16 }, (_, i) => ({ id: i, color: UFO_COLORS[i % UFO_COLORS.length], angle: i * TAU / 16 + t * 1.8 }));
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const q = clamp(v); return q * q * (3 - 2 * q); };
export function ufoSequence(t: number) {
  return { enter: smooth(t / 1.15), beam: t < 1.55 || t > FINAL_SHOT_AT + 0.65 ? 0 : Math.min(smooth((t - 1.55) / 0.2), 1 - smooth((t - FINAL_SHOT_AT - 0.25) / 0.4)), leave: smooth((t - (FINAL_END_AT - 1.1)) / 1.1) };
}

// La silueta es continua en cada fila: nunca se perfora el interior oscuro.
export function maskUfoSilhouette(data: Uint8ClampedArray, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    let left = width, right = -1;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (Math.max(data[p], data[p + 1], data[p + 2]) > 28) { left = Math.min(left, x); right = x; }
    }
    for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = x >= left && x <= right ? 255 : 0;
  }
}

let image: HTMLImageElement | null = null;
let sprite: HTMLCanvasElement | null = null;
let platter: HTMLCanvasElement | null = null;

export function preloadPenUfo() {
  if (image || typeof Image === 'undefined') return;
  image = new Image(); image.src = ufoUrl;
  image.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
    const c = canvas.getContext('2d'); if (!c || !image) return;
    c.drawImage(image, 0, 0);
    // Recortar por el contorno exterior conserva opacos todos los negros del casco.
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    maskUfoSilhouette(pixels.data, canvas.width, canvas.height);
    c.putImageData(pixels, 0, 0); sprite = canvas;
    // Textura del plato tomada de su mitad frontal, sin arrastrar al piloto al girar.
    platter = document.createElement('canvas'); platter.width = canvas.width; platter.height = canvas.height;
    const p = platter.getContext('2d'); if (!p) return;
    p.drawImage(canvas, 0, 530, 1536, 494, 0, 530, 1536, 494);
    p.translate(0, 1060); p.scale(1, -1); p.drawImage(canvas, 0, 530, 1536, 494, 0, 530, 1536, 494);
  };
}

function drawCraft(ctx: CanvasRenderingContext2D, t: number) {
  if (!sprite) return;
  ctx.drawImage(sprite, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.ellipse(768, 530, 668, 234, 0, 0, TAU); ctx.ellipse(768, 530, 432, 150, 0, 0, TAU, true); ctx.clip('evenodd');
  ctx.save(); ctx.translate(768, 530); ctx.scale(668, 234); ctx.rotate(t * 1.8); ctx.scale(1 / 668, 1 / 234); ctx.translate(-768, -530);
  if (platter) ctx.drawImage(platter, 0, 0); ctx.restore();
  // Juntas y remaches giran con el mismo ángulo que las lámparas.
  for (const lamp of ufoLights(t)) {
    const a = lamp.angle, ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = 'rgba(10,17,30,0.65)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(768 + ca * 435, 530 + sa * 152); ctx.lineTo(768 + ca * 666, 530 + sa * 233); ctx.stroke();
    ctx.strokeStyle = 'rgba(213,232,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
  // Cabina y alien delante del sector trasero del anillo, sin girar de costado.
  ctx.save(); ctx.beginPath(); ctx.moveTo(326, 430); ctx.bezierCurveTo(365, 345, 405, 370, 423, 350); ctx.bezierCurveTo(480, -5, 1055, -5, 1113, 350); ctx.bezierCurveTo(1140, 370, 1180, 345, 1210, 430); ctx.bezierCurveTo(1205, 630, 330, 630, 326, 430); ctx.closePath(); ctx.clip(); ctx.drawImage(sprite, 0, 0); ctx.restore();
  for (const lamp of ufoLights(t).sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle))) {
    const a = lamp.angle, x = 768 + Math.cos(a) * 637, y = 543 + Math.sin(a) * 225;
    // Las luces de atrás quedan tapadas por la cabina.
    if (Math.sin(a) < -0.15 && Math.abs(Math.cos(a)) < 0.67) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.48); ctx.rotate(a);
    ctx.fillStyle = '#111724'; ctx.beginPath(); ctx.roundRect(-29, -13, 58, 26, 12); ctx.fill();
    ctx.shadowColor = lamp.color; ctx.shadowBlur = 30; ctx.fillStyle = lamp.color; ctx.beginPath(); ctx.roundRect(-23, -8, 46, 16, 8); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#f3ffff'; ctx.globalAlpha = 0.85; ctx.fillRect(-15, -2, 30, 3); ctx.restore();
  }
}

// El ovni solo (para Kombat Football): centrado en (cx, cy) con `width` píxeles de ancho. Devuelve la altura en
// pantalla del emisor (de donde sale el rayo), o null si la imagen todavía no cargó.
export function drawUfoCraftAt(ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number, width: number): number | null {
  preloadPenUfo();
  const scale = width / 1536;
  if (!sprite) return null;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.translate(cx - width / 2, cy - 512 * scale); ctx.scale(scale, scale); drawCraft(ctx, t); ctx.restore();
  return cy + (870 - 512) * scale;
}

export function drawPenUfo(ctx: CanvasRenderingContext2D, t: number, target: { x: number; y: number; h: number }) {
  preloadPenUfo();
  const seq = ufoSequence(t); if (t >= FINAL_END_AT) return;
  const width = target.h * UFO_WIDTH, scale = width / 1536;
  const x = target.x + (1 - seq.enter) * 650 + seq.leave * 500;
  const y = target.y - target.h * 2.15 - (1 - seq.enter) * 650 - seq.leave * 750 + Math.sin(t * 3.5) * 9;
  const nozzleY = y + (870 - 512) * scale, hitY = target.y - target.h * 0.5;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (seq.beam > 0) {
    ctx.save(); ctx.globalAlpha *= seq.beam; ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(x, nozzleY, target.x, target.y); beam.addColorStop(0, 'rgba(135,255,255,0.95)'); beam.addColorStop(0.5, 'rgba(30,221,255,0.5)'); beam.addColorStop(1, 'rgba(37,222,255,0.08)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - 22, nozzleY); ctx.lineTo(target.x - target.h * 0.48, target.y); ctx.quadraticCurveTo(target.x, target.y + 40, target.x + target.h * 0.48, target.y); ctx.lineTo(x + 22, nozzleY); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#24eaff'; ctx.shadowBlur = 45; ctx.strokeStyle = '#caffff'; ctx.lineWidth = 9 + Math.sin(t * 65) * 3; ctx.beginPath(); ctx.moveTo(x, nozzleY); ctx.lineTo(target.x, hitY); ctx.stroke();
    ctx.strokeStyle = 'rgba(39,221,255,0.35)'; ctx.lineWidth = 50; ctx.stroke();
    ctx.fillStyle = 'rgba(91,244,255,0.55)'; ctx.beginPath(); ctx.ellipse(target.x, target.y, target.h * 0.5, target.h * 0.13, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(x - width / 2, y - 512 * scale); ctx.scale(scale, scale); drawCraft(ctx, t); ctx.restore();
  // Carga del emisor antes del disparo, sin dibujar un rayo antes de tiempo.
  const charge = smooth((t - 0.8) / 0.75) * (1 - smooth((t - FINAL_SHOT_AT - 0.3) / 0.4));
  if (charge > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, nozzleY, 0, x, nozzleY, 75); g.addColorStop(0, `rgba(200,255,255,${charge})`); g.addColorStop(1, 'rgba(0,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 75, nozzleY - 75, 150, 150); ctx.restore(); }
  ctx.restore();
}
