import metadata from './assets/vampyium2/atlas.json';
import type { Game, Player, Vamp, Weapon } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { ATTACK } from './vampyium2';
import { humanWalk, jointTransform, legAngles, walkingArm, walkingDepth } from './vampyium2Gait';
import { vampireRigPose, VAMP_BOOT, VAMP_VISUAL_SCALE } from './vampyium2Motion';

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
  else drawAsset(ctx, 'hunter', index, -w * .5, -h * .38, w, h);
  ctx.restore();
}

const add = (a: Pt, angle: number, l: number): Pt => [a[0] + Math.sin(angle) * l, a[1] + Math.cos(angle) * l];
function part(ctx: CanvasRenderingContext2D, id: number, center: Pt, w: number, h: number, angle = 0, tint?: string, cropLeft = 0) {
  ctx.save(); ctx.translate(...center); ctx.rotate(angle);
  drawAsset(ctx, 'hunter', id, -w / 2, -h / 2, w, h, tint, cropLeft); ctx.restore();
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
  drawAsset(ctx, 'hunter', id, -proximal[0] * m.width, -proximal[1] * m.height, m.width, m.height);
  ctx.restore();
}
type WeaponPainter = (hand: Pt, angle: number) => void;
// The photo head (crown to neck stub), a little larger than the old painted head but in proportion with the body.
export const DEMIAN_FACE = { h: .35, w: .35 * 380 / 535 };
// Demian is drawn as tall as a normal vampire (the vampires' art is 12% bigger than the hunter's).
export const DEMIAN_SCALE = 1.095;

// Input-driven articulated poses keep hands, weapon and shoulder plates attached throughout each action.
export function drawRealisticHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, pose: Pose, t: number, paintWeapon: WeaponPainter) {
  if (!atlasReady('hunter')) return false;
  const rt = t;
  ctx.save(); ctx.scale(DEMIAN_SCALE, DEMIAN_SCALE);
  if (p.spinT > 0) { ctx.translate(0, -1); ctx.rotate((1 - p.spinT / .45) * Math.PI * 2); ctx.translate(0, 1); }
  // The 360° turn never squashes the body: he faces the other way for the back half of the turn.
  if (p.special?.kind === 'whirl') { const turn = p.special.t / .45; whirlTrail(ctx, turn); if (Math.cos(turn * Math.PI * 2) < 0) ctx.scale(-1, 1); }
  if (p.special?.kind === 'dash') dashTrail(ctx, p.special.t / .24);
  const walkProfile = p.onGround && Math.abs(p.vx) > .15 && p.attackT < 0 && !p.special && !(p.jumpPrep && p.jumpPrep > 0);
  const profile = walkProfile ? Math.min(1, Math.abs(p.vx) / 1.4) : 0;
  const hipSpread = .075 - profile * .045;
  const hip: Pt = [pose.lean * .08 + (pose.hipOffset?.[0] ?? 0), -.965 + pose.bob * (walkProfile ? 1 : .45) + pose.crouch * .3 + (pose.hipOffset?.[1] ?? 0) + (p.landT > 0 ? p.landT * .32 : 0)];
  const neck: Pt = [hip[0] + Math.sin(pose.lean) * .62, hip[1] - Math.cos(pose.lean) * .62];
  const shoulders: Pt[] = [-1, 1].map(side => { const x = side * (.2 - profile * .15); return [neck[0] + x * Math.cos(pose.lean) - .09 * Math.sin(pose.lean),
    neck[1] + x * Math.sin(pose.lean) + .09 * Math.cos(pose.lean)]; });
  const cycle = humanWalk(p.walkT * 7 / 2.4, Math.abs(p.vx), .88 * VAMP_VISUAL_SCALE, true);
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
  // Bones never stretch: if a target foot is out of reach, the shin stops at its real length.
  for (let i = 0; i < 2; i++) {
    const dx = feet[i][0] - knees[i][0], dy = feet[i][1] - knees[i][1], d = Math.hypot(dx, dy) || 1;
    feet[i] = [knees[i][0] + dx / d * .45, knees[i][1] + dy / d * .45];
  }
  // Anchor the supporting boot to the same collision surface, without changing the player's world position.
  const floor = p.onGround && (!moving || !!pose.feet) ? Math.max(...feet.map(f => f[1])) + .105 : 0;
  ctx.translate(0, -floor);
  const wind = Math.min(.25, Math.abs(p.vx) * .025) + (p.onGround ? 0 : .12);
  ctx.save(); ctx.translate(neck[0] - .08, neck[1] + .025); ctx.rotate(.03 + wind + Math.sin(rt * 5) * .025);
  // The upper gathering is at 45% of this cutout, attached at the collar/upper back.
  drawAsset(ctx, 'hunter', 10, -(.62 + wind) * .45, -.035, .62 + wind, 1.45); ctx.restore();
  const leg = (i: number) => {
    ctx.save(); if (!i) ctx.globalAlpha *= .83;
    limb(ctx, 6, [hip[0] + (i ? hipSpread : -hipSpread), hip[1]], knees[i], .215);
    limb(ctx, 7, knees[i], feet[i], .18);
    const bootAngle = moving && !pose.feet ? cycle.fa[i] : pose.feet || p.onGround && Math.abs(p.vx) < .15 && p.attackT < 0 ? 0 : -(pose.legs[i][0] - pose.legs[i][1]) * .3;
    ctx.save(); ctx.translate(...feet[i]); ctx.rotate(bootAngle);
    drawAsset(ctx, 'hunter', 8, -.07, -.105, .24, .185); ctx.restore();
    jointArmor(ctx, knees[i], [hip[0] + (i ? hipSpread : -hipSpread), hip[1]], feet[i], .2, 'gilt', [1, 0]);
    ctx.restore();
  };
  const arm = (i: number, layer: 'upper' | 'forearm' | 'all') => {
    const [a, b] = pose.arms[i], elbow = add(shoulders[i], a, .31), hand = add(elbow, a + b, .30);
    const grip = add(hand, a + b, .035);
    ctx.save(); if (walkProfile ? cycle.arm[i] < 0 : !i) ctx.globalAlpha *= .88;
    if (layer !== 'forearm') {
      limb(ctx, 3, shoulders[i], elbow, .205);
      // Separate anatomical left/right plates: dome above, overlapping lames towards the elbow.
      part(ctx, i ? 16 : 9, [shoulders[i][0], shoulders[i][1] + .025], .27, .25, -a * .12);
    }
    if (layer !== 'upper') {
      limb(ctx, 4, elbow, hand, .17);
      jointArmor(ctx, elbow, shoulders[i], hand, .16, 'gilt', [-1, 0]);
      const bladeGrip = i === 1 && ['sword', 'firesword', 'violet', 'bone'].includes(p.attackT >= 0 ? p.attackWeapon : g.weapon);
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
  const depth = walkProfile ? walkingDepth(cycle)
    : { back: [0], front: [1] };
  for (const side of depth.back) arm(side, 'all');
  if (pose.weaponBehind) {
    const [a, b] = pose.arms[1], elbow = add(shoulders[1], a, .31), hand = add(elbow, a + b, .30);
    paintWeapon(add(hand, a + b, .035), a + b + pose.blade);
  }
  let torso = 1;
  if (g.weapon === 'ice') torso = 14;
  if (g.weapon === 'bone') torso = 15;
  part(ctx, torso, [hip[0] + Math.sin(pose.lean) * .33, hip[1] - Math.cos(pose.lean) * .33], .58 - profile * .15, .72, pose.lean, ARMOR_TONE[g.weapon], profile * .28);
  if (!walkProfile) part(ctx, 9, [shoulders[0][0], shoulders[0][1] + .025], .27, .25, -pose.arms[0][0] * .12);
  leg(1);
  part(ctx, 2, [hip[0], hip[1] + .10], .45 - profile * .1, .35, pose.lean * .4);
  // Demian's face (photo cutout, bigger than the painted head). The neck stub tucks into the gorget.
  const headTilt = pose.head * .4;
  const head: Pt = [neck[0] + .04, neck[1] - .145];
  ctx.save(); ctx.translate(neck[0] + .01, neck[1] + .05); ctx.rotate(headTilt);
  if (!drawAsset(ctx, 'demian-face', 0, -DEMIAN_FACE.w * .34, -DEMIAN_FACE.h, DEMIAN_FACE.w, DEMIAN_FACE.h)) part(ctx, 0, [.025, -.2], .316, .368);
  ctx.restore();
  const helmet = g.guardHp > 0 ? 12 : g.weapon === 'holy' || g.weapon === 'cross' ? 11 : g.weapon === 'bone' ? 13 : -1;
  if (helmet >= 0) part(ctx, helmet, [head[0] + .005, head[1] - .015], .33, .375, headTilt);
  for (const side of depth.front) arm(side, 'all');
  if (p.attackT > .025 && p.attackT < .18 && ['firesword', 'violet', 'bone'].includes(p.attackWeapon)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.sin(p.attackT / .18 * Math.PI) * .32;
    ctx.strokeStyle = p.attackWeapon === 'firesword' ? '#efb778' : p.attackWeapon === 'violet' ? '#c6a2c7' : '#c7d6d9';
    ctx.lineWidth = .027; ctx.beginPath(); ctx.arc(shoulders[1][0], shoulders[1][1], 1.35, -.9, .45); ctx.stroke(); ctx.restore();
  }
  if (g.guardHp > 0) {
    ctx.strokeStyle = `rgba(225,196,131,${.15 + g.guardHp / 180})`; ctx.lineWidth = .012;
    ctx.beginPath(); ctx.ellipse(0, -.93, .67, 1.03, 0, 0, Math.PI * 2); ctx.stroke();
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
  const { cycle: g, prepare, airborne, action, breath, hip, neck, lean, legs } = vampireRigPose(v, .88 * VAMP_VISUAL_SCALE, t);
  const { windup, extension } = action;
  const heavy = v.kind === 'giant', wolf = v.kind === 'wolf';
  const walkProfile = !airborne && !action.active && Math.abs(v.vx) > .15;
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
  // right shoulder (near the camera); the left shoulder is on the far side, behind the chest. So the right arm
  // (index 1, the one that carries the weapon) hangs from that armhole IN FRONT of the torso and the left arm
  // (index 0) hangs from the far shoulder BEHIND it. Walking in profile both shoulders are almost together.
  const torsoW = (heavy ? .65 : wolf ? .59 : .51) * (walkProfile ? .76 : 1) + breath;
  const carryKind = ['mage', 'hammer', 'warrior'].includes(v.kind);
  // Where along the weapon the fist closes (fraction from its top) and how long it is.
  const GRIP: Record<string, { at: number; len: number }> = { mage: { at: .3, len: 1.55 }, hammer: { at: .74, len: 1.2 }, warrior: { at: .865, len: 1.15 } };
  const armPose = (i: number) => {
    const lateral = walkProfile ? (i ? -.045 : .045) : (i ? -1 : 1) * torsoW * .37;
    const shoulder: Pt = [neck[0] + lateral * Math.cos(lean) - .115 * Math.sin(lean),
      neck[1] + lateral * Math.sin(lean) + .115 * Math.cos(lean)];
    const carry = i === 1 && carryKind;
    let a: number, b: number;
    // Carrying: the mage leans on the staff like a walking stick (forearm level, staff upright, foot on the floor);
    // the hammer and the sword hang low and forward from a relaxed arm, so they never cover the face.
    const stick = v.kind === 'mage';
    if (carry) { a = (stick ? .45 : .22) + g.arm[i] * .14 - prepare * .2; b = stick ? .9 : .3; }
    else if (v.kind === 'warrior' && i === 0) { a = .35 + g.arm[i] * .05; b = 1.05; } // the shield arm, close to the chest
    else { const w = walkingArm(g, i, .31, .30, .18); a = w[0] - prepare * .35; b = w[1]; }
    if (airborne) { a = i ? .45 : -.4; b = carry && stick ? 1.1 : .4; }
    let weaponAngle = !carry ? 0 : stick ? .12 + g.arm[i] * .05 : v.kind === 'hammer' ? 2.55 : 2.25; // (0 = upright, + leans forward)
    if (action.active) {
      const rest = Math.max(0, 1 - windup - extension), mix3 = (r: number, w: number, e: number) => r * rest + w * windup + e * extension;
      const mage = v.kind === 'mage', giant = v.kind === 'giant', shieldArm = v.kind === 'warrior' && i === 0;
      if (mage) {
        // The staff stays still in its hand; the free hand pulls back to the chest, then points at Demian.
        if (i === 0) { const aimA = Math.PI / 2 + (v.aim ?? 0); a = mix3(a, .55, aimA); b = mix3(b, 1.7, .06); }
      } else if (v.state !== 'claw') { // Drácula: both arms up to call the bats or the lightning
        a = mix3(a, .35 + 1.1, v.state === 'zap' ? 2.6 : 1.5); b = mix3(b, .6, .3);
      } else if (shieldArm) {
        // the shield stays fixed against the body: it does not move with the blow
      } else if (giant) {
        // Both arms rise straight over the head, then come down together in a double-fisted smash.
        a = mix3(a, 2.85 - i * .12, .8 + i * .1); b = mix3(b, .35, .2);
      } else if (i === 1) {
        // An overhead blow, as in fighting games: the arm rises in FRONT up over the head with the elbow bent (the
        // weapon hangs behind the shoulder), then chops down and forward; the weapon sweeps over the top in one arc.
        const hammer = v.kind === 'hammer';
        a = mix3(a, carry ? 2.75 : 2.5, hammer ? .8 : carry ? 1.05 : 1.4);
        b = mix3(b, carry ? 1.85 : .9, hammer ? .12 : carry ? .2 : .1);
        weaponAngle = mix3(weaponAngle, v.kind === 'warrior' ? -1.9 : -2.35, hammer ? 2.45 : 1.6); // the hammer ends on the floor
      } else if (v.kind !== 'hammer') { // the free arm balances the blow (the hammer's is solved below: both hands on the handle)
        a = mix3(a, -.45, .9); b = mix3(b, .7, .3);
      }
    }
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
    if (v.kind !== 'hammer' || i !== 0 || !action.active) return pose;
    // The giant hammer is gripped with BOTH hands: the second fist closes lower on the handle.
    const lead = armPose(1), up: Pt = [Math.sin(lead.weaponAngle), -Math.cos(lead.weaponAngle)];
    const target: Pt = [lead.hand[0] - up[0] * .2, lead.hand[1] - up[1] * .2];
    const [ia, ib] = armIK(pose.shoulder, target), k = Math.min(1, (windup + extension) * 2.5);
    const a = pose.a + (ia - pose.a) * k, b = pose.b + (ib - pose.b) * k;
    const elbow = add(pose.shoulder, a, .31);
    return { ...pose, a, b, elbow, hand: add(elbow, a + b, .30) };
  };
  const far = (i: number) => walkProfile ? g.arm[i] < 0 : i === 0;
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
    pauldron(shoulder, a, !walkProfile && i === 0);
    if (carry) weapon(pose); // behind the forearm: the fingers close over the handle
    bone(3, elbow, add(hand, a + b, .065), heavy ? .23 : .17, .035);
    jointArmor(ctx, elbow, shoulder, hand, heavy ? .19 : .16, 'iron', [-1, 0]);
    ctx.restore();
  };
  // Both fists on the hammer: the second arm crosses in front of the chest to reach the handle.
  const depth = walkProfile ? walkingDepth(g) : v.kind === 'hammer' && action.active ? { back: [], front: [0, 1] } : { back: [0], front: [1] };
  leg(0); for (const side of depth.back) arm(side); leg(1);
  paint(1, [hip[0] + Math.sin(lean) * .30, hip[1] - Math.cos(lean) * .28], torsoW, .73, lean, walkProfile ? .24 : 0);
  if (v.kind === 'warrior') { // the shield is strapped to the far (left) forearm and covers the chest from the front
    const sp = armPose(0); paint(8, [sp.hand[0] + .06, sp.hand[1] - .06], .42, .62, lean * .5);
  }
  if (!drawEnemyHead(ctx, v.kind, [neck[0] + .02, neck[1]], -lean * .25 + g.sway * .008))
    paint(0, [neck[0] + .045, neck[1] - .14], wolf ? .39 : heavy ? .34 : .30, wolf ? .34 : .35, -lean * .25);
  for (const side of depth.front) arm(side);
  if (v.kind === 'mage' && action.active && extension > .05) { // the power gathers in the pointing hand
    const h = poseOf(0).hand, r = .16 + extension * .18;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], r);
    glow.addColorStop(0, `rgba(255,220,200,${.9 * extension})`); glow.addColorStop(.35, `rgba(255,60,50,${.7 * extension})`); glow.addColorStop(1, 'rgba(160,0,20,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(h[0], h[1], r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore(); return true;
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
export function drawRealisticEnemy(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (drawArticulatedEnemy(ctx, v, t)) return true;
  const [name, row] = enemyRows[v.kind]; if (!atlasReady(name)) return false;
  const atlas = META[name], idle = atlas.frames[row * 6];
  const articulated = !['flyer', 'dragon'].includes(v.kind) && ['walk', 'leap', 'rise'].includes(v.state);
  // The flyer holds one gliding pose; it only animates when it stretches and dives at the hunter.
  const flyer = v.kind === 'flyer', diving = flyer && v.state === 'dive';
  const frameIndex = articulated ? 0 : flyer ? (diving ? (v.t < .14 ? 5 : 3) : v.state === 'claw' ? 4 : 0) : enemyFrame(v, t);
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
  const f = META.effects.frames[index], canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
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
  const frame = Math.floor(t * 14 + seed * 3) % 8;
  if (!atlasReady('effects')) return false;
  const soft = softFireFrame(frame);
  if (!soft) return drawAsset(ctx, 'effects', frame, x - w / 2, y - h, w, h);
  ctx.drawImage(soft, x - w / 2, y - h, w, h); return true;
}
export const ARMOR_TONE: Partial<Record<Weapon, string>> = { ice: '#84bace', holy: '#b9a06a', venom: '#677d55', violet: '#8a708e', guard: '#c2ba9d', bone: '#a69a80' };

