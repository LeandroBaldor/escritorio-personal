// Vampyium2: the ice armour's frozen vampire and its shattering.
// The vampire turns into ice (its own body in blues, glowing cracks, a bright rim, icicles); when it breaks, that same
// statue bursts into pieces of ice that fly everywhere.
import { ICE_SHATTER_T, type Corpse, type Vamp } from './vampyium2';

const RES = 110; // pixels per body unit in the cached statue
const BOX = { x0: -1.7, x1: 1.7, y0: -2.9, y1: .3 }; // body units around the feet (enough for every frozen kind)
const statues = new Map<number, HTMLCanvasElement | null>();
type DrawBody = (ctx: CanvasRenderingContext2D) => void;

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// The ice statue of one vampire (computed once, when it freezes; the corpse reuses it to shatter), as in the user's
// reference: the vampire itself turned to ice — every detail still there, but in blues (dark blue in the shadows, pale
// cyan in the light, a little of its own colour left), a net of glowing white-blue cracks all over it, a bright rim
// round its silhouette, frost, and icicles hanging from every lower edge (arms, hair, cape, coat).
export function iceStatue(id: number, drawBody: DrawBody) {
  if (statues.has(id)) return statues.get(id)!;
  const w = Math.ceil((BOX.x1 - BOX.x0) * RES), h = Math.ceil((BOX.y1 - BOX.y0) * RES);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) { statues.set(id, null); return null; }
  c.setTransform(RES, 0, 0, RES, -BOX.x0 * RES, -BOX.y0 * RES); drawBody(c); c.setTransform(1, 0, 0, 1, 0, 0);
  const feet = -BOX.y0 * RES; // (the floor line in the statue)
  const edges: [number, number][] = [];
  try {
    const data = c.getImageData(0, 0, w, h), d = data.data, A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    // crack seeds (a Voronoi net over the body)
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (A(x, y) > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const seeds: [number, number][] = [];
    for (let k = 0; k < 26; k++) seeds.push([minX + hash(id * 3 + k * 1.37) * (maxX - minX + 1), minY + hash(id * 7 + k * 2.71) * (maxY - minY + 1)]);
    const out = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3]; if (a < 8) continue;
      const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2], l = (.3 * r0 + .59 * g0 + .11 * b0) / 255, n = (hash(x * 3.1 + y * 7.7) - .5) * 14;
      const e = Math.min(1, Math.pow(l, 1.1) * 1.1); // (a little lifted, so dark clothes still read as ice)
      let R = 18 + 150 * e * e + 40 * e, G = 58 + 150 * e, B = 130 + 120 * e;
      const keep = .24; R = R * (1 - keep) + r0 * keep; G = G * (1 - keep) + g0 * keep; B = B * (1 - keep) + b0 * keep * 1.1; // (a hint of its own colour: the cape stays a bit purple)
      // cracks: where the two nearest seeds are almost equally near
      let d1 = 1e9, d2 = 1e9; for (const [sx, sy] of seeds) { const q = (sx - x) * (sx - x) + (sy - y) * (sy - y) * 1.3; if (q < d1) { d2 = d1; d1 = q; } else if (q < d2) d2 = q; }
      const gap = Math.sqrt(d2) - Math.sqrt(d1), crack = gap < .8 ? .75 : gap < 2.4 ? (2.4 - gap) / 1.6 * .3 : 0;
      // the rim: pixels next to the outside
      const rim = A(x - 2, y) < 30 || A(x + 2, y) < 30 || A(x, y - 2) < 30 || A(x, y + 2) < 30 ? 1 : A(x - 4, y) < 30 || A(x + 4, y) < 30 || A(x, y - 4) < 30 ? .45 : 0;
      const lit = Math.max(crack * .7, rim * .6);
      out[i] = R + (225 - R) * lit + n; out[i + 1] = G + (248 - G) * lit + n; out[i + 2] = B + (255 - B) * lit + n; out[i + 3] = Math.min(255, a * .96 + lit * 20);
      // lower edges, for the icicles
      if (a > 120 && A(x, y + 2) < 15 && A(x, y + 4) < 15 && y < feet - RES * .12 && (x & 3) === 0) edges.push([x, y]);
    }
    data.data.set(out); c.putImageData(data, 0, 0);
  } catch { /* (sin acceso a los píxeles: queda el dibujo) */ }
  // a frosty sheen and speckles (only on the statue)
  c.globalCompositeOperation = 'source-atop';
  const sheen = c.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,.1)'); sheen.addColorStop(.42, 'rgba(255,255,255,0)'); sheen.addColorStop(.52, 'rgba(230,248,255,.14)'); sheen.addColorStop(.6, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(120,190,250,.1)');
  c.fillStyle = sheen; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 260; k++) { c.fillStyle = `rgba(255,255,255,${.25 + hash(id + k * 1.7) * .45})`; c.fillRect(hash(id * 3 + k) * w, hash(id * 7 + k * 2) * h, 1.5, 1.5); }
  c.globalCompositeOperation = 'source-over';
  // icicles hanging from the lower edges
  for (let n = 0; n < edges.length; n++) {
    const [x, y] = edges[n], r = hash(id * 11 + x * .37 + y * .11); if (r < .35) continue;
    const len = Math.min(feet - y - 2, RES * (.06 + .2 * r * r)), wd = RES * (.025 + .025 * hash(x + id)); if (len < 4) continue;
    const tx = x + (hash(x * 3 + id) - .5) * wd * .5;
    const gr = c.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(150,205,245,.95)'); gr.addColorStop(.6, 'rgba(205,238,255,.92)'); gr.addColorStop(1, 'rgba(250,255,255,.95)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(x - wd / 2, y - 1); c.quadraticCurveTo(x - wd * .3, y + len * .5, tx, y + len); c.quadraticCurveTo(x + wd * .3, y + len * .5, x + wd / 2, y - 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(245,252,255,.75)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(x - wd * .15, y + 1); c.lineTo(tx - wd * .05, y + len * .8); c.stroke(); // (the light along it)
  }
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
