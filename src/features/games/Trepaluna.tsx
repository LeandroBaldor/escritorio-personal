import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { moonOf, newTrepa, PLAYER_H, PLAYER_W, step, takeEvents, WORLD_W, ZONES, type Input, type Plat, type Trepa } from './trepaluna';

const RECORD_KEY = 'escritorio-personal-juegos:trepaluna-record';
export const readTrepaRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento: el récord dura esta partida */ } };
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

const MOON_Y = moonOf(newTrepa()).y; // el recorrido es siempre el mismo

// En pantallas angostas se ve un pedazo del ancho (unos 10 m) y la cámara sigue al personaje
// de costado; en las anchas se ve todo el recorrido. Siempre se ven al menos 13 m de alto.
function viewFor(w: number, h: number) {
  const viewW = Math.max(10, Math.min(WORLD_W, w / 38));
  const scale = Math.min(w / viewW, h / 13);
  return { scale, viewW: w / scale };
}

type Status = 'ready' | 'playing' | 'paused' | 'won';
interface View { w: number; h: number; scale: number; ox: number; cam: number }

// Color del cielo según la altura: celeste de día, azul fuerte en las nubes y negro en el espacio.
const SKY: [number, [number, number, number]][] = [[0, [191, 230, 255]], [60, [125, 196, 245]], [120, [75, 143, 224]], [165, [27, 42, 107]], [205, [7, 10, 31]], [400, [3, 4, 15]]];
function skyAt(y: number) {
  let i = 0;
  while (i < SKY.length - 2 && y > SKY[i + 1][0]) i++;
  const [y0, a] = SKY[i], [y1, b] = SKY[i + 1];
  const k = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
}
// Números "al azar" pero siempre iguales, para estrellas, edificios y nubes de fondo.
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawBackground(ctx: CanvasRenderingContext2D, v: View, time: number) {
  const top = v.cam + v.h / v.scale;
  const bg = ctx.createLinearGradient(0, 0, 0, v.h);
  bg.addColorStop(0, skyAt(top));
  bg.addColorStop(1, skyAt(v.cam));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, v.w, v.h);

  // Estrellas: aparecen a medida que se sube y titilan.
  const stars = Math.max(0, Math.min(1, (v.cam + 10 - 140) / 60));
  if (stars > 0) {
    for (let i = 0; i < 140; i++) {
      const sx = hash(i) * v.w, sy = ((hash(i + 500) * v.h * 2 + v.cam * v.scale * 0.15) % (v.h * 2)) - v.h * 0.5;
      if (sy < 0 || sy > v.h) continue;
      ctx.globalAlpha = stars * (0.5 + 0.5 * Math.sin(time * 2 + i));
      ctx.fillStyle = '#fff';
      const size = 1 + hash(i + 900) * 1.8;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // La ciudad de fondo (se mueve más lento, así parece que está lejos).
  const base = v.h + v.cam * v.scale * 0.55;
  if (base - v.scale * 30 < v.h) {
    for (let i = 0, x = -10; x < v.w; i++) {
      const bw = 30 + hash(i + 40) * 60, bh = (6 + hash(i + 80) * 22) * v.scale * 0.55;
      ctx.fillStyle = i % 2 ? '#7aa6cf' : '#8db6dc';
      ctx.fillRect(x, base - bh, bw, bh);
      ctx.fillStyle = '#c9e3f7';
      for (let wy = base - bh + 8; wy < base - 8; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (hash(wx * 3 + wy) > 0.45) ctx.fillRect(wx, wy, 5, 7);
      x += bw + 4;
    }
  }

  // Nubes de fondo entre la ciudad y el espacio.
  for (let i = 0; i < 46; i++) {
    const wy = 70 + hash(i + 200) * 115;
    const sy = v.h - (wy - v.cam) * v.scale * 0.8 - v.cam * v.scale * 0.2 + wy * v.scale * 0.2;
    if (sy < -80 || sy > v.h + 80) continue;
    const sx = ((hash(i + 300) * (v.w + 200) + time * (6 + hash(i) * 10)) % (v.w + 200)) - 100;
    ctx.globalAlpha = 0.55;
    puff(ctx, sx, sy, (40 + hash(i + 400) * 60) * Math.min(1.4, v.scale / 40), '#ffffff');
  }
  ctx.globalAlpha = 1;
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, w * 0.18, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.18, y - w * 0.1, w * 0.2, w * 0.17, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.12, y - w * 0.14, w * 0.24, w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlat(ctx: CanvasRenderingContext2D, pl: Plat, v: View, g: Trepa) {
  const s = v.scale, shake = pl.crumble > 0 ? Math.sin(g.time * 60) * 0.06 * s : 0;
  const x = v.ox + pl.x * s + shake, y = v.h - (pl.y - v.cam) * s, w = pl.w * s;
  if (y < -s * 12 || y > v.h + s * (pl.kind === 'moon' ? 11 : 3)) return;
  if (pl.gone > 0) { // se desarmó: queda el contorno hasta que vuelve
    ctx.strokeStyle = '#ffffff40'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, s * 0.35); ctx.setLineDash([]);
    return;
  }
  switch (pl.kind) {
    case 'ground': {
      ctx.fillStyle = '#4ade80'; ctx.fillRect(0, y, v.w, s * 0.25);
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(0, y + s * 0.25, v.w, s * 3);
      return;
    }
    case 'beam': { // viga de obra con agujeros
      const h = s * 0.38;
      ctx.fillStyle = '#ea580c'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fdba74'; ctx.fillRect(x, y, w, h * 0.22);
      ctx.fillStyle = '#7c2d12';
      for (let hx = x + s * 0.35; hx < x + w - s * 0.2; hx += s * 0.7) { ctx.beginPath(); ctx.arc(hx, y + h * 0.6, h * 0.18, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    case 'bridge': { // puente colgante: tablas, sogas y postes
      const sag = s * 0.22;
      ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.quadraticCurveTo(x + w / 2, y - s * 0.9 + sag * 2, x + w, y - s * 0.9); ctx.stroke();
      const n = Math.max(4, Math.round(pl.w / 0.5));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, px = x + t * w, py = y + 4 * t * (1 - t) * sag * 0.4;
        ctx.fillStyle = i % 2 ? '#b7792f' : '#c98a3c';
        ctx.fillRect(px - w / n / 2 + 1, py, w / n - 2, s * 0.22);
        ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, y - s * 0.9 + 4 * t * (1 - t) * sag); ctx.stroke();
      }
      ctx.fillStyle = '#5b3412';
      ctx.fillRect(x - s * 0.12, y - s * 1.1, s * 0.16, s * 1.4); ctx.fillRect(x + w - s * 0.04, y - s * 1.1, s * 0.16, s * 1.4);
      return;
    }
    case 'tramp': { // trampolín con patas y lona elástica
      ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.beginPath(); ctx.moveTo(x + w * 0.15, y); ctx.lineTo(x + w * 0.05, y + s * 0.7); ctx.moveTo(x + w * 0.85, y); ctx.lineTo(x + w * 0.95, y + s * 0.7); ctx.stroke();
      ctx.fillStyle = '#2563eb'; ctx.fillRect(x, y, w, s * 0.2);
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + (i + 0.25) * w / 4, y, w / 8, s * 0.2);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(x - s * 0.05, y - s * 0.06, w + s * 0.1, s * 0.1);
      return;
    }
    case 'moving': { // plataforma mecánica con rayas y flechas
      const h = s * 0.36;
      ctx.fillStyle = '#475569'; ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h * 0.45); ctx.clip();
      for (let sx = x - h; sx < x + w; sx += s * 0.4) { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(sx, y + h * 0.45); ctx.lineTo(sx + s * 0.2, y); ctx.lineTo(sx + s * 0.4, y); ctx.lineTo(sx + s * 0.2, y + h * 0.45); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#e2e8f0'; ctx.font = `900 ${Math.round(h * 0.55)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◀ ▶', x + w / 2, y + h * 0.75);
      return;
    }
    case 'crumble': { // ladrillos rajados que se desarman
      const h = s * 0.4, n = Math.max(2, Math.round(pl.w / 0.7));
      for (let i = 0; i < n; i++) {
        const fall = pl.crumble > 0 ? pl.crumble * pl.crumble * s * (0.6 + (i % 3) * 0.4) : 0;
        ctx.fillStyle = i % 2 ? '#a16207' : '#b45309';
        ctx.fillRect(x + i * w / n + 1, y + fall, w / n - 2, h);
      }
      ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.36, y + h * 0.5); ctx.lineTo(x + w * 0.3, y + h); ctx.moveTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.64, y + h * 0.6); ctx.stroke();
      return;
    }
    case 'cloud': { // nube saltarina
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + s * 0.25, w / 2, s * 0.38, 0, 0, Math.PI * 2);
      for (let i = 0; i < 3; i++) ctx.ellipse(x + w * (0.25 + i * 0.25), y + s * 0.05, w * 0.17, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + s * 0.45, w * 0.42, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    case 'asteroid': { // roca espacial con cráteres
      ctx.fillStyle = '#78716c';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + s * 0.4, w / 2, s * 0.55, 0, Math.PI, Math.PI * 2); ctx.ellipse(x + w / 2, y + s * 0.4, w / 2, s * 0.35, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(x + w * 0.1, y - s * 0.02, w * 0.8, s * 0.1);
      ctx.fillStyle = '#57534e';
      ctx.beginPath(); ctx.arc(x + w * 0.3, y + s * 0.35, s * 0.12, 0, Math.PI * 2); ctx.arc(x + w * 0.68, y + s * 0.5, s * 0.09, 0, Math.PI * 2); ctx.fill();
      return;
    }
    case 'flag': { // plataforma de piedra con bandera de control
      const reached = g.checkpoint === pl;
      ctx.fillStyle = '#64748b'; ctx.fillRect(x, y, w, s * 0.45);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(x, y, w, s * 0.12);
      const fx = x + w * 0.8;
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(fx, y - s * 2.2, s * 0.09, s * 2.2);
      const wave = Math.sin(g.time * 6) * s * 0.08;
      ctx.fillStyle = reached ? '#22c55e' : '#ef4444';
      ctx.beginPath(); ctx.moveTo(fx + s * 0.09, y - s * 2.2); ctx.lineTo(fx + s * 1.1, y - s * 1.95 + wave); ctx.lineTo(fx + s * 0.09, y - s * 1.6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(s * 0.42)}px Nunito, system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${Math.round(pl.y)} m`, x + s * 0.2, y - s * 0.2);
      return;
    }
    case 'moon': { // la Luna: el último salto
      const r = s * 5, cx = x + w / 2, cy = y + r - s * 0.05;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
      glow.addColorStop(0, '#fef9c355'); glow.addColorStop(1, '#fef9c300');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e7e5d8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9c6b4';
      for (const [dx, dy, cr] of [[-0.4, 0.3, 0.16], [0.35, 0.15, 0.1], [0.1, 0.55, 0.2], [-0.15, 0.08, 0.06], [0.5, 0.5, 0.08]]) { ctx.beginPath(); ctx.arc(cx + dx * r, cy - r + dy * r * 1.2, cr * r, 0, Math.PI * 2); ctx.fill(); }
      // Bandera de llegada.
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(cx + s * 1.6, y - s * 2.4, s * 0.09, s * 2.4);
      ctx.fillStyle = '#facc15'; ctx.fillRect(cx + s * 1.69, y - s * 2.4, s * 1.2, s * 0.75);
      ctx.fillStyle = '#7c2d12'; ctx.font = `900 ${Math.round(s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('META', cx + s * 2.29, y - s * 2.02);
      return;
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  const p = g.player, f = p.facing, s = v.scale;
  const pw = PLAYER_W * s, ph = PLAYER_H * s;
  const px = v.ox + p.x * s - pw / 2, py = v.h - (p.y - v.cam) * s - ph;
  const onGround = !!p.ground, climbing = !!p.rope;
  const swing = (p.vx !== 0 && onGround) || climbing ? Math.sin(g.time * (climbing ? 12 : 22)) : 0;
  const skin = '#fcd9b6';
  ctx.lineCap = 'round';
  const arm = (side: 1 | -1, phase: number) => {
    const sx = px + pw / 2 + side * pw * 0.4, sy = py + ph * 0.44;
    let hx = sx + side * pw * 0.2 + phase * pw * 0.18, hy = onGround ? sy + ph * 0.24 : sy - ph * 0.16;
    if (climbing) { hx = px + pw / 2 + side * pw * 0.12; hy = py + ph * (0.02 + 0.08 * phase * side); } // agarrado de la soga
    ctx.strokeStyle = skin; ctx.lineWidth = Math.max(2, pw * 0.13);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, pw * 0.09), 0, Math.PI * 2); ctx.fill();
  };
  arm(-f as 1 | -1, -swing);
  const footL = px + pw * 0.38 + swing * pw * 0.22, footR = px + pw * 0.62 - swing * pw * 0.22;
  const leg = (color: string, width: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.38, py + ph * 0.7); ctx.lineTo(footL, py + ph * 0.96);
    ctx.moveTo(px + pw * 0.62, py + ph * 0.7); ctx.lineTo(footR, py + ph * 0.96);
    ctx.stroke();
  };
  leg('#94a3b8', Math.max(3, pw * 0.22));
  leg('#f8fafc', Math.max(2, pw * 0.16));
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(px + pw * 0.27, py + ph * 0.66, pw * 0.46, ph * 0.08);
  ctx.fillStyle = '#1f2937';
  for (const fx of [footL, footR]) { ctx.beginPath(); ctx.ellipse(fx + f * pw * 0.04, py + ph * 0.97, pw * 0.11, pw * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.roundRect(px + pw * 0.22, py + ph * 0.38, pw * 0.56, ph * 0.38, pw * 0.12); ctx.fill();
  const hx = px + pw / 2, hy = py + ph * 0.22, r = pw * 0.3;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx + f * r * 0.95, hy + r * 0.15, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.ellipse(hx - f * r * 0.55, hy + r * 0.05, r * 0.48, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2b48c'; ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + f * r * 0.5, hy - r * 0.05, Math.max(1.2, r * 0.15), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath(); ctx.arc(hx, hy - r * 0.2, r * 1.04, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(hx - r * 1.04, hy - r * 0.32, r * 2.08, r * 0.14);
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath(); ctx.roundRect(f > 0 ? hx + r * 0.3 : hx - r * 1.55, hy - r * 0.32, r * 1.25, r * 0.22, r * 0.1); ctx.fill();
  ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(hx, hy - r * 1.22, r * 0.14, 0, Math.PI * 2); ctx.fill();
  arm(f, swing);
}

function draw(ctx: CanvasRenderingContext2D, g: Trepa, v: View) {
  drawBackground(ctx, v, g.time);
  const s = v.scale;
  // Regla de alturas al costado.
  ctx.font = `700 ${Math.max(10, Math.round(s * 0.32))}px Nunito, system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let m = Math.max(0, Math.ceil(v.cam / 10) * 10); m < v.cam + v.h / s; m += 10) {
    const y = v.h - (m - v.cam) * s;
    const rx = Math.max(v.ox, 0);
    ctx.fillStyle = '#ffffff66'; ctx.fillRect(rx, y, s * 0.3, 2);
    ctx.fillText(`${m}`, rx + s * 0.38, y);
  }
  for (const r of g.ropes) { // sogas con nudos y un gancho arriba
    const x = v.ox + r.x * s, y1 = v.h - (r.y1 - v.cam) * s, y2 = v.h - (r.y2 - v.cam) * s;
    if (y1 < 0 || y2 > v.h) continue;
    ctx.fillStyle = '#334155'; ctx.fillRect(x - s * 0.3, y2 - s * 0.35, s * 0.6, s * 0.15);
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.beginPath(); ctx.moveTo(x, y2 - s * 0.2); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillStyle = '#713f12';
    for (let k = y2 + s * 0.5; k < y1; k += s * 0.8) { ctx.beginPath(); ctx.arc(x, k, s * 0.09, 0, Math.PI * 2); ctx.fill(); }
  }
  // La Luna va primero: las últimas estructuras quedan delante de ella.
  const moon = moonOf(g);
  drawPlat(ctx, moon, v, g);
  for (const pl of g.plats) if (pl !== moon) drawPlat(ctx, pl, v, g);
  drawPlayer(ctx, g, v);
}

const MESSAGES: Record<string, string> = { clouds: '¡Llegaste a las nubes! ☁️', space: '¡Bienvenido al espacio! Acá saltás más alto 🚀', respawn: '¡Volvés a la última bandera!' };

export function Trepaluna() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Trepa>(newTrepa());
  const camRef = useRef(0);
  const camXRef = useRef(WORLD_W / 2);
  const input = useRef<Input>({ left: false, right: false, jump: false, down: false });
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ tenths: 0, height: 0, best: 0 });
  const [record, setRecord] = useState(readTrepaRecord);
  const [newRecord, setNewRecord] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, g = gameRef.current;
    if (!stage || !canvas) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { scale, viewW } = viewFor(w, h);
    const ox = viewW >= WORLD_W ? (w - WORLD_W * scale) / 2 : -camXRef.current * scale;
    draw(ctx, g, { w, h, scale, ox, cam: camRef.current });
  }, []);

  const follow = useCallback((dt: number) => {
    const stage = stageRef.current, g = gameRef.current;
    if (!stage) return;
    const { scale, viewW } = viewFor(stage.clientWidth, stage.clientHeight);
    const viewH = stage.clientHeight / scale;
    const target = Math.max(-1.2, g.player.y - viewH * 0.38); // un poco de piso a la vista al empezar
    const targetX = Math.max(0, Math.min(WORLD_W - viewW, g.player.x - viewW / 2));
    const k = dt < 0 ? 1 : Math.min(1, dt * 4);
    camRef.current += (target - camRef.current) * k;
    camXRef.current += (targetX - camXRef.current) * (dt < 0 ? 1 : Math.min(1, dt * 6));
  }, []);

  const start = useCallback(() => {
    gameRef.current = newTrepa();
    camRef.current = 0;
    follow(-1);
    input.current = { left: false, right: false, jump: false, down: false };
    setHud({ tenths: 0, height: 0, best: 0 });
    setNewRecord(false);
    setToast(null);
    setStatus('playing');
    paint();
  }, [paint, follow]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    follow(-1);
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint, follow]);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(g, input.current, dt);
      for (const e of takeEvents(g)) {
        if (e.type === 'zone') setToast({ text: MESSAGES[e.zone], id: now });
        if (e.type === 'checkpoint') setToast({ text: `🚩 Bandera a ${e.height} m: si te caés, volvés acá`, id: now });
        if (e.type === 'respawn') { setToast({ text: MESSAGES.respawn, id: now }); follow(-1); }
      }
      follow(dt);
      paint();
      const shown = { tenths: Math.floor(g.time * 10), height: Math.floor(g.player.y), best: Math.floor(g.best) };
      setHud(prev => prev.tenths === shown.tenths && prev.height === shown.height ? prev : shown);
      if (g.won) {
        const best = readTrepaRecord();
        if (!best || g.time < best) { saveRecord(g.time); setRecord(g.time); setNewRecord(true); }
        setFinalTime(g.time);
        setStatus('won');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, follow]);

  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) {
        setStatus(s => s === 'playing' ? 'paused' : 'playing');
        return;
      }
      const key = keys[event.key];
      if (!key || statusRef.current !== 'playing') return;
      event.preventDefault();
      input.current[key] = true;
    };
    const up = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) input.current[key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const hold = (key: keyof Input) => ({
    onPointerDown: (event: React.PointerEvent) => { event.preventDefault(); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; },
    onPointerLeave: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  const pct = (m: number) => `${Math.max(0, Math.min(100, (m / MOON_Y) * 100))}%`;
  const zone = hud.height >= ZONES.space ? 'Espacio' : hud.height >= ZONES.clouds ? 'Nubes' : 'Ciudad';

  return <section className="runner trepa" aria-label="Trepaluna">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Trepaluna</h1>
      <div className="runner-scores"><span>Récord <strong>{record ? formatTime(record) : '—'}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label="Recorrido hasta la Luna" />
        {status === 'playing' && toast && <div key={toast.id} className="trepa-toast" role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="trepa-message">
          <div>
            {status === 'ready' && <>
              <h2 id="trepa-message">Trepaluna</h2>
              <p>Saltá de estructura en estructura hasta llegar a la Luna: vigas, puentes colgantes, trampolines, sogas, plataformas que se mueven y ladrillos que se desarman. Pasás las nubes (que te hacen saltar más alto) y llegás al espacio, donde casi no hay gravedad. Las banderas guardan tu lugar. ¡Llegá lo más rápido que puedas!</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar (en la soga, mantené para trepar) · <kbd>↓</kbd> bajar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="trepa-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'won' && <>
              <h2 id="trepa-message">¡Llegaste a la Luna! 🌕</h2>
              <p>Tardaste <strong>{formatTime(finalTime)}</strong>.{newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-time" aria-label="Tiempo">
        <span>Tiempo</span>
        <strong data-testid="trepa-time">{formatTime(hud.tenths / 10)}</strong>
      </aside>
    </div>
    <div className="trepa-height" aria-label="Altura">
      <div className="trepa-height-label"><span>Altura</span><strong data-testid="trepa-height">{hud.height} m</strong><em>{zone}</em></div>
      <div className="trepa-track">
        <div className="trepa-best" style={{ width: pct(hud.best) }} />
        <div className="trepa-fill" style={{ width: pct(hud.height) }} />
        <span className="trepa-mark" style={{ left: pct(ZONES.clouds) }}>☁️ Nubes</span>
        <span className="trepa-mark" style={{ left: pct(ZONES.space) }}>🚀 Espacio</span>
        <span className="trepa-mark trepa-moon" style={{ left: '100%' }}>🌕 Luna</span>
      </div>
    </div>
    <div className="runner-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
      <button type="button" aria-label="Bajar" {...hold('down')}>▼</button>
      <button type="button" className="runner-jump" aria-label="Saltar" {...hold('jump')}>Saltar</button>
    </div>
  </section>;
}
