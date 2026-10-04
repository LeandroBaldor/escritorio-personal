import { describe, expect, it } from 'vitest';
import { hitsGrid, newGame, PLAYER_H, score, spawnPiece, step, type Piece } from './blockRunner';

const idle = { left: false, right: false, jump: false };
const run = (game: ReturnType<typeof newGame>, seconds: number, input = idle) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(game, input, 1 / 60, () => 0.5);
};
const square = (x: number, y: number): Piece => ({ id: 99, x, y, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], width: 2, height: 2, color: '#fff', speed: 5 });

describe('¡Cuidado, bloques!', () => {
  it('las piezas caen por columnas libres y quedan apoyadas en el piso', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.pieces.push(square(0, -2));
    run(game, 4);
    expect(game.pieces).toHaveLength(0);
    expect(game.grid[11][0]).toBe('#fff');
    expect(game.grid[10][1]).toBe('#fff');
    expect(game.grid[9][0]).toBeNull();
    expect(game.over).toBeNull();
  });

  it('una pieza nueva no aparece encima de otra que todavía está cayendo', () => {
    const game = newGame(4, 12);
    game.pieces.push(square(0, -2));
    for (let i = 0; i < 20; i++) spawnPiece(game, () => (i * 0.37) % 1);
    for (const piece of game.pieces.slice(1)) expect(piece.x).toBeGreaterThanOrEqual(2);
  });

  it('el personaje corre, no atraviesa bloques y salta encima de ellos', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.grid[11][7] = '#fff';
    run(game, 2, { left: false, right: true, jump: false });
    expect(game.player.x + 0.6).toBeLessThanOrEqual(7 + 1e-6);
    run(game, 1.5, { left: false, right: true, jump: true });
    expect(game.player.x).toBeGreaterThan(8);
    expect(game.over).toBeNull();
  });

  it('si una pieza le cae encima, lo aplasta', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.pieces.push(square(Math.floor(game.player.x), -2));
    run(game, 4);
    expect(game.over).toBe('crushed');
  });

  it('borra las filas completas y suma puntos', () => {
    const game = newGame(4, 6);
    game.spawnIn = 99;
    game.player.x = 1.2; game.player.y = 5 - PLAYER_H;
    game.grid[4] = ['#fff', null, null, null];
    // Se completa la fila de abajo: desaparece y lo de arriba baja una fila.
    game.grid[5] = ['#fff', '#fff', '#fff', null];
    game.pieces.push({ id: 1, x: 3, y: 4.9, cells: [[0, 0]], width: 1, height: 1, color: '#fff', speed: 5 });
    step(game, idle, 0.05);
    expect(game.lines).toBe(1);
    expect(game.grid[5][0]).toBe('#fff');
    expect(game.grid[5][1]).toBeNull();
    expect(score(game)).toBeGreaterThanOrEqual(100);
  });

  it('detecta paredes, piso y bloques', () => {
    const game = newGame(5, 5);
    game.grid[2][2] = '#fff';
    expect(hitsGrid(game, -0.1, 0, 0.6, 0.8)).toBe(true);
    expect(hitsGrid(game, 0, 4.5, 0.6, 0.8)).toBe(true);
    expect(hitsGrid(game, 2.2, 2.1, 0.6, 0.8)).toBe(true);
    expect(hitsGrid(game, 0.5, 0.5, 0.6, 0.8)).toBe(false);
  });
});

describe('tiempo del cuadro', () => {
  it('un cuadro con tiempo cero o negativo no mueve nada ni termina la partida', () => {
    const game = newGame(10, 12);
    step(game, idle, -0.004);
    step(game, idle, 0);
    expect(game.over).toBeNull();
    expect(game.time).toBe(0);
    expect(game.player.y).toBe(12 - PLAYER_H);
  });
});
