// Dibujos de Gravity Swap, todos hechos con código. Se dibuja en un lienzo chiquito (24 píxeles por
// casillero) que después se agranda sin suavizar, así todo queda en pixel art con borde oscuro, como en
// las referencias: el astronauta blanco y azul, los 10 escenarios con su fondo, las trampas y los villanos.
import {
  CEIL, FLOOR, PLAYER_H, PLAYER_W, ROWS, WARN_SECONDS, flyerCenter, geyserHeight, geyserWarn, laserOn, laserWarn, lightningState,
  mineCenter, pendulumBall, plantBite, pressRect, pressState, sawCenter, sporeCenter,
  type Game, type Hazard, type Solid, type ThemeId,
} from './gravitySwap';

export const PX = 24;
const P = 1 / PX; // un píxel, en casilleros
const INK = '#0a0a16'; // el borde oscuro de todo
const PAD = 14; // lo que se ve de más a los costados cuando la pantalla está girada

interface Theme {
  sky: [string, string, string]; ground: string; brick: string; top: string;
  spike: string; shade: string; laser: string; laser2: string; portal: string;
}
export const THEMES: Record<ThemeId, Theme> = {
  city: { sky: ['#120a2e', '#2a1060', '#5b2196'], ground: '#1e2a4a', brick: '#16203a', top: '#38bdf8', spike: '#c7f0ff', shade: '#5fb7d9', laser: '#ff2d55', laser2: '#22d3ee', portal: '#38bdf8' },
  mines: { sky: ['#04050d', '#0b1020', '#1a1530'], ground: '#5b5f6b', brick: '#43474f', top: '#a8adb8', spike: '#e5e7eb', shade: '#9ca3af', laser: '#ff3b3b', laser2: '#f472b6', portal: '#34d399' },
  base: { sky: ['#070b16', '#0f172a', '#13233d'], ground: '#1f3b47', brick: '#173039', top: '#2dd4bf', spike: '#e2e8f0', shade: '#94a3b8', laser: '#ef4444', laser2: '#22c55e', portal: '#fb923c' },
  ice: { sky: ['#0b2a6b', '#2563eb', '#93c5fd'], ground: '#5cc3f0', brick: '#3aa6dc', top: '#f0f9ff', spike: '#f0f9ff', shade: '#93c5fd', laser: '#22d3ee', laser2: '#a78bfa', portal: '#e0f2fe' },
  volcano: { sky: ['#1a0505', '#4a0d0d', '#8a1c0c'], ground: '#3a2433', brick: '#2a1824', top: '#f97316', spike: '#f5f5f4', shade: '#a8a29e', laser: '#f97316', laser2: '#fde047', portal: '#e879f9' },
  inverse: { sky: ['#2e0a4f', '#6b21a8', '#c026d3'], ground: '#1e1b4b', brick: '#16143a', top: '#67e8f9', spike: '#a5f3fc', shade: '#22d3ee', laser: '#f472b6', laser2: '#67e8f9', portal: '#e879f9' },
  factory: { sky: ['#0b0f17', '#141b26', '#1f2937'], ground: '#4b5563', brick: '#374151', top: '#facc15', spike: '#e5e7eb', shade: '#9ca3af', laser: '#ef4444', laser2: '#f97316', portal: '#f59e0b' },
  forest: { sky: ['#011a14', '#033d33', '#065f55'], ground: '#3f4d45', brick: '#2c3a33', top: '#4ade80', spike: '#67e8f9', shade: '#f472b6', laser: '#a3e635', laser2: '#e879f9', portal: '#facc15' },
  storm: { sky: ['#14121f', '#2b2944', '#4c4a73'], ground: '#2a2838', brick: '#1e1c2b', top: '#a5b4fc', spike: '#e2e8f0', shade: '#94a3b8', laser: '#ef4444', laser2: '#f0abfc', portal: '#f0abfc' },
  moon: { sky: ['#000004', '#05060f', '#0d1020'], ground: '#9ca3af', brick: '#6b7280', top: '#e5e7eb', spike: '#e5e7eb', shade: '#9ca3af', laser: '#ef4444', laser2: '#f43f5e', portal: '#facc15' },
};

// Un número "al azar" fijo para cada índice (para que el fondo no cambie de un cuadro al otro).
const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

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

// ---------- Fondos ----------

// Repite un dibujo cada "gap" casilleros, con desplazamiento lento (parallax).
function layer(ctx: CanvasRenderingContext2D, cam: number, cols: number, factor: number, gap: number, draw: (x: number, i: number) => void) {
  const off = cam * factor;
  for (let i = Math.floor(off / gap) - 1; i * gap - off < cols + gap; i++) draw(i * gap - off, i);
}

function stars(ctx: CanvasRenderingContext2D, cam: number, cols: number, time: number, color = '#ffffff') {
  ctx.fillStyle = color;
  layer(ctx, cam, cols, 0.04, 1.3, (x, i) => {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + hash(i)) + i));
    ctx.globalAlpha = twinkle * (0.4 + hash(i + 3) * 0.6);
    const s = hash(i + 7) > 0.85 ? 2 * P : P;
    ctx.fillRect(x + hash(i + 1), hash(i + 2) * ROWS * 0.9, s, s);
  });
  ctx.globalAlpha = 1;
}

function planet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sea: string, land: string) {
  glow(ctx, x, y, r * 1.5, sea, 0.35);
  ctx.save();
  ink(ctx, circle(ctx, x, y, r), sea);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = land;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x - r + hash(i) * r * 2, y - r + hash(i + 9) * r * 2, r * (0.2 + hash(i + 4) * 0.3), r * 0.15, hash(i) * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.3, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function background(ctx: CanvasRenderingContext2D, game: Game, t: Theme, cols: number) {
  const { cam, time } = game;
  const sky = ctx.createLinearGradient(0, 0, 0, ROWS);
  sky.addColorStop(0, t.sky[0]); sky.addColorStop(0.55, t.sky[1]); sky.addColorStop(1, t.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, cols, ROWS);

  switch (game.def.theme) {
    case 'city': {
      stars(ctx, cam, cols, time);
      layer(ctx, cam, cols, 0.12, 1.6, (x, i) => { // edificios lejanos
        const h = 3 + hash(i) * 4;
        ctx.fillStyle = '#26135a'; ctx.fillRect(x, ROWS - h - 0.5, 1.3, h + 1);
        if (hash(i + 5) > 0.6) { ctx.fillRect(x + 0.6, ROWS - h - 1.4, 2 * P, 1); }
      });
      layer(ctx, cam, cols, 0.3, 2.3, (x, i) => { // edificios cercanos con ventanas de neón
        const h = 2.5 + hash(i + 11) * 4.5, w = 1.6 + hash(i) * 0.5;
        ctx.fillStyle = '#170b38'; ctx.fillRect(x, ROWS - h - 0.8, w, h + 1);
        ctx.fillStyle = hash(i + 2) > 0.5 ? '#f472b6' : '#22d3ee';
        for (let wy = 0; wy < h - 0.5; wy += 0.5) for (let wx = 0.2; wx < w - 0.2; wx += 0.4) if (hash(i * 31 + wy * 7 + wx * 3) > 0.55) ctx.fillRect(x + wx, ROWS - h - 0.5 + wy, 3 * P, 3 * P);
        ctx.fillStyle = '#ff2d55'; if (hash(i + 8) > 0.5) ctx.fillRect(x + w / 2, ROWS - h - 1.2, P * 2, 0.4);
      });
      break;
    }
    case 'mines': {
      stars(ctx, cam, cols, time);
      glow(ctx, cols * 0.7 - (cam * 0.02) % 4, 3, 4, '#7c3aed', 0.25);
      ctx.globalAlpha = 0.4; // asteroides lejanos (oscuros, para no confundirlos con los que lastiman)
      layer(ctx, cam, cols, 0.15, 3.1, (x, i) => {
        const r = 0.3 + hash(i) * 0.5, y = 2 + hash(i + 4) * 6;
        ctx.fillStyle = '#3b2a2a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1d1d'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.25, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.18, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      break;
    }
    case 'base': {
      layer(ctx, cam, cols, 0.3, 1, (x, i) => { // paneles de la pared
        ctx.fillStyle = hash(i) > 0.5 ? '#111c33' : '#0e182c'; ctx.fillRect(x, 0, 1 - P, ROWS);
        ctx.fillStyle = '#1e2c4a'; ctx.fillRect(x, 3.2, 1, 2 * P); ctx.fillRect(x, 6.8, 1, 2 * P);
      });
      layer(ctx, cam, cols, 0.3, 7, (x, i) => { // ventanales con la Tierra
        ctx.fillStyle = '#020617'; ctx.fillRect(x + 1, 2.2, 3.4, 5);
        ctx.save(); ctx.beginPath(); ctx.rect(x + 1, 2.2, 3.4, 5); ctx.clip();
        stars(ctx, 0, 1, time + i); planet(ctx, x + 2.7 + hash(i), 7.5, 2.6, '#2563eb', '#16a34a');
        ctx.restore();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3 * P; ctx.strokeRect(x + 1, 2.2, 3.4, 5);
        ctx.fillStyle = '#f97316'; ctx.fillRect(x + 0.6, 2.2, 2 * P, 5);
      });
      break;
    }
    case 'ice': {
      ctx.fillStyle = '#ffffff';
      layer(ctx, cam, cols, 0.1, 3.5, (x, i) => { // montañas nevadas
        const h = 3 + hash(i) * 3;
        ctx.fillStyle = '#7fb0e8'; ctx.beginPath(); ctx.moveTo(x - 2.5, ROWS); ctx.lineTo(x, ROWS - h - 1); ctx.lineTo(x + 2.5, ROWS); ctx.fill();
        ctx.fillStyle = '#eef6ff'; ctx.beginPath(); ctx.moveTo(x - 0.7, ROWS - h - 1 + 0.75); ctx.lineTo(x, ROWS - h - 1); ctx.lineTo(x + 0.7, ROWS - h - 1 + 0.75); ctx.fill();
      });
      layer(ctx, cam, cols, 0.25, 2.6, (x, i) => {
        const h = 2 + hash(i + 3) * 2.5;
        ctx.fillStyle = '#a9cdf5'; ctx.beginPath(); ctx.moveTo(x - 1.8, ROWS); ctx.lineTo(x, ROWS - h); ctx.lineTo(x + 1.8, ROWS); ctx.fill();
      });
      ctx.fillStyle = '#ffffff'; // nieve que cae
      for (let i = 0; i < 40; i++) {
        const x = ((hash(i) * cols * 1.4 - cam * 0.5 - time * 0.6) % (cols + 1) + cols + 1) % (cols + 1);
        const y = (hash(i + 50) * ROWS + time * (0.8 + hash(i + 9))) % ROWS;
        ctx.globalAlpha = 0.5 + hash(i + 3) * 0.5; ctx.fillRect(x, y, 2 * P, 2 * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'volcano': {
      layer(ctx, cam, cols, 0.12, 6, (x, i) => { // volcanes con lava
        const h = 4 + hash(i) * 2;
        ctx.fillStyle = '#2a0b0b'; ctx.beginPath(); ctx.moveTo(x - 3.5, ROWS); ctx.lineTo(x - 0.6, ROWS - h); ctx.lineTo(x + 0.6, ROWS - h); ctx.lineTo(x + 3.5, ROWS); ctx.fill();
        glow(ctx, x, ROWS - h, 1.6, '#f97316', 0.5);
        ctx.fillStyle = '#7c2d12'; ctx.fillRect(x - 0.08, ROWS - h, 0.16, h * 0.5 * (0.6 + 0.4 * Math.sin(time + i)));
      });
      for (let i = 0; i < 24; i++) { // brasas que suben
        const x = ((hash(i) * cols * 1.3 - cam * 0.6) % cols + cols) % cols;
        const y = ROWS - ((time * (0.6 + hash(i + 2)) + hash(i + 5) * ROWS) % ROWS);
        ctx.fillStyle = hash(i + 1) > 0.5 ? '#fdba74' : '#f97316'; ctx.globalAlpha = 0.8; ctx.fillRect(x, y, 2 * P, 2 * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'inverse': {
      stars(ctx, cam, cols, time, '#fbcfe8');
      layer(ctx, cam, cols, 0.15, 2.8, (x, i) => { // rocas que cuelgan del techo
        const h = 2 + hash(i) * 3;
        ctx.fillStyle = '#3b0a5e'; ctx.beginPath(); ctx.moveTo(x - 1, 0); ctx.lineTo(x + 1, 0); ctx.lineTo(x + 0.2, h); ctx.lineTo(x - 0.3, h * 0.8); ctx.fill();
      });
      layer(ctx, cam, cols, 0.3, 4.5, (x, i) => { // islas flotantes dadas vuelta
        const y = 3 + hash(i + 2) * 3;
        ctx.fillStyle = '#4c1d95'; ctx.fillRect(x - 0.9, y, 1.8, 0.3);
        ctx.beginPath(); ctx.moveTo(x - 0.9, y); ctx.lineTo(x, y - 1.2); ctx.lineTo(x + 0.9, y); ctx.fill();
        ctx.fillStyle = '#f0abfc'; ctx.fillRect(x - 0.4, y + 0.3, 2 * P, 0.4); ctx.fillRect(x + 0.3, y + 0.3, 2 * P, 0.6);
      });
      break;
    }
    case 'factory': {
      layer(ctx, cam, cols, 0.3, 1.5, (x, i) => {
        ctx.fillStyle = hash(i) > 0.5 ? '#161e2b' : '#131a25'; ctx.fillRect(x, 0, 1.5 - P, ROWS);
      });
      layer(ctx, cam, cols, 0.3, 5, (x, i) => { // engranajes que giran
        const r = 0.9 + hash(i) * 0.6, y = 3 + hash(i + 1) * 4, a = time * (i % 2 ? 0.8 : -0.8);
        ctx.fillStyle = '#2a3342';
        ctx.beginPath();
        for (let k = 0; k < 16; k++) { const ang = a + k * Math.PI / 8, rr = k % 2 ? r : r * 1.2; ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
        ctx.fill();
        ctx.fillStyle = '#131a25'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#334155'; // caños
      layer(ctx, cam, cols, 0.3, 8, x => { ctx.fillRect(x, 2.4, 8, 0.25); ctx.fillRect(x + 3, 2.4, 0.25, 6); });
      break;
    }
    case 'forest': {
      layer(ctx, cam, cols, 0.12, 3.2, (x, i) => { // hongos gigantes que brillan
        const h = 3 + hash(i) * 3, c = hash(i + 1) > 0.5 ? '#22d3ee' : '#a78bfa';
        ctx.fillStyle = '#0b3b33'; ctx.fillRect(x - 0.15, ROWS - h, 0.3, h);
        glow(ctx, x, ROWS - h, 1.5, c, 0.35);
        ctx.fillStyle = '#0e5a4f'; ctx.beginPath(); ctx.ellipse(x, ROWS - h, 1.1, 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
      });
      for (let i = 0; i < 26; i++) { // luciérnagas
        const x = ((hash(i) * cols * 1.5 - cam * 0.4) % cols + cols) % cols + Math.sin(time + i) * 0.3;
        const y = 2 + hash(i + 3) * 6 + Math.cos(time * 0.8 + i) * 0.3;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i));
        ctx.fillStyle = hash(i + 6) > 0.5 ? '#bef264' : '#67e8f9'; ctx.fillRect(x, y, 2 * P, 2 * P);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'storm': {
      layer(ctx, cam, cols, 0.1, 3, (x, i) => { // torres lejanas
        const h = 4 + hash(i) * 4;
        ctx.fillStyle = '#211f33'; ctx.fillRect(x, ROWS - h, 0.8, h); ctx.fillRect(x - 0.2, ROWS - h, 1.2, 0.3);
        if (hash(i + 3) > 0.5) { ctx.fillStyle = '#ef4444'; ctx.fillRect(x + 0.35, ROWS - h - 0.3, 2 * P, 2 * P); }
      });
      ctx.fillStyle = '#3a3858'; // nubes
      layer(ctx, cam, cols, 0.2, 2.5, (x, i) => { ctx.beginPath(); ctx.ellipse(x, 0.6 + hash(i) * 0.8, 1.6, 0.7, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = '#a5b4fc55'; ctx.lineWidth = P; // lluvia
      for (let i = 0; i < 50; i++) {
        const x = ((hash(i) * cols * 1.3 - time * 3 - cam * 0.8) % (cols + 2) + cols + 2) % (cols + 2);
        const y = (hash(i + 9) * ROWS + time * 14) % (ROWS + 1);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.15, y + 0.5); ctx.stroke();
      }
      break;
    }
    case 'moon': {
      stars(ctx, cam, cols, time);
      planet(ctx, cols * 0.72 - (cam * 0.03) % (cols + 6), 3.2, 1.8, '#2563eb', '#22c55e');
      layer(ctx, cam, cols, 0.15, 4, (x, i) => { // cerros con cráteres
        const h = 1.2 + hash(i) * 1.5;
        ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.ellipse(x, ROWS - 0.5, 2.6, h, 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.ellipse(x - 0.6, ROWS - h * 0.6, 0.4, 0.15, 0, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
  }
}

// ---------- Piso, techo y bloques ----------

function drawSolid(ctx: CanvasRenderingContext2D, s: Solid, t: Theme, game: Game) {
  if (s.gone) return;
  const theme = game.def.theme;
  let { x, y } = s;
  const { w, h } = s;
  if (s.kind === 'crumble' && s.crumble !== undefined) { x += Math.sin(game.time * 70) * 0.05; y += Math.cos(game.time * 60) * 0.03; }
  const left = Math.max(x, game.cam - PAD), right = Math.min(x + w, game.cam + game.cols + PAD);
  if (right <= left) return;
  // El piso y el techo son más gruesos de lo que se ve sin girar (al girar la pantalla se ve de costado).
  const deep = s.kind === 'ground' ? 7 : 0, top = y >= FLOOR - 0.01 ? y : y - deep, tall = h + deep;
  ink(ctx, () => ctx.rect(left, top, right - left, tall), s.kind === 'base' ? '#475569' : t.ground);
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, tall); ctx.clip();
  // Ladrillos.
  ctx.fillStyle = t.brick;
  for (let row = 0; row < tall; row += 0.5) {
    const shift = (Math.floor((top + row) * 2) % 2) * 0.5;
    for (let cx = Math.floor(left) - 1 + shift; cx < right; cx += 1) { ctx.fillRect(cx, top + row, P * 1.5, 0.5); ctx.fillRect(cx, top + row, 1, P * 1.5); }
  }
  if (theme === 'factory' && s.kind !== 'ground') { // franjas de peligro
    ctx.fillStyle = '#facc15';
    for (let k = Math.floor(left) - 2; k < right + 2; k += 0.6) { ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + 0.3, y + h); ctx.lineTo(k + 0.3 + h, y); ctx.lineTo(k + h, y); ctx.fill(); }
    ctx.fillStyle = '#111827aa'; ctx.fillRect(left, y, right - left, h);
  }
  if (s.kind === 'crumble') { // grietas
    ctx.strokeStyle = INK; ctx.lineWidth = P * 1.5;
    for (let k = 0; k < w; k += 1) { ctx.beginPath(); ctx.moveTo(x + k + 0.3, y); ctx.lineTo(x + k + 0.5, y + h * 0.4); ctx.lineTo(x + k + 0.35, y + h * 0.7); ctx.stroke(); }
  }
  if (theme === 'moon' && s.kind === 'ground') {
    ctx.fillStyle = '#6b7280';
    for (let k = Math.floor(left); k < right; k++) if (hash(k) > 0.6) { ctx.beginPath(); ctx.ellipse(k + 0.5, y + (y < CEIL ? h - 0.4 : 0.45), 0.3, 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  // El borde que da al lado donde se juega brilla con el color del escenario.
  ctx.fillStyle = t.top;
  if (y >= FLOOR - 0.01 || s.kind !== 'ground') ctx.fillRect(left, y, right - left, 2 * P);
  if (y + h <= CEIL + 0.01 || s.kind !== 'ground') ctx.fillRect(left, y + h - 2 * P, right - left, 2 * P);
  if (theme === 'ice') { // nieve arriba y carámbanos abajo
    ctx.fillStyle = '#ffffff';
    if (y >= FLOOR - 0.01 || s.kind !== 'ground') { ctx.fillRect(left, y - P * 2, right - left, P * 4); }
    if (y + h <= CEIL + 0.01 || s.kind !== 'ground') for (let k = Math.ceil(left * 2) / 2; k < right; k += 0.5) if (hash(k * 2) > 0.4) {
      ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + 0.2, y + h); ctx.lineTo(k + 0.1, y + h + 0.15 + hash(k) * 0.2); ctx.fill();
    }
  }
  if (theme === 'forest') { // musgo que brilla
    ctx.fillStyle = '#4ade80';
    for (let k = Math.floor(left * 3) / 3; k < right; k += 1 / 3) if (hash(k * 3) > 0.5) {
      if (y >= FLOOR - 0.01 || s.kind !== 'ground') ctx.fillRect(k, y - P * 2, P * 3, P * 2);
      if (y + h <= CEIL + 0.01 || s.kind !== 'ground') ctx.fillRect(k, y + h, P * 3, P * 2);
    }
  }
}

// ---------- Trampas ----------

function spikes(ctx: CanvasRenderingContext2D, h: Hazard, t: Theme) {
  const n = Math.round(h.w * 2), sw = h.w / n;
  for (let i = 0; i < n; i++) {
    const x = h.x + i * sw, base = h.side === 1 ? h.y + h.h : h.y, tip = h.side === 1 ? h.y : h.y + h.h;
    ink(ctx, () => { ctx.moveTo(x, base); ctx.lineTo(x + sw / 2, tip); ctx.lineTo(x + sw, base); ctx.closePath(); }, t.spike, 1.5);
    ctx.fillStyle = t.shade; ctx.beginPath(); ctx.moveTo(x + sw / 2, base); ctx.lineTo(x + sw / 2, tip); ctx.lineTo(x + sw, base); ctx.fill();
  }
}

function spikyBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, body: string, eye: string | null, time: number) {
  ctx.fillStyle = INK;
  for (let k = 0; k < 8; k++) {
    const a = spin + k * Math.PI / 4;
    ink(ctx, () => { ctx.moveTo(x + Math.cos(a - 0.3) * r * 0.8, y + Math.sin(a - 0.3) * r * 0.8); ctx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45); ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.8, y + Math.sin(a + 0.3) * r * 0.8); ctx.closePath(); }, '#cbd5e1', 1.5);
  }
  ink(ctx, circle(ctx, x, y, r), body);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
  if (eye) {
    glow(ctx, x, y, r * 1.2, eye, 0.4 + 0.3 * Math.sin(time * 6));
    ink(ctx, circle(ctx, x, y, r * 0.42), eye, 1.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.15, y - r * 0.2, 2 * P, 2 * P);
  }
}

function saw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, ice: boolean) {
  ctx.beginPath();
  for (let k = 0; k < 28; k++) { const a = spin + k * Math.PI / 14, rr = k % 2 ? r * 0.82 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.lineWidth = 2 * P; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ice ? '#bfdbfe' : '#cbd5e1'; ctx.fill();
  ink(ctx, circle(ctx, x, y, r * 0.55), ice ? '#60a5fa' : '#94a3b8', 1.5);
  ink(ctx, circle(ctx, x, y, r * 0.22), '#ef4444', 1.5);
  ctx.strokeStyle = INK; ctx.lineWidth = P * 1.5;
  for (let k = 0; k < 3; k++) { const a = spin * 1 + k * 2.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.stroke(); }
}

// Un villano que camina (robot de nieve, robot de fábrica o alien), mirando para el lado del jugador.
function walker(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const theme = game.def.theme, step = Math.sin(game.time * 10 + h.id);
  ctx.save();
  ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
  if (h.side === -1) ctx.scale(1, -1);
  const b = h.h / 2; // el piso queda en y = b
  if (theme === 'ice') { // muñeco de nieve robot
    ink(ctx, circle(ctx, 0, b - 0.25, 0.3), '#f8fafc');
    ink(ctx, circle(ctx, 0, b - 0.68, 0.22), '#f8fafc');
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-0.18, b - 0.74, 0.14, 0.07);
    glow(ctx, -0.1, b - 0.7, 0.2, '#ef4444', 0.6);
    limb(ctx, [[0.2, b - 0.3], [0.38, b - 0.45 + step * 0.05]], '#78350f', P * 2);
    ctx.fillStyle = INK; ctx.fillRect(-0.3, b - 0.04, 0.6, 0.06);
  } else if (theme === 'factory') { // robot
    limb(ctx, [[-0.15, b - 0.3], [-0.15 + step * 0.08, b]], '#6b7280', P * 3);
    limb(ctx, [[0.15, b - 0.3], [0.15 - step * 0.08, b]], '#6b7280', P * 3);
    ink(ctx, () => ctx.roundRect(-0.32, b - 0.85, 0.64, 0.58, 0.08), '#9ca3af');
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-0.24, b - 0.75, 0.48, 0.2);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-0.2 + (Math.sin(game.time * 3) + 1) * 0.14, b - 0.7, 0.12, 0.1);
    limb(ctx, [[0, b - 0.85], [0, b - 1]], '#6b7280', P * 1.5);
    ink(ctx, circle(ctx, 0, b - 1.02, 0.05), '#facc15', 1);
  } else { // alien baboso de un ojo
    ink(ctx, () => { ctx.ellipse(0, b - 0.38, 0.38, 0.4 + step * 0.03, 0, Math.PI, Math.PI * 2); ctx.lineTo(0.38, b); ctx.lineTo(-0.38, b); ctx.closePath(); }, '#84cc16');
    ink(ctx, circle(ctx, -0.05, b - 0.45, 0.15), '#fff', 1.5);
    ctx.fillStyle = INK; ctx.fillRect(-0.12, b - 0.48, 0.07, 0.07);
    ctx.fillStyle = '#4d7c0f'; ctx.fillRect(-0.3, b - 0.15, 0.6, 0.05);
  }
  ctx.restore();
}

function flyer(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const c = flyerCenter(game, h), theme = game.def.theme, flap = Math.sin(game.time * 18 + h.id);
  if (theme === 'inverse' || theme === 'storm') { // murciélago alien
    for (const s of [-1, 1]) ink(ctx, () => { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + s * 0.55, c.y - 0.15 - flap * 0.25); ctx.lineTo(c.x + s * 0.45, c.y + 0.1); ctx.lineTo(c.x + s * 0.25, c.y + 0.02); ctx.closePath(); }, '#7e22ce', 1.5);
    ink(ctx, circle(ctx, c.x, c.y, 0.22), '#581c87');
    ctx.fillStyle = '#facc15'; ctx.fillRect(c.x - 0.1, c.y - 0.06, 2 * P, 2 * P); ctx.fillRect(c.x + 0.03, c.y - 0.06, 2 * P, 2 * P);
  } else if (theme === 'forest') { // escarabajo que brilla
    glow(ctx, c.x, c.y, 0.7, '#bef264', 0.4);
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#e0f2fe';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c.x + s * 0.2, c.y - 0.2, 0.22, 0.1 + Math.abs(flap) * 0.06, s * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ink(ctx, circle(ctx, c.x, c.y, 0.25), '#65a30d');
    ctx.fillStyle = '#bef264'; ctx.fillRect(c.x - 0.02, c.y - 0.2, P * 1.5, 0.4);
  } else { // dron
    ctx.fillStyle = '#cbd5e1';
    for (const s of [-1, 1]) ctx.fillRect(c.x + s * 0.35 - 0.2 * Math.abs(flap), c.y - 0.32, 0.4 * Math.abs(flap) + P, 2 * P);
    limb(ctx, [[c.x - 0.35, c.y - 0.3], [c.x + 0.35, c.y - 0.3]], '#64748b', P * 1.5);
    ink(ctx, () => ctx.roundRect(c.x - 0.3, c.y - 0.2, 0.6, 0.38, 0.1), '#475569');
    ink(ctx, circle(ctx, c.x - 0.08, c.y, 0.1), '#ef4444', 1);
  }
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, game: Game, t: Theme) {
  const time = game.time, theme = game.def.theme;
  switch (h.kind) {
    case 'spikes': spikes(ctx, h, t); break;
    case 'laser': {
      const color = h.id % 2 ? t.laser : t.laser2, x = h.x + h.w / 2;
      const ends = h.len >= FLOOR - CEIL - 0.01 ? [CEIL, FLOOR] : [h.side === 1 ? FLOOR : CEIL];
      if (laserOn(game, h)) {
        glow(ctx, x, h.y + h.h / 2, 0.8, color, 0.35);
        ctx.fillStyle = color; ctx.globalAlpha = 0.55; ctx.fillRect(x - 0.18, h.y, 0.36, h.h);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - P * 1.5, h.y, P * 3, h.h);
        if (h.side !== 1 || ends.length > 1) glow(ctx, x, h.y + h.h, 0.4, '#ffffff', 0.6);
        if (h.side === 1 || ends.length > 1) glow(ctx, x, h.y, 0.4, '#ffffff', 0.6);
      } else if (laserWarn(game, h) && Math.sin(time * 50) > 0) {
        ctx.fillStyle = color; ctx.globalAlpha = 0.6; ctx.fillRect(x - P / 2, h.y, P, h.h); ctx.globalAlpha = 1;
      }
      for (const e of ends) { // los emisores
        const ey = e === FLOOR ? FLOOR - 0.3 : CEIL;
        ink(ctx, () => ctx.rect(x - 0.28, ey, 0.56, 0.3), '#334155', 1.5);
        ctx.fillStyle = laserOn(game, h) ? color : '#0f172a'; ctx.fillRect(x - 0.1, e === FLOOR ? ey : ey + 0.18, 0.2, 0.12);
      }
      break;
    }
    case 'mine': { const c = mineCenter(game, h); spikyBall(ctx, c.x, c.y, h.r, time * 0.8, '#1f2937', '#ef4444', time); break; }
    case 'saw': { const c = sawCenter(game, h); saw(ctx, c.x, c.y, h.r, time * 9 * (h.id % 2 ? 1 : -1), theme === 'ice'); break; }
    case 'proxMine': {
      const armed = h.state === 1, blink = armed ? Math.sin(time * 40) > 0 : Math.sin(time * 4) > 0.7;
      if (armed) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = P * 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(h.x, h.y, 1.8 * (1 - h.timer / 0.55), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      spikyBall(ctx, h.x, h.y, h.r, 0, '#b45309', blink ? '#f87171' : '#7f1d1d', time);
      break;
    }
    case 'asteroid': {
      if (!h.active) break;
      ctx.fillStyle = '#fb923c55';
      for (let k = 1; k < 4; k++) { ctx.globalAlpha = 0.3 / k; ctx.beginPath(); ctx.arc(h.x + k * 0.35, h.y, h.r * (1 - k * 0.15), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      const a = time * h.speed;
      ink(ctx, () => { for (let k = 0; k < 9; k++) { const ang = a + k * Math.PI * 2 / 9, rr = h.r * (0.82 + hash(h.id * 9 + k) * 0.25); ctx.lineTo(h.x + Math.cos(ang) * rr, h.y + Math.sin(ang) * rr); } ctx.closePath(); }, '#7c5a4a');
      ctx.fillStyle = '#5a3d33';
      for (let k = 0; k < 3; k++) { const ang = a + k * 2.2; ctx.beginPath(); ctx.arc(h.x + Math.cos(ang) * h.r * 0.45, h.y + Math.sin(ang) * h.r * 0.45, h.r * 0.18, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'turret': case 'tracker': {
      const gx = h.x + h.w / 2, gy = h.side === 1 ? h.y + 0.25 : h.y + h.h - 0.25;
      const aim = h.kind === 'tracker' ? h.aim : Math.PI;
      if (h.kind === 'tracker' && h.timer < 1.1 && h.x > game.cam + 1) { // la mira que apunta al astronauta
        ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = P; ctx.globalAlpha = h.timer < 0.25 ? 0.9 : 0.45; ctx.setLineDash([4 * P, 3 * P]);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(aim) * 14, gy + Math.sin(aim) * 14); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      limb(ctx, [[gx, gy], [gx + Math.cos(aim) * 0.6, gy + Math.sin(aim) * 0.6]], '#94a3b8', P * 4);
      ink(ctx, circle(ctx, gx, gy, 0.26), h.kind === 'tracker' ? '#be123c' : '#b45309', 1.5);
      const hot = h.timer < 0.3;
      ctx.fillStyle = hot ? '#fde047' : '#1f2937'; ctx.beginPath(); ctx.arc(gx, gy, 0.1, 0, Math.PI * 2); ctx.fill();
      if (hot) glow(ctx, gx + Math.cos(aim) * 0.6, gy + Math.sin(aim) * 0.6, 0.4, '#fde047', 0.7);
      break;
    }
    case 'press': {
      // Cabeza con franjas de peligro y el pistón que la empuja. Guardada, apenas asoma (y tiembla antes de bajar).
      const { shake } = pressState(game, h), dx = shake ? Math.sin(time * 80) * 0.04 : 0;
      const head = 0.5, ext = Math.max(0.12, pressRect(game, h).h);
      const y = h.side === 1 ? FLOOR - ext : CEIL + ext - head;
      if (ext > head) { ctx.fillStyle = '#64748b'; ctx.fillRect(h.x + h.w / 2 - 0.2 + dx, h.side === 1 ? y + head : CEIL, 0.4, ext - head); }
      ink(ctx, () => ctx.rect(h.x + dx, y, h.w, head), '#facc15');
      ctx.save(); ctx.beginPath(); ctx.rect(h.x + dx, y, h.w, head); ctx.clip(); ctx.fillStyle = INK;
      for (let k = -1; k < h.w + 1; k += 0.4) { ctx.beginPath(); ctx.moveTo(h.x + dx + k, y + head); ctx.lineTo(h.x + dx + k + 0.2, y + head); ctx.lineTo(h.x + dx + k + 0.2 + head, y); ctx.lineTo(h.x + dx + k + head, y); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'icicle': {
      const down = h.side === -1;
      ink(ctx, () => { ctx.moveTo(h.x, down ? h.y : h.y + h.h); ctx.lineTo(h.x + h.w, down ? h.y : h.y + h.h); ctx.lineTo(h.x + h.w / 2, down ? h.y + h.h : h.y); ctx.closePath(); }, '#bae6fd', 1.5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(h.x + h.w * 0.3, h.y + (down ? 0.05 : h.h * 0.5), P * 2, h.h * 0.4);
      break;
    }
    case 'walker': walker(ctx, h, game); break;
    case 'flyer': flyer(ctx, h, game); break;
    case 'fireball': {
      if (!h.active) break;
      ctx.fillStyle = '#f97316';
      for (let k = 1; k < 5; k++) { ctx.globalAlpha = 0.5 / k; ctx.beginPath(); ctx.arc(h.x + Math.sin(time * 20 + k) * 0.05, h.y + k * 0.22, h.r * (1 - k * 0.15), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      glow(ctx, h.x, h.y, 0.9, '#fb923c', 0.6);
      ink(ctx, circle(ctx, h.x, h.y, h.r), '#f97316', 1.5);
      ink(ctx, circle(ctx, h.x - 0.05, h.y - 0.05, h.r * 0.55), '#fde047', 0);
      break;
    }
    case 'geyser': {
      const gh = geyserHeight(game, h), cx = h.x + h.w / 2;
      if (gh > 0) {
        glow(ctx, cx, FLOOR - gh / 2, gh * 0.6, '#f97316', 0.4);
        ink(ctx, () => { ctx.moveTo(h.x, FLOOR); for (let y = 0; y <= gh; y += 0.25) ctx.lineTo(h.x + Math.sin(time * 15 + y * 3) * 0.08, FLOOR - y); ctx.lineTo(h.x + h.w, FLOOR - gh); for (let y = gh; y >= 0; y -= 0.25) ctx.lineTo(h.x + h.w + Math.sin(time * 13 + y * 3) * 0.08, FLOOR - y); ctx.closePath(); }, '#f97316');
        ctx.fillStyle = '#fde047'; ctx.fillRect(cx - 0.12, FLOOR - gh, 0.24, gh);
      } else if (geyserWarn(game, h)) {
        ctx.fillStyle = '#fb923c';
        for (let k = 0; k < 4; k++) { const by = FLOOR - ((time * 3 + k * 0.3) % 1.2); ctx.beginPath(); ctx.arc(cx + Math.sin(k * 2 + time * 5) * 0.25, by, 0.07 + k * 0.02, 0, Math.PI * 2); ctx.fill(); }
      }
      ink(ctx, () => ctx.rect(h.x - 0.1, FLOOR - 0.15, h.w + 0.2, 0.15), '#7c2d12', 1.5);
      break;
    }
    case 'pendulum': {
      const ball = pendulumBall(game, h);
      ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2 * P; ctx.setLineDash([3 * P, 2 * P]);
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ball.x, ball.y); ctx.stroke(); ctx.setLineDash([]);
      ink(ctx, circle(ctx, h.x, h.y, 0.12), '#64748b', 1.5);
      spikyBall(ctx, ball.x, ball.y, h.r, ball.angle, '#374151', null, time);
      break;
    }
    case 'flipper': {
      const pulse = 0.6 + 0.4 * Math.sin(time * 6), color = h.side === 1 ? '#22d3ee' : '#f472b6';
      ink(ctx, () => ctx.rect(h.x, h.y, h.w, h.h), '#1e293b', 1.5);
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
      for (let k = -0.5; k < h.w + 0.5; k += 0.5) ctx.fillRect(h.x + k + off, h.y + 0.05, 0.2, h.h - 0.1);
      ctx.restore();
      ctx.fillStyle = '#9ca3af';
      for (let k = 0.25; k < h.w; k += 1) { ctx.beginPath(); ctx.arc(h.x + k, h.y + h.h / 2, 0.08, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'spring': { // hongo que rebota
      ctx.save(); ctx.translate(h.x + h.w / 2, h.side === 1 ? FLOOR : CEIL);
      if (h.side === -1) ctx.scale(1, -1);
      const sq = 1 + Math.sin(time * 5 + h.id) * 0.05;
      ink(ctx, () => ctx.rect(-0.12, -0.3, 0.24, 0.3), '#fef3c7', 1.5);
      ink(ctx, () => { ctx.ellipse(0, -0.3, 0.5 * sq, 0.3 / sq, 0, Math.PI, Math.PI * 2); ctx.closePath(); }, '#ec4899');
      ctx.fillStyle = '#fdf2f8'; ctx.fillRect(-0.25, -0.45, 3 * P, 3 * P); ctx.fillRect(0.12, -0.5, 3 * P, 3 * P);
      glow(ctx, 0, -0.35, 0.7, '#f472b6', 0.3);
      ctx.restore();
      break;
    }
    case 'spores': {
      const c = sporeCenter(game, h);
      glow(ctx, c.x, c.y, h.r * 2.6, '#a3e635', 0.5 + 0.2 * Math.sin(time * 5 + h.id));
      ink(ctx, circle(ctx, c.x, c.y, h.r), '#84cc16', 1.5);
      ctx.fillStyle = '#ecfccb'; ctx.fillRect(c.x - 0.08, c.y - 0.08, 2 * P, 2 * P);
      break;
    }
    case 'waterfall': {
      ctx.fillStyle = '#22d3ee'; ctx.globalAlpha = 0.25; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#a5f3fc';
      for (let k = 0.15; k < h.w; k += 0.35) { const off = (time * 6 + hash(k * 9) * 3) % 1.5; for (let y = h.y - 1.5 + off; y < h.y + h.h; y += 1.5) ctx.fillRect(h.x + k, Math.max(h.y, y), P * 2, 0.6); }
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#ecfeff';
      for (let k = 0; k < h.w; k += 0.3) ctx.fillRect(h.x + k, FLOOR - 0.15 - Math.abs(Math.sin(time * 8 + k * 5)) * 0.15, 0.2, 0.15);
      ctx.globalAlpha = 1;
      break;
    }
    case 'plant': {
      ctx.save(); ctx.translate(h.x + h.w / 2, h.side === 1 ? FLOOR : CEIL);
      if (h.side === -1) ctx.scale(1, -1);
      const bite = plantBite(game, h), height = bite ? 1.35 : 0.45, open = bite ? 0.45 + Math.sin(time * 20) * 0.15 : 0.12;
      limb(ctx, [[0, 0], [Math.sin(time * 2) * 0.08, -height]], '#16a34a', P * 3);
      for (const s of [-1, 1]) ink(ctx, () => { ctx.ellipse(s * 0.18, -0.08, 0.2, 0.07, s * 0.4, 0, Math.PI * 2); }, '#22c55e', 1);
      ctx.translate(Math.sin(time * 2) * 0.08, -height);
      ink(ctx, () => { ctx.arc(0, 0, 0.3, Math.PI + open, Math.PI * 2 - open); ctx.lineTo(0, 0); ctx.closePath(); }, '#dc2626');
      ink(ctx, () => { ctx.arc(0, 0, 0.3, open, Math.PI - open); ctx.lineTo(0, 0); ctx.closePath(); }, '#dc2626');
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) for (let k = -0.15; k <= 0.15; k += 0.15) { ctx.beginPath(); ctx.moveTo(k - 0.04, s * Math.sin(open) * 0.08); ctx.lineTo(k + 0.04, s * Math.sin(open) * 0.08); ctx.lineTo(k, s * (Math.sin(open) * 0.08 - 0.1)); ctx.fill(); }
      ctx.fillStyle = '#fef08a'; ctx.fillRect(-0.18, -0.25, 2 * P, 2 * P); ctx.fillRect(0.1, 0.18, 2 * P, 2 * P);
      ctx.restore();
      break;
    }
    case 'lightning': {
      const state = lightningState(game, h), cx = h.x + h.w / 2;
      if (state === 'warn' && Math.sin(time * 30) > -0.2) {
        ctx.fillStyle = '#c4b5fd'; ctx.globalAlpha = 0.25; ctx.fillRect(h.x + 0.2, CEIL, h.w - 0.4, FLOOR - CEIL); ctx.globalAlpha = 1;
        glow(ctx, cx, CEIL, 1, '#c4b5fd', 0.6);
      }
      if (state === 'strike') {
        glow(ctx, cx, (CEIL + FLOOR) / 2, 3, '#e0e7ff', 0.5);
        for (const [color, width] of [['#a78bfa', 7 * P], ['#ffffff', 3 * P]] as const) {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(cx, CEIL);
          for (let y = CEIL; y < FLOOR; y += 0.6) ctx.lineTo(cx + (hash(Math.floor(time * 20) + y) - 0.5) * 0.7, y);
          ctx.lineTo(cx, FLOOR); ctx.stroke();
        }
      }
      break;
    }
    case 'meteor': {
      if (!h.active) break;
      const pulse = Math.sin(time * 20) > 0;
      ctx.strokeStyle = pulse ? '#ef4444' : '#fca5a5'; ctx.lineWidth = 2 * P; // la marca de dónde va a caer
      ctx.beginPath(); ctx.moveTo(h.x0 - 0.3, FLOOR - 0.35); ctx.lineTo(h.x0 + 0.3, FLOOR - 0.05); ctx.moveTo(h.x0 + 0.3, FLOOR - 0.35); ctx.lineTo(h.x0 - 0.3, FLOOR - 0.05); ctx.stroke();
      ctx.fillStyle = '#fb923c';
      for (let j = 1; j < 6; j++) { ctx.globalAlpha = 0.5 / j; ctx.beginPath(); ctx.arc(h.x + j * 0.25, h.y - j * 0.55, h.r * (1 - j * 0.12), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      glow(ctx, h.x, h.y, 1, '#f97316', 0.5);
      ink(ctx, circle(ctx, h.x, h.y, h.r), '#78350f');
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(h.x + 0.12, h.y - 0.15, h.r * 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'oxygen': { // tanque de oxígeno para recargar
      const y = h.y + Math.sin(time * 2 + h.id) * 0.1;
      glow(ctx, h.x, y, 0.9, '#38bdf8', 0.45 + 0.15 * Math.sin(time * 4));
      ink(ctx, () => ctx.roundRect(h.x - 0.2, y - 0.3, 0.4, 0.62, 0.14), '#e0f2fe');
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(h.x - 0.16, y - 0.05, 0.32, 0.22);
      ink(ctx, () => ctx.rect(h.x - 0.09, y - 0.42, 0.18, 0.13), '#64748b', 1.5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(h.x - 0.14, y - 0.24, P * 2, 0.15);
      ctx.fillStyle = '#0c4a6e'; ctx.font = `900 ${0.2}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('O₂', h.x, y + 0.06);
      break;
    }
    case 'ufo': {
      if (!h.active) break;
      const { x, y } = h;
      ctx.fillStyle = '#4ade80'; ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 6);
      ctx.beginPath(); ctx.moveTo(x - 0.5, y + 0.2); ctx.lineTo(x + 0.5, y + 0.2); ctx.lineTo(x + 1.3, FLOOR); ctx.lineTo(x - 1.3, FLOOR); ctx.fill(); ctx.globalAlpha = 1;
      ink(ctx, () => ctx.ellipse(x, y - 0.18, 0.5, 0.45, 0, Math.PI, Math.PI * 2), '#67e8f9');
      ink(ctx, circle(ctx, x, y - 0.25, 0.18), '#84cc16', 1);
      ctx.fillStyle = INK; ctx.fillRect(x - 0.1, y - 0.3, 2 * P, 2 * P); ctx.fillRect(x + 0.04, y - 0.3, 2 * P, 2 * P);
      ink(ctx, () => ctx.ellipse(x, y, h.w / 2 + 0.2, 0.3, 0, 0, Math.PI * 2), '#9ca3af');
      for (let k = -2; k <= 2; k++) { ctx.fillStyle = Math.sin(time * 10 + k) > 0 ? '#fde047' : '#f43f5e'; ctx.beginPath(); ctx.arc(x + k * 0.4, y + 0.05, 0.07, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
  }
}

function portal(ctx: CanvasRenderingContext2D, game: Game, t: Theme) {
  const x = game.portalX, w = 1.4, time = game.time;
  glow(ctx, x + w / 2, (CEIL + FLOOR) / 2, 3.5, t.portal, 0.5);
  const inner = ctx.createLinearGradient(x, 0, x + w, 0);
  inner.addColorStop(0, '#ffffff'); inner.addColorStop(0.5, t.portal); inner.addColorStop(1, '#ffffff');
  ctx.globalAlpha = 0.6 + 0.2 * Math.sin(time * 4); ctx.fillStyle = inner; ctx.fillRect(x + 0.2, CEIL, w - 0.4, FLOOR - CEIL); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = P * 1.5;
  for (let k = 0; k < 6; k++) { // remolinos que suben
    const y = CEIL + ((time * 2 + k * 1.4) % (FLOOR - CEIL));
    ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x + w / 2, y, 0.45, 0.15, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const side of [x, x + w - 0.25]) ink(ctx, () => ctx.rect(side, CEIL, 0.25, FLOOR - CEIL), '#1e293b', 1.5);
  ctx.fillStyle = t.portal;
  for (const side of [x, x + w - 0.25]) for (let y = CEIL + 0.4; y < FLOOR; y += 0.8) ctx.fillRect(side + 0.08, y, 0.09, 0.3);
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
  ctx.scale(1.05, 1.05);
  if (a.mirror) ctx.scale(-1, 1);
  if (a.squash && a.squash !== 1) { ctx.translate(0, 0.48); ctx.scale(1 + (1 - a.squash) * 0.6, a.squash); ctx.translate(0, -0.48); }
  const s = Math.sin(a.time * 14), c = Math.cos(a.time * 14), drift = Math.sin(a.time * 2.2);
  const bob = a.pose === 'idle' ? Math.sin(a.time * 3) * 0.02 : a.pose === 'run' ? Math.abs(c) * -0.03 : a.pose === 'float' ? drift * 0.04 : 0;
  ctx.translate(0, bob);
  if (a.pose === 'float') ctx.rotate(drift * 0.12); // flotando se balancea despacio
  const WHITE = '#f1f5f9', SHADE = '#c3cfdd', BLUE = '#2563eb';
  // Manos y pies según la pose.
  let feet: [[number, number], [number, number]] = [[-0.09, 0.44], [0.09, 0.44]];
  let hands: [[number, number], [number, number]] = [[-0.24, 0.13], [0.24, 0.13]];
  switch (a.pose) {
    case 'run': feet = [[-0.04 - s * 0.18, 0.44 - Math.max(0, c) * 0.09], [0.04 + s * 0.18, 0.44 - Math.max(0, -c) * 0.09]]; hands = [[-0.12 + s * 0.16, 0.12], [0.14 - s * 0.16, 0.1]]; break;
    case 'float': feet = [[-0.17, 0.4 + drift * 0.03], [0.13, 0.36 - drift * 0.03]]; hands = [[-0.31, -0.06 + drift * 0.05], [0.31, -0.12 - drift * 0.05]]; break;
    case 'thrust': feet = [[-0.14, 0.4], [-0.03, 0.43]]; hands = [[0.16, 0.04], [0.3, -0.06]]; break;
    case 'land': feet = [[-0.18, 0.45], [0.18, 0.45]]; hands = [[-0.3, 0.14], [0.3, 0.14]]; break;
  }
  const leg = (foot: [number, number], hipX: number) => {
    limb(ctx, [[hipX, 0.16], foot], WHITE, 0.15);
    ink(ctx, () => ctx.roundRect(foot[0] - 0.08, foot[1] - 0.04, 0.17, 0.09, 0.03), '#94a3b8', 1.5);
  };
  const arm = (hand: [number, number], shoulderX: number) => {
    limb(ctx, [[shoulderX, -0.06], hand], WHITE, 0.13);
    ink(ctx, circle(ctx, hand[0], hand[1], 0.065), SHADE, 1.5);
  };
  arm(hands[0], -0.1);
  ink(ctx, () => ctx.roundRect(-0.33, -0.22, 0.19, 0.38, 0.05), '#cbd5e1'); // tanque de oxígeno en la espalda
  ctx.fillStyle = '#38bdf8'; ctx.fillRect(-0.3, -0.12, 0.13, 0.08);
  leg(feet[0], -0.07);
  ink(ctx, () => ctx.roundRect(-0.19, -0.14, 0.38, 0.34, 0.1), WHITE); // cuerpo
  ctx.fillStyle = SHADE; ctx.fillRect(-0.16, 0.1, 0.32, 0.06);
  ink(ctx, () => ctx.roundRect(-0.04, -0.06, 0.16, 0.1, 0.03), '#3b82f6', 1); // panel del pecho
  ctx.fillStyle = '#93c5fd'; ctx.fillRect(-0.01, -0.04, 2 * P, P);
  leg(feet[1], 0.07);
  // Casco grande con el visor azul que brilla.
  ink(ctx, circle(ctx, 0.02, -0.29, 0.26), WHITE);
  ctx.fillStyle = SHADE; ctx.beginPath(); ctx.arc(0.02, -0.29, 0.26, Math.PI * 0.6, Math.PI * 1.1); ctx.lineTo(0.02, -0.29); ctx.fill();
  const visor = ctx.createLinearGradient(0, -0.45, 0.1, -0.15);
  visor.addColorStop(0, '#60a5fa'); visor.addColorStop(0.5, BLUE); visor.addColorStop(1, '#1e3a8a');
  ink(ctx, () => ctx.ellipse(0.1, -0.29, 0.17, 0.15, 0, 0, Math.PI * 2), visor, 2);
  ctx.fillStyle = '#dbeafe'; ctx.fillRect(0.04, -0.39, 3 * P, 2 * P); ctx.fillRect(0.02, -0.35, 2 * P, 2 * P);
  ink(ctx, circle(ctx, -0.14, -0.28, 0.065), BLUE, 1.5); // oreja del casco
  ctx.fillStyle = '#bfdbfe'; ctx.fillRect(-0.15, -0.29, P * 1.5, P * 1.5);
  arm(hands[1], 0.11);
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

// ---------- La pantalla girada ----------

// Cuánto se aleja la cámara y alrededor de qué punto gira. Derecha, muestra todo el ancho de la pantalla;
// de costado se aleja un poco y sigue al astronauta (mirando un poco hacia adelante), así nunca queda afuera.
export function viewOf(game: Game) {
  const side = Math.abs(Math.sin(game.view)), center = game.cam + game.cols / 2, follow = game.player.x + PLAYER_W / 2 + 2.5;
  return { z: 1 - 0.28 * side, px: center + (follow - center) * side, py: ROWS / 2 };
}
// Dónde queda en la pantalla un punto del pasillo.
export function toScreen(game: Game, x: number, y: number) {
  const { z, px, py } = viewOf(game), c = Math.cos(game.view), s = Math.sin(game.view), dx = x - px, dy = y - py;
  return { x: game.cols / 2 + z * (dx * c - dy * s), y: ROWS / 2 + z * (dx * s + dy * c) };
}

// El aviso de que la gravedad va a cambiar: el borde de la pantalla titila y una flecha grande marca
// hacia dónde va a tirar (en la pantalla de ahora).
function gravityWarning(ctx: CanvasRenderingContext2D, game: Game) {
  if (!game.warned || game.phase !== 'play') return;
  const left = Math.max(0, game.gravityIn) / WARN_SECONDS, on = Math.sin(game.time * 26) > 0;
  const color = '#f472b6';
  ctx.strokeStyle = color; ctx.lineWidth = 0.18 + (1 - left) * 0.12; ctx.globalAlpha = on ? 0.9 : 0.35;
  ctx.strokeRect(0.09, 0.09, game.cols - 0.18, ROWS - 0.18);
  const p = game.player, at = toScreen(game, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2), turn = game.nextAngle - game.view;
  ctx.save();
  ctx.translate(at.x, at.y); ctx.rotate(-turn); // la flecha apunta para abajo y se gira hacia la nueva gravedad
  for (let k = 0; k < 3; k++) {
    const y = 0.9 + k * 0.35;
    ink(ctx, () => { ctx.moveTo(-0.35, y); ctx.lineTo(0, y + 0.3); ctx.lineTo(0.35, y); ctx.lineTo(0.35, y + 0.12); ctx.lineTo(0, y + 0.42); ctx.lineTo(-0.35, y + 0.12); ctx.closePath(); }, color, 1.5);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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
  stars(ctx, 0, cols, game.time + t);
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

export function drawGame(ctx: CanvasRenderingContext2D, game: Game) {
  const t = THEMES[game.def.theme];
  if (game.phase === 'ending' || game.phase === 'won') { endingScene(ctx, game); return; }
  // Afuera del pasillo (por los pozos) está el vacío.
  ctx.fillStyle = '#04040a'; ctx.fillRect(0, 0, game.cols, ROWS);
  // Todo el pasillo se dibuja girado, para que la gravedad apunte siempre hacia abajo de la pantalla.
  const { z, px, py } = viewOf(game);
  ctx.save();
  ctx.translate(game.cols / 2, ROWS / 2); ctx.scale(z, z); ctx.rotate(game.view); ctx.translate(-px, -py);
  ctx.save();
  ctx.beginPath(); ctx.rect(game.cam - PAD, 0, game.cols + PAD * 2, ROWS); ctx.clip();
  ctx.translate(game.cam - PAD, 0);
  background(ctx, game, t, game.cols + PAD * 2);
  ctx.restore();
  if (game.def.theme === 'volcano') { // lava que se ve por los pozos
    const lava = ctx.createLinearGradient(0, FLOOR, 0, ROWS);
    lava.addColorStop(0, '#fde047'); lava.addColorStop(0.3, '#f97316'); lava.addColorStop(1, '#b91c1c');
    ctx.fillStyle = lava; ctx.fillRect(game.cam - PAD, FLOOR + 0.25 + Math.sin(game.time * 2) * 0.05, game.cols + PAD * 2, ROWS - FLOOR + 6);
  }
  const seen = (x: number, w = 0) => x + w > game.cam - PAD && x < game.cam + game.cols + PAD;
  edgeWall(ctx, game);
  for (const h of game.hazards) if (h.kind === 'waterfall' && seen(h.x, h.w)) drawHazard(ctx, h, game, t);
  for (const h of game.hazards) if ((h.kind === 'saw' || h.kind === 'geyser') && !h.dead && seen(h.x, h.len + 2)) drawHazard(ctx, h, game, t);
  if (seen(game.portalX, 2)) portal(ctx, game, t);
  for (const s of game.solids) if (seen(s.x, s.w)) drawSolid(ctx, s, t, game);
  for (const h of game.hazards) {
    if (h.dead || h.kind === 'waterfall' || h.kind === 'saw' || h.kind === 'geyser') continue;
    if (h.kind === 'ufo' || h.kind === 'asteroid' || h.kind === 'meteor' ? h.active : seen(h.x, h.w + h.len + 2)) drawHazard(ctx, h, game, t);
  }
  for (const b of game.bolts) { glow(ctx, b.x, b.y, b.r * 3, b.color, 0.6); ink(ctx, circle(ctx, b.x, b.y, b.r), b.color, 1.5); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - P, b.y - P, 2 * P, 2 * P); }
  drawPlayer(ctx, game);
  for (const b of game.blasts) {
    const k = b.t / b.max, r = b.r * (0.5 + k * 0.8);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, `rgba(255,255,220,${0.95 * (1 - k)})`); g.addColorStop(0.5, `rgba(251,146,60,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (const s of game.particles) {
    ctx.globalAlpha = Math.max(0, s.life / s.max); ctx.fillStyle = s.color;
    ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Viento: rayitas que pasan hacia atrás (por el pasillo, así giran con la pantalla).
  if (game.gust > 0) {
    ctx.save();
    ctx.translate(game.cols / 2, ROWS / 2); ctx.scale(z, z); ctx.rotate(game.view); ctx.translate(-px, -py);
    ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = P; ctx.globalAlpha = Math.min(1, game.gust) * 0.6;
    for (let i = 0; i < 18; i++) { const x = game.cam + game.cols - ((game.time * 18 + hash(i) * game.cols * 2) % (game.cols + 3)); const y = 1.5 + hash(i + 4) * 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.2, y); ctx.stroke(); }
    ctx.restore();
  }
  // Oscuridad de la tormenta: se ve alrededor del astronauta y todo cuando cae un rayo.
  if (game.def.dark && game.flash <= 0) {
    const p = game.player, { x: cx, y: cy } = toScreen(game, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2);
    const dark = ctx.createRadialGradient(cx, cy, 2.5, cx, cy, 9);
    dark.addColorStop(0, 'rgba(5,4,15,0)'); dark.addColorStop(1, 'rgba(5,4,15,0.62)');
    ctx.fillStyle = dark; ctx.fillRect(0, 0, game.cols, ROWS);
  }
  if (game.flash > 0) { ctx.fillStyle = `rgba(224,231,255,${game.flash * 1.6})`; ctx.fillRect(0, 0, game.cols, ROWS); }
  gravityWarning(ctx, game);
}
