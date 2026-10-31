// Los personajes de Vampyrium dibujados como los luchadores de Kombat Football: el mismo esqueleto (cadera,
// pecho inclinado, muslo y canilla, brazo y antebrazo), las mismas poses animadas (guardia que respira, carrera,
// salto, golpe, aturdido) y el mismo sombreado con volumen; con brazos y piernas más gruesos. En metros, con los
// pies en (0, 0), mirando a la derecha y "arriba" negativo (como el lienzo).
//  · El cazador (como la referencia): armadura negra, hombreras redondas con borde de plata, correas cruzadas
//    con broche, cinturón ancho con hebilla grande, faldones de cuero, capa roja, barba y pelo castaño despeinado.
//  · El vampiro: piel lila pálida, pelo negro peinado para atrás con pico en la frente, ojos rojos que brillan,
//    colmillos, cuello alto rojo, corbatín de volados con gema, garras con uñas rojas y capa roja festoneada.
//  · El vampiro volador: igual, con el pelo en punta, la boca abierta y dos alas de murciélago enormes.
import { alpha, bloom, darken, lighten, segment, shade, spec } from './gravityMonsters';
import type { Game, Player, Vamp, Weapon } from './vampyrium';

const TAU = Math.PI * 2;
type Pt = [number, number];
const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];
const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];
const grad = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [k, c] of stops) g.addColorStop(k, c); return g; };
const LIMB = 1.2; // brazos y piernas más gruesos que en Kombat Football

interface Pose { bob: number; lean: number; crouch: number; head: number; legs: [number, number][]; arms: [number, number][]; blade: number }
interface Look { armor: string; dark: string; trim: string; strap: string; boot: string; cape: string; capeD: string; skin: string; sleeve: string }
const HUNTER: Look = { armor: '#2a2a32', dark: '#16161b', trim: '#b9bdc9', strap: '#7a4526', boot: '#17171c', cape: '#b3121b', capeD: '#4f070c', skin: '#e9b088', sleeve: '#1d1d23' };
const VAMP: Look = { armor: '#1c1820', dark: '#0f0c12', trim: '#d01624', strap: '#5e3520', boot: '#121015', cape: '#c8121e', capeD: '#4a050b', skin: '#c8b4e0', sleeve: '#16131a' };

// ---------------------------------------------------------------- Poses
function hunterPose(p: Player, t: number): Pose {
  const s = Math.sin, at = p.attackT, run = p.onGround && Math.abs(p.vx) > 0.6;
  if (p.hurtT > 0) { const w = t * 30; return { bob: 0, lean: -0.35 + s(w) * 0.06, crouch: 0.1, head: -0.3, legs: [[-0.45, 0.5], [0.25, 0.7]], arms: [[-0.6, 0.9], [-0.9, 0.8]], blade: 0.6 }; }
  if (at >= 0) {
    if (p.attackWeapon === 'sword') { // tajo: la espada baja desde atrás de la cabeza hacia adelante, con estocada
      const k = Math.min(1, at / 0.14), e = 1 - (1 - k) * (1 - k);
      return { bob: 0, lean: -0.15 + e * 0.45, crouch: 0.1, head: 0.1 * e, legs: p.onGround ? [[-0.65, 0.35], [0.7, 0.75]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[-0.5 - e * 0.4, 0.7], [3.0 - e * 2.15, 0.25 - e * 0.15]], blade: 0.15 };
    }
    const k = Math.min(1, at / 0.12); // tira la estaca
    return { bob: 0, lean: -0.2 + k * 0.4, crouch: 0.06, head: 0, legs: p.onGround ? [[-0.55, 0.4], [0.55, 0.6]] : [[-0.4, 1.1], [0.7, 1.3]], arms: [[-0.6, 0.6], [2.8 - k * 1.3, 1.0 - k * 0.9]], blade: 0.3 };
  }
  if (!p.onGround) {
    if (p.vy > 2) return { bob: 0, lean: 0.05, crouch: 0, head: -0.05, legs: [[-0.3, 1.2], [0.9, 1.6]], arms: [[-0.9, 0.5], [2.2, 0.4]], blade: 0.3 };
    return { bob: 0, lean: 0.1, crouch: 0, head: 0.05, legs: [[-0.45, 0.6], [0.5, 0.9]], arms: [[-1.2, 0.4], [1.6, 0.7]], blade: 0.9 };
  }
  if (run) {
    const w = p.walkT * 5.4;
    return { bob: Math.abs(s(w)) * 0.06, lean: 0.2, crouch: 0, head: 0.05,
      legs: [[-0.75 * s(w), 0.3 + 1.1 * Math.max(0, -Math.cos(w))], [0.75 * s(w), 0.3 + 1.1 * Math.max(0, Math.cos(w))]],
      arms: [[0.9 * s(w), 1.4], [-0.6 * s(w) + 0.3, 1.5]], blade: 1.0 };
  }
  const br = s(t * 3.2); // guardia: el puño con la espada adelante, la hoja para arriba (como la cruz de la referencia)
  return { bob: br * 0.025, lean: 0.06, crouch: 0.08 + br * 0.02, head: 0.05, legs: [[-0.45, 0.55], [0.42, 0.6]], arms: [[-0.1 + br * 0.03, 1.25], [0.15 - br * 0.03, 1.5]], blade: 1.45 };
}
function walkerPose(v: Vamp, t: number): Pose {
  const s = Math.sin;
  if (v.state === 'claw') { // levanta las garras y araña hacia abajo
    const up = v.t < 0.36 ? Math.min(1, v.t / 0.25) : Math.max(0, 1 - (v.t - 0.36) * 7);
    return { bob: 0, lean: 0.25 - up * 0.2, crouch: 0.15, head: 0.1, legs: [[-0.55, 0.6], [0.55, 0.7]], arms: [[1.2 + up * 1.6, 0.3], [1.3 + up * 1.6, 0.25]], blade: 0 };
  }
  if (!v.onGround) return { bob: 0, lean: 0.2, crouch: 0, head: 0, legs: [[-0.4, 1.2], [0.8, 1.4]], arms: [[1.6, 0.3], [2.0, 0.2]], blade: 0 };
  const w = v.walkT * 3.2, m = Math.abs(v.vx) > 0.3 ? 1 : 0, br = s(t * 2.6 + v.id);
  return { bob: m ? Math.abs(s(w)) * 0.05 : br * 0.02, lean: 0.3, crouch: 0.16, head: 0.12,
    legs: m ? [[-0.6 * s(w) - 0.15, 0.5 + 0.9 * Math.max(0, -Math.cos(w))], [0.6 * s(w) + 0.15, 0.5 + 0.9 * Math.max(0, Math.cos(w))]] : [[-0.5, 0.65], [0.5, 0.7]],
    arms: [[1.15 + s(w) * 0.2 * m + br * 0.05, 0.35], [1.3 - s(w) * 0.2 * m - br * 0.05, 0.3]], blade: 0 };
}

// ---------------------------------------------------------------- Partes del cuerpo
function boot(ctx: CanvasRenderingContext2D, foot: Pt, ang: number, L: Look, back: boolean) {
  const c = back ? darken(L.boot, 0.3) : L.boot, silver = L === VAMP ? '#a3a8b4' : L.trim, metal = back ? darken(silver, 0.35) : silver;
  ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(-ang * 0.6); ctx.scale(1.15, 1.1);
  shade(ctx, () => { ctx.moveTo(-0.13, -0.17); ctx.lineTo(0.14, -0.14); ctx.quadraticCurveTo(0.31, -0.07, 0.29, 0.04); ctx.lineTo(-0.15, 0.04); ctx.closePath(); }, c, { x: 0.02, y: -0.1, r: 0.28, hi: 0.5, lw: 0.6 });
  ctx.fillStyle = metal; ctx.fillRect(-0.15, 0.01, 0.44, 0.035); // suela de metal
  ctx.fillStyle = '#060608'; ctx.fillRect(-0.16, 0.045, 0.46, 0.03);
  shade(ctx, () => ctx.roundRect(-0.13, -0.15, 0.27, 0.05, 0.015), metal, { x: -0.05, y: -0.15, r: 0.15, hi: 0.6, lw: 0.4 }); // banda de metal
  shade(ctx, () => { ctx.moveTo(0.16, -0.1); ctx.quadraticCurveTo(0.3, -0.06, 0.29, 0.01); ctx.lineTo(0.17, 0.01); ctx.closePath(); }, metal, { x: 0.22, y: -0.08, r: 0.1, hi: 0.6, lw: 0.4 }); // puntera
  if (!back) spec(ctx, 0.05, -0.08, 0.07, 0.03, -0.3, 0.5);
  ctx.restore();
}
function legDraw(ctx: CanvasRenderingContext2D, hip: Pt, pose: Pose, i: number, L: Look) {
  const back = i === 0, [ta, kb] = pose.legs[i], hp: Pt = [hip[0] + (back ? -0.11 : 0.11), hip[1]];
  const knee = add(hp, dirv(ta), 0.36), foot = add(knee, dirv(ta - kb), 0.35);
  const col = (c: string) => back ? darken(c, 0.35) : c;
  segment(ctx, hp, knee, 0.27 * LIMB, 0.22 * LIMB, col(L.dark), 0.5);
  segment(ctx, knee, foot, 0.22 * LIMB, 0.19 * LIMB, col(L.dark), 0.4);
  // canillera de metal y rodillera redonda
  const sd = dirv(ta - kb);
  segment(ctx, add(knee, sd, 0.08), add(knee, sd, 0.26), 0.2 * LIMB, 0.18 * LIMB, col(L === VAMP ? '#2a2630' : L.armor), 0.8);
  segment(ctx, add(knee, sd, 0.2), add(knee, sd, 0.23), 0.22 * LIMB, 0.21 * LIMB, col(L === VAMP ? '#8f95a3' : L.trim), 0.6);
  shade(ctx, () => ctx.arc(knee[0], knee[1], 0.12 * LIMB, 0, TAU), col(L === VAMP ? '#3a3542' : '#3a3a44'), { x: knee[0] - 0.04, y: knee[1] - 0.04, r: 0.12, hi: 0.55, lw: 0.6 });
  if (L === VAMP) { ctx.strokeStyle = col('#9aa0ad'); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(knee[0], knee[1], 0.1 * LIMB, 0.4, Math.PI - 0.4); ctx.stroke(); }
  boot(ctx, foot, ta - kb, L, back);
}
const shoulderAt = (hip: Pt, pose: Pose, i: number): Pt => { const lx = i === 0 ? -0.34 : 0.28, ly = -0.42 + (i === 0 ? 0.02 : -0.04); return [hip[0] + lx * Math.cos(pose.lean) - ly * Math.sin(pose.lean), hip[1] + lx * Math.sin(pose.lean) + ly * Math.cos(pose.lean)]; };
const handOf = (hip: Pt, pose: Pose, i: number): Pt => { const [ua, eb] = pose.arms[i]; return add(add(shoulderAt(hip, pose, i), dirv(ua), 0.31), dirv(ua + eb), 0.29); };

// El puño enguantado del cazador (con nudillos y la muñequera de metal).
function fist(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, back: boolean) {
  const gc = back ? '#16161a' : '#26262d';
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(1.2, 1.2);
  shade(ctx, () => ctx.roundRect(-0.09, -0.14, 0.18, 0.07, 0.02), back ? '#6b6e79' : HUNTER.trim, { x: -0.03, y: -0.13, r: 0.1, hi: 0.6, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.12, -0.08, 0.24, 0.2, 0.07), gc, { x: -0.04, y: -0.04, r: 0.2, hi: 0.5, lw: 0.6 });
  for (let k = 0; k < 4; k++) { const kx = -0.085 + k * 0.056; shade(ctx, () => ctx.ellipse(kx, 0.095, 0.032, 0.036, 0, 0, TAU), lighten(gc, 0.1), { x: kx - 0.01, y: 0.085, r: 0.035, hi: 0.6, lw: 0.4 }); }
  shade(ctx, () => ctx.ellipse(0.085, 0.02, 0.046, 0.075, -0.35, 0, TAU), darken(gc, 0.1), { x: 0.07, y: 0, r: 0.06, lw: 0.5 });
  ctx.fillStyle = back ? '#7a7d88' : '#d9dce4'; ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.014, 0, TAU); ctx.fill();
  ctx.restore();
}
// La garra del vampiro: mano pálida con dedos largos y uñas rojas afiladas.
function claw(ctx: CanvasRenderingContext2D, hand: Pt, ang: number, back: boolean) {
  const sk = back ? darken(VAMP.skin, 0.3) : VAMP.skin;
  ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(1.2, 1.2);
  shade(ctx, () => ctx.roundRect(-0.085, -0.15, 0.17, 0.06, 0.02), back ? '#5f636d' : '#a9aeba', { x: -0.03, y: -0.14, r: 0.1, hi: 0.6, lw: 0.6 }); // puño de metal de la manga
  shade(ctx, () => ctx.ellipse(0, 0, 0.1, 0.09, 0, 0, TAU), sk, { x: -0.03, y: -0.03, r: 0.12, hi: 0.4, lw: 0.6 });
  for (let k = 0; k < 4; k++) {
    const fa = -0.55 + k * 0.37, bx = Math.sin(fa) * 0.07, by = Math.cos(fa) * 0.07, tx = bx + Math.sin(fa) * 0.11, ty = by + Math.cos(fa) * 0.11 + 0.03;
    segment(ctx, [bx, by], [tx, ty], 0.045, 0.035, sk, 0.3);
    ctx.fillStyle = back ? '#7a0a12' : '#e01b2c'; ctx.beginPath(); ctx.moveTo(tx - 0.018, ty); ctx.quadraticCurveTo(tx + Math.sin(fa) * 0.05, ty + 0.06, tx + Math.sin(fa) * 0.02 + 0.01, ty + 0.1); ctx.lineTo(tx + 0.018, ty); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.008; ctx.stroke();
  }
  shade(ctx, () => ctx.ellipse(0.09, -0.01, 0.04, 0.065, -0.5, 0, TAU), sk, { x: 0.08, y: -0.02, r: 0.05, lw: 0.5 }); // pulgar
  ctx.restore();
}
function sword(ctx: CanvasRenderingContext2D, hand: Pt, ang: number) {
  const d = dirv(ang), b0 = add(hand, d, 0.13), b1 = add(hand, d, 1.5), n: Pt = [d[1], -d[0]];
  segment(ctx, add(hand, d, -0.17), add(hand, d, 0.06), 0.085, 0.085, '#3a2414', 0.4); // empuñadura
  { const pm = add(hand, d, -0.2); shade(ctx, () => ctx.arc(pm[0], pm[1], 0.065, 0, TAU), '#d6a032', { x: pm[0], y: pm[1], r: 0.06, lw: 0.5 }); } // pomo
  const g0 = add(b0, n, 0.24), g1 = add(b0, n, -0.24);
  segment(ctx, g0, g1, 0.085, 0.085, '#c99a2e', 0.7); // guarda dorada
  ctx.beginPath(); const w = 0.08;
  ctx.moveTo(b0[0] + n[0] * w, b0[1] + n[1] * w); ctx.lineTo(b1[0] - d[0] * 0.18 + n[0] * w, b1[1] - d[1] * 0.18 + n[1] * w); ctx.lineTo(b1[0], b1[1]);
  ctx.lineTo(b1[0] - d[0] * 0.18 - n[0] * w, b1[1] - d[1] * 0.18 - n[1] * w); ctx.lineTo(b0[0] - n[0] * w, b0[1] - n[1] * w); ctx.closePath();
  ctx.fillStyle = grad(ctx, b0[0] + n[0] * w, b0[1] + n[1] * w, b0[0] - n[0] * w, b0[1] - n[1] * w, [[0, '#f5f8ff'], [0.45, '#c9d1e0'], [0.55, '#8e97a8'], [1, '#5d6474']]); ctx.fill();
  ctx.strokeStyle = '#1b1d24'; ctx.lineWidth = 0.022; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(...add(b0, d, 0.05)); ctx.lineTo(...add(b1, d, -0.2)); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,44,56,0.55)'; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(...add(b0, d, 0.08)); ctx.lineTo(...add(b0, d, 0.55)); ctx.stroke(); // canal de la hoja
}
function stake(ctx: CanvasRenderingContext2D, hand: Pt, ang: number) {
  const d = dirv(ang), a = add(hand, d, -0.12), b = add(hand, d, 0.42), n: Pt = [d[1], -d[0]];
  ctx.beginPath(); ctx.moveTo(a[0] + n[0] * 0.04, a[1] + n[1] * 0.04); ctx.lineTo(b[0] - d[0] * 0.12 + n[0] * 0.04, b[1] - d[1] * 0.12 + n[1] * 0.04); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0] - d[0] * 0.12 - n[0] * 0.04, b[1] - d[1] * 0.12 - n[1] * 0.04); ctx.lineTo(a[0] - n[0] * 0.04, a[1] - n[1] * 0.04); ctx.closePath();
  ctx.fillStyle = grad(ctx, a[0] + n[0] * 0.04, a[1] + n[1] * 0.04, a[0] - n[0] * 0.04, a[1] - n[1] * 0.04, [[0, '#c48a52'], [0.5, '#8a5a2c'], [1, '#4f3016']]); ctx.fill();
  ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 0.02; ctx.stroke();
}
function armDraw(ctx: CanvasRenderingContext2D, hip: Pt, pose: Pose, i: number, L: Look, item: Weapon | 'none' | 'claw') {
  const back = i === 0, [ua, eb] = pose.arms[i], sp = shoulderAt(hip, pose, i);
  const elbow = add(sp, dirv(ua), 0.31), hand = add(elbow, dirv(ua + eb), 0.29);
  const col = (c: string) => back ? darken(c, L === HUNTER ? 0.12 : 0.35) : c;
  segment(ctx, sp, elbow, 0.22 * LIMB, 0.18 * LIMB, col(L.sleeve), 0.5);
  if (L === HUNTER) { const m = add(sp, dirv(ua), 0.16), n: Pt = [Math.cos(ua), -Math.sin(ua)]; segment(ctx, add(m, n, 0.13), add(m, n, -0.13), 0.05, 0.05, col(L.strap), 0.4); } // correa
  segment(ctx, elbow, hand, 0.19 * LIMB, 0.17 * LIMB, col(L.sleeve), 0.4);
  // guantelete / manga con bandas de metal
  const fd = dirv(ua + eb);
  if (L === HUNTER) {
    segment(ctx, add(elbow, fd, 0.06), add(elbow, fd, 0.22), 0.22 * LIMB, 0.24 * LIMB, col('#34343e'), 0.8);
    for (const k of [0.1, 0.18]) segment(ctx, add(elbow, fd, k), add(elbow, fd, k + 0.025), 0.235 * LIMB, 0.24 * LIMB, col(L.trim), 0.6);
  } else {
    segment(ctx, add(elbow, fd, 0.16), add(elbow, fd, 0.2), 0.22 * LIMB, 0.22 * LIMB, col('#9aa0ad'), 0.6);
    segment(ctx, add(elbow, fd, 0.21), add(elbow, fd, 0.23), 0.21 * LIMB, 0.21 * LIMB, col(L.trim), 0.5);
  }
  shade(ctx, () => ctx.arc(elbow[0], elbow[1], 0.09 * LIMB, 0, TAU), col(L === HUNTER ? '#3c3c46' : '#24202a'), { x: elbow[0] - 0.02, y: elbow[1] - 0.03, r: 0.09, lw: 0.6 });
  if (item === 'claw') claw(ctx, hand, ua + eb, back);
  else {
    if (item === 'sword') sword(ctx, hand, ua + eb + pose.blade);
    else if (item === 'stakes') stake(ctx, hand, ua + eb + pose.blade);
    fist(ctx, hand, ua + eb, back);
  }
}
function pauldron(ctx: CanvasRenderingContext2D, sp: Pt, ua: number, back: boolean, big = 1) {
  const c = back ? '#1b1b20' : '#30303a', rx = 0.2 * big, ry = 0.16 * big;
  shade(ctx, () => ctx.ellipse(sp[0], sp[1] - 0.01, rx, ry, ua * 0.25, 0, TAU), c, { x: sp[0] - 0.06, y: sp[1] - 0.08, r: 0.24, hi: 0.6, lw: 0.6 });
  ctx.strokeStyle = back ? '#6d707b' : HUNTER.trim; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.ellipse(sp[0], sp[1] - 0.01, rx - 0.025, ry - 0.025, ua * 0.25, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); // borde de plata
  ctx.fillStyle = back ? '#6d707b' : '#d9dce4'; for (const k of [-0.08, 0.08]) { ctx.beginPath(); ctx.arc(sp[0] + k, sp[1] - 0.02, 0.022, 0, TAU); ctx.fill(); } // remaches
  if (!back) spec(ctx, sp[0] - 0.07, sp[1] - 0.09, 0.07, 0.035, -0.4, 0.75);
}
// La capa: cuelga de los hombros por detrás y flamea según la velocidad.
function cape(ctx: CanvasRenderingContext2D, neck: Pt, L: Look, t: number, speed: number, air: number, scallop: boolean) {
  const fl = Math.sin(t * 6) * 0.04 + Math.min(0.5, speed * 0.06) + air * 0.15, top: Pt = [neck[0] - 0.1, neck[1] + 0.1];
  const n = 5, x0 = top[0] - 0.62 - fl * 1.2, x1 = top[0] + 0.38, y = -0.04 - air * 0.25;
  ctx.beginPath(); ctx.moveTo(top[0] - 0.25, top[1]);
  ctx.quadraticCurveTo(x0 + 0.1, (top[1] + y) / 2 - 0.1, x0, y);
  for (let i = 0; i < n; i++) { const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n; if (scallop) ctx.quadraticCurveTo((a + b) / 2, y - 0.12, b, y + Math.sin(t * 5 + i) * 0.015); else { ctx.lineTo((a + b) / 2, y + 0.05 + Math.sin(t * 5 + i) * 0.02); ctx.lineTo(b, y - 0.02); } }
  ctx.quadraticCurveTo(x1 + 0.08, (top[1] + y) / 2, top[0] + 0.32, top[1]); ctx.closePath();
  ctx.fillStyle = grad(ctx, top[0], top[1], x0, y, [[0, L.cape], [0.6, darken(L.cape, 0.25)], [1, L.capeD]]); ctx.fill();
  ctx.strokeStyle = '#0a0406'; ctx.lineWidth = 0.03; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.025; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(top[0] - 0.2 + k * 0.08, top[1] + 0.1); ctx.quadraticCurveTo(x0 + (x1 - x0) * k / 4, (top[1] + y) / 2, x0 + (x1 - x0) * k / 4 - 0.05, y - 0.05); ctx.stroke(); } // pliegues
}

// ---------------------------------------------------------------- Cabezas
function hunterHead(ctx: CanvasRenderingContext2D, t: number, hurt: boolean) {
  const hair = '#3b2418', hairL = '#6e4a32', skin = HUNTER.skin, beard = '#4a2c1c';
  shade(ctx, () => { ctx.moveTo(-0.36, 0.14); ctx.quadraticCurveTo(-0.5, -0.22, -0.3, -0.42); ctx.lineTo(-0.02, -0.4); ctx.lineTo(-0.14, 0.22); ctx.closePath(); }, hair, { x: -0.3, y: -0.3, r: 0.4, tex: 0.4, lw: 1 });
  shade(ctx, () => ctx.ellipse(-0.23, 0.05, 0.075, 0.1, 0, 0, TAU), skin, { x: -0.25, y: 0.02, r: 0.1, lw: 0.8 }); // oreja
  const face = () => { ctx.moveTo(-0.3, -0.18); ctx.quadraticCurveTo(-0.33, 0.26, -0.06, 0.37); ctx.quadraticCurveTo(0.2, 0.43, 0.37, 0.2); ctx.quadraticCurveTo(0.44, -0.06, 0.35, -0.3); ctx.quadraticCurveTo(0, -0.44, -0.3, -0.18); ctx.closePath(); };
  shade(ctx, face, skin, { x: 0.16, y: -0.12, r: 0.55, hi: 0.35, lo: 0.4, tex: 0.04, lw: 1 });
  // barba y bigote (con textura de pelitos)
  ctx.save(); ctx.beginPath(); face(); ctx.clip();
  ctx.fillStyle = alpha(beard, 0.88); ctx.beginPath(); ctx.moveTo(-0.27, 0.06); ctx.quadraticCurveTo(-0.22, 0.3, -0.03, 0.36); ctx.quadraticCurveTo(0.2, 0.42, 0.36, 0.17); ctx.lineTo(0.34, 0.11); ctx.quadraticCurveTo(0.24, 0.27, 0.12, 0.22); ctx.quadraticCurveTo(0.0, 0.25, -0.12, 0.14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = alpha(beard, 0.5); for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 0.2 + (i % 7) * 0.02; ctx.fillRect(0.05 + Math.cos(a) * r * 0.9, 0.12 + Math.abs(Math.sin(a)) * r * 0.9, 0.012, 0.012); }
  ctx.restore();
  ctx.fillStyle = beard; ctx.beginPath(); ctx.moveTo(0.1, 0.24); ctx.lineTo(0.24, 0.23); ctx.lineTo(0.18, 0.37); ctx.closePath(); ctx.fill(); // chivita
  ctx.strokeStyle = beard; ctx.lineWidth = 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.1, 0.16); ctx.quadraticCurveTo(0.2, 0.12, 0.31, 0.15); ctx.stroke(); // bigote
  ctx.strokeStyle = '#3a1d12'; ctx.lineWidth = 0.025; ctx.beginPath(); if (hurt) ctx.arc(0.21, 0.27, 0.05, Math.PI + 0.5, -0.4); else { ctx.moveTo(0.14, 0.22); ctx.lineTo(0.28, 0.21); } ctx.stroke(); // boca seria
  ctx.strokeStyle = darken(skin, 0.3); ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(0.32, 0.0); ctx.lineTo(0.37, 0.08); ctx.lineTo(0.31, 0.1); ctx.stroke(); // nariz
  // ojos negros ovalados y cejas enojadas
  const blink = t % 4.3 < 0.12;
  for (const [ex, sz] of [[0.08, 1], [0.28, 0.9]] as const) {
    if (hurt) { ctx.strokeStyle = '#0a0a0e'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(ex - 0.035, -0.06); ctx.lineTo(ex + 0.035, 0.02); ctx.moveTo(ex + 0.035, -0.06); ctx.lineTo(ex - 0.035, 0.02); ctx.stroke(); continue; }
    if (blink) { ctx.fillStyle = '#0a0a0e'; ctx.fillRect(ex - 0.04, -0.02, 0.08, 0.02); continue; }
    ctx.fillStyle = '#0a0a0e'; ctx.beginPath(); ctx.ellipse(ex, -0.02, 0.045 * sz, 0.065 * sz, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 0.012, -0.045, 0.014, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = hair; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.03, -0.15); ctx.lineTo(0.15, -0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.22, -0.08); ctx.lineTo(0.38, -0.15); ctx.stroke();
  // pelo de arriba: mechones despeinados que caen sobre la frente, con mechones rojos
  const top = () => {
    ctx.moveTo(-0.4, 0.0); ctx.quadraticCurveTo(-0.46, -0.36, -0.2, -0.5);
    ctx.lineTo(-0.14, -0.6); ctx.lineTo(-0.04, -0.5); ctx.lineTo(0.1, -0.62); ctx.lineTo(0.16, -0.5); ctx.lineTo(0.34, -0.54);
    ctx.lineTo(0.32, -0.4); ctx.lineTo(0.47, -0.32); ctx.lineTo(0.33, -0.26); ctx.lineTo(0.38, -0.16);
    ctx.lineTo(0.2, -0.24); ctx.lineTo(0.14, -0.13); ctx.lineTo(0.06, -0.24); ctx.lineTo(-0.06, -0.16); ctx.lineTo(-0.1, -0.26);
    ctx.quadraticCurveTo(-0.24, -0.14, -0.24, 0.06); ctx.closePath();
  };
  shade(ctx, top, hair, { x: -0.05, y: -0.45, r: 0.5, hi: 0.45, tex: 0.2, lw: 1 });
  ctx.strokeStyle = '#b3151d'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.3, -0.36); ctx.quadraticCurveTo(-0.18, -0.48, -0.04, -0.4); ctx.stroke();
  ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.36, -0.2); ctx.quadraticCurveTo(-0.3, -0.34, -0.2, -0.36); ctx.stroke();
  ctx.strokeStyle = alpha(hairL, 0.9); ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(-0.16, -0.46); ctx.quadraticCurveTo(0.0, -0.52, 0.12, -0.46); ctx.moveTo(0.1, -0.4); ctx.quadraticCurveTo(0.22, -0.42, 0.3, -0.36); ctx.stroke();
}
function vampEye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, rx * 4, '#ff1e2e', 0.55 + 0.2 * Math.sin(t * 6)); ctx.restore();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx * 1.2); g.addColorStop(0, '#ffe6e6'); g.addColorStop(0.35, '#ff3341'); g.addColorStop(1, '#8a0010');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.15, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a0006'; ctx.lineWidth = 0.012; ctx.stroke();
}
function vampHead(ctx: CanvasRenderingContext2D, t: number, open: boolean, spiky: boolean) {
  const skin = VAMP.skin, hair = '#121018';
  // el cuello alto rojo, detrás de la cabeza
  shade(ctx, () => { ctx.moveTo(-0.36, 0.42); ctx.lineTo(-0.56, -0.22); ctx.lineTo(-0.22, -0.02); ctx.lineTo(0.3, -0.02); ctx.lineTo(0.6, -0.2); ctx.lineTo(0.42, 0.44); ctx.closePath(); }, VAMP.cape, { x: 0, y: -0.2, r: 0.7, hi: 0.35, tex: 0.3, lw: 1 });
  ctx.fillStyle = '#0b090e'; ctx.beginPath(); ctx.moveTo(-0.28, 0.36); ctx.lineTo(-0.42, -0.1); ctx.lineTo(-0.18, 0.06); ctx.lineTo(0.28, 0.06); ctx.lineTo(0.46, -0.08); ctx.lineTo(0.34, 0.38); ctx.closePath(); ctx.fill();
  shade(ctx, () => { ctx.moveTo(-0.36, 0.1); ctx.quadraticCurveTo(-0.5, -0.3, -0.24, -0.48); ctx.lineTo(-0.06, -0.2); ctx.closePath(); }, hair, { x: -0.3, y: -0.3, r: 0.4, tex: 0.3, lw: 1 });
  shade(ctx, () => { ctx.moveTo(-0.2, -0.06); ctx.lineTo(-0.46, -0.28); ctx.lineTo(-0.24, 0.14); ctx.closePath(); }, skin, { x: -0.25, y: -0.05, r: 0.2, lw: 0.8 }); // oreja puntiaguda
  const face = () => { ctx.moveTo(-0.3, -0.18); ctx.quadraticCurveTo(-0.32, 0.24, -0.04, 0.36); ctx.quadraticCurveTo(0.2, 0.41, 0.37, 0.18); ctx.quadraticCurveTo(0.44, -0.08, 0.34, -0.3); ctx.quadraticCurveTo(0, -0.44, -0.3, -0.18); ctx.closePath(); };
  shade(ctx, face, skin, { x: 0.16, y: -0.12, r: 0.6, hi: 0.12, lo: 0.5, tex: 0.04, lw: 1 });
  ctx.fillStyle = 'rgba(80,40,110,0.22)'; ctx.beginPath(); ctx.ellipse(0.17, 0.0, 0.2, 0.06, 0, 0, TAU); ctx.fill(); // ojeras
  vampEye(ctx, 0.08, -0.02, 0.06, 0.05, t); vampEye(ctx, 0.28, -0.015, 0.055, 0.046, t);
  ctx.strokeStyle = '#0b0a10'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.04, -0.17); ctx.lineTo(0.15, -0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.22, -0.08); ctx.lineTo(0.38, -0.17); ctx.stroke();
  if (open) { // boca abierta con colmillos grandes
    shade(ctx, () => { ctx.moveTo(0.06, 0.15); ctx.quadraticCurveTo(0.19, 0.1, 0.33, 0.15); ctx.quadraticCurveTo(0.22, 0.36, 0.06, 0.15); ctx.closePath(); }, '#5a0710', { x: 0.2, y: 0.2, r: 0.15, lw: 0.8 });
    ctx.fillStyle = '#e05868'; ctx.beginPath(); ctx.ellipse(0.2, 0.25, 0.06, 0.03, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; for (const fx of [0.1, 0.29]) { ctx.beginPath(); ctx.moveTo(fx - 0.025, 0.145); ctx.lineTo(fx, 0.23); ctx.lineTo(fx + 0.025, 0.145); ctx.closePath(); ctx.fill(); }
  } else {
    ctx.strokeStyle = '#1a0a12'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0.09, 0.19); ctx.quadraticCurveTo(0.19, 0.15, 0.31, 0.19); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const fx of [0.12, 0.27]) { ctx.beginPath(); ctx.moveTo(fx - 0.022, 0.17); ctx.lineTo(fx, 0.25); ctx.lineTo(fx + 0.022, 0.17); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#1a0a12'; ctx.lineWidth = 0.01; ctx.stroke(); }
  }
  // pelo: peinado para atrás con pico en la frente (o en puntas, el volador)
  const top = () => {
    ctx.moveTo(-0.38, -0.02); ctx.quadraticCurveTo(-0.44, -0.4, -0.12, -0.52);
    if (spiky) { ctx.lineTo(-0.2, -0.74); ctx.lineTo(0.0, -0.54); ctx.lineTo(0.06, -0.78); ctx.lineTo(0.16, -0.53); ctx.lineTo(0.38, -0.64); ctx.lineTo(0.32, -0.42); }
    else { ctx.quadraticCurveTo(0.2, -0.58, 0.38, -0.42); ctx.lineTo(0.46, -0.54); ctx.lineTo(0.38, -0.32); }
    ctx.lineTo(0.34, -0.25); ctx.quadraticCurveTo(0.25, -0.28, 0.18, -0.2); ctx.lineTo(0.14, -0.1); // pico en la frente
    ctx.lineTo(0.09, -0.21); ctx.quadraticCurveTo(-0.08, -0.28, -0.22, -0.14); ctx.lineTo(-0.25, 0.04); ctx.closePath();
  };
  shade(ctx, top, hair, { x: -0.05, y: -0.45, r: 0.5, hi: 0.5, tex: 0.3, lw: 1 });
  ctx.strokeStyle = 'rgba(190,150,255,0.4)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.26, -0.38); ctx.quadraticCurveTo(-0.04, -0.52, 0.2, -0.44); ctx.stroke();
}

// ---------------------------------------------------------------- Torsos
function hunterTorso(ctx: CanvasRenderingContext2D) {
  const torso = () => { ctx.moveTo(-0.3, 0.06); ctx.lineTo(-0.4, -0.42); ctx.quadraticCurveTo(0, -0.62, 0.4, -0.42); ctx.lineTo(0.29, 0.06); ctx.closePath(); };
  shade(ctx, torso, HUNTER.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.45, tex: 0.45 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  shade(ctx, () => { ctx.moveTo(-0.26, -0.4); ctx.lineTo(0.28, -0.4); ctx.lineTo(0.22, -0.12); ctx.lineTo(0.0, -0.06); ctx.lineTo(-0.2, -0.12); ctx.closePath(); }, '#33333d', { x: 0.02, y: -0.35, r: 0.35, hi: 0.5, lw: 0.6 }); // pechera
  // correas cruzadas con el broche en el medio
  for (const [a, b] of [[-0.36, 0.3], [0.36, -0.28]] as const) segment(ctx, [a, -0.5], [b, 0.0], 0.085, 0.085, HUNTER.strap, 0.6);
  ctx.restore();
  ctx.save(); ctx.translate(0.0, -0.27); ctx.rotate(Math.PI / 4);
  shade(ctx, () => ctx.rect(-0.055, -0.055, 0.11, 0.11), '#5a3420', { r: 0.1, lw: 0.6 });
  ctx.strokeStyle = HUNTER.trim; ctx.lineWidth = 0.02; ctx.strokeRect(-0.035, -0.035, 0.07, 0.07);
  ctx.restore();
  // cinturón ancho con hebilla grande y cuadrada
  shade(ctx, () => ctx.roundRect(-0.31, -0.08, 0.6, 0.13, 0.03), HUNTER.strap, { x: 0, y: -0.07, r: 0.3, hi: 0.4, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.07, -0.1, 0.15, 0.17, 0.025), '#cfd2db', { x: -0.03, y: -0.08, r: 0.12, hi: 0.7, lw: 0.6 });
  ctx.fillStyle = '#4a2a16'; ctx.fillRect(-0.025, -0.045, 0.06, 0.07);
  // faldones de cuero con ribete marrón
  for (const [px, pw] of [[-0.29, 0.27], [0.03, 0.27]] as const) {
    shade(ctx, () => { ctx.moveTo(px, 0.05); ctx.lineTo(px + pw, 0.05); ctx.lineTo(px + pw * 0.92, 0.26); ctx.lineTo(px + pw * 0.08, 0.26); ctx.closePath(); }, '#24222a', { x: px + 0.05, y: 0.06, r: 0.25, lw: 0.6 });
    ctx.strokeStyle = '#94603c'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.23); ctx.lineTo(px + pw * 0.9, 0.23); ctx.moveTo(px + 0.02, 0.07); ctx.lineTo(px + pw * 0.1, 0.23); ctx.moveTo(px + pw - 0.02, 0.07); ctx.lineTo(px + pw * 0.9, 0.23); ctx.stroke();
  }
  // cuello alto
  shade(ctx, () => ctx.ellipse(0.02, -0.53, 0.2, 0.08, 0, 0, TAU), '#34343e', { x: 0, y: -0.56, r: 0.2, hi: 0.5, lw: 0.6 });
}
function vampTorso(ctx: CanvasRenderingContext2D, t: number) {
  const torso = () => { ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.38, -0.42); ctx.quadraticCurveTo(0, -0.6, 0.38, -0.42); ctx.lineTo(0.27, 0.06); ctx.closePath(); };
  shade(ctx, torso, VAMP.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.4, tex: 0.35 });
  ctx.strokeStyle = VAMP.trim; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.3, -0.4); ctx.lineTo(-0.22, 0.04); ctx.moveTo(0.3, -0.4); ctx.lineTo(0.22, 0.04); ctx.stroke(); // ribetes rojos
  // corbatín de volados blanco con la gema roja
  shade(ctx, () => { ctx.moveTo(-0.08, -0.52); ctx.lineTo(0.12, -0.52); ctx.lineTo(0.09, -0.42); ctx.lineTo(0.14, -0.34); ctx.lineTo(0.06, -0.3); ctx.lineTo(0.02, -0.22); ctx.lineTo(-0.02, -0.3); ctx.lineTo(-0.1, -0.34); ctx.lineTo(-0.05, -0.42); ctx.closePath(); }, '#f2eef6', { x: 0.02, y: -0.48, r: 0.25, hi: 0.3, lw: 0.6 });
  ctx.strokeStyle = '#b9b0c4'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.05, -0.41); ctx.lineTo(0.09, -0.41); ctx.moveTo(-0.07, -0.34); ctx.lineTo(0.11, -0.34); ctx.stroke();
  shade(ctx, () => ctx.arc(0.02, -0.49, 0.045, 0, TAU), '#e3142a', { x: 0.01, y: -0.5, r: 0.05, hi: 0.7, lw: 0.6 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.02, -0.49, 0.12, '#ff3048', 0.4 + 0.2 * Math.sin(t * 3)); ctx.restore();
  // cinturón con hebilla
  shade(ctx, () => ctx.roundRect(-0.29, -0.08, 0.56, 0.11, 0.03), VAMP.strap, { x: 0, y: -0.07, r: 0.3, lw: 0.6 });
  shade(ctx, () => ctx.roundRect(-0.06, -0.095, 0.13, 0.14, 0.02), '#c4c8d2', { x: -0.03, y: -0.08, r: 0.1, hi: 0.7, lw: 0.6 }); ctx.fillStyle = VAMP.strap; ctx.fillRect(-0.02, -0.055, 0.05, 0.06);
  for (const [px, pw] of [[-0.27, 0.25], [0.03, 0.25]] as const) { shade(ctx, () => { ctx.moveTo(px, 0.04); ctx.lineTo(px + pw, 0.04); ctx.lineTo(px + pw * 0.9, 0.24); ctx.lineTo(px + pw * 0.1, 0.24); ctx.closePath(); }, '#1a1620', { x: px, y: 0.05, r: 0.25, lw: 0.6 }); ctx.strokeStyle = VAMP.trim; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(px + pw * 0.1, 0.22); ctx.lineTo(px + pw * 0.9, 0.22); ctx.stroke(); }
}

// ---------------------------------------------------------------- Personajes completos
export function drawHunterK(ctx: CanvasRenderingContext2D, p: Player, g: Game, t: number) {
  const pose = hunterPose(p, t);
  ctx.save();
  if (p.spinT > 0) { const k = 1 - p.spinT / 0.42; ctx.translate(0, -0.95); ctx.rotate(k * TAU); ctx.translate(0, 0.95); } // vuelta en el aire del doble salto
  if (p.landT > 0) ctx.scale(1 + p.landT * 0.6, 1 - p.landT * 0.8);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck: Pt = [Math.sin(pose.lean) * 0.52, hip[1] - Math.cos(pose.lean) * 0.52];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; if (p.onGround) { ctx.beginPath(); ctx.ellipse(0, 0.02, 0.5, 0.08, 0, 0, TAU); ctx.fill(); }
  cape(ctx, neck, HUNTER, t, Math.abs(p.vx), p.onGround ? 0 : 1, false);
  legDraw(ctx, hip, pose, 0, HUNTER);
  const backUp = handOf(hip, pose, 0)[1] < neck[1] + 0.05;
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); hunterTorso(ctx); ctx.restore();
  if (!backUp) armDraw(ctx, hip, pose, 0, HUNTER, 'none'); // el brazo derecho va adelante del pecho (como en Kombat Football), así se ve
  pauldron(ctx, shoulderAt(hip, pose, 0), pose.arms[0][0], true);
  legDraw(ctx, hip, pose, 1, HUNTER);
  const item: Weapon | 'none' = p.attackT >= 0 && p.attackWeapon === 'stakes' && p.attackT > 0.1 ? 'none' : g.weapon;
  const frontUp = handOf(hip, pose, 1)[1] < neck[1] + 0.05;
  // la estela del tajo
  if (p.attackT >= 0.02 && p.attackT < 0.24 && p.attackWeapon === 'sword') {
    const k = Math.min(1, p.attackT / 0.14), e = 1 - (1 - k) * (1 - k), fade = p.attackT > 0.14 ? 1 - (p.attackT - 0.14) / 0.1 : 1, sp = shoulderAt(hip, pose, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const a0 = Math.PI / 2 - 3.0 - 0.4, a1 = Math.PI / 2 - (3.0 - e * 2.15) - 0.4;
    for (const [r, w, c] of [[1.65, 0.4, `rgba(255,255,255,${0.45 * fade})`], [1.6, 0.16, `rgba(255,80,80,${0.65 * fade})`], [1.3, 0.07, `rgba(255,220,220,${0.5 * fade})`]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(sp[0], sp[1], r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
    ctx.restore();
  }
  if (!frontUp) armDraw(ctx, hip, pose, 1, HUNTER, item);
  pauldron(ctx, shoulderAt(hip, pose, 1), pose.arms[1][0], false, 1.1);
  ctx.save(); ctx.translate(neck[0] + 0.04, neck[1] - 0.4); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); hunterHead(ctx, t, p.hurtT > 0); ctx.restore();
  if (backUp) armDraw(ctx, hip, pose, 0, HUNTER, 'none');
  if (frontUp) armDraw(ctx, hip, pose, 1, HUNTER, item);
  ctx.restore();
}
export function drawWalkerK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const pose = walkerPose(v, t);
  const hip: Pt = [0, -0.7 + pose.bob + pose.crouch * 0.4], neck: Pt = [Math.sin(pose.lean) * 0.5, hip[1] - Math.cos(pose.lean) * 0.5];
  if (v.onGround) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.48, 0.08, 0, 0, TAU); ctx.fill(); }
  cape(ctx, neck, VAMP, t + v.id, Math.abs(v.vx) * 1.5, v.onGround ? 0 : 1, true);
  legDraw(ctx, hip, pose, 0, VAMP);
  armDraw(ctx, hip, pose, 0, VAMP, 'claw');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); vampTorso(ctx, t); ctx.restore();
  legDraw(ctx, hip, pose, 1, VAMP);
  const sp = shoulderAt(hip, pose, 1);
  shade(ctx, () => ctx.ellipse(sp[0], sp[1], 0.17, 0.13, 0.3, 0, TAU), '#2c2632', { x: sp[0] - 0.05, y: sp[1] - 0.06, r: 0.2, hi: 0.5, lw: 0.6 }); // hombrera con remaches
  ctx.fillStyle = '#9aa0ad'; for (const k of [-0.07, 0.07]) { ctx.beginPath(); ctx.arc(sp[0] + k, sp[1] - 0.05, 0.022, 0, TAU); ctx.fill(); }
  const up = handOf(hip, pose, 1)[1] < neck[1] + 0.05;
  if (!up) armDraw(ctx, hip, pose, 1, VAMP, 'claw');
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, v.state === 'claw' || !v.onGround, false); ctx.restore();
  if (up) armDraw(ctx, hip, pose, 1, VAMP, 'claw');
}
// Ala de murciélago enorme: hueso del brazo, cuatro dedos y la membrana roja festoneada entre ellos.
function batWing(ctx: CanvasRenderingContext2D, flap: number, back: boolean) {
  const up = flap, wrist: Pt = [0.75, -0.55 - up * 0.65];
  const tips: Pt[] = [[1.55, -1.1 - up * 0.8], [1.75, -0.35 - up * 0.55], [1.5, 0.3 - up * 0.25], [0.95, 0.55 - up * 0.05]];
  const m0 = back ? '#7d0b14' : '#e01b28', m1 = back ? '#2e0408' : '#6e0810';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wrist[0], wrist[1]); ctx.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) { const [ax, ay] = tips[i - 1], [bx, by] = tips[i]; ctx.quadraticCurveTo((ax + bx) / 2 - 0.2, (ay + by) / 2 - 0.02, bx, by); }
  ctx.quadraticCurveTo(0.4, 0.4, 0.05, 0.12); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, -0.6, 1.6, 0.4, [[0, m0], [0.55, darken(m0, 0.25)], [1, m1]]); ctx.fill();
  ctx.strokeStyle = '#140608'; ctx.lineWidth = 0.035; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff6070'; ctx.beginPath(); ctx.moveTo(wrist[0], wrist[1]); ctx.lineTo(tips[0][0], tips[0][1]); ctx.lineTo(tips[1][0], tips[1][1]); ctx.closePath(); ctx.fill(); ctx.restore(); // la luz que pasa por la membrana
  const bone = back ? '#1c1418' : '#26202a';
  segment(ctx, [0, 0], wrist, 0.1, 0.07, bone, 0.4);
  for (const tp of tips.slice(0, 3)) segment(ctx, wrist, tp, 0.055, 0.03, bone, 0.3);
  ctx.fillStyle = back ? '#7a7d88' : '#d4d7df'; ctx.beginPath(); ctx.moveTo(wrist[0] - 0.04, wrist[1] - 0.02); ctx.lineTo(wrist[0] + 0.02, wrist[1] - 0.2); ctx.lineTo(wrist[0] + 0.07, wrist[1] - 0.01); ctx.closePath(); ctx.fill(); // garra del ala
}
export function drawFlyerK(ctx: CanvasRenderingContext2D, v: Vamp, t: number) {
  const diving = v.state === 'dive', flap = diving ? 0.85 : Math.sin(v.walkT * 9 + v.id);
  const pose: Pose = { bob: Math.sin(v.walkT * 9 + v.id + 1) * 0.04, lean: diving ? 0.7 : 0.35, crouch: 0, head: diving ? 0.3 : 0.1, legs: [[-0.7, 1.1], [-0.35, 1.25]], arms: diving ? [[1.5, 0.15], [1.7, 0.1]] : [[1.2, 0.4], [1.45, 0.3]], blade: 0 };
  const hip: Pt = [0, -0.25 + pose.bob], neck: Pt = [Math.sin(pose.lean) * 0.5, hip[1] - Math.cos(pose.lean) * 0.5];
  const sb = shoulderAt(hip, pose, 0);
  ctx.save(); ctx.translate(sb[0] - 0.05, sb[1] + 0.05); ctx.scale(-1, 1); ctx.rotate(-0.15); batWing(ctx, flap, true); ctx.restore();
  legDraw(ctx, hip, pose, 0, VAMP);
  armDraw(ctx, hip, pose, 0, VAMP, 'claw');
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(pose.lean); vampTorso(ctx, t); ctx.restore();
  legDraw(ctx, hip, pose, 1, VAMP);
  const sf = shoulderAt(hip, pose, 1);
  ctx.save(); ctx.translate(sf[0] - 0.1, sf[1] + 0.02); ctx.rotate(-0.2); batWing(ctx, flap * 0.95, false); ctx.restore();
  armDraw(ctx, hip, pose, 1, VAMP, 'claw');
  ctx.save(); ctx.translate(neck[0] + 0.05, neck[1] - 0.38); ctx.rotate(pose.head * 0.5); ctx.scale(1.12, 1.12); vampHead(ctx, t + v.id, true, true); ctx.restore();
}

// ---------------------------------------------------------------- El esqueleto que arde (al morir)
function boneSeg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number) {
  segment(ctx, a, b, w, w * 0.85, '#efe6d0', 0.5);
  for (const p of [a, b]) shade(ctx, () => { ctx.arc(p[0] - w * 0.25, p[1], w * 0.42, 0, TAU); ctx.moveTo(p[0] + w * 0.67, p[1]); ctx.arc(p[0] + w * 0.25, p[1], w * 0.42, 0, TAU); }, '#f4ecd8', { x: p[0], y: p[1] - w * 0.2, r: w, lw: 0.5 });
}
export function drawSkeletonK(ctx: CanvasRenderingContext2D, flyer: boolean, t: number, eyes: number) {
  const hip: Pt = [0, flyer ? -0.25 : -0.72];
  // piernas, pelvis, columna y costillas, brazos y cráneo (con colmillos)
  for (const s of [-1, 1]) { const k: Pt = [hip[0] + s * 0.13, hip[1] + 0.36], f: Pt = [hip[0] + s * 0.18, hip[1] + 0.72]; boneSeg(ctx, [hip[0] + s * 0.1, hip[1]], k, 0.09); boneSeg(ctx, k, f, 0.08); }
  shade(ctx, () => { ctx.moveTo(-0.22, hip[1] - 0.08); ctx.quadraticCurveTo(0, hip[1] - 0.18, 0.22, hip[1] - 0.08); ctx.lineTo(0.14, hip[1] + 0.1); ctx.lineTo(0.03, hip[1] + 0.05); ctx.lineTo(-0.03, hip[1] + 0.05); ctx.lineTo(-0.14, hip[1] + 0.1); ctx.closePath(); }, '#efe6d0', { r: 0.25, lw: 0.6 });
  for (let i = 0; i < 6; i++) shade(ctx, () => ctx.roundRect(-0.045, hip[1] - 0.14 - i * 0.075, 0.09, 0.06, 0.02), '#efe6d0', { r: 0.06, lw: 0.4 });
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const y = hip[1] - 0.25 - i * 0.075, r = 0.22 - i * 0.015; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(0, y, r, 0.07, 0, Math.PI, TAU); ctx.stroke(); ctx.strokeStyle = '#f1e8d2'; ctx.lineWidth = 0.035; ctx.stroke(); }
  const sh = hip[1] - 0.52, wob = Math.sin(t * 40) * 0.2;
  for (const s of [-1, 1]) { const e: Pt = [s * 0.32, sh + 0.2], hnd: Pt = [s * 0.42 + 0.05, sh + 0.42 + (s > 0 ? wob * 0.2 : 0)]; boneSeg(ctx, [s * 0.22, sh], e, 0.075); boneSeg(ctx, e, hnd, 0.065); }
  ctx.save(); ctx.translate(0.05, sh - 0.42); ctx.scale(1.15, 1.15);
  shade(ctx, () => { ctx.moveTo(-0.32, 0.05); ctx.quadraticCurveTo(-0.36, -0.4, 0.02, -0.42); ctx.quadraticCurveTo(0.38, -0.4, 0.34, 0.05); ctx.lineTo(0.22, 0.2); ctx.lineTo(-0.2, 0.2); ctx.closePath(); }, '#f4ecd8', { x: -0.05, y: -0.2, r: 0.5, hi: 0.3, tex: 0.3, lw: 1 });
  for (const ex of [-0.12, 0.14]) { ctx.fillStyle = '#1a0e0a'; ctx.beginPath(); ctx.ellipse(ex, -0.06, 0.1, 0.11, 0, 0, TAU); ctx.fill(); if (eyes > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, ex, -0.06, 0.2, '#ff3a1a', eyes); ctx.restore(); ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(ex, -0.06, 0.04, 0, TAU); ctx.fill(); } }
  ctx.fillStyle = '#1a0e0a'; ctx.beginPath(); ctx.moveTo(0.02, 0.03); ctx.lineTo(-0.03, 0.11); ctx.lineTo(0.07, 0.11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 0.07 - 0.025, 0.19, 0.05, 0.07);
  ctx.beginPath(); ctx.moveTo(-0.14, 0.19); ctx.lineTo(-0.11, 0.33); ctx.lineTo(-0.08, 0.19); ctx.moveTo(0.1, 0.19); ctx.lineTo(0.13, 0.33); ctx.lineTo(0.16, 0.19); ctx.fill(); // colmillos
  ctx.restore();
}
// Llamas que le salen de todo el cuerpo (como la gente que se prende fuego en "El piso es de lava").
export function bodyFire(ctx: CanvasRenderingContext2D, hgt: number, wid: number, k: number, t: number, seed: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -hgt * 0.55, 0, 0, -hgt * 0.55, hgt * (1.2 + k));
  g.addColorStop(0, `rgba(255,150,40,${0.5 + 0.2 * Math.sin(t * 20 + seed)})`); g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g; ctx.fillRect(-hgt * 2.4, -hgt * 2.6, hgt * 4.8, hgt * 4.8);
  ctx.restore();
  for (let i = 0; i < 44; i++) {
    const h1 = (Math.sin(i * 12.9898 + seed) * 43758.5453) % 1, h = Math.abs(h1), h2 = Math.abs((Math.sin(i * 78.233 + seed) * 43758.5453) % 1);
    const life = (t * (1.6 + h * 0.8) + h2) % 1;
    const fx = (h2 - 0.5) * wid * 1.6 + Math.sin(t * 9 + i) * wid * 0.12, fy = -hgt * (0.05 + 0.92 * h) - life * hgt * (0.5 + k * 0.7);
    const r = wid * 0.2 * ((1 - life) * 0.8 + 0.2) * (0.7 + k * 0.9);
    ctx.fillStyle = life < 0.25 ? `rgba(254,240,138,${1 - life})` : life < 0.6 ? `rgba(251,146,60,${0.95 - life})` : `rgba(220,38,38,${0.9 - life})`;
    ctx.beginPath(); ctx.moveTo(fx - r, fy); ctx.quadraticCurveTo(fx - r * 0.3, fy - r * 2.2, fx, fy - r * 2.7); ctx.quadraticCurveTo(fx + r * 0.3, fy - r * 2.2, fx + r, fy); ctx.arc(fx, fy, r, 0, Math.PI); ctx.fill();
  }
  for (let i = 0; i < 4; i++) { const q = (t * 0.8 + i / 4) % 1; ctx.fillStyle = `rgba(40,34,34,${0.4 * (1 - q)})`; ctx.beginPath(); ctx.arc(Math.sin(t * 2 + i) * wid * 0.5, -hgt * (1.05 + q * 0.8), wid * (0.25 + q * 0.6), 0, TAU); ctx.fill(); } // humo negro
}
