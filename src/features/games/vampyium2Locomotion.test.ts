import { describe, expect, it } from 'vitest';
import { BODY, makeVamp, newGame, newPlayer, type VampKind } from './vampyium2';
import { VAMP_BOOT, VAMP_STANCE, VAMP_STEP_LENGTH, VAMP_VISUAL_SCALE, vampireRigPose } from './vampyium2Motion';
import { demianSwordPose } from './vampyium2Demian';

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
  it('carries the sword behind the head, holds a horizontal thrust in the damage window and returns continuously', () => {
    const p = newPlayer(); p.onGround = true; p.vx = 0;
    const idle = demianSwordPose(p, 0);
    const weapon = (at: number) => { const q = demianSwordPose({ ...p, attackT: at }, 0); return q.arms[1][0] + q.arms[1][1] + q.blade; };
    expect(idle.weaponBehind).toBe(true);
    expect(Math.cos(Math.PI / 2 - weapon(-1))).toBeLessThan(-.99);
    expect(Math.cos(Math.PI / 2 - weapon(.04))).toBeGreaterThan(.9);
    for (const at of [.05, .09, .13, .20]) expect(Math.cos(Math.PI / 2 - weapon(at))).toBeCloseTo(1, 8);
    expect(demianSwordPose({ ...p, attackT: .13 }, 0).feet![0][0]).toBeLessThan(idle.feet![0][0]);
    expect(weapon(.30)).toBeCloseTo(weapon(-1), 8);
    expect(weapon(.00001)).toBeCloseTo(weapon(-1), 5);
    expect(demianSwordPose({ ...p, vx: 3 }, 0).feet).toBeUndefined();
  });
});
