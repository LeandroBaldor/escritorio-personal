// Los 10 niveles de Vampyrium: el piso (tramos de suelo y huecos: algunos niveles no tienen ninguno y los demás
// tienen 1, 2 o 3, de anchos distintos), las plataformas colgadas con cadenas (algunas se
// mueven), las trampas de cada uno (todas distintas) y cómo se ve (fondo, piedra, qué hay en los pozos).
// Medidas en unidades del mundo (28 × 15,75), con el suelo en y = 3,2.
export type PitStyle = 'void' | 'acid' | 'lava' | 'bones' | 'fire' | 'blood' | 'grave';
export type TrapKind = 'spikes' | 'pendulum' | 'fire' | 'saw' | 'crusher' | 'jet' | 'roller' | 'drip';
// Estilos de cada trampa (solo cambia el dibujo):
//  pinches: iron (hierro), bone (hueso), thorn (espinas de rosa), hands (manos de muertos)
//  péndulo: axe (hacha), mace (bola con pinches), cage (jaula), scythe (guadaña)
//  fuego: brazier (brasero), acid (géiser de ácido), lava (géiser de lava), blood (fuente de sangre), hellfire (columna del infierno)
//  aplastador: spikeblock (bloque con pinches), cage (jaula que cae), chandelier (araña de velas), tomb (lápida), skullblock (bloque de calaveras)
//  chorro: wall (boca en la pared), gargoyle (gárgola que escupe fuego)
//  goteo: acid (gotas de ácido), skull (calaveras que caen), fireball (bolas de fuego)
export interface Trap {
  kind: TrapKind; style?: string;
  x: number; x2: number; y: number; // x..x2: dónde está (o el recorrido); y: el piso donde está apoyada
  period: number; offset: number;
  len: number; amp: number; // largo (péndulo, fuego, chorro) y amplitud (péndulo) o dirección (chorro: 1 derecha, -1 izquierda)
  top?: number; // aplastador y goteo: desde qué altura cae
}
export interface Move { dx: number; dy: number; period: number; phase?: number }
export interface Surface { x1: number; x2: number; y: number; ground: boolean; mv?: Move; bx1?: number; bx2?: number; by?: number; dx?: number }
export interface LevelDef {
  n: number; name: string; tagline: string; bg: string; crop: number;
  surfaces: Surface[]; gaps: [number, number][]; traps: Trap[];
  pit: PitStyle; stone: [number, number, number]; cap: string; speed: number;
}

const GY = 3.2, TOP = 16.3, TOPD = 25.4; // TOP: de dónde cuelgan los péndulos; TOPD: de dónde caen las gotas (arriba de todo)
const G = (x1: number, x2: number): Surface => ({ x1, x2, y: GY, ground: true });
const P = (x1: number, x2: number, y: number, mv?: Move): Surface => ({ x1, x2, y, ground: false, mv });
const T = (kind: TrapKind, style: string, x: number, x2: number, y: number, period: number, offset: number, len = 0, amp = 0, top?: number): Trap => ({ kind, style, x, x2, y, period, offset, len, amp, top });
const gapsOf = (s: Surface[]) => { const g = s.filter(q => q.ground).sort((a, b) => a.x1 - b.x1), out: [number, number][] = []; for (let i = 0; i + 1 < g.length; i++) if (g[i + 1].x1 > g[i].x2) out.push([g[i].x2, g[i + 1].x1]); return out; };
// Más lugares arriba para escalar: repisas altas a los costados (y = 12,8), solo donde se llega de un salto desde
// una plataforma de abajo (a 9-11 de alto y a menos de 2,6 de distancia) y no hay ya algo a esa altura.
function withHighLedges(surfaces: Surface[], traps: Trap[]): Surface[] {
  const out = [...surfaces];
  for (const [x1, x2] of [[1.8, 5.8], [0.8, 3.8], [5.6, 8.8], [8.2, 11.6], [17.2, 20.6], [22.2, 26.2], [20.6, 23.6], [24.8, 27.6]] as const) {
    const busy = out.some(q => !q.ground && q.y >= 11.6 && q.x1 < x2 + 1.2 && q.x2 > x1 - 1.2);
    const from = out.some(q => !q.ground && !q.mv && ((q.y >= 8.6 && q.y <= 11.4 && q.x1 < x2 + 2.6 && q.x2 > x1 - 2.6) || (q.y >= 12 && q.y <= 13.6 && q.x1 < x2 + 3.4 && q.x2 > x1 - 3.4)));
    const hit = traps.some(t => (t.kind === 'pendulum' || t.kind === 'crusher' || t.kind === 'drip') && t.x + Math.abs(t.amp) * (t.len || 1) > x1 - 0.6 && t.x - Math.abs(t.amp) * (t.len || 1) < x2 + 0.6); // (lejos de lo que cae o se balancea)
    if (!busy && from && !hit) out.push(P(x1, x2, 12.8));
  }
  return out;
}
// El escenario sigue para arriba (hasta y = 25,5): tres pisos más de plataformas (a 16,2, 19,4 y 22,6), distintas
// en cada nivel, solo donde se llega de un salto desde la de abajo y lejos de los péndulos, gotas y aplastadores;
// arriba también hay trampas: pinches (del estilo del nivel) y una sierra que recorre una plataforma.
const UP_TIERS = [16.2, 19.4, 22.6];
const SPIKE_STYLE: Record<number, string> = { 6: 'bone', 8: 'thorn', 9: 'hands' };
function withUpperFloors(n: number, surfaces: Surface[], traps: Trap[]): [Surface[], Trap[]] {
  const out = [...surfaces], added: Surface[] = [];
  const blocked = (x1: number, x2: number) => traps.some(t => (t.kind === 'pendulum' && t.x > x1 - 1.8 && t.x < x2 + 1.8) || (t.kind === 'drip' && t.x > x1 - 0.9 && t.x < x2 + 0.9) || (t.kind === 'crusher' && t.x > x1 - 1.3 && t.x < x2 + 1.3));
  let moving = n % 2 === 0;
  UP_TIERS.forEach((y, ti) => {
    for (let x = 0.6 + (n * 3.7 + ti * 5.3) % 4.4, i = 0; x < 25.6; i++) {
      const w = 3 + ((n * 7 + ti * 3 + i * 5) % 4) * 0.5, x1 = x, x2 = Math.min(27.4, x + w);
      const reach = out.some(q => !q.ground && q.y < y - 1.2 && q.y >= y - 3.7 && q.x1 < x2 + 2.3 && q.x2 > x1 - 2.3);
      if (reach && !blocked(x1, x2) && x2 - x1 > 2.4) {
        const mv = moving && ti === 1 ? { dx: 1.5, dy: 0, period: 6.5, phase: n } : undefined; if (mv) moving = false;
        const q = P(x1, x2, y, mv); out.push(q); if (!mv) added.push(q);
      }
      x = x2 + 2.1 + ((n + ti + i) % 3) * 1.2;
    }
  });
  const extra: Trap[] = [];
  const a = added[(n * 3) % Math.max(1, added.length)], b = added[(n * 3 + 2) % Math.max(1, added.length)];
  if (a) { const m = (a.x1 + a.x2) / 2; extra.push(T('spikes', SPIKE_STYLE[n] ?? 'iron', m - 0.8, m + 0.8, a.y, 3.2 + (n % 3) * 0.3, n * 0.37)); }
  if (b && b !== a && b.x2 - b.x1 > 3) extra.push(T('saw', 'iron', b.x1 + 0.5, b.x2 - 0.5, b.y, 3.4 + (n % 2) * 0.6, n * 0.5));
  return [out, [...traps, ...extra]];
}
function level(n: number, name: string, tagline: string, bg: string, surfaces: Surface[], traps: Trap[], look: { pit: PitStyle; stone: [number, number, number]; cap: string; crop?: number; speed?: number }): LevelDef {
  surfaces = withHighLedges(surfaces, traps);
  [surfaces, traps] = withUpperFloors(n, surfaces, traps);
  return { n, name, tagline, bg, crop: look.crop ?? 0.74, surfaces, gaps: gapsOf(surfaces), traps, pit: look.pit, stone: look.stone, cap: look.cap, speed: look.speed ?? 1 + (n - 1) * 0.04 };
}

export const LEVELS: LevelDef[] = [
  level(1, 'El puente de las ánimas', 'La luna llena se asoma sobre el castillo de Drácula y el puente está tomado por sus siervos.', 'fondo-nivel-1',
    [G(0, 8), G(10.6, 28), P(2, 6.2, 6.6), P(11.2, 16.8, 6.6), P(22.4, 26.2, 6.6), P(6.6, 10.8, 9.9), P(17, 21.6, 9.9), P(11.6, 16.4, 13)],
    [T('spikes', 'iron', 13.2, 14.8, GY, 3.4, 0), T('pendulum', 'axe', 14, 14, TOP, 3.9, 0.4, 8, 0.8), T('fire', 'brazier', 23.6, 23.6, GY, 4.6, 1.7, 4.2)],
    { pit: 'void', stone: [44, 40, 48], cap: '#8a6a52', speed: 1 }),
  level(2, 'Las cloacas', 'Debajo del castillo corre un río de ácido verde. Del techo gotea veneno y el agua escupe chorros que queman.', 'fondo-nivel-2',
    [G(0, 6.6), G(8, 14.8), G(17.6, 21.6), G(23.4, 28), P(1.5, 5.5, 6.6), P(10, 14, 6.6), P(16, 20.5, 6.8, { dx: 0, dy: 1.3, period: 5 }), P(4.5, 8.5, 9.9), P(19.6, 24, 10.2), P(11.2, 15.8, 13), P(23.4, 26.4, 6.6)],
    [T('drip', 'acid', 5.8, 5.8, GY, 2.6, 0, 0, 0, TOPD), T('drip', 'acid', 12.6, 12.6, GY, 3.1, 1.2, 0, 0, TOPD), T('drip', 'acid', 20.2, 20.2, GY, 2.3, 0.6, 0, 0, TOPD),
      T('fire', 'acid', 16.2, 16.2, 0.6, 5, 2.5, 6.4), T('fire', 'acid', 7.3, 7.3, 0.6, 5.6, 0.4, 5.8), T('spikes', 'iron', 24.4, 25.8, GY, 3.2, 1.1)],
    { pit: 'acid', stone: [40, 52, 42], cap: '#5f7a4a' }),
  level(3, 'La fragua de las jaulas', 'Un río de lava cruza la fragua. Las sierras no paran de girar y las jaulas caen sobre los distraídos.', 'fondo-nivel-3',
    [G(0, 6.6), G(8.7, 21.4), G(23, 28), P(1.6, 5.4, 6.6), P(9.4, 13.4, 6.6), P(16.6, 20.6, 6.6), P(5.2, 9.6, 9.9, { dx: 1.6, dy: 0, period: 6 }), P(17.8, 22.4, 9.9), P(11, 15.8, 13), P(23.6, 26.4, 6.6)],
    [T('saw', 'iron', 9.6, 13.2, GY, 3.6, 0), T('saw', 'iron', 17.1, 20.1, 6.6, 3, 1.4), T('crusher', 'cage', 19.2, 19.2, GY, 4.6, 0.5, 0.75, 0, 11.4), T('crusher', 'cage', 3.4, 3.4, 6.6, 5.2, 2.6, 0.7, 0, 12.6),
      T('fire', 'lava', 7.65, 7.65, 0.6, 4.4, 1, 6.6), T('fire', 'lava', 22.2, 22.2, 0.6, 4.8, 3.1, 6.6)],
    { pit: 'lava', stone: [58, 38, 30], cap: '#b8542a' }),
  level(4, 'La catedral profanada', 'Los vitrales brillan con la luna. Las arañas de velas se descuelgan y las bocas de la pared escupen fuego.', 'fondo-nivel-4',
    [G(0, 28), P(1.5, 6, 6.6), P(8, 12.6, 6.6), P(15.2, 19.6, 6.6, { dx: 2, dy: 0, period: 7 }), P(21.8, 26.2, 6.6), P(4.4, 9, 9.9), P(11.6, 16.4, 10.2), P(18.6, 23, 9.9), P(8.6, 12.8, 13.2)],
    [T('crusher', 'chandelier', 10.4, 10.4, GY, 5, 0, 0.9, 0, 11.6), T('crusher', 'chandelier', 18.4, 18.4, GY, 5.4, 2.4, 0.9, 0, 12.8), T('pendulum', 'axe', 14, 14, TOP, 4.2, 1, 7, 0.75),
      T('jet', 'wall', 26.2, 26.2, 6.6, 4.4, 0.8, 4.2, -1), T('jet', 'wall', 1.5, 1.5, 6.6, 4.8, 2.6, 4.2, 1)],
    { pit: 'void', stone: [48, 42, 60], cap: '#7c6a8c' }),
  level(5, 'La cámara de los pinches', 'Nadie salió vivo de esta sala: el piso escupe pinches, las bolas de hierro barren el aire y un rodillo lo aplasta todo.', 'fondo-nivel-5',
    [G(0, 28), P(1.8, 6.4, 6.6), P(9.4, 14, 6.8), P(16.6, 21.2, 6.6), P(22.6, 26.4, 9.9), P(4.6, 9.2, 10), P(12.6, 17.4, 11.2), P(18.6, 22.2, 13.4)],
    [T('spikes', 'iron', 3.8, 5.6, GY, 3, 0), T('spikes', 'iron', 13.2, 15, GY, 3, 1), T('spikes', 'iron', 19.6, 21.4, GY, 3, 2), T('spikes', 'iron', 10.2, 12, 6.8, 3.6, 1.6),
      T('pendulum', 'mace', 8, 8, TOP, 3.4, 0, 7.6, 0.9), T('pendulum', 'mace', 19.8, 19.8, TOP, 3.8, 1.5, 7.2, 0.85), T('roller', 'spiked', 12.6, 25.2, GY, 7, 0)],
    { pit: 'void', stone: [56, 40, 42], cap: '#8a5a52' }),
  level(6, 'El osario', 'Miles de huesos forman las paredes. Las calaveras caen del techo y los pozos están llenos de lanzas de hueso.', 'fondo-nivel-6',
    [G(0, 7.4), G(8.6, 17.4), G(20.2, 28), P(1.6, 5.8, 6.6), P(10.8, 16.2, 6.6), P(21.6, 26, 6.6), P(6, 10.4, 9.9, { dx: 0, dy: 1.1, period: 4.6 }), P(17, 21.8, 9.9), P(11, 16, 13)],
    [T('spikes', 'bone', 12.4, 14.4, 6.6, 3.3, 0.8), T('spikes', 'bone', 22.2, 23.8, GY, 3, 2), T('drip', 'skull', 4.8, 4.8, GY, 3.2, 0, 0, 0, TOPD), T('drip', 'skull', 14.6, 14.6, GY, 2.8, 1.4, 0, 0, TOPD),
      T('drip', 'skull', 24.6, 24.6, GY, 3.6, 2.2, 0, 0, TOPD), T('pendulum', 'cage', 19.2, 19.2, TOP, 4.4, 0.6, 6.4, 0.7)],
    { pit: 'bones', stone: [92, 80, 62], cap: '#d6c39a' }),
  level(7, 'Las puertas del infierno', 'El castillo arde. De los pozos salen columnas de fuego, llueven bolas de fuego y una araña de pinches espera.', 'fondo-nivel-7',
    [G(0, 7.9), G(9.6, 13.4), G(16.2, 20.2), G(21.4, 28), P(1.6, 5.6, 6.6), P(8.6, 12.8, 6.6), P(15.4, 20.2, 6.6, { dx: 1.4, dy: 0, period: 5.5 }), P(22.4, 26.4, 6.6), P(4.4, 9, 9.9), P(18.6, 23.2, 9.9), P(11, 16.4, 12.8)],
    [T('fire', 'hellfire', 8.75, 8.75, 0.6, 3.8, 0, 7.2), T('fire', 'hellfire', 14.8, 14.8, 0.6, 3.8, 1.3, 7.2), T('fire', 'hellfire', 20.8, 20.8, 0.6, 3.8, 2.5, 7.2),
      T('drip', 'fireball', 3.6, 3.6, GY, 2.4, 0.3, 0, 0, TOPD), T('drip', 'fireball', 11.8, 11.8, GY, 2.9, 1.6, 0, 0, TOPD), T('drip', 'fireball', 24.8, 24.8, GY, 2.6, 0.9, 0, 0, TOPD),
      T('crusher', 'spikeblock', 17.8, 17.8, GY, 4.6, 1.2, 0.9, 0, 12.2)],
    { pit: 'fire', stone: [64, 34, 26], cap: '#c2552a' }),
  level(8, 'El jardín de la luna roja', 'Entre las rosas del jardín corre una fuente de sangre. Las espinas brotan del piso y las gárgolas escupen fuego.', 'fondo-nivel-8',
    [G(0, 12.4), G(14.6, 28), P(1.6, 6, 9.9), P(7, 11.4, 6.6, { dx: 1.8, dy: 0, period: 6.5 }), P(15.4, 19.8, 6.6), P(20.8, 25.4, 9.9), P(11.2, 16, 12.4, { dx: 2.2, dy: 0, period: 8, phase: 2 }), P(22.8, 26.4, 5.6)],
    [T('spikes', 'thorn', 5.4, 7.4, GY, 3.2, 0), T('spikes', 'thorn', 19.4, 21.4, GY, 3.2, 1.6), T('fire', 'blood', 13.5, 13.5, 0.6, 4.4, 1, 7),
      T('jet', 'gargoyle', 1.6, 1.6, 9.9, 4.6, 0.5, 4.6, 1), T('jet', 'gargoyle', 19.8, 19.8, 6.6, 4.2, 2.6, 4.2, -1)],
    { pit: 'blood', stone: [82, 74, 76], cap: '#b9a7a2', crop: 0.8 }),
  level(9, 'El cementerio', 'Las tumbas están abiertas. Las manos de los muertos salen de la tierra y una guadaña corta la niebla.', 'fondo-nivel-9',
    [G(0, 28), P(1.6, 5.8, 6.6), P(7.6, 12, 9.9), P(13, 17.6, 6.6, { dx: 0, dy: 1.4, period: 5.2 }), P(17.8, 22.2, 10.4), P(22.8, 26.4, 6.6), P(11.4, 16, 13.4)],
    [T('spikes', 'hands', 3.8, 5.4, GY, 3.4, 0), T('spikes', 'hands', 14.4, 16, GY, 3.4, 1.2), T('spikes', 'hands', 23.8, 25.2, GY, 3.4, 2.3),
      T('pendulum', 'scythe', 11.2, 11.2, TOP, 4, 0.4, 7.6, 0.85), T('crusher', 'tomb', 18.6, 18.6, GY, 5, 2, 0.75, 0, 11.8)],
    { pit: 'grave', stone: [50, 50, 54], cap: '#6e6a66', crop: 0.8 }),
  level(10, 'El salón del trono', 'Drácula te espera en su trono. Su guardia es la peor: arañas de velas, hachas, sierras, fuego y una fuente de sangre.', 'fondo-nivel-10',
    [G(0, 12.4), G(15.6, 28), P(1.6, 6, 6.6), P(7.4, 11.8, 9.9), P(10.8, 17.2, 6.6, { dx: 0, dy: 1.2, period: 4.8 }), P(16.2, 20.6, 9.9), P(21.4, 26.2, 6.6), P(11.8, 16.2, 13.2)],
    [T('crusher', 'chandelier', 4, 4, GY, 5.2, 0, 0.9, 0, 12.2), T('crusher', 'chandelier', 23.6, 23.6, GY, 5.2, 2.6, 0.9, 0, 12.2), T('pendulum', 'axe', 14, 14, TOP, 3.6, 0.8, 8.2, 0.8),
      T('saw', 'iron', 16.4, 21.4, GY, 3.8, 1), T('fire', 'blood', 14, 14, 0.6, 4.6, 2, 7.2), T('jet', 'gargoyle', 7.4, 7.4, 9.9, 4.4, 1.8, 4.4, 1)],
    { pit: 'blood', stone: [52, 40, 44], cap: '#8a5050' }),
];
export const LEVEL_COUNT = LEVELS.length;

// ---------------------------------------------------------------- La meta de cada nivel y el viaje del héroe
// No siempre hay que matar 50 vampiros: cada parte del castillo pide otra cosa para abrir la puerta al siguiente.
//  kill: matar n vampiros · collect: juntar n cosas que caen del cielo · break: romper n jaulas o ataúdes
//  survive: aguantar vivo n segundos · hunt: matar n de un tipo de vampiro · boss: vencer a Drácula
export type Goal =
  | { type: 'kill'; n: number }
  | { type: 'collect'; n: number; item: 'star' | 'soul' }
  | { type: 'break'; n: number; obj: 'cage' | 'coffin' }
  | { type: 'survive'; n: number }
  | { type: 'hunt'; n: number; kind: 'warrior' | 'flyer' }
  | { type: 'boss'; n: number };
export interface Chapter { stage: string; story: string; goal: Goal; goalText: string }
export const CHAPTERS: Record<number, Chapter> = {
  1: { stage: 'La llamada a la aventura', goal: { type: 'kill', n: 50 },
    story: 'Tras perder a su familia por culpa de Drácula, Demian se volvió un cazador de vampiros. Una noche de luna llena, el aullido del castillo lo llama: es hora de cobrar venganza. Pero el puente de las ánimas está tomado por los siervos del conde.',
    goalText: 'Matá a 50 vampiros para que la reja del castillo se abra.' },
  2: { stage: 'El cruce del umbral', goal: { type: 'collect', n: 20, item: 'star' },
    story: 'Demian baja a las cloacas, donde ningún cazador volvió a salir. Por las rejillas del techo caen estrellas doradas: son las cuentas del rosario de su madre, que Drácula arrancó y tiró al río de ácido. Con ellas podrá abrir la compuerta.',
    goalText: 'Juntá 20 estrellas doradas que caen del cielo para abrir la compuerta.' },
  3: { stage: 'Los aliados', goal: { type: 'break', n: 6, obj: 'cage' },
    story: 'En la fragua hay prisioneros encerrados en jaulas, esperando ser el próximo banquete del conde. Demian no puede seguir solo: si los libera, ellos le van a mostrar el pasaje secreto hacia la catedral.',
    goalText: 'Rompé 6 jaulas y liberá a los prisioneros: ellos abren el pasaje.' },
  4: { stage: 'Las pruebas', goal: { type: 'survive', n: 100 },
    story: 'Los prisioneros le contaron que la catedral está maldita: la puerta solo se abre cuando suenan las campanas del alba. Hasta entonces, los vampiros no van a dejar de llegar. Demian tiene que aguantar.',
    goalText: 'Resistí 100 segundos hasta que suenen las campanas y la puerta se abra.' },
  5: { stage: 'El guardián del umbral', goal: { type: 'hunt', n: 8, kind: 'warrior' },
    story: 'La cámara de los pinches está custodiada por la guardia personal de Drácula: los vampiros guerreros, con espada y escudo. Cada uno lleva un pedazo de la llave de la cámara.',
    goalText: 'Derrotá a 8 vampiros guerreros para armar la llave.' },
  6: { stage: 'El descenso al abismo', goal: { type: 'break', n: 6, obj: 'coffin' },
    story: 'En el osario duermen los primeros vampiros que creó Drácula, en ataúdes de huesos. Si despiertan, nadie podrá detenerlos. Demian tiene que destruir los ataúdes antes de que caiga la noche más oscura.',
    goalText: 'Destruí 6 ataúdes de los vampiros antiguos (cuidado: salen de adentro).' },
  7: { stage: 'La recompensa', goal: { type: 'collect', n: 15, item: 'soul' },
    story: 'Detrás de las puertas del infierno, las almas de los inocentes que Drácula atrapó flotan entre el fuego, entre ellas la de su familia. Cada alma que Demian libera le da fuerza para seguir.',
    goalText: 'Liberá 15 almas atrapadas: tocalas cuando caen.' },
  8: { stage: 'La tentación', goal: { type: 'hunt', n: 20, kind: 'flyer' },
    story: 'En el jardín de la luna roja, Drácula le habla a Demian al oído: le promete devolverle a su familia si se une a él. Sus heraldos, los vampiros voladores, rodean el jardín. Demian rechaza la oferta.',
    goalText: 'Derribá a 20 vampiros voladores, los heraldos del conde.' },
  9: { stage: 'La noche más oscura', goal: { type: 'survive', n: 120 },
    story: 'En el cementerio, Demian encuentra las tumbas de su familia. Los muertos se levantan y la niebla lo envuelve: es su hora más difícil. Si resiste hasta la medianoche, se abrirá el camino al salón del trono.',
    goalText: 'Sobreviví 120 segundos hasta la medianoche.' },
  10: { stage: 'La prueba suprema', goal: { type: 'boss', n: 1 },
    story: 'Al fin, el salón del trono. Drácula espera sentado, sonriendo. Es el último combate: si Demian lo vence, volverá a casa con la paz que le robaron. Si cae, la noche será eterna.',
    goalText: 'Vencé a Drácula: 200 golpes, y después 200 más a su forma de dragón.' },
};
