// Los luchadores de Kombat Football: caricaturas con cabeza grande y armadura (como en las referencias), cada uno
// con su casco y sus colores: TÓXICO (máscara de gas con ojos verdes), TORO (casco rojo con cuernos y hocico),
// ESCARCHA (corona de hielo y máscara de calavera), RAYO (casco dorado con visor negro) y VACÍO (capucha violeta
// con la cara de sombra). Todos con el mismo esqueleto y animaciones: guardia de pelea que respira, carrera,
// salto, patada (alta, normal o rasante), bloqueo, golpeado (congelado, envenenado, quemado, electrocutado),
// especial, FATAL, festejo y bronca. Se dibujan con los pies en (0, 0), mirando a la derecha, en metros.
import { type CharId, type Fighter } from './kombat';
import { alpha, bloom, darken, lighten, segment, shade, spec } from './gravityMonsters';

const TAU = Math.PI * 2;
type Pt = [number, number];

interface Look { armor: string; dark: string; trim: string; glow: string; boot: string; glove: string }
export const LOOKS: Record<CharId, Look> = {
  toxic: { armor: '#262d24', dark: '#131711', trim: '#4ade80', glow: '#86efac', boot: '#171b15', glove: '#2c3329' },
  bull: { armor: '#b3191e', dark: '#4a0a0c', trim: '#2a1a14', glow: '#fb923c', boot: '#2b1210', glove: '#8d1418' },
  frost: { armor: '#2153c4', dark: '#0f2560', trim: '#bae6fd', glow: '#e0f2fe', boot: '#16306e', glove: '#2b5fd0' },
  volt: { armor: '#d6a313', dark: '#5c4306', trim: '#1a1a1a', glow: '#fef08a', boot: '#2a2a2a', glove: '#c99410' },
  void: { armor: '#5f2bb0', dark: '#250d4d', trim: '#c084fc', glow: '#e9d5ff', boot: '#2a1452', glove: '#6b34c2' },
};

interface Pose { bob: number; lean: number; legs: [number, number][]; arms: [number, number][]; head: number; crouch: number }
// Ángulos medidos desde "para abajo" (0) y positivos hacia adelante. legs: [muslo, doblez de la rodilla];
// arms: [brazo, doblez del codo]. El primero de cada par es el de atrás.
function poseOf(f: Fighter, t: number): Pose {
  const s = Math.sin, a = f.action;
  if (a === 'run') {
    const w = t * 13 * (f.speedT > 0 ? 1.6 : 1);
    return { bob: Math.abs(s(w)) * 0.06, lean: 0.18, crouch: 0, head: 0.05,
      legs: [[-0.75 * s(w), 0.3 + 1.1 * Math.max(0, -Math.cos(w))], [0.75 * s(w), 0.3 + 1.1 * Math.max(0, Math.cos(w))]],
      arms: [[0.9 * s(w), 1.5], [-0.9 * s(w), 1.5]] };
  }
  if (a === 'jump') return { bob: 0, lean: 0.05, crouch: 0, head: -0.05, legs: [[-0.3, 1.2], [0.9, 1.6]], arms: [[2.2, 0.6], [2.5, 0.5]] };
  if (a === 'kick') {
    const k = Math.min(1, (0.3 - f.kickT) / 0.3), swing = k < 0.35 ? -0.7 * (k / 0.35) : -0.7 + Math.min(1, (k - 0.35) / 0.25) * (f.kickUp === 1 ? 2.6 : f.kickUp === -1 ? 1.5 : 2.1);
    return { bob: 0.02, lean: -0.15, crouch: 0.05, head: -0.05, legs: [[-0.25, 0.3], [swing, k < 0.4 ? 1.2 : 0.15]], arms: [[1.2, 1], [-0.6, 1.2]] };
  }
  if (a === 'block') return { bob: s(t * 3) * 0.01, lean: 0.05, crouch: 0.12, head: 0.15, legs: [[-0.35, 0.6], [0.35, 0.6]], arms: [[1.1, 2.4], [1.3, 2.3]] };
  if (a === 'special') return { bob: 0, lean: -0.1, crouch: 0.08, head: -0.1, legs: [[-0.5, 0.4], [0.45, 0.5]], arms: [[0.4, 0.5], [1.55, 0.15]] };
  if (a === 'fatal') return { bob: s(t * 20) * 0.02, lean: -0.2, crouch: 0.1, head: -0.25, legs: [[-0.55, 0.5], [0.5, 0.5]], arms: [[2.6, 0.3], [2.4, 0.3]] };
  if (a === 'celebrate') return { bob: 0, lean: -0.1, crouch: 0, head: -0.25, legs: [[-0.2, 0.3], [0.3, 0.6]], arms: [[2.8 + s(t * 10) * 0.2, 0.3], [2.9 - s(t * 10) * 0.2, 0.3]] };
  if (a === 'sad') return { bob: 0, lean: 0.35, crouch: 0.25, head: 0.4, legs: [[-0.3, 0.9], [0.4, 1.1]], arms: [[2.6, 2.4], [2.7, 2.5]] };
  if (a === 'stun') {
    if (f.stunKind === 'freeze' || f.stunKind === 'grab') return { bob: 0, lean: 0.05, crouch: 0.05, head: 0, legs: [[-0.3, 0.4], [0.3, 0.4]], arms: [[0.8, 1.6], [1, 1.6]] };
    const w = t * (f.stunKind === 'zap' ? 40 : 14);
    return { bob: 0, lean: -0.35 + s(w) * 0.08, crouch: 0.1, head: -0.3 + s(w * 0.7) * 0.15, legs: [[-0.45, 0.5], [0.25, 0.7]], arms: [[-0.4 + s(w) * 0.6, 0.9], [-0.7 - s(w) * 0.6, 0.8]] };
  }
  // guardia de pelea
  const br = s(t * 3.2);
  return { bob: br * 0.025, lean: 0.08, crouch: 0.08 + br * 0.02, head: 0.05, legs: [[-0.45, 0.55], [0.4, 0.6]], arms: [[0.9 + br * 0.05, 2.1], [1.2 - br * 0.05, 2.2]] };
}
const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];
const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];

// ---------------------------------------------------------------- Cascos
export function drawHead(ctx: CanvasRenderingContext2D, char: CharId, t: number, power: number, mood: 'normal' | 'hurt' | 'happy' = 'normal') {
  const L = LOOKS[char], r = 0.37; ctx.save(); ctx.scale(1.12, 1.12);
  const helmet = (base: string) => shade(ctx, () => ctx.arc(0, 0, r, 0, TAU), base, { x: -0.12, y: -0.15, r: r * 1.4, hi: 0.4, tex: 0.35, lw: 1 });
  switch (char) {
    case 'toxic': {
      // manguera de atrás
      ctx.strokeStyle = '#11140f'; ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.22, 0.2); ctx.bezierCurveTo(0.1, 0.42, -0.25, 0.42, -0.32, 0.25); ctx.stroke();
      ctx.strokeStyle = '#2b3328'; ctx.lineWidth = 0.035; ctx.setLineDash([0.03, 0.03]); ctx.stroke(); ctx.setLineDash([]);
      helmet('#2b3229');
      // capucha / correas
      ctx.strokeStyle = '#151912'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, 0, r * 0.98, -2.6, -0.4); ctx.stroke();
      // máscara: placa de goma y dos lentes enormes
      shade(ctx, () => ctx.ellipse(0.13, 0.04, 0.27, 0.3, -0.1, 0, TAU), '#1a1f18', { x: 0.05, y: -0.1, r: 0.35, tex: 0.4 });
      for (const [ex, ey, er] of [[0.06, -0.05, 0.1], [0.25, -0.03, 0.11]] as const) {
        ctx.fillStyle = '#0a0c09'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4b5546'; ctx.lineWidth = 0.025; ctx.stroke();
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er); g.addColorStop(0, '#f0fff0'); g.addColorStop(0.35, L.trim); g.addColorStop(1, '#14532d');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        bloom(ctx, ex, ey, er * 3, L.trim, 0.35 + power * 0.4);
        spec(ctx, ex - er * 0.35, ey - er * 0.4, er * 0.3, er * 0.18, -0.5, 0.8);
      }
      // filtro
      ctx.save(); ctx.translate(0.27, 0.2); ctx.rotate(-0.3);
      shade(ctx, () => ctx.roundRect(-0.09, -0.07, 0.18, 0.15, 0.04), '#3f4a3c', { x: -0.03, y: -0.05, r: 0.15 });
      ctx.strokeStyle = '#11140f'; ctx.lineWidth = 0.015; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 0.03, -0.05); ctx.lineTo(k * 0.03, 0.06); ctx.stroke(); }
      ctx.fillStyle = L.trim; ctx.fillRect(-0.09, -0.075, 0.18, 0.015);
      ctx.restore();
      break;
    }
    case 'bull': {
      // cuerno de atrás
      const horn = (s: number, dark: boolean) => {
        ctx.save(); ctx.translate(-0.05 + s * 0.05, -0.24); ctx.scale(1, 1);
        ctx.beginPath(); ctx.moveTo(-0.08, 0.05); ctx.bezierCurveTo(-0.3, -0.05, -0.35, -0.35, -0.15, -0.5); ctx.bezierCurveTo(-0.22, -0.32, -0.12, -0.12, 0.08, -0.02); ctx.closePath();
        ctx.fillStyle = ctx.createLinearGradient(-0.1, 0, -0.2, -0.5); (ctx.fillStyle as CanvasGradient).addColorStop(0, dark ? '#3a3633' : '#5b5550'); (ctx.fillStyle as CanvasGradient).addColorStop(1, dark ? '#8a8279' : '#e7dfd2');
        ctx.fill(); ctx.strokeStyle = '#120c08'; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.restore();
      };
      ctx.save(); ctx.scale(-1, 1); horn(-1, true); ctx.restore();
      helmet('#b3191e');
      horn(1, false);
      // visera / ceño
      ctx.fillStyle = '#4a0a0c'; ctx.beginPath(); ctx.moveTo(-0.05, -0.12); ctx.quadraticCurveTo(0.2, -0.2, 0.37, -0.08); ctx.lineTo(0.36, 0.02); ctx.quadraticCurveTo(0.18, -0.06, -0.02, 0.0); ctx.closePath(); ctx.fill();
      const ey = -0.06;
      ctx.fillStyle = '#ffd34d'; for (const ex of [0.12, 0.27]) { ctx.beginPath(); ctx.moveTo(ex - 0.06, ey - 0.01); ctx.lineTo(ex + 0.05, ey - 0.04); ctx.lineTo(ex + 0.04, ey + 0.01); ctx.closePath(); ctx.fill(); bloom(ctx, ex, ey - 0.02, 0.12, '#fbbf24', 0.4 + power * 0.4); }
      // hocico
      shade(ctx, () => ctx.ellipse(0.3, 0.17, 0.17, 0.13, -0.2, 0, TAU), '#e9b48a', { x: 0.25, y: 0.1, r: 0.2, tex: 0.3 });
      ctx.fillStyle = '#3a1a10'; for (const nx of [0.3, 0.41]) { ctx.beginPath(); ctx.ellipse(nx, 0.17, 0.025, 0.04, -0.3, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0.37, 0.24, 0.05, 0.2, Math.PI - 0.2); ctx.stroke(); // argolla
      if (mood !== 'normal') { ctx.fillStyle = '#1a0505'; ctx.beginPath(); ctx.ellipse(0.25, 0.3, 0.07, mood === 'happy' ? 0.04 : 0.03, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'frost': {
      // corona de hielo
      for (let k = 0; k < 6; k++) {
        const a = -2.6 + k * 0.38, h = 0.22 + (k % 2) * 0.12 + (k === 3 ? 0.08 : 0), bx = Math.cos(a) * r * 0.9, by = Math.sin(a) * r * 0.9;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(-0.055, 0.03); ctx.lineTo(0, -h); ctx.lineTo(0.055, 0.03); ctx.closePath();
        ctx.fillStyle = ctx.createLinearGradient(-0.05, 0, 0.05, -h); (ctx.fillStyle as CanvasGradient).addColorStop(0, '#7dd3fc'); (ctx.fillStyle as CanvasGradient).addColorStop(0.5, '#e0f2fe'); (ctx.fillStyle as CanvasGradient).addColorStop(1, '#38bdf8');
        ctx.fill(); ctx.strokeStyle = '#0c3a66'; ctx.lineWidth = 0.015; ctx.stroke();
        ctx.restore();
      }
      helmet('#2153c4');
      // máscara de calavera
      shade(ctx, () => { ctx.moveTo(-0.02, -0.18); ctx.quadraticCurveTo(0.3, -0.24, 0.36, 0.02); ctx.quadraticCurveTo(0.34, 0.26, 0.15, 0.3); ctx.quadraticCurveTo(0.0, 0.22, -0.02, -0.18); ctx.closePath(); }, '#dbeafe', { x: 0.15, y: -0.12, r: 0.35, tex: 0.3 });
      ctx.fillStyle = '#081a3a'; for (const [ex, ew] of [[0.1, 0.07], [0.26, 0.075]] as const) { ctx.beginPath(); ctx.ellipse(ex, -0.03, ew, 0.065, 0, 0, TAU); ctx.fill(); }
      for (const ex of [0.1, 0.26]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + 0.01, -0.03, 0.025, 0, TAU); ctx.fill(); bloom(ctx, ex, -0.03, 0.12, '#bae6fd', 0.5 + power * 0.4); }
      ctx.fillStyle = '#081a3a'; ctx.beginPath(); ctx.moveTo(0.2, 0.05); ctx.lineTo(0.23, 0.11); ctx.lineTo(0.17, 0.11); ctx.fill(); // nariz
      ctx.fillStyle = '#0f2560'; ctx.fillRect(0.06, 0.16, 0.24, 0.07); ctx.fillStyle = '#e0f2fe'; for (let k = 0; k < 5; k++) ctx.fillRect(0.07 + k * 0.047, 0.165, 0.032, 0.055); // dientes
      break;
    }
    case 'volt': {
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 0.05 - 0.02, -r * 0.9); ctx.rotate(s * 0.4 - 0.1); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.06, -0.1); ctx.lineTo(0.02, -0.1); ctx.lineTo(0.07, -0.2); ctx.lineTo(-0.03, -0.07); ctx.lineTo(0.01, -0.07); ctx.closePath(); ctx.fill(); ctx.restore(); } // rayitos
      helmet('#d6a313');
      ctx.strokeStyle = '#7a5a08'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, -2.4, -0.6); ctx.stroke();
      // visor negro brillante
      shade(ctx, () => { ctx.moveTo(-0.02, -0.16); ctx.quadraticCurveTo(0.3, -0.2, 0.37, 0.0); ctx.quadraticCurveTo(0.34, 0.2, 0.08, 0.2); ctx.quadraticCurveTo(-0.04, 0.05, -0.02, -0.16); ctx.closePath(); }, '#111214', { x: 0.1, y: -0.1, r: 0.35, hi: 0.5, tex: 0.2 });
      spec(ctx, 0.12, -0.1, 0.13, 0.03, -0.15, 0.7);
      for (const ex of [0.12, 0.27]) { ctx.fillStyle = '#e0ffff'; ctx.beginPath(); ctx.ellipse(ex, 0.0, 0.035, 0.025, 0, 0, TAU); ctx.fill(); bloom(ctx, ex, 0, 0.12, '#22d3ee', 0.55 + power * 0.4); }
      shade(ctx, () => ctx.arc(-0.12, 0.05, 0.1, 0, TAU), '#1a1a1a', { x: -0.15, y: 0.02, r: 0.12 }); // oreja
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(-0.12, 0.05, 0.04, 0, TAU); ctx.fill();
      break;
    }
    case 'void': {
      // capucha con punta para atrás
      shade(ctx, () => { ctx.moveTo(0.36, 0.1); ctx.quadraticCurveTo(0.38, -0.38, -0.05, -0.4); ctx.quadraticCurveTo(-0.38, -0.36, -0.55, -0.1); ctx.quadraticCurveTo(-0.35, -0.08, -0.36, 0.2); ctx.quadraticCurveTo(-0.1, 0.42, 0.25, 0.32); ctx.closePath(); }, '#5f2bb0', { x: -0.1, y: -0.3, r: 0.6, hi: 0.35, tex: 0.5 });
      // la cara: sombra con estrellitas y dos ojos violetas
      ctx.save(); ctx.beginPath(); ctx.ellipse(0.13, 0.02, 0.22, 0.25, -0.1, 0, TAU); ctx.clip();
      const g = ctx.createRadialGradient(0.15, 0.05, 0, 0.13, 0.02, 0.28); g.addColorStop(0, '#2a0d52'); g.addColorStop(1, '#05010c'); ctx.fillStyle = g; ctx.fillRect(-0.2, -0.3, 0.6, 0.6);
      ctx.fillStyle = 'rgba(233,213,255,0.7)'; for (let k = 0; k < 6; k++) ctx.fillRect(0.0 + ((k * 37) % 25) / 100, -0.15 + ((k * 53) % 30) / 100, 0.012, 0.012);
      ctx.restore();
      for (const ex of [0.08, 0.23]) { ctx.fillStyle = '#f5e9ff'; ctx.beginPath(); ctx.ellipse(ex, -0.02, 0.045, 0.02, -0.25, 0, TAU); ctx.fill(); bloom(ctx, ex, -0.02, 0.14, '#a855f7', 0.6 + power * 0.4); }
      ctx.strokeStyle = 'rgba(192,132,252,0.6)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.ellipse(0.13, 0.02, 0.22, 0.25, -0.1, 0, TAU); ctx.stroke();
      // humito que se escapa
      for (let k = 0; k < 3; k++) { const d = (t * 0.8 + k / 3) % 1; ctx.fillStyle = `rgba(168,85,247,${0.35 * (1 - d)})`; ctx.beginPath(); ctx.arc(-0.45 - d * 0.3, -0.12 - d * 0.25 + Math.sin(t * 3 + k) * 0.03, 0.05 + d * 0.06, 0, TAU); ctx.fill(); }
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- El cuerpo completo
export interface FighterFx { power: number; frozen: boolean; poison: boolean; burn: boolean; zap: boolean; shield: boolean; speed: boolean; aura: string | null }
export function drawFighterBody(ctx: CanvasRenderingContext2D, f: Fighter, t: number, fx: FighterFx) {
  const L = LOOKS[f.char], p = poseOf(f, t);
  const hipY = -0.66 + p.bob + p.crouch * 0.4, hip: Pt = [0, hipY];
  const lean = p.lean, neck: Pt = [Math.sin(lean) * 0.5, hipY - Math.cos(lean) * 0.5];
  const shoulder: Pt = [neck[0] - 0.02, neck[1] + 0.06];
  if (fx.aura) { // aura de poder
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const g = ctx.createRadialGradient(0, -1, 0, 0, -1, 1.3 + k * 0.2 + Math.sin(t * 12 + k) * 0.05); g.addColorStop(0, alpha(fx.aura, 0.25)); g.addColorStop(1, alpha(fx.aura, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -1, 0.9 + k * 0.1, 1.4 + k * 0.1, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const limbCol = (back: boolean, c: string) => back ? darken(c, 0.35) : c;
  const leg = (i: number) => {
    const back = i === 0, [ta, kb] = p.legs[i], hp: Pt = [hip[0] + (back ? -0.1 : 0.1), hip[1]];
    const knee = add(hp, dirv(ta), 0.34), foot = add(knee, dirv(ta - kb), 0.34);
    segment(ctx, hp, knee, 0.27, 0.21, limbCol(back, L.armor), 0.6);
    segment(ctx, knee, foot, 0.21, 0.17, limbCol(back, L.dark), 0.5);
    shade(ctx, () => ctx.arc(knee[0], knee[1], 0.11, 0, TAU), limbCol(back, L.trim === '#1a1a1a' ? '#2a2a2a' : L.armor), { x: knee[0] - 0.03, y: knee[1] - 0.03, r: 0.1, lw: 0.6 }); // rodillera
    // bota grande
    ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(-(ta - kb) * 0.6);
    shade(ctx, () => { ctx.moveTo(-0.12, -0.14); ctx.lineTo(0.14, -0.11); ctx.quadraticCurveTo(0.29, -0.05, 0.27, 0.04); ctx.lineTo(-0.14, 0.04); ctx.closePath(); }, limbCol(back, L.boot), { x: 0, y: -0.08, r: 0.25, lw: 0.6 });
    ctx.fillStyle = limbCol(back, L.trim); ctx.fillRect(-0.14, 0.012, 0.41, 0.03);
    ctx.restore();
    return foot;
  };
  const arm = (i: number) => {
    const back = i === 0, [ua, eb] = p.arms[i], sp: Pt = [shoulder[0] + (back ? -0.15 : 0.13), shoulder[1]];
    const elbow = add(sp, dirv(ua), 0.27), hand = add(elbow, dirv(ua + eb), 0.25);
    segment(ctx, sp, elbow, 0.2, 0.16, limbCol(back, L.armor), 0.6);
    segment(ctx, elbow, hand, 0.17, 0.15, limbCol(back, L.dark), 0.5);
    shade(ctx, () => ctx.arc(hand[0], hand[1], 0.125, 0, TAU), limbCol(back, L.glove), { x: hand[0] - 0.03, y: hand[1] - 0.04, r: 0.12, lw: 0.6 }); // guante
    // hombrera
    shade(ctx, () => ctx.ellipse(sp[0], sp[1] + 0.01, 0.17, 0.13, ua * 0.3, 0, TAU), limbCol(back, L.armor), { x: sp[0] - 0.04, y: sp[1] - 0.05, r: 0.16, hi: 0.45, lw: 0.6 });
    if (f.char === 'bull' || f.char === 'frost') { ctx.fillStyle = limbCol(back, f.char === 'bull' ? '#e7dfd2' : '#bae6fd'); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sp[0] + k * 0.05 - 0.03, sp[1] - 0.07); ctx.lineTo(sp[0] + k * 0.05, sp[1] - 0.2); ctx.lineTo(sp[0] + k * 0.05 + 0.03, sp[1] - 0.07); ctx.fill(); } }
    return hand;
  };
  // sombra en el piso
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.45, 0.07, 0, 0, TAU); ctx.fill();
  arm(0); leg(0);
  // torso: pechera con el emblema
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(lean);
  const torso = () => { ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.38, -0.4); ctx.quadraticCurveTo(0, -0.6, 0.38, -0.4); ctx.lineTo(0.27, 0.06); ctx.closePath(); };
  shade(ctx, torso, L.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.4, tex: 0.45 });
  ctx.fillStyle = L.dark; ctx.beginPath(); ctx.roundRect(-0.27, -0.08, 0.53, 0.12, 0.03); ctx.fill(); // cinturón
  ctx.fillStyle = L.trim; ctx.fillRect(-0.04, -0.07, 0.09, 0.09);
  ctx.strokeStyle = alpha(L.trim, 0.8); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.2, -0.38); ctx.quadraticCurveTo(0, -0.25, 0.22, -0.38); ctx.stroke();
  // emblema
  ctx.save(); ctx.translate(0.03, -0.27); ctx.fillStyle = L.trim;
  if (f.char === 'volt') { ctx.beginPath(); ctx.moveTo(0.02, -0.1); ctx.lineTo(-0.06, 0.01); ctx.lineTo(0, 0.01); ctx.lineTo(-0.03, 0.1); ctx.lineTo(0.06, -0.02); ctx.lineTo(0, -0.02); ctx.closePath(); ctx.fillStyle = '#1a1a1a'; ctx.fill(); }
  else if (f.char === 'toxic') { ctx.beginPath(); ctx.arc(0, 0, 0.07, 0, TAU); ctx.fill(); ctx.fillStyle = L.dark; for (let k = 0; k < 3; k++) { const a = k * TAU / 3 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.065, a - 0.4, a + 0.4); ctx.fill(); } }
  else if (f.char === 'bull') { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-0.07, -0.05); ctx.quadraticCurveTo(0, 0.12, 0.07, -0.05); ctx.quadraticCurveTo(0, 0.03, -0.07, -0.05); ctx.fill(); }
  else if (f.char === 'frost') { ctx.strokeStyle = L.trim; ctx.lineWidth = 0.02; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.08, Math.sin(a) * 0.08); ctx.lineTo(-Math.cos(a) * 0.08, -Math.sin(a) * 0.08); ctx.stroke(); } }
  else { ctx.fillStyle = '#0b0218'; ctx.beginPath(); ctx.arc(0, 0, 0.07, 0, TAU); ctx.fill(); ctx.strokeStyle = L.trim; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, 0.07, t * 3, t * 3 + 4); ctx.stroke(); }
  bloom(ctx, 0, 0, 0.18, L.glow, 0.25 + fx.power * 0.5);
  ctx.restore();
  ctx.restore();
  leg(1);
  // cabeza
  ctx.save(); ctx.translate(neck[0] + 0.03, neck[1] - 0.33); ctx.rotate(p.head * 0.5);
  drawHead(ctx, f.char, t, fx.power, f.action === 'celebrate' ? 'happy' : f.action === 'stun' || f.action === 'sad' ? 'hurt' : 'normal');
  ctx.restore();
  arm(1);
  // efectos encima
  if (fx.frozen) { // encerrado en un bloque de hielo
    ctx.save(); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-0.45, 0.02); ctx.lineTo(-0.5, -1.4); ctx.lineTo(-0.3, -2.0); ctx.lineTo(0.35, -2.05); ctx.lineTo(0.52, -1.5); ctx.lineTo(0.45, 0.02); ctx.closePath();
    ctx.fillStyle = ctx.createLinearGradient(-0.5, -2, 0.5, 0); (ctx.fillStyle as CanvasGradient).addColorStop(0, 'rgba(240,250,255,0.85)'); (ctx.fillStyle as CanvasGradient).addColorStop(0.5, 'rgba(147,197,253,0.55)'); (ctx.fillStyle as CanvasGradient).addColorStop(1, 'rgba(59,130,246,0.6)');
    ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.3, -1.9); ctx.lineTo(-0.38, -0.6); ctx.moveTo(0.3, -1.95); ctx.lineTo(0.15, -1.2); ctx.stroke();
    ctx.restore();
  }
  if (fx.poison) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const d = (t * 0.9 + k / 5) % 1; ctx.fillStyle = `rgba(134,239,172,${0.6 * (1 - d)})`; ctx.beginPath(); ctx.arc(Math.sin(k * 2.3 + t) * 0.3, -0.6 - d * 1.6, 0.04 + d * 0.05, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (fx.burn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const d = (t * 2.2 + k / 9) % 1, x = Math.sin(k * 3.1) * 0.3, y = -0.2 - (k % 5) * 0.35 - d * 0.5, s = 0.14 * (1 - d); ctx.fillStyle = d < 0.4 ? 'rgba(254,240,138,0.8)' : 'rgba(249,115,22,0.6)'; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x, y - s * 3, x + s, y); ctx.fill(); } ctx.restore(); }
  if (fx.zap && Math.sin(t * 50) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 0.025; for (let k = 0; k < 3; k++) { ctx.beginPath(); let x = (Math.random() - 0.5) * 0.6, y = -0.1; ctx.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 0.3; y -= 0.3; ctx.lineTo(x, y); } ctx.stroke(); } bloom(ctx, 0, -1, 1, '#fde047', 0.3); ctx.restore(); }
  if (fx.shield) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(56,189,248,${0.5 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(0, -1, 0.75, 1.15, 0, 0, TAU); ctx.stroke(); const g = ctx.createRadialGradient(0, -1, 0.5, 0, -1, 1.15); g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(56,189,248,0.25)'); ctx.fillStyle = g; ctx.fill(); ctx.restore(); }
  if (f.action === 'block') { // escudo de energía adelante
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0.45, -1.05, 0, 0.45, -1.05, 0.75); g.addColorStop(0, alpha(L.glow, 0.05)); g.addColorStop(0.8, alpha(L.glow, 0.35)); g.addColorStop(1, alpha(L.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0.45, -1.05, 0.3, 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(L.glow, 0.8); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.ellipse(0.45, -1.05, 0.25, 0.75, 0, -1.2, 1.2); ctx.stroke();
    ctx.restore();
  }
  if (f.action === 'stun' && (f.stunKind === 'hit' || f.stunKind === 'burn')) { // estrellitas de mareo
    for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3; drawStar(ctx, Math.cos(a) * 0.35 + 0.05, -2.05 + Math.sin(a) * 0.08, 0.06, '#fde047'); }
  }
  if (fx.speed) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(L.glow, 0.5); ctx.lineWidth = 0.03; for (let k = 0; k < 5; k++) { const y = -0.3 - k * 0.32; ctx.beginPath(); ctx.moveTo(-0.4, y); ctx.lineTo(-1.1 - (k % 2) * 0.3, y); ctx.stroke(); } ctx.restore(); }
}
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// Retrato para la barra de arriba y el menú: la cabeza con fondo de su color.
export function drawPortrait(ctx: CanvasRenderingContext2D, char: CharId, size: number, t = 0, mirror = false) {
  const L = LOOKS[char];
  ctx.save(); ctx.clearRect(0, 0, size, size);
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, lighten(L.armor, 0.15)); g.addColorStop(1, '#05060a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size * 0.58); ctx.scale(size * 1.05, size * 1.05); if (mirror) ctx.scale(-1, 1); ctx.translate(-0.07, 0);
  drawHead(ctx, char, t, 0.6);
  ctx.restore();
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, TAU); ctx.strokeStyle = L.trim === '#1a1a1a' ? L.armor : L.trim; ctx.lineWidth = 2.5; ctx.stroke();
}
// El luchador entero para la pantalla de elegir personaje.
export function drawFighterCard(ctx: CanvasRenderingContext2D, char: CharId, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const L = LOOKS[char], g = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, w * 0.6);
  g.addColorStop(0, alpha(L.glow, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const s = h / 2.35;
  ctx.save(); ctx.translate(w / 2, h * 0.92); ctx.scale(s, s);
  const f = { side: 0, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0, kickT: 0, kickUp: 0, kickHit: false, stun: 0, stunKind: 'none', poison: 0, energy: 0, specialCd: 0, defenseCd: 0, speedT: 0, dashT: 0, powers: {}, prev: {} as Fighter['prev'], goals: 0 } as Fighter;
  drawFighterBody(ctx, f, t, { power: 0.5, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: null });
  ctx.restore();
}
