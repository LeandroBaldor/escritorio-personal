// Los 10 niveles de Vampyrium: el piso (tramos de suelo y huecos), las plataformas colgadas con cadenas (algunas se
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

const GY = 3.2, TOP = 16.3;
const G = (x1: number, x2: number): Surface => ({ x1, x2, y: GY, ground: true });
const P = (x1: number, x2: number, y: number, mv?: Move): Surface => ({ x1, x2, y, ground: false, mv });
const T = (kind: TrapKind, style: string, x: number, x2: number, y: number, period: number, offset: number, len = 0, amp = 0, top?: number): Trap => ({ kind, style, x, x2, y, period, offset, len, amp, top });
const gapsOf = (s: Surface[]) => { const g = s.filter(q => q.ground).sort((a, b) => a.x1 - b.x1), out: [number, number][] = []; for (let i = 0; i + 1 < g.length; i++) if (g[i + 1].x1 > g[i].x2) out.push([g[i].x2, g[i + 1].x1]); return out; };
function level(n: number, name: string, tagline: string, bg: string, surfaces: Surface[], traps: Trap[], look: { pit: PitStyle; stone: [number, number, number]; cap: string; crop?: number; speed?: number }): LevelDef {
  return { n, name, tagline, bg, crop: look.crop ?? 0.74, surfaces, gaps: gapsOf(surfaces), traps, pit: look.pit, stone: look.stone, cap: look.cap, speed: look.speed ?? 1 + (n - 1) * 0.04 };
}

export const LEVELS: LevelDef[] = [
  level(1, 'El puente de las ánimas', 'La luna llena se asoma sobre el castillo de Drácula y el puente está tomado por sus siervos.', 'fondo-nivel-1',
    [G(0, 8), G(10.6, 17.6), G(20.2, 28), P(2, 6.2, 6.6), P(11.2, 16.8, 6.6), P(22.4, 26.2, 6.6), P(6.6, 10.8, 9.9), P(17, 21.6, 9.9), P(11.6, 16.4, 13)],
    [T('spikes', 'iron', 13.2, 14.8, GY, 3.4, 0), T('pendulum', 'axe', 14, 14, TOP, 3.9, 0.4, 8, 0.8), T('fire', 'brazier', 23.6, 23.6, GY, 4.6, 1.7, 4.2)],
    { pit: 'void', stone: [44, 40, 48], cap: '#8a6a52', speed: 1 }),
  level(2, 'Las cloacas', 'Debajo del castillo corre un río de ácido verde. Del techo gotea veneno y el agua escupe chorros que queman.', 'fondo-nivel-2',
    [G(0, 7), G(9.4, 15), G(17.4, 21.5), G(23.6, 28), P(1.5, 5.5, 6.6), P(10, 14, 6.6), P(16, 20.5, 6.8, { dx: 0, dy: 1.3, period: 5 }), P(4.5, 8.5, 9.9), P(19.6, 24, 10.2), P(11.2, 15.8, 13), P(23.4, 26.4, 6.6)],
    [T('drip', 'acid', 5.8, 5.8, GY, 2.6, 0, 0, 0, TOP), T('drip', 'acid', 12.6, 12.6, GY, 3.1, 1.2, 0, 0, TOP), T('drip', 'acid', 20.2, 20.2, GY, 2.3, 0.6, 0, 0, TOP),
      T('fire', 'acid', 16.2, 16.2, 0.6, 5, 2.5, 6.4), T('fire', 'acid', 8.2, 8.2, 0.6, 5.6, 0.4, 5.8), T('spikes', 'iron', 24.4, 25.8, GY, 3.2, 1.1)],
    { pit: 'acid', stone: [40, 52, 42], cap: '#5f7a4a' }),
  level(3, 'La fragua de las jaulas', 'Un río de lava cruza la fragua. Las sierras no paran de girar y las jaulas caen sobre los distraídos.', 'fondo-nivel-3',
    [G(0, 6.5), G(8.8, 14), G(16.2, 21), G(23.2, 28), P(1.6, 5.4, 6.6), P(9.4, 13.4, 6.6), P(16.6, 20.6, 6.6), P(5.2, 9.6, 9.9, { dx: 1.6, dy: 0, period: 6 }), P(17.8, 22.4, 9.9), P(11, 15.8, 13), P(23.6, 26.4, 6.6)],
    [T('saw', 'iron', 9.6, 13.2, GY, 3.6, 0), T('saw', 'iron', 17.1, 20.1, 6.6, 3, 1.4), T('crusher', 'cage', 19.2, 19.2, GY, 4.6, 0.5, 0.75, 0, 11.4), T('crusher', 'cage', 3.4, 3.4, 6.6, 5.2, 2.6, 0.7, 0, 12.6),
      T('fire', 'lava', 7.65, 7.65, 0.6, 4.4, 1, 6.6), T('fire', 'lava', 22.2, 22.2, 0.6, 4.8, 3.1, 6.6)],
    { pit: 'lava', stone: [58, 38, 30], cap: '#b8542a' }),
  level(4, 'La catedral profanada', 'Los vitrales brillan con la luna. Las arañas de velas se descuelgan y las bocas de la pared escupen fuego.', 'fondo-nivel-4',
    [G(0, 28), P(1.5, 6, 6.6), P(8, 12.6, 6.6), P(15.2, 19.6, 6.6, { dx: 2, dy: 0, period: 7 }), P(21.8, 26.2, 6.6), P(4.4, 9, 9.9), P(11.6, 16.4, 10.2), P(18.6, 23, 9.9), P(8.6, 12.8, 13.2)],
    [T('crusher', 'chandelier', 10.4, 10.4, GY, 5, 0, 0.9, 0, 11.6), T('crusher', 'chandelier', 18.4, 18.4, GY, 5.4, 2.4, 0.9, 0, 12.8), T('pendulum', 'axe', 14, 14, TOP, 4.2, 1, 7, 0.75),
      T('jet', 'wall', 26.2, 26.2, 6.6, 4.4, 0.8, 4.2, -1), T('jet', 'wall', 1.5, 1.5, 6.6, 4.8, 2.6, 4.2, 1)],
    { pit: 'void', stone: [48, 42, 60], cap: '#7c6a8c' }),
  level(5, 'La cámara de los pinches', 'Nadie salió vivo de esta sala: el piso escupe pinches, las bolas de hierro barren el aire y un rodillo lo aplasta todo.', 'fondo-nivel-5',
    [G(0, 9.2), G(11.8, 28), P(1.8, 6.4, 6.6), P(9.4, 14, 6.8), P(16.6, 21.2, 6.6), P(22.6, 26.4, 9.9), P(4.6, 9.2, 10), P(12.6, 17.4, 11.2), P(18.6, 22.2, 13.4)],
    [T('spikes', 'iron', 3.8, 5.6, GY, 3, 0), T('spikes', 'iron', 13.2, 15, GY, 3, 1), T('spikes', 'iron', 19.6, 21.4, GY, 3, 2), T('spikes', 'iron', 10.2, 12, 6.8, 3.6, 1.6),
      T('pendulum', 'mace', 8, 8, TOP, 3.4, 0, 7.6, 0.9), T('pendulum', 'mace', 19.8, 19.8, TOP, 3.8, 1.5, 7.2, 0.85), T('roller', 'spiked', 12.6, 25.2, GY, 7, 0)],
    { pit: 'void', stone: [56, 40, 42], cap: '#8a5a52' }),
  level(6, 'El osario', 'Miles de huesos forman las paredes. Las calaveras caen del techo y los pozos están llenos de lanzas de hueso.', 'fondo-nivel-6',
    [G(0, 8), G(10.5, 18), G(20.5, 28), P(1.6, 5.8, 6.6), P(10.8, 16.2, 6.6), P(21.6, 26, 6.6), P(6, 10.4, 9.9, { dx: 0, dy: 1.1, period: 4.6 }), P(17, 21.8, 9.9), P(11, 16, 13)],
    [T('spikes', 'bone', 12.4, 14.4, 6.6, 3.3, 0.8), T('spikes', 'bone', 22.2, 23.8, GY, 3, 2), T('drip', 'skull', 4.8, 4.8, GY, 3.2, 0, 0, 0, TOP), T('drip', 'skull', 14.6, 14.6, GY, 2.8, 1.4, 0, 0, TOP),
      T('drip', 'skull', 24.6, 24.6, GY, 3.6, 2.2, 0, 0, TOP), T('pendulum', 'cage', 19.2, 19.2, TOP, 4.4, 0.6, 6.4, 0.7)],
    { pit: 'bones', stone: [92, 80, 62], cap: '#d6c39a' }),
  level(7, 'Las puertas del infierno', 'El castillo arde. De los pozos salen columnas de fuego, llueven bolas de fuego y una araña de pinches espera.', 'fondo-nivel-7',
    [G(0, 7.5), G(10, 13.6), G(16, 19.6), G(22, 28), P(1.6, 5.6, 6.6), P(8.6, 12.8, 6.6), P(15.4, 20.2, 6.6, { dx: 1.4, dy: 0, period: 5.5 }), P(22.4, 26.4, 6.6), P(4.4, 9, 9.9), P(18.6, 23.2, 9.9), P(11, 16.4, 12.8)],
    [T('fire', 'hellfire', 8.75, 8.75, 0.6, 3.8, 0, 7.2), T('fire', 'hellfire', 14.8, 14.8, 0.6, 3.8, 1.3, 7.2), T('fire', 'hellfire', 20.8, 20.8, 0.6, 3.8, 2.5, 7.2),
      T('drip', 'fireball', 3.6, 3.6, GY, 2.4, 0.3, 0, 0, TOP), T('drip', 'fireball', 11.8, 11.8, GY, 2.9, 1.6, 0, 0, TOP), T('drip', 'fireball', 24.8, 24.8, GY, 2.6, 0.9, 0, 0, TOP),
      T('crusher', 'spikeblock', 17.8, 17.8, GY, 4.6, 1.2, 0.9, 0, 12.2)],
    { pit: 'fire', stone: [64, 34, 26], cap: '#c2552a' }),
  level(8, 'El jardín de la luna roja', 'Entre las rosas del jardín corre una fuente de sangre. Las espinas brotan del piso y las gárgolas escupen fuego.', 'fondo-nivel-8',
    [G(0, 12.2), G(14.8, 28), P(1.6, 6, 9.9), P(7, 11.4, 6.6, { dx: 1.8, dy: 0, period: 6.5 }), P(15.4, 19.8, 6.6), P(20.8, 25.4, 9.9), P(11.2, 16, 12.4, { dx: 2.2, dy: 0, period: 8, phase: 2 }), P(22.8, 26.4, 5.6)],
    [T('spikes', 'thorn', 5.4, 7.4, GY, 3.2, 0), T('spikes', 'thorn', 19.4, 21.4, GY, 3.2, 1.6), T('fire', 'blood', 13.5, 13.5, 0.6, 4.4, 1, 7),
      T('jet', 'gargoyle', 1.6, 1.6, 9.9, 4.6, 0.5, 4.6, 1), T('jet', 'gargoyle', 19.8, 19.8, 6.6, 4.2, 2.6, 4.2, -1)],
    { pit: 'blood', stone: [82, 74, 76], cap: '#b9a7a2', crop: 0.8 }),
  level(9, 'El cementerio', 'Las tumbas están abiertas. Las manos de los muertos salen de la tierra y una guadaña corta la niebla.', 'fondo-nivel-9',
    [G(0, 10), G(12.4, 20), G(22.4, 28), P(1.6, 5.8, 6.6), P(7.6, 12, 9.9), P(13, 17.6, 6.6, { dx: 0, dy: 1.4, period: 5.2 }), P(17.8, 22.2, 10.4), P(22.8, 26.4, 6.6), P(11.4, 16, 13.4)],
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
