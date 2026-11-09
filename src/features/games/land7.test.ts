import { describe, expect, it } from 'vitest';
import { AI_PREPARE, addBuilding, addUnit, cancelTrain, castPower, newLandGame, orderSmart, researchEvolution, stepLand, train } from './land';
import { findPath, generateTerrain, T, walkable } from './landMap';

describe('Land: economía, rivales y preparación de la IA', () => {
  it('recoge energía verde y la entrega a la base', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 42); g.ai.t = 1e9;
    const worker = g.units.find(u => u.owner === 0)!, base = g.buildings.find(b => b.owner === 0)!;
    const node = g.nodes.filter(n => n.kind === 'energy').sort((a, b) => Math.hypot(a.x - base.x, a.y - base.y) - Math.hypot(b.x - base.x, b.y - base.y))[0];
    orderSmart(g, [worker.id], node.x, node.y);
    for (let i = 0; i < 800; i++) stepLand(g, .05);
    expect(g.sides[0].energy).toBeGreaterThan(0); expect(node.amount).toBeLessThan(800);
  });
  it('las mejoras y la élite requieren energía; cancelar devuelve los tres recursos', () => {
    const g = newLandGame('humano', 'orcos', 1, 'normal', 42), side = g.sides[0], base = g.buildings.find(b => b.owner === 0)!;
    side.stone = side.gem = 5000;
    expect(researchEvolution(g, base.id)).toBe(false);
    const barracks=addBuilding(g,0,'barracks',base.x+500,base.y);barracks.built=1;side.levels.melee=2;side.energy = 75; expect(researchEvolution(g, barracks.id)).toBe(true); expect(side.energy).toBe(0);
    const workshop = addBuilding(g, 0, 'eliteBarracks', base.x + 300, base.y); workshop.built = 1;
    expect(train(g, workshop.id, 'elite')).toBe(false);
    side.energy = 75; expect(train(g, workshop.id, 'elite')).toBe(true); expect(side.energy).toBe(0);
    const stone = side.stone, gem = side.gem; cancelTrain(g, workshop.id);
    expect(side.energy).toBe(75); expect(side.stone).toBeGreaterThan(stone); expect(side.gem).toBeGreaterThan(gem);
  });
  it('crea economías y bases independientes para varias civilizaciones', () => {
    const g = newLandGame('humano', ['orcos', 'elfos', 'nomuerta'], 5, 'normal', 42);
    expect(g.sides).toHaveLength(4); expect(g.ais).toHaveLength(3); expect(g.ais[0]).not.toBe(g.ais[1]);
    for (let owner = 0; owner < 4; owner++) {
      expect(g.buildings.filter(b => b.owner === owner && b.kind === 'base')).toHaveLength(1);
      expect(g.units.filter(u => u.owner === owner)).toHaveLength(4);
    }
  });
  it('no declara victoria hasta destruir la última base rival', () => {
    const g = newLandGame('humano', ['orcos', 'elfos'], 5, 'normal', 42);
    const bases = g.buildings.filter(b => b.owner !== 0);
    for (const [i, b] of bases.entries()) {
      b.hp = 1; g.sides[0].power = 100; castPower(g, 0, b.x, b.y);
      expect(g.phase).toBe(i === bases.length - 1 ? 'won' : 'play');
    }
  });
  it('conecta las diez bases de una partida grande y una chica', () => {
    for (const size of ['small', 'huge'] as const) {
      const terrain = generateTerrain(7, size, 42, 10), start = terrain.bases[0].map(n => (n + .5) * T);
      expect(terrain.bases).toHaveLength(10);
      for (const [c, r] of terrain.bases.slice(1)) {
        const x = (c + .5) * T, y = (r + .5) * T, path = findPath(terrain, start[0], start[1], x, y);
        expect(walkable(terrain, x, y)).toBe(true); expect(path.length).toBeGreaterThan(0);
        expect(path[path.length - 1]).toEqual([x, y]);
      }
    }
  });
  it('exige preparación e infraestructura antes de atacar, incluso con tropas disponibles', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 42), base = g.buildings.find(b => b.owner === 1)!;
    for (let i = 0; i < 8; i++) addUnit(g, 1, 'worker', base.x + 70, base.y);
    for (let i = 0; i < 25; i++) addUnit(g, 1, i === 0 ? 'heavy' : 'melee', base.x + 100 + i * 10, base.y + 50);
    g.t = 181; stepLand(g, .05); expect(g.ai.wave).toBe(0);
    g.t = AI_PREPARE.normal + 1; g.ai.t = 0; stepLand(g, .05); expect(g.ai.wave).toBe(0);
    for (const kind of ['depot', 'workerBarracks', 'barracks', 'rangedBarracks', 'specialBarracks', 'workshop', 'eliteBarracks', 'tower', 'storehouse', 'farm'] as const) { const b = addBuilding(g, 1, kind, base.x + 300, base.y - 200); b.built = 1; }
    g.ai.t = 0; stepLand(g, .05); expect(g.ai.wave).toBe(1);
  });
  it('una ráfaga de tres trazadoras aplica una sola vez el daño del arma', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 42); g.ai.t = 1e9;
    const base = g.buildings.find(b => b.owner === 0)!, shooter = addUnit(g, 0, 'ranged', base.x, base.y - 180), target = addUnit(g, 1, 'melee', base.x + 120, base.y - 180);
    shooter.order = { k: 'attack', id: target.id }; const hp = target.hp; stepLand(g, .05);
    expect(g.shots.filter(s => s.owner === 0 && s.kind === 'bolt')).toHaveLength(3);
    expect(hp - target.hp).toBe(11);
  });
  it('el ejército en preparación defiende su base sin perseguir enemigos lejos', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 42); g.ai.t = 1e9;
    const base = g.buildings.find(b => b.owner === 1)!, guard = addUnit(g, 1, 'ranged', base.x, base.y + 100), intruder = addUnit(g, 0, 'melee', base.x + 650, base.y + 100);
    guard.defensive = true; guard.order = { k: 'attack', id: intruder.id }; const hp = intruder.hp;
    stepLand(g, .05); expect(guard.order.k).toBe('move'); expect(intruder.hp).toBe(hp);
    intruder.x = base.x + 100; guard.order = { k: 'attack', id: intruder.id }; stepLand(g, .05);
    expect(intruder.hp).toBeLessThan(hp);
  });
});
