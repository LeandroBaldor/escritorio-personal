import { describe, expect, it } from 'vitest';
import { clockParts } from './GamesClock';

describe('clockParts', () => {
  it('muestra horas y minutos en 24 h con ceros adelante y los segundos aparte', () => {
    expect(clockParts(new Date(2026, 0, 1, 14, 28, 37))).toEqual({ hm: '14:28', s: '37' });
    expect(clockParts(new Date(2026, 0, 1, 7, 5, 3))).toEqual({ hm: '07:05', s: '03' });
  });
});
