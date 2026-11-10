import { FACTORIES, FACTORY_WIDTH, FOODS, factoryLevel, hazardActive, hazardDirection, platformX, type FactoryGame } from './fartFactory';
import { factoryMetal as metal, factoryEllipse as ellipse, factoryGear as gear } from './factoryArt';
import backgroundsUrl from './assets/factory/backgrounds.webp';
import heroUrl from './assets/factory/hero.webp';
import foodsUrl from './assets/factory/foods.webp';

let backgrounds: HTMLImageElement | null = null, hero: HTMLImageElement | null = null, foods: HTMLImageElement | null = null;
export async function loadFactoryArt() {
  const load = async (url: string) => { const image = new Image(); image.src = url; await image.decode(); return image; };
  [backgrounds, hero, foods] = await Promise.all([load(backgroundsUrl), load(heroUrl), load(foodsUrl)]);
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
  const sw = hero.naturalWidth / 4, sh = hero.naturalHeight / 2;
  ellipse(c, g.x, y + 2, 23, 5, '#0008');
  c.save(); c.translate(g.x, y); c.rotate(g.ground === null ? g.vx / 400 * 0.055 : 0);
  c.drawImage(hero, frame % 4 * sw, Math.floor(frame / 4) * sh, sw, sh, -61, -121, 122, 122); c.restore();
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
  const tile = 780;
  for (let row = Math.floor(v.bottom / tile); row <= Math.ceil((v.bottom + v.h) / tile); row++) {
    const level = factoryLevel(Math.max(0, row * tile + tile / 2)), yy = sy((row + 1) * tile);
    if (backgrounds) {
      const sw = backgrounds.naturalWidth / 5, sh = backgrounds.naturalHeight / 2;
      for (let x = Math.floor(v.left / 800) * 800; x < v.left + v.w; x += 800) c.drawImage(backgrounds, level % 5 * sw, Math.floor(level / 5) * sh, sw, sh, x, yy, 800, tile + 1);
    }
    c.fillStyle = '#030a1130'; c.fillRect(v.left, yy, v.w, tile);
    for (let x = 40; x < FACTORY_WIDTH; x += 310) {
      metal(c, x, yy, 12, tile, '#55616b');
      c.strokeStyle = '#0b1117'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 22, yy); c.bezierCurveTo(x + 70, yy + 80, x - 15, yy + 110, x + 28, yy + 260); c.stroke();
      metal(c, x + 15, yy + 370, 11, 170, '#79634d');
      gear(c, x + 20, yy + 465, 30, g.time * 0.2, '#657a85'); c.fillStyle = theme.color; c.fillRect(x - 4, yy + 265, 23, 4);
      glow(c, x + 8, yy + 270, 50, `${theme.color}24`);
    }
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
    if (p.row % 10 === 0) { c.fillStyle = theme.color; c.font = 'bold 17px monospace'; c.textAlign = 'center'; c.fillText(p.row === 100 ? 'SALIDA · 10 FÁBRICAS COMPLETADAS' : `SECTOR ${p.row / 10 + 1} · ${FACTORIES[factoryLevel(p.y)].name.toUpperCase()}`, 800, y + 46); c.textAlign = 'left'; }
    metal(c, x - p.w / 2, y, p.w, 19);
    c.save(); c.beginPath(); c.rect(x - p.w / 2, y + 3, p.w, 5); c.clip();
    for (let k = -p.w / 2; k < p.w / 2; k += 20) { c.fillStyle = '#edbd36'; c.beginPath(); c.moveTo(x + k, y + 3); c.lineTo(x + k + 10, y + 3); c.lineTo(x + k + 4, y + 8); c.lineTo(x + k - 6, y + 8); c.fill(); } c.restore();
    c.strokeStyle = '#50636d'; c.lineWidth = 3;
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(x + side * p.w * 0.42, y + 19); c.lineTo(x + side * p.w * 0.24, y + 39); c.lineTo(x + side * p.w * 0.24, y + 19); c.stroke(); }
    c.fillStyle = '#14212a'; for (let k = -p.w / 2 + 12; k < p.w / 2; k += 12) c.fillRect(x + k, y + 11, 5, 3);
    if (p.moving) { c.strokeStyle = '#adbcc44d'; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(p.x - 90, y + 47); c.lineTo(p.x + 90, y + 47); c.stroke(); c.setLineDash([]); }
    if (!p.eaten) drawFood(c, x, y, p.food, g.time);
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
  if (g.puff > 0) for (let i = 0; i < 10; i++) {
    const f = 1 - g.puff / 0.65, drift = Math.sin(i * 2.3 + f * 4) * (10 + f * 43);
    const x = g.x + drift - g.vx * f * 0.08, y = py - 23 + f * 135 + i * 4, radius = 12 + f * 30 + i * 0.7;
    const gas = c.createRadialGradient(x, y, 0, x, y, radius); gas.addColorStop(0, `rgba(154,190,93,${(1 - f) * 0.11})`); gas.addColorStop(0.45, `rgba(117,163,78,${(1 - f) * 0.07})`); gas.addColorStop(1, 'rgba(102,150,74,0)');
    c.fillStyle = gas; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  drawHero(c, g, py); floorSpikes(c, sy(g.spikes), g.time, v.left, v.w); c.restore();
}
