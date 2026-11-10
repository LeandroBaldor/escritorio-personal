import metadata from './assets/vampyium2/atlas.json';
import type { Game, Player, Vamp, Weapon } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { ATTACK } from './vampyium2';
import { legAngles } from './vampyium2Gait';

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
  preloadRealisticArt(); await Promise.all(Object.values(images).map(image => image.decode()));
  return Object.keys(META).every(atlasReady);
}
export function realisticArtStatus() {
  return Object.entries(META).map(([name, atlas]) => ({ name, ready: atlasReady(name), frames: atlas.frames.length }));
}
export function drawAsset(ctx: CanvasRenderingContext2D, name: string, index: number, x: number, y: number, w: number, h: number, tint?: string) {
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
  ctx.drawImage(source, tint ? 0 : f.x, tint ? 0 : f.y, f.w, f.h, x, y, w, h); return true;
}
export function assetAspect(name: string, index: number) {
  const frame = META[name]?.frames[index]; return frame ? frame.w / frame.h : 1;
}

const add = (a: Pt, angle: number, l: number): Pt => [a[0] + Math.sin(angle) * l, a[1] + Math.cos(angle) * l];
function part(ctx: CanvasRenderingContext2D, id: number, center: Pt, w: number, h: number, angle = 0, tint?: string) {
  ctx.save(); ctx.translate(...center); ctx.rotate(angle);
  drawAsset(ctx, 'hunter', id, -w / 2, -h / 2, w, h, tint); ctx.restore();
}
function limb(ctx: CanvasRenderingContext2D, id: number, start: Pt, end: Pt, width: number) {
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
  part(ctx, id, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], width, length + .065, -Math.atan2(dx, dy));
}
type WeaponPainter = (hand: Pt, angle: number) => void;

// All limbs use the original action poses. Only visual frames are stepped; physics and input remain continuous.
export function drawRealisticHunter(ctx: CanvasRenderingContext2D, p: Player, g: Game, pose: Pose, t: number, paintWeapon: WeaponPainter) {
  if (!atlasReady('hunter')) return false;
  const rt = Math.floor(t * 12) / 12;
  ctx.save();
  if (p.spinT > 0) { ctx.translate(0, -1); ctx.rotate((1 - p.spinT / .45) * Math.PI * 2); ctx.translate(0, 1); }
  if (p.special?.kind === 'whirl') ctx.scale(Math.cos(p.special.t / .45 * Math.PI * 2), 1);
  if (p.special?.kind === 'dash') { ctx.translate(.12, -.06); ctx.rotate(.2); }
  const hip: Pt = [pose.lean * .08, -.92 + pose.bob * .45 + pose.crouch * .3 + (p.landT > 0 ? p.landT * .32 : 0)];
  const neck: Pt = [hip[0] + Math.sin(pose.lean) * .61, hip[1] - Math.cos(pose.lean) * .61];
  const shoulders: Pt[] = [[neck[0] - .245, neck[1] + .085], [neck[0] + .185, neck[1] + .09]];
  const feet: Pt[] = [], knees: Pt[] = [];
  for (let i = 0; i < 2; i++) {
    const origin: Pt = [hip[0] + (i ? .09 : -.09), hip[1] + .03];
    const [a, b] = pose.legs[i], knee = add(origin, a, .46), foot = add(knee, a - b, .45);
    knees.push(knee); feet.push(foot);
  }
  if (p.onGround && Math.abs(p.vx) < .15 && p.attackT < 0 && !p.special) {
    for (let i = 0; i < 2; i++) {
      const origin: Pt = [hip[0] + (i ? .09 : -.09), hip[1] + .03];
      feet[i] = [hip[0] + (i ? .2 : -.17), -.04];
      const [angle] = legAngles(origin, feet[i], .46, .45);
      knees[i] = add(origin, angle, .46);
    }
  }
  // Anchor the supporting boot to the same collision surface, without changing the player's world position.
  const floor = p.onGround ? Math.max(...feet.map(f => f[1])) + .055 : 0;
  ctx.translate(0, -floor);
  const wind = Math.min(.25, Math.abs(p.vx) * .025) + (p.onGround ? 0 : .12);
  ctx.save(); ctx.translate(neck[0] - .12, neck[1] + .02); ctx.rotate(.03 + wind + Math.sin(rt * 5) * .025);
  drawAsset(ctx, 'hunter', 10, -.54 - wind, -.05, .7 + wind, 1.48); ctx.restore();
  const leg = (i: number) => {
    ctx.save(); if (!i) ctx.globalAlpha *= .83;
    limb(ctx, 6, [hip[0] + (i ? .09 : -.09), hip[1]], knees[i], .205);
    limb(ctx, 7, knees[i], feet[i], .18);
    const bootAngle = p.onGround && Math.abs(p.vx) < .15 && p.attackT < 0 ? 0 : -(pose.legs[i][0] - pose.legs[i][1]) * .3;
    part(ctx, 8, [feet[i][0] + .045, feet[i][1] + .015], .29, .18, bootAngle); ctx.restore();
  };
  const arm = (i: number, layer: 'upper' | 'forearm' | 'all') => {
    const [a, b] = pose.arms[i], elbow = add(shoulders[i], a, .34), hand = add(elbow, a + b, .32);
    const grip = add(hand, a + b, .035);
    ctx.save(); if (!i) ctx.globalAlpha *= .94;
    if (layer !== 'forearm') {
      limb(ctx, 3, shoulders[i], elbow, .185);
      part(ctx, 9, shoulders[i], .25, .18, -a * .15);
    }
    if (layer !== 'upper') {
      limb(ctx, 4, elbow, hand, .16);
      // Wrist/cuff overlaps the vambrace. The fingers cover the handle, not the guard.
      part(ctx, 5, grip, .125, .15, -(a + b));
      if (i === 1) paintWeapon(grip, a + b + pose.blade);
      else if (g.guardHp > 0) drawAsset(ctx, 'weapons', 10, grip[0] - .2, grip[1] - .23, .4, .58);
      ctx.save(); ctx.beginPath(); ctx.ellipse(grip[0], grip[1], .047, .052, -(a + b), 0, Math.PI * 2); ctx.clip();
      part(ctx, 5, grip, .125, .15, -(a + b)); ctx.restore();
    }
    ctx.restore();
  };
  leg(0); arm(0, 'upper');
  let torso = 1;
  if (g.weapon === 'ice') torso = 14;
  if (g.weapon === 'bone') torso = 15;
  part(ctx, torso, [hip[0] + pose.lean * .17, hip[1] - .29], .49, .65, pose.lean, ARMOR_TONE[g.weapon]);
  part(ctx, 2, [hip[0], hip[1] + .10], .46, .37, pose.lean * .4);
  leg(1);
  const head: Pt = [neck[0] + .02, neck[1] - .12];
  part(ctx, 0, head, .275, .32, pose.head * .4);
  const helmet = g.guardHp > 0 ? 12 : g.weapon === 'holy' || g.weapon === 'cross' ? 11 : g.weapon === 'bone' ? 13 : -1;
  if (helmet >= 0) part(ctx, helmet, [head[0], head[1] - .008], .30, .34, pose.head * .4);
  // The rear upper arm stays behind the chest; its forearm and hand cross in front.
  arm(0, 'forearm'); arm(1, 'all');
  if (p.attackT > .025 && p.attackT < .18 && ['sword', 'firesword', 'violet', 'bone'].includes(p.attackWeapon)) {
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
  const [name, row] = enemyRows[v.kind]; if (!atlasReady(name)) return false;
  const atlas = META[name], f = atlas.frames[row * 6 + enemyFrame(v, t)], idle = atlas.frames[row * 6];
  const cellW = atlas.width / 6, cellH = atlas.height / atlas.rows;
  const sy = (v.kind === 'dragon' ? 2.6 : v.kind === 'flyer' ? 1.95 : 2.05) / idle.h;
  const sx = sy * (v.kind === 'dragon' ? 1.55 : 1);
  const baseline = idle.y + idle.h - row * cellH;
  ctx.save();
  if ((v.hurtT ?? 0) > 0) ctx.rotate(-.06);
  if (v.state === 'mist') ctx.globalAlpha *= .3 + .15 * Math.sin(t * 7);
  const bob = v.state === 'hover' ? Math.sin(t * 4 + v.id) * .035 : 0;
  ctx.translate(0, bob + (v.kind === 'flyer' ? .65 : v.kind === 'dragon' ? 1.1 : 0));
  ctx.drawImage(images[name], f.x, f.y, f.w, f.h,
    (f.x - Math.floor((f.x + f.w / 2) / cellW) * cellW - cellW / 2) * sx,
    (f.y - row * cellH - baseline) * sy, f.w * sx, f.h * sy);
  ctx.restore(); return true;
}

export function drawRealisticFire(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number) {
  const frame = Math.floor(t * 14 + seed * 3) % 8;
  return drawAsset(ctx, 'effects', frame, x - w / 2, y - h, w, h);
}
export const ARMOR_TONE: Partial<Record<Weapon, string>> = { ice: '#84bace', holy: '#b9a06a', venom: '#677d55', violet: '#8a708e', guard: '#c2ba9d', bone: '#a69a80' };
