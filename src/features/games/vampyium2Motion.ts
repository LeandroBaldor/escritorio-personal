import { humanWalk, legAngles, type Pt } from './vampyium2Gait';
import { ATTACK, BODY, DRAGON, DRAGON_DRAW, type Vamp } from './vampyium2';
export { DRAGON, DRAGON_DRAW };

export const VAMP_VISUAL_SCALE = 2.25;
export const VAMP_STEP_LENGTH = .58, VAMP_STANCE = .62;
const ease = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const accel = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (1.6 - .6 * k); }; // speeds up into the hit
export function vampireAttackMotion(v: Vamp) {
  const melee = v.state === 'claw', casting = v.state === 'cast' || v.state === 'zap';
  if (!melee && !casting) return { active: false, windup: 0, extension: 0, recovery: 0 };
  const at = melee ? ATTACK[v.kind]?.at ?? .36 : v.state === 'zap' ? .4 : .55;
  const duration = melee ? ATTACK[v.kind]?.dur ?? .7 : v.state === 'zap' ? 1.1 : .95;
  // QUIETO → ANTICIPACIÓN (carga, que se sostiene un instante arriba) → ACELERACIÓN (cada vez más rápido hasta el
  // impacto, exactamente en `at`, el mismo instante en que la lógica aplica el golpe) → IMPACTO con un pequeño
  // seguimiento (el brazo pasa un poco de largo y vuelve) → RECUPERACIÓN suave → QUIETO.
  const load = ease(v.t / (at * .52));
  const release = accel((v.t - at * .66) / (at * .34) + 1e-9); // (+1e-9: exactly 1 at the impact instant)
  const recovery = ease((v.t - at - .08) / Math.max(.1, duration - at - .08));
  const follow = Math.sin(Math.max(0, Math.min(1, (v.t - at) / .16)) * Math.PI) * .12;
  return { active: true, windup: load * (1 - release), extension: release * (1 - recovery) + follow * (1 - recovery), recovery };
}
export function vampireMotion(v: Vamp, modelScale: number) {
  const prepare = v.onGround && v.nav && ['up', 'gap'].includes(v.nav.kind)
    ? Math.max(0, Math.min(1, (1.15 - Math.abs(v.nav.tx - v.x)) / .8)) : 0;
  const cycle = humanWalk(v.walkT, v.onGround ? Math.abs(v.vx) : 0, modelScale * BODY[v.kind].k, true);
  return { cycle, prepare, airborne: !v.onGround };
}

// How each vampire loads and delivers its attack (lean back/forward, crouch while loading/striking, hip shift, stance).
export const ATTACK_STYLE: Partial<Record<Vamp['kind'], { back: number; lunge: number; load: number; drive: number; shift: number; front: number; rear: number }>> = {
  walker: { back: .16, lunge: .30, load: .06, drive: .10, shift: .16, front: .34, rear: .26 },
  dracula: { back: .14, lunge: .28, load: .05, drive: .09, shift: .15, front: .32, rear: .25 },
  wolf: { back: .18, lunge: .36, load: .12, drive: .12, shift: .2, front: .38, rear: .28 },
  giant: { back: .22, lunge: .34, load: -.02, drive: .2, shift: .12, front: .3, rear: .3 }, // rises with both arms up, then drops into the smash
  hammer: { back: .2, lunge: .42, load: .04, drive: .26, shift: .14, front: .36, rear: .32 },
  warrior: { back: .12, lunge: .3, load: .07, drive: .1, shift: .17, front: .36, rear: .26 },
  mage: { back: .04, lunge: .1, load: .03, drive: .03, shift: .06, front: .22, rear: .2 }, // stands firm and points
};
// A separate ankle and boot keep the supporting sole fixed while the knee and heel move.
export const VAMP_BOOT = { left: -.09, right: .21, bottom: .09, top: -.045, width: .30, height: .135 };
export function vampireRigPose(v: Vamp, modelScale: number, time: number) {
  const motion = vampireMotion(v, modelScale), g = motion.cycle;
  const action = vampireAttackMotion(v), { windup, extension } = action;
  const breath = Math.sin(time * 2.6 + v.id * .7) * .004;
  // Each attack takes its own impulse: weight back and down while loading, then forward into the blow.
  const st = ATTACK_STYLE[v.kind] ?? ATTACK_STYLE.walker!;
  const engaged = action.active ? ease(Math.min(1, (windup + extension) * 1.6)) : 0;
  const weightShift = -windup * st.shift * .55 + extension * st.shift;
  const crouch = motion.prepare * .15 + (v.landT ?? 0) / .14 * .10 + windup * st.load + extension * st.drive;
  const hip: Pt = [g.sway * .009 + weightShift, -.965 + g.bob + crouch]; // (breathing moves the chest, never the hips: standing knees stay still)
  const lean = (v.kind === 'wolf' ? .12 : .025) + motion.prepare * .12
    + (motion.airborne ? .08 : 0) - windup * st.back + extension * st.lunge + g.sway * .012;
  const neck: Pt = [hip[0] + Math.sin(lean) * .62, hip[1] - Math.cos(lean) * .62];
  // Opening the attack stance and closing it again are STEPS, not slides: the foot that moves lifts in a small arc
  // (the front foot going in and coming back; the rear foot also steps back under the hips at the end).
  const arc = Math.sin(Math.PI * engaged);
  const stepLift = [action.recovery > 0 ? arc * .05 : 0, arc * .08];
  // Leg 0 is the FAR leg (on the far side of the three-quarter body, like arm 0) and leg 1 the NEAR one: each leg
  // pairs with the arm of its own side, so the arms swing against their own legs (right arm with left leg).
  const legs = [0, 1].map(i => {
    const origin: Pt = [hip[0] + (i ? -.055 : .055), hip[1]];
    const footAngle = motion.airborne ? (i ? -.12 : .20) : g.fa[i];
    const soleBottom = Math.max(VAMP_BOOT.left * Math.sin(footAngle), VAMP_BOOT.right * Math.sin(footAngle))
      + VAMP_BOOT.bottom * Math.cos(footAngle);
    const groundPivot = footAngle >= 0 ? VAMP_BOOT.right : VAMP_BOOT.left;
    const rollOffset = groundPivot - (groundPivot * Math.cos(footAngle) - VAMP_BOOT.bottom * Math.sin(footAngle));
    // Standing: legs straight under the hips. Attacking: the stance opens smoothly (no pop), front foot forward.
    const walkX = (i ? -.055 : .055) + (i ? -.085 : .085) * (1 - g.k) + g.dx[i];
    const total = windup + extension, attackX = i ? (windup * .16 + extension * st.front) / Math.max(.001, total) : -st.rear;
    const x = walkX + (attackX - walkX) * engaged + rollOffset;
    const ankle: Pt = motion.airborne
      ? [origin[0] + (i ? .24 : -.18), -.19 - (v.vy > 0 ? .19 : .08) * (i ? 1 : .6)]
      : [x, -soleBottom - g.lift[i] - stepLift[i]];
    const [a] = legAngles(origin, ankle, .46, .44);
    const knee: Pt = [origin[0] + Math.sin(a) * .46, origin[1] + Math.cos(a) * .46];
    return { origin, knee, ankle, footAngle, soleBottom, contact: !motion.airborne && g.ph[i] < g.stance };
  });
  return { ...motion, action, breath, hip, neck, lean, legs };
}

export const ease01 = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
// 0 = wings up (as painted) … 1 = wings fully down. The downstroke (the push) takes 45% of the beat.
export function dragonWing(phase: number) {
  const p = ((phase % 1) + 1) % 1;
  return p < .45 ? ease01(p / .45) : 1 - ease01((p - .45) / .55);
}
// The wings turn from 'up' (DRAGON_WING_UP, a little above the painted wing) to 'fully down' (−DRAGON_WING_DOWN,
// the fingers pointing at the ground), about the shoulder (radians, clockwise positive: up raises the wing).
export const DRAGON_WING_UP = .3;
export const DRAGON_WING_DOWN = { near: 1.45, far: 1.35 };

