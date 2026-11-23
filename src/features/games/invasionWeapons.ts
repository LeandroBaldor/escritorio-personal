// Las armas de Invasión en primera persona (imágenes que pasó el usuario, recortadas):
// - en la mano, abajo a la derecha (y otra imagen mientras se recarga);
// - la mira: el rifle (vidrio redondo, con zoom como siempre) y la ametralladora (vidrio rectangular, zoom fijo);
//   la bazooka no tiene mira. El zoom se ve solo adentro del vidrio.
// - el "+" para apuntar, en todas las armas.
import rifleHand from './assets/invasion/armas/rifle-mano.webp';
import rifleReload from './assets/invasion/armas/rifle-carga.webp';
import rifleScope from './assets/invasion/armas/mira-rifle.webp';
import machineHand from './assets/invasion/armas/ametralladora-mano.webp';
import machineReload from './assets/invasion/armas/ametralladora-carga.webp';
import machineScope from './assets/invasion/armas/mira-ametralladora.webp';
import bazookaHand from './assets/invasion/armas/bazooka-mano.webp';
import rifleFx from './assets/invasion/efectos/rifle.webp';
import machineFx from './assets/invasion/efectos/ametralladora.webp';
import type { Weapon } from './invasion';

const images = new Map<string, HTMLImageElement>();
function img(url: string) {
  let im = images.get(url);
  if (!im && typeof Image !== 'undefined') { im = new Image(); im.decoding = 'async'; im.src = url; images.set(url, im); }
  return im && im.complete && im.naturalWidth ? im : null;
}
export function preloadWeapons() { for (const u of [rifleHand, rifleReload, rifleScope, machineHand, machineReload, machineScope, bazookaHand, rifleFx, machineFx]) img(u); }

// Animación del disparo (secuencias que pasó el usuario, sin los números): 10 cuadros de 200 px en fila, del
// destello al humo. `shotFx` la arranca en cada tiro (lo llama el juego al disparar, así no se pierde ninguna).
// Rifle: los 10 cuadros seguidos. Ametralladora: los 3 primeros (el destello) rápido en cada bala; si viene otra
// bala, la anterior se corta ahí y sigue la nueva, y la última de la ráfaga pasa también del 4 al 10 (el humo).
// Así una ráfaga se ve como destellos seguidos y al soltar queda el humo. `flash`/`rest`: segundos por cuadro del
// destello (1 a 3) y del resto (4 a 10). `scale`: ancho del cuadro respecto del tamaño del fogonazo.
const SHOT_FX: Partial<Record<Weapon, { url: string; flash: number; rest: number; scale: number }>> = {
  rifle: { url: rifleFx, flash: 0.036, rest: 0.036, scale: 4.4 },   // 0,36 s en total
  machine: { url: machineFx, flash: 0.032, rest: 0.045, scale: 5.6 }, // (la ráfaga, grande) // destello 0,1 s; humo 0,32 s más
};
interface ShotAnim { t0: number; weapon: Weapon; cut: boolean }
const shotAnims: ShotAnim[] = [];
export function shotFx(weapon: Weapon, t: number) {
  if (!SHOT_FX[weapon]) return;
  if (weapon === 'machine') for (const a of shotAnims) if (a.weapon === 'machine') a.cut = true;
  shotAnims.push({ t0: t, weapon, cut: false });
  if (shotAnims.length > 10) shotAnims.shift();
}
function shotFrame(a: ShotAnim, t: number) {
  const fx = SHOT_FX[a.weapon]!, e = t - a.t0;
  if (e < 0) return -1;
  const f = e < 3 * fx.flash ? Math.floor(e / fx.flash) : 3 + Math.floor((e - 3 * fx.flash) / fx.rest);
  return a.cut && f > 2 ? 10 : f;
}
function drawShotAnims(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, size: number) {
  for (let i = shotAnims.length - 1; i >= 0; i--) {
    const a = shotAnims[i], frame = shotFrame(a, t);
    if (frame >= 10 || t < a.t0 - 1) { shotAnims.splice(i, 1); continue; }
    const fx = SHOT_FX[a.weapon]!, im = img(fx.url); if (!im || frame < 0) continue;
    const s = size * fx.scale;
    ctx.drawImage(im, frame * 200, 0, 200, 200, x - s / 2, y - s / 2, s, s);
  }
}

// Cómo va cada arma en la mano: alto (en fracción del alto de la pantalla) y cuánto se mete en el borde derecho.
// `front` (opcional, la bazooka): el arma se ve de atrás, centrada, apuntando al frente. `cx` es el centro del tubo y
// `sight` la punta de la mira de adelante (px de la imagen); se ubica para que la mira quede justo debajo del "+"
// (a `gap`, fracción del alto, del centro). La parte de abajo de la foto queda fuera de la pantalla.
interface Front { cx: number; sight: number; gap: number }
// `muzzle`: la boca del arma en la imagen de la mano (px de la imagen), para el fogonazo. `reload` null: no tiene imagen
// de carga (la bazooka: al recargar solo baja un poco y vuelve).
const HELD: Record<Weapon, { hand: string; reload: string | null; tall: number; reloadTall: number; out: number; reloadX: number; front?: Front; muzzle: [number, number]; flash: number }> = {
  rifle: { hand: rifleHand, reload: rifleReload, tall: 0.6, reloadTall: 0.86, out: 0.06, reloadX: 0.6, muzzle: [392, 214], flash: 0.1 },
  machine: { hand: machineHand, reload: machineReload, tall: 0.56, reloadTall: 0.8, out: 0.04, reloadX: 0.66, muzzle: [58, 175], flash: 0.08 },
  bazooka: { hand: bazookaHand, reload: null, tall: 0.74, reloadTall: 0.74, out: 0, reloadX: 0.5, front: { cx: 476, sight: 4, gap: 0.035 }, muzzle: [476, 91], flash: 0.15 },
};

// El arma en la mano. `reload` va de 0 a 1 mientras se recarga (null si no); `kick` es el retroceso.
// Devuelve dónde está la boca del arma en la pantalla (de ahí sale el cohete de la bazooka), o null si no se dibujó.
export function drawHeldWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, w: number, h: number, mx: number, my: number, t: number, kick: number, reload: number | null, flash = 0): { x: number; y: number } | null {
  const d = HELD[weapon];
  // Sin imagen de carga (la bazooka): al recargar se ve la misma arma, que baja un poco y vuelve.
  const dip = reload !== null && !d.reload ? Math.sin(Math.min(1, reload) * Math.PI) * h * 0.22 : 0;
  if (reload !== null && !d.reload) reload = null;
  const im = img(reload === null ? d.hand : d.reload ?? d.hand);
  if (!im) { drawSmoke(ctx, 'held', t); return null; }
  // La foto de carga es la escena completa (arma, manos y brazos que salen de los bordes): ocupa por lo menos todo
  // el ancho, apoyada abajo a la derecha, así los brazos siguen fuera de la pantalla.
  const tall = reload === null ? h * d.tall : Math.max(h * d.reloadTall, w * im.naturalHeight / im.naturalWidth), wide = tall * im.naturalWidth / im.naturalHeight;
  // Se mueve un poco con la mira y con la respiración; el retroceso la tira para abajo y a la derecha.
  const swayX = (mx - w / 2) * 0.05, swayY = (my - h / 2) * 0.04 + Math.sin(t * 1.7) * h * 0.004;
  let x: number, y = h - tall + h * 0.03 + swayY + kick * h * 0.035 + dip;
  if (reload === null) x = w - wide * (1 - d.out) + swayX + kick * w * 0.012;
  else {
    // Al recargar: entra desde abajo, se mueve un poco mientras carga y vuelve a bajar.
    x = w - wide + Math.max(0, swayX * 0.3);
    const inOut = Math.min(1, reload / 0.05, (1 - reload) / 0.06); // entra y sale rápido
    y += (1 - Math.max(0, inOut)) * tall * 0.5 + Math.sin(reload * Math.PI * 3) * h * 0.012;
  }
  if (reload === null && d.front) {
    // De atrás, centrada: la mira de adelante apunta al "+".
    const F = d.front, k = tall / im.naturalHeight;
    const x0 = mx - F.cx * k, // sigue al "+" (cerca de los bordes del mapa el "+" se corre del medio)
      y0 = h / 2 + F.gap * h - F.sight * k + swayY + dip;
    // Retroceso fuerte: se viene para atrás (hacia uno: se agranda), sube y se ladea un poco, desde abajo al medio.
    const r = kick, grow = 1 + r * 0.2, up = r * h * 0.13, rot = -r * 0.06, ca = Math.cos(rot) * grow, sa = Math.sin(rot) * grow;
    const px = mx, py = h;
    const mx0 = x0 + d.muzzle[0] * k - px, my0 = y0 + d.muzzle[1] * k - py; // la boca, con el mismo movimiento
    const fx = px + mx0 * ca - my0 * sa, fy = py - up + mx0 * sa + my0 * ca;
    // El destello y el humo van detrás: el arma es lo que está más cerca de la cámara.
    if (flash > 0) drawMuzzleFlash(ctx, fx, fy, d.flash * h, flash, -Math.PI / 2 + rot, t, 'held', true); // con mucho humo
    drawSmoke(ctx, 'held', t);
    ctx.save(); ctx.translate(px, py - up); ctx.rotate(rot); ctx.scale(grow, grow); ctx.translate(-px, -py);
    ctx.drawImage(im, x0, y0, im.naturalWidth * k, tall);
    ctx.restore();
    return { x: fx, y: fy };
  }
  const k = tall / im.naturalHeight, fx = x + d.muzzle[0] * k, fy = y + d.muzzle[1] * k;
  // El destello, la animación del disparo y el humo van detrás: el arma es lo que está más cerca de la cámara.
  if (flash > 0 && reload === null) drawMuzzleFlash(ctx, fx, fy, d.flash * h, flash, Math.atan2(h / 2 - fy, w / 2 - fx), t, 'held', false, weapon);
  if (reload === null) drawShotAnims(ctx, t, fx, fy, d.flash * h);
  drawSmoke(ctx, 'held', t);
  ctx.save();
  ctx.translate(x + wide * 0.5, y + tall * 0.5); ctx.rotate(kick * 0.03); ctx.translate(-(x + wide * 0.5), -(y + tall * 0.5));
  ctx.drawImage(im, x, y, wide, tall);
  ctx.restore();
  return { x: fx, y: fy };
}

// El fogonazo del disparo, más real: una llamarada alargada hacia adelante (cono de gases encendidos), dos lenguas
// laterales cortas (como sale por el freno de boca), chispas incandescentes y un brillo que ilumina alrededor.
// Cada disparo tiene su forma (se sortea al disparar, no titila cuadro a cuadro). `f` va de 1 (recién disparado) a 0.
// Al disparar suelta humo (`slot` dice en qué lista de humo va: el arma en la mano o el vidrio de la mira).
interface Puff { x: number; y: number; vx: number; vy: number; t0: number; life: number; r: number; grow: number; a: number }
const smoke: Record<string, Puff[]> = { held: [], scope: [] };
const lastFlash: Record<string, number> = { held: 0, scope: 0 };
const flashSeed: Record<string, number> = { held: 1, scope: 1 };
let seq = 1;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// `heavy` (la bazooka): mucho más humo, más grande, más denso y que dura más.
// `weapon`: si tiene animación de disparo (rifle, ametralladora), cada tiro la arranca y reemplaza al fuego dibujado.
export function drawMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, f: number, dir: number, t: number, slot = 'held', heavy = false, weapon?: Weapon) {
  const fx = weapon ? SHOT_FX[weapon] : undefined, sprite = fx ? img(fx.url) : null;
  if (f > (lastFlash[slot] ?? 0) + 0.25) { // disparo nuevo: sorteo la forma y suelto el humo
    flashSeed[slot] = seq++;
    const list = smoke[slot] ?? (smoke[slot] = []), n = Math.round((5 + size / 18) * (heavy ? 2.6 : fx ? 0.5 : 1)), big = heavy ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const q = hash(seq * 9 + i), sp = size * (0.6 + q * 1.4), a = dir + (hash(seq * 5 + i * 3) - 0.5) * 0.9;
      list.push({ x: x + Math.cos(dir) * size * 0.3 * (i / n), y: y + Math.sin(dir) * size * 0.3 * (i / n), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - size * 0.25,
        t0: t + 0.04 + i * (heavy ? 0.02 : 0.03), life: (1.6 + q * 1.2) * (heavy ? 1.7 : 1), r: size * (0.22 + q * 0.14) * big, grow: size * (0.8 + q * 0.6) * big, a: Math.min(0.75, (0.42 + q * 0.18) * (heavy ? 1.3 : 1)) });
    }
    if (list.length > 110) list.splice(0, list.length - 110);
  }
  lastFlash[slot] = f;
  const sd = flashSeed[slot] ?? 1, rnd = (i: number) => hash(sd * 31 + i);
  const r = size * (0.75 + f * 0.45), e = Math.pow(f, 0.6); // la llama se achica rápido; el brillo dura un poco más
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // Brillo general (ilumina un poco la pantalla alrededor de la boca).
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  halo.addColorStop(0, `rgba(255,226,160,${0.5 * f})`); halo.addColorStop(0.3, `rgba(255,160,60,${0.22 * f})`); halo.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = halo; ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  if (sprite) { ctx.restore(); return; } // el fuego lo pone la animación del disparo
  ctx.translate(x, y); ctx.rotate(dir + (rnd(1) - 0.5) * 0.12);
  // Una "lengua" de fuego: forma de gota alargada, con borde irregular.
  const tongue = (ang: number, len: number, wid: number, alpha: number) => {
    ctx.save(); ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,255,235,${alpha})`); g.addColorStop(0.25, `rgba(255,222,120,${0.95 * alpha})`);
    g.addColorStop(0.65, `rgba(255,138,40,${0.6 * alpha})`); g.addColorStop(1, 'rgba(200,60,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -wid * 0.35);
    const steps = 6;
    for (let i = 1; i <= steps; i++) { const q = i / steps, wob = 1 + (rnd(i + ang * 10) - 0.5) * 0.5; ctx.lineTo(len * q, -wid * Math.sin(Math.PI * Math.min(1, q * 1.15)) * wob * (1 - q * 0.6)); }
    for (let i = steps; i >= 1; i--) { const q = i / steps, wob = 1 + (rnd(i + 20 + ang * 10) - 0.5) * 0.5; ctx.lineTo(len * q, wid * Math.sin(Math.PI * Math.min(1, q * 1.15)) * wob * (1 - q * 0.6)); }
    ctx.lineTo(0, wid * 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  tongue(0, r * (2.1 + rnd(2) * 0.9) * e, r * 0.42, f);                         // la llamarada principal, hacia adelante
  tongue((rnd(3) - 0.5) * 0.25, r * (1.3 + rnd(4) * 0.5) * e, r * 0.62, 0.8 * f); // el cuerpo, más ancho y corto
  for (const side of [-1, 1]) tongue(side * (1.25 + rnd(5 + side) * 0.35), r * (0.55 + rnd(7 + side) * 0.35) * e, r * 0.22, 0.75 * f); // lenguas laterales
  // Chispas: rayitas incandescentes que salen disparadas hacia adelante.
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (rnd(10 + i) - 0.5) * 1.1, d0 = r * (0.5 + (1 - f) * 1.1) * (0.6 + rnd(30 + i) * 0.6), d1 = d0 + r * 0.22;
    ctx.strokeStyle = `rgba(255,${200 + Math.floor(rnd(50 + i) * 55)},140,${0.9 * f})`; ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * d0, Math.sin(a) * d0); ctx.lineTo(Math.cos(a) * d1, Math.sin(a) * d1); ctx.stroke();
  }
  // Núcleo blanco en la boca.
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.45);
  core.addColorStop(0, `rgba(255,255,255,${f})`); core.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(r * 0.08, 0, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// El humo que queda después del disparo: bocanadas grises que se agrandan, suben y se desvanecen.
export function drawSmoke(ctx: CanvasRenderingContext2D, slot: string, t: number) {
  const list = smoke[slot];
  if (!list?.length) return;
  for (let i = list.length - 1; i >= 0; i--) if (t - list[i].t0 > list[i].life || t < list[i].t0 - 1) list.splice(i, 1);
  ctx.save();
  for (const p of list) {
    const age = t - p.t0; if (age < 0) continue;
    const q = age / p.life, slow = 1 - Math.exp(-age * 2.2); // sale rápido y se frena
    const px = p.x + p.vx * slow / 2.2 + Math.sin(age * 1.7 + p.r) * p.r * 0.4, py = p.y + p.vy * slow / 2.2 - age * p.grow * 0.35;
    const rad = p.r + p.grow * Math.sqrt(q), alpha = p.a * (1 - q) * Math.min(1, age * 8);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(176,172,166,${alpha})`); g.addColorStop(0.55, `rgba(138,134,128,${alpha * 0.6})`); g.addColorStop(1, 'rgba(120,116,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// El "+" para apuntar (sin mira).
export function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, weapon: Weapon, t: number) {
  const L = weapon === 'bazooka' ? 16 : 12, gap = weapon === 'bazooka' ? 16 : 15; // las cuatro líneas bien separadas: sin la mira el tiro va a cualquier lado adentro
  const color = weapon === 'bazooka' ? '#fed18c' : '#ffffff';
  ctx.save(); ctx.lineCap = 'round';
  for (const [lw, c] of [[4.5, 'rgba(0,0,0,0.75)'], [2, color]] as [number, string][]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(x - gap - L, y); ctx.lineTo(x - gap, y); ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + L, y);
    ctx.moveTo(x, y - gap - L); ctx.lineTo(x, y - gap); ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + L);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(239,68,68,${0.85 + Math.sin(t * 3) * 0.1})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// La mira: dónde está el vidrio en la imagen recortada y su forma.
const SCOPES = {
  rifle: { url: rifleScope, cx: 455, cy: 342, r: 252 },                  // vidrio redondo
  machine: { url: machineScope, cx: 433, cy: 316, hw: 218, hh: 157 },    // vidrio rectangular
} as const;
export const hasScope = (weapon: Weapon) => weapon !== 'bazooka';

// El vidrio de la mira centrado en (x, y), de "radio" R. `lens` dibuja la ciudad con zoom adentro (ya recortada).
export function drawScopeView(ctx: CanvasRenderingContext2D, weapon: Weapon, x: number, y: number, R: number, zoom: number, kick: number, lens: (clip: () => void) => void, flash = 0, t = 0) {
  if (weapon === 'bazooka') return;
  const S = SCOPES[weapon], im = img(S.url);
  const k = weapon === 'rifle' ? R / SCOPES.rifle.r : (R * 1.08) / SCOPES.machine.hw;
  const clip = () => {
    ctx.beginPath();
    if (weapon === 'rifle') ctx.arc(x, y, R - 1, 0, Math.PI * 2);
    else ctx.roundRect(x - SCOPES.machine.hw * k, y - SCOPES.machine.hh * k, SCOPES.machine.hw * 2 * k, SCOPES.machine.hh * 2 * k, 18 * k);
    ctx.clip();
  };
  ctx.save(); lens(clip); ctx.restore();
  // Sombra del borde del vidrio, para que se vea hundido.
  ctx.save(); clip();
  if (weapon === 'rifle') {
    const edge = ctx.createRadialGradient(x, y, R * 0.75, x, y, R);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = edge; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 14 * k; ctx.strokeRect(x - SCOPES.machine.hw * k, y - SCOPES.machine.hh * k, SCOPES.machine.hw * 2 * k, SCOPES.machine.hh * 2 * k);
    ctx.fillStyle = 'rgba(40,255,120,0.04)'; ctx.fillRect(x - SCOPES.machine.hw * k, y - SCOPES.machine.hh * k, SCOPES.machine.hw * 2 * k, SCOPES.machine.hh * 2 * k); // un poco de tinte de pantalla
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,220,150,${flash * 0.28})`; ctx.fillRect(x - R * 2, y - R * 2, R * 4, R * 4); drawMuzzleFlash(ctx, x, y + R * 0.95, R * 0.35, flash, -Math.PI / 2, t, 'scope', false, weapon); } // el fogonazo asoma por abajo del vidrio
  drawShotAnims(ctx, t, x, y + R * 0.95, R * 0.35);
  drawSmoke(ctx, 'scope', t); // y después queda humo que sube por el vidrio
  ctx.restore();
  if (im) ctx.drawImage(im, x - S.cx * k, y - S.cy * k, im.naturalWidth * k, im.naturalHeight * k);
  // El aumento, arriba a la derecha del vidrio.
  ctx.save();
  ctx.fillStyle = 'rgba(134,239,172,0.92)'; ctx.font = `800 ${Math.max(11, R * 0.065)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  const tx = weapon === 'rifle' ? x + R * 0.62 : x + SCOPES.machine.hw * k * 0.78, ty = weapon === 'rifle' ? y - R * 0.6 : y - SCOPES.machine.hh * k * 0.7;
  ctx.fillText(`×${(zoom / 10).toFixed(1)}`, tx, ty);
  ctx.restore();
}
