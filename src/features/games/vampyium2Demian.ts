import type { Player } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { humanWalk, walkingArm } from './vampyium2Gait';
import { VAMP_VISUAL_SCALE } from './vampyium2Motion';

// Demian is drawn as tall as a normal vampire (the vampires' art is 12% bigger than the hunter's).
export const DEMIAN_SCALE = 1.095;
// One world unit of floor per this many units of Demian's drawing: the planted foot moves exactly with the floor.
export const DEMIAN_STRIDE_K = .88 * VAMP_VISUAL_SCALE * DEMIAN_SCALE;
export const demianWalk = (p: Pick<Player, 'walkT' | 'vx'>) => humanWalk(p.walkT * 7 / 2.4, Math.abs(p.vx), DEMIAN_STRIDE_K, true);
const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function demianSwordPose(p: Player): Pose {
  const active = p.attackT >= 0;
  // Shoulder carry -> lift -> horizontal thrust (speeding up: the blade is fully out when the hit window opens,
  // at 0.04 s) -> a small follow-through past the target -> visible hold -> eased return to the shoulder.
  const at = p.attackT, drive = Math.max(0, Math.min(1, at / .04 + 1e-9));
  const follow = active ? Math.sin(Math.max(0, Math.min(1, (at - .04) / .12)) * Math.PI) * .07 : 0;
  const extension = active ? (drive * drive * (1.6 - .6 * drive) + follow) * (1 - smooth((at - .21) / .09)) : 0;
  const running = p.onGround && Math.abs(p.vx) > .15;
  const cycle = demianWalk(p);
  const freeArm = running && !active ? walkingArm(cycle, 0, .34, .32) : [-.06, .16];
  const frontA = mix(.70, 1.40, extension), frontB = mix(2.50, .18, Math.min(1, extension)) - Math.max(0, extension - 1) * 1.2; // (follow-through: the arm reaches, the elbow opens)
  const lowered = running && !active ? cycle.k : 0;
  const carryArm = walkingArm(cycle, 1, .34, .32);
  const rightA = mix(frontA, carryArm[0], lowered), rightB = mix(frontB, carryArm[1], lowered);
  // Unwrap the angle through the overhead arc, avoiding a sweep through the torso.
  const swordAngle = mix(mix(-Math.PI / 2 - .06, -Math.PI * 1.5, Math.min(1, extension)), .75, lowered); // (the blade stays level in the follow-through)
  // Coming back from the lunge the front foot STEPS back (a small arc), it does not slide on the floor.
  const back = active ? smooth((at - .21) / .09) : 0, stepUp = Math.sin(back * Math.PI) * .07;
  const feet: [Pt, Pt] = [[mix(-.15, -.48, extension), -.06], [mix(.17, .44, extension), -.06 - stepUp]]; // standing straight, then the lunge
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
