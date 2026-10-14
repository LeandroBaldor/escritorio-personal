import { describe, expect, it } from 'vitest';
import {
  buildCity, BURN_T, elevatorAt, elevatorPeriod, elevatorY, HANG, heliState, heliTarget, HELI_AIR, HELI_H, HELI_W, HELI_WAIT, landingAt, lavaLevel, LAVA_DELAY, newLava, nextLanding, PADS, padFor,
  personState, personX, PLAYER_H, TORCH_W, REACH, START_BUILDINGS, step, takeEvents, towerOf, zipY, floorY, WIRE_UP,
  type City, type Input, type LavaGame, type Plat,
} from './lava';

const idle: Input = { left: false, right: false, jump: false, down: false, up: false };
const run = (g: LavaGame, seconds: number, input: Partial<Input> = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60);
};
const platById = (c: City) => new Map(c.plats.map(p => [p.id, p]));

// Camino más rápido hasta el helicóptero, sumando el tiempo de caminar entre una unión y la siguiente. Un
// lugar solo sirve si la lava todavía no llegó cuando lo alcanza alguien que tarda `slack` veces más. Al
// llegar a una terraza con helipuerto hay que esperar a que el helicóptero aterrice ahí (sin que llegue la lava).
function fastestRoute(c: City, slack: number, startX = c.starts[0].x1 + 0.3 * (c.starts[0].x2 - c.starts[0].x1)) {
  const byId = platById(c), out = new Map<number, typeof c.links>();
  for (const l of c.links) out.set(l.from, [...(out.get(l.from) ?? []), l]);
  const roofPad = new Map(c.plats.filter(p => p.kind === 'roof').map(p => [p.id, c.pads.findIndex(pad => pad.b === p.b)] as const).filter(([, i]) => i >= 0));
  type State = { plat: number; x: number; t: number; path: string[] };
  const best = new Map<string, number>();
  const queue: State[] = [{ plat: c.street, x: startX, t: 0, path: [] }];
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t);
    const s = queue.shift()!;
    if (roofPad.has(s.plat)) {
      const y = byId.get(s.plat)!.y, arrive = s.t * slack, wait = landingAt(c, roofPad.get(s.plat)!, arrive) - arrive;
      if (lavaLevel(arrive + wait) < y - 0.5) return { ...s, wait };
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

  it('siempre es la misma y termina en la torre más alta, con 6 helipuertos en terrazas lejanas entre sí', () => {
    const again = buildCity();
    expect(again.plats.map(p => [p.kind, p.x, p.y])).toEqual(city.plats.map(p => [p.kind, p.x, p.y]));
    const tower = towerOf(city);
    expect(tower.tower).toBe(true);
    expect(city.buildings.every(b => b === tower || b.top < tower.top)).toBe(true);
    expect(city.pads).toHaveLength(PADS);
    expect(city.pads.some(p => p.b === tower.id)).toBe(true);
    for (const pad of city.pads) {
      const b = city.buildings[pad.b];
      expect(pad.y).toBe(b.top);
      expect(pad.x).toBeGreaterThanOrEqual(b.x);
      expect(pad.x + HELI_W).toBeLessThanOrEqual(b.x + b.w);
    }
    const xs = city.pads.map(p => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(20);
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
    for (const m of ['bounce', 'zip', 'ramp', 'jump', 'walk', 'elevator', 'wire'] as const) expect(modes.has(m), m).toBe(true);
    expect(city.plats.filter(p => p.kind === 'trampoline').length).toBeGreaterThanOrEqual(5);
    expect(city.zips.length).toBeGreaterThanOrEqual(2);
    for (const z of city.zips) expect(z.y2).toBeLessThan(z.y1); // siempre en bajada
  });

  it('hay avenidas anchas cruzadas por puentes colgantes rotos (con un hueco que se salta)', () => {
    const byId = platById(city);
    const sky = city.plats.filter(p => p.kind === 'skybridge');
    expect(sky.length).toBeGreaterThanOrEqual(6);
    const holes = city.links.filter(l => byId.get(l.from)?.kind === 'skybridge' && byId.get(l.to)?.kind === 'skybridge');
    expect(holes.length).toBe(sky.length); // cada mitad salta a la otra
    for (const l of holes) { expect(l.mode).toBe('jump'); expect(l.edge).toBeGreaterThan(1.3); expect(l.edge).toBeLessThanOrEqual(2.2); }
  });

  it('las torres de lujo tienen escaleras caracol que se suben de a un escalón', () => {
    expect(city.spirals.length).toBeGreaterThan(10);
    for (const sp of city.spirals) {
      const b = city.buildings[sp.b];
      expect(b.luxury).toBe(true);
      const steps = city.plats.filter(p => p.kind === 'step' && p.b === sp.b && p.y > sp.y0 && p.y < sp.y1 && p.x >= sp.x1 - 0.01 && p.x + p.w <= sp.x2 + 0.01).sort((p, q) => p.y - q.y);
      expect(steps.length).toBeGreaterThan(4);
      steps.forEach((p, i) => {
        const prev = i ? steps[i - 1] : null;
        expect(p.y - (prev ? prev.y : sp.y0)).toBeLessThan(0.6);
        if (prev) expect(Math.min(p.x + p.w, prev.x + prev.w) - Math.max(p.x, prev.x)).toBeGreaterThan(0.2); // se pisan: se sube caminando
      });
      expect(sp.y1 - steps[steps.length - 1].y).toBeLessThan(0.6);
    }
  });

  it('hay cables entre edificios para colgarse (casi todos en subida), grúas en las obras y góndolas por afuera', () => {
    expect(city.wires.length).toBeGreaterThanOrEqual(8);
    expect(city.wires.filter(w => w.y2 - w.y1 > 1.2).length).toBeGreaterThan(city.wires.length / 3);
    for (const w of city.wires) expect(w.x2).toBeGreaterThan(w.x1);
    expect(city.cranes.length).toBe(2);
    for (const c of city.cranes) {
      const B = city.buildings[c.b + 1];
      expect(c.jy).toBeGreaterThan(B.top + 1.5);
      expect(c.jy - B.top).toBeLessThan(REACH - 0.15); // desde la terraza de al lado se salta a la pluma
      expect(city.plats.some(p => p.kind === 'jib' && p.x <= c.mx && p.x + p.w >= B.x + 2)).toBe(true);
    }
    expect(city.elevators.filter(e => e.skin === 'gondola').length).toBeGreaterThanOrEqual(2);
    expect(city.elevators.filter(e => e.skin === 'hoist').length).toBe(2);
    for (const e of city.elevators.filter(e => e.skin === 'gondola')) {
      const b = city.buildings[e.b];
      expect(e.x >= b.x + b.w || e.x + e.w <= b.x).toBe(true); // por afuera
      for (const y of e.stops) { const k = Math.round(y / b.fh); expect(e.x > b.x ? b.doors.right.has(k) : b.doors.left.has(k)).toBe(true); }
    }
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
    expect(Math.min(...tops)).toBeLessThan(25);
    expect(Math.max(...tops)).toBeGreaterThan(100);
    expect(city.buildings.filter(b => b.luxury).length).toBeGreaterThanOrEqual(3);
    expect(new Set(city.buildings.map(b => b.hue)).size).toBe(city.buildings.length);
    expect(new Set(city.buildings.map(b => b.fh.toFixed(2))).size).toBeGreaterThan(5);
  });

  it('tiene de todo para subir, pasar de edificio en edificio y morirse', () => {
    const kinds = new Set(city.plats.map(p => p.kind));
    for (const k of ['step', 'furniture', 'bridge', 'plank', 'landing', 'elevator', 'roof', 'floor'] as Plat['kind'][]) expect(kinds.has(k), k).toBe(true);
    expect(new Set(city.plats.filter(p => p.furniture).map(p => p.furniture)).size).toBeGreaterThan(15);
    expect(city.plats.filter(p => p.furniture).length).toBeGreaterThan(120);
    expect(new Set(city.climbs.map(c => c.skin))).toEqual(new Set(['ladder', 'rope', 'escape', 'pipe', 'chain', 'mast', 'scaffold', 'pole']));
    expect(city.escapes.length).toBeGreaterThan(1);
    // Las escaleras de emergencia están rotas: nunca llegan a la terraza.
    for (const e of city.escapes) expect(e.broken).toBeLessThan(city.buildings[e.b].floors);
    // Los ascensores llegan como mucho hasta la terraza.
    for (const e of city.elevators) if (e.skin !== 'gondola') expect(e.y2).toBeCloseTo(city.buildings[e.b].top);
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
  }, 20000); // juega 60 partidas: le damos tiempo de sobra

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

  it('el helicóptero aterriza, espera 5 segundos, vuela 30 y aterriza en otro helipuerto lejos (nunca en la lava)', () => {
    const g = newLava(0);
    const states = Array.from({ length: 2000 }, (_, i) => ({ t: i * 0.1, ...heliState(g, i * 0.1) }));
    const landed = states.filter(s => s.phase === 'landed').length, all = states.filter(s => s.t >= 20).length;
    expect(landed / all).toBeCloseTo(HELI_WAIT / (HELI_WAIT + HELI_AIR), 1);
    // Cada aterrizaje dura 5 segundos y el siguiente es 30 segundos después, en otro lugar lejos del anterior.
    const visits: { t: number; pad: number }[] = [];
    for (const s of states) if (s.phase === 'landed' && (!visits.length || s.t - visits[visits.length - 1].t > HELI_WAIT + 1)) visits.push({ t: s.t, pad: s.pad });
    expect(visits.length).toBeGreaterThan(4);
    // (mientras quede más de un helipuerto sin lava)
    const twoLeft = (t: number) => g.pads.filter(p => lavaLevel(t + HELI_WAIT) < p.y - 2).length > 1;
    for (let i = 1; i < visits.length && twoLeft(visits[i].t); i++) {
      expect(visits[i].t - visits[i - 1].t).toBeCloseTo(HELI_WAIT + HELI_AIR, 0);
      expect(visits[i].pad).not.toBe(visits[i - 1].pad);
      expect(Math.abs(g.pads[visits[i].pad].x - g.pads[visits[i - 1].pad].x)).toBeGreaterThan(20);
      expect(lavaLevel(visits[i].t + HELI_WAIT)).toBeLessThan(g.pads[visits[i].pad].y);
    }
    expect(new Set(visits.slice(0, 4).map(v => v.pad)).size).toBe(4);
    // En el aire vuela alto y aterriza justo en el helipuerto.
    expect(Math.max(...states.map(s => s.y - g.pads[s.pad].y))).toBeGreaterThan(6);
    const n = 2, at = heliState(g, 20 + n * (HELI_WAIT + HELI_AIR) + 1);
    expect(at.phase).toBe('landed');
    expect(at.pad).toBe(padFor(g, n));
    expect([at.x, at.y]).toEqual([g.pads[at.pad].x, g.pads[at.pad].y]);
    expect(nextLanding(g, 20 + n * (HELI_WAIT + HELI_AIR) - 4)).toEqual({ wait: expect.closeTo(4, 5), pad: at.pad });
  });

  it('cada partida empieza la ronda de helipuertos por uno distinto', () => {
    const firsts = new Set(Array.from({ length: PADS }, (_, k) => padFor({ ...buildCity(), heliShift: k }, 0)));
    expect(firsts.size).toBeGreaterThan(3);
  });

  it('la flecha apunta al helipuerto donde va a aterrizar (o donde está aterrizado)', () => {
    const g = newLava(0);
    for (const t of [5, 20, 23, 40, 60]) {
      const s = heliState(g, t), target = heliTarget(g, t);
      expect(target.pad).toBe(s.pad);
      expect(target.x).toBeCloseTo(g.pads[s.pad].x + HELI_W / 2);
      expect(target.y).toBe(g.pads[s.pad].y);
    }
  });

  it('se gana subiéndose al helicóptero aterrizado (en el aire no)', () => {
    const g = newLava(0);
    g.time = Array.from({ length: 400 }, (_, i) => i * 0.1).find(t => heliState(g, t).phase === 'air')!;
    const h = heliState(g, g.time);
    Object.assign(g.player, { x: h.x + HELI_W / 2, y: h.y + 0.1, ground: null, vy: 0 });
    step(g, idle, 1 / 60);
    expect(g.won).toBe(false);

    const g2 = newLava(0);
    g2.time = Array.from({ length: 400 }, (_, i) => i * 0.1).find(t => heliState(g2, t).phase === 'landed' && heliState(g2, t).left > 1)!;
    const h2 = heliState(g2, g2.time);
    Object.assign(g2.player, { x: h2.x + HELI_W / 2, y: h2.y + HELI_H * 0.1, ground: null, vy: 0 });
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

  // Una partida tranquila: sin fuego, ni cortocircuitos, ni lava (para probar cómo se mueve).
  const calm = () => { const g = newLava(0, 1); g.fires = []; g.sparks = []; return g; };
  const place = (g: LavaGame, pl: Plat, x: number) => Object.assign(g.player, { x, y: pl.y, vx: 0, vy: 0, ground: pl, climb: null, zip: null, wire: null, climbCooldown: 0 });
  // El piso (o la calle) donde se apoya algo a esa altura.
  const floorAt = (g: LavaGame, y: number, x: number) => g.plats.find(p => (p.kind === 'floor' || p.kind === 'roof' || p.kind === 'street') && Math.abs(p.y - y) < 0.01 && x >= p.x && x <= p.x + p.w)!;

  it('hay pisos con una pared en el medio (con la puerta tapiada) que no se puede cruzar: hay que dar la vuelta', () => {
    const g = calm();
    g.people = [];
    const walls = g.buildings.flatMap(b => b.partitions.map(w => ({ b, w })));
    expect(walls.length).toBeGreaterThan(15);
    for (const { b, w } of walls.slice(0, 5)) {
      const y = floorY(b, w.floor), left = floorAt(g, y, w.x - 1), right = floorAt(g, y, w.x + 1);
      expect(left).not.toBe(right); // el piso queda partido en dos (no hay unión entre las mitades)
      expect(g.links.some(l => l.from === left.id && l.to === right.id)).toBe(false);
      g.time = 0;
      place(g, left, w.x - 1.6);
      for (let t = 0; t < 1; t += 1 / 60) { g.lava = -100; step(g, { ...idle, right: true }, 1 / 60); }
      expect(g.player.x).toBeLessThan(w.x);
      expect(g.player.ground).toBe(left);
    }
  });

  it('se cuelga de un cable con ↑ y avanza a mano hasta el otro edificio (en subida)', () => {
    const g = calm(), w = g.wires.find(w => w.y2 - w.y1 > 1.2)!;
    const A = g.buildings.find(b => Math.abs(b.x + b.w - 0.8 - w.x1) < 0.01)!, B = g.buildings.find(b => Math.abs(b.x + 0.8 - w.x2) < 0.01)!;
    place(g, floorAt(g, w.y1 - WIRE_UP, w.x1), w.x1);
    expect(A.doors.right.has(Math.round((w.y1 - WIRE_UP) / A.fh))).toBe(true);
    run(g, 0.1, { up: true });
    expect(g.player.wire).toBe(w);
    expect(takeEvents(g).some(e => e.type === 'wire')).toBe(true);
    run(g, 0.5, { right: true });
    expect(g.player.y + HANG).toBeCloseTo(zipY(w, g.player.x), 3);
    for (let i = 0; i < 60 * 8 && g.player.wire; i++) step(g, { ...idle, right: true }, 1 / 60);
    expect(g.player.wire).toBeNull(); // en la punta se suelta
    run(g, 0.5);
    expect(g.player.ground?.b).toBe(B.id);
    expect(g.player.y).toBeCloseTo(w.y2 - WIRE_UP, 2);
  });

  it('en la obra se trepa el mástil de la grúa, se camina por la pluma y se baja en la terraza de al lado', () => {
    const g = calm(), c = g.cranes[0], A = g.buildings[c.b], B = g.buildings[c.b + 1];
    place(g, floorAt(g, A.top, c.mx), c.mx);
    run(g, 0.1, { up: true });
    expect(g.player.climb?.skin).toBe('mast');
    run(g, (c.jy - A.top) / 4 + 1.5, { up: true });
    expect(g.player.ground?.kind).toBe('jib');
    run(g, (c.jx2 - c.mx) / 6 + 0.3, { right: true });
    run(g, 0.6);
    expect(g.player.ground?.b).toBe(B.id);
    expect(g.player.y).toBeCloseTo(B.top, 2);
  });

  it('la escalera caracol se sube yendo y viniendo', () => {
    const g = calm(), sp = g.spirals[0], b = g.buildings[sp.b];
    const k = Math.round(sp.y0 / b.fh);
    expect(k).toBeGreaterThanOrEqual(0);
    place(g, floorAt(g, sp.y0, sp.x1 - 0.2), sp.x1 - 0.2);
    let dir: 'right' | 'left' = 'right', best = g.player.y, still = 0;
    for (let i = 0; i < 60 * 12 && g.player.y < sp.y1 - 0.01; i++) {
      step(g, { ...idle, [dir]: true }, 1 / 60);
      if (g.player.y > best + 0.01) { best = g.player.y; still = 0; } else if (++still > 12) { dir = dir === 'right' ? 'left' : 'right'; still = 0; }
    }
    expect(g.player.y).toBeCloseTo(sp.y1, 2);
  });

  it('la góndola de limpiavidrios sube por afuera parando en cada piso', () => {
    const g = calm(), e = g.elevators.find(e => e.skin === 'gondola')!;
    const seen = new Set<number>();
    for (let t = 0; t < 60; t += 0.05) { const st = elevatorAt(e, t); if (st.open) seen.add(Math.round(st.y * 100)); }
    expect(seen.size).toBe(e.stops.length);
  });

  it('la cama elástica de abajo de un piso roto te tira hasta el piso de arriba', () => {
    const g = calm(), tp = g.plats.find(p => p.kind === 'trampoline' && p.b >= 0 && p.floor >= 0 && p.y < g.buildings[p.b].top - 1)!;
    const b = g.buildings[tp.b], above = floorY(b, tp.floor + 1);
    Object.assign(g.player, { x: tp.x + tp.w / 2, y: tp.y + 1, vx: 0, vy: 0, ground: null, climb: null, zip: null, wire: null });
    let top = 0;
    for (let i = 0; i < 60; i++) { step(g, idle, 1 / 60); top = Math.max(top, g.player.y); }
    expect(top).toBeGreaterThan(above + 1.5);
  });

  it('hay gente prendida fuego corriendo por los pisos: si te toca te prendés fuego, pero se la puede saltar', () => {
    const city = buildCity(), torches = city.people.filter(p => p.torch);
    expect(torches.length).toBeGreaterThanOrEqual(8);
    for (const q of torches) { expect(q.y).toBeGreaterThan(city.buildings[q.b].fh * 1.5); expect(q.speed).toBeGreaterThan(2); }
    // Quieto en su camino: te alcanza y perdés.
    let g = calm(), q = g.people.find(p => p.torch)!;
    const at = (x: number) => floorAt(g, q.y, x);
    // Un lugar de su camino sin muebles ni nada arriba (para que el salto caiga de nuevo en el piso).
    const clear = (x: number) => !!at(x) && !g.plats.some(p => p.y > q.y + 0.01 && p.y < q.y + 3 && p.x < x + 1.2 && p.x + p.w > x - 1.2);
    let mid = (q.x1 + q.x2) / 2;
    for (let d = 0; d < q.x2 - q.x1 && !clear(mid); d += 0.1) mid = clear((q.x1 + q.x2) / 2 + d) ? (q.x1 + q.x2) / 2 + d : (q.x1 + q.x2) / 2 - d;
    place(g, at(mid), mid);
    for (let i = 0; i < 60 * 12 && !g.dying; i++) { g.player.x = mid; step(g, idle, 1 / 60); }
    expect(g.dying?.reason).toBe('torch');
    // Saltándola cuando se acerca, pasa por abajo.
    g = calm(); q = g.people.find(p => p.torch)!;
    place(g, floorAt(g, q.y, mid), mid);
    let passed = 0;
    for (let i = 0; i < 60 * 12 && !g.dying && passed < 2; i++) {
      const d = Math.abs(personX(q, g.time).x - g.player.x);
      step(g, { ...idle, jump: !!g.player.ground && d < 1.3 && d > TORCH_W + 0.5 }, 1 / 60);
      if (d < 0.05) passed++;
    }
    expect(g.dying).toBeNull();
    expect(passed).toBeGreaterThan(0);
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
