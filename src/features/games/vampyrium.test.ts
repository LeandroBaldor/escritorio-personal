import { describe, expect, it } from 'vitest';
import { GUARD_HP, FREEZE_T, HOLY_TARGETS, DAMAGE, DOOR, FALL_DMG, GAPS, GOAL, GROUND_Y, LEVELS, LEVEL_COUNT, MAX_HP, STRENGTH, SURFACES, VAMP_KINDS, hitVamp, makeVamp, rosterOf, type VampKind, POWER_MAX, START_AMMO, WEAPON_DMG, WEAPON_LEVEL, WEAPONS, GARLIC_R, PISTOL_RANGE, MAX_AMMO, TRAPS, castHoly, chooseWeapon, type Weapon, newGame, pressAttack, menuMove, step, takeEvents, trapState, type Game, type Input, type Vamp, CHAPTERS, hitObject, noteTap } from './vampyrium';

const idle = (): Input => ({ left: false, right: false, up: false, down: false });
const run = (g: Game, seconds: number, input: Input = idle()) => { for (let t = 0; t < seconds; t += 1 / 60) step(g, input, 1 / 60); };
// Un juego sin vampiros que aparezcan solos ni cajas (para probar una cosa por vez).
const quiet = () => { const g = newGame(7); g.spawnT = 1e9; g.crateT = 1e9; g.level = 6; return g; }; // (nivel 1, con todas las armas)
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
    expect(g.weapon).toBe('crossbow');
    run(g, 0.5);
    pressAttack(g);
    expect(g.ammo.crossbow).toBe(START_AMMO.crossbow - 1);
    expect(g.bolts.length).toBe(1);
  });

  it('soltar antes de los 3 segundos no abre el cartel', () => {
    const g = quiet();
    run(g, 2, { ...idle(), attack: true }); run(g, 0.1); run(g, 2, { ...idle(), attack: true });
    expect(g.phase).toBe('play');
  });

  it('la flecha de la ballesta vuela lejos y atraviesa hasta 3 vampiros', () => {
    const g = quiet(); g.weapon = 'crossbow'; g.player.x = 3; g.player.face = 1;
    for (const x of [7, 9, 11, 13]) walker(g, x);
    pressAttack(g); run(g, 0.8);
    expect(g.kills.walker).toBe(3);
    expect(g.vamps.length).toBe(1); // el cuarto se salva
    expect(killsOf(g)[0]).toMatchObject({ how: 'bolt' });
  });

  it('sin munición vuelve a la espada', () => {
    const g = quiet(); g.weapon = 'crossbow'; g.ammo.crossbow = 0;
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

  it('caen cajas del cielo: la de flechas suma 8 flechas', () => {
    const g = quiet(); g.crates.push({ id: 99, kind: 'bolts', x: g.player.x, y: GROUND_Y + 3, vy: -2.6, landed: false, t: 0, surface: null });
    run(g, 2);
    expect(g.ammo.crossbow).toBe(START_AMMO.crossbow + 8);
    expect(takeEvents(g).some(e => e.type === 'pickup')).toBe(true);
  });

  it('la cruz: con 10 vampiros se carga una, y la tormenta de rayos revienta a los 6 más cercanos', () => {
    const g = quiet(); g.ammo.cross = 0;
    expect(castHoly(g)).toBe(false);
    g.power = POWER_MAX - 1; g.player.x = 4; g.player.face = 1;
    walker(g, 5.2); pressAttack(g); run(g, 0.4);
    expect(g.ammo.cross).toBe(1);
    expect(g.power).toBe(0);
    for (const x of [6, 9, 12, 15, 18, 21, 24]) walker(g, x, { cool: 9, speed: 0 });
    g.player.cool = 0;
    expect(castHoly(g)).toBe(true);
    expect(g.vamps.length).toBe(1); // el más lejano se salva
    expect(g.ammo.cross).toBe(0);
    expect(g.fx.filter(f => f.kind === 'bolt').length).toBeGreaterThanOrEqual(6);
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

  it('cada vampiro aguanta el doble de golpes que veces es más fuerte (gigante 6, mago 8, martillo 10, guerrero 12, lobo 14)', () => {
    expect(STRENGTH).toMatchObject({ walker: 2, flyer: 2, giant: 6, mage: 8, hammer: 10, warrior: 12, wolf: 14, dracula: 100, dragon: 100 });
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

  it('el guerrero ataja con el escudo las flechas, salvo cuando está atacando', () => {
    const g = quietAt(5); g.weapon = 'crossbow'; g.player.x = 3; g.player.face = 1;
    const w = ground(g, 'warrior', 8, { face: -1 });
    pressAttack(g); run(g, 0.5);
    expect(w.hp).toBe(STRENGTH.warrior);
    expect(takeEvents(g).some(e => e.type === 'block')).toBe(true);
    w.x = 8; w.state = 'claw'; w.t = 0; w.hit = true; g.player.cool = 0;
    pressAttack(g); run(g, 0.5);
    expect(w.hp).toBe(STRENGTH.warrior - WEAPON_DMG.crossbow);
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

  it('nivel 10: solo Drácula; con 100 golpes se convierte en dragón y con 100 más se gana', () => {
    const g = newGame(9, 10); g.crateT = 1e9; g.player.inv = 1e9;
    expect(g.vamps.map(v => v.kind)).toEqual(['dracula']);
    run(g, 3);
    expect(g.vamps.every(v => v.kind === 'dracula' || v.kind === 'dragon')).toBe(true);
    const drac = g.vamps[0];
    for (let i = 0; i < 99; i++) hitVamp(g, drac, 1, 'sword', 0);
    expect(drac.hp).toBe(1);
    hitVamp(g, drac, 1, 'sword', 0);
    expect(g.vamps.length).toBe(0);
    expect(g.transformT).toBeGreaterThan(0);
    expect(takeEvents(g).some(e => e.type === 'transform')).toBe(true);
    run(g, 2.6);
    const dragon = g.vamps.find(v => v.kind === 'dragon')!;
    expect(dragon).toBeTruthy();
    expect(dragon.hp).toBe(100);
    for (let i = 0; i < 100; i++) hitVamp(g, dragon, 1, 'sword', 0);
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

describe('Vampyrium: las armas', () => {
  const quiet10 = (level = 6) => { const g = newGame(7, level); g.spawnT = 1e9; g.crateT = 1e9; g.vamps = []; g.objects = []; g.player.inv = 1e9; return g; };
  const put = (g: Game, kind: VampKind, x: number) => { const v = makeVamp(g, kind, { x, y: GROUND_Y, onGround: true, surface: SURFACES.find(s => s.ground && s.x1 <= x && s.x2 >= x) ?? null, face: -1, cool: 9, speed: 0 }); g.vamps.push(v); return v; };
  const use = (g: Game, w: Weapon, secs = 0.6) => { chooseWeapon(g, w); g.player.cool = 0; pressAttack(g); run(g, secs); };

  it('cuánto le saca cada arma: espada 1, ballesta 3, ajo 5, cruz 10, espada de fuego 20, pistola 20', () => {
    expect(WEAPON_DMG).toMatchObject({ sword: 1, crossbow: 3, garlic: 5, cross: 10, firesword: 20, pistol: 20, violet: 5, bone: 10 });
    for (const w of ['sword', 'crossbow', 'garlic', 'firesword', 'pistol'] as Weapon[]) {
      const g = quiet10(); g.player.x = 3; g.player.face = 1;
      const v = put(g, 'dracula', 5); v.special = 1e9; v.hp = 50; // Drácula aguanta 50: así se ve el daño de un golpe
      use(g, w, 1.2);
      expect(50 - (v.hp ?? 0), w).toBe(WEAPON_DMG[w]);
    }
    newGame(1, 1);
  });

  it('la bomba de ajo: la onda le saca 5 a todos los que están a 3 metros, no a los de más lejos', () => {
    const g = quiet10(); g.player.x = 3; g.player.face = 1;
    const near = [put(g, 'hammer', 7), put(g, 'hammer', 8.5), put(g, 'hammer', 10)], far = put(g, 'hammer', 15);
    g.bombs.push({ x: 8.5, y: GROUND_Y + 0.05, vx: 0, vy: 0, t: 0, landed: 0, a: 0 });
    run(g, 0.6);
    for (const v of near) expect(v.hp).toBe(5); // martillo: 10 de vida → la onda le saca 5
    expect(far.hp).toBe(10);
    expect(GARLIC_R).toBe(3);
    newGame(1, 1);
  });

  it('la espada de fuego: la ola es 5 veces más grande que el tajo común', () => {
    const g = quiet10(); g.player.x = 3; g.player.face = 1;
    const a = put(g, 'giant', 5), b = put(g, 'giant', 8.8);
    use(g, 'sword', 0.4);
    expect(a.hp).toBe(5); expect(b.hp).toBe(6); // la común no llega al de lejos
    use(g, 'firesword', 0.4);
    expect(g.vamps).not.toContain(a); expect(g.vamps).not.toContain(b);
    newGame(1, 1);
  });

  it('la pistola de fuego: le pega al primero que toca, hasta 10 metros', () => {
    const g = quiet10(); g.player.x = 3; g.player.face = 1;
    const a = put(g, 'wolf', 12), b = put(g, 'wolf', 13.5);
    use(g, 'pistol', 1);
    expect(g.vamps).not.toContain(a); expect(g.vamps).toContain(b);
    const g2 = quiet10(); g2.player.x = 3; g2.player.face = 1;
    const c = put(g2, 'wolf', 3 + PISTOL_RANGE + 2);
    use(g2, 'pistol', 1);
    expect(c.hp).toBe(14); // más lejos de 10 metros no llega
    newGame(1, 1);
  });

  it('cada arma gasta su munición y se recarga con las cajas', () => {
    const g = quiet10(); g.player.x = 3;
    use(g, 'garlic', 0.1); use(g, 'pistol', 0.1); use(g, 'firesword', 0.1);
    expect(g.ammo.garlic).toBe(START_AMMO.garlic - 1);
    expect(g.ammo.pistol).toBe(START_AMMO.pistol - 1);
    expect(g.ammo.firesword).toBe(START_AMMO.firesword - 1);
    g.crates.push({ id: 99, kind: 'bullets', x: g.player.x, y: GROUND_Y + 2, vy: -2.6, landed: false, t: 0, surface: null });
    g.crates.push({ id: 98, kind: 'fire', x: g.player.x, y: GROUND_Y + 2.2, vy: -2.6, landed: false, t: 0, surface: null });
    run(g, 2);
    expect(g.ammo.pistol).toBe(Math.min(MAX_AMMO.pistol, START_AMMO.pistol - 1 + 4));
    expect(g.ammo.firesword).toBe(START_AMMO.firesword - 1 + 3);
    newGame(1, 1);
  });
});

describe('Vampyrium: las armas aparecen nivel a nivel', () => {
  it('ballesta en el 2, ajo en el 3, cruz en el 4, espada de fuego en el 5 y pistola en el 6', () => {
    expect(WEAPON_LEVEL).toEqual({ sword: 1, crossbow: 2, garlic: 3, cross: 4, firesword: 5, pistol: 6, ice: 5, holy: 6, venom: 7, violet: 8, guard: 9, bone: 10 });
    for (let n = 1; n <= 10; n++) {
      const g = newGame(3, n);
      for (const w of WEAPONS.filter(q => q !== 'guard')) { // (la protectora no se agarra: se pone encima)
        chooseWeapon(g, w);
        expect(g.weapon === w, `nivel ${n} ${w}`).toBe(n >= WEAPON_LEVEL[w]);
        chooseWeapon(g, 'sword');
      }
    }
    newGame(1, 1);
  });

  it('en el nivel 1 solo está la espada: el cartel salta las bloqueadas, la cruz no se carga y no caen cajas de armas', () => {
    const g = newGame(3, 1); g.spawnT = 1e9;
    g.phase = 'menu'; g.menu.sel = 0; menuMove(g, 1);
    expect(g.menu.sel).toBe(0);
    g.phase = 'play'; g.power = POWER_MAX - 1;
    expect(castHoly(g)).toBe(false);
    for (let i = 0; i < 60; i++) { g.crateT = 0; run(g, 1 / 60); }
    expect(g.crates.every(c => c.kind === 'heart' || c.kind === 'garlic')).toBe(true);
    const g3 = newGame(3, 3); g3.phase = 'menu'; g3.menu.sel = 2; menuMove(g3, 1);
    expect(g3.menu.sel).toBe(0); // del ajo vuelve a la espada (la cruz todavía no)
    newGame(1, 1);
  });
});

describe('Vampyrium: los vampiros se mueven con inteligencia', () => {
  const chase = (level: number, px: number, py: number, kind: VampKind, fromX: number, secs = 15) => {
    const g = newGame(5, level); g.spawnT = 1e9; g.crateT = 1e9; g.player.inv = 1e9; g.player.hp = 1e9;
    g.player.x = px; g.player.y = py + 0.3; g.player.onGround = false; g.player.surface = null;
    run(g, 0.5);
    const s = SURFACES.find(q => q.ground && q.x1 <= Math.max(0, Math.min(28, fromX)) && q.x2 >= Math.max(0, Math.min(28, fromX)))!;
    const v = makeVamp(g, kind, { x: fromX, y: GROUND_Y, onGround: true, surface: s, face: fromX < 14 ? 1 : -1, speed: 2.8, cool: 99 });
    g.vamps.push(v); takeEvents(g);
    let t = 0, hurts = 0;
    for (; t < secs; t += 1 / 60) { g.player.inv = 1e9; step(g, idle(), 1 / 60); hurts += takeEvents(g).filter(e => e.type === 'vampHurt').length; if (Math.abs(v.x - g.player.x) < 1.6 && Math.abs(v.y - g.player.y) < 1.2) break; }
    newGame(1, 1);
    return { reached: t < secs, t, hurts };
  };

  it('entra por la derecha, cruza los huecos y sube de plataforma en plataforma hasta el cazador', () => {
    expect(chase(1, 4.1, 6.6, 'walker', 28.6).reached).toBe(true); // plataforma baja del otro lado del hueco
    expect(chase(1, 8.7, 9.9, 'walker', -0.6).reached).toBe(true); // plataforma alta
    expect(chase(4, 3.8, 6.6, 'giant', 28.6).reached).toBe(true); // el gigante también
  });

  it('esquiva las trampas: casi nunca lo lastiman en el camino', () => {
    let hurts = 0, reached = 0;
    for (const [lv, px, py] of [[3, 3.3, 3.2], [3, 11.4, 6.6], [5, 4.6, 3.2], [7, 3.8, 3.2], [9, 5, 3.2]] as const) for (const from of [-0.6, 28.6]) { const r = chase(lv, px, py, 'walker', from); hurts += r.hurts; if (r.reached) reached++; }
    expect(reached).toBeGreaterThanOrEqual(8);
    expect(hurts).toBeLessThanOrEqual(10);
  });
});

describe('Vampyrium: apuntar arriba y abajo', () => {
  it('con ↑ o ↓ + Espacio la ballesta y la pistola disparan en diagonal (y no salta ni baja)', () => {
    const g = newGame(2, 6); g.spawnT = 1e9; g.crateT = 1e9; g.player.x = 4; g.player.face = 1;
    chooseWeapon(g, 'crossbow');
    step(g, { ...idle(), attack: true }, 1 / 60); // Espacio apretado...
    step(g, { ...idle(), attack: true, up: true }, 1 / 60); // ...y ↑: dispara para arriba sin saltar
    expect(g.bolts.length).toBe(1);
    expect(g.bolts[0].vy).toBeGreaterThan(10);
    expect(g.player.onGround).toBe(true);
    g.player.cool = 0; chooseWeapon(g, 'pistol');
    step(g, { ...idle(), attack: true, down: true }, 1 / 60); pressAttack(g);
    expect(g.bullets.at(-1)!.vy).toBeLessThan(-10);
    g.player.cool = 0; step(g, idle(), 1 / 60); pressAttack(g);
    expect(g.bullets.at(-1)!.vy).toBe(0); // sin flechas: derecho
    newGame(1, 1);
  });
});

describe('Vampyrium: cada nivel tiene su meta (el viaje del héroe)', () => {
  const fresh = (n: number) => { const g = newGame(4, n); g.spawnT = 1e9; g.crateT = 1e9; g.player.inv = 1e9; g.player.hp = 1e9; return g; };
  it('las metas: 50 vampiros, 20 estrellas, 6 jaulas, 100 s, 8 guerreros, 6 ataúdes, 15 almas, 20 voladores, 120 s y Drácula', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => { const g = CHAPTERS[n].goal; return `${g.type}:${g.n}`; }))
      .toEqual(['kill:50', 'collect:20', 'break:6', 'survive:100', 'hunt:8', 'break:6', 'collect:15', 'hunt:20', 'survive:120', 'boss:1']);
    for (let n = 1; n <= 10; n++) expect(CHAPTERS[n].story.length).toBeGreaterThan(80);
    newGame(1, 1);
  });

  it('nivel 2: caen estrellas doradas; con 20 se abre la puerta', () => {
    const g = fresh(2);
    run(g, 4);
    expect(g.items.length).toBeGreaterThan(0);
    expect(g.items.every(i => i.kind === 'star')).toBe(true);
    let guard = 0;
    while (!g.door.open && guard++ < 3000) { const it = g.items.find(i => i.landed); if (it) { g.player.x = it.x; g.player.y = it.y; g.player.vy = 0; } run(g, 0.2); }
    expect(g.progress).toBeGreaterThanOrEqual(20);
    expect(g.door.open).toBe(true);
    newGame(1, 1);
  });

  it('nivel 3: hay 6 jaulas; se rompen a golpes y al romper las 6 se abre la puerta', () => {
    const g = fresh(3);
    expect(g.objects.length).toBe(6);
    expect(g.objects.every(o => o.kind === 'cage')).toBe(true);
    for (const o of [...g.objects]) for (let i = 0; i < 10 && g.objects.includes(o); i++) hitObject(g, o, 1);
    run(g, 0.1);
    expect(g.progress).toBe(6);
    expect(g.door.open).toBe(true);
    newGame(1, 1);
  });

  it('nivel 6: de cada ataúd que se rompe sale un vampiro', () => {
    const g = fresh(6); g.vamps = [];
    const o = g.objects[0]; expect(o.kind).toBe('coffin');
    hitObject(g, o, 50);
    expect(g.vamps.length).toBe(1);
    newGame(1, 1);
  });

  it('nivel 4: aguantando 100 segundos se abre la puerta (y no antes)', () => {
    const g = fresh(4);
    run(g, 60); expect(g.door.open).toBe(false);
    run(g, 41); expect(g.door.open).toBe(true);
    newGame(1, 1);
  });

  it('nivel 5: cuentan los guerreros, no los demás', () => {
    const g = fresh(5); g.total = 49;
    run(g, 0.1); expect(g.door.open).toBe(false);
    g.kills.warrior = 8; run(g, 0.1); expect(g.door.open).toBe(true);
    newGame(1, 1);
  });
});

describe('Vampyrium: los ataques especiales de Demian', () => {
  const put = (g: Game, kind: VampKind, x: number) => { const v = makeVamp(g, kind, { x, y: GROUND_Y, onGround: true, surface: SURFACES.find(s => s.ground && s.x1 <= x && s.x2 >= x) ?? null, face: -1, cool: 9, speed: 0 }); g.vamps.push(v); return v; };
  const specials = (g: Game) => takeEvents(g).filter(e => e.type === 'special').map(e => (e as { kind: string }).kind);
  it('adelante, adelante + Espacio: la estocada atraviesa al vampiro', () => {
    const g = quiet(); const p = g.player; p.face = 1; const x0 = p.x;
    const v = put(g, 'giant', x0 + 3);
    noteTap(g, 1); g.real += 0.1; noteTap(g, 1); pressAttack(g);
    expect(specials(g)).toEqual(['dash']);
    run(g, 0.3);
    expect(p.x).toBeGreaterThan(x0 + 4); // pasó para el otro lado
    expect(v.hp ?? 0).toBeLessThan(STRENGTH.giant);
  });
  it('adelante, atrás + Espacio: el torbellino corta a los dos lados', () => {
    const g = quiet(); const p = g.player; p.face = 1;
    const a = walker(g, p.x + 1.6), b = walker(g, p.x - 1.6);
    noteTap(g, 1); g.real += 0.1; noteTap(g, -1); pressAttack(g);
    expect(specials(g)).toEqual(['whirl']);
    run(g, 0.5);
    expect(g.vamps.includes(a) || g.vamps.includes(b)).toBe(false);
  });
  it('atrás, atrás + Espacio: la espada va hacia adelante y vuelve', () => {
    const g = quiet(); const p = g.player; p.face = 1;
    const v = walker(g, p.x + 6);
    noteTap(g, -1); g.real += 0.1; noteTap(g, -1); pressAttack(g);
    expect(specials(g)).toEqual(['throw']);
    expect(g.boomer?.vx).toBeGreaterThan(0); // hacia donde miraba antes
    run(g, 2.5);
    expect(g.vamps.includes(v)).toBe(false);
    expect(g.boomer).toBeNull(); // volvió a la mano
  });
  it('doble salto + Espacio: el giro en el aire (una vez por salto)', () => {
    const g = quiet(); const p = g.player;
    const jump = { ...idle(), up: true };
    step(g, jump, 1 / 60); run(g, 0.15); step(g, jump, 1 / 60); run(g, 0.05);
    expect(p.jumps).toBe(2);
    pressAttack(g); expect(specials(g)).toEqual(['spin']);
    run(g, 0.5); pressAttack(g); expect(specials(g)).toEqual([]);
  });
  it('sin combinación, Espacio es el tajo de siempre', () => {
    const g = quiet(); pressAttack(g);
    expect(takeEvents(g).map(e => e.type)).toContain('slash');
  });
});

describe('Vampyrium: las armaduras (desde el nivel 5)', () => {
  const at = () => { const g = newGame(7, 4); g.level = 10; g.spawnT = 1e9; g.crateT = 1e9; g.vamps = []; g.objects = []; g.player.inv = 1e9; g.player.x = 5; return g; };
  const put = (g: Game, kind: VampKind, x: number) => { const v = makeVamp(g, kind, { x, y: GROUND_Y, onGround: true, surface: SURFACES.find(s => s.ground && s.x1 <= x && s.x2 >= x) ?? null, face: -1, cool: 9, speed: 0 }); g.vamps.push(v); return v; };
  it('aparece una armadura nueva en cada nivel del 5 al 10', () => {
    const g = newGame(1, 5);
    chooseWeapon(g, 'ice'); expect(g.weapon).toBe('ice');
    chooseWeapon(g, 'holy'); expect(g.weapon).toBe('ice'); // la dorada recién en el 6
  });
  it('hielo: congela al vampiro y después se hace pedazos', () => {
    const g = at(); chooseWeapon(g, 'ice'); const v = put(g, 'giant', 8);
    pressAttack(g); run(g, 0.3);
    expect(v.frozen).toBeGreaterThan(0); expect(g.vamps).toContain(v);
    run(g, FREEZE_T + 0.3);
    expect(g.vamps).not.toContain(v); expect(g.total).toBe(1); expect(g.shards.length).toBeGreaterThan(0);
  });
  it('dorada: el rayo mata a varios vampiros en fila', () => {
    const g = at(); chooseWeapon(g, 'holy'); for (let i = 0; i < 8; i++) put(g, 'walker', 6.5 + i * 0.9);
    pressAttack(g); run(g, 0.2);
    expect(g.total).toBe(HOLY_TARGETS);
  });
  it('verde: la bola derrite al vampiro (en un charco)', () => {
    const g = at(); chooseWeapon(g, 'venom'); const v = put(g, 'giant', 7.5);
    pressAttack(g); run(g, 0.6);
    expect(g.vamps).not.toContain(v); expect(g.corpses.some(c => c.how === 'venom')).toBe(true);
  });
  it('violeta: saca 5 por tajo y explota en violeta', () => {
    const g = at(); chooseWeapon(g, 'violet'); const v = put(g, 'giant', 6.5);
    pressAttack(g); run(g, 0.3);
    expect(v.hp).toBe(1); expect(g.fx.some(f => f.kind === 'nova')).toBe(true);
  });
  it('huesos: el martillo saca 10 y dura 10 golpes', () => {
    const g = at(); chooseWeapon(g, 'bone'); const v = put(g, 'wolf', 6.5);
    pressAttack(g); run(g, 0.3);
    expect(v.hp).toBe(4);
    for (let i = 0; i < 9; i++) { g.vamps = []; run(g, 0.7); pressAttack(g); }
    expect(g.ammo.bone).toBe(0); expect(g.weapon).toBe('sword');
  });
  it('protectora: aguanta 50 de ataques de vampiros y no cambia el arma', () => {
    const g = at(); chooseWeapon(g, 'pistol'); chooseWeapon(g, 'guard');
    expect(g.weapon).toBe('pistol'); expect(g.guardHp).toBe(GUARD_HP);
    g.player.inv = 0; const v = put(g, 'wolf', 5.6); v.cool = 0; v.face = -1;
    let hp = g.player.hp;
    for (let i = 0; i < 600 && g.guardHp > 0; i++) { g.player.inv = 0; run(g, 1 / 60); hp = g.player.hp; if (g.guardHp > 0) expect(hp).toBe(100); }
    void hp; expect(g.guardHp).toBeLessThan(GUARD_HP);
  });
});
