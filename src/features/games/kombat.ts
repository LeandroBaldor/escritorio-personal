// Lógica de Kombat Football: fútbol 1 contra 1 visto de costado, mezclado con peleas al estilo Mortal Kombat.
// La cancha ocupa toda la pantalla y es larga, con un arco en cada borde (sin arqueros: cada luchador defiende
// su arco con su habilidad, que también sirve para dispararle a la pelota antes de que entre). Hay un árbitro
// que corre por la cancha. Dos tiempos de 1:30 con cambio de lado en el entretiempo; si empatan, gol de oro.
// Cada escenario tiene desniveles, plataformas flotantes y trampas (pinches, sierras, láseres, fuego, lava,
// minas…). Las trampas no matan: bajan la ENERGÍA, igual que los ataques del rival y usar la habilidad propia;
// la energía se recupera descansando y, cuanto menos queda, más lento se corre. La pelota nunca explota: el fuego,
// la lava, los láseres, las sierras y las minas la despiden (prendida fuego) y sigue en juego.
// La barra de PODER se carga jugando: llena, habilita el FATAL GOAL con una combinación de flechas + patear.
// Todo se mide en metros: la cancha mide W de largo, el piso está en y = 0 y para arriba es positivo.

export const W = 30; // largo de la cancha
export const H = 14; // techo invisible (arriba de todo de la pantalla)
export const GOAL_DEPTH = 1.6; // qué tan hondo es el arco
export const GOAL_H = 3.0; // alto del travesaño
export const BAR = 0.16; // grosor del travesaño
// La red: arriba sale del travesaño derecha un tramo y después cae en curva hasta el piso en el fondo del arco.
// u: 0 en la boca del arco, 1 en el fondo. Devuelve el alto de la red ahí.
export const NET_FLAT = 0.28;
export const netTop = (gh: number, u: number) => u <= NET_FLAT ? gh : gh * Math.pow(Math.max(0, 1 - Math.pow((u - NET_FLAT) / (1 - NET_FLAT), 1.8)), 0.75);
export const BALL_R = 0.3;
export const PW = 0.96; // ancho de una persona
export const PH = 2.3;
// Tamaño de cada luchador (alto = PH × tamaño): los grandotes BRUTO, RED BRUTO y MAGMA; los petizos CYBER,
// THUNDER y COMETA; el resto varía un poco.
export const SIZE: Record<CharId, number> = {
  bruto: 1.4, brutoRed: 1.36, magma: 1.32, cyber: 0.7, thunder: 0.72, cometa: 0.74,
  inferno: 1.08, frost: 1, shadow: 0.9, shadowRed: 0.94, orbot: 1.12, orbotBlue: 1.05, aguila: 1.03, aguilaBlack: 0.97, espectro: 1.1, toxic: 0.88,
};
export const heightOf = (f: { char: CharId }) => PH * SIZE[f.char];
const bodyH = (p: object) => 'char' in p ? heightOf(p as { char: CharId }) : PH; // alto de una persona
export const HALF_TIME = 90; // cada tiempo dura 1:30
export const STAMINA = 100; // energía llena
export const POWER_MAX = 100; // poder para el FATAL GOAL
export const FATAL_CINE = 1.4; // la presentación del FATAL GOAL (todo se congela)
export const TOURNAMENT = 15; // todos los demás luchadores, uno por uno
export const TUBE_Y = 10.4; // boca del tubo del medio, por donde baja la pelota

export type CharId = 'cometa' | 'inferno' | 'frost' | 'thunder' | 'shadow' | 'shadowRed' | 'orbot' | 'orbotBlue' | 'bruto' | 'brutoRed' | 'aguila' | 'aguilaBlack' | 'espectro' | 'toxic' | 'magma' | 'cyber';
export type Ability = 'superJump' | 'fireball' | 'freeze' | 'lightning' | 'shuriken' | 'bomb' | 'burst' | 'beam' | 'quake' | 'charge' | 'flight' | 'feathers' | 'phase' | 'toxicCloud' | 'magmaSpikes' | 'laserCut';
export type Element = 'fire' | 'ice' | 'volt' | 'dark' | 'toxic' | 'rock';
export type FatalStyle = 'meteor' | 'avalanche' | 'bolt' | 'void' | 'acid' | 'boulder';
export type StageId = 'industrial' | 'mines' | 'base' | 'ice' | 'volcano' | 'forest' | 'factory' | 'storm' | 'temple' | 'moon' | 'subway' | 'pit' | 'desert' | 'ocean' | 'sky' | 'coliseum';
export type PowerKind = 'shield' | 'speed' | 'magnet' | 'power' | 'giant' | 'energy';
export type BallKind = 'normal' | 'toxic' | 'fire' | 'ice' | 'spike' | 'void';
// Combinación del FATAL GOAL (F = adelante, hacia el arco rival; B = atrás) + patear.
export const FATAL_COMBO: ('F' | 'B')[] = ['F', 'B', 'F'];
export const MAX_JUMPS = 3; // saltos seguidos (en el aire)
export const CHARGE_MAX = 1; // segundos de barra espaciadora para el tiro más fuerte
export const kickMult = (charge: number) => 0.55 + 0.95 * Math.min(1, charge / CHARGE_MAX);

export interface CharDef {
  id: CharId; name: string; color: string; glow: string; element: Element; fatal: FatalStyle; fatalName: string; bio: string;
  speed: number; power: number; jump: number; rest: number; // 1 = normal (rest: qué tan rápido recupera energía)
  ability: Ability; abilityName: string; abilityText: string; cost: number; cd: number;
}
const C = (id: CharId, name: string, color: string, glow: string, element: Element, stats: [number, number, number, number], ability: Ability, abilityName: string, abilityText: string, cost: number, cd: number, bio: string): CharDef => {
  const fatal: FatalStyle = ({ fire: 'meteor', ice: 'avalanche', volt: 'bolt', dark: 'void', toxic: 'acid', rock: 'boulder' } as const)[element];
  const fatalName = ({ meteor: 'METEORITO', avalanche: 'AVALANCHA', bolt: 'RELÁMPAGO', void: 'AGUJERO NEGRO', acid: 'BOMBA ÁCIDA', boulder: 'ROCA GIGANTE' } as const)[fatal];
  return { id, name, color, glow, element, fatal, fatalName, bio, speed: stats[0], power: stats[1], jump: stats[2], rest: stats[3], ability, abilityName, abilityText, cost, cd };
};
export const CHARS: Record<CharId, CharDef> = {
  cometa: C('cometa', 'COMETA', '#60a5fa', '#bae6fd', 'ice', [1.04, 0.95, 1.15, 1.05], 'superJump', 'Salto potenciado', 'Sale volando con los propulsores: si en el aire toca la pelota, la manda lejísimos.', 14, 1.8, 'Un astronauta de las estaciones de hielo. Salta como nadie.'),
  inferno: C('inferno', 'INFERNO', '#ef4444', '#fb923c', 'fire', [0.98, 1.12, 0.95, 1], 'fireball', 'Bolas de fuego', 'Lanza una bola de fuego: empuja la pelota y quema al rival.', 18, 1.5, 'Guerrero con casco de cuernos que nació entre las llamas.'),
  frost: C('frost', 'FROST', '#38bdf8', '#e0f2fe', 'ice', [1, 1, 1.02, 1], 'freeze', 'Congela el escenario', 'Congela todo a su alrededor: la pelota se frena en seco y el rival queda hecho hielo.', 22, 3, 'Su armadura es de hielo eterno. Congela el aire con la mano.'),
  thunder: C('thunder', 'THUNDER', '#facc15', '#fef08a', 'volt', [1.1, 0.95, 1.05, 0.95], 'lightning', 'Rayos eléctricos', 'Dispara un rayo instantáneo que le pega a la pelota o al rival a distancia.', 18, 1.7, 'Cargado de electricidad. Rápido y nervioso.'),
  shadow: C('shadow', 'SHADOW', '#a855f7', '#e9d5ff', 'dark', [1.12, 0.92, 1.08, 1], 'shuriken', 'Estrellas ninja', 'Tira estrellas ninja muy rápidas y baratas.', 9, 0.7, 'Ninja de las sombras. Nadie lo ve llegar.'),
  shadowRed: C('shadowRed', 'RED SHADOW', '#ef4444', '#fca5a5', 'fire', [1.08, 0.95, 1.05, 1], 'bomb', 'Estrellas explosivas', 'Su estrella explota al tocar algo y voltea todo alrededor.', 18, 1.7, 'El hermano rojo de Shadow. Le gusta que las cosas exploten.'),
  orbot: C('orbot', 'ORBOT', '#84cc16', '#bef264', 'toxic', [0.96, 1.02, 0.95, 1], 'burst', 'Disparo automático', 'Tres disparos seguidos con el cañón del brazo.', 16, 1.5, 'Robot de combate con un cañón tóxico en el brazo.'),
  orbotBlue: C('orbotBlue', 'BLUE ORBOT', '#3b82f6', '#93c5fd', 'volt', [0.96, 1.02, 0.95, 1], 'beam', 'Rayo de energía', 'Carga y dispara un rayo de energía larguísimo y muy fuerte.', 22, 2.3, 'Versión azul del Orbot, con un cañón de energía.'),
  bruto: C('bruto', 'BRUTO', '#9ca3af', '#fbbf24', 'rock', [0.86, 1.25, 0.85, 1.15], 'quake', 'Golpe terrestre', 'Golpea el piso: la onda levanta la pelota y voltea a los que estén cerca.', 20, 2.4, 'Un gigante de piedra y metal. Lento pero imparable.'),
  brutoRed: C('brutoRed', 'RED BRUTO', '#dc2626', '#f97316', 'fire', [0.88, 1.22, 0.86, 1.1], 'charge', 'Embestida', 'Carga a toda velocidad envuelto en fuego: arrasa con la pelota y con el rival.', 18, 2, 'El Bruto más furioso. Cuando corre, tiembla el piso.'),
  aguila: C('aguila', 'AGUILA', '#eab308', '#fde68a', 'volt', [1.06, 0.98, 1.12, 1], 'flight', 'Vuelo corto', 'Vuela en línea recta un momento: si choca la pelota, la manda como un misil.', 16, 2, 'Guerrero alado con armadura dorada.'),
  aguilaBlack: C('aguilaBlack', 'BLACK AGUILA', '#c026d3', '#f0abfc', 'dark', [1.06, 0.98, 1.1, 1], 'feathers', 'Plumas envenenadas', 'Tira tres plumas en abanico que envenenan al rival.', 16, 1.5, 'El águila de la noche. Sus plumas son veneno.'),
  espectro: C('espectro', 'ESPECTRO', '#22d3ee', '#a5f3fc', 'dark', [1.1, 0.92, 1.05, 1.05], 'phase', 'Fase', 'Se vuelve fantasma: atraviesa trampas y rivales a toda velocidad.', 14, 1.8, 'Un astronauta perdido que se volvió fantasma.'),
  toxic: C('toxic', 'TOXIC', '#4ade80', '#bbf7d0', 'toxic', [1, 1, 1, 1], 'toxicCloud', 'Nube tóxica', 'Lanza una burbuja que se abre en una nube: frena la pelota y envenena al rival.', 18, 2.2, 'Respira gas tóxico detrás de su máscara.'),
  magma: C('magma', 'MAGMA', '#f97316', '#fdba74', 'fire', [0.9, 1.18, 0.88, 1.1], 'magmaSpikes', 'Picos de magma', 'Hace salir picos de lava del piso que avanzan hacia adelante.', 20, 2.2, 'Hecho de roca volcánica. Por las grietas le corre lava.'),
  cyber: C('cyber', 'CYBER', '#ec4899', '#f9a8d4', 'volt', [1.08, 1, 1.05, 1], 'laserCut', 'Corte láser', 'Un tajo con la espada láser que despeja la pelota con fuerza.', 13, 1.3, 'Samurái cibernético con espada de luz.'),
};
export const CHAR_IDS: CharId[] = ['cometa', 'inferno', 'frost', 'thunder', 'shadow', 'shadowRed', 'orbot', 'orbotBlue', 'bruto', 'brutoRed', 'aguila', 'aguilaBlack', 'espectro', 'toxic', 'magma', 'cyber'];

export interface StageDef { id: StageId; name: string; hazard: string; gravity: number; friction: number }
export const STAGES: StageDef[] = [
  { id: 'industrial', name: 'Planeta Herrumbre', hazard: 'Láseres, pinches, sierras y una bola con púas', gravity: 1, friction: 1 },
  { id: 'mines', name: 'Planeta Minado', hazard: 'Minas flotantes, láseres y plataformas con pinches', gravity: 0.85, friction: 1 },
  { id: 'base', name: 'Planeta Órbita', hazard: 'Gravedad baja y muchos láseres', gravity: 0.7, friction: 1 },
  { id: 'ice', name: 'Planeta Helado', hazard: 'Piso que resbala, pinches y carámbanos que caen', gravity: 1, friction: 0.35 },
  { id: 'volcano', name: 'Planeta Volcánico', hazard: 'Pozos de lava, chorros de fuego y meteoritos', gravity: 1, friction: 1 },
  { id: 'forest', name: 'Planeta Fungi', hazard: 'Hongos que rebotan, cascada y pinches', gravity: 1, friction: 1 },
  { id: 'factory', name: 'Planeta Engranaje', hazard: 'Sierras, láseres y cinta transportadora', gravity: 1, friction: 1 },
  { id: 'storm', name: 'Planeta Tormenta', hazard: 'Rayos, placas eléctricas y bolas con púas', gravity: 1, friction: 1 },
  { id: 'temple', name: 'Planeta Ancestral', hazard: 'Antorchas de fuego, pinches y escalones', gravity: 1, friction: 1 },
  { id: 'moon', name: 'Planeta Selene', hazard: 'Gravedad lunar, láseres y bloques con pinches', gravity: 0.45, friction: 1 },
  { id: 'subway', name: 'Planeta Metro', hazard: 'Riel electrificado, láseres y una plataforma que va y viene', gravity: 1, friction: 1 },
  { id: 'pit', name: 'Planeta Abismo', hazard: 'Bolas con púas, pinches y un ascensor sobre el abismo', gravity: 1, friction: 1 },
  { id: 'desert', name: 'Planeta Duna', hazard: 'Géiseres de fuego, sierras y arena que resbala', gravity: 1, friction: 0.8 },
  { id: 'ocean', name: 'Planeta Coral', hazard: 'Minas submarinas, erizos y se flota (poca gravedad)', gravity: 0.55, friction: 0.9 },
  { id: 'sky', name: 'Planeta Nimbo', hazard: 'Rayos, láseres y plataformas en el aire', gravity: 0.8, friction: 1 },
  { id: 'coliseum', name: 'Planeta Gladiador', hazard: 'Pinches, fuego, un pistón y una bola con púas', gravity: 1, friction: 1 },
];
export const stageDef = (id: StageId) => STAGES.find(s => s.id === id) ?? STAGES[0];

export const POWERS: Record<PowerKind, { name: string; text: string; color: string; time: number }> = {
  shield: { name: 'Escudo', text: 'no te pueden voltear', color: '#38bdf8', time: 8 },
  speed: { name: 'Turbo', text: 'corrés más rápido', color: '#22c55e', time: 8 },
  magnet: { name: 'Imán', text: 'la pelota viene hacia vos', color: '#ec4899', time: 7 },
  power: { name: 'Súper patada', text: 'pateás mucho más fuerte', color: '#a855f7', time: 8 },
  giant: { name: 'Arco gigante', text: 'el arco del rival se agranda', color: '#f97316', time: 10 },
  energy: { name: 'Energía', text: 'energía llena y más poder', color: '#facc15', time: 0 },
};
export const BALLS: Record<Exclude<BallKind, 'normal'>, { name: string; text: string; color: string }> = {
  toxic: { name: 'Pelota tóxica', text: 'se mueve sola, para cualquier lado', color: '#4ade80' },
  fire: { name: 'Pelota de fuego', text: 'más rápida, y quema si te pega', color: '#f97316' },
  ice: { name: 'Pelota de hielo', text: 'resbala y casi no frena', color: '#38bdf8' },
  spike: { name: 'Pelota con pinchos', text: 'si te pega en el cuerpo te voltea', color: '#9ca3af' },
  void: { name: 'Pelota del vacío', text: 'flota como en la Luna', color: '#a855f7' },
};

export type Cast = 'ability' | 'fatal';
export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; kick: boolean; ability: boolean; cast?: Cast | null }
export const noInput = (): Input => ({ left: false, right: false, up: false, down: false, kick: false, ability: false, cast: null });

export type Action = 'idle' | 'run' | 'jump' | 'charge' | 'kick' | 'header' | 'slide' | 'block' | 'stun' | 'special' | 'celebrate' | 'sad' | 'fatal' | 'tired';
export type StunKind = 'hit' | 'freeze' | 'poison' | 'burn' | 'zap' | 'none';
export interface Fighter {
  side: 0 | 1; char: CharId;
  x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean;
  action: Action; actionT: number;
  kickT: number; kickKind: 'normal' | 'lob' | 'low'; kickHit: boolean; slideT: number;
  charge: number; kickPow: number; jumps: number; headT: number; // segundos cargando el tiro, fuerza del tiro, saltos hechos desde que despegó
  stun: number; stunKind: StunKind; poison: number; inv: number;
  stamina: number; power: number; cd: number;
  abilityT: number; abilityHit: boolean; burst: number; burstT: number; // habilidades que duran (salto, embestida, vuelo, fase, ráfaga)
  powers: Partial<Record<PowerKind, number>>;
  prev: Input; taps: { d: 'F' | 'B' | 'U' | 'D'; t: number }[];
  goals: number; restT: number;
}
export interface Person { // el árbitro
  x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean;
  action: 'idle' | 'run' | 'jump' | 'stun' | 'down' | 'gone' | 'whistle'; actionT: number;
  stun: number; stunKind: StunKind; away: number;
  roam?: { x: number; t: number; solid: number | null }; // a dónde va (recorre la cancha y se sube a las plataformas)
}
export interface Ball { x: number; y: number; vx: number; vy: number; spin: number; kind: BallKind; kindT: number; owner: 0 | 1 | null; fx: 'none' | 'toxic' | 'fire' | 'ice' | 'volt' | 'void'; fxT: number; frozen: number; alive: boolean; respawn: number; heat: number; pass?: { side: 0 | 1; t: number } } // pass: atraviesa un ratito al que la acaba de pegar
export type PropLook = 'hydrant' | 'dish' | 'gears' | 'gargoyle' | 'idol' | 'lander' | 'vending' | 'brazier' | 'cage' | 'ruin' | 'anchor' | 'urn' | 'fountain' | 'rack' | 'bench' | 'cactus' | 'coral' | 'chest' | 'statue' | 'crate' | 'container' | 'cart' | 'crystal' | 'pod' | 'icecube' | 'snow' | 'obsidian' | 'basalt' | 'log' | 'stump' | 'barrels' | 'tomb' | 'altar' | 'column' | 'boulder';
export interface Solid { x: number; y: number; w: number; h: number; kind: 'block' | 'float' | 'bouncy'; id: number; move?: Mover; look?: PropLook }
// Plataformas que se mueven: ascensores (suben y bajan), plataformas que van y vienen y pistones que salen del piso.
export interface Mover { kind: 'lift' | 'slide' | 'piston'; x0: number; y0: number; h0: number; ax: number; ay: number; ah: number; period: number; phase: number }
export type ShotKind = 'fireball' | 'shuriken' | 'bomb' | 'bullet' | 'feather' | 'bubble';
export interface Shot { kind: ShotKind; side: 0 | 1; x: number; y: number; vx: number; vy: number; r: number; t: number; life: number; done: boolean }
// Efectos de las habilidades que se dibujan un ratito (rayos, cortes, ondas, explosiones, nubes, picos).
export interface Fx { kind: 'bolt' | 'beam' | 'charge' | 'slash' | 'nova' | 'quake' | 'boom' | 'cloud' | 'magma'; side: 0 | 1; x: number; y: number; x2: number; y2: number; t: number; life: number; dir: number; hit: number }
export interface Fatal { side: 0 | 1; char: CharId; style: FatalStyle; t: number; x0: number; y0: number; dir: 1 | -1; blocked: boolean; done: boolean }
export interface PowerUp { id: number; kind: PowerKind; x: number; y: number; t: number }
export type TrapKind = 'spikes' | 'flame' | 'shock' | 'laser' | 'saw';
export interface Hazard {
  kind: TrapKind | 'wreck' | 'conveyor' | 'meteor' | 'lava' | 'icicle' | 'lightning' | 'mine' | 'waterfall';
  // spikes/flame/shock/lava/conveyor/waterfall: de x a x+w, apoyada en y (la superficie); laser: de y a h (alto);
  // saw: recorre de x a x+w; wreck: cuelga de (x, y) con largo h; mine: flota en (x, y)
  x: number; y: number; w: number; h: number; t: number; state: number; dir: number; id: number; period: number;
  struck?: number; // a quiénes ya lastimó en este encendido (bits: luchadores 1 y 2, árbitro 4)
}
export type KfEvent =
  | { type: 'kick'; power: number } | { type: 'hit'; who: 'fighter' | 'ref'; kind: StunKind } | { type: 'block' } | { type: 'goal'; side: 0 | 1; fatal: boolean }
  | { type: 'bounce'; power: number } | { type: 'post' } | { type: 'jump' } | { type: 'charged'; side: 0 | 1; power: number } | { type: 'ability'; side: 0 | 1; char: CharId }
  | { type: 'fatal'; side: 0 | 1; char: CharId } | { type: 'fatalBlocked'; side: 0 | 1 } | { type: 'power'; side: 0 | 1; kind: PowerKind } | { type: 'ballKind'; kind: BallKind }
  | { type: 'unlock'; side: 0 | 1 } | { type: 'refDown' } | { type: 'refBack' } | { type: 'refBoom' } | { type: 'ballBoom' } | { type: 'ballDrop' } | { type: 'save'; side: 0 | 1 }
  | { type: 'trap'; kind: Hazard['kind'] } | { type: 'boom' } | { type: 'thunder' } | { type: 'zap' } | { type: 'whistle'; kind: 'kickoff' | 'half' | 'end'; start?: 1 | 2 }
  | { type: 'halftime' } | { type: 'extra' } | { type: 'warn' } | { type: 'tired'; side: 0 | 1 } | { type: 'noEnergy'; side: 0 | 1 } | { type: 'needBall'; side: 0 | 1 } | { type: 'header'; side: 0 | 1 };
export type Phase = 'intro' | 'play' | 'goal' | 'fatal' | 'halftime' | 'end';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'shard' | 'bubble' | 'ember' | 'flash' | 'ring' | 'blood' }
export interface CpuState { level: number; think: number; plan: Input; reactFatal: number; kickHold: number; lob?: boolean; holdFor?: number }

export interface Match {
  stage: StageId; fighters: [Fighter, Fighter]; ref: Person; ball: Ball; trail: [number, number][];
  phase: Phase; phaseT: number; time: number; half: 1 | 2; clock: number; extra: boolean; extraT: number; kickoffTeam: 0 | 1;
  solids: Solid[]; shots: Shot[]; fx: Fx[]; fatal: Fatal | null; powerups: PowerUp[]; hazards: Hazard[]; particles: Particle[];
  nextPower: number; nextBall: number; nextHazard: number; nextId: number;
  lastGoal: { side: 0 | 1; fatal: boolean } | null; winner: 0 | 1 | null;
  events: KfEvent[]; shake: number; flash: number; rand: () => number;
  cpu: [CpuState | null, CpuState | null];
  stillT?: number; // cuánto hace que la pelota está quieta y lejos de todos
  roofT?: number; // cuánto hace que la pelota está trabada arriba del arco (sobre la red o contra la pared)
  gore: Gore; // la sangre y los huesos del árbitro cuando revienta
  tint?: { c: string; t: number }; // la pantalla se tiñe un instante del color del poder
  netHit?: { left: boolean; t: number; y: number }; // la red que se infla cuando entra la pelota
}
// El árbitro que revienta (como el astronauta de Gravity Swap): gotas de sangre que vuelan y manchan donde caen,
// y los pedazos del esqueleto (calavera, costillas, cadera, huesos) que rebotan chorreando.
export type GibKind = 'skull' | 'ribs' | 'pelvis' | 'bone' | 'jaw' | 'chunk' | 'shirt';
export interface Gore { drops: { x: number; y: number; vx: number; vy: number; r: number; life: number }[]; gibs: { x: number; y: number; vx: number; vy: number; a: number; va: number; kind: GibKind; life: number; drip: number }[]; stains: { x: number; y: number; r: number; at: number; seed: number }[] }

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const emit = (m: Match, e: KfEvent) => { m.events.push(e); };
export function takeEvents(m: Match) { const e = m.events; m.events = []; return e; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- Lados de la cancha
// En el primer tiempo el equipo 0 defiende el arco de la izquierda; en el segundo, el de la derecha.
export const defendsLeft = (m: Match, team: 0 | 1) => (team === 0) === (m.half === 1);
export const attackDir = (m: Match, team: 0 | 1): 1 | -1 => defendsLeft(m, team) ? 1 : -1;
export const goalLineX = (left: boolean) => left ? GOAL_DEPTH : W - GOAL_DEPTH;
const ownGoalX = (m: Match, team: 0 | 1) => goalLineX(defendsLeft(m, team));
export const teamAt = (m: Match, left: boolean): 0 | 1 => defendsLeft(m, 0) === left ? 0 : 1;
// Alto del arco que defiende "team" (se agranda con el potenciador del rival y en el tiempo extra).
export function goalHeight(m: Match, team: 0 | 1) {
  const rival = m.fighters[team === 0 ? 1 : 0];
  return Math.min(4.5, GOAL_H + ((rival.powers.giant ?? 0) > 0 ? 1.2 : 0) + (m.extra ? Math.min(1.2, Math.floor(m.extraT / 20) * 0.4) : 0));
}

function newFighter(side: 0 | 1, char: CharId): Fighter {
  return { side, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, charge: 0, kickPow: 1, jumps: 0, headT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: STAMINA, power: 0, cd: 0,
    abilityT: 0, abilityHit: false, burst: 0, burstT: 0, powers: {}, prev: noInput(), taps: [], goals: 0, restT: 0 };
}

// ---------------------------------------------------------------- Escenarios: desniveles, plataformas y trampas
// Todo va en espejo (lo mismo de los dos lados) para que ningún arco tenga ventaja; las áreas de los arcos
// (los primeros 4,5 m) quedan libres.
function buildStage(m: Match) {
  const S: Solid[] = [], Z: Hazard[] = [];
  const both = (cx: number, fn: (x: number) => void) => { fn(cx); fn(W - cx); };
  const solid = (x: number, y: number, w: number, h: number, kind: Solid['kind'] = 'block') => S.push({ x, y, w, h, kind, id: m.nextId++ });
  const block = (cx: number, w: number, h: number, kind: Solid['kind'] = 'block', look?: PropLook) => both(cx, x => { solid(x - w / 2, 0, w, h, kind); if (look) S[S.length - 1].look = look; });
  const plat = (cx: number, y: number, w: number) => both(cx, x => solid(x - w / 2, y, w, 0.4, 'float'));
  const hz = (kind: Hazard['kind'], x: number, y: number, w: number, h: number, extra: Partial<Hazard> = {}): Hazard => ({ kind, x, y, w, h, t: 0, state: 0, dir: 1, id: m.nextId++, period: 6.5, ...extra });
  const trap = (kind: TrapKind, cx: number, w: number, base: number, extra: Partial<Hazard> = {}) => both(cx, x => Z.push(hz(kind, x - w / 2, base, w, kind === 'laser' ? (extra.h ?? 3) : 0.1, { period: kind === 'laser' ? 5.5 : 6.5, ...extra })));
  const laser = (cx: number, top: number, phase = 0, base = 0) => trap('laser', cx, 0.3, base, { h: top, t: phase });
  // ascensor / plataforma que va y viene (espejada, con la fase opuesta así se cruzan)
  const mover = (kind: Mover['kind'], cx: number, y: number, w: number, h: number, ax: number, ay: number, ah: number, period: number, phase = 0, mirror = true) => {
    const one = (x: number, ph: number, sx: number) => S.push({ x: x - w / 2, y, w, h, kind: kind === 'piston' ? 'block' : 'float', id: m.nextId++, move: { kind, x0: x - w / 2, y0: y, h0: h, ax: ax * sx, ay, ah, period, phase: ph } });
    if (mirror) { one(cx, phase, 1); one(W - cx, kind === 'lift' ? phase + Math.PI : phase, -1); } else one(cx, phase, 1);
  };
  const saw = (x0: number, x1: number, phase = 0) => { Z.push(hz('saw', x0, 0, x1 - x0, 0.6, { t: phase, period: 7 })); Z.push(hz('saw', W - x1, 0, x1 - x0, 0.6, { t: phase, period: 7, dir: -1 })); };
  switch (m.stage) {
    case 'industrial':
      block(6.8, 1.8, 0.8, 'block', 'container'); plat(10.2, 3.3, 3.2); block(5.1, 0.5, 0.6, 'block', 'hydrant');
      trap('spikes', 8.6, 1.4, 0); laser(10.2, 3.3); saw(11.8, 13.2, 3);
      Z.push(hz('wreck', W / 2, H - 0.4, 0, H - 2.9));
      mover('lift', 3.6, 1.6, 1.8, 0.35, 0, 2.4, 0, 6);
      break;
    case 'mines':
      plat(8, 2.9, 3); block(11.6, 1.8, 0.7, 'block', 'cart'); block(5.7, 0.9, 0.6, 'block', 'crystal'); solid(W / 2 - 1.6, 6.3, 3.2, 0.4, 'float');
      trap('spikes', 8, 1.4, 3.3); trap('spikes', 9.9, 1.2, 0, { t: 2 }); laser(13, 5.6, 2.5);
      both(10.8, x => Z.push(hz('mine', x, 5.1, 0.45, 0)));
      mover('slide', 4.4, 4.6, 1.8, 0.35, 1.6, 0, 0, 5.5);
      break;
    case 'base':
      plat(6.3, 2.6, 2.4); plat(10.8, 3.6, 2.6); block(4.9, 1.3, 0.8, 'block', 'pod'); block(3.3, 1, 0.9, 'block', 'dish');
      laser(8.6, 4.4); laser(12.9, 4.4, 2.7); trap('spikes', 10.8, 1.8, 0, { t: 1.3 });
      mover('lift', W / 2, 5.2, 2.6, 0.35, 0, 1.6, 0, 7, 0, false);
      break;
    case 'ice':
      block(7, 2, 1.1, 'block', 'icecube'); block(12.3, 1.6, 0.6, 'block', 'snow'); plat(9.7, 3.5, 2.6);
      trap('spikes', 9.7, 1.6, 0); trap('spikes', 12.3, 1, 0.6, { t: 3 });
      mover('slide', W / 2, 5.4, 2.4, 0.4, 3.2, 0, 0, 8, 0, false);
      break;
    case 'volcano':
      block(12.3, 2, 0.9, 'block', 'obsidian'); plat(7.4, 3, 2.4); block(4.7, 0.8, 1.3, 'block', 'basalt');
      both(9.7, x => Z.push(hz('lava', x - 0.8, 0, 1.6, 0.1)));
      trap('flame', 12.3, 1, 0.9, { t: 2.5 }); trap('spikes', 7.4, 1.2, 3.4);
      mover('piston', W / 2, 0, 1.6, 0.15, 0, 0, 1.3, 5, 0, false);
      break;
    case 'forest':
      block(7.2, 1.8, 0.9, 'block', 'log'); plat(10.8, 3.2, 2.6); block(12.9, 1.5, 0.75, 'bouncy'); block(4.9, 0.9, 0.6, 'block', 'stump');
      trap('spikes', 9, 1.4, 0);
      Z.push(hz('waterfall', W / 2 - 0.5, 0, 1, H));
      mover('lift', 4.2, 1.4, 1.6, 0.35, 0, 2.2, 0, 6.5, 1);
      break;
    case 'factory':
      plat(6.4, 3, 2.4); block(4.4, 1.2, 1, 'block', 'barrels'); block(2.9, 0.9, 1, 'block', 'gears');
      saw(7.6, 10.2); laser(11.6, 5.2, 2); trap('spikes', 6.4, 1.2, 3.4, { t: 3.5 });
      Z.push(hz('conveyor', W * 0.41, 0, W * 0.18, 0.25));
      mover('piston', 13.4, 0, 1.2, 0.15, 0, 0, 1.2, 4.5);
      mover('slide', W / 2, 5.6, 2.2, 0.35, 2.6, 0, 0, 7, 0, false);
      break;
    case 'storm':
      plat(8.2, 3, 3.2); solid(W / 2 - 1.5, 5.8, 3, 0.4, 'float'); block(6.2, 0.9, 1, 'block', 'tomb'); block(13.8, 0.9, 1.2, 'block', 'gargoyle');
      trap('shock', 11.4, 1.8, 0); laser(13, 5.8, 2.7);
      both(8.2, x => Z.push(hz('wreck', x, H - 0.4, 0, 8.6, { t: x < W / 2 ? 0 : Math.PI })));
      mover('lift', 4.4, 1.5, 1.6, 0.35, 0, 2, 0, 6);
      break;
    case 'temple':
      block(6.8, 2, 1, 'block', 'altar'); plat(11.2, 3.3, 2.4); block(13.2, 1, 1, 'block', 'idol');
      trap('flame', 6.8, 0.8, 1, { period: 7 }); trap('spikes', 9.3, 1.6, 0, { t: 3 });
      mover('piston', W / 2, 0, 1.8, 0.15, 0, 0, 1.1, 6, 0, false);
      mover('lift', 4, 1.6, 1.5, 0.35, 0, 2, 0, 7, 2);
      break;
    case 'moon':
      block(8, 2.4, 0.9, 'block', 'boulder'); plat(12.8, 3.9, 2); block(5.9, 1, 1, 'block', 'lander');
      trap('spikes', 8, 1.6, 0.9); laser(11, 4.6, 1.5);
      mover('slide', W / 2, 6, 2.4, 0.35, 3, 0, 0, 9, 0, false);
      mover('lift', 4.2, 1.8, 1.6, 0.35, 0, 2.6, 0, 8);
      break;
    case 'subway':
      block(6.9, 1.8, 0.6, 'block', 'bench'); plat(10.4, 3.2, 3); block(12.9, 0.9, 1.3, 'block', 'vending');
      trap('shock', 8.9, 1.6, 0); laser(12, 4.6, 1.2);
      mover('slide', W / 2, 5.4, 2.4, 0.35, 2.8, 0, 0, 7, 0, false);
      break;
    case 'pit':
      block(7, 1.2, 1, 'block', 'brazier'); plat(5, 3.2, 2.2); block(3.4, 1.1, 1.2, 'block', 'cage'); trap('spikes', 9.4, 1.4, 0, { t: 1.5 });
      both(11.6, x => Z.push(hz('wreck', x, H - 0.4, 0, 8.4, { t: x < W / 2 ? 0 : Math.PI })));
      mover('lift', W / 2, 1.2, 2, 0.35, 0, 3.4, 0, 8, 0, false);
      break;
    case 'desert':
      block(6.6, 0.9, 1.5, 'block', 'cactus'); plat(9.6, 3.4, 2.6); block(12.6, 1.8, 0.8, 'block', 'ruin');
      trap('flame', 9.6, 0.9, 0, { t: 1.8 }); saw(10.8, 12.2, 2);
      mover('piston', 4.4, 0, 1.4, 0.15, 0, 0, 1.2, 5.5);
      break;
    case 'ocean':
      block(7, 1.8, 0.8, 'block', 'coral'); block(12.5, 1.3, 0.7, 'block', 'chest'); plat(9.4, 3.2, 2.4); block(2.9, 0.8, 1, 'block', 'anchor');
      trap('spikes', 4.6, 1.2, 0, { t: 2 }); both(10.6, x => Z.push(hz('mine', x, 5.2, 0.45, 0)));
      mover('lift', W / 2, 2, 2.2, 0.35, 0, 2.6, 0, 9, 0, false);
      break;
    case 'sky':
      plat(6.4, 2.8, 2.4); plat(10.6, 4.2, 2.6); block(12.8, 0.9, 1, 'block', 'urn'); block(5.5, 1.4, 0.5, 'block', 'fountain');
      laser(8.6, 4.6, 0.8); trap('spikes', 10.6, 1.4, 0, { t: 3 });
      mover('lift', 3.8, 1.5, 1.6, 0.35, 0, 2.6, 0, 6.5); mover('slide', W / 2, 6.6, 2.4, 0.35, 3, 0, 0, 8, 0, false);
      break;
    case 'coliseum':
      block(6.8, 1.4, 1.1, 'block', 'statue'); plat(10.8, 3.3, 2.6); block(4.2, 1, 1, 'block', 'rack');
      trap('spikes', 9, 1.6, 0); trap('flame', 12.6, 0.9, 0, { t: 2.2 });
      mover('piston', W / 2, 0, 1.8, 0.15, 0, 0, 1.2, 6, 0, false);
      Z.push(hz('wreck', W / 2, H - 0.4, 0, H - 3.4));
      break;
  }
  m.solids = S; m.hazards = Z;
}

export function newMatch(stage: StageId, chars: [CharId, CharId], cpuLevels: [number | null, number | null], rand: () => number = Math.random): Match {
  const m: Match = {
    stage, fighters: [newFighter(0, chars[0]), newFighter(1, chars[1])],
    ref: { x: W / 2, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0, stun: 0, stunKind: 'none', away: 0 },
    ball: { x: W / 2, y: TUBE_Y, vx: 0, vy: 0, spin: 0, kind: 'normal', kindT: 0, owner: null, fx: 'none', fxT: 0, frozen: 0, alive: false, respawn: 0, heat: 0 }, trail: [],
    phase: 'intro', phaseT: 0, time: 0, half: 1, clock: HALF_TIME, extra: false, extraT: 0, kickoffTeam: 0,
    solids: [], shots: [], fx: [], fatal: null, powerups: [], hazards: [], particles: [],
    nextPower: 14, nextBall: 30, nextHazard: 4, nextId: 1, lastGoal: null, winner: null,
    events: [], shake: 0, flash: 0, rand, gore: { drops: [], gibs: [], stains: [] },
    cpu: [cpuLevels[0] === null ? null : newCpu(cpuLevels[0]), cpuLevels[1] === null ? null : newCpu(cpuLevels[1])],
  };
  buildStage(m);
  resetKickoff(m);
  return m;
}
const newCpu = (level: number): CpuState => ({ level, think: 0, plan: noInput(), reactFatal: 0, kickHold: 0 });

// Todos a su lugar; la pelota baja por el tubo del medio.
function resetKickoff(m: Match) {
  const b = m.ball;
  b.alive = false; b.respawn = 0.5; b.x = W / 2; b.y = TUBE_Y; b.vx = 0; b.vy = 0; b.fx = 'none'; b.fxT = 0; b.frozen = 0; b.owner = null; b.heat = 0;
  m.trail = [];
  for (const f of m.fighters) {
    const left = defendsLeft(m, f.side);
    f.x = W / 2 + (left ? -1 : 1) * (f.side === m.kickoffTeam ? 2.2 : 3.6); f.y = supportAt(m, f.x, 10); f.vx = 0; f.vy = 0; f.ground = true; f.facing = left ? 1 : -1;
    f.action = 'idle'; f.stun = 0; f.stunKind = 'none'; f.kickT = 0; f.slideT = 0; f.abilityT = 0; f.burst = 0; f.taps = []; f.charge = 0; f.jumps = 0;
  }
  const r = m.ref; if (r.action !== 'gone') { r.x = W / 2 + 1; r.y = 0; r.vx = 0; r.vy = 0; r.action = 'idle'; r.stun = 0; }
  m.shots = []; m.fx = [];
}
// La pelota sale por el tubo.
// La pelota explota (solo cuando un poder la frena justo antes de entrar al arco propio) y al rato baja otra.
export function explodeBall(m: Match) {
  const b = m.ball; if (!b.alive) return;
  b.alive = false; b.respawn = 1.2; b.owner = null;
  burst(m, b.x, b.y, 30, '#fb923c', 'ember', 8); burst(m, b.x, b.y, 14, '#57534e', 'smoke', 3); burst(m, b.x, b.y, 1, '#fff7ed', 'ring', 1);
  for (let k = 0; k < 10; k++) m.particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 12, vy: Math.random() * 9, life: 1.2, max: 1.2, size: 0.08 + Math.random() * 0.06, color: k % 2 ? '#f8fafc' : '#111827', kind: 'shard' });
  m.shake = Math.max(m.shake, 0.6); m.flash = Math.max(m.flash, 0.3); m.trail = [];
  emit(m, { type: 'ballBoom' });
}
function dropBall(m: Match) {
  const b = m.ball;
  b.alive = true; b.x = W / 2; b.y = TUBE_Y; b.vx = (m.rand() - 0.5) * 3; b.vy = -2; b.spin = 0; b.kind = 'normal'; b.kindT = 0; b.fx = 'none'; b.fxT = 0; b.frozen = 0; b.owner = null; b.heat = 0;
  m.trail = [];
  burst(m, b.x, b.y, 10, '#e2e8f0', 'smoke', 2);
  emit(m, { type: 'ballDrop' });
}
// Una trampa (fuego, láser, sierra, lava, mina, meteorito) le pega a la pelota: no explota, sale despedida
// (prendida fuego si es fuego) y sigue en juego.
export function blastBall(m: Match, fromX: number, fromY: number, power: number, fire: boolean) {
  const b = m.ball; if (!b.alive || (m.fatal && !m.fatal.done)) return;
  let dx = b.x - fromX, dy = b.y - fromY; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (dy < 0.35) { dy = 0.35; } // siempre un poco para arriba
  const n = Math.hypot(dx, dy); b.vx = dx / n * power; b.vy = dy / n * power; b.owner = null; b.frozen = 0;
  if (fire) { b.fx = 'fire'; b.fxT = 1.4; }
  burst(m, b.x, b.y, 12, fire ? '#fb923c' : '#e2e8f0', fire ? 'ember' : 'spark', 5);
  emit(m, { type: 'bounce', power: 1 });
}

// ---------------------------------------------------------------- Un paso de la simulación
// Mueve los ascensores, las plataformas y los pistones; lo que está parado arriba (luchadores, árbitro, pelota)
// se mueve con ellos, y un pistón que sube con la pelota arriba la lanza.
export function moverAt(mv: Mover, t: number) {
  const a = (t / mv.period) * Math.PI * 2 + mv.phase;
  if (mv.kind === 'piston') { // abajo un rato, sube de golpe, queda arriba y baja
    const u = ((a / (Math.PI * 2)) % 1 + 1) % 1, k = u < 0.45 ? 0 : u < 0.52 ? (u - 0.45) / 0.07 : u < 0.8 ? 1 : u < 0.92 ? 1 - (u - 0.8) / 0.12 : 0;
    return { x: mv.x0, y: mv.y0, h: mv.h0 + mv.ah * k };
  }
  const k = Math.sin(a);
  return { x: mv.x0 + mv.ax * k, y: mv.y0 + mv.ay * (0.5 + 0.5 * k), h: mv.h0 };
}
function updateSolids(m: Match, dt: number) {
  for (const s of m.solids) {
    if (!s.move) continue;
    const top0 = s.y + s.h, x0 = s.x, p = moverAt(s.move, m.time);
    s.x = p.x; s.y = p.y; s.h = p.h;
    const top = s.y + s.h, dx = s.x - x0, dy = top - top0;
    if (dx === 0 && dy === 0) continue;
    const lo = Math.min(top0, top) - 0.08, hi = Math.max(top0, top) + 0.03;
    const carry = (b: { x: number; y: number; vy: number }, half: number) => {
      if (b.x + half - 0.1 > x0 && b.x - half + 0.1 < x0 + s.w && b.y >= lo && b.y <= hi && b.vy <= Math.max(0.5, dy / dt + 0.5)) { b.x = clamp(b.x + dx, 0.5, W - 0.5); b.y = top; if (dy > 0) b.vy = Math.max(b.vy, 0); return true; }
      return false;
    };
    for (const f of m.fighters) if (carry(f, PW / 2)) f.ground = true;
    if (m.ref.action !== 'gone') carry(m.ref, PW / 2);
    const b = m.ball;
    if (b.alive && b.x > x0 - BALL_R * 0.5 && b.x < x0 + s.w + BALL_R * 0.5 && b.y - BALL_R >= lo && b.y - BALL_R <= hi) {
      b.y = top + BALL_R; b.x += dx;
      if (dy > 0) b.vy = Math.max(b.vy, (s.move.kind === 'piston' ? 1.6 : 1) * dy / dt); // el pistón la lanza
    }
  }
}
export function step(m: Match, inputs: [Input, Input], dt: number) {
  m.time += dt; m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 2.5); m.flash = Math.max(0, m.flash - dt * 2); if (m.tint) { m.tint.t -= dt; if (m.tint.t <= 0) m.tint = undefined; }
  updateParticles(m, dt); updateGore(m, dt);
  m.fx = m.fx.filter(e => (e.t += dt) < e.life);
  if (m.netHit && (m.netHit.t += dt) > 3) m.netHit = undefined;
  if (m.phase !== 'fatal') updateSolids(m, dt);
  if (m.phase === 'intro') {
    idlePeople(m, dt);
    if (m.phaseT > 2.4) { m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff', start: m.half }); } // arranca un tiempo
    return;
  }
  if (m.phase === 'end') { idlePeople(m, dt); return; }
  if (m.phase === 'halftime') {
    idlePeople(m, dt);
    if (m.phaseT > 3.2) { m.half = 2; m.clock = HALF_TIME; m.kickoffTeam = 1; for (const f of m.fighters) f.stamina = STAMINA; resetKickoff(m); m.phase = 'intro'; m.phaseT = 0.8; }
    return;
  }
  if (m.phase === 'goal') {
    idlePeople(m, dt);
    if (m.ball.alive && m.netHit) { // la red atrapa la pelota: la frena y la lleva hasta el fondo del arco
      const b = m.ball, back = m.netHit.left ? GOAL_DEPTH * 0.42 : W - GOAL_DEPTH * 0.42;
      b.vx += (back - b.x) * 14 * dt; b.vx *= Math.max(0, 1 - 5 * dt);
    }
    if (m.ball.alive) moveBall(m, dt);
    if (m.phaseT > 2.8) {
      if (m.winner !== null) { m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      m.kickoffTeam = m.lastGoal?.side === 0 ? 1 : 0; resetKickoff(m); m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff' });
    }
    return;
  }
  if (m.phase === 'fatal') { if (m.phaseT > FATAL_CINE) { m.phase = 'play'; m.phaseT = 0; } return; }
  // --- jugando
  if (!m.extra) {
    m.clock = Math.max(0, m.clock - dt);
    if (m.clock <= 0) {
      m.fatal = null;
      if (m.half === 1) { m.phase = 'halftime'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'half' }); emit(m, { type: 'halftime' }); return; }
      const [a, b] = m.fighters;
      if (a.goals !== b.goals) { m.winner = a.goals > b.goals ? 0 : 1; m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      m.extra = true; m.extraT = 0; m.kickoffTeam = 0; emit(m, { type: 'extra' }); resetKickoff(m); m.phase = 'intro'; m.phaseT = 0.6;
      return;
    }
  } else m.extraT += dt;
  const b = m.ball;
  if (!b.alive) { b.respawn -= dt; if (b.respawn <= 0) dropBall(m); }
  const ins: [Input, Input] = [inputs[0], inputs[1]];
  for (const s of [0, 1] as const) { const c = m.cpu[s]; if (c) ins[s] = cpuHold(m, s, c, cpuThink(m, s, c, dt), dt); }
  for (const s of [0, 1] as const) updateFighter(m, m.fighters[s], ins[s], dt);
  fighterCollide(m);
  updateRef(m, dt);
  updateShots(m, dt);
  updateFatal(m, dt);
  if (m.phase !== 'play') return;
  updateHazards(m, dt);
  if (b.alive) { moveBall(m, dt); checkGoal(m); }
  // pelota trabada arriba/atrás del arco (sobre la red, contra la pared): al rato rebota bien alto hacia la cancha
  if (b.alive && m.phase === 'play') {
    let roof = false;
    for (const left of [true, false]) {
      const u = Math.abs(b.x - (left ? GOAL_DEPTH : W - GOAL_DEPTH)) / GOAL_DEPTH, over = left ? b.x < GOAL_DEPTH + BALL_R : b.x > W - GOAL_DEPTH - BALL_R;
      const top = netTop(goalHeight(m, teamAt(m, left)), Math.min(1, u));
      if (over && b.y >= top - 0.1 && b.y < top + 1.2 && Math.abs(b.vy) < 4) roof = true; // apoyada (no cuando pasa volando por arriba)
    }
    m.roofT = roof ? (m.roofT ?? 0) + dt : 0;
    if (m.roofT > 0.9) {
      m.roofT = 0; b.vx = Math.sign(W / 2 - b.x) * (6 + m.rand() * 3); b.vy = 13 + m.rand() * 3; b.owner = null;
      burst(m, b.x, b.y, 12, '#e2e8f0', 'spark', 4); emit(m, { type: 'bounce', power: 0.8 });
    }
  }
  // pelota trabada (quieta y lejos de todos un rato): salta hacia el medio
  if (b.alive && m.phase === 'play') {
    const near = m.fighters.some(f => Math.abs(f.x - b.x) < 2.5 && Math.abs(f.y - b.y) < 3);
    m.stillT = Math.hypot(b.vx, b.vy) < 0.6 && !near ? (m.stillT ?? 0) + dt : 0;
    if (m.stillT > 3.5) { m.stillT = 0; b.vx = Math.sign(W / 2 - b.x) * 6; b.vy = 9; b.owner = null; burst(m, b.x, b.y, 10, '#e2e8f0', 'smoke', 3); emit(m, { type: 'bounce', power: 0.6 }); }
  }
  updatePowerups(m, dt);
}

function gravityOf(m: Match) { return 30 * stageDef(m.stage).gravity; }
// Los luchadores tienen la gravedad de la Luna en todos los escenarios (saltos lentos y flotados); la pelota, el
// árbitro y lo demás siguen con la gravedad de cada escenario.
export const PLAYER_GRAVITY = 0.45;
const playerG = (m: Match) => PLAYER_GRAVITY / stageDef(m.stage).gravity; // la escala sobre la gravedad del escenario
// La superficie más alta debajo de (x, y): el piso o el techo de un bloque o plataforma.
export function supportAt(m: Match, x: number, y: number, half = PW / 2 - 0.1) {
  let top = 0;
  for (const s of m.solids) { const t = s.y + s.h; if (x + half > s.x && x - half < s.x + s.w && t <= y + 0.05 && t > top) top = t; }
  return top;
}
// Mueve un cuerpo con gravedad chocando contra los bloques (de costado) y apoyándose en bloques y plataformas.
function moveBody(m: Match, p: { x: number; y: number; vx: number; vy: number; ground: boolean }, dt: number, gScale = 1, ghost = false) {
  const px = p.x, py = p.y;
  p.vy -= gravityOf(m) * gScale * dt;
  p.x = clamp(p.x + p.vx * dt, 0.5, W - 0.5); p.y += p.vy * dt;
  const half = PW / 2;
  if (!ghost) for (const s of m.solids) {
    if (s.kind === 'float') continue;
    const top = s.y + s.h;
    if (p.y < top - 0.06 && p.y + bodyH(p) > s.y && p.x + half > s.x && p.x - half < s.x + s.w) { // de costado
      p.x = px <= s.x + s.w / 2 ? s.x - half : s.x + s.w + half; p.vx = 0;
    }
  }
  let ground = false;
  if (p.vy <= 0) for (const s of m.solids) {
    const top = s.y + s.h;
    if (p.x + half - 0.12 > s.x && p.x - half + 0.12 < s.x + s.w && py >= top - 0.03 && p.y <= top) {
      p.y = top; ground = true;
      if (s.kind === 'bouncy' && p.vy < -4) { p.vy = 15; ground = false; emit(m, { type: 'jump' }); } else p.vy = 0;
    }
  }
  if (p.y <= 0) { p.y = 0; p.vy = 0; ground = true; }
  if (p.y > H - bodyH(p)) { p.y = H - bodyH(p); p.vy = Math.min(0, p.vy); }
  p.ground = ground;
}
function idlePeople(m: Match, dt: number) {
  for (const f of m.fighters) {
    f.actionT += dt; f.vx *= Math.pow(0.02, dt); moveBody(m, f, dt, playerG(m));
    f.stamina = Math.min(STAMINA, f.stamina + dt * 20);
    if (m.phase === 'goal' && m.lastGoal) {
      const scorer = m.lastGoal.side === f.side;
      f.action = scorer ? 'celebrate' : 'sad';
      if (scorer && f.ground && m.phaseT > 0.3 && m.phaseT < 2.2) { f.vy = 7; f.ground = false; }
    } else if (m.phase === 'end' && m.winner !== null) f.action = m.winner === f.side ? 'celebrate' : 'sad';
    else if (m.phase === 'halftime') { f.action = 'run'; const d = defendsLeft(m, f.side) ? 1 : -1; f.facing = d; f.vx = d * 1.5; }
    else if (f.action !== 'fatal') f.action = 'idle';
  }
  const r = m.ref; r.actionT += dt;
  if (r.action === 'gone') { r.away -= dt; if (r.away <= 0) { r.action = 'idle'; r.x = m.rand() < 0.5 ? 2.2 : W - 2.2; r.y = 0; r.roam = undefined; emit(m, { type: 'refBack' }); } }
  else { moveBody(m, r, dt); r.vx *= Math.pow(0.02, dt); if (r.action !== 'down') r.action = m.phase === 'goal' || m.phase === 'halftime' || m.phase === 'end' ? 'whistle' : 'idle'; }
}

const pressed = (f: Fighter, i: Input, k: 'left' | 'right' | 'up' | 'down' | 'kick' | 'ability') => i[k] && !f.prev[k];
const busy = (f: Fighter) => f.stun > 0 || f.action === 'fatal' || f.slideT > 0 || (f.abilityT > 0 && (f.char === 'brutoRed' || f.char === 'aguila' || f.char === 'espectro'));
export const staminaFactor = (f: Fighter) => 0.45 + 0.55 * Math.min(1, f.stamina / STAMINA);
export const fatalReady = (f: Fighter) => f.power >= POWER_MAX;
export const abilityReady = (f: Fighter) => f.cd <= 0 && f.stamina >= CHARS[f.char].cost;
function gainPower(m: Match, f: Fighter, n: number) {
  const was = f.power;
  f.power = Math.min(POWER_MAX, f.power + n);
  if (was < POWER_MAX && f.power >= POWER_MAX) emit(m, { type: 'unlock', side: f.side });
}
function spend(f: Fighter, n: number) { f.stamina = Math.max(0, f.stamina - n); }

function updateFighter(m: Match, f: Fighter, i: Input, dt: number) {
  const def = CHARS[f.char], st = stageDef(m.stage), rival = m.fighters[f.side === 0 ? 1 : 0], dir = attackDir(m, f.side);
  f.actionT += dt;
  f.poison = Math.max(0, f.poison - dt); f.cd = Math.max(0, f.cd - dt); f.inv = Math.max(0, f.inv - dt);
  if (f.poison > 0) spend(f, dt * 5);
  for (const k of Object.keys(f.powers) as PowerKind[]) { const left = (f.powers[k] ?? 0) - dt; if (left <= 0) delete f.powers[k]; else f.powers[k] = left; }
  gainPower(m, f, dt * 0.25);
  if (f.stun > 0) { f.stun -= dt; if (f.stun <= 0) { f.stun = 0; f.stunKind = 'none'; f.action = 'idle'; f.inv = 0.8; } }
  const stunned = f.stun > 0;
  // --- combinación del FATAL: se anotan las flechas que se aprietan (relativas al arco rival)
  const tap = (d: 'F' | 'B' | 'U' | 'D') => { f.taps.push({ d, t: m.time }); if (f.taps.length > 6) f.taps.shift(); };
  if (pressed(f, i, 'right')) tap(dir > 0 ? 'F' : 'B');
  if (pressed(f, i, 'left')) tap(dir > 0 ? 'B' : 'F');
  if (pressed(f, i, 'down')) tap('D');
  if (pressed(f, i, 'up')) tap('U');
  f.taps = f.taps.filter(tp => m.time - tp.t < 1.1);
  // --- movimiento
  const turbo = (f.powers.speed ?? 0) > 0;
  let speed = 8.4 * def.speed * staminaFactor(f) * (turbo ? 1.3 : 1) * (f.poison > 0 ? 0.7 : 1);
  const cpu = m.cpu[f.side];
  if (cpu) speed *= 0.7 + cpu.level * 0.4;
  const blocking = !stunned && i.down && !i.kick && f.ground && f.kickT <= 0 && !busy(f) && Math.abs(f.vx) < 2.5;
  let want = 0;
  if (!stunned && !busy(f)) { if (i.left) want -= 1; if (i.right) want += 1; }
  if (blocking) want *= 0.15;
  if (f.charge > 0) want *= 0.5; // cargando el tiro camina despacio
  const accel = f.ground ? (st.friction < 1 ? 18 : 60) : 26;
  let gScale = 1;
  if (f.abilityT > 0) { // habilidades con movimiento propio
    f.abilityT -= dt;
    if (f.char === 'brutoRed') { f.vx = f.facing * 18; }
    else if (f.char === 'aguila') { f.vx = f.facing * 15; f.vy = 1.5; gScale = 0; }
    else if (f.char === 'espectro') { f.vx = f.facing * 20; f.vy = Math.max(f.vy, 0); gScale = 0; }
    if (f.abilityT <= 0 && f.action === 'special') f.action = 'idle';
  }
  if (f.slideT > 0) { f.slideT -= dt; f.vx *= Math.pow(0.15, dt); if (f.slideT <= 0) f.action = 'idle'; }
  else if (!stunned && !busy(f)) {
    const d = want * speed - f.vx, maxd = accel * dt;
    f.vx += clamp(d, -maxd, maxd);
    if (want !== 0 && f.kickT <= 0 && f.charge <= 0) f.facing = want > 0 ? 1 : -1;
  } else if (stunned) f.vx *= Math.pow(f.ground ? 0.05 : 0.6, dt);
  const sp = Math.abs(f.vx);
  // energía: se recupera descansando (quieto, parado en algo y sin que le peguen)
  if (f.ground && sp < 1 && !stunned && f.kickT <= 0 && f.charge <= 0 && f.abilityT <= 0) { f.restT += dt; if (f.restT > 0.35) f.stamina = Math.min(STAMINA, f.stamina + dt * 14 * def.rest); } else f.restT = 0;
  // salto
  // salto: cada vez que se aprieta ↑ salta (también en el aire): una vez salta, dos veces el doble de alto y
  // tres veces el triple. Al tocar el piso se vuelve a contar.
  if (f.ground) f.jumps = 0;
  if (!stunned && pressed(f, i, 'up') && !busy(f) && !i.kick && f.charge <= 0 && f.jumps < MAX_JUMPS) {
    const v = 11.5 * def.jump * (0.8 + 0.2 * staminaFactor(f)) * (turbo ? 1.1 : 1) * Math.sqrt(PLAYER_GRAVITY);
    if (f.ground || f.jumps === 0) { f.vy = v; f.jumps = 1; } // en el aire sin haber saltado (cayendo de un borde) cuenta como el primero
    else { f.vy = Math.max(f.vy, 0) * 0.3 + v; f.jumps++; burst(m, f.x, f.y, 10, '#e2e8f0', 'smoke', 2.5); burst(m, f.x, f.y, 1, CHARS[f.char].glow, 'ring', 1); }
    f.ground = false; emit(m, { type: 'jump' });
  }
  moveBody(m, f, dt, gScale * playerG(m), f.char === 'espectro' && f.abilityT > 0);
  // --- patadas
  if (f.kickT > 0) {
    f.kickT -= dt;
    const k = 0.3 - f.kickT;
    if (!f.kickHit && k > 0.03 && k < 0.2) doKick(m, f, rival);
    if (f.kickT <= 0) { f.kickT = 0; if (f.action === 'kick') f.action = 'idle'; }
  }
  if (f.slideT > 0 && !f.kickHit) doSlide(m, f, rival);
  if (!busy(f) && !stunned) {
    const kickNow = pressed(f, i, 'kick');
    const comboFatal = kickNow && comboDone(f);
    const wantFatal = i.cast === 'fatal' || (comboFatal && fatalReady(f));
    const combo = kickNow && !comboFatal ? abilityCombo(f, m.time) : 0; // adelante, adelante + espacio
    if (wantFatal && fatalReady(f) && !m.fatal && m.ball.alive && !hasBall(m, f)) { if (i.cast === 'fatal' || comboFatal) emit(m, { type: 'needBall', side: f.side }); f.taps = []; }
    else if (wantFatal && fatalReady(f) && !m.fatal && m.ball.alive) { f.power = 0; f.taps = []; f.charge = 0; startFatal(m, f); }
    else if (i.cast === 'ability' || combo !== 0) {
      if (combo !== 0) { f.facing = (combo === 1 ? dir : -dir) as 1 | -1; f.taps = []; }
      f.charge = 0;
      if (abilityReady(f)) castAbility(m, f, rival);
      else if (f.cd <= 0) emit(m, { type: 'noEnergy', side: f.side });
    } else if (kickNow && f.kickT <= 0) {
      if (i.down && f.ground && sp > 3.5) { f.slideT = 0.5; f.vx = f.facing * Math.max(sp, 7); f.action = 'slide'; f.actionT = 0; f.kickHit = false; }
      else { f.charge = 0.001; f.action = 'charge'; f.actionT = 0; } // empieza a cargar: patea al soltar
    } else if (f.charge > 0) {
      if (i.kick && f.kickT <= 0) f.charge = Math.min(CHARGE_MAX, f.charge + dt);
      else { // soltó la barra: la fuerza depende de cuánto la sostuvo
        f.kickPow = kickMult(f.charge); f.charge = 0;
        { const bx = m.ball.x - f.x; if (m.ball.alive && Math.abs(bx) < 1.3 && Math.sign(bx) !== f.facing && m.ball.y < f.y + 1.6) f.facing = (Math.sign(bx) || f.facing) as 1 | -1; } // si la pelota quedó atrás, se da vuelta para patearla
        f.kickT = 0.3; f.kickHit = false; f.kickKind = i.up ? 'lob' : i.down ? 'low' : 'normal'; f.action = 'kick'; f.actionT = 0;
        if (f.kickPow > 1.2) emit(m, { type: 'charged', side: f.side, power: f.kickPow });
      }
    }
  }
  // ráfaga del Orbot: los disparos que quedan
  if (f.burst > 0) { f.burstT -= dt; if (f.burstT <= 0) { f.burst--; f.burstT = 0.13; fireShot(m, f, 'bullet', 26, 0.14, 0); } }
  // habilidades que pegan con el cuerpo
  if (f.abilityT > 0 && (f.char === 'brutoRed' || f.char === 'aguila' || f.char === 'espectro' || f.char === 'cometa')) bodyAbility(m, f, rival);
  if (f.charge > 0 && !stunned && f.action !== 'fatal') f.action = 'charge';
  else if (!stunned && f.action !== 'fatal' && f.action !== 'special' && f.kickT <= 0 && f.slideT <= 0)
    f.action = blocking ? 'block' : !f.ground ? 'jump' : f.stamina < 15 && sp < 1 ? 'tired' : sp > 0.8 ? 'run' : 'idle';
  if (f.action === 'special' && f.actionT > 0.45 && f.abilityT <= 0) f.action = 'idle';
  if (f.action === 'fatal' && m.phase === 'play' && m.fatal === null) f.action = 'idle';
  if (f.headT > 0) { f.headT -= dt; if (!stunned && f.action !== 'fatal' && f.action !== 'special') f.action = 'header'; }
  if (stunned) f.action = 'stun';
  // conducción: corriendo con la pelota pegada al pie, la lleva (se puede gambetear)
  { const bl = m.ball, ahead = (bl.x - f.x) * f.facing;
    if (bl.alive && f.ground && !stunned && f.kickT <= 0 && f.charge <= 0 && Math.abs(f.vx) > 1.5 && Math.sign(f.vx) === f.facing && !(m.cpu[f.side] && f.facing !== dir) && ahead > 0.2 && ahead < 0.95 && bl.y < f.y + BALL_R + 0.25 && Math.abs(bl.vx - f.vx) < 5 && !(m.fatal && !m.fatal.done)) {
      bl.vx += (f.vx * 1.08 + f.facing * 0.3 - bl.vx) * Math.min(1, dt * 12); bl.owner = f.side;
    } }
  // imán
  const b = m.ball;
  if ((f.powers.magnet ?? 0) > 0 && b.alive) { const dx = f.x + f.facing * 0.5 - b.x, dy = f.y + 0.5 - b.y, d = Math.hypot(dx, dy); if (d < 5 && d > 0.5) { b.vx += dx / d * 14 * dt; b.vy += dy / d * 14 * dt; } }
  f.prev = { ...i, cast: null };
}
// Habilidad: dos veces la misma flecha (adelante, adelante) y enseguida espacio. Devuelve 1 (hacia el arco rival),
// -1 (hacia atrás) o 0 si no se hizo la combinación.
function abilityCombo(f: Fighter, now: number): 0 | 1 | -1 {
  const h = f.taps.filter(t => t.d === 'F' || t.d === 'B');
  if (h.length < 2) return 0;
  const a = h[h.length - 2], b = h[h.length - 1];
  if (a.d !== b.d || b.t - a.t > 0.45 || now - b.t > 0.5) return 0;
  return b.d === 'F' ? 1 : -1;
}
// ¿Terminó de apretar la combinación del FATAL (adelante, atrás, adelante)?
function comboDone(f: Fighter) {
  const seq = f.taps.map(t => t.d), c = FATAL_COMBO;
  return c.length <= seq.length && c.every((d, k) => seq[seq.length - c.length + k] === d);
}

// La patada: si el pie llega a la pelota, sale hacia donde mira (globo con ↑, rasante con ↓). Si en vez de la
// pelota alcanza al rival (o al árbitro), lo voltea (sin gastarle energía).
function doKick(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball, def = CHARS[f.char];
  const fx = f.x + f.facing * 0.56, fy = f.y + (f.ground ? 0.45 : 0.8);
  if (b.alive && Math.hypot(b.x - fx, b.y - fy) < 1.18 && !(m.fatal && !m.fatal.done)) {
    let power = 17 * def.power * f.kickPow * (0.75 + 0.25 * staminaFactor(f)) * ((f.powers.power ?? 0) > 0 ? 1.4 : 1);
    let ang = f.kickKind === 'lob' ? 0.9 : f.kickKind === 'low' ? 0.05 : 0.3;
    if (!f.ground) ang = f.kickKind === 'lob' ? 0.55 : b.y > f.y + 1.2 ? -0.2 : 0.12;
    if (b.kind === 'fire') power *= 1.2;
    if (b.frozen > 0) { b.frozen = 0; power *= 1.1; }
    b.vx = Math.cos(ang) * power * f.facing; b.vy = Math.sin(ang) * power + (f.kickKind === 'lob' ? 2 : 0);
    b.spin = f.facing * (f.kickKind === 'low' ? 4 : -8); b.owner = f.side; b.pass = { side: f.side, t: 0.2 };
    f.kickHit = true; gainPower(m, f, 1);
    burst(m, b.x, b.y, 6, '#ffffff', 'spark', 3);
    emit(m, { type: 'kick', power: power / 20 });
    return;
  }
  if (Math.abs(rival.x - (f.x + f.facing * 0.6)) < 0.8 && Math.abs(rival.y + heightOf(rival) / 2 - (f.y + 0.9)) < 1.3) {
    f.kickHit = true;
    if (rival.action === 'block' && rival.facing === -f.facing) { rival.vx = f.facing * 3; gainPower(m, rival, 2); emit(m, { type: 'block' }); burst(m, rival.x - f.facing * 0.3, rival.y + 1, 8, '#93c5fd', 'spark', 3); return; }
    hurtFighter(m, rival, f, 'hit', 0.6, 7, 0);
    return;
  }
  const r = m.ref;
  if (r.action !== 'gone' && Math.abs(r.x - (f.x + f.facing * 0.6)) < 0.8 && Math.abs(r.y - f.y) < 1.2) { f.kickHit = true; hurtRef(m, 'hit', 1.4); }
}
// Barrida: le saca la pelota al rival y lo hace caer.
function doSlide(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball;
  if (b.alive && Math.abs(b.x - (f.x + f.facing * 0.5)) < 0.8 && b.y < f.y + 1) { b.vx = f.facing * 9 + f.vx * 0.3; b.vy = 2.5; b.owner = f.side; f.kickHit = true; emit(m, { type: 'kick', power: 0.5 }); }
  if (rival.stun <= 0 && rival.ground && Math.abs(rival.x - (f.x + f.facing * 0.5)) < 0.8 && Math.abs(rival.y - f.y) < 0.5) { f.kickHit = true; hurtFighter(m, rival, f, 'hit', 0.9, 4, 0); }
}
// Un luchador recibe un golpe: queda volteado un rato y pierde la energía indicada (salvo que tenga escudo).
function hurtFighter(m: Match, f: Fighter, by: Fighter | null, kind: StunKind, time: number, push: number, drain: number) {
  if (f.char === 'espectro' && f.abilityT > 0) return; // en fase no lo toca nada
  if ((f.powers.shield ?? 0) > 0) { emit(m, { type: 'block' }); burst(m, f.x, f.y + 1, 10, '#38bdf8', 'ring', 1); return; }
  if (f.action === 'fatal' || f.inv > 0) return;
  if (by) { const c = CHARS[by.char]; burst(m, f.x, f.y + heightOf(f) * 0.6, 24, c.glow, 'spark', 9); burst(m, f.x, f.y + heightOf(f) * 0.6, 1, c.color, 'ring', 1); m.tint = { c: c.glow, t: 0.3 }; m.shake = Math.max(m.shake, 0.45); }
  f.stun = Math.max(f.stun, time); f.stunKind = kind; f.action = 'stun'; f.kickT = 0; f.slideT = 0; f.abilityT = 0; f.charge = 0;
  if (push) { const d = by ? Math.sign(f.x - by.x) || -by.facing : (f.x < W / 2 ? 1 : -1); f.vx = d * push; if (kind !== 'freeze') { f.vy = push * 0.55; f.ground = false; } }
  if (kind === 'freeze') f.vx = 0;
  if (kind === 'poison') f.poison = 2.5;
  spend(f, drain);
  gainPower(m, f, 1); if (by) gainPower(m, by, 1.5);
  m.shake = Math.max(m.shake, 0.4);
  fxBurst(m, f.x, f.y + 1.1, kind);
  emit(m, { type: 'hit', who: 'fighter', kind });
  if (f.stamina <= 0) emit(m, { type: 'tired', side: f.side });
}
function fxBurst(m: Match, x: number, y: number, kind: StunKind) {
  const color = kind === 'freeze' ? '#bae6fd' : kind === 'poison' ? '#86efac' : kind === 'burn' ? '#fb923c' : kind === 'zap' ? '#fde047' : '#ffffff';
  burst(m, x, y, 12, color, kind === 'freeze' ? 'shard' : kind === 'poison' ? 'bubble' : kind === 'burn' ? 'ember' : 'spark', 5);
  if (kind === 'hit') burst(m, x, y, 6, '#b91c1c', 'blood', 3);
}
// El árbitro alcanzado (por una patada, un poder o una trampa).
// Cualquier daño (trampa o ataque) hace reventar al árbitro: sangre por todos lados y los huesos que saltan.
// A los segundos entra otro árbitro.
function hurtRef(m: Match, kind: StunKind, time: number) {
  const r = m.ref;
  if (r.action === 'gone') return;
  void time;
  fxBurst(m, r.x, r.y + 1, kind);
  explodeRef(m);
  emit(m, { type: 'hit', who: 'ref', kind }); emit(m, { type: 'refDown' });
}
function explodeRef(m: Match) {
  const r = m.ref, g = m.gore, cx = r.x, cy = r.y + PH * 0.55, rnd = Math.random;
  r.action = 'gone'; r.away = 3.5; r.stun = 0; r.vx = 0; r.vy = 0;
  m.shake = Math.max(m.shake, 0.9); m.flash = Math.max(m.flash, 0.25);
  burst(m, cx, cy, 24, '#b91c1c', 'blood', 9); burst(m, cx, cy, 1, '#fee2e2', 'ring', 1);
  for (const [n, power, size] of [[110, 9, 0.05], [50, 4.5, 0.08], [60, 14, 0.03]] as const) for (let i = 0; i < n && g.drops.length < 400; i++) {
    const a = rnd() * Math.PI * 2, sp = power * (0.3 + rnd() * 0.9);
    g.drops.push({ x: cx + (rnd() - 0.5) * 0.4, y: cy + (rnd() - 0.5) * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + power * 0.45, r: size * (0.5 + rnd()), life: 0 });
  }
  const kinds: GibKind[] = ['skull', 'jaw', 'ribs', 'pelvis', 'bone', 'bone', 'bone', 'bone', 'chunk', 'chunk', 'chunk', 'shirt'];
  for (const kind of kinds) { const a = rnd() * Math.PI * 2, sp = 4 + rnd() * 7; g.gibs.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 4, a: rnd() * 6, va: (rnd() - 0.5) * 20, kind, life: 0, drip: 0 }); }
  emit(m, { type: 'refBoom' });
}
// Las gotas caen y manchan el piso (o lo que tengan abajo); los huesos rebotan, giran y van chorreando.
function updateGore(m: Match, dt: number) {
  const g = m.gore; if (!g.drops.length && !g.gibs.length) return;
  const grav = gravityOf(m) * 0.9, top = (x: number, y: number) => supportAt(m, x, y + 0.01, 0.02);
  for (const d of g.drops) {
    d.life += dt; d.vy -= grav * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < 0 || d.x > W) d.life = 99;
    const t = top(d.x, d.y - d.vy * dt);
    if (d.y <= t && d.vy < 0) { if (g.stains.length < 160) g.stains.push({ x: d.x, y: t, r: d.r * (2 + Math.random() * 1.5), at: m.time, seed: Math.random() }); d.life = 99; }
  }
  g.drops = g.drops.filter(d => d.life < 4);
  for (const b of g.gibs) {
    b.life += dt; b.vy -= grav * 0.85 * dt; b.a += b.va * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0.3 || b.x > W - 0.3) { b.x = clamp(b.x, 0.3, W - 0.3); b.vx *= -0.5; }
    const t = top(b.x, b.y - b.vy * dt);
    if (b.y <= t + 0.08 && b.vy < 0) { if (Math.abs(b.vy) > 3 && g.stains.length < 160) g.stains.push({ x: b.x, y: t, r: 0.18, at: m.time, seed: Math.random() }); b.y = t + 0.08; b.vy *= -0.35; b.vx *= 0.6; b.va *= 0.6; }
    if ((b.drip -= dt) <= 0 && Math.hypot(b.vx, b.vy) > 1.5 && b.life < 2.5 && g.drops.length < 400) { b.drip = 0.04; g.drops.push({ x: b.x, y: b.y, vx: b.vx * 0.2 + (Math.random() - 0.5), vy: b.vy * 0.2, r: 0.03 + Math.random() * 0.03, life: 0 }); }
  }
  g.gibs = g.gibs.filter(b => b.life < 9);
  g.stains = g.stains.filter(st => m.time - st.at < 40);
}
const refIn = (m: Match, x0: number, x1: number, y0: number, y1: number) => { const r = m.ref; return r.action !== 'gone' && r.x + PW / 2 > x0 && r.x - PW / 2 < x1 && r.y < y1 && r.y + PH > y0; };

// ---------------------------------------------------------------- Habilidades
// Empujón a la pelota desde una habilidad: si era el FATAL GOAL del rival, lo frena.
function pushBall(m: Match, f: Fighter, vx: number, vy: number, fx: Ball['fx'] = 'none') {
  const b = m.ball; if (!b.alive) return;
  if (m.fatal && !m.fatal.done) { if (m.fatal.side !== f.side) blockFatal(m, f.side); return; } // frenó el FATAL: la pelota sale rebotada
  // la pelota estaba por entrar al arco propio: el poder la hace explotar (y baja otra por el tubo)
  const home = ownGoalX(m, f.side), out = attackDir(m, f.side);
  if (Math.abs(b.x - home) < 5 && Math.sign(b.vx) === -out && Math.abs(b.vx) > 2 && b.y < goalHeight(m, f.side) + 1.5) { explodeBall(m); emit(m, { type: 'save', side: f.side }); gainPower(m, f, 1); return; }
  // un poder nunca mete la pelota en el arco propio: en la mitad propia la despeja para arriba y afuera
  if (Math.sign(vx) === -out && Math.abs(b.x - home) < W * 0.5) { vx = out * Math.max(Math.abs(vx) * 0.75, 9); vy = Math.max(vy, 6); }
  b.vx = vx; b.vy = vy; b.owner = f.side; b.frozen = 0; b.pass = { side: f.side, t: 0.3 };
  if (fx !== 'none') { b.fx = fx; b.fxT = 1.2; }
  gainPower(m, f, 1);
  // si la pelota iba a entrar al arco propio y la sacó, es una salvada
  const own = ownGoalX(m, f.side);
  if (Math.abs(b.x - own) < 6 && Math.sign(vx) === attackDir(m, f.side)) emit(m, { type: 'save', side: f.side });
  burst(m, b.x, b.y, 22, CHARS[f.char].glow, 'spark', 8); burst(m, b.x, b.y, 1, CHARS[f.char].color, 'ring', 1); m.shake = Math.max(m.shake, 0.3);
  emit(m, { type: 'kick', power: Math.hypot(vx, vy) / 20 });
}
// Hacia dónde apunta: a la pelota si la tiene adelante (más o menos), si no derecho.
function aim(m: Match, f: Fighter, x0: number, y0: number, range: number): [number, number] {
  const b = m.ball;
  if (b.alive) { const dx = b.x - x0, dy = b.y - y0, d = Math.hypot(dx, dy); if (d < range && dx * f.facing > 0 && Math.abs(dy) < Math.abs(dx) * 2.2 + 1.5) return [dx / d, dy / d]; }
  return [f.facing, 0];
}
function fireShot(m: Match, f: Fighter, kind: ShotKind, speed: number, r: number, spread: number) {
  const x0 = f.x + f.facing * 0.55, y0 = f.y + 1.15;
  let [ax, ay] = aim(m, f, x0, y0, 14);
  if (spread) { const a = Math.atan2(ay, ax) + spread; ax = Math.cos(a); ay = Math.sin(a); }
  m.shots.push({ kind, side: f.side, x: x0, y: y0, vx: ax * speed, vy: ay * speed, r, t: 0, life: kind === 'bomb' ? 0.9 : kind === 'bubble' ? 1 : 1.2, done: false });
}
function castAbility(m: Match, f: Fighter, rival: Fighter) {
  const def = CHARS[f.char], b = m.ball;
  spend(f, def.cost); f.cd = def.cd; f.action = 'special'; f.actionT = 0; f.abilityHit = false;
  emit(m, { type: 'ability', side: f.side, char: f.char });
  // que se note: chispas del color del luchador, un anillo, la pantalla que se tiñe y un sacudón
  const cxh = f.x + f.facing * 0.7, cyh = f.y + heightOf(f) * 0.55;
  burst(m, cxh, cyh, 28, def.glow, 'spark', 8); burst(m, cxh, cyh, 10, def.color, 'ember', 5); burst(m, cxh, cyh, 1, def.glow, 'ring', 1); burst(m, f.x, f.y + 0.1, 8, def.glow, 'smoke', 2.5);
  m.tint = { c: def.glow, t: 0.35 }; m.shake = Math.max(m.shake, 0.25);
  const hx = f.x + f.facing * 0.5, hy = f.y + 1.15;
  switch (def.ability) {
    case 'superJump': f.vy = 19 * Math.sqrt(PLAYER_GRAVITY); f.ground = false; f.abilityT = 0.9; burst(m, f.x, f.y, 16, '#bae6fd', 'smoke', 3); break;
    case 'fireball': fireShot(m, f, 'fireball', 18, 0.32, 0); break;
    case 'shuriken': fireShot(m, f, 'shuriken', 24, 0.2, 0); break;
    case 'bomb': fireShot(m, f, 'bomb', 20, 0.22, 0); break;
    case 'burst': f.burst = 2; f.burstT = 0.13; fireShot(m, f, 'bullet', 26, 0.14, 0); break;
    case 'feathers': for (const a of [-0.16, 0, 0.16]) fireShot(m, f, 'feather', 20, 0.16, a); break;
    case 'toxicCloud': fireShot(m, f, 'bubble', 12, 0.32, 0); break;
    case 'charge': f.abilityT = 0.55; burst(m, f.x, f.y + 0.9, 14, '#fb923c', 'ember', 4); break;
    case 'flight': f.abilityT = 1; f.ground = false; burst(m, f.x, f.y + 1, 12, '#fde68a', 'spark', 4); break;
    case 'phase': f.abilityT = 0.7; burst(m, f.x, f.y + 1, 16, '#a5f3fc', 'smoke', 2); break;
    case 'lightning': case 'beam': {
      const range = def.ability === 'beam' ? 16 : 11, [ax, ay] = aim(m, f, hx, hy, range);
      const x2 = hx + ax * range, y2 = hy + ay * range;
      m.fx.push({ kind: def.ability === 'beam' ? 'beam' : 'bolt', side: f.side, x: hx, y: hy, x2, y2, t: 0, life: def.ability === 'beam' ? 0.45 : 0.3, dir: f.facing, hit: 0 });
      const near = (px: number, py: number, r: number) => { const t = clamp(((px - hx) * ax + (py - hy) * ay) / range, 0, 1); return Math.hypot(hx + ax * range * t - px, hy + ay * range * t - py) < r; };
      const power = def.ability === 'beam' ? 22 : 19;
      if (b.alive && near(b.x, b.y, 0.7)) pushBall(m, f, ax * power, ay * power + 3, 'volt');
      if (near(rival.x, rival.y + 1, 0.9)) hurtFighter(m, rival, f, 'zap', def.ability === 'beam' ? 1.1 : 0.9, 4, def.ability === 'beam' ? 22 : 18);
      if (near(m.ref.x, m.ref.y + 1, 0.9)) hurtRef(m, 'zap', 1.3);
      for (const h of m.hazards) if (h.kind === 'mine' && h.state === 0 && near(h.x, h.y, 0.7)) mineBoom(m, h);
      break;
    }
    case 'freeze': {
      const R = 5.5;
      m.fx.push({ kind: 'nova', side: f.side, x: f.x, y: f.y + 1, x2: 0, y2: 0, t: 0, life: 0.7, dir: f.facing, hit: 0 });
      if (b.alive && Math.hypot(b.x - f.x, b.y - f.y - 1) < R) {
        if (m.fatal && !m.fatal.done && m.fatal.side !== f.side) blockFatal(m, f.side);
        b.vx = 0; b.vy = 0; b.frozen = 1.6; b.fx = 'ice'; b.fxT = 1.6; burst(m, b.x, b.y, 14, '#e0f2fe', 'shard', 4);
        if (Math.abs(b.x - ownGoalX(m, f.side)) < 6) emit(m, { type: 'save', side: f.side });
      }
      if (Math.hypot(rival.x - f.x, rival.y - f.y) < R) hurtFighter(m, rival, f, 'freeze', 1.6, 0, 15);
      if (Math.hypot(m.ref.x - f.x, m.ref.y - f.y) < R) hurtRef(m, 'freeze', 1.6);
      break;
    }
    case 'quake': {
      const R = 4.6;
      m.fx.push({ kind: 'quake', side: f.side, x: f.x, y: f.y, x2: 0, y2: 0, t: 0, life: 0.6, dir: f.facing, hit: 0 });
      m.shake = Math.max(m.shake, 0.8);
      if (b.alive && Math.abs(b.x - f.x) < R && b.y - f.y < 2) { const d = Math.sign(b.x - f.x) || f.facing; pushBall(m, f, d * 10, 15); }
      if (Math.abs(rival.x - f.x) < R && rival.ground && Math.abs(rival.y - f.y) < 1) hurtFighter(m, rival, f, 'hit', 1.2, 6, 18);
      if (Math.abs(m.ref.x - f.x) < R && m.ref.ground) hurtRef(m, 'hit', 1.4);
      break;
    }
    case 'magmaSpikes': m.fx.push({ kind: 'magma', side: f.side, x: f.x + f.facing * 0.6, y: 0, x2: 0, y2: 0, t: 0, life: 0.85, dir: f.facing, hit: 0 }); break;
    case 'laserCut': {
      const R = 2.5;
      m.fx.push({ kind: 'slash', side: f.side, x: f.x, y: f.y + 1.1, x2: 0, y2: 0, t: 0, life: 0.28, dir: f.facing, hit: 0 });
      const inArc = (px: number, py: number) => { const dx = (px - f.x) * f.facing, dy = py - (f.y + 1.1); return dx > -0.3 && Math.hypot(dx, dy) < R; };
      if (b.alive && inArc(b.x, b.y)) pushBall(m, f, f.facing * 20, 6, 'volt');
      if (inArc(rival.x, rival.y + 1)) hurtFighter(m, rival, f, 'hit', 1, 7, 18);
      if (inArc(m.ref.x, m.ref.y + 1)) hurtRef(m, 'hit', 1.4);
      break;
    }
  }
}
// Las habilidades que pegan con el cuerpo: salto potenciado, embestida, vuelo y fase.
function bodyAbility(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball;
  if (b.alive && !f.abilityHit && Math.hypot(b.x - (f.x + f.facing * 0.3), b.y - (f.y + 0.9)) < 1.2) {
    f.abilityHit = true;
    const power = f.char === 'brutoRed' ? 21 : f.char === 'aguila' ? 20 : f.char === 'cometa' ? 20 : 18;
    pushBall(m, f, f.facing * power, f.char === 'cometa' ? 4 : 5, f.char === 'brutoRed' ? 'fire' : f.char === 'aguila' ? 'volt' : 'none');
    if (f.char === 'brutoRed') f.abilityT = Math.min(f.abilityT, 0.05);
  }
  if (f.char !== 'espectro' && rival.stun <= 0 && Math.abs(rival.x - f.x) < 0.9 && Math.abs(rival.y - f.y) < 1.4) hurtFighter(m, rival, f, f.char === 'brutoRed' ? 'burn' : 'hit', 1.2, 10, 20);
  if (f.char !== 'espectro' && Math.abs(m.ref.x - f.x) < 0.8 && Math.abs(m.ref.y - f.y) < 1.4) hurtRef(m, f.char === 'brutoRed' ? 'burn' : 'hit', 1.4);
}

// Proyectiles, nubes y picos de magma.
function updateShots(m: Match, dt: number) {
  const b = m.ball;
  for (const s of m.shots) {
    s.t += dt;
    const owner = m.fighters[s.side], rival = m.fighters[s.side === 0 ? 1 : 0];
    if (s.kind === 'bubble') s.vy -= 4 * dt;
    // un poquito de puntería: las estrellas ninja siguen la pelota
    if ((s.kind === 'shuriken' || s.kind === 'fireball') && b.alive && s.t < 0.5) { const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy); if (d < 6 && dx * s.vx > 0) { const sp = Math.hypot(s.vx, s.vy); s.vx += (dx / d * sp - s.vx) * dt * 4; s.vy += (dy / d * sp - s.vy) * dt * 4; } }
    s.x += s.vx * dt; s.y += s.vy * dt;
    const end = () => { s.done = true; if (s.kind === 'bomb') explodeAt(m, owner, s.x, s.y, 2.2); if (s.kind === 'bubble') cloudAt(m, owner, s.x, s.y); };
    // la pelota
    if (b.alive && Math.hypot(b.x - s.x, b.y - s.y) < BALL_R + s.r) {
      const sp = Math.hypot(s.vx, s.vy), ux = s.vx / sp, uy = s.vy / sp;
      const power = s.kind === 'fireball' ? 18 : s.kind === 'shuriken' ? 14 : s.kind === 'bullet' ? 9 : s.kind === 'feather' ? 8 : 0;
      if (power) pushBall(m, owner, b.vx * 0.2 + ux * power, Math.max(b.vy * 0.2 + uy * power, 0) + 3, s.kind === 'fireball' ? 'fire' : s.kind === 'feather' ? 'toxic' : 'none');
      end(); continue;
    }
    // el rival
    if (Math.abs(rival.x - s.x) < PW / 2 + s.r && s.y > rival.y && s.y < rival.y + heightOf(rival)) {
      const k: StunKind = s.kind === 'fireball' ? 'burn' : s.kind === 'feather' ? 'poison' : s.kind === 'bubble' ? 'poison' : 'hit';
      if (s.kind !== 'bomb' && s.kind !== 'bubble') hurtFighter(m, rival, owner, k, s.kind === 'bullet' ? 0.35 : 0.8, s.kind === 'bullet' ? 2 : 5, s.kind === 'fireball' ? 18 : s.kind === 'bullet' ? 7 : s.kind === 'feather' ? 9 : 12);
      end(); continue;
    }
    if (refIn(m, s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r)) { if (s.kind !== 'bomb' && s.kind !== 'bubble') hurtRef(m, s.kind === 'fireball' ? 'burn' : 'hit', 1.3); end(); continue; }
    for (const h of m.hazards) if (h.kind === 'mine' && h.state === 0 && Math.hypot(h.x - s.x, h.y - s.y) < h.w + s.r) { mineBoom(m, h); end(); }
    // paredes, piso y bloques
    if (!s.done && (s.y < 0.1 || s.x < 0 || s.x > W || s.y > H || s.t > s.life || m.solids.some(o => s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h))) end();
    if (s.kind === 'fireball' && Math.random() < 0.8) m.particles.push({ x: s.x, y: s.y, vx: -s.vx * 0.1 + (Math.random() - 0.5), vy: (Math.random() - 0.5) + 1, life: 0.35, max: 0.35, size: 0.12, color: '#fb923c', kind: 'ember' });
  }
  m.shots = m.shots.filter(s => !s.done);
  // nubes tóxicas: frenan la pelota y envenenan; picos de magma que avanzan por el piso
  for (const e of m.fx) {
    const owner = m.fighters[e.side], rival = m.fighters[e.side === 0 ? 1 : 0];
    if (e.kind === 'cloud') {
      const R = 2.2 * Math.min(1, e.t * 4);
      if (b.alive && Math.hypot(b.x - e.x, b.y - e.y) < R) {
        if (m.fatal && !m.fatal.done && m.fatal.side !== e.side) blockFatal(m, e.side);
        b.vx *= Math.pow(0.03, dt); b.vy *= Math.pow(0.2, dt);
      }
      if (Math.hypot(rival.x - e.x, rival.y + 1 - e.y) < R && rival.poison < 0.5) hurtFighter(m, rival, owner, 'poison', 0.4, 0, 10);
    }
    if (e.kind === 'magma') {
      const x = e.x + e.dir * e.t * 14;
      if (b.alive && !(e.hit & 1) && Math.abs(b.x - x) < 0.9 && b.y < 1.6) { e.hit |= 1; pushBall(m, owner, e.dir * 10, 14, 'fire'); }
      if (!(e.hit & 2) && Math.abs(rival.x - x) < 0.8 && rival.y < 1) { e.hit |= 2; hurtFighter(m, rival, owner, 'burn', 1, 5, 18); }
      if (!(e.hit & 4) && refIn(m, x - 0.5, x + 0.5, 0, 1)) { e.hit |= 4; hurtRef(m, 'burn', 1.3); }
      if (Math.random() < 0.7) m.particles.push({ x, y: 0.2, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 3, life: 0.5, max: 0.5, size: 0.1, color: '#fb923c', kind: 'ember' });
    }
  }
}
function explodeAt(m: Match, owner: Fighter, x: number, y: number, R: number) {
  const b = m.ball, rival = m.fighters[owner.side === 0 ? 1 : 0];
  m.fx.push({ kind: 'boom', side: owner.side, x, y, x2: 0, y2: 0, t: 0, life: 0.45, dir: 1, hit: 0 });
  burst(m, x, y, 24, '#fb923c', 'ember', 7); m.shake = Math.max(m.shake, 0.5); emit(m, { type: 'boom' });
  if (b.alive) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d < R) pushBall(m, owner, dx / (d || 1) * 17, Math.max(dy / (d || 1) * 17, 4) + 4, 'fire'); }
  if (Math.hypot(rival.x - x, rival.y + 1 - y) < R) hurtFighter(m, rival, owner, 'burn', 1.1, 8, 20);
  if (Math.hypot(m.ref.x - x, m.ref.y + 1 - y) < R) hurtRef(m, 'burn', 1.4);
}
function cloudAt(m: Match, owner: Fighter, x: number, y: number) { m.fx.push({ kind: 'cloud', side: owner.side, x, y, x2: 0, y2: 0, t: 0, life: 3, dir: 1, hit: 0 }); burst(m, x, y, 14, '#86efac', 'bubble', 3); }

// ---------------------------------------------------------------- FATAL GOAL
// ¿Tiene la pelota? (cerca de los pies o del cuerpo): hace falta para tirar el FATAL GOAL.
export function hasBall(m: Match, f: Fighter) {
  const b = m.ball; return b.alive && Math.abs(b.x - f.x) < 1.6 && b.y > f.y - 0.4 && b.y < f.y + heightOf(f) + 0.4;
}
function startFatal(m: Match, f: Fighter) {
  f.action = 'fatal'; f.actionT = 0;
  const dir = attackDir(m, f.side), b = m.ball;
  b.x = clamp(f.x + dir * 0.7, 1, W - 1); b.y = f.y + 0.6; b.vx = 0; b.vy = 0; b.owner = f.side; b.frozen = 0;
  m.fatal = { side: f.side, char: f.char, style: CHARS[f.char].fatal, t: 0, x0: b.x, y0: b.y, dir, blocked: false, done: false }; m.trail = [];
  m.phase = 'fatal'; m.phaseT = 0; m.flash = 1; m.shake = 0.6;
  emit(m, { type: 'fatal', side: f.side, char: f.char });
}
function blockFatal(m: Match, side: 0 | 1) {
  const fat = m.fatal; if (!fat || fat.done) return;
  fat.blocked = true; fat.done = true;
  const b = m.ball; b.vx = attackDir(m, side) * 10; b.vy = 6; b.fx = 'none';
  m.shake = 0.8; m.flash = 0.6;
  burst(m, b.x, b.y, 30, '#ffffff', 'ring', 2); burst(m, b.x, b.y, 30, CHARS[fat.char].glow, 'spark', 8);
  m.fighters[fat.side].action = 'idle';
  emit(m, { type: 'fatalBlocked', side });
}
// Dónde va la pelota del FATAL GOAL en el tiempo t (cada estilo con su recorrido), hasta el arco rival.
export function fatalPath(fat: Pick<Fatal, 'style' | 'x0' | 'y0' | 'dir'>, t: number): { x: number; y: number; done: boolean; size: number } {
  const dir = fat.dir, gx = dir === 1 ? W - GOAL_DEPTH * 0.4 : GOAL_DEPTH * 0.4, gy = 1.2;
  const dist = Math.abs(gx - fat.x0);
  switch (fat.style) {
    case 'meteor': {
      if (t < 0.55) return { x: fat.x0 + dir * t * 2, y: fat.y0 + (H + 3 - fat.y0) * (t / 0.55) ** 1.5, done: false, size: 1 };
      const k = Math.min(1, (t - 0.55) / 0.8), sx = gx - dir * 7, sy = H + 3;
      return { x: sx + (gx - sx) * k, y: sy + (gy - sy) * k, done: k >= 1, size: 2 };
    }
    case 'avalanche': case 'boulder': {
      const k = Math.min(1, t * 22 / dist);
      return { x: fat.x0 + dir * dist * k, y: BALL_R * 2.8 + (1 - Math.min(1, t * 4)) * fat.y0, done: k >= 1, size: 2.8 };
    }
    case 'bolt': {
      const hops = 6, k = Math.min(1, t / 1.1), i = Math.min(hops, Math.floor(k * hops + 1e-6)), hk = (k * hops) % 1;
      const at = (j: number) => ({ x: fat.x0 + dir * dist * j / hops, y: j === hops ? gy : j % 2 ? 6 : j === 0 ? fat.y0 : 1.6 });
      const a = at(i), c = at(Math.min(hops, i + 1)), q = hk < 0.6 ? 0 : (hk - 0.6) / 0.4;
      return { x: a.x + (c.x - a.x) * q, y: a.y + (c.y - a.y) * q, done: k >= 1, size: 1.3 };
    }
    case 'void': {
      const k = Math.min(1, t * 13 / dist), r = (1 - k) * 1.8;
      return { x: fat.x0 + dir * dist * k + Math.cos(t * 14) * r, y: Math.max(BALL_R, fat.y0 + (gy - fat.y0) * k + 2 * Math.sin(k * Math.PI) + Math.sin(t * 14) * r), done: k >= 1, size: 1.5 };
    }
    default: {
      const k = Math.min(1, t * 16 / dist);
      return { x: fat.x0 + dir * dist * k, y: Math.max(BALL_R, fat.y0 + (gy - fat.y0) * k + Math.sin(k * Math.PI * 3) * 1.4 + Math.sin(k * Math.PI) * 2.2), done: k >= 1, size: 1.7 };
    }
  }
}
function updateFatal(m: Match, dt: number) {
  const fat = m.fatal; if (!fat) return;
  if (fat.done) { m.fatal = null; return; }
  fat.t += dt;
  const b = m.ball, px = b.x, py = b.y, p = fatalPath(fat, fat.t);
  b.x = p.x; b.y = p.y; b.vx = (p.x - px) / Math.max(dt, 1e-3); b.vy = (p.y - py) / Math.max(dt, 1e-3); b.owner = fat.side;
  const rival = m.fighters[fat.side === 0 ? 1 : 0], shooter = m.fighters[fat.side];
  if (fat.t > 0.1) shooter.action = 'idle';
  if (fat.style === 'void' && rival.stun <= 0.2) { rival.stun = 0.4; rival.stunKind = 'hit'; rival.vx = (W / 2 - rival.x) * 1.2; }
  const kind: StunKind = fat.style === 'avalanche' ? 'freeze' : fat.style === 'meteor' ? 'burn' : fat.style === 'bolt' ? 'zap' : fat.style === 'acid' ? 'poison' : 'hit';
  if (rival.action !== 'stun' && Math.abs(rival.x - b.x) < 0.5 + BALL_R * p.size && b.y > rival.y - 0.2 && b.y < rival.y + heightOf(rival) + 0.2) hurtFighter(m, rival, shooter, kind, 1.2, fat.style === 'avalanche' ? 0 : 10, 25);
  if (refIn(m, b.x - 0.5, b.x + 0.5, b.y - 0.5, b.y + 0.5)) hurtRef(m, kind, 2);
  const glow = CHARS[fat.char].glow;
  for (let k = 0; k < 3; k++) m.particles.push({ x: b.x + (Math.random() - 0.5) * 0.4, y: b.y + (Math.random() - 0.5) * 0.4, vx: -b.vx * 0.05 + (Math.random() - 0.5), vy: -b.vy * 0.05 + (Math.random() - 0.5), life: 0.5, max: 0.5, size: 0.15 * p.size, color: glow, kind: fat.style === 'meteor' ? 'ember' : fat.style === 'avalanche' ? 'shard' : fat.style === 'acid' ? 'bubble' : 'spark' });
  if (p.done) { fat.done = true; scoreGoal(m, fat.side, true); }
}

// ---------------------------------------------------------------- Árbitro
// Corre detrás de la jugada sin meterse en el medio. Si lo voltean, se cae, desaparece y vuelve a los segundos.
function updateRef(m: Match, dt: number) {
  const r = m.ref, b = m.ball;
  r.actionT += dt;
  if (r.action === 'gone') { r.away -= dt; if (r.away <= 0) { r.action = 'idle'; r.x = m.rand() < 0.5 ? 2.2 : W - 2.2; r.y = 0; r.roam = undefined; r.vx = 0; r.vy = 0; r.stun = 0; burst(m, r.x, 1, 16, '#ffffff', 'smoke', 2); emit(m, { type: 'refBack' }); } return; }
  if (r.stun > 0) {
    r.stun -= dt; moveBody(m, r, dt); r.vx *= Math.pow(0.05, dt);
    if (r.stun <= 0) { if (r.action === 'down') { r.action = 'gone'; r.away = 2.5; burst(m, r.x, 0.8, 14, '#d4d4d8', 'smoke', 2); } else r.action = 'idle'; }
    return;
  }
  // Recorre toda la cancha: a veces sigue la jugada de cerca, a veces va a otra parte y a veces se sube a una
  // plataforma para mirar desde arriba. Cambia de idea cada tantos segundos.
  const bx = b.alive ? b.x : W / 2;
  if (!r.roam || (r.roam.t -= dt) <= 0) {
    const q = m.rand(), plats = m.solids.filter(s => s.kind !== 'bouncy' && s.y + s.h > 0.6 && !(s.move?.kind === 'piston'));
    if (q < 0.45) r.roam = { x: clamp(bx + (bx < W / 2 ? 1 : -1) * (2.5 + m.rand() * 2), 3.2, W - 3.2), t: 2 + m.rand() * 2, solid: null };
    else if (q < 0.75 || !plats.length) r.roam = { x: 3.2 + m.rand() * (W - 6.4), t: 3 + m.rand() * 3, solid: null };
    else { const s = plats[Math.floor(m.rand() * plats.length)]; r.roam = { x: s.x + s.w / 2, t: 4 + m.rand() * 3, solid: s.id }; }
  }
  const perch = r.roam.solid !== null ? m.solids.find(s => s.id === r.roam!.solid) : undefined;
  if (perch) r.roam.x = perch.x + perch.w / 2;
  if (Math.abs(b.x - r.x) < 2.2 && b.alive && Math.abs(b.y - r.y - 1) < 2) r.roam.x = clamp(r.x + (r.x < b.x ? -4 : 4), 3.2, W - 3.2); // se corre de la jugada
  let d = r.roam.x - r.x;
  // a la plataforma: cuando está debajo salta lo justo para subirse
  if (perch && r.ground) { const top = perch.y + perch.h; if (top > r.y + 0.3 && Math.abs(d) < perch.w / 2 + 0.6) { r.vy = Math.sqrt(2 * gravityOf(m) * (top - r.y + 0.7)); r.ground = false; } }
  // no pisa trampas encendidas (ni las que avisan): si está encima se corre, si va hacia una se frena (o la salta)
  for (const h of m.hazards) if (((trapLike(h) && h.state >= 1) || h.kind === 'lava') && Math.abs(h.y - r.y) < 0.6) {
    const c = h.x + h.w / 2, gap = h.w / 2 + 0.7;
    if (Math.abs(c - r.x) < gap) { d = (r.x < c ? -1 : 1) * 3; break; }
    if (Math.abs(c - (r.x + Math.sign(d) * 1.2)) < gap) { if (h.kind === 'lava' && r.ground) { r.vy = 11; r.ground = false; } else d = 0; }
  }
  r.vx = Math.abs(d) > 0.3 ? Math.sign(d) * Math.min(Math.abs(d) > 6 ? 7.5 : 5.5, Math.abs(d) * 2.2) : 0;
  if (Math.abs(r.vx) > 0.2) r.facing = r.vx > 0 ? 1 : -1;
  for (const sd of m.solids) if (sd.kind !== 'float' && r.x > sd.x && r.x < sd.x + sd.w && r.y < sd.y + sd.h && r.y + PH > sd.y) { r.y = sd.y + sd.h; r.vy = 0; } // quedó metido en un bloque: arriba
  const before = r.x, want = r.vx;
  moveBody(m, r, dt);
  if (r.ground && Math.abs(want) > 1 && Math.abs(r.x - before) < Math.abs(want) * dt * 0.3) { r.vy = 11; r.ground = false; } // salta el escalón
  r.action = !r.ground ? 'jump' : Math.abs(r.vx) > 0.5 ? 'run' : 'idle';
  if (b.alive && Math.abs(b.x - r.x) < 0.4 + BALL_R && b.y < r.y + PH && b.y > r.y) {
    const s = Math.hypot(b.vx, b.vy);
    if (s > 16) hurtRef(m, 'hit', 1.2);
    if (Math.sign(b.vx) === Math.sign(r.x - b.x)) { b.vx = -b.vx * 0.4; b.x = r.x + Math.sign(b.x - r.x || 1) * (0.4 + BALL_R); emit(m, { type: 'bounce', power: 0.4 }); }
  }
}
const trapLike = (h: Hazard) => h.kind === 'spikes' || h.kind === 'flame' || h.kind === 'shock' || h.kind === 'laser' || h.kind === 'saw';
// Una trampa que en este momento lastima.
export function isDanger(h: Hazard) { return trapLike(h) && h.state === 2; }

// ---------------------------------------------------------------- La pelota
function moveBall(m: Match, dt: number) {
  const b = m.ball, st = stageDef(m.stage);
  if (m.fatal && !m.fatal.done && m.phase === 'play') return;
  const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.12) || 1, h = dt / steps;
  b.kindT = Math.max(0, b.kindT - dt); if (b.kindT <= 0 && b.kind !== 'normal') { b.kind = 'normal'; emit(m, { type: 'ballKind', kind: 'normal' }); }
  b.fxT = Math.max(0, b.fxT - dt); if (b.fxT <= 0) b.fx = 'none';
  if (b.frozen > 0) { b.frozen -= dt; b.vx = 0; b.vy = 0; m.trail = []; return; }
  for (let s = 0; s < steps; s++) {
    const g = 20 * st.gravity * (b.kind === 'void' ? 0.45 : 1);
    b.vy -= g * h;
    if (b.kind === 'toxic' || b.fx === 'toxic') b.vy += Math.cos(m.time * 9) * 14 * h;
    b.vx *= Math.pow(b.kind === 'ice' ? 0.92 : 0.86, h); b.vy *= Math.pow(0.95, h);
    b.x += b.vx * h; b.y += b.vy * h;
    collideBallWorld(m, b, h);
    if (b.pass) { b.pass.t -= h; if (b.pass.t <= 0) b.pass = undefined; }
    if (m.phase === 'play') for (const f of m.fighters) if (b.pass?.side !== f.side) collideBallFighter(m, b, f);
    if (!b.alive) return;
  }
  b.spin += b.vx * dt * 2;
  m.trail.unshift([b.x, b.y]); if (m.trail.length > 20) m.trail.length = 20;
}
function rollFriction(m: Match, b: Ball, dt: number) {
  const fr = b.kind === 'ice' ? 0.05 : stageDef(m.stage).friction;
  b.vx *= Math.pow(0.22, fr * dt); b.vx -= Math.sign(b.vx) * Math.min(Math.abs(b.vx), 5 * fr * dt);
}
function collideBallWorld(m: Match, b: Ball, dt: number) {
  if (b.y - BALL_R < 0) {
    b.y = BALL_R;
    if (b.vy < -2) { emit(m, { type: 'bounce', power: Math.min(1, -b.vy / 15) }); b.vy = -b.vy * (b.kind === 'ice' ? 0.5 : 0.6); } else b.vy = 0;
    rollFriction(m, b, dt);
    for (const h of m.hazards) if (h.kind === 'conveyor' && b.x > h.x && b.x < h.x + h.w) b.vx += h.dir * 5 * dt;
  }
  for (const s of m.solids) {
    const cx = clamp(b.x, s.x, s.x + s.w), cy = clamp(b.y, s.y, s.y + s.h), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
    if (d >= BALL_R) continue;
    let nx: number, ny: number;
    if (d === 0) { // adentro: sale por el lado más cercano
      const l = b.x - s.x, r = s.x + s.w - b.x, bo = b.y - s.y, t = s.y + s.h - b.y, mn = Math.min(l, r, bo, t);
      nx = mn === l ? -1 : mn === r ? 1 : 0; ny = mn === t ? 1 : mn === bo ? -1 : 0;
      b.x += nx * (mn + BALL_R); b.y += ny * (mn + BALL_R);
    } else { nx = dx / d; ny = dy / d; b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R; }
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const e = s.kind === 'bouncy' ? 1.15 : 0.55;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      if (s.kind === 'bouncy' && ny > 0.5) b.vy = Math.max(b.vy, 11);
      if (Math.abs(vn) > 3) emit(m, { type: 'bounce', power: Math.min(1, Math.abs(vn) / 15) });
    }
    if (ny > 0.7) rollFriction(m, b, dt);
  }
  if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) * 0.6; }
  if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
  if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }
  for (const left of [true, false]) {
    const gh = goalHeight(m, teamAt(m, left)), x0 = left ? 0 : W - GOAL_DEPTH, x1 = left ? GOAL_DEPTH : W;
    const front = left ? x1 : x0, u = Math.abs(b.x - front) / GOAL_DEPTH;
    if (b.x + BALL_R > x0 && b.x - BALL_R < x1 && u <= NET_FLAT + 0.1 && b.y + BALL_R > gh && b.y - BALL_R < gh + BAR) { // travesaño
      if (b.y > gh + BAR / 2) { b.y = gh + BAR + BALL_R; b.vy = Math.abs(b.vy) * 0.55; } else { b.y = gh - BALL_R; b.vy = -Math.abs(b.vy) * 0.55; }
      if (Math.abs(b.x - front) < BALL_R + 0.1) b.vx = -b.vx * 0.7;
      if (Math.abs(b.vy) > 2) emit(m, { type: 'post' });
    } else if (u > NET_FLAT + 0.1 && u < 1.05) { // cae sobre la red curva de atrás: rebota suave hacia afuera
      const top = netTop(gh, Math.min(1, u));
      if (b.y - BALL_R < top + 0.05 && b.y > top - 0.15 && b.vy <= 0) { b.y = top + 0.05 + BALL_R; b.vy = Math.abs(b.vy) * 0.4; b.vx += (left ? -1 : 1) * 2.5 * dt * 30; }
    }
  }
}
function collideBallFighter(m: Match, b: Ball, f: Fighter) {
  if (f.char === 'espectro' && f.abilityT > 0) return;
  const x0 = f.x - PW / 2, x1 = f.x + PW / 2, y0 = f.y, y1 = f.y + heightOf(f) * (f.slideT > 0 ? 0.35 : 1);
  const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
  if (d >= BALL_R) return;
  const blocking = f.action === 'block' && Math.sign(b.x - f.x) === f.facing;
  let nx = dx / (d || 1), ny = dy / (d || 1);
  if (d === 0) { nx = Math.sign(b.x - f.x) || 1; ny = 0; }
  b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R;
  // cabezazo: la pelota le pega en la cabeza (arriba del cuerpo) y sale hacia donde mira
  const hh = heightOf(f);
  if (!blocking && f.stun <= 0 && f.headT <= 0 && f.slideT <= 0 && cy > f.y + hh * 0.72 && ny > -0.3 && !(m.fatal && !m.fatal.done)) {
    const sp = Math.hypot(b.vx, b.vy), air = !f.ground, ang = air ? (b.y > 3.2 ? -0.15 : 0.25) : 0.55;
    const pow = Math.min(19, 9 + sp * 0.3 + (air ? 3 : 0) + Math.abs(f.vx) * 0.3);
    const hd = m.cpu[f.side] ? attackDir(m, f.side) : f.facing; // la máquina siempre cabecea hacia el arco rival
    b.vx = Math.cos(ang) * pow * hd + f.vx * 0.2; b.vy = Math.sin(ang) * pow + (air ? 0 : 2);
    b.y = Math.max(b.y, f.y + hh + BALL_R * 0.6); b.owner = f.side; b.pass = { side: f.side, t: 0.2 }; b.spin = -hd * 6;
    f.headT = 0.35; gainPower(m, f, 1);
    burst(m, b.x, b.y, 8, '#ffffff', 'spark', 3); emit(m, { type: 'header', side: f.side }); emit(m, { type: 'kick', power: pow / 20 });
    return;
  }
  const rvx = b.vx - f.vx, rvy = b.vy - f.vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = blocking ? 0.2 : ny > 0.6 ? 0.75 : 0.35;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (blocking && Math.abs(vn) > 6) { emit(m, { type: 'block' }); burst(m, b.x, b.y, 8, '#93c5fd', 'spark', 3); }
    const hard = !blocking && Math.abs(vn) > 7 && b.owner !== null && b.owner !== f.side;
    if (hard && (b.kind === 'spike' || b.kind === 'fire' || b.fx === 'fire')) hurtFighter(m, f, null, b.kind === 'spike' ? 'hit' : 'burn', 0.6, 5, 8);
    else if (hard && b.fx === 'volt') hurtFighter(m, f, null, 'zap', 0.5, 3, 6);
    if (hard && b.fx !== 'none') { b.fx = 'none'; b.fxT = 0; }
  }
  if (Math.abs(b.vx - f.vx) < 1) b.owner = f.side;
}

function checkGoal(m: Match) {
  const b = m.ball;
  if (m.phase !== 'play' || !b.alive) return;
  const viaFatal = (side: 0 | 1) => !!m.fatal && !m.fatal.done && m.fatal.side === side;
  for (const left of [true, false]) {
    const def = teamAt(m, left), inside = left ? b.x < GOAL_DEPTH - BALL_R * 0.3 : b.x > W - GOAL_DEPTH + BALL_R * 0.3;
    const gh = goalHeight(m, def), u = Math.abs(b.x - (left ? GOAL_DEPTH : W - GOAL_DEPTH)) / GOAL_DEPTH;
    if (inside && b.y < netTop(gh, Math.min(1, u)) + 0.05) { const s = def === 0 ? 1 : 0; scoreGoal(m, s, viaFatal(s)); return; }
  }
}
function scoreGoal(m: Match, side: 0 | 1, fatal: boolean) {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0];
  f.goals++; gainPower(m, rival, 10);
  m.lastGoal = { side, fatal }; m.phase = 'goal'; m.phaseT = 0; m.shake = fatal ? 1 : 0.5; m.flash = fatal ? 1 : 0.4;
  if (m.fatal) m.fatal.done = true;
  const b = m.ball; b.vx *= 0.6; b.vy = Math.min(b.vy, 2); b.fx = 'none';
  m.netHit = { left: b.x < W / 2, t: 0, y: b.y };
  burst(m, b.x, b.y, fatal ? 50 : 26, fatal ? CHARS[f.char].glow : '#ffffff', 'spark', fatal ? 9 : 6);
  if (m.extra) m.winner = side;
  emit(m, { type: 'goal', side, fatal });
}

// ---------------------------------------------------------------- Potenciadores y pelotas especiales
function updatePowerups(m: Match, dt: number) {
  m.nextPower -= dt;
  if (m.nextPower <= 0 && m.powerups.length < 2) {
    const kinds: PowerKind[] = ['shield', 'speed', 'magnet', 'power', 'giant', 'energy'];
    m.powerups.push({ id: m.nextId++, kind: kinds[Math.floor(m.rand() * kinds.length)], x: 5 + m.rand() * (W - 10), y: 2.2 + m.rand() * 1.8, t: 0 });
    m.nextPower = 16 + m.rand() * 8;
  }
  for (const p of m.powerups) {
    p.t += dt;
    for (const f of m.fighters) if (Math.abs(f.x - p.x) < 0.7 && p.y > f.y - 0.3 && p.y < f.y + heightOf(f) + 0.4) {
      p.t = 99;
      if (p.kind === 'energy') { f.stamina = STAMINA; gainPower(m, f, 40); } else f.powers[p.kind] = POWERS[p.kind].time;
      burst(m, p.x, p.y, 20, POWERS[p.kind].color, 'ring', 2);
      emit(m, { type: 'power', side: f.side, kind: p.kind });
      break;
    }
  }
  m.powerups = m.powerups.filter(p => p.t < 12);
  m.nextBall -= dt;
  if (m.nextBall <= 0 && m.ball.alive) {
    const kinds: Exclude<BallKind, 'normal'>[] = ['toxic', 'fire', 'ice', 'spike', 'void'];
    m.ball.kind = kinds[Math.floor(m.rand() * kinds.length)]; m.ball.kindT = 12;
    burst(m, m.ball.x, m.ball.y, 20, BALLS[m.ball.kind].color, 'ring', 2);
    emit(m, { type: 'ballKind', kind: m.ball.kind });
    m.nextBall = 28 + m.rand() * 12;
  }
}

// ---------------------------------------------------------------- Trampas y peligros
// Ciclo de las trampas: apagada → aviso (0,9 s) → encendida (1,6 s; las sierras 2,4 s).
function trapCycle(h: Hazard) { const on = h.kind === 'saw' ? 2.4 : 1.6, c = ((h.t % h.period) + h.period) % h.period; return c < h.period - on - 0.9 ? 0 : c < h.period - on ? 1 : 2; }
// Dónde está la sierra (centro) en este momento.
export function sawPos(h: Hazard) { const c = ((h.t % h.period) + h.period) % h.period, k = Math.max(0, c - (h.period - 2.4)) / 2.4; const u = 0.5 - 0.5 * Math.cos(k * Math.PI * 2); return { x: h.dir > 0 ? h.x + h.w * u : h.x + h.w * (1 - u), y: h.state === 2 ? h.y + 0.1 : h.state === 1 ? h.y - 0.25 : h.y - 0.7, r: h.h }; }
export function wreckPos(h: Hazard, time: number) { const a = Math.sin(time * 0.8 + h.t) * Math.min(0.95, 4.2 / h.h); return { a, x: h.x + Math.sin(a) * h.h, y: h.y - Math.cos(a) * h.h, r: 0.95 }; }
export function minePos(h: Hazard, time: number) { return { x: h.x + Math.sin(time * 0.7 + h.id) * 0.6, y: h.y + Math.sin(time * 1.3 + h.id * 2) * 0.35 }; }
function mineBoom(m: Match, h: Hazard) {
  if (h.state !== 0) return;
  const p = minePos(h, m.time);
  h.state = 1; h.dir = 7; // vuelve a aparecer a los 7 segundos
  m.fx.push({ kind: 'boom', side: 0, x: p.x, y: p.y, x2: 0, y2: 0, t: 0, life: 0.5, dir: 1, hit: 0 });
  burst(m, p.x, p.y, 30, '#f87171', 'ember', 8); m.shake = Math.max(m.shake, 0.7); emit(m, { type: 'boom' });
  const b = m.ball;
  if (b.alive && Math.hypot(b.x - p.x, b.y - p.y) < 2.6) blastBall(m, p.x, p.y, 16, true);
  for (const f of m.fighters) if (Math.hypot(f.x - p.x, f.y + 1 - p.y) < 2.4) hurtFighter(m, f, null, 'burn', 1, 9, 20);
  if (Math.hypot(m.ref.x - p.x, m.ref.y + 1 - p.y) < 2.4) hurtRef(m, 'burn', 1.4);
}
function updateHazards(m: Match, dt: number) {
  const b = m.ball, r = m.rand;
  m.nextHazard -= dt;
  const spawn = (kind: Hazard['kind'], x: number, w: number, warn: number) => { m.hazards.push({ kind, x, y: H, w, h: 0, t: -warn, state: 0, dir: 1, id: m.nextId++, period: 0 }); emit(m, { type: 'warn' }); };
  if (m.nextHazard <= 0) {
    const x = 5 + r() * (W - 10);
    switch (m.stage) {
      case 'volcano': spawn('meteor', x, 1.8, 1.3); m.nextHazard = 5 + r() * 3; break;
      case 'ice': spawn('icicle', x, 0.9, 1); m.nextHazard = 4.5 + r() * 4; break;
      case 'storm': case 'sky': spawn('lightning', x, 1.3, 1.1); m.nextHazard = (m.stage === 'sky' ? 7 : 5) + r() * 3; break;
      case 'desert': spawn('meteor', x, 1.6, 1.4); m.nextHazard = 7 + r() * 4; break; // bolas de fuego del cielo
      default: m.nextHazard = 99;
    }
  }
  // quiénes están en una zona: lastima una vez por encendido de cada trampa
  const hit = (x0: number, x1: number, y0: number, y1: number, kind: StunKind, time: number, push: number, drain: number, h?: Hazard) => {
    const ok = (bit: number) => { if (!h) return true; if ((h.struck ?? 0) & bit) return false; h.struck = (h.struck ?? 0) | bit; return true; };
    m.fighters.forEach((f, i) => { if (f.stun <= 0 && !(f.char === 'espectro' && f.abilityT > 0) && f.x + PW / 2 > x0 && f.x - PW / 2 < x1 && f.y < y1 && f.y + heightOf(f) > y0 && ok(1 << i)) hurtFighter(m, f, null, kind, time, push, drain); });
    if (refIn(m, x0, x1, y0, y1) && ok(4)) hurtRef(m, kind, 1.3);
  };
  const ballIn = (x0: number, x1: number, y0: number, y1: number) => b.alive && b.x + BALL_R > x0 && b.x - BALL_R < x1 && b.y - BALL_R < y1 && b.y + BALL_R > y0 && !(m.fatal && !m.fatal.done);
  for (const h of m.hazards) {
    h.t += dt;
    switch (h.kind) {
      case 'spikes': case 'flame': case 'shock': case 'laser': {
        const before = h.state; h.state = trapCycle(h);
        if (h.state === 2 && before !== 2) emit(m, { type: 'trap', kind: h.kind });
        if (h.state !== 2) { h.struck = 0; break; }
        const y0 = h.y, y1 = h.kind === 'flame' ? h.y + 3.2 : h.kind === 'laser' ? h.h : h.y + 0.75;
        hit(h.x, h.x + h.w, y0, y1, h.kind === 'flame' ? 'burn' : h.kind === 'spikes' ? 'hit' : 'zap', 0.9, h.kind === 'spikes' ? 6 : 5, h.kind === 'spikes' ? 18 : 15, h);
        if (ballIn(h.x, h.x + h.w, y0, y1)) {
          if (h.kind === 'flame' || h.kind === 'laser') { if (b.fx !== 'fire' || b.vy < 4) blastBall(m, h.x + h.w / 2, h.y - 0.5, 10, true); } // sale prendida fuego, no explota
          else if (h.kind === 'spikes') { b.vy = Math.max(b.vy, 9); b.vx += (b.x - (h.x + h.w / 2)) * 4; }
          else { b.fx = 'volt'; b.fxT = 0.8; b.owner = null; }
        }
        break;
      }
      case 'saw': {
        const before = h.state; h.state = trapCycle(h);
        if (h.state === 2 && before !== 2) emit(m, { type: 'trap', kind: 'saw' });
        if (h.state !== 2) { h.struck = 0; break; }
        const p = sawPos(h);
        hit(p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r, 'hit', 0.9, 7, 18, h);
        if (b.alive && Math.hypot(b.x - p.x, b.y - p.y) < p.r + BALL_R) blastBall(m, p.x, p.y - 0.2, 13, false);
        break;
      }
      case 'wreck': {
        const p = wreckPos(h, m.time), dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (b.alive && d < p.r + BALL_R) { const nx = dx / d, ny = dy / d; b.x = p.x + nx * (p.r + BALL_R); b.y = p.y + ny * (p.r + BALL_R); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } b.vx += Math.cos(m.time * 0.8 + h.t) * 6; emit(m, { type: 'post' }); }
        if (Math.abs(p.a) > 0.9) h.struck = 0;
        hit(p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r, 'hit', 0.9, 10, 20, h);
        break;
      }
      case 'conveyor': {
        const s = Math.floor(m.time / 8) % 2; if (s !== h.state) { h.state = s; h.dir = s ? -1 : 1; }
        for (const f of m.fighters) if (f.ground && f.y < 0.1 && f.x > h.x && f.x < h.x + h.w) f.x = clamp(f.x + h.dir * 2.4 * dt, 0.5, W - 0.5);
        break;
      }
      case 'lava':
        if (Math.floor(h.t * 0.8) !== h.state) { h.state = Math.floor(h.t * 0.8); h.struck = 0; }
        hit(h.x + 0.2, h.x + h.w - 0.2, 0, 0.3, 'burn', 1.1, 0, 20, h);
        for (const f of m.fighters) if (f.stun > 0 && f.stunKind === 'burn' && f.ground && f.y < 0.1 && f.x > h.x && f.x < h.x + h.w) { f.vy = 9; f.ground = false; f.vx = (f.x < W / 2 ? 1 : -1) * 6; }
        if (ballIn(h.x + 0.1, h.x + h.w - 0.1, 0, 0.15)) blastBall(m, h.x + h.w / 2 + (b.x < h.x + h.w / 2 ? 0.4 : -0.4), -1, 13, true); // la lava la escupe
        break;
      case 'mine': {
        if (h.state === 1) { h.dir -= dt; if (h.dir <= 0) { h.state = 0; burst(m, h.x, h.y, 10, '#fca5a5', 'smoke', 2); } break; }
        const p = minePos(h, m.time);
        if (b.alive && Math.hypot(b.x - p.x, b.y - p.y) < h.w + BALL_R) { mineBoom(m, h); break; }
        for (const f of m.fighters) if (Math.abs(f.x - p.x) < PW / 2 + h.w && p.y > f.y - h.w && p.y < f.y + heightOf(f) + h.w) { mineBoom(m, h); break; }
        break;
      }
      case 'waterfall':
        if (b.alive && b.x > h.x - BALL_R && b.x < h.x + h.w + BALL_R) { b.vy -= 22 * dt; b.vx *= Math.pow(0.4, dt); }
        break;
      case 'meteor': case 'icicle': case 'lightning': {
        if (h.t >= 0 && h.state === 0) {
          h.state = 1;
          const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2;
          const kind: StunKind = h.kind === 'icicle' ? 'freeze' : h.kind === 'meteor' ? 'burn' : 'zap';
          hit(x0 - 0.3, x1 + 0.3, 0, H, kind, h.kind === 'icicle' ? 1.1 : 0.9, h.kind === 'icicle' ? 0 : 8, 18);
          if (b.alive && Math.abs(b.x - h.x) < h.w / 2 + 0.6) { if (h.kind === 'meteor') blastBall(m, h.x, 0, 14, true); else if (h.kind !== 'icicle' || b.y < 3) { b.vy = 12 + r() * 4; b.vx += (b.x - h.x) * 6; } }
          m.shake = Math.max(m.shake, h.kind === 'meteor' ? 0.7 : 0.4);
          if (h.kind !== 'icicle') m.flash = Math.max(m.flash, 0.3);
          burst(m, h.x, 0.2, h.kind === 'meteor' ? 30 : 16, h.kind === 'meteor' ? '#fb923c' : h.kind === 'icicle' ? '#e0f2fe' : '#fde047', h.kind === 'meteor' ? 'ember' : h.kind === 'icicle' ? 'shard' : 'spark', 6);
          emit(m, { type: h.kind === 'meteor' ? 'boom' : h.kind === 'icicle' ? 'block' : 'thunder' });
        }
        break;
      }
    }
  }
  m.hazards = m.hazards.filter(h => !((h.kind === 'meteor' || h.kind === 'icicle' || h.kind === 'lightning') && h.t > 1.3));
}

function fighterCollide(m: Match) {
  const [a, b] = m.fighters, dx = b.x - a.x, overlap = PW - Math.abs(dx);
  if ((a.char === 'espectro' && a.abilityT > 0) || (b.char === 'espectro' && b.abilityT > 0)) return;
  if (overlap > 0 && Math.abs(a.y - b.y) < PH * 0.8) { const s = Math.sign(dx) || 1; a.x = clamp(a.x - s * overlap / 2, 0.5, W - 0.5); b.x = clamp(b.x + s * overlap / 2, 0.5, W - 0.5); }
}

// ---------------------------------------------------------------- Partículas
export function burst(m: Match, x: number, y: number, n: number, color: string, kind: Particle['kind'], speed: number) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    m.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (kind === 'ember' || kind === 'smoke' || kind === 'bubble' ? 1.5 : 0), life: kind === 'ring' ? 0.5 : 0.4 + Math.random() * 0.6, max: 1, size: kind === 'smoke' ? 0.25 + Math.random() * 0.3 : kind === 'ring' ? 0.2 : 0.05 + Math.random() * 0.08, color, kind });
    if (kind === 'ring') break;
  }
  if (m.particles.length > 600) m.particles.splice(0, m.particles.length - 600);
}
function updateParticles(m: Match, dt: number) {
  for (const p of m.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'spark' || p.kind === 'shard' || p.kind === 'blood') p.vy -= 12 * dt;
    if (p.kind === 'blood' && p.y < 0.02) { p.y = 0.02; p.vy = 0; p.vx = 0; }
    if (p.kind === 'smoke') { p.size += dt * 0.6; p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.5, dt); }
    if (p.kind === 'ring') p.size += dt * 6;
  }
  m.particles = m.particles.filter(p => p.life > 0);
}

// ---------------------------------------------------------------- La máquina
// Hasta dónde le llega la habilidad (para decidir si usarla).
function abilityReach(f: Fighter, x: number, y: number) {
  const dx = (x - f.x) * f.facing, dy = y - (f.y + 1);
  switch (CHARS[f.char].ability) {
    case 'freeze': return Math.hypot(x - f.x, dy) < 5;
    case 'quake': return Math.abs(x - f.x) < 4.2 && dy < 1.5 && f.ground;
    case 'laserCut': return dx > -0.2 && Math.hypot(dx, dy) < 2.3;
    case 'superJump': return Math.abs(x - f.x) < 1.5 && dy > 1 && dy < 6;
    case 'charge': case 'phase': return dx > 0 && dx < 6 && Math.abs(dy) < 1;
    case 'flight': return dx > 0 && dx < 9 && Math.abs(dy) < 1.5;
    case 'magmaSpikes': return dx > 0 && dx < 10 && y < 1.4;
    default: return dx > 0.3 && dx < 12 && Math.abs(dy) < dx * 1.1 + 1;
  }
}
// La máquina también mantiene apretado: carga el tiro (más cuanto mejor juega) y estira el salto.
function cpuHold(m: Match, side: 0 | 1, c: CpuState, i: Input, dt: number): Input {
  const f = m.fighters[side];
  if (c.kickHold > 0) { // mantiene la patada (carga el tiro); al llegar a 0 suelta y patea. Si va de globo aprieta ↑ al final
    c.kickHold -= dt; i.kick = c.kickHold > 0; i.up = !!c.lob && c.kickHold < 0.12; if (c.kickHold <= 0) c.lob = false;
  } else if (i.kick && !i.down && f.charge <= 0 && f.kickT <= 0) c.kickHold = c.holdFor ?? (0.03 + m.rand() * (0.15 + c.level * 0.5));
  return i;
}
function cpuThink(m: Match, side: 0 | 1, c: CpuState, dt: number): Input {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0], b = m.ball, dir = attackDir(m, side);
  const ownX = ownGoalX(m, side), goalX = ownGoalX(m, side === 0 ? 1 : 0);
  c.think -= dt;
  const plan = c.plan;
  plan.kick = false; plan.cast = null; plan.up = false; plan.ability = false;
  const canCast = abilityReady(f) && f.stamina > CHARS[f.char].cost + 8;
  // FATAL del rival: si llega, le tira la habilidad a la pelota
  if (m.fatal && !m.fatal.done && m.fatal.side !== side) {
    const before = c.reactFatal; c.reactFatal += dt;
    const at = 0.45 - c.level * 0.25;
    if (before < at && c.reactFatal >= at && abilityReady(f) && m.rand() < 0.15 + c.level * 0.4) { f.facing = Math.sign(b.x - f.x) as 1 | -1 || f.facing; plan.cast = 'ability'; }
    return { ...plan };
  }
  c.reactFatal = 0;
  // pelota que va a entrar al arco propio: la habilidad para salvarla (cuanto mejor la máquina, más seguido)
  if (b.alive && canCast && Math.sign(b.vx) === -dir && Math.abs(b.vx) > 4 && Math.abs(b.x - ownX) < 11) {
    // le tira a la pelota (el poder siempre la despeja), esté delante o detrás de ella
    const was = f.facing; f.facing = (Math.sign(b.x - f.x) || dir) as 1 | -1;
    if (abilityReach(f, b.x, b.y) && m.rand() < (0.12 + c.level * 0.45) * dt * 15) { plan.cast = 'ability'; return { ...plan }; }
    f.facing = was;
  }
  if (c.think > 0) return { ...plan };
  c.think = 0.3 - c.level * 0.22 + m.rand() * 0.08;
  plan.left = false; plan.right = false; plan.down = false;
  if (!b.alive) { // espera debajo del tubo
    const dx = W / 2 - dir * 2 - f.x; if (Math.abs(dx) > 0.3) { plan.right = dx > 0; plan.left = dx < 0; }
    return { ...plan };
  }
  const ahead = (b.x - f.x) * dir; // >0: la pelota está entre él y el arco rival
  const toGoal = Math.abs(goalX - f.x);
  const targetX = ahead > -0.3 ? b.x - dir * 0.5 : b.x - dir * 1.2;
  const dx = targetX - f.x;
  const lowEnergy = f.stamina < 20 && Math.abs(b.x - f.x) > 7; // casi sin energía y lejos: descansa
  if (Math.abs(dx) > 0.15 && !lowEnergy) { if (dx > 0) plan.right = true; else plan.left = true; }
  if (ahead < -0.2 && Math.abs(b.x - f.x) < 1.4 && b.y < f.y + 1.2 && f.ground && m.rand() < 0.5) plan.up = true; // salta la pelota para ponerse detrás
  if (b.y > f.y + 2 && b.y < f.y + 4.5 && Math.abs(b.x - f.x) < 1.6 && f.ground && m.rand() < 0.3 + c.level * 0.4) plan.up = true; // cabezazo o pelota en una plataforma
  if (f.ground && Math.abs(f.vx) < 0.5 && Math.abs(dx) > 0.8) plan.up = true; // trabado contra un escalón
  if (!f.ground && f.jumps < MAX_JUMPS && f.vy < 3 && b.y > f.y + 2.4 && Math.abs(b.x - f.x) < 2.5 && m.rand() < 0.3 + c.level * 0.5) plan.up = true; // otro salto en el aire para llegar a la pelota alta
  // trampas encendidas o por encenderse adelante: frena (o salta los pinches y la lava)
  const go = Math.sign(dx);
  for (const h of m.hazards) {
    if ((!trapLike(h) && h.kind !== 'lava') || h.y > f.y + 0.5 || h.kind === 'laser' && h.h < f.y) continue;
    const dist = go > 0 ? h.x - (f.x + PW / 2) : f.x - PW / 2 - (h.x + h.w);
    const on = f.x + PW / 2 > h.x && f.x - PW / 2 < h.x + h.w;
    if (on && h.kind !== 'lava' && h.state === 1 && m.rand() < 0.3 + c.level * 0.65) { const out = f.x < h.x + h.w / 2 ? -1 : 1; plan.left = out < 0; plan.right = out > 0; break; }
    if (dist < -0.1 || dist > 0.6 + c.level * 1.4) continue;
    if (h.kind === 'lava') { if (f.ground && dist < 0.7 && m.rand() < 0.5 + c.level * 0.5) plan.up = true; }
    else if (h.state !== 0 && m.rand() < 0.3 + c.level * 0.65) { plan.left = false; plan.right = false; }
    else if (h.kind === 'spikes' && f.ground && dist < 0.6) plan.up = true;
  }
  const near = Math.hypot(b.x - (f.x + dir * 0.5), b.y - (f.y + 0.5));
  // patear: con la pelota adelante
  if ((near < 1.2 || (ahead > 0.2 && ahead < 1.8 && Math.abs(b.y - f.y - 0.5) < 0.9)) && ahead > -0.1 && f.kickT <= 0 && m.rand() < 0.45 + c.level * 0.55) {
    if (f.facing !== dir) { if (dir > 0) plan.right = true; else plan.left = true; }
    else {
      // ¿tiro o conducción? Lejos del arco y sin nadie adelante, la lleva corriendo; cerca, o si el rival viene,
      // patea: más fuerte cuanto más lejos está el arco, y de globo si el rival le tapa el camino
      const blocker = (rival.x - f.x) * dir > 0 && Math.abs(rival.x - f.x) < 3.5 && Math.abs(rival.y - f.y) < 1.5;
      const shoot = toGoal < 12 || blocker || m.rand() < 0.08 + (1 - c.level) * 0.15;
      if (shoot && f.kickT <= 0 && f.charge <= 0) {
        plan.kick = true;
        c.holdFor = Math.min(1, 0.08 + (toGoal / 13) * 0.75 * (0.65 + c.level * 0.35) + m.rand() * 0.12);
        c.lob = blocker && rival.ground && m.rand() < 0.4 + c.level * 0.5;
      } else { if (dir > 0) plan.right = true; else plan.left = true; } // conducción
    }
  }
  // habilidad para tirar al arco o para pegarle al rival
  if (canCast && f.facing === dir && ahead > 0 && toGoal < 12 && abilityReach(f, b.x, b.y) && m.rand() < 0.05 + c.level * 0.15) plan.cast = 'ability';
  else if (canCast && abilityReach(f, rival.x, rival.y + 1) && m.rand() < 0.04 + c.level * 0.12) plan.cast = 'ability';
  // pelota fuerte que viene a su arco y él está delante: se planta a bloquearla
  if (Math.sign(b.vx) === -dir && Math.abs(b.vx) > 7 && (f.x - b.x) * dir < 0 && Math.abs(f.x - b.x) < 2.5 && b.y < f.y + heightOf(f) && f.ground && m.rand() < 0.2 + c.level * 0.7) { plan.left = false; plan.right = false; plan.down = true; plan.kick = false; f.facing = dir; }
  // barrida si el rival tiene la pelota cerca
  const rivalHas = Math.abs(rival.x - b.x) < 1 && Math.abs(f.x - rival.x) < 2.2 && Math.abs(f.vx) > 3.5;
  if (rivalHas && f.facing === dir && m.rand() < 0.15 + c.level * 0.3) { plan.down = true; plan.kick = true; }
  // FATAL
  if (fatalReady(f) && !m.fatal && hasBall(m, f) && m.rand() < 0.1 + c.level * 0.25) plan.cast = 'fatal';
  // potenciador cerca
  const pu = m.powerups.find(p => Math.abs(p.x - f.x) < 3);
  if (pu && Math.abs(b.x - f.x) > 3) { plan.left = pu.x < f.x; plan.right = pu.x > f.x; if (pu.y > f.y + 3 && Math.abs(pu.x - f.x) < 1.2 && f.ground) plan.up = true; }
  return { ...plan };
}

export const clockText = (s: number) => `${String(Math.floor(Math.ceil(s) / 60)).padStart(2, '0')}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
// Las flechas del FATAL para quien ataca hacia "dir" (1: a la derecha).
export function fatalKeys(dir: 1 | -1): string[] { return FATAL_COMBO.map(d => (d === 'F') === (dir > 0) ? '→' : '←'); }
