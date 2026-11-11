// Vampyium2: el ciclo de caminata de los personajes (como en los juegos 2D profesionales).
//
// Un ciclo de 8 fases: contacto, transferencia del peso, paso intermedio e impulso con una pierna y lo mismo con
// la otra. La fase sale de la distancia recorrida (no del tiempo): así el pie apoyado va para atrás exactamente a la
// velocidad del piso y nunca patina. Mientras un pie está apoyado se desliza para atrás en línea recta; el otro pasa
// adelante en un arco (sube y baja), despega con la punta y apoya primero el talón. El cuerpo baja al apoyar y sube
// al pasar la pierna; los brazos van al revés que las piernas. Las posiciones de los pies se las pasa cada personaje
// a su cinemática inversa (muslo, rodilla, canilla y tobillo).
export type Pt = [number, number];

export interface GaitOpts {
  S: number; // largo del paso (lo que se mueve el pie apoyado, en unidades del personaje)
  H: number; // cuánto sube el pie que pasa adelante
  K: number; // unidades del mundo por unidad del personaje (para que el paso vaya a la velocidad del piso)
  bob?: number; // cuánto baja el cuerpo al apoyar
  beta?: number; // qué parte del ciclo está apoyado cada pie (más de la mitad: los dos pies apoyados un rato)
  walkAt?: number; // velocidad (mundo) a la que ya camina del todo; más despacio se mezcla con estar parado
}
export interface Gait {
  k: number; // 0 parado … 1 caminando (para que arranque y frene suave)
  p: number; // la fase del ciclo (0…1)
  ph: [number, number]; // la fase de cada pie
  dx: [number, number]; // cuánto se corre cada pie (adelante +) respecto de su lugar parado
  lift: [number, number]; // cuánto se levanta cada pie (arriba +)
  fa: [number, number]; // el ángulo del pie (+: la punta para abajo, al despegar; −: la punta arriba, al apoyar el talón)
  arm: [number, number]; // el balanceo de cada brazo (+: adelante), al revés que su pierna
  bob: number; // + baja el cuerpo
  sway: number; // −1…1: el vaivén del torso y la cadera (dos por ciclo)
}

const frac = (x: number) => x - Math.floor(x);
const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

export function gait(dist: number, speed: number, o: GaitOpts): Gait {
  const beta = o.beta ?? 0.62, S = o.S;
  const k = smooth(speed / (o.walkAt ?? 1.4));
  const p = frac((dist / o.K) * beta / S); // un ciclo = dos pasos (cada pie recorre S apoyado en beta del ciclo)
  const ph: [number, number] = [frac(p + 0.5), p];
  const dx: [number, number] = [0, 0], lift: [number, number] = [0, 0], fa: [number, number] = [0, 0], arm: [number, number] = [0, 0];
  for (let i = 0; i < 2; i++) {
    const q = ph[i];
    if (q < beta) { // apoyado: va para atrás con el piso; al final levanta el talón (la punta empuja)
      const u = q / beta;
      dx[i] = S / 2 - S * u;
      fa[i] = u > 0.72 ? 0.55 * smooth((u - 0.72) / 0.28) : 0;
      lift[i] = u > 0.72 ? 0.035 * smooth((u - 0.72) / 0.28) : 0;
    } else { // en el aire: pasa adelante en un arco; termina con la punta arriba para apoyar el talón
      const u = (q - beta) / (1 - beta), e = smooth(u);
      dx[i] = -S / 2 + S * e;
      lift[i] = o.H * Math.sin(Math.PI * Math.min(1, u * 1.08)) + 0.035 * (1 - smooth(u * 3));
      fa[i] = 0.55 * (1 - smooth(u * 2.2)) - 0.28 * Math.exp(-(((u - 0.86) / 0.13) ** 2));
    }
    arm[i] = -Math.cos(2 * Math.PI * (q - 0.06)); // al revés que la pierna (y apenas atrasado: no es rígido)
  }
  const bob = (o.bob ?? 0.03) * (0.5 + 0.5 * Math.cos(4 * Math.PI * (p - 0.08)));
  return {
    k, p, ph,
    dx: [dx[0] * k, dx[1] * k], lift: [lift[0] * k, lift[1] * k], fa: [fa[0] * k, fa[1] * k],
    arm: [arm[0] * k, arm[1] * k], bob: bob * k, sway: Math.sin(4 * Math.PI * p) * k,
  };
}

// Las dos articulaciones de una pierna (cadera → rodilla → tobillo) para que el pie llegue a donde tiene que ir,
// con la rodilla siempre para adelante. Devuelve [ángulo del muslo, cuánto se dobla la rodilla] (0 = derecho para
// abajo, + adelante), que es como arman las piernas los personajes de vampyriumChars.
export function legAngles(hip: Pt, foot: Pt, l1: number, l2: number): [number, number] {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = Math.max(1e-4, Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4));
  const base = Math.atan2(dx, dy);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const g = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  return [base + a, Math.PI - g];
}

// One human contact sequence for hero and enemies; distance, not a timer, drives the feet.
export function humanWalk(distance: number, speed: number, scale: number) {
  const beta = .62;
  const cycle = gait(distance, speed, { S: .58, H: .125, K: scale, beta, bob: .026 });
  for (let i = 0; i < 2; i++) {
    const q = cycle.ph[i];
    if (q < beta) {
      const u = q / beta;
      cycle.lift[i] = 0;
      cycle.fa[i] = (-.18 * (1 - smooth(u / .16)) + .42 * smooth((u - .76) / .24)) * cycle.k;
    } else {
      const u = (q - beta) / (1 - beta);
      cycle.lift[i] = .125 * Math.pow(Math.sin(Math.PI * u), 1.3) * cycle.k;
      cycle.fa[i] = (.42 * (1 - smooth(u / .45)) - .18 * smooth((u - .62) / .38)) * cycle.k;
    }
    // Opposite the ipsilateral foot, with a small lag at the elbow.
    cycle.arm[i] = -Math.cos(2 * Math.PI * (q - .06)) * cycle.k;
  }
  return cycle;
}

// Map the painted bone's actual joint centers to the rig, instead of its bounding box.
export function jointTransform(start: Pt, end: Pt, proximal: Pt, distal: Pt, aspect: number, width: number) {
  const sx = (distal[0] - proximal[0]) * width, sy = (distal[1] - proximal[1]) * width / aspect;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const scale = Math.hypot(dx, dy) / Math.hypot(sx, sy);
  return { angle: Math.atan2(dy, dx) - Math.atan2(sy, sx), width: width * scale, height: width / aspect * scale };
}
