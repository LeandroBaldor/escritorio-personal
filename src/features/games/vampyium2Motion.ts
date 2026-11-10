import { gait } from './vampyium2Gait';
import { ATTACK, BODY, type Vamp } from './vampyium2';

export const VAMP_VISUAL_SCALE = 2.25;
const ease = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
export function vampireAttackMotion(v: Vamp) {
  const melee = v.state === 'claw', casting = v.state === 'cast' || v.state === 'zap';
  if (!melee && !casting) return { active: false, windup: 0, extension: 0, recovery: 0 };
  const at = melee ? ATTACK[v.kind]?.at ?? .36 : v.state === 'zap' ? .4 : .55;
  const duration = melee ? ATTACK[v.kind]?.dur ?? .7 : v.state === 'zap' ? 1.1 : .95;
  const load = ease(v.t / (at * .72));
  const release = ease((v.t - at * .72) / (at * .28));
  const recovery = ease((v.t - at) / (duration - at));
  return { active: true, windup: load * (1 - release), extension: release * (1 - recovery), recovery };
}
export function vampireMotion(v: Vamp, modelScale: number) {
  const prepare = v.onGround && v.nav && ['up', 'gap'].includes(v.nav.kind)
    ? Math.max(0, Math.min(1, (1.15 - Math.abs(v.nav.tx - v.x)) / .8)) : 0;
  const cycle = gait(v.walkT, v.onGround ? Math.abs(v.vx) : 0,
    { S: .5, H: .17, K: modelScale * BODY[v.kind].k, bob: .035 });
  return { cycle, prepare, airborne: !v.onGround };
}
