// El golpe contra la calle en Trepaluna, con el mismo efecto que en Gravity Swap (y SkynetBall): un fogonazo
// rojo, la pantalla que tiembla, muchísimas gotas de sangre que salen volando y quedan pegadas donde caen
// (en la calle y en las paredes de los edificios, donde chorrean), un charco que se va agrandando y los
// pedazos del trepador (la gorra, los brazos, las piernas con la zapatilla, el torso y unos trozos) que
// rebotan dejando un rastro. Coordenadas del mundo: x de 0 a `width`, y para arriba (la calle es y = 0).

export interface Drop { x: number; y: number; vx: number; vy: number; r: number; life: number }
export interface Stain { x: number; y: number; r: number; at: number; wall: 0 | -1 | 1; kind: 'pool' | 'splat'; seed: number }
export interface Gib { x: number; y: number; vx: number; vy: number; a: number; va: number; kind: 'cap' | 'arm' | 'leg' | 'torso' | 'chunk'; life: number; drip: number; rest: boolean }
export interface Gore { clock: number; drops: Drop[]; stains: Stain[]; gibs: Gib[]; blast: { x: number; y: number; t: number } | null; shake: number }

export const newGore = (): Gore => ({ clock: 0, drops: [], stains: [], gibs: [], blast: null, shake: 0 });
export const BLAST_TIME = 0.45;
const BLOOD_G = 20; // la sangre cae más rápido que el trepador (es más pesada)

function stain(g: Gore, x: number, y: number, r: number, wall: Stain['wall'], kind: Stain['kind']) {
  g.stains.push({ x, y, r, wall, kind, at: g.clock, seed: Math.random() });
  if (g.stains.length > 500) g.stains.splice(0, g.stains.length - 500);
}

// Revienta contra la calle en (x, 0).
export function splat(g: Gore, x: number) {
  const cy = 0.35;
  g.shake = 1;
  g.blast = { x, y: cy, t: 0 };
  for (const [n, power, size] of [[90, 7, 0.05], [40, 3.5, 0.08], [50, 11, 0.03]] as const) {
    for (let i = 0; i < n; i++) {
      // la mayoría sale para arriba y a los costados (rebota contra la calle)
      const a = Math.random() * Math.PI, sp = power * (0.3 + Math.random() * 0.9);
      g.drops.push({ x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + power * 0.2, r: size * (0.5 + Math.random()), life: 0 });
    }
  }
  stain(g, x, 0, 1.4, 0, 'pool');
  const kinds: Gib['kind'][] = ['cap', 'arm', 'arm', 'leg', 'leg', 'torso', 'chunk', 'chunk', 'chunk'];
  for (const kind of kinds) {
    const a = 0.25 + Math.random() * (Math.PI - 0.5), sp = 3 + Math.random() * 6;
    g.gibs.push({ x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, a: Math.random() * 6, va: (Math.random() - 0.5) * 18, kind, life: 0, drip: 0, rest: false });
  }
}

export function updateGore(g: Gore, dt: number, width: number) {
  g.clock += dt;
  if (g.blast) { g.blast.t += dt; if (g.blast.t >= BLAST_TIME) g.blast = null; }
  g.shake = Math.max(0, g.shake - dt * 2.2);
  if (!g.drops.length && !g.gibs.length) return;
  for (const d of g.drops) {
    d.life += dt; d.vy -= BLOOD_G * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x <= 0 || d.x >= width) { stain(g, d.x <= 0 ? 0 : width, Math.max(0.05, d.y), d.r * (2 + Math.random() * 1.5), d.x <= 0 ? -1 : 1, 'splat'); d.life = 99; }
    else if (d.y <= 0) { stain(g, d.x, 0, d.r * (2 + Math.random() * 1.5), 0, 'splat'); d.life = 99; }
  }
  g.drops = g.drops.filter(d => d.life < 4);
  for (const p of g.gibs) {
    p.life += dt;
    if (p.rest) continue;
    p.vy -= BLOOD_G * 0.8 * dt; p.a += p.va * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 0.15 || p.x > width - 0.15) { p.x = Math.max(0.15, Math.min(width - 0.15, p.x)); p.vx *= -0.35; p.va *= 0.6; }
    if (p.y <= 0.08) {
      if (Math.hypot(p.vx, p.vy) > 2.5) stain(g, p.x, 0, 0.22, 0, 'splat'); // al rebotar deja una mancha
      p.y = 0.08; p.vy *= -0.35; p.vx *= 0.7; p.va *= 0.6;
      if (Math.abs(p.vy) < 0.6) { p.vy = 0; p.vx *= 0.5; if (Math.abs(p.vx) < 0.3) p.rest = true; }
    }
    // Mientras vuela, va chorreando.
    if ((p.drip -= dt) <= 0 && Math.hypot(p.vx, p.vy) > 1.5 && p.life < 2.5) {
      p.drip = 0.035;
      g.drops.push({ x: p.x, y: p.y, vx: p.vx * 0.2 + (Math.random() - 0.5), vy: p.vy * 0.2 + (Math.random() - 0.5), r: 0.03 + Math.random() * 0.03, life: 0 });
    }
  }
  g.gibs = g.gibs.filter(p => p.life < 20);
}
