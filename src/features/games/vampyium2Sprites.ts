import metadata from './assets/vampyium2/atlas.json';
import type { Game, Player, Vamp, Weapon } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { ATTACK } from './vampyium2';
import { jointTransform, legAngles, walkingArm } from './vampyium2Gait';
import { DEMIAN_SCALE, demianWalk } from './vampyium2Demian';
import { inertia, inertiaPt } from './vampyium2Inertia';
import { DRAGON, DRAGON_DRAW, DRAGON_WING_DOWN, dragonWing, ease01, vampireRigPose, VAMP_BOOT, VAMP_VISUAL_SCALE, WOLF_QUAD, wolfQuadPose } from './vampyium2Motion';

type Frame = { x: number; y: number; w: number; h: number };
type Atlas = { cols: number; rows: number; width: number; height: number; frames: Frame[] };
const META: Record<string, Atlas> = metadata;
const URLS = import.meta.glob('./assets/vampyium2/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const images: Record<string, HTMLImageElement> = {};
const materialVariants = new Map<string, HTMLCanvasElement>();
let revision = 0;
export function artRevision() { preloadRealisticArt(); return revision; }
export function preloadRealisticArt() {
  if (typeof Image === 'undefined') return;
  for (const name of Object.keys(META)) {
    if (images[name]) continue;
    const image = new Image(); images[name] = image;
    image.onload = () => { revision++; }; image.src = URLS[`./assets/vampyium2/${name}.webp`];
  }
}
export function atlasReady(name: string) {
  preloadRealisticArt(); return !!images[name]?.complete && images[name].naturalWidth > 0;
}
export async function waitForRealisticArt() {
  preloadRealisticArt();
  await Promise.all(Object.values(images).map(image => new Promise<void>((resolve, reject) => {
    if (image.complete) { if (image.naturalWidth > 0) resolve(); else reject(new Error('Character atlas failed to load')); return; }
    const cleanup = () => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Character atlas failed to load')); };
    image.addEventListener('load', loaded, { once: true }); image.addEventListener('error', failed, { once: true });
  })));
  return Object.keys(META).every(atlasReady);
}
export function realisticArtStatus() {
  return Object.entries(META).map(([name, atlas]) => ({ name, ready: atlasReady(name), frames: atlas.frames.length }));
}
export function drawAsset(ctx: CanvasRenderingContext2D, name: string, index: number, x: number, y: number, w: number, h: number, tint?: string, cropLeft = 0) {
  if (!atlasReady(name) || !META[name]?.frames[index] || w <= 0 || h <= 0) return false;
  const f = META[name].frames[index];
  let source: HTMLImageElement | HTMLCanvasElement = images[name];
  if (tint) {
    const key = `${name}:${index}:${tint}`;
    if (!materialVariants.has(key)) {
      const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
      const c = canvas.getContext('2d')!; c.drawImage(images[name], f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .24; c.fillStyle = tint; c.fillRect(0, 0, canvas.width, canvas.height);
      materialVariants.set(key, canvas);
    }
    source = materialVariants.get(key)!;
  }
  ctx.drawImage(source, (tint ? 0 : f.x) + f.w * cropLeft, tint ? 0 : f.y, f.w * (1 - cropLeft), f.h, x, y, w, h); return true;
}
export function assetAspect(name: string, index: number) {
  const frame = META[name]?.frames[index]; return frame ? frame.w / frame.h : 1;
}
// A copy of an atlas cell without the stray bits of the neighbouring drawings (keeps the body and big pieces).
const cleanFrames = new Map<string, HTMLCanvasElement | null>();
function cleanFrame(name: string, index: number) {
  const key = `${name}:${index}`;
  if (cleanFrames.has(key)) return cleanFrames.get(key)!;
  const f = META[name]?.frames[index]; if (!f || !atlasReady(name)) return null;
  const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) { cleanFrames.set(key, null); return null; }
  c.drawImage(images[name], f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  try {
    const data = c.getImageData(0, 0, f.w, f.h), d = data.data, n = f.w * f.h, label = new Int32Array(n), sizes: number[] = [0];
    for (let start = 0; start < n; start++) {
      if (label[start] || d[start * 4 + 3] < 24) continue;
      const id = sizes.length, stack = [start]; label[start] = id; let size = 0;
      while (stack.length) {
        const q = stack.pop()!; size++;
        const x = q % f.w, y = (q - x) / f.w;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
          const r = ny * f.w + nx; if (!label[r] && d[r * 4 + 3] >= 24) { label[r] = id; stack.push(r); }
        }
      }
      sizes.push(size);
    }
    const keep = Math.max(...sizes) * .1;
    for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 0 && (!label[i] || sizes[label[i]] < keep)) {
      // faint pixels next to a kept piece stay (antialiasing); the rest goes
      const x = i % f.w, near = [i - 1, i + 1, i - f.w, i + f.w].some(r => r >= 0 && r < n && Math.abs((r % f.w) - x) <= 1 && label[r] && sizes[label[r]] >= keep);
      if (!near) d[i * 4 + 3] = 0;
    }
    c.putImageData(data, 0, 0);
  } catch { /* (sin acceso a los píxeles: queda el original) */ }
  cleanFrames.set(key, canvas); return canvas;
}
// A darkened, bronze-trimmed copy of a painted hunter piece, for the vampires' armor (computed once per piece).
const ironVariants = new Map<string, HTMLCanvasElement | null>();
function ironVariant(index: number) {
  const key = `hunter:${index}`;
  if (ironVariants.has(key)) return ironVariants.get(key)!;
  const f = META.hunter?.frames[index]; if (!f || !atlasReady('hunter')) return null;
  const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) { ironVariants.set(key, null); return null; }
  c.drawImage(images.hunter, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  try {
    const data = c.getImageData(0, 0, f.w, f.h), d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], lum = .3 * r + .59 * g + .11 * b, gold = Math.max(0, r - b) / 255;
      d[i] = lum * (.42 + gold * .35) + 8; d[i + 1] = lum * (.40 + gold * .22) + 6; d[i + 2] = lum * (.40 + gold * .02) + 6;
    }
    c.putImageData(data, 0, 0);
  } catch { /* (sin acceso a los píxeles: queda el original) */ }
  ironVariants.set(key, canvas); return canvas;
}
// Armor over a joint (knee or elbow cop, shoulder plate): the painted lamé plate, on the outside of the bend,
// with its lames running down the lower bone. It covers the seam between the two cutouts while the limb bends.
export type Metal = 'gilt' | 'iron';
export function jointArmor(ctx: CanvasRenderingContext2D, joint: Pt, upper: Pt, lower: Pt, size: number, metal: Metal, fallback: Pt = [1, 0], index = 16) {
  if (!atlasReady('hunter')) return;
  const unit = (v: Pt): Pt => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const ua = unit([upper[0] - joint[0], upper[1] - joint[1]]), ub = unit([lower[0] - joint[0], lower[1] - joint[1]]);
  let out: Pt = [-(ua[0] + ub[0]), -(ua[1] + ub[1])];
  out = Math.hypot(out[0], out[1]) < .08 ? fallback : unit(out);
  const angle = -Math.atan2(ub[0], ub[1]); // local +y runs down the lower bone
  const side = Math.sign(out[0] * Math.cos(angle) + out[1] * Math.sin(angle)) || 1;
  const f = META.hunter.frames[index], w = size * f.w / f.h, h = size;
  ctx.save(); ctx.translate(joint[0] + out[0] * size * .2, joint[1] + out[1] * size * .2); ctx.rotate(angle); ctx.scale(-side, 1);
  if (metal === 'iron') { const v = ironVariant(index); if (v) ctx.drawImage(v, -w * .5, -h * .38, w, h); }
  else hunterPiece(ctx, index, -w * .5, -h * .38, w, h);
  ctx.restore();
}

// ---- Demian's armours (the six suits of Vampyrium, painted over the same armour pieces) --------------------------
// Each painted piece is recoloured by what its pixel is: silver plate, gold trim or red cloth, through the suit's
// dark → mid → light ramp. Same pieces, same joints and poses: only the armour changes.
type Ramp = [string, string, string];
const SUIT_RAMPS: Record<string, { metal: Ramp; trim: Ramp; cloth: Ramp }> = { // real metals, not flat colours
  ice: { metal: ['#121c2c', '#5f7fa8', '#e8f1fa'], trim: ['#6a7888', '#cfd8e2', '#ffffff'], cloth: ['#0e1a33', '#2a4f8a', '#8fb0dc'] },
  holy: { metal: ['#3a2608', '#b8892a', '#fbe7a8'], trim: ['#5a3c10', '#e9c35a', '#fff6d0'], cloth: ['#3a0608', '#9c1a1e', '#e06a62'] },
  venom: { metal: ['#08090a', '#30363a', '#a9b3b8'], trim: ['#163a12', '#5f9a3a', '#cfe8b0'], cloth: ['#0c2410', '#2f6a2a', '#9ccc80'] },
  violet: { metal: ['#100c16', '#4a3c5e', '#ddd2ea'], trim: ['#3a2650', '#9a7ac0', '#efe2ff'], cloth: ['#1e0a2e', '#5a2a86', '#c8a0e8'] },
  guard: { metal: ['#6a665e', '#d8d4cc', '#ffffff'], trim: ['#6a4a14', '#d4a540', '#fff0b8'], cloth: ['#7a756c', '#e2ded6', '#ffffff'] },
  bone: { metal: ['#0c0a09', '#2e2925', '#9a9086'], trim: ['#7a6a50', '#d8c8a4', '#fff4dc'], cloth: ['#2a0504', '#8e1c18', '#d8584a'] },
};
const KEEP_COLOURS = new Set([0, 13, 18]); // the old head, the skull helmet (already bone) and the sword
const step01 = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const suitVariants = new Map<string, HTMLCanvasElement | null>();
function suitVariant(key: string, index: number) {
  const id = `${key}:${index}`;
  if (suitVariants.has(id)) return suitVariants.get(id)!;
  const f = META.hunter?.frames[index], ramps = SUIT_RAMPS[key]; if (!f || !ramps || !atlasReady('hunter')) return null;
  const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) { suitVariants.set(id, null); return null; }
  c.drawImage(images.hunter, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  try {
    const R = { metal: ramps.metal.map(hex), trim: ramps.trim.map(hex), cloth: ramps.cloth.map(hex) };
    const data = c.getImageData(0, 0, f.w, f.h), d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2], l = Math.max(0, Math.min(1, ((.3 * r + .59 * g + .11 * b) / 255 - .08) / .86));
      // soft weights (no speckles): the warm silver has r−b ≈ 20…50, the gold ≈ 75…115, the red velvet r−g ≈ 70+
      const cloth = step01(55, 85, r - g), trim = (1 - cloth) * step01(58, 95, r - b), metalW = 1 - cloth - trim;
      const at = (ramp: number[][], c: number) => { const k = l < .5 ? l / .5 : (l - .5) / .5, a0 = ramp[l < .5 ? 0 : 1], a1 = ramp[l < .5 ? 1 : 2]; return a0[c] + (a1[c] - a0[c]) * k; };
      for (let c = 0; c < 3; c++) d[i + c] = (at(R.metal, c) * metalW + at(R.trim, c) * trim + at(R.cloth, c) * cloth) * .88 + d[i + c] * .12; // (a little of the original paint)
    }
    c.putImageData(data, 0, 0);
  } catch { /* (sin acceso a los píxeles: queda el original) */ }
  suitVariants.set(id, canvas); return canvas;
}
let wornSuit: string | null = null; // the armour of the hunter being drawn right now
function hunterPiece(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, w: number, h: number, tint?: string, cropLeft = 0) {
  const v = wornSuit && !KEEP_COLOURS.has(id) ? suitVariant(wornSuit, id) : null;
  if (!v) return drawAsset(ctx, 'hunter', id, x, y, w, h, tint, cropLeft);
  ctx.drawImage(v, v.width * cropLeft, 0, v.width * (1 - cropLeft), v.height, x, y, w, h); return true;
}

const add = (a: Pt, angle: number, l: number): Pt => [a[0] + Math.sin(angle) * l, a[1] + Math.cos(angle) * l];
function part(ctx: CanvasRenderingContext2D, id: number, center: Pt, w: number, h: number, angle = 0, tint?: string, cropLeft = 0) {
  ctx.save(); ctx.translate(...center); ctx.rotate(angle);
  hunterPiece(ctx, id, -w / 2, -h / 2, w, h, tint, cropLeft); ctx.restore();
}
function limb(ctx: CanvasRenderingContext2D, id: number, start: Pt, end: Pt, width: number) {
  // The painted upper arm and thigh are oblique. Their bone axes are NOT the image's vertical axis.
  const anchors: Record<number, [Pt, Pt]> = {
    3: [[.70, .12], [.30, .85]], 4: [[.60, .12], [.23, .91]],
    6: [[.55, .13], [.62, .87]], 7: [[.57, .12], [.45, .92]],
  };
  const [proximal, distal] = anchors[id];
  const m = jointTransform(start, end, proximal, distal, assetAspect('hunter', id), width);
  ctx.save(); ctx.translate(...start); ctx.rotate(m.angle);
  hunterPiece(ctx, id, -proximal[0] * m.width, -proximal[1] * m.height, m.width, m.height);
  ctx.restore();
}
type WeaponPainter = (hand: Pt, angle: number) => void;
// The photo head (crown to neck stub), a little larger than the old painted head but in proportion with the body.
export const DEMIAN_FACE = { h: .35, w: .35 * 380 / 535 };
export { DEMIAN_SCALE };

// Input-driven articulated poses keep hands, weapon and shoulder plates attached throughout each action.
export interface HunterDecor { key: string }
export function drawRealisticHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, pose: Pose, t: number, paintWeapon: WeaponPainter, decor: HunterDecor | null = null) {
  if (!atlasReady('hunter')) return false;
  wornSuit = decor?.key ?? null;
  try { return paintHunter(ctx, p, g, pose, t, paintWeapon, decor); } finally { wornSuit = null; }
}
function paintHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, pose: Pose, t: number, paintWeapon: WeaponPainter, decor: HunterDecor | null) {
  const rt = t;
  // Pose inertia (vampyium2Inertia): the same Demian keeps his history even when the caller hands a copy of him.
  const owner = (g as Partial<Game>).player ?? p;
  const posV = 3 + 2.5 * Math.abs(p.vx) / 1.98; // the fastest a joint moves normally (drawing units per second)
  {
    const [lean, a0, b0, a1, b1, blade] = inertia(owner, 'pose', t,
      [pose.lean, pose.arms[0][0], pose.arms[0][1], pose.arms[1][0], pose.arms[1][1], pose.blade],
      p.attackT >= 0 && p.attackT < .25 || p.special ? 30 : 9, true); // (strikes stay fast; changes of pose glide)
    pose = { ...pose, lean, blade, arms: [[a0, b0], [a1, b1]] };
  }
  ctx.save(); ctx.scale(DEMIAN_SCALE, DEMIAN_SCALE);
  if (p.spinT > 0) spinLegTrail(ctx, 1 - p.spinT / .45);
  if (p.spinT > 0) { ctx.translate(0, -1); ctx.rotate((1 - p.spinT / .45) * Math.PI * 2); ctx.translate(0, 1); }
  // The 360° turn never squashes the body: he faces the other way for the back half of the turn.
  if (p.special?.kind === 'whirl') { const turn = p.special.t / .45; whirlTrail(ctx, turn); if (Math.cos(turn * Math.PI * 2) < 0) ctx.scale(-1, 1); }
  if (p.special?.kind === 'dash') dashTrail(ctx, p.special.t / .24);
  // Demian is ALWAYS drawn at 45° (three quarters), standing, walking, running and attacking — never in profile.
  // Facing left is the same drawing mirrored. (`walking` only changes how the arms are layered and the hip bob.)
  const walking = p.onGround && Math.abs(p.vx) > .15 && p.attackT < 0 && !p.special && !(p.jumpPrep && p.jumpPrep > 0);
  const profile = 0;
  const hipSpread = .075 - profile * .045;
  const hip: Pt = inertiaPt(owner, 'hip', t, [pose.lean * .08 + (pose.hipOffset?.[0] ?? 0), -.965 + pose.bob * (walking ? 1 : .45) + pose.crouch * .3 + (pose.hipOffset?.[1] ?? 0) + (p.landT > 0 ? p.landT * .32 : 0)], 1.2 + .3 * Math.abs(p.vx));
  const neck: Pt = [hip[0] + Math.sin(pose.lean) * .62, hip[1] - Math.cos(pose.lean) * .62];
  const shoulders: Pt[] = [-1, 1].map(side => { const x = side * (.2 - profile * .15); return [neck[0] + x * Math.cos(pose.lean) - .09 * Math.sin(pose.lean),
    neck[1] + x * Math.sin(pose.lean) + .09 * Math.cos(pose.lean)]; });
  const cycle = demianWalk(p);
  const feet: Pt[] = [], knees: Pt[] = [];
  for (let i = 0; i < 2; i++) {
    const origin: Pt = [hip[0] + (i ? hipSpread : -hipSpread), hip[1] + .03];
    const [a, b] = pose.legs[i], knee = add(origin, a, .46), foot = add(knee, a - b, .45);
    knees.push(knee); feet.push(foot);
  }
  const moving = p.onGround && Math.abs(p.vx) > .15 && !p.special && !(p.jumpPrep && p.jumpPrep > 0);
  if (moving) {
    for (let i = 0; i < 2; i++) {
      const origin: Pt = [hip[0] + (i ? hipSpread : -hipSpread), hip[1]];
      const angle = cycle.fa[i], pivot = angle >= 0 ? .19 : -.08;
      const bottom = Math.max(-.08 * Math.sin(angle), .19 * Math.sin(angle)) + .09 * Math.cos(angle);
      feet[i] = [(i ? hipSpread : -hipSpread) + cycle.dx[i] + pivot - (pivot * Math.cos(angle) - .09 * Math.sin(angle)), -bottom - cycle.lift[i]];
      const [thighAngle] = legAngles(origin, feet[i], .46, .45); knees[i] = add(origin, thighAngle, .46);
    }
  }
  if (p.onGround && (Math.abs(p.vx) < .15 || (p.jumpPrep ?? 0) > 0) && p.attackT < 0 && !p.special) {
    for (let i = 0; i < 2; i++) {
      const origin: Pt = [hip[0] + (i ? .09 : -.09), hip[1] + .03];
      feet[i] = [hip[0] + (i ? .17 : -.15), -.04]; // standing: legs straight under the hips
      const [angle] = legAngles(origin, feet[i], .46, .45);
      knees[i] = add(origin, angle, .46);
    }
  }
  if (p.onGround && pose.feet) for (let i = 0; i < 2; i++) {
    const origin: Pt = [hip[0] + (i ? .09 : -.09), hip[1]];
    feet[i] = pose.feet[i];
    const [angle] = legAngles(origin, feet[i], .46, .45);
    knees[i] = add(origin, angle, .46);
  }
  // Between poses (standing, walking, attacking, in the air) knees and feet glide instead of jumping in one frame.
  {
    const r = inertia(owner, 'feet', t, [...feet[0], ...feet[1]], posV);
    for (let i = 0; i < 2; i++) { // the knee follows the foot (inverse kinematics: always forward, real bone lengths)
      const origin: Pt = [hip[0] + (i ? hipSpread : -hipSpread), hip[1]];
      feet[i] = [r[i * 2], r[i * 2 + 1]];
      knees[i] = add(origin, legAngles(origin, feet[i], .46, .45)[0], .46);
    }
  }
  // Bones never stretch: if a target foot is out of reach, the shin stops at its real length.
  for (let i = 0; i < 2; i++) {
    const dx = feet[i][0] - knees[i][0], dy = feet[i][1] - knees[i][1], d = Math.hypot(dx, dy) || 1;
    feet[i] = [knees[i][0] + dx / d * .45, knees[i][1] + dy / d * .45];
  }
  // Anchor the supporting boot to the same collision surface, without changing the player's world position.
  const floor = inertia(owner, 'floor', t, [p.onGround && (!moving || !!pose.feet) ? Math.max(...feet.map(f => f[1])) + .105 : 0], .6)[0];
  const bootAngles = inertia(owner, 'boots', t, [0, 1].map(i => moving && !pose.feet ? cycle.fa[i]
    : pose.feet || p.onGround && Math.abs(p.vx) < .15 && p.attackT < 0 ? 0 : -(pose.legs[i][0] - pose.legs[i][1]) * .3), 14, true);
  ctx.translate(0, -floor);
  const wind = Math.min(.25, Math.abs(p.vx) * .025) + (p.onGround ? 0 : .12);
  ctx.save(); ctx.translate(neck[0] - .08, neck[1] + .025); ctx.rotate(.03 + wind + Math.sin(rt * 5) * .025);
  // The upper gathering is at 45% of this cutout, attached at the collar/upper back.
  hunterPiece(ctx, 10, -(.62 + wind) * .45, -.035, .62 + wind, 1.45); ctx.restore();
  const leg = (i: number) => {
    ctx.save(); if (!i) ctx.globalAlpha *= .83;
    limb(ctx, 6, [hip[0] + (i ? hipSpread : -hipSpread), hip[1]], knees[i], .215);
    limb(ctx, 7, knees[i], feet[i], .18);
    const bootAngle = bootAngles[i];
    ctx.save(); ctx.translate(...feet[i]); ctx.rotate(bootAngle);
    hunterPiece(ctx, 8, -.07, -.105, .24, .185); ctx.restore();
    jointArmor(ctx, knees[i], [hip[0] + (i ? hipSpread : -hipSpread), hip[1]], feet[i], .2, 'gilt', [1, 0]);
    ctx.restore();
  };
  const arm = (i: number, layer: 'upper' | 'forearm' | 'all') => {
    const [a, b] = pose.arms[i], elbow = add(shoulders[i], a, .31), hand = add(elbow, a + b, .30);
    const grip = add(hand, a + b, .035);
    ctx.save(); if (walking ? i === 1 : !i) ctx.globalAlpha *= .88;
    if (layer !== 'forearm') {
      limb(ctx, 3, shoulders[i], elbow, .205);
      // Separate anatomical left/right plates: dome above, overlapping lames towards the elbow.
      part(ctx, i ? 16 : 9, [shoulders[i][0], shoulders[i][1] + .025], .27, .25, -a * .12);
    }
    if (layer !== 'upper') {
      limb(ctx, 4, elbow, hand, .17);
      jointArmor(ctx, elbow, shoulders[i], hand, .16, 'gilt', [-1, 0]);
      const bladeGrip = i === 1 && (!!decor || ['sword', 'firesword', 'violet', 'bone'].includes(p.attackT >= 0 ? p.attackWeapon : g.weapon));
      const weaponAngle = a + b + pose.blade;
      if (i === 1 && !pose.weaponBehind) paintWeapon(grip, weaponAngle);
      else if (!i && g.guardHp > 0) drawAsset(ctx, 'weapons', 10, grip[0] - .2, grip[1] - .23, .4, .58);
      // The handle passes behind all curled fingers; the wrist bends independently of the blade.
      const thrustGrip = bladeGrip && Math.abs(Math.cos(Math.PI / 2 - weaponAngle)) > .8 && p.attackT >= 0;
      const handId = !i && pose.relaxedHand ? 19 : bladeGrip && !thrustGrip ? 17 : 5;
      part(ctx, handId, grip, bladeGrip ? .155 : .135, bladeGrip ? .17 : .15,
        bladeGrip && !thrustGrip ? Math.PI - weaponAngle : -(a + b));
    }
    ctx.restore();
  };
  leg(0);
  // Standing (and aiming), the free arm hangs IN FRONT of the body: the torso is turned three quarters, so the left
  // shoulder is the near one. Only the sword thrust swings it back behind the body. Walking (still at 45°), the arms
  // pass in front or behind with the step.
  const freeArmBack = p.attackT >= 0 && ['sword', 'firesword', 'violet', 'bone'].includes(p.attackWeapon) || !!p.special;
  // Walking the depth is fixed too: the free arm (near) in front, the sword arm (far) behind the torso.
  const depth = walking ? { back: [1], front: [0] }
    : freeArmBack ? { back: [0], front: [1] } : { back: [] as number[], front: [0, 1] };
  for (const side of depth.back) arm(side, 'all');
  if (pose.weaponBehind) {
    const [a, b] = pose.arms[1], elbow = add(shoulders[1], a, .31), hand = add(elbow, a + b, .30);
    paintWeapon(add(hand, a + b, .035), a + b + pose.blade);
  }
  const torso = decor?.key === 'ice' ? 14 : decor?.key === 'bone' ? 15 : 1;
  part(ctx, torso, [hip[0] + Math.sin(pose.lean) * .33, hip[1] - Math.cos(pose.lean) * .33], .58 - profile * .15, .72, pose.lean, decor ? undefined : ARMOR_TONE[g.weapon], profile * .28);
  if (!walking) part(ctx, 9, [shoulders[0][0], shoulders[0][1] + .025], .27, .25, -pose.arms[0][0] * .12);
  leg(1);
  part(ctx, 2, [hip[0], hip[1] + .10], .45 - profile * .1, .35, pose.lean * .4);
  // Demian's face (photo cutout, bigger than the painted head). The neck stub tucks into the gorget.
  const headTilt = pose.head * .4;
  const head: Pt = [neck[0] + .04, neck[1] - .145];
  ctx.save(); ctx.translate(neck[0] + .01, neck[1] + .05); ctx.rotate(headTilt);
  if (!drawAsset(ctx, 'demian-face', 0, -DEMIAN_FACE.w * .34, -DEMIAN_FACE.h, DEMIAN_FACE.w, DEMIAN_FACE.h)) part(ctx, 0, [.025, -.2], .316, .368);
  ctx.restore();
  const helmet = decor?.key === 'guard' ? 12 : decor?.key === 'holy' ? 11 : decor?.key === 'bone' ? 13 : -1;
  if (helmet >= 0) part(ctx, helmet, [head[0] + .005, head[1] - .015], .33, .375, headTilt);
  if (helmet === 12) { // the protective armour's hood: Demian's face inside the opening, in the hood's shadow
    ctx.save(); ctx.translate(head[0] + .005, head[1] - .015); ctx.rotate(headTilt);
    const W = .33, H = .375, cx = W * .17, cy = H * .03, rx = W * .2, ry = H * .245;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -.12, 0, Math.PI * 2); ctx.clip();
    const fw = DEMIAN_FACE.w * .62, fh = DEMIAN_FACE.h * .62;
    drawAsset(ctx, 'demian-face', 0, cx - fw * .48, cy - fh * .5, fw, fh);
    const shade = ctx.createRadialGradient(cx + rx * .35, cy + ry * .15, rx * .2, cx, cy, Math.max(rx, ry) * 1.15);
    shade.addColorStop(0, 'rgba(10,6,4,0)'); shade.addColorStop(.6, 'rgba(10,6,4,.25)'); shade.addColorStop(1, 'rgba(10,6,4,.85)');
    ctx.fillStyle = shade; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
  }
  for (const side of depth.front) arm(side, 'all');
  if (p.attackT > .025 && p.attackT < .18 && ['firesword', 'violet', 'bone'].includes(p.attackWeapon)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.sin(p.attackT / .18 * Math.PI) * .32;
    ctx.strokeStyle = p.attackWeapon === 'firesword' ? '#efb778' : p.attackWeapon === 'violet' ? '#c6a2c7' : '#c7d6d9';
    ctx.lineWidth = .027; ctx.beginPath(); ctx.arc(shoulders[1][0], shoulders[1][1], 1.35, -.9, .45); ctx.stroke(); ctx.restore();
  }
  ctx.restore(); return true;
}

const enemyRows: Record<string, [string, number]> = {
  walker: ['enemies-a', 0], flyer: ['enemies-a', 1], giant: ['enemies-a', 2], mage: ['enemies-a', 3], hammer: ['enemies-a', 4],
  warrior: ['enemies-b', 0], wolf: ['enemies-b', 1], dracula: ['enemies-b', 2], dragon: ['enemies-b', 3],
};
const rigRows: Record<string, [string, number, number]> = {
  walker: ['rig-a', 0, 8], giant: ['rig-a', 1, 8], mage: ['rig-a', 2, 8], hammer: ['rig-a', 3, 8],
  warrior: ['rig-b', 0, 9], wolf: ['rig-b', 1, 9], dracula: ['rig-b', 2, 9],
};
const enemyPartIndex: Record<string, number> = { walker: 0, giant: 1, mage: 2, hammer: 3, warrior: 4, wolf: 5, dracula: 6, flyer: 7 };
function drawEnemyHead(ctx: CanvasRenderingContext2D, kind: string, neck: Pt, angle: number) {
  if (!atlasReady('heads')) return false;
  const index = enemyPartIndex[kind], h = kind === 'giant' ? .34 : kind === 'wolf' ? .35 : kind === 'mage' || kind === 'dracula' ? .34 : .32;
  const w = h * assetAspect('heads', index);
  ctx.save(); ctx.translate(...neck); ctx.rotate(angle);
  drawAsset(ctx, 'heads', index, -w / 2, -h * .87, w, h); ctx.restore(); return true;
}
// Rigid painted cutouts follow the original distance-driven foot contacts and inverse kinematics.
// Action windups and attack impact frames remain the original game's action-state timings.
function drawArticulatedEnemy(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const rig = rigRows[v.kind];
  if (!rig || !atlasReady(rig[0]) || !['walk', 'leap', 'rise', 'claw', 'cast', 'zap'].includes(v.state)) return false;
  const [atlas, row, cols] = rig, base = row * cols;
  const raw = vampireRigPose(v, .88 * VAMP_VISUAL_SCALE, t);
  const { cycle: g, prepare, airborne, action, breath } = raw;
  const { windup, extension } = action;
  // Pose inertia (vampyium2Inertia): changing between walking, attacking and jumping never pops a joint in one frame.
  const posV = 3 + 2.5 * Math.abs(v.vx) / 2;
  const hip = inertiaPt(v, 'hip', t, raw.hip, 1.2 + .4 * Math.abs(v.vx)), lean = inertia(v, 'lean', t, [raw.lean], 6)[0];
  const neck: Pt = [hip[0] + Math.sin(lean) * .62, hip[1] - Math.cos(lean) * .62];
  const legs = (() => {
    const r = inertia(v, 'ankles', t, raw.legs.flatMap(l => l.ankle), posV);
    const fa = inertia(v, 'footAngles', t, raw.legs.map(l => l.footAngle), 14, true);
    return raw.legs.map((l, i) => { // the knee follows the ankle (inverse kinematics: always forward, real bone lengths)
      const origin: Pt = [hip[0] + (i ? .055 : -.055), hip[1]], ankle: Pt = [r[i * 2], r[i * 2 + 1]];
      const [a] = legAngles(origin, ankle, .46, .44);
      return { ...l, origin, knee: [origin[0] + Math.sin(a) * .46, origin[1] + Math.cos(a) * .46] as Pt, ankle, footAngle: fa[i] };
    });
  })();
  const heavy = v.kind === 'giant', wolf = v.kind === 'wolf';
  // Every enemy is ALWAYS drawn at 45° (three quarters): standing, walking and attacking — never in profile. Facing
  // left is the same drawing mirrored (so the far arm stays the far arm); the order of the arms never flips.
  const pk = 0; // (how far towards profile the torso turns: always 0 = three quarters)
  const paint = (id: number, center: Pt, w: number, h: number, angle = 0, cropLeft = 0) => {
    ctx.save(); ctx.translate(...center); ctx.rotate(angle);
    drawAsset(ctx, atlas, base + id, -w / 2, -h / 2, w, h, undefined, cropLeft); ctx.restore();
  };
  const bone = (id: number, a: Pt, b: Pt, width: number, extra = .05) => {
    if (id === 2 || id === 3) {
      const proximal: Pt = id === 2 ? [.53, .10] : [.37, .06];
      const distal: Pt = id === 2 ? [.48, .91] : [.60, .85];
      const m = jointTransform(a, b, proximal, distal, assetAspect(atlas, base + id), width);
      ctx.save(); ctx.translate(...a); ctx.rotate(m.angle);
      drawAsset(ctx, atlas, base + id, -proximal[0] * m.width, -proximal[1] * m.height, m.width, m.height);
      ctx.restore(); return;
    }
    paint(id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], width,
      Math.hypot(b[0] - a[0], b[1] - a[1]) + extra, -Math.atan2(b[0] - a[0], b[1] - a[1]));
  };
  if (wolf) { drawWolfQuadruped(ctx, v, t, paint, bone); return true; }
  ctx.save();
  if ((v.hurtT ?? 0) > 0) ctx.rotate(-.06);
  const cloakH = wolf ? .43 : 1.48;
  paint(6, [neck[0] - .20, neck[1] + cloakH / 2], wolf ? .57 : .75,
    cloakH, .08 + Math.sin(t * 5 + g.p * Math.PI * 2) * .035 + g.k * .08);
  const leg = (i: number) => {
    const { origin, knee, footAngle } = legs[i];
    let { ankle } = legs[i];
    { const dx = ankle[0] - knee[0], dy = ankle[1] - knee[1], d = Math.hypot(dx, dy) || 1; ankle = [knee[0] + dx / d * .44, knee[1] + dy / d * .44]; } // (no stretching)
    ctx.save(); if (!i) ctx.globalAlpha *= .96;
    bone(4, origin, knee, heavy ? .25 : .205);
    if (atlasReady('enemy-legs')) {
      const id = enemyPartIndex[v.kind], length = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
      const width = heavy ? .20 : wolf ? .16 : .155;
      ctx.save(); ctx.translate(...knee); ctx.rotate(-Math.atan2(ankle[0] - knee[0], ankle[1] - knee[1]));
      drawAsset(ctx, 'enemy-legs', id, -width / 2, -.025, width, length + .05); ctx.restore();
      ctx.save(); ctx.translate(...ankle); ctx.rotate(footAngle);
      drawAsset(ctx, 'enemy-legs', id + 7, VAMP_BOOT.left, VAMP_BOOT.top, VAMP_BOOT.width, VAMP_BOOT.height); ctx.restore();
    } else bone(5, knee, ankle, heavy ? .27 : .235, .05);
    jointArmor(ctx, knee, origin, ankle, heavy ? .22 : .19, 'iron', [1, 0]);
    ctx.restore();
  };
  // The painted torsos are turned three quarters towards the hunter: the open armhole on the viewer's LEFT is the
  // shoulder near the camera; the other shoulder is on the far side, behind the chest. Index 1 is the NEAR arm (always
  // drawn in front of the torso) and index 0 the FAR arm (always behind it), facing either way — the drawing is only
  // mirrored, so near stays near. Weapons follow one rule (as with Demian): the staff, the hammer and the sword are
  // held by the FAR arm; the shield is strapped to the NEAR arm. Walking in profile both shoulders come together.
  const torsoW = (heavy ? .65 : wolf ? .59 : .51) * (1 - .24 * pk) + breath;
  const carryKind = ['mage', 'hammer', 'warrior'].includes(v.kind);
  const FAR = 0, NEAR = 1, strike = carryKind ? FAR : NEAR; // (the arm that delivers the blow: the weapon's, or the near claw)
  // Where along the weapon the fist closes (fraction from its top) and how long it is.
  const GRIP: Record<string, { at: number; len: number }> = { mage: { at: .3, len: 1.55 }, hammer: { at: .74, len: 1.2 }, warrior: { at: .865, len: 1.15 } };
  const armPose = (i: number) => {
    const lateral = (i ? -1 : 1) * (torsoW * .37 * (1 - pk) + .045 * pk);
    const shoulder: Pt = [neck[0] + lateral * Math.cos(lean) - .115 * Math.sin(lean),
      neck[1] + lateral * Math.sin(lean) + .115 * Math.cos(lean)];
    const carry = i === FAR && carryKind;
    let a: number, b: number;
    // Carrying: the mage leans on the staff like a walking stick (forearm level, staff upright, foot on the floor);
    // the hammer and the sword hang low and forward from a relaxed arm, so they never cover the face.
    const stick = v.kind === 'mage';
    if (carry) { a = (stick ? .45 : .22) + g.arm[i] * .14 - prepare * .2; b = stick ? .9 : .3; }
    else if (v.kind === 'warrior' && i === NEAR) { a = .35 + g.arm[i] * .05; b = 1.05; } // the shield arm, close to the chest
    else { const w = walkingArm(g, i, .31, .30, .18); a = w[0] - prepare * .35; b = w[1]; }
    if (airborne) { a = i ? .45 : -.4; b = carry && stick ? 1.1 : .4; }
    let weaponAngle = !carry ? 0 : stick ? .12 + g.arm[i] * .05 : v.kind === 'hammer' ? 2.55 : 2.25; // (0 = upright, + leans forward)
    if (action.active) {
      const rest = Math.max(0, 1 - windup - extension), mix3 = (r: number, w: number, e: number) => r * rest + w * windup + e * extension;
      const mage = v.kind === 'mage', giant = v.kind === 'giant', shieldArm = v.kind === 'warrior' && i === NEAR;
      if (mage) {
        // The staff stays still in its hand; the free hand pulls back to the chest, then points at Demian.
        if (i === NEAR) { const aimA = Math.PI / 2 + (v.aim ?? 0); a = mix3(a, .55, aimA); b = mix3(b, 1.7, .06); }
      } else if (v.state !== 'claw') { // Drácula: both arms up to call the bats or the lightning
        a = mix3(a, .35 + 1.1, v.state === 'zap' ? 2.6 : 1.5); b = mix3(b, .6, .3);
      } else if (shieldArm) {
        // the shield stays fixed against the body: it does not move with the blow
      } else if (giant) {
        // Both arms rise straight over the head, then come down together in a double-fisted smash.
        a = mix3(a, 2.85 - i * .12, .8 + i * .1); b = mix3(b, .35, .2);
      } else if (i === strike) {
        // An overhead blow, as in fighting games: the arm rises in FRONT up over the head with the elbow bent (the
        // weapon hangs behind the shoulder), then chops down and forward; the weapon sweeps over the top in one arc.
        const hammer = v.kind === 'hammer';
        // (the hammer goes up BEHIND the head, hands high and the elbow open: the arms never cross the face)
        a = mix3(a, hammer ? 2.95 : carry ? 2.75 : 2.5, hammer ? .8 : carry ? 1.05 : 1.4);
        b = mix3(b, hammer ? .75 : carry ? 1.85 : .9, hammer ? .12 : carry ? .2 : .1);
        weaponAngle = mix3(weaponAngle, v.kind === 'warrior' ? -1.9 : -2.35, hammer ? 2.45 : 1.6); // the hammer ends on the floor
      } else if (v.kind !== 'hammer') { // the free arm balances the blow (the hammer's is solved below: both hands on the handle)
        a = mix3(a, -.45, .9); b = mix3(b, .7, .3);
      }
    }
    [a, b, weaponAngle] = inertia(v, 'arm' + i, t, [a, b, weaponAngle], action.active && extension > .05 ? 20 : 10, true);
    const elbow = add(shoulder, a, .31), hand = add(elbow, a + b, .30);
    return { shoulder, elbow, hand, a, b, carry, weaponAngle };
  };
  // Two-bone IK for an arm (elbow bends down/back): the angles that put the hand on `target`.
  const armIK = (shoulder: Pt, target: Pt): [number, number] => {
    const dx = target[0] - shoulder[0], dy = target[1] - shoulder[1], d = Math.max(.02, Math.min(Math.hypot(dx, dy), .609));
    const base = Math.atan2(dx, dy), al = Math.acos(Math.max(-1, Math.min(1, (.31 * .31 + d * d - .3 * .3) / (2 * .31 * d))));
    const ga = Math.acos(Math.max(-1, Math.min(1, (.31 * .31 + .3 * .3 - d * d) / (2 * .31 * .3))));
    return [base - al, Math.PI - ga];
  };
  const poseOf = (i: number) => {
    const pose = armPose(i);
    if (v.kind !== 'hammer' || i !== NEAR || !action.active) return pose;
    // The giant hammer is gripped with BOTH hands: the near fist closes lower on the handle, below the far one.
    const lead = armPose(FAR), up: Pt = [Math.sin(lead.weaponAngle), -Math.cos(lead.weaponAngle)];
    const target: Pt = [lead.hand[0] - up[0] * .2, lead.hand[1] - up[1] * .2];
    const [ia, ib] = armIK(pose.shoulder, target), k = Math.min(1, (windup + extension) * 2.5);
    const [a, b] = inertia(v, 'grip2', t, [pose.a + (ia - pose.a) * k, pose.b + (ib - pose.b) * k], 20, true);
    const elbow = add(pose.shoulder, a, .31);
    return { ...pose, a, b, elbow, hand: add(elbow, a + b, .30) };
  };
  const far = (i: number) => i === FAR;
  const weapon = (pose: ReturnType<typeof armPose>) => {
    const gp = GRIP[v.kind], height = gp.len, width = height * assetAspect(atlas, base + 7);
    ctx.save(); ctx.translate(...pose.hand); ctx.rotate(pose.weaponAngle);
    paint(7, [0, (.5 - gp.at) * height], width, height); ctx.restore();
  };
  const pauldron = (shoulder: Pt, a: number, mirror: boolean) => {
    const v2 = ironVariant(16); if (!v2) return;
    const h = heavy ? .34 : wolf ? .27 : .27, w = h * v2.width / v2.height;
    ctx.save(); ctx.translate(shoulder[0], shoulder[1] - h * .08); ctx.rotate(-a * .35); if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(v2, -w * .42, -h * .32, w, h); ctx.restore();
  };
  const arm = (i: number) => {
    const pose = poseOf(i), { shoulder, elbow, hand, a, b, carry } = pose;
    ctx.save(); if (far(i)) ctx.globalAlpha *= .9;
    bone(2, shoulder, elbow, heavy ? .25 : .19);
    pauldron(shoulder, a, i === FAR);
    if (carry) weapon(pose); // behind the forearm: the fingers close over the handle
    bone(3, elbow, add(hand, a + b, .065), heavy ? .23 : .17, .035);
    jointArmor(ctx, elbow, shoulder, hand, heavy ? .19 : .16, 'iron', [-1, 0]);
    ctx.restore();
  };
  // Depth never flips: the far arm (and what it holds) behind the torso, the near arm in front — standing, walking,
  // attacking, facing either way. (With the hammer the near arm crosses in front of the chest to the handle.)
  const depth = { back: [FAR], front: [NEAR] };
  leg(0); for (const side of depth.back) arm(side); leg(1);
  paint(1, [hip[0] + Math.sin(lean) * .30, hip[1] - Math.cos(lean) * .28], torsoW, .73, lean, .24 * pk);
  if (!drawEnemyHead(ctx, v.kind, [neck[0] + .02, neck[1]], -lean * .25 + g.sway * .008))
    paint(0, [neck[0] + .045, neck[1] - .14], wolf ? .39 : heavy ? .34 : .30, wolf ? .34 : .35, -lean * .25);
  for (const side of depth.front) arm(side);
  if (v.kind === 'warrior') { // the shield is strapped to the NEAR forearm, outside it, covering the chest from the front
    const sp = armPose(NEAR); paint(8, [sp.hand[0] + .06, sp.hand[1] - .06], .42, .62, lean * .5);
  }
  if (v.kind === 'mage' && action.active && extension > .05) { // the power gathers in the pointing hand
    const h = poseOf(NEAR).hand, r = .16 + extension * .18;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], r);
    glow.addColorStop(0, `rgba(255,220,200,${.9 * extension})`); glow.addColorStop(.35, `rgba(255,60,50,${.7 * extension})`); glow.addColorStop(1, 'rgba(160,0,20,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(h[0], h[1], r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore(); return true;
}
// The werewolf on all fours (pose: vampyium2Motion → wolfQuadPose). Same painted pieces as before — torso, upper
// arms and forearms with the claws (the front legs), thighs, shins and paws (the hind legs), head — only the pose
// changes. Far legs are drawn behind the torso, near legs in front; the far side never swaps when it turns.
type Painter = (id: number, center: Pt, w: number, h: number, angle?: number, cropLeft?: number) => void;
type BonePainter = (id: number, a: Pt, b: Pt, width: number, extra?: number) => void;
function drawWolfQuadruped(ctx: CanvasRenderingContext2D, v: Vamp, t: number, paint: Painter, bone: BonePainter) {
  const Q = WOLF_QUAD, raw = wolfQuadPose(v, .88 * VAMP_VISUAL_SCALE, t);
  const posV = 3 + 2.5 * Math.abs(v.vx) / 2.6;
  const hip = inertiaPt(v, 'qhip', t, raw.hip, 1.5 + .4 * Math.abs(v.vx)), lean = inertia(v, 'qlean', t, [raw.lean], 5)[0];
  const neck: Pt = [hip[0] + Math.sin(lean) * Q.spine, hip[1] - Math.cos(lean) * Q.spine];
  const dShoulder: Pt = [neck[0] - raw.neck[0], neck[1] - raw.neck[1]]; // (the shoulders ride on the smoothed spine)
  const ankles = inertia(v, 'qankles', t, raw.legs.flatMap(l => l.ankle), posV);
  const paws = inertia(v, 'qpaws', t, raw.arms.flatMap(a => a.target), posV);
  const footAngles = inertia(v, 'qfeet', t, raw.legs.map(l => l.footAngle), 14, true);
  const [hx, hy, ha, bite] = inertia(v, 'qhead', t, [...raw.head, raw.headAngle, raw.bite], 4);
  const armIK = (shoulder: Pt, target: Pt): [Pt, Pt] => { // elbow bends BACK (a front leg)
    const dx = target[0] - shoulder[0], dy = target[1] - shoulder[1], L = Q.upper + Q.lower + Q.paw;
    const d = Math.max(.05, Math.min(Math.hypot(dx, dy), L - 1e-3)), base = Math.atan2(dx, dy);
    const u = Q.upper, w = Q.lower + Q.paw;
    const al = Math.acos(Math.max(-1, Math.min(1, (u * u + d * d - w * w) / (2 * u * d))));
    const elbow = add(shoulder, base - al, u);
    const dir = Math.atan2(target[0] - elbow[0], target[1] - elbow[1]);
    return [elbow, add(elbow, dir, Q.lower)];
  };
  const hind = (i: number) => {
    const origin: Pt = [hip[0] + (i ? .04 : -.04), hip[1]], ankle0: Pt = [ankles[i * 2], ankles[i * 2 + 1]];
    const [a] = legAngles(origin, ankle0, Q.thigh, Q.shin);
    const knee = add(origin, a, Q.thigh);
    const dx = ankle0[0] - knee[0], dy = ankle0[1] - knee[1], dd = Math.hypot(dx, dy) || 1;
    const ankle: Pt = [knee[0] + dx / dd * Q.shin, knee[1] + dy / dd * Q.shin]; // (no stretching)
    ctx.save();
    bone(4, origin, knee, .205);
    if (atlasReady('enemy-legs')) {
      const id = enemyPartIndex.wolf, length = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
      ctx.save(); ctx.translate(...knee); ctx.rotate(-Math.atan2(ankle[0] - knee[0], ankle[1] - knee[1]));
      drawAsset(ctx, 'enemy-legs', id, -.08, -.025, .16, length + .05); ctx.restore();
      ctx.save(); ctx.translate(...ankle); ctx.rotate(footAngles[i]);
      drawAsset(ctx, 'enemy-legs', id + 7, VAMP_BOOT.left, VAMP_BOOT.top, VAMP_BOOT.width, VAMP_BOOT.height); ctx.restore();
    } else bone(5, knee, ankle, .235, .05);
    jointArmor(ctx, knee, origin, ankle, .19, 'iron', [1, 0]);
    ctx.restore();
  };
  const fore = (i: number) => {
    const s0 = raw.arms[i].shoulder, shoulder: Pt = [s0[0] + dShoulder[0], s0[1] + dShoulder[1]];
    const [elbow, hand] = armIK(shoulder, [paws[i * 2], paws[i * 2 + 1]]);
    const a = Math.atan2(elbow[0] - shoulder[0], elbow[1] - shoulder[1]), ab = Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]);
    bone(2, shoulder, elbow, .19);
    bone(3, elbow, add(hand, ab, Q.paw), .17, .035);
    jointArmor(ctx, elbow, shoulder, hand, .16, 'iron', [-1, 0]);
    return a;
  };
  ctx.save();
  if ((v.hurtT ?? 0) > 0) ctx.rotate(-.04);
  ctx.save(); ctx.globalAlpha *= .92; hind(0); fore(0); ctx.restore(); // the far side, behind the body
  paint(1, [hip[0] + Math.sin(lean) * .30, hip[1] - Math.cos(lean) * .30], .59 + raw.breath, .73, lean);
  hind(1); fore(1);
  // the head looks ahead; for the bite it swaps (blended) to the open-jawed head
  const baseA = bite < .5 ? 1 : 1 - (bite - .5) * 2, openA = Math.min(1, bite * 2); // (no see-through double head)
  if (baseA > .02) { ctx.save(); ctx.globalAlpha *= baseA; if (!drawEnemyHead(ctx, 'wolf', [hx, hy], ha)) paint(0, [hx + .045, hy - .14], .39, .34, ha); ctx.restore(); }
  if (openA > .02) { ctx.save(); ctx.globalAlpha *= openA; ctx.translate(hx, hy); ctx.rotate(ha); paint(0, [.07, -.15], .42, .37); ctx.restore(); }
  ctx.restore();
}
// The somersault (360° in the air): the boots leave a bright arc behind them, along the circle they travel.
function spinLegTrail(ctx: CanvasRenderingContext2D, turn: number) {
  const k = Math.sin(Math.min(1, Math.max(0, turn)) * Math.PI), a = turn * Math.PI * 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { // the feet are ~1 unit from the turning point (the waist, at y = -1)
    const r = .8 - i * .08, a1 = Math.PI / 2 + a, a0 = a1 - 1.9 + i * .25;
    ctx.strokeStyle = `rgba(${255 - i * 20},${225 - i * 30},${170 - i * 30},${(.5 - i * .1) * k})`; ctx.lineWidth = .1 - i * .018;
    ctx.beginPath(); ctx.arc(0, -1, r, a0, a1); ctx.stroke();
  }
  for (let i = 0; i < 7; i++) { // sparks thrown off the boots
    const q = a + Math.PI / 2 - i * .28, rr = .76 + (i % 2) * .1;
    ctx.fillStyle = `rgba(255,230,170,${.6 * k * (1 - i / 7)})`;
    ctx.beginPath(); ctx.arc(Math.cos(q) * rr, -1 + Math.sin(q) * rr, .03, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// A silver sweep around the waist while Demian turns 360°, so the turn reads without squashing him.
function whirlTrail(ctx: CanvasRenderingContext2D, turn: number) {
  const k = Math.sin(Math.min(1, turn) * Math.PI);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const a0 = turn * Math.PI * 2 - .2 - i * .55, a1 = a0 + 1.6;
    ctx.strokeStyle = `rgba(225,235,245,${(.42 - i * .12) * k})`; ctx.lineWidth = .07 - i * .015;
    ctx.beginPath(); ctx.ellipse(0, -1.05, 1.25, .32, 0, a0, a1); ctx.stroke();
  }
  ctx.restore();
}
// Speed streaks behind the thrust.
function dashTrail(ctx: CanvasRenderingContext2D, k: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const y = -.5 - i * .26, l = .9 + (i % 2) * .5;
    ctx.strokeStyle = `rgba(230,225,210,${.32 * (1 - k)})`; ctx.lineWidth = .025;
    ctx.beginPath(); ctx.moveTo(-.35, y); ctx.lineTo(-.35 - l, y); ctx.stroke();
  }
  ctx.restore();
}
export function enemyFrame(v: Vamp, t: number) {
  if (v.state === 'cast') return v.t < .55 ? 4 : 5;
  if (v.state === 'breath') return v.t < .35 ? 4 : 5;
  if (v.state === 'zap') return v.t < .4 ? 4 : 5;
  if (v.state === 'claw') return v.t < (ATTACK[v.kind]?.at ?? .36) ? 4 : 5;
  if (['dive', 'leap', 'rise'].includes(v.state) || (!v.onGround && !['hover', 'walk'].includes(v.state))) return 3;
  if (v.state === 'hover') return 1 + (Math.floor(t * 7 + v.id) % 2);
  if (Math.abs(v.vx) > .15 || v.walkT > 0 && v.speed === 0) return [1, 0, 2, 0][((Math.floor(v.walkT * 3) % 4) + 4) % 4];
  return 0;
}
// ---- Drácula dragón: always in the air, with articulated wings -------------------------------------------------
// The painted flying dragon is cut into pieces in its own pixel space (255 × 223): body (with the legs hanging),
// tail, head (closed / open mouth) and each wing split at the wrist. The flight cycle never stops — attacks are a
// separate layer (head aim, mouth, fire glow) on top of it:
// WINGS UP → DOWNSTROKE → LEVEL → FULLY DOWN → UPSTROKE → LEVEL → UP → loop.
// outline of each piece inside its cell (x, y, w, h)
// outline of each piece inside its cell (x, y, w, h), in the 4× pixels of the sheet
const DRAGON_PIECE_BOX = [[48, 260, 749, 584], [135, 39, 410, 409], [0, 0, 403, 377], [515, 78, 284, 330], [581, 23, 358, 245], [48, 513, 279, 329], [710, 306, 249, 195], [721, 296, 279, 216]];
const DRAGON_SHEET = 4; // the sheet is the painted dragon rebuilt at 4× (Real-ESRGAN): sharp at any screen size
// A crest of the dragon's own horns (cut from its head) at a wing root: they sweep up and back, and follow the wing a little.
const HORNS: [number, number, number, number][] = [[-2.62, .62, -9, 8], [-2.98, 1.1, 2, -1], [-2.8, .86, -4, 3], [-3.15, .74, 8, 4]]; // angle, size, dx, dy (back to front)
function dragonHorns(ctx: CanvasRenderingContext2D, root: Pt, size: number, follow: number) {
  if (!atlasReady('dragon-horn')) return;
  const f = META['dragon-horn'].frames[0], img = images['dragon-horn'], L = 30 * size;
  for (const [a, k, ox, oy] of HORNS) {
    ctx.save(); ctx.translate(root[0] + ox, root[1] + oy - 2); ctx.rotate(a + follow - Math.PI + .45);
    // the horn image runs from its base (right) to its tip (left): base at the origin, thickened a little
    const w = L * k, h = w * f.h / f.w * 2.4;
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -w * .95, -h * .82, w, h); ctx.restore();
  }
}
function drawDragonFlight(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (!atlasReady('dragon-flight')) return false;
  const img = images['dragon-flight'], cell = (i: number) => META['dragon-flight'].frames[i];
  // (each piece is drawn only inside its own outline: the rest of the 255 × 223 cell is transparent)
  const piece = (i: number) => { const f = cell(i), [bx, by, bw, bh] = DRAGON_PIECE_BOX[i], q = DRAGON_SHEET; ctx.drawImage(img, f.x + bx, f.y + by, bw, bh, bx / q, by / q, bw / q, bh / q); };
  const around = (pivot: Pt, angle: number, draw: () => void) => { ctx.save(); ctx.translate(...pivot); ctx.rotate(angle); ctx.translate(-pivot[0], -pivot[1]); draw(); ctx.restore(); };
  const diving = v.state === 'dive', breath = v.state === 'breath', rising = v.state === 'rise' || v.state === 'land';
  const rate = diving ? .9 : rising ? 2.1 : 1.45; // beats per second (faster when climbing or hovering low)
  const phase = t * rate + v.id * .37;
  const w = diving ? .12 + .08 * dragonWing(phase) : dragonWing(phase);
  const lag = diving ? 0 : (dragonWing(phase) - dragonWing(phase - .07)) * 2.4; // the outer wing trails the beat (membrane follow-through)
  const p01 = ((phase % 1) + 1) % 1;
  const bob = diving ? 0 : -Math.sin(p01 * Math.PI * 2) * (breath ? 1.5 : 4.5); // lifts on the downstroke, sinks on the upstroke (pixels)
  // attack layer: the head turns to aim the mouth at the hunter (v.aim, from the game logic: the fire leaves along
  // the same line), the fire gathers in the throat, the jaw opens ONLY while it is breathing fire, then closes
  const charge = breath ? ease01(v.t / .35) : 0, fire = !!v.firing;
  const headRot = (v.aim ?? 0) + Math.sin((p01 - .15) * Math.PI * 2) * (breath ? .012 : .035);
  const pitch = diving ? Math.max(-.2, Math.min(.85, Math.atan2(-v.vy, Math.abs(v.vx) || .001))) : Math.sin(p01 * Math.PI * 2 + .6) * (breath ? .01 : .025);
  ctx.save();
  if (v.state === 'mist') ctx.globalAlpha *= .3 + .15 * Math.sin(t * 7);
  ctx.translate(DRAGON_DRAW.x, DRAGON_DRAW.y); ctx.scale(DRAGON_DRAW.scale, DRAGON_DRAW.scale); ctx.rotate(pitch);
  ctx.translate(-DRAGON.center[0], -DRAGON.center[1] + bob);
  const wingNear = -w * DRAGON_WING_DOWN.near, wingFar = w * DRAGON_WING_DOWN.far;
  // far wing (behind the body): inner segment from the shoulder, outer segment from the wrist
  around(DRAGON.rootFar, wingFar, () => { around(DRAGON.jointFar, -lag * .9, () => piece(4)); piece(3); });
  around(DRAGON.tail, Math.sin((p01 - .3) * Math.PI * 2) * .07 + Math.sin(t * 1.3 + v.id) * .04, () => piece(5));
  piece(0);
  around(DRAGON.head, headRot, () => {
    piece(fire ? 7 : 6);
    if (charge > 0 && (fire || v.t < .4)) { // the fire gathering in the throat, then pouring out of the mouth
      const m = DRAGON.mouth, r = (fire ? 12 : 6) + charge * (fire ? 14 : 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(m[0], m[1], 0, m[0], m[1], r);
      gl.addColorStop(0, `rgba(255,230,170,${.85 * charge})`); gl.addColorStop(.4, `rgba(255,120,30,${.6 * charge})`); gl.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(m[0], m[1], r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  });
  dragonHorns(ctx, DRAGON.rootFar, .8, wingFar * .25);
  // near wing (in front)
  around(DRAGON.rootNear, wingNear, () => { piece(1); around(DRAGON.jointNear, lag, () => piece(2)); });
  dragonHorns(ctx, DRAGON.rootNear, 1, wingNear * .25); // a crest of horns over the wing root (hides where the wing joins)
  ctx.restore(); return true;
}
// ---- Vampiro volador: the body stays still; only the wings beat --------------------------------------------------
// The hovering drawing (enemies-a, row 1, frame 0) is cut into the body and each wing (flyer-rig, same pixel space,
// 226 × 229). Each wing turns about its root behind the shoulder: UP → DOWNSTROKE (the push, 45% of the beat) →
// clearly DOWN → back UP, in a loop, both wings together and mirrored. Head, torso, arms and legs never move with it.
export const FLYER_RIG = { w: 226, h: 229, rootFar: [97, 47] as Pt, rootNear: [142, 40] as Pt, up: .85, down: -.55, beat: 2.1 }; // (angles of the far wing; the near one mirrors it)
export function flyerWing(v: Pick<Vamp, 'id'>, t: number) { return dragonWing(t * FLYER_RIG.beat + v.id * .37); } // 0 up … 1 down
const FLYER_MOUTH = { hinge: [170, 220] as Pt, line: 251 }; // in the flyer head's own pixels (heads, index 7: 362 × 438)
/** The flyer's head with the jaw open `open` (0…1): a bite, fangs out. */
function drawFlyerHead(ctx: CanvasRenderingContext2D, neck: Pt, angle: number, open: number) {
  if (!atlasReady('heads')) return false;
  const f = META.heads.frames[7], h = .32, k = h / f.h, w = f.w * k;
  ctx.save(); ctx.translate(...neck); ctx.rotate(angle); ctx.translate(-w / 2, -h * .87); ctx.scale(k, k);
  const src = images.heads, [hx, hy] = FLYER_MOUTH.hinge, line = FLYER_MOUTH.line, jaw = open * .3;
  // upper head (everything above the mouth line and the line back to the jaw hinge)
  const upper = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(f.w, 0); ctx.lineTo(f.w, line); ctx.lineTo(hx + 120, line); ctx.lineTo(hx, hy); ctx.lineTo(0, hy); ctx.closePath(); };
  const lower = () => { ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(hx, hy); ctx.lineTo(hx + 120, line); ctx.lineTo(f.w, line); ctx.lineTo(f.w, f.h); ctx.lineTo(0, f.h); ctx.closePath(); };
  if (jaw > .005) {
    // the open mouth behind the jaw: dark gums, a tongue, upper and lower fangs
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(jaw); ctx.translate(-hx, -hy);
    ctx.save(); lower(); ctx.clip(); ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); ctx.restore();
    ctx.restore();
    const mx = hx + 125, my = line, tip = f.w - 18, drop = (tip - hx) * Math.sin(jaw);
    ctx.fillStyle = '#2a0508'; ctx.beginPath(); ctx.moveTo(mx - 20, my - 2); ctx.lineTo(tip, my - 4);
    ctx.quadraticCurveTo(tip + 6, my + drop * .55, tip - 6, my + drop); ctx.lineTo(mx - 10, my + drop * .35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7e1f26'; ctx.beginPath(); ctx.ellipse(mx + 40, my + drop * .55, 30, 8 + drop * .1, -.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1ebe0';
    for (const [x, len] of [[tip - 14, 26], [tip - 50, 14], [mx + 10, 12]] as const) { // upper fangs
      ctx.beginPath(); ctx.moveTo(x - 5, my - 2); ctx.lineTo(x, my + len * (.6 + open * .4)); ctx.lineTo(x + 5, my - 2); ctx.closePath(); ctx.fill();
    }
    for (const [x, len] of [[tip - 24, 20], [mx + 30, 11]] as const) { // lower fangs, on the dropped jaw
      const y = my + drop * ((x - hx) / (tip - hx));
      ctx.beginPath(); ctx.moveTo(x - 5, y + 2); ctx.lineTo(x, y - len); ctx.lineTo(x + 5, y + 2); ctx.closePath(); ctx.fill();
    }
    ctx.save(); upper(); ctx.clip(); ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); ctx.restore();
  } else ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  ctx.restore(); return true;
}
function drawFlyer(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (!atlasReady('flyer-rig') || !atlasReady('enemies-a')) return false;
  const atlas = META['enemies-a'], row = 1, cellW = atlas.width / 6, cellH = atlas.height / atlas.rows;
  const idle = atlas.frames[row * 6], s = 1.95 / idle.h, baseline = idle.y + idle.h - row * cellH;
  const anchor = (ax: number, ay: number): Pt => [(ax - .5) * cellW * s, (ay * cellH - baseline) * s];
  const place = (f: Frame) => [(f.x - Math.floor((f.x + f.w / 2) / cellW) * cellW - cellW / 2) * s, (f.y - row * cellH - baseline) * s] as Pt;
  const diving = v.state === 'dive';
  // Hover ↔ dive is a short blend, never a cut: into the dive over 0.08 s; back to the beating wings over 0.12 s.
  const diveK = diving ? ease01(v.t / .08) : v.state === 'rise' ? 1 - ease01(v.t / .12) : 0;
  ctx.save(); ctx.translate(0, .65);
  if (diveK > 0) { // the whole predator turns along its dive, nose towards Demian (the body is not stretched)
    const pitch = Math.max(-.25, Math.min(1.05, Math.atan2(-v.vy, Math.abs(v.vx) || .001)));
    ctx.translate(0, -1); ctx.rotate(pitch * diveK); ctx.translate(0, 1);
  }
  if (diveK < 1) { // HOVER: the rig — wings beating, body still
    ctx.save(); ctx.globalAlpha *= 1 - diveK;
    const [x0, y0] = place(idle), w = FLYER_RIG.w * s, h = FLYER_RIG.h * s, beat = flyerWing(v, t);
    const a = FLYER_RIG.up + (FLYER_RIG.down - FLYER_RIG.up) * beat;
    const wing = (index: number, root: Pt, angle: number) => {
      const rx = x0 + root[0] * s, ry = y0 + root[1] * s;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(angle); ctx.translate(-rx, -ry);
      drawAsset(ctx, 'flyer-rig', index, x0, y0, w, h); ctx.restore();
    };
    wing(1, FLYER_RIG.rootFar, a); wing(2, FLYER_RIG.rootNear, -a); // (both behind the body, from the back)
    drawAsset(ctx, 'flyer-rig', 0, x0, y0, w, h);
    drawEnemyHead(ctx, 'flyer', anchor(.56, .205), 0);
    ctx.restore();
  }
  if (diveK > 0) { // DIVE: body stretched along the dive, both arms reaching for Demian, legs trailing, jaws open
    const f = atlas.frames[row * 6 + 3], [x, y] = place(f), clean = cleanFrame('enemies-a', row * 6 + 3);
    ctx.save(); ctx.globalAlpha *= diveK;
    if (clean) ctx.drawImage(clean, x, y, f.w * s, f.h * s); else ctx.drawImage(images['enemies-a'], f.x, f.y, f.w, f.h, x, y, f.w * s, f.h * s);
    const bite = diving ? .55 + .45 * Math.sin(Math.min(1, v.t / .35) * Math.PI / 2) : .4;
    drawFlyerHead(ctx, anchor(.78, .51), .12, bite);
    ctx.restore();
  }
  ctx.restore(); return true;
}
export function drawRealisticEnemy(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (v.kind === 'dragon' && drawDragonFlight(ctx, v, t)) return true;
  if (v.kind === 'flyer' && v.state !== 'claw' && drawFlyer(ctx, v, t)) return true;
  if (drawArticulatedEnemy(ctx, v, t)) return true;
  const [name, row] = enemyRows[v.kind]; if (!atlasReady(name)) return false;
  const atlas = META[name], idle = atlas.frames[row * 6];
  const articulated = !['flyer', 'dragon'].includes(v.kind) && ['walk', 'leap', 'rise'].includes(v.state);
    const flyer = v.kind === 'flyer', diving = flyer && v.state === 'dive';
  // The flyer beats its wings while it hovers or climbs (open, down, half, down…); it stretches out to dive.
  const wingBeat = [0, 1, 2, 1][((Math.floor(t * 7 + v.id * 1.3) % 4) + 4) % 4];
  const frameIndex = articulated ? 0 : flyer ? (diving ? (v.t < .14 ? 5 : 3) : v.state === 'claw' ? 4 : wingBeat) : enemyFrame(v, t);
  const f = atlas.frames[row * 6 + frameIndex];
  const cellW = atlas.width / 6, cellH = atlas.height / atlas.rows;
  const sy = (v.kind === 'dragon' ? 2.6 : v.kind === 'flyer' ? 1.95 : 2.05) / idle.h;
  const sx = sy * (v.kind === 'dragon' ? 1.55 : 1);
  const baseline = idle.y + idle.h - row * cellH;
  ctx.save();
  if ((v.hurtT ?? 0) > 0) ctx.rotate(-.06);
  if (v.state === 'mist') ctx.globalAlpha *= .3 + .15 * Math.sin(t * 7);
  const bob = v.state === 'hover' ? Math.sin(t * (flyer ? 1.6 : 4) + v.id) * (flyer ? .05 : .035) : 0;
  ctx.translate(0, bob + (v.kind === 'flyer' ? .65 : v.kind === 'dragon' ? 1.1 : 0));
  if (diving) { // nose along the dive line, towards the hunter (the body is not stretched, it rotates)
    const into = Math.min(1, v.t / .14), pitch = Math.max(-.25, Math.min(1.05, Math.atan2(-v.vy, Math.abs(v.vx) || .001)));
    ctx.translate(0, -1); ctx.rotate(pitch * into); ctx.translate(0, 1);
  }
  const x = (f.x - Math.floor((f.x + f.w / 2) / cellW) * cellW - cellW / 2) * sx;
  const y = (f.y - row * cellH - baseline) * sy;
  const clean = flyer ? cleanFrame(name, row * 6 + frameIndex) : null;
  if (clean) ctx.drawImage(clean, x, y, f.w * sx, f.h * sy);
  else ctx.drawImage(images[name], f.x, f.y, f.w, f.h, x, y, f.w * sx, f.h * sy);
  if (v.kind === 'flyer') {
    const anchors = [[.56, .205], [.59, .25], [.58, .26], [.78, .51], [.63, .34], [.72, .40]];
    const [ax, ay] = anchors[frameIndex];
    drawEnemyHead(ctx, 'flyer', [(ax - .5) * cellW * sx, (ay * cellH - baseline) * sy], frameIndex >= 3 ? .12 : 0);
  }
  ctx.restore(); return true;
}

// The photographed flames, with their cell edges feathered: no straight cut where the smoke reached the border.
const softFire = new Map<number, HTMLCanvasElement>();
function softFireFrame(index: number) {
  if (softFire.has(index)) return softFire.get(index)!;
  const f = META.effects.frames[index]; if (!f) return null;
  const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
  const c = canvas.getContext('2d'); if (!c) return null;
  c.drawImage(images.effects, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  c.globalCompositeOperation = 'destination-in';
  const across = c.createLinearGradient(0, 0, f.w, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(.22, '#000'); across.addColorStop(.78, '#000'); across.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = across; c.fillRect(0, 0, f.w, f.h);
  const down = c.createLinearGradient(0, 0, 0, f.h);
  down.addColorStop(0, 'rgba(0,0,0,0)'); down.addColorStop(.25, '#000'); down.addColorStop(1, '#000');
  c.fillStyle = down; c.fillRect(0, 0, f.w, f.h);
  softFire.set(index, canvas); return canvas;
}
export function drawRealisticFire(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number) {
  // (the clock and the seed can be negative, e.g. bones that fell off the bottom: keep the frame in 0…7)
  const n = Math.floor(t * 14 + seed * 3), frame = Number.isFinite(n) ? ((n % 8) + 8) % 8 : 0;
  if (!atlasReady('effects') || !META.effects?.frames[frame]) return false;
  const soft = softFireFrame(frame);
  if (!soft) return drawAsset(ctx, 'effects', frame, x - w / 2, y - h, w, h);
  ctx.drawImage(soft, x - w / 2, y - h, w, h); return true;
}
export const ARMOR_TONE: Partial<Record<Weapon, string>> = { ice: '#84bace', holy: '#b9a06a', venom: '#677d55', violet: '#8a708e', guard: '#c2ba9d', bone: '#a69a80' };

