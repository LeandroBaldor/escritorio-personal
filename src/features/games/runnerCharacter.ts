// El personaje de ¡Cuidado, bloques! y de Trepaluna (el mismo en los dos juegos), visto de perfil:
// gorra azul con visera hacia donde mira, nariz, ojo y oreja, brazos separados del cuerpo, remera con
// franjas (azul, amarilla y azul), pantalón blanco y zapatillas. Las piernas y los brazos se mueven al
// correr; en el aire levanta los brazos y en una escalera los estira hacia arriba.
//
// Con `look` se dibuja otra persona con el mismo estilo (la gente de ¡El piso es de lava!): otra piel, otro
// pelo, otro gorro (o ninguno), otra remera, otro pantalón y otras zapatillas.

export type RunnerHat = 'cap' | 'helmet' | 'beanie' | 'short' | 'long' | 'bun' | 'bald';
export interface RunnerLook {
  skin: string; ear: string; hair: string;
  hat: RunnerHat; hatColor: string; brim: string; dot: string;
  shirt: [string, string, string]; // franja de arriba, del medio y de abajo
  pants: string; pantsEdge: string; shoes: string;
}
export const HERO: RunnerLook = {
  skin: '#fcd9b6', ear: '#f2b48c', hair: '#3b2412',
  hat: 'cap', hatColor: '#2563eb', brim: '#1d4ed8', dot: '#facc15',
  shirt: ['#1d4ed8', '#facc15', '#1d4ed8'],
  pants: '#f8fafc', pantsEdge: '#94a3b8', shoes: '#1f2937',
};

export interface RunnerPose {
  x: number; y: number; w: number; h: number; // rectángulo del personaje en la pantalla (arriba a la izquierda)
  facing: 1 | -1;
  time: number;
  running: boolean;
  airborne: boolean;
  climbing?: boolean;
  falling?: boolean; // perdió: brazos para arriba
  burnt?: boolean;
  look?: RunnerLook;
  pace?: number; // lo rápido que mueve las piernas (caminando, más despacio)
}

export function drawRunner(ctx: CanvasRenderingContext2D, pose: RunnerPose) {
  const { x: px, y: py, w: pw, h: ph, facing: f, burnt } = pose;
  const look = pose.look ?? HERO;
  const climbing = !!pose.climbing;
  const swing = pose.running || climbing ? Math.sin(pose.time * (climbing ? 12 : pose.pace ?? 22)) : 0;
  const skin = burnt ? '#57534e' : look.skin;
  ctx.lineCap = 'round';
  const arm = (side: 1 | -1, phase: number) => {
    const sx = px + pw / 2 + side * pw * 0.4, sy = py + ph * 0.44;
    let hx = sx + side * pw * 0.2 + phase * pw * 0.18;
    let hy = pose.airborne ? sy - ph * 0.16 : sy + ph * 0.24; // en el aire levanta los brazos
    if (climbing) { hx = px + pw / 2 + side * pw * 0.12; hy = py + ph * (0.02 + 0.08 * phase * side); }
    if (pose.falling) { hx = sx + side * pw * 0.5 + phase * pw * 0.12; hy = sy - ph * 0.35 + phase * ph * 0.06; }
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(2, pw * 0.13);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, pw * 0.09), 0, Math.PI * 2); ctx.fill();
  };
  arm(-f as 1 | -1, -swing); // el brazo de atrás va detrás del cuerpo

  // Pelo largo: cae por la espalda (detrás del cuerpo).
  const hx = px + pw / 2, hy = py + ph * 0.22, r = pw * 0.3;
  if (look.hat === 'long' && !burnt) {
    ctx.fillStyle = look.hair;
    ctx.beginPath(); ctx.roundRect(hx - f * r * 1.05 - r * 0.55, hy - r * 0.2, r * 1.1, r * 2.1, r * 0.5); ctx.fill();
  }

  // Pantalón (con borde suave para que se vea sobre fondos claros) y zapatillas.
  const footL = px + pw * 0.38 + swing * pw * 0.22, footR = px + pw * 0.62 - swing * pw * 0.22;
  const leg = (color: string, width: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.38, py + ph * 0.7); ctx.lineTo(footL, py + ph * 0.96);
    ctx.moveTo(px + pw * 0.62, py + ph * 0.7); ctx.lineTo(footR, py + ph * 0.96);
    ctx.stroke();
  };
  leg(look.pantsEdge, Math.max(3, pw * 0.22));
  leg(burnt ? '#44403c' : look.pants, Math.max(2, pw * 0.16));
  ctx.fillStyle = burnt ? '#44403c' : look.pants;
  ctx.fillRect(px + pw * 0.27, py + ph * 0.66, pw * 0.46, ph * 0.08);
  ctx.fillStyle = look.shoes;
  for (const fx of [footL, footR]) { ctx.beginPath(); ctx.ellipse(fx + f * pw * 0.04, py + ph * 0.97, pw * 0.11, pw * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }

  // Remera en tres franjas (la del protagonista: azul, amarilla y azul).
  const tx = px + pw * 0.22, ty = py + ph * 0.38, tw = pw * 0.56, th = ph * 0.38;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, pw * 0.12); ctx.clip();
  if (burnt) { ctx.fillStyle = '#292524'; ctx.fillRect(tx, ty, tw, th); }
  else {
    ctx.fillStyle = look.shirt[0]; ctx.fillRect(tx, ty, tw, th / 3 + 0.5);
    ctx.fillStyle = look.shirt[1]; ctx.fillRect(tx, ty + th / 3, tw, th / 3 + 0.5);
    ctx.fillStyle = look.shirt[2]; ctx.fillRect(tx, ty + (th * 2) / 3, tw, th / 3);
  }
  ctx.restore();

  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx + f * r * 0.95, hy + r * 0.15, r * 0.26, 0, Math.PI * 2); ctx.fill(); // nariz
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
  const hair = burnt ? '#1c1917' : look.hair;
  if (look.hat !== 'bald') { // pelo que asoma atrás
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.ellipse(hx - f * r * 0.55, hy + r * 0.05, r * 0.48, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = burnt ? '#44403c' : look.ear; // oreja
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c98a66';
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = burnt ? '#fff' : '#111'; // ojo
  ctx.beginPath(); ctx.arc(hx + f * r * 0.5, hy - r * 0.05, Math.max(1.2, r * 0.15), 0, Math.PI * 2); ctx.fill();

  // Lo de la cabeza: gorra, casco, gorro de lana o pelo (corto, largo o rodete).
  const hat = burnt ? '#1c1917' : look.hatColor;
  switch (look.hat) {
    case 'cap':
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.arc(hx, hy - r * 0.2, r * 1.04, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(hx - r * 1.04, hy - r * 0.32, r * 2.08, r * 0.14);
      ctx.fillStyle = burnt ? '#1c1917' : look.brim;
      ctx.beginPath(); ctx.roundRect(f > 0 ? hx + r * 0.3 : hx - r * 1.55, hy - r * 0.32, r * 1.25, r * 0.22, r * 0.1); ctx.fill();
      ctx.fillStyle = burnt ? '#1c1917' : look.dot;
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.22, r * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    case 'helmet': // casco de obra con ala alrededor
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.arc(hx, hy - r * 0.15, r * 1.08, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(hx - r * 1.35, hy - r * 0.25, r * 2.7, r * 0.2, r * 0.1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(hx - r * 0.1, hy - r * 1.2, r * 0.2, r * 0.95);
      break;
    case 'beanie': // gorro de lana con pompón
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.arc(hx, hy - r * 0.15, r * 1.06, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.brim; ctx.fillRect(hx - r * 1.06, hy - r * 0.32, r * 2.12, r * 0.3);
      ctx.fillStyle = look.dot; ctx.beginPath(); ctx.arc(hx, hy - r * 1.28, r * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'short': case 'long': case 'bun':
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(hx - f * r * 0.06, hy - r * 0.12, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + f * r * 0.35, hy - r * 0.55, r * 0.55, r * 0.32, f * 0.4, 0, Math.PI * 2); ctx.fill(); // flequillo
      if (look.hat === 'bun') { ctx.beginPath(); ctx.arc(hx - f * r * 0.55, hy - r * 1.05, r * 0.42, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'bald':
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(hx + f * r * 0.2, hy - r * 0.55, r * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
  }
  arm(f, swing); // el brazo de adelante va delante del cuerpo
}
