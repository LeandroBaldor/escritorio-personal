import { describe, expect, it } from 'vitest';
import { APPLE_STEP, cellKey, chaseStep, CLEAR_POINTS, GREEN_GROW, newGame, PELLET_POINTS, score, snakeInterval, step, takeEvents, TANGLE_POINTS, type Dir, type Game } from './reverseSnake';

const run = (g: Game, seconds: number, dir: Dir | null = null) => { for (let t = 0; t < seconds; t += 1 / 60) step(g, { dir }, 1 / 60, () => 0.5); };
const still = (g: Game) => { g.greens = []; g.powers = []; g.nextPower = 999; g.nextGreen = 999; g.pellets.clear(); };

describe('Serpiente al Revés', () => {
  it('la manzana se mueve un casillero por vez y no sale del jardín', () => {
    const g = newGame(12, 10); still(g);
    const x0 = g.apple.x;
    step(g, { dir: 'right' }, 1 / 60);
    expect(g.apple.x).toBe(x0 + 1);
    step(g, { dir: 'right' }, 1 / 60); // todavía no pasó el tiempo de un paso
    expect(g.apple.x).toBe(x0 + 1);
    run(g, 3, 'right');
    expect(g.apple.x).toBe(11);
  });

  it('la serpiente busca el camino más corto hacia la manzana y la atrapa', () => {
    const g = newGame(12, 10); still(g);
    g.apple.x = 2; g.apple.y = 2;
    g.snake.body = [{ x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 9, y: 2 }];
    expect(chaseStep(g)).toBe('left');
    run(g, 4);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'caught')).toBe(true);
  });

  it('el cuerpo de la serpiente es una pared para la manzana', () => {
    const g = newGame(12, 10); still(g);
    g.snake.freeze = 99;
    g.apple.x = 3; g.apple.y = 5;
    g.snake.body = [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }];
    run(g, 0.5, 'right');
    expect(g.apple.x).toBe(3);
    expect(g.over).toBe(false);
  });

  it('el piso está lleno de bolitas blancas: cada una suma puntos y, si limpiás todo, se vuelve a llenar', () => {
    const g = newGame(12, 10);
    g.snake.freeze = 99; g.nextGreen = 999; g.nextPower = 999;
    expect(g.pellets.size).toBe(12 * 10 - 1 - g.snake.body.length);
    const total = g.pellets.size;
    step(g, { dir: 'right' }, 1 / 60);
    expect(g.bonus).toBe(PELLET_POINTS);
    expect(g.pellets.size).toBe(total - 1);
    expect(score(g)).toBeGreaterThanOrEqual(PELLET_POINTS);
    // Queda una sola bolita, al lado de la manzana.
    g.pellets = new Set([cellKey({ x: g.apple.x + 1, y: g.apple.y }, g.cols)]);
    run(g, APPLE_STEP + 0.02, 'right');
    expect(g.bonus).toBe(PELLET_POINTS * 2 + CLEAR_POINTS);
    expect(g.pellets.size).toBeGreaterThan(50);
    expect(takeEvents(g).some(e => e.type === 'cleared')).toBe(true);
  });

  it('la serpiente crece al comerse una manzana verde y va a buscarlas si las tiene más cerca', () => {
    const g = newGame(20, 12); still(g);
    g.apple.x = 18; g.apple.y = 10;
    g.snake.body = [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];
    g.greens = [{ x: 5, y: 5 }];
    expect(chaseStep(g)).toBe('down');
    g.snake.stepIn = 0;
    run(g, 1.2);
    expect(g.greens.length).toBe(0);
    expect(g.snake.body.length + g.snake.grow).toBe(4 + GREEN_GROW);
    expect(takeEvents(g).some(e => e.type === 'ate')).toBe(true);
  });

  it('la tijera le corta la cola y el reloj la congela', () => {
    const g = newGame(16, 12); still(g);
    g.snake.body = Array.from({ length: 12 }, (_, i) => ({ x: 15 - i, y: 0 }));
    g.powers = [{ x: g.apple.x + 1, y: g.apple.y, kind: 'scissors', life: 5 }, { x: g.apple.x + 2, y: g.apple.y, kind: 'clock', life: 5 }];
    step(g, { dir: 'right' }, 1 / 60);
    expect(g.snake.body.length).toBe(6);
    run(g, APPLE_STEP + 0.02, 'right');
    expect(g.snake.freeze).toBeGreaterThan(3);
    const head = { ...g.snake.body[0] };
    run(g, 1);
    expect(g.snake.body[0]).toEqual(head);
  });

  it('si se enreda (no tiene por dónde seguir), te da puntos y vuelve a empezar cortita', () => {
    const g = newGame(8, 8); still(g);
    g.apple.x = 7; g.apple.y = 7;
    // Cabeza encerrada por su propio cuerpo en la esquina de arriba a la izquierda.
    g.snake.body = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
    g.snake.grow = 1;
    g.snake.stepIn = 0;
    step(g, { dir: null }, 1 / 60);
    expect(g.tangles).toBe(1);
    expect(g.bonus).toBe(TANGLE_POINTS);
    expect(g.snake.body.length).toBe(4);
    expect(takeEvents(g).some(e => e.type === 'tangled')).toBe(true);
  });

  it('aparecen manzanas verdes cada tanto y la serpiente se mueve cada vez más rápido', () => {
    expect(snakeInterval(60)).toBeLessThan(snakeInterval(0));
    const g = newGame(30, 20); still(g);
    g.nextGreen = 0.1;
    g.snake.freeze = 999;
    let r = 0.1;
    for (let t = 0; t < 0.5; t += 1 / 60) step(g, { dir: null }, 1 / 60, () => (r = (r * 7.3 + 0.17) % 1));
    expect(g.greens.length).toBe(1);
  });

  it('un cuadro con tiempo cero o negativo no mueve nada', () => {
    const g = newGame(12, 10);
    step(g, { dir: 'up' }, -0.01); step(g, { dir: 'up' }, 0);
    expect(g.time).toBe(0);
  });

  it('jugando a escapar bien, una ronda dura más de un minuto', () => {
    // Un jugador simple: se aleja de la cabeza buscando el casillero con más lugar.
    const times: number[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      let s = seed * 7919; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const g = newGame(24, 15);
      while (!g.over && g.time < 400) {
        const head = g.snake.body[0];
        let best: Dir | null = null, bestScore = -Infinity;
        for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
          const n = { x: g.apple.x + (d === 'left' ? -1 : d === 'right' ? 1 : 0), y: g.apple.y + (d === 'up' ? -1 : d === 'down' ? 1 : 0) };
          if (n.x < 0 || n.y < 0 || n.x >= g.cols || n.y >= g.rows || g.snake.body.some(b => b.x === n.x && b.y === n.y)) continue;
          const dist = Math.abs(n.x - head.x) + Math.abs(n.y - head.y);
          const edge = Math.min(n.x, n.y, g.cols - 1 - n.x, g.rows - 1 - n.y);
          const sc = dist + edge * 1.5 + rand() * 0.5;
          if (sc > bestScore) { bestScore = sc; best = d; }
        }
        step(g, { dir: best }, 1 / 30, rand);
      }
      times.push(Math.round(g.time));
    }
    expect(Math.min(...times)).toBeGreaterThan(45);
    expect(Math.max(...times)).toBeLessThan(400);
  });
});
