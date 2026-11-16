import type { GibKind } from './kombat';
import { boneShaft, ribCage } from './vampyriumChars';
import type { PenMatch } from './kombatPenalties';

const TAU = Math.PI * 2;
function drawHumanSkull(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const vault = () => { ctx.beginPath(); ctx.moveTo(-0.174, 0.015); ctx.bezierCurveTo(-0.23, -0.13, -0.145, -0.228, -0.025, -0.22); ctx.bezierCurveTo(0.115, -0.228, 0.205, -0.16, 0.193, -0.055); ctx.lineTo(0.174, 0.045); ctx.lineTo(0.119, 0.089); ctx.lineTo(0.092, 0.133); ctx.lineTo(-0.092, 0.13); ctx.lineTo(-0.118, 0.078); ctx.lineTo(-0.166, 0.049); ctx.closePath(); };
  const ivory = ctx.createRadialGradient(-0.085, -0.13, 0.015, 0.045, -0.035, 0.25); ivory.addColorStop(0, '#e7dfcb'); ivory.addColorStop(0.32, '#c3b69b'); ivory.addColorStop(0.65, '#92846b'); ivory.addColorStop(1, '#42382d');
  // Mandíbula independiente: rama ascendente, ángulo goníaco y mentón, con hueco bajo los dientes.
  ctx.fillStyle = '#4b4032'; ctx.beginPath(); ctx.moveTo(-0.157, 0.015); ctx.lineTo(-0.142, 0.146); ctx.quadraticCurveTo(-0.12, 0.219, -0.035, 0.227); ctx.quadraticCurveTo(0.092, 0.238, 0.14, 0.149); ctx.lineTo(0.165, 0.017); ctx.lineTo(0.13, 0.028); ctx.lineTo(0.106, 0.136); ctx.quadraticCurveTo(0.005, 0.188, -0.108, 0.13); ctx.lineTo(-0.125, 0.023); ctx.closePath(); ctx.fill();
  const jaw = ctx.createLinearGradient(-0.13, 0.12, 0.14, 0.22); jaw.addColorStop(0, '#c7bba1'); jaw.addColorStop(0.5, '#95866c'); jaw.addColorStop(1, '#4a3e30'); ctx.fillStyle = jaw;
  ctx.beginPath(); ctx.moveTo(-0.14, 0.048); ctx.lineTo(-0.121, 0.153); ctx.quadraticCurveTo(-0.04, 0.233, 0.073, 0.19); ctx.lineTo(0.122, 0.139); ctx.lineTo(0.143, 0.054); ctx.lineTo(0.119, 0.064); ctx.lineTo(0.093, 0.146); ctx.quadraticCurveTo(-0.01, 0.192, -0.096, 0.143); ctx.lineTo(-0.112, 0.057); ctx.closePath(); ctx.fill();
  vault(); ctx.fillStyle = ivory; ctx.fill();
  ctx.save(); vault(); ctx.clip();
  // Material mate: variaciones minerales y poros diminutos, dentro de la silueta del hueso.
  for (let i = 0; i < 85; i++) { const x = Math.sin(i * 15.17) * 0.21, y = -0.05 + Math.cos(i * 9.31) * 0.18; ctx.fillStyle = i % 3 ? 'rgba(65,49,33,0.16)' : 'rgba(242,230,199,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 0.001 + i % 4 * 0.0006, 0.0009, i, 0, TAU); ctx.fill(); }
  const temple = ctx.createLinearGradient(-0.2, 0, 0.2, 0); temple.addColorStop(0, 'rgba(28,21,16,0.5)'); temple.addColorStop(0.25, 'rgba(70,53,37,0)'); temple.addColorStop(0.65, 'rgba(70,53,37,0)'); temple.addColorStop(1, 'rgba(23,19,16,0.65)'); ctx.fillStyle = temple; ctx.fillRect(-0.23, -0.23, 0.46, 0.4);
  ctx.restore();
  // Suturas coronal y sagital quebradas, sin borde negro alrededor del cráneo.
  ctx.strokeStyle = 'rgba(68,53,36,0.48)'; ctx.lineWidth = 0.0022;
  ctx.beginPath(); for (let i = 0; i < 22; i++) ctx.lineTo(-0.15 + i * 0.014, -0.125 + Math.sin(i * 2.4) * 0.004 + Math.sin(i * 0.25) * 0.02); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i < 13; i++) ctx.lineTo(0.01 + Math.sin(i * 2.3) * 0.003, -0.22 + i * 0.007); ctx.stroke();
  for (const side of [-1, 1]) {
    const x = side * 0.073, y = -0.018;
    // Cavidades orbitarias irregulares bajo el reborde supraorbitario, con profundidad y oclusión.
    const socket = ctx.createRadialGradient(x + side * 0.015, y + 0.02, 0.008, x, y, 0.067); socket.addColorStop(0, '#080806'); socket.addColorStop(0.7, '#201d17'); socket.addColorStop(1, '#5b4d39'); ctx.fillStyle = socket;
    ctx.beginPath(); ctx.moveTo(x - 0.052, y - 0.026); ctx.quadraticCurveTo(x - 0.015, y - 0.054, x + 0.04, y - 0.033); ctx.lineTo(x + 0.055, y + 0.008); ctx.quadraticCurveTo(x + 0.024, y + 0.064, x - 0.029, y + 0.051); ctx.lineTo(x - 0.052, y + 0.025); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(221,209,177,0.75)'; ctx.lineWidth = 0.007; ctx.beginPath(); ctx.moveTo(x - 0.05, y - 0.027); ctx.quadraticCurveTo(x, y - 0.055, x + 0.04, y - 0.034); ctx.stroke();
    // Pómulo y arco cigomático: una cresta iluminada sobre el hueco de la mejilla.
    ctx.fillStyle = 'rgba(49,36,25,0.8)'; ctx.beginPath(); ctx.moveTo(side * 0.16, 0.028); ctx.lineTo(side * 0.108, 0.055); ctx.lineTo(side * 0.12, 0.105); ctx.lineTo(side * 0.146, 0.072); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c5b797'; ctx.lineWidth = 0.009; ctx.beginPath(); ctx.moveTo(side * 0.178, 0.002); ctx.quadraticCurveTo(side * 0.158, 0.05, side * 0.108, 0.056); ctx.stroke();
  }
  ctx.fillStyle = '#191711'; ctx.beginPath(); ctx.moveTo(0, 0.012); ctx.bezierCurveTo(-0.009, 0.025, -0.021, 0.058, -0.023, 0.077); ctx.lineTo(-0.004, 0.071); ctx.lineTo(0.005, 0.078); ctx.lineTo(0.026, 0.072); ctx.quadraticCurveTo(0.019, 0.04, 0, 0.012); ctx.fill();
  // Maxilar y dientes individuales: incisivos planos y molares anchos, sin colmillos.
  ctx.fillStyle = '#5c4e39'; ctx.beginPath(); ctx.ellipse(0, 0.12, 0.097, 0.02, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 10; i++) {
    const x = -0.085 + i * 0.018, y = 0.108 + Math.abs(i - 4.5) * 0.0018, tooth = ctx.createLinearGradient(x, y, x + 0.014, y + 0.03); tooth.addColorStop(0, '#d7cbb1'); tooth.addColorStop(0.4, '#e4dcc7'); tooth.addColorStop(1, '#88785e');
    ctx.fillStyle = tooth; ctx.beginPath(); ctx.roundRect(x, y, 0.015, 0.029 - Math.abs(i - 4.5) * 0.001, 0.003); ctx.fill();
    ctx.fillStyle = '#b6a88c'; ctx.beginPath(); ctx.roundRect(x + 0.002, 0.153 + Math.abs(i - 4.5) * 0.001, 0.013, 0.019, 0.003); ctx.fill();
  }
  ctx.restore();
}
// Diámetro de referencia 0.4: conserva el tamaño máximo de la cabeza al salir el cráneo.
export function drawPenGib(ctx: CanvasRenderingContext2D, kind: GibKind, color: string, seed: number) {
  if (kind === 'skull') {
    drawHumanSkull(ctx);
    return;
  }
  if (kind === 'bone') { boneShaft(ctx, [-0.19, -0.03], [0.18, 0.025], 0.043); return; }
  if (kind === 'ribs') { ribCage(ctx, 0, -0.2, 0.21, 0.44, 8); return; }
  const g = ctx.createLinearGradient(-0.2, -0.2, 0.22, 0.2);
  if (kind === 'chunk') { g.addColorStop(0, '#9c3540'); g.addColorStop(0.4, '#65131f'); g.addColorStop(1, '#21070d'); }
  else if (kind === 'plate' || kind === 'shirt') { g.addColorStop(0, '#d9dde1'); g.addColorStop(0.4, color); g.addColorStop(1, '#141721'); }
  else { g.addColorStop(0, '#f4eddb'); g.addColorStop(0.4, '#cbbd9d'); g.addColorStop(1, '#695039'); }
  ctx.fillStyle = g; ctx.strokeStyle = kind === 'chunk' ? '#30040b' : '#36291e'; ctx.lineWidth = 0.012;
  ctx.beginPath();
  if (kind === 'jaw') {
    ctx.moveTo(-0.18, -0.1); ctx.lineTo(-0.14, 0.09); ctx.bezierCurveTo(-0.08, 0.21, 0.14, 0.18, 0.18, 0.04); ctx.lineTo(0.18, -0.1); ctx.lineTo(0.12, -0.07); ctx.lineTo(0.1, 0.04); ctx.quadraticCurveTo(0, 0.13, -0.09, 0.04); ctx.lineTo(-0.12, -0.09);
  } else if (kind === 'pelvis') {
    ctx.moveTo(0, -0.06); ctx.bezierCurveTo(-0.12, -0.24, -0.29, -0.14, -0.21, 0.06); ctx.lineTo(-0.1, 0.18); ctx.quadraticCurveTo(0, 0.09, 0.1, 0.18); ctx.lineTo(0.21, 0.06); ctx.bezierCurveTo(0.29, -0.14, 0.12, -0.24, 0, -0.06);
  } else {
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, r = 0.1 + 0.045 * Math.sin(i * 2.7 + seed); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.2); }
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (kind === 'pelvis') { ctx.fillStyle = '#32231b'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 0.105, 0.045, 0.045, 0.06, side * 0.3, 0, TAU); ctx.fill(); } }
  if (kind === 'jaw') { ctx.fillStyle = '#e9dfc9'; for (let i = 0; i < 7; i++) { ctx.fillRect(-0.095 + i * 0.029, -0.012, 0.021, 0.045); } }
  // Fibras húmedas, fracturas y pequeñas irregularidades, sin contornos gruesos.
  ctx.strokeStyle = kind === 'chunk' ? 'rgba(220,107,113,0.55)' : 'rgba(255,248,227,0.45)'; ctx.lineWidth = 0.005;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.07 + i * 0.04, -0.05); ctx.quadraticCurveTo(-0.09 + i * 0.04, 0, -0.03 + i * 0.03, 0.065); ctx.stroke(); }
}

export function drawPenBlood(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, speed: number) {
  const stretch = 1 + Math.min(2.8, speed / 650);
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.15, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#be3443'); g.addColorStop(0.35, '#880d20'); g.addColorStop(1, '#39030d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * stretch, r * 0.64, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(110,8,21,0.45)'; ctx.lineWidth = Math.max(0.6, r * 0.45); ctx.beginPath(); ctx.moveTo(-r * stretch, 0); ctx.lineTo(-r * (stretch + Math.min(7, speed / 180)), 0); ctx.stroke();
  ctx.restore();
}

export function drawPenScreenBlood(ctx: CanvasRenderingContext2D, blood: PenMatch['screenBlood'], w: number, h: number) {
  for (const b of blood) {
    if (b.t < 0) continue;
    const fade = Math.min(1, b.t * 15) * Math.max(0, 1 - b.t / 4.5), r = b.r * Math.min(w, h), x = b.x * w, y = b.y * h;
    ctx.save(); ctx.globalAlpha = fade * 0.7;
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, 0, x, y, r * 1.4); g.addColorStop(0, 'rgba(98,4,20,0.8)'); g.addColorStop(0.6, 'rgba(66,1,13,0.75)'); g.addColorStop(1, 'rgba(25,0,6,0.4)'); ctx.fillStyle = g;
    ctx.beginPath(); for (let i = 0; i < 35; i++) { const a = i / 35 * TAU, rr = r * (0.5 + 0.5 * Math.pow(Math.sin(i * 6.7 + b.seed), 2)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(62,0,10,0.7)'; ctx.lineCap = 'round';
    for (let i = 0; i < b.drips; i++) { const xx = x + Math.sin(i * 11 + b.seed) * r * 0.65, length = r * (0.4 + Math.min(1.4, b.t * 0.45)) * (0.4 + (i % 3) * 0.3); ctx.lineWidth = Math.max(0.7, r * (0.025 + i % 3 * 0.015)); ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + length); ctx.stroke(); }
    ctx.restore();
  }
}
