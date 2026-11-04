// Los vampiros de Vampyrium con el diseño de la lámina de referencia: de tres cuartos mirando a la derecha (como
// el cazador), musculosos, cabeza grande con colmillos y ojos rojos; negro con ribetes dorados y rojo carmesí;
// rodillas y codos con rodilleras y coderas en punta. Las poses salen de cinemática inversa: los pies en el piso y
// las manos donde agarran (el martillo, el báculo, la espada). El hombre lobo y el dragón van en cuatro patas.
// En metros, pies en (0, 0) y "arriba" negativo.
// La luz principal viene de arriba a la izquierda (la luna) y una luz roja por detrás (el fuego del castillo).
import { darken, grain, lighten } from './gravityMonsters';
import { vampEye } from './vampyriumChars';
import { ATTACK, type Vamp } from './vampyrium';

type Pt = [number, number];
const TAU = Math.PI * 2;
const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];
const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const LX = -0.55, LY = -0.83; // hacia dónde está la luz
// La textura de grano es cara (un recorte por cada parte): en el juego va sin textura; en los carteles, con textura.
let VAMP_TEX = true;
export const setVampTexture = (on: boolean) => { VAMP_TEX = on; };
const RIM = 'rgba(255,70,80,0.75)';
const INK = '#07050a';

// ---------------------------------------------------------------- Herramientas
// Un contorno suave que pasa cerca de los puntos (cerrado).
function smooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  const n = pts.length; let m = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i]; m = mid(p, pts[(i + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  ctx.closePath();
}
// Puntos con esquina (true) o curva: [x, y, 1] = esquina.
function shapePath(ctx: CanvasRenderingContext2D, pts: (Pt | [number, number, number])[]) {
  const n = pts.length, P = (i: number) => pts[(i + n) % n], sharp = (i: number) => (P(i) as number[])[2] === 1;
  const start = sharp(0) ? P(0) : mid(P(-1) as Pt, P(0) as Pt);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = P(i), q = P(i + 1);
    if (sharp(i)) { if (i > 0) ctx.lineTo(p[0], p[1]); if (!sharp(i + 1)) { const m = mid(p as Pt, q as Pt); ctx.lineTo(m[0], m[1]); } }
    else { const e = sharp(i + 1) ? q : mid(p as Pt, q as Pt); ctx.quadraticCurveTo(p[0], p[1], e[0], e[1]); }
  }
  ctx.closePath();
}
interface Form { hi?: number; lo?: number; rim?: number; ao?: number; lw?: number; line?: string; tex?: number }
// Rellena con volumen: degradé desde el lado de la luz, sombra suave en los bordes, luz roja de contorno y línea fina.
function form(ctx: CanvasRenderingContext2D, path: () => void, base: string, c: Pt, r: number, o: Form = {}) {
  ctx.beginPath(); path();
  const g = ctx.createLinearGradient(c[0] + LX * r, c[1] + LY * r, c[0] - LX * r, c[1] - LY * r);
  g.addColorStop(0, lighten(base, o.hi ?? 0.28)); g.addColorStop(0.45, base); g.addColorStop(1, darken(base, o.lo ?? 0.65));
  ctx.fillStyle = g; ctx.fill();
  if (VAMP_TEX) grain(ctx, path, o.tex ?? 0.22);
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  if ((o.ao ?? 1) > 0) { ctx.lineWidth = r * 0.22 * (o.ao ?? 1); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.stroke(); }
  if ((o.rim ?? 1) > 0) {
    const rg = ctx.createLinearGradient(c[0] + LX * r, c[1] + LY * r, c[0] - LX * r, c[1] - LY * r);
    rg.addColorStop(0, 'rgba(255,70,80,0)'); rg.addColorStop(0.6, 'rgba(255,70,80,0)'); rg.addColorStop(1, RIM);
    ctx.globalAlpha = o.rim ?? 1; ctx.lineWidth = r * 0.12; ctx.strokeStyle = rg; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.restore();
  if ((o.lw ?? 1) > 0) { ctx.lineWidth = 0.012 * (o.lw ?? 1); ctx.strokeStyle = o.line ?? INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}
// Un tramo de brazo o pierna con músculo: anchos en varias estaciones a lo largo del hueso (bulge: hacia qué lado engorda).
function tubePts(a: Pt, b: Pt, w: number[], bulge = 0): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-4, nx = -dy / l, ny = dx / l, n = w.length - 1;
  const L: Pt[] = [], R: Pt[] = [];
  w.forEach((wi, i) => { const k = i / n, p = lerp(a, b, k), s = Math.sin(k * Math.PI) * bulge; L.push([p[0] + nx * wi * (0.5 + s), p[1] + ny * wi * (0.5 + s)]); R.push([p[0] - nx * wi * (0.5 - s), p[1] - ny * wi * (0.5 - s)]); });
  const capA: Pt = [a[0] - dx / l * w[0] * 0.45, a[1] - dy / l * w[0] * 0.45], capB: Pt = [b[0] + dx / l * w[n] * 0.45, b[1] + dy / l * w[n] * 0.45];
  return [capA, ...L, capB, ...R.reverse()];
}
function tube(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number[], base: string, o: Form & { bulge?: number } = {}) {
  const pts = tubePts(a, b, w, o.bulge ?? 0);
  form(ctx, () => smooth(ctx, pts), base, mid(a, b), Math.max(...w) * 0.9 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.15, o);
}
const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) => {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
};
const line = (ctx: CanvasRenderingContext2D, pts: Pt[], w: number, c: string) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
const curve = (ctx: CanvasRenderingContext2D, a: Pt, c: Pt, b: Pt, w: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke(); };
const shadowOn = (ctx: CanvasRenderingContext2D, v: Vamp, r: number) => { if (!v.onGround) return; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.save(); ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.restore(); ctx.fill(); };
function gem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, setting = '#c9a24a') {
  ctx.fillStyle = setting; ctx.beginPath(); ctx.ellipse(x, y, r * 1.35, r * 1.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.25; ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r); g.addColorStop(0, '#ffb0b8'); g.addColorStop(0.35, '#e0102a'); g.addColorStop(1, '#4a0008');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.15, 0, 0, TAU); ctx.fill();
  glow(ctx, x, y, r * 3, '#ff2040', 0.35 + 0.15 * Math.sin(t * 3));
}

// ---------------------------------------------------------------- El esqueleto (todos los humanoides)
interface Body { hip: Pt; neck: Pt; spine: Pt; side: Pt; hp: [Pt, Pt]; sh: [Pt, Pt]; knee: [Pt, Pt]; foot: [Pt, Pt]; elbow: [Pt, Pt]; hand: [Pt, Pt] }
interface Dims { thigh: number; shin: number; spine: number; upper: number; fore: number; shW: number; hipW?: number } // (shW negativo: el lado de atrás queda para adelante)
const HUMAN: Dims = { thigh: 0.47, shin: 0.45, spine: 0.6, upper: 0.32, fore: 0.29, shW: 0.19 };




// ---------------------------------------------------------------- Poses naturales (cinemática inversa)
// Se dicen dónde van los pies (en el piso) y las manos (lo que agarran), y las rodillas y los codos se acomodan solos:
// las rodillas doblan hacia adelante y los codos hacia abajo y atrás, como un cuerpo de verdad.
interface Pose2 { lean: number; crouch: number; bob: number; head: number; feet: [Pt, Pt]; hands: [Pt, Pt]; abs?: [boolean, boolean]; elbows?: [number, number] }
function ik(a: Pt, target: Pt, l1: number, l2: number, dir: number): [Pt, Pt] {
  const dx = target[0] - a[0], dy = target[1] - a[1], d = Math.max(1e-4, Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3)), ang = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), j: Pt = [a[0] + Math.cos(ang + dir * off) * l1, a[1] + Math.sin(ang + dir * off) * l1];
  const tx = target[0] - j[0], ty = target[1] - j[1], tl = Math.hypot(tx, ty) || 1;
  return [j, [j[0] + tx / tl * l2, j[1] + ty / tl * l2]];
}
function solve2(p: Pose2, d: Dims): Body {
  d = { ...d, shW: d.shW * BROAD };
  const L = d.thigh + d.shin, hip: Pt = [0, -L * (1 - p.crouch) + p.bob];
  const spine: Pt = [Math.sin(p.lean), -Math.cos(p.lean)], side: Pt = [Math.cos(p.lean), Math.sin(p.lean)];
  const neck = add(hip, spine, d.spine), k = d.shW / 0.19;
  const sh: [Pt, Pt] = [add(add(hip, spine, d.spine - 0.06), side, -d.shW), add(add(hip, spine, d.spine - 0.07), side, d.shW * 0.85)];
  const kh = d.hipW !== undefined ? d.hipW * BROAD / 0.19 : k, hp: [Pt, Pt] = [add(hip, side, -0.09 * kh), add(hip, side, 0.09 * kh)];
  const knee: Pt[] = [], foot: Pt[] = [], elbow: Pt[] = [], hand: Pt[] = [];
  for (let i = 0; i < 2; i++) {
    [knee[i], foot[i]] = ik(hp[i], p.feet[i], d.thigh, d.shin, -1);
    const target = p.abs?.[i] ? p.hands[i] : add(sh[i], p.hands[i], 1);
    [elbow[i], hand[i]] = ik(sh[i], target, d.upper, d.fore, p.elbows?.[i] ?? 1);
  }
  return { hip, neck, spine, side, hp, sh, knee: knee as [Pt, Pt], foot: foot as [Pt, Pt], elbow: elbow as [Pt, Pt], hand: hand as [Pt, Pt] };
}
// Los pies: parado firme (un pie adelante), caminando (paso con el pie que se levanta) o en el aire (recogidos).
function stance(v: Vamp, t: number, o: { wide?: number; crouch?: number; lean?: number; lift?: number } = {}): Pick<Pose2, 'lean' | 'crouch' | 'bob' | 'head' | 'feet'> {
  const s = Math.sin, wd = o.wide ?? 1, br = s(t * 2.2 + v.id), lean = o.lean ?? 0.06;
  if (!v.onGround) return { lean: lean + 0.08, crouch: 0.05, bob: 0, head: 0, feet: [[-0.25, -0.3], [0.2, -0.38]] };
  if (Math.abs(v.vx) > 0.3) { const w = v.walkT * 3.0; return { lean: lean + 0.07, crouch: (o.crouch ?? 0.06) + 0.02, bob: -Math.abs(s(w)) * 0.03, head: 0.05, feet: [[0.0 - 0.28 * s(w) * wd, -Math.max(0, -Math.cos(w)) * (o.lift ?? 0.13)], [0.04 + 0.28 * s(w) * wd, -Math.max(0, Math.cos(w)) * (o.lift ?? 0.13)]] }; }
  return { lean, crouch: (o.crouch ?? 0.06) + br * 0.006, bob: 0, head: 0.04, feet: [[-0.22 * wd, 0], [0.26 * wd, 0]] };
}
// Los brazos del ataque: suben por arriba de la cabeza y bajan de golpe hacia adelante (un zarpazo de arriba hacia
// abajo, justo cuando pega); en el aire, los brazos suben de abajo hacia arriba.
const ease = (k: number) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); };
const lerpPt = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
function swipeArms(v: Vamp, base: [Pt, Pt], o: { up?: [Pt, Pt]; hit?: [Pt, Pt]; walk?: boolean } = {}): [Pt, Pt] {
  const up: [Pt, Pt] = o.up ?? [[0.02, -0.6], [0.24, -0.62]], hit: [Pt, Pt] = o.hit ?? [[0.42, 0.34], [0.56, 0.26]];
  if (v.state === 'claw') {
    const a = ATTACK[v.kind] ?? { at: 0.36, dur: 0.7 }, w0 = Math.max(0.1, a.at - 0.13), t = v.t;
    if (t < w0) { const k = ease(t / w0); return [lerpPt(base[0], up[0], k), lerpPt(base[1], up[1], k)]; } // levanta las garras
    if (t < a.at + 0.03) { const k = ease((t - w0) / (a.at + 0.03 - w0)); return [lerpPt(up[0], hit[0], k), lerpPt(up[1], hit[1], k)]; } // ¡zarpazo!
    const k = ease((t - a.at - 0.03) / Math.max(0.1, a.dur - a.at - 0.03)); return [lerpPt(hit[0], base[0], k), lerpPt(hit[1], base[1], k)];
  }
  if (!v.onGround && v.kind !== 'flyer') { const k = ease(Math.min(1, 0.35 + Math.max(0, -v.vy) * 0.08 + (v.vy > 0 ? 1 - Math.min(1, v.vy / 14) : 0.65))); return [lerpPt(base[0], [-0.16, -0.56], k), lerpPt(base[1], [0.26, -0.58], k)]; } // saltando: brazos arriba
  if (o.walk !== false && v.onGround && Math.abs(v.vx) > 0.3) { // caminando: los brazos se balancean al revés que las piernas (el de adelante sube un poco)
    const w = v.walkT * 3.0, a = Math.sin(w) * 0.26;
    return [[base[0][0] + a, base[0][1] - Math.abs(a) * 0.35 + (a > 0 ? -0.04 : 0)], [base[1][0] - a, base[1][1] - Math.abs(a) * 0.35 + (a < 0 ? -0.04 : 0)]];
  }
  return base;
}
// La estela del zarpazo: tres rayas rojas y blancas en curva adelante del vampiro, justo cuando pega.
export function clawTrail(ctx: CanvasRenderingContext2D, v: Vamp, top = -1.75, bottom = -0.35, x = 0.55) {
  const a = ATTACK[v.kind]; if (v.state !== 'claw' || !a) return;
  const k = (v.t - (a.at - 0.06)) / 0.2; if (k < 0 || k > 1) return;
  const fade = 1 - k, len = Math.min(1, k * 2.5);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const ox = x + i * 0.12, y0 = top + i * 0.05, y1 = y0 + (bottom - top) * len;
    for (const [w, c] of [[0.11, `rgba(180,0,20,${0.45 * fade})`], [0.045, `rgba(255,235,235,${0.95 * fade})`]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ox - 0.1, y0); ctx.quadraticCurveTo(ox + 0.32, (y0 + y1) / 2, ox + 0.08, y1); ctx.stroke(); }
  }
  ctx.restore();
}
const vec = (a: Pt, b: Pt): Pt => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// Un puño cerrado que agarra un palo (mango, báculo, empuñadura): los dedos dan la vuelta por delante del palo.
function gripFist(ctx: CanvasRenderingContext2D, c: Pt, along: Pt, color: string, back: boolean, metal = false, size = 1) {
  const col = dk(color, back, 0.35), ang = Math.atan2(along[0], along[1]);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-ang); ctx.scale(size, size); // el palo queda vertical (local y)
  form(ctx, () => ctx.roundRect(-0.075, -0.06, 0.15, 0.12, 0.035), darken(col, 0.1), [0, 0], 0.09, { rim: 0, lw: 0.8, tex: metal ? 0.3 : 0.15 }); // el dorso
  for (let k = 0; k < 4; k++) { const y = -0.05 + k * 0.033; form(ctx, () => ctx.roundRect(-0.065, y - 0.016, 0.135, 0.032, 0.016), lighten(col, 0.04 - k * 0.02), [0, y], 0.07, { rim: 0, ao: 0, lw: 0.6, hi: metal ? 0.5 : 0.25 }); } // dedos cerrados
  if (!metal) { ctx.fillStyle = back ? '#050305' : '#2a0810'; for (let k = 0; k < 4; k++) { const y = -0.05 + k * 0.033; ctx.beginPath(); ctx.ellipse(0.068, y, 0.014, 0.01, 0, 0, TAU); ctx.fill(); } } // las uñas asoman
  form(ctx, () => ctx.ellipse(-0.06, 0.07, 0.035, 0.05, -0.6, 0, TAU), col, [-0.06, 0.07], 0.05, { rim: 0, ao: 0, lw: 0.6 }); // el pulgar arriba (del lado de la punta del palo)
  ctx.restore();
}

// ---------------------------------------------------------------- Partes
const dk = (c: string, back: boolean, k = 0.38) => back ? darken(c, k) : c;

// Bota alta de montar, puntiaguda, con hebilla.
// Mano con garras: palma, cuatro dedos largos con nudillos y uñas negras afiladas, y el pulgar.
// La mano con garras: dorso huesudo, cuatro dedos largos y finos (un solo trazo que se afina y se curva un poco)
// y una uña larga, oscura y en gancho en cada uno; el pulgar al costado. Simple y clara a cualquier tamaño.
function clawHand(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, skin: string, back: boolean, curl = 0.5, nail = '#1a0a0e', size = 1) {
  const sk = dk(skin, back, 0.3), c = Math.min(1, Math.max(0, curl));
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(size, size);
  const fingers: [Pt, Pt][] = [];
  for (let k = 0; k < 4; k++) { // dedos abiertos en abanico (abajo = hacia donde apunta el brazo)
    const a0 = (k - 1.5) * 0.24, base: Pt = [-0.045 + k * 0.03, 0.06], len = [0.11, 0.13, 0.125, 0.1][k];
    const midP = add(base, dirv(a0 + c * 0.35), len * 0.55), tip = add(midP, dirv(a0 + c * 0.9), len * 0.45);
    fingers.push([midP, tip]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[0.036, INK], [0.026, darken(sk, 0.12 + 0.04 * k)]] as const) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.quadraticCurveTo(midP[0], midP[1], tip[0], tip[1]); ctx.stroke(); }
    if (!back) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(base[0] - 0.005, base[1]); ctx.quadraticCurveTo(midP[0] - 0.006, midP[1], tip[0] - 0.005, tip[1]); ctx.stroke(); }
    // la uña: larga, curva hacia adentro, oscura con un brillo
    const fdir = vec(midP, tip), nd: Pt = fdir, nn: Pt = [nd[1], -nd[0]], nt = add(add(tip, nd, 0.06), nn, -0.025);
    ctx.beginPath(); ctx.moveTo(tip[0] + nn[0] * 0.016, tip[1] + nn[1] * 0.016); ctx.quadraticCurveTo(...add(add(tip, nd, 0.05), nn, 0.012), nt[0], nt[1]); ctx.quadraticCurveTo(...add(add(tip, nd, 0.025), nn, -0.012), tip[0] - nn[0] * 0.016, tip[1] - nn[1] * 0.016); ctx.closePath();
    ctx.fillStyle = back ? '#0a0608' : nail; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.005; ctx.stroke();
    if (!back) { ctx.strokeStyle = 'rgba(255,220,220,0.5)'; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(...add(tip, nn, 0.006)); ctx.quadraticCurveTo(...add(add(tip, nd, 0.045), nn, 0.01), nt[0], nt[1]); ctx.stroke(); }
  }
  form(ctx, () => smooth(ctx, [[-0.055, -0.04], [0.045, -0.045], [0.065, 0.02], [0.05, 0.075], [-0.06, 0.075], [-0.07, 0.015]]), sk, [0, 0.01], 0.08, { rim: 0, lw: 1, tex: 0.2 }); // el dorso
  ctx.strokeStyle = 'rgba(40,20,50,0.35)'; ctx.lineWidth = 0.006; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-0.02 + k * 0.016, -0.02); ctx.lineTo(-0.045 + k * 0.03, 0.06); ctx.stroke(); } // tendones
  { const tb: Pt = [0.05, 0.0], tm = add(tb, dirv(0.9 + c * 0.3), 0.06), tt = add(tm, dirv(0.5 + c * 0.8), 0.04); for (const [w, col] of [[0.034, INK], [0.024, darken(sk, 0.08)]] as const) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tb[0], tb[1]); ctx.quadraticCurveTo(tm[0], tm[1], tt[0], tt[1]); ctx.stroke(); } const nt = add(tt, dirv(0.4 + c), 0.05); ctx.fillStyle = back ? '#0a0608' : nail; ctx.beginPath(); ctx.moveTo(tt[0] - 0.012, tt[1]); ctx.quadraticCurveTo(nt[0] + 0.01, nt[1] - 0.02, nt[0], nt[1]); ctx.lineTo(tt[0] + 0.012, tt[1] + 0.006); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.005; ctx.stroke(); } // el pulgar
  ctx.restore();
}
// Puño con guantelete de placas (para los que llevan armadura).
function gauntlet(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, metal: string, back: boolean, size = 1) {
  const m = dk(metal, back);
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(size, size);
  form(ctx, () => ctx.roundRect(-0.07, -0.06, 0.14, 0.09, 0.02), m, [0, -0.02], 0.09, { rim: 0 }); // manopla
  form(ctx, () => ctx.roundRect(-0.075, 0.02, 0.15, 0.1, 0.035), darken(m, 0.1), [0, 0.06], 0.09, { rim: 0 });
  for (let k = 0; k < 4; k++) form(ctx, () => ctx.ellipse(-0.05 + k * 0.033, 0.11, 0.019, 0.022, 0, 0, TAU), lighten(m, 0.08), [-0.05 + k * 0.033, 0.11], 0.025, { rim: 0, ao: 0, lw: 0.5 });
  form(ctx, () => ctx.ellipse(0.07, 0.04, 0.03, 0.05, -0.4, 0, TAU), m, [0.07, 0.04], 0.05, { rim: 0, ao: 0, lw: 0.6 }); // pulgar
  ctx.restore();
}
// Manga del frac (brazo y antebrazo) con el puño de puntilla blanca.
// Pierna con pantalón y bota.
// La capa de cuello alto: cae de los dos hombros por detrás; del lado izquierdo se da vuelta y muestra el forro rojo.
// ---------------------------------------------------------------- Cabezas (perfil, mirando a la derecha; 1 = media cabeza)
// La cara de un vampiro noble: cráneo largo, pómulos hundidos, nariz aguileña, oreja en punta, ojo rojo que brilla.
interface HeadOpts { skin: string; open: number; hair?: 'slick' | 'wild' | 'long' | 'none'; hairC?: string; beard?: boolean; ear?: number; gaunt?: number }
// De tres cuartos mirando a la derecha (como el cazador): los dos ojos, la nariz hacia la derecha y la oreja izquierda en punta.
function vampFace(ctx: CanvasRenderingContext2D, t: number, o: HeadOpts) {
  const sk = o.skin, open = o.open, hc = o.hairC ?? '#15111a', ek = o.ear ?? 1, gaunt = o.gaunt ?? 1;
  // la oreja izquierda en punta
  form(ctx, () => shapePath(ctx, [[-0.62, 0.35], [-0.86, 0.1], [-1.0 - ek * 0.15, -0.4 - ek * 0.3, 1], [-0.78, -0.15], [-0.6, -0.05]]), sk, [-0.8, 0], 0.4, { hi: 0.2, lw: 1.2, rim: 0.5 });
  ctx.strokeStyle = 'rgba(90,30,60,0.55)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.66, 0.25); ctx.quadraticCurveTo(-0.84, 0.0, -0.92 - ek * 0.1, -0.32 - ek * 0.22); ctx.stroke();
  const head: (Pt | [number, number, number])[] = [[-0.74, 0.1], [-0.8, -0.35], [-0.58, -0.82], [0.0, -1.0], [0.52, -0.8], [0.72, -0.38], [0.76, -0.16], [0.7, 0.18], [0.62, 0.52], [0.42, 0.85], [0.22, 0.98 + open * 0.15], [-0.12, 0.88], [-0.48, 0.6]];
  const headP = () => shapePath(ctx, head);
  form(ctx, headP, sk, [0.15, -0.25], 1.1, { hi: 0.25, lo: 0.55, lw: 1.6 });
  ctx.save(); ctx.beginPath(); headP(); ctx.clip();
  ctx.fillStyle = `rgba(50,20,70,${0.32 * gaunt})`; // mejillas hundidas (las dos)
  for (const [cx, w] of [[-0.35, 0.22], [0.6, 0.12]] as const) { ctx.beginPath(); ctx.moveTo(cx - w * 0.3, 0.05); ctx.quadraticCurveTo(cx + w * 0.6, 0.3, cx + w * 0.2, 0.62); ctx.quadraticCurveTo(cx - w * 0.8, 0.45, cx - w * 0.3, 0.05); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.ellipse(-0.3, 0.02, 0.22, 0.07, -0.2, 0, TAU); ctx.fill(); // pómulo
  ctx.fillStyle = 'rgba(40,10,60,0.42)'; for (const [x, rx] of [[-0.12, 0.22], [0.5, 0.15]] as const) { ctx.beginPath(); ctx.ellipse(x, -0.1, rx, 0.14, 0, 0, TAU); ctx.fill(); } // cuencas
  ctx.strokeStyle = 'rgba(40,15,60,0.32)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.3, -0.45); ctx.quadraticCurveTo(0.1, -0.5, 0.45, -0.42); ctx.stroke(); // arruga de la frente
  ctx.restore();
  // nariz aguileña hacia la derecha
  form(ctx, () => shapePath(ctx, [[0.2, -0.08], [0.3, 0.08], [0.48, 0.3, 1], [0.4, 0.36], [0.28, 0.34], [0.24, 0.2]]), sk, [0.3, 0.15], 0.25, { rim: 0, lw: 0.6, ao: 0.6, hi: 0.1 });
  ctx.fillStyle = 'rgba(40,10,40,0.55)'; ctx.beginPath(); ctx.ellipse(0.36, 0.35, 0.05, 0.025, 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,15,60,0.4)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.22, 0.38); ctx.quadraticCurveTo(0.1, 0.45, 0.05, 0.55); ctx.moveTo(0.52, 0.38); ctx.quadraticCurveTo(0.6, 0.46, 0.58, 0.56); ctx.stroke(); // surcos
  // ojos rojos con párpado y cejas fruncidas
  for (const [x, rx] of [[-0.12, 0.15], [0.5, 0.1]] as const) {
    ctx.fillStyle = '#1a0610'; ctx.beginPath(); ctx.moveTo(x - rx, -0.08); ctx.quadraticCurveTo(x, -0.2, x + rx, -0.1); ctx.quadraticCurveTo(x, -0.01, x - rx, -0.08); ctx.fill();
    vampEye(ctx, x + rx * 0.1, -0.09, rx * 0.85, 0.075, t);
    ctx.strokeStyle = '#120810'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(x - rx * 1.1, -0.1); ctx.quadraticCurveTo(x, -0.22, x + rx * 1.1, -0.12); ctx.stroke();
  }
  ctx.strokeStyle = darken(hc, 0.1); ctx.lineWidth = 0.075; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.38, -0.36); ctx.lineTo(0.08, -0.22); ctx.moveTo(0.36, -0.22); ctx.lineTo(0.66, -0.34); ctx.stroke();
  // boca: labios finos, colmillos en las dos puntas
  const my = 0.46; // la boca más arriba
  ctx.fillStyle = '#2a0610'; ctx.beginPath(); ctx.moveTo(-0.02, my); ctx.quadraticCurveTo(0.25, my - 0.06, 0.52, my - 0.01); ctx.quadraticCurveTo(0.26, my + 0.02 + open * 0.35, -0.02, my); ctx.fill();
  if (open > 0.1) { ctx.fillStyle = '#7a1020'; ctx.beginPath(); ctx.ellipse(0.25, my + open * 0.2, 0.15, 0.05 * open + 0.01, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fbf8f0'; for (const x of [0.04, 0.44]) { ctx.beginPath(); ctx.moveTo(x - 0.065, my - 0.035); ctx.quadraticCurveTo(x - 0.025, my + 0.16, x + 0.005, my + 0.38 + open * 0.1); ctx.quadraticCurveTo(x + 0.03, my + 0.1, x + 0.05, my - 0.035); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.016; ctx.stroke(); } // colmillos grandes
  ctx.strokeStyle = darken(sk, 0.45); ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.04, my); ctx.quadraticCurveTo(0.25, my - 0.06, 0.54, my - 0.01); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,15,60,0.3)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.1, 0.8); ctx.quadraticCurveTo(0.25, 0.86, 0.38, 0.8); ctx.stroke(); // mentón
  // pelo
  if (o.hair === 'slick' || o.hair === undefined) { // peinado para atrás con pico en la frente
    const hair = () => shapePath(ctx, [[-0.74, 0.25], [-0.86, -0.4], [-0.58, -0.92], [0.0, -1.1], [0.55, -0.88], [0.72, -0.5], [0.55, -0.56], [0.36, -0.6, 1], [0.16, -0.36, 1], [0.0, -0.6], [-0.4, -0.55], [-0.62, -0.2]]);
    form(ctx, hair, hc, [-0.2, -0.75], 0.9, { hi: 0.4, lw: 1.3 });
    ctx.save(); ctx.beginPath(); hair(); ctx.clip(); for (let k = 0; k < 14; k++) curve(ctx, [0.6 - k * 0.04, -0.6 - k * 0.03], [0.2 - k * 0.05, -1.05], [-0.8, -0.5 + k * 0.06], 0.012, k % 3 ? 'rgba(0,0,0,0.5)' : 'rgba(170,150,210,0.35)'); ctx.restore();
  } else if (o.hair === 'wild') {
    form(ctx, () => shapePath(ctx, [[-0.74, 0.3], [-1.05, 0.2, 1], [-0.86, -0.1], [-1.15, -0.4, 1], [-0.8, -0.6], [-0.85, -1.05, 1], [-0.4, -0.9], [-0.2, -1.35, 1], [0.05, -0.98], [0.35, -1.3, 1], [0.45, -0.9], [0.8, -0.95, 1], [0.7, -0.55], [0.45, -0.58, 1], [0.2, -0.45, 1], [-0.1, -0.6], [-0.5, -0.5], [-0.65, -0.15]]), hc, [-0.2, -0.7], 0.9, { hi: 0.35, lw: 1.3 });
  } else if (o.hair === 'long') { // largo, lacio y plateado: raya al medio y mechones que caen a los dos lados hasta el pecho
    const hair = () => shapePath(ctx, [[-0.55, 2.5, 1], [-1.0, 1.4], [-1.02, 0.3], [-0.92, -0.5], [-0.55, -1.0], [0.05, -1.14], [0.6, -0.92], [0.86, -0.45], [0.95, 0.3], [1.02, 1.2], [0.86, 2.1, 1], [0.76, 1.2], [0.72, 0.4], [0.62, -0.25], [0.48, -0.55], [0.26, -0.64, 1], [0.05, -0.5, 1], [-0.25, -0.62], [-0.56, -0.35], [-0.7, 0.25], [-0.62, 1.1], [-0.42, 1.9]]);
    form(ctx, hair, hc, [-0.1, -0.4], 1.3, { hi: 0.4, lo: 0.5, lw: 1.3, tex: 0.25 });
    ctx.save(); ctx.beginPath(); hair(); ctx.clip();
    for (let k = 0; k < 22; k++) { const left = k < 12, j = left ? k : k - 12, x0 = 0.05 + (left ? -j * 0.05 : j * 0.05); curve(ctx, [x0, -1.08], [left ? -0.95 + j * 0.02 : 0.88 - j * 0.015, -0.2], [left ? -0.85 + j * 0.035 : 0.95 - j * 0.02, left ? 2.4 : 2.0], 0.014, k % 3 ? 'rgba(60,60,80,0.35)' : 'rgba(255,255,255,0.55)'); }
    ctx.restore();
  }
  if (o.beard) { // bigote y barba en punta
    const beard = () => shapePath(ctx, [[-0.12, 0.5], [-0.02, 0.72], [0.12, 0.95], [0.24, 1.35, 1], [0.38, 0.95], [0.55, 0.72], [0.6, 0.48], [0.5, 0.66], [0.25, 0.72], [0.0, 0.66]]);
    form(ctx, beard, hc, [0.25, 0.8], 0.5, { hi: 0.3, lw: 1 });
    ctx.save(); ctx.beginPath(); beard(); ctx.clip(); for (let k = 0; k < 9; k++) line(ctx, [[-0.05 + k * 0.07, 0.6], [0.16 + k * 0.02, 1.3]], 0.01, k % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'); ctx.restore();
    form(ctx, () => shapePath(ctx, [[0.25, 0.5], [0.0, 0.52], [-0.18, 0.7, 1], [0.0, 0.6], [0.25, 0.58], [0.5, 0.6], [0.68, 0.68, 1], [0.52, 0.52]]), hc, [0.25, 0.55], 0.3, { lw: 0.8 }); // bigote
  }
}
// Dibuja la cabeza en el cuello del cuerpo (size = alto de media cabeza en metros).
function headAt(ctx: CanvasRenderingContext2D, b: Body, tilt: number, size: number, draw: () => void, fwd = 0.02) {
  size *= 1.85; // cabezas grandes, sin cuello (como en la lámina)
  const c = add(add(b.neck, b.spine, size * 0.78), b.side, fwd);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(tilt); ctx.scale(size, size); draw(); ctx.restore();
}

// ---------------------------------------------------------------- Torsos
// El frac negro de frente (tres cuartos): chaleco bordó, solapas, corbata de volados con la gema y cinturón.
// ---------------------------------------------------------------- Personajes
// Vampiro: el noble del castillo (frac, capa de cuello alto, garras largas).
// ---------------------------------------------------------------- Metal y armadura
// Una placa de metal: degradé fuerte, reflejo y el borde (ribete) de otro color.
const rivets = (ctx: CanvasRenderingContext2D, pts: Pt[], r: number, back = false) => { for (const [x, y] of pts) { ctx.fillStyle = back ? '#4a4652' : '#d8d4de'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r * 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = back ? '#6a6672' : '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill(); } };
// ---------------------------------------------------------------- Vampiro gigante
// Una bestia encorvada: hombros enormes con hombreras de hierro con pinches, brazos desnudos con brazales y cadenas, cabeza chica pelada.
const BRUTE: Dims = { thigh: 0.42, shin: 0.4, spine: 0.6, upper: 0.36, fore: 0.33, shW: 0.12 };
function bruteHead(ctx: CanvasRenderingContext2D, t: number, open: number) {
  const sk = '#9d90a8';
    form(ctx, () => shapePath(ctx, [[-0.7, 0.3], [-0.92, 0.0], [-1.05, -0.35, 1], [-0.78, -0.2], [-0.66, 0.0]]), sk, [-0.85, -0.1], 0.3, { lw: 1.1 }); // oreja
  const head = () => shapePath(ctx, [[-0.78, 0.2], [-0.82, -0.4], [-0.5, -0.85], [0.1, -0.95], [0.6, -0.75], [0.8, -0.35], [0.85, 0.1], [0.78, 0.5], [0.5, 0.85 + open * 0.2], [0.0, 0.95 + open * 0.2], [-0.5, 0.8], [-0.75, 0.55]]);
  form(ctx, head, sk, [0.1, -0.3], 1.1, { hi: 0.3, lo: 0.6, lw: 1.6, tex: 0.3 });
  ctx.save(); ctx.beginPath(); head(); ctx.clip();
  ctx.fillStyle = 'rgba(30,10,40,0.5)'; ctx.beginPath(); ctx.moveTo(-0.6, -0.25); ctx.quadraticCurveTo(0.1, -0.5, 0.8, -0.28); ctx.lineTo(0.8, -0.05); ctx.quadraticCurveTo(0.1, -0.2, -0.6, -0.02); ctx.closePath(); ctx.fill(); // la frente que sobresale y tapa los ojos
  for (const [a, b2] of [[[-0.4, -0.85], [-0.15, -0.4]], [[0.3, -0.9], [0.45, -0.55]], [[-0.72, -0.3], [-0.5, 0.05]]] as [Pt, Pt][]) { line(ctx, [a, b2], 0.045, 'rgba(120,20,40,0.6)'); line(ctx, [a, b2], 0.015, 'rgba(255,210,220,0.3)'); } // cicatrices
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-0.1, -0.65, 0.35, 0.12, -0.1, 0, TAU); ctx.fill(); // brillo de la pelada
  ctx.restore();
  for (const [x, rx] of [[-0.25, 0.14], [0.45, 0.11]] as const) vampEye(ctx, x, -0.08, rx, 0.045, t);
  ctx.strokeStyle = '#1a1018'; ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.5, -0.25); ctx.lineTo(-0.05, -0.14); ctx.moveTo(0.25, -0.14); ctx.lineTo(0.7, -0.25); ctx.stroke();
  form(ctx, () => shapePath(ctx, [[0.05, -0.05], [-0.05, 0.25], [0.05, 0.35], [0.35, 0.35], [0.45, 0.25], [0.3, -0.05]]), darken(sk, 0.05), [0.2, 0.15], 0.25, { rim: 0, lw: 0.9 }); // nariz ancha y chata
  ctx.fillStyle = 'rgba(30,5,20,0.7)'; for (const x of [0.08, 0.32]) { ctx.beginPath(); ctx.ellipse(x, 0.3, 0.05, 0.03, 0, 0, TAU); ctx.fill(); }
  // la boca: mandíbula ancha con dos colmillos de abajo para arriba
  ctx.fillStyle = '#2a0610'; ctx.beginPath(); ctx.moveTo(-0.35, 0.5); ctx.quadraticCurveTo(0.15, 0.42, 0.62, 0.5); ctx.quadraticCurveTo(0.15, 0.6 + open * 0.35, -0.35, 0.5); ctx.fill();
  ctx.fillStyle = '#efe6d2'; ctx.strokeStyle = INK; ctx.lineWidth = 0.014;
  for (const x of [-0.2, 0.48]) { ctx.beginPath(); ctx.moveTo(x - 0.05, 0.6 + open * 0.15); ctx.lineTo(x, 0.32); ctx.lineTo(x + 0.05, 0.6 + open * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const x = -0.1 + k * 0.14; ctx.beginPath(); ctx.moveTo(x - 0.03, 0.47); ctx.lineTo(x, 0.55); ctx.lineTo(x + 0.03, 0.47); ctx.closePath(); ctx.fill(); }
}
// ---------------------------------------------------------------- Armadura de caballero (martillo, guerrero y Drácula)
// Pechera: placas con ribete, el emblema del murciélago y la gema; faldones de placas (escarcelas) y la falda de malla.
// Capa larga de caballero (con el borde de adelante sobre el hombro).
// ---------------------------------------------------------------- Pelo (hombre lobo)
// Un contorno con mechones en punta hacia afuera (flow: para qué lado se peinan).
function furPath(ctx: CanvasRenderingContext2D, pts: Pt[], len: number, seed: number, flow = -0.5, closed = true) {
  const n = pts.length, seg: Pt[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / 0.05)); for (let j = 0; j < k; j++) seg.push(lerp(a, b, j / k)); }
  if (!closed) seg.push(pts[n - 1]);
  ctx.moveTo(seg[0][0], seg[0][1]);
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1], b = seg[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
    const h = len * (0.45 + 0.55 * Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453 % 1));
    const tip: Pt = [(a[0] + b[0]) / 2 + nx * h + dx / l * h * flow, (a[1] + b[1]) / 2 + ny * h + dy / l * h * flow];
    ctx.quadraticCurveTo(lerp(a, tip, 0.6)[0], lerp(a, tip, 0.6)[1], tip[0], tip[1]); ctx.quadraticCurveTo(lerp(b, tip, 0.5)[0], lerp(b, tip, 0.5)[1], b[0], b[1]);
  }
  if (closed) ctx.closePath();
}
function furForm(ctx: CanvasRenderingContext2D, pts: Pt[], base: string, c: Pt, r: number, len: number, seed: number, back = false, flow = -0.5) {
  const path = () => furPath(ctx, pts, len, seed, flow);
  form(ctx, path, dk(base, back, 0.45), c, r, { hi: back ? 0.08 : 0.18, lo: 0.7, rim: back ? 0 : 1, tex: 0.45, lw: 0.9 });
  ctx.save(); ctx.beginPath(); path(); ctx.clip(); // mechones adentro
  for (let k = 0; k < Math.round(10 + r * 30); k++) { const h1 = Math.abs(Math.sin(k * 7.1 + seed) * 4375.85 % 1), h2 = Math.abs(Math.sin(k * 3.7 + seed * 2) * 9375.3 % 1); const p: Pt = [c[0] + (h1 - 0.5) * r * 1.8, c[1] + (h2 - 0.5) * r * 1.8]; curve(ctx, p, [p[0] - 0.04, p[1] + 0.03], [p[0] - 0.09, p[1] + 0.09], 0.012, k % 3 ? 'rgba(0,0,0,0.35)' : (back ? 'rgba(255,255,255,0.06)' : 'rgba(255,230,200,0.22)')); }
  ctx.restore();
}

// ---------------------------------------------------------------- Drácula dragón (wyvern como en Skyrim / Dark Souls)
function scales(ctx: CanvasRenderingContext2D, path: () => void, c: Pt, r: number, size: number, back: boolean) {
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.lineWidth = size * 0.12; 
  for (let y = c[1] - r; y < c[1] + r; y += size * 0.7) for (let x = c[0] - r + ((Math.round(y / size) % 2) * size * 0.5); x < c[0] + r; x += size) {
    ctx.strokeStyle = back ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x, y, size * 0.55, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (!back) { ctx.strokeStyle = 'rgba(255,120,110,0.16)'; ctx.beginPath(); ctx.arc(x, y - size * 0.06, size * 0.5, 1.15 * Math.PI, 1.6 * Math.PI); ctx.stroke(); }
  }
  ctx.restore();
}
// ================================================================ Estilo de la lámina de referencia
// Negro con ribetes dorados y rojo carmesí, contorno marcado, rodillas y codos con rótulas redondas (como un juego 2D de acción).
const MUSC = 1.9, BROAD = 1.45; // más musculosos: brazos y piernas más gruesos, pecho y hombros más anchos
const GOLDC = '#e2a838', BLK = '#1d1921', BLK2 = '#2a2530', RED = '#a8101c', REDD = '#560610', LEATHER = '#6b3c22', SKIN = '#b9b4c6';
// Un borde dorado por dentro del contorno (con brillo) y la línea oscura de afuera.
function goldEdge(ctx: CanvasRenderingContext2D, path: () => void, w = 0.022, back = false) {
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.lineWidth = w * 2; ctx.strokeStyle = back ? '#7a5a20' : GOLDC; ctx.lineJoin = 'round'; ctx.beginPath(); path(); ctx.stroke();
  ctx.lineWidth = w * 0.7; ctx.strokeStyle = back ? 'rgba(255,230,150,0.15)' : 'rgba(255,240,180,0.55)'; ctx.beginPath(); path(); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 0.016; ctx.strokeStyle = INK; ctx.beginPath(); path(); ctx.stroke();
}
function trimmed(ctx: CanvasRenderingContext2D, pts: (Pt | [number, number, number])[], base: string, c: Pt, r: number, back = false, w = 0.02, o: Form = {}) {
  const path = () => shapePath(ctx, pts);
  form(ctx, path, dk(base, back, 0.35), c, r, { lw: 1.3, ...o, rim: back ? 0 : (o.rim ?? 1) });
  goldEdge(ctx, path, w, back);
}
// Rótula redonda (rodilla y codo), gris oscuro con brillo.
function joint(ctx: CanvasRenderingContext2D, p: Pt, r: number, back = false, col = '#5d5964', dir: Pt = [0, 1], guard = BLK2, trimC: string | null = GOLDC, spike = false) {
  form(ctx, () => ctx.arc(p[0], p[1], r, 0, TAU), dk(col, back, 0.35), p, r, { hi: 0.55, lo: 0.7, rim: back ? 0 : 1, lw: 1.3 });
  // la pieza de armadura que tapa la rótula (rodillera o codera en punta, con ribete y remache)
  const ang = Math.atan2(dir[0], dir[1]);
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-ang);
  const P: (Pt | [number, number, number])[] = [[-1.05 * r, -0.55 * r], [-0.55 * r, -1.15 * r], [0.55 * r, -1.15 * r], [1.05 * r, -0.55 * r], [1.0 * r, 0.45 * r], [0, 1.45 * r, 1], [-1.0 * r, 0.45 * r]];
  if (trimC) trimmed(ctx, P, guard, [0, 0], r * 1.3, back, r * 0.18, { hi: 0.5 });
  else form(ctx, () => shapePath(ctx, P), dk(guard, back, 0.35), [0, 0], r * 1.3, { hi: 0.35, tex: 0.5, lw: 1.2, rim: back ? 0 : 1 });
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.moveTo(-0.8 * r, 0.1 * r); ctx.quadraticCurveTo(0, 0.5 * r, 0.8 * r, 0.1 * r); ctx.lineTo(0.8 * r, 0.22 * r); ctx.quadraticCurveTo(0, 0.62 * r, -0.8 * r, 0.22 * r); ctx.closePath(); ctx.fill(); // la lámina de abajo
  rivets(ctx, [[0, -0.35 * r]], r * 0.17, back);
  if (spike) { const sx = 1; form(ctx, () => shapePath(ctx, [[sx * 0.75 * r, -0.45 * r], [sx * 1.9 * r, -0.05 * r, 1], [sx * 0.85 * r, 0.25 * r]]), back ? '#6a5a30' : '#d9a23a', [sx * 1.1 * r, -0.05 * r], r * 0.6, { hi: 0.6, rim: 0, ao: 0, lw: 1 }); } // el pinche
  ctx.restore();
}
// Pierna: pantalón negro ajustado, rótula, bota con la banda dorada.
function leg2(ctx: CanvasRenderingContext2D, b: Body, i: number, cloth = BLK, w0 = 1, gold = true, bootC = '#16131a') {
  const w = w0 * (w0 > 1.2 ? 1 : MUSC * 0.85), back = i === 0, hp = b.hp[i], kn = b.knee[i], ft = b.foot[i];
  tube(ctx, hp, kn, [0.18 * w, 0.16 * w, 0.115 * w], dk(cloth, back, 0.35), { bulge: 0.05, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
  const sd = vec(kn, ft), sn: Pt = [sd[1], -sd[0]];
  tube(ctx, kn, lerp(kn, ft, 0.55), [0.12 * w, 0.125 * w], dk(cloth, back, 0.35), { bulge: -0.06, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
  // bota alta
  const top = lerp(kn, ft, 0.38);
  tube(ctx, top, ft, [0.13 * w, 0.115 * w, 0.1 * w], dk(bootC, back, 0.3), { rim: back ? 0 : 1, tex: 0.25, lw: 1.3, hi: 0.4 });
  ctx.save(); ctx.translate(ft[0], ft[1]); ctx.scale(w, w);
  form(ctx, () => shapePath(ctx, [[-0.08, -0.08], [0.05, -0.085], [0.17, -0.035], [0.23, 0.01, 1], [0.13, 0.04, 1], [-0.08, 0.04, 1], [-0.095, -0.02]]), dk(bootC, back, 0.3), [0.04, -0.03], 0.16, { rim: back ? 0 : 1, lw: 1.3, hi: 0.45 });
  ctx.fillStyle = '#08060a'; ctx.fillRect(-0.085, 0.03, 0.22, 0.018);
  bootSpikes(ctx, back);
  ctx.restore();
  if (gold) { const g0 = add(ft, sd, -0.07); ctx.save(); ctx.translate(g0[0], g0[1]); ctx.rotate(-Math.atan2(sd[0], sd[1])); trimmed(ctx, [[-0.072 * w, -0.025, 1], [0.072 * w, -0.025, 1], [0.075 * w, 0.025, 1], [-0.075 * w, 0.025, 1]], '#c68f2c', [0, 0], 0.06, back, 0.008, { hi: 0.6 }); ctx.restore(); } // la banda dorada del tobillo
  { const g1 = add(top, sd, 0.0); ctx.strokeStyle = back ? '#3a3540' : '#4a4552'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(...add(g1, sn, 0.065 * w)); ctx.lineTo(...add(g1, sn, -0.065 * w)); ctx.stroke(); }
  joint(ctx, kn, 0.075 * w, back, '#5d5964', sd);
}
// Pinches en el zapato: dos sobre el empeine y uno en el talón.
function bootSpikes(ctx: CanvasRenderingContext2D, back: boolean) {
  for (const [x, y, a, h] of [[0.06, -0.07, -0.35, 0.07], [0.13, -0.045, -0.15, 0.06], [-0.09, -0.04, -1.9, 0.06]] as const) { const d = dirv(Math.PI + a), n: Pt = [d[1], -d[0]], b0: Pt = [x, y]; form(ctx, () => shapePath(ctx, [add(b0, n, 0.018), [add(b0, d, h)[0], add(b0, d, h)[1], 1], add(b0, n, -0.018)]), back ? '#5a4a28' : '#cfd1d8', add(b0, d, h * 0.4), 0.04, { hi: 0.6, rim: 0, ao: 0, lw: 0.9 }); }
}
// Brazo: manga negra, codo, puño rojo con bandas doradas y la mano con garras.
function arm2(ctx: CanvasRenderingContext2D, b: Body, i: number, o: { sleeve?: string; cuff?: string; skin?: string; curl?: number; w?: number; hand?: 'claw' | 'none' } = {}) {
  const back = i === 0, sh = b.sh[i], el = b.elbow[i], hd = b.hand[i], W = (o.w ?? 1) * MUSC, sl = o.sleeve ?? BLK;
  tube(ctx, sh, el, [0.13 * W, 0.12 * W, 0.1 * W], dk(sl, back, 0.35), { bulge: 0.05, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
  tube(ctx, el, hd, [0.105 * W, 0.1 * W, 0.085 * W], dk(sl, back, 0.35), { rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
  const fd = vec(el, hd), fn: Pt = [fd[1], -fd[0]];
  if (o.cuff !== 'none') { // el puño rojo largo con las bandas doradas
    const c0 = lerp(el, hd, 0.4), c1 = add(hd, fd, -0.01);
    trimmed(ctx, [add(c0, fn, 0.06 * W), add(c1, fn, 0.07 * W), add(c1, fn, -0.07 * W), add(c0, fn, -0.06 * W)].map(p => [p[0], p[1], 1] as [number, number, number]), o.cuff ?? RED, lerp(c0, c1, 0.5), 0.12, back, 0.014);
    const m = lerp(c0, c1, 0.45); ctx.strokeStyle = back ? '#7a5a20' : GOLDC; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(...add(m, fn, 0.065 * W)); ctx.lineTo(...add(m, fn, -0.065 * W)); ctx.stroke();
  }
  if (o.hand !== 'none') clawHand(ctx, add(hd, fd, 0.025), Math.atan2(fd[0], fd[1]), o.skin ?? SKIN, back, (o.curl ?? 0.5) * 0.6, '#1c1218', 1.45);
}
// Capa: negra por fuera con borde dorado, roja por dentro, con el borde de abajo en puntas; el cuello alto rojo.
function cape2(ctx: CanvasRenderingContext2D, b: Body, t: number, o: { len?: number; flare?: number; outer?: string; inner?: string; collar?: boolean; sway?: number } = {}) {
  const len = o.len ?? 1.2, fl = (o.flare ?? 1) * 0.5 + Math.sin(t * 2) * 0.02 + (o.sway ?? 0), sl = add(b.sh[0], b.spine, 0.03), sr = add(b.sh[1], b.spine, 0.03), y1 = Math.max(sl[1], sr[1]) + len;
  const xl = sl[0] - fl, xr = sr[0] + fl * 0.55, n = 6;
  const hem: Pt[] = []; for (let k = 0; k <= n; k++) { const x = xl + (xr - xl) * k / n; hem.push([x, y1 + Math.sin(k / n * Math.PI) * 0.04 + (k % 2 ? -0.07 : 0)]); }
  const inner: (Pt | [number, number, number])[] = [[sl[0], sl[1]], [xl + 0.12, sl[1] + len * 0.45], ...hem.map(p => [p[0], p[1], 1] as [number, number, number]), [xr - 0.08, sr[1] + len * 0.45], [sr[0], sr[1]]];
  form(ctx, () => shapePath(ctx, inner), o.inner ?? RED, [mid(sl, sr)[0], sl[1] + len * 0.6], 0.9, { hi: 0.2, lo: 0.7, tex: 0.3, lw: 1.3 });
  ctx.save(); ctx.beginPath(); shapePath(ctx, inner); ctx.clip(); for (let k = 1; k < n; k++) curve(ctx, [lerp(sl, sr, k / n)[0], sl[1] + 0.1], [hem[k][0] + 0.03, (sl[1] + y1) / 2], [hem[k][0], hem[k][1]], 0.018, 'rgba(40,0,6,0.45)'); ctx.restore(); // pliegues
  // la solapa izquierda negra con borde dorado que cae en diagonal
  const flap: (Pt | [number, number, number])[] = [[sl[0] + 0.02, sl[1] - 0.02], [xl - 0.02, y1 - 0.1], [xl + 0.03, y1 + 0.02, 1], [xl + 0.28, y1 - 0.05, 1], [sl[0] - 0.02, sl[1] + 0.35]];
  trimmed(ctx, flap, o.outer ?? BLK, [xl + 0.15, (sl[1] + y1) / 2], 0.7, false, 0.022);
  ctx.fillStyle = GOLDC; ctx.beginPath(); const dm: Pt = [xl + 0.13, y1 - 0.1]; ctx.moveTo(dm[0], dm[1] - 0.04); ctx.lineTo(dm[0] + 0.025, dm[1]); ctx.lineTo(dm[0], dm[1] + 0.04); ctx.lineTo(dm[0] - 0.025, dm[1]); ctx.closePath(); ctx.fill(); // rombo dorado
  if (o.collar !== false) { // cuello alto: rojo por dentro, negro por fuera, a los dos lados de la cabeza
    const [x, y] = add(b.neck, b.spine, 0.02);
    for (const sx of [-1, 1]) { const w = sx < 0 ? 1 : 0.8, P = (dx: number, dy: number): Pt => [x + sx * dx * w, y + dy];
      form(ctx, () => shapePath(ctx, [P(0.03, 0.06), P(0.18, 0.02), [P(0.33, -0.42)[0], P(0.33, -0.42)[1], 1], P(0.16, -0.22), P(0.05, -0.08)]), o.outer ?? BLK, P(0.18, -0.15), 0.25, { lw: 1.3 });
      form(ctx, () => shapePath(ctx, [P(0.06, 0.04), P(0.15, 0.0), [P(0.3, -0.38)[0], P(0.3, -0.38)[1], 1], P(0.13, -0.18), P(0.07, -0.06)]), o.inner ?? RED, P(0.15, -0.15), 0.2, { hi: 0.35, lw: 0.8 }); }
  }
}
// Hombrera negra redonda con ribete dorado y una voluta.
function shoulderCap(ctx: CanvasRenderingContext2D, sh: Pt, size: number, back = false, base = BLK2) {
  ctx.save(); ctx.translate(sh[0], sh[1]); ctx.scale(size, size);
  trimmed(ctx, [[-0.15, 0.06], [-0.14, -0.06], [-0.05, -0.12], [0.08, -0.12], [0.16, -0.04], [0.16, 0.07, 1], [0.0, 0.03], [-0.15, 0.07, 1]], base, [0, -0.03], 0.18, back, 0.02, { hi: 0.45 });
  ctx.strokeStyle = back ? '#7a5a20' : GOLDC; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(0.02, -0.02, 0.04, 0.3, 4.2); ctx.stroke(); // voluta
  ctx.restore();
}
// Cinturón de cuero con hebilla dorada (en el sistema del torso).
function belt2(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, buckleX = 0.03) {
  form(ctx, () => ctx.roundRect(x0, y - 0.035, x1 - x0, 0.07, 0.01), LEATHER, [0, y], 0.2, { rim: 0, tex: 0.5, lw: 1.2 });
  ctx.strokeStyle = 'rgba(255,220,180,0.35)'; ctx.setLineDash([0.012, 0.01]); ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(x0 + 0.01, y - 0.022); ctx.lineTo(x1 - 0.01, y - 0.022); ctx.moveTo(x0 + 0.01, y + 0.022); ctx.lineTo(x1 - 0.01, y + 0.022); ctx.stroke(); ctx.setLineDash([]);
  trimmed(ctx, [[buckleX - 0.05, y - 0.05, 1], [buckleX + 0.05, y - 0.05, 1], [buckleX + 0.05, y + 0.05, 1], [buckleX - 0.05, y + 0.05, 1]], '#c68f2c', [buckleX, y], 0.06, false, 0.012, { hi: 0.6 });
  ctx.fillStyle = LEATHER; ctx.fillRect(buckleX - 0.025, y - 0.025, 0.05, 0.05); ctx.fillStyle = GOLDC; ctx.fillRect(buckleX - 0.004, y - 0.03, 0.008, 0.06);
}
// Faldón rojo con borde dorado y un rombo (cuelga del cinturón).
function tabard(ctx: CanvasRenderingContext2D, x: number, y0: number, len: number, w: number, col = RED, motif: 'diamond' | 'fleur' | 'none' = 'diamond', sway = 0) {
  trimmed(ctx, [[x - w / 2, y0, 1], [x + w / 2, y0, 1], [x + w / 2 + sway, y0 + len, 1], [x + sway, y0 + len + w * 0.35, 1], [x - w / 2 + sway, y0 + len, 1]], col, [x, y0 + len / 2], len * 0.6, false, 0.018, { tex: 0.35 });
  ctx.fillStyle = GOLDC; ctx.strokeStyle = INK; ctx.lineWidth = 0.006; const cy = y0 + len * 0.62;
  if (motif === 'diamond') { ctx.beginPath(); ctx.moveTo(x + sway * 0.6, cy - 0.06); ctx.lineTo(x + 0.035 + sway * 0.6, cy); ctx.lineTo(x + sway * 0.6, cy + 0.06); ctx.lineTo(x - 0.035 + sway * 0.6, cy); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x + sway * 0.6, cy, 0.012, 0, TAU); ctx.fill(); }
  else if (motif === 'fleur') { ctx.beginPath(); ctx.moveTo(x, cy - 0.08); ctx.quadraticCurveTo(x + 0.05, cy - 0.02, x, cy + 0.04); ctx.quadraticCurveTo(x - 0.05, cy - 0.02, x, cy - 0.08); ctx.fill(); ctx.stroke(); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, cy + 0.02); ctx.quadraticCurveTo(x + sx * 0.07, cy - 0.04, x + sx * 0.06, cy + 0.06); ctx.quadraticCurveTo(x + sx * 0.03, cy + 0.03, x, cy + 0.05); ctx.fill(); ctx.stroke(); } }
}
// El torso con saco negro: chaleco rojo con alamares dorados, solapas y faldones del saco con borde dorado.
function coatTorso2(ctx: CanvasRenderingContext2D, b: Body, t: number, o: { coat?: string; vest?: string; skirt?: number; tab?: number; tabCol?: string; motif?: 'diamond' | 'fleur' | 'none' } = {}) {
  const coat = o.coat ?? BLK, vest = o.vest ?? RED, sk = o.skirt ?? 0.32;
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.scale(BROAD, 1);
  // faldones del saco (a los costados de las piernas)
  for (const sx of [-1, 1]) { const w = sx < 0 ? 1 : 0.8; trimmed(ctx, [[0.03 + sx * 0.05 * w, -0.06], [0.03 + sx * 0.2 * w, -0.06], [0.03 + sx * 0.3 * w, sk, 1], [0.03 + sx * 0.08 * w, sk - 0.04, 1]], coat, [0.03 + sx * 0.18, sk / 2], 0.3, sx < 0, 0.018); }
  const torso = () => shapePath(ctx, [[-0.17, 0.0], [-0.18, -0.3], [-0.22, -0.56], [-0.13, -0.66], [0.17, -0.66], [0.22, -0.56], [0.17, -0.3], [0.16, 0.0]]);
  form(ctx, torso, coat, [0, -0.35], 0.45, { tex: 0.3, lw: 1.3 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  form(ctx, () => shapePath(ctx, [[-0.08, -0.62], [0.13, -0.62], [0.11, 0.02], [-0.06, 0.02]]), vest, [0.03, -0.3], 0.35, { rim: 0.6, tex: 0.35, lw: 1 }); // chaleco rojo
  for (let k = 0; k < 5; k++) { const y = -0.5 + k * 0.085; ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.04, y); ctx.quadraticCurveTo(0.03, y - 0.015, 0.1, y); ctx.stroke(); ctx.fillStyle = GOLDC; ctx.beginPath(); ctx.arc(0.03, y, 0.014, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.004; ctx.stroke(); } // alamares dorados
  for (const sx of [-1, 1]) { const w = sx < 0 ? 1 : 0.75; const lap = () => shapePath(ctx, [[0.03 + sx * 0.06 * w, -0.67], [0.03 + sx * 0.18 * w, -0.62], [0.03 + sx * 0.14 * w, -0.3, 1], [0.03 + sx * 0.07 * w, -0.05, 1]]); form(ctx, lap, coat, [0.03 + sx * 0.12, -0.4], 0.25, { rim: 0, lw: 1.2 }); goldEdge(ctx, lap, 0.014); } // solapas
  ctx.restore();
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.moveTo(-0.04, -0.67); ctx.lineTo(0.1, -0.67); ctx.lineTo(0.03, -0.55); ctx.closePath(); ctx.fill(); // el pecho que asoma en el cuello
  goldEdge(ctx, torso, 0.012);
  if ((o.tab ?? 0.42) > 0) tabard(ctx, 0.03, -0.02, o.tab ?? 0.42, 0.14, o.tabCol ?? RED, o.motif ?? 'diamond');
  belt2(ctx, -0.04, -0.18, 0.18);
  ctx.restore();
}

// ---------------------------------------------------------------- Vampiro (como la lámina)
function drawWalker2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const st = stance(v, t, { lean: 0.02, crouch: 0.13, wide: 1.55 }), br = Math.sin(t * 2.4 + v.id) * 0.02;
  const up = v.state === 'claw' ? 1 : 0;
  const r: Pose2 = { ...st, hands: swipeArms(v, [[-0.24, 0.56 + br], [0.3, 0.54 - br]]) }, b = solve2(r, { ...HUMAN, shW: 0.2 });
  shadowOn(ctx, v, 0.6);
  cape2(ctx, b, t + v.id, { len: 1.2, flare: 1.1 });
  leg2(ctx, b, 0); leg2(ctx, b, 1);
  coatTorso2(ctx, b, t);
  arm2(ctx, b, 0, { curl: 0.5 });
  shoulderCap(ctx, add(b.sh[0], b.spine, 0.01), 0.95);
  arm2(ctx, b, 1, { curl: 0.9 - up * 0.6 });
  shoulderCap(ctx, add(b.sh[1], b.spine, 0.01), 0.9);
  headAt(ctx, b, 0.02, 0.16, () => vampFace(ctx, t + v.id, { skin: SKIN, open: up > 0 ? 0.6 : 0.05, gaunt: 0.6 }));
}

// Hombrera grande negra con borde dorado, tachas y pinches dorados.
function spikedPad(ctx: CanvasRenderingContext2D, sh: Pt, size: number, spikes = 3, flip = false) {
  ctx.save(); ctx.translate(sh[0], sh[1]); ctx.scale(size * (flip ? -1 : 1), size);
  for (let k = 0; k < spikes; k++) { const x = -0.12 + k * (0.24 / Math.max(1, spikes - 1)), h = 0.2 - Math.abs(k - (spikes - 1) / 2) * 0.04; form(ctx, () => shapePath(ctx, [[x - 0.035, -0.1], [x - 0.01, -0.12 - h, 1], [x + 0.035, -0.1]]), '#d9a23a', [x, -0.1 - h / 2], 0.1, { hi: 0.6, lw: 1.1 }); }
  trimmed(ctx, [[-0.2, 0.08], [-0.2, -0.04], [-0.12, -0.13], [0.05, -0.15], [0.18, -0.08], [0.21, 0.06], [0.12, 0.12, 1], [-0.14, 0.12, 1]], BLK2, [0, -0.03], 0.22, false, 0.022, { hi: 0.5, tex: 0.35 });
  for (const [x, y] of [[-0.12, -0.03], [-0.03, -0.08], [0.07, -0.08], [0.14, 0.0], [-0.08, 0.06], [0.05, 0.04]] as const) { form(ctx, () => ctx.arc(x, y, 0.017, 0, TAU), '#d9a23a', [x, y], 0.02, { hi: 0.7, rim: 0, ao: 0, lw: 0.6 }); } // tachas doradas
  ctx.restore();
}
// Pechera negra con ribetes dorados, una línea dorada al medio y la gema roja.
function plateTorso2(ctx: CanvasRenderingContext2D, b: Body, t: number, o: { tab?: number; motif?: 'diamond' | 'fleur' | 'none'; gemBelt?: boolean } = {}) {
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.scale(BROAD, 1);
  for (const sx of [-1, 1]) { const w = sx < 0 ? 1 : 0.85; trimmed(ctx, [[0.03 + sx * 0.04 * w, -0.06], [0.03 + sx * 0.21 * w, -0.06], [0.03 + sx * 0.25 * w, 0.17, 1], [0.03 + sx * 0.06 * w, 0.15, 1]], BLK2, [0.03 + sx * 0.14, 0.05], 0.18, false, 0.016, { hi: 0.5 }); } // escarcelas
  const chest = () => shapePath(ctx, [[-0.17, -0.02], [-0.19, -0.3], [-0.24, -0.56], [-0.14, -0.67], [0.18, -0.67], [0.24, -0.56], [0.19, -0.3], [0.17, -0.02]]);
  form(ctx, chest, BLK2, [0, -0.42], 0.45, { hi: 0.55, lo: 0.7, tex: 0.35, lw: 1.3 });
  ctx.save(); ctx.beginPath(); chest(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(0.03, -0.67); ctx.lineTo(0.03, -0.1); ctx.lineTo(-0.25, -0.1); ctx.lineTo(-0.25, -0.67); ctx.fill();
  for (const y of [-0.3, -0.2, -0.1]) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.2, y); ctx.quadraticCurveTo(0.03, y + 0.035, 0.2, y); ctx.stroke(); ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(-0.2, y + 0.008); ctx.quadraticCurveTo(0.03, y + 0.043, 0.2, y + 0.008); ctx.stroke(); }
  ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.03, -0.6); ctx.lineTo(0.03, -0.32); ctx.stroke(); // línea dorada al medio
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.13, -0.62); ctx.quadraticCurveTo(0.2, -0.5, 0.17, -0.35); ctx.stroke();
  ctx.restore();
  goldEdge(ctx, chest, 0.016);
  ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.012; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.03 + sx * 0.04, -0.64); ctx.quadraticCurveTo(0.03 + sx * 0.16, -0.58, 0.03 + sx * 0.17, -0.42); ctx.stroke(); } // volutas del pecho
  gem(ctx, 0.03, -0.52, 0.035, t, GOLDC);
  if ((o.tab ?? 0.36) > 0) tabard(ctx, 0.03, -0.02, o.tab ?? 0.36, 0.13, RED, o.motif ?? 'fleur');
  belt2(ctx, -0.04, -0.19, 0.19);
  if (o.gemBelt) gem(ctx, 0.03, -0.04, 0.026, t, GOLDC);
  ctx.restore();
}
// Brazo con armadura negra: brazal, codera redonda, avambrazo con borde dorado y guantelete gris.
function plateArm2(ctx: CanvasRenderingContext2D, b: Body, i: number, grip?: Pt) {
  const back = i === 0, sh = b.sh[i], el = b.elbow[i], hd = b.hand[i];
  tube(ctx, sh, el, [0.13 * MUSC, 0.125 * MUSC, 0.1 * MUSC], dk(BLK, back, 0.35), { bulge: 0.06, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
  const fd = vec(el, hd), fn: Pt = [fd[1], -fd[0]];
  tube(ctx, el, hd, [0.11 * MUSC, 0.11 * MUSC, 0.09 * MUSC], dk(BLK2, back, 0.35), { rim: back ? 0 : 1, tex: 0.3, lw: 1.3, hi: 0.5 });
  const c0 = lerp(el, hd, 0.3), c1 = add(hd, fd, -0.02);
  trimmed(ctx, [add(c0, fn, 0.065 * MUSC), add(c1, fn, 0.08 * MUSC), add(c1, fn, -0.08 * MUSC), add(c0, fn, -0.065 * MUSC)].map(p => [p[0], p[1], 1] as [number, number, number]), BLK2, lerp(c0, c1, 0.5), 0.12, back, 0.016, { hi: 0.5 });
  rivets(ctx, [add(lerp(c0, c1, 0.5), fn, 0.04), add(lerp(c0, c1, 0.5), fn, -0.04)], 0.012, back);
  joint(ctx, el, 0.068 * MUSC * 0.85, back, '#5d5964', fd, BLK2, GOLDC, true);
  if (grip) gripFist(ctx, hd, grip, '#8a8692', back, true, 1.1);
  else gauntlet(ctx, add(hd, fd, 0.03), Math.atan2(fd[0], fd[1]), '#8a8692', back, 1.1);
}
// Pierna con armadura: quijote negro, rótula, greba con borde dorado y escarpe.
function plateLeg2(ctx: CanvasRenderingContext2D, b: Body, i: number, w0 = 1) {
  const w = w0 * MUSC * 0.85, back = i === 0, hp = b.hp[i], kn = b.knee[i], ft = b.foot[i];
  tube(ctx, hp, kn, [0.19 * w, 0.17 * w, 0.125 * w], dk(BLK2, back, 0.35), { rim: back ? 0 : 1, tex: 0.3, lw: 1.3, hi: 0.45 });
  const sd = vec(kn, ft), sn: Pt = [sd[1], -sd[0]], g0 = add(kn, sd, 0.06), g1 = add(ft, sd, -0.06);
  trimmed(ctx, [add(g0, sn, 0.075 * w), add(lerp(g0, g1, 0.45), sn, 0.08 * w), add(g1, sn, 0.065 * w), add(g1, sn, -0.065 * w), add(lerp(g0, g1, 0.45), sn, -0.08 * w), add(g0, sn, -0.075 * w)], BLK2, lerp(g0, g1, 0.5), 0.2, back, 0.016, { hi: 0.5 });
  ctx.save(); ctx.translate(ft[0], ft[1]); ctx.scale(w, w);
  trimmed(ctx, [[-0.08, -0.08], [0.05, -0.085], [0.17, -0.035], [0.24, 0.01, 1], [0.13, 0.04, 1], [-0.08, 0.04, 1], [-0.095, -0.02]], BLK2, [0.04, -0.03], 0.16, back, 0.012, { hi: 0.5 });
  bootSpikes(ctx, back);
  ctx.restore();
  { const a0 = add(g1, sd, -0.02); ctx.save(); ctx.translate(a0[0], a0[1]); ctx.rotate(-Math.atan2(sd[0], sd[1])); trimmed(ctx, [[-0.078 * w, -0.022, 1], [0.078 * w, -0.022, 1], [0.08 * w, 0.022, 1], [-0.08 * w, 0.022, 1]], '#c68f2c', [0, 0], 0.06, back, 0.008, { hi: 0.6 }); ctx.restore(); }
  joint(ctx, kn, 0.08 * w, back, '#5d5964', sd, BLK2, GOLDC, true);
}
// Casco cerrado de caballero con la cara a la vista (y cuernos o crin).
function knightHelm(ctx: CanvasRenderingContext2D, t: number, kind: 'horns' | 'plume') {
  if (kind === 'plume') { const sway = Math.sin(t * 3) * 0.04; const crin = () => shapePath(ctx, [[0.0, -1.0], [-0.25, -1.55], [-0.75 + sway, -1.75], [-1.1 + sway * 2, -1.35, 1], [-0.7 + sway, -1.45], [-0.4, -1.15]]); form(ctx, crin, '#d01826', [-0.5, -1.4], 0.6, { hi: 0.35, tex: 0.5, lw: 1.3 }); ctx.save(); ctx.beginPath(); crin(); ctx.clip(); for (let k = 0; k < 8; k++) curve(ctx, [-0.05 - k * 0.04, -1.05 - k * 0.05], [-0.5 - k * 0.03 + sway, -1.65 + k * 0.02], [-1.0 + sway * 2 + k * 0.04, -1.38 + k * 0.03], 0.025, k % 2 ? 'rgba(80,0,10,0.5)' : 'rgba(255,130,130,0.4)'); ctx.restore(); }
  vampFace(ctx, t, { skin: '#a9a3b8', open: 0.05, hair: 'none', ear: 0.3, gaunt: 0.7 });
  const helmP: (Pt | [number, number, number])[] = [[-0.92, 0.7], [-0.97, 0.0], [-0.85, -0.62], [-0.35, -1.12], [0.25, -1.15], [0.7, -0.85], [0.88, -0.4], [0.86, 0.1], [0.74, 0.55, 1], [0.62, -0.22, 1], [-0.42, -0.26, 1], [-0.5, 0.6, 1], [-0.75, 0.8, 1]];
  form(ctx, () => shapePath(ctx, helmP), kind === 'horns' ? BLK2 : '#77737f', [-0.1, -0.5], 1.0, { hi: 0.55, lo: 0.7, tex: 0.3, lw: 1.5 });
  ctx.save(); ctx.beginPath(); shapePath(ctx, helmP); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-0.25, -0.7, 0.35, 0.15, -0.4, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.2, -1.15); ctx.quadraticCurveTo(0.15, -0.7, 0.18, -0.26); ctx.stroke(); ctx.restore();
  if (kind === 'horns') goldEdge(ctx, () => shapePath(ctx, helmP), 0.05);
  rivets(ctx, [[-0.7, -0.4], [-0.35, -0.8], [0.62, -0.6], [-0.72, 0.25], [0.76, 0.0]], 0.045);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-0.42, -0.26, 1.04, 0.18); vampEye(ctx, -0.12, -0.12, 0.1, 0.04, t); vampEye(ctx, 0.45, -0.12, 0.07, 0.035, t); // la sombra del casco sobre los ojos
  if (kind === 'horns') for (const [sx, k] of [[-1, 1], [1, 0.85]] as const) { const o = (x: number, y: number): [number, number] => sx < 0 ? [x, y] : [0.2 + (0.2 - x) * k, y];
    form(ctx, () => shapePath(ctx, [o(-0.55, -0.75), o(-0.95, -0.95), [o(-1.05, -1.55)[0], o(-1.05, -1.55)[1], 1], o(-0.78, -1.1), o(-0.3, -0.95)]), '#d9b46a', o(-0.75, -1.05), 0.5, { hi: 0.45, tex: 0.4, lw: 1.3 }); }
}

// ---------------------------------------------------------------- Vampiro volador
function batWing2(ctx: CanvasRenderingContext2D, root: Pt, side: number, flap: number, size: number) {
  ctx.save(); ctx.translate(root[0], root[1]); ctx.scale(side * size, size); ctx.rotate(-flap * 0.25);
  const elbow: Pt = [0.35, -0.55], wrist: Pt = [0.55, -1.05], tips: Pt[] = [[1.35, -1.0], [1.45, -0.45], [1.15, 0.05], [0.65, 0.3]];
  const mem = () => { ctx.moveTo(0, 0); ctx.lineTo(...elbow); ctx.lineTo(...wrist); ctx.lineTo(...tips[0]); for (let i = 1; i < tips.length; i++) { const a = tips[i - 1], b2 = tips[i]; ctx.quadraticCurveTo(...lerp(mid(a, b2), wrist, 0.25), b2[0], b2[1]); } ctx.quadraticCurveTo(0.3, 0.2, 0.05, 0.15); ctx.closePath(); };
  ctx.beginPath(); mem(); const g = ctx.createLinearGradient(0.3, -0.8, 1.3, 0.2); g.addColorStop(0, '#d01c2a'); g.addColorStop(0.6, '#a0101c'); g.addColorStop(1, '#5a0810'); ctx.fillStyle = g; ctx.fill(); if (VAMP_TEX) grain(ctx, mem, 0.35);
  ctx.save(); ctx.beginPath(); mem(); ctx.clip(); ctx.strokeStyle = 'rgba(60,0,8,0.55)'; ctx.lineWidth = 0.01; for (let i = 0; i < tips.length; i++) for (let k = 1; k < 5; k++) { const a = lerp(wrist, tips[i], k / 5), b2 = lerp(wrist, tips[Math.min(tips.length - 1, i + 1)], k / 5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(...lerp(mid(a, b2), wrist, -0.1), b2[0], b2[1]); ctx.stroke(); } ctx.restore();
  ctx.beginPath(); mem(); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke();
  tube(ctx, [0, 0], elbow, [0.08, 0.065], '#3a3540', { rim: 1, ao: 0, lw: 1.2 }); tube(ctx, elbow, wrist, [0.065, 0.05], '#3a3540', { rim: 1, ao: 0, lw: 1.2 });
  for (const tp of tips.slice(0, 3)) tube(ctx, wrist, tp, [0.04, 0.018], '#2e2a33', { rim: 0, ao: 0, lw: 0.9 });
  form(ctx, () => ctx.ellipse(wrist[0], wrist[1], 0.05, 0.04, 0, 0, TAU), '#c68f2c', wrist, 0.05, { hi: 0.6, lw: 1 }); // la argolla dorada
  form(ctx, () => shapePath(ctx, [[wrist[0] - 0.03, wrist[1] - 0.02], [wrist[0] + 0.02, wrist[1] - 0.18], [wrist[0] + 0.2, wrist[1] - 0.2, 1], [wrist[0] + 0.06, wrist[1] - 0.12], [wrist[0] + 0.04, wrist[1] + 0.01]]), '#e2b04a', wrist, 0.12, { hi: 0.6, lw: 1.1 }); // la garra dorada del ala
  ctx.restore();
}
function drawFlyer2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const diving = v.state === 'dive', flap = diving ? 0.8 : Math.sin(v.walkT * 9 + v.id), bob = Math.sin(v.walkT * 9 + v.id + 1) * 0.04, kick = Math.sin(v.walkT * 4.5 + v.id) * 0.04;
  const r: Pose2 = { lean: diving ? 0.55 : 0.3, crouch: 0.12, bob, head: 0, feet: [[-0.5 + kick, -0.02 + bob], [0.18 - kick, -0.32 + bob]], hands: diving ? (v.t < 0.25 ? [[0.0, -0.55], [0.2, -0.58]] : [[0.45, 0.32], [0.6, 0.2]]) as [Pt, Pt] : [[-0.38, 0.38], [0.5, 0.3]] };
  const b = solve2(r, { ...HUMAN, shW: 0.17 });
  ctx.save(); ctx.translate(0, 0.32); // a la misma altura que el volador de antes
  const blade = add(b.neck, b.spine, -0.12);
  batWing2(ctx, add(blade, b.side, -0.05), -1, flap, 0.85); batWing2(ctx, add(blade, b.side, 0.08), 1, flap, 0.75);
  const leg = (i: number) => { const back = i === 0, kn = b.knee[i], ft = b.foot[i];
    tube(ctx, b.hp[i], kn, [0.26, 0.23, 0.16], dk(BLK, back, 0.35), { bulge: 0.04, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
    tube(ctx, kn, ft, [0.17, 0.17, 0.11], dk(BLK, back, 0.35), { bulge: -0.05, rim: back ? 0 : 1, tex: 0.3, lw: 1.3 });
    const sd = vec(kn, ft); tube(ctx, add(ft, sd, -0.08), ft, [0.075, 0.065], dk(SKIN, back, 0.3), { rim: 0, lw: 1.1 });
    wolfPaw(ctx, ft, back, SKIN, '#2a1418', ft[1] + 0.06, 0.95); // pie con garras, como el del lobo
    joint(ctx, kn, 0.065, back, '#5d5964', vec(kn, ft)); };
  leg(0); leg(1);
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.scale(BROAD, 1);
  const torso = () => shapePath(ctx, [[-0.12, 0.02], [-0.13, -0.3], [-0.19, -0.56], [-0.11, -0.65], [0.14, -0.65], [0.19, -0.56], [0.14, -0.3], [0.12, 0.02]]);
  form(ctx, torso, SKIN, [0, -0.35], 0.4, { tex: 0.3, lw: 1.3 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.strokeStyle = 'rgba(60,30,80,0.45)'; ctx.lineWidth = 0.012; for (let k = 0; k < 4; k++) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.02 + sx * 0.02, -0.46 + k * 0.08); ctx.quadraticCurveTo(0.02 + sx * 0.1, -0.44 + k * 0.08, 0.02 + sx * 0.15, -0.38 + k * 0.085); ctx.stroke(); }
  line(ctx, [[0.02, -0.58], [0.02, -0.12]], 0.012, 'rgba(60,30,80,0.45)');
  for (const sx of [-1, 1]) { const vst = () => shapePath(ctx, [[0.03 + sx * 0.2, -0.67], [0.03 + sx * 0.09, -0.67], [0.03 + sx * 0.06, -0.35, 1], [0.03 + sx * 0.09, 0.02], [0.03 + sx * 0.2, 0.02]]); form(ctx, vst, BLK, [0.03 + sx * 0.14, -0.3], 0.3, { rim: 0, tex: 0.4 }); goldEdge(ctx, vst, 0.01); } // el chaleco abierto
  ctx.restore();
  trimmed(ctx, [[-0.15, -0.06], [0.17, -0.06], [0.2, 0.12, 1], [0.05, 0.1], [0.03, 0.17, 1], [0.0, 0.1], [-0.17, 0.12, 1]], REDD, [0.02, 0.04], 0.2, false, 0.015); // el short rojo con borde dorado
  form(ctx, () => ctx.roundRect(-0.15, -0.075, 0.32, 0.055, 0.01), RED, [0, -0.05], 0.15, { rim: 0, lw: 1.1 }); trimmed(ctx, [[-0.01, -0.09, 1], [0.07, -0.09, 1], [0.07, -0.01, 1], [-0.01, -0.01, 1]], '#c68f2c', [0.03, -0.05], 0.05, false, 0.01, { hi: 0.6 });
  ctx.restore();
  const arm = (i: number) => { const back = i === 0, sk = dk(SKIN, back, 0.25), fd = vec(b.elbow[i], b.hand[i]), fn: Pt = [fd[1], -fd[0]];
    tube(ctx, b.sh[i], b.elbow[i], [0.15, 0.14, 0.1], sk, { bulge: 0.1, rim: back ? 0 : 1, lw: 1.2 }); tube(ctx, b.elbow[i], b.hand[i], [0.12, 0.115, 0.085], sk, { rim: back ? 0 : 1, lw: 1.2 });
    const c0 = lerp(b.elbow[i], b.hand[i], 0.45), c1 = add(b.hand[i], fd, -0.02); trimmed(ctx, [add(c0, fn, 0.05), add(c1, fn, 0.055), add(c1, fn, -0.055), add(c0, fn, -0.05)].map(p => [p[0], p[1], 1] as [number, number, number]), RED, lerp(c0, c1, 0.5), 0.1, back, 0.012); // brazal rojo
    clawHand(ctx, add(b.hand[i], fd, 0.02), Math.atan2(fd[0], fd[1]), SKIN, back, 0.3, '#1c1218', 1.3); };
  arm(0);
  arm(1);
  headAt(ctx, b, -0.1, 0.155, () => vampFace(ctx, t + v.id, { skin: SKIN, open: 0.8, hair: 'wild', ear: 1.0, gaunt: 1.0 }));
  ctx.restore();
}

// ---------------------------------------------------------------- Vampiro gigante
function drawGiant2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const st = stance(v, t, { lean: 0.06, crouch: 0.12, wide: 1.05, lift: 0.2 }), br = Math.sin(t * 2.4 + v.id) * 0.02, sk = '#a29eae';
  // la caminata: la misma que Demian (muslo y canilla con los mismos ángulos, el pie que se levanta y pasa adelante,
  // los brazos que van y vienen al revés que las piernas, el cuerpo que sube y baja), con las medidas del gigante
  const moving = v.onGround && Math.abs(v.vx) > 0.3, gw = v.walkT * 1.4, sn = Math.sin(gw);
  let hands: [Pt, Pt] = [[0.02, 0.6 + br], [0.14, 0.58 - br]];
  if (moving) {
    st.bob = Math.abs(sn) * 0.06; st.lean = 0.16; st.crouch = 0.08;
    const L = BRUTE.thigh + BRUTE.shin, hip: Pt = [0, -L * (1 - st.crouch) + st.bob];
    const legs: [number, number][] = [[0.6 * sn, 0.15 + 0.85 * Math.max(0, Math.cos(gw))], [-0.6 * sn, 0.15 + 0.85 * Math.max(0, -Math.cos(gw))]]; // (como Demian, un poco más corto; arranca la pierna del lado hacia donde va)
    st.feet = legs.map(([ta, kb]) => { const k = add(hip, dirv(ta), BRUTE.thigh), f = add(k, dirv(ta - kb), BRUTE.shin); return [f[0], Math.min(0, f[1])] as Pt; }) as [Pt, Pt];
    const arms: [number, number][] = [[-0.75 * sn, 0.3 + Math.max(0, -sn) * 0.5], [0.75 * sn, 0.3 + Math.max(0, sn) * 0.5]]; // (al revés que las piernas; el que va adelante dobla el codo)
    hands = arms.map(([ua, eb]) => add(add([0, 0], dirv(ua), BRUTE.upper), dirv(ua + eb), BRUTE.fore)) as [Pt, Pt];
  }
  hands = swipeArms(v, hands, { up: [[-0.04, -0.72], [0.16, -0.74]], hit: [[0.6, 0.36], [0.74, 0.3]], walk: false }); // los dos puños juntos, de arriba hacia abajo
  const r: Pose2 = { ...st, hands }, b = solve2(r, { ...BRUTE, shW: -0.2, hipW: -0.1 }); // hombros separados como el vampiro común; el brazo y la pierna del lado hacia donde va quedan atrás del cuerpo (se dibujan primero) y la cadera, de perfil
  shadowOn(ctx, v, 0.75);
  ctx.save(); ctx.scale(1.22, 1.22); // tan alto como el gigante de antes
  const leg = (i: number) => { leg2(ctx, b, i, '#2a2630', 1.45, true, '#1a171e'); };
  leg(0); leg(1);
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.translate(0.07, 0); ctx.scale(BROAD * 0.5, 1); // de perfil (más angosto, con el pecho para adelante)
  const torso = () => shapePath(ctx, [[-0.25, 0.04], [-0.29, -0.25], [-0.38, -0.56], [-0.25, -0.72], [0.27, -0.72], [0.38, -0.56], [0.3, -0.25], [0.24, 0.04]]);
  form(ctx, torso, sk, [0, -0.4], 0.55, { tex: 0.4, lw: 1.4 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.strokeStyle = 'rgba(60,40,80,0.5)'; ctx.lineWidth = 0.018; ctx.beginPath(); for (const sx of [-1, 1]) { ctx.moveTo(0.0, -0.6); ctx.quadraticCurveTo(sx * 0.18, -0.38, sx * 0.33, -0.52); } ctx.moveTo(0, -0.4); ctx.lineTo(0, -0.05); for (const y of [-0.28, -0.17, -0.07]) { ctx.moveTo(-0.12, y); ctx.quadraticCurveTo(0, y + 0.02, 0.12, y); } ctx.stroke();
  for (const [a, b2] of [[[-0.3, -0.72], [0.3, -0.08]]] as [Pt, Pt][]) { tube(ctx, a, b2, [0.08, 0.08], LEATHER, { rim: 0, ao: 0, tex: 0.5, lw: 1.1 }); }
  ctx.restore();
  form(ctx, () => ctx.arc(0.14, -0.42, 0.075, 0, TAU), '#c68f2c', [0.14, -0.42], 0.08, { hi: 0.6, lw: 1.2 }); gem(ctx, 0.14, -0.42, 0.05, t, '#c68f2c'); // (el broche, del lado del pecho que se ve)
  const loin = () => shapePath(ctx, [[-0.02, 0.0], [0.24, 0.0], [0.17, 0.3, 1], [0.1, 0.24, 1], [0.06, 0.42, 1], [0.0, 0.3, 1], [-0.06, 0.46, 1], [-0.1, 0.28, 1], [-0.16, 0.34, 1]]);
  form(ctx, loin, RED, [0, 0.2], 0.3, { tex: 0.45, lw: 1.2 }); // el taparrabos rojo roto
  for (const sx of [-1, 1]) form(ctx, () => shapePath(ctx, [[sx * 0.2, 0.0], [sx * 0.26, 0.0], [sx * 0.3, 0.22, 1], [sx * 0.24, 0.16, 1]]), REDD, [sx * 0.24, 0.1], 0.15, { lw: 1 });
  belt2(ctx, -0.03, -0.25, 0.25);
  ctx.restore();
  const arm = (i: number) => { const back = i === 0, c = dk(sk, back, 0.2), el = b.elbow[i], hd = b.hand[i], fd = vec(el, hd), fn: Pt = [fd[1], -fd[0]];
    tube(ctx, b.sh[i], el, [0.22, 0.24, 0.17], c, { bulge: 0.12, rim: back ? 0 : 1, tex: 0.35, lw: 1.3 });
    tube(ctx, el, hd, [0.18, 0.19, 0.15], c, { bulge: 0.1, rim: back ? 0 : 1, tex: 0.35, lw: 1.3 });
    const c0 = lerp(el, hd, 0.25), c1 = add(hd, fd, -0.02); // el brazal negro con tachas y bordes dorados
    trimmed(ctx, [add(c0, fn, 0.12), add(c1, fn, 0.12), add(c1, fn, -0.12), add(c0, fn, -0.12)].map(p => [p[0], p[1], 1] as [number, number, number]), BLK2, lerp(c0, c1, 0.5), 0.15, back, 0.02, { hi: 0.5 });
    for (let k = 0; k < 3; k++) for (const s2 of [-1, 0, 1]) { const p = add(lerp(c0, c1, 0.25 + k * 0.25), fn, s2 * 0.07); form(ctx, () => ctx.arc(p[0], p[1], 0.016, 0, TAU), '#d9a23a', p, 0.02, { hi: 0.7, rim: 0, ao: 0, lw: 0.6 }); }
    { // la codera de hierro con pinches (tapa la unión del brazo)
      const ud = vec(b.sh[i], el), out: Pt = [ud[1] * -1, ud[0]];
      form(ctx, () => ctx.ellipse(el[0], el[1], 0.15, 0.13, Math.atan2(ud[1], ud[0]), 0, TAU), back ? '#141116' : BLK2, el, 0.16, { hi: 0.55, lw: 1.3 });
      ctx.strokeStyle = back ? '#7a5a1e' : '#c68f2c'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.ellipse(el[0], el[1], 0.12, 0.1, Math.atan2(ud[1], ud[0]), 0, TAU); ctx.stroke();
      const o2: Pt = out[0] < 0 ? [-out[0], -out[1]] : out; // (los pinches para atrás, el lado de afuera del codo)
      for (const a of [-0.8, 0, 0.8]) { const d: Pt = [-(o2[0] * Math.cos(a) - o2[1] * Math.sin(a)), -(o2[0] * Math.sin(a) + o2[1] * Math.cos(a))], base = add(el, d, 0.11), n: Pt = [d[1], -d[0]]; form(ctx, () => shapePath(ctx, [add(base, n, 0.04), add(base, d, 0.16), add(base, n, -0.04)]), back ? '#6a5a40' : '#d9c79a', base, 0.05, { hi: 0.6, rim: 0, ao: 0, lw: 0.8 }); }
    }
    gauntlet(ctx, add(hd, fd, 0.05), Math.atan2(fd[0], fd[1]), sk, back, 1.75); // el puño enorme
    { const hc = add(hd, fd, 0.05); ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(-Math.atan2(fd[0], fd[1])); ctx.scale(1.75, 1.75); form(ctx, () => shapePath(ctx, [[0.06, 0.07], [0.09, 0.065], [0.085, 0.15, 1], [0.065, 0.1]]), '#141116', [0.075, 0.1], 0.04, { hi: 0.6, rim: 0, ao: 0, lw: 0.8 }); ctx.restore(); } // la uña negra del pulgar
    { const hc = add(hd, fd, 0.05); ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(-Math.atan2(fd[0], fd[1])); ctx.scale(1.75, 1.75); // pinches negros en los nudillos
      for (let k = 0; k < 4; k++) { const x = -0.05 + k * 0.033; form(ctx, () => shapePath(ctx, [[x - 0.016, 0.115], [x, 0.19, 1], [x + 0.016, 0.115]]), '#1a171e', [x, 0.14], 0.04, { hi: 0.6, rim: 0, ao: 0, lw: 0.8 }); }
      ctx.restore(); }
  };
  arm(0);
  spikedPad(ctx, add(b.sh[0], b.spine, 0.0), 0.85, 3, true);
  arm(1);
  spikedPad(ctx, add(b.sh[1], b.spine, 0.0), 1.0, 3);
  { const c = add(add(b.neck, b.spine, 0.19), b.side, 0.04); ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(0.23, 0.23); bruteHead(ctx, t + v.id, v.state === 'claw' ? 0.6 : 0.25); ctx.restore(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Vampiro mago
function drawMage2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const cast = v.state === 'cast' || v.state === 'claw' ? Math.min(1, v.t / 0.4) : 0, br = Math.sin(t * 2 + v.id);
  const st = stance(v, t, { lean: 0.03, crouch: 0.05, wide: 1.0 });
  const r: Pose2 = { ...st, hands: [swipeArms(v, [[-0.22, 0.54 + br * 0.01], [0, 0]])[0], [0.3 + cast * 0.18, 0.32 - cast * 0.32]] }, b = solve2(r, { ...HUMAN, shW: 0.19 }); // el brazo izquierdo cuelga; al atacar apunta el báculo
  shadowOn(ctx, v, 0.6);
  cape2(ctx, b, t + v.id, { len: 1.32, flare: 1.15, collar: false });
  // la túnica: negra con paneles rojos, voluta dorada en el borde y el faldón rojo del medio
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.scale(BROAD, 1);
  const sway = Math.sin(t * 2 + v.id) * 0.02, hemY = -b.hip[1] - 0.04;
  const robeP: (Pt | [number, number, number])[] = [[-0.18, -0.66], [0.2, -0.66], [0.22, -0.3], [0.24, 0.1], [0.42 + sway, hemY, 1], [-0.4 + sway, hemY, 1], [-0.26, 0.1], [-0.22, -0.3]];
  form(ctx, () => shapePath(ctx, robeP), BLK, [0, -0.2], 0.85, { tex: 0.35, lw: 1.4 });
  ctx.save(); ctx.beginPath(); shapePath(ctx, robeP); ctx.clip();
  for (const sx of [-1, 1]) form(ctx, () => shapePath(ctx, [[0.03 + sx * 0.1, -0.1], [0.03 + sx * 0.19, -0.1], [0.03 + sx * 0.36 + sway, hemY, 1], [0.03 + sx * 0.16 + sway, hemY, 1]]), REDD, [0.03 + sx * 0.2, hemY * 0.5], 0.4, { rim: 0, tex: 0.4, lw: 1 }); // paneles rojos
  for (let k = 0; k < 7; k++) curve(ctx, [-0.2 + k * 0.07, 0.1], [-0.25 + k * 0.1 + sway, hemY * 0.6], [-0.36 + k * 0.12 + sway, hemY], 0.014, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.014; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(0.03 + sx * 0.28 + sway, hemY - 0.09, 0.05, 0, Math.PI * 1.6); ctx.stroke(); } // volutas doradas
  ctx.restore(); goldEdge(ctx, () => shapePath(ctx, robeP), 0.018);
  tabard(ctx, 0.03, -0.05, hemY - 0.12, 0.17, RED, 'diamond', sway);
  ctx.fillStyle = GOLDC; ctx.strokeStyle = INK; ctx.lineWidth = 0.005; for (let k = 0; k < 3; k++) { const y = 0.12 + k * 0.14; ctx.beginPath(); ctx.moveTo(0.03, y - 0.04); ctx.lineTo(0.065, y); ctx.lineTo(0.03, y + 0.04); ctx.lineTo(-0.005, y); ctx.closePath(); ctx.stroke(); } // rombos del faldón
  belt2(ctx, -0.06, -0.2, 0.22);
  form(ctx, () => ctx.roundRect(-0.2, -0.04, 0.11, 0.13, 0.02), LEATHER, [-0.15, 0.02], 0.08, { tex: 0.5, lw: 1.1 }); ctx.fillStyle = '#4a2a16'; ctx.fillRect(-0.2, -0.04, 0.11, 0.04); form(ctx, () => ctx.arc(-0.145, 0.0, 0.012, 0, TAU), GOLDC, [-0.145, 0], 0.015, { rim: 0, ao: 0, lw: 0.5 }); // la bolsa
  // el pecho: rojo con alamares dorados y la gema
  form(ctx, () => shapePath(ctx, [[-0.08, -0.66], [0.14, -0.66], [0.12, -0.08], [-0.06, -0.08]]), RED, [0.03, -0.38], 0.3, { tex: 0.35, lw: 1.1 });
  for (let k = 0; k < 4; k++) { const y = -0.48 + k * 0.1; ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.04, y); ctx.lineTo(0.1, y); ctx.stroke(); }
  ctx.restore();
  for (let i = 0; i < 2; i++) { const f = b.foot[i]; ctx.save(); ctx.translate(f[0] + (i ? 0.08 : -0.08), -0.02); form(ctx, () => shapePath(ctx, [[-0.05, -0.04], [0.12, -0.03], [0.19, 0.02, 1], [-0.06, 0.02, 1]]), dk('#16131a', i === 0), [0.05, 0], 0.1, { rim: 0, lw: 1.2 }); ctx.restore(); }
  // la mano izquierda con la bola de fuego
  const sleeve = (i: number) => { const el = b.elbow[i], hd = b.hand[i], d = vec(el, hd), n: Pt = [d[1], -d[0]]; tube(ctx, b.sh[i], el, [0.15, 0.15, 0.14], BLK, { rim: 1, tex: 0.35, lw: 1.3 });
    const sl: (Pt | [number, number, number])[] = [add(el, n, 0.07), add(add(hd, d, -0.04), n, 0.15), [add(add(hd, d, 0.0), n, 0.17)[0], add(add(hd, d, 0.0), n, 0.17)[1], 1], [add(add(hd, d, 0.0), n, -0.12)[0], add(add(hd, d, 0.0), n, -0.12)[1], 1], add(el, n, -0.07)];
    trimmed(ctx, sl, BLK, mid(el, hd), 0.25, false, 0.02, { tex: 0.35 });
    const c0 = add(hd, d, -0.08); ctx.strokeStyle = RED; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(...add(c0, n, 0.14)); ctx.lineTo(...add(c0, n, -0.11)); ctx.stroke(); return d; };
  const d0 = sleeve(0), hd0 = b.hand[0];
  clawHand(ctx, add(hd0, d0, 0.03), Math.atan2(d0[0], d0[1]), SKIN, false, 0.35, '#1c1218', 1.25);
  sleeve(1); // el brazo derecho también va por debajo de la esclavina
  // capucha y esclavina de dos capas con borde dorado
  const nk = add(b.neck, b.spine, -0.02);
  for (const [w, y, c] of [[0.36, 0.2, BLK], [0.3, 0.1, BLK2]] as const) trimmed(ctx, [[nk[0] - w, nk[1] + y], [nk[0] - w * 0.9, nk[1] - 0.04], [nk[0], nk[1] - 0.08], [nk[0] + w * 0.85, nk[1] - 0.04], [nk[0] + w * 0.9, nk[1] + y, 1], [nk[0], nk[1] + y * 0.6], [nk[0] - w, nk[1] + y, 1]], c, [nk[0], nk[1] + y * 0.4], w, false, 0.02);
  gem(ctx, nk[0] + 0.02, nk[1] + 0.02, 0.035, t, GOLDC);
  headAt(ctx, b, 0.03, 0.15, () => {
    const hood = () => shapePath(ctx, [[-1.25, 1.1], [-1.25, 0.2], [-1.05, -0.65], [-0.5, -1.25], [0.25, -1.35], [0.8, -0.95], [1.05, -0.25], [1.15, 0.6], [1.25, 1.1]]);
    form(ctx, hood, BLK, [-0.1, -0.3], 1.4, { tex: 0.4, lw: 1.5 });
    ctx.save(); ctx.beginPath(); ctx.ellipse(0.05, 0.12, 0.8, 1.0, 0.04, 0, TAU); ctx.clip(); ctx.fillStyle = RED; ctx.fillRect(-1.2, -1.3, 2.5, 2.7); ctx.fillStyle = '#0a0608'; ctx.beginPath(); ctx.ellipse(0.05, 0.18, 0.7, 0.92, 0.04, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0.02, 0.15); ctx.scale(0.88, 0.88); vampFace(ctx, t + v.id, { skin: '#a29db0', open: cast > 0 ? 0.4 : 0.05, hair: 'none', ear: 0.3, gaunt: 1.0 }); ctx.restore();
    const sg = ctx.createLinearGradient(0, -1, 0, 0.5); sg.addColorStop(0, 'rgba(0,0,0,0.9)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(-1.2, -1.3, 2.5, 2.7);
    ctx.restore();
    for (const [x, rx] of [[-0.1, 0.13], [0.46, 0.09]] as const) vampEye(ctx, x, 0.05, rx * 0.65, 0.045, t + v.id);
    goldEdge(ctx, () => { ctx.ellipse(0.05, 0.12, 0.8, 1.0, 0.04, 0, TAU); }, 0.04);
  });
  // el báculo dorado con la estrella y la gema, agarrado con la mano derecha
  const hd = b.hand[1], sd = dirv(Math.PI - 0.03 - cast * 1.33), st0 = lerp([hd[0] + 0.015, 0], add(hd, sd, -0.55), cast), st1 = add(hd, sd, 0.95); // parado en el piso, o apuntando al cazador
  tube(ctx, st0, st1, [0.05, 0.05], '#a01c20', { rim: 1, ao: 0, tex: 0.3, lw: 1.2 });
  ctx.save(); ctx.beginPath(); smooth(ctx, tubePts(st0, st1, [0.05, 0.05])); ctx.clip(); ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.014; for (let k = 0; k < 18; k++) { const p = lerp(st0, st1, k / 18); ctx.beginPath(); ctx.moveTo(p[0] - 0.03, p[1] + 0.02); ctx.lineTo(p[0] + 0.03, p[1] - 0.02); ctx.stroke(); } ctx.restore(); // la espiral dorada
  for (const k of [0.12, 0.5, 0.85]) { const p = lerp(st0, st1, k); trimmed(ctx, [[p[0] - 0.04, p[1] - 0.02, 1], [p[0] + 0.04, p[1] - 0.02, 1], [p[0] + 0.04, p[1] + 0.02, 1], [p[0] - 0.04, p[1] + 0.02, 1]], '#c68f2c', p, 0.04, false, 0.008, { hi: 0.6 }); }
  form(ctx, () => shapePath(ctx, [[st0[0] - 0.035, st0[1] - 0.08], [st0[0] + 0.035, st0[1] - 0.08], [st0[0], st0[1] + 0.04, 1]]), GOLDC, st0, 0.06, { hi: 0.6, lw: 1 }); // la punta de abajo
  const top = add(st1, sd, 0.18); ctx.save(); ctx.translate(top[0], top[1]); ctx.rotate(t * 0.3 * 0);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, L2 = k % 2 ? 0.13 : 0.2; form(ctx, () => shapePath(ctx, [[Math.cos(a - 0.25) * 0.08, Math.sin(a - 0.25) * 0.08], [Math.cos(a) * L2, Math.sin(a) * L2, 1], [Math.cos(a + 0.25) * 0.08, Math.sin(a + 0.25) * 0.08]]), GOLDC, [Math.cos(a) * 0.1, Math.sin(a) * 0.1], 0.08, { hi: 0.6, lw: 1 }); }
  ctx.beginPath(); ctx.arc(0, 0, 0.1, 0, TAU); ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.035; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 0.008; ctx.stroke();
  ctx.restore();
  glow(ctx, top[0], top[1], 0.35, '#ff2030', 0.5 + 0.15 * Math.sin(t * 4)); gem(ctx, top[0], top[1], 0.055, t, GOLDC);
  if (cast > 0) { const ball = add(top, sd, 0.12 + cast * 0.12), rr = 0.05 + cast * 0.07; // la pelota de energía roja que va a tirar
    glow(ctx, ball[0], ball[1], rr * 4, '#ff1a2a', 0.8); form(ctx, () => ctx.arc(ball[0], ball[1], rr, 0, TAU), '#ff3040', ball, rr, { hi: 0.8, rim: 0, lw: 0.6 }); glow(ctx, ball[0], ball[1], rr * 0.7, '#fff0f0', 0.9);
    for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.57; ctx.strokeStyle = 'rgba(255,120,130,0.8)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(ball[0], ball[1], rr * 1.5, a, a + 1.0); ctx.stroke(); } }
  gripFist(ctx, hd, sd, SKIN, false, false, 1.1);
}

// ---------------------------------------------------------------- Vampiro martillo
function hammer2(ctx: CanvasRenderingContext2D, g0: Pt, d: Pt, t: number) {
  const n: Pt = [d[1], -d[0]], bot = add(g0, d, -0.5), head = add(g0, d, 1.0);
  tube(ctx, bot, head, [0.085, 0.09], '#8a3a1e', { rim: 1, ao: 0, tex: 0.5, lw: 1.3 }); // el mango de madera rojiza
  ctx.save(); ctx.beginPath(); smooth(ctx, tubePts(bot, head, [0.075, 0.08])); ctx.clip(); ctx.strokeStyle = 'rgba(50,15,5,0.55)'; ctx.lineWidth = 0.008; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(...add(bot, n, k * 0.02)); ctx.lineTo(...add(head, n, k * 0.02)); ctx.stroke(); } ctx.restore(); // vetas
  for (const k of [0.0, 0.42, 0.78]) { const p = add(bot, d, k * 1.1); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-Math.atan2(d[0], d[1])); trimmed(ctx, [[-0.05, -0.025, 1], [0.05, -0.025, 1], [0.05, 0.025, 1], [-0.05, 0.025, 1]], '#c68f2c', [0, 0], 0.05, false, 0.008, { hi: 0.6 }); ctx.restore(); } // anillos dorados
  { const p = add(bot, d, -0.05); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-Math.atan2(d[0], d[1])); trimmed(ctx, [[-0.06, -0.05, 1], [0.06, -0.05, 1], [0.05, 0.04, 1], [-0.05, 0.04, 1]], '#c68f2c', [0, 0], 0.06, false, 0.01, { hi: 0.6 }); ctx.restore(); } // el pomo
  ctx.save(); ctx.translate(head[0], head[1]); ctx.rotate(-Math.atan2(d[0], d[1])); ctx.scale(1.1, 1.1);
  const blockP: (Pt | [number, number, number])[] = [[-0.3, -0.18, 1], [0.3, -0.18, 1], [0.32, 0.18, 1], [-0.32, 0.18, 1]];
  form(ctx, () => shapePath(ctx, blockP), '#8d8a94', [0, 0], 0.35, { hi: 0.5, lo: 0.7, tex: 0.5, lw: 1.5 });
  for (const sx of [-1, 1]) form(ctx, () => shapePath(ctx, [[sx * 0.3, -0.2, 1], [sx * 0.4, -0.16, 1], [sx * 0.4, 0.16, 1], [sx * 0.3, 0.2, 1]]), '#77737e', [sx * 0.35, 0], 0.15, { hi: 0.5, lw: 1.3 }); // las caras de golpe
  for (const [x, y] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18], [-0.4, 0.0], [0.4, 0.0]] as const) form(ctx, () => shapePath(ctx, [[x - 0.035, y - Math.sign(y || x) * 0.0], [x + (y ? 0 : Math.sign(x) * 0.1), y + Math.sign(y) * 0.1, 1], [x + 0.035, y]]), '#a9a6b0', [x, y], 0.06, { hi: 0.6, lw: 1 }); // pinches
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.008; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(-0.25 + k * 0.08, -0.15 + (k % 3) * 0.04); ctx.lineTo(-0.2 + k * 0.08, -0.1 + (k % 2) * 0.12); ctx.stroke(); } // grietas
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 0.22, '#ff2030', 0.55 + 0.15 * Math.sin(t * 4)); ctx.restore();
  ctx.fillStyle = '#ff3040'; ctx.fillRect(-0.025, -0.12, 0.05, 0.24); ctx.fillRect(-0.11, -0.025, 0.22, 0.05); ctx.fillStyle = '#ffd0d0'; ctx.fillRect(-0.008, -0.1, 0.016, 0.2); ctx.fillRect(-0.09, -0.008, 0.18, 0.016); // la cruz que brilla
  ctx.restore();
}
function drawHammer2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  // El martillo: lo lleva en alto apoyado en el hombro; para atacar lo sube bien atrás por arriba de la cabeza
  // (el cuerpo se tira para atrás), lo baja de golpe contra el piso (el cuerpo se dobla para adelante) y se queda
  // un instante con el martillo clavado antes de volver a levantarlo.
  const st0 = stance(v, t, { lean: 0.04, crouch: 0.15, wide: 1.5 }), br = Math.sin(t * 2.2 + v.id) * 0.03, air = v.onGround ? 0 : 1;
  const hipY = -(HUMAN.thigh + HUMAN.shin) * (1 - st0.crouch), walk = Math.abs(v.vx) > 0.3 ? Math.sin(v.walkT * 3) * 0.08 : 0;
  const idle = { ang: 2.75 + br + walk - air * 0.2, g: [0.14, hipY - 0.36 - air * 0.2] as Pt, lean: st0.lean, crouch: st0.crouch };
  const back = { ang: Math.PI + 0.75, g: [-0.12, hipY - 0.92] as Pt, lean: -0.3, crouch: 0.02 };
  const slam = { ang: 0.95, g: [0.52, hipY + 0.06] as Pt, lean: 0.55, crouch: 0.3 };
  let k = idle;
  if (v.state === 'claw') {
    const a = ATTACK.hammer ?? { at: 0.72, dur: 1.2 }, w0 = a.at - 0.16, tt = v.t;
    const mix = (A: typeof idle, B: typeof idle, q: number) => ({ ang: A.ang + (B.ang - A.ang) * q, g: lerpPt(A.g, B.g, q), lean: A.lean + (B.lean - A.lean) * q, crouch: A.crouch + (B.crouch - A.crouch) * q });
    if (tt < w0) k = mix(idle, back, ease(tt / w0)); // lo levanta bien atrás
    else if (tt < a.at) { const q = (tt - w0) / (a.at - w0); k = mix(back, slam, q * q); } // ¡baja de golpe! (acelerando)
    else if (tt < a.at + 0.22) k = { ...slam, g: [slam.g[0], slam.g[1] + Math.sin((tt - a.at) * 40) * 0.015] }; // clavado en el piso, temblando
    else k = mix(slam, idle, ease((tt - a.at - 0.22) / Math.max(0.1, a.dur - a.at - 0.22)));
  }
  const hAng = k.ang, d = dirv(hAng), g0 = k.g, g1 = add(g0, d, 0.34);
  const st = { ...st0, lean: k.lean, crouch: k.crouch };
  const r: Pose2 = { ...st, hands: [g0, g1], abs: [true, true], elbows: [1, -1] }, b = solve2(r, { ...HUMAN, shW: 0.23 });
  shadowOn(ctx, v, 0.65);
  cape2(ctx, b, t + v.id, { len: 1.12, flare: 1.15, outer: '#8e0b17', inner: '#6a0810', collar: false });
  plateLeg2(ctx, b, 0, 1.15); plateLeg2(ctx, b, 1, 1.15);
  plateTorso2(ctx, b, t, { tab: 0, gemBelt: false });
  spikedPad(ctx, add(b.sh[0], b.spine, 0.0), 0.9, 3, true);
  spikedPad(ctx, add(b.sh[1], b.spine, 0.0), 0.9, 3);
  hammer2(ctx, g0, d, t);
  plateArm2(ctx, b, 0, d); plateArm2(ctx, b, 1, d);
  headAt(ctx, b, 0.02, 0.15, () => knightHelm(ctx, t + v.id, 'horns'));
}

// ---------------------------------------------------------------- Vampiro guerrero
function sword2(ctx: CanvasRenderingContext2D, hand: Pt, d: Pt, t: number) {
  const n: Pt = [d[1], -d[0]], b0 = add(hand, d, 0.1), b1 = add(hand, d, 1.05);
  tube(ctx, add(hand, d, -0.12), add(hand, d, 0.06), [0.045, 0.045], '#5a1a10', { rim: 0, ao: 0, lw: 1 });
  form(ctx, () => ctx.arc(...add(hand, d, -0.15), 0.04, 0, TAU), GOLDC, add(hand, d, -0.15), 0.04, { hi: 0.6, lw: 1 }); gem(ctx, ...add(hand, d, -0.15), 0.016, t, GOLDC);
  trimmed(ctx, [add(add(b0, n, 0.2), d, 0.05), add(b0, n, 0.05), add(add(b0, n, -0.2), d, 0.05), add(add(b0, n, -0.22), d, -0.03), add(b0, d, -0.04), add(add(b0, n, 0.22), d, -0.03)], '#c68f2c', b0, 0.2, false, 0.01, { hi: 0.6 }); // guarda dorada
  const w = 0.06, blade = () => shapePath(ctx, [add(b0, n, w), add(add(b1, d, -0.2), n, w * 0.85), [b1[0], b1[1], 1], add(add(b1, d, -0.2), n, -w * 0.85), add(b0, n, -w)]);
  ctx.beginPath(); blade(); ctx.fillStyle = (() => { const g = ctx.createLinearGradient(...add(b0, n, w), ...add(b0, n, -w)); g.addColorStop(0, '#eef1f6'); g.addColorStop(0.5, '#a9afbd'); g.addColorStop(0.52, '#6a707e'); g.addColorStop(1, '#4a4f5c'); return g; })(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.016; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; line(ctx, [add(b0, d, 0.06), add(b1, d, -0.22)], 0.06, `rgba(255,30,40,${0.3 + 0.15 * Math.sin(t * 5)})`); ctx.restore();
  line(ctx, [add(b0, d, 0.06), add(b1, d, -0.22)], 0.022, '#e01828'); line(ctx, [add(b0, d, 0.06), add(b1, d, -0.22)], 0.008, '#ffb0b0'); // el canal rojo que brilla
}
function shield2(ctx: CanvasRenderingContext2D, c: Pt, tilt: number) {
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(tilt); ctx.scale(0.85, 1);
  const P: (Pt | [number, number, number])[] = [[-0.28, -0.36, 1], [0.0, -0.4], [0.28, -0.36, 1], [0.27, 0.05], [0.0, 0.46, 1], [-0.27, 0.05]];
  trimmed(ctx, P, BLK2, [0, -0.05], 0.5, false, 0.045, { hi: 0.5, tex: 0.35 });
  ctx.fillStyle = '#c41424'; ctx.strokeStyle = INK; ctx.lineWidth = 0.01; ctx.beginPath(); // el murciélago rojo
  ctx.moveTo(0, -0.12); for (const sx of [1, -1]) { ctx.quadraticCurveTo(sx * 0.08, -0.16, sx * 0.2, -0.14); ctx.lineTo(sx * 0.16, -0.06); ctx.lineTo(sx * 0.12, -0.02); ctx.lineTo(sx * 0.08, 0.04); ctx.lineTo(sx * 0.03, 0.02); ctx.lineTo(0, 0.25); if (sx > 0) ctx.lineTo(0, -0.12); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(-0.12, -0.2, 0.12, 0.06, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawWarrior2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const st = stance(v, t, { lean: 0.03, crouch: 0.15, wide: 1.55 }), br = Math.sin(t * 2.4 + v.id) * 0.02;
  const slash = v.state === 'claw' ? (v.t < 0.25 ? v.t / 0.25 : Math.max(0, 1 - (v.t - 0.25) * 4)) : 0;
  const air = v.onGround ? 0 : 1;
  const r: Pose2 = { ...st, hands: [[-0.14 + air * 0.06, 0.4 + br - air * 0.45], [0.44 + slash * 0.1, 0.28 - slash * 0.5 - air * 0.55]] }, b = solve2(r, { ...HUMAN, shW: 0.21 });
  shadowOn(ctx, v, 0.65);
  cape2(ctx, b, t + v.id, { len: 1.12, flare: 1.2, outer: '#8e0b17', inner: '#6a0810', collar: false });
  plateLeg2(ctx, b, 0, 1.08); plateLeg2(ctx, b, 1, 1.08);
  plateTorso2(ctx, b, t, { tab: 0.4, motif: 'fleur', gemBelt: true });
  spikedPad(ctx, add(b.sh[0], b.spine, 0.0), 0.8, 0, true);
  plateArm2(ctx, b, 0);
  shield2(ctx, add(lerp(b.elbow[0], b.hand[0], 0.5), [-0.08, 0.02], 1), -0.08); // el escudo en el brazo izquierdo
  const sd = vec([0, 0], dirv(Math.PI - 0.55 + slash * 1.9 - br));
  sword2(ctx, b.hand[1], sd, t);
  plateArm2(ctx, b, 1, sd);
  spikedPad(ctx, add(b.sh[1], b.spine, 0.0), 0.8, 0);
  headAt(ctx, b, 0.02, 0.15, () => knightHelm(ctx, t + v.id, 'plume'));
}

// ---------------------------------------------------------------- Hombre lobo
const WFUR = '#5d5a62', WFUR_D = '#3a373f', WSKIN = '#7a7680';
// La cabeza del lobo (gruñendo, mirando a la derecha), en unidades de la cabeza.
function wolfHead(ctx: CanvasRenderingContext2D, t: number, open: number) {
  for (const [sx, k] of [[-1, 1], [1, 0.85]] as const) { const ox = sx < 0 ? -0.55 : 0.25; furForm(ctx, [[ox - 0.28 * k, -0.4], [ox + 0.05, -1.45 * k], [ox + 0.3 * k, -0.45]], WFUR, [ox, -0.8], 0.4, 0.07, sx < 0 ? 51 : 52, false); ctx.fillStyle = '#4a3036'; ctx.beginPath(); ctx.moveTo(ox - 0.13 * k, -0.48); ctx.lineTo(ox + 0.05, -1.15 * k); ctx.lineTo(ox + 0.15 * k, -0.5); ctx.closePath(); ctx.fill(); }
  furForm(ctx, [[-1.0, 0.45], [-1.1, -0.15], [-0.8, -0.62], [-0.15, -0.75], [0.45, -0.58], [0.8, -0.2], [0.8, 0.3], [0.4, 0.75], [-0.5, 0.8]], WFUR, [-0.15, 0.0], 1.0, 0.16, 61, false, -0.4);
  // mandíbula de abajo
  ctx.save(); ctx.translate(0.3, 0.32); ctx.rotate(open * 0.55);
  form(ctx, () => shapePath(ctx, [[-0.4, -0.04], [0.4, -0.04], [1.15, 0.04, 1], [1.05, 0.22], [0.4, 0.38], [-0.35, 0.3]]), WSKIN, [0.4, 0.12], 0.8, { tex: 0.5, lw: 1.3 });
  ctx.fillStyle = '#f2e8d2'; ctx.strokeStyle = INK; ctx.lineWidth = 0.014; for (let k = 0; k < 5; k++) { const x = 0.1 + k * 0.2; ctx.beginPath(); ctx.moveTo(x - 0.06, 0.0); ctx.quadraticCurveTo(x - 0.02, -0.12, x + 0.005, -0.24 - (k === 3 ? 0.34 : 0)); ctx.quadraticCurveTo(x + 0.02, -0.1, x + 0.06, 0.0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#5a0610'; ctx.beginPath(); ctx.moveTo(-0.1, 0.28); ctx.lineTo(1.4, 0.3); ctx.lineTo(...add([0.3, 0.32], dirv(Math.PI / 2 - open * 0.55), 1.1)); ctx.lineTo(0.0, 0.5); ctx.closePath(); ctx.fill(); // la boca roja
  ctx.fillStyle = '#d4404e'; ctx.beginPath(); ctx.ellipse(0.55, 0.42 + open * 0.3, 0.3, 0.07, 0.2 + open * 0.3, 0, TAU); ctx.fill(); // la lengua
  form(ctx, () => shapePath(ctx, [[-0.2, -0.3], [0.45, -0.38], [1.15, -0.15], [1.45, 0.05, 1], [1.42, 0.27], [0.4, 0.3], [-0.2, 0.3]]), WFUR, [0.6, -0.05], 0.8, { hi: 0.25, tex: 0.6, lw: 1.3 }); // el hocico de arriba
  ctx.fillStyle = '#f2e8d2'; ctx.strokeStyle = INK; ctx.lineWidth = 0.014; for (let k = 0; k < 7; k++) { const x = 0.05 + k * 0.2, h = k === 1 ? 0.62 : 0.26; ctx.beginPath(); ctx.moveTo(x - 0.06, 0.28); ctx.quadraticCurveTo(x - 0.02, 0.28 + h * 0.6, x + 0.005, 0.28 + h); ctx.quadraticCurveTo(x + 0.02, 0.28 + h * 0.5, x + 0.06, 0.28); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(20,10,10,0.6)'; ctx.lineWidth = 0.035; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.55 + k * 0.17, -0.32 + k * 0.04); ctx.quadraticCurveTo(0.62 + k * 0.17, -0.15, 0.58 + k * 0.17, -0.02); ctx.stroke(); } // arrugas
  form(ctx, () => ctx.ellipse(1.42, 0.05, 0.13, 0.1, 0.3, 0, TAU), '#141014', [1.42, 0.03], 0.13, { hi: 0.4, rim: 0, lw: 1 }); // la nariz
  for (const [x, rx] of [[-0.4, 0.17], [0.28, 0.13]] as const) { ctx.fillStyle = '#100806'; ctx.beginPath(); ctx.ellipse(x, -0.3, rx * 1.3, rx * 0.6, -0.25, 0, TAU); ctx.fill(); vampEye(ctx, x, -0.3, rx * 0.75, rx * 0.38, t); }
  ctx.strokeStyle = '#1a1418'; ctx.lineWidth = 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.7, -0.52); ctx.lineTo(-0.2, -0.38); ctx.moveTo(0.1, -0.4); ctx.lineTo(0.5, -0.52); ctx.stroke();
}
// Hombre lobo en cuatro patas (como la lámina): lomo peludo, cabeza baja gruñendo, brazaletes rojos con pinches, la faja roja con la calavera.
function drawWolf2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const s = Math.sin, moving = v.onGround && Math.abs(v.vx) > 0.5, w = v.walkT * 4, leap = v.state === 'leap' || !v.onGround;
  const swipe = v.state === 'claw' ? (v.t < 0.16 ? v.t / 0.16 : Math.max(0, 1 - (v.t - 0.16) * 3.5)) : 0;
  const br = s(t * 3 + v.id), bob = moving ? Math.abs(s(w)) * 0.04 : br * 0.01;
  shadowOn(ctx, v, 0.95);
  ctx.save(); ctx.translate(0, -bob - 0.22); ctx.scale(0.7, 1); // de tres cuartos, girado hacia el frente como los vampiros
  if (leap) { ctx.translate(0, -0.1); ctx.rotate(-0.12); }
  // la cola peluda que cae para atrás
  const tw = s(t * 4 + v.id) * 0.06;
  furForm(ctx, [[-0.7, -0.85], [-1.15, -0.85 + tw], [-1.6, -0.72 + tw * 1.5], [-1.95, -0.5 + tw * 2], [-2.05, -0.3 + tw * 2.4], [-1.7, -0.42 + tw * 1.5], [-1.2, -0.6 + tw], [-0.75, -0.62]], WFUR, [-1.3, -0.65], 0.5, 0.1, 21, false, -0.8); // la cola larga y peluda
  // una pata: hombro/cadera, codo/rodilla, muñeca/garrón y la pata con garras clavadas al piso
  const leg = (front: boolean, back: boolean) => {
    const ph = (front ? 0 : Math.PI) + (back ? Math.PI : 0), sw = moving ? s(w + ph) * 0.14 : 0, lift = moving ? Math.max(0, Math.cos(w + ph)) * 0.1 : 0, ox = back ? 0.42 : 0;
    if (back) { ctx.save(); ctx.translate(0, -0.1); } // las patas del lado de atrás quedan más arriba (más lejos)
    let top: Pt, mid1: Pt, low: Pt, paw: Pt;
    if (front) { top = [0.5 + ox, -0.72]; mid1 = [0.4 + ox + sw * 0.5, -0.32 - lift]; low = [0.5 + ox + sw, 0.0 - lift]; paw = [0.52 + ox + sw, 0.17 - lift * 0.6]; }
    else { top = [-0.62 + ox, -0.72]; mid1 = [-0.28 + ox + sw * 0.5, -0.34 - lift]; low = [-0.52 + ox + sw, 0.0 - lift]; paw = [-0.44 + ox + sw, 0.17 - lift * 0.6]; }
    if (front && !back && v.state === 'claw') { // el zarpazo: levanta la pata bien alto y la baja de golpe sobre el cazador
      const tt = v.t, y = tt < 0.16 ? -0.05 - ease(tt / 0.16) * 1.6 : tt < 0.26 ? -1.65 + ease((tt - 0.16) / 0.1) * 1.63 : -0.02;
      mid1 = [0.75, -0.75 + Math.min(0, y + 0.6) * 0.45]; low = [1.0, y - 0.16]; paw = [1.12, y];
    }
    furForm(ctx, tubePts(top, mid1, front ? [0.55, 0.46, 0.27] : [0.7, 0.55, 0.27], 0.1), WFUR, lerp(top, mid1, 0.4), 0.25, 0.05, (front ? 3 : 5) + (back ? 1 : 0), back);
    tube(ctx, mid1, low, [0.28, 0.24, 0.18], dk(WSKIN, back, 0.3), { bulge: 0.1, rim: back ? 0 : 1, tex: 0.45, lw: 1.3 });
    tube(ctx, low, paw, [0.15, 0.14], dk(WSKIN, back, 0.3), { rim: back ? 0 : 1, tex: 0.45, lw: 1.3 });
    if (front) { const d2 = vec(mid1, low), n2: Pt = [d2[1], -d2[0]], c0 = lerp(mid1, low, 0.25), c1 = lerp(mid1, low, 0.75); // brazalete rojo con pinches y bordes dorados
      trimmed(ctx, [add(c0, n2, 0.11), add(c1, n2, 0.1), add(c1, n2, -0.1), add(c0, n2, -0.11)].map(p => [p[0], p[1], 1] as [number, number, number]), RED, lerp(c0, c1, 0.5), 0.12, back, 0.016);
      for (const k of [0.3, 0.7]) { const p = add(lerp(c0, c1, k), n2, 0.1); form(ctx, () => shapePath(ctx, [add(p, d2, -0.03), [add(p, n2, 0.09)[0], add(p, n2, 0.09)[1], 1], add(p, d2, 0.03)]), back ? '#7a6a40' : '#d9b46a', p, 0.04, { hi: 0.6, rim: 0, ao: 0, lw: 0.8 }); } }
    else { const d2 = vec(low, paw), n2: Pt = [d2[1], -d2[0]], a0 = lerp(low, paw, 0.4); trimmed(ctx, [add(a0, n2, 0.08), add(add(a0, n2, 0.08), d2, 0.05), add(add(a0, n2, -0.08), d2, 0.05), add(a0, n2, -0.08)].map(p => [p[0], p[1], 1] as [number, number, number]), '#7a1420', a0, 0.08, back, 0.01); } // tobillera
    wolfPaw(ctx, paw, back, WSKIN, '#efe3c8', front && !back && swipe > 0 ? paw[1] + 0.06 : 0.22, 1.3);
    joint(ctx, mid1, 0.08, back, '#5d5964', vec(mid1, low), LEATHER, null);
    if (back) ctx.restore();
  };
  leg(false, true); leg(true, true);
  // el cuerpo: lomo largo con la joroba en los hombros, pecho hondo, la panza flaca
  const body: Pt[] = ([[-0.7, -0.62], [-0.68, -0.88], [-0.35, -0.95], [0.05, -0.98], [0.35, -1.1], [0.6, -1.0], [0.7, -0.75], [0.55, -0.48], [0.25, -0.5], [-0.1, -0.56], [-0.45, -0.5]] as Pt[]).map(([x, y]) => [x * 1.25, (y + 0.75) * 1.7 - 0.75] as Pt); // el cuerpo más grande y ancho
  furForm(ctx, body, WFUR, [0.0, -0.8], 0.95, 0.09, 31, false, -0.7);
  form(ctx, () => smooth(ctx, [[0.32, -0.88], [0.6, -0.82], [0.62, -0.58], [0.45, -0.5], [0.3, -0.58]]), WSKIN, [0.48, -0.68], 0.2, { tex: 0.5, lw: 0.9, rim: 0.5 }); // el pecho pelado
  ctx.strokeStyle = 'rgba(30,20,40,0.5)'; ctx.lineWidth = 0.014; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.36 + k * 0.05, -0.82); ctx.quadraticCurveTo(0.42 + k * 0.05, -0.7, 0.38 + k * 0.06, -0.56); ctx.stroke(); } // costillas
  for (let k = 0; k < 3; k++) line(ctx, [[0.08 + k * 0.05, -0.92], [0.18 + k * 0.05, -0.74]], 0.022, '#c0101e'); // la cicatriz de garras
  // la faja de cuero cruzada con la calavera y el trapo rojo colgando
  tube(ctx, [-0.12, -0.98], [0.08, -0.52], [0.09, 0.09], LEATHER, { rim: 0, ao: 0, tex: 0.5, lw: 1.1 });
  for (const k of [0.25, 0.55, 0.85]) { const p = lerp([-0.12, -0.98], [0.08, -0.52], k); form(ctx, () => ctx.arc(p[0], p[1], 0.018, 0, TAU), GOLDC, p, 0.02, { hi: 0.7, rim: 0, ao: 0, lw: 0.6 }); }
  form(ctx, () => shapePath(ctx, [[-0.18, -0.9], [-0.06, -0.86], [-0.1, -0.45, 1], [-0.14, -0.55, 1], [-0.17, -0.38, 1], [-0.2, -0.52, 1], [-0.26, -0.42, 1], [-0.24, -0.7]]), RED, [-0.18, -0.65], 0.25, { tex: 0.5, lw: 1.2 }); // trapo rojo
  { const k0: Pt = [-0.02, -0.72]; form(ctx, () => smooth(ctx, [[k0[0] - 0.06, k0[1] - 0.05], [k0[0] + 0.06, k0[1] - 0.05], [k0[0] + 0.065, k0[1] + 0.02], [k0[0] + 0.03, k0[1] + 0.07], [k0[0] - 0.03, k0[1] + 0.07], [k0[0] - 0.065, k0[1] + 0.02]]), '#e8dcc2', k0, 0.07, { hi: 0.4, lw: 1.1 }); ctx.fillStyle = '#1a1010'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k0[0] + sx * 0.025, k0[1], 0.018, 0.022, 0, 0, TAU); ctx.fill(); } ctx.fillRect(k0[0] - 0.025, k0[1] + 0.045, 0.05, 0.012); } // la calavera
  leg(false, false);
  // la melena del cuello (pelo largo y en punta)
  ctx.beginPath(); furPath(ctx, [[0.1, -1.1], [0.35, -1.38], [0.68, -1.32], [0.9, -1.08], [0.92, -0.75]], 0.17, 41, -0.9, false); ctx.lineTo(0.66, -0.85); ctx.lineTo(0.3, -1.0); ctx.closePath(); ctx.fillStyle = WFUR_D; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.012; ctx.stroke();
  leg(true, false);
  // la cabeza: baja y hacia adelante, gruñendo
  ctx.save(); ctx.translate(1.0, -0.98); ctx.scale(1 / 0.7, 1); ctx.rotate((leap ? -0.15 : 0.06) + br * 0.03 - swipe * 0.12); ctx.scale(0.31, 0.31);
  wolfHead(ctx, t, 0.4 + swipe * 0.3 + 0.05 * s(t * 5));
  ctx.restore();
  ctx.restore();
}

// La pata del lobo apoyada en el piso: almohadilla larga, cuatro dedos y las uñas clavadas hacia el suelo.
function wolfPaw(ctx: CanvasRenderingContext2D, p: Pt, back: boolean, skin = WSKIN, nail = '#efe3c8', ground = 0, size = 1) {
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(size, size);
  const c = dk(skin, back, 0.3), y0 = (ground - p[1]) / size; // el piso (o donde apoyaría)
  form(ctx, () => shapePath(ctx, [[-0.08, -0.04], [0.06, -0.06], [0.2, y0 - 0.06], [0.24, y0 - 0.01, 1], [-0.06, y0 - 0.0, 1], [-0.1, y0 - 0.04]]), c, [0.06, y0 * 0.5], 0.15, { rim: back ? 0 : 1, tex: 0.45, lw: 1.3 });
  for (let k = 0; k < 4; k++) { const x = 0.06 + k * 0.055, y = y0 - 0.035; form(ctx, () => ctx.ellipse(x, y, 0.034, 0.03, 0, 0, TAU), lighten(c, 0.05), [x, y], 0.035, { rim: 0, ao: 0, lw: 1 }); // dedos
    form(ctx, () => shapePath(ctx, [[x + 0.012, y - 0.022], [x + 0.06, y + 0.0], [x + 0.065, y + 0.04, 1], [x + 0.03, y + 0.01], [x + 0.005, y + 0.02]]), back ? darken(nail, 0.45) : nail, [x + 0.04, y], 0.04, { hi: 0.5, rim: 0, ao: 0, lw: 0.9 }); } // uñas hacia el suelo
  ctx.restore();
}

// ---------------------------------------------------------------- Drácula
const DSKIN = '#c2acdb'; // la piel de Drácula: pálida, apenas violeta
function drawDracula2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  if (v.state === 'mist') { const k = v.t < 0.75 ? v.t / 0.75 : Math.max(0, 1 - (v.t - 0.75) / 0.4); ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * 1.3); drawDracula2(ctx, { ...v, state: 'walk' }, t); ctx.restore(); return; }
  const st = stance(v, t, { lean: 0.0, crouch: 0.04, wide: 0.95 }), br = Math.sin(t * 2.2 + v.id) * 0.015;
  let hands: [Pt, Pt] = [[-0.22, 0.55 + br], [0.28, 0.55 - br]];
  if (v.state === 'cast') { const k = Math.min(1, v.t / 0.5); hands = [[-0.35, 0.1 - 0.4 * k], [0.4, -0.2 - 0.3 * k]]; }
  if (v.state === 'claw') { // el zarpazo con todo el cuerpo (como el martillo): se echa para atrás con las garras arriba,
    // se tira hacia adelante dando un paso y baja las dos garras de golpe, se queda un instante y vuelve
    const a = ATTACK.dracula ?? { at: 0.32, dur: 0.65 }, w0 = a.at - 0.1, tt = v.t;
    type K = { h: [Pt, Pt]; lean: number; crouch: number; step: number };
    const idle: K = { h: hands, lean: st.lean, crouch: st.crouch, step: 0 }, up: K = { h: [[-0.3, -0.58], [-0.04, -0.66]], lean: -0.24, crouch: 0.0, step: 0 }, hit: K = { h: [[0.46, 0.32], [0.64, 0.2]], lean: 0.44, crouch: 0.17, step: 0.26 };
    const mix = (A: K, B: K, q: number): K => ({ h: [lerpPt(A.h[0], B.h[0], q), lerpPt(A.h[1], B.h[1], q)], lean: A.lean + (B.lean - A.lean) * q, crouch: A.crouch + (B.crouch - A.crouch) * q, step: A.step + (B.step - A.step) * q });
    const k = tt < w0 ? mix(idle, up, ease(tt / w0)) : tt < a.at + 0.02 ? mix(up, hit, ((tt - w0) / (a.at + 0.02 - w0)) ** 2) : tt < a.at + 0.14 ? hit : mix(hit, idle, ease((tt - a.at - 0.14) / Math.max(0.1, a.dur - a.at - 0.14)));
    hands = k.h; st.lean = k.lean; st.crouch = k.crouch; st.feet = [[st.feet[0][0] - k.step * 0.3, st.feet[0][1]], [st.feet[1][0] + k.step, st.feet[1][1]]];
  } else if (v.state !== 'cast') hands = swipeArms(v, hands);
  const r: Pose2 = { ...st, hands }, b = solve2(r, { ...HUMAN, spine: 0.64, shW: 0.21 });
  const CR = '#b0101c';
  shadowOn(ctx, v, 0.6);
  // la capa enorme negra con borde dorado ondeado y forro rojo
  cape2(ctx, b, t + v.id, { len: 1.5, flare: 1.35 });
  { const sl = b.sh[1]; trimmed(ctx, [[sl[0], sl[1] + 0.05], [sl[0] + 0.32, sl[1] + 1.3], [sl[0] + 0.12, sl[1] + 1.46, 1], [sl[0] - 0.02, sl[1] + 0.6]], BLK, [sl[0] + 0.15, sl[1] + 0.8], 0.6, false, 0.022); }
  // el pelo largo plateado por la espalda
  const hc = add(b.neck, b.spine, 0.16), sway = Math.sin(t * 2 + v.id) * 0.03;
  const locks = () => shapePath(ctx, [[hc[0] - 0.2, hc[1] - 0.05], [hc[0] - 0.36 + sway, hc[1] + 0.45], [hc[0] - 0.34 + sway, hc[1] + 0.95, 1], [hc[0] - 0.16 + sway, hc[1] + 0.82], [hc[0] - 0.02 + sway, hc[1] + 1.0, 1], [hc[0] + 0.12 + sway, hc[1] + 0.8], [hc[0] + 0.3 + sway, hc[1] + 0.92, 1], [hc[0] + 0.32, hc[1] + 0.4], [hc[0] + 0.2, hc[1] - 0.05]]);
  form(ctx, locks, '#c9c7d2', [hc[0], hc[1] + 0.2], 0.4, { hi: 0.4, lo: 0.5, tex: 0.3, lw: 1.2 });
  ctx.save(); ctx.beginPath(); locks(); ctx.clip(); for (let k = 0; k < 16; k++) curve(ctx, [hc[0] - 0.16 + k * 0.024, hc[1] - 0.05], [hc[0] - 0.24 + k * 0.035 + sway, hc[1] + 0.45], [hc[0] - 0.32 + k * 0.04 + sway, hc[1] + 0.95], 0.009, k % 2 ? 'rgba(60,60,80,0.4)' : 'rgba(255,255,255,0.5)'); ctx.restore();
  leg2(ctx, b, 0); leg2(ctx, b, 1);
  for (const i of [0, 1]) joint(ctx, b.knee[i], 0.09, i === 0, '#5d5964', vec(b.knee[i], b.foot[i]), BLK2, GOLDC, true); // rodilleras con pinche
  // el saco largo carmesí: hasta los tobillos, abierto adelante, con ribetes dorados
  ctx.save(); ctx.translate(b.hip[0], b.hip[1]); ctx.rotate(Math.atan2(b.spine[0], -b.spine[1])); ctx.scale(BROAD, 1);
  const hemY = -b.hip[1] - 0.16;
  for (const sx of [-1, 1]) { const w = sx < 0 ? 1 : 0.8; trimmed(ctx, [[0.03 + sx * 0.05 * w, -0.06], [0.03 + sx * 0.19 * w, -0.06], [0.03 + sx * 0.32 * w, hemY, 1], [0.03 + sx * 0.08 * w, hemY - 0.05, 1]], CR, [0.03 + sx * 0.18, hemY / 2], 0.6, sx < 0, 0.022, { tex: 0.35 });
    ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(0.03 + sx * 0.2 * w, hemY - 0.12, 0.045, 0, Math.PI * 1.5); ctx.stroke(); } // faldones del saco
  tabard(ctx, 0.03, -0.04, hemY - 0.06, 0.18, CR, 'fleur');
  const torso = () => shapePath(ctx, [[-0.17, 0.0], [-0.18, -0.3], [-0.23, -0.56], [-0.13, -0.66], [0.17, -0.66], [0.23, -0.56], [0.17, -0.3], [0.16, 0.0]]);
  form(ctx, torso, CR, [0, -0.35], 0.45, { tex: 0.35, lw: 1.3 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  for (let k = 0; k < 4; k++) { const y = -0.48 + k * 0.1; ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.08, y); ctx.quadraticCurveTo(0.03, y - 0.02, 0.14, y); ctx.stroke(); ctx.fillStyle = GOLDC; for (const x of [-0.08, 0.14]) { ctx.beginPath(); ctx.arc(x, y, 0.014, 0, TAU); ctx.fill(); } } // alamares dorados
  ctx.strokeStyle = BLK; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.03, -0.66); ctx.lineTo(0.03, -0.05); ctx.stroke(); ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.01; ctx.stroke();
  ctx.restore(); goldEdge(ctx, torso, 0.016);
  belt2(ctx, -0.05, -0.18, 0.18);
  ctx.restore();
  const arm = (i: number) => { arm2(ctx, b, i, { sleeve: CR, cuff: BLK, curl: i ? 0.9 : 0.6, skin: DSKIN }); joint(ctx, b.elbow[i], 0.075, i === 0, '#5d5964', vec(b.elbow[i], b.hand[i]), BLK2, GOLDC, true); }; // con coderas con pinche
  arm(0); arm(1); // los hombros quedan debajo de la esclavina
  // la esclavina dorada y roja sobre los hombros con la gema grande
  const nk = add(b.neck, b.spine, -0.03);
  trimmed(ctx, [[nk[0] - 0.5, nk[1] + 0.26], [nk[0] - 0.44, nk[1] - 0.04], [nk[0], nk[1] - 0.09], [nk[0] + 0.42, nk[1] - 0.04], [nk[0] + 0.47, nk[1] + 0.24, 1], [nk[0] + 0.2, nk[1] + 0.15], [nk[0], nk[1] + 0.26, 1], [nk[0] - 0.24, nk[1] + 0.15], [nk[0] - 0.5, nk[1] + 0.26, 1]], CR, [nk[0], nk[1] + 0.06], 0.35, false, 0.022, { tex: 0.35 });
  for (const sx of [-1, 1]) { ctx.strokeStyle = GOLDC; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(nk[0] + sx * 0.2, nk[1] + 0.06, 0.04, 0.5, 5.2); ctx.stroke(); }
  gem(ctx, nk[0] + 0.02, nk[1] + 0.03, 0.045, t, GOLDC);
  if (v.state === 'cast') for (const h of b.hand) glow(ctx, h[0], h[1], 0.5, '#ff1030', 0.6);
  headAt(ctx, b, 0.02, 0.155, () => vampFace(ctx, t + v.id, { skin: DSKIN, open: v.state === 'claw' || v.state === 'cast' ? 0.5 : 0.04, hair: 'long', hairC: '#d2d0da', ear: 0.6, gaunt: 0.7 }));
}

// ---------------------------------------------------------------- Drácula dragón (parado en cuatro patas)
function drawDragon2(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const s = Math.sin, flying = v.state !== 'land' && v.state !== 'walk', flap = flying ? s(v.walkT * 6 + v.id) : 0.1 + s(t * 2) * 0.04;
  const breath = v.state === 'breath' ? Math.min(1, v.t / 0.35) * (v.t > 1.9 ? Math.max(0, 1 - (v.t - 1.9) / 0.3) : 1) : 0;
  const SC = '#a8141e', SCD = '#5e0a12', CREAM = '#e6d2a8', HORNC = '#e8dcc2', GREYB = '#5a5260', bob = flying ? s(v.walkT * 6 + v.id + 1) * 0.05 : 0;
  ctx.save(); ctx.translate(0, bob); ctx.scale(0.72, 1); // de tres cuartos, girado hacia el frente como los vampiros
  ctx.save(); ctx.translate(0.7, -0.6); ctx.scale(-1.0, 1.3); wyvernWing2(ctx, [0, 0], flap, true); ctx.restore(); // el ala del otro lado (abierta hacia la derecha)
  // el ala (detrás del cuello y del cuerpo): hueso gris, garra crema en la muñeca y la membrana roja con bordes rotos
  ctx.save(); ctx.translate(-0.1, -0.45); ctx.scale(1.7, 1.7); wyvernWing2(ctx, [0, 0], flap, false); ctx.restore();
  // la cola: se enrosca para arriba; panza crema y pinches crema arriba
  const tw = s(t * 2 + v.id) * 0.08, tail: Pt[] = [[-1.05, 0.12], [-1.65, 0.4], [-2.3, 0.5 + tw * 0.3], [-2.9, 0.38 + tw * 0.6], [-3.3, 0.05 + tw], [-3.4, -0.35 + tw * 1.3], [-3.15, -0.6 + tw * 1.3]], tw0 = [0.38, 0.3, 0.24, 0.18, 0.13, 0.08, 0.035];
  const tl: Pt[] = [], tr: Pt[] = [];
  for (let i = 0; i < tail.length; i++) { const a = tail[Math.max(0, i - 1)], b2 = tail[Math.min(tail.length - 1, i + 1)], dx = b2[0] - a[0], dy = b2[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; tl.push([tail[i][0] + nx * tw0[i], tail[i][1] + ny * tw0[i]]); tr.push([tail[i][0] - nx * tw0[i], tail[i][1] - ny * tw0[i]]); }
  const tailPts = [...tl, ...tr.slice().reverse()], tailP = () => smooth(ctx, tailPts);
  for (let j = 1; j < tail.length * 2 - 1; j++) { const i = Math.floor(j / 2), fr = (j % 2) * 0.5, p = lerp(tl[i], tl[Math.min(tail.length - 1, i + 1)], fr), a = vec(tail[Math.max(0, i - 1)], tail[Math.min(tail.length - 1, i + 1)]), nn: Pt = [-a[1], a[0]], h = 0.2 - j * 0.012;
    form(ctx, () => shapePath(ctx, [add(p, a, -0.06), [add(add(p, nn, h), a, -0.05)[0], add(add(p, nn, h), a, -0.05)[1], 1], add(p, a, 0.06)]), HORNC, p, 0.1, { hi: 0.5, lw: 1.1 }); }
  form(ctx, tailP, SC, [-1.5, 0.2], 1.1, { hi: 0.3, lo: 0.7, tex: 0.5, lw: 1.5 }); scales(ctx, tailP, [-1.5, 0.2], 1.2, 0.09, false);
  ctx.save(); ctx.beginPath(); tailP(); ctx.clip(); ctx.strokeStyle = CREAM; ctx.lineWidth = 0.12; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore(); // la panza de la cola
  // patas: muslo grande con rótula, canilla, tobillera crema y pata con garras al piso
  const leg = (front: boolean, back: boolean) => {
    const c = dk(SC, back, 0.4), off = back ? 0.5 : 0;
    if (back) { ctx.save(); ctx.translate(0, -0.12); }
    const sh: Pt = front ? [0.58 + off, 0.02] : [-0.85 + off, 0.0], kn: Pt = front ? [0.46 + off, 0.62] : [-0.53 + off, 0.55], an: Pt = front ? [0.66 + off, 1.0] : [-0.8 + off, 0.95];
    if (front) { tube(ctx, sh, kn, [0.56, 0.48, 0.32], c, { bulge: 0.15, rim: back ? 0 : 1, tex: 0.5, lw: 1.4 }); }
    else { form(ctx, () => ctx.ellipse(sh[0] + 0.05, sh[1] + 0.1, 0.48, 0.52, -0.3, 0, TAU), c, [sh[0], sh[1] + 0.05], 0.45, { hi: 0.35, rim: back ? 0 : 1, tex: 0.5, lw: 1.4 }); tube(ctx, add(sh, [0.05, 0.1], 1), kn, [0.42, 0.24], c, { rim: back ? 0 : 1, tex: 0.5, lw: 1.4 }); }
    tube(ctx, kn, an, [0.34, 0.28, 0.24], c, { bulge: 0.08, rim: back ? 0 : 1, tex: 0.5, lw: 1.4 });
    { const d2 = vec(kn, an), n2: Pt = [d2[1], -d2[0]], a0 = add(an, d2, -0.04); trimmed(ctx, [add(a0, n2, 0.1), add(add(a0, n2, 0.1), d2, 0.06), add(add(a0, n2, -0.1), d2, 0.06), add(a0, n2, -0.1)].map(p => [p[0], p[1], 1] as [number, number, number]), CREAM, a0, 0.1, back, 0.01, { hi: 0.5 }); } // tobillera crema
    joint(ctx, kn, front ? 0.09 : 0.12, back, GREYB, vec(kn, an), SC, null);
    wolfPaw(ctx, add(an, [-0.1, 0.0], 1), back, SC, HORNC, 1.22, 1.3); // pata con dedos y garras clavadas al piso
    if (back) ctx.restore();
  };
  leg(false, true); leg(true, true);
  // el cuerpo: grande, con las escamas, la panza crema y los pinches del lomo
  const body: Pt[] = ([[-0.95, 0.08], [-0.8, -0.32], [-0.3, -0.48], [0.3, -0.52], [0.75, -0.42], [0.98, -0.08], [0.82, 0.3], [0.2, 0.42], [-0.5, 0.4], [-0.9, 0.32]] as Pt[]).map(([x, y]) => [x * 1.3 - 0.15, y * 1.4 + 0.02] as Pt); // el cuerpo más largo y ancho
  const bodyP = () => smooth(ctx, body);
  for (let k = 0; k < 12; k++) { const p = lerp([-1.25, -0.22], [0.55, -0.52], k / 11), h = 0.14 + Math.sin(k / 8 * Math.PI) * 0.08; form(ctx, () => shapePath(ctx, [[p[0] - 0.07, p[1] + 0.05], [p[0] - 0.09, p[1] - h, 1], [p[0] + 0.07, p[1] + 0.02]]), k % 2 ? GREYB : HORNC, p, 0.1, { hi: 0.5, lw: 1.1 }); } // pinches del lomo
  form(ctx, bodyP, SC, [0, -0.1], 1.0, { hi: 0.3, lo: 0.7, tex: 0.5, lw: 1.6 }); scales(ctx, bodyP, [0, -0.05], 1.0, 0.13, false);
  ctx.save(); ctx.beginPath(); bodyP(); ctx.clip();
  form(ctx, () => shapePath(ctx, [[-0.7, 0.42], [0.1, 0.32], [0.65, 0.12], [1.0, -0.25], [1.1, 0.3], [0.4, 0.55], [-0.6, 0.6]]), CREAM, [0.3, 0.3], 0.6, { hi: 0.3, lo: 0.5, rim: 0, tex: 0.4 });
  ctx.strokeStyle = 'rgba(90,50,20,0.6)'; ctx.lineWidth = 0.016; for (let k = 0; k < 10; k++) { const a = lerp([-0.55, 0.42], [0.95, -0.15], k / 9); ctx.beginPath(); ctx.moveTo(a[0] - 0.1, a[1] - 0.1); ctx.lineTo(a[0] + 0.12, a[1] + 0.12); ctx.stroke(); }
  ctx.restore();
  leg(false, false); leg(true, false);
  // el cuello en S: escamas, la panza crema por delante y pinches grises y cremas por detrás
  const n0: Pt = [0.62, -0.38], n1: Pt = [1.15, -0.62], n2: Pt = [0.85, -1.2], hp: Pt = [1.18, -1.5];
  const nk = (k: number): Pt => { const u = 1 - k; return [u * u * u * n0[0] + 3 * u * u * k * n1[0] + 3 * u * k * k * n2[0] + k * k * k * hp[0], u * u * u * n0[1] + 3 * u * u * k * n1[1] + 3 * u * k * k * n2[1] + k * k * k * hp[1]]; };
  const nl: Pt[] = [], nr: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const k = i / 10, a = nk(Math.max(0, k - 0.05)), b2 = nk(Math.min(1, k + 0.05)), dx = b2[0] - a[0], dy = b2[1] - a[1], l = Math.hypot(dx, dy) || 1, w = 0.46 - k * 0.2, p = nk(k); nl.push([p[0] - dy / l * w, p[1] + dx / l * w]); nr.push([p[0] + dy / l * w, p[1] - dx / l * w]); }
  for (let i = 1; i < 10; i++) { const p = nl[i], a = vec(nl[i - 1], nl[i]), nn: Pt = [-a[1], a[0]]; form(ctx, () => shapePath(ctx, [add(p, a, -0.06), [add(p, nn, -0.17)[0], add(p, nn, -0.17)[1], 1], add(p, a, 0.06)]), i % 2 ? GREYB : HORNC, p, 0.08, { hi: 0.5, lw: 1, rim: 0, ao: 0 }); }
  const neckP = () => smooth(ctx, [...nl, ...nr.slice().reverse()]);
  form(ctx, neckP, SC, [0.95, -1.0], 0.7, { hi: 0.3, lo: 0.7, tex: 0.5, lw: 1.5 }); scales(ctx, neckP, [0.95, -1.0], 0.8, 0.08, false);
  ctx.save(); ctx.beginPath(); neckP(); ctx.clip(); ctx.strokeStyle = CREAM; ctx.lineWidth = 0.2; ctx.beginPath(); nr.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.strokeStyle = 'rgba(90,50,20,0.65)'; ctx.lineWidth = 0.014; for (const p of nr) { ctx.beginPath(); ctx.moveTo(p[0] - 0.11, p[1] - 0.04); ctx.lineTo(p[0] + 0.08, p[1] + 0.04); ctx.stroke(); } ctx.restore();
  // la cabeza: cuernos grandes curvos para atrás, cresta, boca abierta con fuego, ojo amarillo
  ctx.save(); ctx.translate(hp[0], hp[1]); ctx.scale(1 / 0.72, 1); ctx.rotate(0.12 - breath * 0.1); ctx.scale(1.25, 1.25);
  const jaw = 0.38 + breath * 0.25;
  for (const back of [true, false]) { const o = back ? -0.12 : 0, oy = back ? 0.03 : 0; form(ctx, () => shapePath(ctx, [[-0.02 + o, -0.18 + oy], [-0.25 + o, -0.42 + oy], [-0.52 + o, -0.48 + oy], [-0.72 + o, -0.3 + oy, 1], [-0.48 + o, -0.36 + oy], [-0.28 + o, -0.28 + oy], [-0.1 + o, -0.04 + oy]]), back ? '#a8987a' : HORNC, [-0.35, -0.3], 0.35, { hi: 0.5, rim: back ? 0 : 1, tex: 0.4, lw: 1.3 }); if (!back) for (let k = 0; k < 4; k++) curve(ctx, [-0.14 - k * 0.11, -0.2 - k * 0.06], [-0.16 - k * 0.11, -0.29 - k * 0.06], [-0.22 - k * 0.11, -0.32 - k * 0.04], 0.014, 'rgba(90,60,20,0.6)'); }
  for (const [ox, oy, k] of [[0.12, 0.05, 0.62], [-0.05, 0.16, 0.5]] as const) form(ctx, () => shapePath(ctx, [[ox - 0.05, oy - 0.12], [ox - 0.32 * k * 1.6, oy - 0.36 * k], [ox - 0.6 * k * 1.4, oy - 0.25 * k, 1], [ox - 0.3 * k * 1.4, oy - 0.2 * k], [ox - 0.08, oy - 0.02]]), HORNC, [ox - 0.2, oy - 0.2], 0.25, { hi: 0.5, tex: 0.4, lw: 1.1 }); // más cuernos
  for (const [ox, oy, L, a0] of [[0.18, -0.22, 0.42, -0.9], [0.32, -0.18, 0.32, -0.6], [0.02, -0.24, 0.36, -1.25], [0.45, -0.12, 0.22, -0.35]] as const) { const d0 = dirv(Math.PI + a0), n0: Pt = [d0[1], -d0[0]], tip = add(add([ox, oy], d0, L), n0, -L * 0.25); form(ctx, () => shapePath(ctx, [add([ox, oy], n0, 0.04), add(add([ox, oy], d0, L * 0.6), n0, -0.02), [tip[0], tip[1], 1], add(add([ox, oy], d0, L * 0.5), n0, -0.06), add([ox, oy], n0, -0.04)]), HORNC, add([ox, oy], d0, L * 0.4), L * 0.5, { hi: 0.5, tex: 0.4, lw: 1.1 }); } // más cuernos arriba de la cabeza
  for (let k = 0; k < 3; k++) form(ctx, () => shapePath(ctx, [[-0.12 + k * 0.08, 0.1 + k * 0.01], [-0.3 + k * 0.06, 0.24 + k * 0.03, 1], [-0.06 + k * 0.08, 0.14]]), HORNC, [-0.15, 0.18], 0.06, { hi: 0.5, lw: 0.8, rim: 0, ao: 0 }); // pinches de la mandíbula
  for (let k = 0; k < 4; k++) form(ctx, () => shapePath(ctx, [[-0.18 + k * 0.1, -0.2 - k * 0.02], [-0.2 + k * 0.1, -0.36 - k * 0.03, 1], [-0.1 + k * 0.1, -0.22 - k * 0.02]]), GREYB, [-0.15, -0.28], 0.06, { hi: 0.5, lw: 0.8, rim: 0, ao: 0 }); // la cresta
  ctx.save(); ctx.translate(-0.05, 0.08); ctx.rotate(jaw);
  form(ctx, () => shapePath(ctx, [[-0.1, -0.02], [0.3, -0.02], [0.66, 0.0, 1], [0.55, 0.09], [0.15, 0.14], [-0.12, 0.09]]), SC, [0.3, 0.04], 0.4, { hi: 0.3, tex: 0.5, lw: 1.3 });
  ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = INK; ctx.lineWidth = 0.007; for (let k = 0; k < 6; k++) { const x = 0.1 + k * 0.09, h = k === 4 ? 0.16 : 0.11; ctx.beginPath(); ctx.moveTo(x - 0.028, -0.01); ctx.quadraticCurveTo(x - 0.01, -h * 0.6, x + 0.005, -h); ctx.quadraticCurveTo(x + 0.012, -h * 0.5, x + 0.028, -0.01); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#4a0204'; ctx.beginPath(); ctx.moveTo(0.0, 0.08); ctx.lineTo(0.7, 0.06); ctx.lineTo(...add([-0.05, 0.08], dirv(Math.PI / 2 - jaw), 0.66)); ctx.closePath(); ctx.fill();
  glow(ctx, 0.32, 0.16 + jaw * 0.2, 0.3 + breath * 0.5, '#ffa020', 0.85 + breath * 0.15); glow(ctx, 0.3, 0.16 + jaw * 0.2, 0.13, '#fff2c0', 0.9); // el fuego de adentro
  const skull = () => shapePath(ctx, [[-0.2, 0.1], [-0.28, -0.12], [-0.05, -0.25], [0.22, -0.22], [0.4, -0.13], [0.62, -0.06], [0.78, 0.02, 1], [0.72, 0.09], [0.3, 0.1], [0.0, 0.14]]);
  form(ctx, skull, SC, [0.2, -0.05], 0.55, { hi: 0.35, lo: 0.7, tex: 0.5, lw: 1.5 }); scales(ctx, skull, [0.2, -0.05], 0.5, 0.06, false);
  ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = INK; ctx.lineWidth = 0.007; for (let k = 0; k < 7; k++) { const x = 0.07 + k * 0.095, h = k === 1 ? 0.2 : 0.12; ctx.beginPath(); ctx.moveTo(x - 0.03, 0.085); ctx.quadraticCurveTo(x - 0.01, 0.085 + h * 0.6, x + 0.005, 0.085 + h); ctx.quadraticCurveTo(x + 0.014, 0.085 + h * 0.5, x + 0.03, 0.08); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  form(ctx, () => shapePath(ctx, [[-0.02, -0.22], [0.14, -0.28], [0.34, -0.19, 1], [0.16, -0.16], [0.0, -0.15]]), SCD, [0.12, -0.2], 0.15, { hi: 0.35, lw: 1 }); // la ceja
  for (let k = 0; k < 2; k++) form(ctx, () => shapePath(ctx, [[0.5 + k * 0.1, -0.08], [0.52 + k * 0.1, -0.18, 1], [0.58 + k * 0.1, -0.06]]), HORNC, [0.53, -0.1], 0.04, { hi: 0.5, lw: 0.7, rim: 0, ao: 0 }); // cuernitos del hocico
  ctx.fillStyle = '#100204'; ctx.beginPath(); ctx.ellipse(0.15, -0.12, 0.1, 0.055, -0.15, 0, TAU); ctx.fill(); glow(ctx, 0.16, -0.12, 0.2, '#ffd020', 0.6);
  { const g = ctx.createRadialGradient(0.15, -0.13, 0, 0.16, -0.12, 0.08); g.addColorStop(0, '#fffbd0'); g.addColorStop(0.4, '#ffd21a'); g.addColorStop(1, '#c06a00'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0.16, -0.12, 0.08, 0.045, -0.15, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.008; ctx.stroke(); ctx.fillStyle = '#140800'; ctx.beginPath(); ctx.ellipse(0.17, -0.12, 0.014, 0.04, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0.13, -0.14, 0.012, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#100204'; ctx.beginPath(); ctx.ellipse(0.7, -0.02, 0.03, 0.016, 0.4, 0, TAU); ctx.fill(); // la fosa nasal
  ctx.restore();
  ctx.restore();
}
function wyvernWing2(ctx: CanvasRenderingContext2D, root: Pt, flap: number, back: boolean) {
  ctx.save(); ctx.translate(root[0], root[1]); ctx.rotate(-flap * 0.25 + (back ? -0.25 : 0)); if (back) ctx.scale(0.85, 0.85);
  const elbow: Pt = [0.25, -0.75], wrist: Pt = [-0.05, -1.65], tips: Pt[] = [[-1.05, -1.95], [-1.65, -1.25], [-1.75, -0.45], [-1.2, 0.1], [-0.45, 0.3]];
  const mem = () => { ctx.moveTo(0, 0); ctx.lineTo(...elbow); ctx.lineTo(...wrist); ctx.lineTo(...tips[0]); for (let i = 1; i < tips.length; i++) { const a = tips[i - 1], b2 = tips[i]; ctx.quadraticCurveTo(...lerp(mid(a, b2), wrist, 0.18), b2[0], b2[1]); } ctx.quadraticCurveTo(-0.15, 0.25, 0.0, 0.15); ctx.closePath(); };
  ctx.beginPath(); mem(); const g = ctx.createLinearGradient(-0.2, -1.6, -1.5, 0.2); g.addColorStop(0, back ? '#8e0e18' : '#d42230'); g.addColorStop(0.6, back ? '#5a0810' : '#a8121e'); g.addColorStop(1, back ? '#3a0408' : '#6a0a12'); ctx.fillStyle = g; ctx.fill(); if (VAMP_TEX) grain(ctx, mem, 0.4);
  ctx.save(); ctx.beginPath(); mem(); ctx.clip(); ctx.strokeStyle = 'rgba(60,0,8,0.55)'; ctx.lineWidth = 0.012; for (let i = 0; i < tips.length - 1; i++) for (let k = 1; k < 6; k++) { const a = lerp(wrist, tips[i], k / 6), b2 = lerp(wrist, tips[i + 1], k / 6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(...lerp(mid(a, b2), wrist, -0.1), b2[0], b2[1]); ctx.stroke(); } ctx.restore();
  ctx.beginPath(); mem(); ctx.strokeStyle = INK; ctx.lineWidth = 0.025; ctx.stroke();
  const bone = back ? '#2a2228' : '#3a3036';
  tube(ctx, [0, 0], elbow, [0.2, 0.14], back ? '#5a0a12' : '#8e1018', { rim: back ? 0 : 1, tex: 0.4, lw: 1.3 }); tube(ctx, elbow, wrist, [0.13, 0.09], bone, { rim: back ? 0 : 1, tex: 0.4, lw: 1.3 });
  for (const tp of tips.slice(0, 4)) tube(ctx, wrist, tp, [0.06, 0.025], bone, { rim: 0, ao: 0, lw: 1 });
  form(ctx, () => shapePath(ctx, [[wrist[0] - 0.06, wrist[1] + 0.02], [wrist[0] + 0.02, wrist[1] - 0.22], [wrist[0] + 0.3, wrist[1] - 0.26, 1], [wrist[0] + 0.1, wrist[1] - 0.12], [wrist[0] + 0.08, wrist[1] + 0.03]]), back ? '#a08a5e' : '#e8cc8e', wrist, 0.15, { hi: 0.5, lw: 1.2 }); // la garra del ala
  ctx.restore();
}

export function drawVampHD(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  switch (v.kind) {
    case 'flyer': drawFlyer2(ctx, v, t); break;
    case 'giant': drawGiant2(ctx, v, t); break;
    case 'mage': drawMage2(ctx, v, t); break;
    case 'hammer': drawHammer2(ctx, v, t); break;
    case 'warrior': drawWarrior2(ctx, v, t); break;
    case 'wolf': drawWolf2(ctx, v, t); break;
    case 'dracula': drawDracula2(ctx, v, t); break;
    case 'dragon': drawDragon2(ctx, v, t); break;
    default: drawWalker2(ctx, v, t);
  }
  // los que atacan con las manos (garras): la estela del zarpazo
  if (v.kind === 'walker' || v.kind === 'dracula') clawTrail(ctx, v);
  else if (v.kind === 'giant') clawTrail(ctx, v, -2.0, -0.3, 0.7);
  else if (v.kind === 'wolf') clawTrail(ctx, v, -1.6, -0.2, 0.9);
}
