// Los monstruos de cada escenario de Gravity Swap (el pez abisal del 1 y los gusanos del 2 están en
// gravityBackdrops y gravityArt). Todos dibujados a mano con el mismo estilo que el resto del juego (borde
// oscuro, volumen con luz de arriba a la izquierda, brillos) y animados: alas que aletean, patas que caminan,
// mandíbulas que se abren, electricidad que chisporrotea, luces que laten. Se dibujan mirando a la derecha,
// centrados en (0, 0) y midiendo más o menos 1,4 casilleros; quien los llama los da vuelta e inclina.
// "angry": ya te vio y te persigue (abre más la boca, aletea más rápido, brillan más los ojos).

export const P = 1 / 32; // un píxel, en casilleros
export const INK = '#0a0a16';
const TAU = Math.PI * 2;
type Pt = [number, number];

function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const lighten = (c: string, k: number) => mix(c, '#ffffff', k);
const darken = (c: string, k: number) => mix(c, '#000000', k);
export function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}
export function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(color, 0.5)); g.addColorStop(0.45, color); g.addColorStop(1, darken(color, 0.6));
  return g;
}
export function ink(ctx: CanvasRenderingContext2D, path: () => void, fill: string | CanvasGradient, width = 2) {
  ctx.beginPath(); path();
  ctx.lineWidth = width * P; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}
export function limb(ctx: CanvasRenderingContext2D, pts: Pt[], color: string | CanvasGradient, width: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[INK, width + 2.2 * P], [color, width]] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
}
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, TAU);
// Ojo que brilla: globo de color con pupila y reflejo.
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, power: number) {
  glow(ctx, x, y, r * 3, color, 0.45 * power);
  ink(ctx, circle(ctx, x, y, r), ball(ctx, x, y, r, color), 1);
  ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); ctx.fill();
}
// Colmillos en fila, de (x0, y) a (x1, y), para abajo (dir 1) o para arriba (dir -1).
function fangs(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, n: number, len: number, dir: number, color = '#f5ecd2') {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n, l = len * (0.6 + 0.4 * Math.sin(i * 2.3 + 1) ** 2), w = Math.abs(x1 - x0) / n * 0.45;
    ink(ctx, () => { ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.2, y + dir * l * 0.6, x + w * 0.3, y + dir * l); ctx.lineTo(x + w, y); ctx.closePath(); }, lin(ctx, 0, y, 0, y + dir * l, [[0, color], [1, '#d6c8a0']]), 1);
  }
}
// Babas que cuelgan y gotean.
function drool(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, t: number, seed: number) {
  const k = (t * 0.7 + seed * 0.37) % 1, l = len * (0.4 + k * 0.6);
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 1.6 * P;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(t * 3 + seed) * 0.02, y + l * 0.5, x, y + l); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y + l, 2 * P, 0, TAU); ctx.fill();
  if (k > 0.85) { ctx.beginPath(); ctx.arc(x, y + l + (k - 0.85) * 2, 1.5 * P, 0, TAU); ctx.fill(); } // la gota que se suelta
}
// Un rayo eléctrico quebrado entre dos puntos (cambia en cada cuadro).
export function zap(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color = '#7dd3fc') {
  const pts: Pt[] = [a];
  for (let i = 1; i < 6; i++) { const k = i / 6; pts.push([a[0] + (b[0] - a[0]) * k + (Math.random() - 0.5) * 0.12, a[1] + (b[1] - a[1]) * k + (Math.random() - 0.5) * 0.12]); }
  pts.push(b);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[color, 3 * P], ['#ffffff', 1.1 * P]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
}
// Una pata articulada con espinas: de la cadera, por la rodilla, hasta la punta (con garra).
function spinyLeg(ctx: CanvasRenderingContext2D, hip: Pt, knee: Pt, foot: Pt, color: string, width: number, spine = '#c2410c') {
  limb(ctx, [hip, knee, foot], lin(ctx, hip[0], hip[1], foot[0], foot[1], [[0, lighten(color, 0.15)], [1, darken(color, 0.35)]]), width);
  for (const [a, b] of [[hip, knee], [knee, foot]] as const) for (const k of [0.35, 0.7]) { // espinas cortas
    const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ink(ctx, () => { ctx.moveTo(x - dx / l * width * 0.25, y - dy / l * width * 0.25); ctx.lineTo(x + nx * width * 0.95 + dx / l * width * 0.35, y + ny * width * 0.95 + dy / l * width * 0.35); ctx.lineTo(x + dx / l * width * 0.25, y + dy / l * width * 0.25); ctx.closePath(); }, spine, 0.8);
  }
  const dx = foot[0] - knee[0], dy = foot[1] - knee[1], l = Math.hypot(dx, dy) || 1;
  ink(ctx, () => { ctx.moveTo(foot[0] - dy / l * width * 0.5, foot[1] + dx / l * width * 0.5); ctx.quadraticCurveTo(foot[0] + dx / l * width * 2.2, foot[1] + dy / l * width * 2.2, foot[0] + dx / l * width * 1.4 + dy / l * width, foot[1] + dy / l * width * 1.4 - dx / l * width); ctx.lineTo(foot[0] + dy / l * width * 0.5, foot[1] - dx / l * width * 0.5); ctx.closePath(); }, '#e7d9b8', 1); // garra
}
// Ala traslúcida con nervaduras: sale de (0,0) hacia atrás y arriba; "open" 0..1 la abre (aleteo).
function wing(ctx: CanvasRenderingContext2D, len: number, open: number, tint: string, vein: string, holes = false) {
  ctx.save(); ctx.rotate(-0.25 - open * 1.1); ctx.scale(1, 0.35 + open * 0.65);
  const path = () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(-len * 0.3, -len * 0.42, -len * 0.85, -len * 0.38, -len, -len * 0.12); ctx.bezierCurveTo(-len * 0.8, len * 0.12, -len * 0.3, len * 0.12, 0, 0); };
  ctx.beginPath(); path(); ctx.fillStyle = tint; ctx.fill();
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  ctx.strokeStyle = vein; ctx.lineWidth = 1 * P;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-len * 0.4, -len * (0.25 - k * 0.06), -len * (1 - k * 0.05), -len * (0.25 - k * 0.075)); ctx.stroke(); }
  for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-len * k * 0.2, -len * 0.35); ctx.lineTo(-len * k * 0.2 - len * 0.05, len * 0.1); ctx.stroke(); }
  if (holes) { ctx.globalCompositeOperation = 'destination-out'; for (const [hx, hy, hr] of [[-0.6, -0.15, 0.05], [-0.78, -0.05, 0.035], [-0.45, 0.0, 0.03]] as const) { ctx.beginPath(); ctx.arc(len * hx, len * hy, len * hr, 0, TAU); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
  const sheen = ctx.createLinearGradient(0, -len * 0.4, -len, 0); sheen.addColorStop(0, 'rgba(255,255,255,0.35)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = sheen; ctx.fillRect(-len, -len, len, len * 1.5);
  ctx.restore();
  ctx.beginPath(); path(); ctx.strokeStyle = darken(vein, 0.3); ctx.lineWidth = 1.4 * P; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- 3: Robot asesino
// Como el astronauta, pero de metal negro: casco con visor de ojos rojos, antena, mochila con propulsores
// (fuego azul), brazos y piernas articulados que se balancean, y electricidad que le chisporrotea encima.
export function drawRobot(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const s = Math.sin(t * 6), drift = Math.sin(t * 2.2);
  const METAL = '#3a3f4b', DARK = '#1b1e26', RED = '#ff2a2a';
  ctx.save(); ctx.scale(1.25, 1.25); ctx.rotate(drift * 0.08);
  // Llamas de los propulsores (atrás y abajo).
  for (const [x, y] of [[-0.33, 0.24], [-0.22, 0.24]] as const) {
    const L = 0.22 + Math.random() * 0.08 + (angry ? 0.08 : 0);
    const f = ctx.createLinearGradient(x, y, x - 0.08, y + L); f.addColorStop(0, '#e0f2fe'); f.addColorStop(0.4, '#38bdf8'); f.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(x - 0.035, y); ctx.lineTo(x - 0.06, y + L); ctx.lineTo(x + 0.035, y); ctx.fill();
  }
  const armP = (sx: number, sy: number, ph: number): Pt[] => [[sx, sy], [sx + 0.06 + ph * 0.05, sy + 0.12], [sx + 0.16 + ph * 0.06, sy + 0.18 - ph * 0.04]];
  const legP = (hx: number, ph: number): Pt[] => [[hx, 0.16], [hx + 0.04 + ph * 0.05, 0.3], [hx - 0.04 + ph * 0.08, 0.43]];
  limb(ctx, armP(-0.1, -0.06, -s), METAL, 0.11); // brazo de atrás
  ink(ctx, () => ctx.roundRect(-0.38, -0.24, 0.22, 0.46, 0.04), lin(ctx, -0.38, 0, -0.16, 0, [[0, '#2a2e38'], [0.5, '#5b6272'], [1, '#2a2e38']])); // mochila
  ctx.fillStyle = RED; for (let k = 0; k < 3; k++) ctx.fillRect(-0.34, -0.16 + k * 0.08, 0.14, P * 1.5);
  ink(ctx, () => ctx.rect(-0.36, 0.2, 0.08, 0.05), DARK, 1); ink(ctx, () => ctx.rect(-0.25, 0.2, 0.08, 0.05), DARK, 1);
  limb(ctx, legP(-0.06, -s), METAL, 0.13);
  // Torso blindado con placas y una luz roja que late en el pecho.
  ink(ctx, () => ctx.roundRect(-0.2, -0.17, 0.4, 0.38, 0.08), lin(ctx, -0.2, -0.17, 0.2, 0.2, [[0, '#6b7280'], [0.5, METAL], [1, DARK]]));
  ctx.strokeStyle = '#11131a'; ctx.lineWidth = P; ctx.beginPath(); ctx.moveTo(-0.2, 0.05); ctx.lineTo(0.2, 0.05); ctx.moveTo(0, -0.17); ctx.lineTo(0, 0.05); ctx.stroke();
  ctx.fillStyle = '#9ca3af'; for (const [x, y] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.15], [0.15, 0.15]] as const) { ctx.beginPath(); ctx.arc(x, y, 1.3 * P, 0, TAU); ctx.fill(); } // remaches
  const beat = 0.6 + 0.4 * Math.abs(Math.sin(t * (angry ? 9 : 4)));
  glow(ctx, 0.06, -0.06, 0.14, RED, 0.6 * beat); ink(ctx, circle(ctx, 0.06, -0.06, 0.045), ball(ctx, 0.06, -0.06, 0.045, RED), 1);
  limb(ctx, legP(0.06, s), METAL, 0.13);
  for (const f of [legP(-0.06, -s)[2], legP(0.06, s)[2]]) ink(ctx, () => ctx.roundRect(f[0] - 0.08, f[1] - 0.04, 0.18, 0.08, 0.03), DARK, 1.2); // botas
  // Cabeza: casco de metal con visor negro y dos ojos rojos.
  ink(ctx, () => ctx.ellipse(0.02, -0.12, 0.15, 0.045, 0, 0, TAU), '#4b5563', 1.5);
  ink(ctx, circle(ctx, 0.02, -0.31, 0.24), ball(ctx, 0.02, -0.31, 0.24, '#4b5563'));
  limb(ctx, [[-0.12, -0.45], [-0.17, -0.6]], '#6b7280', P * 1.5);
  ink(ctx, circle(ctx, -0.17, -0.61, 0.025), Math.sin(t * 8) > 0 ? RED : '#7f1d1d', 1);
  ink(ctx, () => ctx.roundRect(-0.02, -0.4, 0.24, 0.15, 0.05), '#05060a', 2);
  for (const ex of [0.05, 0.15]) eye(ctx, ex, -0.33, 0.035, RED, angry ? 1.4 : 1);
  ctx.fillStyle = '#ffffff22'; ctx.fillRect(0.0, -0.39, 0.2, 0.02);
  ctx.strokeStyle = '#11131a'; ctx.lineWidth = P; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.02 + k * 0.05, -0.2); ctx.lineTo(0.02 + k * 0.05, -0.15); ctx.stroke(); } // rejilla de la boca
  limb(ctx, armP(0.12, -0.06, s), METAL, 0.11); // brazo de adelante
  const hand = armP(0.12, -0.06, s)[2];
  ink(ctx, circle(ctx, hand[0], hand[1], 0.05), ball(ctx, hand[0], hand[1], 0.05, '#6b7280'), 1.2);
  // Electricidad: rayos que saltan por el cuerpo y de la mano.
  ctx.globalCompositeOperation = 'lighter';
  if (Math.random() < (angry ? 0.9 : 0.5)) zap(ctx, [hand[0], hand[1]], [hand[0] + 0.1 + Math.random() * 0.15, hand[1] + (Math.random() - 0.5) * 0.3]);
  if (Math.random() < 0.6) zap(ctx, [-0.2 + Math.random() * 0.1, -0.15], [0.2, 0.15 + Math.random() * 0.1]);
  if (Math.random() < 0.4) zap(ctx, [-0.1, -0.5], [0.15, -0.45 + Math.random() * 0.1]);
  glow(ctx, 0, 0, 0.6, '#38bdf8', angry ? 0.25 : 0.12);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ---------------------------------------------------------------- 4: Cucaracha voladora
// Cuerpo marrón brillante con el abdomen en anillos, el escudo (pronoto) sobre la cabeza, antenas largas que
// se mueven, seis patas con espinas que patalean, mandíbulas con dientes y las alas: los élitros duros y las
// alas traslúcidas ámbar que aletean muy rápido.
export function drawRoach(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const flap = Math.sin(t * (angry ? 38 : 28)), BODY = '#5a2410', SHELL = '#7a3418';
  ctx.save(); ctx.scale(1.15, 1.15);
  ctx.save(); ctx.translate(-0.05, -0.14); wing(ctx, 0.9, 0.5 + flap * 0.5, 'rgba(214,170,110,0.25)', '#8b5a2b'); ctx.restore(); // ala de atrás
  // patas de atrás
  for (let i = 0; i < 3; i++) { const ph = Math.sin(t * 9 + i * 2.1); spinyLeg(ctx, [-0.18 + i * 0.16, 0.06], [-0.32 + i * 0.2 + ph * 0.05, 0.26], [-0.42 + i * 0.22 + ph * 0.08, 0.46], darken(BODY, 0.2), 0.045); }
  // abdomen en anillos
  ink(ctx, () => ctx.ellipse(-0.18, 0.05, 0.44, 0.24, 0.08, 0, TAU), lin(ctx, 0, -0.16, 0, 0.24, [[0, '#8a4a22'], [0.5, BODY], [1, '#2a0f06']]));
  ctx.strokeStyle = '#2a0f06'; ctx.lineWidth = 1.3 * P;
  for (let k = 0; k < 6; k++) { const x = -0.48 + k * 0.1; ctx.beginPath(); ctx.ellipse(x, 0.06, 0.04, 0.16 - Math.abs(k - 2.5) * 0.02, 0, -1.3, 1.3); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.beginPath(); ctx.ellipse(-0.2, -0.08, 0.26, 0.04, 0.05, 0, TAU); ctx.fill(); // brillo
  // élitro duro (por encima del abdomen) que se levanta con el aleteo
  ctx.save(); ctx.translate(0.08, -0.1); ctx.rotate(-0.15 - (flap * 0.5 + 0.5) * 0.25);
  ink(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.3, -0.12, -0.62, 0.02); ctx.quadraticCurveTo(-0.32, 0.1, 0, 0.06); ctx.closePath(); }, lin(ctx, 0, -0.1, 0, 0.08, [[0, '#b0582a'], [1, '#4a1a08']]), 1.5);
  ctx.strokeStyle = '#3a1406'; ctx.lineWidth = P; ctx.beginPath(); ctx.moveTo(-0.05, 0.02); ctx.quadraticCurveTo(-0.3, -0.04, -0.55, 0.02); ctx.stroke();
  ctx.restore();
  // pronoto (el escudo) y cabeza
  ink(ctx, () => ctx.ellipse(0.2, -0.04, 0.17, 0.14, -0.3, 0, TAU), lin(ctx, 0.05, -0.15, 0.3, 0.1, [[0, '#c0703a'], [0.5, SHELL], [1, '#3a1406']]));
  ink(ctx, () => ctx.ellipse(0.36, 0.04, 0.12, 0.1, 0.4, 0, TAU), ball(ctx, 0.36, 0.04, 0.12, '#6b2e14'));
  eye(ctx, 0.4, -0.01, 0.045, '#1a1a1a', 0.2); glow(ctx, 0.4, -0.01, 0.06, '#ffffff', 0.1);
  // mandíbulas que se abren y cierran, con dientes
  const open = (angry ? 0.35 : 0.15) * (0.5 + 0.5 * Math.sin(t * 7));
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(0.45, 0.1); ctx.rotate(sgn * open);
    ink(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.1, sgn * 0.02, 0.14, sgn * 0.06); ctx.quadraticCurveTo(0.07, sgn * 0.05, 0, sgn * 0.04); ctx.closePath(); }, '#3a1406', 1.2);
    ctx.restore();
  }
  fangs(ctx, 0.44, 0.56, 0.1, 4, 0.05 + open * 0.08, 1);
  if (angry) { ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.ellipse(0.52, 0.13, 0.03, 0.015 + open * 0.03, 0, 0, TAU); ctx.fill(); } // lengua
  // antenas largas que se mueven
  for (const k of [0, 1]) {
    const w1 = Math.sin(t * 3 + k * 2) * 0.12, w2 = Math.sin(t * 2.3 + k) * 0.15;
    ctx.strokeStyle = '#4a1a08'; ctx.lineWidth = 1.6 * P; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.42, -0.06); ctx.bezierCurveTo(0.55, -0.4 + w1, 0.75, -0.55 + w2, 0.95 + k * 0.1, -0.35 + w2 + k * 0.1); ctx.stroke();
  }
  // patas de adelante (pataleando)
  for (let i = 0; i < 3; i++) { const ph = Math.sin(t * 9 + i * 2.1 + Math.PI); spinyLeg(ctx, [-0.1 + i * 0.16, 0.1], [-0.2 + i * 0.22 + ph * 0.06, 0.3], [-0.28 + i * 0.26 + ph * 0.1, 0.52], BODY, 0.05); }
  ctx.save(); ctx.translate(0.02, -0.16); wing(ctx, 0.95, 0.55 + flap * 0.45, 'rgba(232,190,120,0.3)', '#9a6532'); ctx.restore(); // ala de adelante
  ctx.restore();
}

// ---------------------------------------------------------------- 5: Araña radioactiva
// Abdomen grande y redondo con el símbolo de radiación que brilla verde, grietas verdes que laten, ocho patas
// largas con espinas que caminan en el aire, cabeza con muchos ojos verdes y quelíceros que gotean veneno.
export function drawSpider(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const GREEN = '#a3e635', pulse = 0.6 + 0.4 * Math.sin(t * (angry ? 7 : 3));
  ctx.save(); ctx.scale(1.15, 1.15);
  const SPREAD = [-0.62, -0.3, 0.12, 0.5];
  const leg = (i: number, front: boolean) => {
    const k = i % 4, ph = Math.sin(t * 8 + i * 1.3 + (front ? 0 : 1.5)), sc = front ? 1 : 0.8, hipX = 0.06 + k * 0.06;
    const hip: Pt = [hipX, front ? 0.12 : 0.0], knee: Pt = [hipX + SPREAD[k] * 0.75 * sc + ph * 0.04, (front ? -0.3 : -0.38) + Math.abs(SPREAD[k]) * 0.15], foot: Pt = [hipX + SPREAD[k] * 1.35 * sc + ph * 0.1, front ? 0.55 : 0.42];
    spinyLeg(ctx, hip, knee, foot, front ? '#6b4f24' : '#3d2d15', front ? 0.07 : 0.06, '#b45309');
    ctx.strokeStyle = GREEN; ctx.globalAlpha = 0.6 * pulse; ctx.lineWidth = 1.4 * P; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.stroke(); ctx.globalAlpha = 1; // venas verdes
  };
  for (const i of [0, 1, 2, 3]) leg(i, false);
  // abdomen
  const ax = -0.32, ay = -0.05, ar = 0.42;
  glow(ctx, ax, ay, ar * 1.6, GREEN, 0.35 * pulse);
  ink(ctx, circle(ctx, ax, ay, ar), ball(ctx, ax, ay, ar, '#4d5a1a'));
  ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.clip();
  ctx.strokeStyle = GREEN; ctx.globalAlpha = 0.7 * pulse; ctx.lineWidth = 1.4 * P; // grietas que brillan
  for (let k = 0; k < 9; k++) { const a = k * 0.7; ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * ar * 0.4, ay + Math.sin(a) * ar * 0.4); ctx.lineTo(ax + Math.cos(a + 0.2) * ar * 0.75, ay + Math.sin(a + 0.25) * ar * 0.7); ctx.lineTo(ax + Math.cos(a - 0.1) * ar, ay + Math.sin(a - 0.1) * ar); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // el símbolo de radiación
  ctx.fillStyle = `rgba(190,242,100,${0.75 + 0.25 * pulse})`; ctx.beginPath(); ctx.arc(ax, ay, ar * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, ar * 0.48, a - 0.52, a + 0.52); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = `rgba(190,242,100,1)`; ctx.beginPath(); ctx.arc(ax, ay, ar * 0.13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ax, ay, ar * 0.09, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(ax - ar * 0.35, ay - ar * 0.5, ar * 0.3, ar * 0.12, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.4; ink(ctx, () => { ctx.moveTo(ax + Math.cos(a - 0.08) * ar, ay + Math.sin(a - 0.08) * ar); ctx.lineTo(ax + Math.cos(a) * ar * 1.22, ay + Math.sin(a) * ar * 1.22); ctx.lineTo(ax + Math.cos(a + 0.08) * ar, ay + Math.sin(a + 0.08) * ar); ctx.closePath(); }, '#c2410c', 1); } // espinas
  for (const i of [4, 5, 6, 7]) leg(i, true); // las patas de este lado, por detrás de la cabeza
  // cefalotórax y cabeza
  ink(ctx, () => ctx.ellipse(0.16, 0.06, 0.22, 0.18, 0.2, 0, TAU), ball(ctx, 0.16, 0.06, 0.22, '#5b4320'));
  for (const [ex, ey, er] of [[0.26, -0.02, 0.05], [0.33, 0.04, 0.045], [0.2, 0.0, 0.03], [0.28, -0.08, 0.028], [0.36, -0.04, 0.025], [0.22, -0.08, 0.02]] as const) eye(ctx, ex, ey, er, '#4ade80', angry ? 1.4 : 0.9);
  // quelíceros con colmillos que gotean veneno verde
  const open = angry ? 0.25 + 0.15 * Math.sin(t * 8) : 0.08;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(0.32, 0.16); ctx.rotate(sgn * open * 0.6);
    ink(ctx, () => { ctx.moveTo(-0.05, 0); ctx.quadraticCurveTo(0.08, 0.04, 0.06 + sgn * 0.02, 0.2); ctx.quadraticCurveTo(0.0, 0.1, -0.06, 0.06); ctx.closePath(); }, lin(ctx, 0, 0, 0, 0.2, [[0, '#7c4a1c'], [1, '#e7d9b8']]), 1.3);
    ctx.restore();
  }
  for (let k = 0; k < 3; k++) drool(ctx, 0.31 + k * 0.04, 0.28, 0.12 + k * 0.03, '#a3e635', t, k);
  ctx.restore();
}

// ---------------------------------------------------------------- 6: Serpiente alienígena
// Larga, flotando: el cuerpo sigue el camino de la cabeza ("trail", en coordenadas del mundo), con escamas
// negras brillantes, panza amarillo verdosa que brilla y espinas en el lomo. La cabeza es de alien: cráneo
// alargado y liso, boca enorme con colmillos, lengua que se mueve y baba.
export function drawSerpentBody(ctx: CanvasRenderingContext2D, trail: [number, number][], t: number) {
  if (trail.length < 2) return;
  const n = trail.length, width = (i: number) => 0.34 * (1 - (i / n) ** 1.4 * 0.85);
  // de la cola a la cabeza: cada tramo con volumen, escamas y espinas
  for (let i = n - 1; i >= 1; i--) {
    const [x, y] = trail[i], [px, py] = trail[i - 1], w = width(i), a = Math.atan2(py - y, px - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ink(ctx, () => ctx.ellipse(0, 0, Math.hypot(px - x, py - y) * 0.9 + w * 0.35, w * 0.55, 0, 0, TAU), lin(ctx, 0, -w * 0.55, 0, w * 0.55, [[0, '#2b2f1a'], [0.35, '#0d0f08'], [0.7, '#5a6b14'], [1, '#d9f99d']]), 1);
    if (i % 3 === 0) { // espinas del lomo
      ink(ctx, () => { ctx.moveTo(-w * 0.2, -w * 0.45); ctx.quadraticCurveTo(-w * 0.5, -w * 1.1, -w * 0.9, -w * 1.25); ctx.quadraticCurveTo(-w * 0.35, -w * 0.9, w * 0.2, -w * 0.45); ctx.closePath(); }, lin(ctx, 0, -w, 0, -w * 0.45, [[0, '#e8e4c9'], [1, '#3f4a12']]), 1);
    }
    if (i % 2 === 0) { ctx.fillStyle = `rgba(190,242,100,${0.25 + 0.2 * Math.sin(t * 4 - i * 0.4)})`; ctx.beginPath(); ctx.ellipse(0, w * 0.28, w * 0.3, w * 0.14, 0, 0, TAU); ctx.fill(); } // brillo de la panza
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -w * 0.25, w * 0.35, w * 0.06, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
export function drawSerpentHead(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const open = angry ? 0.35 + 0.25 * Math.abs(Math.sin(t * 4)) : 0.12;
  ctx.save(); ctx.scale(1.1, 1.1);
  // mandíbula de abajo (rota hacia abajo al abrir)
  ctx.save(); ctx.translate(-0.12, 0.04); ctx.rotate(open);
  ink(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.25, 0.1, 0.5, 0.04); ctx.lineTo(0.48, 0.0); ctx.quadraticCurveTo(0.25, 0.03, 0, -0.04); ctx.closePath(); }, lin(ctx, 0, 0, 0, 0.1, [[0, '#1d2010'], [1, '#6b7f17']]), 1.5);
  fangs(ctx, 0.08, 0.46, 0.0, 6, 0.06, -1);
  ctx.restore();
  // interior de la boca y lengua bífida
  ctx.fillStyle = '#5b0f1f'; ctx.beginPath(); ctx.moveTo(-0.1, 0.03); ctx.lineTo(0.42, 0.02); ctx.lineTo(0.38, 0.02 + open * 0.35); ctx.closePath(); ctx.fill();
  const tw = Math.sin(t * 6) * 0.05;
  ctx.strokeStyle = '#be185d'; ctx.lineWidth = 2.4 * P; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.05, 0.05 + open * 0.1); ctx.quadraticCurveTo(0.35, 0.08 + open * 0.2 + tw, 0.62, 0.05 + open * 0.25 - tw); ctx.stroke();
  ctx.lineWidth = 1.4 * P; ctx.beginPath(); ctx.moveTo(0.62, 0.05 + open * 0.25 - tw); ctx.lineTo(0.7, 0.0 + open * 0.25); ctx.moveTo(0.62, 0.05 + open * 0.25 - tw); ctx.lineTo(0.7, 0.1 + open * 0.25); ctx.stroke();
  // cráneo alargado de alien
  ink(ctx, () => { ctx.moveTo(-0.25, 0.06); ctx.bezierCurveTo(-0.45, -0.1, -0.35, -0.32, -0.05, -0.3); ctx.bezierCurveTo(0.25, -0.26, 0.48, -0.1, 0.5, 0.0); ctx.lineTo(0.45, 0.03); ctx.quadraticCurveTo(0.2, 0.04, -0.25, 0.06); ctx.closePath(); }, lin(ctx, 0, -0.3, 0, 0.06, [[0, '#4b4f2f'], [0.4, '#16180c'], [1, '#2d3418']]));
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0.0, -0.22, 0.22, 0.03, 0.1, 0, TAU); ctx.fill(); // brillo del cráneo
  ctx.strokeStyle = '#0a0a06'; ctx.lineWidth = P; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-0.2 + k * 0.05, -0.05); ctx.quadraticCurveTo(-0.17 + k * 0.05, -0.15, -0.12 + k * 0.05, -0.22); ctx.stroke(); } // costillas del cráneo
  fangs(ctx, 0.0, 0.46, 0.03, 7, 0.07, 1);
  eye(ctx, 0.2, -0.1, 0.03, '#d9f99d', angry ? 1.2 : 0.6);
  for (let k = 0; k < 2; k++) drool(ctx, 0.15 + k * 0.18, 0.06 + open * 0.2, 0.12, 'rgba(217,249,157,0.8)', t, k + 3);
  ctx.restore();
}

// ---------------------------------------------------------------- 7: Dron asesino
// Esfera de metal negro con placas y remaches, un gran ojo rojo que brilla (lente con anillos), cuatro alas de
// cuchilla con tiras rojas que aletean, garras mecánicas abajo y lucecitas rojas.
export function drawDrone(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const RED = '#ff1f1f', flap = Math.sin(t * (angry ? 22 : 14));
  ctx.save(); ctx.scale(1.1, 1.1);
  const blade = (ang: number, len: number, back: boolean) => {
    ctx.save(); ctx.rotate(ang);
    ink(ctx, () => { ctx.moveTo(0, -0.04); ctx.lineTo(len, -0.07); ctx.lineTo(len * 1.12, 0); ctx.lineTo(len, 0.05); ctx.lineTo(0, 0.04); ctx.closePath(); }, lin(ctx, 0, -0.07, 0, 0.05, [[0, back ? '#3a3f4b' : '#6b7280'], [0.5, back ? '#1b1e26' : '#2a2e38'], [1, '#0d0f14']]), 1.3);
    ctx.fillStyle = RED; ctx.fillRect(len * 0.25, -0.025, len * 0.6, 1.6 * P); glow(ctx, len * 0.55, -0.02, 0.12, RED, back ? 0.2 : 0.35);
    ctx.strokeStyle = '#9ca3af55'; ctx.lineWidth = P; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(len * k / 4, -0.06); ctx.lineTo(len * k / 4, 0.04); ctx.stroke(); }
    ctx.restore();
  };
  blade(-2.4 + flap * 0.25, 0.75, true); blade(2.5 - flap * 0.25, 0.7, true);
  // garras mecánicas abajo
  for (let k = 0; k < 4; k++) {
    const x = -0.15 + k * 0.1, sw = Math.sin(t * 5 + k) * 0.04;
    limb(ctx, [[x, 0.2], [x + sw, 0.36], [x + sw * 2 + 0.03, 0.48]], '#2a2e38', 0.035);
    ink(ctx, () => { ctx.moveTo(x + sw * 2 - 0.02, 0.46); ctx.lineTo(x + sw * 2 + 0.03, 0.58); ctx.lineTo(x + sw * 2 + 0.06, 0.46); ctx.closePath(); }, '#9ca3af', 1);
    ctx.fillStyle = RED; ctx.fillRect(x + sw - 0.01, 0.34, 0.02, 0.02);
  }
  // cuerpo: esfera con placas
  ink(ctx, circle(ctx, 0, 0, 0.32), ball(ctx, 0, 0, 0.32, '#3a3f4b'));
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 0.32, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#0d0f14'; ctx.lineWidth = 1.2 * P;
  for (const x of [-0.18, 0.18]) { ctx.beginPath(); ctx.ellipse(x * 0.2, 0, 0.32 * Math.abs(x) * 3, 0.32, 0, 0, TAU); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-0.32, 0.12); ctx.lineTo(0.32, 0.12); ctx.stroke();
  ctx.fillStyle = '#9ca3af'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(-0.25 + k * 0.07, 0.15, 1.1 * P, 0, TAU); ctx.fill(); }
  ctx.restore();
  // el ojo rojo: lente con anillos y destello
  const beat = 0.7 + 0.3 * Math.sin(t * (angry ? 10 : 3));
  glow(ctx, 0.12, -0.02, 0.45, RED, 0.45 * beat);
  ink(ctx, circle(ctx, 0.12, -0.02, 0.15), '#0b0b10', 2);
  for (const [r, c] of [[0.12, '#7f1d1d'], [0.085, '#dc2626'], [0.05, '#ff6b6b'], [0.022, '#ffffff']] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0.12, -0.02, r, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = P; ctx.beginPath(); ctx.arc(0.12, -0.02, 0.13, -2.2, -1.2); ctx.stroke();
  for (const [x, y] of [[-0.2, -0.12], [-0.22, 0.05], [0.0, 0.22], [0.25, 0.14]] as const) { ctx.fillStyle = Math.sin(t * 6 + x * 9) > 0 ? RED : '#7f1d1d'; ctx.beginPath(); ctx.arc(x, y, 1.6 * P, 0, TAU); ctx.fill(); }
  blade(-0.6 - flap * 0.3, 0.85, false); blade(0.55 + flap * 0.3, 0.8, false);
  ctx.restore();
}

// ---------------------------------------------------------------- 8: Monstruo del bosque radioactivo
// Una bestia hecha de corteza podrida y raíces, con grietas verdes que brillan, hongos naranjas en el lomo,
// ramas como cuernos, muchos ojos verdes, una boca enorme con colmillos que chorrea baba radioactiva y garras.
export function drawForest(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const GREEN = '#a3e635', BARK = '#5a3a1a', pulse = 0.6 + 0.4 * Math.sin(t * (angry ? 6 : 2.5)), step = Math.sin(t * 5);
  ctx.save(); ctx.scale(1.2, 1.2);
  const claw = (x: number, ph: number, back: boolean) => {
    const c = back ? darken(BARK, 0.3) : BARK;
    limb(ctx, [[x, 0.05], [x + 0.05 + ph * 0.06, 0.25], [x + 0.12 + ph * 0.1, 0.4]], c, 0.11);
    for (let k = 0; k < 3; k++) ink(ctx, () => { const fx = x + 0.12 + ph * 0.1 + k * 0.04; ctx.moveTo(fx - 0.02, 0.4); ctx.quadraticCurveTo(fx + 0.05, 0.47, fx + 0.03, 0.55); ctx.lineTo(fx + 0.02, 0.4); ctx.closePath(); }, '#e7d9b8', 1);
  };
  claw(-0.3, -step, true); claw(0.1, step, true);
  // cuerpo de corteza
  ink(ctx, () => { ctx.moveTo(-0.5, 0.1); ctx.bezierCurveTo(-0.55, -0.25, -0.2, -0.38, 0.1, -0.3); ctx.bezierCurveTo(0.35, -0.25, 0.48, -0.1, 0.45, 0.08); ctx.bezierCurveTo(0.3, 0.22, -0.3, 0.25, -0.5, 0.1); ctx.closePath(); }, lin(ctx, 0, -0.35, 0, 0.22, [[0, '#7a5428'], [0.5, BARK], [1, '#24160a']]));
  ctx.save(); ctx.clip();
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.3 * P; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(-0.5 + k * 0.11, -0.35); ctx.bezierCurveTo(-0.45 + k * 0.11, -0.1, -0.52 + k * 0.11, 0.05, -0.47 + k * 0.11, 0.25); ctx.stroke(); } // vetas de la corteza
  ctx.strokeStyle = GREEN; ctx.globalAlpha = 0.75 * pulse; ctx.lineWidth = 1.6 * P; // grietas verdes
  for (const [x0, y0] of [[-0.35, -0.1], [-0.05, -0.18], [0.2, 0.0], [-0.2, 0.1]] as const) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 0.06, y0 + 0.05); ctx.lineTo(x0 + 0.02, y0 + 0.1); ctx.lineTo(x0 + 0.09, y0 + 0.15); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
  glow(ctx, -0.1, 0, 0.6, GREEN, 0.15 * pulse);
  // ramas como cuernos
  for (const [x, a, l] of [[-0.3, -2.0, 0.35], [-0.1, -1.7, 0.4], [0.1, -1.3, 0.32], [0.2, -1.1, 0.25]] as const) {
    const sway = Math.sin(t * 1.5 + x * 5) * 0.06, ex = x + Math.cos(a) * l, ey = -0.28 + Math.sin(a) * l + sway;
    limb(ctx, [[x, -0.28], [ex, ey]], '#4a2f12', 0.035);
    limb(ctx, [[(x + ex) / 2, (-0.28 + ey) / 2], [(x + ex) / 2 + 0.08, (-0.28 + ey) / 2 - 0.08]], '#4a2f12', 0.02);
  }
  // hongos naranjas en el lomo
  for (const [x, y, r] of [[-0.35, -0.22, 0.08], [-0.15, -0.3, 0.06], [-0.42, -0.08, 0.05], [0.05, -0.29, 0.05]] as const) {
    ink(ctx, () => ctx.rect(x - 0.012, y, 0.024, 0.06), '#e7d9b8', 1);
    ink(ctx, () => { ctx.ellipse(x, y, r, r * 0.5, 0, Math.PI, TAU); ctx.closePath(); }, ball(ctx, x, y - r * 0.2, r, '#c2410c'), 1.2);
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.25, 1.4 * P, 0, TAU); ctx.fill();
  }
  // muchos ojos verdes
  for (const [ex, ey, er] of [[0.28, -0.12, 0.05], [0.18, -0.18, 0.035], [-0.05, -0.05, 0.03], [-0.25, 0.0, 0.035], [0.36, -0.03, 0.03]] as const) eye(ctx, ex, ey, er, '#86efac', angry ? 1.4 : 0.9);
  // la boca enorme con colmillos y baba
  const open = angry ? 0.12 + 0.06 * Math.abs(Math.sin(t * 5)) : 0.05;
  ink(ctx, () => { ctx.moveTo(0.18, 0.04); ctx.quadraticCurveTo(0.35, 0.02, 0.5, 0.02); ctx.quadraticCurveTo(0.42, 0.08 + open * 1.5, 0.2, 0.08 + open); ctx.closePath(); }, '#2a0a0a', 1.5);
  fangs(ctx, 0.2, 0.5, 0.03, 6, 0.06 + open * 0.4, 1);
  fangs(ctx, 0.22, 0.46, 0.08 + open * 1.2, 5, 0.04 + open * 0.3, -1);
  for (let k = 0; k < 3; k++) drool(ctx, 0.26 + k * 0.08, 0.1 + open, 0.15, GREEN, t, k);
  claw(-0.15, step, false); claw(0.25, -step, false);
  ctx.restore();
}

// ---------------------------------------------------------------- 9: Kaiju de cristal
// Enorme y pesado: cuerpo de roca negra en placas, cristales verdes y celestes en el lomo que brillan,
// varios ojos verdes, una boca gigante con colmillos de la que salen tentáculos rojos con espinas que se
// mueven, y patas como columnas con cristales en los dedos.
export function drawKaiju(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const CRYSTAL = '#34d399', ROCK = '#2b2620', pulse = 0.6 + 0.4 * Math.sin(t * (angry ? 5 : 2)), step = Math.sin(t * 3.5);
  ctx.save(); ctx.scale(1.35, 1.35);
  const leg = (x: number, ph: number, back: boolean) => {
    ink(ctx, () => ctx.roundRect(x - 0.08 + ph * 0.03, 0.05, 0.18, 0.38, 0.06), lin(ctx, x - 0.08, 0, x + 0.1, 0, [[0, back ? '#1a1612' : '#4a4036'], [1, '#14110d']]), 1.5);
    for (let k = 0; k < 3; k++) ink(ctx, () => { const fx = x - 0.05 + ph * 0.03 + k * 0.06; ctx.moveTo(fx, 0.42); ctx.lineTo(fx + 0.03, 0.52); ctx.lineTo(fx + 0.05, 0.42); ctx.closePath(); }, CRYSTAL, 1);
  };
  leg(-0.32, -step, true); leg(0.08, step, true);
  // tentáculos de atrás de la boca
  const tentacle = (k: number) => {
    const w1 = Math.sin(t * 3 + k * 1.7) * 0.12, w2 = Math.cos(t * 2.4 + k) * 0.15;
    const pts: Pt[] = [[0.4, 0.05], [0.55 + w1 * 0.3, 0.1 + k * 0.05], [0.68 + w2 * 0.4, 0.2 + k * 0.08 + w1], [0.72 + w1 * 0.6, 0.38 + k * 0.05 + w2]];
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) limb(ctx, [pts[i - 1], pts[i]], i === 1 ? '#b42346' : i === 2 ? '#9d1c3b' : '#7f1530', 0.06 - i * 0.012);
    ctx.fillStyle = '#fcd34d'; for (let i = 1; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1] - 0.02, 1.2 * P, 0, TAU); ctx.fill(); }
  };
  // cuerpo de roca
  ink(ctx, () => { ctx.moveTo(-0.55, 0.15); ctx.bezierCurveTo(-0.6, -0.25, -0.2, -0.35, 0.15, -0.28); ctx.bezierCurveTo(0.45, -0.22, 0.55, -0.05, 0.5, 0.12); ctx.bezierCurveTo(0.3, 0.22, -0.3, 0.24, -0.55, 0.15); ctx.closePath(); }, lin(ctx, 0, -0.35, 0, 0.24, [[0, '#5a5045'], [0.5, ROCK], [1, '#0d0b09']]));
  ctx.save(); ctx.clip(); ctx.strokeStyle = '#0d0b09'; ctx.lineWidth = 1.2 * P;
  for (let k = 0; k < 14; k++) { // placas de roca irregulares, con luz arriba
    const x = -0.55 + (k % 7) * 0.16 + (k > 6 ? 0.08 : 0), y = k > 6 ? 0.04 : -0.14, w = 0.14, h = 0.13;
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.3); ctx.lineTo(x + w * 0.35, y); ctx.lineTo(x + w, y + h * 0.15); ctx.lineTo(x + w * 0.9, y + h); ctx.lineTo(x + w * 0.1, y + h * 0.9); ctx.closePath();
    ctx.fillStyle = k % 3 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // cristales en el lomo
  for (let k = 0; k < 9; k++) {
    const x = -0.48 + k * 0.1, base = -0.24 - Math.sin(k * 0.6) * 0.06, h = 0.16 + (k % 3) * 0.07, lean = (k - 4) * 0.03;
    const g = lin(ctx, x, base - h, x + 0.05, base, [[0, '#d1fae5'], [0.4, k % 2 ? '#2dd4bf' : CRYSTAL], [1, '#064e3b']]);
    ink(ctx, () => { ctx.moveTo(x - 0.04, base); ctx.lineTo(x + lean, base - h); ctx.lineTo(x + 0.045, base); ctx.closePath(); }, g, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(x - 0.02, base); ctx.lineTo(x + lean, base - h); ctx.lineTo(x - 0.005, base); ctx.fill();
    glow(ctx, x, base - h * 0.4, 0.12, CRYSTAL, 0.35 * pulse);
  }
  // cabeza con ojos y la boca gigante
  for (const [ex, ey, er] of [[0.33, -0.12, 0.045], [0.24, -0.15, 0.03], [0.4, -0.05, 0.028], [0.2, -0.08, 0.022]] as const) eye(ctx, ex, ey, er, '#bef264', angry ? 1.5 : 1);
  const open = angry ? 0.14 + 0.06 * Math.abs(Math.sin(t * 4)) : 0.06;
  ink(ctx, () => { ctx.moveTo(0.12, 0.02); ctx.quadraticCurveTo(0.35, -0.01, 0.56, 0.03); ctx.quadraticCurveTo(0.45, 0.1 + open * 1.6, 0.14, 0.1 + open); ctx.closePath(); }, '#3b0a12', 1.5);
  fangs(ctx, 0.14, 0.55, 0.025, 8, 0.07 + open * 0.3, 1);
  fangs(ctx, 0.16, 0.5, 0.1 + open * 1.3, 7, 0.05 + open * 0.25, -1);
  for (let k = 0; k < 4; k++) tentacle(k);
  for (let k = 0; k < 3; k++) drool(ctx, 0.25 + k * 0.1, 0.1 + open * 1.2, 0.16, '#bef264', t, k);
  leg(-0.42, step, false); leg(-0.02, -step, false);
  ctx.restore();
}

// ---------------------------------------------------------------- 10: Insecto alienígena
// Como una avispa gigante: caparazón rojo oscuro casi negro con brillo, alas verdes traslúcidas con agujeros
// que aletean, abdomen hinchado con esferas verdes que brillan y un aguijón que gotea, ojos compuestos verdes,
// mandíbulas curvas y patas largas con espinas.
export function drawInsect(ctx: CanvasRenderingContext2D, t: number, angry: boolean) {
  const GREEN = '#a3e635', SHELL = '#4a0f12', flap = Math.sin(t * (angry ? 34 : 24)), pulse = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.save(); ctx.scale(1.2, 1.2);
  ctx.save(); ctx.translate(0.0, -0.14); wing(ctx, 0.85, 0.5 + flap * 0.5, 'rgba(163,230,53,0.35)', '#4d7c0f', true); ctx.restore();
  for (let i = 0; i < 3; i++) { const ph = Math.sin(t * 7 + i * 2); spinyLeg(ctx, [-0.05 + i * 0.12, 0.05], [-0.2 + i * 0.16 + ph * 0.05, 0.28], [-0.3 + i * 0.2 + ph * 0.08, 0.5], darken(SHELL, 0.3), 0.04, '#7f1d1d'); }
  // abdomen hinchado con esferas que brillan y aguijón
  ink(ctx, () => { ctx.moveTo(-0.08, -0.05); ctx.bezierCurveTo(-0.25, -0.2, -0.6, -0.12, -0.62, 0.05); ctx.bezierCurveTo(-0.6, 0.2, -0.25, 0.22, -0.08, 0.06); ctx.closePath(); }, lin(ctx, 0, -0.18, 0, 0.2, [[0, '#7f1d1d'], [0.5, SHELL], [1, '#1a0405']]));
  ctx.save(); ctx.clip();
  for (const [x, y, r] of [[-0.25, 0.0, 0.07], [-0.4, 0.04, 0.065], [-0.52, 0.0, 0.05], [-0.3, -0.1, 0.05]] as const) { glow(ctx, x, y, r * 2.2, GREEN, 0.5 * pulse); ctx.fillStyle = ball(ctx, x, y, r, '#84cc16'); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#1a0405'; ctx.lineWidth = 1.4 * P; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-0.18 - k * 0.09, 0.02, 0.03, 0.16, 0, -1.4, 1.4); ctx.stroke(); }
  ctx.restore();
  ink(ctx, () => { ctx.moveTo(-0.6, 0.0); ctx.lineTo(-0.78, 0.06); ctx.lineTo(-0.6, 0.09); ctx.closePath(); }, '#2a0607', 1.2); // aguijón
  drool(ctx, -0.77, 0.07, 0.12, GREEN, t, 4);
  // tórax y cabeza
  ink(ctx, () => ctx.ellipse(0.05, -0.02, 0.15, 0.12, 0, 0, TAU), ball(ctx, 0.05, -0.02, 0.15, SHELL));
  for (const [x, y] of [[0.0, -0.13], [0.1, -0.12]] as const) ink(ctx, () => { ctx.moveTo(x - 0.02, y); ctx.lineTo(x + 0.02, y - 0.12); ctx.lineTo(x + 0.03, y); ctx.closePath(); }, '#7f1d1d', 1); // púas
  ink(ctx, () => ctx.ellipse(0.27, 0.0, 0.13, 0.11, 0.2, 0, TAU), ball(ctx, 0.27, 0.0, 0.13, '#5a1216'));
  // ojo compuesto (con celditas)
  const ex = 0.3, ey = -0.04, er = 0.065;
  eye(ctx, ex, ey, er, GREEN, angry ? 1.4 : 1);
  ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.clip(); ctx.strokeStyle = 'rgba(20,40,5,0.45)'; ctx.lineWidth = 0.6 * P;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(ex - er, ey + k * 0.02); ctx.lineTo(ex + er, ey + k * 0.02 + 0.01); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex + k * 0.02, ey - er); ctx.lineTo(ex + k * 0.02 + 0.01, ey + er); ctx.stroke(); }
  ctx.restore();
  eye(ctx, 0.36, 0.05, 0.025, GREEN, 0.8);
  // antenas en gancho
  for (const k of [0, 1]) { const w = Math.sin(t * 3 + k * 2) * 0.08; ctx.strokeStyle = '#3a0a0c'; ctx.lineWidth = 1.8 * P; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.3, -0.1); ctx.bezierCurveTo(0.38, -0.4 + w, 0.6, -0.45 + w, 0.62 + k * 0.08, -0.3 + w); ctx.stroke(); }
  // mandíbulas curvas que se abren y cierran
  const open = angry ? 0.35 + 0.2 * Math.sin(t * 9) : 0.12;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(0.36, 0.08); ctx.rotate(sgn * open);
    ink(ctx, () => { ctx.moveTo(0, -0.02); ctx.quadraticCurveTo(0.18, sgn * 0.02, 0.2, sgn * 0.14); ctx.quadraticCurveTo(0.1, sgn * 0.06, 0, 0.02); ctx.closePath(); }, lin(ctx, 0, 0, 0.2, 0, [[0, '#7f1d1d'], [1, '#e7d9b8']]), 1.2);
    ctx.restore();
  }
  for (let k = 0; k < 2; k++) drool(ctx, 0.42 + k * 0.05, 0.12, 0.13, GREEN, t, k + 1);
  for (let i = 0; i < 3; i++) { const ph = Math.sin(t * 7 + i * 2 + Math.PI); spinyLeg(ctx, [0.0 + i * 0.12, 0.08], [-0.1 + i * 0.2 + ph * 0.06, 0.3], [-0.18 + i * 0.25 + ph * 0.1, 0.55], SHELL, 0.045, '#7f1d1d'); }
  ctx.save(); ctx.translate(0.05, -0.16); wing(ctx, 0.95, 0.5 + flap * 0.5, 'rgba(190,242,100,0.28)', '#65a30d', true); ctx.restore();
  ctx.restore();
}
