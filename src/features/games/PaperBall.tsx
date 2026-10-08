import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BALL_R, BOSS_H, BOSS_W, canThrow, DESK, H, launch, newPaper, ORIGIN, preview, standOf, step, takeEvents, throwBall, TIME, W,
  type Ball, type Bin, type PaperGame,
} from './paperBall';

const RECORD_KEY = 'escritorio-personal-juegos:cesto-record';
export const readPaperRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento */ } };

type Status = 'ready' | 'playing' | 'paused' | 'over';
// La oficina (16 × 9 unidades) entra entera en la pantalla, centrada.
interface View { w: number; h: number; s: number; ox: number; oy: number; t: number }
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy + (H - y) * v.s;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (ctx: CanvasRenderingContext2D, v: View, x1: number, y1: number, x2: number, y2: number) => ctx.fillRect(X(v, x1), Y(v, y2), (x2 - x1) * v.s, (y2 - y1) * v.s);
interface Aim { sx: number; sy: number; x: number; y: number }
interface Pop { text: string; x: number; y: number; at: number; color: string }

// ---------- La oficina ----------
function drawRoom(ctx: CanvasRenderingContext2D, v: View, g: PaperGame) {
  const s = v.s;
  ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, v.w, v.h);
  const wall = ctx.createLinearGradient(0, Y(v, H), 0, Y(v, 0));
  wall.addColorStop(0, '#e9dcc3'); wall.addColorStop(1, '#d6c4a3');
  ctx.fillStyle = wall; box(ctx, v, 0, 0, W, H);
  ctx.fillStyle = 'rgba(120,90,50,0.07)'; for (let x = 0; x < W; x += 0.5) box(ctx, v, x, 0.6, x + 0.04, H); // empapelado a rayas
  // Ventana con persiana y la ciudad afuera.
  const wx1 = 5.4, wx2 = 9.6, wy1 = 4.6, wy2 = 8.2;
  ctx.fillStyle = '#94a3b8'; box(ctx, v, wx1 - 0.15, wy1 - 0.15, wx2 + 0.15, wy2 + 0.15);
  const sky = ctx.createLinearGradient(0, Y(v, wy2), 0, Y(v, wy1));
  sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky; box(ctx, v, wx1, wy1, wx2, wy2);
  for (let i = 0; i < 9; i++) { const bx = wx1 + i * 0.48, bh = 0.6 + hash(i) * 1.8; ctx.fillStyle = i % 2 ? '#64748b' : '#475569'; box(ctx, v, bx, wy1, bx + 0.42, wy1 + bh); }
  ctx.save(); ctx.beginPath(); ctx.rect(X(v, wx1), Y(v, wy2), (wx2 - wx1) * s, (wy2 - wy1) * s); ctx.clip(); // las nubes, adentro de la ventana
  ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { const cx = wx1 + ((v.t * 0.15 + i * 1.6) % 4.6) - 0.2, cy = wy2 - 0.6 - i * 0.5; ctx.beginPath(); ctx.ellipse(X(v, cx), Y(v, cy), s * 0.4, s * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(241,245,249,0.85)'; for (let y = wy2 - 0.15; y > wy2 - 1.4; y -= 0.16) box(ctx, v, wx1, y - 0.08, wx2, y); // persiana a medio subir
  ctx.fillStyle = '#94a3b8'; box(ctx, v, (wx1 + wx2) / 2 - 0.05, wy1, (wx1 + wx2) / 2 + 0.05, wy2);
  // Reloj que corre con el juego.
  const cx = X(v, 11.3), cy = Y(v, 7.4), r = s * 0.55;
  ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillStyle = '#1f2937'; ctx.fillRect(cx + Math.cos(a) * r * 0.82 - 1, cy + Math.sin(a) * r * 0.82 - 1, 2, 2); }
  const sec = (g.time / TIME) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sec) * r * 0.8, cy + Math.sin(sec) * r * 0.8); ctx.stroke();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.45, cy - r * 0.2); ctx.stroke();
  // Póster motivacional y pizarrón con un gráfico.
  ctx.fillStyle = '#1e3a8a'; box(ctx, v, 12.6, 5.6, 14.6, 8.1);
  ctx.fillStyle = '#fde047'; ctx.font = `900 ${Math.max(8, Math.round(s * 0.32))}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('¡TRABAJÁ!', X(v, 13.6), Y(v, 6.1)); ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.moveTo(X(v, 13.1), Y(v, 6.6)); ctx.lineTo(X(v, 13.6), Y(v, 7.7)); ctx.lineTo(X(v, 14.1), Y(v, 6.6)); ctx.fill();
  ctx.fillStyle = '#f8fafc'; box(ctx, v, 0.6, 4.8, 3.9, 7.6); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 3; ctx.strokeRect(X(v, 0.6), Y(v, 7.6), 3.3 * s, 2.8 * s);
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(v, 0.9), Y(v, 5.2)); ctx.lineTo(X(v, 1.6), Y(v, 6.4)); ctx.lineTo(X(v, 2.3), Y(v, 5.7)); ctx.lineTo(X(v, 3.5), Y(v, 7.2)); ctx.stroke();
  // Zócalo y alfombra.
  ctx.fillStyle = '#7c5a3a'; box(ctx, v, 0, 0, W, 0.35);
  ctx.fillStyle = '#475569'; ctx.fillRect(0, Y(v, 0), v.w, v.h - Y(v, 0));
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) ctx.fillRect(X(v, hash(i) * W), Y(v, 0) + hash(i + 3) * (v.h - Y(v, 0)), s * 0.6, 2);
}

// Mi escritorio, con la compu, el café, la pila de hojas y el oficinista que tira.
function drawDesk(ctx: CanvasRenderingContext2D, v: View, aim: Aim | null, ready: boolean) {
  const s = v.s, t = v.t;
  // Silla y oficinista (de espaldas, mirando a la oficina).
  ctx.fillStyle = '#111827'; box(ctx, v, 0.5, 1.1, 1.9, 1.3); box(ctx, v, 0.6, 1.3, 0.8, 3.2); box(ctx, v, 1.1, 0, 1.2, 1.1);
  ctx.fillStyle = '#374151'; box(ctx, v, 0.7, 0, 1.6, 0.12);
  ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.roundRect(X(v, 0.75), Y(v, 3.3), s * 1.0, s * 1.9, s * 0.25); ctx.fill(); // camisa
  ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(X(v, 1.25), Y(v, 3.75), s * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.arc(X(v, 1.2), Y(v, 3.9), s * 0.43, Math.PI * 1.05, Math.PI * 2.05); ctx.fill();
  // El brazo va hasta la mano (tira para atrás cuando apuntás).
  const hx = aim ? Math.max(1.6, ORIGIN.x + (aim.x - aim.sx) * 0.25) : ORIGIN.x, hy = aim ? Math.max(2.5, ORIGIN.y + (aim.y - aim.sy) * 0.25) : ORIGIN.y;
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = s * 0.28; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(v, 1.6), Y(v, 3.0)); ctx.lineTo(X(v, hx), Y(v, hy)); ctx.stroke();
  ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(X(v, hx), Y(v, hy), s * 0.16, 0, Math.PI * 2); ctx.fill();
  if (ready) drawPaper(ctx, v, hx + 0.1, hy + 0.1, t * 0.5, 0);
  // El escritorio.
  ctx.fillStyle = '#8b5a2b'; box(ctx, v, DESK.x1, DESK.y - 0.2, DESK.x2, DESK.y);
  ctx.fillStyle = '#6b4423'; box(ctx, v, DESK.x1 + 0.1, 0, DESK.x1 + 0.3, DESK.y - 0.2); box(ctx, v, DESK.x2 - 0.3, 0, DESK.x2 - 0.1, DESK.y - 0.2);
  ctx.fillStyle = '#7c4a1e'; box(ctx, v, DESK.x2 - 1.4, 0.4, DESK.x2 - 0.3, DESK.y - 0.2); ctx.fillStyle = '#fbbf24'; box(ctx, v, DESK.x2 - 0.9, 1.4, DESK.x2 - 0.75, 1.5);
  // Compu, café y la pila de hojas.
  ctx.fillStyle = '#111827'; box(ctx, v, 0.15, DESK.y, 1.15, DESK.y + 0.9); ctx.fillStyle = '#a7f3d0'; box(ctx, v, 0.22, DESK.y + 0.12, 1.08, DESK.y + 0.82);
  ctx.fillStyle = '#10b981'; for (let i = 0; i < 5; i++) box(ctx, v, 0.3, DESK.y + 0.2 + i * 0.12, 0.3 + 0.2 + hash(i) * 0.5, DESK.y + 0.25 + i * 0.12);
  ctx.fillStyle = '#f8fafc'; for (let i = 0; i < 6; i++) box(ctx, v, 2.5 + (i % 2) * 0.03, DESK.y + i * 0.06, 3.2, DESK.y + i * 0.06 + 0.05);
  ctx.fillStyle = '#b91c1c'; box(ctx, v, 1.9, DESK.y, 2.2, DESK.y + 0.3); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) { const q = (t * 0.6 + i * 0.5) % 1; ctx.beginPath(); ctx.moveTo(X(v, 2.0 + i * 0.1), Y(v, DESK.y + 0.35 + q * 0.4)); ctx.quadraticCurveTo(X(v, 2.1 + i * 0.1), Y(v, DESK.y + 0.45 + q * 0.4), X(v, 2.0 + i * 0.1), Y(v, DESK.y + 0.55 + q * 0.4)); ctx.stroke(); } // humito del café
}

// Un bollo de papel arrugado (gira mientras vuela).
function drawPaper(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, angle: number, seed: number) {
  const s = v.s, r = BALL_R * s;
  ctx.save(); ctx.translate(X(v, x), Y(v, y)); ctx.rotate(angle);
  ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = r * (0.85 + hash(i + seed * 3) * 0.3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.1); ctx.lineTo(r * 0.4, -r * 0.4); ctx.moveTo(-r * 0.2, r * 0.5); ctx.lineTo(r * 0.2, r * 0.2); ctx.stroke();
  ctx.fillStyle = 'rgba(37,99,235,0.35)'; ctx.fillRect(-r * 0.4, -r * 0.05, r * 0.6, 1.5); // algo escrito
  ctx.restore();
}

// El cesto de alambre (con lo que ya embocaste adentro) y lo que tiene abajo: un mueble, un estante o una
// silla con rueditas.
function drawBin(ctx: CanvasRenderingContext2D, v: View, b: Bin, made: number, front: boolean) {
  const s = v.s, half = b.w / 2, top = b.y + b.h;
  if (!front) {
    const st = standOf(b);
    if (st && b.y > 2) { // estante en la pared, con libros
      ctx.fillStyle = '#7c4a1e'; box(ctx, v, st.x1, st.y - 0.15, st.x2, st.y);
      ctx.fillStyle = '#4b5563'; box(ctx, v, st.x1 + 0.2, st.y - 0.6, st.x1 + 0.3, st.y - 0.15); box(ctx, v, st.x2 - 0.3, st.y - 0.6, st.x2 - 0.2, st.y - 0.15);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207'][i]; box(ctx, v, st.x2 - 0.75 + i * 0.16, st.y, st.x2 - 0.62 + i * 0.16, st.y + 0.5 + hash(i) * 0.15); }
    } else if (st) { // mueble archivero
      ctx.fillStyle = '#9ca3af'; box(ctx, v, st.x1, 0, st.x2, st.y);
      ctx.fillStyle = '#6b7280'; for (let i = 0; i < 2; i++) { box(ctx, v, st.x1 + 0.1, 0.15 + i * 0.75, st.x2 - 0.1, 0.8 + i * 0.75); }
      ctx.fillStyle = '#d1d5db'; for (let i = 0; i < 2; i++) box(ctx, v, b.x - 0.25, 0.45 + i * 0.75, b.x + 0.25, 0.52 + i * 0.75);
      ctx.fillStyle = '#e5e7eb'; box(ctx, v, st.x1 - 0.05, st.y - 0.06, st.x2 + 0.05, st.y);
    }
    if (b.vx) { // rueditas
      ctx.fillStyle = '#111827'; for (const dx of [-half, half]) { ctx.beginPath(); ctx.arc(X(v, b.x + dx * 0.8), Y(v, 0.08), s * 0.09, 0, Math.PI * 2); ctx.fill(); }
    }
    // La parte de atrás del cesto y los bollos adentro.
    ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, top), half * s, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < Math.min(made, 6); i++) drawPaper(ctx, v, b.x + (hash(i) - 0.5) * (b.w - 0.4), b.y + 0.2 + Math.min(0.5, i * 0.08), i, i);
    return;
  }
  // Adelante: la malla de alambre.
  const bot = half * 0.82;
  ctx.fillStyle = 'rgba(100,116,139,0.35)';
  ctx.beginPath(); ctx.moveTo(X(v, b.x - half), Y(v, top)); ctx.lineTo(X(v, b.x + half), Y(v, top)); ctx.lineTo(X(v, b.x + bot), Y(v, b.y)); ctx.lineTo(X(v, b.x - bot), Y(v, b.y)); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) { const k = i / 8; ctx.moveTo(X(v, b.x - half + k * b.w), Y(v, top)); ctx.lineTo(X(v, b.x - bot + k * bot * 2), Y(v, b.y)); }
  for (let y = b.y + 0.2; y < top; y += 0.22) { const k = (y - b.y) / b.h, hw = bot + (half - bot) * k; ctx.moveTo(X(v, b.x - hw), Y(v, y)); ctx.lineTo(X(v, b.x + hw), Y(v, y)); }
  ctx.stroke();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath(); ctx.ellipse(X(v, b.x), Y(v, top), half * s, s * 0.14, 0, 0, Math.PI); ctx.stroke(); // el borde de adelante
  ctx.beginPath(); ctx.moveTo(X(v, b.x - bot), Y(v, b.y)); ctx.lineTo(X(v, b.x + bot), Y(v, b.y)); ctx.stroke();
}

// El ventilador de pie, que gira más rápido cuanto más sopla, y el aire que cruza la oficina.
function drawFan(ctx: CanvasRenderingContext2D, v: View, g: PaperGame) {
  const s = v.s, t = v.t, f = g.fan, fx = f.dir > 0 ? 4.2 : 15.3, fy = 2.4;
  ctx.fillStyle = '#374151'; box(ctx, v, fx - 0.05, 0, fx + 0.05, fy - 0.3); ctx.beginPath(); ctx.ellipse(X(v, fx), Y(v, 0.05), s * 0.4, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(X(v, fx), Y(v, fy)); ctx.scale(f.dir * 0.35, 1);
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  const spin = t * (f.power ? 8 + f.power * 10 : 0.5);
  for (let i = 0; i < 3; i++) { const a = spin + (i / 3) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.25, s * 0.26, s * 0.1, a, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Cintitas atadas a la reja y el aire que cruza la oficina.
  for (let i = 0; i < 3; i++) {
    const y0 = fy + (i - 1) * 0.3, len = 0.2 + f.power * 0.25;
    ctx.strokeStyle = ['#ef4444', '#facc15', '#22c55e'][i]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(v, fx + f.dir * 0.2), Y(v, y0));
    ctx.quadraticCurveTo(X(v, fx + f.dir * (0.2 + len / 2)), Y(v, y0 + Math.sin(t * 20 + i) * 0.06 * f.power - (f.power ? 0 : 0.2)), X(v, fx + f.dir * (0.2 + len)), Y(v, y0 + Math.sin(t * 25 + i) * 0.08 * f.power - (f.power ? 0 : 0.4)));
    ctx.stroke();
  }
  if (!f.power) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.12 + f.power * 0.08})`; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6 + f.power * 4; i++) {
    const k = (t * (0.3 + f.power * 0.25) + hash(i)) % 1, x = f.dir > 0 ? 4.5 + k * 11 : 15 - k * 11, y = 0.8 + hash(i + 5) * 6.5;
    ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, y)); ctx.lineTo(X(v, x - f.dir * (0.6 + f.power * 0.3)), Y(v, y)); ctx.stroke();
  }
}

// El jefe, de traje y con su café, cruzando la oficina (se enoja si le pegás).
function drawBoss(ctx: CanvasRenderingContext2D, v: View, g: PaperGame) {
  const p = g.boss;
  if (!p) return;
  const s = v.s, t = v.t, x = p.x, mad = p.hit > g.time, step = Math.sin(t * 8) * 0.18;
  ctx.strokeStyle = '#111827'; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(v, x - 0.12), Y(v, 1.2)); ctx.lineTo(X(v, x - 0.12 + step), Y(v, 0.1)); ctx.moveTo(X(v, x + 0.12), Y(v, 1.2)); ctx.lineTo(X(v, x + 0.12 - step), Y(v, 0.1)); ctx.stroke();
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect(X(v, x - BOSS_W / 2), Y(v, BOSS_H - 0.55), BOSS_W * s, s * 1.45, s * 0.15); ctx.fill();
  ctx.fillStyle = '#f8fafc'; box(ctx, v, x - 0.1, 1.7, x + 0.1, BOSS_H - 0.6);
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(X(v, x), Y(v, BOSS_H - 0.6)); ctx.lineTo(X(v, x - 0.07), Y(v, 1.8)); ctx.lineTo(X(v, x), Y(v, 1.65)); ctx.lineTo(X(v, x + 0.07), Y(v, 1.8)); ctx.fill();
  ctx.fillStyle = mad ? '#f87171' : '#fcd9b6'; ctx.beginPath(); ctx.arc(X(v, x), Y(v, BOSS_H - 0.3), s * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.arc(X(v, x), Y(v, BOSS_H - 0.18), s * 0.3, Math.PI, Math.PI * 2); ctx.fill(); // pelado con canas
  ctx.fillStyle = '#111827'; ctx.fillRect(X(v, x + p.dir * 0.12) - 2, Y(v, BOSS_H - 0.28) - 2, 4, 4);
  ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.ellipse(X(v, x + p.dir * 0.1), Y(v, BOSS_H - 0.45), s * 0.14, s * 0.05, 0, 0, Math.PI * 2); ctx.fill(); // bigote
  ctx.fillStyle = '#f8fafc'; box(ctx, v, x + p.dir * 0.45 - 0.1, 1.55, x + p.dir * 0.45 + 0.1, 1.85); // el café
  if (mad) { ctx.fillStyle = '#dc2626'; ctx.font = `900 ${Math.round(s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.fillText('¡EY!', X(v, x), Y(v, BOSS_H + 0.35)); }
}

function drawBalls(ctx: CanvasRenderingContext2D, v: View, balls: Ball[]) {
  for (const k of balls) drawPaper(ctx, v, k.x, k.y, k.t * (6 + Math.hypot(k.vx, k.vy) * 0.3), k.id);
}

// La puntería: los puntitos de por dónde va a ir (sin contar el ventilador) y la fuerza.
function drawAim(ctx: CanvasRenderingContext2D, v: View, aim: Aim) {
  const { vx, vy, power } = launch(aim.sx, aim.sy, aim.x, aim.y), s = v.s;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  preview(vx, vy, 14).forEach(([x, y], i) => { ctx.globalAlpha = 1 - i / 15; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), s * 0.06, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(v, aim.sx), Y(v, aim.sy)); ctx.lineTo(X(v, aim.x), Y(v, aim.y)); ctx.stroke(); ctx.setLineDash([]);
  // Barra de fuerza.
  const bx = X(v, 0.4), by = Y(v, 8.6), bw = s * 2.6, bh = s * 0.25;
  ctx.fillStyle = 'rgba(15,23,42,0.6)'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = `hsl(${120 - power * 120},80%,50%)`; ctx.fillRect(bx, by, bw * power, bh);
}

function draw(ctx: CanvasRenderingContext2D, g: PaperGame, v: View, aim: Aim | null, pops: Pop[]) {
  drawRoom(ctx, v, g);
  drawFan(ctx, v, g);
  drawBin(ctx, v, g.bin, g.made, false);
  drawBoss(ctx, v, g);
  drawDesk(ctx, v, aim, canThrow(g));
  drawBalls(ctx, v, g.balls.filter(k => k.state === 'in'));
  drawBin(ctx, v, g.bin, g.made, true);
  drawBalls(ctx, v, g.balls.filter(k => k.state !== 'in'));
  if (aim) drawAim(ctx, v, aim);
  // Los cartelitos de puntos que suben.
  for (const p of pops) {
    const a = g.time - p.at;
    if (a > 1.3) continue;
    ctx.globalAlpha = 1 - a / 1.3; ctx.fillStyle = p.color; ctx.font = `900 ${Math.round(v.s * 0.5)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.strokeText(p.text, X(v, p.x), Y(v, p.y + a * 0.8)); ctx.fillText(p.text, X(v, p.x), Y(v, p.y + a * 0.8));
    ctx.globalAlpha = 1;
  }
}

export function PaperBall() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PaperGame>(newPaper());
  const aimRef = useRef<Aim | null>(null);
  const popsRef = useRef<Pop[]>([]);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ left: TIME, score: 0, streak: 0, fan: 0, dir: 1 });
  const [record, setRecord] = useState(readPaperRecord);
  const [result, setResult] = useState({ score: 0, made: 0, shots: 0, best: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 1800); return () => clearTimeout(timer); }, [toast]);

  const view = useCallback((): View | null => {
    const stage = stageRef.current;
    if (!stage || !stage.clientWidth || !stage.clientHeight) return null;
    const w = stage.clientWidth, h = stage.clientHeight, s = Math.min(w / W, h / H);
    return { w, h, s, ox: (w - W * s) / 2, oy: (h - H * s) / 2, t: gameRef.current.time };
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current, v = view();
    if (!canvas || !v) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(v.w * dpr) || canvas.height !== Math.round(v.h * dpr)) {
      canvas.width = Math.round(v.w * dpr); canvas.height = Math.round(v.h * dpr);
      canvas.style.width = `${v.w}px`; canvas.style.height = `${v.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, gameRef.current, v, aimRef.current, popsRef.current);
  }, [view]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  const start = useCallback(() => {
    gameRef.current = newPaper(); aimRef.current = null; popsRef.current = [];
    setHud({ left: TIME, score: 0, streak: 0, fan: 0, dir: 1 });
    setToast({ text: 'Hacé clic, tirá para atrás y soltá 🗑️', id: Date.now() });
    setStatus('playing');
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(g, dt);
      for (const e of takeEvents(g)) {
        if (e.type === 'score') {
          const extra = [e.swish && '¡Limpia!', e.far && '¡De lejos!', e.streak >= 3 && `¡Racha x${e.streak}!`].filter(Boolean).join(' ');
          popsRef.current.push({ text: `+${e.points} ${extra}`.trim(), x: e.x, y: e.y + 0.5, at: g.time, color: '#4ade80' });
        }
        if (e.type === 'boss') { popsRef.current.push({ text: e.points ? `-${e.points} ¡Al jefe no!` : '¡Al jefe no!', x: g.boss?.x ?? 8, y: BOSS_H + 0.8, at: g.time, color: '#f87171' }); setToast({ text: '¡Le pegaste al jefe! 😠', id: now }); }
        if (e.type === 'bossIn') setToast({ text: '¡Cuidado, viene el jefe! 👔', id: now });
        if (e.type === 'level') setToast({ text: e.level === 4 ? '¡El cesto ahora tiene rueditas! 🛞' : `¡Nivel ${e.level + 1}! El cesto se aleja`, id: now });
      }
      popsRef.current = popsRef.current.filter(p => g.time - p.at < 1.4);
      paint();
      setHud(p => {
        const n = { left: Math.ceil(g.left), score: g.score, streak: g.streak, fan: g.fan.power, dir: g.fan.dir };
        return p.left === n.left && p.score === n.score && p.streak === n.streak && p.fan === n.fan && p.dir === n.dir ? p : n;
      });
      if (g.over) {
        const prev = readPaperRecord(), isNew = g.score > prev;
        if (isNew) { saveRecord(g.score); setRecord(g.score); }
        setResult({ score: g.score, made: g.made, shots: g.shots, best: g.bestStreak, newRecord: isNew && prev > 0 });
        aimRef.current = null; setToast(null); setStatus('over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) setStatus(s => s === 'playing' ? 'paused' : 'playing');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // El mouse (o el dedo) en coordenadas de la oficina.
  const toWorld = (event: React.PointerEvent) => {
    const v = view(), r = stageRef.current?.getBoundingClientRect();
    if (!v || !r) return null;
    return { x: (event.clientX - r.left - v.ox) / v.s, y: H - (event.clientY - r.top - v.oy) / v.s };
  };
  const onDown = (event: React.PointerEvent) => {
    if (statusRef.current !== 'playing') return;
    const p = toWorld(event);
    if (!p) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    aimRef.current = { sx: p.x, sy: p.y, x: p.x, y: p.y };
  };
  const onMove = (event: React.PointerEvent) => {
    const a = aimRef.current, p = a && toWorld(event);
    if (a && p) { a.x = p.x; a.y = p.y; }
  };
  const onUp = () => {
    const a = aimRef.current;
    aimRef.current = null;
    if (!a || statusRef.current !== 'playing') return;
    const { vx, vy } = launch(a.sx, a.sy, a.x, a.y);
    throwBall(gameRef.current, vx, vy);
  };

  const fanText = hud.fan ? `${hud.dir > 0 ? '→' : '←'} ${'💨'.repeat(hud.fan)}` : 'Apagado';
  return <section className="runner bol" aria-label="¡Al cesto!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡Al cesto!</h1>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="bol-main">
      <div className="runner-stage" ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { aimRef.current = null; }}>
        <canvas ref={canvasRef} role="img" aria-label="Oficina con un cesto de papeles" />
        {status === 'playing' && toast && <div key={toast.id} className="bol-toast" role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="bol-message">
          <div>
            {status === 'ready' && <>
              <h2 id="bol-message">¡Al cesto! 🗑️</h2>
              <p>Es viernes a la tarde y en la oficina no hay nada que hacer: embocá bollos de papel en el cesto. Hacé <strong>clic</strong>, tirá para atrás como una gomera y <strong>soltá</strong>. Ojo con el <strong>ventilador</strong>, que desvía los bollos. Tenés <strong>60 segundos</strong> y cada bollo embocado suma 2 más. Suman más los tiros de lejos, los limpios y las rachas. Y cuidado con el jefe…</p>
              <p className="runner-keys">Solo con el mouse · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="bol-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="bol-message">¡Se terminó el tiempo! ⏰</h2>
              <p>Hiciste <strong>{result.score}</strong> puntos: embocaste {result.made} de {result.shots} bollos y tu mejor racha fue de {result.best}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="bol-side" aria-label="Tiempo, puntos, racha, viento y récord">
        <div className={`bol-stat${hud.left <= 10 ? ' bol-hurry' : ''}`}><span>Tiempo</span><strong data-testid="bol-time">{hud.left}</strong></div>
        <div className="bol-stat bol-stat--points"><span>Puntos</span><strong data-testid="bol-points">{hud.score}</strong></div>
        <div className="bol-stat"><span>Racha</span><strong>{hud.streak}</strong></div>
        <div className="bol-stat bol-stat--fan"><span>Ventilador</span><strong data-testid="bol-fan">{fanText}</strong></div>
        <div className="bol-stat"><span>Récord</span><strong>{record}</strong></div>
      </aside>
    </div>
  </section>;
}
