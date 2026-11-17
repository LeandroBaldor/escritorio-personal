import { describe, expect, it } from 'vitest';
import { FINAL_END_AT, FINAL_SHOT_AT, newPenalties, stepPenalties, takePenEvents } from './kombatPenalties';
import { maskUfoSilhouette, ufoLights, ufoSequence } from './kombatPenUfo';

describe('ejecución del ovni', () => {
  it('elimina el fondo sin volver transparente el negro interior del casco', () => {
    const data = new Uint8ClampedArray(7 * 2 * 4);
    for (const x of [1, 5]) { data[x * 4] = 120; data[x * 4 + 3] = 255; }
    maskUfoSilhouette(data, 7, 2);
    expect(Array.from({ length: 7 }, (_, x) => data[x * 4 + 3])).toEqual([0, 255, 255, 255, 255, 255, 0]);
    expect(Array.from({ length: 7 }, (_, x) => data[(7 + x) * 4 + 3])).toEqual(Array(7).fill(0));
  });
  it('las luces conservan color, separación y orden durante una vuelta completa', () => {
    const initial = ufoLights(0);
    for (const t of [0.4, 1.1, 3.8, 8]) {
      const lights = ufoLights(t);
      expect(lights.map(l => [l.id, l.color])).toEqual(initial.map(l => [l.id, l.color]));
      for (let i = 0; i < lights.length; i++) expect(lights[i].angle - initial[i].angle).toBeCloseTo(t * 1.8);
    }
    expect(new Set(initial.map(l => l.color)).size).toBe(8);
  });
  it('entra, carga, dispara antes del impacto y se retira al final', () => {
    expect(ufoSequence(0).enter).toBe(0); expect(ufoSequence(1.2).enter).toBe(1);
    expect(ufoSequence(1).beam).toBe(0); expect(ufoSequence(FINAL_SHOT_AT - 0.1).beam).toBe(1);
    expect(ufoSequence(FINAL_SHOT_AT + 0.7).beam).toBe(0); expect(ufoSequence(FINAL_END_AT).leave).toBe(1);
  });
  it('sólo explota el perdedor al llegar el rayo y el resultado espera a los restos', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 0.99);
    m.phase = 'execution'; m.winner = 0; m.finale = { loser: 1, fired: false };
    const body = () => ({ x: 100, y: 500, h: 300 });
    // El final funciona también sin depender del último penal.
    stepPenalties(m, FINAL_SHOT_AT - 0.01, body);
    expect(m.death).toBeNull(); expect(m.gore.gibs).toHaveLength(0);
    stepPenalties(m, 0.02, body);
    expect(m.death?.side).toBe(1); expect(m.death?.type).toBe('explosion');
    expect(m.gore.gibs.length).toBeGreaterThan(20); expect(m.gore.drops.length).toBeGreaterThan(200);
    expect(takePenEvents(m).filter(e => e.type === 'boom')).toHaveLength(1);
    expect(m.phase).toBe('execution');
    stepPenalties(m, FINAL_END_AT - m.phaseT + 0.01, body);
    expect(m.phase).toBe('end'); expect(takePenEvents(m).filter(e => e.type === 'end')).toHaveLength(1);
  });
});
