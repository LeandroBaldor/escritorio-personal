// Vampyium2: inercia de las poses (como el "inertialization" de los motores de animación profesionales).
//
// Cada personaje arma su pose cuadro por cuadro a partir de su estado (parado, caminando, atacando, saltando…).
// Cuando el estado cambia, la pose nueva puede quedar lejos de la anterior y una pierna, un brazo o el arma saltarían
// de un cuadro al otro. Acá se guarda, para cada personaje y cada articulación, lo que se dibujó en el cuadro anterior:
// - el movimiento normal (hasta una velocidad máxima) pasa igual, sin retraso (así el pie apoyado no patina);
// - lo que excede esa velocidad (un salto de pose) se guarda como una diferencia que se apaga sola en ~0,1 s.
// El resultado es continuo: nunca hay saltos de un cuadro, y entre poses el cuerpo se mueve con una curva suave.
// Al cambiar de dirección el personaje se da vuelta en el acto (espejo instantáneo, nunca se angosta).

interface Channel { last: number; prev: number[]; off: number[]; offV: number[]; tv: number[]; outV: number[]; out: number[] }
interface Owner { ch: Map<string, Channel> }
const owners = new WeakMap<object, Owner>();
const ownerOf = (o: object) => { let r = owners.get(o); if (!r) { r = { ch: new Map() }; owners.set(o, r); } return r; };
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

/** Time constant of the blend between two poses (s): the change settles in about three times this. */
export const POSE_BLEND = .05;

/**
 * Continuous version of `target` for this owner/channel. `vmax` is the fastest a value moves normally (units per
 * second): that passes untouched. A faster change is a jump between two poses: the drawn value keeps the speed it
 * had and eases into the new pose with a critically damped spring (no overshoot, no one-frame jumps, no sudden
 * stop). `angles` wraps differences (−π…π).
 */
export function inertia(owner: object | null | undefined, key: string, t: number, target: number[], vmax: number, angles = false, tau = POSE_BLEND): number[] {
  if (!owner) return target;
  const o = ownerOf(owner);
  let c = o.ch.get(key);
  const dt = c ? t - c.last : -1;
  if (!c || c.prev.length !== target.length || dt < 0 || dt > .25) { // first time, or the game jumped/paused: no history
    const z = target.map(() => 0);
    c = { last: t, prev: target.slice(), off: z.slice(), offV: z.slice(), tv: z.slice(), outV: z.slice(), out: target.slice() };
    o.ch.set(key, c); return target;
  }
  if (dt === 0) return target.map((v, i) => v + c!.off[i]); // drawn again in the same frame
  const w = 1 / tau, e = Math.exp(-w * dt), lim = vmax * dt;
  const out: number[] = [];
  for (let i = 0; i < target.length; i++) {
    const d = angles ? wrap(target[i] - c.prev[i]) : target[i] - c.prev[i];
    let x = c.off[i], v = c.offV[i];
    // A jump of pose: faster than this joint ever moves, or a sudden change of speed (normal motion speeds up and
    // slows down gradually; a change of pose moves a lot in one frame from rest or from a slow drift).
    const jump = Math.abs(d) > lim || Math.abs(d) > lim * .35 + 2 * Math.abs(c.tv[i] * dt);
    if (jump) { // absorb it whole and keep moving at the speed the joint had
      x -= d;
      v = Math.max(-vmax * 3, Math.min(vmax * 3, c.outV[i] - c.tv[i]));
    } else c.tv[i] = d / dt;
    const k = v + w * x; // critically damped spring towards 0 (exact step)
    c.off[i] = (x + k * dt) * e; c.offV[i] = (v - w * k * dt) * e;
    if (Math.abs(c.off[i]) < 1e-5 && Math.abs(c.offV[i]) < 1e-4) { c.off[i] = 0; c.offV[i] = 0; }
    const value = target[i] + c.off[i];
    c.outV[i] = (angles ? wrap(value - c.out[i]) : value - c.out[i]) / dt;
    out.push(value);
  }
  c.prev = target.slice(); c.last = t; c.out = out;
  return out;
}

/** A point version of `inertia`. */
export function inertiaPt(owner: object | null | undefined, key: string, t: number, p: [number, number], vmax: number): [number, number] {
  const r = inertia(owner, key, t, p, vmax); return [r[0], r[1]];
}
