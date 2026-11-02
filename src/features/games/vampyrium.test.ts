import { describe, expect, it } from 'vitest';
import { DAMAGE, DOOR, FALL_DMG, GAPS, GOAL, GROUND_Y, LEVELS, LEVEL_COUNT, MAX_HP, STRENGTH, SURFACES, VAMP_KINDS, hitVamp, makeVamp, rosterOf, type VampKind, POWER_MAX, START_STAKES, TRAPS, castHoly, newGame, pressAttack, menuMove, step, takeEvents, trapState, type Game, type Input, type Vamp } from './vampyrium';

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
    expect([g.kills.walker, g.kills.flyer]).toEqual([0, 1]);
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

  it('al caer al vacío pierde 10 de vida y vuelve a un lugar firme', () => {
    const g = quiet(); const [a, b] = GAPS[0];
    g.player.x = a - 0.6;
    run(g, 0.6, { ...idle(), right: true });
    run(g, 1.5);
    expect(g.player.hp).toBe(MAX_HP - FALL_DMG);
    expect(g.stats.falls).toBe(1);
    expect(g.player.x).toBeLessThan(a);
    expect(g.player.x).not.toBeGreaterThan(b);
  });

  it('los vampiros no se caen al vacío: si caen en un hueco, saltan y salen', () => {
    const g = quiet(); const [a, b] = GAPS[0];
    const v = walker(g, (a + b) / 2, { onGround: false, y: 0, vy: -5 });
    run(g, 1.5);
    expect(g.vamps).toContain(v);
    expect(v.y).toBeGreaterThanOrEqual(GROUND_Y - 0.1);
    expect(g.total).toBe(0);
  });

  it('las trampas lastiman al cazador; a los vampiros les sacan sangre pero no los matan', () => {
    const g = quiet(); const spikes = TRAPS.find(t => t.kind === 'spikes')!;
    let tt = 0; while (trapState(spikes, tt).on < 1) tt += 0.02;
    g.time = tt - 0.05;
    const v = walker(g, (spikes.x + spikes.x2) / 2);
    run(g, 0.15);
    expect(g.vamps).toContain(v);
    expect(g.total).toBe(0);
    expect(g.drops.length).toBeGreaterThan(10);
    expect(takeEvents(g).some(e => e.type === 'vampHurt')).toBe(true);
    g.player.x = (spikes.x + spikes.x2) / 2; g.player.y = GROUND_Y; g.time = tt - 0.05; g.vamps = [];
    run(g, 0.15);
    expect(g.player.hp).toBeLessThan(MAX_HP);
  });

  it('el vampiro común que se acerca araña y saca 1 punto de vida', () => {
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
    expect(g.vamps.length + g.total + g.trapKills + g.voidKills).toBeGreaterThan(1);
  });

  it('sin vida: se termina el juego', () => {
    const g = quiet(); g.player.hp = 1; g.player.x = 5;
    walker(g, 5.6, { cool: 0, speed: 2.5 });
    run(g, 3);
    expect(g.phase).toBe('over');
  });
});

describe('Vampyrium: los 10 niveles', () => {
  it('hay 10 niveles, cada uno con su fondo, suelo a los dos lados y trampas distintas', () => {
    expect(LEVEL_COUNT).toBe(10);
    const kinds = new Set<string>();
    for (const def of LEVELS) {
      const g = newGame(5, def.n);
      expect(g.level).toBe(def.n);
      expect(def.bg).toBe(`fondo-nivel-${def.n}`);
      expect(SURFACES.some(s => s.ground && s.x1 <= 0.01)).toBe(true);
      expect(SURFACES.some(s => s.ground && s.x2 >= 27.9)).toBe(true);
      expect(TRAPS.length).toBeGreaterThanOrEqual(3);
      kinds.add(TRAPS.map(t => `${t.kind}:${t.style ?? ''}`).sort().join(','));
    }
    expect(kinds.size).toBe(10); // ningún nivel repite las mismas trampas
    newGame(1, 1);
  });

  it('las plataformas que se mueven llevan al cazador encima', () => {
    const def = LEVELS.find(l => l.surfaces.some(s => s.mv && s.mv.dx))!;
    const g = newGame(2, def.n); g.spawnT = 1e9; g.crateT = 1e9; g.player.inv = 1e9;
    const plat = SURFACES.find(s => s.mv && s.mv.dx)!;
    run(g, 0.05);
    g.player.x = (plat.x1 + plat.x2) / 2; g.player.y = plat.y; g.player.vy = 0;
    run(g, 0.1);
    const x0 = g.player.x, p0 = plat.x1;
    run(g, 0.5);
    expect(g.player.surface).toBe(plat);
    expect(Math.abs((g.player.x - x0) - (plat.x1 - p0))).toBeLessThan(0.05);
    newGame(1, 1);
  });

  it('cada clase de trampa lastima al cazador alguna vez', () => {
    for (const kind of ['saw', 'roller', 'crusher', 'jet', 'drip', 'fire', 'pendulum', 'spikes'] as const) {
      const def = LEVELS.find(l => l.traps.some(t => t.kind === kind))!;
      const g = newGame(4, def.n); g.spawnT = 1e9; g.crateT = 1e9;
      const tr = TRAPS.find(t => t.kind === kind)!;
      let hurt = false;
      for (let tt = 0; tt < 12 && !hurt; tt += 0.05) {
        const st = trapState(tr, tt);
        const hx = kind === 'jet' ? tr.x + Math.sign(tr.amp || 1) * 1.5 : kind === 'saw' || kind === 'roller' || kind === 'pendulum' ? (kind === 'pendulum' ? st.tipX : st.cx) : (tr.x + (tr.x2 || tr.x)) / 2;
        g.time = tt; g.player.hp = MAX_HP; g.player.inv = 0; g.player.x = hx; g.player.y = kind === 'pendulum' ? st.tipY - 0.8 : tr.y; g.player.vy = 0; g.player.onGround = false; g.player.surface = null;
        step(g, idle(), 1 / 60);
        hurt = g.player.hp < MAX_HP;
      }
      expect(hurt, kind).toBe(true);
    }
    newGame(1, 1);
  });
});

describe('Vampyrium: los vampiros de cada nivel y los puntos', () => {
  const ground = (g: Game, kind: VampKind, x: number, extra: Partial<Vamp> = {}) => { const v = makeVamp(g, kind, { x, y: GROUND_Y, onGround: true, surface: SURFACES.find(s => s.ground && s.x1 <= x && s.x2 >= x) ?? null, face: -1, cool: 9, speed: 0, ...extra }); g.vamps.push(v); return v; };
  const quietAt = (level: number) => { const g = newGame(7, level); g.spawnT = 1e9; g.crateT = 1e9; g.vamps = []; return g; };

  it('el cazador tiene 100 de vida', () => {
    expect(MAX_HP).toBe(100);
    expect(newGame(1).player.hp).toBe(100);
  });

  it('cada nivel suma un vampiro nuevo; del 7 al 9 como el 5; el 10 es solo Drácula', () => {
    expect(rosterOf(1)).toEqual(['walker', 'flyer']);
    expect(rosterOf(2)).toEqual(['walker', 'flyer', 'giant']);
    expect(rosterOf(3)).toEqual(['walker', 'flyer', 'giant', 'mage']);
    expect(rosterOf(4)).toEqual(['walker', 'flyer', 'giant', 'mage', 'hammer']);
    expect(rosterOf(5)).toEqual(['walker', 'flyer', 'giant', 'mage', 'hammer', 'warrior']);
    expect(rosterOf(6)).toEqual(['walker', 'flyer', 'giant', 'mage', 'hammer', 'warrior', 'wolf']);
    for (const n of [7, 8, 9]) expect(rosterOf(n)).toEqual(rosterOf(5));
    expect(rosterOf(10)).toEqual(['dracula']);
    newGame(1, 1);
  });

  it('en cada nivel salen solo los vampiros que le tocan', () => {
    for (const n of [1, 2, 4, 6, 8]) {
      const g = newGame(n * 13, n); g.crateT = 1e9; g.player.inv = 1e9;
      const seen = new Set<VampKind>();
      for (let i = 0; i < 200; i++) { g.spawnT = 0; run(g, 1 / 60); for (const v of [...g.vamps]) { seen.add(v.kind); g.vamps.splice(g.vamps.indexOf(v), 1); } }
      expect([...seen].every(k => rosterOf(n).includes(k)), `nivel ${n}`).toBe(true);
      expect(seen.size, `nivel ${n}`).toBe(rosterOf(n).length);
    }
    newGame(1, 1);
  });

  it('cada vampiro aguanta tantos golpes como veces es más fuerte (gigante 3, mago 4, martillo 5, guerrero 6, lobo 7)', () => {
    expect(STRENGTH).toMatchObject({ walker: 1, flyer: 1, giant: 3, mage: 4, hammer: 5, warrior: 6, wolf: 7, dracula: 50, dragon: 50 });
    for (const kind of ['walker', 'giant', 'mage', 'hammer', 'warrior', 'wolf'] as VampKind[]) {
      const g = quietAt(6); g.player.x = 4; g.player.face = 1; g.player.inv = 1e9;
      const v = ground(g, kind, 5.4);
      for (let i = 1; i <= STRENGTH[kind]; i++) {
        pressAttack(g); run(g, 0.35); v.x = 5.4; v.state = 'walk'; v.cool = 9;
        if (i < STRENGTH[kind]) { expect(g.vamps, `${kind} golpe ${i}`).toContain(v); expect(v.hp).toBe(STRENGTH[kind] - i); }
      }
      expect(g.vamps, kind).not.toContain(v);
      expect(g.kills[kind]).toBe(1);
      expect(g.total).toBe(1); // cada uno cuenta 1 para los 50
    }
    newGame(1, 1);
  });

  it('cada vampiro le saca al cazador tantos puntos como veces es más fuerte', () => {
    expect(DAMAGE).toMatchObject({ walker: 1, flyer: 1, giant: 3, mage: 4, hammer: 5, warrior: 6, wolf: 7 });
    for (const kind of ['walker', 'giant', 'hammer', 'warrior', 'wolf', 'mage'] as VampKind[]) {
      const g = quietAt(6); g.player.x = 6;
      ground(g, kind, 6.9, { cool: 0, face: -1 });
      if (kind === 'mage') g.vamps[0].x = 6.6;
      let lost = 0;
      for (let i = 0; i < 240 && !lost; i++) { step(g, idle(), 1 / 60); lost = MAX_HP - g.player.hp; }
      expect(lost, kind).toBe(DAMAGE[kind]);
    }
    newGame(1, 1);
  });

  it('el mago tira bolas de fuego que sacan 4 de vida (y la espada las corta)', () => {
    const g = quietAt(3); g.player.x = 4;
    const m = ground(g, 'mage', 10, { cool: 0 });
    let shot = false;
    for (let i = 0; i < 180 && !shot; i++) { step(g, idle(), 1 / 60); shot = g.shots.length > 0; m.x = 10; }
    expect(shot).toBe(true);
    expect(g.shots[0].dmg).toBe(4);
    run(g, 1.2);
    expect(g.player.hp).toBe(MAX_HP - 4);
    // la espada la corta
    const g2 = quietAt(3); g2.player.x = 4; g2.player.face = 1;
    g2.shots.push({ x: 5.2, y: g2.player.y + 1, vx: -0.1, vy: 0, t: 0, life: 3, kind: 'orb', dmg: 4 });
    pressAttack(g2); run(g2, 0.2);
    expect(g2.shots.length).toBe(0);
    expect(g2.player.hp).toBe(MAX_HP);
    newGame(1, 1);
  });

  it('el guerrero ataja con el escudo las estacas, salvo cuando está atacando', () => {
    const g = quietAt(5); g.weapon = 'stakes'; g.player.x = 3; g.player.face = 1;
    const w = ground(g, 'warrior', 8, { face: -1 });
    pressAttack(g); run(g, 0.5);
    expect(w.hp).toBe(STRENGTH.warrior);
    expect(takeEvents(g).some(e => e.type === 'block')).toBe(true);
    w.x = 8; w.state = 'claw'; w.t = 0; w.hit = true; g.player.cool = 0;
    pressAttack(g); run(g, 0.5);
    expect(w.hp).toBe(STRENGTH.warrior - 1);
    newGame(1, 1);
  });

  it('con 100 puntos perdidos se termina el juego', () => {
    const g = quietAt(4); g.player.x = 6;
    for (let i = 0; i < 400 && g.phase === 'play'; i++) { g.player.inv = 0; const v = ground(g, 'hammer', 6.8, { cool: 0 }); run(g, 1.3); g.vamps.splice(g.vamps.indexOf(v), 1); g.player.x = 6; g.player.y = GROUND_Y; g.player.vy = 0; }
    run(g, 2);
    expect(g.player.hp).toBe(0);
    expect(g.phase).toBe('over');
    newGame(1, 1);
  });

  it('nivel 10: solo Drácula; con 50 golpes se convierte en dragón y con 50 más se gana', () => {
    const g = newGame(9, 10); g.crateT = 1e9; g.player.inv = 1e9;
    expect(g.vamps.map(v => v.kind)).toEqual(['dracula']);
    run(g, 3);
    expect(g.vamps.every(v => v.kind === 'dracula' || v.kind === 'dragon')).toBe(true);
    const drac = g.vamps[0];
    for (let i = 0; i < 49; i++) hitVamp(g, drac, 1, 'sword', 0);
    expect(drac.hp).toBe(1);
    hitVamp(g, drac, 1, 'sword', 0);
    expect(g.vamps.length).toBe(0);
    expect(g.transformT).toBeGreaterThan(0);
    expect(takeEvents(g).some(e => e.type === 'transform')).toBe(true);
    run(g, 2.6);
    const dragon = g.vamps.find(v => v.kind === 'dragon')!;
    expect(dragon).toBeTruthy();
    expect(dragon.hp).toBe(50);
    for (let i = 0; i < 50; i++) hitVamp(g, dragon, 1, 'sword', 0);
    expect(g.vamps.length).toBe(0);
    run(g, 3.2);
    expect(['cleared', 'won']).toContain(g.phase);
    run(g, 3);
    expect(g.phase).toBe('won');
    newGame(1, 1);
  });

  it('el dragón escupe fuego que saca 15 de vida', () => {
    const g = newGame(9, 10); g.crateT = 1e9; g.vamps = [];
    g.vamps.push(makeVamp(g, 'dragon', { x: 10, y: GROUND_Y + 4, state: 'breath', t: 0, face: -1 }));
    g.player.x = 6;
    let lost = 0; for (let i = 0; i < 180 && !lost; i++) { step(g, idle(), 1 / 60); lost = MAX_HP - g.player.hp; }
    expect(lost).toBe(15);
    expect(VAMP_KINDS.length).toBe(9);
    newGame(1, 1);
  });
});
