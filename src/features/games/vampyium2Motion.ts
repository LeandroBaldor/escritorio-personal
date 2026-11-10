import { gait } from './vampyium2Gait';
import { BODY, type Vamp } from './vampyium2';

export const VAMP_VISUAL_SCALE = 2.25;
export function vampireMotion(v: Vamp, modelScale: number) {
  const prepare = v.onGround && v.nav && ['up', 'gap'].includes(v.nav.kind)
    ? Math.max(0, Math.min(1, (1.15 - Math.abs(v.nav.tx - v.x)) / .8)) : 0;
  const cycle = gait(v.walkT, v.onGround ? Math.abs(v.vx) : 0,
    { S: .5, H: .17, K: modelScale * BODY[v.kind].k, bob: .035 });
  return { cycle, prepare, airborne: !v.onGround };
}
