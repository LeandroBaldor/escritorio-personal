// Dibujos de "Ciudad Tiburón": los edificios (de distintos estilos, con puertas y departamentos por dentro),
// los autos, las cosas que flotan, los árboles, los faroles y los efectos (salpicaduras y sangre).
import { doorAt, FLOAT_Y, type Block, type Debris, type Decor, type Plat, type SharkGame } from './shark';
import { windAt as baseWind } from './shark';
// El viento de siempre más el súper viento (que dobla los árboles y hace volar la ropa).
const windAt = (t: number) => baseWind(t) + scene.gale * 3;
import { texture, weather } from './sharkTextures';
import { hash, hsl, rect, scene, surfaceClip, visible, waveY, X, Y, type View } from './sharkView';

// ---------- Edificios ----------
const yk = (b: Block, k: number) => k * b.fh - 1.2; // el piso k (el 0 está bajo el agua)

// Las puertas de cada edificio (de los departamentos a los balcones y a la escalera de incendio).
const doorCache = new WeakMap<SharkGame, Map<number, { side: -1 | 1; y: number }[]>>();
export function doorsOf(g: SharkGame, b: Block) {
  let byGame = doorCache.get(g);
  if (!byGame) { byGame = new Map(); doorCache.set(g, byGame); }
  let list = byGame.get(b.id);
  if (!list) {
    list = [];
    if (b.kind === 'building') for (let k = 1; k < b.floors; k++) for (const side of [-1, 1] as const) if (doorAt(g, b, side, yk(b, k))) list.push({ side, y: yk(b, k) });
    byGame.set(b.id, list);
  }
  return list;
}

interface WindowLook { frame: string; lit: string; dark: string; shape: 'rect' | 'arch' | 'tall' | 'panel'; w: number; h: number }
const LOOKS: Record<Block['style'], WindowLook> = {
  concrete: { frame: '#0f172a', lit: '#fcd34d', dark: '#1e3a5f', shape: 'rect', w: 0.9, h: 1.25 },
  brick: { frame: '#f5efe6', lit: '#fde68a', dark: '#243b55', shape: 'arch', w: 0.8, h: 1.3 },
  glass: { frame: '#94a3b8', lit: '#fef3c7', dark: '#1d4e6e', shape: 'panel', w: 1, h: 2.1 },
  classic: { frame: '#e7dcc4', lit: '#fcd34d', dark: '#2a3a52', shape: 'tall', w: 0.75, h: 1.5 },
  deco: { frame: '#d4a72c', lit: '#fde68a', dark: '#1c2840', shape: 'tall', w: 0.6, h: 1.6 },
};

function windowRow(ctx: CanvasRenderingContext2D, v: View, b: Block, k: number, look: WindowLook, t: number, doors: { side: -1 | 1; y: number }[]) {
  const y1 = yk(b, k), w = b.x2 - b.x1, s = v.s;
  const n = Math.max(1, Math.floor((w - 0.6) / (look.w + 0.6))), gap = (w - n * look.w) / (n + 1);
  const hasDoor = (side: number) => doors.some(d => d.side === side && Math.abs(d.y - y1) < 0.05);
  for (let i = 0; i < n; i++) {
    const wx = b.x1 + gap + i * (look.w + gap), h = hash(b.id * 1000 + k * 37 + i * 7);
    if ((i === 0 && hasDoor(-1)) || (i === n - 1 && hasDoor(1))) continue; // ahí va la puerta
    const wy1 = y1 + (look.shape === 'panel' ? 0.2 : 0.55), wy2 = Math.min(y1 + b.fh - 0.35, wy1 + look.h);
    const lit = h < 0.45, color = lit ? (h < 0.1 && Math.floor(t * 2 + i) % 5 === 0 ? '#a16207' : look.lit) : look.dark;
    const curtains = () => { // cortinas a los costados (o una persiana a medio bajar) y el reflejo del vidrio
      if (look.shape === 'panel') return;
      const kind = Math.floor(h * 100) % 3;
      ctx.fillStyle = lit ? 'rgba(180,83,9,0.45)' : 'rgba(148,163,184,0.25)';
      if (kind === 0) { rect(ctx, v, wx, wy1, look.w * 0.22, wy2); rect(ctx, v, wx + look.w * 0.78, wy1, look.w * 0.22, wy2); }
      else if (kind === 1) { ctx.fillStyle = 'rgba(30,41,59,0.6)'; rect(ctx, v, wx, wy2 - (wy2 - wy1) * 0.45, look.w, wy2); }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(X(v, wx), Y(v, wy2)); ctx.lineTo(X(v, wx + look.w * 0.4), Y(v, wy2)); ctx.lineTo(X(v, wx), Y(v, wy2 - look.w * 0.6)); ctx.fill();
    };
    ctx.fillStyle = look.frame;
    if (look.shape === 'arch') {
      const cx = X(v, wx + look.w / 2), r = (look.w / 2 + 0.08) * s;
      ctx.beginPath(); ctx.moveTo(cx - r, Y(v, wy1 - 0.08)); ctx.lineTo(cx - r, Y(v, wy2 - look.w / 2)); ctx.arc(cx, Y(v, wy2 - look.w / 2), r, Math.PI, 0); ctx.lineTo(cx + r, Y(v, wy1 - 0.08)); ctx.fill();
      ctx.fillStyle = color; const ri = r - 0.08 * s;
      ctx.beginPath(); ctx.moveTo(cx - ri, Y(v, wy1)); ctx.lineTo(cx - ri, Y(v, wy2 - look.w / 2)); ctx.arc(cx, Y(v, wy2 - look.w / 2), ri, Math.PI, 0); ctx.lineTo(cx + ri, Y(v, wy1)); ctx.fill();
      ctx.fillStyle = '#7c2d12'; rect(ctx, v, wx - 0.12, wy1 - 0.16, look.w + 0.24, wy1 - 0.05); // alféizar
    } else {
      rect(ctx, v, wx - 0.07, wy1 - 0.07, look.w + 0.14, wy2 + 0.07);
      ctx.fillStyle = color; rect(ctx, v, wx, wy1, look.w, wy2);
      curtains();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rect(ctx, v, wx - 0.12, wy1 - 0.2, look.w + 0.24, wy1 - 0.07); // alféizar
      if (look.shape === 'tall' && b.style === 'classic') { ctx.fillStyle = look.frame; ctx.beginPath(); ctx.moveTo(X(v, wx - 0.15), Y(v, wy2 + 0.12)); ctx.lineTo(X(v, wx + look.w / 2), Y(v, wy2 + 0.45)); ctx.lineTo(X(v, wx + look.w + 0.15), Y(v, wy2 + 0.12)); ctx.fill(); } // frontón
    }
    // Gente asomada pidiendo ayuda o saludando.
    if (h > 0.45 && h < 0.52) {
      const px = X(v, wx + look.w / 2), py = Y(v, wy1 + 0.35);
      ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(px, py - s * 0.35, s * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - s * 0.18, py - s * 0.18, s * 0.36, s * 0.3);
      ctx.strokeStyle = '#0b1220'; ctx.lineWidth = Math.max(1.5, s * 0.08);
      const wave = Math.sin(t * 8 + i) * 0.25;
      ctx.beginPath(); ctx.moveTo(px + s * 0.15, py - s * 0.15); ctx.lineTo(px + s * (0.3 + wave * 0.3), py - s * 0.6); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    if (look.shape !== 'arch') { rect(ctx, v, wx + look.w / 2 - 0.03, wy1, 0.06, wy2); rect(ctx, v, wx, (wy1 + wy2) / 2 - 0.03, look.w, (wy1 + wy2) / 2 + 0.03); }
  }
  // Las puertas a los departamentos.
  for (const d of doors) {
    if (Math.abs(d.y - y1) > 0.05) continue;
    const dx = d.side < 0 ? b.x1 + 0.25 : b.x2 - 1.15;
    ctx.fillStyle = '#1c1917'; rect(ctx, v, dx - 0.07, y1, 1.04, y1 + 2.05);
    ctx.fillStyle = hsl((b.hue + 20) % 360, 35, 32); rect(ctx, v, dx, y1, 0.9, y1 + 1.98);
    ctx.fillStyle = 'rgba(253,230,138,0.85)'; rect(ctx, v, dx + 0.15, y1 + 1.15, 0.6, y1 + 1.8); // vidrio con luz
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(X(v, d.side < 0 ? dx + 0.75 : dx + 0.15), Y(v, y1 + 0.95), Math.max(1.2, s * 0.05), 0, Math.PI * 2); ctx.fill();
  }
}

// Un edificio de alguno de los cinco estilos.
export function drawBuilding(ctx: CanvasRenderingContext2D, g: SharkGame, b: Block, v: View, flash: number) {
  const s = v.s, w = b.x2 - b.x1, t = v.t, look = LOOKS[b.style], doors = doorsOf(g, b);
  switch (b.style) {
    case 'brick': {
      // Ladrillo rojo, naranja, marrón o amarillento.
      const [h, sat, l] = [[8, 55, 34], [20, 60, 40], [14, 35, 26], [38, 45, 52]][Math.floor(b.tone * 4)];
      ctx.fillStyle = hsl(h, sat, l); rect(ctx, v, b.x1, -3, w, b.top);
      texture(ctx, v, 'brick', b.x1, -3, b.x2, b.top, 0.95);
      break;
    }
    case 'glass': {
      const gr = ctx.createLinearGradient(X(v, b.x1), 0, X(v, b.x2), 0);
      gr.addColorStop(0, '#173b52'); gr.addColorStop(0.5, flash > 0.1 ? '#6fb3d8' : '#2a6b8a'); gr.addColorStop(1, '#14324a');
      ctx.fillStyle = gr; rect(ctx, v, b.x1, -3, w, b.top);
      // Reflejos diagonales.
      ctx.fillStyle = `rgba(255,255,255,${0.06 + flash * 0.2})`;
      for (let i = 0; i < 3; i++) { const x0 = b.x1 + w * (0.15 + i * 0.3); ctx.beginPath(); ctx.moveTo(X(v, x0), Y(v, b.top)); ctx.lineTo(X(v, x0 + 0.6), Y(v, b.top)); ctx.lineTo(X(v, x0 - 2.4), Y(v, b.top - 6)); ctx.lineTo(X(v, x0 - 3), Y(v, b.top - 6)); ctx.fill(); }
      break;
    }
    case 'classic': {
      const [h, sat] = [[38, 28], [20, 30], [45, 20], [10, 25]][Math.floor(b.tone * 4)];
      ctx.fillStyle = hsl(h, sat, 55 + b.tone * 12); rect(ctx, v, b.x1, -3, w, b.top);
      texture(ctx, v, 'stone', b.x1, -3, b.x2, b.top, 0.8);
      ctx.fillStyle = 'rgba(0,0,0,0.07)'; for (let x = b.x1 + 0.2; x < b.x2 - 0.2; x += 2.2) rect(ctx, v, x, -3, 0.35, b.top - 0.6); // pilastras
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = -1.1; y < 1.4; y += 0.45) rect(ctx, v, b.x1, y, w, y + 0.05); // piedra almohadillada abajo
      break;
    }
    case 'deco': {
      ctx.fillStyle = hsl([240, 160, 0, 200][Math.floor(b.tone * 4)], 14, 18 + b.tone * 8); rect(ctx, v, b.x1, -3, w, b.top);
      texture(ctx, v, 'panel', b.x1, -3, b.x2, b.top, 0.7);
      ctx.fillStyle = 'rgba(212,167,44,0.35)'; for (let x = b.x1 + 0.5; x < b.x2 - 0.3; x += 1.2) rect(ctx, v, x, -3, 0.1, b.top - 0.8); // franjas doradas
      // Corona escalonada abajo de la terraza y una aguja.
      ctx.fillStyle = '#d4a72c'; rect(ctx, v, b.x1, b.top - 0.8, w, b.top - 0.65); rect(ctx, v, b.x1 + 0.4, b.top - 0.5, w - 0.8, b.top - 0.4);
      ctx.strokeStyle = '#d4a72c'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.beginPath(); ctx.moveTo(X(v, b.x1 + w / 2), Y(v, b.top)); ctx.lineTo(X(v, b.x1 + w / 2), Y(v, b.top + 2.6)); ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = hsl([210, 30, 0, 180][Math.floor(b.tone * 4)], 8 + b.tone * 10, 34 + b.tone * 16); rect(ctx, v, b.x1, -3, w, b.top);
      texture(ctx, v, 'concrete', b.x1, -3, b.x2, b.top, 0.95);
  }
  if (b.style === 'glass') texture(ctx, v, 'panel', b.x1, -3, b.x2, b.top, 0.25);
  for (let k = 0; k < b.floors; k++) {
    const y1 = yk(b, k);
    ctx.fillStyle = b.style === 'glass' ? 'rgba(148,163,184,0.55)' : 'rgba(0,0,0,0.18)'; rect(ctx, v, b.x1, y1 - 0.1, w, y1 + 0.08);
    windowRow(ctx, v, b, k, look, t, doors);
  }
  if (b.style === 'glass') { ctx.fillStyle = 'rgba(148,163,184,0.5)'; for (let x = b.x1; x <= b.x2; x += (b.x2 - b.x1) / Math.max(2, Math.round(w / 1.6))) rect(ctx, v, x - 0.03, -3, 0.06, b.top); }
  weather(ctx, v, b.x1, b.x2, b.top - 0.3, b.id * 31);
  // Cornisa, chorreaduras de lluvia y la marca de hasta dónde llegó el agua.
  ctx.fillStyle = b.style === 'classic' ? hsl(38, 25, 72) : b.style === 'brick' ? '#5b2418' : b.style === 'glass' ? '#334155' : b.style === 'deco' ? '#2b2a33' : hsl(b.hue, 10, 20 + b.tone * 10);
  rect(ctx, v, b.x1 - 0.12, b.top - 0.3, w + 0.24, b.top);
  if (b.style === 'classic') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = b.x1; x < b.x2; x += 0.3) rect(ctx, v, x, b.top - 0.45, 0.15, b.top - 0.3); } // dentículos
  ctx.fillStyle = 'rgba(15,23,42,0.18)';
  for (let i = 0; i < 6; i++) rect(ctx, v, b.x1 + hash(b.id * 9 + i) * w, b.top - 0.3 - hash(i + b.id) * 6, 0.08, b.top - 0.3);
  ctx.fillStyle = 'rgba(56,72,60,0.45)'; rect(ctx, v, b.x1, -0.2, w, 0.55);
  if (b.style !== 'deco') {
    ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(1, s * 0.06);
    const ax = X(v, b.x1 + w * 0.7);
    ctx.beginPath(); ctx.moveTo(ax, Y(v, b.top)); ctx.lineTo(ax, Y(v, b.top + 2.2)); ctx.moveTo(ax - s * 0.4, Y(v, b.top + 1.7)); ctx.lineTo(ax + s * 0.4, Y(v, b.top + 1.7)); ctx.moveTo(ax - s * 0.25, Y(v, b.top + 2)); ctx.lineTo(ax + s * 0.25, Y(v, b.top + 2)); ctx.stroke();
  }
  // En la terraza: equipos de aire, una antena satelital y, en algunos, un cartel publicitario.
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rect(ctx, v, b.x1 - 0.12, b.top - 0.04, w + 0.24, b.top);
  for (let i = 0; i < 2; i++) { const ax = b.x1 + w * (0.45 + i * 0.13); ctx.fillStyle = '#9ca3af'; rect(ctx, v, ax, b.top, 0.6, b.top + 0.45); ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(X(v, ax + 0.3), Y(v, b.top + 0.22), s * 0.15, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse(X(v, b.x2 - 0.7), Y(v, b.top + 0.65), s * 0.32, s * 0.22, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(X(v, b.x2 - 0.7), Y(v, b.top + 0.6)); ctx.lineTo(X(v, b.x2 - 0.7), Y(v, b.top)); ctx.stroke();
  if (hash(b.id * 3) < 0.35 && w > 6.5) {
    const bx = b.x1 + 0.6, bw = Math.min(4, w - 2.6), by = b.top + 1.4;
    ctx.strokeStyle = '#374151'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.beginPath(); ctx.moveTo(X(v, bx + 0.4), Y(v, b.top)); ctx.lineTo(X(v, bx + 0.4), Y(v, by)); ctx.moveTo(X(v, bx + bw - 0.4), Y(v, b.top)); ctx.lineTo(X(v, bx + bw - 0.4), Y(v, by)); ctx.stroke();
    const ad = ctx.createLinearGradient(X(v, bx), 0, X(v, bx + bw), 0);
    ad.addColorStop(0, hsl(b.hue, 70, 45)); ad.addColorStop(1, hsl((b.hue + 60) % 360, 70, 35));
    ctx.fillStyle = ad; rect(ctx, v, bx, by, bw, by + 1.5);
    ctx.fillStyle = '#fef3c7'; ctx.font = `900 ${Math.max(7, Math.round(s * 0.45))}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(['GASEOSA FRESH', 'BANCO NACIÓN', 'SUPER 24 HS', 'RADIO 105.9'][b.id % 4], X(v, bx + bw / 2), Y(v, by + 0.75), bw * s * 0.9);
    texture(ctx, v, 'stucco', bx, by, bx + bw, by + 1.5, 0.35);
  }
  // Plantas y un arbolito en maceta en la terraza.
  const px = b.x1 + w * (0.2 + hash(b.id + 5) * 0.2);
  ctx.fillStyle = '#7c2d12'; rect(ctx, v, px - 0.3, b.top, 0.6, b.top + 0.45);
  drawCrown(ctx, v, px, b.top + 1.2, 0.55, t, b.id);
}

// ---------- Casas ----------
// Casa de dos pisos con revoque, postigos, rejas en las ventanas de abajo, una puerta, moldura entre los pisos,
// baranda en la terraza y una soga con ropa que se mueve con el viento.
export function drawHouse(ctx: CanvasRenderingContext2D, b: Block, v: View) {
  const s = v.s, w = b.x2 - b.x1, t = v.t;
  ctx.fillStyle = hsl(b.hue, 30 + b.tone * 20, 50 + b.tone * 14); rect(ctx, v, b.x1, -3, w, b.top);
  texture(ctx, v, 'stucco', b.x1, -3, b.x2, b.top, 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rect(ctx, v, b.x1, 2.45, w, 2.62); ctx.fillStyle = 'rgba(0,0,0,0.2)'; rect(ctx, v, b.x1, 2.38, w, 2.45); // moldura
  for (const [y1, y2, low] of [[0.2, 1.7, true], [3, 4.4, false]] as const) {
    for (const fx of [0.18, 0.64]) {
      const wx = b.x1 + w * fx, ww = w * 0.18, lit = hash(b.id + y1 + fx) < 0.5;
      ctx.fillStyle = '#e7e5e4'; rect(ctx, v, wx - 0.08, y1 - 0.08, ww + 0.16, y2 + 0.08); // marco
      const glass = ctx.createLinearGradient(0, Y(v, y2), 0, Y(v, y1));
      glass.addColorStop(0, lit ? '#fde68a' : '#475569'); glass.addColorStop(1, lit ? '#f59e0b' : '#1e293b');
      ctx.fillStyle = glass; rect(ctx, v, wx, y1, ww, y2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(X(v, wx), Y(v, y2)); ctx.lineTo(X(v, wx + ww * 0.5), Y(v, y2)); ctx.lineTo(X(v, wx), Y(v, y2 - 0.6)); ctx.fill();
      ctx.fillStyle = '#e7e5e4'; rect(ctx, v, wx + ww / 2 - 0.03, y1, 0.06, y2);
      if (low) { ctx.fillStyle = '#1f2937'; for (let x = wx + 0.1; x < wx + ww; x += 0.22) rect(ctx, v, x, y1, 0.04, y2); rect(ctx, v, wx, (y1 + y2) / 2, ww, (y1 + y2) / 2 + 0.04); } // reja
      ctx.fillStyle = hsl((b.hue + 160) % 360, 40, 32); rect(ctx, v, wx - 0.34, y1, 0.26, y2); rect(ctx, v, wx + ww + 0.08, y1, 0.26, y2); // postigos
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (const px of [wx - 0.34, wx + ww + 0.08]) for (let y = y1 + 0.15; y < y2; y += 0.2) rect(ctx, v, px, y, 0.26, y + 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rect(ctx, v, wx - 0.15, y1 - 0.2, ww + 0.3, y1 - 0.08); // alféizar
    }
  }
  // La puerta (medio tapada por el agua).
  const dx = b.x1 + w * 0.43;
  ctx.fillStyle = '#3f2a14'; rect(ctx, v, dx - 0.08, -0.5, 0.86, 1.95);
  ctx.fillStyle = '#7c4a1e'; rect(ctx, v, dx, -0.5, 0.7, 1.87);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rect(ctx, v, dx + 0.1, 0.9, 0.5, 1.7); rect(ctx, v, dx + 0.1, 0, 0.5, 0.75);
  weather(ctx, v, b.x1, b.x2, b.top, b.id * 17);
  // Baranda de la terraza, plantas y una soga con ropa colgada.
  ctx.fillStyle = '#e5e7eb'; rect(ctx, v, b.x1, b.top, w, b.top + 0.12); rect(ctx, v, b.x1, b.top + 0.75, w, b.top + 0.85);
  for (let x = b.x1 + 0.1; x < b.x2; x += 0.5) rect(ctx, v, x, b.top, 0.06, b.top + 0.8);
  ctx.fillStyle = '#9a3412'; rect(ctx, v, b.x2 - 1, b.top, 0.4, b.top + 0.35);
  ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(X(v, b.x2 - 0.8), Y(v, b.top + 0.55), s * 0.3, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  const c1 = X(v, b.x1 + 0.4), c2 = X(v, b.x2 - 0.4), cy = Y(v, b.top + 1.6);
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c1, cy); ctx.quadraticCurveTo((c1 + c2) / 2, cy + s * 0.2, c2, cy); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const fx = c1 + (c2 - c1) * (0.2 + i * 0.2), sway = (Math.sin(t * 6 + i) * 0.12 + windAt(t) * 0.25) * s;
    ctx.fillStyle = hsl((b.hue + i * 70) % 360, 60, 55);
    ctx.beginPath(); ctx.moveTo(fx - s * 0.2, cy + s * 0.12); ctx.lineTo(fx + s * 0.2, cy + s * 0.12); ctx.lineTo(fx + s * 0.2 + sway, cy + s * 0.6); ctx.lineTo(fx - s * 0.2 + sway, cy + s * 0.6); ctx.fill();
  }
}

// ---------- Locales ----------
// Local con paredes de azulejos o de chapa, vidriera con estantes, persiana metálica a medio bajar, puerta,
// cartel luminoso y un neón de "ABIERTO" que parpadea.
export function drawShop(ctx: CanvasRenderingContext2D, b: Block, v: View) {
  const s = v.s, w = b.x2 - b.x1, t = v.t, metal = hash(b.id * 5) < 0.4;
  ctx.fillStyle = metal ? hsl(b.hue, 15, 42) : hsl(b.hue, 35, 48); rect(ctx, v, b.x1, -3, w, b.top);
  texture(ctx, v, metal ? 'siding' : 'tiles', b.x1, -3, b.x2, b.top, 0.9);
  // Vidriera con estantes y cosas, y la puerta.
  const gx1 = b.x1 + 0.35, gx2 = b.x2 - 1.3;
  ctx.fillStyle = '#111827'; rect(ctx, v, gx1 - 0.1, -1, gx2 - gx1 + 0.2, 2.15);
  const inside = ctx.createLinearGradient(0, Y(v, 2), 0, Y(v, -1));
  inside.addColorStop(0, '#fef3c7'); inside.addColorStop(1, '#a16207');
  ctx.fillStyle = inside; rect(ctx, v, gx1, -1, gx2 - gx1, 2.05);
  for (const sy of [0.45, 1.15]) {
    ctx.fillStyle = '#78350f'; rect(ctx, v, gx1, sy - 0.05, gx2 - gx1, sy);
    for (let x = gx1 + 0.1; x < gx2 - 0.2; x += 0.28) { ctx.fillStyle = hsl(Math.floor(hash(x * 7 + sy) * 360), 60, 50); rect(ctx, v, x, sy, 0.2, sy + 0.25 + hash(x + sy) * 0.25); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(X(v, gx1 + 0.4), Y(v, 2.05)); ctx.lineTo(X(v, gx1 + 1), Y(v, 2.05)); ctx.lineTo(X(v, gx1 + 0.2), Y(v, -0.2)); ctx.lineTo(X(v, gx1), Y(v, -0.2)); ctx.fill();
  // La persiana metálica, a medio bajar.
  const down = 0.7 + hash(b.id) * 0.5;
  ctx.fillStyle = '#9ca3af'; rect(ctx, v, gx1 - 0.1, 2.05 - down, gx2 - gx1 + 0.2, 2.05);
  texture(ctx, v, 'siding', gx1 - 0.1, 2.05 - down, gx2 + 0.1, 2.05, 0.9);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 2.05 - down; y < 2.05; y += 0.12) rect(ctx, v, gx1 - 0.1, y, gx2 - gx1 + 0.2, y + 0.025);
  ctx.fillStyle = '#4b5563'; rect(ctx, v, gx1 - 0.1, 2.05 - down - 0.06, gx2 - gx1 + 0.2, 2.05 - down);
  ctx.fillStyle = '#111827'; rect(ctx, v, b.x2 - 1.15, -1, 0.85, 2.05);
  ctx.fillStyle = 'rgba(147,197,253,0.4)'; rect(ctx, v, b.x2 - 1.05, -1, 0.65, 1.95);
  // El neón de ABIERTO.
  const on = Math.floor(t * 2.5 + b.id) % 6 !== 0;
  ctx.font = `900 ${Math.max(6, Math.round(s * 0.2))}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#fb7185' : '#7f1d1d'; ctx.shadowColor = '#fb7185'; ctx.shadowBlur = on ? 8 : 0;
  ctx.fillText('ABIERTO', X(v, b.x2 - 0.72), Y(v, 1.6)); ctx.shadowBlur = 0;
  // El cartel luminoso.
  ctx.fillStyle = '#1f2937'; rect(ctx, v, b.x1 + 0.12, 2.3, w - 0.24, 3.2);
  const sign = ctx.createLinearGradient(0, Y(v, 3.15), 0, Y(v, 2.35));
  sign.addColorStop(0, hsl(b.hue, 75, 42)); sign.addColorStop(1, hsl(b.hue, 75, 28));
  ctx.fillStyle = sign; rect(ctx, v, b.x1 + 0.2, 2.35, w - 0.4, 3.15);
  ctx.fillStyle = '#fef3c7'; ctx.font = `900 ${Math.max(7, Math.round(s * 0.55))}px Nunito, system-ui`;
  ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10; ctx.fillText(b.label, X(v, (b.x1 + b.x2) / 2), Y(v, 2.75), (w - 0.6) * s); ctx.shadowBlur = 0;
  weather(ctx, v, b.x1, b.x2, b.top, b.id * 23);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rect(ctx, v, b.x1, b.top - 0.15, w, b.top);
}

// Por dentro (cuando estás adentro): cada piso es un departamento con muebles; abajo está inundado.
export function drawInterior(ctx: CanvasRenderingContext2D, g: SharkGame, b: Block, v: View) {
  const s = v.s, w = b.x2 - b.x1, t = v.t, sx = b.x1 + w / 2, doors = doorsOf(g, b);
  ctx.fillStyle = '#0b0f19'; rect(ctx, v, b.x1, -3, w, b.top - 0.3);
  for (let k = 0; k < b.floors; k++) {
    const y1 = yk(b, k), y2 = k + 1 < b.floors ? yk(b, k + 1) - 0.18 : b.top - 0.32, seed = b.id * 100 + k;
    const hue = Math.floor(hash(seed) * 360);
    ctx.fillStyle = hsl(hue, 25, 70); rect(ctx, v, b.x1 + 0.2, y1, w - 0.4, y2);
    ctx.fillStyle = hsl(hue, 25, 64); for (let x = b.x1 + 0.4; x < b.x2 - 0.3; x += 0.55) rect(ctx, v, x, y1, 0.22, y2); // empapelado
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rect(ctx, v, b.x1 + 0.2, y2 - 0.25, w - 0.4, y2); // sombra del techo
    ctx.fillStyle = '#8b5a2b'; rect(ctx, v, b.x1 + 0.2, y1 - 0.12, w - 0.4, y1 + 0.05); // piso de madera
    ctx.fillStyle = '#e7e5e4'; rect(ctx, v, b.x1 + 0.2, y1 + 0.05, w - 0.4, y1 + 0.13); // zócalo
    if (k === 0) { ctx.fillStyle = 'rgba(30,88,102,0.85)'; rect(ctx, v, b.x1 + 0.2, y1, w - 0.4, waveY(sx, t)); continue; } // inundado
    // Una lámpara de techo que se balancea.
    const lx = X(v, b.x1 + w * 0.3), ly = Y(v, y2 - 0.25), sway = Math.sin(t * 2 + k) * s * 0.06;
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + sway, ly + s * 0.45); ctx.stroke();
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(lx + sway, ly + s * 0.55, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(253,230,138,0.12)'; ctx.beginPath(); ctx.arc(lx + sway, ly + s * 0.6, s * 1.4, 0, Math.PI * 2); ctx.fill();
    // Muebles a los dos lados de la escalera.
    const spots = [b.x1 + 0.6 + (doors.some(d => d.side < 0 && Math.abs(d.y - y1) < 0.05) ? 1.2 : 0), sx + 0.9];
    spots.forEach((x0, j) => furniture(ctx, v, Math.floor(hash(seed * 7 + j) * 7), x0, y1, Math.min(2.2, (j ? b.x2 - 0.4 - (doors.some(d => d.side > 0 && Math.abs(d.y - y1) < 0.05) ? 1.2 : 0) : sx - 0.8) - x0), hue));
    // Un cuadro en la pared.
    ctx.fillStyle = '#3f2a14'; rect(ctx, v, sx - 2, y1 + 1.4, 0.8, y1 + 2);
    ctx.fillStyle = hsl((hue + 150) % 360, 50, 55); rect(ctx, v, sx - 1.93, y1 + 1.47, 0.66, y1 + 1.93);
    // Las puertas, vistas de adentro.
    for (const d of doors) if (Math.abs(d.y - y1) < 0.05) { const dx = d.side < 0 ? b.x1 + 0.2 : b.x2 - 1.1; ctx.fillStyle = '#5b3a1e'; rect(ctx, v, dx, y1, 0.9, y1 + 1.98); ctx.fillStyle = 'rgba(186,230,253,0.5)'; rect(ctx, v, dx + 0.15, y1 + 1.15, 0.6, y1 + 1.8); }
  }
  // La escalera que une los pisos (y la escotilla a la terraza).
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.beginPath(); ctx.moveTo(X(v, sx - 0.32), Y(v, yk(b, 1))); ctx.lineTo(X(v, sx - 0.32), Y(v, b.top)); ctx.moveTo(X(v, sx + 0.32), Y(v, yk(b, 1))); ctx.lineTo(X(v, sx + 0.32), Y(v, b.top));
  for (let y = yk(b, 1) + 0.3; y < b.top; y += 0.4) { ctx.moveTo(X(v, sx - 0.32), Y(v, y)); ctx.lineTo(X(v, sx + 0.32), Y(v, y)); }
  ctx.stroke();
  ctx.fillStyle = '#334155'; rect(ctx, v, sx - 0.5, b.top - 0.3, 1, b.top);
  // Las paredes de afuera, en corte.
  ctx.fillStyle = '#1f2937'; rect(ctx, v, b.x1, -3, 0.2, b.top); rect(ctx, v, b.x2 - 0.2, -3, 0.2, b.top);
}

function furniture(ctx: CanvasRenderingContext2D, v: View, kind: number, x: number, y: number, room: number, hue: number) {
  const s = v.s;
  if (room < 0.8) return;
  const c = hsl((hue + 180) % 360, 40, 40);
  switch (kind) {
    case 0: { // sillón
      const w = Math.min(1.8, room);
      ctx.fillStyle = c; rect(ctx, v, x, y, w, y + 0.45); rect(ctx, v, x, y + 0.45, w, y + 0.95); rect(ctx, v, x - 0.1, y, 0.25, y + 0.7); rect(ctx, v, x + w - 0.15, y, 0.25, y + 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; rect(ctx, v, x + 0.2, y + 0.45, w * 0.35, y + 0.55); rect(ctx, v, x + w * 0.55, y + 0.45, w * 0.35, y + 0.55);
      break;
    }
    case 1: { // biblioteca
      ctx.fillStyle = '#5b3a1e'; rect(ctx, v, x, y, 0.9, y + 2);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { ctx.fillStyle = hsl((i * 53 + r * 20) % 360, 45, 45); rect(ctx, v, x + 0.08 + i * 0.13, y + 0.1 + r * 0.48, 0.1, y + 0.4 + r * 0.48); }
      break;
    }
    case 2: { // mesa con lámpara
      ctx.fillStyle = '#7c4a1e'; rect(ctx, v, x, y + 0.7, 1.1, y + 0.8); rect(ctx, v, x + 0.05, y, 0.08, y + 0.7); rect(ctx, v, x + 0.97, y, 0.08, y + 0.7);
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(X(v, x + 0.35), Y(v, y + 1.35)); ctx.lineTo(X(v, x + 0.75), Y(v, y + 1.35)); ctx.lineTo(X(v, x + 0.85), Y(v, y + 1.05)); ctx.lineTo(X(v, x + 0.25), Y(v, y + 1.05)); ctx.fill();
      ctx.fillStyle = '#334155'; rect(ctx, v, x + 0.52, y + 0.8, 0.06, y + 1.05);
      break;
    }
    case 3: { // cama
      const w = Math.min(2, room);
      ctx.fillStyle = '#5b3a1e'; rect(ctx, v, x, y, 0.12, y + 1); rect(ctx, v, x, y + 0.15, w, y + 0.45);
      ctx.fillStyle = '#f1f5f9'; rect(ctx, v, x + 0.12, y + 0.45, w - 0.12, y + 0.6);
      ctx.fillStyle = c; rect(ctx, v, x + 0.6, y + 0.45, w - 0.6, y + 0.66);
      ctx.fillStyle = '#e2e8f0'; rect(ctx, v, x + 0.15, y + 0.6, 0.4, y + 0.78);
      break;
    }
    case 4: { // tele
      ctx.fillStyle = '#3f2a14'; rect(ctx, v, x, y, 1.2, y + 0.55);
      ctx.fillStyle = '#0f172a'; rect(ctx, v, x + 0.1, y + 0.6, 1, y + 1.25);
      ctx.fillStyle = Math.floor(v.t * 3) % 2 ? '#38bdf8' : '#818cf8'; rect(ctx, v, x + 0.15, y + 0.65, 0.9, y + 1.2);
      break;
    }
    case 5: { // cocina: mesada y heladera
      ctx.fillStyle = '#e5e7eb'; rect(ctx, v, x, y, 0.75, y + 1.7); ctx.fillStyle = '#9ca3af'; rect(ctx, v, x + 0.6, y + 0.9, 0.05, y + 1.3);
      if (room > 1.6) { ctx.fillStyle = '#a16207'; rect(ctx, v, x + 0.8, y, 0.9, y + 0.85); ctx.fillStyle = '#d6d3d1'; rect(ctx, v, x + 0.78, y + 0.85, 0.94, y + 0.93); }
      break;
    }
    default: { // planta
      ctx.fillStyle = '#9a3412'; rect(ctx, v, x + 0.1, y, 0.35, y + 0.4);
      ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.ellipse(X(v, x + 0.27), Y(v, y + 0.75), s * 0.35, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- Árboles ----------
// La copa de un árbol, con hojas de varios verdes, que se mueve con el viento.
function drawCrown(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, size: number, t: number, seed: number) {
  const s = v.s, sway = (Math.sin(t * 2.2 + seed) * 0.08 + windAt(t) * 0.22) * size;
  for (const [dx, dy, r, l] of [[-0.6, -0.1, 0.7, 20], [0.6, -0.05, 0.7, 22], [0, 0.25, 0.85, 27], [-0.3, 0.6, 0.55, 32], [0.35, 0.55, 0.5, 30]]) {
    ctx.fillStyle = hsl(118 + (seed % 3) * 8, 42, l);
    ctx.beginPath(); ctx.ellipse(X(v, x + (dx + sway * (1 + dy)) * size), Y(v, y + dy * size), r * size * s, r * size * s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  }
}
export function drawTreeDecor(ctx: CanvasRenderingContext2D, d: Decor, v: View) {
  if (!visible(v, d.x - 2, d.x + 2, -1, 5)) return;
  const s = v.s, t = v.t, h = 2.6 + hash(d.x) * 1.2;
  if (d.kind === 'palm') {
    const lean = windAt(t) * 0.3 + Math.sin(t * 1.8 + d.x) * 0.08;
    ctx.strokeStyle = '#8b6b43'; ctx.lineWidth = Math.max(2.5, s * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(v, d.x), Y(v, -1)); ctx.quadraticCurveTo(X(v, d.x + 0.2), Y(v, h * 0.6), X(v, d.x + lean), Y(v, h + 0.8)); ctx.stroke();
    ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = Math.max(2, s * 0.12);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5 + lean * 0.6, tx = X(v, d.x + lean), ty = Y(v, h + 0.8);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.9, ty + Math.sin(a) * s * 0.9 - s * 0.2, tx + Math.cos(a) * s * 1.5, ty + Math.sin(a) * s * 1.2 + s * 0.6); ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = '#4a3020'; ctx.fillRect(X(v, d.x) - s * 0.14, Y(v, h), s * 0.28, Y(v, -1) - Y(v, h));
  drawCrown(ctx, v, d.x, h + 0.5, 0.9 + hash(d.x + 1) * 0.4, t, Math.floor(d.x));
}

// ---------- El farol (arriba del poste se puede parar) ----------
export function drawLamp(ctx: CanvasRenderingContext2D, p: Plat, v: View) {
  const s = v.s, x = X(v, p.x), y = Y(v, p.y), w = p.w * s, t = v.t;
  ctx.fillStyle = '#27272a'; ctx.beginPath(); ctx.roundRect(x, y, w, s * 0.28, s * 0.08); ctx.fill();
  const on = Math.floor(t * 4 + p.id) % 13 !== 0; // titila: se corta la luz
  ctx.fillStyle = on ? '#fef3c7' : '#57534e'; ctx.fillRect(x + w * 0.15, y + s * 0.28, w * 0.7, s * 0.1);
  if (on) {
    const glow = ctx.createLinearGradient(0, y + s * 0.38, 0, y + s * 3.2);
    glow.addColorStop(0, 'rgba(254,243,199,0.28)'); glow.addColorStop(1, 'rgba(254,243,199,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + s * 0.38); ctx.lineTo(x + w * 0.85, y + s * 0.38); ctx.lineTo(x + w * 1.6, y + s * 3.2); ctx.lineTo(x - w * 0.6, y + s * 3.2); ctx.fill();
  }
}

// ---------- Autos, camionetas y colectivos ----------
export function drawVehicle(ctx: CanvasRenderingContext2D, p: Plat, v: View, shift = 0) {
  const s = v.s, x = X(v, p.x) - shift, y = Y(v, p.y), w = p.w * s, t = v.t;
  const base = hsl(p.hue, 62, 44), hi = hsl(p.hue, 60, 60), lo = hsl(p.hue, 58, 26);
  const blink = Math.floor(t * 2.5 + p.id) % 2 === 0; // balizas
  const wheel = (cx: number, cy: number) => {
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.06, 0, Math.PI * 2); ctx.fill();
  };
  const glass = (gx: number, gy: number, gw: number, gh: number) => {
    const gr = ctx.createLinearGradient(0, gy, 0, gy + gh);
    gr.addColorStop(0, '#bfdbfe'); gr.addColorStop(0.5, '#3b5b7d'); gr.addColorStop(1, '#1e293b');
    ctx.fillStyle = gr; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(gx + gw * 0.2, gy); ctx.lineTo(gx + gw * 0.35, gy); ctx.lineTo(gx + gw * 0.15, gy + gh); ctx.lineTo(gx, gy + gh); ctx.fill();
  };
  if (p.kind === 'car') {
    const L = x - s * 0.85, R = x + w + s * 0.85, bottom = y + s * 1.05;
    wheel(L + s * 0.6, bottom); wheel(R - s * 0.6, bottom);
    const body = ctx.createLinearGradient(0, y, 0, bottom);
    body.addColorStop(0, hi); body.addColorStop(0.45, base); body.addColorStop(1, lo);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y); ctx.lineTo(x + w - s * 0.2, y);
    ctx.quadraticCurveTo(x + w + s * 0.15, y + s * 0.05, x + w + s * 0.5, y + s * 0.47); // parabrisas
    ctx.lineTo(R - s * 0.15, y + s * 0.55); ctx.quadraticCurveTo(R, y + s * 0.58, R, y + s * 0.75); // capó
    ctx.lineTo(R, bottom - s * 0.1); ctx.lineTo(L, bottom - s * 0.1); ctx.lineTo(L, y + s * 0.72);
    ctx.quadraticCurveTo(L + s * 0.02, y + s * 0.53, x - s * 0.35, y + s * 0.5); // baúl
    ctx.quadraticCurveTo(x - s * 0.15, y + s * 0.05, x + s * 0.15, y);
    ctx.fill();
    glass(x + s * 0.02, y + s * 0.08, w * 0.45, s * 0.36); glass(x + w * 0.52, y + s * 0.08, w * 0.45, s * 0.36);
    ctx.fillStyle = base; ctx.fillRect(x + w * 0.47, y + s * 0.06, w * 0.05, s * 0.42); // parante
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + s * 0.5); ctx.lineTo(x + w * 0.5, bottom - s * 0.2); ctx.stroke(); // puertas
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + w * 0.3, y + s * 0.6, s * 0.18, s * 0.05); ctx.fillRect(x + w * 0.62, y + s * 0.6, s * 0.18, s * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + s * 0.2, y + s * 0.02, w - s * 0.5, s * 0.03); // brillo del techo
    ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.ellipse(R - s * 0.06, y + s * 0.7, s * 0.07, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.fillRect(L, y + s * 0.7, s * 0.07, s * 0.1);
    if (blink) { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(R - s * 0.08, y + s * 0.83, s * 0.05, 0, Math.PI * 2); ctx.arc(L + s * 0.08, y + s * 0.83, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = lo; ctx.fillRect(x + w + s * 0.25, y + s * 0.35, s * 0.12, s * 0.08); // espejo
    if (hash(p.id) < 0.2) { ctx.fillStyle = '#92400e'; ctx.beginPath(); ctx.ellipse(x + w * 0.5, y - s * 0.17, s * 0.25, s * 0.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + w * 0.5 + s * 0.25, y - s * 0.3, s * 0.13, 0, Math.PI * 2); ctx.fill(); } // un perrito arriba
  } else if (p.kind === 'van') {
    const bottom = y + s * 1.55;
    wheel(x + s * 0.45, bottom); wheel(x + w - s * 0.45, bottom);
    const body = ctx.createLinearGradient(0, y, 0, bottom);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.6, '#e2e8f0'); body.addColorStop(1, '#94a3b8');
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(x, y, w, bottom - y - s * 0.1, [s * 0.15, s * 0.35, s * 0.1, s * 0.1]); ctx.fill();
    glass(x + w * 0.74, y + s * 0.12, w * 0.22, s * 0.42); glass(x + w * 0.06, y + s * 0.12, w * 0.3, s * 0.36); glass(x + w * 0.4, y + s * 0.12, w * 0.3, s * 0.36);
    ctx.fillStyle = base; ctx.fillRect(x, y + s * 0.68, w, s * 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w * 0.38, y + s * 0.1); ctx.lineTo(x + w * 0.38, bottom - s * 0.2); ctx.stroke(); // puerta corrediza
    ctx.fillStyle = '#fef9c3'; ctx.fillRect(x + w - s * 0.08, y + s * 0.95, s * 0.08, s * 0.12);
    if (blink) { ctx.fillStyle = '#fb923c'; ctx.fillRect(x, y + s * 0.95, s * 0.08, s * 0.1); }
  } else {
    const bottom = y + s * 1.85;
    wheel(x + s * 0.6, bottom); wheel(x + w - s * 0.65, bottom);
    const body = ctx.createLinearGradient(0, y, 0, bottom);
    body.addColorStop(0, '#fcd34d'); body.addColorStop(0.5, '#f59e0b'); body.addColorStop(1, '#b45309');
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(x, y, w, bottom - y - s * 0.12, s * 0.2); ctx.fill();
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x + w * 0.3, y - s * 0.12, w * 0.3, s * 0.14); // aire acondicionado
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(x, y + s * 0.95, w, s * 0.14);
    for (let i = 0; i < 6; i++) glass(x + w * (0.04 + i * 0.13), y + s * 0.18, w * 0.11, s * 0.5);
    glass(x + w * 0.83, y + s * 0.12, w * 0.15, s * 0.7); // parabrisas
    ctx.fillStyle = '#111827'; ctx.fillRect(x + w * 0.84, y + s * 0.02, w * 0.13, s * 0.11);
    ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#fde047' : '#f97316'; ctx.font = `900 ${Math.max(6, Math.round(s * 0.1))}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('152', x + w * 0.905, y + s * 0.075);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + w * 0.62, y + s * 0.75, w * 0.12, s * 0.9); // puerta
    if (blink) { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(x + s * 0.1, y + s * 1.3, s * 0.06, 0, Math.PI * 2); ctx.arc(x + w - s * 0.1, y + s * 1.3, s * 0.06, 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- Cosas que flotan (y se hunden) ----------
export function drawDebrisArt(ctx: CanvasRenderingContext2D, d: Debris, v: View) {
  const p = d.plat, s = v.s, t = v.t, depth = Math.max(0, FLOAT_Y - p.y);
  const bob = depth ? 0 : Math.sin(t * 2.2 + p.id) * s * 0.04, tilt = Math.sin(t * 1.7 + p.id) * 0.05 + windAt(t) * 0.05 + (d.sinking ? Math.min(0.35, depth * 0.3) : 0);
  const x = X(v, p.x), y = Y(v, p.y) + bob, w = p.w * s;
  const art = () => {
    ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate(tilt); ctx.translate(-w / 2, 0);
    switch (d.kind) {
      case 'plank': ctx.fillStyle = '#a16207'; ctx.fillRect(0, 0, w, s * 0.2); ctx.fillStyle = '#713f12'; ctx.fillRect(w * 0.2, s * 0.08, w * 0.3, s * 0.03); ctx.fillRect(w * 0.6, s * 0.12, w * 0.25, s * 0.03); break;
      case 'door': ctx.fillStyle = hsl(p.hue, 30, 55); ctx.fillRect(0, 0, w, s * 0.18); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(w * 0.85, s * 0.09, s * 0.05, 0, Math.PI * 2); ctx.fill(); break;
      case 'mattress': ctx.fillStyle = '#e0e7ff'; ctx.beginPath(); ctx.roundRect(0, 0, w, s * 0.3, s * 0.1); ctx.fill(); ctx.fillStyle = '#6366f1'; for (let i = 1; i < 6; i++) ctx.fillRect((w * i) / 6, 0, s * 0.04, s * 0.3); break;
      case 'pallet': ctx.fillStyle = '#ca8a04'; for (let i = 0; i < 5; i++) ctx.fillRect((w * i) / 5, 0, w / 7, s * 0.12); ctx.fillRect(0, s * 0.12, w, s * 0.1); break;
      case 'fridge': ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(0, 0, w, s * 0.9, s * 0.1); ctx.fill(); ctx.fillStyle = '#94a3b8'; ctx.fillRect(w * 0.75, s * 0.15, s * 0.06, s * 0.3); ctx.fillRect(0, s * 0.5, w, s * 0.03); break;
      case 'barrel': {
        const c = p.hue % 2 ? '#1d4ed8' : '#b91c1c';
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(0, 0, w, s * 0.95, s * 0.12); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, s * 0.25, w, s * 0.06); ctx.fillRect(0, s * 0.62, w, s * 0.06);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(w * 0.15, s * 0.05, w * 0.12, s * 0.85);
        break;
      }
      case 'log': {
        ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.roundRect(0, 0, w, s * 0.42, s * 0.2); ctx.fill();
        ctx.strokeStyle = '#4a2f17'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo((w * i) / 5, s * 0.05); ctx.lineTo((w * i) / 5 + s * 0.15, s * 0.38); ctx.stroke(); }
        ctx.fillStyle = '#d6a76b'; ctx.beginPath(); ctx.ellipse(w - s * 0.06, s * 0.21, s * 0.1, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8b5a2b'; ctx.beginPath(); ctx.ellipse(w - s * 0.06, s * 0.21, s * 0.05, s * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#4d7c0f'; ctx.beginPath(); ctx.ellipse(w * 0.3, -s * 0.05, s * 0.18, s * 0.08, -0.4, 0, Math.PI * 2); ctx.fill(); // una ramita
        break;
      }
      case 'sofa': {
        const c = hsl(p.hue, 45, 42);
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(0, -s * 0.35, w, s * 0.75, s * 0.12); ctx.fill();
        ctx.fillStyle = hsl(p.hue, 45, 52); ctx.beginPath(); ctx.roundRect(s * 0.15, -s * 0.1, w / 2 - s * 0.18, s * 0.22, s * 0.08); ctx.roundRect(w / 2 + s * 0.03, -s * 0.1, w / 2 - s * 0.18, s * 0.22, s * 0.08); ctx.fill();
        ctx.fillStyle = hsl(p.hue, 45, 34); ctx.beginPath(); ctx.roundRect(-s * 0.05, -s * 0.2, s * 0.22, s * 0.5, s * 0.08); ctx.roundRect(w - s * 0.17, -s * 0.2, s * 0.22, s * 0.5, s * 0.08); ctx.fill();
        break;
      }
      case 'crate': {
        ctx.fillStyle = '#b7791f'; ctx.fillRect(0, -s * 0.3, w, s * 0.75);
        ctx.strokeStyle = '#7c4a12'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeRect(0, -s * 0.3, w, s * 0.75);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(w, s * 0.45); ctx.moveTo(w, -s * 0.3); ctx.lineTo(0, s * 0.45); ctx.stroke();
        break;
      }
      case 'car': {
        // Un auto que arrastra el agua, medio hundido y de costado.
        ctx.save(); ctx.translate(w / 2, s * 0.1); ctx.rotate(0.12 * Math.sin(t * 0.8 + p.id)); ctx.translate(-w / 2, -s * 0.1);
        drawVehicle(ctx, { ...p, kind: 'car', x: 0, y: 0, w: p.w * 0.62 }, { ...v, cx: 0, cy: -v.h / v.s, t }, -p.w * 0.19 * s);
        ctx.restore();
        break;
      }
      case 'boat': {
        ctx.fillStyle = hsl(p.hue, 55, 45); ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.05); ctx.lineTo(w + s * 0.2, -s * 0.15); ctx.quadraticCurveTo(w - s * 0.1, s * 0.45, w * 0.7, s * 0.45); ctx.lineTo(s * 0.2, s * 0.45); ctx.quadraticCurveTo(0, s * 0.3, -s * 0.15, -s * 0.05); ctx.fill();
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, -s * 0.02, w, s * 0.07);
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.beginPath(); ctx.moveTo(w * 0.3, -s * 0.05); ctx.lineTo(w * 0.75, s * 0.55); ctx.stroke(); // remo
        break;
      }
    }
    ctx.restore();
  };
  if (!depth) { art(); return; }
  // Hundiéndose: arriba del agua se ve igual, abajo se va apagando; salen burbujas.
  ctx.save(); surfaceClip(ctx, v, x - w, x + w * 2, true); art(); ctx.restore();
  ctx.save(); surfaceClip(ctx, v, x - w, x + w * 2, false); ctx.globalAlpha = Math.max(0, 0.6 - depth * 0.35); art(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const q = (t * 1.5 + i * 0.2) % 1; ctx.beginPath(); ctx.arc(x + w * (0.2 + hash(i + p.id) * 0.6), Y(v, p.y + q * (depth + 0.1)), s * 0.05, 0, Math.PI * 2); ctx.stroke(); }
}

// ---------- Salpicaduras y sangre ----------
// Las gotas y la espuma van arriba del agua; la mancha de sangre, adentro del agua.
export function drawFx(ctx: CanvasRenderingContext2D, g: SharkGame, v: View, layer: 'water' | 'air') {
  const s = v.s;
  for (const f of g.fx) {
    const a = v.t - f.at;
    if (a < 0 || !visible(v, f.x - 6, f.x + 6, -3, 6)) continue;
    const cx = X(v, f.x), sy = Y(v, 0);
    if (f.kind === 'splash') {
      if (layer === 'water') continue;
      // Anillo de espuma y ondas que se abren.
      if (a < 1.4) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - a / 1.4)})`; ctx.beginPath(); ctx.ellipse(cx, sy, s * f.size * (0.5 + a * 1.4), s * 0.12 * (1 - a / 2), 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(226,232,240,0.5)'; ctx.lineWidth = Math.max(1, s * 0.03);
      for (let r = 0; r < 3; r++) { const q = a - 0.2 - r * 0.3; if (q < 0 || q > 2) continue; ctx.globalAlpha = 1 - q / 2; ctx.beginPath(); ctx.ellipse(cx, sy, s * f.size * (0.8 + q * 2), s * 0.1 * (1 + q), 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // Dos paredes de agua que suben y caen.
      if (a < 0.7) {
        const hgt = s * f.size * 1.1 * Math.sin((a / 0.7) * Math.PI), wid = s * f.size * 0.55;
        ctx.fillStyle = `rgba(226,240,248,${0.65 * (1 - a / 0.7)})`;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * wid * 0.2, sy); ctx.quadraticCurveTo(cx + side * wid * 0.5, sy - hgt * 1.1, cx + side * wid * (1.1 + a), sy - hgt * 0.4); ctx.lineTo(cx + side * wid * (0.9 + a), sy); ctx.fill(); }
      }
      // Gotas que vuelan y caen.
      if (a < 1.3) {
        ctx.fillStyle = 'rgba(240,249,255,0.9)';
        for (let i = 0; i < 34; i++) {
          const ang = Math.PI * (0.12 + hash(i + f.x * 3) * 0.76), sp = (3 + hash(i * 7 + f.x) * 5) * Math.sqrt(f.size);
          const dx = Math.cos(ang) * sp * a, dy = Math.sin(ang) * sp * a - 9.8 * a * a;
          if (dy < -0.2) continue;
          ctx.beginPath(); ctx.arc(cx + dx * s, sy - dy * s, s * (0.04 + hash(i) * 0.06) * (1 - a / 1.6), 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (layer === 'water') {
      // Una nube roja enorme que se abre en el agua, con el centro casi negro, y una mancha en la superficie.
      if (a > 10) continue;
      const fade = 1 - a / 10;
      ctx.save(); surfaceClip(ctx, v, cx - s * 9, cx + s * 9, false);
      for (let i = 0; i < 12; i++) {
        const ox = (hash(i + f.x) - 0.5) * f.size * 2.2, oy = -0.15 - hash(i * 3 + f.x) * f.size * 1.2;
        const r = s * f.size * (0.6 + Math.min(2, a * 0.8)) * (0.5 + hash(i * 5) * 0.7);
        const px = cx + ox * s + Math.sin(a * 0.7 + i) * s * 0.3, py = sy - oy * s + a * s * 0.05;
        const gr = ctx.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(90,0,8,${0.95 * fade})`); gr.addColorStop(0.45, `rgba(150,6,18,${0.7 * fade})`); gr.addColorStop(1, 'rgba(150,6,18,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = `rgba(170,12,24,${0.85 * fade})`; ctx.beginPath(); ctx.ellipse(cx, sy, s * f.size * (0.8 + Math.min(2.5, a)), s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(220,80,90,${0.6 * Math.max(0, 1 - a / 3)})`; // espuma rosada
      for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(cx + (hash(i * 7 + f.x) - 0.5) * s * f.size * 2.2, sy - s * 0.03, s * (0.05 + hash(i) * 0.07), 0, Math.PI * 2); ctx.fill(); }
    } else if (a < 1.8) {
      // Chorros de sangre: tres borbotones seguidos que saltan para todos lados y caen, y gotas que chorrean.
      const by = Y(v, f.y);
      for (const [delay, n] of [[0, 46], [0.22, 34], [0.5, 26]] as const) {
        const q = a - delay;
        if (q < 0 || q > 1.2) continue;
        ctx.fillStyle = `rgba(180,10,25,${1 - q / 1.2})`;
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI * (0.05 + hash(i + delay * 9 + f.x * 5) * 0.9), sp = (2 + hash(i * 3 + delay) * 6) * Math.sqrt(f.size / 2);
          const dx = Math.cos(ang) * sp * q, dy = -Math.sin(ang) * sp * q - 9.8 * q * q * 0.6;
          const r = s * (0.05 + hash(i * 11 + delay) * 0.09) * Math.sqrt(f.size / 2);
          ctx.beginPath(); ctx.ellipse(cx + dx * s, by - dy * s, r, r * 1.6, Math.atan2(-dy, dx), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = `rgba(150,6,18,${0.9 * (1 - a / 1.8)})`;
      for (let i = 0; i < 8; i++) { const q = (a * 1.5 + hash(i + f.x)) % 1; ctx.beginPath(); ctx.ellipse(cx + (hash(i * 13) - 0.5) * s * 0.6, by + q * (Y(v, 0) - by), s * 0.04, s * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
      if (a < 0.5) { const mist = ctx.createRadialGradient(cx, by, 0, cx, by, s * f.size * 0.8); mist.addColorStop(0, `rgba(200,20,30,${0.55 * (1 - a / 0.5)})`); mist.addColorStop(1, 'rgba(200,20,30,0)'); ctx.fillStyle = mist; ctx.beginPath(); ctx.arc(cx, by, s * f.size * 0.8, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}
