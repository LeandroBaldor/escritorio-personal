// Land of Warriors: el dibujo del mapa, los recursos, las construcciones, los guerreros y los disparos.
import { BUILD_STATS, ROLE_STATS, ROLES, type BKind, type Building, type LandGame, type Role, type Unit, type Node } from './land';
import { CIVS, CIV_IDS, TRAINING_ROLE, type CivId } from './landCivs';
import { drawAmbientTerrain, type TerrainRegion } from './landMapArt';
import { drawWorldProp } from './landProps';
import { drawWall } from './landWalls';
import { drawDeath } from './landDeath';
import { walkingPhase } from './landMotion';

// Once recortes por civilización en hojas individuales de 4 × 3, con el último casillero vacío.
const URLS = import.meta.glob('./assets/land/units-*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const SPRITES: Partial<Record<CivId, HTMLCanvasElement>> = {};
const FRAMES: Partial<Record<CivId, { sx: number; sy: number; sw: number; sh: number }[]>> = {};
let started = false;
export function spritesReady() {
  if (!started && typeof Image !== 'undefined') {
    started = true;
    for (const civ of CIV_IDS) {
      const image = new Image();
      image.onload = () => {
        const cv = document.createElement('canvas'); cv.width = image.naturalWidth; cv.height = image.naturalHeight;
        const ctx = cv.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, cv.width, cv.height), data = pixels.data;
        const frames = [];
        for (let idx = 0; idx < 11; idx++) {
          const col = idx % 4, row = Math.floor(idx / 4);
          const x0 = Math.round(col * cv.width / 4), x1 = Math.round((col + 1) * cv.width / 4);
          const y0 = Math.round(row * cv.height / 3), y1 = Math.round((row + 1) * cv.height / 3);
          let left = x1, right = x0, top = y1, bottom = y0;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * cv.width + x) * 4 + 3] > 32) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
          frames.push(right >= left && bottom >= top ? { sx: left, sy: top, sw: right - left + 1, sh: bottom - top + 1 } : { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 });
        }
        FRAMES[civ] = frames; SPRITES[civ] = cv;
      };
      image.src = URLS['./assets/land/units-' + civ + '.webp'];
    }
  }
  return CIV_IDS.every(c => !!SPRITES[c]);
}
// Dibuja un recorte apoyado en (x, y) (el piso), de alto h (o de ancho w si es más ancho que alto).
export function drawSprite(ctx: CanvasRenderingContext2D, civ: CivId, idx: number, x: number, y: number, h: number, flip = false, maxW?: number, motion = 0) {
  if (idx === 11) return drawWall(ctx,civ,x,y,Math.min(maxW ?? h,h*1.2),h);
  spritesReady();
  const image = SPRITES[civ], frame = FRAMES[civ]?.[idx]; if (!image || !frame) return false;
  const { sx, sy, sw, sh } = frame;
  let k = h / sh; if (maxW && sw * k > maxW) k = maxW / sw;
  const dw = sw * k, dh = sh * k;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (motion && idx < 6) {
    const humanoid = idx < 4 && civ !== 'zergano' && civ !== 'abisal';
    const piece = (fx: number, fy: number, fw: number, fh: number, px: number, py: number, angle: number, lift = 0) => {
      ctx.save(); ctx.translate((px - 0.5) * dw, (py - 1) * dh + lift); ctx.rotate(angle);
      ctx.drawImage(image, sx + sw * fx, sy + sh * fy, sw * fw, sh * fh, (fx - px) * dw, (fy - py) * dh, fw * dw, fh * dh + 0.25); ctx.restore();
    };
    if (humanoid) {
      // Apoyo alternado de los pies, flexión de cadera y contrapeso de los brazos.
      const phase = Math.sin(motion), stride = 0.15 * phase;
      piece(0, .59, .5, .41, .28, .60, stride, -Math.max(0, -phase) * dh * .035);
      piece(.5, .59, .5, .41, .70, .60, -stride, -Math.max(0, phase) * dh * .035);
      piece(0, 0, 1, .2, .5, .5, -phase * .014);
      piece(.2, .2, .6, .41, .5, .5, -phase * .014);
      piece(0, .2, .2, .4, .23, .23, -stride * .5);
      piece(.8, .2, .2, .4, .78, .23, stride * .5);
    } else {
      const strips = 24, mechanical = (civ === 'humano' || civ === 'mecanico' || civ === 'enanos') && idx === 4;
      for (let j = 0; j < strips; j++) {
        const f = j / strips, sway = Math.sin(motion + f * 4.5) * Math.pow(f, 2) * dw * (mechanical ? .007 : .035);
        const rise = mechanical ? Math.sin(motion * 2) * .3 : Math.sin(motion + f * 5) * Math.max(0, f - .55) * dh * .025;
        ctx.drawImage(image, sx, sy + sh * f, sw, sh / strips, -dw / 2 + sway, -dh + dh * f + rise, dw, dh / strips + .2);
      }
    }
  } else ctx.drawImage(image, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  ctx.restore(); return true;
}
export const roleIdx = (r: Role) => ROLES.indexOf(r);
export const bIdx = (k: BKind) => k==='base'?6:k==='tower'?9:k==='depot'||k==='workerBarracks'?10:k==='wall'?11:k==='workshop'||k==='eliteBarracks'?8:7;
export const TEAM = ['#4ade80', '#f87171', '#a78bfa', '#38bdf8', '#fbbf24', '#fb923c', '#f472b6', '#2dd4bf', '#c084fc', '#e2e8f0'];

export interface Cam { x: number; y: number; w: number; h: number; z: number } // (x, y: el mundo arriba a la izquierda; z: el zoom)
// ---------------------------------------------------------------- Recursos
function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string, c3: string) {
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.5, y - s * 0.4); ctx.lineTo(x + s * 0.3, y); ctx.lineTo(x - s * 0.3, y); ctx.lineTo(x - s * 0.5, y - s * 0.4); ctx.closePath();
  const g = ctx.createLinearGradient(x - s * 0.5, y - s * 1.6, x + s * 0.5, y); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 1.4); ctx.lineTo(x + s * 0.12, y - s * 0.5); ctx.lineTo(x - s * 0.2, y - s * 0.4); ctx.closePath(); ctx.fill();
}
export function drawNode(ctx: CanvasRenderingContext2D, n: Node, t: number) {
  const gem = n.kind === 'gem', energy = n.kind === 'energy', k = 1.7 * Math.max(0.5, Math.min(1, n.amount / 700)); // (grandes: se ven bien al lado de los guerreros)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 2, 24 * k, 8 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(n.x, n.y - 20, 0, n.x, n.y - 20, 54); gl.addColorStop(0, energy ? `rgba(50,255,140,${0.35 + 0.1 * Math.sin(t * 3 + n.id)})` : gem ? `rgba(255,200,60,${0.35 + 0.1 * Math.sin(t * 3 + n.id)})` : `rgba(80,150,255,${0.35 + 0.1 * Math.sin(t * 3 + n.id)})`); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(n.x - 60, n.y - 70, 120, 100); ctx.globalCompositeOperation = 'source-over';
  if (drawWorldProp(ctx, energy ? 10 : gem ? 9 : 8, n.x, n.y + 7, 57 * k, 75 * k)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = energy ? '#8bffbb' : gem ? '#fff1b0' : '#b3e8ff';
    for (let i = 0; i < 3; i++) { const p = (t * .22 + i / 3 + n.id * .13) % 1; ctx.globalAlpha = Math.sin(p * Math.PI) * .7; ctx.beginPath(); ctx.arc(n.x + Math.sin(i * 3 + n.id) * 20 * k, n.y - p * 65 * k, 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); ctx.restore(); return;
  }
  const cs: [number, number, number][] = [[-12, 2, 9], [10, 3, 8], [0, -2, 13], [-5, 6, 6], [15, 7, 6]];
  for (const [dx, dy, s] of cs.slice(0, 2 + Math.round(k * 3))) crystal(ctx, n.x + dx * k, n.y + dy * k, s * k, energy ? '#baffd5' : gem ? '#fff6c8' : '#d7ecff', energy ? '#22d875' : gem ? '#f5b81a' : '#3b82f6', energy ? '#075a30' : gem ? '#9a5a00' : '#1e3a8a');
  ctx.restore();
}
// ---------------------------------------------------------------- Construcciones
export function drawBuilding(ctx: CanvasRenderingContext2D, g: LandGame, b: Building, t: number, selected: boolean) {
  const s = BUILD_STATS[b.kind], civ = g.sides[b.owner].civ, w = s.size * 1.15, h = s.size * 0.95, fade = b.dead ? Math.max(0, 1 - b.dead / 1.6) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  if (b.built < 1) {
    // El solar queda vacío hasta completar el trabajo; solo se señala su perímetro.
    ctx.strokeStyle = selected ? '#fef08a' : CIVS[civ].color; ctx.lineWidth = 2; ctx.setLineDash([7,6]);
    ctx.beginPath(); ctx.ellipse(b.x,b.y+4,w*.5,w*.17,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    bar(ctx,b.x,b.y-24,w*.7,b.built,'#facc15');
    ctx.font='bold 10px Orbitron, sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff5c1';ctx.fillText(`${Math.floor(b.built*100)}%`,b.x,b.y-31);
    ctx.restore();return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, w * 0.48, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = selected ? '#fef08a' : TEAM[b.owner]; ctx.lineWidth = selected ? 3 : 2; ctx.globalAlpha = fade * (selected ? 1 : 0.7);
  ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, w * 0.5, w * 0.17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = fade;
  {
    drawSprite(ctx, civ, bIdx(b.kind), b.x, b.y + 6, h, false, w);
    const recruit=TRAINING_ROLE[b.kind];
    if(recruit&&!b.dead){
      const bx=b.x+w*.33,by=b.y-h*.35;
      ctx.fillStyle='#061a2f';ctx.fillRect(bx-19,by-39,38,43);ctx.strokeStyle=CIVS[civ].color;ctx.lineWidth=2;ctx.strokeRect(bx-19,by-39,38,43);
      drawSprite(ctx,civ,roleIdx(recruit),bx,by+2,39,false,35);
    }
    if (!b.dead) {
      // Balizas, vapor y actividad de producción sobre el edificio real.
      const active = b.queue.length > 0 || !!b.research;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = CIVS[civ].color; ctx.globalAlpha = 0.35 + Math.sin(t * (active ? 6 : 2) + b.id) * 0.2;
      for (const dx of [-0.25, 0.25]) { ctx.beginPath(); ctx.arc(b.x + w * dx, b.y - h * 0.43, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (active || b.hp < b.maxHp * 0.45) for (let i = 0; i < 4; i++) {
        const p = (t * 0.32 + i / 4 + b.id * 0.13) % 1;
        ctx.fillStyle = 'rgba(175,192,210,' + (0.22 * (1 - p)) + ')'; ctx.beginPath();
        ctx.arc(b.x + w * 0.2 + Math.sin(p * 4 + i) * 7, b.y - h * 0.8 - p * 35, 3 + p * 9, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
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
  if (u.dead) { drawDeath(ctx,civ,u,h); return; }
  const moving=!!u.moving,phase=walkingPhase(u.walk);
  const bob = moving ? Math.abs(Math.sin(phase)) * 1.6 : Math.sin(t * 2.4 + u.id) * 0.8;
  const lunge = u.atkT >= 0 ? Math.sin(Math.min(1, u.atkT / 0.3) * Math.PI) * 6 * u.face : 0;
  const flyer = u.role === 'elite' && (civ === 'elfos' || civ === 'nomuerta'), fly = flyer ? 26 + Math.sin(t * 3 + u.id) * 4 : 0;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, h * 0.34, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = selected ? '#fef08a' : TEAM[u.owner]; ctx.lineWidth = selected ? 2.5 : 1.6; ctx.globalAlpha = fade * (selected ? 1 : 0.75);
  ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, h * 0.36, h * 0.12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = fade;
  if (u.dead) { ctx.translate(u.x, u.y); ctx.rotate(u.face * Math.min(1.3, u.dead * 3)); ctx.translate(-u.x, -u.y); }
  const sq = moving ? 1 + Math.sin(phase*2) * 0.009 : 1;
  ctx.translate(u.x + lunge, u.y - bob - fly); ctx.scale(1 / sq, sq);
  if (!drawSprite(ctx, civ, roleIdx(u.role), 0, 0, h, u.face < 0, h * 1.6, moving ? phase : u.atkT >= 0 && civ!=='humano' ? t * 15 : 0)) { ctx.fillStyle = CIVS[civ].color; ctx.fillRect(-10, -h * 0.8, 20, h * 0.8); }
  ctx.restore();
  if (u.carry > 0 && !u.dead) crystal(ctx, u.x + u.face * -10, u.y - h * 0.7, 5, u.carryKind === 'energy' ? '#baffd5' : u.carryKind === 'gem' ? '#fff6c8' : '#d7ecff', u.carryKind === 'energy' ? '#22d875' : u.carryKind === 'gem' ? '#f5b81a' : '#3b82f6', u.carryKind === 'energy' ? '#075a30' : u.carryKind === 'gem' ? '#9a5a00' : '#1e3a8a');
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
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 11; ctx.globalAlpha = .65; ctx.strokeStyle = col; ctx.lineWidth = s.kind === 'splash' ? 8 : 5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.lineWidth = 1.4; ctx.strokeStyle = '#f6ffff'; ctx.stroke(); ctx.restore();
      const flash = Math.max(0, 1 - k * 4); if (flash) { ctx.save(); ctx.globalAlpha = flash; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, 6 + flash * 4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
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
export function drawWorld(ctx: CanvasRenderingContext2D, g: LandGame, map: HTMLCanvasElement | null, cam: Cam, t: number, sel: Set<number>, extra?: (ctx: CanvasRenderingContext2D) => void, detail?: (TerrainRegion & { canvas: HTMLCanvasElement }) | null) {
  ctx.save(); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const W = g.terrain.w, H = g.terrain.h;
  if (map) { // (solo el pedazo que se ve)
    const k = map.width / W, sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), sw = Math.min(W - sx, cam.w / cam.z + 2), sh = Math.min(H - sy, cam.h / cam.z + 2); // (k: el escenario está pintado con más resolución)
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(map, sx * k, sy * k, sw * k, sh * k, sx, sy, sw, sh);
  } else { ctx.fillStyle = '#3a3226'; ctx.fillRect(0, 0, W, H); }
  if (detail) ctx.drawImage(detail.canvas, detail.x, detail.y, detail.w, detail.h);
  drawAmbientTerrain(ctx, g.terrain, cam, t);
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
  for (const n of g.nodes) { ctx.fillStyle = n.kind === 'energy' ? '#4ade80' : n.kind === 'gem' ? '#fbbf24' : '#60a5fa'; ctx.fillRect(n.x * kx - 1, n.y * ky - 1, 2, 2); }
  for (const b of g.buildings) if (!b.dead) { const s = BUILD_STATS[b.kind].size * kx * 0.9; ctx.fillStyle = TEAM[b.owner]; ctx.fillRect(b.x * kx - s / 2, b.y * ky - s / 2, s, s); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(b.x * kx - s / 2, b.y * ky - s / 2, s, s); }
  for (const u of g.units) if (!u.dead) { ctx.fillStyle = TEAM[u.owner]; ctx.fillRect(u.x * kx - 1.5, u.y * ky - 1.5, 3, 3); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(cam.x * kx, cam.y * ky, cam.w / cam.z * kx, (cam.h - 214) / cam.z * ky);
}
