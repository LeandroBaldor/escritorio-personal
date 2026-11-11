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

// Input-driven articulated poses keep hands, weapon and shoulder plates attached throughout each action.
export function drawRealisticHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, pose: Pose, t: number, paintWeapon: WeaponPainter) {
  if (!atlasReady('hunter')) return false;
  const rt = t;
  ctx.save();
  if (p.spinT > 0) { ctx.translate(0, -1); ctx.rotate((1 - p.spinT / .45) * Math.PI * 2); ctx.translate(0, 1); }
  if (p.special?.kind === 'whirl') ctx.scale(Math.cos(p.special.t / .45 * Math.PI * 2), 1);
  if (p.special?.kind === 'dash') { ctx.translate(.12, -.06); ctx.rotate(.2); }
  const walkProfile = p.onGround && Math.abs(p.vx) > .15 && p.attackT < 0 && !p.special && !(p.jumpPrep && p.jumpPrep > 0);
  const profile = walkProfile ? Math.min(1, Math.abs(p.vx) / 1.4) : 0;
  const hipSpread = .09 - profile * .055;
  const hip: Pt = [pose.lean * .08 + (pose.hipOffset?.[0] ?? 0), -.92 + pose.bob * (walkProfile ? 1 : .45) + pose.crouch * .3 + (pose.hipOffset?.[1] ?? 0) + (p.landT > 0 ? p.landT * .32 : 0)];
  const neck: Pt = [hip[0] + Math.sin(pose.lean) * .61, hip[1] - Math.cos(pose.lean) * .61];
  const shoulders: Pt[] = [-1, 1].map(side => { const x = side * (.25 - profile * .19); return [neck[0] + x * Math.cos(pose.lean) - .09 * Math.sin(pose.lean),
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
      feet[i] = [hip[0] + (i ? .40 : -.35), -.04];
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
  // Anchor the supporting boot to the same collision surface, without changing the player's world position.
  const floor = p.onGround && (!moving || !!pose.feet) ? Math.max(...feet.map(f => f[1])) + .105 : 0;
  ctx.translate(0, -floor);
  const wind = Math.min(.25, Math.abs(p.vx) * .025) + (p.onGround ? 0 : .12);
  ctx.save(); ctx.translate(neck[0] - .08, neck[1] + .025); ctx.rotate(.03 + wind + Math.sin(rt * 5) * .025);
  // The upper gathering is at 45% of this cutout, attached at the collar/upper back.
  drawAsset(ctx, 'hunter', 10, -(.7 + wind) * .45, -.035, .7 + wind, 1.48); ctx.restore();
  const leg = (i: number) => {
    ctx.save(); if (!i) ctx.globalAlpha *= .83;
    limb(ctx, 6, [hip[0] + (i ? hipSpread : -hipSpread), hip[1]], knees[i], .25);
    limb(ctx, 7, knees[i], feet[i], .205);
    const bootAngle = moving && !pose.feet ? cycle.fa[i] : pose.feet || p.onGround && Math.abs(p.vx) < .15 && p.attackT < 0 ? 0 : -(pose.legs[i][0] - pose.legs[i][1]) * .3;
    ctx.save(); ctx.translate(...feet[i]); ctx.rotate(bootAngle);
    drawAsset(ctx, 'hunter', 8, -.08, -.12, .27, .21); ctx.restore(); ctx.restore();
  };
  const arm = (i: number, layer: 'upper' | 'forearm' | 'all') => {
    const [a, b] = pose.arms[i], elbow = add(shoulders[i], a, .34), hand = add(elbow, a + b, .32);
    const grip = add(hand, a + b, .035);
    ctx.save(); if (walkProfile ? cycle.arm[i] < 0 : !i) ctx.globalAlpha *= .88;
    if (layer !== 'forearm') {
      limb(ctx, 3, shoulders[i], elbow, .245);
      // Separate anatomical left/right plates: dome above, overlapping lames towards the elbow.
      part(ctx, i ? 16 : 9, [shoulders[i][0], shoulders[i][1] + .025], .31, .29, -a * .12);
    }
    if (layer !== 'upper') {
      limb(ctx, 4, elbow, hand, .20);
      const bladeGrip = i === 1 && ['sword', 'firesword', 'violet', 'bone'].includes(p.attackT >= 0 ? p.attackWeapon : g.weapon);
      const weaponAngle = a + b + pose.blade;
      if (i === 1 && !pose.weaponBehind) paintWeapon(grip, weaponAngle);
      else if (!i && g.guardHp > 0) drawAsset(ctx, 'weapons', 10, grip[0] - .2, grip[1] - .23, .4, .58);
      // The handle passes behind all curled fingers; the wrist bends independently of the blade.
      const thrustGrip = bladeGrip && Math.abs(Math.cos(Math.PI / 2 - weaponAngle)) > .8 && p.attackT >= 0;
      const handId = !i && pose.relaxedHand ? 19 : bladeGrip && !thrustGrip ? 17 : 5;
      part(ctx, handId, grip, bladeGrip ? .175 : .15, bladeGrip ? .19 : .17,
        bladeGrip && !thrustGrip ? Math.PI - weaponAngle : -(a + b));
    }
    ctx.restore();
  };
  leg(0);
  const depth = walkProfile ? walkingDepth(cycle)
    : { back: [0], front: [1] };
  for (const side of depth.back) arm(side, 'all');
  if (pose.weaponBehind) {
    const [a, b] = pose.arms[1], elbow = add(shoulders[1], a, .34), hand = add(elbow, a + b, .32);
    paintWeapon(add(hand, a + b, .035), a + b + pose.blade);
  }
  let torso = 1;
  if (g.weapon === 'ice') torso = 14;
  if (g.weapon === 'bone') torso = 15;
  part(ctx, torso, [hip[0] + Math.sin(pose.lean) * .33, hip[1] - Math.cos(pose.lean) * .33], .69 - profile * .19, .73, pose.lean, ARMOR_TONE[g.weapon], profile * .28);
  if (!walkProfile) part(ctx, 9, [shoulders[0][0], shoulders[0][1] + .025], .31, .29, -pose.arms[0][0] * .12);
  leg(1);
  part(ctx, 2, [hip[0], hip[1] + .10], .51 - profile * .12, .37, pose.lean * .4);
  const head: Pt = [neck[0] + .035, neck[1] - .15];
  part(ctx, 0, head, .316, .368, pose.head * .4);
  const helmet = g.guardHp > 0 ? 12 : g.weapon === 'holy' || g.weapon === 'cross' ? 11 : g.weapon === 'bone' ? 13 : -1;
  if (helmet >= 0) part(ctx, helmet, [head[0], head[1] - .008], .345, .391, pose.head * .4);
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
    const { origin, knee, ankle, footAngle } = legs[i];
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
    ctx.restore();
  };
  const arm = (i: number, layer: 'all' | 'upper' | 'forearm' = 'all') => {
    const lateral = (i ? 1 : -1) * (walkProfile ? .045 : heavy ? .205 : wolf ? .18 : .155);
    const shoulder: Pt = [neck[0] + lateral * Math.cos(lean) - .11 * Math.sin(lean),
      neck[1] + lateral * Math.sin(lean) + .11 * Math.cos(lean)];
    const carry = i === 1 && ['mage', 'hammer', 'warrior'].includes(v.kind);
    const walkArm = walkingArm(g, i, .31, .30, carry ? 1.05 : .18);
    let a = airborne ? (i ? .55 : -.50) : walkArm[0] - prepare * .35;
    let b = walkArm[1];
    if (action.active) {
      const casting = v.state !== 'claw';
      a = casting ? .25 + windup * 1.4 + extension * (v.state === 'zap' ? 2.5 : 1.1)
        : i ? .18 - windup * (v.kind === 'hammer' ? 2.55 : .95) + extension * 1.35
          : -.12 - windup * .42 + extension * .8;
      b = casting ? .45 + windup * .35 : .55 + windup * .75 - extension * .50;
    }
    const elbow = add(shoulder, a, .31), hand = add(elbow, a + b, .30);
    ctx.save(); if (walkProfile ? g.arm[i] < 0 : !i) ctx.globalAlpha *= .88;
    if (layer !== 'forearm') bone(2, shoulder, elbow, heavy ? .25 : .19);
    if (layer !== 'upper') bone(3, elbow, add(hand, a + b, .065), heavy ? .23 : .17, .035);
    if (carry && layer !== 'upper') {
      const height = v.kind === 'mage' ? 1.65 : v.kind === 'hammer' ? 1.15 : 1.10;
      const width = height * assetAspect(atlas, base + 7);
      ctx.save(); ctx.translate(...hand);
      ctx.rotate(-.08 - windup * (v.kind === 'hammer' ? .65 : .35) + extension * (v.kind === 'mage' ? .15 : 1.2));
      paint(7, [.02, -height * .32], width, height); ctx.restore();
    }
    if (!i && v.kind === 'warrior' && layer !== 'upper') paint(8, [hand[0] - .04, hand[1] - .04], .40, .59);
    ctx.restore();
  };
  const depth = walkProfile ? walkingDepth(g) : { back: [0], front: [1] };
  leg(0); for (const side of depth.back) arm(side); leg(1);
  paint(1, [hip[0] + Math.sin(lean) * .30, hip[1] - Math.cos(lean) * .28], (heavy ? .65 : wolf ? .59 : .51) * (walkProfile ? .76 : 1) + breath, .73, lean, walkProfile ? .24 : 0);
  if (!drawEnemyHead(ctx, v.kind, [neck[0] + .02, neck[1]], -lean * .25 + g.sway * .008))
    paint(0, [neck[0] + .045, neck[1] - .14], wolf ? .39 : heavy ? .34 : .30, wolf ? .34 : .35, -lean * .25);
  for (const side of depth.front) arm(side);
  ctx.restore(); return true;
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
  const frameIndex = articulated ? 0 : enemyFrame(v, t);
  const f = atlas.frames[row * 6 + frameIndex];
  const cellW = atlas.width / 6, cellH = atlas.height / atlas.rows;
  const sy = (v.kind === 'dragon' ? 2.6 : v.kind === 'flyer' ? 1.95 : 2.05) / idle.h;
  const sx = sy * (v.kind === 'dragon' ? 1.55 : 1);
  const baseline = idle.y + idle.h - row * cellH;
  ctx.save();
  if ((v.hurtT ?? 0) > 0) ctx.rotate(-.06);
  if (v.state === 'mist') ctx.globalAlpha *= .3 + .15 * Math.sin(t * 7);
  const bob = v.state === 'hover' ? Math.sin(t * 4 + v.id) * .035 : 0;
  ctx.translate(0, bob + (v.kind === 'flyer' ? .65 : v.kind === 'dragon' ? 1.1 : 0));
  const x = (f.x - Math.floor((f.x + f.w / 2) / cellW) * cellW - cellW / 2) * sx;
  const y = (f.y - row * cellH - baseline) * sy;
  ctx.drawImage(images[name], f.x, f.y, f.w, f.h, x, y, f.w * sx, f.h * sy);
  if (v.kind === 'flyer') {
    const anchors = [[.56, .205], [.59, .25], [.58, .26], [.78, .51], [.63, .34], [.72, .40]];
    const [ax, ay] = anchors[frameIndex];
    drawEnemyHead(ctx, 'flyer', [(ax - .5) * cellW * sx, (ay * cellH - baseline) * sy], frameIndex >= 3 ? .12 : 0);
  }
  ctx.restore(); return true;
}

export function drawRealisticFire(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number) {
  const frame = Math.floor(t * 14 + seed * 3) % 8;
  return drawAsset(ctx, 'effects', frame, x - w / 2, y - h, w, h);
}
export const ARMOR_TONE: Partial<Record<Weapon, string>> = { ice: '#84bace', holy: '#b9a06a', venom: '#677d55', violet: '#8a708e', guard: '#c2ba9d', bone: '#a69a80' };

