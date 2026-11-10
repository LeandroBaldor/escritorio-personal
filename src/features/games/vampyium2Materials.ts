// Material treatment shared by the sequel's articulated character renderers.
import { darken, lighten, grain, shade as originalShade, spec as originalSpec, segment as originalSegment } from './gravityMonsters';
export { alpha, bloom, darken, lighten, grain } from './gravityMonsters';

export const shade: typeof originalShade = (ctx, path, base, options) => {
  const { x = 0, y = 0, r } = options;
  const light = ctx.createLinearGradient(x - r * .65, y - r, x + r, y + r * .7);
  light.addColorStop(0, lighten(base, (options.hi ?? .35) * .55));
  light.addColorStop(.38, base); light.addColorStop(1, darken(base, options.lo ?? .65));
  ctx.beginPath(); path(); ctx.fillStyle = light; ctx.fill();
  grain(ctx, path, (options.tex ?? .3) * .65, options.texSize);
  if ((options.lw ?? 1) > 0) {
    ctx.strokeStyle = options.line ?? darken(base, .7);
    ctx.lineWidth = (options.lw ?? 1) * .007; ctx.stroke();
  }
};

export const spec: typeof originalSpec = (ctx, x, y, rx, ry, rot = 0, a = .6) =>
  originalSpec(ctx, x, y, rx, ry * .3, rot, a * .22);

export const segment: typeof originalSegment = (ctx, a, b, wa, wb, color, gloss = .5) =>
  originalSegment(ctx, a, b, wa, wb, color, gloss * .18);

// Fixed marks remain attached to the material; they never shimmer between frames.
export function wear(ctx: CanvasRenderingContext2D, path: () => void, x: number, y: number, w: number, h: number, seed = 0, count = 20) {
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  for (let i = 0; i < count; i++) {
    const k = Math.sin((i + seed) * 127.1 + 311.7) * 43758.5453;
    const u = k - Math.floor(k), v = ((i * 0.61803398875 + seed * 0.17) % 1 + 1) % 1;
    const px = x + u * w, py = y + v * h;
    ctx.strokeStyle = i % 3 ? 'rgba(6,9,12,.32)' : 'rgba(200,213,207,.23)';
    ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(px, py);
    ctx.lineTo(px + 0.015 + u * 0.025, py - 0.008); ctx.stroke();
  }
  ctx.restore();
}

