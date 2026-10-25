// Dibujos detallados de Trepaluna: el avión de línea, las palomas, la tela del globo aerostático y el
// trepador (el protagonista). Lo que no se mueve (el avión y la tela del globo) se pinta una sola vez en
// alta resolución (con la densidad de píxeles de la pantalla) y después se copia; lo que se anima (las alas
// de las palomas y el cuerpo del trepador) se dibuja en cada cuadro con volumen, sombras y contornos.

const TAU = Math.PI * 2;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const pixelRatio = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

interface Sprite { canvas: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
// Pinta `paint` en un canvas de w×h (en píxeles de pantalla) con el origen en (ox, oy), a la densidad real.
function makeSprite(w: number, h: number, ox: number, oy: number, paint: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const k = Math.min(3, pixelRatio() * 1.25), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * k)); canvas.height = Math.max(1, Math.ceil(h * k));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
  paint(ctx);
  return { canvas, ox, oy, w, h };
}
const blit = (ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number) => ctx.drawImage(sp.canvas, x - sp.ox, y - sp.oy, sp.w, sp.h);
function cached(map: Map<string, Sprite>, key: string, make: () => Sprite) {
  let sp = map.get(key);
  if (!sp) { if (map.size > 24) map.clear(); sp = make(); map.set(key, sp); }
  return sp;
}

// ---------------------------------------------------------------- Avión de línea
// De costado, con la nariz hacia +x: fuselaje con volumen y librea, cabina, ventanillas y puertas, la deriva
// pintada con el logo, el ala cercana con flaps y winglet, la turbina con su fan y la tobera, y el ala y el
// estabilizador del otro lado asomando detrás. L es el largo, H el alto del fuselaje.
const planes = new Map<string, Sprite>();
function paintPlane(ctx: CanvasRenderingContext2D, L: number, H: number, hue: number) {
  const line = Math.max(0.6, H * 0.035);
  const paint = hsl(hue, 70, 40), paintDark = hsl(hue, 70, 24), paintLight = hsl(hue, 80, 58);
  // --- lo que queda detrás del fuselaje: ala y estabilizador del otro lado
  const farWing = ctx.createLinearGradient(0, -H * 0.3, 0, -H * 1.4);
  farWing.addColorStop(0, '#94a3b8'); farWing.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = farWing; ctx.beginPath();
  ctx.moveTo(L * 0.1, -H * 0.3); ctx.lineTo(-L * 0.17, -H * 1.32); ctx.lineTo(-L * 0.215, -H * 1.36); ctx.lineTo(-L * 0.26, -H * 1.3); ctx.lineTo(-L * 0.12, -H * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a3b0c2'; ctx.beginPath(); ctx.moveTo(-L * 0.36, -H * 0.3); ctx.lineTo(-L * 0.47, -H * 0.86); ctx.lineTo(-L * 0.51, -H * 0.86); ctx.lineTo(-L * 0.5, -H * 0.3); ctx.closePath(); ctx.fill();
  // --- deriva (timón de cola) con la pintura de la aerolínea
  const fin = () => { ctx.beginPath(); ctx.moveTo(-L * 0.27, -H * 0.48); ctx.bezierCurveTo(-L * 0.36, -H * 0.62, -L * 0.43, -H * 1.3, -L * 0.465, -H * 1.98); ctx.lineTo(-L * 0.53, -H * 1.98); ctx.lineTo(-L * 0.552, -H * 0.4); ctx.closePath(); };
  const finG = ctx.createLinearGradient(-L * 0.27, 0, -L * 0.55, 0);
  finG.addColorStop(0, paintLight); finG.addColorStop(0.45, paint); finG.addColorStop(1, paintDark);
  ctx.fillStyle = finG; fin(); ctx.fill();
  ctx.save(); fin(); ctx.clip();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-L * 0.47, -H * 1.18, H * 0.36, 0, TAU); ctx.fill(); // logo: un sol con un ave
  ctx.fillStyle = paint; ctx.beginPath(); ctx.arc(-L * 0.47, -H * 1.18, H * 0.28, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-L * 0.47 - H * 0.24, -H * 1.12); ctx.quadraticCurveTo(-L * 0.47, -H * 1.42, -L * 0.47 + H * 0.24, -H * 1.22); ctx.quadraticCurveTo(-L * 0.47, -H * 1.28, -L * 0.47 - H * 0.24, -H * 1.12); ctx.fill();
  ctx.strokeStyle = '#00000030'; ctx.lineWidth = line; ctx.beginPath(); ctx.moveTo(-L * 0.515, -H * 1.9); ctx.lineTo(-L * 0.535, -H * 0.5); ctx.stroke(); // bisagra del timón
  ctx.fillStyle = '#ffffff40'; ctx.beginPath(); ctx.moveTo(-L * 0.27, -H * 0.48); ctx.bezierCurveTo(-L * 0.36, -H * 0.62, -L * 0.43, -H * 1.3, -L * 0.465, -H * 1.98); ctx.lineTo(-L * 0.475, -H * 1.98); ctx.bezierCurveTo(-L * 0.44, -H * 1.3, -L * 0.375, -H * 0.6, -L * 0.29, -H * 0.48); ctx.fill(); // brillo del borde de ataque
  ctx.restore();
  // --- fuselaje
  const body = () => {
    ctx.beginPath(); ctx.moveTo(-L * 0.556, -H * 0.4); ctx.quadraticCurveTo(-L * 0.48, -H * 0.5, -L * 0.4, -H * 0.5);
    ctx.lineTo(L * 0.3, -H * 0.5); ctx.bezierCurveTo(L * 0.43, -H * 0.5, L * 0.5, -H * 0.24, L * 0.505, H * 0.03);
    ctx.bezierCurveTo(L * 0.5, H * 0.32, L * 0.44, H * 0.5, L * 0.34, H * 0.5); ctx.lineTo(-L * 0.24, H * 0.5);
    ctx.bezierCurveTo(-L * 0.38, H * 0.46, -L * 0.5, H * 0.02, -L * 0.556, -H * 0.22); ctx.closePath();
  };
  const bodyG = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  bodyG.addColorStop(0, '#e9eef4'); bodyG.addColorStop(0.18, '#ffffff'); bodyG.addColorStop(0.55, '#f1f5f9'); bodyG.addColorStop(1, '#a8b4c4');
  ctx.fillStyle = bodyG; body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  const belly = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.5); // panza pintada
  belly.addColorStop(0, paint); belly.addColorStop(1, paintDark);
  ctx.fillStyle = belly; ctx.beginPath(); ctx.moveTo(L * 0.52, H * 0.12); ctx.bezierCurveTo(L * 0.2, H * 0.18, -L * 0.2, H * 0.24, -L * 0.6, H * 0.02); ctx.lineTo(-L * 0.6, H * 0.6); ctx.lineTo(L * 0.6, H * 0.6); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = Math.max(0.8, H * 0.05); // filete dorado
  ctx.beginPath(); ctx.moveTo(L * 0.52, H * 0.06); ctx.bezierCurveTo(L * 0.2, H * 0.12, -L * 0.2, H * 0.18, -L * 0.6, -H * 0.04); ctx.stroke();
  ctx.strokeStyle = '#0f172a14'; ctx.lineWidth = line; // líneas de los paneles
  for (let k = -0.48; k < 0.42; k += 0.075) { ctx.beginPath(); ctx.moveTo(L * k, -H * 0.5); ctx.lineTo(L * k, H * 0.5); ctx.stroke(); }
  ctx.fillStyle = '#ffffffb0'; ctx.fillRect(-L * 0.42, -H * 0.4, L * 0.74, H * 0.05); // reflejo del techo
  const shade = ctx.createLinearGradient(-L * 0.56, 0, L * 0.5, 0); shade.addColorStop(0, '#0f172a30'); shade.addColorStop(0.25, '#0f172a00'); shade.addColorStop(0.9, '#0f172a00'); shade.addColorStop(1, '#0f172a25');
  ctx.fillStyle = shade; ctx.fillRect(-L * 0.6, -H, L * 1.2, H * 2);
  ctx.restore();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = line; body(); ctx.stroke();
  // ventanillas (con huecos para las puertas y las salidas sobre el ala)
  const wy = -H * 0.2, wh = H * 0.19, ww = H * 0.115;
  for (let k = -0.37; k < 0.26; k += 0.033) {
    if ((k > 0.235) || (k > -0.03 && k < 0.02) || (k > -0.42 && k < -0.35)) continue;
    const wx = L * k;
    const glass = ctx.createLinearGradient(0, wy, 0, wy + wh); glass.addColorStop(0, '#334155'); glass.addColorStop(1, '#0f172a');
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.roundRect(wx - line, wy - line, ww + line * 2, wh + line * 2, ww * 0.5); ctx.fill();
    ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, ww * 0.45); ctx.fill();
    ctx.fillStyle = '#bae6fd99'; ctx.fillRect(wx + ww * 0.2, wy + wh * 0.15, ww * 0.25, wh * 0.3);
  }
  // puertas (adelante, salidas sobre el ala y atrás)
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = line * 1.2;
  for (const [dx, dw] of [[0.262, 0.032], [-0.022, 0.026], [-0.405, 0.03]] as const) { ctx.beginPath(); ctx.roundRect(L * dx, -H * 0.36, L * dw, H * 0.66, H * 0.06); ctx.stroke(); }
  // cabina: parabrisas en tres partes
  for (const [a, b] of [[0.415, 0.445], [0.447, 0.472], [0.474, 0.492]] as const) {
    const top = -H * 0.3 + (a - 0.415) * H * 2.2;
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.moveTo(L * a, top); ctx.lineTo(L * b, top + (b - a) * H * 2.6); ctx.lineTo(L * b, -H * 0.1); ctx.lineTo(L * a, -H * 0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7dd3fc55'; ctx.beginPath(); ctx.moveTo(L * a, top); ctx.lineTo(L * (a + b) / 2, top + (b - a) * H * 1.3); ctx.lineTo(L * a, -H * 0.18); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(-L * 0.556, -H * 0.31, H * 0.07, 0, TAU); ctx.fill(); // escape del APU
  // --- estabilizador de cola de este lado
  const stab = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.45); stab.addColorStop(0, '#f1f5f9'); stab.addColorStop(1, '#94a3b8');
  ctx.fillStyle = stab; ctx.beginPath(); ctx.moveTo(-L * 0.33, H * 0.02); ctx.lineTo(-L * 0.49, H * 0.4); ctx.lineTo(-L * 0.53, H * 0.42); ctx.lineTo(-L * 0.5, H * 0.0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = line; ctx.stroke();
  // --- carenado del ala y ala cercana, con flaps, rieles y winglet
  ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.ellipse(-L * 0.02, H * 0.42, L * 0.16, H * 0.16, 0, 0, TAU); ctx.fill();
  const wing = () => { ctx.beginPath(); ctx.moveTo(L * 0.13, H * 0.32); ctx.lineTo(-L * 0.205, H * 1.56); ctx.lineTo(-L * 0.255, H * 1.6); ctx.lineTo(-L * 0.16, H * 0.46); ctx.closePath(); };
  const wingG = ctx.createLinearGradient(L * 0.13, H * 0.3, -L * 0.2, H * 1.6);
  wingG.addColorStop(0, '#f8fafc'); wingG.addColorStop(0.6, '#d1d9e3'); wingG.addColorStop(1, '#a5b2c3');
  ctx.fillStyle = wingG; wing(); ctx.fill();
  ctx.save(); wing(); ctx.clip();
  ctx.strokeStyle = '#64748b88'; ctx.lineWidth = line; // flaps y alerones
  ctx.beginPath(); ctx.moveTo(-L * 0.11, H * 0.46); ctx.lineTo(-L * 0.225, H * 1.5); ctx.stroke();
  for (const k of [0.25, 0.5, 0.75]) { const tx = -L * (0.16 + 0.095 * k), ty = H * (0.46 + k * 1.1); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + L * 0.03, ty - H * 0.05); ctx.stroke(); }
  ctx.fillStyle = '#ffffff70'; ctx.beginPath(); ctx.moveTo(L * 0.13, H * 0.32); ctx.lineTo(-L * 0.205, H * 1.56); ctx.lineTo(-L * 0.19, H * 1.56); ctx.lineTo(L * 0.14, H * 0.34); ctx.fill(); // brillo del borde de ataque
  ctx.restore();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = line; wing(); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; for (const k of [0.3, 0.55, 0.8]) { const fx = L * 0.13 + (-L * 0.335) * k - L * 0.15, fy = H * (0.32 + 1.24 * k) + H * 0.12; ctx.beginPath(); ctx.ellipse(fx, fy, L * 0.03, H * 0.06, 0.35, 0, TAU); ctx.fill(); } // rieles de los flaps
  ctx.fillStyle = paint; ctx.beginPath(); ctx.moveTo(-L * 0.205, H * 1.56); ctx.lineTo(-L * 0.23, H * 1.82); ctx.lineTo(-L * 0.255, H * 1.82); ctx.lineTo(-L * 0.255, H * 1.6); ctx.closePath(); ctx.fill(); // winglet
  // --- turbina colgada del ala
  const ex = -L * 0.005, ey = H * 0.98, er = H * 0.27, front = ex + L * 0.115, back = ex - L * 0.085;
  ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(ex + L * 0.06, ey - er * 0.9); ctx.lineTo(ex + L * 0.0, ey - er * 2.0); ctx.lineTo(ex - L * 0.07, ey - er * 1.7); ctx.lineTo(ex - L * 0.05, ey - er * 0.9); ctx.closePath(); ctx.fill(); // pilón
  const tail = ctx.createLinearGradient(0, ey - er * 0.6, 0, ey + er * 0.6); tail.addColorStop(0, '#9ca3af'); tail.addColorStop(1, '#374151');
  ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(back + L * 0.01, ey - er * 0.65); ctx.lineTo(back - L * 0.045, ey - er * 0.15); ctx.lineTo(back - L * 0.045, ey + er * 0.1); ctx.lineTo(back + L * 0.01, ey + er * 0.62); ctx.closePath(); ctx.fill(); // tobera y cono
  const nac = ctx.createLinearGradient(0, ey - er, 0, ey + er); nac.addColorStop(0, '#e2e8f0'); nac.addColorStop(0.3, '#ffffff'); nac.addColorStop(0.75, '#cbd5e1'); nac.addColorStop(1, '#64748b');
  ctx.fillStyle = nac; ctx.beginPath(); ctx.moveTo(front, ey - er); ctx.lineTo(back + L * 0.02, ey - er * 0.82); ctx.quadraticCurveTo(back, ey, back + L * 0.02, ey + er * 0.82); ctx.lineTo(front, ey + er); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = line; ctx.stroke();
  ctx.fillStyle = paint; ctx.fillRect(back + L * 0.035, ey - er * 0.15, front - back - L * 0.05, er * 0.28); // franja de la aerolínea
  ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(ex + L * 0.04, ey - er * 0.95); ctx.lineTo(ex + L * 0.04, ey + er * 0.95); ctx.stroke(); // tapa de la turbina
  const lip = ctx.createLinearGradient(front, ey - er, front, ey + er); lip.addColorStop(0, '#f8fafc'); lip.addColorStop(0.5, '#94a3b8'); lip.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = lip; ctx.beginPath(); ctx.ellipse(front, ey, er * 0.28, er, 0, 0, TAU); ctx.fill(); // labio de la toma de aire
  ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.ellipse(front + er * 0.02, ey, er * 0.19, er * 0.82, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = line; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; ctx.beginPath(); ctx.moveTo(front, ey); ctx.lineTo(front + Math.cos(a) * er * 0.17, ey + Math.sin(a) * er * 0.78); ctx.stroke(); } // álabes del fan
  ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse(front + er * 0.05, ey, er * 0.08, er * 0.2, 0, 0, TAU); ctx.fill(); // cono
}
export function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, hue: number, t: number, id: number) {
  const L = s * 3.2, H = s * 0.52;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  // estela de condensación de las dos turbinas
  const trail = ctx.createLinearGradient(-L * 2, 0, -L * 0.15, 0); trail.addColorStop(0, '#ffffff00'); trail.addColorStop(1, '#ffffffb0');
  ctx.strokeStyle = trail; ctx.lineCap = 'round';
  for (const [ty, w] of [[H * 0.98, 0.12], [-H * 0.35, 0.07]] as const) { ctx.lineWidth = Math.max(1.5, s * w); ctx.beginPath(); ctx.moveTo(-L * 2, ty + H * 0.15); ctx.lineTo(-L * 0.12, ty); ctx.stroke(); }
  // el calor de la tobera
  const heat = ctx.createRadialGradient(-L * 0.13, H * 0.98, 0, -L * 0.13, H * 0.98, H * 0.5); heat.addColorStop(0, '#fde68a55'); heat.addColorStop(1, '#fde68a00');
  ctx.fillStyle = heat; ctx.beginPath(); ctx.arc(-L * 0.13, H * 0.98, H * 0.5, 0, TAU); ctx.fill();
  const sp = cached(planes, `${Math.round(s * 4)}|${hue}|${pixelRatio()}`, () => makeSprite(L * 1.12, H * 3.9, L * 0.575, H * 2.1, c => paintPlane(c, L, H, hue)));
  blit(ctx, sp, 0, 0);
  // luces: roja de navegación en la punta del ala, blanca en la cola, baliza roja y destello blanco
  const nav = Math.sin(t * 6 + id) > 0.3, beacon = (t * 1.3 + id * 0.37) % 1 < 0.12, strobe = (t * 1.1 + id * 0.21) % 1 < 0.06;
  const light = (lx: number, ly: number, color: string, on: boolean, r: number) => {
    if (on) { const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 5); g.addColorStop(0, color); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, r * 5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = on ? '#ffffff' : color + '99'; ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
  };
  light(-L * 0.24, H * 1.78, '#ef4444', nav, s * 0.05);
  light(-L * 0.556, -H * 0.42, '#ffffff', nav, s * 0.04);
  light(-L * 0.05, -H * 0.53, '#ef4444', beacon, s * 0.045);
  light(-L * 0.25, H * 1.6, '#ffffff', strobe, s * 0.04);
  ctx.restore();
}

// ---------------------------------------------------------------- Palomas
// Paloma bravía vista de costado: cuello con brillo tornasolado (verde y violeta), dos barras negras en las
// alas, rabadilla clara, cola con la punta oscura, ojo naranja con anillo, pico con la carúncula blanca y
// patas rosadas recogidas. Hay cuatro plumajes: gris, bataraza (manchada), blanca y colorada.
interface Plumage { body: string; back: string; belly: string; head: string; wing: string; covert: string; bar: string; tip: string; tail: string; neckA: string; neckB: string; checker: boolean }
const PIGEONS: Plumage[] = [
  { body: '#8a93a3', back: '#9aa3b2', belly: '#a9b0bd', head: '#6b7384', wing: '#a4acba', covert: '#b4bbc7', bar: '#1f2430', tip: '#2f3542', tail: '#7d8696', neckA: '#3f8f6e', neckB: '#8b5a9e', checker: false },
  { body: '#5f6676', back: '#6c7384', belly: '#7a8090', head: '#4b5262', wing: '#767d8d', covert: '#858c9b', bar: '#151820', tip: '#1c1f28', tail: '#4e5565', neckA: '#2f7d5c', neckB: '#7b4590', checker: true },
  { body: '#f1f3f6', back: '#ffffff', belly: '#f8fafc', head: '#f4f5f7', wing: '#eef1f5', covert: '#ffffff', bar: '#c9ced8', tip: '#bfc5cf', tail: '#e9ecf1', neckA: '#e7efe9', neckB: '#efe7f1', checker: false },
  { body: '#a86a4a', back: '#b8795a', belly: '#c79a80', head: '#8f5639', wing: '#c08463', covert: '#cd9677', bar: '#6b3420', tip: '#7a5242', tail: '#9a6449', neckA: '#9c6a3b', neckB: '#a1527a', checker: false },
];
// Una pluma larga: base en (0,0), apunta hacia `angle`, con raquis (el tallo) marcado.
function feather(ctx: CanvasRenderingContext2D, len: number, width: number, angle: number, base: string, tip: string, line: number) {
  ctx.save(); ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, base); g.addColorStop(0.55, base); g.addColorStop(1, tip);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -width * 0.5);
  ctx.quadraticCurveTo(len * 0.6, -width * 0.62, len, -width * 0.1); ctx.quadraticCurveTo(len * 1.02, width * 0.15, len * 0.9, width * 0.3);
  ctx.quadraticCurveTo(len * 0.5, width * 0.6, 0, width * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#00000038'; ctx.lineWidth = line; ctx.stroke();
  ctx.strokeStyle = '#ffffff30'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.92, width * 0.04); ctx.stroke();
  ctx.restore();
}
// Un ala desplegada: sale del hombro (0,0) hacia arriba y atrás; `open` (0 a 1) la abre o la pliega y `sy`
// la achica en vertical cuando se ve de canto.
function pigeonWing(ctx: CanvasRenderingContext2D, u: number, angle: number, sy: number, c: Plumage, far: boolean) {
  ctx.save(); ctx.rotate(angle); ctx.scale(1, sy);
  const line = Math.max(0.5, u * 0.025);
  const wing = far ? c.tail : c.wing, covert = far ? c.wing : c.covert;
  // primarias: abanico de plumas largas con la punta oscura que sale de la muñeca
  ctx.save(); ctx.translate(-u * 0.12, -u * 0.72);
  for (let i = 0; i < 7; i++) feather(ctx, u * (0.72 - i * 0.035), u * 0.2, -Math.PI / 2 - 0.55 + i * 0.16 - (far ? 0.05 : 0), wing, c.tip, line);
  ctx.restore();
  // secundarias: la fila del borde de atrás, del hombro a la muñeca
  for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-u * (0.02 + i * 0.02), -u * (0.08 + i * 0.12)); feather(ctx, u * 0.48, u * 0.2, Math.PI - 0.35 - i * 0.12, wing, c.tip, line); ctx.restore(); }
  // cobertoras: la parte de adelante del ala, con las dos barras negras (o manchada si es bataraza)
  ctx.fillStyle = covert; ctx.beginPath(); ctx.moveTo(u * 0.22, 0);
  ctx.bezierCurveTo(u * 0.22, -u * 0.45, u * 0.05, -u * 0.8, -u * 0.12, -u * 0.86);
  ctx.quadraticCurveTo(-u * 0.32, -u * 0.6, -u * 0.32, -u * 0.25); ctx.quadraticCurveTo(-u * 0.25, -u * 0.02, u * 0.22, 0); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = c.bar; ctx.lineWidth = u * 0.06;
  for (const k of [0.42, 0.62]) { ctx.beginPath(); ctx.moveTo(-u * 0.4, -u * (k - 0.02) * 0.55); ctx.quadraticCurveTo(-u * 0.12, -u * k * 0.95, u * 0.1, -u * k * 1.15); ctx.stroke(); }
  if (c.checker) { ctx.fillStyle = c.bar; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-u * 0.25 + (i % 3) * u * 0.14, -u * (0.2 + Math.floor(i / 3) * 0.18), u * 0.04, u * 0.025, 0.4, 0, TAU); ctx.fill(); } }
  const sheen = ctx.createLinearGradient(u * 0.2, 0, -u * 0.3, -u * 0.8); sheen.addColorStop(0, '#ffffff30'); sheen.addColorStop(1, '#00000025');
  ctx.fillStyle = sheen; ctx.fillRect(-u * 0.5, -u, u, u * 1.1);
  ctx.restore();
  ctx.strokeStyle = '#00000040'; ctx.lineWidth = line; ctx.stroke();
  ctx.restore();
}
export function drawPigeon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, t: number, id: number) {
  const c = PIGEONS[id % PIGEONS.length], u = s * 0.68, line = Math.max(0.6, u * 0.03);
  const beat = t * 11 + id * 1.7, flap = Math.sin(beat);
  const bob = Math.cos(beat) * u * 0.06; // el cuerpo sube y baja con el aleteo
  // el ala sube abierta (vista de frente, más alta) y baja de canto (más achatada)
  const angle = -0.45 + flap * 0.85, sy = 0.55 + 0.45 * Math.abs(Math.cos(beat * 0.5 + 0.8));
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(dir, 1); ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(-u * 0.02, -u * 0.12); pigeonWing(ctx, u * 0.92, angle - 0.15, sy * 0.85, c, true); ctx.restore(); // ala de atrás
  // cola en abanico con la banda oscura en la punta
  for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(-u * 0.6, u * 0.02); feather(ctx, u * 0.62, u * 0.22, Math.PI - 0.22 + i * 0.11, c.tail, c.tip, line); ctx.restore(); }
  // patas rosadas recogidas bajo la panza
  ctx.strokeStyle = '#e37a85'; ctx.lineWidth = Math.max(1, u * 0.06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-u * 0.12, u * 0.25); ctx.lineTo(-u * 0.34, u * 0.36); ctx.moveTo(-u * 0.02, u * 0.27); ctx.lineTo(-u * 0.24, u * 0.4); ctx.stroke();
  // cuerpo con volumen: luz de arriba, panza más clara, rabadilla blanca
  const bodyPath = () => { ctx.beginPath(); ctx.moveTo(u * 0.55, -u * 0.22); ctx.bezierCurveTo(u * 0.5, u * 0.22, u * 0.05, u * 0.36, -u * 0.35, u * 0.22); ctx.bezierCurveTo(-u * 0.62, u * 0.12, -u * 0.78, u * 0.0, -u * 0.72, -u * 0.08); ctx.bezierCurveTo(-u * 0.45, -u * 0.22, u * 0.1, -u * 0.38, u * 0.55, -u * 0.22); ctx.closePath(); };
  const bg = ctx.createLinearGradient(0, -u * 0.35, 0, u * 0.32); bg.addColorStop(0, c.back); bg.addColorStop(0.5, c.body); bg.addColorStop(1, c.belly);
  ctx.fillStyle = bg; bodyPath(); ctx.fill();
  ctx.save(); bodyPath(); ctx.clip();
  ctx.fillStyle = c === PIGEONS[2] ? '#ffffff' : '#e5e7eb'; ctx.beginPath(); ctx.ellipse(-u * 0.55, -u * 0.04, u * 0.14, u * 0.1, 0.2, 0, TAU); ctx.fill(); // rabadilla
  const breast = ctx.createRadialGradient(u * 0.35, u * 0.0, 0, u * 0.35, u * 0.0, u * 0.4); breast.addColorStop(0, c === PIGEONS[2] ? '#ffffff00' : '#c4a3b455'); breast.addColorStop(1, '#00000000');
  ctx.fillStyle = breast; ctx.fillRect(-u, -u, u * 2, u * 2); // pecho con un tono rosado
  const hl = ctx.createRadialGradient(u * 0.05, -u * 0.25, 0, u * 0.05, -u * 0.25, u * 0.55); hl.addColorStop(0, '#ffffff40'); hl.addColorStop(1, '#ffffff00');
  ctx.fillStyle = hl; ctx.fillRect(-u, -u, u * 2, u * 2);
  ctx.strokeStyle = '#00000018'; ctx.lineWidth = line; // plumitas del lomo
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-u * 0.35 + i * u * 0.13, -u * 0.12 + Math.sin(i) * u * 0.04, u * 0.07, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#00000045'; ctx.lineWidth = line; bodyPath(); ctx.stroke();
  // cuello tornasolado: el brillo cambia de verde a violeta según el ángulo
  const shift = 0.5 + 0.5 * Math.sin(t * 2 + id);
  const neck = ctx.createLinearGradient(u * 0.35, -u * 0.45, u * 0.65, u * 0.05);
  neck.addColorStop(0, c.head); neck.addColorStop(0.35 + shift * 0.15, c.neckA); neck.addColorStop(0.7, c.neckB); neck.addColorStop(1, c.body);
  ctx.fillStyle = neck; ctx.beginPath(); ctx.ellipse(u * 0.52, -u * 0.2, u * 0.21, u * 0.23, -0.5, 0, TAU); ctx.fill();
  // cabeza, ojo naranja con anillo y pico con carúncula
  const hx = u * 0.74, hy = -u * 0.36, hr = u * 0.18;
  const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.4, hr * 0.1, hx, hy, hr * 1.1); hg.addColorStop(0, c === PIGEONS[2] ? '#ffffff' : '#9aa1ae'); hg.addColorStop(1, c.head);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, hr * 1.05, hr * 0.92, 0.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#00000040'; ctx.lineWidth = line; ctx.stroke();
  ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.moveTo(hx + hr * 0.85, hy - hr * 0.05); ctx.quadraticCurveTo(hx + hr * 1.7, hy + hr * 0.02, hx + hr * 1.75, hy + hr * 0.25); ctx.quadraticCurveTo(hx + hr * 1.3, hy + hr * 0.3, hx + hr * 0.85, hy + hr * 0.25); ctx.closePath(); ctx.fill(); // pico
  ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(hx + hr * 1.0, hy - hr * 0.02, hr * 0.2, hr * 0.12, 0.2, 0, TAU); ctx.fill(); // carúncula
  ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(hx + hr * 0.3, hy - hr * 0.2, hr * 0.32, 0, TAU); ctx.fill(); // anillo del ojo
  ctx.fillStyle = c === PIGEONS[2] ? '#7c2d12' : '#f97316'; ctx.beginPath(); ctx.arc(hx + hr * 0.3, hy - hr * 0.2, hr * 0.24, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0b0b0f'; ctx.beginPath(); ctx.arc(hx + hr * 0.32, hy - hr * 0.2, hr * 0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + hr * 0.38, hy - hr * 0.28, Math.max(0.6, hr * 0.06), 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(u * 0.08, -u * 0.16); pigeonWing(ctx, u, angle, sy, c, false); ctx.restore(); // ala de adelante
  ctx.restore();
}

// ---------------------------------------------------------------- Globo aerostático
// La tela: gajos que siguen la curva del globo (los de los costados se ven más angostos), con luz de un lado,
// costuras, cintas de carga horizontales, una guarda en zigzag en el medio y la válvula de la corona.
const balloons = new Map<string, Sprite>();
export function balloonRadius(t: number, R: number, throat: number) {
  const tm = 0.44;
  return t < tm ? R * Math.sin((t / tm) * Math.PI / 2) ** 0.55 : throat + (R - throat) * Math.cos(((t - tm) / (1 - tm)) * Math.PI / 2) ** 1.1;
}
function paintBalloon(ctx: CanvasRenderingContext2D, R: number, Ht: number, throat: number, hue: number) {
  const N = 9, tilt = 0.07, steps = 44, off = ((hue * 7) % 10) / 10 * (Math.PI / N);
  const r = (t: number) => balloonRadius(t, R, throat);
  const pt = (t: number, th: number): [number, number] => { const rr = r(t); return [rr * Math.sin(th), t * Ht + rr * tilt * Math.cos(th)]; };
  const clampT = (th: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, th));
  const strip = (a: number, b: number, t0: number, t1: number) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const t = t0 + (t1 - t0) * i / steps, [x, y] = pt(t, a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = steps; i >= 0; i--) { const t = t0 + (t1 - t0) * i / steps, [x, y] = pt(t, b); ctx.lineTo(x, y); }
    ctx.closePath();
  };
  const palette = [hsl(hue, 85, 48), hsl(hue + 42, 92, 55), '#f8fafc', hsl(hue + 200, 72, 40)];
  // gajos de colores, con una guarda en el medio
  for (let k = -1; k <= N; k++) {
    const a = clampT(-Math.PI / 2 + k * Math.PI / N + off), b = clampT(-Math.PI / 2 + (k + 1) * Math.PI / N + off);
    if (b - a < 1e-3) continue;
    const ci = ((k % 4) + 4) % 4;
    ctx.fillStyle = palette[ci]; strip(a, b, 0, 1); ctx.fill();
    ctx.fillStyle = palette[(ci + 2) % 4]; strip(a, b, 0.47, 0.58); ctx.fill();
    // zigzag de la guarda
    ctx.fillStyle = palette[(ci + 1) % 4];
    const m = (a + b) / 2, [x1, y1] = pt(0.47, a), [x2, y2] = pt(0.47, b), [xm, ym] = pt(0.53, m), [x3, y3] = pt(0.58, a), [x4, y4] = pt(0.58, b), [xn, yn] = pt(0.52, m);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xm, ym); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(xn, yn); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  // sombreado por franjas finas: la luz viene de arriba a la izquierda
  const S = 60;
  for (let i = 0; i < S; i++) {
    const a = -Math.PI / 2 + i * Math.PI / S, b = a + Math.PI / S + 0.004, m = (a + b) / 2;
    const lambert = Math.cos(m + 0.75);
    if (lambert < 0.55) { ctx.fillStyle = `rgba(15,10,30,${(0.55 - lambert) * 0.55})`; strip(a, b, 0, 1); ctx.fill(); }
    else { ctx.fillStyle = `rgba(255,255,255,${(lambert - 0.55) * 0.35})`; strip(a, b, 0, 1); ctx.fill(); }
  }
  // costuras de los gajos y cintas de carga
  ctx.strokeStyle = 'rgba(40,20,10,0.35)'; ctx.lineWidth = Math.max(0.7, R * 0.012);
  for (let k = 0; k <= N; k++) {
    const a = -Math.PI / 2 + k * Math.PI / N + off; if (a < -Math.PI / 2 || a > Math.PI / 2) continue;
    ctx.beginPath(); for (let i = 0; i <= steps; i++) { const [x, y] = pt(i / steps, a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,20,10,0.22)';
  for (const t of [0.16, 0.3, 0.68, 0.8, 0.9]) { ctx.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = pt(t, -Math.PI / 2 + i * Math.PI / 30); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
  // la corona (válvula de paracaídas) y el brillo
  ctx.fillStyle = 'rgba(20,10,10,0.35)'; ctx.beginPath(); ctx.ellipse(0, Ht * 0.02, R * 0.2, R * 0.045, 0, 0, TAU); ctx.fill();
  const shine = ctx.createRadialGradient(-R * 0.42, Ht * 0.22, 0, -R * 0.42, Ht * 0.22, R * 0.55); shine.addColorStop(0, 'rgba(255,255,255,0.45)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, [x, y] = pt(t, -Math.PI / 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } for (let i = 60; i >= 0; i--) { const t = i / 60, [x, y] = pt(t, Math.PI / 2); ctx.lineTo(x, y); } ctx.closePath(); ctx.clip();
  ctx.fillStyle = shine; ctx.fillRect(-R * 1.2, 0, R * 2.4, Ht);
  const bottom = ctx.createLinearGradient(0, Ht * 0.55, 0, Ht); bottom.addColorStop(0, 'rgba(0,0,0,0)'); bottom.addColorStop(1, 'rgba(10,5,20,0.4)');
  ctx.fillStyle = bottom; ctx.fillRect(-R * 1.2, 0, R * 2.4, Ht * 1.05);
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,10,10,0.45)'; ctx.lineWidth = Math.max(1, R * 0.015);
  ctx.beginPath(); for (let i = 0; i <= 60; i++) { const [x, y] = pt(i / 60, -Math.PI / 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } for (let i = 60; i >= 0; i--) { const [x, y] = pt(i / 60, Math.PI / 2); ctx.lineTo(x, y); } ctx.stroke();
}
// Dibuja la tela con la boca (garganta) centrada en (cx, throatY) y alto total Ht.
export function drawBalloonEnvelope(ctx: CanvasRenderingContext2D, cx: number, throatY: number, R: number, Ht: number, throat: number, hue: number) {
  const sp = cached(balloons, `${Math.round(R)}|${Math.round(Ht)}|${Math.round(throat)}|${hue}|${pixelRatio()}`, () => makeSprite(R * 2.1, Ht + R * 0.2, R * 1.05, R * 0.05, c => paintBalloon(c, R, Ht, throat, hue)));
  blit(ctx, sp, cx, throatY - Ht);
}

// ---------------------------------------------------------------- El trepador
// El protagonista de Trepaluna, con los mismos colores de siempre (gorra azul, remera azul y amarilla,
// pantalón blanco) pero con más detalle: brazos y piernas con codos y rodillas que se doblan al correr,
// sombras, contorno, zapatillas con suela, cinturón con la bolsita de magnesio, cara con ojo, ceja y boca.
export interface ClimberPose {
  x: number; y: number; w: number; h: number; // rectángulo en pantalla (arriba a la izquierda)
  facing: 1 | -1; time: number;
  running: boolean; airborne: boolean; climbing: boolean; falling: boolean; burnt: boolean;
}
type P = [number, number];
export function drawClimber(ctx: CanvasRenderingContext2D, pose: ClimberPose) {
  const { x, y, w, h, facing: f, time: t, burnt } = pose;
  const C = burnt
    ? { skin: '#5b5550', skinDark: '#3f3a36', shirt: ['#2b2926', '#3a3632', '#2b2926'], pants: '#4a4643', pantsDark: '#35322f', cap: '#1c1917', brim: '#141210', shoe: '#1c1917', sole: '#44403c', hair: '#1c1917', belt: '#1c1917', bag: '#44403c', outline: '#0c0a09' }
    : { skin: '#f6cfa9', skinDark: '#d9a27c', shirt: ['#1d4ed8', '#facc15', '#1d4ed8'], pants: '#f8fafc', pantsDark: '#cbd5e1', cap: '#2563eb', brim: '#1e40af', shoe: '#1f2937', sole: '#f1f5f9', hair: '#3b2412', belt: '#3f2a1a', bag: '#f1f5f9', outline: '#1e1b2e' };
  const cx = x + w / 2;
  // proporciones (fracciones del alto)
  const thigh = h * 0.19, shin = h * 0.19, upper = h * 0.15, fore = h * 0.14, headR = h * 0.13;
  const walk = t * 13, run = pose.running, climb = pose.climbing, air = pose.airborne && !climb, fall = pose.falling;
  const idle = !run && !air && !climb && !fall;
  const bob = run ? Math.abs(Math.sin(walk)) * h * 0.025 : idle ? Math.sin(t * 2.4) * h * 0.006 : 0;
  const lean = run ? 0.13 : air ? 0.06 : 0;
  const hip: P = [cx - f * w * 0.02, y + h * 0.6 - bob];
  const shoulder: P = [hip[0] + f * Math.sin(lean) * h * 0.24, hip[1] - h * 0.24];
  // ángulos: 0 = colgando hacia abajo, positivo = hacia adelante (hacia donde mira)
  const legAngles = (side: number): [number, number] => {
    if (run) { const ph = walk + (side > 0 ? 0 : Math.PI); return [0.62 * Math.sin(ph), 0.12 + 1.0 * Math.max(0, Math.cos(ph))]; }
    if (climb) { const ph = t * 12 + (side > 0 ? 0 : Math.PI); return [0.55 + 0.45 * Math.sin(ph), 1.1 + 0.5 * Math.sin(ph)]; }
    if (fall) return side > 0 ? [0.5 + 0.3 * Math.sin(t * 17), 0.8] : [-0.3 + 0.3 * Math.sin(t * 15 + 1), 0.5];
    if (air) return side > 0 ? [0.85, 1.25] : [-0.15, 0.7];
    return [side > 0 ? 0.06 : -0.05, 0.05];
  };
  const armAngles = (side: number): [number, number] => {
    if (run) { const ph = walk + (side > 0 ? Math.PI : 0); return [0.75 * Math.sin(ph), 1.2 + 0.25 * Math.sin(ph)]; }
    if (climb) { const ph = t * 12 + (side > 0 ? Math.PI : 0); return [2.75 + 0.3 * Math.sin(ph), 0.2 + 0.25 * Math.max(0, -Math.sin(ph))]; }
    if (fall) return [2.5 + 0.4 * Math.sin(t * 20 + side * 2), 0.5 + 0.3 * Math.sin(t * 23 + side)];
    if (air) return side > 0 ? [2.35, 0.45] : [1.7, 0.7];
    return [side > 0 ? 0.12 : -0.08, 0.35];
  };
  const dirv = (a: number): P => [f * Math.sin(a), Math.cos(a)];
  const add = (p: P, d: P, l: number): P => [p[0] + d[0] * l, p[1] + d[1] * l];
  const lw = Math.max(1.5, w * 0.13), ow = Math.max(0.7, w * 0.035);
  const stroke = (pts: P[], width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const leg = (side: number) => {
    const back = side < 0, [a, k] = legAngles(side);
    const hp: P = [hip[0] + f * side * w * 0.04, hip[1]];
    const knee = add(hp, dirv(a), thigh), foot = add(knee, dirv(a - k), shin);
    stroke([hp, knee, foot], lw * 1.08 + ow * 2, C.outline);
    stroke([hp, knee, foot], lw * 1.08, back ? C.pantsDark : C.pants);
    if (!back) { ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = Math.max(0.6, lw * 0.25); ctx.beginPath(); ctx.moveTo(hp[0] + f * lw * 0.25, hp[1]); ctx.lineTo(knee[0] + f * lw * 0.25, knee[1]); ctx.stroke(); } // brillo de la tela
    else { ctx.strokeStyle = '#64748b55'; ctx.lineWidth = Math.max(0.6, lw * 0.18); ctx.beginPath(); ctx.moveTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke(); }
    // zapatilla: capellada oscura, suela clara y una franja de color
    const sx = foot[0], sy = foot[1] + lw * 0.15;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(f, 1); ctx.rotate(climb || air || fall ? (a - k) * 0.6 : 0);
    const L = w * 0.27, Hh = w * 0.11;
    ctx.fillStyle = C.outline; ctx.beginPath(); ctx.roundRect(-L * 0.32 - ow, -Hh - ow, L + ow * 2, Hh * 1.45 + ow * 2, Hh * 0.6); ctx.fill();
    ctx.fillStyle = back ? '#111827' : C.shoe; ctx.beginPath(); ctx.roundRect(-L * 0.32, -Hh, L, Hh * 1.1, [Hh * 0.7, Hh * 0.9, Hh * 0.3, Hh * 0.3]); ctx.fill();
    ctx.fillStyle = C.sole; ctx.fillRect(-L * 0.32, Hh * 0.05, L, Hh * 0.35);
    if (!burnt) { ctx.fillStyle = back ? '#ca8a04' : '#facc15'; ctx.beginPath(); ctx.moveTo(-L * 0.2, -Hh * 0.1); ctx.quadraticCurveTo(L * 0.2, -Hh * 0.2, L * 0.45, -Hh * 0.7); ctx.lineTo(L * 0.5, -Hh * 0.45); ctx.quadraticCurveTo(L * 0.2, Hh * 0.05, -L * 0.2, Hh * 0.02); ctx.fill(); }
    ctx.restore();
  };
  const arm = (side: number) => {
    const back = side < 0, [a, k] = armAngles(side);
    const sp: P = [shoulder[0] - f * side * w * 0.02, shoulder[1] + h * 0.02];
    const elbow = add(sp, dirv(a), upper), hand = add(elbow, dirv(a + k), fore);
    const aw = lw * 0.78;
    stroke([sp, elbow, hand], aw + ow * 2, C.outline);
    stroke([sp, elbow, hand], aw, back ? C.skinDark : C.skin);
    // manga corta de la remera
    const sleeve = add(sp, dirv(a), upper * 0.35);
    stroke([sp, sleeve], aw * 1.2 + ow * 2, C.outline);
    stroke([sp, sleeve], aw * 1.2, back ? '#1e3a8a' : C.shirt[0]);
    ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(hand[0], hand[1], aw * 0.55 + ow, 0, TAU); ctx.fill();
    ctx.fillStyle = back ? C.skinDark : C.skin; ctx.beginPath(); ctx.arc(hand[0], hand[1], aw * 0.55, 0, TAU); ctx.fill();
  };
  arm(-1); leg(-1);
  // torso: remera de tres franjas con sombra del lado de atrás y pliegues
  const tw = w * 0.4;
  const torso = () => {
    ctx.beginPath();
    const bx = (k: number): P => [shoulder[0] + (hip[0] - shoulder[0]) * k, shoulder[1] + (hip[1] - shoulder[1]) * k];
    const [s0x, s0y] = bx(0), [s1x, s1y] = bx(1.05);
    ctx.moveTo(s0x - tw * 0.5, s0y); ctx.quadraticCurveTo(s0x, s0y - h * 0.03, s0x + tw * 0.5, s0y);
    ctx.lineTo(s1x + tw * 0.46, s1y); ctx.lineTo(s1x - tw * 0.46, s1y); ctx.closePath();
  };
  ctx.fillStyle = C.outline; ctx.save(); ctx.lineWidth = ow * 2; ctx.strokeStyle = C.outline; torso(); ctx.stroke(); ctx.restore();
  ctx.save(); torso(); ctx.clip();
  const top = shoulder[1] - h * 0.03, span = hip[1] - top;
  ctx.fillStyle = C.shirt[0]; ctx.fillRect(x - w, top, w * 3, span / 3 + 1);
  ctx.fillStyle = C.shirt[1]; ctx.fillRect(x - w, top + span / 3, w * 3, span / 3 + 1);
  ctx.fillStyle = C.shirt[2]; ctx.fillRect(x - w, top + span * 2 / 3, w * 3, span / 3 + h * 0.02);
  const sh = ctx.createLinearGradient(cx - f * tw * 0.5, 0, cx + f * tw * 0.5, 0); sh.addColorStop(0, 'rgba(0,0,0,0.32)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = sh; ctx.fillRect(x - w, top, w * 3, span + h * 0.05);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(0.6, w * 0.03); // pliegues
  for (const k of [0.3, 0.62]) { ctx.beginPath(); ctx.moveTo(cx - f * tw * 0.3, top + span * k); ctx.quadraticCurveTo(cx, top + span * (k + 0.06), cx + f * tw * 0.2, top + span * (k + 0.02)); ctx.stroke(); }
  ctx.restore();
  // cinturón, bolsita de magnesio colgando atrás
  ctx.fillStyle = C.outline; ctx.fillRect(hip[0] - tw * 0.5 - ow, hip[1] - h * 0.03 - ow, tw + ow * 2, h * 0.05 + ow * 2);
  ctx.fillStyle = C.belt; ctx.fillRect(hip[0] - tw * 0.5, hip[1] - h * 0.03, tw, h * 0.05);
  ctx.fillStyle = burnt ? '#57534e' : '#d4d4d8'; ctx.fillRect(hip[0] + f * tw * 0.15 - h * 0.015, hip[1] - h * 0.03, h * 0.03, h * 0.05); // hebilla
  const bagX = hip[0] - f * tw * 0.5, bagY = hip[1] + h * 0.01;
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.roundRect(bagX - w * 0.08 - ow, bagY - ow, w * 0.16 + ow * 2, h * 0.08 + ow * 2, w * 0.05); ctx.fill();
  ctx.fillStyle = C.bag; ctx.beginPath(); ctx.roundRect(bagX - w * 0.08, bagY, w * 0.16, h * 0.08, w * 0.04); ctx.fill();
  ctx.fillStyle = burnt ? '#292524' : '#dc2626'; ctx.fillRect(bagX - w * 0.08, bagY, w * 0.16, h * 0.02);
  leg(1);
  // cabeza: cuello, cara con sombra, oreja, ojo, ceja, nariz y boca, y la gorra con visera
  const hx = shoulder[0] + f * h * 0.035, hy = shoulder[1] - h * 0.145;
  stroke([[shoulder[0], shoulder[1]], [hx - f * headR * 0.15, hy + headR * 0.6]], w * 0.2 + ow * 2, C.outline);
  stroke([[shoulder[0], shoulder[1]], [hx - f * headR * 0.15, hy + headR * 0.6]], w * 0.2, C.skinDark);
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.ellipse(hx, hy, headR + ow, headR * 1.08 + ow, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + f * headR * 0.92, hy + headR * 0.18, headR * 0.24 + ow, 0, TAU); ctx.fill();
  const face = ctx.createRadialGradient(hx + f * headR * 0.35, hy - headR * 0.2, headR * 0.1, hx, hy, headR * 1.15);
  face.addColorStop(0, burnt ? C.skin : '#ffe4c8'); face.addColorStop(0.6, C.skin); face.addColorStop(1, C.skinDark);
  ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(hx, hy, headR, headR * 1.08, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + f * headR * 0.92, hy + headR * 0.18, headR * 0.24, 0, TAU); ctx.fill(); // nariz
  ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.62, hy + headR * 0.15, headR * 0.42, headR * 0.6, 0, 0, TAU); ctx.fill(); // pelo de la nuca
  ctx.fillStyle = burnt ? '#3f3a36' : '#eab08a'; ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.1, hy + headR * 0.12, headR * 0.2, headR * 0.27, 0, 0, TAU); ctx.fill(); // oreja
  ctx.strokeStyle = burnt ? '#292524' : '#c27c58'; ctx.lineWidth = Math.max(0.5, headR * 0.07); ctx.beginPath(); ctx.arc(hx - f * headR * 0.1, hy + headR * 0.12, headR * 0.11, 0, TAU); ctx.stroke();
  const ex = hx + f * headR * 0.5, ey = hy - headR * 0.02;
  if (fall) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, headR * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, ey, headR * 0.09, 0, TAU); ctx.fill(); } // ojos bien abiertos del susto
  else {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, ey, headR * 0.17, headR * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = burnt ? '#e7e5e4' : '#3b2a1a'; ctx.beginPath(); ctx.arc(ex + f * headR * 0.06, ey + headR * 0.02, headR * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b0b0f'; ctx.beginPath(); ctx.arc(ex + f * headR * 0.08, ey + headR * 0.02, headR * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + f * headR * 0.1, ey - headR * 0.04, Math.max(0.5, headR * 0.035), 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = C.hair; ctx.lineWidth = Math.max(0.7, headR * 0.1); ctx.beginPath(); ctx.moveTo(ex - f * headR * 0.18, ey - headR * 0.3); ctx.lineTo(ex + f * headR * 0.18, ey - headR * 0.34); ctx.stroke(); // ceja
  ctx.strokeStyle = burnt ? '#1c1917' : '#9a4a3a'; ctx.lineWidth = Math.max(0.6, headR * 0.07); ctx.beginPath(); // boca: abierta si cae o salta
  if (fall || air) { ctx.fillStyle = '#5b1d1d'; ctx.ellipse(hx + f * headR * 0.62, hy + headR * 0.55, headR * 0.12, headR * (fall ? 0.16 : 0.08), 0, 0, TAU); ctx.fill(); }
  else { ctx.moveTo(hx + f * headR * 0.45, hy + headR * 0.55); ctx.quadraticCurveTo(hx + f * headR * 0.62, hy + headR * 0.62, hx + f * headR * 0.76, hy + headR * 0.5); ctx.stroke(); }
  if (!burnt) { ctx.fillStyle = 'rgba(244,114,114,0.25)'; ctx.beginPath(); ctx.arc(hx + f * headR * 0.42, hy + headR * 0.35, headR * 0.15, 0, TAU); ctx.fill(); } // cachete
  // gorra: copa con gajos y brillo, botón amarillo y visera hacia adelante
  const capTop = () => { ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.03, hy - headR * 0.2, headR * 1.06, headR * 0.92, 0, Math.PI, TAU); ctx.closePath(); };
  ctx.fillStyle = C.outline; ctx.save(); ctx.lineWidth = ow * 2; ctx.strokeStyle = C.outline; capTop(); ctx.stroke(); ctx.restore();
  const capG = ctx.createLinearGradient(hx - headR, hy - headR * 1.1, hx + headR, hy - headR * 0.2);
  capG.addColorStop(0, burnt ? C.cap : f > 0 ? '#1e40af' : '#60a5fa'); capG.addColorStop(1, burnt ? C.cap : f > 0 ? '#60a5fa' : '#1e40af');
  ctx.fillStyle = capG; capTop(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(0.5, headR * 0.06);
  ctx.beginPath(); ctx.moveTo(hx + f * headR * 0.1, hy - headR * 1.1); ctx.quadraticCurveTo(hx + f * headR * 0.5, hy - headR * 0.75, hx + f * headR * 0.55, hy - headR * 0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + f * headR * 0.1, hy - headR * 1.1); ctx.quadraticCurveTo(hx - f * headR * 0.4, hy - headR * 0.75, hx - f * headR * 0.5, hy - headR * 0.22); ctx.stroke();
  if (!burnt) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + f * headR * 0.42, hy - headR * 0.55, headR * 0.17, 0, TAU); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(hx + f * headR * 0.42, hy - headR * 0.55, headR * 0.1, 0, TAU); ctx.fill(); } // logo
  ctx.fillStyle = burnt ? C.cap : '#facc15'; ctx.beginPath(); ctx.arc(hx - f * headR * 0.03, hy - headR * 1.1, headR * 0.13, 0, TAU); ctx.fill(); // botón
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.ellipse(hx + f * headR * 1.0, hy - headR * 0.2, headR * 0.72 + ow, headR * 0.16 + ow, f * 0.08, 0, TAU); ctx.fill();
  ctx.fillStyle = C.brim; ctx.beginPath(); ctx.ellipse(hx + f * headR * 1.0, hy - headR * 0.2, headR * 0.72, headR * 0.16, f * 0.08, 0, TAU); ctx.fill(); // visera
  arm(1);
  ctx.restore();
}
