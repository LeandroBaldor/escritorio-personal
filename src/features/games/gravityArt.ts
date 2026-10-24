// Dibujos de Gravity Swap, todos hechos con código. Se dibuja en un lienzo chico (32 píxeles por casillero)
// que después se agranda sin suavizar, así todo queda en pixel art con borde oscuro, como en las referencias:
// el astronauta blanco y azul, los 10 escenarios con su fondo (cielo arriba del techo y capas de la tierra con
// fósiles debajo del piso, así la pantalla queda siempre llena), las trampas y los villanos, con degradés,
// texturas y brillos para que se vean más reales.
import {
  CEIL, FLOOR, HINT_TIME, PLAYER_H, PLAYER_W, ROWS, STRIDE, bombCount, cometPath, doorOpen, flyerCenter, geyserHeight, geyserWarn, laserOn, laserWarn, lightningState,
  mineCenter, pendulumBall, plantBite, pressRect, pressState, sawCenter, scannerY, sporeCenter, sweeperAngle, wormHeight, wormWarn,
  type Game, type Gib, type Hazard, type Solid, type ThemeId,
} from './gravitySwap';
import { drawAngler, drawBackdrop, drawBlackhole, drawUpperSky } from './gravityBackdrops';

export const PX = 32;
const P = 1 / PX; // un píxel, en casilleros
const INK = '#0a0a16'; // el borde oscuro de todo

type Under = 'earth' | 'rock' | 'machine'; // qué hay debajo del piso: tierra con fósiles, roca espacial o máquinas
interface Theme {
  sky: [string, string, string]; ground: string; brick: string; top: string;
  spike: string; shade: string; laser: string; laser2: string; portal: string;
  under: Under; strata: string[]; // capas de abajo del piso, de arriba hacia abajo
  haze: string; // niebla del horizonte
  metal?: boolean; // bloques de metal con remaches (si no, de piedra)
  stars?: boolean; // arriba del techo se ven estrellas
}
export const THEMES: Record<ThemeId, Theme> = {
  city: { sky: ['#0a1236', '#1f3a8f', '#8b5cb8'], ground: '#25324f', brick: '#1a2440', top: '#38bdf8', spike: '#d6f4ff', shade: '#5fa8c9', laser: '#ff2d55', laser2: '#22d3ee', portal: '#38bdf8',
    under: 'earth', strata: ['#4a3628', '#5c4330', '#3d2c22', '#6b4f38', '#2f231b'], haze: '#e879f9', stars: true },
  mines: { sky: ['#02030a', '#0b1020', '#1d1533'], ground: '#5f6370', brick: '#474b55', top: '#b4b9c4', spike: '#eef0f3', shade: '#8b929e', laser: '#ff3b3b', laser2: '#f472b6', portal: '#34d399',
    under: 'rock', strata: ['#4a4450', '#3a3540', '#57505e', '#2e2a34', '#433c4b'], haze: '#7c3aed', metal: true, stars: true },
  base: { sky: ['#040812', '#0f172a', '#16294a'], ground: '#244552', brick: '#1a3540', top: '#2dd4bf', spike: '#e8eef5', shade: '#8a9bb0', laser: '#ef4444', laser2: '#22c55e', portal: '#fb923c',
    under: 'machine', strata: ['#1e293b', '#273449', '#1a2333', '#2c3a52', '#141c2a'], haze: '#0ea5e9', metal: true, stars: true },
  ice: { sky: ['#071c4d', '#1d4ed8', '#9cc8f7'], ground: '#5cb8e6', brick: '#3b9bd0', top: '#f0f9ff', spike: '#f4fbff', shade: '#8fc3ea', laser: '#22d3ee', laser2: '#a78bfa', portal: '#e0f2fe',
    under: 'earth', strata: ['#6f8fa8', '#d6ecfb', '#57758c', '#a9cbe3', '#465e72'], haze: '#e0f2fe' },
  volcano: { sky: ['#120303', '#4a0d0d', '#9a2a0e'], ground: '#3d2735', brick: '#2a1824', top: '#f97316', spike: '#f5f0eb', shade: '#a8a29e', laser: '#f97316', laser2: '#fde047', portal: '#e879f9',
    under: 'earth', strata: ['#3b2420', '#5a2a1c', '#2a1714', '#6b2f1a', '#1f100d'], haze: '#f97316' },
  inverse: { sky: ['#1f0638', '#6b21a8', '#d946ef'], ground: '#221d55', brick: '#18143f', top: '#67e8f9', spike: '#b5f6fd', shade: '#22a6c4', laser: '#f472b6', laser2: '#67e8f9', portal: '#e879f9',
    under: 'earth', strata: ['#3b1e5a', '#4c2370', '#2e1748', '#5b2a82', '#22113a'], haze: '#f0abfc', stars: true },
  factory: { sky: ['#07090f', '#141b26', '#232f40'], ground: '#4f5967', brick: '#3a4350', top: '#facc15', spike: '#eceff3', shade: '#8f98a6', laser: '#ef4444', laser2: '#f97316', portal: '#f59e0b',
    under: 'machine', strata: ['#2b3340', '#374151', '#222a35', '#3f4a5a', '#1a2029'], haze: '#f59e0b', metal: true },
  forest: { sky: ['#011510', '#033d33', '#0a6b5d'], ground: '#46554b', brick: '#313e36', top: '#4ade80', spike: '#7aeef8', shade: '#e86bb0', laser: '#a3e635', laser2: '#e879f9', portal: '#facc15',
    under: 'earth', strata: ['#3b2d1f', '#4d3a26', '#2e2318', '#5a4530', '#211910'], haze: '#5eead4' },
  storm: { sky: ['#0d0b16', '#2b2944', '#575485'], ground: '#2e2c3d', brick: '#211f2e', top: '#a5b4fc', spike: '#e8ecf3', shade: '#8a93a5', laser: '#ef4444', laser2: '#f0abfc', portal: '#f0abfc',
    under: 'earth', strata: ['#2e2b3a', '#3a3649', '#25222f', '#433f55', '#1c1a24'], haze: '#a5b4fc' },
  moon: { sky: ['#000003', '#04050d', '#10142a'], ground: '#a1a8b3', brick: '#7a818c', top: '#eef0f3', spike: '#eef0f3', shade: '#9aa1ad', laser: '#ef4444', laser2: '#f43f5e', portal: '#facc15',
    under: 'rock', strata: ['#6b7280', '#7d8592', '#5b616c', '#8b93a0', '#4b5058'], haze: '#93c5fd', stars: true },
};

// Un número "al azar" fijo para cada índice (para que el fondo no cambie de un cuadro al otro).
const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Mezcla dos colores ("#rrggbb" o "rgb(r,g,b)"; k = 0 el primero, 1 el segundo).
const channels = (c: string) => {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
};
function mix(a: string, b: string, k: number) {
  const ca = channels(a), cb = channels(b);
  const ch = (i: number) => Math.round(ca[i] * (1 - k) + cb[i] * k);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}
const lighten = (c: string, k: number) => mix(c, '#ffffff', k);
const darken = (c: string, k: number) => mix(c, '#000000', k);
function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}
// Degradé redondo con la luz arriba a la izquierda (para que las cosas se vean con volumen).
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(color, 0.55)); g.addColorStop(0.45, color); g.addColorStop(1, darken(color, 0.55));
  return g;
}

// Pinta una figura con borde oscuro: primero el borde (más grueso) y encima el relleno.
function ink(ctx: CanvasRenderingContext2D, path: () => void, fill: string | CanvasGradient, width = 2) {
  ctx.beginPath(); path();
  ctx.lineWidth = width * P; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}
// Una línea gruesa con borde (brazos, piernas, cadenas).
function limb(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[INK, width + 2.2 * P], [color, width]] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
}
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
// Puntitos de textura (granito, óxido, tierra) adentro de un rectángulo, siempre en el mismo lugar.
function grain(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, color: string, amount: number, step = 0.25) {
  ctx.fillStyle = color;
  for (let x = Math.floor(x0 / step) * step; x < x1; x += step) for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
    const h = hash(x * 12.9898 + y * 78.233 + seed);
    if (h < amount) ctx.fillRect(x + hash(h * 91) * step, y + hash(h * 57) * step, P * (1 + Math.floor(h * 3 / amount) % 2), P);
  }
}

// ---------- Fondos ----------

// Repite un dibujo cada "gap" casilleros entre l0 y l1, con desplazamiento lento (parallax).
function layer(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, factor: number, gap: number, draw: (x: number, i: number) => void) {
  const off = cam * factor;
  for (let i = Math.floor((l0 + off) / gap) - 1; i * gap - off < l1 + gap; i++) draw(i * gap - off, i);
}

function stars(ctx: CanvasRenderingContext2D, cam: number, l0: number, l1: number, y0: number, y1: number, time: number, color = '#ffffff') {
  ctx.fillStyle = color;
  layer(ctx, cam, l0, l1, 0.04, 0.9, (x, i) => {
    for (let k = 0; k < Math.ceil((y1 - y0) / 6); k++) {
      const j = i * 7 + k * 131, twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + hash(j)) + j));
      ctx.globalAlpha = twinkle * (0.35 + hash(j + 3) * 0.65);
      const s = hash(j + 7) > 0.9 ? 2 * P : P;
      ctx.fillRect(x + hash(j + 1), y0 + k * 6 + hash(j + 2) * 6, s, s);
    }
  });
  ctx.globalAlpha = 1;
}

function planet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sea: string, land: string, rings = false) {
  glow(ctx, x, y, r * 1.6, sea, 0.35);
  if (rings) { ctx.strokeStyle = 'rgba(253,230,138,0.45)'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.45, -0.3, Math.PI, Math.PI * 2); ctx.stroke(); }
  ctx.save();
  ink(ctx, circle(ctx, x, y, r), ball(ctx, x, y, r, sea));
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = land;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(x - r + hash(i) * r * 2, y - r + hash(i + 9) * r * 2, r * (0.2 + hash(i + 4) * 0.3), r * 0.15, hash(i) * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; // nubes
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x - r + hash(i + 20) * r * 2, y - r + hash(i + 30) * r * 2, r * 0.35, r * 0.07, 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.35, r, 0, Math.PI * 2); ctx.fill(); // sombra
  ctx.restore();
  if (rings) { ctx.strokeStyle = 'rgba(253,230,138,0.6)'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.45, -0.3, 0, Math.PI); ctx.stroke(); }
}

// Una nube redondeada con sombra abajo.
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, shadow: string) {
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.ellipse(x, y + w * 0.08, w * 0.55, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.55, w * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.18, y - w * 0.1, w * 0.22, w * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.12, y - w * 0.14, w * 0.26, w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// El fondo del pasillo, dibujado entre l0 y l1 (relativo a la cámara) y de 0 a ROWS de alto.
function background(ctx: CanvasRenderingContext2D, game: Game, t: Theme, l0: number, l1: number) {
  const { cam, time } = game, cols = game.cols, W = l1 - l0;
  // Niebla del horizonte (abajo) para dar profundidad.
  const haze = () => { ctx.fillStyle = lin(ctx, 0, ROWS * 0.45, 0, ROWS, [[0, 'rgba(0,0,0,0)'], [1, t.haze]]); ctx.globalAlpha = 0.28; ctx.fillRect(l0, ROWS * 0.45, W, ROWS * 0.55); ctx.globalAlpha = 1; };

  switch (game.def.theme) {
    case 'city': // edificios distintos y con mucho detalle (en gravityBackdrops)
      drawBackdrop('city', ctx, cam, l0, l1, cols, time);
      break;
    case 'mines': {
      drawBackdrop('mines', ctx, cam, l0, l1, cols, time); // estrellas, la Vía Láctea y planetas de verdad
      ctx.fillStyle = '#6b5a52'; // cinturón de asteroides lejano
      layer(ctx, cam, l0, l1, 0.06, 0.35, (x, i) => { ctx.globalAlpha = 0.5; ctx.fillRect(x, 7.2 + Math.sin(i * 0.7) * 0.4 + hash(i) * 0.5, P * (1 + Math.floor(hash(i + 1) * 2)), P); });
      ctx.globalAlpha = 0.28; // asteroides lejanos (oscuros, para no confundirlos con los que lastiman)
      layer(ctx, cam, l0, l1, 0.15, 3.1, (x, i) => {
        const r = 0.3 + hash(i) * 0.5, y = 2 + hash(i + 4) * 6;
        ctx.fillStyle = ball(ctx, x, y, r, '#3b2a2a'); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1515'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.16, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      layer(ctx, cam, l0, l1, 0.3, 7, (x, i) => { // torres mineras con luces
        const h = 3 + hash(i) * 2;
        ctx.fillStyle = '#151325'; ctx.fillRect(x, ROWS - h, 0.3, h); ctx.fillRect(x + 1.2, ROWS - h, 0.3, h);
        ctx.strokeStyle = '#151325'; ctx.lineWidth = 3 * P;
        for (let y = ROWS - h; y < ROWS; y += 0.7) { ctx.beginPath(); ctx.moveTo(x + 0.15, y); ctx.lineTo(x + 1.35, y + 0.7); ctx.moveTo(x + 1.35, y); ctx.lineTo(x + 0.15, y + 0.7); ctx.stroke(); }
        ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#fbbf24' : '#78350f'; ctx.fillRect(x + 0.65, ROWS - h - 0.2, 4 * P, 4 * P);
      });
      break;
    }
    case 'base': {
      layer(ctx, cam, l0, l1, 0.3, 1.25, (x, i) => { // paneles de la pared con remaches y rejillas
        ctx.fillStyle = lin(ctx, x, 0, x + 1.25, 0, [[0, '#15223d'], [0.5, '#111c33'], [1, '#0c1528']]); ctx.fillRect(x, 0, 1.25 - P, ROWS);
        ctx.fillStyle = '#22314f'; ctx.fillRect(x, 3.2, 1.25, 2 * P); ctx.fillRect(x, 6.8, 1.25, 2 * P);
        ctx.fillStyle = '#334766';
        for (const ry of [0.4, 3.0, 3.5, 6.6, 7.1, 9.6]) { ctx.fillRect(x + 0.12, ry, 2 * P, 2 * P); ctx.fillRect(x + 1.05, ry, 2 * P, 2 * P); }
        if (hash(i) > 0.7) { ctx.fillStyle = '#0a1120'; for (let v = 0; v < 4; v++) ctx.fillRect(x + 0.3, 4.3 + v * 0.18, 0.65, 2 * P); }
        if (hash(i + 3) > 0.75) { ctx.fillStyle = Math.sin(time * 4 + i) > 0 ? '#22c55e' : '#14532d'; ctx.fillRect(x + 0.55, 5.6, 3 * P, 3 * P); ctx.fillStyle = Math.sin(time * 3 + i * 2) > 0.3 ? '#f97316' : '#431407'; ctx.fillRect(x + 0.7, 5.6, 3 * P, 3 * P); }
      });
      ctx.fillStyle = '#1e293b'; // caños y cables
      layer(ctx, cam, l0, l1, 0.3, 10, x => { ctx.fillRect(x, 1.5, 10, 0.18); ctx.fillStyle = '#0f172a'; ctx.fillRect(x, 1.62, 10, 3 * P); ctx.fillStyle = '#1e293b'; ctx.fillRect(x, 8.3, 10, 0.12); });
      drawBackdrop('base', ctx, cam, l0, l1, cols, time); // ventanales con naves distintas en cada uno
      break;
    }
    case 'ice': {
      for (let k = 0; k < 3; k++) { // aurora
        ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 0.7 + k);
        ctx.fillStyle = lin(ctx, 0, 0.5, 0, 3.5, [[0, 'rgba(0,0,0,0)'], [0.5, k === 1 ? '#a78bfa' : '#34d399'], [1, 'rgba(0,0,0,0)']]);
        ctx.beginPath(); ctx.moveTo(l0, 3.5);
        for (let x = l0; x <= l1; x += 0.5) ctx.lineTo(x, 1 + k * 0.5 + Math.sin(x * 0.25 + time * 0.4 + k * 2) * 0.6);
        ctx.lineTo(l1, 3.5); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      layer(ctx, cam, l0, l1, 0.08, 3.5, (x, i) => { // montañas nevadas con cara iluminada y cara en sombra
        const h = 3.4 + hash(i) * 3, tx = x + (hash(i + 2) - 0.5) * 0.8;
        ctx.fillStyle = '#5f8fca'; ctx.beginPath(); ctx.moveTo(x - 2.6, ROWS); ctx.lineTo(tx, ROWS - h - 1); ctx.lineTo(x + 2.6, ROWS); ctx.fill();
        ctx.fillStyle = '#4677b3'; ctx.beginPath(); ctx.moveTo(tx, ROWS - h - 1); ctx.lineTo(x + 2.6, ROWS); ctx.lineTo(tx + 0.3, ROWS); ctx.fill();
        ctx.fillStyle = '#f4f9ff'; ctx.beginPath(); ctx.moveTo(tx - 0.8, ROWS - h - 0.15); ctx.lineTo(tx, ROWS - h - 1); ctx.lineTo(tx + 0.85, ROWS - h - 0.1); ctx.lineTo(tx + 0.4, ROWS - h - 0.3); ctx.lineTo(tx, ROWS - h - 0.05); ctx.lineTo(tx - 0.4, ROWS - h - 0.35); ctx.fill();
      });
      haze();
      layer(ctx, cam, l0, l1, 0.25, 2.6, (x, i) => {
        const h = 2 + hash(i + 3) * 2.5;
        ctx.fillStyle = '#9cc4ee'; ctx.beginPath(); ctx.moveTo(x - 1.8, ROWS); ctx.lineTo(x, ROWS - h); ctx.lineTo(x + 1.8, ROWS); ctx.fill();
        ctx.fillStyle = '#86b2e0'; ctx.beginPath(); ctx.moveTo(x, ROWS - h); ctx.lineTo(x + 1.8, ROWS); ctx.lineTo(x + 0.2, ROWS); ctx.fill();
      });
      layer(ctx, cam, l0, l1, 0.42, 1.7, (x, i) => { // pinos nevados
        if (hash(i) < 0.4) return;
        const h = 1.2 + hash(i + 1) * 1.3;
        ctx.fillStyle = '#3f2a1c'; ctx.fillRect(x - 0.05, ROWS - 0.4, 0.1, 0.4);
        for (let k = 0; k < 3; k++) {
          const y = ROWS - 0.3 - k * h * 0.3, w = 0.5 - k * 0.12;
          ctx.fillStyle = '#1f4d4a'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h * 0.45); ctx.lineTo(x + w, y); ctx.fill();
          ctx.fillStyle = '#f8fbff'; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - h * 0.22); ctx.lineTo(x, y - h * 0.45); ctx.lineTo(x + w * 0.5, y - h * 0.22); ctx.fill();
        }
      });
      ctx.fillStyle = '#ffffff'; // nieve que cae
      for (let i = 0; i < 70; i++) {
        const x = l0 + ((hash(i) * W * 1.4 - cam * 0.5 - time * 0.6 + Math.sin(time + i) * 0.3) % W + W) % W;
        const y = (hash(i + 50) * ROWS + time * (0.8 + hash(i + 9))) % ROWS;
        ctx.globalAlpha = 0.5 + hash(i + 3) * 0.5; ctx.fillRect(x, y, (hash(i + 7) > 0.7 ? 3 : 2) * P, (hash(i + 7) > 0.7 ? 3 : 2) * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'volcano': {
      ctx.fillStyle = '#1a0606'; // humo
      layer(ctx, cam, l0, l1, 0.05, 4, (x, i) => cloud(ctx, x, 1 + hash(i) * 1.5, 3.5, '#2a0d0b', '#160505'));
      layer(ctx, cam, l0, l1, 0.12, 6, (x, i) => { // volcanes con ríos de lava
        const h = 4 + hash(i) * 2;
        ctx.fillStyle = lin(ctx, x - 3.5, 0, x + 3.5, 0, [[0, '#3a1010'], [0.5, '#2a0b0b'], [1, '#1a0707']]);
        ctx.beginPath(); ctx.moveTo(x - 3.5, ROWS); ctx.lineTo(x - 0.6, ROWS - h); ctx.lineTo(x + 0.6, ROWS - h); ctx.lineTo(x + 3.5, ROWS); ctx.fill();
        glow(ctx, x, ROWS - h, 1.8, '#f97316', 0.55);
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2 * P; ctx.globalAlpha = 0.75;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 0.3, ROWS - h); for (let k = 1; k <= 6; k++) ctx.lineTo(x + s * (0.3 + k * 0.45) + Math.sin(k * 2 + i) * 0.15, ROWS - h + k * h / 6); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(60,20,20,0.6)'; // columna de humo
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.sin(time * 0.5 + k) * 0.3 + k * 0.2, ROWS - h - 0.6 - k * 0.7, 0.4 + k * 0.15, 0, Math.PI * 2); ctx.fill(); }
      });
      haze();
      layer(ctx, cam, l0, l1, 0.3, 3, (x, i) => { // rocas cercanas
        const h = 0.8 + hash(i) * 1.4;
        ctx.fillStyle = '#1c0a0a'; ctx.beginPath(); ctx.moveTo(x - 1, ROWS); ctx.lineTo(x - 0.4, ROWS - h); ctx.lineTo(x + 0.3, ROWS - h * 0.8); ctx.lineTo(x + 1, ROWS); ctx.fill();
        ctx.fillStyle = 'rgba(249,115,22,0.35)'; ctx.fillRect(x - 0.4, ROWS - h, 0.5, P * 2);
      });
      for (let i = 0; i < 40; i++) { // brasas y ceniza
        const x = l0 + ((hash(i) * W * 1.3 - cam * 0.6) % W + W) % W + Math.sin(time * 2 + i) * 0.2;
        const y = ROWS - ((time * (0.6 + hash(i + 2)) + hash(i + 5) * ROWS) % ROWS);
        ctx.fillStyle = i % 3 === 0 ? '#6b6461' : hash(i + 1) > 0.5 ? '#fdba74' : '#f97316'; ctx.globalAlpha = 0.85; ctx.fillRect(x, y, 2 * P, 2 * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'inverse': {
      layer(ctx, cam, l0, l1, 0.06, 5, (x, i) => glow(ctx, x, 2 + hash(i) * 5, 2.5, hash(i + 1) > 0.5 ? '#f0abfc' : '#22d3ee', 0.15));
      layer(ctx, cam, l0, l1, 0.15, 2.8, (x, i) => { // rocas que cuelgan del techo
        const h = 2 + hash(i) * 3;
        ctx.fillStyle = lin(ctx, x - 1, 0, x + 1, 0, [[0, '#4a1475'], [1, '#2a0848']]);
        ctx.beginPath(); ctx.moveTo(x - 1, 0); ctx.lineTo(x + 1, 0); ctx.lineTo(x + 0.2, h); ctx.lineTo(x - 0.3, h * 0.8); ctx.fill();
        if (hash(i + 4) > 0.5) { glow(ctx, x - 0.1, h * 0.75, 0.5, '#67e8f9', 0.6); ctx.fillStyle = '#a5f3fc'; ctx.beginPath(); ctx.moveTo(x - 0.25, h * 0.6); ctx.lineTo(x - 0.1, h * 0.95); ctx.lineTo(x + 0.05, h * 0.6); ctx.fill(); }
      });
      haze();
      layer(ctx, cam, l0, l1, 0.3, 4.5, (x, i) => { // islas flotantes dadas vuelta, con lianas
        const y = 3 + hash(i + 2) * 3;
        ctx.fillStyle = '#5b21b6'; ctx.fillRect(x - 0.9, y, 1.8, 0.3);
        ctx.fillStyle = lin(ctx, 0, y - 1.2, 0, y, [[0, '#2e1065'], [1, '#4c1d95']]); ctx.beginPath(); ctx.moveTo(x - 0.9, y); ctx.lineTo(x, y - 1.2); ctx.lineTo(x + 0.9, y); ctx.fill();
        ctx.strokeStyle = '#a855f7'; ctx.lineWidth = P * 2;
        for (const vx of [-0.5, 0.1, 0.5]) { ctx.beginPath(); ctx.moveTo(x + vx, y + 0.3); ctx.quadraticCurveTo(x + vx + Math.sin(time + vx) * 0.15, y + 0.6, x + vx, y + 0.5 + hash(i + vx) * 0.6); ctx.stroke(); }
        ctx.fillStyle = '#f0abfc'; ctx.fillRect(x - 0.4, y + 0.3, 2 * P, 0.4); ctx.fillRect(x + 0.3, y + 0.3, 2 * P, 0.6);
      });
      break;
    }
    case 'factory': {
      layer(ctx, cam, l0, l1, 0.3, 1.5, (x, i) => { // planchas de metal con remaches
        ctx.fillStyle = lin(ctx, x, 0, x + 1.5, 0, [[0, '#1a2230'], [0.5, '#161e2b'], [1, '#121924']]); ctx.fillRect(x, 0, 1.5 - P, ROWS);
        ctx.fillStyle = '#2a3445'; for (let ry = 0.3; ry < ROWS; ry += 1.2) { ctx.fillRect(x + 0.1, ry, 2 * P, 2 * P); ctx.fillRect(x + 1.32, ry, 2 * P, 2 * P); }
        ctx.fillStyle = 'rgba(146,64,14,0.25)'; if (hash(i) > 0.6) ctx.fillRect(x + 0.3, 2 + hash(i + 1) * 5, 0.5, 0.8); // óxido
      });
      layer(ctx, cam, l0, l1, 0.3, 5, (x, i) => { // engranajes que giran
        const r = 0.9 + hash(i) * 0.6, y = 3 + hash(i + 1) * 4, a = time * (i % 2 ? 0.8 : -0.8);
        ctx.fillStyle = ball(ctx, x, y, r * 1.2, '#2f3a4b');
        ctx.beginPath();
        for (let k = 0; k < 24; k++) { const ang = a + k * Math.PI / 12, rr = k % 2 ? r : r * 1.18; ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
        ctx.fill();
        ctx.fillStyle = '#131a25'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 5; k++) { const ang = a + k * Math.PI * 0.4; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r * 0.65, y + Math.sin(ang) * r * 0.65, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
      });
      layer(ctx, cam, l0, l1, 0.3, 8, (x, i) => { // caños con válvulas y vapor
        ctx.fillStyle = lin(ctx, 0, 2.3, 0, 2.7, [[0, '#4b5563'], [0.5, '#334155'], [1, '#1e293b']]); ctx.fillRect(x, 2.3, 8, 0.35); ctx.fillRect(x + 3, 2.3, 0.35, 6);
        ink(ctx, circle(ctx, x + 3.17, 4.5, 0.22), '#b91c1c', 1);
        ctx.fillStyle = 'rgba(226,232,240,0.25)';
        for (let k = 0; k < 4; k++) { const d = (time * 0.8 + k * 0.25 + hash(i)) % 1; ctx.beginPath(); ctx.arc(x + 5.5 + d * 0.5, 2.3 - d * 1.5, 0.15 + d * 0.3, 0, Math.PI * 2); ctx.fill(); }
      });
      layer(ctx, cam, l0, l1, 0.3, 6, (x, i) => { // luces de alarma que giran
        const on = (Math.sin(time * 6 + i) + 1) / 2;
        glow(ctx, x + 1, 1.3, 1.2, '#f59e0b', 0.25 * on);
        ctx.fillStyle = on > 0.5 ? '#fbbf24' : '#78350f'; ctx.fillRect(x + 0.9, 1.2, 0.2, 0.15);
      });
      break;
    }
    case 'forest': {
      haze();
      layer(ctx, cam, l0, l1, 0.06, 2.2, (x, i) => { ctx.fillStyle = '#04241e'; ctx.fillRect(x, 0, 0.35 + hash(i) * 0.3, ROWS); }); // troncos lejanos
      layer(ctx, cam, l0, l1, 0.12, 3.2, (x, i) => { // hongos gigantes que brillan
        const h = 3 + hash(i) * 3, c = hash(i + 1) > 0.5 ? '#22d3ee' : '#a78bfa';
        ctx.fillStyle = lin(ctx, x - 0.15, 0, x + 0.15, 0, [[0, '#0f4a40'], [1, '#062a24']]); ctx.fillRect(x - 0.15, ROWS - h, 0.3, h);
        glow(ctx, x, ROWS - h, 1.6, c, 0.35);
        ctx.fillStyle = lin(ctx, 0, ROWS - h - 0.5, 0, ROWS - h, [[0, '#12786a'], [1, '#0b4d44']]); ctx.beginPath(); ctx.ellipse(x, ROWS - h, 1.1, 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(94,234,212,0.35)'; ctx.lineWidth = P; // laminillas
        for (let k = -0.9; k <= 0.9; k += 0.18) { ctx.beginPath(); ctx.moveTo(x, ROWS - h + 0.02); ctx.lineTo(x + k, ROWS - h + 0.02); ctx.stroke(); }
        ctx.fillStyle = c; for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.7 + hash(i * 4 + k) * 1.4, ROWS - h - 0.15 - hash(i + k) * 0.25, 3 * P, 2 * P);
      });
      layer(ctx, cam, l0, l1, 0.25, 6, (x, i) => { // cascada lejana
        if (hash(i) < 0.5) return;
        ctx.fillStyle = 'rgba(103,232,249,0.18)'; ctx.fillRect(x, 0, 0.5, ROWS);
        ctx.fillStyle = 'rgba(236,254,255,0.3)'; for (let y = (time * 3) % 1; y < ROWS; y += 1) ctx.fillRect(x + 0.1 + hash(y) * 0.3, y, P * 2, 0.4);
      });
      ctx.strokeStyle = '#14532d'; ctx.lineWidth = P * 2; // lianas
      layer(ctx, cam, l0, l1, 0.35, 1.9, (x, i) => { if (hash(i) < 0.5) return; const len = 1 + hash(i + 1) * 2.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(time + i) * 0.2, len / 2, x + 0.1, len); ctx.stroke(); ctx.fillStyle = '#22c55e'; ctx.fillRect(x, len, 3 * P, 3 * P); });
      for (let i = 0; i < 36; i++) { // luciérnagas
        const x = l0 + ((hash(i) * W * 1.5 - cam * 0.4) % W + W) % W + Math.sin(time + i) * 0.3;
        const y = 2 + hash(i + 3) * 6 + Math.cos(time * 0.8 + i) * 0.3;
        const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i)), c = hash(i + 6) > 0.5 ? '#bef264' : '#67e8f9';
        glow(ctx, x, y, 0.25, c, a * 0.6); ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(x, y, 2 * P, 2 * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'storm': {
      layer(ctx, cam, l0, l1, 0.03, 3, (x, i) => cloud(ctx, x, 1.2 + hash(i) * 1.5, 4, '#2c2945', '#1a1829'));
      if (Math.sin(time * 1.7) > 0.985) { ctx.fillStyle = 'rgba(199,210,254,0.25)'; ctx.fillRect(l0, 0, W, ROWS); } // relámpago lejano
      layer(ctx, cam, l0, l1, 0.1, 3, (x, i) => { // torres lejanas con ventanas
        const h = 4 + hash(i) * 4;
        ctx.fillStyle = lin(ctx, x, 0, x + 0.8, 0, [[0, '#2a2740'], [1, '#1a1829']]); ctx.fillRect(x, ROWS - h, 0.8, h); ctx.fillRect(x - 0.2, ROWS - h, 1.2, 0.3);
        ctx.fillStyle = '#fde68a'; for (let wy = 0.6; wy < h; wy += 0.6) if (hash(i * 9 + wy) > 0.7) ctx.fillRect(x + 0.3, ROWS - h + wy, 3 * P, 3 * P);
        if (hash(i + 3) > 0.5) { ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#ef4444' : '#450a0a'; ctx.fillRect(x + 0.35, ROWS - h - 0.3, 3 * P, 3 * P); }
      });
      haze();
      layer(ctx, cam, l0, l1, 0.2, 2.5, (x, i) => cloud(ctx, x, 0.5 + hash(i) * 0.8, 3, '#3d3a5e', '#25233a'));
      ctx.strokeStyle = 'rgba(165,180,252,0.38)'; ctx.lineWidth = P; // lluvia
      for (let i = 0; i < 90; i++) {
        const x = l0 + ((hash(i) * W * 1.3 - time * 3 - cam * 0.8) % W + W) % W;
        const y = (hash(i + 9) * ROWS + time * 14) % (ROWS + 1);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.15, y + 0.5); ctx.stroke();
      }
      break;
    }
    case 'moon': {
      glow(ctx, cols * 0.12, 1.2, 3, '#fef9c3', 0.18); // el sol, lejos
      planet(ctx, cols * 0.72 - (cam * 0.03) % (cols + 6), 3.2, 1.8, '#2563eb', '#22c55e');
      layer(ctx, cam, l0, l1, 0.06, 5, (x, i) => { // montañas lunares lejanas
        const h = 2 + hash(i) * 2;
        ctx.fillStyle = '#2d323b'; ctx.beginPath(); ctx.moveTo(x - 3, ROWS); ctx.lineTo(x - 0.5, ROWS - h); ctx.lineTo(x + 0.4, ROWS - h * 0.85); ctx.lineTo(x + 3, ROWS); ctx.fill();
        ctx.fillStyle = '#3d434e'; ctx.beginPath(); ctx.moveTo(x - 3, ROWS); ctx.lineTo(x - 0.5, ROWS - h); ctx.lineTo(x - 0.2, ROWS); ctx.fill();
      });
      layer(ctx, cam, l0, l1, 0.15, 4, (x, i) => { // cerros con cráteres
        const h = 1.2 + hash(i) * 1.5;
        ctx.fillStyle = lin(ctx, 0, ROWS - h, 0, ROWS, [[0, '#6b7280'], [1, '#3f444d']]); ctx.beginPath(); ctx.ellipse(x, ROWS - 0.5, 2.6, h, 0, Math.PI, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 2; k++) { const cx = x - 1 + hash(i + k) * 2, cy = ROWS - h * (0.3 + hash(i + k + 5) * 0.4); ctx.fillStyle = '#4b5059'; ctx.beginPath(); ctx.ellipse(cx, cy, 0.35, 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7d8592'; ctx.fillRect(cx - 0.3, cy + 0.08, 0.6, P); }
      });
      layer(ctx, cam, l0, l1, 0.25, 12, (x, i) => { // una base lunar lejana con luces
        ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(x, ROWS - 0.3, 0.5, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = Math.sin(time * 3 + i) > 0 ? '#facc15' : '#713f12'; ctx.fillRect(x - 0.05, ROWS - 0.65, 3 * P, 3 * P);
      });
      break;
    }
  }
}

// ---------- Debajo del piso: capas de la tierra, roca espacial o pisos de máquinas ----------

// Un dinosaurio (o pez, o caracol) fosilizado en la roca. "s" es la escala.
function fossil(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number, bone: string) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const dark = darken(bone, 0.45);
  ctx.strokeStyle = bone; ctx.fillStyle = bone; ctx.lineCap = 'round';
  const spine = (pts: [number, number][], r: number) => { for (let i = 0; i < pts.length; i++) { const [px, py] = pts[i]; ctx.beginPath(); ctx.arc(px, py, r * (1 - i / pts.length * 0.5), 0, Math.PI * 2); ctx.fill(); } };
  const boneLine = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0, y0, w * 0.75, 0, Math.PI * 2); ctx.arc(x1, y1, w * 0.75, 0, Math.PI * 2); ctx.fill();
  };
  switch (kind % FOSSILS) {
    case 0: { // tiranosaurio
      const back: [number, number][] = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; back.push([-1.6 + t * 2.6, -0.35 + Math.sin(t * Math.PI) * -0.25 + (t < 0.3 ? (0.3 - t) * 0.8 : 0)]); }
      spine(back.reverse(), 0.07);
      ctx.lineWidth = 0.035;
      for (let i = 0; i < 7; i++) { const rx = -0.3 + i * 0.12; ctx.beginPath(); ctx.moveTo(rx, -0.5); ctx.quadraticCurveTo(rx + 0.12, -0.15, rx - 0.02, 0.05); ctx.stroke(); } // costillas
      ctx.beginPath(); ctx.moveTo(1, -0.75); ctx.lineTo(1.55, -0.7); ctx.lineTo(1.6, -0.5); ctx.lineTo(1.05, -0.4); ctx.closePath(); ctx.fill(); // cráneo
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(1.15, -0.63, 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bone; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(1.12 + k * 0.09, -0.48); ctx.lineTo(1.16 + k * 0.09, -0.38); ctx.lineTo(1.2 + k * 0.09, -0.48); ctx.fill(); } // dientes
      boneLine(1.1, -0.4, 1.55, -0.38, 0.05); // mandíbula
      boneLine(-0.05, -0.35, -0.25, 0.1, 0.06); boneLine(-0.25, 0.1, -0.1, 0.45, 0.05); boneLine(-0.1, 0.45, 0.1, 0.5, 0.04); // pata
      boneLine(0.15, -0.35, 0.05, 0.1, 0.06); boneLine(0.05, 0.1, 0.25, 0.42, 0.05);
      boneLine(0.75, -0.45, 0.85, -0.3, 0.03); // bracito
      break;
    }
    case 1: { // dinosaurio de cuello largo
      const pts: [number, number][] = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([-2 + t * 4, t < 0.35 ? -0.2 + (0.35 - t) * 0.5 : t < 0.65 ? -0.4 : -0.4 - (t - 0.65) * 3]); }
      spine(pts, 0.06);
      ctx.beginPath(); ctx.ellipse(2.05, -1.48, 0.18, 0.09, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 0.035;
      for (let i = 0; i < 8; i++) { const rx = -0.5 + i * 0.15; ctx.beginPath(); ctx.moveTo(rx, -0.4); ctx.quadraticCurveTo(rx + 0.15, 0, rx, 0.15); ctx.stroke(); }
      for (const lx of [-0.55, -0.35, 0.45, 0.65]) { boneLine(lx, -0.3, lx + 0.05, 0.25, 0.07); boneLine(lx + 0.05, 0.25, lx, 0.6, 0.06); }
      break;
    }
    case 2: { // tricerátops (cráneo con cuernos y gola)
      ctx.beginPath(); ctx.arc(-0.1, 0, 0.55, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); // gola
      ctx.fillStyle = dark; for (let k = 0; k < 5; k++) { const a = Math.PI * (1 + k * 0.22); ctx.beginPath(); ctx.arc(-0.1 + Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.06, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = bone; ctx.beginPath(); ctx.moveTo(-0.1, -0.2); ctx.lineTo(0.75, -0.05); ctx.lineTo(0.85, 0.15); ctx.lineTo(0.1, 0.3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.2, -0.15); ctx.lineTo(0.75, -0.75); ctx.lineTo(0.35, -0.1); ctx.fill(); // cuernos
      ctx.beginPath(); ctx.moveTo(0.45, -0.1); ctx.lineTo(0.95, -0.55); ctx.lineTo(0.55, -0.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.7, -0.05); ctx.lineTo(0.85, -0.3); ctx.lineTo(0.8, -0.02); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0.3, 0.02, 0.07, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 3: { // amonite (caracol de mar fósil)
      ctx.lineWidth = 0.06; ctx.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.2) { const r = 0.04 + a * 0.03; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
      ctx.strokeStyle = dark; ctx.lineWidth = 0.02;
      for (let a = 1; a < Math.PI * 6; a += 0.5) { const r = 0.04 + a * 0.03; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); ctx.stroke(); }
      break;
    }
    case 4: { // pez fósil
      boneLine(-0.6, 0, 0.5, 0, 0.04);
      ctx.lineWidth = 0.025;
      for (let i = 0; i < 9; i++) { const fx = -0.45 + i * 0.1, h = 0.25 * Math.sin((i + 1) / 10 * Math.PI); ctx.beginPath(); ctx.moveTo(fx, -h); ctx.lineTo(fx + 0.03, 0); ctx.lineTo(fx, h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0.5, -0.2); ctx.lineTo(0.75, 0); ctx.lineTo(0.5, 0.2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(-0.85, -0.22); ctx.lineTo(-0.8, 0); ctx.lineTo(-0.85, 0.22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0.6, -0.03, 0.03, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 5: { // esqueleto humano acostado
      ctx.beginPath(); ctx.ellipse(-0.95, -0.02, 0.16, 0.14, 0, 0, Math.PI * 2); ctx.fill(); // cráneo
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-1.0, -0.05, 0.035, 0, Math.PI * 2); ctx.arc(-0.92, -0.06, 0.035, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-0.98, 0.04, 0.08, 0.02); ctx.fillStyle = bone;
      boneLine(-1.02, 0.12, -0.86, 0.12, 0.025); // mandíbula
      spine([[-0.78, 0], [-0.68, 0], [-0.58, 0], [-0.48, 0], [-0.38, 0], [-0.28, 0], [-0.18, 0]], 0.035);
      ctx.lineWidth = 0.025; for (let i = 0; i < 6; i++) { const rx = -0.72 + i * 0.07; ctx.beginPath(); ctx.ellipse(rx, 0, 0.03, 0.15, 0, 0, Math.PI * 2); ctx.stroke(); } // costillas
      ctx.beginPath(); ctx.ellipse(-0.12, 0, 0.09, 0.14, 0, 0, Math.PI * 2); ctx.fill(); // cadera
      boneLine(-0.75, -0.12, -0.5, -0.28, 0.03); boneLine(-0.5, -0.28, -0.3, -0.22, 0.025); // brazo
      boneLine(-0.75, 0.12, -0.5, 0.25, 0.03); boneLine(-0.5, 0.25, -0.25, 0.3, 0.025);
      boneLine(-0.05, -0.06, 0.35, -0.1, 0.04); boneLine(0.35, -0.1, 0.72, -0.08, 0.035); boneLine(0.72, -0.08, 0.8, -0.18, 0.025); // piernas
      boneLine(-0.05, 0.06, 0.35, 0.12, 0.04); boneLine(0.35, 0.12, 0.72, 0.14, 0.035); boneLine(0.72, 0.14, 0.8, 0.04, 0.025);
      break;
    }
    case 6: { // calavera y huesos sueltos
      ctx.beginPath(); ctx.arc(0, -0.05, 0.22, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(0.12, 0.2); ctx.lineTo(-0.12, 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-0.08, -0.04, 0.06, 0.07, 0, 0, Math.PI * 2); ctx.ellipse(0.08, -0.04, 0.06, 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0.04); ctx.lineTo(-0.03, 0.1); ctx.lineTo(0.03, 0.1); ctx.fill();
      for (let k = 0; k < 4; k++) ctx.fillRect(-0.08 + k * 0.045, 0.15, 0.015, 0.05);
      ctx.fillStyle = bone; boneLine(0.35, 0.15, 0.85, -0.1, 0.035); boneLine(-0.35, 0.18, -0.75, -0.05, 0.035); boneLine(0.4, -0.2, 0.7, 0.2, 0.03);
      break;
    }
    case 7: { // pterodáctilo con las alas abiertas
      spine([[-0.2, 0], [-0.1, 0], [0, 0], [0.1, 0], [0.2, 0.02]], 0.04);
      boneLine(0, -0.02, -0.5, -0.45, 0.035); boneLine(-0.5, -0.45, -1.2, -0.3, 0.025); boneLine(-1.2, -0.3, -1.6, -0.55, 0.02);
      boneLine(0, 0.02, 0.5, -0.45, 0.035); boneLine(0.5, -0.45, 1.1, -0.35, 0.025); boneLine(1.1, -0.35, 1.5, -0.6, 0.02);
      ctx.beginPath(); ctx.moveTo(0.22, -0.05); ctx.lineTo(0.75, -0.02); ctx.lineTo(0.3, 0.06); ctx.closePath(); ctx.fill(); // pico
      ctx.beginPath(); ctx.moveTo(0.22, -0.05); ctx.lineTo(0.05, -0.25); ctx.lineTo(0.3, -0.02); ctx.fill(); // cresta
      boneLine(-0.15, 0.03, -0.3, 0.35, 0.025); boneLine(-0.05, 0.03, -0.15, 0.35, 0.025);
      break;
    }
    case 8: { // mamut: cráneo con colmillos curvos
      ctx.beginPath(); ctx.ellipse(0, -0.1, 0.4, 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0.12, -0.15, 0.07, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = bone;
      ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0.25, 0.1); ctx.quadraticCurveTo(0.9, 0.5, 0.95, -0.15); ctx.stroke();
      ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(0.15, 0.15); ctx.quadraticCurveTo(0.7, 0.6, 0.78, 0); ctx.stroke();
      spine([[-0.45, 0.05], [-0.62, 0.08], [-0.78, 0.1], [-0.94, 0.12], [-1.1, 0.12]], 0.06);
      break;
    }
    case 9: { // trilobite
      ctx.beginPath(); ctx.ellipse(0, 0, 0.35, 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 0.02;
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.08, -0.2); ctx.lineTo(k * 0.08, 0.2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-0.35, -0.06); ctx.lineTo(0.35, -0.06); ctx.moveTo(-0.35, 0.06); ctx.lineTo(0.35, 0.06); ctx.stroke();
      ctx.fillStyle = bone; ctx.beginPath(); ctx.ellipse(0.38, 0, 0.12, 0.2, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
      break;
    }
    case 10: { // raptor
      const back: [number, number][] = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; back.push([-1.1 + t * 1.6, -0.25 - Math.sin(t * Math.PI) * 0.12]); }
      spine(back, 0.045);
      ctx.lineWidth = 0.025; for (let i = 0; i < 5; i++) { const rx = -0.15 + i * 0.08; ctx.beginPath(); ctx.moveTo(rx, -0.35); ctx.quadraticCurveTo(rx + 0.08, -0.1, rx, 0.05); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0.45, -0.38); ctx.lineTo(0.85, -0.3); ctx.lineTo(0.48, -0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0.55, -0.32, 0.03, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = bone;
      boneLine(0.1, -0.25, 0.0, 0.1, 0.04); boneLine(0.0, 0.1, 0.12, 0.38, 0.035); boneLine(0.12, 0.38, 0.28, 0.4, 0.02);
      ctx.beginPath(); ctx.moveTo(0.28, 0.4); ctx.quadraticCurveTo(0.38, 0.3, 0.33, 0.25); ctx.lineTo(0.3, 0.38); ctx.fill(); // la garra
      boneLine(0.35, -0.3, 0.42, -0.12, 0.02);
      break;
    }
  }
  ctx.restore();
}
const FOSSILS = 11;

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, time: number) {
  glow(ctx, x, y, s * 1.6, color, 0.3 + 0.1 * Math.sin(time * 2 + x));
  for (const [dx, h, a] of [[-0.12, 0.5, -0.4], [0, 0.75, 0], [0.13, 0.45, 0.45]] as const) {
    ctx.save(); ctx.translate(x + dx * s, y); ctx.rotate(a);
    ink(ctx, () => { ctx.moveTo(-0.07 * s, 0); ctx.lineTo(-0.07 * s, -h * s * 0.75); ctx.lineTo(0, -h * s); ctx.lineTo(0.07 * s, -h * s * 0.75); ctx.lineTo(0.07 * s, 0); ctx.closePath(); }, lin(ctx, -0.07 * s, 0, 0.07 * s, 0, [[0, lighten(color, 0.5)], [0.5, color], [1, darken(color, 0.4)]]), 1);
    ctx.restore();
  }
}

// Las capas de abajo del piso (desde la costra hasta "bottom"), con piedritas, fósiles y lo que tenga cada escenario.
function underground(ctx: CanvasRenderingContext2D, game: Game, t: Theme, x0: number, x1: number, bottom: number) {
  const top = FLOOR + 1, time = game.time, seed = game.level * 17;
  const wave = (x: number, k: number) => Math.sin(x * 0.33 + k * 1.7) * 0.2 + Math.sin(x * 0.9 + k * 3.1) * 0.07;
  let y = top;
  for (let k = 0; y < bottom + 1; k++) { // capas onduladas
    const color = t.strata[k % t.strata.length];
    ctx.fillStyle = lin(ctx, 0, y, 0, y + 1.6, [[0, lighten(color, 0.08)], [1, color]]);
    ctx.beginPath(); ctx.moveTo(x0, bottom + 2);
    for (let x = Math.floor(x0); x <= x1 + 1; x += 0.5) ctx.lineTo(x, y + (k ? wave(x, k) : 0));
    ctx.lineTo(x1 + 1, bottom + 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darken(color, 0.35); ctx.lineWidth = P * 1.5; ctx.stroke();
    y += 0.9 + hash(k * 3.1 + seed) * 1.5;
  }
  grain(ctx, x0, top, x1, bottom, seed, 'rgba(255,255,255,0.08)', 0.12); // textura de tierra
  grain(ctx, x0, top, x1, bottom, seed + 5, 'rgba(0,0,0,0.18)', 0.14);
  // Piedras con volumen.
  for (let gx = Math.floor(x0); gx < x1; gx += 0.75) for (let gy = top + 0.3; gy < bottom; gy += 0.75) {
    const h = hash(gx * 7.13 + gy * 3.7 + seed);
    if (h > 0.9) { // piedras achatadas, con luz arriba
      const r = 0.06 + (h - 0.9) * 1.3, px = gx + hash(h * 3) * 0.6, py = gy + hash(h * 5) * 0.6;
      const stone = mix(t.strata[Math.floor(h * 50) % t.strata.length], '#d6d3d1', 0.35);
      ctx.fillStyle = lin(ctx, 0, py - r, 0, py + r, [[0, lighten(stone, 0.25)], [1, darken(stone, 0.3)]]);
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.5, r * 0.85, (h - 0.95) * 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = darken(stone, 0.45); ctx.lineWidth = P; ctx.stroke();
    }
  }
  const theme = game.def.theme;
  if (t.under === 'earth') {
    if (theme === 'forest') { // raíces
      ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = P * 3;
      for (let rx = Math.floor(x0 / 2.3) * 2.3; rx < x1; rx += 2.3) { if (hash(rx) < 0.4) continue; ctx.beginPath(); ctx.moveTo(rx, top - 0.1); let ry = top; let px = rx; while (ry < top + 1.6 + hash(rx + 1) * 1.5) { ry += 0.3; px += (hash(rx * 3 + ry) - 0.5) * 0.3; ctx.lineTo(px, ry); } ctx.stroke(); }
    }
    if (theme === 'volcano') { // vetas de lava
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = P * 2;
      for (let vx = Math.floor(x0 / 4) * 4; vx < x1; vx += 4) {
        const vy = top + 1 + hash(vx) * 4;
        glow(ctx, vx + 1, vy, 1.2, '#f97316', 0.25);
        ctx.beginPath(); ctx.moveTo(vx, vy); for (let k = 1; k <= 6; k++) ctx.lineTo(vx + k * 0.4, vy + Math.sin(k * 1.3 + vx) * 0.25); ctx.stroke();
      }
    }
    if (theme === 'city') { // caño del desagüe y cables
      ctx.fillStyle = lin(ctx, 0, top + 0.35, 0, top + 0.85, [[0, '#6b7280'], [0.5, '#4b5563'], [1, '#1f2937']]); ctx.fillRect(x0, top + 0.35, x1 - x0, 0.5);
      ctx.fillStyle = '#374151'; for (let jx = Math.floor(x0 / 3) * 3; jx < x1; jx += 3) ctx.fillRect(jx, top + 0.3, 0.2, 0.6);
      ctx.strokeStyle = '#111827'; ctx.lineWidth = P * 2; ctx.beginPath(); ctx.moveTo(x0, top + 1.1); for (let cx = Math.floor(x0); cx < x1; cx += 2) ctx.quadraticCurveTo(cx + 1, top + 1.35, cx + 2, top + 1.1); ctx.stroke();
    }
    if (theme === 'ice') { // burbujas congeladas
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let bx = Math.floor(x0); bx < x1; bx += 0.6) if (hash(bx * 5) > 0.7) { ctx.beginPath(); ctx.arc(bx, top + 0.4 + hash(bx) * (bottom - top), 0.05 + hash(bx * 2) * 0.06, 0, Math.PI * 2); ctx.fill(); }
    }
    bones(ctx, x0, x1, top, bottom, seed, theme === 'ice' ? '#f1f5f9' : '#e9dfc7', 1);
  } else if (t.under === 'rock') {
    for (let i = Math.floor((x0 - 3) / 3.5); i * 3.5 < x1 + 3; i++) { // cristales y vetas de metal
      const cx = i * 3.5 + hash(i + seed) * 2, cy = top + 0.9 + hash(i * 7) * Math.min(4, bottom - top);
      if (hash(i * 13) > 0.45) crystal(ctx, cx, cy, 0.7 + hash(i) * 0.5, ['#a78bfa', '#22d3ee', '#f472b6', '#34d399'][i & 3], time);
      else { ctx.strokeStyle = '#d4a017'; ctx.lineWidth = P * 2; ctx.beginPath(); ctx.moveTo(cx - 0.8, cy); ctx.lineTo(cx, cy + 0.2); ctx.lineTo(cx + 0.7, cy - 0.15); ctx.stroke(); }
    }
    bones(ctx, x0, x1, top, bottom, seed, '#d6d3d1', 0.7);
  } else { // pisos de máquinas: caños, cables, luces y engranajes
    for (let d = top + 0.6; d < bottom; d += 2.2) {
      ctx.fillStyle = lin(ctx, 0, d, 0, d + 0.4, [[0, '#64748b'], [0.5, '#475569'], [1, '#1e293b']]); ctx.fillRect(x0, d, x1 - x0, 0.4);
      for (let jx = Math.floor(x0 / 2.5) * 2.5; jx < x1; jx += 2.5) { ink(ctx, () => ctx.rect(jx, d - 0.06, 0.25, 0.52), '#334155', 1); }
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = P * 2; ctx.beginPath(); ctx.moveTo(x0, d + 0.9);
      for (let cx = Math.floor(x0); cx < x1; cx += 1.5) ctx.quadraticCurveTo(cx + 0.75, d + 1.25, cx + 1.5, d + 0.9);
      ctx.stroke();
      for (let lx = Math.floor(x0 / 1.7) * 1.7; lx < x1; lx += 1.7) if (hash(lx + d) > 0.55) { ctx.fillStyle = Math.sin(time * 3 + lx * 2 + d) > 0 ? (hash(lx) > 0.5 ? '#22c55e' : '#f97316') : '#111827'; ctx.fillRect(lx, d + 1.45, 3 * P, 3 * P); }
      if (theme === 'factory') for (let gx = Math.floor(x0 / 6) * 6; gx < x1; gx += 6) {
        const r = 0.5, a = time * (gx % 12 ? 1 : -1), gy = d + 1.6;
        ctx.fillStyle = ball(ctx, gx + 3, gy, r * 1.2, '#4b5563'); ctx.beginPath();
        for (let k = 0; k < 16; k++) { const ang = a + k * Math.PI / 8, rr = k % 2 ? r : r * 1.25; ctx.lineTo(gx + 3 + Math.cos(ang) * rr, gy + Math.sin(ang) * rr); }
        ctx.fill();
      }
    }
    bones(ctx, x0, x1, top + 0.9, bottom, seed, '#cbd5e1', 0.45); // entre las máquinas también quedaron huesos
  }
}

// Huesos y esqueletos enterrados (de humanos, dinosaurios, mamuts, peces...), a distintas profundidades, bastante
// seguidos. "amount" (0 a 1) dice qué tan seguido.
function bones(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, seed: number, bone: string, amount: number) {
  const gap = 4.2 / amount;
  for (let i = Math.floor((x0 - 4) / gap); i * gap < x1 + 4; i++) {
    for (let layer = 0; layer < 3; layer++) {
      const h = hash(i * 31 + layer * 7 + seed);
      if (layer > 0 && h < 0.35) continue;
      const kind = Math.floor(hash(i * 11 + layer * 5 + seed) * FOSSILS), big = kind < 2 || kind === 7;
      const fx = i * gap + hash(i * 5 + layer + seed) * gap * 0.7, fy = top + 0.7 + layer * 2.1 + hash(i * 3 + layer) * 1.2 + (big ? 0.4 : 0);
      if (fy > bottom + 1.5) continue;
      fossil(ctx, kind, fx, fy, (big ? 1.05 : 0.8) * (0.85 + hash(i + layer * 13) * 0.3), bone);
    }
  }
}

// Los pozos del piso: un hueco oscuro que baja (en el volcán, lava).
function pits(ctx: CanvasRenderingContext2D, game: Game, x0: number, x1: number, bottom: number) {
  const floor = game.solids.filter(s => s.kind === 'ground' && s.y >= FLOOR - 0.01 && s.x + s.w > x0 - 5 && s.x < x1 + 5).sort((a, b) => a.x - b.x);
  for (let i = 1; i < floor.length; i++) {
    const a = floor[i - 1].x + floor[i - 1].w, b = floor[i].x;
    if (b - a < 0.05) continue;
    if (game.def.theme === 'volcano') {
      ctx.fillStyle = lin(ctx, 0, FLOOR + 0.2, 0, bottom, [[0, '#fde047'], [0.15, '#f97316'], [1, '#7f1d1d']]);
      ctx.fillRect(a, FLOOR + 0.25 + Math.sin(game.time * 2 + a) * 0.05, b - a, bottom - FLOOR + 1);
      glow(ctx, (a + b) / 2, FLOOR + 0.3, (b - a), '#f97316', 0.5);
      ctx.fillStyle = '#fef08a'; for (let k = 0; k < 3; k++) { const bx = a + hash(k + a) * (b - a), d = (game.time * 0.8 + k * 0.33) % 1; ctx.globalAlpha = 1 - d; ctx.beginPath(); ctx.arc(bx, FLOOR + 0.35 - d * 0.2, 0.05 + d * 0.06, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = lin(ctx, 0, FLOOR, 0, FLOOR + 4, [[0, '#0b0b14'], [1, '#000000']]); ctx.fillRect(a, FLOOR, b - a, bottom - FLOOR + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(a, FLOOR, 0.15, bottom - FLOOR + 1); ctx.fillRect(b - 0.15, FLOOR, 0.15, bottom - FLOOR + 1);
    }
  }
}

// ---------- Piso, techo y bloques ----------

function drawSolid(ctx: CanvasRenderingContext2D, s: Solid, t: Theme, game: Game, x0: number, x1: number) {
  if (s.gone) return;
  const theme = game.def.theme;
  let { x, y } = s;
  const { w, h } = s;
  if (s.kind === 'crumble' && s.crumble !== undefined) { x += Math.sin(game.time * 70) * 0.05; y += Math.cos(game.time * 60) * 0.03; }
  const left = Math.max(x, x0), right = Math.min(x + w, x1);
  if (right <= left) return;
  // Del piso y del techo se dibuja la costra (lo de más afuera son las capas de tierra o el cielo).
  const floorSide = s.kind === 'ground' && y >= FLOOR - 0.01, ceilSide = s.kind === 'ground' && !floorSide;
  const top = ceilSide ? CEIL - 1.25 : y, tall = s.kind === 'ground' ? (ceilSide ? 1.25 : 1) : h;
  const base = s.kind === 'base' ? '#4b5563' : t.ground;
  const light = lighten(base, 0.18), dark = darken(base, 0.35);
  ink(ctx, () => ctx.rect(left, top, right - left, tall), lin(ctx, 0, top, 0, top + tall, ceilSide ? [[0, dark], [1, light]] : [[0, light], [1, dark]]));
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, tall); ctx.clip();
  // Piedras o planchas de metal, cada una con su tono, con luz arriba y sombra abajo.
  const rowH = t.metal ? 0.5 : 0.42;
  for (let ry = 0, row = 0; ry < tall; ry += rowH, row++) {
    let cx = Math.floor(left) - 1 + (row % 2) * 0.45;
    while (cx < right) {
      const bw = t.metal ? 1 : 0.55 + hash(cx * 3.7 + row * 1.3) * 0.65, k = hash(cx * 9.1 + row * 4.7);
      ctx.fillStyle = k > 0.5 ? mix(t.brick, '#ffffff', (k - 0.5) * 0.18) : mix(t.brick, '#000000', (0.5 - k) * 0.3);
      ctx.fillRect(cx + P, top + ry + P, bw - 2 * P, rowH - 2 * P);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx + P, top + ry + P, bw - 2 * P, P);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx + P, top + ry + rowH - 2 * P, bw - 2 * P, P);
      if (t.metal) { ctx.fillStyle = lighten(t.brick, 0.35); for (const rx of [0.1, bw - 0.14]) for (const rr of [0.1, rowH - 0.14]) ctx.fillRect(cx + rx, top + ry + rr, 2 * P, 2 * P); }
      cx += bw;
    }
  }
  grain(ctx, left, top, right, top + tall, x * 3 + y, 'rgba(0,0,0,0.22)', 0.18);
  grain(ctx, left, top, right, top + tall, x * 5 + y + 9, 'rgba(255,255,255,0.1)', 0.1);
  if (theme === 'factory' && s.kind !== 'ground') { // franjas de peligro
    ctx.fillStyle = '#facc15';
    for (let k = Math.floor(left) - 2; k < right + 2; k += 0.6) { ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + 0.3, y + h); ctx.lineTo(k + 0.3 + h, y); ctx.lineTo(k + h, y); ctx.fill(); }
    ctx.fillStyle = 'rgba(17,24,39,0.55)'; ctx.fillRect(left, y, right - left, h);
  }
  if (theme === 'volcano') { // grietas con lava que brilla
    ctx.strokeStyle = '#fb923c'; ctx.lineWidth = P * 1.5;
    for (let k = Math.floor(left); k < right; k += 1.3) if (hash(k * 7 + y) > 0.55) { glow(ctx, k + 0.4, top + tall / 2, 0.5, '#f97316', 0.25); ctx.beginPath(); ctx.moveTo(k + 0.2, top + 0.1); ctx.lineTo(k + 0.45, top + tall * 0.5); ctx.lineTo(k + 0.3, top + tall - 0.1); ctx.stroke(); }
  }
  if (s.kind === 'crumble') { // grietas
    ctx.strokeStyle = INK; ctx.lineWidth = P * 1.5;
    for (let k = 0; k < w; k += 1) { ctx.beginPath(); ctx.moveTo(x + k + 0.3, y); ctx.lineTo(x + k + 0.5, y + h * 0.4); ctx.lineTo(x + k + 0.35, y + h * 0.7); ctx.stroke(); }
  }
  if (theme === 'moon') { // cráteres
    for (let k = Math.floor(left); k < right; k++) if (hash(k + y) > 0.6) {
      const cy = floorSide ? y + 0.45 : ceilSide ? CEIL - 0.45 : y + h / 2;
      ctx.fillStyle = darken(base, 0.3); ctx.beginPath(); ctx.ellipse(k + 0.5, cy, 0.3, 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lighten(base, 0.3); ctx.fillRect(k + 0.25, cy + 0.1, 0.5, P);
    }
  }
  ctx.restore();
  // El borde que da al lado donde se juega brilla con el color del escenario.
  const playTop = floorSide || s.kind !== 'ground', playBottom = ceilSide || s.kind !== 'ground';
  const edge = (yy: number) => { glow(ctx, (left + right) / 2, yy, Math.min(3, (right - left) / 2 + 0.5), t.top, 0.08); ctx.fillStyle = t.top; ctx.fillRect(left, yy - P, right - left, 2 * P); };
  if (playTop) edge(y + P);
  if (playBottom) edge(y + h - P);
  if (theme === 'ice') { // nieve arriba y carámbanos abajo
    ctx.fillStyle = '#ffffff';
    if (playTop) for (let k = Math.floor(left * 4) / 4; k < right; k += 0.25) ctx.fillRect(k, y - P * 2 - hash(k * 4) * P * 2, 0.25, P * 4);
    if (playBottom) for (let k = Math.ceil(left * 2) / 2; k < right; k += 0.5) if (hash(k * 2) > 0.4) {
      ctx.fillStyle = lin(ctx, 0, y + h, 0, y + h + 0.35, [[0, '#ffffff'], [1, 'rgba(186,230,253,0.6)']]);
      ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + 0.2, y + h); ctx.lineTo(k + 0.1, y + h + 0.15 + hash(k) * 0.2); ctx.fill();
    }
  }
  if (theme === 'forest') { // musgo que brilla y lianas
    for (let k = Math.floor(left * 3) / 3; k < right; k += 1 / 3) if (hash(k * 3) > 0.45) {
      ctx.fillStyle = hash(k * 7) > 0.5 ? '#4ade80' : '#22c55e';
      if (playTop) ctx.fillRect(k, y - P * 2, P * 4, P * 3);
      if (playBottom) { ctx.fillRect(k, y + h - P, P * 4, P * 3); if (hash(k * 11) > 0.75) { ctx.strokeStyle = '#15803d'; ctx.lineWidth = P * 1.5; ctx.beginPath(); ctx.moveTo(k + P * 2, y + h); ctx.lineTo(k + P * 2 + Math.sin(game.time + k) * 0.05, y + h + 0.3 + hash(k) * 0.4); ctx.stroke(); } }
    }
  }
}

// ---------- Trampas ----------

function spikes(ctx: CanvasRenderingContext2D, h: Hazard, t: Theme) {
  const n = Math.round(h.w * 2), sw = h.w / n, up = h.side === 1;
  const base = up ? h.y + h.h : h.y, tip = up ? h.y : h.y + h.h, plate = up ? base - 0.1 : base;
  for (let i = 0; i < n; i++) { // cada púa con una cara iluminada, otra en sombra y un brillo en el filo
    const x = h.x + i * sw;
    ink(ctx, () => { ctx.moveTo(x + 0.02, base); ctx.lineTo(x + sw / 2, tip); ctx.lineTo(x + sw - 0.02, base); ctx.closePath(); }, lin(ctx, x, 0, x + sw, 0, [[0, lighten(t.spike, 0.3)], [0.5, t.spike], [0.52, t.shade], [1, darken(t.shade, 0.3)]]), 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + sw / 2 - P, up ? tip + 0.06 : tip - 0.16, P, 0.1);
  }
  ink(ctx, () => ctx.rect(h.x, plate, h.w, 0.1), lin(ctx, 0, plate, 0, plate + 0.1, [[0, '#9ca3af'], [1, '#374151']]), 1.5); // base con tornillos
  ctx.fillStyle = '#1f2937'; for (let bx = h.x + 0.12; bx < h.x + h.w; bx += 0.5) ctx.fillRect(bx, plate + 0.035, 2 * P, 2 * P);
}

function spikyBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, body: string, eye: string | null, time: number) {
  for (let k = 0; k < 10; k++) {
    const a = spin + k * Math.PI / 5;
    ink(ctx, () => { ctx.moveTo(x + Math.cos(a - 0.28) * r * 0.8, y + Math.sin(a - 0.28) * r * 0.8); ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); ctx.lineTo(x + Math.cos(a + 0.28) * r * 0.8, y + Math.sin(a + 0.28) * r * 0.8); ctx.closePath(); },
      lin(ctx, x + Math.cos(a - 1.5) * r, y + Math.sin(a - 1.5) * r, x + Math.cos(a + 1.5) * r, y + Math.sin(a + 1.5) * r, [[0, '#e5e7eb'], [1, '#6b7280']]), 1.5);
  }
  ink(ctx, circle(ctx, x, y, r), ball(ctx, x, y, r, body));
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = P; // juntas de las planchas
  ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 6; k++) { const a = spin + k * Math.PI / 3; ctx.fillRect(x + Math.cos(a) * r * 0.85 - P, y + Math.sin(a) * r * 0.85 - P, 2 * P, 2 * P); } // remaches
  if (eye) {
    glow(ctx, x, y, r * 1.4, eye, 0.4 + 0.3 * Math.sin(time * 6));
    ink(ctx, circle(ctx, x, y, r * 0.42), ball(ctx, x, y, r * 0.42, eye), 1.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.17, y - r * 0.22, 2 * P, 2 * P);
  }
}

function saw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, ice: boolean) {
  const metal = ice ? '#bfdbfe' : '#cbd5e1';
  ctx.globalAlpha = 0.25; ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; // borroso por la velocidad
  ctx.beginPath();
  for (let k = 0; k < 32; k++) { const a = spin + k * Math.PI / 16, rr = k % 2 ? r * 0.8 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.lineWidth = 2 * P; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ball(ctx, x, y, r, metal); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = P; ctx.beginPath(); ctx.arc(x, y, r * 0.7, spin, spin + 1.2); ctx.stroke(); // brillo que gira
  ink(ctx, circle(ctx, x, y, r * 0.5), ball(ctx, x, y, r * 0.5, ice ? '#60a5fa' : '#94a3b8'), 1.5);
  ctx.fillStyle = '#1f2937'; for (let k = 0; k < 4; k++) { const a = spin + k * Math.PI / 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.33, y + Math.sin(a) * r * 0.33, r * 0.06, 0, Math.PI * 2); ctx.fill(); }
  ink(ctx, circle(ctx, x, y, r * 0.18), ball(ctx, x, y, r * 0.18, '#ef4444'), 1.5);
}

// Un villano que camina (robot de nieve, robot de fábrica o alien), mirando para el lado del jugador.
function walker(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const theme = game.def.theme, step = Math.sin(game.time * 10 + h.id);
  ctx.save();
  ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
  if (h.side === -1) ctx.scale(1, -1);
  const b = h.h / 2; // el piso queda en y = b
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, b, 0.35, 0.06, 0, 0, Math.PI * 2); ctx.fill(); // sombra
  if (theme === 'ice') { // muñeco de nieve robot
    ink(ctx, circle(ctx, 0, b - 0.25, 0.3), ball(ctx, 0, b - 0.25, 0.3, '#f8fafc'));
    ink(ctx, circle(ctx, 0, b - 0.68, 0.22), ball(ctx, 0, b - 0.68, 0.22, '#f8fafc'));
    ink(ctx, () => ctx.rect(-0.2, b - 0.78, 0.4, 0.12), '#334155', 1);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-0.16, b - 0.75, 0.14, 0.06);
    glow(ctx, -0.1, b - 0.72, 0.25, '#ef4444', 0.7);
    ctx.fillStyle = '#1f2937'; for (const by of [-0.35, -0.2]) ctx.fillRect(-0.03, b + by, 3 * P, 3 * P);
    limb(ctx, [[0.2, b - 0.3], [0.38, b - 0.45 + step * 0.05]], '#78350f', P * 2);
    limb(ctx, [[-0.2, b - 0.3], [-0.36, b - 0.42 - step * 0.05]], '#78350f', P * 2);
    ink(ctx, () => ctx.rect(-0.32, b - 0.08, 0.64, 0.08), '#374151', 1);
  } else if (theme === 'factory') { // robot
    limb(ctx, [[-0.15, b - 0.3], [-0.15 + step * 0.08, b]], '#6b7280', P * 3);
    limb(ctx, [[0.15, b - 0.3], [0.15 - step * 0.08, b]], '#6b7280', P * 3);
    ink(ctx, () => ctx.roundRect(-0.32, b - 0.85, 0.64, 0.58, 0.08), lin(ctx, -0.32, 0, 0.32, 0, [[0, '#d1d5db'], [0.6, '#9ca3af'], [1, '#6b7280']]));
    ink(ctx, () => ctx.rect(-0.24, b - 0.76, 0.48, 0.2), '#111827', 1);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-0.2 + (Math.sin(game.time * 3) + 1) * 0.14, b - 0.71, 0.12, 0.1);
    glow(ctx, -0.14 + (Math.sin(game.time * 3) + 1) * 0.14, b - 0.66, 0.2, '#ef4444', 0.6);
    ctx.fillStyle = '#facc15'; for (let k = 0; k < 3; k++) ctx.fillRect(-0.2 + k * 0.15, b - 0.45, 0.08, 0.08);
    limb(ctx, [[0, b - 0.85], [0, b - 1]], '#6b7280', P * 1.5);
    ink(ctx, circle(ctx, 0, b - 1.02, 0.05), '#facc15', 1);
  } else { // alien baboso de un ojo
    ink(ctx, () => { ctx.ellipse(0, b - 0.38, 0.38, 0.4 + step * 0.03, 0, Math.PI, Math.PI * 2); ctx.lineTo(0.38, b); ctx.lineTo(-0.38, b); ctx.closePath(); }, ball(ctx, 0, b - 0.4, 0.45, '#84cc16'));
    ink(ctx, circle(ctx, -0.05, b - 0.45, 0.15), ball(ctx, -0.05, b - 0.45, 0.15, '#ffffff'), 1.5);
    ctx.fillStyle = INK; ctx.fillRect(-0.12, b - 0.48, 0.07, 0.07);
    ctx.fillStyle = '#4d7c0f'; for (let k = 0; k < 4; k++) ctx.fillRect(-0.3 + k * 0.17, b - 0.15 + Math.sin(game.time * 4 + k) * 0.02, 0.08, 0.15); // baba
  }
  ctx.restore();
}

function flyer(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const c = flyerCenter(game, h), theme = game.def.theme, flap = Math.sin(game.time * 18 + h.id);
  if (theme === 'inverse' || theme === 'storm') { // murciélago alien
    for (const s of [-1, 1]) ink(ctx, () => { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + s * 0.55, c.y - 0.15 - flap * 0.25); ctx.lineTo(c.x + s * 0.48, c.y + 0.05); ctx.lineTo(c.x + s * 0.38, c.y - 0.02); ctx.lineTo(c.x + s * 0.28, c.y + 0.08); ctx.closePath(); }, lin(ctx, c.x, c.y - 0.3, c.x, c.y + 0.1, [[0, '#9333ea'], [1, '#4c1d95']]), 1.5);
    ink(ctx, circle(ctx, c.x, c.y, 0.22), ball(ctx, c.x, c.y, 0.22, '#6b21a8'));
    glow(ctx, c.x, c.y - 0.03, 0.25, '#facc15', 0.5);
    ctx.fillStyle = '#facc15'; ctx.fillRect(c.x - 0.1, c.y - 0.06, 2 * P, 2 * P); ctx.fillRect(c.x + 0.03, c.y - 0.06, 2 * P, 2 * P);
    ctx.fillStyle = '#fff'; ctx.fillRect(c.x - 0.05, c.y + 0.07, P, 2 * P); ctx.fillRect(c.x + 0.03, c.y + 0.07, P, 2 * P);
  } else if (theme === 'forest') { // escarabajo que brilla
    glow(ctx, c.x, c.y, 0.8, '#bef264', 0.45);
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#e0f2fe';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c.x + s * 0.2, c.y - 0.2, 0.22, 0.1 + Math.abs(flap) * 0.06, s * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ink(ctx, circle(ctx, c.x, c.y, 0.25), ball(ctx, c.x, c.y, 0.25, '#65a30d'));
    ctx.fillStyle = '#bef264'; ctx.fillRect(c.x - 0.02, c.y - 0.2, P * 1.5, 0.4);
  } else { // dron
    ctx.fillStyle = 'rgba(203,213,225,0.7)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c.x + s * 0.35, c.y - 0.32, 0.22 * Math.abs(flap) + P, P * 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
    limb(ctx, [[c.x - 0.35, c.y - 0.3], [c.x + 0.35, c.y - 0.3]], '#64748b', P * 1.5);
    ink(ctx, () => ctx.roundRect(c.x - 0.3, c.y - 0.2, 0.6, 0.38, 0.1), lin(ctx, 0, c.y - 0.2, 0, c.y + 0.18, [[0, '#64748b'], [1, '#1e293b']]));
    ink(ctx, circle(ctx, c.x - 0.08, c.y, 0.1), ball(ctx, c.x - 0.08, c.y, 0.1, '#ef4444'), 1);
    glow(ctx, c.x - 0.08, c.y, 0.25, '#ef4444', 0.5);
  }
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, game: Game, t: Theme) {
  const time = game.time, theme = game.def.theme;
  switch (h.kind) {
    case 'spikes': spikes(ctx, h, t); break;
    case 'laser': {
      const color = h.id % 2 ? t.laser : t.laser2, x = h.x + h.w / 2;
      const ends = h.len >= FLOOR - CEIL - 0.01 ? [CEIL, FLOOR] : [h.side === 1 ? FLOOR : CEIL];
      const on = laserOn(game, h);
      if (on) {
        const flicker = 0.85 + 0.15 * Math.sin(time * 70);
        ctx.fillStyle = lin(ctx, x - 0.45, 0, x + 0.45, 0, [[0, 'rgba(0,0,0,0)'], [0.5, color], [1, 'rgba(0,0,0,0)']]);
        ctx.globalAlpha = 0.45 * flicker; ctx.fillRect(x - 0.45, h.y, 0.9, h.h);
        ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.fillRect(x - P * 3, h.y, P * 6, h.h);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - P, h.y, P * 2, h.h);
        for (const ey of [h.y, h.y + h.h]) { // chispas donde pega
          glow(ctx, x, ey, 0.45, '#ffffff', 0.6);
          ctx.fillStyle = '#fef9c3'; for (let k = 0; k < 3; k++) { const a = time * 30 + k * 2.1; ctx.fillRect(x + Math.cos(a) * 0.2, ey + Math.sin(a) * 0.1, 2 * P, 2 * P); }
        }
      } else if (laserWarn(game, h) && Math.sin(time * 50) > 0) {
        ctx.fillStyle = color; ctx.globalAlpha = 0.6; ctx.fillRect(x - P / 2, h.y, P, h.h); ctx.globalAlpha = 1;
      }
      for (const e of ends) { // los emisores: caja de metal con rejilla y lente
        const floorEnd = e === FLOOR, ey = floorEnd ? FLOOR - 0.34 : CEIL;
        ink(ctx, () => ctx.rect(x - 0.3, ey, 0.6, 0.34), lin(ctx, x - 0.3, 0, x + 0.3, 0, [[0, '#64748b'], [0.5, '#475569'], [1, '#1e293b']]), 1.5);
        ctx.fillStyle = '#0f172a'; for (let k = 0; k < 3; k++) ctx.fillRect(x - 0.22 + k * 0.17, floorEnd ? ey + 0.2 : ey + 0.04, 0.1, P * 2);
        const ly = floorEnd ? ey : ey + 0.34;
        ink(ctx, () => ctx.ellipse(x, ly, 0.13, 0.06, 0, 0, Math.PI * 2), on ? color : '#1e293b', 1);
        if (on) glow(ctx, x, ly, 0.3, color, 0.8);
      }
      break;
    }
    case 'mine': { const c = mineCenter(game, h); spikyBall(ctx, c.x, c.y, h.r, time * 0.8, '#374151', '#ef4444', time); break; }
    case 'saw': { const c = sawCenter(game, h); saw(ctx, c.x, c.y, h.r, time * 9 * (h.id % 2 ? 1 : -1), theme === 'ice'); break; }
    case 'proxMine': {
      const armed = h.state === 1, blink = armed ? Math.sin(time * 40) > 0 : Math.sin(time * 4) > 0.7;
      if (armed) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = P * 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(h.x, h.y, 1.8 * (1 - h.timer / 0.55), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      spikyBall(ctx, h.x, h.y, h.r, 0, '#b45309', blink ? '#f87171' : '#7f1d1d', time);
      break;
    }
    case 'asteroid': {
      if (!h.active) break;
      for (let k = 1; k < 6; k++) { ctx.globalAlpha = 0.35 / k; ctx.fillStyle = k < 3 ? '#fdba74' : '#78716c'; ctx.beginPath(); ctx.arc(h.x + k * 0.3, h.y + Math.sin(time * 9 + k) * 0.04, h.r * (1 - k * 0.13), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      const a = time * h.speed;
      ink(ctx, () => { for (let k = 0; k < 11; k++) { const ang = a + k * Math.PI * 2 / 11, rr = h.r * (0.8 + hash(h.id * 11 + k) * 0.28); ctx.lineTo(h.x + Math.cos(ang) * rr, h.y + Math.sin(ang) * rr); } ctx.closePath(); }, ball(ctx, h.x, h.y, h.r, '#8a6a58'));
      for (let k = 0; k < 4; k++) { // cráteres con sombra y borde iluminado
        const ang = a + k * 1.7, cx = h.x + Math.cos(ang) * h.r * 0.45, cy = h.y + Math.sin(ang) * h.r * 0.45, cr = h.r * (0.12 + hash(k + h.id) * 0.1);
        ctx.fillStyle = '#4a3328'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,237,213,0.45)'; ctx.lineWidth = P; ctx.beginPath(); ctx.arc(cx, cy, cr, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
      }
      break;
    }
    case 'turret': case 'tracker': {
      const gx = h.x + h.w / 2, gy = h.side === 1 ? h.y + 0.25 : h.y + h.h - 0.25;
      const aim = h.kind === 'tracker' ? h.aim : Math.PI;
      if (h.kind === 'tracker' && h.timer < 1.1 && h.x > game.cam + 1) { // la mira láser que apunta al astronauta
        ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = P; ctx.globalAlpha = h.timer < 0.25 ? 0.9 : 0.45; ctx.setLineDash([4 * P, 3 * P]);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(aim) * 14, gy + Math.sin(aim) * 14); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(aim); // cañón cilíndrico
      ink(ctx, () => ctx.rect(0, -0.09, 0.62, 0.18), lin(ctx, 0, -0.09, 0, 0.09, [[0, '#e5e7eb'], [0.4, '#9ca3af'], [1, '#374151']]), 1.5);
      ink(ctx, () => ctx.rect(0.5, -0.12, 0.14, 0.24), '#1f2937', 1);
      ctx.restore();
      ink(ctx, circle(ctx, gx, gy, 0.28), ball(ctx, gx, gy, 0.28, h.kind === 'tracker' ? '#be123c' : '#b45309'), 1.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = P; ctx.beginPath(); ctx.arc(gx, gy, 0.2, 0, Math.PI * 2); ctx.stroke();
      const hot = h.timer < 0.3;
      ctx.fillStyle = hot ? '#fde047' : '#1f2937'; ctx.beginPath(); ctx.arc(gx, gy, 0.09, 0, Math.PI * 2); ctx.fill();
      if (hot) glow(ctx, gx + Math.cos(aim) * 0.62, gy + Math.sin(aim) * 0.62, 0.45, '#fde047', 0.8);
      break;
    }
    case 'press': {
      // Cabeza de acero con franjas de peligro y el pistón cromado que la empuja. Guardada, apenas asoma (y tiembla antes de bajar).
      const { shake } = pressState(game, h), dx = shake ? Math.sin(time * 80) * 0.04 : 0;
      const head = 0.5, ext = Math.max(0.12, pressRect(game, h).h);
      const y = h.side === 1 ? FLOOR - ext : CEIL + ext - head;
      if (ext > head) {
        const px = h.x + h.w / 2 - 0.2 + dx, py = h.side === 1 ? y + head : CEIL;
        ink(ctx, () => ctx.rect(px, py, 0.4, ext - head), lin(ctx, px, 0, px + 0.4, 0, [[0, '#94a3b8'], [0.3, '#f8fafc'], [0.6, '#cbd5e1'], [1, '#475569']]), 1.5);
      }
      ink(ctx, () => ctx.rect(h.x + dx, y, h.w, head), lin(ctx, 0, y, 0, y + head, [[0, '#fde047'], [1, '#ca8a04']]));
      ctx.save(); ctx.beginPath(); ctx.rect(h.x + dx, y, h.w, head); ctx.clip(); ctx.fillStyle = INK;
      for (let k = -1; k < h.w + 1; k += 0.4) { ctx.beginPath(); ctx.moveTo(h.x + dx + k, y + head); ctx.lineTo(h.x + dx + k + 0.2, y + head); ctx.lineTo(h.x + dx + k + 0.2 + head, y); ctx.lineTo(h.x + dx + k + head, y); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(h.x + dx, y, h.w, P * 2);
      ctx.restore();
      ctx.fillStyle = '#9ca3af'; for (const bx of [0.08, h.w - 0.14]) ctx.fillRect(h.x + dx + bx, y + 0.06, 2 * P, 2 * P);
      break;
    }
    case 'icicle': {
      const down = h.side === -1, root = down ? h.y : h.y + h.h, tipY = down ? h.y + h.h : h.y;
      ink(ctx, () => { ctx.moveTo(h.x, root); ctx.lineTo(h.x + h.w, root); ctx.lineTo(h.x + h.w / 2, tipY); ctx.closePath(); },
        lin(ctx, h.x, 0, h.x + h.w, 0, [[0, 'rgba(240,249,255,0.95)'], [0.45, 'rgba(186,230,253,0.85)'], [1, 'rgba(96,165,250,0.85)']]), 1.5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(h.x + h.w * 0.3, h.y + (down ? 0.05 : h.h * 0.5), P * 2, h.h * 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(h.x + h.w / 2 - P, down ? tipY - 0.12 : tipY + 0.05, P, 0.07);
      break;
    }
    case 'walker': walker(ctx, h, game); break;
    case 'flyer': flyer(ctx, h, game); break;
    case 'fireball': {
      if (!h.active) break;
      for (let k = 1; k < 6; k++) { ctx.globalAlpha = 0.55 / k; ctx.fillStyle = k < 3 ? '#fb923c' : '#7c2d12'; ctx.beginPath(); ctx.arc(h.x + Math.sin(time * 20 + k) * 0.06, h.y + k * 0.22, h.r * (1 - k * 0.14), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      glow(ctx, h.x, h.y, 1, '#fb923c', 0.65);
      ctx.fillStyle = '#f97316'; // lenguas de fuego
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5, l = h.r * (1.3 + Math.sin(time * 25 + k) * 0.3); ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a - 0.3) * h.r * 0.8, h.y + Math.sin(a - 0.3) * h.r * 0.8); ctx.lineTo(h.x + Math.cos(a) * l, h.y + Math.sin(a) * l); ctx.lineTo(h.x + Math.cos(a + 0.3) * h.r * 0.8, h.y + Math.sin(a + 0.3) * h.r * 0.8); ctx.fill(); }
      ink(ctx, circle(ctx, h.x, h.y, h.r), ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r), 1.5);
      const core = ctx.createRadialGradient(h.x - 0.05, h.y - 0.05, 0, h.x, h.y, h.r);
      core.addColorStop(0, '#fffbeb'); core.addColorStop(0.35, '#fde047'); core.addColorStop(0.75, '#f97316'); core.addColorStop(1, '#b91c1c');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'geyser': {
      const gh = geyserHeight(game, h), cx = h.x + h.w / 2;
      if (gh > 0) {
        glow(ctx, cx, FLOOR - gh / 2, gh * 0.6, '#f97316', 0.45);
        ink(ctx, () => { ctx.moveTo(h.x, FLOOR); for (let y = 0; y <= gh; y += 0.25) ctx.lineTo(h.x + Math.sin(time * 15 + y * 3) * 0.08, FLOOR - y); ctx.lineTo(h.x + h.w, FLOOR - gh); for (let y = gh; y >= 0; y -= 0.25) ctx.lineTo(h.x + h.w + Math.sin(time * 13 + y * 3) * 0.08, FLOOR - y); ctx.closePath(); },
          lin(ctx, h.x, 0, h.x + h.w, 0, [[0, '#b91c1c'], [0.3, '#f97316'], [0.5, '#fde047'], [0.7, '#f97316'], [1, '#b91c1c']]));
        ctx.fillStyle = '#fffbeb'; ctx.fillRect(cx - 0.05, FLOOR - gh, 0.1, gh);
        ctx.fillStyle = '#fde047'; for (let k = 0; k < 4; k++) { const d = (time * 2 + k * 0.25) % 1; ctx.beginPath(); ctx.arc(cx + Math.sin(k * 3 + time) * 0.4, FLOOR - gh - d * 0.6, 0.06 * (1 - d) + 0.02, 0, Math.PI * 2); ctx.fill(); } // gotas
      } else if (geyserWarn(game, h)) {
        ctx.fillStyle = '#fb923c';
        for (let k = 0; k < 4; k++) { const by = FLOOR - ((time * 3 + k * 0.3) % 1.2); ctx.beginPath(); ctx.arc(cx + Math.sin(k * 2 + time * 5) * 0.25, by, 0.07 + k * 0.02, 0, Math.PI * 2); ctx.fill(); }
        glow(ctx, cx, FLOOR, 0.6, '#f97316', 0.5);
      }
      ink(ctx, () => { ctx.moveTo(h.x - 0.15, FLOOR); ctx.lineTo(h.x, FLOOR - 0.2); ctx.lineTo(h.x + h.w, FLOOR - 0.2); ctx.lineTo(h.x + h.w + 0.15, FLOOR); ctx.closePath(); }, lin(ctx, 0, FLOOR - 0.2, 0, FLOOR, [[0, '#57534e'], [1, '#292524']]), 1.5);
      ctx.fillStyle = '#f97316'; ctx.fillRect(h.x + 0.1, FLOOR - 0.2, h.w - 0.2, P * 2);
      break;
    }
    case 'pendulum': {
      const ball2 = pendulumBall(game, h), links = Math.ceil(h.len / 0.18);
      for (let k = 0; k < links; k++) { // eslabones
        const f = k / links, lx = h.x + (ball2.x - h.x) * f, ly = h.y + (ball2.y - h.y) * f;
        ctx.strokeStyle = k % 2 ? '#9ca3af' : '#6b7280'; ctx.lineWidth = P * 1.5;
        ctx.beginPath(); ctx.ellipse(lx, ly, k % 2 ? 0.05 : 0.025, 0.09, ball2.angle, 0, Math.PI * 2); ctx.stroke();
      }
      ink(ctx, circle(ctx, h.x, h.y, 0.14), ball(ctx, h.x, h.y, 0.14, '#64748b'), 1.5);
      spikyBall(ctx, ball2.x, ball2.y, h.r, ball2.angle, '#4b5563', null, time);
      break;
    }
    case 'flipper': {
      const pulse = 0.6 + 0.4 * Math.sin(time * 6), color = h.side === 1 ? '#22d3ee' : '#f472b6';
      ink(ctx, () => ctx.rect(h.x, h.y, h.w, h.h), lin(ctx, 0, h.y, 0, h.y + h.h, [[0, '#334155'], [1, '#0f172a']]), 1.5);
      ctx.fillStyle = color; ctx.globalAlpha = pulse; ctx.fillRect(h.x + 0.1, h.side === 1 ? h.y + P : h.y + h.h - 2 * P, h.w - 0.2, P); ctx.globalAlpha = 1;
      glow(ctx, h.x + h.w / 2, h.y + h.h / 2, 0.9, color, 0.4 * pulse);
      const tip = h.side === 1 ? h.y - 0.75 : h.y + h.h + 0.75, base = h.side === 1 ? h.y - 0.05 : h.y + h.h + 0.05;
      ctx.globalAlpha = pulse;
      ink(ctx, () => { ctx.moveTo(h.x + 0.2, base); ctx.lineTo(h.x + 0.2, (base + tip) / 2); ctx.lineTo(h.x + 0.05, (base + tip) / 2); ctx.lineTo(h.x + 0.5, tip); ctx.lineTo(h.x + 0.95, (base + tip) / 2); ctx.lineTo(h.x + 0.8, (base + tip) / 2); ctx.lineTo(h.x + 0.8, base); ctx.closePath(); }, color, 1.5);
      ctx.globalAlpha = 1;
      break;
    }
    case 'conveyor': {
      ink(ctx, () => ctx.rect(h.x, h.y, h.w, h.h), '#1f2937', 1.5);
      ctx.save(); ctx.beginPath(); ctx.rect(h.x, h.y, h.w, h.h); ctx.clip();
      ctx.fillStyle = '#facc15';
      const off = ((time * h.push) % 0.5 + 0.5) % 0.5;
      for (let k = -0.5; k < h.w + 0.5; k += 0.5) { ctx.beginPath(); ctx.moveTo(h.x + k + off, h.y + h.h); ctx.lineTo(h.x + k + off + 0.15, h.y + h.h); ctx.lineTo(h.x + k + off + 0.3, h.y); ctx.lineTo(h.x + k + off + 0.15, h.y); ctx.fill(); }
      ctx.restore();
      for (let k = 0.25; k < h.w; k += 1) ink(ctx, circle(ctx, h.x + k, h.y + h.h / 2, 0.08), ball(ctx, h.x + k, h.y + h.h / 2, 0.08, '#9ca3af'), 1);
      break;
    }
    case 'spring': { // hongo que rebota
      ctx.save(); ctx.translate(h.x + h.w / 2, h.side === 1 ? FLOOR : CEIL);
      if (h.side === -1) ctx.scale(1, -1);
      const sq = 1 + Math.sin(time * 5 + h.id) * 0.05;
      ink(ctx, () => ctx.rect(-0.12, -0.3, 0.24, 0.3), lin(ctx, -0.12, 0, 0.12, 0, [[0, '#fffbeb'], [1, '#d6c7a1']]), 1.5);
      ink(ctx, () => { ctx.ellipse(0, -0.3, 0.5 * sq, 0.3 / sq, 0, Math.PI, Math.PI * 2); ctx.closePath(); }, ball(ctx, 0, -0.45, 0.5, '#ec4899'));
      ctx.fillStyle = '#fdf2f8'; ctx.fillRect(-0.25, -0.45, 3 * P, 3 * P); ctx.fillRect(0.12, -0.5, 3 * P, 3 * P); ctx.fillRect(-0.05, -0.55, 2 * P, 2 * P);
      glow(ctx, 0, -0.35, 0.8, '#f472b6', 0.35);
      ctx.restore();
      break;
    }
    case 'spores': {
      const c = sporeCenter(game, h);
      glow(ctx, c.x, c.y, h.r * 2.8, '#a3e635', 0.5 + 0.2 * Math.sin(time * 5 + h.id));
      ink(ctx, circle(ctx, c.x, c.y, h.r), ball(ctx, c.x, c.y, h.r, '#84cc16'), 1.5);
      ctx.fillStyle = '#365314'; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + time; ctx.fillRect(c.x + Math.cos(a) * h.r * 1.1, c.y + Math.sin(a) * h.r * 1.1, P * 1.5, P * 1.5); }
      ctx.fillStyle = '#ecfccb'; ctx.fillRect(c.x - 0.08, c.y - 0.08, 2 * P, 2 * P);
      break;
    }
    case 'waterfall': {
      ctx.fillStyle = lin(ctx, h.x, 0, h.x + h.w, 0, [[0, 'rgba(34,211,238,0.15)'], [0.5, 'rgba(165,243,252,0.35)'], [1, 'rgba(34,211,238,0.15)']]); ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#a5f3fc';
      for (let k = 0.15; k < h.w; k += 0.3) { const off = (time * 6 + hash(k * 9) * 3) % 1.5; for (let y = h.y - 1.5 + off; y < h.y + h.h; y += 1.5) ctx.fillRect(h.x + k, Math.max(h.y, y), P * 2, 0.6); }
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ecfeff';
      for (let k = 0; k < h.w; k += 0.25) { ctx.beginPath(); ctx.arc(h.x + k + 0.1, FLOOR - 0.1 - Math.abs(Math.sin(time * 8 + k * 5)) * 0.15, 0.08, 0, Math.PI * 2); ctx.fill(); } // espuma
      ctx.globalAlpha = 1;
      break;
    }
    case 'plant': {
      ctx.save(); ctx.translate(h.x + h.w / 2, h.side === 1 ? FLOOR : CEIL);
      if (h.side === -1) ctx.scale(1, -1);
      const bite = plantBite(game, h), height = bite ? 1.35 : 0.45, open = bite ? 0.45 + Math.sin(time * 20) * 0.15 : 0.12;
      limb(ctx, [[0, 0], [Math.sin(time * 2) * 0.04, -height / 2], [Math.sin(time * 2) * 0.08, -height]], '#16a34a', P * 3);
      for (const s of [-1, 1]) ink(ctx, () => { ctx.ellipse(s * 0.18, -0.08, 0.2, 0.07, s * 0.4, 0, Math.PI * 2); }, lin(ctx, 0, -0.15, 0, 0, [[0, '#4ade80'], [1, '#15803d']]), 1);
      ctx.translate(Math.sin(time * 2) * 0.08, -height);
      const jaw = ball(ctx, 0, 0, 0.32, '#dc2626');
      ink(ctx, () => { ctx.arc(0, 0, 0.3, Math.PI + open, Math.PI * 2 - open); ctx.lineTo(0, 0); ctx.closePath(); }, jaw);
      ink(ctx, () => { ctx.arc(0, 0, 0.3, open, Math.PI - open); ctx.lineTo(0, 0); ctx.closePath(); }, jaw);
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) for (let k = -0.15; k <= 0.15; k += 0.15) { ctx.beginPath(); ctx.moveTo(k - 0.04, s * Math.sin(open) * 0.08); ctx.lineTo(k + 0.04, s * Math.sin(open) * 0.08); ctx.lineTo(k, s * (Math.sin(open) * 0.08 - 0.1)); ctx.fill(); }
      ctx.fillStyle = '#fef08a'; ctx.fillRect(-0.18, -0.25, 2 * P, 2 * P); ctx.fillRect(0.1, 0.18, 2 * P, 2 * P);
      ctx.restore();
      break;
    }
    case 'lightning': {
      const state = lightningState(game, h), cx = h.x + h.w / 2;
      if (state === 'warn' && Math.sin(time * 30) > -0.2) {
        ctx.fillStyle = 'rgba(196,181,253,0.22)'; ctx.fillRect(h.x + 0.2, CEIL, h.w - 0.4, FLOOR - CEIL);
        glow(ctx, cx, CEIL, 1, '#c4b5fd', 0.6);
      }
      if (state === 'strike') {
        glow(ctx, cx, (CEIL + FLOOR) / 2, 3, '#e0e7ff', 0.5);
        for (const [color, width] of [['#7c3aed', 10 * P], ['#a78bfa', 6 * P], ['#ffffff', 2.5 * P]] as const) {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(cx, CEIL);
          for (let y = CEIL; y < FLOOR; y += 0.5) ctx.lineTo(cx + (hash(Math.floor(time * 20) + y) - 0.5) * 0.7, y);
          ctx.lineTo(cx, FLOOR); ctx.stroke();
        }
        glow(ctx, cx, FLOOR, 0.8, '#ffffff', 0.7);
      }
      break;
    }
    case 'meteor': {
      if (!h.active) break;
      const pulse = Math.sin(time * 20) > 0;
      ctx.strokeStyle = pulse ? '#ef4444' : '#fca5a5'; ctx.lineWidth = 2 * P; // la marca de dónde va a caer
      ctx.beginPath(); ctx.moveTo(h.x0 - 0.3, FLOOR - 0.35); ctx.lineTo(h.x0 + 0.3, FLOOR - 0.05); ctx.moveTo(h.x0 + 0.3, FLOOR - 0.35); ctx.lineTo(h.x0 - 0.3, FLOOR - 0.05); ctx.stroke();
      for (let j = 1; j < 7; j++) { ctx.globalAlpha = 0.5 / j; ctx.fillStyle = j < 3 ? '#fde047' : j < 5 ? '#fb923c' : '#78716c'; ctx.beginPath(); ctx.arc(h.x + j * 0.25, h.y - j * 0.55, h.r * (1 - j * 0.11), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      glow(ctx, h.x, h.y, 1.1, '#f97316', 0.55);
      ink(ctx, circle(ctx, h.x, h.y, h.r), ball(ctx, h.x, h.y, h.r, '#92400e'));
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(h.x + 0.12, h.y - 0.15, h.r * 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ufo': {
      if (!h.active) break;
      const { x, y } = h;
      ctx.fillStyle = lin(ctx, 0, y, 0, FLOOR, [[0, 'rgba(74,222,128,0.35)'], [1, 'rgba(74,222,128,0)']]); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 6);
      ctx.beginPath(); ctx.moveTo(x - 0.5, y + 0.2); ctx.lineTo(x + 0.5, y + 0.2); ctx.lineTo(x + 1.3, FLOOR); ctx.lineTo(x - 1.3, FLOOR); ctx.fill(); ctx.globalAlpha = 1;
      ink(ctx, () => ctx.ellipse(x, y - 0.18, 0.5, 0.45, 0, Math.PI, Math.PI * 2), lin(ctx, x - 0.5, y - 0.6, x + 0.5, y, [[0, 'rgba(207,250,254,0.95)'], [1, 'rgba(34,211,238,0.6)']]));
      ink(ctx, circle(ctx, x, y - 0.25, 0.18), ball(ctx, x, y - 0.25, 0.18, '#84cc16'), 1);
      ctx.fillStyle = INK; ctx.fillRect(x - 0.1, y - 0.3, 2 * P, 2 * P); ctx.fillRect(x + 0.04, y - 0.3, 2 * P, 2 * P);
      ink(ctx, () => ctx.ellipse(x, y, h.w / 2 + 0.2, 0.3, 0, 0, Math.PI * 2), lin(ctx, 0, y - 0.3, 0, y + 0.3, [[0, '#e5e7eb'], [0.5, '#9ca3af'], [1, '#4b5563']]));
      for (let k = -2; k <= 2; k++) { const c = Math.sin(time * 10 + k) > 0 ? '#fde047' : '#f43f5e'; glow(ctx, x + k * 0.4, y + 0.05, 0.15, c, 0.7); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + k * 0.4, y + 0.05, 0.06, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'bomb': {
      // Un aparato explosivo: tres cartuchos rojos atados con cinta, una caja negra con la pantallita que cuenta
      // 3, 2, 1 (en verde "--" mientras espera), cables de colores y una luz que titila cada vez más rápido.
      const count = bombCount(game, h), { x, y } = h;
      const blink = count ? Math.sin(time * (count === 1 ? 40 : count === 2 ? 22 : 12)) > 0 : Math.sin(time * 3) > 0.6;
      if (count) glow(ctx, x, y, 1 + (3 - count) * 0.35, '#ef4444', 0.18 + 0.12 * (3 - count) + (blink ? 0.1 : 0));
      ctx.save(); ctx.translate(x, y);
      if (count === 1) ctx.translate((hash(Math.floor(time * 30)) - 0.5) * 0.05, (hash(Math.floor(time * 30) + 7) - 0.5) * 0.05); // tiembla
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0.37, 0.5, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 3; k++) { // los cartuchos
        const sx = -0.36 + k * 0.24;
        ink(ctx, () => ctx.roundRect(sx, -0.33, 0.22, 0.68, 0.06), lin(ctx, sx, 0, sx + 0.22, 0, [[0, '#f87171'], [0.35, '#dc2626'], [1, '#7f1d1d']]), 1.5);
        ctx.fillStyle = '#fca5a5'; ctx.fillRect(sx + 0.04, -0.3, P * 1.5, 0.6);
        ctx.fillStyle = '#44403c'; ctx.fillRect(sx + 0.08, -0.4, 0.06, 0.08); // la puntita de la mecha
      }
      for (const ty of [-0.2, 0.2]) { ink(ctx, () => ctx.rect(-0.4, ty - 0.04, 0.8, 0.08), lin(ctx, 0, ty - 0.04, 0, ty + 0.04, [[0, '#a8a29e'], [1, '#57534e']]), 1); } // cinta
      // Cables.
      const wires: [string, number][] = [['#ef4444', -0.28], ['#3b82f6', 0], ['#facc15', 0.26]];
      ctx.lineWidth = 2 * P; ctx.lineCap = 'round';
      for (const [color, wx] of wires) { ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(wx, -0.36); ctx.bezierCurveTo(wx + 0.15, -0.6, wx * 0.3 + 0.1, -0.5, wx * 0.3, -0.14); ctx.stroke(); }
      // La caja con la pantalla.
      ink(ctx, () => ctx.roundRect(-0.3, -0.16, 0.6, 0.34, 0.05), lin(ctx, 0, -0.16, 0, 0.18, [[0, '#374151'], [1, '#0b0f17']]), 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-0.27, -0.14, 0.54, P);
      for (const bx of [-0.26, 0.24]) { ctx.fillStyle = '#9ca3af'; ctx.fillRect(bx, -0.13, 2 * P, 2 * P); ctx.fillRect(bx, 0.12, 2 * P, 2 * P); } // tornillos
      const screen = count ? '#1a0505' : '#03140a';
      ink(ctx, () => ctx.rect(-0.21, -0.11, 0.42, 0.22), screen, 1);
      const digit = count ? String(count) : '--', color = count ? '#ff3b3b' : '#22c55e';
      glow(ctx, 0, 0, 0.32, color, count ? 0.6 : 0.25);
      ctx.fillStyle = count ? 'rgba(255,59,59,0.15)' : 'rgba(34,197,94,0.12)'; ctx.font = `bold 0.2px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('88', 0, 0.01); // los segmentos apagados de la pantalla
      ctx.fillStyle = color; ctx.fillText(count ? `0${digit}` : digit, 0, 0.01);
      // La luz de arriba.
      ink(ctx, circle(ctx, 0.22, -0.2, 0.05), blink ? (count ? '#fecaca' : '#bbf7d0') : (count ? '#7f1d1d' : '#14532d'), 1);
      if (blink) glow(ctx, 0.22, -0.2, 0.25, count ? '#ef4444' : '#22c55e', 0.8);
      // Cuando está por explotar, se pone al rojo.
      if (count === 1) { ctx.globalAlpha = 0.2 + 0.2 * Math.sin(time * 40); ctx.fillStyle = '#ef4444'; ctx.fillRect(-0.42, -0.36, 0.84, 0.74); ctx.globalAlpha = 1; }
      ctx.restore();
      break;
    }
    case 'door': {
      // Dos paneles metálicos (uno del techo, otro del piso) que se cierran casi siempre, con luces a los costados.
      const ext = doorOpen(game, h), gap = (FLOOR - CEIL) * ext, mid = (FLOOR + CEIL) / 2, half = gap / 2;
      const closing = ext < 0.05, redLight = Math.sin(time * (closing ? 4 : 10)) > 0;
      const panel = (y0: number, y1: number) => {
        if (y1 <= y0) return;
        ink(ctx, () => ctx.rect(h.x, y0, h.w, y1 - y0), lin(ctx, h.x, 0, h.x + h.w, 0, [[0, '#94a3b8'], [0.5, '#e2e8f0'], [1, '#64748b']]), 1.5);
        ctx.fillStyle = 'rgba(15,23,42,0.4)';
        for (let yy = y0 + 0.15; yy < y1 - 0.1; yy += 0.3) ctx.fillRect(h.x + 0.08, yy, h.w - 0.16, 2 * P);
        ctx.fillStyle = redLight ? '#f87171' : '#7f1d1d'; ctx.fillRect(h.x + h.w / 2 - 0.05, y1 > y0 + 0.3 ? y0 + 0.1 : y0, 0.1, 0.1);
      };
      panel(CEIL, mid - half);
      panel(mid + half, FLOOR);
      // Marco a los costados.
      ink(ctx, () => ctx.rect(h.x - 0.08, CEIL, 0.1, FLOOR - CEIL), '#334155', 1);
      ink(ctx, () => ctx.rect(h.x + h.w - 0.02, CEIL, 0.1, FLOOR - CEIL), '#334155', 1);
      if (gap > 0.1) { glow(ctx, h.x + h.w / 2, mid, gap * 0.6, '#38bdf8', 0.25); } // brillo del hueco abierto
      break;
    }
    case 'monster': monster(ctx, h, game); break;
    case 'worm': worm(ctx, h, game); break;
    case 'comet': comet(ctx, h, game); break;
    case 'sweeper': sweeper(ctx, h, game, t); break;
    case 'scanner': scanner(ctx, h, game, t); break;
    case 'blackhole': blackhole(ctx, h, game); break;
  }
}

// ---------- Monstruos, cometas, lásers nuevos y agujeros negros ----------

// Monstruo del espacio: un pez abisal verde con la boca enorme llena de colmillos (en gravityBackdrops). Mira para
// donde va (o hacia el astronauta si todavía está quieto), se inclina un poco y abre y cierra la boca.
function monster(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const t = game.time + h.id, angry = h.state === 1, p = game.player;
  const dir = angry ? h.aim : Math.atan2(p.y + PLAYER_H / 2 - h.y, p.x + PLAYER_W / 2 - h.x);
  const left = Math.cos(dir) < 0, tilt = Math.max(-0.45, Math.min(0.45, Math.atan2(Math.sin(dir), Math.abs(Math.cos(dir))) * (left ? -1 : 1) * 0.7));
  const open = angry ? 0.45 + 0.4 * Math.abs(Math.sin(t * 4)) : 0.15 + 0.08 * Math.sin(t * 1.5);
  if (angry) glow(ctx, h.x, h.y, 1.6, '#34d399', 0.15);
  drawAngler(ctx, h.x, h.y + Math.sin(t * 2) * 0.03, 0.72, left, tilt, open, angry, game.time, h.id);
}

// Gusano espacial que sale del piso o del techo: un bicho de carne con anillos marcados (cada uno con volumen,
// manchas, venitas y pelitos), brillo de baba, y una boca redonda como de lamprea: pétalos de carne que se
// abren, dos anillos de dientes ganchudos y la garganta oscura. Al salir levanta tierra y piedras.
function worm(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const wh = wormHeight(game, h), warn = wormWarn(game, h), time = game.time, id = h.id;
  const SKIN = '#b8687a', DEEP = '#5c2233', LIGHT = '#f2b8c2';
  ctx.save();
  ctx.translate(h.x + h.w / 2, h.side === 1 ? FLOOR : CEIL);
  if (h.side === -1) ctx.scale(1, -1); // del techo crece para abajo
  // Antes de salir (y mientras está afuera): el suelo se agrieta, tiembla y saltan piedras y polvo.
  if (warn || wh > 0) {
    const shake = warn ? Math.sin(time * 50) * 0.02 : 0;
    ctx.strokeStyle = INK; ctx.lineWidth = 2 * P;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(shake, 0); ctx.lineTo(s * 0.35, 0.1); ctx.lineTo(s * 0.6, 0.06); ctx.lineTo(s * 0.85, 0.18); ctx.moveTo(s * 0.5, 0.08); ctx.lineTo(s * 0.62, 0.22); ctx.stroke(); }
    for (let k = 0; k < 7; k++) {
      const jump = Math.abs(Math.sin(time * (warn ? 14 : 6) + k * 1.9)) * (warn ? 0.45 : 0.25), px = -0.6 + k * 0.2 + Math.sin(k * 3) * 0.05, r = 0.035 + hash(k + id) * 0.04;
      ctx.fillStyle = ball(ctx, px, -0.05 - jump, r, k % 2 ? '#78716c' : '#a8a29e'); ctx.beginPath(); ctx.arc(px, -0.05 - jump, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = warn ? 0.35 : 0.25; ctx.fillStyle = '#a8a29e';
    for (let k = 0; k < 5; k++) { const a = time * 0.8 + k; ctx.beginPath(); ctx.arc(Math.sin(a * 1.3 + k) * 0.5, -0.1 - (a % 1) * 0.3, 0.12 + (a % 1) * 0.15, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (wh > 0) {
    // La línea del medio del cuerpo, ondulando (más arriba se mueve más).
    const sway = (y: number) => Math.sin(time * 3.2 - y * 1.3 + id) * 0.14 * Math.min(1, y / 1.5) + Math.sin(time * 7 + y * 3) * 0.015;
    const width = (y: number) => 0.46 - Math.min(0.08, y * 0.015);
    const top = wh - 0.32, seg = 0.26;
    // El cuerpo entero primero (la silueta con borde), después cada anillo con su volumen.
    ctx.beginPath();
    for (let y = 0; y <= top; y += 0.1) ctx.lineTo(sway(y) - width(y), -y);
    for (let y = top; y >= 0; y -= 0.1) ctx.lineTo(sway(y) + width(y), -y);
    ctx.closePath(); ctx.lineWidth = 3 * P; ctx.strokeStyle = INK; ctx.stroke();
    for (let y = 0, i = 0; y < top; y += seg, i++) {
      const y1 = Math.min(top, y + seg), cx = sway((y + y1) / 2), w = width((y + y1) / 2);
      // Anillo: degradé de cilindro (luz arriba a la izquierda) y un borde hinchado.
      ctx.fillStyle = lin(ctx, cx - w, 0, cx + w, 0, [[0, darken(SKIN, 0.55)], [0.22, lighten(SKIN, 0.18)], [0.4, SKIN], [0.8, darken(SKIN, 0.35)], [1, darken(SKIN, 0.65)]]);
      ctx.beginPath(); ctx.moveTo(sway(y) - width(y), -y); ctx.lineTo(sway(y1) - width(y1), -y1); ctx.lineTo(sway(y1) + width(y1), -y1); ctx.lineTo(sway(y) + width(y), -y); ctx.closePath(); ctx.fill();
      // La juntura entre anillos: un surco oscuro curvo y el borde de arriba con brillo.
      ctx.strokeStyle = DEEP; ctx.lineWidth = 2 * P;
      ctx.beginPath(); ctx.ellipse(sway(y1), -y1, width(y1), 0.06, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,225,0.35)'; ctx.lineWidth = P;
      ctx.beginPath(); ctx.ellipse(sway(y1), -y1 + 0.035, width(y1) * 0.85, 0.05, 0, Math.PI * 0.15, Math.PI * 0.6); ctx.stroke();
      // Manchas, venitas y pelitos a los costados.
      ctx.fillStyle = 'rgba(92,34,51,0.45)';
      for (let k = 0; k < 3; k++) { const hx = cx + (hash(i * 7 + k + id) - 0.5) * w * 1.4, hy = -(y + seg * (0.25 + hash(i * 3 + k) * 0.5)); ctx.beginPath(); ctx.ellipse(hx, hy, 0.03 + hash(k + i) * 0.04, 0.02 + hash(k * 3 + i) * 0.02, 0, 0, Math.PI * 2); ctx.fill(); }
      if (i % 2 === 0) { ctx.strokeStyle = 'rgba(127,29,29,0.45)'; ctx.lineWidth = P * 0.8; ctx.beginPath(); ctx.moveTo(cx - w * 0.5, -y - 0.03); ctx.quadraticCurveTo(cx - w * 0.2, -y - seg * 0.6, cx + w * 0.1, -y - seg * 0.9); ctx.stroke(); }
      ctx.strokeStyle = '#3b1420'; ctx.lineWidth = P;
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const by = -(y + seg * (0.3 + k * 0.4)), bx = cx + s * w * 0.97; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + s * 0.07, by - 0.03 + Math.sin(time * 9 + i + k) * 0.015); ctx.stroke(); }
    }
    // Brillo de baba a lo largo del cuerpo.
    ctx.strokeStyle = 'rgba(255,240,245,0.5)'; ctx.lineWidth = 2 * P; ctx.lineCap = 'round';
    ctx.beginPath(); for (let y = 0.15; y <= top - 0.1; y += 0.1) ctx.lineTo(sway(y) - width(y) * 0.55, -y); ctx.stroke();
    // La cabeza: un collar hinchado y la boca redonda que se abre y se cierra.
    const hx = sway(top), hy = -top, open = 0.55 + 0.45 * Math.abs(Math.sin(time * 5 + id));
    ink(ctx, () => ctx.ellipse(hx, hy, 0.56, 0.2, 0, 0, Math.PI * 2), lin(ctx, hx - 0.56, 0, hx + 0.56, 0, [[0, darken(SKIN, 0.5)], [0.3, lighten(SKIN, 0.2)], [1, darken(SKIN, 0.6)]]), 2.5);
    // Pétalos de carne alrededor de la boca (se abren para afuera).
    for (let k = 0; k < 5; k++) {
      const a = Math.PI + (k + 0.5) / 5 * Math.PI, spread = 0.5 + open * 0.2, px = hx + Math.cos(a) * spread, py = hy - 0.12 + Math.sin(a) * spread * 0.45 - open * 0.08;
      ink(ctx, () => { ctx.moveTo(hx + Math.cos(a - 0.35) * 0.4, hy - 0.08 + Math.sin(a - 0.35) * 0.16); ctx.quadraticCurveTo(px + Math.cos(a) * 0.12, py - 0.05, hx + Math.cos(a + 0.35) * 0.4, hy - 0.08 + Math.sin(a + 0.35) * 0.16); ctx.closePath(); },
        lin(ctx, hx, hy, px, py, [[0, DEEP], [0.6, SKIN], [1, LIGHT]]), 1.5);
    }
    // La boca: la garganta oscura con dos anillos de dientes ganchudos.
    const mrx = 0.36 * (0.7 + open * 0.3), mry = 0.15 * (0.7 + open * 0.3), my = hy - 0.12;
    const throat = ctx.createRadialGradient(hx, my, 0, hx, my, mrx);
    throat.addColorStop(0, '#000000'); throat.addColorStop(0.5, '#2a0410'); throat.addColorStop(0.85, '#7f1d3a'); throat.addColorStop(1, '#c2416b');
    ink(ctx, () => ctx.ellipse(hx, my, mrx, mry, 0, 0, Math.PI * 2), throat, 2);
    for (const [ring, n, len] of [[1, 14, 0.09], [0.6, 10, 0.06]] as const) {
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + (ring < 1 ? 0.2 : 0), ox = hx + Math.cos(a) * mrx * ring, oy = my + Math.sin(a) * mry * ring, ix = hx + Math.cos(a) * mrx * (ring - len / mrx * 1.4), iy = my + Math.sin(a) * mry * (ring - len / mrx * 1.4);
        ctx.fillStyle = lin(ctx, ox, oy, ix, iy, [[0, '#fefce8'], [1, '#d6c99a']]);
        ctx.beginPath(); ctx.moveTo(ox + Math.sin(a) * 0.022, oy - Math.cos(a) * 0.012); ctx.quadraticCurveTo((ox + ix) / 2 + Math.sin(a) * 0.03, (oy + iy) / 2, ix, iy); ctx.lineTo(ox - Math.sin(a) * 0.022, oy + Math.cos(a) * 0.012); ctx.fill();
      }
    }
    // Hilos de baba y un brillito.
    ctx.strokeStyle = 'rgba(244,244,245,0.55)'; ctx.lineWidth = P;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * mrx * 0.6, my - mry * 0.5); ctx.quadraticCurveTo(hx + s * mrx * 0.4, my + 0.05, hx + s * mrx * 0.55, my + mry * 0.6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(hx - 0.3, hy - 0.02, 0.08, 0.025, -0.3, 0, Math.PI * 2); ctx.fill();
    // Gotas de baba que caen de la boca.
    for (let k = 0; k < 2; k++) { const d = (time * 1.3 + k * 0.5 + hash(id)) % 1; ctx.globalAlpha = 1 - d; ctx.fillStyle = 'rgba(217,249,157,0.85)'; ctx.beginPath(); ctx.arc(hx + (k ? 0.42 : -0.45), hy + d * 0.8, 0.03, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Cometa: antes de entrar se marca la entrada (parpadea) y el camino con puntitos; después cruza con la cola de fuego.
function comet(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const time = game.time, a = cometPath(h, 0), b = cometPath(h, 1), len = Math.hypot(b.x - a.x, b.y - a.y);
  const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
  if (h.state === 1) {
    const blink = Math.sin(time * 22) > 0;
    ctx.strokeStyle = blink ? '#fb923c' : '#fde047'; ctx.lineWidth = 2 * P; ctx.globalAlpha = 0.6;
    ctx.setLineDash([0.18, 0.22]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const ex = a.x + dx * 0.9, ey = a.y + dy * 0.9;
    glow(ctx, ex, ey, 0.9, '#f97316', blink ? 0.8 : 0.4);
    ink(ctx, () => { ctx.moveTo(ex, ey - 0.38); ctx.lineTo(ex + 0.34, ey + 0.26); ctx.lineTo(ex - 0.34, ey + 0.26); ctx.closePath(); }, blink ? '#fde047' : '#f97316', 1.5);
    ctx.fillStyle = INK; ctx.fillRect(ex - P, ey - 0.18, 2 * P, 0.24); ctx.fillRect(ex - P, ey + 0.11, 2 * P, 2 * P);
    return;
  }
  if (h.state !== 2) return;
  // La cola: del amarillo al rojo y al humo, para el lado de donde viene.
  for (let j = 12; j >= 1; j--) {
    const tx = h.x - dx * j * 0.24 + Math.sin(time * 30 + j) * 0.04, ty = h.y - dy * j * 0.24 + Math.cos(time * 27 + j) * 0.04;
    ctx.globalAlpha = 0.75 * (1 - j / 13);
    ctx.fillStyle = j < 3 ? '#fef08a' : j < 6 ? '#fb923c' : j < 9 ? '#ef4444' : '#57534e';
    ctx.beginPath(); ctx.arc(tx, ty, h.r * (1.05 - j * 0.06), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  glow(ctx, h.x, h.y, 1.6, '#f97316', 0.6);
  ink(ctx, circle(ctx, h.x, h.y, h.r), ball(ctx, h.x, h.y, h.r, '#7c2d12'));
  // Llamas que lo envuelven.
  for (let k = 0; k < 6; k++) {
    const fa = Math.atan2(-dy, -dx) + (k - 2.5) * 0.45, fl = h.r * (1.1 + 0.4 * Math.abs(Math.sin(time * 25 + k)));
    ctx.fillStyle = k % 2 ? '#fde047' : '#f97316';
    ctx.beginPath(); ctx.moveTo(h.x + Math.cos(fa - 0.5) * h.r * 0.8, h.y + Math.sin(fa - 0.5) * h.r * 0.8);
    ctx.lineTo(h.x + Math.cos(fa) * (h.r + fl), h.y + Math.sin(fa) * (h.r + fl)); ctx.lineTo(h.x + Math.cos(fa + 0.5) * h.r * 0.8, h.y + Math.sin(fa + 0.5) * h.r * 0.8); ctx.fill();
  }
  ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(h.x + dx * 0.1, h.y + dy * 0.1, h.r * 0.45, 0, Math.PI * 2); ctx.fill();
}

// Un rayo láser recto entre dos puntos (resplandor, rayo de color y centro blanco).
function beam(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, time: number) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 70);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.globalAlpha = 0.3 * flicker; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.lineWidth = 6 * P; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * P; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// Láser giratorio: un eje con luces y dos rayos que dan vueltas.
function sweeper(ctx: CanvasRenderingContext2D, h: Hazard, game: Game, t: Theme) {
  const a = sweeperAngle(game, h), c = Math.cos(a), s = Math.sin(a), color = h.id % 2 ? t.laser : t.laser2;
  beam(ctx, h.x - c * h.len, h.y - s * h.len, h.x + c * h.len, h.y + s * h.len, color, game.time);
  for (const k of [-1, 1]) glow(ctx, h.x + c * h.len * k, h.y + s * h.len * k, 0.35, '#ffffff', 0.6);
  ink(ctx, circle(ctx, h.x, h.y, 0.34), ball(ctx, h.x, h.y, 0.34, '#64748b'));
  ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(h.x, h.y, 0.2, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 4; k++) { const la = a * 2 + k * Math.PI / 2; ctx.fillStyle = k % 2 ? color : '#fde047'; ctx.fillRect(h.x + Math.cos(la) * 0.26 - P, h.y + Math.sin(la) * 0.26 - P, 2 * P, 2 * P); }
  glow(ctx, h.x, h.y, 0.5, color, 0.7);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(h.x, h.y, 0.1, 0, Math.PI * 2); ctx.fill();
}

// Láser acostado que sube y baja: dos rieles y un emisor en cada uno.
function scanner(ctx: CanvasRenderingContext2D, h: Hazard, game: Game, t: Theme) {
  const y = scannerY(game, h), color = h.id % 2 ? t.laser2 : t.laser;
  for (const rx of [h.x - 0.1, h.x + h.w + 0.1]) {
    ink(ctx, () => ctx.rect(rx - 0.05, CEIL, 0.1, FLOOR - CEIL), '#334155', 1);
    ctx.fillStyle = '#64748b'; for (let yy = CEIL + 0.2; yy < FLOOR; yy += 0.5) ctx.fillRect(rx - 0.05, yy, 0.1, P);
  }
  beam(ctx, h.x, y, h.x + h.w, y, color, game.time);
  for (const rx of [h.x - 0.1, h.x + h.w + 0.1]) {
    ink(ctx, () => ctx.roundRect(rx - 0.2, y - 0.2, 0.4, 0.4, 0.06), lin(ctx, rx - 0.2, 0, rx + 0.2, 0, [[0, '#94a3b8'], [1, '#334155']]), 1.5);
    ctx.fillStyle = color; ctx.fillRect(rx - 0.06, y - 0.06, 0.12, 0.12); glow(ctx, rx, y, 0.35, color, 0.7);
  }
}

// Agujero negro: un remolino de luz en espiral que gira, con chispas que caen y el centro negro (en gravityBackdrops).
function blackhole(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  drawBlackhole(ctx, h.x, h.y, h.r, game.time, h.id * 0.7);
}

// Las banderas: un mástil en el piso; se ponen verdes (y brillan) cuando las pasaste.
function checkpointFlag(ctx: CanvasRenderingContext2D, x: number, reached: boolean, time: number, n: number) {
  const top = FLOOR - 2.4, color = reached ? '#22c55e' : '#ef4444';
  if (reached) glow(ctx, x, FLOOR - 1.8, 1.4, '#4ade80', 0.35);
  limb(ctx, [[x, FLOOR], [x, top]], '#e2e8f0', P * 3);
  ink(ctx, circle(ctx, x, top, 0.09), '#facc15', 1);
  const wave = (k: number) => Math.sin(time * 6 + k * 2) * 0.06;
  ink(ctx, () => { ctx.moveTo(x, top + 0.1); ctx.quadraticCurveTo(x + 0.45, top + 0.1 + wave(0), x + 0.9, top + 0.2 + wave(1)); ctx.lineTo(x + 0.9, top + 0.75 + wave(1)); ctx.quadraticCurveTo(x + 0.45, top + 0.65 + wave(0), x, top + 0.7); ctx.closePath(); }, lin(ctx, x, 0, x + 0.9, 0, [[0, color], [1, darken(color, 0.25)]]), 1.5);
  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${0.36}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x + 0.43, top + 0.43 + wave(0));
  ink(ctx, () => ctx.rect(x - 0.25, FLOOR - 0.12, 0.5, 0.12), '#64748b', 1);
}

// ---------- La sangre (como en SkynetBall) ----------
const BLOOD = '#8a0303', BLOOD_L = '#c1121f';
function drawStains(ctx: CanvasRenderingContext2D, game: Game, x0: number, x1: number) {
  for (const st of game.stains) {
    if (st.x < x0 - 2 || st.x > x1 + 2) continue;
    const age = game.clock - st.at, alpha = Math.max(0, Math.min(1, (150 - age) / 20));
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    // Sobre la cara del sólido: "tx, ty" va a lo largo de la cara y "nx, ny" para afuera.
    const tx = -st.ny, ty = st.nx;
    const at = (u: number, v: number): [number, number] => [st.x + tx * u + st.nx * v, st.y + ty * u + st.ny * v];
    if (st.kind === 'scorch') { // hollín de una explosión: una mancha negra con rayas que salen para afuera
      ctx.fillStyle = 'rgba(20,14,10,0.7)'; ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = st.r * (i % 2 ? 0.45 : 0.7 + hash(st.seed * 40 + i) * 0.5); const [px, py] = at(Math.cos(a) * rr, Math.abs(Math.sin(a)) * rr * 0.25 * (Math.sin(a) > 0 ? 1 : 0.2)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; const [cx, cy] = at(0, 0.02); ctx.beginPath(); ctx.arc(cx, cy, st.r * 0.3, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const r = st.kind === 'pool' ? st.r * Math.min(1, 0.25 + age * 1.3) : st.r;
    ctx.fillStyle = st.kind === 'pool' ? BLOOD : BLOOD_L; ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, rr = r * (st.kind === 'pool' ? 0.75 + hash(st.seed * 50 + i) * 0.5 : i % 2 ? 0.5 : 0.8 + hash(st.seed * 70 + i) * 0.7);
      const [px, py] = at(Math.cos(a) * rr, Math.abs(Math.sin(a)) * rr * (st.kind === 'pool' ? 0.22 : 0.4) * (Math.sin(a) > 0 ? 1 : 0.25) + 0.01);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    if (st.kind === 'pool') { // brillo del charco
      ctx.fillStyle = 'rgba(255,90,90,0.35)'; const [hx, hy] = at(-r * 0.25, 0.04);
      ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.3, 0.035, Math.atan2(ty, tx), 0, Math.PI * 2); ctx.fill();
    }
    // Chorreaduras: si la cara no es un "piso" (para donde tiraba la gravedad), la sangre chorrea.
    const facing = st.nx * st.gx + st.ny * st.gy;
    if (facing > -0.6) {
      // Por la pared baja a lo largo de la cara; del techo cuelga en gotas.
      const along = tx * st.gx + ty * st.gy, hanging = facing > 0.6;
      const dx = hanging ? st.gx : tx * Math.sign(along || 1), dy = hanging ? st.gy : ty * Math.sign(along || 1);
      ctx.strokeStyle = BLOOD; ctx.lineCap = 'round';
      const n = st.kind === 'pool' ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const off = (hash(st.seed * 9 + i) - 0.5) * r * (hanging ? 1.4 : 0.5);
        const len = (hanging ? 0.08 + hash(st.seed * 3 + i) * 0.22 : 0.2 + hash(st.seed * 3 + i) * 0.9) * Math.min(1, age / 2.5) * Math.min(1, st.r * 6);
        const [sx, sy] = hanging ? at(off, 0) : at(0, 0.02 + off * 0.2);
        ctx.lineWidth = Math.max(P, 0.03 + hash(i + st.seed) * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * len, sy + dy * len); ctx.stroke();
        if (hanging) { ctx.fillStyle = BLOOD; ctx.beginPath(); ctx.arc(sx + dx * len, sy + dy * len, ctx.lineWidth * 0.9, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawGib(ctx: CanvasRenderingContext2D, g: Gib) {
  ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a);
  const WHITE = '#f1f5f9';
  switch (g.kind) {
    case 'helmet':
      ink(ctx, circle(ctx, 0, 0, 0.3), WHITE);
      ink(ctx, () => ctx.ellipse(0.1, 0, 0.19, 0.17, 0, 0, Math.PI * 2), '#2563eb', 2);
      ctx.fillStyle = '#dbeafe'; ctx.fillRect(0.03, -0.1, 3 * P, 2 * P);
      ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.ellipse(-0.18, 0.15, 0.13, 0.09, 0.4, 0, Math.PI * 2); ctx.fill(); // el cuello, ensangrentado
      break;
    case 'arm': case 'leg': {
      const l = g.kind === 'arm' ? 0.26 : 0.32;
      limb(ctx, [[-l / 2, 0], [l / 2, 0]], WHITE, g.kind === 'arm' ? 0.13 : 0.15);
      ctx.fillStyle = BLOOD_L; ctx.beginPath(); ctx.arc(-l / 2 - 0.02, 0, 0.08, 0, Math.PI * 2); ctx.fill();
      if (g.kind === 'leg') ink(ctx, () => ctx.roundRect(l / 2 - 0.05, -0.05, 0.17, 0.1, 0.03), '#94a3b8', 1.5);
      else ink(ctx, circle(ctx, l / 2 + 0.03, 0, 0.065), '#c3cfdd', 1.5);
      break;
    }
    case 'tank':
      ink(ctx, () => ctx.roundRect(-0.1, -0.19, 0.2, 0.38, 0.05), '#cbd5e1');
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(-0.07, -0.1, 0.14, 0.08);
      break;
    case 'chunk':
      ink(ctx, () => { for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7, rr = 0.1 + hash(k + g.va) * 0.06; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }, BLOOD_L, 1.5);
      break;
  }
  ctx.restore();
}

function portal(ctx: CanvasRenderingContext2D, game: Game, t: Theme) {
  const x = game.portalX, w = 1.4, time = game.time;
  glow(ctx, x + w / 2, (CEIL + FLOOR) / 2, 3.8, t.portal, 0.5);
  const inner = ctx.createLinearGradient(x, 0, x + w, 0);
  inner.addColorStop(0, '#ffffff'); inner.addColorStop(0.5, t.portal); inner.addColorStop(1, '#ffffff');
  ctx.globalAlpha = 0.6 + 0.2 * Math.sin(time * 4); ctx.fillStyle = inner; ctx.fillRect(x + 0.2, CEIL, w - 0.4, FLOOR - CEIL); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = P * 1.5;
  for (let k = 0; k < 7; k++) { // remolinos que suben
    const y = CEIL + ((time * 2 + k * 1.2) % (FLOOR - CEIL));
    ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x + w / 2, y, 0.45, 0.15, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#ffffff'; for (let k = 0; k < 10; k++) { const py = CEIL + ((time * 1.3 + hash(k) * 8) % (FLOOR - CEIL)); ctx.globalAlpha = 0.8; ctx.fillRect(x + 0.3 + hash(k + 3) * (w - 0.6), py, 2 * P, 2 * P); }
  ctx.globalAlpha = 1;
  for (const side of [x, x + w - 0.28]) { // columnas de metal con luces
    ink(ctx, () => ctx.rect(side, CEIL, 0.28, FLOOR - CEIL), lin(ctx, side, 0, side + 0.28, 0, [[0, '#475569'], [0.5, '#1e293b'], [1, '#0f172a']]), 1.5);
    for (let y = CEIL + 0.4; y < FLOOR; y += 0.8) { ctx.fillStyle = t.portal; ctx.fillRect(side + 0.09, y, 0.1, 0.3); glow(ctx, side + 0.14, y + 0.15, 0.25, t.portal, 0.5); }
  }
}

// ---------- El astronauta ----------

export interface AstronautPose { pose: 'idle' | 'run' | 'float' | 'thrust' | 'land'; time: number; angle: number; mirror: boolean; squash?: number }

// Siempre con los pies hacia donde tira la gravedad: flota, se impulsa, se apoya o corre apoyado.
export function poseFor(game: Game): AstronautPose {
  const p = game.player;
  let pose: AstronautPose['pose'] = 'float';
  if (p.onGround) pose = p.landT < 0.14 ? 'land' : Math.abs(game.speed + p.vx) > 0.3 && game.phase === 'play' ? 'run' : 'idle';
  else if (p.tx || p.ty) pose = 'thrust';
  return { pose, time: game.time, angle: -game.angle, mirror: p.facing === -1, squash: p.landT < 0.14 ? 1 - (0.14 - p.landT) * 1.2 : 1 };
}

// Dibuja al astronauta centrado en (x, y), con 1 casillero de alto, mirando a la derecha.
export function drawAstronaut(ctx: CanvasRenderingContext2D, x: number, y: number, a: AstronautPose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a.angle);
  ctx.scale(1.4, 1.4); // un poco más grande que su caja de choque, para que se vea bien
  if (a.mirror) ctx.scale(-1, 1);
  if (a.pose === 'run') ctx.rotate(0.07); // caminando se inclina un poquito para adelante
  if (a.squash && a.squash !== 1) { ctx.translate(0, 0.48); ctx.scale(1 + (1 - a.squash) * 0.6, a.squash); ctx.translate(0, -0.48); }
  const s = Math.sin(a.time * STRIDE), c = Math.cos(a.time * STRIDE), drift = Math.sin(a.time * 2.2);
  const bob = a.pose === 'idle' ? Math.sin(a.time * 3) * 0.02 : a.pose === 'run' ? Math.abs(c) * -0.03 : a.pose === 'float' ? drift * 0.04 : 0;
  ctx.translate(0, bob);
  if (a.pose === 'float') ctx.rotate(drift * 0.12); // flotando se balancea despacio
  const WHITE = '#f8fafc', SHADE = '#cbd5e1', DEEP = '#94a3b8', BLUE = '#2563eb';
  const suit = (x0: number, x1: number) => lin(ctx, x0, 0, x1, 0, [[0, '#ffffff'], [0.55, WHITE], [1, SHADE]]);
  // Manos y pies según la pose.
  let feet: [[number, number], [number, number]] = [[-0.09, 0.44], [0.09, 0.44]];
  let hands: [[number, number], [number, number]] = [[-0.24, 0.13], [0.24, 0.13]];
  switch (a.pose) {
    // Caminando: el pie que está en el aire va para adelante (levantado) y el apoyado se desliza para atrás; los
    // brazos al revés que las piernas.
    case 'run': feet = [[-0.04 - s * 0.18, 0.44 - Math.max(0, -c) * 0.12], [0.04 + s * 0.18, 0.44 - Math.max(0, c) * 0.12]]; hands = [[-0.12 + s * 0.16, 0.12], [0.14 - s * 0.16, 0.1]]; break;
    case 'float': feet = [[-0.17, 0.4 + drift * 0.03], [0.13, 0.36 - drift * 0.03]]; hands = [[-0.31, -0.06 + drift * 0.05], [0.31, -0.12 - drift * 0.05]]; break;
    case 'thrust': feet = [[-0.14, 0.4], [-0.03, 0.43]]; hands = [[0.16, 0.04], [0.3, -0.06]]; break;
    case 'land': feet = [[-0.18, 0.45], [0.18, 0.45]]; hands = [[-0.3, 0.14], [0.3, 0.14]]; break;
  }
  // Pierna: el traje con la rodilla marcada (un anillo gris) y la bota con suela.
  const leg = (foot: [number, number], hipX: number) => {
    const knee: [number, number] = [(hipX + foot[0]) / 2 + 0.02, (0.16 + foot[1]) / 2 - 0.01];
    limb(ctx, [[hipX, 0.15], knee, [foot[0], foot[1] - 0.05]], WHITE, 0.16);
    ctx.strokeStyle = SHADE; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(hipX + 0.03, 0.16); ctx.lineTo(knee[0] + 0.03, knee[1]); ctx.stroke(); // sombra del lado de atrás
    ink(ctx, circle(ctx, knee[0], knee[1], 0.07), ball(ctx, knee[0], knee[1], 0.07, '#d1d5db'), 1);
    ink(ctx, () => ctx.roundRect(foot[0] - 0.09, foot[1] - 0.08, 0.2, 0.11, 0.04), lin(ctx, 0, foot[1] - 0.08, 0, foot[1] + 0.03, [[0, '#e2e8f0'], [1, '#94a3b8']]), 1.5);
    ctx.fillStyle = '#334155'; ctx.fillRect(foot[0] - 0.09, foot[1] + 0.005, 0.2, 0.03); // suela
    ctx.fillStyle = BLUE; ctx.fillRect(foot[0] - 0.08, foot[1] - 0.07, 0.18, P * 1.5); // franja azul
  };
  // Brazo: con el puño azul y el guante.
  const arm = (hand: [number, number], shoulderX: number) => {
    const elbow: [number, number] = [(shoulderX + hand[0]) / 2, (-0.06 + hand[1]) / 2 + 0.02];
    limb(ctx, [[shoulderX, -0.07], elbow, hand], WHITE, 0.13);
    ink(ctx, circle(ctx, elbow[0], elbow[1], 0.055), '#d1d5db', 1);
    const cx = hand[0] + (elbow[0] - hand[0]) * 0.28, cy = hand[1] + (elbow[1] - hand[1]) * 0.28;
    ink(ctx, circle(ctx, cx, cy, 0.06), BLUE, 1);
    ink(ctx, () => ctx.ellipse(hand[0], hand[1], 0.07, 0.06, 0, 0, Math.PI * 2), ball(ctx, hand[0], hand[1], 0.07, '#9ca3af'), 1.5);
  };
  arm(hands[0], -0.11);
  // Mochila de soporte de vida: caja con rejillas, luz de estado y dos toberas abajo.
  ink(ctx, () => ctx.roundRect(-0.37, -0.25, 0.23, 0.44, 0.05), lin(ctx, -0.37, 0, -0.14, 0, [[0, '#94a3b8'], [0.5, '#e2e8f0'], [1, '#cbd5e1']]));
  ctx.fillStyle = '#64748b'; for (let k = 0; k < 4; k++) ctx.fillRect(-0.34, -0.17 + k * 0.06, 0.15, P);
  ctx.fillStyle = '#38bdf8'; ctx.fillRect(-0.33, 0.08, 0.06, 0.04); glow(ctx, -0.3, 0.1, 0.08, '#38bdf8', 0.6);
  ink(ctx, () => ctx.rect(-0.35, 0.19, 0.07, 0.05), '#475569', 1); ink(ctx, () => ctx.rect(-0.24, 0.19, 0.07, 0.05), '#475569', 1);
  leg(feet[0], -0.07);
  // El torso: traje con pliegues, cinturón y panel de control en el pecho.
  ink(ctx, () => ctx.roundRect(-0.2, -0.16, 0.4, 0.37, 0.11), suit(-0.2, 0.2));
  ctx.strokeStyle = 'rgba(100,116,139,0.55)'; ctx.lineWidth = P;
  ctx.beginPath(); ctx.moveTo(-0.15, -0.02); ctx.quadraticCurveTo(-0.1, 0.02, -0.15, 0.06); ctx.moveTo(0.16, -0.06); ctx.quadraticCurveTo(0.12, -0.02, 0.16, 0.02); ctx.stroke(); // pliegues
  ink(ctx, () => ctx.rect(-0.2, 0.1, 0.4, 0.06), lin(ctx, 0, 0.1, 0, 0.16, [[0, '#94a3b8'], [1, '#475569']]), 1); // cinturón
  ink(ctx, () => ctx.rect(-0.03, 0.095, 0.07, 0.07), '#facc15', 1); // hebilla
  ink(ctx, () => ctx.roundRect(-0.06, -0.09, 0.2, 0.15, 0.025), lin(ctx, 0, -0.09, 0, 0.06, [[0, '#334155'], [1, '#0f172a']]), 1.2); // panel
  ctx.fillStyle = '#22d3ee'; ctx.fillRect(-0.035, -0.07, 0.09, 0.04); // pantallita
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-0.03, -0.065, 0.04, P * 0.7);
  const tick = Math.floor(a.time * 3);
  for (const [k, color] of [[0, '#ef4444'], [1, '#22c55e'], [2, '#facc15']] as const) { ctx.fillStyle = (tick + k) % 3 === 0 ? lighten(color, 0.4) : color; ctx.fillRect(-0.035 + k * 0.045, -0.015, 0.03, 0.03); }
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0.075, -0.07, 0.04, 0.09);
  // Parche con bandera en el hombro.
  ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0.1, -0.15, 0.08, 0.018); ctx.fillStyle = '#ffffff'; ctx.fillRect(0.1, -0.132, 0.08, 0.018); ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0.1, -0.114, 0.08, 0.018);
  ctx.fillStyle = '#facc15'; ctx.fillRect(0.135, -0.128, P, P);
  leg(feet[1], 0.07);
  // Cuello: el anillo de metal donde se engancha el casco.
  ink(ctx, () => ctx.ellipse(0.02, -0.12, 0.17, 0.05, 0, 0, Math.PI * 2), lin(ctx, 0, -0.17, 0, -0.07, [[0, '#e5e7eb'], [1, '#64748b']]), 1.5);
  // Casco: esfera blanca con sombra, visor azul espejado con el reflejo de las estrellas, linterna y antena.
  const hx = 0.02, hy = -0.3, hr = 0.27;
  ink(ctx, circle(ctx, hx, hy, hr), ball(ctx, hx, hy, hr, '#eef2f7'));
  limb(ctx, [[-0.14, -0.43], [-0.2, -0.56]], '#9ca3af', P * 1.5); // antena
  ink(ctx, circle(ctx, -0.2, -0.57, 0.025), '#ef4444', 1);
  const visor = ctx.createLinearGradient(hx, hy - 0.17, hx + 0.12, hy + 0.15);
  visor.addColorStop(0, '#93c5fd'); visor.addColorStop(0.35, BLUE); visor.addColorStop(0.75, '#1e3a8a'); visor.addColorStop(1, '#f59e0b');
  ink(ctx, () => ctx.ellipse(hx + 0.08, hy, 0.18, 0.16, 0, 0, Math.PI * 2), DEEP, 2.2); // marco del visor
  ctx.fillStyle = visor; ctx.beginPath(); ctx.ellipse(hx + 0.09, hy + 0.005, 0.155, 0.135, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(hx + 0.09, hy + 0.005, 0.155, 0.135, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(hx + 0.03, hy - 0.06, 0.09, 0.035, -0.5, 0, Math.PI * 2); ctx.fill(); // reflejo grande
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 4; k++) ctx.fillRect(hx + 0.08 + hash(k) * 0.12, hy - 0.02 + hash(k + 5) * 0.1, P * 0.8, P * 0.8); // estrellitas
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(hx + 0.13, hy - 0.15, 0.03, 0.3);
  ctx.restore();
  ink(ctx, () => ctx.roundRect(hx - 0.25, hy - 0.08, 0.1, 0.15, 0.03), lin(ctx, 0, hy - 0.08, 0, hy + 0.07, [[0, '#cbd5e1'], [1, '#64748b']]), 1.5); // oreja
  ink(ctx, circle(ctx, hx - 0.2, hy - 0.16, 0.035), '#fef9c3', 1); // linterna
  glow(ctx, hx - 0.2, hy - 0.16, 0.12, '#fef08a', 0.5);
  arm(hands[1], 0.12);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game) {
  const p = game.player;
  if (game.phase === 'dead' || game.phase === 'ending' || game.phase === 'won') return;
  const cx = p.x + PLAYER_W / 2, cy = p.y + PLAYER_H / 2;
  // El chorro de oxígeno sale del tanque para el lado contrario de hacia donde se impulsa.
  if (p.tx || p.ty) {
    const ox = cx - p.tx * 0.35, oy = cy - p.ty * 0.35, flicker = 0.75 + 0.25 * Math.sin(game.time * 60);
    glow(ctx, ox - p.tx * 0.3, oy - p.ty * 0.3, 0.7, '#bae6fd', 0.5);
    for (let k = 0; k < 6; k++) {
      const d = ((game.time * 7 + k / 6) % 1), spread = (hash(k + Math.floor(game.time * 7)) - 0.5) * 0.4 * d;
      ctx.globalAlpha = (1 - d) * 0.85; ctx.fillStyle = k % 2 ? '#e0f2fe' : '#7dd3fc';
      ctx.beginPath(); ctx.arc(ox - p.tx * d * 1.1 * flicker - p.ty * spread, oy - p.ty * d * 1.1 * flicker + p.tx * spread, 0.07 + d * 0.13, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Polvo al apoyarse (sale para los costados, del lado de los pies).
  if (p.landT < 0.3) {
    const gx = Math.sin(game.angle), gy = Math.cos(game.angle), k = p.landT / 0.3;
    const fx = cx + gx * PLAYER_H / 2, fy = cy + gy * PLAYER_H / 2;
    ctx.fillStyle = '#f8fafc'; ctx.globalAlpha = 0.8 * (1 - k);
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      const d = side * (0.3 + k * 0.6 + j * 0.15), back = 0.08 + j * 0.03;
      ctx.beginPath(); ctx.arc(fx + gy * d - gx * back, fy - gx * d - gy * back, 0.1 * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawAstronaut(ctx, cx, cy, poseFor(game));
}

// La flecha que muestra para dónde hay que ir (hacia el portal) después de un cambio de gravedad: tres
// flechas que avanzan y brillan delante del astronauta. Se dibuja en el pasillo, así gira con la pantalla y
// siempre apunta para el lado correcto. Dura 5 segundos y se va apagando al final.
function directionHint(ctx: CanvasRenderingContext2D, game: Game) {
  if (game.hint <= 0 || game.phase !== 'play') return;
  const p = game.player, fade = Math.min(1, game.hint / 0.8) * Math.min(1, (HINT_TIME - game.hint) / 0.25);
  const cx = p.x + PLAYER_W / 2 + 2.2, cy = Math.max(CEIL + 1.2, Math.min(FLOOR - 1.2, p.y + PLAYER_H / 2));
  ctx.save(); ctx.globalAlpha = fade;
  glow(ctx, cx + 0.6, cy, 1.6, '#facc15', 0.35);
  for (let k = 0; k < 3; k++) {
    const t = (game.time * 1.6 + k / 3) % 1, x = cx + t * 2, a = Math.sin(t * Math.PI);
    ctx.globalAlpha = fade * (0.35 + 0.65 * a);
    ink(ctx, () => { ctx.moveTo(x - 0.35, cy - 0.65); ctx.lineTo(x + 0.35, cy); ctx.lineTo(x - 0.35, cy + 0.65); ctx.lineTo(x - 0.08, cy); ctx.closePath(); },
      lin(ctx, x - 0.35, cy - 0.65, x + 0.35, cy + 0.65, [[0, '#fef9c3'], [0.5, '#facc15'], [1, '#f59e0b']]), 2.5);
  }
  ctx.restore();
}

// ---------- La pantalla girada ----------

// Cuánto se aleja la cámara y alrededor de qué punto gira. Derecha, muestra todo el ancho de la pantalla;
// de costado se aleja un poco y sigue al astronauta (mirando un poco hacia adelante), así nunca queda afuera.
// "rows" es lo que mide la pantalla de alto, en casilleros (10 o más: lo que sobra muestra el cielo y la tierra).
export function viewOf(game: Game, rows: number) {
  const side = Math.abs(Math.sin(game.view)), center = game.cam + game.cols / 2, follow = game.follow;
  const base = 1 - 0.28 * side * Math.min(1, ROWS / rows * 1.15);
  // De costado (pantalla vertical), el pasillo se ve bastante más grande (un 87,5% más); sin pasarse del ancho de la pantalla
  // (en el celular parado, lo que entre).
  const z = side > 0 ? Math.min(base * (1 + 0.875 * side), Math.max(base, game.cols / (ROWS + 2.5))) : base;
  // Lo que sobra de alto se reparte: un poco de cielo arriba y más tierra abajo.
  return { z, px: center + (follow - center) * side, py: ROWS / 2 + Math.max(0, rows - ROWS) * 0.22, reach: Math.hypot(game.cols, rows) / 2 / z + 1.5 };
}
// Dónde queda en la pantalla un punto del pasillo.
export function toScreen(game: Game, rows: number, x: number, y: number) {
  const { z, px, py } = viewOf(game, rows), c = Math.cos(game.view), s = Math.sin(game.view), dx = x - px, dy = y - py;
  return { x: game.cols / 2 + z * (dx * c - dy * s), y: rows / 2 + z * (dx * s + dy * c) };
}

// El borde de atrás de la pantalla: una pared de energía (si te aplasta contra ella, perdés una vida).
function edgeWall(ctx: CanvasRenderingContext2D, game: Game) {
  const x = game.cam, g = ctx.createLinearGradient(x - 0.8, 0, x + 0.15, 0);
  g.addColorStop(0, 'rgba(244,63,94,0)'); g.addColorStop(1, 'rgba(244,63,94,0.55)');
  ctx.fillStyle = g; ctx.fillRect(x - 0.8, CEIL, 0.95, FLOOR - CEIL);
  ctx.fillStyle = '#fda4af';
  for (let y = CEIL; y < FLOOR; y += 0.5) ctx.fillRect(x + 0.05, y + ((game.time * 3) % 0.5), P * 2, 0.25);
}

// ---------- Escena final: el astronauta llega a la base de la Luna ----------

function endingScene(ctx: CanvasRenderingContext2D, game: Game) {
  const { cols } = game, t = game.phaseT;
  const sky = ctx.createLinearGradient(0, 0, 0, ROWS);
  sky.addColorStop(0, '#000004'); sky.addColorStop(1, '#111827');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, cols, ROWS);
  stars(ctx, 0, 0, cols, 0, ROWS, game.time + t);
  planet(ctx, cols * 0.2, 2.6, 1.6, '#2563eb', '#22c55e');
  ctx.fillStyle = '#9ca3af'; ctx.fillRect(0, FLOOR - 1, cols, ROWS);
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, FLOOR - 1, cols, 2 * P);
  ctx.fillStyle = '#6b7280';
  for (let k = 0; k < cols; k += 2.3) { ctx.beginPath(); ctx.ellipse(k + hash(k) * 1.5, FLOOR - 0.4 + hash(k + 1) * 0.6, 0.4, 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  // La base: cúpula, antena y bandera.
  const bx = cols * 0.7;
  limb(ctx, [[bx + 1.8, FLOOR - 1], [bx + 1.8, FLOOR - 4.2]], '#cbd5e1', P * 2);
  ink(ctx, () => ctx.rect(bx + 1.8, FLOOR - 4.2, 0.9, 0.55), '#ef4444', 1.5);
  ctx.fillStyle = '#fde047'; ctx.fillRect(bx + 2.05, FLOOR - 4.05, 0.25, 0.25);
  ink(ctx, () => { ctx.arc(bx, FLOOR - 1, 1.6, Math.PI, Math.PI * 2); ctx.closePath(); }, '#e2e8f0');
  ctx.fillStyle = '#67e8f9';
  for (let k = -1; k <= 1; k++) ctx.fillRect(bx + k * 0.6 - 0.15, FLOOR - 2, 0.3, 0.3);
  const lit = Math.sin(game.time * 4) > 0;
  ink(ctx, () => ctx.rect(bx - 0.35, FLOOR - 1.9, 0.7, 0.9), t > 3.2 ? '#fde047' : '#334155', 1.5);
  ctx.fillStyle = lit ? '#22c55e' : '#14532d'; ctx.fillRect(bx - 0.08, FLOOR - 2.35, 0.16, 0.16);
  // El astronauta camina hasta la puerta y entra.
  const k = Math.min(1, t / 3.2), ax = 1 + (bx - 1) * k;
  if (t < 3.6) drawAstronaut(ctx, ax, FLOOR - 1 - 0.5, { pose: k < 1 ? 'run' : 'idle', time: game.time + t, angle: 0, mirror: false });
  if (t > 3.2) { glow(ctx, bx, FLOOR - 1.5, 1.6, '#fde047', 0.5); }
  for (let i = 0; i < 12 && t > 3.6; i++) { // fuegos artificiales
    const a = i * Math.PI / 6, r = (t - 3.6) * 2;
    ctx.fillStyle = ['#fde047', '#f472b6', '#22d3ee'][i % 3]; ctx.globalAlpha = Math.max(0, 1 - (t - 3.6) / 1.4);
    ctx.fillRect(bx + Math.cos(a) * r, 3 + Math.sin(a) * r, 3 * P, 3 * P);
  }
  ctx.globalAlpha = 1;
}

// ---------- Todo junto ----------

// Dibuja todo en un lienzo de "cols" × "rows" casilleros (rows puede ser más que 10: se ve más cielo y tierra).
export function drawGame(ctx: CanvasRenderingContext2D, game: Game, rows: number = ROWS) {
  const t = THEMES[game.def.theme];
  if (game.phase === 'ending' || game.phase === 'won') {
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, game.cols, rows);
    ctx.save(); ctx.translate(0, (rows - ROWS) / 2); endingScene(ctx, game); ctx.restore();
    return;
  }
  ctx.fillStyle = darken(t.strata[t.strata.length - 1], 0.4); ctx.fillRect(0, 0, game.cols, rows);
  // Todo el pasillo se dibuja girado, para que la gravedad apunte siempre hacia abajo de la pantalla.
  const { z, px, py, reach } = viewOf(game, rows);
  const x0 = px - reach, x1 = px + reach, y0 = py - reach, y1 = py + reach;
  ctx.save();
  // Al morir, la pantalla tiembla.
  const shake = game.shake * game.shake * 0.35;
  ctx.translate(game.cols / 2 + (Math.random() - 0.5) * shake, rows / 2 + (Math.random() - 0.5) * shake); ctx.scale(z, z); ctx.rotate(game.view); ctx.translate(-px, -py);
  // El cielo (también arriba del techo) y el fondo del escenario.
  ctx.fillStyle = lin(ctx, 0, Math.min(0, y0), 0, ROWS, [[0, t.sky[0]], [Math.max(0, -y0) / (ROWS - Math.min(0, y0)), t.sky[0]], [(Math.max(0, -y0) + ROWS * 0.55) / (ROWS - Math.min(0, y0)), t.sky[1]], [1, t.sky[2]]]);
  ctx.fillRect(x0, y0, x1 - x0, FLOOR + 1 - y0);
  // Arriba del techo sigue el cielo: estrellas, la luna (o un planeta) y nubes (en el espacio, nubes de gas).
  if (y0 < -1) {
    ctx.save(); ctx.translate(game.cam, 0);
    drawUpperSky(ctx, game.def.theme, game.cam, x0 - game.cam, x1 - game.cam, y0, game.time);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, FLOOR + 1); ctx.clip();
  ctx.translate(game.cam, 0);
  background(ctx, game, t, x0 - game.cam, x1 - game.cam);
  ctx.restore();
  // Debajo del piso: capas de la tierra con fósiles (o roca, o máquinas), y los pozos.
  underground(ctx, game, t, x0, x1, y1);
  pits(ctx, game, x0, x1, y1);
  const seen = (x: number, w = 0) => x + w > x0 && x < x1;
  edgeWall(ctx, game);
  for (const h of game.hazards) if (h.kind === 'waterfall' && seen(h.x, h.w)) drawHazard(ctx, h, game, t);
  for (const h of game.hazards) if ((h.kind === 'saw' || h.kind === 'geyser' || h.kind === 'blackhole') && !h.dead && seen(h.x - 4, h.len + 8)) drawHazard(ctx, h, game, t);
  game.checkpoints.forEach((c, i) => { if (seen(c - 1, 3)) checkpointFlag(ctx, c, c <= game.checkpoint, game.time, i + 1); });
  if (seen(game.portalX, 2)) portal(ctx, game, t);
  for (const s of game.solids) if (seen(s.x, s.w)) drawSolid(ctx, s, t, game, x0, x1);
  drawStains(ctx, game, x0, x1);
  for (const h of game.hazards) {
    if (h.dead || h.kind === 'waterfall' || h.kind === 'saw' || h.kind === 'geyser' || h.kind === 'blackhole') continue;
    if (h.kind === 'ufo' || h.kind === 'asteroid' || h.kind === 'meteor' ? h.active : h.kind === 'comet' ? h.state > 0 : seen(h.x - h.len, h.w + h.len * 2 + 2)) drawHazard(ctx, h, game, t);
  }
  for (const b of game.bolts) { glow(ctx, b.x, b.y, b.r * 3, b.color, 0.6); ink(ctx, circle(ctx, b.x, b.y, b.r), ball(ctx, b.x, b.y, b.r, b.color), 1.5); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - P, b.y - P, 2 * P, 2 * P); }
  directionHint(ctx, game);
  drawPlayer(ctx, game);
  // El humo de las explosiones (detrás del fuego).
  for (const m of game.smoke) {
    const k = m.life / m.max, g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, `rgba(87,83,78,${0.4 * k})`); g.addColorStop(0.6, `rgba(68,64,60,${0.22 * k})`); g.addColorStop(1, 'rgba(41,37,36,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of game.blasts) {
    const k = b.t / b.max, r = b.r * (0.5 + k * 0.8);
    if (b.lethal) {
      // Explosión: un fogonazo blanco, una bola de fuego hecha de varias llamaradas que se agrandan y se
      // oscurecen, y la onda expansiva (un anillo que se abre).
      if (k < 0.15) glow(ctx, b.x, b.y, b.r * 1.2, '#fffbeb', 1 - k / 0.15);
      glow(ctx, b.x, b.y, b.r * 2.6, '#fb923c', 0.55 * (1 - k));
      for (let i = 0; i < 10; i++) {
        const a = hash(i * 7 + b.x * 3) * Math.PI * 2, d = b.r * 0.55 * Math.min(1, k * 3) * (0.3 + hash(i + b.y) * 0.7);
        const fx = b.x + Math.cos(a) * d, fy = b.y + Math.sin(a) * d - k * 0.3, fr = b.r * (0.32 + hash(i * 3) * 0.25) * (0.6 + k * 0.9);
        const hot = Math.max(0, 1 - k * 1.1), g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        g.addColorStop(0, mix('#57534e', '#fef9c3', hot)); g.addColorStop(0.45, mix('#44403c', '#f97316', Math.min(1, hot * 1.3))); g.addColorStop(1, mix('rgba(41,37,36,0)', 'rgba(220,38,38,0)', hot));
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.6); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = Math.max(0, 0.8 * (1 - k * 1.3)); ctx.strokeStyle = '#fff7ed'; ctx.lineWidth = Math.max(P, 0.16 * (1 - k));
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.3 + k * 2.2), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // Salpicadura de sangre: un charco irregular que se queda un momento y se va desvaneciendo.
      const fade = Math.max(0, 1 - k * 1.6);
      ctx.globalAlpha = fade * 0.85;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + b.x, dr = r * (0.5 + hash(i + b.y) * 0.9);
        ctx.fillStyle = i % 2 ? '#7f1d1d' : '#991b1b';
        ctx.beginPath(); ctx.ellipse(b.x + Math.cos(a) * dr * 0.5, b.y + Math.sin(a) * dr * 0.35, dr * 0.4, dr * 0.22, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  for (const s of game.particles) {
    ctx.globalAlpha = Math.max(0, s.life / s.max); ctx.fillStyle = s.color;
    ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
  }
  ctx.globalAlpha = 1;
  for (const g of game.gibs) if (seen(g.x - 1, 2)) drawGib(ctx, g);
  ctx.fillStyle = BLOOD_L;
  for (const d of game.drops) { ctx.beginPath(); ctx.arc(d.x, d.y, Math.max(P, d.r), 0, Math.PI * 2); ctx.fill(); }
  // Líneas de velocidad: cuando va bastante más rápido que el escenario (cayendo con la pantalla girada o con
  // el chorro), pasan rayitas para atrás alrededor del astronauta.
  const rush = Math.max(0, game.player.vx) - 2.5;
  if (rush > 0 && game.phase === 'play') {
    const p = game.player, k = Math.min(1, rush / 8);
    ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = P * 1.5;
    for (let i = 0; i < 16; i++) {
      const len = 0.8 + hash(i) * 1.6 * k, x = p.x + 9 - ((game.time * (14 + rush * 3) + hash(i + 7) * 18) % 18), y = CEIL + 0.3 + hash(i + 3) * (FLOOR - CEIL - 0.6);
      ctx.globalAlpha = (0.15 + 0.35 * k) * (0.5 + hash(i + 11) * 0.5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // Viento: rayitas que pasan hacia atrás (por el pasillo, así giran con la pantalla).
  if (game.gust > 0) {
    ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = P; ctx.globalAlpha = Math.min(1, game.gust) * 0.6;
    for (let i = 0; i < 18; i++) { const x = game.cam + game.cols - ((game.time * 18 + hash(i) * game.cols * 2) % (game.cols + 3)); const y = 1.5 + hash(i + 4) * 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.2, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Viñeta suave en los bordes (da profundidad).
  const vig = ctx.createRadialGradient(game.cols / 2, rows / 2, Math.min(game.cols, rows) * 0.45, game.cols / 2, rows / 2, Math.hypot(game.cols, rows) / 2);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, game.cols, rows);
  // Oscuridad de la tormenta: se ve alrededor del astronauta y todo cuando cae un rayo.
  if (game.def.dark && game.flash <= 0) {
    const p = game.player, { x: cx, y: cy } = toScreen(game, rows, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2);
    const dark = ctx.createRadialGradient(cx, cy, 2.5, cx, cy, 9);
    dark.addColorStop(0, 'rgba(5,4,15,0)'); dark.addColorStop(1, 'rgba(5,4,15,0.62)');
    ctx.fillStyle = dark; ctx.fillRect(0, 0, game.cols, rows);
  }
  if (game.flash > 0) { ctx.fillStyle = `rgba(224,231,255,${game.flash * 1.6})`; ctx.fillRect(0, 0, game.cols, rows); }
}
