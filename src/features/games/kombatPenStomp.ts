import bootUrl from './assets/penales/botines-cutout.png';
import { DEATH_AT, DEATH_LENGTH, type PenDeath } from './kombatPenalties';

let boot: HTMLImageElement | null = null;
export function preloadPenStomp() {
  if (boot || typeof Image === 'undefined') return;
  boot = new Image(); boot.src = bootUrl;
}
export function stompHeight(t: number) {
  const fall = Math.max(0, Math.min(1, (t - 0.8) / (DEATH_AT.stomp - 0.8)));
  const rise = Math.max(0, Math.min(1, (t - 3.5) / (DEATH_LENGTH - 3.5)));
  return 3.6 * (1 - fall * fall * fall) + rise * rise * 4;
}
export function drawPenStomp(ctx: CanvasRenderingContext2D, d: PenDeath) {
  preloadPenStomp(); if (!boot?.complete || !boot.naturalWidth) return;
  const height = stompHeight(d.t), w = Math.max(d.h, 250) * 3.2, h = w * boot.naturalHeight / boot.naturalWidth;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${0.4 / (1 + height)})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, w * 0.44 / (1 + height * 0.15), d.h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(boot, d.x - w * 0.5, d.y - h - height * d.h + d.h * 0.04, w, h);
  ctx.restore();
}
