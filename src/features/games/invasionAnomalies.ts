// Catálogo de anomalías de "Invasión": las cosas raras que hacen los aliens disfrazados de personas para
// que el francotirador sospeche. Cada partida se barajan, así no se repiten hasta que salieron todas.
//
// Cada anomalía es una combinación de un "efecto" (cómo se mueve, cómo se ve, qué tiene en la mano, qué dice,
// qué le pasa a lo que tiene alrededor) y en qué lugar puede pasar (en cualquier lado, adentro de un
// departamento, en la vereda o en un tipo de habitación).

export type MoveMode =
  | 'backwards' | 'moonwalk' | 'slide' | 'jitter' | 'freeze' | 'speedy' | 'wallbump' | 'hop' | 'crawl' | 'float'
  | 'ceiling' | 'stopmotion' | 'spin' | 'tilt' | 'zigzag' | 'runInPlace' | 'sidestep' | 'teleport' | 'robot' | 'sway' | 'wallwalk';
export type BodyMode = 'stretch' | 'shrink' | 'headspin' | 'headback' | 'longarms' | 'ghosts' | 'flicker' | 'bigHead' | 'thin' | 'neck' | 'upsideHead';
export type LookMode = 'eyes' | 'skin' | 'noshadow' | 'alienshadow' | 'antenna' | 'glitch' | 'steam' | 'drool' | 'aura' | 'sweat' | 'hairup' | 'nosebleed' | 'tongue' | 'scales';
export type PropKind =
  | 'plant' | 'soap' | 'bulb' | 'battery' | 'sock' | 'fish' | 'newspaper' | 'crayon' | 'candle' | 'sponge' | 'remote' | 'flower'
  | 'cactus' | 'ice' | 'book' | 'phone' | 'umbrella' | 'pan' | 'fork' | 'iron' | 'banana' | 'toaster' | 'sunglasses' | 'guitar'
  | 'vase' | 'fishbowl' | 'paint' | 'watering' | 'shoe' | 'bucket' | 'lamp' | 'spoons' | 'flashlight' | 'clock' | 'kettle' | 'egg'
  | 'cable' | 'magnet' | 'coin' | 'cup';
export type PropAction = 'eat' | 'drink' | 'hold' | 'wear' | 'use' | 'upside' | 'wave';
export type FaceMode = 'stare' | 'wave' | 'point' | 'salute' | 'thumbs' | 'smile' | 'shush' | 'bow';
export type EnvMode = 'lights' | 'tvstatic' | 'plantwilt' | 'dogbark' | 'cathiss' | 'birds' | 'clocks' | 'radio' | 'frost' | 'levitate' | 'symbols' | 'cropcircle' | 'sparks' | 'flies';
export type PoseMode = 'corner' | 'window' | 'sky' | 'phoneSky' | 'signal' | 'sleepStand' | 'measure' | 'sniff' | 'hugWall' | 'kneel' | 'armsOut' | 'statue' | 'tpose' | 'headWall' | 'sitAir' | 'lieFloor';

export type AnomalyFx =
  | { t: 'move'; mode: MoveMode }
  | { t: 'body'; mode: BodyMode }
  | { t: 'look'; mode: LookMode; color?: string }
  | { t: 'prop'; action: PropAction; prop: PropKind }
  | { t: 'say'; lines: string[]; color?: string }
  | { t: 'face'; mode: FaceMode }
  | { t: 'env'; mode: EnvMode }
  | { t: 'pose'; mode: PoseMode };
// Dónde puede pasar: en cualquier lado, adentro de un departamento o local, en la vereda, o en una habitación de cierto tipo.
export type Where = 'any' | 'room' | 'street' | 'kitchen' | 'living' | 'bedroom' | 'bath';
export interface Anomaly { id: number; text: string; where: Where; fx: AnomalyFx }

const GREEN = '#4ade80', RED = '#ef4444', VIOLET = '#a855f7', WHITE = '#f8fafc', CYAN = '#22d3ee', ORANGE = '#fb923c';

type Spec = [string, Where, AnomalyFx];
const SPECS: Spec[] = [
  // Cómo se mueve.
  ['Camina para atrás como si nada', 'any', { t: 'move', mode: 'backwards' }],
  ['Hace la caminata lunar', 'any', { t: 'move', mode: 'moonwalk' }],
  ['Se desliza sin mover las piernas', 'any', { t: 'move', mode: 'slide' }],
  ['Parpadea de lugar: se corre de golpe unos centímetros', 'any', { t: 'move', mode: 'jitter' }],
  ['Se queda congelado a mitad de un paso', 'any', { t: 'move', mode: 'freeze' }],
  ['Camina rapidísimo y frena en seco', 'any', { t: 'move', mode: 'speedy' }],
  ['Choca contra la pared una y otra vez', 'room', { t: 'move', mode: 'wallbump' }],
  ['Va dando saltitos como un canguro', 'any', { t: 'move', mode: 'hop' }],
  ['Gatea por el piso', 'any', { t: 'move', mode: 'crawl' }],
  ['Flota unos centímetros sobre el piso', 'any', { t: 'move', mode: 'float' }],
  ['Está parado en el techo, cabeza abajo', 'room', { t: 'move', mode: 'ceiling' }],
  ['Camina por las paredes y por el techo', 'room', { t: 'move', mode: 'wallwalk' }],
  ['Se mueve a los saltos, como en cámara lenta cortada', 'any', { t: 'move', mode: 'stopmotion' }],
  ['Gira sobre sí mismo sin parar', 'any', { t: 'move', mode: 'spin' }],
  ['Está inclinado como la torre de Pisa y no se cae', 'any', { t: 'move', mode: 'tilt' }],
  ['Camina en zigzag perfecto', 'any', { t: 'move', mode: 'zigzag' }],
  ['Corre sin moverse del lugar', 'any', { t: 'move', mode: 'runInPlace' }],
  ['Camina de costado como un cangrejo', 'any', { t: 'move', mode: 'sidestep' }],
  ['Desaparece y aparece en la otra punta', 'any', { t: 'move', mode: 'teleport' }],
  ['Se mueve como un robot, a los tirones', 'any', { t: 'move', mode: 'robot' }],
  ['Se balancea de un lado al otro como un péndulo', 'any', { t: 'move', mode: 'sway' }],
  // El cuerpo.
  ['Se estira y queda altísimo', 'any', { t: 'body', mode: 'stretch' }],
  ['Se achica de golpe', 'any', { t: 'body', mode: 'shrink' }],
  ['Le gira la cabeza como un búho', 'any', { t: 'body', mode: 'headspin' }],
  ['Tiene la cabeza dada vuelta para atrás', 'any', { t: 'body', mode: 'headback' }],
  ['Los brazos le llegan hasta el piso', 'any', { t: 'body', mode: 'longarms' }],
  ['Deja copias transparentes de sí mismo al moverse', 'any', { t: 'body', mode: 'ghosts' }],
  ['Titila como una tele mal sintonizada', 'any', { t: 'body', mode: 'flicker' }],
  ['La cabeza se le hincha', 'any', { t: 'body', mode: 'bigHead' }],
  ['Se pone flaquísimo, como un fideo', 'any', { t: 'body', mode: 'thin' }],
  ['El cuello se le estira', 'any', { t: 'body', mode: 'neck' }],
  ['Tiene la cabeza al revés', 'any', { t: 'body', mode: 'upsideHead' }],
  // Cómo se ve.
  ['Le brillan los ojos de verde', 'any', { t: 'look', mode: 'eyes', color: GREEN }],
  ['Le brillan los ojos de rojo', 'any', { t: 'look', mode: 'eyes', color: RED }],
  ['Los ojos se le ponen blancos y brillantes', 'any', { t: 'look', mode: 'eyes', color: WHITE }],
  ['Le brillan los ojos violetas', 'any', { t: 'look', mode: 'eyes', color: VIOLET }],
  ['La piel se le pone gris un instante', 'any', { t: 'look', mode: 'skin', color: '#9ca3af' }],
  ['La piel se le pone verdosa', 'any', { t: 'look', mode: 'skin', color: '#86efac' }],
  ['La piel se le pone azulada', 'any', { t: 'look', mode: 'skin', color: '#93c5fd' }],
  ['No tiene sombra', 'any', { t: 'look', mode: 'noshadow' }],
  ['Su sombra tiene la cabeza enorme', 'any', { t: 'look', mode: 'alienshadow' }],
  ['Le asoman dos antenitas entre el pelo', 'any', { t: 'look', mode: 'antenna' }],
  ['Se le corren los colores, como una imagen rota', 'any', { t: 'look', mode: 'glitch' }],
  ['Le sale vapor por las orejas', 'any', { t: 'look', mode: 'steam' }],
  ['Babea algo verde', 'any', { t: 'look', mode: 'drool', color: GREEN }],
  ['Tiene un resplandor verde alrededor', 'any', { t: 'look', mode: 'aura', color: GREEN }],
  ['Tiene un resplandor violeta alrededor', 'any', { t: 'look', mode: 'aura', color: VIOLET }],
  ['Transpira gotas verdes', 'any', { t: 'look', mode: 'sweat', color: GREEN }],
  ['Se le para todo el pelo', 'any', { t: 'look', mode: 'hairup' }],
  ['Le sangra la nariz… verde', 'any', { t: 'look', mode: 'nosebleed', color: GREEN }],
  ['Saca una lengua larguísima', 'any', { t: 'look', mode: 'tongue' }],
  ['Le aparecen escamas en la cara', 'any', { t: 'look', mode: 'scales' }],
  // Comer cosas que no se comen.
  ['Se come una planta', 'room', { t: 'prop', action: 'eat', prop: 'plant' }],
  ['Muerde un jabón', 'room', { t: 'prop', action: 'eat', prop: 'soap' }],
  ['Se come una lamparita', 'any', { t: 'prop', action: 'eat', prop: 'bulb' }],
  ['Chupa una pila', 'any', { t: 'prop', action: 'eat', prop: 'battery' }],
  ['Se come una media', 'room', { t: 'prop', action: 'eat', prop: 'sock' }],
  ['Se come un pescado crudo entero', 'kitchen', { t: 'prop', action: 'eat', prop: 'fish' }],
  ['Se come el diario', 'any', { t: 'prop', action: 'eat', prop: 'newspaper' }],
  ['Se come un crayón', 'room', { t: 'prop', action: 'eat', prop: 'crayon' }],
  ['Se come una vela', 'room', { t: 'prop', action: 'eat', prop: 'candle' }],
  ['Muerde una esponja', 'kitchen', { t: 'prop', action: 'eat', prop: 'sponge' }],
  ['Se come el control remoto', 'living', { t: 'prop', action: 'eat', prop: 'remote' }],
  ['Se come una flor', 'any', { t: 'prop', action: 'eat', prop: 'flower' }],
  ['Muerde un cactus', 'room', { t: 'prop', action: 'eat', prop: 'cactus' }],
  ['Se come un huevo con cáscara', 'kitchen', { t: 'prop', action: 'eat', prop: 'egg' }],
  ['Se traga una moneda tras otra', 'any', { t: 'prop', action: 'eat', prop: 'coin' }],
  ['Muerde un cable', 'room', { t: 'prop', action: 'eat', prop: 'cable' }],
  // Tomar cosas que no se toman.
  ['Toma agua del florero', 'room', { t: 'prop', action: 'drink', prop: 'vase' }],
  ['Toma agua de la pecera', 'room', { t: 'prop', action: 'drink', prop: 'fishbowl' }],
  ['Toma pintura de la lata', 'any', { t: 'prop', action: 'drink', prop: 'paint' }],
  ['Toma de la regadera', 'any', { t: 'prop', action: 'drink', prop: 'watering' }],
  ['Toma de un zapato', 'any', { t: 'prop', action: 'drink', prop: 'shoe' }],
  ['Toma del balde de limpiar', 'room', { t: 'prop', action: 'drink', prop: 'bucket' }],
  ['Toma agua hirviendo de la pava', 'kitchen', { t: 'prop', action: 'drink', prop: 'kettle' }],
  // Usar cosas para lo que no son.
  ['Habla por el teléfono al revés', 'any', { t: 'prop', action: 'upside', prop: 'phone' }],
  ['Lee un libro al revés', 'any', { t: 'prop', action: 'upside', prop: 'book' }],
  ['Lee el diario al revés', 'any', { t: 'prop', action: 'upside', prop: 'newspaper' }],
  ['Abrió un paraguas adentro de la casa', 'room', { t: 'prop', action: 'hold', prop: 'umbrella' }],
  ['Tiene una sartén puesta de sombrero', 'room', { t: 'prop', action: 'wear', prop: 'pan' }],
  ['Se peina con un tenedor', 'room', { t: 'prop', action: 'use', prop: 'fork' }],
  ['Plancha la tele', 'living', { t: 'prop', action: 'use', prop: 'iron' }],
  ['Habla por una banana', 'any', { t: 'prop', action: 'use', prop: 'banana' }],
  ['Escribe en una tostadora como si fuera una compu', 'room', { t: 'prop', action: 'use', prop: 'toaster' }],
  ['Usa anteojos de sol de noche y adentro', 'any', { t: 'prop', action: 'wear', prop: 'sunglasses' }],
  ['Toca la guitarra al revés', 'room', { t: 'prop', action: 'upside', prop: 'guitar' }],
  ['Riega el piso con la regadera', 'room', { t: 'prop', action: 'use', prop: 'watering' }],
  ['Lleva una lámpara prendida en la mano', 'any', { t: 'prop', action: 'hold', prop: 'lamp' }],
  ['Junta cucharas y las apila', 'room', { t: 'prop', action: 'hold', prop: 'spoons' }],
  ['Le hace señas al cielo con una linterna', 'any', { t: 'prop', action: 'wave', prop: 'flashlight' }],
  ['Escucha un reloj como si hablara', 'room', { t: 'prop', action: 'use', prop: 'clock' }],
  ['Lleva un imán y lo acerca a todo', 'any', { t: 'prop', action: 'hold', prop: 'magnet' }],
  ['Tiene un cubito de hielo en la mano que no se derrite', 'any', { t: 'prop', action: 'hold', prop: 'ice' }],
  ['Le habla a una taza vacía', 'any', { t: 'prop', action: 'use', prop: 'cup' }],
  // Lo que dice.
  ['Cuenta en voz alta: 1, 1, 2, 3, 5, 8…', 'any', { t: 'say', lines: ['1, 1, 2, 3', '5, 8, 13…', '21, 34, 55…'] }],
  ['Dice "bip bup" sin parar', 'any', { t: 'say', lines: ['bip', 'bup', 'bip bup', 'bip bip bup'] }],
  ['Repite "hola" con voz de robot', 'any', { t: 'say', lines: ['HOLA', 'HOLA HOLA', 'HO-LA'] }],
  ['Se ríe solo', 'any', { t: 'say', lines: ['JA', 'JA JA', 'JA JA JA'] }],
  ['Habla en un idioma de símbolos', 'any', { t: 'say', lines: ['⍙⟟⏃⋏', '⏚⟒⏃⋔', '⌇⟟⍀⟒⋏'], color: GREEN }],
  ['Dice "soy un humano normal"', 'any', { t: 'say', lines: ['SOY UN', 'HUMANO', 'NORMAL'] }],
  ['Dice "tomar agua es divertido"', 'any', { t: 'say', lines: ['TOMAR AGUA', 'ES DIVERTIDO'] }],
  ['Pregunta "¿qué es la lluvia?"', 'any', { t: 'say', lines: ['¿QUÉ ES', 'LA LLUVIA?'] }],
  ['Dice números primos', 'any', { t: 'say', lines: ['2, 3, 5', '7, 11, 13', '17, 19…'] }],
  ['Saluda al cielo: "¡ya casi!"', 'any', { t: 'say', lines: ['¡YA CASI!', 'ESTÁN', 'LLEGANDO'] }],
  ['Canta al revés', 'any', { t: 'say', lines: ['♪ alal ♪', '♪ olic ♪'], color: VIOLET }],
  ['Le pide a la gente "llévenme con su líder"', 'any', { t: 'say', lines: ['LLÉVENME', 'CON SU', 'LÍDER'] }],
  ['Imita a un gato: "miau" sin emoción', 'any', { t: 'say', lines: ['MIAU.', 'MIAU.'] }],
  ['Recita la hora exacta en segundos', 'any', { t: 'say', lines: ['43.212 s', '43.213 s', '43.214 s'] }],
  // Mira al francotirador.
  ['Se da vuelta y mira fijo a tu mira', 'any', { t: 'face', mode: 'stare' }],
  ['Te saluda con la mano', 'any', { t: 'face', mode: 'wave' }],
  ['Te señala con el dedo', 'any', { t: 'face', mode: 'point' }],
  ['Te hace la venia', 'any', { t: 'face', mode: 'salute' }],
  ['Te levanta el pulgar', 'any', { t: 'face', mode: 'thumbs' }],
  ['Te sonríe con demasiados dientes', 'any', { t: 'face', mode: 'smile' }],
  ['Te hace "shh" con el dedo', 'any', { t: 'face', mode: 'shush' }],
  ['Te hace una reverencia', 'any', { t: 'face', mode: 'bow' }],
  // Lo que le pasa alrededor.
  ['Las luces titilan cuando pasa', 'room', { t: 'env', mode: 'lights' }],
  ['La tele se llena de estática', 'living', { t: 'env', mode: 'tvstatic' }],
  ['Las plantas se marchitan a su lado', 'any', { t: 'env', mode: 'plantwilt' }],
  ['Un perro le ladra sin parar', 'any', { t: 'env', mode: 'dogbark' }],
  ['Un gato le bufa', 'room', { t: 'env', mode: 'cathiss' }],
  ['Los pájaros salen volando cuando pasa', 'street', { t: 'env', mode: 'birds' }],
  ['Los relojes se ponen a girar rápido', 'room', { t: 'env', mode: 'clocks' }],
  ['La radio se llena de interferencia', 'room', { t: 'env', mode: 'radio' }],
  ['Se escarcha la ventana a su lado', 'room', { t: 'env', mode: 'frost' }],
  ['Las cosas flotan a su alrededor', 'any', { t: 'env', mode: 'levitate' }],
  ['Dibuja símbolos que brillan en la pared', 'room', { t: 'env', mode: 'symbols' }],
  ['Hace círculos raros en el piso', 'any', { t: 'env', mode: 'cropcircle' }],
  ['Le saltan chispas de los dedos', 'any', { t: 'env', mode: 'sparks' }],
  ['Lo siguen las moscas', 'any', { t: 'env', mode: 'flies' }],
  // Posturas raras.
  ['Está parado mirando el rincón', 'room', { t: 'pose', mode: 'corner' }],
  ['Pega la cara contra la ventana', 'room', { t: 'pose', mode: 'window' }],
  ['Mira al cielo con los brazos arriba', 'any', { t: 'pose', mode: 'sky' }],
  ['Levanta el celular hacia el cielo', 'any', { t: 'pose', mode: 'phoneSky' }],
  ['Hace señales con los brazos al cielo', 'any', { t: 'pose', mode: 'signal' }],
  ['Duerme parado', 'any', { t: 'pose', mode: 'sleepStand' }],
  ['Mide la habitación con las manos', 'room', { t: 'pose', mode: 'measure' }],
  ['Olfatea todo lo que tiene cerca', 'any', { t: 'pose', mode: 'sniff' }],
  ['Abraza la pared', 'room', { t: 'pose', mode: 'hugWall' }],
  ['Se arrodilla frente a la heladera', 'kitchen', { t: 'pose', mode: 'kneel' }],
  ['Se queda con los brazos abiertos como un avión', 'any', { t: 'pose', mode: 'armsOut' }],
  ['Se queda quieto como una estatua', 'any', { t: 'pose', mode: 'statue' }],
  ['Se queda en pose de "T"', 'any', { t: 'pose', mode: 'tpose' }],
  ['Apoya la cabeza contra la pared', 'room', { t: 'pose', mode: 'headWall' }],
  ['Se sienta en una silla que no existe', 'any', { t: 'pose', mode: 'sitAir' }],
  ['Se acuesta en el medio del piso', 'any', { t: 'pose', mode: 'lieFloor' }],
  // Más combinaciones.
  ['Le brillan los ojos celestes', 'any', { t: 'look', mode: 'eyes', color: CYAN }],
  ['Tiene un resplandor naranja', 'any', { t: 'look', mode: 'aura', color: ORANGE }],
  ['Muerde un libro', 'any', { t: 'prop', action: 'eat', prop: 'book' }],
  ['Huele una media con cara de felicidad', 'room', { t: 'prop', action: 'use', prop: 'sock' }],
  ['Le habla a un pescado', 'kitchen', { t: 'prop', action: 'use', prop: 'fish' }],
  ['Tiene una vela prendida en la cabeza', 'any', { t: 'prop', action: 'wear', prop: 'candle' }],
  ['Agita un huevo como un sonajero', 'kitchen', { t: 'prop', action: 'wave', prop: 'egg' }],
  ['Pregunta "¿para qué sirven los pies?"', 'any', { t: 'say', lines: ['¿PARA QUÉ', 'SIRVEN', 'LOS PIES?'] }],
];

export const ANOMALIES: Anomaly[] = SPECS.map(([text, where, fx], id) => ({ id, text, where, fx }));

// Baraja todas las anomalías (Fisher-Yates) para que en cada partida salgan en otro orden.
export function shuffledAnomalies(rand: () => number) {
  const deck = ANOMALIES.map(a => a.id);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

// ¿Puede pasar acá? `theme` es el tipo de habitación (o null en la vereda).
export function fitsPlace(a: Anomaly, theme: string | null) {
  if (a.where === 'any') return true;
  if (a.where === 'street') return theme === null;
  if (a.where === 'room') return theme !== null;
  return theme === a.where;
}
