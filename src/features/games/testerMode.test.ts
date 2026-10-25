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

  it('en Trepaluna, con el modo prueba perder no descuenta vidas (sin él, sí)', () => {
    for (const tester of [false, true]) {
      setTesterForTests(tester);
      const g = newTrepa();
      g.fires = [{ id: 1, x: 8, y: 0, dir: 'up', len: 3, period: 2, on: 1.9, phase: 0 }];
      Object.assign(g.player, { x: 8, y: 0 });
      for (let i = 0; i < 30 && !g.hurt; i++) step(g, { left: false, right: false, jump: false, down: false }, 1 / 60);
      expect(g.hurt).not.toBe(null);
      expect(g.lives).toBe(tester ? LIVES : LIVES - 1);
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
