import { describe, expect, it } from 'vitest';
import {
  buildCity, BURN_T, elevatorY, lavaLevel, LAVA_DELAY, newLava, personState, PLAYER_H, REACH, step, takeEvents, towerOf,
  type City, type Input, type LavaGame, type Plat,
} from './lava';

const idle: Input = { left: false, right: false, jump: false, down: false };
const run = (g: LavaGame, seconds: number, input: Partial<Input> = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60);
};
const platById = (c: City) => new Map(c.plats.map(p => [p.id, p]));

// Camino más rápido hasta un helicóptero, sumando el tiempo de caminar entre una unión y la siguiente. Un
// lugar solo sirve si la lava todavía no llegó cuando lo alcanza alguien que tarda `slack` veces más.
function fastestRoute(c: City, slack: number) {
  const byId = platById(c), out = new Map<number, typeof c.links>();
  for (const l of c.links) out.set(l.from, [...(out.get(l.from) ?? []), l]);
  const tower = towerOf(c);
  const goals = new Set(c.plats.filter(p => (p.b === tower.id && p.kind === 'roof') || p.kind === 'balcony').map(p => p.id));
  type State = { plat: number; x: number; t: number; path: string[] };
  const best = new Map<string, number>();
  const queue: State[] = [{ plat: c.start.plat, x: c.start.x, t: 0, path: [] }];
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t);
    const s = queue.shift()!;
    if (goals.has(s.plat)) return s;
    for (const l of out.get(s.plat) ?? []) {
      const t = s.t + Math.abs(l.fromX - s.x) / 6 + l.cost;
      const to = byId.get(l.to)!;
      if (lavaLevel(t * slack) > Math.min(l.fromY, l.toY) - 0.4) continue;
      const k = `${l.to}:${Math.round(l.toX)}`;
      if ((best.get(k) ?? Infinity) <= t) continue;
      best.set(k, t);
      queue.push({ plat: to.id, x: l.toX, t, path: [...s.path, `${l.mode}→${to.kind}${to.b >= 0 ? `@${to.b}` : ''} ${Math.round(l.toY)}`] });
    }
  }
  return null;
}

describe('¡El piso es de lava!: la ciudad', () => {
  const city = buildCity();

  it('siempre es la misma y termina en la torre más alta, con dos helicópteros', () => {
    const again = buildCity();
    expect(again.plats.map(p => [p.kind, p.x, p.y])).toEqual(city.plats.map(p => [p.kind, p.x, p.y]));
    const tower = towerOf(city);
    expect(tower.tower).toBe(true);
    expect(city.buildings.every(b => b === tower || b.top < tower.top)).toBe(true);
    expect(city.helis).toHaveLength(2);
    expect(city.helis.every(h => h.x + h.w > tower.x && h.x < tower.x + tower.w + 6 && h.y >= tower.top - 4 * tower.fh)).toBe(true);
  });

  it('los edificios son distintos: bajitos y torres, de colores y altos de piso distintos', () => {
    const tops = city.buildings.map(b => b.top);
    expect(Math.min(...tops)).toBeLessThan(20);
    expect(Math.max(...tops)).toBeGreaterThan(70);
    expect(new Set(city.buildings.map(b => b.hue)).size).toBe(city.buildings.length);
    expect(new Set(city.buildings.map(b => b.fh.toFixed(2))).size).toBeGreaterThan(5);
  });

  it('tiene de todo para subir, pasar de edificio en edificio y morirse', () => {
    const kinds = new Set(city.plats.map(p => p.kind));
    for (const k of ['step', 'furniture', 'bridge', 'plank', 'landing', 'elevator', 'roof', 'floor'] as Plat['kind'][]) expect(kinds.has(k), k).toBe(true);
    expect(new Set(city.plats.filter(p => p.furniture).map(p => p.furniture)).size).toBeGreaterThan(5);
    expect(new Set(city.climbs.map(c => c.skin))).toEqual(new Set(['ladder', 'rope', 'escape']));
    expect(city.escapes.length).toBeGreaterThan(1);
    // Las escaleras de emergencia están rotas: nunca llegan a la terraza.
    for (const e of city.escapes) expect(e.broken).toBeLessThan(city.buildings[e.b].floors);
    // Los ascensores llegan como mucho hasta la terraza.
    for (const e of city.elevators) expect(e.y2).toBeCloseTo(city.buildings[e.b].top);
    expect(city.fires.length).toBeGreaterThan(5);
    expect(city.sparks.some(s => s.kind === 'cable') && city.sparks.some(s => s.kind === 'puddle')).toBe(true);
    expect(city.buildings.some(b => b.holes.length)).toBe(true);
    expect(city.people.length).toBeGreaterThan(30);
  });

  it('cada piso se alcanza desde el de abajo y cada unión se puede hacer con el salto del personaje', () => {
    const byId = platById(city);
    for (const l of city.links) {
      const where = `${l.mode} ${l.from}→${l.to} a ${l.fromY.toFixed(1)}`;
      expect(byId.has(l.from) && byId.has(l.to), where).toBe(true);
      if (l.mode === 'jump') { expect(l.dy, where).toBeLessThan(REACH - 0.15); expect(l.edge, where).toBeLessThanOrEqual(2.2); }
      if (l.mode === 'walk') expect(l.dy, where).toBeLessThanOrEqual(0.6);
    }
    // Todos los pisos de todos los edificios tienen por dónde subir al de arriba.
    for (const b of city.buildings) {
      for (let k = 0; k < b.floors; k++) {
        // (la planta baja de todos los edificios es la calle)
        const inB = (l: (typeof city.links)[number]) => byId.get(l.from)!.b === b.id || (k === 0 && byId.get(l.from)!.kind === 'street' && l.fromX > b.x && l.fromX < b.x + b.w);
        const up = city.links.some(l => inB(l) && Math.abs(l.fromY - k * b.fh) < 0.01 && l.toY > l.fromY + 1)
          || city.links.some(l => l.mode === 'jump' && byId.get(l.to)?.floor === k && byId.get(l.to)?.b === b.id && byId.get(l.to)?.kind === 'furniture');
        expect(up, `edificio ${b.id}, piso ${k}`).toBe(true);
      }
    }
  });

  it('entre edificios vecinos hay varias uniones y al menos una bien arriba', () => {
    const byId = platById(city);
    for (let i = 0; i + 1 < city.buildings.length; i++) {
      const A = city.buildings[i], B = city.buildings[i + 1];
      const between = city.links.filter(l => {
        const from = byId.get(l.from)!, to = byId.get(l.to)!;
        return (from.b === A.id || from.b === -1) && (to.b === B.id || to.b === -1) && from.b !== to.b;
      });
      expect(between.length, `${i}→${i + 1}`).toBeGreaterThanOrEqual(3);
      expect(between.some(l => l.fromY >= Math.min(A.top, B.top) * 0.55), `${i}→${i + 1} arriba`).toBe(true);
    }
  });

  it('jugando bien se llega al helicóptero antes que la lava, pero hay que apurarse', () => {
    const good = fastestRoute(city, 1.7);
    expect(good, 'alguien 1,7 veces más lento que lo ideal llega').not.toBeNull();
    expect(fastestRoute(city, 6), 'yendo muy despacio te alcanza la lava').toBeNull();
  });
});

describe('¡El piso es de lava!: el juego', () => {
  it('la lava espera unos segundos y después sube cada vez más rápido', () => {
    expect(lavaLevel(0)).toBe(lavaLevel(LAVA_DELAY));
    const a = lavaLevel(LAVA_DELAY + 20) - lavaLevel(LAVA_DELAY + 10), b = lavaLevel(LAVA_DELAY + 80) - lavaLevel(LAVA_DELAY + 70);
    expect(b).toBeGreaterThan(a * 1.5);
  });

  it('si la lava te alcanza, perdés', () => {
    const g = newLava();
    run(g, 30);
    expect(g.dying?.reason).toBe('lava');
    run(g, 2);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'gameover')).toBe(true);
  });

  it('las paredes no se atraviesan: se sale por las puertas', () => {
    const g = newLava();
    const b = g.buildings[0];
    run(g, 3, { left: true });
    expect(g.player.x).toBeLessThan(b.x); // en la planta baja hay puerta a la calle
    const p = g.player;
    // En un piso sin puerta del lado derecho, la pared frena.
    const k = Array.from({ length: b.floors }, (_, i) => i).find(i => i > 0 && !b.doors.right.has(i))!;
    const floor = g.plats.find(pl => pl.b === b.id && pl.kind === 'floor' && Math.abs(pl.y - k * b.fh) < 0.01 && pl.x + pl.w > b.x + b.w - 1)!;
    Object.assign(p, { x: b.x + b.w - 1.2, y: floor.y, ground: floor, vy: 0 });
    g.time = 0;
    run(g, 0.5, { right: true });
    expect(p.x).toBeLessThan(b.x + b.w);
  });

  it('el fuego y los cortocircuitos matan', () => {
    const g = newLava();
    const f = g.fires[0];
    const floor = g.plats.find(pl => pl.kind === 'floor' && Math.abs(pl.y - f.y) < 0.01 && pl.x <= f.x1 && pl.x + pl.w >= f.x2)!;
    Object.assign(g.player, { x: f.x1 - 0.4, y: f.y, ground: floor });
    run(g, 0.3, { right: true });
    expect(g.dying?.reason).toBe('fire');

    const g2 = newLava();
    const s = g2.sparks.find(sp => sp.kind === 'puddle')!;
    const floor2 = g2.plats.find(pl => pl.kind === 'floor' && Math.abs(pl.y - s.y1) < 0.01 && pl.x <= s.x1 && pl.x + pl.w >= s.x2)!;
    Object.assign(g2.player, { x: (s.x1 + s.x2) / 2, y: s.y1, ground: floor2 });
    run(g2, s.period + 0.1);
    expect(g2.dying?.reason).toBe('zap');
  });

  it('la gente que alcanza la lava arde unos segundos y queda carbonizada', () => {
    const g = newLava();
    const person = g.people.find(p => p.y === 0)!;
    run(g, 12);
    expect(person.burnAt).not.toBeNull();
    expect(personState(person, person.burnAt! + 0.5)).toBe('burning');
    expect(personState(person, person.burnAt! + BURN_T + 0.1)).toBe('charred');
    expect(g.people.filter(p => p.y > 20).every(p => p.burnAt === null)).toBe(true);
  });

  it('el ascensor te sube hasta la terraza (y no más)', () => {
    const g = newLava();
    const car = g.plats.find(p => p.elev)!;
    const e = car.elev!;
    expect(Math.max(...Array.from({ length: 400 }, (_, i) => elevatorY(e, i * 0.1)))).toBeCloseTo(e.y2);
    // Te parás donde pasa el ascensor cuando está abajo y te lleva.
    const t0 = Array.from({ length: 2000 }, (_, i) => i * 0.02).find(t => elevatorY(e, t) === e.y1 && elevatorY(e, t + 0.05) > e.y1)!;
    g.time = t0; g.lava = -100;
    Object.assign(g.player, { x: e.x + e.w / 2, y: e.y1, ground: car, vy: 0 });
    car.y = e.y1;
    const step60 = (s: number) => { for (let t = 0; t < s; t += 1 / 60) { g.lava = -100; step(g, idle, 1 / 60); g.dying = null; } };
    step60((e.y2 - e.y1) / e.speed + 0.5);
    expect(g.player.y).toBeGreaterThan(e.y2 - 0.5);
  });

  it('se gana al llegar al helicóptero', () => {
    const g = newLava();
    const h = g.helis[0];
    Object.assign(g.player, { x: h.x + h.w / 2, y: h.y + 0.1, ground: null, vy: 0 });
    run(g, 0.05);
    expect(g.won).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'win')).toBe(true);
  });

  it('se sube un piso saltando desde un mueble', () => {
    const g = newLava();
    const f = g.plats.find(p => p.kind === 'furniture' && p.floor > 0)!;
    const b = g.buildings[f.b];
    Object.assign(g.player, { x: f.x + f.w / 2, y: f.y, ground: f, vy: 0 });
    g.time = 0;
    for (let i = 0; i < 90; i++) { g.lava = -100; step(g, { ...idle, jump: i < 5 }, 1 / 60); }
    expect(g.player.y).toBeGreaterThan((f.floor + 1) * b.fh - 0.01);
    expect(g.player.y).toBeLessThan((f.floor + 1) * b.fh + PLAYER_H);
  });
});
