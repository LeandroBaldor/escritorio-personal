// Vampyium2: the ice armour's frozen vampire and its shattering.
// The vampire is frozen INSIDE ice: its own body, half see-through and tinted sky blue, in a crust of translucent ice
// (frost, bright edges, cracks); when it breaks, that same statue bursts into pieces of ice that fly everywhere.
import { ICE_SHATTER_T, type Corpse, type Vamp } from './vampyium2';

const RES = 110; // pixels per body unit in the cached statue
const BOX = { x0: -1.7, x1: 1.7, y0: -2.9, y1: .3 }; // body units around the feet (enough for every frozen kind)
const statues = new Map<number, HTMLCanvasElement | null>();
type DrawBody = (ctx: CanvasRenderingContext2D) => void;

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// The ice statue of one vampire (computed once, when it freezes; the corpse reuses it to shatter): the vampire's own
// body, still recognisable through the ice — its colours cooled and half see-through — inside a pale sky-blue crust of
// ice a little bigger than its silhouette, with frost, bright edges, cracks and a sheen.
export function iceStatue(id: number, drawBody: DrawBody) {
  if (statues.has(id)) return statues.get(id)!;
  const w = Math.ceil((BOX.x1 - BOX.x0) * RES), h = Math.ceil((BOX.y1 - BOX.y0) * RES);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) { statues.set(id, null); return null; }
  const body = document.createElement('canvas'); body.width = w; body.height = h;
  const b = body.getContext('2d', { willReadFrequently: true }); if (!b) { statues.set(id, null); return null; }
  b.setTransform(RES, 0, 0, RES, -BOX.x0 * RES, -BOX.y0 * RES); drawBody(b); b.setTransform(1, 0, 0, 1, 0, 0);
  // 1) the ice: a thick, faceted shell grown well beyond the silhouette (angular, like a block of ice), filled
  // with sky-blue ice — the vampire is INSIDE it
  const grow = Math.max(6, Math.round(RES * .13));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2, r = grow * (.75 + .5 * hash(id * 13 + k)); c.drawImage(body, Math.cos(a) * r, Math.sin(a) * r * .8); }
  for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * Math.PI * 2 + .2; c.drawImage(body, Math.cos(a) * grow * .55, Math.sin(a) * grow * .5); }
  c.globalCompositeOperation = 'source-in';
  const crust = c.createLinearGradient(0, 0, w * .6, h);
  crust.addColorStop(0, 'rgba(225,246,255,.72)'); crust.addColorStop(.5, 'rgba(150,212,245,.6)'); crust.addColorStop(1, 'rgba(105,180,232,.68)');
  c.fillStyle = crust; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  // 2) the body inside, cooled towards sky blue and half transparent (you see it is frozen IN the ice)
  try {
    const data = b.getImageData(0, 0, w, h), d = data.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3]; if (!a) continue;
      const l = (.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]) / 255, n = (hash(x * 3.1 + y * 7.7) - .5) * 18;
      const ice = .5; // how much of the colour is ice
      d[i] = d[i] * (1 - ice) + (120 + 120 * l) * ice + n;
      d[i + 1] = d[i + 1] * (1 - ice) + (190 + 60 * l) * ice + n;
      d[i + 2] = d[i + 2] * (1 - ice) + (235 + 20 * l) * ice + n;
      d[i + 3] = a * .62;
    }
    b.putImageData(data, 0, 0);
  } catch { /* (sin acceso a los píxeles: queda el dibujo) */ }
  c.drawImage(body, 0, 0);
  // the ice in front of the body: a frosted veil, so the vampire is only faintly seen through it
  c.globalCompositeOperation = 'source-atop';
  const veil = c.createLinearGradient(0, 0, 0, h); veil.addColorStop(0, 'rgba(225,245,255,.42)'); veil.addColorStop(1, 'rgba(160,214,245,.34)');
  c.fillStyle = veil; c.fillRect(0, 0, w, h);
  // 3) light on the ice: bright rims, cracks, a sheen and frost (only on the statue)
  c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
  c.strokeStyle = 'rgba(235,250,255,.55)'; c.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    let x = w * (.3 + hash(id * 5 + k) * .4), y = h * (.15 + hash(id * 9 + k) * .6);
    c.strokeStyle = `rgba(255,255,255,${.4 + hash(k + id) * .35})`; c.lineWidth = 1 + hash(k * 3 + id) * 1.6;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (hash(id + k * 11 + s) - .5) * w * .18; y += h * (.03 + hash(id * 2 + k + s * 3) * .07); c.lineTo(x, y); }
    c.stroke();
  }
  const sheen = c.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,.26)'); sheen.addColorStop(.42, 'rgba(255,255,255,0)'); sheen.addColorStop(.52, 'rgba(230,248,255,.2)'); sheen.addColorStop(.6, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(140,205,250,.12)');
  c.fillStyle = sheen; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 140; k++) { // frost speckles
    c.fillStyle = `rgba(255,255,255,${.25 + hash(id + k * 1.7) * .4})`;
    c.fillRect(hash(id * 3 + k) * w, hash(id * 7 + k * 2) * h, 1.5, 1.5);
  }
  c.globalCompositeOperation = 'source-over';
  statues.set(id, canvas); return canvas;
}
export function forgetStatue(id: number) { statues.delete(id); }

// Frozen, standing: the statue where the vampire was (k = screen pixels per body unit). It trembles just before breaking.
export function drawFrozenVamp(ctx: CanvasRenderingContext2D, vp: Vamp, x: number, y: number, k: number, left: number, t: number, drawBody: DrawBody) {
  const s = iceStatue(vp.id, drawBody); if (!s) return false;
  const shake = left < .25 ? Math.sin(t * 80) * k * .02 : 0;
  ctx.save(); ctx.translate(x + shake, y); ctx.scale(vp.face * k / RES, k / RES);
  ctx.drawImage(s, BOX.x0 * RES, BOX.y0 * RES);
  ctx.restore();
  // a little frost at the feet, and two glints
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fr = ctx.createRadialGradient(x, y, 0, x, y, k * .9); fr.addColorStop(0, 'rgba(200,235,255,.35)'); fr.addColorStop(1, 'rgba(200,235,255,0)');
  ctx.fillStyle = fr; ctx.beginPath(); ctx.ellipse(x, y, k * .9, k * .18, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 2; i++) {
    const tw = Math.max(0, Math.sin(t * 3 + i * 2.4 + vp.id)), gx = x + (hash(vp.id + i) - .5) * k * .8, gy = y - k * (.6 + hash(vp.id * 3 + i) * 1.3), r = k * .12 * tw;
    if (r < .5) continue;
    ctx.strokeStyle = `rgba(255,255,255,${.8 * tw})`; ctx.lineWidth = Math.max(1, k * .012);
    ctx.beginPath(); ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r); ctx.stroke();
  }
  ctx.restore(); return true;
}

// Shattering: the statue cut into irregular pieces that burst outwards, spin, fall and slide on the floor, then melt away.
const COLS = 6, ROWS = 8;
export function drawIceShatter(ctx: CanvasRenderingContext2D, c: Corpse, x: number, y: number, k: number, drawBody: DrawBody) {
  const s = iceStatue(c.id, drawBody); if (!s) return false;
  const t = c.t, fade = Math.max(0, Math.min(1, (ICE_SHATTER_T - t) / .5));
  if (fade <= 0) { forgetStatue(c.id); return true; }
  const W = s.width, H = s.height, cw = W / COLS, ch = H / ROWS;
  // jittered grid corners (shared by neighbouring pieces, so the statue starts whole)
  const P = (i: number, j: number): [number, number] => {
    const edge = i === 0 || j === 0 || i === COLS || j === ROWS;
    return [i * cw + (edge ? 0 : (hash(c.id * 13 + i * 7 + j * 31) - .5) * cw * .7), j * ch + (edge ? 0 : (hash(c.id * 17 + i * 19 + j * 5) - .5) * ch * .7)];
  };
  const toWorld = 1 / RES; // statue pixels → body units
  ctx.save(); ctx.translate(x, y); ctx.scale(c.face * k, k); ctx.globalAlpha *= fade;
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const quad = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
    const cx = (quad[0][0] + quad[2][0]) / 2, cy = (quad[0][1] + quad[2][1]) / 2;
    // piece centre in body units (feet at 0); empty pieces are skipped cheaply by their seed only
    const bx = BOX.x0 + cx * toWorld, by = BOX.y0 + cy * toWorld;
    const seed = c.id * 101 + i * 13 + j * 7, out = Math.atan2(by + 1.1, bx) + (hash(seed) - .5) * .9;
    const sp = 3 + hash(seed + 1) * 6, vx = Math.cos(out) * sp, vy = Math.sin(out) * sp - 4 - hash(seed + 2) * 4; // (body units / s, y down)
    let px = bx + vx * t, py = by + vy * t + 14 * t * t;
    let spin = (hash(seed + 3) - .5) * 14 * t;
    if (py > 0) { const over = py; py = 0; px += Math.sign(vx) * Math.min(.6, over * .15); spin *= .6; } // lands and slides
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin); ctx.translate(-bx, -by);
    ctx.beginPath(); quad.forEach(([qx, qy], n) => { const wx = BOX.x0 + qx * toWorld, wy = BOX.y0 + qy * toWorld; if (n) ctx.lineTo(wx, wy); else ctx.moveTo(wx, wy); }); ctx.closePath();
    ctx.clip();
    ctx.drawImage(s, BOX.x0, BOX.y0, W * toWorld, H * toWorld);
    ctx.restore();
  }
  // the ice explodes: a cold flash and a spray of small glittering sky-blue shards
  if (t < .25) {
    const f = 1 - t / .25, r = .6 + t * 9;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -1.1, 0, 0, -1.1, r); g.addColorStop(0, `rgba(230,250,255,${.55 * f})`); g.addColorStop(.6, `rgba(150,215,255,${.25 * f})`); g.addColorStop(1, 'rgba(150,215,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -1.1, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  for (let n = 0; n < 28; n++) {
    const seed = c.id * 37 + n, a = hash(seed) * Math.PI * 2, sp = 5 + hash(seed + 1) * 7;
    const px = Math.cos(a) * sp * t, py = -1.1 + Math.sin(a) * sp * t - 3 * t + 14 * t * t;
    if (py > .05) continue;
    const sz = .05 + hash(seed + 2) * .08, rot = hash(seed + 3) * 6 + t * 12;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    ctx.fillStyle = `rgba(${200 + hash(seed + 4) * 55},240,255,.85)`; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .012;
    ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * .55, sz * .6); ctx.lineTo(-sz * .5, sz * .45); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore(); return true;
}
