// Cartas del "Solitario 8 bits" dibujadas píxel por píxel. Cada carta se arma como un SVG
// (números con letra pixelada, palos y figuras en mapas de píxeles) y se guarda como imagen
// para no volver a dibujarla.
import type { Suit } from './solitaire';

type Bitmap = string[];
export const RED = '#d62828';
export const BLACK = '#1d1d24';
const isRedSuit = (suit: Suit) => suit === 'corazon' || suit === 'diamante';
export const suitColor = (suit: Suit) => isRedSuit(suit) ? RED : BLACK;

export const SUIT_PIXELS: Record<Suit, Bitmap> = {
  corazon: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  diamante: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  pica: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.X.X.X.', '..XXX..'],
  trebol: ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXXXXX', 'XX.X.XX', '...X...', '..XXX..'],
};

// Letra pixelada de 5×7 (el 10 ocupa 7 de ancho).
const GLYPHS: Record<string, Bitmap> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  2: ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  3: ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  4: ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  5: ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  6: ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  7: ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  8: ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  9: ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  10: ['.X..XX.', 'XX.X..X', '.X.X..X', '.X.X..X', '.X.X..X', '.X.X..X', 'XXX.XX.'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
};
const LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Figuras de 14×18. Y oro, R rojo, O ojos/contorno, S piel, B barba, H pelo, W blanco, C ropa (color del palo).
const FACES: Record<number, Bitmap> = {
  13: [
    'Y..Y..YY..Y..Y', 'YY.YY.YY.YY.YY', 'YYYYYYYYYYYYYY', 'YRYYYRYYRYYYRY', 'YYYYYYYYYYYYYY',
    '.BSSSSSSSSSSB.', '.BSSOSSSSOSSB.', '.BSSSSSSSSSSB.', '.BSSSSSSSSSSB.', '.BBSSSSSSSSBB.',
    '.BBBBSOOSBBBB.', '..BBBBBBBBBB..', '...BBBBBBBB...', 'CCCCCBBBBCCCCC', 'CCCCCCWWCCCCCC',
    'CCCCCCWWCCCCCC', 'CCYCCCWWCCCYCC', 'CCCCCCWWCCCCCC',
  ],
  12: [
    '....Y.YY.Y....', '...YYYYYYYY...', '...YRYYYYRY...', '..HHHHHHHHHH..', '.HHSSSSSSSSHH.',
    '.HSSOSSSSOSSH.', '.HSSSSSSSSSSH.', '.HSSSSSSSSSSH.', '.HSSSRRRRSSSH.', '.HHSSSSSSSSHH.',
    'HHH.SSSSSS.HHH', 'HHH..SSSS..HHH', 'HH.CCCCCCCC.HH', 'HCCCCCWWCCCCCH', 'CCCCCWYYWCCCCC',
    'CCCCCCWWCCCCCC', 'CCCCCCCCCCCCCC', 'CCCCCCCCCCCCCC',
  ],
  11: [
    '..........WW..', '.........WW...', '...CCCCCCCW...', '..CCCCCCCCCC..', '.YYYYYYYYYYYY.',
    '..HSSSSSSSSH..', '..HSOSSSSOSH..', '..HSSSSSSSSH..', '..HSSSSSSSSH..', '..HSSSOOSSSH..',
    '..HHSSSSSSHH..', '...HHSSSSHH...', '....WWWWWW....', 'CCCCWYYYYWCCCC', 'CCCCCWYYWCCCCC',
    'CCCCCCWWCCCCCC', 'CCYCCCCCCCCYCC', 'CCCCCCCCCCCCCC',
  ],
};

// Arma los rectángulos de un mapa de píxeles (juntando los píxeles seguidos de una fila).
function pixels(map: Bitmap, palette: Record<string, string>, x: number, y: number, scale = 1, flip = false) {
  let out = '';
  const rows = flip ? [...map].reverse() : map;
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      let end = c;
      while (end + 1 < row.length && row[end + 1] === ch) end++;
      if (palette[ch]) out += `<rect x="${x + c * scale}" y="${y + r * scale}" width="${(end - c + 1) * scale}" height="${scale}" fill="${palette[ch]}"/>`;
      c = end + 1;
    }
  });
  return out;
}

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

export const CARD_W = 49, CARD_H = 67;
const svg = (body: string, w = CARD_W, h = CARD_H) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`)}`;

// Borde pixelado con las esquinas en escalón.
const frame = (fill: string, line: string) =>
  `<rect x="2" y="0" width="${CARD_W - 4}" height="${CARD_H}" fill="${line}"/><rect x="0" y="2" width="${CARD_W}" height="${CARD_H - 4}" fill="${line}"/><rect x="1" y="1" width="${CARD_W - 2}" height="${CARD_H - 2}" fill="${line}"/>` +
  `<rect x="2" y="1" width="${CARD_W - 4}" height="${CARD_H - 2}" fill="${fill}"/><rect x="1" y="2" width="${CARD_W - 2}" height="${CARD_H - 4}" fill="${fill}"/>`;

const cache = new Map<string, string>();

export function cardImage(suit: Suit, rank: number) {
  const key = `${suit}-${rank}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ink = suitColor(suit);
  const color = { X: ink };
  const label = LABELS[rank];
  const corner = pixels(GLYPHS[label], color, 3, 3) + pixels(SUIT_PIXELS[suit], color, 2, 12);
  let body = frame('#fffdf5', '#1d1d24') + corner + `<g transform="rotate(180 ${CARD_W / 2} ${CARD_H / 2})">${corner}</g>`;
  if (rank === 1) body += pixels(SUIT_PIXELS[suit], color, 14, 23, 3);
  else if (rank <= 10) {
    for (const [col, row] of PIPS[rank]) body += pixels(SUIT_PIXELS[suit], color, [13, 21, 29][col], 12 + row * 6, 1, row > 3);
  } else {
    const palette = { Y: '#f4b400', R: RED, O: '#1d1d24', S: '#f5c9a0', B: '#8a4b14', H: rank === 12 ? '#f4b400' : '#6b3a10', W: '#ffffff', C: isRedSuit(suit) ? RED : '#2b3a8f' };
    body += `<rect x="9" y="13" width="31" height="41" fill="${ink}"/><rect x="10" y="14" width="29" height="39" fill="#fdf2c4"/>`;
    body += `<g transform="translate(10.5 15.5) scale(2)">${pixels(FACES[rank], palette, 0, 0)}</g>`;
  }
  const url = svg(body);
  cache.set(key, url);
  return url;
}

// Dorso: rombos azules pixelados con borde blanco y un corazón al medio.
export const BACK_IMAGE = (() => {
  let body = frame('#1e40af', '#0b1a4a') + `<rect x="3" y="3" width="${CARD_W - 6}" height="${CARD_H - 6}" fill="#ffffff"/><rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" fill="#2563eb"/>`;
  for (let y = 5; y < CARD_H - 6; y += 4) for (let x = 5 + ((y - 5) / 4 % 2) * 2; x < CARD_W - 6; x += 4) body += `<rect x="${x}" y="${y}" width="2" height="2" fill="#60a5fa"/>`;
  body += `<rect x="16" y="25" width="17" height="17" fill="#1e40af"/>` + pixels(SUIT_PIXELS.corazon, { X: '#facc15' }, 17, 26, 2) ;
  return svg(body);
})();
