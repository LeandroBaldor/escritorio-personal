import { describe, expect, it } from 'vitest';
import { BALLS, COURT, MAX_TOUCHES, NET_X, SET_POINTS, STAGE_BALL, newVoley, noVInput, touchesOf, stepVoley, takeVoleyEvents, type VEvent, type VMatch } from './kombatVoley';
import { CHAR_IDS, STAGES, seeded } from './kombat';

const run = (m: VMatch, s: number, ev: VEvent[] = []) => { for (let t = 0; t < s && m.phase !== 'end'; t += 1 / 60) { stepVoley(m, [noVInput(), noVInput()], 1 / 60); ev.push(...takeVoleyEvents(m)); } return ev; };

describe('Kombat Voley', () => {
  it('16 estadios, cada uno con su pelota distinta', () => {
    expect(STAGES).toHaveLength(16);
    const kinds = STAGES.map(s => STAGE_BALL[s.id]);
    expect(new Set(kinds).size).toBe(16);
    for (const k of kinds) expect(BALLS[k].name).toBeTruthy();
  });
  it('un partido entre máquinas termina en un set a 25 con dos de diferencia', () => {
    for (const seed of [1, 2, 3]) {
      const m = newVoley('industrial', [CHAR_IDS[seed], CHAR_IDS[seed + 5]], [0.6, 0.6], seeded(seed));
      const ev = run(m, 900);
      expect(m.phase).toBe('end');
      const [a, b] = m.score, w = Math.max(a, b), l = Math.min(a, b);
      expect(w).toBeGreaterThanOrEqual(SET_POINTS); expect(w - l).toBeGreaterThanOrEqual(2);
      if (w > SET_POINTS) expect(w - l).toBe(2);
      expect(ev.filter(e => e.type === 'touch').length).toBeGreaterThan(40); // (hay jugadas, no solo saques)
      expect(ev.some(e => e.type === 'touch' && e.kind === 'spike')).toBe(true);
    }
  });
  it('si la pelota pica en tu cancha es punto del rival, y saca el que ganó el punto', () => {
    const m = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(4));
    run(m, 2.6); expect(m.phase).toBe('serve');
    m.phase = 'rally'; const b = m.ball; b.held = false; b.x = 3; b.y = 3; b.vx = 0; b.vy = 0; m.lastTeam = 1;
    for (const p of m.players) p.x = p.team === 0 ? -3 : COURT;
    const ev = run(m, 2);
    expect(ev.find(e => e.type === 'point')).toMatchObject({ side: 1, why: 'floor' });
    expect(m.server).toBe(1);
  });
  it('afuera: punto del que no la tocó última; más de tres toques: punto del rival', () => {
    const m = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(5));
    run(m, 2.6); m.phase = 'rally'; const b = m.ball; b.held = false; b.x = COURT + 2.5; b.y = 2; b.vx = 1; b.vy = 0; m.lastTeam = 0;
    for (const p of m.players) p.x = p.team === 0 ? 0 : NET_X + 1;
    let ev = run(m, 2);
    expect(ev.find(e => e.type === 'point')).toMatchObject({ side: 1, why: 'out' });
    expect(MAX_TOUCHES).toBe(3);
    const m2 = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(6));
    run(m2, 2.6); m2.phase = 'rally'; const b2 = m2.ball; b2.held = false; m2.lastTeam = 0; m2.touches = 3; m2.ballSide = 0;
    const p = m2.players[0]; p.x = 4; b2.x = 4; b2.y = 2.2; b2.vx = 0; b2.vy = -1;
    ev = run(m2, 1);
    expect(ev.find(e => e.type === 'point')).toMatchObject({ side: 1, why: 'touches' });
  });
  it('los tres toques son solo mientras la pelota está de tu lado: al pasar la red se cuentan de nuevo', () => {
    const m = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(8));
    run(m, 2.6); m.phase = 'rally'; const b = m.ball; b.held = false;
    // el equipo 0 ya tocó tres veces y la pelota pasa al otro lado: ahí el rival empieza de cero
    m.lastTeam = 0; m.touches = 3; m.ballSide = 0; b.x = NET_X - 1; b.y = 3.5; b.vx = 6; b.vy = 1;
    m.players[0].x = 1; m.players[1].x = COURT - 0.5;
    for (let t = 0; t < 0.5; t += 1 / 60) stepVoley(m, [noVInput(), noVInput()], 1 / 60);
    expect(m.ballSide).toBe(1);
    expect(touchesOf(m, 0)).toBe(0); expect(touchesOf(m, 1)).toBe(0);
    // si vuelve sin que el rival la toque (por ejemplo, la trae el viento), el equipo 0 vuelve a tener sus tres toques
    b.x = NET_X - 1.5; b.y = 2.6; b.vx = 0; b.vy = 0; m.players[0].x = NET_X - 1.5;
    const ev: VEvent[] = []; for (let t = 0; t < 0.3 && !ev.some(e => e.type === 'touch'); t += 1 / 60) { stepVoley(m, [noVInput(), noVInput()], 1 / 60); ev.push(...takeVoleyEvents(m)); }
    expect(ev.find(e => e.type === 'touch')).toMatchObject({ side: 0, n: 1 });
    expect(ev.some(e => e.type === 'point')).toBe(false);
    // y del otro lado de la red no se puede tocar
    const m2 = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(9));
    run(m2, 2.6); m2.phase = 'rally'; m2.ballSide = 1; m2.lastTeam = 0; m2.touches = 0;
    const b2 = m2.ball; b2.held = false; b2.x = NET_X + 0.15; b2.y = 2.4; b2.vx = 0; b2.vy = 0; m2.players[0].x = NET_X - 0.5; m2.players[1].x = COURT;
    const ev2: VEvent[] = []; for (let t = 0; t < 0.15; t += 1 / 60) { stepVoley(m2, [noVInput(), noVInput()], 1 / 60); ev2.push(...takeVoleyEvents(m2)); }
    expect(ev2.some(e => e.type === 'touch' && e.side === 0)).toBe(false);
  });
  it('la persona: sin tocar nada la recibe (sube en su cancha); con V la pasa al otro lado', () => {
    const m = newVoley('industrial', ['frost', 'thunder'], [null, null], seeded(7));
    run(m, 2.6); m.phase = 'rally'; const b = m.ball, p = m.players[0]; b.held = false; p.x = 4; b.x = 4.1; b.y = 4; b.vx = 0; b.vy = -2; m.lastTeam = 1; m.touches = 1;
    m.players[1].x = 15;
    let ev: VEvent[] = []; for (let t = 0; t < 0.6 && !ev.some(e => e.type === 'touch'); t += 1 / 60) { stepVoley(m, [noVInput(), noVInput()], 1 / 60); ev.push(...takeVoleyEvents(m)); }
    expect(ev.find(e => e.type === 'touch')).toMatchObject({ side: 0, kind: 'bump', n: 1 });
    expect(b.vy).toBeGreaterThan(5); expect(b.x).toBeLessThan(NET_X);
    ev = [];
    const v = noVInput(); v.hit = true;
    for (let t = 0; t < 2.5 && !ev.some(e => e.type === 'touch'); t += 1 / 60) { p.x += (b.x - p.x) * 0.3; stepVoley(m, [v, noVInput()], 1 / 60); ev.push(...takeVoleyEvents(m)); }
    expect(ev.find(e => e.type === 'touch')).toMatchObject({ side: 0, kind: 'attack' });
    for (let t = 0; t < 2.5 && b.x < NET_X; t += 1 / 60) stepVoley(m, [noVInput(), noVInput()], 1 / 60);
    expect(b.x).toBeGreaterThan(NET_X);
  });
});
