import { describe, expect, it } from 'vitest';
import { GROUND, BRIDGE, LIQUID, BLOCK, T, generateTerrain, findPath, MAP_SIZES } from './landMap';
import { newLandGame, addUnit, orderMove, stepLand } from './land';
import { terrainScale } from './landMapArt';

describe('Geografía y escala de Land of Warriors', () => {
  it('permite llegar a la otra base y a todos los recursos en los diez biomas', () => {
    for (let theme = 0; theme < 10; theme++) for (const size of ['medium', 'huge'] as const) {
      const t = generateTerrain(theme, size, 77), seen = new Uint8Array(t.cells.length);
      const start = t.bases[0][1] * t.cols + t.bases[0][0], queue = [start]; seen[start] = 1;
      while (queue.length) {
        const at = queue.pop()!, c = at % t.cols, r = Math.floor(at / t.cols);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const x = c + dx, y = r + dy, k = y * t.cols + x;
          if (x < 0 || y < 0 || x >= t.cols || y >= t.rows || seen[k] || (t.cells[k] !== GROUND && t.cells[k] !== BRIDGE)) continue;
          seen[k] = 1; queue.push(k);
        }
      }
      for (const [c, r] of [...t.bases, ...t.spots]) expect(seen[r * t.cols + c], `bioma ${theme}, ${size}: ${c},${r}`).toBe(1);
      const again = generateTerrain(theme, size, 77); expect(again.cells).toEqual(t.cells);
      expect(t.cells.includes(LIQUID)).toBe(true);
    }
  }, 30000);

  it('tiene diez geografías distintas y el tamaño gigante cuadruplica el área media', () => {
    const maps = Array.from({ length: 10 }, (_, i) => generateTerrain(i, 'small', 42));
    for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) {
      const difference = maps[i].cells.reduce((n, cell, k) => n + Number(cell !== maps[j].cells[k]), 0);
      expect(difference / maps[i].cells.length).toBeGreaterThan(0.08);
    }
    const medium = MAP_SIZES[1], huge = MAP_SIZES[3];
    expect(medium[2]).toBeGreaterThanOrEqual(6400);
    expect(huge[2] * huge[3]).toBeGreaterThanOrEqual(medium[2] * medium[3] * 4);
    for (const t of maps) expect(t.w * t.h * terrainScale(t) ** 2).toBeLessThanOrEqual(6e6 + 1);
    const giant = generateTerrain(4, 'huge', 42);
    expect(giant.w * giant.h * terrainScale(giant) ** 2).toBeLessThanOrEqual(6e6 + 1);
  });

  it('no cruza una pared infranqueable cuando no existe un camino', () => {
    const t = { cols: 5, rows: 5, w: 5 * T, h: 5 * T, cells: new Uint8Array(25), theme: 0, seed: 1, bases: [], spots: [] };
    for (let r = 0; r < 5; r++) t.cells[r * 5 + 2] = BLOCK;
    expect(findPath(t, 20, 100, 180, 100)).toEqual([]);
    const g = newLandGame('humano', 'orcos', 1, 'veryEasy', 42, 'small');
    g.terrain = t; g.ai.t = 1e9;
    const u = addUnit(g, 0, 'melee', 20, 100); orderMove(g, [u.id], 180, 100);
    for (let i = 0; i < 20; i++) stepLand(g, 0.05);
    expect(u.x).toBeLessThan(80);
  });

  it('muy fácil da más tiempo antes de la primera oleada que fácil', () => {
    const beginner = newLandGame('humano', 'orcos', 1, 'veryEasy', 42, 'small');
    const easy = newLandGame('humano', 'orcos', 1, 'easy', 42, 'small');
    expect(beginner.ai.waveAt).toBe(360);
    expect(beginner.ai.waveAt).toBeGreaterThan(easy.ai.waveAt);
  });
});
