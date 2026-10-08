import { describe, expect, it } from 'vitest';
import {
  BLOCKS, buildCity, FLOAT_Y, GOAL, newShark, PLAYER_TARGET, REACH, rescueX, SHARKS, sharksAt, step, takeEvents, TIME_LIMIT, WATER_Y, windAt, WIND_CALM, WIND_TURN, sharkMouth,
  type Input, type Lane, type Plat, type SharkGame,
} from './shark';

const idle: Input = { left: false, right: false, jump: false, down: false, up: false };
const run = (g: SharkGame, seconds: number, input: Partial<Input> = {}) => { for (let t = 0; t < seconds && !g.over && !g.won; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60); };
// Una partida tranquila: sin tiburones ni rescatados, para probar el movimiento.
const calm = () => { const g = newShark(1); g.sharks = []; g.rescues = []; g.plats = g.plats.filter(p => p.kind !== 'float'); g.time = 1; g.windPower = 0; return g; };
const stand = (g: SharkGame, pl: Plat, x = pl.x + pl.w / 2) => Object.assign(g.player, { x, y: pl.y, vx: 0, vy: 0, ground: pl, swimming: false, climb: null, zip: null });

describe('Ciudad Tiburón: la ciudad', () => {
  const c = buildCity();

  it('siempre es la misma, es grande y tiene edificios, casas y locales para los dos lados del comienzo', () => {
    expect(buildCity().plats.map(p => [p.kind, p.x, p.y])).toEqual(c.plats.map(p => [p.kind, p.x, p.y]));
    expect(c.blocks).toHaveLength(BLOCKS);
    expect(c.width).toBeGreaterThan(200);
    for (const kind of ['building', 'house', 'shop'] as const) {
      expect(c.blocks.some(b => b.kind === kind && b.x2 < c.startX), kind).toBe(true);
      expect(c.blocks.some(b => b.kind === kind && b.x1 > c.startX), kind).toBe(true);
    }
    const kinds = new Set(c.plats.map(p => p.kind));
    for (const k of ['landing', 'balcony', 'ac', 'stoop', 'sill', 'awning', 'tank', 'sign', 'cable', 'car', 'van', 'bus', 'kiosk', 'stop', 'tree', 'debris'] as const) expect(kinds.has(k), k).toBe(true);
    expect(c.zips.length).toBeGreaterThan(1);
    expect(new Set(c.climbs.map(k => k.skin))).toEqual(new Set(['ladder', 'rope', 'pipe', 'pole']));
  });

  it('cada calle tiene un cable para cruzar arriba, un poste para trepar desde el agua y en cada costado se puede salir del agua', () => {
    const exitOf = (face: number, side: number) =>
      c.plats.some(p => p.y <= 0.8 && p.kind !== 'debris' && (side > 0 ? p.x <= face + 0.01 + 1 && p.x + p.w > face : p.x + p.w >= face - 1.01 && p.x < face)) ||
      c.climbs.some(k => k.y1 < WATER_Y && Math.abs(k.x - face) < 2);
    for (const l of c.lanes) {
      expect(c.plats.some(p => p.kind === 'cable' && p.x === l.x1 && p.x + p.w === l.x2), `cable ${l.id}`).toBe(true);
      expect(c.climbs.some(k => k.skin === 'pole' && k.x === l.pole && k.y1 < WATER_Y && k.y2 === l.cable)).toBe(true);
      expect(exitOf(l.x1, 1), `izquierda ${l.id}`).toBe(true);
      expect(exitOf(l.x2, -1), `derecha ${l.id}`).toBe(true);
      expect(l.x2 - l.x1).toBeGreaterThan(6.5); // demasiado ancha para saltarla
    }
  });

  it('cada costado se trepa: los escalones quedan al alcance de un salto (o hay escalera, soga o caño hasta arriba)', () => {
    for (const b of c.blocks) for (const side of [-1, 1] as const) {
      if ((b.id === 0 && side < 0) || (b.id === BLOCKS - 1 && side > 0)) continue;
      const face = side < 0 ? b.x1 : b.x2;
      const near = c.plats.filter(p => p.kind !== 'cable' && (side > 0 ? p.x >= face - 0.01 && p.x < face + 2 : p.x + p.w <= face + 0.01 && p.x + p.w > face - 2)).map(p => p.y);
      const ys = [...new Set([...near, b.top])].sort((x, y) => x - y);
      const climbsUp = c.climbs.filter(k => Math.abs(k.x - face) < 2 && k.skin !== 'pole');
      const covered = (y1: number, y2: number) => climbsUp.some(k => k.y1 <= y1 + 0.01 && k.y2 >= y2 - 0.01);
      const bounce = c.plats.some(p => p.kind === 'awning' && near.includes(p.y));
      for (let i = 0; i + 1 < ys.length; i++) {
        const gap = ys[i + 1] - ys[i];
        expect(gap < REACH - 0.15 || covered(ys[i], ys[i + 1]) || bounce, `${b.kind} ${b.id} ${side}: ${ys[i]}→${ys[i + 1]}`).toBe(true);
      }
    }
  });
});

describe('Ciudad Tiburón: el juego', () => {
  it('arranca arriba de un local en el medio, con 5 tiburones lejos y 8 para rescatar', () => {
    const g = newShark(3);
    expect(g.player.ground?.kind).toBe('roof');
    expect(g.sharks).toHaveLength(5);
    for (const s of g.sharks) expect(Math.abs((g.lanes[s.lane].x1 + g.lanes[s.lane].x2) / 2 - g.player.x)).toBeGreaterThan(10);
    expect(g.rescues.filter(r => r.state === 'drift')).toHaveLength(8);
    expect(new Set(g.rescues.map(r => r.kind)).size).toBeGreaterThan(1);
  });

  it('con el tiempo llegan más tiburones y aparece el tiburón ballena', () => {
    expect(sharksAt(0)).toBe(5);
    expect(sharksAt(TIME_LIMIT - 1)).toBeGreaterThan(15);
    const g = newShark(4);
    Object.assign(g.player, { y: 40 }); g.player.ground = null; // lejos del agua, que no lo coman
    const types = new Set<string>();
    for (let t = 0; t < 200; t += 1 / 30) { g.player.y = 40; g.player.vy = 0; step(g, idle, 1 / 30); for (const s of g.sharks) types.add(s.type); }
    expect(g.sharks.length).toBe(sharksAt(g.time));
    expect(types).toEqual(new Set(['blanco', 'martillo', 'ballena']));
    expect(takeEvents(g).some(e => e.type === 'newType')).toBe(true);
    for (const l of g.lanes) expect(g.sharks.filter(s => s.lane === l.id).length).toBeLessThanOrEqual(2);
  });

  it('se rescata tocando al que flota y con 20 se gana', () => {
    const g = calm();
    const lane = g.lanes[3];
    g.rand = () => 0.5;
    g.rescues = []; for (let i = 0; i < 3; i++) { /* reposición controlada */ }
    run(g, 0.1);
    // Lo ponemos flotando al lado de un escalón y el bombero se para en el escalón.
    const stoop = g.plats.find(p => p.kind === 'stoop' && p.x >= lane.x1 - 0.01 && p.x < lane.x1 + 1)!;
    stand(g, stoop);
    const before = g.saved;
    g.rescues.push({ id: 1, kind: 'perro', float: 'goma', look: 0, state: 'drift', at: 0, fromX: 0, fromY: 0, plat: { id: 999, kind: 'float', x: stoop.x + 1.2, y: FLOAT_Y, w: 0.9, dx: 0, hue: 0 }, lane: lane.id, speed: 0, dir: 1, min: stoop.x + 1.2, max: stoop.x + 1.2 });
    g.plats.push(g.rescues[g.rescues.length - 1].plat);
    run(g, 0.05);
    expect(g.saved).toBe(before + 1);
    expect(takeEvents(g).some(e => e.type === 'saved')).toBe(true);
    g.saved = GOAL - 1;
    g.rescues.push({ id: 2, kind: 'gato', float: 'cajon', look: 0, state: 'drift', at: 0, fromX: 0, fromY: 0, plat: { id: 998, kind: 'float', x: stoop.x + 1.2, y: FLOAT_Y, w: 0.9, dx: 0, hue: 0 }, lane: lane.id, speed: 0, dir: 1, min: stoop.x + 1.2, max: stoop.x + 1.2 });
    g.plats.push(g.rescues[g.rescues.length - 1].plat);
    run(g, 0.05);
    expect(g.won).toBe(true);
  });

  it('desde muy alto no se alcanza a rescatar', () => {
    const g = calm();
    const lane = g.lanes[3];
    const cable = g.plats.find(p => p.kind === 'cable' && p.x === lane.x1)!;
    stand(g, cable, lane.pole + 1);
    g.rescues.push({ id: 1, kind: 'perro', float: 'goma', look: 0, state: 'drift', at: 0, fromX: 0, fromY: 0, plat: { id: 999, kind: 'float', x: lane.pole + 0.6, y: FLOAT_Y, w: 0.9, dx: 0, hue: 0 }, lane: lane.id, speed: 0, dir: 1, min: lane.pole + 0.6, max: lane.pole + 0.6 });
    run(g, 0.2);
    expect(g.saved).toBe(0);
  });

  const withShark = (type: keyof typeof SHARKS) => {
    const g = calm();
    const lane: Lane = g.lanes[5];
    g.sharks = [{ id: 77, type, lane: lane.id, x: lane.x2 - 1, dir: -1, state: 'patrol', t: 0, y: -0.4, vy: 0, vx: 0, target: 0, hunger: 99, rest: 0, turn: 9, born: 0 }];
    return { g, lane };
  };

  it('si estás cerca del agua el tiburón viene, avisa con burbujas, salta y te come', () => {
    const { g, lane } = withShark('blanco');
    const stoop = g.plats.find(p => p.kind === 'stoop' && p.x >= lane.x1 - 0.01 && p.x < lane.x1 + 1)!;
    stand(g, stoop);
    run(g, 0.2);
    expect(g.sharks[0].state).toBe('approach');
    expect(g.sharks[0].target).toBe(PLAYER_TARGET);
    let warned = false;
    for (let i = 0; i < 600 && !g.dying; i++) { step(g, idle, 1 / 60); if (g.sharks[0].state === 'warn') warned = true; }
    expect(warned).toBe(true);
    expect(g.dying?.reason).toBe('shark');
    run(g, 3);
    expect(g.over).toBe(true);
  });

  it('si te movés cuando avisa, el salto no te alcanza; y más arriba de lo que salta, no te ve', () => {
    const { g, lane } = withShark('blanco');
    const stoop = g.plats.find(p => p.kind === 'stoop' && p.x >= lane.x1 - 0.01 && p.x < lane.x1 + 1)!;
    stand(g, stoop);
    for (let i = 0; i < 600 && g.sharks[0].state !== 'warn'; i++) step(g, idle, 1 / 60);
    // Se sube al cable, lejos del alcance.
    const cable = g.plats.find(p => p.kind === 'cable' && p.x === lane.x1)!;
    stand(g, cable, lane.pole - 2);
    run(g, 4);
    expect(g.dying).toBeNull();
    expect(g.sharks[0].state).toBe('patrol');
  });

  it('cada tiburón salta distinto: el ballena salta bajito y el blanco muy alto', () => {
    expect(SHARKS.ballena.reach).toBeLessThan(SHARKS.martillo.reach);
    expect(SHARKS.blanco.reach).toBeGreaterThan(SHARKS.martillo.reach);
    expect(SHARKS.blanco.speed).toBeGreaterThan(SHARKS.ballena.speed * 2);
    // Parado en algo a 2,2 de altura: el ballena no llega, el blanco sí.
    for (const [type, dies] of [['ballena', false], ['blanco', true]] as const) {
      const { g, lane } = withShark(type);
      const k = { id: 5000, kind: 'kiosk' as const, x: lane.pole + 1, y: 2.2, w: 1.6, dx: 0, hue: 0 };
      g.plats.push(k);
      stand(g, k);
      run(g, 8);
      expect(!!g.dying, type).toBe(dies);
    }
  });

  it('si te caés al agua nadás despacio y el tiburón va derecho a buscarte', () => {
    const { g, lane } = withShark('blanco');
    // Un lugar de la calle sin nada abajo.
    let x = lane.x1 + 1.6;
    while (g.plats.some(p => p.y < 1 && p.x < x + 0.5 && p.x + p.w > x - 0.5)) x += 0.1;
    Object.assign(g.player, { x, y: 1, vy: 0, ground: null });
    run(g, 0.45);
    expect(g.player.swimming).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'splash')).toBe(true);
    run(g, 4);
    expect(g.dying?.reason).toBe('shark');
  });

  it('desde el agua se sale trepando por el poste', () => {
    const g = calm();
    const lane = g.lanes[2];
    Object.assign(g.player, { x: lane.pole, y: WATER_Y, swimming: true, ground: null });
    run(g, 0.1, { up: true });
    expect(g.player.climb?.skin).toBe('pole');
    run(g, 4, { up: true });
    expect(g.player.y).toBeGreaterThanOrEqual(lane.cable - 0.01);
  });

  it('los tiburones también se llevan a los que flotan (y después aparecen otros)', () => {
    const { g, lane } = withShark('blanco');
    Object.assign(g.player, { y: 40 }); g.player.ground = null;
    g.sharks[0].hunger = 0;
    const plat = { id: 999, kind: 'float' as const, x: lane.pole, y: FLOAT_Y, w: 0.9, dx: 0, hue: 0 };
    g.plats.push(plat);
    g.rescues.push({ id: 1, kind: 'gato', float: 'goma', look: 0, state: 'drift', at: 0, fromX: 0, fromY: 0, plat, lane: lane.id, speed: 0, dir: 1, min: lane.pole, max: lane.pole });
    for (let i = 0; i < 600 && !g.rescues.some(r => r.state === 'taken'); i++) { g.player.y = 40; g.player.vy = 0; step(g, idle, 1 / 60); }
    expect(g.rescues.some(r => r.id === 1 && r.state === 'taken')).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'taken')).toBe(true);
    for (let i = 0; i < 240; i++) { g.player.y = 40; g.player.vy = 0; step(g, idle, 1 / 60); }
    expect(g.rescues.some(r => r.id === 1)).toBe(false);
    expect(g.rescues.length).toBeGreaterThan(0);
  });

  it('las cosas que flotan te llevan, el toldo te hace rebotar y la tirolesa te baja', () => {
    const g = calm();
    const d = g.debris[0];
    d.speed = 1; d.dir = 1; d.plat.x = d.min;
    stand(g, d.plat, d.plat.x + 0.5);
    const x0 = g.player.x;
    run(g, 0.5);
    expect(g.player.x - x0).toBeGreaterThan(0.4);

    const aw = g.plats.find(p => p.kind === 'awning')!;
    Object.assign(g.player, { x: aw.x + aw.w / 2, y: aw.y + 0.5, vy: 0, ground: null, swimming: false });
    run(g, 0.25);
    expect(g.player.vy).toBeGreaterThan(10);

    const z = g.zips[0];
    const roof = g.plats.find(p => p.kind === 'roof' && Math.abs(p.y - (z.y1 - 1.05 - 0.25)) < 0.01 && z.x1 > p.x && z.x1 < p.x + p.w)!;
    stand(g, roof, z.x1);
    run(g, 0.05, { up: true });
    expect(g.player.zip).toBe(z);
    run(g, 6);
    expect(g.player.zip).toBeNull();
    expect(Math.abs(g.player.x - z.x2)).toBeLessThan(0.6);
  });

  it('el viento sopla para la derecha, se calma, sopla para la izquierda… y te empuja para los dos lados', () => {
    expect(windAt(WIND_CALM / 2)).toBe(0);
    expect(windAt(WIND_TURN / 2 + 1)).toBeGreaterThan(0.4);
    expect(windAt(WIND_TURN * 1.5 + 1)).toBeLessThan(-0.4);
    expect(windAt(WIND_TURN * 2.5 + 1)).toBeGreaterThan(0.4);
    for (const [at, sign] of [[WIND_TURN / 2, 1], [WIND_TURN * 1.5, -1]] as const) {
      const g = calm();
      const roof = g.plats.find(p => p.kind === 'roof' && p.w > 6)!;
      stand(g, roof);
      g.time = at; g.windPower = 1;
      const x0 = g.player.x;
      run(g, 1);
      expect((g.player.x - x0) * sign).toBeGreaterThan(0.9);
      expect(takeEvents(g).some(e => e.type === 'wind' && e.dir === sign)).toBe(true);
    }
  });

  it('el agua pasa por delante de los edificios: nadando se cruza de una calle a la otra', () => {
    const g = calm();
    const b = g.blocks[5];
    Object.assign(g.player, { x: b.x1 - 1, y: WATER_Y, swimming: true, ground: null });
    for (let i = 0; i < 60 * ((b.x2 - b.x1 + 2) / 2.2 + 2); i++) { g.sharks = []; step(g, { ...idle, right: true }, 1 / 60); }
    expect(g.dying).toBeNull();
    expect(g.player.x).toBeGreaterThan(b.x2 + 0.5);
  });

  it('los tiburones nadan por delante de los edificios, fuera de su calle', () => {
    const g = newShark(5);
    Object.assign(g.player, { y: 40 }); g.player.ground = null;
    let inFront = false;
    for (let i = 0; i < 60 * 60 && !inFront; i++) {
      g.player.y = 40; g.player.vy = 0; step(g, idle, 1 / 60);
      inFront = g.sharks.some(s => g.blocks.some(b => s.x > b.x1 + 0.5 && s.x < b.x2 - 0.5));
    }
    expect(inFront).toBe(true);
  });

  it('cuando te alcanza, el tiburón salta del agua, te tiene en la boca y se hunde con vos', () => {
    const { g, lane } = withShark('blanco');
    let x = lane.x1 + 1.6;
    while (g.plats.some(p => p.y < 1 && p.x < x + 0.5 && p.x + p.w > x - 0.5)) x += 0.1;
    Object.assign(g.player, { x, y: WATER_Y, swimming: true, ground: null });
    for (let i = 0; i < 600 && !g.dying; i++) step(g, idle, 1 / 60);
    const s = g.sharks[0];
    expect(s.state).toBe('bite');
    run(g, 0.3);
    expect(s.y).toBeGreaterThan(0); // salió del agua
    run(g, 0.3);
    const m = sharkMouth(s);
    expect(Math.abs(m.x - g.player.x)).toBeLessThan(0.05);
    run(g, 1.5);
    expect(s.y).toBeLessThan(WATER_Y);
    run(g, 1);
    expect(g.over).toBe(true);
  });

  it('si se termina el tiempo, perdés', () => {
    const g = calm();
    g.time = TIME_LIMIT - 0.5;
    run(g, 1);
    expect(g.dying?.reason).toBe('time');
    run(g, 2);
    expect(g.over).toBe(true);
  });

  it('el que flota se mueve con la corriente sin salirse de su calle', () => {
    const g = newShark(9);
    const r = g.rescues[0], lane = g.lanes[r.lane];
    Object.assign(g.player, { y: 40 }); g.player.ground = null;
    let moved = 0;
    const x0 = rescueX(r);
    for (let i = 0; i < 600; i++) { g.player.y = 40; g.player.vy = 0; step(g, idle, 1 / 60); if (r.state === 'drift') { moved = Math.max(moved, Math.abs(rescueX(r) - x0)); expect(r.plat.x).toBeGreaterThanOrEqual(lane.x1); expect(r.plat.x + r.plat.w).toBeLessThanOrEqual(lane.x2); } }
    expect(moved).toBeGreaterThan(0.5);
  });
});
