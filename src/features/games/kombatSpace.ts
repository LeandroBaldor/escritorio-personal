// El fondo de la selección de luchadores: el espacio profundo pintado una sola vez (y guardado como imagen).
// Nebulosas de colores hechas con ruido, la Vía Láctea, miles de estrellas de distintas temperaturas (azules,
// blancas, amarillas, rojas), estrellas brillantes con destellos en cruz, planetas iluminados como esferas
// (un gigante gaseoso con anillos, uno con océanos y nubes, uno rocoso con cráteres, una luna helada), cometas
// con su cola de polvo y su cola de iones, una galaxia espiral lejana y dos agujeros negros con su disco de
// acreción que la gravedad dobla por arriba y por abajo (como en Interstellar).
import { fbm, pixels, ramp } from './gravityBackdrops';

const TAU = Math.PI * 2;
type RGB = [number, number, number];

// Números al azar pero siempre los mismos (así el fondo sale igual cada vez).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

// ---------- Nebulosas ----------
// Tres nubes (magenta-violeta, azul-turquesa y una naranja tenue) con el ruido "doblado" sobre sí mismo para que
// queden filamentos, y franjas de polvo oscuro que las cortan.
function nebula(W0: number, H0: number, k: number) {
  const w = W0 / k, h = H0 / k;
  const clouds: { x: number; y: number; rx: number; ry: number; rot: number; cols: [number, string][]; a: number }[] = [
    { x: 0.3, y: 0.38, rx: 0.42, ry: 0.22, rot: -0.45, a: 1, cols: [[0, '#1a0633'], [0.35, '#5b1a8c'], [0.6, '#c2269b'], [0.82, '#ff5fae'], [1, '#ffd0ec']] },
    { x: 0.78, y: 0.62, rx: 0.36, ry: 0.26, rot: 0.5, a: 0.95, cols: [[0, '#04172e'], [0.35, '#0f4f8a'], [0.62, '#1497b8'], [0.84, '#4ee6d4'], [1, '#e0fffb']] },
    { x: 0.55, y: 0.9, rx: 0.4, ry: 0.13, rot: 0.05, a: 0.6, cols: [[0, '#1f0a02'], [0.4, '#7a2a08'], [0.7, '#e0661c'], [1, '#ffd29a']] },
    { x: 0.08, y: 0.82, rx: 0.2, ry: 0.16, rot: 0.3, a: 0.55, cols: [[0, '#0a0420'], [0.5, '#3b2a9c'], [0.8, '#7f8cff'], [1, '#e5e9ff']] },
  ];
  return pixels(w, h, (px, py) => {
    const x = px / w, y = py / h;
    let r = 0, gg = 0, b = 0, a = 0;
    const qx = fbm(x * 3.1, y * 3.1, 11, 4), qy = fbm(x * 3.1 + 5.2, y * 3.1 + 1.3, 23, 4); // el ruido "doblado"
    const dust = smooth(0.52, 0.72, fbm(x * 7 + qx * 2, y * 7 + qy * 2, 91, 5)); // franjas de polvo oscuro
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i], dx = x - c.x, dy = (y - c.y) * (H0 / W0), cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const u = (dx * cs + dy * sn) / c.rx, v = (-dx * sn + dy * cs) / c.ry, d = u * u + v * v;
      if (d > 2.6) continue;
      const n = fbm(x * 4 + qx * 3.2 + i * 7, y * 4 + qy * 3.2, 37 + i * 13, 6);
      const dens = smooth(0.32, 0.85, n * (1.25 - d * 0.42)) * c.a;
      if (dens <= 0) continue;
      const fil = Math.pow(smooth(0.45, 0.8, fbm(x * 12 + qy * 4, y * 12 + qx * 4, 61 + i, 4)), 2); // filamentos brillantes
      const col = ramp(c.cols, clamp(dens * 0.85 + fil * 0.35));
      const al = clamp(dens * (1 - dust * 0.75) + fil * dens * 0.4);
      r += col[0] * al; gg += col[1] * al; b += col[2] * al; a += al;
    }
    if (a <= 0.002) return null;
    const m = Math.min(1, a);
    return [Math.min(255, r / a), Math.min(255, gg / a), Math.min(255, b / a), m * 235];
  });
}

// ---------- Estrellas ----------
const STAR_COLS: RGB[] = [[155, 176, 255], [170, 191, 255], [202, 215, 255], [248, 247, 255], [255, 244, 234], [255, 225, 180], [255, 204, 111], [255, 160, 110]];
function starColor(r: () => number): RGB { const k = r(); return STAR_COLS[k < 0.1 ? 0 : k < 0.25 ? 1 : k < 0.45 ? 2 : k < 0.65 ? 3 : k < 0.78 ? 4 : k < 0.88 ? 5 : k < 0.95 ? 6 : 7]; }
function stars(g: CanvasRenderingContext2D, W0: number, H0: number, r: () => number) {
  // La Vía Láctea: una franja en diagonal con estrellas muy juntas y un brillo de fondo.
  const band = (x: number, y: number) => { const d = (y - (H0 * 0.95 - x * 0.62)) / (H0 * 0.16); return Math.exp(-d * d); };
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { const x = (i / 25) * W0, y = H0 * 0.95 - x * 0.62; glow(g, x, y, H0 * 0.2, [[0, 'rgba(150,140,190,0.10)'], [1, 'rgba(0,0,0,0)']]); }
  for (let i = 0; i < 9000; i++) {
    const x = r() * W0, y = r() * H0, inBand = band(x, y);
    if (r() > 0.18 + inBand * 0.82) continue;
    const c = starColor(r), s = r() < 0.92 ? 0.35 + r() * 0.5 : 0.8 + r() * 0.9;
    g.fillStyle = rgba(c, 0.35 + r() * 0.6); g.fillRect(x, y, s, s);
  }
  // Estrellas medianas con un halo chico.
  for (let i = 0; i < 520; i++) {
    const x = r() * W0, y = r() * H0, c = starColor(r), s = 0.8 + r() * 1.3;
    glow(g, x, y, s * 3.5, [[0, rgba(c, 0.5)], [1, 'rgba(0,0,0,0)']]);
    g.fillStyle = rgba([255, 255, 255], 0.95); g.beginPath(); g.arc(x, y, s * 0.55, 0, TAU); g.fill();
  }
  // Las más brillantes: halo grande y destello en cruz (como en las fotos de telescopio).
  for (let i = 0; i < 34; i++) {
    const x = r() * W0, y = r() * H0, c = starColor(r), s = 1.5 + r() * 2.5, L = s * (10 + r() * 14);
    glow(g, x, y, s * 9, [[0, rgba(c, 0.55)], [0.25, rgba(c, 0.18)], [1, 'rgba(0,0,0,0)']]);
    for (const [dx, dy, k] of [[1, 0, 1], [0, 1, 1], [0.7071, 0.7071, 0.4], [0.7071, -0.7071, 0.4]] as const) {
      const ll = L * k, gr = g.createLinearGradient(x - dx * ll, y - dy * ll, x + dx * ll, y + dy * ll);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, rgba(c, 0.85)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = gr; g.lineWidth = k === 1 ? 1.2 : 0.7; g.beginPath(); g.moveTo(x - dx * ll, y - dy * ll); g.lineTo(x + dx * ll, y + dy * ll); g.stroke();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, s * 0.8, 0, TAU); g.fill();
  }
  g.restore();
}

// ---------- Planetas (cada píxel es un punto de una esfera iluminada) ----------
type Surface = (u: number, v: number, nx: number, ny: number, nz: number) => { c: RGB; spec?: number; cloud?: number };
function planet(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, light: [number, number, number], surf: Surface, atmo: RGB | null, tilt = 0) {
  const ll = Math.hypot(...light), L = light.map(v => v / ll) as [number, number, number];
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const img = pixels(R * 2 + 2, R * 2 + 2, (px, py) => {
    const x = (px - R) / R, y = (py - R) / R, d2 = x * x + y * y;
    if (d2 > 1) return null;
    const z = Math.sqrt(1 - d2);
    const tx = x * ct - y * st, ty = x * st + y * ct; // el eje inclinado
    const u = Math.atan2(tx, z) / Math.PI, v = Math.asin(clamp(ty, -1, 1)) / (Math.PI / 2);
    const s = surf(u, v, x, y, z);
    const lam = x * L[0] + y * L[1] + z * L[2];
    const day = smooth(-0.08, 0.3, lam), lit = 0.025 + Math.pow(Math.max(0, lam), 0.85) * 1.05 + day * 0.05;
    const rim = Math.pow(1 - z, 3); // el borde un poco más oscuro (como las fotos reales)
    let r = s.c[0] * lit, gg = s.c[1] * lit, b = s.c[2] * lit;
    if (s.spec) { const hz = (L[2] + 1), sp = Math.pow(Math.max(0, (x * L[0] + y * L[1] + z * hz) / Math.hypot(L[0], L[1], hz)), 60) * s.spec; r += 255 * sp; gg += 240 * sp; b += 220 * sp; }
    if (s.cloud) { const k = s.cloud * (0.08 + lit); r = r * (1 - s.cloud) + 245 * k; gg = gg * (1 - s.cloud) + 248 * k; b = b * (1 - s.cloud) + 255 * k; }
    if (atmo) { const a = rim * 0.9 * (0.2 + day); r += atmo[0] * a; gg += atmo[1] * a; b += atmo[2] * a; }
    const edge = clamp((1 - Math.sqrt(d2)) * R * 1.5); // borde suave
    return [Math.min(255, r), Math.min(255, gg), Math.min(255, b), 255 * edge];
  });
  g.drawImage(img, cx - R - 1, cy - R - 1);
  if (atmo) { // el halo de la atmósfera: un anillo fino en el borde, solo del lado iluminado
    const S = Math.ceil(R * 2.6), h = document.createElement('canvas'); h.width = S; h.height = S;
    const hg = h.getContext('2d');
    if (hg) {
      const m = S / 2, gr = hg.createRadialGradient(m, m, 0, m, m, R * 1.25);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.74, 'rgba(0,0,0,0)'); gr.addColorStop(0.79, rgba(atmo, 0.25)); gr.addColorStop(0.81, rgba(atmo, 0.6)); gr.addColorStop(0.88, rgba(atmo, 0.18)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      hg.fillStyle = gr; hg.fillRect(0, 0, S, S);
      hg.globalCompositeOperation = 'destination-in';
      const mk = hg.createLinearGradient(m + L[0] * R, m + L[1] * R, m - L[0] * R, m - L[1] * R);
      mk.addColorStop(0, '#000'); mk.addColorStop(0.55, 'rgba(0,0,0,0.35)'); mk.addColorStop(0.8, 'rgba(0,0,0,0)');
      hg.fillStyle = mk; hg.fillRect(0, 0, S, S);
      g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(h, cx - m, cy - m); g.restore();
    }
  }
}
// Los anillos: muchas elipses finas con huecos (la mitad de atrás va antes del planeta y la de adelante después).
function rings(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, tilt: number, flat: number, front: boolean, r: () => number) {
  g.save(); g.translate(cx, cy); g.rotate(tilt);
  for (let k = 0; k < 90; k++) {
    const rr = R * (1.3 + k * 0.012), gap = (k > 38 && k < 44) || (k > 70 && k < 72);
    if (gap) continue;
    const a = (0.1 + 0.25 * Math.abs(Math.sin(k * 1.7)) + r() * 0.08) * (k > 60 ? 0.6 : 1);
    const col = ramp([[0, '#f3d9a8'], [0.5, '#c79c6a'], [1, '#e9e2d0']], k / 90);
    g.strokeStyle = rgba(col, a); g.lineWidth = R * 0.013;
    g.beginPath(); g.ellipse(0, 0, rr, rr * flat, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
  }
  g.restore();
}
const gasGiant: Surface = (u, v) => {
  const t = v * 9 + fbm(u * 3 + 10, v * 3, 5, 4) * 1.6 + Math.sin(u * 7 + v * 3) * 0.05;
  const k = (Math.sin(t * 3.1) * 0.5 + 0.5) * 0.7 + fbm(u * 18, v * 30, 8, 3) * 0.3;
  const storm = Math.exp(-(((u - 0.25) / 0.09) ** 2 + ((v + 0.32) / 0.06) ** 2)); // la gran mancha
  const c = ramp([[0, '#7a4a2a'], [0.3, '#c98b55'], [0.5, '#ecd2a8'], [0.7, '#b97848'], [1, '#f6e7c8']], k);
  return { c: [c[0] * (1 - storm * 0.4) + 200 * storm * 0.4, c[1] * (1 - storm * 0.4) + 80 * storm * 0.4, c[2] * (1 - storm * 0.4) + 50 * storm * 0.4] };
};
const oceanWorld: Surface = (u, v) => {
  const h = fbm(u * 2.2 + 3, v * 2.2, 17, 6), land = h > 0.5, ice = Math.abs(v) > 0.82 - fbm(u * 4, v, 3, 3) * 0.1;
  const cl = smooth(0.5, 0.75, fbm(u * 3.5 + 9 + v * 0.8, v * 4.5, 29, 6));
  let c: RGB;
  if (ice) c = [235, 242, 250];
  else if (land) c = ramp([[0, '#3d6b2b'], [0.4, '#6b7d36'], [0.7, '#a08452'], [1, '#d8c7a3']], (h - 0.5) * 5);
  else c = ramp([[0, '#04153d'], [0.7, '#0b3c7a'], [1, '#1b7fb0']], h / 0.5);
  return { c, spec: land || ice ? 0 : 0.6, cloud: cl * 0.9 };
};
const redRock: Surface = (u, v) => {
  let k = fbm(u * 3 + 1, v * 3, 41, 6);
  for (let i = 0; i < 14; i++) { // cráteres
    const cu = Math.sin(i * 12.9898) * 0.8, cv = Math.sin(i * 78.233) * 0.7, cr = 0.05 + (i % 4) * 0.025;
    const d = Math.hypot(u - cu, (v - cv) * 1.2) / cr;
    if (d < 1.15) k += d < 0.85 ? -0.12 * (1 - d) : 0.18 * (1.15 - d) * 3;
  }
  const c = ramp([[0, '#3a160c'], [0.4, '#8f3b1c'], [0.7, '#c8683a'], [1, '#e9b38a']], k);
  return { c };
};
const iceMoon: Surface = (u, v) => {
  const k = fbm(u * 5, v * 5, 77, 5), crack = Math.abs(fbm(u * 9, v * 9, 13, 3) - 0.5) < 0.02 ? 0.55 : 1;
  const c = ramp([[0, '#7f97ad'], [0.5, '#c9dbe8'], [1, '#f4fbff']], k);
  return { c: [c[0] * crack, c[1] * crack, c[2] * (crack * 0.3 + 0.7)] };
};

// ---------- Cometas ----------
function comet(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, size: number) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(ang); g.filter = `blur(${Math.max(2, size * 0.8)}px)`;
  // cola de polvo: ancha, amarillenta y un poco curva
  const dust = g.createLinearGradient(0, 0, len, 0);
  dust.addColorStop(0, 'rgba(255,236,190,0.8)'); dust.addColorStop(0.3, 'rgba(255,210,150,0.32)'); dust.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = dust; g.beginPath(); g.moveTo(0, -size * 0.8); g.quadraticCurveTo(len * 0.5, -size * 2.5, len, len * 0.12); g.lineTo(len * 0.95, len * 0.3); g.quadraticCurveTo(len * 0.45, size * 5, 0, size * 0.8); g.closePath(); g.fill();
  // cola de iones: recta, fina y azul
  const ion = g.createLinearGradient(0, 0, len * 1.15, 0);
  ion.addColorStop(0, 'rgba(170,215,255,0.85)'); ion.addColorStop(0.5, 'rgba(90,160,255,0.3)'); ion.addColorStop(1, 'rgba(60,120,255,0)');
  g.fillStyle = ion; g.beginPath(); g.moveTo(0, -size * 0.3); g.lineTo(len * 1.15, -size * 1.6); g.lineTo(len * 1.15, size * 0.9); g.lineTo(0, size * 0.3); g.closePath(); g.fill();
  for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(190,225,255,${0.12 - i * 0.015})`; g.lineWidth = 1; g.beginPath(); g.moveTo(size, (i - 3) * size * 0.15); g.lineTo(len * (0.7 + i * 0.07), (i - 3) * size * 0.5 - size * 0.3); g.stroke(); }
  g.filter = 'none';
  // la coma y el núcleo
  glow(g, 0, 0, size * 5, [[0, 'rgba(220,245,255,0.9)'], [0.2, 'rgba(140,220,255,0.45)'], [1, 'rgba(0,0,0,0)']]);
  glow(g, 0, 0, size * 1.2, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
  g.restore();
}

// ---------- Galaxia espiral lejana ----------
function galaxy(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, tilt: number, flat: number, r: () => number) {
  g.save(); g.translate(cx, cy); g.rotate(tilt); g.scale(1, flat); g.globalCompositeOperation = 'lighter';
  glow(g, 0, 0, R * 1.1, [[0, 'rgba(255,236,200,0.5)'], [0.25, 'rgba(200,170,255,0.18)'], [1, 'rgba(0,0,0,0)']]);
  for (let i = 0; i < 2600; i++) {
    const arm = i % 2, t = r() * 3.4, a = t * 1.9 + arm * Math.PI + (r() - 0.5) * 0.5, d = R * (0.08 + t / 3.4 * 0.95) * (0.9 + r() * 0.2);
    const blue = t > 1.2 && r() < 0.35, c: RGB = blue ? [150, 190, 255] : r() < 0.15 ? [255, 120, 180] : [255, 230, 200];
    g.fillStyle = rgba(c, 0.25 + r() * 0.5); const s = 0.6 + r() * 1.3; g.fillRect(Math.cos(a) * d, Math.sin(a) * d, s, s);
  }
  glow(g, 0, 0, R * 0.22, [[0, 'rgba(255,250,235,1)'], [1, 'rgba(255,220,170,0)']]);
  g.restore();
}

// ---------- Agujero negro ----------
function blackHole(g: CanvasRenderingContext2D, cx: number, cy: number, rs: number, tilt: number, hue: 'gold' | 'violet') {
  const hot: [number, string][] = hue === 'gold'
    ? [[0, '#ffffff'], [0.15, '#fff3c4'], [0.4, '#ffb347'], [0.7, '#e2541a'], [1, 'rgba(120,20,0,0)']]
    : [[0, '#ffffff'], [0.15, '#e9dcff'], [0.4, '#b48cff'], [0.7, '#6a2fd6'], [1, 'rgba(40,0,90,0)']];
  const base: RGB = hue === 'gold' ? [255, 150, 60] : [170, 110, 255];
  g.save(); g.translate(cx, cy); g.rotate(tilt);
  // brillo grande alrededor (luz del disco dispersada)
  g.globalCompositeOperation = 'lighter';
  glow(g, 0, 0, rs * 7, [[0, rgba(base, 0.28)], [0.4, rgba(base, 0.08)], [1, 'rgba(0,0,0,0)']]);
  // el disco: anillos elípticos de adentro (blanco) hacia afuera (rojo); el lado que viene hacia nosotros brilla más
  const disk = (front: boolean) => {
    for (let k = 0; k < 70; k++) {
      const t = k / 69, rr = rs * (1.55 + t * 3.6), col = ramp(hot.slice(0, 4).map(([s, c]) => [s / 0.7, c]) as [number, string][], t * 0.95);
      const gr = g.createLinearGradient(-rr, 0, rr, 0); const a = (1 - t) ** 1.4 * 0.5 + 0.03;
      gr.addColorStop(0, rgba(col, Math.min(1, a * 1.9))); gr.addColorStop(0.5, rgba(col, a)); gr.addColorStop(1, rgba(col, a * 0.35));
      g.strokeStyle = gr; g.lineWidth = rs * 0.07 * (1 + Math.sin(k * 2.3) * 0.4);
      g.beginPath(); g.ellipse(0, 0, rr, rr * 0.2, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
    }
  };
  g.filter = `blur(${(rs * 0.025).toFixed(1)}px)`; disk(false); g.filter = 'none';
  // la luz del disco de atrás que la gravedad dobla por encima y por debajo de la sombra
  for (let k = 0; k < 14; k++) {
    const rr = rs * (1.12 + k * 0.05), a = (1 - k / 14) * 0.85;
    g.strokeStyle = rgba(ramp(hot.slice(0, 4).map(([s, c]) => [s / 0.7, c]) as [number, string][], k / 16), a); g.lineWidth = rs * 0.07;
    g.beginPath(); g.ellipse(0, 0, rr, rr * 0.98, 0, Math.PI * 0.98, Math.PI * 2.02); g.stroke(); // arriba
    g.globalAlpha = 0.45; g.beginPath(); g.ellipse(0, 0, rr * 0.92, rr * 0.86, 0, Math.PI * 0.08, Math.PI * 0.92); g.stroke(); g.globalAlpha = 1; // abajo, más tenue
  }
  // la sombra: negro total, con el anillo de fotones finito y brillante
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, rs, 0, TAU); g.fill();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = rs * 0.035; g.beginPath(); g.arc(0, 0, rs * 1.03, 0, TAU); g.stroke();
  g.strokeStyle = rgba(base, 0.6); g.lineWidth = rs * 0.09; g.beginPath(); g.arc(0, 0, rs * 1.09, 0, TAU); g.stroke();
  g.filter = `blur(${(rs * 0.025).toFixed(1)}px)`; disk(true); g.filter = 'none'; // la mitad de adelante del disco pasa por delante de la sombra
  g.restore();
}

let spaceCache: string | null = null;
export function spaceURL(): string | null {
  if (spaceCache || typeof document === 'undefined') return spaceCache;
  const W0 = 1600, H0 = 1000, c = document.createElement('canvas'); c.width = W0; c.height = H0;
  const g = c.getContext('2d'); if (!g) return null;
  const r = rng(20261028);
  const bg = g.createLinearGradient(0, 0, W0, H0); bg.addColorStop(0, '#03020c'); bg.addColorStop(0.5, '#05061a'); bg.addColorStop(1, '#020309');
  g.fillStyle = bg; g.fillRect(0, 0, W0, H0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(nebula(W0, H0, 3), 0, 0, W0, H0);
  stars(g, W0, H0, r);
  galaxy(g, W0 * 0.62, H0 * 0.13, 70, -0.5, 0.42, r);
  blackHole(g, W0 * 0.86, H0 * 0.25, 44, -0.18, 'gold');
  blackHole(g, W0 * 0.2, H0 * 0.84, 22, 0.25, 'violet');
  comet(g, W0 * 0.4, H0 * 0.1, Math.PI * 0.86, 330, 5);
  comet(g, W0 * 0.7, H0 * 0.76, Math.PI * 1.12, 240, 4);
  comet(g, W0 * 0.06, H0 * 0.48, -Math.PI * 0.2, 150, 2.8);
  // planetas: la luz viene de arriba a la izquierda
  const giant = { x: W0 * 0.1, y: H0 * 0.2, R: 120 };
  rings(g, giant.x, giant.y, giant.R, -0.32, 0.26, false, r);
  planet(g, giant.x, giant.y, giant.R, [0.85, -0.3, 0.18], gasGiant, [255, 210, 160], -0.32);
  rings(g, giant.x, giant.y, giant.R, -0.32, 0.26, true, r);
  planet(g, W0 * 0.92, H0 * 0.86, 95, [-0.8, -0.45, 0.25], oceanWorld, [110, 170, 255], 0.2);
  planet(g, W0 * 0.8, H0 * 0.64, 20, [-0.85, -0.35, 0.3], iceMoon, [200, 230, 255]);
  planet(g, W0 * 0.42, H0 * 0.93, 46, [0.55, -0.75, 0.25], redRock, [255, 140, 90]);
  planet(g, W0 * 0.3, H0 * 0.52, 9, [0.6, -0.4, 0.7], iceMoon, null);
  spaceCache = c.toDataURL('image/jpeg', 0.9);
  return spaceCache;
}
