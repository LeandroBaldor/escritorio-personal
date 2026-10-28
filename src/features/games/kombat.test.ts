import { describe, expect, it } from 'vitest';
import { BALL_R, CHARS, CHAR_IDS, SIZE, heightOf, GOAL_DEPTH, HALF_TIME, POWER_MAX, STAGES, STAMINA, TUBE_Y, W, attackDir, defendsLeft, fatalKeys, fatalPath, goalHeight, netTop, newMatch, teamAt, noInput, seeded, step, supportAt, takeEvents, type Input, type Match } from './kombat';

const idle = (): [Input, Input] => [noInput(), noInput()];
function play(m: Match, seconds: number, inputs: (m: Match) => [Input, Input] = idle) {
  for (let t = 0; t < seconds; t += 1 / 60) { step(m, inputs(m), 1 / 60); if (m.phase === 'end') break; }
}
// Hasta que arranca y la pelota terminó de bajar por el tubo.
const toPlay = (m: Match) => { play(m, 3.4); expect(m.phase).toBe('play'); expect(m.ball.alive).toBe(true); };
function keys(seq: (keyof Input)[]) {
  let k = 0;
  return (): [Input, Input] => { const i = noInput(); const n = k++; if (n % 2 === 0 && n / 2 < seq.length) (i[seq[n / 2]] as boolean) = true; return [i, noInput()]; };
}

describe('Kombat Football', () => {
  it('hay 16 luchadores, cada uno con su habilidad, y 16 escenarios', () => {
    expect(CHAR_IDS).toHaveLength(16);
    expect(new Set(CHAR_IDS.map(c => CHARS[c].ability)).size).toBe(16);
    expect(STAGES).toHaveLength(16);
  });

  it('los más grandes son BRUTO, BRUTO ROJO y MAGMA y los más petizos CYBER, THUNDER y COMETA', () => {
    const order = [...CHAR_IDS].sort((a, b) => SIZE[b] - SIZE[a]);
    expect(new Set(order.slice(0, 3))).toEqual(new Set(['bruto', 'brutoRed', 'magma']));
    expect(new Set(order.slice(-3))).toEqual(new Set(['cyber', 'thunder', 'cometa']));
    expect(heightOf({ char: 'bruto' })).toBeGreaterThan(heightOf({ char: 'cometa' }) * 1.8);
  });

  it('la pelota baja por el tubo del medio al empezar', () => {
    const m = newMatch('industrial', ['cometa', 'inferno'], [null, null], seeded(1));
    play(m, 3.1);
    expect(m.ball.alive).toBe(true);
    expect(m.ball.x).toBeCloseTo(W / 2, 0);
    expect(m.ball.y).toBeLessThan(TUBE_Y);
  });

  it('dos tiempos de 1:30: en el entretiempo los equipos cambian de lado', () => {
    const m = newMatch('industrial', ['cometa', 'inferno'], [null, null], seeded(1));
    toPlay(m);
    expect(defendsLeft(m, 0)).toBe(true);
    m.clock = 0.05; play(m, 0.2);
    expect(m.phase).toBe('halftime');
    play(m, 6);
    expect(m.half).toBe(2);
    expect(m.clock).toBeLessThanOrEqual(HALF_TIME);
    expect(attackDir(m, 0)).toBe(-1);
  });

  it('una patada cerca del arco es gol (no hay arqueros)', () => {
    const m = newMatch('temple', ['inferno', 'frost'], [null, null], seeded(2));
    toPlay(m);
    const f = m.fighters[0], b = m.ball;
    m.fighters[1].x = 3;
    f.x = W - 4; f.y = 0; b.x = f.x + 0.6; b.y = 0.5; b.vx = 0; b.vy = 0;
    play(m, 2, keys(['kick']));
    expect(f.goals).toBe(1);
  });

  it('cada habilidad sale con adelante, adelante + espacio, gasta energía y le pega a la pelota', () => {
    for (const char of CHAR_IDS) {
      const m = newMatch('temple', [char, 'frost'], [null, null], seeded(3));
      toPlay(m);
      m.solids = []; m.hazards = []; // cancha lisa
      const f = m.fighters[0], b = m.ball;
      m.fighters[1].x = 26; m.ref.x = 27;
      f.x = 14; f.y = 0; f.facing = 1; f.stamina = STAMINA;
      const ab = CHARS[char].ability;
      // la pelota donde la alcanza cada habilidad
      b.x = ab === 'superJump' ? 14.3 : ab === 'quake' || ab === 'laserCut' || ab === 'charge' || ab === 'phase' || ab === 'freeze' ? 15.5 : 18; b.y = ab === 'superJump' ? 3 : ab === 'magmaSpikes' || ab === 'quake' || ab === 'charge' || ab === 'phase' ? 0.4 : 1.1; b.vx = 0; b.vy = 0;
      if (ab === 'freeze' || ab === 'toxicCloud') b.vx = -8;
      const x0 = b.x, y0 = b.y, v0 = b.vx;
      let k = 0, low = STAMINA, far = 0;
      for (let t = 0; t < 1.2; t += 1 / 60) { k++; const i = noInput(); i.right = k === 2 || k === 5; i.kick = k === 8; if (k <= 8) { b.x = x0; b.y = y0; b.vx = v0; b.vy = 0; } step(m, [i, noInput()], 1 / 60); low = Math.min(low, f.stamina); far = Math.max(far, ab === 'superJump' ? Math.hypot(b.x - x0, b.y - 3) : b.x - x0); }
      expect(low, char).toBeLessThan(STAMINA - 5);
      if (ab === 'freeze') expect(Math.abs(b.x - x0), char).toBeLessThan(1.5);
      else if (ab === 'toxicCloud') expect(x0 - b.x, char).toBeLessThan(6); // la nube la frena (sin nube recorrería mucho más)
      else expect(far, char).toBeGreaterThan(2);
    }
  });

  it('mantener la barra espaciadora carga el tiro: cuanto más tiempo, más rápido sale la pelota', () => {
    const shot = (frames: number) => {
      const m = newMatch('temple', ['inferno', 'frost'], [null, null], seeded(12));
      toPlay(m); m.solids = []; m.hazards = [];
      const f = m.fighters[0], b = m.ball; m.fighters[1].x = 3; m.ref.x = 3;
      f.x = 12; f.y = 0; f.facing = 1; b.x = 12.6; b.y = 0.45; b.vx = 0; b.vy = 0;
      let k = 0, top = 0, charging = false;
      play(m, 1.6, () => { k++; const i = noInput(); i.kick = k <= frames; if (f.action === 'charge') charging = true; if (k <= frames) { b.x = 12.6; b.y = 0.45; b.vx = 0; b.vy = 0; } top = Math.max(top, Math.hypot(b.vx, b.vy)); return [i, noInput()]; });
      if (frames > 5) expect(charging).toBe(true);
      return top;
    };
    const tap = shot(1), half = shot(30), full = shot(70);
    expect(half).toBeGreaterThan(tap * 1.2);
    expect(full).toBeGreaterThan(half * 1.1);
  });

  it('la habilidad también sale para atrás (atrás, atrás + espacio) y sin la combinación no sale', () => {
    const m = newMatch('temple', ['inferno', 'frost'], [null, null], seeded(13));
    toPlay(m); m.solids = []; m.hazards = [];
    const f = m.fighters[0]; f.x = 15; f.facing = 1; f.stamina = STAMINA;
    let k = 0;
    play(m, 0.4, () => { k++; const i = noInput(); i.left = k === 2 || k === 5; i.kick = k === 8; return [i, noInput()]; });
    expect(f.facing).toBe(-1);
    expect(m.shots.length + (f.cd > 0 ? 1 : 0)).toBeGreaterThan(0);
    const m2 = newMatch('temple', ['inferno', 'frost'], [null, null], seeded(13));
    toPlay(m2); const g = m2.fighters[0];
    k = 0; play(m2, 0.4, () => { k++; const i = noInput(); i.right = k === 2; i.kick = k === 8; return [i, noInput()]; });
    expect(g.cd).toBe(0);
  });

  it('una vez ↑ salta, dos veces salta el doble y tres veces el triple (en el aire); no hay cuarto salto', () => {
    const jump = (presses: number) => {
      const m = newMatch('temple', ['frost', 'toxic'], [null, null], seeded(14));
      toPlay(m); m.solids = []; m.hazards = [];
      const f = m.fighters[0]; f.x = 15; f.y = 0; f.vy = 0; let k = 0, top = 0, done = 0, wasUp = false;
      play(m, 3, () => { k++; const i = noInput(); if (done < presses && !wasUp && (k === 2 || (done > 0 && f.vy < 0.5 && !f.ground))) { i.up = true; done++; } wasUp = i.up; top = Math.max(top, f.y); return [i, noInput()]; });
      return top;
    };
    const one = jump(1), two = jump(2), three = jump(3), four = jump(4);
    expect(one).toBeGreaterThan(1.8); expect(one).toBeLessThan(2.8);
    expect(two).toBeGreaterThan(one * 1.8);
    expect(three).toBeGreaterThan(one * 2.5);
    expect(four).toBeCloseTo(three, 1);
  });

  it('descansando se recupera la energía, y con poca energía se corre más lento', () => {
    const m = newMatch('temple', ['shadow', 'toxic'], [null, null], seeded(4));
    toPlay(m);
    const f = m.fighters[0];
    f.x = 15; f.stamina = 20;
    play(m, 2);
    expect(f.stamina).toBeGreaterThan(35);
    const runSpeed = (stamina: number) => { const m2 = newMatch('temple', ['shadow', 'toxic'], [null, null], seeded(4)); toPlay(m2); m2.solids = []; m2.hazards = []; const g = m2.fighters[0]; g.x = 6; g.stamina = stamina; play(m2, 0.6, () => { const i = noInput(); i.right = true; return [i, noInput()]; }); return g.vx; };
    expect(runSpeed(10)).toBeLessThan(runSpeed(100) * 0.7);
  });

  it('las trampas bajan la energía pero no matan', () => {
    const m = newMatch('industrial', ['cometa', 'toxic'], [null, null], seeded(5));
    toPlay(m);
    const f = m.fighters[0], spikes = m.hazards.find(h => h.kind === 'spikes')!;
    f.x = spikes.x + spikes.w / 2; f.y = 0;
    let low = f.stamina;
    for (let t = 0; t < 7; t += 1 / 60) { step(m, idle(), 1 / 60); low = Math.min(low, f.stamina); }
    expect(low).toBeLessThan(STAMINA - 10);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it('la pelota nunca explota: la lava y el fuego la despiden prendida fuego y sigue en juego', () => {
    const m = newMatch('volcano', ['cometa', 'toxic'], [null, null], seeded(6));
    toPlay(m);
    const lava = m.hazards.find(h => h.kind === 'lava')!;
    m.ball.x = lava.x + lava.w / 2; m.ball.y = 1; m.ball.vx = 0; m.ball.vy = 0;
    let top = 0, fire = false;
    for (let t = 0; t < 3; t += 1 / 60) { step(m, idle(), 1 / 60); expect(m.ball.alive).toBe(true); top = Math.max(top, m.ball.y); if (m.ball.fx === 'fire') fire = true; }
    expect(top).toBeGreaterThan(2);
    expect(fire).toBe(true);
  });

  it('se puede pararse arriba de las plataformas', () => {
    const m = newMatch('temple', ['cometa', 'toxic'], [null, null], seeded(7));
    toPlay(m);
    const p = m.solids.find(s => s.kind === 'float')!, f = m.fighters[0];
    f.x = p.x + p.w / 2; f.y = p.y + p.h + 1; f.vy = 0;
    play(m, 0.6);
    expect(f.y).toBeCloseTo(p.y + p.h, 1);
    expect(supportAt(m, f.x, f.y)).toBeCloseTo(p.y + p.h, 1);
  });

  it('los ascensores llevan al que está arriba y los pistones lanzan la pelota', () => {
    const m = newMatch('moon', ['cometa', 'toxic'], [null, null], seeded(15));
    toPlay(m);
    const lift = m.solids.find(s => s.move?.kind === 'lift')!, f = m.fighters[0];
    f.x = lift.x + lift.w / 2; f.y = lift.y + lift.h + 0.5; f.vy = 0;
    let lo = 99, hi = 0;
    play(m, 8, () => { lo = Math.min(lo, f.y); hi = Math.max(hi, f.y); return idle(); });
    expect(hi - lo).toBeGreaterThan(2);
    expect(f.y).toBeCloseTo(lift.y + lift.h, 1);
    const v = newMatch('volcano', ['cometa', 'toxic'], [null, null], seeded(16));
    toPlay(v);
    const pis = v.solids.find(s => s.move?.kind === 'piston')!;
    let top = 0;
    for (let t = 0; t < 6; t += 1 / 60) { if (pis.h < 0.3) { v.ball.x = pis.x + pis.w / 2; v.ball.y = pis.y + pis.h + 0.3; v.ball.vx = 0; v.ball.vy = 0; } step(v, idle(), 1 / 60); top = Math.max(top, v.ball.y); }
    expect(top).toBeGreaterThan(2.5);
  });

  it('los luchadores tienen la gravedad de la Luna en todos los escenarios: el salto dura lo mismo en la Luna que en el templo', () => {
    const air = (stage: 'moon' | 'temple') => {
      const m = newMatch(stage, ['frost', 'toxic'], [null, null], seeded(5)); toPlay(m);
      const f = m.fighters[0]; f.x = 8; f.y = 0; f.vy = 0; m.ball.x = 20;
      let t = 0, k = 0; const y0 = f.y;
      do { const i = noInput(); i.up = k++ === 1; step(m, [i, noInput()], 1 / 60); t += 1 / 60; } while ((k < 3 || f.vy > 0) && t < 5); // hasta lo más alto del salto
      return [t, f.y - y0];
    };
    const [moonT, moonH] = air('moon'), [templeT, templeH] = air('temple');
    expect(templeT).toBeCloseTo(moonT, 1);
    expect(templeH).toBeCloseTo(moonH, 1);
    expect(templeT).toBeGreaterThan(0.5); // flotado: tarda más de medio segundo en llegar arriba
  });

  it('el árbitro recorre toda la cancha y se sube a las plataformas', () => {
    const m = newMatch('temple', ['cometa', 'toxic'], [0.5, 0.5], seeded(18));
    let lo = W, hi = 0, up = 0;
    play(m, 90, mm => { const r = mm.ref; if (r.action !== 'gone') { lo = Math.min(lo, r.x); hi = Math.max(hi, r.x); if (r.ground) up = Math.max(up, r.y); } return idle(); });
    expect(hi - lo).toBeGreaterThan(15);
    expect(up).toBeGreaterThan(1);
  });

  it('el FATAL GOAL necesita la barra de poder llena, entra si nadie lo frena, y una habilidad del rival lo para', () => {
    for (const char of ['inferno', 'frost', 'thunder', 'shadow', 'toxic', 'bruto'] as const) {
      const m = newMatch('temple', [char, 'toxic'], [null, null], seeded(9));
      toPlay(m);
      m.fighters[1].x = W - 3; m.fighters[0].x = 10; m.ball.x = 10.6; m.ball.y = 0.4; m.ball.vx = 0; m.ball.vy = 0;
      const cast = () => { let k = 0; return (): [Input, Input] => { k++; const i = noInput(); i.cast = k === 2 ? 'fatal' : null; return [i, noInput()]; }; };
      play(m, 0.2, cast());
      expect(m.fatal).toBeNull();
      m.fighters[0].power = POWER_MAX;
      play(m, 6, cast());
      expect(m.fighters[0].goals, char).toBe(1);
      expect(m.lastGoal?.fatal).toBe(true);
    }
    const m = newMatch('temple', ['inferno', 'thunder'], [null, null], seeded(10));
    toPlay(m);
    m.fighters[0].power = POWER_MAX; m.fighters[0].x = 10; m.ball.x = 10.6; m.ball.y = 0.4; m.ball.vx = 0; m.ball.vy = 0;
    m.fighters[1].x = W - 6; m.fighters[1].facing = 1;
    let k = 0;
    play(m, 6, () => { k++; const i = noInput(), j = noInput(); i.cast = k === 2 ? 'fatal' : null; j.cast = m.fatal !== null && Math.hypot(m.ball.x - m.fighters[1].x, m.ball.y - 1) < 6 && k % 2 === 0 ? 'ability' : null; return [i, j]; });
    expect(m.fighters[0].goals).toBe(0);
    expect(fatalKeys(1)).toEqual(['→', '←', '→']);
  });

  it('el FATAL GOAL solo sale con la pelota cerca', () => {
    const m = newMatch('temple', ['inferno', 'toxic'], [null, null], seeded(18));
    toPlay(m); m.solids = []; m.hazards = [];
    const f = m.fighters[0]; f.x = 5; f.power = POWER_MAX; m.ball.x = 20; m.ball.y = 0.4; m.ball.vx = 0; m.ball.vy = 0;
    let k = 0, need = false;
    play(m, 0.3, () => { k++; const i = noInput(); i.cast = k === 2 ? 'fatal' : null; for (const e of takeEvents(m)) if (e.type === 'needBall') need = true; return [i, noInput()]; });
    expect(m.fatal).toBeNull(); expect(need).toBe(true); expect(f.power).toBe(POWER_MAX);
  });

  it('cabezazo: la pelota que cae en la cabeza sale hacia donde mira', () => {
    const m = newMatch('temple', ['frost', 'toxic'], [null, null], seeded(19));
    toPlay(m); m.solids = []; m.hazards = [];
    const f = m.fighters[0]; f.x = 15; f.y = 0; f.vy = 0; f.facing = 1; m.fighters[1].x = 3; m.ref.x = 3;
    m.ball.x = 15.1; m.ball.y = 5; m.ball.vx = 0; m.ball.vy = -4;
    let headed = false;
    play(m, 1, () => { for (const e of takeEvents(m)) if (e.type === 'header') headed = true; return idle(); });
    expect(headed).toBe(true);
    expect(m.ball.x).toBeGreaterThan(17);
  });

  it('corriendo con la pelota al pie la lleva', () => {
    const m = newMatch('temple', ['frost', 'toxic'], [null, null], seeded(20));
    toPlay(m); m.solids = []; m.hazards = [];
    const f = m.fighters[0]; f.x = 8; f.y = 0; f.vy = 0; f.facing = 1; m.fighters[1].x = 26; m.ref.x = 27;
    m.ball.x = 8.6; m.ball.y = BALL_R; m.ball.vx = 0; m.ball.vy = 0;
    play(m, 1.2, () => { const i = noInput(); i.right = true; return [i, noInput()]; });
    expect(m.ball.x - f.x).toBeGreaterThan(0); expect(m.ball.x - f.x).toBeLessThan(2.2);
    expect(f.x).toBeGreaterThan(13);
  });

  it('si al árbitro lo lastima una trampa revienta (sangre y huesos) y después entra otro', () => {
    const m = newMatch('industrial', ['cometa', 'toxic'], [null, null], seeded(21));
    toPlay(m);
    const spikes = m.hazards.find(h => h.kind === 'spikes')!;
    let boom = false, back = false;
    for (let t = 0; t < 12; t += 1 / 60) { if (m.ref.action !== 'gone' && !boom) { m.ref.x = spikes.x + spikes.w / 2; m.ref.y = spikes.y; } step(m, idle(), 1 / 60); for (const e of takeEvents(m)) { if (e.type === 'refBoom') boom = true; if (e.type === 'refBack') back = true; } if (boom && !back) expect(m.gore.drops.length + m.gore.gibs.length + m.gore.stains.length).toBeGreaterThan(0); }
    expect(boom).toBe(true); expect(back).toBe(true);
  });

  it('un poder que frena la pelota justo antes de entrar al arco propio la hace explotar', () => {
    const m = newMatch('temple', ['inferno', 'toxic'], [null, null], seeded(22));
    toPlay(m); m.solids = []; m.hazards = [];
    const f = m.fighters[0]; f.x = 4; f.y = 0; f.facing = -1; f.stamina = STAMINA; m.fighters[1].x = 20; m.ref.x = 22;
    m.ball.x = 3; m.ball.y = 1.1; m.ball.vx = -9; m.ball.vy = 0;
    let boom = false, k = 0;
    play(m, 0.5, () => { k++; const i = noInput(); i.cast = k === 1 ? 'ability' : null; for (const e of takeEvents(m)) if (e.type === 'ballBoom') boom = true; return [i, noInput()]; });
    expect(boom).toBe(true); expect(m.fighters[1].goals).toBe(0);
  });

  it('el recorrido de cada FATAL termina en el arco rival', () => {
    for (const style of ['meteor', 'avalanche', 'bolt', 'void', 'acid', 'boulder'] as const) for (const dir of [1, -1] as const) {
      const fat = { style, x0: dir === 1 ? 6 : W - 6, y0: 0.8, dir };
      let p = fatalPath(fat, 0), t = 0;
      while (!p.done && t < 10) { t += 1 / 60; p = fatalPath(fat, t); expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); }
      expect(p.done).toBe(true);
      expect(dir === 1 ? p.x > W - GOAL_DEPTH : p.x < GOAL_DEPTH).toBe(true);
    }
  });

  it('en el gol la red atrapa la pelota: queda adentro del arco, hacia el fondo', () => {
    const m = newMatch('industrial', ['cometa', 'inferno'], [null, null], seeded(3));
    toPlay(m);
    m.fighters[0].x = 20; m.fighters[1].x = 22;
    m.ball.x = GOAL_DEPTH + 1; m.ball.y = 0.8; m.ball.vx = -12; m.ball.vy = 0;
    play(m, 0.3);
    expect(m.phase).toBe('goal');
    play(m, 1.5);
    expect(m.ball.x).toBeLessThan(GOAL_DEPTH * 0.75);
    expect(m.ball.x).toBeGreaterThan(0);
  });

  it('la pelota trabada arriba del arco (sobre la red, contra la pared) rebota hacia la cancha', () => {
    const m = newMatch('industrial', ['cometa', 'inferno'], [null, null], seeded(4));
    toPlay(m);
    m.fighters[0].x = 4; m.fighters[1].x = 22; // aunque haya alguien cerca
    const u = (GOAL_DEPTH - 0.35) / GOAL_DEPTH;
    m.ball.x = 0.35; m.ball.y = netTop(goalHeight(m, teamAt(m, true)), u) + BALL_R; m.ball.vx = 0; m.ball.vy = 0;
    let out = false;
    for (let t = 0; t < 2.5 && !out; t += 1 / 60) { step(m, [noInput(), noInput()], 1 / 60); if (m.ball.x > GOAL_DEPTH + 1) out = true; }
    expect(out).toBe(true);
  });

  it('empate al final: tiempo extra y el primer gol gana (gol de oro)', () => {
    const m = newMatch('temple', ['cometa', 'inferno'], [null, null], seeded(11));
    toPlay(m);
    m.clock = 0.05; play(m, 0.2); play(m, 6);
    toPlay(m);
    m.clock = 0.05; play(m, 0.2);
    expect(m.extra).toBe(true);
    play(m, 4);
    m.ball.x = 0.6; m.ball.y = 1; m.ball.vx = -3;
    play(m, 4);
    expect(m.winner).toBe(0);
    expect(m.phase).toBe('end');
  });

  it('dos máquinas juegan partidos completos en los 16 escenarios sin romperse y casi sin goles en contra', () => {
    let goals = 0, matches = 0, own = 0;
    STAGES.forEach((stage, i) => {
      const m = newMatch(stage.id, [CHAR_IDS[i], CHAR_IDS[15 - i]], [0.6, 0.6], seeded(100 + i));
      let touchT = 0;
      for (let t = 0; t < 230 && m.phase !== 'end'; t += 1 / 60) {
        const owner = m.ball.owner; step(m, idle(), 1 / 60); if (m.ball.owner !== owner) touchT = m.time;
        for (const e of takeEvents(m)) if (e.type === 'goal' && owner !== null && owner !== e.side && m.time - touchT < 1.5) own++;
      }
      for (const f of m.fighters) { expect(Number.isFinite(f.x) && Number.isFinite(f.y), stage.id).toBe(true); expect(f.stamina).toBeGreaterThanOrEqual(0); }
      expect(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y)).toBe(true);
      goals += m.fighters[0].goals + m.fighters[1].goals; matches++;
      if (m.phase === 'end') expect(m.winner === 0 || m.winner === 1).toBe(true);
    });
    expect(goals).toBeGreaterThan(3);
    expect(goals / matches).toBeLessThan(20);
    expect(own / goals).toBeLessThan(0.12); // casi nunca goles en contra
  }, 90000);
});
