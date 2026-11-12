import { describe, expect, it } from 'vitest';
import { ATTACK, BODY, DRAGON_MOUTH, makeVamp, newGame, newPlayer, type VampKind } from './vampyium2';
import { DRAGON, DRAGON_DRAW, DRAGON_WING_DOWN, dragonWing, VAMP_BOOT, VAMP_STANCE, VAMP_STEP_LENGTH, VAMP_VISUAL_SCALE, vampireAttackMotion, vampireRigPose } from './vampyium2Motion';
import { demianSwordPose, demianWalk } from './vampyium2Demian';
import { humanWalk, jointTransform, walkingArm, walkingDepth } from './vampyium2Gait';

const kinds: VampKind[] = ['walker', 'giant', 'mage', 'hammer', 'warrior', 'wolf', 'dracula'];
describe('walking contact from the supplied side-view reference', () => {
  for (const kind of kinds) it(kind + ': no sinking, both bones reach the ankle, and the supporting foot stays still in the world', () => {
    const game = newGame(1, 1), K = .88 * VAMP_VISUAL_SCALE * BODY[kind].k;
    const length = K * VAMP_STEP_LENGTH / VAMP_STANCE;
    const v = makeVamp(game, kind, { state: 'walk', onGround: true, vx: 2.2 });
    for (let i = 0; i < 120; i++) {
      v.walkT = i / 120 * length;
      const pose = vampireRigPose(v, .88 * VAMP_VISUAL_SCALE, 0);
      for (let j = 0; j < 2; j++) {
        const leg = pose.legs[j];
        expect(leg.ankle[1] + leg.soleBottom).toBeLessThanOrEqual(1e-8);
        if (leg.contact) expect(leg.ankle[1] + leg.soleBottom).toBeCloseTo(0, 8);
        expect(Math.hypot(leg.knee[0] - leg.origin[0], leg.knee[1] - leg.origin[1])).toBeCloseTo(.46, 8);
        expect(Math.hypot(leg.ankle[0] - leg.knee[0], leg.ankle[1] - leg.knee[1])).toBeCloseTo(.44, 7);
        if (pose.cycle.ph[j] > .02 && pose.cycle.ph[j] < VAMP_STANCE - .02) {
          const delta = .0001, pivot = leg.footAngle >= 0 ? VAMP_BOOT.right : VAMP_BOOT.left;
          const contactX = leg.ankle[0] + pivot * Math.cos(leg.footAngle) - VAMP_BOOT.bottom * Math.sin(leg.footAngle);
          const next = vampireRigPose({ ...v, walkT: v.walkT + delta }, .88 * VAMP_VISUAL_SCALE, 0).legs[j];
          const nextX = next.ankle[0] + pivot * Math.cos(next.footAngle) - VAMP_BOOT.bottom * Math.sin(next.footAngle);
          expect(K * (nextX - contactX) + delta).toBeCloseTo(0, 8);
        }
      }
    }
  });
});
describe('Demian reference poses', () => {
  it('keeps normal-speed walking but avoids seven tiny steps per second at actual player speed', () => {
    const K = .88 * VAMP_VISUAL_SCALE;
    expect(humanWalk(0, 3, K, true).stance).toBe(.62);
    const fast = humanWalk(0, 7, K, true);
    const stepsPerSecond = 2 * 7 * fast.stance / (K * .58);
    expect(stepsPerSecond).toBeLessThan(3.8);
    expect(fast.stance).toBeLessThan(.5);
    for (let i = 0; i < 100; i++) {
      const distance = i / 100 * K * .58 / fast.stance;
      const c = humanWalk(distance, 7, K, true);
      for (const side of [0, 1]) {
        const [a, b] = walkingArm(c, side, .34, .32);
        expect((Math.sin(a) * .34 + Math.sin(a + b) * .32) * c.dx[side]).toBeLessThanOrEqual(1e-10);
      }
    }
  });
  it('puts the entire same-side arm behind the chest when its leg leads, then swaps both arms', () => {
    for (let frame = 0; frame < 64; frame++) {
      const c = humanWalk(frame / 64 * .58 / .62, 3, 1);
      const depth = walkingDepth(c);
      for (const side of [0, 1]) {
        expect(depth.back.includes(side)).toBe(c.dx[side] > 0);
        expect(depth.front.includes(side)).toBe(c.dx[side] <= 0);
      }
    }
    const first = walkingDepth(humanWalk(0, 3, 1));
    const second = walkingDepth(humanWalk(.5 * .58 / .62, 3, 1));
    expect(first).toEqual({ back: [1], front: [0] });
    expect(second).toEqual({ back: [0], front: [1] });
  });
  it('lowers the sword while walking and counter-swings BOTH hands against their own legs', () => {
    const p = { ...newPlayer(), onGround: true, vx: 3 };
    const angles: number[][] = [[], []];
    for (let i = 0; i < 80; i++) {
      const walkT = i * .025, q = demianSwordPose({ ...p, walkT });
      const c = demianWalk({ walkT, vx: 3 });
      expect(q.weaponBehind).toBe(false);
      for (const side of [0, 1]) {
        const [a, b] = q.arms[side];
        expect((Math.sin(a) * .34 + Math.sin(a + b) * .32) * c.dx[side]).toBeLessThanOrEqual(1e-10);
        angles[side].push(a);
      }
    }
    for (const arm of angles) expect(Math.max(...arm) - Math.min(...arm)).toBeGreaterThan(.7);
  });
  it('aligns both painted joint centers, including an oblique upper arm, without bending the texture', () => {
    const a: [number, number] = [.7, .12], b: [number, number] = [.3, .85];
    for (const end of [[.4, .3], [-.2, .5], [.1, -.4]] as [number, number][]) {
      const m = jointTransform([0, 0], end, a, b, .64, .245);
      const x = (b[0] - a[0]) * m.width, y = (b[1] - a[1]) * m.height;
      expect(x * Math.cos(m.angle) - y * Math.sin(m.angle)).toBeCloseTo(end[0], 10);
      expect(x * Math.sin(m.angle) + y * Math.cos(m.angle)).toBeCloseTo(end[1], 10);
      expect(m.width / m.height).toBeCloseTo(.64, 10);
    }
  });
  it('uses alternating support and opposite arm swing throughout a complete human step', () => {
    for (let i = 0; i < 100; i++) {
      const c = humanWalk(i / 100 * (.58 / .62), 3, 1);
      for (let side = 0; side < 2; side++) {
        const [a, b] = walkingArm(c, side);
        const handX = Math.sin(a) * .31 + Math.sin(a + b) * .30;
        expect(handX * c.dx[side]).toBeLessThanOrEqual(1e-10);
        // Mirroring the complete rig must preserve opposition when walking left.
        expect((-handX) * (-c.dx[side])).toBeLessThanOrEqual(1e-10);
      }
      expect(c.ph.some(q => q < .62)).toBe(true);
      for (let j = 0; j < 2; j++) if (c.ph[j] < .62) expect(c.lift[j]).toBe(0);
    }
  });
  it('right leg forward means right hand back and left hand forward; the next step reverses it', () => {
    for (const phase of [0, .5]) {
      const c = humanWalk(phase * .58 / .62, 3, 1);
      const hands = [0, 1].map(side => {
        const [a, b] = walkingArm(c, side);
        return Math.sin(a) * .31 + Math.sin(a + b) * .30;
      });
      const rightForward = phase === 0;
      expect(c.dx[1] > 0).toBe(rightForward);
      expect(c.dx[0] < 0).toBe(rightForward);
      expect(hands[1] < 0).toBe(rightForward);
      expect(hands[0] > 0).toBe(rightForward);
    }
  });
  it('carries the sword behind the head, holds a horizontal thrust in the damage window and returns continuously', () => {
    const p = newPlayer(); p.onGround = true; p.vx = 0;
    const idle = demianSwordPose(p);
    const weapon = (at: number) => { const q = demianSwordPose({ ...p, attackT: at }); return q.arms[1][0] + q.arms[1][1] + q.blade; };
    expect(idle.weaponBehind).toBe(true);
    expect(Math.cos(Math.PI / 2 - weapon(-1))).toBeLessThan(-.99);
    expect(Math.cos(Math.PI / 2 - weapon(.04))).toBeGreaterThan(.9);
    for (const at of [.05, .09, .13, .20]) expect(Math.cos(Math.PI / 2 - weapon(at))).toBeCloseTo(1, 8);
    expect(demianSwordPose({ ...p, attackT: .13 }).feet![0][0]).toBeLessThan(idle.feet![0][0]);
    expect(weapon(.30)).toBeCloseTo(weapon(-1), 8);
    expect(weapon(.00001)).toBeCloseTo(weapon(-1), 5);
    expect(demianSwordPose({ ...p, vx: 3 }).feet).toBeUndefined();
  });
});

describe('standing still means still', () => {
  it('Demian parado: la cadera no sube ni baja (las rodillas no se mueven)', () => {
    const p = newPlayer();
    expect(demianSwordPose(p).bob).toBe(0);
    expect(demianSwordPose(p).hipOffset?.[1] ?? 0).toBe(0);
  });
  it('un vampiro parado tiene la cadera y las rodillas fijas en el tiempo', () => {
    const g = newGame(1, 1);
    for (const kind of ['walker', 'giant', 'warrior', 'wolf'] as VampKind[]) {
      const v = makeVamp(g, kind, { vx: 0, onGround: true, state: 'walk' });
      const a = vampireRigPose(v, 1, 0.3), b = vampireRigPose(v, 1, 1.7);
      expect(b.hip[1]).toBeCloseTo(a.hip[1], 6);
      expect(b.legs[0].knee[0]).toBeCloseTo(a.legs[0].knee[0], 6); expect(b.legs[1].knee[1]).toBeCloseTo(a.legs[1].knee[1], 6);
    }
  });
});

describe('attack timing (anticipation → acceleration → impact → follow-through → recovery)', () => {
  it('the blow lands exactly when the game applies the hit, speeding up into it, and settles back to rest', () => {
    const g = newGame(1, 1);
    for (const kind of ['walker', 'giant', 'hammer', 'warrior', 'wolf', 'dracula'] as VampKind[]) {
      const at = ATTACK[kind]!.at, dur = ATTACK[kind]!.dur, m = (t: number) => vampireAttackMotion(makeVamp(g, kind, { state: 'claw', t }));
      expect(m(at * .6).windup).toBeGreaterThan(.95); // fully loaded, held a moment before the swing
      expect(m(at).extension).toBeGreaterThan(.999); // impact
      const early = m(at * .73).extension - m(at * .67).extension, late = m(at).extension - m(at * .94).extension;
      expect(late).toBeGreaterThan(early); // accelerates into the hit
      expect(m(at + .08).extension).toBeGreaterThan(1); // follows through past the target
      expect(m(dur).extension).toBeLessThan(.02); expect(m(dur).windup).toBeLessThan(.02); // back to rest
      expect(at * .34 * 60).toBeGreaterThanOrEqual(4); // the swing itself is drawn over at least 4 frames
      let prev = m(0); for (let t = 1 / 60; t <= dur; t += 1 / 60) { const q = m(t); expect(Math.max(Math.abs(q.extension - prev.extension), Math.abs(q.windup - prev.windup))).toBeLessThan(.4); prev = q; } // no jumps between frames
    }
  });
});

describe('Drácula dragón flight', () => {
  it('the wing beat is a seamless loop that goes from fully up to fully down', () => {
    expect(dragonWing(0)).toBeCloseTo(dragonWing(1), 6);
    const samples = Array.from({ length: 200 }, (_, i) => dragonWing(i / 200));
    expect(Math.min(...samples)).toBeCloseTo(0, 3); expect(Math.max(...samples)).toBeCloseTo(1, 3);
    for (let i = 1; i < samples.length; i++) expect(Math.abs(samples[i] - samples[i - 1])).toBeLessThan(.05);
  });
  it('fully down, both wing tips point downwards (not just level)', () => {
    const tip = (root: number[], t: number[], a: number) => { const x = t[0] - root[0], y = t[1] - root[1]; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
    // (the wing tips, in the body's pixels, with the wings as painted: near wing full size, far wing at DRAGON.wing.far)
    const near = tip(DRAGON.rootNear, [32, 12], -DRAGON_WING_DOWN.near), far = tip(DRAGON.rootFar, [306, 30], -DRAGON_WING_DOWN.far);
    expect(near[1]).toBeGreaterThan(Math.abs(near[0]) * .5); expect(far[1]).toBeGreaterThan(Math.abs(far[0]) * .5);
  });
  it('the fire comes out of the drawn mouth', () => {
    const k = .88 * VAMP_VISUAL_SCALE * BODY.dragon.k;
    const mx = (DRAGON_DRAW.x + (DRAGON.mouth[0] - DRAGON.center[0]) * DRAGON_DRAW.scale) * k;
    const my = -(DRAGON_DRAW.y + (DRAGON.mouth[1] - DRAGON.center[1]) * DRAGON_DRAW.scale) * k;
    expect(Math.abs(mx - DRAGON_MOUTH.x)).toBeLessThan(.25); expect(Math.abs(my - DRAGON_MOUTH.y)).toBeLessThan(.25);
  });
});
