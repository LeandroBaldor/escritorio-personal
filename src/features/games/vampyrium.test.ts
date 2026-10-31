import { describe, expect, it } from 'vitest';
import { DOOR, GAPS, GOAL, GROUND_Y, MAX_HP, POWER_MAX, START_STAKES, TRAPS, castHoly, newGame, pressAttack, menuMove, step, takeEvents, trapState, type Game, type Input, type Vamp } from './vampyrium';

const idle = (): Input => ({ left: false, right: false, up: false, down: false });
const run = (g: Game, seconds: number, input: Input = idle()) => { for (let t = 0; t < seconds; t += 1 / 60) step(g, input, 1 / 60); };
// Un juego sin vampiros que aparezcan solos ni cajas (para probar una cosa por vez).
const quiet = () => { const g = newGame(7); g.spawnT = 1e9; g.crateT = 1e9; return g; };
const walker = (g: Game, x: number, extra: Partial<Vamp> = {}): Vamp => {
  const v: Vamp = { id: g.nextId++, kind: 'walker', x, y: GROUND_Y, vx: 0, vy: 0, face: -1, state: 'walk', t: 0, onGround: true, surface: null, walkT: 0, cool: 5, speed: 0, jumpT: 9, dropT: 0, hit: false, ...extra };
  g.vamps.push(v); return v;
};
const killsOf = (g: Game) => takeEvents(g).filter(e => e.type === 'kill');

describe('Vampyrium', () => {
  it('el cazador camina con las flechas, salta y hace doble salto en el aire', () => {
    const g = quiet(), x0 = g.player.x;
    run(g, 0.5, { ...idle(), right: true });
    expect(g.player.x).toBeGreaterThan(x0 + 2);
    expect(g.player.face).toBe(1);
    step(g, { ...idle(), up: true }, 1 / 60);
    run(g, 0.2);
    const y1 = g.player.y;
    expect(y1).toBeGreaterThan(GROUND_Y + 1);
    step(g, { ...idle(), up: true }, 1 / 60); // segundo salto en el aire
    const jumps = takeEvents(g).filter(e => e.type === 'jump');
    expect(jumps.map(e => e.type === 'jump' && e.double)).toEqual([false, true]);
    run(g, 2);
    expect(g.player.onGround).toBe(true);
  });

  it('la espada mata al vampiro de adelante: se vuelve esqueleto, chispas y después vuelan los huesos', () => {
    const g = quiet(); g.player.x = 4; g.player.face = 1;
    walker(g, 5.3);
    pressAttack(g);
    run(g, 0.25);
    expect(g.vamps.length).toBe(0);
    expect(g.kills.walker).toBe(1);
    expect(g.total).toBe(1);
    expect(g.corpses.length).toBe(1); // el esqueleto
    run(g, 1.1);
    expect(g.corpses.length).toBe(0);
    expect(g.drops.length).toBeGreaterThan(60); // mucha sangre que salpica
    expect(g.bones.length).toBeGreaterThan(5); // los huesos volando
    expect(g.sparks.length).toBeGreaterThan(10);
    expect(takeEvents(g).some(e => e.type === 'bones')).toBe(true);
  });

  it('la espada no pega para atrás', () => {
    const g = quiet(); g.player.x = 6; g.player.face = 1;
    walker(g, 4.4);
    pressAttack(g); run(g, 0.3);
    expect(g.vamps.length).toBe(1);
  });

  it('manteniendo espacio 3 segundos aparece el cartel de armas y el juego queda en pausa; se elige con flechas y espacio', () => {
    const g = quiet();
    pressAttack(g); // el toque ataca
    expect(g.player.attackT).toBeGreaterThanOrEqual(0);
    run(g, 2.5, { ...idle(), attack: true });
    expect(g.phase).toBe('play');
    run(g, 0.6, { ...idle(), attack: true });
    expect(g.phase).toBe('menu');
    const t = g.time; run(g, 1, { ...idle(), attack: true });
    expect(g.time).toBe(t); // con el cartel abierto el juego espera
    expect(g.phase).toBe('menu'); // seguir apretando no lo cierra
    menuMove(g, 1); pressAttack(g);
    expect(g.phase).toBe('play');
    expect(g.weapon).toBe('stakes');
    run(g, 0.5);
    pressAttack(g);
    expect(g.ammo).toBe(START_STAKES - 1);
    expect(g.stakes.length).toBe(1);
  });

  it('soltar antes de los 3 segundos no abre el cartel', () => {
    const g = quiet();
    run(g, 2, { ...idle(), attack: true }); run(g, 0.1); run(g, 2, { ...idle(), attack: true });
    expect(g.phase).toBe('play');
  });

  it('la estaca vuela y mata a un vampiro lejos', () => {
    const g = quiet(); g.weapon = 'stakes'; g.player.x = 3; g.player.face = 1;
    walker(g, 7.5);
    pressAttack(g); run(g, 0.5);
    expect(g.kills.walker).toBe(1);
    expect(killsOf(g)[0]).toMatchObject({ how: 'stake' });
  });

  it('sin estacas vuelve a la espada', () => {
    const g = quiet(); g.weapon = 'stakes'; g.ammo = 0;
    pressAttack(g);
    expect(g.weapon).toBe('sword');
    expect(takeEvents(g).some(e => e.type === 'empty')).toBe(true);
  });

  it('cuenta por separado los vampiros y los voladores', () => {
    const g = quiet(); g.player.x = 4; g.player.face = 1;
    walker(g, 5.2);
    g.vamps.push({ ...walker(g, 99), kind: 'flyer', x: 5.2, y: GROUND_Y + 1.2, state: 'hover' });
    g.vamps.splice(0, 1);
    g.vamps.splice(g.vamps.findIndex(v => v.x === 99), 1);
    pressAttack(g); run(g, 0.3);
    expect(g.kills).toEqual({ walker: 0, flyer: 1 });
  });

  it('con 50 vampiros se abre la puerta de la derecha y al entrar pasa de nivel', () => {
    const g = quiet(); g.total = GOAL - 1; g.player.x = 4; g.player.face = 1;
    walker(g, 5.2);
    pressAttack(g); run(g, 0.3);
    expect(g.door.open).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'door')).toBe(true);
    g.player.x = DOOR.x1 - 1; g.player.y = GROUND_Y; g.player.surface = null; g.player.onGround = false;
    run(g, 2, { ...idle(), right: true });
    expect(['cleared', 'won']).toContain(g.phase);
    run(g, 3);
    expect(g.phase).toBe('won');
  });

  it('con la puerta cerrada no se puede pasar', () => {
    const g = quiet(); g.player.x = 25;
    run(g, 2, { ...idle(), right: true });
    expect(g.player.x).toBeLessThan(DOOR.x1);
    expect(g.phase).toBe('play');
  });

  it('al caer al vacío pierde un corazón y vuelve a un lugar firme', () => {
    const g = quiet(); const [a, b] = GAPS[0];
    g.player.x = a - 0.6;
    run(g, 0.6, { ...idle(), right: true });
    run(g, 1.5);
    expect(g.player.hp).toBe(MAX_HP - 1);
    expect(g.stats.falls).toBe(1);
    expect(g.player.x).toBeLessThan(a);
    expect(g.player.x).not.toBeGreaterThan(b);
  });

  it('un vampiro que se cae al vacío también cuenta', () => {
    const g = quiet(); const [a] = GAPS[0];
    const v = walker(g, a + 1.2, { onGround: false, y: 0 });
    v.y = -3; run(g, 0.1);
    expect(g.total).toBe(1);
    expect(g.voidKills).toBe(1);
  });

  it('las trampas lastiman al cazador y matan vampiros', () => {
    const g = quiet(); const spikes = TRAPS.find(t => t.kind === 'spikes')!;
    // Esperar a que salgan los pinches con un vampiro parado arriba.
    let tt = 0; while (trapState(spikes, tt).on < 1) tt += 0.02;
    g.time = tt - 0.05;
    walker(g, (spikes.x + spikes.x2) / 2);
    run(g, 0.15);
    expect(g.trapKills).toBe(1);
    g.player.x = (spikes.x + spikes.x2) / 2; g.player.y = GROUND_Y; g.time = tt - 0.05;
    run(g, 0.15);
    expect(g.player.hp).toBeLessThan(MAX_HP);
  });

  it('el vampiro que se acerca araña y saca un corazón', () => {
    const g = quiet(); g.player.x = 5;
    walker(g, 5.6, { cool: 0, speed: 2.5 });
    run(g, 1);
    expect(g.player.hp).toBe(MAX_HP - 1);
    expect(g.player.inv).toBeGreaterThan(0);
  });

  it('caen cajas del cielo: la de estacas suma estacas', () => {
    const g = quiet(); g.crates.push({ id: 99, kind: 'stakes', x: g.player.x, y: GROUND_Y + 3, vy: -2.6, landed: false, t: 0, surface: null });
    run(g, 2);
    expect(g.ammo).toBe(START_STAKES + 6);
    expect(takeEvents(g).some(e => e.type === 'pickup')).toBe(true);
  });

  it('el poder de la cruz se carga con 10 vampiros y revienta a todos los de la pantalla', () => {
    const g = quiet(); g.power = POWER_MAX - 1;
    expect(castHoly(g)).toBe(false);
    g.power = POWER_MAX;
    walker(g, 10); walker(g, 15); walker(g, 20);
    expect(castHoly(g)).toBe(true);
    expect(g.vamps.length).toBe(0);
    expect(g.total).toBe(3);
    expect(g.power).toBe(0);
  });

  it('los combos suman cuando se matan seguidos', () => {
    const g = quiet(); g.player.x = 4; g.player.face = 1;
    walker(g, 5.2); pressAttack(g); run(g, 0.4);
    walker(g, 5.2); pressAttack(g); run(g, 0.4);
    expect(g.combo.n).toBe(2);
    expect(takeEvents(g).some(e => e.type === 'combo')).toBe(true);
  });

  it('salen tantos vampiros voladores como caminantes', () => {
    const g = newGame(11); g.crateT = 1e9; g.player.inv = 1e9;
    for (let i = 0; i < 40; i++) { g.spawnT = 0; run(g, 1 / 60); for (const v of [...g.vamps]) { g.vamps.splice(g.vamps.indexOf(v), 1); g.kills[v.kind]++; } }
    expect(Math.abs(g.kills.walker - g.kills.flyer)).toBeLessThanOrEqual(1);
  });

  it('aparecen vampiros solos y de a más a medida que se matan', () => {
    const g = newGame(3); g.crateT = 1e9;
    run(g, 8);
    expect(g.vamps.length + g.total).toBeGreaterThan(1);
  });

  it('sin vida: se termina el juego', () => {
    const g = quiet(); g.player.hp = 1; g.player.x = 5;
    walker(g, 5.6, { cool: 0, speed: 2.5 });
    run(g, 3);
    expect(g.phase).toBe('over');
  });
});
