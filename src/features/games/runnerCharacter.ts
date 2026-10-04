// El personaje de ¡Cuidado, bloques! y de Trepaluna (el mismo en los dos juegos), visto de perfil:
// gorra azul con visera hacia donde mira, nariz, ojo y oreja, brazos separados del cuerpo, remera con
// franjas (azul, amarilla y azul), pantalón blanco y zapatillas. Las piernas y los brazos se mueven al
// correr; en el aire levanta los brazos y en una escalera los estira hacia arriba.

export interface RunnerPose {
  x: number; y: number; w: number; h: number; // rectángulo del personaje en la pantalla (arriba a la izquierda)
  facing: 1 | -1;
  time: number;
  running: boolean;
  airborne: boolean;
  climbing?: boolean;
  falling?: boolean; // perdió: brazos para arriba
  burnt?: boolean;
}

const SKIN = '#fcd9b6';
const BLUE = '#1d4ed8', YELLOW = '#facc15';

export function drawRunner(ctx: CanvasRenderingContext2D, pose: RunnerPose) {
  const { x: px, y: py, w: pw, h: ph, facing: f, burnt } = pose;
  const climbing = !!pose.climbing;
  const swing = pose.running || climbing ? Math.sin(pose.time * (climbing ? 12 : 22)) : 0;
  const skin = burnt ? '#57534e' : SKIN;
  ctx.lineCap = 'round';
  const arm = (side: 1 | -1, phase: number) => {
    const sx = px + pw / 2 + side * pw * 0.4, sy = py + ph * 0.44;
    let hx = sx + side * pw * 0.2 + phase * pw * 0.18;
    let hy = pose.airborne ? sy - ph * 0.16 : sy + ph * 0.24; // en el aire levanta los brazos
    if (climbing) { hx = px + pw / 2 + side * pw * 0.12; hy = py + ph * (0.02 + 0.08 * phase * side); }
    if (pose.falling) { hx = sx + side * pw * 0.5; hy = sy - ph * 0.35; }
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(2, pw * 0.13);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, pw * 0.09), 0, Math.PI * 2); ctx.fill();
  };
  arm(-f as 1 | -1, -swing); // el brazo de atrás va detrás del cuerpo

  // Pantalón blanco (con borde suave para que se vea sobre fondos claros) y zapatillas oscuras.
  const footL = px + pw * 0.38 + swing * pw * 0.22, footR = px + pw * 0.62 - swing * pw * 0.22;
  const leg = (color: string, width: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.38, py + ph * 0.7); ctx.lineTo(footL, py + ph * 0.96);
    ctx.moveTo(px + pw * 0.62, py + ph * 0.7); ctx.lineTo(footR, py + ph * 0.96);
    ctx.stroke();
  };
  leg('#94a3b8', Math.max(3, pw * 0.22));
  leg(burnt ? '#44403c' : '#f8fafc', Math.max(2, pw * 0.16));
  ctx.fillStyle = burnt ? '#44403c' : '#f8fafc';
  ctx.fillRect(px + pw * 0.27, py + ph * 0.66, pw * 0.46, ph * 0.08);
  ctx.fillStyle = '#1f2937';
  for (const fx of [footL, footR]) { ctx.beginPath(); ctx.ellipse(fx + f * pw * 0.04, py + ph * 0.97, pw * 0.11, pw * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }

  // Remera con franjas: azul arriba, amarilla en el medio y azul abajo.
  const tx = px + pw * 0.22, ty = py + ph * 0.38, tw = pw * 0.56, th = ph * 0.38;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, pw * 0.12); ctx.clip();
  if (burnt) { ctx.fillStyle = '#292524'; ctx.fillRect(tx, ty, tw, th); }
  else {
    ctx.fillStyle = BLUE; ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = YELLOW; ctx.fillRect(tx, ty + th / 3, tw, th / 3);
  }
  ctx.restore();

  const hx = px + pw / 2, hy = py + ph * 0.22, r = pw * 0.3;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx + f * r * 0.95, hy + r * 0.15, r * 0.26, 0, Math.PI * 2); ctx.fill(); // nariz
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b2412'; // pelo que asoma atrás de la gorra
  ctx.beginPath(); ctx.ellipse(hx - f * r * 0.55, hy + r * 0.05, r * 0.48, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = burnt ? '#44403c' : '#f2b48c'; // oreja
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c98a66';
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = burnt ? '#fff' : '#111'; // ojo
  ctx.beginPath(); ctx.arc(hx + f * r * 0.5, hy - r * 0.05, Math.max(1.2, r * 0.15), 0, Math.PI * 2); ctx.fill();
  // Gorra azul con visera hacia donde mira.
  ctx.fillStyle = burnt ? '#1c1917' : '#2563eb';
  ctx.beginPath(); ctx.arc(hx, hy - r * 0.2, r * 1.04, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(hx - r * 1.04, hy - r * 0.32, r * 2.08, r * 0.14);
  ctx.fillStyle = burnt ? '#1c1917' : '#1d4ed8';
  ctx.beginPath(); ctx.roundRect(f > 0 ? hx + r * 0.3 : hx - r * 1.55, hy - r * 0.32, r * 1.25, r * 0.22, r * 0.1); ctx.fill();
  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(hx, hy - r * 1.22, r * 0.14, 0, Math.PI * 2); ctx.fill();
  arm(f, swing); // el brazo de adelante va delante del cuerpo
}
