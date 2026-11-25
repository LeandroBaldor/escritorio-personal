// Tiro al Blanco 2.050: el dibujo (escenarios, carteles, armas, mira y efectos). Todo en px de la pantalla del juego (W × H).
import {
  BOARD, H, poseOf, W, WEAPONS, type CharSpec, type SceneId, type SceneSpec, type Target, type WeaponId,
} from './tiroAlBlanco';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function rng(seed: number) { let a = Math.floor(seed * 2 ** 31) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q); ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) { const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [k, c] of stops) g.addColorStop(k, c); return g; }
function glow(ctx: Ctx, color: string, blur: number, draw: () => void) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; draw(); ctx.restore(); }
function neonLine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 4) {
  glow(ctx, color, 18, () => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); });
  ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = Math.max(1, w * 0.35); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function neonText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, font = 'Impact, "Arial Black", sans-serif') {
  ctx.save(); ctx.font = `900 ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = size * 0.6; ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffffffd0'; ctx.globalAlpha = 0.55; ctx.fillText(text, x, y); ctx.restore();
}
// Piso en perspectiva desde la línea y0 hasta abajo, con punto de fuga en (vx, vy).
function floor(ctx: Ctx, y0: number, a: string, b: string, line: string, vx = W / 2, vy = 330, tiles = true) {
  ctx.fillStyle = vgrad(ctx, y0, H, [[0, a], [1, b]]); ctx.fillRect(0, y0, W, H - y0);
  if (!tiles) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, H - y0); ctx.clip();
  ctx.strokeStyle = line; ctx.lineWidth = 1.5;
  for (let i = -24; i <= 24; i++) { const xb = vx + i * 150; ctx.beginPath(); ctx.moveTo(vx + (xb - vx) * ((y0 - vy) / (H - vy)), y0); ctx.lineTo(xb, H); ctx.stroke(); }
  for (let k = 0; k < 14; k++) { const y = y0 + (H - y0) * ((k / 13) ** 1.8); ctx.globalAlpha = 0.4 + 0.6 * (k / 13); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}
function skyline(ctx: Ctx, x0: number, x1: number, base: number, maxH: number, seed: number, tone: string, lit: string[]) {
  const r = rng(seed);
  let x = x0;
  while (x < x1) {
    const w = 40 + r() * 90, h = maxH * (0.35 + r() * 0.65);
    ctx.fillStyle = tone; ctx.fillRect(x, base - h, w, h);
    if (r() < 0.3) { ctx.fillRect(x + w * 0.45, base - h - 30, 3, 30); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x + w * 0.45 - 1, base - h - 32, 5, 4); }
    for (let wy = base - h + 8; wy < base - 6; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
      if (r() < 0.38) { ctx.fillStyle = lit[Math.floor(r() * lit.length)]; ctx.globalAlpha = 0.5 + r() * 0.5; ctx.fillRect(wx, wy, 4, 5); ctx.globalAlpha = 1; }
    }
    x += w + 4 + r() * 10;
  }
}

// ───────────── Coberturas (lo que tapa la parte de abajo de los carteles) ─────────────
type CoverKind = 'counter' | 'desk' | 'crate' | 'barrier' | 'planter' | 'sofa' | 'bench' | 'container' | 'barrel' | 'kiosk' | 'train' | 'cubicle' | 'concrete';
interface Pal { base: string; dark: string; light: string; neon: string }
function cover(ctx: Ctx, kind: CoverKind, cx: number, top: number, w: number, h: number, s: number, p: Pal, seed = 0.3) {
  const x = cx - w / 2, r = rng(seed);
  ctx.save();
  // sombra en el piso
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(cx, top + h, w * 0.56, 14 * s, 0, 0, TAU); ctx.fill();
  switch (kind) {
    case 'counter': case 'kiosk': case 'desk': {
      const lip = 16 * s;
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, p.light], [0.08, p.base], [1, p.dark]]); rr(ctx, x, top, w, h, 6 * s); ctx.fill();
      ctx.fillStyle = p.light; rr(ctx, x - 8 * s, top - lip * 0.4, w + 16 * s, lip, 5 * s); ctx.fill();
      neonLine(ctx, x + 10 * s, top + lip + 6 * s, x + w - 10 * s, top + lip + 6 * s, p.neon, 3 * s);
      if (kind === 'kiosk') { neonText(ctx, ['INFO', '24H', 'CAFÉ', 'BOT', 'NEXO'][Math.floor(r() * 5)], cx, top + h * 0.55, 30 * s, p.neon); }
      if (kind === 'desk') { ctx.fillStyle = '#0006'; ctx.fillRect(x + w * 0.1, top + h * 0.3, w * 0.8, 6 * s); }
      break;
    }
    case 'cubicle': {
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, p.light], [1, p.dark]]); ctx.fillRect(x, top, w, h);
      ctx.fillStyle = p.base; ctx.fillRect(x, top, w, 10 * s);
      ctx.strokeStyle = '#0003'; ctx.lineWidth = 2 * s; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + (w * k) / 4, top + 10 * s); ctx.lineTo(x + (w * k) / 4, top + h); ctx.stroke(); }
      neonLine(ctx, x, top + 4 * s, x + w, top + 4 * s, p.neon, 2.5 * s);
      break;
    }
    case 'crate': case 'container': {
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, p.light], [1, p.dark]]); rr(ctx, x, top, w, h, 4 * s); ctx.fill();
      ctx.strokeStyle = '#0005'; ctx.lineWidth = 3 * s;
      const n = kind === 'container' ? 9 : 3; for (let k = 1; k < n; k++) { ctx.beginPath(); ctx.moveTo(x + (w * k) / n, top + 6 * s); ctx.lineTo(x + (w * k) / n, top + h - 6 * s); ctx.stroke(); }
      if (kind === 'crate') { ctx.beginPath(); ctx.moveTo(x + 8 * s, top + 8 * s); ctx.lineTo(x + w - 8 * s, top + h - 8 * s); ctx.stroke(); }
      ctx.fillStyle = '#facc15'; for (let k = 0; k < 6; k++) { ctx.save(); ctx.beginPath(); ctx.rect(x, top + h - 18 * s, w, 12 * s); ctx.clip(); ctx.fillRect(x + k * w / 5 - 10 * s, top + h - 18 * s, w / 10, 12 * s); ctx.restore(); }
      neonText(ctx, kind === 'container' ? 'KEPLER-7' : 'FRÁGIL', cx, top + h * 0.42, 22 * s, p.neon, 'Consolas, monospace');
      break;
    }
    case 'barrier': case 'concrete': {
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, kind === 'concrete' ? '#9aa3ad' : p.light], [1, kind === 'concrete' ? '#4b5563' : p.dark]]);
      ctx.beginPath(); ctx.moveTo(x + 18 * s, top); ctx.lineTo(x + w - 18 * s, top); ctx.lineTo(x + w, top + h); ctx.lineTo(x, top + h); ctx.closePath(); ctx.fill();
      // franjas de peligro
      ctx.save(); ctx.clip();
      for (let k = -2; k < 14; k++) { ctx.fillStyle = k % 2 ? '#111827' : '#f59e0b'; ctx.beginPath(); const bx = x + k * 34 * s; ctx.moveTo(bx, top + h * 0.45); ctx.lineTo(bx + 17 * s, top + h * 0.45); ctx.lineTo(bx + 37 * s, top + h * 0.7); ctx.lineTo(bx + 20 * s, top + h * 0.7); ctx.fill(); }
      ctx.restore();
      neonLine(ctx, x + 22 * s, top + 8 * s, x + w - 22 * s, top + 8 * s, '#ef4444', 3 * s);
      break;
    }
    case 'planter': {
      ctx.fillStyle = vgrad(ctx, top + 30 * s, top + h, [[0, p.light], [1, p.dark]]); rr(ctx, x, top + 30 * s, w, h - 30 * s, 10 * s); ctx.fill();
      neonLine(ctx, x + 8 * s, top + 44 * s, x + w - 8 * s, top + 44 * s, p.neon, 3 * s);
      for (let k = 0; k < 16; k++) { ctx.fillStyle = ['#166534', '#15803d', '#22c55e', '#14532d'][k % 4]; ctx.beginPath(); ctx.ellipse(x + 14 * s + r() * (w - 28 * s), top + 4 * s + r() * 22 * s, 26 * s, 14 * s, r() * 3, 0, TAU); ctx.fill(); }
      break;
    }
    case 'sofa': case 'bench': {
      const seat = kind === 'sofa';
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, p.light], [1, p.dark]]); rr(ctx, x, top, w, h * (seat ? 1 : 0.55), 18 * s); ctx.fill();
      if (seat) { ctx.fillStyle = p.base; rr(ctx, x - 10 * s, top + h * 0.35, 30 * s, h * 0.65, 10 * s); ctx.fill(); rr(ctx, x + w - 20 * s, top + h * 0.35, 30 * s, h * 0.65, 10 * s); ctx.fill(); }
      else { ctx.fillStyle = p.dark; ctx.fillRect(x + 20 * s, top + h * 0.55, 14 * s, h * 0.45); ctx.fillRect(x + w - 34 * s, top + h * 0.55, 14 * s, h * 0.45); }
      neonLine(ctx, x + 20 * s, top + 10 * s, x + w - 20 * s, top + 10 * s, p.neon, 2.5 * s);
      break;
    }
    case 'barrel': {
      for (let k = 0; k < 2; k++) {
        const bw = w / 2 - 6 * s, bx = x + k * (bw + 12 * s);
        ctx.fillStyle = vgrad(ctx, top, top + h, [[0, k ? '#dc2626' : '#2563eb'], [1, k ? '#7f1d1d' : '#1e3a8a']]); rr(ctx, bx, top + (k ? 8 : 0) * s, bw, h - (k ? 8 : 0) * s, 10 * s); ctx.fill();
        ctx.fillStyle = '#0004'; ctx.fillRect(bx, top + h * 0.3, bw, 6 * s); ctx.fillRect(bx, top + h * 0.7, bw, 6 * s);
        ctx.fillStyle = '#facc15'; ctx.font = `900 ${26 * s}px Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('☢', bx + bw / 2, top + h * 0.56);
      }
      break;
    }
    case 'train': {
      ctx.fillStyle = vgrad(ctx, top, top + h, [[0, '#e5e7eb'], [1, '#9ca3af']]); ctx.fillRect(x, top, w, h);
      neonLine(ctx, x, top + 18 * s, x + w, top + 18 * s, '#38bdf8', 5 * s);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(x, top + h - 22 * s, w, 22 * s);
      ctx.fillStyle = '#facc15'; ctx.fillRect(x, top + h + 4 * s, w, 8 * s);
      break;
    }
  }
  ctx.restore();
}

// ───────────── Escenarios ─────────────
interface SceneArt { pal: Pal; back: (ctx: Ctx) => void; rowCovers: { kind: CoverKind; w: number; h: number; continuous?: boolean }[]; extra?: (ctx: Ctx, row: number, scene: SceneSpec) => void }
const ART: Record<SceneId, SceneArt> = {
  banco: {
    pal: { base: '#2b3550', dark: '#121829', light: '#5b6b92', neon: '#38bdf8' },
    back: ctx => {
      ctx.fillStyle = vgrad(ctx, 0, 470, [[0, '#0b1020'], [1, '#1e2a48']]); ctx.fillRect(0, 0, W, 470);
      // paneles de mármol
      const r = rng(0.11);
      for (let x = 0; x < W; x += 160) { ctx.fillStyle = r() < 0.5 ? '#18213a' : '#1b2642'; ctx.fillRect(x + 4, 90, 152, 360); ctx.strokeStyle = '#ffffff10'; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(x + r() * 150, 90 + r() * 360); ctx.lineTo(x + r() * 150, 90 + r() * 360); } ctx.stroke(); }
      // luces del techo
      for (let x = 100; x < W; x += 280) neonLine(ctx, x, 40, x + 160, 40, '#e0f2fe', 5);
      // bóveda
      ctx.fillStyle = '#0e1426'; ctx.beginPath(); ctx.arc(800, 290, 160, 0, TAU); ctx.fill();
      const vg = ctx.createRadialGradient(780, 270, 20, 800, 290, 140); vg.addColorStop(0, '#cbd5e1'); vg.addColorStop(0.6, '#64748b'); vg.addColorStop(1, '#1e293b');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(800, 290, 140, 0, TAU); ctx.fill();
      glow(ctx, '#38bdf8', 30, () => { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(800, 290, 148, 0, TAU); ctx.stroke(); });
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 10; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(800 + Math.cos(a) * 30, 290 + Math.sin(a) * 30); ctx.lineTo(800 + Math.cos(a) * 100, 290 + Math.sin(a) * 100); ctx.stroke(); }
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(800, 290, 34, 0, TAU); ctx.fill();
      neonText(ctx, 'NEXUS', 330, 130, 54, '#38bdf8'); neonText(ctx, 'ORBITAL BANK', 1270, 130, 44, '#38bdf8');
      // columnas
      for (const cx of [110, 1490]) { ctx.fillStyle = vgrad(ctx, 0, 470, [[0, '#334155'], [1, '#0f172a']]); ctx.fillRect(cx - 55, 0, 110, 470); neonLine(ctx, cx - 40, 30, cx - 40, 440, '#38bdf8', 3); }
      // ventanillas detrás del mostrador
      for (let k = 0; k < 5; k++) { const x = 340 + k * 180; ctx.fillStyle = '#38bdf81a'; ctx.fillRect(x, 330, 160, 125); ctx.strokeStyle = '#7dd3fc55'; ctx.lineWidth = 2; ctx.strokeRect(x, 330, 160, 125); }
      floor(ctx, 455, '#1c2540', '#05070f', '#38bdf822');
    },
    rowCovers: [{ kind: 'counter', w: 1000, h: 80, continuous: true }, { kind: 'kiosk', w: 230, h: 120 }, { kind: 'sofa', w: 300, h: 120 }],
  },
  metro: {
    pal: { base: '#475569', dark: '#1e293b', light: '#94a3b8', neon: '#fbbf24' },
    back: ctx => {
      ctx.fillStyle = vgrad(ctx, 0, 480, [[0, '#0a0f14'], [1, '#1f2a30']]); ctx.fillRect(0, 0, W, 480);
      // azulejos
      ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1; for (let y = 0; y < 230; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      neonText(ctx, 'LÍNEA 9  ›  CENTRO · ÓRBITA · PUERTO', 800, 140, 30, '#fbbf24');
      for (let x = 60; x < W; x += 300) neonLine(ctx, x, 80, x + 200, 80, '#f8fafc', 4);
      // tren mag-lev
      ctx.fillStyle = vgrad(ctx, 170, 470, [[0, '#f1f5f9'], [1, '#94a3b8']]); rr(ctx, -40, 170, W + 80, 320, 50); ctx.fill();
      neonLine(ctx, 0, 200, W, 200, '#38bdf8', 6);
      const scene = SCENE_ROWS.metro[0];
      for (const sx of scene) { ctx.fillStyle = '#0b1220'; rr(ctx, sx - 62, 236, 124, 240, 8); ctx.fill(); ctx.fillStyle = '#38bdf833'; ctx.fillRect(sx - 62, 236, 124, 6); }
      for (let x = 20; x < W; x += 95) { if (scene.some(sx => Math.abs(sx - x - 30) < 100)) continue; ctx.fillStyle = '#0f172acc'; rr(ctx, x, 250, 60, 70, 8); ctx.fill(); }
      floor(ctx, 470, '#3f3f46', '#0c0c0e', '#ffffff14');
    },
    rowCovers: [{ kind: 'train', w: 1700, h: 70, continuous: true }, { kind: 'bench', w: 280, h: 110 }, { kind: 'concrete', w: 260, h: 140 }],
  },
  torre: {
    pal: { base: '#3b3f4a', dark: '#16181d', light: '#6b7280', neon: '#e879f9' },
    back: ctx => {
      // ventanal con la ciudad de noche
      ctx.fillStyle = vgrad(ctx, 0, 490, [[0, '#090418'], [0.6, '#2a0f45'], [1, '#541b5f']]); ctx.fillRect(0, 0, W, 490);
      skyline(ctx, -20, W + 20, 490, 300, 0.42, '#12091f', ['#fde68a', '#f0abfc', '#67e8f9']);
      skyline(ctx, -20, W + 20, 490, 180, 0.77, '#07030f', ['#fbbf24', '#e879f9']);
      const r = rng(0.5); for (let k = 0; k < 14; k++) { const x = r() * W, y = 60 + r() * 220; ctx.fillStyle = r() < 0.5 ? '#f472b6' : '#22d3ee'; glow(ctx, ctx.fillStyle as string, 10, () => ctx.fillRect(x, y, 14, 3)); }
      ctx.fillStyle = '#0a0a0f'; for (let x = 0; x <= W; x += 266) ctx.fillRect(x - 6, 0, 12, 490);
      ctx.fillRect(0, 0, W, 26);
      neonText(ctx, 'HELIX CORP · 88', 330, 130, 34, '#e879f9');
      floor(ctx, 480, '#2a2433', '#0b090f', '#ffffff0a');
    },
    rowCovers: [{ kind: 'cubicle', w: 1700, h: 70, continuous: true }, { kind: 'desk', w: 250, h: 110 }, { kind: 'desk', w: 300, h: 130 }],
  },
  puerto: {
    pal: { base: '#52525b', dark: '#1c1917', light: '#a1a1aa', neon: '#4ade80' },
    back: ctx => {
      ctx.fillStyle = '#111114'; ctx.fillRect(0, 0, W, 500);
      // gran puerta del hangar abierta al espacio
      ctx.fillStyle = '#02030a'; ctx.fillRect(220, 60, 1160, 400);
      const r = rng(0.31); for (let k = 0; k < 220; k++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; ctx.fillRect(220 + r() * 1160, 60 + r() * 400, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
      const pg = ctx.createRadialGradient(1080, 520, 40, 1080, 560, 330); pg.addColorStop(0, '#60a5fa'); pg.addColorStop(0.55, '#1d4ed8'); pg.addColorStop(1, '#1e3a8a00');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(1080, 600, 330, 0, TAU); ctx.fill();
      // nave
      ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.moveTo(380, 330); ctx.quadraticCurveTo(560, 230, 860, 300); ctx.lineTo(860, 380); ctx.quadraticCurveTo(560, 400, 380, 330); ctx.fill();
      neonLine(ctx, 470, 330, 820, 330, '#4ade80', 4); glow(ctx, '#f97316', 30, () => { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(866, 340, 10, 34, 0, 0, TAU); ctx.fill(); });
      // marco con franjas
      for (const [x, w] of [[180, 40], [1380, 40]] as const) { ctx.save(); ctx.beginPath(); ctx.rect(x, 60, w, 440); ctx.clip(); for (let y = 40; y < 520; y += 40) { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y - 20); ctx.lineTo(x + w, y); ctx.lineTo(x, y + 20); ctx.fill(); } ctx.restore(); }
      ctx.fillStyle = '#27272a'; ctx.fillRect(0, 30, W, 30); ctx.fillStyle = '#3f3f46'; ctx.fillRect(500, 0, 40, 120); ctx.fillRect(500, 110, 300, 12);
      neonText(ctx, 'HANGAR 7 · KEPLER', 1180, 46, 26, '#4ade80');
      floor(ctx, 500, '#3f3f46', '#09090b', '#facc1522');
    },
    rowCovers: [{ kind: 'container', w: 330, h: 120 }, { kind: 'crate', w: 240, h: 120 }, { kind: 'barrel', w: 250, h: 140 }],
  },
  mercado: {
    pal: { base: '#3b1d4a', dark: '#140a1c', light: '#7e3a96', neon: '#22d3ee' },
    back: ctx => {
      ctx.fillStyle = vgrad(ctx, 0, 480, [[0, '#080512'], [1, '#22103a']]); ctx.fillRect(0, 0, W, 480);
      // primer piso con balcón
      ctx.fillStyle = '#120a20'; ctx.fillRect(0, 150, W, 26); neonLine(ctx, 0, 150, W, 150, '#f472b6', 4);
      const names = ['RAMEN 2050', 'CYBER-OJOS', 'FARMA+', 'HOLO-CINE', 'BIT CAFÉ', 'ROBO-SUSHI'];
      const colors = ['#f472b6', '#22d3ee', '#4ade80', '#facc15', '#a78bfa', '#fb7185'];
      for (let k = 0; k < 6; k++) {
        const x = 30 + k * 260; ctx.fillStyle = '#1a0f2e'; ctx.fillRect(x, 200, 240, 270); ctx.fillStyle = colors[k] + '22'; ctx.fillRect(x + 12, 270, 216, 190);
        neonText(ctx, names[k], x + 120, 232, 30, colors[k]);
        neonText(ctx, ['歩', '光', '夢', '電', '星', '未'][k], x + 40 + (k % 2) * 160, 90, 60, colors[(k + 2) % 6], 'sans-serif');
      }
      floor(ctx, 470, '#2a1840', '#07040c', '#22d3ee18');
    },
    rowCovers: [{ kind: 'counter', w: 200, h: 90 }, { kind: 'kiosk', w: 240, h: 120 }, { kind: 'planter', w: 300, h: 140 }],
  },
};
const SCENE_ROWS: Record<SceneId, number[][]> = { banco: [], metro: [], torre: [], puerto: [], mercado: [] };

export interface SceneLayers { back: HTMLCanvasElement; rows: HTMLCanvasElement[]; q: number }
const layerCache = new Map<string, SceneLayers>();
function makeCanvas(q: number) { const c = document.createElement('canvas'); c.width = Math.round(W * q); c.height = Math.round(H * q); const ctx = c.getContext('2d')!; ctx.scale(q, q); return { c, ctx }; }
// Arma (y guarda) las capas del escenario: el fondo y una capa por fila con las coberturas.
export function sceneLayers(scene: SceneSpec, q = 1): SceneLayers {
  const key = `${scene.id}:${q}`, hit = layerCache.get(key);
  if (hit) return hit;
  SCENE_ROWS[scene.id] = scene.rows.map(r => r.spots);
  const art = ART[scene.id], back = makeCanvas(q);
  art.back(back.ctx);
  const rows = scene.rows.map((row, ri) => {
    const { c, ctx } = makeCanvas(q), spec = art.rowCovers[ri], s = row.scale;
    if (spec.continuous) cover(ctx, spec.kind, W / 2, row.y, spec.w * (spec.kind === 'counter' ? 1 : 1), spec.h * s * 1.3, s, art.pal, 0.2 + ri);
    else row.spots.forEach((x, i) => cover(ctx, spec.kind, x, row.y, spec.w * s, spec.h * s, s, art.pal, 0.13 * (i + 1) + ri));
    return c;
  });
  const layers = { back: back.c, rows, q };
  layerCache.set(key, layers);
  return layers;
}

// Luces de emergencia (rojo y azul girando) y algún parpadeo, encima del fondo.
export function drawSceneFx(ctx: Ctx, scene: SceneSpec, t: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const a = Math.sin(t * 5.5), b = Math.sin(t * 5.5 + Math.PI);
  for (const [x, c, k] of [[120, '#ff1e1e', a], [W - 120, '#1e6bff', b]] as const) {
    const i = Math.max(0, k);
    const g = ctx.createRadialGradient(x, 30, 10, x, 30, 520); g.addColorStop(0, `${c}${Math.round(i * 110).toString(16).padStart(2, '0')}`); g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (scene.id === 'mercado' || scene.id === 'torre') { const f = Math.sin(t * 23) > 0.92 ? 0.08 : 0; if (f) { ctx.fillStyle = `rgba(232,121,249,${f})`; ctx.fillRect(0, 0, W, 480); } }
  ctx.restore();
  // la cinta holográfica del simulacro
  ctx.save(); ctx.globalAlpha = 0.85;
  const msg = `⚠ SIMULACRO · TOMA DE REHENES · ${scene.name.toUpperCase()} · `;
  ctx.font = '700 16px Consolas, monospace'; ctx.fillStyle = '#facc15';
  const w = ctx.measureText(msg).width, off = (t * 60) % w;
  ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, W, 22); ctx.fillStyle = '#facc15';
  for (let x = -off; x < W; x += w) ctx.fillText(msg, x, 16);
  ctx.restore();
}

// ───────────── Personas (impresas en los carteles) ─────────────
const SKINS = ['#f1c9a5', '#e0ac7e', '#c68a5c', '#8d5a3b', '#5c3a24', '#f5d6c6'];
const HAIRS = ['#1f1300', '#3b2414', '#6b4423', '#c0862b', '#e5e7eb', '#111827', '#7c2d12', '#be185d'];
const SHIRTS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#9333ea', '#0891b2', '#e5e7eb', '#db2777', '#65a30d'];
const PANTS = ['#1f2937', '#374151', '#1e3a8a', '#3f3f46', '#78350f', '#0f172a'];
type Pose = 'gun' | 'rifle' | 'handsUp' | 'tied' | 'phone' | 'bag' | 'briefcase' | 'kneel';
interface Look { skin: string; hair: string; long: boolean; shirt: string; pants: string; neon: string; mask: boolean; pose: Pose; woman: boolean }
function lookOf(t: Pick<Target, 'kind' | 'seed'>, role: 'bad' | 'innocent'): Look {
  const r = rng(t.seed + (role === 'bad' ? 0.37 : 0));
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const woman = r() < 0.45;
  if (role === 'bad') return { skin: pick(SKINS), hair: '#000', long: false, shirt: pick(['#111827', '#1f2937', '#3f3f46', '#14532d', '#3b0764']), pants: '#0b0b0f', neon: pick(['#ef4444', '#f97316', '#a3e635']), mask: true, pose: r() < 0.5 ? 'gun' : 'rifle', woman: false };
  const innocentPoses: Pose[] = t.kind === 'rehen' ? ['handsUp', 'tied', 'kneel'] : ['phone', 'bag', 'briefcase', 'handsUp'];
  return { skin: pick(SKINS), hair: pick(HAIRS), long: woman && r() < 0.8, shirt: pick(SHIRTS), pants: pick(PANTS), neon: pick(['#22d3ee', '#f472b6', '#a78bfa', '#4ade80']), mask: false, pose: pick(innocentPoses), woman };
}
function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function hand(ctx: Ctx, x: number, y: number, skin: string) { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
function futureGun(ctx: Ctx, x: number, y: number, k: number, neon: string, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.fillStyle = '#1f2937'; rr(ctx, -16, -12, 32, 24, 5); ctx.fill();
  ctx.fillStyle = '#374151'; rr(ctx, -12, -18, 24, 8, 3); ctx.fill();
  glow(ctx, neon, 12, () => { ctx.fillStyle = neon; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); });
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawPerson(ctx: Ctx, L: Look, dx = 0, dy = 0) {
  ctx.save(); ctx.translate(dx, dy);
  const kneel = L.pose === 'kneel';
  if (kneel) ctx.translate(0, 55);
  // piernas
  if (!kneel) { limb(ctx, -18, -112, -20, -12, 30, L.pants); limb(ctx, 18, -112, 20, -12, 30, L.pants); ctx.fillStyle = '#111'; rr(ctx, -40, -18, 38, 14, 6); ctx.fill(); rr(ctx, 2, -18, 38, 14, 6); ctx.fill(); }
  else { ctx.fillStyle = L.pants; rr(ctx, -46, -125, 92, 40, 16); ctx.fill(); }
  // torso
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.moveTo(-46, -205); ctx.quadraticCurveTo(0, -215, 46, -205); ctx.lineTo(38, -110); ctx.lineTo(-38, -110); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0003'; ctx.fillRect(-38, -122, 76, 12);
  if (L.mask) { ctx.fillStyle = '#0009'; rr(ctx, -30, -195, 60, 60, 6); ctx.fill(); neonLine(ctx, -26, -170, 26, -170, L.neon, 2.5); neonLine(ctx, -26, -152, 26, -152, L.neon, 2.5); }
  else { neonLine(ctx, -40, -150, 40, -150, L.neon, 2); if (L.woman) { ctx.fillStyle = '#0002'; ctx.beginPath(); ctx.arc(0, -200, 16, 0, Math.PI); ctx.fill(); } }
  // brazos según la pose
  const sk = L.skin, sl = L.shirt;
  switch (L.pose) {
    case 'gun': limb(ctx, -42, -198, -14, -168, 20, sl); limb(ctx, 42, -198, 14, -168, 20, sl); hand(ctx, -8, -166, sk); hand(ctx, 8, -166, sk); futureGun(ctx, 0, -176, 1.25, L.neon); break;
    case 'rifle': {
      limb(ctx, -42, -198, -30, -140, 20, sl); limb(ctx, 42, -198, 28, -178, 20, sl);
      ctx.save(); ctx.translate(0, -160); ctx.rotate(-0.55); ctx.fillStyle = '#1f2937'; rr(ctx, -70, -10, 140, 20, 6); ctx.fill(); ctx.fillStyle = '#374151'; ctx.fillRect(-20, 8, 16, 26); neonLine(ctx, -50, 0, 60, 0, L.neon, 3); ctx.restore();
      hand(ctx, -30, -140, sk); hand(ctx, 28, -178, sk); break;
    }
    case 'handsUp': limb(ctx, -42, -198, -60, -262, 18, sl); limb(ctx, 42, -198, 60, -262, 18, sl); limb(ctx, -60, -262, -62, -290, 14, sk); limb(ctx, 60, -262, 62, -290, 14, sk); hand(ctx, -62, -292, sk); hand(ctx, 62, -292, sk); break;
    case 'tied': case 'kneel': limb(ctx, -42, -198, -46, -130, 18, sl); limb(ctx, 42, -198, 46, -130, 18, sl); ctx.strokeStyle = '#d6b37a'; ctx.lineWidth = 5; for (const y of [-180, -150]) { ctx.beginPath(); ctx.moveTo(-50, y); ctx.lineTo(50, y + 6); ctx.stroke(); } break;
    case 'phone': limb(ctx, -42, -198, -50, -120, 18, sl); limb(ctx, 42, -198, 44, -230, 18, sl); hand(ctx, 34, -238, sk); glow(ctx, '#67e8f9', 10, () => { ctx.fillStyle = '#67e8f9'; rr(ctx, 26, -262, 14, 26, 3); ctx.fill(); }); break;
    case 'bag': limb(ctx, -42, -198, -50, -120, 18, sl); limb(ctx, 42, -198, 52, -118, 18, sl); hand(ctx, 52, -114, sk); ctx.fillStyle = L.neon; rr(ctx, 40, -112, 40, 46, 5); ctx.fill(); ctx.fillStyle = '#fff8'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 60, -82); break;
    case 'briefcase': limb(ctx, -42, -198, -50, -120, 18, sl); limb(ctx, 42, -198, 50, -118, 18, sl); hand(ctx, 50, -114, sk); ctx.fillStyle = '#3f2a14'; rr(ctx, 32, -110, 46, 34, 4); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.fillRect(52, -106, 8, 4); break;
  }
  // cuello y cabeza
  ctx.fillStyle = L.mask ? '#0b0b0f' : sk; ctx.fillRect(-11, -218, 22, 14);
  ctx.fillStyle = L.mask ? '#0b0b0f' : sk; ctx.beginPath(); ctx.ellipse(0, -242, 26, 30, 0, 0, TAU); ctx.fill();
  if (L.mask) {
    // pasamontañas con la ranura de los ojos y los ojos que brillan
    ctx.fillStyle = sk; rr(ctx, -20, -256, 40, 14, 6); ctx.fill();
    glow(ctx, L.neon, 10, () => { ctx.fillStyle = L.neon; ctx.beginPath(); ctx.arc(-9, -249, 4, 0, TAU); ctx.arc(9, -249, 4, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -228, 7, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(0, -270, 10, 6, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.ellipse(0, -258, 28, 18, 0, Math.PI, TAU); ctx.fill();
    if (L.long) { rr(ctx, -30, -262, 12, 56, 6); ctx.fill(); rr(ctx, 18, -262, 12, 56, 6); ctx.fill(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -246, 3.2, 0, TAU); ctx.arc(9, -246, 3.2, 0, TAU); ctx.fill();
    if (L.pose === 'tied' || L.pose === 'kneel') { ctx.fillStyle = '#9ca3af'; rr(ctx, -16, -236, 32, 11, 2); ctx.fill(); } // cinta en la boca
    else { ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -228, 6, L.pose === 'handsUp' ? 5 : 2, 0, 0, TAU); ctx.stroke(); } // asustado
    ctx.strokeStyle = '#0005'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, -255); ctx.lineTo(-4, -253); ctx.moveTo(15, -255); ctx.lineTo(4, -253); ctx.stroke();
  }
  ctx.restore();
}
// Lo impreso en el cartel.
function drawPrint(ctx: Ctx, t: Pick<Target, 'kind' | 'seed'>) {
  if (t.kind === 'municion') {
    ctx.fillStyle = '#1f2937'; rr(ctx, -58, -190, 116, 130, 10); ctx.fill();
    ctx.fillStyle = '#facc15'; rr(ctx, -50, -182, 100, 22, 4); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '900 16px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MUNICIÓN', 0, -165);
    glow(ctx, '#4ade80', 14, () => { ctx.fillStyle = '#4ade80'; for (let k = 0; k < 4; k++) { rr(ctx, -38 + k * 20, -150, 14, 60, 6); ctx.fill(); } });
    ctx.fillStyle = '#4ade80'; ctx.font = '900 30px Impact, sans-serif'; ctx.fillText('+', 0, -230);
    return;
  }
  if (t.kind === 'maloRehen') {
    const bad = lookOf(t, 'bad'), hostage = { ...lookOf({ ...t, kind: 'rehen' }, 'innocent'), pose: 'tied' as Pose };
    // el malo atrás, asomado a la derecha, apuntándole al rehén en la cabeza
    ctx.save(); ctx.translate(44, -26);
    drawPerson(ctx, { ...bad, pose: 'tied' }, 0, 0);
    ctx.restore();
    drawPerson(ctx, hostage, -16, 0);
    limb(ctx, 60, -200, -10, -212, 18, bad.shirt); // el brazo en el cuello del rehén
    hand(ctx, -16, -212, bad.skin);
    futureGun(ctx, 22, -250, 0.9, bad.neon, -0.3);
    return;
  }
  drawPerson(ctx, lookOf(t, t.kind === 'malo' ? 'bad' : 'innocent'));
}
// El cartel: base de metal, panel de cartón con borde y bulones, la figura y los agujeros de bala.
function drawBoard(ctx: Ctx, t: Pick<Target, 'kind' | 'seed' | 'holes'>) {
  const w = BOARD.w, h = BOARD.h;
  ctx.fillStyle = '#4b5563'; ctx.fillRect(-6, -40, 12, 40);
  ctx.fillStyle = vgrad(ctx, -h, 0, [[0, '#efe4cb'], [1, '#d7c39b']]); rr(ctx, -w / 2, -h, w, h - 4, 8); ctx.fill();
  ctx.strokeStyle = '#6b5b3f'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); rr(ctx, -w / 2 + 4, -h + 4, w - 8, h - 12, 6); ctx.clip();
  // círculos de puntaje impresos, apenas marcados
  ctx.strokeStyle = '#6b5b3f22'; ctx.lineWidth = 2; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(0, -165, k * 34, 0, TAU); ctx.stroke(); }
  drawPrint(ctx, t);
  for (const o of t.holes) {
    ctx.fillStyle = o.color + '88'; ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0f06'; ctx.beginPath(); ctx.arc(o.x, o.y, 4.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#9ca3af'; for (const [x, y] of [[-w / 2 + 10, -h + 10], [w / 2 - 10, -h + 10], [-w / 2 + 10, -18], [w / 2 - 10, -18]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); }
}

// Dibuja un cartel en su lugar: sube desde detrás de la cobertura y, al recibir el tiro, se va para atrás.
export function drawTarget(ctx: Ctx, t: Target, now: number) {
  const { up, fall } = poseOf(t, now);
  if (up <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, t.y); ctx.clip(); // detrás de la cobertura
  ctx.translate(t.x, t.y + BOARD.h * t.scale * (1 - up) * (fall > 0 ? 0 : 1));
  ctx.scale(t.scale, t.scale);
  // se inclina para atrás sobre la bisagra de abajo: se achata, se angosta arriba (perspectiva) y se oscurece
  const ang = fall * Math.PI * 0.5, sy = Math.cos(ang);
  ctx.scale(t.mirror ? -1 : 1, Math.max(0.02, sy));
  drawBoard(ctx, t);
  if (fall > 0) { ctx.fillStyle = `rgba(0,0,0,${0.55 * fall})`; ctx.fillRect(-BOARD.w / 2, -BOARD.h, BOARD.w, BOARD.h); }
  ctx.restore();
}
export function drawRowCover(ctx: Ctx, layers: SceneLayers, row: number) { ctx.drawImage(layers.rows[row], 0, 0, W, H); }
export function drawBack(ctx: Ctx, layers: SceneLayers) { ctx.drawImage(layers.back, 0, 0, W, H); }

// ───────────── El arma en primera persona ─────────────
// Se dibuja en un sistema local: y crece hacia la mira (0 en la culata, L en la boca), x a lo ancho.
// Se angosta hacia la boca para que parezca que apunta hacia adentro de la pantalla.
interface GunShape { L: number; draw: (ctx: Ctx, P: (x: number, y: number) => [number, number], c: string) => void }
function poly(ctx: Ctx, P: (x: number, y: number) => [number, number], pts: [number, number][], fill: string | CanvasGradient) { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = P(x, y); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.closePath(); ctx.fill(); }
function box(ctx: Ctx, P: (x: number, y: number) => [number, number], x0: number, x1: number, y0: number, y1: number, fill: string) { poly(ctx, P, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill); }
function strip(ctx: Ctx, P: (x: number, y: number) => [number, number], x: number, y0: number, y1: number, c: string, w = 4) { const [a, b] = P(x, y0), [d, e] = P(x, y1); neonLine(ctx, a, b, d, e, c, w); }
const GUNS: Record<WeaponId, GunShape> = {
  escopeta: { L: 330, draw: (ctx, P, c) => {
    box(ctx, P, -62, 62, 0, 120, '#1f2430'); box(ctx, P, -52, 52, 110, 250, '#2b3240');
    box(ctx, P, -58, -10, 240, 330, '#111827'); box(ctx, P, 10, 58, 240, 330, '#111827');
    box(ctx, P, -64, 64, 150, 200, '#3a4252'); // corredera
    strip(ctx, P, -36, 30, 230, c, 5); strip(ctx, P, 36, 30, 230, c, 5);
    for (const x of [-34, 34]) { const [a, b] = P(x, 330); glow(ctx, c, 16, () => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(a, b, 16, 7, 0, 0, TAU); ctx.fill(); }); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(a, b, 8, 3.5, 0, 0, TAU); ctx.fill(); }
  } },
  ametralladora: { L: 380, draw: (ctx, P, c) => {
    box(ctx, P, -46, 46, 0, 140, '#1c2230'); box(ctx, P, -40, 40, 130, 290, '#273042');
    box(ctx, P, -22, 22, 280, 380, '#111827');
    for (let k = 0; k < 7; k++) box(ctx, P, -36, 36, 150 + k * 20, 158 + k * 20, c + '99');
    box(ctx, P, -70, -46, 60, 180, '#30394b'); // cargador al costado
    strip(ctx, P, 0, 10, 140, c, 4);
    const [a, b] = P(0, 380); glow(ctx, c, 14, () => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(a, b, 12, 5, 0, 0, TAU); ctx.fill(); });
  } },
  rifle: { L: 440, draw: (ctx, P, c) => {
    box(ctx, P, -40, 40, 0, 150, '#1e1b2e'); box(ctx, P, -30, 30, 140, 320, '#2a2540');
    box(ctx, P, -12, 12, 310, 440, '#0f0d1a');
    for (let k = 0; k < 5; k++) { const y = 330 + k * 22; const [a, b] = P(0, y); glow(ctx, c, 12, () => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(a, b, 20 - k * 1.5, 8 - k * 0.6, 0, 0, TAU); ctx.stroke(); }); }
    // mira telescópica arriba
    box(ctx, P, -18, 18, 120, 250, '#0b0a12'); const [sa, sb] = P(0, 250); glow(ctx, c, 10, () => { ctx.fillStyle = c + 'aa'; ctx.beginPath(); ctx.ellipse(sa, sb, 16, 7, 0, 0, TAU); ctx.fill(); });
    strip(ctx, P, -26, 20, 140, c, 3); strip(ctx, P, 26, 20, 140, c, 3);
  } },
  pistola: { L: 230, draw: (ctx, P, c) => {
    box(ctx, P, -34, 34, 0, 120, '#26202a'); box(ctx, P, -30, 30, 100, 230, '#3a2f3d');
    strip(ctx, P, 0, 110, 222, c, 4); box(ctx, P, -38, -30, 120, 200, c + 'aa'); box(ctx, P, 30, 38, 120, 200, c + 'aa');
    const [a, b] = P(0, 230); glow(ctx, c, 12, () => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(a, b, 10, 4, 0, 0, TAU); ctx.fill(); });
  } },
  revolver: { L: 250, draw: (ctx, P, c) => {
    box(ctx, P, -32, 32, 0, 110, '#2a2416'); box(ctx, P, -46, 46, 100, 170, '#3d3520');
    for (let k = -2; k <= 2; k++) { const [a, b] = P(k * 17, 136); glow(ctx, c, 8, () => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(a, b, 5.5, 0, TAU); ctx.fill(); }); }
    box(ctx, P, -16, 16, 165, 250, '#1a160c'); strip(ctx, P, 0, 175, 245, c, 3);
    const [a, b] = P(0, 250); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(a, b, 8, 3.5, 0, 0, TAU); ctx.fill();
  } },
};
export interface GunPose { x: number; y: number; ang: number; kick: number }
// Dónde va el arma: abajo, corrida a la derecha de la mira y siguiéndola por todo el mapa (más arriba cuanto más arriba apunta).
export function gunBase(aimX: number, aimY: number) { return { x: Math.max(200, Math.min(W - 40, aimX * 0.8 + W * 0.1 + 170)), y: H + 40 - (H - aimY) * 0.14 }; }
export const GUN_SCALE = 1.3;
// Devuelve la boca del arma en la pantalla.
export function drawGun(ctx: Ctx, id: WeaponId, pose: GunPose, char: CharSpec, aim: { x: number; y: number }, scale = 1): { x: number; y: number } {
  const gun = GUNS[id], c = WEAPONS[id].color, LEN = 0.58, L = gun.L * scale * LEN;
  const dir = Math.atan2(aim.y - pose.y, aim.x - pose.x);
  ctx.save();
  ctx.translate(pose.x, pose.y); ctx.rotate(dir + Math.PI / 2);
  ctx.translate(0, pose.kick * 40 * scale); ctx.rotate(pose.kick * 0.08);
  // y local hacia arriba (hacia la mira); se angosta hasta 58% en la boca
  const P = (x: number, y: number): [number, number] => { const k = 1 - 0.42 * (y / gun.L); return [x * k * scale, -y * scale * LEN]; };
  // brazos y guantes del personaje
  ctx.lineCap = 'round';
  limb(ctx, 150 * scale, 240 * scale, 30 * scale, -40 * scale, 64 * scale, char.color);
  limb(ctx, -170 * scale, 260 * scale, -40 * scale, -150 * scale * LEN, 58 * scale, char.color);
  ctx.strokeStyle = char.accent; ctx.lineWidth = 6 * scale; ctx.beginPath(); ctx.moveTo(120 * scale, 190 * scale); ctx.lineTo(50 * scale, 40 * scale); ctx.stroke();
  gun.draw(ctx, P, c);
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(26 * scale, -36 * scale, 30 * scale, 0, TAU); ctx.fill(); // mano en la empuñadura
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(-34 * scale, -150 * scale * LEN, 26 * scale, 0, TAU); ctx.fill(); // mano de apoyo
  ctx.fillStyle = char.visor; ctx.fillRect(14 * scale, -44 * scale, 24 * scale, 5 * scale);
  ctx.restore();
  const k = pose.kick * 40 * scale;
  return { x: pose.x + Math.cos(dir) * (L - k), y: pose.y + Math.sin(dir) * (L - k) };
}

// ───────────── Mira ─────────────
export function drawReticle(ctx: Ctx, x: number, y: number, spread: number, id: WeaponId, reload: number) {
  const c = WEAPONS[id].color, gap = 10 + spread;
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = c; ctx.shadowBlur = 8; ctx.strokeStyle = c; ctx.lineWidth = 2.5;
  if (id === 'escopeta') { ctx.beginPath(); ctx.arc(0, 0, gap, 0, TAU); ctx.stroke(); }
  if (id === 'rifle' || id === 'revolver') { ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke(); }
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(dx * gap, dy * gap); ctx.lineTo(dx * (gap + 16), dy * (gap + 16)); }
  ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
  if (reload > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + TAU * reload); ctx.stroke(); }
  ctx.restore();
}

// ───────────── Efectos ─────────────
export interface Fx { kind: 'tracer' | 'spark' | 'pop' | 'flash'; x: number; y: number; x2?: number; y2?: number; at: number; color: string; text?: string; big?: boolean }
export function drawFx(ctx: Ctx, list: Fx[], now: number) {
  for (const f of list) {
    const a = now - f.at;
    if (f.kind === 'tracer' && a < 0.09) {
      ctx.save(); ctx.globalAlpha = 1 - a / 0.09; ctx.globalCompositeOperation = 'lighter';
      neonLine(ctx, f.x, f.y, f.x2!, f.y2!, f.color, 5); ctx.restore();
    }
    if (f.kind === 'flash' && a < 0.07) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = 40 + a * 500;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, f.color); g.addColorStop(1, '#0000');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (f.kind === 'spark' && a < 0.3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - a / 0.3;
      const r = rng(f.at * 13 + f.x); ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const ang = r() * TAU, d0 = a * 90, d1 = a * 220 + 6; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(ang) * d0, f.y + Math.sin(ang) * d0); ctx.lineTo(f.x + Math.cos(ang) * d1, f.y + Math.sin(ang) * d1); ctx.stroke(); }
      ctx.restore();
    }
    if (f.kind === 'pop' && a < 1.1) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (1.1 - a) / 0.4);
      ctx.font = `900 ${f.big ? 44 : 32}px Impact, "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = f.y - a * 70; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(f.text!, f.x, y);
      ctx.shadowColor = f.color; ctx.shadowBlur = 14; ctx.fillStyle = f.color; ctx.fillText(f.text!, f.x, y); ctx.restore();
    }
  }
}
export function drawCountdown(ctx: Ctx, time: number) {
  if (time >= 0.7) return;
  const n = time < 0 ? Math.ceil(-time) : 0, a = time < 0 ? 1 - (Math.ceil(-time) + time) : time / 0.7;
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${time < 0 ? 0.35 : 0.35 * (1 - a)})`; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2); const k = 1.4 - 0.4 * a; ctx.scale(k, k); ctx.globalAlpha = time < 0 ? 1 : 1 - a;
  neonText(ctx, n ? String(n) : '¡FUEGO!', 0, 0, n ? 200 : 150, n ? '#38bdf8' : '#f43f5e');
  ctx.restore();
}

// ───────────── Retratos y armas para los menús ─────────────
export function drawPortrait(ctx: Ctx, c: CharSpec, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1020'); g.addColorStop(1, c.color + '88'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h); const k = h / 200; ctx.scale(k, k);
  // hombros con armadura
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-85, -70, -40, -80); ctx.lineTo(40, -80); ctx.quadraticCurveTo(85, -70, 90, 0); ctx.fill();
  ctx.fillStyle = '#0f172a'; rr(ctx, -30, -80, 60, 80, 10); ctx.fill();
  neonLine(ctx, -24, -50, 24, -50, c.accent, 3); neonLine(ctx, -60, -40, -40, -70, c.accent, 3); neonLine(ctx, 60, -40, 40, -70, c.accent, 3);
  // cuello y cabeza
  ctx.fillStyle = c.skin; ctx.fillRect(-13, -100, 26, 24);
  ctx.beginPath(); ctx.ellipse(0, -128, 34, 40, 0, 0, TAU); ctx.fill();
  if (c.id === 'r7') { ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, -128); ctx.lineTo(34, -128); ctx.moveTo(0, -168); ctx.lineTo(0, -95); ctx.stroke(); }
  // pelo o casco
  ctx.fillStyle = c.hair;
  if (c.id === 'titan') { ctx.beginPath(); ctx.ellipse(0, -150, 36, 22, 0, Math.PI, TAU); ctx.fill(); }
  else if (c.id === 'nova') { ctx.beginPath(); ctx.ellipse(0, -150, 38, 26, 0, Math.PI, TAU); ctx.fill(); rr(ctx, -40, -152, 14, 60, 7); ctx.fill(); rr(ctx, 26, -152, 14, 60, 7); ctx.fill(); }
  else if (c.id === 'kira') { ctx.beginPath(); ctx.ellipse(0, -152, 36, 22, -0.2, Math.PI, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(10, -170); ctx.lineTo(50, -110); ctx.lineTo(30, -160); ctx.fill(); }
  else if (c.id === 'sombra') { ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.ellipse(0, -140, 40, 46, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.fillRect(-40, -140, 14, 50); ctx.fillRect(26, -140, 14, 50); }
  else if (c.id === 'brick') { ctx.beginPath(); ctx.ellipse(0, -156, 30, 14, 0, Math.PI, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -100, 22, 12, 0, 0, Math.PI); ctx.fill(); }
  else { ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(0, -140, 38, 44, 0, Math.PI, TAU); ctx.fill(); }
  // visor
  glow(ctx, c.visor, 16, () => { ctx.fillStyle = c.visor; rr(ctx, -30, -140, 60, 14, 7); ctx.fill(); });
  ctx.fillStyle = '#ffffff88'; rr(ctx, -24, -138, 18, 4, 2); ctx.fill();
  ctx.strokeStyle = '#0006'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, -106); ctx.lineTo(10, -106); ctx.stroke();
  ctx.restore();
}
// El arma de perfil (para elegir).
export function drawWeaponIcon(ctx: Ctx, id: WeaponId, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const c = WEAPONS[id].color;
  ctx.save(); ctx.translate(w / 2, h / 2); const k = Math.min(w / 260, h / 110); ctx.scale(k, k);
  const body = '#1f2937', dark = '#0b1220';
  const parts: Record<WeaponId, () => void> = {
    escopeta: () => { ctx.fillStyle = body; rr(ctx, -110, -18, 190, 30, 8); ctx.fill(); ctx.fillStyle = dark; ctx.fillRect(60, -14, 60, 10); ctx.fillRect(60, -2, 60, 10); ctx.fillStyle = '#374151'; rr(ctx, 0, 10, 50, 16, 6); ctx.fill(); ctx.beginPath(); ctx.moveTo(-110, -10); ctx.lineTo(-130, 30); ctx.lineTo(-100, 34); ctx.lineTo(-80, 12); ctx.fill(); ctx.fillStyle = body; ctx.fillRect(-70, 10, 18, 30); neonLine(ctx, -90, -6, 50, -6, c, 4); },
    ametralladora: () => { ctx.fillStyle = body; rr(ctx, -90, -20, 160, 34, 6); ctx.fill(); ctx.fillStyle = dark; ctx.fillRect(70, -10, 60, 12); ctx.fillStyle = '#374151'; ctx.fillRect(-20, 14, 26, 50); ctx.fillRect(-70, 14, 18, 30); for (let i = 0; i < 6; i++) { ctx.fillStyle = c; ctx.fillRect(10 + i * 10, -14, 5, 20); } ctx.beginPath(); ctx.fillStyle = body; ctx.moveTo(-90, -14); ctx.lineTo(-130, -6); ctx.lineTo(-130, 20); ctx.lineTo(-90, 10); ctx.fill(); },
    rifle: () => { ctx.fillStyle = body; rr(ctx, -80, -14, 130, 26, 6); ctx.fill(); ctx.fillStyle = dark; ctx.fillRect(50, -6, 85, 9); ctx.fillStyle = '#111'; rr(ctx, -40, -36, 80, 16, 8); ctx.fill(); glow(ctx, c, 10, () => { ctx.fillStyle = c; ctx.fillRect(38, -32, 4, 8); }); for (let i = 0; i < 4; i++) { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(70 + i * 16, -2, 9, 0, TAU); ctx.stroke(); } ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-80, -10); ctx.lineTo(-130, 0); ctx.lineTo(-125, 26); ctx.lineTo(-70, 12); ctx.fill(); ctx.fillRect(-50, 10, 16, 30); },
    pistola: () => { ctx.fillStyle = body; rr(ctx, -60, -26, 130, 30, 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-10, 0); ctx.lineTo(-24, 50); ctx.lineTo(-62, 46); ctx.fill(); neonLine(ctx, -40, -12, 60, -12, c, 4); },
    revolver: () => { ctx.fillStyle = dark; ctx.fillRect(10, -20, 110, 16); ctx.fillStyle = body; rr(ctx, -40, -28, 60, 40, 10); ctx.fill(); for (let i = 0; i < 3; i++) { glow(ctx, c, 8, () => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-24 + i * 16, -8, 5, 0, TAU); ctx.fill(); }); } ctx.fillStyle = '#3d3520'; ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(-10, 6); ctx.lineTo(-30, 60); ctx.lineTo(-66, 52); ctx.fill(); },
  };
  parts[id]();
  ctx.restore();
}
// Para el menú: un cartel suelto (malo o rehén) de muestra.
export function drawSampleBoard(ctx: Ctx, kind: Target['kind'], seed: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.save(); const k = h / (BOARD.h + 20); ctx.translate(w / 2, h - 6); ctx.scale(k, k);
  drawBoard(ctx, { kind, seed, holes: [] }); ctx.restore();
}
export { lerp };
