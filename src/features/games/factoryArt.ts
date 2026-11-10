import { FACTORIES, FACTORY_HEIGHT, FOODS, factoryLevel, hazardActive, platformX, type FactoryGame } from './fartFactory';

function metal(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tint = '#667685') {
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#d6e1e6'); g.addColorStop(0.15, tint); g.addColorStop(0.65, '#26333e'); g.addColorStop(1, '#0b1219');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.strokeStyle = '#aab8bf66'; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.fillStyle = '#c0c9ce'; for (const dx of [5, w - 7]) for (const dy of [5, h - 7]) c.fillRect(x + dx, y + dy, 2, 2);
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function gear(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  c.save(); c.translate(x, y); c.rotate(t);
  const g = c.createRadialGradient(-10, -12, 2, 0, 0, r); g.addColorStop(0, '#dbe2e7'); g.addColorStop(0.55, color); g.addColorStop(1, '#1b242e');
  c.fillStyle = g; c.strokeStyle = '#a0b0ba'; c.lineWidth = 2;
  c.beginPath(); for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, k = i % 4 < 2 ? r : r * 0.82; c.lineTo(Math.cos(a) * k, Math.sin(a) * k); } c.closePath(); c.fill(); c.stroke();
  ellipse(c, 0, 0, r * 0.56, r * 0.56, '#101922');
  for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); metal(c, 0, -5, r * 0.68, 10); c.restore(); }
  ellipse(c, 0, 0, 12, 12, '#91a1ac'); ellipse(c, 0, 0, 5, 5, '#14202c'); c.restore();
}

// Front-facing articulated character, shaded clothing and skin; legs tuck during propulsion.
export function drawFactoryHero(c: CanvasRenderingContext2D, x: number, y: number, time: number, boost: boolean, walking: boolean) {
  c.save(); c.translate(x, y);
  const tuck = boost ? 8 : 0, stride = walking ? Math.sin(time * 15) * 6 : 0;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const skin = c.createLinearGradient(-15, 0, 16, 0); skin.addColorStop(0, '#b5764f'); skin.addColorStop(0.42, '#f3cfaa'); skin.addColorStop(1, '#ce956a');
  c.strokeStyle = '#131a24'; c.lineWidth = 13;
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * 8, -22); c.lineTo(side * (11 + tuck), -12 - tuck + side * stride); c.lineTo(side * 10, -5 - tuck + side * stride); c.stroke();
    c.strokeStyle = skin; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#131a24'; c.lineWidth = 13;
    ellipse(c, side * 10 + 2, -3 - tuck + side * stride, 9, 4, '#111722');
    c.fillStyle = '#d5dfed'; c.fillRect(side * 10 - 6, -2 - tuck + side * stride, 15, 2);
  }
  metal(c, -16, -31 - tuck * 0.2, 32, 14, '#202631');
  const shirt = c.createLinearGradient(-20, -60, 20, -30); shirt.addColorStop(0, '#4387e7'); shirt.addColorStop(0.4, '#1652ab'); shirt.addColorStop(1, '#0a215e');
  c.fillStyle = shirt; c.beginPath(); c.moveTo(-12, -61); c.lineTo(-23, -52); c.lineTo(-18, -42); c.lineTo(-15, -45); c.lineTo(-16, -29); c.quadraticCurveTo(0, -25, 16, -29); c.lineTo(15, -45); c.lineTo(18, -42); c.lineTo(23, -52); c.lineTo(12, -61); c.closePath(); c.fill();
  c.fillStyle = '#f6ca32'; c.fillRect(-15, -49, 30, 9); c.fillStyle = '#ffe58d'; c.fillRect(-15, -49, 30, 2);
  c.strokeStyle = skin; c.lineWidth = 8;
  for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * 20, -46); c.lineTo(side * (boost ? 29 : 22), boost ? -34 : -32); c.lineTo(side * (boost ? 25 : 16), boost ? -44 : -29); c.stroke(); ellipse(c, side * (boost ? 25 : 16), boost ? -44 : -29, 4.5, 5, '#edc49e'); }
  c.fillStyle = skin; c.fillRect(-5, -65, 10, 7); ellipse(c, -13, -75, 4, 6, '#c98e63'); ellipse(c, 13, -75, 4, 6, '#c98e63');
  c.fillStyle = skin; c.beginPath(); c.roundRect(-13, -91, 26, 32, [12, 12, 10, 10]); c.fill();
  c.fillStyle = '#513a30'; c.fillRect(-12, -85, 3, 10); c.fillRect(9, -85, 3, 10);
  for (const side of [-1, 1]) { ellipse(c, side * 6, -78, 3.7, 2.7, '#fff9ee'); ellipse(c, side * 6, -78, 1.6, 2.2, '#253b4b'); c.strokeStyle = '#5b4032'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(side * 3, -83); c.lineTo(side * 10, boost ? -85 : -84); c.stroke(); }
  c.strokeStyle = '#b67d58'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -77); c.lineTo(-2, -70); c.lineTo(2, -70); c.stroke();
  if (boost) ellipse(c, 0, -65, 3, 3, '#653c32'); else { c.strokeStyle = '#774a36'; c.beginPath(); c.moveTo(-4, -65); c.quadraticCurveTo(0, -62, 5, -65); c.stroke(); }
  const cap = c.createLinearGradient(-15, -100, 16, -83); cap.addColorStop(0, '#508dff'); cap.addColorStop(1, '#12346f');
  c.fillStyle = cap; c.beginPath(); c.ellipse(0, -88, 16, 14, 0, Math.PI, Math.PI * 2); c.fill(); ellipse(c, 2, -88, 19, 4, '#174d9b'); ellipse(c, 0, -99, 2, 2, '#f5ce37');
  c.strokeStyle = '#88b4ff66'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -101); c.lineTo(0, -91); c.stroke(); c.restore();
}

function scenery(c: CanvasRenderingContext2D, motif: string, color: string, y: number, time: number) {
  for (const x of [28, 490]) {
    if (motif === 'furnace') { metal(c, x, y, 120, 180, '#736253'); c.fillStyle = '#1b0e09'; c.fillRect(x + 15, y + 35, 90, 115); for (let i = 0; i < 5; i++) ellipse(c, x + 28 + i * 16, y + 115, 12, 25 + Math.sin(time * 6 + i) * 12, i % 2 ? '#ffb636' : '#f65b22'); }
    else if (motif === 'steam' || motif === 'oil' || motif === 'tanks' || motif === 'reactor') {
      metal(c, x + 8, y, 100, 190, motif === 'oil' ? '#554232' : '#657f7c');
      ellipse(c, x + 58, y + 8, 49, 14, '#96a8a6');
      c.fillStyle = '#071c24'; c.fillRect(x + 35, y + 35, 45, 105); c.fillStyle = color; c.globalAlpha = 0.65; c.fillRect(x + 39, y + 67 + Math.sin(time) * 8, 37, 68); c.globalAlpha = 1;
      c.fillStyle = color; c.font = '28px sans-serif'; c.fillText(motif === 'reactor' ? '☢' : motif === 'oil' ? '◆' : '≋', x + 44, y + 170);
      if (motif === 'steam') for (let k = 0; k < 5; k++) { c.globalAlpha = 0.2 * (1 - ((time + k) % 3) / 3); ellipse(c, x + 50 + Math.sin(time + k) * 15, y - ((time + k) % 3) * 30, 18, 15, '#fff'); c.globalAlpha = 1; }
    } else if (motif === 'ice') { metal(c, x, y, 120, 190, '#588ca3'); c.fillStyle = '#b5efff77'; for (let k = 0; k < 7; k++) { c.beginPath(); c.moveTo(x + k * 17, y); c.lineTo(x + k * 17 + 9, y + 45 + k % 3 * 13); c.lineTo(x + k * 17 + 15, y); c.fill(); } c.font = '65px serif'; c.fillStyle = '#cef8ff'; c.fillText('❄', x + 25, y + 130); }
    else if (motif === 'cans') { metal(c, x, y + 150, 130, 25); for (let k = 0; k < 6; k++) { const xx = x + (k * 25 + time * 18) % 110; metal(c, xx, y + 100, 22, 45, '#a78b58'); c.fillStyle = '#c33e29'; c.fillRect(xx + 2, y + 112, 18, 20); } }
    else if (motif === 'power') { metal(c, x, y, 120, 180, '#706389'); for (let k = 0; k < 3; k++) { metal(c, x + 18 + k * 30, y + 40, 16, 100); for (let z = 0; z < 6; z++) { c.fillStyle = color; c.fillRect(x + 14 + k * 30, y + 48 + z * 14, 24, 4); } } }
    else if (motif === 'robots') { metal(c, x + 20, y + 20, 80, 55); ellipse(c, x + 40, y + 47, 6, 6, color); ellipse(c, x + 80, y + 47, 6, 6, color); metal(c, x + 30, y + 85, 60, 65); c.strokeStyle = '#7993a4'; c.lineWidth = 12; c.beginPath(); c.moveTo(x + 25, y + 100); c.lineTo(x + 5, y + 130); c.lineTo(x + 15 + Math.sin(time * 2) * 15, y + 160); c.stroke(); }
    else { c.fillStyle = '#070d24'; c.fillRect(x, y, 120, 190); for (let k = 0; k < 25; k++) { c.fillStyle = k % 2 ? '#f5d6ff' : '#8aacf4'; c.fillRect(x + (k * 37) % 116, y + (k * 61) % 184, 2, 2); } ellipse(c, x + 70, y + 85, 36, 36, '#6053a1'); ellipse(c, x + 61, y + 77, 18, 30, '#9282c5'); }
  }
}

export function drawFactory(c: CanvasRenderingContext2D, g: FactoryGame, width: number, height: number) {
  const scale = width / 640, vh = height / scale;
  c.save(); c.scale(scale, scale);
  const camera = Math.max(0, g.y - vh * 0.38);
  const sy = (y: number) => vh - 80 - (y - camera);
  const theme = FACTORIES[factoryLevel(g.y)];
  c.fillStyle = theme.wall; c.fillRect(0, 0, 640, vh);
  for (let y = Math.floor(camera / 260) * 260; y < camera + vh + 260; y += 260) {
    const yy = sy(y), localTheme = FACTORIES[factoryLevel(y)];
    c.fillStyle = localTheme.wall; c.fillRect(0, yy - 260, 640, 260);
    c.strokeStyle = '#ffffff0a'; c.lineWidth = 1; for (let xx = 0; xx < 640; xx += 80) c.strokeRect(xx, yy - 260, 80, 130);
    scenery(c, localTheme.motif, localTheme.color, yy - 230, g.time);
    metal(c, 0, yy - 10, 640, 14, '#35414c');
  }
  // Depth: dark central shaft, riveted columns, pipes and warning lights.
  const shadow = c.createLinearGradient(0, 0, 640, 0); shadow.addColorStop(0, '#00000011'); shadow.addColorStop(0.26, '#00000060'); shadow.addColorStop(0.5, '#00000090'); shadow.addColorStop(0.74, '#00000060'); shadow.addColorStop(1, '#00000011'); c.fillStyle = shadow; c.fillRect(0, 0, 640, vh);
  for (const x of [5, 617]) { metal(c, x, 0, 18, vh, '#50606d'); for (let y = -camera % 80; y < vh; y += 80) { c.fillStyle = theme.color; c.fillRect(x + 4, y, 10, 3); } }
  for (const p of g.platforms) {
    const y = sy(p.y); if (y < -100 || y > vh + 100) continue;
    const x = platformX(p, g.time);
    if (p.id % 10 === 0) { c.fillStyle = theme.color; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillText(p.id === 100 ? 'SORTIE / SALIDA' : `SECTOR ${Math.floor(p.id / 10) + 1} · ${FACTORIES[factoryLevel(p.y)].name.toUpperCase()}`, 320, y + 54); c.textAlign = 'left'; }
    metal(c, x - p.w / 2, y, p.w, 19, '#7b8287');
    c.save(); c.beginPath(); c.rect(x - p.w / 2, y + 4, p.w, 6); c.clip(); for (let k = -p.w / 2; k < p.w / 2; k += 18) { c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(x + k, y + 4); c.lineTo(x + k + 9, y + 4); c.lineTo(x + k + 3, y + 10); c.lineTo(x + k - 6, y + 10); c.fill(); } c.restore();
    if (p.moving) { c.strokeStyle = '#8da4b233'; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(p.x - 80, y + 28); c.lineTo(p.x + 80, y + 28); c.stroke(); c.setLineDash([]); }
    if (!p.eaten) { const bob = Math.sin(g.time * 3 + p.id) * 3; ellipse(c, x, y - 11, 17, 4, '#0008'); c.font = '27px sans-serif'; c.textAlign = 'center'; c.fillText(FOODS[p.food].icon, x, y - 16 + bob); c.textAlign = 'left'; }
  }
  for (const h of g.hazards) {
    const y = sy(h.y); if (y < -120 || y > vh + 120) continue;
    const active = hazardActive(h, g.time), dir = h.x < 320 ? 1 : -1;
    if (h.kind === 'gear') gear(c, h.x, y, 43, g.time * (dir + 0.4), theme.color);
    if (h.kind === 'spikes') { metal(c, h.x - 42, y + 8, 84, 12); for (let i = -40; i < 40; i += 16) { c.fillStyle = '#bccbd4'; c.beginPath(); c.moveTo(h.x + i, y + 8); c.lineTo(h.x + i + 8, y - 15); c.lineTo(h.x + i + 16, y + 8); c.fill(); } }
    if (h.kind === 'laser' || h.kind === 'fire') {
      metal(c, h.x - 15, y - 20, 30, 40); ellipse(c, h.x, y, 7, 7, active ? '#ff4e41' : '#fcd34d');
      c.strokeStyle = active ? '#ff5757' : '#ef44443a'; c.lineWidth = active ? 7 : 1; c.beginPath(); c.moveTo(h.x, y); c.lineTo(h.x + dir * 138, y); c.stroke();
      if (active && h.kind === 'fire') for (let k = 0; k < 9; k++) { const f = (g.time * 4 + k / 9) % 1; c.globalAlpha = 1 - f; ellipse(c, h.x + dir * f * 135, y + Math.sin(k * 4 + g.time * 20) * 10, 12 + f * 16, 8 + f * 13, k % 2 ? '#ffda5a' : '#fb6325'); } c.globalAlpha = 1;
      if (active && h.kind === 'laser') { c.strokeStyle = '#ffe9df'; c.lineWidth = 2; c.beginPath(); c.moveTo(h.x, y); c.lineTo(h.x + dir * 138, y); c.stroke(); }
    }
    if (h.kind === 'door') { metal(c, h.x - 55, y - 80, 110, 12); const amount = active ? 130 : 20 + Math.max(0, Math.sin((g.time + h.phase) * 3)) * 10; metal(c, h.x - 52, y - 68, 104, amount, '#8b7861'); c.fillStyle = active ? '#f87171' : '#4ade80'; c.fillRect(h.x - 25, y - 76, 50, 4); }
  }
  const py = sy(g.y);
  if (g.puff > 0) for (let i = 0; i < 8; i++) { const f = 1 - g.puff / 0.32; c.globalAlpha = (1 - f) * 0.5; ellipse(c, g.x + Math.sin(i * 3) * f * 42, py + 5 + f * 95 + i * 3, 10 + f * 23, 8 + f * 16, FOODS[g.food].color); } c.globalAlpha = 1;
  drawFactoryHero(c, g.x, py, g.time, g.puff > 0, g.vx !== 0 && g.ground !== null);
  const spikesY = sy(g.spikes);
  if (spikesY < vh + 60) { const glow = c.createLinearGradient(0, spikesY - 60, 0, spikesY + 30); glow.addColorStop(0, '#fb323200'); glow.addColorStop(1, '#fb323299'); c.fillStyle = glow; c.fillRect(0, spikesY - 60, 640, vh); metal(c, 0, spikesY + 10, 640, Math.max(20, vh - spikesY), '#774342'); for (let x = 0; x < 640; x += 24) { c.fillStyle = '#d7c5c5'; c.beginPath(); c.moveTo(x, spikesY + 15); c.lineTo(x + 12, spikesY - 15); c.lineTo(x + 24, spikesY + 15); c.fill(); } }
  const progress = (g.highest % FACTORY_HEIGHT) / FACTORY_HEIGHT;
  c.fillStyle = '#ffffff18'; c.fillRect(633, 35, 3, vh - 70); c.fillStyle = theme.color; c.fillRect(633, vh - 35 - progress * (vh - 70), 3, progress * (vh - 70));
  c.restore();
}
