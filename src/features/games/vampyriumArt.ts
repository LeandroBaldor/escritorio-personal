// El dibujo de Vampyrium. El mundo va en unidades (vampyrium.ts) y acá se pasa a píxeles: `s` píxeles por unidad,
// el borde de abajo de la pantalla es y = 0. Los personajes se dibujan en "puntos de diseño": 100 de alto con los
// pies en 0 (y para arriba negativo, como el lienzo), al estilo chibi de las referencias: cabeza grande, contorno
// oscuro grueso y sombreado de dos tonos.
import { DOOR, GAPS, GROUND_Y, H, PLAYER_H, SURFACES, TRAPS, W, trapState, BURN_AT, BLOW_AT, type Bone, type Corpse, type Crate, type Game, type Player, type Stake, type Vamp, type Weapon } from './vampyrium';

const TAU = Math.PI * 2;
const BIG = 1.3; // los personajes se dibujan más grandes que su caja de choque (la cabezota chibi)
const INK = '#07060a';
export interface View { s: number; ox: number; oy: number; w: number; h: number }
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;
export function viewFor(w: number, h: number): View {
  const s = Math.min(w / W, h / H);
  return { s, ox: (w - W * s) / 2, oy: h, w, h };
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- Ayudas de dibujo
function blob(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 3, path: () => void) {
  ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill();
  if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
const lin = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [a, c] of stops) g.addColorStop(a, c); return g; };

// Pierna con rodilla: cadera → rodilla → pie (ángulos en radianes desde la vertical).
function leg(ctx: CanvasRenderingContext2D, hx: number, hy: number, thigh: number, shin: number, a1: number, a2: number, colors: { pant: string; pad: string; boot: string; trim: string }, bootW = 15) {
  const kx = hx + Math.sin(a1) * thigh, ky = hy + Math.cos(a1) * thigh;
  const fx = kx + Math.sin(a2) * shin, fy = ky + Math.cos(a2) * shin;
  limb(ctx, hx, hy, kx, ky, 11, colors.pant);
  limb(ctx, kx, ky, fx, fy - 4, 10, colors.pant);
  // rodillera
  blob(ctx, colors.pad, 2.5, () => ctx.arc(kx + 1, ky, 6.2, 0, TAU));
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(kx - 0.5, ky - 2, 2.4, 0, TAU); ctx.fill();
  // bota (con puntera y suela de metal)
  ctx.save(); ctx.translate(fx, fy);
  blob(ctx, colors.boot, 2.5, () => { ctx.moveTo(-6, -11); ctx.lineTo(6, -11); ctx.quadraticCurveTo(bootW, -7, bootW, -1); ctx.lineTo(bootW, 1); ctx.lineTo(-7, 1); ctx.lineTo(-7, -9); ctx.closePath(); });
  ctx.fillStyle = colors.trim; ctx.fillRect(-7, -1.5, bootW + 7, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(bootW - 4, -5, 3, 1.6, -0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = colors.trim; ctx.fillRect(-6, -10, 12, 2);
  ctx.restore();
}

// ---------------------------------------------------------------- El cazador
const HUNTER = { skin: '#eab48b', skinD: '#c98a63', hair: '#3b2418', hairL: '#6b4630', streak: '#b3151d', armor: '#1d1d23', armorL: '#3b3b46', metal: '#8d8f9c', strap: '#6f4126', strapL: '#94603c', cape: '#b3121b', capeD: '#5e0a10', beard: '#4a2c1c' };
function drawSword(ctx: CanvasRenderingContext2D) {
  // empuñadura hacia abajo en (0,0), la hoja va para "arriba" (y negativo)
  blob(ctx, '#3a2414', 2, () => ctx.roundRect(-2.6, -2, 5.2, 11, 2));
  blob(ctx, '#d6a032', 2, () => ctx.arc(0, 10, 3.2, 0, TAU));
  blob(ctx, lin(ctx, -10, 0, 10, 0, [[0, '#7a5414'], [0.5, '#f2c45a'], [1, '#7a5414']]), 2, () => ctx.roundRect(-10, -5, 20, 4.2, 2));
  blob(ctx, lin(ctx, -3, 0, 3, 0, [[0, '#9aa3b4'], [0.45, '#f4f7ff'], [0.55, '#c9d1e0'], [1, '#6d7586']]), 2, () => { ctx.moveTo(-3.4, -5); ctx.lineTo(-3.4, -40); ctx.lineTo(0, -47); ctx.lineTo(3.4, -40); ctx.lineTo(3.4, -5); ctx.closePath(); });
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -42); ctx.stroke();
}
function drawStakeItem(ctx: CanvasRenderingContext2D, len = 24) {
  blob(ctx, lin(ctx, -3, 0, 3, 0, [[0, '#6b4220'], [0.5, '#b07a45'], [1, '#5a3618']]), 2, () => { ctx.moveTo(-2.8, 6); ctx.lineTo(-2.8, -len + 7); ctx.lineTo(0, -len); ctx.lineTo(2.8, -len + 7); ctx.lineTo(2.8, 6); ctx.closePath(); });
  ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-2.4, 2 - i * 6); ctx.lineTo(2.4, 0 - i * 6); ctx.stroke(); }
}
// Brazo de dos partes (hombro → codo → puño). Ángulos desde la vertical: 0 colgando, + hacia adelante, π arriba.
// Manga negra con correa de cuero, guantelete con bandas de metal y el puño grande cerrado.
function hunterArm(ctx: CanvasRenderingContext2D, sx: number, sy: number, a1: number, a2: number, item: Weapon | 'none', itemA: number, dark = false) {
  const L1 = 13, L2 = 13, ex = sx + Math.sin(a1) * L1, ey = sy + Math.cos(a1) * L1, hx = ex + Math.sin(a2) * L2, hy = ey + Math.cos(a2) * L2;
  limb(ctx, sx, sy, ex, ey, 10, dark ? '#131317' : HUNTER.armor);
  // correa de cuero en el brazo
  ctx.save(); ctx.translate((sx + ex) / 2, (sy + ey) / 2); ctx.rotate(-a1); blob(ctx, HUNTER.strap, 1.6, () => ctx.roundRect(-6, -1.6, 12, 3.2, 1)); ctx.restore();
  // guantelete: antebrazo ancho con bandas de metal
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(-a2);
  blob(ctx, lin(ctx, -7, 0, 7, 0, [[0, '#2c2c34'], [0.5, '#4a4a56'], [1, '#1a1a20']]), 2.6, () => { ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(7.5, L2 - 1); ctx.lineTo(-7.5, L2 - 1); ctx.closePath(); });
  for (const by of [3.5, 8.5]) { ctx.fillStyle = '#b9bcc8'; ctx.fillRect(-6.2 - by * 0.12, by, 12.4 + by * 0.24, 1.8); }
  ctx.restore();
  // el arma (empuñada en el puño)
  if (item !== 'none') { ctx.save(); ctx.translate(hx, hy); ctx.rotate(itemA); if (item === 'sword') drawSword(ctx); else drawStakeItem(ctx); ctx.restore(); }
  // puño
  blob(ctx, lin(ctx, hx - 7, hy - 7, hx + 7, hy + 7, [[0, '#45454f'], [1, '#141418']]), 2.6, () => ctx.ellipse(hx, hy, 7.6, 7, -a2, 0, TAU));
  ctx.strokeStyle = 'rgba(210,214,224,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(hx, hy, 4.6, -a2 + 0.2 - Math.PI / 2, -a2 + 1.6 - Math.PI / 2); ctx.stroke();
}
function pauldron(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number) {
  blob(ctx, lin(ctx, x - rx, y - ry, x + rx, y + ry, [[0, '#5c5c68'], [0.45, '#25252c'], [1, '#0e0e12']]), 3, () => ctx.ellipse(x, y, rx, ry, rot, Math.PI * 0.95, Math.PI * 2.05));
  ctx.strokeStyle = '#a9acb8'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(x, y + 1, rx - 2.5, ry - 2.5, rot, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#c4c7d2'; for (const k of [-0.45, 0.45]) { ctx.beginPath(); ctx.arc(x + rx * k, y - ry * 0.05, 1.5, 0, TAU); ctx.fill(); } // remaches
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.35, y - ry * 0.55, rx * 0.28, ry * 0.16, -0.4, 0, TAU); ctx.fill();
}
export function drawHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, t: number) {
  const moving = Math.abs(p.vx) > 0.6 && p.onGround, air = !p.onGround;
  const w = p.walkT * Math.PI;
  const swing = moving ? Math.sin(w) : 0;
  const bob = moving ? Math.abs(Math.cos(w)) * 2.2 : Math.sin(t * 2.4) * 0.7;
  const squash = p.landT > 0 ? 1 - p.landT * 0.6 : 1;
  ctx.save(); ctx.scale(1, squash); ctx.translate(0, air ? 0 : -bob + 1);
  // capa ancha (se ve a los dos costados del cuerpo), flamea con la velocidad
  const fl = Math.sin(t * 6 + p.x) * 2.5 + Math.min(14, Math.abs(p.vx) * 1.6) + (air ? 6 : 0), lift = air ? (p.vy > 0 ? 8 : -6) : 0;
  blob(ctx, lin(ctx, 0, -60, -20, 0, [[0, HUNTER.cape], [1, HUNTER.capeD]]), 3, () => {
    ctx.moveTo(-14, -62); ctx.quadraticCurveTo(-30 - fl * 0.5, -40 - lift, -36 - fl, -4 - lift * 0.6);
    const n = 5;
    for (let i = 0; i < n; i++) { const x0 = -36 - fl + i * (58 + fl) / n, x1 = -36 - fl + (i + 1) * (58 + fl) / n; ctx.lineTo((x0 + x1) / 2, 2 - lift * 0.4 + Math.sin(t * 5 + i) * 1.5); ctx.lineTo(x1, -4 - lift * 0.4); }
    ctx.quadraticCurveTo(26, -30, 18, -62); ctx.closePath();
  });
  ctx.fillStyle = 'rgba(40,0,6,0.45)'; ctx.beginPath(); ctx.moveTo(-10, -58); ctx.quadraticCurveTo(-18, -30, -24 - fl * 0.6, -6); ctx.lineTo(16, -8); ctx.quadraticCurveTo(18, -34, 14, -58); ctx.closePath(); ctx.fill(); // el forro, más oscuro
  // brazo de atrás: cuelga al costado con el puño cerrado
  const backA1 = air ? -0.9 : -0.18 - swing * 0.45, backA2 = air ? -0.3 : 0.12 - swing * 0.3;
  hunterArm(ctx, -12, -55, backA1, backA2, 'none', 0, true);
  // piernas abiertas (postura firme)
  const pants = { pant: '#16161b', pad: '#33333d', boot: '#121216', trim: '#a5a8b5' };
  if (air) { leg(ctx, -7, -32, 15, 14, -0.7, 0.4, pants, 16); leg(ctx, 8, -32, 15, 14, 0.9, -0.3, pants, 16); }
  else {
    leg(ctx, -7, -32, 15, 14, -0.22 - swing * 0.55, -0.12 - swing * 0.55 + Math.max(0, -swing) * 0.5, pants, 16);
    leg(ctx, 8, -32, 15, 14, 0.22 + swing * 0.55, 0.12 + swing * 0.55 + Math.max(0, swing) * 0.5, pants, 16);
  }
  // faldones del saco (cuero oscuro con ribete marrón), partidos en el medio
  for (const [x0, x1, sk] of [[-17, -1, -1], [1, 18, 1]] as const) {
    const dx = sk * (swing * 3);
    blob(ctx, lin(ctx, 0, -32, 0, -14, [[0, '#26232a'], [1, '#141217']]), 2.6, () => { ctx.moveTo(x0, -31); ctx.lineTo(x1, -31); ctx.lineTo(x1 + sk * 3 + dx, -15); ctx.lineTo(x0 + sk * 1 + dx, -15); ctx.closePath(); });
    ctx.strokeStyle = HUNTER.strapL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x1 + sk * 2.4 + dx - sk * 1.5, -17); ctx.lineTo(x0 + sk + dx + 1.5 * sk, -17); ctx.stroke();
  }
  // torso: armadura negra, cuello alto, correas cruzadas con broche, cinturón ancho con hebilla grande
  blob(ctx, lin(ctx, -16, -62, 18, -28, [[0, '#3e3e48'], [0.5, HUNTER.armor], [1, '#0f0f13']]), 3, () => ctx.roundRect(-16, -63, 34, 34, 8));
  blob(ctx, '#2e2e36', 2.4, () => { ctx.moveTo(-8, -66); ctx.lineTo(10, -66); ctx.lineTo(12, -58); ctx.lineTo(1, -54); ctx.lineTo(-10, -58); ctx.closePath(); }); // cuello alto
  ctx.fillStyle = '#26262e'; ctx.beginPath(); ctx.moveTo(-12, -54); ctx.lineTo(14, -54); ctx.lineTo(11, -36); ctx.lineTo(1, -33); ctx.lineTo(-9, -36); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-9, -52); ctx.lineTo(10, -52); ctx.moveTo(-8, -44); ctx.lineTo(-2, -41); ctx.stroke();
  for (const [a, b] of [[-14, 15], [16, -13]] as const) { ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(a, -61); ctx.lineTo(b, -33); ctx.stroke(); ctx.strokeStyle = HUNTER.strap; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = HUNTER.strapL; ctx.lineWidth = 1.2; ctx.stroke(); }
  blob(ctx, '#5a3a24', 2, () => { ctx.moveTo(1, -53); ctx.lineTo(6.5, -47); ctx.lineTo(1, -41); ctx.lineTo(-4.5, -47); ctx.closePath(); });
  ctx.strokeStyle = '#c9ccd6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(1, -50.5); ctx.lineTo(4, -47); ctx.lineTo(1, -43.5); ctx.lineTo(-2, -47); ctx.closePath(); ctx.stroke();
  blob(ctx, lin(ctx, 0, -34, 0, -27, [[0, HUNTER.strapL], [1, HUNTER.strap]]), 2.6, () => ctx.roundRect(-17, -34, 36, 7.5, 2));
  blob(ctx, lin(ctx, -5, -36, 7, -25, [[0, '#eef0f6'], [1, '#8e919d']]), 2.2, () => ctx.roundRect(-4.5, -36, 11, 11, 1.8)); ctx.fillStyle = '#5a3a24'; ctx.fillRect(-1.2, -32.8, 4.4, 4.6);
  // hombrera de atrás, cabeza y hombrera de adelante (grandes y redondas, como la referencia)
  pauldron(ctx, -13, -54, 11, 9.5, -0.25);
  ctx.save(); ctx.translate(0, -4); drawHunterHead(ctx, t, p.hurtT > 0); ctx.restore();
  // brazo de adelante con el arma: quieto, el puño adelante a la altura del pecho y la hoja para arriba
  const at = p.attackT;
  let a1 = air ? 1.0 : 0.3 + swing * 0.3, a2 = air ? 1.9 : 1.55 + swing * 0.2, itemA = 0.12;
  const SW0 = 3.3, SW1 = 1.15;
  if (at >= 0) {
    if (p.attackWeapon === 'sword') { const k = Math.min(1, at / 0.14), e = 1 - (1 - k) * (1 - k); a1 = SW0 + (SW1 - SW0) * e; a2 = a1 + 0.5 * (1 - e) - 0.1; itemA = Math.PI - a2; }
    else { const k = Math.min(1, at / 0.12); a1 = 2.8 - k * 1.4; a2 = a1 - 0.3 + k * 0.3; itemA = Math.PI - a2; }
  }
  const item: Weapon | 'none' = at >= 0 && p.attackWeapon === 'stakes' && at > 0.1 ? 'none' : g.weapon;
  if (at >= 0.02 && at < 0.24 && p.attackWeapon === 'sword') { // la estela de la espada
    const k = Math.min(1, at / 0.14), e = 1 - (1 - k) * (1 - k), aNow = SW0 + (SW1 - SW0) * e, fade = at > 0.14 ? 1 - (at - 0.14) / 0.1 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [r, wdt, col] of [[64, 18, `rgba(255,255,255,${0.5 * fade})`], [62, 8, `rgba(255,90,90,${0.65 * fade})`], [48, 4, `rgba(255,220,220,${0.5 * fade})`]] as const) {
      ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); ctx.arc(13, -55, r, Math.PI / 2 - SW0, Math.PI / 2 - aNow, false); ctx.stroke();
    }
    ctx.restore();
  }
  hunterArm(ctx, 14, -55, a1, a2, item, itemA);
  pauldron(ctx, 15, -55, 12.5, 10.5, 0.25);
  ctx.restore();
}
function drawHunterHead(ctx: CanvasRenderingContext2D, t: number, hurt: boolean) {
  const cx = 4, cy = -78;
  // pelo de atrás (por detrás de la cabeza)
  blob(ctx, HUNTER.hair, 3, () => { ctx.moveTo(cx - 24, cy + 4); ctx.quadraticCurveTo(cx - 30, cy - 14, cx - 20, cy - 26); ctx.lineTo(cx - 6, cy - 24); ctx.lineTo(cx - 10, cy + 12); ctx.closePath(); });
  // oreja
  blob(ctx, HUNTER.skin, 2.5, () => ctx.ellipse(cx - 14, cy + 2, 4.5, 6, 0, 0, TAU));
  // cara
  blob(ctx, lin(ctx, cx - 20, cy, cx + 24, cy, [[0, HUNTER.skinD], [0.35, HUNTER.skin], [1, '#f3c8a3']]), 3, () => { ctx.moveTo(cx - 18, cy - 10); ctx.quadraticCurveTo(cx - 19, cy + 16, cx - 4, cy + 21); ctx.quadraticCurveTo(cx + 12, cy + 25, cx + 21, cy + 12); ctx.quadraticCurveTo(cx + 25, cy - 4, cx + 20, cy - 16); ctx.quadraticCurveTo(cx, cy - 24, cx - 18, cy - 10); ctx.closePath(); });
  // barba
  ctx.fillStyle = HUNTER.beard; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(cx - 14, cy + 5); ctx.quadraticCurveTo(cx - 12, cy + 18, cx - 2, cy + 20); ctx.quadraticCurveTo(cx + 10, cy + 24, cx + 19, cy + 11); ctx.lineTo(cx + 18, cy + 8); ctx.quadraticCurveTo(cx + 12, cy + 16, cx + 6, cy + 13); ctx.quadraticCurveTo(cx, cy + 15, cx - 6, cy + 10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 8, cy + 14); ctx.lineTo(cx + 15, cy + 13); ctx.lineTo(cx + 12, cy + 21); ctx.closePath(); ctx.fill(); // chivita
  ctx.globalAlpha = 1;
  ctx.strokeStyle = HUNTER.beard; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 6, cy + 9); ctx.quadraticCurveTo(cx + 11, cy + 7, cx + 17, cy + 9); ctx.stroke(); // bigote
  // boca seria
  ctx.strokeStyle = '#3a1d12'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx + 8, cy + 13); ctx.lineTo(cx + 15, cy + 12.5); ctx.stroke();
  // nariz
  ctx.strokeStyle = HUNTER.skinD; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx + 17, cy + 1); ctx.lineTo(cx + 20, cy + 5); ctx.lineTo(cx + 16, cy + 6); ctx.stroke();
  // ojos y cejas enojadas
  const blink = Math.sin(t * 1.3) > 0.985;
  ctx.fillStyle = INK;
  if (hurt) { ctx.lineWidth = 2.4; ctx.strokeStyle = INK; for (const ex of [cx + 4, cx + 15]) { ctx.beginPath(); ctx.moveTo(ex - 3, cy - 5); ctx.lineTo(ex + 3, cy + 1); ctx.moveTo(ex + 3, cy - 5); ctx.lineTo(ex - 3, cy + 1); ctx.stroke(); } }
  else for (const [ex, sz] of [[cx + 4, 1], [cx + 15.5, 0.9]] as const) {
    if (blink) { ctx.fillRect(ex - 3, cy - 2, 6, 1.8); continue; }
    ctx.beginPath(); ctx.ellipse(ex, cy - 1, 2.8 * sz, 3.3 * sz, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 0.8, cy - 2.2, 0.9, 0, TAU); ctx.fill(); ctx.fillStyle = INK;
  }
  ctx.lineCap = 'round'; ctx.strokeStyle = HUNTER.hair; ctx.lineWidth = 4.4;
  ctx.beginPath(); ctx.moveTo(cx - 2, cy - 10); ctx.lineTo(cx + 8, cy - 4.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 12.5, cy - 4.5); ctx.lineTo(cx + 21, cy - 10); ctx.stroke();
  // pelo de arriba: mechones despeinados con un mechón rojo
  blob(ctx, lin(ctx, cx - 20, cy - 30, cx + 20, cy - 6, [[0, HUNTER.hairL], [1, HUNTER.hair]]), 3, () => {
    ctx.moveTo(cx - 22, cy - 2); ctx.quadraticCurveTo(cx - 26, cy - 22, cx - 12, cy - 30);
    ctx.lineTo(cx - 8, cy - 36); ctx.lineTo(cx - 2, cy - 30); ctx.lineTo(cx + 6, cy - 37); ctx.lineTo(cx + 10, cy - 29); ctx.lineTo(cx + 20, cy - 31);
    ctx.lineTo(cx + 19, cy - 22); ctx.lineTo(cx + 27, cy - 17); ctx.lineTo(cx + 18, cy - 14); ctx.lineTo(cx + 20, cy - 8);
    ctx.lineTo(cx + 10, cy - 15); ctx.lineTo(cx + 6, cy - 9); ctx.lineTo(cx + 1, cy - 16); ctx.lineTo(cx - 6, cy - 10); ctx.lineTo(cx - 9, cy - 16);
    ctx.quadraticCurveTo(cx - 16, cy - 8, cx - 15, cy + 4); ctx.closePath();
  });
  ctx.strokeStyle = HUNTER.streak; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 28); ctx.quadraticCurveTo(cx - 2, cy - 30, cx + 4, cy - 22); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 22); ctx.quadraticCurveTo(cx - 6, cy - 28, cx + 2, cy - 27); ctx.stroke();
}

// ---------------------------------------------------------------- Los vampiros
const VAMP = { skin: '#ddd0ea', skinD: '#a897c2', hair: '#121018', hairL: '#3a3048', coat: '#16131b', coatL: '#2e2836', red: '#d0131f', redD: '#6e0910', metal: '#9aa0ad' };
function vampHead(ctx: CanvasRenderingContext2D, t: number, open: boolean, spiky: boolean) {
  const cx = 4, cy = -74;
  // cuello alto rojo (detrás de la cabeza)
  blob(ctx, lin(ctx, 0, cy - 30, 0, cy + 20, [[0, VAMP.red], [1, VAMP.redD]]), 3, () => { ctx.moveTo(cx - 22, cy + 18); ctx.lineTo(cx - 30, cy - 18); ctx.lineTo(cx - 12, cy - 4); ctx.lineTo(cx + 20, cy - 4); ctx.lineTo(cx + 32, cy - 16); ctx.lineTo(cx + 22, cy + 20); ctx.closePath(); });
  ctx.fillStyle = '#0c0a10'; ctx.beginPath(); ctx.moveTo(cx - 18, cy + 14); ctx.lineTo(cx - 24, cy - 10); ctx.lineTo(cx - 10, cy + 2); ctx.lineTo(cx + 18, cy + 2); ctx.lineTo(cx + 26, cy - 8); ctx.lineTo(cx + 18, cy + 16); ctx.closePath(); ctx.fill();
  // pelo de atrás
  blob(ctx, VAMP.hair, 3, () => { ctx.moveTo(cx - 20, cy + 4); ctx.quadraticCurveTo(cx - 28, cy - 16, cx - 14, cy - 28); ctx.lineTo(cx - 4, cy - 10); ctx.closePath(); });
  // oreja puntiaguda
  blob(ctx, VAMP.skin, 2.5, () => { ctx.moveTo(cx - 12, cy - 4); ctx.lineTo(cx - 26, cy - 14); ctx.lineTo(cx - 14, cy + 8); ctx.closePath(); });
  // cara
  blob(ctx, lin(ctx, cx - 20, cy, cx + 24, cy, [[0, VAMP.skinD], [0.4, VAMP.skin], [1, '#efe6f7']]), 3, () => { ctx.moveTo(cx - 17, cy - 10); ctx.quadraticCurveTo(cx - 18, cy + 14, cx - 2, cy + 20); ctx.quadraticCurveTo(cx + 12, cy + 23, cx + 21, cy + 10); ctx.quadraticCurveTo(cx + 25, cy - 6, cx + 19, cy - 16); ctx.quadraticCurveTo(cx, cy - 24, cx - 17, cy - 10); ctx.closePath(); });
  // ojos rojos que brillan
  const pulse = 0.75 + 0.25 * Math.sin(t * 6);
  for (const ex of [cx + 4, cx + 15.5]) {
    glow(ctx, ex, cy - 1, 11, `rgba(255,30,40,${0.55 * pulse})`);
    ctx.fillStyle = '#ff2b33'; ctx.beginPath(); ctx.ellipse(ex, cy - 1, 3.6, 3.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd3d3'; ctx.beginPath(); ctx.arc(ex + 0.5, cy - 1.6, 1.4, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 2, cy - 10); ctx.lineTo(cx + 8, cy - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 12, cy - 5); ctx.lineTo(cx + 21, cy - 10); ctx.stroke();
  // boca con colmillos
  if (open) {
    blob(ctx, '#5a0710', 2.2, () => { ctx.moveTo(cx + 3, cy + 9); ctx.quadraticCurveTo(cx + 10, cy + 6, cx + 18, cy + 9); ctx.quadraticCurveTo(cx + 11, cy + 20, cx + 3, cy + 9); });
    ctx.fillStyle = '#e04a5a'; ctx.beginPath(); ctx.ellipse(cx + 10.5, cy + 14, 3.6, 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; for (const fx of [cx + 5, cx + 15.5]) { ctx.beginPath(); ctx.moveTo(fx - 1.6, cy + 9); ctx.lineTo(fx, cy + 14); ctx.lineTo(fx + 1.6, cy + 9); ctx.closePath(); ctx.fill(); }
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 4, cy + 11); ctx.quadraticCurveTo(cx + 10, cy + 8, cx + 17, cy + 11); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const fx of [cx + 6.5, cx + 14.5]) { ctx.beginPath(); ctx.moveTo(fx - 1.5, cy + 9.6); ctx.lineTo(fx, cy + 14.5); ctx.lineTo(fx + 1.5, cy + 9.6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  // pelo: peinado para atrás con pico en la frente (o en puntas, el volador)
  blob(ctx, lin(ctx, cx - 10, cy - 34, cx + 14, cy - 8, [[0, VAMP.hairL], [1, VAMP.hair]]), 3, () => {
    ctx.moveTo(cx - 20, cy - 2); ctx.quadraticCurveTo(cx - 24, cy - 24, cx - 6, cy - 30);
    if (spiky) { ctx.lineTo(cx - 10, cy - 42); ctx.lineTo(cx + 2, cy - 31); ctx.lineTo(cx + 4, cy - 44); ctx.lineTo(cx + 10, cy - 30); ctx.lineTo(cx + 22, cy - 36); ctx.lineTo(cx + 18, cy - 24); }
    else { ctx.quadraticCurveTo(cx + 12, cy - 34, cx + 22, cy - 24); ctx.lineTo(cx + 26, cy - 32); ctx.lineTo(cx + 22, cy - 18); }
    ctx.lineTo(cx + 19, cy - 14); ctx.quadraticCurveTo(cx + 14, cy - 16, cx + 10, cy - 11); ctx.lineTo(cx + 8, cy - 6); // pico en la frente
    ctx.lineTo(cx + 5, cy - 12); ctx.quadraticCurveTo(cx - 6, cy - 16, cx - 13, cy - 8); ctx.lineTo(cx - 14, cy + 2); ctx.closePath();
  });
  ctx.strokeStyle = 'rgba(190,150,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 22); ctx.quadraticCurveTo(cx - 2, cy - 30, cx + 12, cy - 26); ctx.stroke();
}
// Mano con garras (uñas rojas largas).
function claw(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  blob(ctx, VAMP.skin, 2.2, () => ctx.ellipse(0, 0, 5.4, 4.6, 0, 0, TAU));
  for (let i = 0; i < 4; i++) {
    const fa = -0.6 + i * 0.4;
    ctx.save(); ctx.rotate(fa);
    blob(ctx, VAMP.skin, 1.8, () => ctx.roundRect(3, -1.6, 6, 3.2, 1.5));
    blob(ctx, '#d4202c', 1.4, () => { ctx.moveTo(8.5, -1.6); ctx.quadraticCurveTo(14, -1, 15, 2.5); ctx.lineTo(8.5, 1.6); ctx.closePath(); });
    ctx.restore();
  }
  ctx.restore();
}
function vampBody(ctx: CanvasRenderingContext2D, t: number) {
  blob(ctx, lin(ctx, -14, -58, 16, -26, [[0, VAMP.coatL], [0.5, VAMP.coat], [1, '#0b090e']]), 3, () => ctx.roundRect(-14, -58, 29, 32, 7));
  ctx.strokeStyle = VAMP.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, -54); ctx.lineTo(-10, -28); ctx.moveTo(13, -54); ctx.lineTo(12, -28); ctx.stroke();
  // corbatín de volados blanco con gema
  blob(ctx, '#f2eef6', 2, () => { ctx.moveTo(-4, -58); ctx.lineTo(8, -58); ctx.lineTo(6, -52); ctx.lineTo(9, -48); ctx.lineTo(4, -45); ctx.lineTo(2, -41); ctx.lineTo(-1, -45); ctx.lineTo(-6, -48); ctx.lineTo(-3, -52); ctx.closePath(); });
  ctx.strokeStyle = '#b9b0c4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -51); ctx.lineTo(6, -51); ctx.moveTo(-4, -47); ctx.lineTo(7, -47); ctx.stroke();
  blob(ctx, '#e3142a', 1.8, () => ctx.arc(2, -56, 2.6, 0, TAU));
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(1.3, -56.8, 0.9, 0, TAU); ctx.fill();
  if (Math.sin(t * 3) > 0.9) glow(ctx, 2, -56, 6, 'rgba(255,60,80,0.8)');
  // cinturón con hebilla
  blob(ctx, '#5e3520', 2.5, () => ctx.roundRect(-15, -32, 31, 6.5, 2));
  blob(ctx, '#c4c8d2', 2, () => ctx.roundRect(-3.5, -33.5, 9, 9, 1.5)); ctx.fillStyle = '#5e3520'; ctx.fillRect(-0.6, -30.5, 3.4, 3);
  // hombrera
  blob(ctx, lin(ctx, 4, -64, 20, -48, [[0, '#3c3546'], [1, '#141118']]), 2.5, () => ctx.ellipse(12, -55, 8.5, 7.5, 0.3, 0, TAU));
  ctx.fillStyle = VAMP.metal; ctx.beginPath(); ctx.arc(12, -58, 1.6, 0, TAU); ctx.arc(16, -54, 1.4, 0, TAU); ctx.fill();
}
function vampCape(ctx: CanvasRenderingContext2D, t: number, fl: number) {
  blob(ctx, lin(ctx, 0, -60, -32, 0, [[0, VAMP.red], [1, VAMP.redD]]), 3, () => {
    ctx.moveTo(-8, -58); ctx.quadraticCurveTo(-24 - fl * 0.5, -36, -32 - fl, -2);
    for (let i = 0; i < 4; i++) { const x0 = -32 - fl + i * (8.5 + fl * 0.22); ctx.lineTo(x0 + 4.2 + fl * 0.11, 4 + Math.sin(t * 6 + i) * 1.5); ctx.lineTo(x0 + 8.5 + fl * 0.22, -1); }
    ctx.lineTo(2, -14); ctx.lineTo(6, -56); ctx.closePath();
  });
}
const VAMP_PANTS = { pant: '#141118', pad: '#2a2530', boot: '#0f0d12', trim: '#9aa0ad' };
export function drawWalker(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const moving = Math.abs(v.vx) > 0.3 && v.onGround, air = !v.onGround;
  const w = v.walkT * 2.6, swing = moving ? Math.sin(w) : 0, bob = moving ? Math.abs(Math.cos(w)) * 2 : Math.sin(t * 2 + v.id) * 0.8;
  ctx.save(); ctx.translate(0, air ? 0 : -bob + 3);
  vampCape(ctx, t + v.id, Math.min(12, Math.abs(v.vx) * 2.5) + Math.sin(t * 5 + v.id) * 2);
  // brazo de atrás (garra hacia adelante)
  const clawK = v.state === 'claw' ? (v.t < 0.36 ? -Math.min(1, v.t / 0.3) : Math.max(-1, -1 + (v.t - 0.36) * 8)) : 0;
  const reach = 1.2 + swing * 0.15 + clawK * 1.2;
  { const sx = -6, sy = -52, hx = sx + Math.sin(reach) * 20, hy = sy + Math.cos(reach) * 20; limb(ctx, sx, sy, hx, hy, 8.5, '#100e14'); claw(ctx, hx, hy, Math.PI / 2 - reach); }
  if (air) { leg(ctx, -6, -30, 14, 14, -0.8, 0.3, VAMP_PANTS); leg(ctx, 6, -30, 14, 14, 0.8, -0.4, VAMP_PANTS); }
  else { leg(ctx, -6, -30, 15, 14, -0.35 - swing * 0.55, -0.15 - swing * 0.5 + Math.max(0, -swing) * 0.5, VAMP_PANTS); leg(ctx, 6, -30, 15, 14, 0.45 + swing * 0.55, 0.05 + swing * 0.5 + Math.max(0, swing) * 0.5, VAMP_PANTS); }
  ctx.save(); ctx.translate(2, 3); ctx.rotate(0.12); vampBody(ctx, t); ctx.restore(); // agachado, el cuerpo inclinado hacia adelante
  ctx.save(); ctx.translate(5, 4); vampHead(ctx, t + v.id, v.state === 'claw', false); ctx.restore();
  { const sx = 14, sy = -48, a = 1.35 - swing * 0.15 + clawK * 1.3, hx = sx + Math.sin(a) * 21, hy = sy + Math.cos(a) * 21; limb(ctx, sx, sy, hx, hy, 9, VAMP.coat); ctx.save(); ctx.translate(sx + Math.sin(a) * 15, sy + Math.cos(a) * 15); ctx.rotate(Math.PI / 2 - a); blob(ctx, VAMP.metal, 1.8, () => ctx.roundRect(-3, -5, 4, 10, 1)); ctx.restore(); claw(ctx, hx, hy, Math.PI / 2 - a); }
  ctx.restore();
}
function wing(ctx: CanvasRenderingContext2D, flap: number, dark: boolean) {
  // hueso del brazo y tres dedos; la membrana roja entre los dedos con el borde festoneado
  const up = flap; // -1 abajo … 1 arriba
  const wx = 34, wy = -22 - up * 26;
  const tips: [number, number][] = [[60, -40 - up * 34], [64, -6 - up * 22], [52, 18 - up * 8], [30, 22 - up * 2]];
  const m = dark ? ['#8c0d16', '#3a050a'] : ['#e01b28', '#7a0a12'];
  blob(ctx, lin(ctx, 0, -40, 60, 20, [[0, m[0]], [1, m[1]]]), 3, () => {
    ctx.moveTo(4, -6); ctx.lineTo(wx, wy); ctx.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) { const [ax, ay] = tips[i - 1], [bx, by] = tips[i]; ctx.quadraticCurveTo((ax + bx) / 2 - 8, (ay + by) / 2 - 2, bx, by); }
    ctx.quadraticCurveTo(14, 10, 4, 4); ctx.closePath();
  });
  ctx.strokeStyle = dark ? '#1a1418' : '#221a22'; ctx.lineCap = 'round';
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(wx, wy); ctx.stroke();
  ctx.lineWidth = 2.6; for (const [tx, ty] of tips.slice(0, 3)) { ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty); ctx.stroke(); }
  ctx.fillStyle = '#c9ccd6'; ctx.beginPath(); ctx.moveTo(wx - 2, wy - 2); ctx.lineTo(wx + 1, wy - 9); ctx.lineTo(wx + 3, wy - 1); ctx.closePath(); ctx.fill(); // garra del ala
}
export function drawFlyer(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const diving = v.state === 'dive';
  const flap = diving ? 1 : Math.sin(v.walkT * 11 + v.id);
  ctx.save(); ctx.translate(0, -48 + Math.sin(v.walkT * 11 + v.id + 1) * 2);
  if (diving) ctx.rotate(0.35);
  ctx.save(); ctx.translate(-4, -8); ctx.scale(-1.55, 1.55); wing(ctx, flap, true); ctx.restore(); // alas grandes
  // piernas colgando
  leg(ctx, -5, 22, 12, 12, -0.9, -0.2, VAMP_PANTS, 12); leg(ctx, 6, 22, 12, 12, -0.4, 0.3, VAMP_PANTS, 12);
  ctx.save(); ctx.translate(0, 52); ctx.scale(0.86, 0.86); ctx.translate(0, -52); ctx.translate(0, 22 + 26); vampBody(ctx, t); ctx.restore();
  ctx.save(); ctx.translate(-2, -10); ctx.scale(1.45, 1.45); wing(ctx, flap * 0.9, false); ctx.restore();
  ctx.save(); ctx.translate(2, 46); vampHead(ctx, t + v.id, true, true); ctx.restore();
  // garras adelante
  for (const [sx, a, d] of [[-4, 1.2, '#100e14'], [12, 1.45, VAMP.coat]] as const) { const sy = -2, hx = sx + Math.sin(a) * 18, hy = sy + Math.cos(a) * 18; limb(ctx, sx, sy, hx, hy, 8, d); claw(ctx, hx, hy, Math.PI / 2 - a); }
  ctx.restore();
}

// ---------------------------------------------------------------- Esqueleto, huesos y chispas
function bone(ctx: CanvasRenderingContext2D, len: number, w: number) {
  blob(ctx, '#f1ead8', 2, () => { ctx.roundRect(-len / 2, -w / 2, len, w, w / 2); });
  for (const sx of [-len / 2, len / 2]) blob(ctx, '#f1ead8', 2, () => { ctx.arc(sx, -w * 0.45, w * 0.55, 0, TAU); ctx.moveTo(sx + w * 0.55, w * 0.45); ctx.arc(sx, w * 0.45, w * 0.55, 0, TAU); });
}
function skull(ctx: CanvasRenderingContext2D, eyes: string) {
  blob(ctx, lin(ctx, -14, -14, 14, 14, [[0, '#fffaf0'], [1, '#cfc4ad']]), 2.5, () => { ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-16, -18, 0, -18); ctx.quadraticCurveTo(16, -18, 14, 2); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.closePath(); });
  ctx.fillStyle = eyes; for (const ex of [-5.5, 5.5]) { ctx.beginPath(); ctx.ellipse(ex, -3, 4, 4.6, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2a1e1a'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-1.8, 5); ctx.lineTo(1.8, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { ctx.fillRect(i * 3 - 1.2, 8, 2.4, 3.5); }
  // colmillos de vampiro
  ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-4.8, 14); ctx.lineTo(-3.6, 8); ctx.moveTo(3.6, 8); ctx.lineTo(4.8, 14); ctx.lineTo(6, 8); ctx.fill();
}
function ribs(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const [col, lw] of [[INK, 5.5], ['#f1ead8', 3]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke();
    for (let i = 0; i < 4; i++) { const y = -9 + i * 5.5, r = 11 - i * 1.2; ctx.beginPath(); ctx.ellipse(0, y + 2, r, 4, 0, Math.PI, TAU); ctx.stroke(); }
  }
}
function pelvis(ctx: CanvasRenderingContext2D) { blob(ctx, '#f1ead8', 2.2, () => { ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, -9, 11, -4); ctx.lineTo(7, 6); ctx.lineTo(2, 3); ctx.lineTo(-2, 3); ctx.lineTo(-7, 6); ctx.closePath(); }); }
function spine(ctx: CanvasRenderingContext2D) { for (let i = 0; i < 5; i++) blob(ctx, '#f1ead8', 1.6, () => ctx.roundRect(-3.5, -12 + i * 5, 7, 4, 1.5)); }
function jaw(ctx: CanvasRenderingContext2D) { blob(ctx, '#ece3cf', 2, () => { ctx.moveTo(-9, -2); ctx.lineTo(9, -2); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); }); ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 3 - 1, -4, 2, 2.5); }
export function drawBone(ctx: CanvasRenderingContext2D, b: Bone, v: View) {
  const k = PLAYER_H * BIG * v.s / 100, fade = Math.min(1, (3.4 - b.t) / 0.6);
  ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(X(v, b.x), Y(v, b.y)); ctx.scale(k, k); ctx.rotate(b.a);
  if (b.kind === 'skull') skull(ctx, b.t < 1.2 ? '#ff3a2a' : '#2a1e1a');
  else if (b.kind === 'jaw') jaw(ctx);
  else if (b.kind === 'ribs') ribs(ctx);
  else if (b.kind === 'spine') spine(ctx);
  else if (b.kind === 'pelvis') pelvis(ctx);
  else bone(ctx, b.kind === 'leg' ? 24 : 18, 4.2);
  ctx.restore();
  if (b.t < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; flame(ctx, X(v, b.x), Y(v, b.y), v.s * 0.16 * (1 - b.t), b.t * 9 + b.x, b.y); ctx.restore(); } // los huesos salen prendidos fuego
}
// El vampiro se vuelve esqueleto: la carne se desvanece, el esqueleto brilla naranja y tiembla.
export function drawCorpse(ctx: CanvasRenderingContext2D, c: Corpse, v: View, t: number) {
  const k = (c.kind === 'walker' ? 1.8 : 1.7) * BIG * v.s / 100, f = Math.min(1, c.t / BURN_AT), burn = Math.max(0, Math.min(1, (c.t - BURN_AT) / (BLOW_AT - BURN_AT)));
  ctx.save(); ctx.translate(X(v, c.x) + Math.sin(c.t * 90) * f * 2.5, Y(v, c.y)); ctx.scale(k * c.face, k);
  glow(ctx, 0, -50, 70, `rgba(255,140,40,${0.5 * f})`);
  if (f < 1) {
    ctx.save(); ctx.globalAlpha = 1 - f;
    const fake = { id: c.id, kind: c.kind, x: 0, y: 0, vx: 0, vy: 0, face: 1 as const, state: 'walk' as const, t: 0, onGround: true, surface: null, walkT: 0, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false };
    if (c.kind === 'walker') drawWalker(ctx, fake, t); else drawFlyer(ctx, fake, t);
    ctx.restore();
  }
  ctx.globalAlpha = f;
  const dy = c.kind === 'flyer' ? -40 : 0;
  ctx.translate(0, dy);
  // piernas, columna, costillas, brazos y cráneo
  ctx.save(); ctx.translate(-5, -16); ctx.rotate(Math.PI / 2 + 0.15); bone(ctx, 26, 4.2); ctx.restore();
  ctx.save(); ctx.translate(6, -16); ctx.rotate(Math.PI / 2 - 0.15); bone(ctx, 26, 4.2); ctx.restore();
  ctx.save(); ctx.translate(0, -32); pelvis(ctx); ctx.restore();
  ctx.save(); ctx.translate(0, -44); ribs(ctx); ctx.restore();
  ctx.save(); ctx.translate(-12, -46); ctx.rotate(1.1); bone(ctx, 20, 3.8); ctx.restore();
  ctx.save(); ctx.translate(16, -46); ctx.rotate(-1.1 + Math.sin(c.t * 40) * 0.2); bone(ctx, 20, 3.8); ctx.restore();
  ctx.save(); ctx.translate(4, -70); ctx.scale(1.35, 1.35); skull(ctx, '#ff3a2a'); ctx.restore();
  // se prende fuego: llamas que suben por todo el esqueleto
  if (burn > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(40,10,0,${0.45 * burn})`; ctx.beginPath(); ctx.ellipse(0, -45, 22, 48, 0, 0, TAU); ctx.fill(); // tostado
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -45, 80, `rgba(255,110,20,${0.6 * burn})`);
    for (const [fx, fy, sz] of [[-6, -2, 9], [7, -2, 9], [0, -28, 11], [-10, -44, 10], [12, -44, 10], [2, -60, 12], [4, -82, 14]] as const) flame(ctx, fx, fy, sz * (0.5 + burn), t * 1.4, fx + fy);
    ctx.restore();
  }
  ctx.restore();
}
export function drawBlood(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  for (const d of g.drops) {
    const x = X(v, d.x), y = Y(v, d.y), r = Math.max(1.2, d.r * v.s);
    if (d.stuck) { ctx.fillStyle = `rgba(120,0,10,${Math.min(0.85, (7 - d.t) / 2)})`; ctx.beginPath(); ctx.ellipse(x, y - 1, r * 1.6, r * 0.45, 0, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#b0101c'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.3, Math.atan2(-d.vy, d.vx) + Math.PI / 2, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,120,120,0.6)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill(); }
  }
}
export function drawSparks(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of g.sparks) {
    const a = 1 - s.t / s.life, x = X(v, s.x), y = Y(v, s.y), r = Math.max(1, v.s * 0.06 * (0.5 + a));
    ctx.strokeStyle = `hsla(${s.hue},100%,${60 + a * 30}%,${a})`; ctx.lineWidth = r; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * v.s * 0.02, y + s.vy * v.s * 0.02); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- El escenario (fondo, pisos, puerta)
let backdrop: HTMLImageElement | null = null;
let backdropReady = false;
export function setBackdrop(url: string, onLoad?: () => void) {
  if (typeof Image === 'undefined') return;
  if (backdrop && backdrop.src.endsWith(url)) return;
  backdrop = new Image(); backdropReady = false;
  backdrop.onload = () => { backdropReady = true; staticCache = null; onLoad?.(); };
  backdrop.src = url;
}
let staticCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function stoneBlocks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bw: number, bh: number, seed: number, base = [44, 40, 48]) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let r = 0; r * bh < h; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let c = -1; c * bw < w; c++) {
      const bx = x + c * bw + off, by = y + r * bh, n = hash(seed + r * 31 + c * 7), d = (n - 0.5) * 16;
      ctx.fillStyle = `rgb(${base[0] + d},${base[1] + d},${base[2] + d})`; ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx + 1, by + 1, bw - 2, Math.max(1, bh * 0.15));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + 1, by + bh - 1 - Math.max(1, bh * 0.15), bw - 2, Math.max(1, bh * 0.15));
      if (n > 0.86) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + bw * 0.3, by + 2); ctx.lineTo(bx + bw * 0.45, by + bh * 0.6); ctx.lineTo(bx + bw * 0.35, by + bh - 2); ctx.stroke(); }
    }
  }
  ctx.restore();
}
function paintStatic(ctx: CanvasRenderingContext2D, v: View) {
  // el fondo pintado (más oscuro para que se lean los pisos y los personajes)
  if (backdrop && backdropReady) {
    // sin la franja de abajo de la imagen (sus puentes pintados se confundían con los pisos de verdad)
    const iw = backdrop.naturalWidth, ih = backdrop.naturalHeight * 0.74, dh = Y(v, GROUND_Y) + v.s * 0.6, k = Math.max(v.w / iw, dh / ih);
    ctx.drawImage(backdrop, 0, 0, iw, ih, (v.w - iw * k) / 2, dh - ih * k, iw * k, ih * k);
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, dh, v.w, v.h - dh);
  } else { ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, '#0d1430'], [1, '#2a2440']]); ctx.fillRect(0, 0, v.w, v.h); }
  ctx.fillStyle = lin(ctx, 0, 0, 0, v.h, [[0, 'rgba(6,8,22,0.25)'], [0.6, 'rgba(6,6,16,0.35)'], [1, 'rgba(4,2,8,0.55)']]); ctx.fillRect(0, 0, v.w, v.h);
  // el vacío de los huecos: niebla que sube desde abajo
  for (const [a, b] of GAPS) {
    const x1 = X(v, a), x2 = X(v, b);
    ctx.fillStyle = lin(ctx, 0, Y(v, GROUND_Y), 0, v.h, [[0, 'rgba(10,12,30,0)'], [0.5, 'rgba(10,10,26,0.75)'], [1, 'rgba(2,2,8,0.95)']]); ctx.fillRect(x1, Y(v, GROUND_Y), x2 - x1, v.h);
  }
  // el suelo de piedra (extendido a los costados de la pantalla)
  const gTop = Y(v, GROUND_Y), bw = v.s * 1.1, bh = v.s * 0.55;
  for (const s of SURFACES.filter(q => q.ground)) {
    const x1 = s.x1 <= 0 ? 0 : X(v, s.x1), x2 = s.x2 >= W ? v.w : X(v, s.x2);
    stoneBlocks(ctx, x1, gTop, x2 - x1, v.h - gTop, bw, bh, s.x1 * 13);
    // borde de arriba: piedras grandes con luz de las antorchas
    ctx.fillStyle = lin(ctx, 0, gTop - v.s * 0.12, 0, gTop + v.s * 0.35, [[0, '#8a6a52'], [0.3, '#5a4a48'], [1, '#2a2430']]); ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.4);
    ctx.fillStyle = 'rgba(255,170,90,0.18)'; ctx.fillRect(x1, gTop - v.s * 0.08, x2 - x1, v.s * 0.06);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, gTop - v.s * 0.08, x2 - x1, v.h);
    // arcos de puente debajo
    if (s.x2 - s.x1 > 5) for (let ax = s.x1 + 1.6; ax < s.x2 - 1.2; ax += 3.2) {
      const cx = X(v, ax + 0.8), top = gTop + v.s * 0.9, r = v.s * 0.75;
      ctx.fillStyle = 'rgba(4,4,10,0.75)'; ctx.beginPath(); ctx.moveTo(cx - r, v.h); ctx.lineTo(cx - r, top + r); ctx.arc(cx, top + r, r, Math.PI, 0); ctx.lineTo(cx + r, v.h); ctx.closePath(); ctx.fill();
    }
  }
  // plataformas: losas de piedra colgadas con cadenas
  for (const s of SURFACES.filter(q => !q.ground)) {
    const x1 = X(v, s.x1), x2 = X(v, s.x2), y = Y(v, s.y), th = v.s * 0.6;
    for (const cx of [s.x1 + 0.4, s.x2 - 0.4]) { // cadenas hacia arriba
      ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = Math.max(1.5, v.s * 0.07);
      for (let cy = y; cy > Math.max(0, y - v.s * 2.6); cy -= v.s * 0.32) { ctx.beginPath(); ctx.ellipse(X(v, cx), cy - v.s * 0.16, v.s * 0.07, v.s * 0.14, 0, 0, TAU); ctx.stroke(); }
    }
    stoneBlocks(ctx, x1, y, x2 - x1, th, v.s * 0.9, th / 2, s.x1 * 17 + s.y, [70, 58, 60]);
    ctx.fillStyle = lin(ctx, 0, y - v.s * 0.1, 0, y + v.s * 0.18, [[0, '#d0a070'], [0.4, '#8a6a52'], [1, '#4a3e42']]); ctx.fillRect(x1, y - v.s * 0.08, x2 - x1, v.s * 0.2);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(x1, y - v.s * 0.08, x2 - x1, th + v.s * 0.08);
    // ménsulas de hierro
    ctx.fillStyle = '#26242c';
    for (const bx of [x1 + v.s * 0.3, x2 - v.s * 0.3]) { ctx.beginPath(); ctx.moveTo(bx - v.s * 0.2, y + th); ctx.lineTo(bx + v.s * 0.2, y + th); ctx.lineTo(bx, y + th + v.s * 0.45); ctx.closePath(); ctx.fill(); }
  }
  // la puerta: arco gótico de piedra
  const dx1 = X(v, DOOR.x1 - 0.35), dx2 = Math.max(X(v, DOOR.x2 + 0.35), v.w), dTop = Y(v, DOOR.y + DOOR.h + 0.9);
  stoneBlocks(ctx, dx1, dTop, dx2 - dx1, gTop - dTop, v.s * 0.7, v.s * 0.45, 99, [58, 52, 60]);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.strokeRect(dx1, dTop, dx2 - dx1, gTop - dTop);
}
// El hueco de la puerta (oscuro o con luz si está abierta) y la reja que sube.
function drawDoor(ctx: CanvasRenderingContext2D, g: Game, v: View, t: number) {
  const x1 = X(v, DOOR.x1), x2 = X(v, DOOR.x2), y0 = Y(v, DOOR.y), top = Y(v, DOOR.y + DOOR.h), mid = (x1 + x2) / 2, r = (x2 - x1) / 2;
  const path = () => { ctx.moveTo(x1, y0); ctx.lineTo(x1, top + r); ctx.quadraticCurveTo(x1, top - r * 0.4, mid, top - r); ctx.quadraticCurveTo(x2, top - r * 0.4, x2, top + r); ctx.lineTo(x2, y0); ctx.closePath(); };
  const open = g.door.open ? Math.min(1, g.door.t / 1.2) : 0;
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.fillStyle = open > 0 ? lin(ctx, 0, top, 0, y0, [[0, '#ffe2a0'], [1, '#ff9a3c']]) : '#0a080e'; ctx.fillRect(x1, top - r, x2 - x1, y0 - top + r);
  if (open > 0) glow(ctx, mid, (top + y0) / 2, v.s * 3, `rgba(255,220,140,${0.5 + 0.2 * Math.sin(t * 4)})`);
  // reja de hierro: sube cuando se abre
  const lift = open * (y0 - top + r);
  ctx.strokeStyle = '#1b1a20'; ctx.lineWidth = Math.max(2, v.s * 0.09);
  for (let i = 1; i < 6; i++) { const x = x1 + (x2 - x1) * i / 6; ctx.beginPath(); ctx.moveTo(x, top - r - lift); ctx.lineTo(x, y0 - lift); ctx.stroke(); }
  for (let j = 1; j < 5; j++) { const y = top + (y0 - top) * j / 5 - lift; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
  ctx.fillStyle = '#9aa0ad'; for (let i = 1; i < 6; i++) { const x = x1 + (x2 - x1) * i / 6; ctx.beginPath(); ctx.moveTo(x - v.s * 0.07, y0 - lift); ctx.lineTo(x, y0 - lift + v.s * 0.18); ctx.lineTo(x + v.s * 0.07, y0 - lift); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); path(); ctx.lineWidth = Math.max(3, v.s * 0.1); ctx.strokeStyle = INK; ctx.stroke();
  // cartel arriba: calavera (cerrada) o flecha "SALIDA" (abierta)
  const sy = top - r - v.s * 0.55;
  ctx.font = `900 ${Math.max(10, v.s * 0.42)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (open > 0) { ctx.fillStyle = `rgba(255,230,150,${0.7 + 0.3 * Math.sin(t * 6)})`; ctx.fillText('SALIDA ▶', mid - v.s * 0.3, sy); }
  else { ctx.fillStyle = '#c9c2b5'; ctx.fillText(`🔒 ${Math.max(0, 50 - g.total)}`, mid - v.s * 0.2, sy); }
}
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number) {
  const f = 0.85 + 0.15 * Math.sin(t * 13 + seed) + 0.1 * Math.sin(t * 29 + seed * 2);
  glow(ctx, x, y - size * 0.6, size * 3.2, 'rgba(255,140,40,0.35)');
  for (const [k, col] of [[1, '#ff5a14'], [0.72, '#ffa424'], [0.42, '#fff1a8']] as const) {
    const hgt = size * 1.9 * f * k, wd = size * 0.62 * k;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - wd, y);
    ctx.quadraticCurveTo(x - wd * 1.1, y - hgt * 0.5, x + Math.sin(t * 9 + seed) * wd * 0.4, y - hgt);
    ctx.quadraticCurveTo(x + wd * 1.1, y - hgt * 0.5, x + wd, y); ctx.closePath(); ctx.fill();
  }
}
// Antorchas en las plataformas y el suelo (decoración, con fuego animado).
const TORCHES: [number, number][] = [[1.2, GROUND_Y], [12.2, 6.6], [16, 6.6], [7.4, 9.9], [21, 9.9], [14, 13], [25.4, 6.6], [6.5, GROUND_Y]];
function drawTorches(ctx: CanvasRenderingContext2D, v: View, t: number) {
  TORCHES.forEach(([x, y], i) => {
    const px = X(v, x), py = Y(v, y), s = v.s;
    ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.moveTo(px - s * 0.05, py); ctx.lineTo(px - s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py - s * 0.9); ctx.lineTo(px + s * 0.05, py); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.28, py - s * 0.9); ctx.lineTo(px + s * 0.16, py - s * 1.12); ctx.lineTo(px - s * 0.16, py - s * 1.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    flame(ctx, px, py - s * 1.1, s * 0.22, t, i * 3.1);
  });
}

// ---------------------------------------------------------------- Trampas
function drawTraps(ctx: CanvasRenderingContext2D, g: Game, v: View, t: number) {
  for (const tr of TRAPS) {
    const st = trapState(tr, g.time);
    if (tr.kind === 'spikes') {
      const x1 = X(v, tr.x), x2 = X(v, tr.x2), y = Y(v, tr.y), n = 6, wd = (x2 - x1) / n, jit = st.warn ? Math.sin(t * 60) * v.s * 0.03 : 0;
      ctx.fillStyle = '#121016'; ctx.fillRect(x1, y - v.s * 0.04, x2 - x1, v.s * 0.12); // la ranura en el piso
      if (st.warn) glow(ctx, (x1 + x2) / 2, y, v.s * 1.2, 'rgba(255,60,40,0.35)');
      const hgt = v.s * 0.95 * st.on;
      if (hgt > 1) for (let i = 0; i < n; i++) {
        const bx = x1 + wd * i + jit;
        ctx.fillStyle = lin(ctx, bx, 0, bx + wd, 0, [[0, '#5d5f6b'], [0.5, '#e4e7ef'], [1, '#6b6d78']]);
        ctx.beginPath(); ctx.moveTo(bx + wd * 0.1, y); ctx.lineTo(bx + wd / 2, y - hgt); ctx.lineTo(bx + wd * 0.9, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(150,20,20,0.7)'; ctx.beginPath(); ctx.moveTo(bx + wd * 0.42, y - hgt * 0.7); ctx.lineTo(bx + wd / 2, y - hgt); ctx.lineTo(bx + wd * 0.58, y - hgt * 0.7); ctx.fill();
      }
    } else if (tr.kind === 'pendulum') {
      const px = X(v, tr.x), py = Y(v, tr.y), tx = X(v, st.tipX), ty = Y(v, st.tipY);
      ctx.strokeStyle = '#2a2830'; ctx.lineWidth = Math.max(3, v.s * 0.12); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#4c4a55'; ctx.lineWidth = Math.max(1, v.s * 0.04); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      // hoja de hacha en media luna
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(-st.a); const R = v.s * 0.95;
      ctx.fillStyle = lin(ctx, -R, 0, R, 0, [[0, '#6b6e7a'], [0.5, '#eef1f8'], [1, '#6b6e7a']]);
      ctx.beginPath(); ctx.moveTo(-R, -R * 0.15); ctx.quadraticCurveTo(0, R * 1.15, R, -R * 0.15); ctx.quadraticCurveTo(0, R * 0.35, -R, -R * 0.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, v.s * 0.06); ctx.stroke();
      ctx.fillStyle = 'rgba(140,10,16,0.75)'; ctx.beginPath(); ctx.ellipse(R * 0.35, R * 0.42, R * 0.18, R * 0.08, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#26242c'; ctx.beginPath(); ctx.arc(0, 0, v.s * 0.16, 0, TAU); ctx.fill();
      ctx.restore();
      // la viga de donde cuelga
      ctx.fillStyle = '#3a2a1e'; ctx.fillRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(px - v.s * 0.8, py - v.s * 0.1, v.s * 1.6, v.s * 0.35);
    } else {
      const x = X(v, tr.x), y = Y(v, tr.y), s = v.s;
      // brasero de hierro
      ctx.fillStyle = '#1e1c22'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x - s * 0.15, y); ctx.lineTo(x - s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.08, y - s * 0.55); ctx.lineTo(x + s * 0.15, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.32, y - s * 0.85); ctx.lineTo(x - s * 0.32, y - s * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.12, y - s * 0.85); ctx.lineTo(x + i * s * 0.14, y - s * 1.0); ctx.stroke(); }
      flame(ctx, x, y - s * 0.85, s * (st.warn ? 0.32 : 0.22), t, 7);
      if (st.warn) for (let i = 0; i < 4; i++) { const k = (t * 2 + i / 4) % 1; ctx.fillStyle = `rgba(255,180,60,${1 - k})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 9 + t * 5) * s * 0.3, y - s * (0.9 + k * 1.4), s * 0.05, 0, TAU); ctx.fill(); }
      if (st.on > 0) { // la llamarada
        const hgt = tr.len * st.on * s;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y - hgt * 0.5, hgt * 0.8, 'rgba(255,120,30,0.5)');
        for (const [k, col] of [[1, 'rgba(255,80,20,0.9)'], [0.7, 'rgba(255,170,40,0.9)'], [0.4, 'rgba(255,245,180,0.95)']] as const) {
          const wd = s * 0.55 * k;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - wd, y - s * 0.85);
          for (let j = 0; j <= 6; j++) { const yy = y - s * 0.85 - hgt * k * j / 6, ww = wd * (1 - j / 7) * (1 + 0.25 * Math.sin(t * 20 + j * 2)); ctx.lineTo(x - ww, yy); }
          for (let j = 6; j >= 0; j--) { const yy = y - s * 0.85 - hgt * k * j / 6, ww = wd * (1 - j / 7) * (1 + 0.25 * Math.sin(t * 17 + j * 3)); ctx.lineTo(x + ww, yy); }
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------- Cajas y estacas
function drawCrate(ctx: CanvasRenderingContext2D, c: Crate, v: View, t: number) {
  const s = v.s, x = X(v, c.x), y = Y(v, c.y), sz = s * 0.95, sway = c.landed ? 0 : Math.sin(c.t * 2.2) * 0.12;
  const blink = c.landed && c.t > 13 ? (Math.sin(c.t * 18) > 0 ? 0.35 : 1) : 1;
  ctx.save(); ctx.globalAlpha = blink; ctx.translate(x, y); ctx.rotate(sway);
  if (!c.landed) { // el paracaídas
    const cy = -sz - s * 1.6;
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 1; for (const k of [-1, -0.4, 0.4, 1]) { ctx.beginPath(); ctx.moveTo(k * sz * 0.48, -sz); ctx.lineTo(k * s * 0.95, cy); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#e9e2d0' : '#b3121b'; ctx.beginPath(); ctx.moveTo(0, cy - s * 0.75); ctx.arc(0, cy, s * 1.0, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, cy, s * 1.0, Math.PI, TAU); ctx.closePath(); ctx.stroke();
  }
  if (c.landed) glow(ctx, 0, -sz / 2, s * 1.3, c.kind === 'heart' ? 'rgba(255,70,90,0.35)' : c.kind === 'garlic' ? 'rgba(220,255,220,0.35)' : 'rgba(255,210,120,0.35)', 0.6 + 0.4 * Math.sin(t * 5));
  ctx.fillStyle = lin(ctx, -sz / 2, 0, sz / 2, 0, [[0, '#7a4a24'], [0.5, '#a8703c'], [1, '#6b3f1d']]); ctx.fillRect(-sz / 2, -sz, sz, sz);
  ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = Math.max(1, s * 0.04); for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-sz / 2, -sz + sz * i / 3); ctx.lineTo(sz / 2, -sz + sz * i / 3); ctx.stroke(); }
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.beginPath(); ctx.moveTo(-sz / 2, -sz); ctx.lineTo(sz / 2, 0); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeRect(-sz / 2, -sz, sz, sz);
  // el ícono de lo que trae
  ctx.save(); ctx.translate(0, -sz / 2); const k = s / 40;
  ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.32, 0, TAU); ctx.fill();
  if (c.kind === 'stakes') { ctx.scale(k * 0.8, k * 0.8); ctx.rotate(0.6); drawStakeItem(ctx, 26); ctx.rotate(-1.2); drawStakeItem(ctx, 26); }
  else if (c.kind === 'heart') { ctx.scale(k, k); ctx.fillStyle = '#ff3b4f'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.fill(); }
  else { ctx.scale(k, k); ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(12, 0, 6, 8); ctx.lineTo(-6, 8); ctx.quadraticCurveTo(-12, 0, 0, -12); ctx.fill(); ctx.strokeStyle = '#c8c0a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 8); ctx.moveTo(-4, -4); ctx.quadraticCurveTo(-5, 4, -3, 8); ctx.moveTo(4, -4); ctx.quadraticCurveTo(5, 4, 3, 8); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
function drawStake(ctx: CanvasRenderingContext2D, s: Stake, v: View) {
  const k = v.s / 40, a = Math.atan2(-s.vy, s.vx) + Math.PI / 2;
  ctx.save(); ctx.globalAlpha = s.stuck ? Math.max(0, 1 - s.t / 1.5) : 1; ctx.translate(X(v, s.x), Y(v, s.y)); ctx.rotate(s.stuck ? Math.PI / 2 * Math.sign(s.vx) + 0.4 * Math.sign(s.vx) : a); ctx.scale(k, k);
  if (!s.stuck) { ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 30); ctx.stroke(); }
  drawStakeItem(ctx, 26);
  ctx.restore();
}

// ---------------------------------------------------------------- Todo junto
export function drawGame(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, t: number) {
  const v = viewFor(w, h);
  const key = `${w}x${h}`;
  if (!staticCache || staticCache.key !== key) {
    const c = staticCache?.canvas ?? document.createElement('canvas');
    c.width = w; c.height = h; const sc = c.getContext('2d');
    if (sc) paintStatic(sc, v);
    staticCache = { key, canvas: c };
  }
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * v.s * 0.4, (Math.random() - 0.5) * g.shake * v.s * 0.4);
  ctx.drawImage(staticCache.canvas, 0, 0);
  // luna de sangre: todo se tiñe de rojo
  if (g.bloodMoon) { ctx.fillStyle = `rgba(150,0,20,${0.16 + 0.04 * Math.sin(t)})`; ctx.fillRect(0, 0, w, h); }
  // relámpago cada tanto
  const bolt = (t * 0.13 + 0.37) % 1; if (bolt < 0.012) { ctx.fillStyle = `rgba(200,210,255,${0.25 * (1 - bolt / 0.012)})`; ctx.fillRect(0, 0, w, h); }
  // murciélagos que pasan lejos
  ctx.fillStyle = 'rgba(8,6,14,0.8)';
  for (let i = 0; i < 6; i++) { const bx = ((t * (0.6 + hash(i) * 0.5) * v.s + hash(i + 3) * w * 2) % (w + 200)) - 100, by = h * (0.12 + hash(i + 9) * 0.3) + Math.sin(t * 3 + i) * v.s * 0.4, fl = Math.sin(t * 14 + i * 2) * v.s * 0.12, sz = v.s * (0.18 + hash(i + 1) * 0.12); ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - sz, by - sz - fl, bx - sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx - sz, by, bx, by + sz * 0.3); ctx.quadraticCurveTo(bx + sz, by, bx + sz * 2, by + fl * 0.5); ctx.quadraticCurveTo(bx + sz, by - sz - fl, bx, by); ctx.fill(); }
  // niebla que sube de los huecos
  for (const [a, b] of GAPS) for (let i = 0; i < 4; i++) {
    const k = (t * 0.25 + i / 4) % 1, x = X(v, a + (b - a) * (0.2 + hash(i + a) * 0.6)) + Math.sin(t + i) * v.s * 0.3, y = Y(v, GROUND_Y - 2 + k * 3);
    glow(ctx, x, y, v.s * (1 + k), `rgba(170,180,220,${0.22 * Math.sin(k * Math.PI)})`);
  }
  drawTorches(ctx, v, t);
  drawDoor(ctx, g, v, t);
  drawTraps(ctx, g, v, t);
  for (const c of g.crates) drawCrate(ctx, c, v, t);
  drawBlood(ctx, g, v);
  for (const b of g.bones) drawBone(ctx, b, v);
  for (const c of g.corpses) drawCorpse(ctx, c, v, t);
  // vampiros
  for (const vp of g.vamps) {
    const k = (vp.kind === 'walker' ? 1.8 : 1.7) * BIG * v.s / 100;
    ctx.save(); ctx.translate(X(v, vp.x), Y(v, vp.y)); ctx.scale(k * vp.face, k);
    if (vp.kind === 'walker') drawWalker(ctx, vp, t); else drawFlyer(ctx, vp, t);
    ctx.restore();
  }
  // el ajo: un halo verde blanco que los espanta
  const p = g.player;
  if (g.garlicT > 0) glow(ctx, X(v, p.x), Y(v, p.y + 1), v.s * 4.5, `rgba(210,255,200,${0.25 * Math.min(1, g.garlicT)})`);
  // el cazador (parpadea mientras es invulnerable)
  if (g.phase !== 'dead' || g.phaseT < 0.2) {
    const blink = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
    ctx.save(); ctx.globalAlpha = blink ? 0.35 : 1; ctx.translate(X(v, p.x), Y(v, p.y)); const k = PLAYER_H * BIG * v.s / 100; ctx.scale(k * p.face, k);
    if (g.phase === 'cleared') ctx.globalAlpha = Math.max(0, 1 - g.phaseT / 1.6);
    drawHunter(ctx, p, g, t); ctx.restore();
  }
  for (const s of g.stakes) drawStake(ctx, s, v);
  drawSparks(ctx, g, v);
  // la luz sagrada de la cruz
  if (g.holyT > 0) {
    const k = g.holyT / 1.4, x = X(v, p.x), y = Y(v, p.y + 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, v.s * (4 + (1 - k) * 22), `rgba(255,236,170,${0.8 * k})`);
    ctx.strokeStyle = `rgba(255,245,210,${0.7 * k})`; ctx.lineWidth = v.s * 0.5 * k;
    ctx.beginPath(); ctx.moveTo(x, y - v.s * 30); ctx.lineTo(x, y + v.s * 30); ctx.moveTo(x - v.s * 18, y - v.s * 2); ctx.lineTo(x + v.s * 18, y - v.s * 2); ctx.stroke();
    ctx.restore();
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${g.flash * 0.6})`; ctx.fillRect(0, 0, w, h); }
  // viñeta
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (g.phase === 'dead') { ctx.fillStyle = `rgba(120,0,10,${Math.min(0.5, g.phaseT * 0.4)})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
// Para la tarjeta y las pruebas visuales: el cazador o un vampiro sueltos en un lienzo.
export function drawPortrait(ctx: CanvasRenderingContext2D, who: 'hunter' | 'walker' | 'flyer', g: Game, x: number, y: number, size: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  if (who === 'hunter') drawHunter(ctx, g.player, g, t);
  else { const fake = { id: 1, kind: who, x: 0, y: 0, vx: 0, vy: 0, face: 1 as const, state: (who === 'flyer' ? 'hover' : 'walk') as Vamp['state'], t: 0, onGround: true, surface: null, walkT: t, cool: 0, speed: 0, jumpT: 0, dropT: 0, hit: false }; if (who === 'walker') drawWalker(ctx, fake, t); else drawFlyer(ctx, fake, t); }
  ctx.restore();
}
