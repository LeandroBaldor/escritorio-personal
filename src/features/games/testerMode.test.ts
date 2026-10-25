import { afterEach, describe, expect, it } from 'vitest';
import { applyTesterLink, isTester, setTesterForTests } from './testerMode';
import { LIVES, newTrepa, step } from './trepaluna';
import { newGame as newBlocks, step as stepBlocks } from './blockRunner';

describe('Modo prueba (vidas ilimitadas)', () => {
  afterEach(() => { localStorage.clear(); setTesterForTests(null); });

  it('está apagado para todos y un código equivocado no lo prende', async () => {
    expect(isTester()).toBe(false);
    expect(await applyTesterLink('?vidas=1234')).toBe(false);
    expect(await applyTesterLink('?vidas=prueba')).toBe(false);
    expect(await applyTesterLink('')).toBe(false);
  });

  it('con ?vidas=no se apaga', async () => {
    setTesterForTests(true);
    expect(await applyTesterLink('?vidas=no')).toBe(false);
    expect(isTester()).toBe(false);
  });

  it('en Trepaluna, con el modo prueba las vidas se gastan y al perder la última se recargan las 3', () => {
    for (const tester of [false, true]) {
      setTesterForTests(tester);
      const g = newTrepa();
      g.fires = [{ id: 1, x: 8, y: 0, dir: 'up', len: 3, period: 2, on: 1.9, phase: 0 }];
      const burn = () => {
        g.hurt = null; g.dying = null; g.splat = null; g.invuln = 0;
        Object.assign(g.player, { x: 8, y: 0, ground: g.plats[0] });
        for (let i = 0; i < 30 && !g.hurt && !g.dying; i++) step(g, { left: false, right: false, jump: false, down: false }, 1 / 60);
      };
      burn(); expect(g.lives).toBe(LIVES - 1);
      burn(); expect(g.lives).toBe(LIVES - 2);
      burn(); // pierde la última
      if (tester) { expect(g.lives).toBe(LIVES); expect(g.dying).toBe(null); expect(g.hurt).not.toBe(null); }
      else { expect(g.lives).toBe(0); expect(g.dying).not.toBe(null); }
    }
  });

  it('en ¡Cuidado, bloques!, con el modo prueba una pieza que le cae encima no lo aplasta', () => {
    for (const tester of [false, true]) {
      setTesterForTests(tester);
      const game = newBlocks(10, 8);
      game.spawnIn = 99;
      game.player.x = 2.6;
      game.pieces.push({ id: 1, x: 2, y: -2, cells: [[0, 0], [1, 0]], width: 2, height: 1, color: '#f00', speed: 6 });
      for (let t = 0; t < 3; t += 1 / 60) stepBlocks(game, { left: false, right: false, jump: false }, 1 / 60, () => 0.5);
      expect(game.over).toBe(tester ? null : 'crushed');
    }
  });
});
