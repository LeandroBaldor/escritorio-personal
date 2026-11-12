import { describe, expect, it } from 'vitest';
import { FLYER_RIG, flyerWing } from './vampyium2Sprites';

describe('Vampyium2 flyer wings', () => {
  it('beat from up to clearly down and back, in a loop, and nothing else moves', () => {
    const beats = Array.from({ length: 48 }, (_, i) => flyerWing({ id: 0 }, i / 48 / FLYER_RIG.beat));
    expect(Math.min(...beats)).toBeCloseTo(0, 2);
    expect(Math.max(...beats)).toBeGreaterThan(.98);
    expect(flyerWing({ id: 0 }, 0)).toBeCloseTo(flyerWing({ id: 0 }, 1 / FLYER_RIG.beat), 6);
    expect(FLYER_RIG.up).toBeGreaterThan(FLYER_RIG.down); // the far wing turns from raised to pointing down
  });
});
