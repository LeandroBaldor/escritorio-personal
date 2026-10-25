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
  const L = s * 4.4, H = s * 0.7;
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
  const c = PIGEONS[id % PIGEONS.length], u = s * 0.46, line = Math.max(0.6, u * 0.03);
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
// La tela, como la de un globo de verdad: gajos de nailon que siguen la curva (los de los costados se ven
// más angostos), cada gajo un poco inflado entre sus cintas de carga (más oscuro en las costuras), paños
// horizontales cosidos, una corona oscura arriba, una franja con filetes en el medio, la luz del sol de
// arriba a la izquierda con un reflejo satinado, el reflejo azulado del cielo del lado de la sombra y la
// parte de abajo más oscura. Se pinta una sola vez en alta resolución.
const balloons = new Map<string, Sprite>();
export function balloonRadius(t: number, R: number, throat: number) {
  const tm = 0.4;
  return t < tm ? R * Math.sin((t / tm) * Math.PI / 2) ** 0.5 : throat + (R - throat) * Math.cos(((t - tm) / (1 - tm)) * Math.PI / 2) ** 1.25;
}
const BALLOON_SCHEMES = [ // [color principal, segundo color, tercer color, corona y franja]
  (h: number) => [hsl(h, 72, 45), hsl(h + 40, 82, 52), hsl(h, 72, 45), hsl(h + 200, 45, 24)],
  (h: number) => [hsl(h, 68, 46), '#f1ede4', hsl(h + 180, 55, 38), hsl(h, 60, 22)],
  (h: number) => [hsl(h, 75, 47), hsl(h + 60, 75, 48), hsl(h + 120, 60, 40), hsl(h + 240, 50, 26)],
  (h: number) => [hsl(h, 64, 40), hsl(h, 70, 55), hsl(h + 30, 85, 55), '#2a2420'],
];
function paintBalloon(ctx: CanvasRenderingContext2D, R: number, Ht: number, throat: number, hue: number) {
  const N = 12, tilt = 0.06, steps = 48, off = ((hue * 7) % 10) / 10 * (Math.PI / N);
  const r = (t: number) => balloonRadius(t, R, throat);
  const pt = (t: number, th: number): [number, number] => { const rr = r(t); return [rr * Math.sin(th), t * Ht + rr * tilt * Math.cos(th)]; };
  const clampT = (th: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, th));
  const strip = (a: number, b: number, t0: number, t1: number) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const t = t0 + (t1 - t0) * i / steps, [x, y] = pt(t, a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = steps; i >= 0; i--) { const t = t0 + (t1 - t0) * i / steps, [x, y] = pt(t, b); ctx.lineTo(x, y); }
    ctx.closePath();
  };
  const ring = (t: number) => { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = pt(t, -Math.PI / 2 + i * Math.PI / 40); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } };
  const outline = () => { ctx.beginPath(); for (let i = 0; i <= 80; i++) { const [x, y] = pt(i / 80, -Math.PI / 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } for (let i = 80; i >= 0; i--) { const [x, y] = pt(i / 80, Math.PI / 2); ctx.lineTo(x, y); } ctx.closePath(); };
  const pal = BALLOON_SCHEMES[hue % BALLOON_SCHEMES.length](hue);
  // gajos: patrón A B A C alrededor, corona oscura y una franja con filetes claros
  for (let k = -1; k <= N; k++) {
    const a = clampT(-Math.PI / 2 + k * Math.PI / N + off), b = clampT(-Math.PI / 2 + (k + 1) * Math.PI / N + off);
    if (b - a < 1e-3) continue;
    const ci = ((k % 4) + 4) % 4;
    ctx.fillStyle = [pal[0], pal[1], pal[0], pal[2]][ci]; strip(a, b, 0, 1); ctx.fill();
    ctx.fillStyle = pal[3]; strip(a, b, 0, 0.1); ctx.fill(); strip(a, b, 0.5, 0.6); ctx.fill();
    ctx.fillStyle = '#efe6d2'; strip(a, b, 0.49, 0.505); ctx.fill(); strip(a, b, 0.595, 0.61); ctx.fill();
    // cada gajo se infla entre sus costuras: más oscuro en los bordes
    for (let j = 0; j < 8; j++) {
      const u = (j + 0.5) / 8, edge = Math.abs(u - 0.5) * 2, sa = a + (b - a) * j / 8, sb = a + (b - a) * (j + 1) / 8 + 0.002;
      if (edge > 0.5) { ctx.fillStyle = `rgba(20,10,20,${(edge - 0.5) * 0.32})`; strip(sa, sb, 0, 1); ctx.fill(); }
      else if (edge < 0.3) { ctx.fillStyle = `rgba(255,255,255,${(0.3 - edge) * 0.18})`; strip(sa, sb, 0.04, 0.95); ctx.fill(); }
    }
  }
  // luz del sol (de arriba a la izquierda), sombra y reflejo azulado del cielo del lado de atrás
  const S = 72;
  for (let i = 0; i < S; i++) {
    const a = -Math.PI / 2 + i * Math.PI / S, b = a + Math.PI / S + 0.003, m = (a + b) / 2;
    const lambert = Math.cos(m + 0.7);
    if (lambert < 0.5) { ctx.fillStyle = `rgba(18,12,35,${(0.5 - lambert) * 0.62})`; strip(a, b, 0, 1); ctx.fill(); }
    else { ctx.fillStyle = `rgba(255,248,235,${(lambert - 0.5) * 0.3})`; strip(a, b, 0, 1); ctx.fill(); }
    if (m > 1.05) { ctx.fillStyle = `rgba(150,195,255,${(m - 1.05) * 0.35})`; strip(a, b, 0.05, 0.85); ctx.fill(); }
  }
  ctx.save(); outline(); ctx.clip();
  const vert = ctx.createLinearGradient(0, 0, 0, Ht); // arriba le da más el sol; abajo, en la boca, queda en sombra
  vert.addColorStop(0, 'rgba(255,250,240,0.18)'); vert.addColorStop(0.35, 'rgba(255,255,255,0)'); vert.addColorStop(0.75, 'rgba(10,5,20,0.12)'); vert.addColorStop(1, 'rgba(10,5,20,0.5)');
  ctx.fillStyle = vert; ctx.fillRect(-R * 1.2, 0, R * 2.4, Ht);
  // reflejo satinado del nailon, que sigue la curva del globo
  ctx.save(); ctx.translate(-R * 0.42, Ht * 0.24); ctx.rotate(-0.25); ctx.scale(0.45, 1);
  const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.5); shine.addColorStop(0, 'rgba(255,255,255,0.42)'); shine.addColorStop(0.5, 'rgba(255,255,255,0.12)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  // costuras: paños horizontales (finitas) y cintas de carga verticales (más marcadas)
  ctx.lineWidth = Math.max(0.5, R * 0.006); ctx.strokeStyle = 'rgba(30,15,10,0.16)';
  for (let t = 0.065; t < 0.97; t += 0.065) { ring(t); ctx.stroke(); }
  ctx.lineWidth = Math.max(0.7, R * 0.012); ctx.strokeStyle = 'rgba(35,20,12,0.4)';
  for (let k = 0; k <= N; k++) {
    const a = -Math.PI / 2 + k * Math.PI / N + off; if (a < -Math.PI / 2 || a > Math.PI / 2) continue;
    ctx.beginPath(); for (let i = 0; i <= steps; i++) { const [x, y] = pt(i / steps, a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(35,20,12,0.3)'; for (const t of [0.1, 0.5, 0.6]) { ring(t); ctx.stroke(); }
  // válvula de la corona
  ctx.fillStyle = 'rgba(15,10,10,0.35)'; ctx.beginPath(); ctx.ellipse(0, Ht * 0.012, R * 0.16, R * 0.03, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,10,0.5)'; ctx.lineWidth = Math.max(1, R * 0.012); outline(); ctx.stroke();
}
// Dibuja la tela con la boca (garganta) centrada en (cx, throatY) y alto total Ht.
export function drawBalloonEnvelope(ctx: CanvasRenderingContext2D, cx: number, throatY: number, R: number, Ht: number, throat: number, hue: number) {
  const sp = cached(balloons, `${Math.round(R)}|${Math.round(Ht)}|${Math.round(throat)}|${hue}|${pixelRatio()}`, () => makeSprite(R * 2.1, Ht + R * 0.2, R * 1.05, R * 0.05, c => paintBalloon(c, R, Ht, throat, hue)));
  blit(ctx, sp, cx, throatY - Ht);
}

// La canasta de mimbre tejido (varillas verticales y fibras que pasan por delante y por detrás), con el borde
// acolchado de cuero, esquineros de cuero, la base con patines de madera y las manijas de soga.
const baskets = new Map<string, Sprite>();
function paintBasket(ctx: CanvasRenderingContext2D, w: number, bh: number, s: number) {
  const body = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w - w * 0.03, bh - s * 0.08); ctx.quadraticCurveTo(w - w * 0.035, bh, w - w * 0.08, bh); ctx.lineTo(w * 0.08, bh); ctx.quadraticCurveTo(w * 0.035, bh, w * 0.03, bh - s * 0.08); ctx.closePath(); };
  ctx.fillStyle = '#8a6234'; body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  const row = Math.max(2.5, s * 0.065), stake = Math.max(4, s * 0.13);
  for (let r = 0, y = s * 0.12; y < bh; r++, y += row) {
    for (let c = 0, x = -stake / 2; x < w + stake; c++, x += stake) {
      const over = (r + c) % 2 === 0;
      const g = ctx.createLinearGradient(0, y, 0, y + row);
      if (over) { g.addColorStop(0, '#e6c993'); g.addColorStop(0.45, '#cfa766'); g.addColorStop(1, '#8f6a37'); }
      else { g.addColorStop(0, '#a98450'); g.addColorStop(1, '#6e4f28'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + (over ? 0 : stake * 0.15), y + row * 0.08, over ? stake * 1.02 : stake * 0.7, row * 0.86, row * 0.45); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(60,35,10,0.35)'; for (let x = 0; x < w + stake; x += stake) ctx.fillRect(x - Math.max(0.6, s * 0.012), s * 0.1, Math.max(1.2, s * 0.024), bh); // varillas
  const shade = ctx.createLinearGradient(0, 0, w, 0); shade.addColorStop(0, 'rgba(30,15,5,0.45)'); shade.addColorStop(0.3, 'rgba(255,240,210,0.08)'); shade.addColorStop(0.55, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(30,15,5,0.5)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, bh);
  const under = ctx.createLinearGradient(0, 0, 0, bh); under.addColorStop(0, 'rgba(20,10,0,0.35)'); under.addColorStop(0.25, 'rgba(0,0,0,0)'); under.addColorStop(0.85, 'rgba(0,0,0,0)'); under.addColorStop(1, 'rgba(20,10,0,0.35)');
  ctx.fillStyle = under; ctx.fillRect(0, 0, w, bh);
  ctx.restore();
  // esquineros y base de cuero, patines de madera
  ctx.fillStyle = '#5a3418'; ctx.fillRect(0, s * 0.1, s * 0.09, bh - s * 0.15); ctx.fillRect(w - s * 0.09, s * 0.1, s * 0.09, bh - s * 0.15);
  ctx.fillStyle = '#4a2a12'; ctx.beginPath(); ctx.roundRect(w * 0.02, bh - s * 0.1, w * 0.96, s * 0.1, s * 0.04); ctx.fill();
  ctx.fillStyle = '#6b4423'; ctx.fillRect(w * 0.12, bh - s * 0.01, w * 0.2, s * 0.05); ctx.fillRect(w * 0.68, bh - s * 0.01, w * 0.2, s * 0.05);
  // borde acolchado de gamuza con costura
  const pad = ctx.createLinearGradient(0, -s * 0.06, 0, s * 0.16); pad.addColorStop(0, '#9a6a3c'); pad.addColorStop(0.45, '#6e4422'); pad.addColorStop(1, '#3d2410');
  ctx.fillStyle = pad; ctx.beginPath(); ctx.roundRect(-s * 0.05, -s * 0.06, w + s * 0.1, s * 0.2, s * 0.09); ctx.fill();
  ctx.strokeStyle = 'rgba(240,215,170,0.7)'; ctx.lineWidth = Math.max(0.6, s * 0.012); ctx.setLineDash([Math.max(1.5, s * 0.04), Math.max(1.5, s * 0.035)]);
  ctx.beginPath(); ctx.moveTo(0, s * 0.03); ctx.lineTo(w, s * 0.03); ctx.stroke(); ctx.setLineDash([]);
  // manijas de soga a los costados
  ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = Math.max(1, s * 0.03);
  for (const hx of [w * 0.22, w * 0.78]) { ctx.beginPath(); ctx.arc(hx, bh * 0.38, s * 0.1, 0.1, Math.PI - 0.1); ctx.stroke(); }
}
// Todo lo que cuelga del globo: cables, armazón y quemador (con su llama), mangueras, el piloto y la canasta.
export function drawBalloonRig(ctx: CanvasRenderingContext2D, o: { cx: number; x: number; y: number; w: number; s: number; throatY: number; throat: number; rising: boolean; t: number; id: number }, envelope: () => void) {
  const { cx, x, y, w, s, throatY, throat, rising, t, id } = o;
  const frameY = y - s * 0.62, fw = s * 0.36, bh = s * 0.85;
  // cables de acero de la boca del globo al armazón del quemador
  ctx.strokeStyle = '#3b2f2a'; ctx.lineWidth = Math.max(0.8, s * 0.022);
  ctx.beginPath(); for (const [a, b] of [[-1, -1], [-0.45, -0.6], [0.45, 0.6], [1, 1]]) { ctx.moveTo(cx + a * throat * 0.95, throatY + s * 0.2); ctx.lineTo(cx + b * fw, frameY); } ctx.stroke();
  // llama del quemador (sube por adentro de la boca del globo) y su resplandor
  if (rising) {
    const fl = 0.8 + 0.2 * Math.sin(t * 37 + id) + 0.1 * Math.sin(t * 23);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, frameY - s * 0.5, s * 0.1, cx, frameY - s * 0.5, s * 1.1);
    glow.addColorStop(0, 'rgba(255,170,70,0.38)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, frameY - s * 0.5, s * 1.1, 0, TAU); ctx.fill();
    for (const [wd, len, c0, c1, c2] of [[0.2, 1.15, '#3b82f6', '#fb923c', '#dc262600'], [0.12, 0.85, '#93c5fd', '#fde68a', '#f9731600'], [0.06, 0.45, '#ffffff', '#fef9c3', '#fde04700']] as const) {
      const top = frameY - s * 0.12 - s * len * fl, g = ctx.createLinearGradient(0, frameY - s * 0.1, 0, top);
      g.addColorStop(0, c0); g.addColorStop(0.35, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - s * wd, frameY - s * 0.1);
      ctx.bezierCurveTo(cx - s * wd * 1.4, frameY - s * len * 0.5, cx + Math.sin(t * 19) * s * 0.06, top + s * 0.2, cx + Math.sin(t * 13) * s * 0.04, top);
      ctx.bezierCurveTo(cx + Math.sin(t * 17) * s * 0.06, top + s * 0.2, cx + s * wd * 1.4, frameY - s * len * 0.5, cx + s * wd, frameY - s * 0.1); ctx.fill();
    }
    ctx.restore();
  }
  envelope();
  // pollera de lona (ignífuga) en la boca, iluminada por la llama
  const skirt = ctx.createLinearGradient(cx - throat, 0, cx + throat, 0); skirt.addColorStop(0, '#2b1a10'); skirt.addColorStop(0.4, '#5c3a22'); skirt.addColorStop(1, '#1e120a');
  ctx.fillStyle = skirt; ctx.beginPath(); ctx.moveTo(cx - throat, throatY - 1); ctx.lineTo(cx + throat, throatY - 1); ctx.lineTo(cx + throat * 0.78, throatY + s * 0.22); ctx.lineTo(cx - throat * 0.78, throatY + s * 0.22); ctx.closePath(); ctx.fill();
  if (rising) { ctx.fillStyle = 'rgba(255,170,80,0.35)'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(0.6, s * 0.012); for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(cx + throat * k, throatY); ctx.lineTo(cx + throat * k * 0.78, throatY + s * 0.22); ctx.stroke(); }
  // varillas del armazón, forradas en gamuza, de la canasta al quemador
  for (const side of [-1, 1]) {
    const bx = side < 0 ? x + w * 0.1 : x + w * 0.9, tx = cx + side * fw;
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(1.2, s * 0.04); ctx.beginPath(); ctx.moveTo(tx, frameY); ctx.lineTo(tx + (bx - tx) * 0.15, frameY + (y - frameY) * 0.15); ctx.stroke();
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = Math.max(2, s * 0.075); ctx.beginPath(); ctx.moveTo(tx + (bx - tx) * 0.15, frameY + (y - frameY) * 0.15); ctx.lineTo(bx, y); ctx.stroke();
  }
  // mangueras de gas
  ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(1, s * 0.03);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * s * 0.12, frameY + s * 0.1); ctx.bezierCurveTo(cx + side * s * 0.45, frameY + s * 0.3, cx + side * s * 0.1, y - s * 0.1, cx + side * s * 0.3, y + s * 0.05); ctx.stroke(); }
  // quemador doble: serpentines de acero, válvulas y la llamita piloto azul
  for (const side of [-1, 1]) {
    const bx = cx + side * s * 0.13, g = ctx.createLinearGradient(bx - s * 0.12, 0, bx + s * 0.12, 0);
    g.addColorStop(0, '#475569'); g.addColorStop(0.4, '#e2e8f0'); g.addColorStop(1, '#334155');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx - s * 0.12, frameY - s * 0.14, s * 0.24, s * 0.24, s * 0.04); ctx.fill();
    ctx.strokeStyle = 'rgba(30,41,59,0.6)'; ctx.lineWidth = Math.max(0.6, s * 0.012); for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(bx - s * 0.12, frameY - s * 0.14 + s * 0.048 * k); ctx.lineTo(bx + s * 0.12, frameY - s * 0.14 + s * 0.048 * k); ctx.stroke(); }
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(bx, frameY + s * 0.15, s * 0.04, 0, TAU); ctx.fill(); // válvula
  }
  ctx.fillStyle = '#64748b'; ctx.fillRect(cx - fw, frameY + s * 0.08, fw * 2, Math.max(1.5, s * 0.04)); // travesaño del armazón
  ctx.fillStyle = 'rgba(96,165,250,0.85)'; ctx.beginPath(); ctx.ellipse(cx, frameY - s * 0.17, s * 0.03, s * 0.05, 0, 0, TAU); ctx.fill();
  // el piloto, asomado por encima del borde; cuando sube el globo, levanta el brazo a la válvula
  const px = x + w * 0.27, py = y - s * 0.2, hr = s * 0.12;
  ctx.fillStyle = '#1f3b5c'; ctx.beginPath(); ctx.roundRect(px - s * 0.17, py + hr * 0.7, s * 0.34, s * 0.4, s * 0.1); ctx.fill(); // campera
  if (rising) { ctx.strokeStyle = '#1f3b5c'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px + s * 0.12, py + hr); ctx.lineTo(cx - s * 0.16, frameY + s * 0.16); ctx.stroke(); ctx.fillStyle = '#e8b48a'; ctx.beginPath(); ctx.arc(cx - s * 0.16, frameY + s * 0.16, s * 0.035, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#e8b48a'; ctx.beginPath(); ctx.arc(px, py, hr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px, py - hr * 0.15, hr * 1.02, Math.PI, TAU); ctx.fill(); // gorro
  ctx.fillStyle = '#111827'; ctx.fillRect(px - hr * 0.95, py - hr * 0.25, hr * 1.9, hr * 0.3); // antiparras
  ctx.fillStyle = '#7dd3fc'; ctx.fillRect(px - hr * 0.2, py - hr * 0.2, hr * 0.9, hr * 0.2);
  // la canasta
  const sp = cached(baskets, `${Math.round(w)}|${Math.round(s)}|${pixelRatio()}`, () => makeSprite(w + s * 0.2, bh + s * 0.2, s * 0.1, s * 0.08, c => paintBasket(c, w, bh, s)));
  blit(ctx, sp, x, y);
  // bolsas de arena colgando a los costados
  for (const side of [-1, 1]) {
    const bx = side < 0 ? x - s * 0.08 : x + w + s * 0.08, by = y + bh * 0.5 + Math.sin(t * 2 + id + side) * s * 0.02;
    ctx.strokeStyle = '#a07a46'; ctx.lineWidth = Math.max(0.8, s * 0.02); ctx.beginPath(); ctx.moveTo(bx - side * s * 0.06, y + s * 0.08); ctx.lineTo(bx, by - s * 0.12); ctx.stroke();
    const g = ctx.createRadialGradient(bx - s * 0.04, by - s * 0.04, 0, bx, by, s * 0.17); g.addColorStop(0, '#d9bf8c'); g.addColorStop(1, '#8a6a3a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bx, by, s * 0.11, s * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b4f2a'; ctx.fillRect(bx - s * 0.05, by - s * 0.15, s * 0.1, s * 0.03);
  }
}

// ---------------------------------------------------------------- El trepador
// El protagonista de Trepaluna en versión caricatura: cabeza grande con gorra azul y visera, ojo grande,
// remera de tres franjas bien marcadas (azul, amarilla y azul), short azul, piernas a la vista y zapatillas
// negras con suela blanca. Contorno grueso, codos y rodillas que se doblan al correr, trepar y saltar.
export interface ClimberPose {
  x: number; y: number; w: number; h: number; // rectángulo en pantalla donde se dibuja (arriba a la izquierda)
  facing: 1 | -1; time: number;
  running: boolean; airborne: boolean; climbing: boolean; falling: boolean; burnt: boolean;
}
type P = [number, number];
export function drawClimber(ctx: CanvasRenderingContext2D, pose: ClimberPose) {
  const { x, y, w, h, facing: f, time: t, burnt } = pose;
  const C = burnt
    ? { skin: '#5b5550', skinBack: '#47423e', shirt: '#2b2926', stripe: '#3a3632', shorts: '#292524', shortsBack: '#1c1917', cap: '#1c1917', capLight: '#292524', brim: '#141210', shoe: '#0c0a09', sole: '#44403c', hair: '#1c1917', outline: '#0c0a09', cheek: '#00000000' }
    : { skin: '#ffd2a8', skinBack: '#e9b48a', shirt: '#2563eb', stripe: '#facc15', shorts: '#1e3a8a', shortsBack: '#172554', cap: '#2563eb', capLight: '#60a5fa', brim: '#1e3a8a', shoe: '#111111', sole: '#f8fafc', hair: '#4a2a12', outline: '#15122a', cheek: 'rgba(248,113,113,0.45)' };
  const cx = x + w / 2;
  const thigh = h * 0.15, shin = h * 0.15, upper = h * 0.115, fore = h * 0.105, headR = h * 0.19;
  const walk = t * 13, run = pose.running, climb = pose.climbing, air = pose.airborne && !climb, fall = pose.falling;
  const idle = !run && !air && !climb && !fall;
  const bob = run ? Math.abs(Math.sin(walk)) * h * 0.03 : idle ? Math.sin(t * 2.6) * h * 0.008 : 0;
  const lean = run ? 0.12 : 0;
  const hip: P = [cx, y + h * 0.665 - bob];
  const shoulder: P = [hip[0] + f * Math.sin(lean) * h * 0.2, hip[1] - h * 0.2];
  const legAngles = (side: number): [number, number] => { // [muslo, rodilla]: 0 = hacia abajo, + = hacia adelante
    if (run) { const ph = walk + (side > 0 ? 0 : Math.PI); return [0.7 * Math.sin(ph), 0.15 + 1.1 * Math.max(0, Math.cos(ph))]; }
    if (climb) { const ph = t * 12 + (side > 0 ? 0 : Math.PI); return [0.6 + 0.45 * Math.sin(ph), 1.1 + 0.5 * Math.sin(ph)]; }
    if (fall) return side > 0 ? [0.6 + 0.4 * Math.sin(t * 17), 0.9] : [-0.4 + 0.4 * Math.sin(t * 15 + 1), 0.5];
    if (air) return side > 0 ? [0.95, 1.4] : [-0.2, 0.8];
    return [side > 0 ? 0.08 : -0.08, 0.04];
  };
  const armAngles = (side: number): [number, number] => { // [brazo, codo]
    if (run) { const ph = walk + (side > 0 ? Math.PI : 0); return [0.85 * Math.sin(ph), 1.3 + 0.3 * Math.sin(ph)]; }
    if (climb) { const ph = t * 12 + (side > 0 ? Math.PI : 0); return [2.75 + 0.3 * Math.sin(ph), 0.2 + 0.3 * Math.max(0, -Math.sin(ph))]; }
    if (fall) return [2.6 + 0.45 * Math.sin(t * 20 + side * 2), 0.5 + 0.3 * Math.sin(t * 23 + side)];
    if (air) return side > 0 ? [2.5, 0.5] : [1.9, 0.7];
    return [side > 0 ? 0.45 : -0.25, 0.5];
  };
  const dirv = (a: number): P => [f * Math.sin(a), Math.cos(a)];
  const add = (p: P, d: P, l: number): P => [p[0] + d[0] * l, p[1] + d[1] * l];
  const ow = Math.max(1, h * 0.022), lw = h * 0.085, aw = h * 0.07;
  const stroke = (pts: P[], width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  };
  const outlined = (pts: P[], width: number, color: string) => { stroke(pts, width + ow * 2, C.outline); stroke(pts, width, color); };
  const dot = (p: P, r: number, color: string) => { ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(p[0], p[1], r + ow, 0, TAU); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const leg = (side: number) => {
    const back = side < 0, [a, k] = legAngles(side);
    const hp: P = [hip[0] + f * side * h * 0.045, hip[1]];
    const knee = add(hp, dirv(a), thigh), foot = add(knee, dirv(a - k), shin);
    outlined([hp, knee, foot], lw, back ? C.skinBack : C.skin);
    // botamanga del short sobre el muslo
    const hem = add(hp, dirv(a), thigh * 0.45);
    ctx.lineCap = 'butt'; outlined([[hp[0], hp[1] - lw * 0.4], hem], lw * 1.5, back ? C.shortsBack : C.shorts); ctx.lineCap = 'round';
    // zapatilla negra con suela blanca y cordones
    ctx.save(); ctx.translate(foot[0], foot[1] + lw * 0.2); ctx.scale(f, 1); ctx.rotate(climb || air || fall ? (a - k) * 0.5 : 0);
    const L = h * 0.19, Hh = h * 0.085;
    ctx.fillStyle = C.outline; ctx.beginPath(); ctx.roundRect(-L * 0.3 - ow, -Hh - ow, L + ow * 2, Hh * 1.45 + ow * 2, Hh * 0.6); ctx.fill();
    ctx.fillStyle = C.shoe; ctx.beginPath(); ctx.roundRect(-L * 0.3, -Hh, L, Hh * 1.15, [Hh * 0.6, Hh * 0.9, Hh * 0.3, Hh * 0.3]); ctx.fill();
    ctx.fillStyle = C.sole; ctx.beginPath(); ctx.roundRect(-L * 0.3, Hh * 0.1, L, Hh * 0.35, Hh * 0.15); ctx.fill();
    ctx.fillStyle = back ? '#ffffff55' : '#ffffffaa'; ctx.beginPath(); ctx.ellipse(L * 0.2, -Hh * 0.55, L * 0.18, Hh * 0.13, -0.3, 0, TAU); ctx.fill(); // brillo
    if (!back) { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = Math.max(0.6, h * 0.008); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-L * 0.05 + i * L * 0.1, -Hh * 0.75); ctx.lineTo(L * 0.02 + i * L * 0.1, -Hh * 0.45); ctx.stroke(); } }
    ctx.restore();
  };
  const arm = (side: number) => {
    const back = side < 0, [a, k] = armAngles(side);
    const sp: P = [shoulder[0] - f * side * h * 0.03, shoulder[1] + h * 0.035];
    const elbow = add(sp, dirv(a), upper), hand = add(elbow, dirv(a + k), fore);
    outlined([sp, elbow, hand], aw, back ? C.skinBack : C.skin);
    const sleeve = add(sp, dirv(a), upper * 0.62);
    { // manga corta azul: hombro redondeado y botamanga recta
      const sc = back ? '#1d4ed8' : C.shirt, r = aw * 0.8;
      ctx.lineCap = 'butt';
      ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(sp[0], sp[1], r + ow, 0, TAU); ctx.fill(); stroke([sp, sleeve], aw * 1.6 + ow * 2, C.outline);
      ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, TAU); ctx.fill(); stroke([sp, sleeve], aw * 1.6, sc);
      ctx.lineCap = 'round';
    }
    dot(hand, h * 0.05, back ? C.skinBack : C.skin); // mano redonda de caricatura
  };
  arm(-1); leg(-1);

  // Torso: remera con las tres franjas bien grandes, y la cintura del short.
  const tw = h * 0.34, top = shoulder[1] - h * 0.015, bottom = hip[1] + h * 0.02;
  const body = () => { ctx.beginPath(); ctx.roundRect(cx - tw / 2 + (shoulder[0] - hip[0]) * 0.5, top, tw, bottom - top, h * 0.07); };
  ctx.fillStyle = C.outline; ctx.save(); ctx.lineWidth = ow * 2; ctx.strokeStyle = C.outline; body(); ctx.stroke(); ctx.restore();
  ctx.save(); body(); ctx.clip();
  const band = (bottom - top) / 3;
  ctx.fillStyle = C.shirt; ctx.fillRect(x - w, top, w * 3, bottom - top);
  ctx.fillStyle = C.stripe; ctx.fillRect(x - w, top + band, w * 3, band);
  ctx.fillStyle = C.outline + '55'; ctx.fillRect(x - w, top + band - ow * 0.4, w * 3, ow * 0.8); ctx.fillRect(x - w, top + band * 2 - ow * 0.4, w * 3, ow * 0.8);
  const sh = ctx.createLinearGradient(cx - f * tw / 2, 0, cx + f * tw / 2, 0); sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0.1)');
  ctx.fillStyle = sh; ctx.fillRect(x - w, top, w * 3, bottom - top);
  ctx.restore();
  // cintura del short (azul más oscuro que la remera)
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.roundRect(hip[0] - tw * 0.49 - ow, hip[1] - h * 0.03 - ow, tw * 0.98 + ow * 2, h * 0.08 + ow * 2, h * 0.03); ctx.fill();
  ctx.fillStyle = C.shorts; ctx.beginPath(); ctx.roundRect(hip[0] - tw * 0.49, hip[1] - h * 0.03, tw * 0.98, h * 0.08, h * 0.03); ctx.fill();
  ctx.fillStyle = '#ffffff30'; ctx.fillRect(hip[0] - tw * 0.5, hip[1] - h * 0.025, tw, h * 0.015);
  leg(1);

  // Cabeza grande: cara, oreja, ojo grande, nariz redonda, sonrisa (o boca abierta) y gorra.
  const hx = shoulder[0] + f * h * 0.02, hy = shoulder[1] - h * 0.17;
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(hx, hy, headR + ow, 0, TAU); ctx.fill();
  const nose: P = [hx + f * headR * 0.98, hy + headR * 0.12];
  ctx.beginPath(); ctx.arc(nose[0], nose[1], headR * 0.2 + ow, 0, TAU); ctx.fill();
  const face = ctx.createRadialGradient(hx + f * headR * 0.3, hy - headR * 0.2, headR * 0.1, hx, hy, headR * 1.1);
  face.addColorStop(0, burnt ? C.skin : '#ffe6cc'); face.addColorStop(0.7, C.skin); face.addColorStop(1, C.skinBack);
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(nose[0], nose[1], headR * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.62, hy + headR * 0.05, headR * 0.4, headR * 0.55, 0, 0, TAU); ctx.fill(); // pelo de la nuca
  ctx.fillStyle = C.skinBack; ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.3, hy + headR * 0.15, headR * 0.14, headR * 0.2, 0, 0, TAU); ctx.fill(); // oreja
  ctx.strokeStyle = C.outline + '99'; ctx.lineWidth = Math.max(0.6, headR * 0.05); ctx.beginPath(); ctx.arc(hx - f * headR * 0.3, hy + headR * 0.15, headR * 0.07, 0, TAU); ctx.stroke();
  ctx.fillStyle = C.cheek; ctx.beginPath(); ctx.arc(hx + f * headR * 0.45, hy + headR * 0.4, headR * 0.17, 0, TAU); ctx.fill();
  const ex = hx + f * headR * 0.5, ey = hy - headR * 0.05;
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.ellipse(ex, ey, headR * 0.2 + ow * 0.7, headR * 0.27 + ow * 0.7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, ey, headR * 0.2, headR * 0.27, 0, 0, TAU); ctx.fill();
  const pr = fall ? headR * 0.07 : headR * 0.12;
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + f * headR * 0.07, ey + headR * 0.03, pr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + f * headR * 0.1, ey - headR * 0.03, Math.max(0.6, pr * 0.35), 0, TAU); ctx.fill();
  ctx.strokeStyle = C.outline; ctx.lineWidth = Math.max(1, headR * 0.09); // ceja (arriba del susto)
  ctx.beginPath(); ctx.moveTo(ex - f * headR * 0.18, ey - headR * (fall ? 0.48 : 0.38)); ctx.quadraticCurveTo(ex, ey - headR * (fall ? 0.58 : 0.46), ex + f * headR * 0.2, ey - headR * (fall ? 0.5 : 0.38)); ctx.stroke();
  if (fall || air) { // boca abierta
    ctx.fillStyle = C.outline; ctx.beginPath(); ctx.ellipse(hx + f * headR * 0.6, hy + headR * 0.55, headR * 0.15, headR * (fall ? 0.2 : 0.11), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(hx + f * headR * 0.6, hy + headR * 0.6, headR * 0.09, headR * (fall ? 0.1 : 0.05), 0, 0, TAU); ctx.fill();
  } else { ctx.beginPath(); ctx.moveTo(hx + f * headR * 0.35, hy + headR * 0.52); ctx.quadraticCurveTo(hx + f * headR * 0.6, hy + headR * 0.72, hx + f * headR * 0.82, hy + headR * 0.45); ctx.stroke(); } // sonrisa
  // gorra azul: copa con brillo, costuras, botón amarillo y visera hacia adelante
  const cap = () => { ctx.beginPath(); ctx.ellipse(hx - f * headR * 0.03, hy - headR * 0.25, headR * 1.05, headR * 0.92, 0, Math.PI, TAU); ctx.closePath(); };
  ctx.save(); ctx.lineWidth = ow * 2; ctx.strokeStyle = C.outline; cap(); ctx.stroke(); ctx.restore();
  const capG = ctx.createLinearGradient(hx - f * headR, hy - headR, hx + f * headR, hy - headR * 0.3);
  capG.addColorStop(0, C.cap); capG.addColorStop(0.7, C.cap); capG.addColorStop(1, C.capLight);
  ctx.fillStyle = capG; cap(); ctx.fill();
  ctx.fillStyle = '#ffffff40'; ctx.beginPath(); ctx.ellipse(hx + f * headR * 0.25, hy - headR * 0.85, headR * 0.35, headR * 0.12, f * 0.3, 0, TAU); ctx.fill(); // brillo
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(0.6, headR * 0.05);
  ctx.beginPath(); ctx.moveTo(hx, hy - headR * 1.15); ctx.quadraticCurveTo(hx + f * headR * 0.5, hy - headR * 0.8, hx + f * headR * 0.55, hy - headR * 0.27); ctx.stroke();
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(hx - f * headR * 0.03, hy - headR * 1.17, headR * 0.15 + ow, 0, TAU); ctx.fill();
  ctx.fillStyle = burnt ? C.cap : '#facc15'; ctx.beginPath(); ctx.arc(hx - f * headR * 0.03, hy - headR * 1.17, headR * 0.15, 0, TAU); ctx.fill(); // botón
  ctx.fillStyle = C.outline; ctx.beginPath(); ctx.ellipse(hx + f * headR * 1.0, hy - headR * 0.26, headR * 0.72 + ow, headR * 0.15 + ow, f * 0.06, 0, TAU); ctx.fill();
  ctx.fillStyle = C.brim; ctx.beginPath(); ctx.ellipse(hx + f * headR * 1.0, hy - headR * 0.26, headR * 0.72, headR * 0.15, f * 0.06, 0, TAU); ctx.fill(); // visera
  arm(1);
  ctx.restore();
}

// ---------------------------------------------------------------- Ovni
// Platillo volador de metal pulido: disco ancho con paneles y remaches, panza oscura con el motor que
// brilla, cúpula de vidrio con un extraterrestre adentro, antena que titila, haz de luz que barre hacia
// abajo y una ronda de luces de colores que gira alrededor del borde (las de atrás, más chicas y tenues).
const ufoHulls = new Map<string, Sprite>();
function paintUfoHull(ctx: CanvasRenderingContext2D, s: number) {
  const rx = s * 1.15, ry = s * 0.26, line = Math.max(0.6, s * 0.018);
  // panza: cuenco oscuro con anillos
  const belly = ctx.createLinearGradient(0, 0, 0, s * 0.42); belly.addColorStop(0, '#64748b'); belly.addColorStop(1, '#1e293b');
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0, s * 0.06, rx * 0.72, s * 0.32, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = '#0f172a88'; ctx.lineWidth = line;
  for (const k of [0.45, 0.7]) { ctx.beginPath(); ctx.ellipse(0, s * 0.06, rx * 0.72 * k, s * 0.32 * k, 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
  // disco: metal con reflejos en franjas
  const disc = ctx.createLinearGradient(0, -ry, 0, ry);
  disc.addColorStop(0, '#f8fafc'); disc.addColorStop(0.3, '#cbd5e1'); disc.addColorStop(0.5, '#94a3b8'); disc.addColorStop(0.62, '#e2e8f0'); disc.addColorStop(1, '#475569');
  ctx.fillStyle = disc; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  const side = ctx.createLinearGradient(-rx, 0, rx, 0); side.addColorStop(0, '#0f172a55'); side.addColorStop(0.3, '#0f172a00'); side.addColorStop(0.75, '#ffffff22'); side.addColorStop(1, '#0f172a66');
  ctx.fillStyle = side; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = line * 1.5; ctx.stroke();
  // paneles (líneas radiales en la mitad de arriba) y remaches
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#33415555'; ctx.lineWidth = line;
  ctx.beginPath(); ctx.ellipse(0, -ry * 0.05, rx * 0.66, ry * 0.55, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * 0.66, -ry * 0.05 + Math.sin(a) * ry * 0.55); ctx.lineTo(Math.cos(a) * rx, Math.sin(a) * ry); ctx.stroke(); }
  ctx.fillStyle = '#1e293b88'; for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * rx * 0.83, -ry * 0.02 + Math.sin(a) * ry * 0.78, Math.max(0.5, s * 0.016), 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffffffaa'; ctx.beginPath(); ctx.ellipse(-rx * 0.35, -ry * 0.45, rx * 0.3, ry * 0.12, -0.05, 0, TAU); ctx.fill(); // reflejo
  ctx.restore();
  // base de la cúpula
  const ring = ctx.createLinearGradient(0, -ry * 0.75, 0, -ry * 0.2); ring.addColorStop(0, '#e2e8f0'); ring.addColorStop(1, '#64748b');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.ellipse(0, -ry * 0.45, rx * 0.46, ry * 0.42, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = line; ctx.stroke();
}
export function drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, t: number, id: number) {
  const rx = s * 1.15, ry = s * 0.26;
  const tilt = Math.sin(t * 2.2 + id) * 0.07 + dir * 0.06, hover = Math.sin(t * 3 + id * 1.3) * s * 0.06;
  ctx.save(); ctx.translate(x, y + hover); ctx.rotate(tilt);
  // haz de luz que barre hacia abajo
  const beamOn = 0.5 + 0.5 * Math.sin(t * 1.3 + id);
  if (beamOn > 0.25) {
    const beam = ctx.createLinearGradient(0, s * 0.3, 0, s * 2.6); beam.addColorStop(0, `rgba(134,239,172,${0.4 * beamOn})`); beam.addColorStop(1, 'rgba(134,239,172,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.32); ctx.lineTo(s * 0.25, s * 0.32); ctx.lineTo(s * 0.85, s * 2.6); ctx.lineTo(-s * 0.85, s * 2.6); ctx.closePath(); ctx.fill();
  }
  // luces del borde: posición en la ronda que gira; las de atrás van antes del casco
  const N = 12, spin = t * 2.4 + id, lights: { a: number; hue: number }[] = [];
  for (let i = 0; i < N; i++) lights.push({ a: spin + (i / N) * TAU, hue: (i * 360 / N + t * 90) % 360 });
  const light = (a: number, hue: number) => {
    const lx = Math.cos(a) * rx * 0.97, ly = Math.sin(a) * ry * 0.9 + ry * 0.12, front = Math.sin(a) > 0;
    const r = s * (front ? 0.07 : 0.045), pulse = 0.75 + 0.25 * Math.sin(t * 9 + a * 3);
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 4); glow.addColorStop(0, hsl(hue, 100, 65, (front ? 0.85 : 0.35) * pulse)); glow.addColorStop(1, hsl(hue, 100, 60, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, r * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(hue, 100, front ? 85 : 60); ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
  };
  for (const l of lights) if (Math.sin(l.a) <= 0) light(l.a, l.hue);
  // motor de la panza que late
  const core = ctx.createRadialGradient(0, s * 0.33, 0, 0, s * 0.33, s * 0.4); const k = 0.6 + 0.4 * Math.sin(t * 6 + id);
  core.addColorStop(0, `rgba(187,247,208,${0.95 * k})`); core.addColorStop(0.4, `rgba(34,197,94,${0.6 * k})`); core.addColorStop(1, 'rgba(34,197,94,0)');
  const sp = cached(ufoHulls, `${Math.round(s * 4)}|${pixelRatio()}`, () => makeSprite(rx * 2.2, s * 1.1, rx * 1.1, s * 0.5, c => paintUfoHull(c, s)));
  blit(ctx, sp, 0, 0);
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, s * 0.33, s * 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#dcfce7'; ctx.beginPath(); ctx.ellipse(0, s * 0.36, s * 0.14, s * 0.05, 0, 0, TAU); ctx.fill();
  for (const l of lights) if (Math.sin(l.a) > 0) light(l.a, l.hue);
  // cúpula de vidrio con el extraterrestre
  const dr = rx * 0.4, dy = -ry * 0.5;
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, dy, dr, dr * 0.95, 0, Math.PI, TAU); ctx.closePath(); ctx.clip();
  const glass = ctx.createLinearGradient(0, dy - dr, 0, dy); glass.addColorStop(0, '#a5f3fc'); glass.addColorStop(1, '#0e7490');
  ctx.fillStyle = glass; ctx.fillRect(-dr, dy - dr, dr * 2, dr);
  const ax = Math.sin(t * 1.5 + id) * dr * 0.2 * dir, ay = dy - dr * 0.08;
  ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.ellipse(ax, ay - dr * 0.38, dr * 0.3, dr * 0.36, 0, 0, TAU); ctx.fill(); // cabeza
  ctx.fillRect(ax - dr * 0.08, ay - dr * 0.1, dr * 0.16, dr * 0.2); ctx.beginPath(); ctx.ellipse(ax, ay + dr * 0.12, dr * 0.32, dr * 0.18, 0, Math.PI, TAU); ctx.fill(); // cuello y hombros
  ctx.fillStyle = '#052e16'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ax + sx * dr * 0.13 + dir * dr * 0.04, ay - dr * 0.4, dr * 0.1, dr * 0.15, sx * -0.5, 0, TAU); ctx.fill(); } // ojos grandes
  ctx.fillStyle = '#ffffffaa'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(ax + sx * dr * 0.11 + dir * dr * 0.06, ay - dr * 0.46, dr * 0.03, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-dr * 0.4, dy - dr * 0.55, dr * 0.18, dr * 0.32, 0.5, 0, TAU); ctx.fill(); // brillo del vidrio
  ctx.restore();
  ctx.strokeStyle = '#cffafe88'; ctx.lineWidth = Math.max(0.8, s * 0.02); ctx.beginPath(); ctx.ellipse(0, dy, dr, dr * 0.95, 0, Math.PI, TAU); ctx.stroke();
  // antena con la luz roja
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(0, dy - dr * 0.95); ctx.lineTo(0, dy - dr * 1.35); ctx.stroke();
  const blink = Math.sin(t * 7 + id) > 0;
  if (blink) { const g = ctx.createRadialGradient(0, dy - dr * 1.4, 0, 0, dy - dr * 1.4, s * 0.25); g.addColorStop(0, '#ef4444cc'); g.addColorStop(1, '#ef444400'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, dy - dr * 1.4, s * 0.25, 0, TAU); ctx.fill(); }
  ctx.fillStyle = blink ? '#fecaca' : '#991b1b'; ctx.beginPath(); ctx.arc(0, dy - dr * 1.4, s * 0.05, 0, TAU); ctx.fill();
  ctx.restore();
}
