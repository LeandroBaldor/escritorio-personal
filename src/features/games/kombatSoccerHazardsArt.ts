// Cómo se ven los peligros de Kombat Football: el tiburón volador (la imagen de Ciudad Tiburón), los lagos de
// lava, el ovni (el de Kombat Penales) y los meteoritos. En el piso van las marcas que avisan (la sombra del
// tiburón, las grietas antes de la lava, el círculo rojo del meteorito, el celeste del ovni) y los cráteres.
import { LAVA_T, METEOR_T, UFO_T, meteorPos, type Hazard, type SoccerMatch } from './kombatSoccer';
import { drawSharkSprite, loadSharkSprites } from './sharkSprites';
import { drawUfoCraftAt } from './kombatPenUfo';
import { alpha, bloom } from './gravityMonsters';
import type { SharkType } from './shark';

const TAU = Math.PI * 2;
type Proj = (x: number, y: number, z: number) => [number, number, number];
const SHARK_LEN = 3.6; // metros
const SHARKS: SharkType[] = ['blanco', 'martillo', 'blanco'];
const smooth = (v: number) => { const q = Math.max(0, Math.min(1, v)); return q * q * (3 - 2 * q); };
const noise = (seed: number, k: number) => Math.sin(seed * 7.13 + k * 3.7) * 0.5 + Math.sin(seed * 2.1 + k * 1.3) * 0.5;

export function preloadHazardArt() { loadSharkSprites(); }

// Un contorno irregular en el piso (para la lava y los cráteres).
function blob(ctx: CanvasRenderingContext2D, P: Proj, x: number, z: number, rx: number, rz: number, seed: number, wob: number, t = 0) {
  ctx.beginPath();
  for (let k = 0; k <= 26; k++) {
    const a = k / 26 * TAU, f = 1 + noise(seed, k % 26) * wob + Math.sin(t * 1.7 + k * 1.9 + seed) * 0.025;
    const [sx, sy] = P(x + Math.cos(a) * rx * f, 0, z + Math.sin(a) * rz * f);
    if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- En el piso (debajo de los jugadores)
export function drawHazardsGround(ctx: CanvasRenderingContext2D, P: Proj, m: SoccerMatch) {
  const t = m.time;
  // los cráteres que dejan los meteoritos
  for (const c of m.scorch) {
    const a = c.t < 10 ? 1 : Math.max(0, 1 - (c.t - 10) / 4);
    ctx.save(); ctx.globalAlpha = a;
    blob(ctx, P, c.x, c.z, c.r * 1.25, c.r * 1.25, c.seed, 0.22); ctx.fillStyle = 'rgba(20,12,8,0.55)'; ctx.fill();
    blob(ctx, P, c.x, c.z, c.r * 0.8, c.r * 0.8, c.seed + 3, 0.15); ctx.fillStyle = 'rgba(8,5,4,0.75)'; ctx.fill();
    if (c.t < 4) { ctx.globalCompositeOperation = 'lighter'; blob(ctx, P, c.x, c.z, c.r * 0.5, c.r * 0.5, c.seed + 5, 0.2); ctx.fillStyle = alpha('#f97316', 0.6 * (1 - c.t / 4)); ctx.fill(); }
    ctx.restore();
  }
  for (const h of m.hazards) {
    if (h.kind === 'lava') drawLava(ctx, P, h, t);
    else if (h.kind === 'meteor') drawTarget(ctx, P, h.tx, h.tz, h.r, Math.min(1, h.st / METEOR_T), '#ef4444', t);
    else if (h.kind === 'ufo') {
      if (h.stage === 0) { // la luz que lo va siguiendo
        const [x, y, s] = P(h.x, 0, h.z), r = h.r * s * 1.1, k = smooth(h.st / 0.8);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha('#67e8f9', 0.16 * k); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (h.stage === 1) drawTarget(ctx, P, h.tx, h.tz, h.r, Math.min(1, h.st / UFO_T.charge), '#22d3ee', t);
    } else if (h.kind === 'shark' && h.stage < 2) { // la sombra del tiburón (más grande y oscura cuanto más bajo)
      const sp = Math.hypot(h.vx, h.vz) || 1, [x, y, s] = P(h.x, 0, h.z), k = 1 - Math.min(1, (h.y - 0.8) / 7);
      const [ax, ay] = P(h.x + h.vx / sp, 0, h.z + h.vz / sp), ang = Math.atan2(ay - y, ax - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1, 0.45);
      ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.32 * k})`; ctx.beginPath(); ctx.ellipse(0, 0, SHARK_LEN * 0.5 * s, SHARK_LEN * 0.16 * s, 0, 0, TAU); ctx.fill();
      ctx.restore();
      if (h.stage === 1) drawTarget(ctx, P, h.tx, h.tz, 1.1, Math.min(1, h.st / 0.4), '#ef4444', t);
    }
  }
}
// La marca que avisa dónde va a caer algo: un círculo que late, se llena y se cierra.
function drawTarget(ctx: CanvasRenderingContext2D, P: Proj, x: number, z: number, r: number, k: number, color: string, t: number) {
  const [px, py, s] = P(x, 0, z), rr = r * s, pulse = 0.5 + 0.5 * Math.sin(t * (10 + k * 18));
  ctx.save();
  ctx.fillStyle = alpha(color, 0.12 + 0.28 * k); ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = alpha(color, 0.55 + 0.4 * pulse); ctx.lineWidth = Math.max(2, s * 0.09); ctx.stroke();
  const inner = rr * (1 - k * 0.85); ctx.strokeStyle = alpha('#ffffff', 0.5 + 0.3 * pulse); ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.ellipse(px, py, inner, inner * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = alpha(color, 0.8); ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.moveTo(px - rr * 1.15, py); ctx.lineTo(px - rr * 0.6, py); ctx.moveTo(px + rr * 0.6, py); ctx.lineTo(px + rr * 1.15, py); ctx.moveTo(px, py - rr * 0.58); ctx.lineTo(px, py - rr * 0.3); ctx.moveTo(px, py + rr * 0.3); ctx.lineTo(px, py + rr * 0.58); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; bloom(ctx, px, py, rr * 1.2, color, 0.25 + 0.25 * k * pulse);
  ctx.restore();
}
// El lago de lava: primero se agrieta el piso (las grietas brillan cada vez más), después sale la lava con su costra,
// burbujas y el brillo; al final se enfría (se pone negra) y desaparece.
function drawLava(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const { x, z, r, rz, seed } = h;
  if (h.stage === 0) {
    const k = smooth(h.st / LAVA_T.warn), [cx, cy, s] = P(x, 0, z);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 9; i++) { // las grietas
      const a0 = i / 9 * TAU + noise(seed, i) * 0.4;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let j = 1; j <= 4; j++) { const rr = j / 4 * k, a = a0 + noise(seed + j, i) * 0.35, [px, py] = P(x + Math.cos(a) * r * rr, 0, z + Math.sin(a) * rz * rr); ctx.lineTo(px, py); }
      ctx.strokeStyle = 'rgba(25,8,4,0.85)'; ctx.lineWidth = Math.max(2, s * 0.14); ctx.stroke();
      ctx.strokeStyle = alpha('#fb923c', 0.4 + 0.6 * k * (0.6 + 0.4 * Math.sin(t * 16 + i))); ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
    }
    blob(ctx, P, x, z, r * k, rz * k, seed, 0.14); ctx.strokeStyle = alpha('#f97316', 0.35 + 0.35 * Math.sin(t * 12)); ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; bloom(ctx, cx, cy, r * s * k, '#f97316', 0.35 * k);
    ctx.restore();
    return;
  }
  const grow = h.stage === 1 ? smooth(h.st / 0.35) * 0.3 + 0.7 : 1, cool = h.stage === 2 ? smooth(h.st / LAVA_T.cool) : 0;
  const rx = r * grow, rzz = rz * grow, [cx, cy, s] = P(x, 0, z), [ex] = P(x + rx, 0, z), [, ey] = P(x, 0, z + rzz);
  const gw = Math.max(4, ex - cx), gh = Math.max(3, ey - cy);
  ctx.save(); ctx.globalAlpha = 1 - cool * 0.85;
  // el borde quemado
  blob(ctx, P, x, z, rx * 1.12, rzz * 1.12, seed, 0.14, t); ctx.fillStyle = 'rgba(30,10,6,0.9)'; ctx.fill();
  // la lava
  blob(ctx, P, x, z, rx, rzz, seed, 0.14, t);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(gw, gh));
  if (cool > 0) { g.addColorStop(0, `rgb(${Math.round(255 - cool * 200)},${Math.round(150 - cool * 120)},40)`); g.addColorStop(1, 'rgb(40,14,8)'); }
  else { g.addColorStop(0, '#fff3b0'); g.addColorStop(0.3, '#fdba3c'); g.addColorStop(0.7, '#f0561a'); g.addColorStop(1, '#a3180b'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // costra que se mueve despacio
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + t * 0.12 + seed, d = 0.35 + 0.4 * ((i * 37) % 7) / 7, [px, py] = P(x + Math.cos(a) * rx * d, 0, z + Math.sin(a) * rzz * d);
    ctx.fillStyle = `rgba(60,16,8,${0.35 + cool * 0.5})`; ctx.beginPath(); ctx.ellipse(px, py, s * (0.35 + (i % 3) * 0.12), s * (0.16 + (i % 2) * 0.06), a, 0, TAU); ctx.fill();
  }
  // burbujas que revientan
  if (cool < 0.5) for (let i = 0; i < 6; i++) {
    const ph = (t * 0.9 + i * 0.37 + seed) % 1, a = i * 2.3 + seed + Math.floor(t * 0.9 + i * 0.37) * 1.7, d = 0.2 + 0.55 * ((i * 53) % 9) / 9;
    const [px, py] = P(x + Math.cos(a) * rx * d, 0, z + Math.sin(a) * rzz * d), br = s * 0.18 * Math.sin(ph * Math.PI);
    ctx.strokeStyle = 'rgba(255,240,180,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.ellipse(px, py, br, br * 0.6, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  if (cool < 1) { ctx.globalCompositeOperation = 'lighter'; bloom(ctx, cx, cy - s * 0.3, Math.max(gw, gh) * 1.4, '#f97316', 0.5 * (1 - cool)); }
  // humito que sube
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 4; i++) { const ph = (t * 0.5 + i / 4) % 1, a = seed + i * 1.6, [px, py, ps] = P(x + Math.cos(a) * rx * 0.4, ph * 2.2, z + Math.sin(a) * rzz * 0.4); ctx.fillStyle = `rgba(90,70,60,${0.18 * (1 - ph) * (1 - cool)})`; ctx.beginPath(); ctx.arc(px, py, ps * (0.3 + ph * 0.5), 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- En el aire
// El tiburón: la misma imagen de Ciudad Tiburón, ondulando, con la boca abierta cuando se tira en picada.
export function drawShark(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const [x, y, s] = P(h.x, h.y, h.z), [ax, ay] = P(h.x + h.vx * 0.05, h.y + h.vy * 0.05, h.z + h.vz * 0.05);
  let ang = Math.atan2(ay - y, ax - x); const dir: 1 | -1 = ax >= x ? 1 : -1;
  if (dir < 0) ang -= Math.PI;
  while (ang > Math.PI) ang -= TAU; while (ang < -Math.PI) ang += TAU;
  ang = Math.max(-0.9, Math.min(0.9, ang));
  const len = SHARK_LEN * s, open = h.stage === 1 && h.caught === null;
  if (!drawSharkSprite(ctx, SHARKS[h.sharkType], x, y, len, ang, dir, { closed: !open, wave: t * 9 + h.seed, amp: 0.05 })) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(dir, 1); ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len * 0.14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len * 0.05, -len * 0.12); ctx.lineTo(-len * 0.15, -len * 0.3); ctx.lineTo(-len * 0.22, -len * 0.1); ctx.fill(); ctx.restore();
  }
  if (h.caught !== null && h.stage >= 1) { // la sangre que chorrea de la boca
    const sp = Math.hypot(h.vx, h.vz) || 1, [mx, my] = P(h.x + h.vx / sp * 1.4, h.y - 0.2, h.z + h.vz / sp * 1.4);
    ctx.fillStyle = '#b10f1c'; for (let i = 0; i < 4; i++) { const ph = (t * 3 + i / 4) % 1; ctx.beginPath(); ctx.arc(mx + Math.sin(i * 3) * s * 0.15, my + ph * s * 0.9, Math.max(1.5, s * 0.06 * (1 - ph)), 0, TAU); ctx.fill(); }
  }
}
// El meteorito: una roca encendida con la cola de fuego (de donde viene).
export function drawMeteor(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const [wx, wy, wz] = meteorPos(h), [x, y, s] = P(wx, wy, wz), [bx, by] = P(h.x, h.y, h.z), r = 0.6 * s;
  const ang = Math.atan2(by - y, bx - x);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [w, col, a, l] of [[2.6, '#dc2626', 0.4, 9], [1.7, '#f97316', 0.6, 7], [1, '#fde047', 0.8, 5], [0.45, '#fffbeb', 0.9, 3]] as const) {
    ctx.strokeStyle = alpha(col, a); ctx.lineWidth = r * w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * r * l * (1 + Math.sin(t * 30) * 0.08), y + Math.sin(ang) * r * l); ctx.stroke();
  }
  bloom(ctx, x, y, r * 4, '#fb923c', 0.8);
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5);
  ctx.fillStyle = '#3b2418'; ctx.beginPath(); for (let k = 0; k < 9; k++) { const rr = r * (0.8 + ((k * 37) % 5) / 12); ctx.lineTo(Math.cos(k * TAU / 9) * rr, Math.sin(k * TAU / 9) * rr); } ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fb923c'; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.stroke();
  ctx.fillStyle = 'rgba(253,186,116,0.8)'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.2, r * 0.22, 0, TAU); ctx.arc(r * 0.3, r * 0.15, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}
// El ovni (arriba de todo): baja, sigue al jugador, carga y dispara el rayo celeste; después se va.
export function drawUfo(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const bob = Math.sin(t * 3.5 + h.seed) * 0.15, [x, y, s] = P(h.x, h.y + bob, h.z), width = 4.4 * s;
  const gx = h.stage >= 1 ? h.tx : h.x, gz = h.stage >= 1 ? h.tz : h.z, [tx, ty, ts] = P(gx, 0, gz);
  // el rayo
  if (h.stage === 2) {
    const k = Math.min(1, h.st / 0.08) * (1 - smooth((h.st - UFO_T.beam + 0.2) / 0.2)), ny = y + width * 0.233;
    ctx.save(); ctx.globalAlpha = Math.max(0, k); ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(x, ny, tx, ty); beam.addColorStop(0, 'rgba(135,255,255,0.95)'); beam.addColorStop(0.5, 'rgba(30,221,255,0.55)'); beam.addColorStop(1, 'rgba(37,222,255,0.15)');
    const rr = h.r * ts;
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - width * 0.04, ny); ctx.lineTo(tx - rr, ty); ctx.quadraticCurveTo(tx, ty + rr * 0.5, tx + rr, ty); ctx.lineTo(x + width * 0.04, ny); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#caffff'; ctx.lineWidth = Math.max(3, s * 0.18) + Math.sin(t * 65) * 2; ctx.beginPath(); ctx.moveTo(x, ny); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(39,221,255,0.35)'; ctx.lineWidth = Math.max(10, s * 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(91,244,255,0.55)'; ctx.beginPath(); ctx.ellipse(tx, ty, rr, rr * 0.5, 0, 0, TAU); ctx.fill();
    bloom(ctx, tx, ty, rr * 2, '#5ef3ff', 0.7);
    ctx.restore();
  }
  const ny = drawUfoCraftAt(ctx, t, x, y, width);
  if (ny === null) { // mientras carga la imagen: un plato simple
    ctx.save(); ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(x, y, width / 2, width * 0.13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(125,211,252,0.8)'; ctx.beginPath(); ctx.ellipse(x, y - width * 0.08, width * 0.2, width * 0.14, 0, Math.PI, TAU); ctx.fill(); ctx.restore();
  }
  // la carga del emisor
  const charge = h.stage === 1 ? smooth(h.st / UFO_T.charge) : h.stage === 2 ? 1 - smooth(h.st / UFO_T.beam) : 0;
  if (charge > 0) { const cy = ny ?? y + width * 0.2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, cy, 0, x, cy, width * 0.2); g.addColorStop(0, `rgba(200,255,255,${charge})`); g.addColorStop(1, 'rgba(0,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - width * 0.2, cy - width * 0.2, width * 0.4, width * 0.4); ctx.restore(); }
}
