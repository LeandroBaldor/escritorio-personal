import { describe, expect, it } from 'vitest';
import { BREAK_POINTS, level, LEVEL_SECONDS, WIN_LEVEL, explode, hitsGrid, isEnclosed, newGame, PLAYER_H, score, spawnPiece, step, type Piece } from './blockRunner';

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

describe('pila hasta el techo', () => {
  it('termina la partida cuando los bloques llegan arriba', () => {
    const game = newGame(4, 4);
    for (let r = 0; r < 4; r++) game.grid[r] = ['#fff', '#fff', null, null];
    game.player.x = 2.2;
    game.spawnIn = 99;
    game.pieces.push({ id: 1, x: 0, y: -1.05, cells: [[0, 0], [1, 0]], width: 2, height: 1, color: '#f00', speed: 5 });
    step(game, idle, 0.05);
    expect(game.over).toBe('full');
  });
});

describe('romper bloques del mismo color', () => {
  it('una pieza atraviesa y rompe los bloques de su color, y suma puntos', () => {
    const game = newGame(6, 8);
    game.spawnIn = 99;
    game.player.x = 4.2;
    game.grid[7][0] = '#f00'; game.grid[6][0] = '#f00'; game.grid[7][1] = '#00f';
    game.pieces.push({ id: 1, x: 0, y: -1, cells: [[0, 0]], width: 1, height: 1, color: '#f00', speed: 5 });
    run(game, 3);
    expect(game.broken).toBe(2);
    expect(game.grid[7][0]).toBe('#f00'); // la pieza quedó apoyada en el piso
    expect(game.grid[6][0]).toBeNull();
    expect(game.grid[7][1]).toBe('#00f');
    expect(game.particles.length + game.broken).toBeGreaterThan(0);
    expect(score(game)).toBeGreaterThanOrEqual(2 * BREAK_POINTS);
  });

  it('un bloque de otro color la frena', () => {
    const game = newGame(6, 8);
    game.spawnIn = 99;
    game.player.x = 4.2;
    game.grid[7][0] = '#00f';
    game.pieces.push({ id: 1, x: 0, y: -1, cells: [[0, 0]], width: 1, height: 1, color: '#f00', speed: 5 });
    run(game, 3);
    expect(game.broken).toBe(0);
    expect(game.grid[6][0]).toBe('#f00');
    expect(game.grid[7][0]).toBe('#00f');
  });
});

describe('bombas', () => {
  it('explota al llegar, rompe los bloques de alrededor y no afecta si el personaje está lejos', () => {
    const game = newGame(10, 8);
    game.spawnIn = 99;
    game.player.x = 8.2;
    game.grid[7][2] = '#00f'; game.grid[7][3] = '#f00'; game.grid[7][4] = '#0f0'; game.grid[7][6] = '#fff';
    game.bombs.push({ id: 1, x: 3, y: -1, speed: 6 });
    run(game, 2.5);
    expect(game.bombs).toHaveLength(0);
    expect(game.grid[7].slice(2, 5)).toEqual([null, null, null]);
    expect(game.grid[7][6]).toBe('#fff');
    expect(game.over).toBeNull();
  });

  it('si el personaje está donde explota, pierde', () => {
    const game = newGame(10, 8);
    game.spawnIn = 99;
    game.player.x = 4.3;
    game.bombs.push({ id: 1, x: 5, y: -1, speed: 6 });
    run(game, 2.5);
    expect(game.over).toBe('bomb');
  });

  it('las bombas también salen solas después de los primeros segundos', () => {
    const game = newGame(10, 8);
    game.time = 10;
    for (let i = 0; i < 40 && !game.bombs.length; i++) { game.spawnIn = 0; step(game, idle, 0.01, () => (i * 0.13) % 1); game.pieces = []; }
    expect(game.bombs.length).toBeGreaterThan(0);
  });
});

describe('roce de costado', () => {
  it('una pieza que cae justo al lado lo empuja en vez de aplastarlo', () => {
    const game = newGame(10, 8);
    game.spawnIn = 99;
    game.player.x = 2.45; // apenas encimado con la columna 3
    game.pieces.push({ id: 1, x: 3, y: -2, cells: [[0, 0], [0, 1]], width: 1, height: 2, color: '#f00', speed: 6 });
    run(game, 3);
    expect(game.over).toBeNull();
    expect(game.player.x + 0.6).toBeLessThanOrEqual(3 + 1e-6);
    expect(game.grid[7][3]).toBe('#f00');
  });

  it('si le cae de arriba, lo aplasta', () => {
    const game = newGame(10, 8);
    game.spawnIn = 99;
    game.player.x = 2.6;
    game.pieces.push({ id: 1, x: 2, y: -2, cells: [[0, 0], [1, 0]], width: 2, height: 1, color: '#f00', speed: 6 });
    run(game, 3);
    expect(game.over).toBe('crushed');
  });
});

describe('tocar una pieza que cae', () => {
  it('correr contra el costado de una pieza que cae no lo hace perder: la pieza lo frena', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.player.x = 2;
    game.pieces.push({ id: 1, x: 5, y: 7.5, cells: [[0, 0], [0, 1], [0, 2], [0, 3]], width: 1, height: 4, color: '#f00', speed: 0.5 });
    run(game, 0.8, { left: false, right: true, jump: false });
    expect(game.pieces).toHaveLength(1); // todavía cae
    expect(game.over).toBeNull();
    expect(game.player.x + 0.6).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('saltar y chocar una pieza por abajo no lo hace perder: rebota y cae', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.player.x = 4.2;
    game.pieces.push({ id: 1, x: 3, y: 8.2, cells: [[0, 0], [1, 0], [2, 0]], width: 3, height: 1, color: '#f00', speed: 0.3 });
    step(game, { left: false, right: false, jump: true }, 1 / 60);
    run(game, 0.15);
    expect(game.over).toBeNull();
    expect(game.player.y).toBeGreaterThanOrEqual(game.pieces[0].y + 1 - 1e-6);
    // Se corre antes de que la pieza llegue al piso, así no le cae encima.
    run(game, 0.6, { left: false, right: true, jump: false });
    run(game, 3);
    expect(game.over).toBeNull();
  });

  it('caer arriba de una pieza que baja no lo hace perder: se para encima', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.player.x = 4.2; game.player.y = 2;
    game.pieces.push({ id: 1, x: 3, y: 6, cells: [[0, 0], [1, 0], [2, 0]], width: 3, height: 1, color: '#f00', speed: 1 });
    run(game, 0.6);
    expect(game.over).toBeNull();
    expect(game.player.onGround).toBe(true);
    expect(game.player.y + PLAYER_H).toBeCloseTo(game.pieces[0].y, 1);
    run(game, 6);
    expect(game.over).toBeNull();
    expect(game.grid[11][4]).toBe('#f00');
    expect(game.player.y + PLAYER_H).toBeCloseTo(11, 3);
  });

  it('si la pieza le cae en la cabeza mientras está en el aire, lo baja; al llegar al piso lo aplasta', () => {
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.player.x = 4.2; game.player.y = 5; game.player.onGround = false;
    game.pieces.push({ id: 1, x: 4, y: 3.5, cells: [[0, 0], [0, 1]], width: 1, height: 2, color: '#f00', speed: 18 });
    run(game, 2);
    expect(game.over).toBe('crushed');
  });
});

describe('gravedad', () => {
  it('después de una explosión, lo que queda flotando cae', () => {
    const game = newGame(10, 8);
    game.spawnIn = 99;
    game.player.x = 8.2;
    game.grid[7][2] = '#00f'; game.grid[6][2] = '#00f'; game.grid[5][2] = '#0f0'; game.grid[4][2] = '#ff0';
    explode(game, 3, 7, () => 0.5);
    expect(game.grid[7][2]).toBe('#0f0');
    expect(game.grid[6][2]).toBe('#ff0');
    expect(game.grid[5][2]).toBeNull();
  });

  it('los bloques que caen se frenan encima del personaje', () => {
    const game = newGame(10, 8);
    game.player.x = 2.2; game.player.y = 8 - PLAYER_H;
    game.grid[3][2] = '#0f0';
    explode(game, 6, 7, () => 0.5); // lejos: no lo toca
    game.grid[2][2] = '#ff0';
    explode(game, 2, 0, () => 0.5); // rompe arriba (fila 0 y 1) y hace caer la columna 2
    expect(game.over).toBeNull();
    expect(game.grid.slice(7).flat()[2]).toBeNull(); // no cayó nada donde está el personaje
  });
});

describe('duración de la ronda', () => {
  it('sin que lo pisen, la pila no llega arriba antes de terminar el nivel 10 (5 minutos) y termina poco después', () => {
    for (const [cols, rows] of [[26, 12], [14, 14], [10, 16]]) {
      let seed = 4242; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const game = newGame(cols, rows);
      game.winLevel = Infinity; // acá se mide solo cuánto tarda en llenarse
      while (game.time < 1000) { step(game, idle, 1 / 30, rand); if (game.over === 'full') break; game.over = null; game.player.y = -5; }
      expect(game.time).toBeGreaterThan(5 * 60);
      expect(game.time).toBeLessThan(7 * 60);
    }
  });
});

describe('encerrado', () => {
  it('si queda en un hueco cerrado tiene 10 segundos para salir; si no, queda atrapado', () => {
    const game = newGame(6, 6);
    game.spawnIn = 99;
    game.player.x = 2.2; game.player.y = 6 - PLAYER_H;
    // Caja cerrada alrededor del personaje (columnas 1 y 3, techo en la fila 3).
    for (let r = 3; r < 6; r++) { game.grid[r][1] = '#fff'; game.grid[r][3] = '#fff'; }
    game.grid[3][2] = '#fff';
    expect(isEnclosed(game)).toBe(true);
    run(game, 5);
    expect(game.over).toBeNull();
    expect(game.trapped).toBeGreaterThan(4);
    run(game, 5.5);
    expect(game.over).toBe('trapped');
  });

  it('si se abre el hueco, la cuenta se reinicia', () => {
    const game = newGame(6, 6);
    game.spawnIn = 99;
    game.player.x = 2.2; game.player.y = 6 - PLAYER_H;
    for (let r = 3; r < 6; r++) { game.grid[r][1] = '#fff'; game.grid[r][3] = '#fff'; }
    game.grid[3][2] = '#fff';
    run(game, 3);
    game.grid[3][2] = null; // se rompe el techo
    run(game, 0.1);
    expect(game.trapped).toBe(0);
    expect(isEnclosed(game)).toBe(false);
  });
});

describe('ganar', () => {
  it('son 10 niveles de 30 segundos: al terminar el nivel 10 gana la partida', () => {
    expect(LEVEL_SECONDS).toBe(30);
    const game = newGame(10, 12);
    game.spawnIn = 99;
    game.time = (WIN_LEVEL - 1) * LEVEL_SECONDS + 0.5;
    expect(level(game)).toBe(WIN_LEVEL);
    game.time = WIN_LEVEL * LEVEL_SECONDS - 0.02;
    step(game, idle, 0.01);
    expect(game.over).toBeNull();
    step(game, idle, 0.05);
    expect(level(game)).toBe(WIN_LEVEL);
    expect(game.over).toBe('won');
  });
});
