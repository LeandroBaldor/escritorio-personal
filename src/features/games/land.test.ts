import { describe, expect, it } from 'vitest';
import { BUILD_STATS, POWER_MAX, ROLE_STATS, addUnit, castPower, newLandGame, orderSmart, placeBuilding, popCap, popUsed, research, stepLand, takeLandEvents, train, type LandGame } from './land';
import { CIVS, CIV_IDS } from './landCivs';

const run = (g: LandGame, s: number) => { for (let t = 0; t < s; t += 0.05) stepLand(g, 0.05); };
const mine = (g: LandGame) => g.units.filter(u => u.owner === 0 && !u.dead);
const base = (g: LandGame, o: 0 | 1) => g.buildings.find(b => b.owner === o && b.kind === 'base' && !b.dead)!;

describe('Land of Warriors', () => {
  it('las 10 civilizaciones tienen sus seis guerreros, cinco construcciones y un poder', () => {
    expect(CIV_IDS).toHaveLength(10);
    for (const c of CIV_IDS) { expect(Object.keys(CIVS[c].units)).toHaveLength(6); expect(Object.keys(CIVS[c].buildings)).toHaveLength(5); expect(CIVS[c].power.name).toBeTruthy(); }
  });
  it('arranca con una base, cuatro trabajadores y cristales cerca', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 1);
    expect(g.buildings.filter(b => b.owner === 0)).toHaveLength(1);
    expect(mine(g).filter(u => u.role === 'worker')).toHaveLength(4);
    expect(popCap(g, 0)).toBe(10);
    const b = base(g, 0);
    expect(g.nodes.some(n => n.kind === 'stone' && Math.hypot(n.x - b.x, n.y - b.y) < 500)).toBe(true);
    expect(g.nodes.some(n => n.kind === 'gem' && Math.hypot(n.x - b.x, n.y - b.y) < 500)).toBe(true);
  });
  it('los trabajadores juntan piedras y las llevan a la base', () => {
    const g = newLandGame('elfos', 'orcos', 5, 'normal', 2); g.ai.t = 1e9;
    const n = g.nodes.filter(q => q.kind === 'stone').sort((a, b) => Math.hypot(a.x - base(g, 0).x, a.y - base(g, 0).y) - Math.hypot(b.x - base(g, 0).x, b.y - base(g, 0).y))[0];
    const stone = g.sides[0].stone;
    orderSmart(g, mine(g).map(u => u.id), n.x, n.y);
    run(g, 30);
    expect(g.sides[0].stone).toBeGreaterThan(stone + 40);
  });
  it('se construye un cuartel y entrena soldados (con población)', () => {
    const g = newLandGame('orcos', 'humano', 3, 'normal', 3); g.ai.t = 1e9; g.sides[0].stone = 2000; g.sides[0].gem = 2000;
    const b0 = base(g, 0), w = mine(g)[0];
    const bar = placeBuilding(g, 0, 'barracks', b0.x + 300, b0.y - 120, [w.id]);
    expect(bar).toBeTruthy();
    run(g, BUILD_STATS.barracks.time + 6);
    expect(bar!.built).toBe(1);
    expect(train(g, bar!.id, 'melee')).toBe(true);
    run(g, ROLE_STATS.melee.time + 1);
    expect(mine(g).some(u => u.role === 'melee')).toBe(true);
    expect(takeLandEvents(g).some(e => e.type === 'trained')).toBe(true);
    for (let i = 0; i < 10; i++) train(g, bar!.id, 'ranged');
    expect(popUsed(g, 0)).toBeLessThanOrEqual(popCap(g, 0));
  });
  it('el taller necesita el cuartel', () => {
    const g = newLandGame('enanos', 'humano', 3, 'normal', 4); g.sides[0].stone = 2000; g.sides[0].gem = 2000;
    const b0 = base(g, 0);
    expect(placeBuilding(g, 0, 'workshop', b0.x + 300, b0.y - 100, [])).toBeNull();
  });
  it('los soldados pelean solos y el que muere desaparece', () => {
    const g = newLandGame('humano', 'orcos', 3, 'normal', 5); g.ai.t = 1e9;
    const a = addUnit(g, 0, 'elite', 1300, 700), b = addUnit(g, 1, 'melee', 1360, 700);
    run(g, 8);
    expect(b.hp).toBeLessThanOrEqual(0);
    expect(a.hp).toBeGreaterThan(0);
    expect(g.sides[0].kills).toBe(1);
  });
  it('el especial que cura le devuelve vida a los suyos', () => {
    const g = newLandGame('elfos', 'orcos', 3, 'normal', 6); g.ai.t = 1e9;
    const healer = addUnit(g, 0, 'special', 1300, 700), hurt = addUnit(g, 0, 'melee', 1360, 700); hurt.hp = 20;
    run(g, 6);
    expect(hurt.hp).toBeGreaterThan(40);
    expect(healer.hp).toBeGreaterThan(0);
  });
  it('las mejoras suben el ataque de todo el ejército', () => {
    const g = newLandGame('humano', 'orcos', 3, 'normal', 7); g.ai.t = 1e9; g.sides[0].stone = 5000; g.sides[0].gem = 5000;
    expect(research(g, base(g, 0).id, 'attack')).toBe(true);
    run(g, 19);
    expect(g.sides[0].up.attack).toBe(1);
  });
  it('el poder especial: la explosión daña a los enemigos del lugar', () => {
    const g = newLandGame('humano', 'orcos', 3, 'normal', 8); g.ai.t = 1e9;
    const e = addUnit(g, 1, 'melee', 1300, 700); g.sides[0].power = POWER_MAX;
    expect(castPower(g, 0, 1300, 700)).toBe(true);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(g.sides[0].power).toBe(0);
  });
  it('si cae la base enemiga se gana', () => {
    const g = newLandGame('sauriano', 'abisal', 3, 'normal', 9); g.ai.t = 1e9;
    const b = base(g, 1); b.hp = 10;
    addUnit(g, 0, 'heavy', b.x - 200, b.y + 60).order = { k: 'attack', id: b.id };
    run(g, 8);
    expect(g.phase).toBe('won');
  });
  it('la computadora junta, construye, arma un ejército y ataca', () => {
    const g = newLandGame('humano', 'orcos', 5, 'normal', 10);
    for (const u of mine(g)) u.order = { k: 'idle' }; // (el jugador no hace nada)
    run(g, 260);
    const ai = g.units.filter(u => u.owner === 1 && !u.dead);
    expect(g.buildings.some(b => b.owner === 1 && b.kind === 'barracks' && b.built >= 1)).toBe(true);
    expect(ai.filter(u => u.role !== 'worker').length + g.sides[0].lost).toBeGreaterThan(3);
    expect(g.ai.wave).toBeGreaterThan(0);
  });
});
