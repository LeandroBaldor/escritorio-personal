import { describe, expect, it } from 'vitest';
import {
  BOARD, chooseSidearm, COUNTDOWN, newGame, PTS, reload, ROUND, setTrigger, spawn, step, switchWeapon, takeEvents, WEAPONS, aimAt, hitTest,
  type Game, type Target, type TargetKind,
} from './tiroAlBlanco';

// Azar fijo: siempre el mismo número (0.5 = sin dispersión desviada hacia ningún lado con d = sqrt(.5)·r).
const fixed = (v = 0.5) => () => v;
const started = (g: Game) => { step(g, COUNTDOWN + 0.001, fixed(0.99)); takeEvents(g); g.targets = []; g.nextSpawn = 999; g.nextAmmo = 999; return g; };
// Pone un cartel parado en la primera fila de adelante.
function standUp(g: Game, kind: TargetKind): Target {
  const t = spawn(g, fixed(0), kind)!;
  t.row = g.scene.rows.length - 1; const row = g.scene.rows[t.row]; t.x = row.spots[0]; t.y = row.y; t.scale = row.scale; t.mirror = false;
  t.state = 'up'; t.changedAt = g.time - 1; t.stayUntil = g.time + 50;
  takeEvents(g);
  return t;
}
// Coordenadas de pantalla de un punto del cartel (unidades de cartel).
const at = (t: Target, lx: number, ly: number) => ({ x: t.x + lx * t.scale, y: t.y + ly * t.scale });
function shoot(g: Game, x: number, y: number) {
  aimAt(g, x, y); setTrigger(g, true); step(g, 0.001, fixed()); setTrigger(g, false);
  return takeEvents(g);
}
const noSpread = (g: Game) => { g.char = { ...g.char, id: 'sombra' }; return g; };

describe('Tiro al Blanco 2.050', () => {
  it('la ronda dura 3 minutos y arranca después de la cuenta regresiva', () => {
    const g = newGame('banco', 'kira', 'rifle');
    expect(g.time).toBe(-COUNTDOWN);
    step(g, 1, fixed()); expect(g.targets).toHaveLength(0);
    for (let i = 0; i < (ROUND + COUNTDOWN) * 20; i++) step(g, 0.05, Math.random);
    expect(g.over).toBe(true);
    expect(ROUND).toBe(180);
  });

  it('tiro en la cabeza al malo suma más que en el cuerpo', () => {
    const g = noSpread(started(newGame('banco', 'kira', 'rifle')));
    const a = standUp(g, 'malo');
    const head = shoot(g, at(a, 0, -240).x, at(a, 0, -240).y).find(e => e.type === 'hit');
    expect(head).toMatchObject({ zone: 'head', points: Math.round(PTS.head * WEAPONS.rifle.badMult) });
    g.cooldown = 0; g.targets = [];
    const b = standUp(g, 'malo');
    const body = shoot(g, at(b, 0, -160).x, at(b, 0, -160).y).find(e => e.type === 'hit');
    expect(body).toMatchObject({ zone: 'body', points: Math.round(PTS.body * WEAPONS.rifle.badMult) });
  });

  it('dispararle a un rehén o a un inocente resta puntos', () => {
    const g = noSpread(started(newGame('metro', 'kira', 'rifle')));
    const t = standUp(g, 'rehen');
    const ev = shoot(g, at(t, 0, -160).x, at(t, 0, -160).y);
    expect(ev.find(e => e.type === 'penalty')).toMatchObject({ points: PTS.innocent });
    expect(g.score).toBe(PTS.innocent);
  });

  it('el malo con rehén solo se baja con un tiro limpio a la cabeza', () => {
    const g = noSpread(started(newGame('torre', 'kira', 'rifle')));
    const t = standUp(g, 'maloRehen');
    const bad = shoot(g, at(t, 44, -266).x, at(t, 44, -266).y).find(e => e.type === 'hit');
    expect(bad).toMatchObject({ zone: 'head', points: Math.round(PTS.hostageHead * WEAPONS.rifle.badMult) });
    g.cooldown = 0; g.targets = [];
    const u = standUp(g, 'maloRehen');
    expect(shoot(g, at(u, -16, -160).x, at(u, -16, -160).y).some(e => e.type === 'penalty')).toBe(true);
  });

  it('el cartel baleado se va para atrás y el que no se baleó se esconde', () => {
    const g = noSpread(started(newGame('banco', 'kira', 'rifle')));
    const t = standUp(g, 'malo');
    shoot(g, at(t, 0, -160).x, at(t, 0, -160).y);
    expect(t.state).toBe('hit');
    const m = standUp(g, 'malo'); m.stayUntil = g.time + 0.01;
    step(g, 0.05, fixed()); expect(m.state).toBe('lowering');
    expect(takeEvents(g).some(e => e.type === 'escape')).toBe(true);
  });

  it('pegarle al cartel fuera de la figura no cuenta', () => {
    const g = noSpread(started(newGame('banco', 'kira', 'rifle')));
    const t = standUp(g, 'malo');
    const p = at(t, BOARD.w / 2 - 4, -40);
    expect(hitTest(g, p.x, p.y)?.part).toBeNull();
    expect(shoot(g, p.x, p.y).some(e => e.type === 'hit')).toBe(false);
    expect(t.state).toBe('up');
  });

  it('la escopeta tira 7 perdigones y la ametralladora es automática', () => {
    const g = started(newGame('banco', 'kira', 'escopeta'));
    const shot = shoot(g, 800, 300).find(e => e.type === 'shot');
    expect(shot && shot.type === 'shot' && shot.impacts.length).toBe(7);
    const m = started(newGame('banco', 'kira', 'ametralladora'));
    aimAt(m, 800, 200); setTrigger(m, true);
    for (let i = 0; i < 20; i++) step(m, 0.05, fixed());
    expect(m.stats.shots).toBeGreaterThan(8);
  });

  it('sin balas en el arma grande hay que elegir pistola o revólver', () => {
    const g = started(newGame('puerto', 'kira', 'rifle'));
    g.primary.reserve = 0; g.primary.mag = 1;
    shoot(g, 800, 100);
    expect(g.needSidearm).toBe(true);
    chooseSidearm(g, 'revolver');
    expect(g.current).toBe('sidearm');
    expect(g.sidearm).toMatchObject({ id: 'revolver', mag: 6 });
    switchWeapon(g); expect(g.current).toBe('sidearm'); // el arma grande está vacía
  });

  it('el arma corta se recarga sin fin', () => {
    const g = started(newGame('puerto', 'kira', 'rifle'));
    g.primary.reserve = 0; g.primary.mag = 0; chooseSidearm(g, 'pistola');
    g.sidearm!.mag = 0;
    expect(reload(g)).toBe(true);
    step(g, 2, fixed());
    expect(g.sidearm!.mag).toBe(15);
    expect(g.sidearm!.reserve).toBe(Infinity);
  });

  it('la caja de munición devuelve balas al arma grande', () => {
    const g = noSpread(started(newGame('mercado', 'kira', 'rifle')));
    g.primary.reserve = 0; g.primary.mag = 0; chooseSidearm(g, 'pistola');
    const t = standUp(g, 'municion'); g.cooldown = 0;
    const ev = shoot(g, at(t, 0, -120).x, at(t, 0, -120).y);
    expect(ev.some(e => e.type === 'ammo')).toBe(true);
    expect(g.current).toBe('primary');
    expect(g.primary.reserve + g.primary.mag).toBeGreaterThan(0);
  });

  it('los personajes tienen su ventaja', () => {
    expect(newGame('banco', 'titan', 'rifle').primary.reserve).toBe(45);
    const n = noSpread(started(newGame('banco', 'nova', 'rifle'))); n.char = { ...n.char, id: 'nova' };
    const t = standUp(n, 'malo');
    expect(shoot(n, at(t, 0, -240).x, at(t, 0, -240).y).find(e => e.type === 'hit')).toMatchObject({ points: Math.round(PTS.head * 1.25) + 100 });
    const r = noSpread(started(newGame('banco', 'r7', 'rifle'))); r.char = { ...r.char, id: 'r7' };
    const c = standUp(r, 'civil');
    expect(shoot(r, at(c, 0, -160).x, at(c, 0, -160).y).find(e => e.type === 'penalty')).toMatchObject({ points: PTS.innocent / 2 });
  });

  it('a lo largo de la ronda aparecen malos, rehenes e inocentes', () => {
    const g = newGame('banco', 'kira', 'escopeta'), kinds = new Set<string>();
    for (let i = 0; i < 2000; i++) { step(g, 0.05, Math.random); for (const e of takeEvents(g)) if (e.type === 'pop') kinds.add(g.targets[g.targets.length - 1]?.kind); }
    expect(kinds.has('malo') && kinds.has('rehen') && kinds.has('civil') && kinds.has('maloRehen')).toBe(true);
  });
});
