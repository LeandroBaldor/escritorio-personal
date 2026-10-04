// Camisetas de Tiki-Taka, inspiradas en los colores de cada selección (dibujos propios, sin escudos
// ni marcas). Se usan para los jugadores vistos desde arriba y para elegir el país antes del partido.
export type KitPattern = 'solid' | 'stripes' | 'checks' | 'sash';
export interface Kit { id: string; name: string; base: string; second?: string; pattern: KitPattern; trim: string }

export const KITS: Kit[] = [
  { id: 'arg', name: 'Argentina', base: '#75aadb', second: '#ffffff', pattern: 'stripes', trim: '#ffffff' },
  { id: 'bra', name: 'Brasil', base: '#ffdf00', pattern: 'solid', trim: '#009b3a' },
  { id: 'uru', name: 'Uruguay', base: '#5cbfeb', pattern: 'solid', trim: '#ffffff' },
  { id: 'ale', name: 'Alemania', base: '#f5f5f5', pattern: 'solid', trim: '#111111' },
  { id: 'esp', name: 'España', base: '#c60b1e', pattern: 'solid', trim: '#ffc400' },
  { id: 'fra', name: 'Francia', base: '#1f2a5c', pattern: 'solid', trim: '#ffffff' },
  { id: 'ita', name: 'Italia', base: '#1f5fbf', pattern: 'solid', trim: '#ffffff' },
  { id: 'ing', name: 'Inglaterra', base: '#f5f5f5', pattern: 'solid', trim: '#1f2a5c' },
  { id: 'por', name: 'Portugal', base: '#a50f1d', pattern: 'solid', trim: '#046a38' },
  { id: 'hol', name: 'Países Bajos', base: '#f36c21', pattern: 'solid', trim: '#111111' },
  { id: 'mex', name: 'México', base: '#006847', pattern: 'solid', trim: '#ffffff' },
  { id: 'col', name: 'Colombia', base: '#fcd116', pattern: 'solid', trim: '#003893' },
  { id: 'chi', name: 'Chile', base: '#d52b1e', pattern: 'solid', trim: '#0039a6' },
  { id: 'cro', name: 'Croacia', base: '#ffffff', second: '#d52b1e', pattern: 'checks', trim: '#d52b1e' },
  { id: 'per', name: 'Perú', base: '#ffffff', second: '#d91023', pattern: 'sash', trim: '#d91023' },
  { id: 'jap', name: 'Japón', base: '#1b2c80', pattern: 'solid', trim: '#ffffff' },
  { id: 'bel', name: 'Bélgica', base: '#c8102e', pattern: 'solid', trim: '#111111' },
  { id: 'usa', name: 'Estados Unidos', base: '#ffffff', pattern: 'solid', trim: '#0a3161' },
];

export const kitById = (id: string) => KITS.find(k => k.id === id) ?? KITS[0];

const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const distance = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

// El rival usa una camiseta que se distinga bien de la tuya.
export function rivalKit(mine: Kit, rand: () => number = Math.random) {
  const options = KITS.filter(k => k.id !== mine.id && distance(k.base, mine.base) > 170);
  return options[Math.floor(rand() * options.length)] ?? KITS.find(k => k.id !== mine.id)!;
}

// Pinta la tela de la camiseta dentro de un recorte ya hecho, centrado en 0,0: w es de adelante hacia
// atrás y h de hombro a hombro. Las rayas verticales de la camiseta se ven, desde arriba, como
// franjas que van de adelante hacia atrás.
export function paintKit(ctx: CanvasRenderingContext2D, kit: Kit, w: number, h: number) {
  ctx.fillStyle = kit.base;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  if (!kit.second) return;
  ctx.fillStyle = kit.second;
  if (kit.pattern === 'stripes') {
    const band = h / 7;
    for (let i = 0; i < 7; i += 2) ctx.fillRect(-w / 2, -h / 2 + i * band + band / 2, w, band);
  } else if (kit.pattern === 'checks') {
    const cell = Math.min(w, h) / 3;
    for (let x = -w / 2, cx = 0; x < w / 2; x += cell, cx++) for (let y = -h / 2, cy = 0; y < h / 2; y += cell, cy++) if ((cx + cy) % 2) ctx.fillRect(x, y, cell, cell);
  } else if (kit.pattern === 'sash') {
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 - h * 0.1); ctx.lineTo(-w / 2 + w * 0.35, -h / 2 - h * 0.1); ctx.lineTo(w / 2, h / 2 + h * 0.1); ctx.lineTo(w / 2 - w * 0.35, h / 2 + h * 0.1); ctx.closePath(); ctx.fill();
  }
}
