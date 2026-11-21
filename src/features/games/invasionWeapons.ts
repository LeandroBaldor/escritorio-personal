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
import bazookaReload from './assets/invasion/armas/bazooka-carga.webp';
import type { Weapon } from './invasion';

const images = new Map<string, HTMLImageElement>();
function img(url: string) {
  let im = images.get(url);
  if (!im && typeof Image !== 'undefined') { im = new Image(); im.decoding = 'async'; im.src = url; images.set(url, im); }
  return im && im.complete && im.naturalWidth ? im : null;
}
export function preloadWeapons() { for (const u of [rifleHand, rifleReload, rifleScope, machineHand, machineReload, machineScope, bazookaHand, bazookaReload]) img(u); }

// Cómo va cada arma en la mano: alto (en fracción del alto de la pantalla) y cuánto se mete en el borde derecho.
// `aim` (opcional): el caño de la imagen (boca de adelante y de atrás, en px de la imagen); el arma se ubica para
// que esa línea pase justo por el "+" del medio, con la boca a `gap` (fracción del alto) del centro y girada `tilt`.
interface Aim { front: [number, number]; back: [number, number]; tilt: number; gap: number }
const HELD: Record<Weapon, { hand: string; reload: string; tall: number; reloadTall: number; out: number; reloadX: number; aim?: Aim }> = {
  rifle: { hand: rifleHand, reload: rifleReload, tall: 0.6, reloadTall: 0.68, out: 0.06, reloadX: 0.6 },
  machine: { hand: machineHand, reload: machineReload, tall: 0.56, reloadTall: 0.58, out: 0.04, reloadX: 0.66 },
  bazooka: { hand: bazookaHand, reload: bazookaReload, tall: 0.8, reloadTall: 0.56, out: 0.06, reloadX: 0.6, aim: { front: [125, 210], back: [870, 330], tilt: 0.2, gap: 0.11 } },
};

// El arma en la mano. `reload` va de 0 a 1 mientras se recarga (null si no); `kick` es el retroceso.
export function drawHeldWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, w: number, h: number, mx: number, my: number, t: number, kick: number, reload: number | null) {
  const d = HELD[weapon], im = img(reload === null ? d.hand : d.reload);
  if (!im) return;
  const tall = h * (reload === null ? d.tall : d.reloadTall), wide = tall * im.naturalWidth / im.naturalHeight;
  // Se mueve un poco con la mira y con la respiración; el retroceso la tira para abajo y a la derecha.
  const swayX = (mx - w / 2) * 0.05, swayY = (my - h / 2) * 0.04 + Math.sin(t * 1.7) * h * 0.004;
  let x: number, y = h - tall + h * 0.03 + swayY + kick * h * 0.035;
  if (reload === null) x = w - wide * (1 - d.out) + swayX + kick * w * 0.012;
  else {
    // Al recargar: entra desde abajo, se mueve un poco mientras carga y vuelve a bajar.
    x = w * d.reloadX - wide / 2 + swayX * 0.5;
    const inOut = Math.min(1, reload / 0.12, (1 - reload) / 0.12);
    y += (1 - Math.max(0, inOut)) * tall * 0.5 + Math.sin(reload * Math.PI * 3) * h * 0.012;
  }
  if (reload === null && d.aim) {
    // Apuntando al medio: la línea del caño pasa por el centro de la pantalla.
    const A = d.aim, k = tall / im.naturalHeight;
    const ax = A.front[0] - A.back[0], ay = A.front[1] - A.back[1], L = Math.hypot(ax, ay);
    const rot = A.tilt + kick * 0.04, ca = Math.cos(rot), sa = Math.sin(rot);
    const ux = (ax * ca - ay * sa) / L, uy = (ax * sa + ay * ca) / L; // hacia adonde apunta, ya girado
    const mxs = w / 2 - ux * A.gap * h + swayX + kick * w * 0.01, mys = h / 2 - uy * A.gap * h + swayY + kick * h * 0.03;
    ctx.save(); ctx.translate(mxs, mys); ctx.rotate(rot);
    ctx.drawImage(im, -A.front[0] * k, -A.front[1] * k, im.naturalWidth * k, tall);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x + wide * 0.5, y + tall * 0.5); ctx.rotate(kick * 0.03); ctx.translate(-(x + wide * 0.5), -(y + tall * 0.5));
  ctx.drawImage(im, x, y, wide, tall);
  ctx.restore();
}

// El "+" para apuntar (sin mira).
export function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, weapon: Weapon, t: number) {
  const L = weapon === 'bazooka' ? 16 : 12, gap = weapon === 'bazooka' ? 5 : 4;
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
export function drawScopeView(ctx: CanvasRenderingContext2D, weapon: Weapon, x: number, y: number, R: number, zoom: number, kick: number, lens: (clip: () => void) => void) {
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
  if (kick > 0.6) { ctx.fillStyle = `rgba(255,220,150,${(kick - 0.6) * 0.5})`; ctx.fillRect(x - R * 2, y - R * 2, R * 4, R * 4); }
  ctx.restore();
  if (im) ctx.drawImage(im, x - S.cx * k, y - S.cy * k, im.naturalWidth * k, im.naturalHeight * k);
  // El aumento, arriba a la derecha del vidrio.
  ctx.save();
  ctx.fillStyle = 'rgba(134,239,172,0.92)'; ctx.font = `800 ${Math.max(11, R * 0.065)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  const tx = weapon === 'rifle' ? x + R * 0.62 : x + SCOPES.machine.hw * k * 0.78, ty = weapon === 'rifle' ? y - R * 0.6 : y - SCOPES.machine.hh * k * 0.7;
  ctx.fillText(`×${(zoom / 10).toFixed(1)}`, tx, ty);
  ctx.restore();
}
