import { humanWalk, legAngles, type Pt } from './vampyium2Gait';
import { ATTACK, BODY, type Vamp } from './vampyium2';

export const VAMP_VISUAL_SCALE = 2.25;
export const VAMP_STEP_LENGTH = .58, VAMP_STANCE = .62;
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
  const cycle = humanWalk(v.walkT, v.onGround ? Math.abs(v.vx) : 0, modelScale * BODY[v.kind].k);
  return { cycle, prepare, airborne: !v.onGround };
}

// A separate ankle and boot keep the supporting sole fixed while the knee and heel move.
export const VAMP_BOOT = { left: -.09, right: .21, bottom: .09, top: -.045, width: .30, height: .135 };
export function vampireRigPose(v: Vamp, modelScale: number, time: number) {
  const motion = vampireMotion(v, modelScale), g = motion.cycle;
  const action = vampireAttackMotion(v), { windup, extension } = action;
  const breath = Math.sin(time * 2.6 + v.id * .7) * .004;
  const weightShift = -windup * .09 + extension * .16;
  const crouch = motion.prepare * .15 + (v.landT ?? 0) / .14 * .10 + windup * .12 + extension * .08;
  const hip: Pt = [g.sway * .009 + weightShift, -.965 + g.bob + crouch + breath];
  const lean = (v.kind === 'wolf' ? .12 : .025) + motion.prepare * .12
    + (motion.airborne ? .08 : 0) - windup * .14 + extension * .23 + g.sway * .012;
  const neck: Pt = [hip[0] + Math.sin(lean) * .62, hip[1] - Math.cos(lean) * .62];
  const legs = [0, 1].map(i => {
    const origin: Pt = [hip[0] + (i ? .055 : -.055), hip[1]];
    const footAngle = motion.airborne ? (i ? -.12 : .20) : g.fa[i];
    const soleBottom = Math.max(VAMP_BOOT.left * Math.sin(footAngle), VAMP_BOOT.right * Math.sin(footAngle))
      + VAMP_BOOT.bottom * Math.cos(footAngle);
    const groundPivot = footAngle >= 0 ? VAMP_BOOT.right : VAMP_BOOT.left;
    const rollOffset = groundPivot - (groundPivot * Math.cos(footAngle) - VAMP_BOOT.bottom * Math.sin(footAngle));
    const x = (action.active ? (i ? .27 : -.25)
      : (i ? .055 : -.055) + (i ? .13 : -.13) * (1 - g.k) + g.dx[i]) + rollOffset;
    const ankle: Pt = motion.airborne
      ? [origin[0] + (i ? .24 : -.18), -.19 - (v.vy > 0 ? .19 : .08) * (i ? 1 : .6)]
      : [x, -soleBottom - g.lift[i]];
    const [a] = legAngles(origin, ankle, .46, .44);
    const knee: Pt = [origin[0] + Math.sin(a) * .46, origin[1] + Math.cos(a) * .46];
    return { origin, knee, ankle, footAngle, soleBottom, contact: !motion.airborne && g.ph[i] < VAMP_STANCE };
  });
  return { ...motion, action, breath, hip, neck, lean, legs };
}
