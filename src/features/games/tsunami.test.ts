import { describe, expect, it } from 'vitest';
import {
  buildCoast, inCanal, newTsunami, PLAYER_H, PLAYER_W, REACH, RIDE_T, RUN, START_X, step, SWIM, takeEvents, WATER_Y, waveSpeed, WAVE_DELAY, waveX,
  type Input, type TsunamiGame,
} from './tsunami';

const idle: Input = { left: false, right: false, jump: false };
const run = (g: TsunamiGame, seconds: number, input: Partial<Input> = {}) => { for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60); };

// Un jugador automático: corre a la derecha y salta cuando tiene algo adelante (un obstáculo o un canal) o
// cuando está nadando y llegó al borde. Con `lazy` corre solo una parte del tiempo (juega mal).
function autoplay(g: TsunamiGame, lazy = 0, maxSeconds = 240) {
  let frame = 0;
  while (!g.won && !g.over && g.time < maxSeconds) {
    const p = g.player, ahead = p.x + PLAYER_W / 2;
    const blocked = g.boxes.some(b => b.x > ahead - 0.05 && b.x < ahead + 1.3 && b.y + b.h > p.y + 0.45 && b.y < p.y + PLAYER_H);
    const gap = !p.swimming && p.y < 0.1 && [0.4, 0.8, 1.2].some(d => inCanal(g, p.x + d)) && !g.bridges.some(b => p.x + 1 > b.x1 && p.x + 1 < b.x2);
    const wall = p.swimming && !inCanal(g, p.x + 0.9);
    const dog = g.dogs.some(d => !d.rest && d.x > p.x && d.x < p.x + 1.6);
    const lazyNow = lazy > 0 && (frame % 60) / 60 < lazy;
    step(g, { left: false, right: !lazyNow, jump: blocked || gap || wall || dog }, 1 / 60);
    frame++;
  }
  return g;
}

describe('¡Se viene el tsunami!: la costa', () => {
  const coast = buildCoast();

  it('siempre es la misma: playa, pueblo con obstáculos y canales, y el cerro al final', () => {
    expect(buildCoast().boxes.map(b => [b.kind, b.x, b.h])).toEqual(coast.boxes.map(b => [b.kind, b.x, b.h]));
    expect(coast.zones.some(z => z.kind === 'umbrella' && z.x2 < coast.beachEnd)).toBe(true);
    const kinds = new Set(coast.boxes.map(b => b.kind));
    for (const k of ['car', 'van', 'kiosk', 'wall', 'bench', 'bins', 'crate', 'castle', 'step'] as const) expect(kinds.has(k), k).toBe(true);
    expect(coast.grounds.length).toBeGreaterThan(5); // canales entre tramos
    expect(coast.bridges.length).toBeGreaterThan(0);
    expect(coast.zones.some(z => z.kind === 'puddle')).toBe(true);
    expect(coast.dogs.length).toBeGreaterThan(3);
    expect(new Set(coast.pickups.map(p => p.kind))).toEqual(new Set(['moto', 'tabla']));
    expect(coast.goalX).toBeGreaterThan(coast.hillX);
    expect(coast.hillTop).toBeGreaterThan(3);
  });

  it('todo se puede saltar: ningún obstáculo es más alto que el salto ni ningún canal más ancho', () => {
    for (const b of coast.boxes) if (b.kind !== 'step') expect(b.y + b.h, b.kind).toBeLessThan(REACH - 0.3);
    for (let i = 0; i + 1 < coast.grounds.length; i++) expect(coast.grounds[i + 1].x1 - coast.grounds[i].x2).toBeLessThan(3.6);
  });
});

describe('¡Se viene el tsunami!: el juego', () => {
  it('la ola espera unos segundos y después avanza cada vez más rápido', () => {
    expect(waveX(0)).toBe(waveX(WAVE_DELAY));
    expect(waveSpeed(WAVE_DELAY + 60)).toBeGreaterThan(waveSpeed(WAVE_DELAY + 5) * 1.3);
  });

  it('jugando bien se llega al cerro antes que la ola, pero si vas despacio te alcanza', () => {
    const good = autoplay(newTsunami());
    expect(good.won, `llegó a ${good.player.x.toFixed(0)} de ${good.goalX.toFixed(0)}`).toBe(true);
    expect(good.time).toBeGreaterThan(50); // no es un trámite
    const slow = autoplay(newTsunami(), 0.3);
    expect(slow.won).toBe(false);
    expect(slow.over).toBe(true);
    expect(takeEvents(slow).some(e => e.type === 'lose')).toBe(true);
  });

  it('si la ola te alcanza, perdés', () => {
    const g = newTsunami();
    run(g, 12);
    expect(g.dying?.reason).toBe('ola');
    run(g, 2);
    expect(g.over).toBe(true);
  });

  it('los obstáculos no se atraviesan: hay que saltarlos o subirse arriba', () => {
    const g = newTsunami();
    const car = g.boxes.find(b => b.kind === 'car')!;
    Object.assign(g.player, { x: car.x - 2, y: 0, ground: true, vx: 0 });
    g.time = 0;
    run(g, 1, { right: true });
    expect(g.player.x).toBeLessThan(car.x);
    // Se puede subir arriba: cae parado sobre el techo.
    Object.assign(g.player, { x: car.x + car.w / 2, y: car.y + car.h + 1, ground: false, vy: 0 });
    run(g, 0.5);
    expect(g.player.ground).toBe(true);
    expect(g.player.y).toBeCloseTo(car.y + car.h, 2);
  });

  it('si te caés a un canal nadás despacio y salís saltando en el borde', () => {
    const g = newTsunami();
    const i = g.grounds.findIndex((gr, k) => k + 1 < g.grounds.length && !g.bridges.some(b => b.x1 <= gr.x2 && b.x2 >= g.grounds[k + 1].x1));
    const edge = g.grounds[i].x2, far = g.grounds[i + 1].x1;
    Object.assign(g.player, { x: edge + 0.5, y: 0, ground: false, vy: 0 });
    g.time = 0;
    run(g, 0.4);
    expect(g.player.swimming).toBe(true);
    expect(g.player.y).toBeLessThan(WATER_Y);
    expect(takeEvents(g).some(e => e.type === 'splash')).toBe(true);
    const x0 = g.player.x;
    run(g, 0.3, { right: true });
    expect((g.player.x - x0) / 0.3).toBeLessThan(SWIM + 0.1);
    run(g, (far - g.player.x) / SWIM + 0.2, { right: true }); // llega al borde
    run(g, 0.05, { right: true, jump: true });
    run(g, 0.8, { right: true });
    expect(g.player.swimming).toBe(false);
    expect(g.player.y).toBeGreaterThanOrEqual(-0.01);
    expect(g.player.x).toBeGreaterThan(far);
  });

  it('la moto y la tabla te hacen ir mucho más rápido un rato', () => {
    for (const kind of ['moto', 'tabla'] as const) {
      const g = newTsunami();
      const k = g.pickups.find(p => p.kind === kind)!;
      Object.assign(g.player, { x: k.x - 0.5, y: 0, ground: true });
      g.time = 0;
      run(g, 0.4, { right: true });
      expect(g.player.ride).toBe(kind);
      expect(Math.abs(g.player.vx)).toBeGreaterThan(RUN);
      run(g, RIDE_T + 0.2);
      expect(g.player.ride).toBeNull();
    }
  });

  it('las sombrillas frenan, los charcos resbalan y los perros te frenan si te alcanzan', () => {
    const g = newTsunami();
    const u = g.zones.find(z => z.kind === 'umbrella')!;
    Object.assign(g.player, { x: u.x1 - 0.2, y: 0, ground: true, vx: RUN });
    g.time = 0;
    run(g, 0.15, { right: true });
    expect(g.player.vx).toBeLessThan(RUN * 0.6);

    const g2 = newTsunami();
    const pd = g2.zones.find(z => z.kind === 'puddle')!;
    Object.assign(g2.player, { x: (pd.x1 + pd.x2) / 2, y: 0, ground: true, vx: RUN });
    g2.time = 0;
    run(g2, 0.2, { left: true });
    expect(g2.player.vx).toBeGreaterThan(0); // todavía patina para adelante

    const g3 = newTsunami();
    const d = g3.dogs[0];
    Object.assign(g3.player, { x: d.x + 3, y: 0, ground: true, vx: 0 });
    g3.time = 0;
    run(g3, 2);
    expect(takeEvents(g3).some(e => e.type === 'dog')).toBe(true);
  });

  it('se gana al llegar arriba del cerro', () => {
    const g = newTsunami();
    Object.assign(g.player, { x: g.hillX - 1, y: 0, ground: true });
    g.time = 0;
    run(g, 4, { right: true });
    expect(g.won).toBe(true);
    expect(g.player.y).toBeCloseTo(g.hillTop, 1);
    expect(takeEvents(g).some(e => e.type === 'win')).toBe(true);
  });

  it('se arranca en la playa, con la ola atrás', () => {
    const g = newTsunami();
    expect(g.player.x).toBe(START_X);
    expect(g.wave).toBeLessThan(START_X - 20);
  });
});
