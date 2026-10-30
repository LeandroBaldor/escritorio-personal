// Los 16 luchadores de Kombat Football: caricaturas con cabeza grande y armadura (como en las referencias),
// todos dibujados por código con el mismo esqueleto y animaciones (guardia que respira, carrera, salto, patada,
// bloqueo, golpeado, habilidad, FATAL, festejo y bronca) y cada uno con su casco, sus colores y sus extras:
// COMETA (astronauta), INFERNO (casco con cuernos), FROST (corona de hielo), THUNDER (casco dorado con visor),
// SHADOW y RED SHADOW (ninjas con bufanda), ORBOT y BLUE ORBOT (robots con cañón en el brazo), BRUTO y BRUTO
// ROJO (gigantes con hombreras de púas), AGUILA y BLACK AGUILA (con alas), ESPECTRO (astronauta fantasma),
// TOXIC (máscara de gas), MAGMA (roca con lava en las grietas) y CYBER (samurái con espada láser).
// También el árbitro. Se dibujan con los pies en (0, 0), mirando a la derecha, en metros.
import { CHARS, PH, SIZE, type CharId, type Element, type Fighter, type Person } from './kombat';
import { alpha, bloom, darken, lighten, segment, shade, spec } from './gravityMonsters';

const TAU = Math.PI * 2;
type Pt = [number, number];

type Helmet = 'astro' | 'horned' | 'ice' | 'visor' | 'ninja' | 'gasmask' | 'robot' | 'brute' | 'eagle' | 'magma' | 'cyber';
type Extra = 'jetpack' | 'scarf' | 'cannon' | 'wings' | 'ghost' | 'cracks' | 'sword' | 'hose';
interface Look { armor: string; dark: string; trim: string; glow: string; boot: string; glove: string; helmet: Helmet; brute?: boolean; extras: Extra[]; eye: string; skin?: string }
export const LOOKS: Record<CharId, Look> = {
  cometa: { armor: '#e8edf5', dark: '#1e3a8a', trim: '#38bdf8', glow: '#7dd3fc', boot: '#1d4ed8', glove: '#e8edf5', helmet: 'astro', extras: ['jetpack'], eye: '#7dd3fc' },
  inferno: { armor: '#c0161c', dark: '#3f0709', trim: '#fbbf24', glow: '#fb923c', boot: '#2b0d0b', glove: '#9f1218', helmet: 'horned', extras: [], eye: '#fde68a', skin: '#e8b48f' },
  frost: { armor: '#1d4ed8', dark: '#0c1f5c', trim: '#bae6fd', glow: '#e0f2fe', boot: '#14307a', glove: '#2b5fd0', helmet: 'ice', extras: [], eye: '#e0f2fe', skin: '#dbeafe' },
  thunder: { armor: '#e0a812', dark: '#17140c', trim: '#17140c', glow: '#fef08a', boot: '#1c1a14', glove: '#c99410', helmet: 'visor', extras: [], eye: '#fffbe0', skin: '#e8b48f' },
  shadow: { armor: '#24212c', dark: '#0d0b12', trim: '#a855f7', glow: '#d8b4fe', boot: '#121016', glove: '#1b1922', helmet: 'ninja', extras: ['scarf'], eye: '#e9d5ff' },
  shadowRed: { armor: '#24191b', dark: '#0f0809', trim: '#ef4444', glow: '#fca5a5', boot: '#140c0d', glove: '#1e1416', helmet: 'ninja', extras: ['scarf'], eye: '#fecaca' },
  orbot: { armor: '#e7e5e4', dark: '#57534e', trim: '#facc15', glow: '#fde047', boot: '#292524', glove: '#a8a29e', helmet: 'robot', extras: ['cannon'], eye: '#fde047' }, // igual que BLUE ORBOT pero blanco con detalles amarillos
  orbotBlue: { armor: '#1e3a8a', dark: '#0b1530', trim: '#60a5fa', glow: '#93c5fd', boot: '#111a33', glove: '#22305e', helmet: 'robot', extras: ['cannon'], eye: '#bfdbfe' },
  bruto: { armor: '#6b7280', dark: '#2b2f36', trim: '#a16207', glow: '#fbbf24', boot: '#24272c', glove: '#7b818c', helmet: 'brute', brute: true, extras: [], eye: '#fcd34d' },
  brutoRed: { armor: '#b91c1c', dark: '#3f0a0a', trim: '#f97316', glow: '#fb923c', boot: '#2a0a0a', glove: '#a11a1a', helmet: 'brute', brute: true, extras: [], eye: '#fdba74' },
  aguila: { armor: '#d9a514', dark: '#16161c', trim: '#f8fafc', glow: '#fde68a', boot: '#17171d', glove: '#1f1f27', helmet: 'eagle', extras: ['wings'], eye: '#e0f2fe', skin: '#e8b48f' },
  aguilaBlack: { armor: '#2a1540', dark: '#0b0612', trim: '#c084fc', glow: '#f0abfc', boot: '#0f0a16', glove: '#1d1029', helmet: 'eagle', extras: ['wings'], eye: '#f5d0fe', skin: '#e8b48f' },
  espectro: { armor: '#0f3b45', dark: '#061a1f', trim: '#22d3ee', glow: '#a5f3fc', boot: '#0a2a31', glove: '#0f3b45', helmet: 'astro', extras: ['ghost'], eye: '#cffafe' },
  toxic: { armor: '#1d221b', dark: '#0d100c', trim: '#a3e635', glow: '#86efac', boot: '#141712', glove: '#2b3329', helmet: 'gasmask', extras: ['hose'], eye: '#bbf7d0' },
  magma: { armor: '#2b2523', dark: '#0f0b0a', trim: '#f97316', glow: '#fdba74', boot: '#1a1513', glove: '#352d2a', helmet: 'magma', brute: true, extras: ['cracks'], eye: '#fed7aa' },
  cyber: { armor: '#e7e9ef', dark: '#1d1d24', trim: '#ec4899', glow: '#f9a8d4', boot: '#22222a', glove: '#d9dbe3', helmet: 'cyber', extras: ['sword'], eye: '#fbcfe8' },
};

interface Pose { bob: number; lean: number; legs: [number, number][]; arms: [number, number][]; head: number; crouch: number; reach?: number; shrug?: number } // reach: largo de los brazos (festejo: los estira bien arriba)
// Ángulos medidos desde "para abajo" (0) y positivos hacia adelante. legs: [muslo, doblez de la rodilla];
// arms: [brazo, doblez del codo]. El primero de cada par es el de atrás.
function poseOf(f: Fighter, t: number): Pose {
  const s = Math.sin, a = f.action;
  if (f.abilityT > 0 && (f.char === 'aguila' || f.char === 'espectro')) return { bob: 0, lean: 0.9, crouch: 0, head: -0.6, legs: [[-0.5, 0.3], [-0.3, 0.5]], arms: [[-0.4, 0.2], [2.4, 0.1]] }; // volando / en fase
  if (f.abilityT > 0 && f.char === 'brutoRed') return { bob: 0, lean: 0.6, crouch: 0.1, head: 0.2, legs: [[-0.9 * s(t * 20), 0.6], [0.9 * s(t * 20), 0.6]], arms: [[1.6, 0.3], [1.8, 0.3]] }; // embestida
  if (a === 'run') {
    const w = t * 13;
    return { bob: Math.abs(s(w)) * 0.06, lean: 0.18, crouch: 0, head: 0.05,
      legs: [[-0.75 * s(w), 0.3 + 1.1 * Math.max(0, -Math.cos(w))], [0.75 * s(w), 0.3 + 1.1 * Math.max(0, Math.cos(w))]],
      arms: [[0.9 * s(w), 1.5], [-0.9 * s(w), 1.5]] };
  }
  if (a === 'charge') { // carga el tiro: la pierna atrás y los brazos abiertos, temblando cuando está a tope
    const k = Math.min(1, f.charge), sh = k > 0.95 ? s(t * 60) * 0.03 : 0;
    return { bob: sh, lean: -0.08 - k * 0.12, crouch: 0.12 + k * 0.12, head: -0.05, legs: [[-0.3, 0.55], [-0.5 - k * 0.7, 1.2 + k * 0.6]], arms: [[1.5 + k * 0.4, 0.6], [-0.7 - k * 0.5, 0.9]] };
  }
  if (a === 'header') { const k = Math.min(1, f.actionT / 0.12); return { bob: 0, lean: 0.15 + 0.25 * k, crouch: 0.05, head: 0.25 + 0.55 * k, legs: f.ground ? [[-0.35, 0.5], [0.3, 0.6]] : [[-0.3, 1.1], [0.5, 1.3]], arms: [[-0.7, 0.4], [-0.5, 0.5]] }; } // cabezazo: mete la cabeza
  if (a === 'jump') return { bob: 0, lean: 0.05, crouch: 0, head: -0.05, legs: [[-0.3, 1.2], [0.9, 1.6]], arms: [[-0.9, 0.5], [2.3, 0.4]] };
  if (a === 'kick') {
    const k = Math.min(1, (0.3 - f.kickT) / 0.3), swing = k < 0.35 ? -0.7 * (k / 0.35) : -0.7 + Math.min(1, (k - 0.35) / 0.25) * (f.kickKind === 'lob' ? 2.6 : f.kickKind === 'low' ? 1.5 : 2.1);
    return { bob: 0.02, lean: -0.15, crouch: 0.05, head: -0.05, legs: [[-0.25, 0.3], [swing, k < 0.4 ? 1.2 : 0.15]], arms: [[1.2, 1], [-0.6, 1.2]] };
  }
  if (a === 'slide') return { bob: 0, lean: -1.1, crouch: 0.6, head: -0.3, legs: [[1.5, 0.1], [1.2, 1.4]], arms: [[-0.6, 0.3], [0.9, 0.6]] };
  if (a === 'tired') { const br = s(t * 5); return { bob: br * 0.03, lean: 0.55, crouch: 0.2, head: 0.35, legs: [[-0.3, 0.7], [0.35, 0.7]], arms: [[0.5, 0.5], [0.7, 0.4]] }; }
  if (a === 'block') return { bob: s(t * 3) * 0.01, lean: 0.05, crouch: 0.12, head: 0.15, legs: [[-0.35, 0.6], [0.35, 0.6]], arms: [[1.1, 2.4], [1.3, 2.3]] };
  if (a === 'special') {
    if (f.char === 'bruto') { const k = Math.min(1, f.actionT * 6); return { bob: 0, lean: 0.3 * k, crouch: 0.3 * k, head: 0.1, legs: [[-0.6, 0.8], [0.6, 0.8]], arms: [[2.8 - k * 1.6, 0.2], [3 - k * 1.7, 0.2]] }; } // golpe al piso
    if (f.char === 'cometa') return { bob: 0, lean: -0.05, crouch: 0, head: -0.25, legs: [[-0.2, 0.4], [0.2, 0.6]], arms: [[2.9, 0.1], [3.0, 0.1]] };
    if (f.char === 'cyber') { const k = Math.min(1, f.actionT * 5); return { bob: 0, lean: 0.15, crouch: 0.1, head: 0, legs: [[-0.6, 0.5], [0.6, 0.6]], arms: [[0.3, 0.6], [2.8 - k * 2.2, 0.1]] }; } // tajo de arriba a abajo
    if (f.char === 'frost' || f.char === 'magma') return { bob: 0, lean: 0.1, crouch: 0.15, head: 0, legs: [[-0.55, 0.6], [0.5, 0.6]], arms: [[1.0, 0.4], [1.3, 0.3]] };
    return { bob: 0, lean: -0.1, crouch: 0.08, head: -0.1, legs: [[-0.5, 0.4], [0.45, 0.5]], arms: [[0.4, 0.5], [1.55, 0.15]] }; // tira para adelante
  }
  if (a === 'fatal') return { bob: s(t * 20) * 0.02, lean: -0.2, crouch: 0.1, head: -0.25, legs: [[-0.55, 0.5], [0.5, 0.5]], arms: [[2.6, 0.3], [2.4, 0.3]] };
  if (a === 'celebrate') { const w = t * 9, p0 = Math.max(0, Math.sin(w)), p1 = Math.max(0, Math.sin(w + Math.PI)); return { bob: Math.abs(s(t * 4.5)) * 0.06, lean: -0.12, crouch: 0, head: -0.32, legs: [[-0.25, 0.35], [0.3, 0.55]], arms: [[3.4 + p0 * 0.25, 0.08 - p0 * 1.2], [2.5 - p1 * 0.25, 0.1 + p1 * 1.2]], reach: 1.3, shrug: 0.07 }; } // festejo: agita los dos puños arriba, alternados, con los hombros arriba
  if (a === 'sad') return { bob: 0, lean: 0.35, crouch: 0.25, head: 0.4, legs: [[-0.3, 0.9], [0.4, 1.1]], arms: [[2.6, 2.4], [2.7, 2.5]] };
  if (a === 'stun') {
    if (f.stunKind === 'freeze') return { bob: 0, lean: 0.05, crouch: 0.05, head: 0, legs: [[-0.3, 0.4], [0.3, 0.4]], arms: [[0.8, 1.6], [1, 1.6]] };
    const w = t * (f.stunKind === 'zap' ? 40 : 14);
    return { bob: 0, lean: -0.35 + s(w) * 0.08, crouch: 0.1, head: -0.3 + s(w * 0.7) * 0.15, legs: [[-0.45, 0.5], [0.25, 0.7]], arms: [[-0.4 + s(w) * 0.6, 0.9], [-0.7 - s(w) * 0.6, 0.8]] };
  }
  // guardia de pelea
  const br = s(t * 3.2);
  return { bob: br * 0.025, lean: 0.08, crouch: 0.08 + br * 0.02, head: 0.05, legs: [[-0.45, 0.55], [0.4, 0.6]], arms: [[0.04 + br * 0.03, 1.7], [0.08 - br * 0.03, 1.55]] }; // guardia: el brazo cae derecho (hombro y codo en la misma línea) y el antebrazo va adelante
}
const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];
const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];
const grad = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [k, c] of stops) g.addColorStop(k, c); return g; };

// Ojo que brilla (núcleo blanco, color y resplandor).
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, power: number, rot = 0) {
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx * 1.4); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, color); g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.3, ry * 1.3, rot, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, x, y, Math.max(rx, ry) * 3.5, color, 0.35 + power * 0.4); ctx.restore();
}
// La parte de abajo de la cara que se ve debajo del casco (mentón y boca de perfil).
function chin(ctx: CanvasRenderingContext2D, skin: string, mood: 'normal' | 'hurt' | 'happy') {
  shade(ctx, () => { ctx.moveTo(0.02, 0.08); ctx.quadraticCurveTo(0.34, 0.06, 0.33, 0.18); ctx.quadraticCurveTo(0.28, 0.33, 0.08, 0.32); ctx.closePath(); }, skin, { x: 0.2, y: 0.12, r: 0.25, tex: 0.2, lw: 0.6 });
  ctx.strokeStyle = darken(skin, 0.6); ctx.lineWidth = 0.018; ctx.lineCap = 'round'; ctx.beginPath();
  if (mood === 'happy') ctx.arc(0.25, 0.2, 0.05, 0.2, Math.PI - 0.6); else if (mood === 'hurt') ctx.arc(0.25, 0.26, 0.05, Math.PI + 0.6, -0.2); else { ctx.moveTo(0.19, 0.22); ctx.lineTo(0.3, 0.2); }
  ctx.stroke();
}

// ---------------------------------------------------------------- Cascos
export function drawHead(ctx: CanvasRenderingContext2D, char: CharId, t: number, power: number, mood: 'normal' | 'hurt' | 'happy' = 'normal') {
  const L = LOOKS[char], r = 0.37; ctx.save(); ctx.scale(1.12, 1.12);
  const helmet = (base: string, rr = r) => shade(ctx, () => ctx.arc(0, 0, rr, 0, TAU), base, { x: -0.12, y: -0.15, r: rr * 1.4, hi: 0.4, tex: 0.35, lw: 1 });
  switch (L.helmet) {
    case 'astro': { // casco de astronauta: domo blanco, visor de vidrio enorme y auricular con luz
      const ghost = L.extras.includes('ghost');
      helmet(ghost ? '#103842' : '#eef2f8', 0.4);
      ctx.strokeStyle = ghost ? alpha(L.trim, 0.8) : '#a9b4c6'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, 0.36, -2.4, -0.7); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0.14, 0.02, 0.25, 0.27, -0.1, 0, TAU); ctx.clip();
      const g = ctx.createRadialGradient(0.05, -0.08, 0.02, 0.14, 0.02, 0.32); g.addColorStop(0, ghost ? '#0b2a33' : '#3b82f6'); g.addColorStop(0.6, ghost ? '#031015' : '#1e3a8a'); g.addColorStop(1, '#020617');
      ctx.fillStyle = g; ctx.fillRect(-0.2, -0.3, 0.6, 0.6);
      if (ghost) { eye(ctx, 0.08, -0.02, 0.05, 0.065, L.eye, power); eye(ctx, 0.24, -0.01, 0.045, 0.06, L.eye, power); }
      else { ctx.fillStyle = 'rgba(147,197,253,0.35)'; ctx.beginPath(); ctx.ellipse(0.26, 0.12, 0.08, 0.05, -0.5, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = ghost ? L.trim : '#cbd5e1'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.ellipse(0.14, 0.02, 0.25, 0.27, -0.1, 0, TAU); ctx.stroke();
      spec(ctx, 0.06, -0.12, 0.1, 0.05, -0.5, 0.85);
      shade(ctx, () => ctx.arc(-0.2, 0.04, 0.09, 0, TAU), ghost ? '#164e5a' : '#dbe3ee', { x: -0.22, y: 0.01, r: 0.1 }); // auricular
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(-0.2, 0.04, 0.045, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, -0.2, 0.04, 0.15, L.glow, 0.5); ctx.restore();
      break;
    }
    case 'horned': { // INFERNO: casco rojo con dos cuernos, visera negra con ojos de fuego y el mentón
      const horn = (sx: number, dark: boolean) => {
        ctx.save(); ctx.translate(sx, -0.26);
        ctx.beginPath(); ctx.moveTo(-0.07, 0.05); ctx.bezierCurveTo(-0.16, -0.12, -0.06, -0.33, 0.1, -0.42); ctx.bezierCurveTo(0.01, -0.28, 0.0, -0.12, 0.07, 0.03); ctx.closePath();
        ctx.fillStyle = grad(ctx, 0, 0.05, 0.08, -0.42, [[0, dark ? '#5b0a0c' : '#9f1218'], [0.6, dark ? '#9f1218' : '#ef4444'], [1, dark ? '#fca5a5' : '#fff1f1']]);
        ctx.fill(); ctx.strokeStyle = '#1a0404'; ctx.lineWidth = 0.02; ctx.stroke(); ctx.restore();
      };
      horn(-0.16, true);
      helmet(L.armor);
      horn(0.08, false);
      ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, -2.2, -1.2); ctx.lineTo(0, 0); ctx.fill(); // cresta
      shade(ctx, () => { ctx.moveTo(-0.02, -0.12); ctx.quadraticCurveTo(0.2, -0.19, 0.37, -0.09); ctx.lineTo(0.37, 0.06); ctx.quadraticCurveTo(0.2, 0.0, -0.02, 0.04); ctx.closePath(); }, '#140606', { x: 0.15, y: -0.1, r: 0.3, hi: 0.3, tex: 0.2 });
      eye(ctx, 0.14, -0.04, 0.05, 0.03, L.glow, power, -0.15); eye(ctx, 0.29, -0.04, 0.045, 0.028, L.glow, power, -0.2);
      chin(ctx, L.skin!, mood === 'normal' ? 'hurt' : mood);
      shade(ctx, () => ctx.arc(-0.2, 0.06, 0.08, 0, TAU), '#7f1d1d', { x: -0.22, y: 0.03, r: 0.09 });
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(-0.2, 0.06, 0.035, 0, TAU); ctx.fill();
      break;
    }
    case 'ice': { // FROST: casco azul con púas de hielo y máscara blanca
      for (let k = 0; k < 6; k++) {
        const a = -2.7 + k * 0.42, h = 0.22 + (k % 2) * 0.13 + (k === 3 ? 0.08 : 0), bx = Math.cos(a) * r * 0.9, by = Math.sin(a) * r * 0.9;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2 - 0.35);
        ctx.beginPath(); ctx.moveTo(-0.055, 0.03); ctx.lineTo(0, -h); ctx.lineTo(0.055, 0.03); ctx.closePath();
        ctx.fillStyle = grad(ctx, -0.05, 0, 0.05, -h, [[0, '#2563eb'], [0.5, '#93c5fd'], [1, '#f0f9ff']]);
        ctx.fill(); ctx.strokeStyle = '#0c2a66'; ctx.lineWidth = 0.015; ctx.stroke(); ctx.restore();
      }
      helmet(L.armor);
      shade(ctx, () => { ctx.moveTo(-0.02, -0.16); ctx.quadraticCurveTo(0.3, -0.22, 0.36, 0.02); ctx.quadraticCurveTo(0.34, 0.26, 0.15, 0.3); ctx.quadraticCurveTo(0.0, 0.22, -0.02, -0.16); ctx.closePath(); }, '#e6f1ff', { x: 0.15, y: -0.12, r: 0.35, tex: 0.3 });
      ctx.fillStyle = '#0a1d45'; for (const [ex, ew] of [[0.1, 0.07], [0.26, 0.075]] as const) { ctx.beginPath(); ctx.ellipse(ex, -0.03, ew, 0.06, 0, 0, TAU); ctx.fill(); }
      eye(ctx, 0.11, -0.03, 0.028, 0.022, L.eye, power); eye(ctx, 0.27, -0.03, 0.028, 0.022, L.eye, power);
      ctx.strokeStyle = '#7fb0e8'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(0.18, 0.06); ctx.lineTo(0.2, 0.13); ctx.moveTo(0.1, 0.2); ctx.lineTo(0.3, 0.2); ctx.stroke();
      break;
    }
    case 'visor': { // THUNDER: casco dorado con visor negro, rayitos y mentón
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 0.05 - 0.06, -r * 0.92); ctx.rotate(s * 0.4 - 0.3); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.06, -0.1); ctx.lineTo(0.02, -0.1); ctx.lineTo(0.07, -0.2); ctx.lineTo(-0.03, -0.07); ctx.lineTo(0.01, -0.07); ctx.closePath(); ctx.fill(); ctx.restore(); }
      helmet(L.armor);
      ctx.fillStyle = '#5c4306'; ctx.beginPath(); ctx.moveTo(-0.3, -0.18); ctx.quadraticCurveTo(-0.05, -0.36, 0.2, -0.3); ctx.lineTo(0.18, -0.24); ctx.quadraticCurveTo(-0.05, -0.28, -0.28, -0.12); ctx.fill(); // franja negra
      shade(ctx, () => { ctx.moveTo(-0.02, -0.17); ctx.quadraticCurveTo(0.3, -0.21, 0.37, 0.0); ctx.quadraticCurveTo(0.33, 0.1, 0.06, 0.08); ctx.quadraticCurveTo(-0.04, -0.02, -0.02, -0.17); ctx.closePath(); }, '#0c0d10', { x: 0.1, y: -0.1, r: 0.35, hi: 0.5, tex: 0.2 });
      spec(ctx, 0.12, -0.11, 0.13, 0.03, -0.15, 0.7);
      eye(ctx, 0.13, -0.03, 0.04, 0.028, L.eye, power); eye(ctx, 0.28, -0.03, 0.035, 0.026, L.eye, power);
      chin(ctx, L.skin!, mood === 'normal' ? 'hurt' : mood);
      shade(ctx, () => ctx.arc(-0.17, 0.05, 0.1, 0, TAU), '#1a1a1a', { x: -0.2, y: 0.02, r: 0.12 });
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(-0.17, 0.05, 0.04, 0, TAU); ctx.fill();
      break;
    }
    case 'ninja': { // SHADOW: capucha negra con la banda de color y los ojos que brillan
      helmet(L.armor);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.moveTo(-0.4, -0.12); ctx.quadraticCurveTo(0, -0.2, 0.42, -0.14); ctx.lineTo(0.42, -0.02); ctx.quadraticCurveTo(0, -0.08, -0.4, 0.0); ctx.fill(); // banda
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-0.4, -0.15, 0.8, 0.02);
      ctx.fillStyle = '#070609'; ctx.beginPath(); ctx.moveTo(0.04, -0.07); ctx.quadraticCurveTo(0.22, -0.13, 0.38, -0.08); ctx.lineTo(0.38, 0.0); ctx.quadraticCurveTo(0.22, -0.04, 0.04, 0.0); ctx.fill(); // la abertura de los ojos
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.015; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.05, 0.08 + k * 0.07); ctx.quadraticCurveTo(0.22, 0.05 + k * 0.07, 0.38, 0.09 + k * 0.06); ctx.stroke(); } // tela
      ctx.restore();
      eye(ctx, 0.14, -0.04, 0.045, 0.024, L.eye, power, -0.15); eye(ctx, 0.29, -0.035, 0.04, 0.022, L.eye, power, -0.2);
      // nudo de la banda atrás
      for (let k = 0; k < 2; k++) { const w = Math.sin(t * 9 + k * 1.3) * 0.06; ctx.fillStyle = darken(L.trim, k * 0.2); ctx.beginPath(); ctx.moveTo(-0.34, -0.08); ctx.quadraticCurveTo(-0.5, -0.12 + w + k * 0.06, -0.62, -0.02 + w + k * 0.1); ctx.lineTo(-0.58, 0.03 + w + k * 0.1); ctx.quadraticCurveTo(-0.45, -0.02 + k * 0.06, -0.34, -0.02); ctx.fill(); }
      break;
    }
    case 'gasmask': { // TOXIC y ORBOT: casco negro con máscara de gas, lentes que brillan y filtro
      ctx.strokeStyle = '#11140f'; ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.22, 0.2); ctx.bezierCurveTo(0.1, 0.42, -0.25, 0.42, -0.32, 0.25); ctx.stroke();
      ctx.strokeStyle = alpha(L.trim, 0.5); ctx.lineWidth = 0.035; ctx.setLineDash([0.03, 0.03]); ctx.stroke(); ctx.setLineDash([]);
      helmet(L.armor);
      ctx.strokeStyle = alpha(L.trim, 0.9); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0, 0, r * 0.88, -2.6, -0.5); ctx.stroke(); // franja del casco
      ctx.beginPath(); ctx.moveTo(-0.05, -0.36); ctx.lineTo(-0.05, -0.12); ctx.stroke();
      shade(ctx, () => ctx.ellipse(0.13, 0.04, 0.27, 0.3, -0.1, 0, TAU), '#15190f', { x: 0.05, y: -0.1, r: 0.35, tex: 0.4 });
      for (const [ex, ey, er] of [[0.06, -0.05, 0.1], [0.25, -0.03, 0.11]] as const) {
        ctx.fillStyle = '#0a0c09'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = alpha(L.trim, 0.8); ctx.lineWidth = 0.022; ctx.stroke();
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er); g.addColorStop(0, '#f7fff0'); g.addColorStop(0.35, L.trim); g.addColorStop(1, darken(L.trim, 0.6));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, ex, ey, er * 3, L.trim, 0.35 + power * 0.4); ctx.restore();
        spec(ctx, ex - er * 0.35, ey - er * 0.4, er * 0.3, er * 0.18, -0.5, 0.8);
      }
      ctx.save(); ctx.translate(0.27, 0.2); ctx.rotate(-0.3);
      shade(ctx, () => ctx.roundRect(-0.09, -0.07, 0.18, 0.15, 0.04), '#3a4237', { x: -0.03, y: -0.05, r: 0.15 });
      ctx.strokeStyle = '#11140f'; ctx.lineWidth = 0.015; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 0.03, -0.05); ctx.lineTo(k * 0.03, 0.06); ctx.stroke(); }
      ctx.fillStyle = L.trim; ctx.fillRect(-0.09, -0.075, 0.18, 0.015);
      ctx.restore();
      break;
    }
    case 'robot': { // BLUE ORBOT: domo azul con cresta, máscara respirador y ojos de luz
      helmet(L.armor);
      ctx.fillStyle = darken(L.armor, 0.4); ctx.beginPath(); ctx.moveTo(-0.04, -0.37); ctx.lineTo(0.04, -0.37); ctx.lineTo(0.02, -0.05); ctx.lineTo(-0.06, -0.05); ctx.fill(); // cresta
      ctx.strokeStyle = alpha(L.trim, 0.7); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, -2.7, -0.6); ctx.stroke();
      shade(ctx, () => { ctx.moveTo(0.0, -0.12); ctx.quadraticCurveTo(0.3, -0.16, 0.37, 0.02); ctx.quadraticCurveTo(0.35, 0.28, 0.12, 0.3); ctx.quadraticCurveTo(0.0, 0.2, 0.0, -0.12); ctx.closePath(); }, '#11151f', { x: 0.15, y: -0.08, r: 0.35, tex: 0.3 });
      eye(ctx, 0.12, -0.03, 0.05, 0.035, L.eye, power); eye(ctx, 0.28, -0.025, 0.045, 0.032, L.eye, power);
      ctx.fillStyle = '#2b3448'; for (let k = 0; k < 4; k++) ctx.fillRect(0.12 + k * 0.05, 0.12, 0.03, 0.1); // rejilla
      shade(ctx, () => ctx.arc(-0.18, 0.05, 0.1, 0, TAU), '#3b4a6b', { x: -0.2, y: 0.02, r: 0.12 });
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(-0.18, 0.05, 0.03, 0, TAU); ctx.fill();
      break;
    }
    case 'brute': case 'magma': { // BRUTO / MAGMA: cabezota de piedra y metal con ojos rasgados y reja en la boca
      const magma = L.helmet === 'magma';
      shade(ctx, () => { ctx.moveTo(-0.34, 0.2); ctx.lineTo(-0.38, -0.12); ctx.quadraticCurveTo(-0.3, -0.4, 0.02, -0.42); ctx.quadraticCurveTo(0.34, -0.4, 0.4, -0.1); ctx.lineTo(0.38, 0.22); ctx.quadraticCurveTo(0.05, 0.36, -0.34, 0.2); ctx.closePath(); }, L.armor, { x: -0.1, y: -0.2, r: 0.6, hi: 0.3, tex: 0.7, lw: 1 });
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.38, -0.05); ctx.lineTo(0.4, -0.05); ctx.moveTo(0.0, -0.42); ctx.lineTo(0.0, -0.05); ctx.stroke(); // placas
      for (const [px, py] of [[-0.28, -0.22], [0.3, -0.22], [-0.3, 0.12]] as const) { ctx.fillStyle = '#c0c6d0'; ctx.beginPath(); ctx.arc(px, py, 0.025, 0, TAU); ctx.fill(); } // remaches
      ctx.fillStyle = '#0c0b0a'; ctx.beginPath(); ctx.moveTo(0.06, -0.1); ctx.lineTo(0.38, -0.06); ctx.lineTo(0.38, 0.03); ctx.lineTo(0.06, -0.01); ctx.fill(); // la ranura de los ojos
      eye(ctx, 0.15, -0.05, 0.05, 0.022, L.eye, power, 0.1); eye(ctx, 0.31, -0.03, 0.045, 0.02, L.eye, power, 0.1);
      ctx.fillStyle = '#16130f'; ctx.beginPath(); ctx.roundRect(0.1, 0.09, 0.28, 0.15, 0.03); ctx.fill(); // reja de la boca
      ctx.fillStyle = magma ? '#f97316' : '#8b929d'; for (let k = 0; k < 5; k++) ctx.fillRect(0.12 + k * 0.055, 0.1, 0.022, 0.13);
      if (magma) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.3, -0.3); ctx.lineTo(-0.15, -0.18); ctx.lineTo(-0.2, 0.0); ctx.moveTo(0.1, -0.38); ctx.lineTo(0.18, -0.22); ctx.moveTo(-0.32, 0.12); ctx.lineTo(-0.12, 0.16); ctx.stroke(); bloom(ctx, -0.15, -0.1, 0.4, '#f97316', 0.35); ctx.restore(); }
      break;
    }
    case 'eagle': { // AGUILA: casco con alas a los costados, visor y mentón
      const wingC = L.trim === '#f8fafc' ? '#f1f5f9' : '#2d1b45';
      for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(-0.12, -0.2); ctx.rotate(-0.9 - k * 0.22); ctx.fillStyle = k % 2 ? darken(wingC, 0.15) : wingC; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.06, -0.25, 0.0, -0.42 + k * 0.04); ctx.quadraticCurveTo(-0.07, -0.22, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.01; ctx.stroke(); ctx.restore(); }
      helmet(L.armor);
      ctx.fillStyle = darken(L.armor, 0.35); ctx.beginPath(); ctx.moveTo(-0.05, -0.37); ctx.quadraticCurveTo(0.3, -0.34, 0.42, -0.12); ctx.lineTo(0.33, -0.1); ctx.quadraticCurveTo(0.2, -0.28, -0.05, -0.3); ctx.fill(); // pico del casco
      shade(ctx, () => { ctx.moveTo(0.0, -0.12); ctx.quadraticCurveTo(0.22, -0.18, 0.37, -0.08); ctx.lineTo(0.36, 0.05); ctx.quadraticCurveTo(0.2, 0.0, 0.0, 0.04); ctx.closePath(); }, '#0d0d12', { x: 0.15, y: -0.1, r: 0.3, hi: 0.3, tex: 0.2 });
      eye(ctx, 0.15, -0.04, 0.045, 0.026, L.eye, power, -0.1); eye(ctx, 0.29, -0.035, 0.04, 0.024, L.eye, power, -0.15);
      chin(ctx, L.skin!, mood);
      break;
    }
    case 'cyber': { // CYBER: casco blanco con aletas rosas, visor de luz y mandíbula negra
      for (const [x, s] of [[-0.12, 0.8], [0.06, 1]] as const) { ctx.save(); ctx.translate(x, -0.25); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-0.06, 0.04); ctx.lineTo(0.02, -0.34); ctx.lineTo(0.08, 0.02); ctx.closePath(); ctx.fillStyle = grad(ctx, 0, 0.04, 0, -0.34, [[0, '#d9dbe3'], [0.6, '#f8fafc'], [1, L.trim]]); ctx.fill(); ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 0.018; ctx.stroke(); ctx.restore(); }
      helmet(L.armor);
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.moveTo(-0.3, -0.05); ctx.quadraticCurveTo(-0.1, -0.12, 0.0, -0.1); ctx.lineTo(0.0, -0.06); ctx.quadraticCurveTo(-0.15, -0.06, -0.3, 0.0); ctx.fill(); // franja
      shade(ctx, () => { ctx.moveTo(0.02, -0.13); ctx.quadraticCurveTo(0.24, -0.18, 0.38, -0.08); ctx.lineTo(0.38, 0.02); ctx.quadraticCurveTo(0.22, -0.02, 0.02, 0.0); ctx.closePath(); }, darken(L.trim, 0.55), { x: 0.2, y: -0.1, r: 0.3, hi: 0.5, tex: 0.1 });
      eye(ctx, 0.17, -0.06, 0.06, 0.025, L.eye, power); eye(ctx, 0.32, -0.05, 0.04, 0.022, L.eye, power);
      shade(ctx, () => { ctx.moveTo(0.03, 0.05); ctx.lineTo(0.36, 0.06); ctx.quadraticCurveTo(0.33, 0.26, 0.12, 0.3); ctx.lineTo(0.03, 0.2); ctx.closePath(); }, '#1d1d24', { x: 0.2, y: 0.1, r: 0.25, tex: 0.2 }); // mandíbula
      ctx.fillStyle = L.trim; for (let k = 0; k < 3; k++) ctx.fillRect(0.14 + k * 0.06, 0.14, 0.03, 0.02);
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- El cuerpo completo
export interface FighterFx { power: number; frozen: boolean; poison: boolean; burn: boolean; zap: boolean; shield: boolean; speed: boolean; aura: string | null; lit?: boolean }
const EMBLEM: Record<Element, (ctx: CanvasRenderingContext2D, c: string, t: number) => void> = {
  fire: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -0.09); ctx.quadraticCurveTo(0.08, -0.01, 0.04, 0.07); ctx.quadraticCurveTo(0, 0.02, -0.04, 0.07); ctx.quadraticCurveTo(-0.08, -0.01, 0, -0.09); ctx.fill(); },
  ice: (ctx, c) => { ctx.strokeStyle = c; ctx.lineWidth = 0.02; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.08, Math.sin(a) * 0.08); ctx.lineTo(-Math.cos(a) * 0.08, -Math.sin(a) * 0.08); ctx.stroke(); } },
  volt: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0.02, -0.1); ctx.lineTo(-0.06, 0.01); ctx.lineTo(0, 0.01); ctx.lineTo(-0.03, 0.1); ctx.lineTo(0.06, -0.02); ctx.lineTo(0, -0.02); ctx.closePath(); ctx.fill(); },
  dark: (ctx, c, t) => { ctx.fillStyle = '#0b0218'; ctx.beginPath(); ctx.arc(0, 0, 0.07, 0, TAU); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, 0.07, t * 3, t * 3 + 4); ctx.stroke(); },
  toxic: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 0.07, 0, TAU); ctx.fill(); ctx.fillStyle = '#0d100c'; for (let k = 0; k < 3; k++) { const a = k * TAU / 3 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.065, a - 0.4, a + 0.4); ctx.fill(); } },
  rock: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; ctx.lineTo(Math.cos(a) * 0.075, Math.sin(a) * 0.075); } ctx.fill(); },
};
export function drawFighterBody(ctx: CanvasRenderingContext2D, f: Fighter, t: number, fx: FighterFx) {
  const L = LOOKS[f.char], p = poseOf(f, t), K = L.brute ? 1.32 : 1, ghost = L.extras.includes('ghost');
  const hipY = -0.66 + p.bob + p.crouch * 0.4, hip: Pt = [0, hipY];
  const lean = p.lean, neck: Pt = [Math.sin(lean) * 0.5, hipY - Math.cos(lean) * 0.5];
  const shoulder: Pt = [neck[0] - 0.02, neck[1] + 0.13]; // hombros un poco más abajo y más separados: se ven los brazos
  if (fx.aura && !fx.lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const g = ctx.createRadialGradient(0, -1, 0, 0, -1, 1.3 + k * 0.2 + Math.sin(t * 12 + k) * 0.05); g.addColorStop(0, alpha(fx.aura, 0.25)); g.addColorStop(1, alpha(fx.aura, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -1, 0.9 + k * 0.1, 1.4 + k * 0.1, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (!fx.lit) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.45 * K, 0.07, 0, 0, TAU); ctx.fill(); }
  if (ghost) { ctx.save(); ctx.globalAlpha = 0.82; }
  // alas (detrás de todo)
  if (L.extras.includes('wings')) {
    const flap = Math.sin(t * (f.abilityT > 0 ? 18 : 3)) * (f.abilityT > 0 ? 0.35 : 0.08), wc = L.trim === '#f8fafc' ? '#f8fafc' : '#2d1b45', wc2 = L.trim === '#f8fafc' ? '#e0a812' : '#c084fc';
    ctx.save(); ctx.translate(shoulder[0] - 0.12, shoulder[1] + 0.08); ctx.rotate(flap);
    for (let k = 0; k < 8; k++) { const a = 1.75 + k * 0.17, len = 1.25 - Math.abs(k - 2) * 0.09; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.09, len * 0.5, 0, len); ctx.quadraticCurveTo(-0.09, len * 0.5, 0, 0); ctx.fillStyle = grad(ctx, 0, 0, 0, len, [[0, wc2], [0.45, wc], [1, k % 2 ? darken(wc, 0.15) : wc]]); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.012; ctx.stroke(); ctx.restore(); }
    if (f.abilityT > 0) { ctx.globalCompositeOperation = 'lighter'; bloom(ctx, -0.4, -0.3, 0.8, L.glow, 0.5); }
    ctx.restore();
  }
  // bufanda del ninja que flamea
  if (L.extras.includes('scarf')) {
    const sp = Math.min(1, Math.abs(f.vx) / 8);
    for (let k = 0; k < 2; k++) { ctx.fillStyle = darken(L.trim, k * 0.25); ctx.beginPath(); ctx.moveTo(neck[0] - 0.05, neck[1] + 0.02); for (let j = 1; j <= 6; j++) { const x = neck[0] - 0.05 - j * (0.12 + sp * 0.06), y = neck[1] + 0.02 + Math.sin(t * 10 + j * 0.9 + k) * 0.05 * j * 0.4 + j * (0.05 - sp * 0.04) + k * 0.05; ctx.lineTo(x, y); } for (let j = 6; j >= 0; j--) { const x = neck[0] - 0.05 - j * (0.12 + sp * 0.06), y = neck[1] + 0.09 + Math.sin(t * 10 + j * 0.9 + k) * 0.05 * j * 0.4 + j * (0.05 - sp * 0.04) + k * 0.05; ctx.lineTo(x, y); } ctx.fill(); }
  }
  // mochila propulsora
  if (L.extras.includes('jetpack')) {
    const jp: Pt = [neck[0] - 0.36, neck[1] + 0.3];
    shade(ctx, () => ctx.roundRect(jp[0] - 0.1, jp[1] - 0.22, 0.2, 0.42, 0.06), '#cbd5e1', { x: jp[0] - 0.04, y: jp[1] - 0.15, r: 0.3 });
    ctx.fillStyle = L.trim; ctx.fillRect(jp[0] - 0.06, jp[1] - 0.1, 0.12, 0.03);
    if (f.abilityT > 0 || !f.ground) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fl = 0.3 + (f.abilityT > 0 ? 0.4 : 0) + Math.sin(t * 40) * 0.05; ctx.fillStyle = grad(ctx, 0, jp[1] + 0.2, 0, jp[1] + 0.2 + fl, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(125,211,252,0.8)'], [1, 'rgba(59,130,246,0)']]); ctx.beginPath(); ctx.moveTo(jp[0] - 0.07, jp[1] + 0.2); ctx.lineTo(jp[0], jp[1] + 0.2 + fl); ctx.lineTo(jp[0] + 0.07, jp[1] + 0.2); ctx.fill(); ctx.restore(); }
  }
  const limbCol = (back: boolean, c: string) => back ? darken(c, 0.35) : c;
  const trimOf = (l: Look) => l.trim === '#17140c' ? '#e0a812' : l.trim;
  const leg = (i: number) => {
    const back = i === 0, [ta, kb] = p.legs[i], hp: Pt = [hip[0] + (back ? -0.1 : 0.1) * K, hip[1]];
    const knee = add(hp, dirv(ta), 0.34), foot = add(knee, dirv(ta - kb), 0.34);
    segment(ctx, hp, knee, 0.27 * K, 0.21 * K, limbCol(back, L.armor), 0.6);
    segment(ctx, knee, foot, 0.21 * K, 0.17 * K, limbCol(back, L.dark), 0.5);
    // placa del muslo con la franja de color y la canillera con una luz
    const td = dirv(ta), tn: Pt = [td[1], -td[0]];
    segment(ctx, add(hp, td, 0.07), add(hp, td, 0.26), 0.2 * K, 0.17 * K, limbCol(back, lighten(L.armor, 0.08)), 0.8);
    ctx.strokeStyle = limbCol(back, trimOf(L)); ctx.lineWidth = 0.025; ctx.beginPath(); const tm = add(hp, td, 0.17); ctx.moveTo(tm[0] - tn[0] * 0.09 * K, tm[1] - tn[1] * 0.09 * K); ctx.lineTo(tm[0] + tn[0] * 0.09 * K, tm[1] + tn[1] * 0.09 * K); ctx.stroke();
    const sd = dirv(ta - kb), s0 = add(knee, sd, 0.08), s1 = add(knee, sd, 0.27);
    if (!back) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(L.glow, 0.75); ctx.lineWidth = 0.022; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s0[0] + sd[1] * 0.06, s0[1] - sd[0] * 0.06); ctx.lineTo(s1[0] + sd[1] * 0.05, s1[1] - sd[0] * 0.05); ctx.stroke(); ctx.restore(); }
    shade(ctx, () => ctx.arc(knee[0], knee[1], 0.11 * K, 0, TAU), limbCol(back, L.armor), { x: knee[0] - 0.03, y: knee[1] - 0.03, r: 0.1, lw: 0.6 });
    ctx.fillStyle = limbCol(back, darken(L.armor, 0.4)); ctx.beginPath(); ctx.arc(knee[0] + 0.02, knee[1] + 0.01, 0.025, 0, TAU); ctx.fill(); // remache
    ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(-(ta - kb) * 0.6); ctx.scale(K * 0.95 + 0.05, 1);
    shade(ctx, () => { ctx.moveTo(-0.12, -0.14); ctx.lineTo(0.14, -0.11); ctx.quadraticCurveTo(0.29, -0.05, 0.27, 0.04); ctx.lineTo(-0.14, 0.04); ctx.closePath(); }, limbCol(back, L.boot), { x: 0, y: -0.08, r: 0.25, lw: 0.6 });
    ctx.fillStyle = limbCol(back, L.trim === '#17140c' ? '#e0a812' : L.trim); ctx.fillRect(-0.14, 0.012, 0.41, 0.03);
    ctx.fillStyle = '#07080b'; ctx.fillRect(-0.15, 0.04, 0.43, 0.035); // suela
    ctx.fillStyle = limbCol(back, darken(L.boot, 0.45)); ctx.fillRect(-0.1, -0.1, 0.17, 0.028); ctx.fillRect(-0.1, -0.045, 0.2, 0.028); // correas
    ctx.fillStyle = limbCol(back, '#cbd5e1'); ctx.fillRect(0.05, -0.098, 0.025, 0.024); ctx.fillRect(0.08, -0.043, 0.025, 0.024); // hebillas
    if (!back) { spec(ctx, 0.16, -0.07, 0.08, 0.035, -0.3, 0.55); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.02, -0.12); ctx.lineTo(0.06, 0.0); ctx.stroke(); }
    if (!back && f.action === 'charge') { // el pie se carga de energía
      const k = Math.min(1, f.charge); ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.08, -0.04, 0.25 + k * 0.45, L.glow, 0.35 + k * 0.5);
      for (let j = 0; j < 7; j++) { const a = t * 9 + j * TAU / 7, r = (0.55 - ((t * 2 + j / 7) % 1) * 0.45) * (0.5 + k); ctx.fillStyle = alpha(j % 2 ? L.glow : '#ffffff', 0.8); ctx.beginPath(); ctx.arc(0.08 + Math.cos(a) * r, -0.04 + Math.sin(a) * r * 0.7, 0.025, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };
  // los hombros en las esquinas de arriba del pecho (izquierdo y derecho), girados con el cuerpo
  const shoulderAt = (i: number): Pt => { const lx = (i === 0 ? -0.33 : 0.27) * K, ly = -0.42 + (i === 0 ? 0.02 : -0.04) - (p.shrug ?? 0); return [hip[0] + lx * Math.cos(lean) - ly * Math.sin(lean), hip[1] + lx * Math.sin(lean) + ly * Math.cos(lean)]; };
  // El puño: guante con nudillos marcados, dedos cerrados, el pulgar cruzado, una placa arriba y la muñequera.
  // Se dibuja girado según hacia dónde apunta el antebrazo.
  const fist = (hand: Pt, ang: number, back: boolean) => {
    const z = (L.brute ? 1.45 : 1) * 1.05, gc = limbCol(back, L.glove);
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-ang); ctx.scale(z, z); // +y: hacia donde apunta el antebrazo
    shade(ctx, () => ctx.roundRect(-0.085, -0.13, 0.17, 0.065, 0.02), limbCol(back, trimOf(L)), { x: -0.03, y: -0.12, r: 0.1, lw: 0.6 }); // muñequera
    shade(ctx, () => ctx.roundRect(-0.115, -0.08, 0.23, 0.2, 0.07), gc, { x: -0.04, y: -0.04, r: 0.2, hi: 0.45, lw: 0.6 }); // la mano cerrada
    for (let k = 0; k < 4; k++) { const kx = -0.08 + k * 0.053; shade(ctx, () => ctx.ellipse(kx, 0.095, 0.03, 0.035, 0, 0, TAU), lighten(gc, 0.06), { x: kx - 0.01, y: 0.085, r: 0.035, hi: 0.6, lw: 0.4 }); } // nudillos
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.01; ctx.beginPath();
    for (let k = 1; k < 4; k++) { const kx = -0.107 + k * 0.053; ctx.moveTo(kx, 0.03); ctx.lineTo(kx, 0.12); } ctx.stroke(); // separación de los dedos
    shade(ctx, () => ctx.ellipse(0.08, 0.02, 0.045, 0.075, -0.35, 0, TAU), darken(gc, 0.08), { x: 0.07, y: 0, r: 0.06, lw: 0.5 }); // el pulgar cruzado
    shade(ctx, () => ctx.roundRect(-0.07, -0.05, 0.11, 0.07, 0.02), limbCol(back, L.armor), { x: -0.05, y: -0.04, r: 0.08, hi: 0.5, lw: 0.4 }); // placa del dorso
    ctx.fillStyle = limbCol(back, '#e2e8f0'); ctx.beginPath(); ctx.arc(-0.015, -0.015, 0.012, 0, TAU); ctx.fill(); // remache
    if (!back) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(L.glow, 0.7); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.09, 0.06); ctx.lineTo(0.06, 0.06); ctx.stroke(); ctx.restore(); } // costura con luz
    ctx.restore();
  };
  const arm = (i: number) => {
    const back = i === 0, [ua, eb] = p.arms[i], sp = shoulderAt(i);
    const elbow = add(sp, dirv(ua), 0.3 * (p.reach ?? 1)), hand = add(elbow, dirv(ua + eb), 0.28 * (p.reach ?? 1));
    segment(ctx, sp, elbow, 0.2 * K, 0.16 * K, limbCol(back, L.armor), 0.6);
    const cannon = !back && L.extras.includes('cannon');
    if (cannon) { // el antebrazo es un cañón
      const d = dirv(ua + eb), tip = add(elbow, d, 0.42);
      segment(ctx, elbow, tip, 0.24, 0.2, limbCol(back, '#2a2f38'), 0.7);
      segment(ctx, add(elbow, d, 0.12), add(elbow, d, 0.2), 0.27, 0.27, limbCol(back, L.trim), 0.5);
      ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 0.075, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, tip[0], tip[1], f.action === 'special' ? 0.6 : 0.2, L.glow, f.action === 'special' ? 0.9 : 0.4); ctx.restore();
    } else {
      segment(ctx, elbow, hand, 0.17 * K, 0.15 * K, limbCol(back, L.dark), 0.5);
      const fd = dirv(ua + eb); // guantelete: placa con franja de color y una luz
      segment(ctx, add(elbow, fd, 0.1), add(elbow, fd, 0.21), 0.2 * K, 0.19 * K, limbCol(back, L.armor), 0.8);
      segment(ctx, add(elbow, fd, 0.19), add(elbow, fd, 0.22), 0.21 * K, 0.2 * K, limbCol(back, trimOf(L)), 0.5);
      if (!back) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gp = add(elbow, fd, 0.15); bloom(ctx, gp[0], gp[1], 0.07, L.glow, 0.7); ctx.restore(); }
      shade(ctx, () => ctx.arc(elbow[0], elbow[1], 0.085 * K, 0, TAU), limbCol(back, lighten(L.armor, 0.05)), { x: elbow[0] - 0.02, y: elbow[1] - 0.03, r: 0.09, lw: 0.6 }); // codera
      fist(hand, ua + eb, back);
      if (L.brute) for (let k = 0; k < 3; k++) { ctx.fillStyle = limbCol(back, '#d1d5db'); const a = (ua + eb) + (k - 1) * 0.6; ctx.beginPath(); ctx.moveTo(hand[0] + Math.sin(a - 0.15) * 0.15, hand[1] + Math.cos(a - 0.15) * 0.15); ctx.lineTo(hand[0] + Math.sin(a) * 0.27, hand[1] + Math.cos(a) * 0.27); ctx.lineTo(hand[0] + Math.sin(a + 0.15) * 0.15, hand[1] + Math.cos(a + 0.15) * 0.15); ctx.fill(); } // nudillos con púas
    }
    // espada láser
    if (!back && L.extras.includes('sword')) {
      const d = dirv(ua + eb + 0.9), b0 = add(hand, d, 0.06), b1 = add(hand, d, 1.05);
      segment(ctx, add(hand, d, -0.08), b0, 0.07, 0.07, '#2a2a33', 0.6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [c, w] of [[alpha(L.trim, 0.35), 0.16], [alpha(L.trim, 0.8), 0.07], ['#fff5fa', 0.03]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke(); }
      ctx.restore();
    }
  };
  // hombrera (con púas los grandotes): las dos se ven, una en cada esquina de arriba del pecho, como las piernas
  const pad = (i: number) => {
    const back = i === 0, ua = p.arms[i][0], sp = shoulderAt(i);
    shade(ctx, () => ctx.ellipse(sp[0], sp[1] + 0.01, 0.17 * K * (L.brute ? 1.25 : 1), 0.13 * K * (L.brute ? 1.25 : 1), ua * 0.3, 0, TAU), limbCol(back, L.armor), { x: sp[0] - 0.04, y: sp[1] - 0.05, r: 0.2, hi: 0.45, lw: 0.6 });
    ctx.strokeStyle = limbCol(back, trimOf(L)); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.ellipse(sp[0], sp[1] + 0.01, 0.15 * K * (L.brute ? 1.25 : 1), 0.11 * K * (L.brute ? 1.25 : 1), ua * 0.3, 0.3, Math.PI - 0.3); ctx.stroke(); // borde de la hombrera
    ctx.fillStyle = limbCol(back, '#e2e8f0'); ctx.beginPath(); ctx.arc(sp[0] - 0.05, sp[1] - 0.04, 0.018, 0, TAU); ctx.fill();
    if (L.brute) for (const k of [-1, 0, 1]) { const bx = sp[0] + k * 0.12, by = sp[1] - 0.12 - (k === 0 ? 0.04 : 0); ctx.beginPath(); ctx.moveTo(bx - 0.05, by + 0.06); ctx.lineTo(bx + k * 0.03, by - 0.2); ctx.lineTo(bx + 0.05, by + 0.06); ctx.closePath(); ctx.fillStyle = grad(ctx, bx - 0.05, 0, bx + 0.05, 0, [[0, limbCol(back, '#f1f5f9')], [1, limbCol(back, '#6b7280')]]); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 0.01; ctx.stroke(); }
    if (f.char === 'frost') { ctx.fillStyle = limbCol(back, '#bae6fd'); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sp[0] + k * 0.05 - 0.03, sp[1] - 0.07); ctx.lineTo(sp[0] + k * 0.05, sp[1] - 0.2); ctx.lineTo(sp[0] + k * 0.05 + 0.03, sp[1] - 0.07); ctx.fill(); } }
  };
  leg(0);
  // torso: pechera con el emblema del elemento
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(lean); ctx.scale(K, 1);
  const torso = () => { ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.38, -0.4); ctx.quadraticCurveTo(0, -0.6, 0.38, -0.4); ctx.lineTo(0.27, 0.06); ctx.closePath(); };
  shade(ctx, torso, L.armor, { x: 0.05, y: -0.45, r: 0.6, hi: 0.4, tex: 0.45 });
  // placas del abdomen, costuras y remaches
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-0.4, -0.6, 0.12, 0.7); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0.2, -0.6, 0.04, 0.7);
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 0.014; ctx.beginPath();
  for (const y of [-0.17, -0.1]) { ctx.moveTo(-0.2, y); ctx.lineTo(0.2, y); }
  ctx.moveTo(0.0, -0.2); ctx.lineTo(0.0, -0.08); ctx.moveTo(-0.33, -0.36); ctx.quadraticCurveTo(-0.22, -0.2, -0.24, 0.0); ctx.moveTo(0.33, -0.36); ctx.quadraticCurveTo(0.22, -0.2, 0.24, 0.0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); for (const y of [-0.165, -0.095]) { ctx.moveTo(-0.19, y + 0.012); ctx.lineTo(0.19, y + 0.012); } ctx.stroke();
  ctx.restore();
  for (const [rx, ry] of [[-0.3, -0.36], [0.3, -0.36], [-0.25, -0.02], [0.24, -0.02]] as const) { ctx.fillStyle = darken(L.armor, 0.5); ctx.beginPath(); ctx.arc(rx, ry, 0.022, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(rx - 0.006, ry - 0.007, 0.008, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(L.glow, 0.55 + fx.power * 0.4); ctx.lineWidth = 0.018; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.16, -0.42); ctx.lineTo(-0.1, -0.32); ctx.moveTo(0.18, -0.42); ctx.lineTo(0.13, -0.32); ctx.stroke(); ctx.restore(); // luces del pecho
  ctx.fillStyle = L.dark; ctx.beginPath(); ctx.roundRect(-0.27, -0.08, 0.53, 0.12, 0.03); ctx.fill(); // cinturón
  const trimC = L.trim === '#17140c' ? '#17140c' : L.trim;
  ctx.fillStyle = trimC; ctx.fillRect(-0.04, -0.07, 0.09, 0.09);
  ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(0.005, -0.025, 0.03, 0, TAU); ctx.fill(); // la gema de la hebilla
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0.005, -0.025, 0.09, L.glow, 0.55 + fx.power * 0.4); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.002, -0.032, 0.008, 0, TAU); ctx.fill(); ctx.restore();
  for (const px of [-0.21, 0.15]) { shade(ctx, () => ctx.roundRect(px, -0.075, 0.08, 0.1, 0.015), darken(L.dark, 0.1), { x: px + 0.02, y: -0.07, r: 0.08, lw: 0.6 }); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px + 0.01, -0.07, 0.06, 0.012); } // bolsitas del cinturón
  for (const [px, pw] of [[-0.25, 0.17], [0.07, 0.17]] as const) { ctx.beginPath(); ctx.moveTo(px, 0.04); ctx.lineTo(px + pw, 0.04); ctx.lineTo(px + pw * 0.85, 0.19); ctx.lineTo(px + pw * 0.15, 0.19); ctx.closePath(); ctx.fillStyle = grad(ctx, 0, 0.04, 0, 0.19, [[0, lighten(L.armor, 0.12)], [1, darken(L.armor, 0.35)]]); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.012; ctx.stroke(); ctx.fillStyle = trimC; ctx.fillRect(px + pw * 0.2, 0.15, pw * 0.6, 0.018); } // faldones
  ctx.fillStyle = darken(L.dark, 0.2); ctx.beginPath(); ctx.ellipse(0.02, -0.5, 0.17, 0.055, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = alpha(trimC, 0.9); ctx.lineWidth = 0.018; ctx.beginPath(); ctx.ellipse(0.02, -0.5, 0.17, 0.055, 0, 0.2, Math.PI - 0.2); ctx.stroke(); // cuello
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(-0.22, -0.3); ctx.lineTo(-0.15, -0.26); ctx.moveTo(0.2, -0.16); ctx.lineTo(0.26, -0.2); ctx.moveTo(-0.12, -0.12); ctx.lineTo(-0.08, -0.15); ctx.stroke(); // rayones de batalla
  ctx.strokeStyle = alpha(trimC, 0.8); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.2, -0.38); ctx.quadraticCurveTo(0, -0.25, 0.22, -0.38); ctx.stroke();
  if (L.brute) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.3, -0.22); ctx.lineTo(0.32, -0.22); ctx.moveTo(0.02, -0.5); ctx.lineTo(0.02, -0.1); ctx.stroke(); }
  ctx.save(); ctx.translate(0.03, -0.27); EMBLEM[CHARS[f.char].element](ctx, L.helmet === 'visor' ? '#17140c' : L.glow, t); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, 0.18, L.glow, 0.25 + fx.power * 0.5); ctx.restore();
  if (L.extras.includes('cracks')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(251,146,60,${0.75 + 0.25 * Math.sin(t * 4)})`; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.3, -0.35); ctx.lineTo(-0.1, -0.2); ctx.lineTo(-0.15, 0.0); ctx.moveTo(0.3, -0.38); ctx.lineTo(0.12, -0.15); ctx.lineTo(0.2, 0.02); ctx.moveTo(-0.1, -0.2); ctx.lineTo(0.12, -0.15); ctx.stroke(); bloom(ctx, 0, -0.2, 0.5, '#f97316', 0.3); ctx.restore(); }
  ctx.restore();
  // el brazo derecho (el de atrás) va adelante del pecho, así se ve como el izquierdo; si la mano sube a la altura
  // de la cara (festejo, bloqueo) se dibuja después de la cabeza, siempre adelante del cuerpo
  const handAt = (i: number) => { const [ua, eb] = p.arms[i]; return add(add(shoulderAt(i), dirv(ua), 0.3 * (p.reach ?? 1)), dirv(ua + eb), 0.28 * (p.reach ?? 1)); };
  const up0 = handAt(0)[1] < neck[1] + 0.05;
  if (!up0) arm(0);
  pad(0); leg(1);
  // manguera del Orbot / Toxic: de la máscara a la espalda
  // el hombro izquierdo (el de adelante) queda un poco tapado por la cabeza; el brazo va adelante de la cabeza
  // solo cuando la mano sube a la altura de la cara (bloqueo, festejo, salto...)
  const armUp = handAt(1)[1] < neck[1] + 0.05;
  if (!armUp) arm(1);
  pad(1);
  ctx.save(); ctx.translate(neck[0] + 0.03, neck[1] - 0.37); ctx.rotate(p.head * 0.5);
  drawHead(ctx, f.char, t, fx.power, f.action === 'celebrate' ? 'happy' : f.action === 'stun' || f.action === 'sad' || f.action === 'tired' ? 'hurt' : 'normal');
  ctx.restore();
  if (up0) arm(0);
  if (armUp) arm(1);
  if (L.extras.includes('cracks')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -0.9, 0.9, '#f97316', 0.15 + 0.08 * Math.sin(t * 3)); ctx.restore(); }
  if (ghost) {
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -1, 1.1, L.glow, f.abilityT > 0 ? 0.6 : 0.25);
    for (let k = 0; k < 4; k++) { const d = (t * 0.7 + k / 4) % 1; ctx.fillStyle = alpha(L.glow, 0.35 * (1 - d)); ctx.beginPath(); ctx.arc(-0.3 - d * 0.4, -0.4 - k * 0.35, 0.08 + d * 0.1, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // efectos encima
  if (fx.frozen) {
    ctx.save(); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-0.45 * K, 0.02); ctx.lineTo(-0.5 * K, -1.4); ctx.lineTo(-0.3 * K, -2.0); ctx.lineTo(0.35 * K, -2.05); ctx.lineTo(0.52 * K, -1.5); ctx.lineTo(0.45 * K, 0.02); ctx.closePath();
    ctx.fillStyle = grad(ctx, -0.5, -2, 0.5, 0, [[0, 'rgba(240,250,255,0.85)'], [0.5, 'rgba(147,197,253,0.55)'], [1, 'rgba(59,130,246,0.6)']]);
    ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.3, -1.9); ctx.lineTo(-0.38, -0.6); ctx.moveTo(0.3, -1.95); ctx.lineTo(0.15, -1.2); ctx.stroke();
    ctx.restore();
  }
  if (fx.poison) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const d = (t * 0.9 + k / 5) % 1; ctx.fillStyle = `rgba(134,239,172,${0.6 * (1 - d)})`; ctx.beginPath(); ctx.arc(Math.sin(k * 2.3 + t) * 0.3, -0.6 - d * 1.6, 0.04 + d * 0.05, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (fx.burn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const d = (t * 2.2 + k / 9) % 1, x = Math.sin(k * 3.1) * 0.3, y = -0.2 - (k % 5) * 0.35 - d * 0.5, s = 0.14 * (1 - d); ctx.fillStyle = d < 0.4 ? 'rgba(254,240,138,0.8)' : 'rgba(249,115,22,0.6)'; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x, y - s * 3, x + s, y); ctx.fill(); } ctx.restore(); }
  if (fx.zap && Math.sin(t * 50) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 0.025; for (let k = 0; k < 3; k++) { ctx.beginPath(); let x = (Math.random() - 0.5) * 0.6, y = -0.1; ctx.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 0.3; y -= 0.3; ctx.lineTo(x, y); } ctx.stroke(); } bloom(ctx, 0, -1, 1, '#fde047', 0.3); ctx.restore(); }
  if (fx.shield) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(56,189,248,${0.5 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(0, -1, 0.75 * K, 1.15, 0, 0, TAU); ctx.stroke(); const g = ctx.createRadialGradient(0, -1, 0.5, 0, -1, 1.15); g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(56,189,248,0.25)'); ctx.fillStyle = g; ctx.fill(); ctx.restore(); }
  if (f.action === 'block') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0.45, -1.05, 0, 0.45, -1.05, 0.75); g.addColorStop(0, alpha(L.glow, 0.05)); g.addColorStop(0.8, alpha(L.glow, 0.35)); g.addColorStop(1, alpha(L.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0.45 * K, -1.05, 0.3, 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = alpha(L.glow, 0.8); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.ellipse(0.45 * K, -1.05, 0.25, 0.75, 0, -1.2, 1.2); ctx.stroke();
    ctx.restore();
  }
  if (f.action === 'stun' && (f.stunKind === 'hit' || f.stunKind === 'burn')) for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3; drawStar(ctx, Math.cos(a) * 0.35 + 0.05, -2.05 + Math.sin(a) * 0.08, 0.06, '#fde047'); }
  if (f.action === 'tired') for (let k = 0; k < 2; k++) { const d = (t * 0.8 + k * 0.5) % 1; ctx.fillStyle = `rgba(186,230,253,${0.8 * (1 - d)})`; ctx.beginPath(); ctx.ellipse(0.35 + k * 0.1, -1.9 + d * 0.6, 0.03, 0.05, 0, 0, TAU); ctx.fill(); } // gotas de sudor
  if (fx.speed || (f.abilityT > 0 && (f.char === 'brutoRed' || f.char === 'aguila' || f.char === 'espectro'))) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = alpha(L.glow, 0.55); ctx.lineWidth = 0.035; for (let k = 0; k < 6; k++) { const y = -0.2 - k * 0.3; ctx.beginPath(); ctx.moveTo(-0.45, y); ctx.lineTo(-1.2 - (k % 2) * 0.4, y); ctx.stroke(); } if (f.char === 'brutoRed' && f.abilityT > 0) bloom(ctx, 0.2, -1, 1.1, '#f97316', 0.5); ctx.restore(); }
}
// El luchador con luz de escena: se dibuja aparte, se le pone luz cálida de arriba adelante, sombra abajo atrás,
// un borde de luz del color del escenario y un brillo de su elemento alrededor; después va a la pantalla.
let litA: HTMLCanvasElement | null = null, litB: HTMLCanvasElement | null = null;
// Celulares: los luchadores van directo a la pantalla, sin la luz de escena (es lo más lento en un teléfono).
let lowFx = false;
export function setLowFx(on: boolean) { lowFx = on; }
export const BODY_SCALE = PH / 1.85; // los luchadores miden PH (2,3 m); el dibujo está hecho para 1,85 m
export function drawFighterLit(ctx: CanvasRenderingContext2D, f: Fighter, t: number, fx: FighterFx, x: number, y: number, s: number, rim: string) {
  const L = LOOKS[f.char], S = s * BODY_SCALE * SIZE[f.char], K = L.brute ? 1.32 : 1, mir = f.facing < 0 ? -1 : 1; // cada uno de su tamaño
  // sombra en el piso y aura (sin luz)
  ctx.save(); ctx.translate(x, y); ctx.scale(S, S);
  const sg = ctx.createRadialGradient(0, 0.02, 0, 0, 0.02, 0.6 * K); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.62 * K, 0.1, 0, 0, TAU); ctx.fill();
  if (fx.aura) { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const g = ctx.createRadialGradient(0, -1, 0, 0, -1, 1.3 + k * 0.2 + Math.sin(t * 12 + k) * 0.05); g.addColorStop(0, alpha(fx.aura, 0.25)); g.addColorStop(1, alpha(fx.aura, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -1, 0.9 + k * 0.1, 1.4 + k * 0.1, 0, 0, TAU); ctx.fill(); } }
  ctx.restore();
  litBlit(ctx, x, y, S, mir, rim, alpha(L.glow, 0.45 + fx.power * 0.35), 0.18 + fx.power * 0.2, c => drawFighterBody(c, f, t, { ...fx, aura: null, lit: true }));
}
// Dibuja algo aparte (en metros, con los pies en 0,0) y le pone luz de escena: cálida de arriba adelante, sombra
// abajo atrás, oclusión cerca del piso y un borde de luz del color "rim"; después va a la pantalla con un brillo.
function litBlit(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, mir: number, rim: string, glow: string, glowK: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return;
  const halo = () => { if (glowK > 0) { ctx.save(); ctx.translate(x, y - S * 1.05); ctx.scale(1, 1.55); const hg = ctx.createRadialGradient(0, 0, S * 0.2, 0, 0, S * (0.75 + glowK)); hg.addColorStop(0, glow); hg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = hg; ctx.fillRect(-S * 2, -S * 2, S * 4, S * 4); ctx.restore(); } };
  // celulares: directo a la pantalla, sin el lienzo aparte ni la luz de escena (es lo que más tarda por cuadro)
  if (lowFx) { halo(); ctx.save(); ctx.translate(x, y); ctx.scale(S * mir, S); draw(ctx); ctx.restore(); return; }
  const tr = ctx.getTransform(), res = Math.min(3, Math.max(1, Math.hypot(tr.a, tr.b)), 150 / Math.max(1, S)); // nítido en retina, pero con un tope (en pantallas enormes no se pone lento)
  const ow = 4 * S, oh = 3.4 * S, bw = Math.ceil(ow * res), bh = Math.ceil(oh * res), ox = bw / 2, oy = Math.ceil(2.9 * S * res);
  litA ??= document.createElement('canvas'); litB ??= document.createElement('canvas');
  for (const c of [litA, litB]) { if (c.width < bw) c.width = bw; if (c.height < bh) c.height = bh; }
  const a = litA.getContext('2d')!, b = litB.getContext('2d')!;
  a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, bw, bh);
  a.save(); a.translate(ox, oy); a.scale(S * res * mir, S * res); draw(a); a.restore();
  // luz y sombra de volumen
  a.globalCompositeOperation = 'source-atop';
  const R = S * res, lx = mir > 0 ? ox + R * 0.6 : ox - R * 0.6;
  let g = a.createLinearGradient(lx, oy - 2.6 * R, mir > 0 ? ox - R * 0.8 : ox + R * 0.8, oy);
  g.addColorStop(0, 'rgba(255,244,220,0.22)'); g.addColorStop(0.45, 'rgba(255,244,220,0)'); g.addColorStop(0.7, 'rgba(0,0,10,0.12)'); g.addColorStop(1, 'rgba(0,0,12,0.42)');
  a.fillStyle = g; a.fillRect(0, 0, bw, bh);
  g = a.createLinearGradient(0, oy - 0.5 * R, 0, oy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); a.fillStyle = g; a.fillRect(0, 0, bw, bh); // oclusión cerca del piso
  // borde de luz: la silueta menos la silueta corrida
  const d = Math.max(1.5, Math.min(R * 0.05, 3 * res));
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, bw, bh);
  b.drawImage(litA, 0, 0, bw, bh, 0, 0, bw, bh); b.globalCompositeOperation = 'source-in'; b.fillStyle = rim; b.fillRect(0, 0, bw, bh);
  b.globalCompositeOperation = 'destination-out'; b.drawImage(litA, 0, 0, bw, bh, -mir * d, d, bw, bh);
  a.globalCompositeOperation = 'source-atop'; a.globalAlpha = 0.7; a.drawImage(litB, 0, 0, bw, bh, 0, 0, bw, bh); a.globalAlpha = 1;
  a.globalCompositeOperation = 'source-over';
  // brillo alrededor: un halo suave detrás (mucho más rápido que un shadowBlur en pantallas grandes)
  halo();
  ctx.drawImage(litA, 0, 0, bw, bh, x - ox / res, y - oy / res, ow, oh);
}
// El árbitro con la misma luz que los luchadores.
export function drawRefLit(ctx: CanvasRenderingContext2D, p: Person, t: number, x: number, y: number, s: number, rim: string) {
  const S = s * BODY_SCALE, mir = p.facing < 0 ? -1 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(S, S);
  const sg = ctx.createRadialGradient(0, 0.02, 0, 0, 0.02, 0.55); sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0.02, p.action === 'down' ? 0.9 : 0.5, 0.09, 0, 0, TAU); ctx.fill();
  ctx.restore();
  litBlit(ctx, x, y, S, mir, rim, 'rgba(0,0,0,0.45)', 0.1, c => drawRef(c, p, t, true));
}
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// Un luchador quieto para las pantallas (la ficha y la selección).
export function idleFighter(char: CharId): Fighter {
  return { side: 0, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0, kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: 100, power: 0, cd: 0, abilityT: 0, abilityHit: false, burst: 0, burstT: 0, powers: {}, prev: { left: false, right: false, up: false, down: false, kick: false, ability: false }, taps: [], goals: 0, restT: 0, charge: 0, kickPow: 1, jumps: 0, headT: 0 };
}
// La cara para los cuadraditos de la selección y la barra de arriba: la cabeza sobre un fondo de su color.
export function drawPortrait(ctx: CanvasRenderingContext2D, char: CharId, size: number, t = 0, mirror = false, square = false) {
  const L = LOOKS[char], c = CHARS[char];
  ctx.save(); ctx.clearRect(0, 0, size, size);
  ctx.beginPath(); if (square) ctx.rect(0, 0, size, size); else ctx.arc(size / 2, size / 2, size / 2 - 1, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(size * 0.5, size * 0.45, 0, size / 2, size / 2, size * 0.75); g.addColorStop(0, lighten(c.color, 0.05)); g.addColorStop(0.55, darken(c.color, 0.55)); g.addColorStop(1, '#05060a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size * 0.58); ctx.scale(size * (L.brute ? 1.0 : 1.08), size * (L.brute ? 1.0 : 1.08)); if (mirror) ctx.scale(-1, 1); ctx.translate(-0.08, 0);
  drawHead(ctx, char, t, 0.6);
  ctx.restore();
  if (!square) { ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, TAU); ctx.strokeStyle = c.color; ctx.lineWidth = 2.5; ctx.stroke(); }
}
// El luchador entero (la ficha de la selección, como en los juegos de pelea).
export function drawFighterCard(ctx: CanvasRenderingContext2D, char: CharId, w: number, h: number, t: number, mirror = false) {
  ctx.clearRect(0, 0, w, h);
  const L = LOOKS[char], g = ctx.createRadialGradient(w / 2, h * 0.75, 0, w / 2, h * 0.75, w * 0.6);
  g.addColorStop(0, alpha(L.glow, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const s = h / (L.extras.includes('wings') ? 2.6 : 2.4) * (0.62 + 0.38 * SIZE[char] / 1.4) / SIZE[char]; // en la ficha también se nota el tamaño
  const f = idleFighter(char); f.facing = mirror ? -1 : 1;
  drawFighterLit(ctx, f, t, { power: 0.5, frozen: false, poison: false, burn: false, zap: false, shield: false, speed: false, aura: null }, w / 2, h * 0.94, s / BODY_SCALE, L.glow);
}

// ---------------------------------------------------------------- Árbitro
// Camiseta a rayas blancas y negras con cuello y puños negros, escudo en el pecho y la tarjeta amarilla asomando
// del bolsillo; short negro con franja blanca, medias negras con banda blanca, botines con tres tiras, reloj,
// auricular con micrófono y el silbato colgado del cordón (a la boca cuando pita). Cabeza grande como los luchadores.
const REF = { skin: '#d9a074', hair: '#2a1d14', shirt: '#f4f4f5', shorts: '#111114', socks: '#111114', boots: '#0b0b0d' };
interface HPose { lean: number; crouch: number; legs: [number, number][]; arms: [number, number][]; head: number; rot: number; lift: number }
function refPose(p: Person, t: number): HPose {
  const s = Math.sin, a = p.action, base = { lean: 0, crouch: 0, head: 0, rot: 0, lift: 0 };
  if (a === 'run') { const w = t * 12; return { ...base, lean: 0.15, legs: [[-0.7 * s(w), 0.25 + 1.1 * Math.max(0, -Math.cos(w))], [0.7 * s(w), 0.25 + 1.1 * Math.max(0, Math.cos(w))]], arms: [[0.8 * s(w), 1.4], [-0.8 * s(w), 1.4]] }; }
  if (a === 'jump') return { ...base, lean: -0.05, legs: [[-0.2, 0.9], [0.5, 1.3]], arms: [[-0.8, 0.5], [2.3, 0.4]], head: -0.2 };
  if (a === 'down') { const k = Math.min(1, p.actionT * 4); return { ...base, rot: -k * 1.5, lift: 0.12 * k, legs: [[-0.2, 0.3], [0.3, 0.5]], arms: [[2.4, 0.4], [2.0, 0.8]], head: -0.2 }; }
  if (a === 'stun') return { ...base, lean: 0.05, legs: [[-0.2, 0.2], [0.2, 0.2]], arms: [[0.6, 1.2], [0.8, 1.2]] };
  if (a === 'whistle') return { ...base, lean: -0.05, legs: [[-0.15, 0.1], [0.15, 0.1]], arms: [[3.05 + s(t * 6) * 0.05, 0.05], [1.2, 2.3]], head: -0.1 };
  const br = s(t * 2.4);
  return { ...base, lean: 0.03, crouch: 0.02 + br * 0.01, legs: [[-0.12, 0.08], [0.14, 0.08]], arms: [[0.18 + br * 0.03, 0.35], [-0.12, 0.45]], head: br * 0.03 };
}
export function drawRef(ctx: CanvasRenderingContext2D, p: Person, t: number, noShadow = false) {
  const L = REF, q = refPose(p, t);
  if (!noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.33)'; ctx.beginPath(); ctx.ellipse(0, 0.02, q.rot ? 0.8 : 0.4, 0.06, 0, 0, TAU); ctx.fill(); }
  ctx.save();
  if (q.rot) { const k = Math.abs(Math.sin(q.rot)); ctx.translate(0, -0.9 + (0.75 - q.lift) * k); ctx.rotate(q.rot); ctx.translate(0, 0.9); } // tirado: gira alrededor de la cadera
  const hipY = -0.84 + q.crouch * 0.6, hip: Pt = [0, hipY];
  const neck: Pt = [Math.sin(q.lean) * 0.52, hipY - Math.cos(q.lean) * 0.52];
  const back = (c: string, b: boolean) => b ? darken(c, 0.3) : c;
  const leg = (i: number) => {
    const isBack = i === 0, [ta, kb] = q.legs[i], hp: Pt = [hip[0] + (isBack ? -0.08 : 0.08), hip[1]];
    const knee = add(hp, dirv(ta), 0.4), ankle = add(knee, dirv(ta - kb), 0.38);
    segment(ctx, hp, knee, 0.25, 0.17, back(L.skin, isBack), 0.35);
    segment(ctx, hp, add(hp, dirv(ta), 0.24), 0.3, 0.27, back(L.shorts, isBack), 0.4);
    const td = dirv(ta); ctx.strokeStyle = back('#e5e7eb', isBack); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(hp[0] + td[1] * 0.12, hp[1] - td[0] * 0.12); ctx.lineTo(hp[0] + td[0] * 0.23 + td[1] * 0.12, hp[1] + td[1] * 0.23 - td[0] * 0.12); ctx.stroke(); // franja del short
    const sd = dirv(ta - kb);
    segment(ctx, knee, add(knee, sd, 0.08), 0.17, 0.16, back(L.skin, isBack), 0.25);
    segment(ctx, add(knee, sd, 0.06), ankle, 0.18, 0.12, back(L.socks, isBack), 0.35);
    segment(ctx, add(knee, sd, 0.07), add(knee, sd, 0.12), 0.185, 0.18, back('#f4f4f5', isBack), 0.3); // banda blanca de la media
    ctx.save(); ctx.translate(ankle[0], ankle[1]); ctx.rotate(-(ta - kb) * 0.6);
    shade(ctx, () => { ctx.moveTo(-0.09, -0.09); ctx.lineTo(0.09, -0.08); ctx.quadraticCurveTo(0.26, -0.05, 0.25, 0.03); ctx.lineTo(-0.1, 0.03); ctx.closePath(); }, back(L.boots, isBack), { x: 0.02, y: -0.05, r: 0.2, lw: 0.6, hi: 0.5 });
    ctx.fillStyle = back('#e5e7eb', isBack); ctx.fillRect(-0.11, 0.025, 0.37, 0.025); for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(-0.01 + k * 0.045, -0.04); ctx.rotate(0.5); ctx.fillRect(-0.008, -0.04, 0.016, 0.08); ctx.restore(); } // suela y tres tiras
    ctx.restore();
  };
  const arm = (i: number) => {
    const isBack = i === 0, [ua, eb] = q.arms[i], sh: Pt = [neck[0] + (isBack ? -0.16 : 0.13), neck[1] + 0.1];
    const elbow = add(sh, dirv(ua), 0.29), hand = add(elbow, dirv(ua + eb), 0.27);
    segment(ctx, sh, elbow, 0.17, 0.13, back(L.skin, isBack), 0.35);
    segment(ctx, sh, add(sh, dirv(ua), 0.15), 0.22, 0.19, back(L.shirt, isBack), 0.3); // manga
    segment(ctx, add(sh, dirv(ua), 0.14), add(sh, dirv(ua), 0.16), 0.2, 0.2, back('#111114', isBack), 0); // puño negro
    segment(ctx, elbow, hand, 0.13, 0.1, back(L.skin, isBack), 0.35);
    if (!isBack) { const w0 = add(elbow, dirv(ua + eb), 0.2); segment(ctx, w0, add(w0, dirv(ua + eb), 0.04), 0.12, 0.12, '#1f2937', 0.6); ctx.fillStyle = '#86efac'; ctx.beginPath(); ctx.arc(w0[0] + 0.01, w0[1], 0.02, 0, TAU); ctx.fill(); } // reloj
    shade(ctx, () => ctx.arc(hand[0], hand[1], 0.065, 0, TAU), back(L.skin, isBack), { x: hand[0] - 0.02, y: hand[1] - 0.02, r: 0.07, lw: 0.5 });
  };
  arm(0); leg(0);
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(q.lean);
  const torso = () => { ctx.moveTo(-0.24, 0.05); ctx.lineTo(-0.3, -0.42); ctx.quadraticCurveTo(-0.02, -0.6, 0.28, -0.44); ctx.lineTo(0.24, 0.05); ctx.closePath(); };
  shade(ctx, torso, L.shirt, { x: 0.05, y: -0.42, r: 0.6, hi: 0.25, tex: 0.3 });
  ctx.save(); ctx.beginPath(); torso(); ctx.clip();
  ctx.fillStyle = '#121214'; for (let x = -0.28; x < 0.3; x += 0.11) { ctx.beginPath(); ctx.moveTo(x, -0.62); ctx.quadraticCurveTo(x + 0.015, -0.3, x - 0.01, 0.06); ctx.lineTo(x + 0.045, 0.06); ctx.quadraticCurveTo(x + 0.065, -0.3, x + 0.05, -0.62); ctx.fill(); } // rayas que siguen el cuerpo
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0.1, -0.62, 0.2, 0.7);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.2, -0.05); ctx.quadraticCurveTo(-0.05, -0.12, 0.05, -0.04); ctx.moveTo(-0.15, -0.2); ctx.quadraticCurveTo(0, -0.26, 0.12, -0.18); ctx.stroke(); // arrugas
  ctx.restore();
  ctx.fillStyle = '#111114'; ctx.beginPath(); ctx.moveTo(-0.1, -0.54); ctx.lineTo(0.04, -0.4); ctx.lineTo(0.16, -0.54); ctx.lineTo(0.12, -0.57); ctx.lineTo(0.04, -0.46); ctx.lineTo(-0.06, -0.57); ctx.closePath(); ctx.fill(); // cuello de la camiseta
  shade(ctx, () => ctx.arc(0.13, -0.33, 0.055, 0, TAU), '#facc15', { x: 0.12, y: -0.35, r: 0.06, lw: 0.5 }); ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.arc(0.13, -0.33, 0.028, 0, TAU); ctx.fill(); // escudo
  ctx.fillStyle = '#facc15'; ctx.fillRect(-0.17, -0.37, 0.07, 0.06); ctx.fillStyle = '#111114'; ctx.fillRect(-0.2, -0.33, 0.12, 0.08); ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 0.008; ctx.strokeRect(-0.2, -0.33, 0.12, 0.08); // bolsillo con la tarjeta amarilla
  shade(ctx, () => ctx.roundRect(-0.25, -0.02, 0.5, 0.18, 0.03), L.shorts, { x: 0, y: 0, r: 0.3, hi: 0.2, tex: 0.3 });
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0.2, -0.02, 0.03, 0.18);
  if (p.action !== 'whistle') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.04, -0.55); ctx.quadraticCurveTo(0.02, -0.38, 0.06, -0.3); ctx.moveTo(0.12, -0.55); ctx.quadraticCurveTo(0.09, -0.4, 0.06, -0.3); ctx.stroke(); shade(ctx, () => ctx.roundRect(0.03, -0.31, 0.08, 0.045, 0.015), '#d4d4d8', { x: 0.05, y: -0.3, r: 0.05, lw: 0.4 }); } // silbato colgado
  ctx.restore();
  leg(1);
  // cabeza
  ctx.save(); ctx.translate(neck[0] + 0.02, neck[1] - 0.27); ctx.rotate(q.head * 0.5); ctx.scale(1.55, 1.55);
  segment(ctx, [0, 0.14], [0, 0.04], 0.1, 0.1, L.skin, 0.2);
  shade(ctx, () => ctx.ellipse(0.01, -0.03, 0.125, 0.15, 0, 0, TAU), L.skin, { x: 0.05, y: -0.08, r: 0.19, hi: 0.3, tex: 0.25, lw: 0.6 });
  ctx.fillStyle = 'rgba(60,40,30,0.18)'; ctx.beginPath(); ctx.ellipse(0.04, 0.06, 0.08, 0.05, 0, 0, Math.PI); ctx.fill(); // barba de un día
  shade(ctx, () => { ctx.moveTo(0.105, -0.06); ctx.quadraticCurveTo(0.16, -0.01, 0.12, 0.02); ctx.lineTo(0.1, 0.02); ctx.closePath(); }, L.skin, { x: 0.12, y: -0.03, r: 0.05, lw: 0.4, tex: 0 }); // nariz
  ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-0.13, 0.03); ctx.quadraticCurveTo(-0.16, -0.17, -0.02, -0.19); ctx.quadraticCurveTo(0.13, -0.2, 0.14, -0.08); ctx.quadraticCurveTo(0.05, -0.13, -0.02, -0.09); ctx.quadraticCurveTo(-0.06, -0.02, -0.13, 0.03); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.22)'; ctx.lineWidth = 0.01; ctx.beginPath(); ctx.moveTo(-0.08, -0.15); ctx.quadraticCurveTo(0, -0.18, 0.08, -0.15); ctx.stroke(); // brillo del pelo
  shade(ctx, () => ctx.ellipse(-0.04, -0.02, 0.028, 0.042, 0, 0, TAU), darken(L.skin, 0.1), { x: -0.04, y: -0.03, r: 0.04, lw: 0.4, tex: 0 }); // oreja
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(-0.04, -0.02, 0.022, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 0.01; ctx.beginPath(); ctx.moveTo(-0.03, 0.0); ctx.quadraticCurveTo(0.02, 0.06, 0.07, 0.05); ctx.stroke(); // auricular con micrófono
  const hurt = p.action === 'down' || p.action === 'stun';
  ctx.fillStyle = '#16100c';
  if (hurt) { ctx.lineWidth = 0.012; ctx.strokeStyle = '#16100c'; ctx.beginPath(); ctx.moveTo(0.05, -0.06); ctx.lineTo(0.09, -0.03); ctx.moveTo(0.09, -0.06); ctx.lineTo(0.05, -0.03); ctx.stroke(); }
  else { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0.074, -0.045, 0.02, 0.022, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.ellipse(0.082, -0.045, 0.011, 0.016, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = L.hair; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.045, -0.08); ctx.quadraticCurveTo(0.075, -0.09 - (p.action === 'whistle' ? 0.01 : 0), 0.1, -0.075); ctx.stroke(); // ceja
  ctx.strokeStyle = darken(L.skin, 0.5); ctx.lineWidth = 0.01; ctx.beginPath();
  if (p.action === 'whistle') ctx.ellipse(0.09, 0.055, 0.025, 0.02, 0, 0, TAU); else ctx.arc(0.08, 0.07, 0.03, -0.9 - (hurt ? -2 : 0), -0.2 - (hurt ? -2 : 0)); ctx.stroke();
  if (p.action === 'whistle') shade(ctx, () => ctx.roundRect(0.1, 0.03, 0.07, 0.04, 0.015), '#d4d4d8', { x: 0.12, y: 0.04, r: 0.05, lw: 0.4 });
  ctx.restore();
  arm(1);
  ctx.restore();
  if (p.stun > 0 && p.stunKind === 'freeze') { ctx.save(); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(-0.38, 0.02); ctx.lineTo(-0.42, -1.4); ctx.lineTo(-0.2, -2.0); ctx.lineTo(0.3, -2.0); ctx.lineTo(0.42, -1.4); ctx.lineTo(0.38, 0.02); ctx.closePath(); ctx.fillStyle = 'rgba(165,216,255,0.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.02; ctx.stroke(); ctx.restore(); }
  if (p.stun > 0 && p.stunKind === 'burn') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 7; k++) { const d = (t * 2.2 + k / 7) % 1, x = Math.sin(k * 3.1) * 0.35, y = -0.15 - d * 0.6 - (q.rot ? 0 : (k % 4) * 0.35), r = 0.13 * (1 - d); ctx.fillStyle = d < 0.4 ? 'rgba(254,240,138,0.8)' : 'rgba(249,115,22,0.6)'; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 3, x + r, y); ctx.fill(); } ctx.restore(); }
  if (p.stun > 0 && p.stunKind === 'zap' && Math.sin(t * 50) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, -0.5, 0.8, '#fde047', 0.4); ctx.restore(); }
  if (p.action === 'down' && p.stunKind !== 'freeze') for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3; drawStar(ctx, Math.cos(a) * 0.25 - 0.6 * Math.min(1, p.actionT * 4), -0.45 + Math.sin(a) * 0.06, 0.05, '#fde047'); }
}
