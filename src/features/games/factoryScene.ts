import { FACTORIES, FACTORY_WIDTH, FACTORY_HEIGHT, FACTORY_TOP, FOODS, factoryLevel, hazardActive, hazardDirection, platformX, type FactoryGame } from './fartFactory';
import { MAZE_ROWS_PER_LEVEL } from './factoryMaze';
import { factoryMetal as metal, factoryEllipse as ellipse, factoryGear as gear } from './factoryArt';
import backgroundsUrl from './assets/factory/backgrounds.webp';
import heroUrl from './assets/factory/hero.webp';
import foodsUrl from './assets/factory/foods.webp';

let backgrounds: HTMLImageElement | null = null, hero: HTMLImageElement | null = null, foods: HTMLImageElement | null = null;
const metalTiles = new Map<number, HTMLCanvasElement>();
let gasLayer: HTMLCanvasElement | null = null;
export async function loadFactoryArt() {
  const load = async (url: string) => { const image = new Image(); image.src = url; await image.decode(); return image; };
  [backgrounds, hero, foods] = await Promise.all([load(backgroundsUrl), load(heroUrl), load(foodsUrl)]);
}
function mazeMetal(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, level: number) {
  let tile = metalTiles.get(level);
  if (!tile) {
    tile = document.createElement('canvas'); tile.width = 192; tile.height = 96;
    const t = tile.getContext('2d')!, gradient = t.createLinearGradient(0, 0, 0, 96);
    gradient.addColorStop(0, '#71828c'); gradient.addColorStop(0.4, '#3e505d'); gradient.addColorStop(1, '#24323e'); t.fillStyle = gradient; t.fillRect(0, 0, 192, 96);
    for (let i = 0; i < 350; i++) { t.fillStyle = i % 2 ? '#e1efff0c' : '#02081018'; t.fillRect(i * 71 % 192, i * 37 % 96, 8 + i * 13 % 55, 1); }
    t.strokeStyle = '#040d1799'; t.strokeRect(1, 1, 190, 94); t.strokeStyle = '#c2d9e52a'; t.strokeRect(3, 3, 186, 90);
    for (const xx of [8, 184]) for (const yy of [8, 88]) { ellipse(t, xx, yy, 3, 3, '#12232f'); ellipse(t, xx - 0.7, yy - 0.7, 1.6, 1.6, '#b0c2c9'); }
    t.fillStyle = `${FACTORIES[level].color}17`; t.fillRect(0, 0, 192, 96); metalTiles.set(level, tile);
  }
  c.fillStyle = '#0007'; c.fillRect(x + 5, y + 6, w, h);
  c.fillStyle = c.createPattern(tile, 'repeat')!; c.fillRect(x, y, w, h);
  c.fillStyle = '#d8e7ef66'; c.fillRect(x, y, w, 2); c.fillStyle = '#050e17'; c.fillRect(x, y + h - 3, w, 3);
  c.strokeStyle = '#91a6b04d'; c.lineWidth = 1; c.strokeRect(x, y, w, h);
}
function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, '#0000');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function factoryView(g: FactoryGame, width: number, height: number) {
  // Track the actual collision floor, and zoom out gradually enough to retain the player.
  const gap = Math.max(0, g.y - g.spikes);
  const topSafe = height < 550 ? 105 : 180;
  const scale = Math.max(0.08, Math.min(1.05, width / 560, Math.max(0.6, height / 850), (height - 110 - topSafe) / (gap + 122)));
  const w = width / scale, h = height / scale;
  return { scale, w, h, left: w > FACTORY_WIDTH ? (FACTORY_WIDTH - w) / 2 : Math.max(0, Math.min(FACTORY_WIDTH - w, g.x - w / 2)), bottom: g.spikes - 110 / scale };
}
function drawHero(c: CanvasRenderingContext2D, g: FactoryGame, y: number) {
  if (!hero) return;
  let frame = 0;
  if (g.puff > 0.51) frame = 3;
  else if (g.puff > 0.25) frame = 4;
  else if (g.ground === null) frame = g.vy > 0 ? 5 : 6;
  else if (g.landing > 0) frame = 7;
  else if (Math.abs(g.vx) > 30) frame = Math.floor(g.time * 9) % 2 + 1;
  ellipse(c, g.x, y + 2, 23, 5, '#0008');
  c.save(); c.translate(g.x, y); c.rotate(g.lean); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  const sw = hero.width / 4, sh = hero.height / 2;
  c.drawImage(hero, frame % 4 * sw, Math.floor(frame / 4) * sh, sw, sh, -61, -121, 122, 122); c.restore();
}
export function drawFactoryMenu(c: CanvasRenderingContext2D, width: number, height: number, time: number) {
  c.fillStyle = '#0f1a26'; c.fillRect(0, 0, width, height);
  if (backgrounds) {
    const sw = backgrounds.width / 5, sh = backgrounds.height / 2, size = Math.max(width, height);
    c.drawImage(backgrounds, sw, 0, sw, sh, (width - size) / 2, (height - size) / 2, size, size);
  }
  const shade = c.createLinearGradient(0, 0, width, 0); shade.addColorStop(0, '#07111eea'); shade.addColorStop(0.5, '#10203055'); shade.addColorStop(1, '#17354a20'); c.fillStyle = shade; c.fillRect(0, 0, width, height);
  const x = width < 600 ? width * 0.76 : width * 0.75, y = height * 0.84;
  const size = Math.min(height * 0.64, width < 600 ? width * 0.57 : width * 0.4);
  mazeMetal(c, x - size * 0.72, y + 3, size * 1.44, 32, 1);
  if (hero) { ellipse(c, x, y, size * 0.23, size * 0.035, '#0009'); c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(hero, 0, 0, hero.width / 4, hero.height / 2, x - size / 2, y - size + Math.sin(time * 1.7) * 2, size, size); c.restore(); }
  for (let i = 0; i < 30; i++) ellipse(c, (i * 191 + time * 4) % width, (i * 97 + time * 8) % height, 1, 1, '#d9f1ff55');
}
function drawFood(c: CanvasRenderingContext2D, x: number, y: number, index: number, time: number) {
  const bob = Math.sin(time * 3 + index) * 2;
  if (foods) {
    const sw = foods.naturalWidth / 5, sh = foods.naturalHeight / 2;
    ellipse(c, x, y - 5, 25, 5, '#0007');
    c.drawImage(foods, index % 5 * sw, Math.floor(index / 5) * sh, sw, sh, x - 30, y - 60 + bob, 60, 60); return;
  }
  ellipse(c, x, y - 7, 21, 5, '#0009');
  ellipse(c, x, y - 16 + bob, 23, 7, '#d1d8d1'); ellipse(c, x, y - 17 + bob, 19, 5, '#faf3dd');
  c.font = '29px sans-serif'; c.textAlign = 'center'; c.fillText(FOODS[index].icon, x, y - 21 + bob); c.textAlign = 'left';
}
function floorSpikes(c: CanvasRenderingContext2D, y: number, time: number, left: number, width: number) {
  metal(c, left, y + 7, width, 120, '#68504a');
  for (let x = Math.floor(left / 30) * 30; x < left + width; x += 30) {
    const g = c.createLinearGradient(x, y, x + 30, y); g.addColorStop(0, '#45515a'); g.addColorStop(0.45, '#e5e7e5'); g.addColorStop(0.53, '#94a1a6'); g.addColorStop(1, '#26343a');
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y + 11); c.lineTo(x + 15, y - 25); c.lineTo(x + 30, y + 11); c.closePath(); c.fill();
    c.strokeStyle = '#f2f2d866'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 15, y - 25); c.lineTo(x + 15, y + 8); c.stroke();
    c.fillStyle = Math.sin(time * 5 + x) > 0 ? '#fb5a32' : '#783b2c'; c.fillRect(x + 6, y + 22, 18, 3);
  }
  const gradient = c.createLinearGradient(0, y - 65, 0, y + 15); gradient.addColorStop(0, '#d6392000'); gradient.addColorStop(1, '#d6392044'); c.fillStyle = gradient; c.fillRect(left, y - 65, width, 80);
}
export function drawFactory(c: CanvasRenderingContext2D, g: FactoryGame, width: number, height: number) {
  const v = factoryView(g, width, height), theme = FACTORIES[factoryLevel(g.y)];
  c.fillStyle = theme.wall; c.fillRect(0, 0, width, height);
  c.save(); c.scale(v.scale, v.scale); c.translate(-v.left, 0);
  const sy = (y: number) => v.h - (y - v.bottom);
  const tile = FACTORY_HEIGHT / 3;
  for (let row = Math.floor(v.bottom / tile); row <= Math.ceil((v.bottom + v.h) / tile); row++) {
    const level = factoryLevel(Math.max(0, row * tile + tile / 2)), yy = sy((row + 1) * tile);
    if (backgrounds) {
      const sw = backgrounds.naturalWidth / 5, sh = backgrounds.naturalHeight / 2;
      for (let x = Math.floor(v.left / 800) * 800; x < v.left + v.w; x += 800) c.drawImage(backgrounds, level % 5 * sw, Math.floor(level / 5) * sh, sw, sh, x, yy, 800, tile + 1);
    }
    c.fillStyle = '#030a1130'; c.fillRect(v.left, yy, v.w, tile);
    c.save(); c.globalAlpha = 0.25;
    for (let x = 40; x < FACTORY_WIDTH; x += 310) {
      metal(c, x, yy, 12, tile, '#55616b');
      c.strokeStyle = '#0b1117'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 22, yy); c.bezierCurveTo(x + 70, yy + 80, x - 15, yy + 110, x + 28, yy + 260); c.stroke();
      metal(c, x + 15, yy + 370, 11, 170, '#79634d');
      c.fillStyle = theme.color; c.fillRect(x - 4, yy + 265, 23, 4);
      glow(c, x + 8, yy + 270, 50, `${theme.color}24`);
    }
    c.restore();
  }
  c.save(); c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) {
    const x = i * 210 + 50, y = sy(Math.floor(g.y / 480) * 480 + (i % 3) * 100);
    const gradient = c.createLinearGradient(x, y - 180, x + 50, y + 200); gradient.addColorStop(0, `${theme.color}16`); gradient.addColorStop(1, '#0000');
    c.fillStyle = gradient; c.beginPath(); c.moveTo(x - 8, y - 180); c.lineTo(x + 8, y - 180); c.lineTo(x + 115, y + 200); c.lineTo(x - 80, y + 200); c.fill();
  }
  c.restore();
  for (let i = 0; i < 35; i++) { const x = (i * 173 + Math.sin(g.time * 0.3 + i) * 20) % FACTORY_WIDTH, y = (i * 97 + g.time * (4 + i % 4)) % v.h; ellipse(c, x, y, 0.8, 0.8, '#f4e4c733'); }
  for (const p of g.platforms) {
    const y = sy(p.y), x = platformX(p, g.time); if (y < -90 || y > v.h + 60 || x + p.w / 2 < v.left || x - p.w / 2 > v.left + v.w) continue;
    if (p.checkpoint || p.y === FACTORY_TOP) { c.fillStyle = theme.color; c.font = 'bold 17px monospace'; c.textAlign = 'center'; c.fillText(p.y === FACTORY_TOP ? 'SALIDA · 10 FÁBRICAS COMPLETADAS' : `SECTOR ${p.row / MAZE_ROWS_PER_LEVEL + 1} · ${FACTORIES[factoryLevel(p.y)].name.toUpperCase()}`, 800, y + 46); c.textAlign = 'left'; }
    mazeMetal(c, x - p.w / 2, y, p.w, p.solid ? 22 : 16, factoryLevel(p.y));
    c.save(); c.beginPath(); c.rect(x - p.w / 2, y + 3, p.w, 5); c.clip();
    for (let k = -p.w / 2; k < p.w / 2; k += 20) { c.fillStyle = '#edbd36'; c.beginPath(); c.moveTo(x + k, y + 3); c.lineTo(x + k + 10, y + 3); c.lineTo(x + k + 4, y + 8); c.lineTo(x + k - 6, y + 8); c.fill(); } c.restore();
    c.strokeStyle = '#50636d'; c.lineWidth = 3;
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(x + side * p.w * 0.42, y + 19); c.lineTo(x + side * p.w * 0.24, y + 39); c.lineTo(x + side * p.w * 0.24, y + 19); c.stroke(); }
    c.fillStyle = '#14212a'; for (let k = -p.w / 2 + 12; k < p.w / 2; k += 12) c.fillRect(x + k, y + 11, 5, 3);
    if (p.moving) { c.strokeStyle = '#adbcc44d'; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(p.x - 90, y + 47); c.lineTo(p.x + 90, y + 47); c.stroke(); c.setLineDash([]); }
    if (!p.eaten) drawFood(c, x, y, p.food, g.time);
  }
  for (const wall of g.walls) {
    const y = sy(wall.y + wall.h);
    if (y > v.h || y + wall.h < 0 || wall.x > v.left + v.w || wall.x + wall.w < v.left) continue;
    mazeMetal(c, wall.x, y, wall.w, wall.h, factoryLevel(wall.y));
    c.fillStyle = `${theme.color}99`; c.fillRect(wall.x + 3, y + 12, wall.w - 6, 3);
  }
  for (const bomb of g.bombs) {
    const y = sy(bomb.y); if (y < -150 || y > v.h + 150) continue;
    if (bomb.blast > 0) {
      const f = 1 - bomb.blast / 0.65; glow(c, bomb.x, y, bomb.radius * (0.4 + f * 0.6), '#ff9a2380');
      c.strokeStyle = `rgba(255,208,105,${1 - f})`; c.lineWidth = 5 * (1 - f); c.beginPath(); c.arc(bomb.x, y, bomb.radius * (0.4 + f * 0.6), 0, Math.PI * 2); c.stroke();
    }
    if (bomb.spent) continue;
    ellipse(c, bomb.x, y + 2, 24, 7, '#0009');
    metal(c, bomb.x - 20, y - 22, 40, 30, '#647050');
    c.strokeStyle = '#ddaa72'; c.lineWidth = 2; c.beginPath(); c.moveTo(bomb.x - 8, y - 23); c.bezierCurveTo(bomb.x - 18, y - 42, bomb.x + 18, y - 38, bomb.x + 10, y - 10); c.stroke();
    c.fillStyle = '#111e1a'; c.fillRect(bomb.x - 15, y - 15, 30, 17); c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillStyle = bomb.remaining === null ? '#8bb68b' : '#ff6853'; c.fillText(bomb.remaining === null ? '—' : `${Math.ceil(bomb.remaining)}s`, bomb.x, y - 2); c.textAlign = 'left';
    if (bomb.remaining !== null) { c.strokeStyle = '#ef7e4266'; c.lineWidth = 1; c.setLineDash([5, 7]); c.beginPath(); c.arc(bomb.x, y, bomb.radius, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
  }
  for (const h of g.hazards) {
    const y = sy(h.y); if (y < -110 || y > v.h + 110 || h.x < v.left - 180 || h.x > v.left + v.w + 180) continue;
    const active = hazardActive(h, g.time), dir = hazardDirection(h);
    if (h.kind === 'gear') { c.strokeStyle = '#23353f'; c.lineWidth = 9; c.beginPath(); c.moveTo(h.x, y - 85); c.lineTo(h.x, y); c.stroke(); gear(c, h.x, y, 43, g.time * (dir + 0.4), theme.color); }
    if (h.kind === 'spikes') { metal(c, h.x - 42, y + 8, 84, 12); for (let i = -40; i < 40; i += 16) { c.fillStyle = '#c1cbd1'; c.beginPath(); c.moveTo(h.x + i, y + 8); c.lineTo(h.x + i + 8, y - 15); c.lineTo(h.x + i + 16, y + 8); c.fill(); } }
    if (h.kind === 'laser' || h.kind === 'fire') {
      metal(c, h.x - 16, y - 21, 32, 42); ellipse(c, h.x, y, 8, 8, active ? '#ff6444' : '#facc15');
      c.strokeStyle = active && h.kind === 'laser' ? '#ff4b45' : '#ef444433'; c.lineWidth = active && h.kind === 'laser' ? 6 : 1; c.beginPath(); c.moveTo(h.x, y); c.lineTo(h.x + dir * 128, y); c.stroke();
      if (active && h.kind === 'fire') for (let k = 0; k < 9; k++) { const f = (g.time * 3 + k / 9) % 1; glow(c, h.x + dir * f * 130, y + Math.sin(g.time * 20 + k) * 7, 12 + f * 20, k % 2 ? '#ffbe3777' : '#ff581ca0'); }
      if (active) { glow(c, h.x, y, 65, '#ff623132'); c.strokeStyle = '#fff4d0'; c.lineWidth = 1.5; if (h.kind === 'laser') { c.beginPath(); c.moveTo(h.x, y); c.lineTo(h.x + dir * 128, y); c.stroke(); } }
    }
    if (h.kind === 'door') { metal(c, h.x - 55, y - 80, 110, 12); const amount = active ? 130 : 20 + Math.sin((g.time + h.phase) * 3) * 5; metal(c, h.x - 52, y - 68, 104, amount, '#7c756b'); for (let k = 8; k < amount; k += 12) { c.fillStyle = '#090f1744'; c.fillRect(h.x - 50, y - 68 + k, 100, 2); } c.fillStyle = active ? '#f87171' : '#4ade80'; c.fillRect(h.x - 25, y - 76, 50, 4); }
  }
  const py = sy(g.y);
  gasLayer ??= document.createElement('canvas');
  if (gasLayer.width !== Math.ceil(width) || gasLayer.height !== Math.ceil(height)) { gasLayer.width = Math.ceil(width); gasLayer.height = Math.ceil(height); }
  const gasContext = gasLayer.getContext('2d')!;
  gasContext.setTransform(1, 0, 0, 1, 0, 0); gasContext.clearRect(0, 0, gasLayer.width, gasLayer.height);
  gasContext.setTransform(v.scale, 0, 0, v.scale, -v.left * v.scale, 0);
  for (const puff of g.gas) {
    if (puff.age < 0) continue;
    const f = puff.age / 1.65, x = puff.x + Math.sin(puff.seed * 2.3 + f * 5) * f * 38, y = sy(puff.y), radius = 20 + f * 70;
    const opacity = Math.min(1, puff.age * 16) * (1 - f);
    const gas = gasContext.createRadialGradient(x, y, 0, x, y, radius); gas.addColorStop(0, `rgba(124,244,61,${opacity * 0.27})`); gas.addColorStop(0.45, `rgba(85,215,52,${opacity * 0.18})`); gas.addColorStop(1, 'rgba(73,190,45,0)');
    gasContext.fillStyle = gas; gasContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // Keep the entire plume translucent, even when several impulses overlap.
  c.save(); c.globalAlpha = 0.65; c.drawImage(gasLayer, v.left, 0, v.w, v.h); c.restore();
  for (const drop of g.drops) {
    c.save(); c.translate(drop.x, sy(drop.y));
    if (drop.hit) { c.globalAlpha = drop.splash / 0.5; c.scale(1.7, 0.35); }
    else c.rotate(Math.sin(drop.age * 9) * 0.16);
    c.font = '34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('💩', 0, 0); c.restore();
  }
  drawHero(c, g, py); floorSpikes(c, sy(g.spikes), g.time, v.left, v.w); c.restore();
}
