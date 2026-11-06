// Land of Warriors: el dibujo del mapa, los recursos, las construcciones, los guerreros y los disparos.
import { BUILD_STATS, ROLE_STATS, ROLES, BKINDS, type BKind, type Building, type LandGame, type Role, type Unit, type Node } from './land';
import { CIVS, CIV_IDS, type CivId } from './landCivs';
import spritesUrl from './assets/land/sprites.webp';

// La hoja con los recortes de las láminas: una fila por civilización (seis guerreros y cinco construcciones), celdas de 128.
const CELL = 256; // (el doble de resolución: se ven nítidos aunque estén grandes)
const META: Record<CivId, [number, number][]> = {"humano":[[240,216],[171,240],[224,240],[185,240],[240,116],[240,231],[240,128],[240,183],[240,167],[225,240],[240,174]],"zergano":[[240,159],[240,199],[223,240],[240,217],[240,124],[240,180],[240,130],[240,153],[240,183],[240,222],[240,161]],"elfos":[[226,240],[240,222],[219,240],[240,228],[240,203],[240,89],[240,149],[240,190],[240,188],[233,240],[240,191]],"enanos":[[240,183],[240,200],[240,197],[221,240],[240,152],[240,116],[240,154],[240,167],[240,159],[240,229],[240,131]],"nomuerta":[[208,240],[193,240],[204,240],[240,231],[240,218],[240,85],[240,150],[240,164],[240,161],[240,217],[240,181]],"sauriano":[[240,179],[240,170],[240,221],[240,193],[240,89],[240,86],[240,155],[240,154],[240,151],[240,207],[240,142]],"infernal":[[221,240],[240,231],[240,234],[240,168],[240,181],[240,123],[240,168],[240,175],[240,165],[224,240],[240,207]],"mecanico":[[240,213],[223,240],[237,240],[240,240],[240,104],[240,209],[240,154],[240,162],[240,156],[240,158],[240,128]],"orcos":[[240,229],[240,201],[240,189],[240,204],[240,148],[240,154],[240,134],[240,134],[240,139],[240,204],[240,132]],"abisal":[[240,211],[240,197],[240,129],[183,240],[240,94],[240,104],[240,158],[240,155],[240,172],[230,240],[240,152]]};
let SPRITES: HTMLImageElement | null = null;
export function spritesReady() {
  if (!SPRITES && typeof Image !== 'undefined') { SPRITES = new Image(); SPRITES.src = spritesUrl; }
  return !!SPRITES && SPRITES.complete && SPRITES.naturalWidth > 0;
}
// Dibuja un recorte apoyado en (x, y) (el piso), de alto h (o de ancho w si es más ancho que alto).
export function drawSprite(ctx: CanvasRenderingContext2D, civ: CivId, idx: number, x: number, y: number, h: number, flip = false, maxW?: number) {
  if (!spritesReady()) return false;
  const row = CIV_IDS.indexOf(civ), [sw, sh] = META[civ][idx];
  let k = h / sh; if (maxW && sw * k > maxW) k = maxW / sw;
  const dw = sw * k, dh = sh * k, sx = idx * CELL + (CELL - sw) / 2, sy = row * CELL + CELL - 4 - sh;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(SPRITES!, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  ctx.restore(); return true;
}
export const roleIdx = (r: Role) => ROLES.indexOf(r);
export const bIdx = (k: BKind) => 6 + BKINDS.indexOf(k);
export const TEAM = ['#4ade80', '#f87171'];

export interface Cam { x: number; y: number; w: number; h: number; z: number } // (x, y: el mundo arriba a la izquierda; z: el zoom)
// ---------------------------------------------------------------- Recursos
function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string, c3: string) {
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.5, y - s * 0.4); ctx.lineTo(x + s * 0.3, y); ctx.lineTo(x - s * 0.3, y); ctx.lineTo(x - s * 0.5, y - s * 0.4); ctx.closePath();
  const g = ctx.createLinearGradient(x - s * 0.5, y - s * 1.6, x + s * 0.5, y); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 1.4); ctx.lineTo(x + s * 0.12, y - s * 0.5); ctx.lineTo(x - s * 0.2, y - s * 0.4); ctx.closePath(); ctx.fill();
}
export function drawNode(ctx: CanvasRenderingContext2D, n: Node, t: number) {
  const gem = n.kind === 'gem', k = 1.7 * Math.max(0.5, Math.min(1, n.amount / 700)); // (grandes: se ven bien al lado de los guerreros)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 2, 24 * k, 8 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(n.x, n.y - 20, 0, n.x, n.y - 20, 54); gl.addColorStop(0, gem ? `rgba(255,200,60,${0.35 + 0.1 * Math.sin(t * 3 + n.id)})` : `rgba(80,150,255,${0.35 + 0.1 * Math.sin(t * 3 + n.id)})`); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(n.x - 60, n.y - 70, 120, 100); ctx.globalCompositeOperation = 'source-over';
  const cs: [number, number, number][] = [[-12, 2, 9], [10, 3, 8], [0, -2, 13], [-5, 6, 6], [15, 7, 6]];
  for (const [dx, dy, s] of cs.slice(0, 2 + Math.round(k * 3))) crystal(ctx, n.x + dx * k, n.y + dy * k, s * k, gem ? '#fff6c8' : '#d7ecff', gem ? '#f5b81a' : '#3b82f6', gem ? '#9a5a00' : '#1e3a8a');
  ctx.restore();
}
// ---------------------------------------------------------------- Construcciones
export function drawBuilding(ctx: CanvasRenderingContext2D, g: LandGame, b: Building, t: number, selected: boolean) {
  const s = BUILD_STATS[b.kind], civ = g.sides[b.owner].civ, w = s.size * 1.15, h = s.size * 0.95, fade = b.dead ? Math.max(0, 1 - b.dead / 1.6) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, w * 0.48, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = selected ? '#fef08a' : TEAM[b.owner]; ctx.lineWidth = selected ? 3 : 2; ctx.globalAlpha = fade * (selected ? 1 : 0.7);
  ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, w * 0.5, w * 0.17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = fade;
  if (b.built < 1) { // en obra: aparece de abajo hacia arriba, transparente, con andamios
    ctx.save(); ctx.globalAlpha = fade * (0.45 + 0.4 * b.built); ctx.beginPath(); ctx.rect(b.x - w, b.y - h * 1.3 * b.built - 4, w * 2, h * 1.3 * b.built + 20); ctx.clip();
    drawSprite(ctx, civ, bIdx(b.kind), b.x, b.y + 6, h, false, w); ctx.restore();
    ctx.strokeStyle = '#c69a5a'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(b.x + i * w * 0.18, b.y); ctx.lineTo(b.x + i * w * 0.18, b.y - h * 0.75); ctx.stroke(); }
    for (let j = 1; j <= 3; j++) { ctx.beginPath(); ctx.moveTo(b.x - w * 0.36, b.y - h * 0.22 * j); ctx.lineTo(b.x + w * 0.36, b.y - h * 0.22 * j); ctx.stroke(); }
  } else drawSprite(ctx, civ, bIdx(b.kind), b.x, b.y + 6, h, false, w);
  if (b.dead) { // se derrumba: humo y fuego
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = i * 0.8 + b.id, r = 20 + b.dead * 40; ctx.fillStyle = `rgba(255,${120 + i * 10},40,${0.5 * fade})`; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * r, b.y - h * 0.4 + Math.sin(a) * r * 0.6, 18 * fade + 4, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  if (!b.dead && (b.hp < b.maxHp || selected || b.built < 1)) bar(ctx, b.x, b.y - h - 10, w * 0.6, b.built < 1 ? b.built : b.hp / b.maxHp, b.built < 1 ? '#facc15' : b.owner === 0 ? '#4ade80' : '#f87171');
  if (!b.dead && b.queue.length) bar(ctx, b.x, b.y - h - 2, w * 0.6, b.qT / ROLE_STATS[b.queue[0]].time, '#60a5fa');
}
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, k: number, c: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = c; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, k)), 4);
}
// ---------------------------------------------------------------- Guerreros
export function drawUnit(ctx: CanvasRenderingContext2D, g: LandGame, u: Unit, t: number, selected: boolean) {
  const s = ROLE_STATS[u.role], civ = g.sides[u.owner].civ, h = s.size, fade = u.dead ? Math.max(0, 1 - u.dead / 1.1) : 1;
  const moving = u.order.k === 'move' || ((u.order.k === 'gather' || u.order.k === 'build' || u.order.k === 'attack') && u.atkT < 0 && Math.abs(Math.sin(u.walk * 0.12)) > 0.01);
  const bob = moving ? Math.abs(Math.sin(u.walk * 0.11)) * 3 : Math.sin(t * 2.4 + u.id) * 0.8;
  const lunge = u.atkT >= 0 ? Math.sin(Math.min(1, u.atkT / 0.3) * Math.PI) * 6 * u.face : 0;
  const flyer = u.role === 'elite' && (civ === 'elfos' || civ === 'nomuerta'), fly = flyer ? 26 + Math.sin(t * 3 + u.id) * 4 : 0;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, h * 0.34, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = selected ? '#fef08a' : TEAM[u.owner]; ctx.lineWidth = selected ? 2.5 : 1.6; ctx.globalAlpha = fade * (selected ? 1 : 0.75);
  ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, h * 0.36, h * 0.12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = fade;
  if (u.dead) { ctx.translate(u.x, u.y); ctx.rotate(u.face * Math.min(1.3, u.dead * 3)); ctx.translate(-u.x, -u.y); }
  const sq = moving ? 1 + Math.sin(u.walk * 0.22) * 0.03 : 1;
  ctx.translate(u.x + lunge, u.y - bob - fly); ctx.scale(1 / sq, sq);
  if (!drawSprite(ctx, civ, roleIdx(u.role), 0, 0, h, u.face < 0, h * 1.6)) { ctx.fillStyle = CIVS[civ].color; ctx.fillRect(-10, -h * 0.8, 20, h * 0.8); }
  ctx.restore();
  if (u.carry > 0 && !u.dead) crystal(ctx, u.x + u.face * -10, u.y - h * 0.7, 5, u.carryKind === 'gem' ? '#fff6c8' : '#d7ecff', u.carryKind === 'gem' ? '#f5b81a' : '#3b82f6', u.carryKind === 'gem' ? '#9a5a00' : '#1e3a8a');
  if (!u.dead && (u.hp < u.maxHp || selected)) bar(ctx, u.x, u.y - h - fly - 6, Math.max(26, h * 0.6), u.hp / u.maxHp, u.owner === 0 ? '#4ade80' : '#f87171');
}
// ---------------------------------------------------------------- Disparos, curaciones y explosiones
export function drawShots(ctx: CanvasRenderingContext2D, g: LandGame) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const s of g.shots) {
    if (s.t < 0) continue;
    const k = s.t / s.life, col = CIVS[g.sides[s.owner].civ].color;
    if (s.kind === 'bolt' || s.kind === 'splash') {
      const x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k, px = s.x + (s.tx - s.x) * Math.max(0, k - 0.25), py = s.y + (s.ty - s.y) * Math.max(0, k - 0.25);
      ctx.strokeStyle = col; ctx.lineWidth = s.kind === 'splash' ? 6 : 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 1.5; ctx.stroke();
      if (s.kind === 'splash' && k > 0.85) { ctx.fillStyle = col + '88'; ctx.beginPath(); ctx.arc(s.tx, s.ty, 40, 0, Math.PI * 2); ctx.fill(); }
    } else if (s.kind === 'heal') {
      const x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k;
      ctx.fillStyle = `rgba(120,255,140,${1 - k * 0.5})`; ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillRect(x - 2, y - 6, 4, 12);
      if (k > 0.7) { ctx.strokeStyle = `rgba(120,255,140,${(1 - k) * 2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.tx, s.ty + 20, 22, 0, Math.PI * 2); ctx.stroke(); }
    } else if (s.kind === 'slash') {
      ctx.strokeStyle = `rgba(255,255,230,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 16, -1.2 + k, 0.6 + k); ctx.stroke();
    } else if (s.kind === 'strike') {
      const r = 30 + k * 110; const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); gr.addColorStop(0, `rgba(255,255,220,${1 - k})`); gr.addColorStop(0.4, `rgba(255,150,40,${0.8 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,240,200,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x, s.y - 700 * (1 - k)); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
  }
  ctx.restore();
}
// ---------------------------------------------------------------- Todo el cuadro
export function drawWorld(ctx: CanvasRenderingContext2D, g: LandGame, map: HTMLCanvasElement | null, cam: Cam, t: number, sel: Set<number>, extra?: (ctx: CanvasRenderingContext2D) => void) {
  ctx.save(); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const W = g.terrain.w, H = g.terrain.h;
  if (map) { // (solo el pedazo que se ve)
    const k = map.width / W, sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), sw = Math.min(W - sx, cam.w / cam.z + 2), sh = Math.min(H - sy, cam.h / cam.z + 2); // (k: el escenario está pintado con más resolución)
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(map, sx * k, sy * k, sw * k, sh * k, sx, sy, sw, sh);
  } else { ctx.fillStyle = '#3a3226'; ctx.fillRect(0, 0, W, H); }
  const vx0 = cam.x - 200, vx1 = cam.x + cam.w / cam.z + 200, vy0 = cam.y - 200, vy1 = cam.y + cam.h / cam.z + 250, vis = (o: { x: number; y: number }) => o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1;
  for (const n of g.nodes) if (vis(n)) drawNode(ctx, n, t);
  // de atrás para adelante (los de más abajo tapan a los de más arriba)
  const all: ({ y: number; d: () => void })[] = [];
  for (const b of g.buildings) if (vis(b)) all.push({ y: b.y, d: () => drawBuilding(ctx, g, b, t, sel.has(b.id)) });
  for (const u of g.units) if (vis(u)) all.push({ y: u.y, d: () => drawUnit(ctx, g, u, t, sel.has(u.id)) });
  all.sort((a, b) => a.y - b.y); for (const o of all) o.d();
  drawShots(ctx, g);
  extra?.(ctx);
  ctx.restore();
}
// El mapa chico: el terreno, los recursos, las construcciones (cuadrados) y los guerreros (puntos) de cada uno.
let MINI: { src: HTMLCanvasElement; c: HTMLCanvasElement } | null = null; // (el terreno achicado una sola vez)
export function drawMinimap(ctx: CanvasRenderingContext2D, g: LandGame, map: HTMLCanvasElement | null, w: number, h: number, cam: Cam) {
  ctx.clearRect(0, 0, w, h);
  if (map) { if (!MINI || MINI.src !== map) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(map, 0, 0, w, h); MINI = { src: map, c }; } ctx.drawImage(MINI.c, 0, 0); } else { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, h);
  const kx = w / g.terrain.w, ky = h / g.terrain.h;
  for (const n of g.nodes) { ctx.fillStyle = n.kind === 'gem' ? '#fbbf24' : '#60a5fa'; ctx.fillRect(n.x * kx - 1, n.y * ky - 1, 2, 2); }
  for (const b of g.buildings) if (!b.dead) { const s = BUILD_STATS[b.kind].size * kx * 0.9; ctx.fillStyle = TEAM[b.owner]; ctx.fillRect(b.x * kx - s / 2, b.y * ky - s / 2, s, s); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(b.x * kx - s / 2, b.y * ky - s / 2, s, s); }
  for (const u of g.units) if (!u.dead) { ctx.fillStyle = TEAM[u.owner]; ctx.fillRect(u.x * kx - 1.5, u.y * ky - 1.5, 3, 3); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(cam.x * kx, cam.y * ky, cam.w / cam.z * kx, cam.h / cam.z * ky);
}
