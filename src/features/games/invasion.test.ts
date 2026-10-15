import { describe, expect, it } from 'vitest';
import {
  aliensAt, aliveAliens, buildCity, GAME_SECONDS, hitbox, newInvasion, poseOf, REVEAL_EVERY, REVEAL_TIME, revealed, ruinAt, shoot, step, takeEvents, UFO_FROM, ufosAt,
  type Invasion, type Person,
} from './invasion';
import { ANOMALIES, fitsPlace, shuffledAnomalies } from './invasionAnomalies';

const run = (g: Invasion, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) step(g, 0.05); };
// Le apunta al medio del cuerpo (o a la cabeza) de una persona.
const aimAt = (g: Invasion, p: Person, head = false) => { const b = hitbox(g, p); return head ? [b.headX, b.headY] as const : [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2] as const; };

describe('Invasión: la ciudad', () => {
  const city = buildCity();
  it('tiene muchos edificios distintos: de ladrillo, antiguos, vidriados, oficinas, hotel y obras en construcción', () => {
    expect(city.buildings.length).toBeGreaterThanOrEqual(14);
    expect(new Set(city.buildings.map(b => b.style))).toEqual(new Set(['brick', 'stucco', 'glass', 'office', 'construction', 'old', 'hotel']));
    for (let i = 1; i < city.buildings.length; i++) expect(city.buildings[i].style).not.toBe(city.buildings[i - 1].style);
    expect(new Set(city.buildings.map(b => b.floors)).size).toBeGreaterThan(5);
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

  it('cada alien se ve como alien 1 segundo cada 30, cada uno con su propio ritmo', () => {
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

  it('con el tiempo hay más aliens, a los 5 minutos llegan los ovnis y a los 10 la ciudad queda destruida', () => {
    expect(aliensAt(0)).toBe(5);
    expect(aliensAt(400)).toBeGreaterThan(12);
    expect(ufosAt(UFO_FROM - 1)).toBe(0);
    expect(ufosAt(UFO_FROM + 1)).toBe(1);
    expect(ufosAt(GAME_SECONDS - 1)).toBeGreaterThan(3);
    expect(ruinAt(GAME_SECONDS)).toBe(1);
    const g = newInvasion(7);
    run(g, 320);
    expect(g.ufos.length).toBe(1);
    expect(aliveAliens(g)).toBeGreaterThanOrEqual(aliensAt(320) - 1);
    run(g, 200);
    const ruined = g.rooms.filter(r => r.destroyed).length / g.rooms.length;
    expect(ruined).toBeGreaterThan(ruinAt(520) * 0.6);
    run(g, 90);
    expect(g.over).toBe(true);
    expect(g.rooms.every(r => r.destroyed)).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'end')).toBe(true);
  }, 30000);
});

describe('Invasión: el disparo', () => {
  it('matar a un alien suma uno (a la cabeza cuenta como tiro a la cabeza)', () => {
    const g = newInvasion(8), alien = g.people.find(p => p.alien && p.room >= 0)!;
    const [x, y] = aimAt(g, alien, true);
    expect(shoot(g, x, y)).toBe('alien');
    expect(g.kills).toBe(1);
    expect(g.headshots).toBe(1);
    expect(alien.dead?.alien).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'kill')).toBe(true);
  });

  it('matar a una persona resta uno y asusta a los que están cerca', () => {
    const g = newInvasion(9);
    const alien = g.people.find(p => p.alien && p.room < 0)!;
    shoot(g, ...aimAt(g, alien));
    const human = g.people.find(p => !p.alien && p.room >= 0 && g.people.some(o => o !== p && o.room === p.room && !o.alien))!;
    expect(shoot(g, ...aimAt(g, human))).toBe('civilian');
    expect(g.kills).toBe(0);
    expect(g.civilians).toBe(1);
    expect(g.people.filter(o => o.room === human.room && o !== human && !o.alien).every(o => o.panic > 0)).toBe(true);
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

  it('la caja con explosivos que nadie desactiva explota y prende fuego', () => {
    const g = newInvasion(13);
    const room = g.rooms.find(r => r.floor === 2)!;
    g.boxes.push({ id: 1, room: room.id, x: (room.x1 + room.x2) / 2, y: room.y, explosive: true, t0: 0, explodeAt: 1, defused: false, exploded: false, hit: false, kind: 0 });
    run(g, 1.5);
    expect(room.fire).toBeGreaterThan(0);
    expect(takeEvents(g).some(e => e.type === 'explosion')).toBe(true);
  });

  it('la pose cambia el lugar donde está la cabeza (sentado, acostado)', () => {
    const g = newInvasion(14);
    const sitting = g.people.find(p => poseOf(g, p).kind === 'sit')!;
    const b = hitbox(g, sitting);
    expect(b.y2 - b.y1).toBeLessThan(sitting.look.size * 0.8);
  });
});
