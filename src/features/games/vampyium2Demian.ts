import type { Player } from './vampyium2';
import type { Pose, Pt } from './vampyium2Chars';
import { humanWalk } from './vampyium2Gait';
import { VAMP_VISUAL_SCALE } from './vampyium2Motion';

const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function demianSwordPose(p: Player, time: number): Pose {
  const active = p.attackT >= 0;
  // Shoulder carry -> lift -> horizontal thrust -> visible hold -> return to the shoulder.
  const extension = active ? smooth(p.attackT / .05) * (1 - smooth((p.attackT - .21) / .09)) : 0;
  const running = p.onGround && Math.abs(p.vx) > .15;
  const cycle = humanWalk(p.walkT * 7 / 2.4, Math.abs(p.vx), .88 * VAMP_VISUAL_SCALE);
  const breath = Math.sin(time * 2.8) * .009;
  const frontA = mix(.70, 1.40, extension), frontB = mix(2.50, .18, extension);
  // Unwrap the angle through the overhead arc, avoiding a sweep through the torso.
  const swordAngle = mix(-Math.PI / 2 - .06, -Math.PI * 1.5, extension);
  const feet: [Pt, Pt] = [[mix(-.23, -.48, extension), -.06], [mix(.23, .44, extension), -.06]];
  return {
    bob: running && !active ? cycle.bob : breath,
    lean: mix(.015 + (running ? cycle.sway * .012 : 0), .24, extension), crouch: 0, head: -.08 * extension,
    hipOffset: [extension * .13, mix(-.015, .12, extension)],
    feet: running || !p.onGround ? undefined : feet,
    weaponBehind: extension < .35,
    relaxedHand: !active,
    legs: [[-.16, .18], [.16, .18]],
    arms: [[mix(running && !active ? cycle.arm[0] * .38 : -.06, -.65, extension), mix(.16 + (running && !active ? Math.max(0, cycle.arm[0]) * .16 : 0), .70, extension)],
      [frontA, frontB]],
    blade: swordAngle - frontA - frontB,
  };
}
