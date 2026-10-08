// Lo que comparten los dibujos de "Ciudad Tiburón": la vista (cámara y escala) y cómo pasar de las unidades
// del juego a la pantalla.
export interface View { w: number; h: number; s: number; cx: number; cy: number; t: number; dpr: number }
export const X = (v: View, x: number) => (x - v.cx) * v.s;
export const Y = (v: View, y: number) => v.h - (y - v.cy) * v.s;
export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const visible = (v: View, x1: number, x2: number, y1: number, y2: number) => X(v, x2) > -60 && X(v, x1) < v.w + 60 && Y(v, y1) > -60 && Y(v, y2) < v.h + 60;
export const font = (weight: number, px: number) => `${weight} ${Math.max(7, Math.round(px))}px Nunito, system-ui`;
export const rect = (ctx: CanvasRenderingContext2D, v: View, x: number, y1: number, w: number, y2: number) => ctx.fillRect(X(v, x), Y(v, y2), w * v.s, (y2 - y1) * v.s);
// Las olas de la superficie del agua (la superficie está en y = 0).
export const waveY = (x: number, t: number) => Math.sin(x * 1.3 + t * 2) * 0.07 + Math.sin(x * 3.1 - t * 3) * 0.035;
// Recorta arriba o abajo de la superficie del agua (con sus olas) entre x1 y x2 (en la pantalla).
export function surfaceClip(ctx: CanvasRenderingContext2D, v: View, x1: number, x2: number, above: boolean) {
  const edge = above ? -v.h : v.h * 2;
  ctx.beginPath(); ctx.moveTo(x1, edge); ctx.lineTo(x2, edge);
  for (let px = x2; px >= x1; px -= 6) ctx.lineTo(px, Y(v, waveY(v.cx + px / v.s, v.t)));
  ctx.lineTo(x1, Y(v, waveY(v.cx + x1 / v.s, v.t)));
  ctx.closePath(); ctx.clip();
}
