// Las trampas nuevas de Gravity Swap: paredes que se cierran, cortocircuitos, quemadores en fila y bobinas
// de Tesla. Mismo estilo que el resto (borde oscuro, volumen, brillos).
import { CEIL, FLOOR, burnerFlame, burnerWarn, shortArcs, squeezeExt, squeezeWarn, teslaState, teslaTop, type Game, type Hazard } from './gravitySwap';
import { INK, P, glow, ink, lin, spec, zap } from './gravityMonsters';
import { bolt, hazardStripes, plate } from './gravityHazardArt';

const TAU = Math.PI * 2;

// Paredes de acero que avanzan desde el piso y el techo: placas con remaches, borde con dientes y franjas de
// peligro, pistones hidráulicos atrás y luces que titilan antes de cerrarse.
export function drawSqueeze(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const e = Math.max(0.18, squeezeExt(game, h)), warn = squeezeWarn(game, h), t = game.time;
  const dx = warn ? Math.sin(t * 70) * 0.03 : 0;
  for (const top of [true, false]) {
    const edge = top ? CEIL + e : FLOOR - e;
    // pistones
    for (let k = 0; k < Math.floor(h.w / 1.6); k++) {
      const px = h.x + 0.5 + k * 1.6 + dx;
      ctx.beginPath(); ctx.rect(px, top ? CEIL - 0.1 : edge, 0.3, e); ctx.fillStyle = lin(ctx, px, 0, px + 0.3, 0, [[0, '#4b5563'], [0.2, '#cbd5e1'], [0.32, '#ffffff'], [0.5, '#9aa3b0'], [1, '#1f242c']]); ctx.fill(); ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = 0.6 * P; ctx.stroke();
    }
    const plateH = Math.min(e, 0.7), py = top ? edge - plateH : edge;
    plate(ctx, h.x + dx, py, h.w, plateH, '#4b5361', { rust: 0.4 });
    // franja de peligro amarilla y negra sobre el borde
    const band = top ? py + plateH - 0.16 : py;
    hazardStripes(ctx, h.x + dx, band, h.w, 0.16);
    for (let k = 0.2; k < h.w; k += 0.6) bolt(ctx, h.x + dx + k, top ? py + 0.12 : py + plateH - 0.12); // remaches
    // dientes de acero en el borde
    ctx.strokeStyle = 'rgba(10,12,16,0.85)'; ctx.lineWidth = 0.6 * P;
    for (let k = 0; k < h.w - 0.1; k += 0.3) { const x0 = h.x + dx + k; ctx.beginPath(); ctx.moveTo(x0, edge); ctx.lineTo(x0 + 0.15, edge + (top ? 0.18 : -0.18)); ctx.lineTo(x0 + 0.3, edge); ctx.closePath(); ctx.fillStyle = lin(ctx, x0, 0, x0 + 0.3, 0, [[0, '#f8fafc'], [0.48, '#cbd5e1'], [0.52, '#64748b'], [1, '#334155']]); ctx.fill(); ctx.stroke(); }
    // luces de aviso
    const on = warn ? Math.sin(t * 20) > 0 : e > 0.3;
    for (const lx of [h.x + 0.25, h.x + h.w - 0.35]) { ctx.fillStyle = on ? '#ef4444' : '#7f1d1d'; ctx.fillRect(lx + dx, top ? py + 0.25 : py + plateH - 0.35, 0.1, 0.1); if (on) glow(ctx, lx + 0.05 + dx, top ? py + 0.3 : py + plateH - 0.3, 0.4, '#ef4444', 0.6); }
  }
}

// Cortocircuito: cables gruesos pelados por el piso y el techo con cajas de empalme que echan chispas; cuando
// salta, rayos enormes de punta a punta (antes chisporrotean donde van a caer).
export function drawShorts(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const t = game.time, a = shortArcs(game, h);
  for (const top of [true, false]) {
    const y = top ? CEIL + 0.12 : FLOOR - 0.12;
    for (const [off, color] of [[0, '#111827'], [0.1, '#7f1d1d'], [-0.1, '#1e3a8a']] as const) {
      ctx.strokeStyle = INK; ctx.lineWidth = 0.1 + 2 * P; ctx.beginPath(); ctx.moveTo(h.x, y + off); for (let x = h.x; x <= h.x + h.w; x += 0.5) ctx.lineTo(x, y + off + Math.sin(x * 3 + off * 9) * 0.04); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 0.1; ctx.stroke();
    }
    for (let k = 0.6; k < h.w; k += 1.6) { // cajas de empalme abiertas
      const bx = h.x + k;
      plate(ctx, bx - 0.22, top ? CEIL : FLOOR - 0.4, 0.44, 0.4, '#4b5361', { rust: 0.5 });
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(bx - 0.08, top ? CEIL + 0.3 : FLOOR - 0.1); ctx.lineTo(bx + 0.02, top ? CEIL + 0.12 : FLOOR - 0.28); ctx.lineTo(bx + 0.08, top ? CEIL + 0.3 : FLOOR - 0.1); ctx.fill(); // rayito de peligro
      if (Math.random() < 0.25) { ctx.fillStyle = '#fde68a'; for (let s = 0; s < 4; s++) ctx.fillRect(bx + (Math.random() - 0.5) * 0.5, (top ? CEIL + 0.45 : FLOOR - 0.45) + (Math.random() - 0.5) * 0.3, 1.5 * P, 1.5 * P); } // chispitas
    }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (a.warn) for (const x of a.xs) { // chisporrotea donde va a saltar
    glow(ctx, x, CEIL + 0.3, 0.5, '#7dd3fc', 0.5); glow(ctx, x, FLOOR - 0.3, 0.5, '#7dd3fc', 0.5);
    if (Math.random() < 0.5) zap(ctx, [x, CEIL + 0.1], [x + (Math.random() - 0.5) * 0.4, CEIL + 0.6 + Math.random() * 0.5]);
    if (Math.random() < 0.5) zap(ctx, [x, FLOOR - 0.1], [x + (Math.random() - 0.5) * 0.4, FLOOR - 0.6 - Math.random() * 0.5]);
  }
  if (a.on) for (const x of a.xs) {
    glow(ctx, x, (CEIL + FLOOR) / 2, 1.6, '#93c5fd', 0.4);
    for (let k = 0; k < 2; k++) zap(ctx, [x, CEIL + 0.1], [x + (Math.random() - 0.5) * 0.2, FLOOR - 0.1], k ? '#c4b5fd' : '#7dd3fc');
  }
  ctx.restore();
  void t;
}

// Quemadores en fila: toberas de hierro con la boca al rojo; las llamaradas salen en ola (antes de cada una,
// la boca se pone naranja y chisporrotea).
export function drawBurners(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const t = game.time, dir = h.side === 1 ? -1 : 1, base = h.side === 1 ? FLOOR : CEIL;
  for (let k = 0; k < h.state; k++) {
    const nx = h.x + 0.55 + k * 1.1, fh = burnerFlame(game, h, k), warn = burnerWarn(game, h, k);
    if (fh > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, nx, base + dir * fh * 0.5, fh * 0.6, '#f97316', 0.45);
      for (const [w, len, c0, c1] of [[0.3, 1, '#fb923c', 'rgba(220,38,38,0)'], [0.2, 0.75, '#fde047', 'rgba(249,115,22,0)'], [0.09, 0.4, '#ffffff', 'rgba(253,224,71,0)']] as const) {
        const L = fh * len, g = ctx.createLinearGradient(0, base, 0, base + dir * L); g.addColorStop(0, c0); g.addColorStop(1, c1);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx - w, base);
        for (let i = 1; i <= 8; i++) { const q = i / 8; ctx.lineTo(nx - w * (1 - q) ** 0.7 + Math.sin(t * 24 + i * 1.7 + k) * w * 0.35 * q, base + dir * L * q); }
        for (let i = 8; i >= 1; i--) { const q = i / 8; ctx.lineTo(nx + w * (1 - q) ** 0.7 + Math.sin(t * 21 + i * 1.3 + k) * w * 0.35 * q, base + dir * L * q); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(70,60,60,0.35)'; for (let s = 0; s < 3; s++) { const d = (t * 1.5 + s / 3 + k * 0.2) % 1; ctx.beginPath(); ctx.arc(nx + Math.sin(t * 2 + s) * 0.2, base + dir * (fh + d * 0.8), 0.15 + d * 0.3, 0, TAU); ctx.fill(); } // humo
    } else if (warn) {
      glow(ctx, nx, base + dir * 0.2, 0.45, '#f97316', 0.55);
      ctx.fillStyle = '#fde68a'; for (let s = 0; s < 3; s++) ctx.fillRect(nx + (Math.random() - 0.5) * 0.3, base + dir * (0.3 + Math.random() * 0.4), 1.5 * P, 1.5 * P);
    }
    // la tobera
    const ny = h.side === 1 ? FLOOR - 0.32 : CEIL;
    plate(ctx, nx - 0.26, ny, 0.52, 0.32, '#4a4440', { rust: 0.6, r: 0.05 });
    if (fh > 0.05 || warn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lin(ctx, 0, h.side === 1 ? ny : ny + 0.32, 0, h.side === 1 ? ny + 0.25 : ny + 0.07, [[0, 'rgba(255,120,40,0.7)'], [1, 'rgba(255,60,20,0)']]); ctx.fillRect(nx - 0.24, ny, 0.48, 0.32); ctx.restore(); } // metal al rojo
    ctx.fillStyle = fh > 0.05 || warn ? '#fb923c' : '#1c1917'; ctx.fillRect(nx - 0.16, h.side === 1 ? ny - 0.02 : ny + 0.3, 0.32, 0.04); // la boca
  }
  // el caño de gas que las une
  const py = h.side === 1 ? FLOOR - 0.1 : CEIL + 0.03;
  ink(ctx, () => ctx.rect(h.x + 0.2, py, h.w - 0.4, 0.07), '#44403c', 1);
}

// Bobina de Tesla: base con aisladores, la bobina de cobre y la esfera de arriba que se carga (brilla cada vez
// más, con chispitas) y descarga rayos alrededor.
export function drawTesla(ctx: CanvasRenderingContext2D, h: Hazard, game: Game) {
  const { charge, firing } = teslaState(game, h), top = teslaTop(h), up = h.side === 1, t = game.time;
  const baseY = up ? FLOOR : CEIL, dir = up ? -1 : 1, cx = h.x + h.w / 2;
  plate(ctx, h.x - 0.1, up ? FLOOR - 0.25 : CEIL, h.w + 0.2, 0.25, '#3a414c', { rust: 0.3 });
  for (let k = 0; k < 3; k++) { const y = baseY + dir * (0.3 + k * 0.12); ink(ctx, () => ctx.ellipse(cx, y, 0.2, 0.06, 0, 0, TAU), '#e5e7eb', 1); } // aisladores
  const coilY0 = baseY + dir * 0.65, coilY1 = top.y - dir * 0.25;
  ink(ctx, () => ctx.rect(cx - 0.18, Math.min(coilY0, coilY1), 0.36, Math.abs(coilY1 - coilY0)), lin(ctx, cx - 0.18, 0, cx + 0.18, 0, [[0, '#7c2d12'], [0.4, '#f59e0b'], [0.7, '#c2410c'], [1, '#431407']]), 1.3);
  ctx.strokeStyle = 'rgba(67,20,7,0.8)'; ctx.lineWidth = P; for (let y = Math.min(coilY0, coilY1); y < Math.max(coilY0, coilY1); y += 0.06) { ctx.beginPath(); ctx.moveTo(cx - 0.18, y); ctx.lineTo(cx + 0.18, y + 0.02); ctx.stroke(); } // vueltas del alambre
  ink(ctx, () => ctx.ellipse(cx, top.y - dir * 0.2, 0.4, 0.12, 0, 0, TAU), lin(ctx, 0, top.y - 0.3, 0, top.y, [[0, '#f1f5f9'], [1, '#64748b']]), 1.3); // toroide
  glow(ctx, top.x, top.y, 0.5 + charge * 0.9, '#a5b4fc', 0.25 + charge * 0.45);
  const sph = ctx.createRadialGradient(top.x - 0.06, top.y - 0.06, 0.02, top.x, top.y, 0.2); sph.addColorStop(0, '#ffffff'); sph.addColorStop(0.5, charge > 0.7 ? '#c7d2fe' : '#cbd5e1'); sph.addColorStop(1, '#475569');
  ink(ctx, () => ctx.arc(top.x, top.y, 0.2, 0, TAU), sph, 1);
  spec(ctx, top.x - 0.07, top.y - 0.08, 0.06, 0.03, -0.6, 0.9);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (charge > 0.4 && !firing && Math.random() < charge) zap(ctx, [top.x, top.y], [top.x + (Math.random() - 0.5) * 0.7, top.y + (Math.random() - 0.5) * 0.7], '#a5b4fc'); // chispitas mientras se carga
  if (firing) {
    glow(ctx, top.x, top.y, h.r, '#818cf8', 0.25);
    for (let k = 0; k < 6; k++) { const ang = Math.random() * TAU, rr = h.r * (0.6 + Math.random() * 0.4); zap(ctx, [top.x, top.y], [top.x + Math.cos(ang) * rr, top.y + Math.sin(ang) * rr], k % 2 ? '#c4b5fd' : '#7dd3fc'); }
  }
  ctx.restore();
  void t;
}
