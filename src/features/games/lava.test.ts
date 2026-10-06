import { describe, expect, it } from 'vitest';
import {
  buildCity, BURN_T, elevatorAt, elevatorPeriod, elevatorY, HANG, heliState, HELI_AIR, HELI_WAIT, lavaLevel, LAVA_DELAY, newLava, nextLanding,
  personState, PLAYER_H, REACH, START_BUILDINGS, step, takeEvents, towerOf, zipY,
  type City, type Input, type LavaGame, type Plat,
} from './lava';

const idle: Input = { left: false, right: false, jump: false, down: false, up: false };
const run = (g: LavaGame, seconds: number, input: Partial<Input> = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60);
};
const platById = (c: City) => new Map(c.plats.map(p => [p.id, p]));

// Camino más rápido hasta un helicóptero, sumando el tiempo de caminar entre una unión y la siguiente. Un
// lugar solo sirve si la lava todavía no llegó cuando lo alcanza alguien que tarda `slack` veces más. Al
// llegar arriba hay que esperar a que aterrice algún helicóptero (sin que llegue la lava).
function fastestRoute(c: City, slack: number, startX = c.starts[0].x1 + 0.3 * (c.starts[0].x2 - c.starts[0].x1)) {
  const byId = platById(c), out = new Map<number, typeof c.links>();
  for (const l of c.links) out.set(l.from, [...(out.get(l.from) ?? []), l]);
  const tower = towerOf(c);
  const goals = new Set(c.plats.filter(p => (p.b === tower.id && p.kind === 'roof') || p.kind === 'pad').map(p => p.id));
  type State = { plat: number; x: number; t: number; path: string[] };
  const best = new Map<string, number>();
  const queue: State[] = [{ plat: c.street, x: startX, t: 0, path: [] }];
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t);
    const s = queue.shift()!;
    if (goals.has(s.plat)) {
      const y = byId.get(s.plat)!.y, arrive = s.t * slack;
      const wait = Math.min(...c.helis.filter(h => Math.abs(h.y - y) < 0.01).map(h => nextLanding(h, arrive)));
      if (lavaLevel(arrive + wait) < y - 0.5) return { ...s, wait };
      continue;
    }
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

  it('siempre es la misma y termina en la torre más alta, con tres helicópteros', () => {
    const again = buildCity();
    expect(again.plats.map(p => [p.kind, p.x, p.y])).toEqual(city.plats.map(p => [p.kind, p.x, p.y]));
    const tower = towerOf(city);
    expect(tower.tower).toBe(true);
    expect(city.buildings.every(b => b === tower || b.top < tower.top)).toBe(true);
    expect(city.helis).toHaveLength(3);
    expect(city.helis.every(h => h.x + h.w > tower.x && h.x < tower.x + tower.w + 6 && h.y >= tower.top - 4 * tower.fh)).toBe(true);
  });

  it('hay edificios en construcción (sin paredes) y edificios caídos apoyados en el de al lado', () => {
    const building = city.buildings.filter(b => b.construction);
    expect(building.length).toBeGreaterThanOrEqual(2);
    for (const b of building) expect(city.walls.some(w => w.x > b.x - 0.01 && w.x < b.x + b.w + 0.01)).toBe(false);
    expect(new Set(city.plats.filter(p => p.furniture && city.buildings[p.b]?.construction).map(p => p.furniture)).size).toBeGreaterThan(1);
    expect(city.fallens.length).toBeGreaterThanOrEqual(2);
    for (const f of city.fallens) {
      expect(f.b).toBe(f.a + 1);
      expect(f.y2).toBeGreaterThan(city.buildings[f.a].top + 2);
      // La rampa se sube caminando: cada escalón está a menos de lo que se sube de un paso.
      const ramp = city.plats.filter(p => p.kind === 'ramp' && p.x >= f.x1 - 0.1 && p.x <= f.x2).sort((p, q) => p.x - q.x);
      expect(ramp.length).toBeGreaterThan(8);
      ramp.forEach((p, i) => expect(p.y - (i ? ramp[i - 1].y : city.buildings[f.a].top)).toBeLessThan(0.6));
    }
  });

  it('se pasa de edificio en edificio de muchas formas: camas elásticas, tirolesas y rampas', () => {
    const modes = new Set(city.links.map(l => l.mode));
    for (const m of ['bounce', 'zip', 'ramp', 'jump', 'walk', 'elevator'] as const) expect(modes.has(m), m).toBe(true);
    expect(city.plats.filter(p => p.kind === 'trampoline').length).toBeGreaterThanOrEqual(2);
    expect(city.zips.length).toBeGreaterThanOrEqual(2);
    for (const z of city.zips) expect(z.y2).toBeLessThan(z.y1); // siempre en bajada
  });

  it('los departamentos tienen puertas a los costados con balcones para salir', () => {
    const balconies = city.plats.filter(p => p.kind === 'balcony');
    expect(balconies.length).toBeGreaterThan(10);
    for (const p of balconies) {
      const b = city.buildings[p.b];
      const side = p.x < b.x ? b.doors.left : b.doors.right;
      expect(side.has(p.floor)).toBe(true);
    }
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
    expect(new Set(city.plats.filter(p => p.furniture).map(p => p.furniture)).size).toBeGreaterThan(15);
    expect(city.plats.filter(p => p.furniture).length).toBeGreaterThan(130);
    expect(new Set(city.climbs.map(c => c.skin))).toEqual(new Set(['ladder', 'rope', 'escape']));
    expect(city.escapes.length).toBeGreaterThan(1);
    // Las escaleras de emergencia están rotas: nunca llegan a la terraza.
    for (const e of city.escapes) expect(e.broken).toBeLessThan(city.buildings[e.b].floors);
    // Los ascensores llegan como mucho hasta la terraza.
    for (const e of city.elevators) expect(e.y2).toBeCloseTo(city.buildings[e.b].top);
    expect(city.fires.length).toBeGreaterThan(25);
    expect(city.sparks.length).toBeGreaterThan(18);
    expect(city.sparks.some(s => s.kind === 'cable') && city.sparks.some(s => s.kind === 'puddle')).toBe(true);
    expect(city.buildings.reduce((n, b) => n + b.holes.length, 0)).toBeGreaterThan(10);
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

  it('jugando bien se llega al helicóptero antes que la lava, pero hay que apurarse (arranques en cualquier lugar)', () => {
    expect(city.starts).toHaveLength(START_BUILDINGS);
    for (const st of city.starts) {
      for (const k of [0, 0.5, 1]) {
        const x = st.x1 + k * (st.x2 - st.x1);
        expect(fastestRoute(city, 1.5, x), `desde el edificio ${st.b}`).not.toBeNull();
        expect(fastestRoute(city, 6, x), `desde el edificio ${st.b}, muy despacio`).toBeNull();
      }
    }
  });
});

describe('¡El piso es de lava!: el juego', () => {
  it('la lava espera unos segundos y después sube cada vez más rápido', () => {
    expect(lavaLevel(0)).toBe(lavaLevel(LAVA_DELAY));
    const a = lavaLevel(LAVA_DELAY + 20) - lavaLevel(LAVA_DELAY + 10), b = lavaLevel(LAVA_DELAY + 80) - lavaLevel(LAVA_DELAY + 70);
    expect(b).toBeGreaterThan(a * 1.5);
  });

  it('si la lava te alcanza, perdés', () => {
    const g = newLava(0);
    run(g, 30);
    expect(g.dying?.reason).toBe('lava');
    run(g, 2);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'gameover')).toBe(true);
  });

  it('las paredes no se atraviesan: se sale por las puertas', () => {
    const g = newLava(0);
    const b = g.buildings[0];
    run(g, 3, { left: true });
    expect(g.player.x).toBeLessThan(b.x); // en la planta baja hay puerta a la calle
    const p = g.player;
    // En un piso sin puerta del lado derecho, la pared frena.
    const floor = g.plats.find(pl => {
      const w = g.buildings[pl.b];
      return pl.kind === 'floor' && !w.construction && !w.doors.right.has(Math.round(pl.y / w.fh)) && pl.x + pl.w > w.x + w.w - 1;
    })!;
    const w = g.buildings[floor.b];
    Object.assign(p, { x: w.x + w.w - 1.2, y: floor.y, ground: floor, vy: 0 });
    g.time = 0;
    run(g, 0.5, { right: true });
    expect(p.x).toBeLessThan(w.x + w.w);
  });

  it('el fuego y los cortocircuitos matan', () => {
    const g = newLava(0);
    const f = g.fires[0];
    const floor = g.plats.find(pl => pl.kind === 'floor' && Math.abs(pl.y - f.y) < 0.01 && pl.x <= f.x1 && pl.x + pl.w >= f.x2)!;
    Object.assign(g.player, { x: f.x1 - 0.4, y: f.y, ground: floor });
    run(g, 0.3, { right: true });
    expect(g.dying?.reason).toBe('fire');

    const g2 = newLava(0);
    const s = g2.sparks.find(sp => sp.kind === 'puddle')!;
    const floor2 = g2.plats.find(pl => pl.kind === 'floor' && Math.abs(pl.y - s.y1) < 0.01 && pl.x <= s.x1 && pl.x + pl.w >= s.x2)!;
    Object.assign(g2.player, { x: (s.x1 + s.x2) / 2, y: s.y1, ground: floor2 });
    run(g2, s.period + 0.1);
    expect(g2.dying?.reason).toBe('zap');
  });

  it('la gente que alcanza la lava arde unos segundos y queda carbonizada', () => {
    const g = newLava(0);
    const person = g.people.find(p => p.y === 0)!;
    run(g, 12);
    expect(person.burnAt).not.toBeNull();
    expect(personState(person, person.burnAt! + 0.5)).toBe('burning');
    expect(personState(person, person.burnAt! + BURN_T + 0.1)).toBe('charred');
    expect(g.people.filter(p => p.y > 20).every(p => p.burnAt === null)).toBe(true);
  });

  it('cada partida arranca en un lugar distinto de la cuadra', () => {
    const xs = new Set(Array.from({ length: 12 }, () => newLava().player.x.toFixed(2)));
    expect(xs.size).toBeGreaterThan(6);
    const city = buildCity();
    for (let i = 0; i < 60; i++) {
      const g = newLava();
      expect(city.starts.some(s => g.player.x >= s.x1 && g.player.x <= s.x2)).toBe(true);
      expect(g.player.y).toBe(0);
      // Nunca arranca adentro de un ascensor (que lo subiría solo): al rato sigue en la vereda.
      for (let t = 0; t < 4; t += 1 / 60) step(g, idle, 1 / 60);
      expect(g.player.y).toBe(0);
      expect(g.bestGround).toBe(0);
    }
    for (let b = 0; b < city.starts.length; b++) expect(newLava(b).player.y).toBe(0);
  });

  it('el ascensor para en cada piso con las puertas abiertas y llega hasta la terraza (y no más)', () => {
    const g = newLava(0);
    const car = g.plats.find(p => p.elev && p.elev.stops.length > 3)!;
    const e = car.elev!;
    const ys = Array.from({ length: Math.ceil(elevatorPeriod(e) * 20) }, (_, i) => elevatorAt(e, i * 0.05));
    expect(Math.max(...ys.map(s => s.y))).toBeCloseTo(e.y2);
    for (const stop of e.stops) expect(ys.some(s => s.open && Math.abs(s.y - stop) < 1e-6), `para en ${stop}`).toBe(true);
    // Entrás cuando abre las puertas abajo y te lleva hasta arriba.
    const t0 = Array.from({ length: 4000 }, (_, i) => i * 0.02).find(t => elevatorY(e, t) === e.y1 && elevatorY(e, t + 0.05) > e.y1)!;
    g.time = t0; g.lava = -100;
    const floor = g.plats.find(p => p !== car && !p.elev && Math.abs(p.y - e.y1) < 0.01 && p.x <= e.x && p.x + p.w >= e.x + e.w)!;
    Object.assign(g.player, { x: e.x + e.w / 2, y: e.y1, ground: floor, vy: 0 });
    car.y = e.y1;
    const step60 = (s: number) => { for (let t = 0; t < s; t += 1 / 60) { g.lava = -100; step(g, idle, 1 / 60); g.dying = null; } };
    step60(elevatorPeriod(e) / 2);
    expect(g.player.y).toBeGreaterThan(e.y2 - 0.5);
  });

  it('los helicópteros aterrizan, esperan 5 segundos, vuelan unos 30 y vuelven (por turnos)', () => {
    const g = newLava(0);
    for (const h of g.helis) {
      const states = Array.from({ length: 800 }, (_, i) => heliState(h, i * 0.1));
      const landed = states.filter(s => s.phase === 'landed').length * 0.1, air = states.filter(s => s.phase !== 'landed').length * 0.1;
      expect(landed / (landed + air)).toBeCloseTo(HELI_WAIT / (HELI_WAIT + HELI_AIR), 1);
      expect(Math.max(...states.map(s => s.y))).toBeGreaterThan(h.y + 6);
    }
    // Aterrizan por turnos: siempre hay uno que aterriza pronto.
    for (let t = 0; t < 120; t += 0.5) expect(Math.min(...g.helis.map(h => nextLanding(h, t)))).toBeLessThan(HELI_AIR / 3 + 1);
  });

  it('se gana subiéndose a un helicóptero aterrizado (en el aire no)', () => {
    const g = newLava(0);
    const h = g.helis[0];
    g.time = Array.from({ length: 400 }, (_, i) => i * 0.1).find(t => heliState(h, t).phase === 'air')!;
    Object.assign(g.player, { x: h.x + h.w / 2, y: h.y + 0.1, ground: null, vy: 0 });
    step(g, idle, 1 / 60);
    expect(g.won).toBe(false);

    const g2 = newLava(0);
    const h2 = g2.helis[1];
    g2.time = Array.from({ length: 400 }, (_, i) => i * 0.1).find(t => heliState(h2, t).phase === 'landed' && heliState(h2, t).left > 1)!;
    Object.assign(g2.player, { x: h2.x + h2.w / 2, y: h2.y + 0.1, ground: null, vy: 0 });
    step(g2, idle, 1 / 60);
    expect(g2.won).toBe(true);
    expect(takeEvents(g2).some(e => e.type === 'win')).toBe(true);
  });

  it('por las sogas y escaleras se sube y se baja', () => {
    const g = newLava(0);
    const at = (y: number, x: number) => g.plats.find(p => (p.kind === 'floor' || p.kind === 'roof') && Math.abs(p.y - y) < 0.01 && p.x <= x && p.x + p.w >= x);
    const rope = g.climbs.find(c => c.skin === 'rope' && c.y1 > 1 && at(c.y1 - 0.05, c.x) && at(c.y2 - 0.3, c.x))!;
    const lower = at(rope.y1 - 0.05, rope.x)!, upper = at(rope.y2 - 0.3, rope.x)!;
    const hold = (input: Partial<Input>, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) { g.lava = -100; step(g, { ...idle, ...input }, 1 / 60); } };
    // Desde abajo, ↑ te agarra y te sube hasta el piso de arriba.
    Object.assign(g.player, { x: rope.x, y: lower.y, ground: lower, vy: 0 });
    hold({ up: true }, 0.1);
    expect(g.player.climb).toBe(rope);
    hold({ up: true }, 3);
    hold({}, 1);
    expect(g.player.ground).toBe(upper);
    // Desde arriba, ↓ te agarra y te baja hasta el piso de abajo.
    hold({ down: true }, 0.1);
    expect(g.player.climb).toBe(rope);
    hold({ down: true }, (rope.y2 - rope.y1) / 4 + 0.3);
    hold({}, 1);
    expect(g.player.ground).toBe(lower);
  });

  it('la cama elástica te tira para arriba y la tirolesa te lleva al otro edificio', () => {
    const g = newLava(0);
    const tramp = g.plats.find(p => p.kind === 'trampoline')!;
    Object.assign(g.player, { x: tramp.x + tramp.w / 2, y: tramp.y + 1, ground: null, vy: -1 });
    let top = 0;
    for (let i = 0; i < 40; i++) { g.lava = -100; step(g, idle, 1 / 60); top = Math.max(top, g.player.y); }
    expect(top - tramp.y).toBeGreaterThan(4);
    expect(takeEvents(g).some(e => e.type === 'bounce')).toBe(true);

    const g2 = newLava(0);
    const z = g2.zips[0];
    const roof = g2.plats.find(p => p.kind === 'roof' && Math.abs(p.y - (z.y1 - 1.25)) < 0.01 && p.x <= z.x1 && p.x + p.w >= z.x1)!;
    Object.assign(g2.player, { x: z.x1, y: roof.y, ground: roof, vy: 0 });
    for (let i = 0; i < 6; i++) { g2.lava = -100; step(g2, { ...idle, up: true }, 1 / 60); }
    expect(g2.player.zip).toBe(z);
    expect(g2.player.y + HANG).toBeCloseTo(zipY(z, g2.player.x));
    for (let t = 0; t < (z.x2 - z.x1) / 7 + 1.5; t += 1 / 60) { g2.lava = -100; step(g2, idle, 1 / 60); }
    expect(g2.player.zip).toBeNull();
    expect(g2.player.ground?.kind).toBe('floor');
    expect(g2.player.x).toBeGreaterThan(z.x2 - 0.5);
    expect(g2.player.y).toBeCloseTo(z.y2 - 1.5);
  });

  it('se sube un piso saltando desde un mueble', () => {
    const g = newLava(0);
    const f = g.plats.find(p => p.kind === 'furniture' && p.floor > 0)!;
    const b = g.buildings[f.b];
    Object.assign(g.player, { x: f.x + f.w / 2, y: f.y, ground: f, vy: 0 });
    g.time = 0;
    for (let i = 0; i < 90; i++) { g.lava = -100; step(g, { ...idle, jump: i < 5 }, 1 / 60); }
    expect(g.player.y).toBeGreaterThan((f.floor + 1) * b.fh - 0.01);
    expect(g.player.y).toBeLessThan((f.floor + 1) * b.fh + PLAYER_H);
  });
});
