// Las estructuras del medio de cada escenario (plataformas, lo que las sostiene, los emisores de los láseres y
// lo que mueve a los ascensores), cada una con el estilo de su planeta para que no se repitan:
//   Neon: vigas de acero remachadas con óxido, colgadas de cadenas con gancho.
//   Minado: rocas flotantes con cristales que brillan.          Órbita: plataformas antigravedad con luces.
//   Helado: bloques de hielo con nieve y carámbanos.            Volcánico: basalto con grietas de magma.
//   Fungi: hongos repisa con puntos que brillan y musgo.        Engranaje: pasarelas de rejilla sobre tijeras.
//   Tormenta: balcones góticos de piedra con pararrayos.        Ancestral: piedra tallada con glifos y enredaderas.
//   Selene: plataformas lunares con aislante dorado.           Metro: pasarelas con borde amarillo y varillas.
//   Abismo: tablones atados con sogas.                          Duna: arenisca con jeroglíficos y arena.
//   Coral: rocas con corales, anémonas y algas.                 Nimbo: mármol con oro sobre nubes.
//   Gladiador: travertino con laureles sobre una columna.
// Todo se dibuja en metros (el contexto ya está escalado; y crece hacia abajo).
import type { StageId } from './kombat';
import { alpha, bloom, darken, hash, lighten, lin, spec } from './gravityMonsters';

const TAU = Math.PI * 2;
type G = CanvasRenderingContext2D;

export type Emitter = 'metal' | 'crystal' | 'tech' | 'tesla' | 'gold';
export type LiftDrive = 'rails' | 'rope' | 'vine' | 'bubbles' | 'magic' | 'beam' | 'chain';
export const STRUCT: Record<StageId, { emitter: Emitter; mount: 'chain' | 'rod' | 'none'; lift: LiftDrive; thrusters: boolean }> = {
  industrial: { emitter: 'metal', mount: 'chain', lift: 'rails', thrusters: true },
  mines: { emitter: 'crystal', mount: 'none', lift: 'beam', thrusters: false },
  base: { emitter: 'tech', mount: 'rod', lift: 'rails', thrusters: true },
  ice: { emitter: 'crystal', mount: 'none', lift: 'magic', thrusters: false },
  volcano: { emitter: 'metal', mount: 'chain', lift: 'chain', thrusters: false },
  forest: { emitter: 'crystal', mount: 'none', lift: 'vine', thrusters: false },
  factory: { emitter: 'metal', mount: 'chain', lift: 'rails', thrusters: false },
  storm: { emitter: 'tesla', mount: 'none', lift: 'chain', thrusters: false },
  temple: { emitter: 'gold', mount: 'none', lift: 'rope', thrusters: false },
  moon: { emitter: 'tech', mount: 'rod', lift: 'rails', thrusters: true },
  subway: { emitter: 'metal', mount: 'rod', lift: 'rails', thrusters: false },
  pit: { emitter: 'metal', mount: 'chain', lift: 'rope', thrusters: false },
  desert: { emitter: 'gold', mount: 'none', lift: 'rope', thrusters: false },
  ocean: { emitter: 'crystal', mount: 'none', lift: 'bubbles', thrusters: false },
  sky: { emitter: 'gold', mount: 'none', lift: 'magic', thrusters: false },
  coliseum: { emitter: 'gold', mount: 'chain', lift: 'chain', thrusters: false },
};

// ---------------------------------------------------------------- piezas sueltas
function chain(g: G, x: number, y0: number, y1: number, color = '#2b2f3a', w = 0.05) {
  g.strokeStyle = color; g.lineWidth = w;
  for (let y = y0, k = 0; y < y1; y += 0.2, k++) { g.beginPath(); if (k % 2) g.ellipse(x, y, 0.035, 0.11, 0, 0, TAU); else g.ellipse(x, y, 0.07, 0.11, 0, 0, TAU); g.stroke(); }
  g.strokeStyle = lighten(color, 0.35); g.lineWidth = w * 0.4;
  for (let y = y0, k = 0; y < y1; y += 0.4, k++) { g.beginPath(); g.arc(x - 0.02, y, 0.05, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
}
function rope(g: G, x: number, y0: number, y1: number, sway = 0) {
  g.strokeStyle = '#6b4f2a'; g.lineWidth = 0.06; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + sway, (y0 + y1) / 2, x, y1); g.stroke();
  g.strokeStyle = 'rgba(30,18,6,0.7)'; g.lineWidth = 0.015;
  for (let y = y0; y < y1; y += 0.12) { const k = (y - y0) / Math.max(0.01, y1 - y0), sx = x + sway * 4 * k * (1 - k) * 0.5; g.beginPath(); g.moveTo(sx - 0.03, y); g.lineTo(sx + 0.03, y + 0.06); g.stroke(); }
}
function rod(g: G, x: number, y0: number, y1: number) {
  g.fillStyle = lin(g, x - 0.03, 0, x + 0.03, 0, [[0, '#2a303b'], [0.5, '#a9b3c2'], [1, '#2a303b']]); g.fillRect(x - 0.03, y0, 0.06, y1 - y0);
  g.fillStyle = '#4b5563'; g.fillRect(x - 0.07, y1 - 0.08, 0.14, 0.08);
}
function vine(g: G, x: number, y0: number, len: number, seed: number) {
  g.strokeStyle = '#2f6b25'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(x, y0);
  const s = (hash(seed) - 0.5) * 0.5; g.bezierCurveTo(x + s, y0 + len * 0.3, x - s, y0 + len * 0.7, x + s * 0.5, y0 + len); g.stroke();
  g.fillStyle = '#3f8f2f'; for (let k = 1; k < len / 0.25; k++) { const y = y0 + k * 0.25, lx = x + Math.sin(k * 1.7 + seed) * 0.08; g.beginPath(); g.ellipse(lx + (k % 2 ? 0.07 : -0.07), y, 0.08, 0.04, k % 2 ? 0.6 : -0.6, 0, TAU); g.fill(); }
}
function rivets(g: G, x0: number, x1: number, y: number, step = 0.3) { for (let x = x0 + step / 2; x < x1; x += step) { g.fillStyle = '#11151c'; g.beginPath(); g.arc(x, y, 0.035, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - 0.01, y - 0.012, 0.014, 0, TAU); g.fill(); } }
function rockOutline(g: G, x: number, y: number, w: number, depth: number, seed: number) {
  g.beginPath(); g.moveTo(x, y);
  const n = 9; for (let k = 0; k <= n; k++) { const u = k / n, d = depth * Math.sin(u * Math.PI) * (0.65 + hash(seed + k) * 0.5); g.lineTo(x + w - u * w + (hash(seed + k * 3) - 0.5) * 0.1, y + 0.1 + d); }
  g.lineTo(x, y); g.closePath();
}
function grain(g: G, x: number, y: number, w: number, h: number, seed: number, dark = 'rgba(0,0,0,0.18)', light = 'rgba(255,255,255,0.08)', n = 40) {
  for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? dark : light; g.fillRect(x + hash(seed + k * 1.3) * w, y + hash(seed + k * 2.7) * h, 0.03 + hash(k) * 0.05, 0.02); }
}

// ---------------------------------------------------------------- las plataformas
// (x, y): esquina de arriba a la izquierda de la parte que se pisa; (w, h): su tamaño. Lo decorativo puede salir
// para abajo (rocas, carámbanos, corales) pero arriba queda siempre la superficie donde se para la gente.
export function paintPlatform(g: G, stage: StageId, x: number, y: number, w: number, h: number, seed: number) {
  switch (stage) {
    case 'industrial': { // viga doble T con remaches, óxido y franja de peligro solo en el canto
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#56606e'], [0.5, '#323a46'], [1, '#1d232d']]);
      g.fillRect(x, y, w, h * 0.28); g.fillRect(x, y + h * 0.72, w, h * 0.28);
      g.fillStyle = '#262d38'; g.fillRect(x + 0.06, y + h * 0.28, w - 0.12, h * 0.44);
      for (let k = 0; k < w / 0.5; k++) { g.fillStyle = '#0d1016'; g.beginPath(); g.ellipse(x + 0.25 + k * 0.5, y + h / 2, 0.08, h * 0.12, 0, 0, TAU); g.fill(); }
      rivets(g, x, x + w, y + h * 0.14, 0.25); rivets(g, x, x + w, y + h * 0.86, 0.25);
      for (let k = 0; k < w * 2; k++) { const rx = x + hash(seed + k) * w; g.fillStyle = 'rgba(160,70,20,0.35)'; g.fillRect(rx, y + h * 0.28, 0.04, h * (0.3 + hash(k + seed) * 0.6)); } // chorreaduras de óxido
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, 0.02);
      for (let k = 0; k < w / 0.22; k++) { g.fillStyle = k % 2 ? '#111' : '#f5b301'; g.beginPath(); g.moveTo(x + k * 0.22, y + h * 0.72); g.lineTo(x + k * 0.22 + 0.11, y + h * 0.72); g.lineTo(x + k * 0.22 + 0.05, y + h); g.lineTo(x + k * 0.22 - 0.06, y + h); g.closePath(); g.fill(); }
      break;
    }
    case 'mines': { // roca flotante con cristales
      rockOutline(g, x, y, w, 0.9, seed); g.fillStyle = lin(g, 0, y, 0, y + 1, [[0, '#6a5a86'], [0.4, '#3b2f55'], [1, '#1a1428']]); g.fill();
      g.save(); rockOutline(g, x, y, w, 0.9, seed); g.clip(); grain(g, x, y, w, 1, seed, 'rgba(0,0,0,0.3)', 'rgba(200,180,255,0.12)', 60);
      for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(10,6,20,0.5)'; g.beginPath(); g.arc(x + w * hash(seed + k * 9), y + 0.35 + hash(k) * 0.3, 0.06 + hash(seed + k) * 0.06, 0, TAU); g.fill(); }
      g.restore();
      g.fillStyle = lin(g, 0, y, 0, y + h * 0.4, [[0, '#a99bc9'], [1, '#6a5a86']]); g.fillRect(x, y, w, h * 0.35);
      for (let k = 0; k < 3; k++) { // cristales que salen de abajo y de los costados
        const cx = x + w * (0.2 + k * 0.3 + (hash(seed + k) - 0.5) * 0.1), cy = y + 0.45 + hash(seed + k * 5) * 0.2, c = k % 2 ? '#22d3ee' : '#c084fc';
        for (let j = 0; j < 3; j++) { const a = Math.PI / 2 + (j - 1) * 0.45, L = 0.22 + j * 0.06; g.fillStyle = alpha(c, 0.85); g.beginPath(); g.moveTo(cx - 0.05, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.lineTo(cx + 0.05, cy); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(cx - 0.015, cy); g.lineTo(cx + Math.cos(a) * L * 0.8, cy + Math.sin(a) * L * 0.8); g.lineTo(cx, cy); g.fill(); }
        bloom(g, cx, cy + 0.15, 0.45, c, 0.5);
      }
      break;
    }
    case 'base': { // plataforma antigravedad: paneles blancos, luz celeste y el resplandor de abajo
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#f8fafc'], [0.55, '#cbd5e1'], [1, '#64748b']]); g.beginPath(); g.roundRect(x, y, w, h, 0.08); g.fill();
      g.strokeStyle = 'rgba(30,41,59,0.45)'; g.lineWidth = 0.015; for (let k = 1; k < w / 0.6; k++) { g.beginPath(); g.moveTo(x + k * 0.6, y + 0.04); g.lineTo(x + k * 0.6, y + h - 0.04); g.stroke(); }
      g.fillStyle = '#0ea5e9'; g.fillRect(x + 0.12, y + h * 0.55, w - 0.24, 0.05); bloom(g, x + w / 2, y + h * 0.58, w * 0.5, '#38bdf8', 0.35);
      for (const px of [x + w * 0.22, x + w * 0.78]) { g.fillStyle = '#334155'; g.beginPath(); g.ellipse(px, y + h, 0.22, 0.08, 0, 0, Math.PI); g.fill(); const cg = g.createLinearGradient(0, y + h, 0, y + h + 0.9); cg.addColorStop(0, 'rgba(56,189,248,0.45)'); cg.addColorStop(1, 'rgba(56,189,248,0)'); g.fillStyle = cg; g.beginPath(); g.moveTo(px - 0.16, y + h); g.lineTo(px - 0.32, y + h + 0.9); g.lineTo(px + 0.32, y + h + 0.9); g.lineTo(px + 0.16, y + h); g.fill(); }
      spec(g, x + w * 0.3, y + 0.06, w * 0.2, 0.025, 0, 0.6);
      break;
    }
    case 'ice': { // bloque de hielo grueso: nieve arriba, vetas adentro y carámbanos
      g.fillStyle = lin(g, x, y, x + w, y + h + 0.3, [[0, 'rgba(224,242,254,0.95)'], [0.5, 'rgba(125,182,230,0.92)'], [1, 'rgba(37,85,140,0.95)']]); g.beginPath(); g.roundRect(x, y, w, h + 0.25, 0.06); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.015; for (let k = 0; k < 5; k++) { const sx = x + hash(seed + k) * w; g.beginPath(); g.moveTo(sx, y + 0.1); g.lineTo(sx + 0.15, y + 0.25); g.lineTo(sx + 0.05, y + h + 0.2); g.stroke(); }
      g.fillStyle = '#f8fbff'; g.beginPath(); g.moveTo(x - 0.04, y + 0.06); for (let k = 0; k <= 8; k++) g.quadraticCurveTo(x + (k - 0.5) * w / 8, y - 0.1 - hash(seed + k) * 0.08, x + k * w / 8, y + 0.02); g.lineTo(x + w + 0.04, y + 0.08); g.closePath(); g.fill();
      for (let k = 0; k < w * 5; k++) { const ix = x + 0.05 + k / 5, il = 0.12 + hash(k + seed) * 0.4; g.fillStyle = lin(g, ix, y + h + 0.25, ix, y + h + 0.25 + il, [[0, 'rgba(224,242,254,0.95)'], [1, 'rgba(186,230,253,0.4)']]); g.beginPath(); g.moveTo(ix - 0.05, y + h + 0.24); g.lineTo(ix, y + h + 0.25 + il); g.lineTo(ix + 0.05, y + h + 0.24); g.fill(); }
      for (let k = 0; k < 4; k++) bloom(g, x + hash(seed + k * 4) * w, y + 0.05 + hash(k * 7) * h, 0.12, '#ffffff', 0.8);
      break;
    }
    case 'volcano': { // basalto en columnas hexagonales con grietas de magma y gotas que caen
      rockOutline(g, x, y, w, 0.7, seed); g.fillStyle = lin(g, 0, y, 0, y + 0.8, [[0, '#3a2a26'], [1, '#120a08']]); g.fill();
      for (let k = 0; k < w / 0.32; k++) { const cx = x + 0.16 + k * 0.32; g.fillStyle = k % 2 ? '#3b2e2a' : '#2e2320'; g.beginPath(); for (let j = 0; j < 6; j++) { const a = j * TAU / 6; g.lineTo(cx + Math.cos(a) * 0.17, y + 0.1 + Math.sin(a) * 0.08); } g.fill(); g.strokeStyle = '#140c0a'; g.lineWidth = 0.015; g.stroke(); }
      g.strokeStyle = '#ff7a1a'; g.lineWidth = 0.035;
      for (let k = 0; k < 3; k++) { const sx = x + w * (0.2 + k * 0.3); g.beginPath(); g.moveTo(sx, y + 0.2); g.lineTo(sx + 0.1, y + 0.4); g.lineTo(sx - 0.05, y + 0.55); g.stroke(); bloom(g, sx, y + 0.4, 0.3, '#ff6a00', 0.45); }
      for (let k = 0; k < 3; k++) { const dx = x + w * hash(seed + k * 3), dy = y + 0.75 + hash(k) * 0.3; g.fillStyle = '#ff9a3c'; g.beginPath(); g.ellipse(dx, dy, 0.03, 0.06, 0, 0, TAU); g.fill(); }
      break;
    }
    case 'forest': { // hongo repisa enorme: sombrero con puntos que brillan y laminillas abajo, con musgo y lianas
      g.fillStyle = lin(g, 0, y - 0.1, 0, y + h + 0.3, [[0, '#7c5a3a'], [0.5, '#4a3424'], [1, '#2a1c12']]); g.beginPath(); g.moveTo(x - 0.1, y + h * 0.6); g.quadraticCurveTo(x + w / 2, y - 0.25, x + w + 0.1, y + h * 0.6); g.quadraticCurveTo(x + w / 2, y + h + 0.35, x - 0.1, y + h * 0.6); g.fill();
      g.strokeStyle = 'rgba(240,220,190,0.35)'; g.lineWidth = 0.012; for (let k = 0; k < 14; k++) { const u = k / 13; g.beginPath(); g.moveTo(x + w / 2, y + h + 0.2); g.lineTo(x - 0.05 + u * (w + 0.1), y + h * 0.62); g.stroke(); }
      g.fillStyle = '#4d9a2f'; g.fillRect(x, y - 0.02, w, 0.06); for (let k = 0; k < w * 8; k++) g.fillRect(x + k / 8, y - 0.05 - hash(seed + k) * 0.06, 0.025, 0.06);
      for (let k = 0; k < 6; k++) { const px = x + w * (0.1 + k * 0.16), py = y + 0.1 + hash(seed + k) * 0.12; g.fillStyle = '#a7f3d0'; g.beginPath(); g.arc(px, py, 0.035, 0, TAU); g.fill(); bloom(g, px, py, 0.15, '#34d399', 0.6); }
      for (let k = 0; k < 3; k++) vine(g, x + w * (0.2 + k * 0.3), y + h + 0.1, 0.6 + hash(seed + k) * 0.8, seed + k);
      break;
    }
    case 'factory': { // pasarela de rejilla con baranda
      g.fillStyle = '#20262f'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#4b5563'; g.lineWidth = 0.02; for (let k = -2; k < w / 0.12 + 4; k++) { g.beginPath(); g.moveTo(x + k * 0.12, y); g.lineTo(x + k * 0.12 + h, y + h); g.moveTo(x + k * 0.12 + h, y); g.lineTo(x + k * 0.12, y + h); g.stroke(); }
      g.fillStyle = lin(g, 0, y, 0, y + 0.08, [[0, '#9aa5b5'], [1, '#3b4452']]); g.fillRect(x - 0.04, y, w + 0.08, 0.07); g.fillRect(x - 0.04, y + h - 0.06, w + 0.08, 0.06);
      g.strokeStyle = '#facc15'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(x + 0.05, y - 0.55); g.lineTo(x + w - 0.05, y - 0.55); g.moveTo(x + 0.05, y - 0.3); g.lineTo(x + w - 0.05, y - 0.3); g.stroke();
      for (let px = x + 0.05; px <= x + w; px += Math.max(0.5, (w - 0.1) / 3)) { g.fillStyle = '#ca8a04'; g.fillRect(px - 0.02, y - 0.58, 0.04, 0.58); }
      break;
    }
    case 'storm': { // balcón gótico de piedra con ménsula y pararrayos
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#5a6278'], [1, '#2a2f3e']]); g.fillRect(x, y, w, h);
      g.fillStyle = '#3d4458'; g.fillRect(x - 0.08, y, w + 0.16, 0.1); g.fillStyle = 'rgba(200,215,255,0.25)'; g.fillRect(x - 0.08, y, w + 0.16, 0.025);
      for (let k = 0; k < w / 0.4; k++) { g.fillStyle = '#232838'; g.beginPath(); g.moveTo(x + 0.1 + k * 0.4, y + h); g.lineTo(x + 0.3 + k * 0.4, y + h); g.lineTo(x + 0.2 + k * 0.4, y + h + 0.18); g.fill(); }
      g.fillStyle = '#2a2f3e'; g.beginPath(); g.moveTo(x + w * 0.3, y + h); g.lineTo(x + w * 0.7, y + h); g.lineTo(x + w * 0.5, y + h + 0.7); g.fill(); g.strokeStyle = '#151925'; g.lineWidth = 0.02; g.stroke();
      g.strokeStyle = '#94a3b8'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(x + w - 0.15, y); g.lineTo(x + w - 0.15, y - 0.75); g.stroke(); g.fillStyle = '#e2e8f0'; g.beginPath(); g.arc(x + w - 0.15, y - 0.78, 0.05, 0, TAU); g.fill(); bloom(g, x + w - 0.15, y - 0.78, 0.25, '#a5b4fc', 0.6);
      g.fillStyle = 'rgba(160,190,255,0.12)'; for (let k = 0; k < 6; k++) g.fillRect(x + hash(seed + k) * w, y + 0.12, 0.02, h * 0.6); // agua que chorrea
      break;
    }
    case 'temple': { // piedra tallada con glifos, musgo y enredaderas
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#a59a73'], [1, '#5f5640']]); g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(40,32,18,0.6)'; g.lineWidth = 0.018;
      for (let k = 0; k < w / 0.3 - 1; k++) { const gx = x + 0.2 + k * 0.3, gy = y + h * 0.3, kind = Math.floor(hash(seed + k) * 4); g.beginPath(); if (kind === 0) { g.arc(gx, gy + 0.08, 0.06, 0, TAU); } else if (kind === 1) { g.moveTo(gx - 0.06, gy); g.lineTo(gx, gy + 0.15); g.lineTo(gx + 0.06, gy); } else if (kind === 2) { g.rect(gx - 0.05, gy, 0.1, 0.14); g.moveTo(gx, gy); g.lineTo(gx, gy + 0.14); } else { g.moveTo(gx - 0.06, gy + 0.07); g.lineTo(gx + 0.06, gy + 0.07); g.moveTo(gx, gy); g.lineTo(gx, gy + 0.14); } g.stroke(); }
      g.fillStyle = '#4d7c2f'; g.beginPath(); g.moveTo(x, y + 0.02); for (let k = 0; k <= 10; k++) g.lineTo(x + k * w / 10, y - 0.03 - hash(seed + k) * 0.05); g.lineTo(x + w, y + 0.06); g.lineTo(x, y + 0.08); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(x + w - 0.25, y); g.lineTo(x + w, y); g.lineTo(x + w, y + 0.2); g.fill(); // esquina rota
      for (let k = 0; k < 2; k++) vine(g, x + w * (0.25 + k * 0.5), y + h, 0.5 + hash(seed + k * 3) * 0.7, seed + k * 5);
      break;
    }
    case 'moon': { // plataforma lunar: cubierta de metal con aislante dorado abajo y una luz
      g.fillStyle = lin(g, 0, y, 0, y + h * 0.5, [[0, '#e5e7eb'], [1, '#9ca3af']]); g.fillRect(x, y, w, h * 0.45);
      g.fillStyle = lin(g, 0, y + h * 0.45, 0, y + h + 0.15, [[0, '#f5c542'], [0.5, '#b8862b'], [1, '#7a5418']]); g.beginPath(); g.moveTo(x + 0.05, y + h * 0.45); g.lineTo(x + w - 0.05, y + h * 0.45); g.lineTo(x + w - 0.2, y + h + 0.15); g.lineTo(x + 0.2, y + h + 0.15); g.fill();
      g.strokeStyle = 'rgba(255,240,200,0.5)'; g.lineWidth = 0.012; for (let k = 0; k < w * 6; k++) { const cx = x + 0.1 + k / 6; g.beginPath(); g.moveTo(cx, y + h * 0.5); g.lineTo(cx + (hash(seed + k) - 0.5) * 0.1, y + h + 0.1); g.stroke(); } // el papel arrugado
      rivets(g, x, x + w, y + h * 0.22, 0.4);
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x + 0.15, y - 0.04, 0.04, 0, TAU); g.fill(); bloom(g, x + 0.15, y - 0.04, 0.2, '#ef4444', 0.6);
      break;
    }
    case 'subway': { // pasarela de chapa con borde amarillo de seguridad
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#6b7280'], [1, '#374151']]); g.fillRect(x, y, w, h);
      g.fillStyle = '#facc15'; g.fillRect(x, y, w, 0.09); g.fillStyle = '#a16207'; for (let k = 0; k < w / 0.08; k++) { g.beginPath(); g.arc(x + 0.04 + k * 0.08, y + 0.045, 0.014, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.012; for (let k = 0; k < w / 0.1; k++) { g.beginPath(); g.moveTo(x + k * 0.1, y + 0.12); g.lineTo(x + k * 0.1 + 0.05, y + h); g.stroke(); }
      g.fillStyle = '#1f2937'; g.fillRect(x + 0.1, y + h, w - 0.2, 0.08); g.fillStyle = '#111827'; g.fillRect(x + 0.2, y + h + 0.08, w - 0.4, 0.05); // bandeja de cables
      break;
    }
    case 'pit': { // tablones atados con soga
      g.fillStyle = '#2a1d12'; g.fillRect(x, y, w, h);
      for (let px = x, k = 0; px < x + w - 0.01; px += 0.3, k++) { const pw = Math.min(0.28, x + w - px); g.fillStyle = lin(g, px, 0, px + pw, 0, [[0, '#7a5533'], [1, k % 2 ? '#5e4026' : '#6b4a2c']]); g.fillRect(px + 0.01, y - (k % 3 === 1 ? 0.02 : 0), pw - 0.02, h + 0.04); g.strokeStyle = 'rgba(40,22,10,0.6)'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(px + 0.05, y + 0.05); g.lineTo(px + 0.08, y + h - 0.05); g.stroke(); }
      g.fillStyle = '#8b6a3e'; for (const px of [x + 0.15, x + w - 0.15]) for (let k = 0; k < 3; k++) g.fillRect(px - 0.08, y + 0.08 + k * 0.09, 0.16, 0.04); // amarres de soga
      break;
    }
    case 'desert': { // bloque de arenisca con una franja de jeroglíficos y arena que cae por el borde
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#e6c88f'], [1, '#a77b45']]); g.fillRect(x, y, w, h + 0.15);
      g.fillStyle = 'rgba(110,70,30,0.25)'; g.fillRect(x, y + h * 0.35, w, h * 0.4);
      g.fillStyle = 'rgba(70,40,15,0.7)'; for (let k = 0; k < w / 0.22; k++) { const gx = x + 0.1 + k * 0.22, gy = y + h * 0.4, kd = Math.floor(hash(seed + k) * 3); if (kd === 0) { g.beginPath(); g.ellipse(gx, gy + 0.07, 0.05, 0.03, 0, 0, TAU); g.fill(); g.fillRect(gx - 0.01, gy + 0.08, 0.02, 0.06); } else if (kd === 1) g.fillRect(gx - 0.04, gy + 0.02, 0.02, 0.12); else { g.beginPath(); g.moveTo(gx - 0.05, gy + 0.14); g.lineTo(gx, gy); g.lineTo(gx + 0.05, gy + 0.14); g.fill(); } }
      g.fillStyle = '#f2dcae'; g.beginPath(); g.moveTo(x, y + 0.02); g.quadraticCurveTo(x + w * 0.4, y - 0.14, x + w * 0.75, y); g.lineTo(x, y + 0.02); g.fill();
      g.fillStyle = 'rgba(230,200,143,0.55)'; g.fillRect(x + w - 0.08, y + h + 0.1, 0.04, 0.8); // la arena que cae
      break;
    }
    case 'ocean': { // roca con corales, anémonas, percebes y algas
      rockOutline(g, x, y, w, 0.75, seed); g.fillStyle = lin(g, 0, y, 0, y + 0.8, [[0, '#6f7f7e'], [1, '#23302f']]); g.fill();
      g.fillStyle = lin(g, 0, y, 0, y + h * 0.5, [[0, '#8a9a96'], [1, '#5d6b69']]); g.fillRect(x, y, w, h * 0.4);
      for (let k = 0; k < 6; k++) { const px = x + w * (0.08 + k * 0.17), c = ['#f472b6', '#fb923c', '#facc15', '#a78bfa'][k % 4]; g.fillStyle = c; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(px + (j - 1.5) * 0.04, y - 0.05 - (j % 2) * 0.04, 0.025, 0.07, (j - 1.5) * 0.4, 0, TAU); g.fill(); } }
      for (let k = 0; k < 8; k++) { g.fillStyle = '#d6d3c4'; g.beginPath(); g.arc(x + hash(seed + k) * w, y + 0.25 + hash(k * 3) * 0.3, 0.03, 0, TAU); g.fill(); }
      for (let k = 0; k < 3; k++) { const px = x + w * (0.2 + k * 0.3); g.strokeStyle = '#3f7d2a'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(px, y + 0.5); g.quadraticCurveTo(px + 0.15, y + 0.8, px - 0.05, y + 1.1 + hash(seed + k) * 0.4); g.stroke(); }
      break;
    }
    case 'sky': { // mármol con borde dorado sobre nubes
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(255,255,255,${0.8 - k * 0.08})`; g.beginPath(); g.ellipse(x + w * (0.1 + k * 0.2), y + h + 0.12, 0.35, 0.2, 0, 0, TAU); g.fill(); }
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#ffffff'], [1, '#d6d3d1']]); g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(120,113,108,0.35)'; g.lineWidth = 0.012; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + hash(seed + k) * w, y); g.bezierCurveTo(x + hash(k + 1) * w, y + h * 0.4, x + hash(k + 2) * w, y + h * 0.6, x + hash(seed + k * 2) * w, y + h); g.stroke(); } // vetas
      g.fillStyle = lin(g, 0, y, 0, y + 0.08, [[0, '#fde68a'], [1, '#b45309']]); g.fillRect(x - 0.05, y, w + 0.1, 0.07); g.fillRect(x - 0.05, y + h - 0.05, w + 0.1, 0.05);
      g.strokeStyle = '#d97706'; g.lineWidth = 0.015; for (let k = 0; k < w / 0.3; k++) { g.beginPath(); g.arc(x + 0.15 + k * 0.3, y + h * 0.55, 0.06, Math.PI, TAU); g.stroke(); }
      break;
    }
    case 'coliseum': { // travertino con laureles en relieve y argollas de bronce
      g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#efe3c8'], [1, '#bda77d']]); g.fillRect(x, y, w, h);
      grain(g, x, y, w, h, seed, 'rgba(120,95,50,0.35)', 'rgba(255,255,255,0.15)', 50);
      g.strokeStyle = 'rgba(110,85,40,0.55)'; g.lineWidth = 0.014; g.beginPath(); g.moveTo(x + 0.2, y + h * 0.5); g.lineTo(x + w - 0.2, y + h * 0.5); g.stroke();
      for (let k = 0; k < (w - 0.4) / 0.14; k++) { const lx = x + 0.25 + k * 0.14; g.beginPath(); g.ellipse(lx, y + h * 0.5 - 0.04, 0.05, 0.02, -0.5, 0, TAU); g.ellipse(lx + 0.05, y + h * 0.5 + 0.04, 0.05, 0.02, 0.5, 0, TAU); g.stroke(); }
      g.strokeStyle = '#a16207'; g.lineWidth = 0.03; for (const px of [x + 0.12, x + w - 0.12]) { g.beginPath(); g.arc(px, y + h * 0.5, 0.07, 0, TAU); g.stroke(); }
      break;
    }
  }
}

// Lo que sostiene a las plataformas quietas (cadenas, varillas, sogas, enredaderas, una tijera hidráulica, una
// columna) o nada (las que flotan).
export function paintSupport(g: G, stage: StageId, x: number, y: number, w: number, h: number, seed: number, ceil: number) {
  switch (stage) {
    case 'industrial': {
      const c = '#2b2f3a';
      for (const px of [x + w * 0.15, x + w * 0.85]) chain(g, px, ceil, y - 0.18, c);
      g.strokeStyle = c; g.lineWidth = 0.05; for (const px of [x + w * 0.15, x + w * 0.85]) { g.beginPath(); g.arc(px, y - 0.1, 0.08, Math.PI * 0.2, Math.PI * 1.3); g.stroke(); } // ganchos
      break;
    }
    case 'storm': chain(g, x + w * 0.85, ceil, y - 0.1, '#1f2430'); break;
    case 'subway': for (const px of [x + w * 0.2, x + w * 0.8]) rod(g, px, ceil, y); break;
    case 'pit': for (const px of [x + w * 0.12, x + w * 0.88]) rope(g, px, ceil, y + 0.08, (hash(seed + px) - 0.5) * 0.3); break;
    case 'temple': for (let k = 0; k < 3; k++) vine(g, x + w * (0.15 + k * 0.35), ceil, y - ceil + 0.05, seed + k * 11); break;
    case 'factory': { // tijera hidráulica desde el piso
      const n = 4, top = y + h, seg = -top / n;
      g.strokeStyle = '#ca8a04'; g.lineWidth = 0.07;
      for (let k = 0; k < n; k++) { const y0 = top + k * seg; g.beginPath(); g.moveTo(x + w * 0.25, y0); g.lineTo(x + w * 0.75, y0 + seg); g.moveTo(x + w * 0.75, y0); g.lineTo(x + w * 0.25, y0 + seg); g.stroke(); g.fillStyle = '#1f2937'; g.beginPath(); g.arc(x + w * 0.5, y0 + seg / 2, 0.05, 0, TAU); g.fill(); }
      g.fillStyle = lin(g, x + w * 0.45, 0, x + w * 0.55, 0, [[0, '#4b5563'], [0.5, '#d1d5db'], [1, '#374151']]); g.fillRect(x + w * 0.46, top, w * 0.08, -top * 0.6);
      g.fillStyle = '#374151'; g.fillRect(x + w * 0.15, -0.12, w * 0.7, 0.12);
      break;
    }
    default: break;
  }
  if (stage === 'coliseum') { // además, una columna jónica que la sostiene desde el piso (detrás)
    const cx = x + w / 2, top = y + h, cw = 0.42;
    g.fillStyle = lin(g, cx - cw / 2, 0, cx + cw / 2, 0, [[0, '#a8946a'], [0.4, '#f3e8cf'], [1, '#8f7a50']]); g.fillRect(cx - cw / 2, top + 0.15, cw, -top - 0.15);
    g.strokeStyle = 'rgba(110,85,40,0.35)'; g.lineWidth = 0.012; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cx - cw / 2 + k * cw / 5, top + 0.15); g.lineTo(cx - cw / 2 + k * cw / 5, 0); g.stroke(); }
    g.fillStyle = '#e7dcc0'; g.fillRect(cx - cw * 0.8, top, cw * 1.6, 0.15); g.beginPath(); g.arc(cx - cw * 0.7, top + 0.12, 0.08, 0, TAU); g.arc(cx + cw * 0.7, top + 0.12, 0.08, 0, TAU); g.fill();
    g.fillStyle = '#cdbd97'; g.fillRect(cx - cw * 0.75, -0.12, cw * 1.5, 0.12);
  }
}

// ---------------------------------------------------------------- emisores de láser
// floorEnd: el de abajo (apoyado en el piso o en una plataforma) o el de arriba.
export function paintEmitter(g: G, style: Emitter, x: number, y: number, floorEnd: boolean, on: boolean, warn: boolean, color: string, t: number) {
  const ly = floorEnd ? y : y + 0.36; // dónde está la lente
  switch (style) {
    case 'crystal': { // un cristal flotante que gira despacio
      const cy = floorEnd ? y + 0.15 : y + 0.18, bob = Math.sin(t * 2 + x) * 0.03;
      g.fillStyle = alpha(color, 0.25); g.beginPath(); g.ellipse(x, cy + bob, 0.32, 0.22, 0, 0, TAU); g.fill();
      g.fillStyle = lin(g, x - 0.15, 0, x + 0.15, 0, [[0, darken(color, 0.4)], [0.5, lighten(color, 0.5)], [1, darken(color, 0.3)]]);
      g.beginPath(); g.moveTo(x, cy - 0.24 + bob); g.lineTo(x + 0.13, cy + bob); g.lineTo(x, cy + 0.24 + bob); g.lineTo(x - 0.13, cy + bob); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.012; g.beginPath(); g.moveTo(x, cy - 0.24 + bob); g.lineTo(x, cy + 0.24 + bob); g.moveTo(x - 0.13, cy + bob); g.lineTo(x + 0.13, cy + bob); g.stroke();
      bloom(g, x, cy, 0.5, color, on ? 0.9 : warn ? 0.5 + 0.3 * Math.sin(t * 40) : 0.25);
      return;
    }
    case 'tesla': { // bobina de cobre con anillo arriba (en la tormenta)
      const by = floorEnd ? y : y - 0.1;
      g.fillStyle = '#3b3f4a'; g.fillRect(x - 0.22, floorEnd ? by + 0.24 : by, 0.44, 0.12);
      g.fillStyle = lin(g, x - 0.1, 0, x + 0.1, 0, [[0, '#7c3a10'], [0.5, '#e7a35a'], [1, '#6b2f0c']]); g.fillRect(x - 0.1, floorEnd ? by + 0.04 : by + 0.12, 0.2, 0.22);
      g.strokeStyle = 'rgba(60,25,5,0.7)'; g.lineWidth = 0.012; for (let k = 0; k < 7; k++) { const yy = (floorEnd ? by + 0.05 : by + 0.13) + k * 0.03; g.beginPath(); g.moveTo(x - 0.1, yy); g.lineTo(x + 0.1, yy + 0.01); g.stroke(); }
      g.strokeStyle = '#cbd5e1'; g.lineWidth = 0.05; g.beginPath(); g.ellipse(x, ly, 0.16, 0.06, 0, 0, TAU); g.stroke();
      if (on || warn) { g.strokeStyle = alpha(lighten(color, 0.5), on ? 0.9 : 0.5); g.lineWidth = 0.012; for (let k = 0; k < 3; k++) { const a = hash(k + Math.floor(t * 18)) * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * 0.16, ly + Math.sin(a) * 0.06); g.lineTo(x + Math.cos(a) * 0.32, ly + Math.sin(a) * 0.2 + 0.05); g.lineTo(x + Math.cos(a) * 0.45, ly + Math.sin(a) * 0.12); g.stroke(); } }
      bloom(g, x, ly, 0.45, color, on ? 0.8 : warn ? 0.4 : 0.15);
      return;
    }
    case 'tech': { // cápsula blanca redondeada con anillo de luz
      g.fillStyle = lin(g, x - 0.3, 0, x + 0.3, 0, [[0, '#94a3b8'], [0.4, '#f8fafc'], [1, '#64748b']]); g.beginPath(); g.roundRect(x - 0.28, y, 0.56, 0.36, 0.15); g.fill();
      g.fillStyle = alpha(color, on ? 0.9 : warn ? 0.5 : 0.2); g.fillRect(x - 0.2, floorEnd ? y + 0.24 : y + 0.08, 0.4, 0.04);
      break;
    }
    case 'gold': { // ornamento dorado con una gema
      g.fillStyle = lin(g, x - 0.3, 0, x + 0.3, 0, [[0, '#92400e'], [0.45, '#fde68a'], [1, '#78350f']]);
      g.beginPath(); g.moveTo(x - 0.3, floorEnd ? y + 0.36 : y); g.quadraticCurveTo(x, floorEnd ? y - 0.08 : y + 0.44, x + 0.3, floorEnd ? y + 0.36 : y); g.closePath(); g.fill();
      g.strokeStyle = '#78350f'; g.lineWidth = 0.015; g.stroke();
      for (const sx of [-0.2, 0.2]) { g.fillStyle = '#fbbf24'; g.beginPath(); g.arc(x + sx, floorEnd ? y + 0.3 : y + 0.06, 0.04, 0, TAU); g.fill(); }
      break;
    }
    default: { // metal: la caja de siempre, más trabajada
      g.fillStyle = lin(g, x - 0.32, 0, x + 0.32, 0, [[0, '#2a313c'], [0.5, '#5b6575'], [1, '#232a34']]); g.fillRect(x - 0.32, y, 0.64, 0.36);
      g.strokeStyle = '#11151c'; g.lineWidth = 0.02; g.strokeRect(x - 0.32, y, 0.64, 0.36);
      g.fillStyle = '#0b0f17'; for (let k = 0; k < 4; k++) g.fillRect(x - 0.25 + k * 0.13, floorEnd ? y + 0.2 : y + 0.06, 0.07, 0.1);
      for (const sx of [-0.27, 0.27]) { g.fillStyle = '#9aa5b5'; g.beginPath(); g.arc(x + sx, floorEnd ? y + 0.06 : y + 0.3, 0.025, 0, TAU); g.fill(); }
      g.fillStyle = on ? '#ef4444' : warn ? (Math.sin(t * 30) > 0 ? '#fbbf24' : '#78350f') : '#22c55e'; g.beginPath(); g.arc(x + 0.2, floorEnd ? y + 0.1 : y + 0.26, 0.03, 0, TAU); g.fill();
    }
  }
  // la lente (común a metal, tech y gold)
  g.beginPath(); g.ellipse(x, ly, 0.17, 0.075, 0, 0, TAU); g.fillStyle = '#11151c'; g.fill(); g.strokeStyle = style === 'gold' ? '#fbbf24' : '#8b95a5'; g.lineWidth = 0.015; g.stroke();
  const lg = g.createRadialGradient(x, ly, 0, x, ly, 0.12);
  lg.addColorStop(0, on ? '#ffffff' : warn ? lighten(color, 0.4) : '#2a3442'); lg.addColorStop(0.5, on || warn ? color : '#1a2230'); lg.addColorStop(1, '#05070a');
  g.fillStyle = lg; g.beginPath(); g.ellipse(x, ly, 0.12, 0.05, 0, 0, TAU); g.fill();
  if (on) bloom(g, x, ly, 0.45, color, 0.8); else if (warn) bloom(g, x, ly, 0.3, color, 0.4 + 0.3 * Math.sin(t * 40));
}
export function paintEmitterMount(g: G, stage: StageId, x: number, ceil: number, y: number) {
  const st = STRUCT[stage];
  if (st.mount === 'chain') chain(g, x, ceil, y, stage === 'coliseum' ? '#8a6a2a' : '#2b2f3a');
  else if (st.mount === 'rod') rod(g, x, ceil, y);
}

// ---------------------------------------------------------------- lo que mueve a los ascensores
// (en píxeles: x, w, top y gy ya están en la pantalla; s = píxeles por metro)
export function paintLiftDrive(g: G, stage: StageId, x: number, w: number, top: number, yTop: number, gy: number, s: number, t: number, edge: string) {
  const d = STRUCT[stage].lift;
  if (d === 'rails') {
    for (const px of [x - s * 0.12, x + w + s * 0.02]) {
      g.fillStyle = lin(g, px, 0, px + s * 0.1, 0, [[0, '#1b2130'], [0.5, '#7b8698'], [1, '#141a26']]); g.fillRect(px, yTop, s * 0.1, gy - yTop);
      for (let yy = yTop + s * 0.3; yy < gy; yy += s * 0.6) { g.fillStyle = alpha(edge, 0.55 + 0.45 * Math.sin(t * 4 + yy * 0.05)); g.fillRect(px + s * 0.03, yy, s * 0.04, s * 0.08); }
    }
    g.strokeStyle = '#3a4252'; g.lineWidth = Math.max(1, s * 0.04); g.setLineDash([s * 0.08, s * 0.06]); g.beginPath(); g.moveTo(x + w / 2, yTop); g.lineTo(x + w / 2, top); g.stroke(); g.setLineDash([]);
    return;
  }
  if (d === 'rope' || d === 'chain' || d === 'vine') { // dos sogas/cadenas/lianas hasta una polea arriba
    for (const px of [x + w * 0.15, x + w * 0.85]) {
      if (d === 'chain') { g.save(); g.translate(px, 0); g.scale(s, s); chain(g, 0, -0.2, top / s, stage === 'coliseum' ? '#8a6a2a' : '#2b2f3a', 0.05); g.restore(); }
      else { g.strokeStyle = d === 'vine' ? '#2f6b25' : '#6b4f2a'; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, top); g.stroke(); if (d === 'vine') { g.fillStyle = '#3f8f2f'; for (let yy = s * 0.2; yy < top; yy += s * 0.3) { g.beginPath(); g.ellipse(px + s * 0.08, yy, s * 0.08, s * 0.035, 0.6, 0, TAU); g.fill(); } } else { g.strokeStyle = 'rgba(30,18,6,0.6)'; g.lineWidth = Math.max(1, s * 0.015); for (let yy = 0; yy < top; yy += s * 0.12) { g.beginPath(); g.moveTo(px - s * 0.03, yy); g.lineTo(px + s * 0.03, yy + s * 0.06); g.stroke(); } } }
      g.fillStyle = '#57534e'; g.beginPath(); g.arc(px, top - s * 0.05, s * 0.07, 0, TAU); g.fill(); // la argolla donde se ata
    }
    return;
  }
  if (d === 'bubbles') { // una columna de burbujas que la empuja
    for (let k = 0; k < 14; k++) { const ph = (t * 0.7 + hash(k)) % 1, by = gy - ph * (gy - top - s * 0.4), bx = x + w * (0.2 + hash(k * 3) * 0.6) + Math.sin(t * 3 + k) * s * 0.08; g.strokeStyle = `rgba(200,240,255,${0.6 * (1 - ph * 0.5)})`; g.lineWidth = Math.max(1, s * 0.02); g.beginPath(); g.arc(bx, by, s * (0.05 + hash(k * 7) * 0.08), 0, TAU); g.stroke(); }
    return;
  }
  // magia / rayo tractor: un haz de luz que la sostiene, con chispas que suben
  const c = d === 'beam' ? '#c084fc' : stage === 'ice' ? '#bae6fd' : '#fde68a';
  const gr = g.createLinearGradient(0, top, 0, gy); gr.addColorStop(0, alpha(c, 0.35)); gr.addColorStop(1, alpha(c, 0.05));
  g.fillStyle = gr; g.beginPath(); g.moveTo(x + w * 0.15, top + s * 0.3); g.lineTo(x + w * 0.85, top + s * 0.3); g.lineTo(x + w * 1.05, gy); g.lineTo(x - w * 0.05, gy); g.fill();
  for (let k = 0; k < 10; k++) { const ph = (t * 0.5 + hash(k)) % 1; g.fillStyle = alpha('#ffffff', 0.7 * (1 - ph)); g.fillRect(x + w * hash(k * 5), gy - ph * (gy - top), Math.max(1, s * 0.04), Math.max(1, s * 0.04)); }
}
// El riel de las plataformas que van y vienen: acero en los escenarios tecnológicos, soga o cadena en los otros,
// o nada en los mágicos (flotan solas).
export function paintSlideRail(g: G, stage: StageId, xa: number, xb: number, ry: number, hangers: number[], top: number, s: number) {
  const d = STRUCT[stage].lift;
  if (d === 'magic' || d === 'beam' || d === 'bubbles') return;
  if (d === 'rails') { g.fillStyle = lin(g, 0, ry - s * 0.08, 0, ry + s * 0.08, [[0, '#9aa6b8'], [1, '#232a38']]); g.fillRect(xa, ry - s * 0.06, xb - xa, s * 0.12); }
  else { g.strokeStyle = d === 'chain' ? '#3a3f4a' : d === 'vine' ? '#2f6b25' : '#6b4f2a'; g.lineWidth = Math.max(1, s * 0.07); g.beginPath(); g.moveTo(xa, ry); g.quadraticCurveTo((xa + xb) / 2, ry + s * 0.25, xb, ry); g.stroke(); }
  for (const px of hangers) { g.strokeStyle = d === 'rails' ? '#2b3240' : d === 'vine' ? '#2f6b25' : '#6b4f2a'; g.lineWidth = Math.max(1, s * 0.05); g.beginPath(); g.moveTo(px, ry); g.lineTo(px, top); g.stroke(); g.fillStyle = d === 'rails' ? '#4b5563' : '#57534e'; g.beginPath(); g.arc(px, ry, s * 0.1, 0, TAU); g.fill(); }
}
