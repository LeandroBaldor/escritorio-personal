import { describe, expect, it } from 'vitest';
import { campaignRating, launchedPlates, levelPerformance, ROUND_MS } from './tiro2050';

describe('Tiro al Blanco 2050: calificación final', () => {
  it('cada prueba da un rendimiento de 0 a 1', () => {
    expect(levelPerformance(1, { score: 0, shots: 10, hits: 8, errors: 1 })).toBeCloseTo(.6);
    expect(levelPerformance(1, { score: 0, shots: 0, hits: 0, errors: 0 })).toBe(0);
    expect(levelPerformance(2, { score: 0, shots: 0, hits: launchedPlates(ROUND_MS), errors: 0 })).toBe(1);
    expect(levelPerformance(3, { score: 375, shots: 50, hits: 50, errors: 0 })).toBeCloseTo(.5);
  });
  it('califica de Muy malo a Excelente según el promedio', () => {
    const perfect = [
      { level: 1 as const, score: 0, shots: 10, hits: 10, errors: 0 },
      { level: 2 as const, score: 0, shots: 0, hits: launchedPlates(ROUND_MS), errors: 0 },
      { level: 3 as const, score: 750, shots: 50, hits: 50, errors: 0 },
    ];
    expect(campaignRating(perfect)).toEqual({ percent: 100, label: 'Excelente' });
    expect(campaignRating([]).label).toBe('Muy malo');
    expect(campaignRating([perfect[0], { ...perfect[2], score: 375 }])).toEqual({ percent: 50, label: 'Regular' }); // (1 + 0 + 0,5) / 3
  });
});
