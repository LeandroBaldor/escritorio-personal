// Cómo se ven los peligros de Kombat Football: el tiburón volador de Ciudad Tiburón (con su arnés, el motor y la
// hélice de helicóptero), los charcos de ácido verde, el ovni (el de Kombat Penales) y los meteoritos (con la
// explosión: bola de fuego, onda, humo y cráter). En el piso van las marcas que avisan (la sombra del tiburón, las
// burbujas antes del ácido, el círculo rojo del meteorito, el celeste del ovni) y los cráteres.
import { ACID_T, BLAST_T, METEOR_T, SHARK_LEN, UFO_T, meteorPos, type Hazard, type SoccerMatch } from './kombatSoccer';
import { loadSharkSprites } from './sharkSprites';
import { drawFlyerRig } from './sharkSkyline';
import { drawUfoCraftAt } from './kombatPenUfo';
import { alpha, bloom } from './gravityMonsters';
import type { SharkType } from './shark';

const TAU = Math.PI * 2;
type Proj = (x: number, y: number, z: number) => [number, number, number];
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
  for (const b of m.blasts) { // la onda expansiva y el polvo en el piso
    const [x, y, s] = P(b.x, 0, b.z), k = Math.min(1, b.t / 0.55), d = Math.min(1, b.t / 1.6);
    ctx.save();
    if (k < 1) { const r = (0.6 + k * 7.5) * s; ctx.strokeStyle = `rgba(255,236,200,${0.85 * (1 - k)})`; ctx.lineWidth = Math.max(2, s * 0.35 * (1 - k)); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.stroke(); }
    const rd = (1 + d * 5) * s; ctx.fillStyle = `rgba(120,95,70,${0.35 * (1 - d)})`; ctx.beginPath(); ctx.ellipse(x, y, rd, rd * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, s * 4, '#f97316', 0.7 * Math.max(0, 1 - b.t / 1.2));
    ctx.restore();
  }
  for (const h of m.hazards) {
    if (h.kind === 'acid') drawAcid(ctx, P, h, t);
    else if (h.kind === 'meteor') { // la marca y el piso que se ilumina cuando llega
      const k = Math.min(1, h.st / METEOR_T), [gx, gy, gs] = P(h.tx, 0, h.tz);
      if (k > 0.4) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, gx, gy, h.r * gs * (1.5 + k * 2), '#fb923c', 0.5 * (k - 0.4) / 0.6); ctx.restore(); }
      drawTarget(ctx, P, h.tx, h.tz, h.r, k, '#ef4444', t);
    }
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
// El charco de ácido verde: primero burbujea el piso (el aviso), después aparece el ácido con burbujas que
// revientan, el brillo verde y el vapor; al final se seca y desaparece.
function drawAcid(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const { x, z, r, rz, seed } = h;
  if (h.stage === 0) {
    const k = smooth(h.st / ACID_T.warn), [cx, cy, s] = P(x, 0, z);
    ctx.save();
    blob(ctx, P, x, z, r * k, rz * k, seed, 0.14); ctx.fillStyle = `rgba(30,70,8,${0.45 * k})`; ctx.fill();
    ctx.strokeStyle = `rgba(163,230,53,${0.35 + 0.35 * Math.sin(t * 12)})`; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
    for (let i = 0; i < 8; i++) { const ph = (t * 1.6 + i * 0.37) % 1, a = i * 2.4 + seed, d = 0.2 + 0.6 * ((i * 53) % 9) / 9, [px, py] = P(x + Math.cos(a) * r * d * k, 0, z + Math.sin(a) * rz * d * k), br = s * 0.14 * Math.sin(ph * Math.PI); ctx.strokeStyle = 'rgba(190,242,100,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(px, py, br, br * 0.6, 0, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; bloom(ctx, cx, cy, r * s * k, '#84cc16', 0.3 * k);
    ctx.restore();
    return;
  }
  const grow = h.stage === 1 ? smooth(h.st / 0.35) * 0.3 + 0.7 : 1, dry = h.stage === 2 ? smooth(h.st / ACID_T.cool) : 0;
  const rx = r * grow * (1 - dry * 0.5), rzz = rz * grow * (1 - dry * 0.5), [cx, cy, s] = P(x, 0, z), [ex] = P(x + rx, 0, z), [, ey] = P(x, 0, z + rzz);
  const gw = Math.max(4, ex - cx), gh = Math.max(3, ey - cy);
  ctx.save(); ctx.globalAlpha = 1 - dry;
  blob(ctx, P, x, z, rx * 1.1, rzz * 1.1, seed, 0.14, t); ctx.fillStyle = 'rgba(20,50,6,0.85)'; ctx.fill(); // el borde quemado
  blob(ctx, P, x, z, rx, rzz, seed, 0.14, t);
  const g = ctx.createRadialGradient(cx - gw * 0.2, cy - gh * 0.3, 0, cx, cy, Math.max(gw, gh));
  g.addColorStop(0, '#e2ff8a'); g.addColorStop(0.3, '#a3e635'); g.addColorStop(0.65, '#4d9a12'); g.addColorStop(1, '#1c5306');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 6; i++) { // vetas más oscuras que se mueven
    const a = i / 6 * TAU + t * 0.15 + seed, d = 0.3 + 0.45 * ((i * 37) % 7) / 7, [px, py] = P(x + Math.cos(a) * rx * d, 0, z + Math.sin(a) * rzz * d);
    ctx.fillStyle = 'rgba(40,90,10,0.35)'; ctx.beginPath(); ctx.ellipse(px, py, s * (0.4 + (i % 3) * 0.12), s * (0.14 + (i % 2) * 0.05), a, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 10; i++) { // burbujas que revientan
    const ph = (t * 1.1 + i * 0.37 + seed) % 1, a = i * 2.3 + seed + Math.floor(t * 1.1 + i * 0.37) * 1.7, d = 0.15 + 0.65 * ((i * 53) % 9) / 9;
    const [px, py] = P(x + Math.cos(a) * rx * d, 0, z + Math.sin(a) * rzz * d), br = s * (0.12 + (i % 3) * 0.05) * Math.sin(ph * Math.PI);
    const bub = ctx.createRadialGradient(px - br * 0.3, py - br * 0.4, 0, px, py, Math.max(0.1, br)); bub.addColorStop(0, 'rgba(240,255,190,0.9)'); bub.addColorStop(0.5, 'rgba(150,220,50,0.4)'); bub.addColorStop(1, 'rgba(30,90,8,0.7)');
    ctx.fillStyle = bub; ctx.beginPath(); ctx.ellipse(px, py - br * 0.3, Math.max(0.1, br), Math.max(0.1, br * 0.65), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter'; bloom(ctx, cx, cy - s * 0.2, Math.max(gw, gh) * 1.3, '#84cc16', 0.4 * (1 - dry));
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i / 5) % 1, a = seed + i * 1.6, [px, py, ps] = P(x + Math.cos(a) * rx * 0.4, ph * 1.8, z + Math.sin(a) * rzz * 0.4); ctx.fillStyle = `rgba(150,190,80,${0.16 * (1 - ph) * (1 - dry)})`; ctx.beginPath(); ctx.arc(px, py, ps * (0.3 + ph * 0.5), 0, TAU); ctx.fill(); } // el vapor
  ctx.restore();
}

// ---------------------------------------------------------------- En el aire
// El tiburón: la misma imagen de Ciudad Tiburón, ondulando, con la boca abierta cuando se tira en picada.
export function drawShark(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const [x, y, s] = P(h.x, h.y, h.z), [ax, ay] = P(h.x + h.vx * 0.05, h.y + h.vy * 0.05, h.z + h.vz * 0.05);
  let ang = Math.atan2(ay - y, ax - x); const dir: 1 | -1 = ax >= x ? 1 : -1;
  if (dir < 0) ang -= Math.PI;
  while (ang > Math.PI) ang -= TAU; while (ang < -Math.PI) ang += TAU;
  ang = Math.max(-0.6, Math.min(0.6, ang)) + Math.sin(t * 1.4 + h.seed) * 0.05;
  const len = SHARK_LEN * s, open = h.stage === 1 && h.caught === null, warn = h.stage === 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (!drawFlyerRig(ctx, SHARKS[h.sharkType], len, dir, t, h.id, warn, !open)) {
    ctx.scale(dir, 1); ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len * 0.14, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (h.caught !== null && h.stage >= 1) { // la sangre que chorrea de la boca
    const sp = Math.hypot(h.vx, h.vz) || 1, [mx, my] = P(h.x + h.vx / sp * SHARK_LEN * 0.4, h.y - 0.3, h.z + h.vz / sp * SHARK_LEN * 0.4);
    ctx.fillStyle = '#b10f1c'; for (let i = 0; i < 5; i++) { const ph = (t * 3 + i / 5) % 1; ctx.beginPath(); ctx.arc(mx + Math.sin(i * 3) * s * 0.2, my + ph * s * 1.1, Math.max(1.5, s * 0.08 * (1 - ph)), 0, TAU); ctx.fill(); }
  }
}
// El meteorito: una roca grande al rojo, envuelta en plasma, con una cola de fuego larga que tiembla (y la
// estela de humo, que son partículas de la lógica).
export function drawMeteor(ctx: CanvasRenderingContext2D, P: Proj, h: Hazard, t: number) {
  const [wx, wy, wz] = meteorPos(h), [x, y, s] = P(wx, wy, wz), [bx, by] = P(h.x, h.y, h.z), r = 0.85 * s;
  const ang = Math.atan2(by - y, bx - x), ca = Math.cos(ang), sa = Math.sin(ang);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [w, col, a, l] of [[3.4, '#7f1d1d', 0.35, 16], [2.6, '#dc2626', 0.45, 13], [1.8, '#f97316', 0.6, 10], [1.1, '#fde047', 0.8, 7], [0.5, '#fffbeb', 0.95, 4]] as const) {
    ctx.strokeStyle = alpha(col, a); ctx.lineWidth = r * w;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= 6; i++) { const u = i / 6, j = Math.sin(t * 40 + i * 2.1 + w) * r * 0.25 * u; ctx.lineTo(x + ca * r * l * u - sa * j, y + sa * r * l * u + ca * j); }
    ctx.stroke();
  }
  for (let i = 0; i < 10; i++) { // chispas que se desprenden
    const ph = (t * 3 + i * 0.13) % 1, d = r * (1.5 + ph * 9), off = Math.sin(i * 7.3) * r * 1.2 * ph;
    ctx.fillStyle = alpha(i % 2 ? '#fde047' : '#fb923c', 1 - ph); ctx.beginPath(); ctx.arc(x + ca * d - sa * off, y + sa * d + ca * off, Math.max(1, r * 0.12 * (1 - ph)), 0, TAU); ctx.fill();
  }
  bloom(ctx, x, y, r * 6, '#fb923c', 0.9); bloom(ctx, x, y, r * 2.5, '#fffbeb', 0.6);
  ctx.restore();
  // la roca: oscura con grietas al rojo y el frente blanco de calor
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4 + h.seed);
  ctx.beginPath(); for (let k = 0; k < 11; k++) { const rr = r * (0.82 + ((k * 37 + Math.floor(h.seed)) % 7) / 18); ctx.lineTo(Math.cos(k * TAU / 11) * rr, Math.sin(k * TAU / 11) * rr); } ctx.closePath();
  const g = ctx.createRadialGradient(-ca * r * 0.4, -sa * r * 0.4, 0, 0, 0, r * 1.1); g.addColorStop(0, '#7c2d12'); g.addColorStop(0.6, '#3b1d12'); g.addColorStop(1, '#1c1210'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#f97316'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.stroke();
  ctx.strokeStyle = 'rgba(253,186,116,0.9)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(r * 0.05, r * 0.15); ctx.lineTo(r * 0.4, -r * 0.3); ctx.moveTo(-r * 0.1, r * 0.5); ctx.lineTo(r * 0.1, r * 0.15); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fr = ctx.createRadialGradient(x - ca * r * 0.7, y - sa * r * 0.7, 0, x - ca * r * 0.7, y - sa * r * 0.7, r * 1.2); fr.addColorStop(0, 'rgba(255,255,240,0.9)'); fr.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = fr; ctx.beginPath(); ctx.arc(x - ca * r * 0.7, y - sa * r * 0.7, r * 1.2, 0, TAU); ctx.fill(); ctx.restore();
}
// La explosión del meteorito (en el aire, encima de todo): el fogonazo, la bola de fuego que crece y se apaga en
// humo negro, y la columna de humo que sube.
export function drawBlasts(ctx: CanvasRenderingContext2D, P: Proj, m: SoccerMatch, w: number, h: number) {
  for (const b of m.blasts) {
    const t = b.t;
    if (t < 0.14) { ctx.save(); ctx.fillStyle = `rgba(255,248,230,${0.55 * (1 - t / 0.14)})`; ctx.fillRect(0, 0, w, h); ctx.restore(); }
    // humo: bolas grises que suben y se agrandan
    for (let i = 0; i < 12; i++) {
      const st = 0.15 + i * 0.05; if (t < st) continue;
      const q = (t - st) / (BLAST_T - st), a = b.seed + i * 2.4, rr = 0.5 + q * 1.8, [sx, sy, ss] = P(b.x + Math.cos(a) * 1.2 * q, 0.8 + q * 5.5 + (i % 3) * 0.4, b.z + Math.sin(a) * 0.6 * q);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * ss); g.addColorStop(0, `rgba(55,48,44,${0.55 * (1 - q)})`); g.addColorStop(1, 'rgba(40,35,32,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - rr * ss, sy - rr * ss, rr * ss * 2, rr * ss * 2);
    }
    // la bola de fuego
    if (t < 1.4) {
      const R = 3.8 * (1 - Math.exp(-t * 8)), heat = Math.max(0, 1 - t / 1.4), cool = Math.min(1, t / 0.9);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = b.seed * 3 + i * 0.7, d = R * (0.2 + 0.35 * ((i * 37) % 5) / 5), [sx, sy, ss] = P(b.x + Math.cos(a) * d, 0.7 + t * 1.5 + Math.sin(a * 1.3) * d * 0.6, b.z + Math.sin(a) * d * 0.5), rr = R * (0.55 + ((i * 13) % 4) / 10) * ss;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(1, rr));
        g.addColorStop(0, `rgba(255,${Math.round(250 - cool * 120)},${Math.round(220 - cool * 200)},${0.95 * heat})`); g.addColorStop(0.45, `rgba(${Math.round(250 - cool * 60)},${Math.round(140 - cool * 90)},30,${0.75 * heat})`); g.addColorStop(1, 'rgba(120,20,5,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, rr), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
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
