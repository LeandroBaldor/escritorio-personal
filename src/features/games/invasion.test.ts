import { describe, expect, it } from 'vitest';
import {
  aliensAt, aliveAliens, buildCity, CITY_TOP, rainAt, RAIN_FROM, wallPath, GAME_SECONDS, GOAL_KILLS, LIVES, hitbox, newInvasion, poseOf, REVEAL_EVERY, REVEAL_TIME, revealed, ruinAt, shoot, step, takeEvents, UFO_FROM, ufosAt,
  type Invasion, type Person,
} from './invasion';
import { ANOMALIES, fitsPlace, shuffledAnomalies } from './invasionAnomalies';

const run = (g: Invasion, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) step(g, 0.05); };
// Le apunta al medio del cuerpo (o a la cabeza) de una persona.
const aimAt = (g: Invasion, p: Person, head = false) => { const b = hitbox(g, p); return head ? [b.headX, b.headY] as const : [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2] as const; };
// Que no haya nadie más en la línea de tiro.
const clear = (g: Invasion, p: Person) => { const [x, y] = aimAt(g, p); return !g.people.some(o => o !== p && !o.dead && !o.gone && (({ x1, x2, y1, y2 }) => x >= x1 && x <= x2 && y >= y1 && y <= y2)(hitbox(g, o))); };

describe('Invasión: la ciudad', () => {
  const city = buildCity();
  it('tiene muchos edificios distintos: de ladrillo, antiguos, vidriados, oficinas, hotel y obras en construcción', () => {
    expect(city.buildings.length).toBeGreaterThanOrEqual(14);
    expect(new Set(city.buildings.map(b => b.style))).toEqual(new Set(['brick', 'stucco', 'glass', 'office', 'construction', 'old', 'hotel']));
    for (let i = 1; i < city.buildings.length; i++) expect(city.buildings[i].style).not.toBe(city.buildings[i - 1].style);
    expect(new Set(city.buildings.map(b => b.floors)).size).toBeGreaterThan(5);
  });

  it('los edificios son altos: casi todos pasan los 10 pisos', () => {
    expect(city.buildings.filter(b => b.floors >= 10).length).toBe(city.buildings.length);
    expect(Math.max(...city.buildings.map(b => b.floors))).toBeGreaterThanOrEqual(19);
    expect(CITY_TOP).toBeGreaterThan(Math.max(...city.buildings.map(b => b.top)));
  });

  it('en planta baja hay locales y bares, y arriba departamentos con habitaciones de todo tipo', () => {
    const shops = new Set(city.rooms.filter(r => r.shop).map(r => r.shop));
    expect(shops.has('bar')).toBe(true);
    expect(shops.size).toBeGreaterThan(6);
    const themes = new Set(city.rooms.map(r => r.theme));
    for (const theme of ['living', 'kitchen', 'bedroom', 'bath', 'office', 'site']) expect(themes.has(theme as never), theme).toBe(true);
    for (const room of city.rooms) for (const f of room.furniture) { expect(f.x).toBeGreaterThanOrEqual(room.x1); expect(f.x + f.w).toBeLessThanOrEqual(room.x2); }
  });

  it('siempre es la misma ciudad', () => {
    expect(buildCity().rooms.map(r => [r.theme, r.x1])).toEqual(city.rooms.map(r => [r.theme, r.x1]));
  });
});

describe('Invasión: la gente y los aliens', () => {
  it('hay mucha gente haciendo cosas distintas y arrancan 5 aliens disfrazados', () => {
    const g = newInvasion(1);
    expect(g.people.length).toBeGreaterThan(80);
    expect(new Set(g.people.map(p => p.act)).size).toBeGreaterThan(12);
    expect(aliveAliens(g)).toBe(5);
    expect(g.people.filter(p => p.room < 0).length).toBeGreaterThan(20); // en la vereda
  });

  it('a cada alien se le ve la cara de alien 5 segundos cada 30, cada uno con su propio ritmo', () => {
    expect(REVEAL_TIME).toBe(5);
    const g = newInvasion(2), aliens = g.people.filter(p => p.alien);
    for (const p of aliens) {
      const shown = Array.from({ length: 600 }, (_, i) => revealed(p, i * 0.1)).filter(Boolean).length * 0.1;
      expect(shown).toBeCloseTo((60 / REVEAL_EVERY) * REVEAL_TIME, 0);
    }
    expect(new Set(aliens.map(p => Math.round(p.revealPhase))).size).toBeGreaterThan(2);
    expect(g.people.filter(p => !p.alien).some(p => revealed(p, 0) || revealed(p, 15))).toBe(false);
  });

  it('hay más de 100 anomalías y en cada partida salen en otro orden, sin repetirse hasta usarlas todas', () => {
    expect(ANOMALIES.length).toBeGreaterThan(100);
    expect(new Set(ANOMALIES.map(a => a.text)).size).toBe(ANOMALIES.length);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const a = shuffledAnomalies(r), b = shuffledAnomalies(r);
    expect(new Set(a).size).toBe(ANOMALIES.length);
    expect(a).not.toEqual(b);
    expect(fitsPlace(ANOMALIES.find(x => x.where === 'kitchen')!, 'living')).toBe(false);
    expect(fitsPlace(ANOMALIES.find(x => x.where === 'street')!, null)).toBe(true);
  });

  it('los aliens hacen anomalías distintas que no se repiten', () => {
    const g = newInvasion(4);
    run(g, 150);
    expect(g.seen.length).toBeGreaterThan(20);
    expect(new Set(g.seen).size).toBe(g.seen.length);
  });

  it('los aliens incendian departamentos y dejan cajas con explosivos (y la gente también deja cajas)', () => {
    const g = newInvasion(5);
    run(g, 200);
    expect(g.rooms.some(r => r.fire > 0 || r.burnt > 0)).toBe(true);
    const all = takeEvents(g);
    expect(all.some(e => e.type === 'lighter' || e.type === 'ray')).toBe(true);
    const g2 = newInvasion(6);
    let explosive = 0, harmless = 0;
    for (let t = 0; t < 240; t += 0.05) { step(g2, 0.05); for (const b of g2.boxes) { if (b.explosive) explosive = Math.max(explosive, b.id); else harmless = Math.max(harmless, b.id); } }
    expect(explosive).toBeGreaterThan(0);
    expect(harmless).toBeGreaterThan(0);
  });

  it('con el tiempo hay más aliens, a los 5 minutos llueve, a los 7 llegan los ovnis y a los 10 la ciudad queda destruida', () => {
    expect(RAIN_FROM).toBe(300);
    expect(UFO_FROM).toBe(420);
    expect(rainAt(RAIN_FROM - 1)).toBe(0);
    expect(rainAt(RAIN_FROM + 60)).toBe(1);
    expect(aliensAt(0)).toBe(5);
    expect(aliensAt(400)).toBeGreaterThan(12);
    expect(ufosAt(UFO_FROM - 1)).toBe(0);
    expect(ufosAt(UFO_FROM + 1)).toBe(1);
    expect(ufosAt(GAME_SECONDS - 1)).toBeGreaterThan(3);
    expect(ruinAt(GAME_SECONDS)).toBe(1);
    const g = newInvasion(7);
    run(g, 330);
    expect(g.ufos.length).toBe(0);
    const events = takeEvents(g);
    expect(events.some(e => e.type === 'rain')).toBe(true);
    expect(events.some(e => e.type === 'thunder')).toBe(true); // relámpagos
    run(g, UFO_FROM + 15 - 330);
    expect(g.ufos.length).toBe(1);
    expect(aliveAliens(g)).toBeGreaterThanOrEqual(aliensAt(UFO_FROM) - 1);
    run(g, 105);
    const ruined = g.rooms.filter(r => r.destroyed).length / g.rooms.length;
    expect(ruined).toBeGreaterThan(ruinAt(540) * 0.6);
    run(g, 70);
    expect(g.over).toBe(true);
    expect(g.outcome).toBe('time');
    expect(g.rooms.every(r => r.destroyed)).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'end')).toBe(true);
  }, 30000);
});

describe('Invasión: lo que hacen los aliens', () => {
  it('si la mira les pasa cerca, se quedan mirándola fijo (las personas no)', () => {
    const g = newInvasion(31), alien = g.people.find(p => p.alien && p.room >= 0)!;
    for (const p of g.people) if (p.alien) { p.nextComm = 999; p.nextAnomaly = 999; p.nextSabotage = 999; p.nextStare = 0; }
    g.aim = { x: alien.x + 1, y: alien.y + 0.8 };
    run(g, 8);
    expect(alien.stareUntil).toBeGreaterThan(0);
    expect(g.people.filter(p => !p.alien).every(p => p.stareUntil === 0)).toBe(true);
    // Mientras mira fijo, se queda parado mirando para el lado de la mira.
    alien.stareUntil = g.time + 3; step(g, 0.05);
    expect(alien.moving).toBe(false);
    expect(alien.dir).toBe(1);
  });

  it('hablan por un intercomunicador extraterrestre', () => {
    const g = newInvasion(32);
    run(g, 60);
    expect(takeEvents(g).filter(e => e.type === 'comm').length).toBeGreaterThan(2);
  });

  it('pasean un rato con la bomba (una caja roja) antes de dejarla', () => {
    const g = newInvasion(33), alien = g.people.find(p => p.alien && p.room >= 0)!;
    for (const p of g.people) if (p.alien && p !== alien) p.nextSabotage = 999;
    alien.nextSabotage = 0; alien.nextAnomaly = 999; alien.nextComm = 999; alien.nextStare = 999;
    let carried = 0;
    while (!alien.sabotage || alien.sabotage.kind !== 'box') { alien.sabotage = null; alien.nextSabotage = 0; step(g, 0.05); }
    const until = alien.sabotage.carryUntil;
    expect(until - g.time).toBeGreaterThan(7);
    while (g.time < until) { step(g, 0.05); if (alien.moving) carried++; }
    expect(carried).toBeGreaterThan(50); // camina con la caja
    expect(g.boxes.filter(b => b.explosive).length).toBe(0);
    run(g, 6);
    expect(g.boxes.some(b => b.explosive)).toBe(true);
  });

  it('a veces caminan por las paredes y el techo (y el tiro les pega ahí)', () => {
    const g = newInvasion(34), room = g.rooms.find(r => r.floor === 3 && r.x2 - r.x1 > 3)!;
    const start = room.x1 + 1;
    const floor = wallPath(room, start, 0);
    expect(floor.x).toBeCloseTo(start); expect(floor.y).toBe(room.y); expect(floor.wall).toBe(0);
    const W = room.x2 - room.x1 - 0.6, H = room.h - 0.04;
    const up = wallPath(room, start, (room.x2 - 0.3 - start) + H / 2);
    expect(up.wall).toBeCloseTo(-Math.PI / 2);
    expect(up.y).toBeGreaterThan(room.y + 0.5);
    const top = wallPath(room, start, (room.x2 - 0.3 - start) + H + W / 2);
    expect(top.wall).toBeCloseTo(Math.PI);
    expect(top.y).toBeCloseTo(room.y + H);
    const alien = g.people.find(p => p.alien)!;
    alien.room = room.id; alien.x = start; alien.y = room.y; alien.sabotage = null; alien.comm = null; alien.stareUntil = 0;
    const WALL = ANOMALIES.find(a => a.fx.t === 'move' && a.fx.mode === 'wallwalk')!;
    alien.anomaly = { id: WALL.id, t0: g.time - ((room.x2 - 0.3 - start) + H + W / 2) / 1.3, until: g.time + 30, seed: 0 };
    alien.tx = start;
    const pose = poseOf(g, alien);
    expect(pose.wall).toBeCloseTo(Math.PI); // cabeza abajo en el techo
    const box = hitbox(g, alien);
    expect(box.y2).toBeCloseTo(room.y + H);
    expect(shoot(g, (box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2)).toBe('alien');
  });
});

describe('Invasión: el disparo', () => {
  it('matar a un alien suma uno y el alien explota en una nube verde (no queda el cuerpo, queda la mancha)', () => {
    const g = newInvasion(8), alien = g.people.find(p => p.alien && p.room >= 0)!;
    const [x, y] = aimAt(g, alien, true);
    expect(shoot(g, x, y)).toBe('alien');
    expect(g.kills).toBe(1);
    expect(g.headshots).toBe(1);
    expect(alien.dead?.alien).toBe(true);
    expect(alien.gone).toBe(true);
    expect(g.blasts.some(b => b.green)).toBe(true);
    expect(g.particles.filter(p => p.kind === 'goo').length).toBeGreaterThan(200); // explota exagerado
    expect(g.blasts.filter(b => b.green).length).toBe(2);
    expect(g.decals.filter(d => d.goo).length).toBeGreaterThanOrEqual(8); // y salpica la pared
    expect(takeEvents(g).some(e => e.type === 'kill')).toBe(true);
    expect(g.over).toBe(false);
  });

  it('le disparás a una persona: mucha sangre y perdés una vida; con 3, perdés', () => {
    const g = newInvasion(9);
    expect(LIVES).toBe(3);
    const alien = g.people.find(p => p.alien)!;
    for (let i = 1; i <= LIVES; i++) {
      const human = g.people.find(p => !p.alien && !p.dead && !p.gone && p.room >= 0 && p.act !== 'flee' && clear(g, p))!;
      const before = g.particles.filter(p => p.kind === 'blood').length;
      expect(shoot(g, ...aimAt(g, human))).toBe('civilian');
      expect(g.particles.filter(p => p.kind === 'blood').length - before).toBeGreaterThan(100);
      expect(g.decals.filter(d => d.blood).length).toBeGreaterThanOrEqual(i * 6);
      expect(g.civilians).toBe(i);
      const events = takeEvents(g);
      expect(events.find(e => e.type === 'civilian')).toMatchObject({ lives: LIVES - i });
      expect(g.over).toBe(i === LIVES);
      expect(events.some(e => e.type === 'end')).toBe(i === LIVES);
    }
    expect(g.outcome).toBe('civilian');
    expect(shoot(g, ...aimAt(g, alien))).toBe('none'); // ya terminó
  });

  it('con 10 aliens eliminados, ganás', () => {
    const g = newInvasion(15);
    expect(GOAL_KILLS).toBe(10);
    for (let i = 0; i < GOAL_KILLS; i++) {
      const alien = g.people.find(p => p.alien && !p.dead && !p.gone)!;
      alien.anomaly = null;
      // Si alguien se le cruza adelante, se va (acá solo importa que se pueda ganar).
      const [ax, ay] = aimAt(g, alien);
      for (const o of g.people) { const b = hitbox(g, o); if (o !== alien && ax >= b.x1 && ax <= b.x2 && ay >= b.y1 && ay <= b.y2) o.gone = true; }
      expect(g.over).toBe(false);
      expect(shoot(g, ...aimAt(g, alien))).toBe('alien');
      step(g, 0.05); // llegan otros aliens a reemplazarlos
    }
    expect(g.kills).toBe(GOAL_KILLS);
    expect(g.over).toBe(true);
    expect(g.outcome).toBe('won');
  });

  it('a los ovnis las balas no les hacen nada', () => {
    const g = newInvasion(10);
    run(g, UFO_FROM + 30);
    const u = g.ufos[0];
    expect(shoot(g, u.x, u.y)).toBe('ufo');
    expect(g.ufos).toHaveLength(1);
  });

  it('un tiro a una caja con explosivos la desactiva; a una caja común no le pasa nada', () => {
    const g = newInvasion(11);
    g.boxes.push({ id: 1, room: -1, x: 10, y: 0, explosive: true, t0: 0, explodeAt: 30, defused: false, exploded: false, hit: false, kind: 0 });
    g.boxes.push({ id: 2, room: -1, x: 14, y: 0, explosive: false, t0: 0, explodeAt: 30, defused: false, exploded: false, hit: false, kind: 0 });
    g.people = g.people.filter(p => p.room >= 0);
    expect(shoot(g, 10, 0.2)).toBe('defused');
    expect(shoot(g, 14, 0.2)).toBe('box');
    expect(g.defused).toBe(1);
  });

  it('si no le pega a nadie, deja un agujero (y si es una ventana, la rompe)', () => {
    const g = newInvasion(12);
    g.people = [];
    const room = g.rooms.find(r => r.floor === 3)!;
    expect(shoot(g, (room.x1 + room.x2) / 2, room.y + 1.5)).toBe('miss');
    expect(g.decals.at(-1)?.glass).toBe(true);
  });

  it('la caja con explosivos que nadie desactiva explota, prende fuego y mata a los que están al lado', () => {
    const g = newInvasion(13);
    const room = g.rooms.find(r => r.floor === 2)!;
    const x = (room.x1 + room.x2) / 2;
    g.people = g.people.filter(p => p.room !== room.id);
    g.boxes.push({ id: 1, room: room.id, x, y: room.y, explosive: true, t0: 0, explodeAt: 1, defused: false, exploded: false, hit: false, kind: 0 });
    g.people.push({ ...g.people[0], id: 999, room: room.id, x: x + 0.5, y: room.y, act: 'read', actUntil: 99, tx: x + 0.5, alien: false, dead: null, gone: false, panic: 0, anomaly: null, sabotage: null });
    run(g, 1.5);
    expect(room.fire).toBeGreaterThan(0);
    expect(g.people.find(p => p.id === 999)?.dead).toBeTruthy();
    expect(g.civilians).toBe(0); // no cuenta como que le disparaste
    expect(takeEvents(g).some(e => e.type === 'explosion')).toBe(true);
  });

  it('los aliens dejan bombas seguido (y avisa la radio)', () => {
    const g = newInvasion(21);
    let bombs = 0;
    for (let t = 0; t < 180; t += 0.05) { step(g, 0.05); bombs += takeEvents(g).filter(e => e.type === 'bomb').length; }
    expect(bombs).toBeGreaterThanOrEqual(4);
  });

  it('la pose cambia el lugar donde está la cabeza (sentado, acostado)', () => {
    const g = newInvasion(14);
    const sitting = g.people.find(p => poseOf(g, p).kind === 'sit')!;
    const b = hitbox(g, sitting);
    expect(b.y2 - b.y1).toBeLessThan(sitting.look.size * 0.8);
  });
});
