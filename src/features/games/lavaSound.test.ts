import { describe, expect, it } from 'vitest';
import { elevatorAt, heliState, newLava, personX, sparkActive } from './lava';
import { lavaLevels } from './lavaSound';

describe('El piso es de lava: sonidos de ambiente', () => {
  it('la lava siempre se escucha un poco y ruge más cuando está cerca', () => {
    const g = newLava(0, 1);
    g.player.y = 30;
    const far = lavaLevels(g).lava;
    expect(far).toBeGreaterThan(0);
    g.player.y = g.lava + 1;
    expect(lavaLevels(g).lava).toBeGreaterThan(0.8);
    expect(far).toBeLessThan(0.2);
  });

  it('el fuego suena cerca de un departamento incendiado y lejos no', () => {
    const g = newLava(0, 1), f = g.fires[0];
    g.player.x = f.x2 + 0.5; g.player.y = f.y;
    expect(lavaLevels(g).fire).toBeGreaterThan(0.7);
    g.player.y = f.y + 20;
    expect(lavaLevels(g).fire).toBe(0);
  });

  it('el cortocircuito solo suena mientras chispea', () => {
    const g = newLava(0, 1), s = g.sparks[0];
    g.player.x = s.x2 + 0.3; g.player.y = s.y1;
    g.time = [...Array(400).keys()].map(i => i / 100).find(t => sparkActive(s, t))!;
    g.sparks = [s];
    expect(lavaLevels(g).electric).toBeGreaterThan(0.6);
    g.time = [...Array(400).keys()].map(i => i / 100).find(t => !sparkActive(s, t))!;
    expect(lavaLevels(g).electric).toBe(0);
  });

  it('el helicóptero se escucha desde lejos y más fuerte cuanto más cerca', () => {
    const g = newLava(0, 1);
    g.player.x = 5; g.player.y = 0;
    expect(lavaLevels(g).heli).toBe(0);
    const st = heliState(g, g.time);
    g.player.x = st.x - 8; g.player.y = st.y;
    const mid = lavaLevels(g).heli;
    g.player.x = st.x - 1;
    expect(mid).toBeGreaterThan(0);
    expect(lavaLevels(g).heli).toBeGreaterThan(mid);
  });

  it('el ascensor suena mientras se mueve, no con las puertas abiertas', () => {
    const g = newLava(0, 1), e = g.elevators[0];
    g.elevators = [e];
    const moving = [...Array(3000).keys()].map(i => i / 50).find(t => elevatorAt(e, t).dir !== 0)!;
    g.time = moving; g.player.x = e.x + e.w / 2; g.player.y = elevatorAt(e, moving).y;
    expect(lavaLevels(g).elevator).toBeGreaterThan(0.8);
    const stopped = [...Array(3000).keys()].map(i => i / 50).find(t => elevatorAt(e, t).open)!;
    g.time = stopped;
    expect(lavaLevels(g).elevator).toBe(0);
  });
  it('la sirena lejana suena siempre y la gente prendida fuego tiene su propio sonido', () => {
    expect(lavaLevels(newLava(0, 1)).siren).toBe(1);
    const q = [...Array(40).keys()].map(seed => newLava(seed, 1)).flatMap(l => l.people.map(p => ({ l, p }))).find(({ p }) => p.torch);
    expect(q).toBeTruthy();
    const { l, p } = q!;
    l.player.x = personX(p, l.time).x; l.player.y = p.y;
    expect(lavaLevels(l).burning).toBeGreaterThan(0.8);
  });
});
