// El fondo de "Ciudad Tiburón": nubes de tormenta con volumen, la ciudad lejana bajo la lluvia y tiburones
// que vuelan colgados de un aparato con hélice de helicóptero (son de adorno: no atacan).
//
// Cada edificio lejano tiene su estilo (torre vidriada, departamentos con balcones o bloque viejo), su
// remate (tanque de agua, antena, aguja o equipos) y ventanas: muchas apagadas (se cortó la luz), algunas con
// luz y cortinas. Lo que no se mueve se dibuja una sola vez en una imagen; los relámpagos lo iluminan.
import { flyerLen, type Flyer } from './shark';
import { drawSharkSprite } from './sharkSprites';
import { font, hash, hsl, visible, X, Y, type View } from './sharkView';

// ---------- Nubes ----------
// Una nube hecha de bollos con luz arriba y sombra abajo, dibujada una vez por tamaño (normal e iluminada
// por un relámpago, que se mezcla según el brillo).
const cloudCache = new Map<string, HTMLCanvasElement | null>();
function cloudImage(r: number, seed: number, lit: boolean) {
  const key = `${Math.round(r)}:${seed}:${lit ? 1 : 0}`;
  if (cloudCache.has(key)) return cloudCache.get(key)!;
  const w = Math.ceil(r * 5), h = Math.ceil(r * 2.2), canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  if (c) {
    for (let j = 0; j < 7; j++) {
      const px = r * (0.9 + j * 0.53 + (hash(seed + j) - 0.5) * 0.3), py = r * (1.25 - Math.sin((j / 6) * Math.PI) * 0.35 + (hash(seed + j + 9) - 0.5) * 0.2);
      const pr = r * (0.55 + Math.sin((j / 6) * Math.PI) * 0.35 + hash(seed + j * 3) * 0.15);
      const gr = c.createRadialGradient(px, py - pr * 0.35, pr * 0.1, px, py, pr);
      if (lit) { gr.addColorStop(0, 'rgba(205,215,245,0.95)'); gr.addColorStop(0.6, 'rgba(120,132,170,0.9)'); gr.addColorStop(1, 'rgba(70,80,115,0)'); }
      else { gr.addColorStop(0, 'rgba(48,58,80,0.92)'); gr.addColorStop(0.6, 'rgba(22,30,46,0.88)'); gr.addColorStop(1, 'rgba(12,18,30,0)'); }
      c.fillStyle = gr; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    }
  }
  if (cloudCache.size > 60) cloudCache.clear();
  cloudCache.set(key, c ? canvas : null);
  return c ? canvas : null;
}
export function drawClouds(ctx: CanvasRenderingContext2D, v: View, flash: number) {
  for (let i = 0; i < 11; i++) {
    const span = v.w + 600, speed = 6 + hash(i + 3) * 10;
    const r = v.h * (0.07 + hash(i + 4) * 0.06), x = ((hash(i) * span + v.t * speed - v.cx * v.s * 0.04) % span + span) % span - 300;
    const y = v.h * (0.0 + hash(i + 9) * 0.2) - r * 0.6, seed = i % 5;
    const dark = cloudImage(r, seed, false);
    if (dark) ctx.drawImage(dark, x - r * 2.5, y);
    if (flash > 0.08) { const lit = cloudImage(r, seed, true); if (lit) { ctx.globalAlpha = Math.min(1, flash * 1.3); ctx.drawImage(lit, x - r * 2.5, y); ctx.globalAlpha = 1; } }
  }
}

// ---------- Ciudad lejana ----------
interface Far { n: number; x: number; w: number; h: number; style: 0 | 1 | 2; roof: 0 | 1 | 2 | 3; setback: boolean }
const LAYERS = [
  { par: 0.08, unit: 0.34, D: 7, hmax: 42, col: [220, 22, 15], fog: 0.35, windows: false },
  { par: 0.15, unit: 0.45, D: 6.5, hmax: 34, col: [218, 24, 13], fog: 0.22, windows: true },
  { par: 0.35, unit: 0.65, D: 6, hmax: 26, col: [215, 26, 11], fog: 0, windows: true },
];
const FLOOR = 1.4, ROOF = 6;
function farSpec(i: number, li: number): Far {
  const L = LAYERS[li], n = i * 7 + li * 1000;
  return {
    n, x: i * L.D + hash(n + 2) * L.D * 0.25, w: L.D * (0.5 + hash(n) * 0.42), h: 6 + hash(n + 1) * L.hmax,
    style: Math.floor(hash(n + 6) * 3) as Far['style'], roof: Math.floor(hash(n + 8) * 4) as Far['roof'], setback: hash(n + 7) < 0.3,
  };
}
function paintFar(c: CanvasRenderingContext2D, f: Far, sc: number, li: number) {
  const L = LAYERS[li], H = (f.h + ROOF) * sc, U = (u: number) => u * sc, Yb = (u: number) => H - u * sc;
  const body = f.setback ? f.h * 0.84 : f.h, sx1 = f.w * 0.18, sx2 = f.w * 0.82;
  // Cuerpo mojado: un poco más claro arriba (refleja el cielo) y una cara lateral en sombra.
  const gr = c.createLinearGradient(0, Yb(f.h), 0, H);
  gr.addColorStop(0, hsl(L.col[0], L.col[1], L.col[2] + 6)); gr.addColorStop(1, hsl(L.col[0], L.col[1], L.col[2] - 2));
  c.fillStyle = gr;
  c.fillRect(0, Yb(body), U(f.w), U(body));
  if (f.setback) c.fillRect(U(sx1), Yb(f.h), U(sx2 - sx1), U(f.h - body) + 1);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, Yb(body), U(f.w * 0.12), U(body));
  c.fillStyle = 'rgba(170,190,230,0.12)'; c.fillRect(U(f.w) - Math.max(1, U(0.12)), Yb(body), Math.max(1, U(0.12)), U(body)); // borde con brillo de lluvia
  c.fillStyle = hsl(L.col[0], L.col[1], L.col[2] + 10); c.fillRect(-1, Yb(body) - 1, U(f.w) + 2, Math.max(1, U(0.22))); // cornisa
  if (L.windows) {
    const cell = f.style === 0 ? 0.9 : f.style === 1 ? 1.3 : 1.1, cols = Math.max(2, Math.floor(f.w / cell)), cw = f.w / cols;
    const ww = cw * (f.style === 0 ? 0.78 : f.style === 1 ? 0.5 : 0.42), wh = FLOOR * (f.style === 0 ? 0.7 : 0.48), rows = Math.floor(f.h / FLOOR);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let r = 1; r < rows; r++) if (r * FLOOR < body) c.fillRect(0, Yb(r * FLOOR), U(f.w), Math.max(1, U(0.06)));
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const y = r * FLOOR + 0.45, cx = (k + 0.5) * cw;
      if (y + wh > f.h - 0.3 || (y + wh > body && (cx < sx1 + ww || cx > sx2 - ww))) continue;
      const m = f.n * 31 + r * 13 + k, px = U(cx - ww / 2), py = Yb(y + wh), pw = Math.max(1, U(ww)), ph = Math.max(1, U(wh));
      const lit = hash(m) < (li === 2 ? 0.2 : 0.13);
      if (lit) {
        const tone = hash(m + 0.3);
        c.fillStyle = tone < 0.6 ? 'rgba(253,224,140,0.7)' : tone < 0.85 ? 'rgba(255,240,200,0.6)' : 'rgba(165,215,250,0.5)';
        c.fillRect(px, py, pw, ph);
        if (f.style !== 0 && ph > 3) { c.fillStyle = 'rgba(90,60,40,0.4)'; c.fillRect(px, py, pw * (0.2 + hash(m + 0.7) * 0.3), ph); } // cortina
      } else {
        c.fillStyle = f.style === 0 ? 'rgba(70,90,120,0.45)' : 'rgba(6,10,18,0.55)';
        c.fillRect(px, py, pw, ph);
        if (ph > 3) { c.fillStyle = 'rgba(160,180,220,0.08)'; c.fillRect(px, py, pw, ph * 0.4); } // reflejo del cielo
      }
      if (f.style === 1 && k % 2 === 0 && pw > 3) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(px - pw * 0.25, Yb(y - 0.04), pw * 1.5, Math.max(1, U(0.08))); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; c.strokeRect(px - pw * 0.25, Yb(y + 0.3), pw * 1.5, U(0.32)); }
      if (f.style === 2 && hash(m + 0.9) < 0.1 && pw > 3) { c.fillStyle = 'rgba(90,96,110,0.8)'; c.fillRect(px + pw * 0.1, py + ph, pw * 0.8, Math.max(2, ph * 0.35)); }
    }
    if (f.style === 0) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < cols; k++) c.fillRect(U(k * cw) - 0.5, Yb(body), 1, U(body)); }
  }
  // Remate.
  const top = Yb(f.h), mid = U(f.w * 0.5);
  c.fillStyle = hsl(L.col[0], L.col[1], L.col[2]); c.strokeStyle = c.fillStyle; c.lineWidth = Math.max(1, U(0.1));
  if (f.roof === 1) {
    const tx = U(f.w * 0.25), tw = U(Math.min(1.6, f.w * 0.3));
    c.fillRect(tx, top - U(2), tw, U(1.3)); c.beginPath(); c.moveTo(tx - 1, top - U(2)); c.lineTo(tx + tw / 2, top - U(2.5)); c.lineTo(tx + tw + 1, top - U(2)); c.fill();
    c.beginPath(); c.moveTo(tx + tw * 0.15, top); c.lineTo(tx + tw * 0.15, top - U(0.8)); c.moveTo(tx + tw * 0.85, top); c.lineTo(tx + tw * 0.85, top - U(0.8)); c.stroke();
  } else if (f.roof === 2) {
    c.beginPath(); c.moveTo(mid, top); c.lineTo(mid, top - U(4.5)); c.moveTo(mid - U(0.8), top); c.lineTo(mid, top - U(2.6)); c.lineTo(mid + U(0.8), top); c.stroke();
  } else if (f.roof === 3) {
    c.beginPath(); c.moveTo(mid - U(f.w * 0.16), top); c.lineTo(mid, top - U(5)); c.lineTo(mid + U(f.w * 0.16), top); c.fill();
  } else for (let j = 0; j < 3; j++) c.fillRect(U(f.w * (0.15 + j * 0.27)), top - U(0.4 + hash(f.n + j) * 0.5), U(0.7), U(0.4 + hash(f.n + j) * 0.5));
  // Bruma de lluvia: cuanto más lejos, más tapado.
  if (L.fog) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(60,72,98,${L.fog})`; c.fillRect(0, 0, U(f.w), H); c.globalCompositeOperation = 'source-over'; }
}
const farCache = new Map<string, HTMLCanvasElement | null>();
function farImage(f: Far, li: number, sc: number, dpr: number) {
  const key = `${li}:${f.n}:${sc.toFixed(2)}:${dpr}`;
  if (farCache.has(key)) return farCache.get(key)!;
  const w = f.w * sc, h = (f.h + ROOF) * sc, canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * dpr)); canvas.height = Math.max(1, Math.ceil(h * dpr));
  const c = canvas.getContext('2d');
  if (c) { c.scale(dpr, dpr); paintFar(c, f, sc, li); }
  if (farCache.size > 220) farCache.delete(farCache.keys().next().value!);
  farCache.set(key, c ? canvas : null);
  return c ? canvas : null;
}

// La ciudad lejana se dibuja a la mitad de resolución en un lienzo aparte y después se agranda: está lejos y
// detrás de la lluvia, así que no se nota y es mucho más liviano.
const SKY_SCALE = 0.5;
let skyCanvas: HTMLCanvasElement | null = null;
export function drawSkyline(ctx: CanvasRenderingContext2D, v: View, flash: number) {
  const w = Math.max(1, Math.ceil(v.w * SKY_SCALE)), h = Math.max(1, Math.ceil(v.h * SKY_SCALE));
  skyCanvas ??= document.createElement('canvas');
  if (skyCanvas.width !== w || skyCanvas.height !== h) { skyCanvas.width = w; skyCanvas.height = h; }
  const c = skyCanvas.getContext('2d');
  if (!c) return paintSkyline(ctx, v, flash, 1);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  c.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, 0, 0);
  paintSkyline(c, v, flash, SKY_SCALE);
  ctx.drawImage(skyCanvas, 0, 0, v.w, v.h);
}
function paintSkyline(ctx: CanvasRenderingContext2D, v: View, flash: number, dpr: number) {
  LAYERS.forEach((L, li) => {
    const s = v.s * L.unit, base = v.h + v.cy * v.s * L.par - v.s * 0.4 * (1 - L.par), off = v.cx * v.s * L.par;
    const i1 = Math.floor((off - 40) / (L.D * s)) - 1, i2 = Math.ceil((off + v.w + 40) / (L.D * s));
    for (let i = i1; i <= i2; i++) {
      const f = farSpec(i, li), x = f.x * s - off, w = f.w * s, top = base - f.h * s;
      if (x > v.w || x + w < 0 || top - ROOF * s > v.h) continue;
      const img = farImage(f, li, s, dpr);
      if (img) ctx.drawImage(img, x, top - ROOF * s, w, (f.h + ROOF) * s);
      if (flash > 0.1) { ctx.fillStyle = `rgba(150,170,225,${flash * 0.3})`; ctx.fillRect(x, top, w, base - top); }
      // Luz roja que titila arriba de las antenas y las agujas.
      if ((f.roof === 2 || f.roof === 3) && Math.floor(v.t * 1.3 + f.n) % 2) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + w / 2, top - (f.roof === 2 ? 4.5 : 5) * s, Math.max(1.2, s * 0.18), 0, Math.PI * 2); ctx.fill(); }
    }
    // El agua lejana al pie de los edificios, con el reflejo de las luces que tiembla.
    if (base < v.h) {
      ctx.fillStyle = li === 2 ? '#0d2231' : li === 1 ? '#11283a' : '#152c3e';
      ctx.fillRect(0, base, v.w, v.h - base);
      if (L.windows) {
        for (let i = i1; i <= i2; i++) {
          const f = farSpec(i, li), x = f.x * s - off, w = f.w * s;
          if (x > v.w || x + w < 0) continue;
          for (let j = 0; j < 3; j++) {
            if (hash(f.n + j * 5) > 0.55) continue;
            const rx = x + w * (0.2 + j * 0.3), len = s * (1.5 + hash(f.n + j) * 3);
            ctx.fillStyle = `rgba(253,224,140,${0.12 + 0.08 * Math.sin(v.t * 3 + f.n + j)})`;
            for (let k = 0; k < 4; k++) ctx.fillRect(rx + Math.sin(v.t * 4 + k + j) * s * 0.15, base + (k * len) / 4, s * 0.35, len / 6);
          }
        }
      }
    }
  });
}

// ---------- Tiburones voladores ----------
// Colgados de un arnés con un motor y la hélice de helicóptero arriba. En picada se inclinan hacia donde van;
// cuando apuntan al bombero tiemblan, la luz roja titila rápido y aparece un "!" arriba.
export function drawFlyer(ctx: CanvasRenderingContext2D, f: Flyer, v: View, flash: number, closed = true) {
  const L = flyerLen(f);
  if (!visible(v, f.x - L, f.x + L, f.y - L, f.y + L)) return;
  const len = L * v.s, dir = f.dir, warn = f.state === 'warn', sp = Math.hypot(f.vx, f.vy);
  let a = Math.sin(v.t * 1.4 + f.id) * 0.06 * dir;
  if ((f.state === 'dive' || f.state === 'carry') && sp > 0.1) a = Math.atan2((-f.vy / sp) * dir, (f.vx / sp) * dir);
  const shake = warn ? Math.sin(v.t * 60) * v.s * 0.04 : 0;
  ctx.save();
  ctx.translate(X(v, f.x) + shake, Y(v, f.y)); ctx.rotate(a);
  const bodyTop = -len * 0.11, hubY = bodyTop - len * 0.2, R = len * 0.55;
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1.5, len * 0.025);
  ctx.beginPath(); ctx.moveTo(-len * 0.12, bodyTop + len * 0.02); ctx.lineTo(0, hubY + len * 0.06); ctx.lineTo(len * 0.12, bodyTop + len * 0.02); ctx.stroke(); // soportes
  if (!drawSharkSprite(ctx, f.type, 0, 0, len, 0, dir, { wave: v.t * (warn ? 12 : 6) + f.id, amp: 0.035, closed })) { ctx.restore(); return; }
  // Arnés: dos correas que abrazan el cuerpo, con hebillas.
  ctx.strokeStyle = 'rgba(17,24,39,0.9)'; ctx.lineWidth = Math.max(2, len * 0.035);
  for (const u of [-0.14, 0.12]) { ctx.beginPath(); ctx.moveTo(u * len, bodyTop + len * 0.01); ctx.quadraticCurveTo(u * len + dir * len * 0.03, 0, u * len, len * 0.1); ctx.stroke(); }
  ctx.fillStyle = '#facc15'; for (const u of [-0.14, 0.12]) ctx.fillRect(u * len - len * 0.015, bodyTop - len * 0.005, len * 0.03, len * 0.03);
  // Motor con franja amarilla y luz roja (rápida cuando apunta), mástil y hélice.
  const mw = len * 0.24, mh = len * 0.11;
  const metal = ctx.createLinearGradient(0, hubY + len * 0.03, 0, hubY + len * 0.03 + mh);
  metal.addColorStop(0, '#9ca3af'); metal.addColorStop(1, '#374151');
  ctx.fillStyle = metal; ctx.beginPath(); ctx.roundRect(-mw / 2, hubY + len * 0.03, mw, mh, mh * 0.3); ctx.fill();
  ctx.fillStyle = '#facc15'; ctx.fillRect(-mw / 2, hubY + len * 0.03 + mh * 0.55, mw, mh * 0.18);
  ctx.fillStyle = Math.floor(v.t * (warn ? 12 : 3) + f.id) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(-dir * mw * 0.42, hubY + len * 0.05, Math.max(1.5, len * 0.02), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111827'; ctx.fillRect(-len * 0.012, hubY - len * 0.005, len * 0.024, len * 0.04);
  ctx.fillStyle = 'rgba(203,213,225,0.22)'; ctx.beginPath(); ctx.ellipse(0, hubY, R, len * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(17,24,39,0.85)';
  for (let b = 0; b < 3; b++) { const reach = Math.cos(v.t * (warn ? 45 : 28) + f.id + (b * Math.PI * 2) / 3) * R; ctx.fillRect(Math.min(0, reach), hubY - len * 0.014, Math.abs(reach), len * 0.028); }
  if (flash > 0.1) { ctx.globalAlpha = flash * 0.35; ctx.fillStyle = '#c7d2fe'; ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5, len * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (warn) { // aviso: "!" rojo que late arriba
    const pulse = 1 + Math.sin(v.t * 16) * 0.15, x = X(v, f.x), y = Y(v, f.y) - len * 0.6;
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x, y, v.s * 0.32 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font(900, v.s * 0.45 * pulse); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + v.s * 0.02);
  }
}
