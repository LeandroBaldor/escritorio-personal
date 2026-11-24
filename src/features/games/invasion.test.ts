import { describe, expect, it } from 'vitest';
import {
  alienKind, ALIEN_KINDS, DAMAGE, HUMAN_PENALTY, aliensAt, aliveAliens, aliveHumans, ALIEN_TOTAL, HUMAN_TOTAL, buildCity, CITY_TOP, rainAt, RAIN_FROM, wallPath, GAME_SECONDS, hitbox, newInvasion, poseOf, REVEAL_EVERY, REVEAL_TIME, revealed, ruinAt, shoot, step, takeEvents, UFO_FROM, MOTHER_FROM, ufosAt, ROCKET_TIME, WALL_BREAK,
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
  it('hay mucha gente haciendo cosas distintas y arrancan 50 aliens y 600 humanos, sin ningún lugar vacío', () => {
    const g = newInvasion(1);
    expect(g.people.length).toBeGreaterThan(80);
    expect(new Set(g.people.map(p => p.act)).size).toBeGreaterThan(12);
    expect(aliveAliens(g)).toBe(50);
    expect(aliveHumans(g)).toBe(HUMAN_TOTAL);
    expect(g.people.filter(p => p.room < 0).length).toBeGreaterThan(20); // en la vereda
    for (const r of g.rooms) expect(g.people.some(p => p.room === r.id && !p.alien)).toBe(true); // nadie solo: gente en todos lados
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

  it('con el tiempo hay más aliens, a los 3 minutos llueve, a los 5 la nave nodriza, a los 8 los ovnis y a los 10 la ciudad queda destruida', () => {
    expect(RAIN_FROM).toBe(180);
    expect(UFO_FROM).toBe(480);
    expect(MOTHER_FROM).toBe(480);
    expect(rainAt(RAIN_FROM - 1)).toBe(0);
    expect(rainAt(RAIN_FROM + 60)).toBe(1);
    expect(aliensAt(0)).toBe(50);
    expect(aliensAt(400)).toBeGreaterThan(50);
    expect(aliensAt(GAME_SECONDS - 1)).toBe(ALIEN_TOTAL);
    expect(ufosAt(0)).toBe(0);
    expect(ufosAt(60)).toBe(1); // los de la nave andan desde el principio
    expect(ufosAt(UFO_FROM - 1)).toBe(2);
    expect(ufosAt(UFO_FROM + 1)).toBe(3);
    expect(ufosAt(GAME_SECONDS - 1)).toBeGreaterThan(3);
    expect(ruinAt(GAME_SECONDS)).toBe(1);
    const g = newInvasion(7);
    const motherUfos = () => g.ufos.filter(u => u.kind === 'mother').length;
    const launched = () => g.ufosLaunched;
    run(g, RAIN_FROM + 30);
    expect(launched()).toBe(2); // los de la nave nodriza andan desde el principio (2 antes de que llegue la nave)
    expect(g.penLaunched).toBeGreaterThan(0); // y los de Kombat Penales también
    const events = takeEvents(g);
    expect(events.some(e => e.type === 'rain')).toBe(true);
    run(g, 60);
    expect([...events, ...takeEvents(g)].some(e => e.type === 'thunder')).toBe(true); // relámpagos
    expect(launched()).toBe(2);
    run(g, UFO_FROM + 15 - (RAIN_FROM + 90));
    expect(launched()).toBe(3); // a los 8 minutos llega la nave y larga más
    expect(motherUfos()).toBeGreaterThan(0);
    expect(aliveAliens(g)).toBeGreaterThan(0);
    run(g, 540 - g.time);
    const ruined = g.rooms.filter(r => r.destroyed).length / g.rooms.length;
    expect(ruined).toBeGreaterThan(ruinAt(g.time) * 0.6);
    run(g, 70);
    expect(g.over).toBe(true);
    expect(g.time).toBe(GAME_SECONDS);
    expect(g.outcome).toBe(aliveHumans(g) > aliveAliens(g) ? 'won' : 'time');
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
    const alien = g.people.find(p => p.alien && alienKind(p).hp === 1)!; // un gris (cae de un tiro)
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
    const g = newInvasion(8), alien = g.people.find(p => p.alien && p.room >= 0 && alienKind(p).hp === 1)!;
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

  it('counts civilian losses without ending the match early', () => {
    const g = newInvasion(9);
    const before = aliveHumans(g);
    for (let i = 0; i < 3; i++) {
      const human = g.people.find(p => !p.alien && !p.dead && !p.gone && p.room >= 0 && p.act !== 'flee' && clear(g, p))!;
      expect(shoot(g, ...aimAt(g, human))).toBe('civilian');
      expect(g.decals.some(d => d.blood)).toBe(true);
    }
    expect(g.civilians).toBe(3);
    expect(aliveHumans(g)).toBe(before - 3);
    expect(g.over).toBe(false);
  });

  it('ends only at ten minutes and requires a human majority', () => {
    for (const surplus of [0, 1]) {
      const g = newInvasion(15);
      const human = g.people.find(p => !p.alien)!;
      const alien = g.people.find(p => p.alien)!;
      const secondHuman = g.people.find(p => !p.alien && p !== human)!;
      g.people = surplus ? [human, alien, secondHuman] : [human, alien];
      g.time = GAME_SECONDS - 0.05;
      expect(g.over).toBe(false);
      step(g, 0.05);
      expect(g.outcome).toBe(surplus ? 'won' : 'time');
    }
  });

  it('a gray shoots a nearby human with a red impact and earns the player no points', () => {
    const g = newInvasion(15);
    const gray = g.people.find(p => p.alien)!;
    const human = g.people.find(p => !p.alien)!;
    g.people = [gray, human];
    Object.assign(gray, { x: 30, y: 0, room: -1, tx: 30, sabotage: { kind: 'ray', t0: 0, x: 30, done: false, carryUntil: 0 } });
    Object.assign(human, { x: 31, y: 0, room: -1, tx: 31 });
    g.time = 1.6;
    step(g, 0.05);
    expect(human.gone).toBe(true);
    expect(gray.sabotage?.shot).toBeDefined();
    expect(g.particles.some(p => p.kind === 'blood')).toBe(true);
    expect(g.kills).toBe(0);
    expect(g.civilians).toBe(0);
  });

  it('civilians flee toward a refuge and crouch once they reach it', () => {
    const g = newInvasion(15);
    const human = g.people.find(p => !p.alien && p.room >= 0)!;
    const room = g.rooms[human.room];
    g.people = [human];
    human.x = (room.x1 + room.x2) / 2;
    human.panic = 6;
    step(g, 0.05);
    expect(poseOf(g, human).kind).toBe('run');
    expect(human.shelter?.room).toBe(room.id);
    run(g, 3);
    expect(poseOf(g, human).kind).toBe('squat');
    expect(aliveHumans(g)).toBe(1);
  });

  it('a los ovnis las balas no les hacen nada', () => {
    const g = newInvasion(10);
    run(g, UFO_FROM + 10);
    const u = g.ufos.find(o => o.kind === 'mother')!, n = g.ufos.length;
    g.ufos = g.ufos.filter(o => o === u || Math.abs(o.x - u.x) > 30);
    const left = g.ufos.length;
    expect(n).toBeGreaterThan(1); // también andan los de Kombat Penales
    expect(shoot(g, u.x, u.y, 'rifle')).toBe('ufo');
    expect(shoot(g, u.x, u.y, 'machine')).toBe('ufo');
    expect(g.ufos).toHaveLength(left);
    const kills = g.kills, grays = g.killsBy[0], points = g.points;
    expect(shoot(g, u.x, u.y, 'bazooka')).toBe('launched');
    takeEvents(g);
    run(g, ROCKET_TIME - 0.2);
    expect(g.ufos.some(o => o.id === u.id)).toBe(true); // el cohete todavía no llegó
    run(g, 0.4);
    expect(g.ufos.some(o => o.id === u.id)).toBe(false); // el cohete siguió al ovni y lo derribó
    expect(g.blasts.some(b => b.big && b.x === u.x)).toBe(true);
    const evs = takeEvents(g);
    expect(evs.some(e => e.type === 'rocketHit' && e.hit === 'ufoDestroyed')).toBe(true);
    expect(evs.some(e => e.type === 'radio' && e.say === 'ufoDown')).toBe(true); // aviso por radio
    expect(g.killsBy[0] - grays).toBeGreaterThanOrEqual(5); // cuenta como 5 grises muertos
    expect(g.kills - kills).toBeGreaterThanOrEqual(5);
    expect(g.points - points).toBeGreaterThanOrEqual(50);
  });

  it('los aliens grandes aguantan varios disparos y son más grandes según la especie', () => {
    const g = newInvasion(8);
    const want = { gris: [1, 1], anfibio: [1.3, 3], brutox: [1.5, 10], esporal: [1.1, 2], mantis: [1.25, 5], reptiliano: [1.1, 2] } as const;
    for (const k of ALIEN_KINDS) expect([k.size, k.hp]).toEqual(want[k.name]);
    const brutox = g.people.find(p => p.alien && alienKind(p).name === 'brutox')!;
    const gray = g.people.find(p => p.alien && alienKind(p).name === 'gris' && p.id % 5 === brutox.id % 5);
    if (gray) expect(brutox.look.size / gray.look.size).toBeCloseTo(1.5);
    g.people = g.people.filter(p => p === brutox || !p.alien);
    brutox.room = -1; brutox.y = 0; brutox.anomaly = null; brutox.sabotage = null; brutox.moving = false; brutox.speed = 0; brutox.x = 30;
    g.people = g.people.filter(p => p === brutox || p.room >= 0);
    for (let i = 0; i < 9; i++) { const [x, y] = aimAt(g, brutox); expect(shoot(g, x, y, 'machine')).toBe('hurt'); }
    expect(brutox.hp).toBe(1);
    const [x, y] = aimAt(g, brutox);
    expect(shoot(g, x, y, 'machine')).toBe('alien'); // el décimo lo mata
    expect(g.kills).toBe(1);
    expect(g.points).toBe(60); // el Brutox vale 60
    expect(g.killsBy[ALIEN_KINDS.findIndex(k => k.name === 'brutox')]).toBe(1);
  });

  it('el francotirador saca 10 puntos de vida: hasta el Brutox cae de un tiro', () => {
    const want = { gris: 10, anfibio: 50, brutox: 60, esporal: 20, mantis: 40, reptiliano: 30 } as const;
    for (const k of ALIEN_KINDS) expect(k.points).toBe(want[k.name]);
    expect(DAMAGE.rifle).toBe(10);
    const g = newInvasion(8);
    const brutox = g.people.find(p => p.alien && alienKind(p).name === 'brutox')!;
    g.people = g.people.filter(p => p === brutox || (!p.alien && p.room >= 0));
    brutox.room = -1; brutox.y = 0; brutox.anomaly = null; brutox.sabotage = null; brutox.moving = false; brutox.speed = 0; brutox.x = 30;
    const [x, y] = aimAt(g, brutox);
    expect(shoot(g, x, y, 'rifle')).toBe('alien');
    expect(g.points).toBe(60);
  });

  it('matar a un humano resta 50 puntos', () => {
    const g = newInvasion(8), human = g.people.find(p => !p.alien && p.room >= 0)!;
    const [x, y] = aimAt(g, human, true);
    expect(shoot(g, x, y)).toBe('civilian');
    expect(g.civilians).toBe(1);
    expect(g.points).toBe(-HUMAN_PENALTY);
    expect(HUMAN_PENALTY).toBe(50);
  });

  it('el tiro del francotirador impacta en el instante', () => {
    const g = newInvasion(8), alien = g.people.find(p => p.alien && p.room >= 0 && alienKind(p).hp === 1)!;
    const [x, y] = aimAt(g, alien);
    expect(shoot(g, x, y, 'rifle')).toBe('alien');
    expect(alien.dead?.alien).toBe(true);
  });

  it('la ametralladora destroza el departamento: con WALL_BREAK balas se derrumba', () => {
    const g = newInvasion(12);
    const room = g.rooms.find(o => o.floor > 0)!;
    g.people = g.people.filter(p => p.room !== room.id);
    const x = (room.x1 + room.x2) / 2, y = room.y + 0.4;
    for (let i = 0; i < WALL_BREAK - 1; i++) expect(shoot(g, x, y, 'machine')).toBe('miss');
    expect(room.destroyed).toBe(0);
    expect(g.decals.filter(d => d.room === room.id && d.crater).length).toBeGreaterThan(WALL_BREAK);
    shoot(g, x, y, 'machine');
    expect(room.destroyed).toBe(1);
    // El rifle solo deja un agujerito.
    const other = g.rooms.find(o => o.floor > 0 && o.id !== room.id && !o.destroyed)!;
    for (let i = 0; i < WALL_BREAK; i++) shoot(g, (other.x1 + other.x2) / 2, other.y + 0.4, 'rifle');
    expect(other.destroyed).toBe(0);
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

  it('los avisos por radio suenan una vez al pasar cada umbral', () => {
    const g = newInvasion(4);
    const said = () => takeEvents(g).filter(e => e.type === 'radio').map(e => (e as { say: string }).say);
    step(g, 0.05); takeEvents(g);
    // Al empezar los humanos ganan por mucho: no avisa nada.
    step(g, 0.05); expect(said()).toEqual([]);
    const humans = g.people.filter(p => !p.alien && !p.dead && !p.gone), aliens = g.people.filter(p => p.alien && !p.dead && !p.gone).length;
    // Quedan menos humanos que aliens: "más alienígenas".
    humans.slice(aliens - 1).forEach(p => { p.gone = true; });
    step(g, 0.05); expect(said()).toContain('aliensAhead');
    step(g, 0.05); expect(said()).not.toContain('aliensAhead'); // no se repite
    // Vuelven a ganar por 10, 20 y 30.
    const back = (n: number) => { let k = 0; for (const p of humans) if (p.gone && k < n) { p.gone = false; k++; } };
    const lead = () => g.people.filter(p => !p.alien && !p.dead && !p.gone).length - g.people.filter(p => p.alien && !p.dead && !p.gone).length;
    back(10 - lead()); step(g, 0.05); expect(said()).toContain('h10');
    back(20 - lead()); step(g, 0.05); expect(said()).toContain('h20');
    back(30 - lead()); step(g, 0.05); expect(said()).toContain('h30');
    // 6 bombas activas a la derecha.
    for (let i = 0; i < 6; i++) g.boxes.push({ id: 9000 + i, room: -1, x: g.width * 0.8, y: 0, explosive: true, t0: g.time, explodeAt: g.time + 99, defused: false, exploded: false, hit: false, kind: 0 });
    step(g, 0.05); const s1 = said(); expect(s1).toContain('bombsRight'); expect(s1).not.toContain('bombsLeft');
  });
});
