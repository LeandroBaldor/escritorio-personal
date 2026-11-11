import { describe, expect, it } from 'vitest';
import { inertia } from './vampyium2Inertia';

const run = (targets: number[], vmax: number, angles = false) => {
  const owner = {}, out: number[] = [];
  targets.forEach((v, f) => out.push(inertia(owner, 'x', 10 + f / 60, [v], vmax, angles)[0]));
  return out;
};

describe('Vampyium2 pose inertia', () => {
  it('lets normal motion through untouched (a planted foot never lags or slides)', () => {
    const ramp = (f: number) => Math.min(1, f / 20) ** 2 * (3 - 2 * Math.min(1, f / 20)); // speeds up from rest, as feet do
    const targets = Array.from({ length: 60 }, (_, f) => Math.sin(f / 8) * .3 * ramp(f));
    run(targets, 4).forEach((v, f) => expect(v).toBeCloseTo(targets[f], 9));
  });
  it('turns a one-frame change of pose into a smooth glide with no jump and no overshoot', () => {
    const out = run([...Array(5).fill(2.6), ...Array(40).fill(.45)], 10, true);
    const steps = out.slice(1).map((v, i) => Math.abs(v - out[i]));
    expect(Math.max(...steps)).toBeLessThan(.35); // was 2.15 in one frame
    for (let i = 5; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(.45 - 1e-6);
    expect(out[out.length - 1]).toBeCloseTo(.45, 2); // settles in well under a second
  });
  it('blends angles the short way round', () => {
    const out = run([3.1, 3.1, -3.1, -3.1, -3.1], 2, true);
    for (const v of out) expect(Math.abs(Math.abs(v) - 3.1)).toBeLessThan(.1);
  });
});
