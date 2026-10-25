// El espacio de Trepaluna, con calidad de foto: el cielo de estrellas (con colores según su temperatura, las
// más brillantes con halo y destellos en cruz), la Vía Láctea con sus nubes de polvo, planetas con luz de
// verdad (un gigante gaseoso con anillos, Marte y un planeta azul helado), meteoritos de roca con su estela de
// plasma y la Luna grande, llena de cráteres y mares. Todo lo que no se mueve se pinta una sola vez (píxel por
// píxel, con ruido y luz) a la densidad de la pantalla, y después se copia.
import { fbm, mixRGB, pixels, ramp, rgb, rng, type RGB } from './gravityBackdrops';

const TAU = Math.PI * 2;
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
// La luz del sol viene de arriba a la izquierda y un poco de adelante.
const LIGHT = (() => { const v = [-0.6, -0.45, 0.66], l = Math.hypot(...v); return v.map(n => n / l); })();
const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement) {
  let c = cache.get(key);
  if (!c) { if (cache.size > 30) cache.clear(); c = make(); cache.set(key, c); }
  return c;
}

// ---------------------------------------------------------------- Cielo de estrellas
// Un paño de estrellas del tamaño de la pantalla (se repite para arriba): muchas chiquitas, algunas medianas
// con un halo suave y unas pocas muy brillantes con destellos en cruz.
const STAR_COLORS: RGB[] = [[155, 176, 255], [170, 191, 255], [202, 215, 255], [248, 247, 255], [255, 244, 234], [255, 210, 161], [255, 204, 111]];
export function starTile(w: number, h: number) {
  const k = dpr(), W = Math.ceil(w), H = Math.ceil(h);
  return cached(`stars|${W}|${H}|${k}`, () => {
    const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const g = c.getContext('2d')!; g.scale(k, k);
    const r = rng(77), n = Math.round(W * H / 380);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, m = r() ** 6, col = STAR_COLORS[Math.floor(r() * STAR_COLORS.length)];
      const size = 0.35 + m * 1.6, a = 0.35 + m * 0.65 + r() * 0.1;
      if (m > 0.25) { // halo
        const halo = g.createRadialGradient(x, y, 0, x, y, size * 4);
        halo.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.35 * a})`); halo.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        g.fillStyle = halo; g.beginPath(); g.arc(x, y, size * 4, 0, TAU); g.fill();
      }
      g.fillStyle = `rgba(${Math.min(255, col[0] + 40)},${Math.min(255, col[1] + 40)},${Math.min(255, col[2] + 40)},${a})`;
      g.beginPath(); g.arc(x, y, size * 0.6, 0, TAU); g.fill();
      if (m > 0.6) { // destellos en cruz de las más brillantes
        g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.55)`; g.lineWidth = 0.6;
        const len = 5 + m * 9;
        g.beginPath(); g.moveTo(x - len, y); g.lineTo(x + len, y); g.moveTo(x, y - len); g.lineTo(x, y + len); g.stroke();
      }
    }
    return c;
  });
}
// La Vía Láctea: una franja en diagonal con miles de estrellitas, nubes brillantes y franjas oscuras de polvo.
export function milkyWay(w: number, h: number) {
  const W = Math.round(Math.min(480, w / 2)), H = Math.round(W * h / w);
  return cached(`milky|${W}|${H}`, () => pixels(W, H, (x, y) => {
    const u = x / W, v = y / H;
    const d = (v - (0.15 + u * 0.7)) * 3.2 + (fbm(u * 3, v * 3, 5, 4) - 0.5) * 0.9; // distancia al centro de la franja
    const band = Math.exp(-d * d * 2.2);
    if (band < 0.02) return null;
    const cloud = fbm(u * 7, v * 7, 9, 6), dust = fbm(u * 11 + 4, v * 11, 21, 5);
    const lane = Math.max(0, 1 - Math.abs(d + (dust - 0.5) * 0.6) * 4) * Math.min(1, Math.max(0.25, (dust - 0.35) * 4)); // franja de polvo oscura
    let bright = band * (0.35 + cloud * 0.9) * (1 - lane * 0.85);
    bright = Math.max(0, bright);
    const c = ramp([[0, '#3b3363'], [0.4, '#8f86c4'], [0.7, '#e9dcc9'], [1, '#fff7e6']], bright);
    const pink = Math.max(0, fbm(u * 5 + 9, v * 5, 33, 4) - 0.62) * 3 * band; // nebulosas rosadas de hidrógeno
    const out = mixRGB(c, [255, 120, 170], Math.min(0.6, pink));
    return [out[0], out[1], out[2], Math.min(200, bright * 190 + pink * 60)];
  }));
}

// ---------------------------------------------------------------- Planetas
type Kind = 'saturn' | 'mars' | 'neptune';
// Devuelve un dibujo cuadrado de 2·R·(anillos) de lado, con el centro del planeta en el medio.
export function planetImage(kind: Kind, R: number) {
  const k = dpr(), px = Math.max(16, Math.round(Math.min(R * k, 420))), ringK = kind === 'saturn' ? 2.35 : 1.2;
  return cached(`planet|${kind}|${px}`, () => {
    const seed = kind === 'saturn' ? 3 : kind === 'mars' ? 11 : 19;
    const cr = rng(seed + 5), craters = Array.from({ length: kind === 'mars' ? 40 : 0 }, () => ({ x: cr() * 2 - 1, y: cr() * 2 - 1, r: 0.02 + cr() ** 3 * 0.18 }));
    const tex = pixels(px * 2, px * 2, (x, y) => {
      const nx = (x + 0.5 - px) / px, ny = (y + 0.5 - px) / px, d2 = nx * nx + ny * ny;
      if (d2 > 1) return null;
      const nz = Math.sqrt(1 - d2), lon = Math.atan2(nx, nz), lat = Math.asin(ny);
      const light = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      let c: RGB, atmo: RGB, spec = 0;
      if (kind === 'saturn') {
        const turb = fbm(lon * 2.4, lat * 10, seed, 5);
        const bands = Math.sin(lat * 17 + turb * 4) * 0.5 + 0.5;
        c = ramp([[0, '#8a6237'], [0.3, '#c9a06a'], [0.55, '#efe0bf'], [0.8, '#d9b47c'], [1, '#f7efdc']], bands * 0.75 + fbm(lon * 7, lat * 26, seed + 3, 3) * 0.3);
        atmo = rgb('#f5deb3');
      } else if (kind === 'mars') {
        const n = fbm(lon * 1.8, lat * 1.8, seed, 6), canyon = 1 - Math.abs(fbm(lon * 2.5, lat * 5, seed + 8, 4) * 2 - 1);
        c = ramp([[0, '#5c2410'], [0.45, '#b4532a'], [0.75, '#d9874f'], [1, '#f0c39a']], n);
        c = mixRGB(c, rgb('#3b1607'), Math.max(0, canyon - 0.88) * 6);
        for (const q of craters) { const dx = (nx - q.x) / q.r, dy = (ny - q.y) / q.r, dd = Math.sqrt(dx * dx + dy * dy); if (dd < 1) c = mixRGB(c, [70, 28, 12], 0.3 * (1 - dd)); else if (dd < 1.2) c = mixRGB(c, [240, 190, 150], 0.4 * (1.2 - dd)); }
        if (Math.abs(lat) > 1.25 - fbm(lon * 3, lat, seed + 2, 3) * 0.15) c = rgb('#f8fafc'); // casquetes polares
        atmo = rgb('#fdba74');
      } else {
        const turb = fbm(lon * 2, lat * 6, seed, 5);
        c = ramp([[0, '#1e3a8a'], [0.5, '#3b82f6'], [1, '#bfdbfe']], Math.sin(lat * 9 + turb * 3) * 0.22 + 0.5 + (turb - 0.5) * 0.45);
        const sx = (lon + 0.3) / 0.3, sy = (lat - 0.35) / 0.12; c = mixRGB(c, rgb('#0b1d51'), Math.exp(-(sx * sx + sy * sy)) * 0.8); // la gran mancha oscura
        atmo = rgb('#93c5fd'); spec = 0.2;
      }
      const lit = 0.04 + Math.pow(light, 0.8) * 1.08;
      const half = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], hl = Math.hypot(...half);
      const sp = spec * Math.pow(Math.max(0, (nx * half[0] + ny * half[1] + nz * half[2]) / hl), 30) * 255;
      let out: RGB = [c[0] * lit + sp, c[1] * lit + sp, c[2] * lit + sp];
      if (atmo) out = mixRGB(out, atmo, Math.min(0.75, Math.pow(1 - nz, 2.6) * Math.min(1, light * 1.8 + 0.1)));
      const edge = Math.min(1, (1 - Math.sqrt(d2)) * px);
      return [Math.min(255, out[0]), Math.min(255, out[1]), Math.min(255, out[2]), 255 * edge];
    });
    const S = Math.ceil(px * ringK * 2), c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d')!, cx = S / 2, cy = S / 2;
    // Resplandor de la atmósfera.
    const glowC = kind === 'mars' ? '253,186,116' : kind === 'neptune' ? '147,197,253' : '245,222,179';
    const halo = g.createRadialGradient(cx, cy, px * 0.95, cx, cy, px * 1.18); halo.addColorStop(0, `rgba(${glowC},0.35)`); halo.addColorStop(1, `rgba(${glowC},0)`);
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, px * 1.18, 0, TAU); g.fill();
    const rings = (front: boolean) => {
      g.save(); g.beginPath(); if (front) g.rect(0, cy, S, S); else g.rect(0, 0, S, cy); g.clip();
      g.translate(cx, cy); g.rotate(-0.32); g.scale(1, 0.24);
      const rr = rng(seed + 11);
      for (let i = 0; i < 120; i++) {
        const rad = px * (1.3 + i * 0.0085), gap = i > 66 && i < 72 ? 0.05 : i > 100 && i < 103 ? 0.3 : 1; // la división de Cassini
        g.strokeStyle = `rgba(${ramp([[0, '#8d7452'], [0.5, '#ead9b5'], [1, '#c4a77b']], rr()).map(Math.round).join(',')},${(0.25 + rr() * 0.55) * gap})`;
        g.lineWidth = px * 0.012; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke();
      }
      g.restore();
    };
    if (kind === 'saturn') rings(false);
    g.drawImage(tex, cx - px, cy - px);
    if (kind === 'saturn') {
      // La sombra de los anillos sobre el planeta y la del planeta sobre los anillos.
      g.save(); g.beginPath(); g.arc(cx, cy, px, 0, TAU); g.clip(); g.translate(cx, cy); g.rotate(-0.32);
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-px, px * 0.2, px * 2, px * 0.09); g.restore();
      rings(true);
      g.save(); g.translate(cx, cy); g.rotate(-0.32); g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(px * 0.55, px * 0.05, px * 0.6, px * 0.22, 0, 0, TAU); g.fill(); g.restore();
    }
    return c;
  });
}
export function drawPlanet(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, R: number) {
  const img = planetImage(kind, R), k = img.width / 2 / (Math.max(16, Math.round(Math.min(R * dpr(), 420))));
  ctx.drawImage(img, x - R * k, y - R * k, R * k * 2, R * k * 2);
}

// ---------------------------------------------------------------- La Luna
// Mares oscuros de basalto, tierras altas claras, cientos de cráteres con el borde iluminado del lado del sol
// y sombra adentro, rayos claros de los cráteres jóvenes y el borde un poco más oscuro.
interface Crater { x: number; y: number; r: number; ray: boolean }
export function moonImage(R: number) {
  const px = Math.max(32, Math.round(Math.min(R * dpr(), 560)));
  return cached(`moon|${px}`, () => {
    const cr = rng(2024), craters: Crater[] = [];
    for (let i = 0; i < 320; i++) craters.push({ x: cr() * 2.2 - 1.1, y: cr() * 2.2 - 1.1, r: 0.008 + cr() ** 3.2 * 0.11, ray: false });
    craters.push({ x: -0.28, y: 0.5, r: 0.045, ray: true }, { x: 0.45, y: -0.3, r: 0.035, ray: true });
    // Reparto de los cráteres en una grilla, para no revisar todos en cada píxel.
    const G = 14, grid: Crater[][] = Array.from({ length: G * G }, () => []);
    for (const q of craters) {
      const span = q.r * 1.6;
      for (let gx = Math.floor((q.x - span + 1.1) / 2.2 * G); gx <= Math.floor((q.x + span + 1.1) / 2.2 * G); gx++)
        for (let gy = Math.floor((q.y - span + 1.1) / 2.2 * G); gy <= Math.floor((q.y + span + 1.1) / 2.2 * G); gy++)
          if (gx >= 0 && gy >= 0 && gx < G && gy < G) grid[gy * G + gx].push(q);
    }
    const rays = craters.filter(q => q.ray);
    return pixels(px * 2, px * 2, (x, y) => {
      const nx = (x + 0.5 - px) / px, ny = (y + 0.5 - px) / px, d2 = nx * nx + ny * ny;
      if (d2 > 1) return null;
      const nz = Math.sqrt(1 - d2);
      // Color: mares oscuros de basalto y tierras altas claras, con grano fino.
      const m = fbm(nx * 1.5 + 5, ny * 1.5, 7, 6), fine = fbm(nx * 30, ny * 30, 13, 3);
      const mare = Math.max(0, Math.min(1, (0.5 - m) * 5));
      let c = mixRGB(ramp([[0, '#a8a59d'], [1, '#d9d5cb']], m * 0.7 + fine * 0.5), ramp([[0, '#56575c'], [1, '#7b7b80']], fine * 0.6 + m * 0.4), mare);
      // Relieve de los cráteres: un hueco con forma de cuenco y el borde levantado (el pico central en los
      // grandes). Se suma la pendiente de cada uno y con eso se calcula la luz de verdad.
      let gx = 0, gy = 0;
      const cell = grid[Math.min(G - 1, Math.floor((ny + 1.1) / 2.2 * G)) * G + Math.min(G - 1, Math.floor((nx + 1.1) / 2.2 * G))];
      for (const q of cell) {
        const dx = (nx - q.x) / q.r, dy = (ny - q.y) / q.r, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > 1.6 || dd < 1e-4) continue;
        // altura: -cuenco(dd) + borde(dd) (+ pico central en los grandes); "slope" es cuánto sube al alejarse
        const bowl = Math.exp(-((dd / 0.78) ** 4)), rim = Math.exp(-(((dd - 1) / 0.2) ** 2));
        let slope = bowl * 4 * dd ** 3 / 0.78 ** 4 - 0.4 * rim * 2 * (dd - 1) / 0.04;
        if (q.r > 0.06) slope -= 0.25 * 2 * dd / 0.02 * Math.exp(-dd * dd / 0.02);
        const k = 0.28 * slope / dd;
        gx += k * dx; gy += k * dy;
        if (dd < 1) c = mixRGB(c, [70, 70, 74], 0.12 * (1 - dd)); // el fondo un poco más oscuro
      }
      for (const q of rays) { // rayos claros de los cráteres jóvenes
        const dx = nx - q.x, dy = ny - q.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const streak = Math.pow(Math.max(0, Math.sin(ang * 11 + fbm(ang * 3, 0, 40, 2) * 6)), 10) * Math.max(0, 1 - dist / 0.7);
        c = mixRGB(c, [238, 236, 228], Math.min(0.35, streak * 0.45 + (dist < q.r * 1.5 ? 0.35 : 0)));
      }
      let lx = nx - gx * 0.35, ly = ny - gy * 0.35, lz = nz; const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
      const light = Math.max(0, lx * LIGHT[0] + ly * LIGHT[1] + lz * LIGHT[2]);
      const lit = 0.1 + Math.pow(light, 0.85) * 1.05;
      const edge = Math.min(1, (1 - Math.sqrt(d2)) * px);
      return [Math.min(255, c[0] * lit), Math.min(255, c[1] * lit), Math.min(255, c[2] * lit), 255 * edge];
    });
  });
}
export function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  const glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.25);
  glow.addColorStop(0, 'rgba(254,249,220,0.35)'); glow.addColorStop(1, 'rgba(254,249,220,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, TAU); ctx.fill();
  ctx.drawImage(moonImage(R), cx - R, cy - R, R * 2, R * 2);
}

// ---------------------------------------------------------------- Meteoritos
// Roca irregular con cráteres y luz de costado.
function rockImage(R: number, seed: number) {
  const px = Math.max(10, Math.round(Math.min(R * dpr(), 160)));
  return cached(`rock|${px}|${seed}`, () => pixels(px * 2, px * 2, (x, y) => {
    const nx = (x + 0.5 - px) / px, ny = (y + 0.5 - px) / px, a = Math.atan2(ny, nx);
    const rad = 0.78 + (fbm(Math.cos(a) * 1.5 + 3, Math.sin(a) * 1.5, seed, 4) - 0.5) * 0.5;
    const d = Math.hypot(nx, ny) / rad;
    if (d > 1) return null;
    const nz = Math.sqrt(Math.max(0, 1 - d * d));
    const bump = fbm(nx * 6, ny * 6, seed + 3, 5), pit = fbm(nx * 14, ny * 14, seed + 7, 3);
    const light = Math.max(0, (nx / rad) * LIGHT[0] + (ny / rad) * LIGHT[1] + nz * LIGHT[2]);
    const c = ramp([[0, '#2b2522'], [0.5, '#5b524c'], [1, '#9a8f86']], bump * 0.9 + (pit > 0.62 ? -0.25 : 0));
    const lit = 0.18 + light * 1.1, edge = Math.min(1, (1 - d) * px * rad);
    return [Math.min(255, c[0] * lit), Math.min(255, c[1] * lit), Math.min(255, c[2] * lit), 255 * edge];
  }));
}
// El meteorito en vuelo: estela de plasma (blanca y amarilla en la cabeza, naranja y roja después), chispas
// que se desprenden, humo y la roca que gira, con el frente al rojo vivo.
export function drawMeteor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, t: number, id: number) {
  const R = s * 0.5, tail = s * 4.2;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 3); glow.addColorStop(0, 'rgba(255,170,80,0.55)'); glow.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 3, 0, TAU); ctx.fill();
  for (const [len, wid, c0, c1] of [[1, 1.15, 'rgba(255,90,40,0.5)', 'rgba(160,20,10,0)'], [0.75, 0.8, 'rgba(255,170,60,0.7)', 'rgba(255,90,30,0)'], [0.45, 0.45, 'rgba(255,250,220,0.95)', 'rgba(255,200,90,0)']] as const) {
    const L = tail * len, W = R * wid, g = ctx.createLinearGradient(0, 0, -L, 0); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(R * 0.3, -W);
    for (let i = 1; i <= 10; i++) { const k = i / 10; ctx.lineTo(-L * k, -W * (1 - k) ** 0.7 + Math.sin(t * 30 + i * 1.3 + id) * W * 0.12 * k); }
    for (let i = 10; i >= 1; i--) { const k = i / 10; ctx.lineTo(-L * k, W * (1 - k) ** 0.7 + Math.sin(t * 27 + i * 1.7 + id) * W * 0.12 * k); }
    ctx.lineTo(R * 0.3, W); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 14; i++) { // chispas
    const k = (t * (1.5 + (i % 5) * 0.3) + i * 0.137) % 1, sx = -tail * (0.1 + k * 0.9), sy = Math.sin(i * 12.9 + id) * R * (0.3 + k * 1.2);
    ctx.fillStyle = `rgba(255,${200 - k * 120},${120 - k * 100},${1 - k})`; ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, R * 0.09 * (1 - k)), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 4; i++) { // humo
    const k = (t * 0.8 + i / 4) % 1, sx = -tail * (0.6 + k * 0.6), sr = R * (0.5 + k * 1.3);
    const sm = ctx.createRadialGradient(sx, 0, 0, sx, 0, sr); sm.addColorStop(0, `rgba(90,80,80,${0.25 * (1 - k)})`); sm.addColorStop(1, 'rgba(90,80,80,0)');
    ctx.fillStyle = sm; ctx.beginPath(); ctx.arc(sx, Math.sin(t * 2 + i) * R * 0.3, sr, 0, TAU); ctx.fill();
  }
  ctx.save(); ctx.rotate(t * 2.2 + id); ctx.drawImage(rockImage(R, id % 5), -R, -R, R * 2, R * 2); ctx.restore();
  const hot = ctx.createRadialGradient(R * 0.6, 0, 0, R * 0.6, 0, R * 0.9); hot.addColorStop(0, 'rgba(255,220,150,0.85)'); hot.addColorStop(0.5, 'rgba(255,120,40,0.45)'); hot.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(R * 0.6, 0, R * 0.9, 0, TAU); ctx.fill(); // el frente al rojo vivo
  ctx.restore();
}

// Pinta de antemano lo más pesado (la Luna, los planetas, las estrellas), en la pantalla de inicio, para que
// en el juego no se trabe al llegar al espacio.
export function prewarmSpace(w: number, h: number, s: number, moonR: number) {
  starTile(w, h); milkyWay(w, h);
  const unit = Math.min(w, h);
  planetImage('saturn', unit * 0.11); planetImage('mars', unit * 0.055); planetImage('neptune', unit * 0.035);
  moonImage(s * moonR);
  for (let i = 0; i < 5; i++) rockImage(s * 0.5, i);
}
