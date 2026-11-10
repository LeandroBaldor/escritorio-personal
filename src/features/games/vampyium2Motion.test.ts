import { describe, expect, it } from 'vitest';
import { ATTACK, BLOW_AT, hitVamp, makeVamp, newGame, step, type VampKind } from './vampyium2';
import { vampireAttackMotion } from './vampyium2Motion';

describe('anticipation and recovery of vampire attacks', () => {
  for (const kind of ['walker', 'giant', 'hammer', 'warrior', 'wolf', 'dracula'] as VampKind[]) {
    it(kind + ' loads its weight before the original damage time and recovers afterwards', () => {
      const g = newGame(1, 1), attack = ATTACK[kind]!;
      const v = makeVamp(g, kind, { state: 'claw', onGround: true, t: attack.at * .65 });
      expect(vampireAttackMotion(v).windup).toBeGreaterThan(.9);
      expect(vampireAttackMotion(v).extension).toBe(0);
      v.t = attack.at;
      expect(vampireAttackMotion(v).extension).toBeCloseTo(1);
      expect(vampireAttackMotion(v).windup).toBe(0);
      v.t = attack.dur;
      expect(vampireAttackMotion(v).extension).toBe(0);
      expect(vampireAttackMotion(v).recovery).toBe(1);
    });
  }
  it('retains the wolf anatomy when its corpse bursts', () => {
    const g = newGame(1, 1); g.immortal = true; g.spawnT = 999;
    const v = makeVamp(g, 'wolf', { x: 8, hp: 1, maxHp: 1, onGround: true });
    g.vamps.push(v); hitVamp(g, v, 100, 'sword', 0);
    for (let i = 0; i < Math.ceil((BLOW_AT + .1) * 60); i++)
      step(g, { left: false, right: false, up: false, down: false, attack: false }, 1 / 60);
    expect(g.bones.length).toBeGreaterThan(5);
    expect(g.bones.every(b => b.source === 'wolf')).toBe(true);
  });
});
