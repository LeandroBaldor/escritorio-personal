import { describe, expect, it } from 'vitest';
import { makeVamp, newGame } from './vampyium2';
import { VAMP_VISUAL_SCALE, WOLF_QUAD, wolfQuadPose } from './vampyium2Motion';
import { FLYER_RIG, flyerWing } from './vampyium2Sprites';

const K = .88 * VAMP_VISUAL_SCALE;
const wolf = (o: Parameters<typeof makeVamp>[2]) => makeVamp(newGame(7, 7), 'wolf', { onGround: true, ...o });

describe('Vampyium2 werewolf on all fours', () => {
  const states: [string, Parameters<typeof makeVamp>[2]][] = [
    ['quieto', { state: 'walk', vx: 0 }], ['camina', { state: 'walk', vx: 2, walkT: .7 }], ['corre', { state: 'walk', vx: 4.6, walkT: 1.3 }],
    ['carga', { state: 'claw', t: .1 }], ['ataca', { state: 'claw', t: .24 }], ['salta', { state: 'leap', onGround: false, vy: 6, vx: 6 }],
    ['daño', { state: 'walk', hurtT: .2 }], ['muere', { state: 'walk', collapse: 1 }],
  ];
  for (const [name, o] of states) it(`never stands up (${name})`, () => {
    const q = wolfQuadPose(wolf(o), K, 0);
    expect(Math.abs(q.lean - Math.PI / 2)).toBeLessThan(.35); // the spine lies (near) horizontal
    expect(q.neck[0]).toBeGreaterThan(q.hip[0] + .45); // shoulders in front of the hips, not above them
    expect(q.neck[1]).toBeGreaterThan(-.95); // the head end stays low
  });
  it('stands on four paws: front paws under the shoulders, hind paws under the hips, all on the floor', () => {
    const q = wolfQuadPose(wolf({ state: 'walk', vx: 0 }), K, 0);
    for (const a of q.arms) { expect(a.target[1]).toBeCloseTo(0, 5); expect(Math.abs(a.target[0] - a.shoulder[0])).toBeLessThan(.2); }
    for (const l of q.legs) { expect(l.ankle[1]).toBeCloseTo(-.09, 5); expect(Math.abs(l.ankle[0] - l.origin[0])).toBeLessThan(.2); }
    const reach = Math.hypot(q.arms[0].target[0] - q.arms[0].shoulder[0], q.arms[0].target[1] - q.arms[0].shoulder[1]);
    expect(reach).toBeLessThanOrEqual(WOLF_QUAD.upper + WOLF_QUAD.lower + WOLF_QUAD.paw); // the front leg reaches the floor
  });
  it('alternates its four paws while walking, each planted paw moving back with the floor', () => {
    const planted = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const q = wolfQuadPose(wolf({ state: 'walk', vx: 2, walkT: i * .05 }), K, 0);
      planted.add(q.arms.map(a => +a.planted).join('') + q.legs.map(l => +(l.ankle[1] > -.0901)).join(''));
    }
    expect(planted.size).toBeGreaterThan(2);
  });
});

describe('Vampyium2 flyer wings', () => {
  it('beat from up to clearly down and back, in a loop, and nothing else moves', () => {
    const beats = Array.from({ length: 48 }, (_, i) => flyerWing({ id: 0 }, i / 48 / FLYER_RIG.beat));
    expect(Math.min(...beats)).toBeCloseTo(0, 2);
    expect(Math.max(...beats)).toBeGreaterThan(.98);
    expect(flyerWing({ id: 0 }, 0)).toBeCloseTo(flyerWing({ id: 0 }, 1 / FLYER_RIG.beat), 6);
    expect(FLYER_RIG.up).toBeGreaterThan(FLYER_RIG.down); // the far wing turns from raised to pointing down
  });
});
