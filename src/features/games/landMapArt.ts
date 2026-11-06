// Land of Warriors: el dibujo del escenario generado (se pinta una sola vez en un lienzo grande y después se copia).
import { BLOCK, BRIDGE, LIQUID, T, THEMES, type Terrain, type Theme } from './landMap';

function rng(seed: number) { let s = (seed % 2147483647) || 3; return () => (s = (s * 48271) % 2147483647) / 2147483647; }
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
const shade = (c: string, k: number) => { const A = hex(c); return `rgb(${A.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`; };

export function renderTerrain(t: Terrain): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = t.w; cv.height = t.h;
  const ctx = cv.getContext('2d')!, th = THEMES[t.theme], R = rng(t.seed * 7 + 1), { cols, rows, cells } = t;
  const at = (c: number, r: number) => c < 0 || r < 0 || c >= cols || r >= rows ? -1 : cells[r * cols + c];
  // 1) el piso: manchas de color suaves (un lienzo chico agrandado) y encima la textura
  const small = document.createElement('canvas'); small.width = cols; small.height = rows; const sc = small.getContext('2d')!;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = R(); sc.fillStyle = k < 0.33 ? th.ground[0] : k < 0.66 ? mix(th.ground[0], th.ground[1], 0.6) : mix(th.ground[0], th.ground[2], 0.6); sc.fillRect(c, r, 1, 1); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small, 0, 0, t.w, t.h);
  groundTexture(ctx, t, th, R);
  // 2) los caminos de tierra entre las bases y los cristales
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const [b0, b1] = t.bases.map(([c, r]) => [(c + 0.5) * T, (r + 0.5) * T]);
  const via = t.spots.slice(0, 3).map(([c, r]) => [(c + 0.5) * T, (r + 0.5) * T]);
  for (const [w, a] of [[T * 2.2, 0.35], [T * 1.4, 0.55]] as const) {
    ctx.strokeStyle = th.path; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.filter = 'blur(6px)';
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); for (const p of via) ctx.lineTo(p[0], p[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.bezierCurveTo(t.w * 0.3, t.h * 0.2, t.w * 0.7, t.h * 0.8, b1[0], b1[1]); ctx.stroke();
  }
  ctx.restore();
  // 3) los líquidos: orilla, borde y fondo (círculos superpuestos: formas redondeadas)
  const liq: [number, number][] = [], bridges: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = cells[r * cols + c]; if (k === LIQUID || k === BRIDGE) liq.push([c, r]); if (k === BRIDGE) bridges.push([c, r]); }
  // (se pinta en un lienzo a un cuarto del tamaño y se agranda: así las orillas quedan suaves sin desenfocar mil veces)
  const Q = 0.25, lay = document.createElement('canvas'); lay.width = Math.ceil(t.w * Q); lay.height = Math.ceil(t.h * Q); const lc = lay.getContext('2d')!;
  const disc = (c: number, r: number, rad: number) => { lc.beginPath(); lc.arc((c + 0.5) * T * Q, (r + 0.5) * T * Q, rad * Q, 0, Math.PI * 2); lc.fill(); };
  lc.fillStyle = th.shore; for (const [c, r] of liq) disc(c, r, T * 0.98);
  lc.fillStyle = th.liquid[1]; for (const [c, r] of liq) disc(c, r, T * 0.76);
  lc.fillStyle = th.liquid[2]; for (const [c, r] of liq) { let deep = 0; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = at(c + dc, r + dr); if (k === LIQUID || k === BRIDGE) deep++; } if (deep >= 4) disc(c, r, T * 0.6); }
  ctx.drawImage(lay, 0, 0, t.w, t.h);
  if (th.glow) { // el resplandor de la lava o del ácido
    lc.clearRect(0, 0, lay.width, lay.height); lc.fillStyle = th.glow; for (const [c, r] of liq) disc(c, r, T * 1.1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.filter = 'blur(8px)'; ctx.drawImage(lay, 0, 0, t.w, t.h); ctx.restore();
  }
  ctx.save();
  for (const [c, r] of liq) for (let i = 0; i < 2; i++) { // brillos y ondas
    const x = (c + R()) * T, y = (r + R()) * T, w = T * (0.3 + R() * 0.5);
    ctx.strokeStyle = th.glow ? 'rgba(255,240,180,0.55)' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y - 4, x + w / 2, y); ctx.stroke();
  }
  ctx.restore();
  // 4) los puentes (tablones de madera o losas de piedra, según el estilo)
  for (const [c, r] of bridges) { // tablones (o losas) y las barandas arriba y abajo
    const x = c * T, y = r * T, stone = th.block === 'ruin' || th.block === 'rock';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 1, y + 8, T + 2, T);
    ctx.fillStyle = stone ? '#77706a' : '#9a6634'; ctx.fillRect(x - 1, y - 4, T + 2, T + 8);
    ctx.strokeStyle = stone ? '#3c3633' : '#4a2e14'; ctx.lineWidth = 2;
    for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * T / 4, y - 4); ctx.lineTo(x + k * T / 4, y + T + 4); ctx.stroke(); }
    ctx.fillStyle = stone ? 'rgba(255,255,255,0.14)' : 'rgba(255,220,160,0.2)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + k * T / 4 + 2, y - 4, 3, T + 8);
    for (const ry of [y - 6, y + T + 2]) { ctx.fillStyle = stone ? '#4e4743' : '#5a3418'; ctx.fillRect(x - 1, ry, T + 2, 5); ctx.fillRect(x + T / 2 - 3, ry - 6, 6, 11); }
  }
  // 5) los obstáculos y los adornos, de atrás para adelante (los de más abajo tapan a los de más arriba)
  const things: { y: number; d: () => void }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (cells[r * cols + c] === BLOCK) {
    const x = (c + 0.5) * T + (R() - 0.5) * 10, y = (r + 0.5) * T + (R() - 0.5) * 10, kind = th.block === 'mixed' ? (R() < 0.6 ? 'rock' : 'forest') : th.block, s = 0.85 + R() * 0.5, seed = R();
    things.push({ y, d: () => kind === 'forest' ? tree(ctx, x, y + 12, s, th, seed) : kind === 'ruin' ? (seed < 0.35 ? pillar(ctx, x, y + 14, s, th) : rock(ctx, x, y + 10, s * 1.1, th, seed)) : rock(ctx, x, y + 10, s * 1.15, th, seed) });
  }
  const nDecor = Math.round(cols * rows * 0.09);
  for (let i = 0; i < nDecor; i++) {
    const c = Math.floor(R() * cols), r = Math.floor(R() * rows); if (cells[r * cols + c] !== 0) continue;
    const x = (c + R()) * T, y = (r + R()) * T, d = th.decor[Math.floor(R() * th.decor.length)], seed = R();
    things.push({ y: y - 30, d: () => decor(ctx, d, x, y, th, seed) });
  }
  things.sort((a, b) => a.y - b.y); for (const o of things) o.d();
  // 6) luz: un poco más claro arriba a la izquierda y los bordes oscuros
  const lg = ctx.createLinearGradient(0, 0, t.w, t.h); lg.addColorStop(0, 'rgba(255,240,210,0.08)'); lg.addColorStop(1, 'rgba(0,0,20,0.12)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, t.w, t.h);
  const vg = ctx.createRadialGradient(t.w / 2, t.h / 2, Math.min(t.w, t.h) * 0.45, t.w / 2, t.h / 2, Math.max(t.w, t.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, t.w, t.h);
  return cv;
}
// La textura del piso: puntitos, piedritas, briznas o grietas según el estilo.
function groundTexture(ctx: CanvasRenderingContext2D, t: Terrain, th: Theme, R: () => number) {
  const n = Math.round(t.w * t.h / 260);
  for (let i = 0; i < n; i++) {
    const x = R() * t.w, y = R() * t.h, k = R();
    if (th.decor.includes('grass') || th.block === 'forest') { // briznas de pasto
      ctx.strokeStyle = k < 0.5 ? shade(th.ground[1], 1.18) : shade(th.ground[2], 0.85); ctx.lineWidth = 1.4; const h = 3 + R() * 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 3, y - h); ctx.stroke();
    } else { ctx.fillStyle = k < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)'; ctx.fillRect(x, y, 1 + R() * 3, 1 + R() * 2); }
  }
  for (let i = 0; i < n / 30; i++) { // piedritas
    const x = R() * t.w, y = R() * t.h, s = 2 + R() * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1.5, s, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(th.ground[1], 1.25); ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function rock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  const w = 30 * s, h = 34 * s, R = rng(Math.floor(seed * 1e6));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 2, w * 0.95, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  const pts: [number, number][] = []; for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI, rr = 0.75 + R() * 0.35; pts.push([x + Math.cos(a) * w * rr, y + Math.sin(a) * h * rr]); }
  ctx.beginPath(); ctx.moveTo(x - w, y); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(x + w, y); ctx.closePath();
  const g = ctx.createLinearGradient(x - w, y - h, x + w * 0.6, y); g.addColorStop(0, shade(th.rock[0], 1.35)); g.addColorStop(0.5, th.rock[0]); g.addColorStop(1, th.rock[1]); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - h * 0.8); ctx.lineTo(x, y - h * 0.3); ctx.lineTo(x + w * 0.3, y); ctx.stroke(); // grieta
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - h * 0.3); ctx.lineTo(x - w * 0.35, y - h * 0.85); ctx.lineTo(x - w * 0.15, y - h * 0.7); ctx.lineTo(x - w * 0.5, y - h * 0.2); ctx.closePath(); ctx.fill(); // la cara con luz
}
function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme, seed: number) {
  const R = rng(Math.floor(seed * 1e6)), h = 46 * s, rad = 24 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 2, rad * 1.1, rad * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 4 * s, y - h * 0.55, 8 * s, h * 0.55); ctx.fillStyle = '#3a2412'; ctx.fillRect(x + 1 * s, y - h * 0.55, 3 * s, h * 0.55);
  for (let i = 0; i < 6; i++) { // la copa: varias bolas, oscuras atrás y claras adelante
    const ox = (R() - 0.5) * rad * 1.2, oy = -h * 0.6 - R() * rad * 0.9, rr = rad * (0.55 + R() * 0.35);
    ctx.fillStyle = i < 3 ? th.leaf[2] : th.leaf[0]; ctx.beginPath(); ctx.arc(x + ox, y + oy, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = th.leaf[1]; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - rad * 0.3 + (R() - 0.5) * rad * 0.6, y - h * 0.85 - R() * rad * 0.4, rad * 0.32, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - h * 0.75, rad * 1.05, 0.2, Math.PI - 0.2); ctx.stroke();
}
function pillar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, th: Theme) {
  const w = 14 * s, h = 64 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, w * 1.6, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(th.rock[0], 1.4)); g.addColorStop(0.6, th.rock[0]); g.addColorStop(1, th.rock[1]);
  ctx.fillStyle = g; ctx.fillRect(x - w, y - h, w * 2, h); ctx.fillRect(x - w * 1.35, y - h - 8 * s, w * 2.7, 9 * s); ctx.fillRect(x - w * 1.35, y - 8 * s, w * 2.7, 8 * s);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w, y - h, w * 2, h);
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - w + k * w / 2, y - h); ctx.lineTo(x - w + k * w / 2, y - 8 * s); ctx.stroke(); } // estrías
  ctx.fillStyle = th.rock[1]; ctx.beginPath(); ctx.moveTo(x + w, y - h - 8 * s); ctx.lineTo(x + w * 0.2, y - h - 8 * s); ctx.lineTo(x + w, y - h + 10 * s); ctx.closePath(); ctx.fill(); // roto arriba
}
function decor(ctx: CanvasRenderingContext2D, d: Theme['decor'][number], x: number, y: number, th: Theme, seed: number) {
  const R = rng(Math.floor(seed * 1e6) + 5);
  if (d === 'bush') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 4; i++) { ctx.fillStyle = i < 2 ? th.leaf[2] : th.leaf[0]; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 14, y - 5 - R() * 6, 6 + R() * 4, 0, Math.PI * 2); ctx.fill(); } }
  else if (d === 'flower') { for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff7ac8', '#fff27a', '#ffffff', '#c58aff'][Math.floor(R() * 4)]; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 18, y + (R() - 0.5) * 10, 2.2, 0, Math.PI * 2); ctx.fill(); } }
  else if (d === 'grass') { ctx.strokeStyle = shade(th.ground[1], 1.3); ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.stroke(); } }
  else if (d === 'pebble') { for (let i = 0; i < 3; i++) { const px = x + (R() - 0.5) * 16, py = y + (R() - 0.5) * 8, s = 3 + R() * 4; ctx.fillStyle = shade(th.rock[0], 1.2); ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); } }
  else if (d === 'crack') { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); let px = x, py = y; for (let i = 0; i < 4; i++) { px += (R() - 0.3) * 14; py += (R() - 0.5) * 10; ctx.lineTo(px, py); } ctx.stroke(); if (th.glow) { ctx.strokeStyle = th.glow + '66'; ctx.lineWidth = 1; ctx.stroke(); } }
  else if (d === 'bone') { ctx.fillStyle = '#e8dcc0'; ctx.save(); ctx.translate(x, y); ctx.rotate(R() * 3); ctx.fillRect(-8, -1.5, 16, 3); for (const sx of [-8, 8]) { ctx.beginPath(); ctx.arc(sx, -1.5, 2.2, 0, Math.PI * 2); ctx.arc(sx, 1.5, 2.2, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  else if (d === 'mushroom') { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x - 1.5, y - 7, 3, 7); ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.ellipse(x, y - 7, 6, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 9, 1.5, 1.5); }
  else if (d === 'crystal') { for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 6, h = 8 + R() * 10; ctx.fillStyle = th.leaf[1]; ctx.beginPath(); ctx.moveTo(px - 3, y); ctx.lineTo(px, y - h); ctx.lineTo(px + 3, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(px - 1, y - h * 0.8, 1.2, h * 0.5); } }
  else if (d === 'palm') { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 20, x + 2, y - 34); ctx.stroke(); ctx.strokeStyle = th.leaf[0]; ctx.lineWidth = 3.5; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + 2, y - 34); ctx.quadraticCurveTo(x + 2 + Math.cos(a) * 12, y - 40 + Math.sin(a) * 6, x + 2 + Math.cos(a) * 20, y - 30 + Math.sin(a) * 8); ctx.stroke(); } }
}
