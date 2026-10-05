// Cartas del "Solitario 3.000": cartas futuristas de vidrio oscuro con bordes y símbolos de neón
// (rosa para corazones y diamantes, celeste para picas y tréboles), circuitos en los costados y
// figuras de androides (rey con corona, reina con tiara y jota con antena). Cada carta se arma como un
// SVG y se guarda como imagen para no volver a dibujarla.
import type { Suit } from './solitaire';

const isRedSuit = (suit: Suit) => suit === 'corazon' || suit === 'diamante';
export const NEON_RED = '#ff3d81';
export const NEON_BLUE = '#2de2ff';
export const suitColor = (suit: Suit) => isRedSuit(suit) ? NEON_RED : NEON_BLUE;

// Palos dibujados en una caja de 10×10.
export const SUIT_PATHS: Record<Suit, string> = {
  corazon: 'M5 9.4C1.2 6.3 0 4.3 0 2.9 0 1.3 1.2 0 2.7 0 3.7 0 4.5.6 5 1.5 5.5.6 6.3 0 7.3 0 8.8 0 10 1.3 10 2.9 10 4.3 8.8 6.3 5 9.4Z',
  diamante: 'M5 0 9 5 5 10 1 5Z',
  pica: 'M5 0C6 2.1 10 4 10 6.3 10 7.8 8.8 8.8 7.5 8.8 6.6 8.8 5.9 8.4 5.5 7.8L6.3 10H3.7L4.5 7.8C4.1 8.4 3.4 8.8 2.5 8.8 1.2 8.8 0 7.8 0 6.3 0 4 4 2.1 5 0Z',
  trebol: 'M5 0A2.3 2.3 0 1 1 5 4.6 2.3 2.3 0 1 1 5 0ZM2.4 3.7A2.3 2.3 0 1 1 2.4 8.3 2.3 2.3 0 1 1 2.4 3.7ZM7.6 3.7A2.3 2.3 0 1 1 7.6 8.3 2.3 2.3 0 1 1 7.6 3.7ZM4.3 6H5.7L6.4 10H3.6Z',
};

const LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// Posición de los símbolos en cada número: columna (0 izquierda, 1 medio, 2 derecha) y fila (0 a 6).
const PIPS: Record<number, [number, number][]> = {
  2: [[1, 0], [1, 6]],
  3: [[1, 0], [1, 3], [1, 6]],
  4: [[0, 0], [2, 0], [0, 6], [2, 6]],
  5: [[0, 0], [2, 0], [1, 3], [0, 6], [2, 6]],
  6: [[0, 0], [2, 0], [0, 3], [2, 3], [0, 6], [2, 6]],
  7: [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [0, 6], [2, 6]],
  8: [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [1, 4.5], [0, 6], [2, 6]],
  9: [[0, 0], [2, 0], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4], [0, 6], [2, 6]],
  10: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4], [1, 5], [0, 6], [2, 6]],
};

export const CARD_W = 61, CARD_H = 83;
const FONT = `font-family="Verdana, 'Segoe UI', Arial, sans-serif" font-weight="900"`;
const svg = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}">${body}</svg>`)}`;

const defs = (neon: string) => `<defs>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14224a"/><stop offset=".55" stop-color="#0a1230"/><stop offset="1" stop-color="#050a1c"/></linearGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="halo"><stop offset="0" stop-color="${neon}" stop-opacity=".35"/><stop offset="1" stop-color="${neon}" stop-opacity="0"/></radialGradient>
</defs>`;

// Cuerpo de vidrio con borde de neón, un brillo en diagonal y circuitos en los costados.
const body = (neon: string) =>
  `<rect x=".8" y=".8" width="${CARD_W - 1.6}" height="${CARD_H - 1.6}" rx="5" fill="url(#glass)" stroke="${neon}" stroke-width="1.4" filter="url(#glow)"/>` +
  `<rect x="2.6" y="2.6" width="${CARD_W - 5.2}" height="${CARD_H - 5.2}" rx="3.6" fill="none" stroke="${neon}" stroke-opacity=".25" stroke-width=".5"/>` +
  `<path d="M3 3H24L3 30Z" fill="#ffffff" fill-opacity=".05"/>` +
  `<g fill="none" stroke="${neon}" stroke-opacity=".35" stroke-width=".55"><path d="M3 30H7L9.5 32.5V50.5L7 53H3"/><path d="M58 30H54L51.5 32.5V50.5L54 53H58"/><path d="M9.5 41.5H12"/><path d="M51.5 41.5H49"/></g>` +
  `<g fill="${neon}" fill-opacity=".6"><circle cx="12.6" cy="41.5" r=".8"/><circle cx="48.4" cy="41.5" r=".8"/><circle cx="7" cy="30" r=".6"/><circle cx="54" cy="53" r=".6"/></g>`;

const suit = (s: Suit, cx: number, cy: number, size: number, neon: string, flip = false) =>
  `<path d="${SUIT_PATHS[s]}" fill="${neon}" filter="url(#glow)" transform="translate(${cx} ${cy}) ${flip ? 'rotate(180) ' : ''}scale(${size / 10}) translate(-5 -5)"/>`;

// Figura de androide para J, Q y K (dibujo de líneas de neón).
function android(rank: number, neon: string) {
  const c = 30.5;
  let out = `<rect x="12" y="16" width="37" height="51" rx="3" fill="${neon}" fill-opacity=".07" stroke="${neon}" stroke-opacity=".7" stroke-width=".8"/>`;
  out += `<circle cx="${c}" cy="40" r="15" fill="url(#halo)"/>`;
  out += `<path d="M18 64Q18 52 ${c} 52Q43 52 43 64" fill="${neon}" fill-opacity=".18" stroke="${neon}" stroke-width="1"/>`;
  out += `<path d="M${c - 4} 52V49H${c + 4}V52" fill="none" stroke="${neon}" stroke-width=".9"/>`;
  out += `<circle cx="${c}" cy="40" r="8.6" fill="#0b1530" stroke="${neon}" stroke-width="1.1"/>`;
  out += `<rect x="${c - 7}" y="37.4" width="14" height="3.8" rx="1.9" fill="${neon}" filter="url(#glow)"/>`;
  out += `<path d="M${c - 3} 45.5H${c + 3}" stroke="${neon}" stroke-width=".9" stroke-linecap="round"/>`;
  if (rank === 13) out += `<path d="M${c - 8.5} 32.5L${c - 6.5} 25.5L${c - 3} 29.5L${c} 23.5L${c + 3} 29.5L${c + 6.5} 25.5L${c + 8.5} 32.5Z" fill="${neon}" fill-opacity=".35" stroke="${neon}" stroke-width=".9" stroke-linejoin="round" filter="url(#glow)"/>`;
  if (rank === 12) out += `<path d="M${c - 8.5} 33Q${c} 25 ${c + 8.5} 33" fill="none" stroke="${neon}" stroke-width="1.1" filter="url(#glow)"/><circle cx="${c}" cy="27.6" r="1.8" fill="${neon}" filter="url(#glow)"/>`;
  if (rank === 11) out += `<path d="M${c} 31.4V24.5" stroke="${neon}" stroke-width="1"/><circle cx="${c}" cy="23.5" r="1.6" fill="${neon}" filter="url(#glow)"/><path d="M${c - 9.6} 37V43M${c + 9.6} 37V43" stroke="${neon}" stroke-width="1.6" stroke-linecap="round"/>`;
  return out;
}

const cache = new Map<string, string>();

export function cardImage(s: Suit, rank: number) {
  const key = `${s}-${rank}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const neon = suitColor(s);
  const label = LABELS[rank];
  const corner = `<text x="${label === '10' ? 3.6 : 5}" y="13.4" ${FONT} font-size="${label === '10' ? 9.5 : 11}" letter-spacing="-.6" fill="${neon}" filter="url(#glow)">${label}</text>` + suit(s, 9, 20.5, 7, neon);
  let out = defs(neon) + body(neon) + corner + `<g transform="rotate(180 ${CARD_W / 2} ${CARD_H / 2})">${corner}</g>`;
  if (rank === 1) {
    out += `<circle cx="30.5" cy="41.5" r="16" fill="url(#halo)"/><circle cx="30.5" cy="41.5" r="14.5" fill="none" stroke="${neon}" stroke-opacity=".6" stroke-width=".8" stroke-dasharray="3 2"/>`;
    out += suit(s, 30.5, 41.5, 18, neon);
  } else if (rank <= 10) {
    for (const [col, row] of PIPS[rank]) out += suit(s, [21, 30.5, 40][col], 15 + row * 8.9, 8.2, neon, row > 3);
  } else out += android(rank, neon);
  const url = svg(out);
  cache.set(key, url);
  return url;
}

// Dorso: vidrio violeta con grilla hexagonal y el emblema "3000" en el medio.
export const BACK_IMAGE = (() => {
  const neon = '#a78bfa';
  let out = defs(neon).replace('#14224a', '#24124a').replace('#0a1230', '#140a33') + body(neon);
  let hex = '';
  for (let y = 6, r = 0; y < CARD_H - 4; y += 6, r++) for (let x = 6 + (r % 2) * 3.5; x < CARD_W - 4; x += 7) hex += `<path d="M${x} ${y - 2.5}L${x + 2.2} ${y - 1.25}V${y + 1.25}L${x} ${y + 2.5}L${x - 2.2} ${y + 1.25}V${y - 1.25}Z"/>`;
  out += `<g fill="none" stroke="${neon}" stroke-opacity=".22" stroke-width=".45">${hex}</g>`;
  out += `<circle cx="30.5" cy="41.5" r="15" fill="#0b0620" stroke="${neon}" stroke-width="1.2" filter="url(#glow)"/><circle cx="30.5" cy="41.5" r="11.5" fill="none" stroke="#2de2ff" stroke-opacity=".7" stroke-width=".6" stroke-dasharray="2 1.5"/>`;
  out += `<text x="30.5" y="44.6" text-anchor="middle" ${FONT} font-size="8.5" fill="#2de2ff" filter="url(#glow)">3000</text>`;
  return svg(out);
})();
