import { wear } from './vampyium2Materials';
import { drawRealisticHunter, atlasReady, drawAsset } from './vampyium2Sprites';
import { realisticHeldWeapon, fireLight } from './vampyium2Environment';
import { VAMP_VISUAL_SCALE } from './vampyium2Motion';
import { demianSwordPose } from './vampyium2Demian';
// Los personajes de Vampyium2 dibujados como los luchadores de Kombat Football: el mismo esqueleto (cadera,
// pecho inclinado, muslo y canilla, brazo y antebrazo), las mismas poses animadas (guardia que respira, carrera,
// salto, golpe, aturdido) y el mismo sombreado con volumen; con brazos y piernas más gruesos. En metros, con los
// pies en (0, 0), mirando a la derecha y "arriba" negativo (como el lienzo).
//  · El cazador (como la referencia): armadura negra, hombreras redondas con borde de plata, correas cruzadas
//    con broche, cinturón ancho con hebilla grande, faldones de cuero, capa roja, barba y pelo castaño despeinado.
//  · El vampiro: piel lila pálida, pelo negro peinado para atrás con pico en la frente, ojos rojos que brillan,
//    colmillos, cuello alto rojo, corbatín de volados con gema, garras con uñas rojas y capa roja festoneada.
//  · El vampiro volador: igual, con el pelo en punta, la boca abierta y dos alas de murciélago enormes.
import { alpha, bloom, darken, lighten, segment, shade, spec } from './vampyium2Materials';
import type { Game, Player, Vamp, Weapon } from './vampyium2';
import { humanWalk, legAngles, walkingArm } from './vampyium2Gait';
import { drawBloodSword, drawBoneHammer, drawCrossbow, drawFirePistol, drawFireSword, drawGarlicBomb, drawHolyCross, drawIceCrystal, drawVenomBall } from './vampyium2Weapons';

export const TAU = Math.PI * 2;
export type Pt = [number, number];
export const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];
export const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];
export const grad = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [k, c] of stops) g.addColorStop(k, c); return g; };
// Los trajes del cazador: con la cruz (o la armadura dorada) lleva la armadura dorada y el casco; con cada armadura
// nueva se viste como su referencia (hielo, verde, violeta, protectora con capucha, de huesos con calavera).
// metal: los colores de las placas (pechera, cuello, hombreras, codos, rodillas) · hi: los bordes y remaches.
interface Suit { look: Partial<Look>; metal: string[]; hi: string; skirt?: string; skirtTrim?: string; head?: 'gold' | 'hood' | 'skull' | 'crown'; gem?: string; aura?: 'flame' | 'spark' | 'frost'; shoulder?: 'ice' | 'skull' | 'swirl' | 'spike' }
const METAL_KEYS = ['#33333d', '#34343e', '#30303a', '#3c3c46', '#3a3a44', '#1b1b20'];
const GOLD_SUIT: Suit = { look: { armor: '#d9a22a', trim: '#fff1a8', boot: '#c9921e', sleeve: '#c08a1c' }, metal: ['#e3ad35', '#d9a22a', '#e0aa30', '#c9921e', '#e0aa30', '#8a5e12'], hi: '#fff1a8', head: 'gold', shoulder: 'swirl', gem: '#e3142a' };
const SUITS: Partial<Record<Weapon | 'guardOn', Suit>> = {
  cross: GOLD_SUIT, holy: GOLD_SUIT,
  ice: { look: { armor: '#2c5aa8', dark: '#141a28', trim: '#e3ecf8', strap: '#3a4456', boot: '#2a3a5a', cape: '#2f6ad0', capeD: '#0c2152', sleeve: '#18233a' }, metal: ['#3f80d8', '#c9d3e2', '#4a8ae0', '#bfcadb', '#4a8ae0', '#1e3a70'], hi: '#eef8ff', skirt: '#1c3566', skirtTrim: '#c9d3e2', aura: 'frost', shoulder: 'ice', gem: '#9ee4ff' },
  venom: { look: { armor: '#1d1f22', dark: '#101113', trim: '#c3c7cf', strap: '#2a2d2a', boot: '#1b1c20', cape: '#8ef03a', capeD: '#1e5a0a', sleeve: '#16171a' }, metal: ['#2c2f33', '#b9bdc6', '#2c2f33', '#b9bdc6', '#2e3135', '#141518'], hi: '#c6ff6a', skirt: '#1a1c1e', skirtTrim: '#8ef03a', head: 'crown', aura: 'flame', shoulder: 'spike', gem: '#7dff2a' },
  violet: { look: { armor: '#2a2133', dark: '#130f19', trim: '#e9cdf8', strap: '#2b2233', boot: '#231b2b', cape: '#9b30d8', capeD: '#3a0a5c', sleeve: '#1a1521' }, metal: ['#6f3aa6', '#d9c2ea', '#3c2b4e', '#d9c2ea', '#3c2b4e', '#1e1428'], hi: '#f3dcff', skirt: '#2a1f36', skirtTrim: '#c07cf0', aura: 'spark', gem: '#c45cff' },
  guardOn: { look: { armor: '#ece8e1', dark: '#2a2626', trim: '#e2a72e', strap: '#7a4526', boot: '#dedad3', cape: '#f1eee8', capeD: '#b3121b', sleeve: '#d9d4cc' }, metal: ['#f4f1ec', '#e2a72e', '#efece6', '#e2a72e', '#f0ede7', '#9a958c'], hi: '#ffd76a', skirt: '#efebe4', skirtTrim: '#c4121e', head: 'hood', shoulder: 'swirl', gem: '#e3142a' },
  bone: { look: { armor: '#2a1f1a', dark: '#16100e', trim: '#e9dcc0', strap: '#5a2a1a', boot: '#2a2220', cape: '#a8201a', capeD: '#3a0806', sleeve: '#1e1714' }, metal: ['#e6d7b8', '#d9c8a4', '#e6d7b8', '#d9c8a4', '#e6d7b8', '#8a7a5c'], hi: '#fff4dc', skirt: '#2a1a14', skirtTrim: '#e6d7b8', head: 'skull', shoulder: 'skull' },
};
let SUIT: Suit | null = null;
const metal = (c: string) => { const i = SUIT ? METAL_KEYS.indexOf(c) : -1; return i >= 0 ? SUIT!.metal[i] : c; };
let LIMB = 0.88; // brazos y piernas más gruesos que en Kombat Football
export const setLimb = (k: number) => { LIMB = k; };

export interface Pose { bob: number; lean: number; crouch: number; head: number; legs: [number, number][]; arms: [number, number][]; blade: number; feet?: [Pt, Pt]; hipOffset?: Pt; weaponBehind?: boolean; relaxedHand?: boolean }
export interface Look { armor: string; dark: string; trim: string; strap: string; boot: string; cape: string; capeD: string; skin: string; sleeve: string }
export const HUNTER: Look = { armor: '#2a2a32', dark: '#16161b', trim: '#b9bdc9', strap: '#7a4526', boot: '#17171c', cape: '#572127', capeD: '#1e0d13', skin: '#ba9c86', sleeve: '#1d1d23' };
export const VAMP: Look = { armor: '#1c1820', dark: '#0f0c12', trim: '#d01624', strap: '#5e3520', boot: '#121015', cape: '#c8121e', capeD: '#4a050b', skin: '#a7aaa0', sleeve: '#16131a' };

// ---------------------------------------------------------------- Poses
const ARMOR_W: Weapon[] = ['ice', 'holy', 'venom', 'violet', 'bone'];
const AIM_W: Weapon[] = ['crossbow', 'pistol', 'ice', 'venom'], CROSS_W: Weapon[] = ['cross', 'holy'], SLASH_W: Weapon[] = ['sword', 'firesword', 'violet', 'bone'];
function hunterPose(p: Player, t: number, held: Weapon): Pose {
  const s = Math.sin, at = p.attackT, run = p.onGround && Math.abs(p.vx) > 0.15;
  const shoulderSword = held === 'sword' && at < 0;
  if ((p.jumpPrep ?? 0) > 0) {
    const k = Math.sin((1 - (p.jumpPrep ?? 0) / .09) * Math.PI / 2);
    if (shoulderSword) return { ...demianSwordPose({ ...p, vx: 0 }, t), feet: undefined, bob: 0,
      lean: .06 + k * .10, crouch: .10 + k * .44,
      arms: [[-.12 - k * .35, .22 + k * .2], [.70, 2.50]] };
    return { bob: 0, lean: .12 + k * .1, crouch: .12 + k * .58, head: -.06, legs: [[-.4, .9], [.45, 1]], arms: [[-.3 - k * .4, .65], [.4, 1.5]], blade: 1.05 };
  }
  if (!p.onGround && (p.takeoffT ?? 0) > 0 && at < 0) {
    const k = 1 - (p.takeoffT ?? 0) / .12;
    if (shoulderSword) return { ...demianSwordPose(p, t), feet: undefined, bob: 0,
      hipOffset: [0, 0], lean: .12 - k * .04,
      legs: [[-.12 - k * .16, .12 + k * .65], [.14 + k * .28, .12 + k * .9]],
      arms: [[-.32 + k * .58, .40], [.70, 2.50]] };
    return { bob: 0, lean: .13 - k * .08, crouch: 0, head: -.03, legs: [[-.12 - k * .18, .10 + k * 1.1], [.15 + k * .75, .12 + k * 1.48]], arms: [[.1 + .5 * k, .7], [.5 + .45 * k, 1.2]], blade: 1.1 };
  }
  if (p.hurtT > 0) { const w = t * 30; return { bob: 0, lean: -0.35 + s(w) * 0.06, crouch: 0.1, head: -0.3, legs: [[-0.45, 0.5], [0.25, 0.7]], arms: [[-0.6, 0.9], [-0.9, 0.8]], blade: 0.6 }; }
  // C (turn) and V (thrust): the sword stays out horizontally, in a wide, low stance, with real bone lengths.
  if (p.special && (p.special.kind === 'whirl' || p.special.kind === 'dash') && held === 'sword') {
    const thrust = demianSwordPose({ ...p, vx: 0, onGround: true, attackT: .12 }, t);
    return p.special.kind === 'dash'
      ? { ...thrust, lean: .34, hipOffset: [.16, .16], feet: [[-.62, -.06], [.5, -.06]] }
      : { ...thrust, lean: .05, hipOffset: [0, .1], feet: [[-.4, -.06], [.36, -.06]] };
  }
  if (p.onGround && !p.special && (at >= 0 ? p.attackWeapon === 'sword' : held === 'sword')) return demianSwordPose(p, t);
  if (at >= 0) {
    if (AIM_W.includes(p.attackWeapon)) { // el disparo: retroceso
      const k = Math.max(0, 1 - at / 0.2);
      const ak = p.aim * 0.7; return { bob: 0, lean: -0.05 - k * 0.15, crouch: 0.1, head: 0.02 - ak * 0.15, legs: p.onGround ? [[-0.55, 0.45], [0.55, 0.6]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[1.35 + ak + k * 0.2, 0.35], [1.5 + ak + k * 0.35, 0.1 + k * 0.2]], blade: -0.08 - k * 0.3 };
    }
    if (CROSS_W.includes(p.attackWeapon)) { const k = Math.min(1, at / 0.12); return { bob: 0, lean: -0.1, crouch: 0.05, head: -0.25 * k, legs: p.onGround ? [[-0.5, 0.5], [0.5, 0.6]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[1.2, 0.8], [2.4 + k * 0.6, 0.4 - k * 0.3]], blade: 0.0 }; }
    if (SLASH_W.includes(p.attackWeapon)) { // tajo: la espada baja desde atrás de la cabeza hacia adelante, con estocada
      const k = Math.min(1, at / 0.14), e = 1 - (1 - k) * (1 - k);
      return { bob: 0, lean: -0.15 + e * 0.45, crouch: 0.1, head: 0.1 * e, legs: p.onGround ? [[-0.65, 0.35], [0.7, 0.75]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[-0.5 - e * 0.4, 0.7], [3.0 - e * 2.15, 0.25 - e * 0.15]], blade: 0.15 };
    }
    const k = Math.min(1, at / 0.12); // tira la bomba
    return { bob: 0, lean: -0.2 + k * 0.4, crouch: 0.06, head: 0, legs: p.onGround ? [[-0.55, 0.4], [0.55, 0.6]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[-0.6, 0.6], [2.8 - k * 1.3, 1.0 - k * 0.9]], blade: 0.3 };
  }
  // con la ballesta o la pistola apunta adelante; la bomba la lleva con las dos manos; la cruz, en alto
  const aim = AIM_W.includes(held), cross = CROSS_W.includes(held), br0 = s(t * 3.2);
  const ak = p.aim * 0.7; // apunta arriba o abajo
  const armsFor = (base: [number, number][]): [number, number][] => aim ? [[1.35 + ak, 0.35], [1.5 + ak + br0 * 0.02, 0.1]] : held === 'garlic' ? [[1.0, 1.15], [1.15, 1.0]] : cross ? [[0.2, 1.2], [2.25 + br0 * 0.03, 0.55]] : base;
  const bladeFor = (b: number) => aim ? -0.08 : cross ? 0.05 : held === 'garlic' ? 0 : b;
  if (!p.onGround) {
    if (shoulderSword) {
      const tuck = Math.max(0, Math.min(1, (p.vy + 5) / 12));
      return { ...demianSwordPose(p, t), feet: undefined, hipOffset: [0, 0], bob: 0,
        lean: .06, legs: [[-.20, .22 + tuck * .55], [.22 + tuck * .20, .28 + tuck * .72]],
        arms: [[.24 - tuck * .16, .35], [.70, 2.50]] };
    }
    if (!aim && held !== 'garlic' && !cross) { // al saltar los brazos suben de abajo hacia arriba (y quedan arriba al caer)
      const k = p.vy > 0 ? Math.min(1, Math.max(0, 1 - p.vy / 16)) * 0.8 + 0.2 : 1, e = k * k * (3 - 2 * k);
      return { bob: 0, lean: 0.05, crouch: 0, head: -0.05, legs: p.vy > 2 ? [[-0.3, 1.2], [0.9, 1.6]] : [[-0.45, 0.6], [0.5, 0.9]], arms: [[0.2 + e * 2.5, 0.5 - e * 0.25], [0.4 + e * 2.15, 0.6 - e * 0.3]], blade: 0.3 };
    }
    return { bob: 0, lean: 0.1, crouch: 0, head: 0.05, legs: [[-0.45, 0.6], [0.5, 0.9]], arms: armsFor([[-1.2, 0.4], [1.6, 0.7]]), blade: bladeFor(0.9) };
  }
  if (run) { // corre con el ciclo de 8 fases (con un instante en el aire entre paso y paso): el pie apoyado va para atrás
    // con el piso (no patina), el otro pasa adelante subiendo la rodilla; los brazos al revés que las piernas
    const g = humanWalk(p.walkT * 7 / 2.4, Math.abs(p.vx), .88 * VAMP_VISUAL_SCALE, true), k = g.k;
    const hipY = -0.7 + g.bob, legs = [0, 1].map(i => {
      const hp: Pt = [i === 0 ? -0.11 : 0.11, hipY], foot: Pt = [hp[0] + 0.04 + g.dx[i], (i === 0 ? -0.03 : 0) - g.lift[i]];
      const [ta, kb] = legAngles(hp, foot, 0.36, 0.35), idle = i === 0 ? [-0.45, 0.55] : [0.42, 0.6];
      return [idle[0] + (ta - idle[0]) * k, idle[1] + (kb - idle[1]) * k] as [number, number];
    });
    const br = s(t * 3.2) * (1 - k);
    return { bob: g.bob + br * 0.025, lean: 0.06 + k * (0.12 + g.sway * 0.02), crouch: 0.08 * (1 - k), head: 0.05,
      legs, arms: armsFor([walkingArm(g, 0, .34, .32), walkingArm(g, 1, .34, .32)]), blade: bladeFor(1.45 - 0.45 * k) };
  }
  const br = s(t * 3.2); // guardia: el puño con la espada adelante, la hoja para arriba (como la cruz de la referencia)
  return { bob: br * .009, lean: .10, crouch: .24 + br * .012, head: .01, legs: [[-.45, .75], [.45, .8]], arms: armsFor([[-.95 + br * .018, 1.65], [.90 - br * .018, .65]]), blade: bladeFor(1.55) };
}
export function walkerPose(v: Vamp, t: number): Pose {
  const s = Math.sin;
  if (v.state === 'claw') { // levanta las garras y araña hacia abajo
    const up = v.t < 0.36 ? Math.min(1, v.t / 0.25) : Math.max(0, 1 - (v.t - 0.36) * 7);
    return { bob: 0, lean: 0.25 - up * 0.2, crouch: 0.15, head: 0.1, legs: [[-0.55, 0.6], [0.55, 0.7]], arms: [[1.2 + up * 1.6, 0.3], [1.3 + up * 1.6, 0.25]], blade: 0 };
  }
  if (!v.onGround) return { bob: 0, lean: 0.2, crouch: 0, head: 0, legs: [[-0.4, 1.2], [0.8, 1.4]], arms: [[1.6, 0.3], [2.0, 0.2]], blade: 0 };
  const w = v.walkT * 3.2, m = Math.abs(v.vx) > 0.3 ? 1 : 0, br = s(t * 2.6 + v.id);
  return { bob: m ? Math.abs(s(w)) * 0.05 : br * 0.02, lean: 0.3, crouch: 0.16, head: 0.12,
    legs: m ? [[-0.6 * s(w) - 0.15, 0.5 + 0.9 * Math.max(0, -Math.cos(w))], [0.6 * s(w) + 0.15, 0.5 + 0.9 * Math.max(0, Math.cos(w))]] : [[-0.5, 0.65], [0.5, 0.7]],
    arms: [[1.15 + s(w) * 0.2 * m + br * 0.05, 0.35], [1.3 - s(w) * 0.2 * m - br * 0.05, 0.3]], blade: 0 };
}

// ---------------------------------------------------------------- Partes del cuerpo
function boot(ctx: CanvasRenderingContext2D, foot: Pt, ang: number, L: Look, back: boolean) {
  const c = back ? darken(L.boot, 0.3) : L.boot, silver = L !== HUNTER ? '#a3a8b4' : L.trim, metal = back ? darken(silver, 0.35) : silver;
  ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(-ang * 0.6); ctx.scale(L === HUNTER ? .82 : 1, 1.1);
  shade(ctx, () => { ctx.moveTo(-0.13, -0.17); ctx.lineTo(0.14, -0.14); ctx.quadraticCurveTo(0.31, -0.07, 0.29, 0.04); ctx.lineTo(-0.15, 0.04); ctx.closePath(); }, c, { x: 0.02, y: -0.1, r: 0.28, hi: 0.5, lw: 0.6 });
  ctx.fillStyle = '#302d29'; ctx.fillRect(-0.15, 0.01, 0.44, 0.025);
  ctx.fillStyle = '#060608'; ctx.fillRect(-0.16, 0.045, 0.46, 0.03);
  shade(ctx, () => ctx.roundRect(-0.13, -0.15, 0.27, 0.025, 0.005), L.strap, { x: -0.05, y: -0.15, r: 0.15, hi: 0.2, lw: 0.4 });
  shade(ctx, () => { ctx.moveTo(0.16, -0.1); ctx.quadraticCurveTo(0.3, -0.06, 0.29, 0.01); ctx.lineTo(0.17, 0.01); ctx.closePath(); }, darken(metal, .6), { x: 0.22, y: -0.08, r: 0.1, hi: 0.2, lw: 0.4 });
  if (!back) spec(ctx, 0.05, -0.08, 0.07, 0.03, -0.3, 0.5);
  ctx.restore();
}
export function legDraw(ctx: CanvasRenderingContext2D, hip: Pt, pose: Pose, i: number, L: Look) {
  const back = i === 0, [ta, kb] = pose.legs[i], hp: Pt = [hip[0] + (back ? -0.11 : 0.11), hip[1]];
  const knee = add(hp, dirv(ta), 0.36), foot = add(knee, dirv(ta - kb), 0.35);
  const col = (c: string) => back ? darken(c, 0.35) : c;
  segment(ctx, hp, knee, 0.27 * LIMB, 0.22 * LIMB, col(L.dark), 0.5);
  segment(ctx, knee, foot, 0.22 * LIMB, 0.19 * LIMB, col(L.dark), 0.4);
  // canillera de metal y rodillera redonda
  const sd = dirv(ta - kb);
  segment(ctx, add(knee, sd, 0.08), add(knee, sd, 0.26), 0.2 * LIMB, 0.18 * LIMB, col(L !== HUNTER ? '#2a2630' : L.armor), 0.8);
  segment(ctx, add(knee, sd, 0.2), add(knee, sd, 0.23), 0.22 * LIMB, 0.21 * LIMB, col(L !== HUNTER ? '#8f95a3' : L.trim), 0.6);
  shade(ctx, () => ctx.arc(knee[0], knee[1], 0.12 * LIMB, 0, TAU), col(L !== HUNTER ? '#3a3542' : metal('#3a3a44')), { x: knee[0] - 0.04, y: knee[1] - 0.04, r: 0.12, hi: 0.55, lw: 0.6 });
  if (L !== HUNTER) { ctx.strokeStyle = col('#9aa0ad'); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(knee[0], knee[1], 0.1 * LIMB, 0.4, Math.PI - 0.4); ctx.stroke(); }
  else { // rodillera con borde de plata, remache y reflejo
    ctx.strokeStyle = col(SUIT?.hi ?? '#b9bdc9'); ctx.lineWidth = 0.018; ctx.beginPath(); ctx.arc(knee[0], knee[1], 0.11 * LIMB, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.fillStyle = col('#817c71'); ctx.beginPath(); ctx.arc(knee[0] + 0.03, knee[1] - 0.02, 0.007, 0, TAU); ctx.fill();
    if (!back) spec(ctx, knee[0] - 0.04, knee[1] - 0.05, 0.05, 0.025, -0.5, 0.6);
  }
  boot(ctx, foot, ta - kb, L, back);
}
export const shoulderAt = (hip: Pt, pose: Pose, i: number): Pt => { const lx = i === 0 ? -0.27 : 0.23, ly = -0.42 + (i === 0 ? 0.02 : -0.04); return [hip[0] + lx * Math.cos(pose.lean) - ly * Math.sin(pose.lean), hip[1] + lx * Math.sin(pose.lean) + ly * Math.cos(pose.lean)]; };
export const handOf = (hip: Pt, pose: Pose, i: number): Pt => { const [ua, eb] = pose.arms[i]; return add(add(shoulderAt(hip, pose, i), dirv(ua), 0.31), dirv(ua + eb), 0.29); };

// El puño enguantado del cazador (con nudillos y la muñequera de metal).
export function fist(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, back: boolean, color = '#26262d', cuff = HUNTER.trim) {
  const gc = back ? darken(color, 0.4) : color;
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(0.92, 0.92);
  shade(ctx, () => ctx.roundRect(-0.09, -0.14, 0.18, 0.07, 0.02), back ? darken(cuff, 0.4) : cuff, { x: -0.03, y: -0.13, r: 0.1, hi: 0.6, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.12, -0.08, 0.24, 0.2, 0.07), gc, { x: -0.04, y: -0.04, r: 0.2, hi: 0.5, lw: 0.6 });
  for (let k = 0; k < 4; k++) { const kx = -0.085 + k * 0.056; shade(ctx, () => ctx.ellipse(kx, 0.095, 0.032, 0.036, 0, 0, TAU), lighten(gc, 0.1), { x: kx - 0.01, y: 0.085, r: 0.035, hi: 0.6, lw: 0.4 }); }
  shade(ctx, () => ctx.ellipse(0.085, 0.02, 0.046, 0.075, -0.35, 0, TAU), darken(gc, 0.1), { x: 0.07, y: 0, r: 0.06, lw: 0.5 });
  ctx.fillStyle = back ? '#7a7d88' : '#d9dce4'; ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.014, 0, TAU); ctx.fill();
  ctx.restore();
}
// La garra del vampiro: mano pálida con dedos largos y uñas rojas afiladas.
export function claw(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, back: boolean, skin = VAMP.skin, nail = '#e01b2c') {
  const sk = back ? darken(skin, 0.3) : skin;
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(1.2, 1.2);
  shade(ctx, () => ctx.roundRect(-0.085, -0.15, 0.17, 0.06, 0.02), back ? '#5f636d' : '#a9aeba', { x: -0.03, y: -0.14, r: 0.1, hi: 0.6, lw: 0.6 }); // puño de metal de la manga
  shade(ctx, () => ctx.ellipse(0, 0, 0.1, 0.09, 0, 0, TAU), sk, { x: -0.03, y: -0.03, r: 0.12, hi: 0.4, lw: 0.6 });
  for (let k = 0; k < 4; k++) {
    const fa = -0.55 + k * 0.37, bx = Math.sin(fa) * 0.07, by = Math.cos(fa) * 0.07, tx = bx + Math.sin(fa) * 0.11, ty = by + Math.cos(fa) * 0.11 + 0.03;
    segment(ctx, [bx, by], [tx, ty], 0.045, 0.035, sk, 0.3);
    ctx.fillStyle = back ? darken(nail, 0.45) : nail; ctx.beginPath(); ctx.moveTo(tx - 0.018, ty); ctx.quadraticCurveTo(tx + Math.sin(fa) * 0.05, ty + 0.06, tx + Math.sin(fa) * 0.02 + 0.01, ty + 0.1); ctx.lineTo(tx + 0.018, ty); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.008; ctx.stroke();
  }
  shade(ctx, () => ctx.ellipse(0.09, -0.01, 0.04, 0.065, -0.5, 0, TAU), sk, { x: 0.08, y: -0.02, r: 0.05, lw: 0.5 }); // pulgar
  ctx.restore();
}
export function sword(ctx: CanvasRenderingContext2D, hand: Pt, ang: number) {
  if (realisticHeldWeapon(ctx, 'sword', hand, ang)) return;
  const d = dirv(ang), b0 = add(hand, d, 0.13), b1 = add(hand, d, 1.5), n: Pt = [d[1], -d[0]];
  segment(ctx, add(hand, d, -0.17), add(hand, d, 0.06), 0.085, 0.085, '#3a2414', 0.4); // empuñadura
  { const pm = add(hand, d, -0.2); shade(ctx, () => ctx.arc(pm[0], pm[1], 0.065, 0, TAU), '#d6a032', { x: pm[0], y: pm[1], r: 0.06, lw: 0.5 }); } // pomo
  const g0 = add(b0, n, 0.24), g1 = add(b0, n, -0.24);
  segment(ctx, g0, g1, 0.085, 0.085, '#c99a2e', 0.7); // guarda dorada
  ctx.beginPath(); const w = 0.08;
  ctx.moveTo(b0[0] + n[0] * w, b0[1] + n[1] * w); ctx.lineTo(b1[0] - d[0] * 0.18 + n[0] * w, b1[1] - d[1] * 0.18 + n[1] * w); ctx.lineTo(b1[0], b1[1]);
  ctx.lineTo(b1[0] - d[0] * 0.18 - n[0] * w, b1[1] - d[1] * 0.18 - n[1] * w); ctx.lineTo(b0[0] - n[0] * w, b0[1] - n[1] * w); ctx.closePath();
  ctx.fillStyle = grad(ctx, b0[0] + n[0] * w, b0[1] + n[1] * w, b0[0] - n[0] * w, b0[1] - n[1] * w, [[0, '#f5f8ff'], [0.45, '#c9d1e0'], [0.55, '#8e97a8'], [1, '#5d6474']]); ctx.fill();
  ctx.strokeStyle = '#1b1d24'; ctx.lineWidth = 0.022; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(...add(b0, d, 0.05)); ctx.lineTo(...add(b1, d, -0.2)); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,44,56,0.55)'; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(...add(b0, d, 0.08)); ctx.lineTo(...add(b0, d, 0.55)); ctx.stroke(); // canal de la hoja
}
export type Hold = (hand: Pt, ang: number) => void;
export function armDraw(ctx: CanvasRenderingContext2D, hip: Pt, pose: Pose, i: number, L: Look, item: Weapon | 'none' | 'claw' | 'glove' | 'fist', hold?: Hold) {
  const back = i === 0, [ua, eb] = pose.arms[i], sp = shoulderAt(hip, pose, i);
  const elbow = add(sp, dirv(ua), 0.31), hand = add(elbow, dirv(ua + eb), 0.29);
  const col = (c: string) => back ? darken(c, L === HUNTER ? 0.12 : 0.35) : c;
  segment(ctx, sp, elbow, 0.22 * LIMB, 0.18 * LIMB, col(L.sleeve), 0.5);
  if (L === HUNTER) { const m = add(sp, dirv(ua), 0.16), n: Pt = [Math.cos(ua), -Math.sin(ua)]; segment(ctx, add(m, n, 0.13), add(m, n, -0.13), 0.05, 0.05, col(L.strap), 0.4); } // correa
  segment(ctx, elbow, hand, 0.19 * LIMB, 0.17 * LIMB, col(L.sleeve), 0.4);
  // guantelete / manga con bandas de metal
  const fd = dirv(ua + eb);
  if (L === HUNTER) {
    segment(ctx, add(elbow, fd, 0.06), add(elbow, fd, 0.22), 0.22 * LIMB, 0.24 * LIMB, col(metal('#34343e')), 0.8);
    for (const k of [0.1, 0.18]) segment(ctx, add(elbow, fd, k), add(elbow, fd, k + 0.025), 0.235 * LIMB, 0.24 * LIMB, col(L.trim), 0.6);
  } else {
    segment(ctx, add(elbow, fd, 0.16), add(elbow, fd, 0.2), 0.22 * LIMB, 0.22 * LIMB, col('#9aa0ad'), 0.6);
    segment(ctx, add(elbow, fd, 0.21), add(elbow, fd, 0.23), 0.21 * LIMB, 0.21 * LIMB, col(L.trim), 0.5);
  }
  shade(ctx, () => ctx.arc(elbow[0], elbow[1], 0.09 * LIMB, 0, TAU), col(L === HUNTER ? metal('#3c3c46') : '#24202a'), { x: elbow[0] - 0.02, y: elbow[1] - 0.03, r: 0.09, lw: 0.6 });
  ctx.strokeStyle = col(L === HUNTER ? (SUIT?.hi ?? '#b9bdc9') : '#6a6e7a'); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(elbow[0], elbow[1], 0.075 * LIMB, ua - 0.9 + Math.PI / 2, ua + 0.9 + Math.PI / 2); ctx.stroke(); // borde del codo
  if (!back) spec(ctx, elbow[0] - 0.03, elbow[1] - 0.04, 0.035, 0.018, -0.5, 0.5);
  if (item !== 'claw' && item !== 'glove' && item !== 'fist' && hold) hold(hand, ua + eb + pose.blade);
  if (item === 'claw') claw(ctx, hand, ua + eb, back, L.skin, L === VAMP ? '#e01b2c' : L.trim);
  else if (item === 'glove' || item === 'fist') { hold?.(hand, ua + eb); fist(ctx, hand, ua + eb, back, item === 'fist' ? L.skin : '#24202a', item === 'fist' ? '#4a4652' : '#9aa0ad'); }
  else {
    if (item === 'sword') sword(ctx, hand, ua + eb + pose.blade);
    fist(ctx, hand, ua + eb, back);
  }
}
export function pauldron(ctx: CanvasRenderingContext2D, sp: Pt, ua: number, back: boolean, big = 1) {
  ctx.save();ctx.translate(sp[0],sp[1]);ctx.rotate(ua*.15);ctx.scale(big,big);
  const plate=()=>{ctx.moveTo(-.15,-.06);ctx.lineTo(-.08,-.13);ctx.lineTo(.085,-.12);ctx.lineTo(.16,-.025);ctx.lineTo(.13,.07);ctx.lineTo(-.13,.06);ctx.closePath();};
  shade(ctx,plate,metal(back?'#1b1b20':'#30303a'),{x:-.07,y:-.08,r:.25,hi:.25,lw:.6});
  wear(ctx,plate,-.15,-.13,.31,.2,5);
  ctx.strokeStyle=back?'#4b4c48':'#7f8179';ctx.lineWidth=.008;
  ctx.beginPath();ctx.moveTo(-.12,.028);ctx.lineTo(.12,.04);ctx.moveTo(-.06,-.1);ctx.lineTo(.07,-.095);ctx.stroke();
  for(const x of [-.1,.1]){ctx.fillStyle='#77796e';ctx.fillRect(x,-.015,.008,.008);}
  ctx.restore();
}
// Cloth follows speed and air state, using the same input-driven skeleton.
export function cape(ctx: CanvasRenderingContext2D, neck: Pt, L: Look, t: number, speed: number, air: number, scallop: boolean) {
  const fl = Math.sin(t * 6) * 0.04 + Math.min(0.5, speed * 0.06) + air * 0.15, top: Pt = [neck[0] - 0.1, neck[1] + 0.1];
  const n = 5, x0 = top[0] - 0.62 - fl * 1.2, x1 = top[0] + 0.38, y = -0.04 - air * 0.25;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(top[0] - 0.25, top[1]);
    ctx.quadraticCurveTo(x0 + 0.1, (top[1] + y) / 2 - 0.1, x0, y);
    for (let i = 0; i < n; i++) { const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n; if (scallop) ctx.quadraticCurveTo((a + b) / 2, y - 0.12, b, y + Math.sin(t * 5 + i) * 0.015); else { ctx.lineTo((a + b) / 2, y + 0.05 + Math.sin(t * 5 + i) * 0.02); ctx.lineTo(b, y - 0.02); } }
    ctx.quadraticCurveTo(x1 + 0.08, (top[1] + y) / 2, top[0] + 0.32, top[1]); ctx.closePath();
  };
  path();
  ctx.fillStyle = grad(ctx, top[0], top[1], x0, y, [[0, L.cape], [0.6, darken(L.cape, 0.25)], [1, L.capeD]]); ctx.fill();
  // el forro de adentro (más oscuro) que se ve en el borde de atrás, y el ribete del borde
  ctx.save(); ctx.clip();
  ctx.fillStyle = alpha(darken(L.cape, 0.55), 0.85); ctx.beginPath(); ctx.moveTo(x0 - 0.1, y + 0.1); ctx.quadraticCurveTo(x0 + 0.05, (top[1] + y) / 2, top[0] - 0.22, top[1] + 0.05); ctx.lineTo(top[0] - 0.12, top[1] + 0.12); ctx.quadraticCurveTo(x0 + 0.2, (top[1] + y) / 2, x0 + 0.15, y + 0.1); ctx.closePath(); ctx.fill();
  const sh = ctx.createLinearGradient(top[0], top[1], top[0], y); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(x0 - 1, top[1] - 0.2, 3, y - top[1] + 0.4); // brillo de la tela arriba
  ctx.restore();
  path(); ctx.strokeStyle = '#0a0406'; ctx.lineWidth = 0.03; ctx.stroke();
  ctx.strokeStyle = L === HUNTER ? (SUIT?.hi ?? '#c9a24a') : '#1a0a0e'; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.01; ctx.stroke(); ctx.globalAlpha = 1; // ribete
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.025; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(top[0] - 0.2 + k * 0.08, top[1] + 0.1); ctx.quadraticCurveTo(x0 + (x1 - x0) * k / 4, (top[1] + y) / 2, x0 + (x1 - x0) * k / 4 - 0.05, y - 0.05); ctx.stroke(); } // pliegues
}

// ---------------------------------------------------------------- Cabezas
function hunterHead(ctx: CanvasRenderingContext2D, t: number, hurt: boolean) {
  const face = () => { ctx.moveTo(-.25,-.27); ctx.lineTo(-.08,-.39); ctx.lineTo(.23,-.34); ctx.lineTo(.34,-.16); ctx.lineTo(.31,.04); ctx.lineTo(.42,.12); ctx.lineTo(.32,.17); ctx.lineTo(.29,.29); ctx.lineTo(.11,.38); ctx.lineTo(-.1,.32); ctx.lineTo(-.25,.13); ctx.closePath(); };
  shade(ctx, face, HUNTER.skin, { x: -.06, y: -.22, r: .57, lo: .55, hi: .24, lw: .35 });
  wear(ctx, face, -.25, -.3, .6, .66, 3);
  ctx.fillStyle = '#312d29'; ctx.beginPath(); ctx.moveTo(-.29,.18); ctx.quadraticCurveTo(-.48,-.38,-.19,-.46); ctx.quadraticCurveTo(.15,-.55,.35,-.28); ctx.lineTo(.13,-.23); ctx.lineTo(-.1,-.28); ctx.lineTo(-.19,.12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#696158'; ctx.lineWidth = .008;
  for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(-.27+i*.042,-.37);ctx.quadraticCurveTo(-.22+i*.036,-.48,.04+i*.021,-.3);ctx.stroke();}
  ctx.fillStyle='rgba(41,31,28,.68)';ctx.beginPath();ctx.moveTo(-.18,.09);ctx.lineTo(-.07,.22);ctx.lineTo(.09,.26);ctx.lineTo(.3,.19);ctx.lineTo(.28,.3);ctx.lineTo(.1,.37);ctx.lineTo(-.1,.3);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(63,44,36,.35)';ctx.beginPath();ctx.ellipse(-.04,.08,.13,.06,-.3,0,TAU);ctx.fill();
  const blink=t%4.7<.13 || hurt;
  for(const [x,y,w] of [[.035,-.065,.065],[.25,-.075,.041]]) {
    ctx.fillStyle='#493c34';ctx.beginPath();ctx.ellipse(x,y,w*1.2,.04,-.13,0,TAU);ctx.fill();
    if(!blink){ctx.fillStyle='#96988c';ctx.beginPath();ctx.ellipse(x,y+.007,w*.8,.012,0,0,TAU);ctx.fill();ctx.fillStyle='#242e2d';ctx.beginPath();ctx.arc(x+.017,y+.007,.015,0,TAU);ctx.fill();}
    ctx.strokeStyle='#302b27';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(x-w,y-.035);ctx.lineTo(x+w,y-.025);ctx.stroke();
  }
  ctx.strokeStyle='rgba(68,43,33,.7)';ctx.lineWidth=.012;ctx.beginPath();ctx.moveTo(.26,-.03);ctx.lineTo(.3,.09);ctx.lineTo(.24,.12);ctx.moveTo(.08,.24);ctx.lineTo(.26,.225);ctx.moveTo(-.02,-.17);ctx.lineTo(.17,-.18);ctx.stroke();
  ctx.strokeStyle='#7e5148';ctx.lineWidth=.013;ctx.beginPath();ctx.moveTo(.13,-.15);ctx.lineTo(.17,.07);ctx.stroke();
  ctx.strokeStyle='rgba(225,197,165,.55)';ctx.lineWidth=.006;ctx.beginPath();ctx.moveTo(.14,-.15);ctx.lineTo(.18,.07);ctx.stroke();
}
export function vampEye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, rx * 4, '#ff1e2e', 0.55 + 0.2 * Math.sin(t * 6)); ctx.restore();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx * 1.2); g.addColorStop(0, '#ffe6e6'); g.addColorStop(0.35, '#ff3341'); g.addColorStop(1, '#8a0010');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.15, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a0006'; ctx.lineWidth = 0.012; ctx.stroke();
  ctx.fillStyle = '#1a0004'; ctx.beginPath(); ctx.ellipse(x + rx * 0.1, y, rx * 0.16, ry * 0.85, 0, 0, TAU); ctx.fill(); // pupila de gato
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + rx * 0.35, y - ry * 0.35, rx * 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,10,40,0.7)'; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.05, ry * 1.05, -0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); // párpado
}
export function vampHead(ctx: CanvasRenderingContext2D, t: number, open: boolean, spiky: boolean, o: { skin?: string; collar?: string; beard?: boolean; streak?: boolean } = {}) {
  const skin = o.skin ?? VAMP.skin, hair = '#121018';
  // el cuello alto rojo, detrás de la cabeza
  shade(ctx, () => { ctx.moveTo(-0.36, 0.42); ctx.lineTo(-0.56, -0.22); ctx.lineTo(-0.22, -0.02); ctx.lineTo(0.3, -0.02); ctx.lineTo(0.6, -0.2); ctx.lineTo(0.42, 0.44); ctx.closePath(); }, o.collar ?? VAMP.cape, { x: 0, y: -0.2, r: 0.7, hi: 0.35, tex: 0.3, lw: 1 });
  ctx.fillStyle = '#0b090e'; ctx.beginPath(); ctx.moveTo(-0.28, 0.36); ctx.lineTo(-0.42, -0.1); ctx.lineTo(-0.18, 0.06); ctx.lineTo(0.28, 0.06); ctx.lineTo(0.46, -0.08); ctx.lineTo(0.34, 0.38); ctx.closePath(); ctx.fill();
  shade(ctx, () => { ctx.moveTo(-0.36, 0.1); ctx.quadraticCurveTo(-0.5, -0.3, -0.24, -0.48); ctx.lineTo(-0.06, -0.2); ctx.closePath(); }, hair, { x: -0.3, y: -0.3, r: 0.4, tex: 0.3, lw: 1 });
  shade(ctx, () => { ctx.moveTo(-0.2, -0.06); ctx.lineTo(-0.46, -0.28); ctx.lineTo(-0.24, 0.14); ctx.closePath(); }, skin, { x: -0.25, y: -0.05, r: 0.2, lw: 0.8 }); // oreja puntiaguda
  const face = () => { ctx.moveTo(-0.3, -0.18); ctx.quadraticCurveTo(-0.32, 0.24, -0.04, 0.36); ctx.quadraticCurveTo(0.2, 0.41, 0.37, 0.18); ctx.quadraticCurveTo(0.44, -0.08, 0.34, -0.3); ctx.quadraticCurveTo(0, -0.44, -0.3, -0.18); ctx.closePath(); };
  shade(ctx, face, skin, { x: 0.16, y: -0.12, r: 0.6, hi: 0.12, lo: 0.5, tex: 0.04, lw: 1 });
  ctx.fillStyle = 'rgba(80,40,110,0.22)'; ctx.beginPath(); ctx.ellipse(0.17, 0.0, 0.2, 0.06, 0, 0, TAU); ctx.fill(); // ojeras
  // pómulos hundidos, nariz afilada y la sombra del mentón (cara más real)
  ctx.save(); ctx.beginPath(); face(); ctx.clip();
  ctx.fillStyle = 'rgba(70,30,100,0.28)'; ctx.beginPath(); ctx.moveTo(-0.05, 0.05); ctx.quadraticCurveTo(0.05, 0.18, 0.02, 0.3); ctx.quadraticCurveTo(-0.12, 0.2, -0.16, 0.04); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(0.2, 0.06, 0.08, 0.03, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(60,20,90,0.25)'; ctx.beginPath(); ctx.ellipse(0.12, 0.36, 0.22, 0.07, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(90,50,120,0.45)'; ctx.beginPath(); ctx.moveTo(0.31, 0.0); ctx.quadraticCurveTo(0.42, 0.08, 0.37, 0.11); ctx.lineTo(0.31, 0.1); ctx.closePath(); ctx.fill(); // nariz
  ctx.strokeStyle = 'rgba(60,20,80,0.7)'; ctx.lineWidth = 0.01; ctx.beginPath(); ctx.moveTo(0.3, 0.1); ctx.lineTo(0.36, 0.11); ctx.stroke();
  vampEye(ctx, 0.08, -0.02, 0.06, 0.05, t); vampEye(ctx, 0.28, -0.015, 0.055, 0.046, t);
  ctx.strokeStyle = '#0b0a10'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.04, -0.17); ctx.lineTo(0.15, -0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.22, -0.08); ctx.lineTo(0.38, -0.17); ctx.stroke();
  if (open) { // boca abierta con colmillos grandes
    shade(ctx, () => { ctx.moveTo(0.06, 0.15); ctx.quadraticCurveTo(0.19, 0.1, 0.33, 0.15); ctx.quadraticCurveTo(0.22, 0.36, 0.06, 0.15); ctx.closePath(); }, '#5a0710', { x: 0.2, y: 0.2, r: 0.15, lw: 0.8 });
    ctx.fillStyle = '#e05868'; ctx.beginPath(); ctx.ellipse(0.2, 0.25, 0.06, 0.03, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; for (const fx of [0.1, 0.29]) { ctx.beginPath(); ctx.moveTo(fx - 0.025, 0.145); ctx.lineTo(fx, 0.23); ctx.lineTo(fx + 0.025, 0.145); ctx.closePath(); ctx.fill(); }
  } else {
    ctx.strokeStyle = '#1a0a12'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0.09, 0.19); ctx.quadraticCurveTo(0.19, 0.15, 0.31, 0.19); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const fx of [0.12, 0.27]) { ctx.beginPath(); ctx.moveTo(fx - 0.022, 0.17); ctx.lineTo(fx, 0.25); ctx.lineTo(fx + 0.022, 0.17); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#1a0a12'; ctx.lineWidth = 0.01; ctx.stroke(); }
  }
  // pelo: peinado para atrás con pico en la frente (o en puntas, el volador)
  const top = () => {
    ctx.moveTo(-0.38, -0.02); ctx.quadraticCurveTo(-0.44, -0.4, -0.12, -0.52);
    if (spiky) { ctx.lineTo(-0.2, -0.74); ctx.lineTo(0.0, -0.54); ctx.lineTo(0.06, -0.78); ctx.lineTo(0.16, -0.53); ctx.lineTo(0.38, -0.64); ctx.lineTo(0.32, -0.42); }
    else { ctx.quadraticCurveTo(0.2, -0.58, 0.38, -0.42); ctx.lineTo(0.46, -0.54); ctx.lineTo(0.38, -0.32); }
    ctx.lineTo(0.34, -0.25); ctx.quadraticCurveTo(0.25, -0.28, 0.18, -0.2); ctx.lineTo(0.14, -0.1); // pico en la frente
    ctx.lineTo(0.09, -0.21); ctx.quadraticCurveTo(-0.08, -0.28, -0.22, -0.14); ctx.lineTo(-0.25, 0.04); ctx.closePath();
  };
  shade(ctx, top, hair, { x: -0.05, y: -0.45, r: 0.5, hi: 0.5, tex: 0.3, lw: 1 });
  ctx.strokeStyle = 'rgba(190,150,255,0.4)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.26, -0.38); ctx.quadraticCurveTo(-0.04, -0.52, 0.2, -0.44); ctx.stroke();
  ctx.save(); ctx.beginPath(); top(); ctx.clip(); // el pelo peinado para atrás: muchas líneas finas con brillo
  for (let i = 0; i < 14; i++) { const y = -0.56 + i * 0.035; ctx.strokeStyle = i % 3 === 0 ? 'rgba(170,140,230,0.35)' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.007; ctx.beginPath(); ctx.moveTo(0.36, y + 0.12); ctx.quadraticCurveTo(0.05, y - 0.06, -0.42, y + 0.18); ctx.stroke(); }
  ctx.restore();
  if (o.streak) { ctx.strokeStyle = '#e8e4f0'; ctx.lineWidth = 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.3, -0.2); ctx.quadraticCurveTo(-0.22, -0.46, 0.08, -0.48); ctx.stroke(); }
  if (o.beard) { // barba negra en punta, de patilla a patilla
    shade(ctx, () => { ctx.moveTo(-0.25, -0.02); ctx.quadraticCurveTo(-0.24, 0.3, -0.02, 0.38); ctx.lineTo(0.14, 0.52); ctx.lineTo(0.2, 0.4); ctx.quadraticCurveTo(0.34, 0.34, 0.37, 0.2); ctx.quadraticCurveTo(0.24, 0.36, 0.08, 0.33); ctx.quadraticCurveTo(-0.1, 0.28, -0.15, 0.0); ctx.closePath(); }, '#141118', { x: 0.05, y: 0.3, r: 0.3, tex: 0.3, lw: 0.8 });
  }
}

// ---------------------------------------------------------------- Torsos
function hunterTorso(ctx: CanvasRenderingContext2D) {
  const torso = () => { ctx.moveTo(-0.3, 0.06); ctx.lineTo(-0.4, -0.42); ctx.quadraticCurveTo(0, -0.62, 0.4, -0.42); ctx.lineTo(0.29, 0.06); ctx.closePath(); };
  shade(ctx, torso, HUNTER.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.45, tex: 0.45 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  shade(ctx, () => { ctx.moveTo(-0.26, -0.4); ctx.lineTo(0.28, -0.4); ctx.lineTo(0.22, -0.12); ctx.lineTo(0.0, -0.06); ctx.lineTo(-0.2, -0.12); ctx.closePath(); }, metal('#33333d'), { x: 0.02, y: -0.35, r: 0.35, hi: 0.5, lw: 0.6 }); // pechera
  wear(ctx, torso, -0.38, -0.5, 0.76, 0.56, 7);
  // correas cruzadas con el broche en el medio
  for (const [a, b] of [[-0.36, 0.3], [0.36, -0.28]] as const) segment(ctx, [a, -0.5], [b, 0.0], 0.085, 0.085, HUNTER.strap, 0.6);
  ctx.restore();
  ctx.save(); ctx.translate(0.0, -0.27); ctx.rotate(Math.PI / 4);
  shade(ctx, () => ctx.rect(-0.055, -0.055, 0.11, 0.11), '#5a3420', { r: 0.1, lw: 0.6 });
  ctx.strokeStyle = HUNTER.trim; ctx.lineWidth = 0.02; ctx.strokeRect(-0.035, -0.035, 0.07, 0.07);
  ctx.restore();
  // cinturón ancho con hebilla grande y cuadrada
  shade(ctx, () => ctx.roundRect(-0.31, -0.08, 0.6, 0.13, 0.03), HUNTER.strap, { x: 0, y: -0.07, r: 0.3, hi: 0.4, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.07, -0.1, 0.15, 0.17, 0.025), '#cfd2db', { x: -0.03, y: -0.08, r: 0.12, hi: 0.7, lw: 0.6 });
  ctx.fillStyle = '#4a2a16'; ctx.fillRect(-0.025, -0.045, 0.06, 0.07);
  // faldones de cuero con ribete marrón
  for (const [px, pw] of [[-0.29, 0.27], [0.03, 0.27]] as const) {
    shade(ctx, () => { ctx.moveTo(px, 0.05); ctx.lineTo(px + pw, 0.05); ctx.lineTo(px + pw * 0.92, 0.26); ctx.lineTo(px + pw * 0.08, 0.26); ctx.closePath(); }, SUIT?.skirt ?? '#24222a', { x: px + 0.05, y: 0.06, r: 0.25, lw: 0.6 });
    ctx.strokeStyle = SUIT?.skirtTrim ?? '#94603c'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.23); ctx.lineTo(px + pw * 0.9, 0.23); ctx.moveTo(px + 0.02, 0.07); ctx.lineTo(px + pw * 0.1, 0.23); ctx.moveTo(px + pw - 0.02, 0.07); ctx.lineTo(px + pw * 0.9, 0.23); ctx.stroke();
  }
  // detalles: costuras de las placas, remaches, rayones y la cota de malla abajo del cinturón
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.38, -0.3); ctx.quadraticCurveTo(0, -0.26, 0.38, -0.3); ctx.moveTo(-0.35, -0.18); ctx.quadraticCurveTo(0, -0.14, 0.35, -0.18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(-0.37, -0.31); ctx.quadraticCurveTo(0, -0.275, 0.37, -0.31); ctx.moveTo(-0.2, -0.36); ctx.lineTo(-0.12, -0.33); ctx.moveTo(0.22, -0.22); ctx.lineTo(0.3, -0.25); ctx.stroke();
  ctx.fillStyle = SUIT?.hi ?? '#c9ccd6'; for (const [rx, ry] of [[-0.33, -0.3], [0.33, -0.3], [-0.31, -0.18], [0.31, -0.18], [-0.27, -0.4], [0.29, -0.4]] as const) { ctx.beginPath(); ctx.arc(rx, ry, 0.016, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(-0.29, 0.03, 0.57, 0.06); ctx.strokeStyle = '#6b6e79'; ctx.lineWidth = 0.008; for (let x = -0.28; x < 0.28; x += 0.035) { ctx.beginPath(); ctx.arc(x, 0.05, 0.016, 0, Math.PI); ctx.arc(x + 0.017, 0.075, 0.016, 0, Math.PI); ctx.stroke(); } // cota de malla
  shade(ctx, () => ctx.roundRect(0.16, -0.05, 0.12, 0.13, 0.025), '#6a3b1e', { x: 0.2, y: -0.03, r: 0.1, lw: 0.5 }); // bolsito del cinturón
  ctx.strokeStyle = '#c9a070'; ctx.setLineDash([0.012, 0.01]); ctx.lineWidth = 0.006; ctx.strokeRect(0.175, -0.035, 0.09, 0.1); ctx.beginPath(); ctx.moveTo(-0.3, -0.065); ctx.lineTo(0.28, -0.065); ctx.moveTo(-0.3, 0.035); ctx.lineTo(0.28, 0.035); ctx.stroke(); ctx.setLineDash([]); // costuras
  // cuello alto
  shade(ctx, () => ctx.ellipse(0.02, -0.53, 0.2, 0.08, 0, 0, TAU), metal('#34343e'), { x: 0, y: -0.56, r: 0.2, hi: 0.5, lw: 0.6 });
}
export function vampTorso(ctx: CanvasRenderingContext2D, t: number) {
  const torso = () => { ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.38, -0.42); ctx.quadraticCurveTo(0, -0.6, 0.38, -0.42); ctx.lineTo(0.27, 0.06); ctx.closePath(); };
  shade(ctx, torso, VAMP.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.4, tex: 0.35 });
  // el chaleco bordó con brocado y botones dorados, entre las solapas negras del frac
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, -0.45, 0, 0.05, [[0, '#5a0a14'], [1, '#2a0408']]); ctx.beginPath(); ctx.moveTo(-0.14, -0.46); ctx.lineTo(0.16, -0.46); ctx.lineTo(0.14, 0.06); ctx.lineTo(-0.12, 0.06); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.18)'; for (let yy = -0.42; yy < 0.04; yy += 0.06) for (let xx = -0.1; xx < 0.14; xx += 0.06) { ctx.beginPath(); ctx.moveTo(xx, yy - 0.015); ctx.lineTo(xx + 0.012, yy); ctx.lineTo(xx, yy + 0.015); ctx.lineTo(xx - 0.012, yy); ctx.closePath(); ctx.fill(); } // brocado
  for (const yy of [-0.24, -0.15, -0.06]) shade(ctx, () => ctx.arc(0.015, yy, 0.018, 0, TAU), '#d9a632', { x: 0.01, y: yy - 0.006, r: 0.02, hi: 0.7, lw: 0.4 });
  for (const sgn of [-1, 1]) { ctx.fillStyle = '#0e0b12'; ctx.beginPath(); ctx.moveTo(sgn * 0.14, -0.5); ctx.lineTo(sgn * 0.36, -0.42); ctx.lineTo(sgn * 0.26, 0.06); ctx.lineTo(sgn * 0.13, 0.06); ctx.lineTo(sgn * 0.16, -0.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.008; ctx.stroke(); } // solapas
  ctx.restore();
  ctx.strokeStyle = VAMP.trim; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.3, -0.4); ctx.lineTo(-0.22, 0.04); ctx.moveTo(0.3, -0.4); ctx.lineTo(0.22, 0.04); ctx.stroke(); // ribetes rojos
  // corbatín de volados blanco con la gema roja
  shade(ctx, () => { ctx.moveTo(-0.08, -0.52); ctx.lineTo(0.12, -0.52); ctx.lineTo(0.09, -0.42); ctx.lineTo(0.14, -0.34); ctx.lineTo(0.06, -0.3); ctx.lineTo(0.02, -0.22); ctx.lineTo(-0.02, -0.3); ctx.lineTo(-0.1, -0.34); ctx.lineTo(-0.05, -0.42); ctx.closePath(); }, '#f2eef6', { x: 0.02, y: -0.48, r: 0.25, hi: 0.3, lw: 0.6 });
  ctx.strokeStyle = '#b9b0c4'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.05, -0.41); ctx.lineTo(0.09, -0.41); ctx.moveTo(-0.07, -0.34); ctx.lineTo(0.11, -0.34); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.006; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-0.08 + k * 0.035, -0.31, 0.018, 0, Math.PI); ctx.stroke(); } // puntilla
  shade(ctx, () => ctx.arc(0.02, -0.49, 0.045, 0, TAU), '#e3142a', { x: 0.01, y: -0.5, r: 0.05, hi: 0.7, lw: 0.6 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.02, -0.49, 0.12, '#ff3048', 0.4 + 0.2 * Math.sin(t * 3)); ctx.restore();
  // cinturón con hebilla
  shade(ctx, () => ctx.roundRect(-0.29, -0.08, 0.56, 0.11, 0.03), VAMP.strap, { x: 0, y: -0.07, r: 0.3, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.06, -0.095, 0.13, 0.14, 0.02), '#c4c8d2', { x: -0.03, y: -0.08, r: 0.1, hi: 0.7, lw: 0.6 }); ctx.fillStyle = VAMP.strap; ctx.fillRect(-0.02, -0.055, 0.05, 0.06);
  for (const [px, pw] of [[-0.27, 0.25], [0.03, 0.25]] as const) { shade(ctx, () => { ctx.moveTo(px, 0.04); ctx.lineTo(px + pw, 0.04); ctx.lineTo(px + pw * 0.9, 0.24); ctx.lineTo(px + pw * 0.1, 0.24); ctx.closePath(); }, '#1a1620', { x: px, y: 0.05, r: 0.25, lw: 0.6 }); ctx.strokeStyle = VAMP.trim; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.22); ctx.lineTo(px + pw * 0.9, 0.22); ctx.stroke(); }
}

// ---------------------------------------------------------------- Personajes completos
// Dibuja el arma en la mano (dirección del brazo: ang, con la convención de dirv).
function holdWeapon(ctx: CanvasRenderingContext2D, w: Weapon, hand: Pt, ang: number, p: Player, t: number) {
  if (realisticHeldWeapon(ctx, w, hand, ang, p.attackT, t)) return;
  if (w === 'sword') return;
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(Math.PI / 2 - ang);
  const shot = p.attackT >= 0 && p.attackWeapon === w ? p.attackT : -1;
  if (w === 'crossbow') { ctx.translate(-0.05, -0.05); ctx.scale(1.25, 1.25); drawCrossbow(ctx, !(shot >= 0 && shot < 0.3), t); }
  else if (w === 'pistol') { ctx.translate(-0.02, 0.02); ctx.scale(1.45, 1.45); drawFirePistol(ctx, t, shot >= 0 && shot < 0.12 ? 1 - shot / 0.12 : 0); }
  else if (w === 'firesword') { ctx.scale(0.95, 0.95); drawFireSword(ctx, t, shot >= 0 ? 1 : 0); }
  else if (w === 'violet') { ctx.scale(0.95, 0.95); drawBloodSword(ctx, t, shot >= 0 ? 1 : 0); }
  else if (w === 'bone') { ctx.translate(-0.25, 0); ctx.scale(0.95, 0.95); drawBoneHammer(ctx, t); }
  else if (w === 'ice') { ctx.rotate(-(Math.PI / 2 - ang)); ctx.translate(0.08, -0.05); drawIceCrystal(ctx, t, 0.7 + (shot >= 0 && shot < 0.15 ? 0.3 : 0)); }
  else if (w === 'venom' && !(shot >= 0 && shot < 0.15)) { ctx.rotate(-(Math.PI / 2 - ang)); ctx.translate(0.06, -0.14); drawVenomBall(ctx, 0.16, t); }
  else if (w === 'cross' || w === 'holy') { ctx.translate(-0.14, 0); ctx.scale(w === 'holy' ? 1.12 : 1.05, w === 'holy' ? 0.78 : 1.05); /* (la dorada: más angosta, que se vea bien la cruz) */ drawHolyCross(ctx, t, shot >= 0 ? 1 : 0.35); }
  else if (w === 'garlic' && !(shot > 0.1)) { ctx.rotate(-(Math.PI / 2 - ang)); ctx.translate(0.05, -0.12); drawGarlicBomb(ctx, 0.3, t); }
  ctx.restore();
}
// El casco dorado (con la cruz en la mano): cubre el pelo, con cresta, carrilleras y la gema roja.
function goldHelmet(ctx: CanvasRenderingContext2D) {
  const G = (y0: number, y1: number) => grad(ctx, 0, y0, 0, y1, [[0, '#fff1a8'], [0.4, '#e2a72e'], [1, '#7a4a0c']]);
  ctx.beginPath(); ctx.moveTo(-0.44, 0.22); ctx.quadraticCurveTo(-0.56, -0.5, -0.02, -0.62); ctx.quadraticCurveTo(0.46, -0.6, 0.48, -0.2); ctx.lineTo(0.4, -0.12); ctx.quadraticCurveTo(0.12, -0.26, -0.12, -0.18); ctx.lineTo(-0.14, 0.05); ctx.lineTo(-0.26, 0.3); ctx.closePath();
  ctx.fillStyle = G(-0.62, 0.3); ctx.fill(); ctx.strokeStyle = '#2a1804'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.12, -0.6); ctx.quadraticCurveTo(0.0, -0.85, 0.2, -0.82); ctx.quadraticCurveTo(0.12, -0.66, 0.16, -0.58); ctx.closePath(); ctx.fillStyle = G(-0.85, -0.55); ctx.fill(); ctx.stroke(); // cresta
  ctx.strokeStyle = '#fff1a8'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.38, 0.1); ctx.quadraticCurveTo(-0.46, -0.42, -0.02, -0.52); ctx.quadraticCurveTo(0.36, -0.5, 0.4, -0.22); ctx.stroke();
  ctx.fillStyle = '#e3142a'; ctx.beginPath(); ctx.moveTo(0.16, -0.48); ctx.lineTo(0.24, -0.38); ctx.lineTo(0.16, -0.28); ctx.lineTo(0.08, -0.38); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2a1804'; ctx.lineWidth = 0.015; ctx.stroke();
  spec(ctx, -0.18, -0.42, 0.12, 0.05, -0.5, 0.7);
}
// The armour worn (the same six suits as in Vampyrium): with an armour weapon in hand, or the protective armour on.
export type SuitKey = 'ice' | 'holy' | 'venom' | 'violet' | 'guard' | 'bone';
export function suitOf(g: Game): SuitKey | null {
  const w = g.weapon;
  if (w === 'ice' || w === 'holy' || w === 'venom' || w === 'violet' || w === 'bone') return w;
  if (w === 'cross') return 'holy';
  return g.guardHp > 0 ? 'guard' : null;
}
// Vampyrium's suit details (aura, shoulder pieces, chest emblem, venom crown), drawn on the realistic Demian.
export interface SuitDecor { key: SuitKey; aura: (ctx: CanvasRenderingContext2D) => void; shoulder: (ctx: CanvasRenderingContext2D, at: Pt, back: boolean) => void; chest: (ctx: CanvasRenderingContext2D) => void; crown: (ctx: CanvasRenderingContext2D) => void }
function suitDecor(g: Game, t: number): SuitDecor | null {
  const key = suitOf(g); if (!key) return null;
  const su = SUITS[key === 'guard' ? 'guardOn' : key]!;
  return {
    key,
    aura: c => { if (su.aura) suitAura(c, su.aura, t); },
    shoulder: (c, at, back) => { if (su.shoulder) suitShoulder(c, su, at, back, t); },
    chest: c => { if (key === 'violet' || key === 'venom' || key === 'guard') suitChest(c, su, t); },
    crown: c => { if (su.head === 'crown') venomCrown(c, t); },
  };
}
export function drawHunterK(ctx: CanvasRenderingContext2D, p: Player, g: Game, t: number) {
  const held = g.weapon, pose = hunterPose(p, t, held);
  if (p.spinT > 0 && !p.onGround) { // the somersault: knees tuck to the chest in the middle of the turn, then open to land
    const k = Math.sin(Math.min(1, Math.max(0, 1 - p.spinT / .45)) * Math.PI), tuck: [number, number][] = [[1.35, 2.25], [1.15, 2.1]];
    pose.legs = pose.legs.map(([a, b], i) => [a + (tuck[i][0] - a) * k, b + (tuck[i][1] - b) * k] as [number, number]);
  }
  if (drawRealisticHunter(ctx, p, g, pose, t, (hand, angle) => {
    if (held === 'sword') { if (!g.boomer) sword(ctx, hand, angle); }
    else holdWeapon(ctx, p.attackT >= 0 ? p.attackWeapon : held, hand, angle, p, t);
  }, suitDecor(g, t))) return;
  const now = p.attackT >= 0 ? p.attackWeapon : held;
  const suit = (ARMOR_W.includes(now) ? SUITS[now] : g.guardHp > 0 ? SUITS.guardOn : undefined) ?? SUITS[now] ?? SUITS[held] ?? null; // (con la protectora puesta y otra armadura en la mano, se ve esa armadura y la burbuja dorada)
  const saved = { ...HUNTER };
  if (suit) { SUIT = suit; Object.assign(HUNTER, suit.look); }
  try { drawHunterBody(ctx, p, g, t, pose, held, suit); } finally { if (suit) { SUIT = null; Object.assign(HUNTER, saved); } }
  if (g.guardHp > 0) { // la burbuja dorada del escudo (más tenue cuanto menos aguanta)
    const k = g.guardHp / 50;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -1.05, 1.5, '#ffd76a', 0.12 + 0.18 * k);
    ctx.strokeStyle = `rgba(255,230,150,${0.25 + 0.35 * k})`; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(0, -1.05, 0.95, 1.25, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,250,220,${0.4 * k})`; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.ellipse(0, -1.05, 0.95, 1.25, 0, -2.3 + Math.sin(t * 2) * 0.3, -1.4 + Math.sin(t * 2) * 0.3); ctx.stroke();
    ctx.restore();
  }
}
// El aura de cada armadura (atrás del cuerpo): llamas verdes, rayos violetas o escarcha.
function suitAura(ctx: CanvasRenderingContext2D, kind: Suit['aura'], t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (kind === 'flame') for (let i = 0; i < 7; i++) {
    const x = -0.75 + i * 0.25, h = 0.55 + 0.35 * Math.abs(Math.sin(t * 3 + i * 1.7)), y0 = -0.9 - Math.abs(x) * 0.3, sw = Math.sin(t * 7 + i) * 0.06;
    ctx.fillStyle = `rgba(140,255,60,${0.32 + 0.1 * Math.sin(t * 9 + i)})`; ctx.beginPath(); ctx.moveTo(x - 0.12, y0); ctx.quadraticCurveTo(x - 0.14, y0 - h * 0.6, x + sw, y0 - h); ctx.quadraticCurveTo(x + 0.14, y0 - h * 0.5, x + 0.12, y0); ctx.closePath(); ctx.fill();
  }
  if (kind === 'spark') for (let i = 0; i < 4; i++) {
    if (Math.sin(t * 13 + i * 2.1) < -0.2) continue;
    const a = i * 1.6 + Math.floor(t * 9) * 0.7, cx = Math.cos(a) * 0.75, cy = -1.1 + Math.sin(a) * 0.9;
    ctx.strokeStyle = 'rgba(210,120,255,0.85)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(cx, cy - 0.3);
    for (let k = 1; k <= 4; k++) ctx.lineTo(cx + (k % 2 ? 0.12 : -0.1), cy - 0.3 + k * 0.16); ctx.stroke();
    bloom(ctx, cx, cy, 0.35, '#b44cff', 0.35);
  }
  if (kind === 'frost') for (let i = 0; i < 10; i++) {
    const k = (t * 0.4 + i / 10) % 1, x = Math.sin(i * 2.3) * 0.8, y = -0.2 - k * 2.2;
    ctx.fillStyle = `rgba(190,235,255,${0.7 * Math.sin(k * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, 0.03 + (i % 3) * 0.01, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// Lo que lleva cada armadura en el pecho: copo de nieve, gema o calavera (en el marco del torso).
function suitChest(ctx: CanvasRenderingContext2D, su: Suit, t: number) {
  if (SUITS.ice === su) { // el copo de nieve que brilla
    ctx.save(); ctx.translate(0.0, -0.27); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, 0.22, '#7fd8ff', 0.5); ctx.restore();
    ctx.save(); ctx.translate(0.0, -0.27); ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.12); ctx.moveTo(0, -0.07); ctx.lineTo(0.035, -0.1); ctx.moveTo(0, -0.07); ctx.lineTo(-0.035, -0.1); ctx.stroke(); }
    ctx.restore(); return;
  }
  if (su.head === 'skull' || SUITS.bone === su) { // calavera en el pecho y huesos cruzados
    ctx.save(); ctx.translate(0.0, -0.27); ctx.scale(0.55, 0.55); skullShape(ctx); ctx.restore(); return;
  }
  if (su.gem) { // la gema del pecho en un marco de metal
    ctx.save(); ctx.translate(0.0, -0.28);
    ctx.fillStyle = su.hi; ctx.beginPath(); ctx.moveTo(0, -0.1); ctx.lineTo(0.09, 0); ctx.lineTo(0, 0.1); ctx.lineTo(-0.09, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.015; ctx.stroke();
    const gg = grad(ctx, -0.06, -0.06, 0.06, 0.06, [[0, lighten(su.gem, 0.6)], [0.5, su.gem], [1, darken(su.gem, 0.5)]]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, -0.065); ctx.lineTo(0.06, 0); ctx.lineTo(0, 0.065); ctx.lineTo(-0.06, 0); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, 0.18, su.gem, 0.35 + 0.1 * Math.sin(t * 4));
    ctx.restore();
  }
  if (SUITS.guardOn === su) { ctx.fillStyle = '#c4121e'; ctx.fillRect(-0.05, 0.06, 0.1, 0.2); ctx.strokeStyle = '#e2a72e'; ctx.lineWidth = 0.015; ctx.strokeRect(-0.05, 0.06, 0.1, 0.2); } // el tabardo rojo
}
// Una calavera chica (para el pecho y las hombreras de la armadura de huesos), en un cuadrado de ±0,2.
function skullShape(ctx: CanvasRenderingContext2D) {
  const bone = grad(ctx, 0, -0.2, 0, 0.2, [[0, '#fbf3df'], [0.6, '#e2cfa6'], [1, '#9c8660']]);
  ctx.fillStyle = bone; ctx.beginPath(); ctx.moveTo(-0.15, 0.04); ctx.quadraticCurveTo(-0.2, -0.22, 0, -0.22); ctx.quadraticCurveTo(0.2, -0.22, 0.15, 0.04); ctx.lineTo(0.1, 0.17); ctx.lineTo(-0.1, 0.17); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.fillStyle = '#1a0a06'; for (const x of [-0.065, 0.065]) { ctx.beginPath(); ctx.ellipse(x, -0.05, 0.045, 0.05, 0, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, 0.02); ctx.lineTo(-0.02, 0.06); ctx.lineTo(0.02, 0.06); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a0a06'; ctx.lineWidth = 0.012; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(k * 0.035, 0.1); ctx.lineTo(k * 0.035, 0.16); } ctx.stroke();
}
// Lo de arriba de las hombreras: cristales de hielo, calavera, espiral dorada o pinches.
function suitShoulder(ctx: CanvasRenderingContext2D, su: Suit, sp: Pt, back: boolean, t: number) {
  const k = back ? 0.85 : 1;
  ctx.save(); ctx.translate(sp[0], sp[1] - 0.04); ctx.scale(k, k);
  if (back) ctx.globalAlpha = 0.85;
  if (su.shoulder === 'ice') for (const [a, l] of [[-0.9, 0.34], [-0.4, 0.42], [0.15, 0.3]] as const) {
    ctx.save(); ctx.rotate(a); ctx.translate(0, -0.08);
    ctx.fillStyle = grad(ctx, -0.06, 0, 0.06, 0, [[0, '#f2fbff'], [0.5, '#8fd6ff'], [1, '#2a6fc0']]); ctx.beginPath(); ctx.moveTo(-0.06, 0); ctx.lineTo(0, -l); ctx.lineTo(0.06, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.015; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.01; ctx.beginPath(); ctx.moveTo(-0.02, -0.02); ctx.lineTo(0, -l * 0.8); ctx.stroke(); ctx.restore();
  }
  if (su.shoulder === 'skull') { ctx.translate(0, -0.02); ctx.scale(0.75, 0.75); skullShape(ctx); ctx.fillStyle = '#efe3c6'; ctx.beginPath(); ctx.moveTo(0.1, -0.15); ctx.quadraticCurveTo(0.25, -0.3, 0.2, -0.45); ctx.quadraticCurveTo(0.14, -0.3, 0.02, -0.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.02; ctx.stroke(); }
  if (su.shoulder === 'swirl') { ctx.strokeStyle = su.hi; ctx.lineWidth = 0.03; ctx.beginPath(); for (let a = 0; a < 9; a += 0.3) { const r = 0.012 * a; ctx.lineTo(Math.cos(a) * r - 0.04, Math.sin(a) * r - 0.02); } ctx.stroke(); }
  if (su.shoulder === 'spike') for (const a of [-0.6, 0.1]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = grad(ctx, -0.04, 0, 0.04, 0, [[0, '#e8ebf2'], [1, '#6a6e7a']]); ctx.beginPath(); ctx.moveTo(-0.05, -0.08); ctx.lineTo(0, -0.36); ctx.lineTo(0.05, -0.08); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.015; ctx.stroke(); ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -0.1, 0.3, '#8cff3a', 0.25 + 0.1 * Math.sin(t * 5)); ctx.restore(); }
  ctx.restore();
}
// Lo que lleva en la cabeza: el casco dorado, la capucha blanca, el casco de calavera con cuernos o la corona verde.
function hoodBack(ctx: CanvasRenderingContext2D) {
  ctx.beginPath(); ctx.moveTo(-0.52, 0.42); ctx.quadraticCurveTo(-0.74, -0.5, -0.08, -0.8); ctx.quadraticCurveTo(0.5, -0.82, 0.58, -0.2); ctx.lineTo(0.5, 0.3); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, -0.8, 0, 0.4, [[0, '#ffffff'], [0.6, '#dcd7ce'], [1, '#9e978c']]); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.fillStyle = '#5a0a10'; ctx.beginPath(); ctx.moveTo(-0.3, 0.3); ctx.quadraticCurveTo(-0.42, -0.4, 0.0, -0.52); ctx.quadraticCurveTo(0.4, -0.5, 0.46, -0.1); ctx.lineTo(0.42, 0.3); ctx.closePath(); ctx.fill(); // el forro rojo oscuro de adentro
}
function hoodFront(ctx: CanvasRenderingContext2D) {
  const path = () => { ctx.beginPath(); ctx.moveTo(-0.52, 0.42); ctx.quadraticCurveTo(-0.74, -0.5, -0.08, -0.8); ctx.quadraticCurveTo(0.5, -0.82, 0.58, -0.2); ctx.lineTo(0.47, -0.12); ctx.quadraticCurveTo(0.38, -0.44, 0.04, -0.44); ctx.quadraticCurveTo(-0.24, -0.4, -0.26, -0.04); ctx.quadraticCurveTo(-0.27, 0.26, -0.32, 0.44); ctx.closePath(); };
  path(); ctx.fillStyle = grad(ctx, -0.5, -0.8, 0.4, 0.4, [[0, '#ffffff'], [0.55, '#e9e5dd'], [1, '#a9a297']]); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.save(); path(); ctx.clip();
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.46, 0.36); ctx.quadraticCurveTo(-0.62, -0.42, -0.06, -0.68); ctx.quadraticCurveTo(0.38, -0.7, 0.5, -0.24); ctx.stroke(); // la franja roja
  ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.1, -0.79); ctx.lineTo(-0.2, -0.52); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0.12, -0.42, 0.34, 0.06, 0, 0, TAU); ctx.fill(); // sombra del borde sobre la frente
  ctx.restore();
  spec(ctx, -0.3, -0.55, 0.12, 0.05, -0.6, 0.5);
}
function skullHelmet(ctx: CanvasRenderingContext2D) {
  const BONE = (y0: number, y1: number) => grad(ctx, 0, y0, 0, y1, [[0, '#fbf3df'], [0.55, '#e2cfa6'], [1, '#8f7a56']]);
  for (const [bx, s] of [[-0.3, -1], [0.3, 1]] as const) { // los cuernos
    ctx.beginPath(); ctx.moveTo(bx - 0.1, -0.56); ctx.quadraticCurveTo(bx + s * 0.32, -0.7, bx + s * 0.28, -1.12); ctx.quadraticCurveTo(bx + s * 0.18, -0.82, bx + 0.08, -0.62); ctx.closePath();
    ctx.fillStyle = BONE(-1.1, -0.5); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.025; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-0.46, 0.2); ctx.quadraticCurveTo(-0.62, -0.72, 0.02, -0.76); ctx.quadraticCurveTo(0.54, -0.72, 0.5, -0.22); ctx.lineTo(0.44, -0.14); ctx.lineTo(0.0, -0.18); ctx.lineTo(-0.16, -0.12); ctx.lineTo(-0.2, 0.06); ctx.lineTo(-0.3, 0.3); ctx.closePath();
  ctx.fillStyle = BONE(-0.76, 0.3); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.fillStyle = '#1a0a06'; for (const [x, y] of [[0.08, -0.4], [0.32, -0.38]] as const) { ctx.beginPath(); ctx.ellipse(x, y, 0.07, 0.06, 0, 0, TAU); ctx.fill(); } // las órbitas
  ctx.beginPath(); ctx.moveTo(0.2, -0.32); ctx.lineTo(0.17, -0.25); ctx.lineTo(0.23, -0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f6ecd4'; for (let i = 0; i < 6; i++) { const x = 0.02 + i * 0.07; ctx.beginPath(); ctx.moveTo(x - 0.025, -0.2); ctx.lineTo(x, -0.1 - (i % 2) * 0.04); ctx.lineTo(x + 0.025, -0.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.008; ctx.stroke(); } // los colmillos sobre la frente
  ctx.strokeStyle = '#c4121e'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.1, -0.74); ctx.quadraticCurveTo(-0.02, -0.6, 0.06, -0.62); ctx.stroke(); // la pintura roja
  ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.4, -0.2); ctx.quadraticCurveTo(-0.3, -0.4, -0.36, -0.55); ctx.stroke(); // una grieta
  spec(ctx, -0.22, -0.56, 0.12, 0.05, -0.5, 0.6);
}
function venomCrown(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const x = -0.2 + i * 0.18, h = 0.25 + 0.12 * Math.abs(Math.sin(t * 5 + i)); ctx.fillStyle = 'rgba(140,255,60,0.55)'; ctx.beginPath(); ctx.moveTo(x - 0.07, -0.42); ctx.quadraticCurveTo(x, -0.42 - h, x + Math.sin(t * 8 + i) * 0.04, -0.46 - h); ctx.quadraticCurveTo(x + 0.06, -0.48, x + 0.07, -0.42); ctx.closePath(); ctx.fill(); } ctx.restore();
  ctx.beginPath(); ctx.moveTo(-0.42, -0.2); ctx.quadraticCurveTo(0.0, -0.52, 0.48, -0.3); ctx.lineTo(0.46, -0.2); ctx.quadraticCurveTo(0.0, -0.4, -0.4, -0.1); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, -0.5, 0, -0.1, [[0, '#ffffff'], [0.5, '#b9bdc6'], [1, '#4a4e58']]); ctx.fill(); ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 0.02; ctx.stroke();
  for (const [x, y, h] of [[-0.2, -0.33, 0.16], [0.18, -0.42, 0.26], [0.38, -0.36, 0.14]] as const) { ctx.beginPath(); ctx.moveTo(x - 0.06, y + 0.03); ctx.lineTo(x, y - h); ctx.lineTo(x + 0.06, y + 0.03); ctx.closePath(); ctx.fillStyle = '#c3c7cf'; ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#7dff2a'; ctx.beginPath(); ctx.moveTo(0.18, -0.5); ctx.lineTo(0.24, -0.4); ctx.lineTo(0.18, -0.3); ctx.lineTo(0.12, -0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.18, -0.4, 0.2, '#8cff3a', 0.5); ctx.restore();
}
function drawHunterBody(ctx: CanvasRenderingContext2D, p: Player, g: Game, t: number, pose: Pose, held: Weapon, su: Suit | null) {
  ctx.save();
  ctx.scale(0.94, 1.2);
  if (p.spinT > 0) { const k = 1 - p.spinT / (p.special?.kind === 'spin' ? 0.45 : 0.42); ctx.translate(0, -0.95); ctx.rotate(k * TAU); ctx.translate(0, 0.95); } // vuelta en el aire del doble salto (y el giro especial)
  if (p.special?.kind === 'whirl') ctx.scale(Math.cos(p.special.t / 0.45 * TAU), 1); // el torbellino: gira sobre sí mismo
  if (p.special?.kind === 'dash') { ctx.translate(0, -0.1); ctx.rotate(0.35); } // la estocada: el cuerpo tirado hacia adelante
  if (p.landT > 0) ctx.scale(1 + p.landT * 0.6, 1 - p.landT * 0.8);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck: Pt = [Math.sin(pose.lean) * 0.52, hip[1] - Math.cos(pose.lean) * 0.52];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; if (p.onGround) { ctx.beginPath(); ctx.ellipse(0, 0.02, 0.5, 0.08, 0, 0, TAU); ctx.fill(); }
  if (su?.aura) suitAura(ctx, su.aura, t);
  cape(ctx, neck, HUNTER, t, Math.abs(p.vx), p.onGround ? 0 : 1, false);
  const backUp = handOf(hip, pose, 0)[1] < neck[1] + 0.05;
  // caminando o corriendo, el brazo del lado de atrás pasa por detrás del cuerpo (va al revés que su pierna)
  const walkArm = p.onGround && Math.abs(p.vx) > 0.15 && p.attackT < 0 && !p.special && !backUp;
  if (walkArm) armDraw(ctx, hip, pose, 0, HUNTER, 'none');
  legDraw(ctx, hip, pose, 0, HUNTER);
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); hunterTorso(ctx); if (su) suitChest(ctx, su, t); ctx.restore();
  if (!backUp && !walkArm) armDraw(ctx, hip, pose, 0, HUNTER, 'none'); // el brazo derecho va adelante del pecho (como en Kombat Football), así se ve
  pauldron(ctx, shoulderAt(hip, pose, 0), pose.arms[0][0], true);
  if (su?.shoulder) suitShoulder(ctx, su, shoulderAt(hip, pose, 0), true, t);
  legDraw(ctx, hip, pose, 1, HUNTER);
  const item: Weapon | 'none' = held === 'sword' && !g.boomer && !(p.attackT >= 0 && p.attackWeapon !== 'sword') ? 'sword' : 'none'; // (sin espada mientras vuela el bumerán)
  const hold = (hand: Pt, ang: number) => holdWeapon(ctx, p.attackT >= 0 ? p.attackWeapon : held, hand, ang, p, t);
  const frontUp = handOf(hip, pose, 1)[1] < neck[1] + 0.05;
  // la estela del tajo
  if (p.attackT >= 0.02 && p.attackT < 0.24 && SLASH_W.includes(p.attackWeapon)) {
    const k = Math.min(1, p.attackT / 0.14), e = 1 - (1 - k) * (1 - k), fade = p.attackT > 0.14 ? 1 - (p.attackT - 0.14) / 0.1 : 1, sp = shoulderAt(hip, pose, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const a0 = Math.PI / 2 - 3.0 - 0.4, a1 = Math.PI / 2 - (3.0 - e * 2.15) - 0.4;
    for (const [r, w, c] of [[1.65, 0.4, `rgba(255,255,255,${0.45 * fade})`], [1.6, 0.16, p.attackWeapon === 'violet' ? `rgba(190,80,255,${0.75 * fade})` : p.attackWeapon === 'bone' ? `rgba(240,220,170,${0.7 * fade})` : `rgba(255,80,80,${0.65 * fade})`], [1.3, 0.07, `rgba(255,220,220,${0.5 * fade})`]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(sp[0], sp[1], r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
    ctx.restore();
  }
  if (!frontUp) armDraw(ctx, hip, pose, 1, HUNTER, item, hold);
  pauldron(ctx, shoulderAt(hip, pose, 1), pose.arms[1][0], false, 1.1);
  if (su?.shoulder) suitShoulder(ctx, su, shoulderAt(hip, pose, 1), false, t);
  ctx.save(); ctx.translate(neck[0] + 0.04, neck[1] - 0.22); ctx.rotate(pose.head * 0.5); ctx.scale(0.49, 0.57); if (su?.head === 'hood') hoodBack(ctx); hunterHead(ctx, t, p.hurtT > 0); if (su?.head === 'gold') goldHelmet(ctx); else if (su?.head === 'hood') hoodFront(ctx); else if (su?.head === 'skull') skullHelmet(ctx); else if (su?.head === 'crown') venomCrown(ctx, t); ctx.restore();
  if (backUp) armDraw(ctx, hip, pose, 0, HUNTER, 'none');
  if (frontUp) armDraw(ctx, hip, pose, 1, HUNTER, item, hold);
  ctx.restore();
}
export function drawWalkerK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const pose = walkerPose(v, t);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck: Pt = [Math.sin(pose.lean) * 0.5, hip[1] - Math.cos(pose.lean) * 0.5];
  if (v.onGround) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.48, 0.08, 0, 0, TAU); ctx.fill(); }
  cape(ctx, neck, VAMP, t + v.id, Math.abs(v.vx) * 1.5, v.onGround ? 0 : 1, true);
  legDraw(ctx, hip, pose, 0, VAMP);
  armDraw(ctx, hip, pose, 0, VAMP, 'claw');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); vampTorso(ctx, t); ctx.restore();
  legDraw(ctx, hip, pose, 1, VAMP);
  const sp = shoulderAt(hip, pose, 1);
  shade(ctx, () => ctx.ellipse(sp[0], sp[1], 0.17, 0.13, 0.3, 0, TAU), '#2c2632', { x: sp[0] - 0.05, y: sp[1] - 0.06, r: 0.2, hi: 0.5, lw: 0.6 }); // hombrera con remaches
  ctx.fillStyle = '#9aa0ad'; for (const k of [-0.07, 0.07]) { ctx.beginPath(); ctx.arc(sp[0] + k, sp[1] - 0.05, 0.022, 0, TAU); ctx.fill(); }
  const up = handOf(hip, pose, 1)[1] < neck[1] + 0.05;
  if (!up) armDraw(ctx, hip, pose, 1, VAMP, 'claw');
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, v.state === 'claw' || !v.onGround, false); ctx.restore();
  if (up) armDraw(ctx, hip, pose, 1, VAMP, 'claw');
}
// Ala de murciélago enorme: hueso del brazo, cuatro dedos y la membrana roja festoneada entre ellos.
export function batWing(ctx: CanvasRenderingContext2D, flap: number, back: boolean) {
  const up = flap, wrist: Pt = [0.75, -0.55 - up * 0.65];
  const tips: Pt[] = [[1.55, -1.1 - up * 0.8], [1.75, -0.35 - up * 0.55], [1.5, 0.3 - up * 0.25], [0.95, 0.55 - up * 0.05]];
  const m0 = back ? '#7d0b14' : '#e01b28', m1 = back ? '#2e0408' : '#6e0810';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wrist[0], wrist[1]); ctx.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) { const [ax, ay] = tips[i - 1], [bx, by] = tips[i]; ctx.quadraticCurveTo((ax + bx) / 2 - 0.2, (ay + by) / 2 - 0.02, bx, by); }
  ctx.quadraticCurveTo(0.4, 0.4, 0.05, 0.12); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, -0.6, 1.6, 0.4, [[0, m0], [0.55, darken(m0, 0.25)], [1, m1]]); ctx.fill();
  ctx.strokeStyle = '#140608'; ctx.lineWidth = 0.035; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff6070'; ctx.beginPath(); ctx.moveTo(wrist[0], wrist[1]); ctx.lineTo(tips[0][0], tips[0][1]); ctx.lineTo(tips[1][0], tips[1][1]); ctx.closePath(); ctx.fill(); ctx.restore(); // la luz que pasa por la membrana
  // venitas de la membrana y los pliegues entre los dedos
  ctx.save(); ctx.clip();
  ctx.strokeStyle = back ? 'rgba(20,0,4,0.45)' : 'rgba(90,0,10,0.55)'; ctx.lineWidth = 0.008;
  for (let i = 0; i < tips.length - 1; i++) { const a2 = tips[i], b2 = tips[i + 1]; for (let k = 0.25; k < 1; k += 0.25) { const mx = wrist[0] + ((a2[0] + b2[0]) / 2 - wrist[0]) * k, my = wrist[1] + ((a2[1] + b2[1]) / 2 - wrist[1]) * k; ctx.beginPath(); ctx.moveTo(wrist[0] + (a2[0] - wrist[0]) * k, wrist[1] + (a2[1] - wrist[1]) * k); ctx.quadraticCurveTo(mx + 0.04, my + 0.05, wrist[0] + (b2[0] - wrist[0]) * k, wrist[1] + (b2[1] - wrist[1]) * k); ctx.stroke(); } }
  ctx.strokeStyle = back ? 'rgba(0,0,0,0.3)' : 'rgba(255,140,150,0.25)'; ctx.lineWidth = 0.02; for (const tp of tips) { ctx.beginPath(); ctx.moveTo(wrist[0], wrist[1]); ctx.lineTo(tp[0] * 0.97, tp[1] * 0.97 + 0.03); ctx.stroke(); }
  ctx.restore();
  const bone = back ? '#1c1418' : '#26202a';
  segment(ctx, [0, 0], wrist, 0.1, 0.07, bone, 0.4);
  for (const tp of tips.slice(0, 3)) segment(ctx, wrist, tp, 0.055, 0.03, bone, 0.3);
  ctx.fillStyle = back ? '#5a5d68' : '#c9ccd6'; for (const tp of tips.slice(0, 3)) { ctx.beginPath(); ctx.moveTo(tp[0] - 0.02, tp[1]); ctx.lineTo(tp[0] + 0.06, tp[1] + 0.04); ctx.lineTo(tp[0], tp[1] + 0.03); ctx.closePath(); ctx.fill(); } // uñitas en la punta de los dedos
  ctx.fillStyle = back ? '#7a7d88' : '#d4d7df'; ctx.beginPath(); ctx.moveTo(wrist[0] - 0.04, wrist[1] - 0.02); ctx.lineTo(wrist[0] + 0.02, wrist[1] - 0.2); ctx.lineTo(wrist[0] + 0.07, wrist[1] - 0.01); ctx.closePath(); ctx.fill(); // garra del ala
}
export function drawFlyerK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const diving = v.state === 'dive', flap = diving ? 0.85 : Math.sin(v.walkT * 9 + v.id);
  const pose: Pose = { bob: Math.sin(v.walkT * 9 + v.id + 1) * 0.04, lean: diving ? 0.7 : 0.35, crouch: 0, head: diving ? 0.3 : 0.1, legs: [[-0.7, 1.1], [-0.35, 1.25]], arms: diving ? [[1.5, 0.15], [1.7, 0.1]] : [[1.2, 0.4], [1.45, 0.3]], blade: 0 };
  const hip: Pt = [0, -0.25 + pose.bob], neck: Pt = [Math.sin(pose.lean) * 0.5, hip[1] - Math.cos(pose.lean) * 0.5];
  const sb = shoulderAt(hip, pose, 0);
  ctx.save(); ctx.translate(sb[0] - 0.05, sb[1] + 0.05); ctx.scale(-1, 1); ctx.rotate(-0.15); batWing(ctx, flap, true); ctx.restore();
  legDraw(ctx, hip, pose, 0, VAMP);
  armDraw(ctx, hip, pose, 0, VAMP, 'claw');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); vampTorso(ctx, t); ctx.restore();
  legDraw(ctx, hip, pose, 1, VAMP);
  const sf = shoulderAt(hip, pose, 1);
  ctx.save(); ctx.translate(sf[0] - 0.1, sf[1] + 0.02); ctx.rotate(-0.2); batWing(ctx, flap * 0.95, false); ctx.restore();
  armDraw(ctx, hip, pose, 1, VAMP, 'claw');
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, true, true); ctx.restore();
}

// ---------------------------------------------------------------- El esqueleto que arde (al morir)
export function boneSeg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number) {
  segment(ctx, a, b, w, w * 0.85, '#efe6d0', 0.5);
  for (const p of [a, b]) shade(ctx, () => { ctx.arc(p[0] - w * 0.25, p[1], w * 0.42, 0, TAU); ctx.moveTo(p[0] + w * 0.67, p[1]); ctx.arc(p[0] + w * 0.25, p[1], w * 0.42, 0, TAU); }, '#f4ecd8', { x: p[0], y: p[1] - w * 0.2, r: w, lw: 0.5 });
}
// El esqueleto que queda cuando el vampiro se quema: huesos de verdad (cráneo con mandíbula, columna con vértebras,
// costillas, esternón, clavículas, pelvis, fémur, tibia y peroné, húmero, radio y cúbito, manos y pies con
// falanges), con el tamaño y la forma de cada uno: el gigante ancho y de huesos gruesos, el volador con los huesos
// de las alas y el hombre lobo en cuatro patas con hocico y cola.
const B_LT = '#f3ead2', B_MD = '#d2c09a', B_DK = '#8d7650', B_INK = '#24170c';
function boneShaft(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n: Pt = [-dy / l, dx / l];
  const g = ctx.createLinearGradient(a[0] + n[0] * w, a[1] + n[1] * w, a[0] - n[0] * w, a[1] - n[1] * w); g.addColorStop(0, B_LT); g.addColorStop(0.55, B_MD); g.addColorStop(1, B_DK);
  const m = 0.42; // la diáfisis más finita que las puntas
  ctx.beginPath(); ctx.moveTo(a[0] + n[0] * w * 0.7, a[1] + n[1] * w * 0.7);
  ctx.quadraticCurveTo((a[0] + b[0]) / 2 + n[0] * w * m, (a[1] + b[1]) / 2 + n[1] * w * m, b[0] + n[0] * w * 0.7, b[1] + n[1] * w * 0.7);
  ctx.lineTo(b[0] - n[0] * w * 0.7, b[1] - n[1] * w * 0.7);
  ctx.quadraticCurveTo((a[0] + b[0]) / 2 - n[0] * w * m, (a[1] + b[1]) / 2 - n[1] * w * m, a[0] - n[0] * w * 0.7, a[1] - n[1] * w * 0.7); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = B_INK; ctx.lineWidth = w * 0.22; ctx.stroke();
  for (const [p, d] of [[a, 1], [b, -1]] as const) { // las cabezas del hueso (dos bultitos)
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(p[0] + n[0] * w * 0.42 * sgn + dx / l * w * 0.15 * d, p[1] + n[1] * w * 0.42 * sgn + dy / l * w * 0.15 * d, w * 0.5, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.stroke(); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = w * 0.14; ctx.beginPath(); ctx.moveTo(a[0] + n[0] * w * 0.3 + dx * 0.15, a[1] + n[1] * w * 0.3 + dy * 0.15); ctx.lineTo(a[0] + n[0] * w * 0.25 + dx * 0.8, a[1] + n[1] * w * 0.25 + dy * 0.8); ctx.stroke(); // brillo
}
function vertebra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = B_MD; ctx.strokeStyle = B_INK; ctx.lineWidth = h * 0.18;
  ctx.beginPath(); ctx.moveTo(-w * 1.1, 0); ctx.lineTo(-w * 0.4, -h * 0.25); ctx.lineTo(w * 0.4, -h * 0.25); ctx.lineTo(w * 1.1, 0); ctx.lineTo(w * 0.4, h * 0.2); ctx.lineTo(-w * 0.4, h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); // apófisis
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, B_LT); g.addColorStop(1, B_DK);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.3); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function boneHand(ctx: CanvasRenderingContext2D, wrist: Pt, dir: Pt, size: number, wob: number) {
  ctx.fillStyle = B_MD; ctx.strokeStyle = B_INK; ctx.lineWidth = size * 0.08;
  ctx.beginPath(); ctx.ellipse(wrist[0] + dir[0] * size * 0.25, wrist[1] + dir[1] * size * 0.25, size * 0.22, size * 0.16, Math.atan2(dir[1], dir[0]), 0, TAU); ctx.fill(); ctx.stroke(); // los huesitos de la muñeca
  ctx.lineCap = 'round';
  for (let f = 0; f < 4; f++) {
    const sp = (f - 1.5) * 0.28 + wob * 0.3, d: Pt = [dir[0] * Math.cos(sp) - dir[1] * Math.sin(sp), dir[0] * Math.sin(sp) + dir[1] * Math.cos(sp)];
    let p: Pt = [wrist[0] + dir[0] * size * 0.38, wrist[1] + dir[1] * size * 0.38];
    for (let k = 0; k < 3; k++) { const l = size * (0.32 - k * 0.07), q: Pt = [p[0] + d[0] * l, p[1] + d[1] * l]; ctx.strokeStyle = B_INK; ctx.lineWidth = size * 0.13; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.strokeStyle = k === 2 ? '#fff7e6' : B_LT; ctx.lineWidth = size * 0.07; ctx.stroke(); p = q; }
  }
}
function boneSkull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, eyes: number, snout = 0) {
  const jaw = 0.04 + Math.abs(Math.sin(t * 22)) * 0.1; // la mandíbula que castañetea
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  const g = ctx.createRadialGradient(-0.25, -0.35, 0.1, 0, 0, 1.1); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, B_LT); g.addColorStop(1, B_DK);
  // la mandíbula (atrás, abierta)
  ctx.save(); ctx.translate(-0.1, 0.35); ctx.rotate(jaw);
  ctx.beginPath(); ctx.moveTo(-0.35, -0.1); ctx.lineTo(-0.3, 0.35); ctx.quadraticCurveTo(0.2, 0.5, 0.62 + snout, 0.32); ctx.lineTo(0.62 + snout, 0.15); ctx.lineTo(0.1, 0.18); ctx.lineTo(-0.1, -0.1); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = B_INK; ctx.lineWidth = 0.07; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; for (let i = 0; i < 6; i++) { const tx = 0.12 + i * (0.08 + snout * 0.08); ctx.beginPath(); ctx.moveTo(tx, 0.17); ctx.lineTo(tx + 0.03, (i === 4 ? 0.0 : 0.08)); ctx.lineTo(tx + 0.06, 0.17); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.025; ctx.stroke(); }
  ctx.restore();
  // el cráneo: bóveda, pómulo y maxilar (con hocico largo si es lobo)
  ctx.beginPath(); ctx.moveTo(-0.62, 0.1); ctx.bezierCurveTo(-0.75, -0.75, 0.55, -0.95, 0.62, -0.2); ctx.lineTo(0.66 + snout, 0.1 - snout * 0.15); ctx.quadraticCurveTo(0.72 + snout, 0.35, 0.6 + snout, 0.42); ctx.lineTo(0.05, 0.45); ctx.lineTo(-0.2, 0.3); ctx.quadraticCurveTo(-0.5, 0.35, -0.62, 0.1); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = B_INK; ctx.lineWidth = 0.07; ctx.stroke();
  ctx.strokeStyle = 'rgba(80,55,25,0.55)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.3, -0.62); ctx.quadraticCurveTo(-0.15, -0.45, -0.28, -0.3); ctx.moveTo(0.05, 0.05); ctx.quadraticCurveTo(-0.15, 0.12, -0.35, 0.05); ctx.stroke(); // suturas y el arco del pómulo
  // las órbitas hondas, con el brillo rojo de los ojos
  for (const [ex, ey, er] of [[0.28, -0.12, 0.2], [-0.02, -0.1, 0.13]] as const) {
    const og = ctx.createRadialGradient(ex, ey, 0.02, ex, ey, er); og.addColorStop(0, '#000'); og.addColorStop(1, '#3a2614');
    ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.85, er, 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = B_INK; ctx.lineWidth = 0.04; ctx.stroke();
    if (eyes > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, ex, ey, er * 1.6, '#ff3a1a', 0.75 * eyes); ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.arc(ex + 0.02, ey, er * 0.22, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  ctx.fillStyle = '#120a04'; ctx.beginPath(); ctx.moveTo(0.48 + snout, 0.08); ctx.lineTo(0.42 + snout, 0.24); ctx.lineTo(0.56 + snout, 0.24); ctx.closePath(); ctx.fill(); // la nariz
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = B_INK; ctx.lineWidth = 0.025;
  for (let i = 0; i < 6; i++) { const tx = 0.08 + i * (0.08 + snout * 0.08), fang = i === 4; ctx.beginPath(); ctx.moveTo(tx, 0.42); ctx.lineTo(tx + 0.03, fang ? 0.68 : 0.52); ctx.lineTo(tx + 0.06, 0.42); ctx.closePath(); ctx.fill(); ctx.stroke(); } // dientes y colmillos
  ctx.restore();
}
function ribCage(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, n = 7, horizontal = false) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), y = top + k * h * 0.8, rw = w * (0.75 + Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.6) * 0.35), drop = h * (0.12 + k * 0.08);
    for (const sgn of [-1, 1]) {
      const path = () => { ctx.beginPath(); if (horizontal) { ctx.moveTo(cx + (k - 0.5) * w * 1.6, top); ctx.quadraticCurveTo(cx + (k - 0.5) * w * 1.6 + 0.1, top + h * 0.6, cx + (k - 0.5) * w * 1.4, top + h * (0.95 - Math.abs(k - 0.5) * 0.5)); } else { ctx.moveTo(cx, y); ctx.bezierCurveTo(cx + sgn * rw * 0.7, y - drop * 0.6, cx + sgn * rw, y + drop * 0.5, cx + sgn * rw * 0.55, y + drop * 1.4); } };
      path(); ctx.strokeStyle = B_INK; ctx.lineWidth = w * 0.11; ctx.stroke(); path(); ctx.strokeStyle = B_MD; ctx.lineWidth = w * 0.07; ctx.stroke(); path(); ctx.strokeStyle = 'rgba(255,250,235,0.7)'; ctx.lineWidth = w * 0.025; ctx.stroke();
      if (horizontal) break;
    }
  }
  if (!horizontal) { ctx.fillStyle = B_LT; ctx.strokeStyle = B_INK; ctx.lineWidth = w * 0.03; ctx.beginPath(); ctx.roundRect(cx - w * 0.06, top - h * 0.04, w * 0.12, h * 0.72, w * 0.05); ctx.fill(); ctx.stroke(); } // el esternón
}
export function drawSkeletonK(ctx: CanvasRenderingContext2D, flyer: boolean, t: number, eyes: number, kind: string = flyer ? 'flyer' : 'walker') {
  if (atlasReady('details')) {
    const index = kind === 'dragon' ? 5 : kind === 'wolf' ? 4 : flyer || kind === 'flyer' ? 3 : 2;
    ctx.save(); ctx.rotate(Math.sin(Math.floor(t * 12) * .9) * .035);
    drawAsset(ctx, 'details', index, kind === 'dragon' ? -2.2 : -.45, -2, kind === 'dragon' ? 4.4 : .9, 2); ctx.restore(); return;
  }
  const wob = Math.sin(t * 40) * 0.2;
  if (kind === 'wolf') { // en cuatro patas: columna horizontal, costillas colgando, hocico largo y cola
    ctx.save(); ctx.scale(0.6, 0.9); try { wolfSkeleton(ctx, t, eyes, wob); } finally { ctx.restore(); }
    return;
  }
  humanSkeleton(ctx, flyer, t, eyes, kind, wob);
}
function wolfSkeleton(ctx: CanvasRenderingContext2D, t: number, eyes: number, wob: number) {
  {
    const sy = -1.0;
    for (let i = 0; i < 9; i++) { const k = i / 8, x = -1.55 - k * 0.55, y = sy - 0.1 - Math.sin(k * 1.6) * 0.55; vertebra(ctx, x, y, 0.09 - k * 0.04, 0.07 - k * 0.025, -0.6); } // la cola
    for (const [hx, back] of [[-0.75, true], [0.55, true], [-0.6, false], [0.7, false]] as const) { // las patas (las de atrás más oscuras)
      ctx.save(); if (back) ctx.globalAlpha = 0.75;
      const hip: Pt = [hx, sy + 0.05], kn: Pt = hx < 0 ? [hx + 0.22, sy + 0.5] : [hx - 0.05, sy + 0.48], an: Pt = hx < 0 ? [hx - 0.08, sy + 0.82] : [hx + 0.02, sy + 0.88], ft: Pt = [an[0] + 0.05, 0];
      boneShaft(ctx, hip, kn, 0.12); boneShaft(ctx, kn, an, 0.09); boneShaft(ctx, an, ft, 0.07); boneHand(ctx, ft, [1, 0], 0.32, wob);
      ctx.restore();
    }
    ribCage(ctx, -0.1, sy + 0.05, 0.75, 0.75, 9, true);
    for (let i = 0; i < 14; i++) vertebra(ctx, -1.5 + i * 0.16, sy - 0.02 - Math.sin(i / 13 * Math.PI) * 0.12, 0.14, 0.11);
    // la pelvis y los omóplatos
    ctx.fillStyle = B_MD; ctx.strokeStyle = B_INK; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.ellipse(-0.8, sy + 0.02, 0.32, 0.16, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.62, sy - 0.05, 0.12, 0.3, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) vertebra(ctx, 0.95 + i * 0.12, sy - 0.15 - i * 0.1, 0.12, 0.1, -0.7); // el cuello
    boneSkull(ctx, 1.4, sy - 0.45, 0.34, t, eyes, 0.55);
  }
}
function humanSkeleton(ctx: CanvasRenderingContext2D, flyer: boolean, t: number, eyes: number, kind: string, wob: number) {
  // humanoide: más ancho y de huesos más gruesos el gigante
  const big = kind === 'giant' ? 1.45 : kind === 'hammer' || kind === 'warrior' ? 1.12 : kind === 'dracula' ? 1.05 : 1, W = big, th = Math.sqrt(big);
  const hipY = flyer ? -0.5 : -0.98, shY = hipY - 0.66, neckY = shY - 0.08;
  if (kind === 'flyer') for (const sgn of [-1, 1]) { // los huesos de las alas (como dedos larguísimos)
    const root: Pt = [sgn * 0.25, shY + 0.05], el: Pt = [sgn * 0.75, shY - 0.35], wr: Pt = [sgn * 1.15, shY - 0.2];
    ctx.save(); ctx.globalAlpha = 0.85; boneShaft(ctx, root, el, 0.06); boneShaft(ctx, el, wr, 0.05);
    for (let f = 0; f < 4; f++) { const a = -0.9 + f * 0.55; boneShaft(ctx, wr, [wr[0] + sgn * Math.cos(a) * 0.7, wr[1] + Math.sin(a) * 0.7 + 0.2], 0.03); } ctx.restore();
  }
  // las piernas: fémur, rótula, tibia y peroné, y el pie
  for (const sgn of [-1, 1]) {
    const back = sgn < 0; ctx.save(); if (back) ctx.globalAlpha = 0.8;
    const hp: Pt = [sgn * 0.13 * W, hipY + 0.04], kn: Pt = [sgn * 0.14 * W + 0.02, hipY + (flyer ? 0.25 : 0.5)], an: Pt = [sgn * 0.15 * W, flyer ? hipY + 0.5 : -0.08];
    boneShaft(ctx, hp, kn, 0.085 * th);
    boneShaft(ctx, [kn[0] - 0.035, kn[1]], [an[0] - 0.03, an[1]], 0.035 * th); // peroné
    boneShaft(ctx, [kn[0] + 0.02, kn[1]], [an[0] + 0.015, an[1]], 0.066 * th); // tibia
    ctx.fillStyle = B_LT; ctx.strokeStyle = B_INK; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.ellipse(kn[0] + 0.05, kn[1] - 0.02, 0.04 * th, 0.055 * th, 0, 0, TAU); ctx.fill(); ctx.stroke(); // rótula
    if (!flyer) { ctx.fillStyle = B_MD; ctx.beginPath(); ctx.ellipse(an[0] + 0.02, an[1] + 0.03, 0.08 * th, 0.05, 0, 0, TAU); ctx.fill(); ctx.stroke(); boneHand(ctx, [an[0] + 0.05, an[1] + 0.05], [1, 0.12], 0.3 * th, 0); }
    ctx.restore();
  }
  // la pelvis: las dos alas del hueso ilíaco con sus agujeros y el sacro
  ctx.save(); ctx.translate(0, hipY); ctx.scale(W, 1);
  const pg = ctx.createLinearGradient(0, -0.16, 0, 0.12); pg.addColorStop(0, B_LT); pg.addColorStop(1, B_DK);
  ctx.beginPath(); ctx.moveTo(0, -0.04); ctx.bezierCurveTo(-0.12, -0.2, -0.3, -0.2, -0.27, -0.04); ctx.quadraticCurveTo(-0.25, 0.08, -0.12, 0.12); ctx.lineTo(0, 0.08); ctx.lineTo(0.12, 0.12); ctx.quadraticCurveTo(0.25, 0.08, 0.27, -0.04); ctx.bezierCurveTo(0.3, -0.2, 0.12, -0.2, 0, -0.04); ctx.closePath();
  ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = B_INK; ctx.lineWidth = 0.02; ctx.stroke();
  ctx.fillStyle = '#1a0e06'; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * 0.13, 0.05, 0.045, 0.035, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  // la columna (lumbar) y el tórax
  for (let i = 0; i < 4; i++) vertebra(ctx, 0, hipY - 0.1 - i * 0.065, 0.075 * th, 0.05);
  ribCage(ctx, 0, shY + 0.07, 0.24 * W, 0.42, 7);
  for (let i = 0; i < 3; i++) vertebra(ctx, 0.01, neckY - i * 0.055, 0.06 * th, 0.042); // el cuello
  // clavículas y brazos (húmero, radio y cúbito, la mano con falanges que tiembla)
  for (const sgn of [-1, 1]) {
    const back = sgn < 0; ctx.save(); if (back) ctx.globalAlpha = 0.85;
    const sh: Pt = [sgn * 0.27 * W, shY + 0.02], el: Pt = [sgn * 0.33 * W, shY + 0.34], wr: Pt = [sgn * 0.36 * W + 0.06, shY + 0.62 + (sgn > 0 ? wob * 0.15 : 0)];
    boneShaft(ctx, [0.02, shY - 0.02], sh, 0.035 * th);
    boneShaft(ctx, sh, el, 0.07 * th);
    boneShaft(ctx, [el[0] - 0.025, el[1]], [wr[0] - 0.025, wr[1]], 0.035 * th); boneShaft(ctx, [el[0] + 0.02, el[1]], [wr[0] + 0.02, wr[1]], 0.04 * th);
    boneHand(ctx, wr, [0.25 * sgn, 1], 0.26 * th, wob);
    ctx.restore();
  }
  const skR = 0.27 * (big > 1.3 ? 1.1 : 1);
  boneSkull(ctx, 0.04, neckY - 0.16 - skR * 0.5, skR, t, eyes);
  if (kind === 'giant') for (const sgn of [-1, 1]) { ctx.fillStyle = B_LT; ctx.strokeStyle = B_INK; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.04 + sgn * 0.12, neckY - 0.42); ctx.quadraticCurveTo(0.04 + sgn * 0.3, neckY - 0.55, 0.04 + sgn * 0.26, neckY - 0.72); ctx.quadraticCurveTo(0.04 + sgn * 0.2, neckY - 0.52, 0.04 + sgn * 0.04, neckY - 0.46); ctx.closePath(); ctx.fill(); ctx.stroke(); } // los cuernitos
}
// Llamas que le salen de todo el cuerpo (como la gente que se prende fuego en "El piso es de lava").
export function bodyFire(ctx: CanvasRenderingContext2D, hgt: number, wid: number, k: number, t: number, seed: number) {
  if (fireLight(ctx, 0, 0, wid * 1.3, hgt * (1 + k * .5), t, seed)) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -hgt * 0.55, 0, 0, -hgt * 0.55, hgt * (1.2 + k));
  g.addColorStop(0, `rgba(255,150,40,${0.5 + 0.2 * Math.sin(t * 20 + seed)})`); g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g; ctx.fillRect(-hgt * 2.4, -hgt * 2.6, hgt * 4.8, hgt * 4.8);
  ctx.restore();
  for (let i = 0; i < 44; i++) {
    const h1 = (Math.sin(i * 12.9898 + seed) * 43758.5453) % 1, h = Math.abs(h1), h2 = Math.abs((Math.sin(i * 78.233 + seed) * 43758.5453) % 1);
    const life = (t * (1.6 + h * 0.8) + h2) % 1;
    const fx = (h2 - 0.5) * wid * 1.6 + Math.sin(t * 9 + i) * wid * 0.12, fy = -hgt * (0.05 + 0.92 * h) - life * hgt * (0.5 + k * 0.7);
    const r = wid * 0.2 * ((1 - life) * 0.8 + 0.2) * (0.7 + k * 0.9);
    ctx.fillStyle = life < 0.25 ? `rgba(254,240,138,${1 - life})` : life < 0.6 ? `rgba(251,146,60,${0.95 - life})` : `rgba(220,38,38,${0.9 - life})`;
    ctx.beginPath(); ctx.moveTo(fx - r, fy); ctx.quadraticCurveTo(fx - r * 0.3, fy - r * 2.2, fx, fy - r * 2.7); ctx.quadraticCurveTo(fx + r * 0.3, fy - r * 2.2, fx + r, fy); ctx.arc(fx, fy, r, 0, Math.PI); ctx.fill();
  }
  for (let i = 0; i < 4; i++) { const q = (t * 0.8 + i / 4) % 1; ctx.fillStyle = `rgba(40,34,34,${0.4 * (1 - q)})`; ctx.beginPath(); ctx.arc(Math.sin(t * 2 + i) * wid * 0.5, -hgt * (1.05 + q * 0.8), wid * (0.25 + q * 0.6), 0, TAU); ctx.fill(); } // humo negro
}
