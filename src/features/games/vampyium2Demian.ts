import type { Player } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { humanWalk, walkingArm } from './vampyium2Gait';
import { VAMP_VISUAL_SCALE } from './vampyium2Motion';

const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function demianSwordPose(p: Player): Pose {
  const active = p.attackT >= 0;
  // Shoulder carry -> lift -> horizontal thrust -> visible hold -> return to the shoulder.
  const extension = active ? smooth(p.attackT / .05) * (1 - smooth((p.attackT - .21) / .09)) : 0;
  const running = p.onGround && Math.abs(p.vx) > .15;
  const cycle = humanWalk(p.walkT * 7 / 2.4, Math.abs(p.vx), .88 * VAMP_VISUAL_SCALE, true);
  const freeArm = running && !active ? walkingArm(cycle, 0, .34, .32) : [-.06, .16];
  const frontA = mix(.70, 1.40, extension), frontB = mix(2.50, .18, extension);
  const lowered = running && !active ? cycle.k : 0;
  const carryArm = walkingArm(cycle, 1, .34, .32);
  const rightA = mix(frontA, carryArm[0], lowered), rightB = mix(frontB, carryArm[1], lowered);
  // Unwrap the angle through the overhead arc, avoiding a sweep through the torso.
  const swordAngle = mix(mix(-Math.PI / 2 - .06, -Math.PI * 1.5, extension), .75, lowered);
  const feet: [Pt, Pt] = [[mix(-.15, -.48, extension), -.06], [mix(.17, .44, extension), -.06]]; // standing straight, then the lunge
  return {
    bob: running && !active ? cycle.bob : 0, // standing still: the hips do not move, so the knees stay put
    lean: mix(.015 + (running ? cycle.sway * .012 : 0), .24, extension), crouch: 0, head: -.08 * extension,
    hipOffset: [extension * .13, mix(0, .12, extension)],
    feet: running || !p.onGround ? undefined : feet,
    weaponBehind: extension < .35 && !lowered,
    relaxedHand: !active,
    legs: [[-.16, .18], [.16, .18]],
    arms: [[mix(freeArm[0], -.65, extension), mix(freeArm[1], .70, extension)],
      [rightA, rightB]],
    blade: swordAngle - rightA - rightB,
  };
}
